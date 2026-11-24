/**
 * scripts/reconcile.mjs: the stored-log reader and the reconciliation fold.
 * A synthetic session store exercises the three harness rules the script
 * mirrors — the highest generation per session directory, the fork cut, the
 * concatenated zstd frame container — and the report printed around them.
 */

import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { constants as zlibConstants, zstdCompressSync } from "node:zlib";

import { localDay } from "../src/aggregate.js";
import { shiftDay } from "../src/view/keys.js";
import {
  decodeSessionLog, foldCorpus, forkCutOf, listStore, main, parseArgs, renderReport, scanZstdFrames,
} from "../scripts/reconcile.mjs";

const DAY = 86400000;
const noon = (offsetDays) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d.getTime() + offsetDays * DAY;
};
const tA = noon(-2) + 1000;
const tB = noon(-1) + 1000;
const dayA = localDay(tA);
const dayB = localDay(tB);

// --- a synthetic store in the harness's layout --------------------------------
const root = mkdtempSync(join(tmpdir(), "dsh-pulse-reconcile-"));
process.on("exit", () => rmSync(root, { recursive: true, force: true }));

/** One stored batch: its own zstd frame, the way the persistence layer appends. */
const frame = (records) => zstdCompressSync(Buffer.from(records.map((record) => JSON.stringify(record)).join("\n") + "\n"));
const put = (relPath, ...buffers) => {
  const file = join(root, relPath);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, Buffer.concat(buffers));
};
const header = (id, extra = {}) => ({ type: "session", version: 4, id, createdAt: tA, cwd: "D:\\work\\projA", ...extra });
const msg = (seq, time, model, input, extra = {}) => ({
  seq, type: "assistant/message", time,
  data: { turn: 1, step: 1, message: { source: { provider: "zai-coding-cn", model } }, usage: { inputTokens: input, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, ...extra } },
});
const stepEnd = (seq, time, turn) => ({ seq, type: "step/end", time, data: { turn, step: 1 } });
const marker = (seq, time) => ({ seq, type: "session/end-seed", time, data: { inherited: true } });
const GLM = "glm-5.4";
const FLASH = "glm-5.3-flash";

// main session: three batches across two days
put("--D-work-projA--/s-main/session.v4.jsonl.zstd",
  frame([header("s-main")]),
  frame([msg(0, tA, FLASH, 1_000_000, { cacheReadTokens: 500_000 }), stepEnd(1, tA, 1)]),
  frame([msg(2, tB, GLM, 2_000_000), stepEnd(3, tB, 2), { seq: 4, type: "session/title", time: tB, data: { title: "主会话" } }]));
// a forked subagent: inherited parent history, the marker, then its own tail
put("--D-work-projA--/s-fork/session.v4.jsonl.zstd",
  frame([header("s-fork", { isSeeded: true, origin: "subagent", parentSession: "s-main" })]),
  frame([msg(0, tB, GLM, 9_000_000), stepEnd(1, tB, 1), { seq: 2, type: "session/title", time: tB, data: { title: "主会话" } }, marker(3, tB)]),
  frame([msg(4, tB, GLM, 1_000_000), stepEnd(5, tB, 2)]));
// a seeded log whose seq run is broken: the cut cannot be trusted
put("--D-work-projA--/s-forkbad/session.v4.jsonl.zstd",
  frame([header("s-forkbad", { isSeeded: true, origin: "subagent", parentSession: "s-main" }), msg(0, tB, GLM, 9_000_000), marker(5, tB)]));
