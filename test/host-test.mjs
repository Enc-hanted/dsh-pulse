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
function makeCtx({ withSettings, withLlm = false, deferSettings = false, withCredentials = false, withStorageDomain = false, legacyCache = false, alphaCache = false }) {
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
  const fetchCalls = [];
  const fakeCredentials = {
    resolve: async (ref) => (String(ref) === "DEEPSEEK_API_KEY"
      ? { value: "sk-test-SECRET-value", source: "file" }
      : undefined),
  };
  const fakeDomain = {
    global: {
      get: () => balanceState,
      set: async (value) => { balanceState = value; },
    },
    close: async () => {},
  };
  const fakeStorageDomain = { open: async () => fakeDomain };

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
    listProviders: () => [{ id: "deepseek-official", name: "DeepSeek" }],
    listModels: async (provider) => (provider === "deepseek-official"
      ? [
        { provider, id: "deepseek-v4-flash", name: "DeepSeek-V4-Flash" },
        { provider, id: "deepseek-v4-pro", name: "DeepSeek-V4-Pro" },
        { provider, id: "third-party-x", name: "Third Party X" },
      ]
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
}

// --- environment with a settings service: full wiring ------------------------
const env = makeCtx({ withSettings: true, withLlm: true });
apply(env.ctx, config);

// --- the projection unit registered with the official contract --------------
assert.notEqual(env.unit(), null, "projection unit registered");
assert.equal(env.unit().key, "pulseUsage");
assert.equal(env.unit().stateVersion, 7);
assert.equal(env.registerCount(), 1, "one registration at load");
assert.deepEqual(env.unit().view(env.unit().init()), {
  byDay: {}, modelsByDay: {}, hoursByDay: {}, tiersByDay: {}, turnsByDay: {}, toolCallsByDay: {}, firstDay: null,
});
assert.equal(env.routes.length, 1, "/pulse route registered");
assert.equal(env.routes[0].kind, "prefix");
assert.equal(env.routes[0].path, "/pulse");
assert.equal(env.commands.length, 1, "/pulse command registered");

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
assert.equal(env.unit().stateVersion, 8, "bumped state version invalidates persisted rows");
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
assert.equal(env.unit().stateVersion, 10);

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

// --- the command handler returns a text summary ------------------------------
const result = await env.commands[0].handler({ signal: undefined });
assert.equal(result.kind, "success");
assert.ok(result.text.includes("Sessions 3"), `summary mentions sessions: ${result.text}`);
assert.ok(result.text.includes("Tokens in"), `summary mentions tokens: ${result.text}`);
assert.ok(result.text.includes("Estimated cost") && result.text.includes("CNY"), `summary shows a CNY estimate: ${result.text}`);

// with cost disabled the command omits the cost line entirely
const disabledCmd = JSON.parse((await env.serve("/pulse/settings", { method: "POST", body: { costEnabled: false, pricing: [] } })).body);
assert.equal(disabledCmd.ok, true);
const resultNoCost = await env.commands[0].handler({ signal: undefined });
assert.ok(!resultNoCost.text.includes("Estimated cost"), "cost line hidden when disabled");

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

// --- /pulse/session: event-level timeline (break-analysis source) -------------
{
  const env = makeCtx({ withSettings: true });
  apply(env.ctx, config);
  const tl = JSON.parse((await env.serve("/pulse/session?id=live1")).body);
  assert.equal(tl.id, "live1");
  assert.equal(tl.header.origin, "main");
  assert.equal(tl.events.length, 1, "only the usage-bearing assistant/message lands");
  assert.deepEqual(tl.events[0], { t: noon(-1) + 1000, i: 100, o: 50, cr: 900, cw: 10, key: "deepseek-official\u0000deepseek-v4-flash" });
  assert.deepEqual(tl.turns, [{ start: noon(-1), end: noon(-1) + 5000 }]);
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

console.log("host-test: route, windowing, dedupe, settings surface and command all passed");
