/**
 * Shape test for the optional `usage_query` tool.
 *
 * Run from the repository root:
 *   node packages/dsh-pulse-usage-query/test/shape-test.mjs
 *
 * The aggregation core (src/tool.js) is dependency-injected, so this test
 * wires it to the repository's real dsh-pulse entry points (imported
 * relatively) — the same functions the mounted plugin resolves through the
 * `dsh-pulse` peer — and calls the tool's execute function against a minimal
 * stub ctx carrying only the services `buildStats` reads.
 *
 * Three structural guarantees are asserted on EVERY response produced here:
 *   1. key whitelist — any object key outside the fixed sets fails the test;
 *   2. string bound — every string value is ≤ 80 chars and carries no raw
 *      composite separator, so conversation content can never ride a reply;
 *   3. window folding — today / 7d / 30d / custom resolve to the right days
 *      under a fixed clock.
 */

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildStats } from "../../../src/index.js";
import { dayStart, localDay, validDay } from "../../../src/aggregate.js";
import { costOf, recordTokens, sessionModelRows } from "../../../src/view.js";
import { usageQueryInput, usageQueryTool, USAGE_QUERY_DESCRIPTION, USAGE_QUERY_NAME } from "../src/tool.js";

const here = dirname(fileURLToPath(import.meta.url));

// --- fixed clock (local-timezone stable: day keys mirror resolveWindow's
// dayStart arithmetic, so the test is DST-shape agnostic) ---------------------
const NOON = new Date(2026, 9, 19, 12, 0, 0).getTime(); // local noon, 2026-10-19
const dayAt = (offset) => localDay(dayStart(localDay(NOON)) - offset * 86400000);
const noonOn = (offset) => dayStart(dayAt(offset)) + 43200000;
const TODAY = dayAt(0);
const D3 = dayAt(3);
const D10 = dayAt(10);
const D40 = dayAt(40);

const FLASH_KEY = "deepseek-official\u0000deepseek-flash"; // priced by official defaults
const MYSTERY_KEY = "mystery-model"; // matches no rule → unpriced
const usage = (input, output, cacheRead, cacheWrite) => ({ input, output, cacheRead, cacheWrite });

/** Minimal stub ctx: only the services `buildStats` folds through, with every
 *  session LIVE (the registry-snapshot read path — no projection cache
 *  needed). Mirrors the makeCtx idea of test/host-test.mjs. */
function makeCtx(sessions) {
	const byId = new Map(sessions.map((s) => [s.id, s]));
	return {
		sessionQuery: {
			listSessions: async () => sessions.map((s) => ({
				header: { id: s.id, createdAt: s.at, cwd: s.cwd, isSeeded: true },
				live: true,
				persisted: true,
			})),
		},
		sessions: { get: (id) => byId.get(id) },
		sessionProjections: {
			snapshot: (session) => ({ asOfSeq: 5, values: { pulseUsage: byId.get(session.id).pulse } }),
		},
	};
}

const sessions = [
	{
		id: "live-a", cwd: "D:\\work\\alpha", at: noonOn(0),
		pulse: {
			byDay: { [TODAY]: usage(1000, 200, 8000, 100) },
			modelsByDay: { [TODAY]: { [FLASH_KEY]: usage(1000, 200, 8000, 100) } },
			firstDay: TODAY,
		},
	},
	{
		id: "live-b", cwd: "/home/x/beta", at: noonOn(10),
		pulse: {
			byDay: { [D3]: usage(500, 50, 0, 0), [D10]: usage(700, 70, 0, 0) },
			modelsByDay: {
				[D3]: { [MYSTERY_KEY]: usage(500, 50, 0, 0) },
				[D10]: { [MYSTERY_KEY]: usage(700, 70, 0, 0) },
			},
			firstDay: D3,
		},
	},
	{
		id: "live-c", cwd: "D:\\work\\gamma", at: noonOn(40),
		pulse: {
			byDay: { [D40]: usage(42, 4, 0, 0) },
			modelsByDay: { [D40]: { [FLASH_KEY]: usage(42, 4, 0, 0) } },
			firstDay: D40,
		},
	},
];

