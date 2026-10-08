import { useState, useEffect, useMemo, useRef, useSyncExternalStore, jsx, jsxs } from "./react.js";
import { recordTokens } from "../view.js";
import { WIDTH_MAX, WIDTH_MIN, fill, fmtTokens, loadPanels, loadStats, loadTheme, loadWidth, openOverlay, overlaySnapshot, setOverlayOpen, setTheme, setWidth, statsState, subscribeOverlay, subscribePanels, subscribeStats, subscribeTheme, subscribeWidth, useBalance, useEscape, usePulseStats } from "./stores.js";
import { focusProjectLabel } from "./charts.js";
import { PulseDashboard } from "./dashboard.js";
import { PricingPage } from "./settings.js";
import { ComparePage } from "./compare.js";
import { PanelsPage } from "./panels.js";
import { Btn, primitives } from "./adapter.js";
import { buildView, cacheHitRateOf, costOf, localDay, moneyCny, sessionModelRows, shiftDay } from "./../view.js";
		//#region slot components
		/** settings.section page - owner props `{close}`, locale `t` via inject
		 *  face. Four levels of internal state (no shell navigation API): the
		 *  dashboard and the pricing / compare / settings pages. Every second
		 *  level header carries the full tab set (current page highlighted),
		 *  so the pages are reachable from each other without any pairwise
		 *  coupling; a fresh open always lands on the dashboard. */
		export function PulseSection({ t, renderFactorySlot }) {
			const [page, setPage] = useState("dashboard");
			const [theme, setTheme] = useState(loadTheme);
			/** Live theme sync (no save button, like the panel toggles): the
			 *  picker writes through the module bus, so the whole section
			 *  (dashboard, pricing, compare, settings — all inside
			 *  `.dp_themeScope`) and every other mounted surface re-theme
			 *  instantly, and the preference persists in localStorage. */
			useEffect(() => subscribeTheme(setTheme), []);
			/** One source of truth for the section tabs: label + target. */
			const tabs = [
				["pricing", t("setTitle")],
				["compare", t("compare")],
				["panels", t("panels")],
			];
			const tabButtons = tabs.map(([target, label], i) => jsx(Btn, {
				// Right-anchor rides the sheet class on BOTH Btn channels: the
				// official path drops fallbackClass, the fallback prefers it.
				fallbackClass: i === 0 ? "dp_miniBtn dp_setLinkEnd" : "dp_miniBtn",
				className: i === 0 ? "dp_setLinkEnd" : undefined,
				variant: target === page ? "primary" : "outline", size: "sm",
				onClick: () => setPage(target),
				children: label,
			}, target));
			if (page !== "dashboard") {
				const title = page === "pricing" ? t("setTitle") : page === "compare" ? t("compare") : t("panels");
				const body = page === "pricing"
					? jsx(PricingPage, { t })
					: page === "compare"
						? jsx(ComparePage, { t })
						: jsx(PanelsPage, { t, theme, setTheme });
				return jsxs("div", { className: "dp_page dp_themeScope", "data-dp-theme": theme, children: [
					jsxs("div", { className: "dp_headerRow", children: [
						jsx("button", { type: "button", className: "dp_backBtn", onClick: () => setPage("dashboard"), children: t("back") }),
						jsx("span", { className: "dp_title", children: title }),
						...tabButtons,
					] }),
					body,
				] });
			}
			return jsxs("div", { className: "dp_page dp_themeScope", "data-dp-theme": theme, children: [
				// The factory occurrence carries `t` from its locale; passing `t`
				// again as an input prop would collide with the framework kit.
				typeof renderFactorySlot === "function"
					? renderFactorySlot("pulse.dashboard", {
						onConfigure: () => setPage("pricing"),
						headerExtra: jsxs("div", { className: "dp_headerRow", children: [
							jsx(Btn, { fallbackClass: "dp_miniBtn", variant: "outline", size: "sm", onClick: () => setPage("pricing"), children: t("configure") }),
							jsx(Btn, { fallbackClass: "dp_miniBtn", variant: "outline", size: "sm", onClick: () => setPage("compare"), children: t("compare") }),
							jsx(Btn, { fallbackClass: "dp_miniBtn", variant: "outline", size: "sm", onClick: () => setPage("panels"), children: t("panels") }),
						] }),
					}, { fallback: jsx(PulseDashboard, {
						t,
						onConfigure: () => setPage("pricing"),
						headerExtra: jsxs("div", { className: "dp_headerRow", children: [
							jsx(Btn, { fallbackClass: "dp_miniBtn", variant: "outline", size: "sm", onClick: () => setPage("pricing"), children: t("configure") }),
							jsx(Btn, { fallbackClass: "dp_miniBtn", variant: "outline", size: "sm", onClick: () => setPage("compare"), children: t("compare") }),
							jsx(Btn, { fallbackClass: "dp_miniBtn", variant: "outline", size: "sm", onClick: () => setPage("panels"), children: t("panels") }),
						] }),
					}) })
					: jsx(PulseDashboard, {
						t,
						onConfigure: () => setPage("pricing"),
						headerExtra: jsxs("div", { className: "dp_headerRow", children: [
							jsx(Btn, { fallbackClass: "dp_miniBtn", variant: "outline", size: "sm", onClick: () => setPage("pricing"), children: t("configure") }),
							jsx(Btn, { fallbackClass: "dp_miniBtn", variant: "outline", size: "sm", onClick: () => setPage("compare"), children: t("compare") }),
							jsx(Btn, { fallbackClass: "dp_miniBtn", variant: "outline", size: "sm", onClick: () => setPage("panels"), children: t("panels") }),
						] }),
					}),
			] });
		}

		/** The COMPACT pulse surface: how much the invoking session's workspace
		 *  spent, at a glance — the workspace tag, this session's own numbers,
		 *  the workspace frame, model share and the recent sessions — with one
		 *  button into the full observatory. This is what the `/pulse` menu row
		 *  opens: the floating seat renders it (`flush`, inside the seat's own
		 *  frame), and the `conversation.chat.commandview` seat still renders it
		 *  for `/pulse` transcript nodes recorded while this plugin registered a
		 *  host command (history keeps its card).
		 *
		 *  @param props.focus - `{id, cwd}` of the session the summary speaks
		 *   for; `null` means every project.
		 *  @param props.onOpenFull - hand the seat over to the observatory;
		 *   omitted, the button opens it directly.
		 *  @param props.flush - drop the card frame, which the seat already draws. */
		export function PulseSummaryCard({ t, focus = null, onOpenFull = null, flush = false }) {
			const focusSession = focus;
			const range = useMemo(() => {
				const today = localDay(Date.now());
				return { from: shiftDay(today, -6), to: today };
			}, []);
			const stats = usePulseStats(range.from, range.to);
			const data = stats.data;
			const project = useMemo(
				() => (data === null ? null : focusProjectLabel(data, focusSession)),
				[data, focusSession],
			);
			const view = useMemo(() => {
				if (data === null) return null;
				return buildView(data.sessions, {
					granularity: "day",
					from: typeof data.fromDay === "string" ? data.fromDay : range.from,
					to: typeof data.toDay === "string" ? data.toDay : range.to,
					project: project ?? "",
					pricing: data.pricing,
					fx: data.fx,
					monthly: data.monthly,
					auxShape: data.auxShape ?? null,
				});
			}, [data, project, range]);
			const pricing = data === null ? [] : data.pricing;
			const fx = data === null ? {} : data.fx;
			const monthly = data === null ? [] : data.monthly;
			const costOn = data !== null && data.costEnabled !== false;
			const tokenTotal = (tokens) => (tokens.input || 0) + (tokens.output || 0) + (tokens.cacheRead || 0) + (tokens.cacheWrite || 0);
			/** 命中率与仪表盘同源：读 view model 的 {@link cacheHitRateOf}（镜像
			 *  区），不在 UI 半区重推公式——口径改动只改一处。 */
			const hitText = (tokens) => {
				const rate = cacheHitRateOf(tokens);
				return rate === null ? null : `${Math.round(rate * 100)}%`;
			};
			const turnsOf = (record) => {
				let turns = 0;
				for (const value of Object.values(record.turnsByDay ?? {})) turns += Number(value) || 0;
				return turns;
			};
			const dayOf = (record) => {
				if (typeof record.day === "string" && record.day !== "") return record.day.slice(5);
				const created = Number(record.createdAt) || 0;
				return created > 0 ? localDay(created).slice(5) : "—";
			};
			/** Price one row list under the same rules the dashboard uses. `null`
			 *  (not 0) when cost display is off or no rule covers the rows, so the
			 *  card omits the amount instead of printing a fake zero. */
			const costOrNull = (rows) => {
				if (!costOn) return null;
				const priced = costOf(rows, pricing, fx, monthly);
				return priced.configured ? priced.total : null;
			};
			const money = (value) => (value === null ? null : moneyCny(value));
			const totals = view === null ? null : view.totals;
			/** The invoking session's own payload record over this window — the
			 *  card's whole point: this session first, the workspace as the frame. */
			const sessionRecord = useMemo(() => {
				if (data === null || focusSession === null) return null;
				const list = Array.isArray(data.sessions) ? data.sessions : [];
				return list.find((record) => record !== null && typeof record === "object" && record.id === focusSession.id) ?? null;
			}, [data, focusSession]);
			/** Headline: the session's own numbers, or the project window when the
			 *  session has no record yet (a spent-nothing session never gets an
			 *  invented number). */
			const hero = useMemo(() => {
				if (sessionRecord !== null) {
					const tokens = recordTokens(sessionRecord);
					return {
						label: t("cmdSession"),
						session: true,
						value: `${fmtTokens(tokenTotal(tokens))} tok`,
						hit: hitText(tokens),
						cost: costOrNull(sessionModelRows(sessionRecord)),
						turns: turnsOf(sessionRecord),
					};
				}
				if (totals === null) return null;
				return {
					label: t("cmdProject"),
					session: false,
					value: `${fmtTokens(tokenTotal(totals))} tok`,
					hit: typeof totals.cacheHitRate === "number" && Number.isFinite(totals.cacheHitRate)
						? `${Math.round(totals.cacheHitRate * 100)}%` : null,
					cost: costOn && view.cost.configured === true ? view.cost.total : null,
					turns: totals.turns ?? 0,
				};
			}, [sessionRecord, totals, view, t, costOn, pricing, fx, monthly]);
			/** The workspace frame under a session headline. */
			const scopeLine = useMemo(() => {
				if (sessionRecord === null || totals === null) return null;
				const parts = [`${fmtTokens(tokenTotal(totals))} tok`];
				const costText = costOn && view.cost.configured === true ? moneyCny(view.cost.total) : null;
				if (costText !== null) parts.push(costText);
				parts.push(fill(t("cmdSessCount"), { n: totals.sessions ?? 0 }));
				return `${t("cmdProject")} · ${parts.join(" · ")}`;
			}, [sessionRecord, totals, view, t, costOn]);
			/** Model share of the window: the top three by tokens plus one folded
			 *  rest row, each with what it cost. */
			const modelRows = useMemo(() => {
				if (view === null || !Array.isArray(view.models)) return [];
				const all = view.models
					.map((row) => ({
						key: row.key,
						name: typeof row.model === "string" && row.model !== "" ? row.model : row.key,
						total: tokenTotal(row),
						row,
					}))
					.filter((entry) => entry.total > 0);
				const grand = all.reduce((sum, entry) => sum + entry.total, 0);
				if (grand <= 0) return [];
				const rows = all.slice(0, 3).map((entry) => ({
					key: entry.key, name: entry.name, pct: (entry.total / grand) * 100,
					cost: costOrNull([entry.row]), rest: false,
				}));
				const rest = all.slice(3);
				if (rest.length > 0) {
					rows.push({
						key: "__dpRest",
						name: fill(t("cmdOthers"), { n: rest.length }),
						pct: (rest.reduce((sum, entry) => sum + entry.total, 0) / grand) * 100,
						cost: costOrNull(rest.map((entry) => entry.row)),
						rest: true,
					});
				}
				return rows;
			}, [view, t, costOn, pricing, fx, monthly]);
			/** The same workspace's three most recent sessions in the window. */
			const recentSessions = useMemo(() => {
				if (data === null) return [];
				const list = Array.isArray(data.sessions) ? data.sessions : [];
				const want = project ?? "";
				const rows = [];
				for (const record of list) {
					if (record === null || typeof record !== "object") continue;
					const label = record.project === null || record.project === undefined ? "" : String(record.project);
					if (want !== "" && label !== want) continue;
					const tokens = recordTokens(record);
					const total = tokenTotal(tokens);
					if (total <= 0) continue;
					rows.push({
						key: typeof record.id === "string" && record.id !== "" ? record.id : `${label}#${rows.length}`,
						day: dayOf(record),
						tokens: total,
						turns: turnsOf(record),
						cost: costOrNull(sessionModelRows(record)),
						createdAt: Number(record.createdAt) || 0,
					});
				}
				return rows.sort((a, b) => b.createdAt - a.createdAt || (a.day < b.day ? 1 : -1)).slice(0, 3);
			}, [data, project, costOn, pricing, fx, monthly]);
			const heroMeta = hero === null ? [] : [
				hero.hit === null ? null : `${t("cmdHit")} ${hero.hit}`,
				money(hero.cost),
				hero.turns > 0 ? fill(t("cmdTurns"), { n: hero.turns }) : null,
			].filter((part) => part !== null);
			const hasUsage = view !== null && view.hasData === true;
			return jsxs("div", { className: flush ? "dp_cmdCard" : "dp_card dp_variantCard dp_cmdCard", children: [
				jsxs("div", { className: "dp_cmdHead", children: [
					jsx(primitives.IconDataOutline16, { size: 15 }),
					jsx("span", { className: "dp_cmdTitle", children: t("title") }),
					jsx("span", { className: "dp_cmdWs", title: project ?? undefined, children: project ?? t("projectAll") }),
				] }),
				data === null
					? jsx("div", { className: "dp_cmdNote", children: stats.status === "error"
						? fill(t("cmdLoadFailed"), { err: stats.error ?? "" }) : t("loading") })
					: jsxs("div", { className: "dp_cmdHero", children: [
						jsx("span", { className: "dp_cmdHeroLabel", children: hero === null ? t("cmdNoUsage") : hero.label }),
						hero !== null && jsx("span", { className: "dp_cmdHeroValue", children: hero.value }),
						heroMeta.length > 0 && jsx("span", { className: "dp_cmdHeroMeta", children: heroMeta.join(" · ") }),
					] }),
				scopeLine !== null && jsx("div", { className: "dp_cmdScopeLine", children: scopeLine }),
				hasUsage && (modelRows.length > 0 || recentSessions.length > 0) && jsxs("div", { className: "dp_cmdGrid", children: [
					modelRows.length > 0 && jsxs("div", { className: "dp_cmdBlock", children: [
						jsxs("div", { className: "dp_cmdBlockTitle", children: [
							jsx("span", { children: t("cmdModels") }),
							jsx("span", { className: "dp_cmdBlockSub", children: t("cmdLast7") }),
						] }),
						jsx("div", { className: "dp_cmdBars", children: modelRows.map((row) => jsxs("div", {
							className: "dp_cmdBar",
							title: `${row.name} · ${row.pct.toFixed(1)}%${row.cost === null ? "" : ` · ${moneyCny(row.cost)}`}`,
							children: [
								jsx("span", { className: "dp_cmdBarName", children: row.name }),
								jsx("span", { className: "dp_cmdBarTrack", children: jsx("span", {
									className: `dp_cmdBarFill${row.rest ? " dp_cmdBarFillRest" : ""}`,
									style: { width: `${Math.max(row.pct, 1.5)}%` },
								}) }),
								jsx("span", { className: "dp_cmdBarPct", children: `${Math.round(row.pct)}%` }),
								jsx("span", { className: "dp_cmdBarCost", children: money(row.cost) ?? "" }),
							],
						}, row.key)) }),
					] }),
					recentSessions.length > 0 && jsxs("div", { className: "dp_cmdBlock", children: [
						jsx("div", { className: "dp_cmdBlockTitle", children: jsx("span", { children: t("cmdRecent") }) }),
						jsx("div", { className: "dp_cmdSess", children: recentSessions.map((row) => jsxs("div", { className: "dp_cmdSessRow", children: [
							jsx("span", { className: "dp_cmdSessDay", children: row.day }),
							jsx("span", { className: "dp_cmdSessTok", children: `${fmtTokens(row.tokens)} tok` }),
							jsx("span", { className: "dp_cmdSessMeta", children: row.turns > 0 ? fill(t("cmdTurns"), { n: row.turns }) : "" }),
							jsx("span", { className: "dp_cmdSessCost", children: money(row.cost) ?? "" }),
						] }, row.key)) }),
					] }),
				] }),
				jsxs("div", { className: "dp_cmdFoot", children: [
					jsx(Btn, { fallbackClass: "dp_miniBtn",
						variant: "outline", size: "sm",
						onClick: () => (typeof onOpenFull === "function" ? onOpenFull() : openOverlay("full", focusSession)),
						children: t("cmdOpen"),
					}),
					jsx("span", { className: "dp_cmdNote", children: focusSession === null ? t("cmdScopeAll") : t("cmdScope") }),
				] }),
			] });
		}

		/** conversation.chat.commandview seat: `/pulse` transcript nodes written
		 *  while the plugin registered a host command keep rendering the summary.
		 *  The host hands a session-scoped occupant the owning session's identity
		 *  and snapshot hooks, so those historical cards stay workspace-scoped;
		 *  hosts without the standard kit degrade to the all-projects view. */
		export function PulseCommandCard({ t, sessionId, useSessions }) {
			const readSessions = typeof useSessions === "function" ? useSessions : (sel) => sel(undefined);
			const cwd = readSessions((s) => s?.byId?.[sessionId]?.cwd ?? null) ?? null;
			const focus = typeof sessionId === "string" && sessionId !== "" ? { id: sessionId, cwd } : null;
			return jsx(PulseSummaryCard, { t, focus, onOpenFull: () => openOverlay("full", focus) });
		}

		/** sidebar.footer.action - icon rail / labeled row that opens the
		 *  overlay. In the wide (labeled) form, the current official balance
		 *  rides along next to the label when the display setting is on. */
		export function PulseFooterAction({ wide, t }) {
			const [panels, setPanelsLive] = useState(loadPanels);
			/** Live preference sync: the General-settings balance row (and any
			 *  other writer) flips the toggle, this chip follows immediately. */
			useEffect(() => subscribePanels((next) => setPanelsLive({ ...next })), []);
			const balance = useBalance(panels.footBalance !== false);
			const showBalance = wide && panels.footBalance !== false
				&& balance.data !== null && balance.data.ok === true;
			return jsx("button", {
				type: "button",
				className: `dp_footBtn${wide ? "" : " dp_footRail"}`,
				onClick: () => openOverlay("full", null),
				"aria-label": t("openOverlay"),
				title: t("openOverlay"),
				children: wide
					? [jsx(primitives.IconDataOutline16, { key: "i", size: 16 }), jsx("span", { key: "l", children: t("nav") }),
						showBalance && jsx("span", { key: "b", className: "dp_footBalance", children: moneyCny(balance.data.total ?? 0) })]
					: jsx(primitives.IconDataOutline16, { size: 16 }),
			});
		}

		/** shell.overlay - the floating pulse seat, closed by default. Two faces
		 *  share it: the compact session summary the `/pulse` menu row opens,
		 *  and the full observatory the sidebar button opens. The summary hands
		 *  over to the observatory in place, so the seat never stacks. */
		export function PulseOverlay({ t, renderFactorySlot }) {
			const overlay = useSyncExternalStore(subscribeOverlay, overlaySnapshot);
			const open = overlay.open;
			const summary = overlay.mode === "summary";
			const stats = useSyncExternalStore(subscribeStats, () => statsState);
			/** 浮层卡无级宽度：偏好走 width store（theme/panels 同款 localStorage），
			 *  null = 880 表格默认。拖动期间直写卡片 style——重排归浏览器，不经
			 *  React；松手（或 pointercancel）才提交偏好。左缘把手兼作 slider
			 *  语义（←→ ±40px），双击复位。 */
			const cardRef = useRef(null);
			const gripDrag = useRef(null);
			const [width, setWidthLive] = useState(loadWidth);
			useEffect(() => subscribeWidth(setWidthLive), []);
			const onGripDown = (e) => {
				if (e.button !== 0 || cardRef.current === null) return;
				e.preventDefault();
				gripDrag.current = { x: e.clientX, w: cardRef.current.getBoundingClientRect().width };
				e.currentTarget.setPointerCapture?.(e.pointerId);
			};
			const onGripMove = (e) => {
				const d = gripDrag.current;
				if (d === null || cardRef.current === null) return;
				cardRef.current.style.width = `${Math.max(WIDTH_MIN, Math.min(WIDTH_MAX, Math.round(d.w + (d.x - e.clientX))))}px`;
			};
			const onGripUp = (e) => {
				const d = gripDrag.current;
				gripDrag.current = null;
				if (d === null) return;
				setWidth(d.w + (d.x - e.clientX));
			};
			const onGripKey = (e) => {
				if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
				e.preventDefault();
				const cur = Math.round(cardRef.current?.getBoundingClientRect().width ?? 880);
				setWidth(cur + (e.key === "ArrowLeft" ? -40 : 40));
			};
			useEscape(open, () => setOverlayOpen(false));
			if (!open) return null;
			/** The refresh/close actions live in a `dp_overlayActions` layer
			 *  pinned to the card's top-right corner (absolute, never scrolled
			 *  away), so the dashboard header drops its own refresh in the
			 *  overlay form (`floatActions`). */
			const refreshBtn = jsx(Btn, {
				variant: "toolbar", size: "sm", fallbackClass: "dp_iconBtn",
				onClick: () => loadStats(stats.from, stats.to),
				"aria-label": t("refresh"), title: t("refresh"), disabled: stats.busy || stats.from === null,
				icon: jsx(primitives.IconRefreshOutline16, { size: 15 }),
			});
			const closeBtn = jsx(Btn, {
				variant: "toolbar", size: "sm", fallbackClass: "dp_iconBtn",
				onClick: () => setOverlayOpen(false), "aria-label": t("close"), title: t("close"),
				icon: jsx(primitives.IconCloseOutline16, { size: 14 }),
			});
			/** Clicking the blank seat outside the card closes the overlay;
			 *  clicks inside the card never bubble to it. */
			const onBackdrop = (e) => { if (e.target === e.currentTarget) setOverlayOpen(false); };
			const dashboard = typeof renderFactorySlot === "function"
				? renderFactorySlot("pulse.dashboard", { floatActions: true }, { fallback: jsx(PulseDashboard, { t, floatActions: true }) })
				: jsx(PulseDashboard, { t, floatActions: true });
			/** The summary face speaks for the invoking session and offers the
			 *  hand-off; the observatory face keeps the refresh action, which
			 *  only its data view needs. */
			const body = summary
				? jsx(PulseSummaryCard, {
					t, flush: true, focus: overlay.focus,
					onOpenFull: () => openOverlay("full", overlay.focus),
				})
				: dashboard;
			return jsx("div", {
				className: "dp_overlaySeat", onClick: onBackdrop,
				children: jsx("div", {
					className: `dp_overlayCard${summary ? " dp_overlayCardSummary" : ""}`,
					role: "dialog", "aria-label": t("title"),
					ref: cardRef,
					style: !summary && width !== null ? { width: `${width}px` } : undefined,
					children: [
						!summary && jsx("div", {
							className: "dp_ovlGrip", title: t("ovlGrip"),
							role: "slider", "aria-label": t("ovlGrip"),
							"aria-valuemin": WIDTH_MIN, "aria-valuemax": WIDTH_MAX,
							"aria-valuenow": width ?? 880, "aria-valuetext": `${width ?? 880}px`,
							tabIndex: 0,
							onPointerDown: onGripDown, onPointerMove: onGripMove,
							onPointerUp: onGripUp, onPointerCancel: onGripUp,
							onDoubleClick: () => setWidth(null),
							onKeyDown: onGripKey,
						}),
						jsx("div", { className: "dp_overlayScroll", children: body }),
						jsxs("div", { className: "dp_overlayActions", children: summary ? [closeBtn] : [refreshBtn, closeBtn] }),
					],
				}),
			});
		}
		//#endregion

