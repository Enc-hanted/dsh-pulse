/**
 * dsh-pulse view model - pure, client-side aggregation of the windowed
 * per-session records served by `/pulse/stats` into chartable buckets
 * (day / week / month), filtered totals, per-model splits, cost estimates,
 * and the GitHub-style heatmap cells used by the 90-day / 1-year views.
 *
 * The same code is mirrored into the browser bundle (lib/client.js) because
 * a dsh client half is a single self-registering file that cannot require
 * node-side modules. `scripts/sync-mirror.mjs` regenerates the mirrored
 * region from this file and `test/mirror-test.mjs` fails on drift - edit
 * this file, then run `node scripts/sync-mirror.mjs`.
 *
 * @module dsh-pulse/view
 */

/** Local-timezone `YYYY-MM-DD` for a Unix epoch millisecond stamp. */
export function localDay(timeMs) {
  const d = new Date(timeMs);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Add (or subtract) whole days from a `YYYY-MM-DD` string, local time. */
export function shiftDay(day, delta) {
  const [y, m, d] = String(day).split("-").map(Number);
  return localDay(new Date(y, m - 1, d + delta, 12).getTime());
}

/** Days between two `YYYY-MM-DD` strings (inclusive, at least 1). */
export function daysBetween(from, to) {
  const [fy, fm, fd] = String(from).split("-").map(Number);
  const [ty, tm, td] = String(to).split("-").map(Number);
  const a = Date.UTC(fy, fm - 1, fd);
  const b = Date.UTC(ty, tm - 1, td);
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

/**
 * Normalize a custom date range: swap a reversed pair and trim an over-long
 * span to `maxDays` (default 30) by moving the start toward the end. Preset
 * ranges (90d/1y) are served by their own windows and skip this clamp.
 */
export function clampSpan(from, to, maxDays = 30) {
  let f = String(from);
  let t = String(to);
  if (f > t) { const swap = f; f = t; t = swap; }
  if (daysBetween(f, t) > maxDays) f = shiftDay(t, -(maxDays - 1));
  return { from: f, to: t };
}

/** Monday-start week key (`YYYY-MM-DD` of the week's Monday) for a day. */
export function weekStart(day) {
  const [y, m, d] = String(day).split("-").map(Number);
  const dow = (new Date(y, m - 1, d, 12).getDay() + 6) % 7; // Monday = 0
  return shiftDay(day, -dow);
}

/** Month key `YYYY-MM` for a day. */
export function monthKey(day) {
  return String(day).slice(0, 7);
}

/** Bucket key for one day under a granularity (`day` | `week` | `month`). */
export function bucketOf(granularity, day) {
  if (granularity === "week") return weekStart(day);
  if (granularity === "month") return monthKey(day);
  return day;
}

/** Contiguous bucket keys covering [`from`, `to`] under a granularity
 *  (capped to the most recent 400 buckets for chart readability). */
export function rangeKeys(granularity, from, to) {
  if (granularity === "month") {
    const [fy, fm] = String(from).split("-").map(Number);
    const [ty, tm] = String(to).split("-").map(Number);
    const end = ty * 12 + (tm - 1);
    const start = Math.max(fy * 12 + (fm - 1), end - 399);
    const keys = [];
    for (let m = start; m <= end; m += 1) {
      keys.push(`${Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, "0")}`);
    }
    return keys;
  }
  const step = granularity === "week" ? 7 : 1;
  // Count first, then keep the most recent ≤400 buckets ending at `to`.
  let count = 0;
  for (let cur = bucketOf(granularity, from); cur <= to; cur = shiftDay(cur, step)) {
    count += 1;
    if (step === 7 && shiftDay(cur, 6) >= to) break;
  }
  const capped = Math.min(count, 400);
  let startKey = bucketOf(granularity, shiftDay(to, -(capped - 1) * step));
  if (startKey < bucketOf(granularity, from)) startKey = bucketOf(granularity, from);
  const keys = [];
  for (let cur = startKey; cur <= to; cur = shiftDay(cur, step)) {
    keys.push(cur);
    if (step === 7 && shiftDay(cur, 6) >= to) break;
  }
  return keys;
}

/** Short human label for a bucket key (`MM-DD` for days, `YYYY-MM` for months). */
export function bucketLabel(key) {
  return key.length === 7 ? key : key.slice(5);
}

const EMPTY_TOKENS = () => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });

/** Per-model row: window totals plus the peak/off-peak tier split. */
const EMPTY_MODEL_ROW = () => ({ ...EMPTY_TOKENS(), peak: EMPTY_TOKENS(), offpeak: EMPTY_TOKENS() });

