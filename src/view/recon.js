/**
 * View model — reconciliation: the official-bill overlay
 * (`reconcileSeries`), the aux-shape self-calibration and drift alarm,
 * and the per-family rollup the recon table renders.
 */

import { rangeKeys, splitModelKey } from "./keys.js";
import { EMPTY_MODEL_ROW, EMPTY_TOKENS } from "./build-view.js";
import { AUX_PRICE_AS, AUX_SHAPE, addTokens, auxDayUsage, auxShapeOf } from "./aux-calls.js";
import { familyRouteOf, isOfficialProvider, rollupKeyOf } from "./routes.js";
import { DEFAULT_USD_TO_CNY, priceTier, resolveRates, ruleFor, ruleMaps, tierSide } from "./pricing-engine.js";
import { isOffPeakDay, officialRulesFor } from "./official-pricing.js";

/** Drift/calibration absolute floor (CNY): below this a gap is settlement
 *  noise — a relative percentage on a near-zero day means nothing. */
export const RECON_ABS_FLOOR = 0.1;

/**
 * Per-day reconciliation over the whole corpus (never filtered): the
 * official-channel measured cost, the aux estimate under `auxShape`, the
 * official spend and their gap. Days with unpriced official-channel tokens
 * are flagged — their estimate is incomplete, so calibration and drift
 * checks skip them instead of attributing missing rates to the aux shape.
 * Sparse official days (see `balanceSpendSeries`) pass the flag through and
 * are skipped by calibration and drift for the same reason.
 *
 * @returns {Array<{key: string, est: number, aux: number, official: number|null,
 *   gap: number|null, auxCalls: number, unpriced: boolean, sparse: boolean}>}
 */
export function reconcileSeries(sessions, { from, to, pricing = [], fx = {}, monthly = [], auxShape = null, official = [] } = {}) {
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
  const days = keys.map((key) => ({ key, est: 0, aux: 0, auxCalls: 0, unpricedTokens: 0 }));
  const priceInto = (day, idx, tokens, tier, priceAs, sink) => {
    if (monthlySet.has(splitModelKey(priceAs).provider)) return;
    const maps = rulesOn(day);
    const rule = ruleFor(maps, priceAs);
    if (rule === undefined) {
      // The estimate cannot be complete without a rate; the day flags itself
      // out of calibration/drift rather than poisoning the gap.
      if (sink === "est") {
        days[idx].unpricedTokens += (tokens.input || 0) + (tokens.cacheRead || 0) + (tokens.cacheWrite || 0) + (tokens.output || 0);
      }
      return;
    }
    const rates = resolveRates(rule);
    const conv = rule.currency === "USD" ? usdToCny : 1;
    const flatOff = rule.weekdaysOnly !== false && isOffPeakDay(day);
    const cost = flatOff || tier === null || tier === undefined
      ? priceTier(tokens, rates, "offpeak")
      : priceTier(tierSide(tier, "peak"), rates, "peak") + priceTier(tierSide(tier, "offpeak"), rates, "offpeak");
    days[idx][sink] += cost * conv;
  };
  for (const record of Array.isArray(sessions) ? sessions : []) {
    if (record === null || typeof record !== "object") continue;
    for (const [day, dayModels] of Object.entries(record.modelsByDay ?? {})) {
      const idx = index.get(day);
      if (idx === undefined || dayModels === null || typeof dayModels !== "object") continue;
      for (const [modelName, tokens] of Object.entries(dayModels)) {
        // Third-party routes don't bill the official account: out of scope.
        if (!isOfficialProvider(splitModelKey(modelName).provider)) continue;
        priceInto(day, idx, tokens, record.tiersByDay?.[day]?.[modelName], modelName, "est");
      }
    }
    for (const [day, aux] of Object.entries(record.auxByDay ?? {})) {
      const idx = index.get(day);
      if (idx === undefined) continue;
      const usage = auxDayUsage(aux, shape);
      if (usage === null) continue;
      days[idx].auxCalls += usage.searchCalls + usage.titleCalls;
      if (usage.searchTokens !== null) priceInto(day, idx, usage.searchTokens, usage.searchTier, AUX_PRICE_AS, "aux");
      if (usage.titleTokens !== null) {
        const key = usage.titleKey ?? AUX_PRICE_AS;
        // A title route off the official account is not the balance's business.
        if (isOfficialProvider(splitModelKey(key).provider)) {
          priceInto(day, idx, usage.titleTokens, usage.titleTier, key, "aux");
        }
      }
    }
  }
  const spendBy = new Map((Array.isArray(official) ? official : [])
    .filter((row) => row !== null && typeof row === "object")
    .map((row) => [row.key, {
      spend: Number.isFinite(row.spend) ? row.spend : null,
      sparse: row.sparse === true,
    }]));
  return days.map((day) => {
    const entry = spendBy.get(day.key);
    const officialSpend = entry !== undefined ? entry.spend : null;
    const gap = officialSpend === null ? null : officialSpend - day.est - day.aux;
    return {
      key: day.key,
      est: Math.round(day.est * 1e6) / 1e6,
      aux: Math.round(day.aux * 1e6) / 1e6,
      official: officialSpend,
      gap: gap === null ? null : Math.round(gap * 1e6) / 1e6,
      auxCalls: day.auxCalls,
      unpriced: day.unpricedTokens > 0,
      sparse: entry !== undefined && entry.sparse,
    };
  });
}

