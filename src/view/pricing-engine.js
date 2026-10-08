/**
 * View model — pricing engine: rules → maps → per-row rates → money.
 * `costOf` is the single pricing path (tier-aware, monthly-aware);
 * `epochRulesOn` memoizes the per-day strict layer, `costSeries` is its
 * windowed face.
 */

import { modelFilterSet, modelKey, rangeKeys, splitModelKey } from "./keys.js";
import { keyMatchesFilter } from "./routes.js";
import { EMPTY_TOKENS } from "./build-view.js";
import { AUX_MODEL_KEY, AUX_PRICE_AS, AUX_SHAPE, auxDayUsage, auxShapeOf } from "./aux-calls.js";
import { isOffPeakDay, officialRulesFor } from "./official-pricing.js";
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
export function cacheHitRateOf(tokens) {
  const inputSide = (tokens.input || 0) + (tokens.cacheRead || 0) + (tokens.cacheWrite || 0);
  return inputSide > 0 ? (tokens.cacheRead || 0) / inputSide : null;
}

/** Resolved per-rule rates with all defaults applied (cache-hit falls back
 *  to the miss rate; peak rates fall back to the off-peak rates). */
export function resolveRates(rule) {
  const offInput = rule.input || 0;
  const offCache = typeof rule.cacheRead === "number" ? rule.cacheRead : offInput;
  const offOutput = rule.output || 0;
  const peakRule = rule.peak ?? {};
  const peakInput = typeof peakRule.input === "number" ? peakRule.input : offInput;
  const peakCache = typeof peakRule.cacheRead === "number" ? peakRule.cacheRead : peakInput;
  const peakOutput = typeof peakRule.output === "number" ? peakRule.output : offOutput;
  return { offInput, offCache, offOutput, peakInput, peakCache, peakOutput };
}

/** Native-currency cost of one tier's token bucket at the resolved rates
 *  (per-million scaling included; uncached input = miss + cache write). */
export function priceTier(tokens, rates, tier) {
  const input = tier === "peak" ? rates.peakInput : rates.offInput;
  const cache = tier === "peak" ? rates.peakCache : rates.offCache;
  const output = tier === "peak" ? rates.peakOutput : rates.offOutput;
  return ((tokens.input + tokens.cacheWrite) * input
    + tokens.cacheRead * cache
    + tokens.output * output) / 1e6;
}

/** One side of a tier split as a plain token bucket: the split nests each
 *  side inside every token kind (`{input: {peak, offpeak}, ...}`). */
export const tierSide = (tier, side) => ({
  input: tier.input?.[side] || 0,
  output: tier.output?.[side] || 0,
  cacheRead: tier.cacheRead?.[side] || 0,
  cacheWrite: tier.cacheWrite?.[side] || 0,
});

/** Split pricing rules for provider-aware lookup: `exact` maps
 *  `provider\u0000model` keys (rules with a provider), `wild` maps bare model
 *  ids (rules that price any provider's model of that id — the official
 *  defaults, and every rule from before providers existed). */
export function ruleMaps(pricing) {
  const exact = new Map();
  const wild = new Map();
  for (const rule of Array.isArray(pricing) ? pricing : []) {
    const model = typeof rule?.model === "string" && rule.model !== "" ? rule.model : null;
    if (model === null) continue;
    const provider = typeof rule?.provider === "string" && rule.provider.length > 0 ? rule.provider : "";
    if (provider === "") wild.set(model, rule);
    else exact.set(modelKey(provider, model), rule);
  }
  return { exact, wild };
}

/** The rule for one model key: an exact provider-scoped rule wins, a
 *  wildcard (provider-less) rule covers the same model id otherwise. */
