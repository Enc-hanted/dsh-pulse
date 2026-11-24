import { useState, useEffect, jsx, jsxs } from "./react.js";
import { fetchSettings, fill, payloadError, useQuota, writeSettings } from "./stores.js";
import { quotaWindowLabel } from "./quota.js";
import { Btn, Input, Seg, Tag } from "./adapter.js";
import { isOfficialProvider } from "./../view.js";
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
