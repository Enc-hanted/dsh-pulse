/**
 * Host half — pricing config: the ONE merge of the official price schedule
 * with the user's config rows, plus the projections both faces read (the
 * settings face's effective rules and the fold's peak-tier map). The spread
 * order and the alias/inheritance rules live here and nowhere else.
 * Official schedules and aliases are LIVE card bindings, so a runtime card
 * apply flows through the merge without a release.
 */

import { OFFICIAL_PRICE_SCHEDULES } from "../view.js";
import { normalizePeakHours } from "../aggregate.js";
import { modelKey } from "../view/keys.js";
import { DEFAULT_USD_TO_CNY, MODEL_ALIASES, PEAK_HOURS } from "../pricing-facts.js";
import { DEFAULT_CARD_SOURCE } from "../pricing/card.js";

/**
 * Default per-model rates come from the versioned data card
 * (src/pricing/ratecard.json, checked 2026-11-18 against
 * https://api-docs.deepseek.com/zh-cn/quick_start/pricing/).
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
 * under those names must price at the Flash tier. The card's alias map
 * resolves them to the current rule instead of keeping a duplicate rate row.
 *
 * The rules are the CURRENT schedule of the official price timeline;
 * historical windows reprice through earlier schedules at view time.
 */

/** Retired model ids the platform still serves, mapped to the current id
 *  whose rule prices them (card data, read live). Aliases are specific to
 *  the official channel: a provider-scoped rule always wins, and an explicit
 *  rule for the alias id is honored as written. */
const legacyAliases = () => new Map(Object.entries(MODEL_ALIASES));

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
function mergePricingRows(config) {
  const rows = new Map();
  const currency = config.currency === "USD" ? "USD" : "CNY";
  const aliases = legacyAliases();
  for (const rule of OFFICIAL_PRICE_SCHEDULES[0].rules) {
    const key = modelKey("", rule.model);
    rows.set(key, {
      ...rule, provider: "",
      peakHours: normalizePeakHours(rule.peakHours ?? PEAK_HOURS),
      weekdaysOnly: rule.weekdaysOnly !== false,
      inherited: true,
    });
  }
  for (const rule of Array.isArray(config.pricing) ? config.pricing : []) {
    const model = typeof rule?.model === "string" && rule.model !== "" ? rule.model : null;
    if (model === null) continue;
    const provider = typeof rule?.provider === "string" && rule.provider.length > 0 ? rule.provider : "";
    // Only the official channel's retired ids alias: a provider-scoped rule
    // prices exactly the id it names (a reseller may serve that id itself).
    const canonical = provider === "" ? (aliases.get(model) ?? model) : model;
    const key = modelKey(provider, canonical);
    const prev = rows.get(key) ?? {};
    // Only a rule that actually SPEAKS to tier scope inherits it from its
    // predecessor row; one that stays silent keeps the official default (and
    // stays tier-neutral however the previous row was scoped).
    const speaksPeak = rule.peakHours !== undefined || typeof rule.weekdaysOnly === "boolean";
    rows.set(key, {
      ...prev, ...rule, provider, model: canonical,
      peakHours: normalizePeakHours(rule.peakHours ?? (prev.inherited === true ? PEAK_HOURS : prev.peakHours) ?? PEAK_HOURS),
      weekdaysOnly: typeof rule.weekdaysOnly === "boolean"
        ? rule.weekdaysOnly
        : (prev.inherited === true || prev.weekdaysOnly === undefined ? true : prev.weekdaysOnly === true),
      inherited: !speaksPeak,
      currency,
    });
  }
  return rows;
}

function effectivePricing(config) {
  return [...mergePricingRows(config).values()].map(({ inherited, ...rule }) => rule);
}

/** Canonical model→tier-spec map of the effective pricing, the fold's input.
 * Only models whose tier scope is NOT the official default (the official
 * hours, weekdays only) appear — everything else folds at that default
 * anyway — so deep-equality over this map decides whether changing settings
 * requires re-folding history (re-registering the projection unit at a bumped
 * state version); price-only edits and new flat rules never trigger a replay.
 * Wildcard (provider-less) rules index the bare model id, and the retired
 * alias ids are indexed alongside their current id, so events folded under
 * either name hit the same spec. */
function peakMapOf(config) {
  const rows = mergePricingRows(config);
  const map = new Map();
  /** The official tier scope is the fold's default, so it needs no entry. */
  const isOfficialScope = (rule) => rule.inherited === true
    || (rule.peakHours.join() === PEAK_HOURS.join() && rule.weekdaysOnly === true);
  for (const rule of rows.values()) {
    if (isOfficialScope(rule)) continue;
    const spec = { hours: rule.peakHours, weekdaysOnly: rule.weekdaysOnly === true };
    const provider = rule.provider ?? "";
    map.set(provider === "" ? rule.model : modelKey(provider, rule.model), spec);
    if (provider === "") {
      for (const [alias, canonical] of legacyAliases()) {
        if (canonical === rule.model) map.set(alias, spec);
      }
    }
  }
  return map;
}

/** JSON-stable signature of a peak map (insertion order is deterministic —
 * effectivePricing iterates official defaults then config rows). */
const peakMapKey = (map) => JSON.stringify([...map.entries()]);

/** Effective USD→CNY rate (invalid values fall back to the built-in default). */
function effectiveUsdToCny(config) {
  const rate = Number(config.usdToCny);
  return Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_USD_TO_CNY;
}

/** 卡源单一入口：配置给了非空 `pricingCardSource` 就用它，否则回退
 *  DEFAULT_CARD_SOURCE。pull 默认源、update-check 探测与两处回显全部经由
 *  这里，消除 `??`（把空串当有效值）与 `typeof…!==""` 两种并存的语义。 */
function effectiveCardSource(config) {
  return typeof config.pricingCardSource === "string" && config.pricingCardSource !== ""
    ? config.pricingCardSource
    : DEFAULT_CARD_SOURCE;
}

export { mergePricingRows, effectivePricing, peakMapOf, peakMapKey, effectiveUsdToCny, effectiveCardSource };
