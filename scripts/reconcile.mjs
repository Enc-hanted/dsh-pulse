/**
 * Reconcile the dashboard's token numbers against the raw session logs.
 *
 *   node scripts/reconcile.mjs                      # today, with the sessions behind it
 *   node scripts/reconcile.mjs --day 2026-11-23     # another day
 *   node scripts/reconcile.mjs --days 7             # one row per day, no session table
 *   node scripts/reconcile.mjs --sessions <root>    # another session store
 *
 * Read-only and offline: nothing is fetched, written or removed. It decodes
 * every stored session the way the harness does and folds each log with the
 * plugin's own `pulseUsage` fold, so the totals are what `/pulse/stats`
 * serves once its persisted rows are warm — by local day, by model, and for
 * a single day by session. A fork's inherited prefix stays with its parent,
 * as in the fold.
 *
 * Reach for it when the dashboard and the provider's usage page disagree.
 * The session table shows who carries the difference. `skipped` names the
 * logs this decoder could not read: they are missing from the totals, never
 * guessed. `torn` marks a log whose last batch is an incomplete frame (the
 * harness repairs that on its next write; the complete batches still count).
 *
 * Three harness rules are mirrored here, each marking the line that carries it:
 * which file in a session directory is the log, where a fork's own history
 * starts, and the layout of the compressed container.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { zstdDecompressSync } from "node:zlib";

import { foldEvents, projectOf, validDay } from "../src/aggregate.js";
import { localDay, shiftDay, splitModelKey } from "../src/view/keys.js";

/** zstd frame magic, little-endian (`28 b5 2f fd`). */
const ZSTD_MAGIC = 0xfd2fb528;

/** Canonical log filenames: `session.v4.jsonl.zstd`, `session.v3.jsonl`, the
 *  legacy `session.jsonl.zstd`. A session directory's other entries —
 *  `.corrupt` copies, migration temporaries, locks — are not logs. */
const LOG_NAME = /^session(?:\.v(\d+))?\.jsonl(\.zstd)?$/;

const MAX_DAYS = 366;

/**
 * Complete frames of a concatenated-frame zstd container. Mirrors
 * dsh-session-persistence-jsonl's `scanZstdFrames`: magic, frame header
 * descriptor, block headers, optional checksum. An incomplete trailing frame
 * is reported through `tornFrom` and left undecoded.
 *
 * @param {Buffer} buffer - one stored artifact.
 * @returns {{frames: Array<{start: number, end: number}>, tornFrom: number|null}}
 */
export function scanZstdFrames(buffer) {
  const frames = [];
  let offset = 0;
  while (offset < buffer.length) {
    const start = offset;
    const torn = () => ({ frames, tornFrom: start });
    if (buffer.length - offset < 4) return torn();
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) throw new Error(`not a zstd frame at byte ${offset}`);
    offset += 4;
    if (buffer.length - offset < 1) return torn();
    const descriptor = buffer.readUInt8(offset);
    offset += 1;
    if ((descriptor & 24) !== 0) throw new Error(`reserved frame header bits at byte ${offset - 1}`);
    const contentSizeFlag = descriptor >>> 6;
    const singleSegment = (descriptor & 32) !== 0;
    const checksum = (descriptor & 4) !== 0;
    const dictionaryBytes = (descriptor & 3) === 3 ? 4 : (descriptor & 3);
    const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag;
    const headerRest = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes;
    if (buffer.length - offset < headerRest) return torn();
    offset += headerRest;
    for (;;) {
      if (buffer.length - offset < 3) return torn();
      const blockHeader = buffer.readUIntLE(offset, 3);
      offset += 3;
      const lastBlock = (blockHeader & 1) !== 0;
      const blockType = (blockHeader >>> 1) & 3;
      const blockSize = blockHeader >>> 3;
      if (blockType === 3) throw new Error(`reserved block type at byte ${offset - 3}`);
      // An RLE block stores its byte once and repeats it `blockSize` times.
      const payloadBytes = blockType === 1 ? 1 : blockSize;
      if (buffer.length - offset < payloadBytes) return torn();
      offset += payloadBytes;
      if (lastBlock) break;
    }
    if (checksum) {
      if (buffer.length - offset < 4) return torn();
      offset += 4;
    }
    frames.push({ start, end: offset });
  }
  return { frames, tornFrom: null };
}

