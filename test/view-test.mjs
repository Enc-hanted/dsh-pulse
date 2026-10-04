import { strict as assert } from "node:assert";
import {
  accentEntryOf, accentFillOf, accentLabDistance, ACCENT_MIN_DISTANCE, auxCalibration, auxDayUsage, bucketOf, bucketLabel, breaksSegments, buildView, cacheHitRateOf, clampSpan, costOf, costSeries, daysBetween,
  familyRouteOf, fmtClockMs, fmtCost, heatmapCells, heatmapLevel, hourlyCostSeries, hourlySeries, isOfficialProvider, modelAccentMap, modelFilterSet, keyMatchesFilter, monthKey, niceMax,
  officialEstimateRulesFor, providerLabelOf, rangeKeys, reconDrift, reconcileSeries, rollupKeyOf, rollupModelFamilies,
  sessionGroups, sessionModelRows, shiftDay, weekStart,
  quotaBurn, quotaCalibrate, quotaCoverage, quotaFeeShare, quotaMonthlyFee, quotaProjectAttribution, quotaWindowTokens,
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
// the exported helper IS that one definition: totals and the summary card read it
assert.equal(cacheHitRateOf({ input: 2140, cacheRead: 900, cacheWrite: 30 }), dayView.totals.cacheHitRate);
assert.equal(cacheHitRateOf({ input: 0, cacheRead: 0, cacheWrite: 0 }), null, "no input side → no rate");

// day aggregation: 08-13 carries only alpha's 08-13 bucket
assert.equal(dayView.buckets[0].input, 100);
assert.equal(dayView.buckets[1].input, 2040);

// model dimension: per-day per-model matrix aligned with the buckets
assert.equal(dayView.modelBuckets.length, 2, "matrix rows align with buckets");
assert.equal(dayView.modelBuckets[0].get("deepseek-v4-flash").input, 100);
assert.equal(dayView.modelBuckets[1].get("deepseek-v4-flash").input, 40);
assert.equal(dayView.modelBuckets[1].get("deepseek-v4-pro").input, 2000, "per-day models accumulate across sessions");

// narrow range excludes alpha's 08-13 activity but keeps 08-14 everything
const todayOnly = buildView(sessions, { granularity: "day", from: D, to: D, pricing: [] });
assert.equal(todayOnly.totals.input, 40 + 2000);
assert.equal(todayOnly.totals.turns, 2, "only in-range turns counted");
assert.equal(todayOnly.models.length, 2);
assert.equal(todayOnly.modelBuckets[0].get("deepseek-v4-pro").input, 2000, "the matrix respects the window");

// week granularity merges the two days
const weekView = buildView(sessions, { granularity: "week", from: "2026-08-13", to: D, pricing: [] });
assert.equal(weekView.buckets.length, 1, "both days fall in the week of 08-10");
assert.equal(weekView.buckets[0].input, 2140);
assert.equal(weekView.modelBuckets[0].get("deepseek-v4-pro").output, 1000, "week granularity merges the day matrix");

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
assert.equal(flashOnly.modelBuckets[1].get("deepseek-v4-flash").input, 40, "model-filtered views keep the matrix on the matched model");
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
// --- epoch pricing: each day prices under the official schedule in effect ----
// 08-17 schedule: v4-flash 1.5/3.0 miss, 4.5/9.0 out; 09-10 schedule:
// deepseek-flash 1/2.0 miss, 4/8.0 out. 2026-09-26 is a holiday Saturday.
{
  const tiers = (iPeak, iOff, oPeak, oOff) => ({
    input: { peak: iPeak, offpeak: iOff },
    output: { peak: oPeak, offpeak: oOff },
    cacheRead: { peak: 0, offpeak: 0 },
    cacheWrite: { peak: 0, offpeak: 0 },
  });
  const day = (key, model, tokens, tier) => ({
    project: "p", day: key,
    byDay: { [key]: tokens },
    modelsByDay: { [key]: { [model]: tokens } },
    tiersByDay: { [key]: { [model]: tier } },
    turnsByDay: {}, toolCallsByDay: {},
  });
  const epochSessions = [
    day("2026-08-20", "deepseek-v4-flash",
      { input: 1_000_000, output: 1_000_000, cacheRead: 0, cacheWrite: 0 }, tiers(1_000_000, 0, 0, 1_000_000)),
    day("2026-09-11", "deepseek-flash",
      { input: 1_000_000, output: 1_000_000, cacheRead: 0, cacheWrite: 0 }, tiers(1_000_000, 0, 0, 1_000_000)),
    day("2026-09-26", "deepseek-flash",
      { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 }, tiers(1_000_000, 0, 0, 0)),
  ];
  const epochView = buildView(epochSessions, { granularity: "day", from: "2026-08-20", to: "2026-09-26", pricing: [] });
  const costByDay = new Map(epochView.bucketCosts.map((row) => [row.key, row]));
  assert.equal(costByDay.get("2026-08-20").peak + costByDay.get("2026-08-20").offpeak, 7.5, "08-20 prices under the 08-17 schedule (peak 3 + offpeak 4.5)");
  assert.equal(costByDay.get("2026-09-11").peak, 2, "09-11 peak input at the cut rate");
  assert.equal(costByDay.get("2026-09-11").offpeak, 4, "09-11 offpeak output at the cut rate");
  assert.equal(costByDay.get("2026-09-26").peak, 0, "holiday Saturday flattens to off-peak");
  assert.equal(costByDay.get("2026-09-26").offpeak, 1, "holiday Saturday input at the off-peak rate");
  assert.equal(costByDay.get("2026-09-11").byModel.get("deepseek-flash").cost, 6, "per-model drill costs accumulate under the day's schedule");
  assert.equal(epochView.cost.total, 14.5, "the window cost sums the epoch day costs");
  assert.equal(epochView.cost.configured, true);
  assert.equal(epochView.modelBuckets[0].get("deepseek-v4-flash").peak.input, 1_000_000, "matrix rows keep the tier split for pricing");
  const overridden = buildView([epochSessions[1]], {
    granularity: "day", from: "2026-09-11", to: "2026-09-11",
    pricing: [{ model: "deepseek-flash", input: 10, cacheRead: 10, output: 10, peak: { input: 10, cacheRead: 10, output: 10 } }],
  });
  assert.equal(overridden.cost.total, 20, "user rules overlay the schedule base (peak 1M in + offpeak 1M out at 10/M)");
}

// --- GA-gap estimate rules ---------------------------------------------------
// Usage days before a schedule's `from` (and models later dropped from the
// current schedule) still price from the earliest published vintage, tagged
// `estimatedFrom`, so the observatory estimates instead of showing nothing.
{
  const preGa = officialEstimateRulesFor("2026-08-01");
  const byModel = new Map(preGa.map((rule) => [rule.model, rule]));
  assert.equal(byModel.get("deepseek-v4-pro").estimatedFrom, "2026-08-17", "v4-pro estimates from its first billing schedule");
  assert.equal(byModel.get("deepseek-v4-flash").estimatedFrom, "2026-08-17", "v4-flash estimates from its first billing schedule");
  assert.equal(byModel.get("deepseek-flash").estimatedFrom, "2026-09-10", "flash estimates from the only schedule that published it");
  assert.equal(byModel.get("deepseek-v4-pro").input, 4.5, "estimate rates are the published rates");
  // Once a day's own schedule prices a model it is no longer an estimate —
  // and models the latest schedule dropped keep pricing from their last vintage.
  const dropped = officialEstimateRulesFor("2026-10-01");
  assert.deepEqual(dropped.map((rule) => rule.model).sort(), ["deepseek-v4-flash", "deepseek-v4-flash-vision-exp"], "models absent from the current schedule keep their last published rates");
  assert.deepEqual(officialEstimateRulesFor("2026-08-01").filter((rule) => rule.estimatedFrom === undefined), [], "every estimate rule carries its vintage tag");
}

// --- subscription quota estimation -------------------------------------------
// Quota windows are rolling server-side percentages; the estimation layer
// slices local per-provider tokens over the exact span, calibrates the plan
// total, forecasts the burn and attributes it to projects.
{
  const dayMs = (day, hour = 0) => {
    const [y, m, d] = day.split("-").map(Number);
    return new Date(y, m - 1, d, hour, 0, 0, 0).getTime();
  };
  const ZAI = "zai-coding-cn";
  const modelOf = (provider, model) => `${provider}\u0000${model}`;
  const quotaSessions = [
    {
      project: "alpha", day: "2026-09-28",
      byDay: { "2026-09-28": { input: 100, output: 100, cacheRead: 0, cacheWrite: 0 } },
      modelsByDay: { "2026-09-28": { [modelOf(ZAI, "glm-5.3")]: { input: 100, output: 100, cacheRead: 0, cacheWrite: 0 } } },
      hoursByDay: { "2026-09-28": {
        "09": { [modelOf(ZAI, "glm-5.3")]: { input: 60, output: 60, cacheRead: 0, cacheWrite: 0 } },
        "21": { [modelOf(ZAI, "glm-5.3")]: { input: 40, output: 40, cacheRead: 0, cacheWrite: 0 } },
      } },
    },
    {
      project: "beta", day: "2026-09-29",
      byDay: { "2026-09-29": { input: 500, output: 500, cacheRead: 0, cacheWrite: 0 } },
      modelsByDay: {
        "2026-09-29": {
          [modelOf(ZAI, "glm-5.3")]: { input: 300, output: 300, cacheRead: 0, cacheWrite: 0 },
          "deepseek-v4-flash": { input: 200, output: 200, cacheRead: 0, cacheWrite: 0 },
        },
      },
    },
  ];
  // Whole-day slice: only the provider's own model keys count.
  const wholeDay = quotaWindowTokens(quotaSessions, dayMs("2026-09-29"), dayMs("2026-09-29") + 86400000, ZAI);
  assert.equal(wholeDay.total, 600, "day slice attributes the provider route's models only");
  // Hour-resolution partial day: hours 09:00–10:00 only (the 21:00 hour falls outside).
  const hourSlice = quotaWindowTokens(quotaSessions, dayMs("2026-09-28", 9), dayMs("2026-09-28", 10), ZAI);
  assert.equal(hourSlice.total, 120, "boundary day prefers the hour maps over the day totals");
  // A day WITH hour maps is hour-authoritative: hours without a bucket read
  // zero instead of a proportional guess (the coverage audit relies on it).
  const gapSlice = quotaWindowTokens(quotaSessions, dayMs("2026-09-28", 12), dayMs("2026-09-28", 18), ZAI);
  assert.equal(gapSlice.total, 0, "hours without a bucket contribute zero when hour maps exist");
  // A day WITHOUT hour maps keeps the proportional estimate (06:00–12:00 = ¼).
  const fracSlice = quotaWindowTokens(quotaSessions, dayMs("2026-09-29", 6), dayMs("2026-09-29", 12), ZAI);
  assert.equal(fracSlice.total, 150, "days without hour maps estimate by overlap fraction");
  // Spanning slices never double-count: both days sum to 200 + 600.
  const both = quotaWindowTokens(quotaSessions, dayMs("2026-09-28", 9), dayMs("2026-09-29") + 86400000, ZAI);
  assert.equal(both.total, 800, "multi-day slices sum distinct days exactly");
  // Calibration: 25% of a window that locally saw 800 tokens → 3200 total.
  const cal = quotaCalibrate(25, 800);
  assert.equal(cal.totalEst, 3200);
  assert.equal(cal.remainingEst, 2400);
  assert.equal(quotaCalibrate(0, 800), null, "no utilization → no calibration");
  assert.equal(quotaCalibrate(25, 0), null, "no local usage → no calibration");
  // Burn: two points 2h apart, +6%/h. From the newest sample (52%) the
  // remaining 48% exhausts in 8 more hours.
  const t0 = dayMs("2026-09-29", 8);
  const burn = quotaBurn([{ t: t0, pct: 40 }, { t: t0 + 2 * 3600000, pct: 52 }], t0, null);
  assert.equal(burn.perHour, 6);
  assert.equal(burn.exhaustsAt, t0 + 2 * 3600000 + (8 * 3600000), "exhaustion projects from the newest sample");
  const burnReset = quotaBurn([{ t: t0, pct: 40 }, { t: t0 + 2 * 3600000, pct: 52 }], t0, t0 + 2 * 3600000 + 3600000);
  assert.equal(burnReset.pctAtReset, 58, "reset projection extends the slope one hour");
  assert.equal(quotaBurn([{ t: t0, pct: 40 }], t0, null), null, "one point → no forecast");
  // Monthly fee normalization + per-project fee share.
  const fee = quotaMonthlyFee({ amount: 1200, currency: "CNY", cycle: "annually" });
  assert.equal(fee.monthly, 100, "annual fees divide by twelve");
  assert.equal(quotaMonthlyFee({ amount: 30, currency: "CNY", cycle: "weekly" }), null, "unknown cycles stay unmonetized");
  const attribution = quotaProjectAttribution(quotaSessions, dayMs("2026-09-28", 9), dayMs("2026-09-29") + 86400000, ZAI);
  assert.deepEqual(attribution.map((row) => row.project), ["beta", "alpha"], "attribution sorts by burn, descending");
  assert.equal(attribution[0].total, 600);
  assert.equal(Math.round(attribution[0].share * 100), 75, "beta holds 600 of 800 tokens");
  assert.equal(quotaFeeShare({ amount: 1200, currency: "CNY", cycle: "annually" }, 600, 800), 75, "fee share follows the token share");
  assert.equal(quotaFeeShare(null, 600, 800), null, "no fee → no money split");
  // Coverage audit: the provider's percentage is authoritative; this decides
  // only whether the dsh-derived token translation may be shown. Sessions
  // place tokens at exact hours via hoursByDay so interval slices are exact.
  const hour = 3600000;
  const covAt = (t) => {
    const d = new Date(t);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const hh = String(d.getHours()).padStart(2, "0");
    const key = modelOf(ZAI, "glm-5.3");
    return {
      project: "alpha", day,
      byDay: { [day]: { input: 1000, output: 0, cacheRead: 0, cacheWrite: 0 } },
      modelsByDay: { [day]: { [key]: { input: 1000, output: 0, cacheRead: 0, cacheWrite: 0 } } },
      hoursByDay: { [day]: { [hh]: { [key]: { input: 1000, output: 0, cacheRead: 0, cacheWrite: 0 } } } },
    };
  };
  const t1 = dayMs("2026-09-29", 8);
  // ok: two consecutive intervals, both with dsh usage, stable per-point factor.
  const okCov = quotaCoverage(
    [{ t: t1, provider: ZAI, window: "5h", pct: 10 }, { t: t1 + hour, provider: ZAI, window: "5h", pct: 11 }, { t: t1 + 2 * hour, provider: ZAI, window: "5h", pct: 12 }],
    [covAt(t1 + 60000), covAt(t1 + hour + 60000)],
    ZAI,
  );
  assert.equal(okCov.state, "ok", "stable per-point factors read as covered");
  assert.equal(okCov.intervals, 2);
  // external: utilization moved 3 points while dsh recorded nothing in between.
  const extCov = quotaCoverage(
    [{ t: t1, provider: ZAI, window: "5h", pct: 10 }, { t: t1 + hour, provider: ZAI, window: "5h", pct: 13 }],
    [covAt(t1 - hour)],
    ZAI,
  );
  assert.equal(extCov.state, "external", "movement without dsh usage exposes off-dsh spend");
  // thin: a single usable interval cannot judge stability.
  const thinCov = quotaCoverage(
    [{ t: t1, provider: ZAI, window: "5h", pct: 10 }, { t: t1 + hour, provider: ZAI, window: "5h", pct: 11 }],
    [covAt(t1 + 60000)],
    ZAI,
  );
  assert.equal(thinCov.state, "thin", "one interval is not enough to verify coverage");
  // sub-10-minute gaps never count as evidence.
  const noisy = quotaCoverage(
    [{ t: t1, provider: ZAI, window: "5h", pct: 10 }, { t: t1 + 60000, provider: ZAI, window: "5h", pct: 15 }],
    [],
    ZAI,
  );
  assert.equal(noisy.state, "thin", "poll noise within 10 minutes is skipped");
  assert.equal(quotaCoverage([], [], ZAI).state, "thin", "empty series stays thin");
  // Intervals reaching outside the covered span are skipped — their zero
  // local tokens would be a payload-cut artifact, not off-dsh spend.
  const bounded = quotaCoverage(
    [{ t: t1, provider: ZAI, window: "7d", pct: 10 }, { t: t1 + hour, provider: ZAI, window: "7d", pct: 13 }],
    [],
    ZAI,
    { fromMs: t1 + 120000, toMs: t1 + hour * 2 },
  );
  assert.equal(bounded.state, "thin", "intervals outside the covered span never flag external");
  assert.equal(quotaCoverage(
    [{ t: t1, provider: ZAI, window: "5h", pct: 10 }, { t: t1 + hour, provider: ZAI, window: "5h", pct: 13 }],
    [covAt(t1 - hour)],
    ZAI,
    { fromMs: t1, toMs: t1 + hour * 2 },
  ).state, "external", "intervals inside the covered span still flag external");
}

// --- auxiliary-call pseudo model (web-search) -------------------------------
// 形状折算：单次 {miss 8000, hit 1500, output 1000}。2026-09-29（周二）的
// 官方峰时价 2 / 0.04 / 8：一次峰时调用 = (8000×2 + 1500×0.04 + 1000×8)
// ÷ 1e6 = ¥0.02406；闲时 1 / 0.02 / 4 = ¥0.01203。
{
  const auxSession = [{
    id: "aux1", project: null, subagent: false, day: "2026-09-29",
    byDay: {}, modelsByDay: {}, turnsByDay: {}, toolCallsByDay: {},
    auxByDay: { "2026-09-29": { search: { peak: 2, offpeak: 1 } } },
  }];
  const aux = buildView(auxSession, { granularity: "day", from: "2026-09-27", to: "2026-09-29", pricing: [], fx: {} });
  const row = aux.models.find((m) => m.key === "web-search");
  assert.notEqual(row, undefined, "aux calls fold into a web-search pseudo-model row");
  assert.equal(row.input, 8000 * 3, "shape-derived miss input");
  assert.equal(row.cacheRead, 1500 * 3, "shape-derived cache-hit input");
  assert.equal(row.output, 1000 * 3, "shape-derived output");
  assert.equal(aux.totals.input, 0, "type-view local totals stay measurement-pure (no estimates)");
  assert.equal(aux.cost.configured, true, "aux cost prices under the official deepseek-flash rules");
  assert.equal(Math.round(aux.cost.total * 1e6) / 1e6, 0.04812 + 0.01203, "2 peak + 1 offpeak call at the day's official rates");
  // 模型筛选到其他模型时不掺入；筛到 web-search 本身则保留。
  const filtered = buildView(auxSession, { granularity: "day", from: "2026-09-27", to: "2026-09-29", model: "deepseek-v4-pro", pricing: [], fx: {} });
  assert.equal(filtered.models.some((m) => m.key === "web-search"), false, "aux row follows the model filter");
  const auxOnly = buildView(auxSession, { granularity: "day", from: "2026-09-27", to: "2026-09-29", model: "web-search", pricing: [], fx: {} });
  assert.equal(auxOnly.models.find((m) => m.key === "web-search") !== undefined, true, "the aux row is itself filterable");
}

// --- v0.6 multi-select model filter (the legend-linked full version) ----------
{
  const RULES = [
    { model: "ma", input: 1, output: 1 },
    { model: "mb", input: 2, output: 2 },
  ];
  const rec = (model, input) => ({
    project: "p", day: "2026-09-28",
    byDay: { "2026-09-28": { input, output: 0, cacheRead: 0, cacheWrite: 0 } },
    modelsByDay: { "2026-09-28": { [model]: { input, output: 0, cacheRead: 0, cacheWrite: 0 } } },
    hoursByDay: { "2026-09-28": { "10": { [model]: { input, output: 0, cacheRead: 0, cacheWrite: 0 } } } },
    turnsByDay: {}, toolCallsByDay: {},
  });
  const sessions = [rec("ma", 1_000_000), rec("mb", 2_000_000)];
  const sum = (v) => v.totals.input + v.totals.output;
  assert.equal(sum(buildView(sessions, { granularity: "day", from: "2026-09-28", to: "2026-09-28", models: [], pricing: RULES })), 3_000_000, "empty models = no filter");
  assert.equal(sum(buildView(sessions, { granularity: "day", from: "2026-09-28", to: "2026-09-28", models: ["mb"], pricing: RULES })), 2_000_000, "single-member set filters like the old single filter");
  assert.equal(sum(buildView(sessions, { granularity: "day", from: "2026-09-28", to: "2026-09-28", models: ["ma", "mb"], pricing: RULES })), 3_000_000, "multi-member set sums both");
  assert.equal(sum(buildView(sessions, { granularity: "day", from: "2026-09-28", to: "2026-09-28", model: "mb", models: [], pricing: RULES })), 2_000_000, "the legacy single model keeps working");
  // a bare member covers every provider's row of that model id
  const composite = [rec("prov\u0000ma", 500_000), rec("other\u0000ma", 250_000), rec("ma", 125_000)];
  assert.equal(sum(buildView(composite, { granularity: "day", from: "2026-09-28", to: "2026-09-28", models: ["ma"], pricing: RULES })), 875_000, "bare member matches composite rows of the same id");
  assert.equal(sum(buildView(composite, { granularity: "day", from: "2026-09-28", to: "2026-09-28", models: ["prov\u0000ma"], pricing: RULES })), 500_000, "composite member matches exactly");
  // filter-set helpers agree with the fold
  const set = modelFilterSet("", ["ma", "web-search"]);
  assert.equal(keyMatchesFilter(set, "prov\u0000ma"), true);
  assert.equal(keyMatchesFilter(set, "prov\u0000mb"), false);
  assert.equal(keyMatchesFilter(set, "web-search"), true);
  assert.equal(modelFilterSet("", []), null, "empty = all");
  // costSeries/hourlySeries/sessionGroups share the semantics
  const cs = costSeries(sessions, { from: "2026-09-28", to: "2026-09-28", models: ["ma"], pricing: RULES });
  assert.ok(cs[0].peak + cs[0].offpeak < 1.5, "cost series follows the multi-select (ma only: ¥1)");
  assert.equal(hourlySeries(sessions, "2026-09-28", { models: ["mb"] }).reduce((s, h) => s + h.input, 0), 2_000_000, "hourly series follows the multi-select");
  const groups = sessionGroups(sessions, { models: ["mb"], pricing: RULES });
  assert.equal(groups.length, 1, "session groups drop sessions that never used a selected model");
}

// --- v0.6 title-llm estimation rides the aux pseudo row ------------------------
{
  // A weekday-peak aux day: 1 peak search + 1 peak title with real text
  // estimates and a route key. deepseek-flash official (2026-09-28, peak):
  // miss 2/CNY-M, hit 0.04, out 8 → search = 8000×2/M + 1500×0.04/M + 1000×8/M
  // = 0.016 + 0.00006 + 0.008 = 0.02406. Title under v4-pro flat 4/16:
  // 1000×4/M + 32×16/M = 0.004 + 0.000512 = 0.004512.
  const auxRecord = {
    project: "p", day: "2026-09-28",
    byDay: {}, modelsByDay: {}, turnsByDay: {}, toolCallsByDay: {},
    auxByDay: {
      "2026-09-28": {
        search: { peak: 1, offpeak: 0 },
        title: { peak: 1, offpeak: 0 },
        titleIn: { peak: 1000, offpeak: 0 },
        titleOut: { peak: 32, offpeak: 0 },
        titleKey: "deepseek-v4-pro",
      },
    },
  };
  const RULE = { model: "deepseek-v4-pro", input: 4, cacheRead: 0.8, output: 16 };
  const view = buildView([auxRecord], { granularity: "day", from: "2026-09-28", to: "2026-09-28", pricing: [RULE] });
  const approx = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} != ${b}`);
  approx(view.cost.total, 0.02406 + 0.004512, "search shapes at flash rates, title prices under its own route");
  assert.equal(view.buckets[0].auxSearch, 1, "buckets carry the search-call count for the CSV");
  assert.equal(view.buckets[0].auxTitle, 1);
  assert.equal(view.knownModels.includes("web-search"), true, "the aux row is selectable in the model picker");
  assert.equal(view.models.find((m) => m.key === "web-search").input, 9000, "aux tokens = shape input + title text input");
  // costSeries agrees with the panel fold (the spark/CSV and the drill agree)
  const cs = costSeries([auxRecord], { from: "2026-09-28", to: "2026-09-28", pricing: [RULE] });
  approx(cs[0].peak, 0.028572, "cost series folds the same aux estimate");
  // a third-party title route never leaks into the official flash rate
  const thirdPartyTitle = buildView([{
    ...auxRecord,
    auxByDay: { "2026-09-28": { title: { peak: 1, offpeak: 0 }, titleIn: { peak: 1000, offpeak: 0 }, titleOut: { peak: 32, offpeak: 0 }, titleKey: "zai\u0000glm-5.3" } },
  }], { granularity: "day", from: "2026-09-28", to: "2026-09-28", pricing: [RULE] });
  assert.equal(thirdPartyTitle.cost.configured, false, "an unpriced third-party title route stays unpriced (honest)");
  // …and the caveat NAMES the id that has no rate, so it can be priced
  assert.deepEqual(thirdPartyTitle.cost.unpricedModels, [
    { key: "zai\u0000glm-5.3", provider: "zai", model: "glm-5.3", input: 1000, output: 32, total: 1032 },
  ], "the unpriced breakdown names the billing key, biggest first");
  // a priced title route contributes nothing to the caveat
  const pricedTitle = buildView([{
    ...auxRecord,
    auxByDay: { "2026-09-28": { title: { peak: 1, offpeak: 0 }, titleIn: { peak: 141, offpeak: 0 }, titleOut: { peak: 32, offpeak: 0 }, titleKey: "deepseek-official\u0000deepseek-v4-pro" } },
  }], { granularity: "day", from: "2026-09-28", to: "2026-09-28", pricing: [RULE] });
  assert.deepEqual(pricedTitle.cost.unpricedModels, [], "a title route with a rule is not reported as unpriced");
  // the real case: a title route whose model id has no rule is named, and only
  // its own tokens count (the search side still prices at the flash rate)
  const missingRule = buildView([{
    id: "titleonly", project: null, subagent: false, day: "2026-09-28",
    byDay: {}, modelsByDay: {}, turnsByDay: {}, toolCallsByDay: {},
    auxByDay: { "2026-09-28": { title: { peak: 1, offpeak: 0 }, titleIn: { peak: 197, offpeak: 0 }, titleOut: { peak: 32, offpeak: 0 }, titleKey: "deepseek-official\u0000deepseek-v4.1-pro" } },
  }], { granularity: "day", from: "2026-09-28", to: "2026-09-28", pricing: [RULE] });
  assert.deepEqual(missingRule.cost.unpricedModels, [
    { key: "deepseek-official\u0000deepseek-v4.1-pro", provider: "deepseek-official", model: "deepseek-v4.1-pro", input: 197, output: 32, total: 229 },
  ], "a title route the price table does not know is named in the caveat");
  assert.equal(missingRule.cost.unpriced.input, 197, "the totals keep counting the same missing tokens");
  // the aux shape option scales the search side (the calibrated shape flows in)
  const scaled = buildView([auxRecord], {
    granularity: "day", from: "2026-09-28", to: "2026-09-28", pricing: [RULE],
    auxShape: { miss: 4000, hit: 750, out: 1000 },
  });
  assert.equal(scaled.models.find((m) => m.key === "web-search").input, 4000 + 1000, "the shape option scales the search side, title keeps its own tokens");
  // auxDayUsage sanity: null on empty, counts on both kinds
  assert.equal(auxDayUsage({}, { miss: 1, hit: 1, out: 1 }), null);
  assert.equal(auxDayUsage({ search: { peak: 2, offpeak: 3 } }, { miss: 10, hit: 1, out: 1 }).searchCalls, 5);
}

// --- v0.6 session badge counts + hourly multi-select ---------------------------
{
  const record = {
    id: "aux1", project: "p", subagent: false, day: "2026-09-28",
    byDay: { "2026-09-28": { input: 10, output: 0, cacheRead: 0, cacheWrite: 0 } },
    modelsByDay: { "2026-09-28": { m: { input: 10, output: 0, cacheRead: 0, cacheWrite: 0 } } },
    turnsByDay: {}, toolCallsByDay: {},
    auxByDay: { "2026-09-28": { search: { peak: 2, offpeak: 1 } } },
  };
  const groups = sessionGroups([record], { pricing: [] });
  assert.equal(groups[0].sessions[0].auxSearch, 3, "the session row carries its own search-call count for the badge");
  const filteredGroups = sessionGroups([record], { pricing: [], models: ["other-model"] });
  assert.equal(filteredGroups.length, 0, "model filters still drop the session");
}

// --- v0.6 reconciliation + aux self-calibration ---------------------------------
{
  const RULE = { model: "deepseek-v4-pro", input: 4, cacheRead: 0.8, output: 16 };
  const day = (key, input, output, aux) => ({
    project: "p", day: key,
    byDay: { [key]: { input, output, cacheRead: 0, cacheWrite: 0 } },
    modelsByDay: { [key]: { deepseek_official_prefix: undefined } },
    turnsByDay: {}, toolCallsByDay: {},
    ...(aux ? { auxByDay: { [key]: aux } } : {}),
  });
  // build a cleaner record set directly: one official model row per day
  const mk = (key, tokens, aux) => ({
    project: "p", day: key,
    byDay: { [key]: tokens },
    modelsByDay: { [key]: { "deepseek-official\u0000deepseek-v4-pro": tokens } },
    tiersByDay: {},
    turnsByDay: {}, toolCallsByDay: {},
    ...(aux ? { auxByDay: { [key]: aux } } : {}),
  });
  const sessions = [
    mk("2026-09-25", { input: 1_000_000, output: 500_000, cacheRead: 0, cacheWrite: 0 }), // est 12, clean control
    mk("2026-09-26", { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 }, { search: { peak: 5, offpeak: 0 } }), // aux day
    mk("2026-09-27", { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 }), // control
    mk("2026-09-28", { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 }), // today-2: complete
  ];
  const official = [
    { key: "2026-09-25", spend: 12.4 },
    { key: "2026-09-26", spend: 4.05 },
    { key: "2026-09-27", spend: 4.0 },
    { key: "2026-09-28", spend: 4.0 },
  ];
  const rows = reconcileSeries(sessions, {
    from: "2026-09-25", to: "2026-09-28",
    pricing: [RULE], fx: {}, monthly: [],
    official,
  });
  const byDay = new Map(rows.map((r) => [r.key, r]));
  const approx = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} != ${b}`);
  approx(byDay.get("2026-09-25").est, 12, "official-channel measured cost prices under the rule");
  approx(byDay.get("2026-09-25").gap, 0.4, "gap = official − est − aux");
  assert.equal(byDay.get("2026-09-25").auxCalls, 0, "clean control day");
  assert.ok(byDay.get("2026-09-26").aux > 0, "the aux day estimates its shape cost");
  assert.equal(byDay.get("2026-09-26").auxCalls, 5);
  // third-party rows are out of the official account's scope
  const thirdRows = reconcileSeries([{
    project: "p", day: "2026-09-27",
    byDay: { "2026-09-27": { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 } },
    modelsByDay: { "2026-09-27": { "pi-ai\u0000m": { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 } } },
    turnsByDay: {}, toolCallsByDay: {},
  }], { from: "2026-09-27", to: "2026-09-27", pricing: [RULE], official: [{ key: "2026-09-27", spend: 1 }] });
  approx(thirdRows[0].est, 0, "third-party models never enter the official reconciliation");
  // unpriced official rows flag the day out of calibration (a model the
  // official table and the user rules both leave unpriced)
  const unpricedRows = reconcileSeries([{
    project: "p", day: "2026-09-27",
    byDay: { "2026-09-27": { input: 10, output: 0, cacheRead: 0, cacheWrite: 0 } },
    modelsByDay: { "2026-09-27": { "deepseek-official\u0000unknown-model": { input: 10, output: 0, cacheRead: 0, cacheWrite: 0 } } },
    tiersByDay: {},
    turnsByDay: {}, toolCallsByDay: {},
  }], {
    from: "2026-09-27", to: "2026-09-27", pricing: [], official: [{ key: "2026-09-27", spend: 1 }],
  });
  assert.equal(unpricedRows[0].unpriced, true, "unpriced official tokens flag the day");
  assert.equal(unpricedRows[0].est, 0);
  // sparse official days pass the flag through (interval spend, not a
  // calendar-day measurement — the drift/calibration gates read it)
  const sparseRows = reconcileSeries([], {
    from: "2026-09-27", to: "2026-09-27",
    official: [{ key: "2026-09-27", spend: 0.02, sparse: true }],
  });
  assert.equal(sparseRows[0].sparse, true, "sparse passes through");
  assert.equal(sparseRows[0].official, 0.02);
  assert.equal(reconcileSeries([], {
    from: "2026-09-27", to: "2026-09-27",
    official: [{ key: "2026-09-27", spend: 1 }],
  })[0].sparse, false, "absent flag means observed");

  // calibration: s = (aux + gap) / aux, median over consistent samples
  const today = "2026-09-30";
  const row = (key, officialSpend, auxSpend, auxCalls, unpriced = false) => ({
    key, est: 0, aux: auxSpend, official: officialSpend,
    gap: Math.round((officialSpend - auxSpend) * 1e6) / 1e6, auxCalls, unpriced,
  });
  const learned = auxCalibration([
    row("2026-09-20", 0.01, 0, 0), // clean control (gap 0.01, within tolerance)
    row("2026-09-24", 1.1, 1.0, 5), // s = 1.1
    row("2026-09-25", 1.1, 1.0, 5),
    row("2026-09-26", 1.1, 1.0, 5),
  ], { today });
  assert.equal(learned.status, "calibrated");
  approx(learned.medianS, 1.1, "median implied scalar");
  assert.deepEqual(learned.shape, { miss: 8800, hit: 1650, out: 1000 }, "the input side scales, output stays frozen");
  // aligned (within 3% of 1) keeps the seed
  const aligned = auxCalibration([
    row("2026-09-24", 1.01, 1.0, 5),
    row("2026-09-25", 1.01, 1.0, 5),
    row("2026-09-26", 1.01, 1.0, 5),
  ], { today });
  assert.equal(aligned.status, "calibrated");
  assert.deepEqual(aligned.shape, { miss: 8000, hit: 1500, out: 1000 }, "an aligned calibration keeps the seed");
  // too few samples → insufficient
  assert.equal(auxCalibration([row("2026-09-24", 1.1, 1.0, 5)], { today }).status, "insufficient");
  // inconsistent samples → insufficient (max/min > 1.6)
  assert.equal(auxCalibration([
    row("2026-09-24", 1.1, 1.0, 5),
    row("2026-09-25", 2.2, 1.0, 5),
    row("2026-09-26", 1.1, 1.0, 5),
  ], { today }).status, "insufficient", "a 2.2× outlier breaks the consistency band");
  // residual on a control day → divergent (learning suspended, seed kept)
  const divergent = auxCalibration([
    row("2026-09-23", 10, 0, 0),
    row("2026-09-24", 1.1, 1.0, 5),
    row("2026-09-25", 1.1, 1.0, 5),
  ], { today });
  assert.equal(divergent.status, "divergent");
  assert.deepEqual(divergent.shape, { miss: 8000, hit: 1500, out: 1000 });
  // manual shape freezes everything
  const manual = auxCalibration([row("2026-09-24", 1.1, 1.0, 5)], { today, manual: true });
  assert.equal(manual.status, "manual");
  // today and unknown-official days never participate
  const gated = auxCalibration([
    row("2026-09-29", 1.1, 1.0, 5), // today-1? No: today = 09-30, so 09-29 IS complete
    row("2026-09-30", 1.1, 1.0, 5), // today → excluded
  ], { today });
  assert.equal(gated.checkedDays, 1, "the running day never calibrates");
  // unpriced days are excluded
  assert.equal(auxCalibration([row("2026-09-24", 1.1, 1.0, 5, true)], { today }).checkedDays, 0);
  // sparse days are excluded: a snapshot gap's residual neither controls
  // (no false divergent) nor samples
  const sparseControl = auxCalibration([
    row("2026-09-25", 0.05, 0, 0), // observed control, gap within tolerance
    { ...row("2026-09-23", 10, 0, 0), key: "2026-09-24", sparse: true }, // gap 10, but sparse
  ], { today });
  assert.equal(sparseControl.status, "insufficient", "a sparse control day's residual never sets divergent");
  assert.equal(sparseControl.checkedDays, 1);
  assert.equal(sparseControl.divergentDays, 0);
  const sparseImplied = auxCalibration([
    { ...row("2026-09-24", 1.1, 1.0, 5), sparse: true },
    row("2026-09-25", 1.1, 1.0, 5),
    row("2026-09-26", 1.1, 1.0, 5),
    row("2026-09-27", 1.1, 1.0, 5),
  ], { today });
  assert.equal(sparseImplied.status, "calibrated");
  assert.equal(sparseImplied.samples, 3, "the sparse implied day is not sampled");

  // drift alarm: |gap| ≥ 15% of official AND ≥ ¥0.10 absolute on any recent
  // complete day; sparse days never alarm
  const driftRows = [
    { key: "2026-09-25", est: 12, aux: 0, official: 12.4, gap: 0.4, auxCalls: 0, unpriced: false }, // 3.2% — fine
    { key: "2026-09-26", est: 4, aux: 0, official: 10, gap: 6, auxCalls: 5, unpriced: false }, // 60% — drift
  ];
  const drift = reconDrift(driftRows, { today: "2026-09-30" });
  assert.equal(drift.count, 1);
  assert.equal(drift.pct, 60);
  assert.equal(drift.day, "2026-09-26");
  assert.equal(reconDrift([{ key: "2026-09-25", est: 4, aux: 0, official: 4.01, gap: 0.01, auxCalls: 0, unpriced: false }], { today: "2026-09-30" }), null, "a reconciling window raises nothing");
  // the real-world phantom: ¥0.02 of settlement residual on a zero-usage
  // day reads as +100% relatively but is noise absolutely
  const phantom = { key: "2026-09-27", est: 0, aux: 0, official: 0.02, gap: 0.02, auxCalls: 0, unpriced: false };
  assert.equal(reconDrift([phantom], { today: "2026-09-30" }), null, "sub-dime residuals never alarm");
  assert.equal(reconDrift([{ ...phantom, sparse: true, official: 5, gap: 5 }], { today: "2026-09-30" }), null, "sparse days never alarm");
  const real = reconDrift([phantom, { key: "2026-09-28", est: 0, aux: 0, official: 0.5, gap: 0.5, auxCalls: 0, unpriced: false }], { today: "2026-09-30" });
  assert.equal(real.pct, 100, "a real half-yuan divergence on a used day still alarms");
  assert.equal(real.day, "2026-09-28");
}

