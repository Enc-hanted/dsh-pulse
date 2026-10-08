import { useState, useEffect, useRef, useSyncExternalStore } from "./react.js";
import { modelKey, providerLabelOf, splitModelKey } from "./../view.js";
import { createSnapshotStore } from "./adapter.js";
		//#region utils
		/** ONE conversion of a failed fetch Response into a thrown Error —
		 *  every read face composes it; the message ("HTTP 500") is the
		 *  whole error surface. */
		export function httpError(res) {
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
		}
		/** The write-API dialect: the payload carries `ok:true` and a server
		 *  `error` string. Takes the already-parsed body so 409-conflict
		 *  handling stays at the call site. */
		export function payloadError(res, body) {
			if (!res.ok || body?.ok !== true) throw new Error(body?.error ?? `HTTP ${res.status}`);
		}
		/** Unpriced-usage display floor. Below this many tokens the gap costs a
		 *  fraction of a cent (a couple of title calls, not a rate hole), so the
		 *  card says nothing rather than spending a permanent line on rounding
		 *  noise; at or above it the card states the fact and links to the
		 *  pricing page, which owns the model-by-model breakdown. A display
		 *  threshold, deliberately not a pricing rule: nothing here decides what
		 *  a model costs. */
		export const UNPRICED_HINT_TOKENS = 5000;
		/** ONE Escape-close skeleton for every overlay surface. `capture`
		 *  stages the listener ahead of the host's bubble handlers; `consume`
		 *  stops the event so an open expansion doesn't ALSO dismiss the host
		 *  overlay (its dialog listens for Escape too). `target` keeps each
		 *  surface's original listener home — a host that stopPropagation()s
		 *  on document would otherwise lose window bubble listeners. onEscape
		 *  rides a ref, so a fresh closure per render never rebinds. */
		export function useEscape(open, onEscape, { capture = false, consume = false, target = "document" } = {}) {
			const escapeRef = useRef(onEscape);
			escapeRef.current = onEscape;
			useEffect(() => {
				if (!open) return undefined;
				const onKey = (e) => {
					if (e.key !== "Escape") return;
					if (consume) e.stopPropagation();
					escapeRef.current();
				};
				const t = target === "window" ? window : document;
				t.addEventListener("keydown", onKey, capture);
				return () => t.removeEventListener("keydown", onKey, capture);
			}, [open, capture, consume, target]);
		}
		/** ONE write skeleton for POST /pulse/settings: the method/credentials/
		 *  headers envelope and the 409 judgment (a revisioned host answers 409
		 *  or a {conflict} body when the section moved underneath us). The
		 *  caller's onConflict performs its own refresh flow; a non-conflict
		 *  response runs payloadError's throw-on-failure gate. Resolves
		 *  {conflict, data} so each surface keeps its own conflict face. */
		export async function postSettings(body, { onConflict } = {}) {
			const res = await fetch("/pulse/settings", {
				method: "POST", credentials: "same-origin",
				headers: { "content-type": "application/json", accept: "application/json" },
				body: JSON.stringify(body),
			});
			const data = await res.json().catch(() => ({}));
			const conflict = res.status === 409 || data?.conflict !== undefined;
			if (conflict) onConflict?.();
			else payloadError(res, data);
			return { conflict, data };
		}
		// fmtTokens / fmtClock ride the view.js primitives (their single home);
		// the clock's null-on-garbage contract replaces the old fake midnight.
		export { fmtTokens } from "../view.js";
		export { clockOf as fmtClock } from "../view.js";
		/** Replace `{key}` placeholders in a copy string. */
		export function fill(text, vars) {
			return String(text).replace(/\{(\w+)\}/g, (_, key) => (key in vars ? String(vars[key]) : `{${key}}`));
		}
		export const RANGE_PRESETS = { "1": 1, "7": 7, "30": 30, "90": 90, "365": 365 };
		//#endregion

		//#region stats store
		/**
		 * One shared stats store for every mounted dashboard surface, so the
		 * settings page, the `/pulse` summary seat and the floating overlay all
		 * read one fetch instead of each triggering its own full aggregation.
		 * A request sequence number plus an AbortController make switching
		 * windows race-free: only the newest request may land state.
		 */
		export let statsState = { key: null, from: null, to: null, status: "loading", data: null, error: null, busy: false };
		export let statsSeq = 0;
		export let statsAbort = null;
		export const statsListeners = new Set();
		/** Recently fetched windows (LRU, max 4): switching back within a
		 *  minute renders instantly while a background fetch refreshes it.
		 *  Older entries are dropped instead of being flashed as current. */
		export const PAYLOAD_CACHE_MS = 60000;
		/** How long an empty payload waits before the unasked-for retry that
		 *  covers the freshly-opened-harness race (the host folds before the
		 *  first message of a session is committed, then serves a genuinely
		 *  empty window). The FIRST retry comes fast so a cold-open overlay
		 *  never sits on "no data"; later retries back off, and after a few
		 *  misses a genuinely empty corpus keeps its empty state instead of
		 *  polling forever. */
		export const EMPTY_RETRY_FIRST_MS = 1200;
		export const EMPTY_RETRY_BACKOFF_MS = 4000;
		export const EMPTY_RETRY_MAX = 8;
		export let statsEmptyAttempts = 0;
		export const payloadCache = new Map();
		export let statsRetry = null;
		export function setStatsState(next) {
			statsState = next;
			for (const listener of statsListeners) listener();
		}
		export function subscribeStats(listener) {
			statsListeners.add(listener);
			return () => { statsListeners.delete(listener); };
		}
		/** An empty window is never the final word: it is exactly what a
		 *  just-opened harness reports before the current session's first
		 *  message commits, so it is neither cached nor left on screen
		 *  unanswered. `corpusSessions` distinguishes the two empty cases for
		 *  the copy; the retry runs for both, because a corpus that is empty
		 *  moments before the first message arrives is equally transient. */
		export function isCachable(data) {
			return Array.isArray(data?.sessions) && data.sessions.length > 0;
		}
		export function scheduleEmptyRetry(from, to) {
			if (statsRetry !== null) return;
			if (statsEmptyAttempts >= EMPTY_RETRY_MAX) return;
			const delay = statsEmptyAttempts === 0 ? EMPTY_RETRY_FIRST_MS : EMPTY_RETRY_BACKOFF_MS;
			statsEmptyAttempts += 1;
			statsRetry = setTimeout(() => {
				statsRetry = null;
				if (statsState.status === "error") return;
				const data = statsState.data;
				if (data !== null && Array.isArray(data.sessions) && data.sessions.length > 0) {
					statsEmptyAttempts = 0;
					return;
				}
				loadStats(statsState.from ?? from, statsState.to ?? to);
			}, delay);
		}
		export function loadStats(from, to) {
			const seq = ++statsSeq;
			const key = `${from}:${to}`;
			if (statsAbort !== null) statsAbort.abort();
			statsAbort = new AbortController();
			const entry = payloadCache.get(key);
			const cached = entry !== undefined && Date.now() - entry.at < PAYLOAD_CACHE_MS ? entry.payload : undefined;
			if (entry !== undefined && cached === undefined) payloadCache.delete(key);
			setStatsState({
				...statsState,
				key,
				from,
				to,
				status: cached !== undefined ? "ready" : statsState.data === null ? "loading" : "ready",
				data: cached !== undefined ? cached : statsState.data,
				busy: true,
				error: null,
			});
			fetch(`/pulse/stats?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
				credentials: "same-origin",
				headers: { accept: "application/json" },
				signal: statsAbort.signal,
			}).then(async (res) => {
				httpError(res);
				const data = await res.json();
				// Schema 4 hosts add `corpusSessions` to the schema-3 payload;
				// schemas 3 and 2 (previous releases) stay readable so a rolling
				// upgrade never hard-fails on a version skew.
				if (data?.schema !== 4 && data?.schema !== 3 && data?.schema !== 2) throw new Error("unexpected payload schema");
				if (seq !== statsSeq) return;
				if (isCachable(data)) {
					statsEmptyAttempts = 0;
					payloadCache.delete(key);
					payloadCache.set(key, { at: Date.now(), payload: data });
					// The current key was just re-inserted (newest), so LRU
					// eviction never drops it.
					while (payloadCache.size > 4) payloadCache.delete(payloadCache.keys().next().value);
				} else {
					payloadCache.delete(key);
				}
				setStatsState({ key, from, to, status: "ready", data, error: null, busy: false });
				if (!isCachable(data)) scheduleEmptyRetry(from, to);
			}).catch((error) => {
				if (seq !== statsSeq) return;
				setStatsState({ ...statsState, key, from, to, status: "error", error: String(error?.message ?? error), busy: false });
			});
		}
		/** Read the shared store; triggers a load when this mount's window differs. */
		export function usePulseStats(from, to) {
			const state = useSyncExternalStore(subscribeStats, () => statsState);
			const key = `${from}:${to}`;
			useEffect(() => {
				if (statsState.key !== key || statsState.status === "error") loadStats(from, to);
			}, [key, from, to]);
			return { ...state, reload: () => loadStats(from, to) };
		}

		/** Official DeepSeek balance (GET /pulse/balance): host-side query with
		 *  a short server cache, so each mount costs at most one refresh. A
		 *  sequence guard keeps a superseded reply from landing state. Pass
		 *  `enabled: false` to skip the request entirely (e.g. the sidebar
		 *  balance indicator switched off).
		 *
		 *  Freshness driver: the official total only moves when spend accrues,
		 *  so one fetch per mount froze the sidebar chip until a reload. The
		 *  hook now polls gently through the host's cache (never
		 *  `refresh=1` — an automatic poll must not force an upstream call),
		 *  refetches when the tab becomes visible again, and publishes every
		 *  real fetch on a window event that sibling consumers (sidebar chip,
		 *  dashboard panel) adopt directly, so a manual dashboard refresh
		 *  updates the footer instantly without another request. */
		export const BALANCE_EVENT = "pulse:balance";
		export function publishBalance(data) {
			try { window.dispatchEvent(new CustomEvent(BALANCE_EVENT, { detail: data })); } catch { /* publishing is best-effort */ }
		}
		export const BALANCE_POLL_MS = 60000;
		/** ONE polling skeleton behind the balance and quota hooks: the
		 *  60 s cadence gated on document visibility, peer fetches shared
		 *  through a window event (fresher than local state, one round-trip
		 *  cheaper), manual refresh bypassing the server's short cache, stale
		 *  replies discarded by sequence. A failed poll KEEPS the last good
		 *  data — the error surface explains it; blanking a working display
		 *  over a transient hiccup was the balance hook's old drift. */
		function usePolledEndpoint({ path, event, pollMs, enabled = true }) {
			const [state, setState] = useState({ data: null, busy: false, error: null });
			const seq = useRef(0);
			const load = (refresh) => {
				const mine = ++seq.current;
				setState((s) => ({ ...s, busy: true }));
				fetch(`${path}${refresh === true ? "?refresh=1" : ""}`, {
					credentials: "same-origin",
					headers: { accept: "application/json" },
				}).then(async (res) => {
					httpError(res);
					return res.json();
				}).then((data) => {
					if (mine === seq.current) setState({ data, busy: false, error: null });
					try { window.dispatchEvent(new CustomEvent(event, { detail: data })); } catch { /* publishing is best-effort */ }
				}).catch((error) => {
					if (mine === seq.current) setState((s) => ({ ...s, busy: false, error: String(error?.message ?? error) }));
				});
			};
			useEffect(() => {
				if (!enabled) return undefined;
				load();
				const onPeer = (e) => {
					if (!e.detail) return;
					seq.current += 1;
					setState({ data: e.detail, busy: false, error: null });
				};
				const poll = () => { if (document.visibilityState === "visible") load(); };
				const timer = setInterval(poll, pollMs);
				document.addEventListener("visibilitychange", poll);
				window.addEventListener(event, onPeer);
				return () => {
					clearInterval(timer);
					document.removeEventListener("visibilitychange", poll);
					window.removeEventListener(event, onPeer);
				};
			}, [enabled]);
			return { ...state, refresh: () => load(true) };
		}

		export function useBalance(enabled = true) {
			return usePolledEndpoint({ path: "/pulse/balance", event: BALANCE_EVENT, pollMs: BALANCE_POLL_MS, enabled });
		}
		//#endregion

		//#region quota store
		/** Subscription-quota endpoint state: one hook, the balance's polling
		 *  discipline — 60 s cadence gated on document visibility, peer fetches
		 *  shared through a window event, manual refresh bypassing the server's
		 *  short cache. Empty until the host answers; a deployment with no
		 *  quota-capable provider simply never renders the bar. */
		export const QUOTA_EVENT = "dsh-pulse:quota";
		export const QUOTA_POLL_MS = 60000;
		export function publishQuota(data) {
			try { window.dispatchEvent(new CustomEvent(QUOTA_EVENT, { detail: data })); } catch { /* publishing is best-effort */ }
		}
		export function useQuota(enabled = true) {
			return usePolledEndpoint({ path: "/pulse/quota", event: QUOTA_EVENT, pollMs: QUOTA_POLL_MS, enabled });
		}
		//#endregion

		//#region settings store
		/** Shared `/pulse/settings` cache: one inflight request is reused by
		 *  every surface (dashboard catalog, pricing, compare, panels), and a
		 *  short TTL lets rapid tab switching render instantly from memory
		 *  while the host serves the full settings (catalog enumeration) only
		 *  once per window. A successful save invalidates it so the next read
		 *  is fresh. */
		export const SETTINGS_CACHE_MS = 30000;
		export let settingsCache = { at: 0, value: null, inflight: null };
		export function fetchSettings(force = false) {
			if (settingsCache.inflight !== null) return settingsCache.inflight;
			if (!force && settingsCache.value !== null && Date.now() - settingsCache.at < SETTINGS_CACHE_MS) {
				return Promise.resolve(settingsCache.value);
			}
			settingsCache.inflight = fetch("/pulse/settings", { credentials: "same-origin", headers: { accept: "application/json" } })
				.then((res) => { httpError(res); return res.json(); })
				.then((data) => { settingsCache.value = data; settingsCache.at = Date.now(); return data; })
				.finally(() => { settingsCache.inflight = null; });
			return settingsCache.inflight;
		}
		export function invalidateSettings() { settingsCache.value = null; settingsCache.at = 0; }
		//#endregion

		//#region local preference buses
		/** ONE bus skeleton behind the three local preference stores (panels,
		 *  theme, overlay): the host's snapshot engine when the module table
		 *  serves it (0.1.7+), the handwritten snapshot+Set bus otherwise.
		 *  Snapshots are replaced, never mutated — the engine deep-freezes in
		 *  dev and `useSyncExternalStore` keys on reference identity. */
		function makeBus(init) {
			if (createSnapshotStore !== null) {
				const engine = createSnapshotStore(init);
				return {
					get: () => engine.getSnapshot(),
					set: (next) => engine.set(next),
					subscribe: (listener) => engine.subscribe(listener),
				};
			}
			let state = init;
			const listeners = new Set();
			return {
				get: () => state,
				set: (next) => { state = next; for (const listener of [...listeners]) listener(next); },
				subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
			};
		}
		//#endregion

		//#region panels store
		/** Per-panel visibility for the observatory surfaces (dashboard panels
		 *  plus the sidebar balance). Local preferences only — nothing here
		 *  touches the host or the persisted pricing rules. */
		export const PANELS_STORAGE = "dsh-pulse:panels";
		export const PANEL_DEFAULTS = {
			chips: true, balance: true, trend: true, cache: true,
			models: true, projects: true, cost: true, budget: true, footBalance: true,
			sessions: true, costTrend: true, quota: true,
		};
		export function loadPanels() {
			try {
				const raw = localStorage.getItem(PANELS_STORAGE);
				if (raw !== null) {
					const parsed = JSON.parse(raw);
					if (parsed !== null && typeof parsed === "object") return { ...PANEL_DEFAULTS, ...parsed };
				}
			} catch (error) { /* private mode or quota — fall through to defaults */ }
			return { ...PANEL_DEFAULTS };
		}
		/** The bus seeds from the loaded preferences. Persistence deliberately
		 *  stays hand-written instead of the engine's `persist` opt: attach
		 *  restores the raw stored value wholesale, without the defaults merge
		 *  (and theme's whitelist) that `load*` applies at seed time. */
		export const panelsBus = makeBus(loadPanels());
		export function savePanels(panels) {
			try { localStorage.setItem(PANELS_STORAGE, JSON.stringify(panels)); } catch (error) { /* non-fatal */ }
			panelsBus.set(panels);
		}
		/** Change bus for the panel preferences: the General-settings row (and
		 *  any other surface) flips a toggle once, every mounted consumer sees
		 *  it without a remount. */
		export function subscribePanels(listener) {
			return panelsBus.subscribe(listener);
		}
		//#endregion

		//#region trend stack pref
		/** Usage-trend stack dimension: token types (default) or per-model
		 *  accent colors. A localStorage preference like theme/panels. */
		export const TREND_STACK_STORAGE = "dsh-pulse:trend-stack";
		export function loadTrendStack() {
			try {
				return localStorage.getItem(TREND_STACK_STORAGE) === "model" ? "model" : "type";
			} catch { return "type"; }
		}
		/** Cost-trend stack dimension: peak/off-peak billing contributions
		 *  (default) or per-model costs. Same preference mechanism. */
		export const COST_STACK_STORAGE = "dsh-pulse:cost-stack";
		export function loadCostStack() {
			try {
				return localStorage.getItem(COST_STACK_STORAGE) === "model" ? "model" : "tiers";
			} catch { return "tiers"; }
		}
		//#endregion

		//#region theme store
		/** Dashboard accent palette — a local preference like the panel
		 *  toggles. `blue` is the original look (no CSS block: it inherits
		 *  the shell theme exactly); `pink` / `orange` / `bw` override the
		 *  alias tokens on `body .dp_root[data-dp-theme]` and
		 *  `body .dp_themeScope[data-dp-theme]`, each with its own light and
		 *  dark variant selected by the shell's `data-ds-dark-theme`. */
		export const THEME_STORAGE = "dsh-pulse:theme";
		export const THEMES = ["blue", "pink", "orange", "bw"];
		export function loadTheme() {
			try {
				const raw = localStorage.getItem(THEME_STORAGE);
				if (raw !== null) {
					if (THEMES.includes(raw)) return raw;
					// Legacy stored values (auto/light/dark from the removed
					// forced-theme picker) fall back to the blue default.
				}
			} catch (error) { /* private mode or quota — fall through to blue */ }
			return "blue";
		}
		export function saveTheme(theme) {
			try { localStorage.setItem(THEME_STORAGE, theme); } catch (error) { /* non-fatal */ }
		}
		/** Same bus skeleton as panels; the whitelist lives in setTheme and the
		 *  legacy-value fallback in loadTheme (the engine's bare persist would
		 *  restore stale names verbatim). */
		export const themeBus = makeBus(loadTheme());
		export function setTheme(theme) {
			if (!THEMES.includes(theme)) return;
			saveTheme(theme);
			themeBus.set(theme);
		}
		export function subscribeTheme(listener) {
			return themeBus.subscribe(listener);
		}
		//#endregion

		//#region width store
		/** 浮层观测台卡的拖拽宽度（px），theme/panels 同款的 localStorage 纯
		 *  偏好。null = 880 表格默认（未拖过、或双击把手复位）——新装用户
		 *  与老部署零变化。钳制区间两端都有依据：下限守仪表盘最密表格
		 *  （对账/额度行）的列最小值之和（≈460px，卡内容列 562 起留有冗余），
		 *  上限之外卡就不再是浮层卡；比窗口还宽的情形由浮层卡表上的
		 *  `max-width:calc(100vw - 48px)` 兜底，存档值原样保留。 */
		export const WIDTH_STORAGE = "dsh-pulse:width";
		export const WIDTH_MIN = 600;
		export const WIDTH_MAX = 1280;
		export function loadWidth() {
			try {
				const raw = localStorage.getItem(WIDTH_STORAGE);
				if (raw !== null) {
					const n = Math.round(Number(raw));
					if (Number.isFinite(n) && n >= WIDTH_MIN && n <= WIDTH_MAX) return n;
				}
			} catch (error) { /* private mode or quota — fall through to default */ }
			return null;
		}
		export function saveWidth(width) {
			try {
				if (width === null) localStorage.removeItem(WIDTH_STORAGE);
				else localStorage.setItem(WIDTH_STORAGE, String(width));
			} catch (error) { /* non-fatal */ }
		}
		/** Same bus skeleton as theme; the clamp lives in setWidth and the
		 *  stale-value fallback in loadWidth. */
		export const widthBus = makeBus(loadWidth());
		export function setWidth(width) {
			if (width === null) {
				saveWidth(null);
				widthBus.set(null);
				return;
			}
			const n = Math.round(Number(width));
			if (!Number.isFinite(n)) return;
			const next = Math.max(WIDTH_MIN, Math.min(WIDTH_MAX, n));
			saveWidth(next);
			widthBus.set(next);
		}
		export function subscribeWidth(listener) {
			return widthBus.subscribe(listener);
		}
		//#endregion

		//#region overlay store
		/** The floating seat's whole state: whether it is open, which face it
		 *  shows — `summary` is the compact session card the `/pulse` menu row
		 *  opens, `full` the observatory the sidebar button opens — and which
		 *  session it speaks for. The snapshot object is replaced, never
		 *  mutated, so `useSyncExternalStore` sees a new reference exactly when
		 *  something changed. No persistence by design: a reload always starts
		 *  closed (the engine's persist opt would change that). */
		export const overlayBus = makeBus({ open: false, mode: "full", focus: null });
		/** Live snapshot for useSyncExternalStore's getSnapshot. */
		export const overlaySnapshot = () => overlayBus.get();
		/** Open the seat on one face, optionally for one invoking session. */
		export function openOverlay(mode, focus = null) {
			const state = overlayBus.get();
			if (state.open && state.mode === mode && state.focus === focus) return;
			overlayBus.set({ open: true, mode, focus });
		}
		/** Close the seat; the last face and focus stay for the next open. */
		export function setOverlayOpen(value) {
			const state = overlayBus.get();
			if (state.open === value) return;
			overlayBus.set({ ...state, open: value });
		}
		export function subscribeOverlay(listener) {
			return overlayBus.subscribe(listener);
		}
		//#endregion

		//#region model names
		/** Resolve display labels from the model catalog (`/pulse/settings`'s
		 *  `catalog`: one group per provider route). The display name comes
		 *  from the model config when known, falling back to the bare model
		 *  id; a provider prefix shows only when the same display name (or a
		 *  catalog-less model id in scope) appears under more than one
		 *  provider — otherwise the label is just the name. */
		export function catalogNames(catalog, keys = []) {
			const names = new Map(); // composite key -> display name
			const byId = new Map(); // bare model id -> first display name seen
			const byIdLower = new Map(); // lowercased bare id -> first display name seen
			const providerName = new Map(); // provider id -> display name
			for (const group of Array.isArray(catalog) ? catalog : []) {
				const pid = group.provider ?? "";
				providerName.set(pid, group.displayName || pid);
				for (const model of Array.isArray(group.models) ? group.models : []) {
					if (typeof model?.id !== "string" || model.id === "") continue;
					const name = model.name && model.name !== "" ? model.name : model.id;
					names.set(modelKey(pid, model.id), name);
					if (!byId.has(model.id)) byId.set(model.id, name);
					const idLower = model.id.toLowerCase();
					if (!byIdLower.has(idLower)) byIdLower.set(idLower, name);
				}
			}
			const nameProviders = new Map(); // display name -> provider set
			for (const [key, name] of names) {
				const { provider } = splitModelKey(key);
				if (provider === "") continue;
				let set = nameProviders.get(name);
				if (set === undefined) { set = new Set(); nameProviders.set(name, set); }
				set.add(provider);
			}
			const ambiguous = new Set();
			for (const [name, set] of nameProviders) if (set.size > 1) ambiguous.add(name);
			// Catalog-less models in scope: the same bare id under several
			// providers collides visually too, so it counts as ambiguous.
			const idProviders = new Map();
			for (const key of keys) {
				const { provider, model } = splitModelKey(key);
				if (provider === "" || names.has(key)) continue;
				let set = idProviders.get(model);
				if (set === undefined) { set = new Set(); idProviders.set(model, set); }
				set.add(provider);
				if (set.size > 1) ambiguous.add(model);
			}
			/** Display name: the exact provider+model config entry, else any
			 *  catalog entry for that model id (covers provider-less/wildcard
			 *  rules and events), else — after a case-insensitive retry, since
			 *  event logs and the catalog sometimes disagree on casing for the
			 *  same model — the bare id. */
			const displayNameOf = (provider, model) => {
				const p = typeof provider === "string" ? provider : "";
				if (p !== "") {
					const hit = names.get(modelKey(p, model));
					if (hit !== undefined) return hit;
				}
				const hit = byId.get(model);
				if (hit !== undefined) return hit;
				const lower = byIdLower.get(String(model).toLowerCase());
				if (lower !== undefined) return lower;
				return model;
			};
			const labelOf = (provider, model) => {
				const p = typeof provider === "string" ? provider : "";
				const name = displayNameOf(p, model);
				if (p === "" || !ambiguous.has(name)) return name;
				return `${providerLabelOf(p, providerName.get(p) || p)} · ${name}`;
			};
			/** Always-provider-prefixed label: the session model breakdown needs
			 *  the route visible even when no name collides (monthly-paid vs
			 *  official same-id models read at a glance). A provider family is
			 *  one route in the user's head, so it prints the family label. */
			const fullLabelOf = (provider, model) => {
				const p = typeof provider === "string" ? provider : "";
				const name = displayNameOf(p, model);
				if (p === "") return name;
				return `${providerLabelOf(p, providerName.get(p) || p)} · ${name}`;
			};
			return { displayNameOf, labelOf, fullLabelOf };
		}

		/** Model catalog shared by every surface: fetched once per page load
		 *  through the shared settings store, so dashboard, pricing and compare
		 *  all label models identically and reuse the same `/pulse/settings`
		 *  request. A failed read degrades to an empty catalog (labels fall
		 *  back to bare model ids). */
		export let catalogPromise = null;
		export function fetchCatalog() {
			if (catalogPromise === null) {
				catalogPromise = fetchSettings()
					.then((data) => (Array.isArray(data.catalog) ? data.catalog : []))
					.catch((error) => { catalogPromise = null; throw error; });
			}
			return catalogPromise;
		}
		export function useCatalog() {
			const [catalog, setCatalog] = useState(null);
			useEffect(() => {
				let alive = true;
				fetchCatalog().then((list) => { if (alive) setCatalog(list); })
					.catch(() => { if (alive) setCatalog([]); });
				return () => { alive = false; };
			}, []);
			return catalog === null ? [] : catalog;
		}
		//#endregion