/** Read one stored log to text: a zstd container frame by frame, or plaintext. */
function readLog(file) {
  const raw = readFileSync(file);
  if (!file.endsWith(".zstd")) return { text: raw.toString("utf8"), torn: false };
  const { frames, tornFrom } = scanZstdFrames(raw);
  const text = Buffer.concat(frames.map((f) => zstdDecompressSync(raw.subarray(f.start, f.end)))).toString("utf8");
  return { text, torn: tornFrom !== null };
}

/**
 * Split one stored log into its header line and its event log.
 *
 * @param {string} text - the decoded JSONL.
 * @returns {{header: object|null, headerLines: number, events: any[]}}
 */
export function decodeSessionLog(text) {
  const headers = [];
  const events = [];
  let index = 0;
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch (error) {
      throw new Error(`line ${index + 1} is not JSON (${error.message})`);
    }
    index += 1;
    if (record !== null && typeof record === "object" && record.type === "session") headers.push(record);
    else events.push(record);
  }
  return { header: headers[0] ?? null, headerLines: headers.length, events };
}

/**
 * The one log the harness reads per session directory: its numerically
 * highest generation (dsh-session-persistence-jsonl
 * `resolveGenerationInDirectory`). Older generations left behind by a format
 * migration are stale copies of the same history and must not be folded too.
 *
 * @param {string} root - the session store (`<DSH home>/sessions`).
 * @returns {Array<{dir: string, session: string, file: string, version: number}>}
 */
export function listStore(root) {
  const logs = [];
  const dirs = (dir) => {
    try {
      return readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
    } catch {
      return [];
    }
  };
  for (const project of dirs(root)) {
    for (const session of dirs(join(root, project.name))) {
      const dir = join(root, project.name, session.name);
      let latest = null;
      for (const name of readdirSync(dir)) {
        const match = LOG_NAME.exec(name);
        if (match === null) continue;
        const version = Number(match[1] ?? 0);
        // At equal versions the compressed artifact is the harness default.
        if (latest === null || version > latest.version || (version === latest.version && match[2] !== undefined)) {
          latest = { dir: project.name, session: session.name, file: join(dir, name), version };
        }
      }
      if (latest !== null) logs.push(latest);
    }
  }
  return logs;
}

/**
 * The harness's fork cut (`inheritedEventCount`): a seeded log's inherited
 * prefix ends at its `session/end-seed {inherited:true}` marker, whose own
 * `seq` is the cut. A seeded log without the marker has no own events yet.
 *
 * @param {object|null} header - the log's `session` header line.
 * @param {any[]} events - the log's events, in stored order.
 * @returns {number}
 */
export function forkCutOf(header, events) {
  if (header?.isSeeded !== true) return 0;
  const marker = events.find((event) => event?.type === "session/end-seed" && event?.data?.inherited === true);
  return marker === undefined ? events.length : Number(marker.seq);
}

/** One usage record's token sum, with the fold's number coercion. */
function num(value) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
const usageTotal = (usage) => (usage === null || typeof usage !== "object" ? 0
  : num(usage.inputTokens) + num(usage.outputTokens) + num(usage.cacheReadTokens) + num(usage.cacheWriteTokens));
/** One fold bucket's token sum (`{input, output, cacheRead, cacheWrite}`). */
const bucketTotal = (bucket) => (bucket === null || typeof bucket !== "object" ? 0
  : num(bucket.input) + num(bucket.output) + num(bucket.cacheRead) + num(bucket.cacheWrite));

/**
 * Fold every listed log for one inclusive day range.
 *
 * @param {Array<{dir: string, session: string, file: string}>} logs - `listStore` output.
 * @param {{fromDay: string, toDay: string}} range
 * @returns {{days: string[], byDay: Map<string, Map<string, number>>, providers: Map<string, Set<string>>,
 *   sessions: Array<object>, skipped: Array<{file: string, reason: string}>, read: number, seeded: number, torn: number}}
 */
