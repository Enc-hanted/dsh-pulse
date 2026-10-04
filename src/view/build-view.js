/**
 * View model — window aggregation: `buildView` (the dashboard's
 * day/week/month buckets, filtered totals, per-model splits), the
 * heatmap cells, and the hourly (分时) series behind the day view.
 */

import { bucketOf, keyMatchesFilter, modelFilterSet, monthKey, rangeKeys, splitModelKey } from "./keys.js";
import { AUX_MODEL_KEY, AUX_PRICE_AS, AUX_SHAPE, addDayModel, addTokens, auxDayUsage, auxShapeOf } from "./aux-calls.js";
import { DEFAULT_USD_TO_CNY, cacheHitRateOf, epochRulesOn, monthlySetOf, priceTier, resolveRates, ruleFor, tierSide } from "./pricing-engine.js";
import { quotaDayStart } from "./quota-estimates.js";
import { BEIJING_OFFSET_MS, PEAK_HOURS } from "../pricing-facts.js";
import { isOffPeakDay } from "./official-pricing.js";

/** Accumulate one model's day tokens into a bucket row of the per-day
 *  per-model matrix (`modelBuckets` inside {@link buildView}). The row keeps
 *  the peak/off-peak tier split so each day can price under the official
 *  schedule that was in effect. */
function addModelBucket(dayMatrix, modelName, tokens, tier) {
  const acc = dayMatrix.get(modelName) ?? EMPTY_MODEL_ROW();
  addDayModel(acc, tokens, tier);
  dayMatrix.set(modelName, acc);
}

// Official-pricing subsystem — lives in src/view/official-pricing.js; the
// facade re-exports every name so existing imports are untouched.

export const EMPTY_TOKENS = () => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });

