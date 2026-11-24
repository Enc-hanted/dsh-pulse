import { strict as assert } from "node:assert";
import { SEED_CARD, applyCard, resetCard, activeCard, PEAK_HOURS, PROVIDER_SPECS } from "../src/pricing-facts.js";
import { validateCard } from "../src/pricing/card-schema.js";
import { cardDiff, credentialRoutingDiff } from "../src/pricing/card.js";
import { officialRulesFor, isOffPeakDay } from "../src/view/official-pricing.js";
import { effectivePricing } from "../src/host/pricing-config.js";
import { buildView } from "../src/view.js";
import { auxDayUsage } from "../src/view/aux-calls.js";

// --- validation: the seed passes; malformed cards fail at the boundary ----
assert.doesNotThrow(() => validateCard(SEED_CARD));
assert.throws(() => validateCard({ ...SEED_CARD, schemaVersion: 1 }));
assert.throws(() => validateCard({ ...SEED_CARD, pricing: { ...SEED_CARD.pricing, usdToCny: -1 } }));
const unsorted = structuredClone(SEED_CARD);
unsorted.pricing.schedules.reverse();
assert.throws(() => validateCard(unsorted), /most-recent-first/);
const noWindow = structuredClone(SEED_CARD);
noWindow.pricing.feeWindows = [];
assert.throws(() => validateCard(noWindow), /server-side-search/);
const badUntil = structuredClone(SEED_CARD);
// carries an offset (past the new offset gate) but no real instant
badUntil.pricing.feeWindows[0].until = "2026-13-99T12:00:00+08:00";
assert.throws(() => validateCard(badUntil), /unparsable/);
const datelessUntil = structuredClone(SEED_CARD);
datelessUntil.pricing.feeWindows[0].until = "not-a-date";
assert.throws(() => validateCard(datelessUntil), /explicit UTC offset/, "an offset-less garbage until is caught by the offset gate first");
// An OFFSET-LESS instant is parseable but ambiguous: Date.parse reads it in
// the host's local timezone, so the same card would bill differently on a
// UTC runner and a UTC+8 desktop. The offset must be stated — `Z` counts.
const naiveUntil = structuredClone(SEED_CARD);
naiveUntil.pricing.feeWindows[0].until = "2026-11-18T12:00:00";
assert.throws(() => validateCard(naiveUntil), /explicit UTC offset/, "an offset-less until is refused even though Date.parse accepts it");
const zuluUntil = structuredClone(SEED_CARD);
zuluUntil.pricing.feeWindows[0].until = "2026-11-18T04:00:00Z";
assert.doesNotThrow(() => validateCard(zuluUntil), "a Z-suffixed until IS an explicit offset");
// Exactly ONE server-side-search window: derive() reads the first `.find`,
// so a second/overlapping era would be silently ignored — an ambiguity a
// trust anchor cannot carry.
const twinWindow = structuredClone(SEED_CARD);
twinWindow.pricing.feeWindows.push(structuredClone(SEED_CARD.pricing.feeWindows[0]));
assert.throws(() => validateCard(twinWindow), /exactly one server-side-search/);

// --- dead fields: all three had zero consumers, so the strict schema now
// refuses them (third-party peak windows ride the user's pricing rules; the
// exec-per-request cap never reached any reader) ---------------------------
const peakWeekdaysOnly = structuredClone(SEED_CARD);
peakWeekdaysOnly.pricing.peakWeekdaysOnly = true;
assert.throws(() => validateCard(peakWeekdaysOnly), /Unrecognized key/, "pricing.peakWeekdaysOnly is gone from the schema");
const rulePeak = structuredClone(SEED_CARD);
rulePeak.pricing.schedules[0].rules[0].peakHours = [1, 2];
assert.throws(() => validateCard(rulePeak), /Unrecognized key/, "rule-level peakHours is gone from the schema (pricing-facts bakes pricing.peakHours onto every rule)");
const execCap = structuredClone(SEED_CARD);
execCap.pricing.feeWindows[0].execPerRequestMax = 100;
assert.throws(() => validateCard(execCap), /Unrecognized key/, "feeWindows[].execPerRequestMax is gone from the schema");

// --- diff: identical cards empty; rate + version changes surface ----------
assert.deepEqual(cardDiff(SEED_CARD, SEED_CARD), []);
const changed = structuredClone(SEED_CARD);
changed.pricing.schedules[0].rules[0].input = 2;
changed.version = 4;
const d = cardDiff(SEED_CARD, changed);
assert.ok(d.some((r) => r.label === "version" && r.b === 4));
assert.ok(d.some((r) => r.label.endsWith("/deepseek-flash") && r.b.input === 2));

