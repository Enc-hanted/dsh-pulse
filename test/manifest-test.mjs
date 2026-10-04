/**
 * Packaging and registration invariants the other suites cannot see:
 *
 *  - the client bundle's build stamp equals package.json's version, so the
 *    settings page's "current version" can never drift from the manifest;
 *  - the `/` menu row is a CLIENT contribution (it carries the glyph and the
 *    locale-aware copy) and the host half registers NO command, so the menu
 *    shows exactly one row — dsh merges contributions with the host catalog by
 *    name and fails loud on a same-name row, and a host command would always
 *    add its own glyph-less row;
 *  - the menu row never delegates over the remote bridge: its action opens the
 *    plugin's own floating seat (the compact summary, handing over to the full
 *    observatory), so the row cannot become a dead key;
 *  - neither half reaches for a host-side patch (`__DSH_COMMAND_FACES__`): the
 *    plugin is self-contained and modifies no dsh file.
 */

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundle = readFileSync(join(root, "lib", "client.js"), "utf8");
const host = readFileSync(join(root, "src", "index.js"), "utf8");
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const stamp = /\b(?:const|var|let) DP_BUILD = "([^"]+)";/.exec(bundle);
assert.notEqual(stamp, null, "DP_BUILD declaration missing from the client bundle");
assert.equal(stamp[1], manifest.version, "DP_BUILD must equal package.json's version");

assert.ok(!bundle.includes("__DSH_COMMAND_FACES__"), "the client half must not depend on a patched dsh");
assert.ok(!host.includes("__DSH_COMMAND_FACES__"), "the host half must not depend on a patched dsh");
assert.ok(!bundle.includes("dp_buildTag") && !bundle.includes("dp_cmdBuild"),
  "no version stamp is rendered outside the settings page");

// One menu row: the contribution carries the face, the host registers nothing.
assert.ok(!host.includes("ctx.commands.register"), "the host half registers no command");
assert.ok(!host.includes("pulse-usage"), "the retired command name is gone from the host half");
assert.ok(/commandUi\.register\(\{[\s\S]{0,400}?name: "pulse"/.test(bundle),
  "the '/' menu row is registered as a client contribution");
assert.ok(bundle.includes('ctx.inject(["commandUi"]'),
  "the contribution waits for the command service instead of racing its load order");
assert.ok(/label: \(\) => t\("nav"\)/.test(bundle) && /description: \(\) => t\("cmdMenuDesc"\)/.test(bundle),
  "the row copy is read on every candidate pass, so it follows the UI language");
assert.ok(bundle.includes("IconDataOutline16"), "the contribution carries the pulse glyph");

// The action opens the plugin's own seat — no remote delegation, no dead row.
assert.ok(!bundle.includes("remote.commands.execute"), "the menu action must not delegate over the remote bridge");
assert.ok(bundle.includes('openOverlay("summary"'), "the menu action opens the compact summary face");
assert.ok(bundle.includes('openOverlay("full"'), "the summary hands over to the full observatory");
assert.ok(bundle.includes("dp_overlayCardSummary"), "the seat has a compact face");
assert.ok(bundle.includes('key: "pulse-usage"'),
  "history keeps its card: commandview nodes recorded under the retired command name still render");

assert.ok(host.includes('pathname === "/pulse/update-check"'), "the manual update check route is registered");
assert.ok(bundle.includes('fetch("/pulse/update-check"'), "the settings panel owns the only check trigger");

console.log("manifest-test: version stamp, single menu row and no-dsh-patch invariants hold");
