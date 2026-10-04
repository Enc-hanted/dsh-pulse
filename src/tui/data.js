/**
 * TUI face — data layer: session folds, the shared config + pricing layers,
 * the calendar window model, and the money-honesty classification.
 *
 * Pure aggregation and classification — no terminal drawing, no React.
 * `viewSlice` is the money-critical path (locked by test/tui-test.mjs
 * through the facade). String/draw primitives live in ./draw.js; the React
 * scene and the plugin wiring live in ./scene.js.
 */

import { foldEvents, projectOf, localDay, dayStart } from "../aggregate.js";
import {
	costOf, strictRulesWith, fullRulesWith,
	shiftDay, DEFAULT_USD_TO_CNY, splitModelKey,
} from "../view.js";

const TOKEN_KEYS = ["input", "output", "cacheRead", "cacheWrite"];

function addTok(target, source) {
	if (!source || typeof source !== "object") return;
	for (const key of TOKEN_KEYS) target[key] = (target[key] ?? 0) + (source[key] ?? 0);
}

export function tokSum(t) {
	return (t?.input ?? 0) + (t?.output ?? 0) + (t?.cacheRead ?? 0) + (t?.cacheWrite ?? 0);
}

/** Session-id equality tolerant to prefix/suffix drift between the
 *  sessionQuery listing and the channel's live sessionId.
 *  Exported for test/tui-test.mjs. */
export function eqId(a, b) {
	if (!a || !b) return false;
	const x = String(a), y = String(b);
	return x === y || x.endsWith(y) || y.endsWith(x);
}

/** Read one session through `sessionQuery` and fold it into a pulse record.
 *  Folding is memoized on the header's version stamp (updatedAt & co.) —
 *  an unchanged session refolds into the cached record instead of paying
 *  the full decode on every 30s poll and every scene reopen. `r` clears. */
export const foldCache = new Map(); // id → { version, header, record }

async function foldSession(sessionQuery, id, version) {
	const hit = foldCache.get(id);
	if (hit && hit.version === version) return { header: hit.header, record: hit.record };
	const loaded = await sessionQuery.readSession(id);
	const events = Array.isArray(loaded) ? loaded : Array.isArray(loaded?.events) ? loaded.events : [];
	const header = loaded?.header ?? null;
	const record = foldEvents(events, {});
	foldCache.set(id, { version, header, record });
	if (foldCache.size > 240) foldCache.delete(foldCache.keys().next().value);
	return { header, record };
}

function emptyRecord() {
	return { byDay: {}, modelsByDay: {}, hoursByDay: {}, tiersByDay: {}, turnsByDay: {}, toolCallsByDay: {}, auxByDay: {}, firstDay: null };
}

/** Exported for test/tui-test.mjs. Merges one folded record into `target`.
 *  `tiersByDay` must keep the FOLD's nested shape (`{input: {peak,
 *  offpeak}, ...}`) — reshaping it here into flat peak/offpeak buckets
 *  made dayModelRows hand costOf all-zero-but-defined splits, which priced
 *  every merged row at ¥0 while per-session rows showed real money. */
