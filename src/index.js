import z from "@deepseek-ai/schemastery";
import { credentialKey, credentialRef } from "@deepseek-ai/dsh-credentials";
import { defineDomain } from "@deepseek-ai/dsh-storage-domain";
import { z as zv } from "zod";
import {
  balanceSpendSeries, buildPayload, localDay, normalizePeakHours, projectOf,
  pulseProjectionDefinition, resolveWindow, sliceRecord, timelineEvents, PEAK_HOURS,
} from "./aggregate.js";
import { AUX_SHAPE, DEFAULT_USD_TO_CNY, modelKey, OFFICIAL_PRICE_SCHEDULES, splitModelKey } from "./view.js";

/**
 * dsh-pulse — the usage & cost observatory.
 *
 * Host half: registers the `pulseUsage` session-projection unit (the
 * harness drives it incrementally over every committed event, and persisted
 * sessions are served by the harness cache's read ladder — the zero-I/O
 * stored-row read for unseeded sessions, otherwise a full-log cold fold the
 * 0.1.2-rc cache expects its callers to drive; pre-0.1.2 caches keep their
 * self-reading `coldSnapshot(id)`), then serves `/pulse/stats?from=&to=` as
 * same-origin JSON (plus the settings, session-detail, balance and update-check
 * routes). There is no host command: the `/` menu entry is a client
 * contribution that opens the plugin's own floating seat, so the menu shows one
 * row with a glyph and no second, glyph-less catalog row. Per-request work is
 * O(corpus) lightweight reads — no session log is re-folded on demand beyond
 * what the ladder needs. The day/week/month/project views and cost estimate
 * are folded client-side from the windowed records. Nothing here is
 * model-visible: no prompt surface, no tools, no tokens spent.
 *
 * @module dsh-pulse
 */

/** Cordis plugin name used by loader diagnostics. */
export const name = "pulse";

/**
 * Host services: the projection registry + persisted cache (the fold), the
 * session store (live snapshots), the query corpus (listing), and the web
 * server. In assemblies without the projection registry (a profile without the
 * web bundle) the fiber stays pending.
 */
export const inject = [
  "sessionQuery", "webServer",
  "sessionProjections", "sessionProjectionCache", "sessions",
];

/**
 * Default per-model rates, from the official page:
 *  https://api-docs.deepseek.com/zh-cn/quick_start/pricing/ (checked 2026-09-18).
 *
 * DeepSeek bills by peak/off-peak windows — Beijing time 09:00–12:00 and
 * 14:00–18:00, Monday to Friday only; every other hour (including the whole
 * weekend) is off-peak at half the peak rate. The top-level `input` /
 * `cacheRead` / `output` fields are the off-peak rates; `peak` carries the
 * peak-hour rates (omit it for a flat, time-independent rate); `peakHours`
 * lists the peak hours (Beijing time, defaults to the official windows —
 * override it per rule when a third-party provider bills its own windows).
 * `weekdaysOnly: false` bills a rule's peak hours on every day of the week.
 * Override or extend in your profile patch — unmatched models stay unpriced.
 *
 * The 2026-09 model rename is load-bearing, not cosmetic: `deepseek-v4-flash`
 * and `deepseek-v4-flash-vision-exp` are retired ids that the platform still
 * accepts and serves as DeepSeek-V4.1-Flash at Flash rates, so events folded
 * under those names must price at the Flash tier. {@link LEGACY_MODEL_ALIASES}
 * resolves them to the current rule instead of keeping a duplicate rate row.
 *
 * The rules are the CURRENT schedule of the official price timeline
 * ({@link OFFICIAL_PRICE_SCHEDULES} in the view model); historical windows
 * reprice through earlier schedules at view time.
 */
const OFFICIAL_PRICING = OFFICIAL_PRICE_SCHEDULES[0].rules;

/** Retired model ids the platform still serves, mapped to the current id
 *  whose rule prices them (official page, 2026-09-18). Aliases are specific
 *  to the official channel: a provider-scoped rule always wins, and an
 *  explicit rule for the alias id is honored as written.
 *  @type {Map<string, string>} */
const LEGACY_MODEL_ALIASES = new Map([
  ["deepseek-v4-flash", "deepseek-flash"],
  ["deepseek-v4-flash-vision-exp", "deepseek-flash"],
]);

/** One pricing rule (top-level rates are off-peak; `peak` holds the
 *  peak-hour rates when the model bills by time of day; `peakHours` lists
 *  the peak hours in Beijing time; `provider` scopes the rule to one
 *  provider route — empty prices the model id wherever it appears). */
const pricingRuleSchema = z.object({
  provider: z.string().default("").description("provider route id the rates apply to (empty = any provider, e.g. the official defaults)"),
  model: z.string().description("model id the rates apply to (as reported in usage events)"),
  input: z.number().default(0).description("price per million uncached input tokens in off-peak hours (cache misses and writes)"),
  cacheRead: z.number().description("price per million cache-hit input tokens in off-peak hours (defaults to `input` when omitted)"),
  output: z.number().default(0).description("price per million output tokens in off-peak hours"),
  peak: z.object({
    input: z.number().default(0).description("price per million uncached input tokens in peak hours"),
    cacheRead: z.number().description("price per million cache-hit input tokens in peak hours (defaults to peak `input` when omitted)"),
    output: z.number().default(0).description("price per million output tokens in peak hours"),
  }).description("peak-hour rates; omit for a flat rate"),
  peakHours: z.array(z.number().step(1).min(0).max(23)).description("peak hours in Beijing time (0–23); omit to inherit, or pass [] for flat pricing (defaults to the official 09:00–12:00 and 14:00–18:00 windows)"),
  weekdaysOnly: z.boolean().description("bill the peak hours Monday–Friday only, as the official windows do; omit to inherit, or pass `false` to apply them every day of the week"),
  currency: z.union(["CNY", "USD"]).default("CNY").description("currency the rates are denominated in; USD-priced models convert to CNY through `usdToCny` for the unified display"),
});

/** Schemastery validation with deployment-friendly defaults. Display fields
 *  are `.volatile()`: the harness hands them to `apply` as live references
 *  and commits edits to them in place — no plugin restart, no fold epoch
 *  reset. `pricing` deliberately stays ordinary: its peak-hour half must
 *  re-fold history, and the entry restart an ordinary edit triggers is
 *  exactly that boundary (persisted rows keyed by the pre-restart
 *  `stateVersion` mismatch and replay once). */
export const Config = z.object({
  currency: z.union(["CNY", "USD"]).default("CNY").description("global pricing currency; every effective rule prices in it and USD rates convert to the unified CNY total").volatile(),
  topProjects: z.number().default(8).description("how many project rows to keep in the breakdown").volatile(),
  projectDepth: z.number().default(1).description("path segments kept in a project label (1..3; deeper disambiguates same-named directories)").volatile(),
  defaultDays: z.number().default(30).description("day window served when the client sends no range").volatile(),
  costEnabled: z.boolean().default(true).description("show cost estimates; off hides the cost chip and the /pulse command cost line").volatile(),
  usdToCny: z.number().default(DEFAULT_USD_TO_CNY).description("USD→CNY rate converting USD-priced models into the unified CNY estimate").volatile(),
  monthlyProviders: z.array(z.string()).default([]).description("provider route ids billed as a flat monthly subscription — their models cost 0 marginal and need no per-model rates").volatile(),
  monthlyFee: z.dict(z.number()).default({}).description("provider route id → flat monthly price (CNY/month); the amount shows beside the 月付费 toggle and joins plan comparison as a subscription row").volatile(),
  searchShape: z.dict(z.number()).default({}).description("manual per-search-call token shape, keys miss/hit/out (tokens per call); empty = auto, letting the view self-calibrate the shape against the official balance. Any key here freezes calibration").volatile(),
  quotaOff: z.array(z.string()).default([]).description("provider route ids whose subscription-quota queries are disabled (quota-capable routes are detected automatically)").volatile(),
  modelColors: z.dict(z.string()).default({}).description("per-model accent colors for the model charts, keyed by model id; '' restores the automatic vendor/hue assignment").volatile(),
  pricing: z.array(pricingRuleSchema).default([]).description("per-model rates; empty disables cost estimation"),
});

/** The Config keys marked `.volatile()` — the only fields the harness may
 *  hand over as live references instead of plain values. */
const VOLATILE_KEYS = ["currency", "topProjects", "projectDepth", "defaultDays", "costEnabled", "usdToCny", "monthlyProviders", "monthlyFee", "quotaOff", "modelColors", "searchShape"];

/** Unwrap one live reference (a volatile value implements `.get()`) while
 *  letting plain values through, so one reader serves every host generation. */
const unwrapVolatile = (value) => (value !== null && typeof value === "object" && typeof value.get === "function" ? value.get() : value);

/** A shallow copy of the config with every volatile reference resolved to
 *  its current plain value — the read face of the config, always current. */
function liveConfig(source) {
  const out = { ...source };
  for (const key of VOLATILE_KEYS) if (key in out) out[key] = unwrapVolatile(out[key]);
  return out;
}

/** Wire filter for the per-model accent map: only string ids of bounded
 *  length and `#rgb`/`#rrggbb` colors (or '' = automatic) survive, so a
 *  hand-edited patch can neither inject junk into the client's CSS custom
 *  properties nor grow the map unboundedly. */
const MODEL_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/;
function sanitizeModelColors(value) {
  const out = {};
  if (value === null || typeof value !== "object") return out;
  for (const [id, color] of Object.entries(value)) {
    if (typeof id !== "string" || id === "" || id.length > 120) continue;
    if (typeof color !== "string") continue;
    const trimmed = color.trim().toLowerCase();
    if (trimmed !== "" && MODEL_COLOR_RE.test(trimmed) === false) continue;
    out[id] = trimmed;
  }
  return out;
}

