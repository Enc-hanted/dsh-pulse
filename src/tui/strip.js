/**
 * TUI face — prompt-top strip subsystem: the mini card store, the component,
 * and the show/hide/toggle state machine. Extracted from scene.js so the
 * card is testable without driving the full scene. Two documented seams
 * replace the old hidden globals: `noteCurrentSession(id)` (the scene stashes
 * the live session id; the ●当前 marker reads it) and `setPulseOpenRef(fn)`
 * (apply() hands over the full-scene opener — ESM import bindings are
 * read-only, so a plain assignment from scene.js cannot reach here).
 */

import { collect, foldCache, makePricing, miniCardModel, todayDay } from "./data.js";
import { displayWidth, fitDisplay, fmtTokens, money, sparkTrend } from "./draw.js";
import { FOOT_WARN_PCT, pickFootSource } from "../view.js";
import { quickReaderOf, setQuickReader } from "../quick-reader.js";

// 快显 reader 的中立注册表住在 ../quick-reader.js（TUI 半区与 web 半区在
// cordis.patch.yml 里互斥，模块级状态不能归属任何一半）；这里只 re-export
// 既有 seam，test/tui-test.mjs 的从 strip.js 导入保持不变。
export { setQuickReader };

let lastSeenSessionId = null;
let pulseOpenRef = null;
let stripDisposer = null;

/** Seam: the scene stashes the live session's id each render. */
export function noteCurrentSession(id) {
	lastSeenSessionId = id;
}

/** Seam: apply() hands over the full-scene opener. */
export function setPulseOpenRef(fn) {
	pulseOpenRef = fn;
}


export const stripStore = {
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
			let quick = null;
			if (quickReaderOf() !== null) {
				try { quick = await quickReaderOf()(); } catch { quick = null; }
			}
			this.snap = { status: "ok", data, pricing: makePricing(data.config ?? {}), quick };
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
			// The quick-display source leads — same selection the web footer
			// shows (config footSource, shared reader seam).
			const quick = snap.quick ?? null;
			const footSrc = quick !== null ? pickFootSource(quick.footSource ?? "", quick.balance ?? null, quick.quota?.providers) : null;
			if (footSrc !== null && footSrc.kind === "official" && footSrc.balance?.ok === true) {
				wanted.push({ text: `余 ${money(footSrc.balance.total, false)}` });
			} else if (footSrc !== null && footSrc.kind === "quota" && footSrc.entry !== null && footSrc.entry !== undefined) {
				const pct = footSrc.entry.windows?.[0]?.usedPct;
				if (pct !== null && pct !== undefined) {
					wanted.push({ text: `${footSrc.entry.plan?.name ?? footSrc.entry.label ?? footSrc.route} ${Math.round(pct)}%`, color: pct >= FOOT_WARN_PCT ? "warning" : undefined });
				}
			}
			wanted.push({ text: t.all.count === 0
				? "今日 — 无用量"
				: `今日 ${fmtTokens(t.all.tok)} tok ${money(t.all.cost, t.all.estimated)} · ${t.all.count} 会话` });
			wanted.push({ text: `本月 ${fmtTokens(m.tok)} tok${pricing.costEnabled ? ` ${money(m.cost, m.estimated)}` : ""}` });
			if (pricing.costEnabled && m.unpricedPct > 0) {
				wanted.push({ text: `⚠未计价${Math.round(m.unpricedPct * 100)}%·${m.unpricedCount}模型`, color: "warning" });
			}
			// The ● marker needs the live session id — stashed by the scene.
			// Unknown means NO split: inventing one would be a lie.
			if (t.hasCurrent) {
				wanted.push({ text: t.current
					? `● 当前 ${fmtTokens(t.current.tok)} tok ${money(t.current.cost, t.current.estimated)}${t.all.tok > 0 ? ` 占${Math.round((t.current.tok / t.all.tok) * 100)}%` : ""}`
					: "● 当前 今日暂无用量", color: "subtle" });
			}
			if (m.series.some((v) => v > 0)) {
				wanted.push({ text: `${sparkTrend(m.series)}${m.peakDay ? ` 峰${m.peakDay.slice(5)}` : ""}`, color: "accent" });
			}
			wanted.push({ text: t.others.count > 0
				? `○ 其余 ${t.others.count} 会话 ${fmtTokens(t.others.tok)} tok`
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
export function pulseStripToggle(desired) {
	const ctx = stripStore.ctx;
	const status = ctx?.get?.("tuiStatus", false);
	if (!status || typeof status.registerView !== "function") {
		ctx?.logger?.warn?.("pulse-tui: tuiStatus seam unavailable — no prompt-top mini card on this host");
		return false;
	}
	const show = desired ?? stripDisposer === null;
	if (show && stripDisposer === null) {
		void stripStore.refresh(false);
		const disposer = status.registerView({ key: "pulse", maxRows: 3, component: stripComponent }, ctx);
		if (typeof disposer !== "function") {
			// Refused: no disposer, and — the reason the interval starts below,
			// after this gate — no 30s poll leaking behind a card nobody sees.
			ctx.logger?.warn?.("pulse-tui: strip registration refused (host row budget exhausted?) — open the full scene instead");
			return false;
		}
		stripDisposer = disposer;
		stripStore.timer ??= setInterval(() => void stripStore.refresh(false), 30_000);
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

/** Test seam: reset the module state between state-machine cases. */
export function _resetStripForTests() {
	if (stripStore.timer) { clearInterval(stripStore.timer); stripStore.timer = null; }
	if (stripDisposer) { stripDisposer(); stripDisposer = null; }
	stripStore.ctx = null;
	stripStore.entryConfig = null;
	stripStore.snap = { status: "loading" };
	stripStore.listeners.clear();
	lastSeenSessionId = null;
	pulseOpenRef = null;
	setQuickReader(null);
}
