/**
 * View model — pricing engine: rules → maps → per-row rates → money.
 * `costOf` is the single pricing path (tier-aware, monthly-aware);
 * `epochRulesOn` memoizes the per-day strict layer, `costSeries` is its
 * windowed face.
 */
import { DEFAULT_USD_TO_CNY } from "../pricing-facts.js";
export { DEFAULT_USD_TO_CNY };
/**
 * The ONE definition of the cache hit rate: reads over (uncached input +
 * cache read + cache write). Cache-write tokens were cache misses, so they
 * belong in the denominator — providers that report them (pi-ai) would
 * otherwise inflate the ratio. `buildView`'s totals and the summary card's
 * compact display both read this, so the faces cannot drift.
 *
 * @param {{input?: number, cacheRead?: number, cacheWrite?: number}} tokens
 * @returns {number | null} ratio in [0,1], or `null` when there is no input side
 */
export declare function cacheHitRateOf(tokens: {
    input?: number;
    cacheRead?: number;
    cacheWrite?: number;
}): number | null;
/** Resolved per-rule rates with all defaults applied (cache-hit falls back
 *  to the miss rate; peak rates fall back to the off-peak rates). */
export declare function resolveRates(rule: any): {
    offInput: any;
    offCache: any;
    offOutput: any;
    peakInput: any;
    peakCache: any;
    peakOutput: any;
};
/** Native-currency cost of one tier's token bucket at the resolved rates
 *  (per-million scaling included; uncached input = miss + cache write). */
export declare function priceTier(tokens: any, rates: any, tier: any): number;
/** One side of a tier split as a plain token bucket: the split nests each
 *  side inside every token kind (`{input: {peak, offpeak}, ...}`). */
export declare const tierSide: (tier: any, side: any) => {
    input: any;
    output: any;
    cacheRead: any;
    cacheWrite: any;
};
/** Split pricing rules for provider-aware lookup: `exact` maps
 *  `provider\u0000model` keys (rules with a provider), `wild` maps bare model
 *  ids (rules that price any provider's model of that id — the official
 *  defaults, and every rule from before providers existed). */
export declare function ruleMaps(pricing: any): {
    exact: Map<any, any>;
    wild: Map<any, any>;
};
/** The rule for one model key: an exact provider-scoped rule wins, a
 *  wildcard (provider-less) rule covers the same model id otherwise. */
export declare function ruleFor(maps: any, key: any): any;
/**
 * Cost estimate over per-model token splits, tier-aware, displayed in one
 * currency: CNY. Rules may price a model in CNY (default) or USD; USD-priced
 * models are converted through `fx.usdToCny` (default {@link DEFAULT_USD_TO_CNY})
 * so mixed-currency dashboards still sum to one meaningful number. The
 * converted portion rides along as `convertedFromUsd` for the display note.
 *
 * Each model row may carry a `peak` / `offpeak` split (from the projection's
 * `tiersByDay`, classified by each rule's Beijing-time peak hours). A row
 * without a tier split prices wholly at the off-peak rates. Rates are
 * per-million-token amounts in the rule's currency.
 *
 * @param {Array<{model: string, input?: number, cacheRead?: number, cacheWrite?: number, output?: number, peak?: object, offpeak?: object}>} models
 * @param {Array<{model: string, input: number, cacheRead?: number, output: number, currency?: string, peak?: {input?: number, cacheRead?: number, output?: number}}>} pricing
 * @param {{usdToCny?: number}} [fx] - USD→CNY conversion rate.
 * @param {string[]} [monthly] - provider ids billed as a flat monthly
 *   subscription; their models price at zero marginal cost and count as
 *   configured (never "unpriced"), even without a rate rule.
 * @returns {{configured: boolean, total: number|null, currency: string|null, usdToCny: number, convertedFromUsd: number, unpriced: object}}
 */
export declare function costOf(models: Array<{
    model: string;
    input?: number;
    cacheRead?: number;
    cacheWrite?: number;
    output?: number;
    peak?: object;
    offpeak?: object;
}>, pricing: Array<{
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
}>, fx?: {
    usdToCny?: number;
}, monthly?: string[]): {
    configured: boolean;
    total: number | null;
    currency: string | null;
    usdToCny: number;
    convertedFromUsd: number;
    unpriced: object;
};
/**
 * Per-day cost series (CNY) over the windowed session records, split into
 * peak / off-peak contributions — the cost trend chart's data source. Folds
 * each record's `modelsByDay` against `tiersByDay` and the pricing rules
 * client-side, so it honors the dashboard's project and model filters and
 * can re-price instantly against edited (unsaved) rules. Days without
 * priced activity carry zeros; unpriced models contribute nothing (they are
 * already reported through the cost chip's unpriced note).
 *
 * @param {Array<object>} sessions - payload session records.
 * @param {object} options
 * @param {string} options.from - inclusive `YYYY-MM-DD`.
 * @param {string} options.to - inclusive `YYYY-MM-DD`.
 * @param {string} [options.project] - restrict to one project label ("" = all).
 * @param {string} [options.model] - restrict to one model id ("" = all).
 * @param {Array<object>} [options.pricing] - pricing rules.
 * @param {{usdToCny?: number}} [options.fx] - USD→CNY conversion rate.
 * @param {string[]} [options.monthly] - provider ids billed as a flat monthly
 *   subscription; their models contribute zero to the series.
 * @returns {Array<{key: string, peak: number, offpeak: number}>} one entry per day, `total = peak + offpeak`.
 */
export declare function costSeries(sessions: Array<object>, { from, to, project, model, models: modelsOpt, pricing, fx, monthly, auxShape }?: {
    from: string;
    to: string;
    project?: string;
    model?: string;
    pricing?: Array<object>;
    fx?: {
        usdToCny?: number;
    };
    monthly?: string[];
}): Array<{
    key: string;
    peak: number;
    offpeak: number;
}>;
/** THE epoch pricing context, memoized per call site: each usage day
 *  resolves once to the user's rules over the official schedule in effect
 *  that day (see {@link officialRulesFor}). */
export declare function epochRulesOn(pricing: any): (day: any) => any;
/** Monthly-provider set: flat-subscription providers price at zero marginal. */
export declare function monthlySetOf(monthly: any): Set<any>;
/** USD→CNY conversion rate, falling back to the built-in default. */
export declare function fxRateOf(fx: any): number;