/** Wire filter for the per-provider monthly fee map: only bounded ids with
 *  a positive finite CNY amount survive, so a hand-edited patch can neither
 *  inject junk nor grow the map unboundedly. */
function sanitizeMonthlyFee(value) {
  const out = {};
  if (value === null || typeof value !== "object") return out;
  for (const [id, fee] of Object.entries(value)) {
    if (typeof id !== "string" || id === "" || id.length > 120) continue;
    const n = Number(fee);
    if (!Number.isFinite(n) || n <= 0) continue;
    out[id] = Math.round(n * 100) / 100;
  }
  return out;
}

/** Wire filter for the manual aux shape (`searchShape`): only the three
 *  known keys survive, as sane positive token amounts. An empty object means
 *  "auto" — the view's self-calibration owns the shape. */
function sanitizeSearchShape(value) {
  const out = {};
  if (value === null || typeof value !== "object") return out;
  const bounds = { miss: 5e5, hit: 5e5, out: 1e5 };
  for (const [key, max] of Object.entries(bounds)) {
    if (!(key in value)) continue;
    const n = Number(value[key]);
    if (!Number.isFinite(n) || n <= 0 || n > max) continue;
    out[key] = Math.round(n);
  }
  return out;
}

/** The payload's effective aux shape: the manual keys overlay the built-in
 *  seed; `manual` tells the client whether the self-calibration is frozen. */
function effectiveAuxShape(config) {
  const manual = sanitizeSearchShape(unwrapVolatile(config.searchShape) ?? {});
  const shape = { ...AUX_SHAPE, ...manual };
  return { ...shape, manual: Object.keys(manual).length > 0 };
}

/** POST body → the patch merged into the user section / entry config. A body
 *  that omits a field must not clear it, so only present keys map through
 *  (`monthly` is the wire name of the `monthlyProviders` config field). */
function settingsPatchOf(body) {
  return {
    ...(body.costEnabled !== undefined ? { costEnabled: body.costEnabled } : {}),
    ...(body.usdToCny !== undefined ? { usdToCny: body.usdToCny } : {}),
    ...(body.pricing !== undefined ? { pricing: body.pricing } : {}),
    ...(body.currency !== undefined ? { currency: body.currency } : {}),
    ...(body.monthly !== undefined ? { monthlyProviders: body.monthly } : {}),
    ...(body.monthlyFee !== undefined ? { monthlyFee: sanitizeMonthlyFee(body.monthlyFee) } : {}),
    ...(body.quotaOff !== undefined ? { quotaOff: body.quotaOff.filter((id) => typeof id === "string" && id.length > 0 && id.length <= 120).slice(0, 64) } : {}),
    ...(body.modelColors !== undefined ? { modelColors: sanitizeModelColors(body.modelColors) } : {}),
    ...(body.searchShape !== undefined ? { searchShape: sanitizeSearchShape(body.searchShape) } : {}),
  };
}

/** Resolve the effective pricing rules (config wins, official defaults fill
 *  in; `peakHours` normalized so the editor and the fold see clean lists;
 *  every rule prices in the one global currency — per-rule `currency` values
 *  from older configs are superseded). Rules are keyed by `provider\u0000model`
 *  (bare model id when provider-less), so a provider-scoped rule coexists
 *  with the wildcard default for the same model id.
 *
 *  A config rule whose model id is a retired alias is promoted onto the
 *  current id's wildcard rule, so one row covers the model and its old names
 *  instead of shadowing the official default with a stale rate. Rules
 *  configured under a provider are never aliased.
 *
 *  Tier scope is resolved to concrete values for display, and
 *  {@link effectivePricing.inherited} records whether that resolution came
 *  from the official default rather than from the deployment — a distinction
 *  only the refold predictor needs, because a row that merely restates the
 *  official windows must not be mistaken for a tier-scope change. */
function effectivePricing(config) {
  const rules = new Map();
  const currency = config.currency === "USD" ? "USD" : "CNY";
  for (const rule of OFFICIAL_PRICING) {
    const key = modelKey("", rule.model);
    rules.set(key, {
      ...rule, provider: "",
      peakHours: normalizePeakHours(rule.peakHours ?? PEAK_HOURS),
      weekdaysOnly: rule.weekdaysOnly !== false,
      inherited: true,
      currency,
    });
  }
  for (const rule of Array.isArray(config.pricing) ? config.pricing : []) {
    const model = typeof rule?.model === "string" && rule.model !== "" ? rule.model : null;
    if (model === null) continue;
    const provider = typeof rule?.provider === "string" && rule.provider.length > 0 ? rule.provider : "";
    // Only the official channel's retired ids alias: a provider-scoped rule
    // prices exactly the id it names (a reseller may serve that id itself).
    const canonical = provider === "" ? (LEGACY_MODEL_ALIASES.get(model) ?? model) : model;
    const key = modelKey(provider, canonical);
    const prev = rules.get(key) ?? {};
    // Only a rule that actually SPEAKS to tier scope inherits it from its
    // predecessor row; one that stays silent keeps the official default (and
    // stays tier-neutral however the previous row was scoped).
    const speaksPeak = rule.peakHours !== undefined || typeof rule.weekdaysOnly === "boolean";
    rules.set(key, {
      ...prev, ...rule, provider, model: canonical,
      peakHours: normalizePeakHours(rule.peakHours ?? (prev.inherited === true ? PEAK_HOURS : prev.peakHours) ?? PEAK_HOURS),
      weekdaysOnly: typeof rule.weekdaysOnly === "boolean"
        ? rule.weekdaysOnly
        : (prev.inherited === true || prev.weekdaysOnly === undefined ? true : prev.weekdaysOnly === true),
      inherited: !speaksPeak,
      currency,
    });
  }
  return [...rules.values()].map(({ inherited, ...rule }) => ({ ...rule, currency }));
}

/** Canonical model→tier-spec map of the effective pricing, the fold's input.
 *  Only models whose tier scope is NOT the official default (the official
 *  hours, weekdays only) appear — everything else folds at that default
 *  anyway — so deep-equality over this map decides whether changing settings
 *  requires re-folding history (re-registering the projection unit at a bumped
 *  state version); price-only edits and new flat rules never trigger a replay.
 *  Wildcard (provider-less) rules index the bare model id, and the retired
 *  alias ids are indexed alongside their current id, so events folded under
 *  either name hit the same spec. */
function peakMapOf(config) {
  const map = new Map();
  const currency = config.currency === "USD" ? "USD" : "CNY";
  const rows = new Map();
  for (const rule of OFFICIAL_PRICING) {
    rows.set(modelKey("", rule.model), {
      ...rule, provider: "",
      peakHours: normalizePeakHours(rule.peakHours ?? PEAK_HOURS),
      weekdaysOnly: rule.weekdaysOnly !== false,
      inherited: true,
      currency,
    });
  }
  for (const rule of Array.isArray(config.pricing) ? config.pricing : []) {
    const model = typeof rule?.model === "string" && rule.model !== "" ? rule.model : null;
    if (model === null) continue;
    const provider = typeof rule?.provider === "string" && rule.provider.length > 0 ? rule.provider : "";
    const canonical = provider === "" ? (LEGACY_MODEL_ALIASES.get(model) ?? model) : model;
    const key = modelKey(provider, canonical);
    const prev = rows.get(key) ?? {};
    const speaksPeak = rule.peakHours !== undefined || typeof rule.weekdaysOnly === "boolean";
    rows.set(key, {
      ...prev, ...rule, provider, model: canonical,
      peakHours: normalizePeakHours(rule.peakHours ?? (prev.inherited === true ? PEAK_HOURS : prev.peakHours) ?? PEAK_HOURS),
      weekdaysOnly: typeof rule.weekdaysOnly === "boolean"
        ? rule.weekdaysOnly
        : (prev.inherited === true || prev.weekdaysOnly === undefined ? true : prev.weekdaysOnly === true),
      inherited: !speaksPeak,
      currency,
    });
  }
  /** The official tier scope is the fold's default, so it needs no entry. */
  const isOfficialScope = (rule) => rule.inherited === true
    || (rule.peakHours.join() === PEAK_HOURS.join() && rule.weekdaysOnly === true);
  for (const rule of rows.values()) {
    if (isOfficialScope(rule)) continue;
    const spec = { hours: rule.peakHours, weekdaysOnly: rule.weekdaysOnly === true };
    const provider = rule.provider ?? "";
    map.set(provider === "" ? rule.model : modelKey(provider, rule.model), spec);
    if (provider === "") {
      for (const [alias, canonical] of LEGACY_MODEL_ALIASES) {
        if (canonical === rule.model) map.set(alias, spec);
      }
    }
  }
  return map;
}

/** JSON-stable signature of a peak map (insertion order is deterministic —
 *  effectivePricing iterates official defaults then config rules). */
const peakMapKey = (map) => JSON.stringify([...map.entries()]);

/** Effective USD→CNY rate (invalid values fall back to the built-in default). */
function effectiveUsdToCny(config) {
  const rate = Number(config.usdToCny);
  return Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_USD_TO_CNY;
}

// --- DeepSeek official balance ------------------------------------------------
/** Live balance replies are cached this long (the response only — the API
 *  key is re-resolved through the credentials seam on every actual fetch,
 *  per that seam's per-operation contract). */
const BALANCE_CACHE_MS = 60000;
/** Outbound balance-request budget; a hung provider must not pin a handler. */
const BALANCE_TIMEOUT_MS = 10000;
/** Snapshots older than this roll out of the store; the cap bounds a
 *  snapshot-per-minute pathological write rate. */
