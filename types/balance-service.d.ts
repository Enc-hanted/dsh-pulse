/**
 * DeepSeek official balance service — the handler behind `GET /pulse/balance`.
 *
 * Security posture: the key is resolved per operation through the
 * credentials seam (the same DEEPSEEK_API_KEY the web Models page writes)
 * and lives only in one outbound Authorization header — never in a
 * response, a log line, an error message, or the store. Only parsed money
 * totals persist, as rolling snapshots in a storage-domain global
 * (opened through ./rolling-domain.js). The connection facts (per-route
 * `apiKeyEnv` / `baseURL` overrides) arrive as the `deepseekSection`
 * accessor — the host half owns the settings seam, the service owns the wire.
 */
/**
 * Create the balance service. `deepseekSection()` returns the official
 * adapter's settings namespace value (or undefined on hosts without one).
 *
 * @returns {{snapshotsOf: () => Promise<Array<{t: number, total: number}>|null>,
 *   serveBalance: (req: object, res: object, url: URL) => Promise<void>,
 *   getBalance: (refresh?: boolean) => Promise<object>}}
 */
export declare function createBalanceService({ ctx, deepseekSection }: {
    ctx: any;
    deepseekSection: any;
}): {
    snapshotsOf: () => Promise<Array<{
        t: number;
        total: number;
    }> | null>;
    serveBalance: (req: object, res: object, url: URL) => Promise<void>;
    getBalance: (refresh?: boolean) => Promise<object>;
};
