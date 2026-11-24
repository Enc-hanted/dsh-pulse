/**
 * Host-half integration test: mounts the plugin against stubbed harness
 * services and exercises the real `/pulse/stats` route handler, the in-flight
 * dedupe, the `/pulse/settings` settings surface (GET/POST with and without a
 * settings service), and the `/pulse` command handler end to end.
 */

import { strict as assert } from "node:assert";
import { apply, Config } from "../src/index.js";
import { localDay, pulseProjectionDefinition, PULSE_STATE_VERSION } from "../src/aggregate.js";
import { specAdapter } from "../src/quota-adapters/spec-engine.js";
import { createQuotaService } from "../src/quota-service.js";
import { displayAmount } from "../src/view.js";
import { SEED_CARD, resetCard } from "../src/pricing-facts.js";
import { VOLATILE_KEYS } from "../src/host/config-schema.js";
import { SessionProjectionCache } from "@deepseek-ai/dsh-session-projection-cache";

const DAY = 86400000;
const noon = (offsetDays) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d.getTime() + offsetDays * DAY;
};
const today = () => localDay(Date.now());
const daysAgo = (n) => localDay(noon(-n));

/** Build a fresh stubbed harness context; `withSettings` mounts a fake
 *  `settings` service whose user layer is editable through the fake scope,
 *  `withLlm` mounts a fake `llm` service serving one provider's model
 *  catalog, `seamBroken` swaps the projection cache for a wrong-shaped one
 *  (the retired pre-0.1.2 self-reading seam) to prove guardrail B fails
 *  loudly. The default cache stub is THE supported seam shape (0.1.7+:
 *  `cachedSnapshot(meta, keys)` arity 2, synchronous caller-supplied
 *  `coldSnapshot(session, cut, events)`) — the 0.2.1 floor dropped every
 *  older generation. `deferSettings` queues
 *  the inject callback instead of running it at apply time, simulating a
 *  settings service that mounts after the plugin. */
function makeCtx({ withSettings, withLlm = false, deferSettings = false, withCredentials = false, withStorageDomain = false, seamBroken = false, withQuota = false }) {
  const routes = [];
  const commands = [];
  const coldReads = [];
  const fastReads = [];
  let listCalls = 0;
  const logErrors = [];
  const logInfos = [];
  const settingsWatches = new Set();
  let registeredUnit = null;
  let registerCount = 0;
  /** Flips the stub corpus to empty, reproducing a harness that just booted
   *  with no session in the store yet. */
  let emptyCorpus = false;
  let userSection = {};
  let pendingSettingsCb = null;
  let llmSection = null;
  let balanceState = { snapshots: [] };
  let quotaState = { snapshots: [] };
  const fetchCalls = [];
  const fakeCredentials = {
    resolve: async (ref) => (String(ref) === "DEEPSEEK_API_KEY"
      ? { value: "sk-test-SECRET-value", source: "file" }
      : String(ref) === "ZAI_CODING_CN_API_KEY"
        ? { value: "zai-test-SECRET-value", source: "file" }
        : String(ref) === "KIMI_CODING_API_KEY"
          ? { value: "kimi-test-SECRET-value", source: "file" }
          : undefined),
  };
  const fakeDomain = {
    global: {
      get: () => balanceState,
      set: async (value) => { balanceState = value; },
    },
    close: async () => {},
  };
  const fakeQuotaDomain = {
    global: {
      get: () => quotaState,
      set: async (value) => { quotaState = value; },
    },
    close: async () => {},
  };
  /** The card domain's stored row (`pulse_card`): tests seed a corrupted card
   *  or flip `cardGetThrows` BEFORE apply() to exercise the boot read's
   *  fail-open posture — a storage seam must never take stats down. */
  let cardState = { card: null, origin: "bundled", savedAt: 0 };
  let cardGetThrows = false;
  const fakeCardDomain = {
    global: {
      get: () => { if (cardGetThrows) throw new Error("storage seam exploded"); return cardState; },
      set: async (value) => { cardState = value; },
    },
    close: async () => {},
  };
  const fakeStorageDomain = { open: async (spec) => (spec?.name === "pulse_quota" ? fakeQuotaDomain : spec?.name === "pulse_card" ? fakeCardDomain : fakeDomain) };

  const liveValues = {
    pulseUsage: {
      byDay: { [daysAgo(1)]: { input: 100, output: 50, cacheRead: 900, cacheWrite: 10 } },
      modelsByDay: { [daysAgo(1)]: { "deepseek-v4-flash": { input: 100, output: 50, cacheRead: 900, cacheWrite: 10 } } },
      hoursByDay: { [daysAgo(1)]: { "12": { "deepseek-v4-flash": { input: 100, output: 50, cacheRead: 900, cacheWrite: 10 } } } },
      tiersByDay: { [daysAgo(1)]: { "deepseek-v4-flash": {
        input: { peak: 0, offpeak: 100 }, output: { peak: 0, offpeak: 50 },
        cacheRead: { peak: 0, offpeak: 900 }, cacheWrite: { peak: 0, offpeak: 10 },
      } } },
      turnsByDay: { [daysAgo(1)]: 2 },
      toolCallsByDay: { [daysAgo(1)]: 3 },
      firstDay: daysAgo(1),
    },
  };
  const coldValues = {
    pulseUsage: {
      byDay: { [daysAgo(3)]: { input: 7, output: 3, cacheRead: 0, cacheWrite: 0 } },
      modelsByDay: { [daysAgo(3)]: { "deepseek-v4-pro": { input: 7, output: 3, cacheRead: 0, cacheWrite: 0 } } },
      tiersByDay: { [daysAgo(3)]: { "deepseek-v4-pro": {
        input: { peak: 7, offpeak: 0 }, output: { peak: 3, offpeak: 0 },
        cacheRead: { peak: 0, offpeak: 0 }, cacheWrite: { peak: 0, offpeak: 0 },
      } } },
      turnsByDay: { [daysAgo(3)]: 1 },
      toolCallsByDay: {},
      firstDay: daysAgo(3),
    },
  };
  /** A second cold session served straight from the cache's stored rows (the
   *  unseeded fast path) without any log read. */
  const cold2Values = {
    pulseUsage: {
      byDay: { [daysAgo(6)]: { input: 20, output: 5, cacheRead: 100, cacheWrite: 0 } },
      modelsByDay: { [daysAgo(6)]: { "pi-ai/large": { input: 20, output: 5, cacheRead: 100, cacheWrite: 0 } } },
      hoursByDay: { [daysAgo(6)]: { "09": { "pi-ai/large": { input: 20, output: 5, cacheRead: 100, cacheWrite: 0 } } } },
      tiersByDay: { [daysAgo(6)]: { "pi-ai/large": {
        input: { peak: 20, offpeak: 0 }, output: { peak: 5, offpeak: 0 },
        cacheRead: { peak: 100, offpeak: 0 }, cacheWrite: { peak: 0, offpeak: 0 },
      } } },
      turnsByDay: { [daysAgo(6)]: 1 },
      toolCallsByDay: {},
      firstDay: daysAgo(6),
    },
  };
  /** Stored checkpoint rows behind the zero-I/O `cachedSnapshot` fast path. */
  const coldRows = new Map([["cold2", cold2Values]]);

  const fakeSettings = {
    writable: true,
    get: (ns) => (ns === "llm-deepseek" ? llmSection : undefined),
    register: (ns, schema, options) => {
      assert.equal(ns, "pulse", "namespace is the plugin's own");
      return {
        get: () => ({ ...options.base, ...userSection }),
        watch: (callback) => { settingsWatches.add(callback); return () => settingsWatches.delete(callback); },
        replace: async (section) => {
          userSection = { ...section };
          for (const callback of settingsWatches) callback();
        },
        update: async (patch) => {
          userSection = { ...userSection, ...patch };
          for (const callback of settingsWatches) callback();
        },
      };
    },
  };

  /** rc.7 classic provider shape: register AND describe/update all present —
   *  the exact shape a method-presence discriminator misroutes into the
   *  SettingsForms seam (its describe lists only self-registered namespaces,
   *  so a pulse row never appears and every write dies). The structural
   *  probe (register present, arity ≥ 2) must pick the classic seam. */
  const fakeRc7Settings = {
    ...fakeSettings,
    describe: () => [
      { ns: "agent-presets", schema: { type: "object" }, value: { mode: "auto" } },
      { ns: "client-locale", schema: { type: "object" }, value: { locale: "zh" } },
    ],
    update: async (ns) => {
      throw new Error(`the classic seam must ride register()/scope.update, not provider.update (got ${ns})`);
    },
  };

  /** The 0.1.7+ SettingsForms generation: the plugin's Config lives on its
   *  loader entry; describe() carries live values plus a per-write revision,
   *  update()/replace() write the profile patch and refuse stale revisions
   *  with the stable SETTINGS_CONFLICT code. */
  const formCalls = [];
  const formRows = [{
    ns: "pulse",
    schema: Config,
    autoGenerate: true,
    value: { ...config },
    revision: 4,
  }];
  const fakeForms = {
    writable: true,
    describe: () => formRows.map((row) => ({ ...row, value: { ...row.value } })),
    update: async (ns, patch, rev) => {
      formCalls.push({ op: "update", ns, patch: { ...patch }, rev });
      const row = formRows.find((entry) => entry.ns === ns);
      if (row === undefined) throw new Error("no such entry");
      // dsh-settings lib/index.js:513-523 的语义对拍：经 forms 落盘的补丁
      // 里任何不在 VOLATILE_KEYS 的键都被拒——Config 的字段转 volatile 后
      // 这是 harness 的硬门禁（pricing 入册后此处应放行 pricing 键）。
      for (const key of Object.keys(patch)) {
        if (!VOLATILE_KEYS.includes(key)) throw new Error(`Config field "${key}" is not volatile`);
      }
      if (rev !== undefined && rev !== row.revision) {
        throw Object.assign(new Error("conflict"), { code: "SETTINGS_CONFLICT", expected: rev, actual: row.revision });
      }
      row.value = { ...row.value, ...patch };
      row.revision += 1;
    },
    replace: async (ns, section, rev) => {
      formCalls.push({ op: "replace", ns, section: { ...section }, rev });
      const row = formRows.find((entry) => entry.ns === ns);
      if (row === undefined) throw new Error("no such entry");
      for (const key of Object.keys(section)) {
        if (!VOLATILE_KEYS.includes(key)) throw new Error(`Config field "${key}" is not volatile`);
      }
      if (rev !== undefined && rev !== row.revision) {
        throw Object.assign(new Error("conflict"), { code: "SETTINGS_CONFLICT", expected: rev, actual: row.revision });
      }
      row.value = { ...section };
      row.revision += 1;
    },
  };

  /** `settings/document-updated` listeners registered by the plugin. */
  const docFeeds = new Set();

  const fakeLlm = {
    listProviders: () => [
      { id: "deepseek-official", name: "DeepSeek" },
      ...(withQuota ? [{ id: "zai-coding-cn", name: "Z.AI Coding CN" }, { id: "kimi-coding", name: "Kimi For Coding" }] : []),
    ],
    listModels: async (provider) => (provider === "deepseek-official"
      ? [
        { provider, id: "deepseek-v4-flash", name: "DeepSeek-V4-Flash" },
        { provider, id: "deepseek-v4-pro", name: "DeepSeek-V4-Pro" },
        { provider, id: "third-party-x", name: "Third Party X" },
      ]
      : provider === "zai-coding-cn"
        ? [{ provider, id: "glm-5.3", name: "GLM-5.3" }]
        : provider === "kimi-coding"
          ? [{ provider, id: "k3-256k", name: "k3-256k" }]
          : []),
  };

  const ctx = {
    sessionProjections: {
      register: (definition) => { registeredUnit = definition; registerCount += 1; return () => {}; },
      snapshot: (session) => ({ asOfSeq: 5, values: session.id === "live1" ? liveValues : {} }),
    },
    sessionQuery: {
      listSessions: async () => {
        listCalls += 1;
        return emptyCorpus
        ? []
        : [
          { header: { id: "live1", createdAt: noon(-1), cwd: "D:\\DSH\\demo" }, live: true, persisted: true },
          { header: { id: "cold1", createdAt: noon(-3), cwd: "/home/x/repo", origin: "subagent", isSeeded: true }, live: false, persisted: true },
          { header: { id: "broken1", createdAt: noon(-9), cwd: "D:\\DSH\\x", isSeeded: false }, live: false, persisted: true },
          { header: { id: "cold2", createdAt: noon(-6), cwd: "/home/x/other", isSeeded: false }, live: false, persisted: true },
        ];
      },
      readSession: async (id) => {
        if (id === "live1" || id === "cold1") {
          return {
            session: {
              id,
              createdAt: id === "live1" ? noon(-1) : noon(-3),
              cwd: id === "live1" ? "D:\\DSH\\demo" : "/home/x/repo",
              origin: id === "cold1" ? "subagent" : undefined,
              isSeeded: id === "cold1",
            },
            inheritedEventCount: id === "cold1" ? 3 : 0,
            events: id === "cold1"
              // a forked subagent: the log opens with three inherited parent
              // events (seq 0..2, below the cut of 3), then its own usage
              ? [
                { seq: 0, type: "turn/start", time: noon(-1) },
                { seq: 1, type: "assistant/message", time: noon(-1) + 1000, data: { usage: { inputTokens: 100, outputTokens: 50, cacheReadTokens: 900, cacheWriteTokens: 10 }, message: { source: { provider: "deepseek-official", model: "deepseek-v4-flash" } } } },
                { seq: 2, type: "turn/end", time: noon(-1) + 5000 },
                { seq: 3, type: "assistant/message", time: noon(-3) + 1000, data: { usage: { inputTokens: 7, outputTokens: 3, cacheReadTokens: 0, cacheWriteTokens: 0 }, message: { source: { provider: "deepseek-official", model: "deepseek-v4-pro" } } } },
              ]
              : [
                { type: "turn/start", time: noon(-1) },
                { type: "assistant/message", time: noon(-1) + 1000, data: { usage: { inputTokens: 100, outputTokens: 50, cacheReadTokens: 900, cacheWriteTokens: 10 }, message: { source: { provider: "deepseek-official", model: "deepseek-v4-flash" } } } },
                { type: "turn/end", time: noon(-1) + 5000 },
              ],
          };
        }
        throw new Error("no such session");
      },
    },
    sessions: { get: (id) => (id === "live1" ? { id } : undefined) },
    sessionProjectionCache: seamBroken === true ? {
      // A deliberately WRONG shape (the retired pre-0.1.2 self-reading seam):
      // guardrail B must flag it at apply() and the stats route must 503.
      coldSnapshot: async (id) => {
        coldReads.push({ id });
        if (id === "broken1") throw new Error("no persisted log");
        return { asOfSeq: 4, values: id === "cold2" ? cold2Values : coldValues };
      },
    } : {
      // The supported generation (0.1.7+): `cachedSnapshot(meta, keys)`
      // matches stored rows by header-borne lifecycle identity, and
      // coldSnapshot keeps the synchronous caller-supplied fold.
      cachedSnapshot: (header, keys) => {
        fastReads.push(header.id);
        if (header.isSeeded !== false) return undefined;
        if (keys !== undefined && !keys.includes("pulseUsage")) return undefined;
        const values = coldRows.get(header.id);
        return values === undefined ? undefined : { asOfSeq: 4, values };
      },
      coldSnapshot: (meta, inheritedEventCount, events) => {
        coldReads.push({ id: meta.id, cut: inheritedEventCount, events: events.length });
        if (meta.id === "broken1") throw new Error("no persisted log");
        return { asOfSeq: 4, values: coldValues };
      },
    },
    webServer: { register: (route) => { routes.push(route); return () => {}; } },
    commands: { register: (definition) => { commands.push(definition); return () => {}; } },
    get: (name) => {
      if (name === "credentials" && withCredentials) return fakeCredentials;
      if (name === "storageDomain" && withStorageDomain) return fakeStorageDomain;
      return null;
    },
    effect: (fn) => { const disposer = fn(); return () => { if (typeof disposer === "function") disposer(); }; },
    logger: { warn: () => {}, error: (m) => logErrors.push(String(m)), info: (m) => logInfos.push(String(m)) },
    inject: (deps, callback) => {
      const services = {};
      if (withSettings && Array.isArray(deps) && deps.includes("settings")) {
        services.settings = withSettings === "forms" ? fakeForms : withSettings === "rc7classic" ? fakeRc7Settings : fakeSettings;
      }
      if (withLlm && Array.isArray(deps) && deps.includes("llm")) services.llm = fakeLlm;
      if (Object.keys(services).length === 0) return undefined;
      const sub = {
        ...services,
        effect: (fn) => { const disposer = fn(); return () => { if (typeof disposer === "function") disposer(); }; },
        on: (event, callback) => {
          if (event === "settings/document-updated") {
            docFeeds.add(callback);
            return () => docFeeds.delete(callback);
          }
          return () => {};
        },
      };
      const run = () => callback(sub);
      if (deferSettings && services.settings !== undefined) {
        pendingSettingsCb = run;
        return undefined;
      }
      return run();
    },
  };

  function serve(url, { method = "GET", body, headers } = {}) {
    return new Promise((resolve) => {
      let status = 0;
      let raw = "";
      const res = {
        writeHead: (code) => { status = code; },
        end: (chunk) => { raw = chunk === undefined ? "" : String(chunk); resolve({ status, body: raw }); },
      };
      const req = { url, method, socket: { once: () => {} } };
      // headers attached only when asked: the default request stays
      // headerless, which is exactly the trusted non-browser posture the
      // same-origin guard must keep allowing.
      if (headers !== undefined) req.headers = headers;
      if (body !== undefined) req.body = typeof body === "string" ? body : JSON.stringify(body);
      routes[0].handler(req, res);
    });
  }

  return {
    ctx, routes, commands, coldReads, fastReads, logErrors, logInfos, serve,
    listCalls: () => listCalls,
    liveState: () => liveValues,
    unit: () => registeredUnit,
    registerCount: () => registerCount,
    userSection: () => userSection,
    mountSettings: () => { const cb = pendingSettingsCb; pendingSettingsCb = null; if (cb !== null) cb(); },
    setLlmSection: (section) => { llmSection = section; },
    setEmptyCorpus: (value) => { emptyCorpus = value === true; },
    listSessionsProbe: () => ctx.sessionQuery.listSessions(),
    seedCardState: (value) => { cardState = value; },
    setCardGetThrows: (value) => { cardGetThrows = value === true; },
    cardState: () => cardState,
    balanceState: () => balanceState,
    seedSnapshots: (snapshots) => { balanceState = { snapshots }; },
    quotaState: () => quotaState,
    seedQuotaSnapshots: (snapshots) => { quotaState = { snapshots }; },
    fetchCalls,
    formCalls,
    formValue: () => {
      const row = formRows.find((entry) => entry.ns === "pulse");
      return row === undefined ? null : { ...row.value };
    },
    formUpdateDirect: (ns, patch, rev) => fakeForms.update(ns, patch, rev),
    fireDocumentUpdated: (ns) => { for (const callback of [...docFeeds]) callback(ns); },
  };
}

