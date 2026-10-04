/**
 * TUI face — scene layer: the React components (observatory scene, the
 * prompt-top strip, picker/help/calendar/day renderers) and `apply`, the
 * plugin wiring. React/ink still arrive through props (zero top-level
 * react imports); data comes from ./data.js, strings from ./draw.js.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { localDay, dayStart } from "../aggregate.js";
import { costOf, shiftDay, splitModelKey } from "../view.js";
import {
	collect, dayCost, dayEstimatedOf, dayModelRows, eqId, foldCache,
	daysInMonth, daysOfMonth, makePricing, miniCardModel, monthLabelOfWeek,
	monthOf, peakHoursFor, pricingLabelOf, todayDay, tokSum, viewSlice,
	weekdayOf, windowDays, yearWindow, WEEKDAYS, YEAR_WEEKS,
} from "./data.js";
import {
	barString, clockOf, compactTokens, compactTokensTight, displayWidth,
	fitDisplay, ganttRows, heatLevel, heatRamp, hexMix, modelLayout, money,
	padDisplay, padDisplayStart, shortSessionId, sparkTrend, sparkline,
	weeklyBars, wrapDisplay,
} from "./draw.js";

/** Whole days from `a` to `b` (`b - a`). */
function dayDiff(a, b) {
	return Math.round((dayStart(b) - dayStart(a)) / 86400000);
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
