import { strict as assert } from "node:assert";
import {
  bucketOf, bucketLabel, buildView, clampSpan, costOf, daysBetween, fmtCost,
  heatmapCells, heatmapLevel, hourlySeries, monthKey, niceMax, rangeKeys,
  shiftDay, weekStart,
} from "../src/view.js";

const D = "2026-08-14"; // a Friday
assert.equal(weekStart(D), "2026-08-10", "Monday-start week");
assert.equal(monthKey(D), "2026-08");
assert.equal(bucketOf("day", D), D);
assert.equal(bucketOf("week", "2026-08-12"), "2026-08-10");
assert.equal(bucketOf("month", "2026-08-12"), "2026-08");
assert.equal(shiftDay(D, -1), "2026-08-13");
assert.equal(shiftDay("2026-01-01", -1), "2025-12-31");
assert.equal(daysBetween("2026-08-01", D), 14);
assert.equal(daysBetween(D, "2026-08-01"), 1, "clamped to >=1");
assert.equal(bucketLabel(D), "08-14");
assert.equal(bucketLabel("2026-08"), "2026-08");

// --- clampSpan: custom ranges cap at 30 days --------------------------------
assert.deepEqual(clampSpan("2026-08-01", D), { from: "2026-08-01", to: D }, "short spans pass through");
assert.deepEqual(clampSpan(D, "2026-08-01"), { from: "2026-08-01", to: D }, "reversed pairs swap");
assert.deepEqual(clampSpan("2026-06-01", D), { from: "2026-07-16", to: D }, "over-long span trims the start");
assert.equal(daysBetween(...Object.values(clampSpan("2026-01-01", D))), 30);
assert.deepEqual(clampSpan("2026-01-01", D, 90), { from: "2026-05-17", to: D }, "custom cap honored");

// --- rangeKeys ---------------------------------------------------------------
assert.equal(rangeKeys("day", "2026-08-10", D).length, 5);
const weeks = rangeKeys("week", "2026-08-01", D);
assert.equal(weeks[0], weekStart("2026-08-01"));
assert.equal(weeks[weeks.length - 1], weekStart(D));
assert.equal(rangeKeys("month", "2026-05-01", D).join(","), "2026-05,2026-06,2026-07,2026-08");
// long windows keep only the most recent 400 buckets
const long = rangeKeys("day", shiftDay(D, -1094), D);
assert.equal(long.length, 400);
assert.equal(long[long.length - 1], D);

// --- buildView: day / week / month, project filter, model splits -------------
// Schema-3 records: per-day maps only, sliced by the host.
const sessions = [
  {
    project: "alpha", subagent: false, day: "2026-08-13",
    byDay: {
      "2026-08-13": { input: 100, output: 50, cacheRead: 900, cacheWrite: 0 },
      "2026-08-14": { input: 40, output: 10, cacheRead: 0, cacheWrite: 30 },
    },
    modelsByDay: {
      "2026-08-13": { "deepseek-v4-flash": { input: 100, output: 50, cacheRead: 900, cacheWrite: 0 } },
      "2026-08-14": { "deepseek-v4-flash": { input: 40, output: 10, cacheRead: 0, cacheWrite: 30 } },
    },
    turnsByDay: { "2026-08-13": 2 },
    toolCallsByDay: { "2026-08-13": 9 },
  },
  {
    project: "beta", subagent: true, day: "2026-08-14",
    byDay: { "2026-08-14": { input: 2000, output: 1000, cacheRead: 0, cacheWrite: 0 } },
    modelsByDay: { "2026-08-14": { "deepseek-v4-pro": { input: 2000, output: 1000, cacheRead: 0, cacheWrite: 0 } } },
    turnsByDay: { "2026-08-14": 1 },
    toolCallsByDay: { "2026-08-14": 1 },
  },
  {
    // turn-only day with no tokens must still count the turn
    project: "alpha", subagent: false, day: "2026-08-14",
    byDay: {},
    modelsByDay: {},
    turnsByDay: { "2026-08-14": 1 },
    toolCallsByDay: {},
  },
];

const dayView = buildView(sessions, { granularity: "day", from: "2026-08-13", to: D, pricing: [] });
assert.equal(dayView.buckets.length, 2);
assert.equal(dayView.buckets[0].sessions, 1, "alpha anchored at its first activity day");
assert.equal(dayView.buckets[1].sessions, 2);
assert.equal(dayView.totals.sessions, 3);
assert.equal(dayView.totals.subagents, 1);
assert.equal(dayView.totals.turns, 4);
assert.equal(dayView.totals.toolCalls, 10);
assert.equal(dayView.totals.input, 2140);
assert.equal(dayView.totals.output, 1060);
assert.equal(dayView.totals.cacheRead, 900);
assert.equal(dayView.totals.cacheWrite, 30);
assert.equal(dayView.models.length, 2);
assert.equal(dayView.models[0].model, "deepseek-v4-pro", "sorted by volume");
assert.equal(dayView.projects.length, 2);
assert.equal(dayView.knownProjects.join(","), "alpha,beta");
// cache-write was a miss: it joins the denominator and cannot inflate the rate
assert.ok(Math.abs(dayView.totals.cacheHitRate - 900 / (900 + 2140 + 30)) < 1e-12);