const config = { defaultDays: 30, topProjects: 8, pricing: [] };

// --- environment without a settings service: entry config stays authoritative
{
  const env = makeCtx({ withSettings: false });
  apply(env.ctx, config);
  const fallback = JSON.parse((await env.serve("/pulse/settings")).body);
  assert.equal(fallback.writable, false, "no settings provider → not writable");
  assert.equal(fallback.costEnabled, true, "cost enabled by default");
  assert.equal(fallback.pricing.length, 2, "official defaults merged (deepseek-flash, deepseek-v4-pro)");
  assert.deepEqual(fallback.catalog, [], "no llm service → empty catalog");
  assert.deepEqual(fallback.fx, { usdToCny: 6.8 }, "default fx without config");
  const denied = JSON.parse((await env.serve("/pulse/settings", { method: "POST", body: { reset: true } })).body);
  assert.equal(denied.ok, false, "writes refused without a settings service");
  const stats = JSON.parse((await env.serve(`/pulse/stats?from=${daysAgo(4)}&to=${today()}`)).body);
  assert.equal(stats.costEnabled, true, "payload defaults to cost enabled");
  assert.deepEqual(stats.fx, { usdToCny: 6.8 }, "payload carries the fx rate");
  assert.deepEqual(stats.auxShape, { miss: 8000, hit: 1500, out: 1000, manual: false },
    "payload carries the seed aux shape for the client's self-calibration");
}

// --- classic provider that ALSO carries describe/update (the rc.7 shape) ----
// The shape the old method-presence discriminator misrouted into the
// SettingsForms seam: its describe() lists only self-registered namespaces,
// no pulse row ever appears, GET claimed writable and every POST died with a
// misleading 400. The structural probe (register present, arity ≥ 2) must
// keep this on the classic seam.
{
  const env = makeCtx({ withSettings: "rc7classic" });
  apply(env.ctx, config);
  const got = JSON.parse((await env.serve("/pulse/settings")).body);
  assert.equal(got.writable, true, "a classic provider with describe+update is still the classic seam");
  assert.equal(got.revision, undefined, "the classic seam carries no revision");
  const saved = JSON.parse((await env.serve("/pulse/settings", {
    method: "POST",
    body: { costEnabled: true, usdToCny: 7.1, pricing: [] },
  })).body);
  assert.equal(saved.ok, true, "the write rides register()'s user layer");
  assert.equal(env.userSection().usdToCny, 7.1, "the write landed in the classic user layer");
}

// --- environment with a settings service: full wiring ------------------------
const env = makeCtx({ withSettings: true, withLlm: true });
apply(env.ctx, config);

// --- the projection unit registered with the official contract --------------
assert.notEqual(env.unit(), null, "projection unit registered");
assert.equal(env.unit().key, "pulseUsage");
assert.equal(env.unit().stateVersion, PULSE_STATE_VERSION, "the fork-aware fold version at load");
assert.equal(env.registerCount(), 1, "one registration at load");
assert.deepEqual(env.unit().view(env.unit().init()), {
  byDay: {}, modelsByDay: {}, hoursByDay: {}, tiersByDay: {}, turnsByDay: {}, toolCallsByDay: {}, toolHistogramByDay: {}, auxByDay: {}, firstDay: null, title: null,
});
assert.equal(env.routes.length, 1, "/pulse route registered");
assert.equal(env.routes[0].kind, "prefix");
assert.equal(env.routes[0].path, "/pulse");
assert.equal(env.commands.length, 0,
  "no host command: the '/' menu row is a client contribution (a host command would add a second, glyph-less row)");

// --- one HTTP request through the real handler --------------------------------
const { status, body } = await env.serve(`/pulse/stats?from=${daysAgo(4)}&to=${today()}`);
assert.equal(status, 200);
const payload = JSON.parse(body);
assert.equal(payload.schema, 4);
assert.equal(payload.fromDay, daysAgo(4));
assert.equal(payload.toDay, today());
assert.equal(payload.topProjects, 8);
assert.equal(payload.costEnabled, true, "cost enabled by default");
assert.equal(payload.sessions.length, 2, "broken session skipped, never fatal");
assert.equal(payload.corpusSessions, 4, "the whole corpus is counted, not just the window");
const live = payload.sessions.find((s) => s.id === "live1");
const cold = payload.sessions.find((s) => s.id === "cold1");
assert.equal(live.project, "demo");
assert.equal(live.day, daysAgo(1));
assert.deepEqual(live.byDay[daysAgo(1)], { input: 100, output: 50, cacheRead: 900, cacheWrite: 10 });
assert.deepEqual(live.hoursByDay[daysAgo(1)]["12"]["deepseek-v4-flash"], { input: 100, output: 50, cacheRead: 900, cacheWrite: 10 });
assert.deepEqual(live.tiersByDay, {
  [daysAgo(1)]: { "deepseek-v4-flash": {
    input: { peak: 0, offpeak: 100 }, output: { peak: 0, offpeak: 50 },
    cacheRead: { peak: 0, offpeak: 900 }, cacheWrite: { peak: 0, offpeak: 10 },
  } },
}, "tier splits ride the payload");
assert.equal(cold.subagent, true);
assert.equal(cold.project, "repo");
assert.equal(cold.day, daysAgo(3));
assert.deepEqual(cold.turnsByDay, { [daysAgo(3)]: 1 });
// the read ladder: seeded cold1 skipped its zero-I/O fast path (unknown
// cut) and folded from the readSession body, which arrived with its exact
// inherited cut and complete log
assert.deepEqual(env.fastReads, ["broken1", "cold2"], "only unseeded headers touch the fast path");
assert.deepEqual(env.coldReads[0], { id: "cold1", cut: 3, events: 4 }, "coldSnapshot receives the loaded header, cut and log");

// the unseeded cold session comes straight from the stored rows — no log read
const wide = JSON.parse((await env.serve("/pulse/stats?days=8")).body);
assert.equal(wide.sessions.length, 3, "fast-path session joins the window");
const cold2 = wide.sessions.find((s) => s.id === "cold2");
assert.equal(cold2.project, "other");
assert.equal(cold2.day, daysAgo(6));
assert.deepEqual(cold2.byDay[daysAgo(6)], { input: 20, output: 5, cacheRead: 100, cacheWrite: 0 });

