/**
 * Subscription quota service — the handler behind `GET /pulse/quota`.
 *
 * The same posture as the official balance, one provider up: credentials are
 * resolved per operation through the credential seam (the env refs the Models
 * page writes, the stored record it writes for OAuth routes, or the
 * adapter's well-known env names), and live only in one outbound
 * Authorization header. Only parsed utilization numbers persist — as
 * `{t, provider, window, pct}` points in a rolling storage-domain global,
 * the burn-rate series the client forecasts from. A route queries only when
 * a built-in adapter claims it (and the user has not switched it off via
 * `quotaOff`); every fetch is user-triggered or a 60-second-cadence poll —
 * never a timer of its own. The host half owns the seams (`resolveConfig`,
 * the llm service and its describe rows); the provider adapters
 * (./quota-adapters/, contract in ./quota-adapters/types.js) own the wire;
 * this service owns the orchestration only — credential resolution, adapter
 * selection, the reply cache/timeout policy and the snapshot store.
 */
/**
 * Create the quota service.
 *
 * @param {object} deps
 * @param {() => object} deps.resolveConfig - live plugin config (quotaOff).
 * @param {() => object|null} deps.llmService - the llm bundle's provider list.
 * @param {() => object|null} deps.llmDescribe - the settings forms' describe
 *   rows, the per-route `apiKeyEnv` override source (null on classic hosts).
 */
export declare function createQuotaService({ ctx, resolveConfig, llmServiceOf, llmDescribeOf }: {
    resolveConfig: () => object;
    llmService: () => object | null;
    llmDescribe: () => object | null;
}): {
    serveQuota: (req: any, res: any, url: any) => Promise<void>;
};
