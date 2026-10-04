/**
 * dsh-pulse TUI face — the terminal seat for `@deepseek-harness-tui/dsh-tui`.
 *
 * Mounted ONLY in the dsh-tui profile (the web profile's patch never
 * references this subpath, so this module never even loads there). It
 * reuses the same fold (`aggregate.js`) and pricing (`view.js`) as the web
 * half and reads the same shared session store through `sessionQuery`.
 *
 * Config is SHARED with the web face: the `pulse` settings namespace (the
 * store the web settings editor writes, dsh-home-wide settings.yaml) wins
 * over this profile's entry config — pricing rules, monthlyProviders,
 * usdToCny, costEnabled and modelColors all come over, so both faces tell
 * the same money story (soft-probed; absent service → entry config only).
 *
 * Pricing honesty: each day prices under the official schedule in effect
 * (`officialRulesFor`), user rules overlay, and `officialEstimateRulesFor`
 * fills the GA gap — usage days before a schedule's billing-effective date
 * still price from the earliest published vintage, tagged and labeled as
 * an estimate instead of showing a misleading zero. Models billed under a
 * flat monthly subscription stay visible with a 包月 tag.
 *
 * Scene shape — progressive disclosure, disjoint from dsh-tui's HUD:
 * - `/pulse` (or alt+p) TOGGLES THE STRIP: the mini card rendered through
 *   `ctx.tuiStatus.registerView` — a real card docked ABOVE THE PROMPT in
 *   the chat screen (the approval-panel slot family), chat visible and
 *   typable around it. 今日 split into ● 当前会话 vs ○ 其余 (today slices,
 *   never lifetime totals), 本月 line with a log-scaled sparkline, and a
 *   conditional ⚠ unpriced-share line. The HUD keeps everything session-
 *   live (ctx %, cache rate, the running session's meter); the card only
 *   ever speaks in cross-session aggregates plus the "where am I in
 *   today's pie" share the HUD cannot offer. Host rules: pointer-only,
 *   3 rows max — click the body to open the full view, ✕ / alt+p to
 *   dismiss. Without the tuiStatus seam, /pulse opens the full view.
 * - The full observatory is a SCENE (replaces the conversation) entered
 *   from the strip's click or /pulse-day|month|year|cost; Esc walks
 *   日 → 月 → 年 and the top-most Esc returns to the chat.
 * - `o` (or /pulse-sessions) opens the in-scene SESSION PICKER: palette-
 *   style framed list with type-to-filter, an explicit two-step confirm,
 *   then close + channel.resumeTo — the same seam the host's own /resume
 *   browser switches through.
 *
 * Rendering idioms come from dsh-tui's design system: theme keys via
 * ThemedText, the ProgressBar block-ladder + empty-as-background trick, an
 * inspector line under the cursor grid. Heat ramp colors mix
 * theme.background → theme.accent so /theme re-skins the whole scene.
 *
 * ZERO top-level external imports (react/ink come through scene props);
 * node builtins only. Module `inject` stays EMPTY — every seam is
 * soft-probed at apply time (#183 discipline).
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { foldEvents, projectOf, localDay, dayStart } from "./aggregate.js";
import {
	costOf, strictRulesWith, fullRulesWith,
	shiftDay, DEFAULT_USD_TO_CNY, moneyCny, splitModelKey,
} from "./view.js";

export const name = "pulse-tui";

/** No code-level service requirements: every seam is soft-probed (#183). */
export const inject = [];

/* ------------------------------------------------------------------ */
/* data                                                                */
/* ------------------------------------------------------------------ */

const TOKEN_KEYS = ["input", "output", "cacheRead", "cacheWrite"];

function addTok(target, source) {
	if (!source || typeof source !== "object") return;
	for (const key of TOKEN_KEYS) target[key] = (target[key] ?? 0) + (source[key] ?? 0);
}

function tokSum(t) {
	return (t?.input ?? 0) + (t?.output ?? 0) + (t?.cacheRead ?? 0) + (t?.cacheWrite ?? 0);
}

function compactTokens(n) {
	if (!Number.isFinite(n) || n <= 0) return "0";
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
	return String(Math.round(n));
}

/** Space-tight token abbreviation for squeezed table rows: 180.6M → 181M.
 *  Exported for test/tui-test.mjs. */
