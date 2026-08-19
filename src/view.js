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

/** Separator between provider and model in composite model keys. Model ids
 *  are printable, so a NUL can never appear inside a bare key — a composite
 *  key is unambiguous against a legacy provider-less one. */
export const MODEL_SEP = "\u0000";

/** Composite model key `provider\u0000model`; a missing provider yields the
 *  bare model id (the legacy shape). Same-named models from different
 *  providers stay distinct in the per-model maps while provider-less records
 *  (older events/hosts) keep folding under their bare id. */
export function modelKey(provider, model) {
  const p = typeof provider === "string" && provider.length > 0 ? provider : "";
  const m = typeof model === "string" && model.length > 0 ? model : "unknown";
  return p === "" ? m : `${p}${MODEL_SEP}${m}`;
}

/** Split a (possibly composite) model key into its `{provider, model}` parts;
 *  a bare key reports an empty provider. */
export function splitModelKey(key) {
  const k = String(key);
  const idx = k.indexOf(MODEL_SEP);
  return idx === -1 ? { provider: "", model: k } : { provider: k.slice(0, idx), model: k.slice(idx + MODEL_SEP.length) };
}

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
 * @param {string[]} [options.monthly] - provider ids billed as a flat monthly
 *   subscription; their models cost 0 (configured, never "unpriced").
 * @returns {{buckets: Array, totals: object, models: Array, projects: Array, cost: object, hasData: boolean, knownProjects: string[], knownModels: string[]}}
 */
