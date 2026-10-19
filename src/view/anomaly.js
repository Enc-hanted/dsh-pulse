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
 * Total tokens of one day-bucket (input + output + both cache directions —
 * the same burn the heatmaps chart).
 *
 * @param {{input?: number, output?: number, cacheRead?: number, cacheWrite?: number}} bucket
 * @returns {number}
 */
const dayTokens = (bucket) =>
  (bucket?.input ?? 0) + (bucket?.output ?? 0) + (bucket?.cacheRead ?? 0) + (bucket?.cacheWrite ?? 0);

/** Ascending numeric sort helper. */
const asc = (a, b) => a - b;

/**
 * One windowed session record as served by `/pulse/stats` (a `sliceRecord`
 * output of the host fold): per-day maps keyed `YYYY-MM-DD`, model maps
 * keyed by the composite `provider\u0000model`. Map values stay loose —
 * every reader guards shapes at runtime.
 *
 * @typedef {object} WindowedRecord
 * @property {string|null} [id]
 * @property {string|null} [title]
 * @property {Object.<string, any>} [byDay] - day → token totals.
 * @property {Object.<string, Object.<string, Object.<string, any>>>} [hoursByDay]
 * @property {Object.<string, Object.<string, number>>} [toolHistogramByDay] - day → tool → count.
 */

/**
 * Burn-rate spikes: days whose total token burn exceeds the P95 of the
 * preceding `lookback` days by at least `factor`, with a floor so quiet
 * histories never manufacture spikes out of noise.
 *
 * @param {Array<WindowedRecord>} records - sliced session records (`byDay` buckets).
 * @param {object} [options]
 * @param {number} [options.lookback=7] - days of history each day is compared against.
 * @param {number} [options.factor=3] - spike threshold as a multiple of baseline.
 * @param {number} [options.minTokens=20000] - absolute floor: smaller days are never spikes.
 * @param {number} [options.limit=5] - most recent spikes first, capped.
 * @returns {Array<{day: string, tokens: number, baseline: number, ratio: number}>}
 */
export function burnRateSpikes(records, { lookback = 7, factor = 3, minTokens = 20000, limit = 5 } = {}) {
  const totals = new Map();
  for (const record of records) {
    for (const [day, bucket] of Object.entries(record.byDay ?? {})) {
      totals.set(day, (totals.get(day) ?? 0) + dayTokens(bucket));
    }
  }
  const days = [...totals.keys()].sort();
  const out = [];
  for (let i = 0; i < days.length; i += 1) {
    const history = days.slice(Math.max(0, i - lookback), i).map((d) => totals.get(d));
    if (history.length < 3) continue;
    history.sort(asc);
    const rank = Math.min(history.length - 1, Math.ceil(0.95 * history.length) - 1);
    const baseline = history[rank];
    const tokens = totals.get(days[i]);
    if (baseline <= 0 || tokens < minTokens || tokens < factor * baseline) continue;
    out.push({ day: days[i], tokens, baseline, ratio: Math.round((tokens / baseline) * 10) / 10 });
  }
  return out.slice(-limit).reverse();
}

/**
 * Runaway-loop fingerprints: one session, one day, ONE tool called at least
 * `minCalls` times while that day's token burn is at least `factor` times
 * the session's median active day — the signature of a stuck repetition
 * rather than deliberate batch work (which spreads across tools and days).
 *
 * @param {Array<WindowedRecord>} records - sliced session records (`byDay`, `toolHistogramByDay`).
 * @param {object} [options]
 * @param {number} [options.minCalls=25] - per-tool per-day call floor.
 * @param {number} [options.factor=4] - day-burn multiple over the session's median day.
 * @param {number} [options.limit=5] - strongest fingerprints first, capped.
 * @returns {Array<{sessionId: string, title: string|null, day: string, tool: string,
 *   count: number, dayTokens: number, medianDayTokens: number}>}
 */
export function loopFingerprints(records, { minCalls = 25, factor = 4, limit = 5 } = {}) {
  const out = [];
  for (const record of records) {
    const histogram = record.toolHistogramByDay ?? {};
    const burns = Object.values(record.byDay ?? {}).map(dayTokens).sort(asc);
    if (burns.length === 0) continue;
    const median = burns[Math.floor(burns.length / 2)];
    if (median <= 0) continue;
    for (const [day, tools] of Object.entries(histogram)) {
      const tokens = dayTokens(record.byDay?.[day]);
      if (tokens < factor * median) continue;
      for (const [tool, count] of Object.entries(tools)) {
        if (count >= minCalls) {
          out.push({
            sessionId: record.id ?? "(unknown)",
            title: record.title ?? null,
            day, tool, count,
            dayTokens: tokens,
            medianDayTokens: median,
          });
        }
      }
    }
  }
  return out.sort((a, b) => b.count - a.count).slice(0, limit);
}

/**
 * The `/pulse/stats` anomaly block: both detectors, observational shape
 * only. Absent histogram data (records folded before stateVersion 11)
 * simply yields no loop fingerprints — never an error.
 *
 * @param {Array<object>} records - sliced session records.
 * @returns {{burnRate: Array<object>, loops: Array<object>}}
 */
export function detectAnomalies(records) {
  return { burnRate: burnRateSpikes(records), loops: loopFingerprints(records) };
}
