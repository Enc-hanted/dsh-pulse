/**
 * tui-test.mjs — locks the TUI face's honesty classification (`viewSlice`).
 *
 * The regression that started this suite: usage days BEFORE a price
 * schedule's billing-effective date (the GA gap) were reported as
 * "未匹配价目表 / 成本按 0 计" while the estimate layer priced them —
 * three contradictory claims on one screen. viewSlice must classify each
 * model into exactly one of 按量 / 估算 / 包月 / 未定价 and keep every
 * money figure consistent with those labels.
 */

import assert from "node:assert/strict";

import {
	viewSlice, mergeRecord, money, wrapDisplay, displayWidth, eqId,
	monthLabelOfWeek, compactTokensTight, sparkTrend, weeklyBars,
	modelLayout, peakHoursFor, ganttRows, miniCardModel, pricingLabelOf,
	apply, cursorStep, resolveTheme, hexMix, fitDisplay, truncateDisplay,
	yearTiles, layoutBudget, fmtTokens,
	noteCurrentSession, pulseStripToggle, stripStore, _resetStripForTests,
} from "../src/tui.js";
import { collect, foldCache } from "../src/tui/data.js";
import { DEFAULT_USD_TO_CNY, MODEL_SEP, costOf } from "../src/view.js";

/** v4 prices (per-million, CNY) — same shape as the built-in schedules. */
const V4_RATES = {
	"deepseek-v4-pro": { input: 4, cacheRead: 0.8, output: 16 },
	"deepseek-v4-flash": { input: 0.5, cacheRead: 0.1, output: 2 },
};

function makePricing({ rules = [], monthly = [], estimateModels = [] } = {}) {
	const fx = { usdToCny: DEFAULT_USD_TO_CNY };
	const monthlySet = new Set(monthly);
	// Provider-less (wild) rules standing in for the user's own entries.
	const userRules = rules.map((r) => ({ ...r }));
	// The GA-gap stand-in: published vintage rates the strict layer
	// withholds — what officialRulesFor does before a schedule's
	// billing-effective date.
	const estimates = estimateModels.map((model) => ({ model, ...V4_RATES[model] }));
	return {
		fx, monthly, monthlySet,
		costEnabled: true,
		modelColors: {},
		strictFor: () => [...userRules],
		fullFor: () => [...estimates, ...userRules],
	};
}

function dayRow(key, input, output = 0, cacheRead = 0) {
	return { [key]: { input, output, cacheRead, cacheWrite: 0 } };
}

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test("GA gap: pre-effective-date usage prices as 估算, never 未定价", () => {
	const pricing = makePricing({ estimateModels: ["deepseek-v4-pro"] });
	const record = {
		byDay: { "2026-08-14": { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 } },
		modelsByDay: { "2026-08-14": dayRow(`${MODEL_SEP}deepseek-v4-pro`, 1_000_000) },
		turnsByDay: {}, toolCallsByDay: {},
	};
	const cal = viewSlice(record, ["2026-08-14"], pricing);
	assert.equal(cal.models.length, 1);
	assert.equal(cal.models[0].state, "estimated", "estimate-covered models must read 估算, not 未定价");
	assert.equal(cal.unpriced.length, 0, "estimate coverage must clear the 未定价 list");
	assert.ok(cal.windowCost.total > 0, "estimated money must be visible, not ¥0");
	assert.equal(cal.windowCost.estimated, true);
	// 1M input × ¥4/M = ¥4
	assert.ok(Math.abs(cal.models[0].cost - 4) < 1e-6);
	assert.ok(Math.abs(cal.windowCost.total - 4) < 1e-6);
});

test("truly priceless models stay 未定价 and land in the warning list", () => {
	const pricing = makePricing({});
	const record = {
		byDay: { "2026-08-14": { input: 500_000, output: 0, cacheRead: 0, cacheWrite: 0 } },
		modelsByDay: { "2026-08-14": dayRow(`ghost${MODEL_SEP}mystery-model`, 500_000) },
		turnsByDay: {}, toolCallsByDay: {},
	};
	const cal = viewSlice(record, ["2026-08-14"], pricing);
	assert.equal(cal.models[0].state, "unpriced");
	assert.deepEqual(cal.unpriced, ["mystery-model"]);
	assert.equal(cal.models[0].cost, 0);
	assert.equal(cal.windowCost.total, 0);
	assert.equal(cal.windowCost.estimated, false);
});

test("monthly-subscribed providers read 包月 at zero marginal cost", () => {
	const pricing = makePricing({ monthly: ["subhub"] });
	const record = {
		byDay: { "2026-08-20": { input: 250_000, output: 0, cacheRead: 0, cacheWrite: 0 } },
		modelsByDay: { "2026-08-20": dayRow(`subhub${MODEL_SEP}sub-model`, 250_000) },
		turnsByDay: {}, toolCallsByDay: {},
	};
	const cal = viewSlice(record, ["2026-08-20"], pricing);
	assert.equal(cal.models[0].state, "monthly");
	assert.equal(cal.models[0].cost, 0);
	assert.equal(cal.unpriced.length, 0, "包月 models are priced by design");
});