export function ruleFor(maps, key) {
  const hit = maps.exact.get(key);
  if (hit !== undefined) return hit;
  return maps.wild.get(splitModelKey(key).model);
}

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
export function costOf(models, pricing, fx = {}, monthly = []) {
  const maps = ruleMaps(pricing);
  const monthlySet = new Set(Array.isArray(monthly) ? monthly : []);
  const usdToCny = Number(fx?.usdToCny) > 0 ? Number(fx.usdToCny) : DEFAULT_USD_TO_CNY;
  let total = 0;
  let converted = 0;
  let configured = false;
  const unpriced = EMPTY_TOKENS();
  for (const row of Array.isArray(models) ? models : []) {
    const key = typeof row?.key === "string" && row.key !== ""
      ? row.key
      : modelKey(row?.provider, row?.model);
    // A flat monthly subscription bills no marginal tokens: zero cost, and
    // it is a known price, so it never lands in the unpriced bucket.
    const provider = typeof row?.provider === "string" ? row.provider : splitModelKey(key).provider;
    if (monthlySet.has(provider)) { configured = true; continue; }
    const rule = ruleFor(maps, key);
    if (rule === undefined) {
      unpriced.input += row.input + row.cacheRead + row.cacheWrite;
      unpriced.output += row.output;
      continue;
    }
    configured = true;
    const rates = resolveRates(rule);
    const offpeak = row.offpeak ?? row;
    const peak = row.peak ?? EMPTY_TOKENS();
    const native = priceTier(offpeak, rates, "offpeak") + priceTier(peak, rates, "peak");
    if (rule.currency === "USD") {
      const cny = native * usdToCny;
      total += cny;
      converted += cny;
    } else {
      total += native;
    }
  }
  return configured
    ? {
      configured: true,
      total: Math.round(total * 1e6) / 1e6,
      currency: "CNY",
      usdToCny,
      convertedFromUsd: Math.round(converted * 1e6) / 1e6,
      unpriced,
    }
    : { configured: false, total: null, currency: null, usdToCny, convertedFromUsd: 0, unpriced };
}

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
export function costSeries(sessions, { from, to, project = "", model = "", models: modelsOpt = [], pricing = [], fx = {}, monthly = [], auxShape = null } = {}) {
  // Epoch-aware: each day prices under the official schedule in effect that
  // day, with the caller's own (non-inherited) rules overlaid.
  const userRules = (Array.isArray(pricing) ? pricing : []).filter((rule) => rule?.inherited !== true);
  const dayRuleMaps = new Map();
  const rulesOn = (day) => {
    let maps = dayRuleMaps.get(day);
    if (maps === undefined) {
      maps = ruleMaps([...officialRulesFor(day), ...userRules]);
      dayRuleMaps.set(day, maps);
    }
    return maps;
  };
  const monthlySet = new Set(Array.isArray(monthly) ? monthly : []);
  const usdToCny = Number(fx?.usdToCny) > 0 ? Number(fx.usdToCny) : DEFAULT_USD_TO_CNY;
  const shape = auxShapeOf(auxShape) ?? AUX_SHAPE;
  const keys = rangeKeys("day", from, to);
  const index = new Map(keys.map((key, i) => [key, i]));
  const days = keys.map((key) => ({ key, peak: 0, offpeak: 0 }));
  const modelSet = modelFilterSet(model, modelsOpt);
  const auxVisible = modelSet === null || modelSet.has(AUX_MODEL_KEY);
  /** Aux estimates ride the same series so the spark, the CSV and the
   *  cost-trend panel (which folds them inside buildView) all agree. Aux
   *  days iterate independently — a search-only day has no model rows. */
  const foldAuxDay = (maps, day, idx, aux) => {
    if (!auxVisible) return;
    const usage = auxDayUsage(aux, shape);
    if (usage === null) return;
    const parts = [];
    if (usage.searchTokens !== null) parts.push({ tokens: usage.searchTokens, tier: usage.searchTier, priceAs: AUX_PRICE_AS });
    if (usage.titleTokens !== null) parts.push({ tokens: usage.titleTokens, tier: usage.titleTier, priceAs: usage.titleKey ?? AUX_PRICE_AS });
    for (const part of parts) {
      if (monthlySet.has(splitModelKey(part.priceAs).provider)) continue;
      const rule = ruleFor(maps, part.priceAs);
      if (rule === undefined) continue;
      const rates = resolveRates(rule);
      const conv = rule.currency === "USD" ? usdToCny : 1;
      const flatOff = rule.weekdaysOnly !== false && isOffPeakDay(day);
      if (flatOff) {
        days[idx].offpeak += priceTier(part.tokens, rates, "offpeak") * conv;
      } else {
        days[idx].peak += priceTier(tierSide(part.tier, "peak"), rates, "peak") * conv;
        days[idx].offpeak += priceTier(tierSide(part.tier, "offpeak"), rates, "offpeak") * conv;
      }
    }
  };
  for (const record of Array.isArray(sessions) ? sessions : []) {
    if (record === null || typeof record !== "object") continue;
    if (project !== "" && String(record.project ?? "") !== project) continue;
    for (const [day, dayModels] of Object.entries(record.modelsByDay ?? {})) {
      const idx = index.get(day);
      if (idx === undefined || dayModels === null || typeof dayModels !== "object") continue;
      const maps = rulesOn(day);
      for (const [modelName, tokens] of Object.entries(dayModels)) {
        if (!keyMatchesFilter(modelSet, modelName)) continue;
        // A flat monthly subscription contributes zero marginal cost.
        if (monthlySet.has(splitModelKey(modelName).provider)) continue;
        const rule = ruleFor(maps, modelName);
        if (rule === undefined) continue;
        const rates = resolveRates(rule);
        const conv = rule.currency === "USD" ? usdToCny : 1;
        const tier = record.tiersByDay?.[day]?.[modelName];
        // Weekends and holidays bill entirely off-peak under weekday-only rules.
        const flatOff = rule.weekdaysOnly !== false && isOffPeakDay(day);
        if (tier === null || tier === undefined || flatOff) {
          days[idx].offpeak += priceTier(tokens, rates, "offpeak") * conv;
        } else {
          days[idx].peak += priceTier(tierSide(tier, "peak"), rates, "peak") * conv;
          days[idx].offpeak += priceTier(tierSide(tier, "offpeak"), rates, "offpeak") * conv;
        }
      }
    }
    for (const [day, aux] of Object.entries(record.auxByDay ?? {})) {
      const idx = index.get(day);
      if (idx === undefined) continue;
      foldAuxDay(rulesOn(day), day, idx, aux);
    }
  }
  const round = (v) => Math.round(v * 1e6) / 1e6;
  return days.map((day) => ({ key: day.key, peak: round(day.peak), offpeak: round(day.offpeak) }));
}