function addTokens(bucket, tokens) {
  bucket.input += tokens.input || 0;
  bucket.output += tokens.output || 0;
  bucket.cacheRead += tokens.cacheRead || 0;
  bucket.cacheWrite += tokens.cacheWrite || 0;
}

/** Fold one day's per-model tokens into a model row with its tier split.
 *  `tier` is the record's `tiersByDay[day][model]` split; a legacy record
 *  without one prices the whole day at the off-peak rates. */
function addDayModel(row, tokens, tier) {
  addTokens(row, tokens);
  if (tier === null || tier === undefined) {
    addTokens(row.offpeak, tokens);
    return;
  }
  for (const kind of ["input", "output", "cacheRead", "cacheWrite"]) {
    row.peak[kind] += tier[kind]?.peak || 0;
    row.offpeak[kind] += tier[kind]?.offpeak || 0;
  }
}

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
 * @param {Array<{model: string, input: number, cacheRead?: number, output: number, currency?: string, peak?: {input?: number, cacheRead?: number, output?: number}}>} [options.pricing]
 * @param {{usdToCny?: number}} [options.fx] - USD→CNY rate for the unified cost display.
 * @returns {{buckets: Array, totals: object, models: Array, projects: Array, cost: object, hasData: boolean, knownProjects: string[], knownModels: string[]}}
 */
