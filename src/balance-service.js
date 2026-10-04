/**
 * DeepSeek official balance service — the handler behind `GET /pulse/balance`.
 *
 * Security posture: the key is resolved per operation through the
 * credentials seam (the same DEEPSEEK_API_KEY the web Models page writes)
 * and lives only in one outbound Authorization header — never in a
 * response, a log line, an error message, or the store. Only parsed money
 * totals persist, as rolling snapshots in a storage-domain global
 * (opened through ./rolling-domain.js). The connection facts (per-route
 * `apiKeyEnv` / `baseURL` overrides) arrive as the `deepseekSection`
 * accessor — the host half owns the settings seam, the service owns the wire.
 */

import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { defineDomain } from "@deepseek-ai/dsh-storage-domain";
import { z as zv } from "zod";

import { openRollingGlobalDomain } from "./rolling-domain.js";
import { json } from "./http-helpers.js";

// --- DeepSeek official balance ------------------------------------------------
/** Live balance replies are cached this long (the response only — the API
 *  key is re-resolved through the credentials seam on every actual fetch,
 *  per that seam's per-operation contract). */
const BALANCE_CACHE_MS = 60000;
/** Outbound balance-request budget; a hung provider must not pin a handler. */
const BALANCE_TIMEOUT_MS = 10000;
/** Snapshots older than this roll out of the store; the cap bounds a
 *  snapshot-per-minute pathological write rate. */
const SNAPSHOT_ROLL_MS = 30 * 24 * 3600 * 1000;
const SNAPSHOT_MAX = 1000;
/** Near-identical consecutive readings collapse into one snapshot. */
const SNAPSHOT_DEDUPE_MS = 5 * 60 * 1000;

/** Rolling balance history: money totals only — never the key, the ref, or
 *  any raw provider payload. The reconciliation overlay (官方扣费) reads
 *  this through `/pulse/stats`'s `balanceSeries`. */
const balanceDomainSpec = defineDomain({
name: "pulse_balance",
version: 0,
tables: {},
global: {
  schema: zv.object({ snapshots: zv.array(zv.object({ t: zv.number().int().min(0), total: zv.number() })).max(SNAPSHOT_MAX) }),
  initial: { snapshots: [] },
},
});

/**
 * Create the balance service. `deepseekSection()` returns the official
 * adapter's settings namespace value (or undefined on hosts without one).
 *
 * @returns {{snapshotsOf: () => Promise<Array<{t: number, total: number}>|null>,
 *   serveBalance: (req: object, res: object, url: URL) => Promise<void>}}
 */
export function createBalanceService({ ctx, deepseekSection }) {
  const openBalanceDomain = openRollingGlobalDomain(ctx, balanceDomainSpec, "dsh-pulse: balance domain");

  const snapshotsOf = async () => {
    const domain = await openBalanceDomain();
    if (domain === null) return null;
    try {
      const snaps = domain.global.get()?.snapshots;
      return Array.isArray(snaps) ? snaps : null;
    } catch {
      return null;
    }
  };

  /** The official adapter's connection facts: its settings namespace's
   *  `apiKeyEnv` / `baseURL` overrides, or the public defaults. */
  const deepseekConnection = () => {
    let section = null;
    try {
      const raw = deepseekSection();
      if (raw !== null && typeof raw === "object") section = raw;
    } catch {
      // An unreadable section falls back to the public defaults.
    }
    const apiKeyEnv = typeof section?.apiKeyEnv === "string" && section.apiKeyEnv.length > 0
      ? section.apiKeyEnv : "DEEPSEEK_API_KEY";
    let base = "https://api.deepseek.com";
    if (typeof section?.baseURL === "string" && section.baseURL.length > 0) {
      try {
        const url = new URL(section.baseURL);
        if (url.protocol === "https:" || url.protocol === "http:") base = url.toString();
      } catch {
        // A malformed override keeps the official endpoint.
      }
    }
    return { apiKeyEnv, balanceUrl: `${base.replace(/\/+$/, "")}/user/balance` };
  };

  const recordSnapshot = async (result) => {
    // The overlay diffs CNY totals; other currencies stay out of the store.
    if (result.currency !== "CNY") return;
    const domain = await openBalanceDomain();
    if (domain === null) return;
    try {
      const current = domain.global.get();
      const snaps = Array.isArray(current?.snapshots) ? current.snapshots.slice() : [];
      const last = snaps[snaps.length - 1];
      if (last !== undefined && result.fetchedAt - last.t < SNAPSHOT_DEDUPE_MS && last.total === result.total) return;
      snaps.push({ t: result.fetchedAt, total: result.total });
      const cutoff = result.fetchedAt - SNAPSHOT_ROLL_MS;
      await domain.global.set({ snapshots: snaps.filter((s) => s.t >= cutoff).slice(-SNAPSHOT_MAX) });
    } catch {
      // A failed snapshot write never breaks the balance reply.
    }
  };
  const fetchBalance = async () => {
    const credentials = typeof ctx.get === "function" ? ctx.get("credentials") : null;
    if (credentials === null || typeof credentials?.resolve !== "function") return { configured: false };
    const { apiKeyEnv, balanceUrl } = deepseekConnection();
    let key = "";
    try {
      const hit = await credentials.resolve(credentialRef(apiKeyEnv));
      key = typeof hit?.value === "string" ? hit.value.trim() : "";
    } catch {
      key = "";
    }
    if (key === "") return { configured: false, ref: apiKeyEnv };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BALANCE_TIMEOUT_MS);
    try {
      const response = await fetch(balanceUrl, {
        headers: { authorization: `Bearer ${key}` },
        redirect: "error",
        signal: controller.signal,
      });
      if (response.ok !== true) return { configured: true, ok: false, error: `HTTP ${response.status}` };
      const body = await response.json();
      const infos = Array.isArray(body?.balance_infos) ? body.balance_infos : [];
      const info = infos.find((entry) => entry?.currency === "CNY") ?? infos[0];
      const total = Number(info?.total_balance);
      if (info === undefined || Number.isFinite(total) !== true) {
        return { configured: true, ok: false, error: "unparsable balance payload" };
      }
      const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
      const result = {
        configured: true,
        ok: true,
        isAvailable: body?.is_available === true,
        currency: typeof info.currency === "string" ? info.currency : "CNY",
        total,
        granted: num(info.granted_balance),
        topped: num(info.topped_up_balance),
        fetchedAt: Date.now(),
      };
      await recordSnapshot(result);
      return result;
    } catch (error) {
      // Cause codes and error names only — they carry no URL and no key.
      return { configured: true, ok: false, error: String(error?.cause?.code ?? error?.name ?? "request failed") };
    } finally {
      clearTimeout(timer);
    }
  };
  const balanceCache = { at: 0, result: null };
  const serveBalance = async (req, res, url) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      json(res, 405, { error: "method not allowed" });
      return;
    }
    const refresh = url.searchParams.get("refresh") === "1";
    if (!refresh && balanceCache.result !== null && Date.now() - balanceCache.at < BALANCE_CACHE_MS) {
      json(res, 200, { ...balanceCache.result, cached: true });
      return;
    }
    const result = await fetchBalance();
    if (result.ok === true) {
      balanceCache.at = Date.now();
      balanceCache.result = result;
    }
    json(res, 200, result);
  };
  return { snapshotsOf, serveBalance };
}
