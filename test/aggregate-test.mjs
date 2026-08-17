import { strict as assert } from "node:assert";
import {
  balanceSpendSeries, BEIJING_OFFSET_MS, buildPayload, clampDays, dayStart, foldEvents, localDay,
  MAX_WINDOW_DAYS, normalizePeakHours, PEAK_HOURS, projectOf, pulseProjectionDefinition,
  resolveWindow, sliceRecord, tierAt, validDay,
} from "../src/aggregate.js";

const DAY = 86400000;
const noon = (offsetDays) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d.getTime() + offsetDays * DAY;
};
const midnightToday = () => dayStart(localDay(Date.now()));
const today = () => localDay(Date.now());
const daysAgo = (n) => localDay(midnightToday() - (n - 1) * DAY);

// --- pure helpers -----------------------------------------------------------
assert.equal(localDay(noon(0)), today());
assert.equal(projectOf("D:\\DSH\\demo"), "demo");
assert.equal(projectOf("/home/x/repo"), "repo");
assert.equal(projectOf("D:\\DSH\\demo", 2), "DSH/demo", "projectDepth 2 keeps two segments");
assert.equal(projectOf("/home/x/repo", 3), "home/x/repo");
assert.equal(projectOf("D:\\DSH\\demo", 99), "D:/DSH/demo", "depth clamps to 3 segments at most");
assert.equal(projectOf("/repo", 99), "repo", "shorter paths keep what exists");
assert.equal(projectOf(null), null);
assert.equal(projectOf(""), null);
assert.equal(clampDays(undefined), 30);
assert.equal(clampDays(0), 1);
assert.equal(clampDays(99999), MAX_WINDOW_DAYS);
assert.equal(clampDays("90"), 90);
assert.equal(validDay(today()), true);
assert.equal(validDay("2026-02-30"), false, "impossible calendar date");
assert.equal(validDay("2026-13-01"), false);
assert.equal(validDay("nonsense"), false);

// --- resolveWindow ----------------------------------------------------------
const w1 = resolveWindow({ from: daysAgo(10), to: today() });
assert.equal(w1.fromDay, daysAgo(10));
assert.equal(w1.toDay, today());
const w2 = resolveWindow({ from: today(), to: daysAgo(10) }, 30);
assert.equal(w2.fromDay, daysAgo(10), "reversed pair swapped");
const w3 = resolveWindow({}, 30);
assert.equal(w3.fromDay, daysAgo(30));
assert.equal(w3.toDay, today());
const w4 = resolveWindow({ days: "abc" }, 30);
assert.equal(w4.fromDay, daysAgo(30), "invalid days falls back to default");
const w5 = resolveWindow({ from: "2020-01-01", to: today() }, 30);
assert.equal(w5.toDay, today());
assert.equal(localDay(dayStart(w5.fromDay) + (MAX_WINDOW_DAYS - 1) * DAY), today(), "over-long span trimmed to the cap");
assert.equal(resolveWindow({ from: "garbage", to: today() }, 30).fromDay, daysAgo(30), "invalid bound falls back");

