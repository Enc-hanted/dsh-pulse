/**
 * client-smoke-test.mjs — execute the dashboard's derived-model hook for real.
 *
 * The canvas matrix renders the hand-mirrored hero-canvas harness, not the
 * React tree, and esbuild cannot flag a name that is used in one function
 * scope but declared in another (it bundles happily). That left exactly one
 * runtime blind spot on the client — the model hook, the refactor magnet —
 * and it cost a shipped `ReferenceError: trendStack is not defined` that
 * every green suite missed. This suite closes it: bundle
 * src/client/dashboard.js for node (react stubbed through the module
 * loader), call {@link useDashboardModel} directly with a model-split
 * payload, and assert the by-model projection for both stack modes. A name
 * that escapes its scope after a move dies here instead of in the browser.
 *
 * Coverage note: direct calls execute the hook's straight-through path
 * (single-day window, two models, cost enabled); branches behind early
 * returns stay with the browser. Stub semantics are deliberately shallow —
 * useState returns the seed, useMemo runs its factory, effects never fire
 * (no fetch, no listeners), so the run is synchronous and side-effect free.
 *
 *   node test/client-smoke-test.mjs
 */

import { strict as assert } from "node:assert";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { createRequire } from "node:module";
import Module from "node:module";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The host module table's names, straight from the manifest — the same
 *  list build-client.mjs marks external, so the contract cannot drift. */
const manifest = JSON.parse(await readFileSync(join(root, "package.json"), "utf8"));
const externals = manifest.dsh?.client?.external ?? [];

/** Minimal react: enough semantics for a synchronous hook body to run. */
const reactStub = {
	useState: (init) => [typeof init === "function" ? init() : init, () => {}],
	useEffect: () => {},
	useMemo: (factory) => factory(),
	useRef: (value) => ({ current: value }),
	useSyncExternalStore: (_subscribe, getSnapshot) => {
		try { return getSnapshot(); } catch { return undefined; }
	},
	forwardRef: (fn) => fn,
};
const jsxStub = {
	jsx: (type, props) => ({ type, props }),
	jsxs: (type, props) => ({ type, props }),
};

/** The bundle's externals are the host module table's job; here the module
 *  loader plays that table — real stubs for react, inert namespaces for the
 *  rest (the hook path only probes them with `??` fallbacks). */
const origLoad = Module._load;
Module._load = function (request, ...rest) {
	if (request === "react") return reactStub;
	if (request === "react/jsx-runtime") return jsxStub;
	if (externals.includes(request)) return {};
	return origLoad.call(this, request, ...rest);
};

const bundle = await esbuild.build({
	entryPoints: [join(root, "src", "client", "dashboard.js")],
	bundle: true,
	format: "cjs",
	platform: "browser",
	target: "es2022",
	external: externals,
	write: false,
	logLevel: "warning",
});
const bundlePath = join(tmpdir(), `dsh-pulse-client-smoke-${process.pid}.cjs`);
writeFileSync(bundlePath, bundle.outputFiles[0].text);

try {
	const require = createRequire(import.meta.url);
	const dashboard = require(bundlePath);

	/** Schema-3 session fixture, same shape view-test folds. Two models on
	 *  one day: the split exists, the window is hourly, cost is enabled. */
	const today = "2026-09-28";
	const rec = (model, input) => ({
		project: "alpha", subagent: false, day: today,
		byDay: { [today]: { input, output: 0, cacheRead: 0, cacheWrite: 0 } },
		modelsByDay: { [today]: { [model]: { input, output: 0, cacheRead: 0, cacheWrite: 0 } } },
		hoursByDay: { [today]: { "10": { [model]: { input, output: 0, cacheRead: 0, cacheWrite: 0 } } } },
		turnsByDay: {}, toolCallsByDay: {},
	});
	const data = {
		fromDay: today, toDay: today, today,
		sessions: [rec("ma", 1_000_000), rec("mb", 2_000_000)],
		pricing: [], fx: {}, monthly: [],
		auxShape: null,
		balanceSeries: [],
		modelColors: {},
		costEnabled: true,
	};
	const base = {
		data,
		range: { from: today, to: today },
		project: "",
		models: [],
		panels: { trend: true, costTrend: true },
		theme: "dark",
		t: (key) => key,
	};

	// --- the incident: trendStack must arrive from the component's state ----
	const tokens = dashboard.useDashboardModel({ ...base, trendStack: "token" });
	assert.equal(tokens.hasModelSplit, true, "two models in the fold = the split exists");
	assert.equal(tokens.byModel, false, "the token stack keeps the trend on token types");
	assert.equal(tokens.modelLegendRows, null, "no legend while stacked by token type");

	const models = dashboard.useDashboardModel({ ...base, trendStack: "model" });
	assert.equal(models.byModel, true, "the model stack flips the projection");
	assert.ok(Array.isArray(models.modelLegendRows) && models.modelLegendRows.length === 2,
		"one legend row per model in the window");
	assert.deepEqual([...models.modelLegendRows.map((row) => row.key)].sort(), ["ma", "mb"],
		"the legend covers exactly the window's models (order is the fold's)");

	// --- the rest of the hook's model: shapes the dashboard render consumes --
	assert.ok(models.view !== null && models.view.models.length === 2, "the view folds both models");
	assert.ok(Array.isArray(models.sessionGroupsData) && models.sessionGroupsData.length >= 1,
		"session groups fold (the two fixtures share one project)");
	assert.equal(models.hourly, true, "a single-day window renders the intraday hour line");
	assert.ok(Array.isArray(models.hours) && models.hours.length > 0, "the hour series folds");
	assert.ok(Array.isArray(models.hourlyCost?.hours) && models.hourlyCost.hours.length === 24,
		"the hourly cost series folds under costEnabled (24 hour buckets)");
	assert.ok(Array.isArray(models.costDays) && models.costDays.length === 1, "the daily cost series folds");
	assert.ok(Array.isArray(models.recon) && models.recon.length === 1, "the recon covers the one day");
	assert.ok(models.calib && models.calib.shape && typeof models.calib.shape === "object", "calibration yields a shape");
	assert.equal(typeof models.auxTip, "string", "the aux tooltip composes");
	assert.ok(models.auxTip.length > 0, "the aux tooltip is non-empty");
} finally {
	Module._load = origLoad;
	rmSync(bundlePath, { force: true });
}

console.log("client-smoke: useDashboardModel executes clean under react stubs (both stack modes)");