export function foldCorpus(logs, { fromDay, toDay }) {
  const days = [];
  for (let day = fromDay; day <= toDay && days.length < MAX_DAYS; day = shiftDay(day, 1)) days.push(day);
  const inRange = new Set(days);
  const byDay = new Map(days.map((day) => [day, new Map()]));
  const providers = new Map();
  const sessions = [];
  const skipped = [];
  let seeded = 0;
  let torn = 0;
  for (const log of logs) {
    try {
      const stored = readLog(log.file);
      const { header, headerLines, events } = decodeSessionLog(stored.text);
      if (headerLines !== 1) {
        skipped.push({ file: log.file, reason: `${headerLines} header lines, expected 1` });
        continue;
      }
      const cut = forkCutOf(header, events);
      // Only a fork needs `seq`: the cut is a seq, so the inherited run and
      // the marker must sit exactly where their seqs say. Unseeded logs fold
      // whole whatever their seqs look like (legacy generations carry few).
      if (cut > 0 && !events.slice(0, cut + 1).every((event, index) => event?.seq === index)) {
        skipped.push({ file: log.file, reason: "seeded log without a contiguous seq run up to its cut" });
        continue;
      }
      const view = foldEvents(events, {}, { header, inheritedEventCount: cut });
      const row = {
        id: String(header.id ?? log.session),
        project: projectOf(header.cwd, 1) ?? log.dir,
        fork: cut > 0,
        parent: typeof header.parentSession === "string" ? header.parentSession : null,
        events: events.length,
        torn: stored.torn,
        inherited: 0,
        tokens: 0,
        models: {},
      };
      for (const day of days) {
        for (const [key, bucket] of Object.entries(view.modelsByDay[day] ?? {})) {
          const total = bucketTotal(bucket);
          if (total <= 0) continue;
          const { provider, model } = splitModelKey(key);
          if (provider !== "") {
            if (!providers.has(model)) providers.set(model, new Set());
            providers.get(model).add(provider);
          }
          row.tokens += total;
          row.models[model] = (row.models[model] ?? 0) + total;
          byDay.get(day).set(model, (byDay.get(day).get(model) ?? 0) + total);
        }
      }
      if (row.fork) {
        seeded += 1;
        // What this fork carries of its parent's history on the selected
        // days: counted once, by the parent. Printed so the exclusion shows.
        for (const event of events.slice(0, cut)) {
          if (event?.type === "assistant/message" && inRange.has(localDay(event.time))) row.inherited += usageTotal(event?.data?.usage);
        }
      }
      if (stored.torn) torn += 1;
      if (row.tokens > 0) sessions.push(row);
    } catch (error) {
      skipped.push({ file: log.file, reason: `unreadable: ${error.message}` });
    }
  }
  sessions.sort((a, b) => b.tokens - a.tokens || (a.id < b.id ? -1 : 1));
  return { days, byDay, providers, sessions, skipped, read: logs.length, seeded, torn };
}

/** `12.34M`, `689k`, or the raw count below a thousand. */
function fmt(tokens) {
  if (tokens >= 1e9) return `${(tokens / 1e9).toFixed(2)}B`;
  if (tokens >= 1e6) return `${(tokens / 1e6).toFixed(2)}M`;
  if (tokens >= 1e3) return `${Math.round(tokens / 1e3)}k`;
  return String(tokens);
}

/** A model's column name: the id, or `provider/model` when several
 *  providers served the same id in range. */
function labelOf(model, providers) {
  const set = providers.get(model);
  return set !== undefined && set.size > 1 ? `${[...set].sort().join("|")}/${model}` : model;
}

const shortId = (id) => String(id).replace(/^session-/, "").slice(0, 8);