/** A tool instance over the default stub (live sessions, empty config, fixed clock). */
const tool = (overrides = {}) => usageQueryTool({
	buildStats, costOf, recordTokens, sessionModelRows, localDay, validDay,
	ctx: makeCtx(sessions),
	resolveConfig: () => ({}),
	now: () => NOON,
	...overrides,
});

/** Every response collected for the final structural sweep. */
const responses = [];

// --- the definition's static shape -------------------------------------------
{
	const def = tool();
	assert.equal(USAGE_QUERY_NAME, "usage_query");
	assert.equal(def.name, "usage_query");
	const description = def.description;
	assert.equal(description, USAGE_QUERY_DESCRIPTION);
	assert.match(description, /usage aggregates/i, "states its purpose");
	assert.match(description, /when the user asks/i, "states when to use");
	assert.match(description, /aggregate numbers only/i, "states the return boundary");
	assert.ok(description.includes("/pulse"), "points at the full views");
	assert.ok(!description.includes("YYYY") && !description.toLowerCase().includes("default"),
		"parameter rules live on the parameters, not the description");
	// parameters: lossless JSON, exact property set, enums where intended
	const params = JSON.parse(JSON.stringify(def.parameters));
	assert.equal(params.type, "object");
	assert.deepEqual(Object.keys(params.properties).sort(), ["from", "groupBy", "to", "top", "window"]);
	assert.deepEqual(params.properties.window.enum, ["today", "7d", "30d", "custom"]);
	assert.deepEqual(params.properties.groupBy.enum, ["day", "model", "project"]);
	assert.equal(params.properties.from.enum, undefined, "from/to are free date strings");
	assert.equal(params.properties.top.type, "integer");
	// output: object-rooted closed schema; render yields the JSON text block
	assert.equal(def.output.schema.type, "object");
	assert.equal(def.output.schema.additionalProperties, false);
	const sample = {
		window: "7d",
		totals: { tokensIn: 1, tokensOut: 1, cacheRead: 0, cacheWrite: 0, costCny: null, approx: false },
		groups: [],
		hint: "x",
	};
	const blocks = def.output.render({}, sample);
	assert.deepEqual(blocks.map((block) => block.type), ["text"]);
	assert.deepEqual(JSON.parse(blocks[0].text), sample);
	assert.equal(def.isConcurrencySafe(), true, "read-only tool opts into parallel siblings");
}

// --- window folding: pure function, fixed clock ------------------------------
{
	const fold = { localDay, validDay, now: () => NOON };
	assert.deepEqual(usageQueryInput({}, fold), { window: "7d", groupBy: "day", top: 8, input: { days: 7 } });
	assert.deepEqual(usageQueryInput({ window: "today" }, fold).input, { from: TODAY, to: TODAY });
	assert.deepEqual(usageQueryInput({ window: "30d" }, fold).input, { days: 30 });
	assert.deepEqual(
		usageQueryInput({ window: "custom", from: "2026-01-02", to: "2026-01-31" }, fold).input,
		{ from: "2026-01-02", to: "2026-01-31" },
	);
	assert.equal(usageQueryInput({ top: 20 }, fold).top, 20);
	assert.equal(usageQueryInput({ groupBy: "project" }, fold).groupBy, "project");
}

