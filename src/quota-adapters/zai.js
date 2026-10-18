/**
 * z.ai / bigmodel coding plan quota adapter (GLM Coding Plan).
 *
 * `GET /api/monitor/usage/quota/limit` for the window utilization (token
 * windows report a percentage only — the CN console hides absolute counts)
 * plus `GET /api/biz/subscription/list` for the plan name and fee. Verified
 * live against open.bigmodel.cn (Bearer auth) and documented for api.z.ai
 * by openusage/CodexBar. The parse half is pure and fixture-covered
 * (test/fixtures/quota/zai/), so endpoint drift surfaces as a conformance
 * failure, never as fabricated numbers.
 */

import { fetchJson, matchRoutes, qclampPct, qnum, qstr, qtime, windowOrder } from "./shared.js";

/** (unit, number) → window id/span for z.ai's limit encoding. Observed
 *  pairs: (3,5) = 5-hour session window, (6,1) = weekly on the CN console,
 *  (6,7) = weekly internationally, (5,1) = monthly tool quota. */
const zaiWindowSpec = (unit, number) => {
  if (unit === 3) return { id: number === 5 ? "5h" : `h${number}`, windowMs: number > 0 ? number * 3600000 : null };
  if (unit === 6) return { id: "7d", windowMs: 7 * 86400000 };
  if (unit === 5) return { id: "month", windowMs: 30 * 86400000 };
  return { id: unit !== null && number !== null ? `u${unit}n${number}` : "window", windowMs: null };
};

/** Parse the two z.ai replies into the normalized result (pure). The
 *  subscription reply may be null — its endpoint is optional and the fetch
 *  half already mapped a failure to null. Duplicate window ids keep the
 *  first occurrence ((6,1) and (6,7) both encode "7d", one console at a
 *  time). */
export const parseZaiQuota = (quotaRes, subRes) => {
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

/** The fetch half: both endpoints under one header, then the pure parse. */
const zaiFetchQuota = async ({ host, resolveCredential }) => {
  const { value: key } = await resolveCredential();
  const headers = { authorization: `Bearer ${key}`, accept: "application/json" };
  const [quotaRes, subRes] = await Promise.all([
    fetchJson(`${host}/api/monitor/usage/quota/limit`, headers),
    fetchJson(`${host}/api/biz/subscription/list`, headers).catch(() => null),
  ]);
  return parseZaiQuota(quotaRes, subRes);
};

/** The adapter object (contract: ./types.js). */
export const zaiAdapter = {
  id: "zai-coding",
  label: "GLM Coding Plan",
  envKeys: ["ZAI_CODING_CN_API_KEY", "GLM_CODING_CN_API_KEY", "ZAI_API_KEY", "GLM_API_KEY"],
  match: matchRoutes(["zai-coding-cn", "zai-coding", "zai"]),
  hostFor: (route) => (route === "zai-coding-cn" ? "https://open.bigmodel.cn" : "https://api.z.ai"),
  fetchQuota: zaiFetchQuota,
};
