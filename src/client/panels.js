import { useState, useEffect, jsx, jsxs } from "./react.js";
import { THEMES, clearViewSnapshot, fetchSettings, fill, invalidateSettings, loadPanels, loadStats, markExplicitClose, payloadCache, savePanels, setTheme, statsState, subscribePanels, useQuota, writeSettings } from "./stores.js";
import { quotaWindowLabel } from "./quota.js";
import { Checkbox, Input, Seg } from "./adapter.js";
import { DEFAULT_USD_TO_CNY } from "./../view.js";
import { compareVersions, PulseAboutPanel, PulseCardPanel } from "./panels-card.js";
import { QuotaQueryPanel } from "./panels-quota.js";
export { compareVersions, PulseAboutPanel, PulseCardPanel, QuotaQueryPanel };
		//#region panels page
		/** Display settings — which observatory panels render, plus the
		 *  sidebar balance toggle. Local preferences only. */
		/** 显示面板清单：9 个开关。费用估算不在列——它由通用设置的
		 *  「启用费用估算」唯一控制；月度预算与对账明细属于估算功能，
		 *  跟随估算显隐，不设独立开关；侧栏余额只留在通用设置。 */
		export const PANEL_ITEMS = (t) => [
			["balance", t("panelBalance"), t("panelDescBalance")],
			["quota", t("panelQuota"), t("panelDescQuota")],
			["trend", t("panelTrend"), t("panelDescTrend")],
			["costTrend", t("panelCostTrend"), t("panelDescCostTrend")],
			["cache", t("panelCache"), t("panelDescCache")],
			["models", t("panelModels"), t("panelDescModels")],
			["projects", t("panelProjects"), t("panelDescProjects")],
			["sessions", t("panelSessions"), t("panelDescSessions")],
			["anomaly", t("panelAnomaly"), t("panelDescAnomaly")],
		];

		/** 设置页的「订阅额度查询」面板：检测到的订阅供应商一行一个（右缘开
		 *  关写 `quotaOff`，写缝走 writeSettings——revision 现读现用、良性
		 *  竞争自动重试，本地面板不再持有副本）。没有检测到任何供应商时
		 *  整块隐藏。 */
		export function QuotaSettingsPanel({ t }) {
			const quota = useQuota(true);
			const [state, setState] = useState({ status: "loading", off: [], writable: false, saving: null, error: null, saved: false });
			useEffect(() => {
				let cancelled = false;
				fetchSettings()
					.then((data) => {
						if (cancelled) return;
						setState((s) => ({
							...s, status: "ready",
							off: Array.isArray(data.quotaOff) ? data.quotaOff : [],
							writable: data.writable === true,
						}));
					})
					.catch((error) => { if (!cancelled) setState((s) => ({ ...s, status: "error", error: String(error?.message ?? error) })); });
				return () => { cancelled = true; };
			}, []);
			const reloadSettings = () => {
				invalidateSettings();
				fetchSettings()
					.then((data) => setState((s) => ({
						...s,
						off: Array.isArray(data.quotaOff) ? data.quotaOff : s.off,
						writable: data.writable === true,
					})))
					.catch(() => { /* the error line already shows the failure */ });
			};
			const toggle = (provider, on) => {
				const next = on ? state.off.filter((id) => id !== provider) : [...new Set([...state.off, provider])];
				setState((s) => ({ ...s, saving: provider, error: null, saved: false }));
				writeSettings({ quotaOff: next }, {
					onConflict: () => {
						setState((s) => ({ ...s, saving: null, error: t("setConflict") }));
						reloadSettings();
					},
				})
					.then(({ conflict }) => {
						if (conflict) return;
						setState((s) => ({ ...s, saving: null, saved: true, off: next }));
						reloadSettings();
						quota.refresh();
					})
					// 服务端错误字符串一律经 locale 包裹上墙——裸的
					// "Unexpected token …" / "HTTP 500" 不许直接示人。
					.catch((error) => setState((s) => ({ ...s, saving: null, error: fill(t("setFailed"), { err: String(error?.message ?? error) }) })));
			};
			const entries = (Array.isArray(quota.data?.providers) ? quota.data.providers : [])
				.slice()
				.sort((a, b) => String(a.displayName ?? a.provider).localeCompare(String(b.displayName ?? b.provider)));
			if (entries.length === 0) return null;
			const statusLine = (entry) => (entry.disabled === true ? t("quotaSettingsOff")
				: entry.ok !== true ? (entry.configured === false ? t("quotaNoCred") : fill(t("quotaFailed"), { err: entry.error ?? "?" }))
					: entry.windows?.map((w) => `${quotaWindowLabel(w.id, t)} ${Math.round(w.usedPct ?? 0)}%`).join(" · "));
			return jsxs("div", { className: "dp_setPanel", children: [
				jsx("div", { className: "dp_setSub", children: t("quotaSettingsTitle") }),
				jsx("span", { className: "dp_setMsg", children: t("quotaSettingsHint") }),
				jsxs("div", { className: "dp_panelsGrid", children: entries.map((entry) => jsxs("label", { className: "dp_setSwitch", children: [
					jsx("input", {
						type: "checkbox",
						checked: entry.disabled !== true,
						disabled: state.status !== "ready" || !state.writable || state.saving !== null,
						onChange: (e) => toggle(entry.provider, e.target.checked),
					}),
					jsxs("span", { children: [
						entry.plan?.name ?? entry.label ?? entry.displayName ?? entry.provider,
						jsx("span", { className: "dp_qNote dp_qNoteBlock", children: statusLine(entry) }),
					] }),
				] }, entry.provider)) }),
				state.status === "error"
					? jsx("span", { className: "dp_setMsg dp_setMsgErr", children: fill(t("setFailed"), { err: state.error ?? "" }) })
					: state.error !== null
						? jsx("span", { className: "dp_setMsg dp_setMsgErr", children: state.error })
						: state.saved && jsx("span", { className: "dp_setMsg dp_setMsgOk", children: t("setSaved") }),
			] });
		}

		/** 快显来源选择器：侧栏常驻按钮与 TUI 条共用的手动源（config
		 *  footSource）。自动 = 官方余额优先，否则首个已应答订阅；C 类
		 *  （无查询接口）不在选项里——它们只进观测台估算。 */
		export function FootSourcePanel({ t }) {
			const quota = useQuota(true);
			const [state, setState] = useState({ status: "loading", footSource: "", writable: false, saving: false, error: null, saved: false });
			// 快显样式走 localStorage 偏好（panels store，web 侧），不经设置缝
			// ——纯展示取舍，不是需要跨端共享的配置；默认 classic = 0.6.1 的
			// 发布样，升级用户看到的面不变。
			const [styleLive, setStyleLive] = useState(() => (loadPanels().footStyle === "data" ? "data" : "classic"));
			useEffect(() => subscribePanels((next) => setStyleLive(next.footStyle === "data" ? "data" : "classic")), []);
			const pickStyle = (value) => {
				savePanels({ ...loadPanels(), footStyle: value });
				setStyleLive(value);
			};
			const load = () => fetchSettings()
				.then((data) => setState((s) => ({
					...s, status: "ready",
					footSource: typeof data.footSource === "string" ? data.footSource : "",
					writable: data.writable === true,
				})))
				.catch((error) => setState((s) => ({ ...s, status: "error", error: fill(t("setReadFailed"), { err: String(error?.message ?? error) }) })));
			useEffect(() => { load(); }, []);
			const entries = (Array.isArray(quota.data?.providers) ? quota.data.providers : [])
				.filter((entry) => entry.disabled !== true);
			const options = [
				{ value: "", label: t("footSrcAuto") },
				{ value: "official", label: t("footSrcOfficial") },
				...entries.map((entry) => ({ value: entry.provider, label: entry.plan?.name ?? entry.label ?? entry.displayName ?? entry.provider })),
			];
			const save = (next) => {
				setState((s) => ({ ...s, saving: true, saved: false, error: null }));
				// writeSettings 现读 revision 并在良性竞争时自动重试一次——
				// 本地 revision 不再持有（旧写法在第一次成功后即过期，第二
				// 次选择必 409 回滚）。
				writeSettings({ footSource: next }, {
					onConflict: () => { load(); },
				})
					.then(({ conflict }) => {
						// A conflict must RESET `saving`: the selector locks on
						// `saving`, so leaving it set turns one 409 into a
						// permanently locked selector — the choice was never
						// applied, and the refreshed copy says so in the locale.
						if (conflict) { setState((s) => ({ ...s, saving: false, error: t("setConflict") })); return; }
						setState((s) => ({ ...s, saving: false, saved: true, footSource: next }));
					})
					.catch((error) => setState((s) => ({ ...s, saving: false, error: fill(t("setFailed"), { err: String(error?.message ?? error) }) })));
			};
			const locked = state.status !== "ready" || !state.writable || state.saving;
			return jsxs("div", { className: "dp_setPanel", children: [
				jsx("div", { className: "dp_setSub", children: t("footSrcTitle") }),
				jsxs("div", { className: "dp_setRow dp_setRowMid", children: [
					jsx("select", {
						className: "dp_setInput dp_footSrcSelect",
						value: state.footSource, disabled: locked,
						"aria-label": t("footSrcTitle"),
						onChange: (e) => save(e.target.value),
						children: options.map((option) => jsx("option", { value: option.value, children: option.label }, option.value)),
					}),
					jsx("span", { className: "dp_setMsg", children: t("footSrcHint") }),
				] }),
				jsxs("div", { className: "dp_setRow dp_setRowMid", children: [
					jsx("span", { className: "dp_setLabel", children: t("footStyleTitle") }),
					jsx(Seg, {
						id: "pulse-foot-style", value: styleLive,
						options: [
							{ value: "classic", label: t("footStyleClassic") },
							{ value: "data", label: t("footStyleData") },
						],
						onChange: pickStyle,
						label: t("footStyleTitle"),
					}),
				] }),
				state.error !== null && jsx("span", { className: "dp_setMsg dp_setMsgErr", children: state.error }),
				state.saved && jsx("span", { className: "dp_setMsg dp_setMsgOk", children: t("setSaved") }),
			] });
		}

		export function PanelsPage({ t, theme, setTheme }) {
			const [panels, setPanels] = useState(loadPanels);
			const [currency, setCurrency] = useState({
				status: "loading", code: "CNY", display: "CNY", usdToCny: String(DEFAULT_USD_TO_CNY),
				writable: false, saving: false, error: null, saved: false,
				/** The loaded server snapshot — direct writes only POST when the
				 *  merged intent differs from it (a blur without an edit must
				 *  not write). The revision is deliberately NOT held here:
				 *  writeSettings reads it live per write (a mount-time copy
				 *  went stale after any other writer and bounced the second
				 *  flip back — the「修改无效」report). */
				baseline: null,
			});
			const toggle = (key) => setPanels((prev) => {
				const next = { ...prev, [key]: prev[key] === false };
				savePanels(next);
				/** 关掉「记住上次视图」即刻清空已存快照——开关的承诺是完整
				 *  的：关了就是没有记忆，而不是"下次开始不记"。旗标挡住观测
				 *  台卸载时的补写，刚清空的快照不许复活。 */
				if (key === "rememberView" && next.rememberView === false) { clearViewSnapshot(); markExplicitClose(); }
				return next;
			});
			const loadCurrency = () => {
				fetchSettings()
					.then((data) => setCurrency((s) => {
						const next = {
							...s, status: "ready",
							code: data.currency === "USD" ? "USD" : "CNY",
							display: data.displayCurrency === "USD" ? "USD" : "CNY",
							usdToCny: String(Number(data.fx?.usdToCny) > 0 ? data.fx.usdToCny : DEFAULT_USD_TO_CNY),
							writable: data.writable === true,
							error: null,
						};
						next.baseline = { code: next.code, display: next.display, usdToCny: next.usdToCny };
						return next;
					}))
					.catch((error) => setCurrency((s) => ({ ...s, status: "error", error: String(error?.message ?? error) })));
			};
			useEffect(loadCurrency, []);
			/** 直写模型（与本页其余控件同律）：任一字段变更即整组 POST——
			 *  宿主把三个字段当一个 section 收，部分保存仍带全量值。汇率在
			 *  blur/Enter 提交（输入途中不写），两个 Seg 即点即存。基线快照
			 *  挡住「没改也发一次」。revision 由 writeSettings 现读现用、
			 *  冲突自动重试一次；二次冲突才上墙并重读服务端真值。保存成功
			 *  后的副作用与旧表单版一致：payload 缓存清空 + 当前窗口重载，
			 *  否则金额面不跟换算。 */
			const saveCurrency = (patch) => {
				const merged = { code: currency.code, display: currency.display, usdToCny: currency.usdToCny, ...patch };
				const fx = Number(merged.usdToCny);
				if (!Number.isFinite(fx) || fx <= 0) {
					setCurrency((s) => ({ ...s, error: t("setBadNumber") }));
					return;
				}
				const clean = { code: merged.code, display: merged.display, usdToCny: String(fx) };
				if (currency.baseline !== null && clean.code === currency.baseline.code && clean.display === currency.baseline.display && clean.usdToCny === currency.baseline.usdToCny) {
					// 回到基线 = 没有要写的东西；顺手清掉上一轮的校验错误，
					// 别让「存在无效数字」挂在已经合法的输入上。
					setCurrency((s) => ({ ...s, error: null }));
					return;
				}
				setCurrency((s) => ({ ...s, saving: true, saved: false, error: null }));
				writeSettings({ currency: clean.code, displayCurrency: clean.display, usdToCny: fx }, {
					onConflict: () => {
						setCurrency((s) => ({ ...s, error: t("setConflict") }));
						loadCurrency();
					},
				})
					.then(({ conflict }) => {
						if (conflict) { setCurrency((s) => ({ ...s, saving: false, saved: false })); return; }
						setCurrency((s) => ({ ...s, saving: false, saved: true, ...clean, baseline: clean, error: null }));
						// The dashboard's cached payload prices with the old
						// rules/rate — drop it and reload the current window.
						if (statsState.key !== null) {
							payloadCache.delete(statsState.key);
							loadStats(statsState.from, statsState.to);
						}
					})
					.catch((error) => setCurrency((s) => ({ ...s, saving: false, error: fill(t("setFailed"), { err: String(error?.message ?? error) }) })));
			};
			/** 汇率的直写提交：不变（含空白）不写；非法数字就地报错、不发。 */
			const commitFx = () => {
				const raw = currency.usdToCny.trim();
				if (raw === "") return;
				if (raw !== currency.usdToCny) setCurrency((s) => ({ ...s, usdToCny: raw }));
				saveCurrency({ usdToCny: raw });
			};
			const curLocked = currency.status !== "ready" || !currency.writable || currency.saving;
			return jsxs("div", { className: "dp_setGrid", children: [
				jsxs("div", { className: "dp_setPanel", children: [
					// 标题归标题、提示归提示：面板头 = 短名词 + 一行弱色说明，
					// 不再让长句占标题槽（设置页 UI 语言统一的第一例）。
					jsx("div", { className: "dp_setSub", children: t("curTitle") }),
					jsx("span", { className: "dp_setMsg", children: t("displayHint") }),
					// 使用频率定序：显示币种最常动（改即生效），汇率其次，
					// 计价币种最冷（只影响自定义单价）殿后。
					jsxs("div", { className: "dp_setRow dp_setRowMid", children: [
						jsx("span", { className: "dp_setLabel", children: t("curDisplayTitle") }),
						jsx(Seg, {
							id: "pulse-display-currency",
							value: currency.display,
							options: [
								{ value: "CNY", label: "CNY", disabled: curLocked },
								{ value: "USD", label: "USD", disabled: curLocked },
							],
							onChange: (display) => saveCurrency({ display }),
							label: t("displayLabel"),
						}),
					] }),
					jsxs("div", { className: "dp_setInline", children: [
						jsx("span", { className: "dp_setLabel", children: `${t("setFxLabel")} 1 USD =` }),
						jsx(Input, {
							className: "dp_setInput dp_setFxInput", inputMode: "decimal",
							value: currency.usdToCny,
							disabled: curLocked,
							onChange: (e) => setCurrency((s) => ({ ...s, usdToCny: e.target.value })),
							onBlur: commitFx,
							onKeyDown: (e) => { if (e.key === "Enter") { e.preventDefault(); commitFx(); } },
						}),
					] }),
					jsxs("div", { className: "dp_setRow dp_setRowMid", children: [
						jsx("span", { className: "dp_setLabel", children: t("curPricingTitle") }),
						jsx(Seg, {
							id: "pulse-currency",
							value: currency.code,
							options: [
								{ value: "CNY", label: "CNY", disabled: curLocked },
								{ value: "USD", label: "USD", disabled: curLocked },
							],
							onChange: (code) => saveCurrency({ code }),
							label: t("currencyLabel"),
						}),
					] }),
					jsx("span", { className: "dp_setMsg", children: t("curPricingHint") }),
					currency.status === "error"
						? jsx("span", { className: "dp_setMsg dp_setMsgErr", children: fill(t("setFailed"), { err: currency.error }) })
						: !currency.writable && currency.status === "ready"
							? jsx("span", { className: "dp_setMsg dp_setMsgErr", children: t("setNotWritable") })
							: currency.error !== null && jsx("span", { className: "dp_setMsg dp_setMsgErr", children: currency.error }),
					currency.saved && jsx("span", { className: "dp_setMsg dp_setMsgOk", children: t("setSaved") }),
				] }),
				jsxs("div", { className: "dp_setPanel", children: [
					jsx("div", { className: "dp_setSub", children: t("panelsTitle") }),
					jsx("span", { className: "dp_setMsg", children: t("panelsSub") }),
					jsxs("div", { className: "dp_panelsGrid", children: PANEL_ITEMS(t).map(([key, label, desc]) => jsxs("div", { className: "dp_panelItem", children: [
						jsx(Checkbox, {
							className: "dp_setSwitch",
							checked: panels[key] !== false,
							onChange: () => toggle(key),
							label,
						}),
						jsx("span", { className: "dp_panelItemDesc", children: desc }),
					] }, key)) }),
				] }),
				jsxs("div", { className: "dp_setPanel", children: [
					jsx("div", { className: "dp_setSub", children: t("behaviorSub") }),
					jsxs("div", { className: "dp_panelsGrid", children: [
						jsxs("div", { className: "dp_panelItem", children: [
							jsx(Checkbox, {
								className: "dp_setSwitch",
								checked: panels.focusWorkspace !== false,
								onChange: () => toggle("focusWorkspace"),
								label: t("focusWorkspace"),
							}),
							jsx("span", { className: "dp_panelItemDesc", children: t("focusWorkspaceDesc") }),
						] }, "focusWorkspace"),
						jsxs("div", { className: "dp_panelItem", children: [
							jsx(Checkbox, {
								className: "dp_setSwitch",
								checked: panels.rememberView !== false,
								onChange: () => toggle("rememberView"),
								label: t("rememberView"),
							}),
							jsx("span", { className: "dp_panelItemDesc", children: t("rememberViewDesc") }),
						] }, "rememberView"),
					] }),
				] }),
				jsx(QuotaSettingsPanel, { t }),
				jsx(FootSourcePanel, { t }),
				jsx(QuotaQueryPanel, { t }),
				jsxs("div", { className: "dp_setPanel", children: [
					jsx("div", { className: "dp_setSub", children: t("themeTitle") }),
					jsx("span", { className: "dp_setMsg", children: t("themeSub") }),
					jsx(Seg, {
						id: "pulse-theme",
						value: theme,
						options: THEMES.map((key) => ({
							value: key,
							label: key === "blue" ? t("themeBlue")
								: key === "pink" ? t("themePink")
									: key === "orange" ? t("themeOrange") : t("themeBw"),
						})),
						onChange: setTheme,
						label: t("themeLabel"),
					}),
					jsx("span", { className: "dp_setMsg", children: t("themeHint") }),
				] }),
				jsx(PulseCardPanel, { t }),
				jsx(PulseAboutPanel, { t }),
			] });
		}
		//#endregion

