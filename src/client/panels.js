import { useState, useEffect, jsx, jsxs } from "./react.js";
import { DP_BUILD } from "./css.js";
import { THEMES, fetchSettings, fill, invalidateSettings, loadPanels, loadStats, payloadCache, savePanels, setTheme, statsState, useQuota } from "./stores.js";
import { quotaWindowLabel } from "./quota.js";
import { Btn, Checkbox, HoverCardPrim, Input, Seg, TooltipPrim } from "./adapter.js";
import { DEFAULT_USD_TO_CNY } from "./../view.js";
		//#region panels page
		/** Display settings — which observatory panels render, plus the
		 *  sidebar balance toggle. Local preferences only. */
		/** 显示面板清单：8 个开关。费用估算不在列——它由通用设置的
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
		];
		/** Numeric semantic-version compare: `a` newer than `b` → >0. The
		 *  prerelease suffix is ignored, which is what this comparison needs
		 *  (0.5.1 vs a published 0.5.0 / 0.6.0). */
		export function compareVersions(a, b) {
			const parts = (value) => String(value ?? "").split("-")[0].split(".").map((n) => Number(n) || 0);
			const left = parts(a);
			const right = parts(b);
			for (let i = 0; i < 3; i += 1) {
				const diff = (left[i] ?? 0) - (right[i] ?? 0);
				if (diff !== 0) return diff;
			}
			return 0;
		}

		/** settings.section → 设置页的「关于」：版本 + 手动检查更新。
		 *
		 *  One compact line: the running version, the outcome (only after a
		 *  check), and the button. The check is click-only and one-shot — a
		 *  single request to `/pulse/update-check`, which the host answers from
		 *  the npm registry. Nothing runs on mount, nothing polls, and the
		 *  result is one of four states (checking / up to date / newer /
		 *  development build) plus a failure line. */
		export function PulseAboutPanel({ t }) {
			const [state, setState] = useState({ kind: "idle", latest: null, error: null });
			const check = () => {
				setState((s) => ({ ...s, kind: "checking", error: null }));
				fetch("/pulse/update-check", { credentials: "same-origin", headers: { accept: "application/json" } })
					.then(async (res) => {
						const body = await res.json().catch(() => ({}));
						if (!res.ok || body?.ok !== true) throw new Error(body?.error ?? `HTTP ${res.status}`);
						const latest = typeof body.latest === "string" ? body.latest : null;
						const diff = latest === null ? 0 : compareVersions(latest, DP_BUILD);
						setState({ kind: diff > 0 ? "newer" : diff < 0 ? "dev" : "current", latest, error: null });
					})
					.catch((error) => setState({ kind: "error", latest: null, error: String(error?.message ?? error) }));
			};
			const line = state.kind === "checking" ? t("aboutChecking")
				: state.kind === "current" ? t("aboutUpToDate")
					: state.kind === "newer" ? fill(t("aboutNewer"), { v: state.latest ?? "?" })
						: state.kind === "dev" ? fill(t("aboutDev"), { v: state.latest ?? "?" })
							: state.kind === "error" ? fill(t("aboutFailed"), { err: state.error ?? "" }) : null;
			const cls = state.kind === "error" ? "dp_setMsg dp_setMsgErr"
				: state.kind === "newer" ? "dp_setMsg dp_setMsgOk" : "dp_setMsg";
			return jsxs("div", { className: "dp_setPanel", children: [
				jsx("div", { className: "dp_setSub", children: t("aboutTitle") }),
				jsxs("div", { className: "dp_setRow dp_setRowMid", children: [
					jsx("span", { className: "dp_aboutVersion", children: `dsh-pulse ${DP_BUILD}` }),
					line !== null && jsx("span", { className: cls, children: line }),
					jsx(Btn, { fallbackClass: "dp_miniBtn",
						variant: "outline", size: "sm",
						disabled: state.kind === "checking",
						onClick: check,
						children: t("aboutCheck"),
					}),
				] }),
			] });
		}

		/** 设置页的「订阅额度查询」面板：检测到的订阅供应商一行一个（右缘开
		 *  关写 `quotaOff`，与定价编辑器走同一条乐观并发 revision 缝，409 时
		 *  刷新本地副本以便重试）。没有检测到任何供应商时整块隐藏。 */
		export function QuotaSettingsPanel({ t }) {
			const quota = useQuota(true);
			const [state, setState] = useState({ status: "loading", off: [], writable: false, revision: undefined, saving: null, error: null, saved: false });
			useEffect(() => {
				let cancelled = false;
				fetchSettings()
					.then((data) => {
						if (cancelled) return;
						setState((s) => ({
							...s, status: "ready",
							off: Array.isArray(data.quotaOff) ? data.quotaOff : [],
							writable: data.writable === true,
							revision: typeof data.revision === "number" ? data.revision : undefined,
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
						revision: typeof data.revision === "number" ? data.revision : s.revision,
					})))
					.catch(() => { /* the error line already shows the failure */ });
			};
			const toggle = (provider, on) => {
				const next = on ? state.off.filter((id) => id !== provider) : [...new Set([...state.off, provider])];
				setState((s) => ({ ...s, saving: provider, error: null, saved: false }));
				fetch("/pulse/settings", {
					method: "POST", credentials: "same-origin",
					headers: { "content-type": "application/json", accept: "application/json" },
					body: JSON.stringify({ quotaOff: next, revision: state.revision }),
				})
					.then(async (res) => {
						const data = await res.json().catch(() => ({}));
						if (res.status === 409 || data?.conflict !== undefined) {
							setState((s) => ({ ...s, saving: null, error: t("setConflict") }));
							reloadSettings();
							return;
						}
						if (!res.ok || data?.ok !== true) throw new Error(data?.error ?? `HTTP ${res.status}`);
						setState((s) => ({ ...s, saving: null, saved: true, off: next }));
						reloadSettings();
						quota.refresh();
					})
					.catch((error) => setState((s) => ({ ...s, saving: null, error: String(error?.message ?? error) })));
			};
			const entries = (Array.isArray(quota.data?.providers) ? quota.data.providers : [])
				.slice()
				.sort((a, b) => String(a.displayName ?? a.provider).localeCompare(String(b.displayName ?? b.provider)));
			if (entries.length === 0) return null;
			const statusLine = (entry) => (entry.disabled === true ? t("quotaSettingsOff")
				: entry.ok !== true ? (entry.configured === false ? t("quotaNoCred") : fill(t("quotaFailed"), { err: entry.error ?? "?" }))
					: entry.windows?.map((w) => `${quotaWindowLabel(w.id, t)} ${Math.round(w.usedPct ?? 0)}%`).join(" · "));
			return jsxs("div", { className: "dp_setPanel", children: [
				jsx("div", { className: "dp_setSub", children: t("quotaSettingsHint") }),
				jsxs("div", { className: "dp_panelsGrid", children: entries.map((entry) => jsxs("label", { className: "dp_setSwitch", children: [
					jsx("input", {
						type: "checkbox",
						checked: entry.disabled !== true,
						disabled: state.status !== "ready" || !state.writable || state.saving !== null,
						onChange: (e) => toggle(entry.provider, e.target.checked),
					}),
					jsxs("span", { children: [
						entry.plan?.name ?? entry.label ?? entry.displayName ?? entry.provider,
						jsx("span", { className: "dp_qNote", style: { display: "block" }, children: statusLine(entry) }),
					] }),
				] }, entry.provider)) }),
				state.status === "error"
					? jsx("span", { className: "dp_setMsg dp_setMsgErr", children: fill(t("setFailed"), { err: state.error ?? "" }) })
					: state.error !== null
						? jsx("span", { className: "dp_setMsg dp_setMsgErr", children: state.error })
						: state.saved && jsx("span", { className: "dp_setMsg dp_setMsgOk", children: t("setSaved") }),
			] });
		}

		export function PanelsPage({ t, theme, setTheme }) {
			const [panels, setPanels] = useState(loadPanels);
			const [currency, setCurrency] = useState({
				status: "loading", code: "CNY", usdToCny: String(DEFAULT_USD_TO_CNY),
				writable: false, revision: undefined, saving: false, saved: false, error: null,
			});
			const toggle = (key) => setPanels((prev) => {
				const next = { ...prev, [key]: prev[key] === false };
				savePanels(next);
				return next;
			});
			const loadCurrency = () => {
				fetchSettings()
					.then((data) => setCurrency((s) => ({
						...s, status: "ready",
						code: data.currency === "USD" ? "USD" : "CNY",
						usdToCny: String(Number(data.fx?.usdToCny) > 0 ? data.fx.usdToCny : DEFAULT_USD_TO_CNY),
						writable: data.writable === true,
						revision: typeof data.revision === "number" ? data.revision : undefined,
						error: null,
					})))
					.catch((error) => setCurrency((s) => ({ ...s, status: "error", error: String(error?.message ?? error) })));
			};
			useEffect(loadCurrency, []);
			const saveCurrency = () => {
				const fx = Number(currency.usdToCny);
				if (!Number.isFinite(fx) || fx <= 0) {
					setCurrency((s) => ({ ...s, error: t("setBadNumber") }));
					return;
				}
				setCurrency((s) => ({ ...s, saving: true, saved: false, error: null }));
				fetch("/pulse/settings", {
					method: "POST", credentials: "same-origin",
					headers: { "content-type": "application/json", accept: "application/json" },
					body: JSON.stringify({ currency: currency.code, usdToCny: fx, revision: currency.revision }),
				})
					.then(async (res) => {
						const data = await res.json().catch(() => ({}));
						if (res.status === 409 || data?.conflict !== undefined) {
							invalidateSettings();
							loadCurrency();
							throw new Error(t("setConflict"));
						}
						if (!res.ok || data?.ok !== true) throw new Error(data?.error ?? `HTTP ${res.status}`);
						setCurrency((s) => ({ ...s, saving: false, saved: true, error: null }));
						// The dashboard's cached payload prices with the old
						// rules/rate — drop it and reload the current window.
						if (statsState.key !== null) {
							payloadCache.delete(statsState.key);
							loadStats(statsState.from, statsState.to);
						}
						// The shared settings cache carries the old rate too.
						invalidateSettings();
					})
					.catch((error) => setCurrency((s) => ({ ...s, saving: false, error: String(error?.message ?? error) })));
			};
			const curLocked = currency.status !== "ready" || !currency.writable || currency.saving;
			return jsxs("div", { className: "dp_setGrid", children: [
				jsxs("div", { className: "dp_setPanel", children: [
					jsx("div", { className: "dp_setSub", children: t("curHint") }),
					jsxs("div", { className: "dp_setRow dp_setRowMid", children: [
						jsx(Seg, {
							id: "pulse-currency",
							value: currency.code,
							options: [
								{ value: "CNY", label: "CNY", disabled: curLocked },
								{ value: "USD", label: "USD", disabled: curLocked },
							],
							onChange: (code) => setCurrency((s) => ({ ...s, code, saved: false })),
							label: t("currencyLabel"),
						}),
						jsxs("div", { className: "dp_setInline", children: [
							jsx("span", { className: "dp_setLabel", children: `${t("setFxLabel")} 1 USD =` }),
							jsx(Input, {
								className: "dp_setInput dp_setFxInput", inputMode: "decimal",
								value: currency.usdToCny,
								disabled: currency.status !== "ready" || !currency.writable || currency.saving,
								onChange: (e) => setCurrency((s) => ({ ...s, usdToCny: e.target.value, saved: false })),
							}),
						] }),
						jsx(Btn, { fallbackClass: "dp_miniBtn",
							variant: "primary", size: "sm",
							disabled: currency.status !== "ready" || !currency.writable || currency.saving,
							onClick: saveCurrency,
							children: t("setSave"),
						}),
					] }),
					currency.status === "error"
						? jsx("span", { className: "dp_setMsg dp_setMsgErr", children: fill(t("setFailed"), { err: currency.error }) })
						: !currency.writable && currency.status === "ready"
							? jsx("span", { className: "dp_setMsg dp_setMsgErr", children: t("setNotWritable") })
							: currency.saved && jsx("span", { className: "dp_setMsg dp_setMsgOk", children: t("setSaved") }),
				] }),
				jsxs("div", { className: "dp_setPanel", children: [
					jsx("div", { className: "dp_setSub", children: t("panelsSub") }),
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
				jsx(QuotaSettingsPanel, { t }),
				jsxs("div", { className: "dp_setPanel", children: [
					jsx("div", { className: "dp_setSub", children: t("themeSub") }),
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
				jsx(PulseAboutPanel, { t }),
			] });
		}
		//#endregion