// --- settings surface ----------------------------------------------------------
const settings = JSON.parse((await env.serve("/pulse/settings")).body);
assert.equal(settings.writable, true);
assert.equal(settings.costEnabled, true);
assert.equal(settings.pricing.length, 2, "official defaults merged into the editor");
assert.equal(settings.pricing[0].model, "deepseek-flash");
assert.equal(settings.pricing[0].input, 1, "the official Flash off-peak miss rate");
assert.equal(settings.pricing[0].cacheRead, 0.02, "the official Flash cache-hit rate");
assert.equal(settings.pricing[0].peak.input, 2, "peak rates ride along");
assert.deepEqual(settings.pricing[0].peakHours, [9, 10, 11, 14, 15, 16, 17], "normalized peak hours ride along");
assert.equal(settings.pricing[0].weekdaysOnly, true, "the official peak windows are weekdays only");
assert.deepEqual(settings.fx, { usdToCny: 6.8 }, "default fx served to the editor");
assert.equal(settings.displayCurrency, "CNY", "default display currency served to the editor");
assert.equal(settings.official.length, 2, "untouched official baseline served for per-row restore");
assert.equal(settings.official[0].model, "deepseek-flash");
assert.equal(settings.catalog.length, 1, "one provider group from the llm service");
assert.equal(settings.catalog[0].displayName, "DeepSeek");
assert.equal(settings.catalog[0].models.length, 3);
assert.equal(settings.catalog[0].models[2].id, "third-party-x");

// saving a user pricing list persists and flips the effective config —
// displayCurrency rides along: the patch mapping once dropped it, so every
// write "succeeded" while the stored config stayed CNY (faces never flipped)
const saved = JSON.parse((await env.serve("/pulse/settings", {
  method: "POST",
  body: { costEnabled: false, usdToCny: 7.05, displayCurrency: "USD", pricing: [{ model: "my-model", input: 9, output: 18 }] },
})).body);
assert.equal(saved.ok, true);
assert.equal(saved.refold, false, "price-only save predicts no re-fold");
assert.deepEqual(env.userSection(), {
  costEnabled: false,
  usdToCny: 7.05,
  displayCurrency: "USD",
  pricing: [{ model: "my-model", input: 9, output: 18 }],
}, "user layer replaced wholesale");
const after = JSON.parse((await env.serve("/pulse/settings")).body);
assert.equal(after.costEnabled, false);
assert.equal(after.fx.usdToCny, 7.05, "edited fx served back");
assert.equal(after.displayCurrency, "USD", "the flipped display currency is served back");
assert.equal(after.pricing.length, 3, "user rule joins the official defaults");
assert.equal(after.pricing[2].model, "my-model");
assert.equal(after.pricing[2].input, 9);
assert.equal(env.registerCount(), 1, "price-only edits never re-register the projection");

// the stats payload reflects the persisted flags (payload cache invalidated)
const flipped = JSON.parse((await env.serve(`/pulse/stats?from=${daysAgo(4)}&to=${today()}`)).body);
assert.equal(flipped.costEnabled, false, "disabled flag served after save");
assert.equal(flipped.displayCurrency, "USD", "display currency reaches the stats payload after save");

// a flat rule without peak keeps working through the editor
const flat = JSON.parse((await env.serve("/pulse/settings", {
  method: "POST",
  body: { costEnabled: true, pricing: [{ model: "third-party", input: 1, cacheRead: 0.1, output: 2, currency: "USD" }] },
})).body);
assert.equal(flat.ok, true);
assert.equal(env.registerCount(), 1, "a flat USD rule still needs no re-fold");

// a peak-hours change re-registers the projection at a bumped state version
// and warms the re-folded caches in the background
const coldReadsBefore = env.coldReads.length;
const peakChange = JSON.parse((await env.serve("/pulse/settings", {
  method: "POST",
  body: {
    costEnabled: true,
    pricing: [{ model: "third-party", input: 1, output: 2, peakHours: [10, 11] }],
  },
})).body);
assert.equal(peakChange.ok, true);
assert.equal(peakChange.refold, true, "peak-hours save predicts a re-fold");
assert.equal(env.registerCount(), 2, "peak-hours change re-registers the projection");
assert.equal(env.unit().stateVersion, PULSE_STATE_VERSION + 1, "bumped state version invalidates persisted rows");
await new Promise((resolve) => setTimeout(resolve, 20));
assert.ok(env.coldReads.length > coldReadsBefore, "background warm-up re-folds the cold corpus");
// ...and the shared projections died with the old tier split: the next NEW
// window re-reads the persisted corpus instead of reusing pre-change rows.
{
  const readsAfterWarm = env.coldReads.length + env.fastReads.length;
  JSON.parse((await env.serve(`/pulse/stats?from=${daysAgo(2)}&to=${today()}`)).body);
  assert.ok(env.coldReads.length + env.fastReads.length > readsAfterWarm, "a projection re-register drops the shared projections");
}

// an explicitly empty hour set is a legal flat override (not the official default)
const flatHours = JSON.parse((await env.serve("/pulse/settings", {
  method: "POST",
  body: {
    costEnabled: true,
    pricing: [{ model: "third-party", input: 1, output: 2, peakHours: [] }],
  },
})).body);
assert.equal(flatHours.ok, true);
assert.equal(flatHours.refold, true, "empty hours differ from the previous custom set");
const flatEcho = JSON.parse((await env.serve("/pulse/settings")).body);
assert.deepEqual(flatEcho.pricing.find((rule) => rule.model === "third-party").peakHours, [], "explicit flat survives the round trip");

// reset re-inherits base + defaults
const reset = JSON.parse((await env.serve("/pulse/settings", { method: "POST", body: { reset: true } })).body);
assert.equal(reset.ok, true);
assert.equal(reset.refold, true, "reset drops the flat override → back to official windows");
assert.deepEqual(env.userSection(), {}, "reset clears the user layer");
const resetSettings = JSON.parse((await env.serve("/pulse/settings")).body);
assert.equal(resetSettings.costEnabled, true);
assert.equal(resetSettings.pricing.length, 2, "official defaults back");
assert.deepEqual(resetSettings.fx, { usdToCny: 6.8 }, "fx re-inherits the default");
assert.equal(env.registerCount(), 4, "reset drops the custom hours → re-fold back to official");
assert.equal(env.unit().stateVersion, PULSE_STATE_VERSION + 3);

// a provider-scoped rule coexists with the wildcard official default: same
// model id, two effective rules, and the provider survives the round trip
const scoped = JSON.parse((await env.serve("/pulse/settings", {
  method: "POST",
  body: { costEnabled: true, pricing: [{ provider: "pi-ai", model: "deepseek-v4-flash", input: 2, output: 4 }] },
})).body);
assert.equal(scoped.ok, true);
assert.equal(scoped.refold, false, "a flat provider rule needs no re-fold");
const scopedEcho = JSON.parse((await env.serve("/pulse/settings")).body);
assert.equal(scopedEcho.pricing.length, 3, "provider rule joins the official defaults");
const scopedRule = scopedEcho.pricing.find((rule) => rule.provider === "pi-ai");
// A provider-scoped id is used verbatim: aliasing is an official-channel
// concern, and a reseller's retired id must price under the id it reports.
assert.equal(scopedRule.model, "deepseek-v4-flash");
assert.equal(scopedRule.input, 2);
// The provider-less rule for that retired id is promoted onto the current
// Flash row instead of shadowing it with a stale rate.
const official = scopedEcho.pricing.find((rule) => rule.model === "deepseek-flash" && (rule.provider ?? "") === "");
assert.equal(official.input, 1, "wildcard official default untouched by the scoped rule");
assert.equal(scopedEcho.pricing.some((rule) => rule.model === "deepseek-v4-flash" && (rule.provider ?? "") === ""), false, "no stale alias row");
assert.equal(env.registerCount(), 4, "its peak hours are the official ones → no re-registration");
// a scoped rule with custom peak hours does re-register (fold key is composite)
const scopedPeak = JSON.parse((await env.serve("/pulse/settings", {
  method: "POST",
  body: { costEnabled: true, pricing: [{ provider: "pi-ai", model: "deepseek-v4-flash", input: 2, output: 4, peakHours: [10, 11] }] },
})).body);
assert.equal(scopedPeak.refold, true, "provider-scoped peak hours differ from official → re-fold");
assert.equal(env.registerCount(), 5, "scoped peak-hours change re-registers the projection");

// a monthly-paid provider list persists, serves back and rides the stats payload
assert.deepEqual((JSON.parse((await env.serve("/pulse/settings")).body)).monthly, [], "no monthly providers by default");
const monthlySave = JSON.parse((await env.serve("/pulse/settings", {
  method: "POST",
  body: { costEnabled: true, monthly: ["pi-ai"] },
})).body);
assert.equal(monthlySave.ok, true);
assert.equal(monthlySave.refold, false, "monthly list never re-folds history");
assert.deepEqual(env.userSection().monthlyProviders, ["pi-ai"], "monthly list persisted under the provider key");
assert.deepEqual((JSON.parse((await env.serve("/pulse/settings")).body)).monthly, ["pi-ai"], "monthly served back to the editor");
const monthlyStats = JSON.parse((await env.serve(`/pulse/stats?from=${daysAgo(4)}&to=${today()}`)).body);
assert.deepEqual(monthlyStats.monthly, ["pi-ai"], "stats payload carries the monthly list");
// currency saves leave the monthly list untouched (partial merge)
const currencyOnly = JSON.parse((await env.serve("/pulse/settings", {
  method: "POST",
  body: { currency: "USD", usdToCny: 7.1 },
})).body);
assert.equal(currencyOnly.ok, true);
assert.deepEqual(env.userSection().monthlyProviders, ["pi-ai"], "partial merge keeps the monthly list");
assert.deepEqual(env.userSection().currency, "USD", "and applies the currency edit");

// the manual aux shape persists through the classic seam: a partial object
// fills from the seed and stays flagged manual; clearing returns to auto
const shapeSave = JSON.parse((await env.serve("/pulse/settings", {
  method: "POST",
  body: { searchShape: { miss: 9000, junk: 1e9, out: -1 } },
})).body);
assert.equal(shapeSave.ok, true);
assert.deepEqual(env.userSection().searchShape, { miss: 9000 }, "the shape patch is sanitized on the classic path too");
const shapeStats = JSON.parse((await env.serve(`/pulse/stats?from=${daysAgo(4)}&to=${today()}`)).body);
assert.deepEqual(shapeStats.auxShape, { miss: 9000, hit: 1500, out: 1000, manual: true }, "missing keys fill from the seed, still manual");
await env.serve("/pulse/settings", { method: "POST", body: { searchShape: {} } });
const shapeCleared = JSON.parse((await env.serve(`/pulse/stats?from=${daysAgo(4)}&to=${today()}`)).body);
assert.deepEqual(shapeCleared.auxShape, { miss: 8000, hit: 1500, out: 1000, manual: false }, "an empty shape returns to the auto seed");

// invalid writes are refused
const bad = JSON.parse((await env.serve("/pulse/settings", { method: "POST", body: { costEnabled: "yes" } })).body);
assert.equal(bad.ok, false, "non-boolean costEnabled refused");
const badPricing = JSON.parse((await env.serve("/pulse/settings", { method: "POST", body: { pricing: [{ model: "x", input: "NaN" }] } })).body);
assert.equal(badPricing.ok, false, "non-numeric rate refused");
const notJson = JSON.parse((await env.serve("/pulse/settings", { method: "POST", body: "{oops" })).body);
assert.equal(notJson.ok, false, "malformed JSON refused");
assert.equal((await env.serve("/pulse/settings", { method: "PUT" })).status, 405);

// window slicing: a range before the cold session's activity drops it
const narrow = JSON.parse((await env.serve(`/pulse/stats?from=${daysAgo(2)}&to=${today()}`)).body);
assert.equal(narrow.sessions.length, 1);
assert.equal(narrow.sessions[0].id, "live1");

// invalid bounds fall back to the configured default window
const fallback = JSON.parse((await env.serve(`/pulse/stats?from=banana&to=${today()}`)).body);
assert.equal(fallback.fromDay, localDay(noon(-29)));
assert.equal(fallback.toDay, today());

// `?days=` stays accepted for backward compatibility
const legacy = JSON.parse((await env.serve("/pulse/stats?days=7")).body);
assert.equal(legacy.fromDay, localDay(noon(-6)));

// non-JSON paths 404
assert.equal((await env.serve("/pulse/other")).status, 404);

// --- in-flight dedupe: concurrent identical windows share one cold read -------
const before = env.coldReads.length;
const [a, b] = await Promise.all([
  env.serve(`/pulse/stats?from=${daysAgo(4)}&to=${today()}`),
  env.serve(`/pulse/stats?from=${daysAgo(4)}&to=${today()}`),
]);
assert.equal(JSON.parse(a.body).schema, 4);
assert.equal(JSON.parse(b.body).schema, 4);
assert.ok(env.coldReads.length <= before + 3, "shared flight reads the cold corpus once");

