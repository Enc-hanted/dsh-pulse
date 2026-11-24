import { useState, useEffect, useRef, jsx, jsxs } from "./react.js";
import { DP_BUILD } from "./css.js";
import { THEMES, clearViewSnapshot, fetchSettings, fill, invalidateSettings, loadPanels, loadStats, markExplicitClose, payloadCache, payloadError, savePanels, setTheme, statsState, subscribePanels, useQuota, writeSettings } from "./stores.js";
import { quotaWindowLabel } from "./quota.js";
import { Btn, Checkbox, Input, Seg, Tag } from "./adapter.js";
import { DEFAULT_USD_TO_CNY, isOfficialProvider } from "./../view.js";
import { cardDiff } from "../pricing/card.js";
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
		/** Numeric semantic-version compare: `a` newer than `b` → >0. The
		 *  prerelease suffix is ignored, which is what this comparison needs
		 *  (a local build vs the published version). */
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

		/** 设置页「数据包」：运行时覆盖入口，位于版本更新之上。状态行报
	 *  来源/版本/核对日/拉取源；导出当前 active 卡；导入与拉取先过
	 *  validateCard 与变更预览，确认才应用——绝不自动应用；恢复内置
	 *  一键回 seed。应用后清空 payload/settings 缓存并重载当前窗口。 */
	export function PulseCardPanel({ t }) {
		// `armReset` 是「恢复内置」的两步确认（先 arm 再 confirm）：回到内置
		// 卡会丢弃整份运行时卡，不可一键直达——第一次点只进入待确认态，再
		// 点同钮才执行；期间发起导入/拉取/应用即自动解除。
		const [state, setState] = useState({ status: "loading", info: null, preview: null, busy: null, error: null, saved: null, url: "", armReset: false });
		const fileRef = useRef(null);
		const load = () => fetch("/pulse/pricing-card", { credentials: "same-origin", headers: { accept: "application/json" } })
			.then(async (res) => {
				// 非 JSON / 404 = 宿主与前端版本偏斜的典型症状（老宿主以
				// text/plain 答.not found，res.json() 直接抛裸浏览器错误）。
				// 只有能解析出 {ok:false} 的 JSON 才算真正的服务端错误。
				if (res.status === 404) return { skew: true };
				const body = await res.json().catch(() => null);
				if (body === null) return { skew: true };
				payloadError(res, body);
				return body;
			})
			.then((info) => setState((s) => info?.skew === true
				? { ...s, status: "skew", info: null, preview: null, error: null }
				: { ...s, status: "ready", info, error: null }))
			.catch((error) => setState((s) => ({ ...s, status: "error", error: fill(t("cardFailed"), { err: String(error?.message ?? error) }) })));
		useEffect(() => { load(); }, []);
		const afterApply = () => {
			invalidateSettings();
			payloadCache.clear();
			if (statsState.key !== null) loadStats(statsState.from, statsState.to);
			return load();
		};
		const stagePreview = (card, origin) => setState((s) => ({
			// `base` snapshots the card the preview diffs against: the apply
			// echoes it back so the host can refuse a preview that drifted
			// stale while it sat unconfirmed (the apply-flow's concurrency
			// anchor — the preview itself, not a hidden server diff).
			...s, preview: { card, origin, base: s.info?.card ?? null, diff: s.info !== null ? cardDiff(s.info.card, card) : [] }, error: null, saved: null, armReset: false,
		}));
		const applyCandidate = () => {
			const p = state.preview;
			if (p === null) return;
			setState((s) => ({ ...s, busy: "apply", error: null, saved: null, armReset: false }));
			fetch("/pulse/pricing-card", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ card: p.card, origin: p.origin, base: p.base }) })
				.then(async (res) => {
					const body = await res.json();
					// 409 = the active card moved under this preview; nothing was
					// applied. Reload what the panel knows, drop the stale preview,
					// and name the conflict in the user's locale — the message is
					// set AFTER the info reload because load() clears `error` when
					// it lands.
					if (res.status === 409) {
						await afterApply();
						setState((s) => ({ ...s, busy: null, preview: null, error: t("cardConflict") }));
						return null;
					}
					payloadError(res, body);
					return body;
				})
				.then((body) => {
					if (body === null) return;
					setState((s) => ({ ...s, busy: null, preview: null, saved: t("cardSaved") }));
					afterApply();
				})
				.catch((error) => setState((s) => ({ ...s, busy: null, error: fill(t("cardFailed"), { err: String(error?.message ?? error) }) })));
		};
		const onFile = (e) => {
			const file = e.target.files?.[0];
			e.target.value = "";
			if (!file) return;
			file.text().then(async (text) => {
				const parsed = JSON.parse(text);
				const res = await fetch("/pulse/pricing-card/validate", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ card: parsed }) });
				const body = await res.json();
				payloadError(res, body);
				stagePreview(body.card, "imported");
			}).catch((error) => setState((s) => ({ ...s, error: fill(t("cardInvalid"), { err: String(error?.message ?? error) }) })));
		};
		const pull = () => {
			setState((s) => ({ ...s, busy: "pull", error: null, saved: null, armReset: false }));
			fetch("/pulse/pricing-card/pull", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: state.url }) })
				.then(async (res) => { const body = await res.json(); payloadError(res, body); return body; })
				.then((body) => {
					if (body.ok !== true) throw new Error(body.error ?? t("cardPullFailed"));
					stagePreview(body.card, "pulled");
					setState((s) => ({ ...s, busy: null }));
				})
				.catch((error) => setState((s) => ({ ...s, busy: null, error: fill(t("cardFailed"), { err: String(error?.message ?? error) }) })));
		};
		const exportCard = () => {
			if (state.info === null) return;
			const blob = new Blob([JSON.stringify(state.info.card, null, 2)], { type: "application/json" });
			const a = document.createElement("a");
			a.href = URL.createObjectURL(blob);
			a.download = `dsh-pulse-card-v${state.info.card.version}.json`;
			a.click();
			URL.revokeObjectURL(a.href);
		};
		const reset = () => {
			setState((s) => ({ ...s, busy: "reset", error: null, saved: null, armReset: false }));
			fetch("/pulse/pricing-card/reset", { method: "POST", credentials: "same-origin" })
				.then(async (res) => { const body = await res.json(); payloadError(res, body); return body; })
				.then(() => { setState((s) => ({ ...s, busy: null, preview: null, saved: t("cardResetDone") })); afterApply(); })
				.catch((error) => setState((s) => ({ ...s, busy: null, error: fill(t("cardFailed"), { err: String(error?.message ?? error) }) })));
		};
		const info = state.info;
		const originLabel = info === null ? "" : info.origin === "bundled" ? t("cardBundled") : info.origin === "pulled" ? t("cardPulled") : t("cardImported");
		const fmtVal = (v) => v === null ? "−" : typeof v === "object" ? JSON.stringify(v) : String(v);
		const diffRows = state.preview?.diff ?? [];
		const cardBusy = state.busy !== null;
		/** 卡片两行的渲染门：常态（info 就绪）与偏斜降级都渲染——区别只在
		 *  降级态的 — 占位与导出禁用。别把变量名读成「只有降级才渲染」：
		 *  ready 态走到这里是本来面目，不是降级。 */
		const showCardRows = info !== null || state.status === "skew";
		const retryLoad = () => { setState((s) => ({ ...s, status: "loading", error: null })); load(); };
		return jsxs("div", { className: "dp_setPanel", children: [
			jsx("div", { className: "dp_setSub", children: t("cardTitle") }),
			state.status === "loading" && jsx("span", { className: "dp_setMsg", children: t("aboutChecking") }),
			state.status === "skew" && jsxs("div", { className: "dp_setRow dp_setRowMid", children: [
				jsx("span", { className: "dp_setMsg dp_setMsgErr", children: t("cardSkew") }),
				jsx(Btn, { fallbackClass: "dp_miniBtn", variant: "outline", size: "sm", onClick: retryLoad, children: t("retry") }),
			] }),
			showCardRows && jsxs("div", { className: "dp_setRow dp_setRowMid", children: [
				jsxs("span", { className: "dp_setLabel", children: [
					jsx("span", { className: "dp_qNote", children: info === null ? "—" : originLabel }),
					info === null ? " —" : ` ${fill(t("cardVersion"), { v: info.card.version, d: info.card.checkedAt })}`,
				] }),
				jsx(Btn, { fallbackClass: "dp_miniBtn", variant: "outline", size: "sm", disabled: cardBusy || info === null, onClick: exportCard, children: t("cardExport") }),
				jsx(Btn, { fallbackClass: "dp_miniBtn", variant: "outline", size: "sm", disabled: cardBusy, onClick: () => fileRef.current?.click(), children: t("cardImport") }),
				jsx(Btn, { fallbackClass: "dp_miniBtn", variant: "outline", size: "sm", disabled: cardBusy, onClick: pull, children: t("cardPull") }),
				jsx(Btn, {
					fallbackClass: "dp_miniBtn", size: "sm",
					variant: state.armReset ? "primary" : "outline",
					disabled: cardBusy || info?.origin === "bundled",
					onClick: () => (state.armReset ? reset() : setState((s) => ({ ...s, armReset: true, error: null, saved: null }))),
					children: state.armReset ? t("cardResetConfirm") : t("cardReset"),
				}),
				jsx("input", { ref: fileRef, type: "file", accept: ".json,application/json", hidden: true, onChange: onFile }),
			] }),
			showCardRows && jsxs("div", { className: "dp_setRow dp_setRowMid", children: [
				jsx("span", { className: "dp_setLabel", children: t("cardSource") }),
				jsx(Input, { className: "dp_setInput", value: state.url, placeholder: info?.source ?? "—", disabled: cardBusy, onChange: (e) => setState((s) => ({ ...s, url: e.target.value })) }),
			] }),
			state.preview !== null && jsxs("div", { className: "dp_setRow", children: [
				jsx("div", { className: "dp_setSub", children: t("cardPreview") }),
				diffRows.length === 0 && jsx("span", { className: "dp_setMsg", children: t("cardNoChange") }),
				diffRows.slice(0, 40).map((row) => jsx("div", { className: "dp_setMsg", children: `${row.label}: ${fmtVal(row.a)} → ${fmtVal(row.b)}` }, row.label)),
				diffRows.length > 40 && jsx("span", { className: "dp_setMsg", children: fill(t("cardMore"), { n: diffRows.length - 40 }) }),
				jsxs("div", { className: "dp_setRow dp_setRowMid", children: [
					jsx(Btn, { fallbackClass: "dp_miniBtn", variant: "primary", size: "sm", disabled: cardBusy, onClick: applyCandidate, children: t("cardApply") }),
					jsx(Btn, { fallbackClass: "dp_miniBtn", variant: "outline", size: "sm", disabled: cardBusy, onClick: () => setState((s) => ({ ...s, preview: null })), children: t("cardCancel") }),
				] }),
			] }),
			state.error !== null && jsx("span", { className: "dp_setMsg dp_setMsgErr", children: state.error }),
			state.saved !== null && jsx("span", { className: "dp_setMsg dp_setMsgOk", children: state.saved }),
		] });
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
						payloadError(res, body);
						const latest = typeof body.latest === "string" ? body.latest : null;
						const diff = latest === null ? 0 : compareVersions(latest, DP_BUILD);
						const cardNewer = body.remoteCard && body.ratecard && body.remoteCard.version > body.ratecard.version ? body.remoteCard.version : null;
					setState({ kind: diff > 0 ? "newer" : diff < 0 ? "dev" : "current", latest, error: null, cardNewer });
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
					/* The mark is inlined (not an <img>) so its currentColor
					 * strokes follow the theme's label color in every theme. */
					jsxs("svg", { className: "dp_aboutLogo", viewBox: "0 0 512 512", role: "img", "aria-label": "dsh-pulse", children: [
						jsxs("g", { transform: "translate(172.3 97.2) scale(20)", children: jsx("path", { fill: "none", stroke: "currentColor", strokeWidth: "1.1", strokeLinecap: "round", strokeLinejoin: "round",
							d: "M8.844 13.742C8.967 12.328 8.45 10.4 8.45 9.65C8.45 8.94 8.88 8.43 9.6 8.43C11.285 8.43 12.106 8.281 12.685 8.104C13.71 7.791 14.585 6.768 15.055 5.945C15.137 5.803 14.99 5.641 14.829 5.671C13.829 5.86 12.828 5.376 11.827 4.978C10.659 4.514 9.491 4.707 8.935 4.876C8.805 4.915 8.658 4.819 8.636 4.686C8.468 3.643 7.405 2.615 5.498 2.238C4.54 2.048 3.748 1.574 3.347 1.202C3.252 1.113 3.088 1.125 3.03 1.242C2.628 2.059 2.168 3.82 5.248 6.115C5.82 6.494 6.31 6.785 6.574 7.637C6.72 8.104 6.157 9.168 6.061 9.368C5.157 11.27 5.089 12.19 4.926 13.742" }) }),
						jsx("path", { fill: "none", stroke: "currentColor", strokeWidth: "22", strokeLinecap: "round", strokeLinejoin: "round",
							d: "M36 372 H84 C90 354 102 354 108 372 H124 L134 396 L144 372 L158 294 L172 372 L180 396 L188 372 C194 354 206 354 212 372 H367 L379 396 L391 372 C398 354 410 354 416 372 H474" }),
					] }),
					jsx("span", { className: "dp_aboutVersion", children: `dsh-pulse ${DP_BUILD}` }),
					line !== null && jsx("span", { className: cls, children: line }),
					state.cardNewer != null && jsx("span", { className: "dp_setMsg dp_setMsgOk", children: fill(t("aboutNewerCard"), { v: state.cardNewer }) }),
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

		/** 用量/金额查询接口配置：检测到的第三方路由一行一个——内置 spec
		 *  直接试查询；未覆盖的路由展开自定义表单（host/路径/认证/百分比
		 *  别名链/重置字段），试查询返回归一化预览，保存走 settings 缝。
		 *  凭据隐私律不变：probe 的 key 只活在单一出站 Authorization 头。 */
		export function QuotaQueryPanel({ t }) {
			const quota = useQuota(true);
			// `armDelete` 是两步确认的第一步（先 arm 再 confirm）：删除自定义
			// 接口不可一键直达——第一次点只进入待确认态（按钮换文案、变主色），
			// 再点同一路由才真正删除；中途打开草稿或切换路由自动解除。
			const [state, setState] = useState({ status: "loading", specs: {}, builtIn: [], routes: [], writable: false, saving: false, error: null, saved: false, armDelete: null });
			const [drafts, setDrafts] = useState({});
			const [probes, setProbes] = useState({});
			const load = () => fetchSettings()
				.then((data) => setState((s) => ({
					...s, status: "ready",
					specs: data.quotaSpecs !== null && typeof data.quotaSpecs === "object" ? data.quotaSpecs : {},
					builtIn: Array.isArray(data.providerSpecs) ? data.providerSpecs : [],
					routes: (Array.isArray(data.catalog) ? data.catalog : []).map((group) => group.provider).filter((route) => typeof route === "string" && route !== "" && !isOfficialProvider(route)),
					writable: data.writable === true,
				})))
				.catch((error) => setState((s) => ({ ...s, status: "error", error: fill(t("setReadFailed"), { err: String(error?.message ?? error) }) })));
		useEffect(() => { load(); }, []);
			const entries = Array.isArray(quota.data?.providers) ? quota.data.providers : [];
			const routes = [...new Set([...state.routes, ...entries.map((entry) => entry.provider)])];
			if (state.status === "ready" && routes.length === 0) return null;
			const builtInOf = (route) => state.builtIn.find((spec) => (spec.routes ?? []).includes(route));
			const draftOf = (route) => drafts[route] ?? null;
			const openDraft = (route) => {
				const custom = state.specs[route];
				const template = custom ?? builtInOf(route);
				const win = template?.windows?.[0];
				setState((s) => ({ ...s, armDelete: null }));
				setDrafts((d) => ({
					...d,
					[route]: {
						host: template?.hosts?.[0]?.base ?? "https://",
						path: template?.requests?.[0]?.path ?? "/",
						auth: template?.auth === "raw" ? "raw" : "bearer",
						pct: (win?.pct?.aliases ?? []).join(", "),
						reset: (win?.reset?.aliases ?? []).join(", "),
						transform: win?.pct?.transform === "ratio" ? "ratio" : "direct",
					},
				}));
			};
			const specOfDraft = (route, draft) => {
				const pctAliases = draft.pct.split(",").map((s) => s.trim()).filter((s) => s !== "");
				const resetAliases = draft.reset.split(",").map((s) => s.trim()).filter((s) => s !== "");
				return {
					id: `custom-${route}`, label: route, routes: [route], envKeys: [],
					hosts: [{ base: draft.host }], auth: draft.auth,
					requests: [{ id: "quota", path: draft.path }],
					windows: [{
						id: "win", kind: "requests", windowMs: null,
						source: { request: "quota", path: "", mode: "single" },
						...(pctAliases.length > 0 ? { pct: { aliases: pctAliases, transform: draft.transform } } : {}),
						...(resetAliases.length > 0 ? { reset: { aliases: resetAliases } } : {}),
					}],
				};
			};
			const probe = (route) => {
				const draft = draftOf(route);
				const builtIn = builtInOf(route);
				if (draft === null && builtIn === undefined && state.specs[route] === undefined) return;
				// 认领路由永远只送 route——端点自己解析卡 spec，与真实名册
				// 查询同款 strict hostFor（拒绝未声明的 route 变体）。草稿开着
				// 也不例外：草稿/模板副本的显式 spec 会被端点判为 draft 宽松
				// 姿态（hosts[0] 回退），多 host 卡的预览可能谎报成功。显式
				// 形态保留给草稿自身的「假设保存」契约与未被认领的自定义 spec。
				const payload = builtIn !== undefined
					? { route }
					: { route, spec: draft !== null ? specOfDraft(route, draft) : state.specs[route] };
				setProbes((p) => ({ ...p, [route]: { busy: true, result: null, error: null } }));
				fetch("/pulse/quota/probe", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
					.then(async (res) => { const body = await res.json(); payloadError(res, body); return body; })
					.then((body) => setProbes((p) => ({ ...p, [route]: { busy: false, result: body, error: null } })))
					.catch((error) => setProbes((p) => ({ ...p, [route]: { busy: false, result: null, error: String(error?.message ?? error) } })));
			};
			const saveSpec = (route) => {
				const draft = draftOf(route);
				if (draft === null) return;
				// 认领路由上禁存自定义 spec：宿主名册里卡规格先认领、冲突的
				// 自定义被跳过——存了也只是静默不生效。按钮已禁用，这里再挡
				// 一道竞态（草稿打开期间 settings 重载、路由刚被卡认领）。
				if (builtInOf(route) !== undefined) {
					setState((s) => ({ ...s, error: t("queryShadowed") }));
					return;
				}
				const next = { ...state.specs, [route]: specOfDraft(route, draft) };
				setState((s) => ({ ...s, saving: true, error: null, saved: false, armDelete: null }));
				writeSettings({ quotaSpecs: next }, { onConflict: () => { load(); } })
					.then(({ conflict }) => {
						// 二次 409 = 真并发写赢了我们两次：onConflict 已刷新本地
						// 副本，这里必须把冲突如实示人，并压掉上一轮遗留的
						// 「已保存」——乐观的旧成功文案会把一次失败伪装成第
						// 二次成功。（第一次 409 由 writeSettings 自动带新
						// revision 重试，用户无感。）
						if (conflict) { setState((s) => ({ ...s, saving: false, error: t("setConflict"), saved: false })); return; }
						setState((s) => ({ ...s, saving: false, specs: next, saved: true }));
						setDrafts((d) => { const copy = { ...d }; delete copy[route]; return copy; });
						quota.refresh();
					})
					.catch((error) => setState((s) => ({ ...s, saving: false, error: fill(t("setFailed"), { err: String(error?.message ?? error) }) })));
			};
			const deleteSpec = (route) => {
				const next = { ...state.specs };
				delete next[route];
				setState((s) => ({ ...s, saving: true, armDelete: null }));
				writeSettings({ quotaSpecs: next }, { onConflict: () => { load(); } })
					.then(({ conflict }) => {
						if (conflict) { setState((s) => ({ ...s, saving: false, error: t("setConflict"), saved: false })); return; }
						setState((s) => ({ ...s, saving: false, specs: next, saved: true }));
						quota.refresh();
					})
					.catch((error) => setState((s) => ({ ...s, saving: false, error: fill(t("setFailed"), { err: String(error?.message ?? error) }) })));
			};
			const probeLine = (route) => {
				const probeState = probes[route];
				if (probeState === undefined) return null;
				if (probeState.busy) return jsx("span", { className: "dp_setMsg", children: t("queryProbing") });
				// 服务端/网络错误字符串经 locale 包裹，禁止裸浏览器错误上墙。
				if (probeState.error !== null) return jsx("span", { className: "dp_setMsg dp_setMsgErr", children: fill(t("queryFailed"), { err: probeState.error }) });
				const result = probeState.result;
				if (result?.ok !== true) return jsx("span", { className: "dp_setMsg dp_setMsgErr", children: result?.error !== undefined && result?.error !== null ? fill(t("queryFailed"), { err: result.error }) : t("queryPreview") });
				const windows = (result.windows ?? []).map((w) => `${quotaWindowLabel(w.id, t)} ${w.usedPct === null ? "—" : `${Math.round(w.usedPct)}%`}`).join(" · ");
				return jsx("span", { className: "dp_setMsg dp_setMsgOk", children: `${result.plan?.name ?? route} · ${windows || t("queryPreview")}` });
			};
			return jsxs("div", { className: "dp_setPanel", children: [
				jsx("div", { className: "dp_setSub", children: t("queryTitle") }),
				jsx("span", { className: "dp_setMsg", children: t("queryHint") }),
				routes.map((route) => {
					const builtIn = builtInOf(route);
					const custom = state.specs[route];
					const draft = draftOf(route);
					const claimed = builtIn !== undefined;
					const tag = claimed ? t("queryBuiltin") : custom !== undefined ? t("queryCustom") : t("queryNone");
					const entry = entries.find((candidate) => candidate.provider === route);
					return jsxs("div", { className: "dp_queryRow", children: [
						jsxs("div", { className: "dp_setRow dp_setRowMid", children: [
							jsxs("span", { className: "dp_setLabel", children: entry?.plan?.name ?? entry?.displayName ?? route }),
							// 状态徽记而非正文小字：内置=中性、自定义=强调、未配置=描边——
							// 扫一眼分得清这行是谁在管（Tag 官方宿主走 primitive 语气）。
							jsx(Tag, { tone: claimed ? "neutral" : custom !== undefined ? "info" : "outline", fallbackClass: "dp_sessBadge", children: tag }),
							jsx(Btn, { fallbackClass: "dp_miniBtn", variant: "outline", size: "sm", disabled: !claimed && custom === undefined && draft === null, onClick: () => probe(route), children: t("queryProbe") }),
							jsx(Btn, { fallbackClass: "dp_miniBtn", variant: "outline", size: "sm", onClick: () => (draft !== null ? setDrafts((d) => { const copy = { ...d }; delete copy[route]; return copy; }) : openDraft(route)), children: claimed ? t("queryViewBuiltin") : t("queryEdit") }),
							custom !== undefined && jsx(Btn, {
								fallbackClass: "dp_miniBtn", size: "sm",
								variant: state.armDelete === route ? "primary" : "outline",
								disabled: state.saving,
								onClick: () => (state.armDelete === route ? deleteSpec(route) : setState((s) => ({ ...s, armDelete: route, error: null, saved: false }))),
								children: state.armDelete === route ? t("queryDeleteConfirm") : t("queryDeleteSpec"),
							}),
						] }),
						probeLine(route),
						draft !== null && jsxs("div", { className: "dp_queryForm", children: [
							// 遮蔽警告置顶：被认领路由的表单是只读预览——用户不该填完
							// 六个字段才在底部发现「不会生效」。
							claimed && jsx("span", { className: "dp_setMsg dp_setMsgErr", children: t("queryShadowed") }),
							jsxs("div", { className: "dp_setRow dp_setRowMid", children: [
								jsx("span", { className: "dp_setLabel", children: t("queryHost") }),
								jsx(Input, { className: "dp_setInput", value: draft.host, disabled: claimed, onChange: (e) => setDrafts((d) => ({ ...d, [route]: { ...d[route], host: e.target.value } })) }),
							] }),
							jsxs("div", { className: "dp_setRow dp_setRowMid", children: [
								jsx("span", { className: "dp_setLabel", children: t("queryPath") }),
								jsx(Input, { className: "dp_setInput", value: draft.path, disabled: claimed, onChange: (e) => setDrafts((d) => ({ ...d, [route]: { ...d[route], path: e.target.value } })) }),
							] }),
							jsxs("div", { className: "dp_setRow dp_setRowMid", children: [
								jsx("span", { className: "dp_setLabel", children: t("queryAuth") }),
								jsx(Seg, {
									id: `pulse-query-auth-${route}`, value: draft.auth, disabled: claimed,
									options: [{ value: "bearer", label: "Bearer" }, { value: "raw", label: "Raw" }],
									onChange: (auth) => setDrafts((d) => ({ ...d, [route]: { ...d[route], auth } })),
									label: t("queryAuth"),
								}),
								jsx("span", { className: "dp_setLabel", children: t("queryTransform") }),
								jsx(Seg, {
									id: `pulse-query-transform-${route}`, value: draft.transform, disabled: claimed,
									options: [{ value: "direct", label: t("queryTransformDirect") }, { value: "ratio", label: t("queryTransformRatio") }],
									onChange: (transform) => setDrafts((d) => ({ ...d, [route]: { ...d[route], transform } })),
									label: t("queryTransform"),
								}),
							] }),
							jsxs("div", { className: "dp_setRow dp_setRowMid", children: [
								jsx("span", { className: "dp_setLabel", children: t("queryPctAliases") }),
								jsx(Input, { className: "dp_setInput", value: draft.pct, placeholder: "usagePercent, usedPercent, percent", disabled: claimed, onChange: (e) => setDrafts((d) => ({ ...d, [route]: { ...d[route], pct: e.target.value } })) }),
							] }),
							jsxs("div", { className: "dp_setRow dp_setRowMid", children: [
								jsx("span", { className: "dp_setLabel", children: t("queryResetAliases") }),
								jsx(Input, { className: "dp_setInput", value: draft.reset, placeholder: "resetAt, resetsAt", disabled: claimed, onChange: (e) => setDrafts((d) => ({ ...d, [route]: { ...d[route], reset: e.target.value } })) }),
							] }),
							// 试查询只留在表头一行；保存钮只在可写的自定义表单出现
							// （认领路由的预览态没有可保存的东西）。
							!claimed && jsxs("div", { className: "dp_setRow dp_setRowMid", children: [
								// 在途禁用：双击会并发跑两轮 writeSettings（同 intent
								// 良性、但白多两次 POST）。
								jsx(Btn, { fallbackClass: "dp_miniBtn", variant: "primary", size: "sm", disabled: !state.writable || state.saving, onClick: () => saveSpec(route), children: t("querySaveSpec") }),
							] }),
						] }),
					] }, route);
				}),
				state.error !== null && jsx("span", { className: "dp_setMsg dp_setMsgErr", children: state.error }),
				state.saved && jsx("span", { className: "dp_setMsg dp_setMsgOk", children: t("querySaved") }),
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

