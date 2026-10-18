/**
 * Anomaly detection — pure functions over the sliced per-session records
 * the `/pulse/stats` fold already produces. No new storage, no new events,
 * no clock reads: everything here is derived on the fly and thrown away.
 *
 * The posture is strictly observational: these functions return NUMBERS and
 * IDENTIFIERS (days, tool names, ratios) and never verdicts about the user.
 * Copy discipline (enforced by style-test's banned-words assertion on the
 * `anomaly.*` locale keys): the UI may state "today: X, P95 of the last 7
 * days: Y", never "you should / consider / is it worth it".
 */
/**
 * Burn-rate spikes: days whose total token burn exceeds the P95 of the
 * preceding `lookback` days by at least `factor`, with a floor so quiet
 * histories never manufacture spikes out of noise.
 *
 * @param {Array<object>} records - sliced session records (`byDay` buckets).
 * @param {object} [options]
 * @param {number} [options.lookback=7] - days of history each day is compared against.
 * @param {number} [options.factor=3] - spike threshold as a multiple of baseline.
 * @param {number} [options.minTokens=20000] - absolute floor: smaller days are never spikes.
 * @param {number} [options.limit=5] - most recent spikes first, capped.
 * @returns {Array<{day: string, tokens: number, baseline: number, ratio: number}>}
 */
export declare function burnRateSpikes(records: Array<object>, { lookback, factor, minTokens, limit }?: {
    lookback?: number;
    factor?: number;
    minTokens?: number;
    limit?: number;
}): Array<{
    day: string;
    tokens: number;
    baseline: number;
    ratio: number;
}>;
/**
 * Runaway-loop fingerprints: one session, one day, ONE tool called at least
 * `minCalls` times while that day's token burn is at least `factor` times
 * the session's median active day — the signature of a stuck repetition
 * rather than deliberate batch work (which spreads across tools and days).
 *
 * @param {Array<object>} records - sliced session records (`byDay`, `toolHistogramByDay`).
 * @param {object} [options]
 * @param {number} [options.minCalls=25] - per-tool per-day call floor.
 * @param {number} [options.factor=4] - day-burn multiple over the session's median day.
 * @param {number} [options.limit=5] - strongest fingerprints first, capped.
 * @returns {Array<{sessionId: string, title: string|null, day: string, tool: string,
 *   count: number, dayTokens: number, medianDayTokens: number}>}
 */
export declare function loopFingerprints(records: Array<object>, { minCalls, factor, limit }?: {
    minCalls?: number;
    factor?: number;
    limit?: number;
}): Array<{
    sessionId: string;
    title: string | null;
    day: string;
    tool: string;
    count: number;
    dayTokens: number;
    medianDayTokens: number;
}>;
/**
 * The `/pulse/stats` anomaly block: both detectors, observational shape
 * only. Absent histogram data (records folded before stateVersion 11)
 * simply yields no loop fingerprints — never an error.
 *
 * @param {Array<object>} records - sliced session records.
 * @returns {{burnRate: Array<object>, loops: Array<object>}}
 */
export declare function detectAnomalies(records: Array<object>): {
    burnRate: Array<object>;
    loops: Array<object>;
};