export function mergeRecord(target, source) {
	if (!source) return;
	for (const [day, v] of Object.entries(source.byDay ?? {})) {
		addTok((target.byDay[day] ??= { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }), v);
	}
	for (const [day, models] of Object.entries(source.modelsByDay ?? {})) {
		const bucket = (target.modelsByDay[day] ??= {});
		for (const [key, v] of Object.entries(models)) {
			addTok((bucket[key] ??= { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }), v);
		}
	}
	for (const [day, tiers] of Object.entries(source.tiersByDay ?? {})) {
		const bucket = (target.tiersByDay[day] ??= {});
		for (const [key, split] of Object.entries(tiers ?? {})) {
			const t = (bucket[key] ??= { input: {}, output: {}, cacheRead: {}, cacheWrite: {} });
			for (const kind of ["input", "output", "cacheRead", "cacheWrite"]) {
				const side = split?.[kind];
				if (side === null || typeof side !== "object") continue;
				const dst = (t[kind] ??= {});
				dst.peak = (dst.peak ?? 0) + (side.peak ?? 0);
				dst.offpeak = (dst.offpeak ?? 0) + (side.offpeak ?? 0);
			}
		}
	}
	for (const [day, hours] of Object.entries(source.hoursByDay ?? {})) {
		const bucket = (target.hoursByDay[day] ??= {});
		for (const [hh, models] of Object.entries(hours ?? {})) {
			const hourBucket = (bucket[hh] ??= {});
			for (const [key, v] of Object.entries(models ?? {})) {
				addTok((hourBucket[key] ??= { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }), v);
			}
		}
	}
	for (const [day, n] of Object.entries(source.turnsByDay ?? {})) target.turnsByDay[day] = (target.turnsByDay[day] ?? 0) + (n ?? 0);
	for (const [day, n] of Object.entries(source.toolCallsByDay ?? {})) target.toolCallsByDay[day] = (target.toolCallsByDay[day] ?? 0) + (n ?? 0);
	// Aux counters merge tier-split too, so the day view can show 「搜索 ×N」
	// without re-reading session logs.
	const auxRoot = (target.auxByDay ??= {});
	for (const [day, kinds] of Object.entries(source.auxByDay ?? {})) {
		const bucket = (auxRoot[day] ??= {});
		for (const [kind, split] of Object.entries(kinds ?? {})) {
			if (kind === "titleKey") {
				if (split !== null && split !== undefined) bucket.titleKey = split;
				continue;
			}
			if (split === null || typeof split !== "object") continue;
			const dst = (bucket[kind] ??= { peak: 0, offpeak: 0 });
			dst.peak += split.peak ?? 0;
			dst.offpeak += split.offpeak ?? 0;
		}
	}
	if (source.firstDay && (target.firstDay === null || source.firstDay < target.firstDay)) target.firstDay = source.firstDay;
}

/** One side of the fold's nested tier split as a flat token bucket — the
 *  shape `costOf` prices. `undefined` when the record carries no split at
 *  all, so costOf falls back to pricing the whole row. */
function tierBucket(tiers, side) {
	const kinds = ["input", "output", "cacheRead", "cacheWrite"];
	if (tiers === null || typeof tiers !== "object") return undefined;
	if (!kinds.some((k) => tiers[k] !== null && typeof tiers[k] === "object")) return undefined;
	const of = (k) => (tiers[k] !== null && typeof tiers[k] === "object" ? (tiers[k][side] ?? 0) : 0);
	return { input: of("input"), output: of("output"), cacheRead: of("cacheRead"), cacheWrite: of("cacheWrite") };
}

/** Per-day model rows in the shape `costOf` expects: flat tokens plus a
 *  real peak/off-peak tier split (tier-aware pricing, like the web face's
 *  costSeries — not everything billed at off-peak rates). */
export function dayModelRows(record, day) {
	const rows = [];
	for (const [key, t] of Object.entries(record?.modelsByDay?.[day] ?? {})) {
		const tiers = record?.tiersByDay?.[day]?.[key] ?? null;
		rows.push({
			key,
			input: t.input ?? 0, output: t.output ?? 0, cacheRead: t.cacheRead ?? 0, cacheWrite: t.cacheWrite ?? 0,
			peak: tierBucket(tiers, "peak"),
			offpeak: tierBucket(tiers, "offpeak"),
		});
	}
	return rows;
}

/* ------------------------------------------------------------------ */
/* shared config + pricing layers                                      */
/* ------------------------------------------------------------------ */

/** The `pulse` settings namespace — the SAME document the web face's
 *  settings editor writes (dsh-home-wide settings.yaml). Read through the
 *  settings service so the TUI face and the web face share one config;
 *  null when the service is absent (old host) or the namespace is missing. */