test("billing-effective days price strictly: 按量, no ≈ flag", () => {
	const pricing = makePricing({ rules: [{ model: "deepseek-v4-pro", ...V4_RATES["deepseek-v4-pro"] }] });
	const record = {
		byDay: { "2026-08-20": { input: 2_000_000, output: 0, cacheRead: 0, cacheWrite: 0 } },
		modelsByDay: { "2026-08-20": dayRow(`${MODEL_SEP}deepseek-v4-pro`, 2_000_000) },
		turnsByDay: {}, toolCallsByDay: {},
	};
	const cal = viewSlice(record, ["2026-08-20"], pricing);
	assert.equal(cal.models[0].state, "priced");
	assert.equal(cal.windowCost.estimated, false);
	// strict price on the effective day == full price: 2M × ¥4/M = ¥8
	assert.ok(Math.abs(cal.windowCost.total - 8) < 1e-6);
});

test("mixed windows: estimate days flag ≈, unpriced days still warn", () => {
	const pricing = makePricing({ estimateModels: ["deepseek-v4-flash"] });
	const flash = `${MODEL_SEP}deepseek-v4-flash`;
	const record = {
		byDay: {
			"2026-08-14": { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 },
			"2026-08-20": { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 },
			"2026-08-21": { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 },
		},
		modelsByDay: {
			"2026-08-14": dayRow(flash, 1_000_000), // GA gap → estimate ¥0.5
			"2026-08-20": dayRow(flash, 1_000_000), // effective → strict ¥0.5
			"2026-08-21": dayRow(`ghost${MODEL_SEP}mystery`, 1_000_000), // never priced
		},
		turnsByDay: {}, toolCallsByDay: {},
	};
	const cal = viewSlice(record, ["2026-08-14", "2026-08-20", "2026-08-21"], pricing);
	const byModel = new Map(cal.models.map((m) => [m.model, m]));
	assert.equal(byModel.get("deepseek-v4-flash").state, "estimated");
	assert.equal(byModel.get("mystery").state, "unpriced");
	assert.deepEqual(cal.unpriced, ["mystery"]);
	assert.equal(cal.windowCost.estimated, true, "the GA-gap day must raise the ≈ flag");
	// flash: 2M × ¥0.5/M = ¥1; mystery contributes nothing
	assert.ok(Math.abs(cal.windowCost.total - 1) < 1e-6);
});

test("window total equals the per-day sum (no single-first-day repricing)", () => {
	const pricing = makePricing({ rules: [{ model: "deepseek-v4-pro", ...V4_RATES["deepseek-v4-pro"] }] });
	const pro = `${MODEL_SEP}deepseek-v4-pro`;
	const record = {
		byDay: {
			"2026-08-13": { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 },
			"2026-08-14": { input: 3_000_000, output: 0, cacheRead: 0, cacheWrite: 0 },
		},
		modelsByDay: {
			"2026-08-13": dayRow(pro, 1_000_000),
			"2026-08-14": dayRow(pro, 3_000_000),
		},
		turnsByDay: {}, toolCallsByDay: {},
	};
	const cal = viewSlice(record, ["2026-08-13", "2026-08-14"], pricing);
	// 4M × ¥4/M = ¥16 — and NOT 4M priced once under 08-13's rules
	assert.ok(Math.abs(cal.windowCost.total - 16) < 1e-6, `window total ${cal.windowCost.total} != 16`);
});

test("merged records keep tier splits money-visible (the ¥0 regression)", () => {
	const pricing = makePricing({ rules: [{ model: "deepseek-v4-pro", input: 4, cacheRead: 0.8, output: 16, peak: { input: 8 } }] });
	const key = `${MODEL_SEP}deepseek-v4-pro`;
	// Fold shape: token kinds nest peak/offpeak INSIDE each kind — the merge
	// must NOT reshape this into flat peak/offpeak buckets (that made
	// dayModelRows hand costOf all-zero-but-defined splits → ¥0 money).
	const mk = (input) => ({
		byDay: { "2026-08-14": { input, output: 0, cacheRead: 0, cacheWrite: 0 } },
		modelsByDay: { "2026-08-14": { [key]: { input, output: 0, cacheRead: 0, cacheWrite: 0 } } },
		tiersByDay: { "2026-08-14": { [key]: {
			input: { peak: input, offpeak: 0 },
			output: { peak: 0, offpeak: 0 },
			cacheRead: { peak: 0, offpeak: 0 },
			cacheWrite: { peak: 0, offpeak: 0 },
		} } },
		turnsByDay: {}, toolCallsByDay: {}, hoursByDay: {},
	});
	const merged = { byDay: {}, modelsByDay: {}, hoursByDay: {}, tiersByDay: {}, turnsByDay: {}, toolCallsByDay: {}, firstDay: null };
	mergeRecord(merged, mk(1_000_000));
	mergeRecord(merged, mk(500_000));
	const cal = viewSlice(merged, ["2026-08-14"], pricing);
	// 1.5M input ALL on the peak side → peak rate ¥8/M → ¥12 (not ¥6 off-peak, not ¥0)
	assert.ok(Math.abs(cal.models[0].cost - 12) < 1e-6, `merged tier-aware cost ${cal.models[0].cost} != 12`);
	assert.equal(cal.models[0].state, "priced");
	assert.equal(cal.windowCost.estimated, false);
	assert.ok(Math.abs(cal.windowCost.total - 12) < 1e-6);
});

