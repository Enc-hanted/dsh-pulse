/**
 * dsh-pulse aggregation — the pure, side-effect-free folds behind the usage
 * observatory.
 *
 * `pulseProjectionDefinition()` is the `pulseUsage` session-projection unit:
 * an incremental per-event fold registered on `ctx.sessionProjections` (the
 * harness drives `apply` over every committed event of every live session,
 * keeps the watermark cache warm, and persisted sessions are read back
 * through the projection cache's ladder — stored rows for unseeded sessions,
 * a caller-driven cold fold over `sessionQuery.readSession`'s log otherwise),
 * so the HTTP route reads O(1) snapshots instead of re-reading whole session
 * logs. `foldEvents` runs the same fold over a synthetic event array for
 * tests and offline use.
 *
 * The rest are pure window/payload helpers: `resolveWindow` validates and
 * clamps a request window, `sliceRecord` cuts one record's per-day maps to
 * that window, and `buildPayload` assembles the wire payload (schema 4).
 *
 * @module dsh-pulse/aggregate
 */

import { z } from "zod";
import { AUX_PRICE_AS, BEIJING_OFFSET_MS, DEFAULT_USD_TO_CNY, PEAK_HOURS, activeCard } from "./pricing-facts.js";
import { dayStart, localDay, modelKey } from "./view/keys.js";

// Calendar primitives live in view/keys.js — their single home — and are
// re-exported here so existing aggregate imports keep working.
export { dayStart, localDay };

/**
 * Project label from a session working directory: the trailing `depth`
 * segments joined with `/` (both separators normalized), defaulting to the
 * basename. Deeper labels disambiguate same-named directories in different
 * parents; the config clamps `depth` to 1..3.
 */
export function projectOf(cwd, depth = 1) {
  if (typeof cwd !== "string" || cwd.length === 0) return null;
  const parts = cwd.split(/[\\/]/).filter((s) => s.length > 0);
  if (parts.length === 0) return null;
  const d = Math.max(1, Math.min(3, Math.floor(Number(depth) || 1)));
  return parts.slice(-d).join("/");
}

/** Defensive number coercion for provider-reported usage fields. */
function num(value) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Upper bound for a served window (keeps payloads bounded). — ~3 years */
export const MAX_WINDOW_DAYS = 1095;

/** How far a day's boundary readings may sit from the day itself before
 *  its spend degrades into an interval estimate (`sparse` rows): the enter
 *  reading older than noon of the previous day, or the leave reading from
 *  before noon of the day, means the attribution window swallows the
 *  neighbors' usage (or the day's own tail) — drift and calibration skip
 *  such days, displays may mark them. */
export const SNAPSHOT_SPARSE_STALE_MS = 12 * 3600000;

/** Days of per-hour detail the projection keeps (the hourly chart only needs
 *  the current day; a small retention window keeps the persisted checkpoint
 *  and every payload small while covering a dashboard left open over
 *  midnight). Older hour maps are pruned as newer events arrive. */
export const HOURS_RETENTION_DAYS = 3;

/** Clamp a requested window length to 1..MAX_WINDOW_DAYS. */
export function clampDays(days) {
  const n = Math.floor(Number(days));
  if (!Number.isFinite(n)) return 30;
  return Math.max(1, Math.min(MAX_WINDOW_DAYS, n));
}

/** A `YYYY-MM-DD` literal is valid only when it round-trips the local calendar. */
export function validDay(day) {
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  return localDay(dayStart(day)) === day;
}

/**
 * Resolve a request window into a clamped `{fromDay, toDay}` pair spanning
 * 1..MAX_WINDOW_DAYS. A missing or invalid bound falls back to the last
 * `fallbackDays` ending today; a reversed pair is swapped; an over-long span
 * keeps its end and trims its start.
 *
 * @param {{from?: string, to?: string, days?: number|string}} input - request parameters.
 * @param {number} fallbackDays - default span when no valid range is given.
 * @param {number} [now] - clock override for tests.
 */
export function resolveWindow(input, fallbackDays, now = Date.now()) {
  const today = localDay(now);
  let fromDay = validDay(input?.from) ? input.from : undefined;
  let toDay = validDay(input?.to) ? input.to : undefined;
  if (fromDay === undefined || toDay === undefined) {
    const span = clampDays(input?.days ?? fallbackDays);
    fromDay = localDay(dayStart(today) - (span - 1) * 86400000);
    toDay = today;
  } else if (fromDay > toDay) {
    [fromDay, toDay] = [toDay, fromDay];
  }
  const span = Math.round((dayStart(toDay) - dayStart(fromDay)) / 86400000) + 1;
  if (span > MAX_WINDOW_DAYS) {
    fromDay = localDay(dayStart(toDay) - (MAX_WINDOW_DAYS - 1) * 86400000);
  }
  return { fromDay, toDay };
}

const EMPTY_TOKENS = () => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });

/** Zero tier split (each token kind with `peak` / `offpeak` halves). */
const EMPTY_TIER = () => ({
  input: { peak: 0, offpeak: 0 },
  output: { peak: 0, offpeak: 0 },
  cacheRead: { peak: 0, offpeak: 0 },
  cacheWrite: { peak: 0, offpeak: 0 },
});

function addTokens(bucket, usage) {
  bucket.input += num(usage.inputTokens);
  bucket.output += num(usage.outputTokens);
  bucket.cacheRead += num(usage.cacheReadTokens);
  bucket.cacheWrite += num(usage.cacheWriteTokens);
}

/** Add one event's usage to the `"peak"` or `"offpeak"` side of a tier split. */
function addTier(bucket, usage, tier) {
  bucket.input[tier] += num(usage.inputTokens);
  bucket.output[tier] += num(usage.outputTokens);
  bucket.cacheRead[tier] += num(usage.cacheReadTokens);
  bucket.cacheWrite[tier] += num(usage.cacheWriteTokens);
}

/** One usage record's disjoint token sum — the fold's counting rule, shared
 *  by every event whose usage counts (`assistant/message`, `compaction/summary`).
 *  Fields outside the four buckets (`totalTokens`, `reasoningTokens`) are
 *  derived or auxiliary readings and must never add to the sum. */
function usageSum(usage) {
  return num(usage.inputTokens) + num(usage.outputTokens)
    + num(usage.cacheReadTokens) + num(usage.cacheWriteTokens);
}

/** One token kind split across the two pricing tiers. */
const tierSplit = z.object({
  peak: z.number().nonnegative(),
  offpeak: z.number().nonnegative(),
}).strict();

/** Tier split of a day's per-model usage (peak vs off-peak, Beijing time). */
const tierTokensSchema = z.object({
  input: tierSplit,
  output: tierSplit,
  cacheRead: tierSplit,
  cacheWrite: tierSplit,
}).strict();

/** Peak/off-peak pair of an auxiliary day entry (call counts or estimated
 *  token amounts — both integers by construction). */
const auxTierCountsSchema = z.object({
  peak: z.number().int().nonnegative(),
  offpeak: z.number().int().nonnegative(),
}).strict();

