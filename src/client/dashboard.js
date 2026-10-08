import { useState, useEffect, useMemo, jsx, jsxs } from "./react.js";
import { COST_STACK_STORAGE, RANGE_PRESETS, TREND_STACK_STORAGE, UNPRICED_HINT_TOKENS, catalogNames, fill, fmtClock, fmtTokens, httpError, loadCostStack, loadPanels, loadTheme, loadTrendStack, setTheme, subscribeTheme, useBalance, useCatalog, useEscape, usePulseStats, useQuota } from "./stores.js";
import { BucketChart, BucketXLabels, CostTrendPanel, HeatmapChart, HourlyChart, HourlyCostChart, ModelBars, ProjectTable, ReconTable, SessionsPanel, accentOf, focusProjectLabel } from "./charts.js";
import { HeroCard } from "./heroCard.js";
import { Toolbar } from "./toolbar.js";
import { QuotaPanel } from "./quota.js";
import { exportDailyCsv } from "./csv.js";
import { Btn, Input, Seg, primitives } from "./adapter.js";
import { AUX_MODEL_KEY, auxCalibration, buildView, clampSpan, costSeries, daysBetween, hourlyCostSeries, moneyCny, hourlySeries, isOfficialProvider, localDay, modelAccentMap, modelKey, moneyParts, reconcileSeries, rollupModelFamilies, sessionGroups, shiftDay, splitModelKey } from "./../view.js";
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
						httpError(res);
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
								`${t("budgetUsed")} ${moneyParts(used, "CNY").text} / ${moneyParts(budget, "CNY").text} (${Math.round(pct)}%)`,
								avg !== null ? ` · ${fill(t("budgetAvg"), { v: moneyParts(avg, "CNY").text })}` : "",
								forecast !== null ? ` · ${t("budgetForecast")} ${moneyParts(forecast, "CNY").text}` : "",
								` · ${fill(t("budgetLeftDays"), { n: remaining })}`,
							] }),
			] });
		}

		/** The full dashboard, shared by every surface (page / card / panel).
		 *  `onConfigure`, when provided (the settings section), makes the cost
		 *  chip's unset/unpriced notes open the pricing editor. */
		/**
		 * The dashboard assembly. Rendered two ways: directly (older hosts,
		 * or whenever the factory below is unavailable) with explicit props,
		 * or as the `pulse.dashboard` Component Factory (0.1.7+ slots) — in
		 * which case the framework supplies `t` (factory `locale`) and
		 * `renderSlot` (bound to the declared children), and the extension
		 * panels injected into `pulse.dashboard.panel` render after the
		 * built-in ones in the loaded view. Extension entries receive
		 * `{data, view, busy}` render-site props plus the factory's `t`; they
		 * are supervised individually, so a crashing panel never takes the
		 * dashboard down.
		 */
		/**
		 * The dashboard's derived model, ONE custom hook: aux calibration (the
		 * seed-shape recon, the learned active shape, the re-priced recon), the
		 * window view and its rollup, catalog names, the accent stack, session
		 * groups and the hourly/cost series. Pure derivations only — the fetch
		 * hooks stay in the component, as does the focusSession auto-select
		 * effect (it writes component state). Called unconditionally before the
		 * first early return, so hook order is stable. Exported for the client
		 * smoke test, which executes it directly under react stubs.
		 * @param {object} inputs - `trendStack` arrives from the component's
		 *   localStorage-backed state: the hook computes the usage trend's
		 *   by-model projection from it, so it must be threaded, not assumed.
		 */
		export function useDashboardModel({ data, range, project, models, panels, theme, trendStack, t }) {
			/** Aux shape self-calibration (pure, per-payload): the seed-shape
			 *  gap series attributes each complete day's residual; a stable
			 *  input-side scalar switches the active shape; control days with
			 *  unattributable residue suspend learning. The second pass re-prices
			 *  with the ACTIVE shape so displayed estimates and the drift alarm
			 *  speak the numbers the shapes actually produce. */
			const payloadShape = data?.auxShape !== null && typeof data?.auxShape === "object" ? data.auxShape : null;
			const reconSeed = useMemo(() => (data === null ? [] : reconcileSeries(data.sessions, {
				from: typeof data.fromDay === "string" ? data.fromDay : range.from,
				to: typeof data.toDay === "string" ? data.toDay : range.to,
				pricing: data.pricing, fx: data.fx, monthly: data.monthly,
				auxShape: payloadShape, official: Array.isArray(data.balanceSeries) ? data.balanceSeries : [],
			})), [data, range]);
			const calib = useMemo(() => auxCalibration(reconSeed, {
				seed: payloadShape ?? null,
				manual: payloadShape?.manual === true,
				today: typeof data?.today === "string" ? data.today : localDay(Date.now()),
			}), [reconSeed, data]);
			const recon = useMemo(() => (data === null ? [] : reconcileSeries(data.sessions, {
				from: typeof data.fromDay === "string" ? data.fromDay : range.from,
				to: typeof data.toDay === "string" ? data.toDay : range.to,
				pricing: data.pricing, fx: data.fx, monthly: data.monthly,
				auxShape: calib.shape, official: Array.isArray(data.balanceSeries) ? data.balanceSeries : [],
			})), [data, range, calib]);
			const reconByKey = useMemo(() => new Map(recon.map((row) => [row.key, row])), [recon]);
			/** The aux row's data-state tooltip: shape + calibration status. */
			const auxTip = useMemo(() => {
				const shapePart = fill(t("auxShapeTip"), { m: fmtTokens(calib.shape.miss), h: fmtTokens(calib.shape.hit), o: fmtTokens(calib.shape.out) });
				const s = calib.medianS;
				const statusText = calib.status === "manual" ? t("auxCalManual")
					: calib.status === "divergent" ? t("auxCalDivergent")
					: calib.status === "insufficient" ? fill(t("auxCalInsufficient"), { n: calib.checkedDays })
					: (s !== null && Math.abs(s - 1) <= 0.03
						? fill(t("auxCalAligned"), { s: s.toFixed(2), n: calib.samples })
						: fill(t("auxCalCalibrated"), { s: s === null ? "1.00" : s.toFixed(2), n: calib.samples }));
				return `${shapePart} · ${statusText}`;
			}, [calib, t]);

			/** The rendered window is the PAYLOAD's own (echoed by the host),
			 *  never the toolbar's live selection: while a new window is still
			 *  loading, the old payload keeps rendering its own consistent view
			 *  instead of a mixed old-sessions-cut-to-the-new-window chart. */
			const rawView = useMemo(() => {
				if (data === null) return null;
				const from = typeof data.fromDay === "string" ? data.fromDay : range.from;
				const to = typeof data.toDay === "string" ? data.toDay : range.to;
				return buildView(data.sessions, {
					granularity: "day",
					from,
					to,
					project,
					models,
					auxShape: calib.shape,
					pricing: data.pricing,
					fx: data.fx,
					monthly: data.monthly,
				});
			}, [data, range, project, models, calib]);
			/** One DeepSeek account, two routes: the display
			 *  folds provider families so a window shows one row per model
			 *  instead of two halves of the same number. Pricing and
			 *  reconciliation already ran per route — nothing is re-rated here —
			 *  and `rollupModelFamilies` hands the per-route rows back whenever
			 *  the routes need to be shown apart again. */
			const view = useMemo(() => rollupModelFamilies(rawView).view, [rawView]);

			/** Catalog-backed model labels: the config's display name, with a
			 *  provider prefix only when the same name appears under several
			 *  providers (per the in-scope model rows). Defined after `view`
			 *  so it can read the model rows. */
			const catalog = useCatalog();
			const names = useMemo(() => catalogNames(
				catalog,
				(view === null ? [] : view.models).map((m) => m.key ?? modelKey(m.provider ?? "", m.model)),
			), [catalog, view]);

			/** Model-dimension stack for the usage trend: accent fills over the
			 *  window's model set, and whether the fold attributed tokens to
			 *  models at all (schema-2 hosts did not — the toggle hides there). */
			const accentMap = useMemo(
				() => modelAccentMap(view === null ? [] : view.models, data === null ? {} : data.modelColors, { bw: theme === "bw" }),
				[view, data, theme],
			);
			const hasModelSplit = view !== null && (Array.isArray(view.modelBuckets) ? view.modelBuckets : [])
				.some((day) => day instanceof Map && day.size > 0);
			const byModel = hasModelSplit && trendStack === "model";
			const modelLegendRows = byModel && view !== null
				? (Array.isArray(view.models) ? view.models : []).slice(0, 4).map((m) => ({
					key: m.key,
					fill: accentOf(accentMap, m.provider ?? "", m.model),
					label: m.model === "unknown" ? t("unknownModel") : m.model === AUX_MODEL_KEY ? t("auxModelName") : names.labelOf(m.provider ?? "", m.model),
					title: m.model === AUX_MODEL_KEY ? auxTip : null,
				}))
				: null;

			/** Project × session groups for the session panel, costed with the
			 *  effective rules over the window's full corpus (subtotals stay
			 *  stable under the project/model filters above). */
			const sessionGroupsData = useMemo(
				() => (data === null ? [] : sessionGroups(data.sessions, { pricing: data.pricing, fx: data.fx, monthly: data.monthly, models, catalog })),
				[data, models, catalog],
			);

			/** Single-day views render the intraday hourly line chart; the
			 *  chart type follows the loaded window, not the toolbar, for the
			 *  same stale-payload consistency. The hour maps themselves cover
			 *  the retention window (host-side 3 days), so a past single day
			 *  within that window aggregates its own sessions' hours. */
			const hourly = data === null ? range.from === range.to : data.fromDay === data.toDay;
			const hourlyDay = data !== null && typeof data.fromDay === "string" ? data.fromDay : range.from;
			const hourlyCutoff = data !== null && typeof data.today === "string" ? shiftDay(data.today, -2) : null;
			const hours = useMemo(() => {
				if (data === null || !hourly || panels.trend === false) return null;
				return hourlySeries(data.sessions, hourlyDay, { project, models });
			}, [data, hourly, hourlyDay, project, models, panels.trend]);
			/** Single-day hourly cost (the cost tab's day view): each hour
			 *  reprices at its own billing schedule. Aux calls stay day-level
			 *  (no hour of their own) — the chart footnotes the day's aux
			 *  estimate from the reconciliation rows instead. */
			const hourlyCost = useMemo(() => {
				if (data === null || !hourly || panels.costTrend === false || data.costEnabled === false) return null;
				return hourlyCostSeries(data.sessions, hourlyDay, { pricing: data.pricing, fx: data.fx, monthly: data.monthly, models, project });
			}, [data, hourly, hourlyDay, project, models, panels.costTrend]);
			/** Daily cost series (peak/off-peak, CNY) for the cost sparkline;
			 *  the same pure fold the pricing preview uses, so all cost figures
			 *  agree. Single-day windows fold too — the cost trend panel drills
			 *  that one day. */
			const costDays = useMemo(() => {
				if (data === null || data.costEnabled === false) return null;
				return costSeries(data.sessions, {
					from: typeof data.fromDay === "string" ? data.fromDay : range.from,
					to: typeof data.toDay === "string" ? data.toDay : range.to,
					project, models,
					auxShape: calib.shape,
					pricing: data.pricing, fx: data.fx, monthly: data.monthly,
				});
			}, [data, range, project, models, calib]);

			return { calib, recon, reconByKey, auxTip, view, names, accentMap, hasModelSplit, byModel, modelLegendRows, sessionGroupsData, hourly, hourlyDay, hourlyCutoff, hours, hourlyCost, costDays, catalog };
		}

		export function PulseDashboard({ t, headerExtra, onConfigure, floatActions = false, focusSession = null, renderSlot: renderPanelsSlot, actions }) {
			const [panels] = useState(loadPanels);
			const [theme, setTheme] = useState(loadTheme);
			/** Live theme sync: the settings-page picker updates every mounted
			 *  surface (page / card / floating overlay) without a reload. */
			useEffect(() => subscribeTheme(setTheme), []);
			const [rangeKey, setRangeKey] = useState("7");
			/** Custom range defaults to the last seven days; the inputs are
			 *  editable and empty bounds fall back to the same defaults. */
			const [custom, setCustom] = useState(() => {
				const today = localDay(Date.now());
				return { from: shiftDay(today, -6), to: today };
			});
			const [project, setProject] = useState("");
			/** Workspace focus (`focusSession`, from the `/pulse` menu row):
			 *  the first payload that can name the invoking session's project
			 *  auto-selects it in the 项目 filter — once, and only until the
			 *  user picks a filter themselves. */
			const [projectTouched, setProjectTouched] = useState(false);
			const setProjectUser = (value) => { setProjectTouched(true); setProject(value); };
			/** Model multi-select (the legend-linked filter): an id array, empty
			 *  = all. Legend clicks and picker clicks toggle the same set. */
			const [models, setModels] = useState([]);
			const toggleModel = (key) => setModels((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
			const clearModels = () => setModels([]);
			const modelSelSet = models.length > 0 ? new Set(models) : null;
			/** Usage-trend stack dimension: token type (default) or per-model
			 *  accent colors — a localStorage preference like theme/panels. */
			const [trendStack, setTrendStack] = useState(loadTrendStack);
			const applyTrendStack = (mode) => {
				setTrendStack(mode);
				try { localStorage.setItem(TREND_STACK_STORAGE, mode); } catch { /* private mode */ }
			};
			/** Whether the usage trend is drilled into a single day (the chart
			 *  reports back so the parent can hide the day axis). */
			const [trendDrilled, setTrendDrilled] = useState(false);
			/** 切换容器的两个页签：缓存命中卡 = 用量走势，费用走势卡 = 费用
			 *  走势。纯 tab 切换，无聚焦/压暗机制。 */
			const [swapTab, setSwapTab] = useState("use");
			/** The hero canvas's shared expansion slot: exactly ONE block
			 *  expansion is open at a time — "est" opens the estimate/budget
			 *  panel (plus the reconciliation table), "quota" opens the
			 *  subscription detail; clicking the same hot zone again or
			 *  Escape closes. The old single consOpen boolean collapsed into
			 *  this named target when the two top cards merged into one
			 *  canvas with per-block hot zones. */
			const [expandX, setExpandX] = useState(null);
			/** Capture + consume (via useEscape): Escape belongs to the expansion
			 *  while one is open — letting it bubble would dismiss the HOST
			 *  overlay (its dialog also listens for Escape) instead of just
			 *  collapsing the expansion. With no expansion open this listener
			 *  is not mounted, so Escape keeps reaching the overlay and closes
			 *  it, as before. */
			useEscape(expandX !== null, () => setExpandX(null), { capture: true, consume: true, target: "window" });
			/** Same report-back for the cost trend's day drill (hides the day
			 *  labels while a single day's cost breakdown is open). */
			const [costDrilled, setCostDrilled] = useState(false);
			/** Cost-trend stack dimension: peak/off-peak billing tiers (default)
			 *  or per-model costs. */
			const [costStack, setCostStack] = useState(loadCostStack);
			const applyCostStack = (mode) => {
				setCostStack(mode);
				try { localStorage.setItem(COST_STACK_STORAGE, mode); } catch { /* private mode */ }
			};

			const presetDays = RANGE_PRESETS[rangeKey] ?? 7;
			const range = useMemo(() => {
				const today = localDay(Date.now());
				let from;
				let to;
				if (rangeKey !== "custom") {
					from = shiftDay(today, -(Math.min(1095, presetDays) - 1));
					to = today;
				} else {
					// Custom spans cap at 365 days (the year window); clampSpan
					// swaps reversed pairs and trims the start toward the end.
					// Nothing is trimmed past what the toolbar shows.
					const clamped = clampSpan(custom.from || shiftDay(today, -6), custom.to || today, 365);
					from = clamped.from;
					to = clamped.to;
				}
				return { from, to };
			}, [rangeKey, custom, presetDays]);
			/** The heatmap renders a GitHub-style grid instead of bars: the long
			 *  presets, and any custom span past 60 days where daily bars stop
			 *  being legible. */
			const heatmap = rangeKey === "90" || rangeKey === "365"
				|| (rangeKey === "custom" && daysBetween(range.from, range.to) > 60);

			const stats = usePulseStats(range.from, range.to);
			const data = stats.data;
			/** Official balance rides its own endpoint (network-bound, cached
			 *  server-side) so the stats payload stays local and fast. */
			const balance = useBalance();
			/** Subscription quota (coding/token plans) rides its own endpoint
			 *  too; the expanded panel folds the local token reconciliation on
			 *  top of the stats payload above. */
			const quota = useQuota(panels.quota !== false);

			const { calib, reconByKey, auxTip, view, names, accentMap, hasModelSplit, byModel, modelLegendRows, sessionGroupsData, hourly, hourlyDay, hourlyCutoff, hours, hourlyCost, costDays, catalog } =
				useDashboardModel({ data, range, project, models, panels, theme, trendStack, t });


			/** Workspace focus: the first payload that can name the invoking
			 *  session's workspace auto-selects it in the workspace filter —
			 *  once, and only until the user picks a filter themselves (a
			 *  manual switch to 全部工作区 stays). */
			useEffect(() => {
				if (focusSession === null || projectTouched || project !== "" || data === null) return;
				const label = focusProjectLabel(data, focusSession);
				if (label !== null) setProject(label);
			}, [focusSession, projectTouched, project, data]);



			/** Factory store seat mirror: the freshest cut (payload, view model,
			 *  busy flag) lands in the declared store, so injected chips/filters/
			 *  panels read LIVE data through their `useStore` selector instead of
			 *  freezing on a render-site snapshot. Runs across loading states —
			 *  the busy flag is part of the mirrored state. */
			const syncStore = typeof actions?.sync === "function" ? actions.sync : null;
			useEffect(() => {
				if (syncStore !== null) syncStore(data, view, stats.busy);
			}, [syncStore, data, view, stats.busy]);

			const refreshBtn = jsx(Btn, {
				variant: "toolbar", size: "sm", fallbackClass: "dp_iconBtn",
				onClick: () => stats.reload(),
				"aria-label": t("refresh"), title: t("refresh"), disabled: stats.busy,
				icon: jsx(primitives.IconRefreshOutline16, { size: 15 }),
			});
			/** Download the current window as CSV (daily rows + totals). */
			const exportBtn = jsx(Btn, {
				variant: "toolbar", size: "sm", fallbackClass: "dp_iconBtn",
				"aria-label": t("exportBtn"), title: t("exportTitle"),
				disabled: data === null,
				onClick: () => exportDailyCsv({
					t, view, costDays,
					balanceSeries: Array.isArray(data?.balanceSeries) ? data.balanceSeries : [],
					fromDay: range.from, toDay: range.to,
				}),
				icon: jsx(primitives.IconDownloadOutline16, { size: 15 }),
			});
			/** In the floating overlay the refresh/close actions pin to the
			 *  card's top-right corner (absolute, never scrolled away), so the
			 *  header itself drops them and the overlay renders its own
			 *  `dp_overlayActions`. */
			const header = jsxs("div", { className: `dp_headerRow${floatActions ? " dp_headerRowFloat" : ""}`, children: [
				jsx("span", { className: "dp_title", children: t("title") }),
				jsx("span", { className: "dp_sub", children: data ? fill(t("generatedAt"), { t: fmtClock(data.generatedAt) }) : t("subtitle") }),
				!floatActions && refreshBtn,
				!floatActions && exportBtn,
				!floatActions && (headerExtra !== undefined && headerExtra !== null ? headerExtra : null),
			] });

			/** A payload whose window differs from the toolbar's selection is
			 *  a not-yet-replaced leftover from the previous range — render
			 *  the loading treatment, never last window's numbers under the
			 *  new label. Schema-2 payloads can't be verified; they render. */
			const staleWindow = data !== null && data.schema === 3
				&& (data.fromDay !== range.from || data.toDay !== range.to);
			if (stats.status === "error" && data === null) {
				return jsxs("div", { className: "dp_root", "data-dp-theme": theme, children: [
					header,
					jsxs("div", { className: "dp_stateBox", children: [
						jsx(primitives.IconWarningOutline16, { size: 22, className: "dp_stateIcon" }),
						jsx("span", { className: "dp_stateTitle", children: t("errorTitle") }),
						jsx("span", { className: "dp_stateBody", children: `${t("errorBody")} (${stats.error})` }),
						jsx("div", { className: "dp_retryRow", children: jsx(Btn, { fallbackClass: "dp_miniBtn", variant: "outline", size: "sm", onClick: () => stats.reload(), children: t("retry") }) }),
					] }),
				] });
			}
			if (data === null || stats.status === "loading" || staleWindow) {
				return jsxs("div", { className: "dp_root", "data-dp-theme": theme, children: [
					header,
					// The toolbar stays interactive across switches (retargeting
					// is cheap: the store aborts and re-sequences); only the
					// initial load has no window to source picker options from.
					view !== null
						? jsx(Toolbar, { rangeKey, setRangeKey, custom, setCustom, project, setProject: setProjectUser, knownProjects: view.knownProjects, models, onModelToggle: toggleModel, onModelClear: clearModels, knownModels: view.knownModels, names, t, filterSlot: renderPanelsSlot })
						: jsx("div", { className: "dp_skeleton dp_skeletonShort" }),
					jsx("div", { className: "dp_skeleton", children: jsx("div", { className: "dp_emptyChart", children: jsx("span", { children: t("loading") }) }) }),
				] });
			}
			if (view === null) return null;

			const totals = view.totals;
			/** 区间内活动（会话 / 回合 / 工具调用）：数据只算一次，永远落在
			 *  画布底部的通栏脚行（heroCard 包一层 dp_hFoot，三格 justify 到
			 *  卡缘）。它是窗口级数据，不隶属任何一区；信息不随面板开关消失，
			 *  整句仍挂在 `title` 上，鼠标一停就能读到，屏幕阅读器也读得到。 */
			const activityCells = [
				["actSessions", totals.sessions || 0],
				["actTurns", totals.turns || 0],
				["actToolCalls", totals.toolCalls || 0],
			];
			const activityTitle = fill(t("windowActivity"), { s: totals.sessions || 0, t: totals.turns || 0, c: totals.toolCalls || 0 });
			const activityLine = jsx("div", {
				className: "dp_actGrid",
				title: activityTitle,
				children: activityCells.map(([label, value]) => jsxs("span", { className: "dp_actCell", children: [
					jsx("span", { className: "dp_actLabel", children: t(label) }),
					jsx("span", { className: "dp_actVal", children: String(value) }),
				] }, label)),
			});
			const grandTotal = (totals.input || 0) + (totals.output || 0) + (totals.cacheRead || 0) + (totals.cacheWrite || 0);
			const corpusEmpty = Number.isFinite(data.corpusSessions)
				? data.corpusSessions === 0
				: (data.sessions ?? []).length === 0;
			if (corpusEmpty) {
				return jsxs("div", { className: "dp_root", "data-dp-theme": theme, children: [
					header,
					jsxs("div", { className: "dp_stateBox", children: [
						jsx(primitives.IconDataOutline16, { size: 22, className: "dp_stateIcon" }),
						jsx("span", { className: "dp_stateTitle", children: t("emptyTitle") }),
						jsx("span", { className: "dp_stateBody", children: t("emptyBody") }),
					] }),
				] });
			}
			/** The corpus has sessions but none land in this window: a schema-4
			 *  host states that with `corpusSessions`, so the copy points at the
			 *  range instead of claiming nothing was ever recorded. The store
			 *  retries once behind this message (the empty window is usually the
			 *  freshly-booted race), so it is framed as "not yet". */
			if ((data.sessions ?? []).length === 0) {
				return jsxs("div", { className: "dp_root", "data-dp-theme": theme, children: [
					header,
					jsx(Toolbar, { rangeKey, setRangeKey, custom, setCustom, project, setProject: setProjectUser, knownProjects: view.knownProjects, models, onModelToggle: toggleModel, onModelClear: clearModels, knownModels: view.knownModels, names, t, filterSlot: renderPanelsSlot }),
					jsxs("div", { className: "dp_stateBox", children: [
						jsx(primitives.IconClockOutline16, { size: 22, className: "dp_stateIcon" }),
						jsx("span", { className: "dp_stateTitle", children: t("windowEmptyTitle") }),
						jsx("span", { className: "dp_stateBody", children: fill(t("windowEmptyBody"), { from: data.fromDay, to: data.toDay }) }),
					] }),
				] });
			}
			if (!view.hasData) {
				return jsxs("div", { className: "dp_root", "data-dp-theme": theme, children: [
					header,
					jsx(Toolbar, { rangeKey, setRangeKey, custom, setCustom, project, setProject: setProjectUser, knownProjects: view.knownProjects, models, onModelToggle: toggleModel, onModelClear: clearModels, knownModels: view.knownModels, names, t, filterSlot: renderPanelsSlot }),
					jsxs("div", { className: "dp_stateBox", children: [
						jsx(primitives.IconSearchOutline16, { size: 20, className: "dp_stateIcon" }),
						jsx("span", { className: "dp_stateTitle", children: t("filteredTitle") }),
						jsx("span", { className: "dp_stateBody", children: t("filteredBody") }),
					] }),
				] });
			}

			const cost = view.cost;
			const costEnabled = data.costEnabled !== false;
			/** 选中第三方来源（非官方渠道：含族折叠键与族内全部路由）的模型时，
			 *  官方余额与这个账号无关，余额面板（含对账线）隐藏；若所选模型没有
			 *  任何定价规则覆盖（供应商精确或通配），费用估算与月度预算一并
			 *  隐藏。多选时按"全部选中项"判定——混合官方与第三方选择保持余额
			 *  可见。 */
			const thirdParty = models.length > 0 && models.every((key) => !isOfficialProvider(splitModelKey(key).provider));
			const modelConfigured = models.length > 0 && models.every((key) => {
				const { provider, model: bare } = splitModelKey(key);
				if (isOfficialProvider(provider)) return true;
				return (Array.isArray(data.monthly) ? data.monthly : []).includes(provider)
					|| (Array.isArray(data.pricing) ? data.pricing : []).some((rule) => {
						if (typeof rule?.model !== "string" || rule.model !== bare) return false;
						const ruleProvider = typeof rule.provider === "string" && rule.provider.length > 0 ? rule.provider : "";
						return ruleProvider === "" || ruleProvider === provider;
					});
			});
			const hideCostish = thirdParty && !modelConfigured;
			const bucketCount = view.buckets.length;
			/** Cost-trend tab availability: needs the swap slot, configured
			 *  pricing and at least one priced model. Single-day windows
			 *  qualify too — the cost tab is the hourly cost chart there. */
			const costFocusable = panels.costTrend !== false
				&& costEnabled && !hideCostish
				&& view !== null && view.cost.configured === true && costDays !== null;
			/** 用量走势关掉时费用走势直接顶上（不再整体隐藏）；费用走势关掉
			 *  则只留用量视图。 */
			const swapView = swapTab === "cost" && costFocusable ? "cost"
				: panels.trend !== false ? "use"
					: costFocusable ? "cost" : "use";
			/** Drill indices arrive as number | null | false(initial) — a plain
			 *  truthiness check would miss day 0. */
			const trendFocused = typeof trendDrilled === "number";
			const costDrillOn = typeof costDrilled === "number";
			/** Cost trend bucketing: week bars for the 90-day window, month
			 *  bars for the 1-year window, day bars otherwise. */
			const costSpanDays = data !== null && typeof data.fromDay === "string" && typeof data.toDay === "string"
				? Math.round((Date.parse(`${data.toDay}T00:00:00`) - Date.parse(`${data.fromDay}T00:00:00`)) / 86400000) + 1
				: 0;
			const costBucket = costSpanDays > 180 ? "month" : costSpanDays > 45 ? "week" : "day";
			/** The trend panel's range text mirrors the served window exactly
			 *  (the payload echoes the toolbar's selection; while a new window
			 *  loads, the old payload keeps naming its own window). */
			const rangeText = hourly ? t("hourCount")
				: typeof data.fromDay === "string" && typeof data.toDay === "string"
					? (data.fromDay === data.toDay ? data.fromDay : `${data.fromDay} ~ ${data.toDay}`)
					: fill(t("dailyCount"), { n: bucketCount });
			const balanceBaseOn = panels.balance !== false && !thirdParty;
			/** 费用估算的唯一开关是通用设置「启用费用估算」；月度预算与对账
			 *  明细同属估算功能，跟随它显隐，不设独立开关。 */
			const estOn = costEnabled && !hideCostish;
			const budgetOn = estOn;
			/** The quota panel joins the expansion when any provider answered. */
			const quotaOk = (Array.isArray(quota.data?.providers) ? quota.data.providers : []).some((entry) => entry.ok === true);
			const quotaOpenable = panels.quota !== false && quotaOk;
			/** 对账明细属于估算功能：估算开 + 官方余额段开 + 余额已配置时，
			 *  随展开层显示，不设独立开关。 */
			const reconOn = estOn && balanceBaseOn
				&& balance.data !== null && balance.data.configured === true;
			/** The canvas offers exactly one expansion slot: "est" (estimate +
			 *  budget + reconciliation) or "quota" (subscription detail). */
			const heroOpenable = estOn || quotaOpenable;
			const showChips = panels.cache !== false || estOn || panels.balance !== false || panels.quota !== false;
			/** Which row-one cards are actually mounted (the cache card is
			 *  optional; the consumption card is the row's spine). */
			const cacheOn = panels.cache !== false;
			/** Extension chips render in their OWN row: the KPI row's height is
			 *  a contract between its two cards, and a foreign tile — however it
			 *  is built — must never be able to stretch it (that is exactly how
			 *  both cards once grew ~200px of unexplained air). */
			const extChips = typeof renderPanelsSlot === "function"
				? renderPanelsSlot("pulse.dashboard.chip", { data, view, busy: stats.busy })
				: null;
			/** While a hero-block expansion is open, the rest of the dashboard
			 *  dims and stops responding — the expansion owns the moment.
			 *  `dimWrap` keeps the unwrapped-extension layout intact. */
			const dimWrap = (node) => (expandX !== null && heroOpenable && node !== null && node !== undefined && node !== false
				? jsx("div", { className: "dp_blurSec", children: node })
				: node);
			return jsxs("div", { className: "dp_root", "data-dp-theme": theme, children: [
				header,
				jsx(Toolbar, { rangeKey, setRangeKey, custom, setCustom, project, setProject: setProjectUser, knownProjects: view.knownProjects, models, onModelToggle: toggleModel, onModelClear: clearModels, knownModels: view.knownModels, names, t, filterSlot: renderPanelsSlot }),
				showChips && jsx("div", {
					className: "dp_chips",
					children: jsx(HeroCard, {
						balance,
						quota,
						series: Array.isArray(data?.balanceSeries) ? data.balanceSeries : null,
						sessions: data.sessions,
						cost,
						totals,
						estOn,
						balanceOn: balanceBaseOn,
						quotaOn: panels.quota !== false,
						cacheOn,
						quotaOpenable,
						openX: expandX,
						onHot: (x) => setExpandX((cur) => (cur === x ? null : x)),
						onConfigure,
						rangeLabel: rangeKey === "custom"
							? `${range.from} ~ ${range.to}`
							: t(rangeKey === "1" ? "range1" : rangeKey === "7" ? "range7"
								: rangeKey === "30" ? "range30" : rangeKey === "90" ? "range90" : "range365"),
						activityLine,
						t,
					}),
				}),
				// Extension chips (`pulse.dashboard.panel`'s sibling for KPI
				// tiles) — same grid, separate row, so their height can never
				// stretch the KPI row above.
				extChips !== null && extChips !== undefined && extChips !== false
					? jsx("div", { className: "dp_chips", children: extChips })
					: null,
				/** 热区点击 → 同一下滑展开槽：估算块展开「费用估算+月度预算」
				 *  与对账明细表（纯数据：官方扣费 / 本地估算 / 差额，稀疏日带
				 *  ≈，偏差日标红不加引导文案），额度块展开订阅额度明细（窗口/
				 *  燃速/分工作区）。再点同块或按 Esc 收起；展开时其余面板模糊
				 *  压暗。 */
				expandX !== null && heroOpenable && jsxs("div", { className: "dp_consExpand", id: "dp-pulse-expand", children: [
					expandX === "est" && (estOn || budgetOn) && jsxs("div", { className: "dp_estBudgetPanel", children: [
						estOn && jsxs("div", { className: "dp_estCard", children: [
							jsxs("div", { className: "dp_cardHead", children: [
								jsx("span", { className: "dp_cardLabel", children: t("chipCost") }),
								jsx("span", { className: "dp_cardCount", children: fill(t("dailyCount"), { n: bucketCount }) }),
							] }),
							cost.configured === true
								? jsx("span", { className: "dp_chipValue dp_costOk", children: moneyParts(cost.total ?? 0, "CNY").text })
								: (onConfigure !== undefined
									? jsx("button", { type: "button", className: "dp_chipValueBtn", onClick: onConfigure, children: t("costGoSet") })
									: jsx("span", { className: "dp_chipNote dp_costOff", children: t("costOff") })),
							cost.configured === true && ((cost.unpriced?.input) || 0) + ((cost.unpriced?.output) || 0) >= UNPRICED_HINT_TOKENS
								? (onConfigure !== undefined
									? jsx("button", { type: "button", className: "dp_chipNoteBtn", onClick: onConfigure, children: fill(t("unpriced"), { n: fmtTokens((cost.unpriced.input || 0) + (cost.unpriced.output || 0)) }) })
									: jsx("span", { className: "dp_chipNote", children: fill(t("unpriced"), { n: fmtTokens((cost.unpriced.input || 0) + (cost.unpriced.output || 0)) }) }))
								: cost.configured === true && (cost.convertedFromUsd || 0) > 0
									? jsx("span", { className: "dp_chipNote", children: fill(t("fxNote"), { r: cost.usdToCny }) })
									: cost.configured !== true && jsx("span", { className: "dp_costNote", children: t("costHint") }),
							jsx("span", { className: "dp_costNote", children: t("focusNote") }),
						] }),
						budgetOn && jsx("div", { className: "dp_balanceGrow", children: jsx(BudgetCard, { t }) }),
					] }),
					expandX === "quota" && quotaOpenable && jsx(QuotaPanel, { quota, data, t }),
					expandX === "est" && reconOn && jsx(ReconTable, { rows: recon, t }),
				] }),
				/** 切换容器：表头左上 [用量走势｜费用走势] 页签（费用可用时），
				 *  页签右侧范围文本精确镜像工具栏窗口；右侧堆叠切换不变。展开
				 *  消费金额卡时整个容器模糊压暗。视图等高（256px），key 切换
				 *  重放轻量过渡；费用走势底部附官网口径小字。 */
				dimWrap((panels.trend !== false || costFocusable) && jsxs("div", { children: [
					jsxs("div", { key: swapView, className: "dp_swapIn", children: [
						jsxs("div", { className: `dp_panelTitle${(swapView === "cost" && !hourly) || (swapView !== "cost" && !hourly && !heatmap && hasModelSplit) ? " dp_hasStack" : ""}`, children: [
							panels.trend !== false && costFocusable ? jsx(Seg, {
								id: "pulse-trend-view",
								className: "dp_trendTabs",
								value: swapView === "cost" ? "cost" : "use",
								options: [
									{ value: "use", label: t("trendTitle") },
									{ value: "cost", label: t("costTrend") },
								],
								onChange: setSwapTab,
								label: t("trendViewLabel"),
							})
								: jsx("span", { children: swapView === "cost" ? t("costTrend") : t("trendTitle") }),
							jsx("span", { className: "dp_panelCount", children: rangeText }),
							// 右侧切换：多日费用 = 峰谷/模型 堆叠；多日用量 = 类型/模型。
							swapView === "cost" && !hourly ? jsx(Seg, {
								id: "pulse-cost-stack",
								className: "dp_stackToggle",
								value: costStack === "model" ? "model" : "tiers",
								options: [
									{ value: "tiers", label: t("stackTiers") },
									{ value: "model", label: t("stackModel") },
								],
								onChange: applyCostStack,
								label: t("stackLabel"),
							})
								: swapView !== "cost" && !hourly && !heatmap && hasModelSplit && jsx(Seg, {
									id: "pulse-trend-stack",
									className: "dp_stackToggle",
									value: byModel ? "model" : "type",
									options: [
										{ value: "type", label: t("stackType") },
										{ value: "model", label: t("stackModel") },
									],
									onChange: applyTrendStack,
									label: t("stackLabel"),
								}),
						] }),
						jsx("div", { className: "dp_trendBody", children: swapView === "cost"
							? (hourly
								// 单日费用 = 官方控制台样式的 24 小时分时柱：
								// 每小时按自己的峰谷时段计价，hover 读 峰/谷/合计。
								? jsxs("div", { children: [
									jsx(HourlyCostChart, { hours: hourlyCost?.hours ?? [], t }),
									hourlyCost !== null && hourlyCost.unpricedTokens > 0 && jsx("div", { className: "dp_focusNote", children: fill(t("unpriced"), { n: fmtTokens(hourlyCost.unpricedTokens) }) }),
									project === "" && (reconByKey.get(hourlyDay)?.aux ?? 0) > 0 && jsx("div", { className: "dp_focusNote", children: fill(t("costHourlyAux"), { v: moneyCny(reconByKey.get(hourlyDay).aux) }) }),
									hourlyCutoff !== null && hourlyDay < hourlyCutoff && jsx("div", { className: "dp_focusNote", children: t("hourlyNote") }),
									jsx("div", { className: "dp_focusNote", children: t("focusNote") }),
								] })
								: jsxs("div", { children: [
								jsx(CostTrendPanel, {
									costs: view.bucketCosts,
									today: data.today,
									actualByDay: thirdParty ? null : (Array.isArray(data?.balanceSeries) ? data.balanceSeries : null),
									accentMap, byModel: costStack === "model", names,
									bucket: costBucket,
									legendSel: modelSelSet, onLegendToggle: toggleModel, auxTip,
									onDrillChange: setCostDrilled,
									children: !costDrillOn && jsx(BucketXLabels, { buckets: view.buckets, granularity: "day", today: data.today, t }),
									t,
								}),
								jsx("div", { className: "dp_focusNote", children: t("focusNote") }),
							] }))
							: hourly
								? jsxs("div", { children: [
									jsx(HourlyChart, { hours, t }),
									hourlyCutoff !== null && hourlyDay < hourlyCutoff && jsx("div", { className: "dp_focusNote", children: t("hourlyNote") }),
								] })
								: heatmap
									? jsx("div", { className: "dp_projScroll", children: jsx(HeatmapChart, { buckets: view.buckets, today: data.today, t }) })
									: jsx(BucketChart, {
										buckets: view.buckets, granularity: "day", today: data.today, modelBuckets: view.modelBuckets, accentMap, byModel, names,
										legendRows: modelLegendRows, legendSel: modelSelSet, onLegendToggle: toggleModel,
										hourlyFrom: hourlyCutoff, onDrillHourly: (day) => {
											if (day === data.today) setRangeKey("1");
											else { setCustom({ from: day, to: day }); setRangeKey("custom"); }
										},
										onDrillChange: setTrendDrilled,
										children: !trendFocused && jsx(BucketXLabels, { buckets: view.buckets, granularity: "day", today: data.today, t }), t,
									}) }),
					] }),
				] })),
				/** 模型分布：全宽汇总节，标题在卡外（与工作区排行同构）。 */
				dimWrap(panels.models !== false && jsxs("div", { children: [
					jsx("div", { className: "dp_panelTitle", children: t("modelsTitle") }),
					jsx(ModelBars, { models: view.models, modelColors: data.modelColors, pricing: data.pricing, fx: data.fx, costEnabled, monthly: data.monthly, names, legendSel: modelSelSet, onLegendToggle: toggleModel, auxTip, bw: theme === "bw", t }),
				] })),
				dimWrap(panels.projects !== false && project === "" && jsxs("div", { children: [
					jsx("div", { className: "dp_panelTitle", children: t("projectsTitle") }),
					jsx(ProjectTable, { projects: view.projects, topProjects: data.topProjects, onSelect: setProjectUser, t }),
				] })),
				dimWrap(panels.sessions !== false && project !== "" && jsxs("div", { children: [
					jsxs("div", { className: "dp_panelTitle", children: [
						jsx("span", { children: t("projectDetailTitle") }),
						jsx("button", { type: "button", className: "dp_setLink dp_setLinkEnd", onClick: () => setProjectUser(""), children: `← ${t("back")}` }),
					] }),
					jsx(SessionsPanel, {
						groups: sessionGroupsData.filter((g) => g.project === project), costEnabled, pricing: data.pricing, fx: data.fx,
						monthly: data.monthly, models, auxShape: calib.shape, catalog, names, t,
						focusSessionId: focusSession === null ? null : focusSession.id,
					}),
				] })),
				// Extension panels from other client plugins (`pulse.dashboard.panel`
				// child slot). Rendered only in the loaded, non-empty view; the
				// render-site props carry the raw payload, the derived view model
				// and the busy flag (entries also get `t` from the factory locale).
				dimWrap(typeof renderPanelsSlot === "function" ? renderPanelsSlot("pulse.dashboard.panel", { data, view, busy: stats.busy }) : null),
			] });
		}
