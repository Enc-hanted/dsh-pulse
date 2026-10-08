import { useState, useEffect, useMemo, useRef, jsx, jsxs } from "./react.js";
 "../view.js";
import {fill, fmtTokens, useEscape } from "./stores.js";
 "./quota.js";
import { primitives } from "./adapter.js";
import { AUX_MODEL_KEY, accentEntryOf, bucketLabel, bucketOf, costOf, heatmapCells, heatmapLevel, isOffPeakDay, modelAccentMap, modelKey, moneyCny, niceMax, splitModelKey, ymd } from "./../view.js";
		export { SearchPicker, ModelMultiPicker } from "./charts.pickers.js";
		export { SessionDetail, SessionsPanel, focusProjectLabel } from "./charts.session-detail.js";

		//#region charts
		/** Stacked bucket bar chart built from divs - responsive without
		 *  measurement. The stack dimension switches between token types and
		 *  per-model accent colors (v0.5). Clicking a column drills into that
		 *  day: the multi-day grid yields to a full-width horizontal bar that
		 *  sweeps out of the clicked column, segments show each model's share,
		 *  and hovering a segment unfolds a second bar with that model's
		 *  input / cache-hit / output split. Back via the button, a click on
		 *  the empty surroundings, or Escape. */
		/** Accent fill for a (provider, model) pair — the three identity forms
		 *  the surfaces actually hold: composite key, family-rolled key, bare id.
		 *  One lookup for every call site, so no chart can colour a segment by a
		 *  different identity than its own legend. */
		export function accentOf(map, provider, model, fallback = "var(--dsw-alias-label-tertiary)") {
			return accentEntryOf(map, provider, model)?.fill ?? fallback;
		}

		export function BucketChart({ buckets, granularity, today, modelBuckets, accentMap, byModel, names, legendRows, legendSel = null, onLegendToggle, hourlyFrom = null, onDrillChange, onDrillHourly, children, t }) {
			const [hover, setHover] = useState(null);
			const [drillIdx, setDrillIdx] = useState(null);
			const [hoverSeg, setHoverSeg] = useState(null);
			const [pinnedSeg, setPinnedSeg] = useState(null);
			const [seed, setSeed] = useState(null);
			const outerRef = useRef(null);
			const drillOuterRef = useRef(null);
			const rows = Array.isArray(buckets) ? buckets : [];
			const matrices = Array.isArray(modelBuckets) ? modelBuckets : [];
			const exitDrill = () => {
				setDrillIdx(null);
				setHoverSeg(null);
				setPinnedSeg(null);
				onDrillChange?.(null);
			};
			// A new window or dimension invalidates the drilled day.
			useEffect(() => {
				setDrillIdx(null);
				setHoverSeg(null);
				setPinnedSeg(null);
				onDrillChange?.(null);
			}, [buckets, byModel]);
			// The drill bar starts at the clicked column's on-screen span and
			// sweeps to full width; clearing the seed lets the transition run.
			useEffect(() => {
				if (drillIdx === null || seed === null) return undefined;
				const frame = requestAnimationFrame(() => setSeed(null));
				return () => cancelAnimationFrame(frame);
			}, [drillIdx, seed]);
			// Escape unwinds level by level: the model split first, then the
			// drill itself (the callback reads pinnedSeg fresh via the ref).
			useEscape(drillIdx !== null, () => {
				if (pinnedSeg !== null) setPinnedSeg(null);
				else exitDrill();
			}, { target: "window" });
			const maxRaw = rows.reduce((m, b) => Math.max(m,
				(b.input || 0) + (b.cacheRead || 0) + (b.cacheWrite || 0) + (b.output || 0)), 0);
			const max = niceMax(maxRaw);
			const total = rows.reduce((m, b) => m + (b.input || 0) + (b.cacheRead || 0) + (b.cacheWrite || 0) + (b.output || 0), 0);
			const todayKey = bucketOf(granularity, today);
			const hovered = hover !== null && rows[hover] !== undefined ? rows[hover] : null;
			const otherFill = "var(--dsw-alias-label-tertiary)";
			/** One column's stack: token-type rows (the default) or that day's
			 *  per-model rows heavy-first — top-4 named plus an 其他 remainder,
			 *  every fill from the shared accent map so colors agree with the
			 *  模型分布 card. Model rows carry their raw four-field tokens
			 *  (`tk`) for the drill's hover split. */
			const segsFor = (i, bucket) => {
				const inSide = (bucket.input || 0) + (bucket.cacheWrite || 0);
				const cacheRead = bucket.cacheRead || 0;
				const out = bucket.output || 0;
				if (!byModel) {
					return [
						{ key: "out", tokens: out, cls: "dp_segOut" },
						{ key: "cache", tokens: cacheRead, cls: "dp_segCache" },
						{ key: "in", tokens: inSide, cls: "dp_segIn" },
					];
				}
				const matrix = matrices[i];
				const entries = matrix instanceof Map
					? [...matrix.entries()]
						.map(([mid, tk]) => ({
							key: mid,
							bare: mid === "" ? "" : String(splitModelKey(mid).model ?? mid),
							provider: mid === "" ? "" : String(splitModelKey(mid).provider ?? ""),
							tokens: (tk?.input || 0) + (tk?.output || 0) + (tk?.cacheRead || 0) + (tk?.cacheWrite || 0),
							tk: tk ?? {},
						}))
						.filter((seg) => seg.tokens > 0)
						.sort((a, b) => b.tokens - a.tokens)
					: [];
				const top = entries.slice(0, 4);
				const restRows = entries.slice(4);
				const restTokens = restRows.reduce((s, seg) => s + seg.tokens, 0);
				if (restTokens > 0) top.push({
					key: "__other__", bare: "", provider: "", tokens: restTokens,
					tk: restRows.reduce((acc, seg) => {
						acc.input += seg.tk?.input || 0;
						acc.output += seg.tk?.output || 0;
						acc.cacheRead += seg.tk?.cacheRead || 0;
						acc.cacheWrite += seg.tk?.cacheWrite || 0;
						return acc;
					}, { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }),
				});
				return top.map((seg) => ({
					...seg,
					fill: seg.key === "__other__" || seg.bare === "" ? otherFill : accentOf(accentMap, seg.provider, seg.bare, otherFill),
					cls: "dp_segModel",
				}));
			};
			const enterDrill = (i, e) => {
				// Empty days have nothing to break down — stay inert (the zero
				// stub and hover totals still render).
				const b = rows[i];
				if (b === undefined || ((b.input || 0) + (b.output || 0) + (b.cacheRead || 0) + (b.cacheWrite || 0)) <= 0) return;
				const rect = e.currentTarget.getBoundingClientRect();
				const outerRect = outerRef.current?.getBoundingClientRect();
				const outerW = outerRect?.width || 0;
				setHover(null);
				setHoverSeg(null);
				setSeed(outerW > 0 ? { x: rect.left - outerRect.left, scale: Math.max(0.02, rect.width / outerW) } : null);
				setDrillIdx(i);
				onDrillChange?.(i);
			};
			if (drillIdx !== null && rows[drillIdx] !== undefined) {
				const bucket = rows[drillIdx];
				const dayTotal = (bucket.input || 0) + (bucket.output || 0) + (bucket.cacheRead || 0) + (bucket.cacheWrite || 0);
				const segs = segsFor(drillIdx, bucket);
				const dateLabel = bucket.key === todayKey ? `${bucket.key} · ${t("today")}` : bucket.key;
				const drillStyle = seed !== null
					? { transform: `translateX(${seed.x}px) scaleX(${seed.scale})` }
					: undefined;
				// Hover previews a model's split; a click pins it so the reading
				// survives the cursor leaving the segment.
				const focusSeg = hoverSeg ?? pinnedSeg;
				const subSeg = focusSeg !== null ? segs.find((seg) => seg.key === focusSeg) ?? null : null;
				const subTk = subSeg?.tk ?? null;
				const subIn = (subTk?.input || 0) + (subTk?.cacheWrite || 0);
				const subCache = subTk?.cacheRead || 0;
				const subOut = subTk?.output || 0;
				const subSum = subIn + subCache + subOut;
				// Percentages that round to zero are the story here (54M cache
				// reads against 200k output is a real 0.4%), so small shares
				// keep a decimal and near-zero ones say "<0.1%" instead of
				// collapsing to a lying 0%.
				const fmtPct = (v) => {
					if (subSum <= 0 || v <= 0) return "0%";
					const p = (v / subSum) * 100;
					return p >= 10 ? `${Math.round(p)}%` : p >= 0.1 ? `${p.toFixed(1)}%` : "<0.1%";
				};
				const subLabel = subSeg === null ? ""
					: subSeg.key === "__other__" || subSeg.bare === "" ? t("stackOther")
					: subSeg.key === AUX_MODEL_KEY ? t("auxModelName")
					: names.labelOf(subSeg.provider ?? "", subSeg.bare);
				// Second drill level: the pinned model's token-type split, shown
				// as ANOTHER full-width bar (horizontal, same grammar as level
				// 1 — never a vertical stack). Semantic colors follow the type
				// legend, not the model accent, so both levels read alike.
				const level2 = byModel && pinnedSeg !== null ? segs.find((s) => s.key === pinnedSeg) ?? null : null;
				const level2Tk = level2 === null ? null : (level2.tk ?? null);
				const l2Parts = level2 === null ? [] : [
					{ key: "in", label: t("legendInput"), v: (level2Tk?.input || 0) + (level2Tk?.cacheWrite || 0), fill: "var(--dsw-alias-state-business-primary)" },
					{ key: "cache", label: t("legendCache"), v: level2Tk?.cacheRead || 0, fill: "color-mix(in srgb,var(--dsw-alias-state-business-primary) 60%,var(--dsw-alias-state-business-tertiary))" },
					{ key: "out", label: t("legendOutput"), v: level2Tk?.output || 0, fill: "var(--dsw-alias-state-success-primary)" },
				];
				const l2Sum = l2Parts.reduce((s, p) => s + p.v, 0);
				// Same frame as the day chart (dp_chartOuter) so the swap is
				// seamless: head row + a stage whose inner height matches the
				// chart grid exactly; the legend sits below the frame in both
				// modes. Clicks on the frame's empty space unwind one level:
				// model split first, then back to the day chart.
				return jsxs("div", { children: [
					jsxs("div", { ref: drillOuterRef, className: "dp_chartOuter", onClick: () => { if (pinnedSeg !== null) setPinnedSeg(null); else exitDrill(); }, children: [
						jsxs("div", { className: "dp_drillHead", children: [
							/** 返回按钮随层级变化：模型占比层 → 返回上一层；当日
							 *  模型层 → 返回多日视图（与点图内空白同语义）。 */
							jsx("button", {
								type: "button", className: "dp_setLink",
								onClick: () => { if (pinnedSeg !== null) setPinnedSeg(null); else exitDrill(); },
								children: pinnedSeg !== null ? `← ${t("back")}` : `← ${t("backToDays")}`,
							}),
							jsxs("span", { className: "dp_drillTotal", children: [
								jsx("b", { children: dateLabel }),
								jsx("span", { children: fmtTokens(dayTotal) }),
								jsx("span", { children: fill(t("tipSessions"), { n: bucket.sessions || 0 }) }),
								typeof onDrillHourly === "function" && (hourlyFrom === null || bucket.key >= hourlyFrom) && jsx("button", {
									type: "button", className: "dp_setLink",
									onClick: (e) => { e.stopPropagation(); onDrillHourly(bucket.key); },
									children: t("drillByHour"),
								}),
							] }),
							// The focused model's split rides in the head so even a
							// 0.3% share stays readable (its segment is too thin
							// for inline text).
							byModel && subSeg !== null && jsx("div", { className: "dp_drillSubNote dp_drillCap", children: `${subLabel} · ${t("legendInput")} ${fmtPct(subIn)} (${fmtTokens(subIn)}) · ${t("legendCache")} ${fmtPct(subCache)} (${fmtTokens(subCache)}) · ${t("legendOutput")} ${fmtPct(subOut)} (${fmtTokens(subOut)})` }),
						] }),
						jsxs("div", { className: "dp_drillStage", children:
							jsx("div", { className: "dp_drillBar", style: drillStyle, children: level2 !== null
								? l2Parts.map((p) => {
									const pct = l2Sum > 0 ? (p.v / l2Sum) * 100 : 0;
									return jsx("div", {
										className: "dp_drillSeg",
										style: { width: `${pct}%`, background: p.fill },
										onClick: (e) => e.stopPropagation(),
										children: pct >= 14 ? `${Math.round(pct)}%` : null,
									}, p.key);
								})
								: segs.map((seg) => {
									const pct = dayTotal > 0 ? (seg.tokens / dayTotal) * 100 : 0;
									return jsx("div", {
										className: seg.cls === "dp_segModel" ? "dp_drillSeg" : `dp_drillSeg ${seg.cls}`,
										style: { width: `${pct}%`, ...(seg.fill !== undefined ? { background: seg.fill } : {}) },
										onMouseEnter: () => byModel && setHoverSeg(seg.key),
										onMouseLeave: () => setHoverSeg(null),
										onClick: (e) => {
											// Clicking a model drills into it: the full-width
											// bar re-fills with that model's token split,
											// sweeping out from the clicked segment's span.
											e.stopPropagation();
											if (pinnedSeg === seg.key) { setPinnedSeg(null); return; }
											const rect = e.currentTarget.getBoundingClientRect();
											const outerRect = drillOuterRef.current?.getBoundingClientRect();
											const outerW = outerRect?.width || 0;
											setSeed(outerW > 0 ? { x: rect.left - outerRect.left, scale: Math.max(0.02, rect.width / outerW) } : null);
											setPinnedSeg(seg.key);
										},
										children: pct >= 14 ? `${Math.round(pct)}%` : null,
									}, seg.key);
								})
							}),
						}),
					] }),
					jsxs("div", { className: "dp_legend", children: level2 !== null
						? l2Parts.map((p) => jsxs("span", { children: [
							jsx("i", { className: "dp_legendDot", style: { background: p.fill } }),
							p.label,
							jsx("span", { className: "dp_legendVal", children: fmtTokens(p.v) }),
						] }, p.key))
						: segs.map((seg) => jsxs("span", { children: [
							jsx("i", { className: "dp_legendDot", style: { background: seg.fill ?? otherFill } }),
							seg.key === "__other__" || seg.bare === "" ? t("stackOther") : seg.key === AUX_MODEL_KEY ? t("auxModelName") : names.labelOf(seg.provider ?? "", seg.bare),
							jsx("span", { className: "dp_legendVal", children: fmtTokens(seg.tokens) }),
						] }, seg.key)) }),
				] });
			}
			const multiLegend = byModel
				? (Array.isArray(legendRows) ? legendRows : []).map((row) => jsxs("span", {
					className: typeof onLegendToggle === "function" && row.key !== undefined ? `dp_legendBtn${legendSel !== null && !legendSel.has(row.key) ? " dp_legendDim" : ""}` : undefined,
					onClick: typeof onLegendToggle === "function" && row.key !== undefined ? () => onLegendToggle(row.key) : undefined,
					role: typeof onLegendToggle === "function" && row.key !== undefined ? "button" : undefined,
					title: row.title !== undefined && row.title !== null ? row.title : (typeof onLegendToggle === "function" && row.key !== undefined ? t("legendFilterHint") : undefined),
					children: [
						jsx("i", { className: "dp_legendDot", style: row.fill !== undefined ? { background: row.fill } : undefined }),
						row.label,
					],
				}, row.label))
				: [
					jsxs("span", { children: [jsx("i", { className: "dp_legendDot dp_legendIn" }), t("legendInput")] }),
					jsxs("span", { children: [jsx("i", { className: "dp_legendDot dp_legendCache" }), t("legendCache")] }),
					jsxs("span", { children: [jsx("i", { className: "dp_legendDot dp_legendOut" }), t("legendOutput")] }),
				];
			return jsxs("div", { children: [
				jsx("div", { ref: outerRef, className: "dp_chartOuter", children: jsxs("div", { className: "dp_chartGrid", children: [
					...chartPrelude([
					jsx("span", { key: "l0", className: "dp_gridlabel dp_g0", children: fmtTokens(max) }),
					jsx("span", { key: "l50", className: "dp_gridlabel dp_g50", children: fmtTokens(max / 2) }),
					], total === 0, t),
					rows.map((bucket, i) => {
						const inSide = (bucket.input || 0) + (bucket.cacheWrite || 0);
						const cacheRead = bucket.cacheRead || 0;
						const out = bucket.output || 0;
						const sum = inSide + cacheRead + out;
						const isToday = bucket.key === todayKey;
						const height = sum > 0 ? (sum / max) * 100 : 0;
						const stack = segsFor(i, bucket).sort((a, b) => a.tokens - b.tokens);
						return jsx("div", {
							className: `dp_col${sum === 0 ? " dp_colZero" : ""}`,
							onMouseEnter: () => setHover(i),
							onMouseLeave: () => setHover(null),
							onClick: (e) => enterDrill(i, e),
							children: [
								jsx("div", { key: "hit", className: "dp_colHit" }),
								sum === 0 ? jsx("div", { key: "zero", className: "dp_barZero" }) : null,
								jsxs("div", {
									key: "bar",
									className: `dp_bar${isToday ? " dp_barToday" : ""}${sum > 0 ? " dp_barNonzero" : ""}`,
									style: { height: `${height}%` },
									children: stack.map((seg) => jsx("div", {
										className: seg.cls,
										style: { height: `${sum > 0 ? (seg.tokens / sum) * 100 : 0}%`, ...(seg.fill !== undefined ? { background: seg.fill } : {}) },
									}, seg.key)),
								}),
							],
						}, bucket.key ?? i);
					}),
					hovered !== null && hover !== null && jsx("div", {
						key: "tip",
						className: "dp_tipAnchor",
						style: { left: `${((hover + 0.5) / rows.length) * 100}%` },
						children: jsx("div", {
							className: "dp_tip",
							style: tipOffset(hover, rows.length),
							children: jsxs("div", { className: "dp_tipStack", children: [
								jsx("b", { children: hovered.key === todayKey ? `${hovered.key} ${t("today")}` : hovered.key }),
								jsx("span", { children: fill(t("tipIn"), { n: fmtTokens((hovered.input || 0) + (hovered.cacheWrite || 0)) }) }),
								jsx("span", { children: fill(t("tipCache"), { n: fmtTokens(hovered.cacheRead || 0) }) }),
								jsx("span", { children: fill(t("tipOut"), { n: fmtTokens(hovered.output || 0) }) }),
								jsx("span", { children: fill(t("tipSessions"), { n: hovered.sessions || 0 }) }),
							] }),
						}),
					}),
				] }) }),
				children ?? null,
				jsxs("div", { className: "dp_legend", children: multiLegend }),
			] });
		}

		/** X-axis labels under the bucket chart. Ticks run on a fixed cadence
		 *  anchored at the LAST day (today in live windows): the rhythm stays
		 *  even and the newest day is always labeled. The old peak/today
		 *  extra anchors piled irregular ticks onto the tail. */
		export function BucketXLabels({ buckets, granularity, today, t }) {
			const rows = Array.isArray(buckets) ? buckets : [];
			const labelStep = rows.length <= 12 ? 1 : Math.max(1, Math.ceil(rows.length / 6));
			const todayKey = bucketOf(granularity, today);
			return jsx("div", { className: "dp_xlabels", children: rows.map((bucket, i) => jsx("span", {
				className: `dp_xlabel${bucket.key === todayKey ? " dp_xlabelToday" : ""}`,
				children: (rows.length - 1 - i) % labelStep === 0 ? bucketLabel(bucket.key) : "",
			}, bucket.key ?? i)) });
		}

		/** Aggregate day cost rows into week (Monday-anchored) or month rows
		 *  for the 90-day / 1-year cost trend. Peak/off-peak and per-model
		 *  cost sums fold; each period keeps its start/end day keys so the
		 *  drill header can show the covered range. Day granularity is a
		 *  pass-through. */
		export function costPeriodRows(rows, bucket) {
			const list = Array.isArray(rows) ? rows : [];
			if (bucket !== "week" && bucket !== "month") return list;
			const map = new Map();
			const out = [];
			for (const row of list) {
				let key;
				let start = row.key;
				if (bucket === "month") {
					key = row.key.slice(0, 7);
				} else {
					const [y, m, d] = [Number(row.key.slice(0, 4)), Number(row.key.slice(5, 7)), Number(row.key.slice(8, 10))];
					const monday = new Date(y, m - 1, d - ((new Date(y, m - 1, d).getDay() + 6) % 7));
					start = ymd(monday.getFullYear(), monday.getMonth() + 1, monday.getDate());
					key = start;
				}
				let acc = map.get(key);
				if (acc === undefined) {
					acc = { key, start, end: row.key, peak: 0, offpeak: 0, byModel: new Map() };
					map.set(key, acc);
					out.push(acc);
				}
				acc.end = row.key;
				acc.peak += row.peak || 0;
				acc.offpeak += row.offpeak || 0;
				if (row.byModel instanceof Map) row.byModel.forEach((bm, mk) => {
					const prev = acc.byModel.get(mk) ?? { model: bm.model, provider: bm.provider, cost: 0 };
					prev.cost += bm.cost;
					acc.byModel.set(mk, prev);
				});
			}
			return out;
		}

		/** Full-width cost trend panel: per-day cost bars split into peak /
		 *  off-peak billing contributions or per-model costs — the same drill
		 *  grammar as the usage trend (click a day and the bar sweeps out to
		 *  that day's composition; back via the button, an empty click, or
		 *  Escape). Weekend and holiday columns are shaded: under the official
		 *  weekday-only peak windows those days bill entirely off-peak. The
		 *  billed-actual figure from the official balance series rides in the
		 *  drill header when known. */
		export function CostTrendPanel({ costs, today, actualByDay, accentMap, byModel, names, bucket = "day", legendSel = null, onLegendToggle, auxTip = null, onDrillChange, children, t }) {
			const [hover, setHover] = useState(null);
			const [drillIdx, setDrillIdx] = useState(null);
			const [seed, setSeed] = useState(null);
			const outerRef = useRef(null);
			const rows = costPeriodRows(Array.isArray(costs) ? costs : [], bucket);
			useEffect(() => { setDrillIdx(null); onDrillChange?.(null); }, [costs, byModel]);
			useEffect(() => {
				if (drillIdx === null || seed === null) return undefined;
				const frame = requestAnimationFrame(() => setSeed(null));
				return () => cancelAnimationFrame(frame);
			}, [drillIdx, seed]);
			/** Escape unwinds the day drill (the panel no longer owns any
			 *  focus-level exit — the swap tabs handle view selection). */
			const exitDrill = () => { setDrillIdx(null); setHover(null); onDrillChange?.(null); };
			useEscape(drillIdx !== null, exitDrill, { target: "window" });
			const maxRaw = rows.reduce((m, b) => Math.max(m, (b.peak || 0) + (b.offpeak || 0)), 0);
			const max = niceMax(maxRaw);
			const total = rows.reduce((m, b) => m + (b.peak || 0) + (b.offpeak || 0), 0);
			const todayKey = bucketOf("day", today);
			const hovered = hover !== null && rows[hover] !== undefined ? rows[hover] : null;
			const actualMap = new Map((Array.isArray(actualByDay) ? actualByDay : [])
				.map((row) => [row?.key, Number.isFinite(row?.spend) ? row.spend : null]));
			const otherFill = "var(--dsw-alias-label-tertiary)";
			const peakFill = "var(--dsw-alias-state-business-primary)";
			const offFill = "color-mix(in srgb,var(--dsw-alias-state-business-primary) 45%,var(--dsw-alias-label-tertiary))";
			const segsFor = (row) => {
				if (!byModel) {
					return [
						{ key: "peak", tokens: row.peak || 0, fill: peakFill, cls: "dp_segModel" },
						{ key: "off", tokens: row.offpeak || 0, fill: offFill, cls: "dp_segModel" },
					];
				}
				const entries = row.byModel instanceof Map
					? [...row.byModel.values()]
						.map((bm) => ({ key: bm.model, bare: bm.model, provider: bm.provider, tokens: bm.cost }))
						.filter((seg) => seg.tokens > 0)
						.sort((a, b) => b.tokens - a.tokens)
					: [];
				const top = entries.slice(0, 4);
				const rest = entries.slice(4).reduce((s, seg) => s + seg.tokens, 0);
				if (rest > 0) top.push({ key: "__other__", bare: "", tokens: rest });
				return top.map((seg) => ({
					...seg,
					fill: seg.key === "__other__" ? otherFill : accentOf(accentMap, seg.provider, seg.bare, otherFill),
					cls: "dp_segModel",
				}));
			};
			const enterDrill = (i, e) => {
				// Empty days have nothing to break down — stay inert (the day
				// still shows its zero stub and hover totals).
				const row = rows[i];
				if (row === undefined || (row.peak || 0) + (row.offpeak || 0) <= 0) return;
				const rect = e.currentTarget.getBoundingClientRect();
				const outerRect = outerRef.current?.getBoundingClientRect();
				const outerW = outerRect?.width || 0;
				setHover(null);
				setSeed(outerW > 0 ? { x: rect.left - outerRect.left, scale: Math.max(0.02, rect.width / outerW) } : null);
				setDrillIdx(i);
				onDrillChange?.(i);
			};
			const segLabel = (seg) => (!byModel
				? (seg.key === "peak" ? t("legendPeak") : t("legendOffpeak"))
				: (seg.key === "__other__" ? t("stackOther") : seg.key === AUX_MODEL_KEY ? t("auxModelName") : names.labelOf(seg.provider ?? "", seg.bare)));
			if (drillIdx !== null && rows[drillIdx] !== undefined) {
				const row = rows[drillIdx];
				const dayTotal = (row.peak || 0) + (row.offpeak || 0);
				const segs = segsFor(row);
				const actual = actualMap.get(row.key);
				const drillStyle = seed !== null ? { transform: `translateX(${seed.x}px) scaleX(${seed.scale})` } : undefined;
				// Same frame + stage heights as the usage drill (dp_chartOuter
				// with an 18px head + a 152px stage = the chart grid's 10px
				// margin + 168px), so switching views never shifts the layout.
				return jsxs("div", { children: [
					jsxs("div", { className: "dp_chartOuter", onClick: exitDrill, children: [
						jsxs("div", { className: "dp_drillHead", children: [
							jsx("button", { type: "button", className: "dp_setLink", onClick: exitDrill, children: `← ${t("backToDays")}` }),
							jsxs("span", { className: "dp_drillTotal", children: [
								jsx("b", { children: (() => {
									const start = row.start ?? row.key;
									const end = row.end ?? row.key;
									if (start !== end) return `${start} ~ ${end}`;
									return row.key === todayKey ? `${row.key} · ${t("today")}` : row.key;
								})() }),
								jsx("span", { children: moneyCny(dayTotal) }),
								actual !== null && actual !== undefined && jsx("span", { children: fill(t("actualTip"), { v: moneyCny(actual) }) }),
							] }),
						] }),
						jsx("div", { className: "dp_drillStage", children: jsx("div", { className: "dp_drillBar", style: drillStyle, children: segs.map((seg) => {
							const pct = dayTotal > 0 ? (seg.tokens / dayTotal) * 100 : 0;
							return jsx("div", {
								className: "dp_drillSeg",
								style: { width: `${pct}%`, background: seg.fill },
								children: pct >= 14 ? `${Math.round(pct)}%` : null,
							}, seg.key);
						}) }) }),
					] }),
					jsxs("div", { className: "dp_legend", children: segs.map((seg) => jsxs("span", { children: [
						jsx("i", { className: "dp_legendDot", style: { background: seg.fill } }),
						segLabel(seg),
						jsx("span", { className: "dp_legendVal", children: moneyCny(seg.tokens) }),
					] }, seg.key)) }),
				] });
			}
			const windowCostByModel = new Map();
			rows.forEach((row) => {
				if (row.byModel instanceof Map) row.byModel.forEach((bm, key) => {
					windowCostByModel.set(key, (windowCostByModel.get(key) ?? 0) + bm.cost);
				});
			});
			const modelLegend = [...windowCostByModel.entries()]
				.map(([mid, cost]) => {
					const split = splitModelKey(mid);
					return { key: mid, label: mid === AUX_MODEL_KEY ? t("auxModelName") : names.labelOf(split.provider, split.model), fill: accentOf(accentMap, split.provider, split.model, otherFill), cost };
				})
				.sort((a, b) => b.cost - a.cost)
				.slice(0, 4);
			const multiLegend = byModel
				? modelLegend.map((row) => jsxs("span", {
					className: typeof onLegendToggle === "function" ? `dp_legendBtn${legendSel !== null && !legendSel.has(row.key) ? " dp_legendDim" : ""}` : undefined,
					onClick: typeof onLegendToggle === "function" ? () => onLegendToggle(row.key) : undefined,
					role: typeof onLegendToggle === "function" ? "button" : undefined,
					title: row.key === AUX_MODEL_KEY && auxTip !== null ? auxTip : (typeof onLegendToggle === "function" ? t("legendFilterHint") : undefined),
					children: [
						jsx("i", { className: "dp_legendDot", style: { background: row.fill } }),
						row.label,
						jsx("span", { className: "dp_legendVal", children: moneyCny(row.cost) }),
					],
				}, row.label))
				: [
					jsxs("span", { children: [jsx("i", { className: "dp_legendDot", style: { background: peakFill } }), t("legendPeak")] }),
					jsxs("span", { children: [jsx("i", { className: "dp_legendDot", style: { background: offFill } }), t("legendOffpeak")] }),
				];
			return jsxs("div", { children: [
				jsx("div", { ref: outerRef, className: "dp_chartOuter", children: jsxs("div", { className: "dp_chartGrid", children: [
					...chartPrelude([
					jsx("span", { key: "l0", className: "dp_gridlabel dp_g0", children: moneyCny(max) }),
					jsx("span", { key: "l50", className: "dp_gridlabel dp_g50", children: moneyCny(max / 2) }),
					], total === 0, t),
					rows.map((row, i) => {
						const sum = (row.peak || 0) + (row.offpeak || 0);
						const height = sum > 0 ? (sum / max) * 100 : 0;
						const stack = segsFor(row).sort((a, b) => a.tokens - b.tokens);
						// Day rows highlight by key; week/month periods by range.
						const coversToday = row.start !== undefined
							? row.start <= today && today <= row.end
							: row.key === todayKey;
						return jsx("div", {
							className: `dp_col${bucket === "day" && isOffPeakDay(row.key) ? " dp_colOff" : ""}${sum === 0 ? " dp_colZero" : ""}`,
							onMouseEnter: () => setHover(i),
							onMouseLeave: () => setHover(null),
							onClick: (e) => enterDrill(i, e),
							children: [
								jsx("div", { key: "hit", className: "dp_colHit" }),
								sum === 0 ? jsx("div", { key: "zero", className: "dp_barZero" }) : null,
								jsxs("div", {
									key: "bar",
									className: `dp_bar${coversToday ? " dp_barToday" : ""}${sum > 0 ? " dp_barNonzero" : ""}`,
									style: { height: `${height}%` },
									children: stack.map((seg) => jsx("div", {
										className: seg.cls,
										style: { height: `${sum > 0 ? (seg.tokens / sum) * 100 : 0}%`, background: seg.fill },
									}, seg.key)),
								}),
							],
						}, row.key);
					}),
					hovered !== null && hover !== null && jsx("div", {
						key: "tip",
						className: "dp_tipAnchor",
						style: { left: `${((hover + 0.5) / rows.length) * 100}%` },
						children: jsx("div", {
							className: "dp_tip",
							style: tipOffset(hover, rows.length),
							children: jsxs("div", { className: "dp_tipStack", children: [
								jsx("b", { children: hovered.key === todayKey ? `${hovered.key} ${t("today")}` : hovered.key }),
								jsx("span", { children: fill(t("costTipPeak"), { v: moneyCny(hovered.peak || 0) }) }),
								jsx("span", { children: fill(t("costTipOff"), { v: moneyCny(hovered.offpeak || 0) }) }),
								jsx("span", { children: fill(t("costTipTotal"), { v: moneyCny((hovered.peak || 0) + (hovered.offpeak || 0)) }) }),
							] }),
						}),
					}),
				] }) }),
				children ?? null,
				jsxs("div", { className: "dp_legend", children: multiLegend }),
			] });
		}

		/** Single-day hourly cost, the official-console shape: 24 bars over
		 *  one ¥ axis, each hour colored by its own billing tier (peak hours
		 *  in the business fill, off-peak in the muted mix), hover reading
		 *  峰/谷/合计. Aux estimates have no hour of their own — the caller
		 *  footnotes them below the chart. */
		export function HourlyCostChart({ hours, t }) {
			const [hover, setHover] = useState(null);
			const rows = Array.isArray(hours) ? hours : [];
			const maxRaw = rows.reduce((m, h) => Math.max(m, h.cost || 0), 0);
			const max = niceMax(maxRaw);
			const peakTotal = rows.reduce((s, h) => s + (h.peak || 0), 0);
			const offTotal = rows.reduce((s, h) => s + (h.offpeak || 0), 0);
			const total = peakTotal + offTotal;
			const hovered = hover !== null && rows[hover] !== undefined ? rows[hover] : null;
			const peakFill = "var(--dsw-alias-state-business-primary)";
			const offFill = "color-mix(in srgb,var(--dsw-alias-state-business-primary) 45%,var(--dsw-alias-label-tertiary))";
			return jsxs("div", { children: [
				jsx("div", { className: "dp_chartOuter", children: jsxs("div", { className: "dp_chartGrid", children: [
					...chartPrelude([
					maxRaw > 0 && jsx("span", { key: "l0", className: "dp_gridlabel dp_g0", children: moneyCny(max) }),
					maxRaw > 0 && jsx("span", { key: "l50", className: "dp_gridlabel dp_g50", children: moneyCny(max / 2) }),
					], total === 0, t),
					rows.map((h, i) => {
						const cost = h.cost || 0;
						const height = cost > 0 ? (cost / max) * 100 : 0;
						return jsxs("div", {
							className: `dp_col${cost === 0 ? " dp_colZero" : ""}`,
							onMouseEnter: () => setHover(i),
							onMouseLeave: () => setHover(null),
							children: [
								jsx("div", { key: "hit", className: "dp_colHit" }),
								cost === 0 && jsx("div", { key: "zero", className: "dp_barZero" }),
								cost > 0 && jsx("div", {
									key: "bar",
									className: "dp_bar dp_barNonzero",
									style: { height: `${height}%`, background: (h.peak || 0) > 0 ? peakFill : offFill },
								}),
							],
						}, h.key);
					}),
					hovered !== null && hover !== null && jsx("div", {
						key: "tip",
						className: "dp_tipAnchor",
						style: { left: `${((hover + 0.5) / Math.max(rows.length, 1)) * 100}%` },
						children: jsx("div", {
							className: "dp_tip",
							style: tipOffset(hover, rows.length),
							children: jsxs("div", { className: "dp_tipStack", children: [
								jsx("b", { children: `${hovered.key}:00` }),
								jsx("span", { children: fill(t("costTipPeak"), { v: moneyCny(hovered.peak || 0) }) }),
								jsx("span", { children: fill(t("costTipOff"), { v: moneyCny(hovered.offpeak || 0) }) }),
								jsx("span", { children: fill(t("costTipTotal"), { v: moneyCny((hovered.peak || 0) + (hovered.offpeak || 0)) }) }),
							] }),
						}),
					}),
				] }) }),
				jsxs("div", { className: "dp_hourXlabels", children: ["00", "06", "12", "18", "23"].map((label) => jsx("span", { key: label, children: label })) }),
				jsxs("div", { className: "dp_legend", children: [
					jsxs("span", { children: [jsx("i", { className: "dp_legendDot", style: { background: peakFill } }), t("legendPeak"), jsx("span", { className: "dp_legendVal", children: moneyCny(peakTotal) })] }),
					jsxs("span", { children: [jsx("i", { className: "dp_legendDot", style: { background: offFill } }), t("legendOffpeak"), jsx("span", { className: "dp_legendVal", children: moneyCny(offTotal) })] }),
				] }),
			] });
		}

		/** GitHub-style daily heatmap for the 90-day / 1-year views - fluid
		 *  cells inside the same dp_chartOuter frame as the bar chart, so the
		 *  plot fills the trend body evenly at every panel width. */
		export function HeatmapChart({ buckets, today, t }) {
			const [hover, setHover] = useState(null);
			const { cells, weeks, months } = heatmapCells(buckets);
			const gridStyle = { gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` };
			const maxRaw = cells.reduce((m, c) => (c === null ? m : Math.max(m,
				(c.input || 0) + (c.cacheRead || 0) + (c.cacheWrite || 0) + (c.output || 0))), 0);
			const hovered = hover !== null && cells[hover] !== undefined && cells[hover] !== null ? cells[hover] : null;
			return jsxs("div", { children: [
				jsx("div", { className: "dp_chartOuter", children: jsxs("div", { className: "dp_hcWrap", children: [
					jsxs("div", { className: "dp_hcGutter", children: [0, 2, 4].map((row) => jsx("span", {
						key: `g${row}`,
						style: { gridRowStart: row + 2 },
						children: row === 0 ? t("hcMon") : row === 2 ? t("hcWed") : t("hcFri"),
					})) }),
					jsxs("div", { className: "dp_hcBody", children: [
						jsxs("div", { className: "dp_hcMonths", style: gridStyle, children: months.map(({ col, label }) => {
							const showYear = label.endsWith("-01");
							return jsx("span", {
								key: `m${col}`,
								style: { gridColumnStart: col + 1 },
								children: showYear ? label : label.slice(5),
							});
						}) }),
						jsxs("div", { className: "dp_hcGrid", role: "img", "aria-label": t("hcAria"), style: gridStyle, children: cells.map((bucket, i) => {
							if (bucket === null) return jsx("span", { key: `f${i}`, className: "dp_hcCell dp_hcFuture" });
							const total = (bucket.input || 0) + (bucket.cacheRead || 0) + (bucket.cacheWrite || 0) + (bucket.output || 0);
							const level = heatmapLevel(total, maxRaw);
							const isToday = bucket.key === today;
							return jsx("button", {
								key: bucket.key,
								type: "button",
								className: `dp_hcCell${level > 0 ? ` dp_hcL${level}` : ""}${isToday ? " dp_hcToday" : ""}`,
								onMouseEnter: () => setHover(i),
								onMouseLeave: () => setHover(null),
								onFocus: () => setHover(i),
								onBlur: () => setHover(null),
								"aria-label": bucket.key,
							});
						}) }),
					] }),
				] }) }),
				jsxs("div", { className: "dp_hcDetail", children: hovered !== null
					? [
						jsx("b", { key: "d", children: hovered.key === today ? `${hovered.key} ${t("today")}` : hovered.key }),
						jsx("span", { key: "i", children: fill(t("tipIn"), { n: fmtTokens((hovered.input || 0) + (hovered.cacheWrite || 0)) }) }),
						jsx("span", { key: "c", children: fill(t("tipCache"), { n: fmtTokens(hovered.cacheRead || 0) }) }),
						jsx("span", { key: "o", children: fill(t("tipOut"), { n: fmtTokens(hovered.output || 0) }) }),
						jsx("span", { key: "s", children: fill(t("tipSessions"), { n: hovered.sessions || 0 }) }),
					]
					: jsx("span", { children: "\u00a0" }) }),
				jsxs("div", { className: "dp_hcScale", children: [
					jsx("span", { children: t("hcLess") }),
					[0, 1, 2, 3, 4].map((level) => jsx("i", { key: level, className: `dp_hcSwatch${level > 0 ? ` dp_hcL${level}` : ""}` })),
					jsx("span", { children: t("hcMore") }),
				] }),
			] });
		}

		/** ONE open/close skeleton behind both pickers: Escape closes, and in
		 *  the inline shell an outside pointer closes too (with the anchored
		 *  float the panel is portaled outside this root and
		 *  useDismissOnOutsidePointer — which counts the portaled panel as
		 *  inside — owns outside-pointer closes). The button head and the menu
		 *  items stay the call site's; only the shell discipline is shared.
		 *  For the inline shell the official dismissal hook is adopted
		 *  directly (pointerdown also covers touch/pen); only primitives
		 *  predating the hook keep the handwritten mousedown listener. */

		/** Intraday line chart for the "today" view: one SVG polyline per token
		 *  class (uncached input / cache read / output) over 24 hours. */
		export function HourlyChart({ hours, t }) {
			const [hover, setHover] = useState(null);
			const rows = Array.isArray(hours) ? hours : [];
			const sumOf = (h) => (h.input || 0) + (h.cacheRead || 0) + (h.cacheWrite || 0) + (h.output || 0);
			const total = rows.reduce((m, h) => m + sumOf(h), 0);
			// Dual axes: cache reads own the left axis; uncached input and
			// output share the right axis, so 95%+ hit rates no longer squash
			// the two small series into the floor.
			const cacheMaxRaw = rows.reduce((m, h) => Math.max(m, h.cacheRead || 0), 0);
			const rightMaxRaw = rows.reduce((m, h) => Math.max(m, (h.input || 0) + (h.cacheWrite || 0), h.output || 0), 0);
			const cacheMax = niceMax(cacheMaxRaw);
			const rightMax = niceMax(rightMaxRaw);
			const px = (i) => ((i + 0.5) / 24) * 100;
			const pyCache = (v) => 100 - (v / cacheMax) * 100;
			const pyRight = (v) => 100 - (v / rightMax) * 100;
			const lineCache = rows.map((h, i) => `${px(i)},${pyCache(h.cacheRead || 0)}`).join(" ");
			const lineIn = rows.map((h, i) => `${px(i)},${pyRight((h.input || 0) + (h.cacheWrite || 0))}`).join(" ");
			const lineOut = rows.map((h, i) => `${px(i)},${pyRight(h.output || 0)}`).join(" ");
			const hovered = hover !== null && rows[hover] !== undefined ? rows[hover] : null;
			return jsxs("div", { className: "dp_hourWrap", children: [
				jsx("div", { className: "dp_chartOuter", children: jsxs("div", { className: "dp_hourGrid", children: [
					...chartPrelude([
					cacheMaxRaw > 0 && jsx("span", { key: "cl0", className: "dp_gridlabel dp_gridlabelAxisL dp_g0", children: fmtTokens(cacheMax) }),
					cacheMaxRaw > 0 && jsx("span", { key: "cl50", className: "dp_gridlabel dp_gridlabelAxisL dp_g50", children: fmtTokens(cacheMax / 2) }),
					rightMaxRaw > 0 && jsx("span", { key: "rl0", className: "dp_gridlabel dp_g0", children: fmtTokens(rightMax) }),
					rightMaxRaw > 0 && jsx("span", { key: "rl50", className: "dp_gridlabel dp_g50", children: fmtTokens(rightMax / 2) }),
					], total === 0, t),
					jsx("svg", {
						key: "plot",
						className: "dp_hourSvg",
						viewBox: "0 0 100 100",
						preserveAspectRatio: "none",
						"aria-hidden": "true",
						children: [
							jsx("polyline", { key: "in", className: "dp_hourLine dp_hourLineIn", points: lineIn }),
							jsx("polyline", { key: "cache", className: "dp_hourLine dp_hourLineCache", points: lineCache }),
							jsx("polyline", { key: "out", className: "dp_hourLine dp_hourLineOut", points: lineOut }),
						],
					}),
					rows.map((h, i) => jsx("div", {
						key: h.key,
						className: "dp_hourHover",
						style: { left: `${(i / 24) * 100}%`, width: `${100 / 24}%` },
						onMouseEnter: () => setHover(i),
						onMouseLeave: () => setHover(null),
					})),
					hovered !== null && jsx("div", {
						key: "cursor",
						className: "dp_hourCursor",
						style: { left: `${px(hover)}%` },
					}),
					hovered !== null && jsx("div", {
						key: "tip",
						className: "dp_tipAnchor",
						style: { left: `${px(hover)}%` },
						children: jsx("div", {
							className: "dp_tip",
							style: tipOffset(hover, 24, 4),
							children: jsxs("div", { className: "dp_tipStack", children: [
								jsx("b", { children: `${hovered.key}:00` }),
								jsx("span", { children: fill(t("tipIn"), { n: fmtTokens((hovered.input || 0) + (hovered.cacheWrite || 0)) }) }),
								jsx("span", { children: fill(t("tipCache"), { n: fmtTokens(hovered.cacheRead || 0) }) }),
								jsx("span", { children: fill(t("tipOut"), { n: fmtTokens(hovered.output || 0) }) }),
							] }),
						}),
					}),
				] }) }),
				jsxs("div", { className: "dp_hourXlabels", children: ["00", "06", "12", "18", "23"].map((label) => jsx("span", { key: label, children: label })) }),
				jsxs("div", { className: "dp_legend", children: [
					jsxs("span", { children: [jsx("i", { key: "d", className: "dp_legendDot dp_legendIn" }), t("legendInput")] }),
					jsxs("span", { children: [jsx("i", { key: "d", className: "dp_legendDot dp_legendCache" }), t("legendCache")] }),
					jsxs("span", { children: [jsx("i", { key: "d", className: "dp_legendDot dp_legendOut" }), t("legendOutput")] }),
					jsx("span", { className: "dp_axisNote", children: t("axisNote") }),
				] }),
			] });
		}

		/** Runway: balance total divided by the average of the most recent
		 *  known daily spends (≤7 days of the official reconciliation
		 *  series). CNY only — a foreign-currency balance can't be compared
		 *  with the CNY spend series. Shared by the balance bar and the chip. */
		export function balanceRunwayDays(data, series) {
			if (data?.currency !== "CNY") return null;
			const total = Number(data.total);
			if (!(total > 0)) return null;
			const spends = (Array.isArray(series) ? series : [])
				.map((row) => (Number.isFinite(row?.spend) && row.spend > 0 ? row.spend : null))
				.filter((v) => v !== null)
				.slice(-7);
			if (spends.length === 0) return null;
			return Math.max(1, Math.floor(total / (spends.reduce((a, b) => a + b, 0) / spends.length)));
		}


		/** The hover tip's edge flip: clamp left near the start, right near the
	 *  end, centered otherwise. `near` is the edge zone in rows (the 24-hour
	 *  chart widens it). */
		function tipOffset(hover, len, near = 2) {
			if (hover < near) return { left: "0" };
			if (hover >= len - near) return { left: "0", transform: "translateX(-100%)" };
			return { left: "0", transform: "translateX(-50%)" };
		}

		/** Shared chart prelude: three gridlines + the caller's axis labels +
		 *  the empty state — the skeleton every chart face repeated. Labels stay
		 *  at the call sites on purpose: the stations disagree on WHEN labels
		 *  show (tokens unconditionally, money only over a nonzero max). */
		function chartPrelude(labels, empty, t) {
			return [
				jsx("div", { key: "g0", className: "dp_gridline dp_g0" }),
				jsx("div", { key: "g50", className: "dp_gridline dp_g50" }),
				jsx("div", { key: "g100", className: "dp_gridline dp_g100" }),
				...labels,
				empty && jsxs("div", { key: "empty", className: "dp_emptyChart", children: [
					jsx(primitives.IconDataOutline16, { size: 20 }),
					jsx("span", { children: t("cacheNa") }),
				] }),
			];
		}

		/** The cost cell's four states, ONE definition for the session-detail
		 *  cluster: monthly badge / estimated money / no money / cost off. */


		/**
		 * The reconciliation detail table, living in the consumption card's
		 * expansion: per-day official spend vs the local estimate and their
		 * gap — pure numbers, no attribution copy. Sparse days (a snapshot
		 * gap spans them; their official figure is an interval estimate)
		 * carry an ≈ prefix, and a day breaching the drift gates reads in
		 * the danger color. Nothing here adjusts anything.
		 */
		export function ReconTable({ rows, t }) {
			const list = (Array.isArray(rows) ? rows : []).filter((r) => r !== null && typeof r === "object");
			if (list.length === 0) return null;
			return jsxs("div", { className: "dp_consRecon", children: [
				jsx("div", { className: "dp_panelTitle", children: t("reconTableTitle") }),
				jsxs("div", { className: "dp_qTable", children: [
					jsxs("div", { className: "dp_qTr", children: [
						jsx("span", { className: "dp_qTh", children: t("reconColDay") }),
						jsx("span", { className: "dp_qTh", children: t("reconColOfficial") }),
						jsx("span", { className: "dp_qTh", children: t("reconColEst") }),
						jsx("span", { className: "dp_qTh", children: t("reconColGap") }),
					] }),
					list.map((row) => {
						const est = (row.est || 0) + (row.aux || 0);
						const official = Number.isFinite(row.official) ? row.official : null;
						const drifted = official !== null && row.sparse !== true
							&& Math.abs(row.gap ?? 0) >= 0.1 && Math.abs(row.gap ?? 0) >= 0.15 * official;
						return jsxs("div", { className: "dp_qTr", children: [
							jsx("span", { className: "dp_qTd dp_qTdFirst", children: row.key }),
							jsx("span", { className: "dp_qTd", children: official === null ? "—" : `${row.sparse === true ? "≈" : ""}${moneyCny(official)}` }),
							jsx("span", { className: "dp_qTd", children: moneyCny(est) }),
							jsx("span", { className: `dp_qTd${drifted ? " dp_reconGapBad" : ""}`, children: row.gap === null ? "—" : `${(row.gap ?? 0) > 0 ? "+" : ""}${moneyCny(row.gap ?? 0)}` }),
						] }, row.key);
					}),
				] }),
			] });
		}

		/** 环右侧信息列的行语法（dp_ringSideRow）：label + 空格 + <b> 值，与
		 *  token 行和「区间内活动」行共用，列内不允许出现第二种行样式。 */
		export const statSideRow = (label, value, key) => jsxs("div", { className: "dp_ringSideRow", children: [
			jsx("span", { children: `${label} ` }),
			jsx("b", { children: value }),
		] }, key);

		/** Horizontal share bars for per-model token splits, each carrying its
		 *  priced cost (CNY) as a secondary value when rates cover it. `names`
		 *  (from {@link catalogNames}) resolves the display label: the model
		 *  config's name, provider-prefixed only for same-named collisions. */
		export function ModelBars({ models, modelColors, pricing = [], fx, costEnabled = false, monthly = [], names, legendSel = null, onLegendToggle, auxTip = null, bw = false, t }) {
			const rows = (Array.isArray(models) ? models : [])
				.filter((m) => (m.input || 0) + (m.output || 0) + (m.cacheRead || 0) + (m.cacheWrite || 0) > 0)
				.slice(0, 6);
			const accents = useMemo(() => modelAccentMap(rows, modelColors, { bw }), [rows, modelColors, bw]);
			const max = rows.reduce((m, r) => Math.max(m,
				(r.input || 0) + (r.cacheRead || 0) + (r.cacheWrite || 0) + (r.output || 0)), 0) || 1;
			// One costOf per row (≤6 rows) — cheap, and unpriced rows report
			// configured:false so they simply show no cost line.
			const costs = useMemo(() => rows.map((row) => costOf([row], pricing, fx, monthly)), [rows, pricing, fx, monthly]);
			// 标题由调用方渲染在卡外（与工作区排行/走势区同构），卡内只有
			// 条形列表——三种区块从此同构。
			return jsxs("div", { className: "dp_listBox", children: [
				rows.length === 0 && jsx("div", { className: "dp_ringSideRow", children: jsx("span", { children: t("cacheNa") }) }),
				rows.map((row, i) => {
					const total = (row.input || 0) + (row.cacheRead || 0) + (row.cacheWrite || 0) + (row.output || 0);
					const inSide = (row.input || 0) + (row.cacheRead || 0) + (row.cacheWrite || 0);
					const cost = costEnabled === true ? costs[i] : null;
					const label = row.model === "unknown" ? t("unknownModel")
					: row.model === AUX_MODEL_KEY ? t("auxModelName")
					: names.labelOf(row.provider ?? "", row.model);
					const toggleable = typeof onLegendToggle === "function" && row.key !== undefined;
					const dimmed = legendSel !== null && !legendSel.has(row.key ?? modelKey(row.provider ?? "", row.model));
					return jsxs("div", {
						className: `dp_barRow${toggleable ? " dp_barRowBtn" : ""}${dimmed ? " dp_barRowDim" : ""}`,
						onClick: toggleable ? () => onLegendToggle(row.key ?? modelKey(row.provider ?? "", row.model)) : undefined,
						role: toggleable ? "button" : undefined,
						title: row.model === AUX_MODEL_KEY && auxTip !== null ? auxTip : (toggleable ? t("legendFilterHint") : row.key ?? row.model),
						children: [
							jsx("span", { className: "dp_barRowName", children: label }),
							jsx("span", { className: "dp_barRowTrack", children: jsx("span", {
								className: `dp_barRowFill${accentEntryOf(accents, row.provider ?? "", row.model)?.custom === true ? " dp_accentCustom" : ""}`,
								style: { width: `${(total / max) * 100}%`, "--dp-accent-fill": accentEntryOf(accents, row.provider ?? "", row.model)?.fill },
							}) }),
							jsxs("span", {
								className: "dp_barRowVal",
								title: `${fill(t("inOf"), { n: fmtTokens(inSide) })} / ${fill(t("outOf"), { n: fmtTokens(row.output || 0) })}`,
								children: [
									fmtTokens(total),
									cost !== null && cost.configured === true
										? jsx("span", { className: "dp_barRowCost", children: moneyCny(cost.total ?? 0) })
										: null,
								],
							}),
						],
					}, row.key ?? row.model);
				}),
			] });
		}

		/** Ranked table of heaviest projects with share bars (row cap from payload `topProjects`). */
		export function ProjectTable({ projects, topProjects, onSelect, t }) {
			const cap = Number(topProjects) > 0 ? Math.floor(Number(topProjects)) : 8;
			const rows = (Array.isArray(projects) ? projects : []).slice(0, cap);
			const max = rows.reduce((m, r) => Math.max(m, r.total || 0), 0) || 1;
			const clickable = typeof onSelect === "function";
			return jsxs("div", { className: "dp_table", children: [
				jsxs("div", { className: "dp_tableRow dp_tableHead", children: [
					jsx("span", { children: t("colRank") }),
					jsx("span", { children: t("colProject") }),
					jsx("span", { className: "dp_thNum", children: t("colSessions") }),
					jsx("span", { className: "dp_thNum", children: t("colTokens") }),
					jsx("span", { children: "" }),
				] }),
				rows.map((row, i) => {
					const total = row.total || 0;
					const inSide = (row.input || 0) + (row.cacheRead || 0) + (row.cacheWrite || 0);
					const name = row.project === null || row.project === undefined || row.project === ""
						? t("noWorkspace") : row.project;
					const projectCell = clickable
						? jsx("button", {
							type: "button", className: "dp_tableName dp_tableNameBtn", title: name,
							onClick: () => onSelect(row.project),
							children: name,
						})
						: jsx("span", { className: "dp_tableName", title: name, children: name });
					return jsxs("div", { className: "dp_tableRow", children: [
						jsx("span", { className: "dp_tableRank", children: String(i + 1) }),
						projectCell,
						jsx("span", { className: "dp_tableNum", children: String(row.sessions || 0) }),
						jsx("span", {
							className: "dp_tableTokens",
							title: `${fill(t("inOf"), { n: fmtTokens(inSide) })} / ${fill(t("outOf"), { n: fmtTokens(row.output || 0) })}`,
							children: fmtTokens(total),
						}),
						jsx("span", { className: "dp_tableTrack", children: jsx("span", { className: "dp_barRowTrack", children: jsx("span", { className: "dp_barRowFill", style: { width: `${(total / max) * 100}%` } }) }) }),
					] }, `${row.project ?? ""}#${i}`);
				}),
			] });
		}