// --- Reconciliation & aux self-calibration ------------------------------------
//
// The official balance series gives daily ground truth for the official
// account; the projection gives measured assistant usage and counted aux
// calls. Their difference per day is the reconciliation gap. Small persistent
// gaps on aux days (with clean control days) are the aux shape's estimation
// error — exactly what the self-calibration learns; large gaps are drift the
// UI must surface. Everything here is a pure fold over payload data: no
// storage, no timers, deterministic per payload, so the "learning state"
// needs no persistence at all.

/** The official-channel providers the balance series can explain — the
 *  provider-family rule above, so a signed-in account route counts too. */

/** The user's own pricing rules — config rows that are not inherited copies
 *  of the official table (those would double-book history). */
function userRulesOf(pricing) {
  return (Array.isArray(pricing) ? pricing : []).filter((rule) => rule?.inherited !== true);
}

/** THE epoch pricing context, memoized per call site: each usage day
 *  resolves once to the user's rules over the official schedule in effect
 *  that day (see {@link officialRulesFor}). */
export function epochRulesOn(pricing) {
  const memo = new Map();
  return (day) => {
    let maps = memo.get(day);
    if (maps === undefined) {
      maps = ruleMaps([...officialRulesFor(day), ...userRulesOf(pricing)]);
      memo.set(day, maps);
    }
    return maps;
  };
}

/** Monthly-provider set: flat-subscription providers price at zero marginal. */
export function monthlySetOf(monthly) {
  return new Set(Array.isArray(monthly) ? monthly : []);
}

/** USD→CNY conversion rate, falling back to the built-in default. */
export function fxRateOf(fx) {
  return Number(fx?.usdToCny) > 0 ? Number(fx.usdToCny) : DEFAULT_USD_TO_CNY;
}
