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
import { BEIJING_OFFSET_MS, PEAK_HOURS } from "./pricing-facts.js";
import { dayStart, localDay } from "./view/keys.js";
export { dayStart, localDay };
/**
 * Project label from a session working directory: the trailing `depth`
 * segments joined with `/` (both separators normalized), defaulting to the
 * basename. Deeper labels disambiguate same-named directories in different
 * parents; the config clamps `depth` to 1..3.
 */
export declare function projectOf(cwd: any, depth?: number): string;
/** Upper bound for a served window (keeps payloads bounded). — ~3 years */
export declare const MAX_WINDOW_DAYS = 1095;
/** How far a day's boundary readings may sit from the day itself before
 *  its spend degrades into an interval estimate (`sparse` rows): the enter
 *  reading older than noon of the previous day, or the leave reading from
 *  before noon of the day, means the attribution window swallows the
 *  neighbors' usage (or the day's own tail) — drift and calibration skip
 *  such days, displays may mark them. */
export declare const SNAPSHOT_SPARSE_STALE_MS: number;
/** Days of per-hour detail the projection keeps (the hourly chart only needs
 *  the current day; a small retention window keeps the persisted checkpoint
 *  and every payload small while covering a dashboard left open over
 *  midnight). Older hour maps are pruned as newer events arrive. */
