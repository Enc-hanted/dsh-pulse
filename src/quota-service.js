/**
 * Subscription quota service — the handler behind `GET /pulse/quota`.
 *
 * The same posture as the official balance, one provider up: credentials are
 * resolved per operation through the credential seam (the env refs the Models
 * page writes, the stored record it writes for OAuth routes, or the
 * adapter's well-known env names), and live only in one outbound
 * Authorization header. Only parsed utilization numbers persist — as
 * `{t, provider, window, pct}` points in a rolling storage-domain global,
 * the burn-rate series the client forecasts from. A route queries only when
 * a built-in adapter claims it (and the user has not switched it off via
 * `quotaOff`); every fetch is user-triggered or a 60-second-cadence poll —
 * never a timer of its own. The host half owns the seams (`resolveConfig`,
 * the llm service and its describe rows); the service owns adapters, wire
 * posture and the snapshot store.
 */

import { credentialKey, credentialRef } from "@deepseek-ai/dsh-credentials";
import { defineDomain } from "@deepseek-ai/dsh-storage-domain";
import { z as zv } from "zod";

import { openRollingGlobalDomain } from "./rolling-domain.js";
import { json } from "./http-helpers.js";

const QUOTA_TIMEOUT_MS = 10000;
const QUOTA_CACHE_MS = 60000;
const QUOTA_SNAPSHOT_ROLL_MS = 30 * 24 * 3600 * 1000;
const QUOTA_SNAPSHOT_MAX = 2000;
const QUOTA_SNAPSHOT_DEDUPE_MS = 5 * 60 * 1000;

/** Rolling per-window utilization history: percentages and nothing else —
 *  never the key, the ref, or any raw provider payload. The client reads
 *  this through `/pulse/quota`'s `series` to draw burn slopes and
 *  exhaustion forecasts. */
const quotaDomainSpec = defineDomain({
  name: "pulse_quota",
  version: 0,
  tables: {},
  global: {
    schema: zv.object({
      snapshots: zv.array(zv.object({
        t: zv.number().int().min(0),
        provider: zv.string().min(1).max(120),
        window: zv.string().min(1).max(40),
        pct: zv.number().min(0).max(100),
      })).max(QUOTA_SNAPSHOT_MAX),
    }),
    initial: { snapshots: [] },
  },
});

/** One defensive number: finite → number, anything else → null. */
const qnum = (value) => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};
const qclampPct = (value) => {
  const n = qnum(value);
  return n === null ? null : Math.max(0, Math.min(100, n));
};
/** Provider reset timestamps come in epoch ms, epoch s, or ISO strings with
 *  over-long fractional seconds; normalize all three to epoch ms. */
const qtime = (value) => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value >= 1e12 ? Math.round(value) : Math.round(value * 1000);
  if (typeof value === "string" && value !== "") {
    const normalized = value.replace(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3})\d+/, "$1");
    const parsed = Date.parse(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};
const qstr = (value) => (typeof value === "string" && value.length > 0 ? value : null);

/** (unit, number) → window id/span for z.ai's limit encoding. Observed
 *  pairs: (3,5) = 5-hour session window, (6,1) = weekly on the CN console,
 *  (6,7) = weekly internationally, (5,1) = monthly tool quota. */
const zaiWindowSpec = (unit, number) => {
  if (unit === 3) return { id: number === 5 ? "5h" : `h${number}`, windowMs: number > 0 ? number * 3600000 : null };
  if (unit === 6) return { id: "7d", windowMs: 7 * 86400000 };
  if (unit === 5) return { id: "month", windowMs: 30 * 86400000 };
  return { id: unit !== null && number !== null ? `u${unit}n${number}` : "window", windowMs: null };
};

/** Sort key: shorter (more immediate) windows first; unknown spans last. */
const windowOrder = (a, b) => (a.windowMs ?? Infinity) - (b.windowMs ?? Infinity);

/** z.ai / bigmodel coding plan: `GET /api/monitor/usage/quota/limit` for the
 *  window utilization (token windows report a percentage only — the CN
 *  console hides absolute counts) plus `GET /api/biz/subscription/list` for
 *  the plan name and fee. Verified live against open.bigmodel.cn (Bearer
 *  auth) and documented for api.z.ai by openusage/CodexBar. */
