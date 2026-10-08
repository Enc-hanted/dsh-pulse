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
 * Layout: the self-contained subsystems live in ./view/ — keys.js (model
 * keys + bucket ladder), routes.js (route families & provider identity),
 * aux-calls.js (aux-call shapes), pricing-engine.js (rules → money),
 * recon.js (official-bill overlay), build-view.js (window aggregation +
 * hourly), quota-estimates.js (quota ms-window math), accents.js
 * (per-model accent palette), official-pricing.js (official price
 * schedules & strict rules). This module keeps the
 * session/turn views and money formatting, and remains the ONLY import
 * surface the plugin's other modules use (exports contract unchanged).
 */

import { modelFilterSet, modelKey, splitModelKey } from "./view/keys.js";
import { EMPTY_MODEL_ROW, EMPTY_TOKENS, tierAtMs } from "./view/build-view.js";
import { AUX_MODEL_KEY, addDayModel, addTokens } from "./view/aux-calls.js";
import { costOf, ruleFor, ruleMaps } from "./view/pricing-engine.js";
import { keyMatchesFilter, resolveProviderFor } from "./view/routes.js";

export {
	MODEL_SEP,
	bucketLabel,
	bucketOf,
	clampSpan,
	daysBetween,
	dayStart,
	localDay,
	modelFilterSet,
	modelKey,
	monthKey,
	rangeKeys,
	shiftDay,
	splitModelKey,
	weekStart,
	ymd,
} from "./view/keys.js";
export {
	ROUTE_FAMILIES,
	familyRouteOf,
	isOfficialProvider,
	keyMatchesFilter,
	providerLabelOf,
	rollupKeyOf,
} from "./view/routes.js";
export {
	AUX_MODEL_KEY,
	AUX_PRICE_AS,
	AUX_SHAPE,
	auxDayUsage,
} from "./view/aux-calls.js";
export {
	DEFAULT_USD_TO_CNY,
	cacheHitRateOf,
	costOf,
	costSeries,
	fxRateOf,
	monthlySetOf,
	priceTier,
	resolveRates,
	ruleFor,
	ruleMaps,
} from "./view/pricing-engine.js";
export {
	RECON_ABS_FLOOR,
	auxCalibration,
	reconDrift,
	reconcileSeries,
	rollupModelFamilies,
} from "./view/recon.js";
export {
	buildView,
	heatmapCells,
	heatmapLevel,
	hourlyCostSeries,
	hourlySeries,
	tierAtMs,
} from "./view/build-view.js";
export {
	quotaBurn,
	quotaCalibrate,
	quotaCoverage,
	quotaDayStart,
	quotaEmpty,
	quotaFeeShare,
	quotaMonthlyFee,
	quotaProjectAttribution,
	quotaWindowTokens,
} from "./view/quota-estimates.js";

export {
  fullRulesWith,
  isOffPeakDay,
  OFFICIAL_PRICE_SCHEDULES,
  officialEstimateRulesFor,
  officialRulesFor,
  strictRulesWith,
} from "./view/official-pricing.js";
export {
  ACCENT_MIN_DISTANCE,
  accentEntryOf,
  accentFillOf,
  accentHash,
  accentHueGap,
  accentLabDistance,
  modelAccentMap,
  vendorAccentOf,
} from "./view/accents.js";

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

/** Money with an explicit unit tail: `¥12.34` for CNY, `12.34 USD` otherwise
 *  — the single face for table cells and in-sentence amounts. */
export function quotaMoney(total, currency) {
  const money = moneyParts(total, currency);
  return money.unit === "" ? money.text : `${money.text} ${money.unit}`;
}

/** `HH:MM` for an epoch-ms stamp; null for a non-finite input — the ONE
 *  clock face (the fold's null contract wins over printing a fake midnight). */
export function clockOf(ms) {
	const d = new Date(ms);
	if (!Number.isFinite(d.getTime())) return null;
	return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Token-count formatting: 1.2k / 3.4M / 5.6B — the ONE abbreviation for
 *  both faces (the two ladders had already split: 1.5B here printed as
 *  1500.0M on the TUI). */
export function fmtTokens(n) {
	const v = Number(n) || 0;
	if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
	if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
	if (v >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
	return String(Math.round(v));
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