export declare const HOURS_RETENTION_DAYS = 3;
/** Clamp a requested window length to 1..MAX_WINDOW_DAYS. */
export declare function clampDays(days: any): number;
/** A `YYYY-MM-DD` literal is valid only when it round-trips the local calendar. */
export declare function validDay(day: any): boolean;
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
export declare function resolveWindow(input: {
    from?: string;
    to?: string;
    days?: number | string;
}, fallbackDays: number, now?: number): {
    fromDay: string;
    toDay: string;
};
/** Wire shape of the `pulseUsage` projection unit (validates `view` output). */
export declare const pulseUsageSchema: z.ZodObject<{
    byDay: z.ZodRecord<z.ZodString, z.ZodObject<{
        input: z.ZodNumber;
        output: z.ZodNumber;
        cacheRead: z.ZodNumber;
        cacheWrite: z.ZodNumber;
    }, z.core.$strict>>;
    modelsByDay: z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodObject<{
        input: z.ZodNumber;
        output: z.ZodNumber;
        cacheRead: z.ZodNumber;
        cacheWrite: z.ZodNumber;
    }, z.core.$strict>>>;
    hoursByDay: z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodObject<{
        input: z.ZodNumber;
        output: z.ZodNumber;
        cacheRead: z.ZodNumber;
        cacheWrite: z.ZodNumber;
    }, z.core.$strict>>>>;
    tiersByDay: z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodObject<{
        input: z.ZodObject<{
            peak: z.ZodNumber;
            offpeak: z.ZodNumber;
        }, z.core.$strict>;
        output: z.ZodObject<{
            peak: z.ZodNumber;
            offpeak: z.ZodNumber;
        }, z.core.$strict>;
        cacheRead: z.ZodObject<{
            peak: z.ZodNumber;
            offpeak: z.ZodNumber;
        }, z.core.$strict>;
        cacheWrite: z.ZodObject<{
            peak: z.ZodNumber;
            offpeak: z.ZodNumber;
        }, z.core.$strict>;
    }, z.core.$strict>>>;
    turnsByDay: z.ZodRecord<z.ZodString, z.ZodNumber>;
    toolCallsByDay: z.ZodRecord<z.ZodString, z.ZodNumber>;
    toolHistogramByDay: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodNumber>>>;
    auxByDay: z.ZodRecord<z.ZodString, z.ZodObject<{
        search: z.ZodOptional<z.ZodObject<{
            peak: z.ZodNumber;
            offpeak: z.ZodNumber;
        }, z.core.$strict>>;
        title: z.ZodOptional<z.ZodObject<{
            peak: z.ZodNumber;
            offpeak: z.ZodNumber;
        }, z.core.$strict>>;
        titleIn: z.ZodOptional<z.ZodObject<{
            peak: z.ZodNumber;
            offpeak: z.ZodNumber;
        }, z.core.$strict>>;
        titleOut: z.ZodOptional<z.ZodObject<{
            peak: z.ZodNumber;
            offpeak: z.ZodNumber;
        }, z.core.$strict>>;
        titleKey: z.ZodOptional<z.ZodString>;
        timeline: z.ZodOptional<z.ZodObject<{
            peak: z.ZodNumber;
            offpeak: z.ZodNumber;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    title: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    firstDay: z.ZodNullable<z.ZodString>;
}, z.core.$strict>;
/** Full fold-state shape of the `pulseUsage` unit: the client-visible view
 *  plus the fold's own internals (`lastTurn`, the id of the last folded
 *  turn; `inheritedEventCount`, the fork cut below which nothing counts).
 *  Since the 0.1.1-rc session-projection registry validates persisted
 *  checkpoint rows against the unit's STATE schema (`stateSchema`), it must
 *  cover every field the fold keeps — the view schema alone would reject
 *  rows at restore and demote every cold read to a full-log replay. */
export declare const pulseUsageStateSchema: z.ZodObject<{
    byDay: z.ZodRecord<z.ZodString, z.ZodObject<{
        input: z.ZodNumber;
        output: z.ZodNumber;
        cacheRead: z.ZodNumber;
        cacheWrite: z.ZodNumber;
    }, z.core.$strict>>;
    modelsByDay: z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodObject<{
        input: z.ZodNumber;
        output: z.ZodNumber;
        cacheRead: z.ZodNumber;
        cacheWrite: z.ZodNumber;
    }, z.core.$strict>>>;
    hoursByDay: z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodObject<{
        input: z.ZodNumber;
        output: z.ZodNumber;
        cacheRead: z.ZodNumber;
        cacheWrite: z.ZodNumber;
    }, z.core.$strict>>>>;
    tiersByDay: z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodObject<{
        input: z.ZodObject<{
            peak: z.ZodNumber;
            offpeak: z.ZodNumber;
        }, z.core.$strict>;
        output: z.ZodObject<{
            peak: z.ZodNumber;
            offpeak: z.ZodNumber;
        }, z.core.$strict>;
        cacheRead: z.ZodObject<{
            peak: z.ZodNumber;
            offpeak: z.ZodNumber;
        }, z.core.$strict>;
        cacheWrite: z.ZodObject<{
            peak: z.ZodNumber;
            offpeak: z.ZodNumber;
        }, z.core.$strict>;
    }, z.core.$strict>>>;
    turnsByDay: z.ZodRecord<z.ZodString, z.ZodNumber>;
    toolCallsByDay: z.ZodRecord<z.ZodString, z.ZodNumber>;
    toolHistogramByDay: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodNumber>>>;
    auxByDay: z.ZodRecord<z.ZodString, z.ZodObject<{
        search: z.ZodOptional<z.ZodObject<{
            peak: z.ZodNumber;
            offpeak: z.ZodNumber;
        }, z.core.$strict>>;
        title: z.ZodOptional<z.ZodObject<{
            peak: z.ZodNumber;
            offpeak: z.ZodNumber;
        }, z.core.$strict>>;
        titleIn: z.ZodOptional<z.ZodObject<{
            peak: z.ZodNumber;
            offpeak: z.ZodNumber;
        }, z.core.$strict>>;
        titleOut: z.ZodOptional<z.ZodObject<{
            peak: z.ZodNumber;
            offpeak: z.ZodNumber;
        }, z.core.$strict>>;
        titleKey: z.ZodOptional<z.ZodString>;
        timeline: z.ZodOptional<z.ZodObject<{
            peak: z.ZodNumber;
            offpeak: z.ZodNumber;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
    title: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    firstDay: z.ZodNullable<z.ZodString>;
    lastTurn: z.ZodNullable<z.ZodNumber>;
    inheritedEventCount: z.ZodNumber;
}, z.core.$strict>;
export { BEIJING_OFFSET_MS, PEAK_HOURS };
/**
 * Estimated token count of one text: CJK characters price at ≈0.6 tokens
 * each, everything else at ≈0.3 (the approximation DeepSeek's own docs use
 * for mixed zh/en input). Input length is capped so a pathological event can
 * neither stall the fold nor grow the state.
 */
export declare function estimateTokens(text: any): number;
/** Normalize a configured hour list into a deduplicated, valid one. A
 *  non-array (undefined settings) means "not configured" and falls back to
 *  the official hours; an explicit empty array is meaningful — "no peak
 *  hours", i.e. flat pricing — and survives; a non-empty array whose entries
 *  are all invalid falls back to the official hours (garbage never becomes
 *  "flat" silently). Never throws from the fold over bad settings. */
export declare function normalizePeakHours(hours: any): any[];
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
export declare function tierAt(timeMs: number, peakHours?: any): "peak" | "offpeak";
export type ProjectionDefinition = {
    /**
     * - the registry's projection key.
     */
    key: string;
    /**
     * - legacy (pre-0.1.1-rc) client-view zod schema.
     */
    schema: any;
    /**
     * - 0.1.1-rc persisted-state zod schema.
     */
    stateSchema: any;
    /**
     * - the
     * empty fold state for one session (the registry's fork cut rides in).
     */
    init: (header: any, inheritedEventCount: number) => any;
    /**
     * - one committed event's
     * incremental fold (returns the same reference when nothing changed).
     */
    apply: (state: any, event: any) => any;
    /**
     * - the client-visible cut.
     */
    view: (state: any) => any;
    /**
     * - the
     * 0.1.1-rc wire boundary.
     */
    wire: {
        viewSchema: any;
        view: (state: any) => any;
    };
    /**
     * - fold-semantics version (cache key part).
     */
    stateVersion: number;
};
export type WindowedRecord = {
    id?: string | null;
    createdAt?: number | null;
    /**
     * - creation day, the empty-window anchor.
     */
    createdDay?: string;
    project?: string | null;
    subagent?: boolean;
    parentSession?: string | null;
    title?: string | null;
    delegationDepth?: number;
    /**
     * - earliest attributed day.
     */
    firstDay?: string | null;
    /**
     * - the windowed record's anchor day.
     */
    day?: string | null;
    /**
     * - day → token totals.
     */
    byDay?: Record<string, any>;
    /**
     * - day → model → tokens.
     */
    modelsByDay?: Record<string, Record<string, any>>;
    /**
     * - day → `HH` → model → tokens.
     */
    hoursByDay?: Record<string, Record<string, Record<string, any>>>;
    /**
     * - day → model → peak/off-peak split.
     */
    tiersByDay?: Record<string, Record<string, any>>;
    turnsByDay?: Record<string, number>;
    toolCallsByDay?: Record<string, number>;
    /**
     * - day → tool → count.
     */
    toolHistogramByDay?: Record<string, Record<string, number>>;
    /**
     * - day → aux counters.
     */
    auxByDay?: Record<string, any>;
    /**
     * - schema-2 fallback scalar.
     */
    turns?: number;
    /**
     * - schema-2 fallback scalar.
     */
    toolCalls?: number;
};
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
 * @property {number} [turns] - schema-2 fallback scalar.
 * @property {number} [toolCalls] - schema-2 fallback scalar.
 */
/** Fold-semantics version of the `pulseUsage` unit at load (the host adds its
 *  peak-hour epoch on top). 13 folds the auxiliary bills the fold used to
 *  miss: `compaction/summary` carries real usage under its own provider and
 *  model, and `plugin:timeline/request` at least carries its call. 12 was the
 *  fork-aware fold: a seeded session's inherited prefix stops counting, so
 *  every row persisted before it replays from its log. 11 added the tool
 *  histogram. */
export declare const PULSE_STATE_VERSION = 13;
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
export declare function pulseProjectionDefinition({ peakHoursFor, stateVersion }?: {
    peakHoursFor?: (model: string) => number[] | {
        hours: number[];
        weekdaysOnly?: boolean;
    };
    stateVersion?: number;
}): ProjectionDefinition;
/** Fold a synthetic event array with the projection unit (tests, offline use).
 *  `options` reach {@link pulseProjectionDefinition} (`peakHoursFor`);
 *  `seed` is what the registry hands `init` — the session header and its
 *  fork cut (`inheritedEventCount`; omitted means an unseeded session). */
export declare function foldEvents(events: any, options?: {}, seed?: {}): any;
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
export declare function balanceSpendSeries(snapshots: Array<{
    t: number;
    total: number;
}>, fromDay: string, toDay: string): Array<{
    key: string;
    spend: number | null;
    sparse: boolean;
}>;
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
export declare function sliceRecord(record: WindowedRecord, fromDay: string, toDay: string): WindowedRecord | null;
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
 * log. Events inside
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
 *   the turn carries no user text); `aux` = `[{t, kind, key?, in?, out?}]`.
 */
export declare function timelineEvents(events: Array<{
    type?: string;
    time?: number;
    data?: any;
}>, { id, header, inheritedEventCount }?: {
    id?: string;
    header?: {
        id?: string | null;
        createdAt?: number | null;
        cwd?: string | null;
        origin?: string;
        parentSession?: string | null;
        delegationDepth?: number;
    };
    inheritedEventCount?: number;
}): {
    id: string | null;
    header: object;
    events: any[];
    turns: any[];
    aux: any[];
};
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
export declare function buildPayload({ records, fromDay, toDay, pricing, topProjects, costEnabled, fx, monthly, corpusSessions, displayCurrency, now }: {
    records?: Array<WindowedRecord>;
    fromDay?: string;
    toDay?: string;
    pricing?: Array<any>;
    topProjects?: number;
    costEnabled?: boolean;
    fx?: {
        usdToCny?: number;
    };
    monthly?: string[];
    corpusSessions?: number;
    now?: number;
    displayCurrency?: string;
}): {
    schema: number;
    generatedAt: number;
    today: string;
    fromDay: string;
    toDay: string;
    pricing: Array<any>;
    monthly: string[];
    topProjects: number;
    costEnabled: boolean;
    fx: {
        usdToCny: number;
    };
    card: any;
    cardOrigin: string;
    displayCurrency: string;
    corpusSessions: number;
    sessions: Array<WindowedRecord>;
    anomalies?: any;
    balanceSeries?: Array<any>;
    modelColors?: any;
    auxShape?: any;
};
