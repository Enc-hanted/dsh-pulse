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

import { PEAK_HOURS, BEIJING_OFFSET_MS } from "./pricing-facts.js";

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
/** Accumulate one model's day tokens into a bucket row of the per-day
 *  per-model matrix (`modelBuckets` inside {@link buildView}). The row keeps
 *  the peak/off-peak tier split so each day can price under the official
 *  schedule that was in effect. */
function addModelBucket(dayMatrix, modelName, tokens, tier) {
  const acc = dayMatrix.get(modelName) ?? EMPTY_MODEL_ROW();
  addDayModel(acc, tokens, tier);
  dayMatrix.set(modelName, acc);
}

/** Official DeepSeek API price schedules for the built-in deepseek-* models,
 *  most recent first — a usage day prices under the first schedule whose
 *  `from` is <= that day, so historical windows reprice at the rates that
 *  were actually in effect instead of today's. Numbers are CNY per million
 *  tokens, transcribed from the official pricing page and release notes
 *  (api-docs.deepseek.com: V4-Pro GA 2026-08-13 introduced peak/off-peak
 *  billing effective 2026-08-17; V4.1-Flash release 2026-09-10 cut the Flash
 *  rates). Extend the array when DeepSeek changes prices again. */
export const OFFICIAL_PRICE_SCHEDULES = [
  {
    from: "2026-09-10",
    rules: [
      { model: "deepseek-flash", input: 1, cacheRead: 0.02, output: 4,
        peak: { input: 2, cacheRead: 0.04, output: 8 }, peakHours: [...PEAK_HOURS], weekdaysOnly: true, currency: "CNY" },
      { model: "deepseek-v4-pro", input: 4.5, cacheRead: 0.15, output: 13.5,
        peak: { input: 9, cacheRead: 0.3, output: 27 }, peakHours: [...PEAK_HOURS], weekdaysOnly: true, currency: "CNY" },
    ],
  },
  {
    from: "2026-08-17",
    rules: [
      { model: "deepseek-v4-flash", input: 1.5, cacheRead: 0.05, output: 4.5,
        peak: { input: 3, cacheRead: 0.1, output: 9 }, peakHours: [...PEAK_HOURS], weekdaysOnly: true, currency: "CNY" },
      { model: "deepseek-v4-flash-vision-exp", input: 1.5, cacheRead: 0.05, output: 4.5,
        peak: { input: 3, cacheRead: 0.1, output: 9 }, peakHours: [...PEAK_HOURS], weekdaysOnly: true, currency: "CNY" },
      { model: "deepseek-v4-pro", input: 4.5, cacheRead: 0.15, output: 13.5,
        peak: { input: 9, cacheRead: 0.3, output: 27 }, peakHours: [...PEAK_HOURS], weekdaysOnly: true, currency: "CNY" },
    ],
  },
];

/** The official rules a given usage day billed under (empty before the first
 *  schedule — the V3.2-era flat pricing that predates peak/off-peak is not
 *  modeled; those days fall back to user rules or the unpriced note). */
export function officialRulesFor(day) {
  for (const schedule of OFFICIAL_PRICE_SCHEDULES) {
    if (day >= schedule.from) return schedule.rules;
  }
  return [];
}

/** Estimate rules for usage days that predate a model's billing-effective
 *  date (the GA gap: a model can ship and see real use before its schedule
 *  `from` arrives) and for models later dropped from the current schedule —
 *  a published price is historical fact and stays usable for estimates
 *  forever. Every official rule ever published, keyed by model, keeping the
 *  EARLIEST schedule vintage (the rates closest to the usage era) and tagged
 *  `estimatedFrom` so callers can label the money honestly. Models the day's
 *  own schedule already prices are excluded; callers order these BEFORE the
 *  day's rules so the billing-accurate schedule and user rules always win
 *  (ruleMaps is last-write-wins). */
export function officialEstimateRulesFor(day) {
  const covered = new Set(officialRulesFor(day).map((rule) => rule.model));
  const out = new Map();
  for (let i = OFFICIAL_PRICE_SCHEDULES.length - 1; i >= 0; i -= 1) {
    const schedule = OFFICIAL_PRICE_SCHEDULES[i];
    for (const rule of schedule.rules) {
      if (covered.has(rule.model) || out.has(rule.model)) continue;
      out.set(rule.model, { ...rule, estimatedFrom: schedule.from });
    }
  }
  return [...out.values()];
}

/** THE assembly order, declared once: the user overlay always rides ON TOP
 *  of the official day schedule, and the full layer underlays the GA-gap
 *  estimate vintage beneath it. The TUI, the golden test and any future face
 *  build their pricing through these two — never inline the spread order
 *  again. */
export function strictRulesWith(day, user) {
  return [...officialRulesFor(day), ...user];
}

export function fullRulesWith(day, user) {
  return [...officialEstimateRulesFor(day), ...officialRulesFor(day), ...user];
}

/** Chinese public holidays (State Council calendar) — official billing keeps
 *  the whole day off-peak on these dates even when they fall on weekdays.
 *  Extend the set as new years are announced. */
const CN_HOLIDAYS = new Set([
  "2025-01-01", "2025-01-28", "2025-01-29", "2025-01-30", "2025-01-31", "2025-02-01", "2025-02-02", "2025-02-03", "2025-02-04",
  "2025-04-04", "2025-04-05", "2025-04-06",
  "2025-05-01", "2025-05-02", "2025-05-03", "2025-05-04", "2025-05-05",
  "2025-05-31", "2025-06-01", "2025-06-02",
  "2025-10-01", "2025-10-02", "2025-10-03", "2025-10-04", "2025-10-05", "2025-10-06", "2025-10-07", "2025-10-08",
  "2026-01-01", "2026-01-02", "2026-01-03",
  "2026-02-15", "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19", "2026-02-20", "2026-02-21",
  "2026-04-04", "2026-04-05", "2026-04-06",
  "2026-05-01", "2026-05-02", "2026-05-03", "2026-05-04", "2026-05-05",
  "2026-06-19", "2026-06-20", "2026-06-21",
  "2026-09-25", "2026-09-26", "2026-09-27",
  "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07",
  "2027-01-01", "2027-01-02", "2027-01-03",
]);

