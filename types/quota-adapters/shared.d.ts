/**
 * Shared plumbing for the built-in quota adapters (src/quota-adapters/):
 * the defensive normalization helpers, the window sort key, the bounded
 * outbound JSON GET, and the default route-claim predicate — one
 * definition each, so every adapter normalizes identically (the
 * conformance fixtures under test/fixtures/quota/ pin the shared shapes).
 *
 * Contract: ./types.js. Orchestration: ../quota-service.js.
 */
/** One defensive number: finite → number, anything else → null. */
export declare const qnum: (value: any) => number;
export declare const qclampPct: (value: any) => number;
/** Provider reset timestamps come in epoch ms, epoch s, or ISO strings with
 *  over-long fractional seconds; normalize all three to epoch ms. */
export declare const qtime: (value: any) => number;
export declare const qstr: (value: any) => string;
/** Sort key: shorter (more immediate) windows first; unknown spans last. */
export declare const windowOrder: (a: any, b: any) => number;
/** One JSON GET with the shared outbound posture: bounded, redirect-free,
 *  and failures mapped to cause codes only (no URLs, no keys). */
export declare const fetchJson: (url: any, headers: any) => Promise<any>;
/** The default route-claim predicate: an adapter claims exactly the
 *  provider ids it lists. `describeRow` (the settings forms' row for the
 *  route) is accepted and ignored by the built-ins — an external adapter
 *  may claim by connection shape instead of id. */
export declare const matchRoutes: (routes: any) => (providerId: any, _describeRow: any) => any;
