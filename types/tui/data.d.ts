/**
 * TUI face — data layer: session folds, the shared config + pricing layers,
 * the calendar window model, and the money-honesty classification.
 *
 * Pure aggregation and classification — no terminal drawing, no React.
 * `viewSlice` is the money-critical path (locked by test/tui-test.mjs
 * through the facade). String/draw primitives live in ./draw.js; the React
 * scene and the plugin wiring live in ./scene.js.
 */
export declare function tokSum(t: any): any;
/** Session-id equality tolerant to prefix/suffix drift between the
 *  sessionQuery listing and the channel's live sessionId.
 *  Exported for test/tui-test.mjs. */
export declare function eqId(a: any, b: any): boolean;
/** Read one session through `sessionQuery` and fold it into a pulse record.
 *  Folding is memoized on the caller's version stamp — 0.1.x header activity
 *  fields when present, else (0.2.0) the live session's in-memory log length
 *  or the header's createdAt (see collect). An unchanged stamp refolds into
 *  the cached record instead of paying the full decode on every 30s poll and
 *  every scene reopen. `r` clears. */
export declare const foldCache: Map<any, any>;
/** Exported for test/tui-test.mjs. Merges one folded record into `target`.
 *  `tiersByDay` must keep the FOLD's nested shape (`{input: {peak,
 *  offpeak}, ...}`) — reshaping it here into flat peak/offpeak buckets
 *  made dayModelRows hand costOf all-zero-but-defined splits, which priced
 *  every merged row at ¥0 while per-session rows showed real money. */
export declare function mergeRecord(target: any, source: any): void;
/** Per-day model rows in the shape `costOf` expects: flat tokens plus a
 *  real peak/off-peak tier split (tier-aware pricing, like the web face's
 *  costSeries — not everything billed at off-peak rates). */
export declare function dayModelRows(record: any, day: any): any[];
/** Pricing context with two honest layers: `strictFor` prices under the
 *  billing-accurate schedule + user rules; `fullFor` underlays the GA-gap
 *  estimate rules so pre-effective-date usage still shows money. Order
 *  matters — ruleMaps is last-write-wins: estimates < schedule < user. */
export declare function makePricing(config: any): {
    fx: {
        usdToCny: number;
    };
    monthly: any;
    monthlySet: Set<any>;
    costEnabled: boolean;
    modelColors: any;
    strictFor: (day: any) => any[];
    fullFor: (day: any) => any[];
};
export declare function dayCost(record: any, day: any, pricing: any): number;
/** Whether the estimate layer had to contribute money for this day — the
 *  ≈ flag shared by the day summary and the per-session ledger rows. */
export declare function dayEstimatedOf(record: any, day: any, pricing: any): boolean;
/** The four-state 计价 label for ONE (day, model) row — 按量 / 估算 / 包月 /
 *  未定价. Shared by the model list and the CSV's pricing column so the
 *  spreadsheet tells the same story as the screen. Exported for tests. */
export declare function pricingLabelOf(row: any, day: any, pricing: any): "估算" | "包月" | "按量" | "未定价";
/**
 * Snapshot of everything the scene needs: the merged project record plus
 * one folded record per session (for the day-level table). Scope is the
 * current TUI project only — the web face remains the all-projects view.
 */
export declare function collect(ctx: any, entryConfig: any): Promise<{
    empty: boolean;
    config: any;
    loadedAt: number;
    project?: undefined;
    cwd?: undefined;
    record?: undefined;
    sessions?: undefined;
} | {
    empty: boolean;
    project: string;
    cwd: any;
    record: {
        byDay: {};
        modelsByDay: {};
        hoursByDay: {};
        tiersByDay: {};
        turnsByDay: {};
        toolCallsByDay: {};
        auxByDay: {};
        firstDay: any;
    };
    sessions: any[];
    config: any;
    loadedAt: number;
}>;
export declare const WEEKDAYS: string[];
export declare function todayDay(): string;
/** Monday-first weekday index 0..6 of a `YYYY-MM-DD`. */
export declare function weekdayOf(day: any): number;
export declare function monthOf(day: any): any;
export declare function daysInMonth(month: any): number;
/** All day keys of one month (clamped at today for the current month). */
export declare function daysOfMonth(month: any): any[];
/** The year level's data window: a FIXED 53 weeks ending today, independent
 *  of terminal width. Layout may draw fewer columns (P0 keeps the right
 *  column alive), but the window — and therefore every number — never
 *  changes under a resize. */
export declare const YEAR_WEEKS = 53;
export declare function yearWindow(): {
    start: string;
    end: string;
    weeks: number;
};
export declare function windowDays(from: any, to: any): any[];
/** The 2-char month label for the week STARTING `ws` (Monday), or null.
 *  A label marks the week that CONTAINS a 1st-of-month — the old
 *  `monthOf(ws) !== monthOf(we)` boundary test missed every month whose
 *  1st falls on a Monday (June 2026) and its "06" label vanished.
 *  Exported for test/tui-test.mjs. */
export declare function monthLabelOfWeek(ws: any): any;
/**
 * Snapshot of everything one calendar view renders. Money is computed PER
 * DAY — each day under its own schedule + estimate layer + user rules — so
 * a window spanning a price change or a GA gap stays honest:
 * - `values`: day → { tok, cost, estimated } (the per-day ≈ flag),
 * - `models`: per-model classification 按量/估算/包月/未定价 with window
 *   cost, where 未定价 means NO day in the window prices the model under
 *   ANY layer; estimate-covered models are labeled 估算 (with ≈ on money)
 *   instead of being double-reported as both priced and unpriced.
 */
/** Exported for test/tui-test.mjs — the honesty classification is the
 *  money-critical path and deserves the same lock as view.js. */
export declare function viewSlice(record: any, days: any, pricing: any): {
    from: any;
    to: any;
    values: Map<any, any>;
    maxTok: number;
    maxCost: number;
    tokens: number;
    costTotal: number;
    activeDays: number;
    peak: number;
    offpeak: number;
    hasTiers: boolean;
    models: any[];
    unpriced: any[];
    windowCost: {
        total: number;
        estimated: boolean;
    };
    turns: any;
    toolCalls: any;
    peakDay: any;
};
/** Peak hours (0-23) in force for one day, from the pricing rules actually
 *  applicable: the union of every rule carrying a `peak` block. Weekday-
 *  only rules contribute nothing on Sat/Sun (official windows bill those
 *  days entirely off-peak). null = no tiered rule → the gantt draws no band.
 *  Exported for test/tui-test.mjs. */
export declare function peakHoursFor(rules: any, day: any): any;
/** Mini-card model (pure; exported for tests): today split into the
 *  CURRENT session's today-slice vs the rest of the workspace, plus the
 *  month line (tokens, money, daily series, unpriced share). Everything
 *  here is cross-session aggregate or "share of today's pie" — the HUD's
 *  live-session metrics are never duplicated. Exported for tui-test.mjs. */
export declare function miniCardModel(data: any, pricing: any, today: any, currentId: any): {
    today: {
        all: {
            count: any;
            tok: any;
            cost: any;
            estimated: any;
        };
        current: {
            tok: any;
            cost: any;
            estimated: any;
        };
        hasCurrent: boolean;
        others: {
            count: any;
            tok: any;
            cost: any;
            estimated: any;
        };
    };
    month: {
        label: string;
        tok: number;
        cost: number;
        estimated: boolean;
        series: any[];
        peakIdx: number;
        peakDay: any;
        unpricedPct: number;
        unpricedCount: number;
        activeDays: number;
    };
};
