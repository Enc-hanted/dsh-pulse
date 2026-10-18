/**
 * z.ai / bigmodel coding plan quota adapter (GLM Coding Plan).
 *
 * `GET /api/monitor/usage/quota/limit` for the window utilization (token
 * windows report a percentage only — the CN console hides absolute counts)
 * plus `GET /api/biz/subscription/list` for the plan name and fee. Verified
 * live against open.bigmodel.cn (Bearer auth) and documented for api.z.ai
 * by openusage/CodexBar. The parse half is pure and fixture-covered
 * (test/fixtures/quota/zai/), so endpoint drift surfaces as a conformance
 * failure, never as fabricated numbers.
 */
/** Parse the two z.ai replies into the normalized result (pure). The
 *  subscription reply may be null — its endpoint is optional and the fetch
 *  half already mapped a failure to null. Duplicate window ids keep the
 *  first occurrence ((6,1) and (6,7) both encode "7d", one console at a
 *  time). */
export declare const parseZaiQuota: (quotaRes: any, subRes: any) => {
    plan: any;
    fee: any;
    windows: any[];
    extras: any[];
};
/** The fetch half: both endpoints under one header, then the pure parse. */
declare const zaiFetchQuota: ({ host, resolveCredential }: {
    host: any;
    resolveCredential: any;
}) => Promise<{
    plan: any;
    fee: any;
    windows: any[];
    extras: any[];
}>;
/** The adapter object (contract: ./types.js). */
export declare const zaiAdapter: {
    id: string;
    label: string;
    envKeys: string[];
    match: (providerId: any, _describeRow: any) => any;
    hostFor: (route: any) => "https://api.z.ai" | "https://open.bigmodel.cn";
    fetchQuota: typeof zaiFetchQuota;
};
export {};
