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
	AUX_CALL_FEE,
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
	statsFingerprint,
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
  FOOT_WARN_PCT,
  footHintShow,
  footShareOf,
  footTodaySplitTokens,
  footTodayTokens,
  pickFootSource,
} from "./view/foot-display.js";
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

import { DEFAULT_USD_TO_CNY } from "./pricing-facts.js";

/** DISPLAY CURRENCY — totals are always computed in CNY (recon-grade); the
 *  personal displayCurrency setting converts at this single money exit.
 *  Realms apply it via applyDisplay (host from config, client from the
 *  payload); tests never call it and therefore see plain CNY. */
let moneyDisplay = "CNY";
let moneyDisplayRate = DEFAULT_USD_TO_CNY;
export function applyDisplay(currency, rate) {
  moneyDisplay = currency === "USD" ? "USD" : "CNY";
  const r = Number(rate);
  moneyDisplayRate = Number.isFinite(r) && r > 0 ? r : DEFAULT_USD_TO_CNY;
}

/** ONE numeric exit for the display currency: a CNY amount in, the
 *  display-currency number out (unformatted — CSV cells and other numeric
 *  consumers). The ÷rate lives here and nowhere else; moneyParts rides it,
 *  so a second conversion point cannot appear and the printed face can
 *  never disagree with an exported number. */
export function displayAmount(cny) {
  const v = Number(cny) || 0;
  return moneyDisplay === "USD" ? v / moneyDisplayRate : v;
}

/** The active display currency's code — the ONE reader for faces that must
 *  NAME the currency (CSV title/header) rather than print an amount.
 *  applyDisplay stays the single writer. Named activeCurrency (not
 *  displayCurrency) because the payloads already carry a displayCurrency
 *  FIELD — a same-named export would make every `data.displayCurrency`
 *  read as a missing import. */
export function activeCurrency() {
  return moneyDisplay;
}

/** ONE money notation for every face — symbol for CNY, code otherwise,
 *  never both. The hero renders `unit` as its own quiet span; quotaMoney
 *  joins the parts back into one string for table cells. CNY amounts honor
 *  the display currency (converted via displayAmount, nowhere else);
 *  non-CNY sources print as-is. */
export function moneyParts(total, currency) {
  let c = currency;
  let v = Number(total) || 0;
  if ((c === "CNY" || c === null || c === undefined) && moneyDisplay === "USD") {
    v = displayAmount(v);
    c = "USD";
  }
  return c === "CNY" || c === null || c === undefined
    ? { text: `¥${fmtCost(v)}`, unit: "" }
    : { text: fmtCost(v), unit: c };
}

/** The CNY face of moneyParts for call sites that print the symbol inline.
 *  quotaMoney semantics so the unit survives: CNY mode reads `¥6.80`, USD
 *  display mode reads `2.00 USD` — a bare number beside token counts is
 *  exactly the ambiguity the unit contract forbids. */
export function moneyCny(total) {
  return quotaMoney(total, "CNY");
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
 *  1500.0M on the TUI). A whole number prints bare — 689k, never 689.0k;
 *  the lone decimal is kept only when it says something (830.4k). */