function pulseSettingsOf(ctx) {
	const probe = ctx.get("settings", false);
	const forms = probe?.settings && typeof probe.settings.describe === "function"
		? probe.settings
		: probe && typeof probe.describe === "function" ? probe : null;
	if (!forms) return null;
	try {
		const value = forms.describe().find((row) => row.ns === "pulse")?.value;
		return value !== null && typeof value === "object" ? value : null;
	} catch {
		return null;
	}
}

/** Merged config: entry config under, shared settings namespace over. */
function resolveConfig(ctx, entryConfig) {
	return { ...(entryConfig ?? {}), ...(pulseSettingsOf(ctx) ?? {}) };
}

/** Pricing context with two honest layers: `strictFor` prices under the
 *  billing-accurate schedule + user rules; `fullFor` underlays the GA-gap
 *  estimate rules so pre-effective-date usage still shows money. Order
 *  matters — ruleMaps is last-write-wins: estimates < schedule < user. */
export function makePricing(config) {
	const user = Array.isArray(config?.pricing) ? config.pricing : [];
	const fx = { usdToCny: Number(config?.usdToCny) > 0 ? Number(config.usdToCny) : DEFAULT_USD_TO_CNY };
	const monthly = Array.isArray(config?.monthlyProviders) ? config.monthlyProviders
		: Array.isArray(config?.monthly) ? config.monthly : [];
	const monthlySet = new Set(monthly);
	return {
		fx, monthly, monthlySet,
		costEnabled: config?.costEnabled !== false,
		modelColors: config?.modelColors !== null && typeof config?.modelColors === "object" ? config.modelColors : {},
		strictFor: (day) => strictRulesWith(day, user),
		fullFor: (day) => fullRulesWith(day, user),
	};
}

export function dayCost(record, day, pricing) {
	try {
		return costOf(dayModelRows(record, day), pricing.fullFor(day), pricing.fx, pricing.monthly).total ?? 0;
	} catch {
		return 0;
	}
}

/** Whether the estimate layer had to contribute money for this day — the
 *  ≈ flag shared by the day summary and the per-session ledger rows. */
export function dayEstimatedOf(record, day, pricing) {
	const rows = dayModelRows(record, day);
	if (!pricing.costEnabled || rows.length === 0) return false;
	const full = costOf(rows, pricing.fullFor(day), pricing.fx, pricing.monthly);
	const strict = costOf(rows, pricing.strictFor(day), pricing.fx, pricing.monthly);
	return full.total !== null && (strict.total === null || full.total - strict.total > 1e-9);
}

/** The four-state 计价 label for ONE (day, model) row — 按量 / 估算 / 包月 /
 *  未定价. Shared by the model list and the CSV's pricing column so the
 *  spreadsheet tells the same story as the screen. Exported for tests. */
export function pricingLabelOf(row, day, pricing) {
	if (pricing.monthlySet.has(splitModelKey(row.key).provider)) return "包月";
	let full;
	try {
		full = costOf([row], pricing.fullFor(day), pricing.fx, pricing.monthly);
	} catch {
		return "未定价";
	}
	if (full.total === null) return "未定价";
	let strict;
	try {
		strict = costOf([row], pricing.strictFor(day), pricing.fx, pricing.monthly);
	} catch {
		return "估算";
	}
	return strict.total === null ? "估算" : "按量";
}

/** Session title: the projection cache's `title` row (the same global
 *  store the web face populates), then header fields, then null — the
 *  caller falls back to the short id. Zero-I/O read; never decodes logs. */
function sessionTitleOf(ctx, header) {
	const direct = header?.sessionTitle ?? header?.title;
	if (typeof direct === "string" && direct !== "") return direct;
	const cache = ctx.get("sessionProjectionCache", false);
	if (typeof cache?.cachedSnapshot !== "function") return null;
	try {
		const snap = cache.cachedSnapshot.length >= 3
			? cache.cachedSnapshot(header, 0, ["title"])
			: cache.cachedSnapshot(header, ["title"]);
		const title = snap?.values?.title;
		return typeof title === "string" && title !== "" ? title : null;
	} catch {
		return null;
	}
}

