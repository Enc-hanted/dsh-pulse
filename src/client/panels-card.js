import { useState, useEffect, useRef, jsx, jsxs } from "./react.js";
import { DP_BUILD } from "./css.js";
import { fill, invalidateSettings, loadStats, payloadCache, payloadError, statsState } from "./stores.js";
import { Btn, Checkbox, Input } from "./adapter.js";
import { cardDiff, credentialRoutingDiff } from "../pricing/card.js";
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
			// `ackRouting` 是凭据去向确认：预览里出现 routes / hosts / auth / envKeys 的
		// 变化时，「应用」要等用户勾选核对后才可用；每次新预览、取消、应用后都清零。
		const [state, setState] = useState({ status: "loading", info: null, preview: null, busy: null, error: null, saved: null, url: "", armReset: false, ackRouting: false });
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
			// `routing` 是 diff 里决定凭据去向的那部分行（与宿主守卫同一个
			// 分类器）：预览把它们单独列出来，未勾选确认就不能应用。
			...s, preview: { card, origin, base: s.info?.card ?? null, diff: s.info !== null ? cardDiff(s.info.card, card) : [], routing: s.info !== null ? credentialRoutingDiff(s.info.card, card) : [] }, error: null, saved: null, armReset: false, ackRouting: false,
		}));
		const applyCandidate = () => {
			const p = state.preview;
			if (p === null) return;
			// 勾选只在 routing 非空时有意义；宿主守卫按 routing 非空判定，所以
			// ackCredentials 也只在 routing 非空且已勾选时随请求发送。
			const needsAck = (p.routing?.length ?? 0) > 0;
			if (needsAck && state.ackRouting !== true) return;
			setState((s) => ({ ...s, busy: "apply", error: null, saved: null, armReset: false }));
			fetch("/pulse/pricing-card", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ card: p.card, origin: p.origin, base: p.base, ...(needsAck ? { ackCredentials: true } : {}) }) })
				.then(async (res) => {
					const body = await res.json();
					// 409 = the active card moved under this preview; nothing was
					// applied. Reload what the panel knows, drop the stale preview,
					// and name the conflict in the user's locale — the message is
					// set AFTER the info reload because load() clears `error` when
					// it lands.
					if (res.status === 409) {
						await afterApply();
						setState((s) => ({ ...s, busy: null, preview: null, ackRouting: false, error: t("cardConflict") }));
						return null;
					}
					// 422 = 宿主的凭据去向守卫：这张卡改了 routes / hosts / auth /
					// envKeys 而请求没带确认，什么都没应用。与 409 同样先重载再
					// 报错并丢弃预览，用户需重新预览、逐行核对后勾选。
					if (res.status === 422) {
						const n = Array.isArray(body?.changes) ? body.changes.length : 0;
						await afterApply();
						setState((s) => ({ ...s, busy: null, preview: null, ackRouting: false, error: fill(t("cardRoutingRefused"), { n }) }));
						return null;
					}
					payloadError(res, body);
					return body;
				})
				.then((body) => {
					if (body === null) return;
					setState((s) => ({ ...s, busy: null, preview: null, ackRouting: false, saved: t("cardSaved") }));
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
		const resetCard = () => {
			setState((s) => ({ ...s, busy: "reset", error: null, saved: null, armReset: false }));
			fetch("/pulse/pricing-card/reset", { method: "POST", credentials: "same-origin" })
				.then(async (res) => { const body = await res.json(); payloadError(res, body); return body; })
				.then(() => { setState((s) => ({ ...s, busy: null, preview: null, ackRouting: false, saved: t("cardResetDone") })); afterApply(); })
				.catch((error) => setState((s) => ({ ...s, busy: null, error: fill(t("cardFailed"), { err: String(error?.message ?? error) }) })));
		};
		const info = state.info;
		const originLabel = info === null ? "" : info.origin === "bundled" ? t("cardBundled") : info.origin === "pulled" ? t("cardPulled") : t("cardImported");
		const fmtVal = (v) => v === null ? "−" : typeof v === "object" ? JSON.stringify(v) : String(v);
		const diffRows = state.preview?.diff ?? [];
		const routingRows = state.preview?.routing ?? [];
		const cardBusy = state.busy !== null;
		// 凭据去向有变化且未勾选：「应用」禁用（onClick 里还会再拦一次）。
		const applyLocked = routingRows.length > 0 && state.ackRouting !== true;
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
					onClick: () => (state.armReset ? resetCard() : setState((s) => ({ ...s, armReset: true, error: null, saved: null }))),
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
			// 凭据去向变化单独成块，排在普通 diff 之前，且不受 40 行截断。
			routingRows.length > 0 && jsxs("div", { className: "dp_setRouting", children: [
				jsx("div", { className: "dp_setSub dp_setMsgWarn", children: t("cardRoutingTitle") }),
				jsx("span", { className: "dp_setMsg dp_setMsgWarn", children: t("cardRoutingNote") }),
				...routingRows.map((row) => jsx("div", { className: "dp_setMsg dp_setMsgWarn", children: `${row.label}: ${fmtVal(row.a)} → ${fmtVal(row.b)}` }, row.label)),
				jsx(Checkbox, { checked: state.ackRouting, disabled: cardBusy, onChange: (checked) => setState((s) => ({ ...s, ackRouting: checked === true })), label: t("cardRoutingAck") }),
			] }),
				diffRows.length === 0 && jsx("span", { className: "dp_setMsg", children: t("cardNoChange") }),
				diffRows.slice(0, 40).map((row) => jsx("div", { className: "dp_setMsg", children: `${row.label}: ${fmtVal(row.a)} → ${fmtVal(row.b)}` }, row.label)),
				diffRows.length > 40 && jsx("span", { className: "dp_setMsg", children: fill(t("cardMore"), { n: diffRows.length - 40 }) }),
				jsxs("div", { className: "dp_setRow dp_setRowMid", children: [
					jsx(Btn, { fallbackClass: "dp_miniBtn", variant: "primary", size: "sm", disabled: cardBusy || applyLocked, onClick: applyCandidate, children: t("cardApply") }),
					jsx(Btn, { fallbackClass: "dp_miniBtn", variant: "outline", size: "sm", disabled: cardBusy, onClick: () => setState((s) => ({ ...s, preview: null, ackRouting: false })), children: t("cardCancel") }),
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
