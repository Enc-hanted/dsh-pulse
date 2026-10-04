/**
 * View model — key & bucket layer: composite model keys, local-day
 * arithmetic, and the day/week/month bucket ladder every chart walks.
 * Foundational — no sibling imports.
 */

import { rollupKeyOf } from "./routes.js";

/** Separator between provider and model in composite model keys. Model ids
 *  are printable, so a NUL can never appear inside a bare key — a composite
 *  key is unambiguous against a legacy provider-less one. */
export const MODEL_SEP = "\u0000";

/** Composite model key `provider\u0000model`; a missing provider yields the
 *  bare model id (the legacy shape). Same-named models from different
 *  providers stay distinct in the per-model maps while provider-less records
 *  (older events/hosts) keep folding under their bare id. */
export function modelKey(provider, model) {
  const p = typeof provider === "string" && provider.length > 0 ? provider : "";
  const m = typeof model === "string" && model.length > 0 ? model : "unknown";
  return p === "" ? m : `${p}${MODEL_SEP}${m}`;
}

/** Split a (possibly composite) model key into its `{provider, model}` parts;
 *  a bare key reports an empty provider. */
export function splitModelKey(key) {
  const k = String(key);
  const idx = k.indexOf(MODEL_SEP);
  return idx === -1 ? { provider: "", model: k } : { provider: k.slice(0, idx), model: k.slice(idx + MODEL_SEP.length) };
}

/** Local-timezone `YYYY-MM-DD` for a Unix epoch millisecond stamp. */
export function localDay(timeMs) {
  const d = new Date(timeMs);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Add (or subtract) whole days from a `YYYY-MM-DD` string, local time. */
export function shiftDay(day, delta) {
  const [y, m, d] = String(day).split("-").map(Number);
  return localDay(new Date(y, m - 1, d + delta, 12).getTime());
}

/** Days between two `YYYY-MM-DD` strings (inclusive, at least 1). */
export function daysBetween(from, to) {
  const [fy, fm, fd] = String(from).split("-").map(Number);
  const [ty, tm, td] = String(to).split("-").map(Number);
  const a = Date.UTC(fy, fm - 1, fd);
  const b = Date.UTC(ty, tm - 1, td);
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

/**
 * Normalize a custom date range: swap a reversed pair and trim an over-long
 * span to `maxDays` (default 30) by moving the start toward the end. Preset
 * ranges (90d/1y) are served by their own windows and skip this clamp.
 */
export function clampSpan(from, to, maxDays = 30) {
  let f = String(from);
  let t = String(to);
  if (f > t) { const swap = f; f = t; t = swap; }
  if (daysBetween(f, t) > maxDays) f = shiftDay(t, -(maxDays - 1));
  return { from: f, to: t };
}

/** Monday-start week key (`YYYY-MM-DD` of the week's Monday) for a day. */
export function weekStart(day) {
  const [y, m, d] = String(day).split("-").map(Number);
  const dow = (new Date(y, m - 1, d, 12).getDay() + 6) % 7; // Monday = 0
  return shiftDay(day, -dow);
}

/** Month key `YYYY-MM` for a day. */
export function monthKey(day) {
  return String(day).slice(0, 7);
}

export function bucketOf(granularity, day) {
  if (granularity === "week") return weekStart(day);
  if (granularity === "month") return monthKey(day);
  return day;
}

/** Contiguous bucket keys covering [`from`, `to`] under a granularity
 *  (capped to the most recent 400 buckets for chart readability). */
export function rangeKeys(granularity, from, to) {
  if (granularity === "month") {
    const [fy, fm] = String(from).split("-").map(Number);
    const [ty, tm] = String(to).split("-").map(Number);
    const end = ty * 12 + (tm - 1);
    const start = Math.max(fy * 12 + (fm - 1), end - 399);
    const keys = [];
    for (let m = start; m <= end; m += 1) {
      keys.push(`${Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, "0")}`);
    }
    return keys;
  }
  const step = granularity === "week" ? 7 : 1;
  // Count first, then keep the most recent ≤400 buckets ending at `to`.
  let count = 0;
  for (let cur = bucketOf(granularity, from); cur <= to; cur = shiftDay(cur, step)) {
    count += 1;
    if (step === 7 && shiftDay(cur, 6) >= to) break;
  }
  const capped = Math.min(count, 400);
  let startKey = bucketOf(granularity, shiftDay(to, -(capped - 1) * step));
  if (startKey < bucketOf(granularity, from)) startKey = bucketOf(granularity, from);
  const keys = [];
  for (let cur = startKey; cur <= to; cur = shiftDay(cur, step)) {
    keys.push(cur);
    if (step === 7 && shiftDay(cur, 6) >= to) break;
  }
  return keys;
}

/** Short human label for a bucket key (`MM-DD` for days, `YYYY-MM` for months). */
export function bucketLabel(key) {
  return key.length === 7 ? key : key.slice(5);
}

/**
 * Multi-select model filter: `models` (a non-empty id list) wins; the legacy
 * single `model` string is its one-element form; empty everywhere = `null`
 * (= no filter, everything matches). A Set matches a composite key either by
 * exact entry or by a bare model-id member covering every provider's row of
 * that id — the same semantics the single filter had, generalized.
 */
export function modelFilterSet(model, models) {
  const list = (Array.isArray(models) ? models : [])
    .filter((m) => typeof m === "string" && m !== "");
  if (list.length > 0) return new Set(list);
  return model === "" || model === null || model === undefined ? null : new Set([String(model)]);
}

/** Does one (possibly composite) model key pass the filter set? */
export function keyMatchesFilter(set, key) {
  if (set === null) return true;
  const raw = String(key);
  const split = splitModelKey(raw);
  return set.has(raw) || set.has(split.model) || set.has(rollupKeyOf(split.provider, split.model));
}

// --- provider route families --------------------------------------------------
// One physical DeepSeek account wears several route ids: the hand-entered API
// route (`deepseek-official`) and the one the desktop client adds by itself
// once an account is signed in (`deepseek-account`). They bill the same
// balance, so the balance-facing logic must treat them as one, the merged
// display shows one provider, and the per-route rows stay available
// (`rollupModelFamilies` returns them) for the day the two ever bill
// differently. Extend the table, nothing else: a family without
// `accountBalance` only affects labels, never the reconciliation.
