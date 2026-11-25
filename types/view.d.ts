/**
 * dsh-pulse view model - pure, client-side aggregation of the windowed
 * per-session records served by `/pulse/stats` into chartable buckets
 * (day / week / month), filtered totals, per-model splits, cost estimates,
 * and the GitHub-style heatmap cells used by the 90-day / 1-year views.
 *
 * The browser bundle (lib/client.js) is built from src/client/ by
 * `scripts/build-client.mjs` (esbuild), which imports this file directly —
 * there is no mirrored copy to keep in sync; edit here, then rebuild.
 *
 * @module dsh-pulse/view
 * Layout: the self-contained subsystems live in ./view/ — keys.js (model
 * keys + bucket ladder), routes.js (route families & provider identity),
 * aux-calls.js (aux-call shapes), pricing-engine.js (rules → money),
 * recon.js (official-bill overlay), build-view.js (window aggregation +
 * hourly), quota-estimates.js (quota ms-window math), accents.js
 * (per-model accent palette), official-pricing.js (official price
 * schedules & strict rules). This module keeps the
 * session/turn views and money formatting, and remains the ONLY import
 * surface the plugin's other modules use (exports contract unchanged).
 */
export { MODEL_SEP, bucketLabel, bucketOf, clampSpan, daysBetween, dayStart, localDay, modelFilterSet, modelKey, monthKey, rangeKeys, shiftDay, splitModelKey, weekStart, ymd, } from "./view/keys.js";
export { ROUTE_FAMILIES, familyRouteOf, isOfficialProvider, keyMatchesFilter, providerLabelOf, rollupKeyOf, } from "./view/routes.js";
export { AUX_CALL_FEE, AUX_MODEL_KEY, AUX_PRICE_AS, AUX_SHAPE, auxDayUsage, } from "./view/aux-calls.js";
export { DEFAULT_USD_TO_CNY, cacheHitRateOf, costOf, costSeries, fxRateOf, monthlySetOf, priceTier, resolveRates, ruleFor, ruleMaps, } from "./view/pricing-engine.js";
export { RECON_ABS_FLOOR, auxCalibration, reconDrift, reconcileSeries, rollupModelFamilies, } from "./view/recon.js";
export { buildView, heatmapCells, heatmapLevel, hourlyCostSeries, hourlySeries, statsFingerprint, tierAtMs, } from "./view/build-view.js";
export { quotaBurn, quotaCalibrate, quotaCoverage, quotaDayStart, quotaEmpty, quotaFeeShare, quotaMonthlyFee, quotaProjectAttribution, quotaWindowTokens, } from "./view/quota-estimates.js";
export { fullRulesWith, isOffPeakDay, OFFICIAL_PRICE_SCHEDULES, officialEstimateRulesFor, officialRulesFor, strictRulesWith, } from "./view/official-pricing.js";
export { FOOT_WARN_PCT, footHintShow, footShareOf, footTodaySplitTokens, footTodayTokens, pickFootSource, } from "./view/foot-display.js";
export { ACCENT_MIN_DISTANCE, accentEntryOf, accentFillOf, accentHash, accentHueGap, accentLabDistance, modelAccentMap, vendorAccentOf, } from "./view/accents.js";
/** Axis maximum rounded to a 1/2/5×10^k ceiling so gridlines read clean. */
export declare function niceMax(value: any): number;
/**
 * Cost formatting: whole amounts keep two decimals, sub-unit amounts keep
 * three significant digits (so `0.000278` stays readable instead of raw).
 */
export declare function fmtCost(total: any): string;
export declare function applyDisplay(currency: any, rate: any): void;
/** ONE numeric exit for the display currency: a CNY amount in, the
 *  display-currency number out (unformatted — CSV cells and other numeric
 *  consumers). The ÷rate lives here and nowhere else; moneyParts rides it,
 *  so a second conversion point cannot appear and the printed face can
 *  never disagree with an exported number. */
export declare function displayAmount(cny: any): number;
/** The active display currency's code — the ONE reader for faces that must
 *  NAME the currency (CSV title/header) rather than print an amount.
 *  applyDisplay stays the single writer. Named activeCurrency (not
 *  displayCurrency) because the payloads already carry a displayCurrency
 *  FIELD — a same-named export would make every `data.displayCurrency`
 *  read as a missing import. */
export declare function activeCurrency(): string;
/** ONE money notation for every face — symbol for CNY, code otherwise,
 *  never both. The hero renders `unit` as its own quiet span; quotaMoney
 *  joins the parts back into one string for table cells. CNY amounts honor
 *  the display currency (converted via displayAmount, nowhere else);
 *  non-CNY sources print as-is. */
