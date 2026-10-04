import { useState, useEffect, useMemo, useRef, jsx, jsxs } from "./react.js";
import { resolveRates, priceTier, ruleMaps, ruleFor, tierAtMs } from "../view.js";
import { UNPRICED_HINT_TOKENS, catalogNames, fill, fmtTokens, httpError } from "./stores.js";
import { quotaDur, quotaEntryName, quotaRankEntries, quotaWindowCls, quotaWindowLabel } from "./quota.js";
import { Btn, Float, HoverCardPrim, Tag, TooltipPrim, floatReady, relativeTimePrim, primitives } from "./adapter.js";
import { AUX_MODEL_KEY, AUX_PRICE_AS, AUX_SHAPE, accentEntryOf, breaksSegments, bucketLabel, bucketOf, costOf, fmtClockMs, fmtCost, fxRateOf, heatmapCells, heatmapLevel, isOffPeakDay, isOfficialProvider, keyMatchesFilter, modelAccentMap, modelFilterSet, modelKey, moneyCny, monthlySetOf, niceMax, splitModelKey } from "./../view.js";
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
			useEffect(() => {
				if (drillIdx === null) return undefined;
				const onKey = (e) => {
					if (e.key !== "Escape") return;
					// Escape unwinds level by level: the model split first,
					// then the drill itself.
					if (pinnedSeg !== null) setPinnedSeg(null);
					else exitDrill();
				};
				window.addEventListener("keydown", onKey);
				return () => window.removeEventListener("keydown", onKey);
			}, [drillIdx, pinnedSeg]);
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
					jsx("div", { key: "g0", className: "dp_gridline dp_g0" }),
					jsx("div", { key: "g50", className: "dp_gridline dp_g50" }),
					jsx("div", { key: "g100", className: "dp_gridline dp_g100" }),
					jsx("span", { key: "l0", className: "dp_gridlabel dp_g0", children: fmtTokens(max) }),
					jsx("span", { key: "l50", className: "dp_gridlabel dp_g50", children: fmtTokens(max / 2) }),
					total === 0 && jsxs("div", { key: "empty", className: "dp_emptyChart", children: [
						jsx(primitives.IconDataOutline16, { size: 20 }),
						jsx("span", { children: t("cacheNa") }),
					] }),
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
							style: hover < 2
								? { left: "0" }
								: hover >= rows.length - 2
									? { left: "0", transform: "translateX(-100%)" }
									: { left: "0", transform: "translateX(-50%)" },
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
			const fmtDay = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
			for (const row of list) {
				let key;
				let start = row.key;
				if (bucket === "month") {
					key = row.key.slice(0, 7);
				} else {
					const [y, m, d] = [Number(row.key.slice(0, 4)), Number(row.key.slice(5, 7)), Number(row.key.slice(8, 10))];
					const monday = new Date(y, m - 1, d - ((new Date(y, m - 1, d).getDay() + 6) % 7));
					start = fmtDay(monday);
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
			useEffect(() => {
				if (drillIdx === null) return undefined;
				const onKey = (e) => { if (e.key === "Escape") exitDrill(); };
				window.addEventListener("keydown", onKey);
				return () => window.removeEventListener("keydown", onKey);
			}, [drillIdx]);
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
					jsx("div", { key: "g0", className: "dp_gridline dp_g0" }),
					jsx("div", { key: "g50", className: "dp_gridline dp_g50" }),
					jsx("div", { key: "g100", className: "dp_gridline dp_g100" }),
					jsx("span", { key: "l0", className: "dp_gridlabel dp_g0", children: moneyCny(max) }),
					jsx("span", { key: "l50", className: "dp_gridlabel dp_g50", children: moneyCny(max / 2) }),
					total === 0 && jsxs("div", { key: "empty", className: "dp_emptyChart", children: [
						jsx(primitives.IconDataOutline16, { size: 20 }),
						jsx("span", { children: t("cacheNa") }),
					] }),
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
							style: hover < 2 ? { left: "0" } : hover >= rows.length - 2 ? { left: "0", transform: "translateX(-100%)" } : { left: "0", transform: "translateX(-50%)" },
							children: jsxs("div", { className: "dp_tipStack", children: [
								jsx("b", { children: hovered.key === todayKey ? `${hovered.key} ${t("today")}` : hovered.key }),
								jsx("span", { children: fill(t("costTipPeak"), { v: fmtCost(hovered.peak || 0) }) }),
								jsx("span", { children: fill(t("costTipOff"), { v: fmtCost(hovered.offpeak || 0) }) }),
								jsx("span", { children: fill(t("costTipTotal"), { v: fmtCost((hovered.peak || 0) + (hovered.offpeak || 0)) }) }),
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
					jsx("div", { key: "g0", className: "dp_gridline dp_g0" }),
					jsx("div", { key: "g50", className: "dp_gridline dp_g50" }),
					jsx("div", { key: "g100", className: "dp_gridline dp_g100" }),
					maxRaw > 0 && jsx("span", { key: "l0", className: "dp_gridlabel dp_g0", children: moneyCny(max) }),
					maxRaw > 0 && jsx("span", { key: "l50", className: "dp_gridlabel dp_g50", children: moneyCny(max / 2) }),
					total === 0 && jsxs("div", { key: "empty", className: "dp_emptyChart", children: [
						jsx(primitives.IconDataOutline16, { size: 20 }),
						jsx("span", { children: t("cacheNa") }),
					] }),
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
							style: hover < 2 ? { left: "0" } : hover >= rows.length - 2 ? { left: "0", transform: "translateX(-100%)" } : { left: "0", transform: "translateX(-50%)" },
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

		/** Searchable dropdown: a button plus a popup with an embedded filter
		 *  input. Closes on select, Escape, or an outside click. */
		export function SearchPicker({ value, options, placeholder, displayName, onChange, t }) {
			const [open, setOpen] = useState(false);
			const [query, setQuery] = useState("");
			const rootRef = useRef(null);
			const btnRef = useRef(null);
			useEffect(() => {
				if (!open) return;
				const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
				document.addEventListener("keydown", onKey);
				return () => document.removeEventListener("keydown", onKey);
			}, [open]);
			// Inline-shell dismissal only: with the anchored float the panel is
			// portaled outside this root, and useDismissOnOutsidePointer (which
			// counts the portaled panel as inside) owns outside-pointer closes.
			useEffect(() => {
				if (!open || floatReady()) return;
				const onDoc = (e) => {
					if (rootRef.current !== null && !rootRef.current.contains(e.target)) setOpen(false);
				};
				document.addEventListener("mousedown", onDoc);
				return () => document.removeEventListener("mousedown", onDoc);
			}, [open]);
			const q = query.trim().toLowerCase();
			const rows = options.filter((option) => q === "" || option.label.toLowerCase().includes(q));
			const shown = value === "" || value === null || value === undefined
				? placeholder
				: displayName(value);
			const menuItems = [
				jsx("input", {
					key: "search",
					className: "dp_pickerSearch",
					type: "text",
					placeholder: t("searchPlaceholder"),
					value: query,
					autoFocus: true,
					onChange: (e) => setQuery(e.target.value),
				}),
				jsxs("div", { key: "list", className: "dp_pickerList", children: [
					rows.map((option) => jsx("button", {
						type: "button",
						key: option.value,
						role: "option",
						"aria-selected": value === option.value,
						className: `dp_pickerItem${value === option.value ? " dp_pickerItemActive" : ""}`,
						onClick: () => {
							onChange(option.value);
							setOpen(false);
							setQuery("");
						},
						children: option.label,
					})),
					rows.length === 0 && jsx("div", { className: "dp_pickerEmpty", children: t("noMatch") }),
				] }),
			];
			return jsxs("div", { ref: rootRef, className: "dp_picker", children: [
				jsx("button", {
					ref: btnRef,
					type: "button",
					className: "dp_pickerBtn",
					onClick: () => setOpen(!open),
					"aria-haspopup": "listbox",
					"aria-expanded": open,
					title: shown,
					children: [
						jsx("span", { className: "dp_pickerValue", children: shown }),
						jsx("span", { className: "dp_pickerCaret", children: open
							? jsx(primitives.IconChevronUpOutline14, { size: 14 })
							: jsx(primitives.IconChevronDownOutline14, { size: 14 }) }),
					],
				}),
				open && floatReady() && jsx(Float, {
					open,
					onClose: () => setOpen(false),
					rootRef,
					anchorRef: btnRef,
					maxHeight: 320,
					children: menuItems,
				}),
				open && !floatReady() && jsxs("div", { className: "dp_pickerMenu", role: "listbox", children: menuItems }),
			] });
		}

		/**
		 * Multi-select model picker: the full legend-linked filter. A checkbox-
		 * style list over the window's known models (the aux pseudo row among
		 * them); the 全部 entry clears. Selection state lives in the dashboard
		 * (empty = all models) and drives every model-filterable surface, so a
		 * legend click and a picker click are the same operation.
		 */
		export function ModelMultiPicker({ selected, onToggle, onClear, knownModels, names, t }) {
			const [open, setOpen] = useState(false);
			const [query, setQuery] = useState("");
			const rootRef = useRef(null);
			const btnRef = useRef(null);
			useEffect(() => {
				if (!open) return;
				const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
				document.addEventListener("keydown", onKey);
				return () => document.removeEventListener("keydown", onKey);
			}, [open]);
			// Inline-shell dismissal only (see SearchPicker): the anchored float
			// path hands outside-pointer closes to useDismissOnOutsidePointer.
			useEffect(() => {
				if (!open || floatReady()) return;
				const onDoc = (e) => {
					if (rootRef.current !== null && !rootRef.current.contains(e.target)) setOpen(false);
				};
				document.addEventListener("mousedown", onDoc);
				return () => document.removeEventListener("mousedown", onDoc);
			}, [open]);
			const label = (key) => {
				const { provider, model } = splitModelKey(key);
				return model === "unknown" ? t("unknownModel") : model === AUX_MODEL_KEY ? t("auxModelName") : names.labelOf(provider, model);
			};
			const q = query.trim().toLowerCase();
			const rows = (Array.isArray(knownModels) ? knownModels : []).filter((key) => q === "" || label(key).toLowerCase().includes(q));
			const sel = new Set(Array.isArray(selected) ? selected : []);
			const menuItems = [
				jsx("input", {
					key: "search",
					className: "dp_pickerSearch",
					type: "text",
					placeholder: t("searchPlaceholder"),
					value: query,
					autoFocus: true,
					onChange: (e) => setQuery(e.target.value),
				}),
				jsxs("div", { key: "list", className: "dp_pickerList", children: [
					jsx("button", {
						type: "button",
						role: "option",
						"aria-selected": sel.size === 0,
						className: `dp_pickerItem${sel.size === 0 ? " dp_pickerItemActive" : ""}`,
						onClick: () => { onClear(); setOpen(false); setQuery(""); },
						children: t("modelAll"),
					}),
					rows.map((key) => jsx("button", {
						type: "button",
						role: "option",
						"aria-selected": sel.has(key),
						className: `dp_pickerItem${sel.has(key) ? " dp_pickerItemActive" : ""}`,
						onClick: () => onToggle(key),
						title: label(key),
						children: jsxs("span", { className: "dp_pickerItemMain", children: [
							sel.has(key) && jsx("i", { className: "dp_mselDot" }),
							jsx("span", { className: "dp_ellipsis", children: label(key) }),
						] }),
					}, key)),
					rows.length === 0 && jsx("div", { className: "dp_pickerEmpty", children: t("noMatch") }),
				] }),
			];
			return jsxs("div", { ref: rootRef, className: "dp_picker", children: [
				jsx("button", {
					ref: btnRef,
					type: "button",
					className: "dp_pickerBtn",
					onClick: () => setOpen(!open),
					"aria-haspopup": "listbox",
					"aria-expanded": open,
					title: sel.size === 0 ? t("modelAll") : [...sel].map(label).join(" · "),
					children: [
						jsx("span", { className: "dp_pickerValue", children: sel.size === 0 ? t("modelAll") : fill(t("modelCount"), { n: sel.size }) }),
						jsx("span", { className: "dp_pickerCaret", children: open
							? jsx(primitives.IconChevronUpOutline14, { size: 14 })
							: jsx(primitives.IconChevronDownOutline14, { size: 14 }) }),
					],
				}),
				open && floatReady() && jsx(Float, {
					open,
					onClose: () => setOpen(false),
					rootRef,
					anchorRef: btnRef,
					maxHeight: 320,
					children: menuItems,
				}),
				open && !floatReady() && jsxs("div", { className: "dp_pickerMenu", role: "listbox", children: menuItems }),
			] });
		}

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
					jsx("div", { key: "g0", className: "dp_gridline dp_g0" }),
					jsx("div", { key: "g50", className: "dp_gridline dp_g50" }),
					jsx("div", { key: "g100", className: "dp_gridline dp_g100" }),
					cacheMaxRaw > 0 && jsx("span", { key: "cl0", className: "dp_gridlabel dp_gridlabelAxisL dp_g0", children: fmtTokens(cacheMax) }),
					cacheMaxRaw > 0 && jsx("span", { key: "cl50", className: "dp_gridlabel dp_gridlabelAxisL dp_g50", children: fmtTokens(cacheMax / 2) }),
					rightMaxRaw > 0 && jsx("span", { key: "rl0", className: "dp_gridlabel dp_g0", children: fmtTokens(rightMax) }),
					rightMaxRaw > 0 && jsx("span", { key: "rl50", className: "dp_gridlabel dp_g50", children: fmtTokens(rightMax / 2) }),
					total === 0 && jsxs("div", { key: "empty", className: "dp_emptyChart", children: [
						jsx(primitives.IconDataOutline16, { size: 20 }),
						jsx("span", { children: t("cacheNa") }),
					] }),
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
							style: hover < 4 ? { left: "0" } : hover >= 20 ? { left: "0", transform: "translateX(-100%)" } : { left: "0", transform: "translateX(-50%)" },
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
										? jsx("span", { className: "dp_barRowCost", children: `${fmtCost(cost.total ?? 0)} CNY` })
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
					costEnabled && auxCost > 0 && jsx("span", { children: `≈${fmtCost(auxCost)} CNY` }),
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
						const cost = seg.monthly === true
							? t("sessionMonthly")
							: costEnabled === true && seg.cost?.configured === true && seg.cost.total > 0
								? `${fmtCost(seg.cost.total)} CNY` : "—";
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
					: group.subagentMonthly === true
						? t("sessionMonthly")
						: costEnabled && group.subagentCost?.configured === true && group.subagentCost.total > 0
							? `${fmtCost(group.subagentCost.total)} CNY` : "—";
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
							const cost = s.monthly === true
								? t("sessionMonthly")
								: costEnabled === true && s.cost?.configured === true && s.cost.total > 0
									? `${fmtCost(s.cost.total)} CNY` : "—";
							const detailOpen = detail === s.id;
							const modelRow = (mr) => {
								const rm = mr.model ?? splitModelKey(mr.key).model;
								const rp = mr.provider ?? splitModelKey(mr.key).provider;
								const mrLabel = (typeof names?.fullLabelOf === "function" ? names.fullLabelOf(rp, rm) : rm) || "—";
								const mrCost = mr.monthly === true
									? t("sessionMonthly")
									: costEnabled === true && mr.cost?.configured === true && mr.cost.total > 0
										? `${fmtCost(mr.cost.total)} CNY` : "—";
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
