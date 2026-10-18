import { strict as assert } from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { kimiAdapter, parseKimiUsages } from "../src/quota-adapters/kimi.js";
import { minimaxAdapter, parseMinimaxRemains } from "../src/quota-adapters/minimax.js";
import { zaiAdapter, parseZaiQuota } from "../src/quota-adapters/zai.js";

// Conformance replay: every test/fixtures/quota/<provider>/<case>.json holds
// the raw wire shapes (hand-written from the adapter doc comments' observed
// encodings) and the pinned normalized output. Each case feeds the wire to
// the adapter's pure parse function and deep-compares — no network, no
// build, `node test/quota-adapters-test.mjs` runs standalone.

const fixturesRoot = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "quota");

/** How each provider's fixture `wire` feeds its parse function: z.ai carries
 *  its two endpoint replies (subscription may be null), the others one body. */
const SUITES = {
  zai: { adapter: zaiAdapter, parse: (wire) => parseZaiQuota(wire.quota ?? null, wire.subscription ?? null) },
  kimi: { adapter: kimiAdapter, parse: (wire) => parseKimiUsages(wire) },
  minimax: { adapter: minimaxAdapter, parse: (wire) => parseMinimaxRemains(wire) },
};

let fixtures = 0;
for (const provider of Object.keys(SUITES)) {
  const suite = SUITES[provider];
  const cases = readdirSync(join(fixturesRoot, provider)).filter((name) => name.endsWith(".json")).sort();
  assert.ok(cases.length >= 2, `${provider}: at least one normal + one boundary fixture`);
  for (const name of cases) {
    const fixture = JSON.parse(readFileSync(join(fixturesRoot, provider, name), "utf8"));
    assert.ok(fixture !== null && typeof fixture === "object", `${provider}/${name}: fixture is an object`);
    const parsed = suite.parse(fixture.wire);
    assert.deepEqual(parsed, fixture.normalized, `${provider}/${name}: wire → normalized`);
    // the SPI minimum every consumer may rely on (types.js: id + usedPct;
    // resetsAt wherever the wire stated a reset)
    assert.ok(Array.isArray(fixture.normalized.windows), `${provider}/${name}: windows is an array`);
    for (const window of fixture.normalized.windows) {
      assert.equal(typeof window.id, "string", `${provider}/${name}: window.id is a string`);
      assert.ok(window.usedPct === null || (window.usedPct >= 0 && window.usedPct <= 100), `${provider}/${name}: usedPct clamped`);
    }
    fixtures += 1;
    console.log(`ok ${fixtures} - ${provider}/${name.replace(/\.json$/, "")}`);
  }
}

// --- SPI shape: the built-ins honor src/quota-adapters/types.js ----------------
const adapters = Object.values(SUITES).map((suite) => suite.adapter);
assert.equal(new Set(adapters.map((adapter) => adapter.id)).size, adapters.length, "adapter ids are unique");
for (const adapter of adapters) {
  assert.equal(typeof adapter.id, "string", `${adapter.id}: id`);
  assert.equal(typeof adapter.label, "string", `${adapter.id}: label`);
  assert.ok(Array.isArray(adapter.envKeys) && adapter.envKeys.every((key) => typeof key === "string" && key.length > 0), `${adapter.id}: envKeys`);
  assert.equal(typeof adapter.match, "function", `${adapter.id}: match is a function`);
  assert.equal(typeof adapter.hostFor, "function", `${adapter.id}: hostFor`);
  assert.equal(typeof adapter.fetchQuota, "function", `${adapter.id}: fetchQuota`);
}

// --- match(): claims its routes, returns false (never undefined) elsewhere ------
assert.equal(zaiAdapter.match("zai-coding-cn"), true, "CN console route claimed");
assert.equal(zaiAdapter.match("zai-coding"), true);
assert.equal(zaiAdapter.match("zai"), true);
assert.equal(zaiAdapter.match("kimi"), false, "no cross-claims");
assert.equal(zaiAdapter.match(""), false, "empty provider id");
assert.equal(zaiAdapter.match("ZAI-CODING"), false, "claim ids are case-sensitive");
assert.equal(zaiAdapter.match("zai-coding", { value: { providers: {} } }), true, "a describe row is tolerated and ignored");
assert.equal(kimiAdapter.match("kimi-coding"), true);
assert.equal(kimiAdapter.match("kimi"), true);
assert.equal(kimiAdapter.match("zai"), false);
assert.equal(minimaxAdapter.match("minimax"), true);
assert.equal(minimaxAdapter.match("minimax-coding"), true);
assert.equal(minimaxAdapter.match("minimax-cn"), true);
assert.equal(minimaxAdapter.match("kimi"), false);

console.log(`quota-adapters-test: all assertions passed (${fixtures} fixtures)`);