/** Wire shape of the `pulseUsage` projection unit (validates `view` output). */
export const pulseUsageSchema = z.object({
  byDay: z.record(z.string(), z.object({
    input: z.number().nonnegative(),
    output: z.number().nonnegative(),
    cacheRead: z.number().nonnegative(),
    cacheWrite: z.number().nonnegative(),
  }).strict()),
  modelsByDay: z.record(z.string(), z.record(z.string(), z.object({
    input: z.number().nonnegative(),
    output: z.number().nonnegative(),
    cacheRead: z.number().nonnegative(),
    cacheWrite: z.number().nonnegative(),
  }).strict())),
  hoursByDay: z.record(z.string(), z.record(z.string(), z.record(z.string(), z.object({
    input: z.number().nonnegative(),
    output: z.number().nonnegative(),
    cacheRead: z.number().nonnegative(),
    cacheWrite: z.number().nonnegative(),
  }).strict()))),
  tiersByDay: z.record(z.string(), z.record(z.string(), tierTokensSchema)),
  turnsByDay: z.record(z.string(), z.number().int().nonnegative()),
  toolCallsByDay: z.record(z.string(), z.number().int().nonnegative()),
  /** Per-tool call histogram by day (runaway-loop fingerprinting): the
   *  `tool/call` event's `name`, counted per day. Names are opaque ids —
   *  MCP tools arrive as `mcp__<server>__<tool>` — and never carry argument
   *  content. Optional so pre-histogram rows and view literals stay valid;
   *  the stateVersion bump is what forces history to re-fold with it. */
  toolHistogramByDay: z.record(z.string(), z.record(z.string(), z.number().int().nonnegative())).optional(),
  /** Auxiliary-call counters (official `web_search` / title LLM / timeline
   *  report LLM): per day. Locally only the request event exists — no usage
   *  event — so search stays a count (the view's shape turns counts into
   *  estimated tokens), while title requests carry their exact prompt text
   *  and output cap and are therefore folded as TEXT-DERIVED token estimates
   *  (`titleIn` / `titleOut`, tier-split by the event's own instant) plus the
   *  route the day's title calls billed under (last route wins after a
   *  config change mid-day). Timeline report requests keep a plain count
   *  tier-split by the billed model their request names — no usage event
   *  exists to estimate from, so they never become tokens. */
  auxByDay: z.record(z.string(), z.object({
    search: auxTierCountsSchema.optional(),
    title: auxTierCountsSchema.optional(),
    titleIn: auxTierCountsSchema.optional(),
    titleOut: auxTierCountsSchema.optional(),
    titleKey: z.string().optional(),
    timeline: auxTierCountsSchema.optional(),
    /** Timeline report outcomes, plain counts with no tier side: a report's
     *  summary call that landed (`plugin:timeline/report`) and one that
     *  failed — rate limit, transport, unfinished (`plugin:timeline/failure`).
     *  The request behind either is already counted under `timeline`. */
    timelineReports: z.number().int().nonnegative().optional(),
    timelineFailures: z.number().int().nonnegative().optional(),
  }).strict()),
  /** The session's display title (last `session/title` event wins): rides the
   *  fold so the sessions list can name rows without a per-session service
   *  round-trip. Null until the log carries one. */
  title: z.string().nullable().optional(),
  /** The session's own agent label: a subagent's log opens with its
   *  `subagent/descriptor`, whose `label` names the job it was spawned for
   *  ("深挖 minimax-code 功能机制"). The session list shows it ahead of the
   *  LLM title, which for a subagent is a fragment of its delegation prompt.
   *  Absent until the log carries one — the view and the windowed record
   *  stay byte-identical without it. */
  label: z.string().optional(),
  /** Title of the task tree the session's timeline plugin last reported
   *  (`plugin:timeline/tree`): the collaboration panel names a session's
   *  timeline work by it. Absent until the log carries one. */
  timelineTitle: z.string().optional(),
  /** Formal team members the session spawned (Agent Teams `team/member`):
   *  member id — which IS the member's child session id — → the name the
   *  team board shows. Absent until the log carries one. */
  teamNames: z.record(z.string(), z.string()).optional(),
  firstDay: z.string().nullable(),
}).strict();

/** Full fold-state shape of the `pulseUsage` unit: the client-visible view
 *  plus the fold's own internals (`lastTurn`, the id of the last folded
 *  turn; `inheritedEventCount`, the fork cut below which nothing counts).
 *  Since the 0.1.1-rc session-projection registry validates persisted
 *  checkpoint rows against the unit's STATE schema (`stateSchema`), it must
 *  cover every field the fold keeps — the view schema alone would reject
 *  rows at restore and demote every cold read to a full-log replay. */
export const pulseUsageStateSchema = pulseUsageSchema.extend({
  lastTurn: z.number().int().nonnegative().nullable(),
  inheritedEventCount: z.number().int().nonnegative(),
});

/** Local `HH` hour key for a timestamp (e.g. "07", "23"). */
function hourKey(timeMs) {
  return String(new Date(timeMs).getHours()).padStart(2, "0");
}

// Peak-tier pricing facts live in pricing-facts.js — their single home —
// and are re-exported here so existing aggregate imports keep working.
export { BEIJING_OFFSET_MS, PEAK_HOURS };

/** The composite model key auxiliary calls bill under — derived live from
 *  the ONE constant the pricing side uses (`AUX_PRICE_AS`), so the tier
 *  classification and the pricing lookup can never disagree about which
 *  model an aux request rides, even across a runtime card apply. Title
 *  requests whose event carries a concrete route classify under that
 *  route's own tier spec instead. */
const auxTierKey = () => modelKey("", AUX_PRICE_AS);

/** Title outputs are a visible title plus nothing else (the DeepSeek adapter
 *  disables thinking for the session-title purpose), so the billed output is
 *  the request's own cap — clamped hard, since a misconfigured large cap
 *  must never inflate the estimate. */
const TITLE_OUT_EST = 32;

/**
 * Estimated token count of one text: CJK characters price at ≈0.6 tokens
 * each, everything else at ≈0.3 (the approximation DeepSeek's own docs use
 * for mixed zh/en input). Input length is capped so a pathological event can
 * neither stall the fold nor grow the state.
 */
export function estimateTokens(text) {
  if (typeof text !== "string" || text === "") return 0;
  let chars = 0;
  let cjk = 0;
  const capped = text.length > 1e6 ? text.slice(0, 1e6) : text;
  for (const ch of capped) {
    chars += 1;
    const cp = ch.codePointAt(0);
    if ((cp >= 0x2e80 && cp <= 0x9fff) || (cp >= 0xff00 && cp <= 0xffef)) cjk += 1;
  }
  return Math.ceil(cjk * 0.6 + (chars - cjk) * 0.3);
}

/** Estimated output tokens of one title request: the event's own cap, taken
 *  down to the title-sized clamp (missing caps read at the clamp). */
function titleOutEstimate(maxTokens) {
  const cap = typeof maxTokens === "number" && Number.isFinite(maxTokens) && maxTokens > 0
    ? maxTokens
    : TITLE_OUT_EST;
  return Math.max(1, Math.round(Math.min(cap, TITLE_OUT_EST)));
}

