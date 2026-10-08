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