// --- the shared projection pass: a second window within the TTL reuses the
// persisted reads; live sessions stay fresh; one listing serves key + fold ---
{
  const shared = makeCtx({ withSettings: false });
  apply(shared.ctx, config);
  const reads = () => shared.coldReads.length + shared.fastReads.length;
  const narrow = JSON.parse((await shared.serve(`/pulse/stats?from=${daysAgo(1)}&to=${today()}`)).body);
  assert.deepEqual(narrow.sessions.map((s) => s.id), ["live1"], "window A holds the live session's day only");
  assert.equal(shared.listCalls(), 1, "ONE listing serves the cache key AND the fold");
  const paid = reads();
  assert.equal(paid, 3, "window A pays every persisted read once (1 body + 2 stored rows)");
  // The live session moves before window B is requested: its in-memory
  // snapshot must be part of window B — live sessions are never cached.
  const live = shared.liveState().pulseUsage;
  live.byDay[daysAgo(2)] = { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 };
  live.modelsByDay[daysAgo(2)] = { "deepseek-v4-flash": { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 } };
  live.firstDay = daysAgo(2);
  const wide = JSON.parse((await shared.serve(`/pulse/stats?from=${daysAgo(8)}&to=${today()}`)).body);
  assert.equal(reads(), paid, "window B within the TTL reuses window A's persisted projections");
  assert.deepEqual(wide.sessions.map((s) => s.id).sort(), ["cold1", "cold2", "live1"], "window B still folds every session");
  assert.deepEqual(wide.sessions.find((s) => s.id === "live1").byDay[daysAgo(2)], { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 },
    "a live session is re-read at fold time, never cached");
  assert.equal(shared.listCalls(), 2, "each request lists the corpus exactly once");
  // The corpus count is the generation key: a changed corpus re-projects.
  shared.setEmptyCorpus(true);
  const empty = JSON.parse((await shared.serve(`/pulse/stats?from=${daysAgo(9)}&to=${today()}`)).body);
  assert.equal(empty.sessions.length, 0, "the emptied corpus folds to an empty window");
  assert.equal(reads(), paid, "an empty corpus has nothing to read");
  shared.setEmptyCorpus(false);
  JSON.parse((await shared.serve(`/pulse/stats?from=${daysAgo(9)}&to=${today()}`)).body);
  assert.equal(reads(), paid * 2, "a corpus that changed count re-projects every persisted session");
}
// Rapid switching: two different windows folding together share ONE pass.
{
  const racing = makeCtx({ withSettings: false });
  apply(racing.ctx, config);
  await Promise.all([
    racing.serve(`/pulse/stats?from=${daysAgo(4)}&to=${today()}`),
    racing.serve(`/pulse/stats?from=${daysAgo(9)}&to=${today()}`),
  ]);
  assert.equal(racing.coldReads.length, 1, "two windows folding together share one body read");
  assert.equal(racing.fastReads.length, 2, "...and one stored-row pass");
  assert.equal(racing.listCalls(), 2, "each request still lists once");
}

// --- an empty fold is never sticky -------------------------------------------
// A harness that just booted lists no session until its first message commits.
// That empty window must not be pinned by the payload TTL cache: the very next
// request, after the session lands, has to fold and report it.
{
  const boot = makeCtx({ withSettings: false });
  apply(boot.ctx, config);
  boot.setEmptyCorpus(true);
  const window = `from=${daysAgo(2)}&to=${today()}`;
  const cold = JSON.parse((await boot.serve(`/pulse/stats?${window}`)).body);
  assert.equal(cold.sessions.length, 0, "boot-time fold reports an empty window");
  assert.equal(cold.corpusSessions, 0, "the corpus itself is reported empty");
  boot.setEmptyCorpus(false);
  const warm = JSON.parse((await boot.serve(`/pulse/stats?${window}`)).body);
  assert.ok(warm.sessions.length > 0, "the same window re-folds once sessions exist");
  assert.ok(warm.corpusSessions > 0, "the corpus count follows the store");
  // A non-empty payload IS cached: the second read must not re-fold the corpus.
  const readsBefore = boot.coldReads.length + boot.fastReads.length;
  const again = JSON.parse((await boot.serve(`/pulse/stats?${window}`)).body);
  assert.equal(again.sessions.length, warm.sessions.length, "cached window serves the same records");
  assert.equal(boot.coldReads.length + boot.fastReads.length, readsBefore, "non-empty windows stay cached for the TTL");
}

// --- the update check: click-only, registry-backed ---------------------------
{
  const realFetch = globalThis.fetch;
  const calls = [];
  try {
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), method: init?.method ?? "GET" });
      return {
        ok: true, status: 200,
        json: async () => ({ "dist-tags": { latest: "0.6.0" }, time: { "0.6.0": "2026-10-01T00:00:00.000Z" } }),
      };
    };
    const checked = JSON.parse((await env.serve("/pulse/update-check")).body);
    assert.equal(checked.ok, true);
    assert.equal(checked.latest, "0.6.0");
    assert.equal(checked.publishedAt, "2026-10-01T00:00:00.000Z");
    const registryCalls = calls.filter((c) => c.url.includes("registry.npmjs.org"));
    assert.equal(registryCalls.length, 1, "exactly one registry call per request");
    assert.ok(registryCalls[0].url.includes("dsh-pulse"), `registry lookup names the package: ${registryCalls[0].url}`);
    assert.ok(calls.length <= 2, "at most one extra best-effort card probe alongside the registry call");

    globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
    const failed = JSON.parse((await env.serve("/pulse/update-check")).body);
    assert.equal(failed.ok, false, "a registry failure is reported as data, not an HTTP error");
    assert.ok(String(failed.error).includes("503"), `failure carries the reason: ${failed.error}`);

    const wrongMethod = await env.serve("/pulse/update-check", { method: "POST" });
    assert.equal(wrongMethod.status, 405, "the check is a read-only GET");
  } finally {
    globalThis.fetch = realFetch;
  }
}

// --- pricing 转 volatile：forms 代际 POST 一条 pricing 规则，落盘成功且
// 峰时签名变化时 fold epoch 变化（无需 entry 重启这个旧边界）--------------
{
  const env = makeCtx({ withSettings: "forms" });
  // 模拟 0.1.7+ 的 volatile 接线：entry config 的 pricing 是 live ref，
  // .get() 读 forms 行的当前值——pricing 入册 VOLATILE_KEYS 后 harness
  // 正是这样把字段交给 apply 的。
  const livePricing = { get: () => env.formValue().pricing };
  apply(env.ctx, { ...config, pricing: livePricing });
  assert.equal(env.registerCount(), 1, "官方峰时默认 → 一次注册");
  const saved = JSON.parse((await env.serve("/pulse/settings", {
    method: "POST",
    body: { pricing: [{ model: "deepseek-v4-flash", input: 1, output: 4, peakHours: [2, 3] }] },
  })).body);
  assert.equal(saved.ok, true, "forms 代际的 pricing POST 落盘成功");
  assert.equal(saved.refold, true, "峰时变化被 predictRefold 预报");
  assert.ok(env.formCalls.some((c) => c.op === "update" && "pricing" in c.patch), "patch 里带着 pricing 键（未被 volatile 门禁拒收）");
  // 非易变键走不到 HTTP 面，直接对拍 dsh-settings 的门禁语义：
  await assert.rejects(() => env.formUpdateDirect("pulse", { pricingCardSource: "https://x/card.json" }),
    /Config field "pricingCardSource" is not volatile/, "非 volatile 键被 forms 门禁拒绝");
  // settings/document-updated → onSettingsChanged：签名变化 → epoch 重折叠
  env.fireDocumentUpdated("pulse");
  assert.equal(env.registerCount(), 2, "峰时签名变化 → projection 重注册（fold epoch 变化）");
  // 纯价格变化（峰时不变）不再触发重折叠
  const priceOnly = JSON.parse((await env.serve("/pulse/settings", {
    method: "POST",
    body: { pricing: [{ model: "deepseek-v4-flash", input: 2, output: 8, peakHours: [2, 3] }] },
  })).body);
  assert.equal(priceOnly.ok, true);
  assert.equal(priceOnly.refold, false, "纯价格变化无需 refold");
  env.fireDocumentUpdated("pulse");
  assert.equal(env.registerCount(), 2, "价格-only 编辑不重注册");
}

// --- settings service mounting after the plugin: routes stay live ------------
// Runs last: the module-level stats cache is shared across environments, so
// this env's own writes must be the freshest mutations of its window.
{
  const env = makeCtx({ withSettings: true, deferSettings: true });
  apply(env.ctx, config);
  const before = JSON.parse((await env.serve("/pulse/settings")).body);
  assert.equal(before.writable, false, "entry config authoritative before the service mounts");
  env.mountSettings();
  const after = JSON.parse((await env.serve("/pulse/settings")).body);
  assert.equal(after.writable, true, "settings surface comes alive on late mount");
  const posted = JSON.parse((await env.serve("/pulse/settings", {
    method: "POST",
    body: { costEnabled: false, pricing: [] },
  })).body);
  assert.equal(posted.ok, true, "writes work after late mount");
  const flipped = JSON.parse((await env.serve(`/pulse/stats?from=${daysAgo(4)}&to=${today()}`)).body);
  assert.equal(flipped.costEnabled, false, "late-mounted scope drives the stats payload");
}

// --- DeepSeek official balance: seam, cache, snapshots, security -------------
{
  const env = makeCtx({ withSettings: true, withCredentials: true, withStorageDomain: true, withLlm: true });
  apply(env.ctx, config);
  const realFetch = globalThis.fetch;
  let fetchCount = 0;
  globalThis.fetch = async (url, init) => {
    fetchCount += 1;
    env.fetchCalls.push({ url: String(url), init });
    return {
      ok: true,
      status: 200,
      json: async () => ({ is_available: true, balance_infos: [{ currency: "CNY", total_balance: "58.20", granted_balance: "8.20", topped_up_balance: "50.00" }] }),
    };
  };
  try {
    const first = JSON.parse((await env.serve("/pulse/balance")).body);
    assert.equal(first.configured, true);
    assert.equal(first.ok, true);
    assert.equal(first.total, 58.2);
    assert.equal(first.granted, 8.2);
    assert.equal(first.topped, 50);
    assert.equal(first.isAvailable, true);
    // security regression: the secret never rides a response body
    assert.ok(!JSON.stringify(first).includes("sk-test-SECRET-value"));
    // outbound hygiene: bearer header only, redirects refused, official URL
    assert.equal(env.fetchCalls[0].init.headers.authorization, "Bearer sk-test-SECRET-value");
    assert.equal(env.fetchCalls[0].init.redirect, "error");
    assert.equal(env.fetchCalls[0].url, "https://api.deepseek.com/user/balance");
    // one rolling snapshot of money only
    assert.equal(env.balanceState().snapshots.length, 1);
    assert.equal(env.balanceState().snapshots[0].total, 58.2);
    // the TTL cache serves repeats without another outbound call
    const cached = JSON.parse((await env.serve("/pulse/balance")).body);
    assert.equal(cached.cached, true);
    assert.equal(fetchCount, 1);
    // ?refresh=1 bypasses the cache; identical readings dedupe the snapshot
    await env.serve("/pulse/balance?refresh=1");
    assert.equal(fetchCount, 2);
    assert.equal(env.balanceState().snapshots.length, 1, "5-minute dedupe collapses identical readings");
    // provider overrides from the adapter's settings namespace win
    env.setLlmSection({ baseURL: "https://proxy.example.com/v1" });
    await env.serve("/pulse/balance?refresh=1");
    assert.equal(env.fetchCalls[2].url, "https://proxy.example.com/v1/user/balance");
    assert.equal(env.fetchCalls[2].init.headers.authorization, "Bearer sk-test-SECRET-value");
    // a custom ref that resolves to nothing reports unconfigured without any call
    env.setLlmSection({ apiKeyEnv: "MY_DEEPSEEK_KEY" });
    const unref = JSON.parse((await env.serve("/pulse/balance?refresh=1")).body);
    assert.equal(unref.configured, false);
    assert.equal(unref.ref, "MY_DEEPSEEK_KEY");
    assert.equal(fetchCount, 3, "unresolved ref short-circuits before fetching");
    // a non-HTTP override keeps the official endpoint
    env.setLlmSection({ baseURL: "ftp://evil.example.com" });
    await env.serve("/pulse/balance?refresh=1");
    assert.equal(env.fetchCalls[3].url, "https://api.deepseek.com/user/balance");
    // failures map to a generic cause code — never the key, never the URL
    env.setLlmSection(null);
    globalThis.fetch = async () => { throw Object.assign(new Error("connect boom"), { cause: { code: "ENOTFOUND" } }); };
    const failed = JSON.parse((await env.serve("/pulse/balance?refresh=1")).body);
    assert.equal(failed.ok, false);
    assert.equal(failed.error, "ENOTFOUND");
    assert.ok(!JSON.stringify(failed).includes("sk-test-SECRET-value"));
    // seeded history flows into the stats payload as the reconciliation series
    env.seedSnapshots([
      { t: noon(-2), total: 61 },
      { t: noon(-1), total: 60 },
      { t: Date.now(), total: 58.2 },
    ]);
    const payload = JSON.parse((await env.serve(`/pulse/stats?from=${daysAgo(3)}&to=${today()}`)).body);
    assert.equal(Array.isArray(payload.balanceSeries), true);
    assert.deepEqual(payload.balanceSeries.map((d) => d.spend), [null, null, 1, 1.8]);
  } finally {
    globalThis.fetch = realFetch;
  }
}
// without a credentials service the card simply stays hidden
{
  const env = makeCtx({ withSettings: false });
  apply(env.ctx, config);
  const bare = JSON.parse((await env.serve("/pulse/balance")).body);
  assert.equal(bare.configured, false);
  assert.equal("ref" in bare, false);
}

