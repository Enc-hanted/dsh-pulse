/**
 * Host half — pricing config: the ONE merge of the official price schedule
 * with the user's config rows, plus the projections both faces read (the
 * settings face's effective rules and the fold's peak-tier map). The spread
 * order and the alias/inheritance rules live here and nowhere else.
 */
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
declare const OFFICIAL_PRICING: {
    model: string;
    input: number;
    cacheRead: number;
    output: number;
    peak: {
        input: number;
        cacheRead: number;
        output: number;
    };
    peakHours: number[];
    weekdaysOnly: boolean;
    currency: string;
}[];
/** Retired model ids the platform still serves, mapped to the current id
 *  whose rule prices them (official page, 2026-09-18). Aliases are specific
 *  to the official channel: a provider-scoped rule always wins, and an
 *  explicit rule for the alias id is honored as written.
 *  @type {Map<string, string>} */
declare const LEGACY_MODEL_ALIASES: Map<string, string>;
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
/** The ONE merge of official pricing with the user's config rows: official
 *  defaults seed the table, config rows overlay by composite key, and tier
 *  scope inherits only through rows that actually speak to it. Both faces —
 *  effectivePricing (the settings face) and peakMapOf (the fold's tier
 *  engine) — project this map; the spread order and the inheritance rules
 *  live here and nowhere else. */
declare function mergePricingRows(config: any): Map<any, any>;
declare function effectivePricing(config: any): any[];
/** Canonical model→tier-spec map of the effective pricing, the fold's input.
 *  Only models whose tier scope is NOT the official default (the official
 *  hours, weekdays only) appear — everything else folds at that default
 *  anyway — so deep-equality over this map decides whether changing settings
 *  requires re-folding history (re-registering the projection unit at a bumped
 *  state version); price-only edits and new flat rules never trigger a replay.
 *  Wildcard (provider-less) rules index the bare model id, and the retired
 *  alias ids are indexed alongside their current id, so events folded under
 *  either name hit the same spec. */
declare function peakMapOf(config: any): Map<any, any>;
/** JSON-stable signature of a peak map (insertion order is deterministic —
 *  effectivePricing iterates official defaults then config rules). */
declare const peakMapKey: (map: any) => string;
/** Effective USD→CNY rate (invalid values fall back to the built-in default). */
declare function effectiveUsdToCny(config: any): number;
export { OFFICIAL_PRICING, LEGACY_MODEL_ALIASES, mergePricingRows, effectivePricing, peakMapOf, peakMapKey, effectiveUsdToCny };
