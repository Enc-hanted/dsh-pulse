import { jsx, jsxs } from "./react.js";
import { UNPRICED_HINT_TOKENS, fill, fmtTokens } from "./stores.js";
import { quotaDur, quotaEntryName, quotaRankEntries, quotaWindowCls, quotaWindowLabel } from "./quota.js";
import { Btn, TooltipPrim, primitives } from "./adapter.js";
import { balanceRunwayDays, statSideRow } from "./charts.js";
import { fmtCost, moneyParts } from "../view.js";
		//#region heroCard
		/**
		 * The dashboard's head canvas (the fluid redesign): ONE adaptive card
		 * solved as THREE zones, not four loose blocks —
		 *
		 *   [money column]  [quota zone]  [cache zone]
		 *    est  (top)      plans          head + ring + evidence
		 *    bal  (bottom)                  [activity: shared foot row]
		 *
		 * The money column stacks the two short ¥ blocks (cost over balance)
		 * so every zone is naturally card-height tall; the cache RING is sized
		 * from the canvas WIDTH (never from row height, which it would
		 * otherwise drive — circular) so it is the one incompressible element
		 * and the card's height benchmark. The three zones share ONE vertical
		 * grammar: a label head line across the top, instrument bodies that
		 * fill their zone, and the window-activity strip as a full-width foot
		 * row under a hairline — one dashboard, not stacked cards. Zones
		 * declare only a weight and a cqi ideal width; the browser solves the
		 * composition per container width and per toggle combination, with an
		 * ordered degradation (3 zones in a row → cache zone wraps full-width →
		 * all stacked) and no per-combo templates. Interaction is per BLOCK:
		 * the cost block and the quota block are hot zones (hover lift,
		 * pointer, Enter/Space) driving the shared expansion slot below the
		 * card; balance and the ring are display-only and never pretend
		 * otherwise.
		 */
		export function HeroCard({
			balance, quota, series, sessions, cost, totals,
			estOn, balanceOn, quotaOn, cacheOn, quotaOpenable,
			openX = null, onHot, onConfigure,
			rangeLabel = null, activityLine = null, t,
		}) {
			const balanceData = balance.data;
			const balanceResolved = balanceData !== null && balanceData.configured === true && balanceData.ok === true;
			/** An error needs action, so it keeps the block alive with a retry;
			 *  a merely-unconfigured feature stays silent (never a setup nag). */
			const balanceError = balanceOn && (balance.error !== null
				|| (balanceData !== null && balanceData.configured === true && balanceData.ok !== true));
			const runway = balanceResolved ? balanceRunwayDays(balanceData, series) : null;
			/** The balance hero through the shared money notation: symbol for
			 *  CNY, else the code as a quiet unit span — never both, and the
			 *  unit never renders at value size. */
			const balMoney = balanceResolved ? moneyParts(balanceData.total ?? 0, balanceData.currency) : null;
			const now = Date.now();
			/** The card's top-right refresh: one button for everything this card
			 *  fetches remotely (balance + subscription quota), disabled while any
			 *  of it is in flight. */
			const busy = balance.busy === true || quota.busy === true;
			const refreshCard = () => {
				balance.refresh();
				if (quotaOn) quota.refresh();
			};
			/** Hot-zone plumbing: only the blocks with an expansion to offer are
			 *  interactive; the cursor and the hover lift follow that truth. */
			const estHot = estOn && typeof onHot === "function";
			const quotaHot = quotaOn && quotaOpenable && typeof onHot === "function";
			const hotProps = (x, hot) => hot ? {
				role: "button", tabIndex: 0, "aria-expanded": openX === x, "aria-controls": "dp-pulse-expand",
				onClick: () => onHot(x),
				onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onHot(x); } },
			} : {};
			// ---------------------------------------------------------------- ①
			// 消费金额（费用估算）：本窗口的估算总额是画布的主数值。未配置时
			// 是去定价入口，绝不臆造数字；未定价/汇率注解排在值下方——它限定
			// 的是上面那个数字。
			const unpricedList = Array.isArray(cost.unpricedModels) ? cost.unpricedModels : [];
			const unpricedTotal = (cost.unpriced?.input || 0) + (cost.unpriced?.output || 0);
			const unpricedNote = cost.configured === true && unpricedTotal >= UNPRICED_HINT_TOKENS
				? (onConfigure === undefined
					? jsx("span", { className: "dp_consNote", children: t("unpricedHint") })
					: jsx("button", {
						type: "button", className: "dp_consNote dp_chipNoteBtn",
						title: unpricedList.length > 0
							? unpricedList.map((row) => `${row.key} ${fmtTokens(row.total ?? 0)}`).join(" · ")
							: fill(t("unpriced"), { n: fmtTokens(unpricedTotal) }),
						onClick: (e) => { e.stopPropagation(); onConfigure(); },
						children: t("unpricedHint"),
					}))
				: null;
			const fxNote = cost.configured === true && unpricedNote === null && (cost.convertedFromUsd || 0) > 0
				? fill(t("fxNote"), { r: cost.usdToCny })
				: null;
			const estBlk = estOn && jsxs("div", { className: `dp_hBlk dp_hEst${estHot ? " dp_hHot" : ""}`, ...hotProps("est", estHot), children: [
				jsxs("span", { className: "dp_hHead", children: [
					jsx("span", { className: "dp_consLabel", children: t("chipCost") }),
					rangeLabel !== null && jsx("span", { className: "dp_hRange", children: rangeLabel }),
				] }),
				// 无值不穿主值尺寸：未配置的「未配置单价」是注解级安静态，
				// 显著度由去定价按钮的下划线承载，不靠字号。
				cost.configured === true
					? jsx("span", { className: "dp_consHeroVal dp_hBody", children: moneyParts(cost.total ?? 0, "CNY").text })
					: (onConfigure !== undefined
						? jsx("button", { type: "button", className: "dp_chipValueBtn dp_hBody", onClick: (e) => { e.stopPropagation(); onConfigure(); }, children: t("costGoSet") })
						: jsx("span", { className: "dp_consNote dp_costOff dp_hBody", children: t("costOff") })),
				unpricedNote,
				fxNote !== null && jsx("span", { className: "dp_consNote", title: fxNote, children: fxNote }),
			] });
			// ---------------------------------------------------------------- ②
			// 官方余额：徽章（预估可用 N 天）+ 次主值 + 赠送/充值两个数位。
			// 报错时保留区块与行内重试；未配置直接不挂载。
			const balBlk = balanceOn && (balanceResolved || balanceError) && jsxs("div", { className: "dp_hBlk dp_hBal", children: [
				jsxs("span", { className: "dp_hHead", children: [
					jsx("span", { className: "dp_consLabel", children: t("balanceTitle") }),
					balanceResolved && runway !== null && jsx("span", {
						className: runway < 3 ? "dp_hBadge dp_hBadgeLow" : "dp_hBadge",
						children: runway < 3 ? fill(t("runwayLow"), { n: runway }) : fill(t("runwayDays"), { n: runway }),
					}),
				] }),
				balanceResolved && jsxs("span", { className: "dp_consHeroVal dp_hBody", children: [
					balMoney.text,
					balMoney.unit !== "" && jsx("span", { className: "dp_consUnit", children: ` ${balMoney.unit}` }),
				] }),
				balanceResolved && jsxs("span", { className: "dp_hMetrics", children: [
					Number(balanceData.granted) > 0 && jsxs("span", { className: "dp_hMetric", children: [
						jsx("span", { className: "dp_consLabel", children: t("consStatGranted") }),
						jsx("b", { className: "dp_hMetricOk", children: fmtCost(balanceData.granted) }),
					] }, "granted"),
					Number(balanceData.topped) > 0 && jsxs("span", { className: "dp_hMetric", children: [
						jsx("span", { className: "dp_consLabel", children: t("consStatTopped") }),
						jsx("b", { children: fmtCost(balanceData.topped) }),
					] }, "topped"),
					balanceData.isAvailable !== true && jsx("span", { className: "dp_balanceWarn", children: t("balanceUnavailable") }, "warn"),
				] }),
				balanceError && jsx("span", {
					className: balanceResolved ? "dp_consNote" : "dp_consNote dp_hBody",
					title: fill(t("balanceFailed"), { err: balance.error ?? balanceData?.error ?? "?" }),
					children: fill(t("balanceFailed"), { err: balance.error ?? balanceData?.error ?? "?" }),
				}),
				balanceError && jsx(Btn, {
					variant: "ghost", size: "sm", fallbackClass: "dp_miniBtn",
					onClick: (e) => { e.stopPropagation(); balance.refresh(); },
					disabled: balance.busy, children: t("retry"),
				}),
			] });
			// ---------------------------------------------------------------- ③
			// 订阅额度：最相关的两条订阅 + 其余以 +N 收起（悬浮列出名单），
			// 出错的渠道行内重试。整块是热区：点开完整明细（窗口/燃速/分工
			// 作区）。行内没有倒计时——每个窗口组的悬浮层（官方 Tooltip 原
			// 语，老宿主退回原生 title）显示该窗口自己的「{v}后重置」。
			const providers = Array.isArray(quota.data?.providers) ? quota.data.providers : [];
			const okEntries = quotaRankEntries(providers.filter((entry) => entry.ok === true), Array.isArray(sessions) ? sessions : [], now);
			const shownQuota = okEntries.slice(0, 2);
			const restQuota = okEntries.slice(2);
			const actionableQuota = quotaOn ? providers.filter((entry) => entry.ok !== true && entry.disabled !== true) : [];
			const quotaRow = (entry) => {
				const windows = Array.isArray(entry.windows) ? entry.windows : [];
				return jsxs("span", { className: "dp_qwRow", children: [
					jsx("span", { className: "dp_qName", title: quotaEntryName(entry), children: quotaEntryName(entry) }),
					jsxs("span", { className: "dp_qWins", children: windows.map((w) => {
						const pct = w.usedPct === null || w.usedPct === undefined ? "—" : `${Math.round(w.usedPct)}%`;
						const resetIn = w.resetsAt !== null && w.resetsAt !== undefined && w.resetsAt > now
							? fill(t("quotaResetIn"), { v: quotaDur(w.resetsAt - now, t) }) : null;
						const label = `${quotaWindowLabel(w.id, t)} ${pct}`;
						const anchor = jsxs("span", {
							className: "dp_qwWin",
							title: TooltipPrim === null ? (resetIn === null ? label : `${label} · ${resetIn}`) : undefined,
							children: [
								jsx("span", { className: "dp_qwTag", children: quotaWindowLabel(w.id, t) }),
								jsx("span", { className: "dp_qwTrack", children: jsx("span", { className: quotaWindowCls(w.usedPct), style: { width: `${Math.max(2, Math.min(100, w.usedPct ?? 0))}%` } }) }),
								jsx("span", { className: "dp_qwPct", children: pct }),
							],
						}, w.id);
						if (TooltipPrim === null || resetIn === null) return anchor;
						return jsx(TooltipPrim, { label: resetIn, side: "top", portal: true, delayMs: 300, children: anchor }, w.id);
					}) }),
				] }, entry.provider);
			};
			const quotaBlk = quotaOn && (shownQuota.length > 0 || actionableQuota.length > 0) && jsxs("div", { className: `dp_hBlk dp_hQuota${quotaHot ? " dp_hHot" : ""}`, ...hotProps("quota", quotaHot), children: [
				jsxs("span", { className: "dp_hHead", children: [
					jsx("span", { className: "dp_consLabel", children: t("quotaTitle") }),
					okEntries.length > 0 && jsx("span", { className: "dp_hRange", children: fill(t("quotaPlanCount"), { n: okEntries.length }) }),
				] }),
				jsxs("span", { className: "dp_qChips dp_hBody", children: [
					shownQuota.map(quotaRow),
					restQuota.length > 0 && jsx("span", {
						className: "dp_qAux",
						title: fill(t("quotaMoreTitle"), { names: restQuota.map((entry) => quotaEntryName(entry)).join(" · ") }),
						children: `+${restQuota.length}`,
					}, "quota-more"),
					actionableQuota.map((entry) => jsxs("span", { className: "dp_qwRow", children: [
						jsx("span", { className: "dp_qName", children: quotaEntryName(entry) }),
						jsxs("span", { className: "dp_qwErr", children: [
							jsx("span", { children: entry.configured === false ? t("quotaNoCred") : fill(t("quotaFailed"), { err: entry.error ?? "?" }) }),
							entry.configured === true && jsx(Btn, {
								variant: "ghost", size: "sm", fallbackClass: "dp_miniBtn",
								onClick: (e) => { e.stopPropagation(); quota.refresh(); },
								disabled: quota.busy, children: t("retry"),
							}),
						] }),
					] }, entry.provider)),
					quota.error !== null && jsx("span", { className: "dp_qAux", children: fill(t("quotaFailed"), { err: quota.error }) }),
				] }),
			] });
			// ---------------------------------------------------------------- ④
			// 缓存命中：头行（与另两区共享同一条 label 线）+ 环 + 右侧证据列
			// （命中/总输入、未缓存输入、输出，沿环高均布）。纯展示，不点击切
			// 换视图。环的直径由画布宽度决定（cqw）——它是全卡唯一不可压缩的
			// 元素，也因此是卡片高度的基准；任何状态下都不从行高反推尺寸。值
			// 弧用平头端帽：圆头会在命中率 ≥~96% 时把缺口整个盖死，平头让缺
			// 口按真实比例露出来。「区间内活动」不再挂在环行里——它是窗口级
			// 数据，统一落在画布底部的通栏脚行（dp_hFoot）。
			const rate = typeof totals?.cacheHitRate === "number" && Number.isFinite(totals.cacheHitRate)
				? Math.max(0, Math.min(1, totals.cacheHitRate)) : null;
			const R = 48;
			const C = 2 * Math.PI * R;
			/** The no-data state keeps the ring but drops the two always-zero
			 *  rows; the zone's head row names the block, so the ring center
			 *  carries only the number itself. */
			const sideRows = rate === null
				? [jsx("div", { className: "dp_ringSideRow", children: jsx("span", { children: t("cacheNa") }) }, "na")]
				: [
					jsxs("div", { className: "dp_ringSideRow", children: [
						jsx("span", { children: `${t("sideHit")} ` }),
						jsx("b", { className: "dp_hitVal", children: fmtTokens(totals.cacheRead) }),
						jsx("span", { className: "dp_hitSub", children: ` / ${t("sideTotal")} ${fmtTokens((totals.cacheRead || 0) + (totals.input || 0) + (totals.cacheWrite || 0))}` }),
					] }, "of"),
					statSideRow(t("sideUncached"), fmtTokens((totals.input || 0) + (totals.cacheWrite || 0)), "uncached"),
					statSideRow(t("sideOutput"), fmtTokens(totals.output || 0), "output"),
				];
			const cacheBlk = cacheOn && jsxs("div", { className: "dp_hBlk dp_hCache", children: [
				jsx("span", { className: "dp_hHead", children:
					jsx("span", { className: "dp_consLabel", children: t("chipCache") }) }),
				jsxs("div", { className: "dp_cardBody dp_ringBody dp_hBody", children: [
					jsxs("div", { className: "dp_ringWrap", role: "img", "aria-label": rate === null ? t("cacheNa") : `${t("chipCache")} ${Math.round(rate * 100)}%`, children: [
						jsxs("svg", { viewBox: "0 0 116 116", width: "116", height: "116", "aria-hidden": "true", children: [
							jsx("circle", { className: "dp_ringTrack", cx: "58", cy: "58", r: String(R), fill: "none", strokeWidth: "12" }),
							rate !== null && jsx("circle", {
								className: "dp_ringValue", cx: "58", cy: "58", r: String(R), fill: "none", strokeWidth: "12",
								strokeDasharray: String(C),
								strokeDashoffset: String(C * (1 - rate)),
								transform: "rotate(-90 58 58)",
							}),
						] }),
						jsx("div", { className: "dp_ringCenter", children:
							jsx("span", { className: rate === null ? "dp_ringPct dp_ringNa" : "dp_ringPct", children: rate === null ? "—" : `${Math.round(rate * 100)}%` }) }),
					] }),
					/** The evidence column holds only the ring's own numbers and
					 *  stretches to the ring's height, its rows spread along it —
					 *  the ring is the benchmark, the ledger answers to it. */
					jsxs("div", { className: "dp_ringSide", children: sideRows }),
				] }),
			] });
		// 资金列：消费金额与官方余额是仅有的两个短块，上下叠放成一列——
		// 两个「¥ 主值」语义同源（本期花了多少 / 还剩多少），叠放后每区
		// 都天然有卡高，矮块不再靠拉伸硬撑。列内两半与 quota 账本共用同
		// 一槽位原语（minmax(min-content,1fr)），发丝线是槽位边界本身。
			const moneyCol = (estOn || balanceOn) && jsxs("div", { className: "dp_hCol", children: [
				estBlk,
				balBlk,
			] });
			// 「区间内活动」永远落在画布底部的通栏脚行：一根发丝线之上，三格
			// 沿全宽铺开——它是窗口级数据，不隶属于任何一区，也是整张画布共
			// 享的下缘基准线。
			// 根节点同时穿 dp_chip：扩展 tile 的形状契约（.dp_chips>.dp_chip）
			// 与画布的显式覆盖（aspect-ratio:auto 等）都挂在这两个名字上。
			// dp_hasRefresh：刷新钮悬浮在画布右上角的 padding 带里，挂载时
			// 画布预留那个角，最右块的头部注解永远不会钻到按钮底下。
			return jsxs("div", { className: `dp_chip dp_heroCard${balanceOn || quotaOn ? " dp_hasRefresh" : ""}`, children: [
				(balanceOn || quotaOn) && jsx("button", {
					type: "button", className: "dp_qRefresh dp_consActions",
					onClick: (e) => { e.stopPropagation(); refreshCard(); },
					disabled: busy, title: t("refreshCard"), "aria-label": t("refreshCard"),
					children: jsx(primitives.IconRefreshOutline16, { size: 13 }),
				}),
				moneyCol,
				quotaBlk,
				cacheBlk,
				activityLine !== null && jsx("div", { className: "dp_hFoot", children: activityLine }),
			] });
		}
		//#endregion