test("records without tier splits price wholly (fallback preserved)", () => {
	const pricing = makePricing({ rules: [{ model: "deepseek-v4-pro", input: 4, cacheRead: 0.8, output: 16 }] });
	const key = `${MODEL_SEP}deepseek-v4-pro`;
	const record = {
		byDay: { "2026-08-14": { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 } },
		modelsByDay: { "2026-08-14": { [key]: { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 } } },
		turnsByDay: {}, toolCallsByDay: {}, hoursByDay: {},
	};
	const cal = viewSlice(record, ["2026-08-14"], pricing);
	assert.ok(Math.abs(cal.models[0].cost - 4) < 1e-6, `fallback cost ${cal.models[0].cost} != 4`);
});

/* ---- P0/P2/P3 locks: display ladder, money labels, trend shapes ---- */

test("monthLabelOfWeek: a label marks the week CONTAINING the 1st (June-2026 Monday regression)", () => {
	// 2026-06-01 is a MONDAY — the old month-change test (monthOf(Mon) !==
	// monthOf(Sun)) failed for the whole month and its "06" vanished.
	assert.equal(monthLabelOfWeek("2026-06-01"), "06", "1st-on-Monday weeks must carry the label");
	assert.equal(monthLabelOfWeek("2026-06-08"), null, "fully-inside weeks carry nothing");
	assert.equal(monthLabelOfWeek("2026-04-27"), "05", "May 1 falls inside Apr27–May3");
	assert.equal(monthLabelOfWeek("2026-05-04"), null);
	assert.equal(monthLabelOfWeek("2026-09-28"), "10", "Oct 1 sits inside Sep28–Oct4");
});

test("money: ¥ never omitted, ≈ rides the estimate flag, zero reads ¥—", () => {
	assert.equal(money(3.94, false), "¥3.94");
	assert.equal(money(24.4, true), "≈¥24.40");
	assert.equal(money(0, false), "¥—");
	assert.equal(money(-2, true), "¥—");
	assert.equal(money(0.0389, false), "¥0.0389");
});

test("wrapDisplay: display-width lines, no line opens with closing punctuation", () => {
	const text = "≈部分金额为估算：计费生效日前的用量按已发布价目计（历史价格留存）";
	const lines = wrapDisplay(text, 20);
	assert.ok(lines.length > 1, "long note must wrap");
	for (const line of lines) {
		assert.ok(displayWidth(line) <= 22, `line overflowed: ${line} (${displayWidth(line)})`);
		assert.ok(!CANNOT_START_TEST.has(line[0]), `line starts with a closer: ${line}`);
	}
	assert.equal(lines.join(""), text, "wrapping must not lose characters");
	assert.deepEqual(wrapDisplay("abcdefgh", 3), ["abc", "def", "gh"]);
	assert.deepEqual(wrapDisplay("短", 10), ["短"]);
});

const CANNOT_START_TEST = new Set([..."）」』！？。，、：；…%》"]);

test("modelLayout: the row ladder never exceeds the column budget", () => {
	assert.equal(modelLayout(65).bar, 12, "full budget keeps the full bar");
	assert.equal(modelLayout(59).bar, 8, "58-col right column shrinks the bar");
	assert.equal(modelLayout(26).bar, 0, "24-col inner drops the bar entirely");
	assert.equal(modelLayout(26).cost, false, "and drops the money column");
	for (const w of [120, 90, 61, 50, 40, 26]) {
		const step = modelLayout(w);
		const inner = Math.max(20, w - 2);
		assert.ok(
			step.name + (step.bar > 0 ? step.bar + 1 : 0) + (step.pct ? 4 : 0) + step.tokPad + 1 + 3 + (step.cost ? 10 : 0) <= inner,
			`layout for ${w} cols must fit its inner budget`);
	}
});

test("compactTokensTight drops decimals, sparkTrend log-scales heavy tails", () => {
	assert.equal(compactTokensTight(180.6e6), "181M");
	assert.equal(compactTokensTight(830_400), "830k");
	const spark = sparkTrend([0, 1_000_000, 1_000]);
	assert.equal(spark[0], "▁", "zero stays baseline");
	assert.equal(spark[1], "█", "peak saturates");
	assert.ok(spark[2] > "▁" && spark[2] < "█", `mid value must sit between (${spark[2]})`);
	assert.equal(sparkTrend([0, 0, 0]), "▁▁▁");
});