/** Sum the estimated input tokens of one title request: the system prompt
 *  plus every text block of every message (the exact model-visible input). */
function titleInputEstimate(data) {
  let tokens = estimateTokens(data?.system);
  const messages = Array.isArray(data?.messages) ? data.messages : [];
  for (const message of messages) {
    if (message === null || typeof message !== "object") continue;
    if (typeof message.content === "string") {
      tokens += estimateTokens(message.content);
      continue;
    }
    for (const block of Array.isArray(message.content) ? message.content : []) {
      if (block !== null && typeof block === "object" && typeof block.text === "string") {
        tokens += estimateTokens(block.text);
      }
    }
  }
  return tokens;
}

/** Normalize a configured hour list into a deduplicated, valid one. A
 *  non-array (undefined settings) means "not configured" and falls back to
 *  the official hours; an explicit empty array is meaningful — "no peak
 *  hours", i.e. flat pricing — and survives; a non-empty array whose entries
 *  are all invalid falls back to the official hours (garbage never becomes
 *  "flat" silently). Never throws from the fold over bad settings. */
export function normalizePeakHours(hours) {
  if (!Array.isArray(hours)) return [...PEAK_HOURS];
  const valid = hours.filter((h) => Number.isInteger(h) && h >= 0 && h <= 23);
  if (valid.length === 0 && hours.length > 0) return [...PEAK_HOURS];
  return [...new Set(valid)].sort((a, b) => a - b);
}

/** `"peak"` | `"offpeak"` pricing tier of a timestamp under the given peak
 *  hours (Beijing time, hour granularity). Accepts an hour array or the Set
 *  the projection materializes; defaults to the official windows. The
 *  official peak windows run Monday–Friday only, so `peakHours` is an object
 *  `{hours, weekdaysOnly}` when a rule needs a specific day scope: with
 *  `weekdaysOnly` the peak hours apply on weekdays and every hour of Saturday
 *  and Sunday is off-peak. A bare hour array keeps the historical all-day
 *  reading (peak hours on every day of the week).
 *
 * @param {number} timeMs - epoch-ms timestamp.
 * @param {any} [peakHours=PEAK_HOURS] - peak-hour spec: a bare hour array
 *   (all days), the Set the projection materializes, or a
 *   `{hours, weekdaysOnly}` object. Duck-typed at runtime (Array / `.has`
 *   / spec-object probes), so the annotation stays loose on purpose.
 * @returns {"peak"|"offpeak"} the pricing tier of that instant. */
export function tierAt(timeMs, peakHours = PEAK_HOURS) {
  const spec = Array.isArray(peakHours) || typeof peakHours?.has === "function"
    ? { hours: peakHours, weekdaysOnly: false }
    : (peakHours ?? { hours: PEAK_HOURS, weekdaysOnly: false });
  const at = new Date(timeMs + BEIJING_OFFSET_MS);
  if (spec.weekdaysOnly === true) {
    const dow = at.getUTCDay();
    if (dow === 0 || dow === 6) return "offpeak";
  }
  const hh = at.getUTCHours();
  const hours = spec.hours;
  if (typeof hours?.has === "function") return hours.has(hh) ? "peak" : "offpeak";
  return (Array.isArray(hours) ? hours : PEAK_HOURS).includes(hh) ? "peak" : "offpeak";
}

/**
 * @typedef {object} ProjectionDefinition
 * @property {string} key - the registry's projection key.
 * @property {*} schema - legacy (pre-0.1.1-rc) client-view zod schema.
 * @property {*} stateSchema - 0.1.1-rc persisted-state zod schema.
 * @property {(header: any, inheritedEventCount: number) => any} init - the
 *   empty fold state for one session (the registry's fork cut rides in).
 * @property {(state: any, event: any) => any} apply - one committed event's
 *   incremental fold (returns the same reference when nothing changed).
 * @property {(state: any) => any} view - the client-visible cut.
 * @property {{viewSchema: *, view: (state: any) => any}} wire - the
 *   0.1.1-rc wire boundary.
 * @property {number} stateVersion - fold-semantics version (cache key part).
 */

/**
 * One windowed session record as served by `/pulse/stats`: per-day maps
 * keyed `YYYY-MM-DD`, model maps keyed by the composite
 * `provider\u0000model`. A `sliceRecord` output (also accepted as fold
 * input for slicing). Map values stay loose — every reader guards shapes
 * at runtime.
 *
 * @typedef {object} WindowedRecord
 * @property {string|null} [id]
 * @property {number|null} [createdAt]
 * @property {string} [createdDay] - creation day, the empty-window anchor.
 * @property {string|null} [project]
 * @property {boolean} [subagent]
 * @property {string|null} [parentSession]
 * @property {string|null} [title]
 * @property {number} [delegationDepth]
 * @property {string|null} [firstDay] - earliest attributed day.
 * @property {string|null} [day] - the windowed record's anchor day.
 * @property {Object.<string, any>} [byDay] - day → token totals.
 * @property {Object.<string, Object.<string, any>>} [modelsByDay] - day → model → tokens.
 * @property {Object.<string, Object.<string, Object.<string, any>>>} [hoursByDay] - day → `HH` → model → tokens.
 * @property {Object.<string, Object.<string, any>>} [tiersByDay] - day → model → peak/off-peak split.
 * @property {Object.<string, number>} [turnsByDay]
 * @property {Object.<string, number>} [toolCallsByDay]
 * @property {Object.<string, Object.<string, number>>} [toolHistogramByDay] - day → tool → count.
 * @property {Object.<string, any>} [auxByDay] - day → aux counters.
 * @property {string} [label] - a subagent's own descriptor label.
 * @property {string} [timelineTitle] - the task tree the session last touched.
 * @property {Object.<string, string>} [teamNames] - team member id → name.
 * @property {number} [turns] - schema-2 fallback scalar.
 * @property {number} [toolCalls] - schema-2 fallback scalar.
 */

/** Fold-semantics version of the `pulseUsage` unit at load (the host adds its
 *  peak-hour epoch on top). 14 adds the collaboration attribution: a
 *  subagent's own descriptor label, the timeline report outcomes, the task
 *  tree title, the team member names — all optional, all absent until the
 *  log carries them. 13 folded the auxiliary bills the fold used to miss:
 *  `compaction/summary` carries real usage under its own provider and
 *  model, and `plugin:timeline/request` at least carries its call. 12 was
 *  the fork-aware fold: a seeded session's inherited prefix stops counting,
 *  so every row persisted before it replays from its log. 11 added the tool
 *  histogram. */
export const PULSE_STATE_VERSION = 14;

/** The registry's fork cut, normalized: a positive safe integer, else 0
 *  (unseeded sessions, synthetic folds, older hosts that pass nothing). */
function cutOf(inheritedEventCount) {
  return Number.isSafeInteger(inheritedEventCount) && inheritedEventCount > 0 ? inheritedEventCount : 0;
}

/** Whether `event` sits inside a fork's inherited prefix. */
function isInherited(event, inheritedEventCount) {
  return inheritedEventCount > 0 && typeof event.seq === "number" && event.seq < inheritedEventCount;
}

