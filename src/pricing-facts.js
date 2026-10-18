/**
 * Official pricing FACTS — the single source for the constants that describe
 * DeepSeek's official billing shape. Data only, no imports: node tests, the
 * TUI, the host plugin and the browser bundle all read from here, so the
 * numbers can never drift apart again. (The price schedules and the rule
 * assembly order live beside this in view.js; the module split gives them
 * their own home later.)
 */

/** Official Beijing-time peak hours (the official peak/off-peak windows). */
export const PEAK_HOURS = [9, 10, 11, 14, 15, 16, 17];

/** Fixed UTC+8 offset for peak-tier classification (Asia/Shanghai has no DST). */
export const BEIJING_OFFSET_MS = 8 * 3600000;

/** USD→CNY conversion applied when the config carries no usable rate. */
export const DEFAULT_USD_TO_CNY = 6.8;

/** The model id the aux pseudo-model's requests BILL as (the search LLM rides
 *  the retired `deepseek-v4-flash` name, which the platform routes to
 *  `deepseek-flash`). ONE constant for the whole plugin: the aggregate fold
 *  classifies those events' peak tier under the same id, so a platform
 *  rename is a one-line change everywhere. */
export const AUX_PRICE_AS = "deepseek-flash";

/** Official per-request fee for the Search/Fetch tool family, published with
 *  the 2026-10-17 opening of the in-house search API: ¥5 per 1,000 SUCCESSFUL
 *  requests, billed per call — never per token or per result; failures, empty
 *  results and timeouts are free (api-docs.deepseek.com: 模型 & 价格 /
 *  网页搜索与抓取). Through harness/Claude Code/Codex server-side tool calls
 *  these requests were explicitly free until Beijing midnight 2026-11-01,
 *  when per-call billing starts. The harness's DeepSeek web search runs one
 *  auxiliary Messages round trip per search whose server side executes the
 *  native `web_search` tool, so the aux estimate adds `cnyPerCall` per search
 *  call on usage days >= `from`. `fromMs` is the same instant as an epoch
 *  value (Beijing midnight) for event-timestamp gates. Extend or amend this
 *  constant when DeepSeek reprices the per-call fee. */
export const AUX_CALL_FEE = { from: "2026-11-01", fromMs: Date.parse("2026-11-01T00:00:00+08:00"), cnyPerCall: 0.005 };
