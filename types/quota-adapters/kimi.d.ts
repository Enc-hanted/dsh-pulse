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
/** Parse the usages reply into the normalized result (pure). */
export declare const parseKimiUsages: (body: any) => {
    plan: {
        name: string;
        level: string;
        cycle: any;
        renewsAt: any;
    };
    fee: any;
    windows: any[];
    extras: any[];
};
/** The fetch half: one bounded GET, then the pure parse. */
declare const kimiFetchQuota: ({ host, resolveCredential }: {
    host: any;
    resolveCredential: any;
}) => Promise<{
    plan: {
        name: string;
        level: string;
        cycle: any;
        renewsAt: any;
    };
    fee: any;
    windows: any[];
    extras: any[];
}>;
/** The adapter object (contract: ./types.js). */
export declare const kimiAdapter: {
    id: string;
    label: string;
    envKeys: string[];
    match: (providerId: any, _describeRow: any) => any;
    hostFor: () => string;
    fetchQuota: typeof kimiFetchQuota;
};
export {};