// a migrated session: the stale v0 generation still sits beside the current one
put("--D-work-projA--/s-stale/session.v4.jsonl.zstd", frame([header("s-stale"), msg(0, tB, GLM, 100)]));
put("--D-work-projA--/s-stale/session.jsonl.zstd", frame([{ type: "session", version: 0, id: "s-stale", createdAt: tA, cwd: "D:\\work\\projA" }, { type: "assistant/message", time: tB, data: { usage: { inputTokens: 7_000_000 }, message: { source: { model: GLM } } } }]));
// a legacy log that never had seqs, and a plaintext one
put("--D-work-projB--/s-legacy/session.jsonl.zstd", frame([{ type: "session", version: 0, id: "s-legacy", createdAt: tA, cwd: "D:\\work\\projB" }, { type: "assistant/message", time: tB, data: { usage: { inputTokens: 250_000 }, message: { source: { model: FLASH } } } }]));
put("--D-work-projB--/s-plain/session.v4.jsonl", Buffer.from(`${JSON.stringify(header("s-plain", { cwd: "D:\\work\\projB" }))}\n${JSON.stringify(msg(0, tA, FLASH, 25))}\n`));
// unreadable, ignored and torn entries
put("--D-work-projB--/s-broken/session.v4.jsonl.zstd", Buffer.from("this is not zstd"));
put("--D-work-projB--/s-empty/session.v4.jsonl.zstd.corrupt", Buffer.from("whatever"));
put("--D-work-projB--/s-torn/session.v4.jsonl.zstd", frame([header("s-torn", { cwd: "D:\\work\\projB" }), msg(0, tB, GLM, 100)]), Buffer.from([0x28, 0xb5, 0x2f, 0xfd, 0x00, 0x11]));
put("README.txt", Buffer.from("not a session"));
put("--D-work-projA--/loose.txt", Buffer.from("not a session either"));

// --- the frame container -------------------------------------------------------
{
  const a = frame([header("a")]);
  const b = zstdCompressSync(Buffer.from(JSON.stringify(msg(0, tA, GLM, 1)) + "\n"), { params: { [zlibConstants.ZSTD_c_checksumFlag]: 1 } }); // the harness writes checksummed frames
  const c = frame([stepEnd(1, tB, 1)]);
  const whole = Buffer.concat([a, b, c]);
  const scanned = scanZstdFrames(whole);
  assert.deepEqual(scanned, { frames: [
    { start: 0, end: a.length }, { start: a.length, end: a.length + b.length }, { start: a.length + b.length, end: whole.length },
  ], tornFrom: null }, "every complete frame is located, checksummed ones included");
  assert.equal(scanZstdFrames(Buffer.concat([whole, Buffer.alloc(3)])).tornFrom, whole.length, "a few trailing bytes are a torn frame");
  assert.equal(scanZstdFrames(Buffer.concat([a, c.subarray(0, 12)])).frames.length, 1, "a frame cut inside its blocks is not decoded");
  assert.deepEqual(scanZstdFrames(Buffer.alloc(0)), { frames: [], tornFrom: null });
  assert.throws(() => scanZstdFrames(Buffer.from("nope")), /not a zstd frame at byte 0/);
}

// --- header / event split and the fork cut --------------------------------------
{
  const text = `${JSON.stringify(header("h1"))}\n\n${JSON.stringify(msg(0, tA, GLM, 1))}\n`;
  const decoded = decodeSessionLog(text);
  assert.equal(decoded.header.id, "h1");
  assert.equal(decoded.headerLines, 1);
  assert.equal(decoded.events.length, 1, "blank lines drop out");
  assert.equal(decodeSessionLog(text + text).headerLines, 2, "a second header line is counted, not merged");
  assert.throws(() => decodeSessionLog("{not json}\n"), /line 1 is not JSON/);
  const seeded = header("f", { isSeeded: true });
  assert.equal(forkCutOf(seeded, [msg(0, tA, GLM, 1), stepEnd(1, tA, 1), marker(2, tA), msg(3, tB, GLM, 1)]), 2, "the marker's own seq is the cut");
  assert.equal(forkCutOf(seeded, [msg(0, tA, GLM, 1)]), 1, "a seeded log without a marker has no own events yet");
  assert.equal(forkCutOf(header("m"), [msg(0, tA, GLM, 1)]), 0, "an unseeded log owns everything");
  assert.equal(forkCutOf(null, [marker(0, tA)]), 0);
}

// --- which file is the log ------------------------------------------------------
{
  const logs = listStore(root);
  assert.deepEqual(logs.map((log) => log.session).sort(), ["s-broken", "s-fork", "s-forkbad", "s-legacy", "s-main", "s-plain", "s-stale", "s-torn"],
    "one log per session directory; .corrupt copies, loose files and non-directories stay out");
  const stale = logs.find((log) => log.session === "s-stale");
  assert.ok(stale.file.endsWith("session.v4.jsonl.zstd"), "the stale v0 generation beside the current one is not a log");
  assert.equal(stale.version, 4);
  assert.equal(logs.find((log) => log.session === "s-legacy").version, 0, "the legacy filename is generation 0");
  assert.deepEqual(listStore(join(root, "missing")), [], "an absent store lists nothing");
}

