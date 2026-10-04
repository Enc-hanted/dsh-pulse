/**
 * golden-test.mjs — the TUI/web consistency lock (防线).
 *
 * The ¥0 incident proved how expensive it is when the two faces' render
 * paths drift apart silently. This suite pushes the SAME fixture fold
 * through BOTH of them — the TUI's `viewSlice` and the web face's
 * `buildView` — and pins:
 *
 * 1. Same rule layers in → same tokens and same money out (per day and
 *    per window), tier-aware pricing included.
 * 2. The ONE deliberate divergence — the TUI's GA-gap estimate layer —
 *    is asserted explicitly, so it can only ever change on purpose.
 */

import assert from "node:assert/strict";

import { viewSlice } from "../src/tui.js";
import {
	buildView, strictRulesWith, fullRulesWith,
	DEFAULT_USD_TO_CNY, MODEL_SEP,
} from "../src/view.js";

const RULE = { model: "deepseek-v4-pro", input: 4, cacheRead: 0.8, output: 16, peak: { input: 8 } };
const FX = { usdToCny: DEFAULT_USD_TO_CNY };
const base = { fx: FX, monthly: [], monthlySet: new Set(), costEnabled: true, modelColors: {} };
/** The strict layer exactly as both faces build it: official schedule + user overlay. */
const strictFor = (day) => strictRulesWith(day, [RULE]);
/** The TUI's full layer: the GA-gap estimate vintage underlays the schedule. */
const fullFor = (day) => fullRulesWith(day, [RULE]);
const strictPricing = { ...base, strictFor, fullFor: strictFor };
const estimatePricing = { ...base, strictFor, fullFor };

/** Fixture: one merged fold — a tier-split weekday (all-peak input) and a
 *  flat day (no tier split, exercising the whole-row fallback), same shape
 *  `mergeRecord` produces and `buildView` consumes. */
const PRO = `${MODEL_SEP}deepseek-v4-pro`;
const merged = {
	byDay: {
		"2026-08-20": { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 },
		"2026-08-21": { input: 2_000_000, output: 250_000, cacheRead: 0, cacheWrite: 0 },
	},
	modelsByDay: {
		"2026-08-20": { [PRO]: { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 } },
		"2026-08-21": { [PRO]: { input: 2_000_000, output: 250_000, cacheRead: 0, cacheWrite: 0 } },
	},
	tiersByDay: {
		"2026-08-20": { [PRO]: {
			input: { peak: 1_000_000, offpeak: 0 },
			output: { peak: 0, offpeak: 0 },
			cacheRead: { peak: 0, offpeak: 0 },
			cacheWrite: { peak: 0, offpeak: 0 },
		} },
	},
	hoursByDay: {}, turnsByDay: {}, toolCallsByDay: {}, firstDay: null,
};

const DAYS = ["2026-08-20", "2026-08-21"];
const approx = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} != ${b}`);

let failed = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test("same layers → same window tokens (TUI viewSlice == web buildView)", () => {
	const slice = viewSlice(merged, DAYS, strictPricing);
	const view = buildView([merged], { granularity: "day", from: DAYS[0], to: DAYS[1], pricing: [RULE], fx: FX, monthly: [] });
	const webTokens = view.totals.input + view.totals.output + view.totals.cacheRead + view.totals.cacheWrite;
	assert.equal(slice.tokens, webTokens, "window tokens must agree");
});

test("same layers → same window money, tier-aware on both sides", () => {
	const slice = viewSlice(merged, DAYS, strictPricing);
	const view = buildView([merged], { granularity: "day", from: DAYS[0], to: DAYS[1], pricing: [RULE], fx: FX, monthly: [] });
	assert.equal(view.cost.configured, true);
	// Day 1: 1M all-peak input @ ¥8/M = ¥8. Day 2 (no tiers): 2M @ ¥4 + 0.25M output @ ¥16 = ¥12.
	approx(slice.costTotal, 20, "TUI window total");
	approx(view.cost.total, 20, "web window total");
	approx(slice.values.get("2026-08-20").cost, 8, "TUI day-1 tier-aware");
	approx(view.bucketCosts[0].peak + view.bucketCosts[0].offpeak, 8, "web day-1 tier-aware");
	approx(slice.values.get("2026-08-21").cost, 12, "TUI day-2 flat fallback");
	approx(view.bucketCosts[1].peak + view.bucketCosts[1].offpeak, 12, "web day-2 flat fallback");
});

test("the GA-gap estimate layer is the ONE deliberate TUI/web divergence", () => {
	const flashDay = "2026-08-03"; // Monday, before the v4 schedule's billing-effective date
	const flash = {
		byDay: { [flashDay]: { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 } },
		modelsByDay: { [flashDay]: { [`${MODEL_SEP}deepseek-v4-flash`]: { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 } } },
		tiersByDay: {}, hoursByDay: {}, turnsByDay: {}, toolCallsByDay: {}, firstDay: null,
	};
	const sliceFull = viewSlice(flash, [flashDay], estimatePricing);
	const sliceStrict = viewSlice(flash, [flashDay], strictPricing);
	const view = buildView([flash], { granularity: "day", from: flashDay, to: flashDay, pricing: [RULE], fx: FX, monthly: [] });
	assert.ok(sliceFull.costTotal > 0, "TUI full layer must price the GA gap (≈估算)");
	assert.equal(sliceFull.windowCost.estimated, true);
	assert.equal(sliceStrict.costTotal, 0, "strict layer prices it at zero on both faces");
	assert.ok(view.cost.total === null || view.cost.total === 0, "web face (strict) shows no money here");
});

test("user overlay wins over the official schedule on both faces", () => {
	// RULE prices v4-pro at ¥4/M off-peak while the official table says
	// otherwise — both faces must honor the user's number.
	const slice = viewSlice(merged, ["2026-08-21"], strictPricing);
	const view = buildView([merged], { granularity: "day", from: "2026-08-21", to: "2026-08-21", pricing: [RULE], fx: FX, monthly: [] });
	approx(slice.costTotal, 12, "TUI honors the user rule");
	approx(view.cost.total, 12, "web honors the user rule");
});

for (const [name, fn] of tests) {
	try {
		fn();
		console.log(`  ok  ${name}`);
	} catch (error) {
		failed += 1;
		console.error(`FAIL  ${name}`);
		console.error(error?.message ?? error);
	}
}
if (failed > 0) {
	console.error(`\n${failed}/${tests.length} failed`);
	process.exit(1);
}
console.log(`\nall ${tests.length} golden suites passed`);
