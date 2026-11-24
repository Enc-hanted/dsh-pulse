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
import { zh as localeZh } from "../src/client/locale.js";
import { SEED_CARD } from "../src/pricing-facts.js";

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
let footPath = null;
let gatePath = null;
let panelsPath = null;

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

	// --- phase 2: the foot bundle — the shared cache's envelope contract ------
	// The footer's useFootWindow reads the SAME Map loadStats writes; when the
	// two disagreed on the entry shape the footer decoded {at,payload} as a
	// sessionless body and silently read ZERO tokens. Effects run here, so the
	// hook's cache/fetch dance executes for real against a stubbed fetch.
	Module._load = origLoad; // drop the dashboard stub before re-patching
	const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
	// The hook now carries the store's freshness driver (a visibility-gated
	// setInterval + a visibilitychange listener), so the stub must give it a
	// document to talk to and must run the effects' cleanups — a leaked 60 s
	// timer would hold the process open and fire into a torn-down hook.
	const footCleanups = [];
	const priorFootDocument = globalThis.document;
	globalThis.document = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };
	const footReact = {
		useState: (init) => [typeof init === "function" ? init() : init, () => {}],
		useEffect: (fn) => { const cleanup = fn(); if (typeof cleanup === "function") footCleanups.push(cleanup); },
		useMemo: (factory) => factory(),
		useRef: (value) => ({ current: value }),
		useSyncExternalStore: (_subscribe, getSnapshot) => {
			try { return getSnapshot(); } catch { return undefined; }
		},
		forwardRef: (fn) => fn,
	};
	const footJsx = {
		jsx: (type, props) => ({ type, props }),
		jsxs: (type, props) => ({ type, props }),
	};
	Module._load = function (request, ...rest) {
		if (request === "react") return footReact;
		if (request === "react/jsx-runtime") return footJsx;
		if (externals.includes(request)) return {};
		return origLoad.call(this, request, ...rest);
	};
	const footBundle = await esbuild.build({
		stdin: {
			contents: `export * from "./foot.js";\nexport { quotaEntryName, quotaEntryShort } from "./quota.js";\nexport { PAYLOAD_CACHE_MS, fetchStatsPayload, payloadCache } from "./stores.js";`,
			resolveDir: join(root, "src", "client"),
			sourcefile: "foot-entry.js",
		},
		bundle: true,
		format: "cjs",
		platform: "browser",
		target: "es2022",
		external: externals,
		write: false,
		logLevel: "warning",
	});
	footPath = join(tmpdir(), `dsh-pulse-foot-smoke-${process.pid}.cjs`);
	writeFileSync(footPath, footBundle.outputFiles[0].text);
	const foot = require(footPath);

	const FROM = "2026-09-22";
	const TO = "2026-09-28";
	const key = `${FROM}:${TO}`;
	const reply = { schema: 4, sessions: [{ project: "alpha", byDay: { [TO]: { input: 5, output: 0, cacheRead: 0, cacheWrite: 0 } } }] };
	let fetchCalls = 0;
	const priorFetch = globalThis.fetch;
	globalThis.fetch = async () => {
		fetchCalls += 1;
		return { ok: true, json: async () => reply };
	};
	try {
		// A fresh {at,payload} entry renders from the cache — no fetch.
		foot.payloadCache.set(key, { at: Date.now(), payload: { sessions: [] } });
		foot.useFootWindow(FROM, TO);
		await tick();
		assert.equal(fetchCalls, 0, "a fresh envelope entry serves the cached payload");
		// A stale entry is dropped and refetched; the reply lands as the
		// ENVELOPE — a bare body here would zero loadStats' TTL read
		// (Date.now() - entry.at is NaN → every cached window invisible).
		foot.payloadCache.set(key, { at: Date.now() - foot.PAYLOAD_CACHE_MS - 1, payload: { sessions: [] } });
		foot.useFootWindow(FROM, TO);
		await tick();
		assert.equal(fetchCalls, 1, "a stale envelope entry is refetched, not served");
		const stored = foot.payloadCache.get(key);
		assert.ok(stored !== undefined && typeof stored.at === "number" && stored.payload === reply,
			"the footer writes the store's {at,payload} envelope, not a bare body");
		// The footer lands through the ONE landing path now: a body without a
		// known schema is refused (the old footer hook accepted anything).
		globalThis.fetch = async () => ({ ok: true, json: async () => ({ sessions: [] }) });
		foot.payloadCache.delete(key);
		await assert.rejects(foot.fetchStatsPayload(FROM, TO), /unexpected payload schema/,
			"fetchStatsPayload refuses a schema-less body");
	} finally {
		globalThis.fetch = priorFetch;
		for (const cleanup of footCleanups.splice(0)) cleanup();
		globalThis.document = priorFootDocument;
		foot.payloadCache.delete(key);
	}

	// The tip rows and the button's aria name share one composition, so what a
	// screen reader hears is exactly the float's first rows (minus the
	// suggestion, which carries the interactive actions now). The real zh
	// dictionary drives `t` — an identity stub would leave `{v}` unfilled and
	// prove nothing about the copy.
	const t = (k) => String(localeZh[k] ?? k);
	const official = { kind: "official", balance: { configured: true, ok: true, total: 5, granted: 2, topped: 0, currency: "CNY" } };
	const split = { in: 300, out: 100 };
	const rows = foot.footTipRows({ source: official, peak: true, todayTok: 400, todaySplit: split, t });
	assert.equal(rows[0], "官方余额", "the head row names the source");
	assert.equal(rows[1], "¥5.00", "money rides quotaMoney's single exit");
	assert.ok(rows.includes("当前高峰时段"), "the tier line survives");
	assert.equal(rows[rows.length - 2], "今日 400 tok", "today's total stays the third segment's wording");
	assert.equal(rows[rows.length - 1], "入 300 · 出 100", "the in/out split rides footTodaySplit");
	assert.ok(!rows.includes(String(localeZh.footHintLine)), "the suggestion is not a text row anymore — it is the action row");
	assert.equal(
		foot.footAriaLabel({ source: official, peak: true, todayTok: 400, todaySplit: split, t }),
		["打开用量观测台", "官方余额", "¥5.00", "赠送 ¥2.00", "当前高峰时段"].join(" · "),
		"aria = purpose · the first four plain rows (balance readable without hovering)",
	);
	const quotaRows = foot.footTipRows({
		source: { kind: "quota", route: "kimi", entry: { provider: "kimi", label: "Kimi", windows: [{ id: "5h", usedPct: 42.4, resetsAt: Date.now() + 60000 }] } },
		peak: false, todayTok: 0, todaySplit: null, t,
	});
	assert.equal(quotaRows[0], "Kimi", "a subscription is named by its entry");
	assert.ok(quotaRows[1].startsWith("5小时 42%"), "a window row reads label + rounded pct");
	assert.ok(!quotaRows.some((row) => row.includes("· 0")), "no split row when todaySplit is absent");
	// The fee row goes through quotaMonthlyFee (the quota panel's one monthly
	// exit), never the raw amount: a yearly actualPrice of ¥1251.60 reads as
	// ¥104.30 a month, and a cycle the map does not know shows no fee at all
	// rather than a wrong one with "/月" welded on.
	const feeRows = (fee) => foot.footTipRows({
		source: { kind: "quota", route: "zai", entry: { provider: "zai", label: "GLM Coding Pro", windows: [], fee } },
		peak: false, todayTok: 0, todaySplit: null, t,
	});
	assert.ok(feeRows({ amount: 1251.6, currency: "CNY", cycle: "yearly" }).includes("¥104.30/月"), "a yearly fee is normalized to its monthly share");
	assert.ok(feeRows({ amount: 199, currency: "CNY", cycle: "monthly" }).includes("¥199.00/月"), "a monthly fee passes through the same exit");
	assert.ok(!feeRows({ amount: 1251.6, currency: "CNY", cycle: "lifetime" }).some((row) => row.endsWith("/月")), "an unknown cycle shows no fee row");

	// The squeezed footer tier's compact name: the spec's declared short
	// brand word wins; without one the full name's first word stands in —
	// a truncation-free degradation (the tip and the aria keep the full name).
	assert.equal(foot.quotaEntryShort({ short: "GLM", label: "GLM Coding Plan" }), "GLM", "a declared short wins");
	assert.equal(foot.quotaEntryShort({ label: "Kimi For Coding" }), "Kimi", "no short → the first word stands in");
	assert.equal(foot.quotaEntryShort({ plan: { name: "智谱 GLM Coding" }, label: "zai" }), "智谱", "the plan name feeds the first-word fallback");

	// The fallback float is part of the exported face: hosts whose primitives
	// predate the official Float must still mount the tip (US-15's actions
	// live only in it) — a dropped export would strand them back on the
	// native title.
	assert.equal(typeof foot.FootFloat, "function", "the self-drawn float exports for hosts without the official Float");

	// --- phase 3: the CSV export — money columns follow the display currency -
	// The export must convert through view.js's single numeric exit
	// (displayAmount) with the SAME module state the bundle renders faces
	// from, so applyDisplay rides inside the bundle and flips both at once.
	// buildDailyCsv is split from the DOM side exactly so this can pin the
	// text without a document.
	const csvBundle = await esbuild.build({
		stdin: {
			contents: `export * from "./csv.js";\nexport { applyDisplay } from "./../view.js";`,
			resolveDir: join(root, "src", "client"),
			sourcefile: "csv-entry.js",
		},
		bundle: true,
		format: "cjs",
		platform: "browser",
		target: "es2022",
		external: externals,
		write: false,
		logLevel: "warning",
	});
	const csvPath = join(tmpdir(), `dsh-pulse-csv-smoke-${process.pid}.cjs`);
	writeFileSync(csvPath, csvBundle.outputFiles[0].text);
	const csvMod = require(csvPath);
	try {
		const t = (k) => String(localeZh[k] ?? k);
		const day = "2026-09-28";
		const csvArgs = {
			t,
			view: { buckets: [{ key: day, sessions: 2, input: 1000, cacheRead: 500, cacheWrite: 0, output: 800, auxSearch: 1, auxTitle: 0 }] },
			costDays: [{ key: day, peak: 6.8, offpeak: 0 }],
			balanceSeries: [{ key: day, spend: 7.2 }],
			fromDay: day, toDay: day,
		};
		// CNY mode: the exported numbers ARE the internal CNY sums.
		const cnyLines = csvMod.buildDailyCsv(csvArgs).replace(/^\uFEFF/, "").split("\r\n");
		assert.equal(cnyLines[0], "币种:CNY", "the title row names the currency");
		assert.equal(cnyLines[1].split(",")[10], "费用 (CNY)", "…and the money headers do too");
		const cnyRow = cnyLines[2].split(",");
		assert.equal(cnyRow[10], "6.8", "cost rides the display exit (CNY = pass-through)");
		assert.equal(cnyRow[11], "7.2", "official spend follows the same exit");
		assert.equal(cnyRow[12], "0.4", "the recon gap is converted after the internal CNY subtraction");
		// USD mode: same payload, the display exit divides; nothing else moves.
		csvMod.applyDisplay("USD", 6.8);
		const usdLines = csvMod.buildDailyCsv(csvArgs).replace(/^\uFEFF/, "").split("\r\n");
		assert.equal(usdLines[0], "币种:USD", "the title row follows the display currency");
		assert.equal(usdLines[1].split(",")[10], "费用 (USD)", "money headers re-render in the display currency");
		const usdRow = usdLines[2].split(",");
		assert.equal(Number(usdRow[10]), 1, "cost cell converts (6.8 CNY @ 6.8 → 1 USD)");
		assert.ok(Math.abs(Number(usdRow[11]) - 7.2 / 6.8) < 1e-6, "spend cell converts");
		assert.ok(Math.abs(Number(usdRow[12]) - 0.4 / 6.8) < 1e-6, "gap cell converts");
		const usdGrand = usdLines[usdLines.length - 1].split(",");
		assert.equal(Number(usdGrand[10]), 1, "the totals row converts its CNY sum at write time");
	} finally {
		csvMod.applyDisplay("CNY");
		rmSync(csvPath, { force: true });
	}

	// --- phase 4: the echoed-card gate — version skew degrades to "ignore" ---
	// applyEchoedCard is the ONE door every payload-echoed card walks through:
	// only cardSchema 3 applies, and a card the bundle cannot derive
	// (throwing inside applyCard's derive) must never reject the fetch that
	// carried good stats data — the dashboard would blank over numbers it
	// already holds. A skewed echo therefore degrades to keeping the current
	// facts, never a white screen.
	const gateBundle = await esbuild.build({
		stdin: {
			contents: `export { applyEchoedCard } from "./stores.js";\nexport { activeCard } from "../pricing-facts.js";`,
			resolveDir: join(root, "src", "client"),
			sourcefile: "gate-entry.js",
		},
		bundle: true, format: "cjs", platform: "browser", target: "es2022",
		external: externals, write: false, logLevel: "warning",
	});
	const gatePath2 = join(tmpdir(), `dsh-pulse-gate-smoke-${process.pid}.cjs`);
	gatePath = gatePath2;
	writeFileSync(gatePath, gateBundle.outputFiles[0].text);
	const gate = require(gatePath);
	{
		const okCard = {
			cardSchema: 3, version: 99, checkedAt: "2026-11-18", source: "test",
			pricing: {
				usdToCny: 6.8, peakHours: [9], auxPriceAs: "deepseek-flash",
				auxShape: { miss: 1, hit: 1, out: 1 }, modelAliases: {},
				schedules: [{ from: "2020-01-01", rules: [{ model: "m", input: 1, cacheRead: 0, output: 1 }] }],
				feeWindows: [{ appliesTo: "server-side-search", from: "2020-01-01", until: "2099-01-01T00:00:00+08:00", cnyPerCall: 0 }],
			},
			calendar: { holidays: [] },
		};
		gate.applyEchoedCard(okCard, "imported");
		assert.equal(gate.activeCard().card.version, 99, "a schema-3 card applies through the gate");
		gate.applyEchoedCard({ ...okCard, cardSchema: 4, version: 100 }, "imported");
		assert.equal(gate.activeCard().card.version, 99, "a schema-4 (skewed) echo is ignored");
		gate.applyEchoedCard(null, "imported");
		gate.applyEchoedCard("junk", "imported");
		gate.applyEchoedCard(undefined, undefined);
		assert.equal(gate.activeCard().card.version, 99, "non-object echoes no-op");
		assert.doesNotThrow(() => gate.applyEchoedCard({ cardSchema: 3, version: 101 }, "imported"),
			"a schema-3 card the derive cannot read degrades inside the gate, never throws");
		assert.equal(gate.activeCard().card.version, 99, "…and the facts stay on the last good card");
	}

	// --- phase 5: the settings panels' conflict + two-step confirm contracts --
	// The mutation flows are user-visible failure modes: a 409 must reset the
	// busy/saving flags (a locked source selector was the drift), rejections
	// must surface instead of a stale「已保存」, and the destructive buttons
	// arm before they fire. A mini-react (per-component hook store, effects
	// once) renders each panel for real; fetch answers per URL; the tree is
	// plain records so the test can click it.
	const panelsBundle = await esbuild.build({
		stdin: { contents: `export { PulseCardPanel, FootSourcePanel, QuotaQueryPanel } from "./panels.js";\nexport { PricingPage } from "./settings.js";`, resolveDir: join(root, "src", "client"), sourcefile: "panels-entry.js" },
		bundle: true, format: "cjs", platform: "browser", target: "es2022",
		external: externals, write: false, logLevel: "warning",
	});
	const panelsPath2 = join(tmpdir(), `dsh-pulse-panels-smoke-${process.pid}.cjs`);
	panelsPath = panelsPath2;
	writeFileSync(panelsPath, panelsBundle.outputFiles[0].text);

	// One react module shared by all harnesses; the owner pointer routes each
	// hook call to the component instance currently rendering.
	let owner = null;
	const miniReact = {
		react: {
			useState(init) {
				const h = owner;
				const i = h.cursor++;
				if (!(i in h.hooks)) h.hooks[i] = typeof init === "function" ? init() : init;
				return [h.hooks[i], (next) => {
					h.hooks[i] = typeof next === "function" ? next(h.hooks[i]) : next;
					h.render();
				}];
			},
			useEffect(fn) { owner.effects.push(fn); },
			useMemo: (factory) => factory(),
			useRef: (value) => ({ current: value }),
			useSyncExternalStore: (_subscribe, getSnapshot) => { try { return getSnapshot(); } catch { return undefined; } },
			forwardRef: (fn) => fn,
		},
		jsxMod: {
			jsx: (type, props) => ({ type, props: props ?? {}, children: props?.children }),
			jsxs: (type, props) => ({ type, props: props ?? {}, children: props?.children }),
		},
	};
	Module._load = function (request, ...rest) {
		if (request === "react") return miniReact.react;
		if (request === "react/jsx-runtime") return miniReact.jsxMod;
		if (externals.includes(request)) return {};
		return origLoad.call(this, request, ...rest);
	};
	const panels = require(panelsPath);
	const settingsMod = panels;

	// usePolledEndpoint's mount effect binds document/window listeners; node
	// has neither, so one inert pair is enough (the poll timer is never left
	// running — the harness runs effects once and never unmounts).
		const priorDocument = globalThis.document;
		const priorWindow = globalThis.window;
		const priorSetInterval = globalThis.setInterval;
		const heldTimers = [];
		globalThis.document = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };
		globalThis.window = { addEventListener() {}, removeEventListener() {} };
		// The panels' poll hooks keep a 60 s timer alive; record and clear every
		// interval so the node process can actually exit after this phase.
		globalThis.setInterval = (fn, ms, ...rest) => { const handle = priorSetInterval(fn, ms, ...rest); heldTimers.push(handle); return handle; };

	const tZh = (k) => String(localeZh[k] ?? k);
	const flatten = (children) => {
		if (children === null || children === undefined) return "";
		if (Array.isArray(children)) return children.map(flatten).join("");
		if (typeof children === "object" && children !== null && children.type !== undefined) return flatten(children.props?.children);
		return String(children);
	};
	const els = (tree) => {
		const out = [];
		const walk = (node) => {
			if (node === null || node === undefined || typeof node !== "object") return;
			if (Array.isArray(node)) { node.forEach(walk); return; }
			if (node.type === undefined) return;
			// Btn/Seg/Checkbox are plain function components (the adapter's
			// fallback path carries no hooks) — expand them so the native
			// button/select leaves become visible to the click walker.
			if (typeof node.type === "function") { walk(node.type(node.props ?? {})); return; }
			out.push(node);
			walk(node.props?.children);
		};
		walk(tree);
		return out;
	};
	const buttonOf = (tree, label) => els(tree).find((el) => el.type === "button" && flatten(el.props?.children).includes(label));
	const harness = (comp) => {
		const h = {
			hooks: [], cursor: 0, effects: [], tree: null,
			render() {
				owner = h;
				h.cursor = 0;
				h.tree = comp({ t: tZh, React: miniReact.react });
			},
		};
		h.render();
		for (const fn of h.effects.splice(0, h.effects.length)) fn();
		return h;
	};
	// 12 ticks: writeSettings' conflict path (read → post → re-read → retry
	// post → panel reload) is nearly twice the hops of a single post.
	const settle = async () => { for (let i = 0; i < 12; i += 1) await tick(); };
	const click = (el) => el.props.onClick({ target: {} });

	{
		const posts = [];
		let conflictMode = false;
		let fullCard = false;
		// The host refuses any write whose revision isn't the current one,
		// conflictMode or not — a stale mount-time revision must never land.
		let rev = 7;
		const customSpec = {
			id: "custom-r1", label: "Route One", routes: ["r1"], hosts: [{ base: "https://r1.example" }], auth: "bearer",
			requests: [{ id: "quota", path: "/u" }],
			windows: [{ id: "win", kind: "requests", windowMs: null, source: { request: "quota", path: "", mode: "single" }, pct: { aliases: ["pct"] } }],
		};
		const cardSpec = {
			id: "card-r2", label: "Route Two", routes: ["r2"], hosts: [{ base: "https://r2.example" }], auth: "bearer",
			requests: [{ id: "quota", path: "/q" }],
			windows: [{ id: "win", kind: "requests", windowMs: null, source: { request: "quota", path: "", mode: "single" }, pct: { aliases: ["pct"] } }],
		};
		const realFetch2 = globalThis.fetch;
		globalThis.fetch = async (input, init) => {
			const url = String(input);
			const method = init?.method ?? "GET";
			if (url === "/pulse/quota") return { ok: true, status: 200, json: async () => ({ providers: [
				{ provider: "r1", ok: true, label: "Route One", windows: [{ id: "7d", usedPct: 12 }] },
				{ provider: "r2", ok: true, label: "Route Two", windows: [{ id: "5h", usedPct: 5 }] },
			] }) };
			if (url === "/pulse/settings" && method === "GET") {
				return { ok: true, status: 200, json: async () => ({ footSource: "", quotaSpecs: { r1: customSpec }, providerSpecs: [cardSpec], catalog: [], writable: true, revision: rev }) };
			}
			if (url === "/pulse/settings" && method === "POST") {
				posts.push({ url, body: JSON.parse(init.body) });
				return conflictMode || posts[posts.length - 1].body?.revision !== rev
					? { ok: false, status: 409, json: async () => ({ ok: false, error: "conflict", conflict: { expected: rev, actual: rev + 1 } }) }
					: { ok: true, status: 200, json: async () => ({ ok: true, refold: false }) };
			}
			// The apply POST is recorded; the host's 422 path is host-test's
			// contract, so here an acknowledged apply simply lands.
			if (url === "/pulse/pricing-card" && method === "POST") {
				posts.push({ url, body: JSON.parse(init.body) });
				return { ok: true, status: 200, json: async () => ({ ok: true, refold: false }) };
			}
			if (url === "/pulse/pricing-card") {
				// `fullCard` swaps the mini card for the real seed once the
				// credential-routing case needs a diffable base.
				return { ok: true, status: 200, json: async () => ({ ok: true, card: fullCard ? SEED_CARD : { cardSchema: 3, version: 3, checkedAt: "2026-11-18" }, origin: "imported", seedVersion: 3, source: "https://x/ratecard.json" }) };
			}
			if (url === "/pulse/pricing-card/pull") {
				const retargeted = structuredClone(SEED_CARD);
				retargeted.providers[0].hosts[0].base = "https://elsewhere.example/v1";
				retargeted.version = SEED_CARD.version + 1;
				return { ok: true, status: 200, json: async () => ({ ok: true, card: retargeted, source: "https://x/ratecard.json" }) };
			}
			if (url === "/pulse/pricing-card/reset") {
				posts.push({ url, body: null });
				return { ok: true, status: 200, json: async () => ({ ok: true, refold: false }) };
			}
			return { ok: false, status: 404, json: async () => ({ ok: false, error: `unexpected ${url}` }) };
		};
		try {
			// FootSourcePanel: a 409 must reset `saving` — the selector locks on
			// it, so the old drift turned one conflict into a locked control —
			// and show the conflict copy. `conflictMode` flips BEFORE the change:
			// the stub reads it synchronously at fetch-call time.
			const foot = harness(panels.FootSourcePanel);
			await settle();
			let select = els(foot.tree).find((el) => el.type === "select");
			assert.ok(select !== undefined, "the source selector renders");
			assert.equal(select.props.disabled, false, "the selector starts unlocked");
			conflictMode = true;
			select.props.onChange({ target: { value: "kimi" } });
			await settle();
			select = els(foot.tree).find((el) => el.type === "select");
			assert.equal(select.props.disabled, false, "a 409 resets `saving` — the selector is NOT locked");
			assert.equal(select.props.value, "", "the choice was not applied (the refreshed copy wins)");
			const footErr = els(foot.tree).find((el) => String(el.props?.className ?? "").includes("dp_setMsgErr"));
			assert.ok(footErr !== undefined && flatten(footErr.props.children) === t("setConflict"), "the conflict copy shows, locale-wrapped");
			// The write-through skeleton auto-retried once with a re-read
			// revision before surfacing the (stubbed, persistent) conflict —
			// a benign race must not land on the user as an error.
			assert.equal(posts.filter((p) => p.body?.footSource !== undefined).length, 2,
				"a 409 on a direct write retries once with the fresh revision before surfacing");

			// QuotaQueryPanel: delete arms first, fires on the second click, and
			// a 409 reports itself instead of leaving a stale「已保存」.
			const qqp = harness(panels.QuotaQueryPanel);
			await settle();
			// The card-claimed route (r2) renders a read-only built-in preview:
			// the toggle reads 「查看内置」, the form opens with the shadow
			// warning ON TOP, disabled fields, and NO save button — filling six
			// fields before discovering the write was futile was the old clutter.
			const viewBtn = buttonOf(qqp.tree, t("queryViewBuiltin"));
			assert.ok(viewBtn !== undefined, "the claimed route's toggle reads 「查看内置」");
			click(viewBtn);
			assert.ok(els(qqp.tree).some((el) => flatten(el.props?.children) === t("queryShadowed")), "the shadow warning renders in the claimed preview");
			assert.ok(els(qqp.tree).filter((el) => el.type === "input" && el.props?.disabled === true).length >= 2, "the claimed preview's fields are read-only");
			assert.equal(buttonOf(qqp.tree, t("querySaveSpec")) === undefined, true, "no save button in the claimed preview");
			assert.ok(buttonOf(qqp.tree, t("queryDeleteSpec")) !== undefined, "the custom spec's delete button renders");
			click(buttonOf(qqp.tree, t("queryDeleteSpec")));
			const armed = buttonOf(qqp.tree, t("queryDeleteConfirm"));
			assert.ok(armed !== undefined, "the first click only ARMS (label flips to the confirm copy)");
			// Note: the armed state's primary VARIANT rides the official
			// primitives path; the adapter's fallback button carries no variant
			// prop, so the label flip is the observable arm signal here.
			assert.equal(posts.some((p) => p.url === "/pulse/settings" && p.body?.quotaSpecs !== undefined), false, "no write while armed");
			conflictMode = true;
			click(armed);
			await settle();
			assert.equal(posts.some((p) => p.url === "/pulse/settings" && p.body?.quotaSpecs !== undefined), true, "the second click executes the delete");
			const deletePost = posts.find((p) => p.url === "/pulse/settings" && p.body?.quotaSpecs !== undefined);
			assert.deepEqual(Object.keys(deletePost.body.quotaSpecs), [], "the delete computed a spec-free section (the server refused it)");
			// The panel-level conflict line, not the claimed route's shadow
			// warning — both wear dp_setMsgErr now, so match by copy.
			const qErr = els(qqp.tree).find((el) => String(el.props?.className ?? "").includes("dp_setMsgErr") && flatten(el.props?.children) === t("setConflict"));
			assert.ok(qErr !== undefined, "the refusal surfaces as the conflict copy");
			assert.equal(els(qqp.tree).some((el) => flatten(el.props?.children) === t("querySaved")), false, "no optimistic「已保存」after a refusal");
			assert.ok(buttonOf(qqp.tree, t("queryDeleteSpec")) !== undefined, "the button re-arms to its base label");

			// PulseCardPanel: 恢内置 arms first — one accidental click must not
			// throw away the whole runtime card.
			const cardPanel = harness(panels.PulseCardPanel);
			await settle();
			const resetBtn = buttonOf(cardPanel.tree, t("cardReset"));
			assert.ok(resetBtn !== undefined && resetBtn.props.disabled === false, "the reset button renders enabled for a non-bundled card");
			click(resetBtn);
			assert.ok(buttonOf(cardPanel.tree, t("cardResetConfirm")) !== undefined, "the first click only ARMS");
			assert.equal(posts.some((p) => p.url === "/pulse/pricing-card/reset"), false, "no reset POST while armed");
			conflictMode = false;
			click(buttonOf(cardPanel.tree, t("cardResetConfirm")));
			await settle();
			assert.equal(posts.some((p) => p.url === "/pulse/pricing-card/reset"), true, "the second click executes the reset");
			assert.equal(els(cardPanel.tree).some((el) => flatten(el.props?.children) === t("cardResetDone")), true, "the done line shows after the confirmed reset");

			// PulseCardPanel: a card that changes credential routing (routes /
			// hosts / auth / envKeys) lists those rows apart, keeps Apply
			// disabled until the acknowledgement is ticked, and only then
			// sends ackCredentials with the apply.
			fullCard = true;
			const routingPanel = harness(panels.PulseCardPanel);
			await settle();
			click(buttonOf(routingPanel.tree, t("cardPull")));
			await settle();
			const routingBox = els(routingPanel.tree).find((el) => el.props?.className === "dp_setRouting");
			assert.ok(routingBox !== undefined, "the routing block renders apart from the plain diff");
			assert.ok(/provider:zai-coding\.hosts\[0\]\.base: \S+ → https:\/\/elsewhere\.example\/v1/.test(flatten(routingBox.props.children)),
				"the block names the host change old → new");
			assert.equal(buttonOf(routingPanel.tree, t("cardApply")).props.disabled, true, "Apply stays disabled until the routing is acknowledged");
			const ack = els(routingPanel.tree).find((el) => el.type === "input" && el.props.type === "checkbox");
			assert.ok(ack !== undefined, "the acknowledgement checkbox renders");
			ack.props.onChange({ target: { checked: true } });
			const applyAcked = buttonOf(routingPanel.tree, t("cardApply"));
			assert.equal(applyAcked.props.disabled, false, "ticking it unlocks Apply");
			click(applyAcked);
			await settle();
			const applyPost = posts.find((p) => p.url === "/pulse/pricing-card" && p.body?.card !== undefined);
			assert.ok(applyPost !== undefined, "the acknowledged apply POSTs the card");
			assert.equal(applyPost.body.ackCredentials, true, "…and carries ackCredentials");
			fullCard = false;

			// PricingPage: persist rides writeSettings, so a revision another
			// panel bumped after mount must NOT 409 the save — the skeleton
			// re-reads the live revision per write. (The old mount-time
			// `state.revision` made every post-mount save hit 409.) The stub
			// refuses any write whose revision isn't current, so this only
			// passes when persist sends the fresh one.
			const pricing = harness(settingsMod.PricingPage);
			await settle();
			// loadStats resolves async; re-render so the stats snapshot reads
			// terminal and the settings effect fires (the harness's
			// useSyncExternalStore has no subscription to do it for us).
			pricing.render();
			for (const fn of pricing.effects.splice(0, pricing.effects.length)) fn();
			await settle();
			rev = 8; // another panel (Seg/开关) wrote since mount
			const saveBtn = buttonOf(pricing.tree, t("setSave"));
			assert.ok(saveBtn !== undefined && saveBtn.props.disabled === false, "the pricing save button renders unlocked");
			click(saveBtn);
			await settle();
			const pricingSave = posts.find((p) => p.url === "/pulse/settings" && p.body?.costEnabled !== undefined);
			assert.ok(pricingSave !== undefined, "the pricing save fired");
			assert.equal(pricingSave.body.revision, 8, "the pricing persist carries the LIVE revision, not the mount-time one");
			assert.equal(els(pricing.tree).some((el) => flatten(el.props?.children) === t("setSaved")), true, "the pricing save reports 已保存 under a stale mount revision");
			assert.equal(els(pricing.tree).some((el) => String(el.props?.className ?? "").includes("dp_setMsgErr")), false, "no conflict copy after the pricing save");
		} finally {
			globalThis.fetch = realFetch2;
			globalThis.setInterval = priorSetInterval;
			for (const handle of heldTimers) clearInterval(handle);
			globalThis.document = priorDocument;
			globalThis.window = priorWindow;
		}
	}
} finally {
	Module._load = origLoad;
	// Null-guarded so a failure in an early phase surfaces as ITS error, not
	// as a cleanup TypeError over a path that phase never reached.
	rmSync(bundlePath, { force: true });
	for (const p of [footPath, gatePath, panelsPath]) if (p !== null) rmSync(p, { force: true });
}

console.log("client-smoke: useDashboardModel executes clean under react stubs (both stack modes); foot cache envelope + tip/aria composition pinned; csv export follows the display currency through the single exit; the echoed-card gate ignores skewed cards; the settings panels reset saving on 409, report refusals, arm destructive buttons, and the pricing page's persist saves under a revision bumped since mount");