/** True when the day bills entirely at off-peak rates: weekends and Chinese
 *  public holidays under the official weekday-only peak windows. */
export function isOffPeakDay(day) {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return weekday === 0 || weekday === 6 || CN_HOLIDAYS.has(day);
}

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

/** The auxiliary-call pseudo model (official `web_search` / title LLM).
 *  Locally only the request count exists — no usage event — so its tokens
 *  are shape-derived ESTIMATES (single-call shape measured against the
 *  official bill, 2026-09-29: miss 8k / hit 1.5k / output 1k) and every
 *  surface labels the row as 估算. The shape is the SEED of the view's
 *  self-calibration ({@link auxCalibration}); a deployment's learned or
 *  manually configured shape replaces it through `buildView`'s `auxShape`. */
export const AUX_MODEL_KEY = "web-search";
export const AUX_SHAPE = { miss: 8000, hit: 1500, out: 1000 };

/** Defensive copy/validate of an aux shape: finite non-negative amounts with
 *  sane bounds, `null` when unusable (the seed then applies). */
function auxShapeOf(value) {
  if (value === null || typeof value !== "object") return null;
  const pick = (v, max) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
  };
  const miss = pick(value.miss, 5e5);
  const hit = pick(value.hit, 5e5);
  const out = pick(value.out, 1e5);
  if (miss === null && hit === null && out === null) return null;
  const seed = AUX_SHAPE;
  return { miss: miss ?? seed.miss, hit: hit ?? seed.hit, out: out ?? seed.out };
}

/**
 * Multi-select model filter: `models` (a non-empty id list) wins; the legacy
 * single `model` string is its one-element form; empty everywhere = `null`
 * (= no filter, everything matches). A Set matches a composite key either by
 * exact entry or by a bare model-id member covering every provider's row of
 * that id — the same semantics the single filter had, generalized.
 */
export function modelFilterSet(model, models) {
  const list = (Array.isArray(models) ? models : [])
    .filter((m) => typeof m === "string" && m !== "");
  if (list.length > 0) return new Set(list);
  return model === "" || model === null || model === undefined ? null : new Set([String(model)]);
}

/** Does one (possibly composite) model key pass the filter set? */
export function keyMatchesFilter(set, key) {
  if (set === null) return true;
  const raw = String(key);
  const split = splitModelKey(raw);
  return set.has(raw) || set.has(split.model) || set.has(rollupKeyOf(split.provider, split.model));
}

// --- provider route families --------------------------------------------------
// One physical DeepSeek account wears several route ids: the hand-entered API
// route (`deepseek-official`) and the one the desktop client adds by itself
// once an account is signed in (`deepseek-account`). They bill the same
// balance, so the balance-facing logic must treat them as one, the merged
// display shows one provider, and the per-route rows stay available
// (`rollupModelFamilies` returns them) for the day the two ever bill
// differently. Extend the table, nothing else: a family without
// `accountBalance` only affects labels, never the reconciliation.
export const ROUTE_FAMILIES = [
  { family: "deepseek", label: "DeepSeek", routes: ["deepseek-official", "deepseek-account"], accountBalance: true },
];

/** The family entry owning a provider route (`null` for a standalone route).
 *  The family id itself answers too — the display rollup keys rows by it, and
 *  those keys reach the filters and the official-channel checks. */
export function familyRouteOf(provider) {
  const route = typeof provider === "string" ? provider : "";
  if (route === "") return null;
  return ROUTE_FAMILIES.find((entry) => entry.family === route || entry.routes.includes(route)) ?? null;
}

/** Display label for a provider route: the family's when it has one. */
export function providerLabelOf(provider, fallback = "") {
  const entry = familyRouteOf(provider);
  if (entry !== null) return entry.label;
  return typeof provider === "string" && provider !== "" ? provider : fallback;
}

/** The provider the authenticated account bills: the empty (wildcard) provider
 *  and every account-balance family route. Everything else is third-party. */
export function isOfficialProvider(provider) {
  const route = typeof provider === "string" ? provider : "";
  if (route === "") return true;
  return familyRouteOf(route)?.accountBalance === true;
}

/** The composite key a row folds into for DISPLAY: family routes collapse onto
 *  the family (`deepseek\u0000deepseek-flash`), any other route keeps its own
 *  identity. Pricing never uses this — rules stay per route. */
export function rollupKeyOf(provider, model) {
  const entry = familyRouteOf(provider);
  return modelKey(entry === null ? provider : entry.family, model);
}
/** The model id the aux pseudo-model's requests BILL as (the search LLM rides
 *  the retired `deepseek-v4-flash` name, which the platform routes to
 *  `deepseek-flash`). ONE constant for the whole plugin: the aggregate fold
 *  classifies those events' peak tier under the same id ({@link import}ed by
 *  `aggregate.js`), so a platform rename is a one-line change everywhere. */
export const AUX_PRICE_AS = "deepseek-flash";

function addTokens(bucket, tokens) {
  bucket.input += tokens.input || 0;
  bucket.output += tokens.output || 0;
  bucket.cacheRead += tokens.cacheRead || 0;
  bucket.cacheWrite += tokens.cacheWrite || 0;
}

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
 * Expand one day's aux counters into billable token buckets, the single
 * source every cost surface shares ({@link buildView}, {@link costSeries},
 * {@link reconcileSeries}): search counts × the (calibrated) call shape,
 * title through its fold-time text-derived token estimates. Returns `null`
 * when the day carried no auxiliary calls.
 */
