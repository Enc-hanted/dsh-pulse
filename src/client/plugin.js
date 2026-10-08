import { useState, useEffect, jsx, jsxs } from "./react.js";
import { NS, en, zh } from "./locale.js";
import { loadPanels, loadTheme, openOverlay, savePanels, setTheme, subscribePanels, subscribeTheme } from "./stores.js";
import { PulseDashboard } from "./dashboard.js";
import { PricingPage } from "./settings.js";
import { PulseCommandCard, PulseFooterAction, PulseOverlay, PulseSection } from "./slots.js";
import { defineStore, Switch, Tag, primitives } from "./adapter.js";
		//#region plugin
		/** General-settings row: the sidebar-balance indicator as a first-class
		 *  preference. Reads through the store seat's `useStore`; the switch
		 *  writes via the injected `setFootBalance`, which lands in
		 *  `savePanels` and rides the panels bus back into the store. */
		export function FootBalanceRow({ t, setFootBalance, useStore }) {
			const enabled = useStore ? useStore((s) => s.enabled) : true;
			const change = (next) => setFootBalance(next === true);
			return jsxs("div", { className: "dp_cfgRow", children: [
				jsxs("div", { className: "dp_setRowText", children: [
					jsx("div", { className: "dp_setRowTitle", children: t("generalFootBalance") }),
					jsx("div", { className: "dp_setRowDesc", children: t("generalFootBalanceDesc") }),
				] }),
				jsx(Switch, { checked: enabled, label: t("generalFootBalance"), onChange: change }),
			] });
		}

		/** Plugins-page row configuration (`dsh-pulse#pulse`). The manager
		 *  renders the entry twice: `view: "summary"` — a one-line description
		 *  in the rows list — and `view: "page"` — the full pricing editor on
		 *  the row's detail page, wrapped in the observatory theme scope. */
		export function PulseRowConfig({ t, view }) {
			const [theme, setTheme] = useState(loadTheme);
			useEffect(() => subscribeTheme(setTheme), []);
			if (view === "summary") return jsx("span", { children: t("rowConfigSummary") });
			return jsxs("div", { className: "dp_page dp_themeScope", "data-dp-theme": theme, children: [
				jsx(PricingPage, { t }),
			] });
		}

		/** Tag beside the bundle detail page's title. */
		const isPulseDetail = (subject) => subject?.kind === "bundle"
			&& (subject.pkg?.name === "dsh-pulse" || String(subject.pkg?.name ?? "").endsWith("/dsh-pulse"));

		export function PulseDetailBadge({ t, subject }) {
			// The host renders these slots on EVERY plugin's detail page and
			// hands over the page's subject — render only on our own page.
			if (!isPulseDetail(subject)) return null;
			return jsx(Tag, { tone: "outline", fallbackClass: "dp_sessBadge", children: t("detailBadge") });
		}

		/** Section under the bundle detail page's own content. */
		export function PulseDetailSection({ t, subject }) {
			if (!isPulseDetail(subject)) return null;
			return jsxs("div", { className: "dp_card", children: [
				jsx("div", { className: "dp_setTitle", children: t("detailSectionTitle") }),
				jsx("div", { className: "dp_setSub", children: t("detailSectionBody") }),
			] });
		}

		/** Required services (cordis fiber inject). */
		export const inject = ["slots", "locale"];

		/**
		 * Register the pulse surfaces: a settings page, the `/pulse` chat card,
		 * a sidebar foot action, and the floating overlay it opens.
		 * @param {object} ctx - client root context.
		 */
		export function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-pulse: copy dictionaries");
			const t = ctx.locale.bind(NS);
			/** '/' 菜单行：dsh 只为它自己的六个内置命令画图标（那张表写死在宿主
			 *  里，没有面插件接口），而官方客户端命令契约 `ctx.commandUi.register`
			 *  允许插件自带 icon 和随语言求值的 label/description——所以这一行是
			 *  客户端贡献项，也是本插件唯一的菜单入口（同名宿主命令会撞名 fail
			 *  loud，因此不再注册宿主命令）。点选后不再绕远程执行，直接打开插件
			 *  自有的浮层座位：`summary` 面显示本次会话的精简卡片，卡片上的按钮
			 *  原地切到完整观测台。注册走 `ctx.inject(["commandUi"])`：服务未就绪
			 *  时挂起等待（对方可能晚于本插件加载），老宿主上一直没有就静默跳过，
			 *  其余界面不受影响。 */
			let menuFaceRegistered = false;
			const registerMenuFace = (scope) => {
				if (menuFaceRegistered) return;
				const commandUi = typeof scope.get === "function" ? scope.get("commandUi") : scope.commandUi;
				if (commandUi === undefined || typeof commandUi.register !== "function") return;
				menuFaceRegistered = true;
				scope.effect(() => commandUi.register({
					name: "pulse",
					label: () => t("nav"),
					description: () => t("cmdMenuDesc"),
					icon: primitives.IconDataOutline16,
					available: () => true,
					ui: {
						kind: "action",
						run: (session) => {
							const id = typeof session?.sessionId === "string" && session.sessionId !== ""
								? session.sessionId : null;
							openOverlay("summary", id === null ? null : { id });
						},
					},
				}), "dsh-pulse: /pulse menu contribution");
			};
			try {
				if (typeof ctx.inject === "function") ctx.inject(["commandUi"], registerMenuFace);
				else registerMenuFace(ctx);
			} catch (error) {
				ctx.logger?.warn?.("dsh-pulse: /pulse menu contribution unavailable", error);
				registerMenuFace(ctx);
			}
			/** Seat diagnostics: `ctx.slots.inject` on a seat this host never
			 *  declared HANGS (the callback simply never runs), and a refused
			 *  registration used to vanish into a bare catch — a host upgrade
			 *  that dropped a seat name would only ever surface as a missing
			 *  UI block. Each seat now reports once: a delayed probe warns when
			 *  the callback has not run (hanging absence — seats whose surfaces
			 *  open lazily may legitimately trip it), the catch warns on
			 *  synchronous refusal. */
			const SEAT_PROBE_MS = 15000;
			const injectSeat = (name, declare) => {
				let seen = false;
				setTimeout(() => {
					if (!seen) ctx.logger?.warn?.(`dsh-pulse: seat "${name}" not exercised by this host within ${SEAT_PROBE_MS / 1000}s (absent, or its surface was never opened)`);
				}, SEAT_PROBE_MS);
				ctx.slots.inject(name, (...args) => {
					seen = true;
					declare(...args);
				});
			};
			injectSeat("settings.section", () => ctx.slots.register({
				name: "settings.section", id: "pulse", order: 25, label: () => t("nav"), inject: () => ({ t }),
			}, PulseSection));
			injectSeat("conversation.chat.commandview", () => ctx.slots.register({
				name: "conversation.chat.commandview", key: "pulse-usage", inject: () => ({ t }),
			}, PulseCommandCard));
			injectSeat("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action", id: "pulse", order: 5, label: () => t("nav"), inject: () => ({ t }),
			}, PulseFooterAction));
			injectSeat("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay", id: "pulse", order: 10, inject: () => ({ t }),
			}, PulseOverlay));
			/** The dashboard as a reusable Component Factory (0.1.7+ slots):
			 *  unrelated packages mount it with
			 *  `renderFactorySlot("pulse.dashboard", { ... })` and inject extra
			 *  panels into the declared `pulse.dashboard.panel` child slot.
			 *  Occurrences get `t` from the factory locale, so render sites pass
			 *  only their own props (an overlapping `t` would throw); our own
			 *  surfaces route through the factory and fall back to the direct
			 *  render whenever the factory is missing — older hosts, or a host
			 *  whose loader rejected the declaration. */
			/** Reactive stats mirror behind the factory's store seat: injected
			 *  chips/filters/panels read LIVE data through `useStore` (and drive
			 *  the dashboard through `actions`) instead of freezing on a
			 *  render-site snapshot. `PulseDashboard` is the only writer — its
			 *  sync effect lands the freshest cut on every change. */
			const statsStore = defineStore !== null ? defineStore({
				init: () => ({ data: null, view: null, busy: false }),
				actions: { sync: (draft, data, view, busy) => { draft.data = data; draft.view = view; draft.busy = busy; } },
			}) : null;
			/** Reactive mirror of the sidebar-balance preference for the
			 *  General-settings row; `savePanels` (through the panels bus)
			 *  and the row's switch both land here. */
			const footBalanceStore = defineStore !== null ? defineStore({
				init: () => ({ enabled: loadPanels().footBalance !== false }),
				actions: { setEnabled: (draft, enabled) => { draft.enabled = enabled; } },
			}) : null;
			let footBalanceBound = null;
			if (typeof ctx.slots.registerFactory === "function") {
				try {
					ctx.effect(() => ctx.slots.registerFactory({
						name: "pulse.dashboard",
						scope: "root",
						locale: NS,
						store: statsStore ?? undefined,
						children: {
							"pulse.dashboard.chip": { kind: "list", scope: "root" },
							"pulse.dashboard.filter": { kind: "list", scope: "root" },
							"pulse.dashboard.panel": { kind: "list", scope: "root" },
						},
					}, PulseDashboard), "dsh-pulse: dashboard factory");
				} catch {
					// Registration refused (conflicting definition, old core):
					// every surface already falls back to the direct render.
				}
			}
			if (footBalanceStore !== null) {
				/** Apply-world writer, exactly the ui-theme pattern: the
				 *  framework hands the bound actions to `inject` when the row
				 *  mounts; the panels bus keeps them in sync afterwards. */
				ctx.effect(() => subscribePanels((panels) => {
					footBalanceBound?.setEnabled?.(panels.footBalance !== false);
				}), "dsh-pulse: foot-balance store sync");
				ctx.effect(() => injectSeat("settings.general.item", () => ctx.slots.register({
					name: "settings.general.item",
					id: "pulse-foot-balance",
					order: 20,
					store: footBalanceStore,
					locale: NS,
					inject: (actions) => {
						footBalanceBound = actions;
						actions?.setEnabled?.(loadPanels().footBalance !== false);
						return { setFootBalance: (enabled) => {
							savePanels({ ...loadPanels(), footBalance: enabled === true });
						} };
					},
				}, FootBalanceRow)), "dsh-pulse: general foot-balance row");
			}
			/** The pricing editor embedded on the bundle's own Plugins-page row
			 *  (`dsh-pulse#pulse`): the manager renders it with `view: "page"`
			 *  on the row's detail page and `view: "summary"` in the list.
			 *  Plugin-manager and General-settings seats are 0.1.7 slot names;
			 *  an older host that refuses an unknown slot must not take down
			 *  the rest of the registration batch, so each seat refuses alone
			 *  (same contract as the dashboard factory above) — loudly now, so
			 *  a dropped seat name is a log line instead of a missing UI block. */
			const seatAttempt = (name, attempt) => {
				try {
					attempt();
				} catch (error) {
					ctx.logger?.warn?.(`dsh-pulse: seat "${name}" refused by this host`, error);
				}
			};
			seatAttempt("plugins.row.config", () => ctx.effect(() => injectSeat("plugins.row.config", () => ctx.slots.register({
				name: "plugins.row.config", key: "dsh-pulse#pulse", inject: () => ({ t }),
			}, PulseRowConfig)), "dsh-pulse: row config"));
			seatAttempt("plugins.detail.badge", () => ctx.effect(() => injectSeat("plugins.detail.badge", () => ctx.slots.register({
				name: "plugins.detail.badge", id: "pulse", inject: () => ({ t }),
			}, PulseDetailBadge)), "dsh-pulse: detail badge"));
			seatAttempt("plugins.detail.section", () => ctx.effect(() => injectSeat("plugins.detail.section", () => ctx.slots.register({
				name: "plugins.detail.section", id: "pulse", inject: () => ({ t }),
			}, PulseDetailSection)), "dsh-pulse: detail section"));
		}
		//#endregion