// --- /pulse/quota: subscription adapters, credentials, snapshots, settings ---
{
  const env = makeCtx({ withSettings: "forms", withLlm: true, withCredentials: true, withStorageDomain: true, withQuota: true });
  const quotaConfig = { ...config, quotaOff: [] };
  apply(env.ctx, quotaConfig);
  const realFetch = globalThis.fetch;
  let fetchCount = 0;
  try {
    globalThis.fetch = async (url, init) => {
      fetchCount += 1;
      const target = String(url);
      env.fetchCalls.push({ url: target, init });
      if (target === "https://open.bigmodel.cn/api/monitor/usage/quota/limit") {
        assert.equal(init.headers.authorization, "Bearer zai-test-SECRET-value");
        return { ok: true, status: 200, json: async () => ({
          code: 200,
          data: {
            level: "pro",
            limits: [
              { type: "TIME_LIMIT", unit: 5, number: 1, usage: 1000, currentValue: 92, percentage: 9, nextResetTime: 1792305793995 },
              { type: "TOKENS_LIMIT", unit: 3, number: 5, percentage: 8, nextResetTime: 1790659044728 },
              { type: "TOKENS_LIMIT", unit: 6, number: 1, percentage: 14, nextResetTime: 1791163910973 },
            ],
          },
          success: true,
        }) };
      }
      if (target === "https://open.bigmodel.cn/api/biz/subscription/list") {
        return { ok: true, status: 200, json: async () => ({
          code: 200,
          data: [{ status: "VALID", productName: "GLM Coding Pro", billingCycle: "annually", actualPrice: 1251.6, nextRenewTime: "2027-06-18" }],
          success: true,
        }) };
      }
      if (target === "https://api.kimi.com/coding/v1/usages") {
        assert.equal(init.headers.authorization, "Bearer kimi-test-SECRET-value");
        return { ok: true, status: 200, json: async () => ({
          usage: { limit: "100", used: "16", remaining: "84", resetTime: "2026-10-05T02:07:46.635557Z" },
          limits: [{ window: { duration: 300, timeUnit: "TIME_UNIT_MINUTE" }, detail: { limit: "100", remaining: "100", resetTime: "2026-09-29T03:07:46.635557Z" } }],
          usages: { limit_5h: { used_ratio: 0, reset_time: "2026-09-29T03:07:46Z" }, limit_7d: { used_ratio: 0.159929, reset_time: "2026-10-05T02:07:46Z" } },
        }) };
      }
      throw new Error(`unexpected quota fetch ${target}`);
    };
    const body = JSON.parse((await env.serve("/pulse/quota")).body);
    assert.equal(body.schema, 1);
    assert.equal(body.providers.length, 2, "only adapter-backed catalog routes are queried");
    const zai = body.providers.find((p) => p.provider === "zai-coding-cn");
    assert.equal(zai.ok, true);
    assert.equal(zai.plan.name, "GLM Coding Pro");
    assert.equal(zai.plan.level, "pro");
    assert.deepEqual(zai.plan.renewsAt, "2027-06-18");
    assert.equal(zai.fee.amount, 1251.6);
    assert.equal(zai.fee.cycle, "annually");
    assert.deepEqual(zai.windows.map((w) => w.id), ["5h", "7d"], "windows sort shortest-first");
    assert.equal(zai.windows[0].usedPct, 8);
    assert.equal(zai.windows[1].usedPct, 14);
    assert.equal(zai.windows[0].resetsAt, 1790659044728);
    assert.equal(zai.extras.length, 1, "TIME_LIMIT lands as a tool-quota extra");
    assert.equal(zai.extras[0].used, 92);
    assert.equal(zai.extras[0].total, 1000);
    const kimi = body.providers.find((p) => p.provider === "kimi-coding");
    assert.equal(kimi.ok, true);
    // Percentages only: the ratio endpoints never become "x/100 次" counts.
    // The 5h ratio window is back as a row (pct-only) beside the weekly one;
    // the legacy flat usage object keeps 7d precedence over limit_7d.
    assert.deepEqual(kimi.windows.map((w) => w.id), ["5h", "7d"], "windows sort shortest-first");
    for (const window of kimi.windows) {
      assert.equal(window.used, null, "no fabricated counts on ratio windows");
      assert.equal(window.total, null);
    }
    assert.equal(kimi.windows[0].usedPct, 0, "the untouched 5h ratio still renders its track");
    assert.equal(Math.round(kimi.windows[1].usedPct), 16, "the weekly ratio carries the percentage");
    assert.ok(kimi.windows[1].resetsAt > 0, "over-long ISO fractional seconds parse");
    // every successful query records utilization points — percentages only
    const snaps = env.quotaState().snapshots;
    assert.equal(snaps.filter((s) => s.provider === "zai-coding-cn").length, 2, "one point per window");
    assert.equal(snaps.filter((s) => s.provider === "kimi-coding").length, 2, "one point per window");
    assert.equal(JSON.stringify(snaps).includes("SECRET"), false, "no credential material lands in the store");
    assert.equal(JSON.stringify(body).includes("SECRET"), false, "no credential material in the reply");
    // the reply caches; ?refresh=1 bypasses
    const cached = JSON.parse((await env.serve("/pulse/quota")).body);
    assert.equal(fetchCount, 3, "cache serves the repeat without refetching (zai quota+subscription, kimi usages)");
    assert.equal(cached.cached, true);
    await env.serve("/pulse/quota?refresh=1");
    assert.equal(fetchCount, 6, "refresh re-fetches every provider");
    // a failing provider stays uncached and reports a generic reason
    globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
    const failed = JSON.parse((await env.serve("/pulse/quota?refresh=1")).body);
    assert.equal(failed.providers.every((p) => p.ok === false), true);
    assert.equal(failed.providers[0].error, "HTTP 401");
    // settings GET/POST carry the quotaOff list
    const settings = JSON.parse((await env.serve("/pulse/settings")).body);
    assert.deepEqual(settings.quotaOff, []);
    const post = await env.serve("/pulse/settings", { method: "POST", body: { quotaOff: ["kimi-coding"], revision: settings.revision } });
    assert.equal(JSON.parse(post.body).ok, true);
    const quotaCall = env.formCalls[env.formCalls.length - 1];
    assert.equal(quotaCall.op, "update");
    assert.deepEqual(quotaCall.patch, { quotaOff: ["kimi-coding"] }, "the toggle writes the quotaOff list through the entry config");
    // A real 0.1.7+ host commits the volatile field into the live config the
    // fiber reads; simulate that commit in place (no re-apply).
    quotaConfig.quotaOff = ["kimi-coding"];
    // a disabled route reports itself without fetching
    globalThis.fetch = async (url, init) => {
      fetchCount += 1;
      const target = String(url);
      env.fetchCalls.push({ url: target, init });
      if (target === "https://open.bigmodel.cn/api/monitor/usage/quota/limit") return { ok: true, status: 200, json: async () => ({ code: 200, data: { limits: [{ type: "TOKENS_LIMIT", unit: 3, number: 5, percentage: 8, nextResetTime: 1790659044728 }] }, success: true }) };
      if (target === "https://open.bigmodel.cn/api/biz/subscription/list") return { ok: true, status: 200, json: async () => ({ code: 200, data: [], success: true }) };
      throw new Error(`unexpected quota fetch ${target}`);
    };
    fetchCount = 0;
    env.fetchCalls.length = 0;
    const half = JSON.parse((await env.serve("/pulse/quota?refresh=1")).body);
    assert.equal(fetchCount, 2, "the disabled route is never fetched (zai sub + quota only)");
    const offRow = half.providers.find((p) => p.provider === "kimi-coding");
    assert.equal(offRow.disabled, true);
    assert.equal(offRow.ok, false);
  } finally {
    globalThis.fetch = realFetch;
  }
}
// no llm service / no matching providers → an empty, well-formed answer
{
  const env = makeCtx({ withSettings: false });
  apply(env.ctx, config);
  const empty = JSON.parse((await env.serve("/pulse/quota")).body);
  assert.deepEqual(empty.providers, []);
  assert.deepEqual(empty.series, []);
  assert.equal(empty.schema, 1);
}

// --- /pulse/quota/probe + footSource/quotaSpecs settings round-trip ----------
{
  const env = makeCtx({ withSettings: "forms", withLlm: true, withCredentials: true, withStorageDomain: true, withQuota: true });
  apply(env.ctx, { ...config, quotaOff: [] });
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, init) => {
      env.fetchCalls.push({ url: String(url), init });
      assert.equal(String(url), "https://probe.example.com/usage", "the probe hits the custom spec's host+path");
      assert.equal(init.headers.authorization, "zai-test-SECRET-value", "raw scheme: no Bearer prefix");
      return { ok: true, status: 200, json: async () => ({ pct: 42 }) };
    };
    const customSpec = {
      id: "custom-zai-coding-cn", label: "probe", routes: ["zai-coding-cn"],
      envKeys: ["ZAI_CODING_CN_API_KEY"],
      hosts: [{ base: "https://probe.example.com" }], auth: "raw",
      requests: [{ id: "quota", path: "/usage" }],
      windows: [{ id: "win", kind: "requests", windowMs: null, source: { request: "quota", path: "", mode: "single" }, pct: { aliases: ["pct"] } }],
    };
    const before = env.quotaState().snapshots.length;
    const probed = JSON.parse((await env.serve("/pulse/quota/probe", { method: "POST", body: { route: "zai-coding-cn", spec: customSpec } })).body);
    assert.equal(probed.ok, true);
    assert.equal(probed.windows[0].usedPct, 42, "the probe returns the normalized preview");
    assert.equal(env.quotaState().snapshots.length, before, "a probe never writes snapshots");
    assert.equal(JSON.stringify(probed).includes("SECRET"), false, "no credential material in the probe reply");
    const noSpec = await env.serve("/pulse/quota/probe", { method: "POST", body: { route: "unknown-route" } });
    assert.equal(noSpec.status, 400, "an uncovered route without a spec is refused");
    // settings carry the selector + custom specs; invalid specs stay inert
    const settings = JSON.parse((await env.serve("/pulse/settings")).body);
    assert.equal(settings.footSource, "");
    assert.equal(settings.providerSpecs.length, 4, "the built-in specs ride the settings face");
    const validCustom = { ...customSpec, id: "custom-my-route", routes: ["my-route"] };
    const post = await env.serve("/pulse/settings", { method: "POST", body: { footSource: "zai-coding-cn", quotaSpecs: { "my-route": validCustom, "bad-route": { nope: true } }, revision: settings.revision } });
    assert.equal(JSON.parse(post.body).ok, true);
    const patch = env.formCalls[env.formCalls.length - 1].patch;
    assert.equal(patch.footSource, "zai-coding-cn");
    assert.deepEqual(Object.keys(patch.quotaSpecs), ["my-route"], "invalid custom specs are dropped at the boundary");
  } finally {
    globalThis.fetch = realFetch;
  }
}

