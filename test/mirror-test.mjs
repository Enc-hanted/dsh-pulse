/**
 * Mirror-sync test: the view-model region inside lib/client.js must be a
 * byte-level reflection of src/view.js (modulo the stripped `export`
 * modifiers). This test extracts the region, evaluates it as a plain script,
 * and compares every exported helper against src/view.js over a fixture
 * battery — so a src/view.js edit that skipped `scripts/sync-mirror.mjs`
 * fails the suite instead of shipping a silently diverging browser bundle.
 */

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as src from "../src/view.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundle = readFileSync(join(root, "lib", "client.js"), "utf8");

const startMark = "//#region view model (mirror of src/view.js — keep both in sync)";
const endMark = "//#endregion";
const start = bundle.indexOf(startMark);
const end = bundle.indexOf(endMark, start);
assert.notEqual(start, -1, "mirror region start marker missing");
assert.notEqual(end, -1, "mirror region end marker missing");

// Byte-level drift check first (markers to markers, whitespace included).
const srcBody = readFileSync(join(root, "src", "view.js"), "utf8")
  .replace(/^export function /gm, "function ")
  .replace(/^export const /gm, "const ")
  .trimEnd()
  .split("\n")
  .map((line) => (line.length > 0 ? `\t\t${line}` : line))
  .join("\n");
const mirrorBody = bundle.slice(start + startMark.length, end)
  .replace(/^\n/, "")
  .replace(/\n\t\t$/, "");
assert.equal(mirrorBody, srcBody, "lib/client.js mirror drifted from src/view.js — run `node scripts/sync-mirror.mjs`");

// Evaluate the mirror as a plain script and collect its exports.
const exported = [];
for (const name of Object.keys(src)) exported.push(name);
const harness = new Function(`${mirrorBody}\nreturn { ${exported.join(", ")} };`);
const mirror = harness();

// --- fixture battery ----------------------------------------------------------
const days = [];
for (let i = -1100; i <= 5; i += 1) days.push(src.shiftDay("2026-08-14", i));
const daySet = [...days, "2026-01-01", "2025-12-31", "2027-03-05"];

for (const fnName of exported) {
  const cases = fnName === "niceMax" ? [0, 1, 89, 340, 500, 2.1e6, 7, 0.3, 999999999].map((v) => [v])
    : fnName === "heatmapLevel" ? [[0, 100], [10, 0], [10, 100], [25, 100], [50, 100], [75, 100], [100, 100]]
    : fnName === "clampSpan" ? daySet.flatMap((a) => daySet.slice(0, 6).map((b) => [a, b])).concat([["2026-01-01", "2026-08-14", 90]])
    : fnName === "fmtCost" ? [0, 12.34567, 0.000278, 0.012345, 1.5, 100, "0"].map((v) => [v])
    : fnName === "localDay" ? [Date.now(), 0, Date.UTC(2026, 7, 14)].map((v) => [v])
    : fnName === "shiftDay" ? days.flatMap((d) => [[d, -3], [d, 7]])
    : fnName === "daysBetween" ? daySet.flatMap((a) => daySet.slice(0, 10).map((b) => [a, b]))
    : fnName === "bucketOf" ? daySet.flatMap((d) => [["day", d], ["week", d], ["month", d]])
    : fnName === "weekStart" || fnName === "monthKey" || fnName === "bucketLabel" ? daySet.map((d) => [d])
    : fnName === "rangeKeys" ? []
    : fnName === "heatmapCells" ? []
    : fnName === "costOf" ? []
    : fnName === "buildView" ? []
    : [];
  for (const args of cases) {
    assert.deepEqual(
      mirror[fnName](...args), src[fnName](...args),
      `${fnName}(${JSON.stringify(args)}) diverged between mirror and src`,
    );
  }
}