test("weeklyBars: sqrt heights, peak index, aligned label line", () => {
	const bars = weeklyBars([1, 4, 0], ["01", "08", "15"], 3);
	assert.deepEqual(bars.heights, [2, 3, 0]);
	assert.equal(bars.peakIdx, 1);
	assert.equal(bars.peakVal, 4);
	assert.equal(bars.lines.length, 3);
	assert.equal(bars.labelLine, "01 08 15");
});

test("peakHoursFor: weekday windows only, weekends flatten unless weekdaysOnly:false", () => {
	const rule = { model: "m", input: 1, peak: { input: 2 }, peakHours: [9, 10, 11, 14, 15, 16, 17], weekdaysOnly: true };
	const weekday = peakHoursFor([rule], "2026-08-20"); // Thursday
	assert.equal(weekday.size, 7);
	assert.ok(weekday.has(14) && !weekday.has(12));
	assert.equal(peakHoursFor([rule], "2026-08-22"), null, "Saturday: weekday-only rule → no band");
	const always = peakHoursFor([{ ...rule, weekdaysOnly: false }], "2026-08-22");
	assert.equal(always.size, 7, "weekdaysOnly:false bills peak every day");
	assert.equal(peakHoursFor([{ model: "m", input: 1 }], "2026-08-20"), null, "flat rule → no band");
});

test("ganttRows: hour totals, peak hour, band and span share the same pitch", () => {
	const sessions = [
		{ id: "a", title: "第一个会话标题很长会被截断的例子", record: { hoursByDay: { "2026-08-20": { "14": { m: { input: 100, output: 0, cacheRead: 0, cacheWrite: 0 } } } } } },
		{ id: "b", title: "短", record: { hoursByDay: { "2026-08-20": { "17": { m: { input: 50, output: 0, cacheRead: 0, cacheWrite: 0 } } } } } },
	];
	const peakSet = peakHoursFor([{ model: "m", input: 1, peak: { input: 2 }, peakHours: [14, 15, 16, 17], weekdaysOnly: true }], "2026-08-20");
	const g = ganttRows(sessions, "2026-08-20", 80, peakSet);
	assert.equal(g.hours[14], 100);
	assert.equal(g.hours[17], 50);
	assert.equal(g.peakHour, 14);
	assert.equal(g.rows[0].span.length, g.band.length, "session spans and the band share one pitch");
	assert.equal(g.band.length % 24, 0, "pitch must divide evenly into 24 hours");
	assert.ok(g.rows[0].span.slice(14 * 2, 14 * 2 + 2) === "██", "session a must light hour 14");
	assert.ok(g.band.slice(17 * 2, 17 * 2 + 2) === "▓▓", "hour 17 sits in the peak band");
});

test("ganttRows: the total row rides the span pitch, label column scales with width", () => {
	const sessions = [{ id: "a", title: "短", record: { hoursByDay: { "2026-08-20": { "9": { m: { input: 10, output: 0, cacheRead: 0, cacheWrite: 0 } } } } } }];
	const narrow = ganttRows(sessions, "2026-08-20", 80, null);
	assert.equal(narrow.spanW, 48, "80 cols keeps 2 cells per hour");
	assert.equal(narrow.total.length, narrow.spanW, "total sparkline shares the span pitch (was half-width)");
	assert.equal(narrow.labelW, 12, "80-col budget keeps the 12-col label column");
	assert.equal(displayWidth(narrow.rows[0].label), 12, "labels stay padded to the label column");
	assert.ok(narrow.total.slice(9 * 2, 9 * 2 + 2) > "▁", "hour 9 rises on the total row, aligned under its column");

	const wide = ganttRows(sessions, "2026-08-20", 148, null);
	assert.equal(wide.spanW, 96, "148 cols buys 4 cells per hour");
	assert.equal(wide.labelW, 20, "wide budgets widen the label column");
	assert.equal(wide.total.length, wide.spanW, "wide total stays on the span pitch");
	const truncated = ganttRows([{ id: "a", title: "一个特别特别特别特别长的会话标题远远超过标签列宽", record: { hoursByDay: {} } }], "2026-08-20", 148, null);
	assert.ok(truncated.rows[0].label.trim().endsWith("…"), "wide-budget truncation leaves an ellipsis");
	assert.equal(displayWidth(truncated.rows[0].label), 20);
});

