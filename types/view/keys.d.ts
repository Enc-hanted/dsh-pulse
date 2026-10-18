/**
 * View model — key & bucket layer: composite model keys, local-day
 * arithmetic, and the day/week/month bucket ladder every chart walks.
 * Foundational — no sibling imports.
 */
/** Separator between provider and model in composite model keys. Model ids
 *  are printable, so a NUL can never appear inside a bare key — a composite
 *  key is unambiguous against a legacy provider-less one. */
export declare const MODEL_SEP = "\0";
/** Composite model key `provider\u0000model`; a missing provider yields the
 *  bare model id (the legacy shape). Same-named models from different
 *  providers stay distinct in the per-model maps while provider-less records
 *  (older events/hosts) keep folding under their bare id. */
export declare function modelKey(provider: any, model: any): string;
/** Split a (possibly composite) model key into its `{provider, model}` parts;
 *  a bare key reports an empty provider. */
export declare function splitModelKey(key: any): {
    provider: string;
    model: string;
};
/** Zero-padded `YYYY-MM-DD` from year/month/day numbers (the ONE date
 *  assembly face — localDay, the calendar's monday rollover and the
 *  toolbar's parsed range all ride it). */
export declare function ymd(y: any, m: any, d: any): string;
/** Local-timezone `YYYY-MM-DD` for a Unix epoch millisecond stamp. */
export declare function localDay(timeMs: any): string;
/** Local midnight (epoch ms) of a `YYYY-MM-DD` string. */
export declare function dayStart(day: any): number;
/** Add (or subtract) whole days from a `YYYY-MM-DD` string, local time. */
export declare function shiftDay(day: any, delta: any): string;
/** Days between two `YYYY-MM-DD` strings (inclusive, at least 1). */
export declare function daysBetween(from: any, to: any): number;
/**
 * Normalize a custom date range: swap a reversed pair and trim an over-long
 * span to `maxDays` (default 30) by moving the start toward the end. Preset
 * ranges (90d/1y) are served by their own windows and skip this clamp.
 */
export declare function clampSpan(from: any, to: any, maxDays?: number): {
    from: string;
    to: string;
};
/** Monday-start week key (`YYYY-MM-DD` of the week's Monday) for a day. */
export declare function weekStart(day: any): string;
/** Month key `YYYY-MM` for a day. */
export declare function monthKey(day: any): string;
export declare function bucketOf(granularity: any, day: any): any;
/** Contiguous bucket keys covering [`from`, `to`] under a granularity
 *  (capped to the most recent 400 buckets for chart readability). */
export declare function rangeKeys(granularity: any, from: any, to: any): any[];
/** Short human label for a bucket key (`MM-DD` for days, `YYYY-MM` for months). */
export declare function bucketLabel(key: any): any;
/**
 * Multi-select model filter: `models` (a non-empty id list) wins; the legacy
 * single `model` string is its one-element form; empty everywhere = `null`
 * (= no filter, everything matches). A Set matches a composite key either by
 * exact entry or by a bare model-id member covering every provider's row of
 * that id — the same semantics the single filter had, generalized.
 */
export declare function modelFilterSet(model: any, models: any): Set<any>;