/**
 * The `pulseUsage` projection unit for `ctx.sessionProjections.register`.
 *
 * Folding semantics:
 * - A seeded session (a fork, or a subagent spawned from the parent's
 *   history) opens with a copy of its parent's events. The registry hands
 *   the cut to `init` and then drives `apply` over the copied events too.
 *   Every event below the cut is skipped: the parent's own fold already
 *   counts that usage, and counting each copy billed it once more per fork.
 *   The one exception is `session/title` — a fork stays named after the
 *   conversation it forked from until it earns a title of its own.
 * - `byDay` / `modelsByDay` accumulate the disjoint provider usage of each
 *   `assistant/message` and each `compaction/summary` event — a compaction
 *   run bills the provider under the provider/model its event names, and
 *   current hosts report its exact usage buckets there (input = uncached
 *   input; cacheRead/cacheWrite are reported separately by the harness
 *   adapters). Model keys are
 *   `provider\u0000model` composites from the event's message source, so
 *   same-named models of different providers fold into distinct rows; a
 *   missing provider (legacy events) falls back to the bare model id.
 *   Events whose adapter reported no usage, or whose sum is zero, add nothing.
 * - `hoursByDay` keeps the same usage per local `HH` hour and per model for
 *   the most recent {@link HOURS_RETENTION_DAYS} days — the hourly line
 *   chart's data source, model-filterable. Older hour maps are pruned as
 *   newer days arrive, keeping the state and persisted checkpoints bounded.
 * - `tiersByDay` splits each day's per-model usage into `peak` / `offpeak`
 *   halves under the peak hour set that `peakHoursFor(model)` returns at
 *   fold time (Beijing time; defaults to the official windows). Changing a
 *   model's peak hours must re-fold history: the host re-registers the unit
 *   with a bumped `stateVersion`, which invalidates every persisted cache
 *   row and replays each session's log on its next read.
 * - `turnsByDay` counts distinct turns carrying at least one closed step —
 *   `step/end`, the step-lifecycle authority, so rejected/empty turns are
 *   uncounted (first-party `dsh-session-stats` parity).
 * - `toolCallsByDay` counts `tool/call` events.
 * - `label` is a subagent's own `subagent/descriptor` label. Every stored
 *   subagent log opens with it one event above the fork cut, so the cut has
 *   already kept an inherited parent descriptor out: a forked subagent names
 *   itself, never the parent title it inherited below the cut. `timelineTitle`
 *   is the tree the session's timeline plugin last reported, `teamNames` the
 *   members an Agent Teams parent spawned (member id = child session id), and
 *   `auxByDay.timelineReports` / `timelineFailures` the outcomes of timeline
 *   report summaries. All four stay absent until the log carries them.
 * - `firstDay` is the lexicographically earliest attributed day; day keys
 *   come from each event's timestamp in the local timezone. Events with a
 *   missing timestamp are not day-attributed (they still count nowhere —
 *   every real session event carries a time).
 * - `apply` returns the same state reference when nothing changed (the
 *   registry's change feed keys on reference identity) and a new plain-JSON
 *   state otherwise.
 *
 * @param {object} [options]
 * @param {(model: string) => number[]|{hours: number[], weekdaysOnly?: boolean}} [options.peakHoursFor]
 *   - peak-hour spec per composite model key (`provider\u0000model`, bare id
 *   without a provider); omitted models fold at the official windows
 *   (weekdays only). Defaults to the official windows for everything.
 * @param {number} [options.stateVersion=PULSE_STATE_VERSION] - fold-semantics
 *   version; the host bumps it when peak-hour settings change so persisted
 *   rows replay.
 * @returns {ProjectionDefinition} the projection definition (`key`,
 *   `stateSchema`, `wire`, `init`, `apply`, `stateVersion`, plus the legacy
 *   `schema`/`view` pair).
 *
 * Registration contract: the harness's session-projection registry renamed
 * its boundary in 0.1.1-rc — the client-visible view now nests under
 * `wire: {viewSchema, view}` and the persisted-state boundary is its own
 * `stateSchema`, while older hosts read the top-level `schema`/`view` pair.
 * This definition carries BOTH shapes so one unit serves either host
 * generation: each registry reads the fields it knows and ignores the rest
 * (a unit without `wire` is treated as host-internal and never surfaces in
 * snapshot values — the failure mode this dual contract exists to prevent).
 */