// day aggregation: 08-13 carries only alpha's 08-13 bucket
assert.equal(dayView.buckets[0].input, 100);
assert.equal(dayView.buckets[1].input, 2040);

// narrow range excludes alpha's 08-13 activity but keeps 08-14 everything
const todayOnly = buildView(sessions, { granularity: "day", from: D, to: D, pricing: [] });
assert.equal(todayOnly.totals.input, 40 + 2000);
assert.equal(todayOnly.totals.turns, 2, "only in-range turns counted");
assert.equal(todayOnly.models.length, 2);

// week granularity merges the two days
const weekView = buildView(sessions, { granularity: "week", from: "2026-08-13", to: D, pricing: [] });
assert.equal(weekView.buckets.length, 1, "both days fall in the week of 08-10");
assert.equal(weekView.buckets[0].input, 2140);

// month granularity
const monthView = buildView(sessions, { granularity: "month", from: "2026-08-01", to: D, pricing: [] });
assert.equal(monthView.buckets.length, 1);
assert.equal(monthView.buckets[0].key, "2026-08");

// project filter
const alphaView = buildView(sessions, { granularity: "day", from: "2026-08-13", to: D, project: "alpha", pricing: [] });
assert.equal(alphaView.totals.sessions, 2);
assert.equal(alphaView.totals.input, 140);
assert.equal(alphaView.projects.length, 1);
assert.equal(alphaView.projects[0].project, "alpha");

// model filter: only the selected model's tokens flow into every figure
const flashOnly = buildView(sessions, { granularity: "day", from: "2026-08-13", to: D, model: "deepseek-v4-flash", pricing: [] });
assert.equal(flashOnly.totals.input, 140, "pro model's 2000 input excluded");
assert.equal(flashOnly.models.length, 1);
assert.equal(flashOnly.models[0].model, "deepseek-v4-flash");
assert.equal(flashOnly.buckets[1].input, 40);
assert.deepEqual(flashOnly.knownModels.sort(), ["deepseek-v4-flash", "deepseek-v4-pro"], "picker options ignore the filter");

// project + model compose
const alphaFlash = buildView(sessions, { granularity: "day", from: "2026-08-13", to: D, project: "alpha", model: "deepseek-v4-flash", pricing: [] });
assert.equal(alphaFlash.totals.sessions, 2);
assert.equal(alphaFlash.totals.input, 140);

// --- hourly series ------------------------------------------------------------
const hourFixtures = [
  {
    project: "alpha",
    hoursByDay: {
      [D]: {
        "08": { "deepseek-v4-flash": { input: 100, output: 50, cacheRead: 25, cacheWrite: 5 } },
        "09": { "deepseek-v4-pro": { input: 200, output: 10, cacheRead: 0, cacheWrite: 0 } },
      },
    },
  },
  {
    project: "beta",
    hoursByDay: {
      [D]: { "08": { "deepseek-v4-flash": { input: 7, output: 3, cacheRead: 0, cacheWrite: 0 } } },
      "2026-08-13": { "08": { "deepseek-v4-flash": { input: 999, output: 0, cacheRead: 0, cacheWrite: 0 } } },
    },
  },
  { project: "alpha", hoursByDay: {} }, // schema-2-ish record contributes zeros
  { project: "alpha", hoursByDay: { [D]: { "99": { x: { input: 1 } } } } }, // junk hour ignored
];
const all = hourlySeries(hourFixtures, D);
assert.equal(all.length, 24);
assert.equal(all[0].key, "00");
assert.equal(all[8].input, 100 + 7, "hour 08 sums across sessions");
assert.equal(all[8].output, 50 + 3);
assert.equal(all[8].cacheRead, 25);
assert.equal(all[8].cacheWrite, 5);
assert.equal(all[9].input, 200);
assert.equal(all.reduce((sum, h) => sum + h.input, 0), 307, "other days and junk hours excluded");
const alphaOnly = hourlySeries(hourFixtures, D, { project: "alpha" });
assert.equal(alphaOnly[8].input, 100);
assert.equal(alphaOnly[9].input, 200);
const flashOnlyHours = hourlySeries(hourFixtures, D, { model: "deepseek-v4-flash" });
assert.equal(flashOnlyHours[8].input, 107);
assert.equal(flashOnlyHours[9].input, 0, "pro model's hour 09 excluded");

