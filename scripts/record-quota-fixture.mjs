/**
 * Record ONE live quota fixture for the conformance suite.
 *
 *   node scripts/record-quota-fixture.mjs --provider=zai --endpoint=quota
 *   node scripts/record-quota-fixture.mjs --provider=zai --endpoint=subscription
 *   node scripts/record-quota-fixture.mjs --provider=kimi --endpoint=usage
 *   node scripts/record-quota-fixture.mjs --provider=minimax --endpoint=remains
 *
 * !! MANUAL-ONLY SCRIPT. IT ISSUES A REAL AUTHENTICATED REQUEST AGAINST A
 * !! REAL PROVIDER USING YOUR REAL CREDENTIAL, AND ITS OUTPUT MUST BE
 * !! HUMAN-REVIEWED FIELD BY FIELD BEFORE IT MAY ENTER THE REPO. THE
 * !! REDACTION BELOW IS A FLOOR, NOT A GUARANTEE — THE PRINTED CHECKLIST IS
 * !! THE CONTRACT. NEVER WIRE THIS INTO npm SCRIPTS, CI, OR ANY AUTOMATED
 * !! PATH.
 *
 * What it does: provider+endpoint select the adapter, host and path (from
 * src/quota-adapters/); the credential comes from the adapter's well-known
 * env keys (the first one set in your environment — the VALUE is never
 * printed, only the env var name); one Bearer GET runs with the same
 * bounded, redirect-free posture as the live service; the reply is redacted
 * (redactWire: Authorization/Cookie/account-class keys are stripped, and
 * key-shaped string values are replaced with "[REDACTED:?]" and flagged);
 * a field checklist prints; `normalized` is computed through the adapter's
 * pure parse function over the REDACTED wire. Without --write nothing is
 * written — the default run is a dry review pass. With --write the fixture
 * lands at the --out path (default test/fixtures/quota/<provider>/…) with
 * manualReview "PENDING"; flip it only after the checklist pass.
 *
 * z.ai records its two endpoints separately; merging them into one case's
 * { quota, subscription } wire shape is a manual edit afterwards.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PROVIDER_SPECS } from "../src/pricing-facts.js";
import { fetchJson } from "../src/quota-adapters/shared.js";
import { parseSpec, specAdapter } from "../src/quota-adapters/spec-engine.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Recordable endpoints: the card spec + the route whose host to query +
 *  the request id + how the (redacted) body feeds the spec engine's parse. */
const specOf = (id) => PROVIDER_SPECS.find((s) => s.id === id);
const makeEndpoint = (id, requestId, route, bodiesOf) => {
  const spec = specOf(id);
  return { adapter: specAdapter(spec), spec, route, path: spec.requests.find((r) => r.id === requestId).path, normalize: (body) => parseSpec(spec, bodiesOf(body)) };
};
const ENDPOINTS = {
  zai: {
    quota: makeEndpoint("zai-coding", "quota", "zai-coding-cn", (body) => ({ quota: body, sub: null })),
    subscription: makeEndpoint("zai-coding", "sub", "zai-coding-cn", (body) => ({ quota: null, sub: body })),
  },
  kimi: {
    usage: makeEndpoint("kimi-coding", "quota", "kimi-coding", (body) => ({ quota: body })),
  },
  minimax: {
    remains: makeEndpoint("minimax", "quota", "minimax", (body) => ({ quota: body })),
  },
  opencode: {
    usage: makeEndpoint("opencode-go", "quota", "opencode-go", (body) => ({ quota: body })),
  },
};

/** Key names that NEVER survive into a fixture: auth material, cookies,
 *  account identifiers. Matched case-insensitively as substrings of the
 *  JSON key; hits are replaced with "[REDACTED]" (the key stays so the
 *  shape — and the parse — still reads). */
const REDACT_KEY = /(authorization|auth|cookie|token|secret|api[-_]?key|apikey|passwd|password|credential|session|email|mail|phone|mobile|account|user[_-]?id|\buid\b)/i;

/** String value shapes that look like credential material: Bearer
 *  prefixes, common key sigils, JWT heads, or an opaque run of >= 32
 *  key-class characters. Replaced with "[REDACTED:?]" and FLAGGED — a
 *  false positive (a long product name, an id) is exactly what the
 *  checklist pass must catch and restore by hand. */
const KEY_LIKE_VALUE = /^(bearer\s|sk-|ak-|ghp_|gho_|xox[bap]-|eyJ)/i;
const OPAQUE_VALUE = /^[A-Za-z0-9_\-./+=]{32,}$/;