// --- same-origin guard: mutation POSTs refuse cross-site browser requests ----
// readBody never inspects content-type, so a hostile page could drive the
// credential-bearing probe (and every card write) with a text/plain CORS
// simple request no preflight would surface. The guard refuses on a
// mismatched Origin (ports compared), on Sec-Fetch-Site: cross-site, and on
// an unprovable `Origin: null`; headerless clients (curl, the host's own
// tools) and true same-origin POSTs pass everywhere.
{
  const env = makeCtx({ withSettings: true, withCredentials: true, withStorageDomain: true, withQuota: true });
  apply(env.ctx, config);
  const realFetch = globalThis.fetch;
  let fetchCount = 0;
  globalThis.fetch = async () => {
    fetchCount += 1;
    throw new Error("no outbound request may ride a refused POST");
  };
  try {
    const host = "127.0.0.1:3512";
    const posts = [
      ["/pulse/quota/probe", { route: "zai-coding-cn" }],
      ["/pulse/pricing-card", { card: null }],
      ["/pulse/pricing-card/validate", { card: null }],
      ["/pulse/pricing-card/pull", {}],
      ["/pulse/pricing-card/reset", {}],
      ["/pulse/settings", { reset: true }],
    ];
    for (const [path, body] of posts) {
      const refused = await env.serve(path, {
        method: "POST",
        body,
        headers: { origin: "https://evil.example", host },
      });
      assert.equal(refused.status, 403, `${path}: cross-site Origin refused`);
      const parsed = JSON.parse(refused.body);
      assert.equal(parsed.ok, false, `${path}: the {ok:false,error} host contract`);
      assert.ok(typeof parsed.error === "string" && parsed.error.length > 0, `${path}: error carries a message`);
    }
    assert.equal(fetchCount, 0, "a refused probe never resolves a credential nor fetches");
    // Sec-Fetch-Site is authoritative on its own: refused even when the
    // Origin itself matches — the pair must both vouch.
    const site = await env.serve("/pulse/settings", {
      method: "POST",
      body: { reset: true },
      headers: { origin: `http://${host}`, host, "sec-fetch-site": "cross-site" },
    });
    assert.equal(site.status, 403, "Sec-Fetch-Site: cross-site refused despite a matching Origin");
    // Firefox/Chrome attach Origin to same-origin POSTs too — allowed.
    const same = await env.serve("/pulse/settings", {
      method: "POST",
      body: { reset: true },
      headers: { origin: `http://${host}`, host, "sec-fetch-site": "same-origin" },
    });
    assert.equal(same.status, 200, "same-origin POST (Origin and Host agree, ports included) allowed");
    const otherPort = await env.serve("/pulse/settings", {
      method: "POST",
      body: { reset: true },
      headers: { origin: "http://127.0.0.1:9999", host },
    });
    assert.equal(otherPort.status, 403, "matching hostname with a different port is cross-site");
    const nullOrigin = await env.serve("/pulse/settings", {
      method: "POST",
      body: { reset: true },
      headers: { origin: "null", host },
    });
    assert.equal(nullOrigin.status, 403, "Origin: null (sandboxed iframe) cannot prove same-origin");
    // Headerless clients (curl, the host's internal tools) pass everywhere.
    const headless = await env.serve("/pulse/settings", { method: "POST", body: { reset: true } });
    assert.equal(headless.status, 200, "no Origin and no Sec-Fetch-Site → the trusted non-browser posture");
  } finally {
    globalThis.fetch = realFetch;
  }
}

// --- hostFor variant discipline: rosters refuse, drafts fall back ------------
// A spec whose hosts are all route-keyed must never aim hosts[0] at an
// undeclared route variant: the orchestrator resolves the route's live
// credential BEFORE hostFor picks the base, so the fallback would send that
// credential to whatever host happens to be listed first. Explicit
// body.spec draft probes keep the generic fallback (half-written drafts omit
// the route key); the probe route's same-origin guard is that exposure's
// backstop.
{
  const env = makeCtx({ withSettings: true, withCredentials: true });
  apply(env.ctx, { ...config, quotaOff: [] });
  // Unit level, straight on the engine: the exact hit wins; a spec that
  // DECLARES a route-less default keeps serving undeclared variants through
  // it (the built-in z.ai pattern), while an all-route-keyed spec refuses.
  const keyedHost = {
    id: "custom-keyed-host", label: "keyed", routes: ["keyed-route"], envKeys: ["ZAI_CODING_CN_API_KEY"],
    hosts: [
      { route: "keyed-route", base: "https://right.example" },
      { route: "keyed-other", base: "https://other.example" },
    ],
    auth: "bearer",
    requests: [{ id: "quota", path: "/usage" }],
    windows: [{ id: "win", kind: "requests", windowMs: null, source: { request: "quota", path: "", mode: "single" }, pct: { aliases: ["pct"] } }],
  };
  const strict = specAdapter(keyedHost);
  assert.equal(strict.hostFor("keyed-route"), "https://right.example", "exact variant still wins");
  assert.throws(() => strict.hostFor("undeclared"), /no host variant/, "roster adapters refuse an undeclared route variant");
  assert.equal(specAdapter(keyedHost, { draft: true }).hostFor("undeclared"), "https://right.example",
    "draft probes keep the generic hosts[0] fallback");
  const withDefault = specAdapter({
    ...keyedHost,
    hosts: [{ route: "keyed-route", base: "https://right.example" }, { base: "https://default.example" }],
  });
  assert.equal(withDefault.hostFor("undeclared"), "https://default.example",
    "a declared route-less default still serves the undeclared variants — no refusal there");

  // Integration level through the probe route: a saved custom spec whose
  // hosts do NOT cover their own route (valid grammar, semantic booby trap).
  const booby = {
    id: "custom-booby", label: "booby", routes: ["booby-route"], envKeys: ["ZAI_CODING_CN_API_KEY"],
    hosts: [{ route: "booby-other", base: "https://wrong.example" }],
    auth: "bearer",
    requests: [{ id: "quota", path: "/usage" }],
    windows: [{ id: "win", kind: "requests", windowMs: null, source: { request: "quota", path: "", mode: "single" }, pct: { aliases: ["pct"] } }],
  };
  const realFetch = globalThis.fetch;
  const calls = [];
  try {
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), authorization: init.headers.authorization });
      return { ok: true, status: 200, json: async () => ({ pct: 7 }) };
    };
    const settings = JSON.parse((await env.serve("/pulse/settings")).body);
    const saved = await env.serve("/pulse/settings", {
      method: "POST",
      body: { quotaSpecs: { "booby-route": booby }, revision: settings.revision },
    });
    assert.equal(JSON.parse(saved.body).ok, true, "the spec validates into the custom roster");
    // Roster posture (no body.spec): refuse, and fire nothing anywhere.
    const strictProbe = JSON.parse((await env.serve("/pulse/quota/probe", { method: "POST", body: { route: "booby-route" } })).body);
    assert.equal(strictProbe.ok, false, "a roster-sourced probe refuses the undeclared variant");
    assert.ok(/no host variant/.test(String(strictProbe.error)), `the refusal names the discipline: ${strictProbe.error}`);
    assert.equal(calls.length, 0, "no outbound request for a refused probe");
    assert.equal(calls.some((c) => c.url.includes("wrong.example")), false, "hosts[0] was never aimed at the refused route");
    // Draft posture (explicit body.spec): the fallback fetches hosts[0],
    // still under exactly one Authorization header.
    const draftProbe = JSON.parse((await env.serve("/pulse/quota/probe", { method: "POST", body: { route: "booby-route", spec: booby } })).body);
    assert.equal(draftProbe.ok, true, "the draft probe rides the generic fallback");
    assert.equal(draftProbe.windows[0].usedPct, 7, "and parses the reply into the normalized preview");
    assert.equal(calls[0]?.url, "https://wrong.example/usage", "the draft's fallback aims hosts[0]");
    assert.equal(calls[0]?.authorization, "Bearer zai-test-SECRET-value", "still exactly one auth header");
  } finally {
    globalThis.fetch = realFetch;
  }
}

// --- draft probe: an invalid explicit body.spec is a 400, not a 500 ----------
// probeSpec validates at its own service boundary; without the route-level
// gate a garbage draft rode that throw to the route catch and answered a
// malformed body with 500, where invalid JSON / missing route / missing spec
// on the same route all answer 400.
{
  const env = makeCtx({ withSettings: false });
  apply(env.ctx, config);
  for (const garbage of ["garbage", 42, {}, []]) {
    const bad = await env.serve("/pulse/quota/probe", { method: "POST", body: { route: "some-route", spec: garbage } });
    assert.equal(bad.status, 400, `invalid draft spec ${JSON.stringify(garbage)} refused with 400`);
    const parsed = JSON.parse(bad.body);
    assert.equal(parsed.ok, false, "the {ok:false,error} contract");
    assert.ok(String(parsed.error).includes("invalid query spec"), `the error names the spec: ${parsed.error}`);
  }
  // a null spec never reaches the draft path — the roster lookup misses and
  // the route's own no-spec 400 already covers it
  const nullSpec = await env.serve("/pulse/quota/probe", { method: "POST", body: { route: "some-route", spec: null } });
  assert.equal(nullSpec.status, 400, "a null draft spec is refused by the no-spec gate");
}

// --- probeSpec's own service boundary: an invalid spec is probe DATA, not a
// thrown 500. The route pre-gates explicit drafts (above), but roster paths
// hand the service stale hand-edited specs with no route gate at all — the
// service owns the {ok:false} contract, so its validation lives inside its
// own error mapping, never on the caller's stack. ---------------------------
{
  const quotaService = createQuotaService({
    ctx: {}, resolveConfig: () => ({}), llmServiceOf: () => null, llmDescribeOf: () => null,
  });
  for (const garbage of [null, 42, "x", {}, { id: "nope" }]) {
    const reply = await quotaService.probeSpec("some-route", garbage);
    assert.deepEqual(reply.ok, false, `invalid spec ${JSON.stringify(garbage)} answers ok:false, never throws`);
    assert.match(String(reply.error), /invalid query spec/);
  }
  // a VALID spec keeps the probe's real reply shapes (no regression on the
  // happy path's credential miss — no credential seam in this stub ctx)
  const valid = await quotaService.probeSpec("some-route", {
    id: "custom-probe", label: "probe", routes: ["some-route"], hosts: [{ base: "https://probe.example" }], auth: "bearer",
    requests: [{ id: "quota", path: "/u" }],
    windows: [{ id: "win", kind: "requests", windowMs: null, source: { request: "quota", path: "", mode: "single" }, pct: { aliases: ["pct"] } }],
  });
  assert.deepEqual(valid, { ok: false, configured: false, error: "no credential resolved" },
    "a valid spec still walks the normal probe flow");
}

// --- /pulse/session: event-level timeline (break-analysis source) -------------
{
  const env = makeCtx({ withSettings: true });
  apply(env.ctx, config);
  const tl = JSON.parse((await env.serve("/pulse/session?id=live1")).body);
  assert.equal(tl.id, "live1");
  assert.equal(tl.header.origin, "main");
  assert.equal(tl.events.length, 1, "only the usage-bearing assistant/message lands");
  assert.deepEqual(tl.events[0], { t: noon(-1) + 1000, i: 100, o: 50, cr: 900, cw: 10, key: "deepseek-official\u0000deepseek-v4-flash" });
  assert.deepEqual(tl.turns, [{ start: noon(-1), end: noon(-1) + 5000, preview: null }]);
  // the LRU cache serves the repeat with an identical shape
  const again = JSON.parse((await env.serve("/pulse/session?id=live1")).body);
  assert.deepEqual(again.events, tl.events);
  // subagent header identity rides along
  const sub = JSON.parse((await env.serve("/pulse/session?id=cold1")).body);
  assert.equal(sub.header.origin, "subagent");
  assert.equal(sub.header.cwd, "/home/x/repo");
  // ...and a fork's timeline is its own events: the inherited parent usage
  // and turn (seq 0..2, below the cut) stay out of the detail view
  assert.deepEqual(sub.events, [{ t: noon(-3) + 1000, i: 7, o: 3, cr: 0, cw: 0, key: "deepseek-official\u0000deepseek-v4-pro" }],
    "only the fork's own usage lands");
  assert.deepEqual(sub.turns, [], "the parent's turn boundaries stay out");
  // missing id refused; unknown session 404s
  assert.equal((await env.serve("/pulse/session")).status, 400);
  const missing = JSON.parse((await env.serve("/pulse/session?id=nope")).body);
  assert.equal(missing.ok, false);
}

// --- guardrail B: a wrong-shaped cache seam fails loudly, never silently ----
// The retired pre-0.1.2 self-reading seam stands in for "a future host
// reshaped the seam": apply() must log one error and /pulse/stats must 503
// instead of serving a silently empty dashboard.
{
  const env = makeCtx({ withSettings: false, seamBroken: true });
  apply(env.ctx, config);
  assert.ok(env.logErrors.some((line) => line.includes("seam shape mismatch")),
    "apply() logs the seam shape mismatch once, loudly");
  const denied = await env.serve("/pulse/stats?days=13");
  assert.equal(denied.status, 503, "the stats route refuses to serve on a broken seam");
  assert.ok(String(denied.body).includes("seam shape mismatch"), "the 503 names the actual mismatch");
  // A healthy re-apply clears the gate (the plugin reloads, the seam passes).
  const healthy = makeCtx({ withSettings: false });
  apply(healthy.ctx, config);
  assert.equal(healthy.logErrors.length, 0, "a correctly-shaped seam logs no error");
  assert.equal((await healthy.serve("/pulse/stats?days=14")).status, 200, "a correctly-shaped seam serves stats");
}

