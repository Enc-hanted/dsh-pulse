/**
 * View model — auxiliary calls: the web-search pseudo model's shape
 * estimates, tier-aware aux usage folding, and the token-bucket math
 * the fold shares.
 */
import { AUX_CALL_FEE, AUX_PRICE_AS, AUX_SHAPE } from "../pricing-facts.js";
export { AUX_CALL_FEE, AUX_PRICE_AS, AUX_SHAPE };
/** The auxiliary-call pseudo model (official `web_search` / title LLM).
 *  Locally only the request count exists — no usage event — so its tokens
 *  are shape-derived ESTIMATES (single-call shape measured against the
 *  official bill, 2026-09-29: miss 8k / hit 1.5k / output 1k) and every
 *  surface labels the row as 估算. The shape seed lives in the data card
 *  ({@link AUX_SHAPE}); it is the SEED of the view's self-calibration
 *  ({@link auxCalibration}); a deployment's learned or manually configured
 *  shape replaces it through `buildView`'s `auxShape`. */
export declare const AUX_MODEL_KEY = "web-search";
/** Defensive copy/validate of an aux shape: finite non-negative amounts with
 *  sane bounds, `null` when unusable (the seed then applies). */
export declare function auxShapeOf(value: any): {
    miss: number;
    hit: number;
    out: number;
};
/** The model id the aux pseudo-model's requests BILL as — re-exported from
 *  pricing-facts.js, which is the constant's single home. */
export declare function addTokens(bucket: any, tokens: any): void;
/** Fold one day's per-model tokens into a model row with its tier split.
 *  `tier` is the record's `tiersByDay[day][model]` split; a legacy record
 *  without one prices the whole day at the off-peak rates. */
export declare function addDayModel(row: any, tokens: any, tier: any): void;
/**
 * Expand one day's aux counters into billable token buckets, the single
 * source every cost surface shares ({@link buildView}, {@link costSeries},
 * {@link reconcileSeries}): search counts × the (calibrated) call shape,
 * title through its fold-time text-derived token estimates. `day` (a
 * `YYYY-MM-DD` usage day) gates the official per-request search fee WINDOW
 * [from, untilDay): `searchFee` carries the flat ¥0.005/call total inside
 * the window and stays 0 outside it — the boundary day (2026-11-18, fee
 * ends 12:00) is conservatively free at day granularity, event-level
 * surfaces gate to the minute via `untilMs`. Also 0 without a day (the
 * conservative default for day-less callers). Returns `null` when the day
 * carried no auxiliary calls.
 */
export declare function auxDayUsage(aux: any, shape: any, day?: any): {
    searchCalls: any;
    titleCalls: any;
    searchTokens: any;
    searchTier: any;
    searchFee: number;
    titleTokens: any;
    titleTier: any;
    titleKey: any;
};