const SNAPSHOT_ROLL_MS = 30 * 24 * 3600 * 1000;
const SNAPSHOT_MAX = 1000;
/** Near-identical consecutive readings collapse into one snapshot. */
const SNAPSHOT_DEDUPE_MS = 5 * 60 * 1000;

/** Rolling balance history: money totals only — never the key, the ref, or
 *  any raw provider payload. The reconciliation overlay (官方扣费) reads
 *  this through `/pulse/stats`'s `balanceSeries`. */
const balanceDomainSpec = defineDomain({
  name: "pulse_balance",
  version: 0,
  tables: {},
  global: {
    schema: zv.object({ snapshots: zv.array(zv.object({ t: zv.number().int().min(0), total: zv.number() })).max(SNAPSHOT_MAX) }),
    initial: { snapshots: [] },
  },
});

/**
 * Fold the whole corpus into windowed per-session records.
 *
 * Live sessions read their O(1) watermark-cache snapshot from the projection
 * registry; persisted sessions go through the harness cache's read ladder
 * (below). One unreadable session is skipped, never fatal. Concurrent
 * requests for the same window share one in-flight fold, and a short TTL
 * cache serves recently folded windows again so tab switches and duplicate
 * dashboard mounts stay cheap.
 *
 * @param {object} ctx - plugin context carrying the injected services.
 * @param {() => object} resolveConfig - thunk returning the authoritative
 *   plugin configuration (composition entry, or the `pulse` settings
 *   namespace resolution once the settings service is present).
 * @param {{from?: string, to?: string, days?: number|string}} input - request window.
 * @param {() => Promise<Array<{t,total}|null>} [snapshotsOf] - balance
 *   snapshot accessor; when present the payload carries `balanceSeries`.
 * @returns {Promise<object>} the `/pulse/stats` payload.
 */
const PAYLOAD_TTL_MS = 15000;
const inflight = new Map();
const lastServed = new Map();

/**
 * One session's `pulseUsage` projection values, across both harness cache
 * generations.
 *
 * The 0.1.2-rc projection cache stopped reading the session log itself: its
 * `coldSnapshot(meta, inheritedEventCount, events)` became a synchronous fold
 * over a caller-supplied complete log, and a new zero-I/O
 * `cachedSnapshot(meta, 0, keys)` serves stored rows for unseeded sessions
 * (their checkpoint identity cut is known to be 0; a seeded header-only
 * listing cannot know its cut, so it goes straight to the authoritative body
 * read through `sessionQuery.readSession`, which carries the exact
 * `inheritedEventCount`). Older caches (pre-0.1.2-rc) keep the self-reading
 * async `coldSnapshot(id)`, and 0.1.7-alpha caches drop the explicit cut from
 * `cachedSnapshot(meta, keys)` — lifecycle identity rides the header alone.
 * Both seams are told apart by arity, so one build serves every host. Live
 * sessions read the registry snapshot; a
 * listed-live id that already left the store falls through to the persisted
 * paths instead of folding to an empty record.
 *
 * @param {object} ctx - plugin context carrying the injected services.
 * @param {{live: boolean, header: object}} entry - one `sessionQuery.listSessions` record.
 * @returns {Promise<object|undefined>} the projection values map, or
 *   `undefined` when the session has no readable projection state.
 */
async function projectionValuesOf(ctx, entry) {
  const header = entry.header;
  if (entry.live) {
    const liveSession = ctx.sessions.get(header.id);
    if (liveSession !== undefined) return ctx.sessionProjections.snapshot(liveSession).values;
  }
  const cache = ctx.sessionProjectionCache;
  if (cache === undefined || typeof cache.coldSnapshot !== "function") return undefined;
  if (cache.coldSnapshot.length >= 3) {
    // 0.1.2-rc cache: synchronous fold, caller supplies the log. The fast
    // path only claims a hit when this unit's own key came back — a row
    // stored under an older fold version is filtered out and must refold.
    if (header.isSeeded === false && typeof cache.cachedSnapshot === "function") {
      // The zero-I/O read lost its explicit cut in 0.1.7-alpha:
      // `cachedSnapshot(meta, keys)` (arity 2) matches the stored record by
      // header-borne lifecycle identity, while the 0.1.2-rc signature
      // `cachedSnapshot(meta, cut, keys)` (arity 3) needs the cut spelled
      // out. Feeding the new signature a numeric cut throws inside the
      // registry (`new Set(0)`) and the per-session guard would silently
      // drop every unseeded session from the dashboard — so the call shapes
      // must be told apart here, by arity.
      const cached = cache.cachedSnapshot.length >= 3
        ? cache.cachedSnapshot(header, 0, ["pulseUsage"])
        : cache.cachedSnapshot(header, ["pulseUsage"]);
      if (cached !== undefined && cached.values?.pulseUsage !== undefined) return cached.values;
    }
    const loaded = await ctx.sessionQuery.readSession(header.id);
    return cache.coldSnapshot(loaded.session, loaded.inheritedEventCount, loaded.events).values;
  }
  return (await cache.coldSnapshot(header.id))?.values;
}
/** Cache generation: bumped on every invalidation so a fold that started
 *  before a settings change can never land its (now stale) payload in the
 *  TTL cache after the clear — the race would otherwise serve old prices for
 *  up to one TTL window. */
let serveEpoch = 0;

/** One folded payload that landed after the corpus moved — see
 *  {@link buildStats}. Empty payloads are also never cached: a window with
 *  no activity is what a freshly opened harness reports before its first
 *  message commits, and pinning that for a TTL would show "no sessions" to a
 *  user who plainly has sessions. */
function isCachable(payload) {
  return Array.isArray(payload?.sessions) && payload.sessions.length > 0;
}

async function buildStats(ctx, resolveConfig, input, snapshotsOf) {
  const config = resolveConfig();
  const { fromDay, toDay } = resolveWindow(input, config.defaultDays);
  // The served window is stable under the TTL, but the corpus behind it is
  // not: a session created or written between two reads changes what the same
  // window contains. The corpus count is therefore part of the cache key, so a
  // payload folded before that write can never be served as if it were after.
  // Only the newest count is remembered — the cache is a warm-read shortcut,
  // not a history of windows.
  const base = `${fromDay}:${toDay}`;
  let corpus = (await listCorpus(ctx)).length;
  const fresh = lastServed.get(base);
  if (fresh !== undefined && fresh.corpus === corpus && Date.now() - fresh.at < PAYLOAD_TTL_MS) return fresh.payload;
  const epochAtStart = serveEpoch;
  // The fold runs to completion regardless of requester sockets: an aborted
  // HTTP wait must never truncate the fold, or the TTL cache would serve a
  // partial window (rapid range switching aborted folds mid-loop). A retry
  // shares this still-running flight instead of restarting it.
  const existing = inflight.get(base);
  const flight = existing !== undefined
    ? existing
    : aggregate(ctx, config, fromDay, toDay, snapshotsOf, corpus).finally(() => inflight.delete(base));
  inflight.set(base, flight);
  const payload = await flight;
  // A fold that started before a settings change must never land its now-stale
  // prices in the cache: the epoch guard is what keeps the clear authoritative.
  if (epochAtStart !== serveEpoch) return payload;
  // An empty payload is never cached: a window with no activity is exactly what
  // a freshly opened harness reports before its first message commits, and
  // pinning that for a TTL would show "no sessions" to a user who plainly has
  // sessions.
  if (isCachable(payload)) {
    if (Number.isFinite(payload.corpusSessions)) corpus = payload.corpusSessions;
    lastServed.set(base, { payload, corpus, at: Date.now() });
  } else if (lastServed.get(base)?.payload === payload) {
    lastServed.delete(base);
  }
  return payload;
}

/** Session count of the corpus, through the query service's listing. One
 *  unreadable listing reports zero rather than failing the whole read: the
 *  payload then re-folds on the next request instead of erroring the
 *  dashboard. */
async function listCorpus(ctx) {
  try {
    const sessions = await ctx.sessionQuery.listSessions();
    return Array.isArray(sessions) ? sessions : [];
  } catch {
    return [];
  }
}

async function aggregate(ctx, config, fromDay, toDay, snapshotsOf, corpusSessions) {
  const pricing = effectivePricing(config);
  const sessions = Array.isArray(corpusSessions) ? corpusSessions : await listCorpus(ctx);
  const records = [];
  for (const entry of sessions) {
    try {
      const header = entry.header;
      const values = await projectionValuesOf(ctx, entry);
      const pulse = values === undefined ? undefined : values.pulseUsage;
      const record = sliceRecord({
        id: header.id,
        createdAt: header.createdAt,
        createdDay: localDay(header.createdAt),
        project: projectOf(header.cwd, config.projectDepth),
        subagent: header.origin === "subagent",
        parentSession: header.parentSession ?? null,
        delegationDepth: Number.isFinite(header.delegationDepth) ? header.delegationDepth : 0,
        firstDay: pulse?.firstDay ?? null,
        title: pulse?.title ?? null,
        byDay: pulse?.byDay ?? {},
        modelsByDay: pulse?.modelsByDay ?? {},
        hoursByDay: pulse?.hoursByDay ?? {},
        tiersByDay: pulse?.tiersByDay ?? {},
        turnsByDay: pulse?.turnsByDay ?? {},
        toolCallsByDay: pulse?.toolCallsByDay ?? {},
        auxByDay: pulse?.auxByDay ?? {},
      }, fromDay, toDay);
      if (record !== null) records.push(record);
    } catch {
      // A session that cannot be folded is skipped, never fatal.
    }
  }
  const payload = buildPayload({
    records,
    fromDay,
    toDay,
    pricing,
    topProjects: config.topProjects,
    costEnabled: config.costEnabled !== false,
    fx: { usdToCny: effectiveUsdToCny(config) },
    monthly: Array.isArray(config.monthlyProviders) ? config.monthlyProviders : [],
    corpusSessions: sessions.length,
  });
  // The reconciliation overlay rides along when the storage domain (and
  // therefore snapshot history) is available; otherwise the key stays absent
  // and the client hides the overlay.
  if (typeof snapshotsOf === "function") {
    const snaps = await snapshotsOf();
    if (snaps !== null) payload.balanceSeries = balanceSpendSeries(snaps, fromDay, toDay);
  }
  // Per-model accent overrides ride along like the balance series: display
  // config, not aggregated data, and present on every host (additive field —
  // older clients ignore it, older payloads leave the map empty → all auto).
  payload.modelColors = sanitizeModelColors(unwrapVolatile(config.modelColors) ?? {});
  // The effective aux call shape (manual keys over the built-in seed) — the
  // client's self-calibration starts here and freezes when `manual` is true.
  payload.auxShape = effectiveAuxShape(config);
  return payload;
}

