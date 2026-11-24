/**
 * Official-pricing subsystem: the day rules the published schedules yield
 * (billing-accurate + estimate vintages), the ONE overlay assembly order,
 * and the off-peak day calendar. The schedules and the holiday calendar
 * are DATA in the versioned card (pricing-facts.js live bindings); this
 * module only derives rules from them, so a runtime card apply reprices
 * history without a release. Extracted verbatim from view.js — the facade
 * re-exports every name, so no importer changed.
 */
import { HOLIDAYS, OFFICIAL_PRICE_SCHEDULES } from "../pricing-facts.js";

export { OFFICIAL_PRICE_SCHEDULES };

/** The official rules a given usage day billed under (empty before the first
 * schedule — the V3.2-era flat pricing that predates peak/off-peak is not
 * modeled; those days fall back to user rules or the unpriced note). */
export function officialRulesFor(day) {
  for (const schedule of OFFICIAL_PRICE_SCHEDULES) {
    if (day >= schedule.from) return schedule.rules;
  }
  return [];
}

/** Estimate rules for usage days that predate a model's billing-effective
 * date (the GA gap: a model can ship and see real use before its schedule
 * `from` arrives) and for models later dropped from the current schedule —
 * a published price is historical fact and stays usable for estimates
 * forever. Every official rule ever published, keyed by model, keeping the
 * EARLIEST schedule vintage (the rates closest to the usage era) and tagged
 * `estimatedFrom` so callers can label the money honestly. Models the day's
 * own schedule already prices are excluded; callers order these BEFORE the
 * day's rules so the billing-accurate schedule and user rules always win
 * (ruleMaps is last-write-wins). */
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
 * of the official day schedule, and the full layer underlays the GA-gap
 * estimate vintage beneath it. The TUI, the golden test and any future face
 * build their pricing through these two — never inline the spread order
 * again. */
export function strictRulesWith(day, user) {
  return [...officialRulesFor(day), ...user];
}

export function fullRulesWith(day, user) {
  return [...officialEstimateRulesFor(day), ...officialRulesFor(day), ...user];
}

/** Chinese public holidays (State Council calendar) — official billing keeps
 * the whole day off-peak on these dates even on weekdays. Weekends are
 * off-peak regardless of 调休 makeup workdays: the official wording has no
 * carve-out. The Set is rebuilt only when the card's holiday list changes
 * identity (a runtime apply), never per call. */
let holidaySource = null;
let holidaySet = new Set();
function holidays() {
  if (holidaySource !== HOLIDAYS) {
    holidaySource = HOLIDAYS;
    holidaySet = new Set(HOLIDAYS);
  }
  return holidaySet;
}

/** True when the day bills entirely at off-peak rates: weekends and Chinese
 * public holidays under the official weekday-only peak windows. */
export function isOffPeakDay(day) {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return weekday === 0 || weekday === 6 || holidays().has(day);
}