for (const gran of ["day", "week", "month"]) {
  for (let a = 0; a < daySet.length; a += 7) {
    for (let b = a; b < daySet.length; b += 11) {
      assert.deepEqual(mirror.rangeKeys(gran, daySet[a], daySet[b]), src.rangeKeys(gran, daySet[a], daySet[b]));
    }
  }
}

const mkSessions = () => {
  const out = [];
  for (let i = 0; i < 12; i += 1) {
    const rec = {
      project: i % 3 === 0 ? null : `p${i % 4}`, subagent: i % 5 === 0, day: days[100 + i],
      byDay: {}, modelsByDay: {}, turnsByDay: {}, toolCallsByDay: {},
    };
    for (let k = 0; k < 5; k += 1) {
      const d = days[100 + i + k];
      const tokens = { input: 10 * i + k, output: 5 * i, cacheRead: k, cacheWrite: i };
      rec.byDay[d] = tokens;
      rec.modelsByDay[d] = { "m-a": tokens, "m-b": { input: k, output: 1, cacheRead: 0, cacheWrite: 0 } };
      rec.turnsByDay[d] = i % 2;
      rec.toolCallsByDay[d] = k;
    }
    out.push(rec);
  }
  return out;
};
const sessions = mkSessions();
const pricing = [
  { model: "m-a", input: 1, cacheRead: 0.02, output: 2, currency: "CNY" },
  { model: "m-b", input: 3, output: 6, currency: "CNY" },
];
for (const gran of ["day", "week", "month"]) {
  for (const [from, to] of [[days[100], days[110]], [days[105], days[108]], ["2026-01-01", "2026-08-14"], [days[110], days[100]]]) {
    for (const project of ["", "p1", "p2"]) {
      for (const model of ["", "m-a", "m-b", "mystery"]) {
        assert.deepEqual(
          mirror.buildView(sessions, { granularity: gran, from, to, project, model, pricing }),
          src.buildView(sessions, { granularity: gran, from, to, project, model, pricing }),
          `buildView diverged for ${gran}/${from}/${to}/${project}/${model}`,
        );
      }
    }
  }
}

const hourFixtures = [
  {
    project: "p1",
    hoursByDay: {
      [days[100]]: {
        "08": { "m-a": { input: 100, output: 50, cacheRead: 25, cacheWrite: 5 } },
        "09": { "m-b": { input: 200, output: 10, cacheRead: 0, cacheWrite: 0 } },
      },
    },
  },
  {
    project: "p2",
    hoursByDay: {
      [days[100]]: { "09": { "m-a": { input: 7, output: 3, cacheRead: 0, cacheWrite: 0 } } },
      [days[99]]: { "09": { "m-a": { input: 999, output: 0, cacheRead: 0, cacheWrite: 0 } } },
    },
  },
  { project: "p1", hoursByDay: {} },
  { project: "p1", hoursByDay: { [days[100]]: { "99": { x: { input: 1 } } } } },
];
for (const [proj, mod] of [["", ""], ["p1", ""], ["", "m-a"], ["p1", "m-a"]]) {
  assert.deepEqual(
    mirror.hourlySeries(hourFixtures, days[100], { project: proj, model: mod }),
    src.hourlySeries(hourFixtures, days[100], { project: proj, model: mod }),
    `hourlySeries diverged for project=${proj} model=${mod}`,
  );
}

for (const [from, to] of [[days[100], days[105]], ["2026-07-28", "2026-08-10"], ["2026-08-14", "2026-08-19"]]) {
  const buckets = src.rangeKeys("day", from, to).map((key) => ({ key }));
  assert.deepEqual(mirror.heatmapCells(buckets), src.heatmapCells(buckets));
  assert.deepEqual(mirror.costOf([{ model: "m-a", input: 100, output: 50, cacheRead: 10, cacheWrite: 5 }], pricing),
    src.costOf([{ model: "m-a", input: 100, output: 50, cacheRead: 10, cacheWrite: 5 }], pricing));
}

console.log("mirror-test: lib/client.js view model is in sync with src/view.js");