export function fmtTokens(n) {
	const v = Number(n) || 0;
	const compact = (x) => {
		const s = x.toFixed(1);
		return s.endsWith(".0") ? s.slice(0, -2) : s;
	};
	if (v >= 1e9) return `${compact(v / 1e9)}B`;
	if (v >= 1e6) return `${compact(v / 1e6)}M`;
	if (v >= 1e3) return `${compact(v / 1e3)}k`;
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
 * One windowed session record as served by `/pulse/stats` (a `sliceRecord`
 * output of the host fold): per-day maps keyed `YYYY-MM-DD`, model maps
 * keyed by the composite `provider\u0000model`. Map values stay loose —
 * every reader guards shapes at runtime.
 *
 * @typedef {object} WindowedRecord
 * @property {string|null} [id]
 * @property {number|null} [createdAt]
 * @property {string|null} [project]
 * @property {boolean} [subagent]
 * @property {string|null} [parentSession]
 * @property {string|null} [title]
 * @property {number} [delegationDepth]
 * @property {string|null} [firstDay]
 * @property {string|null} [day] - the windowed record's anchor day.
 * @property {Object.<string, any>} [byDay] - day → token totals.
 * @property {Object.<string, Object.<string, any>>} [modelsByDay] - day → model → tokens.
 * @property {Object.<string, Object.<string, Object.<string, any>>>} [hoursByDay] - day → `HH` → model → tokens.
 * @property {Object.<string, Object.<string, any>>} [tiersByDay] - day → model → peak/off-peak split.
 * @property {Object.<string, number>} [turnsByDay]
 * @property {Object.<string, number>} [toolCallsByDay]
 * @property {Object.<string, Object.<string, number>>} [toolHistogramByDay] - day → tool → count.
 * @property {Object.<string, any>} [auxByDay] - day → aux counters.
 * @property {string} [label] - a subagent's own descriptor label.
 * @property {string} [timelineTitle] - the task tree the session last touched.
 * @property {Object.<string, string>} [teamNames] - team member id → name.
 */

/**
 * Session list grouped by project — the session panel's data source. Each
 * session row carries its windowed token totals, tier-aware cost (through
 * the same estimator the dashboard uses), identity fields (`subagent`,
 * `parentSession`, `delegationDepth`) and its dominant model. Each group
 * adds the subagent subtotal (count, tokens, cost) so "project × subagent"
 * reads at a glance.
 *
 * Within a group a subagent row follows the parent it was spawned from,
 * nested ones included, so a family reads as one block; `nestDepth` is the
 * row's depth under its top-most ancestor in the list, and `childCount` /
 * `childTokens` / `childShare` summarize a row's direct children (count,
 * tokens, and their share of parent + children).
 *
 * @param {Array<WindowedRecord>} sessions - payload session records.
 * @param {{pricing?: Array<any>, fx?: {usdToCny?: number}, monthly?: string[], model?: string, models?: Array<any>, catalog?: any}} [options]
 *   - `{pricing, fx, monthly, model, catalog}` for cost estimation and an
 *   optional model filter (composite key or bare id). With `model` set,
 *   each session counts only that model's rows — sessions that never used
 *   the model drop out entirely, so the project-detail panel never
 *   surfaces other models' sessions. `catalog` (the model config) lets
 *   provider-less rows resolve their provider for monthly/cost matching.
 * @returns {Array<SessionGroup>} groups sorted by total tokens descending.
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
    let timelineReports = 0;
    let timelineFailures = 0;
    if (auxVisible) {
      for (const aux of Object.values(record.auxByDay ?? {})) {
        auxSearch += (aux?.search?.peak || 0) + (aux?.search?.offpeak || 0);
        timelineReports += aux?.timelineReports || 0;
        timelineFailures += aux?.timelineFailures || 0;
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
    // Off-peak share of the row's tokens. Null without a tier split: a
    // tier-less record prices whole days off-peak, which is no reading.
    let peakTokens = 0;
    let offpeakTokens = 0;
    for (const m of models) {
      peakTokens += m.peak.input + m.peak.output + m.peak.cacheRead + m.peak.cacheWrite;
      offpeakTokens += m.offpeak.input + m.offpeak.output + m.offpeak.cacheRead + m.offpeak.cacheWrite;
    }
    const hasTiers = Object.values(record.tiersByDay ?? {}).some((dayTiers) => Object.keys(dayTiers ?? {}).length > 0);
    const offpeakShare = hasTiers && peakTokens + offpeakTokens > 0 ? offpeakTokens / (peakTokens + offpeakTokens) : null;
    const projectLabel = record.project === null || record.project === undefined ? "" : String(record.project);
    let group = byProject.get(projectLabel);
    if (group === undefined) {
      group = {
        project: projectLabel === "" ? null : projectLabel,
        sessions: [], mainSessions: 0, subagentSessions: 0,
        tokens: EMPTY_TOKENS(), subagentTokens: EMPTY_TOKENS(),
        models: [], subagentModels: [],
      };
      byProject.set(projectLabel, group);
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
      // A subagent's own descriptor label; null for every other session.
      label: typeof record.label === "string" && record.label !== "" ? record.label : null,
      day: record.day ?? null,
      subagent,
      parentSession: record.parentSession ?? null,
      delegationDepth: record.delegationDepth ?? 0,
      tokens,
      total,
      cost,
      topModel: models[0]?.key ?? null,
      monthly: allMonthly(models),
      modelRows,
      auxSearch,
      offpeakShare,
      timelineTitle: typeof record.timelineTitle === "string" && record.timelineTitle !== "" ? record.timelineTitle : null,
      timelineReports,
      timelineFailures,
      teamNames: record.teamNames ?? null,
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
    sessions: orderFamily(g.sessions),
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
 * One session row of a {@link SessionGroup}: identity (`id`, `title`, a
 * subagent's descriptor `label`), family placement (`parentSession`,
 * `nestDepth`, the direct-children summary `childCount` / `childTokens` /
 * `childShare`), windowed `tokens` and their sum `total`, `offpeakShare`
 * (null without a tier split), the timeline attribution (`timelineTitle`,
 * `timelineReports`, `timelineFailures`) and the team member names a
 * parent's log recorded (`teamNames`, null without any).
 *
 * @typedef {object} SessionRow
 * @property {string|null} id
 * @property {number|null} createdAt
 * @property {string|null} title
 * @property {string|null} label
 * @property {string|null} day
 * @property {boolean} subagent
 * @property {string|null} parentSession
 * @property {number} delegationDepth
 * @property {{input: number, output: number, cacheRead: number, cacheWrite: number}} tokens
 * @property {number} total
 * @property {any} cost
 * @property {string|null} topModel
 * @property {boolean} monthly
 * @property {Array<object>} modelRows
 * @property {number} auxSearch
 * @property {number|null} offpeakShare
 * @property {string|null} timelineTitle
 * @property {number} timelineReports
 * @property {number} timelineFailures
 * @property {Object.<string, string>|null} teamNames
 * @property {number} nestDepth
 * @property {number} childCount
 * @property {number} childTokens
 * @property {number} childShare
 */

/**
 * One project's session rows in family order, with the project's subagent
 * subtotal.
 *
 * @typedef {object} SessionGroup
 * @property {string|null} project
 * @property {SessionRow[]} sessions
 * @property {number} mainSessions
 * @property {number} subagentSessions
 * @property {{input: number, output: number, cacheRead: number, cacheWrite: number}} tokens
 * @property {{input: number, output: number, cacheRead: number, cacheWrite: number}} subagentTokens
 * @property {any} cost
 * @property {any} subagentCost - the subagent subtotal's cost, null without subagents.
 * @property {number} total
 */

/**
 * Family adjacency for one project's session rows: every subagent follows
 * the parent it was spawned from (nested ones included, depth under the
 * top-most ancestor in the list as `nestDepth`), a family with several
 * children keeps them in the order they arrived. Each row also learns its
 * direct children: `childCount`, `childTokens`, and `childShare` — their
 * share of parent + children, 0 without children. Rows whose parent is
 * absent (out of the window) stay in place.
 *
 * @param {SessionRow[]} rows
 * @returns {SessionRow[]}
 */
function orderFamily(rows) {
  const byId = new Map();
  for (const row of rows) if (row.id !== null && row.id !== undefined) byId.set(row.id, row);
  const kidsOf = new Map();
  const roots = [];
  for (const row of rows) {
    const parent = row.parentSession !== null && row.parentSession !== row.id ? byId.get(row.parentSession) : undefined;
    if (parent === undefined) roots.push(row);
    else kidsOf.set(parent, [...(kidsOf.get(parent) ?? []), row]);
  }
  const ordered = [];
  const placed = new Set();
  const place = (row, depth) => {
    if (placed.has(row)) return;
    placed.add(row);
    const children = kidsOf.get(row) ?? [];
    row.nestDepth = depth;
    row.childCount = children.length;
    row.childTokens = children.reduce((sum, child) => sum + child.total, 0);
    row.childShare = row.total + row.childTokens > 0 ? row.childTokens / (row.total + row.childTokens) : 0;
    ordered.push(row);
    for (const child of children) place(child, depth + 1);
  };
  for (const root of roots) place(root, 0);
  for (const row of rows) place(row, 0); // a parent cycle strands nothing
  return ordered;
}

/**
 * Families of the collaboration panel: every session present in the window
 * that spawned subagents, with all of them as members (nested ones
 * included, `nest` = depth under the family root) and each member's share
 * of the family's subagent tokens. A subagent whose own parent is out of
 * the window is a member of an "absent parent" family keyed by that parent
 * id (`absentParent`), so no subagent spend falls off the panel. The head
 * carries its own `tokens`, the members' sum as `memberTokens`, and the
 * team member names the head's log recorded. Families sort by member
 * tokens; members arrive in list order.
 *
 * @param {Array<SessionGroup>} groups - `sessionGroups` output.
 * @returns {Array<object>} families, busiest first.
 */
export function collaborationOf(groups) {
  const rows = [];
  for (const group of Array.isArray(groups) ? groups : []) {
    for (const row of group?.sessions ?? []) {
      if (row === null || typeof row !== "object" || row.id === null || row.id === undefined) continue;
      rows.push({ ...row, project: group.project ?? null });
    }
  }
  const byId = new Map(rows.map((row) => [row.id, row]));
  const kidsOf = new Map();
  const roots = [];
  for (const row of rows) {
    const parent = row.parentSession !== null && row.parentSession !== row.id ? byId.get(row.parentSession) : undefined;
    if (parent === undefined) roots.push(row);
    else kidsOf.set(parent.id, [...(kidsOf.get(parent.id) ?? []), row]);
  }
  const families = new Map();
  const seen = new Set();
  /** Every descendant of `row`, `nest` = depth under the family root. */
  const descendants = (row, depth, into) => {
    for (const kid of kidsOf.get(row.id) ?? []) {
      if (seen.has(kid.id)) continue;
      seen.add(kid.id);
      into.push({ ...kid, nest: depth });
      descendants(kid, depth + 1, into);
    }
  };
  /** Fold one family head into its family: a present parent adds its own
   *  tokens, an orphan subagent (its parent is out of the window) becomes
   *  the first member of that parent's family. */
  const absorb = (root) => {
    if (seen.has(root.id)) return;
    seen.add(root.id);
    const orphan = root.subagent === true && root.parentSession !== null;
    const key = orphan ? `absent\u0000${root.parentSession}` : root.id;
    let family = families.get(key);
    if (family === undefined) {
      family = {
        id: orphan ? null : root.id,
        absentParent: orphan ? root.parentSession : null,
        project: root.project,
        title: orphan ? null : root.title,
        label: orphan ? null : root.label,
        teamNames: orphan ? {} : (root.teamNames ?? {}),
        tokens: 0,
        members: [],
      };
      families.set(key, family);
    }
    if (orphan) family.members.push({ ...root, nest: 1 });
    else family.tokens += root.total;
    // The orphan is itself a first-level member, so its own children nest one deeper.
    descendants(root, orphan ? 2 : 1, family.members);
  };
  for (const root of roots) absorb(root);
  // A parent cycle strands no row: whatever is still unseen heads a family.
  for (const row of rows) absorb(row);
  const out = [...families.values()].filter((family) => family.members.length > 0).map((family) => {
    const memberTokens = family.members.reduce((sum, member) => sum + member.total, 0);
    const members = family.members.map((member) => ({ ...member, share: memberTokens > 0 ? member.total / memberTokens : 0 }));
    return { ...family, memberTokens, familyTokens: family.tokens + memberTokens, members };
  });
  const byKey = (family) => String(family.id ?? `\u0000${family.absentParent ?? ""}`);
  return out.sort((a, b) => b.memberTokens - a.memberTokens || byKey(a).localeCompare(byKey(b)));
}

/**
 * Timeline work per session for the collaboration panel: the task tree the
 * session last touched (its title, falling back to the session's own
 * name) with the window's report and failure counts. Only sessions with a
 * tree or an outcome list.
 *
 * @param {Array<SessionGroup>} groups - `sessionGroups` output.
 * @returns {Array<{id: string|null, project: string|null, sessionTitle: string|null, title: string|null, reports: number, failures: number}>}
 *   most reports first.
 */
export function timelineOfWork(groups) {
  const out = [];
  for (const group of Array.isArray(groups) ? groups : []) {
    for (const row of group?.sessions ?? []) {
      if (row === null || typeof row !== "object") continue;
      const reports = row.timelineReports || 0;
      const failures = row.timelineFailures || 0;
      if (reports === 0 && failures === 0 && row.timelineTitle === null) continue;
      out.push({
        id: row.id ?? null,
        project: group.project ?? null,
        sessionTitle: row.title ?? null,
        title: row.timelineTitle ?? row.title ?? null,
        reports,
        failures,
      });
    }
  }
  return out.sort((a, b) => b.reports - a.reports || b.failures - a.failures);
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
 * @param {{pricing?: Array<any>, fx?: {usdToCny?: number}, monthly?: string[], model?: string, models?: Array<any>, catalog?: any}} [options]
 *   - `{pricing, fx, monthly, model}` for cost estimation; `model`
 *   (composite key or bare id) restricts every segment to that model's
 *   events, so a model-filtered break analysis never shows other models'
 *   consumption. `catalog` (the model config) lets provider-less events
 *   resolve their provider for monthly/cost matching.
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