// --- pricing tiers: Beijing-time peak/off-peak classification ----------------
// Default hours are the official windows: 09:00–12:00 and 14:00–18:00
// Beijing time, as an hour set (hour granularity, membership test).
// Date.UTC stamps keep the assertions independent of the host timezone.
assert.equal(BEIJING_OFFSET_MS, 8 * 3600000);
assert.deepEqual(PEAK_HOURS, [9, 10, 11, 14, 15, 16, 17]);
assert.deepEqual(normalizePeakHours([14, 9, 10, 11, 15, 9, 16, 17]), PEAK_HOURS, "normalize sorts and dedupes");
assert.deepEqual(normalizePeakHours(undefined), PEAK_HOURS, "no hours → official default");
assert.deepEqual(normalizePeakHours([]), [], "an explicit empty set is meaningful: flat pricing");
assert.deepEqual(normalizePeakHours([9, 9.5, 99, -1]), [9], "invalid hours drop out");
assert.deepEqual(normalizePeakHours(["x", null]), PEAK_HOURS, "all-invalid non-empty input falls back to official");
const bj = (hh) => Date.UTC(2026, 7, 14, hh - 8, 0, 0); // hh (Beijing) → UTC
assert.equal(tierAt(bj(8)), "offpeak", "08:59 Beijing is off-peak");
assert.equal(tierAt(bj(9)), "peak", "09:00 Beijing enters the peak window");
assert.equal(tierAt(bj(11)), "peak", "11:59 Beijing is peak");
assert.equal(tierAt(bj(12)), "offpeak", "12:00–14:00 lunch break is off-peak");
assert.equal(tierAt(bj(13)), "offpeak");
assert.equal(tierAt(bj(14)), "peak", "14:00 Beijing re-enters the peak window");
assert.equal(tierAt(bj(17)), "peak", "17:59 Beijing is peak");
assert.equal(tierAt(bj(18)), "offpeak", "18:00 Beijing exits the peak window");
assert.equal(tierAt(bj(0)), "offpeak", "midnight is off-peak");
// custom hour sets override per call (midnight-wrapping sets included)
assert.equal(tierAt(bj(9), [23, 0, 1, 2]), "offpeak", "custom set: official peak hour becomes off-peak");
assert.equal(tierAt(bj(0), [23, 0, 1, 2]), "peak", "custom set: midnight can be peak");
assert.equal(tierAt(bj(12), [12]), "peak", "single-hour custom set");