/** Short TTL for the enumerated catalog: the model catalog is configuration,
 *  not hot data, so a brief cache lets rapid tab switching read the editor's
 *  source of truth without re-listing every provider's models each time. */
const CATALOG_CACHE_MS = 3000;
let catalogCache = { at: 0, value: null, llm: null };
/** Drop the catalog cache (e.g. after a settings save). */
function invalidateCatalog() {
  catalogCache = { at: 0, value: null, llm: null };
}

/** Enumerate the harness's current model catalog (the Models settings page)
 *  through the `llm` service: one group per provider route, each with its
 *  configured models. One broken provider is skipped, never fatal; the call
 *  is advisory and touches no network on the bundled adapters. Result is
 *  cached briefly per `llm` reference to keep rapid page-switch reads cheap. */
async function catalogOf(llm) {
  if (llm === null || typeof llm !== "object") return [];
  if (catalogCache.llm === llm && catalogCache.value !== null
    && Date.now() - catalogCache.at < CATALOG_CACHE_MS) {
    return catalogCache.value;
  }
  if (typeof llm.listProviders !== "function" || typeof llm.listModels !== "function") return [];
  const out = [];
  for (const provider of llm.listProviders()) {
    try {
      const models = await llm.listModels(provider.id);
      out.push({
        provider: provider.id,
        displayName: typeof provider.name === "string" && provider.name.length > 0 ? provider.name : provider.id,
        models: models.map((model) => ({ id: model.id, name: model.name ?? model.id })),
      });
    } catch {
      // An unreadable catalog must not break the settings editor.
    }
  }
  catalogCache = { at: Date.now(), value: out, llm };
  return out;
}

/**
 * Register the `pulseUsage` projection unit, the `pulse` settings namespace
 * (user-editable pricing and cost display), the `/pulse` command and the
 * `/pulse` HTTP routes. Every registration is an effect on this fiber, so
 * unloading the plugin removes all of them.
 *
 * The projection unit is registered with the peak-hour map derived from the
 * authoritative config. When a settings edit changes any model's peak hours,
 * the unit is re-registered at a bumped `stateVersion` — persisted cache
 * rows stop matching, so every session re-folds from its log on the next
 * read and history reprices correctly. Price-only edits (rates, currency,
 * fx, costEnabled) never touch the fold and never trigger a replay.
 * @param {object} ctx - plugin context carrying the injected services.
 * @param {object} config - deployment configuration (the settings namespace's composition `base` layer).
 */
