import { useState, useEffect, jsx, jsxs } from "./react.js";
import { Input, Seg } from "./adapter.js";
import { fill } from "./stores.js";
import { buildView, fmtCost, localDay, shiftDay } from "./../view.js";
		//#region dashboard
		/** Monthly budget panel: a CNY budget input with a progress bar, the
		 *  month-to-date estimated spend (its own stats fetch over the month
		 *  window, priced through the payload's own rules — the dashboard's
		 *  shared store stays untouched) and a run-rate month-end forecast.
		 *  The budget is a localStorage preference, like the panel toggles. */
		export function BudgetCard({ t }) {
			const [budget, setBudget] = useState(() => {
				try {
					const raw = localStorage.getItem("dsh-pulse:budget");
					const v = raw === null ? null : Number(raw);
					return v !== null && Number.isFinite(v) && v > 0 ? v : null;
				} catch (error) { return null; }
			});
			/** Day-counting mode for the daily average: all days, weekdays
			 *  (no Sat/Sun), or single-off (no Sun). */
			const [mode, setMode] = useState(() => {
				try {
					const raw = localStorage.getItem("dsh-pulse:budget-days-mode");
					return raw === "weekdays" || raw === "single" ? raw : "all";
				} catch (error) { return "all"; }
			});
			const [month, setMonth] = useState({ status: "loading", used: null, from: null, to: null, totalDays: 0, error: null });
			useEffect(() => {
				const today = localDay(Date.now());
				const from = `${today.slice(0, 8)}01`;
				let cancelled = false;
				fetch(`/pulse/stats?from=${encodeURIComponent(from)}&to=${encodeURIComponent(today)}`, {
					credentials: "same-origin",
					headers: { accept: "application/json" },
				})
					.then(async (res) => {
						if (!res.ok) throw new Error(`HTTP ${res.status}`);
						return res.json();
					})
					.then((payload) => {
						if (cancelled) return;
						const fromDay = typeof payload?.fromDay === "string" ? payload.fromDay : from;
						const toDay = typeof payload?.toDay === "string" ? payload.toDay : today;
						const view = buildView(Array.isArray(payload?.sessions) ? payload.sessions : [], {
							granularity: "day", from: fromDay, to: toDay,
							pricing: payload.pricing, fx: payload.fx,
							auxShape: payload?.auxShape ?? null,
						});
						const used = view.cost?.configured === true && Number.isFinite(view.cost.total) ? view.cost.total : null;
						const totalDays = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0).getDate();
						setMonth({ status: "ready", used, from: fromDay, to: toDay, totalDays, error: null });
					})
					.catch((error) => {
						if (!cancelled) setMonth((s) => ({ ...s, status: "error", error: String(error?.message ?? error) }));
					});
				return () => { cancelled = true; };
			}, []);

			const onBudget = (value) => {
				const v = value === "" ? null : Number(value);
				const next = v !== null && Number.isFinite(v) && v > 0 ? v : null;
				setBudget(next);
				try {
					if (next === null) localStorage.removeItem("dsh-pulse:budget");
					else localStorage.setItem("dsh-pulse:budget", String(next));
				} catch (error) { /* non-fatal */ }
			};
			const onMode = (next) => {
				setMode(next);
				try { localStorage.setItem("dsh-pulse:budget-days-mode", next); } catch (error) { /* non-fatal */ }
			};

			/** Effective day count under the mode (Sun = rest under "single"). */
			const isWorkDay = (day) => {
				const [y, m, d] = String(day).split("-").map(Number);
				const dow = (new Date(y, m - 1, d, 12).getDay() + 6) % 7; // 0 = Monday
				if (mode === "weekdays") return dow < 5;
				if (mode === "single") return dow !== 6;
				return true;
			};
			const countWorkDays = (from, to) => {
				let n = 0;
				for (let d = String(from); d <= String(to); d = shiftDay(d, 1)) {
					if (isWorkDay(d)) n += 1;
				}
				return n;
			};
			const used = month.used;
			const over = budget !== null && used !== null && used > budget;
			const pct = budget !== null && used !== null && budget > 0 ? Math.min(100, (used / budget) * 100) : 0;
			const workDays = used !== null && month.from !== null ? countWorkDays(month.from, month.to) : 0;
			const avg = used !== null && workDays > 0 ? used / workDays : null;
			const remaining = used !== null && month.to !== null
				? countWorkDays(shiftDay(month.to, 1), `${month.to.slice(0, 8)}${String(month.totalDays).padStart(2, "0")}`)
				: 0;
			const forecast = used !== null && avg !== null ? used + avg * remaining : null;
			return jsxs("div", { className: "dp_balanceBar dp_budgetBar", children: [
				jsx("span", { className: "dp_balanceLabel", children: t("budgetTitle") }),
				jsxs("div", { className: "dp_budgetInputRow", children: [
					jsx(Input, {
						className: "dp_budgetInput", inputMode: "decimal", placeholder: t("budgetSet"),
						value: budget === null ? "" : String(budget),
						onChange: (e) => onBudget(e.target.value),
					}),
					jsx("span", { className: "dp_balanceLabel", children: "CNY" }),
				] }),
				jsx(Seg, {
					id: "pulse-budget-mode",
					value: mode,
					options: [
						{ value: "all", label: t("budgetModeAll") },
						{ value: "weekdays", label: t("budgetModeWeekdays") },
						{ value: "single", label: t("budgetModeSingle") },
					],
					onChange: onMode,
					label: t("budgetModeLabel"),
				}),
				over && jsx("span", { className: "dp_balanceWarn", children: t("budgetOver") }),
				budget !== null && used !== null && jsx("div", { className: "dp_budgetTrack", children: jsx("div", { className: `dp_budgetFill${over ? " dp_budgetFillOver" : ""}`, style: { width: `${pct}%` } }) }),
				month.status === "error"
					? jsx("span", { className: "dp_balanceSub", children: fill(t("setFailed"), { err: month.error }) })
					: budget === null
						? jsx("span", { className: "dp_balanceSub", children: t("budgetEmpty") })
						: used === null
							? jsx("span", { className: "dp_balanceSub", children: t("costOff") })
							: jsxs("span", { className: "dp_balanceSub", children: [
								`${t("budgetUsed")} ${fmtCost(used)} / ${fmtCost(budget)} (${Math.round(pct)}%)`,
								avg !== null ? ` · ${fill(t("budgetAvg"), { v: fmtCost(avg) })}` : "",
								forecast !== null ? ` · ${t("budgetForecast")} ${fmtCost(forecast)}` : "",
								` · ${fill(t("budgetLeftDays"), { n: remaining })}`,
							] }),
			] });
		}