// --- providers: schema-3 specs validate, diff, and republish live -----------
assert.equal(SEED_CARD.providers.length, 4, "seed carries the four provider specs");
const dupRoute = structuredClone(SEED_CARD);
dupRoute.providers[1].routes.push("zai");
assert.throws(() => validateCard(dupRoute), /claimed twice/);
const badHost = structuredClone(SEED_CARD);
badHost.providers[0].hosts[0].base = "not-a-url";
assert.throws(() => validateCard(badHost), /http\(s\) URL/);
// 回环规则：bearer 凭据不得明文外发 —— 非回环 http 的 host base 拒收，
// 回环 http（本地镜像开发姿势）与任意 https 主机放行。
const remoteHttp = structuredClone(SEED_CARD);
remoteHttp.providers[0].hosts[0].base = "http://example.com/v1";
assert.throws(() => validateCard(remoteHttp), /cleartext/, "远程 http host 被拒（bearer 凭据不得明文外发）");
const loopbackHttp = structuredClone(SEED_CARD);
loopbackHttp.providers[0].hosts[0].base = "http://127.0.0.1:8317/v1";
assert.doesNotThrow(() => validateCard(loopbackHttp), "回环 http host 放行");
const anyHttps = structuredClone(SEED_CARD);
anyHttps.providers[0].hosts[0].base = "https://mirror.example.net/v1";
assert.doesNotThrow(() => validateCard(anyHttps), "https 任意主机放行");
const provChanged = structuredClone(SEED_CARD);
provChanged.providers[3].requests[0].path = "/inference/go/v1/usage";
assert.ok(cardDiff(SEED_CARD, provChanged).some((r) => r.label === "provider:opencode-go.requests[0].path"),
  "endpoint drift surfaces in the preview (deep diff names the changed leaf)");

// --- the preview's trust anchor: a silent zero-diff is the forbidden outcome
// The old summary diffed only label/routes/auth/hosts/paths + the window
// COUNT, so windowMs and plan-fee edits rendered "no differences". These rows
// are the regression: every spec leaf the schema can carry must surface.
{
  const windowMsOnly = structuredClone(SEED_CARD);
  windowMsOnly.providers[1].windows[0].windowMs = 86400000; // kimi 7d → 1d, count unchanged
  const dWin = cardDiff(SEED_CARD, windowMsOnly);
  assert.ok(dWin.some((r) => r.label === "provider:kimi-coding.windows[0].windowMs" && r.a === 604800000 && r.b === 86400000),
    "a windowMs-only edit must produce its own diff row");
  const feeOnly = structuredClone(SEED_CARD);
  feeOnly.providers[3].plan.fee.amount = 20; // 套餐费 10 → 20
  assert.ok(cardDiff(SEED_CARD, feeOnly).some((r) => r.label === "provider:opencode-go.plan.fee.amount" && r.a === 10 && r.b === 20),
    "a plan-fee bump must surface in the preview");
  const aliasOnly = structuredClone(SEED_CARD);
  aliasOnly.providers[0].windows[0].pct.aliases = ["currentIntervalRemainingPercent"];
  assert.ok(cardDiff(SEED_CARD, aliasOnly).some((r) => r.label === "provider:zai-coding.windows[0].pct.aliases[0]"),
    "pct alias-chain edits surface per index");
  const countsOnly = structuredClone(SEED_CARD);
  countsOnly.providers[2].windows[0].counts.deriveUsed = false;
  assert.ok(cardDiff(SEED_CARD, countsOnly).some((r) => r.label === "provider:minimax.windows[0].counts.deriveUsed" && r.b === false),
    "counts edits surface");
  const resetOnly = structuredClone(SEED_CARD);
  resetOnly.providers[1].windows[0].reset.aliases = ["expiresAt"];
  assert.ok(cardDiff(SEED_CARD, resetOnly).some((r) => r.label === "provider:kimi-coding.windows[0].reset.aliases[0]" && r.a === "resetTime"),
    "reset alias edits surface");
  const gateOnly = structuredClone(SEED_CARD);
  gateOnly.providers[2].errorGate.field = "code";
  assert.ok(cardDiff(SEED_CARD, gateOnly).some((r) => r.label === "provider:minimax.errorGate.field" && r.a === "status_code"),
    "errorGate rewiring surfaces");
  const keyOnly = structuredClone(SEED_CARD);
  keyOnly.providers[0].envKeys = ["ZAI_API_KEY"];
  const dKeys = cardDiff(SEED_CARD, keyOnly);
  assert.ok(dKeys.some((r) => r.label === "provider:zai-coding.envKeys[0]" && r.a === "ZAI_CODING_CN_API_KEY")
    && dKeys.some((r) => r.label === "provider:zai-coding.envKeys[1]" && r.b === null),
    "envKey additions and removals surface per index");
  const authOnly = structuredClone(SEED_CARD);
  authOnly.providers[1].auth = "raw";
  assert.ok(cardDiff(SEED_CARD, authOnly).some((r) => r.label === "provider:kimi-coding.auth" && r.b === "raw"),
    "an auth scheme change surfaces");
  // Added/removed subtrees stay whole-item rows instead of per-leaf noise.
  const winAdded = structuredClone(SEED_CARD);
  winAdded.providers[1].windows.push({ ...winAdded.providers[1].windows[0], id: "extra", windowMs: 60000 });
  assert.ok(cardDiff(SEED_CARD, winAdded).some((r) => r.label === "provider:kimi-coding.windows[2]" && r.a === null),
    "an added window is one whole-item row");
  const provAdded = structuredClone(SEED_CARD);
  provAdded.providers.push({ ...SEED_CARD.providers[0], id: "zai-twin", routes: ["zai-twin"] });
  assert.ok(cardDiff(SEED_CARD, provAdded).some((r) => r.label === "provider:zai-twin" && r.a === null),
    "a new provider is one whole-spec row");
  // The settings panel keys rows by label — labels must stay unique.
  const messy = structuredClone(SEED_CARD);
  messy.providers[3].plan.fee.amount = 20;
  messy.providers[0].windows[0].pct.aliases = ["currentIntervalRemainingPercent"];
  messy.providers[2].errorGate.field = "code";
  messy.version = SEED_CARD.version + 1;
  const all = cardDiff(SEED_CARD, messy);
  assert.equal(new Set(all.map((r) => r.label)).size, all.length, "diff row labels are unique");
  // Key order carries no meaning: the preview compares structurally (the
  // same standard the apply `base` guard pins host-side), so a reordered
  // twin of the active card is ZERO diff — a stringify-based compare fakes
  // rows whole-value at a time (auxShape, rule rows, feeWindows).
  const reorderDeep = (v) => Array.isArray(v) ? v.map(reorderDeep)
    : (v !== null && typeof v === "object" ? Object.fromEntries(Object.keys(v).reverse().map((k) => [k, reorderDeep(v[k])])) : v);
  assert.deepEqual(cardDiff(SEED_CARD, reorderDeep(SEED_CARD)), [], "a key-reordered twin of the active card is zero-diff");
  const reorderedEdit = reorderDeep(SEED_CARD);
  reorderedEdit.pricing.usdToCny = 7.9;
  const dReordered = cardDiff(SEED_CARD, reorderedEdit);
  assert.deepEqual(dReordered.map((r) => r.label), ["usdToCny"],
    "a reordered card with one real edit surfaces exactly that one row");
}