export function pulseProjectionDefinition({ peakHoursFor, stateVersion = PULSE_STATE_VERSION } = {}) {
  const dayOf = (event) => (num(event.time) > 0 ? localDay(event.time) : null);
  /** Per-model tier specs, materialized once (the map lives and dies with one
   *  registration, so a re-register on settings change starts it fresh). An
   *  explicitly empty hour list is legal — "no peak hours", flat pricing. */
  const hourSets = new Map();
  /** Materialize one model's tier spec from whatever the resolver returned.
   *  `undefined`/`null` is "not configured" — the official windows, weekdays
   *  only; a spec object carries its own scope; a bare hour array keeps the
   *  historical all-days reading; no resolver at all is the official case. */
  const specOf = (configured) => {
    const isSpec = configured !== null && typeof configured === "object"
      && !Array.isArray(configured) && typeof configured.has !== "function";
    if (configured === undefined || configured === null) return { hours: new Set(PEAK_HOURS), weekdaysOnly: true };
    const raw = isSpec ? configured.hours : configured;
    const weekdaysOnly = isSpec ? configured.weekdaysOnly === true : false;
    if (raw === undefined || raw === null) return { hours: new Set(PEAK_HOURS), weekdaysOnly: true };
    if (typeof raw.has === "function") return { hours: raw, weekdaysOnly };
    return { hours: new Set(Array.isArray(raw) ? raw : []), weekdaysOnly };
  };
  const hoursOf = (model) => {
    let spec = hourSets.get(model);
    if (spec === undefined) {
      spec = typeof peakHoursFor === "function" ? specOf(peakHoursFor(model)) : specOf(undefined);
      hourSets.set(model, spec);
    }
    return spec;
  };
  const withFirstDay = (next, day) => {
    if (next.firstDay === null || day < next.firstDay) next.firstDay = day;
  };
  /** Copy-on-write prune: drop hour maps older than the retention window. */
  const prunedHours = (hoursByDay, latestDay) => {
    const cutoff = localDay(dayStart(latestDay) - (HOURS_RETENTION_DAYS - 1) * 86400000);
    let pruned = null;
    for (const day of Object.keys(hoursByDay)) {
      if (day >= cutoff) continue;
      pruned ??= { ...hoursByDay };
      delete pruned[day];
    }
    return pruned ?? hoursByDay;
  };
  /** One billed call's day attribution, shared by every event that carries a
   *  real usage object under its own model key (`assistant/message`,
   *  `compaction/summary`): the day total, the per-model and per-hour maps,
   *  the peak/off-peak tier split, `firstDay`. Returns the state unchanged
   *  when the event carries no usable timestamp. */
  const accumulateUsage = (state, event, key, usage) => {
    const day = dayOf(event);
    if (day === null) return state; // untimestamped: nothing is day-attributed
    const next = { ...state };
    next.byDay = { ...state.byDay };
    const daily = { ...(state.byDay[day] ?? EMPTY_TOKENS()) };
    addTokens(daily, usage);
    next.byDay[day] = daily;
    next.modelsByDay = { ...state.modelsByDay };
    const dayModels = { ...(state.modelsByDay[day] ?? {}) };
    const perModel = { ...(dayModels[key] ?? EMPTY_TOKENS()) };
    addTokens(perModel, usage);
    dayModels[key] = perModel;
    next.modelsByDay[day] = dayModels;
    next.hoursByDay = prunedHours(state.hoursByDay, day);
    const hh = hourKey(event.time);
    const dayHours = { ...(next.hoursByDay[day] ?? {}) };
    const hourModels = { ...(dayHours[hh] ?? {}) };
    const perHourModel = { ...(hourModels[key] ?? EMPTY_TOKENS()) };
    addTokens(perHourModel, usage);
    hourModels[key] = perHourModel;
    dayHours[hh] = hourModels;
    next.hoursByDay = { ...next.hoursByDay, [day]: dayHours };
    // Peak/off-peak split (Beijing-time hours, weekday-scoped per the
    // rule) per day and model, the cost estimate's tier source for any
    // window length.
    const dayTiers = { ...(state.tiersByDay[day] ?? {}) };
    const modelTiers = { ...(dayTiers[key] ?? EMPTY_TIER()) };
    const tierSpec = hoursOf(key);
    addTier(modelTiers, usage, tierAt(event.time, { hours: tierSpec.hours, weekdaysOnly: tierSpec.weekdaysOnly }));
    dayTiers[key] = modelTiers;
    next.tiersByDay = { ...state.tiersByDay, [day]: dayTiers };
    withFirstDay(next, day);
    return next;
  };
  /** One client-visible cut of the fold state; shared by the legacy and the
   *  0.1.1-rc `wire` view so both hosts serve the same shape. */
  const viewOf = (state) => ({
    byDay: state.byDay,
    modelsByDay: state.modelsByDay,
    hoursByDay: state.hoursByDay,
    tiersByDay: state.tiersByDay,
    turnsByDay: state.turnsByDay,
    toolCallsByDay: state.toolCallsByDay,
    ...(state.toolHistogramByDay !== undefined ? { toolHistogramByDay: state.toolHistogramByDay } : {}),
    auxByDay: state.auxByDay,
    firstDay: state.firstDay,
    title: state.title ?? null,
    // Collaboration attribution rides only once the log carried it.
    ...(typeof state.label === "string" ? { label: state.label } : {}),
    ...(typeof state.timelineTitle === "string" ? { timelineTitle: state.timelineTitle } : {}),
    ...(state.teamNames !== undefined && Object.keys(state.teamNames).length > 0 ? { teamNames: state.teamNames } : {}),
  });
  return {
    key: "pulseUsage",
    // Legacy harnesses (pre-0.1.1-rc) read the top-level `schema`/`view` pair.
    schema: pulseUsageSchema,
    // 0.1.1-rc harnesses read `stateSchema` (full fold state, restore
    // boundary) and `wire` (client-visible view).
    stateSchema: pulseUsageStateSchema,
    init(_header, inheritedEventCount) {
      return {
        byDay: {}, modelsByDay: {}, hoursByDay: {}, tiersByDay: {}, turnsByDay: {}, toolCallsByDay: {}, toolHistogramByDay: {}, auxByDay: {}, firstDay: null, lastTurn: null, inheritedEventCount: cutOf(inheritedEventCount), title: null,
      };
    },
    apply(state, event) {
      if (event === null || typeof event !== "object") return state;
      const { type, data } = event;
      if (data === null || typeof data !== "object") return state;
      if (type === "session/title") {
        // Last title wins: the log carries one per generation (llm or
        // fallback), and the newest names the session best. Rides the
        // inherited prefix too — it is a label, not usage.
        const title = typeof data.title === "string" && data.title.trim() !== "" ? data.title.trim() : null;
        if (title === null || title === state.title) return state;
        return { ...state, title };
      }
      // Below the fork cut lies the parent's history, already folded there.
      if (isInherited(event, state.inheritedEventCount)) return state;
      if (type === "subagent/descriptor") {
        // The label names the job the spawning call asked for. Last one wins.
        const label = typeof data.label === "string" && data.label.trim() !== "" ? data.label.trim() : null;
        if (label === null || label === state.label) return state;
        return { ...state, label };
      }
      if (type === "team/member") {
        // Agent Teams membership: the member IS a child session, so the
        // parent's fold keeps the board's display name under the child id.
        const id = data.member?.id;
        const name = typeof data.member?.name === "string" ? data.member.name.trim() : "";
        if (typeof id !== "string" || id === "" || name === "") return state;
        if (state.teamNames?.[id] === name) return state;
        return { ...state, teamNames: { ...(state.teamNames ?? {}), [id]: name } };
      }
      if (type === "plugin:timeline/tree") {
        // The tree the session last touched names its timeline work.
        const title = typeof data.tree?.title === "string" && data.tree.title.trim() !== "" ? data.tree.title.trim() : null;
        if (title === null || title === state.timelineTitle) return state;
        return { ...state, timelineTitle: title };
      }
      if (type === "assistant/message") {
        const usage = data.usage;
        if (usage === null || typeof usage !== "object") return state;
        if (usageSum(usage) <= 0) return state;
        const source = data.message?.source;
        // Provider + model provenance: the composite key keeps same-named
        // models of different providers distinct in every per-model map.
        return accumulateUsage(state, event, modelKey(source?.provider, source?.model), usage);
      }
      if (type === "compaction/summary") {
        // The harness's compaction run bills the provider under the
        // provider/model its event names, and current hosts report the exact
        // usage buckets on the event — fold them like any message. Older
        // hosts' compaction events carry no usage: nothing to count, nothing
        // invented; the event is skipped the same way an unreported message
        // always was.
        const usage = data.usage;
        if (usage === null || typeof usage !== "object") return state;
        if (usageSum(usage) <= 0) return state;
        if (typeof data.model !== "string" || data.model === "") return state;
        return accumulateUsage(state, event, modelKey(typeof data.provider === "string" ? data.provider : "", data.model), usage);
      }
      if (type === "step/end") {
        if (state.lastTurn === data.turn) return state;
        const day = dayOf(event);
        const next = { ...state, lastTurn: data.turn };
        if (day !== null) {
          next.turnsByDay = { ...state.turnsByDay };
          next.turnsByDay[day] = (state.turnsByDay[day] ?? 0) + 1;
          withFirstDay(next, day);
        }
        return next;
      }
      if (type === "tool/call") {
        const day = dayOf(event);
        if (day === null) return state;
        const name = typeof data?.name === "string" && data.name !== "" ? data.name : "(unnamed)";
        const next = { ...state, toolCallsByDay: { ...state.toolCallsByDay } };
        next.toolCallsByDay[day] = (state.toolCallsByDay[day] ?? 0) + 1;
        const dayHist = { ...(state.toolHistogramByDay?.[day] ?? {}) };
        dayHist[name] = (dayHist[name] ?? 0) + 1;
        next.toolHistogramByDay = { ...state.toolHistogramByDay, [day]: dayHist };
        withFirstDay(next, day);
        return next;
      }
      if (type === "web/deepseek-search-llm-request" || type === "session/title-llm-request"
        || type === "plugin:timeline/request" || type === "plugin:timeline/report"
        || type === "plugin:timeline/failure") {
        // Auxiliary LLM calls (official web_search, title generation, timeline
        // reports): the log-only request event is the whole story locally.
        // Search keeps a count (the billing shape is the view's concern,
        // self-calibrated there); title carries its exact text and output
        // cap, so the fold records TEXT-DERIVED token estimates split by the
        // pricing tier of the event's own instant — the route's tier spec
        // when the event names one, the aux billing model's otherwise.
        // Timeline keeps a plain count under its billed model's tier spec,
        // and its report outcomes a plain day count.
        const day = dayOf(event);
        if (day === null) return state;
        const next = { ...state };
        next.auxByDay = { ...state.auxByDay };
        const dayAux = { ...(state.auxByDay[day] ?? {}) };
        if (type === "web/deepseek-search-llm-request") {
          const tierSpec = hoursOf(auxTierKey());
          const tier = tierAt(event.time, { hours: tierSpec.hours, weekdaysOnly: tierSpec.weekdaysOnly });
          const kindAux = { ...(dayAux.search ?? { peak: 0, offpeak: 0 }) };
          kindAux[tier] = (kindAux[tier] ?? 0) + 1;
          dayAux.search = kindAux;
        } else if (type === "session/title-llm-request") {
          const route = data?.route;
          const titleKey = typeof route?.model === "string" && route.model !== ""
            ? modelKey(typeof route?.provider === "string" ? route.provider : "", route.model)
            : null;
          const tierSpec = hoursOf(titleKey ?? auxTierKey());
          const tier = tierAt(event.time, { hours: tierSpec.hours, weekdaysOnly: tierSpec.weekdaysOnly });
          const counts = { ...(dayAux.title ?? { peak: 0, offpeak: 0 }) };
          counts[tier] = (counts[tier] ?? 0) + 1;
          dayAux.title = counts;
          const inTok = titleInputEstimate(data);
          if (inTok > 0) {
            const titleIn = { ...(dayAux.titleIn ?? { peak: 0, offpeak: 0 }) };
            titleIn[tier] = (titleIn[tier] ?? 0) + inTok;
            dayAux.titleIn = titleIn;
          }
          const outTok = titleOutEstimate(data?.maxTokens);
          const titleOut = { ...(dayAux.titleOut ?? { peak: 0, offpeak: 0 }) };
          titleOut[tier] = (titleOut[tier] ?? 0) + outTok;
          dayAux.titleOut = titleOut;
          // Last route wins: a mid-day config change prices the day under the
          // route its newest title call used (the estimate is labeled 估算).
          if (titleKey !== null) dayAux.titleKey = titleKey;
        } else if (type === "plugin:timeline/request") {
          // Timeline report requests: no usage event exists, so the count is
          // the honest whole — tiered by the billed model the request names
          // (its own tier spec), the aux billing model's when it names none.
          const request = data?.request;
          const requestKey = typeof request?.model === "string" && request.model !== ""
            ? modelKey(typeof request?.provider === "string" ? request.provider : "", request.model)
            : null;
          const tierSpec = hoursOf(requestKey ?? auxTierKey());
          const tier = tierAt(event.time, { hours: tierSpec.hours, weekdaysOnly: tierSpec.weekdaysOnly });
          const counts = { ...(dayAux.timeline ?? { peak: 0, offpeak: 0 }) };
          counts[tier] = (counts[tier] ?? 0) + 1;
          dayAux.timeline = counts;
        } else {
          // A report summary that landed, and one that failed: plain day
          // counts. The request behind either is counted above already.
          const outcome = type === "plugin:timeline/report" ? "timelineReports" : "timelineFailures";
          dayAux[outcome] = (dayAux[outcome] ?? 0) + 1;
        }
        next.auxByDay[day] = dayAux;
        withFirstDay(next, day);
        return next;
      }
      return state;
    },
    view: viewOf,
    wire: { viewSchema: pulseUsageSchema, view: viewOf },
    stateVersion,
  };
}

