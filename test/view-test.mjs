import { strict as assert } from "node:assert";
import {
  bucketOf, bucketLabel, breaksSegments, buildView, clampSpan, costOf, costSeries, daysBetween,
  fmtClockMs, fmtCost, heatmapCells, heatmapLevel, hourlySeries, monthKey, niceMax, rangeKeys,
  sessionGroups, sessionModelRows, shiftDay, weekStart,
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

// --- provider-aware rows: same-named models of different providers -----------
// Composite `provider\u0000model` keys (the projection's shape) split into
// distinct rows carrying `key` / `provider` / `model`.
const dupSessions = [
  {
    project: "dup", day: "2026-08-13",
    byDay: { "2026-08-13": { input: 300, output: 100, cacheRead: 0, cacheWrite: 0 } },
    modelsByDay: {
      "2026-08-13": {
        "a\u0000shared": { input: 300, output: 100, cacheRead: 0, cacheWrite: 0 },
        "b\u0000shared": { input: 30, output: 10, cacheRead: 0, cacheWrite: 0 },
      },
    },
    turnsByDay: { "2026-08-13": 1 },
    toolCallsByDay: {},
  },
];
const dupView = buildView(dupSessions, { granularity: "day", from: "2026-08-13", to: "2026-08-13", pricing: [] });
assert.equal(dupView.models.length, 2, "same-named models stay separate");
const rowA = dupView.models.find((m) => m.provider === "a");
const rowB = dupView.models.find((m) => m.provider === "b");
assert.equal(rowA.model, "shared");
assert.equal(rowA.key, "a\u0000shared");
assert.equal(rowA.input, 300);
assert.equal(rowB.input, 30);
assert.equal(dupView.knownModels.join(","), "a\u0000shared,b\u0000shared", "picker options carry composite keys");

// pricing: an exact provider rule wins over the wildcard default
const dupPricing = [
  { model: "shared", input: 1, output: 1, currency: "CNY" }, // wildcard
  { provider: "b", model: "shared", input: 10, output: 10, currency: "CNY" }, // b-scoped
];
const dupCost = buildView(dupSessions, { granularity: "day", from: "2026-08-13", to: "2026-08-13", pricing: dupPricing });
// a: 300*1 + 100*1 = 400; b: 30*10 + 10*10 = 400 → 800/1e6 = 0.0008
assert.ok(Math.abs(dupCost.cost.total - 0.0008) < 5e-7, `got ${dupCost.cost.total}`);
assert.equal(dupCost.cost.configured, true);

// a bare model filter matches the composite rows by their model part
const dupFiltered = buildView(dupSessions, { granularity: "day", from: "2026-08-13", to: "2026-08-13", model: "shared", pricing: [] });
assert.equal(dupFiltered.totals.input, 330, "bare filter covers every provider's same-named model");
assert.equal(dupFiltered.models.length, 2);
// a composite filter narrows to one provider's row
const dupExact = buildView(dupSessions, { granularity: "day", from: "2026-08-13", to: "2026-08-13", model: "a\u0000shared", pricing: [] });
assert.equal(dupExact.totals.input, 300);
assert.equal(dupExact.models.length, 1);
assert.equal(dupExact.models[0].provider, "a");

// costSeries and hourlySeries understand composite keys and filters
const dupSeries = costSeries(dupSessions, { from: "2026-08-13", to: "2026-08-13", pricing: dupPricing });
assert.ok(Math.abs(dupSeries[0].offpeak - 0.0008) < 5e-7, `got ${dupSeries[0].offpeak}`);
const dupHourly = hourlySeries([{
  hoursByDay: { "2026-08-13": { "08": { "a\u0000shared": { input: 5 }, "b\u0000shared": { input: 7 } } } },
}], "2026-08-13", { model: "b\u0000shared" });
assert.equal(dupHourly[8].input, 7, "composite filter selects one provider's hour detail");

// a wildcard-only pricing list still prices composite rows (official defaults)
const wildOnly = costOf([{ key: "deepseek-official\u0000deepseek-v4-flash", provider: "deepseek-official", model: "deepseek-v4-flash", input: 100, output: 50, cacheRead: 0, cacheWrite: 0 }],
  [{ model: "deepseek-v4-flash", input: 1, output: 2, currency: "CNY" }]);
assert.ok(Math.abs(wildOnly.total - 0.0002) < 5e-7, "wildcard rule covers a provider-scoped row");

// --- monthly-paid providers: flat subscription, zero marginal cost ------------
// A monthly provider's models price at 0 even with no rule, and are configured
// (never "unpriced"); a leftover rule does not override the monthly flag.
const monthlyPricing = [
  { provider: "pi-ai", model: "shared", input: 10, output: 10, currency: "CNY" },
];
const monthlyCost = costOf(
  [{ key: "pi-ai\u0000shared", provider: "pi-ai", model: "shared", input: 1_000_000, output: 1_000_000, cacheRead: 0, cacheWrite: 0 }],
  monthlyPricing,
  {},
  ["pi-ai"],
);
assert.equal(monthlyCost.configured, true, "monthly model counts as configured");
assert.equal(monthlyCost.total, 0, "monthly model costs zero despite a rule");
assert.equal((monthlyCost.unpriced.input || 0) + (monthlyCost.unpriced.output || 0), 0, "monthly model never lands in unpriced");
// without the monthly flag the same rule prices normally
const notMonthly = costOf(
  [{ key: "pi-ai\u0000shared", provider: "pi-ai", model: "shared", input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 }],
  monthlyPricing,
);
assert.ok(Math.abs(notMonthly.total - 10) < 5e-7, "without the monthly flag the rule applies");

// buildView threads monthly into the chip, and costSeries drops monthly models
const monthlyView = buildView(dupSessions, { granularity: "day", from: "2026-08-13", to: "2026-08-13", pricing: dupPricing, monthly: ["b"] });
assert.equal(monthlyView.cost.configured, true, "chip configured with only a monthly row present");
assert.equal(monthlyView.cost.total, 0.0004, "only provider a's cost shows (b is monthly): 400/1e6");
const monthlySeries = costSeries(dupSessions, { from: "2026-08-13", to: "2026-08-13", pricing: dupPricing, monthly: ["b"] });
assert.ok(Math.abs(monthlySeries[0].offpeak - 0.0004) < 5e-7, "monthly model contributes zero to the series");

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

// --- cost with tiered (peak/off-peak) official-style rates --------------------
const tieredPricing = [
  { model: "deepseek-v4-flash", input: 1.5, cacheRead: 0.05, output: 4.5,
    peak: { input: 3, cacheRead: 0.1, output: 9 }, currency: "CNY" },
];
const tieredSessions = [{
  project: "tier", day: D,
  byDay: { [D]: { input: 3000, output: 1500, cacheRead: 9000, cacheWrite: 100 } },
  modelsByDay: { [D]: { "deepseek-v4-flash": { input: 3000, output: 1500, cacheRead: 9000, cacheWrite: 100 } } },
  tiersByDay: { [D]: { "deepseek-v4-flash": {
    input: { peak: 2000, offpeak: 1000 }, output: { peak: 1000, offpeak: 500 },
    cacheRead: { peak: 0, offpeak: 9000 }, cacheWrite: { peak: 100, offpeak: 0 },
  } } },
}];
const tiered = buildView(tieredSessions, { granularity: "day", from: D, to: D, pricing: tieredPricing });
assert.equal(tiered.cost.configured, true);
assert.deepEqual(tiered.models[0].peak, { input: 2000, output: 1000, cacheRead: 0, cacheWrite: 100 });
assert.deepEqual(tiered.models[0].offpeak, { input: 1000, output: 500, cacheRead: 9000, cacheWrite: 0 });
// off-peak: (1000+0)*1.5 + 9000*0.05 + 500*4.5 = 4200
// peak:     (2000+100)*3 + 0*0.1 + 1000*9     = 15300 → 19500/1e6 = 0.0195
assert.ok(Math.abs(tiered.cost.total - 0.0195) < 5e-7, `got ${tiered.cost.total}`);

// a flat rule (no `peak`) prices both tiers at the same rate
const flatTiered = costOf([{
  model: "deepseek-v4-flash", input: 1000, output: 500, cacheRead: 100, cacheWrite: 50,
  peak: { input: 900, output: 400, cacheRead: 90, cacheWrite: 40 },
  offpeak: { input: 100, output: 100, cacheRead: 10, cacheWrite: 10 },
}], [{ model: "deepseek-v4-flash", input: 1, output: 2, currency: "CNY" }]);
// off-peak: (100+10)*1 + 10*1 + 100*2 = 320; peak: (900+40)*1 + 90*1 + 400*2 = 1830
assert.ok(Math.abs(flatTiered.total - 0.00215) < 5e-7, `got ${flatTiered.total}`);

// records without a tier split price wholly at the off-peak rates
const legacyTiered = buildView([{
  project: "old", day: D,
  byDay: { [D]: { input: 1000, output: 500, cacheRead: 9000, cacheWrite: 0 } },
  modelsByDay: { [D]: { "deepseek-v4-flash": { input: 1000, output: 500, cacheRead: 9000, cacheWrite: 0 } } },
}], { granularity: "day", from: D, to: D, pricing: tieredPricing });
assert.ok(Math.abs(legacyTiered.cost.total - (1000 * 1.5 + 9000 * 0.05 + 500 * 4.5) / 1e6) < 5e-7, `got ${legacyTiered.cost.total}`);

// --- currency: USD rules convert into one CNY total ---------------------------
const mixedPricing = [
  { model: "cny-model", input: 1, output: 1, currency: "CNY" },
  { model: "usd-model", input: 2, output: 2, currency: "USD" },
];
const mixedRows = [
  { model: "cny-model", input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 }, // 1 CNY
  { model: "usd-model", input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 }, // 2 USD
];
const fxDefault = costOf(mixedRows, mixedPricing);
assert.equal(fxDefault.currency, "CNY", "total is always CNY");
assert.equal(fxDefault.usdToCny, 6.8, "default rate");
assert.ok(Math.abs(fxDefault.total - (1 + 2 * 6.8)) < 5e-7, `got ${fxDefault.total}`);
assert.ok(Math.abs(fxDefault.convertedFromUsd - 2 * 6.8) < 5e-7, "converted portion rides along");
const fxCustom = costOf(mixedRows, mixedPricing, { usdToCny: 7 });
assert.ok(Math.abs(fxCustom.total - (1 + 2 * 7)) < 5e-7, `got ${fxCustom.total}`);
assert.equal(fxCustom.usdToCny, 7);
assert.ok(Math.abs(costOf([mixedRows[0]], mixedPricing).total - 1) < 5e-7, "pure-CNY totals do not convert");
assert.equal(costOf(mixedRows, mixedPricing).convertedFromUsd !== undefined, true);

// --- costSeries: per-day peak/off-peak cost fold ------------------------------
// D = 2026-08-14; same records as the tiered case, priced per day.
const seriesPricing = [
  { model: "deepseek-v4-flash", input: 1.5, cacheRead: 0.05, output: 4.5,
    peak: { input: 3, cacheRead: 0.1, output: 9 }, currency: "CNY" },
  { model: "usd-model", input: 2, output: 2, currency: "USD" },
];
const seriesSessions = [
  {
    project: "tier", day: D,
    byDay: { [D]: { input: 3000, output: 1500, cacheRead: 9000, cacheWrite: 100 } },
    modelsByDay: { [D]: { "deepseek-v4-flash": { input: 3000, output: 1500, cacheRead: 9000, cacheWrite: 100 } } },
    tiersByDay: { [D]: { "deepseek-v4-flash": {
      input: { peak: 2000, offpeak: 1000 }, output: { peak: 1000, offpeak: 500 },
      cacheRead: { peak: 0, offpeak: 9000 }, cacheWrite: { peak: 100, offpeak: 0 },
    } } },
  },
  {
    project: "other", day: "2026-08-15",
    byDay: { "2026-08-15": { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 } },
    modelsByDay: { "2026-08-15": { "usd-model": { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 } } },
    // no tier split → prices wholly at off-peak rates
  },
];
const series = costSeries(seriesSessions, { from: D, to: "2026-08-15", pricing: seriesPricing });
assert.equal(series.length, 2, "one entry per day in the window");
// flash day: offpeak 4200 + peak 15300 (from the tiered case) = 0.0195 CNY
assert.ok(Math.abs(series[0].offpeak - 0.0042) < 5e-7, `got ${series[0].offpeak}`);
assert.ok(Math.abs(series[0].peak - 0.0153) < 5e-7, `got ${series[0].peak}`);
// usd day: 1M input × 2 USD × 6.8 = 13.6 CNY, all off-peak
assert.ok(Math.abs(series[1].offpeak - 13.6) < 5e-6, `got ${series[1].offpeak}`);
assert.equal(series[1].peak, 0);
// filters: the project filter drops the usd day, the model filter keeps only flash
assert.equal(costSeries(seriesSessions, { from: D, to: "2026-08-15", pricing: seriesPricing, project: "tier" }).length, 2);
assert.ok(Math.abs(costSeries(seriesSessions, { from: D, to: "2026-08-15", pricing: seriesPricing, project: "tier" })[1].offpeak) < 5e-7, "filtered project contributes nothing on its day");
assert.equal(costSeries(seriesSessions, { from: D, to: "2026-08-15", pricing: seriesPricing, model: "usd-model" })[0].peak + costSeries(seriesSessions, { from: D, to: "2026-08-15", pricing: seriesPricing, model: "usd-model" })[0].offpeak, 0, "model filter drops flash's day");
// fx rides the series, and unpriced models contribute zero
assert.ok(Math.abs(costSeries(seriesSessions, { from: "2026-08-15", to: "2026-08-15", pricing: seriesPricing, fx: { usdToCny: 7 } })[0].offpeak - 14) < 5e-7);
assert.equal(costSeries(seriesSessions, { from: D, to: "2026-08-15", pricing: [] })[0].peak, 0);
assert.equal(costSeries(seriesSessions, { from: D, to: "2026-08-15", pricing: [] })[0].offpeak, 0);

// --- regression: model rows accumulate across records ------------------------
// Two sessions of one model: the chip's model row must hold the SUM, not the
// last record's slice, and the chip total must equal the trend series total.
const multiSessions = [
  {
    project: "a", day: D,
    byDay: { [D]: { input: 1_000_000, output: 0, cacheRead: 4_000_000, cacheWrite: 0 } },
    modelsByDay: { [D]: { "deepseek-v4-flash": { input: 1_000_000, output: 0, cacheRead: 4_000_000, cacheWrite: 0 } } },
    tiersByDay: { [D]: { "deepseek-v4-flash": {
      input: { peak: 1_000_000, offpeak: 0 }, output: { peak: 0, offpeak: 0 },
      cacheRead: { peak: 4_000_000, offpeak: 0 }, cacheWrite: { peak: 0, offpeak: 0 },
    } } },
  },
  {
    project: "b", day: "2026-08-15",
    byDay: { "2026-08-15": { input: 0, output: 500_000, cacheRead: 0, cacheWrite: 0 } },
    modelsByDay: { "2026-08-15": { "deepseek-v4-flash": { input: 0, output: 500_000, cacheRead: 0, cacheWrite: 0 } } },
    // no tier split on this record: the whole day prices at off-peak
  },
];
const multiView = buildView(multiSessions, { granularity: "day", from: D, to: "2026-08-15", pricing: seriesPricing });
const flashRow = multiView.models.find((m) => m.model === "deepseek-v4-flash");
assert.equal(flashRow.input, 1_000_000, "both records' input reaches the model row");
assert.equal(flashRow.output, 500_000);
assert.equal(flashRow.cacheRead, 4_000_000);
assert.equal(flashRow.peak.input, 1_000_000, "peak split accumulates across records too");
const seriesTotal = costSeries(multiSessions, { from: D, to: "2026-08-15", pricing: seriesPricing })
  .reduce((s, d) => s + d.peak + d.offpeak, 0);
assert.ok(Math.abs(multiView.cost.total - seriesTotal) < 5e-6,
  `chip (${multiView.cost.total}) must equal the trend total (${seriesTotal})`);

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

// --- fmtClockMs ---------------------------------------------------------------
assert.match(fmtClockMs(0), /^\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);

// --- sessionModelRows / sessionGroups: project × subagent detail ---------------
const sgRecord = (over) => ({
  id: "sg1", createdAt: 0, day: "2026-08-14", project: "repo", subagent: false, parentSession: null, delegationDepth: 0,
  byDay: {
    "2026-08-14": { input: 100, output: 50, cacheRead: 10, cacheWrite: 0 },
    "2026-08-15": { input: 200, output: 100, cacheRead: 20, cacheWrite: 0 },
  },
  modelsByDay: {
    "2026-08-14": { "deepseek-v4-flash": { input: 100, output: 50, cacheRead: 10, cacheWrite: 0 } },
    "2026-08-15": { "deepseek-v4-flash": { input: 200, output: 100, cacheRead: 20, cacheWrite: 0 } },
  },
  tiersByDay: {
    "2026-08-14": { "deepseek-v4-flash": { input: { peak: 100, offpeak: 0 }, output: { peak: 50, offpeak: 0 }, cacheRead: { peak: 0, offpeak: 10 }, cacheWrite: { peak: 0, offpeak: 0 } } },
    "2026-08-15": { "deepseek-v4-flash": { input: { peak: 0, offpeak: 200 }, output: { peak: 0, offpeak: 100 }, cacheRead: { peak: 0, offpeak: 20 }, cacheWrite: { peak: 0, offpeak: 0 } } },
  },
  turnsByDay: {}, toolCallsByDay: {},
  ...over,
});
const sgRows = sessionModelRows(sgRecord());
assert.equal(sgRows.length, 1);
assert.equal(sgRows[0].input, 300, "cross-day model totals accumulate");
assert.equal(sgRows[0].peak.input, 100, "tier split carries across days");
assert.equal(sgRows[0].offpeak.input, 200);
assert.deepEqual(sessionModelRows(null), []);
assert.deepEqual(sessionModelRows({}), []);

const sgPricing = [{ model: "deepseek-v4-flash", input: 1, cacheRead: 0.02, output: 2, currency: "CNY" }];
const sgGroups = sessionGroups([
  sgRecord(),
  sgRecord({ id: "sg2", project: "repo", subagent: true, parentSession: "sg1", delegationDepth: 1,
    byDay: { "2026-08-14": { input: 10, output: 5, cacheRead: 0, cacheWrite: 0 } },
    modelsByDay: { "2026-08-14": { "deepseek-v4-flash": { input: 10, output: 5, cacheRead: 0, cacheWrite: 0 } } } }),
  sgRecord({ id: "sg3", project: "other", subagent: false }),
], { pricing: sgPricing, fx: {}, monthly: [] });
assert.equal(sgGroups.length, 2);
const repo = sgGroups.find((g) => g.project === "repo");
assert.equal(repo.mainSessions, 1);
assert.equal(repo.subagentSessions, 1);
assert.equal(repo.subagentTokens.input, 10, "subagent subtotal is its own tokens");
assert.equal(repo.sessions.length, 2);
const subRow = repo.sessions.find((s) => s.subagent);
assert.equal(subRow.parentSession, "sg1");
assert.equal(subRow.delegationDepth, 1);
assert.ok(repo.subagentCost !== null && repo.subagentCost.configured, "subagent subtotal is costed");
assert.ok(sgGroups[0].total >= sgGroups[1].total, "groups sorted by total tokens");
assert.equal(sgGroups.find((g) => g.project === "other").subagentSessions, 0);
assert.equal(sgGroups.find((g) => g.project === "other").subagentCost, null, "no subagents → no subagent cost");
assert.deepEqual(sessionGroups([], {}), []);
assert.deepEqual(sessionGroups(null, {}), []);
// a session with no countable usage (no tokens, no model rows) is dropped
assert.deepEqual(sessionGroups([null, { project: "x", byDay: {}, modelsByDay: {} }], {}).length, 0, "zero-usage session dropped");

// a model filter narrows each session to that model and drops never-users:
// the project detail never surfaces other models' sessions
const filteredSessions = [
  sgRecord(), // repo: flash, 300 input across two days
  sgRecord({ id: "sg4", project: "repo", subagent: false,
    byDay: { "2026-08-14": { input: 5, output: 5, cacheRead: 0, cacheWrite: 0 } },
    modelsByDay: { "2026-08-14": { "other-model": { input: 5, output: 5, cacheRead: 0, cacheWrite: 0 } } } }),
];
const filteredGroups = sessionGroups(filteredSessions, { pricing: sgPricing, fx: {}, monthly: [], model: "deepseek-v4-flash" });
assert.equal(filteredGroups.length, 1);
const filteredRepo = filteredGroups[0];
assert.equal(filteredRepo.sessions.length, 1, "the other-model session drops out");
assert.equal(filteredRepo.sessions[0].id, "sg1");
assert.equal(filteredRepo.sessions[0].tokens.input, 300, "tokens narrow to the selected model");
assert.equal(filteredRepo.sessions[0].topModel, "deepseek-v4-flash");
// a composite filter targets one provider's row
const compositeFiltered = sessionGroups(filteredSessions, { pricing: sgPricing, model: "pi-ai\u0000deepseek-v4-flash" });
assert.equal(compositeFiltered.length, 0, "no pi-ai flash rows → no groups");
// an empty model filter keeps the unfiltered behavior (byDay totals)
const unfiltered = sessionGroups(filteredSessions, { pricing: sgPricing });
assert.equal(unfiltered[0].sessions.length, 2, "no model filter keeps every session");
assert.equal(unfiltered[0].sessions[0].tokens.input, 300);

// a monthly-paid session carries the badge flag and costs zero, never a 0.00
// price; without the flag the same model prices through the wildcard rule
const monthlyRec = sgRecord({
  id: "sgM", project: "repo", subagent: false,
  byDay: { "2026-08-14": { input: 1000, output: 500, cacheRead: 0, cacheWrite: 0 } },
  modelsByDay: { "2026-08-14": { "pi-ai\u0000deepseek-v4-flash": { input: 1000, output: 500, cacheRead: 0, cacheWrite: 0 } } },
  tiersByDay: { "2026-08-14": { "pi-ai\u0000deepseek-v4-flash": {
    input: { peak: 0, offpeak: 1000 }, output: { peak: 0, offpeak: 500 },
    cacheRead: { peak: 0, offpeak: 0 }, cacheWrite: { peak: 0, offpeak: 0 },
  } } },
});
const monthlyGroups = sessionGroups([monthlyRec], { pricing: sgPricing, monthly: ["pi-ai"] });
assert.equal(monthlyGroups[0].sessions[0].monthly, true, "all-monthly session flagged");
assert.equal(monthlyGroups[0].sessions[0].cost.total, 0, "monthly session costs zero");
const sessionNotMonthly = sessionGroups([monthlyRec], { pricing: sgPricing, monthly: [] });
assert.equal(sessionNotMonthly[0].sessions[0].monthly, false, "not monthly without the flag");
assert.ok(sessionNotMonthly[0].sessions[0].cost.total > 0, "wildcard rule prices it otherwise");
// a mixed session (monthly + paid rows) is not all-monthly
const mixed = sessionGroups([
  monthlyRec,
  sgRecord({ id: "sgMix", project: "repo", subagent: false,
    byDay: { "2026-08-14": { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 } },
    modelsByDay: { "2026-08-14": { "pi-ai\u0000deepseek-v4-flash": { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 }, "deepseek-v4-flash": { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 } } } }),
], { pricing: sgPricing, monthly: ["pi-ai"] });
assert.equal(mixed[0].sessions.find((s) => s.id === "sgMix").monthly, false, "mixed session is not all-monthly");
assert.equal(mixed[0].subagentMonthly, false, "no subagents → no subagent monthly flag");

// per-model breakdown: each model row carries its own tokens and cost, so a
// mixed session's price lands under the right model (monthly one → 0/badge)
const mixedSg = mixed[0].sessions.find((s) => s.id === "sgMix");
assert.equal(mixedSg.modelRows.length, 2, "one model row per model in a mixed session");
const piRow = mixedSg.modelRows.find((r) => r.provider === "pi-ai");
const offRow = mixedSg.modelRows.find((r) => r.provider !== "pi-ai");
assert.equal(piRow.monthly, true, "monthly model row flagged");
assert.equal(piRow.cost.total, 0, "monthly model row costs zero");
assert.equal(offRow.monthly, false, "official model row not flagged");
assert.ok(offRow.cost.total > 0, "official model row carries the price");
assert.equal(piRow.tokens.input, 1, "monthly model row keeps its own tokens");
assert.equal(offRow.tokens.input, 1, "official model row keeps its own tokens");
assert.equal(mixedSg.modelRows.reduce((s, r) => s + r.tokens.input, 0), 2, "model rows sum to the session totals");

// --- breaksSegments: clickable break slicing of a session timeline ------------
const tlEvents = [
  { t: 1000, i: 10, o: 0, cr: 0, cw: 0, key: "deepseek-v4-flash" },
  { t: 2000, i: 10, o: 10, cr: 0, cw: 0, key: "deepseek-v4-flash" },
  { t: 3000, i: 10, o: 0, cr: 0, cw: 0, key: "deepseek-v4-flash" },
  { t: 4000, i: 10, o: 0, cr: 0, cw: 0, key: "other-model" },
];
assert.deepEqual(breaksSegments([], [1, 2]), []);
assert.deepEqual(breaksSegments(null, []), []);
const segs = breaksSegments(tlEvents, [2500], { pricing: sgPricing, fx: {}, monthly: [] });
assert.equal(segs.length, 2, "one break → two segments");
assert.deepEqual(segs[0].tokens, { input: 20, output: 10, cacheRead: 0, cacheWrite: 0 }, "first segment up to the break");
assert.deepEqual(segs[1].tokens, { input: 20, output: 0, cacheRead: 0, cacheWrite: 0 }, "second segment after the break");
assert.equal(segs[0].models.length, 1);
assert.equal(segs[1].models.length, 2, "second segment mixes models");
assert.ok(segs[0].cost.configured, "segment cost is configured");
// an event exactly on the break belongs to the earlier segment only
const onBreak = breaksSegments([{ t: 1000, i: 5, o: 0, cr: 0, cw: 0, key: "m" }, { t: 2000, i: 5, o: 0, cr: 0, cw: 0, key: "m" }, { t: 3000, i: 5, o: 0, cr: 0, cw: 0, key: "m" }], [2000], { pricing: [] });
assert.deepEqual(onBreak[0].tokens, { input: 10, output: 0, cacheRead: 0, cacheWrite: 0 }, "break event lands in the first segment");
assert.deepEqual(onBreak[1].tokens, { input: 5, output: 0, cacheRead: 0, cacheWrite: 0 }, "later segment keeps the rest");
// breaks clamp into the span and cap at 3
const clamped = breaksSegments(tlEvents, [0, 2500, 99999, 3000, 4000], { pricing: sgPricing });
assert.equal(clamped.length, 3, "in-span marks only (0 / 99999 / 4000 clamped away)");
const capped = breaksSegments(tlEvents, [2500, 3000, 3500, 3800], { pricing: sgPricing });
assert.equal(capped.length, 4, "at most 3 marks → 4 segments");
const t0 = breaksSegments(tlEvents, [], { pricing: sgPricing });
assert.equal(t0.length, 1, "no breaks → one whole segment");
assert.deepEqual(t0[0].tokens, { input: 40, output: 10, cacheRead: 0, cacheWrite: 0 });
// a model filter restricts the segments to that model's events only
const modelSegs = breaksSegments(tlEvents, [], { pricing: sgPricing, model: "deepseek-v4-flash" });
assert.deepEqual(modelSegs[0].tokens, { input: 30, output: 10, cacheRead: 0, cacheWrite: 0 }, "other-model events excluded");
assert.equal(modelSegs[0].models.length, 1);
assert.equal(modelSegs[0].models[0].key, "deepseek-v4-flash");
// composite model filter (provider\u0000model) targets one provider's row
const compositeSegs = breaksSegments([
  { t: 1000, i: 7, o: 0, cr: 0, cw: 0, key: "pi-ai\u0000deepseek-v4-flash" },
  { t: 2000, i: 3, o: 0, cr: 0, cw: 0, key: "deepseek-v4-flash" },
], [], { pricing: sgPricing, model: "pi-ai\u0000deepseek-v4-flash" });
assert.deepEqual(compositeSegs[0].tokens, { input: 7, output: 0, cacheRead: 0, cacheWrite: 0 }, "composite filter keeps only that provider's row");
assert.deepEqual(breaksSegments(tlEvents, [], { pricing: sgPricing, model: "nope" }), [], "no matching events → no segments");
// an all-monthly segment carries the badge flag and costs zero; a mixed one
// still prices the paid model
const monthlySeg = breaksSegments([
  { t: 1000, i: 1_000_000, o: 500_000, cr: 0, cw: 0, key: "pi-ai\u0000deepseek-v4-flash" },
], [], { pricing: sgPricing, monthly: ["pi-ai"] });
assert.equal(monthlySeg[0].monthly, true, "all-monthly segment flagged");
assert.equal(monthlySeg[0].cost.total, 0, "all-monthly segment costs zero");
const mixedSeg = breaksSegments([
  { t: 1000, i: 1_000_000, o: 0, cr: 0, cw: 0, key: "pi-ai\u0000deepseek-v4-flash" },
  { t: 2000, i: 1_000_000, o: 0, cr: 0, cw: 0, key: "deepseek-v4-flash" },
], [], { pricing: sgPricing, monthly: ["pi-ai"] });
assert.equal(mixedSeg[0].monthly, false, "mixed segment is not all-monthly");
assert.ok(mixedSeg[0].cost.total > 0, "paid model prices the mixed segment");
const plainSeg = breaksSegments([
  { t: 1000, i: 1_000_000, o: 0, cr: 0, cw: 0, key: "deepseek-v4-flash" },
], [], { pricing: sgPricing, monthly: [] });
assert.equal(plainSeg[0].monthly, false, "no monthly flag → not flagged");

// a provider-less (bare-key) model resolves its provider from the catalog's
// unique route, so a monthly-paid bare-key session prices as monthly
const cat = [{ provider: "pi-ai", displayName: "PI AI", models: [{ id: "DeepSeek-V4-Flash-0731", name: "DeepSeek V4 Flash 0731" }] }];
const bareRecord = sgRecord({
  id: "sgBare", project: "repo", subagent: false,
  byDay: { "2026-08-14": { input: 1_000_000, output: 500_000, cacheRead: 0, cacheWrite: 0 } },
  modelsByDay: { "2026-08-14": { "DeepSeek-V4-Flash-0731": { input: 1_000_000, output: 500_000, cacheRead: 0, cacheWrite: 0 } } },
});
const bareMonthly = sessionGroups([bareRecord], { pricing: sgPricing, monthly: ["pi-ai"], catalog: cat });
assert.equal(bareMonthly[0].sessions[0].monthly, true, "bare-key session flagged monthly via catalog");
assert.equal(bareMonthly[0].sessions[0].cost.total, 0, "bare-key monthly session costs zero");
const bareSeg = breaksSegments([
  { t: 1000, i: 1_000_000, o: 500_000, cr: 0, cw: 0, key: "DeepSeek-V4-Flash-0731" },
], [], { pricing: sgPricing, monthly: ["pi-ai"], catalog: cat });
assert.equal(bareSeg[0].monthly, true, "bare-key segment flagged monthly via catalog");
assert.equal(bareSeg[0].cost.total, 0, "bare-key monthly segment costs zero");
// without the catalog the bare key cannot resolve and stays unpriced
const bareNoCat = sessionGroups([bareRecord], { pricing: sgPricing, monthly: ["pi-ai"] });
assert.equal(bareNoCat[0].sessions[0].monthly, false, "no catalog → bare key stays unpriced-as-monthly");
assert.equal(bareNoCat[0].sessions[0].cost.configured, false, "no rule matches the bare key without a catalog");

// the same model id served by several providers: a bare key resolves to the
// single monthly-paid route (the DeepSeek-V4-Flash-0731 scenario — official
// route also serves `deepseek-v4-flash`, the third party is monthly-paid)
const multiCat = [
  { provider: "deepseek-official", displayName: "DeepSeek", models: [{ id: "deepseek-v4-flash", name: "DeepSeek V4 Flash" }] },
  { provider: "pi-ai", displayName: "PI AI", models: [{ id: "deepseek-v4-flash", name: "DeepSeek-V4-Flash-0731" }] },
];
const bareSameId = sgRecord({
  id: "sgSame", project: "repo", subagent: false,
  byDay: { "2026-08-14": { input: 1_000_000, output: 500_000, cacheRead: 0, cacheWrite: 0 } },
  modelsByDay: { "2026-08-14": { "deepseek-v4-flash": { input: 1_000_000, output: 500_000, cacheRead: 0, cacheWrite: 0 } } },
});
const sameIdMonthly = sessionGroups([bareSameId], { pricing: sgPricing, monthly: ["pi-ai"], catalog: multiCat });
assert.equal(sameIdMonthly[0].sessions[0].monthly, true, "bare key resolves to the single monthly-paid route");
assert.equal(sameIdMonthly[0].sessions[0].cost.total, 0, "resolved monthly session costs zero");
const sameIdSeg = breaksSegments([
  { t: 1000, i: 1_000_000, o: 500_000, cr: 0, cw: 0, key: "deepseek-v4-flash" },
], [], { pricing: sgPricing, monthly: ["pi-ai"], catalog: multiCat });
assert.equal(sameIdSeg[0].monthly, true, "bare-key segment resolves to the monthly route");
assert.equal(sameIdSeg[0].cost.total, 0, "resolved monthly segment costs zero");
// no monthly tie-break → ambiguous bare key falls back to the official
// wildcard rule (same model id): priced, but never flagged monthly
const sameIdAmbiguous = sessionGroups([bareSameId], { pricing: sgPricing, monthly: [], catalog: multiCat });
assert.equal(sameIdAmbiguous[0].sessions[0].monthly, false, "ambiguous bare key without monthly tie-break");
assert.equal(sameIdAmbiguous[0].sessions[0].cost.configured, true, "official wildcard rule prices the bare key");

console.log("view-test: all assertions passed");
