import { useState, useEffect, useMemo, useSyncExternalStore, jsx, jsxs } from "./react.js";
import { fetchSettings, fill, invalidateSettings, loadStats, payloadCache, payloadError, statsState, subscribeStats } from "./stores.js";
import { Btn, Input, PillBtn } from "./adapter.js";
import { DEFAULT_USD_TO_CNY, accentEntryOf, buildView, daysBetween, familyRouteOf, fmtCost, localDay, modelAccentMap, modelKey, providerLabelOf, shiftDay } from "./../view.js";
		//#region settings page
		/** Official default peak hours (Beijing time) — the editor's fallback
		 *  display and the save-side default for rows without a custom window. */
		export const OFFICIAL_PEAK_HOURS = [9, 10, 11, 14, 15, 16, 17];

		/**
		 * Build the editor's row list from the model catalog ONLY (the Models
		 * settings page, served through `GET /pulse/settings`'s `catalog`) —
		 * no manual add or delete: rows mirror the configured models
		 * one-for-one. Each row's rates resolve through the same
		 * provider-aware lookup as pricing: an exact `provider\u0000model`
		 * rule wins, a provider-less (wildcard) rule fills the official
		 * defaults in. Rows start clean (`dirty: false`) and only edited
		 * rows are persisted on save.
		 */
		export function buildEditorRows(data) {
			const exact = new Map();
			const wild = new Map();
			for (const rule of Array.isArray(data.pricing) ? data.pricing : []) {
				if (typeof rule?.model !== "string" || rule.model === "") continue;
				const provider = typeof rule.provider === "string" && rule.provider.length > 0 ? rule.provider : "";
				if (provider === "") wild.set(rule.model, rule);
				else exact.set(modelKey(provider, rule.model), rule);
			}
			const ruleFor = (provider, model) => exact.get(modelKey(provider, model)) ?? wild.get(model);
			const rows = [];
			for (const groupEntry of Array.isArray(data.catalog) ? data.catalog : []) {
				const provider = groupEntry.provider ?? "";
				const family = familyRouteOf(provider);
				// A provider family bills as ONE source: its routes share a single
				// row whose rate is the provider-less (wildcard) rule — exactly
				// the shape that covers every route of that model, and the shape
				// `buildRows` writes back for a row with no provider.
				const identity = family === null ? provider : "";
				const group = providerLabelOf(provider, groupEntry.displayName ?? provider);
				for (const model of Array.isArray(groupEntry.models) ? groupEntry.models : []) {
					if (typeof model?.id !== "string" || model.id === "") continue;
					const key = modelKey(identity, model.id);
					if (rows.some((row) => row.key === key)) continue;
					const exact = family === null ? undefined : family.routes.map((route) => ruleFor(route, model.id)).find((hit) => hit !== undefined);
					const rule = exact ?? ruleFor(identity, model.id) ?? {};
					rows.push({
						key,
						provider: identity, model: model.id,
						routes: family === null ? [provider] : [...family.routes],
						name: model.name ?? "",
						group,
						origin: "catalog",
						input: rule.input ?? "", cacheRead: rule.cacheRead ?? "", output: rule.output ?? "",
						currency: rule.currency === "USD" ? "USD" : "CNY",
						peak: {
							input: rule.peak?.input ?? "", cacheRead: rule.peak?.cacheRead ?? "", output: rule.peak?.output ?? "",
						},
						peakHours: Array.isArray(rule.peakHours) ? [...rule.peakHours] : null,
						expanded: rule.peak !== null && typeof rule.peak === "object",
						dirty: false,
					});
				}
			}
			return rows;
		}

		/** Re-apply a fresh server row list over the locally edited one: edited
		 *  rates, currency, peak blocks and windows (and the dirty flag) survive
		 *  a catalog refresh; identity fields always come from the fresh list. */
		export function mergeRows(fresh, edited) {
			const byKey = new Map(edited.map((row) => [row.key, row]));
			return fresh.map((row) => {
				const prev = byKey.get(row.key);
				if (prev === undefined) return row;
				return {
					...row,
					input: prev.input, cacheRead: prev.cacheRead, output: prev.output,
					currency: prev.currency, peak: prev.peak, peakHours: prev.peakHours,
					expanded: prev.expanded, dirty: prev.dirty === true,
				};
			});
		}

		/** Numeric-field cleaner: ""/null → undefined, finite → number, else NaN. */
		export function cleanNum(value) {
			if (value === "" || value === null || value === undefined) return undefined;
			const n = Number(value);
			return Number.isFinite(n) ? n : NaN;
		}

		/**
		 * Pricing & cost editor — the settings section's second-level page.
		 * Reads `/pulse/settings` (effective rules, USD→CNY rate, the model
		 * catalog, the official baseline, the monthly-paid provider list and
		 * writability) and edits the catalog rows locally. Rows mirror the
		 * configured models one-for-one — no manual add or delete. Only
		 * edited (dirty) rows are persisted as explicit provider-scoped
		 * rules; untouched rows keep inheriting the official wildcard
		 * defaults, so official rate updates reach them automatically.
		 * A per-provider 月付费 toggle marks a whole provider as a flat
		 * monthly subscription: its models need no rates and price at zero
		 * marginal cost. After a save the shared stats store reloads so
		 * every dashboard surface reflects the new prices at once; when the
		 * saved section changed a model's peak hours the reply says so and
		 * the host re-folds history in the background.
		 */
		export function PricingPage({ t }) {
			const [state, setState] = useState({
				status: "loading", costEnabled: true, usdToCny: String(DEFAULT_USD_TO_CNY),
				rows: [], official: [], monthly: [], monthlyFee: {}, modelColors: {}, pricingDirty: false, writable: false, hasCatalog: false,
				revision: undefined, saving: false, saved: false, refold: false, error: null,
			});
			const stats = useSyncExternalStore(subscribeStats, () => statsState);
			const load = () => {
				fetchSettings()
					.then((data) => setState((s) => ({
						...s, status: "ready",
						costEnabled: data.costEnabled !== false,
						usdToCny: String(Number(data.fx?.usdToCny) > 0 ? data.fx.usdToCny : DEFAULT_USD_TO_CNY),
						rows: s.status === "ready" ? mergeRows(buildEditorRows(data), s.rows) : buildEditorRows(data),
						official: Array.isArray(data.official) ? data.official : [],
						monthly: Array.isArray(data.monthly) ? [...data.monthly] : [],
						monthlyFee: data.monthlyFee !== null && typeof data.monthlyFee === "object" ? { ...data.monthlyFee } : {},
						modelColors: data.modelColors !== null && typeof data.modelColors === "object" ? data.modelColors : {},
						hasCatalog: (Array.isArray(data.catalog) ? data.catalog : []).some((group) => (group.models ?? []).length > 0),
						writable: data.writable === true,
						revision: typeof data.revision === "number" ? data.revision : undefined,
						error: null,
					})))
					.catch((error) => setState((s) => ({ ...s, status: "error", error: String(error?.message ?? error) })));
			};
			// Warm the shared store with a 90-day window so the live preview
			// has a corpus to re-price; then load settings once data (or a
			// definitive error) exists.
			useEffect(() => {
				if (statsState.key === null) {
					const day = localDay(Date.now());
					loadStats(shiftDay(day, -89), day);
				}
			}, []);
			useEffect(() => {
				if ((stats.data !== null || stats.status === "error") && state.status === "loading") load();
			}, [stats.data, stats.status, state.status]);

			/** Row-level pricing edit: marks the row dirty AND the pricing
			 *  section dirty (so a save sends the full intended pricing list,
			 *  replacing prior overrides — a monthly-only save without pricing
			 *  edits must not touch the pricing field). */
			const patchRow = (i, fn) => setState((s) => ({
				...s, saved: false, refold: false, pricingDirty: true,
				rows: s.rows.map((row, j) => (j === i ? fn(row) : row)),
			}));
			const patch = (i, key, value) => patchRow(i, (row) => ({ ...row, [key]: value, dirty: true }));
			const patchPeak = (i, key, value) => patchRow(i, (row) => ({ ...row, peak: { ...row.peak, [key]: value }, dirty: true }));
			/** First click on a default (official) strip starts from the
			 *  official set so the edit is "change one hour", not "clear all";
			 *  deselecting every hour is meaningful — explicit flat pricing. */
			const toggleHour = (i, hour) => patchRow(i, (row) => {
				const base = row.peakHours ?? [...OFFICIAL_PEAK_HOURS];
				const next = base.includes(hour) ? base.filter((h) => h !== hour) : [...base, hour].sort((a, b) => a - b);
				return { ...row, peakHours: next, dirty: true };
			});
			/** Per-provider 月付费 toggle: a flat monthly subscription — the
			 *  provider's models need no rates and price at zero. Edited rates
			 *  stay on the rows (inert while monthly, active again if the
			 *  toggle is turned off), so no data is lost either way. */
			const toggleMonthly = (provider) => setState((s) => ({
				...s, saved: false,
				monthly: s.monthly.includes(provider)
					? s.monthly.filter((id) => id !== provider)
					: [...s.monthly, provider],
			}));
			/** 月付金额（CNY/月）：跟在月付费开关后面的数字，仅作展示与方案
			 *  对比，不影响按量成本估算（包月模型按 0 边际计）。输入暂存原始
			 *  字符串，保存时清洗为正数。 */
			const patchFee = (provider, value) => setState((s) => ({
				...s, saved: false,
				monthlyFee: { ...s.monthlyFee, [provider]: value },
			}));
			const cleanFees = () => {
				const out = {};
				for (const [id, v] of Object.entries(state.monthlyFee ?? {})) {
					const n = Number(v);
					if (Number.isFinite(n) && n > 0) out[id] = Math.round(n * 100) / 100;
				}
				return out;
			};
			/** Per-row "restore official rates" (official models only): reset
			 *  every editable field to the untouched official baseline and
			 *  clear the dirty flag, so the row re-inherits the wildcard
			 *  official defaults on the next save. */
			const officialMap = useMemo(() => new Map(state.official.map((rule) => [rule.model, rule])), [state.official]);
			const restoreOfficial = (i) => patchRow(i, (row) => {
				const rule = officialMap.get(row.model);
				if (rule === undefined) return row;
				return {
					...row,
					input: rule.input ?? "", cacheRead: rule.cacheRead ?? "", output: rule.output ?? "",
					currency: rule.currency === "USD" ? "USD" : "CNY",
					peak: {
						input: rule.peak?.input ?? "", cacheRead: rule.peak?.cacheRead ?? "", output: rule.peak?.output ?? "",
					},
					peakHours: null,
					expanded: rule.peak !== null && typeof rule.peak === "object",
					dirty: false,
				};
			});

			/** Persisted rules from the local rows: only EDITED (dirty) rows
			 *  with at least one finite rate and a non-empty model id survive.
			 *  Rows carry their provider (catalog identity), so overrides are
			 *  provider-scoped and untouched rows keep the wildcard defaults. */
			const buildRows = () => state.rows
				.filter((row) => row.dirty === true)
				.map((row) => {
					const model = String(row.model ?? "").trim();
					const provider = typeof row.provider === "string" && row.provider !== "" ? row.provider : "";
					const input = cleanNum(row.input);
					const cacheRead = cleanNum(row.cacheRead);
					const output = cleanNum(row.output);
					const pi = cleanNum(row.peak?.input);
					const pc = cleanNum(row.peak?.cacheRead);
					const po = cleanNum(row.peak?.output);
					if (model === "") return null;
					if (![input, cacheRead, output, pi, pc, po].some((v) => typeof v === "number" && Number.isFinite(v))) return null;
					const out = { model };
					if (provider !== "") out.provider = provider;
					if (input !== undefined) out.input = input;
					if (cacheRead !== undefined) out.cacheRead = cacheRead;
					if (output !== undefined) out.output = output;
					if (pi !== undefined || pc !== undefined || po !== undefined) {
						out.peak = {};
						if (pi !== undefined) out.peak.input = pi;
						if (pc !== undefined) out.peak.cacheRead = pc;
						if (po !== undefined) out.peak.output = po;
					}
					if (Array.isArray(row.peakHours)) out.peakHours = row.peakHours;
					return out;
				})
				.filter((row) => row !== null);
			const fxNumber = () => cleanNum(state.usdToCny);

			/** Live preview: the loaded stats window priced with the effective
			 *  server rules (official defaults + persisted overrides) and the
			 *  local (unsaved) dirty edits and monthly list on top, through the
			 *  same pure view model the dashboard uses — so the number can
			 *  never disagree with it. */
			const preview = useMemo(() => {
				const data = stats.data;
				if (data === null || state.status !== "ready") return null;
				const fx = fxNumber();
				if (typeof fx !== "number" || !Number.isFinite(fx) || fx <= 0) return null;
				const rules = new Map();
				for (const rule of Array.isArray(data.pricing) ? data.pricing : []) {
					if (typeof rule?.model !== "string" || rule.model === "") continue;
					rules.set(modelKey(rule.provider ?? "", rule.model), rule);
				}
				for (const row of buildRows()) {
					rules.set(modelKey(row.provider ?? "", row.model), row);
				}
				return buildView(data.sessions, {
					granularity: "day", from: data.fromDay, to: data.toDay,
					pricing: [...rules.values()], fx: { usdToCny: fx }, monthly: state.monthly,
					auxShape: data.auxShape ?? null,
				}).cost;
			}, [stats.data, state.rows, state.usdToCny, state.monthly, state.status]);

			const persist = (payload) => {
				setState((s) => ({ ...s, saving: true, saved: false, refold: false, error: null }));
				fetch("/pulse/settings", {
					method: "POST",
					credentials: "same-origin",
					headers: { "content-type": "application/json", accept: "application/json" },
					// The revision observed at read time: a revisioned host (0.1.7+)
					// refuses the write when the section moved underneath us.
					body: JSON.stringify({ ...payload, revision: state.revision }),
				})
					.then(async (res) => {
						const data = await res.json().catch(() => ({}));
						if (res.status === 409 || data?.conflict !== undefined) {
							// Another surface won the race. Drop the shared settings
							// cache so the reload observes the fresh revision, and
							// refresh the local copy for a clean retry.
							invalidateSettings();
							load();
							throw new Error(t("setConflict"));
						}
						payloadError(res, data);
						setState((s) => ({
							...s, saving: false, saved: true, refold: data?.refold === true, error: null,
							// Only the sections this save carried are persisted — a
							// colors-only write must not drop unsaved pricing edits.
							pricingDirty: payload.pricing !== undefined ? false : s.pricingDirty,
							rows: payload.pricing !== undefined
								? s.rows.map((row) => ({ ...row, dirty: false }))
								: s.rows,
						}));
						// The dashboard's cached payload is stale now — drop it and
						// reload the current window so the new prices show at once.
						if (statsState.key !== null) {
							payloadCache.delete(statsState.key);
							loadStats(statsState.from, statsState.to);
						}
						// The shared settings cache is stale too — invalidate so the
						// next read (and this one) reflects the persisted section.
						invalidateSettings();
						load();
					})
					.catch((error) => setState((s) => ({ ...s, saving: false, error: String(error?.message ?? error) })));
			};
			const save = () => {
				const rows = buildRows();
				const ids = rows.map((row) => modelKey(row.provider ?? "", row.model));
				if (ids.some((id, i) => ids.indexOf(id) !== i)) {
					setState((s) => ({ ...s, error: t("setDupModel") }));
					return;
				}
				const bad = rows.some((row) => [row.input, row.cacheRead, row.output, row.peak?.input, row.peak?.cacheRead, row.peak?.output]
					.some((v) => typeof v === "number" && !Number.isFinite(v)));
				const fx = fxNumber();
				if (bad || typeof fx !== "number" || !Number.isFinite(fx) || fx <= 0) {
					setState((s) => ({ ...s, error: t("setBadNumber") }));
					return;
				}
				// Send the pricing list only when pricing was touched: it
				// replaces the prior overrides wholesale, so a monthly-only
				// save must not clobber the user's rates.
				const payload = { costEnabled: state.costEnabled === true, monthly: state.monthly, monthlyFee: cleanFees() };
				if (state.pricingDirty === true) payload.pricing = rows;
				persist(payload);
			};
			const reset = () => persist({ reset: true });
			/** 模型配色 card: instant-write per pick. '' / delete restores the
			 *  automatic vendor or hue assignment; the server sanitizes the
			 *  map, and the payload reload re-colors the dashboard at once. */
			const setAccent = (model, hex) => {
				const next = { ...(state.modelColors ?? {}) };
				const clean = String(hex ?? "").trim().toLowerCase();
				if (clean === "") delete next[model];
				else next[model] = clean;
				setState((s) => ({ ...s, modelColors: next, saved: false }));
				persist({ modelColors: next });
			};
			const resetAccents = () => {
				setState((s) => ({ ...s, modelColors: {}, saved: false }));
				persist({ modelColors: {} });
			};
			/** Catalog identity rows deduped by model id, in catalog order —
			 *  the card's coloring targets, each with a live auto-preview dot
			 *  (equal token counts keep the map in catalog order). */
			const accentRows = [];
			const accentSeen = new Set();
			for (const row of state.rows) {
				if (typeof row.model !== "string" || row.model === "" || accentSeen.has(row.model)) continue;
				accentSeen.add(row.model);
				accentRows.push(row);
			}
			const accentPreview = modelAccentMap(
				accentRows.map((row) => ({ model: row.model, provider: row.provider ?? "" })),
				state.modelColors,
			);
			const setField = (label, value, onChange) => jsxs("div", { className: "dp_setField", key: label, children: [
				jsx("span", { className: "dp_setLabel", children: label }),
				jsx(Input, {
					className: "dp_setInput", inputMode: "decimal",
					value: value === undefined || value === null ? "" : String(value),
					disabled: !state.writable || state.saving,
					onChange: (e) => onChange(e.target.value),
				}),
			] });

			/** One catalog row: model id + name, three off-peak rates in a
			 *  fixed three-column grid, the peak-toggle, and (when expanded)
			 *  the peak rates plus the 24-hour strip. Rows are read-only in
			 *  identity — no manual add or delete. A provider marked 月付费
			 *  skips all rate fields and shows a flat-subscription note. */
			const rowView = (row, i) => {
				const monthly = state.monthly.includes(row.provider);
				const disabled = !state.writable || state.saving;
				const identity = jsxs("div", { className: "dp_setModelInfo", children: [
					jsx("span", { className: "dp_modelId", title: row.model, children: row.model }),
					jsxs("span", { className: "dp_modelName", children: [
						row.name !== "" ? row.name : null,
						row.name !== "" && officialMap.has(row.model) ? " · " : null,
						officialMap.has(row.model)
							? jsx("button", {
								type: "button", className: "dp_setLink",
								disabled,
								onClick: () => restoreOfficial(i),
								children: t("setOfficialReset"),
							})
							: null,
					] }),
				] });
				if (monthly) {
					return jsxs("div", { className: "dp_setRow dp_priceRow dp_priceMonthlyRow", children: [
						identity,
						jsx("span", { className: "dp_priceMonthly", children: t("setMonthly") }),
					] }, `${row.origin}:${row.key}:${i}`);
				}
				return jsxs("div", { children: [
					jsxs("div", { className: "dp_setRow dp_priceRow", children: [
						identity,
						jsxs("div", { className: "dp_priceFields", children: [
							setField(t("setInput"), row.input, (v) => patch(i, "input", v)),
							setField(t("setCache"), row.cacheRead, (v) => patch(i, "cacheRead", v)),
							setField(t("setOutput"), row.output, (v) => patch(i, "output", v)),
						] }),
						jsx(PillBtn, {
							active: row.expanded,
							"aria-expanded": row.expanded,
							disabled,
							onClick: () => patch(i, "expanded", !row.expanded),
							children: t("setPeakToggle"),
						}),
					] }),
					row.expanded && jsxs("div", { className: "dp_peakSub", children: [
						jsxs("div", { className: "dp_priceFields", children: [
							setField(t("setPeakIn"), row.peak?.input, (v) => patchPeak(i, "input", v)),
							setField(t("setPeakCache"), row.peak?.cacheRead, (v) => patchPeak(i, "cacheRead", v)),
							setField(t("setPeakOut"), row.peak?.output, (v) => patchPeak(i, "output", v)),
						] }),
						jsxs("div", { className: "dp_setField", children: [
							jsxs("span", { className: "dp_setLabel dp_setLabelGap", children: [
								`${t("setPeakHours")} `,
								jsx("button", {
									type: "button", className: "dp_setLink",
									disabled,
									onClick: () => patch(i, "peakHours", null),
									children: t("setPeakReset"),
								}),
							] }),
							jsxs("div", { className: "dp_peakGrid", role: "group", "aria-label": t("setPeakHours"), children: [
								Array.from({ length: 24 }, (_, h) => {
									const on = (row.peakHours ?? OFFICIAL_PEAK_HOURS).includes(h);
									return jsx("button", {
										type: "button",
										className: `dp_hourCell${on ? " dp_hourCellOn" : ""}`,
										"aria-pressed": on,
										disabled,
										onClick: () => toggleHour(i, h),
										children: String(h).padStart(2, "0"),
									}, h);
								}),
							] }),
						] }),
					] }),
				] }, `${row.origin}:${row.key}:${i}`);
			};

			/** Provider group header (with the 月付费 toggle) interleaved with
			 *  its catalog rows — one group per provider, in catalog order. */
			const rendered = [];
			let lastProvider = null;
			state.rows.forEach((row, i) => {
				if (row.provider !== lastProvider) {
					const monthlyOn = state.monthly.includes(row.provider);
					rendered.push(jsxs("div", { className: "dp_setGroup", children: [
						jsx("span", { children: row.group }),
						monthlyOn && jsx(Input, {
							type: "number", className: "dp_setFeeInput", inputMode: "decimal",
							min: 0, step: "0.01", placeholder: "CNY/月",
							title: t("setMonthlyFeeHint"),
							value: state.monthlyFee[row.provider] ?? "",
							disabled: !state.writable || state.saving,
							onChange: (e) => patchFee(row.provider, e.target.value),
						}),
						jsx(PillBtn, {
							active: monthlyOn,
							fallbackClass: "dp_miniBtn dp_setMonthlyBtn",
							disabled: !state.writable || state.saving,
							onClick: () => toggleMonthly(row.provider),
							children: t("setMonthly"),
						}),
					] }, `g:${row.provider}`));
					lastProvider = row.provider;
				}
				rendered.push(rowView(row, i));
			});

			let body;
			if (state.status === "loading") {
				body = jsx("span", { className: "dp_costNote", children: t("setLoading") });
			} else if (state.status === "error") {
				body = jsxs("span", { className: "dp_setMsg dp_setMsgErr", children: [
					fill(t("setFailed"), { err: state.error }),
					" ",
					jsx("button", { type: "button", className: "dp_setRemove", onClick: load, children: t("retry") }),
				] });
			} else {
				body = jsxs("div", { className: "dp_setGrid", children: [
					jsxs("label", { className: "dp_setSwitch", children: [
						jsx("input", {
							type: "checkbox",
							checked: state.costEnabled === true,
							disabled: !state.writable || state.saving,
							onChange: (e) => setState((s) => ({ ...s, costEnabled: e.target.checked, saved: false })),
						}),
						jsx("span", { children: t("costEnabledLabel") }),
					] }),
					jsx("span", { className: "dp_costNote", children: t("costEnabledHint") }),
					!state.hasCatalog && jsx("span", { className: "dp_costNote", children: t("setCatalogEmpty") }),
					jsx("span", { className: "dp_costNote", children: t("setPeakNote") }),
					jsx("span", { className: "dp_costNote", children: t("setMonthlyHint") }),
					...rendered,
					jsxs("div", { className: "dp_accentCard", children: [
						jsxs("div", { className: "dp_accentHead", children: [
							jsx("span", { className: "dp_panelTitle", children: t("accentTitle") }),
							jsx("button", {
								type: "button", className: "dp_setLink",
								disabled: !state.writable || state.saving || Object.keys(state.modelColors ?? {}).length === 0,
								onClick: resetAccents,
								children: t("accentResetAll"),
							}),
						] }),
						jsx("span", { className: "dp_costNote", children: t("accentHint") }),
						accentRows.map((row) => {
							const accent = accentEntryOf(accentPreview, row.provider ?? "", row.model);
							const custom = state.modelColors?.[row.model];
							return jsxs("div", { className: "dp_accentRow", children: [
								jsx("span", { className: "dp_accentDot", style: { background: accent?.fill } }),
								jsx("span", { className: "dp_accentName", title: row.model, children: row.name !== "" ? row.name : row.model }),
								jsx("input", {
									type: "color", className: "dp_accentPick", "aria-label": `${t("accentTitle")} ${row.model}`,
									value: /^#[0-9a-f]{6}$/.test(String(custom ?? "")) ? custom : "#888888",
									disabled: !state.writable || state.saving,
									onChange: (e) => setAccent(row.model, e.target.value),
								}),
								jsx("button", {
									type: "button", className: "dp_setLink",
									disabled: !state.writable || state.saving || typeof custom !== "string",
									onClick: () => setAccent(row.model, ""),
									children: t("accentAuto"),
								}),
							] }, row.model);
						}),
					] }),
					jsxs("div", { className: "dp_setActions", children: [
						jsx(Btn, { fallbackClass: "dp_miniBtn",
							variant: "primary", size: "sm",
							disabled: !state.writable || state.saving,
							onClick: save,
							children: t("setSave"),
						}),
						jsx(Btn, { fallbackClass: "dp_miniBtn",
							variant: "outline", size: "sm",
							disabled: !state.writable || state.saving,
							onClick: reset,
							children: t("setReset"),
						}),
						jsx(Btn, { fallbackClass: "dp_miniBtn",
							variant: "outline", size: "sm",
							disabled: state.saving,
							onClick: load,
							title: t("setRefresh"),
							children: t("setRefresh"),
						}),
						state.saved && jsx("span", { className: "dp_setMsg dp_setMsgOk", children: t("setSaved") }),
						state.saved && state.refold && jsx("span", { className: "dp_costNote", children: t("setRefold") }),
						state.error !== null && jsx("span", { className: "dp_setMsg dp_setMsgErr", children: fill(t("setFailed"), { err: state.error }) }),
					] }),
					preview !== null && preview.configured === true && jsxs("div", { className: "dp_setPreview", children: [
						`${fill(t("setPreview"), { n: daysBetween(stats.data.fromDay, stats.data.toDay) })}: ${fmtCost(preview.total ?? 0)} CNY`,
						(preview.convertedFromUsd || 0) > 0 ? ` · ${fill(t("fxNote"), { r: preview.usdToCny })}` : "",
					] }),
					!state.writable && jsx("span", { className: "dp_setMsg dp_setMsgErr", children: t("setNotWritable") }),
					jsx("span", { className: "dp_costNote", children: t("setHint") }),
				] });
			}
			return jsxs("div", { className: "dp_setPanel", children: [
				jsx("div", { className: "dp_setSub", children: t("setSub") }),
				body,
			] });
		}
		//#endregion

