/**
 * View model — window aggregation: `buildView` (the dashboard's
 * day/week/month buckets, filtered totals, per-model splits), the
 * heatmap cells, and the hourly (分时) series behind the day view.
 */
export declare const EMPTY_TOKENS: () => {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
};
/** Per-model row: window totals plus the peak/off-peak tier split. */
export declare const EMPTY_MODEL_ROW: () => {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    peak: {
        input: number;
        output: number;
        cacheRead: number;
        cacheWrite: number;
    };
    offpeak: {
        input: number;
        output: number;
        cacheRead: number;
        cacheWrite: number;
    };
};
/**
 * Fold windowed session records into one dashboard view.
 *
 * Records carry per-day maps (`byDay`, `modelsByDay`, `hoursByDay`,
 * `tiersByDay`, `turnsByDay`, `toolCallsByDay`) - the host slices the
 * projection state to
 * the requested window, so a session's turns/tool-calls are summed over the
 * same in-range days as its tokens and no totals can leak from outside the
 * view. Schema-2 records (hosts without the projection unit) carry scalar
 * window-scoped turns/tool-calls instead, which the view accepts as-is.
 *
 * @param {Array<object>} sessions - payload session records.
 * @param {object} options
 * @param {('day'|'week'|'month')} [options.granularity='day'] - chart bucket size.
 * @param {string} options.from - inclusive `YYYY-MM-DD`.
 * @param {string} options.to - inclusive `YYYY-MM-DD`.
 * @param {string} [options.project] - restrict to one project label ("" = all).
 * @param {string} [options.model] - restrict to one model id ("" = all).
 * @param {string[]} [options.models] - multi-select model filter (wins over
 *   `model` when non-empty; empty = all). Aux pseudo row participates under
 *   its {@link AUX_MODEL_KEY}.
 * @param {{miss: number, hit: number, out: number}} [options.auxShape] - the
 *   aux call shape (learned / manually configured); defaults to the built-in
 *   seed when omitted.
 * @param {Array<{model: string, input: number, cacheRead?: number, output: number, currency?: string, peak?: {input?: number, cacheRead?: number, output?: number}}>} [options.pricing]
 * @param {{usdToCny?: number}} [options.fx] - USD→CNY rate for the unified cost display.
 * @param {string[]} [options.monthly] - provider ids billed as a flat monthly
 *   subscription; their models cost 0 (configured, never "unpriced").
 * @returns {{buckets: Array, totals: object, models: Array, projects: Array, cost: object, hasData: boolean, knownProjects: string[], knownModels: string[]}}
 */
export declare function buildView(sessions: Array<object>, { granularity, from, to, project, model, models: modelsOpt, pricing, fx, monthly, auxShape: auxShapeOpt }: {
    granularity?: ('day' | 'week' | 'month');
    from: string;
    to: string;
    project?: string;
    model?: string;
    models?: string[];
    auxShape?: {
        miss: number;
        hit: number;
        out: number;
    };
    pricing?: Array<{
        model: string;
        input: number;
        cacheRead?: number;
        output: number;
        currency?: string;
        peak?: {
            input?: number;
            cacheRead?: number;
            output?: number;
        };
    }>;
    fx?: {
        usdToCny?: number;
    };
    monthly?: string[];
}): {
    buckets: any[];
    totals: object;
    models: any[];
    projects: any[];
    cost: object;
    hasData: boolean;
    knownProjects: string[];
    knownModels: string[];
};
/** 变更指纹：只随真实用量或计费规则变化的聚合位串（token 四项 + 三个
 *  计数 + 窗口费用）。重开观测台时与关面板时的指纹一比，不同即说明「你
 *  离开之后数据动过」。刻意不含 generatedAt 等每次拉取都变的字段——指
 *  纹相同就是没变，不许误报。入参是 {@link buildView} 的产物。 */
export declare function statsFingerprint(view: any): string;
/** `"peak"` | `"offpeak"` tier of an epoch-ms timestamp under a peak hour set
 *  (defaults to the official windows). Mirrors the host's fold-time tiering
 *  so event-level break segments price like the daily tiers. */
export declare function tierAtMs(timeMs: any, peakHours: any): "offpeak" | "peak";
/**
 * GitHub-style heatmap layout over day-granularity buckets: cells aligned to
 * Monday-start weeks, padded with leading/trailing nulls so the grid always
 * covers whole weeks, plus the column index of each month's first day.
 *
 * @param {Array<{key: string}>} buckets - contiguous day buckets (from `rangeKeys("day", ...)`).
 * @returns {{cells: Array<object|null>, weeks: number, months: Array<{col: number, label: string}>}}
 */
export declare function heatmapCells(buckets: Array<{
    key: string;
}>): {
    cells: Array<object | null>;
    weeks: number;
    months: Array<{
        col: number;
        label: string;
    }>;
};
/** Discrete intensity level (0-4) for one heatmap cell against the range max. */
export declare function heatmapLevel(value: any, max: any): 0 | 1 | 2 | 3 | 4;
/**
 * Hourly line-series for one day (the "today" view): 24 `HH` buckets summed
 * over every in-scope record's `hoursByDay`, honoring the project and model
 * filters. Schema-2 records carry no hour maps and simply contribute zeros.
 *
 * @param {Array<object>} sessions - payload session records.
 * @param {string} day - `YYYY-MM-DD` to bucket.
 * @param {{project?: string, model?: string}} [filters]
 * @returns {Array<{key: string, input: number, output: number, cacheRead: number, cacheWrite: number}>} 24 buckets, "00".."23".
 */
export declare function hourlySeries(sessions: Array<object>, day: string, { project, model, models }?: {
    project?: string;
    model?: string;
}): Array<{
    key: string;
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
}>;
/**
 * Per-hour cost for ONE day, priced the official-console way: each hour
 * bucket reprices its tokens at that hour's own schedule (peak hours are
 * hour-aligned, so the bucket's midpoint decides the tier; weekends and
 * Chinese public holidays flatten to off-peak for weekday-only rules).
 * Aux calls are day-level estimates with no hour of their own — they never
 * enter this series (the day's aux cost rides the cost trend's day row and
 * the footnote cites it). Model-filter semantics match {@link hourlySeries};
 * monthly providers price at zero marginal, and unpriced models are counted
 * for the footnote instead of guessed at a rate.
 *
 * @param {Array<object>} sessions - payload session records.
 * @param {string} day - `YYYY-MM-DD` to price.
 * @param {{pricing?: Array<object>, fx?: object, monthly?: string[], models?: Array<string|{provider?: string, model?: string}>, project?: string}} [options]
 * @returns {{hours: Array<{key: string, cost: number, peak: number, offpeak: number}>, unpricedTokens: number}}
 */
export declare function hourlyCostSeries(sessions: Array<object>, day: string, { pricing, fx, monthly, models, project }?: {
    pricing?: Array<object>;
    fx?: object;
    monthly?: string[];
    models?: Array<string | {
        provider?: string;
        model?: string;
    }>;
    project?: string;
}): {
    hours: Array<{
        key: string;
        cost: number;
        peak: number;
        offpeak: number;
    }>;
    unpricedTokens: number;
};
