/**
 * Official-pricing subsystem: the published DeepSeek price schedules, the
 * day rules they yield (billing-accurate + estimate vintages), the ONE
 * overlay assembly order, and the off-peak day calendar. Extracted verbatim
 * from view.js — the facade re-exports every name, so no importer changed.
 */
import { PEAK_HOURS } from "../pricing-facts.js";

/** Official DeepSeek API price schedules for the built-in deepseek-* models,
 *  most recent first — a usage day prices under the first schedule whose
 *  `from` is <= that day, so historical windows reprice at the rates that
 *  were actually in effect instead of today's. Numbers are CNY per million
 *  tokens, transcribed from the official pricing page and release notes
 *  (api-docs.deepseek.com: V4-Pro GA 2026-08-13 introduced peak/off-peak
 *  billing effective 2026-08-17; V4.1-Flash release 2026-09-10 cut the Flash
 *  rates). Extend the array when DeepSeek changes prices again. */
export const OFFICIAL_PRICE_SCHEDULES = [
  {
    from: "2026-09-10",
    rules: [
      { model: "deepseek-flash", input: 1, cacheRead: 0.02, output: 4,
        peak: { input: 2, cacheRead: 0.04, output: 8 }, peakHours: [...PEAK_HOURS], weekdaysOnly: true, currency: "CNY" },
      { model: "deepseek-v4-pro", input: 4.5, cacheRead: 0.15, output: 13.5,
        peak: { input: 9, cacheRead: 0.3, output: 27 }, peakHours: [...PEAK_HOURS], weekdaysOnly: true, currency: "CNY" },
    ],
  },
  {
    from: "2026-08-17",
    rules: [
      { model: "deepseek-v4-flash", input: 1.5, cacheRead: 0.05, output: 4.5,
        peak: { input: 3, cacheRead: 0.1, output: 9 }, peakHours: [...PEAK_HOURS], weekdaysOnly: true, currency: "CNY" },
      { model: "deepseek-v4-flash-vision-exp", input: 1.5, cacheRead: 0.05, output: 4.5,
        peak: { input: 3, cacheRead: 0.1, output: 9 }, peakHours: [...PEAK_HOURS], weekdaysOnly: true, currency: "CNY" },
      { model: "deepseek-v4-pro", input: 4.5, cacheRead: 0.15, output: 13.5,
        peak: { input: 9, cacheRead: 0.3, output: 27 }, peakHours: [...PEAK_HOURS], weekdaysOnly: true, currency: "CNY" },
    ],
  },
];

/** The official rules a given usage day billed under (empty before the first
 *  schedule — the V3.2-era flat pricing that predates peak/off-peak is not
 *  modeled; those days fall back to user rules or the unpriced note). */
export function officialRulesFor(day) {
  for (const schedule of OFFICIAL_PRICE_SCHEDULES) {
    if (day >= schedule.from) return schedule.rules;
  }
  return [];
}

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
export function officialEstimateRulesFor(day) {
  const covered = new Set(officialRulesFor(day).map((rule) => rule.model));
  const out = new Map();
  for (let i = OFFICIAL_PRICE_SCHEDULES.length - 1; i >= 0; i -= 1) {
    const schedule = OFFICIAL_PRICE_SCHEDULES[i];
    for (const rule of schedule.rules) {
      if (covered.has(rule.model) || out.has(rule.model)) continue;
      out.set(rule.model, { ...rule, estimatedFrom: schedule.from });
    }
  }
  return [...out.values()];
}

/** THE assembly order, declared once: the user overlay always rides ON TOP
 *  of the official day schedule, and the full layer underlays the GA-gap
 *  estimate vintage beneath it. The TUI, the golden test and any future face
 *  build their pricing through these two — never inline the spread order
 *  again. */
export function strictRulesWith(day, user) {
  return [...officialRulesFor(day), ...user];
}

export function fullRulesWith(day, user) {
  return [...officialEstimateRulesFor(day), ...officialRulesFor(day), ...user];
}

/** Chinese public holidays (State Council calendar) — official billing keeps
 *  the whole day off-peak on these dates even when they fall on weekdays.
 *  Extend the set as new years are announced. */
const CN_HOLIDAYS = new Set([
  "2025-01-01", "2025-01-28", "2025-01-29", "2025-01-30", "2025-01-31", "2025-02-01", "2025-02-02", "2025-02-03", "2025-02-04",
  "2025-04-04", "2025-04-05", "2025-04-06",
  "2025-05-01", "2025-05-02", "2025-05-03", "2025-05-04", "2025-05-05",
  "2025-05-31", "2025-06-01", "2025-06-02",
  "2025-10-01", "2025-10-02", "2025-10-03", "2025-10-04", "2025-10-05", "2025-10-06", "2025-10-07", "2025-10-08",
  "2026-01-01", "2026-01-02", "2026-01-03",
  "2026-02-15", "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19", "2026-02-20", "2026-02-21",
  "2026-04-04", "2026-04-05", "2026-04-06",
  "2026-05-01", "2026-05-02", "2026-05-03", "2026-05-04", "2026-05-05",
  "2026-06-19", "2026-06-20", "2026-06-21",
  "2026-09-25", "2026-09-26", "2026-09-27",
  "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07",
  "2027-01-01", "2027-01-02", "2027-01-03",
]);

/** True when the day bills entirely at off-peak rates: weekends and Chinese
 *  public holidays under the official weekday-only peak windows. */
export function isOffPeakDay(day) {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return weekday === 0 || weekday === 6 || CN_HOLIDAYS.has(day);
}