// --- integration through the real buildStats ----------------------------------
{
	const def = tool();

	// today: exactly today's flash usage
	const today = await def.execute({ window: "today" });
	responses.push(["today", today]);
	assert.equal(today.window, "today");
	assert.equal(today.totals.tokensIn, 1000);
	assert.equal(today.totals.tokensOut, 200);
	assert.equal(today.totals.cacheRead, 8000);
	assert.equal(today.totals.cacheWrite, 100);
	assert.ok(today.totals.costCny > 0, "flash is priced by the official defaults");
	assert.equal(today.totals.approx, false, "fully priced window is not flagged approximate");
	assert.deepEqual(today.groups.map((group) => group.key), [TODAY]);
	assert.equal(today.groups[0].tokens, 9300);
	assert.ok(today.groups[0].costCny > 0);
	assert.equal(today.hint, "full dashboard: /pulse");

	// 7d (the default): today + 3 days ago; 10 and 40 days ago excluded
	const week = await def.execute({});
	responses.push(["7d", week]);
	const weekKeys = week.groups.map((group) => group.key);
	assert.ok(weekKeys.includes(TODAY) && weekKeys.includes(D3), `7d covers today and 3 days ago: ${weekKeys}`);
	assert.ok(!weekKeys.includes(D10) && !weekKeys.includes(D40), "7d excludes 10 and 40 days ago");
	assert.equal(week.totals.tokensIn, 1500);
	assert.equal(week.totals.tokensOut, 250);
	assert.equal(week.totals.cacheRead, 8000);
	assert.equal(week.totals.cacheWrite, 100);
	assert.equal(week.totals.approx, true, "the unpriced mystery-model marks the total incomplete");
	assert.ok(week.totals.costCny > 0);

	// 30d: additionally reaches 10 days ago, still excludes 40
	const month = await def.execute({ window: "30d" });
	responses.push(["30d", month]);
	const monthKeys = month.groups.map((group) => group.key);
	assert.ok(monthKeys.includes(D10), "30d reaches 10 days ago");
	assert.ok(!monthKeys.includes(D40), "30d excludes 40 days ago");
	assert.equal(month.totals.tokensIn, 2200);
	assert.equal(month.totals.tokensOut, 320);

	// custom: an explicit historical range folds only what it names
	const ancient = await def.execute({ window: "custom", from: dayAt(45), to: dayAt(35) });
	responses.push(["custom", ancient]);
	assert.equal(ancient.window, "custom");
	assert.deepEqual(ancient.groups.map((group) => group.key), [D40]);
	assert.equal(ancient.totals.tokensIn, 42);
	assert.equal(ancient.totals.tokensOut, 4);

	// groupBy model: composite keys become readable provider/model labels
	const byModel = await def.execute({ groupBy: "model" });
	responses.push(["model", byModel]);
	const modelKeys = byModel.groups.map((group) => group.key);
	assert.ok(modelKeys.includes("deepseek-official/deepseek-flash"), `composite key renders readable: ${modelKeys}`);
	assert.ok(modelKeys.includes("mystery-model"), "a provider-less key stays bare");
	assert.ok(!JSON.stringify(byModel).includes("\\u0000"), "no raw composite separator leaks");
	const flashRow = byModel.groups.find((group) => group.key === "deepseek-official/deepseek-flash");
	assert.equal(flashRow.tokens, 9300);
	assert.ok(flashRow.costCny > 0);
	const mysteryRow = byModel.groups.find((group) => group.key === "mystery-model");
	assert.equal(mysteryRow.tokens, 550);
	assert.equal(mysteryRow.costCny, null, "an unpriced model carries no cost number");

	// groupBy project: short project labels
	const byProject = await def.execute({ groupBy: "project" });
	responses.push(["project", byProject]);
	assert.deepEqual(byProject.groups.map((group) => group.key).sort(), ["alpha", "beta"]);
	assert.equal(byProject.groups.find((group) => group.key === "alpha").tokens, 9300);
	assert.equal(byProject.groups.find((group) => group.key === "beta").tokens, 550);

	// top truncation keeps the largest rows
	const capped = await def.execute({ window: "30d", top: 1 });
	responses.push(["top", capped]);
	assert.equal(capped.groups.length, 1);
	assert.equal(capped.groups[0].key, TODAY, "top keeps the largest group");
}

// --- cost display disabled: numbers survive, money goes null ------------------
{
	const off = tool({ resolveConfig: () => ({ costEnabled: false }) });
	const offRes = await off.execute({ window: "custom", from: dayAt(50), to: dayAt(35) });
	responses.push(["costOff", offRes]);
	assert.equal(offRes.totals.tokensIn, 42);
	assert.equal(offRes.totals.costCny, null);
	assert.equal(offRes.totals.approx, false);
	assert.ok(offRes.groups.every((group) => group.costCny === null));
}

