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
import { readFileSync, statSync } from "node:fs";
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

// --- dsh alignment: dependency declaration & seat ledger -------------------

// The manifest's dsh.client.external is the one declaration of which host
// module-table names this bundle consumes (esbuild's external list derives
// from it at build time); every require() target in the served artifact —
// including the envelope's own react-dom — must be covered by it,
// full-specifier equality.
const bundleRequires = [...new Set([...bundle.matchAll(/\brequire\("([^"]+)"\)/g)].map((m) => m[1]))];
assert.ok(bundleRequires.length > 0, "require extraction found nothing — the envelope shape changed");
const missingExternal = bundleRequires.filter((name) => !(manifest.dsh?.client?.external ?? []).includes(name));
assert.deepEqual(missingExternal, [],
  `bundle requires not declared in dsh.client.external: ${missingExternal.join(", ")}`);

// Seat ledger: the seat names the client half references, locked against
// this hand-maintained table so a host upgrade that drops one is a diff to
// review here instead of a missing UI block discovered in the wild. The
// lock is source ↔ table only — host packages are not on the test
// dependency tree, so "exists on the running host" stays a smoke-test duty.
// Provenance per listed host generation: which trees the seat name was
// grep-verified against. Audited 2026-10-04 across the local npx host
// caches: 0.2.0-rc.2 (npm tree + desktop client-ui packages) and
// 0.1.7-alpha.2 carry all 8; 0.1.0-rc.7 carries only the five non-plugins
// seats — its npm tree has no "plugins.*" literal anywhere, so on that
// generation the three plugin-page seats ride the injectSeat warn-once
// degradation by design.
// 2026-10-16: the conversation.composer.dock focus probe was REPLACED by
// the authoritative ctx.sessions retainInfo(mainView) query — the seat is
// gone from this ledger on purpose (the prune check below enforces it
// stays gone).
const SEAT_LEDGER = {
	"settings.section": ["0.2.0-rc.2", "0.1.7-alpha.2", "0.1.0-rc.7"],
	"settings.general.item": ["0.2.0-rc.2", "0.1.7-alpha.2", "0.1.0-rc.7"],
	"conversation.chat.commandview": ["0.2.0-rc.2", "0.1.7-alpha.2", "0.1.0-rc.7"],
	"sidebar.footer.action": ["0.2.0-rc.2", "0.1.7-alpha.2", "0.1.0-rc.7"],
	"shell.overlay": ["0.2.0-rc.2", "0.1.7-alpha.2", "0.1.0-rc.7"],
	"plugins.row.config": ["0.2.0-rc.2", "0.1.7-alpha.2"],
	"plugins.detail.badge": ["0.2.0-rc.2", "0.1.7-alpha.2"],
	"plugins.detail.section": ["0.2.0-rc.2", "0.1.7-alpha.2"],
};
const seatRefs = [...new Set([...readFileSync(join(root, "src", "client", "plugin.js"), "utf8")
  .matchAll(/\b(?:ctx\.slots\.inject|injectSeat)\(\s*"([a-zA-Z0-9._-]+)"/g)].map((m) => m[1]))];
assert.ok(seatRefs.length > 0, "seat extraction found nothing — the inject call shape changed");
const unknownSeats = seatRefs.filter((name) => !(name in SEAT_LEDGER));
assert.deepEqual(unknownSeats, [],
  `seats referenced but not in SEAT_LEDGER (verify against the target host, then add): ${unknownSeats.join(", ")}`);
const staleSeats = Object.keys(SEAT_LEDGER).filter((name) => !seatRefs.includes(name));
assert.deepEqual(staleSeats, [], `SEAT_LEDGER entries no longer referenced (prune): ${staleSeats.join(", ")}`);

// --- dsh alignment: host display metadata (locale + icon) -------------------

// The harness reads plugin display text WITHOUT importing or activating the
// plugin: readPluginMeta resolves <package>/locale/en.json through exports,
// sibling language files from the same directory, and the <package>/icon
// resource (SVG/PNG/JPEG/WebP, raw bytes ≤ 256 KiB). These assertions keep
// that surface exported, shippable and within the harness's own limits.
for (const key of ["./locale/en.json", "./locale/zh.json"]) {
  assert.ok(typeof manifest.exports?.[key] === "string", `exports must expose ${key}`);
  const file = JSON.parse(readFileSync(join(root, manifest.exports[key]), "utf8"));
  assert.deepEqual(Object.keys(file).sort(), ["description", "title"],
    `${key} carries exactly title/description`);
  for (const [field, value] of Object.entries(file)) {
    assert.ok(typeof value === "string" && value.trim().length > 0,
      `${key}.${field} is a non-empty string`);
  }
}
const iconExport = manifest.exports?.["./icon"];
assert.ok(typeof iconExport === "string" && /\.(svg|png|jpe?g|webp)$/i.test(iconExport),
  "exports must expose ./icon as an image file");
const iconStat = statSync(join(root, iconExport));
assert.ok(iconStat.isFile() && iconStat.size <= 256 * 1024,
  "the icon is a regular file of at most 256 KiB");
assert.ok((manifest.files ?? []).includes("locale"), "the shipped file list carries locale/");
assert.ok(!(manifest.files ?? []).includes("test"), "the published package must not ship tests");

// Guardrail A: seam packages ride peerDependencies, never dependencies. The
// host's linked-root resolution only intercepts peer-listed names, so a seam
// in `dependencies` installs a private copy that silently shadows the host's
// own (possibly newer) seam — exactly the 0.1.7-inside-a-0.2.1-host skew the
// startup seam log now surfaces. Pure libraries with no host-shared state
// may stay direct dependencies; re-justify additions to the allowlist here.
const LIBRARY_ALLOWLIST = new Set(["@deepseek-ai/schemastery"]);
const seamDeps = Object.keys(manifest.dependencies ?? {})
  .filter((name) => name.startsWith("@deepseek-ai/") && !LIBRARY_ALLOWLIST.has(name));
assert.deepEqual(seamDeps, [],
  `@deepseek-ai/* host seams must be peers, found in dependencies: ${seamDeps.join(", ")}`);
for (const seam of ["@deepseek-ai/dsh-credentials", "@deepseek-ai/dsh-storage-domain"]) {
  assert.ok(typeof manifest.peerDependencies?.[seam] === "string",
    `${seam} must be declared in peerDependencies`);
}

console.log("manifest-test: version stamp, single menu row and no-dsh-patch invariants hold");
