/**
 * dsh-pulse-usage-query — tool core: the model-visible `usage_query` tool
 * over dsh-pulse's aggregates.
 *
 * This module is deliberately free of `dsh-pulse` imports: every dsh-pulse
 * entry point it needs (`buildStats`, `costOf`, `recordTokens`,
 * `sessionModelRows`, `localDay`, `validDay`) is injected by the Cordis shell
 * (src/index.js), which resolves them through the `dsh-pulse` peer
 * dependency. That keeps this core runnable against the repository tree with
 * plain `node` (test/shape-test.mjs) while the mounted plugin resolves the
 * same functions through the loader's linked-root peer interception.
 *
 * Response discipline — structural, enforced by test/shape-test.mjs:
 * aggregate numbers plus short identifiers only. Every string in a response
 * is bounded and every object key comes from a fixed whitelist, so no
 * conversation content can ever ride a `usage_query` answer.
 *
 * @module dsh-pulse-usage-query/tool
 */

/** The registered (model-visible) tool name. */
export const USAGE_QUERY_NAME = "usage_query";

/**
 * The model-facing description: purpose, when to use, and the return
 * boundary. Parameter rules deliberately live on the parameters below — one
 * fact, one home.
 */
export const USAGE_QUERY_DESCRIPTION =
	"Query dsh-pulse usage aggregates: tokens, cache-hit rate, and estimated cost. "
	+ "Use when the user asks how much was used or spent today or recently, or which model or project dominated. "
	+ "Returns aggregate numbers only — never conversation content; full views live at /pulse.";

/** Windows the tool understands (parameter enum and echoed label). */
const WINDOWS = ["today", "7d", "30d", "custom"];
/** Grouping modes for the `groups` rows. */
const GROUPINGS = ["day", "model", "project"];
/** Fixed response hint: where the full human-facing views live. */
const HINT = "full dashboard: /pulse";
/**
 * Hard cap on any identifier a response echoes (group keys: day strings,
 * model ids, project labels — all fold keys, never user text). Together with
 * the numeric-only totals this is the structural half of "never conversation
 * content": even a pathological identifier cannot carry a sentence.
 */
const MAX_KEY_CHARS = 64;

/**
 * Raw JSON Schema for the tool arguments. The registry projects exactly
 * `name`/`description`/`parameters` to the model, so the pairing and range
 * rules that the harness's enforced schema subset cannot express (it has no
 * `minimum`/`maximum`) are stated here as text and enforced in
 * {@link usageQueryInput}.
 */
const PARAMETERS = {
	type: "object",
	properties: {
		window: {
			type: "string",
			enum: [...WINDOWS],
			description: "Query window: today, 7d (last 7 days), 30d (last 30 days), or custom. Default 7d.",
		},
		from: {
			type: "string",
			description: "Window start as YYYY-MM-DD; required when window is custom, ignored otherwise.",
		},
		to: {
			type: "string",
			description: "Window end as YYYY-MM-DD; required when window is custom, ignored otherwise.",
		},
		groupBy: {
			type: "string",
			enum: [...GROUPINGS],
			description: "How the groups rows break down: per day, per model, or per project. Default day.",
		},
		top: {
			type: "integer",
			description: "Maximum number of groups rows to return, from 1 to 20. Default 8.",
		},
	},
};

/** Canonical output schema — the harness-enforced JSON Schema subset. */
const OUTPUT_SCHEMA = {
	type: "object",
	additionalProperties: false,
	required: ["window", "totals", "groups", "hint"],
	properties: {
		window: { type: "string", enum: [...WINDOWS] },
		totals: {
			type: "object",
			additionalProperties: false,
			required: ["tokensIn", "tokensOut", "cacheRead", "cacheWrite", "costCny", "approx"],
			properties: {
				tokensIn: { type: "number" },
				tokensOut: { type: "number" },
				cacheRead: { type: "number" },
				cacheWrite: { type: "number" },
				costCny: { oneOf: [{ type: "number" }, { type: "null" }] },
				approx: { type: "boolean" },
			},
		},
		groups: {
			type: "array",
			items: {
				type: "object",
				additionalProperties: false,
				required: ["key", "tokens", "costCny"],
				properties: {
					key: { type: "string" },
					tokens: { type: "number" },
					costCny: { oneOf: [{ type: "number" }, { type: "null" }] },
				},
			},
		},
		hint: { type: "string" },
	},
};

/** Defensive number coercion over already-aggregated usage fields. */
function num(value) {
	const n = typeof value === "number" ? value : Number(value);
	return Number.isFinite(n) && n > 0 ? n : 0;
}

/** A fresh four-kind token bucket. */
const bucket = () => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });

