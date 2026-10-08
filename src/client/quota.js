import { useState, useMemo, jsx, jsxs } from "./react.js";
import { quotaDayStart } from "../view.js";
import { Seg } from "./adapter.js";
import { fill, fmtTokens } from "./stores.js";
import { quotaBurn, quotaCalibrate, quotaCoverage, quotaFeeShare, quotaMonthlyFee, quotaMoney, quotaProjectAttribution, quotaWindowTokens } from "./../view.js";
		//#region subscription quota surfaces
		/** Compact duration words for reset countdowns (<1h → minutes, <48h →
		 *  hours, else days). Locale-aware through the panel's `t`. */
		export const quotaDur = (ms, t) => {
			const minutes = Math.max(1, Math.round(ms / 60000));
			if (minutes < 60) return fill(t("quotaDurMin"), { n: minutes });
			const hours = ms / 3600000;
			if (hours < 48) return fill(t("quotaDurHour"), { n: Math.round(hours) });
			return fill(t("quotaDurDay"), { n: Math.max(1, Math.round(ms / 86400000)) });
		};
		/** Locale label of a window id. */
		export const quotaWindowLabel = (id, t) => (id === "5h" ? t("quotaWindow5h")
			: id === "7d" || id === "week" ? t("quotaWindow7d")
				: id === "month" ? t("quotaWindowMonth")
					: `${t("quotaWindowGeneric")} ${id}`);
		export const quotaWindowCls = (pct) => (pct === null ? "dp_qwFill"
			: pct >= 90 ? "dp_qwFill dp_qwFillHot"
				: pct >= 70 ? "dp_qwFill dp_qwFillWarm" : "dp_qwFill");
		/** The same countdown compressed to what a card row can afford: one
		 *  character of unit (`18分` / `2时` / `3天`, `18m` / `2h` / `3d`), and an
		 *  absolute month-day instead of a word — `10-03` — once the reset is
		 *  more than a week out, where "…天" stops being actionable and starts
		 *  being a three-character number nobody converts in their head. Rows
		 *  therefore stay one width instead of growing by a word. */
		export const quotaDurTight = (ms, t) => {
			const minutes = Math.max(1, Math.round(ms / 60000));
			if (minutes < 60) return fill(t("quotaDurMinTight"), { n: minutes });
			const hours = ms / 3600000;
			if (hours < 24) return fill(t("quotaDurHourTight"), { n: Math.round(hours) });
			const days = ms / 86400000;
			if (days < 7) return fill(t("quotaDurDayTight"), { n: Math.round(days) });
			const at = new Date(Date.now() + ms);
			const mm = String(at.getMonth() + 1).padStart(2, "0");
			const dd = String(at.getDate()).padStart(2, "0");
			return `${mm}-${dd}`;
		};
		/** Display face: plan name once a query answered, else the adapter's
		 *  label, else the catalog/route name. */
		export const quotaEntryName = (entry) => entry.plan?.name ?? entry.label ?? entry.displayName ?? entry.provider;
		/**
		 * Rank quota providers for the collapsed bar: today's dsh-side tokens
		 * lead (the actively-burning plans first), then the plan's own weekly
		 * utilization — so a subscription idle today still ranks by its
		 * overall burn instead of dropping off. Sorting may read the
		 * provider-reported percentage (a fact, not an estimate); the tokens
		 * stay strictly dsh-scope.
		 */
		export function quotaRankEntries(entries, sessions, now) {
			const dayStart = new Date(now);
			const todayFrom = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate()).getTime();
			return entries
				.map((entry) => ({
					entry,
					today: sessions.length > 0 ? quotaWindowTokens(sessions, todayFrom, now, entry.provider).total : 0,
					pct: (Array.isArray(entry.windows) ? entry.windows : []).find((w) => w.id === "7d")?.usedPct ?? 0,
				}))
				.sort((a, b) => b.today - a.today || b.pct - a.pct)
				.map((row) => row.entry);
		}

		/**
		 * The expanded subscription-quota panel, the balance bar's slide-down
		 * sibling — stacked: the plan/windows card on top, the full-width
		 * per-project attribution card below. The windows card carries the
		 * plan line, every window's utilization + reset countdown, the
		 * coverage-gated dsh-scope token translation (hover for the
		 * methodology), the burn forecast and the tool extras; the table
		 * attributes the burn to projects over the weekly window or the
		 * calendar month with each project's cut of the monthly fee.
		 */
		export function QuotaPanel({ quota, data, t }) {
			const providers = (Array.isArray(quota.data?.providers) ? quota.data.providers : []).filter((entry) => entry.ok === true);
			const [providerId, setProviderId] = useState(null);
			const [range, setRange] = useState("week");
			const now = Date.now();
			const sessions = Array.isArray(data?.sessions) ? data.sessions : [];
			const series = Array.isArray(quota.data?.series) ? quota.data.series : [];
			/** The panel opens on today's busiest plan (the bar's own ranking);
			 *  the switcher then walks every queried subscription. */
			const ranked = quotaRankEntries(providers, sessions, now);
			const active = providers.find((entry) => entry.provider === providerId) ?? ranked[0] ?? null;
			const fee = active !== null ? quotaMonthlyFee(active.fee) : null;
			/** Coverage audit for the active provider: gates the token
			 *  translation — a key also spent outside dsh would make every
			 *  dsh-derived total read low, so estimates switch off (the
			 *  percentages stay, they are the provider's own truth). The
			 *  audit only speaks about intervals inside the loaded payload
			 *  window: outside it, zero local tokens is a cut artifact, not
			 *  evidence. */
			const boundsFrom = typeof data?.fromDay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.fromDay)
				? quotaDayStart(data.fromDay) : undefined;
			const boundsTo = typeof data?.toDay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.toDay)
				? quotaDayStart(data.toDay) + 86400000 : undefined;
			const coverage = active !== null
				? quotaCoverage(series, sessions, active.provider, { fromMs: boundsFrom, toMs: boundsTo })
				: { state: "thin", intervals: 0 };
			/** The attribution span: the provider's weekly window when its reset
			 *  is known, else a plain rolling 7 days; the month toggle pins the
			 *  calendar month (the BudgetCard's frame). */
			const weekly = active?.windows?.find((w) => w.id === "7d") ?? active?.windows?.[0] ?? null;
			const weekFrom = weekly !== null && weekly.windowMs !== null && weekly.windowMs !== undefined
				? (weekly.resetsAt ?? now) - weekly.windowMs
				: now - 7 * 86400000;
			const monthStart = new Date(now);
			const monthFrom = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1).getTime();
			const from = range === "month" ? monthFrom : weekFrom;
			const attribution = useMemo(
				() => (active === null || sessions.length === 0 ? [] : quotaProjectAttribution(sessions, from, now, active.provider)),
				[active?.provider, from, now, sessions],
			);
			const grandTotal = attribution.reduce((sum, row) => sum + row.total, 0);
			if (active === null) {
				return jsxs("div", { className: "dp_quotaPanel", children: [
					jsxs("div", { className: "dp_estCard", children: [
						jsx("div", { className: "dp_cardHead", children: jsx("span", { className: "dp_cardLabel", children: t("quotaTitle") }) }),
						jsx("span", { className: "dp_costNote", children: t("quotaEmpty") }),
					] }),
				] });
			}
			const providerSwitch = providers.length > 1 && jsx(Seg, {
				id: "pulse-quota-provider",
				value: active.provider,
				options: providers.map((entry) => ({ value: entry.provider, label: quotaEntryName(entry) })),
				onChange: setProviderId,
				label: t("quotaProviderLabel"),
			});
			const planLine = jsxs("div", { className: "dp_qPlanBlock", children: [
				jsxs("span", { className: "dp_qPlanName", children: [
					active.plan?.name ?? active.displayName ?? active.provider,
					active.plan?.level !== null && active.plan?.level !== undefined && active.plan?.level !== active.plan?.name ? ` · ${active.plan.level}` : "",
				] }),
				(active.plan?.renewsAt !== null && active.plan?.renewsAt !== undefined) || fee !== null
					? jsxs("span", { className: "dp_qPlanSub", children: [
						active.plan?.renewsAt ? fill(t("quotaPlanRenew"), { d: String(active.plan.renewsAt).slice(0, 10) }) : "",
						active.plan?.renewsAt && fee !== null ? " · " : "",
						fee !== null ? `${quotaMoney(fee.monthly, fee.currency)}${t("quotaPerMonth")}` : "",
					] })
					: null,
			] });
			/** One window = one fixed 5-column row: label | track | pct | the
			 *  estimate+burn sentence — or, when there are no numbers to show,
			 *  the state note in the same slot ("估算已停用…", "本地用量不足…")
			 *  — | right-aligned counts + reset countdown. Token translation
			 *  exists only for token-kind windows (request-count plans report
			 *  absolute counts server-side; translating tokens there would
			 *  fabricate units) and only when coverage allows it. */
			const windowRows = (Array.isArray(active.windows) ? active.windows : []).map((w) => {
				const windowMs = w.windowMs ?? (w.id === "5h" ? 5 * 3600000 : w.id === "7d" ? 7 * 86400000 : 7 * 86400000);
				const winFrom = w.resetsAt !== null && w.resetsAt !== undefined ? w.resetsAt - windowMs : now - windowMs;
				const local = sessions.length > 0 ? quotaWindowTokens(sessions, winFrom, now, active.provider) : { total: 0 };
				const cal = coverage.state !== "external" && w.kind === "tokens" ? quotaCalibrate(w.usedPct, local.total) : null;
				const burn = quotaBurn(series.filter((p) => p.provider === active.provider && p.window === w.id), now, w.resetsAt ?? null);
				const usedText = w.used !== null && w.used !== undefined && w.total !== null && w.total !== undefined
					? `${w.used}/${w.total} ${t("quotaKindRequests")}`
					: null;
				const resetText = w.resetsAt !== null && w.resetsAt !== undefined && w.resetsAt > now
					? fill(t("quotaResetIn"), { v: quotaDur(w.resetsAt - now, t) })
					: null;
				/** Numbers first (burn is the provider's own percentage slope,
				 *  always true), then the state note when estimates are off —
				 *  one slot, no second line. */
				const estParts = [];
				if (cal !== null) {
					estParts.push(jsxs("span", { className: "dp_qCal", title: [t("quotaScopeNote"), fill(t("quotaCalBasis"), { v: fmtTokens(cal.basisTokens) }), coverage.state === "ok" ? fill(t("quotaScopeStable"), { n: coverage.intervals }) : t("quotaScopeThin")].join("\n"), children: [
						fill(t("quotaCalTotal"), { v: fmtTokens(cal.totalEst) }),
						" · ",
						fill(t("quotaCalRemain"), { v: fmtTokens(cal.remainingEst) }),
					] }, "cal"));
				}
				if (burn !== null) {
					// A negative slope means the provider's percentage went DOWN
					// (a correction/reset, not consumption) — "−x%/h" reads like
					// nonsense, so the flat wording takes over.
					estParts.push(jsx("span", { children: burn.perHour > 0
						? fill(t("quotaBurnRate"), { v: `${burn.perHour.toFixed(1)}%` })
						: t("quotaBurnFlat") }, "rate"));
					if (burn.exhaustsAt !== undefined && burn.exhaustsAt !== null) estParts.push(jsx("span", { children: fill(t("quotaBurnExhaust"), { v: quotaDur(burn.exhaustsAt - now, t) }) }, "exhaust"));
					else if (burn.pctAtReset !== undefined && burn.pctAtReset !== null) estParts.push(jsx("span", { children: fill(t("quotaBurnReset"), { p: Math.round(burn.pctAtReset) }) }, "reset"));
				}
				const stateNote = cal === null && burn === null
					? (coverage.state === "external" ? t("quotaEstOff") : w.kind === "tokens" ? t("quotaNoCal") : null)
					: (coverage.state === "external" ? t("quotaEstOff") : null);
				return jsxs("div", { className: "dp_qWin", children: [
					jsxs("div", { className: "dp_qWinMain", children: [
						jsx("span", { className: "dp_qwLabel", children: quotaWindowLabel(w.id, t) }),
						jsx("span", { className: "dp_qwTrack dp_qwTrackWide", children: jsx("span", { className: quotaWindowCls(w.usedPct), style: { width: `${Math.max(2, Math.min(100, w.usedPct ?? 0))}%` } }) }),
						jsx("span", { className: "dp_qwPct", children: w.usedPct === null ? "—" : `${Math.round(w.usedPct)}%` }),
						jsxs("span", { className: "dp_qEst", title: t("quotaScopeNote"), children: [
							estParts.flatMap((part, i) => (i === 0 ? [part] : [jsx("span", { className: "dp_qEstSep", children: "·" }, `sep-${i}`), part])),
							estParts.length > 0 && stateNote !== null && jsx("span", { className: "dp_qEstSep", children: "·" }),
							stateNote !== null && jsx("span", { className: "dp_qNote", children: stateNote }),
							estParts.length === 0 && stateNote === null && jsx("span", { children: "—" }),
						] }),
						jsxs("span", { className: "dp_qWinRight", children: [
							usedText !== null && jsx("span", { children: usedText }),
							resetText !== null && jsx("span", { children: resetText }),
						] }),
					] }),
				] }, w.id);
			});
			const extraRows = (Array.isArray(active.extras) ? active.extras : []).map((extra) => jsxs("div", { className: "dp_qWin", children: [
				jsxs("div", { className: "dp_qWinMain", children: [
					jsx("span", { className: "dp_qwLabel", children: extra.label ?? t("quotaTools") }),
					jsx("span", { className: "dp_qwTrack dp_qwTrackWide", children: jsx("span", { className: quotaWindowCls(extra.usedPct), style: { width: `${Math.max(2, Math.min(100, extra.usedPct ?? 0))}%` } }) }),
					jsx("span", { className: "dp_qwPct", children: extra.usedPct === null ? "—" : `${Math.round(extra.usedPct)}%` }),
					extra.used !== null && extra.used !== undefined && extra.total !== null && extra.total !== undefined
						? jsx("span", { className: "dp_qWinRight dp_qWinSpan", children: `${extra.used}/${extra.total}` })
						: jsx("span", { className: "dp_qWinSpan" }),
				] }),
			] }, extra.id));
			const headRows = [
				jsx("span", { className: "dp_qTh", children: t("quotaProjectCol") }, "h-project"),
				jsx("span", { className: "dp_qTh", children: t("quotaTokensCol") }, "h-tokens"),
				jsx("span", { className: "dp_qTh", title: t("quotaShareTip"), children: t("quotaShareCol") }, "h-share"),
				jsx("span", { className: "dp_qTh", children: fee !== null ? t("quotaFeeCol") : "" }, "h-fee"),
			];
			const top = attribution.slice(0, 6);
			const rest = attribution.slice(6);
			const bodyRows = top.map((row) => jsxs("div", { className: "dp_qTr", children: [
				jsx("span", { className: "dp_qTd dp_qTdFirst", title: row.project, children: row.project === "" ? "—" : row.project }),
				jsx("span", { className: "dp_qTd dp_qTdNum", children: fmtTokens(row.total) }),
				jsxs("span", { className: "dp_qTd dp_qTdFlex", children: [
					jsx("span", { children: `${Math.round(row.share * 100)}%` }),
					jsx("span", { className: "dp_qShareTrack", children: jsx("span", { className: "dp_qShareFill", style: { width: `${Math.max(2, Math.min(100, row.share * 100))}%` } }) }),
				] }),
				fee !== null ? jsx("span", { className: "dp_qTd dp_qTdNum", children: quotaMoney(quotaFeeShare(active.fee, row.total, grandTotal) ?? 0, fee.currency) }) : jsx("span", {}, "f"),
			] }, row.project || "__"));
			const restRow = rest.length > 0 ? jsxs("div", { className: "dp_qTr", children: [
				jsx("span", { className: "dp_qTd dp_qTdFirst", children: fill(t("cmdOthers"), { n: rest.length }) }),
				jsx("span", { className: "dp_qTd dp_qTdNum", children: fmtTokens(rest.reduce((sum, row) => sum + row.total, 0)) }),
				jsx("span", { className: "dp_qTd", children: `${Math.round((grandTotal > 0 ? rest.reduce((sum, row) => sum + row.total, 0) / grandTotal : 0) * 100)}%` }),
				fee !== null ? jsx("span", { className: "dp_qTd dp_qTdNum", children: quotaMoney(quotaFeeShare(active.fee, rest.reduce((sum, row) => sum + row.total, 0), grandTotal) ?? 0, fee.currency) }) : jsx("span", {}, "f"),
			] }, "__rest") : null;
			// Stacked layout: the windows card and the (framed, full-width)
			// attribution table each get the whole row — the table is the
			// widest thing here and reads badly squeezed beside the card.
			return jsxs("div", { className: "dp_quotaPanel", children: [
				jsxs("div", { className: "dp_estCard", children: [
					jsxs("div", { className: "dp_cardHead", children: [
						jsx("span", { className: "dp_cardLabel", children: t("quotaTitle") }),
						providerSwitch,
					] }),
					planLine,
					jsx("div", { className: "dp_qDivider" }),
					windowRows,
					extraRows.length > 0 && jsx("div", { className: "dp_qDivider" }),
					extraRows,
				] }),
				jsxs("div", { className: "dp_estCard", children: [
					jsxs("div", { className: "dp_cardHead", children: [
						jsx("span", { className: "dp_cardLabel", children: t("quotaProjects") }),
						jsx(Seg, {
							id: "pulse-quota-range",
							value: range,
							options: [
								{ value: "week", label: t("quotaRangeWeek") },
								{ value: "month", label: t("quotaRangeMonth") },
							],
							onChange: setRange,
							label: t("quotaRangeLabel"),
						}),
					] }),
					attribution.length === 0
						? jsx("span", { className: "dp_costNote", children: t("quotaNoLocal") })
						: jsxs("div", { className: "dp_qTable", children: [
							jsxs("div", { className: "dp_qTr", children: headRows }),
							bodyRows,
							restRow,
						] }),
					grandTotal > 0 && jsx("div", { className: "dp_qNote dp_qFoot", children: fill(t("quotaLocalTokens"), { v: fmtTokens(grandTotal) }) }),
				] }),
			] });
		}
		//#endregion

