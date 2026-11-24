/**
 * The pricing service surface — one importable seam for everything that
 * turns usage into money: the versioned rate card (`ratecard.json` + the
 * facts derived from it), the rule → money engine, the official price
 * schedules, and the aux-call estimator. The web/TUI/node-test faces keep
 * their historical imports (`dsh-pulse/view`, `dsh-pulse/aggregate`
 * re-export the same functions); this module is the stable name OTHER
 * packages and future faces should consume:
 *
 * ```js
 * import { costOf, RATECARD_VERSION } from "dsh-pulse/pricing";
 * ```
 *
 * Pricing stays pure data-in/data-out: no I/O, no clock reads beyond the
 * frozen `fromMs` gates, no UI. Money is always derived, never stored.
 */
export { RATECARD, RATECARD_VERSION, SEED_CARD, PEAK_HOURS, BEIJING_OFFSET_MS, DEFAULT_USD_TO_CNY, AUX_PRICE_AS, AUX_CALL_FEE, applyCard, resetCard, activeCard, } from "../pricing-facts.js";
export { validateCard } from "../pricing/card-schema.js";
export { cardDiff, DEFAULT_CARD_SOURCE } from "../pricing/card.js";
export { costOf, costSeries, cacheHitRateOf, fxRateOf, monthlySetOf, priceTier, resolveRates, ruleFor, ruleMaps, tierSide, epochRulesOn, } from "../view/pricing-engine.js";
export { isOffPeakDay, OFFICIAL_PRICE_SCHEDULES, officialEstimateRulesFor, officialRulesFor, strictRulesWith, fullRulesWith, } from "../view/official-pricing.js";
