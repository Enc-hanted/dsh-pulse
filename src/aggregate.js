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

function addTokens(bucket, usage) {
  bucket.input += num(usage.inputTokens);
  bucket.output += num(usage.outputTokens);
  bucket.cacheRead += num(usage.cacheReadTokens);
  bucket.cacheWrite += num(usage.cacheWriteTokens);
}

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
  turnsByDay: z.record(z.string(), z.number().int().nonnegative()),
  toolCallsByDay: z.record(z.string(), z.number().int().nonnegative()),
  firstDay: z.string().nullable(),
}).strict();

/** Local `HH` hour key for a timestamp (e.g. "07", "23"). */
function hourKey(timeMs) {
  return String(new Date(timeMs).getHours()).padStart(2, "0");
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
 * @returns {object} the projection definition (`key`, `schema`, `init`, `apply`, `view`, `stateVersion`).
 */
export function pulseProjectionDefinition() {
  const dayOf = (event) => (num(event.time) > 0 ? localDay(event.time) : null);
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
        byDay: {}, modelsByDay: {}, hoursByDay: {}, turnsByDay: {}, toolCallsByDay: {}, firstDay: null, lastTurn: null,
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
        turnsByDay: state.turnsByDay,
        toolCallsByDay: state.toolCallsByDay,
        firstDay: state.firstDay,
      };
    },
    stateVersion: 2,
  };
}

/** Fold a synthetic event array with the projection unit (tests, offline use). */
export function foldEvents(events) {
  const definition = pulseProjectionDefinition();
  let state = definition.init();
  for (const event of Array.isArray(events) ? events : []) {
    state = definition.apply(state, event);
  }
  return definition.view(state);
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
 * @param {number} [options.now] - clock override for tests.
 * @returns {object} the JSON payload.
 */
export function buildPayload({ records, fromDay, toDay, pricing = [], topProjects = 8, now = Date.now() }) {
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
  return {
    schema: 3,
    generatedAt: now,
    today,
    fromDay: window.fromDay,
    toDay: window.toDay,
    pricing: Array.isArray(pricing) ? pricing : [],
    topProjects: Number.isFinite(top) && top > 0 ? Math.floor(top) : 8,
    sessions,
  };
}
