/** The rate card itself, frozen — diagnostics and the update-check surface. */
export declare const RATECARD: Readonly<{
    version: number;
    checkedAt: string;
    source: string;
    usdToCny: number;
    peakHours: number[];
    peakWeekdaysOnly: boolean;
    auxPriceAs: string;
    auxCallFee: {
        from: string;
        cnyPerCall: number;
    };
}>;
/** Monotonic rate-card revision (bump whenever an audited number changes). */
export declare const RATECARD_VERSION: number;
/** Official Beijing-time peak hours (the official peak/off-peak windows). */
export declare const PEAK_HOURS: readonly number[];
/** Fixed UTC+8 offset for peak-tier classification (Asia/Shanghai has no DST). */
export declare const BEIJING_OFFSET_MS: number;
/** USD→CNY conversion applied when the config carries no usable rate. */
export declare const DEFAULT_USD_TO_CNY: number;
/** The model id the aux pseudo-model's requests BILL as (the search LLM rides
 * the retired `deepseek-v4-flash` name, which the platform routes to
 * `deepseek-flash`). ONE constant for the whole plugin: the aggregate fold
 * classifies those events' peak tier under the same id, so a platform
 * rename is a one-line change everywhere. */
export declare const AUX_PRICE_AS: string;
/** Official per-request fee for the Search/Fetch tool family, published with
 * the 2026-10-17 opening of the in-house search API: ¥5 per 1,000 SUCCESSFUL
 * requests, billed per call — never per token or per result; failures, empty
 * results and timeouts are free (api-docs.deepseek.com: 模型 & 价格 /
 * 网页搜索与抓取). Through harness/Claude Code/Codex server-side tool calls
 * these requests were explicitly free until Beijing midnight 2026-11-01,
 * when per-call billing starts. The harness's DeepSeek web search runs one
 * auxiliary Messages round trip per search whose server side executes the
 * native `web_search` tool, so the aux estimate adds `cnyPerCall` per search
 * call on usage days >= `from`. `fromMs` is the same instant as an epoch
 * value (Beijing midnight) for event-timestamp gates. Amend the card (and
 * bump its version) when DeepSeek reprices the per-call fee. */
export declare const AUX_CALL_FEE: {
    from: string;
    fromMs: number;
    cnyPerCall: number;
};