// --- deterministic model accents ----------------------------------------------
{
  const accentOf = (rows, overrides, options) => {
    const map = modelAccentMap(rows, overrides, options);
    return { map, entry: (row) => accentEntryOf(map, row.provider ?? "", row.model) };
  };
  // the same id wears the same color regardless of list order/composition
  const alone = accentOf([{ model: "deepseek-chat" }]).entry({ model: "deepseek-chat" }).fill;
  const crowded = accentOf([
    { model: "deepseek-reasoner" },
    { model: "deepseek-chat" },
    { model: "kimi-k2" },
    { model: "unknown-vendor-xyz" },
  ]).entry({ model: "deepseek-chat" }).fill;
  assert.equal(alone, crowded, "composition cannot recolor an unopposed model");
  assert.equal(modelAccentMap([{ model: "deepseek-chat" }, { model: "deepseek-chat" }]).size, 1, "duplicate ids collapse");
  // the deployment's main pair stays visually far apart on the brand gradient
  const chatFill = accentFillOf("deepseek-chat");
  const reasonerFill = accentFillOf("deepseek-reasoner");
  assert.notEqual(chatFill, reasonerFill, "deepseek siblings never share a fill");
  assert.ok(chatFill.includes("color-mix") && reasonerFill.includes("color-mix"), "vendor ids ride the brand gradient");
  // k3 ids belong to the moonshot family, not the unknown hash wheel
  assert.ok(accentFillOf("k3-256k").includes("#4b4b52"), "k3 rides the moonshot gradient");
  // the aux pseudo-model keeps its reserved gold, striped as an estimate
  const auxFill = accentFillOf("web-search");
  assert.ok(auxFill.startsWith("repeating-linear-gradient(") && auxFill.includes("oklch(68.0% 0.130 80.0)"),
    `aux accent is the reserved gold under a stripe texture (${auxFill})`);
  // unknown vendors: deterministic, and nudged off every vendor anchor hue
  const weird = accentFillOf("some-unknown-model");
  assert.equal(weird, accentFillOf("some-unknown-model"), "unknown ids are stable");
  assert.ok(weird.startsWith("oklch("), "unknown ids ride the hash wheel");
  assert.notEqual(accentFillOf("some-unknown-model"), accentFillOf("another-unknown-model"), "unknown siblings usually differ");
  // user overrides win; malformed ones fall back to the auto color
  const overridden = accentOf([{ model: "deepseek-chat" }], { "deepseek-chat": "#FF0000" }).entry({ model: "deepseek-chat" });
  assert.equal(overridden.fill, "#ff0000");
  assert.equal(overridden.custom, true, "overrides mark custom");
  const bad = accentOf([{ model: "deepseek-chat" }], { "deepseek-chat": "red" }).entry({ model: "deepseek-chat" });
  assert.equal(bad.custom, false, "non-hex overrides are ignored");

  // --- set-aware resolution: no two rows of one chart may look alike ----------
  // Measured before the fix: Claude's two anchors sit 0.035 ΔE apart and
  // several vendors' hashed slots land only 0.013 apart, so canonical colours
  // alone demonstrably collided at dot size. The resolver must clear the
  // target for every set a dashboard can actually show.
  const minPairDistance = (rows, options) => {
    const labs = [...modelAccentMap(rows, {}, options).values()].map((e) => (options?.bw === true ? [e.lab[0], 0, 0] : e.lab));
    let worst = Infinity;
    for (let i = 0; i < labs.length; i += 1) {
      for (let j = i + 1; j < labs.length; j += 1) worst = Math.min(worst, accentLabDistance(labs[i], labs[j]));
    }
    return worst;
  };
  const CLAUDE_SIBLINGS = [
    { provider: "anthropic", model: "claude-opus-4" },
    { provider: "anthropic", model: "claude-sonnet-4" },
  ];
  const DEEPSEEK_QUARTET = ["deepseek-v4-flash", "deepseek-v4-pro", "deepseek-flash", "deepseek-v4.1-pro"]
    .map((model) => ({ provider: "deepseek-official", model }));
  const ROUTE_TWINS = [
    { provider: "deepseek-official", model: "deepseek-flash" },
    { provider: "deepseek-account", model: "deepseek-flash" },
  ];
  const CROSS_VENDOR_TWINS = [
    { provider: "zai-coding-cn", model: "glm-5.3" },
    { provider: "google", model: "gemini-3-pro" },
  ];
  for (const [label, rows] of [
    ["claude siblings", CLAUDE_SIBLINGS],
    ["deepseek quartet", DEEPSEEK_QUARTET],
    ["same id on two routes", ROUTE_TWINS],
    ["cross-vendor canonical twins", CROSS_VENDOR_TWINS],
    ["aux beside a family", [{ provider: "", model: "web-search" }, { provider: "anthropic", model: "claude-opus-4" }]],
  ]) {
    assert.ok(minPairDistance(rows) >= ACCENT_MIN_DISTANCE,
      `${label}: every pair stays at least ${ACCENT_MIN_DISTANCE} ΔE apart (got ${minPairDistance(rows).toFixed(3)})`);
  }
  // order cannot matter, and a twin never moves an unopposed model
  const forward = [...modelAccentMap(CLAUDE_SIBLINGS, {}).entries()];
  const backward = [...modelAccentMap([...CLAUDE_SIBLINGS].reverse(), {}).entries()];
  assert.deepEqual(forward, backward, "resolution is order-independent");
  assert.equal(accentOf([{ provider: "anthropic", model: "claude-opus-4" }]).entry({ provider: "anthropic", model: "claude-opus-4" }).fill,
    accentFillOf("claude-opus-4"), "an unopposed model keeps its canonical paint");
  assert.notEqual(
    accentEntryOf(modelAccentMap(ROUTE_TWINS), "deepseek-official", "deepseek-flash").fill,
    accentEntryOf(modelAccentMap(ROUTE_TWINS), "deepseek-account", "deepseek-flash").fill,
    "the same model id on two routes is still two distinguishable swatches",
  );
  // B&W theme: a grey ladder instead of one flat grey, hand-picked colours kept
  const bwRows = [...CLAUDE_SIBLINGS, ...ROUTE_TWINS];
  const bwMap = modelAccentMap(bwRows, { "claude-opus-4": "#123456" }, { bw: true });
  assert.ok(minPairDistance(bwRows, { bw: true }) >= ACCENT_MIN_DISTANCE, "the greyscale ladder still separates");
  const bwGrey = accentEntryOf(bwMap, "anthropic", "claude-sonnet-4").fill;
  assert.ok(bwGrey.startsWith("oklch(") && bwGrey.includes("0.000"), `auto colours are emitted as greys (${bwGrey})`);
  assert.equal(accentEntryOf(bwMap, "anthropic", "claude-opus-4").fill, "#123456", "a hand-picked colour survives the B&W theme");
}