test("displayWidth: East-Asian-wide counts 2, symbols count 1 (ink/terminal convention)", () => {
	assert.equal(displayWidth("中"), 2);
	assert.equal(displayWidth("あ"), 2);
	assert.equal(displayWidth("한"), 2);
	assert.equal(displayWidth("Ａ"), 2, "fullwidth latin counts 2");
	assert.equal(displayWidth("ab"), 2);
	assert.equal(displayWidth("▸"), 1, "ambiguous triangle counts 1 — it renders 1 (the old >0xff→2 staircase-d the current row)");
	assert.equal(displayWidth("█"), 1);
	assert.equal(displayWidth("▁"), 1);
	assert.equal(displayWidth("▶"), 2, "U+25B6 is East-Asian Wide");
	assert.equal(displayWidth("●"), 1);
	assert.equal(displayWidth("…"), 1);
	assert.equal(displayWidth("≈"), 1);
	assert.equal(displayWidth("¥"), 1);
	assert.equal(displayWidth("⚠"), 1);
	assert.equal(fitDisplay("当前会话", 12), "当前会话    ");
	assert.equal(displayWidth(truncateDisplay("一个特别长的会话标题", 10)), 10);
	assert.ok(truncateDisplay("一个特别长的会话标题", 10).includes("…"));
	assert.equal(truncateDisplay("短", 10), "短        ", "no ellipsis when it fits");
});

test("hexMix: parses ink rgb() strings (0.13 palette format) as well as hex", () => {
	assert.equal(hexMix("#000000", "#7DA1DE", 0.5), "#3f516f", "sanity: hex path");
	assert.equal(hexMix("rgb(0,0,0)", "rgb(125,161,222)", 0), "#000000");
	assert.equal(hexMix("rgb(0,0,0)", "rgb(125,161,222)", 1), "#7da1de");
	assert.equal(hexMix("rgb(0,0,0)", "rgb(125,161,222)", 0.5), "#3f516f", "rgb() path agrees with hex path");
	assert.equal(hexMix("nonsense", "#7DA1DE", 0.3), "#7DA1DE", "unparseable falls to the right operand");
});

