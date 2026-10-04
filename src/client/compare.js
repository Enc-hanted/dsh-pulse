import { useState, useEffect, useMemo, useRef, useSyncExternalStore, jsx, jsxs } from "./react.js";
import { resolveRates } from "../view.js";
import { catalogNames, fetchSettings, fill, httpError, loadStats, statsState, subscribeStats } from "./stores.js";
import { quotaEntryName } from "./quota.js";
import { Btn, Input, PillBtn, Seg } from "./adapter.js";
import { DEFAULT_USD_TO_CNY, buildView, fmtCost, localDay, modelKey, niceMax, quotaMonthlyFee, shiftDay } from "./../view.js";
		//#region compare page
		/** Preset usage scenarios (total input in millions, output/input %,
		 *  cache hit %). The real-usage preset is computed from the loaded
		 *  stats window instead of a fixed value. */
		export const COMPARE_PRESETS = {
			avg: { input: 100, ratio: 0.57, hit: 98.9 },
			long: { input: 100, ratio: 1.05, hit: 97.38 },
			massive: { input: 100, ratio: 0.32, hit: 99.48 },
		};
		export const COMPARE_STATE_KEY = "dsh-pulse:compare-state";
		export const clampNum = (v, min, max) => Math.min(max, Math.max(min, v));
		/** One tier's resolved rates for a pricing rule (cache-hit falls back
		 *  to the miss rate; a rule without a `peak` block is flat, so the
		 *  peak tier equals the off-peak one). Mirrors the view model's
		 *  `resolveRates` so the compare page can never disagree with the
		 *  dashboard's cost estimate. */
		export function rateOf(rule, tier) {
			const offInput = Number(rule.input) || 0;
			const offCache = typeof rule.cacheRead === "number" ? rule.cacheRead : offInput;
			const offOutput = Number(rule.output) || 0;
			if (tier !== "peak" || rule.peak === null || typeof rule.peak !== "object") {
				return { miss: offInput, hit: offCache, out: offOutput };
			}
			const peakInput = Number(rule.peak.input) || offInput;
			return {
				miss: peakInput,
				hit: typeof rule.peak.cacheRead === "number" ? rule.peak.cacheRead : peakInput,
				out: Number(rule.peak.output) || offOutput,
			};
		}
		export function loadCompareState() {
			try {
				const raw = localStorage.getItem(COMPARE_STATE_KEY);
				if (raw !== null) {
					const parsed = JSON.parse(raw);
					return {
						visible: parsed !== null && typeof parsed === "object" && parsed.visible !== null && typeof parsed.visible === "object"
							? parsed.visible
							: {},
						manuals: Array.isArray(parsed?.manuals)
							? parsed.manuals
								.filter((m) => m !== null && typeof m === "object" && typeof m.name === "string")
								.map((m) => ({ id: String(m.id), name: m.name, miss: Number(m.miss) || 0, hit: Number(m.hit) || 0, out: Number(m.out) || 0 }))
							: [],
						tiers: parsed !== null && typeof parsed === "object" && parsed.tiers !== null && typeof parsed.tiers === "object"
							? parsed.tiers
							: {},
					};
				}
			} catch (error) { /* private mode or quota — fall through to defaults */ }
			return { visible: {}, manuals: [], tiers: {} };
		}
		export function saveCompareState(state) {
			try { localStorage.setItem(COMPARE_STATE_KEY, JSON.stringify(state)); } catch (error) { /* non-fatal */ }
		}

		/**
		 * Plan compare — the settings section's third-level page. One usage
		 * scenario (total input, output/input ratio, cache hit rate) priced
		 * against rate plans. Plans are the *effective pricing rules* read
		 * through `/pulse/settings` (official defaults merged with the pricing
		 * page's edits), so rate changes show up here automatically; rule rows
		 * cannot be deleted, only hidden. Temporary manual plans can be added
		 * and removed, and live in localStorage alongside the per-plan
		 * visibility toggles. The scenario can be taken from the loaded real
		 * stats window or set by hand.
		 */
		export function ComparePage({ t }) {
			const [settings, setSettings] = useState({ status: "loading", pricing: [], catalog: [], monthly: [], monthlyFee: {}, fx: null, currency: "CNY", error: null });
			const [params, setParams] = useState({ ...COMPARE_PRESETS.avg });
			const [preset, setPreset] = useState("avg");
			const [state, setState] = useState(loadCompareState);
			const stats = useSyncExternalStore(subscribeStats, () => statsState);

			useEffect(() => {
				fetchSettings()
					.then((data) => setSettings({
						status: "ready",
						pricing: Array.isArray(data.pricing) ? data.pricing : [],
						catalog: Array.isArray(data.catalog) ? data.catalog : [],
						monthly: Array.isArray(data.monthly) ? data.monthly : [],
						fx: Number(data.fx?.usdToCny) > 0 ? Number(data.fx.usdToCny) : DEFAULT_USD_TO_CNY,
						currency: data.currency === "USD" ? "USD" : "CNY",
						error: null,
					}))
					.catch((error) => setSettings((s) => ({ ...s, status: "error", error: String(error?.message ?? error) })));
			}, []);
			// Warm the shared store with a 30-day window so the real-usage
			// preset has something to derive from.
			useEffect(() => {
				if (statsState.key === null) {
					const day = localDay(Date.now());
					loadStats(shiftDay(day, -29), day);
				}
			}, []);
			/** 订阅方案（/pulse/quota）：有包月费的订阅以"折合月费"参与对比，
			 *  与按量方案同台——这正是"要不要买 coding plan"的决策视图。拉取
			 *  失败只是没有订阅行，不影响本页其余部分。 */
			const [subs, setSubs] = useState([]);
			useEffect(() => {
				let alive = true;
				fetch("/pulse/quota", { headers: { accept: "application/json" } })
					.then(async (r) => { httpError(r); return r.json(); })
					.then((payload) => {
						if (!alive) return;
						const providers = Array.isArray(payload?.providers) ? payload.providers : [];
						setSubs(providers
							.filter((entry) => entry?.ok === true)
							.map((entry) => ({ entry, fee: quotaMonthlyFee(entry.fee) }))
							.filter((row) => row.fee !== null)
							.map((row) => ({
								key: `sub:${row.entry.provider}`,
								provider: row.entry.provider,
								name: quotaEntryName(row.entry),
								monthly: row.fee.monthly,
								currency: row.fee.currency === "USD" ? "USD" : "CNY",
							})));
					})
					.catch(() => { if (alive) setSubs([]); });
				return () => { alive = false; };
			}, []);

			const patchState = (fn) => setState((prev) => { const next = fn(prev); saveCompareState(next); return next; });

			/** Real-usage scenario over the loaded window. Miss input includes
			 *  cache writes (same convention as the cost estimate), hits are
			 *  cache reads, and the ratio is output over the whole input side. */
			const real = useMemo(() => {
				const data = stats.data;
				if (data === null || !Array.isArray(data.sessions)) return null;
				const totals = buildView(data.sessions, { granularity: "day", from: data.fromDay, to: data.toDay }).totals;
				const side = totals.input + totals.cacheRead + totals.cacheWrite;
				if (!(side > 0)) return null;
				const round3 = (v) => Math.round(v * 1000) / 1000;
				return {
					input: round3(side / 1e6),
					ratio: round3((totals.output / side) * 100),
					hit: round3((totals.cacheRead / side) * 100),
					from: data.fromDay,
					to: data.toDay,
				};
			}, [stats.data]);

			/** 场景默认取真实用量：首次数据就绪时自动应用一次，此后任何手动
			 *  调整（滑杆、预设、手动点真实场景）都不会再被覆盖。 */
			const autoTouched = useRef(false);
			const autoApplied = useRef(false);
			useEffect(() => {
				if (autoTouched.current || autoApplied.current || real === null || settings.status !== "ready") return;
				autoApplied.current = true;
				setParams({
					input: clampNum(real.input, 0.1, 1e9),
					ratio: clampNum(real.ratio, 0, 50),
					hit: clampNum(real.hit, 0, 100),
				});
				setPreset("real");
			}, [real, settings.status]);

			/** Catalog-backed rule labels: the Models page's display name,
			 *  provider-prefixed only when the same name is served by several
			 *  providers. */
			const names = useMemo(() => catalogNames(
				settings.catalog,
				settings.pricing.map((rule) => modelKey(rule.provider ?? "", rule.model)),
			), [settings.catalog, settings.pricing]);

			/** Effective plans: one read-only row per pricing rule (tied to
			 *  the pricing page) plus the temporary manual plans. Each rule
			 *  row prices at its own off-peak/peak tier (rules without a
			 *  `peak` block are flat and carry no switch); manual plans are
			 *  single-tier by definition. Monthly-paid providers have no
			 *  per-token rates, so their rules are no rate plans and sit out. */
			const rows = useMemo(() => {
				const monthlySet = new Set(Array.isArray(settings.monthly) ? settings.monthly : []);
				const ruleRows = settings.pricing
					.filter((rule) => typeof rule?.model === "string" && rule.model !== ""
						&& !monthlySet.has(rule.provider ?? ""))
					.map((rule) => {
						const key = modelKey(rule.provider ?? "", rule.model);
						const hasPeak = rule.peak !== null && typeof rule.peak === "object";
						const rowTier = state.tiers[key] === "peak" ? "peak" : "offpeak";
						const rates = rateOf(rule, rowTier);
						return {
							key: `rule:${key}`,
							origin: "rule",
							id: key,
							model: rule.model,
							provider: rule.provider ?? "",
							name: names.labelOf(rule.provider ?? "", rule.model),
							miss: rates.miss, hit: rates.hit, out: rates.out,
							currency: rule.currency === "USD" ? "USD" : "CNY",
							tier: rowTier, hasPeak,
						};
					});
				const manualRows = state.manuals.map((m) => ({
					key: `manual:${m.id}`,
					origin: "manual",
					id: m.id,
					model: "",
					name: m.name,
					miss: m.miss, hit: m.hit, out: m.out,
					currency: settings.currency === "USD" ? "USD" : "CNY",
				}));
				// 设置页手填的月付金额优先（用户的显式输入）；没手填的订阅用
				// 查询返回的包月费；只出现在设置里的月付供应商也补一行。
				const feeMap = settings.monthlyFee !== null && typeof settings.monthlyFee === "object" ? settings.monthlyFee : {};
				const feeOf = (id) => (Number(feeMap[id]) > 0 ? Number(feeMap[id]) : null);
				const subRows = subs.map((s) => ({
					key: s.key,
					origin: "sub",
					id: s.provider,
					model: "",
					provider: s.provider,
					name: s.name,
					miss: 0, hit: 0, out: 0,
					monthly: feeOf(s.provider) ?? s.monthly,
					currency: s.currency === "USD" ? "USD" : "CNY",
				}));
				const manualSubRows = (Array.isArray(settings.monthly) ? settings.monthly : [])
					.filter((id) => feeOf(id) !== null && !subs.some((s) => s.provider === id))
					.map((id) => ({
						key: `sub:p:${id}`,
						origin: "sub",
						id,
						model: "",
						provider: id,
						name: id,
						miss: 0, hit: 0, out: 0,
						monthly: feeOf(id),
						currency: "CNY",
					}));
				return [...ruleRows, ...subRows, ...manualSubRows, ...manualRows];
			}, [settings.pricing, settings.catalog, settings.currency, settings.monthly, settings.monthlyFee, state.manuals, state.tiers, names, subs]);

			const isVisible = (key) => state.visible[key] !== false;
			const toggleVisible = (key) => patchState((s) => ({ ...s, visible: { ...s.visible, [key]: s.visible[key] === false } }));
			/** Per-rule peak/off-peak display switch — a row-level option, not
			 *  a page-wide one, because manual plans are single-tier. The key
			 *  is the composite model key, so same-named models of different
			 *  providers toggle independently. */
			const toggleTier = (key) => patchState((s) => ({
				...s,
				tiers: { ...s.tiers, [key]: s.tiers[key] === "peak" ? "offpeak" : "peak" },
			}));
			const showAll = () => patchState((s) => {
				const visible = { ...s.visible };
				for (const row of rows) visible[row.key] = true;
				return { ...s, visible };
			});
			const addManual = () => patchState((s) => ({
				...s,
				manuals: [...s.manuals, { id: String(Date.now()), name: `${t("cmpManual")} ${s.manuals.length + 1}`, miss: 1, hit: 0.2, out: 2 }],
			}));
			const patchManual = (id, fn) => patchState((s) => ({
				...s,
				manuals: s.manuals.map((m) => (m.id === id ? fn(m) : m)),
			}));
			const removeManual = (id) => patchState((s) => {
				const visible = { ...s.visible };
				delete visible[`manual:${id}`];
				return { ...s, visible, manuals: s.manuals.filter((m) => m.id !== id) };
			});

			const setParam = (key, value) => { autoTouched.current = true; setParams((p) => ({ ...p, [key]: value })); setPreset(""); };
			const applyReal = () => {
				autoTouched.current = true;
				if (real === null) return;
				setParams({
					input: clampNum(real.input, 0.1, 1e9),
					ratio: clampNum(real.ratio, 0, 50),
					hit: clampNum(real.hit, 0, 100),
				});
				setPreset("real");
			};
			const applyPreset = (key) => { autoTouched.current = true; setParams({ ...COMPARE_PRESETS[key] }); setPreset(key); };

			const { input, ratio, hit } = params;
			const hitM = input * hit / 100;
			const missM = input * (1 - hit / 100);
			const outM = input * ratio / 100;
			const results = rows
				.filter((r) => isVisible(r.key))
				.map((r) => ({
					...r,
					// 订阅行计"折合月费"——不随场景量变化，这正是它与按量
					// 计费的对比点；"最优"徽标只在按量方案之间产生：包月
					// 覆盖面不同，不当场判优。
					cost: r.origin === "sub"
						? r.monthly * (r.currency === "USD" ? settings.fx : 1)
						: (missM * r.miss + hitM * r.hit + outM * r.out) * (r.currency === "USD" ? settings.fx : 1),
				}));
			const perTokenCosts = results.filter((r) => r.origin !== "sub").map((r) => r.cost);
			const bestCost = perTokenCosts.length > 1 ? Math.min(...perTokenCosts) : null;
			const maxCost = niceMax(Math.max(...results.map((r) => r.cost), 1e-6));

			/** Slider + number input bound to one scenario parameter. The
			 *  slider keeps its range cap for granular dragging; the number
			 *  input accepts larger values when `inputMax` is given (the
			 *  slider just pins at its max). */
			const paramControl = (label, key, sliderMin, sliderMax, step, inputMax) => jsxs("div", { className: "dp_cmpControl", children: [
				jsxs("span", { className: "dp_cmpLabel", children: [
					jsx("span", { children: label }),
					jsx("span", { className: "dp_cmpValue", children: String(params[key].toFixed(step >= 1 ? 1 : 2)) }),
				] }),
				jsxs("div", { className: "dp_cmpRow", children: [
					jsx("input", {
						type: "range", className: "dp_cmpRange", min: sliderMin, max: sliderMax, step,
						value: Math.min(params[key], sliderMax),
						onChange: (e) => setParam(key, Number(e.target.value)),
					}),
					jsx("input", {
						type: "number", className: "dp_cmpNum", min: sliderMin,
						...(inputMax !== undefined ? { max: inputMax } : {}),
						step,
						value: params[key].toFixed(step >= 1 ? 1 : 2),
						onChange: (e) => {
							const v = Number(e.target.value);
							if (Number.isFinite(v)) setParam(key, clampNum(v, sliderMin, inputMax ?? sliderMax));
						},
					}),
				] }),
			] });

			const visCheck = (key, label) => jsx("input", {
				type: "checkbox", className: "dp_cmpVis",
				checked: isVisible(key),
				"aria-label": label,
				title: label,
				onChange: () => toggleVisible(key),
			});

			/** Read-only rule row: model id + catalog name, the row's tier
			 *  rates, a per-row peak/off-peak switch (rules with a `peak`
			 *  block only) and the currency. Deletion is not offered — the
			 *  row follows the pricing page. */
			const ruleRow = (r) => {
				const rateField = (label, value) => jsxs("div", { className: "dp_setField", children: [
					jsx("span", { className: "dp_setLabel", children: label }),
					jsx("span", { className: "dp_cmpRate", children: String(value) }),
				] });
				return jsxs("div", { className: "dp_setRow", children: [
					visCheck(r.key, r.name),
					jsxs("div", { className: "dp_setField", children: [
						jsxs("span", { className: "dp_setLabel", children: [
							jsx("span", { className: "dp_cmpRuleTag", children: t("cmpFromRules") }),
						] }),
						jsx("span", { className: "dp_cmpModelName", title: r.model, children: r.name }),
					] }),
					rateField(t("cmpMiss"), r.miss),
					rateField(t("cmpHitIn"), r.hit),
					rateField(t("cmpOut"), r.out),
					r.hasPeak && jsx(PillBtn, {
						active: r.tier === "peak",
						title: t("cmpTierHint"),
						onClick: () => toggleTier(r.id),
						children: r.tier === "peak" ? t("cmpTierPeak") : t("cmpTierOffpeak"),
					}),
				] }, r.key);
			};

			/** Editable manual row: name, three rates, remove. */
			const manualRow = (m) => {
				const field = (label, key) => jsxs("div", { className: "dp_setField", children: [
					jsx("span", { className: "dp_setLabel", children: label }),
					jsx("input", {
						className: "dp_setInput", inputMode: "decimal",
						value: m[key],
						onChange: (e) => patchManual(m.id, (row) => ({ ...row, [key]: Number(e.target.value) || 0 })),
					}),
				] });
				return jsxs("div", { className: "dp_setRow", children: [
					visCheck(`manual:${m.id}`, m.name),
					jsxs("div", { className: "dp_setField dp_setModel", children: [
						jsx("span", { className: "dp_setLabel", children: t("cmpName") }),
						jsx(Input, {
							className: "dp_setInput",
							value: m.name,
							onChange: (e) => patchManual(m.id, (row) => ({ ...row, name: e.target.value })),
						}),
					] }),
					field(t("cmpMiss"), "miss"),
					field(t("cmpHitIn"), "hit"),
					field(t("cmpOut"), "out"),
					jsx("button", {
						type: "button", className: "dp_setRemove",
						onClick: () => removeManual(m.id),
						children: t("setRemove"),
					}),
				] }, `manual:${m.id}`);
			};

			/** One result card: plan name, scenario split, the row's rates
			 *  (with the tier when the rule has one), cost, best badge, bar. */
			const resultCard = (r, i) => {
				const isBest = bestCost !== null && r.cost === bestCost;
				const isSub = r.origin === "sub";
				return jsxs("div", { className: `dp_cmpCard${isBest ? " dp_cmpBest" : ""}`, children: [
					jsxs("div", { className: "dp_cmpCardInfo", children: [
						jsxs("div", { className: "dp_cmpCardHead", children: [
							jsx("span", { className: "dp_cmpCardName", children: r.name }),
							isSub && jsx("span", { className: "dp_cmpBadge", children: t("cmpSubTag") }),
							isBest && jsx("span", { className: "dp_cmpBadge", children: t("cmpBest") }),
						] }),
						jsxs("div", { className: "dp_cmpCardDetail", children: [
							isSub
								? jsx("span", { children: fill(t("cmpSubMonthly"), { v: fmtCost(r.cost) }) })
								: jsx("span", { children: fill(t("cmpDetail"), { hit: hitM.toFixed(1), miss: missM.toFixed(1), out: outM.toFixed(1) }) }),
							isSub
								? jsx("span", { title: t("cmpSubNote"), children: t("cmpSubNote") })
								: jsx("span", { children: `${t("cmpRates")} ${r.miss} / ${r.hit} / ${r.out}${r.origin === "rule" && r.hasPeak ? ` · ${r.tier === "peak" ? t("cmpTierPeak") : t("cmpTierOffpeak")}` : ""}` }),
						] }),
					] }),
					jsxs("div", { className: "dp_cmpCardRight", children: [
						jsxs("div", { className: "dp_cmpCardCost", children: [
							fmtCost(r.cost),
							jsx("small", { children: t("cmpUnit") }),
						] }),
						jsx("div", { className: "dp_cmpBarOuter", children: jsx("div", { className: "dp_cmpBar", style: { width: `${Math.min(100, (r.cost / maxCost) * 100)}%` } }) }),
					] }),
				] }, `${i}:${r.name}`);
			};

			/** 订阅行（只读）：包月折算 + 覆盖范围提示；可隐藏，不参与手编。 */
			const subRow = (r) => jsxs("div", { className: "dp_setRow", children: [
				visCheck(r.key, r.name),
				jsxs("div", { className: "dp_setField", children: [
					jsxs("span", { className: "dp_setLabel", children: [
						jsx("span", { className: "dp_cmpRuleTag", children: t("cmpSubTag") }),
					] }),
					jsx("span", { className: "dp_cmpModelName", children: r.name }),
				] }),
				jsxs("div", { className: "dp_setField", children: [
					jsx("span", { className: "dp_setLabel", children: t("cmpSubTag") }),
					jsx("span", { className: "dp_cmpRate", children: fill(t("cmpSubMonthly"), { v: fmtCost(r.monthly) }) }),
				] }),
			] }, r.key);

			const rowView = (r) => (r.origin === "rule" ? ruleRow(r) : r.origin === "sub" ? subRow(r) : manualRow(r));

			return jsxs("div", { className: "dp_setPanel", children: [
				jsx("div", { className: "dp_setSub", children: t("cmpSub") }),
				jsxs("div", { className: "dp_cmpControls", children: [
					paramControl(t("cmpInput"), "input", 0.1, 1000, 0.1, 1e9),
					paramControl(t("cmpRatio"), "ratio", 0, 50, 0.01),
					paramControl(t("cmpHit"), "hit", 0, 100, 0.01),
				] }),
				jsxs("div", { className: "dp_cmpPresets", children: [
					jsx(Seg, {
						id: "pulse-cmp-preset",
						value: preset,
						options: [
							{ value: "real", label: t("cmpReal"), disabled: real === null },
							{ value: "avg", label: t("cmpAvg") },
							{ value: "long", label: t("cmpLong") },
							{ value: "massive", label: t("cmpMassive") },
						],
						onChange: (key) => (key === "real" ? applyReal() : applyPreset(key)),
						label: t("cmpPresetLabel"),
					}),
					real === null
						? jsx("span", { className: "dp_costNote", children: t("cmpNoData") })
						: preset === "real" && jsx("span", { className: "dp_costNote", children: fill(t("cmpBased"), { from: real.from, to: real.to }) }),
				] }),
				jsxs("div", { className: "dp_setGrid", children: [
					settings.status === "loading"
						? jsx("span", { className: "dp_costNote", children: t("setLoading") })
						: settings.status === "error"
							? jsx("span", { className: "dp_setMsg dp_setMsgErr", children: fill(t("setFailed"), { err: settings.error }) })
							: rows.map(rowView),
					jsxs("div", { className: "dp_setActions", children: [
						jsx(Btn, { fallbackClass: "dp_miniBtn", variant: "outline", size: "sm", onClick: addManual, children: t("cmpAdd") }),
						jsx("button", { type: "button", className: "dp_setLink", onClick: showAll, children: t("cmpShowAll") }),
						jsx("span", { className: "dp_costNote", children: t("cmpHint") }),
					] }),
				] }),
				results.length > 0
					? jsxs("div", { className: "dp_cmpCards", children: results.map(resultCard) })
					: jsx("span", { className: "dp_costNote", children: t("cmpEmpty") }),
			] });
		}
		//#endregion