// --- provider route families (one DeepSeek account, two routes) -----------------
{
  // The hand-entered API route and the route the desktop client adds on sign-in
  // bill the same balance: the reconciliation must see both, the label must
  // collapse, and the per-route identity must survive for a future split.
  assert.equal(isOfficialProvider(""), true, "the wildcard provider is official");
  assert.equal(isOfficialProvider("deepseek-official"), true);
  assert.equal(isOfficialProvider("deepseek-account"), true, "the signed-in account route is the same official channel");
  assert.equal(isOfficialProvider("kimi-coding"), false, "third-party routes stay third-party");
  assert.equal(familyRouteOf("deepseek-account").family, "deepseek");
  assert.equal(familyRouteOf("deepseek").family, "deepseek", "the family id itself also resolves (display rows are keyed by it)");
  assert.equal(isOfficialProvider("deepseek"), true, "a family-rolled selection still counts as official");
  assert.equal(familyRouteOf("zai-coding-cn"), null, "a standalone route has no family");
  assert.equal(providerLabelOf("deepseek-account"), "DeepSeek", "the family label collapses the two routes");
  assert.equal(providerLabelOf("kimi-coding"), "kimi-coding", "a familyless route falls back to its id");
  assert.equal(rollupKeyOf("deepseek-official", "deepseek-flash"), rollupKeyOf("deepseek-account", "deepseek-flash"), "both routes fold onto one display key");
  assert.notEqual(rollupKeyOf("zai-coding-cn", "glm-5.3"), rollupKeyOf("kimi-coding", "glm-5.3"), "familyless routes keep their own key");

  // A filter entry naming the merged row covers both routes; route-scoped and
  // legacy bare selections keep working.
  const rolledSet = modelFilterSet("", [rollupKeyOf("deepseek-official", "deepseek-flash")]);
  assert.equal(keyMatchesFilter(rolledSet, "deepseek-official\u0000deepseek-flash"), true, "the merged entry selects the API route");
  assert.equal(keyMatchesFilter(rolledSet, "deepseek-account\u0000deepseek-flash"), true, "…and the account route");
  assert.equal(keyMatchesFilter(rolledSet, "deepseek-official\u0000deepseek-v4-pro"), false, "…and nothing else");

  const tokens = (n) => ({ input: n, output: n, cacheRead: 0, cacheWrite: 0 });
  const row = (provider, model, n) => ({
    key: `${provider}\u0000${model}`, provider, model,
    ...tokens(n), peak: tokens(n), offpeak: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  });
  const view = {
    models: [
      row("deepseek-official", "deepseek-flash", 100),
      row("deepseek-account", "deepseek-flash", 300),
      row("deepseek-account", "deepseek-v4-pro", 20),
      row("kimi-coding", "k3-256k", 7),
    ],
    modelBuckets: [new Map([
      ["deepseek-official\u0000deepseek-flash", tokens(1)],
      ["deepseek-account\u0000deepseek-flash", tokens(2)],
      ["kimi-coding\u0000k3-256k", tokens(5)],
    ])],
    bucketCosts: [{
      key: "2026-09-29", peak: 0, offpeak: 0, unpriced: { input: 0, output: 0 },
      byModel: new Map([
        ["deepseek-official\u0000deepseek-flash", { model: "deepseek-flash", provider: "deepseek-official", priceAs: "deepseek-flash", cost: 1.25 }],
        ["deepseek-account\u0000deepseek-flash", { model: "deepseek-flash", provider: "deepseek-account", priceAs: "deepseek-flash", cost: 2.5 }],
        ["kimi-coding\u0000k3-256k", { model: "k3-256k", provider: "kimi-coding", priceAs: "k3-256k", cost: 0.5 }],
      ]),
    }],
  };
  const rolled = rollupModelFamilies(view);
  const merged = rolled.view.models.find((m) => m.key === "deepseek\u0000deepseek-flash");
  assert.notEqual(merged, undefined, "both routes fold into one DeepSeek row");
  assert.equal(merged.input, 400, "the merged row sums both routes' tokens");
  assert.equal(merged.peak.input, 400, "…including the tier split");
  assert.deepEqual(merged.routes, ["deepseek-official", "deepseek-account"], "the merged row records which routes fed it");
  assert.equal(merged.provider, "deepseek-official", "a merged row is named by a route that actually served it");
  assert.equal(rolled.view.models.filter((m) => m.model === "deepseek-flash").length, 1, "one row per model, not one per route");
  assert.equal(rolled.view.models.find((m) => m.model === "k3-256k").key, "kimi-coding\u0000k3-256k", "familyless rows are untouched");
  assert.equal(rolled.view.modelBuckets[0].get("deepseek\u0000deepseek-flash").input, 3, "per-day matrices fold too");
  assert.equal(rolled.view.modelBuckets[0].get("kimi-coding\u0000k3-256k").input, 5, "…without disturbing other providers");
  assert.equal(rolled.view.bucketCosts[0].byModel.get("deepseek\u0000deepseek-flash").cost, 3.75, "priced cost is summed AFTER each route priced under its own rules");
  // the split artifact: exactly the merged family, per route
  assert.deepEqual(rolled.modelRoutes.map((r) => `${r.family}|${r.provider}|${r.model}|${r.input}`).sort(), [
    "deepseek|deepseek-account|deepseek-flash|300",
    "deepseek|deepseek-account|deepseek-v4-pro|20",
    "deepseek|deepseek-official|deepseek-flash|100",
  ], "the per-route rows ride along for a future split");
  // a single-route family needs no detail payload
  const single = rollupModelFamilies({ models: [row("deepseek-official", "deepseek-flash", 5)] });
  assert.deepEqual(single.modelRoutes, [], "no merge, no split artifact");
  assert.deepEqual(rollupModelFamilies(null), { view: null, modelRoutes: [] }, "a null view is inert");
  // the filter picker lists the merged identity, not one entry per route
  const picker = rollupModelFamilies({
    models: [],
    knownModels: ["deepseek-account\u0000deepseek-flash", "deepseek-official\u0000deepseek-flash", "kimi-coding\u0000k3-256k"],
  });
  assert.deepEqual(picker.view.knownModels, ["deepseek\u0000deepseek-flash", "kimi-coding\u0000k3-256k"], "knownModels folds too");
}