// --- credential routing: the apply guard's subset of the preview diff -------
// routes / hosts / auth / envKeys decide which credential is read and where
// it is sent; the host demands an explicit acknowledgement for exactly these
// rows (routes.js answers 422 without one). Everything else stays out.
{
  const routing = credentialRoutingDiff;
  assert.deepEqual(routing(SEED_CARD, changed), [], "a price-only change never gates the apply");
  const hostOnly = structuredClone(SEED_CARD);
  hostOnly.providers[0].hosts[0].base = "https://elsewhere.example/v1";
  const dHost = routing(SEED_CARD, hostOnly);
  assert.equal(dHost.length, 1, "a changed host is exactly one row");
  assert.equal(dHost[0].label, "provider:zai-coding.hosts[0].base", "…at its leaf label");
  assert.equal(dHost[0].b, "https://elsewhere.example/v1");
  const envAdded = structuredClone(SEED_CARD);
  envAdded.providers[0].envKeys.push("DEEPSEEK_API_KEY");
  const dEnv = routing(SEED_CARD, envAdded);
  assert.ok(dEnv.length >= 1 && dEnv.every((r) => r.label.startsWith("provider:zai-coding.envKeys")), "an added envKeys entry is a routing change");
  const authOnly = structuredClone(SEED_CARD);
  authOnly.providers[1].auth = "raw";
  assert.deepEqual(routing(SEED_CARD, authOnly).map((r) => r.label), ["provider:kimi-coding.auth"]);
  const routesOnly = structuredClone(SEED_CARD);
  routesOnly.providers[2].routes.push("minimax-extra");
  const claimed = `provider:minimax.routes[${routesOnly.providers[2].routes.length - 1}]`;
  assert.deepEqual(routing(SEED_CARD, routesOnly).map((r) => r.label), [claimed], "a claimed route selects another stored credential");
  const provAdded = structuredClone(SEED_CARD);
  provAdded.providers.push({ ...SEED_CARD.providers[0], id: "zai-twin", routes: ["zai-twin"] });
  const dAdded = routing(SEED_CARD, provAdded);
  assert.equal(dAdded.length, 1, "a provider added whole is one row");
  assert.equal(dAdded[0].label, "provider:zai-twin");
  assert.equal(dAdded[0].a, null, "…with no old value");
  const provRemoved = structuredClone(SEED_CARD);
  provRemoved.providers.pop();
  assert.deepEqual(routing(SEED_CARD, provRemoved), [], "a removed provider sends nothing anywhere");
  const windowOnly = structuredClone(SEED_CARD);
  windowOnly.providers[1].windows[0].windowMs = 86400000;
  assert.deepEqual(routing(SEED_CARD, windowOnly), [], "a windowMs edit is not a routing change");
  const pathOnly = structuredClone(SEED_CARD);
  pathOnly.providers[3].requests[0].path = "/inference/go/v1/usage";
  assert.deepEqual(routing(SEED_CARD, pathOnly), [], "a request path only spends the credential");
  // An id containing dots must not be split by a label pattern: the ids
  // present in the two cards decide where the id ends and the field starts.
  const dotted = structuredClone(SEED_CARD);
  dotted.providers.push({ ...SEED_CARD.providers[0], id: "a.hosts", routes: ["a-hosts"] });
  const dottedLabel = structuredClone(dotted);
  dottedLabel.providers[4].label = "renamed";
  assert.deepEqual(routing(dotted, dottedLabel), [], "a label edit under a dotted id is not routing");
  const dottedHost = structuredClone(dotted);
  dottedHost.providers[4].hosts[0].base = "https://b.example/v1";
  const dDotted = routing(dotted, dottedHost);
  assert.equal(dDotted.length, 1);
  assert.equal(dDotted[0].label, "provider:a.hosts.hosts[0].base", "the dotted id stays whole in the label");
}