export function apply(ctx, config) {
  /** Fold-semantics epoch: 0 at load, +1 per peak-hour change. The persisted
   *  rows of every older epoch are invalid by construction. */
  let epoch = 0;
  let peakMap = peakMapOf(config);
  /** Tier scope for a composite fold key (`provider\u0000model`), falling back
   *  to a provider-less (wildcard) rule's spec and then the official default
   *  (the official hours, weekdays only). */
  const OFFICIAL_TIER = { hours: PEAK_HOURS, weekdaysOnly: true };
  const peakHoursFor = (model) => peakMap.get(model) ?? peakMap.get(splitModelKey(model).model) ?? OFFICIAL_TIER;
  let disposeProjection = ctx.sessionProjections.register(
    pulseProjectionDefinition({ peakHoursFor, stateVersion: 10 + epoch }),
  );
  ctx.effect(() => () => disposeProjection(), "dsh-pulse: projection fallback");
  /** After a re-register every session must re-fold (persisted rows no
   *  longer match). Do it in the background so the user's next dashboard
   *  refresh reads warm caches instead of paying the whole replay itself;
   *  one failing session never stops the sweep, and the lazy path remains
   *  the correctness backstop either way. */
  let warming = false;
  const warmUpRefolds = async () => {
    if (warming) return;
    warming = true;
    try {
      const entries = await ctx.sessionQuery.listSessions();
      for (const entry of entries) {
        try {
          await projectionValuesOf(ctx, entry);
        } catch {
          // one unreadable session: skip, the lazy path still covers it
        }
      }
    } catch {
      // listing failed: nothing to warm, lazy re-folds still happen on read
    } finally {
      warming = false;
    }
  };
  const reRegisterProjection = () => {
    epoch += 1;
    disposeProjection();
    disposeProjection = ctx.sessionProjections.register(
      pulseProjectionDefinition({ peakHoursFor, stateVersion: 10 + epoch }),
    );
    void warmUpRefolds();
  };

  /** Track the `llm` service when present, for the settings editor's model
   *  catalog; absent services (profiles without an llm bundle) leave the
   *  editor on its usage-and-manual fallback rows. */
  let llmService = null;
  /** Live view of every active entry's config (0.1.7+ describe rows), the
   *  quota credential resolver's source for per-route `apiKeyEnv` overrides.
   *  Null on classic hosts, whose provider cannot enumerate namespaces. */
  let llmDescribe = null;
  if (typeof ctx.inject === "function") {
    ctx.inject(["llm"], (lctx) => {
      llmService = lctx.llm ?? null;
      lctx.effect(() => () => { llmService = null; }, "dsh-pulse: llm fallback");
    });
  }

  // Authoritative config. Serve-time fields stay live: `liveConfig` resolves
  // the volatile references the harness hands `apply`, so display edits take
  // effect without touching this fiber. Persistent writes ride the settings
  // seam — classic hosts register a per-plugin namespace with the
  // SettingsProvider; 0.1.7+ hosts write this entry's config through the
  // schema-driven SettingsForms under revision checks.
  let resolveConfig = () => liveConfig(config);
  let settingsSeam = null;
  let settingsProvider = null;
  const invalidatePayload = () => { lastServed.clear(); serveEpoch += 1; };
  // The module-level TTL cache outlives a loader restart (only the fiber is
  // recycled), so every (re)application starts from a clean payload slate.
  invalidatePayload();
  const onSettingsChanged = () => {
    invalidatePayload();
    const next = peakMapOf(resolveConfig());
    if (peakMapKey(next) !== peakMapKey(peakMap)) {
      peakMap = next;
      reRegisterProjection();
    }
  };
  if (typeof ctx.inject === "function") {
    ctx.inject(["settings"], (sctx) => {
      const forms = sctx.settings;
      if (forms !== null && typeof forms === "object" && typeof forms.describe === "function" && typeof forms.update === "function") {
        // 0.1.7+ SettingsForms generation. The entry row is located by Config
        // identity (the loader exposes the very schema object this module
        // exports) with the patch id as a fallback; describe() carries the
        // live revision that turns every editor save into an
        // optimistic-concurrency write against the active profile patch.
        let entryNs = null;
        const findRow = () => {
          const row = forms.describe().find((candidate) => candidate.schema === Config || candidate.ns === "pulse");
          if (row !== undefined) entryNs = row.ns;
          return row ?? null;
        };
        settingsSeam = {
          writable: () => forms.writable === true,
          revision: () => findRow()?.revision,
          write: (body) => {
            const row = findRow();
            if (row === null) return Promise.reject(new Error("the pulse entry is not active in this profile"));
            return body.reset === true
              ? forms.replace(row.ns, {}, body.revision)
              : forms.update(row.ns, settingsPatchOf(body), body.revision);
          },
        };
        // Bridge the connection facts the classic path read through the
        // provider (`settingsProvider.get("llm-deepseek")`): describe() shows
        // every active entry's live config, redacted.
        settingsProvider = { get: (ns) => forms.describe().find((row) => row.ns === ns)?.value };
        llmDescribe = () => {
          try { return forms.describe(); } catch { return []; }
        };
        // The forms service emits one event for any entry's revision change —
        // our own writes and the host settings page's land here. Peak-hour
        // changes normally arrive through the entry restart instead, so this
        // feed mostly invalidates the payload TTL early; the peak comparison
        // stays as a same-generation belt for hosts that hot-swap configs.
        if (typeof sctx.on === "function") {
          const disposeFeed = sctx.on("settings/document-updated", (ns) => {
            if (entryNs === null || ns === entryNs) onSettingsChanged();
          });
          sctx.effect(() => () => {
            llmDescribe = null;
            if (typeof disposeFeed === "function") disposeFeed();
          }, "dsh-pulse: settings feed");
        }
        return;
      }
      if (typeof forms?.register !== "function") return;
      // Classic SettingsProvider generation: a per-plugin namespace whose
      // user layer the provider persists (settings.yaml).
      const scope = forms.register("pulse", Config, { base: config });
      settingsProvider = forms;
      settingsSeam = {
        writable: () => settingsProvider?.writable === true,
        revision: () => undefined,
        write: (body) => body.reset === true
          ? Promise.resolve(scope.replace({}))
          : Promise.resolve(scope.update(settingsPatchOf(body))),
      };
      resolveConfig = () => liveConfig(scope.get());
      sctx.effect(() => () => {
        settingsProvider = null;
        settingsSeam = null;
        resolveConfig = () => liveConfig(config);
        invalidatePayload();
        // The user layer is gone; re-derive the fold from the composition base.
        onSettingsChanged();
      }, "dsh-pulse: settings fallback");
      scope.watch(onSettingsChanged);
      // The user layer may already differ from the composition base at mount.
      onSettingsChanged();
    });
  }

  // --- DeepSeek official balance ---------------------------------------------
  // Security posture: the key is resolved per operation through the
  // credentials seam (the same DEEPSEEK_API_KEY the web Models page writes)
  // and lives only in one outbound Authorization header — never in a
  // response, a log line, an error message, or the store. Only parsed money
  // totals persist, as rolling snapshots in a storage-domain global.
  let balanceDomain = null;
  let balanceOpening = null;
  const openBalanceDomain = () => {
    if (balanceDomain !== null) return Promise.resolve(balanceDomain);
    if (balanceOpening !== null) return balanceOpening;
    const facility = typeof ctx.get === "function" ? ctx.get("storageDomain") : null;
    if (facility === null || typeof facility?.open !== "function") return Promise.resolve(null);
    balanceOpening = facility.open(balanceDomainSpec).then((domain) => {
      balanceDomain = domain;
      ctx.effect(() => async () => {
        balanceDomain = null;
        try { await domain.close(); } catch { /* closing twice is harmless */ }
      }, "dsh-pulse: balance domain");
      return domain;
    }).catch(() => null).finally(() => { balanceOpening = null; });
    return balanceOpening;
  };
  const snapshotsOf = async () => {
    const domain = await openBalanceDomain();
    if (domain === null) return null;
    try {
      const snaps = domain.global.get()?.snapshots;
      return Array.isArray(snaps) ? snaps : null;
    } catch {
      return null;
    }
  };
  /** The official adapter's connection facts: its settings namespace's
   *  `apiKeyEnv` / `baseURL` overrides, or the public defaults. */
  const deepseekConnection = () => {
    let section = null;
    try {
      const raw = settingsProvider !== null ? settingsProvider.get("llm-deepseek") : undefined;
      if (raw !== null && typeof raw === "object") section = raw;
    } catch {
      // An unreadable section falls back to the public defaults.
    }
    const apiKeyEnv = typeof section?.apiKeyEnv === "string" && section.apiKeyEnv.length > 0
      ? section.apiKeyEnv : "DEEPSEEK_API_KEY";
    let base = "https://api.deepseek.com";
    if (typeof section?.baseURL === "string" && section.baseURL.length > 0) {
      try {
        const url = new URL(section.baseURL);
        if (url.protocol === "https:" || url.protocol === "http:") base = url.toString();
      } catch {
        // A malformed override keeps the official endpoint.
      }
    }
    return { apiKeyEnv, balanceUrl: `${base.replace(/\/+$/, "")}/user/balance` };
  };
  const recordSnapshot = async (result) => {
    // The overlay diffs CNY totals; other currencies stay out of the store.
    if (result.currency !== "CNY") return;
    const domain = await openBalanceDomain();
    if (domain === null) return;
    try {
      const current = domain.global.get();
      const snaps = Array.isArray(current?.snapshots) ? current.snapshots.slice() : [];
      const last = snaps[snaps.length - 1];
      if (last !== undefined && result.fetchedAt - last.t < SNAPSHOT_DEDUPE_MS && last.total === result.total) return;
      snaps.push({ t: result.fetchedAt, total: result.total });
      const cutoff = result.fetchedAt - SNAPSHOT_ROLL_MS;
      await domain.global.set({ snapshots: snaps.filter((s) => s.t >= cutoff).slice(-SNAPSHOT_MAX) });
    } catch {
      // A failed snapshot write never breaks the balance reply.
    }
  };
  const fetchBalance = async () => {
    const credentials = typeof ctx.get === "function" ? ctx.get("credentials") : null;
    if (credentials === null || typeof credentials?.resolve !== "function") return { configured: false };
    const { apiKeyEnv, balanceUrl } = deepseekConnection();
    let key = "";
    try {
      const hit = await credentials.resolve(credentialRef(apiKeyEnv));
      key = typeof hit?.value === "string" ? hit.value.trim() : "";
    } catch {
      key = "";
    }
    if (key === "") return { configured: false, ref: apiKeyEnv };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BALANCE_TIMEOUT_MS);
    try {
      const response = await fetch(balanceUrl, {
        headers: { authorization: `Bearer ${key}` },
        redirect: "error",
        signal: controller.signal,
      });
      if (response.ok !== true) return { configured: true, ok: false, error: `HTTP ${response.status}` };
      const body = await response.json();
      const infos = Array.isArray(body?.balance_infos) ? body.balance_infos : [];
      const info = infos.find((entry) => entry?.currency === "CNY") ?? infos[0];
      const total = Number(info?.total_balance);
      if (info === undefined || Number.isFinite(total) !== true) {
        return { configured: true, ok: false, error: "unparsable balance payload" };
      }
      const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
      const result = {
        configured: true,
        ok: true,
        isAvailable: body?.is_available === true,
        currency: typeof info.currency === "string" ? info.currency : "CNY",
        total,
        granted: num(info.granted_balance),
        topped: num(info.topped_up_balance),
        fetchedAt: Date.now(),
      };
      await recordSnapshot(result);
      return result;
    } catch (error) {
      // Cause codes and error names only — they carry no URL and no key.
      return { configured: true, ok: false, error: String(error?.cause?.code ?? error?.name ?? "request failed") };
    } finally {
      clearTimeout(timer);
    }
  };
  const balanceCache = { at: 0, result: null };
  const serveBalance = async (req, res, url) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      json(res, 405, { error: "method not allowed" });
      return;
    }
    const refresh = url.searchParams.get("refresh") === "1";
    if (!refresh && balanceCache.result !== null && Date.now() - balanceCache.at < BALANCE_CACHE_MS) {
      json(res, 200, { ...balanceCache.result, cached: true });
      return;
    }
    const result = await fetchBalance();
    if (result.ok === true) {
      balanceCache.at = Date.now();
      balanceCache.result = result;
    }
    json(res, 200, result);
  };

  // --- Subscription quota -----------------------------------------------------
  // The same posture as the official balance, one provider up: credentials are
  // resolved per operation through the credential seam (the env refs the Models
  // page writes, the stored record it writes for OAuth routes, or the
  // adapter's well-known env names), and live only in one outbound
  // Authorization header. Only parsed utilization numbers persist — as
  // `{t, provider, window, pct}` points in a rolling storage-domain global,
  // the burn-rate series the client forecasts from. A route queries only when
  // a built-in adapter claims it (and the user has not switched it off via
  // `quotaOff`); every fetch is user-triggered or a 60-second-cadence poll —
  // never a timer of its own.

  const QUOTA_TIMEOUT_MS = 10000;
  const QUOTA_CACHE_MS = 60000;
  const QUOTA_SNAPSHOT_ROLL_MS = 30 * 24 * 3600 * 1000;
  const QUOTA_SNAPSHOT_MAX = 2000;
  const QUOTA_SNAPSHOT_DEDUPE_MS = 5 * 60 * 1000;

  /** Rolling per-window utilization history: percentages and nothing else —
   *  never the key, the ref, or any raw provider payload. The client reads
   *  this through `/pulse/quota`'s `series` to draw burn slopes and
   *  exhaustion forecasts. */
  const quotaDomainSpec = defineDomain({
    name: "pulse_quota",
    version: 0,
    tables: {},
    global: {
      schema: zv.object({
        snapshots: zv.array(zv.object({
          t: zv.number().int().min(0),
          provider: zv.string().min(1).max(120),
          window: zv.string().min(1).max(40),
          pct: zv.number().min(0).max(100),
        })).max(QUOTA_SNAPSHOT_MAX),
      }),
      initial: { snapshots: [] },
    },
  });

  let quotaDomain = null;
  let quotaOpening = null;
  const openQuotaDomain = () => {
    if (quotaDomain !== null) return Promise.resolve(quotaDomain);
    if (quotaOpening !== null) return quotaOpening;
    const facility = typeof ctx.get === "function" ? ctx.get("storageDomain") : null;
    if (facility === null || typeof facility?.open !== "function") return Promise.resolve(null);
    quotaOpening = facility.open(quotaDomainSpec).then((domain) => {
      quotaDomain = domain;
      ctx.effect(() => async () => {
        quotaDomain = null;
        try { await domain.close(); } catch { /* closing twice is harmless */ }
      }, "dsh-pulse: quota domain");
      return domain;
    }).catch(() => null).finally(() => { quotaOpening = null; });
    return quotaOpening;
  };

  /** One defensive number: finite → number, anything else → null. */
  const qnum = (value) => {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : null;
  };
  const qclampPct = (value) => {
    const n = qnum(value);
    return n === null ? null : Math.max(0, Math.min(100, n));
  };
  /** Provider reset timestamps come in epoch ms, epoch s, or ISO strings with
   *  over-long fractional seconds; normalize all three to epoch ms. */
  const qtime = (value) => {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return value >= 1e12 ? Math.round(value) : Math.round(value * 1000);
    if (typeof value === "string" && value !== "") {
      const normalized = value.replace(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3})\d+/, "$1");
      const parsed = Date.parse(normalized);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  };
  const qstr = (value) => (typeof value === "string" && value.length > 0 ? value : null);

  /** (unit, number) → window id/span for z.ai's limit encoding. Observed
   *  pairs: (3,5) = 5-hour session window, (6,1) = weekly on the CN console,
   *  (6,7) = weekly internationally, (5,1) = monthly tool quota. */
  const zaiWindowSpec = (unit, number) => {
    if (unit === 3) return { id: number === 5 ? "5h" : `h${number}`, windowMs: number > 0 ? number * 3600000 : null };
    if (unit === 6) return { id: "7d", windowMs: 7 * 86400000 };
    if (unit === 5) return { id: "month", windowMs: 30 * 86400000 };
    return { id: unit !== null && number !== null ? `u${unit}n${number}` : "window", windowMs: null };
  };

  /** Sort key: shorter (more immediate) windows first; unknown spans last. */
  const windowOrder = (a, b) => (a.windowMs ?? Infinity) - (b.windowMs ?? Infinity);

  /** z.ai / bigmodel coding plan: `GET /api/monitor/usage/quota/limit` for the
   *  window utilization (token windows report a percentage only — the CN
   *  console hides absolute counts) plus `GET /api/biz/subscription/list` for
   *  the plan name and fee. Verified live against open.bigmodel.cn (Bearer
   *  auth) and documented for api.z.ai by openusage/CodexBar. */
  const zaiFetch = async ({ host, key }) => {
    const headers = { authorization: `Bearer ${key}`, accept: "application/json" };
    const [quotaRes, subRes] = await Promise.all([
      fetchJson(`${host}/api/monitor/usage/quota/limit`, headers),
      fetchJson(`${host}/api/biz/subscription/list`, headers).catch(() => null),
    ]);
    const data = quotaRes?.data;
    const limits = Array.isArray(data?.limits) ? data.limits : [];
    const windows = [];
    const extras = [];
    for (const limit of limits) {
      if (limit === null || typeof limit !== "object") continue;
      const resetsAt = qtime(limit.nextResetTime);
      if (limit.type === "TOKENS_LIMIT") {
        const spec = zaiWindowSpec(qnum(limit.unit), qnum(limit.number));
        if (windows.some((w) => w.id === spec.id)) continue;
        windows.push({ id: spec.id, kind: "tokens", usedPct: qclampPct(limit.percentage), resetsAt, windowMs: spec.windowMs, used: null, total: null });
      } else if (limit.type === "TIME_LIMIT") {
        const total = qnum(limit.usage);
        const used = qnum(limit.currentValue);
        const pct = qclampPct(limit.percentage) ?? (total !== null && total > 0 && used !== null ? qclampPct((used / total) * 100) : null);
        extras.push({ id: "tools", label: null, used, total, usedPct: pct, resetsAt });
      }
    }
    windows.sort(windowOrder);
    let plan = null;
    let fee = null;
    const subs = Array.isArray(subRes?.data) ? subRes.data : [];
    const active = subs.find((entry) => entry?.status === "VALID" && typeof entry?.productName === "string") ?? null;
    if (active !== null) {
      plan = {
        name: active.productName,
        level: qstr(data?.level),
        cycle: qstr(active.billingCycle),
        renewsAt: qstr(active.nextRenewTime),
      };
      const price = qnum(active.actualPrice) ?? qnum(active.initialPrice);
      if (price !== null && typeof active.billingCycle === "string") {
        fee = { amount: price, currency: "CNY", cycle: active.billingCycle };
      }
    }
    return { plan, fee, windows, extras };
  };

  /** Kimi For Coding: `GET /coding/v1/usages`. The rendering norm every
   *  adapter follows: a window carries used/total counts ONLY when the
   *  provider states a true absolute quota — a ratio-only source renders a
   *  percentage track and never a fabricated "x/100 次" count. Kimi's
   *  windows are ratios (`used_ratio`), so they ride pct-only, 5h and 7d
   *  alike. The legacy flat `usage` object keeps ratio precedence.
   *  Verified live against api.kimi.com. */
  const kimiFetch = async ({ host, key }) => {
    const body = await fetchJson(`${host}/coding/v1/usages`, { authorization: `Bearer ${key}`, accept: "application/json" });
    const windows = [];
    const ratioWindow = (id, windowMs, limit) => {
      if (limit === null || typeof limit !== "object") return;
      const usedPct = qclampPct(Number(limit.used_ratio) * 100);
      if (usedPct === null) return;
      windows.push({ id, kind: "requests", used: null, total: null, usedPct, resetsAt: qtime(limit.reset_time), windowMs });
    };
    const usage = body?.usage;
    if (usage !== null && typeof usage === "object") {
      const used = qnum(usage.used);
      const total = qnum(usage.limit);
      const usedPct = qclampPct(used !== null && total !== null && total > 0 ? (used / total) * 100 : null);
      if (usedPct !== null) {
        windows.push({ id: "7d", kind: "requests", used: null, total: null, usedPct, resetsAt: qtime(usage.resetTime), windowMs: 7 * 86400000 });
      }
    }
    const ratios = body?.usages;
    if (ratios !== null && typeof ratios === "object") {
      if (windows.some((w) => w.id === "5h") === false) ratioWindow("5h", 5 * 3600000, ratios.limit_5h);
      if (windows.some((w) => w.id === "7d") === false) ratioWindow("7d", 7 * 86400000, ratios.limit_7d);
    }
    windows.sort(windowOrder);
    const level = qstr(body?.user?.membership?.level);
    return { plan: { name: "Kimi For Coding", level, cycle: null, renewsAt: null }, fee: null, windows, extras: [] };
  };

  /** MiniMax coding/token plan: `GET /v1/token_plan/remains`. Community-
   *  documented (MiniMax-M2 issue #99): `current_interval_usage_count` and
   *  `current_weekly_usage_count` hold REMAINING counts, not used — prefer
   *  the explicit `*_remaining_percent` fields when present. Not yet live-
   *  verified; a schema drift surfaces as an unparsable reply, never as
   *  fabricated numbers. */
  const minimaxFetch = async ({ host, key }) => {
    const body = await fetchJson(`${host}/v1/token_plan/remains`, { authorization: `Bearer ${key}`, accept: "application/json" });
    if (body?.base_resp !== undefined && body?.base_resp !== null && qnum(body.base_resp.status_code) !== 0) {
      throw new Error(`minimax status ${String(body.base_resp.status_code ?? "?")}`);
    }
    const rows = Array.isArray(body?.model_remains) ? body.model_remains : [];
    const remainingPct = (total, remaining) => (total !== null && total > 0 && remaining !== null ? qclampPct(100 - (remaining / total) * 100) : null);
    const fold = (id, windowMs, pick) => {
      let usedPct = null;
      let resetsAt = null;
      let used = null;
      let total = null;
      for (const row of rows) {
        if (row === null || typeof row !== "object") continue;
        const rowTotal = qnum(pick(row).total);
        const rowRemaining = qnum(pick(row).remaining);
        const rowPct = qclampPct(pick(row).remainingPercent) ?? remainingPct(rowTotal, rowRemaining);
        if (rowPct === null) continue;
        usedPct = usedPct === null ? rowPct : Math.max(usedPct, rowPct);
        total = total ?? rowTotal;
        used = used ?? (rowTotal !== null && rowRemaining !== null ? Math.max(0, rowTotal - rowRemaining) : null);
        resetsAt = resetsAt ?? qtime(pick(row).end) ?? qtime(pick(row).remains);
      }
      if (usedPct !== null) windows.push({ id, kind: "requests", used, total, usedPct, resetsAt, windowMs });
    };
    const windows = [];
    fold("5h", 5 * 3600000, (row) => ({ total: row.current_interval_total_count, remaining: row.current_interval_usage_count, remainingPercent: row.current_interval_remaining_percent, end: row.end_time, remains: row.remains_time }));
    fold("7d", 7 * 86400000, (row) => ({ total: row.current_weekly_total_count, remaining: row.current_weekly_usage_count, remainingPercent: row.current_weekly_remaining_percent, end: row.weekly_end_time, remains: row.remains_time }));
    windows.sort(windowOrder);
    return { plan: { name: "MiniMax Coding Plan", level: null, cycle: null, renewsAt: null }, fee: null, windows, extras: [] };
  };

  /** One JSON GET with the shared outbound posture: bounded, redirect-free,
   *  and failures mapped to cause codes only (no URLs, no keys). */
  const fetchJson = async (url, headers) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), QUOTA_TIMEOUT_MS);
    try {
      const response = await fetch(url, { headers, redirect: "error", signal: controller.signal });
      if (response.ok !== true) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      throw new Error(String(error?.cause?.code ?? error?.message ?? error?.name ?? "request failed"));
    } finally {
      clearTimeout(timer);
    }
  };

  /** Built-in subscription adapters. A route qualifies by provider id (the
   *  Models page's route key); `label` is the display face every provider
   *  entry echoes (the plan name supersedes it once a query succeeded);
   *  `envKeys` are the well-known ambient names tried after the deployment's
   *  own refs. The general quota norm: counts come only from true absolute
   *  quotas — ratio-only sources emit `usedPct` with `used: null, total:
   *  null`, and the renderer never invents a count from a ratio. */
  const QUOTA_ADAPTERS = [
    { id: "zai-coding", label: "GLM Coding Plan", routes: ["zai-coding-cn", "zai-coding", "zai"], envKeys: ["ZAI_CODING_CN_API_KEY", "GLM_CODING_CN_API_KEY", "ZAI_API_KEY", "GLM_API_KEY"], hostFor: (route) => (route === "zai-coding-cn" ? "https://open.bigmodel.cn" : "https://api.z.ai"), fetch: zaiFetch },
    { id: "kimi-coding", label: "Kimi For Coding", routes: ["kimi-coding", "kimi"], envKeys: ["KIMI_CODING_API_KEY", "KIMI_API_KEY"], hostFor: () => "https://api.kimi.com", fetch: kimiFetch },
    { id: "minimax", label: "MiniMax Coding Plan", routes: ["minimax", "minimax-coding", "minimax-cn"], envKeys: ["MINIMAX_API_KEY", "MINIMAX_CODING_API_KEY"], hostFor: () => "https://api.minimaxi.com", fetch: minimaxFetch },
  ];

  /** Credential facts for one route, resolved per operation: ① the llm
   *  settings' per-route `apiKeyEnv` ref, ② the stored credential record the
   *  Models page writes (`llm-pi-ai/<route>`: an api-key record or an OAuth
   *  grant whose access token authenticates subscription endpoints too),
   *  ③ the adapter's well-known env names. Null when nothing resolves. */
  const quotaCredentialFor = async (adapter, route) => {
    const credentials = typeof ctx.get === "function" ? ctx.get("credentials") : null;
    if (credentials === null || typeof credentials?.resolve !== "function") return null;
    const resolveRef = async (name) => {
      try {
        const hit = await credentials.resolve(credentialRef(name));
        const value = typeof hit?.value === "string" ? hit.value.trim() : "";
        return value !== "" ? value : null;
      } catch {
        return null;
      }
    };
    const fromSetting = llmDescribe()?.find((row) => row?.value !== null && typeof row?.value === "object")?.value?.providers?.[route]?.apiKeyEnv;
    if (typeof fromSetting === "string" && fromSetting.length > 0) {
      const value = await resolveRef(fromSetting);
      if (value !== null) return { value, source: fromSetting };
    }
    if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(route) && typeof credentials.readRecord === "function") {
      try {
        const record = await credentials.readRecord(credentialKey("llm-pi-ai", route));
        if (record?.kind === "api-key") {
          if (typeof record.key === "string" && record.key.length > 0) return { value: record.key, source: "record" };
          if (typeof record.env === "string" && record.env.length > 0) {
            const value = await resolveRef(record.env);
            if (value !== null) return { value, source: record.env };
          }
        } else if (record?.kind === "grant" && record.payload !== null && typeof record.payload === "object") {
          const access = record.payload.access;
          if (typeof access === "string" && access.length > 0) return { value: access, source: "oauth" };
        }
      } catch {
        // An unreadable record falls through to the ambient names.
      }
    }
    for (const envName of adapter.envKeys) {
      const value = await resolveRef(envName);
      if (value !== null) return { value, source: envName };
    }
    return null;
  };

  /** Persist one query's window percentages (extras excluded — the burn
   *  series tracks plan windows only). Near-identical consecutive readings
   *  of the same window collapse; the store rolls on 30 days and a hard cap. */
  const recordQuotaSnapshots = async (route, result) => {
    const domain = await openQuotaDomain();
    if (domain === null) return;
    const now = Date.now();
    try {
      const current = domain.global.get();
      const snaps = Array.isArray(current?.snapshots) ? current.snapshots.slice() : [];
      for (const window of Array.isArray(result.windows) ? result.windows : []) {
        const pct = qclampPct(window.usedPct);
        const id = qstr(window.id);
        if (pct === null || id === null) continue;
        const lastIdx = snaps.findLastIndex((s) => s.provider === route && s.window === id);
        const last = lastIdx === -1 ? undefined : snaps[lastIdx];
        if (last !== undefined && now - last.t < QUOTA_SNAPSHOT_DEDUPE_MS && Math.abs(last.pct - pct) < 0.5) continue;
        snaps.push({ t: now, provider: route, window: id, pct });
      }
      if (snaps.length === (Array.isArray(current?.snapshots) ? current.snapshots.length : 0)) return;
      const cutoff = now - QUOTA_SNAPSHOT_ROLL_MS;
      await domain.global.set({ snapshots: snaps.filter((s) => s.t >= cutoff).slice(-QUOTA_SNAPSHOT_MAX) });
    } catch {
      // A failed snapshot write never breaks the quota reply.
    }
  };

  /** The stored utilization series, rolled to the window the client needs. */
  const quotaSeriesOf = async () => {
    const domain = await openQuotaDomain();
    if (domain === null) return [];
    try {
      const snaps = domain.global.get()?.snapshots;
      if (!Array.isArray(snaps)) return [];
      const cutoff = Date.now() - QUOTA_SNAPSHOT_ROLL_MS;
      return snaps.filter((s) => s.t >= cutoff);
    } catch {
      return [];
    }
  };

  const quotaCache = { at: 0, result: null };
  const serveQuota = async (req, res, url) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      json(res, 405, { error: "method not allowed" });
      return;
    }
    const refresh = url.searchParams.get("refresh") === "1";
    if (!refresh && quotaCache.result !== null && Date.now() - quotaCache.at < QUOTA_CACHE_MS) {
      json(res, 200, { ...quotaCache.result, cached: true });
      return;
    }
    const off = new Set(Array.isArray(resolveConfig().quotaOff) ? resolveConfig().quotaOff : []);
    const providers = [];
    const targets = [];
    if (llmService !== null && typeof llmService.listProviders === "function") {
      for (const provider of llmService.listProviders()) {
        const route = typeof provider?.id === "string" ? provider.id : "";
        if (route === "") continue;
        const adapter = QUOTA_ADAPTERS.find((candidate) => candidate.routes.includes(route));
        if (adapter === undefined) continue;
        const displayName = typeof provider.name === "string" && provider.name !== "" ? provider.name : route;
        if (off.has(route)) {
          // Switched-off routes still report themselves (never fetched), so
          // the settings page can offer to switch them back on.
          providers.push({ provider: route, adapter: adapter.id, label: adapter.label, displayName, ok: false, configured: true, disabled: true, error: "disabled in settings" });
          continue;
        }
        targets.push({ adapter, route, displayName });
      }
    }
    providers.push(...await Promise.all(targets.map(async ({ adapter, route, displayName }) => {
      const credential = await quotaCredentialFor(adapter, route);
      if (credential === null) {
        return { provider: route, adapter: adapter.id, label: adapter.label, displayName, ok: false, configured: false, error: "no credential resolved" };
      }
      try {
        const result = await adapter.fetch({ route, key: credential.value, host: adapter.hostFor(route) });
        await recordQuotaSnapshots(route, result);
        return {
          provider: route, adapter: adapter.id, label: adapter.label, displayName,
          ok: true, configured: true, credentialSource: credential.source,
          plan: result.plan ?? null, fee: result.fee ?? null,
          windows: Array.isArray(result.windows) ? result.windows : [],
          extras: Array.isArray(result.extras) ? result.extras : [],
          fetchedAt: Date.now(),
        };
      } catch (error) {
        return { provider: route, adapter: adapter.id, label: adapter.label, displayName, ok: false, configured: true, error: String(error?.message ?? "request failed") };
      }
    })));
    const series = await quotaSeriesOf();
    const result = { schema: 1, generatedAt: Date.now(), providers, series };
    // A pass where every live provider answered caches like the balance does;
    // disabled or unconfigured routes are not failures, but any real failure
    // stays uncached so the next poll retries it.
    if (providers.every((entry) => entry.ok === true || entry.configured === false || entry.disabled === true)) {
      quotaCache.at = Date.now();
      quotaCache.result = result;
    }
    json(res, 200, result);
  };

  /** Predict, at POST time and independent of watch timing, whether the
   *  submitted section changes any model's tier scope — the editor shows a
   *  "history is re-folding" note only when it actually does. Partial merges
   *  (a POST that omits `pricing`, e.g. currency or monthly-only saves) keep
   *  the current pricing in the prediction.
   *
   *  The comparison is over the EFFECTIVE rules, not over the submitted rows:
   *  the fold keys off every model id an event can carry, so a submit that
   *  only drops a now-redundant alias row (or an untouched model whose official
   *  default already says what the row said) changes the stored section without
   *  changing a single tier assignment — and must not claim a replay. */
  const predictRefold = (parsed) => {
    const current = resolveConfig();
    const next = parsed.reset === true ? config : {
      ...current,
      costEnabled: parsed.costEnabled ?? current.costEnabled !== false,
      usdToCny: parsed.usdToCny ?? effectiveUsdToCny(current),
      pricing: Array.isArray(parsed.pricing) ? parsed.pricing : current.pricing,
    };
    return peakMapKey(peakMapOf(next)) !== peakMapKey(peakMapOf(current));
  };

  // No host command: the '/' menu entry is a CLIENT contribution named
  // `pulse` (lib/client.js). dsh's menu facade draws glyphs only for its own
  // six built-ins, while a contribution may carry an icon and locale-aware
  // copy — and a contribution that collides with a host command name fails
  // loud, so a host command would necessarily add a second, glyph-less row to
  // every menu. The `/pulse` row therefore opens the plugin's own floating
  // seat (the compact session summary, handing over to the full observatory)
  // instead of executing a host command; the token/cost data all surfaces
  // share stays on `GET /pulse/stats`.

  ctx.effect(() => ctx.webServer.register({
    kind: "prefix",
    path: "/pulse",
    handler: async (req, res) => {
      try {
        const url = new URL(req.url ?? "/", "http://x");
        const pathname = decodeURIComponent(url.pathname);
        if (pathname === "/pulse/settings") {
          await serveSettings(ctx, resolveConfig, () => settingsSeam, () => llmService, invalidatePayload, predictRefold, req, res);
          return;
        }
        if (pathname === "/pulse/session") {
          await serveSession(ctx, url, req, res);
          return;
        }
        if (pathname === "/pulse/balance") {
          await serveBalance(req, res, url);
          return;
        }
        if (pathname === "/pulse/quota") {
          await serveQuota(req, res, url);
          return;
        }
        if (pathname === "/pulse/update-check") {
          await serveUpdateCheck(req, res);
          return;
        }
        const wantsJson = pathname === "/pulse" || pathname === "/pulse/stats";
        if (!wantsJson || (req.method !== "GET" && req.method !== "HEAD")) {
          res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
          res.end("not found");
          return;
        }
        const payload = await buildStats(ctx, resolveConfig, {
          from: url.searchParams.get("from"),
          to: url.searchParams.get("to"),
          days: url.searchParams.get("days"),
        }, snapshotsOf);
        const body = Buffer.from(JSON.stringify(payload), "utf8");
        res.writeHead(200, {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        });
        res.end(req.method === "HEAD" ? undefined : body);
      } catch (error) {
        ctx.logger.warn(error);
        res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: String(error?.message ?? error) }));
      }
    },
  }), "dsh-pulse: /pulse route");
}

