/**
 * View model — quota estimates: local token slices over ms windows,
 * used-vs-local calibration, burn-rate forecast, and plan-fee
 * attribution math the quota card renders. Pure ms/record math —
 * the bundle cannot import node-side modules.
 */
/** Local midnight (epoch ms) of a `YYYY-MM-DD` day key (view-model copy of
 *  the host aggregate helper; the bundle cannot import node-side modules). */
export declare function quotaDayStart(day: any): number;
export declare const quotaEmpty: () => {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
};
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
export declare function quotaWindowTokens(sessions: Array<object>, fromMs: number, toMs: number, provider: string): {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
};
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
export declare function quotaCoverage(series: Array<{
    t: number;
    provider: string;
    window: string;
    pct: number;
}>, sessions: Array<object>, provider: string, bounds?: {
    fromMs?: number;
    toMs?: number;
}): {
    state: "ok" | "external" | "thin";
    intervals: number;
};
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
export declare function quotaProjectAttribution(sessions: Array<object>, fromMs: number, toMs: number, provider: string): Array<{
    project: string;
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
    share: number;
}>;
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
export declare function quotaCalibrate(usedPct: number, localTokens: number): {
    totalEst: number;
    remainingEst: number;
    basisTokens: number;
} | null;
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
export declare function quotaBurn(points: Array<{
    t: number;
    pct: number;
}>, now?: number, resetsAt?: number | null): {
    perHour: number;
    pct: number;
    from: number;
    to: number;
    exhaustsAt?: number;
    pctAtReset?: number;
} | null;
/**
 * Normalize a plan fee into a per-month amount. Fees arrive from the
 * subscription endpoint (`{amount, currency, cycle}`); cycles map to their
 * month counts (monthly 1, quarterly 3, semiannual 6, annual 12). Unknown
 * cycles yield null — the panel then shows shares without money.
 *
 * @param {{amount: number, currency: string, cycle: string}|null} fee
 * @returns {{monthly: number, currency: string}|null}
 */
export declare function quotaMonthlyFee(fee: {
    amount: number;
    currency: string;
    cycle: string;
} | null): {
    monthly: number;
    currency: string;
} | null;
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
export declare function quotaFeeShare(fee: {
    amount: number;
    currency: string;
    cycle: string;
} | null, projectTokens: number, totalTokens: number): number | null;