// --- projection fold: usage, model attribution, turns, malformed tolerance ---
const t1 = noon(-1);
const events = [
  { type: "turn/start", time: t1, data: { turn: 1 } }, // not counted (no closed step)
  { type: "step/end", time: t1, data: { turn: 1, step: 1 } },
  { type: "tool/call", time: t1, data: { callId: "c1", name: "bash", arguments: "{}" } },
  {
    type: "assistant/message", time: t1, data: {
      turn: 1, step: 1,
      message: { content: [], source: { provider: "deepseek-official", model: "deepseek-v4-flash" } },
      usage: { inputTokens: 1000, outputTokens: 500, cacheReadTokens: 3000, cacheWriteTokens: 200 },
    },
  },
  { type: "assistant/message", time: t1, data: { turn: 1, step: 1, message: { content: [] } } }, // no usage
  { type: "assistant/message", time: t1, data: null }, // malformed data
  { type: "mystery/event", time: t1, data: { whatever: 1 } }, // unknown type
  { type: "step/end", time: noon(-1), data: { turn: 1, step: 2 } }, // same turn → not counted again
];
const folded = foldEvents(events);
const day = localDay(t1);
assert.equal(folded.turnsByDay[day], 1, "one distinct turn with a closed step");
assert.equal(folded.toolCallsByDay[day], 1);
assert.deepEqual(folded.byDay[day], { input: 1000, output: 500, cacheRead: 3000, cacheWrite: 200 });
assert.equal(folded.modelsByDay[day]["deepseek-v4-flash"].cacheRead, 3000);
assert.equal(folded.firstDay, day);
// tier split mirrors the event's Beijing-time tier
const t1Split = {
  input: { peak: 0, offpeak: 0 }, output: { peak: 0, offpeak: 0 },
  cacheRead: { peak: 0, offpeak: 0 }, cacheWrite: { peak: 0, offpeak: 0 },
};
t1Split.input[tierAt(t1)] = 1000;
t1Split.output[tierAt(t1)] = 500;
t1Split.cacheRead[tierAt(t1)] = 3000;
t1Split.cacheWrite[tierAt(t1)] = 200;
assert.deepEqual(folded.tiersByDay[day]["deepseek-v4-flash"], t1Split, "usage lands in the correct Beijing-time tier");
// a guaranteed peak-hour event (10:00 Beijing) folds into the peak side
const peakFolded = foldEvents([{
  type: "assistant/message", time: bj(10),
  data: { turn: 3, step: 1, message: { source: { model: "m2" } }, usage: { inputTokens: 42, outputTokens: 7, cacheReadTokens: 1, cacheWriteTokens: 0 } },
}]);
assert.deepEqual(peakFolded.tiersByDay[localDay(bj(10))].m2, {
  input: { peak: 42, offpeak: 0 }, output: { peak: 7, offpeak: 0 },
  cacheRead: { peak: 1, offpeak: 0 }, cacheWrite: { peak: 0, offpeak: 0 },
}, "peak-hour event folds into the peak side");
// an off-peak-hour event (08:00 Beijing) folds into the off-peak side
const flatFolded = foldEvents([{
  type: "assistant/message", time: bj(8),
  data: { turn: 4, step: 1, message: { source: { model: "m2" } }, usage: { inputTokens: 9 } },
}]);
assert.equal(flatFolded.tiersByDay[localDay(bj(8))].m2.input.peak, 0);
assert.equal(flatFolded.tiersByDay[localDay(bj(8))].m2.input.offpeak, 9);
// per-model peak hours flow through the parameterized fold: m-night bills
// 00:00–03:00 Beijing as peak while m2 stays on the official windows
const customFolded = foldEvents([
  { type: "assistant/message", time: bj(1), data: { turn: 5, step: 1, message: { source: { model: "m-night" } }, usage: { inputTokens: 11 } } },
  { type: "assistant/message", time: bj(1), data: { turn: 6, step: 1, message: { source: { model: "m2" } }, usage: { inputTokens: 22 } } },
], { peakHoursFor: (model) => (model === "m-night" ? [0, 1, 2, 3] : undefined) });
assert.equal(customFolded.tiersByDay[localDay(bj(1))]["m-night"].input.peak, 11, "custom peak hours price the event as peak");
assert.equal(customFolded.tiersByDay[localDay(bj(1))].m2.input.offpeak, 22, "unset models keep the official windows");
// an explicitly empty hour set is flat: even peak-rate models never see a
// peak tier (the "deselect every hour" editor state survives the fold)
const flatHoursFolded = foldEvents([
  { type: "assistant/message", time: bj(10), data: { turn: 7, step: 1, message: { source: { model: "m-flat" } }, usage: { inputTokens: 5 } } },
], { peakHoursFor: (model) => (model === "m-flat" ? [] : undefined) });
assert.equal(flatHoursFolded.tiersByDay[localDay(bj(10))]["m-flat"].input.peak, 0, "empty hour set: 10:00 Beijing is off-peak");
assert.equal(flatHoursFolded.tiersByDay[localDay(bj(10))]["m-flat"].input.offpeak, 5);
// the definition carries its stateVersion (host bumps it on peak-hour changes)
assert.equal(pulseProjectionDefinition().stateVersion, 4);
assert.equal(pulseProjectionDefinition({ stateVersion: 7 }).stateVersion, 7);
// per-hour, per-model detail for the intraday chart
const hour = String(new Date(t1).getHours()).padStart(2, "0");
assert.deepEqual(folded.hoursByDay[day][hour]["deepseek-v4-flash"], { input: 1000, output: 500, cacheRead: 3000, cacheWrite: 200 });

// hour detail prunes beyond the retention window (HOURS_RETENTION_DAYS)
const spanning = foldEvents([
  { type: "assistant/message", time: noon(-3), data: { turn: 1, step: 1, message: { source: { model: "m" } }, usage: { inputTokens: 5 } } },
  { type: "assistant/message", time: noon(0), data: { turn: 2, step: 1, message: { source: { model: "m" } }, usage: { inputTokens: 7 } } },
]);
assert.equal(Object.keys(spanning.hoursByDay).length, 1, "only the recent day keeps hour detail");
assert.equal(Object.keys(spanning.hoursByDay)[0], localDay(noon(0)));