/**
 * `GET /pulse/update-check` — the settings page's manual version check.
 *
 * This is the ONLY outbound network call dsh-pulse makes, and it runs only
 * when the user presses the button: nothing schedules it, there is no timer
 * and no probe at load. The registry lookup happens host-side so the browser
 * never issues a cross-origin request, and a failure is reported as data
 * (`ok:false`) rather than an HTTP error, so the panel can render it as one
 * of its outcome states. The published version is compared client-side
 * against the bundle's own `DP_BUILD`.
 *
 * @param {object} req - node request.
 * @param {object} res - node response.
 */
async function serveUpdateCheck(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "content-type": "text/plain; charset=utf-8", allow: "GET, HEAD" });
    res.end("method not allowed");
    return;
  }
  try {
    const response = await fetch("https://registry.npmjs.org/dsh-pulse", {
      headers: { accept: "application/vnd.npm.install-v1+json, application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`npm registry HTTP ${response.status}`);
    const meta = await response.json();
    const latest = typeof meta?.["dist-tags"]?.latest === "string" ? meta["dist-tags"].latest : null;
    if (latest === null) throw new Error("npm registry reports no dist-tags.latest for dsh-pulse");
    json(res, 200, {
      ok: true,
      latest,
      publishedAt: typeof meta?.time?.[latest] === "string" ? meta.time[latest] : null,
      checkedAt: Date.now(),
    });
  } catch (error) {
    json(res, 200, { ok: false, error: String(error?.message ?? error), checkedAt: Date.now() });
  }
}

/** JSON helpers for the settings/balance route responses. */
function json(res, status, value) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(value));
}

