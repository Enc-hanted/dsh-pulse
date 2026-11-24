import { useState, useEffect, useMemo, useRef, useSyncExternalStore, jsx, jsxs } from "./react.js";
import { recordTokens } from "../view.js";
import { WIDTH_MAX, WIDTH_MIN, clearSeen, clearViewSnapshot, dataChangedBus, dataChangedSnapshot, fetchSettings, fill, fmtTokens, loadFootHint, loadPanels, loadStats, loadTheme, loadWidth, markExplicitClose, openOverlay, overlaySnapshot, saveFootHint, setOverlayOpen, setTheme, setWidth, statsState, subscribeDataChanged, subscribeOverlay, subscribePanels, subscribeSettings, subscribeStats, subscribeTheme, subscribeWidth, useBalance, useEscape, useQuota } from "./stores.js";
import { focusProjectLabel } from "./charts.js";
import { PulseDashboard } from "./dashboard.js";
import { PricingPage } from "./settings.js";
import { ComparePage } from "./compare.js";
import { PanelsPage } from "./panels.js";
import { Btn, Float, floatReady, primitives } from "./adapter.js";
import { FootFloat, FootGlyph, FootTip, footAriaLabel, footPctClass, footValueText, useFootWindow } from "./foot.js";
import { quotaEntryName, quotaEntryShort } from "./quota.js";
import { PEAK_HOURS } from "../pricing-facts.js";
import { buildView, cacheHitRateOf, costOf, footHintShow, footShareOf, footTodaySplitTokens, footTodayTokens, isOffPeakDay, localDay, moneyCny, pickFootSource, sessionModelRows, shiftDay, tierAtMs } from "./../view.js";
		//#region slot components
		/** settings.section page - owner props `{close}`, locale `t` via inject
		 *  face. Four levels of internal state (no shell navigation API): the
		 *  dashboard and the pricing / compare / settings pages. Every second
		 *  level header carries the full tab set (current page highlighted),
		 *  so the pages are reachable from each other without any pairwise
		 *  coupling; a fresh open lands on `initialPage` (dashboard default —
		 *  the overlay's panels face opens it on the settings page). */
		export function PulseSection({ t, renderFactorySlot, initialPage = "dashboard" }) {
			const [page, setPage] = useState(initialPage);
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
			/** The footer's window read, NOT the dashboard's store: the summary
			 *  card speaks a fixed 7-day window, and a remounted transcript card
			 *  must never retarget the shared store under an open observatory
			 *  (with the stale guard that read as a perpetual veil). Shared
			 *  cache + in-flight GET keep N cards on one request. */
			const { data, error: statsError } = useFootWindow(range.from, range.to);
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
					? jsx("div", { className: "dp_cmdNote", children: statsError !== null
						? fill(t("cmdLoadFailed"), { err: statsError }) : t("loading") })
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

		/** Pointer transit budget: the tip portals to document.body with a
		 *  6px anchor gap (adapter.js Float), so crossing from the button to
		 *  the tip fires the button's mouseleave FIRST — an immediate close
		 *  there made the tip's own actions unreachable. Leaving either side
		 *  schedules the close; entering either cancels it. Long enough to
		 *  cross the gap without flicker, short enough to still feel like a
		 *  tooltip. */
		const FOOT_TIP_CLOSE_MS = 250;
		/** Keyboard-focus detector (:focus-visible — true on Tab focus, false
		 *  on click/hover focus). A host that doesn't know the selector reads
		 *  as hover-open (no focus hand-off), never as a thrown selector. */
		const focusVisible = (el) => {
			try { return typeof el?.matches === "function" && el.matches(":focus-visible"); } catch { return false; }
		};
		/** sidebar.footer.action - the quick-display seat: ≤3 segments in the
		 *  wide form (glyph + source value, today's global tokens), the glyph
		 *  alone on the rail. The source is the manual selector's choice
		 *  (config footSource, shared with the TUI strip): A money wears the
		 *  peak sun / off-peak moon, B quota wears a utilization ring (≥80%
		 *  warn). Hover/focus floats the details; a <50% seven-day share
		 *  raises a one-time hint (hysteresis-rearmed). The suggestion's
		 *  interactive path lives in the tip (US-15: 「去选择」/「不再提示」) —
		 *  the dot on the button is only a decorative pointer shortcut, so
		 *  the button never nests interactive elements. */
		export function PulseFooterAction({ wide, t }) {
			const [panels, setPanelsLive] = useState(loadPanels);
			/** Live preference sync: the General-settings balance row (and any
			 *  other writer) flips the toggle, this chip follows immediately. */
			useEffect(() => subscribePanels((next) => setPanelsLive({ ...next })), []);
			/** 快显样式（localStorage 偏好，web 侧）：classic = 0.6.1 已发布的
			 *  入口行（图标 + 标签 + 余额胶囊），默认如此——升级用户看到的
			 *  和上一个版本一样，产品不硬切自己的发布面；data = 数据脸
			 *  （glyph + 来源 + 今日）。两套面长期共存，各有语义。 */
			const classic = panels.footStyle !== "data";
			const enabled = panels.footBalance !== false;
			const balance = useBalance(enabled);
			/** classic（默认面）只消费余额：数据面的额度轮询、设置订阅与 7 天
			 *  窗口读全部按 classic 门控——升级用户的页脚不该为新样式买单
			 *  （hook 顺序不变，只改 enabled）。 */
			const quota = useQuota(!classic && enabled);
			const [settings, setSettings] = useState(null);
			useEffect(() => {
				if (classic) return undefined;
				let cancelled = false;
				const read = () => fetchSettings().then((data) => { if (!cancelled) setSettings(data); }).catch(() => { /* the selector face degrades to auto */ });
				read();
				const unsubscribe = subscribeSettings(read);
				return () => { cancelled = true; unsubscribe(); };
			}, [classic]);
			const today = localDay(Date.now());
			const { data: footData } = useFootWindow(shiftDay(today, -6), today, !classic);
			const [tipOpen, setTipOpen] = useState(false);
			/** Keyboard-opened tips take focus into the tip's action row (the
			 *  portaled buttons sit at body END — tab-only access would walk
			 *  the whole document first). Hover-open never steals focus. */
			const [tipTakeFocus, setTipTakeFocus] = useState(false);
			const [hintMuted, setHintMuted] = useState(false);
			const btnRef = useRef(null);
			/** Reachability contract for the tip's actions (US-15): pointer
			 *  users cross the anchor gap under the close-delay bridge; the
			 *  tip's own root cancels the pending close on enter. Keyboard
			 *  users must NOT lose the tip on blur — blur fires the moment
			 *  focus leaves the button, while the portaled buttons are only
			 *  reached a Tab later, so blur here used to unmount the panel
			 *  under the focus hand-off (focus fell to body, 「不再提示」
			 *  unreachable). Keyboard/pointer close paths: Escape (tip-only —
			 *  capture+consume so the observatory overlay's own Escape
			 *  doesn't chain), any outside pointerdown (Float's dismiss),
			 *  and the pointer leaving both sides. */
			const tipCloseTimer = useRef(null);
			const cancelTipClose = () => {
				if (tipCloseTimer.current !== null) { clearTimeout(tipCloseTimer.current); tipCloseTimer.current = null; }
			};
			const scheduleTipClose = () => {
				cancelTipClose();
				tipCloseTimer.current = setTimeout(() => { tipCloseTimer.current = null; setTipOpen(false); }, FOOT_TIP_CLOSE_MS);
			};
			const openTip = (takeFocus) => {
				cancelTipClose();
				setTipTakeFocus(takeFocus === true);
				setTipOpen(true);
			};
			useEffect(() => cancelTipClose, []);
			useEscape(tipOpen, () => setTipOpen(false), { capture: true, consume: true });
			const source = enabled ? pickFootSource(settings?.footSource ?? "", balance.data, quota.data?.providers) : null;
			const sessions = Array.isArray(footData?.sessions) ? footData.sessions : [];
			const now = Date.now();
			const todayTok = footTodayTokens(sessions, now);
			const todaySplit = footTodaySplitTokens(sessions, now);
			const share = source !== null ? footShareOf(sessions, source.kind, source.route, now) : null;
			const hintGate = footHintShow(share?.share ?? null, loadFootHint());
			const hint = { ...hintGate, share: share?.share ?? null, show: hintGate.show && !hintMuted && !classic };
			const hintDismissed = hintGate.next?.dismissed === true;
			useEffect(() => {
				if (!classic && (loadFootHint()?.dismissed === true) !== hintDismissed) saveFootHint(hintGate.next);
			}, [hintDismissed, classic]);
			const peak = tierAtMs(now, PEAK_HOURS) === "peak" && !isOffPeakDay(today);
			const value = footValueText(source);
			/** 身份段：官方余额报「余额」，订阅报 plan 名（无应答的来源退回
			 *  路由名）——不开 tooltip 也知道这个环/这个数属于谁；TUI 条早已
			 *  如此，这里补齐 web 面的同一叙事。 */
			const name = source === null ? null
				: source.kind === "official" ? t("footNameOfficial")
					: source.entry !== null && source.entry !== undefined ? quotaEntryName(source.entry) : source.route;
			/** 紧档短名：spec 声明的品牌词（无则全名首词），由容器查询在宽度
			 *  不足时替换全名——设计好的降级，不是省略号；浮层与读屏仍报全名。 */
			const shortName = source === null ? null
				: source.kind === "official" ? t("footNameOfficial")
					: source.entry !== null && source.entry !== undefined ? quotaEntryShort(source.entry) : source.route;
			/** 桥接层：tip（无论 portal 还是自绘降级）都渲染在按钮的hover语
			 *  义之外——按钮的 mouseleave 在指针进 tip 前就已触发（portal 在
			 *  body，自绘在视觉上越出按钮框），tip 自己的 enter/leave 也要
			 *  参与取消/排程，桥才闭合。 */
			const tipBody = jsx("div", {
				onMouseEnter: cancelTipClose,
				onMouseLeave: scheduleTipClose,
				children: jsx(FootTip, {
					source, peak, todayTok, todaySplit, hint, t, takeFocus: tipTakeFocus,
					onPickSource: () => { setTipOpen(false); openOverlay("panels", null); },
					onDismissHint: () => { saveFootHint({ dismissed: true }); setHintMuted(true); },
				}),
			});
			/** 经典面：0.6.1 的发布样原样回归——图标 + 「用量观测台」 +
			 *  余额胶囊（余额开关开且应答时）。无 tip、无建议点、无数据段；
			 *  窄 rail 只有图标。hooks 全部在此之上调用完毕，早退不换 hook 序。 */
			if (classic) {
				const showBalance = wide && enabled && balance.data !== null && balance.data.ok === true;
				return jsxs("button", {
					type: "button",
					ref: btnRef,
					className: `dp_footBtn${wide ? "" : " dp_footRail"}`,
					onClick: () => openOverlay("full", null),
					"aria-label": t("openOverlay"),
					title: t("openOverlay"),
					children: [
						jsx(primitives.IconDataOutline16, { key: "i", size: 16 }),
						wide && jsx("span", { key: "l", children: t("nav") }),
						showBalance && jsx("span", { key: "b", className: "dp_footBalance", children: moneyCny(balance.data.total ?? 0) }),
					],
				});
			}
			return jsxs("button", {
				type: "button",
				ref: btnRef,
				className: `dp_footBtn${wide ? "" : " dp_footRail"}`,
				/** 聚焦当前窗口工作区不在这里传会话——观测台挂载后自己向宿主
				 *  问「主视图当前保留的会话」（retainBy mainView），对两个入
				 *  口统一生效。 */
				onClick: () => openOverlay("full", null),
				onMouseEnter: () => openTip(false),
				onMouseLeave: () => {
					// 只豁免「键盘驻留」：:focus-visible 为真即 Tab 焦点还在
					// 按钮上，鼠标路过不赶走 tip。点击焦点不豁免——那一下
					// 点击本就打开了观测台，指针离开时 tip 该排程关闭，别
					// 让它叠在浮层底下等下一次外点/Esc 才消失。
					if (focusVisible(btnRef.current)) return;
					scheduleTipClose();
				},
				onFocus: (e) => openTip(focusVisible(e?.target)),
				"aria-label": footAriaLabel({ source, peak, todayTok, todaySplit, t }),
				children: [
					jsx(FootGlyph, { key: "g", source, peak, size: 18 }),
					// 数据脸的空态回退入口行：无可用来源时没有数据段可说，
					// 退回「图标 + 标签」保住按钮的自述性（glyph 槽在
					// source=null 时本就渲染同一枚图标）。
					wide && source === null && jsx("span", { key: "l", children: t("nav") }),
					wide && name !== null && jsxs("span", { key: "n", className: "dp_footName", title: name, children: [
						jsx("span", { className: "dp_footNameFull", children: name }),
						jsx("span", { className: "dp_footNameShort", children: shortName }),
					] }),
					wide && value !== null && jsx("span", { key: "v", className: `dp_footValue${footPctClass(source?.entry?.windows?.[0]?.usedPct)}`, children: value }),
					/** 今日段去单位：标签三级色、数字二级加重——页脚读作数字，
					 *  单位留给浮层与读屏（footToday 仍是「今日 {v} tok」）。 */
					wide && source !== null && jsxs("span", { key: "t", className: "dp_footToday", children: [
						jsx("span", { children: t("footTodayLabel") }),
						jsx("b", { className: "dp_footTodayNum", children: fmtTokens(todayTok) }),
					] }),
					/** 纯装饰（aria-hidden，不可聚焦）：指针点它仍直达来源选择
					 *  ——便利，不是第二个交互元素；键盘与读屏路径走 tip 里的
					 *  建议行（US-15）。 */
					hint.show && jsx("span", {
						key: "h", className: "dp_footHintDot", "aria-hidden": true,
						title: t("footHintTitle"),
						onClick: (e) => { e.stopPropagation(); openOverlay("panels", null); },
					}),
					tipOpen && (floatReady()
						/** 宿主 Float（0.1.7+ primitives）：官方定位/关闭钩子。 */
						? jsx(Float, { open: true, onClose: () => setTipOpen(false), rootRef: btnRef, anchorRef: btnRef, maxHeight: 320, children: tipBody })
						/** 降级：自绘浮层——没有 MenuSurface 的宿主以前根本没有
						 *  tip，hover 只剩原生 title，建议动作完全不可达。 */
						: jsx(FootFloat, { anchorRef: btnRef, onClose: () => setTipOpen(false), children: tipBody })),
				],
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
			/** 橘点订阅必须在早退返回之前调用——hooks 数量在挂载期内必须
			 *  恒定，条件返回后调用会触发 React #310。 */
			const dataChanged = useSyncExternalStore(subscribeDataChanged, dataChangedSnapshot);
			if (!open) return null;
			/** The refresh/close actions live in a `dp_overlayActions` layer
			 *  pinned to the card's top-right corner (absolute, never scrolled
			 *  away), so the dashboard header drops its own refresh in the
			 *  overlay form (`floatActions`). */
			const refreshBtn = jsx(Btn, {
				variant: "toolbar", size: "sm", fallbackClass: "dp_iconBtn",
				className: dataChanged ? "dp_refreshHot" : undefined,
				onClick: () => { dataChangedBus.set(false); loadStats(stats.from, stats.to); },
				"aria-label": dataChanged ? t("refreshNew") : t("refresh"), title: dataChanged ? t("refreshNew") : t("refresh"), disabled: stats.busy || stats.from === null,
				icon: jsx(primitives.IconRefreshOutline16, { size: 15 }),
			});
			/** 显式关闭（点 ×）分脸：完整观测台的 × 是「结束这次观测」——视
			 *  图快照与数据指纹整份清除，下次打开从初始状态开始，旗标挡住卸
			 *  载补写。summary / panels 两张脸从未展示过会被遗忘的东西，× 就
			 *  只是收起（Esc / 点背景同义）。 */
			const endObservation = !summary && overlay.mode === "full";
			const closeExplicit = () => { clearViewSnapshot(); clearSeen(); markExplicitClose(); setOverlayOpen(false); };
			const closeBtn = jsx(Btn, {
				variant: "toolbar", size: "sm", fallbackClass: "dp_iconBtn",
				onClick: endObservation ? closeExplicit : () => setOverlayOpen(false), "aria-label": t("close"), title: t("close"),
				icon: jsx(primitives.IconCloseOutline16, { size: 14 }),
			});
			/** Clicking the blank seat outside the card closes the overlay;
			 *  clicks inside the card never bubble to it. */
			const onBackdrop = (e) => { if (e.target === e.currentTarget) setOverlayOpen(false); };
			/** focusSession 随行：/pulse 入口带来的会话必须送进完整观测台
			 *  ——此前在这里被丢掉，观测台只能退回 retainInfo 探测。 */
			const dashboard = typeof renderFactorySlot === "function"
				? renderFactorySlot("pulse.dashboard", { floatActions: true, focusSession: overlay.focus }, { fallback: jsx(PulseDashboard, { t, floatActions: true, focusSession: overlay.focus }) })
				: jsx(PulseDashboard, { t, floatActions: true, focusSession: overlay.focus });
			/** The summary face speaks for the invoking session and offers the
			 *  hand-off; the observatory face keeps the refresh action, which
			 *  only its data view needs. */
			const body = summary
				? jsx(PulseSummaryCard, {
					t, flush: true, focus: overlay.focus,
					onOpenFull: () => openOverlay("full", overlay.focus),
				})
				/** panels 脸 = 完整设置分节（初始落在设置页）：返回观台、定价
				 *  与对比页签全部可达——「去选择」的闭环不再断在死胡同，费用
				 *  卡的去设置也一跳即达。分节自带主题同步。 */
				: overlay.mode === "panels"
					? jsx(PulseSection, { t, renderFactorySlot, initialPage: "panels" })
					: dashboard;
			return jsx("div", {
				className: "dp_overlaySeat", onClick: onBackdrop,
				children: jsx("div", {
					className: `dp_overlayCard${summary ? " dp_overlayCardSummary" : ""}`,
					role: "dialog", "aria-label": t("title"),
					ref: cardRef,
					style: !summary && typeof width === "number" ? { width: `${width}px` } : undefined,
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