// --- apply reprices history and the merge; reset restores the seed --------
const SHAPE = { miss: 1, hit: 1, out: 1 };
const rec = {
  id: "c", project: "p", subagent: false, day: "2026-11-14",
  byDay: { "2026-11-14": { input: 1e6, output: 0, cacheRead: 0, cacheWrite: 0 } },
  modelsByDay: { "2026-11-14": { "deepseek-flash": { input: 1e6, output: 0, cacheRead: 0, cacheWrite: 0 } } },
  turnsByDay: {}, toolCallsByDay: {},
};
const windowOf = () => buildView([rec], { granularity: "day", from: "2026-11-14", to: "2026-11-14", pricing: effectivePricing({}) });
assert.ok(Math.abs(windowOf().cost.total - 1) < 1e-9, "seed prices 1M flash input at ¥1");
applyCard(changed, "imported");
assert.equal(activeCard().origin, "imported");
assert.equal(officialRulesFor("2026-11-14").find((r) => r.model === "deepseek-flash").input, 2);
assert.ok(Math.abs(windowOf().cost.total - 2) < 1e-9, "a runtime card apply reprices the window without a release");

// --- fee window extension reaches a formerly-free day ----------------------
const ext = structuredClone(SEED_CARD);
ext.pricing.feeWindows[0].until = "2026-11-20T00:00:00+08:00";
applyCard(ext, "pulled");
assert.equal(activeCard().origin, "pulled");
assert.ok(auxDayUsage({ search: { peak: 1 } }, SHAPE, "2026-11-19").searchFee > 0, "extended window bills the formerly-free day");

// --- peak-scope change republishes the fold's live default; holidays flow -
const peakChanged = structuredClone(SEED_CARD);
peakChanged.pricing.peakHours = [10, 11];
applyCard(peakChanged);
assert.deepEqual([...PEAK_HOURS], [10, 11], "card peak hours republish into the fold's live default");
const holChanged = structuredClone(SEED_CARD);
holChanged.calendar.holidays.push("2026-11-16"); // a Monday
applyCard(holChanged);
assert.equal(isOffPeakDay("2026-11-16"), true, "card holidays flow into the off-peak calendar");
applyCard(provChanged);
assert.equal(PROVIDER_SPECS.find((s) => s.id === "opencode-go").requests[0].path, "/inference/go/v1/usage", "card provider specs republish live");

// --- reset returns every fact to the seed ----------------------------------
resetCard();
assert.equal(activeCard().origin, "bundled");
assert.ok(Math.abs(windowOf().cost.total - 1) < 1e-9);
assert.equal(auxDayUsage({ search: { peak: 1 } }, SHAPE, "2026-11-19").searchFee, 0);
assert.equal(isOffPeakDay("2026-11-16"), false);
assert.deepEqual([...PEAK_HOURS], [9, 10, 11, 14, 15, 16, 17]);
assert.equal(PROVIDER_SPECS.find((s) => s.id === "opencode-go").requests[0].path, "/zen/go/v1/usage");

console.log("card-test: all assertions passed");