/** Per-model row: window totals plus the peak/off-peak tier split. */
export const EMPTY_MODEL_ROW = () => ({ ...EMPTY_TOKENS(), peak: EMPTY_TOKENS(), offpeak: EMPTY_TOKENS() });

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
export function buildView(sessions, { granularity = "day", from, to, project = "", model = "", models: modelsOpt = [], pricing = [], fx = {}, monthly = [], auxShape: auxShapeOpt = null }) {
  const keys = rangeKeys(granularity, from, to);
  const index = new Map(keys.map((key, i) => [key, i]));
  const buckets = keys.map((key) => ({ key, sessions: 0, ...EMPTY_TOKENS(), auxSearch: 0, auxTitle: 0 }));
  /** Per-day per-model token matrix for the usage trend's model dimension:
   *  same index as `buckets`, each a Map of model key → row (with the
   *  peak/off-peak tier split so each day can price under the official
   *  schedule that was in effect). Tokens the fold could not attribute to a
   *  model (schema-2 records) land under the '' key so a model stack still
   *  totals its day. */
  const modelBuckets = keys.map(() => new Map());
  /** Epoch-aware pricing: each usage day prices under the official schedule
   *  in effect that day (see {@link OFFICIAL_PRICE_SCHEDULES}), with the
   *  caller's own rules overlaid — rules that arrive already merged with the
   *  official table are marked `inherited` and skipped here so today's copy
   *  of the official rates never double-books history. */
  const rulesOn = epochRulesOn(pricing);
  const monthlySet = monthlySetOf(monthly);
  const usdToCny = Number(fx?.usdToCny) > 0 ? Number(fx.usdToCny) : DEFAULT_USD_TO_CNY;
  /** Per-day cost for the cost trend panel: peak / off-peak contributions,
   *  a per-model cost map for the drill, and the day's unpriced tokens. */
  const bucketCosts = keys.map((key) => ({ key, peak: 0, offpeak: 0, byModel: new Map(), unpriced: { input: 0, output: 0 } }));
  const costAcc = { configured: false, total: 0, converted: 0, unpriced: { input: 0, output: 0 }, unpricedBy: new Map() };
  /** Price one (day, model) token bucket under that day's schedule.
   *  Weekends and Chinese public holidays flatten to off-peak for
   *  weekday-only rules — the official windows bill those days entirely
   *  off-peak. Accumulates into the chip cost and the day's bucket cost;
   *  `priceAs` redirects the rate lookup only (the row keeps its own id). */
  const addDayCost = (idx, day, modelName, tokens, tier, priceAs = modelName) => {
    // The ROW's identity is the model the tokens belong to (`modelName`); the
    // RATE lookup may be redirected (`priceAs` — the aux pseudo-model bills at
    // a real model's rates). Keeping the two apart is what lets the chart
    // colour and label a segment by the model it actually is.
    const owned = splitModelKey(modelName);
    const bare = owned.model;
    const provider = owned.provider;
    const priceProvider = splitModelKey(priceAs).provider;
    if (monthlySet.has(priceProvider)) { costAcc.configured = true; return; }
    const rule = ruleFor(rulesOn(day), priceAs);
    const dayBucket = bucketCosts[idx];
    if (rule === undefined) {
      const inputSide = (tokens.input || 0) + (tokens.cacheRead || 0) + (tokens.cacheWrite || 0);
      costAcc.unpriced.input += inputSide;
      costAcc.unpriced.output += tokens.output || 0;
      // WHICH id has no rate: the billing key is what the user can go and
      // price (`priceAs` may be a real model id for an estimate row), so the
      // note can name it instead of leaving a bare token count.
      const missing = costAcc.unpricedBy.get(priceAs) ?? { key: priceAs, provider: priceProvider, model: splitModelKey(priceAs).model, input: 0, output: 0 };
      missing.input += inputSide;
      missing.output += tokens.output || 0;
      costAcc.unpricedBy.set(priceAs, missing);
      if (dayBucket !== undefined) {
        dayBucket.unpriced.input += inputSide;
        dayBucket.unpriced.output += tokens.output || 0;
      }
      return;
    }
    costAcc.configured = true;
    const rates = resolveRates(rule);
    const conv = rule.currency === "USD" ? usdToCny : 1;
    const flatOff = rule.weekdaysOnly !== false && isOffPeakDay(day);
    const offSide = flatOff || tier === null || tier === undefined ? tokens : tierSide(tier, "offpeak");
    const peakSide = flatOff || tier === null || tier === undefined ? EMPTY_TOKENS() : tierSide(tier, "peak");
    const offPart = priceTier(offSide, rates, "offpeak");
    const peakPart = priceTier(peakSide, rates, "peak");
    const cny = (offPart + peakPart) * conv;
    costAcc.total += cny;
    if (conv !== 1) costAcc.converted += cny;
    if (dayBucket === undefined) return;
    dayBucket.peak += peakPart * conv;
    dayBucket.offpeak += offPart * conv;
    const bm = dayBucket.byModel.get(modelName) ?? { model: bare, provider, priceAs, cost: 0 };
    bm.cost += cny;
    dayBucket.byModel.set(modelName, bm);
  };
  const totals = { sessions: 0, subagents: 0, turns: 0, toolCalls: 0, ...EMPTY_TOKENS() };
  const models = new Map();
  const projects = new Map();
  const seenProjects = new Set();
  const seenModels = new Set();
  const modelSet = modelFilterSet(model, modelsOpt);
  const auxShape = auxShapeOf(auxShapeOpt) ?? AUX_SHAPE;

  for (const record of Array.isArray(sessions) ? sessions : []) {
    if (record === null || typeof record !== "object") continue;
    const label = record.project === null || record.project === undefined ? "" : String(record.project);
    seenProjects.add(label);
    if (project !== "" && label !== project) continue;

    // Active days = union of token days and turn/tool-call days, so a step
    // whose adapter reported no usage still contributes its turn count.
    const byDay = record.byDay ?? {};
    const daySet = new Set(Object.keys(byDay));
    for (const day of Object.keys(record.turnsByDay ?? {})) daySet.add(day);
    for (const day of Object.keys(record.toolCallsByDay ?? {})) daySet.add(day);
    // Model options come from the whole window, independent of the filters,
    // so the picker stays stable while filtering.
    for (const dayModels of Object.values(record.modelsByDay ?? {})) {
      for (const modelName of Object.keys(dayModels)) seenModels.add(modelName);
    }
    const activeDays = [...daySet].filter((day) => day >= from && day <= to).sort();
    const anchorDay = record.day !== undefined && record.day >= from && record.day <= to
      ? record.day
      : activeDays[0];
    if (anchorDay === undefined) continue;
    const anchorIdx = index.get(bucketOf(granularity, anchorDay));
    if (anchorIdx !== undefined) buckets[anchorIdx].sessions += 1;

    const inRange = EMPTY_TOKENS();
    const inRangeModels = new Map();
    for (const day of activeDays) {
      const dayModels = record.modelsByDay?.[day];
      if (modelSet === null) {
        // Unfiltered: day totals drive buckets/totals, per-model splits ride along.
        const dayTokens = byDay[day] ?? EMPTY_TOKENS();
        addTokens(inRange, dayTokens);
        const idx = index.get(bucketOf(granularity, day));
        if (idx !== undefined) addTokens(buckets[idx], dayTokens);
        if (dayModels === undefined) {
          if (idx !== undefined) {
            addModelBucket(modelBuckets[idx], "", dayTokens, undefined);
            addDayCost(idx, day, "", dayTokens, undefined);
          }
          continue;
        }
        const attributed = EMPTY_TOKENS();
        for (const [modelName, tokens] of Object.entries(dayModels)) {
          const row = inRangeModels.get(modelName) ?? EMPTY_MODEL_ROW();
          addDayModel(row, tokens, record.tiersByDay?.[day]?.[modelName]);
          inRangeModels.set(modelName, row);
          if (idx !== undefined) {
            addModelBucket(modelBuckets[idx], modelName, tokens, record.tiersByDay?.[day]?.[modelName]);
            addDayCost(idx, day, modelName, tokens, record.tiersByDay?.[day]?.[modelName]);
          }
          addTokens(attributed, tokens);
        }
        if (idx !== undefined) {
          const rest = EMPTY_TOKENS();
          for (const field of ["input", "output", "cacheRead", "cacheWrite"]) rest[field] = (dayTokens[field] || 0) - (attributed[field] || 0);
          if (rest.input || rest.output || rest.cacheRead || rest.cacheWrite) {
            addModelBucket(modelBuckets[idx], "", rest, undefined);
            addDayCost(idx, day, "", rest, undefined);
          }
        }
      } else {
        // Model-filtered: only selected models' tokens flow anywhere, so
        // buckets, chips, projects and the cost chip all agree. A composite
        // member targets one provider's row; a bare member covers every row
        // whose model id matches (the single-filter semantics, generalized).
        const matched = dayModels === undefined ? [] : Object.keys(dayModels).filter((key) => keyMatchesFilter(modelSet, key));
        for (const key of matched) {
          const filtered = dayModels[key];
          addTokens(inRange, filtered);
          const idx = index.get(bucketOf(granularity, day));
          if (idx !== undefined) addTokens(buckets[idx], filtered);
          if (idx !== undefined) {
            addModelBucket(modelBuckets[idx], key, filtered, record.tiersByDay?.[day]?.[key]);
            addDayCost(idx, day, key, filtered, record.tiersByDay?.[day]?.[key]);
          }
          const row = inRangeModels.get(key) ?? EMPTY_MODEL_ROW();
          addDayModel(row, filtered, record.tiersByDay?.[day]?.[key]);
          inRangeModels.set(key, row);
        }
      }
    }

    // 辅助调用（官方 web_search / 标题 LLM）：搜索按（自校准后的）实测形状
    // 折算 token，标题用折算层记录的实文估算 token，以 `web-search` 伪模型
    // 行进入模型堆叠、模型分布与费用——定价按当日生效的官方价走同一套纪元
    // 规则（标题按其路由定价，第三方路由照常走该路由规则/包月/未定价）。
    // 类型视图的本地计量保持纯实测，不掺估算；模型筛选不含伪模型行时整体跳过。
    if (modelSet === null || modelSet.has(AUX_MODEL_KEY)) {
      for (const [day, aux] of Object.entries(record.auxByDay ?? {})) {
        if (day < from || day > to) continue;
        const usage = auxDayUsage(aux, auxShape);
        if (usage === null) continue;
        seenModels.add(AUX_MODEL_KEY);
        const idx = index.get(bucketOf(granularity, day));
        if (idx !== undefined) {
          buckets[idx].auxSearch += usage.searchCalls;
          buckets[idx].auxTitle += usage.titleCalls;
        }
        const parts = [];
        if (usage.searchTokens !== null) parts.push({ tokens: usage.searchTokens, tier: usage.searchTier, priceAs: AUX_PRICE_AS });
        if (usage.titleTokens !== null) parts.push({ tokens: usage.titleTokens, tier: usage.titleTier, priceAs: usage.titleKey ?? AUX_PRICE_AS });
        const auxTokens = {
          input: parts.reduce((s, p) => s + p.tokens.input, 0),
          cacheRead: parts.reduce((s, p) => s + p.tokens.cacheRead, 0),
          output: parts.reduce((s, p) => s + p.tokens.output, 0),
          cacheWrite: 0,
        };
        const auxTier = {
          input: { peak: 0, offpeak: 0 }, cacheRead: { peak: 0, offpeak: 0 },
          output: { peak: 0, offpeak: 0 }, cacheWrite: { peak: 0, offpeak: 0 },
        };
        for (const part of parts) {
          for (const kind of ["input", "output", "cacheRead", "cacheWrite"]) {
            auxTier[kind].peak += part.tier[kind]?.peak || 0;
            auxTier[kind].offpeak += part.tier[kind]?.offpeak || 0;
          }
        }
        const row = inRangeModels.get(AUX_MODEL_KEY) ?? EMPTY_MODEL_ROW();
        addDayModel(row, auxTokens, auxTier);
        inRangeModels.set(AUX_MODEL_KEY, row);
        if (idx !== undefined) {
          addModelBucket(modelBuckets[idx], AUX_MODEL_KEY, auxTokens, auxTier);
          // Each part prices under its own billing key (search → flash; title
          // → its route), so a third-party title route never leaks into the
          // official flash rate.
          for (const part of parts) {
            addDayCost(idx, day, AUX_MODEL_KEY, part.tokens, part.tier, part.priceAs);
          }
        }
      }
    }

    totals.sessions += 1;
    if (record.subagent) totals.subagents += 1;
    if (record.turnsByDay === undefined) {
      // Schema-2 compatibility: hosts without the projection unit serve
      // window-scoped scalar counts instead of per-day maps.
      totals.turns += Number(record.turns) || 0;
      totals.toolCalls += Number(record.toolCalls) || 0;
    } else {
      for (const day of activeDays) {
        totals.turns += Number(record.turnsByDay[day]) || 0;
        totals.toolCalls += Number(record.toolCallsByDay?.[day]) || 0;
      }
    }
    addTokens(totals, inRange);

    for (const [modelName, tokens] of inRangeModels) {
      // Sum across records: several sessions of one model must accumulate,
      // not overwrite — the cost chip, ModelBars and the per-model cost all
      // read this row, and the peak/off-peak splits ride along.
      const acc = models.get(modelName) ?? EMPTY_MODEL_ROW();
      addTokens(acc, tokens);
      addTokens(acc.peak, tokens.peak ?? EMPTY_TOKENS());
      addTokens(acc.offpeak, tokens.offpeak ?? EMPTY_TOKENS());
      models.set(modelName, acc);
    }
    const projectRow = projects.get(label) ?? { project: label === "" ? null : label, sessions: 0, ...EMPTY_TOKENS() };
    projectRow.sessions += 1;
    addTokens(projectRow, inRange);
    projects.set(label, projectRow);
  }

  // Cache-write tokens were cache misses: they belong in the denominator
  // (see cacheHitRateOf — the one definition both faces read).
  totals.cacheHitRate = cacheHitRateOf(totals);

  const modelsArr = [...models.entries()]
    .map(([modelName, tokens]) => ({ key: modelName, ...splitModelKey(modelName), ...tokens }))
    .sort((a, b) => (b.input + b.output + b.cacheRead) - (a.input + a.output + a.cacheRead));

  const projectsArr = [...projects.values()]
    .map((row) => ({ ...row, total: row.input + row.output + row.cacheRead + row.cacheWrite }))
    .sort((a, b) => b.total - a.total);

  const grandTotal = totals.input + totals.output + totals.cacheRead + totals.cacheWrite;
  /** The unpriced caveat, broken down by the id that has no rate — largest
   *  first, capped so a broken catalog cannot bloat the payload. This is what
   *  turns "348 token 未定价" into a name the user can go and price. */
  const unpricedModels = [...costAcc.unpricedBy.values()]
    .sort((a, b) => ((b.input + b.output) - (a.input + a.output)))
    .slice(0, 4)
    .map((row) => ({ ...row, total: row.input + row.output }));
  return {
    buckets,
    modelBuckets,
    bucketCosts,
    totals,
    models: modelsArr,
    projects: projectsArr,
    // Epoch-accurate window cost: every day priced under the official
    // schedule in effect, user rules overlaid — same numbers as the cost
    // trend panel's days sum to.
    cost: costAcc.configured
      ? {
        configured: true,
        total: Math.round(costAcc.total * 1e6) / 1e6,
        currency: "CNY",
        usdToCny,
        convertedFromUsd: Math.round(costAcc.converted * 1e6) / 1e6,
        unpriced: costAcc.unpriced,
        unpricedModels,
      }
      : { configured: false, total: null, currency: null, usdToCny, convertedFromUsd: 0, unpriced: costAcc.unpriced, unpricedModels },
    hasData: grandTotal > 0 || totals.sessions > 0,
    knownProjects: [...seenProjects].filter((p) => p !== "").sort(),
    knownModels: [...seenModels].sort(),
  };
}