export function compactTokensTight(n) {
	if (!Number.isFinite(n) || n <= 0) return "0";
	if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}M`;
	if (n >= 1000) return `${Math.round(n / 1000)}k`;
	return String(Math.round(n));
}

function shortSessionId(id) {
	return String(id ?? "").replace(/^session-/, "").slice(0, 8);
}

function clockOf(ms) {
	const d = new Date(ms);
	if (!Number.isFinite(d.getTime())) return null;
	return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Session-id equality tolerant to prefix/suffix drift between the
 *  sessionQuery listing and the channel's live sessionId.
 *  Exported for test/tui-test.mjs. */
export function eqId(a, b) {
	if (!a || !b) return false;
	const x = String(a), y = String(b);
	return x === y || x.endsWith(y) || y.endsWith(x);
}

/** Display width of a string (CJK and full-width forms count 2) —
 *  String.padEnd counts JS chars and staircase-d any CJK-heavy table.
 *  Exported for test/tui-test.mjs. */
export function displayWidth(s) {
	let w = 0;
	for (const ch of String(s ?? "")) w += ch.charCodeAt(0) > 0xff ? 2 : 1;
	return w;
}

function padDisplay(text, width) {
	const s = String(text ?? "");
	const w = displayWidth(s);
	return w >= width ? s : s + " ".repeat(width - w);
}

function padDisplayStart(text, width) {
	const s = String(text ?? "");
	const w = displayWidth(s);
	return w >= width ? s : " ".repeat(width - w) + s;
}

/** Truncate to a display-width budget, then pad to exactly `width`. */
function fitDisplay(text, width) {
	const s = String(text ?? "");
	let out = "", w = 0;
	for (const ch of s) {
		const cw = ch.charCodeAt(0) > 0xff ? 2 : 1;
		if (w + cw > width) break;
		out += ch;
		w += cw;
	}
	return padDisplay(out, width);
}

/** Closing punctuation that may not START a wrapped line (basic kinsoku) —
 *  the year note once wrapped a lone "）" onto its own line. */
const CANNOT_START = new Set([..."）」』！？。，、：；…%》"]);

/** Display-width-aware greedy wrap. Hand-wrapped because Ink's naive wrap
 *  breaks on raw char counts (staircase) and strands closing punctuation.
 *  Exported for test/tui-test.mjs. */
export function wrapDisplay(text, width) {
	const s = String(text ?? "");
	const w = Math.max(1, width);
	if (displayWidth(s) <= w) return [s];
	const out = [];
	let line = "";
	for (const ch of s) {
		const cw = ch.charCodeAt(0) > 0xff ? 2 : 1;
		if (line !== "" && displayWidth(line) + cw > w) {
			out.push(line);
			line = "";
		}
		line += ch;
	}
	if (line !== "") out.push(line);
	for (let i = 1; i < out.length; i++) {
		while (out[i] !== "" && CANNOT_START.has(out[i][0])) {
			out[i - 1] += out[i][0];
			out[i] = out[i].slice(1);
		}
	}
	return out.filter((l) => l !== "");
}

/** Unified money label: ¥ never omitted, ≈ marks estimate-layer money.
 *  Bare numbers ("3.94" beside "138.5M tok") read as ambiguity — every
 *  amount in the scene goes through this. Exported for test/tui-test.mjs. */
export function money(cost, estimated) {
	const v = Number(cost);
	if (!Number.isFinite(v) || v <= 0) return "¥—";
	return `${estimated ? "≈" : ""}${moneyCny(v)}`;
}

/** Whole days from `a` to `b` (`b - a`). */
function dayDiff(a, b) {
	return Math.round((dayStart(b) - dayStart(a)) / 86400000);
}

/** Read one session through `sessionQuery` and fold it into a pulse record.
 *  Folding is memoized on the header's version stamp (updatedAt & co.) —
 *  an unchanged session refolds into the cached record instead of paying
 *  the full decode on every 30s poll and every scene reopen. `r` clears. */
const foldCache = new Map(); // id → { version, header, record }

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
function dayModelRows(record, day) {
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
function makePricing(config) {
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

function dayCost(record, day, pricing) {
	try {
		return costOf(dayModelRows(record, day), pricing.fullFor(day), pricing.fx, pricing.monthly).total ?? 0;
	} catch {
		return 0;
	}
}

/** Whether the estimate layer had to contribute money for this day — the
 *  ≈ flag shared by the day summary and the per-session ledger rows. */
function dayEstimatedOf(record, day, pricing) {
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
async function collect(ctx, entryConfig) {
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

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

function todayDay() {
	return localDay(Date.now());
}

/** Monday-first weekday index 0..6 of a `YYYY-MM-DD`. */
function weekdayOf(day) {
	return (new Date(dayStart(day)).getDay() + 6) % 7;
}

function monthOf(day) {
	return day.slice(0, 7);
}

function daysInMonth(month) {
	const [y, m] = month.split("-").map(Number);
	return new Date(y, m, 0).getDate();
}

/** All day keys of one month (clamped at today for the current month). */
function daysOfMonth(month) {
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
const YEAR_WEEKS = 53;

function yearWindow() {
	const today = todayDay();
	const start = shiftDay(today, -((YEAR_WEEKS - 1) * 7) - weekdayOf(today));
	return { start, end: today, weeks: YEAR_WEEKS };
}

function windowDays(from, to) {
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

/* ------------------------------------------------------------------ */
/* terminal drawing primitives (pure — no hooks)                       */
/* ------------------------------------------------------------------ */

/** Mix two #rrggbb colors; t=0 → a, t=1 → b. */
function hexMix(a, b, t) {
	const pa = parseHex(a), pb = parseHex(b);
	if (!pa || !pb) return b ?? a;
	const m = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
	return `#${m.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function parseHex(color) {
	const m = /^#?([0-9a-f]{6})$/i.exec(String(color ?? "").trim());
	if (!m) return null;
	const n = parseInt(m[1], 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Five-step activity ramp: empty tint, then background → accent mixes. */
function heatRamp(theme) {
	const bg = theme?.background ?? "#000000";
	const accent = theme?.accent ?? "#5f87ff";
	const tint = hexMix(bg, accent, 0.09);
	return [tint, hexMix(bg, accent, 0.3), hexMix(bg, accent, 0.52), hexMix(bg, accent, 0.74), accent];
}

/** Log-ish 0..4 heat level so one heavy day doesn't flatten the month. */
function heatLevel(value, max) {
	if (!Number.isFinite(value) || value <= 0 || max <= 0) return 0;
	return Math.max(1, Math.min(4, Math.ceil((Math.log1p(value) / Math.log1p(max)) * 4)));
}

const SPARK = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

function sparkline(values) {
	const max = values.reduce((m, v) => Math.max(m, v), 0);
	if (max <= 0) return SPARK[0].repeat(values.length);
	return values.map((v) => SPARK[Math.min(7, Math.floor((v / max) * 7.999))]).join("");
}

/** Single-row block sparkline, log1p-scaled. The year trend is heavy-tailed
 *  (one 138M day among zeros); linear scaling flattens every quiet week
 *  into the baseline — the braille chart's failure, now replaced.
 *  Exported for test/tui-test.mjs. */
export function sparkTrend(values) {
	const max = values.reduce((m, v) => Math.max(m, v), 0);
	if (max <= 0) return SPARK[0].repeat(values.length);
	const scale = Math.log1p(max);
	return values
		.map((v) => SPARK[v <= 0 ? 0 : Math.min(7, Math.floor((Math.log1p(v) / scale) * 7.999))])
		.join("");
}

/** Month trend as WEEKLY COLUMNS (2 cells per week, sqrt height): 30 daily
 *  points resampled into a dot chart read as noise — 4-6 named bars read
 *  as a chart. `labels` are the week-start day-of-month strings.
 *  Exported for test/tui-test.mjs. */
export function weeklyBars(values, labels, rows = 3) {
	const n = Math.max(values.length, labels.length);
	const max = values.reduce((m, v) => Math.max(m, v), 0);
	const heights = values.map((v) => (v <= 0 || max <= 0 ? 0 : Math.max(1, Math.round(Math.sqrt(v / max) * rows))));
	const lines = [];
	for (let r = rows; r >= 1; r--) {
		lines.push(Array.from({ length: n }, (_, i) => ((heights[i] ?? 0) >= r ? "██" : "  ")).join(" "));
	}
	const labelLine = Array.from({ length: n }, (_, i) => padDisplayStart(labels[i] ?? "", 2)).join(" ");
	let peakIdx = -1, peakVal = 0;
	values.forEach((v, i) => { if (v > peakVal) { peakVal = v; peakIdx = i; } });
	return { lines, heights, labelLine, peakIdx, peakVal };
}

const BLOCKS = [" ", "▏", "▎", "▍", "▌", "▋", "▊", "▉", "█"];

/** dsh-tui ProgressBar idiom: block ladder, empty stretch as background. */
function barString(ratio, width) {
	const r = Math.min(1, Math.max(0, ratio));
	const whole = Math.floor(r * width);
	let out = BLOCKS[8].repeat(whole);
	if (whole < width) {
		out += BLOCKS[Math.floor((r * width - whole) * 8)];
		out += BLOCKS[0].repeat(Math.max(0, width - whole - 1));
	}
	return out;
}

/** Responsive model-row budget (exported for tests). The fixed ~70-col row
 *  content staircased at ~61-col right columns — the ladder shrinks the
 *  bar first, then the token number, then %/track, then the name, so the
 *  row NEVER wraps. Each step's exact display width is computed so tests
 *  can pin the layout to the terminal budget. */
const MODEL_ROW_STEPS = [
	{ name: 22, bar: 12, pct: true, tokPad: 7, tight: false, cost: true },
	{ name: 22, bar: 8, pct: true, tokPad: 7, tight: false, cost: true },
	{ name: 22, bar: 8, pct: true, tokPad: 5, tight: true, cost: true },
	{ name: 18, bar: 6, pct: true, tokPad: 5, tight: true, cost: true },
	{ name: 16, bar: 6, pct: false, tokPad: 5, tight: true, cost: true },
	{ name: 14, bar: 0, pct: false, tokPad: 5, tight: true, cost: false },
];

function modelRowWidth(step) {
	return step.name
		+ (step.bar > 0 ? step.bar + 1 : 0)
		+ (step.pct ? 4 : 0)
		+ step.tokPad + 1
		+ 3 // 计价 tag
		+ (step.cost ? 10 : 0); // " ≈¥123.45"
}

/** Exported for test/tui-test.mjs. */
export function modelLayout(rightW) {
	const inner = Math.max(20, rightW - 2);
	for (const step of MODEL_ROW_STEPS) {
		if (modelRowWidth(step) <= inner) return step;
	}
	return MODEL_ROW_STEPS[MODEL_ROW_STEPS.length - 1];
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

/** Day-view 分时 gantt (pure; exported shape for tests): one row per
 *  session, one cell group per hour, ▓ band marking the peak-billing
 *  hours, plus the per-hour totals the old 活跃时段 strip showed.
 *  Exported for test/tui-test.mjs. */
export function ganttRows(sessions, day, width, peakSet) {
	const labelW = 12;
	const colsPerHour = Math.max(1, Math.min(2, Math.floor((Math.max(width, 40) - labelW - 2) / 24)));
	const spanW = colsPerHour * 24;
	const hours = new Array(24).fill(0);
	const rows = sessions.map((s) => {
		const dayHours = s.record?.hoursByDay?.[day] ?? {};
		const cells = [];
		for (let hh = 0; hh < 24; hh++) {
			let sum = 0;
			for (const t of Object.values(dayHours[String(hh)] ?? {})) sum += tokSum(t);
			hours[hh] += sum;
			cells.push((sum > 0 ? "█" : " ").repeat(colsPerHour));
		}
		return { id: s.id, label: fitDisplay(s.title ?? shortSessionId(s.id), labelW), span: cells.join("") };
	});
	let peakHour = 0, peakTok = 0;
	hours.forEach((v, i) => { if (v > peakTok) { peakTok = v; peakHour = i; } });
	const band = Array.from({ length: 24 }, (_, hh) => (peakSet?.has(hh) ? "▓" : " ").repeat(colsPerHour)).join("");
	return { hours, peakHour, spanW, band, rows };
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

/* ------------------------------------------------------------------ */
/* view                                                                */
/* ------------------------------------------------------------------ */

function makeSceneComponent(ctx, entryConfig) {
	let kit = null;
	return function PulseScene(props) {
		const { React, ui, close, channel } = props;
		kit ??= makeViewKit(React, ui);
		return renderScene(kit, { close, ctx, entryConfig, channel });
	};
}

function makeViewKit(React, ui) {
	return {
		React, ui,
		h: React.createElement,
		Box: ui.Box,
		Text: ui.Text,
		useInput: ui.useInput,
		useTheme: ui.useTheme,
		useTerminalSize: ui.useTerminalSize,
	};
}

/** Cross-component breadcrumb: 近一年 ▸ 2026年9月 ▸ 09-28 周一. Ancestors
 *  render dim so "where am I" survives the mini-card → 全量 → drill path. */
function crumbLine(kit, parts) {
	const { h, Box, Text } = kit;
	const out = [];
	parts.forEach((p, i) => {
		if (i > 0) out.push(h(Text, { key: `s${i}`, color: "inactive" }, " ▸ "));
		out.push(h(Text, { key: `p${i}-${p.label}`, bold: !!p.hot, color: p.hot ? "accent" : "inactive" }, p.label));
	});
	return h(Box, null, ...out);
}

function renderScene(kit, { close, ctx, entryConfig, channel }) {
	const { React, h, Box, Text } = kit;
	const [theme] = kit.useTheme();
	const size = kit.useTerminalSize?.() ?? {};
	const cols = Number(size?.columns) || 80;
	const termRows = Number(size?.rows) || 24;

	/* Entry intent — command handlers stage `bootIntent` right before
	 * tuiScenes.open; the scene consumes it once on mount. The scene is
	 * ALWAYS the full observatory: the mini card lives in the chat screen
	 * as a tuiStatus view above the prompt (a scene would blank the chat
	 * — "a floating card" rendered over nothing is just an empty page). */
	const boot = React.useState(takeBootIntent)[0];
	const bootLevel = boot.kind === "full" && boot.level ? boot.level : "day";
	const [picker, setPicker] = React.useState(boot.kind === "picker" ? { query: "", selected: 0, confirming: false } : null);
	const [help, setHelp] = React.useState(false);
	const today = todayDay();
	const [level, setLevel] = React.useState(bootLevel); // month | year | day
	const [cursor, setCursor] = React.useState(boot.day ?? today);
	const [metric, setMetric] = React.useState(boot.metric ?? "tokens"); // tokens | cost
	const [sort, setSort] = React.useState("time"); // time | tokens (day level)
	const [hint, setHint] = React.useState(null);
	const [state, setState] = React.useState({ status: "loading" });
	const [yearOffset, setYearOffset] = React.useState(0); // year-grid page, in weeks back from the recent edge
	const [focusModel, setFocusModel] = React.useState(null); // click-to-dim model filter
	const [hoverDay, setHoverDay] = React.useState(null); // mouse hover highlight

	/* The strip's ●当前 marker needs the live session id; the scene is the
	 * only place the channel port reaches — stash it for the strip. */
	if (channel?.sessionId) lastSeenSessionId = String(channel.sessionId);

	/** P0: cap the content column on very wide terminals, PER VIEW — the
	 *  year heatmap legitimately eats columns (26/53 weeks visible was the
	 *  price of the old single 148 cap), the reading views don't. */
	const contentW = Math.max(40, Math.min(cols - 2, level === "year" ? 190 : 148));

	const pull = React.useCallback((force) => {
		if (force) foldCache.clear();
		collect(ctx, entryConfig)
			.then((data) => setState({ status: "ok", data }))
			.catch((error) => setState({ status: "error", message: error?.message ?? String(error) }));
	}, [ctx, entryConfig]);

	React.useEffect(() => {
		pull();
		const timer = setInterval(pull, 30_000);
		return () => clearInterval(timer);
	}, [pull]);

	const data = state.status === "ok" ? state.data : null;
	const config = data?.config ?? entryConfig ?? {};
	const pricing = React.useMemo(() => makePricing(config), [config]);

	const days = React.useMemo(() => (
		data && !data.empty
			? level === "month" ? daysOfMonth(monthOf(cursor))
				: level === "year" ? windowDays(yearWindow().start, today)
					: [cursor]
			: []
	), [data, level, cursor, today]);
	const cal = React.useMemo(() => (data && !data.empty && level !== "day" ? viewSlice(data.record, days, pricing) : null),
		[data, level, days, pricing]);

	/** Session picker rows: lifetime tok + money per session, the ● 当前
	 *  marker from the channel's live sessionId, filtered by the query. */
	const pickerRows = React.useMemo(() => {
		if (!picker || !data || data.empty) return [];
		const q = String(picker.query ?? "").trim().toLowerCase();
		const rows = data.sessions.map((s) => ({
			id: s.id,
			title: s.title ?? shortSessionId(s.id),
			day: s.recency > 0 ? localDay(s.recency) : null,
			recency: s.recency ?? 0,
			tok: Object.values(s.record?.byDay ?? {}).reduce((sum, t) => sum + tokSum(t), 0),
			cost: pricing.costEnabled
				? Object.keys(s.record?.byDay ?? {}).reduce((sum, d) => sum + dayCost(s.record, d, pricing), 0)
				: 0,
			estimated: pricing.costEnabled
				&& Object.keys(s.record?.byDay ?? {}).some((d) => dayEstimatedOf(s.record, d, pricing)),
			current: eqId(s.id, channel?.sessionId),
		}));
		const filtered = q === ""
			? rows
			: rows.filter((r) => r.title.toLowerCase().includes(q) || String(r.id).toLowerCase().includes(q));
		return filtered.sort((a, b) => b.recency - a.recency);
	}, [picker, data, pricing, channel]);

	const openPicker = React.useCallback(() => {
		setPicker({ query: "", selected: 0, confirming: false });
	}, []);

	/** One-day cursor step for the day view's mouse wheel (clamped). */
	const stepDay = React.useCallback((dir) => {
		setCursor((cur) => {
			const next = shiftDay(cur, dir);
			return next > today ? today : next;
		});
	}, [today]);

	/** One-week cursor step for the month/year grids' mouse wheel. */
	const onStepWeek = React.useCallback((dir) => {
		setCursor((cur) => {
			const next = shiftDay(cur, dir * 7);
			return next > today ? today : next;
		});
	}, [today]);

	/** Two-step inline confirm, then leave the scene BEFORE swapping the
	 *  live agent — the confirmation panel must never race the unmount. */
	const switchToSession = React.useCallback(async (row) => {
		setPicker(null);
		close?.();
		if (!channel || typeof channel.resumeTo !== "function") {
			ctx.logger?.warn?.("pulse-tui: channel.resumeTo unavailable — session switch aborted");
			return;
		}
		try {
			await channel.resumeTo(row.id);
		} catch (error) {
			ctx.logger?.warn?.(`pulse-tui: resumeTo(${shortSessionId(row.id)}) failed: ${error?.message ?? error}`);
		}
	}, [channel, close, ctx]);

	const exportCsv = React.useCallback(() => {
		if (!data || data.empty) { setHint("没有可导出的数据"); return; }
		try {
			const cost = pricing.costEnabled;
			let rows;
			if (level === "day") {
				rows = [
					["session", "title", "date", "time", "turns", "tokens", ...(cost ? ["cost_cny", "pricing"] : [])],
					["会话ID", "标题", "日期", "时段", "轮次", "tokens数", ...(cost ? ["费用(CNY)", "计价"] : [])],
				];
				for (const r of dayRowsOf(data, cursor, pricing, sort, channel?.sessionId)) {
					rows.push([
						r.id,
						`"${String(r.title).replace(/"/g, '""')}"`,
						cursor, r.clock ?? "", r.turns, r.tokens,
						...(cost ? [r.cost.toFixed(4), r.estimated ? "估算" : "按量"] : []),
					]);
				}
			} else {
				rows = [
					["date", "provider", "model", "input", "output", "cache_read", "cache_write", "tokens", ...(cost ? ["cost_cny", "pricing"] : [])],
					["日期", "厂商", "模型", "输入", "输出", "缓存读", "缓存写", "tokens数", ...(cost ? ["费用(CNY)", "计价"] : [])],
				];
				for (const day of days) {
					for (const row of dayModelRows(data.record, day)) {
						const meta = splitModelKey(row.key);
						const tokens = (row.input ?? 0) + (row.output ?? 0) + (row.cacheRead ?? 0) + (row.cacheWrite ?? 0);
						if (tokens === 0) continue;
						const c = cost ? costOf([row], pricing.fullFor(day), pricing.fx, pricing.monthly).total : null;
						rows.push([
							day, meta.provider, `"${String(meta.model).replace(/"/g, '""')}"`,
							row.input ?? 0, row.output ?? 0, row.cacheRead ?? 0, row.cacheWrite ?? 0, tokens,
							...(cost ? [c === null ? "" : c.toFixed(4), pricingLabelOf(row, day, pricing)] : []),
						]);
					}
				}
			}
			const file = level === "day"
				? join(process.cwd(), `pulse-${cursor}-sessions.csv`)
				: join(process.cwd(), `pulse-${days[0]}_${days[days.length - 1]}.csv`);
			writeFileSync(file, "\uFEFF" + rows.map((r) => r.join(",")).join("\n") + "\n", "utf8");
			setHint(`已导出 ${file}（${rows.length - 2} 行数据，含表头与单位行）`);
		} catch (error) {
			setHint(`导出失败：${error?.message ?? error}`);
		}
	}, [data, level, cursor, days, pricing, sort, channel]);

	/** Zoom out, keeping the cursor inside the year's visible window. */
	function zoomTo(next) {
		if (next === "year") {
			const { start } = yearWindow();
			setCursor((cur) => (cur < start ? start : cur));
		}
		setLevel(next);
	}

	kit.useInput((input, key) => {
		/* help overlay: any key dismisses */
		if (help) { setHelp(false); return; }

		/* session picker: owns the keyboard while open */
		if (picker) {
			const p = picker;
			if (key?.escape) {
				setPicker(p.confirming ? { ...p, confirming: false } : null);
				return;
			}
			if (key?.return) {
				const sel = Math.min(p.selected, pickerRows.length - 1);
				const row = pickerRows[sel];
				if (!row) return;
				if (!p.confirming) setPicker({ ...p, confirming: true });
				else void switchToSession(row);
				return;
			}
			if (key?.upArrow || key?.downArrow) {
				if (p.confirming) return;
				const delta = key.upArrow ? -1 : 1;
				setPicker({ ...p, confirming: false, selected: Math.max(0, Math.min(pickerRows.length - 1, p.selected + delta)) });
				return;
			}
			if (key?.backspace || key?.delete) {
				setPicker({ ...p, confirming: false, query: p.query.slice(0, -1), selected: 0 });
				return;
			}
			if (typeof input === "string" && input !== "" && !key?.ctrl && !key?.meta && input.trim() !== "") {
				setPicker({ ...p, confirming: false, query: p.query + input, selected: 0 });
			}
			return;
		}

		/* full observatory — Esc means LEAVE from EVERY view (no ladder);
		 * view switches are explicit keys, never an escape itinerary. */
		if (input === "q" || key?.escape) { close?.(); return; }
		if (input === "r") { pull(true); setHint("已刷新"); return; }
		if (input === "t" && pricing.costEnabled) { setMetric((m) => (m === "tokens" ? "cost" : "tokens")); return; }
		if (input === "e") { exportCsv(); return; }
		if (input === "o") { openPicker(); return; }
		if (input === "?") { setHelp(true); return; }
		if (input === "s" && level === "day") { setSort((s) => (s === "time" ? "tokens" : "time")); return; }
		if (input === "y") { zoomTo("year"); return; }
		if (input === "m") { setLevel("month"); return; }
		if (input === "d") { setLevel("day"); return; }
		if (level === "year" && (input === "[" || input === "]")) {
			setYearOffset((o) => {
				const next = input === "[" ? o + 4 : o - 4;
				return Math.max(0, Math.min(YEAR_WEEKS - 8, next));
			});
			return;
		}
		if (key?.return) {
			if (level === "year") setLevel("month");
			else if (level === "month") setLevel("day");
			return;
		}
		/* ↑↓ follow the view's spatial metaphor: the day ledger steps one
		 * DAY (the old ±7 jumped a week and lost people); the month and
		 * year grids step one ROW (a week). Shift+↑↓ fast-paths ±7. */
		const unit = level === "day" ? 1 : 7;
		let step = 0;
		if (key?.leftArrow) step = -1;
		else if (key?.rightArrow) step = 1;
		else if (key?.upArrow) step = key.shift ? -7 : -unit;
		else if (key?.downArrow) step = key.shift ? 7 : unit;
		if (step !== 0) {
			setCursor((cur) => {
				let next = shiftDay(cur, step);
				if (next > today) next = today;
				// The year grid only draws the recent window — keep the cursor on it.
				if (level === "year") {
					const { start } = yearWindow();
					if (next < start) next = start;
				}
				return next;
			});
		}
	});

	const ramp = heatRamp(theme);

	/* header */
	const totalText = level === "day" || !cal
		? null
		: metric === "cost" && pricing.costEnabled
			? `窗口合计 ${cal.windowCost.total === null ? "—" : money(cal.windowCost.total, cal.windowCost.estimated)}`
			: `窗口合计 ${compactTokens(cal.tokens)} tok`;
	const scopeLabel = level === "month"
		? `${monthOf(cursor).slice(0, 4)}年${Number(monthOf(cursor).slice(5, 7))}月`
		: level === "year" ? "近一年" : `${cursor} 周${WEEKDAYS[weekdayOf(cursor)]}`;
	const freshLabel = data?.loadedAt ? `截至 ${clockOf(data.loadedAt)}` : null;
	const header = h(Box, { justifyContent: "space-between", width: "100%" },
		h(Text, { bold: true, color: "accent" }, `✦ pulse · ${data?.project ?? "…"}`),
		h(Box, { gap: 2 },
			totalText ? h(Text, { color: "subtle" }, totalText) : null,
			freshLabel ? h(Text, { color: "inactive" }, freshLabel) : null,
			h(Text, { color: "text" }, scopeLabel)));
	const divider = h(Text, { color: "inactive" }, "─".repeat(Math.max(10, contentW)));
	const hintLine = h(Text, { color: "subtle" },
		(hint ? `${hint}    ` : "")
		+ (level === "day"
			? "y 年 · m 月 · ←→↑↓ 换日(Shift±7) · s 排序 · o 会话 · ? 帮助 · e 导出CSV · Esc/q 关闭"
			: `y 年 · m 月 · d 日 · ←→↑↓ 移动(Shift±7) · Enter 钻取${pricing.costEnabled ? " · t 成本/token" : ""}${level === "year" ? " · [ ] 翻页" : ""} · o 会话 · ? 帮助 · e 导出CSV · Esc/q 关闭`));

	let body;
	if (state.status === "error") {
		body = h(Text, { color: "error" }, `读取失败：${state.message}`);
	} else if (state.status !== "ok") {
		body = h(Text, { color: "subtle" }, "读取中…");
	} else if (data.empty) {
		body = h(Text, { color: "subtle" }, "本工作区还没有任何会话。全量视图见 dsh web 的用量观测台。");
	} else if (picker) {
		body = renderPicker(kit, {
			rows: pickerRows, picker, cols, termRows, pricing,
		});
	} else if (help) {
		body = renderHelp(kit, { cols, termRows, pricing, level });
	} else if (level === "day") {
		body = renderDay(kit, {
			data, pricing, cursor, sort, contentW, termRows, currentId: channel?.sessionId,
			onStepDay: stepDay,
		});
	} else {
		body = renderCalendar(kit, {
			data, cal, pricing, cursor, metric, level, contentW, termRows, ramp, today, theme, days,
			yearOffset, focusModel, setFocusModel, hoverDay, setHoverDay,
			setCursor, setLevel, onStepWeek,
		});
	}

	/* P0: ultra-wide terminals centered the old layout hard-left and
	 * stranded half the screen — center the capped content column. */
	return h(Box, { flexDirection: "row", justifyContent: "center", width: cols },
		h(Box, { flexDirection: "column", paddingX: 1, width: Math.min(cols, contentW + 2) },
			header, divider, body, h(Text, null, " "), hintLine));
}

/* ---- pulse strip: the mini card docked ABOVE THE PROMPT ----
 *
 * Rendered through `ctx.tuiStatus.registerView` — host chrome in the chat
 * screen, the slot family of the approval panel. The chat stays live around
 * it (scrollable, typable) while the card shows the pulse summary. Host
 * rules: pointer-interactive but keyboard-less, clipped at 3 rows, so every
 * line is load-bearing — head(截至/✕), the 今日 ●当前/○其余 tree, month +
 * log sparkline + ⚠未计价 + 点击提示. Clicking the body opens the full
 * observatory on today; ✕ (or alt+p, or /pulse again) dismisses it. */

let lastSeenSessionId = null;
let pulseOpenRef = null;
let stripDisposer = null;

const stripStore = {
	ctx: null, entryConfig: null,
	snap: { status: "loading" },
	listeners: new Set(),
	timer: null,
	subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); },
	getSnap() { return this.snap; },
	emit() { for (const l of [...this.listeners]) l(); },
	async refresh(force) {
		const { ctx, entryConfig } = this;
		if (!ctx) return;
		if (force) foldCache.clear();
		try {
			const data = await collect(ctx, entryConfig);
			this.snap = { status: "ok", data, pricing: makePricing(data.config ?? {}) };
		} catch (error) {
			this.snap = { status: "error", message: error?.message ?? String(error) };
		}
		this.emit();
	},
};

function makeStripComponent() {
	return function PulseStrip(props) {
		const { React, ui } = props;
		const h = React.createElement;
		const Box = ui.Box, Text = ui.Text;
		const snap = React.useSyncExternalStore(
			(listener) => stripStore.subscribe(listener),
			() => stripStore.getSnap(),
		);
		const data = snap.status === "ok" ? snap.data : null;
		const today = todayDay();
		const pricing = snap.pricing ?? makePricing({});
		const mini = data && !data.empty ? miniCardModel(data, pricing, today, lastSeenSessionId) : null;

		const openFull = () => pulseOpenRef?.({ kind: "full", level: "day", day: today });
		const dismiss = (event) => { event?.stopImmediatePropagation?.(); pulseStripToggle(false); };

		/* Framed card, × on the RIGHT SIDE, vertically centered — the same
		 * affordance idiom as the host composer's side icon. borderStyle
		 * draws the frame (adapts to the slot, never overflows it: a manual
		 * frame sized `cols-2` wrapped its corner out of the card). Rows:
		 * border top/bottom + 1 dense content line = 3 = the host cap. */
		const size = ui.useTerminalSize?.() ?? {};
		const cols = Number(size?.columns) || 80;
		const innerW = Math.max(24, cols - 10); // slot padding + borders + side column safety margin
		const rows = [];
		if (snap.status === "error") {
			rows.push([h(Text, { key: "err", color: "error" }, fitDisplay(`pulse 读取失败：${snap.message}`, innerW))]);
		} else if (snap.status !== "ok" || !mini) {
			rows.push([h(Text, { key: "load", color: "subtle" }, "pulse 统计中…")]);
		} else if (data.empty) {
			rows.push([h(Text, { key: "empty", color: "subtle" }, "本工作区还没有任何会话")]);
		} else {
			const t = mini.today;
			const m = mini.month;
			// Priority-ordered segments; greedy packing against innerW.
			const wanted = [];
			wanted.push({ text: t.all.count === 0
				? "今日 — 无用量"
				: `今日 ${compactTokens(t.all.tok)} tok ${money(t.all.cost, t.all.estimated)} · ${t.all.count} 会话` });
			wanted.push({ text: `本月 ${compactTokens(m.tok)} tok${pricing.costEnabled ? ` ${money(m.cost, m.estimated)}` : ""}` });
			if (pricing.costEnabled && m.unpricedPct > 0) {
				wanted.push({ text: `⚠未计价${Math.round(m.unpricedPct * 100)}%·${m.unpricedCount}模型`, color: "warning" });
			}
			// The ● marker needs the live session id — stashed by the scene.
			// Unknown means NO split: inventing one would be a lie.
			if (t.hasCurrent) {
				wanted.push({ text: t.current
					? `● 当前 ${compactTokens(t.current.tok)} tok ${money(t.current.cost, t.current.estimated)}${t.all.tok > 0 ? ` 占${Math.round((t.current.tok / t.all.tok) * 100)}%` : ""}`
					: "● 当前 今日暂无用量", color: "subtle" });
			}
			if (m.series.some((v) => v > 0)) {
				wanted.push({ text: `${sparkTrend(m.series)}${m.peakDay ? ` 峰${m.peakDay.slice(5)}` : ""}`, color: "accent" });
			}
			wanted.push({ text: t.others.count > 0
				? `○ 其余 ${t.others.count} 会话 ${compactTokens(t.others.tok)} tok`
				: `○ 今日无${t.hasCurrent ? "其他" : ""}会话`, color: "inactive" });
			const sep = " · ";
			const chosen = [];
			let used = 0;
			for (const part of wanted) {
				const add = (chosen.length > 0 ? displayWidth(sep) : 0) + displayWidth(part.text);
				if (used + add > innerW && chosen.length >= 2) break;
				chosen.push(part);
				used += add;
			}
			const cells = [];
			chosen.forEach((part, i) => {
				if (i > 0) cells.push(h(Text, { key: `s${i}`, color: "inactive" }, sep));
				cells.push(h(Text, { key: `p${i}`, color: part.color }, part.text));
			});
			rows.push(cells);
		}
		return h(Box, {
			flexDirection: "row",
			borderStyle: "round",
			borderColor: "subtle",
			onClick: openFull,
		},
			h(Box, { flexDirection: "column", flexGrow: 1, justifyContent: "center" },
				...rows.map((cells, i) => h(Box, { key: `r${i}` }, ...cells))),
			h(Box, {
				flexDirection: "column", justifyContent: "center", flexShrink: 0,
				onClick: dismiss,
			}, h(Text, { color: "subtle" }, "× ")));
	};
}

const stripComponent = makeStripComponent();

/** Show/hide the strip; `desired` omitted = toggle. When the tuiStatus
 *  seam is unavailable (old host / unmounted service) the caller falls
 *  back to opening the full observatory instead. */
function pulseStripToggle(desired) {
	const ctx = stripStore.ctx;
	const status = ctx?.get?.("tuiStatus", false);
	if (!status || typeof status.registerView !== "function") {
		ctx?.logger?.warn?.("pulse-tui: tuiStatus seam unavailable — no prompt-top mini card on this host");
		return false;
	}
	const show = desired ?? stripDisposer === null;
	if (show && stripDisposer === null) {
		void stripStore.refresh(false);
		stripStore.timer ??= setInterval(() => void stripStore.refresh(false), 30_000);
		const disposer = status.registerView({ key: "pulse", maxRows: 3, component: stripComponent }, ctx);
		if (typeof disposer !== "function") {
			ctx.logger?.warn?.("pulse-tui: strip registration refused (host row budget exhausted?) — open the full scene instead");
			return false;
		}
		stripDisposer = disposer;
		return true;
	}
	if (!show && stripDisposer !== null) {
		stripDisposer();
		stripDisposer = null;
		if (stripStore.timer) { clearInterval(stripStore.timer); stripStore.timer = null; }
		return true;
	}
	return false;
}

function renderPicker(kit, { rows, picker, cols, termRows, pricing }) {
	const { h, Box, Text } = kit;
	const cardW = Math.max(40, Math.min(76, cols - 4));
	const listH = Math.max(3, Math.min(12, termRows - 10));
	const sel = Math.max(0, Math.min(picker.selected, rows.length - 1));
	const start = Math.max(0, Math.min(sel - listH + 1, Math.max(0, rows.length - listH)));
	const visible = rows.slice(start, start + listH);

	const rowLines = visible.length === 0
		? [h(Text, { key: "none", color: "subtle" }, "没有匹配的会话")]
		: visible.map((r, i) => {
			const idx = start + i;
			const marker = r.current ? "●" : " ";
			const title = fitDisplay(r.title, 30);
			const day = r.day ? r.day.slice(5) : "—";
			const tok = padDisplayStart(compactTokens(r.tok), 8);
			const cost = pricing.costEnabled ? ` ${money(r.cost, r.estimated)}` : "";
			if (idx === sel) {
				return h(Text, { key: r.id, inverse: true, color: "accent" },
					padDisplay(`${marker} ${title}  ${day}  ${tok}${cost}`, cardW - 4));
			}
			return h(Box, { key: r.id, gap: 0 },
				h(Text, { color: r.current ? "accent" : "inactive" }, `${marker} `),
				h(Text, null, title),
				h(Text, { color: "inactive" }, `  ${day}  `),
				h(Text, { color: "subtle" }, `${tok}${cost}`));
		});

	const footerText = picker.confirming
		? `↵ 确认切换到「${fitDisplay(rows[sel]?.title ?? "", Math.max(10, cardW - 24))}」 · Esc 取消`
		: "输入过滤 · ↑↓ 选择 · Enter 切换 · Esc 关闭";

	return h(Box, { flexDirection: "row", justifyContent: "center", width: cols, paddingTop: Math.max(0, Math.floor(termRows / 2) - 8) },
		h(Box, {
			flexDirection: "column", width: cardW, paddingX: 1,
			borderStyle: "round", borderColor: picker.confirming ? "warning" : "accent",
		},
			h(Box, { justifyContent: "space-between" },
				h(Text, { bold: true, color: "accent" }, "切换会话"),
				h(Text, { color: "inactive" }, `共 ${rows.length} 项`)),
			...rowLines,
			h(Text, { color: picker.confirming ? "warning" : "subtle" }, footerText)));
}

function renderHelp(kit, { cols, termRows, pricing, level }) {
	const { h, Box, Text } = kit;
	const cardW = Math.max(44, Math.min(72, cols - 4));
	const lines = [
		["导航", "Esc / q 任何视图直接退出 · y 年 · m 月 · d 日\n←→ ±1天 · ↑↓ ±1天(日)/±1周(月·年) · Shift+↑↓ ±7 · Enter 钻取"],
		["视图", `t 成本/token${pricing.costEnabled ? "" : "（已停用）"} · s 排序(日)${level === "year" ? " · [ ] 年窗口翻页" : ""}`],
		["工具", "e 导出CSV（含计价列与单位行） · o 会话切换 · r 刷新 · ? 本帮助"],
		["鼠标", "点日历格选中(再点钻取) · 点模型行聚焦 · 滚轮换日/移周"],
		["迷你卡", "alt+p 或 /pulse 开关（悬浮在输入框上方） · 点卡片进今日 · × 收起"],
	];
	return h(Box, { flexDirection: "row", justifyContent: "center", width: cols, paddingTop: Math.max(0, Math.floor(termRows / 2) - 7) },
		h(Box, { flexDirection: "column", width: cardW, paddingX: 1, borderStyle: "round", borderColor: "subtle" },
			h(Text, { bold: true, color: "accent" }, "pulse 键位"),
			...lines.map(([k, v]) => h(Box, { key: k, gap: 1 },
				h(Text, { color: "subtle" }, `${k} `),
				h(Text, null, v))),
			h(Text, { color: "inactive" }, "任意键返回")));
}

/* ---- year / month: heatmap grid + weekly trend + breakdowns ---- */

function renderCalendar(kit, {
	cal, pricing, cursor, metric, level, contentW, termRows, ramp, today, theme, days,
	yearOffset, focusModel, setFocusModel, hoverDay, setHoverDay,
	setCursor, setLevel, onStepWeek,
}) {
	const { h, Box, Text } = kit;
	const monthMode = level === "month";
	const accent = theme?.accent ?? "#5f87ff";
	const text = theme?.text ?? "#ffffff";
	const byCost = metric === "cost" && pricing.costEnabled;
	const valueOf = (day) => {
		const v = cal.values.get(day);
		return !v ? 0 : byCost ? v.cost : v.tok;
	};
	const maxValue = byCost ? cal.maxCost : cal.maxTok;

	/* ---- P0: decide the layout BEFORE building the grid. The old code
	 * sized the year grid to the full terminal (weeks ≈ cols/3) and then
	 * asked a `cols >= 100` row layout to fit a second column next to it —
	 * the right column collapsed to ~2 chars and wrapped per character.
	 * Now the left column gets a bounded budget and the two-column split
	 * only happens when BOTH sides truly fit. The year grid takes a wider
	 * share than the month's fixed 44 (the heatmap is the year's whole
	 * point), so wide terminals show 30+ of the 53 weeks. */
	const rightMin = 46;
	const leftW = monthMode ? 44 : Math.min(contentW, Math.floor(contentW * 0.6));
	const twoCol = contentW >= 92 && contentW - leftW >= rightMin;
	const rightW = twoCol ? Math.max(rightMin, contentW - leftW - 3) : contentW;
	const gridBudget = twoCol ? leftW : contentW;
	const fitWeeks = monthMode
		? 0
		: Math.max(8, Math.min(YEAR_WEEKS, Math.floor((gridBudget - 3) / 3)));

	/* ---- P0: vertical budget — model rows and extras shrink with the
	 * terminal so header and footer always stay on screen. */
	const avail = Math.max(8, termRows - 6); // chrome: header + divider + blank + hint + slack
	const notesN = (cal.unpriced.length > 0 ? 1 : 0) + (cal.windowCost.estimated ? 1 : 0);
	const weekCount = monthMode
		? Math.ceil((weekdayOf(`${monthOf(cursor)}-01`) + daysInMonth(monthOf(cursor))) / 7)
		: 7;
	const leftH = monthMode ? weekCount + 8 : 15; // grid + inspector + chips + legend + range hint
	const fixedRight = 12 + notesN; // trend(2-5) + tier(1) + 模型标题(1) + footer(1) + gaps(4)
	let dropTrend = false, dropTier = false;
	let modelN;
	if (twoCol) {
		modelN = Math.min(8, Math.max(2, avail - fixedRight));
	} else {
		modelN = Math.min(6, Math.max(1, avail - leftH - 1 - fixedRight));
		if (modelN <= 1) {
			dropTrend = true;
			dropTier = true;
			modelN = Math.min(6, Math.max(1, avail - leftH - 1 - (fixedRight - 4)));
		}
	}

	/* ---- grid cells. Month cells always carry their two-digit day number;
	 * foreground is mixed from the cell's heat color toward the theme text
	 * so every heat level keeps contrast, weekends stay dimmer, and today
	 * reads in accent. Hover brightens the candidate cell (mouse). */
	const month = monthOf(cursor);
	const cellFor = (day, inMonth) => {
		if (!inMonth) return h(Text, { key: day }, "  ");
		const hovered = day === hoverDay && day !== cursor && day <= today;
		if (day === cursor) {
			return h(Text, {
				key: day, inverse: true, color: "accent",
				onClick: monthMode ? () => setLevel("day") : undefined,
			}, monthMode ? day.slice(8) : "██");
		}
		if (day > today) return h(Text, { key: day }, "  ");
		if (day === today && !monthMode) return h(Text, { key: day, inverse: true }, "  ");
		const lv = heatLevel(valueOf(day), maxValue);
		if (monthMode) {
			const weekend = weekdayOf(day) >= 5;
			const bg = lv > 0 ? ramp[lv] : ramp[0];
			const fg = day === today
				? "accent"
				: hexMix(bg, text, weekend && !hovered ? 0.55 : 0.85);
			return h(Text, {
				key: day, backgroundColor: bg, color: fg,
				onClick: () => { setCursor(day); setHoverDay(null); },
				onMouseEnter: () => setHoverDay(day),
				onMouseLeave: () => setHoverDay((d) => (d === day ? null : d)),
			}, day.slice(8));
		}
		// Year zeros keep a faint tint so the grid's extent reads (GitHub style).
		return h(Text, {
			key: day, backgroundColor: lv > 0 ? ramp[lv] : ramp[0],
			color: hovered ? "accent" : undefined,
			onClick: () => { setCursor(day); setHoverDay(null); },
			onMouseEnter: () => setHoverDay(day),
			onMouseLeave: () => setHoverDay((d) => (d === day ? null : d)),
		}, "  ");
	};

	const gridRows = [];
	let gridTitle = null, weekHeader = null, monthLabels = null, rangeHint = null, legend = null;
	if (monthMode) {
		const first = `${month}-01`;
		const offset = weekdayOf(first);
		const total = daysInMonth(month);
		gridTitle = h(Box, { gap: 0 },
			h(Text, { color: "inactive" }, "近一年 ▸ "),
			h(Text, { bold: true, color: "text" }, `${month.slice(0, 4)}年${Number(month.slice(5, 7))}月`));
		// Header cells are exactly 2 columns wide so the pitch matches the
		// day cells (the old " 一" headers drifted one column per week).
		weekHeader = h(Box, { gap: 1 }, ...WEEKDAYS.map((w) => h(Text, { key: w, color: "subtle" }, w)));
		for (let w = 0; w < weekCount; w++) {
			const cells = [];
			for (let wd = 0; wd < 7; wd++) {
				const d = w * 7 + wd - offset + 1;
				cells.push(d >= 1 && d <= total
					? cellFor(`${month}-${String(d).padStart(2, "0")}`, true)
					: h(Text, { key: `${month}-x${w}${wd}` }, "  "));
			}
			gridRows.push(h(Box, { key: `w${w}`, gap: 1 }, ...cells));
		}
	} else {
		const { start } = yearWindow();
		// Slide the visible week range so the cursor's week is always drawn,
		// then let [ ] page the whole window back through the year.
		const clampedFirst = clampedFirstSafe(yearOffset, fitWeeks, cursor, start);
		const clampedLast = clampedFirst + fitWeeks - 1;
		for (let wd = 0; wd < 7; wd++) {
			const cells = [];
			for (let w = 0; w < fitWeeks; w++) cells.push(cellFor(shiftDay(start, (clampedFirst + w) * 7 + wd), true));
			gridRows.push(h(Box, { key: `d${wd}`, gap: 1 },
				h(Text, { color: "subtle" }, wd % 2 === 0 ? `${WEEKDAYS[wd]} ` : "   "),
				...cells));
		}
		// P0(+P2): a label marks the week that CONTAINS a 1st-of-month — the
		// old month-change test dropped every month whose 1st is a Monday
		// (June 2026's "06" vanished). Each label is exactly 2 columns so
		// the pitch never drifts.
		const labelCells = [];
		for (let w = 0; w < fitWeeks; w++) {
			const label = monthLabelOfWeek(shiftDay(start, (clampedFirst + w) * 7));
			labelCells.push(h(Text, { key: `ml${w}`, color: "inactive" }, label ?? "  "));
		}
		monthLabels = h(Box, { gap: 1 }, h(Text, null, "   "), ...labelCells);
		// P2: explicit visible range replaces the bare "26/53 周" — the
		// reader must know WHICH half of the year is on screen.
		const firstDay = shiftDay(start, clampedFirst * 7);
		const lastDay = shiftDay(start, clampedLast * 7 + 6);
		const shownTo = lastDay > today ? today : lastDay;
		rangeHint = h(Text, { color: "inactive" },
			`${firstDay} → ${shownTo} · ${fitWeeks}/${YEAR_WEEKS} 周${yearOffset > 0 ? " · ] 回到今周" : " · [ 前翻"}`);
		legend = h(Box, { gap: 1 },
			h(Text, { color: "subtle" }, "少"),
			...ramp.map((c, i) => h(Text, { key: `lg${i}`, backgroundColor: c }, "  ")),
			h(Text, { color: "subtle" }, "多"),
			h(Text, { color: "subtle" },
				`· 峰值 ${byCost ? money(maxValue, cal.windowCost.estimated) : `${compactTokens(maxValue)} tok`}`));
	}
	const grid = h(Box, {
		flexDirection: "column",
		onWheel: typeof onStepWeek === "function"
			? (event) => {
				const delta = Number(event?.deltaY) || 0;
				if (delta !== 0) onStepWeek(delta > 0 ? 1 : -1);
			}
			: undefined,
	},
		gridTitle, weekHeader, monthLabels, ...gridRows, rangeHint, legend);

	/* inspector: the cursor day's detail, parked under the grid (≈ on days
	 * whose money came partly from the estimate layer) */
	const cv = cal.values.get(cursor) ?? { tok: 0, cost: 0, estimated: false };
	const inspector = h(Box, { gap: 1 },
		h(Text, { color: "accent", bold: true }, `◂ ${cursor} 周${WEEKDAYS[weekdayOf(cursor)]} ▸`),
		h(Text, null, `${compactTokens(cv.tok)} tok`),
		pricing.costEnabled ? h(Text, { color: "subtle" }, money(cv.cost, cv.estimated)) : null);

	/* activity chips — scoped so "峰值 08-14" can't masquerade as the
	 * viewed month when the year window is on screen (P3) */
	const chips = h(Box, { gap: 2 },
		h(Text, { color: "subtle" }, `${monthMode ? "当月" : "近一年"}活跃 ${cal.activeDays} 天`),
		h(Text, { color: "subtle" }, `${cal.turns} 轮`),
		h(Text, { color: "subtle" }, `${cal.toolCalls} 工具`),
		cal.peakDay ? h(Text, { color: "subtle" }, `峰值 ${cal.peakDay.slice(5)}`) : null);

	/* ---- trend, redesigned (P2). Month = weekly columns; year = one
	 * log-scaled block sparkline over the shown weeks. The old braille dot
	 * chart smeared 30 daily points across sub-character columns and read
	 * as noise under any heavy-tailed data. */
	let trend = null;
	const trendKinds = byCost ? "成本" : "token";
	if (monthMode) {
		const first = `${month}-01`;
		const offset = weekdayOf(first);
		const total = daysInMonth(month);
		const weekSums = [], weekLabels = [];
		for (let w = 0; ; w++) {
			let sum = 0, any = false, startD = null;
			for (let wd = 0; wd < 7; wd++) {
				const d = w * 7 + wd - offset + 1;
				if (d < 1 || d > total) continue;
				if (startD === null) startD = d;
				sum += valueOf(`${month}-${String(d).padStart(2, "0")}`);
				any = true;
			}
			if (!any) break;
			weekSums.push(sum);
			weekLabels.push(String(startD).padStart(2, "0"));
		}
		const bars = weeklyBars(weekSums, weekLabels, 3);
		const peakText = byCost ? money(bars.peakVal, false) : `${compactTokens(bars.peakVal)} tok`;
		trend = bars.peakVal > 0
			? h(Box, { flexDirection: "column" },
				h(Text, { color: "subtle" }, `周趋势 · ${trendKinds} · 峰 ${peakText}${bars.peakIdx >= 0 ? ` · ${weekLabels[bars.peakIdx]}日当周` : ""}`),
				...bars.lines.map((line, i) => h(Text, { key: i, color: "accent" }, line)),
				h(Text, { color: "inactive" }, bars.labelLine))
			: h(Box, { flexDirection: "column" },
				h(Text, { color: "subtle" }, `周趋势 · ${trendKinds}`),
				h(Text, { color: "subtle" }, "（当月无用量）"));
	} else {
		const series = [];
		let acc = 0;
		[...(cal.values?.entries() ?? [])].forEach(([day, v], i) => {
			acc += byCost ? v.cost : v.tok;
			if ((i + 1) % 7 === 0 || i === days.length - 1) { series.push(acc); acc = 0; }
		});
		const { start } = yearWindow();
		const peakVal = series.reduce((m, v) => Math.max(m, v), 0);
		const peakIdx = series.indexOf(peakVal);
		const peakWeek = peakIdx >= 0
			? shiftDay(start, (clampedFirstSafe(yearOffset, fitWeeks, cursor, start) + peakIdx) * 7)
			: null;
		const peakText = byCost ? money(peakVal, false) : `${compactTokens(peakVal)} tok`;
		trend = peakVal > 0
			? h(Box, { flexDirection: "column" },
				h(Text, { color: "subtle" }, `周走势 · ${trendKinds} · 对数 · 峰 ${peakText}${peakWeek ? ` · ${peakWeek.slice(5)}当周` : ""}`),
				h(Text, { color: "accent" }, sparkTrend(series)))
			: h(Box, { flexDirection: "column" },
				h(Text, { color: "subtle" }, `周走势 · ${trendKinds} · 对数`),
				h(Text, { color: "subtle" }, "（窗口内无用量）"));
	}

	/* peak / off-peak split */
	const tierTotal = cal.peak + cal.offpeak;
	const tierLine = cal.hasTiers && tierTotal > 0
		? h(Box, { gap: 1 },
			h(Text, { color: "subtle" }, "峰/谷"),
			h(Text, { color: "warning", backgroundColor: "inactive" }, barString(cal.peak / tierTotal, 16)),
			h(Text, { color: "subtle" }, `峰 ${Math.round((cal.peak / tierTotal) * 100)}%`))
		: null;

	/* model breakdown with the four honest states (P1): 按量 / 估算 / 包月 /
	 * 未定价 — amber is reserved for data that is actually missing. The row
	 * follows the responsive ladder (P0) and filters on click (P3). */
	const tokTotal = cal.models.reduce((s, m) => s + m.tok, 0);
	const L = modelLayout(twoCol ? rightW : contentW);
	const modelLines = cal.models.slice(0, modelN).map((m) => {
		const share = tokTotal > 0 ? m.tok / tokTotal : 0;
		const dimmed = focusModel !== null && focusModel !== m.key;
		const dim = dimmed ? "inactive" : undefined;
		const tag = m.state === "monthly" ? "包月"
			: m.state === "unpriced" ? "未定价"
			: m.state === "estimated" ? "估算" : "按量";
		const tagColor = dimmed ? "inactive"
			: m.state === "monthly" ? "success"
			: m.state === "unpriced" ? "warning"
			: m.state === "estimated" ? "subtle" : "subtle";
		const fill = dimmed ? "inactive" : (pricing.modelColors[m.model] || pricing.modelColors[m.key] || accent);
		const costText = pricing.costEnabled && (m.state === "priced" || m.state === "estimated") && m.cost > 0
			? money(m.cost, m.estimated)
			: null;
		return h(Box, {
			key: m.key, gap: 1,
			onClick: () => setFocusModel(focusModel === m.key ? null : m.key),
		},
			h(Text, { color: dim }, fitDisplay(m.model, L.name)),
			L.bar > 0 ? h(Text, { color: fill, backgroundColor: "inactive" }, barString(share, L.bar)) : null,
			L.pct ? h(Text, { color: dim ?? "subtle" }, `${String(Math.round(share * 100)).padStart(2)}%`) : null,
			h(Text, { color: dim ?? "subtle" }, padDisplayStart(L.tight ? compactTokensTight(m.tok) : compactTokens(m.tok), L.tokPad)),
			h(Text, { color: tagColor }, tag),
			costText ? h(Text, { color: dim ?? "subtle" }, costText) : null);
	});

	/* honest-money notes — hand-wrapped to the column (P0): the estimate
	 * note once wrapped a lone "）" onto its own line under Ink's naive
	 * char-count wrap. */
	const noteW = Math.max(20, (twoCol ? rightW : contentW) - 1);
	const notes = [];
	if (cal.unpriced.length > 0) {
		const text = `⚠ 未匹配价目表：${cal.unpriced.slice(0, 3).join("、")}${cal.unpriced.length > 3 ? " 等" : ""} — 金额未计入，可在网页端 pulse 设置补价`;
		notes.push(...wrapDisplay(text, noteW).map((line, i) => h(Text, { key: `u${i}`, color: "warning" }, line)));
	}
	if (cal.windowCost.estimated) {
		notes.push(...wrapDisplay("≈部分金额为估算：计费生效日前的用量按已发布价目计（历史价格留存）", noteW)
			.map((line, i) => h(Text, { key: `e${i}`, color: "subtle" }, line)));
	}
	const footer = h(Text, { color: "subtle" }, "数据源 ~/.dsh/sessions · 成本按定价表估算");

	const left = h(Box, { flexDirection: "column", gap: 1, flexShrink: 0, width: twoCol ? leftW : undefined },
		grid, inspector, chips);
	const right = h(Box, { flexDirection: "column", gap: 1, flexShrink: 0, width: twoCol ? rightW : undefined },
		...(dropTrend ? [] : [trend]),
		...(dropTier || tierLine === null ? [] : [tierLine]),
		h(Box, { flexDirection: "column" },
			h(Text, { color: "subtle" }, "模型"),
			...(modelLines.length > 0 ? modelLines : [h(Text, { key: "e", color: "subtle" }, "暂无模型用量")])),
		...notes, footer);

	// Wide terminals go two-column (calendar | analysis); narrow stacks.
	if (twoCol) {
		return h(Box, { gap: 3 }, left, right);
	}
	return h(Box, { flexDirection: "column", gap: 1 }, left, right);
}

/** Year-grid first visible week under the [ ] page offset, shared by the
 *  grid and the trend's peak-week label. */
function clampedFirstSafe(yearOffset, fitWeeks, cursor, start) {
	const cursorWeek = Math.floor(dayDiff(start, cursor) / 7);
	const anchor = Math.min(YEAR_WEEKS - 1, Math.max(fitWeeks - 1, cursorWeek));
	const maxFirst = YEAR_WEEKS - fitWeeks;
	return Math.max(0, Math.min(maxFirst, anchor - Math.max(0, yearOffset)));
}

/* ---- day: 分时 gantt + session ledger ---- */

/** When did this session act ON this day? The session's dominant hour from
 *  its own `hoursByDay` bucket — the recency clock would stamp every row
 *  with the session's last-ever activity time. */
function dayClockOf(record, day, fallbackMs) {
	let best = null, bestTok = 0;
	for (const [hh, models] of Object.entries(record?.hoursByDay?.[day] ?? {})) {
		const i = Number(hh);
		if (!Number.isInteger(i) || i < 0 || i > 23) continue;
		let sum = 0;
		for (const t of Object.values(models ?? {})) sum += tokSum(t);
		if (sum > bestTok) { bestTok = sum; best = i; }
	}
	if (best !== null) return `${String(best).padStart(2, "0")}:00`;
	return clockOf(fallbackMs);
}

/** Day-level session rows with honest per-day money. Sessions that issued
 *  auxiliary search calls carry a plain-text 「搜N」 suffix inside the fixed
 *  title budget — no emoji, no extra column. */
function dayRowsOf(data, day, pricing, sort, currentId) {
	const rows = data.sessions
		.filter((s) => s.record?.byDay?.[day])
		.map((s) => {
			const aux = s.record?.auxByDay?.[day]?.search;
			const search = (aux?.peak ?? 0) + (aux?.offpeak ?? 0);
			const title = s.title ?? shortSessionId(s.id);
			return {
				id: s.id,
				title: search > 0 ? `${title} 搜${search}` : title,
				clock: dayClockOf(s.record, day, s.recency),
				recency: s.recency ?? 0,
				turns: s.record?.turnsByDay?.[day] ?? 0,
				tokens: tokSum(s.record.byDay[day]),
				cost: pricing.costEnabled ? dayCost(s.record, day, pricing) : 0,
				estimated: dayEstimatedOf(s.record, day, pricing),
				current: eqId(s.id, currentId),
			};
		});
	rows.sort((a, b) => sort === "tokens" ? b.tokens - a.tokens : b.recency - a.recency);
	return rows;
}

function renderDay(kit, { data, pricing, cursor, sort, contentW, termRows, currentId, onStepDay }) {
	const { h, Box, Text } = kit;
	const day = cursor;
	const dayTok = data.record?.byDay?.[day];
	const cost = pricing.costEnabled ? dayCost(data.record, day, pricing) : 0;
	const dayEstimated = dayEstimatedOf(data.record, day, pricing);

	const rows = dayRowsOf(data, day, pricing, sort, currentId);
	const activeSessions = rows.length > 0
		? data.sessions.filter((s) => s.record?.byDay?.[day])
		: [];

	/* 分时 gantt (P2): sessions × 0-23时 spans over the peak-billing band,
	 * with the old hourly strip demoted to the 合计 row. */
	const peakSet = peakHoursFor(pricing.strictFor(day), day);
	const gantRows = activeSessions.slice(0, 5);
	const g = ganttRows(gantRows, day, contentW, peakSet);
	const anyHour = g.hours.some((v) => v > 0);
	const ganttLines = 1 + (peakSet ? 1 : 0) + (anyHour ? gantRows.length : 0) + (anyHour ? 1 : 0);
	const gantt = !anyHour ? null : h(Box, { flexDirection: "column", gap: 0 },
		h(Box, { gap: 1 },
			h(Text, { color: "subtle" }, "分时"),
			h(Text, { color: "subtle" }, `0→23时 峰 ${String(g.peakHour).padStart(2, "0")}:00`),
			peakSet ? h(Text, { color: "inactive" }, "▓ 峰值计费段") : null),
		peakSet ? h(Box, { gap: 1 },
			h(Text, { color: "subtle" }, padDisplay("峰段", 12)),
			h(Text, { color: "warning" }, g.band)) : null,
		...g.rows.map((r) => h(Box, { key: r.id, gap: 1 },
			h(Text, { color: "subtle" }, r.label),
			h(Text, { color: "accent" }, r.span))),
		h(Box, { gap: 1 },
			h(Text, { color: "subtle" }, padDisplay("合计", 12)),
			h(Text, { color: "accent" }, sparkline(g.hours))));

	/* wheel scrolls days (P3) — clamped stepping lives in renderScene */
	const onWheelDay = (event) => {
		const delta = Number(event?.deltaY) || 0;
		if (delta === 0) return;
		if (typeof onStepDay === "function") onStepDay(delta > 0 ? 1 : -1);
	};

	const maxTok = rows.reduce((m, r) => Math.max(m, r.tokens), 0);
	const ganttH = gantt === null ? 0 : ganttLines;
	const budget = Math.max(3, termRows - 15 - ganttH);
	const shown = rows.slice(0, budget);
	const titleWidth = Math.max(16, Math.min(44, contentW - 64));
	const costColW = pricing.costEnabled ? 11 : 0;
	const showBar = contentW >= 78;
	const barW = showBar ? Math.max(6, Math.min(20, contentW - 36 - titleWidth - costColW)) : 0;

	const dayAux = data.record?.auxByDay?.[day]?.search;
	const daySearch = (dayAux?.peak ?? 0) + (dayAux?.offpeak ?? 0);
	const summary = h(Box, { gap: 2 },
		h(Text, null, `${rows.length} 会话`),
		h(Text, { color: "accent", bold: true }, `${compactTokens(tokSum(dayTok))} tok`),
		pricing.costEnabled ? h(Text, null, money(cost, dayEstimated)) : null,
		daySearch > 0 ? h(Text, { color: "subtle" }, `搜索 ×${daySearch}`) : null,
		h(Text, { color: "subtle" }, `按${sort === "tokens" ? "用量" : "时间"}`));

	const table = shown.length === 0
		? h(Text, { color: "subtle" }, "当天没有会话记录。")
		: h(Box, { flexDirection: "column", onWheel: onWheelDay },
			...shown.map((row) => h(Box, { key: row.id, gap: 1 },
				h(Text, { color: row.current ? "accent" : "inactive", bold: row.current }, row.current ? "▶" : "▍"),
				h(Text, { color: "subtle" }, (row.clock ?? "—").padStart(5)),
				// The ▸当前 badge lives INSIDE the fixed title budget — a
				// per-row wider budget would re-staircase the columns.
				h(Text, null, fitDisplay(row.current ? `${row.title} ▸当前` : row.title, titleWidth)),
				h(Text, { color: "subtle" }, padDisplayStart(`${row.turns}轮`, 5)),
				barW > 0 ? h(Text, { color: "accent", backgroundColor: "inactive" }, barString(maxTok > 0 ? row.tokens / maxTok : 0, barW)) : null,
				h(Text, null, ` ${padDisplayStart(compactTokens(row.tokens), 7)} tok`),
				pricing.costEnabled ? h(Text, { color: "subtle" }, ` ${money(row.cost, row.estimated)}`) : null)),
			rows.length > shown.length ? h(Text, { color: "subtle" }, `… 另 ${rows.length - shown.length} 个会话未显示`) : null);

	return h(Box, { flexDirection: "column", gap: 1 },
		crumbLine(kit, [
			{ label: "近一年" },
			{ label: `${monthOf(day).slice(0, 4)}年${Number(monthOf(day).slice(5, 7))}月` },
			{ label: `${day.slice(5)} 周${WEEKDAYS[weekdayOf(day)]}`, hot: true },
		]),
		summary, gantt, table);
}

/* ------------------------------------------------------------------ */
/* composition                                                         */
/* ------------------------------------------------------------------ */

/** Entry intent staged by command handlers before the scene opens; the
 *  scene consumes it once on mount (single TUI process — module state is
 *  the cheapest safe channel into a props-less scene registry). */
let bootIntent = { kind: "mini" };

function takeBootIntent() {
	const b = bootIntent ?? { kind: "mini" };
	bootIntent = { kind: "mini" };
	return b;
}

export async function apply(ctx, config = {}) {
	// 1) scene — soft probe, degrade silently when the extensions stack is absent
	const scenes = ctx.get("tuiScenes", false);
	const sceneComponent = makeSceneComponent(ctx, config);
	/** Idempotent (re-)registration; tolerates registry wipes after reloads. */
	const registerScene = () => {
		if (!scenes || typeof scenes.register !== "function") return false;
		try {
			const dispose = scenes.register({
				id: "pulse",
				title: "用量观测台",
				titles: { "zh-CN": "用量观测台", en: "Usage observatory" },
				component: sceneComponent,
			}, ctx);
			// cordis `effect(callback)` invokes the callback immediately and
			// treats its RETURN value as the cleanup — hand it a closure that
			// yields the disposer, never the disposer itself.
			if (typeof dispose === "function") ctx.effect(() => dispose, "pulse-tui: scene");
			return true;
		} catch (error) {
			// A duplicate id after a hot reload means we are still registered.
			if (!/already registered/i.test(String(error?.message))) {
				ctx.logger?.warn?.(`pulse-tui: scene registration failed: ${error?.message ?? error}`);
				return false;
			}
			return true;
		}
	};
	registerScene();

	/** Stage the entry intent, self-heal the registration, open the scene. */
	const openScene = async (intent) => {
		const runtime = ctx.get("tuiScenes", false);
		if (!runtime || typeof runtime.open !== "function") {
			return { kind: "error", text: "用量观测台不可用（tuiScenes 服务缺失）" };
		}
		bootIntent = intent;
		const opened = runtime.open("pulse") === true
			|| (registerScene(), runtime.open("pulse") === true);
		if (!opened) {
			return { kind: "error", text: "用量观测台场景打开失败（scene 注册被拒绝，见启动日志 pulse-tui: 行）" };
		}
		return { kind: "success" };
	};

	// 2) commands — /pulse and alt+p TOGGLE the prompt-top strip (the real
	// "mini card above the input"); the sub-commands open the full scene
	// directly. Without the tuiStatus seam, /pulse degrades to the scene.
	pulseOpenRef = openScene;
	stripStore.ctx = ctx;
	stripStore.entryConfig = config;
	const today = todayDay();
	const openFullToday = { kind: "full", level: "day", day: today };
	const toggleStrip = async () => {
		if (pulseStripToggle()) return { kind: "success" };
		return openScene(openFullToday);
	};
	const commandDefs = [
		{ name: "pulse", description: "用量观测台：迷你卡开关（输入框上方 · 点击进全量）", handler: toggleStrip },
		{ name: "pulse-day", description: "用量观测台：今日日视图（全量）", intent: openFullToday },
		{ name: "pulse-month", description: "用量观测台：本月月视图（全量）", intent: { kind: "full", level: "month" } },
		{ name: "pulse-year", description: "用量观测台：近一年热力图（全量）", intent: { kind: "full", level: "year" } },
		{ name: "pulse-cost", description: "用量观测台：今日成本口径（全量）", intent: { kind: "full", level: "day", metric: "cost", day: today } },
		{ name: "pulse-sessions", description: "用量观测台：切换本工作区会话", intent: { kind: "picker" } },
	];
	const host = ctx.get("tuiPluginHost", false);
	const registerOne = (definition) => {
		try {
			if (host && typeof host.registerCommand === "function") {
				host.registerCommand(ctx, definition);
				return true;
			}
			const commands = ctx.get("commands", false);
			if (commands && typeof commands.register === "function") {
				commands.register(definition);
				return true;
			}
			return false;
		} catch (error) {
			ctx.logger?.warn?.(`pulse-tui: command /${definition.name} registration failed: ${error?.message ?? error}`);
			return false;
		}
	};
	let registered = 0;
	for (const def of commandDefs) {
		if (registerOne({ name: def.name, description: def.description, handler: def.handler ?? (async () => openScene(def.intent)) })) registered += 1;
	}
	if (registered === 0) {
		ctx.logger?.warn?.("pulse-tui: no command surface found — /pulse not registered");
	}

	// 3) global shortcut — alt+p toggles the strip (modifier combos only,
	// plain-chat state; the host enforces both rules).
	const shortcuts = ctx.get("tuiShortcuts", false);
	if (shortcuts && typeof shortcuts.register === "function") {
		try {
			const dispose = shortcuts.register("alt+p", { description: "pulse 迷你卡开关（输入框上方）", handler: toggleStrip }, ctx);
			if (typeof dispose === "function") ctx.effect(() => dispose, "pulse-tui: alt+p");
		} catch (error) {
			ctx.logger?.warn?.(`pulse-tui: alt+p registration failed: ${error?.message ?? error}`);
		}
	}

	// 4) plugin teardown dismisses the strip — a stale registration would
	// outlive the fold cache and render from a dead ctx.
	try {
		ctx.effect(() => () => pulseStripToggle(false), "pulse-tui: strip teardown");
	} catch { /* effect ledger unavailable — teardown best-effort */ }
}
