/**
 * dsh-pulse aggregation — the pure, side-effect-free folds behind the usage
 * observatory.
 *
 * `pulseProjectionDefinition()` is the `pulseUsage` session-projection unit:
 * an incremental per-event fold registered on `ctx.sessionProjections` (the
 * harness drives `apply` over every committed event of every live session,
 * keeps the watermark cache warm, and the persisted projection cache
 * (`ctx.sessionProjectionCache`) serves cold sessions through its read
 * ladder), so the HTTP route reads O(1) snapshots instead of re-reading
 * whole session logs. `foldEvents` runs the same fold over a synthetic
 * event array for tests and offline use.
 *
 * The rest are pure window/payload helpers: `resolveWindow` validates and
 * clamps a request window, `sliceRecord` cuts one record's per-day maps to
 * that window, and `buildPayload` assembles the wire payload (schema 3).
 *
 * @module dsh-pulse/aggregate
 */

import { z } from "zod";

import { DEFAULT_USD_TO_CNY } from "./view.js";

/** Local-timezone `YYYY-MM-DD` for a Unix epoch millisecond stamp. */
export function localDay(timeMs) {
  const d = new Date(timeMs);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Local midnight (epoch ms) of a `YYYY-MM-DD` string. */
export function dayStart(day) {
  const [y, m, d] = String(day).split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

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
  firstDay: z.string().nullable(),
}).strict();

/** Local `HH` hour key for a timestamp (e.g. "07", "23"). */
function hourKey(timeMs) {
  return String(new Date(timeMs).getHours()).padStart(2, "0");
}

/**
 * Fixed UTC+8 offset for pricing-tier classification: DeepSeek's peak
 * windows are defined in Beijing time, and the fold must not depend on the
 * host's local timezone (Asia/Shanghai has no DST, so a constant offset is
 * exact).
 */
export const BEIJING_OFFSET_MS = 8 * 3600000;

/**
 * Default peak hours (Beijing time, 0–23): DeepSeek's official windows
 * 09:00–12:00 and 14:00–18:00. Stored as an hour set rather than start/end
 * pairs so any provider's disjoint windows — including ones that wrap
 * midnight — are the same shape: a boolean per hour.
 */
export const PEAK_HOURS = [9, 10, 11, 14, 15, 16, 17];

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
 *  hour set (Beijing time, hour granularity). Accepts an hour array or the
 *  Set the projection materializes; defaults to the official windows. */
export function tierAt(timeMs, peakHours = PEAK_HOURS) {
  const hh = new Date(timeMs + BEIJING_OFFSET_MS).getUTCHours();
  if (typeof peakHours?.has === "function") return peakHours.has(hh) ? "peak" : "offpeak";
  const hours = Array.isArray(peakHours) ? peakHours : PEAK_HOURS;
  return hours.includes(hh) ? "peak" : "offpeak";
}

/**
 * The `pulseUsage` projection unit for `ctx.sessionProjections.register`.
 *
 * Folding semantics:
 * - `byDay` / `modelsByDay` accumulate the disjoint provider usage of each
 *   `assistant/message` event (input = uncached input; cacheRead/cacheWrite
 *   are reported separately by the harness adapters). Events whose adapter
 *   reported no usage, or whose sum is zero, add nothing.
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
 * - `firstDay` is the lexicographically earliest attributed day; day keys
 *   come from each event's timestamp in the local timezone. Events with a
 *   missing timestamp are not day-attributed (they still count nowhere —
 *   every real session event carries a time).
 * - `apply` returns the same state reference when nothing changed (the
 *   registry's change feed keys on reference identity) and a new plain-JSON
 *   state otherwise.
 *
 * @param {object} [options]
 * @param {(model: string) => number[]} [options.peakHoursFor] - peak hour
 *   set per model id (Beijing time); omitted models fold at the official
 *   windows. Defaults to the official windows for everything.
 * @param {number} [options.stateVersion=4] - fold-semantics version; the
 *   host bumps it when peak-hour settings change so persisted rows replay.
 * @returns {object} the projection definition (`key`, `schema`, `init`, `apply`, `view`, `stateVersion`).
 */
