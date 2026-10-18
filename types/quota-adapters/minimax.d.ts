/**
 * MiniMax coding/token plan quota adapter.
 *
 * `GET /v1/token_plan/remains`. Community-documented (MiniMax-M2 issue
 * #99): `current_interval_usage_count` and `current_weekly_usage_count`
 * hold REMAINING counts, not used — prefer the explicit
 * `*_remaining_percent` fields when present. Not yet live-verified; a
 * schema drift surfaces as an unparsable reply, never as fabricated
 * numbers (the conformance fixtures under test/fixtures/quota/minimax/
 * pin the parse).
 */
/** Parse the remains reply into the normalized result (pure). A non-zero
 *  `base_resp.status_code` is a provider error and throws. */
export declare const parseMinimaxRemains: (body: any) => {
    plan: {
        name: string;
        level: any;
        cycle: any;
        renewsAt: any;
    };
    fee: any;
    windows: any[];
    extras: any[];
};
/** The fetch half: one bounded GET, then the pure parse. */
declare const minimaxFetchQuota: ({ host, resolveCredential }: {
    host: any;
    resolveCredential: any;
}) => Promise<{
    plan: {
        name: string;
        level: any;
        cycle: any;
        renewsAt: any;
    };
    fee: any;
    windows: any[];
    extras: any[];
}>;
/** The adapter object (contract: ./types.js). */
export declare const minimaxAdapter: {
    id: string;
    label: string;
    envKeys: string[];
    match: (providerId: any, _describeRow: any) => any;
    hostFor: () => string;
    fetchQuota: typeof minimaxFetchQuota;
};
export {};
