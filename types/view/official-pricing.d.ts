/** Official DeepSeek API price schedules for the built-in deepseek-* models,
 *  most recent first — a usage day prices under the first schedule whose
 *  `from` is <= that day, so historical windows reprice at the rates that
 *  were actually in effect instead of today's. Numbers are CNY per million
 *  tokens, transcribed from the official pricing page and release notes
 *  (api-docs.deepseek.com: V4-Pro GA 2026-08-13 introduced peak/off-peak
 *  billing effective 2026-08-17; V4.1-Flash release 2026-09-10 cut the Flash
 *  rates). Extend the array when DeepSeek changes prices again. */
export declare const OFFICIAL_PRICE_SCHEDULES: {
    from: string;
    rules: {
        model: string;
        input: number;
        cacheRead: number;
        output: number;
        peak: {
            input: number;
            cacheRead: number;
            output: number;
        };
        peakHours: number[];
        weekdaysOnly: boolean;
        currency: string;
    }[];
}[];
/** The official rules a given usage day billed under (empty before the first
 *  schedule — the V3.2-era flat pricing that predates peak/off-peak is not
 *  modeled; those days fall back to user rules or the unpriced note). */
export declare function officialRulesFor(day: any): {
    model: string;
    input: number;
    cacheRead: number;
    output: number;
    peak: {
        input: number;
        cacheRead: number;
        output: number;
    };
    peakHours: number[];
    weekdaysOnly: boolean;
    currency: string;
}[];
/** Estimate rules for usage days that predate a model's billing-effective
 *  date (the GA gap: a model can ship and see real use before its schedule
 *  `from` arrives) and for models later dropped from the current schedule —
 *  a published price is historical fact and stays usable for estimates
 *  forever. Every official rule ever published, keyed by model, keeping the
 *  EARLIEST schedule vintage (the rates closest to the usage era) and tagged
 *  `estimatedFrom` so callers can label the money honestly. Models the day's
 *  own schedule already prices are excluded; callers order these BEFORE the
 *  day's rules so the billing-accurate schedule and user rules always win
 *  (ruleMaps is last-write-wins). */
export declare function officialEstimateRulesFor(day: any): any[];
/** THE assembly order, declared once: the user overlay always rides ON TOP
 *  of the official day schedule, and the full layer underlays the GA-gap
 *  estimate vintage beneath it. The TUI, the golden test and any future face
 *  build their pricing through these two — never inline the spread order
 *  again. */
export declare function strictRulesWith(day: any, user: any): any[];
export declare function fullRulesWith(day: any, user: any): any[];
/** True when the day bills entirely at off-peak rates: weekends and Chinese
 *  public holidays under the official weekday-only peak windows. */
export declare function isOffPeakDay(day: any): boolean;