const zaiFetch = async ({ host, key }) => {
  const headers = { authorization: `Bearer ${key}`, accept: "application/json" };
  const [quotaRes, subRes] = await Promise.all([
    fetchJson(`${host}/api/monitor/usage/quota/limit`, headers),
    fetchJson(`${host}/api/biz/subscription/list`, headers).catch(() => null),
  ]);
  const data = quotaRes?.data;
  const limits = Array.isArray(data?.limits) ? data.limits : [];
  const windows = [];
  const extras = [];
  for (const limit of limits) {
    if (limit === null || typeof limit !== "object") continue;
    const resetsAt = qtime(limit.nextResetTime);
    if (limit.type === "TOKENS_LIMIT") {
      const spec = zaiWindowSpec(qnum(limit.unit), qnum(limit.number));
      if (windows.some((w) => w.id === spec.id)) continue;
      windows.push({ id: spec.id, kind: "tokens", usedPct: qclampPct(limit.percentage), resetsAt, windowMs: spec.windowMs, used: null, total: null });
    } else if (limit.type === "TIME_LIMIT") {
      const total = qnum(limit.usage);
      const used = qnum(limit.currentValue);
      const pct = qclampPct(limit.percentage) ?? (total !== null && total > 0 && used !== null ? qclampPct((used / total) * 100) : null);
      extras.push({ id: "tools", label: null, used, total, usedPct: pct, resetsAt });
    }
  }
  windows.sort(windowOrder);
  let plan = null;
  let fee = null;
  const subs = Array.isArray(subRes?.data) ? subRes.data : [];
  const active = subs.find((entry) => entry?.status === "VALID" && typeof entry?.productName === "string") ?? null;
  if (active !== null) {
    plan = {
      name: active.productName,
      level: qstr(data?.level),
      cycle: qstr(active.billingCycle),
      renewsAt: qstr(active.nextRenewTime),
    };
    const price = qnum(active.actualPrice) ?? qnum(active.initialPrice);
    if (price !== null && typeof active.billingCycle === "string") {
      fee = { amount: price, currency: "CNY", cycle: active.billingCycle };
    }
  }
  return { plan, fee, windows, extras };
};

/** Kimi For Coding: `GET /coding/v1/usages`. The rendering norm every
 *  adapter follows: a window carries used/total counts ONLY when the
 *  provider states a true absolute quota — a ratio-only source renders a
 *  percentage track and never a fabricated "x/100 次" count. Kimi's
 *  windows are ratios (`used_ratio`), so they ride pct-only, 5h and 7d
 *  alike. The legacy flat `usage` object keeps ratio precedence.
 *  Verified live against api.kimi.com. */
const kimiFetch = async ({ host, key }) => {
  const body = await fetchJson(`${host}/coding/v1/usages`, { authorization: `Bearer ${key}`, accept: "application/json" });
  const windows = [];
  const ratioWindow = (id, windowMs, limit) => {
    if (limit === null || typeof limit !== "object") return;
    const usedPct = qclampPct(Number(limit.used_ratio) * 100);
    if (usedPct === null) return;
    windows.push({ id, kind: "requests", used: null, total: null, usedPct, resetsAt: qtime(limit.reset_time), windowMs });
  };
  const usage = body?.usage;
  if (usage !== null && typeof usage === "object") {
    const used = qnum(usage.used);
    const total = qnum(usage.limit);
    const usedPct = qclampPct(used !== null && total !== null && total > 0 ? (used / total) * 100 : null);
    if (usedPct !== null) {
      windows.push({ id: "7d", kind: "requests", used: null, total: null, usedPct, resetsAt: qtime(usage.resetTime), windowMs: 7 * 86400000 });
    }
  }
  const ratios = body?.usages;
  if (ratios !== null && typeof ratios === "object") {
    if (windows.some((w) => w.id === "5h") === false) ratioWindow("5h", 5 * 3600000, ratios.limit_5h);
    if (windows.some((w) => w.id === "7d") === false) ratioWindow("7d", 7 * 86400000, ratios.limit_7d);
  }
  windows.sort(windowOrder);
  const level = qstr(body?.user?.membership?.level);
  return { plan: { name: "Kimi For Coding", level, cycle: null, renewsAt: null }, fee: null, windows, extras: [] };
};

