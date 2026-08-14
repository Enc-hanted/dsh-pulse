/**
 * Host-half integration test: mounts the plugin against stubbed harness
 * services and exercises the real `/pulse/stats` route handler, the in-flight
 * dedupe, and the `/pulse` command handler end to end.
 */

import { strict as assert } from "node:assert";
import { apply } from "../src/index.js";
import { localDay } from "../src/aggregate.js";

const DAY = 86400000;
const noon = (offsetDays) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d.getTime() + offsetDays * DAY;
};
const today = () => localDay(Date.now());
const daysAgo = (n) => localDay(noon(-n));

const liveValues = {
  pulseUsage: {
    byDay: { [daysAgo(1)]: { input: 100, output: 50, cacheRead: 900, cacheWrite: 10 } },
    modelsByDay: { [daysAgo(1)]: { "deepseek-v4-flash": { input: 100, output: 50, cacheRead: 900, cacheWrite: 10 } } },
    hoursByDay: { [daysAgo(1)]: { "12": { "deepseek-v4-flash": { input: 100, output: 50, cacheRead: 900, cacheWrite: 10 } } } },
    turnsByDay: { [daysAgo(1)]: 2 },
    toolCallsByDay: { [daysAgo(1)]: 3 },
    firstDay: daysAgo(1),
  },
};
const coldValues = {
  pulseUsage: {
    byDay: { [daysAgo(3)]: { input: 7, output: 3, cacheRead: 0, cacheWrite: 0 } },
    modelsByDay: { [daysAgo(3)]: { "deepseek-v4-pro": { input: 7, output: 3, cacheRead: 0, cacheWrite: 0 } } },
    turnsByDay: { [daysAgo(3)]: 1 },
    toolCallsByDay: {},
    firstDay: daysAgo(3),
  },
};

const routes = [];
const commands = [];
let registeredUnit = null;
const coldReads = [];
const ctx = {
  sessionProjections: {
    register: (definition) => { registeredUnit = definition; return () => {}; },
    snapshot: (session) => ({ asOfSeq: 5, values: session.id === "live1" ? liveValues : {} }),
  },
  sessionQuery: {
    listSessions: async () => [
      { header: { id: "live1", createdAt: noon(-1), cwd: "D:\\DSH\\demo" }, live: true, persisted: true },
      { header: { id: "cold1", createdAt: noon(-3), cwd: "/home/x/repo", origin: "subagent" }, live: false, persisted: true },
      { header: { id: "broken1", createdAt: noon(-9), cwd: "D:\\DSH\\x" }, live: false, persisted: true },
    ],
  },
  sessions: { get: (id) => (id === "live1" ? { id } : undefined) },
  sessionProjectionCache: {
    coldSnapshot: async (id) => {
      coldReads.push(id);
      if (id === "broken1") throw new Error("no persisted log");
      return { asOfSeq: 4, values: coldValues };
    },
  },
  webServer: { register: (route) => { routes.push(route); return () => {}; } },
  commands: { register: (definition) => { commands.push(definition); return () => {}; } },
  effect: (fn) => { const disposer = fn(); return () => { if (typeof disposer === "function") disposer(); }; },
  logger: { warn: () => {} },
};

const config = { defaultDays: 30, topProjects: 8, pricing: [] };
apply(ctx, config);

// --- the projection unit registered with the official contract --------------
assert.notEqual(registeredUnit, null, "projection unit registered");
assert.equal(registeredUnit.key, "pulseUsage");
assert.equal(registeredUnit.stateVersion, 2);
assert.deepEqual(registeredUnit.view(registeredUnit.init()), {
  byDay: {}, modelsByDay: {}, hoursByDay: {}, turnsByDay: {}, toolCallsByDay: {}, firstDay: null,
});
assert.equal(routes.length, 1, "/pulse route registered");
assert.equal(routes[0].kind, "prefix");
assert.equal(routes[0].path, "/pulse");
assert.equal(commands.length, 1, "/pulse command registered");

// --- one HTTP request through the real handler --------------------------------
function serve(url) {
  return new Promise((resolve) => {
    let status = 0;
    let body = "";
    const res = {
      writeHead: (code) => { status = code; },
      end: (chunk) => { body = chunk === undefined ? "" : String(chunk); resolve({ status, body }); },
    };
    routes[0].handler({ url, method: "GET", socket: { once: () => {} } }, res);
  });
}

const { status, body } = await serve(`/pulse/stats?from=${daysAgo(4)}&to=${today()}`);
assert.equal(status, 200);
const payload = JSON.parse(body);
assert.equal(payload.schema, 3);
assert.equal(payload.fromDay, daysAgo(4));
assert.equal(payload.toDay, today());
assert.equal(payload.topProjects, 8);
assert.equal(payload.sessions.length, 2, "broken session skipped, never fatal");
const live = payload.sessions.find((s) => s.id === "live1");
const cold = payload.sessions.find((s) => s.id === "cold1");
assert.equal(live.project, "demo");
assert.equal(live.day, daysAgo(1));
assert.deepEqual(live.byDay[daysAgo(1)], { input: 100, output: 50, cacheRead: 900, cacheWrite: 10 });
assert.deepEqual(live.hoursByDay[daysAgo(1)]["12"]["deepseek-v4-flash"], { input: 100, output: 50, cacheRead: 900, cacheWrite: 10 });
assert.equal(cold.subagent, true);
assert.equal(cold.project, "repo");
assert.equal(cold.day, daysAgo(3));
assert.deepEqual(cold.turnsByDay, { [daysAgo(3)]: 1 });

// window slicing: a range before the cold session's activity drops it
const narrow = JSON.parse((await serve(`/pulse/stats?from=${daysAgo(2)}&to=${today()}`)).body);
assert.equal(narrow.sessions.length, 1);
assert.equal(narrow.sessions[0].id, "live1");

// invalid bounds fall back to the configured default window
const fallback = JSON.parse((await serve(`/pulse/stats?from=banana&to=${today()}`)).body);
assert.equal(fallback.fromDay, localDay(noon(-29)));
assert.equal(fallback.toDay, today());

// `?days=` stays accepted for backward compatibility
const legacy = JSON.parse((await serve("/pulse/stats?days=7")).body);
assert.equal(legacy.fromDay, localDay(noon(-6)));

// non-JSON paths 404
assert.equal((await serve("/pulse/other")).status, 404);

// --- in-flight dedupe: concurrent identical windows share one cold read -------
const before = coldReads.length;
const [a, b] = await Promise.all([
  serve(`/pulse/stats?from=${daysAgo(4)}&to=${today()}`),
  serve(`/pulse/stats?from=${daysAgo(4)}&to=${today()}`),
]);
assert.equal(JSON.parse(a.body).schema, 3);
assert.equal(JSON.parse(b.body).schema, 3);
assert.ok(coldReads.length <= before + 3, "shared flight reads the cold corpus once");

// --- the command handler returns a text summary ------------------------------
const result = await commands[0].handler({ signal: undefined });
assert.equal(result.kind, "success");
assert.ok(result.text.includes("Sessions 2"), `summary mentions sessions: ${result.text}`);
assert.ok(result.text.includes("Tokens in"), `summary mentions tokens: ${result.text}`);

console.log("host-test: route, windowing, dedupe and command all passed");