// --- the reconciliation fold ----------------------------------------------------
{
  const result = foldCorpus(listStore(root), { fromDay: dayA, toDay: dayB });
  assert.deepEqual(result.days, [dayA, dayB]);
  assert.equal(result.read, 8);
  assert.equal(result.seeded, 1, "the fork that was folded; the broken one is reported under skipped, once");
  assert.equal(result.torn, 1);
  assert.deepEqual(result.skipped.map(({ file, reason }) => [file.slice(root.length + 1).replace(/\\/g, "/"), reason.replace(/ \(.*\)$/, "")]).sort(), [
    ["--D-work-projA--/s-forkbad/session.v4.jsonl.zstd", "seeded log without a contiguous seq run up to its cut"],
    ["--D-work-projB--/s-broken/session.v4.jsonl.zstd", "unreadable: not a zstd frame at byte 0"],
  ], "a log whose cut cannot be trusted and an unreadable one are named, never guessed");
  const of = (day) => Object.fromEntries(result.byDay.get(day));
  assert.deepEqual(of(dayA), { [FLASH]: 1_500_025 }, "cache reads count, the plaintext log counts");
  assert.deepEqual(of(dayB), { [GLM]: 3_000_200, [FLASH]: 250_000 },
    "main 2M + the fork's own 1M + the current generation 100 + the torn log's complete batch 100; the inherited 9M and the stale 7M generation stay out");
  const byId = Object.fromEntries(result.sessions.map((row) => [row.id, row]));
  assert.equal(byId["s-main"].tokens, 3_500_000);
  assert.deepEqual(byId["s-main"].models, { [FLASH]: 1_500_000, [GLM]: 2_000_000 });
  assert.equal(byId["s-main"].fork, false);
  assert.equal(byId["s-main"].project, "projA", "the project label is the dashboard's (cwd basename)");
  assert.deepEqual([byId["s-fork"].fork, byId["s-fork"].parent, byId["s-fork"].tokens, byId["s-fork"].inherited], [true, "s-main", 1_000_000, 9_000_000],
    "the fork keeps its own usage and reports what it carries of its parent's");
  assert.deepEqual([byId["s-legacy"].fork, byId["s-legacy"].tokens, byId["s-plain"].tokens, byId["s-torn"].tokens, byId["s-torn"].torn], [false, 250_000, 25, 100, true]);
  assert.equal(byId["s-forkbad"], undefined);
  assert.equal(result.sessions[0].id, "s-main", "sessions sort by tokens");
  assert.deepEqual([...result.providers.get(GLM)], ["zai-coding-cn"]);

  const narrow = foldCorpus(listStore(root), { fromDay: dayA, toDay: dayA });
  assert.deepEqual(narrow.sessions.map((row) => row.id).sort(), ["s-main", "s-plain"], "a session without usage in range leaves no row");
  assert.equal(narrow.seeded, 1, "forks are counted whatever the window");
}