// empty selection
const empty = buildView(sessions, { granularity: "day", from: "2026-01-01", to: "2026-01-31", pricing: [] });
assert.equal(empty.hasData, false);
assert.equal(empty.buckets.length, 31);

// --- schema-2 compatibility: scalar window-scoped turns/toolCalls ------------
const legacy = buildView([{
  project: "old", subagent: false, day: "2026-08-13", turns: 7, toolCalls: 21,
  byDay: { "2026-08-13": { input: 10, output: 5, cacheRead: 0, cacheWrite: 0 } },
  modelsByDay: { "2026-08-13": { m: { input: 10, output: 5, cacheRead: 0, cacheWrite: 0 } } },
}], { granularity: "day", from: "2026-08-13", to: D, pricing: [] });
assert.equal(legacy.totals.turns, 7, "scalar turns fallback for schema-2 records");
assert.equal(legacy.totals.toolCalls, 21);
assert.equal(legacy.totals.input, 10);

// --- cost with official-style rates (cache-hit cheaper) -----------------------
const pricing = [
  { model: "deepseek-v4-flash", input: 1, cacheRead: 0.02, output: 2, currency: "CNY" },
  { model: "deepseek-v4-pro", input: 3, output: 6, currency: "CNY" }, // no cacheRead → falls back to input
];
const costView = buildView(sessions, { granularity: "day", from: "2026-08-13", to: D, pricing });
assert.equal(costView.cost.configured, true);
// flash: (100+40+30)*1 + 900*0.02 + 60*2 = 308 → 0.000308; pro: 2000*3 + 1000*6 = 12000 → 0.012
assert.ok(Math.abs(costView.cost.total - (0.000308 + 0.012)) < 5e-7, `got ${costView.cost.total}`);
assert.equal(costView.cost.currency, "CNY");

// unpriced model bucketed separately
const partial = costOf([{ model: "mystery", input: 100, output: 50, cacheRead: 0, cacheWrite: 0 }], pricing);
assert.equal(partial.configured, false);
assert.equal(partial.unpriced.input, 100);
assert.equal(costOf([], pricing).configured, false);

// --- heatmap ----------------------------------------------------------------
// 2026-08-14 is a Friday → week starts Monday 08-10, leading offset 4
const hbuckets = rangeKeys("day", "2026-08-14", "2026-08-19").map((key) => ({ key }));
const hc = heatmapCells(hbuckets);
assert.equal(hc.cells.length, 14, "padded to whole weeks (6 days + 4 leading + 4 trailing)");
assert.equal(hc.cells[0], null);
assert.equal(hc.cells[4].key, "2026-08-14");
assert.equal(hc.cells[hc.cells.length - 1], null, "trailing future days are empty");
assert.equal(hc.weeks, 2);
assert.equal(hc.months.length, 1);
assert.equal(hc.months[0].col, 4);
assert.equal(hc.months[0].label, "2026-08");
assert.deepEqual(heatmapCells([]), { cells: [], weeks: 0, months: [] });

// a range crossing a month boundary marks both months
const crossing = rangeKeys("day", "2026-07-28", "2026-08-10").map((key) => ({ key }));
const hc2 = heatmapCells(crossing);
assert.equal(hc2.months.length, 2);
assert.equal(hc2.months[1].label, "2026-08");
assert.equal(hc2.months[1].col, 5, "2026-08-01 (a Saturday) lands five columns in");

assert.equal(heatmapLevel(0, 100), 0);
assert.equal(heatmapLevel(10, 0), 0);
assert.equal(heatmapLevel(10, 100), 1);
assert.equal(heatmapLevel(25, 100), 2);
assert.equal(heatmapLevel(50, 100), 3);
assert.equal(heatmapLevel(75, 100), 4);
assert.equal(heatmapLevel(100, 100), 4);

// --- dynamic axis ceilings -----------------------------------------------------
assert.equal(niceMax(0), 1);
assert.equal(niceMax(89), 100);
assert.equal(niceMax(340), 500);
assert.equal(niceMax(500), 500);
assert.equal(niceMax(2.1e6), 5e6);
assert.equal(niceMax(7), 10);

// --- cost formatting -----------------------------------------------------------
assert.equal(fmtCost(0), "0");
assert.equal(fmtCost(12.34567), "12.35");
assert.equal(fmtCost(0.000278), "0.000278");
assert.equal(fmtCost(0.012345), "0.0123");
assert.equal(fmtCost(1.5), "1.50");

console.log("view-test: all assertions passed");