// --- cost-trend segment identity (the colour bug) -------------------------------
{
  // The aux pseudo-model prices AT a real model's rates but IS its own model:
  // the per-day cost row must keep both, or the chart colours (and names) the
  // segment after the pricing target — which is how the aux bar turned grey in
  // the 7-day cost trend while its legend dot stayed gold.
  const auxSession = [{
    id: "aux-identity", project: null, subagent: false, day: "2026-09-29",
    byDay: {}, modelsByDay: {}, turnsByDay: {}, toolCallsByDay: {},
    auxByDay: { "2026-09-29": { search: { peak: 1, offpeak: 0 } } },
  }];
  const view = buildView(auxSession, { granularity: "day", from: "2026-09-29", to: "2026-09-29", pricing: [], fx: {} });
  const bucket = view.bucketCosts[0];
  const entry = bucket.byModel.get("web-search");
  assert.notEqual(entry, undefined, "the aux cost row is keyed by the aux model");
  assert.equal(entry.model, "web-search", "the row's identity is the model it belongs to");
  assert.equal(entry.priceAs, "deepseek-flash", "…while the rate it billed at stays visible");
  // pricing-style keys still own their identity
  const priced = buildView([{
    project: "p", day: "2026-09-29",
    byDay: { "2026-09-29": { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 } },
    modelsByDay: { "2026-09-29": { "deepseek-official\u0000deepseek-flash": { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 } } },
    turnsByDay: {}, toolCallsByDay: {},
  }], { granularity: "day", from: "2026-09-29", to: "2026-09-29", pricing: [], fx: {} });
  const real = priced.bucketCosts[0].byModel.get("deepseek-official\u0000deepseek-flash");
  assert.equal(real.model, "deepseek-flash");
  assert.equal(real.provider, "deepseek-official");
  // and the accent lookup the chart performs now finds the aux gold
  const accents = modelAccentMap(priced.bucketCosts[0].byModel.size > 0 ? [{ provider: "", model: "web-search" }] : [], {});
  assert.equal(accentEntryOf(accents, "", "web-search").aux, true, "the aux segment resolves to the reserved gold, not the fallback grey");
}