/** `"peak"` | `"offpeak"` tier of an epoch-ms timestamp under a peak hour set
 *  (defaults to the official windows). Mirrors the host's fold-time tiering
 *  so event-level break segments price like the daily tiers. */
export function tierAtMs(timeMs, peakHours) {
  const hh = new Date(Number(timeMs) + BEIJING_OFFSET_MS).getUTCHours();
  const hours = Array.isArray(peakHours) ? peakHours : PEAK_HOURS;
  return hours.includes(hh) ? "peak" : "offpeak";
}

/**
 * GitHub-style heatmap layout over day-granularity buckets: cells aligned to
 * Monday-start weeks, padded with leading/trailing nulls so the grid always
 * covers whole weeks, plus the column index of each month's first day.
 *
 * @param {Array<{key: string}>} buckets - contiguous day buckets (from `rangeKeys("day", ...)`).
 * @returns {{cells: Array<object|null>, weeks: number, months: Array<{col: number, label: string}>}}
 */
export function heatmapCells(buckets) {
  const rows = Array.isArray(buckets) ? buckets : [];
  const first = rows[0]?.key;
  if (first === undefined) return { cells: [], weeks: 0, months: [] };
  const [y, m, d] = String(first).split("-").map(Number);
  const offset = (new Date(y, m - 1, d, 12).getDay() + 6) % 7; // Monday = 0
  const cells = [];
  for (let i = 0; i < offset; i += 1) cells.push(null);
  const months = [];
  rows.forEach((bucket, i) => {
    if (i === 0 || String(bucket.key).endsWith("-01")) {
      months.push({ col: cells.length, label: monthKey(bucket.key) });
    }
    cells.push(bucket);
  });
  while (cells.length % 7 !== 0) cells.push(null);
  return { cells, weeks: cells.length / 7, months };
}

