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
 * the llm service and its describe rows); the provider adapters
 * (./quota-adapters/, contract in ./quota-adapters/types.js) own the wire;
 * this service owns the orchestration only — credential resolution, adapter
 * selection, the reply cache/timeout policy and the snapshot store.
 */

import { credentialKey, credentialRef } from "@deepseek-ai/dsh-credentials";
import { defineDomain } from "@deepseek-ai/dsh-storage-domain";
import { z as zv } from "zod";

import { openRollingGlobalDomain } from "./rolling-domain.js";
import { json } from "./http-helpers.js";
import { kimiAdapter } from "./quota-adapters/kimi.js";
import { minimaxAdapter } from "./quota-adapters/minimax.js";
import { qclampPct, qstr } from "./quota-adapters/shared.js";
import { zaiAdapter } from "./quota-adapters/zai.js";

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

/** Built-in subscription adapters (src/quota-adapters/*.js), in claim
 *  priority order — the first match() to claim a provider id wins. `label`
 *  is the display face every provider entry echoes (the plan name
 *  supersedes it once a query succeeded); `envKeys` are the well-known
 *  ambient names tried after the deployment's own refs. The general quota
 *  norm lives in src/quota-adapters/types.js. */
const QUOTA_ADAPTERS = [zaiAdapter, kimiAdapter, minimaxAdapter];

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
    // describe() rows are keyed by the profile entry's id (renamable), so the
    // row is addressed by its value shape — "the entry that configures this
    // route's credentials" — instead of picking the first object-valued row.
    const fromSetting = llmDescribeOf()?.find((row) => row?.value?.providers?.[route]?.apiKeyEnv !== undefined)?.value?.providers?.[route]?.apiKeyEnv;
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
      json.err(res, 405, "method not allowed");
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
        const adapter = QUOTA_ADAPTERS.find((candidate) => candidate.match(route));
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
        // The route-scoped credential thunk the SPI hands the adapter — the
        // same fact resolved above, so the key still lives only in this one
        // outbound Authorization header.
        const resolveCredential = async () => credential;
        const result = await adapter.fetchQuota({ route, host: adapter.hostFor(route), resolveCredential });
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
