/**
 * Regenerate the view-model mirror inside lib/client.js from src/view.js.
 *
 * A dsh client half is a single self-registering bundle that cannot require
 * node-side modules, so src/view.js is mirrored into lib/client.js inside
 * the marked region. Run this script after every src/view.js edit:
 *
 *   node scripts/sync-mirror.mjs
 *
 * test/mirror-test.mjs then fails on drift, keeping the two copies honest.
 * The mirror is byte-derived: only the ESM `export` modifiers are stripped,
 * everything else (comments, order, bodies) is copied verbatim.
 *
 * @module dsh-pulse/scripts/sync-mirror
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcPath = join(root, "src", "view.js");
const bundlePath = join(root, "lib", "client.js");

const startMark = "//#region view model (mirror of src/view.js — keep both in sync)";
const endMark = "//#endregion";

const src = readFileSync(srcPath, "utf8");
const bundle = readFileSync(bundlePath, "utf8");
const start = bundle.indexOf(startMark);
const end = bundle.indexOf(endMark, start);
if (start === -1 || end === -1) {
  console.error("sync-mirror: region markers not found in lib/client.js");
  process.exit(1);
}

const body = src
  .replace(/^export function /gm, "function ")
  .replace(/^export const /gm, "const ")
  .trimEnd()
  .split("\n")
  .map((line) => (line.length > 0 ? `\t\t${line}` : line))
  .join("\n");

const next = `${bundle.slice(0, start)}${startMark}\n${body}\n\t\t${endMark}${bundle.slice(end + endMark.length)}`;
writeFileSync(bundlePath, next, "utf8");

const lines = body.split("\n").length;
console.log(`sync-mirror: lib/client.js region regenerated from src/view.js (${lines} lines)`);