/** Median of a finite number list (null when empty). */
function medianOf(list) {
  const sorted = [...list].sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * The aux shape self-calibration over a {@link reconcileSeries} result.
 *
 * Mechanism (per the 0.5 design review): the OUTPUT component is measured
 * near-exact and frozen; one input-side scalar `s` scales miss/hit. Each
 * complete, fully-priced day with aux calls implies `s = (aux + gap) / aux`
 * (clamped to [0.5, 3] — outside means something else moved the balance);
 * days WITHOUT aux calls act as controls — any residual there is unmodeled
 * consumption, which must suspend learning rather than poison the shape.
 * Sparse days (a snapshot gap spans them; their official number is an
 * interval estimate, see `balanceSpendSeries`) never sample and never
 * control — their gap mixes several days and proves nothing about one.
 * ≥3 consistent samples (max/min ≤ 1.6) with a median at least 3% off 1
 * switch the active shape; anything less keeps the seed. A manual
 * `searchShape` config freezes the mechanism entirely (`status: "manual"`).
 *
 * @param {Array<object>} rows - reconcileSeries output.
 * @param {object} [options]
 * @param {{miss: number, hit: number, out: number}} [options.seed] - the
 *   shape to scale (the payload's effective default).
 * @param {boolean} [options.manual] - a user-configured shape exists.
 * @param {string} options.today - `YYYY-MM-DD`; earlier days only.
 * @returns {{shape: {miss, hit, out}, status: "manual"|"calibrated"|"insufficient"|"divergent",
 *   samples: number, medianS: number|null, controlDays: number, divergentDays: number, checkedDays: number}}
 */
export function auxCalibration(rows, { seed = AUX_SHAPE, manual = false, today } = {}) {
  const base = auxShapeOf(seed) ?? AUX_SHAPE;
  const list = (Array.isArray(rows) ? rows : []).filter((row) => (
    row !== null && typeof row === "object"
    && typeof row.key === "string"
    && row.official !== null && Number.isFinite(row.official)
    && today !== undefined && row.key < today
    && row.unpriced !== true
    && row.sparse !== true
  ));
  const control = [];
  const implied = [];
  let divergentDays = 0;
  for (const row of list) {
    const tolerance = Math.max(0.1, row.official * 0.03);
    if (row.auxCalls <= 0) {
      control.push(row);
      if (row.gap !== null && Math.abs(row.gap) > tolerance) divergentDays += 1;
      continue;
    }
    // Mass gate: tiny aux spend carries no signal worth learning from.
    if (row.auxCalls < 3 && row.aux < 0.05) continue;
    if (row.gap === null || row.aux <= 0) continue;
    const s = (row.aux + row.gap) / row.aux;
    if (s >= 0.5 && s <= 3) implied.push(s);
  }
  const medianS = medianOf(implied);
  let status = "insufficient";
  let shape = base;
  if (manual === true) {
    status = "manual";
  } else if (divergentDays > 0) {
    // Unattributed residual on control days: the key spent outside the
    // model's reach — learn nothing, say so.
    status = "divergent";
  } else if (implied.length >= 3 && medianS !== null && Math.max(...implied) / Math.min(...implied) <= 1.6) {
    status = "calibrated";
    if (Math.abs(medianS - 1) > 0.03) {
      shape = {
        miss: Math.round(base.miss * medianS),
        hit: Math.round(base.hit * medianS),
        out: base.out,
      };
    }
  }
  return {
    shape,
    status,
    samples: implied.length,
    medianS: medianS === null ? null : Math.round(medianS * 1000) / 1000,
    controlDays: control.length,
    divergentDays,
    checkedDays: list.length,
  };
}

/**
 * The drift alarm: the recent complete days whose official spend diverges
 * from the estimate by more than `threshold` (a fraction of the official
 * amount) — and by at least {@link RECON_ABS_FLOOR} in absolute terms, so
 * a sub-dime settlement residual cannot read as "+100%" just because the
 * day used nothing. Sparse days are skipped outright: across a snapshot
 * gap the official number is an interval estimate, and attributing it to
 * one calendar day proves nothing. Distinct from calibration — this
 * reports a problem, it never adjusts anything. `null` when the recent
 * window reconciles (or is unknown).
 *
 * @returns {{pct: number, day: string, count: number, days: Array<{key: string, pct: number}>}|null}
 */
export function reconDrift(rows, { today, window = 7, threshold = 0.15 } = {}) {
  const list = (Array.isArray(rows) ? rows : []).filter((row) => (
    row !== null && typeof row === "object"
    && row.official !== null && Number.isFinite(row.official) && row.official > 0
    && today !== undefined && row.key < today
    && row.sparse !== true
  )).slice(-window);
  const days = [];
  for (const row of list) {
    const pct = row.gap === null ? 0 : row.gap / row.official;
    if (Math.abs(pct) >= threshold && Math.abs(row.gap) >= RECON_ABS_FLOOR) {
      days.push({ key: row.key, pct: Math.round(pct * 1000) / 10 });
    }
  }
  if (days.length === 0) return null;
  const worst = days.reduce((a, b) => (Math.abs(b.pct) > Math.abs(a.pct) ? b : a), days[0]);
  return { pct: worst.pct, day: worst.key, count: days.length, days };
}

// Per-model accent subsystem — lives in src/view/accents.js; the facade
// re-exports every name so existing imports are untouched.

/**
 * Fold a built view's per-model DISPLAY structures onto provider families
 * (see {@link ROUTE_FAMILIES}): the hand-entered DeepSeek API route and the
 * account route the desktop client adds by itself are one source, so a window
 * shows one DeepSeek row per model instead of two halves of the same number.
 *
 * Amounts are summed only AFTER pricing — every route still priced under its
 * own rules, so no rate is ever applied to another route's tokens — and the
 * pre-rollup per-route rows ride along as `modelRoutes`, which keeps the split
 * one call away for the day the two bill differently. Providers outside a
 * family are returned untouched (`models` order and totals unchanged).
 *
 * @param {object} view - a {@link buildView} result.
 * @returns {{view: object, modelRoutes: Array<object>}}
 */
export function rollupModelFamilies(view) {
  if (view === null || typeof view !== "object") return { view: null, modelRoutes: [] };
  const foldRows = new Map();
  const familyRows = new Map();
  const order = [];
  const sourceRows = Array.isArray(view.models) ? view.models : [];
  for (const row of sourceRows) {
    const rawKey = String(row?.key ?? "");
    const provider = typeof row?.provider === "string" ? row.provider : splitModelKey(rawKey).provider;
    const model = typeof row?.model === "string" ? row.model : splitModelKey(rawKey).model;
    const fold = rollupKeyOf(provider, model);
    const acc = foldRows.get(fold) ?? { ...EMPTY_MODEL_ROW(), key: fold, model, providers: [] };
    addTokens(acc, row);
    addTokens(acc.peak, row.peak ?? EMPTY_TOKENS());
    addTokens(acc.offpeak, row.offpeak ?? EMPTY_TOKENS());
    acc.providers.push(provider);
    foldRows.set(fold, acc);
    const entry = familyRouteOf(provider);
    if (entry !== null) {
      if (!familyRows.has(entry.family)) familyRows.set(entry.family, []);
      familyRows.get(entry.family).push({ ...row, provider, model, family: entry.family });
    }
    if (!order.includes(fold)) order.push(fold);
  }
  const models = order.map((fold) => {
    const acc = foldRows.get(fold);
    const entry = familyRouteOf(acc.providers[0]);
    // The label source: the family's first route that actually contributed,
    // so a family row wears the naming of a route that really served it.
    const provider = entry === null
      ? acc.providers[0]
      : (entry.routes.find((route) => acc.providers.includes(route)) ?? acc.providers[0]);
    return { ...acc, provider, routes: [...new Set(acc.providers)] };
  }).sort((a, b) => (b.input + b.output + b.cacheRead) - (a.input + a.output + a.cacheRead));
  const foldMatrix = (matrix) => {
    if (!(matrix instanceof Map)) return matrix;
    const out = new Map();
    for (const [key, tokens] of matrix) {
      const fold = rollupKeyOf(splitModelKey(key).provider, splitModelKey(key).model);
      const acc = out.get(fold) ?? EMPTY_MODEL_ROW();
      addTokens(acc, tokens);
      addTokens(acc.peak, tokens.peak ?? EMPTY_TOKENS());
      addTokens(acc.offpeak, tokens.offpeak ?? EMPTY_TOKENS());
      out.set(fold, acc);
    }
    return out;
  };
  const modelBuckets = Array.isArray(view.modelBuckets) ? view.modelBuckets.map(foldMatrix) : view.modelBuckets;
  const bucketCosts = Array.isArray(view.bucketCosts) ? view.bucketCosts.map((bucket) => {
    if (bucket === null || typeof bucket !== "object" || !(bucket.byModel instanceof Map)) return bucket;
    const byModel = new Map();
    for (const [key, row] of bucket.byModel) {
      const split = splitModelKey(key);
      const fold = rollupKeyOf(split.provider, split.model);
      const acc = byModel.get(fold) ?? { model: split.model, provider: split.provider, priceAs: row?.priceAs, cost: 0 };
      acc.cost += row?.cost || 0;
      byModel.set(fold, acc);
    }
    return { ...bucket, byModel };
  }) : view.bucketCosts;
  // The split artifact: only families that really did merge several routes.
  const modelRoutes = [];
  for (const [family, rows] of familyRows) {
    if (new Set(rows.map((row) => row.provider)).size < 2) continue;
    for (const row of rows) modelRoutes.push({ family, ...row });
  }
  // The filter picker reads the same identity as the rows it filters.
  const knownModels = Array.isArray(view.knownModels)
    ? [...new Set(view.knownModels.map((key) => rollupKeyOf(splitModelKey(key).provider, splitModelKey(key).model)))].sort()
    : view.knownModels;
  return { view: { ...view, models, modelBuckets, bucketCosts, knownModels }, modelRoutes };
}
