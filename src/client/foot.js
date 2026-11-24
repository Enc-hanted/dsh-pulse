import { useState, useEffect, useRef, jsx, jsxs } from "./react.js";
import { Btn, createPortal, primitives } from "./adapter.js";
import { PAYLOAD_CACHE_MS, STATS_POLL_MS, fetchStatsPayload, fill, loadStats, payloadCache, statsState, subscribeDataChanged, subscribeStats } from "./stores.js";
import { FOOT_WARN_PCT, fmtTokens, moneyParts, quotaMoney, quotaMonthlyFee } from "../view.js";
import { quotaDurTight, quotaEntryName, quotaWindowLabel } from "./quota.js";
	//#region quick-display faces
	/** The footer's own 7-day window read — the store's freshness contract
	 *  (STATS_POLL_MS, visibility-gated) without touching statsState: the
	 *  always-mounted footer must not hijack the dashboard's selected window.
	 *  Three sources, cheapest first: (1) the store's live data whenever the
	 *  dashboard shows the same window — its refreshes arrive through
	 *  subscribeStats and the poll refreshes THE STORE quietly, never a second
	 *  GET; (2) the shared payload cache within PAYLOAD_CACHE_MS (the envelope
	 *  loadStats writes, landed through the one landStatsPayload path); (3)
	 *  fetchStatsPayload — one in-flight GET per window shared with any sibling
	 *  reader. The poll bypasses the cache: a cached read every minute would
	 *  never refetch. `enabled: false` (the classic face) issues nothing and
	 *  reads null — the default face carries no data-face traffic. Returns
	 *  `{data, error}`: error is the last fetch failure's message (adopt and
	 *  cache paths clear it), so a reader can tell "loading" from "failed"
	 *  without its own fetch — the summary card reports errors this way. */
	export function useFootWindow(from, to, enabled = true) {
		const [data, setData] = useState(null);
		const [error, setError] = useState(null);
		const winKey = `${from}:${to}`;
		useEffect(() => {
			if (!enabled) return undefined;
			let cancelled = false;
			const adopt = () => { if (!cancelled && statsState.data !== null) { setData(statsState.data); setError(null); } };
			const load = (bypassCache) => {
				if (statsState.key === winKey) {
					adopt();
					if (bypassCache === true) loadStats(from, to, { quiet: true });
					return;
				}
				if (bypassCache !== true) {
					const entry = payloadCache.get(winKey);
					const cached = entry !== undefined && Date.now() - entry.at < PAYLOAD_CACHE_MS ? entry.payload : undefined;
					if (cached !== undefined) { setData(cached); setError(null); return; }
				}
				fetchStatsPayload(from, to).then((body) => { if (!cancelled) { setData(body); setError(null); } }).catch((err) => { if (!cancelled) setError(String(err?.message ?? err)); });
			};
			load(false);
			const unsubscribeStats = subscribeStats(adopt);
			const unsubscribeChanged = subscribeDataChanged(() => load(true));
			const poll = () => { if (document.visibilityState === "visible") load(true); };
			const timer = setInterval(poll, STATS_POLL_MS);
			document.addEventListener("visibilitychange", poll);
			return () => {
				cancelled = true;
				clearInterval(timer);
				unsubscribeStats();
				unsubscribeChanged();
				document.removeEventListener("visibilitychange", poll);
			};
		}, [winKey, from, to, enabled]);
		return enabled ? { data, error } : { data: null, error: null };
	}

	/** Shared percentage vocabulary for every quick-display face: the warn
	 *  class (FOOT_WARN_PCT is the one threshold) and the dash for a window
	 *  the provider left unstated. */
	export const footPctClass = (pct) => (pct !== null && pct !== undefined && pct >= FOOT_WARN_PCT ? " dp_footWarn" : "");
	const footPctText = (pct) => (pct === null || pct === undefined ? "—" : `${Math.round(pct)}%`);

	/** Quick-display glyph: a subscription's utilization ring REPLACES the
	 *  icon (≥80% reads in the warn color), the official balance wears the
	 *  peak sun / off-peak moon, and a flat or unanswered source keeps the
	 *  data mark. The rail shows the same glyph alone. */
		export function FootGlyph({ source, peak, size = 16 }) {
			if (source?.kind === "quota") {
				const pct = source.entry?.windows?.[0]?.usedPct;
				if (pct === null || pct === undefined) return jsx(primitives.IconDataOutline16, { size });
				const circ = 2 * Math.PI * 6;
				const fillArc = (Math.max(0, Math.min(100, pct)) / 100) * circ;
				// dp_footRing lifts the ring's ink to label-primary: at 0–2% the
				// old secondary-ink ring read as a bare spinner; the strong arc
				// over the 25%-opacity track now reads as "the meter, nearly
				// empty" instead of "something loading". Warn still wins.
				return jsxs("svg", {
					className: `dp_footGlyph dp_footRing${footPctClass(pct)}`,
				width: size, height: size, viewBox: "0 0 16 16", "aria-hidden": true,
				children: [
					jsx("circle", { cx: 8, cy: 8, r: 6, fill: "none", stroke: "currentColor", strokeOpacity: 0.25, strokeWidth: 2 }),
					jsx("circle", { cx: 8, cy: 8, r: 6, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeDasharray: `${fillArc} ${circ}`, transform: "rotate(-90 8 8)" }),
				],
			});
		}
		if (source?.kind === "official") {
			// D-08: the peak sun carries the warn token — the shape (sun vs
			// moon) stays the primary distinction, the color only marks "the
			// expensive half of the day is billing now". The off-peak moon
			// keeps the muted ink; its own class (not the ring's dp_footWarn)
			// so the two warn meanings can diverge later without a rename.
			return peak
				? jsxs("svg", { className: "dp_footGlyph dp_footPeakWarn", width: size, height: size, viewBox: "0 0 16 16", "aria-hidden": true, children: [
					jsx("circle", { cx: 8, cy: 8, r: 3, fill: "none", stroke: "currentColor", strokeWidth: 1.5 }),
					jsx("path", { d: "M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" }),
				] })
				: jsx("svg", { className: "dp_footGlyph", width: size, height: size, viewBox: "0 0 16 16", "aria-hidden": true, children: jsx("path", { d: "M13.5 9.5A6 6 0 0 1 6.5 2.5a6 6 0 1 0 7 7Z", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinejoin: "round" }) });
		}
		return jsx(primitives.IconDataOutline16, { size });
	}

	/** The value segment beside the glyph: balance money through the single
	 *  money exit, or the primary window's percentage; null = nothing to say. */
	export function footValueText(source) {
		if (source?.kind === "official") {
			return source.balance?.ok === true ? quotaMoney(source.balance.total ?? 0, source.balance.currency) : null;
		}
		if (source?.kind === "quota" && source.entry !== null && source.entry !== undefined) {
			const pct = source.entry.windows?.[0]?.usedPct;
			return pct === null || pct === undefined ? null : `${Math.round(pct)}%`;
		}
		return null;
	}

	/** The tip's plain text rows, shared by the float AND the footer button's
	 *  aria-label — one composition, so what a screen reader hears is exactly
	 *  what sighted users hover (minus the suggestion, which is interactive).
	 *  Pure: no hooks, safe to call during render for the label. */
	export function footTipRows({ source, peak, todayTok, todaySplit, t }) {
		const tipRows = [];
		if (source?.kind === "official") {
			tipRows.push(t("balanceTitle"));
			if (source.balance?.ok === true) {
				tipRows.push(quotaMoney(source.balance.total ?? 0, source.balance.currency));
				if (Number(source.balance.granted) > 0) tipRows.push(`${t("consStatGranted")} ${moneyParts(source.balance.granted, source.balance.currency).text}`);
				if (Number(source.balance.topped) > 0) tipRows.push(`${t("consStatTopped")} ${moneyParts(source.balance.topped, source.balance.currency).text}`);
				tipRows.push(peak ? t("footPeakNow") : t("footOffpeakNow"));
			} else if (source.balance?.configured === true) {
				tipRows.push(fill(t("balanceFailed"), { err: source.balance.error ?? "?" }));
			} else {
				tipRows.push(t("footUnconfigured"));
			}
		} else if (source?.kind === "quota") {
			tipRows.push(source.entry ? quotaEntryName(source.entry) : t("footNoSource"));
			for (const w of source.entry?.windows ?? []) {
				const reset = w.resetsAt !== null && w.resetsAt !== undefined && w.resetsAt > Date.now()
					? ` · ${quotaDurTight(w.resetsAt - Date.now(), t)}` : "";
				tipRows.push(`${quotaWindowLabel(w.id, t)} ${w.usedPct === null ? "—" : `${Math.round(w.usedPct)}%`}${reset}`);
			}
			// The fee goes through the ONE monthly exit (cycle-aware, like the
			// quota panel): a yearly actualPrice must read as twelve months, never
			// as a month; an unknown cycle shows no fee row rather than a wrong one.
			const monthlyFee = quotaMonthlyFee(source.entry?.fee ?? null);
			if (monthlyFee !== null) tipRows.push(`${quotaMoney(monthlyFee.monthly, monthlyFee.currency)}${t("quotaPerMonth")}`);
		} else {
			tipRows.push(t("footNoSource"));
		}
		tipRows.push(fill(t("footToday"), { v: fmtTokens(todayTok) }));
		if (todaySplit !== null && todaySplit !== undefined) {
			tipRows.push(fill(t("footTodaySplit"), { i: fmtTokens(todaySplit.in), o: fmtTokens(todaySplit.out) }));
		}
		return tipRows;
	}

	/** The footer button's accessible name: the purpose plus the first few
	 *  tip rows as plain text. The float is hover-only material — without
	 *  this a screen reader gets "open usage pulse" and never the balance or
	 *  percentage the button is actually displaying. */
	export function footAriaLabel({ source, peak, todayTok, todaySplit, t }) {
		const tipRows = footTipRows({ source, peak, todayTok, todaySplit, t });
		return `${t("openOverlay")} · ${tipRows.slice(0, 4).join(" · ")}`;
	}

	/** Hover/focus float: the details the three-segment face deliberately
	 *  omits — source identity, every window, the balance's granted/topped
	 *  split, today's global tokens with the in/out cut, and — when the
	 *  share suggestion is active — its two actions. The tip portals to
	 *  document.body, so these buttons are real, unnested targets; the
	 *  stopPropagation keeps the outer footer button's open-observatory
	 *  click from riding along on React's portal event bubble. Reachability
	 *  is owned by the call site's gating (slots.js): the hover close is
	 *  bridged across the anchor gap, blur does not close, and a
	 *  keyboard-opened tip (`takeFocus`, focus-visible only) hands focus to
	 *  the action row so 「不再提示」 is one Tab away instead of a walk
	 *  across the whole document. */
	export function FootTip({ source, peak, todayTok, todaySplit, hint, t, onPickSource, onDismissHint, takeFocus = false }) {
		const tipNow = Date.now();
		const lead = footValueText(source);
		const leadPct = source?.kind === "quota" ? source.entry?.windows?.[0]?.usedPct : null;
		const leadName = source === null || source === undefined ? t("footNoSource")
			: source.kind === "official" ? t("balanceTitle")
			: source.entry !== null && source.entry !== undefined ? quotaEntryName(source.entry) : source.route;
		/** One key/value line: label left (muted), value right (ink, tabular). */
		const footRow = (label, value, key, extra = "") => jsxs("div", { key, className: `dp_footRow${extra}`, children: [
			jsx("span", { children: label }),
			jsx("b", { children: value }),
		] });
		const sections = [];
		if (source?.kind === "quota") {
			const windows = source.entry?.windows ?? [];
			sections.push(jsx("div", { key: "wins", className: "dp_footWins", children: windows.map((w) => {
				const reset = w.resetsAt !== null && w.resetsAt !== undefined && w.resetsAt > tipNow ? fill(t("footWinReset"), { v: quotaDurTight(w.resetsAt - tipNow, t) }) : null;
				const width = `${Math.max(0, Math.min(100, w.usedPct ?? 0))}%`;
				return jsxs("div", { key: w.id, className: "dp_footWin", children: [
					jsxs("div", { className: "dp_footWinLabel", children: [
						jsx("span", { children: quotaWindowLabel(w.id, t) }),
						reset !== null ? jsx("span", { className: "dp_footWinSub", children: reset }) : null,
						jsx("b", { className: `dp_footWinPct${footPctClass(w.usedPct)}`, children: footPctText(w.usedPct) }),
					] }),
					w.usedPct === null || w.usedPct === undefined ? null
						: jsx("span", { className: "dp_barRowTrack dp_footWinTrack", children: jsx("span", { className: `dp_barRowFill${footPctClass(w.usedPct)}`, style: { width } }) }),
				] });
			}) }));
			const monthlyFee = quotaMonthlyFee(source.entry?.fee ?? null);
			if (monthlyFee !== null) sections.push(jsx("div", { key: "fee", className: "dp_footNote", children: `${quotaMoney(monthlyFee.monthly, monthlyFee.currency)}${t("quotaPerMonth")}` }));
		} else if (source?.kind === "official") {
			if (source.balance?.ok === true) {
				if (Number(source.balance.granted) > 0) sections.push(footRow(t("consStatGranted"), moneyParts(source.balance.granted, source.balance.currency).text, "granted"));
				if (Number(source.balance.topped) > 0) sections.push(footRow(t("consStatTopped"), moneyParts(source.balance.topped, source.balance.currency).text, "topped"));
				sections.push(jsx("div", { key: "tier", className: "dp_footNote", children: peak ? t("footPeakNow") : t("footOffpeakNow") }));
			} else {
				sections.push(jsx("div", { key: "state", className: "dp_footNote", children: source.balance?.configured === true ? fill(t("balanceFailed"), { err: source.balance.error ?? "?" }) : t("footUnconfigured") }));
			}
		}
		sections.push(jsx("div", { key: "sep", className: "dp_footTipSep" }));
		sections.push(jsxs("div", { key: "today", className: "dp_footRows", children: [
			footRow(t("footTodayLabel"), `${fmtTokens(todayTok)} tok`, "today", " dp_footTodayRow"),
			todaySplit !== null && todaySplit !== undefined ? footRow(t("footSplitLabel"), `${fmtTokens(todaySplit.in)} / ${fmtTokens(todaySplit.out)}`, "split") : null,
		] }));
		return jsxs("div", { className: "dp_footTip", children: [
			jsxs("div", { className: "dp_footTipHead", children: [
				jsx(FootGlyph, { source, peak, size: 18 }),
				jsx("span", { className: "dp_footTipName", children: leadName }),
				lead !== null ? jsx("span", { className: `dp_footTipLead${footPctClass(leadPct)}`, children: lead }) : null,
			] }),
			...sections,
			hint?.show === true ? jsx("div", { className: "dp_footNote dp_footHintLine", children: fill(t("footHintLine"), { p: Math.round((hint.share ?? 0) * 100) }) }) : null,
			hint?.show === true ? jsxs("div", { className: "dp_footTipActions", children: [
				jsx(Btn, { variant: "outline", size: "sm", fallbackClass: "dp_miniBtn",
					autoFocus: takeFocus || undefined,
					onClick: (e) => { e.stopPropagation(); onPickSource?.(); },
					children: t("footHintPick") }),
				jsx(Btn, { variant: "outline", size: "sm", fallbackClass: "dp_miniBtn",
					onClick: (e) => { e.stopPropagation(); onDismissHint?.(); },
					children: t("footHintDismiss") }),
			] }) : null,
		] });
	}
	//#endregion