export function buildView(sessions, { granularity = "day", from, to, project = "", model = "", pricing = [], fx = {} }) {
  const keys = rangeKeys(granularity, from, to);
  const index = new Map(keys.map((key, i) => [key, i]));
  const buckets = keys.map((key) => ({ key, sessions: 0, ...EMPTY_TOKENS() }));
  const totals = { sessions: 0, subagents: 0, turns: 0, toolCalls: 0, ...EMPTY_TOKENS() };
  const models = new Map();
  const projects = new Map();
  const seenProjects = new Set();
  const seenModels = new Set();
  const modelFilter = model === "" || model === null || model === undefined ? null : String(model);

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
      if (modelFilter === null) {
        // Unfiltered: day totals drive buckets/totals, per-model splits ride along.
        const dayTokens = byDay[day] ?? EMPTY_TOKENS();
        addTokens(inRange, dayTokens);
        const idx = index.get(bucketOf(granularity, day));
        if (idx !== undefined) addTokens(buckets[idx], dayTokens);
        if (dayModels === undefined) continue;
        for (const [modelName, tokens] of Object.entries(dayModels)) {
          const row = inRangeModels.get(modelName) ?? EMPTY_MODEL_ROW();
          addDayModel(row, tokens, record.tiersByDay?.[day]?.[modelName]);
          inRangeModels.set(modelName, row);
        }
      } else if (dayModels !== undefined && dayModels[modelFilter] !== undefined) {
        // Model-filtered: only the selected model's tokens flow anywhere,
        // so buckets, chips, projects and the cost chip all agree.
        const filtered = dayModels[modelFilter];
        addTokens(inRange, filtered);
        const idx = index.get(bucketOf(granularity, day));
        if (idx !== undefined) addTokens(buckets[idx], filtered);
        const row = inRangeModels.get(modelFilter) ?? EMPTY_MODEL_ROW();
        addDayModel(row, filtered, record.tiersByDay?.[day]?.[modelFilter]);
        inRangeModels.set(modelFilter, row);
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

  // Cache-write tokens were cache misses: they belong in the denominator,
  // so providers that report them (pi-ai) don't inflate the hit rate.
  const inputSide = totals.input + totals.cacheRead + totals.cacheWrite;
  totals.cacheHitRate = inputSide > 0 ? totals.cacheRead / inputSide : null;

  const modelsArr = [...models.entries()]
    .map(([modelName, tokens]) => ({ model: modelName, ...tokens }))
    .sort((a, b) => (b.input + b.output + b.cacheRead) - (a.input + a.output + a.cacheRead));

  const projectsArr = [...projects.values()]
    .map((row) => ({ ...row, total: row.input + row.output + row.cacheRead + row.cacheWrite }))
    .sort((a, b) => b.total - a.total);

  const grandTotal = totals.input + totals.output + totals.cacheRead + totals.cacheWrite;
  return {
    buckets,
    totals,
    models: modelsArr,
    projects: projectsArr,
    cost: costOf(modelsArr, pricing, fx),
    hasData: grandTotal > 0 || totals.sessions > 0,
    knownProjects: [...seenProjects].filter((p) => p !== "").sort(),
    knownModels: [...seenModels].sort(),
  };
}

/** Resolved per-rule rates with all defaults applied (cache-hit falls back
 *  to the miss rate; peak rates fall back to the off-peak rates). */
function resolveRates(rule) {
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
function priceTier(tokens, rates, tier) {
  const input = tier === "peak" ? rates.peakInput : rates.offInput;
  const cache = tier === "peak" ? rates.peakCache : rates.offCache;
  const output = tier === "peak" ? rates.peakOutput : rates.offOutput;
  return ((tokens.input + tokens.cacheWrite) * input
    + tokens.cacheRead * cache
    + tokens.output * output) / 1e6;
}

/** One side of a tier split as a plain token bucket: the split nests each
 *  side inside every token kind (`{input: {peak, offpeak}, ...}`). */
const tierSide = (tier, side) => ({
  input: tier.input?.[side] || 0,
  output: tier.output?.[side] || 0,
  cacheRead: tier.cacheRead?.[side] || 0,
  cacheWrite: tier.cacheWrite?.[side] || 0,
});

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
 * @returns {{configured: boolean, total: number|null, currency: string|null, usdToCny: number, convertedFromUsd: number, unpriced: object}}
 */
export const DEFAULT_USD_TO_CNY = 6.8;

export function costOf(models, pricing, fx = {}) {
  const rate = new Map((Array.isArray(pricing) ? pricing : []).map((rule) => [rule.model, rule]));
  const usdToCny = Number(fx?.usdToCny) > 0 ? Number(fx.usdToCny) : DEFAULT_USD_TO_CNY;
  let total = 0;
  let converted = 0;
  let configured = false;
  const unpriced = EMPTY_TOKENS();
  for (const row of Array.isArray(models) ? models : []) {
    const rule = rate.get(row.model);
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
 * @returns {Array<{key: string, peak: number, offpeak: number}>} one entry per day, `total = peak + offpeak`.
 */
export function costSeries(sessions, { from, to, project = "", model = "", pricing = [], fx = {} }) {
  const rate = new Map((Array.isArray(pricing) ? pricing : []).map((rule) => [rule.model, rule]));
  const usdToCny = Number(fx?.usdToCny) > 0 ? Number(fx.usdToCny) : DEFAULT_USD_TO_CNY;
  const keys = rangeKeys("day", from, to);
  const index = new Map(keys.map((key, i) => [key, i]));
  const days = keys.map((key) => ({ key, peak: 0, offpeak: 0 }));
  const modelFilter = model === "" || model === null || model === undefined ? null : String(model);
  for (const record of Array.isArray(sessions) ? sessions : []) {
    if (record === null || typeof record !== "object") continue;
    if (project !== "" && String(record.project ?? "") !== project) continue;
    for (const [day, dayModels] of Object.entries(record.modelsByDay ?? {})) {
      const idx = index.get(day);
      if (idx === undefined || dayModels === null || typeof dayModels !== "object") continue;
      for (const [modelName, tokens] of Object.entries(dayModels)) {
        if (modelFilter !== null && modelName !== modelFilter) continue;
        const rule = rate.get(modelName);
        if (rule === undefined) continue;
        const rates = resolveRates(rule);
        const conv = rule.currency === "USD" ? usdToCny : 1;
        const tier = record.tiersByDay?.[day]?.[modelName];
        if (tier === null || tier === undefined) {
          days[idx].offpeak += priceTier(tokens, rates, "offpeak") * conv;
        } else {
          days[idx].peak += priceTier(tierSide(tier, "peak"), rates, "peak") * conv;
          days[idx].offpeak += priceTier(tierSide(tier, "offpeak"), rates, "offpeak") * conv;
        }
      }
    }
  }
  const round = (v) => Math.round(v * 1e6) / 1e6;
  return days.map((day) => ({ key: day.key, peak: round(day.peak), offpeak: round(day.offpeak) }));
}

/** Axis maximum rounded to a 1/2/5×10^k ceiling so gridlines read clean. */
export function niceMax(value) {
  if (!(value > 0)) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  for (const m of [1, 2, 5, 10]) {
    if (m * base >= value) return m * base;
  }
  return 10 * base;
}

/**
 * Cost formatting: whole amounts keep two decimals, sub-unit amounts keep
 * three significant digits (so `0.000278` stays readable instead of raw).
 */
export function fmtCost(total) {
  const v = Number(total) || 0;
  if (v >= 1) return v.toFixed(2);
  return String(Number(v.toPrecision(3)));
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
export function hourlySeries(sessions, day, { project = "", model = "" } = {}) {
  const hours = Array.from({ length: 24 }, (_, i) => ({ key: String(i).padStart(2, "0"), ...EMPTY_TOKENS() }));
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
        if (model !== "" && modelName !== model) continue;
        addTokens(hours[idx], tokens);
      }
    }
  }
  return hours;
}