const args = process.argv.slice(2);
const argOf = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit === undefined ? undefined : hit.slice(name.length + 3);
};
const provider = argOf("provider");
const endpoint = argOf("endpoint");
const outPath = argOf("out");
const write = args.includes("--write");

if (provider === undefined || endpoint === undefined || ENDPOINTS[provider]?.[endpoint] === undefined) {
  const known = Object.entries(ENDPOINTS).map(([p, eps]) => `${p}: ${Object.keys(eps).join(", ")}`).join("\n  ");
  console.error("usage: node scripts/record-quota-fixture.mjs --provider=<p> --endpoint=<e> [--out=<file>] [--write]\n  endpoints:\n  " + known);
  process.exit(1);
}
const ep = ENDPOINTS[provider][endpoint];

/** The credential: first of the adapter's well-known env names that is
 *  set. Only the NAME ever prints. */
const credentialOf = (adapter) => {
  for (const name of adapter.envKeys) {
    const value = (process.env[name] ?? "").trim();
    if (value !== "") return { value, envName: name };
  }
  return null;
};

/** Deep-redact one reply. Collects the checklist as it walks: `redacted`
 *  (key-class hits, stripped), `flagged` (value-shape suspects, replaced
 *  with a marker you must confirm), and every field path for the final
 *  eyeball pass. */
const redactWire = (value, path, report) => {
  if (Array.isArray(value)) {
    return value.map((item, i) => redactWire(item, `${path}[${i}]`, report));
  }
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      const keyPath = path === "" ? key : `${path}.${key}`;
      if (REDACT_KEY.test(key)) {
        report.redacted.push(keyPath);
        out[key] = "[REDACTED]";
      } else {
        out[key] = redactWire(val, keyPath, report);
      }
    }
    return out;
  }
  if (typeof value === "string") {
    if (KEY_LIKE_VALUE.test(value) || OPAQUE_VALUE.test(value)) {
      report.flagged.push(path === "" ? "<root>" : path);
      return "[REDACTED:?]";
    }
  }
  if (path !== "") report.fields.push(path);
  return value;
};

const credential = credentialOf(ep.adapter);
if (credential === null) {
  console.error(`no credential: set one of [${ep.adapter.envKeys.join(", ")}] first (the value is never printed)`);
  process.exit(1);
}

const url = `${ep.adapter.hostFor(ep.route)}${ep.path}`;
console.log(`recording ${provider}/${endpoint}: GET ${url}`);
console.log(`credential: ${credential.envName} (value never printed)`);

const wire = await fetchJson(url, { authorization: ep.spec.auth === "raw" ? credential.value : `Bearer ${credential.value}`, accept: "application/json" });
const report = { redacted: [], flagged: [], fields: [] };
const redacted = redactWire(wire, "", report);

console.log("\n=== FIELD CHECKLIST — REVIEW BEFORE THIS FILE ENTERS THE REPO ===");
console.log("auto-redacted key-class fields (stripped, safe):");
console.log(report.redacted.length === 0 ? "  (none)" : report.redacted.map((p) => `  - ${p}`).join("\n"));
console.log("value-shape suspects (replaced with [REDACTED:?]; confirm each was truly sensitive, restore false positives by hand):");
console.log(report.flagged.length === 0 ? "  (none)" : report.flagged.map((p) => `  - ${p}`).join("\n"));
console.log("all leaf field paths (eyeball for account identifiers the patterns miss):");
console.log(report.fields.length === 0 ? "  (none)" : report.fields.map((p) => `  - ${p}`).join("\n"));
console.log("normalized below is computed from the REDACTED wire — recheck by hand if any path above is load-bearing.");

const normalized = ep.normalize(redacted);
const target = outPath ?? join(root, "test", "fixtures", "quota", provider, `${endpoint}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
const fixture = {
  wire: redacted,
  normalized,
  recordedAt: new Date().toISOString(),
  manualReview: "PENDING — fill after the checklist pass (see scripts/record-quota-fixture.mjs header)",
};

if (write !== true) {
  console.log(`\ndry run (no --write): would write ${target}`);
  console.log(JSON.stringify(fixture, null, 2));
} else {
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(fixture, null, 2) + "\n", "utf8");
  console.log(`\nwritten: ${target} — manualReview stays PENDING until you have reviewed every checklist path`);
}