/** The report as plain text; one function so the test can read it. */
export function renderReport({ root, result }) {
  const { days, byDay, providers, sessions, skipped, read, seeded, torn } = result;
  const out = [];
  const line = (cells, widths) => cells.map((cell, i) => (i === 0 ? String(cell).padEnd(widths[i]) : String(cell).padStart(widths[i]))).join("  ").trimEnd();
  out.push(`store   ${root}`);
  out.push(`days    ${days[0]} … ${days.at(-1)} (${days.length})`);
  out.push(`logs    ${read} read · ${seeded} ${seeded === 1 ? "fork" : "forks"} (inherited prefixes excluded) · ${skipped.length} skipped · ${torn} torn`);
  out.push("");
  const byModel = (map) => [...map].sort((a, b) => b[1] - a[1]).map(([model, tokens]) => `${labelOf(model, providers)} ${fmt(tokens)}`).join(" · ");
  out.push(line(["day", "tokens", "by model"], [11, 10, 0]));
  for (const day of days) {
    const map = byDay.get(day);
    const total = [...map.values()].reduce((sum, tokens) => sum + tokens, 0);
    out.push(line([day, fmt(total), byModel(map)], [11, 10, 0]));
  }
  if (days.length === 1) {
    out.push("");
    out.push(`${days[0]} by session`);
    const modelCells = sessions.map((row) => `${byModel(new Map(Object.entries(row.models)))}${row.torn ? " !" : ""}`);
    const modelWidth = Math.max(24, ...modelCells.map((cell) => cell.length));
    const row = (cells) => [
      cells[0].padStart(9), cells[1].padEnd(16), cells[2].padEnd(8), cells[3].padEnd(4),
      cells[4].padEnd(8), cells[5].padEnd(modelWidth), cells[6].padStart(18),
    ].join("  ").trimEnd();
    out.push(row(["tokens", "project", "session", "fork", "parent", "by model", "inherited excluded"]));
    sessions.forEach((session, i) => out.push(row([
      fmt(session.tokens),
      session.project,
      shortId(session.id),
      session.fork ? "↑" : "",
      session.parent === null ? "" : shortId(session.parent),
      modelCells[i],
      session.inherited > 0 ? fmt(session.inherited) : "",
    ])));
  }
  if (skipped.length > 0) {
    out.push("");
    out.push("skipped (missing from the totals above)");
    for (const { file, reason } of skipped.slice(0, 20)) out.push(`  ${relative(root, file)}  ${reason}`);
    if (skipped.length > 20) out.push(`  … ${skipped.length - 20} more`);
  }
  if (torn > 0) out.push("! = the last batch is an incomplete frame; it counts once the harness repairs it");
  return out.join("\n");
}

const USAGE = `usage: node scripts/reconcile.mjs [--day YYYY-MM-DD | --days N] [--sessions <dir>]

  (no flag)          today, with the sessions behind it
  --day YYYY-MM-DD   that day, with the sessions behind it
  --days N           the last N days (1..366), one row per day
  --sessions <dir>   the session store (default: $DSH_HOME/sessions, else ~/.dsh/sessions)

Read-only: decodes the stored session logs and folds them with the plugin's own fold.`;

/**
 * Command-line arguments to a resolved range.
 *
 * @param {string[]} argv
 * @param {number} [now]
 * @returns {{error?: string, help?: boolean, fromDay?: string, toDay?: string, root?: string}}
 */
export function parseArgs(argv, now = Date.now()) {
  const args = {
    fromDay: localDay(now),
    toDay: localDay(now),
    root: join(process.env.DSH_HOME ?? join(homedir(), ".dsh"), "sessions"),
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") return { help: true };
    const value = argv[i + 1];
    if (arg === "--day") {
      if (validDay(value) === false) return { error: `--day expects a real calendar date as YYYY-MM-DD, got ${value}` };
      args.fromDay = args.toDay = value;
    } else if (arg === "--days") {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1 || n > MAX_DAYS) return { error: `--days expects a whole number from 1 to ${MAX_DAYS}, got ${value}` };
      args.toDay = localDay(now);
      args.fromDay = shiftDay(args.toDay, 1 - n);
    } else if (arg === "--sessions") {
      if (value === undefined || value === "") return { error: "--sessions expects a directory" };
      args.root = resolve(value);
    } else {
      return { error: `unknown argument ${arg}` };
    }
    i += 1;
  }
  return args;
}

/** @param {string[]} argv @returns {number} the exit code */
export function main(argv, now = Date.now(), log = console.log, err = console.error) {
  const args = parseArgs(argv, now);
  if (args.help === true) {
    log(USAGE);
    return 0;
  }
  if (args.error !== undefined) {
    err(`reconcile: ${args.error}\n\n${USAGE}`);
    return 2;
  }
  if (!existsSync(args.root)) {
    err(`reconcile: session store not found: ${args.root}`);
    return 2;
  }
  const result = foldCorpus(listStore(args.root), { fromDay: args.fromDay, toDay: args.toDay });
  log(renderReport({ root: args.root, result }));
  return 0;
}

const invokedAs = process.argv[1] === undefined ? null : resolve(process.argv[1]);
const self = fileURLToPath(import.meta.url);
if (invokedAs !== null && (process.platform === "win32" ? invokedAs.toLowerCase() === self.toLowerCase() : invokedAs === self)) {
  process.exitCode = main(process.argv.slice(2));
}