/** Fold a synthetic event array with the projection unit (tests, offline use).
 *  `options` reach {@link pulseProjectionDefinition} (`peakHoursFor`);
 *  `seed` is what the registry hands `init` — the session header and its
 *  fork cut (`inheritedEventCount`; omitted means an unseeded session). */
export function foldEvents(events, options = {}, seed = {}) {
  const definition = pulseProjectionDefinition(options);
  let state = definition.init(seed.header, seed.inheritedEventCount);
  for (const event of Array.isArray(events) ? events : []) {
    state = definition.apply(state, event);
  }
  return definition.view(state);
}

/**
 * Per-day actual-spend series over rolling balance snapshots: each day's
 * value is the balance entering the day minus the balance leaving it (the
 * last snapshot on or before each day boundary). A day whose balance grew
 * (a top-up masks the spend) or that lacks a prior snapshot carries `null`
 * — unknown, never a silently clamped zero. Days past the newest snapshot
 * are `null` too (the day is still running or unqueried).
 *
 * Each row also carries `sparse`: true when the day cannot pin a balance
 * move to a calendar day — its enter reading is stale (more than
 * {@link SNAPSHOT_SPARSE_STALE_MS} before the day began, so the window
 * swallows earlier days' usage) or its leave reading is early (more than
 * that before the day's noon, so the day's own tail is unobserved and
 * lands on the next reading). The official balance also settles
 * asynchronously, which widens the same uncertainty. A sparse row's spend
 * is an interval estimate; drift/calibration must skip it, displays may
 * mark it.
 *
 * @param {Array<{t: number, total: number}>} snapshots - query-time balance
 *   snapshots (epoch ms, CNY total); unsorted input is tolerated.
 * @param {string} fromDay - inclusive `YYYY-MM-DD` window start.
 * @param {string} toDay - inclusive `YYYY-MM-DD` window end.
 * @returns {Array<{key: string, spend: number|null, sparse: boolean}>} one
 *   entry per day.
 */
export function balanceSpendSeries(snapshots, fromDay, toDay) {
  if (validDay(fromDay) === false || validDay(toDay) === false || fromDay > toDay) return [];
  const snaps = (Array.isArray(snapshots) ? snapshots : [])
    .filter((s) => Number.isFinite(s?.t) && Number.isFinite(s?.total))
    .sort((a, b) => a.t - b.t);
  if (snaps.length === 0) return [];
  const keys = [];
  for (let day = fromDay; day <= toDay && keys.length <= MAX_WINDOW_DAYS; day = localDay(dayStart(day) + 86400000)) {
    keys.push(day);
  }
  let cursor = 0;
  let lastSeen = null;
  /** Snapshot at the end of `day`: the newest one on or before it (carried
   *  forward across unobserved days). */
  const endOf = (day) => {
    while (cursor < snaps.length && localDay(snaps[cursor].t) <= day) {
      lastSeen = snaps[cursor];
      cursor += 1;
    }
    return lastSeen;
  };
  const lastDay = localDay(snaps[snaps.length - 1].t);
  let prev = endOf(localDay(dayStart(fromDay) - 86400000));
  return keys.map((day) => {
    const cur = endOf(day);
    // Past the newest snapshot the day is unobserved (still running or not
    // queried) — null, never a lying zero.
    const delta = prev === null || cur === null || day > lastDay ? null : prev.total - cur.total;
    const spend = delta === null || delta < -1e-9 ? null : Math.round(delta * 100) / 100;
    const sparse = day <= lastDay && prev !== null && cur !== null
      && (dayStart(day) - prev.t > SNAPSHOT_SPARSE_STALE_MS
        || cur.t - dayStart(day) < SNAPSHOT_SPARSE_STALE_MS);
    prev = cur;
    return { key: day, spend, sparse };
  });
}

