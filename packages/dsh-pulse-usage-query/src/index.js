/**
 * dsh-pulse-usage-query — the optional, model-visible `usage_query` tool.
 *
 * Cordis host half: registers ONE tool (`usage_query`) on the harness's tool
 * registry. It holds no configuration, registers no command, touches no
 * profile, and writes nothing — the entire model-visible surface is this
 * single tool, and the package exists precisely because that surface is
 * opt-in: NOTHING changes for any session until you insert this package's
 * row into your profile patch yourself (see README.md). Once mounted, the
 * tool is visible to every agent in the profile.
 *
 * Every number the tool returns is folded by dsh-pulse's own aggregation
 * entry (`buildStats`, the same function behind `/pulse/stats`) and priced
 * by the same estimator the dashboard uses — so answers cannot drift from
 * the views. No new storage, no new outbound traffic, and never any
 * conversation content: aggregate numbers plus short identifiers only
 * (structurally enforced by test/shape-test.mjs).
 *
 * Requires the `dsh-pulse` peer (0.6.1) to be mounted in the same profile:
 * the fold reads its `pulseUsage` projections. In a host, the peer import is
 * resolved through the loader's linked-root interception of
 * `peerDependencies` names; the aggregation core itself (src/tool.js) stays
 * dependency-injected so it also runs against a source tree with plain
 * `node`.
 *
 * @module dsh-pulse-usage-query
 */

import { buildStats } from "dsh-pulse";
import { localDay, validDay } from "dsh-pulse/aggregate";
import { costOf, recordTokens, sessionModelRows } from "dsh-pulse/view";
import { usageQueryTool } from "./tool.js";

/** Cordis plugin name used by loader diagnostics. */
export const name = "pulse-usage-query";

/**
 * Host services: the harness tool registry (the registration seam), plus the
 * four read services `buildStats` folds through — the query corpus
 * (listing + log reads), the live-session store, the projection registry
 * (O(1) snapshots), and the persisted projection cache (the cold-fold
 * ladder). Assemblies without the tool registry (a profile with no agent
 * loop) leave this fiber pending, which registers nothing — the safe
 * default.
 */
export const inject = [
	"tools",
	"sessionQuery", "sessions", "sessionProjections", "sessionProjectionCache",
];

/**
 * Register the `usage_query` tool. The registration is an effect on this
 * fiber, so unloading the plugin removes the tool from every agent's next
 * prompt assembly.
 *
 * @param {object} ctx - plugin context carrying the injected services.
 * @param {object} [config] - deployment configuration (this package declares
 *   none; an empty config folds with dsh-pulse's official pricing defaults).
 */
export function apply(ctx, config = {}) {
	const resolveConfig = () => config;
	ctx.effect(() => ctx.tools.register(usageQueryTool({
		buildStats, costOf, recordTokens, sessionModelRows, localDay, validDay,
		ctx, resolveConfig,
	})), "pulse-usage-query: usage_query tool");
}