/** MiniMax coding/token plan: `GET /v1/token_plan/remains`. Community-
 *  documented (MiniMax-M2 issue #99): `current_interval_usage_count` and
 *  `current_weekly_usage_count` hold REMAINING counts, not used — prefer
 *  the explicit `*_remaining_percent` fields when present. Not yet live-
 *  verified; a schema drift surfaces as an unparsable reply, never as
 *  fabricated numbers. */
const minimaxFetch = async ({ host, key }) => {
  const body = await fetchJson(`${host}/v1/token_plan/remains`, { authorization: `Bearer ${key}`, accept: "application/json" });
  if (body?.base_resp !== undefined && body?.base_resp !== null && qnum(body.base_resp.status_code) !== 0) {
    throw new Error(`minimax status ${String(body.base_resp.status_code ?? "?")}`);
  }
  const rows = Array.isArray(body?.model_remains) ? body.model_remains : [];
  const remainingPct = (total, remaining) => (total !== null && total > 0 && remaining !== null ? qclampPct(100 - (remaining / total) * 100) : null);
  const fold = (id, windowMs, pick) => {
    let usedPct = null;
    let resetsAt = null;
    let used = null;
    let total = null;
    for (const row of rows) {
      if (row === null || typeof row !== "object") continue;
      const rowTotal = qnum(pick(row).total);
      const rowRemaining = qnum(pick(row).remaining);
      const rowPct = qclampPct(pick(row).remainingPercent) ?? remainingPct(rowTotal, rowRemaining);
      if (rowPct === null) continue;
      usedPct = usedPct === null ? rowPct : Math.max(usedPct, rowPct);
      total = total ?? rowTotal;
      used = used ?? (rowTotal !== null && rowRemaining !== null ? Math.max(0, rowTotal - rowRemaining) : null);
      resetsAt = resetsAt ?? qtime(pick(row).end) ?? qtime(pick(row).remains);
    }
    if (usedPct !== null) windows.push({ id, kind: "requests", used, total, usedPct, resetsAt, windowMs });
  };
  const windows = [];
  fold("5h", 5 * 3600000, (row) => ({ total: row.current_interval_total_count, remaining: row.current_interval_usage_count, remainingPercent: row.current_interval_remaining_percent, end: row.end_time, remains: row.remains_time }));
  fold("7d", 7 * 86400000, (row) => ({ total: row.current_weekly_total_count, remaining: row.current_weekly_usage_count, remainingPercent: row.current_weekly_remaining_percent, end: row.weekly_end_time, remains: row.remains_time }));
  windows.sort(windowOrder);
  return { plan: { name: "MiniMax Coding Plan", level: null, cycle: null, renewsAt: null }, fee: null, windows, extras: [] };
};

/** One JSON GET with the shared outbound posture: bounded, redirect-free,
 *  and failures mapped to cause codes only (no URLs, no keys). */
const fetchJson = async (url, headers) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), QUOTA_TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers, redirect: "error", signal: controller.signal });
    if (response.ok !== true) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    throw new Error(String(error?.cause?.code ?? error?.message ?? error?.name ?? "request failed"));
  } finally {
    clearTimeout(timer);
  }
};

/** Built-in subscription adapters. A route qualifies by provider id (the
 *  Models page's route key); `label` is the display face every provider
 *  entry echoes (the plan name supersedes it once a query succeeded);
 *  `envKeys` are the well-known ambient names tried after the deployment's
 *  own refs. The general quota norm: counts come only from true absolute
 *  quotas — ratio-only sources emit `usedPct` with `used: null, total:
 *  null`, and the renderer never invents a count from a ratio. */