export declare function moneyParts(total: any, currency: any): {
    text: string;
    unit: any;
};
/** The CNY face of moneyParts for call sites that print the symbol inline.
 *  quotaMoney semantics so the unit survives: CNY mode reads `¥6.80`, USD
 *  display mode reads `2.00 USD` — a bare number beside token counts is
 *  exactly the ambiguity the unit contract forbids. */
export declare function moneyCny(total: any): string;
/** Money with an explicit unit tail: `¥12.34` for CNY, `12.34 USD` otherwise
 *  — the single face for table cells and in-sentence amounts. */
export declare function quotaMoney(total: any, currency: any): string;
/** `HH:MM` for an epoch-ms stamp; null for a non-finite input — the ONE
 *  clock face (the fold's null contract wins over printing a fake midnight). */
export declare function clockOf(ms: any): string;
/** Token-count formatting: 1.2k / 3.4M / 5.6B — the ONE abbreviation for
 *  both faces (the two ladders had already split: 1.5B here printed as
 *  1500.0M on the TUI). A whole number prints bare — 689k, never 689.0k;
 *  the lone decimal is kept only when it says something (830.4k). */
export declare function fmtTokens(n: any): string;
/** `MM-DD HH:MM:SS` short stamp for an epoch-ms value (break ruler labels). */
export declare function fmtClockMs(timeMs: any): string;
/** Fold one record's per-day per-model tokens into the model-row shape the
 *  cost estimator expects (cross-day totals + peak/off-peak tier split). */
export declare function sessionModelRows(record: any): any[];
/** Windowed token totals of one record (its `byDay` is already window-sliced). */
export declare function recordTokens(record: any): {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
};
export type WindowedRecord = {
    id?: string | null;
    createdAt?: number | null;
    project?: string | null;
    subagent?: boolean;
    parentSession?: string | null;
    title?: string | null;
    delegationDepth?: number;
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
     * - a subagent's own descriptor label.
     */
    label?: string;
    /**
     * - the task tree the session last touched.
     */
    timelineTitle?: string;
    /**
     * - team member id → name.
     */
    teamNames?: Record<string, string>;
};
/**
 * One windowed session record as served by `/pulse/stats` (a `sliceRecord`
 * output of the host fold): per-day maps keyed `YYYY-MM-DD`, model maps
 * keyed by the composite `provider\u0000model`. Map values stay loose —
 * every reader guards shapes at runtime.
 *
 * @typedef {object} WindowedRecord
 * @property {string|null} [id]
 * @property {number|null} [createdAt]
 * @property {string|null} [project]
 * @property {boolean} [subagent]
 * @property {string|null} [parentSession]
 * @property {string|null} [title]
 * @property {number} [delegationDepth]
 * @property {string|null} [firstDay]
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
 */
/**
 * Session list grouped by project — the session panel's data source. Each
 * session row carries its windowed token totals, tier-aware cost (through
 * the same estimator the dashboard uses), identity fields (`subagent`,
 * `parentSession`, `delegationDepth`) and its dominant model. Each group
 * adds the subagent subtotal (count, tokens, cost) so "project × subagent"
 * reads at a glance.
 *
 * Within a group a subagent row follows the parent it was spawned from,
 * nested ones included, so a family reads as one block; `nestDepth` is the
 * row's depth under its top-most ancestor in the list, and `childCount` /
 * `childTokens` / `childShare` summarize a row's direct children (count,
 * tokens, and their share of parent + children).
 *
 * @param {Array<WindowedRecord>} sessions - payload session records.
 * @param {{pricing?: Array<any>, fx?: {usdToCny?: number}, monthly?: string[], model?: string, models?: Array<any>, catalog?: any}} [options]
 *   - `{pricing, fx, monthly, model, catalog}` for cost estimation and an
 *   optional model filter (composite key or bare id). With `model` set,
 *   each session counts only that model's rows — sessions that never used
 *   the model drop out entirely, so the project-detail panel never
 *   surfaces other models' sessions. `catalog` (the model config) lets
 *   provider-less rows resolve their provider for monthly/cost matching.
 * @returns {Array<SessionGroup>} groups sorted by total tokens descending.
 */