// a rejected turn (turn/start without step/end) contributes nothing
const emptyTurn = foldEvents([{ type: "turn/start", time: noon(-2), data: { turn: 1 } }]);
assert.deepEqual(emptyTurn.turnsByDay, {});

// multiple turns across days
const twoDays = foldEvents([
  { type: "step/end", time: noon(-3), data: { turn: 1, step: 1 } },
  { type: "step/end", time: noon(-1), data: { turn: 2, step: 1 } },
]);
assert.equal(twoDays.turnsByDay[localDay(noon(-3))], 1);
assert.equal(twoDays.turnsByDay[localDay(noon(-1))], 1);

// untimestamped events are not day-attributed
const noTime = foldEvents([
  { type: "assistant/message", time: 0, data: { turn: 1, step: 1, message: { source: { model: "m" } }, usage: { inputTokens: 5 } } },
]);
assert.deepEqual(noTime.byDay, {});

// hopeless input folds to an empty state, never throws
const emptyState = { byDay: {}, modelsByDay: {}, hoursByDay: {}, tiersByDay: {}, turnsByDay: {}, toolCallsByDay: {}, firstDay: null };
assert.deepEqual(foldEvents(null), emptyState);
assert.deepEqual(foldEvents([{}, null, 42]), emptyState);

// --- sliceRecord ------------------------------------------------------------
const base = {
  id: "s1", createdAt: noon(-1), createdDay: localDay(noon(-1)), project: "demo", subagent: false,
  firstDay: localDay(noon(-3)),
  byDay: { [localDay(noon(-3))]: { input: 5, output: 1, cacheRead: 0, cacheWrite: 0 } },
  modelsByDay: { [localDay(noon(-3))]: { m: { input: 5, output: 1, cacheRead: 0, cacheWrite: 0 } } },
  tiersByDay: { [localDay(noon(-3))]: { m: {
    input: { peak: 0, offpeak: 5 }, output: { peak: 0, offpeak: 1 },
    cacheRead: { peak: 0, offpeak: 0 }, cacheWrite: { peak: 0, offpeak: 0 },
  } } },
  turnsByDay: { [localDay(noon(-3))]: 1 },
  toolCallsByDay: {},
};
const sliced = sliceRecord(base, daysAgo(7), today());
assert.equal(sliced.day, localDay(noon(-3)), "first in-window activity anchors the record");
assert.equal(sliced.byDay[localDay(noon(-3))].input, 5);
assert.equal(sliced.turnsByDay[localDay(noon(-3))], 1);
assert.deepEqual(sliced.hoursByDay, {}, "hour maps pass through sliced, empty when absent");
assert.deepEqual(sliced.tiersByDay, base.tiersByDay, "tier splits ride the window slice");

// tier maps ride the window slice too
const slicedNarrow = sliceRecord(base, daysAgo(2), today());
assert.deepEqual(slicedNarrow.tiersByDay, {}, "out-of-window tier splits dropped");

// hour maps ride the window slice
const withHours = sliceRecord({
  ...base,
  hoursByDay: {
    [localDay(noon(-3))]: { "12": { m: { input: 5, output: 0, cacheRead: 0, cacheWrite: 0 } } },
    [localDay(noon(-30))]: { "12": { m: { input: 9, output: 0, cacheRead: 0, cacheWrite: 0 } } },
  },
}, daysAgo(7), today());
assert.deepEqual(Object.keys(withHours.hoursByDay), [localDay(noon(-3))], "out-of-window hour detail dropped");

const outOfWindow = sliceRecord(base, localDay(noon(0)), today());
assert.equal(outOfWindow, null, "nothing in window folds to null");

// created in window without activity keeps the record (zero-usage session)
const blank = sliceRecord({
  id: "s2", createdAt: noon(0), createdDay: localDay(noon(0)), project: null, subagent: true,
  firstDay: null, byDay: {}, modelsByDay: {}, turnsByDay: {}, toolCallsByDay: {},
}, localDay(noon(-1)), today());
assert.notEqual(blank, null);
assert.equal(blank.day, localDay(noon(0)));
assert.equal(blank.subagent, true);
assert.deepEqual(blank.byDay, {});

