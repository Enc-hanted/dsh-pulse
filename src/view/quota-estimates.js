/**
 * View model — quota estimates: local token slices over ms windows,
 * used-vs-local calibration, burn-rate forecast, and plan-fee
 * attribution math the quota card renders. Pure ms/record math —
 * the bundle cannot import node-side modules.
 */

import { splitModelKey } from "./keys.js";

const QUOTA_DAY_MS = 86400000;

const QUOTA_HOUR_MS = 3600000;

/** Local midnight (epoch ms) of a `YYYY-MM-DD` day key (view-model copy of
 *  the host aggregate helper; the bundle cannot import node-side modules). */
export function quotaDayStart(day) {
  const [y, m, d] = String(day).split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

/** Sum one per-day/per-hour model map's entries belonging to one provider
 *  route. Model keys are `provider\0model` composites; legacy bare ids carry
 *  no provider and only match an empty route. Returns null for no match. */
function providerTokensOf(byModel, provider) {
  if (byModel === null || typeof byModel !== "object") return null;
  let acc = null;
  for (const [key, tokens] of Object.entries(byModel)) {
    if (tokens === null || typeof tokens !== "object") continue;
    if (splitModelKey(key).provider !== provider) continue;
    const row = { input: quotaNum(tokens.input), output: quotaNum(tokens.output), cacheRead: quotaNum(tokens.cacheRead), cacheWrite: quotaNum(tokens.cacheWrite) };
    if (row.input + row.output + row.cacheRead + row.cacheWrite <= 0) continue;
    if (acc === null) acc = row;
    else {
      acc.input += row.input;
      acc.output += row.output;
      acc.cacheRead += row.cacheRead;
      acc.cacheWrite += row.cacheWrite;
    }
  }
  return acc;
}

function quotaAddInto(acc, row) {
  acc.input += row.input;
  acc.output += row.output;
  acc.cacheRead += row.cacheRead;
  acc.cacheWrite += row.cacheWrite;
}

export const quotaEmpty = () => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });

function quotaNum(value) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Walk one provider's local token usage over `[fromMs, toMs)`, visiting each
 * session record's slice. Day-granular maps serve whole days; the boundary
 * days use the 3-day `hoursByDay` retention at hour resolution — when a day
 * carries hour maps at all they are authoritative (the fold records every
 * usage event, so a missing hour bucket means zero usage, which the coverage
 * audit relies on), and only days without any hour coverage fall back to a
 * proportional share of the day's totals (clearly an estimate; the caller
 * labels it as one).
 *
 * @param {Array<object>} sessions - payload session records.
 * @param {number} fromMs - window start (inclusive, epoch ms).
 * @param {number} toMs - window end (exclusive, epoch ms).
 * @param {string} provider - provider route id to attribute to.
 * @param {(project: string, tokens: object, weight: number) => void} visit - sink.
 */
function quotaEachSlice(sessions, fromMs, toMs, provider, visit) {
  const from = Math.floor(Number(fromMs));
  const to = Math.floor(Number(toMs));
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return;
  for (const record of Array.isArray(sessions) ? sessions : []) {
    if (record === null || typeof record !== "object") continue;
    const project = record.project === null || record.project === undefined ? "" : String(record.project);
    const modelsByDay = record.modelsByDay ?? {};
    const hoursByDay = record.hoursByDay ?? {};
    const days = new Set(Object.keys(modelsByDay));
    for (const day of days) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
      const startMs = quotaDayStart(day);
      const endMs = startMs + QUOTA_DAY_MS;
      if (endMs <= from || startMs >= to) continue;
      const dayTokens = providerTokensOf(modelsByDay[day], provider);
      if (dayTokens === null) continue;
      if (from <= startMs && to >= endMs) {
        visit(project, dayTokens, 1);
        continue;
      }
      // Partial day: hour maps win when the day carries them at all — and
      // they are exact, so hours without a bucket contribute zero.
      const dayHours = hoursByDay[day];
      if (dayHours !== null && typeof dayHours === "object") {
        let hourAcc = null;
        for (const [hh, byModel] of Object.entries(dayHours)) {
          const hourIdx = Number(hh);
          if (!Number.isInteger(hourIdx) || hourIdx < 0 || hourIdx > 23) continue;
          const hStart = startMs + hourIdx * QUOTA_HOUR_MS;
          if (hStart + QUOTA_HOUR_MS <= from || hStart >= to) continue;
          const part = providerTokensOf(byModel, provider);
          if (part === null) continue;
          if (hourAcc === null) hourAcc = { ...part };
          else quotaAddInto(hourAcc, part);
        }
        if (hourAcc !== null) visit(project, hourAcc, 1);
        continue;
      }
      // No hour coverage for this day: proportional estimate.
      const overlap = Math.min(to, endMs) - Math.max(from, startMs);
      const frac = Math.max(0, Math.min(1, overlap / QUOTA_DAY_MS));
      if (frac <= 0) continue;
      visit(project, dayTokens, frac);
    }
  }
}