// --- an empty corpus answers zeros, never errors ------------------------------
{
	const empty = tool({ ctx: makeCtx([]) });
	const emptyRes = await empty.execute({ window: "today" });
	responses.push(["empty", emptyRes]);
	assert.deepEqual(emptyRes.totals, {
		tokensIn: 0, tokensOut: 0, cacheRead: 0, cacheWrite: 0, costCny: null, approx: false,
	});
	assert.deepEqual(emptyRes.groups, []);
	assert.equal(emptyRes.hint, "full dashboard: /pulse");
}

// --- invalid input: short error strings, never long dumps ---------------------
{
	const def = tool();
	const cases = [
		{ window: "custom" },
		{ window: "custom", from: "2026-02-30", to: TODAY },
		{ window: "banana" },
		{ groupBy: "color" },
		{ top: 0 },
		{ top: 21 },
		{ top: 2.5 },
	];
	for (const args of cases) {
		await assert.rejects(
			() => def.execute(args),
			(error) => {
				const message = String(error?.message ?? error);
				assert.ok(message.length > 0 && message.length <= 80,
					`error message stays short (${message.length}): ${message}`);
				return true;
			},
			`invalid arguments rejected: ${JSON.stringify(args)}`,
		);
	}
}

// --- the structural sweep: key whitelist + string bound on every response ----
{
	const ROOT_KEYS = ["groups", "hint", "totals", "window"];
	const TOTALS_KEYS = ["approx", "cacheRead", "cacheWrite", "costCny", "tokensIn", "tokensOut"];
	const GROUP_KEYS = ["costCny", "key", "tokens"];
	assert.ok(responses.length >= 9, "the sweep covers every response produced above");
	for (const [label, response] of responses) {
		assert.deepEqual(Object.keys(response).sort(), ROOT_KEYS, `${label}: root key whitelist`);
		assert.deepEqual(Object.keys(response.totals).sort(), TOTALS_KEYS, `${label}: totals key whitelist`);
		for (const group of response.groups) {
			assert.deepEqual(Object.keys(group).sort(), GROUP_KEYS, `${label}: group key whitelist`);
		}
		const numbers = [
			response.totals.tokensIn, response.totals.tokensOut,
			response.totals.cacheRead, response.totals.cacheWrite, response.totals.costCny,
			...response.groups.flatMap((group) => [group.tokens, group.costCny]),
		];
		for (const value of numbers) {
			assert.ok(value === null || Number.isFinite(value), `${label}: numbers are finite or null`);
		}
		walkStrings(response, label);
	}
}

/** Every string in the tree: ≤ 80 chars, no raw composite separator. */
function walkStrings(value, where) {
	if (typeof value === "string") {
		assert.ok(value.length <= 80, `${where}: string bounded to 80 chars (got ${value.length})`);
		assert.ok(!value.includes("\u0000"), `${where}: no raw composite separator leaks`);
		return;
	}
	if (Array.isArray(value)) {
		value.forEach((item, index) => walkStrings(item, `${where}[${index}]`));
		return;
	}
	if (value !== null && typeof value === "object") {
		for (const [key, item] of Object.entries(value)) walkStrings(item, `${where}.${key}`);
	}
}

// --- no self-enablement: the Cordis shell's static surface --------------------
{
	const shell = readFileSync(join(here, "..", "src", "index.js"), "utf8");
	assert.match(shell, /export const inject/, "inject list exported");
	assert.ok(shell.includes('"tools"'), "declares the tools registration service");
	assert.ok(!/commands\.register|configEditor|writeFile|appendFile|mkdir/i.test(shell),
		"no command, config-edit, or file-write surface anywhere in the shell");
	assert.ok(!shell.includes("webServer"), "registers no HTTP route");
	const pkg = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8"));
	assert.equal(pkg.name, "dsh-pulse-usage-query");
	assert.equal(pkg.version, "0.1.0");
	assert.deepEqual(pkg.peerDependencies, { "dsh-pulse": "0.6.1" });
}

console.log("usage-query shape test: all assertions passed");
