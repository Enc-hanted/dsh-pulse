import { strict as assert } from "node:assert";
import {
  buildPayload, clampDays, dayStart, foldEvents, localDay, MAX_WINDOW_DAYS,
  projectOf, resolveWindow, sliceRecord, validDay,
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
const emptyState = { byDay: {}, modelsByDay: {}, hoursByDay: {}, turnsByDay: {}, toolCallsByDay: {}, firstDay: null };
assert.deepEqual(foldEvents(null), emptyState);
assert.deepEqual(foldEvents([{}, null, 42]), emptyState);

// --- sliceRecord ------------------------------------------------------------
const base = {
  id: "s1", createdAt: noon(-1), createdDay: localDay(noon(-1)), project: "demo", subagent: false,
  firstDay: localDay(noon(-3)),
  byDay: { [localDay(noon(-3))]: { input: 5, output: 1, cacheRead: 0, cacheWrite: 0 } },
  modelsByDay: { [localDay(noon(-3))]: { m: { input: 5, output: 1, cacheRead: 0, cacheWrite: 0 } } },
  turnsByDay: { [localDay(noon(-3))]: 1 },
  toolCallsByDay: {},
};
const sliced = sliceRecord(base, daysAgo(7), today());
assert.equal(sliced.day, localDay(noon(-3)), "first in-window activity anchors the record");
assert.equal(sliced.byDay[localDay(noon(-3))].input, 5);
assert.equal(sliced.turnsByDay[localDay(noon(-3))], 1);
assert.deepEqual(sliced.hoursByDay, {}, "hour maps pass through sliced, empty when absent");

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
assert.deepEqual(payload.pricing, pricing);
assert.equal(payload.sessions.length, 2, "null / day-less records dropped");
assert.ok(payload.sessions.every((s) => s.day >= payload.fromDay && s.day <= payload.toDay));
assert.equal(buildPayload({ records: [], topProjects: 0 }).topProjects, 8, "invalid cap falls back");

console.log("aggregate-test: all assertions passed");
