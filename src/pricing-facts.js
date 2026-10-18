/**
 * Official pricing FACTS — read from the versioned rate card
 * (`src/pricing/ratecard.json`), the single source for the constants that
 * describe DeepSeek's official billing shape. Data only, no behavior: node
 * tests, the TUI, the host plugin and the browser bundle all read from
 * here, so the numbers can never drift apart. Bumping `version` in the
 * card is the visible act of re-auditing the numbers; `checkedAt` says when
 * they were last verified against `source`. The JSON import keeps the card
 * inside the esbuild bundle (no fs read), so every face shares one card.
 */
import ratecard from "./pricing/ratecard.json" with { type: "json" };

/** The rate card itself, frozen — diagnostics and the update-check surface. */
export const RATECARD = Object.freeze(structuredClone(ratecard));

/** Monotonic rate-card revision (bump whenever an audited number changes). */
export const RATECARD_VERSION = ratecard.version;

/** Official Beijing-time peak hours (the official peak/off-peak windows). */
export const PEAK_HOURS = Object.freeze([...ratecard.peakHours]);

/** Fixed UTC+8 offset for peak-tier classification (Asia/Shanghai has no DST). */
export const BEIJING_OFFSET_MS = 8 * 3600000;

/** USD→CNY conversion applied when the config carries no usable rate. */
export const DEFAULT_USD_TO_CNY = ratecard.usdToCny;

/** The model id the aux pseudo-model's requests BILL as (the search LLM rides
 * the retired `deepseek-v4-flash` name, which the platform routes to
 * `deepseek-flash`). ONE constant for the whole plugin: the aggregate fold
 * classifies those events' peak tier under the same id, so a platform
 * rename is a one-line change everywhere. */
export const AUX_PRICE_AS = ratecard.auxPriceAs;

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
export const AUX_CALL_FEE = {
  from: ratecard.auxCallFee.from,
  fromMs: Date.parse(`${ratecard.auxCallFee.from}T00:00:00+08:00`),
  cnyPerCall: ratecard.auxCallFee.cnyPerCall,
};