/**
 * Snapshot of everything the scene needs: the merged project record plus
 * one folded record per session (for the day-level table). Scope is the
 * current TUI project only — the web face remains the all-projects view.
 */
export async function collect(ctx, entryConfig) {
	const sessionQuery = ctx.get("sessionQuery", false);
	if (!sessionQuery || typeof sessionQuery.listSessions !== "function") {
		throw new Error("sessionQuery service unavailable in this profile");
	}
	const listed = await sessionQuery.listSessions();
	const items = (Array.isArray(listed) ? listed : listed?.items ?? []).map((entry) => ({
		header: entry?.header ?? entry ?? {},
	}));
	if (items.length === 0) return { empty: true, config: resolveConfig(ctx, entryConfig), loadedAt: Date.now() };
	const recency = (item) => {
		const raw = item.header?.updatedAt ?? item.header?.lastActivityAt ?? item.header?.time ?? 0;
		return typeof raw === "string" ? Date.parse(raw) || 0 : Number(raw) || 0;
	};
	const ordered = [...items].sort((a, b) => recency(b) - recency(a));
	const cwd = ordered[0].header?.cwd ?? "";
	const project = projectOf(cwd, 1);

	const inProject = ordered.filter((item) => projectOf(item.header?.cwd ?? "", 1) === project).slice(0, 60);
	const merged = emptyRecord();
	const sessions = [];
	for (const item of inProject) {
		let folded = null;
		try {
			folded = await foldSession(sessionQuery, item.header.id, recency(item));
		} catch {
			continue; // one unreadable session must not kill the rollup
		}
		mergeRecord(merged, folded.record);
		sessions.push({
			id: item.header.id,
			title: sessionTitleOf(ctx, item.header),
			recency: recency(item),
			record: folded.record,
		});
	}
	return { empty: false, project, cwd, record: merged, sessions, config: resolveConfig(ctx, entryConfig), loadedAt: Date.now() };
}

/* ------------------------------------------------------------------ */
/* window model                                                        */
/* ------------------------------------------------------------------ */

export const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

export function todayDay() {
	return localDay(Date.now());
}

/** Monday-first weekday index 0..6 of a `YYYY-MM-DD`. */
export function weekdayOf(day) {
	return (new Date(dayStart(day)).getDay() + 6) % 7;
}

export function monthOf(day) {
	return day.slice(0, 7);
}

export function daysInMonth(month) {
	const [y, m] = month.split("-").map(Number);
	return new Date(y, m, 0).getDate();
}

/** All day keys of one month (clamped at today for the current month). */
export function daysOfMonth(month) {
	const today = todayDay();
	const n = daysInMonth(month);
	const out = [];
	for (let d = 1; d <= n; d++) {
		const day = `${month}-${String(d).padStart(2, "0")}`;
		if (day > today) break;
		out.push(day);
	}
	return out;
}

/** The year level's data window: a FIXED 53 weeks ending today, independent
 *  of terminal width. Layout may draw fewer columns (P0 keeps the right
 *  column alive), but the window — and therefore every number — never
 *  changes under a resize. */
export const YEAR_WEEKS = 53;

export function yearWindow() {
	const today = todayDay();
	const start = shiftDay(today, -((YEAR_WEEKS - 1) * 7) - weekdayOf(today));
	return { start, end: today, weeks: YEAR_WEEKS };
}

export function windowDays(from, to) {
	const out = [];
	for (let d = from; d <= to; d = shiftDay(d, 1)) out.push(d);
	return out;
}

/** The 2-char month label for the week STARTING `ws` (Monday), or null.
 *  A label marks the week that CONTAINS a 1st-of-month — the old
 *  `monthOf(ws) !== monthOf(we)` boundary test missed every month whose
 *  1st falls on a Monday (June 2026) and its "06" label vanished.
 *  Exported for test/tui-test.mjs. */