// --- hourly cost: single-day, official-console repricing ------------------------
{
  const RULE = { model: "deepseek-v4-pro", input: 4, cacheRead: 0.8, output: 16, peak: { input: 8, cacheRead: 1.6, output: 32 } };
  const tokens = () => ({ input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 });
  const sessions = [{
    project: "p",
    hoursByDay: {
      "2026-09-29": {
        9: { "deepseek-official\u0000deepseek-v4-pro": tokens() },
        12: { "deepseek-official\u0000deepseek-v4-pro": tokens() },
        23: { "deepseek-official\u0000deepseek-v4-pro": tokens() },
      },
      "2026-09-27": {
        9: { "deepseek-official\u0000deepseek-v4-pro": tokens() },
      },
    },
  }];
  const hc = hourlyCostSeries(sessions, "2026-09-29", { pricing: [RULE], fx: {} });
  assert.equal(hc.hours.length, 24, "24 buckets");
  // 2026-09-29 is a Tuesday: hour 9 rides the official peak window, 12/23 sit off-peak
  assert.ok(hc.hours[9].peak > 0 && hc.hours[9].offpeak === 0, "the peak hour prices wholly at peak");
  assert.ok(hc.hours[12].offpeak > 0 && hc.hours[12].peak === 0, "off-peak hours price wholly off-peak");
  assert.ok(hc.hours[9].cost > hc.hours[12].cost, "peak input is pricier than off-peak input");
  for (const hour of hc.hours) {
    assert.ok(Math.abs(hour.cost - hour.peak - hour.offpeak) < 1e-6, "cost = peak + offpeak per hour");
  }
  assert.ok(hc.hours.filter((h) => h.cost > 0).length === 3, "only the used hours carry cost");
  // Sunday: weekday-only rules flatten everything to off-peak
  const sun = hourlyCostSeries(sessions, "2026-09-27", { pricing: [RULE], fx: {} });
  assert.ok(sun.hours[9].offpeak > 0 && sun.hours[9].peak === 0, "the weekend flattens to off-peak");
  assert.ok(sun.hours[9].cost === hc.hours[12].cost, "weekend peak-hour tokens price as off-peak");
  // unpriced models count for the footnote, never guess a rate
  const unpriced = hourlyCostSeries([{ project: "p", hoursByDay: { "2026-09-29": { 9: { "deepseek-official\u0000mystery": { input: 10, output: 0, cacheRead: 0, cacheWrite: 0 } } } } }], "2026-09-29", { pricing: [RULE] });
  assert.equal(unpriced.unpricedTokens, 10);
  assert.equal(unpriced.hours[9].cost, 0);
  // model filter excludes non-matching rows; aux never rides hoursByDay
  const filtered = hourlyCostSeries(sessions, "2026-09-29", { pricing: [RULE], models: ["kimi-k2"] });
  assert.equal(filtered.hours.filter((h) => h.cost > 0).length, 0, "a non-matching filter empties the day");
  // invalid day keys fold to zeros, not NaN
  assert.equal(hourlyCostSeries(sessions, "nope", { pricing: [RULE] }).hours[9].cost, 0);
}

console.log("view-test: all assertions passed");