/**
 * Local tokens one provider consumed inside a time range (the reconciliation
 * half of a quota window: server-side percentage ↔ locally recorded tokens).
 *
 * @param {Array<object>} sessions - payload session records.
 * @param {number} fromMs - window start (inclusive, epoch ms).
 * @param {number} toMs - window end (exclusive, epoch ms).
 * @param {string} provider - provider route id.
 * @returns {{input: number, output: number, cacheRead: number, cacheWrite: number, total: number}}
 */
export function quotaWindowTokens(sessions, fromMs, toMs, provider) {
  const acc = quotaEmpty();
  quotaEachSlice(sessions, fromMs, toMs, provider, (_project, tokens, weight) => {
    acc.input += tokens.input * weight;
    acc.output += tokens.output * weight;
    acc.cacheRead += tokens.cacheRead * weight;
    acc.cacheWrite += tokens.cacheWrite * weight;
  });
  acc.total = acc.input + acc.output + acc.cacheRead + acc.cacheWrite;
  return acc;
}

/**
 * Coverage audit for one provider's token calibration: reconcile consecutive
 * utilization snapshots against the tokens dsh recorded in the same
 * intervals. The provider's percentage is always authoritative — this only
 * decides whether translating it into token units may be shown at all.
 *
 *  - `external`: some interval where the provider's utilization moved (≥2
 *    points) while dsh recorded nothing — the key is being spent outside
 *    dsh, so any dsh-derived total would understate; the client suppresses
 *    the token estimates.
 *  - `ok`: ≥2 intervals with local usage whose per-point token amount stays
 *    within a 4× band — the calibration factor is stable enough to show.
 *  - `thin`: not enough evidence either way (fewer than 2 usable intervals);
 *    the client may show the estimate but must label it unverified.
 *
 * @param {Array<{t: number, provider: string, window: string, pct: number}>} series
 *   - the host's utilization snapshot points (any window mix; this audit is
 *   per provider, window-agnostic — intervals are chronological).
 * @param {Array<object>} sessions - payload session records.
 * @param {string} provider - provider route id.
 * @param {{fromMs?: number, toMs?: number}} [bounds] - the span the session
 *   records actually cover (the payload window). Intervals reaching outside
 *   it are skipped: their zero local tokens would be an artifact of the cut,
 *   not evidence of off-dsh spend.
 * @returns {{state: "ok"|"external"|"thin", intervals: number}}
 */
export function quotaCoverage(series, sessions, provider, bounds = {}) {
  const fromMs = Number(bounds?.fromMs);
  const toMs = Number(bounds?.toMs);
  const hasBounds = Number.isFinite(fromMs) && Number.isFinite(toMs) && toMs > fromMs;
  const points = (Array.isArray(series) ? series : [])
    .filter((p) => p !== null && typeof p === "object" && p.provider === provider)
    .map((p) => ({ t: quotaNum(p.t), pct: Number(p.pct) }))
    .filter((p) => p.t > 0 && Number.isFinite(p.pct) && p.pct >= 0 && p.pct <= 100)
    .sort((a, b) => a.t - b.t);
  const ratios = [];
  let external = false;
  for (let i = 1; i < points.length; i += 1) {
    const start = points[i - 1].t;
    const end = points[i].t;
    if (hasBounds && (start < fromMs || end > toMs)) continue;
    const deltaPct = points[i].pct - points[i - 1].pct;
    const deltaMs = end - start;
    if (deltaMs < 600000) continue; // sub-10-minute gaps are poll noise
    if (deltaPct <= 0) continue;
    const local = localTokensBetween(sessions, start, end, provider);
    if (local <= 0) {
      // Utilization moved without dsh touching the key in that interval.
      if (deltaPct >= 2) external = true;
      continue;
    }
    if (deltaPct >= 1) ratios.push(local / deltaPct);
  }
  if (external) return { state: "external", intervals: ratios.length };
  if (ratios.length >= 2) {
    const min = Math.min(...ratios);
    const max = Math.max(...ratios);
    return { state: max / min <= 4 ? "ok" : "thin", intervals: ratios.length };
  }
  return { state: "thin", intervals: ratios.length };
}

/** Local tokens in one interval (the raw number quotaCoverage compares). */
function localTokensBetween(sessions, fromMs, toMs, provider) {
  return quotaWindowTokens(sessions, fromMs, toMs, provider).total;
}

/**
 * Attribute one provider's window burn to projects: token totals per project
 * label, descending, with the share of the whole. The baseline for the
 * monthly-fee apportionment (成本分摊) and for "which project eats the plan".
 *
 * @param {Array<object>} sessions - payload session records.
 * @param {number} fromMs - window start (inclusive, epoch ms).
 * @param {number} toMs - window end (exclusive, epoch ms).
 * @param {string} provider - provider route id.
 * @returns {Array<{project: string, input: number, output: number, cacheRead: number, cacheWrite: number, total: number, share: number}>}
 */