export function monthLabelOfWeek(ws) {
	const we = shiftDay(ws, 6);
	const first = `${monthOf(we)}-01`;
	return first >= ws && first <= we ? monthOf(we).slice(5, 7) : null;
}

/**
 * Snapshot of everything one calendar view renders. Money is computed PER
 * DAY — each day under its own schedule + estimate layer + user rules — so
 * a window spanning a price change or a GA gap stays honest:
 * - `values`: day → { tok, cost, estimated } (the per-day ≈ flag),
 * - `models`: per-model classification 按量/估算/包月/未定价 with window
 *   cost, where 未定价 means NO day in the window prices the model under
 *   ANY layer; estimate-covered models are labeled 估算 (with ≈ on money)
 *   instead of being double-reported as both priced and unpriced.
 */
/** Exported for test/tui-test.mjs — the honesty classification is the
 *  money-critical path and deserves the same lock as view.js. */
export function viewSlice(record, days, pricing) {
	const from = days[0], to = days[days.length - 1];
	const daySet = new Set(days);
	const values = new Map(); // day → { tok, cost, estimated }
	let maxTok = 0, maxCost = 0, tokens = 0, costTotal = 0;
	let activeDays = 0, estimatedDays = 0;
	const classByModel = new Map(); // key → { key, model, provider, state, cost, tok, estimated }
	for (const day of days) {
		const tok = tokSum(record?.byDay?.[day]);
		let cost = 0, dayEstimated = false;
		const dayRows = dayModelRows(record, day);
		if (pricing.costEnabled && dayRows.length > 0) {
			const full = costOf(dayRows, pricing.fullFor(day), pricing.fx, pricing.monthly);
			const strict = costOf(dayRows, pricing.strictFor(day), pricing.fx, pricing.monthly);
			cost = full.total ?? 0;
			dayEstimated = full.total !== null
				&& (strict.total === null || full.total - strict.total > 1e-9);
			if (dayEstimated) estimatedDays += 1;
			for (const row of dayRows) {
				const meta = splitModelKey(row.key);
				const entry = classByModel.get(row.key) ?? {
					key: row.key, model: meta.model, provider: meta.provider,
					state: "priced", cost: 0, tok: 0, estimated: false,
				};
				entry.tok += (row.input ?? 0) + (row.output ?? 0) + (row.cacheRead ?? 0);
				if (pricing.monthlySet.has(entry.provider)) {
					entry.state = "monthly"; // flat subscription: zero marginal cost by design
				} else {
					const f = costOf([row], pricing.fullFor(day), pricing.fx, pricing.monthly);
					const s = costOf([row], pricing.strictFor(day), pricing.fx, pricing.monthly);
					if (f.total === null) entry.state = "unpriced";
					else if (s.total === null || f.total - s.total > 1e-9) {
						if (entry.state === "priced") entry.state = "estimated";
						entry.estimated = true;
					}
					entry.cost += f.total ?? 0;
				}
				classByModel.set(row.key, entry);
			}
		}
		values.set(day, { tok, cost, estimated: dayEstimated });
		if (tok > 0) activeDays += 1;
		if (tok > maxTok) maxTok = tok;
		if (cost > maxCost) maxCost = cost;
		tokens += tok;
		costTotal += cost;
	}
	let peak = 0, offpeak = 0, hasTiers = false;
	for (const [day, tiers] of Object.entries(record?.tiersByDay ?? {})) {
		if (!daySet.has(day)) continue;
		for (const split of Object.values(tiers)) {
			peak += tokSum(split?.peak);
			offpeak += tokSum(split?.offpeak);
			hasTiers = true;
		}
	}
	const models = [...classByModel.values()].sort((a, b) => (b.cost - a.cost) || (b.tok - a.tok));
	const unpriced = models.filter((m) => m.state === "unpriced").map((m) => m.model);
	const turns = days.reduce((sum, day) => sum + (record?.turnsByDay?.[day] ?? 0), 0);
	const toolCalls = days.reduce((sum, day) => sum + (record?.toolCallsByDay?.[day] ?? 0), 0);
	let peakDay = null, peakDayTok = 0;
	for (const [day, v] of values) if (v.tok > peakDayTok) { peakDayTok = v.tok; peakDay = day; }
	return {
		from, to, values, maxTok, maxCost, tokens, costTotal, activeDays,
		peak, offpeak, hasTiers, models, unpriced,
		windowCost: { total: costTotal, estimated: estimatedDays > 0 },
		turns, toolCalls, peakDay,
	};
}

