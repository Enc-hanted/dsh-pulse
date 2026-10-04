/**
 * Host-half integration test: mounts the plugin against stubbed harness
 * services and exercises the real `/pulse/stats` route handler, the in-flight
 * dedupe, the `/pulse/settings` settings surface (GET/POST with and without a
 * settings service), and the `/pulse` command handler end to end.
 */

import { strict as assert } from "node:assert";
import { apply, Config } from "../src/index.js";
import { localDay } from "../src/aggregate.js";

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
 *  catalog, `legacyCache` swaps the 0.1.2-rc projection cache (sync
 *  `coldSnapshot(meta, cut, events)` over a caller-supplied log plus the
 *  zero-I/O `cachedSnapshot` fast path) for the pre-0.1.2 self-reading async
 *  one, and `alphaCache` swaps in the 0.1.7-alpha generation instead (the
 *  explicit cut is gone from `cachedSnapshot(meta, keys)`), proving the
 *  plugin serves every generation. `deferSettings` queues
 *  the inject callback instead of running it at apply time, simulating a
 *  settings service that mounts after the plugin. */
function makeCtx({ withSettings, withLlm = false, deferSettings = false, withCredentials = false, withStorageDomain = false, legacyCache = false, alphaCache = false, withQuota = false }) {
  const routes = [];
  const commands = [];
  const coldReads = [];
  const fastReads = [];
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
  const fakeStorageDomain = { open: async (spec) => (spec?.name === "pulse_quota" ? fakeQuotaDomain : fakeDomain) };

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
      listSessions: async () => (emptyCorpus
        ? []
        : [
          { header: { id: "live1", createdAt: noon(-1), cwd: "D:\\DSH\\demo" }, live: true, persisted: true },
          { header: { id: "cold1", createdAt: noon(-3), cwd: "/home/x/repo", origin: "subagent", isSeeded: true }, live: false, persisted: true },
          { header: { id: "broken1", createdAt: noon(-9), cwd: "D:\\DSH\\x", isSeeded: false }, live: false, persisted: true },
          { header: { id: "cold2", createdAt: noon(-6), cwd: "/home/x/other", isSeeded: false }, live: false, persisted: true },
        ]),
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
            events: [
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
    sessionProjectionCache: legacyCache === true ? {
      // pre-0.1.2-rc generation: self-reading async coldSnapshot(id)
      coldSnapshot: async (id) => {
        coldReads.push({ id });
        if (id === "broken1") throw new Error("no persisted log");
        return { asOfSeq: 4, values: id === "cold2" ? cold2Values : coldValues };
      },
    } : alphaCache === true ? {
      // 0.1.7-alpha generation: `cachedSnapshot(meta, keys)` dropped the
      // explicit cut (arity 2), while coldSnapshot keeps the synchronous
      // caller-supplied fold. A stray legacy 3-arg call would land the
      // numeric cut in `keys`; like the real registry's `new Set(keys)` it
      // must throw, never pass silently.
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
    } : {
      // 0.1.2-rc generation: zero-I/O stored-row read plus a synchronous
      // fold over the caller-supplied log
      cachedSnapshot: (header, cut, keys) => {
        fastReads.push(header.id);
        if (header.isSeeded !== false || cut !== 0) return undefined;
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
    logger: { warn: () => {} },
    inject: (deps, callback) => {
      const services = {};
      if (withSettings && Array.isArray(deps) && deps.includes("settings")) {
        services.settings = withSettings === "forms" ? fakeForms : fakeSettings;
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

  function serve(url, { method = "GET", body } = {}) {
    return new Promise((resolve) => {
      let status = 0;
      let raw = "";
      const res = {
        writeHead: (code) => { status = code; },
        end: (chunk) => { raw = chunk === undefined ? "" : String(chunk); resolve({ status, body: raw }); },
      };
      const req = { url, method, socket: { once: () => {} } };
      if (body !== undefined) req.body = typeof body === "string" ? body : JSON.stringify(body);
      routes[0].handler(req, res);
    });
  }

  return {
    ctx, routes, commands, coldReads, fastReads, serve,
    unit: () => registeredUnit,
    registerCount: () => registerCount,
    userSection: () => userSection,
    mountSettings: () => { const cb = pendingSettingsCb; pendingSettingsCb = null; if (cb !== null) cb(); },
    setLlmSection: (section) => { llmSection = section; },
    setEmptyCorpus: (value) => { emptyCorpus = value === true; },
    listSessionsProbe: () => ctx.sessionQuery.listSessions(),
    balanceState: () => balanceState,
    seedSnapshots: (snapshots) => { balanceState = { snapshots }; },
    quotaState: () => quotaState,
    seedQuotaSnapshots: (snapshots) => { quotaState = { snapshots }; },
    fetchCalls,
    formCalls,
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

// --- environment with a settings service: full wiring ------------------------
const env = makeCtx({ withSettings: true, withLlm: true });
apply(env.ctx, config);

// --- the projection unit registered with the official contract --------------
assert.notEqual(env.unit(), null, "projection unit registered");
assert.equal(env.unit().key, "pulseUsage");
assert.equal(env.unit().stateVersion, 10);
assert.equal(env.registerCount(), 1, "one registration at load");
assert.deepEqual(env.unit().view(env.unit().init()), {
  byDay: {}, modelsByDay: {}, hoursByDay: {}, tiersByDay: {}, turnsByDay: {}, toolCallsByDay: {}, auxByDay: {}, firstDay: null, title: null,
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
// the 0.1.2-rc ladder: seeded cold1 skipped its zero-I/O fast path (unknown
// cut) and folded from the readSession body, which arrived with its exact
// inherited cut and complete log
assert.deepEqual(env.fastReads, ["broken1", "cold2"], "only unseeded headers touch the fast path");
assert.deepEqual(env.coldReads[0], { id: "cold1", cut: 3, events: 3 }, "coldSnapshot receives the loaded header, cut and log");

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
assert.equal(settings.official.length, 2, "untouched official baseline served for per-row restore");
assert.equal(settings.official[0].model, "deepseek-flash");
assert.equal(settings.catalog.length, 1, "one provider group from the llm service");
assert.equal(settings.catalog[0].displayName, "DeepSeek");
assert.equal(settings.catalog[0].models.length, 3);
assert.equal(settings.catalog[0].models[2].id, "third-party-x");

// saving a user pricing list persists and flips the effective config
const saved = JSON.parse((await env.serve("/pulse/settings", {
  method: "POST",
  body: { costEnabled: false, usdToCny: 7.05, pricing: [{ model: "my-model", input: 9, output: 18 }] },
})).body);
assert.equal(saved.ok, true);
assert.equal(saved.refold, false, "price-only save predicts no re-fold");
assert.deepEqual(env.userSection(), {
  costEnabled: false,
  usdToCny: 7.05,
  pricing: [{ model: "my-model", input: 9, output: 18 }],
}, "user layer replaced wholesale");
const after = JSON.parse((await env.serve("/pulse/settings")).body);
assert.equal(after.costEnabled, false);
assert.equal(after.fx.usdToCny, 7.05, "edited fx served back");
assert.equal(after.pricing.length, 3, "user rule joins the official defaults");
assert.equal(after.pricing[2].model, "my-model");
assert.equal(after.pricing[2].input, 9);
assert.equal(env.registerCount(), 1, "price-only edits never re-register the projection");

// the stats payload reflects the persisted flag (payload cache invalidated)
const flipped = JSON.parse((await env.serve(`/pulse/stats?from=${daysAgo(4)}&to=${today()}`)).body);
assert.equal(flipped.costEnabled, false, "disabled flag served after save");

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
assert.equal(env.unit().stateVersion, 11, "bumped state version invalidates persisted rows");
await new Promise((resolve) => setTimeout(resolve, 20));
assert.ok(env.coldReads.length > coldReadsBefore, "background warm-up re-folds the cold corpus");

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
assert.equal(env.unit().stateVersion, 13);

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
    assert.equal(calls.length, 1, "exactly one registry call per request");
    assert.ok(calls[0].url.includes("dsh-pulse"), `registry lookup names the package: ${calls[0].url}`);

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
  // missing id refused; unknown session 404s
  assert.equal((await env.serve("/pulse/session")).status, 400);
  const missing = JSON.parse((await env.serve("/pulse/session?id=nope")).body);
  assert.equal(missing.ok, false);
}

// --- legacy cache generation (pre-0.1.2-rc): the self-reading async seam -------
{
  const env = makeCtx({ withSettings: false, legacyCache: true });
  apply(env.ctx, config);
  const stats = JSON.parse((await env.serve("/pulse/stats?days=9")).body);
  assert.equal(stats.sessions.length, 3, "legacy self-reading coldSnapshot serves the cold corpus");
  assert.ok(env.coldReads.some((entry) => entry.id === "cold1"), "legacy path folded cold1 from its id alone");
  assert.equal(env.fastReads.length, 0, "legacy generation has no zero-I/O fast path");
}

// --- 0.1.7-alpha cache generation: the zero-I/O read drops the explicit cut -----
// `days=10`, not the legacy block's `days=9`: the payload TTL cache is
// module-level and keyed by window, so an equal window would serve the
// previous environment's folded payload and never touch this ctx.
{
  const env = makeCtx({ withSettings: false, alphaCache: true });
  apply(env.ctx, config);
  const stats = JSON.parse((await env.serve("/pulse/stats?days=10")).body);
  assert.equal(stats.sessions.length, 3, "alpha cache serves the same corpus shape");
  const cold2 = stats.sessions.find((s) => s.id === "cold2");
  assert.deepEqual(cold2.byDay[daysAgo(6)], { input: 20, output: 5, cacheRead: 100, cacheWrite: 0 }, "alpha zero-I/O rows serve the unseeded session through the 2-arg call");
  assert.deepEqual(env.fastReads, ["broken1", "cold2"], "alpha fast path still claims only unseeded headers");
  assert.deepEqual(env.coldReads.map((entry) => entry.id), ["cold1"], "seeded session still folds from its log on the alpha host");
}

// --- volatile Config fields: display edits never re-fold, pricing does ----------
{
  for (const key of ["currency", "topProjects", "projectDepth", "defaultDays", "costEnabled", "usdToCny", "monthlyProviders", "modelColors"]) {
    assert.equal(Config.dict[key].meta.volatile, true, `${key} is volatile (live edit, no restart)`);
  }
  assert.notEqual(Config.dict.pricing.meta.volatile, true, "pricing stays ordinary: peak-hour edits must re-fold via restart");
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

console.log("host-test: route, windowing, dedupe, settings surface and update check all passed");
