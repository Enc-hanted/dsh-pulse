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
		export let statsState = { key: null, from: null, to: null, status: "loading", data: null, error: null, busy: false, emptyRetry: false };
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
		/** Scheduling flips `emptyRetry` on so the empty face can say "the
		 *  first message has not landed yet — retrying" instead of a bare
		 *  empty state; every other setStatsState path writes the flag back
		 *  to false, so it tracks exactly the pending-retry window and goes
		 *  dark once the bounded attempts are spent. */
		export function scheduleEmptyRetry(from, to) {
			if (statsRetry !== null) return;
			if (statsEmptyAttempts >= EMPTY_RETRY_MAX) return;
			const delay = statsEmptyAttempts === 0 ? EMPTY_RETRY_FIRST_MS : EMPTY_RETRY_BACKOFF_MS;
			statsEmptyAttempts += 1;
			setStatsState({ ...statsState, emptyRetry: true });
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
				setStatsState({ key, from, to, status: "ready", data, error: null, busy: false, emptyRetry: false });
				if (!isCachable(data)) scheduleEmptyRetry(from, to);
			}).catch((error) => {
				if (seq !== statsSeq) return;
				setStatsState({ ...statsState, key, from, to, status: "error", error: String(error?.message ?? error), busy: false, emptyRetry: false });
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
		/** Why 60 s and not less: the host caches each endpoint's upstream
		 *  answer for the same 60 s (one outbound call per minute per
		 *  endpoint no matter how many surfaces are mounted), the timer is
		 *  gated on document visibility (a background tab polls nothing),
		 *  and the official APIs' own rate limits sit orders of magnitude
		 *  above one call per minute. Tightening it would only multiply
		 *  identical cache hits; loosening it only delays a number the user
		 *  is actively looking at. */
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
		/** Same cadence rationale as BALANCE_POLL_MS: one visible-tab poll
		 *  per minute against a server cache of the same length. */
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
					/** 统一回调契约：宿主引擎的 subscribe 是 React 式失效回调
					 *  （不携带值，见宿主 `subscribe(listener: () => void)` 类
					 *  契约），手写路径则把新值传给监听者——同一份源码在两种
					 *  路径下行为必须一致。这里包一层，总是把当前快照交给监
					 *  听者；useSyncExternalStore 式的订阅者忽略入参，不受影
					 *  响。（宽度偏好曾在引擎宿主上拖拽后变 undefined，卡宽
					 *  弹回默认，即两条路径契约不一致所致。） */
					subscribe: (listener) => engine.subscribe(() => listener(engine.getSnapshot())),
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
			/** 行为偏好（不是面板显隐，但走同一条存取管线）：聚焦当前窗口
			 *  工作区 / 退出后记住上次视图。默认都开。 */
			focusWorkspace: true, rememberView: true,
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

		//#region view memory
		/** 退出保留：观测台窗口状态的连续快照（区间/工作区/模型/页签/展开/
		 *  钻取/滚动位置）。保存走防抖的连续落盘而非卸载时机——页面刷新没
		 *  有卸载机会。语义按产品定义：点右上角 × 是显式关闭，整份清除；
		 *  Esc、点背景、页面刷新都算收起，快照照常保留，重开还原。 */
		export const VIEW_SNAPSHOT_STORAGE = "dsh-pulse:view";
		export function loadViewSnapshot() {
			try {
				const raw = localStorage.getItem(VIEW_SNAPSHOT_STORAGE);
				if (raw === null) return null;
				const parsed = JSON.parse(raw);
				if (parsed !== null && typeof parsed === "object" && parsed.v === 1) return parsed;
			} catch (error) { /* private mode or quota — no memory */ }
			return null;
		}
		export function saveViewSnapshot(snapshot) {
			try {
				/** 合并写：观测台主体与各子组件（会话明细/断点）各自持有自己
				 *  的字段，谁变化谁落盘，互不清对方的节。 */
				const prev = loadViewSnapshot();
				localStorage.setItem(VIEW_SNAPSHOT_STORAGE, JSON.stringify({ ...prev, ...snapshot, v: 1 }));
			} catch (error) { /* non-fatal */ }
		}
		export function clearViewSnapshot() {
			try { localStorage.removeItem(VIEW_SNAPSHOT_STORAGE); } catch (error) { /* non-fatal */ }
		}
		/** 显式清除旗标：点 × / 关「记住上次视图」开关这类「整份清除」置位，
		 *  观测台卸载时的补写看到它就直接放弃——刚清空的快照不许被补写复
		 *  活。读即消费（一次性）。 */
		let explicitClearAt = 0;
		export function markExplicitClose() { explicitClearAt = Date.now(); }
		export function consumeExplicitClose() {
			const seen = explicitClearAt !== 0;
			explicitClearAt = 0;
			return seen;
		}
		/** 会话明细节：打开的会话 + 它的断点（epoch ms，按会话隔离）。读侧
		 *  校验 id 匹配——换会话时旧断点绝不串场。受「记住上次视图」开关
		 *  管辖；点 × 的整份清除天然覆盖本节（同一份存储）。 */
		export function loadSessionDetailSnapshot(id) {
			if (loadPanels().rememberView === false) return null;
			const snapshot = loadViewSnapshot();
			const section = snapshot !== null && typeof snapshot.sessionDetail === "object" && snapshot.sessionDetail !== null ? snapshot.sessionDetail : null;
			if (section === null) return null;
			if (typeof id === "string" && section.id !== id) return null;
			return section;
		}
		export function saveSessionDetailSnapshot(id, breaks) {
			if (loadPanels().rememberView === false) return;
			saveViewSnapshot({ sessionDetail: { id, breaks: Array.isArray(breaks) ? breaks : [] } });
		}
		/** 数据指纹快照：关面板前看到的数据长什么样。独立于「记住上次视
		 *  图」开关——它是变更通知不是视图状态。橘点 = 重开后的自然拉取指
		 *  纹与之不同；点刷新即灭。 */
		export const SEEN_STORAGE = "dsh-pulse:seen";
		export function loadSeen() {
			try { return localStorage.getItem(SEEN_STORAGE); } catch (error) { return null; }
		}
		export function saveSeen(fingerprint) {
			try { localStorage.setItem(SEEN_STORAGE, String(fingerprint ?? "")); } catch (error) { /* non-fatal */ }
		}
		export function clearSeen() {
			try { localStorage.removeItem(SEEN_STORAGE); } catch (error) { /* non-fatal */ }
		}
		/** 宿主会话域的取数钩子（plugin.js 用 ctx.sessions 注入）：「当前窗
		 *  口正在看的会话」的权威信号在这里——主视图以 mainView 来源保留
		 *  它正显示的会话。目录不可用（老宿主/未连接）返回 null。 */
		let sessionsSourceGetter = null;
		/** ctx.inject(["sessions"]) 是否已兑现：诊断行用它分辨「还在等服务
		 *  到达」和「服务到了但没有 retainInfo」。 */
		let sessionsInjectFired = false;
		export function markSessionsInjectFired() { sessionsInjectFired = true; }
		export function setSessionsSource(getter) {
			sessionsSourceGetter = typeof getter === "function" ? getter : null;
		}
		/** 读一份 retain 信息的三形状兼容：本构建（对照官方适配器源码）的
		 *  快照读法是 getSnapshot()，旧形态是 get()；list 快照的 byId 行也
		 *  合并了 retainedBy。按 retainInfo→getSnapshot、retainInfo→get、
		 *  list.byId 三种依次尝试。 */
		function retainedByOf(source, id) {
			try {
				const info = typeof source.retainInfo === "function" ? source.retainInfo(id) : null;
				const snapshot = info === null || info === undefined
					? null
					: typeof info.getSnapshot === "function" ? info.getSnapshot() : typeof info.get === "function" ? info.get() : null;
				if (snapshot !== null && snapshot !== undefined && snapshot.retainedBy !== null && snapshot.retainedBy !== undefined) return snapshot.retainedBy;
			} catch (error) { /* 目录半就绪，走 list 兜底 */ }
			try {
				const list = typeof source.list?.getSnapshot === "function" ? source.list.getSnapshot() : typeof source.list?.get === "function" ? source.list.get() : null;
				return list?.byId?.[id]?.retainedBy ?? null;
			} catch (error) { return null; }
		}
		/** 在候选里找正被主视图保留的会话 id；没有则 null。候选来自观测台
		 *  自己的数据（payload 会话 id 列表），不需要任何枚举接口。 */
		export function currentMainSessionId(candidateIds) {
			const source = sessionsSourceGetter?.();
			if (source === null || source === undefined || typeof source.retainInfo !== "function") return null;
			for (const id of candidateIds) {
				if (typeof id !== "string" || id === "") continue;
				const retainedBy = retainedByOf(source, id);
				if (retainedBy !== null && retainedBy !== undefined && retainedBy.mainView > 0) return id;
			}
			return null;
		}
		/** 聚焦诊断：单个候选 id 的 retain 信息原始样本（失败时落日志用）。 */
		export function sessionsRetainSample(id) {
			const source = sessionsSourceGetter?.();
			if (source === null || source === undefined || typeof source.retainInfo !== "function" || typeof id !== "string" || id === "") return "";
			try {
				const info = source.retainInfo(id);
				const probe = typeof info?.getSnapshot === "function" ? info.getSnapshot() : typeof info?.get === "function" ? info.get() : null;
				let listRow = null;
				try {
					const list = typeof source.list?.getSnapshot === "function" ? source.list.getSnapshot() : typeof source.list?.get === "function" ? source.list.get() : null;
					listRow = list?.byId?.[id] ?? null;
				} catch (error) { /* list 不可用不阻塞样本 */ }
				return JSON.stringify({ probe: probe ?? null, listRowRetainedBy: listRow?.retainedBy ?? null });
			} catch (error) { return `throw:${String(error?.message ?? error)}`; }
		}
		/** 聚焦诊断：ctx.sessions 可达性的一行报告（console.debug 用），
		 *  聚焦不生效时用它分辨「还在等服务注入 / 服务不可达 / 形状不对」。 */
		export function sessionsSourceInfo() {
			if (sessionsSourceGetter === null) return "no-source";
			let source;
			try { source = sessionsSourceGetter?.(); } catch (error) { return "getter-threw"; }
			if (source === null || source === undefined) return sessionsInjectFired ? "arrived-empty" : "waiting";
			if (typeof source.retainInfo !== "function") return "no-retainInfo";
			return "ok";
		}
		/** 会话服务就绪推送（聚焦探测的事件源）：ctx.inject(["sessions"])
		 *  兑现时由 plugin.js 调 markSessionsReady()，把还在等服务的聚焦
		 *  探测恰好推送补试一次——事件替代定时器，不赌服务到达时刻。一
		 *  次性广播：就绪之后新挂载的观测台在首份数据尝试时就能直读服
		 *  务，不需要订阅。 */
		const sessionsReadyListeners = new Set();
		export function onSessionsReady(listener) {
			sessionsReadyListeners.add(listener);
			return () => { sessionsReadyListeners.delete(listener); };
		}
		export function markSessionsReady() {
			const waiters = [...sessionsReadyListeners];
			sessionsReadyListeners.clear();
			for (const notify of waiters) {
				try { notify(); } catch (error) { /* 单个等待方出错不拖垮其他 */ }
			}
		}
		/** 头部刷新钮的「有新数据」橘点总线：比对逻辑在观测台内，按钮在
		 *  两处渲染（面板自己的头部 + 浮层的悬浮动作层），走总线共享。 */
		export const dataChangedBus = makeBus(false);
		export const dataChangedSnapshot = () => dataChangedBus.get();
		export function subscribeDataChanged(listener) {
			return dataChangedBus.subscribe(listener);
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