/** Add one (possibly partial) token bucket into another, in place. */
function addBucket(into, tokens) {
	if (tokens === null || typeof tokens !== "object") return;
	into.input += num(tokens.input);
	into.output += num(tokens.output);
	into.cacheRead += num(tokens.cacheRead);
	into.cacheWrite += num(tokens.cacheWrite);
}

/** All four token kinds of a bucket summed. */
const totalOf = (tokens) => tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite;

/** Cap a group key at the structural bound. */
function shortOf(label) {
	const s = String(label);
	return s.length > MAX_KEY_CHARS ? `${s.slice(0, MAX_KEY_CHARS - 1)}…` : s;
}

/**
 * Display label for a composite fold key: `provider\u0000model` becomes
 * `provider/model`; a bare model id (legacy events without a provider)
 * stays as-is. Keeps same-named models of different providers distinct.
 */
function keyLabel(key) {
	const s = String(key);
	const sep = s.indexOf("\u0000");
	return sep === -1 ? s : `${s.slice(0, sep)}/${s.slice(sep + 1)}`;
}

/** One side of a `tiersByDay` split as a flat token bucket. */
const tierSide = (tier, side) => ({
	input: num(tier?.input?.[side]),
	output: num(tier?.output?.[side]),
	cacheRead: num(tier?.cacheRead?.[side]),
	cacheWrite: num(tier?.cacheWrite?.[side]),
});

/** One day's per-model usage as a `costOf` row (tier split when present). */
function dayRow(key, tokens, tier) {
	const row = {
		key,
		input: num(tokens?.input),
		output: num(tokens?.output),
		cacheRead: num(tokens?.cacheRead),
		cacheWrite: num(tokens?.cacheWrite),
	};
	if (tier !== null && typeof tier === "object") {
		row.peak = tierSide(tier, "peak");
		row.offpeak = tierSide(tier, "offpeak");
	}
	return row;
}

/**
 * Validate raw tool arguments and fold them into a `buildStats` input window.
 *
 * The registry hands a hand-built definition's `execute` the arguments
 * unvalidated, so this is the gate: enum membership, the `top` range the
 * schema subset cannot express, and the custom-window date pair. Every
 * failure throws a short message (the pipeline renders it as the tool's
 * error string).
 *
 * @param {object} args - raw model arguments.
 * @param {object} fold - injected fold helpers: `localDay`, `validDay` (from
 *   `dsh-pulse/aggregate`) and `now` (clock, overridable for tests).
 * @returns {{window: string, groupBy: string, top: number, input: object}} the
 *   validated request plus the folded `{from, to}` or `{days}` window.
 */
export function usageQueryInput(args, { localDay, validDay, now = Date.now }) {
	const window = args?.window ?? "7d";
	if (!WINDOWS.includes(window)) throw new Error(`window must be one of: ${WINDOWS.join(", ")}`);
	const groupBy = args?.groupBy ?? "day";
	if (!GROUPINGS.includes(groupBy)) throw new Error(`groupBy must be one of: ${GROUPINGS.join(", ")}`);
	const top = args?.top ?? 8;
	if (!Number.isInteger(top) || top < 1 || top > 20) throw new Error("top must be an integer from 1 to 20");
	let input;
	if (window === "custom") {
		if (!validDay(args?.from) || !validDay(args?.to)) {
			throw new Error("custom window requires from and to as YYYY-MM-DD");
		}
		input = { from: args.from, to: args.to };
	} else if (window === "today") {
		const day = localDay(now());
		input = { from: day, to: day };
	} else {
		input = { days: window === "7d" ? 7 : 30 };
	}
	return { window, groupBy, top, input };
}

/**
 * Fold a `buildStats` payload into the compact tool response.
 *
 * Numbers come from the payload's already-windowed session records; costs
 * ride the same estimator the dashboard uses (`costOf` over tier-split model
 * rows), so a tool answer can never drift from the `/pulse` views.
 * `costCny` is `null` when cost display is disabled or nothing in the window
 * is priced; `approx` marks a computed total as incomplete (some tokens in
 * the window matched no pricing rule).
 *
 * @param {object} payload - `buildStats` output (session records + echoed pricing/fx).
 * @param {{window: string, groupBy: string, top: number}} folded - validated request.
 * @param {object} deps - injected aggregators: `costOf`, `recordTokens`, `sessionModelRows`.
 * @returns {object} the canonical tool value (`{window, totals, groups, hint}`).
 */
