/**
 * View model — auxiliary calls: the web-search pseudo model's shape
 * estimates, tier-aware aux usage folding, and the token-bucket math
 * the fold shares.
 */

import { AUX_PRICE_AS } from "../pricing-facts.js";

export { AUX_PRICE_AS };

/** The auxiliary-call pseudo model (official `web_search` / title LLM).
 *  Locally only the request count exists — no usage event — so its tokens
 *  are shape-derived ESTIMATES (single-call shape measured against the
 *  official bill, 2026-09-29: miss 8k / hit 1.5k / output 1k) and every
 *  surface labels the row as 估算. The shape is the SEED of the view's
 *  self-calibration ({@link auxCalibration}); a deployment's learned or
 *  manually configured shape replaces it through `buildView`'s `auxShape`. */
export const AUX_MODEL_KEY = "web-search";

export const AUX_SHAPE = { miss: 8000, hit: 1500, out: 1000 };

/** Defensive copy/validate of an aux shape: finite non-negative amounts with
 *  sane bounds, `null` when unusable (the seed then applies). */
export function auxShapeOf(value) {
  if (value === null || typeof value !== "object") return null;
  const pick = (v, max) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
  };
  const miss = pick(value.miss, 5e5);
  const hit = pick(value.hit, 5e5);
  const out = pick(value.out, 1e5);
  if (miss === null && hit === null && out === null) return null;
  const seed = AUX_SHAPE;
  return { miss: miss ?? seed.miss, hit: hit ?? seed.hit, out: out ?? seed.out };
}

/** The model id the aux pseudo-model's requests BILL as — re-exported from
 *  pricing-facts.js, which is the constant's single home. */

export function addTokens(bucket, tokens) {
  bucket.input += tokens.input || 0;
  bucket.output += tokens.output || 0;
  bucket.cacheRead += tokens.cacheRead || 0;
  bucket.cacheWrite += tokens.cacheWrite || 0;
}

/** Fold one day's per-model tokens into a model row with its tier split.
 *  `tier` is the record's `tiersByDay[day][model]` split; a legacy record
 *  without one prices the whole day at the off-peak rates. */
export function addDayModel(row, tokens, tier) {
  addTokens(row, tokens);
  if (tier === null || tier === undefined) {
    addTokens(row.offpeak, tokens);
    return;
  }
  for (const kind of ["input", "output", "cacheRead", "cacheWrite"]) {
    row.peak[kind] += tier[kind]?.peak || 0;
    row.offpeak[kind] += tier[kind]?.offpeak || 0;
  }
}

/**
 * Expand one day's aux counters into billable token buckets, the single
 * source every cost surface shares ({@link buildView}, {@link costSeries},
 * {@link reconcileSeries}): search counts × the (calibrated) call shape,
 * title through its fold-time text-derived token estimates. Returns `null`
 * when the day carried no auxiliary calls.
 */
export function auxDayUsage(aux, shape) {
  const sPeak = aux?.search?.peak || 0;
  const sOff = aux?.search?.offpeak || 0;
  const tPeak = aux?.title?.peak || 0;
  const tOff = aux?.title?.offpeak || 0;
  const searchCalls = sPeak + sOff;
  const titleCalls = tPeak + tOff;
  if (searchCalls <= 0 && titleCalls <= 0) return null;
  const out = { searchCalls, titleCalls, searchTokens: null, searchTier: null, titleTokens: null, titleTier: null, titleKey: null };
  if (searchCalls > 0) {
    out.searchTokens = { input: shape.miss * searchCalls, cacheRead: shape.hit * searchCalls, output: shape.out * searchCalls, cacheWrite: 0 };
    out.searchTier = {
      input: { peak: shape.miss * sPeak, offpeak: shape.miss * sOff },
      cacheRead: { peak: shape.hit * sPeak, offpeak: shape.hit * sOff },
      output: { peak: shape.out * sPeak, offpeak: shape.out * sOff },
      cacheWrite: { peak: 0, offpeak: 0 },
    };
  }
  if (titleCalls > 0) {
    const inPeak = aux?.titleIn?.peak || 0;
    const inOff = aux?.titleIn?.offpeak || 0;
    const outPeak = aux?.titleOut?.peak || 0;
    const outOff = aux?.titleOut?.offpeak || 0;
    out.titleTokens = { input: inPeak + inOff, cacheRead: 0, output: outPeak + outOff, cacheWrite: 0 };
    out.titleTier = {
      input: { peak: inPeak, offpeak: inOff },
      cacheRead: { peak: 0, offpeak: 0 },
      output: { peak: outPeak, offpeak: outOff },
      cacheWrite: { peak: 0, offpeak: 0 },
    };
    out.titleKey = typeof aux?.titleKey === "string" && aux.titleKey !== "" ? aux.titleKey : null;
  }
  return out;
}
