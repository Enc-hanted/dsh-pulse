/**
 * Kimi For Coding quota adapter.
 *
 * `GET /coding/v1/usages`. The rendering norm every adapter follows: a
 * window carries used/total counts ONLY when the provider states a true
 * absolute quota — a ratio-only source renders a percentage track and
 * never a fabricated "x/100 次" count. Kimi's windows are ratios
 * (`used_ratio`), so they ride pct-only, 5h and 7d alike. The legacy flat
 * `usage` object keeps ratio precedence. Verified live against api.kimi.com.
 * The parse half is pure and fixture-covered (test/fixtures/quota/kimi/).
 */

import { fetchJson, matchRoutes, qclampPct, qnum, qstr, qtime, windowOrder } from "./shared.js";

/** Parse the usages reply into the normalized result (pure). */
export const parseKimiUsages = (body) => {
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

/** The fetch half: one bounded GET, then the pure parse. */
const kimiFetchQuota = async ({ host, resolveCredential }) => {
  const { value: key } = await resolveCredential();
  const body = await fetchJson(`${host}/coding/v1/usages`, { authorization: `Bearer ${key}`, accept: "application/json" });
  return parseKimiUsages(body);
};

/** The adapter object (contract: ./types.js). */
export const kimiAdapter = {
  id: "kimi-coding",
  label: "Kimi For Coding",
  envKeys: ["KIMI_CODING_API_KEY", "KIMI_API_KEY"],
  match: matchRoutes(["kimi-coding", "kimi"]),
  hostFor: () => "https://api.kimi.com",
  fetchQuota: kimiFetchQuota,
};