export function buildView(sessions, { granularity = "day", from, to, project = "", model = "", pricing = [], fx = {}, monthly = [] }) {
  const keys = rangeKeys(granularity, from, to);
  const index = new Map(keys.map((key, i) => [key, i]));
  const buckets = keys.map((key) => ({ key, sessions: 0, ...EMPTY_TOKENS() }));
  const totals = { sessions: 0, subagents: 0, turns: 0, toolCalls: 0, ...EMPTY_TOKENS() };
  const models = new Map();
  const projects = new Map();
  const seenProjects = new Set();
  const seenModels = new Set();
  const modelFilter = model === "" || model === null || model === undefined ? null : String(model);
  const filterComposite = modelFilter !== null && modelFilter.includes(MODEL_SEP);

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
      } else {
        // Model-filtered: only the selected model's tokens flow anywhere,
        // so buckets, chips, projects and the cost chip all agree. A
        // composite filter targets one provider's row; a bare (legacy)
        // filter covers every row whose model id matches.
        const matched = filterComposite
          ? (dayModels !== undefined && dayModels[modelFilter] !== undefined ? [modelFilter] : [])
          : Object.keys(dayModels ?? {}).filter((key) => key === modelFilter || splitModelKey(key).model === modelFilter);
        for (const key of matched) {
          const filtered = dayModels[key];
          addTokens(inRange, filtered);
          const idx = index.get(bucketOf(granularity, day));
          if (idx !== undefined) addTokens(buckets[idx], filtered);
          const row = inRangeModels.get(key) ?? EMPTY_MODEL_ROW();
          addDayModel(row, filtered, record.tiersByDay?.[day]?.[key]);
          inRangeModels.set(key, row);
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

  // Cache-write tokens were cache misses: they belong in the denominator,
  // so providers that report them (pi-ai) don't inflate the hit rate.
  const inputSide = totals.input + totals.cacheRead + totals.cacheWrite;
  totals.cacheHitRate = inputSide > 0 ? totals.cacheRead / inputSide : null;

  const modelsArr = [...models.entries()]
    .map(([modelName, tokens]) => ({ key: modelName, ...splitModelKey(modelName), ...tokens }))
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
    cost: costOf(modelsArr, pricing, fx, monthly),
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

/** Split pricing rules for provider-aware lookup: `exact` maps
 *  `provider\u0000model` keys (rules with a provider), `wild` maps bare model
 *  ids (rules that price any provider's model of that id — the official
 *  defaults, and every rule from before providers existed). */
function ruleMaps(pricing) {
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
function ruleFor(maps, key) {
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
export const DEFAULT_USD_TO_CNY = 6.8;

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
export function costSeries(sessions, { from, to, project = "", model = "", pricing = [], fx = {}, monthly = [] }) {
  const maps = ruleMaps(pricing);
  const monthlySet = new Set(Array.isArray(monthly) ? monthly : []);
  const usdToCny = Number(fx?.usdToCny) > 0 ? Number(fx.usdToCny) : DEFAULT_USD_TO_CNY;
  const keys = rangeKeys("day", from, to);
  const index = new Map(keys.map((key, i) => [key, i]));
  const days = keys.map((key) => ({ key, peak: 0, offpeak: 0 }));
  const modelFilter = model === "" || model === null || model === undefined ? null : String(model);
  const filterComposite = modelFilter !== null && modelFilter.includes(MODEL_SEP);
  for (const record of Array.isArray(sessions) ? sessions : []) {
    if (record === null || typeof record !== "object") continue;
    if (project !== "" && String(record.project ?? "") !== project) continue;
    for (const [day, dayModels] of Object.entries(record.modelsByDay ?? {})) {
      const idx = index.get(day);
      if (idx === undefined || dayModels === null || typeof dayModels !== "object") continue;
      for (const [modelName, tokens] of Object.entries(dayModels)) {
        if (modelFilter !== null) {
          const matches = filterComposite
            ? modelName === modelFilter
            : modelName === modelFilter || splitModelKey(modelName).model === modelFilter;
          if (!matches) continue;
        }
        // A flat monthly subscription contributes zero marginal cost.
        if (monthlySet.has(splitModelKey(modelName).provider)) continue;
        const rule = ruleFor(maps, modelName);
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

/** Default Beijing-time peak hours (official DeepSeek windows) — the fallback
 *  when a rule carries no `peakHours`. */
const PEAK_HOURS_DEFAULT = [9, 10, 11, 14, 15, 16, 17];
/** Fixed UTC+8 offset for peak-tier classification (Asia/Shanghai has no DST). */
const BEIJING_OFFSET_MS = 8 * 3600000;

/** `"peak"` | `"offpeak"` tier of an epoch-ms timestamp under a peak hour set
 *  (defaults to the official windows). Mirrors the host's fold-time tiering
 *  so event-level break segments price like the daily tiers. */
function tierAtMs(timeMs, peakHours) {
  const hh = new Date(Number(timeMs) + BEIJING_OFFSET_MS).getUTCHours();
  const hours = Array.isArray(peakHours) ? peakHours : PEAK_HOURS_DEFAULT;
  return hours.includes(hh) ? "peak" : "offpeak";
}

/** `MM-DD HH:MM:SS` short stamp for an epoch-ms value (break ruler labels). */
export function fmtClockMs(timeMs) {
  const d = new Date(Number(timeMs) || 0);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Fold one record's per-day per-model tokens into the model-row shape the
 *  cost estimator expects (cross-day totals + peak/off-peak tier split). */
export function sessionModelRows(record) {
  const models = new Map();
  for (const [day, dayModels] of Object.entries(record?.modelsByDay ?? {})) {
    if (dayModels === null || typeof dayModels !== "object") continue;
    for (const [modelName, tokens] of Object.entries(dayModels)) {
      const row = models.get(modelName) ?? EMPTY_MODEL_ROW();
      addDayModel(row, tokens, record?.tiersByDay?.[day]?.[modelName]);
      models.set(modelName, row);
    }
  }
  return [...models.entries()]
    .map(([modelName, tokens]) => ({ key: modelName, ...splitModelKey(modelName), ...tokens }))
    .sort((a, b) => (b.input + b.output + b.cacheRead) - (a.input + a.output + a.cacheRead));
}

/** Windowed token totals of one record (its `byDay` is already window-sliced). */
function recordTokens(record) {
  const out = EMPTY_TOKENS();
  for (const dayTokens of Object.values(record?.byDay ?? {})) {
    if (dayTokens === null || typeof dayTokens !== "object") continue;
    addTokens(out, dayTokens);
  }
  return out;
}

/** Sum one model-row list's token buckets (the selected-model view). */
function foldModelTokens(models) {
  const out = EMPTY_TOKENS();
  for (const row of Array.isArray(models) ? models : []) {
    if (row === null || typeof row !== "object") continue;
    addTokens(out, row);
  }
  return out;
}

/** All catalog providers that serve a model id (by id or display name),
 *  deduplicated in catalog order. A provider-less (bare-key) row can then
 *  line up with the monthly-paid route — legacy events / adapters that omit
 *  the provider still price as monthly. */
function catalogProviders(catalog, modelId) {
  const out = [];
  for (const group of Array.isArray(catalog) ? catalog : []) {
    if (group === null || typeof group !== "object") continue;
    const has = (Array.isArray(group.models) ? group.models : []).some((m) => m !== null && typeof m === "object"
      && (m.id === modelId || (typeof m.name === "string" && m.name === modelId)));
    if (!has) continue;
    if (group.provider !== null && group.provider !== undefined && !out.includes(group.provider)) out.push(group.provider);
  }
  return out;
}

/** Resolve a provider-less model row's provider: the single catalog route
 *  that serves it, else — when several routes serve the same model id but
 *  exactly one of them is monthly-paid — that monthly route. `""` when
 *  unresolved (absent or ambiguous and no monthly tie-break). */
function resolveProviderFor(catalog, modelId, monthlySet) {
  const candidates = catalogProviders(catalog, modelId);
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1 && typeof monthlySet?.has === "function") {
    const monthly = candidates.filter((p) => monthlySet.has(p));
    if (monthly.length === 1) return monthly[0];
  }
  return "";
}

/**
 * Session list grouped by project — the session panel's data source. Each
 * session row carries its windowed token totals, tier-aware cost (through
 * the same estimator the dashboard uses), identity fields (`subagent`,
 * `parentSession`, `delegationDepth`) and its dominant model. Each group
 * adds the subagent subtotal (count, tokens, cost) so "project × subagent"
 * reads at a glance.
 *
 * @param {Array<object>} sessions - payload session records.
 * @param {object} options - `{pricing, fx, monthly, model, catalog}` for cost
 *   estimation and an optional model filter (composite key or bare id). With
 *   `model` set, each session counts only that model's rows — sessions that
 *   never used the model drop out entirely, so the project-detail panel never
 *   surfaces other models' sessions. `catalog` (the model config) lets
 *   provider-less rows resolve their provider for monthly/cost matching.
 * @returns {Array<object>} groups sorted by total tokens descending.
 */
export function sessionGroups(sessions, { pricing = [], fx = {}, monthly = [], model = "", catalog = null } = {}) {
  const modelFilter = model === "" || model === null || model === undefined ? null : String(model);
  const filterComposite = modelFilter !== null && modelFilter.includes(MODEL_SEP);
  const matchesModel = (row) => {
    if (modelFilter === null) return true;
    return filterComposite ? row.key === modelFilter : (row.key === modelFilter || row.model === modelFilter);
  };
  const monthlySet = new Set(Array.isArray(monthly) ? monthly : []);
  /** Backfill a provider-less row's provider from the catalog (unique route),
   *  so monthly-paid and cost matching work for bare-key legacy events. */
  const resolveProvider = (row) => (row.provider !== "" ? row.provider : resolveProviderFor(catalog, row.model, monthlySet));
  const allMonthly = (rows) => rows.length > 0 && rows.every((m) => monthlySet.has(resolveProvider(m)));
  const byProject = new Map();
  for (const record of Array.isArray(sessions) ? sessions : []) {
    if (record === null || typeof record !== "object") continue;
    const allModels = sessionModelRows(record);
    const models = modelFilter === null ? allModels : allModels.filter(matchesModel);
    if (models.length === 0 && modelFilter !== null) continue; // never used the selected model
    for (const m of models) if (m.provider === "") m.provider = resolveProvider(m);
    // Unfiltered rows keep their byDay totals (tolerates records without
    // per-model maps); a filtered row sums only the selected model's tokens.
    const tokens = modelFilter === null ? recordTokens(record) : foldModelTokens(models);
    const total = tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite;
    // A session with no countable usage (no tokens, no model rows) is a shell
    // — drop it, the detail panel lists actual consumption only.
    if (total <= 0 && models.length === 0) continue;
    const label = record.project === null || record.project === undefined ? "" : String(record.project);
    let group = byProject.get(label);
    if (group === undefined) {
      group = {
        project: label === "" ? null : label,
        sessions: [], mainSessions: 0, subagentSessions: 0,
        tokens: EMPTY_TOKENS(), subagentTokens: EMPTY_TOKENS(),
        models: [], subagentModels: [],
      };
      byProject.set(label, group);
    }
    const cost = costOf(models, pricing, fx, monthly);
    const subagent = record.subagent === true;
    // Per-model breakdown of this session: one row per model with its own
    // tokens and cost, so a mixed session's price lands under the right
    // model (a monthly-paid model never hides under the top model's name).
    const modelRows = models.map((m) => ({
      key: m.key,
      provider: m.provider,
      model: m.model,
      tokens: { input: m.input, output: m.output, cacheRead: m.cacheRead, cacheWrite: m.cacheWrite },
      cost: costOf([m], pricing, fx, monthly),
      monthly: monthlySet.has(m.provider),
    }));
    const row = {
      id: record.id ?? null,
      createdAt: record.createdAt ?? null,
      day: record.day ?? null,
      subagent,
      parentSession: record.parentSession ?? null,
      delegationDepth: record.delegationDepth ?? 0,
      tokens,
      cost,
      topModel: models[0]?.key ?? null,
      monthly: allMonthly(models),
      modelRows,
    };
    group.sessions.push(row);
    addTokens(group.tokens, tokens);
    group.models.push(...models);
    if (subagent) {
      group.subagentSessions += 1;
      addTokens(group.subagentTokens, tokens);
      group.subagentModels.push(...models);
    } else {
      group.mainSessions += 1;
    }
  }
  const groups = [...byProject.values()].map((g) => ({
    project: g.project,
    sessions: g.sessions,
    mainSessions: g.mainSessions,
    subagentSessions: g.subagentSessions,
    tokens: g.tokens,
    subagentTokens: g.subagentTokens,
    cost: costOf(g.models, pricing, fx, monthly),
    subagentCost: g.subagentSessions > 0 ? costOf(g.subagentModels, pricing, fx, monthly) : null,
    subagentMonthly: g.subagentSessions > 0 ? allMonthly(g.subagentModels) : false,
    total: g.tokens.input + g.tokens.output + g.tokens.cacheRead + g.tokens.cacheWrite,
  }));
  return groups.sort((a, b) => b.total - a.total);
}

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
 * @param {object} options - `{pricing, fx, monthly, model}` for cost
 *   estimation; `model` (composite key or bare id) restricts every segment to
 *   that model's events, so a model-filtered break analysis never shows
 *   other models' consumption. `catalog` (the model config) lets provider-less
 *   events resolve their provider for monthly/cost matching.
 * @returns {Array<{from: number, to: number, tokens: object, cost: object, models: Array}>}
 */
export function breaksSegments(events, breaks, { pricing = [], fx = {}, monthly = [], model = "", catalog = null } = {}) {
  const modelFilter = model === "" || model === null || model === undefined ? null : String(model);
  const filterComposite = modelFilter !== null && modelFilter.includes(MODEL_SEP);
  const list = (Array.isArray(events) ? events : [])
    .filter((e) => e !== null && typeof e === "object" && Number.isFinite(e.t)
      && (modelFilter === null
        || (filterComposite ? e.key === modelFilter : (e.key === modelFilter || splitModelKey(e.key).model === modelFilter))));
  if (list.length === 0) return [];
  list.sort((a, b) => a.t - b.t);
  const minT = list[0].t;
  const maxT = list[list.length - 1].t;
  const marks = (Array.isArray(breaks) ? breaks : [])
    .filter((t) => Number.isFinite(t) && t > minT && t < maxT)
    .sort((a, b) => a - b)
    .slice(0, 3);
  const bounds = [minT, ...marks, maxT];
  const maps = ruleMaps(pricing);
  const monthlySet = new Set(Array.isArray(monthly) ? monthly : []);
  const segments = [];
  for (let i = 0; i < bounds.length - 1; i += 1) {
    const from = bounds[i];
    const to = bounds[i + 1];
    const last = i === bounds.length - 2;
    const models = new Map();
    const tokens = EMPTY_TOKENS();
    for (const e of list) {
      if (e.t < from) continue;
      if (i > 0 && e.t === from) continue; // the break instant belongs to the earlier segment
      if (e.t > to) break;
      // Timeline events carry the compact `i/o/cr/cw` fields — normalize to
      // the full token bucket once so every accumulator reads the same shape.
      const bucket = { input: e.i || 0, output: e.o || 0, cacheRead: e.cr || 0, cacheWrite: e.cw || 0 };
      addTokens(tokens, bucket);
      const row = models.get(e.key) ?? EMPTY_MODEL_ROW();
      addTokens(row, bucket);
      const rule = ruleFor(maps, e.key);
      addTokens(row[tierAtMs(e.t, rule?.peakHours)], bucket);
      models.set(e.key, row);
    }
    const modelsArr = [...models.entries()]
      .map(([modelName, tokens]) => {
        const row = { key: modelName, ...splitModelKey(modelName), ...tokens };
        // Provider-less (bare-key) events resolve their provider from the
        // catalog (unique route, or the single monthly-paid route when the
        // same model id is served by several providers) so monthly-paid
        // segments price correctly.
        if (row.provider === "") row.provider = resolveProviderFor(catalog, row.model, monthlySet);
        return row;
      })
      .sort((a, b) => (b.input + b.output + b.cacheRead) - (a.input + a.output + a.cacheRead));
    // All-monthly segments bill no marginal cost: the UI shows the badge
    // instead of a bogus 0.00 price (mirrors the session rows).
    const allMonthly = modelsArr.length > 0 && modelsArr.every((m) => monthlySet.has(m.provider));
    segments.push({ from, to, tokens, cost: costOf(modelsArr, pricing, fx, monthly), models: modelsArr, monthly: allMonthly });
  }
  return segments;
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
  const modelFilter = model === "" || model === null || model === undefined ? null : String(model);
  const filterComposite = modelFilter !== null && modelFilter.includes(MODEL_SEP);
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
        if (modelFilter !== null) {
          const matches = filterComposite
            ? modelName === modelFilter
            : modelName === modelFilter || splitModelKey(modelName).model === modelFilter;
          if (!matches) continue;
        }
        addTokens(hours[idx], tokens);
      }
    }
  }
  return hours;
}