// --- buildPayload: schema 3, window echo, pricing/topProjects -----------------
const pricing = [{ model: "deepseek-v4-flash", input: 1, cacheRead: 0.02, output: 2, currency: "CNY" }];
const payload = buildPayload({
  records: [sliced, blank, null, { noDay: true }],
  fromDay: daysAgo(7),
  toDay: today(),
  pricing,
  topProjects: 12,
  now: Date.now(),
});
assert.equal(payload.schema, 3);
assert.equal(payload.fromDay, daysAgo(7));
assert.equal(payload.toDay, today());
assert.equal(payload.today, today());
assert.equal(payload.topProjects, 12);
assert.equal(payload.costEnabled, true, "cost enabled by default");
assert.deepEqual(payload.pricing, pricing);
assert.equal(payload.sessions.length, 2, "null / day-less records dropped");
assert.ok(payload.sessions.every((s) => s.day >= payload.fromDay && s.day <= payload.toDay));
assert.equal(buildPayload({ records: [], topProjects: 0 }).topProjects, 8, "invalid cap falls back");
assert.equal(buildPayload({ records: [], costEnabled: false }).costEnabled, false, "explicit flag echoed");
assert.equal(buildPayload({ records: [], costEnabled: "no" }).costEnabled, true, "non-false values count as enabled");
// fx rides the payload for the unified CNY display, defaulting when invalid
assert.deepEqual(payload.fx, { usdToCny: 6.8 }, "default fx echoed");
assert.deepEqual(buildPayload({ records: [], fx: { usdToCny: 7.15 } }).fx, { usdToCny: 7.15 });
assert.deepEqual(buildPayload({ records: [], fx: { usdToCny: -1 } }).fx, { usdToCny: 6.8 }, "invalid rate falls back");
assert.deepEqual(buildPayload({ records: [] }).fx, { usdToCny: 6.8 }, "missing fx falls back");

// --- balanceSpendSeries: reconciliation from rolling balance snapshots --------
{
  const dayOf = (offset) => localDay(noon(offset));
  const snaps = [
    { t: noon(-4) + 3600000, total: 100 }, // the evening before the window
    { t: noon(-3) + 3600000, total: 90 },
    { t: noon(-2) + 3600000, total: 95 },  // a top-up masks this day's spend
    { t: noon(-1) + 3600000, total: 80 },
  ];
  assert.deepEqual(balanceSpendSeries(snaps, dayOf(-3), dayOf(-1)), [
    { key: dayOf(-3), spend: 10 },
    { key: dayOf(-2), spend: null },
    { key: dayOf(-1), spend: 15 },
  ]);
  // no snapshot before the window start: the first observed day is unknown
  assert.deepEqual(balanceSpendSeries(snaps.slice(1), dayOf(-3), dayOf(-1)).map((d) => d.spend), [null, null, 15]);
  // unsorted input tolerated; days past the newest snapshot stay null
  assert.deepEqual(
    balanceSpendSeries([...snaps].reverse(), dayOf(-1), localDay(Date.now())).map((d) => d.spend),
    [15, null],
  );
  // two readings on one day: the day's closing balance is the later one
  const intra = [
    { t: noon(-2), total: 50 },
    { t: noon(-1) - 3600000, total: 40 },
    { t: noon(-1) + 3600000, total: 36 },
  ];
  assert.deepEqual(balanceSpendSeries(intra, dayOf(-1), dayOf(-1)), [{ key: dayOf(-1), spend: 14 }]);
  assert.deepEqual(balanceSpendSeries([], dayOf(-3), dayOf(-1)), []);
  assert.deepEqual(balanceSpendSeries(snaps, "banana", dayOf(-1)), [], "invalid window is empty");
}

console.log("aggregate-test: all assertions passed");