/**
 * Slice one projection-backed record's per-day maps to `[fromDay, toDay]`.
 *
 * The record keeps only the in-window days; its `day` anchor is the first
 * in-window activity day (so the client can place the session on the chart),
 * or the creation day when the session was created inside the window without
 * activity yet. Records with nothing in the window fold to null.
 *
 * @param {WindowedRecord} record - the projection-backed record to slice.
 * @param {string} fromDay - inclusive `YYYY-MM-DD`.
 * @param {string} toDay - inclusive `YYYY-MM-DD`.
 * @returns {WindowedRecord|null} the windowed record, or null when nothing lands in the window.
 */
export function sliceRecord(record, fromDay, toDay) {
  const slice = (map) => {
    const out = {};
    for (const [day, value] of Object.entries(map ?? {})) {
      if (day >= fromDay && day <= toDay) out[day] = value;
    }
    return out;
  };
  const byDay = slice(record.byDay);
  const modelsByDay = slice(record.modelsByDay);
  const hoursByDay = slice(record.hoursByDay);
  const tiersByDay = slice(record.tiersByDay);
  const turnsByDay = slice(record.turnsByDay);
  const toolCallsByDay = slice(record.toolCallsByDay);
  // The tool histogram rides only when non-empty (the aux pattern): records
  // folded before it existed, and records with no tool calls at all, stay
  // byte-identical to the pre-histogram shape.
  const toolHistogramByDay = slice(record.toolHistogramByDay);
  const hasHistogram = Object.keys(toolHistogramByDay).length > 0;
  // Aux counters ride only when non-empty: records without auxiliary calls
  // stay byte-identical to the pre-aux shape (older clients, goldens).
  const auxByDay = slice(record.auxByDay);
  const hasAux = Object.keys(auxByDay).length > 0;
  const createdIn = validDay(record.createdDay)
    && record.createdDay >= fromDay && record.createdDay <= toDay;
  const activeDays = [...Object.keys(byDay), ...Object.keys(turnsByDay), ...Object.keys(toolCallsByDay), ...Object.keys(auxByDay)];
  if (!createdIn && activeDays.length === 0) return null;
  const anchor = activeDays.length > 0 ? activeDays.sort()[0] : record.createdDay;
  return {
    id: record.id ?? null,
    createdAt: record.createdAt ?? null,
    project: record.project ?? null,
    subagent: record.subagent === true,
    parentSession: record.parentSession ?? null,
    title: record.title ?? null,
    delegationDepth: Number.isFinite(record.delegationDepth) ? record.delegationDepth : 0,
    day: anchor,
    byDay,
    modelsByDay,
    hoursByDay,
    tiersByDay,
    turnsByDay,
    toolCallsByDay,
    ...(hasHistogram ? { toolHistogramByDay } : {}),
    ...(hasAux ? { auxByDay } : {}),
    // Collaboration attribution rides only when the fold produced it.
    ...(typeof record.label === "string" && record.label !== "" ? { label: record.label } : {}),
    ...(typeof record.timelineTitle === "string" && record.timelineTitle !== "" ? { timelineTitle: record.timelineTitle } : {}),
    ...(record.teamNames !== null && typeof record.teamNames === "object" && Object.keys(record.teamNames).length > 0 ? { teamNames: record.teamNames } : {}),
  };
}

/**
 * Compact event-level timeline of one session's LLM usage, extracted from
 * its raw event log (seconds-accurate timestamps). Each entry is one
 * `assistant/message` whose adapter reported usage; model keys are the same
 * `provider\u0000model` composites the projection folds. `turns` collects
 * closed `turn/start`→`turn/end` boundaries so the client can align break
 * marks to task stages, not just wall-clock time. `aux` collects the
 * session's auxiliary requests (official web_search, title LLM, timeline
 * reports) with the title entries' text-derived input/output estimates, so
 * the detail view can render an honest auxiliary bill without re-reading the
 * log. Timeline report outcomes ride along as `timeline-report` /
 * `timeline-failure` entries — counts only, never priced. Events inside
 * a fork's inherited prefix are skipped, like the projection fold: the
 * detail view shows the session's own consumption, not its parent's.
 *
 * @param {Array<{type?: string, time?: number, data?: any}>} events - a session's raw event log (ascending seq).
 * @param {object} [options]
 * @param {string} [options.id] - session id echoed into the result.
 * @param {{id?: string|null, createdAt?: number|null, cwd?: string|null, origin?: string, parentSession?: string|null, delegationDepth?: number}} [options.header] - the session header (identity fields).
 * @param {number} [options.inheritedEventCount] - the fork cut: events with a lower `seq` are the parent's and stay out.
 * @returns {{id: string|null, header: object, events: Array, turns: Array, aux: Array}}
 *   `events` = `[{t, i, o, cr, cw, key}]` sorted by time; `turns` =
 *   `[{start, end, preview}]` in time order, where `preview` is the turn's
 *   opening user message flattened and capped to 40 code points (null when
 *   the turn carries no user text); `aux` = `[{t, kind, key?, in?, out?}]`
 *   with `kind` one of `search`, `title`, `timeline` (a report request),
 *   `timeline-report` (a summary that landed), `timeline-failure`.
 */