/** Discrete intensity level (0-4) for one heatmap cell against the range max. */
export function heatmapLevel(value, max) {
  const v = Number(value) || 0;
  const m = Number(max) || 0;
  if (v <= 0 || m <= 0) return 0;
  const r = v / m;
  if (r < 0.25) return 1;
  if (r < 0.5) return 2;
  if (r < 0.75) return 3;
  return 4;
}

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
export function hourlySeries(sessions, day, { project = "", model = "", models = [] } = {}) {
  const hours = Array.from({ length: 24 }, (_, i) => ({ key: String(i).padStart(2, "0"), ...EMPTY_TOKENS() }));
  const modelSet = modelFilterSet(model, models);
  for (const record of Array.isArray(sessions) ? sessions : []) {
    if (record === null || typeof record !== "object") continue;
    if (project !== "" && String(record.project ?? "") !== project) continue;
    const dayHours = record.hoursByDay?.[day];
    if (dayHours === null || typeof dayHours !== "object") continue;
    for (const [key, byModel] of Object.entries(dayHours)) {
      const idx = Number(key);
      if (!Number.isInteger(idx) || idx < 0 || idx > 23) continue;
      if (byModel === null || typeof byModel !== "object") continue;
      for (const [modelName, tokens] of Object.entries(byModel)) {
        if (!keyMatchesFilter(modelSet, modelName)) continue;
        addTokens(hours[idx], tokens);
      }
    }
  }
  return hours;
}

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
export function hourlyCostSeries(sessions, day, { pricing = [], fx = {}, monthly = [], models = [], project = "" } = {}) {
  const hours = Array.from({ length: 24 }, (_, i) => ({ key: String(i).padStart(2, "0"), cost: 0, peak: 0, offpeak: 0 }));
  let unpricedTokens = 0;
  if (typeof day !== "string" || /^\d{4}-\d{2}-\d{2}$/.test(day) === false) return { hours, unpricedTokens };
  const modelSet = modelFilterSet("", models);
  const maps = epochRulesOn(pricing)(day);
  const monthlySet = new Set(Array.isArray(monthly) ? monthly : []);
  const usdToCny = Number(fx?.usdToCny) > 0 ? Number(fx.usdToCny) : DEFAULT_USD_TO_CNY;
  const dayMs = quotaDayStart(day);
  const priceHour = (idx, modelName, tokens) => {
    const provider = splitModelKey(modelName).provider;
    if (monthlySet.has(provider)) return;
    const rule = ruleFor(maps, modelName);
    if (rule === undefined) {
      unpricedTokens += (tokens.input || 0) + (tokens.cacheRead || 0) + (tokens.cacheWrite || 0) + (tokens.output || 0);
      return;
    }
    const rates = resolveRates(rule);
    const conv = rule.currency === "USD" ? usdToCny : 1;
    const flatOff = rule.weekdaysOnly !== false && isOffPeakDay(day);
    // An hour bucket is single-tier: the whole bucket prices at its own
    // schedule, no peak/off-peak split inside the bucket.
    const tier = flatOff ? "offpeak" : tierAtMs(dayMs + idx * 3600000 + 1800000, rule.peakHours);
    const cost = priceTier(tokens, rates, tier) * conv;
    hours[idx].cost += cost;
    if (tier === "peak") hours[idx].peak += cost;
    else hours[idx].offpeak += cost;
  };
  for (const record of Array.isArray(sessions) ? sessions : []) {
    if (record === null || typeof record !== "object") continue;
    if (project !== "" && String(record.project ?? "") !== project) continue;
    const dayHours = record.hoursByDay?.[day];
    if (dayHours === null || typeof dayHours !== "object") continue;
    for (const [key, byModel] of Object.entries(dayHours)) {
      const idx = Number(key);
      if (!Number.isInteger(idx) || idx < 0 || idx > 23) continue;
      if (byModel === null || typeof byModel !== "object") continue;
      for (const [modelName, tokens] of Object.entries(byModel)) {
        if (tokens === null || typeof tokens !== "object") continue;
        if (!keyMatchesFilter(modelSet, modelName)) continue;
        priceHour(idx, modelName, tokens);
      }
    }
  }
  for (const hour of hours) {
    hour.cost = Math.round(hour.cost * 1e6) / 1e6;
    hour.peak = Math.round(hour.peak * 1e6) / 1e6;
    hour.offpeak = Math.round((hour.cost - hour.peak) * 1e6) / 1e6;
  }
  return { hours, unpricedTokens };
}

// --- Subscription quota estimation -------------------------------------------
//
// Subscription plans (coding plans, token plans) report quota as utilization
// percentages over rolling windows; they never expose absolute token counts.
// These helpers reconcile that server-side percentage with the usage dsh
// recorded locally: slice local per-provider tokens over the exact window
// span, calibrate the plan's total from the pair, forecast exhaustion from
// the utilization snapshot series, and attribute the burn to projects.