test("yearTiles: lattice keeps the grid visible, top heat stays under today's accent", () => {
	const dark = yearTiles("#000000", "#7DA1DE");
	assert.equal(dark.length, 5);
	for (const c of dark) assert.match(c, /^#[0-9a-f]{6}$/, `tile must be a hex color: ${c}`);
	assert.equal(new Set(dark).size, 5, "five distinct steps");
	assert.notEqual(dark[0], "#000000", "the empty lattice must be visible, not transparent");
	assert.notEqual(dark[4], "#7da1de", "top heat sits just under today's solid accent tile");
	const light = yearTiles("#ffffff", "#3F6CC4");
	assert.ok(parseInt(light[0].slice(1, 3), 16) > 200, "light-theme lattice anchors near white");
});

test("cursorStep: year heatmap arrows are the month grid's transpose", () => {
	const K = (over = {}) => ({ leftArrow: false, rightArrow: false, upArrow: false, downArrow: false, shift: false, ...over });
	// day: ±1 day, shift fast-path ±7
	assert.equal(cursorStep("day", K({ upArrow: true })), -1);
	assert.equal(cursorStep("day", K({ downArrow: true })), 1);
	assert.equal(cursorStep("day", K({ leftArrow: true })), -1);
	assert.equal(cursorStep("day", K({ upArrow: true, shift: true })), -7);
	// month: rows=weeks, cols=weekdays → ←→ ±1 day, ↑↓ ±1 week
	assert.equal(cursorStep("month", K({ leftArrow: true })), -1);
	assert.equal(cursorStep("month", K({ rightArrow: true })), 1);
	assert.equal(cursorStep("month", K({ upArrow: true })), -7);
	assert.equal(cursorStep("month", K({ downArrow: true })), 7);
	// year: rows=weekdays, cols=weeks → ←→ ±1 week, ↑↓ ±1 day
	assert.equal(cursorStep("year", K({ leftArrow: true })), -7, "left moves one column (week) left");
	assert.equal(cursorStep("year", K({ rightArrow: true })), 7);
	assert.equal(cursorStep("year", K({ upArrow: true })), -1, "up moves one row (weekday) up");
	assert.equal(cursorStep("year", K({ downArrow: true })), 1);
	assert.equal(cursorStep("year", K({ upArrow: true, shift: true })), -7, "shift stays the ±7 fast path");
	assert.equal(cursorStep("year", null), 0);
});

test("resolveTheme: 0.13 hands a NAME — objects pass through, names resolve, unknowns degrade", () => {
	const palette = { accent: "rgb(125,161,222)", text: "rgb(232,230,224)" };
	assert.equal(resolveTheme({}, "dark"), resolveTheme(undefined, "dark"), "string names fall back to the built-in mist values");
	assert.equal(resolveTheme({ getTheme: () => palette }, "dark"), palette, "a ui.getTheme probe wins when the host exports one");
	assert.equal(resolveTheme(null, palette), palette, "0.1.x object shape passes through untouched");
	const light = resolveTheme({}, "light");
	const dark = resolveTheme({}, "dark");
	assert.notEqual(light.accent, dark.accent, "light/dark fallbacks differ");
	assert.ok(dark.accent && dark.text, "fallbacks carry accent and text");
});

test("miniCardModel: today splits ● current vs ○ others, month slice reports unpriced share", () => {
	const pricing = makePricing({ rules: [{ model: "deepseek-v4-pro", input: 4, cacheRead: 0.8, output: 16 }] });
	const pro = `${MODEL_SEP}deepseek-v4-pro`;
	const ghost = `ghost${MODEL_SEP}mystery`;
	const day = (input) => ({ input, output: 0, cacheRead: 0, cacheWrite: 0 });
	const s1 = {
		id: "session-abc", title: "当前会话", recency: 1,
		record: {
			byDay: { "2026-08-19": day(2_000_000), "2026-08-20": day(1_000_000) },
			modelsByDay: { "2026-08-19": dayRow(pro, 2_000_000), "2026-08-20": dayRow(pro, 1_000_000) },
			turnsByDay: {}, toolCallsByDay: {}, hoursByDay: {},
		},
	};
	const s2 = {
		id: "session-def", title: "其他会话", recency: 2,
		record: {
			byDay: { "2026-08-20": day(500_000) },
			modelsByDay: { "2026-08-20": dayRow(ghost, 500_000) },
			turnsByDay: {}, toolCallsByDay: {}, hoursByDay: {},
		},
	};
	const record = { byDay: {}, modelsByDay: {}, hoursByDay: {}, tiersByDay: {}, turnsByDay: {}, toolCallsByDay: {}, firstDay: null };
	mergeRecord(record, s1.record);
	mergeRecord(record, s2.record);
	const mini = miniCardModel({ sessions: [s1, s2], record }, pricing, "2026-08-20", "session-abc");
	assert.equal(mini.today.all.count, 2);
	assert.equal(mini.today.all.tok, 1_500_000);
	assert.equal(mini.today.current.tok, 1_000_000);
	assert.equal(mini.today.others.count, 1);
	assert.equal(mini.today.others.tok, 500_000);
	assert.ok(Math.abs(mini.today.all.cost - 4) < 1e-6, "1M priced + 0.5M unpriced → ¥4 (today slice only)");
	assert.ok(Math.abs(mini.today.current.cost - 4) < 1e-6);
	assert.equal(mini.today.others.cost, 0, "unpriced session contributes ¥0 with the ⚠ line carrying the truth");
	assert.equal(mini.month.tok, 3_500_000, "month slice includes yesterday");
	assert.equal(mini.month.peakDay, "2026-08-19", "2M yesterday out-peaks 1.5M today");
	assert.ok(mini.month.unpricedPct > 0 && mini.month.unpricedPct < 1);
	assert.equal(mini.month.unpricedCount, 1);
});

test("eqId tolerates id drift; pricingLabelOf names all four states", () => {
	assert.ok(eqId("session-abc", "session-abc"));
	assert.ok(eqId("session-abc", "abc"));
	assert.ok(!eqId("session-abc", "xyz"));
	assert.ok(!eqId("", "abc"));
	const rules = { rules: [{ model: "deepseek-v4-pro", input: 4, cacheRead: 0.8, output: 16 }] };
	const row = { key: `${MODEL_SEP}deepseek-v4-pro`, input: 1, output: 0, cacheRead: 0, cacheWrite: 0 };
	assert.equal(pricingLabelOf(row, "2026-08-20", makePricing(rules)), "按量");
	assert.equal(pricingLabelOf(row, "2026-08-20", makePricing({ ...rules, monthly: [""] })), "包月");
	assert.equal(pricingLabelOf(row, "2026-08-01", makePricing({ estimateModels: ["deepseek-v4-pro"] })), "估算");
	assert.equal(pricingLabelOf({ ...row, key: `ghost${MODEL_SEP}x` }, "2026-08-20", makePricing({})), "未定价");
});

// aux counters merge tier-split into the corpus record, so the day view can
// show 「搜索 ×N」 without re-reading session logs
test("mergeRecord folds auxByDay (counts + title estimates) into the merged corpus", () => {
	const target = { byDay: {}, modelsByDay: {}, hoursByDay: {}, tiersByDay: {}, turnsByDay: {}, toolCallsByDay: {}, auxByDay: {}, firstDay: null };
	mergeRecord(target, {
		auxByDay: {
			"2026-09-28": {
				search: { peak: 2, offpeak: 1 },
				title: { peak: 1, offpeak: 0 },
				titleIn: { peak: 500, offpeak: 0 },
				titleOut: { peak: 32, offpeak: 0 },
				titleKey: "deepseek-v4-pro",
			},
		},
	});
	mergeRecord(target, {
		auxByDay: { "2026-09-28": { search: { peak: 1, offpeak: 0 } } },
	});
	assert.deepEqual(target.auxByDay["2026-09-28"].search, { peak: 3, offpeak: 1 });
	assert.deepEqual(target.auxByDay["2026-09-28"].title, { peak: 1, offpeak: 0 });
	assert.equal(target.auxByDay["2026-09-28"].titleIn.peak, 500);
	assert.equal(target.auxByDay["2026-09-28"].titleKey, "deepseek-v4-pro");
});

/* ---- dsh 0.2.0 adaptation locks: data-layer shapes + C-070 fallback ---- */

const localDayOf = (ts) => {
	const d = new Date(ts);
	const p = (n) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const DAY_TS = new Date("2026-08-20T14:00:00").getTime();
const messageEvent = (ts, input) => ({
	type: "assistant/message",
	time: ts,
	data: {
		usage: { inputTokens: input, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
		message: { source: { provider: "deepseek", model: "deepseek-v4-pro" } },
	},
});
const titleEvent = (title) => ({ type: "session/title", data: { title } });

/** 0.2.0-stubbed ctx: headers carry only {version, id, createdAt, cwd} and
 *  listSessions records expose {header, live, persisted}. */
function stubCollectCtx({ listed, read }) {
	const reads = [];
	const ctx = {
		get(name) {
			if (name === "sessionQuery") {
				return {
					listSessions: async () => listed,
					readSession: async (id) => { reads.push(id); return read(id); },
				};
			}
			return undefined; // sessions / settings / sessionProjectionCache absent
		},
	};
	return { ctx, reads };
}

test("collect on 0.2.0 shapes: {session} key, createdAt-only header, title from the fold", async () => {
	const createdAt = DAY_TS - 86_400_000;
	const day = localDayOf(DAY_TS);
	const header = { version: 1, id: "sess-020-a", createdAt, cwd: "D:/proj" };
	const { ctx, reads } = stubCollectCtx({
		listed: [{ header: structuredClone(header), live: false, persisted: true }],
		read: () => ({
			session: structuredClone(header),
			inheritedEventCount: 0,
			events: [messageEvent(DAY_TS, 1_000_000), titleEvent("事件起的标题")],
		}),
	});
	const result = await collect(ctx, {});
	assert.equal(result.empty, false);
	assert.equal(reads.length, 1);
	assert.ok(result.record.byDay[day], "0.2.0 readSession {session} key must still fold into the day window");
	assert.equal(result.record.byDay[day].input, 1_000_000);
	assert.equal(result.sessions[0].title, "事件起的标题",
		"0.2.0 headers carry no title — the fold's session/title capture must supply it");
	assert.equal(foldCache.get("sess-020-a").version, createdAt, "closed 0.2.0 sessions stamp on createdAt");
});

test("pulseStripToggle: show / repeat / refusal / teardown, no leaked poll", () => {
	_resetStripForTests();
	const disposed = [];
	const mkCtx = (register) => ({
		get: (name) => (name === "tuiStatus" ? { registerView: register } : undefined),
		logger: { warn() {} },
	});
	// 1. first show registers under the host row cap and starts the poll
	let registered = null;
	stripStore.ctx = mkCtx((view) => { registered = view; return () => disposed.push("A"); });
	assert.equal(pulseStripToggle(true), true);
	assert.equal(registered.key, "pulse");
	assert.equal(registered.maxRows, 3);
	assert.ok(stripStore.timer, "the 30s poll runs only after a successful registration");
	// 2. same-direction repeat is a no-op
	assert.equal(pulseStripToggle(true), false);
	// 3. refusal downgrades and leaves NO timer residue (the old order
	//    started the poll before registerView and leaked it on refusal)
	stripStore.ctx = mkCtx(() => "not-a-function");
	assert.equal(pulseStripToggle(false), true, "teardown of the shown card");
	assert.equal(stripStore.timer, null);
	assert.equal(pulseStripToggle(true), false, "refused");
	assert.equal(stripStore.timer, null);
	// 4. teardown disposes and clears the poll; no-arg means toggle
	stripStore.ctx = mkCtx(() => () => disposed.push("B"));
	assert.equal(pulseStripToggle(true), true);
	assert.equal(pulseStripToggle(), true);
	assert.deepEqual(disposed, ["A", "B"]);
	assert.equal(stripStore.timer, null);
	// seam: the scene's live-session stash feeds the ●当前 marker
	noteCurrentSession("sess-42");
	_resetStripForTests();
});

test("fmtTokens: one abbreviation for both faces, B tier included", () => {
	assert.equal(fmtTokens(1.5e9), "1.5B");
	assert.equal(fmtTokens(830_400), "830.4k");
	assert.equal(fmtTokens(0), "0");
	// the tight variant keeps its M-capped compact face for squeezed rows
	assert.equal(compactTokensTight(1.5e9), "1500M");
});

test("layoutBudget: the year grid takes what it needs, the inspector keeps the rest", () => {
	const cal = { unpriced: [], windowCost: { estimated: false }, peak: 0, offpeak: 0 };
	// 200 columns: two-column layout with the whole 53-week year resident.
	const wide = layoutBudget({ contentW: 200, termRows: 50, cal, month: "2026-10", monthMode: false });
	assert.equal(wide.twoCol, true);
	assert.equal(wide.fitWeeks, 53);
	assert.ok(wide.modelN >= 2);
	// 80 columns single-column: healthy rows, no extras dropped.
	const mid = layoutBudget({ contentW: 80, termRows: 40, cal, month: "2026-10", monthMode: false });
	assert.equal(mid.twoCol, false);
	assert.equal(mid.fitWeeks, 53);
	assert.equal(mid.dropTrend, false);
	// 48 columns: the window slices to the gutter + weeks (paging fallback),
	// and a starved terminal drops trend/tier before the model rows vanish.
	const narrow = layoutBudget({ contentW: 48, termRows: 30, cal, month: "2026-10", monthMode: false });
	assert.equal(narrow.twoCol, false);
	assert.equal(narrow.fitWeeks, 45);
	assert.equal(narrow.dropTrend, true);
	// month mode: fixed 44-col grid; fitWeeks is meaningless (0); offset/total
	// come from the month and weekCount is their honest ceil-divided pair.
	const month = layoutBudget({ contentW: 200, termRows: 50, cal, month: "2026-10", monthMode: true });
	assert.equal(month.leftW, 44);
	assert.equal(month.fitWeeks, 0);
	assert.equal(month.total, 31);
	assert.ok(month.offset >= 0 && month.offset <= 6);
	assert.equal(month.weekCount, Math.ceil((month.offset + 31) / 7));
});

test("foldCache freshness: live seq growth refolds, closed sessions stay cached", async () => {
	const day = localDayOf(DAY_TS);
	const createdAt = DAY_TS - 60_000;
	const mkHeader = (id) => ({ version: 1, id, createdAt, cwd: "D:/proj" });
	let seq = 4;
	const store = new Map([["sess-live", { get seq() { return seq; } }]]);
	const eventsFor = (id) => id === "sess-live"
		? (seq >= 9 ? [messageEvent(DAY_TS, 1_000_000), messageEvent(DAY_TS, 500_000)] : [messageEvent(DAY_TS, 1_000_000)])
		: []; // the closed session carries no usage — it isolates the live assertion
	const listed = [
		{ header: mkHeader("sess-live"), live: true, persisted: true },
		{ header: mkHeader("sess-closed"), live: false, persisted: true },
	];
	const reads = [];
	const ctx = {
		get(name) {
			if (name === "sessionQuery") return {
				listSessions: async () => listed,
				readSession: async (id) => {
					reads.push(id);
					return { session: structuredClone(mkHeader(id)), inheritedEventCount: 0, events: eventsFor(id) };
				},
			};
			if (name === "sessions") return { get: (id) => store.get(id) };
			return undefined;
		},
	};
	const first = await collect(ctx, {});
	assert.equal(first.record.byDay[day].input, 1_000_000);
	assert.equal(foldCache.get("sess-live").version, seq, "live sessions stamp on the in-memory log length");
	seq = 9;
	const second = await collect(ctx, {});
	assert.equal(second.record.byDay[day].input, 1_500_000, "seq growth must invalidate the fold and pick up new usage");
	assert.equal(reads.filter((id) => id === "sess-closed").length, 1,
		"closed sessions keep their stable createdAt stamp and stay cached");
});

/** apply()-level stub: the mediated host admission always throws (what a
 *  manifest-less plugin hits on dsh-tui 0.13.0); commands.register records. */
function stubApplyCtx() {
	const registered = [];
	const warns = [];
	return {
		registered, warns,
		ctx: {
			get(name) {
				if (name === "tuiScenes") return { register: () => () => {}, open: () => true };
				if (name === "tuiPluginHost") return { registerCommand: () => { throw new Error("COMPONENT_NOT_ADMITTED: no manifest identity"); } };
				if (name === "commands") return { register: (def) => { registered.push(def.name); } };
				return undefined; // tuiStatus / tuiShortcuts — degrade paths
			},
			effect(fn) { fn(); },
			logger: { warn: (m) => warns.push(String(m)) },
		},
	};
}

test("apply falls back to direct commands.register when mediated admission throws (C-070)", async () => {
	const { ctx, registered, warns } = stubApplyCtx();
	await apply(ctx, {});
	assert.deepEqual(registered, ["pulse", "pulse-day", "pulse-month", "pulse-year", "pulse-cost", "pulse-sessions"],
		"all six commands must land via the documented C-070 direct boundary");
	assert.equal(warns.filter((w) => w.includes("C-070")).length, 1, "the mediated fallback warns once per apply, not once per command");
	assert.equal(warns.length, 1, "no per-command failure spam on the fallback path");
});

let failed = 0;
for (const [name, fn] of tests) {
	try {
		await fn();
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
console.log(`\nall ${tests.length} tui suites passed`);
