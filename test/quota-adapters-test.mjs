import { strict as assert } from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PROVIDER_SPECS } from "../src/pricing-facts.js";
import { parseSpec, specAdapter } from "../src/quota-adapters/spec-engine.js";
import { validateProviderSpec } from "../src/pricing/card-schema.js";

// Conformance replay: every test/fixtures/quota/<provider>/<case>.json holds
// the raw wire shapes and the pinned normalized output. The built-ins are
// now declarative specs in the data card (ratecard.json `providers`), so each
// case feeds the wire to the spec engine's pure parse and deep-compares —
// no network, no build, `node test/quota-adapters-test.mjs` runs standalone.
// A spec edit that drifts from the pinned wire semantics fails here.

const fixturesRoot = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "quota");
const specOf = (id) => {
  const spec = PROVIDER_SPECS.find((s) => s.id === id);
  assert.ok(spec !== undefined, `card carries spec ${id}`);
  return spec;
};

/** How each provider's fixture `wire` maps onto the spec's request ids:
 *  z.ai carries two endpoint replies (subscription may be null), the others
 *  one body under the primary `quota` request. */
const SUITES = {
  zai: { id: "zai-coding", bodies: (wire) => ({ quota: wire.quota ?? null, sub: wire.subscription ?? null }) },
  kimi: { id: "kimi-coding", bodies: (wire) => ({ quota: wire }) },
  minimax: { id: "minimax", bodies: (wire) => ({ quota: wire }) },
  opencode: { id: "opencode-go", bodies: (wire) => ({ quota: wire }) },
};

let fixtures = 0;
for (const provider of Object.keys(SUITES)) {
  const suite = SUITES[provider];
  const spec = specOf(suite.id);
  const cases = readdirSync(join(fixturesRoot, provider)).filter((name) => name.endsWith(".json")).sort();
  assert.ok(cases.length >= 2, `${provider}: at least one normal + one boundary fixture`);
  for (const name of cases) {
    const fixture = JSON.parse(readFileSync(join(fixturesRoot, provider, name), "utf8"));
    assert.ok(fixture !== null && typeof fixture === "object", `${provider}/${name}: fixture is an object`);
    const parsed = parseSpec(spec, suite.bodies(fixture.wire));
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

// --- SPI shape: spec adapters honor src/quota-adapters/types.js --------------
const adapters = Object.values(SUITES).map((suite) => specAdapter(specOf(suite.id)));
assert.equal(new Set(adapters.map((adapter) => adapter.id)).size, adapters.length, "adapter ids are unique");
for (const adapter of adapters) {
  assert.equal(typeof adapter.id, "string", `${adapter.id}: id`);
  assert.equal(typeof adapter.label, "string", `${adapter.id}: label`);
  assert.ok(adapter.short === null || typeof adapter.short === "string", `${adapter.id}: short is a string or null`);
  assert.ok(Array.isArray(adapter.envKeys) && adapter.envKeys.every((key) => typeof key === "string" && key.length > 0), `${adapter.id}: envKeys`);
  assert.equal(typeof adapter.match, "function", `${adapter.id}: match is a function`);
  assert.equal(typeof adapter.hostFor, "function", `${adapter.id}: hostFor`);
  assert.equal(typeof adapter.fetchQuota, "function", `${adapter.id}: fetchQuota`);
}

// --- match(): claims its routes, returns false (never undefined) elsewhere ----
const [zaiAdapter, kimiAdapter, minimaxAdapter, opencodeAdapter] = adapters;
assert.equal(zaiAdapter.short, "GLM", "the spec's declared short reaches the SPI");
assert.equal(kimiAdapter.short, "Kimi");
assert.equal(minimaxAdapter.short, "MiniMax");
assert.equal(opencodeAdapter.short, "OpenCode");
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
assert.equal(opencodeAdapter.match("opencode-go"), true);
assert.equal(opencodeAdapter.match("opencode"), true);
assert.equal(opencodeAdapter.match("opencode-zen"), true);
assert.equal(opencodeAdapter.match("zai"), false);

// --- host variants: the CN route pins the CN console, others the intl host ---
assert.equal(zaiAdapter.hostFor("zai-coding-cn"), "https://open.bigmodel.cn");
assert.equal(zaiAdapter.hostFor("zai-coding"), "https://api.z.ai");
assert.equal(zaiAdapter.hostFor("zai"), "https://api.z.ai");

// --- error gate: a non-zero provider status throws, never fabricates ---------
assert.throws(() => parseSpec(specOf("minimax"), { quota: { base_resp: { status_code: 1004 } } }), /minimax status 1004/);

// --- relative resets: resetInSec lands now+seconds (dynamic, bounded check) --
{
  const before = Date.now();
  const parsed = parseSpec(specOf("opencode-go"), { quota: { usage: { rolling: { percent: 5, resetInSec: 60 } } } });
  const after = Date.now();
  assert.equal(parsed.windows.length, 1);
  const reset = parsed.windows[0].resetsAt;
  assert.ok(reset >= before + 60000 && reset <= after + 60000, "resetInSec → now + seconds");
}

// --- outbound posture: one Authorization header, raw vs bearer, optional -----
{
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, headers: init.headers });
    if (String(url).includes("/subscription/list")) throw new Error("optional endpoint down");
    return { ok: true, json: async () => ({ data: { limits: [] } }) };
  };
  try {
    const rawSpec = { ...specOf("zai-coding"), auth: "raw" };
    const result = await specAdapter(rawSpec).fetchQuota({
      route: "zai-coding-cn", host: "https://open.bigmodel.cn",
      resolveCredential: async () => ({ value: "sk-test", source: "record" }),
    });
    assert.deepEqual(result.windows, [], "optional endpoint failure degrades, parse survives");
    assert.equal(calls.length, 2, "both endpoints fetched");
    for (const call of calls) {
      assert.equal(call.headers.authorization, "sk-test", "raw scheme: no Bearer prefix");
      assert.equal(Object.keys(call.headers).filter((h) => h.toLowerCase() === "authorization").length, 1, "exactly one auth header");
    }
    calls.length = 0;
    await specAdapter(specOf("kimi-coding")).fetchQuota({
      route: "kimi", host: "https://api.kimi.com",
      resolveCredential: async () => ({ value: "sk-test", source: "record" }),
    }).catch(() => null);
    assert.equal(calls[0].headers.authorization, "Bearer sk-test", "bearer scheme");
    assert.equal(calls[0].url, "https://api.kimi.com/coding/v1/usages", "host + spec path");
  } finally {
    globalThis.fetch = realFetch;
  }
}