export function quotaProjectAttribution(sessions, fromMs, toMs, provider) {
  const byProject = new Map();
  let grand = 0;
  quotaEachSlice(sessions, fromMs, toMs, provider, (project, tokens, weight) => {
    const row = byProject.get(project) ?? { project, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 };
    row.input += tokens.input * weight;
    row.output += tokens.output * weight;
    row.cacheRead += tokens.cacheRead * weight;
    row.cacheWrite += tokens.cacheWrite * weight;
    row.total = row.input + row.output + row.cacheRead + row.cacheWrite;
    byProject.set(project, row);
    grand += (tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite) * weight;
  });
  return [...byProject.values()]
    .map((row) => ({ ...row, share: grand > 0 ? row.total / grand : 0 }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Calibrate a quota window's absolute size from the pair the provider does
 * not expose: its reported utilization and the tokens dsh recorded locally
 * over the same span. Only meaningful when dsh carries (nearly) all of that
 * key's traffic — the panel labels the result as an estimate for exactly
 * that reason. `usedPct <= 0` cannot calibrate (no signal), and a zero local
 * total means "dsh saw nothing" — also no estimate.
 *
 * @param {number} usedPct - provider-reported utilization, 0–100.
 * @param {number} localTokens - locally recorded tokens over the same span.
 * @returns {{totalEst: number, remainingEst: number, basisTokens: number}|null}
 */
export function quotaCalibrate(usedPct, localTokens) {
  const pct = Number(usedPct);
  const local = Number(localTokens);
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100 || !Number.isFinite(local) || local <= 0) return null;
  const totalEst = local / (pct / 100);
  return { totalEst, remainingEst: Math.max(0, totalEst - local), basisTokens: local };
}

/**
 * Linear burn forecast over one window's utilization snapshot series (the
 * host stores every query as a `{t, provider, window, pct}` point). Two
 * points spanning at least ten minutes yield a percent-per-hour slope, the
 * projected exhaustion instant, and — when the provider reports a reset —
 * the projected utilization at that reset.
 *
 * @param {Array<{t: number, pct: number}>} points - ascending utilization samples.
 * @param {number} [now] - clock override for tests.
 * @param {number|null} [resetsAt] - the window's next reset (epoch ms).
 * @returns {{perHour: number, pct: number, from: number, to: number, exhaustsAt?: number, pctAtReset?: number}|null}
 */
export function quotaBurn(points, now = Date.now(), resetsAt = null) {
  void now;
  const list = (Array.isArray(points) ? points : [])
    .map((p) => ({ t: quotaNum(p?.t), pct: Number(p?.pct) }))
    .filter((p) => p.t > 0 && Number.isFinite(p.pct) && p.pct >= 0 && p.pct <= 100)
    .sort((a, b) => a.t - b.t);
  if (list.length < 2) return null;
  const first = list[0];
  const last = list[list.length - 1];
  const hours = (last.t - first.t) / 3600000;
  if (!(hours >= 1 / 6)) return null;
  const perHour = (last.pct - first.pct) / hours;
  const out = { perHour, pct: last.pct, from: first.t, to: last.t };
  if (perHour > 0) out.exhaustsAt = last.t + ((100 - last.pct) / perHour) * 3600000;
  const reset = Number(resetsAt);
  if (Number.isFinite(reset) && reset > last.t) {
    out.pctAtReset = Math.max(0, Math.min(100, last.pct + (perHour * (reset - last.t)) / 3600000));
  }
  return out;
}

/**
 * Normalize a plan fee into a per-month amount. Fees arrive from the
 * subscription endpoint (`{amount, currency, cycle}`); cycles map to their
 * month counts (monthly 1, quarterly 3, semiannual 6, annual 12). Unknown
 * cycles yield null — the panel then shows shares without money.
 *
 * @param {{amount: number, currency: string, cycle: string}|null} fee
 * @returns {{monthly: number, currency: string}|null}
 */
export function quotaMonthlyFee(fee) {
  const amount = Number(fee?.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const divisor = { monthly: 1, quarterly: 3, semiannually: 6, annually: 12, yearly: 12 }[fee?.cycle];
  if (divisor === undefined) return null;
  const currency = typeof fee?.currency === "string" && fee.currency !== "" ? fee.currency : "CNY";
  return { monthly: amount / divisor, currency };
}

/**
 * One project's share of the plan's monthly fee: the fee spread over the
 * window's local tokens in proportion to the project's own. Null when either
 * side is missing — no fee (Kimi hides pricing) or no tokens (nothing to
 * apportion). This is the monthly-paid model's "cost": not marginal, but a
 * fair split of the fixed subscription.
 *
 * @param {{amount: number, currency: string, cycle: string}|null} fee
 * @param {number} projectTokens - the project's token total over the span.
 * @param {number} totalTokens - all tokens over the span.
 * @returns {number|null} the project's share of one month of the plan.
 */
export function quotaFeeShare(fee, projectTokens, totalTokens) {
  const monthly = quotaMonthlyFee(fee);
  const total = Number(totalTokens);
  const part = Number(projectTokens);
  if (monthly === null || !Number.isFinite(total) || total <= 0 || !Number.isFinite(part) || part <= 0) return null;
  return monthly.monthly * (part / total);
}