export function summarizeUsage(payload, folded, { costOf, recordTokens, sessionModelRows }) {
	const sessions = Array.isArray(payload?.sessions) ? payload.sessions : [];
	const pricing = Array.isArray(payload?.pricing) ? payload.pricing : [];
	const fx = payload?.fx ?? {};
	const monthly = Array.isArray(payload?.monthly) ? payload.monthly : [];
	const costOff = payload?.costEnabled === false;

	const totals = bucket();
	const allRows = [];
	/** group label -> { tokens, rows } — rows are `costOf`-shaped model rows. */
	const groups = new Map();
	const groupOf = (label) => {
		let group = groups.get(label);
		if (group === undefined) {
			group = { tokens: 0, rows: [] };
			groups.set(label, group);
		}
		return group;
	};
	for (const record of sessions) {
		if (record === null || typeof record !== "object") continue;
		const recordBucket = recordTokens(record);
		const rows = sessionModelRows(record);
		addBucket(totals, recordBucket);
		// A session with no countable usage is a shell — drop it, exactly as
		// the dashboard's session panel does.
		if (totalOf(recordBucket) <= 0 && rows.length === 0) continue;
		allRows.push(...rows);
		if (folded.groupBy === "project") {
			const group = groupOf(shortOf(record.project === null || record.project === undefined ? "(none)" : String(record.project)));
			group.tokens += totalOf(recordBucket);
			group.rows.push(...rows);
		} else if (folded.groupBy === "model") {
			for (const row of rows) {
				const group = groupOf(shortOf(keyLabel(row.key)));
				group.tokens += totalOf(row);
				group.rows.push(row);
			}
		} else {
			// groupBy === "day": per-day buckets from `byDay`, per-day model
			// rows from `modelsByDay` + `tiersByDay` (tier split when present).
			for (const [day, dayTokens] of Object.entries(record.byDay ?? {})) {
				const group = groupOf(shortOf(day));
				group.tokens += num(dayTokens?.input) + num(dayTokens?.output)
					+ num(dayTokens?.cacheRead) + num(dayTokens?.cacheWrite);
				const dayModels = record.modelsByDay?.[day];
				if (dayModels === null || typeof dayModels !== "object") continue;
				for (const [key, tokens] of Object.entries(dayModels)) {
					group.rows.push(dayRow(key, tokens, record.tiersByDay?.[day]?.[key]));
				}
			}
		}
	}
	const totalCost = costOff ? null : costOf(allRows, pricing, fx, monthly);
	const groupCost = (rows) => (costOff ? null : costOf(rows, pricing, fx, monthly));
	const priced = (cost) => (cost !== null && cost.configured === true ? cost.total : null);
	const unpriced = totalCost?.unpriced;
	return {
		window: folded.window,
		totals: {
			tokensIn: totals.input,
			tokensOut: totals.output,
			cacheRead: totals.cacheRead,
			cacheWrite: totals.cacheWrite,
			costCny: priced(totalCost),
			approx: totalCost !== null && totalCost.configured === true
				&& num(unpriced?.input) + num(unpriced?.output) > 0,
		},
		groups: [...groups.entries()]
			.map(([key, group]) => ({ key, tokens: group.tokens, costCny: priced(groupCost(group.rows)) }))
			.sort((a, b) => b.tokens - a.tokens)
			.slice(0, folded.top),
		hint: HINT,
	};
}

/**
 * Build the registry-ready `usage_query` tool definition.
 *
 * The definition is a plain `ToolDefinition`-shaped object (name,
 * description, raw JSON-Schema `parameters`, mandatory `output`
 * `{schema, render}`, `execute`, and an opt-in concurrency classifier): the
 * host's `ctx.tools.register` validates exactly this shape at registration
 * time and projects only name/description/parameters to the model. See
 * docs/seam-notes.md for the evidence trail.
 *
 * @param {object} deps - the wiring: dsh-pulse entry points
 *   (`buildStats`, `costOf`, `recordTokens`, `sessionModelRows`, `localDay`,
 *   `validDay`), the plugin `ctx`, the `resolveConfig` thunk handed to
 *   `buildStats`, and an optional `now` clock for tests.
 * @returns {object} the tool definition for `ctx.tools.register`.
 */
export function usageQueryTool({
	buildStats, costOf, recordTokens, sessionModelRows, localDay, validDay,
	ctx, resolveConfig, now = Date.now,
}) {
	return {
		name: USAGE_QUERY_NAME,
		description: USAGE_QUERY_DESCRIPTION,
		parameters: PARAMETERS,
		output: {
			schema: OUTPUT_SCHEMA,
			render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }],
		},
		/** Read-only fold over shared caches designed for concurrent reads. */
		isConcurrencySafe: () => true,
		async execute(args) {
			const folded = usageQueryInput(args ?? {}, { localDay, validDay, now });
			const payload = await buildStats(ctx, resolveConfig, folded.input, undefined, now());
			return summarizeUsage(payload, folded, { costOf, recordTokens, sessionModelRows });
		},
	};
}