//#region fallback float
/** The anchor gap the self-drawn float keeps from the button (mirrors the
 *  host Float's default). */
const FOOT_FLOAT_GAP = 6;
/** Self-drawn anchored tip — the footer's fallback for hosts whose
 *  primitives predate the official Float (floatReady() false): fixed
 *  positioning from the anchor's viewport rect (below the anchor, flipped
 *  above when the space below is spent, viewport-clamped), closed by any
 *  outside pointerdown and by scroll/resize — a tooltip that drifts under
 *  the pointer is worse than a closed one (scrolls inside the panel's own
 *  overflow are exempt). Portaled to document.body when react-dom rides the
 *  host envelope, inline in the caller's subtree otherwise — the inline
 *  form inherits the adapter's documented transformed-ancestor risk.
 *  Without this, a host without MenuSurface had NO tip at all: the
 *  suggestion actions (US-15) were unreachable and hover showed only the
 *  native title. The onClose identity churn of re-renders is absorbed
 *  through a ref so the listeners bind once per mount and remove cleanly. */
export function FootFloat({ anchorRef, onClose, children }) {
	const panelRef = useRef(null);
	const closeRef = useRef(onClose);
	closeRef.current = onClose;
	const [pos, setPos] = useState(null);
	useEffect(() => {
		const onCloseEvent = () => closeRef.current();
		const onOutside = (e) => {
			const panel = panelRef.current;
			if (panel !== null && panel.contains(e.target)) return;
			const anchor = anchorRef.current;
			if (anchor !== null && anchor.contains(e.target)) return;
			closeRef.current();
		};
		const onScroll = (e) => {
			if (panelRef.current !== null && panelRef.current.contains(e.target)) return;
			closeRef.current();
		};
		document.addEventListener("pointerdown", onOutside, true);
		window.addEventListener("resize", onCloseEvent);
		window.addEventListener("scroll", onScroll, true);
		return () => {
			document.removeEventListener("pointerdown", onOutside, true);
			window.removeEventListener("resize", onCloseEvent);
			window.removeEventListener("scroll", onScroll, true);
		};
	}, [anchorRef]);
	// Place on mount AND after every render (no deps): the tip's rows
	// grow/shrink as quota and balance data land mid-hover, and a stale
	// measurement could push the panel past the viewport edge. The bail
	// inside place() keeps this from re-rendering when nothing moved.
	useEffect(() => {
		const place = () => {
			const anchor = anchorRef.current;
			const panel = panelRef.current;
			if (anchor === null || panel === null) return;
			const rect = anchor.getBoundingClientRect();
			const width = panel.offsetWidth;
			const height = panel.offsetHeight;
			let x = Math.min(rect.left, window.innerWidth - 8 - width);
			let y = rect.bottom + FOOT_FLOAT_GAP;
			if (y + height > window.innerHeight - 8) {
				const above = rect.top - FOOT_FLOAT_GAP - height;
				y = above >= 8 ? above : window.innerHeight - 8 - height;
			}
			// Bail on an unchanged position — re-placing on every render must
			// not loop through a fresh object here.
			setPos((prev) => (prev !== null && prev.left === x && prev.top === y ? prev : { left: Math.max(8, x), top: Math.max(8, y) }));
		};
		place();
	});
	const panel = jsx("div", {
		ref: panelRef,
		className: "dp_floatPanel dp_footFloat",
		// Dynamic placement only — the static chrome (fixed base, offscreen
		// + hidden default) lives in the .dp_footFloat sheet rule.
		style: pos === null ? undefined : { left: pos.left, top: pos.top, visibility: "visible" },
		children,
	});
	return createPortal !== null ? createPortal(panel, document.body) : panel;
}
//#endregion