export function timelineEvents(events, { id = null, header = null, inheritedEventCount = 0 } = {}) {
  const out = [];
  const turns = [];
  const aux = [];
  const cut = cutOf(inheritedEventCount);
  let openStart = null;
  let pendingPreview = null;
  let standbyPreview = null;
  for (const event of Array.isArray(events) ? events : []) {
    if (event === null || typeof event !== "object") continue;
    if (isInherited(event, cut)) continue;
    if (event.type === "assistant/message") {
      const t = num(event.time);
      const u = compactUsage(event);
      if (t > 0 && u !== null) out.push({ t, ...u });
    } else if (event.type === "turn/start") {
      const t = num(event.time);
      if (t > 0) {
        openStart = t;
        // A queued user message can land in the log before its turn opens.
        pendingPreview = standbyPreview;
        standbyPreview = null;
      }
    } else if (event.type === "user/message") {
      const text = turnPreviewOf(event.data);
      if (text !== null) {
        if (openStart !== null) {
          if (pendingPreview === null) pendingPreview = text;
        } else {
          standbyPreview = text;
        }
      }
    } else if (event.type === "turn/end" && openStart !== null) {
      const t = num(event.time);
      if (t > 0 && t >= openStart) turns.push({ start: openStart, end: t, preview: pendingPreview });
      openStart = null;
      pendingPreview = null;
    } else if (event.type === "web/deepseek-search-llm-request") {
      const t = num(event.time);
      if (t > 0) aux.push({ t, kind: "search" });
    } else if (event.type === "session/title-llm-request") {
      const t = num(event.time);
      if (t > 0) {
        const route = event.data?.route;
        aux.push({
          t,
          kind: "title",
          key: typeof route?.model === "string" && route.model !== ""
            ? modelKey(typeof route?.provider === "string" ? route.provider : "", route.model)
            : null,
          in: titleInputEstimate(event.data),
          out: titleOutEstimate(event.data?.maxTokens),
        });
      }
    } else if (event.type === "plugin:timeline/request") {
      const t = num(event.time);
      if (t > 0) {
        const request = event.data?.request;
        aux.push({
          t,
          kind: "timeline",
          key: typeof request?.model === "string" && request.model !== ""
            ? modelKey(typeof request?.provider === "string" ? request.provider : "", request.model)
            : null,
        });
      }
    } else if (event.type === "plugin:timeline/report" || event.type === "plugin:timeline/failure") {
      // A report summary's outcome — landed or failed — for the detail
      // line's failure count. Never priced.
      const t = num(event.time);
      if (t > 0) aux.push({ t, kind: event.type === "plugin:timeline/report" ? "timeline-report" : "timeline-failure" });
    }
  }
  out.sort((a, b) => a.t - b.t);
  aux.sort((a, b) => a.t - b.t);
  const headerOut = header === null || typeof header !== "object"
    ? {}
    : {
      id: header.id ?? null,
      createdAt: header.createdAt ?? null,
      cwd: header.cwd ?? null,
      origin: header.origin === "subagent" ? "subagent" : "main",
      parentSession: header.parentSession ?? null,
      delegationDepth: Number.isFinite(header.delegationDepth) ? header.delegationDepth : 0,
    };
  return { id: id ?? headerOut.id ?? null, header: headerOut, events: out, turns, aux };
}

/** The turn preview carried on a timeline turn: the first non-empty text
 *  block of a `user/message`, whitespace-flattened and capped to 40 code
 *  points (CJK-safe; the break analyzer shows it on chips and hover cards).
 *  Returns null when the message carries no usable text. */
function turnPreviewOf(data) {
  const content = data?.content;
  const blocks = Array.isArray(content)
    ? content
    : typeof content === "string" ? [{ type: "text", text: content }] : [];
  for (const block of blocks) {
    if (block === null || typeof block !== "object" || block.type !== "text") continue;
    if (typeof block.text !== "string" || block.text.trim() === "") continue;
    const flat = block.text.replace(/\s+/g, " ").trim();
    if (flat === "") continue;
    return Array.from(flat).slice(0, 40).join("");
  }
  return null;
}

/** One `assistant/message` usage event compacted for the session timeline,
 *  or null when the event has no usable usage. */
function compactUsage(event) {
  const usage = event?.data?.usage;
  if (usage === null || typeof usage !== "object") return null;
  const input = num(usage.inputTokens);
  const output = num(usage.outputTokens);
  const cacheRead = num(usage.cacheReadTokens);
  const cacheWrite = num(usage.cacheWriteTokens);
  if (input + output + cacheRead + cacheWrite <= 0) return null;
  const source = event?.data?.message?.source;
  return { i: input, o: output, cr: cacheRead, cw: cacheWrite, key: modelKey(source?.provider, source?.model) };
}

/**
 * Build the wire payload served by `/pulse/stats` (schema 4).
 *
 * @param {object} options
 * @param {Array<WindowedRecord>} [options.records] - `sliceRecord` outputs for the window.
 * @param {string} [options.fromDay] - window start echoed to the client.
 * @param {string} [options.toDay] - window end echoed to the client.
 * @param {Array<any>} [options.pricing] - pricing rules echoed to the client.
 * @param {number} [options.topProjects] - project-row cap echoed to the client.
 * @param {boolean} [options.costEnabled] - whether the client should show cost estimates.
 * @param {{usdToCny?: number}} [options.fx] - USD→CNY rate for the unified
 *   CNY cost display (invalid values fall back to the built-in default).
 * @param {string[]} [options.monthly] - provider ids billed as a flat monthly
 *   subscription, echoed to the client for zero-cost pricing.
 * @param {number} [options.corpusSessions] - total sessions known to the
 *   corpus, independent of the window. It separates "nothing was ever
 *   recorded" from "nothing landed in this window", which an empty `sessions`
 *   array alone cannot express (and which a freshly booted harness hits
 *   before its first message commits).
 * @param {number} [options.now] - clock override for tests.
 * @param {string} [options.displayCurrency] - personal display currency echoed
 *   to the client (accounting stays CNY; the money exit converts).
 * @returns {{schema: number, generatedAt: number, today: string, fromDay: string, toDay: string,
 *   pricing: Array<any>, monthly: string[], topProjects: number, costEnabled: boolean,
 *   fx: {usdToCny: number}, card: any, cardOrigin: string, displayCurrency: string, corpusSessions: number, sessions: Array<WindowedRecord>,
 *   anomalies?: any, balanceSeries?: Array<any>, modelColors?: any, auxShape?: any}}
 *   the JSON payload (the host may pin the optional overlay fields on top).
 */
export function buildPayload({ records, fromDay, toDay, pricing = [], topProjects = 8, costEnabled = true, fx = {}, monthly = [], corpusSessions, displayCurrency = "CNY", now = Date.now() }) {
  const today = localDay(now);
  const window = resolveWindow(
    { from: validDay(fromDay) ? fromDay : undefined, to: validDay(toDay) ? toDay : undefined },
    30,
    now,
  );
  const sessions = (Array.isArray(records) ? records : []).filter((record) => (
    record !== null && typeof record === "object" && record.day !== undefined
  ));
  const top = Number(topProjects);
  const rate = Number(fx?.usdToCny);
  // An explicit 0 is meaningful ("the corpus is empty"); only an absent or
  // unparsable count falls back to what the window actually carried.
  const corpus = corpusSessions === undefined || corpusSessions === null ? NaN : Number(corpusSessions);
  return {
    schema: 4,
    generatedAt: now,
    today,
    fromDay: window.fromDay,
    toDay: window.toDay,
    pricing: Array.isArray(pricing) ? pricing : [],
    monthly: Array.isArray(monthly) ? monthly : [],
    topProjects: Number.isFinite(top) && top > 0 ? Math.floor(top) : 8,
    costEnabled: costEnabled !== false,
    fx: { usdToCny: Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_USD_TO_CNY },
    card: activeCard().card,
    cardOrigin: activeCard().origin,
    displayCurrency: displayCurrency === "USD" ? "USD" : "CNY",
    corpusSessions: Number.isFinite(corpus) && corpus >= 0 ? Math.floor(corpus) : sessions.length,
    sessions,
  };
}