export function auxDayUsage(aux, shape) {
  const sPeak = aux?.search?.peak || 0;
  const sOff = aux?.search?.offpeak || 0;
  const tPeak = aux?.title?.peak || 0;
  const tOff = aux?.title?.offpeak || 0;
  const searchCalls = sPeak + sOff;
  const titleCalls = tPeak + tOff;
  if (searchCalls <= 0 && titleCalls <= 0) return null;
  const out = { searchCalls, titleCalls, searchTokens: null, searchTier: null, titleTokens: null, titleTier: null, titleKey: null };
  if (searchCalls > 0) {
    out.searchTokens = { input: shape.miss * searchCalls, cacheRead: shape.hit * searchCalls, output: shape.out * searchCalls, cacheWrite: 0 };
    out.searchTier = {
      input: { peak: shape.miss * sPeak, offpeak: shape.miss * sOff },
      cacheRead: { peak: shape.hit * sPeak, offpeak: shape.hit * sOff },
      output: { peak: shape.out * sPeak, offpeak: shape.out * sOff },
      cacheWrite: { peak: 0, offpeak: 0 },
    };
  }
  if (titleCalls > 0) {
    const inPeak = aux?.titleIn?.peak || 0;
    const inOff = aux?.titleIn?.offpeak || 0;
    const outPeak = aux?.titleOut?.peak || 0;
    const outOff = aux?.titleOut?.offpeak || 0;
    out.titleTokens = { input: inPeak + inOff, cacheRead: 0, output: outPeak + outOff, cacheWrite: 0 };
    out.titleTier = {
      input: { peak: inPeak, offpeak: inOff },
      cacheRead: { peak: 0, offpeak: 0 },
      output: { peak: outPeak, offpeak: outOff },
      cacheWrite: { peak: 0, offpeak: 0 },
    };
    out.titleKey = typeof aux?.titleKey === "string" && aux.titleKey !== "" ? aux.titleKey : null;
  }
  return out;
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

// --- per-model accent colors (deterministic across surfaces) -------------------

/** FNV-1a over the model id, salted. The salt (and the 9-step family
 *  gradient below) were chosen by scanning the ids deployments actually
 *  run: today's common sibling families land on distinct slots and the
 *  deepseek pair spans the gradient. Whatever else is present, an id's
 *  own slot never moves again — the same model wears the same color on
 *  every surface, in every window, in any order. */
export function accentHash(id, salt = 14) {
  let h = (0x811c9dc5 ^ salt) >>> 0;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Shortest angular distance between two hues. */
export function accentHueGap(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Vendor brand colors first — matched on the model id so `gpt-4o` hits
 *  OpenAI's tokens while `glm-5.3` never trips the short `o*` keys.
 *  Same-vendor siblings share one family spread between TWO anchors
 *  (`hex` → `soft`, hue and lightness together — the official-gradient
 *  trick: MiniMax's brand book pairs #FF3763→#FF7038 the same way), so
 *  every step stays saturated and clearly distinct even at dot size. */
const VENDOR_ACCENTS = [
  { keys: ["deepseek"], hex: "#4d6bfe", soft: "#00c2d8" },
  { keys: ["claude", "anthropic"], hex: "#d97757", soft: "#e8703a" },
  { keys: ["openai", "chatgpt", "gpt", "davinci", "o1", "o3", "o4"], hex: "#10a37f", soft: "#35c48d" },
  { keys: ["qwen", "qwq", "tongyi"], hex: "#847ace", soft: "#4796e4" },
  { keys: ["glm", "zhipu", "chatglm"], hex: "#2f6bff", soft: "#12b5a5" },
  { keys: ["minimax", "abab"], hex: "#ff3763", soft: "#ff7038" },
  { keys: ["grok", "xai"], hex: "#6e6d66", soft: "#c2c2bc" },
  { keys: ["mimo", "xiaomi"], hex: "#ff6900", soft: "#ffb02e" },
  { keys: ["llama", "meta"], hex: "#0668e1", soft: "#00a2ff" },
  { keys: ["gemini", "google", "gemma"], hex: "#1c69ff", soft: "#8ab4f8" },
  { keys: ["mistral", "mixtral", "codestral", "magistral"], hex: "#ff7000", soft: "#ffc400" },
  { keys: ["kimi", "moonshot", "k3"], hex: "#4b4b52", soft: "#9aa0aa" },
  { keys: ["hunyuan"], hex: "#0052d9", soft: "#26a5e2" },
  { keys: ["doubao", "skylark"], hex: "#4d53e8", soft: "#33c2ff" },
];

export function vendorAccentOf(id) {
  const tokens = id.split(/[^a-z0-9]+/);
  return VENDOR_ACCENTS.find((entry) => entry.keys.some((key) => (key.length >= 4 ? id.includes(key) : tokens.includes(key)))) ?? null;
}

/** Hue of a `#rgb`/`#rrggbb` anchor (0 when achromatic). */
function hexHue(hex) {
  const s = hex.replace("#", "");
  const v = s.length === 3 ? [...s].map((c) => c + c).join("") : s;
  const r = parseInt(v.slice(0, 2), 16) / 255;
  const g = parseInt(v.slice(2, 4), 16) / 255;
  const b = parseInt(v.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return ((h * 60) + 360) % 360;
}

/** sRGB hex → `[r, g, b]` in 0..1 (`#rgb` accepted). */
function hexRgb(hex) {
  const s = String(hex).replace("#", "");
  const v = s.length === 3 ? [...s].map((c) => c + c).join("") : s.padEnd(6, "0");
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
}

/** Encoded sRGB (0..1) → OKLab `[L, a, b]` — the perceptual space every
 *  colour decision below is measured in, so "distinguishable" is a measured
 *  number (ΔE) rather than a guess about hues. */
function srgbToLab(rgb) {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [lin(rgb[0]), lin(rgb[1]), lin(rgb[2])];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLCH (L 0..1, chroma, hue degrees) → OKLab. */
function oklchLab(l, c, hueDeg) {
  const rad = (hueDeg * Math.PI) / 180;
  return [l, c * Math.cos(rad), c * Math.sin(rad)];
}

/** OKLab → a CSS `oklch()` expression (used for resolved collision variants). */
function labToCss(lab) {
  const c = Math.hypot(lab[1], lab[2]);
  const hue = ((Math.atan2(lab[2], lab[1]) * 180) / Math.PI + 360) % 360;
  return `oklch(${(lab[0] * 100).toFixed(1)}% ${c.toFixed(3)} ${hue.toFixed(1)})`;
}

/** Perceptual distance between two OKLab triples (ΔE_ok). */
export function accentLabDistance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** The fixed anchor hues unknown-vendor hues must keep away from — a
 *  constant set, so the nudge never depends on co-present models. */
const VENDOR_ANCHOR_HUES = VENDOR_ACCENTS.flatMap((entry) => [hexHue(entry.hex), hexHue(entry.soft)]);

/** Steps on a vendor's brand gradient. */
const ACCENT_FAMILY_SLOTS = 9;

/** The aux pseudo-model's reserved hue — pinned to the mustard the
 *  dashboards have always shown it in, never reassigned to a family. */
const AUX_ACCENT_HUE = 80;
/** Diagonally striped paint: the aux row is an ESTIMATE, not a measured
 *  model, so it wears a texture no real family can be confused with — in
 *  colour and in the greyscale theme alike. Every surface paints accents
 *  through `background`, so a gradient fill needs no per-surface wiring. */
const stripeCss = (lab) => {
  const dark = [Math.max(0.2, lab[0] - 0.12), lab[1], lab[2]];
  return `repeating-linear-gradient(135deg, ${labToCss(lab)} 0 3px, ${labToCss(dark)} 3px 6px)`;
};
const AUX_ACCENT_LAB = oklchLab(0.68, 0.13, AUX_ACCENT_HUE);
const AUX_ACCENT_CSS = stripeCss(AUX_ACCENT_LAB);

/** Lightness offsets a resolved twin may step through. Measured: one step is
 *  ≈0.055 ΔE, so two steps clear even the tightest family gradient (Claude's
 *  two anchors sit only 0.035 apart end to end). */
const ACCENT_LUMA_STEPS = [0, 0.055, -0.055, 0.11, -0.11];
/** Hue lane width for unknown-vendor collisions. */
const ACCENT_HUE_STEP = 26;
/** Hue distance an unknown vendor's hashed hue keeps from every brand anchor. */
const ACCENT_ANCHOR_KEEP = 24;

/**
 * Resolution target (ΔE_ok): two auto colours closer than this read as one
 * swatch at dot size. Assignments maximise the distance to everything already
 * placed, so a family whose own gradient is shorter than the target still gets
 * its best available separation instead of a silent duplicate.
 */
export const ACCENT_MIN_DISTANCE = 0.07;

/** One model's canonical accent spec — the colour it wears with no sibling or
 *  route twin in sight. Pure per id, so it never moves between windows. */
function accentSpecOf(id) {
  const key = String(id).toLowerCase();
  if (key === AUX_MODEL_KEY) return { kind: "aux" };
  const vendor = vendorAccentOf(key);
  if (vendor !== null) return { kind: "vendor", vendor, slot: accentHash(key) % ACCENT_FAMILY_SLOTS };
  let hue = accentHash(key) % 360;
  for (let guard = 0; guard < 12 && VENDOR_ANCHOR_HUES.some((h) => accentHueGap(h, hue) < ACCENT_ANCHOR_KEEP); guard += 1) {
    hue = (hue + 137.508) % 360;
  }
  return { kind: "free", hue };
}

const vendorSlotCss = (vendor, slot) => {
  const pct = (slot / (ACCENT_FAMILY_SLOTS - 1)) * 100;
  return `color-mix(in srgb, ${vendor.hex} ${100 - pct}%, ${vendor.soft} ${pct}%)`;
};

const vendorSlotLab = (vendor, slot) => {
  const t = slot / (ACCENT_FAMILY_SLOTS - 1);
  const a = hexRgb(vendor.hex);
  const b = hexRgb(vendor.soft);
  return srgbToLab([0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t));
};

/** Canonical colour (CSS) and OKLab for one spec. */
function accentSpecPaint(spec) {
  if (spec.kind === "aux") return { css: AUX_ACCENT_CSS, lab: AUX_ACCENT_LAB };
  if (spec.kind === "vendor") return { css: vendorSlotCss(spec.vendor, spec.slot), lab: vendorSlotLab(spec.vendor, spec.slot) };
  return { css: `oklch(68% 0.13 ${spec.hue.toFixed(1)})`, lab: oklchLab(0.68, 0.13, spec.hue) };
}

/** Every colour this spec may take when it has to move out of the way,
 *  nearest-to-canonical first (strict `>` comparison in the picker therefore
 *  keeps the canonical paint on ties). */
function accentCandidates(spec) {
  const out = [];
  const push = (lab, css, rank) => out.push({ lab, css, rank });
  if (spec.kind === "aux") {
    const paint = accentSpecPaint(spec);
    push(paint.lab, paint.css, 0);
    return out;
  }
  if (spec.kind === "vendor") {
    for (let slot = 0; slot < ACCENT_FAMILY_SLOTS; slot += 1) {
      const base = vendorSlotLab(spec.vendor, slot);
      for (const dL of ACCENT_LUMA_STEPS) {
        const lab = dL === 0 ? base : [base[0] + dL, base[1], base[2]];
        push(lab, dL === 0 ? vendorSlotCss(spec.vendor, slot) : labToCss(lab), Math.abs(slot - spec.slot) + Math.abs(dL) * 10);
      }
    }
  } else {
    for (let lane = 0; lane <= 12; lane += 1) {
      const offset = Math.ceil(lane / 2) * ACCENT_HUE_STEP * (lane % 2 === 0 ? 1 : -1);
      const hue = (spec.hue + offset + 360) % 360;
      for (const dL of ACCENT_LUMA_STEPS) {
        const lab = oklchLab(0.68 + dL, 0.13, hue);
        push(lab, labToCss(lab), lane + Math.abs(dL) * 10);
      }
    }
  }
  out.sort((a, b) => a.rank - b.rank);
  return out;
}

/**
 * The stable auto color for one model id — a pure function of the id: vendor
 * families spread over their brand gradient by hashed slot, the aux
 * pseudo-model wears its reserved hue, unknown vendors hash to a hue nudged
 * off every brand anchor. {@link modelAccentMap} may still move a colour when a
 * co-visible twin would otherwise be identical; this is the canonical paint,
 * and the colour an unopposed model always wears.
 *
 * @param {string} id - bare model id (no provider prefix).
 * @returns {string} a CSS color expression.
 */
export function accentFillOf(id) {
  return accentSpecPaint(accentSpecOf(id)).css;
}

/**
 * The accent map for one visible model set: composite model key →
 * `{fill, custom, aux, lab, distance}`.
 *
 * Canonical colours come from {@link accentFillOf}. Because a family's own
 * gradient can be shorter than a visible difference (Claude's anchors sit
 * 0.035 ΔE apart, and several vendors' hashed slots land only 0.013 apart),
 * the set is then resolved: pinned colours first (user overrides keep their
 * hex, the aux pseudo-model its reserved gold), then the rest in key order,
 * each taking the candidate furthest from everything already placed. Set
 * membership therefore decides who has to move — exactly what a chart needs —
 * and within one set the result is deterministic, so no two rows of one chart
 * can wear the same swatch. `bw` runs the same resolution measured on
 * lightness alone, so the B&W theme gets a grey ladder instead of one flat
 * grey. Entries are keyed by composite model key; {@link accentEntryOf} is the
 * provider-aware lookup.
 *
 * @param {Array<{model?: string, key?: string, provider?: string}>} models - rows or ids.
 * @param {Record<string, string>} [overrides] - model id → hex color.
 * @param {{bw?: boolean}} [options] - `bw` resolves for the greyscale theme.
 * @returns {Map<string, {fill: string, custom: boolean, aux: boolean, lab: number[], distance: number}>}
 */
export function modelAccentMap(models, overrides, { bw = false } = {}) {
  const colorRe = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
  const entries = [];
  const seen = new Set();
  for (const row of Array.isArray(models) ? models : []) {
    const id = String(row?.model ?? row?.key ?? "");
    if (id === "" || id === "unknown") continue;
    const rawKey = row?.key === undefined ? "" : String(row.key);
    const provider = typeof row?.provider === "string"
      ? row.provider
      : (rawKey.includes("\u0000") ? splitModelKey(rawKey).provider : "");
    const key = rawKey.includes("\u0000") ? rawKey : modelKey(provider, id);
    if (seen.has(key)) continue;
    seen.add(key);
    const raw = overrides?.[id];
    const custom = typeof raw === "string" && colorRe.test(raw.trim()) ? raw.trim().toLowerCase() : null;
    entries.push({
      key,
      spec: custom === null ? accentSpecOf(id) : null,
      custom,
      customLab: custom === null ? null : srgbToLab(hexRgb(custom)),
    });
  }
  const project = (lab) => (bw === true ? [lab[0], 0, 0] : lab);
  const placed = [];
  const out = new Map();
  const place = (entry, css, lab, distance) => {
    placed.push(project(lab));
    // The B&W theme emits the resolved lightness as a grey, so the ladder the
    // resolution built survives into the rendered swatch instead of being
    // flattened afterwards by a one-size-fits-all desaturation.
    const paint = bw === true && entry.custom === null
      ? (entry.spec?.kind === "aux" ? stripeCss([lab[0], 0, 0]) : labToCss([lab[0], 0, 0]))
      : css;
    out.set(entry.key, {
      fill: paint, custom: entry.custom !== null, aux: entry.spec?.kind === "aux", lab, distance,
    });
  };
  // Pinned first: user overrides keep their hex in both themes (a hand-picked
  // colour outranks the theme's greyscale) and the aux pseudo-model keeps its
  // reserved gold, so every auto colour places itself away from both.
  for (const entry of entries) {
    if (entry.custom !== null) place(entry, entry.custom, entry.customLab, Infinity);
  }
  const aux = entries.filter((entry) => entry.custom === null && entry.spec.kind === "aux");
  for (const entry of aux) {
    const paint = accentSpecPaint(entry.spec);
    const probe = project(paint.lab);
    place(entry, paint.css, paint.lab, placed.reduce((m, lab) => Math.min(m, accentLabDistance(probe, lab)), Infinity));
  }
  const movers = entries
    .filter((entry) => entry.custom === null && entry.spec.kind !== "aux")
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  for (const entry of movers) {
    // Nearest-to-canonical first: the first candidate that clears the target
    // wins, so an unopposed model is untouched and a twin takes the smallest
    // step that makes it readable. Only when a family's whole gradient is too
    // short does the picker fall back to "furthest available".
    let best = null;
    let bestDistance = -1;
    let fallback = null;
    let fallbackDistance = -1;
    for (const candidate of accentCandidates(entry.spec)) {
      const probe = project(candidate.lab);
      const distance = placed.reduce((m, lab) => Math.min(m, accentLabDistance(probe, lab)), Infinity);
      if (distance >= ACCENT_MIN_DISTANCE && best === null) {
        best = candidate;
        bestDistance = distance;
        break;
      }
      if (distance > fallbackDistance + 1e-9) {
        fallbackDistance = distance;
        fallback = candidate;
      }
    }
    const pick = best ?? fallback;
    place(entry, pick.css, pick.lab, best !== null ? bestDistance : fallbackDistance);
  }
  return out;
}

/** Lookup for surfaces that know a (provider, model) pair but not the key form:
 *  the composite entry, then the family-rolled-up key, then the bare model id. */
export function accentEntryOf(map, provider, model) {
  if (map === undefined || map === null || typeof map.get !== "function") return undefined;
  const id = String(model ?? "");
  if (id === "") return undefined;
  const route = typeof provider === "string" ? provider : "";
  const composite = map.get(modelKey(route, id));
  if (composite !== undefined) return composite;
  const rolled = map.get(rollupKeyOf(route, id));
  if (rolled !== undefined) return rolled;
  return map.get(id) ?? map.get(modelKey("", id));
}

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

/** ONE money notation for every face — symbol for CNY, code otherwise,
 *  never both. The hero renders `unit` as its own quiet span; quotaMoney
 *  joins the parts back into one string for table cells. */
export function moneyParts(total, currency) {
  return currency === "CNY" || currency === null || currency === undefined
    ? { text: `¥${fmtCost(total)}`, unit: "" }
    : { text: fmtCost(total), unit: currency };
}

/** The CNY face of moneyParts for call sites that print the symbol inline. */
export function moneyCny(total) {
  return moneyParts(total, "CNY").text;
}

/** `"peak"` | `"offpeak"` tier of an epoch-ms timestamp under a peak hour set
 *  (defaults to the official windows). Mirrors the host's fold-time tiering
 *  so event-level break segments price like the daily tiers. */
export function tierAtMs(timeMs, peakHours) {
  const hh = new Date(Number(timeMs) + BEIJING_OFFSET_MS).getUTCHours();
  const hours = Array.isArray(peakHours) ? peakHours : PEAK_HOURS;
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
export function recordTokens(record) {
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
export function sessionGroups(sessions, { pricing = [], fx = {}, monthly = [], model = "", models = [], catalog = null } = {}) {
  const modelSet = modelFilterSet(model, models);
  const matchesModel = (row) => keyMatchesFilter(modelSet, row.key ?? modelKey(row.provider, row.model));
  /** The aux badge rides only when the filter doesn't exclude the pseudo row. */
  const auxVisible = modelSet === null || modelSet.has(AUX_MODEL_KEY);
  const monthlySet = new Set(Array.isArray(monthly) ? monthly : []);
  /** Backfill a provider-less row's provider from the catalog (unique route),
   *  so monthly-paid and cost matching work for bare-key legacy events. */
  const resolveProvider = (row) => (row.provider !== "" ? row.provider : resolveProviderFor(catalog, row.model, monthlySet));
  const allMonthly = (rows) => rows.length > 0 && rows.every((m) => monthlySet.has(resolveProvider(m)));
  const byProject = new Map();
  for (const record of Array.isArray(sessions) ? sessions : []) {
    if (record === null || typeof record !== "object") continue;
    const allModels = sessionModelRows(record);
    const models = modelSet === null ? allModels : allModels.filter(matchesModel);
    if (models.length === 0 && modelSet !== null) continue; // never used a selected model
    // Session-list aux badge: the window's own search calls (the projection
    // folds per session, so this is per-session truth, not a day share).
    let auxSearch = 0;
    if (auxVisible) {
      for (const aux of Object.values(record.auxByDay ?? {})) {
        auxSearch += (aux?.search?.peak || 0) + (aux?.search?.offpeak || 0);
      }
    }
    for (const m of models) if (m.provider === "") m.provider = resolveProvider(m);
    // Unfiltered rows keep their byDay totals (tolerates records without
    // per-model maps); a filtered row sums only the selected model's tokens.
    const tokens = modelSet === null ? recordTokens(record) : foldModelTokens(models);
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
      title: record.title ?? null,
      day: record.day ?? null,
      subagent,
      parentSession: record.parentSession ?? null,
      delegationDepth: record.delegationDepth ?? 0,
      tokens,
      cost,
      topModel: models[0]?.key ?? null,
      monthly: allMonthly(models),
      modelRows,
      auxSearch,
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
export function breaksSegments(events, breaks, { pricing = [], fx = {}, monthly = [], model = "", models = [], catalog = null } = {}) {
  const modelSet = modelFilterSet(model, models);
  const list = (Array.isArray(events) ? events : [])
    .filter((e) => e !== null && typeof e === "object" && Number.isFinite(e.t)
      && keyMatchesFilter(modelSet, e.key));
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
  const userRules = (Array.isArray(pricing) ? pricing : []).filter((rule) => rule?.inherited !== true);
  const maps = ruleMaps([...officialRulesFor(day), ...userRules]);
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

const QUOTA_DAY_MS = 86400000;
const QUOTA_HOUR_MS = 3600000;

/** Local midnight (epoch ms) of a `YYYY-MM-DD` day key (view-model copy of
 *  the host aggregate helper; the bundle cannot import node-side modules). */
export function quotaDayStart(day) {
  const [y, m, d] = String(day).split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

/** Sum one per-day/per-hour model map's entries belonging to one provider
 *  route. Model keys are `provider\0model` composites; legacy bare ids carry
 *  no provider and only match an empty route. Returns null for no match. */
function providerTokensOf(byModel, provider) {
  if (byModel === null || typeof byModel !== "object") return null;
  let acc = null;
  for (const [key, tokens] of Object.entries(byModel)) {
    if (tokens === null || typeof tokens !== "object") continue;
    if (splitModelKey(key).provider !== provider) continue;
    const row = { input: quotaNum(tokens.input), output: quotaNum(tokens.output), cacheRead: quotaNum(tokens.cacheRead), cacheWrite: quotaNum(tokens.cacheWrite) };
    if (row.input + row.output + row.cacheRead + row.cacheWrite <= 0) continue;
    if (acc === null) acc = row;
    else {
      acc.input += row.input;
      acc.output += row.output;
      acc.cacheRead += row.cacheRead;
      acc.cacheWrite += row.cacheWrite;
    }
  }
  return acc;
}

function quotaAddInto(acc, row) {
  acc.input += row.input;
  acc.output += row.output;
  acc.cacheRead += row.cacheRead;
  acc.cacheWrite += row.cacheWrite;
}

export const quotaEmpty = () => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });

function quotaNum(value) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Walk one provider's local token usage over `[fromMs, toMs)`, visiting each
 * session record's slice. Day-granular maps serve whole days; the boundary
 * days use the 3-day `hoursByDay` retention at hour resolution — when a day
 * carries hour maps at all they are authoritative (the fold records every
 * usage event, so a missing hour bucket means zero usage, which the coverage
 * audit relies on), and only days without any hour coverage fall back to a
 * proportional share of the day's totals (clearly an estimate; the caller
 * labels it as one).
 *
 * @param {Array<object>} sessions - payload session records.
 * @param {number} fromMs - window start (inclusive, epoch ms).
 * @param {number} toMs - window end (exclusive, epoch ms).
 * @param {string} provider - provider route id to attribute to.
 * @param {(project: string, tokens: object, weight: number) => void} visit - sink.
 */
function quotaEachSlice(sessions, fromMs, toMs, provider, visit) {
  const from = Math.floor(Number(fromMs));
  const to = Math.floor(Number(toMs));
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return;
  for (const record of Array.isArray(sessions) ? sessions : []) {
    if (record === null || typeof record !== "object") continue;
    const project = record.project === null || record.project === undefined ? "" : String(record.project);
    const modelsByDay = record.modelsByDay ?? {};
    const hoursByDay = record.hoursByDay ?? {};
    const days = new Set(Object.keys(modelsByDay));
    for (const day of days) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
      const startMs = quotaDayStart(day);
      const endMs = startMs + QUOTA_DAY_MS;
      if (endMs <= from || startMs >= to) continue;
      const dayTokens = providerTokensOf(modelsByDay[day], provider);
      if (dayTokens === null) continue;
      if (from <= startMs && to >= endMs) {
        visit(project, dayTokens, 1);
        continue;
      }
      // Partial day: hour maps win when the day carries them at all — and
      // they are exact, so hours without a bucket contribute zero.
      const dayHours = hoursByDay[day];
      if (dayHours !== null && typeof dayHours === "object") {
        let hourAcc = null;
        for (const [hh, byModel] of Object.entries(dayHours)) {
          const hourIdx = Number(hh);
          if (!Number.isInteger(hourIdx) || hourIdx < 0 || hourIdx > 23) continue;
          const hStart = startMs + hourIdx * QUOTA_HOUR_MS;
          if (hStart + QUOTA_HOUR_MS <= from || hStart >= to) continue;
          const part = providerTokensOf(byModel, provider);
          if (part === null) continue;
          if (hourAcc === null) hourAcc = { ...part };
          else quotaAddInto(hourAcc, part);
        }
        if (hourAcc !== null) visit(project, hourAcc, 1);
        continue;
      }
      // No hour coverage for this day: proportional estimate.
      const overlap = Math.min(to, endMs) - Math.max(from, startMs);
      const frac = Math.max(0, Math.min(1, overlap / QUOTA_DAY_MS));
      if (frac <= 0) continue;
      visit(project, dayTokens, frac);
    }
  }
}

/**
 * Local tokens one provider consumed inside a time range (the reconciliation
 * half of a quota window: server-side percentage ↔ locally recorded tokens).
 *
 * @param {Array<object>} sessions - payload session records.
 * @param {number} fromMs - window start (inclusive, epoch ms).
 * @param {number} toMs - window end (exclusive, epoch ms).
 * @param {string} provider - provider route id.
 * @returns {{input: number, output: number, cacheRead: number, cacheWrite: number, total: number}}
 */
export function quotaWindowTokens(sessions, fromMs, toMs, provider) {
  const acc = quotaEmpty();
  quotaEachSlice(sessions, fromMs, toMs, provider, (_project, tokens, weight) => {
    acc.input += tokens.input * weight;
    acc.output += tokens.output * weight;
    acc.cacheRead += tokens.cacheRead * weight;
    acc.cacheWrite += tokens.cacheWrite * weight;
  });
  acc.total = acc.input + acc.output + acc.cacheRead + acc.cacheWrite;
  return acc;
}

/**
 * Coverage audit for one provider's token calibration: reconcile consecutive
 * utilization snapshots against the tokens dsh recorded in the same
 * intervals. The provider's percentage is always authoritative — this only
 * decides whether translating it into token units may be shown at all.
 *
 *  - `external`: some interval where the provider's utilization moved (≥2
 *    points) while dsh recorded nothing — the key is being spent outside
 *    dsh, so any dsh-derived total would understate; the client suppresses
 *    the token estimates.
 *  - `ok`: ≥2 intervals with local usage whose per-point token amount stays
 *    within a 4× band — the calibration factor is stable enough to show.
 *  - `thin`: not enough evidence either way (fewer than 2 usable intervals);
 *    the client may show the estimate but must label it unverified.
 *
 * @param {Array<{t: number, provider: string, window: string, pct: number}>} series
 *   - the host's utilization snapshot points (any window mix; this audit is
 *   per provider, window-agnostic — intervals are chronological).
 * @param {Array<object>} sessions - payload session records.
 * @param {string} provider - provider route id.
 * @param {{fromMs?: number, toMs?: number}} [bounds] - the span the session
 *   records actually cover (the payload window). Intervals reaching outside
 *   it are skipped: their zero local tokens would be an artifact of the cut,
 *   not evidence of off-dsh spend.
 * @returns {{state: "ok"|"external"|"thin", intervals: number}}
 */
export function quotaCoverage(series, sessions, provider, bounds = {}) {
  const fromMs = Number(bounds?.fromMs);
  const toMs = Number(bounds?.toMs);
  const hasBounds = Number.isFinite(fromMs) && Number.isFinite(toMs) && toMs > fromMs;
  const points = (Array.isArray(series) ? series : [])
    .filter((p) => p !== null && typeof p === "object" && p.provider === provider)
    .map((p) => ({ t: quotaNum(p.t), pct: Number(p.pct) }))
    .filter((p) => p.t > 0 && Number.isFinite(p.pct) && p.pct >= 0 && p.pct <= 100)
    .sort((a, b) => a.t - b.t);
  const ratios = [];
  let external = false;
  for (let i = 1; i < points.length; i += 1) {
    const start = points[i - 1].t;
    const end = points[i].t;
    if (hasBounds && (start < fromMs || end > toMs)) continue;
    const deltaPct = points[i].pct - points[i - 1].pct;
    const deltaMs = end - start;
    if (deltaMs < 600000) continue; // sub-10-minute gaps are poll noise
    if (deltaPct <= 0) continue;
    const local = localTokensBetween(sessions, start, end, provider);
    if (local <= 0) {
      // Utilization moved without dsh touching the key in that interval.
      if (deltaPct >= 2) external = true;
      continue;
    }
    if (deltaPct >= 1) ratios.push(local / deltaPct);
  }
  if (external) return { state: "external", intervals: ratios.length };
  if (ratios.length >= 2) {
    const min = Math.min(...ratios);
    const max = Math.max(...ratios);
    return { state: max / min <= 4 ? "ok" : "thin", intervals: ratios.length };
  }
  return { state: "thin", intervals: ratios.length };
}

/** Local tokens in one interval (the raw number quotaCoverage compares). */
function localTokensBetween(sessions, fromMs, toMs, provider) {
  return quotaWindowTokens(sessions, fromMs, toMs, provider).total;
}

/**
 * Attribute one provider's window burn to projects: token totals per project
 * label, descending, with the share of the whole. The baseline for the
 * monthly-fee apportionment (成本分摊) and for "which project eats the plan".
 *
 * @param {Array<object>} sessions - payload session records.
 * @param {number} fromMs - window start (inclusive, epoch ms).
 * @param {number} toMs - window end (exclusive, epoch ms).
 * @param {string} provider - provider route id.
 * @returns {Array<{project: string, input: number, output: number, cacheRead: number, cacheWrite: number, total: number, share: number}>}
 */
export function quotaProjectAttribution(sessions, fromMs, toMs, provider) {
  const byProject = new Map();
  let grand = 0;
  quotaEachSlice(sessions, fromMs, toMs, provider, (project, tokens, weight) => {
    const row = byProject.get(project) ?? { project, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 };
    row.input += tokens.input * weight;
    row.output += tokens.output * weight;
    row.cacheRead += tokens.cacheRead * weight;
    row.cacheWrite += tokens.cacheWrite * weight;
    row.total = row.input + row.output + row.cacheRead + row.cacheWrite;
    byProject.set(project, row);
    grand += (tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite) * weight;
  });
  return [...byProject.values()]
    .map((row) => ({ ...row, share: grand > 0 ? row.total / grand : 0 }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Calibrate a quota window's absolute size from the pair the provider does
 * not expose: its reported utilization and the tokens dsh recorded locally
 * over the same span. Only meaningful when dsh carries (nearly) all of that
 * key's traffic — the panel labels the result as an estimate for exactly
 * that reason. `usedPct <= 0` cannot calibrate (no signal), and a zero local
 * total means "dsh saw nothing" — also no estimate.
 *
 * @param {number} usedPct - provider-reported utilization, 0–100.
 * @param {number} localTokens - locally recorded tokens over the same span.
 * @returns {{totalEst: number, remainingEst: number, basisTokens: number}|null}
 */
export function quotaCalibrate(usedPct, localTokens) {
  const pct = Number(usedPct);
  const local = Number(localTokens);
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100 || !Number.isFinite(local) || local <= 0) return null;
  const totalEst = local / (pct / 100);
  return { totalEst, remainingEst: Math.max(0, totalEst - local), basisTokens: local };
}

/**
 * Linear burn forecast over one window's utilization snapshot series (the
 * host stores every query as a `{t, provider, window, pct}` point). Two
 * points spanning at least ten minutes yield a percent-per-hour slope, the
 * projected exhaustion instant, and — when the provider reports a reset —
 * the projected utilization at that reset.
 *
 * @param {Array<{t: number, pct: number}>} points - ascending utilization samples.
 * @param {number} [now] - clock override for tests.
 * @param {number|null} [resetsAt] - the window's next reset (epoch ms).
 * @returns {{perHour: number, pct: number, from: number, to: number, exhaustsAt?: number, pctAtReset?: number}|null}
 */
export function quotaBurn(points, now = Date.now(), resetsAt = null) {
  void now;
  const list = (Array.isArray(points) ? points : [])
    .map((p) => ({ t: quotaNum(p?.t), pct: Number(p?.pct) }))
    .filter((p) => p.t > 0 && Number.isFinite(p.pct) && p.pct >= 0 && p.pct <= 100)
    .sort((a, b) => a.t - b.t);
  if (list.length < 2) return null;
  const first = list[0];
  const last = list[list.length - 1];
  const hours = (last.t - first.t) / 3600000;
  if (!(hours >= 1 / 6)) return null;
  const perHour = (last.pct - first.pct) / hours;
  const out = { perHour, pct: last.pct, from: first.t, to: last.t };
  if (perHour > 0) out.exhaustsAt = last.t + ((100 - last.pct) / perHour) * 3600000;
  const reset = Number(resetsAt);
  if (Number.isFinite(reset) && reset > last.t) {
    out.pctAtReset = Math.max(0, Math.min(100, last.pct + (perHour * (reset - last.t)) / 3600000));
  }
  return out;
}

/**
 * Normalize a plan fee into a per-month amount. Fees arrive from the
 * subscription endpoint (`{amount, currency, cycle}`); cycles map to their
 * month counts (monthly 1, quarterly 3, semiannual 6, annual 12). Unknown
 * cycles yield null — the panel then shows shares without money.
 *
 * @param {{amount: number, currency: string, cycle: string}|null} fee
 * @returns {{monthly: number, currency: string}|null}
 */
export function quotaMonthlyFee(fee) {
  const amount = Number(fee?.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const divisor = { monthly: 1, quarterly: 3, semiannually: 6, annually: 12, yearly: 12 }[fee?.cycle];
  if (divisor === undefined) return null;
  const currency = typeof fee?.currency === "string" && fee.currency !== "" ? fee.currency : "CNY";
  return { monthly: amount / divisor, currency };
}

/**
 * One project's share of the plan's monthly fee: the fee spread over the
 * window's local tokens in proportion to the project's own. Null when either
 * side is missing — no fee (Kimi hides pricing) or no tokens (nothing to
 * apportion). This is the monthly-paid model's "cost": not marginal, but a
 * fair split of the fixed subscription.
 *
 * @param {{amount: number, currency: string, cycle: string}|null} fee
 * @param {number} projectTokens - the project's token total over the span.
 * @param {number} totalTokens - all tokens over the span.
 * @returns {number|null} the project's share of one month of the plan.
 */
export function quotaFeeShare(fee, projectTokens, totalTokens) {
  const monthly = quotaMonthlyFee(fee);
  const total = Number(totalTokens);
  const part = Number(projectTokens);
  if (monthly === null || !Number.isFinite(total) || total <= 0 || !Number.isFinite(part) || part <= 0) return null;
  return monthly.monthly * (part / total);
}
