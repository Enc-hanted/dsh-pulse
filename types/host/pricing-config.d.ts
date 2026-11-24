/**
 * Host half — pricing config: the ONE merge of the official price schedule
 * with the user's config rows, plus the projections both faces read (the
 * settings face's effective rules and the fold's peak-tier map). The spread
 * order and the alias/inheritance rules live here and nowhere else.
 * Official schedules and aliases are LIVE card bindings, so a runtime card
 * apply flows through the merge without a release.
 */
/** Resolve the effective pricing rules (config wins, official defaults fill
 * in; `peakHours` normalized so the editor and the fold see clean lists).
 * Official rows keep their PUBLISHED currency (CNY facts from the card);
 * config rows price in the one global currency — per-rule `currency` values
 * from older configs are superseded. Rules are keyed by the composite
 * provider+model key (bare model id when provider-less), so a provider-scoped
 * rule coexists with the wildcard default for the same model id.
 *
 * A config rule whose model id is a retired alias is promoted onto the
 * current id's wildcard rule, so one row covers the model and its old names
 * instead of shadowing the official default with a stale rate. Rules
 * configured under a provider are never aliased.
 *
 * Tier scope is resolved to concrete values for display, and
 * {@link effectivePricing.inherited} records whether that resolution came
 * from the official default rather than from the deployment — a distinction
 * only the refold predictor needs, because a row that merely restates the
 * official windows must not be mistaken for a tier-scope change. */
/** The ONE merge of official pricing with the user's config rows: official
 * defaults seed the table, config rows overlay by composite key, and tier
 * scope inherits only through rows that actually speak to it. Both faces —
 * effectivePricing (the settings face) and peakMapOf (the fold's tier
 * engine) — project this map; the spread order and the inheritance rules
 * live here and nowhere else. */
declare function mergePricingRows(config: any): Map<any, any>;
declare function effectivePricing(config: any): any[];
/** Canonical model→tier-spec map of the effective pricing, the fold's input.
 * Only models whose tier scope is NOT the official default (the official
 * hours, weekdays only) appear — everything else folds at that default
 * anyway — so deep-equality over this map decides whether changing settings
 * requires re-folding history (re-registering the projection unit at a bumped
 * state version); price-only edits and new flat rules never trigger a replay.
 * Wildcard (provider-less) rules index the bare model id, and the retired
 * alias ids are indexed alongside their current id, so events folded under
 * either name hit the same spec. */
declare function peakMapOf(config: any): Map<any, any>;
/** JSON-stable signature of a peak map (insertion order is deterministic —
 * effectivePricing iterates official defaults then config rows). */
declare const peakMapKey: (map: any) => string;
/** Effective USD→CNY rate (invalid values fall back to the built-in default). */
declare function effectiveUsdToCny(config: any): number;
/** 卡源单一入口：配置给了非空 `pricingCardSource` 就用它，否则回退
 *  DEFAULT_CARD_SOURCE。pull 默认源、update-check 探测与两处回显全部经由
 *  这里，消除 `??`（把空串当有效值）与 `typeof…!==""` 两种并存的语义。 */
declare function effectiveCardSource(config: any): any;
export { mergePricingRows, effectivePricing, peakMapOf, peakMapKey, effectiveUsdToCny, effectiveCardSource };