export declare function sessionGroups(sessions: Array<WindowedRecord>, { pricing, fx, monthly, model, models, catalog }?: {
    pricing?: Array<any>;
    fx?: {
        usdToCny?: number;
    };
    monthly?: string[];
    model?: string;
    models?: Array<any>;
    catalog?: any;
}): Array<SessionGroup>;
export type SessionRow = {
    id: string | null;
    createdAt: number | null;
    title: string | null;
    label: string | null;
    day: string | null;
    subagent: boolean;
    parentSession: string | null;
    delegationDepth: number;
    tokens: {
        input: number;
        output: number;
        cacheRead: number;
        cacheWrite: number;
    };
    total: number;
    cost: any;
    topModel: string | null;
    monthly: boolean;
    modelRows: Array<object>;
    auxSearch: number;
    offpeakShare: number | null;
    timelineTitle: string | null;
    timelineReports: number;
    timelineFailures: number;
    teamNames: Record<string, string> | null;
    nestDepth: number;
    childCount: number;
    childTokens: number;
    childShare: number;
};
export type SessionGroup = {
    project: string | null;
    sessions: SessionRow[];
    mainSessions: number;
    subagentSessions: number;
    tokens: {
        input: number;
        output: number;
        cacheRead: number;
        cacheWrite: number;
    };
    subagentTokens: {
        input: number;
        output: number;
        cacheRead: number;
        cacheWrite: number;
    };
    cost: any;
    /**
     * - the subagent subtotal's cost, null without subagents.
     */
    subagentCost: any;
    total: number;
};
/**
 * Families of the collaboration panel: every session present in the window
 * that spawned subagents, with all of them as members (nested ones
 * included, `nest` = depth under the family root) and each member's share
 * of the family's subagent tokens. A subagent whose own parent is out of
 * the window is a member of an "absent parent" family keyed by that parent
 * id (`absentParent`), so no subagent spend falls off the panel. The head
 * carries its own `tokens`, the members' sum as `memberTokens`, and the
 * team member names the head's log recorded. Families sort by member
 * tokens; members arrive in list order.
 *
 * @param {Array<SessionGroup>} groups - `sessionGroups` output.
 * @returns {Array<object>} families, busiest first.
 */
export declare function collaborationOf(groups: Array<SessionGroup>): Array<object>;
/**
 * Timeline work per session for the collaboration panel: the task tree the
 * session last touched (its title, falling back to the session's own
 * name) with the window's report and failure counts. Only sessions with a
 * tree or an outcome list.
 *
 * @param {Array<SessionGroup>} groups - `sessionGroups` output.
 * @returns {Array<{id: string|null, project: string|null, sessionTitle: string|null, title: string|null, reports: number, failures: number}>}
 *   most reports first.
 */
export declare function timelineOfWork(groups: Array<SessionGroup>): Array<{
    id: string | null;
    project: string | null;
    sessionTitle: string | null;
    title: string | null;
    reports: number;
    failures: number;
}>;
/**
 * Slice one session's event timeline at up to three break timestamps into
 * segments, each with its token totals, tier-aware cost and per-model split.
 * Break points clamp into the timeline's span; segments are `[fromT, toT]`
 * inclusive. Each event prices at its own second-accurate tier (its rule's
 * peak hours), so a segment straddling a peak boundary costs correctly.
 *
 * @param {Array<{t: number, i: number, o: number, cr: number, cw: number, key: string}>} events
 *   - the session timeline (ascending `t`, from `timelineEvents`).
 * @param {Array<number>} breaks - ascending break timestamps (max 3).
 * @param {{pricing?: Array<any>, fx?: {usdToCny?: number}, monthly?: string[], model?: string, models?: Array<any>, catalog?: any}} [options]
 *   - `{pricing, fx, monthly, model}` for cost estimation; `model`
 *   (composite key or bare id) restricts every segment to that model's
 *   events, so a model-filtered break analysis never shows other models'
 *   consumption. `catalog` (the model config) lets provider-less events
 *   resolve their provider for monthly/cost matching.
 * @returns {Array<{from: number, to: number, tokens: object, cost: object, models: Array}>}
 */
export declare function breaksSegments(events: Array<{
    t: number;
    i: number;
    o: number;
    cr: number;
    cw: number;
    key: string;
}>, breaks: Array<number>, { pricing, fx, monthly, model, models, catalog }?: {
    pricing?: Array<any>;
    fx?: {
        usdToCny?: number;
    };
    monthly?: string[];
    model?: string;
    models?: Array<any>;
    catalog?: any;
}): Array<{
    from: number;
    to: number;
    tokens: object;
    cost: object;
    models: any[];
}>;