// --- the report ----------------------------------------------------------------
{
  const wide = renderReport({ root, result: foldCorpus(listStore(root), { fromDay: dayA, toDay: dayB }) });
  assert.match(wide, new RegExp(`^store   `));
  assert.match(wide, /logs    8 read · 1 fork \(inherited prefixes excluded\) · 2 skipped · 1 torn/);
  assert.match(wide, new RegExp(`^${dayA}\\s+1\\.50M\\s+${FLASH} 1\\.50M$`, "m"));
  assert.match(wide, new RegExp(`^${dayB}\\s+3\\.25M\\s+${GLM} 3\\.00M · ${FLASH} 250k$`, "m"));
  assert.doesNotMatch(wide, /by session/, "a multi-day range prints no session table");
  assert.match(wide, /skipped \(missing from the totals above\)\n  --D-work-projA--[/\\]s-forkbad[/\\]session\.v4\.jsonl\.zstd  seeded log without a contiguous seq run up to its cut/);
  assert.match(wide, /s-broken[/\\]session\.v4\.jsonl\.zstd  unreadable: not a zstd frame at byte 0/);
  assert.match(wide, /! = the last batch is an incomplete frame/);

  const single = renderReport({ root, result: foldCorpus(listStore(root), { fromDay: dayB, toDay: dayB }) });
  assert.match(single, new RegExp(`^\\s+tokens\\s+project\\s+session\\s+fork\\s+parent\\s+by model\\s+inherited excluded$`, "m"));
  assert.match(single, new RegExp(`^\\s+2\\.00M\\s+projA\\s+s-main\\s+glm-5\\.4 2\\.00M`, "m"));
  assert.match(single, new RegExp(`^\\s+1\\.00M\\s+projA\\s+s-fork\\s+↑\\s+s-main\\s+glm-5\\.4 1\\.00M\\s+9\\.00M$`, "m"),
    "a fork row shows its parent and the inherited tokens it left out");
  assert.match(single, new RegExp(`^\\s+100\\s+projB\\s+s-torn\\s+glm-5\\.4 100 !`, "m"), "a torn log is flagged in place");
  assert.doesNotMatch(single, /s-plain/, "a session with nothing on the day stays out of its table");

  // two providers behind one model id: the column names both
  const two = foldCorpus([{ dir: "d", session: "s", file: join(root, "--D-work-projA--/s-main/session.v4.jsonl.zstd") }], { fromDay: dayB, toDay: dayB });
  two.providers.get(GLM).add("other-provider");
  assert.match(renderReport({ root, result: two }), /other-provider\|zai-coding-cn\/glm-5\.4 2\.00M/, "providers sort alphabetically before the shared model id");
}

// --- arguments and the command ---------------------------------------------------
{
  const now = noon(0);
  // the default store follows the harness home, with or without DSH_HOME set
  const savedHome = process.env.DSH_HOME;
  try {
    process.env.DSH_HOME = join("somewhere", "dsh-home");
    assert.equal(parseArgs([], now).root, join("somewhere", "dsh-home", "sessions"));
    delete process.env.DSH_HOME;
    assert.deepEqual(parseArgs([], now), { fromDay: localDay(now), toDay: localDay(now), root: join(homedir(), ".dsh", "sessions") });
  } finally {
    if (savedHome === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = savedHome;
  }
  assert.equal(parseArgs(["--day", dayB], now).fromDay, dayB);
  assert.equal(parseArgs(["--day", dayB], now).toDay, dayB);
  assert.match(parseArgs(["--day", "2026-02-30"], now).error, /real calendar date/);
  assert.match(parseArgs(["--day"], now).error, /real calendar date/);
  const week = parseArgs(["--days", "7"], now);
  assert.deepEqual([week.fromDay, week.toDay], [shiftDay(localDay(now), -6), localDay(now)]);
  for (const bad of ["0", "367", "x", "1.5", undefined]) assert.match(parseArgs(["--days", bad], now).error, /whole number from 1 to 366/);
  assert.equal(parseArgs(["--sessions", " elsewhere "], now).root, resolve(" elsewhere "));
  assert.match(parseArgs(["--sessions"], now).error, /expects a directory/);
  assert.match(parseArgs(["--week", "7"], now).error, /unknown argument --week/);
  assert.equal(parseArgs(["--help"], now).help, true);

  const printed = [];
  const errors = [];
  assert.equal(main(["--sessions", root, "--day", dayB], now, (text) => printed.push(text), (text) => errors.push(text)), 0);
  assert.match(printed.join("\n"), new RegExp(`^store   `));
  assert.match(printed.join("\n"), new RegExp(`^${dayB}\\s+3\\.25M`, "m"));
  assert.match(printed.join("\n"), /by session/);
  assert.equal(main(["--sessions", join(root, "nope"), "--day", dayB], now, (text) => printed.push(text), (text) => errors.push(text)), 2, "an absent store exits 2");
  assert.match(errors.join("\n"), /session store not found/);
  assert.equal(main(["--days", "0"], now, (text) => printed.push(text), (text) => errors.push(text)), 2);
  assert.equal(main(["--help"], now, (text) => printed.push(text), (text) => errors.push(text)), 0);
  assert.match(printed.at(-1), /usage: node scripts\/reconcile\.mjs/);
}

console.log("reconcile-test: all assertions passed");