const QUOTA_ADAPTERS = [
  { id: "zai-coding", label: "GLM Coding Plan", routes: ["zai-coding-cn", "zai-coding", "zai"], envKeys: ["ZAI_CODING_CN_API_KEY", "GLM_CODING_CN_API_KEY", "ZAI_API_KEY", "GLM_API_KEY"], hostFor: (route) => (route === "zai-coding-cn" ? "https://open.bigmodel.cn" : "https://api.z.ai"), fetch: zaiFetch },
  { id: "kimi-coding", label: "Kimi For Coding", routes: ["kimi-coding", "kimi"], envKeys: ["KIMI_CODING_API_KEY", "KIMI_API_KEY"], hostFor: () => "https://api.kimi.com", fetch: kimiFetch },
  { id: "minimax", label: "MiniMax Coding Plan", routes: ["minimax", "minimax-coding", "minimax-cn"], envKeys: ["MINIMAX_API_KEY", "MINIMAX_CODING_API_KEY"], hostFor: () => "https://api.minimaxi.com", fetch: minimaxFetch },
];

/**
 * Create the quota service.
 *
 * @param {object} deps
 * @param {() => object} deps.resolveConfig - live plugin config (quotaOff).
 * @param {() => object|null} deps.llmService - the llm bundle's provider list.
 * @param {() => object|null} deps.llmDescribe - the settings forms' describe
 *   rows, the per-route `apiKeyEnv` override source (null on classic hosts).
 */