export function pulseProjectionDefinition({ peakHoursFor, stateVersion = 4 } = {}) {
  const dayOf = (event) => (num(event.time) > 0 ? localDay(event.time) : null);
  /** Per-model hour sets, materialized once (the map lives and dies with one
   *  registration, so a re-register on settings change starts it fresh). An
   *  explicitly empty set is legal — "no peak hours", flat pricing. */
  const hourSets = new Map();
  const hoursOf = (model) => {
    let set = hourSets.get(model);
    if (set === undefined) {
      const hours = typeof peakHoursFor === "function" ? peakHoursFor(model) : PEAK_HOURS;
      set = new Set(Array.isArray(hours) ? hours : PEAK_HOURS);
      hourSets.set(model, set);
    }
    return set;
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
  return {
    key: "pulseUsage",
    schema: pulseUsageSchema,
    init() {
      return {
        byDay: {}, modelsByDay: {}, hoursByDay: {}, tiersByDay: {}, turnsByDay: {}, toolCallsByDay: {}, firstDay: null, lastTurn: null,
      };
    },
    apply(state, event) {
      if (event === null || typeof event !== "object") return state;
      const { type, data } = event;
      if (data === null || typeof data !== "object") return state;
      if (type === "assistant/message") {
        const usage = data.usage;
        if (usage === null || typeof usage !== "object") return state;
        const sum = num(usage.inputTokens) + num(usage.outputTokens)
          + num(usage.cacheReadTokens) + num(usage.cacheWriteTokens);
        if (sum <= 0) return state;
        const source = data.message?.source;
        const model = typeof source?.model === "string" && source.model.length > 0 ? source.model : "unknown";
        const day = dayOf(event);
        if (day === null) return state; // untimestamped: nothing is day-attributed
        const next = { ...state };
        next.byDay = { ...state.byDay };
        const daily = { ...(state.byDay[day] ?? EMPTY_TOKENS()) };
        addTokens(daily, usage);
        next.byDay[day] = daily;
        next.modelsByDay = { ...state.modelsByDay };
        const dayModels = { ...(state.modelsByDay[day] ?? {}) };
        const perModel = { ...(dayModels[model] ?? EMPTY_TOKENS()) };
        addTokens(perModel, usage);
        dayModels[model] = perModel;
        next.modelsByDay[day] = dayModels;
        next.hoursByDay = prunedHours(state.hoursByDay, day);
        const hh = hourKey(event.time);
        const dayHours = { ...(next.hoursByDay[day] ?? {}) };
        const hourModels = { ...(dayHours[hh] ?? {}) };
        const perHourModel = { ...(hourModels[model] ?? EMPTY_TOKENS()) };
        addTokens(perHourModel, usage);
        hourModels[model] = perHourModel;
        dayHours[hh] = hourModels;
        next.hoursByDay = { ...next.hoursByDay, [day]: dayHours };
        // Peak/off-peak split (Beijing-time hour set, per model) per day and
        // model, the cost estimate's tier source for any window length.
        next.tiersByDay = { ...state.tiersByDay };
        const dayTiers = { ...(state.tiersByDay[day] ?? {}) };
        const modelTiers = { ...(dayTiers[model] ?? EMPTY_TIER()) };
        addTier(modelTiers, usage, tierAt(event.time, hoursOf(model)));
        dayTiers[model] = modelTiers;
        next.tiersByDay = { ...next.tiersByDay, [day]: dayTiers };
        withFirstDay(next, day);
        return next;
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
        const next = { ...state, toolCallsByDay: { ...state.toolCallsByDay } };
        next.toolCallsByDay[day] = (state.toolCallsByDay[day] ?? 0) + 1;
        withFirstDay(next, day);
        return next;
      }
      return state;
    },
    view(state) {
      return {
        byDay: state.byDay,
        modelsByDay: state.modelsByDay,
        hoursByDay: state.hoursByDay,
        tiersByDay: state.tiersByDay,
        turnsByDay: state.turnsByDay,
        toolCallsByDay: state.toolCallsByDay,
        firstDay: state.firstDay,
      };
    },
    stateVersion,
  };
}

/** Fold a synthetic event array with the projection unit (tests, offline use).
 *  `options` reach {@link pulseProjectionDefinition} (`peakHoursFor`). */
export function foldEvents(events, options = {}) {
  const definition = pulseProjectionDefinition(options);
  let state = definition.init();
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
 * @param {Array<{t: number, total: number}>} snapshots - query-time balance
 *   snapshots (epoch ms, CNY total); unsorted input is tolerated.
 * @param {string} fromDay - inclusive `YYYY-MM-DD` window start.
 * @param {string} toDay - inclusive `YYYY-MM-DD` window end.
 * @returns {Array<{key: string, spend: number|null}>} one entry per day.
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
  /** Balance at the end of `day`: the newest snapshot on or before it. */
  const endOf = (day) => {
    while (cursor < snaps.length && localDay(snaps[cursor].t) <= day) {
      lastSeen = snaps[cursor].total;
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
    const delta = prev === null || cur === null || day > lastDay ? null : prev - cur;
    const spend = delta === null || delta < -1e-9 ? null : Math.round(delta * 100) / 100;
    prev = cur;
    return { key: day, spend };
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
 * @param {object} record - `{id, createdAt, createdDay, project, subagent, firstDay, byDay, modelsByDay, turnsByDay, toolCallsByDay}`.
 * @param {string} fromDay - inclusive `YYYY-MM-DD`.
 * @param {string} toDay - inclusive `YYYY-MM-DD`.
 * @returns {object|null} the windowed record, or null when nothing lands in the window.
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
  const createdIn = validDay(record.createdDay)
    && record.createdDay >= fromDay && record.createdDay <= toDay;
  const activeDays = [...Object.keys(byDay), ...Object.keys(turnsByDay), ...Object.keys(toolCallsByDay)];
  if (!createdIn && activeDays.length === 0) return null;
  const anchor = activeDays.length > 0 ? activeDays.sort()[0] : record.createdDay;
  return {
    id: record.id ?? null,
    createdAt: record.createdAt ?? null,
    project: record.project ?? null,
    subagent: record.subagent === true,
    day: anchor,
    byDay,
    modelsByDay,
    hoursByDay,
    tiersByDay,
    turnsByDay,
    toolCallsByDay,
  };
}

/**
 * Build the wire payload served by `/pulse/stats` (schema 3).
 *
 * @param {object} options
 * @param {Array<object>} options.records - `sliceRecord` outputs for the window.
 * @param {string} [options.fromDay] - window start echoed to the client.
 * @param {string} [options.toDay] - window end echoed to the client.
 * @param {Array<object>} [options.pricing] - pricing rules echoed to the client.
 * @param {number} [options.topProjects] - project-row cap echoed to the client.
 * @param {boolean} [options.costEnabled] - whether the client should show cost estimates.
 * @param {{usdToCny?: number}} [options.fx] - USD→CNY rate for the unified
 *   CNY cost display (invalid values fall back to the built-in default).
 * @param {number} [options.now] - clock override for tests.
 * @returns {object} the JSON payload.
 */
export function buildPayload({ records, fromDay, toDay, pricing = [], topProjects = 8, costEnabled = true, fx = {}, now = Date.now() }) {
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
  return {
    schema: 3,
    generatedAt: now,
    today,
    fromDay: window.fromDay,
    toDay: window.toDay,
    pricing: Array.isArray(pricing) ? pricing : [],
    topProjects: Number.isFinite(top) && top > 0 ? Math.floor(top) : 8,
    costEnabled: costEnabled !== false,
    fx: { usdToCny: Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_USD_TO_CNY },
    sessions,
  };
}