/** Read a request body as UTF-8 text (streaming for real sockets, `req.body`
 *  for stubs/tests), capped at 1 MiB. */
function readBody(req) {
  if (typeof req.body === "string") return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1e6) {
        reject(new Error("request body too large"));
        if (typeof req.destroy === "function") req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/** Short TTL + bounded LRU for `/pulse/session` event timelines: the raw
 *  event log of one session is immutable (a live session appends, so the
 *  cache naturally expires via TTL), and repeated detail-view reads hit
 *  memory instead of re-reading the persisted log. */
const SESSION_CACHE_MS = 60000;
const SESSION_CACHE_MAX = 20;
const sessionCache = new Map();

/** `GET /pulse/session?id=<sessionId>` — one session's event-level usage
 *  timeline (seconds-accurate) for the detail view's cumulative-consumption
 *  chart and break marks. Reads the raw event log through `sessionQuery`,
 *  never the aggregated projection, so breaks can slice at any instant. */
async function serveSession(ctx, url, req, res) {
  const id = url.searchParams.get("id") ?? "";
  if (id === "") {
    json(res, 400, { ok: false, error: "missing session id" });
    return;
  }
  if (typeof ctx.sessionQuery?.readSession !== "function") {
    json(res, 503, { ok: false, error: "session log access is unavailable in this environment" });
    return;
  }
  const hit = sessionCache.get(id);
  if (hit !== undefined && Date.now() - hit.at < SESSION_CACHE_MS) {
    json(res, 200, hit.value);
    return;
  }
  try {
    const loaded = await ctx.sessionQuery.readSession(id);
    const value = timelineEvents(loaded.events, { id, header: loaded.session });
    sessionCache.delete(id);
    sessionCache.set(id, { at: Date.now(), value });
    while (sessionCache.size > SESSION_CACHE_MAX) sessionCache.delete(sessionCache.keys().next().value);
    json(res, 200, value);
  } catch (error) {
    ctx.logger.warn(error);
    json(res, 404, { ok: false, error: `session unavailable: ${String(error?.message ?? error)}` });
  }
}

/** `GET /pulse/settings` — the editor's source of truth: the effective
 *  cost-enabled flag, USD→CNY rate and pricing rules (official defaults
 *  merged), the untouched official baseline (for per-row "restore official
 *  rates"), the current model catalog from the `llm` service (the editor's
 *  row source), whether the settings seam accepts writes, and — on hosts
 *  with revisioned settings (0.1.7+) — the entry revision the editor must
 *  echo back on POST for optimistic concurrency.
 *  `POST /pulse/settings` replaces the user section
 *  (`{costEnabled, usdToCny, pricing}`, or `{reset: true}` to re-inherit the
 *  composition base and official defaults); the reply carries `refold: true`
 *  when the section changes any model's peak hours (history re-folds). A
 *  stale `revision` is refused with 409 and a machine-readable `conflict`
 *  payload. */
function serveSettings(ctx, resolveConfig, getSettings, getLlm, invalidate, predictRefold, req, res) {
  if (req.method === "GET" || req.method === "HEAD") {
    return catalogOf(getLlm()).then((catalog) => {
      const config = resolveConfig();
      const seam = getSettings();
      const body = {
        currency: config.currency === "USD" ? "USD" : "CNY",
        costEnabled: config.costEnabled !== false,
        pricing: effectivePricing(config),
        monthly: Array.isArray(config.monthlyProviders) ? config.monthlyProviders : [],
        monthlyFee: sanitizeMonthlyFee(unwrapVolatile(config.monthlyFee) ?? {}),
        quotaOff: Array.isArray(config.quotaOff) ? config.quotaOff : [],
        modelColors: sanitizeModelColors(unwrapVolatile(config.modelColors) ?? {}),
        searchShape: sanitizeSearchShape(unwrapVolatile(config.searchShape) ?? {}),
        fx: { usdToCny: effectiveUsdToCny(config) },
        official: OFFICIAL_PRICING,
        catalog,
        writable: seam !== null && typeof seam.writable === "function" && seam.writable() === true,
      };
      const revision = seam !== null && typeof seam.revision === "function" ? seam.revision() : undefined;
      if (typeof revision === "number") body.revision = revision;
      const raw = Buffer.from(JSON.stringify(body), "utf8");
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(req.method === "HEAD" ? undefined : raw);
    }).catch(() => {
      json(res, 500, { error: "settings read failed" });
    });
  }
  if (req.method !== "POST") {
    json(res, 405, { ok: false, error: "method not allowed" });
    return Promise.resolve();
  }
  return readBody(req).then((text) => {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      json(res, 400, { ok: false, error: "invalid JSON body" });
      return;
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      json(res, 400, { ok: false, error: "body must be an object" });
      return;
    }
    const body = z.object({
      costEnabled: z.boolean(),
      usdToCny: z.number(),
      pricing: z.array(pricingRuleSchema),
      currency: z.union(["CNY", "USD"]),
      monthly: z.array(z.string()),
      monthlyFee: z.dict(z.number()),
      quotaOff: z.array(z.string()),
      searchShape: z.dict(z.number()),
      reset: z.boolean(),
      revision: z.number(),
    });
    try {
      body(parsed);
    } catch (error) {
      json(res, 400, { ok: false, error: `invalid settings: ${String(error?.message ?? error)}` });
      return;
    }
    const seam = getSettings();
    if (seam === null || typeof seam.write !== "function") {
      json(res, 503, { ok: false, error: "settings storage is not available in this environment" });
      return;
    }
    // Predicted before persisting: the change feed (and the re-register it
    // may trigger) can fire before the write resolves, which would otherwise
    // compare the new map against itself.
    const refold = predictRefold(parsed) === true;
    // Deferred so even a seam that throws synchronously (a hostile or stubbed
    // implementation) settles through the same conflict/error mapping as the
    // real async service.
    Promise.resolve().then(() => seam.write(parsed))
      .then(() => {
        invalidate();
        invalidateCatalog();
        json(res, 200, { ok: true, refold });
      })
      .catch((error) => {
        if (error !== null && typeof error === "object" && error.code === "SETTINGS_CONFLICT") {
          // The stable machine code of both settings generations' conflict
          // error — the editor refreshes its copy and retries.
          json(res, 409, {
            ok: false,
            error: `settings were changed elsewhere (expected revision ${String(error.expected)}, current ${String(error.actual)})`,
            conflict: { expected: error.expected, actual: error.actual },
          });
          return;
        }
        ctx.logger.warn(error);
        json(res, 400, { ok: false, error: `could not persist settings: ${String(error?.message ?? error)}` });
      });
  }).catch((error) => {
    ctx.logger.warn(error);
    json(res, 400, { ok: false, error: String(error?.message ?? error) });
  });
}
