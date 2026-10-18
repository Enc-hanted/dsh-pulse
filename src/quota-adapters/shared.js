/**
 * Shared plumbing for the built-in quota adapters (src/quota-adapters/):
 * the defensive normalization helpers, the window sort key, the bounded
 * outbound JSON GET, and the default route-claim predicate — one
 * definition each, so every adapter normalizes identically (the
 * conformance fixtures under test/fixtures/quota/ pin the shared shapes).
 *
 * Contract: ./types.js. Orchestration: ../quota-service.js.
 */

/** Outbound quota-request budget; a hung provider must not pin a handler. */
const QUOTA_TIMEOUT_MS = 10000;

/** One defensive number: finite → number, anything else → null. */
export const qnum = (value) => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};
export const qclampPct = (value) => {
  const n = qnum(value);
  return n === null ? null : Math.max(0, Math.min(100, n));
};
/** Provider reset timestamps come in epoch ms, epoch s, or ISO strings with
 *  over-long fractional seconds; normalize all three to epoch ms. */
export const qtime = (value) => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value >= 1e12 ? Math.round(value) : Math.round(value * 1000);
  if (typeof value === "string" && value !== "") {
    const normalized = value.replace(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3})\d+/, "$1");
    const parsed = Date.parse(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};
export const qstr = (value) => (typeof value === "string" && value.length > 0 ? value : null);

/** Sort key: shorter (more immediate) windows first; unknown spans last. */
export const windowOrder = (a, b) => (a.windowMs ?? Infinity) - (b.windowMs ?? Infinity);

/** One JSON GET with the shared outbound posture: bounded, redirect-free,
 *  and failures mapped to cause codes only (no URLs, no keys). */
export const fetchJson = async (url, headers) => {
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

/** The default route-claim predicate: an adapter claims exactly the
 *  provider ids it lists. `describeRow` (the settings forms' row for the
 *  route) is accepted and ignored by the built-ins — an external adapter
 *  may claim by connection shape instead of id. */
export const matchRoutes = (routes) => (providerId, _describeRow) => routes.includes(providerId);