// --- custom spec: an empty source path addresses the body root ---------------
{
  const custom = {
    id: "custom-x", label: "x", routes: ["x"], hosts: [{ base: "https://x.example" }], auth: "bearer",
    requests: [{ id: "quota", path: "/u" }],
    windows: [{ id: "win", kind: "requests", windowMs: null, source: { request: "quota", path: "", mode: "single" }, pct: { aliases: ["pct"] } }],
  };
  const parsed = parseSpec(custom, { quota: { pct: 42 } });
  assert.equal(parsed.windows.length, 1);
  assert.equal(parsed.windows[0].usedPct, 42);
  assert.equal(parsed.windows[0].used, null, "ratio-only sources never fabricate counts");
}

// --- fold windows: the non-fold path's id discipline applies here too -------
{
  const base = {
    id: "custom-fold", label: "fold", routes: ["fold"], hosts: [{ base: "https://fold.example" }], auth: "bearer",
    requests: [{ id: "quota", path: "/f" }],
  };
  const foldSource = { request: "quota", path: "rows", mode: "array", fold: "max" };
  // An unnamed fold is dropped — a window without an id is unaddressable
  // everywhere downstream (snapshots key on it, the client renders it).
  const unnamed = parseSpec({ ...base, windows: [{ kind: "requests", windowMs: null, source: foldSource, pct: { aliases: ["pct"] } }] },
    { quota: { rows: [{ pct: 10 }, { pct: 90 }] } });
  assert.deepEqual(unnamed.windows, [], "a fold window without an id is dropped, not pushed with id:undefined");
  // Two fold specs colliding on one id: first-wins, never a stacked duplicate.
  const colliding = parseSpec({ ...base, windows: [
    { id: "5h", kind: "requests", windowMs: 18000000, source: foldSource, pct: { aliases: ["pct"] } },
    { id: "5h", kind: "requests", windowMs: 18000000, source: foldSource, pct: { aliases: ["alt"] } },
  ] }, { quota: { rows: [{ pct: 30, alt: 80 }] } });
  assert.equal(colliding.windows.length, 1, "a repeated fold id keeps first-wins");
  assert.equal(colliding.windows[0].usedPct, 30, "…and the FIRST spec's extraction wins");
}

// --- the fee union's ambiguous pairing: plan.find + the static number fee ---
// The two fee shapes are told apart only by amount's type (number vs alias
// array); the zod union cannot forbid pairing the static shape with
// plan.find, so parseSpec must tolerate it — Array.isArray-gated, it reads
// no fee instead of handing pickNum a number ("not iterable" TypeError).
{
  const staticFee = {
    id: "custom-fee", label: "fee", routes: ["fee-route"], hosts: [{ base: "https://fee.example" }], auth: "bearer",
    requests: [{ id: "quota", path: "/u" }],
    plan: {
      find: { request: "quota", path: "subs", where: { status: "VALID" }, requireString: "name" },
      fields: { name: "name" },
      fee: { amount: 10, currency: "USD", cycle: "monthly" },
    },
  };
  assert.doesNotThrow(() => validateProviderSpec(staticFee), "the grammar admits the pairing — parseSpec owns the defense");
  const parsed = parseSpec(staticFee, { quota: { subs: [{ status: "VALID", name: "Pro" }] } });
  assert.equal(parsed.plan.name, "Pro");
  assert.equal(parsed.fee, null, "a static fee under plan.find reads no fee — without the gate this line died in a TypeError");
  // The dynamic shape still reads the fee through the alias chain.
  const dynParsed = parseSpec({ ...staticFee, plan: {
    ...staticFee.plan,
    fee: { amount: ["actualPrice", "initialPrice"], currency: "CNY", cycleField: "billingCycle" },
  } }, { quota: { subs: [{ status: "VALID", name: "Pro", actualPrice: 299, billingCycle: "monthly" }] } });
  assert.deepEqual(dynParsed.fee, { amount: 299, currency: "CNY", cycle: "monthly" }, "the alias-fee shape still lands");
}

console.log(`quota-adapters-test: all assertions passed (${fixtures} fixtures)`);
