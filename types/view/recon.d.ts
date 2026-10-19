/**
 * View model — reconciliation: the official-bill overlay
 * (`reconcileSeries`), the aux-shape self-calibration and drift alarm,
 * and the per-family rollup the recon table renders.
 */
/** Drift/calibration absolute floor (CNY): below this a gap is settlement
 *  noise — a relative percentage on a near-zero day means nothing. */
export declare const RECON_ABS_FLOOR = 0.1;
/**
 * Per-day reconciliation over the whole corpus (never filtered): the
 * official-channel measured cost, the aux estimate under `auxShape`, the
 * official spend and their gap. Days with unpriced official-channel tokens
 * are flagged — their estimate is incomplete, so calibration and drift
 * checks skip them instead of attributing missing rates to the aux shape.
 * Sparse official days (see `balanceSpendSeries`) pass the flag through and
 * are skipped by calibration and drift for the same reason.
 *
 * @param {Array<any>} sessions - windowed session records (whole corpus, never filtered).
 * @param {{from?: string, to?: string, pricing?: Array<any>, fx?: {usdToCny?: number},
 *   monthly?: string[], auxShape?: any, official?: Array<any>}} [options]
 *   - `from`/`to` bound the day range (`YYYY-MM-DD`, inclusive); `pricing`
 *   holds the user's own (editable) rules; `fx.usdToCny` converts USD-priced
 *   rules; `monthly` lists flat-subscription provider ids; `auxShape` is the
 *   learned/manual aux call shape; `official` is the `balanceSpendSeries`
 *   output the gap is measured against.
 * @returns {Array<{key: string, est: number, aux: number, official: number|null,
 *   gap: number|null, auxCalls: number, unpriced: boolean, sparse: boolean}>}
 */
export declare function reconcileSeries(sessions: Array<any>, { from, to, pricing, fx, monthly, auxShape, official }?: {
    from?: string;
    to?: string;
    pricing?: Array<any>;
    fx?: {
        usdToCny?: number;
    };
    monthly?: string[];
    auxShape?: any;
    official?: Array<any>;
}): Array<{
    key: string;
    est: number;
    aux: number;
    official: number | null;
    gap: number | null;
    auxCalls: number;
    unpriced: boolean;
    sparse: boolean;
}>;
/**
 * The aux shape self-calibration over a {@link reconcileSeries} result.
 *
 * Mechanism (per the 0.5 design review): the OUTPUT component is measured
 * near-exact and frozen; one input-side scalar `s` scales miss/hit. Each
 * complete, fully-priced day with aux calls implies `s = (aux + gap) / aux`
 * (clamped to [0.5, 3] — outside means something else moved the balance);
 * days WITHOUT aux calls act as controls — any residual there is unmodeled
 * consumption, which must suspend learning rather than poison the shape.
 * Sparse days (a snapshot gap spans them; their official number is an
 * interval estimate, see `balanceSpendSeries`) never sample and never
 * control — their gap mixes several days and proves nothing about one.
 * ≥3 consistent samples (max/min ≤ 1.6) with a median at least 3% off 1
 * switch the active shape; anything less keeps the seed. A manual
 * `searchShape` config freezes the mechanism entirely (`status: "manual"`).
 *
 * @param {Array<{key: string, est: number, aux: number, official: number|null,
 *   gap: number|null, auxCalls: number, unpriced?: boolean, sparse?: boolean}>} rows
 *   - reconcileSeries output.
 * @param {object} [options]
 * @param {{miss: number, hit: number, out: number}} [options.seed] - the
 *   shape to scale (the payload's effective default).
 * @param {boolean} [options.manual] - a user-configured shape exists.
 * @param {string} [options.today] - `YYYY-MM-DD`; earlier days only.
 * @returns {{shape: {miss, hit, out}, status: "manual"|"calibrated"|"insufficient"|"divergent",
 *   samples: number, medianS: number|null, controlDays: number, divergentDays: number, checkedDays: number}}
 */
export declare function auxCalibration(rows: Array<{
    key: string;
    est: number;
    aux: number;
    official: number | null;
    gap: number | null;
    auxCalls: number;
    unpriced?: boolean;
    sparse?: boolean;
}>, { seed, manual, today }?: {
    seed?: {
        miss: number;
        hit: number;
        out: number;
    };
    manual?: boolean;
    today?: string;
}): {
    shape: {
        miss: any;
        hit: any;
        out: any;
    };
    status: "manual" | "calibrated" | "insufficient" | "divergent";
    samples: number;
    medianS: number | null;
    controlDays: number;
    divergentDays: number;
    checkedDays: number;
};
/**
 * The drift alarm: the recent complete days whose official spend diverges
 * from the estimate by more than `threshold` (a fraction of the official
 * amount) — and by at least {@link RECON_ABS_FLOOR} in absolute terms, so
 * a sub-dime settlement residual cannot read as "+100%" just because the
 * day used nothing. Sparse days are skipped outright: across a snapshot
 * gap the official number is an interval estimate, and attributing it to
 * one calendar day proves nothing. Distinct from calibration — this
 * reports a problem, it never adjusts anything. `null` when the recent
 * window reconciles (or is unknown).
 *
 * @param {Array<{key: string, est: number, aux: number, official: number|null,
 *   gap: number|null, auxCalls: number, unpriced?: boolean, sparse?: boolean}>} rows
 *   - reconcileSeries output.
 * @param {{today?: string, window?: number, threshold?: number}} [options]
 *   - `today` bounds the audit (`YYYY-MM-DD`; earlier days only), `window`
 *   counts recent days, `threshold` is the relative divergence fraction.
 * @returns {{pct: number, day: string, count: number, days: Array<{key: string, pct: number}>}|null}
 */
export declare function reconDrift(rows: Array<{
    key: string;
    est: number;
    aux: number;
    official: number | null;
    gap: number | null;
    auxCalls: number;
    unpriced?: boolean;
    sparse?: boolean;
}>, { today, window, threshold }?: {
    today?: string;
    window?: number;
    threshold?: number;
}): {
    pct: number;
    day: string;
    count: number;
    days: Array<{
        key: string;
        pct: number;
    }>;
} | null;
/**
 * Fold a built view's per-model DISPLAY structures onto provider families
 * (see {@link ROUTE_FAMILIES}): the hand-entered DeepSeek API route and the
 * account route the desktop client adds by itself are one source, so a window
 * shows one DeepSeek row per model instead of two halves of the same number.
 *
 * Amounts are summed only AFTER pricing — every route still priced under its
 * own rules, so no rate is ever applied to another route's tokens — and the
 * pre-rollup per-route rows ride along as `modelRoutes`, which keeps the split
 * one call away for the day the two bill differently. Providers outside a
 * family are returned untouched (`models` order and totals unchanged).
 *
 * @param {{models?: Array<any>, modelBuckets?: any, bucketCosts?: any, knownModels?: any}} view
 *   - a {@link buildView} result (model display structures only).
 * @returns {{view: object, modelRoutes: Array<object>}}
 */
export declare function rollupModelFamilies(view: {
    models?: Array<any>;
    modelBuckets?: any;
    bucketCosts?: any;
    knownModels?: any;
}): {
    view: object;
    modelRoutes: Array<object>;
};