/** Peak hours (0-23) in force for one day, from the pricing rules actually
 *  applicable: the union of every rule carrying a `peak` block. Weekday-
 *  only rules contribute nothing on Sat/Sun (official windows bill those
 *  days entirely off-peak). null = no tiered rule → the gantt draws no band.
 *  Exported for test/tui-test.mjs. */
export function peakHoursFor(rules, day) {
	let set = null;
	const weekend = weekdayOf(day) >= 5;
	for (const rule of rules ?? []) {
		if (!rule?.peak) continue;
		if (rule.weekdaysOnly !== false && weekend) continue;
		const hours = Array.isArray(rule.peakHours) && rule.peakHours.length > 0 ? rule.peakHours : [9, 10, 11, 14, 15, 16, 17];
		set ??= new Set();
		for (const h of hours) if (Number.isInteger(h) && h >= 0 && h <= 23) set.add(h);
	}
	return set;
}

/** Mini-card model (pure; exported for tests): today split into the
 *  CURRENT session's today-slice vs the rest of the workspace, plus the
 *  month line (tokens, money, daily series, unpriced share). Everything
 *  here is cross-session aggregate or "share of today's pie" — the HUD's
 *  live-session metrics are never duplicated. Exported for tui-test.mjs. */
export function miniCardModel(data, pricing, today, currentId) {
	const todayRows = data.sessions
		.filter((s) => s.record?.byDay?.[today])
		.map((s) => ({
			current: eqId(s.id, currentId),
			tok: tokSum(s.record.byDay[today]),
			cost: pricing.costEnabled ? dayCost(s.record, today, pricing) : 0,
			estimated: pricing.costEnabled && dayEstimatedOf(s.record, today, pricing),
		}));
	const current = todayRows.find((r) => r.current) ?? null;
	const others = todayRows.filter((r) => !r.current);
	const tot = (list) => ({
		count: list.length,
		tok: list.reduce((s, r) => s + r.tok, 0),
		cost: list.reduce((s, r) => s + r.cost, 0),
		estimated: list.some((r) => r.estimated),
	});
	const monthDays = daysOfMonth(monthOf(today));
	const slice = viewSlice(data.record, monthDays, pricing);
	const series = monthDays.map((d) => slice.values.get(d)?.tok ?? 0);
	const modelsTok = slice.models.reduce((s, m) => s + m.tok, 0);
	const unpricedTok = slice.models.filter((m) => m.state === "unpriced").reduce((s, m) => s + m.tok, 0);
	const peakIdx = series.indexOf(Math.max(...series));
	return {
		today: {
			all: tot(todayRows),
			current: current ? { tok: current.tok, cost: current.cost, estimated: current.estimated } : null,
			hasCurrent: typeof currentId === "string" && currentId !== "",
			others: tot(others),
		},
		month: {
			label: `${monthOf(today).slice(0, 4)}年${Number(monthOf(today).slice(5, 7))}月`,
			tok: slice.tokens,
			cost: slice.costTotal,
			estimated: slice.windowCost.estimated,
			series,
			peakIdx,
			peakDay: peakIdx >= 0 ? monthDays[peakIdx] ?? null : null,
			unpricedPct: modelsTok > 0 ? unpricedTok / modelsTok : 0,
			unpricedCount: slice.unpriced.length,
			activeDays: slice.activeDays,
		},
	};
}