export function createQuotaService({ ctx, resolveConfig, llmServiceOf, llmDescribeOf }) {
  const openQuotaDomain = openRollingGlobalDomain(ctx, quotaDomainSpec, "dsh-pulse: quota domain");

  /** Credential facts for one route, resolved per operation: ① the llm
   *  settings' per-route `apiKeyEnv` ref, ② the stored credential record the
   *  Models page writes (`llm-pi-ai/<route>`: an api-key record or an OAuth
   *  grant whose access token authenticates subscription endpoints too),
   *  ③ the adapter's well-known env names. Null when nothing resolves. */
  const quotaCredentialFor = async (adapter, route) => {
    const credentials = typeof ctx.get === "function" ? ctx.get("credentials") : null;
    if (credentials === null || typeof credentials?.resolve !== "function") return null;
    const resolveRef = async (name) => {
      try {
        const hit = await credentials.resolve(credentialRef(name));
        const value = typeof hit?.value === "string" ? hit.value.trim() : "";
        return value !== "" ? value : null;
      } catch {
        return null;
      }
    };
    const fromSetting = llmDescribeOf()?.find((row) => row?.value !== null && typeof row?.value === "object")?.value?.providers?.[route]?.apiKeyEnv;
    if (typeof fromSetting === "string" && fromSetting.length > 0) {
      const value = await resolveRef(fromSetting);
      if (value !== null) return { value, source: fromSetting };
    }
    if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(route) && typeof credentials.readRecord === "function") {
      try {
        const record = await credentials.readRecord(credentialKey("llm-pi-ai", route));
        if (record?.kind === "api-key") {
          if (typeof record.key === "string" && record.key.length > 0) return { value: record.key, source: "record" };
          if (typeof record.env === "string" && record.env.length > 0) {
            const value = await resolveRef(record.env);
            if (value !== null) return { value, source: record.env };
          }
        } else if (record?.kind === "grant" && record.payload !== null && typeof record.payload === "object") {
          const access = record.payload.access;
          if (typeof access === "string" && access.length > 0) return { value: access, source: "oauth" };
        }
      } catch {
        // An unreadable record falls through to the ambient names.
      }
    }
    for (const envName of adapter.envKeys) {
      const value = await resolveRef(envName);
      if (value !== null) return { value, source: envName };
    }
    return null;
  };

  /** Persist one query's window percentages (extras excluded — the burn
   *  series tracks plan windows only). Near-identical consecutive readings
   *  of the same window collapse; the store rolls on 30 days and a hard cap. */
  const recordQuotaSnapshots = async (route, result) => {
    const domain = await openQuotaDomain();
    if (domain === null) return;
    const now = Date.now();
    try {
      const current = domain.global.get();
      const snaps = Array.isArray(current?.snapshots) ? current.snapshots.slice() : [];
      for (const window of Array.isArray(result.windows) ? result.windows : []) {
        const pct = qclampPct(window.usedPct);
        const id = qstr(window.id);
        if (pct === null || id === null) continue;
        const lastIdx = snaps.findLastIndex((s) => s.provider === route && s.window === id);
        const last = lastIdx === -1 ? undefined : snaps[lastIdx];
        if (last !== undefined && now - last.t < QUOTA_SNAPSHOT_DEDUPE_MS && Math.abs(last.pct - pct) < 0.5) continue;
        snaps.push({ t: now, provider: route, window: id, pct });
      }
      if (snaps.length === (Array.isArray(current?.snapshots) ? current.snapshots.length : 0)) return;
      const cutoff = now - QUOTA_SNAPSHOT_ROLL_MS;
      await domain.global.set({ snapshots: snaps.filter((s) => s.t >= cutoff).slice(-QUOTA_SNAPSHOT_MAX) });
    } catch {
      // A failed snapshot write never breaks the quota reply.
    }
  };

  /** The stored utilization series, rolled to the window the client needs. */
  const quotaSeriesOf = async () => {
    const domain = await openQuotaDomain();
    if (domain === null) return [];
    try {
      const snaps = domain.global.get()?.snapshots;
      if (!Array.isArray(snaps)) return [];
      const cutoff = Date.now() - QUOTA_SNAPSHOT_ROLL_MS;
      return snaps.filter((s) => s.t >= cutoff);
    } catch {
      return [];
    }
  };

  const quotaCache = { at: 0, result: null };
  const serveQuota = async (req, res, url) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      json(res, 405, { error: "method not allowed" });
      return;
    }
    const refresh = url.searchParams.get("refresh") === "1";
    if (!refresh && quotaCache.result !== null && Date.now() - quotaCache.at < QUOTA_CACHE_MS) {
      json(res, 200, { ...quotaCache.result, cached: true });
      return;
    }
    const off = new Set(Array.isArray(resolveConfig().quotaOff) ? resolveConfig().quotaOff : []);
    const providers = [];
    const targets = [];
    const llmService = llmServiceOf();
    if (llmService !== null && typeof llmService.listProviders === "function") {
      for (const provider of llmService.listProviders()) {
        const route = typeof provider?.id === "string" ? provider.id : "";
        if (route === "") continue;
        const adapter = QUOTA_ADAPTERS.find((candidate) => candidate.routes.includes(route));
        if (adapter === undefined) continue;
        const displayName = typeof provider.name === "string" && provider.name !== "" ? provider.name : route;
        if (off.has(route)) {
          // Switched-off routes still report themselves (never fetched), so
          // the settings page can offer to switch them back on.
          providers.push({ provider: route, adapter: adapter.id, label: adapter.label, displayName, ok: false, configured: true, disabled: true, error: "disabled in settings" });
          continue;
        }
        targets.push({ adapter, route, displayName });
      }
    }
    providers.push(...await Promise.all(targets.map(async ({ adapter, route, displayName }) => {
      const credential = await quotaCredentialFor(adapter, route);
      if (credential === null) {
        return { provider: route, adapter: adapter.id, label: adapter.label, displayName, ok: false, configured: false, error: "no credential resolved" };
      }
      try {
        const result = await adapter.fetch({ route, key: credential.value, host: adapter.hostFor(route) });
        await recordQuotaSnapshots(route, result);
        return {
          provider: route, adapter: adapter.id, label: adapter.label, displayName,
          ok: true, configured: true, credentialSource: credential.source,
          plan: result.plan ?? null, fee: result.fee ?? null,
          windows: Array.isArray(result.windows) ? result.windows : [],
          extras: Array.isArray(result.extras) ? result.extras : [],
          fetchedAt: Date.now(),
        };
      } catch (error) {
        return { provider: route, adapter: adapter.id, label: adapter.label, displayName, ok: false, configured: true, error: String(error?.message ?? "request failed") };
      }
    })));
    const series = await quotaSeriesOf();
    const result = { schema: 1, generatedAt: Date.now(), providers, series };
    // A pass where every live provider answered caches like the balance does;
    // disabled or unconfigured routes are not failures, but any real failure
    // stays uncached so the next poll retries it.
    if (providers.every((entry) => entry.ok === true || entry.configured === false || entry.disabled === true)) {
      quotaCache.at = Date.now();
      quotaCache.result = result;
    }
    json(res, 200, result);
  };
  return { serveQuota };
}