// --- guardrail C: the stub matrix cannot drift from the real seam package ----
// The dev tree pins the REAL @deepseek-ai/dsh-session-projection-cache
// (the package whose service the host injects as `sessionProjectionCache`),
// so a host release that reshapes the seam fails HERE on `npm install &&
// npm test` at the moment the devDependency is bumped — not in the wild as
// a silently empty dashboard. The hand-written stub above stays as the
// behavioral fixture; this block is the shape contract against reality.
{
  const real = SessionProjectionCache.prototype;
  assert.equal(typeof real.coldSnapshot, "function", "the real cache class still exposes coldSnapshot");
  assert.ok(real.coldSnapshot.length >= 3,
    `real coldSnapshot arity changed to ${real.coldSnapshot.length} — the 0.2.1 floor's single-shape fold path must be updated together with the stub`);
  assert.equal(typeof real.cachedSnapshot, "function", "the real cache class still exposes cachedSnapshot");
  assert.equal(real.cachedSnapshot.length, 2,
    `real cachedSnapshot arity changed to ${real.cachedSnapshot.length} — the zero-I/O fast path call shape must be updated together with the stub`);
}

// --- guardrail D: the fork cut under the REAL registry ------------------------
// The registry (the cache package's pinned peer) hands `init` the session's
// `inheritedEventCount` and then drives `apply` over the copied parent events
// too. The stub matrix above never runs that path, which is how a fold that
// counted every fork's inherited prefix passed every test while reading 3.5×
// the provider's bill. This block runs the real restore / viewCheckpoint /
// restoreFloor over a forked log in the stored shape (the marker's own seq is
// the cut).
{
  const { SessionProjectionRegistry } = await import("@deepseek-ai/dsh-session-projection");
  const regCtx = {
    // 0.2.1-rc registers through a generator effect; newer hosts through a
    // plain function plus fiber.assertActive().
    effect: (fn) => {
      const disposer = fn.constructor?.name === "GeneratorFunction"
        ? (() => { const it = fn(); it.next(); return it.next().value; })()
        : fn();
      return () => { if (typeof disposer === "function") disposer(); };
    },
    fiber: { assertActive() {} },
  };
  const reg = Object.create(SessionProjectionRegistry.prototype);
  Object.assign(reg, { registrations: new Map(), summaryKeySet: undefined, listeners: new Set(), eventListeners: new Set(), deprecatedStateOfKeys: new Set(), ctx: regCtx });
  const release = typeof reg.acquire === "function" ? await reg.acquire(pulseProjectionDefinition(), (d) => d) : reg.register(pulseProjectionDefinition());

  const seqd = (seq, event) => ({ seq, ...event });
  const usage = (input) => ({ inputTokens: input, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 });
  const flash = { provider: "deepseek-official", model: "deepseek-v4-flash" };
  const pro = { provider: "deepseek-official", model: "deepseek-v4-pro" };
  const header = { version: 4, id: "fork1", createdAt: noon(-1), cwd: "D:\\DSH\\demo", parentSession: "p0", isSeeded: true, origin: "subagent" };
  const forkLog = [
    seqd(0, { type: "session/title", time: noon(-1), data: { title: "父会话" } }),
    seqd(1, { type: "assistant/message", time: noon(-1), data: { usage: usage(1000), message: { source: flash } } }),
    seqd(2, { type: "step/end", time: noon(-1), data: { turn: 1, step: 1 } }),
    seqd(3, { type: "session/end-seed", time: noon(-1), data: { inherited: true } }),
    seqd(4, { type: "assistant/message", time: noon(-1), data: { usage: usage(7), message: { source: pro } } }),
  ];
  const own = { input: 7, output: 0, cacheRead: 0, cacheWrite: 0 };

  // cold fold from an empty checkpoint: the parent's copy stays out
  const cold = reg.restore({}, forkLog, 0, header, 3);
  assert.deepEqual(cold.snapshot.values.pulseUsage.byDay, { [daysAgo(1)]: own }, "the real registry's cold fold counts the fork's own usage only");
  assert.equal(cold.snapshot.values.pulseUsage.title, "父会话", "the fork keeps the inherited title");
  assert.deepEqual(cold.snapshot.values.pulseUsage.turnsByDay, {}, "the parent's closed turn is not the fork's");
  // the write-back row carries the cut and validates as stored state
  const rows = cold.checkpoint;
  assert.equal(rows.pulseUsage.ver, PULSE_STATE_VERSION);
  assert.equal(rows.pulseUsage.val.inheritedEventCount, 3, "the cut lives in the persisted state");
  assert.deepEqual(reg.viewCheckpoint(rows, ["pulseUsage"]).pulseUsage.byDay, { [daysAgo(1)]: own }, "the zero-I/O rung serves the stored row");
  assert.equal(reg.restoreFloor(rows), forkLog.at(-1).seq, "a current row lets later reads replay the tail only");
  // a row folded before the fix is never served and forces a full replay
  const preFixState = { ...rows.pulseUsage.val };
  delete preFixState.inheritedEventCount;
  const stale = { pulseUsage: { ver: PULSE_STATE_VERSION - 1, seq: forkLog.at(-1).seq, val: preFixState } };
  assert.deepEqual(reg.viewCheckpoint(stale, ["pulseUsage"]), {}, "a pre-fix row is not served");
  assert.equal(reg.restoreFloor(stale), 0, "a pre-fix row sends the next read back to seq 0");
  assert.deepEqual(reg.restore(stale, forkLog, 0, header, 3).snapshot.values.pulseUsage.byDay, { [daysAgo(1)]: own }, "and the replay folds the same");
  // a row that claims the current version without the cut is not a state
  assert.deepEqual(reg.viewCheckpoint({ pulseUsage: { ...stale.pulseUsage, ver: PULSE_STATE_VERSION } }, ["pulseUsage"]), {},
    "stateSchema rejects a state without the cut");

  typeof release === "function" ? release() : await release.dispose();
}

// --- volatile Config fields: display AND pricing edits never force a restart --
{
  for (const key of ["currency", "topProjects", "projectDepth", "defaultDays", "costEnabled", "usdToCny", "monthlyProviders", "modelColors", "pricing"]) {
    assert.equal(Config.dict[key].meta.volatile, true, `${key} is volatile (live edit, no restart)`);
  }
  // pricing 自 D1 起转 volatile：峰时变化由 syncPeak 的 peakMapKey 签名触发
  // epoch 重折叠，纯价格变化无需 refold——entry 重启不再是必要边界。
}

// --- v0.5 model accent colors: sanitization + the wire surfaces ----------------
{
  const env = makeCtx({ withSettings: "forms" });
  apply(env.ctx, { ...config, modelColors: { "deepseek-flash": "#4D6BFE", junk: "red" } });
  const surface = JSON.parse((await env.serve("/pulse/settings")).body);
  assert.deepEqual(surface.modelColors, { "deepseek-flash": "#4d6bfe" }, "GET exposes the accent map, sanitized (junk dropped, hex lowercased)");
  const stats = JSON.parse((await env.serve("/pulse/stats?days=9")).body);
  assert.deepEqual(stats.modelColors, { "deepseek-flash": "#4d6bfe" }, "the stats payload carries the accent overrides for the client charts");
  const saved = await env.serve("/pulse/settings", { method: "POST", body: { modelColors: { "glm-5.3-flash": "#2F6BFF", "": "#123456", bad: "not-a-color" }, revision: 4 } });
  assert.equal(saved.status, 200, "an accent write lands with the observed revision");
  const call = env.formCalls[env.formCalls.length - 1];
  assert.deepEqual(call.patch, { modelColors: { "glm-5.3-flash": "#2f6bff" } }, "the accent patch is sanitized: empty ids and non-color values dropped");
}

// --- v0.5 aux shape: a manual searchShape freezes the client self-calibration ---
{
  const env = makeCtx({ withSettings: "forms" });
  apply(env.ctx, { ...config, searchShape: { miss: 8442, hit: 1309, out: 997, junk: -5 } });
  const surface = JSON.parse((await env.serve("/pulse/settings")).body);
  assert.deepEqual(surface.searchShape, { miss: 8442, hit: 1309, out: 997 }, "GET exposes the manual shape, sanitized");
  const stats = JSON.parse((await env.serve("/pulse/stats?days=12")).body);
  assert.deepEqual(stats.auxShape, { miss: 8442, hit: 1309, out: 997, manual: true },
    "the payload carries the manual shape (calibration frozen client-side)");
  const saved = await env.serve("/pulse/settings", { method: "POST", body: { searchShape: { miss: 9000, junk: 1e9, out: -1 }, revision: 4 } });
  assert.equal(saved.status, 200);
  const call = env.formCalls[env.formCalls.length - 1];
  assert.deepEqual(call.patch, { searchShape: { miss: 9000 } }, "unknown keys and out-of-bound amounts drop; partial shapes stay partial");
  assert.equal(Config.dict.searchShape.meta.volatile, true, "searchShape edits apply live (no restart)");
}

// --- 0.1.7 SettingsForms generation: revision-guarded writes through the seam ---
{
  const env = makeCtx({ withSettings: "forms" });
  apply(env.ctx, config);
  const surface = JSON.parse((await env.serve("/pulse/settings")).body);
  assert.equal(surface.writable, true, "forms host reports the editor writable");
  assert.equal(surface.revision, 4, "GET carries the entry revision for optimistic concurrency");
  assert.equal(surface.pricing.length, 2, "effective pricing still merges the official defaults");

  const saved = await env.serve("/pulse/settings", { method: "POST", body: { usdToCny: 7.2, revision: 4 } });
  assert.equal(saved.status, 200, "a write carrying the observed revision lands");
  assert.deepEqual(JSON.parse(saved.body), { ok: true, refold: false });
  assert.equal(env.formCalls.length, 1, "exactly one forms write");
  assert.equal(env.formCalls[0].op, "update");
  assert.equal(env.formCalls[0].ns, "pulse");
  assert.equal(env.formCalls[0].rev, 4, "the observed revision rides the write");
  assert.deepEqual(env.formCalls[0].patch, { usdToCny: 7.2 }, "only present fields are merged");

  const stale = await env.serve("/pulse/settings", { method: "POST", body: { usdToCny: 8, revision: 4 } });
  assert.equal(stale.status, 409, "a stale revision is refused");
  const refused = JSON.parse(stale.body);
  assert.equal(refused.ok, false);
  assert.deepEqual(refused.conflict, { expected: 4, actual: 5 }, "the conflict payload names both revisions");

  const reset = await env.serve("/pulse/settings", { method: "POST", body: { reset: true, revision: 5 } });
  assert.equal(reset.status, 200, "reset lands with the fresh revision");
  // formCalls also holds the refused stale attempt; the reset is the last one.
  assert.equal(env.formCalls[env.formCalls.length - 1].op, "replace", "reset maps to replace, not update");

  // The document-updated feed: our own writes and host-page edits fire it;
  // it must invalidate the payload without disturbing the fold.
  env.fireDocumentUpdated("pulse");
  env.fireDocumentUpdated("some-other-entry");
  const after = await env.serve("/pulse/stats?days=10");
  assert.equal(after.status, 200, "stats serve fine after change-feed events");
}

// --- classic generation regression: the seam keeps the scope behavior ----------
{
  const env = makeCtx({ withSettings: true });
  apply(env.ctx, config);
  const surface = JSON.parse((await env.serve("/pulse/settings")).body);
  assert.equal(surface.writable, true, "classic host keeps the editor writable");
  assert.equal(surface.revision, undefined, "classic hosts carry no revision");
  const saved = JSON.parse((await env.serve("/pulse/settings", { method: "POST", body: { usdToCny: 7.4 } })).body);
  assert.equal(saved.ok, true, "classic write lands without a revision");
  assert.equal(env.userSection().usdToCny, 7.4, "the user layer received the patch");
}

