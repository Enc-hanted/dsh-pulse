import { useState, useEffect, useRef, jsx, jsxs } from "./react.js";
import { resolveRates, priceTier, ruleMaps, ruleFor, tierAtMs } from "../view.js";
import { fill, fmtTokens, httpError } from "./stores.js";
import { quotaDur } from "./quota.js";
import { Btn, HoverCardPrim, Tag, relativeTimePrim } from "./adapter.js";
import { AUX_PRICE_AS, AUX_SHAPE, breaksSegments, fmtClockMs, fxRateOf, isOfficialProvider, keyMatchesFilter, modelFilterSet, modelKey, moneyCny, monthlySetOf, splitModelKey } from "./../view.js";
		//#region session detail — SessionDetail / SessionsPanel / focusProjectLabel

		function costCell(cost, monthly, costEnabled, t) {
			if (monthly === true) return t("sessionMonthly");
			if (costEnabled === true && cost?.configured === true && cost.total > 0) return moneyCny(cost.total);
			return "—";
		}

		/** One session's cumulative-consumption curve with break marks: fetch
		 *  the event-level timeline (`/pulse/session`), render a clickable
		 *  cumulative curve, and slice it at up to three breaks into costed
		 *  segments — "stage" consumption analysis (e.g. research / thinking /
		 *  summary) at second accuracy. */
		export function SessionDetail({ sessionId, pricing = [], fx = {}, monthly = [], costEnabled = true, models = [], auxShape = null, catalog = null, names, t }) {
			// Hooks first — every render path (loading / error / ready) must
			// call the same hook set in the same order, or React throws #310.
			const [state, setState] = useState({ status: "loading", data: null, error: null });
			const [breaks, setBreaks] = useState([]);
			const svgRef = useRef(null);
			const [drag, setDrag] = useState(null);
			const [zoom, setZoom] = useState(null);
			// Turn hover probe: index into `turns`, or null when the pointer is
			// off every turn line (see nearestTurn below).
			const [hoverTurn, setHoverTurn] = useState(null);
			// Live zoom window for the native wheel listener (refs stay current
			// across renders without re-binding the listener on every frame).
			const vFromRef = useRef(0);
			const vSpanRef = useRef(1);
			useEffect(() => {
				let alive = true;
				setState({ status: "loading", data: null, error: null });
				setBreaks([]);
				setZoom(null);
				fetch(`/pulse/session?id=${encodeURIComponent(sessionId)}`, {
					credentials: "same-origin",
					headers: { accept: "application/json" },
				})
					.then(async (res) => {
						httpError(res);
						return res.json();
					})
					.then((data) => { if (alive) setState({ status: "ready", data, error: null }); })
					.catch((error) => { if (alive) setState({ status: "error", data: null, error: String(error?.message ?? error) }); });
				return () => { alive = false; };
			}, [sessionId]);
			// The event window is computed before the early returns so the
			// wheel effect below binds to stable minT/maxT on every path.
			const modelSet = modelFilterSet("", models);
			const events = (Array.isArray(state.data?.events) ? state.data.events : [])
				.filter((e) => e !== null && typeof e === "object" && keyMatchesFilter(modelSet, e.key))
				.sort((a, b) => a.t - b.t);
			const minT = events.length > 0 ? events[0].t : 0;
			const maxT = events.length > 0 ? events[events.length - 1].t : 1;
			const fullSpan = Math.max(1, maxT - minT);
			/** Wheel zoom around the cursor. The segments table always keeps
			 *  the whole session — zoom only reframes the curve for fine
			 *  break placement. `null` = whole session. */
			const MIN_ZOOM_MS = 1000;
			useEffect(() => {
				const el = svgRef.current;
				if (!el) return undefined;
				const onWheel = (e) => {
					e.preventDefault();
					const rect = el.getBoundingClientRect();
					if (rect.width <= 0) return;
					const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
					const anchor = vFromRef.current + ratio * vSpanRef.current;
					const factor = e.deltaY < 0 ? 1 / 1.25 : 1.25;
					const nextSpan = Math.max(MIN_ZOOM_MS, Math.min(Math.max(1, vSpanRef.current * factor), fullSpan));
					const anchorRatio = (anchor - vFromRef.current) / vSpanRef.current;
					const from = Math.max(minT, Math.min(anchor - nextSpan * anchorRatio, maxT - nextSpan));
					setZoom({ from, to: from + nextSpan });
				};
				el.addEventListener("wheel", onWheel, { passive: false });
				return () => el.removeEventListener("wheel", onWheel);
			}, [state.status, minT, maxT, fullSpan]);
			if (state.status === "loading") {
				return jsx("div", { className: "dp_sessDetail", children: jsx("span", { className: "dp_setMsg", children: t("loading") }) });
			}
			if (state.status === "error") {
				return jsxs("div", { className: "dp_sessDetail", children: [
					jsx("span", { className: "dp_setMsgErr", children: fill(t("sessionLoadFailed"), { err: state.error }) }),
				] });
			}
			if (events.length === 0) {
				return jsx("div", { className: "dp_sessDetail", children: jsx("span", { className: "dp_setMsg", children: t("sessionNoUsage") }) });
			}
			// Visible window: the whole session by default, or the zoom
			// rectangle clamped inside [minT, maxT].
			const vFrom = zoom === null ? minT : Math.max(minT, Math.min(zoom.from, maxT - Math.max(1, zoom.to - zoom.from)));
			const vTo = zoom === null ? maxT : Math.max(vFrom + 1, Math.min(zoom.to, maxT));
			const vSpan = Math.max(1, vTo - vFrom);
			vFromRef.current = vFrom;
			vSpanRef.current = vSpan;
			let sum = 0;
			const cumulative = events.map((e) => {
				sum += (e.i || 0) + (e.o || 0) + (e.cr || 0) + (e.cw || 0);
				return { t: e.t, y: sum };
			});
			const fullYMax = cumulative.length > 0 ? cumulative[cumulative.length - 1].y : 1;
			const W = 1000;
			const H = 120;
			const x = (t) => ((t - vFrom) / vSpan) * W;
			// The full view keeps the session-wide y-range; a zoomed view
			// re-scales to its own window so a quiet stretch becomes a
			// readable curve instead of a flat line.
			let startY = 0;
			for (const p of cumulative) { if (p.t <= vFrom) startY = p.y; else break; }
			const visible = cumulative.filter((p) => p.t >= vFrom && p.t <= vTo);
			const lastY = visible.length > 0 ? visible[visible.length - 1].y : startY;
			const ys = [startY, ...visible.map((p) => p.y)];
			const vMinY = zoom === null ? 0 : Math.min(...ys);
			const vMaxY = zoom === null ? fullYMax : Math.max(...ys);
			const vRangeY = Math.max(1, vMaxY - vMinY);
			const y = (v) => H - ((v - vMinY) / vRangeY) * H;
			const points = [{ t: vFrom, y: startY }, ...visible, { t: vTo, y: lastY }]
				.map((p) => `${x(p.t).toFixed(2)},${y(p.y).toFixed(2)}`)
				.join(" ");
			const turns = Array.isArray(state.data?.turns) ? state.data.turns : [];
			const segments = breaksSegments(events, breaks, { pricing, fx, monthly, models, catalog });
			/** 辅助调用账单（估算）：该会话的 web_search / 标题 LLM 请求，从
			 *  /pulse/session 的 aux 事件聚合；搜索按（自校准后的）形状折算，
			 *  标题按折算层给出的实文估算 token 计价，事件按自身时刻定峰谷。 */
			const auxEvents = (Array.isArray(state.data?.aux) ? state.data.aux : [])
				.filter((e) => e !== null && typeof e === "object" && Number.isFinite(e.t));
			const billShape = auxShape !== null && typeof auxShape === "object" ? auxShape : AUX_SHAPE;
			let auxSearchN = 0;
			let auxTitleN = 0;
			let auxCost = 0;
			if (auxEvents.length > 0 && costEnabled) {
				const maps = ruleMaps(pricing);
				const monthlySet = monthlySetOf(monthly);
				const usd = fxRateOf(fx);
				for (const e of auxEvents) {
					const priceAs = e.kind === "title" && typeof e.key === "string" && e.key !== "" ? e.key : modelKey("", AUX_PRICE_AS);
					// 标题路由不在官方账号上时，官方口径的账单不含它——不计价。
					if (e.kind === "title" && !isOfficialProvider(splitModelKey(priceAs).provider)) continue;
					if (monthlySet.has(splitModelKey(priceAs).provider)) {
						if (e.kind === "search") auxSearchN += 1; else auxTitleN += 1;
						continue;
					}
					const rule = ruleFor(maps, priceAs);
					if (rule === undefined) continue;
					const rates = resolveRates(rule);
					const conv = rule.currency === "USD" ? usd : 1;
					const tier = tierAtMs(e.t, rule.peakHours);
					if (e.kind === "search") {
						auxSearchN += 1;
						auxCost += priceTier({ input: billShape.miss, cacheRead: billShape.hit, output: billShape.out, cacheWrite: 0 }, rates, tier) * conv;
					} else {
						auxTitleN += 1;
						auxCost += priceTier({ input: e.in || 0, cacheRead: 0, output: e.out || 0, cacheWrite: 0 }, rates, tier) * conv;
					}
				}
			}
			/** Pointer → absolute timestamp, weakly snapping to the nearest
			 *  turn-start line (gray dashes) within a few screen pixels. */
			const SNAP_PX = 8;
			const tFromPointer = (clientX) => {
				const rect = svgRef.current?.getBoundingClientRect();
				if (!rect || rect.width <= 0) return minT;
				const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
				const t = Math.round(vFrom + ratio * vSpan);
				const scale = W / rect.width;
				let best = t;
				let bestD = SNAP_PX * scale;
				for (const tr of turns) {
					const d = Math.abs(x(tr.start) - x(t));
					if (d < bestD) { bestD = d; best = tr.start; }
				}
				return best;
			};
			const commitBreak = (t) => setBreaks((prev) => (prev.length >= 3 || prev.includes(t) ? prev : [...prev, t].sort((a, b) => a - b)));
			const removeBreak = (bt) => setBreaks((prev) => prev.filter((b) => b !== bt));
			/** Turn hover (F1): the turn line nearest the pointer within a
			 *  slightly wider radius than placement snapping. The probe strip
			 *  anchors the official HoverCard on it; content is the turn's
			 *  opening-message preview plus time, duration and in-turn tokens.
			 *  Without the primitive this degrades to the self-drawn tag. */
			const HOVER_PX = 14;
			const nearestTurn = (clientX) => {
				const rect = svgRef.current?.getBoundingClientRect();
				if (!rect || rect.width <= 0) return null;
				const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
				const at = vFrom + ratio * vSpan;
				let best = null;
				let bestD = (HOVER_PX * W) / Math.max(1, rect.width);
				for (let i = 0; i < turns.length; i += 1) {
					const d = Math.abs(turns[i].start - at);
					if (d < bestD) { bestD = d; best = i; }
				}
				return best;
			};
			const turnTokenTotal = (tr) => events.reduce(
				(sum, e) => (e.t >= tr.start && e.t < tr.end ? sum + (e.i || 0) + (e.o || 0) + (e.cr || 0) + (e.cw || 0) : sum),
				0,
			);
			const hoverInfo = hoverTurn === null || turns[hoverTurn] === undefined ? null : (() => {
				const tr = turns[hoverTurn];
				return {
					preview: tr.preview ?? null,
					when: fmtClockMs(tr.start),
					duration: quotaDur(Math.max(0, tr.end - tr.start), t),
					tokens: fmtTokens(turnTokenTotal(tr)),
					left: `${((tr.start - vFrom) / vSpan) * 100}%`,
				};
			})();
			const probeStrip = hoverInfo === null ? null : jsx("span", {
				className: "dp_turnProbe",
				style: { left: hoverInfo.left },
				onPointerDown: (e) => {
					if (e.pointerType === "mouse" && e.button !== 0) return;
					e.preventDefault();
					e.currentTarget.setPointerCapture?.(e.pointerId);
					setDrag({ t: turns[hoverTurn].start });
				},
				onPointerMove: (e) => { if (drag !== null) setDrag({ t: tFromPointer(e.clientX) }); },
				onPointerUp: (e) => {
					if (drag === null) return;
					commitBreak(tFromPointer(e.clientX));
					setDrag(null);
				},
				onPointerCancel: () => setDrag(null),
			});
			const hoverCardNode = hoverInfo === null ? null : jsxs("div", { className: "dp_turnInfo", children: [
				hoverInfo.preview !== null && jsx("div", { className: "dp_turnPreview", children: hoverInfo.preview }),
				jsxs("div", { className: "dp_turnMeta", children: [
					jsx("span", { children: hoverInfo.when }),
					jsx("span", { children: fill(t("turnDuration"), { v: hoverInfo.duration }) }),
					jsx("span", { children: fill(t("turnTokens"), { v: hoverInfo.tokens }) }),
				] }),
			] });
			const hoverNode = hoverInfo === null ? null
				: HoverCardPrim !== null
					? jsx(HoverCardPrim, { anchor: probeStrip, content: hoverCardNode, variant: "compact", openDelayMs: 120, disabled: drag !== null })
					: jsx("span", { className: "dp_curveTag dp_turnTagFallback", style: { left: hoverInfo.left }, children: hoverInfo.preview ?? hoverInfo.when });
			return jsxs("div", { className: "dp_sessDetail", children: [
				auxEvents.length > 0 && jsxs("div", { className: "dp_auxBill", children: [
					jsx("span", { className: "dp_auxBillName", children: t("detailAuxTitle") }),
					jsx("span", { children: fill(t("detailAuxLine"), { s: auxSearchN, t: auxTitleN }) }),
					costEnabled && auxCost > 0 && jsx("span", { children: `≈${moneyCny(auxCost)}` }),
				] }),
				jsxs("div", { className: "dp_curveWrap", onPointerLeave: () => setHoverTurn(null), children: [
					jsx("svg", {
						ref: svgRef,
						viewBox: `0 0 ${W} ${H}`,
						preserveAspectRatio: "none",
						className: "dp_turnSvg",
						onPointerDown: (e) => {
							if (e.pointerType === "mouse" && e.button !== 0) return;
							e.preventDefault();
							e.currentTarget.setPointerCapture?.(e.pointerId);
							setDrag({ t: tFromPointer(e.clientX) });
						},
						onPointerMove: (e) => { if (drag !== null) setDrag({ t: tFromPointer(e.clientX) }); else setHoverTurn(nearestTurn(e.clientX)); },
						onPointerUp: (e) => {
							if (drag === null) return;
							commitBreak(tFromPointer(e.clientX));
							setDrag(null);
						},
						onPointerCancel: () => setDrag(null),
						children: [
							jsx("polyline", { key: "line", points, fill: "none", stroke: "var(--dsw-alias-state-business-primary)", strokeWidth: 2 }),
							turns.map((tr, i) => jsx("line", {
								key: `t${i}`, x1: x(tr.start), y1: 0, x2: x(tr.start), y2: H,
								stroke: "rgba(127,127,127,.5)", strokeDasharray: "3 3", strokeWidth: 1,
							})),
							breaks.map((b, i) => jsx("line", {
								key: `b${i}`, x1: x(b), y1: 0, x2: x(b), y2: H,
								stroke: "var(--dsw-alias-color-danger, #e5484d)", strokeWidth: 2,
							})),
							drag !== null && jsx("line", {
								key: "preview", x1: x(drag.t), y1: 0, x2: x(drag.t), y2: H,
								stroke: "var(--dsw-alias-state-business-primary)", strokeWidth: 2, strokeDasharray: "4 3",
							}),
						],
					}),
					drag !== null && jsx("span", { className: "dp_curveTag", style: { left: `${((drag.t - vFrom) / vSpan) * 100}%` }, children: fmtClockMs(drag.t) }),
					hoverNode,
				] }),
				jsxs("div", { className: "dp_breakRow", children: [
					jsx("span", { className: "dp_breakHint", children: t("sessionAddBreak") }),
					jsx("span", { className: "dp_breakTurn", children: t("sessionTurnHint") }),
					zoom !== null && jsx("button", {
						type: "button", className: "dp_breakChip dp_zoomReset",
						onClick: () => setZoom(null),
						title: t("sessionZoomReset"),
						children: `${t("sessionZoomed")} ${fmtClockMs(vFrom)} → ${fmtClockMs(vTo)} · ${t("sessionZoomReset")}`,
					}),
					jsx("span", { className: "dp_breakCount", children: `${t("sessionBreaks")} ${breaks.length}/3` }),
					breaks.map((b) => {
						// Weak snap lands breaks on turn starts, so the exact-match
						// lookup recovers the turn (and its preview) for the chip.
						const bt = turns.find((tr) => tr.start === b);
						return jsx("button", {
							key: b, type: "button", className: "dp_breakChip",
							onClick: () => removeBreak(b),
							title: bt?.preview ?? undefined,
							children: `✕ ${fmtClockMs(b)}${bt?.preview ? ` · ${bt.preview}` : ""}`,
						});
					}),
				] }),
				jsxs("div", { className: "dp_segTable", children: [
					jsxs("div", { className: "dp_tableRow dp_tableHead", children: [
						jsx("span", { children: t("sessionSegment") }),
						jsx("span", { children: `${t("sessionSegFrom")} → ${t("sessionSegTo")}` }),
						jsx("span", { children: t("sessionTopModel") }),
						jsx("span", { className: "dp_thNum", children: t("colTokens") }),
						jsx("span", { className: "dp_thNum", children: t("chipCost") }),
					] }),
					segments.map((seg, i) => {
						const inSide = (seg.tokens.input || 0) + (seg.tokens.cacheRead || 0) + (seg.tokens.cacheWrite || 0);
						const range = `${fmtClockMs(seg.from)} → ${fmtClockMs(seg.to)}`;
						const tokenTotal = (seg.tokens.input || 0) + (seg.tokens.output || 0) + (seg.tokens.cacheRead || 0) + (seg.tokens.cacheWrite || 0);
						// A slice with no usage events at all — the segment's
						// breaks bracket a quiet stretch of the session log.
						const isGap = (Array.isArray(seg.models) ? seg.models.length : 0) === 0 && tokenTotal === 0;
						const top = seg.models && seg.models[0];
						const topKey = top ? splitModelKey(top.key) : null;
						const topLabel = top
							? (typeof names?.fullLabelOf === "function" ? names.fullLabelOf(top.provider ?? topKey.provider, topKey.model) : topKey.model)
							: "—";
						const cost = costCell(seg.cost, seg.monthly, costEnabled, t);
						return jsxs("div", { className: "dp_tableRow", children: [
							jsx("span", { className: "dp_tableRank", children: String(i + 1) }),
							jsx("span", { className: "dp_tableName", title: range, children: range }),
							jsx("span", {
								className: "dp_tableName",
								title: isGap ? t("sessionGapHint") : topLabel,
								children: isGap ? t("sessionGap") : topLabel,
							}),
							jsx("span", {
								className: "dp_tableNum",
								title: isGap ? t("sessionGapHint") : `${fill(t("inOf"), { n: fmtTokens(inSide) })} / ${fill(t("outOf"), { n: fmtTokens(seg.tokens.output || 0) })}`,
								children: isGap ? "—" : fmtTokens(tokenTotal),
							}),
							jsx("span", { className: "dp_tableNum", children: isGap ? "—" : cost }),
						] }, i);
					}),
				] }),
			] });
		}

		/** Project × session detail panel: per-project session lists with the
		 *  subagent subtotal (count / tokens / cost), and per-session break
		 *  analysis on demand. `focusSessionId` (the `/pulse` menu row's own
		 *  session) pins its row to the top of its group, badges it, and
		 *  auto-expands the group once. */
		/** Relative trailing label for a session row's anchor day ("3 天前"),
		 *  bucketed by the official relativeTime with this plugin's words.
		 *  Null when the primitive is absent or the day is malformed. */
		function relLabel(day, t) {
			if (relativeTimePrim === null || typeof day !== "string" || day.length !== 10) return null;
			const at = new Date(`${day}T12:00:00`).getTime();
			if (!Number.isFinite(at)) return null;
			const bucket = relativeTimePrim(at, Date.now());
			const key = bucket.unit === "now" ? "relNow" : `rel${bucket.unit[0].toUpperCase()}${bucket.unit.slice(1)}`;
			return fill(t(key), { n: bucket.n });
		}

		export function SessionsPanel({ groups = [], costEnabled = true, pricing = [], fx = {}, monthly = [], models = [], auxShape = null, catalog = null, names, t, focusSessionId = null }) {
			const [open, setOpen] = useState(() => new Set());
			const [detail, setDetail] = useState(null);
			const isCurrent = (s) => focusSessionId !== null && focusSessionId !== undefined
				&& s?.id !== null && s?.id !== undefined && String(s.id) === String(focusSessionId);
			const autoOpened = useRef(false);
			useEffect(() => {
				if (autoOpened.current || focusSessionId === null || focusSessionId === undefined) return;
				for (const g of groups) {
					if ((g.sessions ?? []).some(isCurrent)) {
						autoOpened.current = true;
						const name = g.project === null ? t("noWorkspace") : g.project;
						setOpen((prev) => {
							if (prev.has(name)) return prev;
							const next = new Set(prev);
							next.add(name);
							return next;
						});
						break;
					}
				}
			});
			const toggleProject = (label) => setOpen((prev) => {
				const next = new Set(prev);
				if (next.has(label)) next.delete(label); else next.add(label);
				return next;
			});
			if (groups.length === 0) {
				return jsx("div", { className: "dp_setMsg", children: t("sessionNoUsage") });
			}
			return jsxs("div", { className: "dp_sessList", children: groups.map((group) => {
				const name = group.project === null ? t("noWorkspace") : group.project;
				const expanded = open.has(name);
				const subCost = group.subagentSessions === 0 ? "—"
					: costCell(group.subagentCost, group.subagentMonthly, costEnabled, t);
				const sessions = focusSessionId === null ? group.sessions
					: [...group.sessions].sort((a, b) => Number(isCurrent(b)) - Number(isCurrent(a)));
				return jsxs("div", { className: "dp_sessGroup", children: [
					jsxs("button", { type: "button", className: "dp_sessHead", onClick: () => toggleProject(name), children: [
						jsx("span", { className: "dp_sessName", children: name }),
						jsx("span", { className: "dp_sessMeta", children: `${fill(t("sessionMainCount"), { n: group.mainSessions })} · ${fill(t("sessionSubCount"), { n: group.subagentSessions })}` }),
						group.subagentSessions > 0 && jsx("span", { className: "dp_sessSubTotal", children: fill(t("sessionSubTotal"), {
							tokens: fmtTokens((group.subagentTokens.input || 0) + (group.subagentTokens.output || 0) + (group.subagentTokens.cacheRead || 0) + (group.subagentTokens.cacheWrite || 0)),
							cost: subCost,
						}) }),
						jsx("span", { className: "dp_sessToggle", children: expanded ? t("sessionCollapse") : t("sessionExpand") }),
					] }),
					expanded && jsxs("div", { className: "dp_sessBody", children: [
						sessions.map((s) => {
							const { provider: sp, model: sm } = splitModelKey(s.topModel ?? "");
							const modelLabel = s.topModel !== null && s.topModel !== undefined
								? (typeof names?.labelOf === "function" ? names.labelOf(sp, sm) : sm) : "—";
							// A flat monthly subscription bills no marginal cost:
							// show the badge instead of a bogus 0.00 price.
							const cost = costCell(s.cost, s.monthly, costEnabled, t);
							const detailOpen = detail === s.id;
							const modelRow = (mr) => {
								const rm = mr.model ?? splitModelKey(mr.key).model;
								const rp = mr.provider ?? splitModelKey(mr.key).provider;
								const mrLabel = (typeof names?.fullLabelOf === "function" ? names.fullLabelOf(rp, rm) : rm) || "—";
								const mrCost = costCell(mr.cost, mr.monthly, costEnabled, t);
								return jsxs("div", { className: "dp_sessModelRow", children: [
									jsx("span", { className: "dp_sessModelName", title: mrLabel, children: mrLabel }),
									jsx("span", { className: "dp_sessNum", children: fmtTokens((mr.tokens.input || 0) + (mr.tokens.output || 0) + (mr.tokens.cacheRead || 0) + (mr.tokens.cacheWrite || 0)) }),
									jsx("span", { className: "dp_sessNum", children: mrCost }),
								] }, mr.key);
							};
							const current = isCurrent(s);
							return jsxs("div", { className: `dp_sessRow${current ? " dp_sessRowCurrent" : ""}`, children: [
								jsx(Tag, { tone: "neutral", fallbackClass: s.subagent ? "dp_sessBadge dp_sessBadgeSub" : "dp_sessBadge", children: s.subagent ? `${t("sessionSub")}${s.delegationDepth > 0 ? " " + s.delegationDepth : ""}` : t("sessionMain") }),
								current && jsx(Tag, { tone: "solid", fallbackClass: "dp_sessBadge dp_sessBadgeCurrent", children: t("sessionCurrent") }),
								// 辅助调用徽标：纯文本「搜索 ×N」，不用 emoji。计数是
								// 该会话在窗口内的实测请求次数，与模型筛选一致。
								s.auxSearch > 0 && jsx(Tag, { tone: "info", fallbackClass: "dp_sessBadge", children: fill(t("auxBadge"), { n: s.auxSearch }) }),
								jsx("span", { className: "dp_sessTitle", title: s.title ?? undefined, children: s.title ?? (s.id === null || s.id === undefined ? "—" : String(s.id).slice(-8)) }),
								s.day && jsx("span", { className: "dp_sessRel", title: s.day, children: relLabel(s.day, t) }),
								jsx("span", { className: "dp_sessModel", title: modelLabel, children: modelLabel }),
								jsx("span", { className: "dp_sessNum", children: fmtTokens((s.tokens.input || 0) + (s.tokens.output || 0) + (s.tokens.cacheRead || 0) + (s.tokens.cacheWrite || 0)) }),
								jsx("span", { className: "dp_sessNum", children: cost }),
								jsx(Btn, { variant: "ghost", size: "sm", fallbackClass: "dp_miniBtn", onClick: () => setDetail(detailOpen ? null : s.id), children: t("sessionOpenDetail") }),
								jsx("div", { className: "dp_sessModels", children: (Array.isArray(s.modelRows) ? s.modelRows : []).map(modelRow) }),
								detailOpen && jsx(SessionDetail, { key: s.id, sessionId: s.id, pricing, fx, monthly, costEnabled, models, auxShape, catalog, names, t }),
							] }, s.id ?? i);
						}),
					] }),
				] }, name);
			}) });
		}
		//#endregion

		/** Resolve the workspace label a focus session belongs to: prefer the
		 *  payload's own session record (it carries the host's configured
		 *  projectDepth label verbatim), then fall back to trailing-segment
		 *  labels derived from the session's cwd, depth 1..3, against the
		 *  projects the payload actually knows. `null` = not resolvable yet. */
		export function focusProjectLabel(data, focus) {
			if (focus === null || !Array.isArray(data?.sessions)) return null;
			const id = focus.id === null || focus.id === undefined ? "" : String(focus.id);
			if (id !== "") {
				const own = data.sessions.find((s) => s?.id !== null && s?.id !== undefined && String(s.id) === id);
				if (typeof own?.project === "string" && own.project !== "") return own.project;
			}
			const cwd = typeof focus.cwd === "string" ? focus.cwd : "";
			if (cwd === "") return null;
			const parts = cwd.split(/[\\/]/).filter((p) => p.length > 0);
			for (let d = 1; d <= Math.min(3, parts.length); d += 1) {
				const label = parts.slice(-d).join("/");
				if (data.sessions.some((s) => s?.project === label)) return label;
			}
			return null;
		}