// --- boot stored-card: a corrupted card or a throwing seam fails open ---------
// The stored-card read used to sit OUTSIDE the try: a storage seam that threw
// rejected `cardReady` and every /pulse/stats request died with it. Now the
// whole read is one fail-open unit — an unreadable or invalid stored card
// falls back to the bundled seed and says so in the host log.
{
  const env = makeCtx({ withSettings: false, withStorageDomain: true });
  const corrupted = structuredClone(SEED_CARD);
  corrupted.pricing.usdToCny = -1; // fails validateCard's positive gate
  env.seedCardState({ card: corrupted, origin: "imported", savedAt: 1 });
  apply(env.ctx, config);
  const stats = await env.serve(`/pulse/stats?from=${daysAgo(4)}&to=${today()}`);
  assert.equal(stats.status, 200, "a corrupted stored card fails open — stats still serve");
  const card = JSON.parse((await env.serve("/pulse/pricing-card")).body);
  assert.equal(card.ok, true);
  assert.equal(card.origin, "bundled", "the bundled seed stays authoritative");
  assert.equal(card.card.version, SEED_CARD.version, "the seed card itself is served");
  assert.ok(env.logInfos.some((line) => line.includes("stored data card ignored")),
    "the ignored stored card is visible in the host log");
}
// a storage seam that THROWS on read must not reject cardReady either — the
// old bug surfaced as a 500 on the very first (and every) stats request
{
  const env = makeCtx({ withSettings: false, withStorageDomain: true });
  env.setCardGetThrows(true);
  apply(env.ctx, config);
  const stats = await env.serve(`/pulse/stats?from=${daysAgo(4)}&to=${today()}`);
  assert.equal(stats.status, 200, "a throwing storage seam fails open, not a 500 on every stats read");
  assert.ok(env.logInfos.some((line) => line.includes("stored data card ignored")),
    "the seam failure surfaces as the same one-line degradation note");
}
// the boot SUCCESS path owes the same symmetry as refreshCard and the reset
// route: the boot IIFE suspends at the storage open, so the synchronous
// applyDisplay right after it always derives from the bundled seed's
// DEFAULT_USD_TO_CNY. A stored card whose fx differs would leave the display
// realm (TUI strip, usage-query answers) on the seed rate until the next
// settings event or HTTP card apply — web payloads ride the card and never
// notice. Runs before the later card blocks; cleans up after itself.
{
  const env = makeCtx({ withSettings: false, withStorageDomain: true });
  const stored = structuredClone(SEED_CARD);
  stored.pricing.usdToCny = 7.7;
  stored.version = SEED_CARD.version + 1;
  env.seedCardState({ card: stored, origin: "imported", savedAt: 1 });
  apply(env.ctx, { ...config, displayCurrency: "USD" });
  assert.ok(Math.abs(displayAmount(6.8) - 1) < 1e-9,
    "boot's synchronous derive still uses the bundled seed rate (the card read suspends at the storage open)");
  await env.serve(`/pulse/stats?from=${daysAgo(4)}&to=${today()}`); // gates on cardReady
  const card = JSON.parse((await env.serve("/pulse/pricing-card")).body);
  assert.equal(card.origin, "imported", "the stored card actually applied at boot");
  assert.ok(Math.abs(displayAmount(7.7) - 1) < 1e-9,
    "the stored card's rate becomes the display rate (refreshCard/reset symmetry at boot)");
  resetCard(); // leave the module-global facts on the seed for any later reader
}

// --- card validation errors name the field, not a zod issues JSON dump ------
// A hand-editing user gets one readable "path: reason" line per structural
// issue; the raw ZodError.message is the issues array serialized as JSON and
// reads as host vomit. Pinned on the import route (validate and pull share
// the same formatter).
{
  const env = makeCtx({ withSettings: false });
  apply(env.ctx, config);
  const broken = await env.serve("/pulse/pricing-card", {
    method: "POST",
    body: { card: { cardSchema: 3, source: "https://example.com/card.json" }, origin: "imported" },
  });
  assert.equal(broken.status, 400, "a structurally invalid card is refused");
  const face = JSON.parse(broken.body).error;
  assert.ok(typeof face === "string" && !face.startsWith("["), "the error is not the raw issues JSON string");
  assert.ok(face.includes("version"), `the error names the failing field: ${face}`);
}

// --- card apply concurrency: a stale `base` is a 409, not a silent overwrite -
// The client echoes the card its preview was staged against; the host refuses
// with the machine-readable "card-changed" conflict when the active card moved
// underneath. Absent base keeps the legacy trusted-caller posture. Runs last:
// it mutates the module-global active card, and it cleans up after itself.
{
  const env = makeCtx({ withSettings: false });
  apply(env.ctx, config);
  const changed = structuredClone(SEED_CARD);
  changed.pricing.usdToCny = 7.7;
  changed.version = SEED_CARD.version + 1;
  // no base at all: curl / scripts still apply
  const noBase = await env.serve("/pulse/pricing-card", { method: "POST", body: { card: changed, origin: "imported" } });
  assert.equal(noBase.status, 200, "absent base keeps the legacy apply posture");
  assert.equal(JSON.parse(noBase.body).ok, true);
  // the preview-time card no longer matches the active one → 409 conflict
  const stale = await env.serve("/pulse/pricing-card", { method: "POST", body: { card: changed, origin: "imported", base: SEED_CARD } });
  assert.equal(stale.status, 409, "a stale base is refused");
  assert.deepEqual(JSON.parse(stale.body), { ok: false, error: "card-changed" },
    "the conflict face is the {ok:false,error} contract with a stable code");
  // a base that DOES match the active card (the client's JSON round trip of
  // the GET reply) applies
  const current = JSON.parse((await env.serve("/pulse/pricing-card")).body).card;
  const fresh = await env.serve("/pulse/pricing-card", { method: "POST", body: { card: { ...changed, version: changed.version + 1 }, origin: "imported", base: current } });
  assert.equal(fresh.status, 200, "a base matching the active card applies");
  // key order carries no meaning: a reordered echo must still match (this is
  // the regression that pins a structural compare, not a stringify compare)
  const current2 = JSON.parse((await env.serve("/pulse/pricing-card")).body).card;
  const reordered = {};
  for (const key of Object.keys(current2).reverse()) reordered[key] = current2[key];
  const reorderedApply = await env.serve("/pulse/pricing-card", { method: "POST", body: { card: { ...changed, version: changed.version + 2 }, origin: "imported", base: reordered } });
  assert.equal(reorderedApply.status, 200, "a key-reordered base still matches the active card");
  resetCard(); // leave the module-global facts on the seed for any later reader
}

// --- card apply: a credential-routing change needs an explicit ack ----------
// routes / hosts / auth / envKeys decide which stored credential a spec reads
// and where it sends it. The preview lists those rows apart; the host holds
// every caller to the same line: without `ackCredentials` the apply is a 422
// that changes nothing, and the refused rows come back machine-readable.
// Fresh env; the module-global card is left on the seed.
{
  const env = makeCtx({ withSettings: false });
  apply(env.ctx, config);
  const before = JSON.parse((await env.serve("/pulse/pricing-card")).body).card;
  const retargetedHost = structuredClone(SEED_CARD);
  retargetedHost.providers[0].hosts[0].base = "https://elsewhere.example/v1";
  retargetedHost.version = SEED_CARD.version + 1;
  const refused = await env.serve("/pulse/pricing-card", { method: "POST", body: { card: retargetedHost, origin: "imported" } });
  assert.equal(refused.status, 422, "a host change without the acknowledgement is a 422");
  const refusedBody = JSON.parse(refused.body);
  assert.equal(refusedBody.ok, false, "the {ok:false,error} contract");
  assert.equal(refusedBody.error, "credential-routing-changed", "…with a stable code");
  assert.ok(Array.isArray(refusedBody.changes) && refusedBody.changes.length >= 1
    && refusedBody.changes.some((row) => String(row.label).includes("hosts")), "the refused rows name the host change");
  const after = JSON.parse((await env.serve("/pulse/pricing-card")).body).card;
  assert.equal(JSON.stringify(after), JSON.stringify(before), "the refusal applied nothing");
  // A price-only card needs no acknowledgement (the concurrency block above
  // applies such cards bare); the same host change WITH it applies.
  const acked = await env.serve("/pulse/pricing-card", { method: "POST", body: { card: retargetedHost, origin: "imported", ackCredentials: true } });
  assert.equal(acked.status, 200, "the acknowledged apply goes through");
  assert.equal(JSON.parse(acked.body).ok, true);
  const active = JSON.parse((await env.serve("/pulse/pricing-card")).body).card;
  assert.equal(active.providers[0].hosts[0].base, "https://elsewhere.example/v1", "…and the active card carries the retargeted host");
  const reset = await env.serve("/pulse/pricing-card/reset", { method: "POST" });
  assert.equal(JSON.parse(reset.body).ok, true, "reset restores the seed for any later reader");
  resetCard();
}

// --- card pull: the fetch target is scheme-gated ---------------------------
// The pull URL is user-reachable config handed straight to node's fetch,
// which accepts more than http(s) (data: at minimum). The gate limits it to
// http(s) — http loopback-only for local mirrors, every remote source
// pinned to https — and every refusal happens BEFORE the fetch.
{
  const env = makeCtx({ withSettings: false });
  apply(env.ctx, config);
  const realFetch = globalThis.fetch;
  const fetched = [];
  globalThis.fetch = async (url) => { fetched.push(String(url)); throw new Error("no network in this test"); };
  try {
    for (const bad of ["file:///D:/passwd", "data:application/json,{}", "ftp://x/y/card.json", "not a url"]) {
      const refused = await env.serve("/pulse/pricing-card/pull", { method: "POST", body: { url: bad } });
      assert.equal(refused.status, 400, `${bad} refused with 400`);
      assert.deepEqual(JSON.parse(refused.body).ok, false, "the {ok:false,error} contract");
    }
    const remoteHttp = await env.serve("/pulse/pricing-card/pull", { method: "POST", body: { url: "http://cdn.jsdelivr.net/gh/x/y/ratecard.json" } });
    assert.equal(remoteHttp.status, 400, "a REMOTE http source is pinned to https");
    const loopHttp = await env.serve("/pulse/pricing-card/pull", { method: "POST", body: { url: "http://127.0.0.1:9/x.json" } });
    assert.equal(loopHttp.status, 200, "loopback http passes the gate (local mirror posture)");
    assert.deepEqual(JSON.parse(loopHttp.body).ok, false, "…its fetch failure still answers as data");
    const httpsSrc = await env.serve("/pulse/pricing-card/pull", { method: "POST", body: { url: "https://127.0.0.1:9/x.json" } });
    assert.equal(httpsSrc.status, 200, "an https source passes the gate");
    assert.deepEqual(JSON.parse(httpsSrc.body).ok, false);
    assert.equal(fetched.length, 2, "exactly the two accepted URLs were fetched; every refusal happened pre-fetch");
    assert.deepEqual(fetched, ["http://127.0.0.1:9/x.json", "https://127.0.0.1:9/x.json"]);
  } finally {
    globalThis.fetch = realFetch;
  }
}

// --- reset mirrors refreshCard: display rate re-derives, aux retarget refolds
// refreshCard re-applies the display rate because the card carries the
// DEFAULT_USD_TO_CNY fallback; the reset route (restoring the seed) must do
// the same, or a pulled card's rate lingers in the display realm. And
// auxPriceAs rides the fold's auxTierKey — a card that retargets it changes
// what the SAME events fold into tiersByDay, so syncPeak must treat it as a
// fold-semantics change and refold. Runs last: mutates module-global facts.
{
  const env = makeCtx({ withSettings: false });
  apply(env.ctx, { ...config, displayCurrency: "USD" });
  assert.ok(Math.abs(displayAmount(6.8) - 1) < 1e-9, "the seed rate serves the USD display");
  const retargeted = structuredClone(SEED_CARD);
  retargeted.pricing.usdToCny = 7.7;
  retargeted.pricing.auxPriceAs = "deepseek-v4-pro";
  retargeted.version = SEED_CARD.version + 1;
  const applied = await env.serve("/pulse/pricing-card", { method: "POST", body: { card: retargeted, origin: "imported" } });
  assert.deepEqual(JSON.parse(applied.body), { ok: true, refold: true }, "an auxPriceAs retarget IS a refold (fold-baked tier semantics)");
  assert.equal(env.registerCount(), 2, "…and the projection re-registers at a bumped stateVersion");
  assert.ok(Math.abs(displayAmount(7.7) - 1) < 1e-9, "the applied card's rate becomes the display rate (refreshCard symmetry)");
  const reset = await env.serve("/pulse/pricing-card/reset", { method: "POST" });
  assert.deepEqual(JSON.parse(reset.body), { ok: true, refold: true }, "reset restores the seed's aux price-as → refold");
  assert.equal(env.registerCount(), 3, "the reset re-registered the projection too");
  assert.ok(Math.abs(displayAmount(6.8) - 1) < 1e-9, "reset re-derives the display rate like refreshCard — the pulled rate did not linger");
}

console.log("host-test: route, windowing, dedupe, settings surface and update check all passed");
