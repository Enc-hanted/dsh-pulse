import z from "@deepseek-ai/schemastery";
import {
  buildPayload, localDay, projectOf, pulseProjectionDefinition, resolveWindow, sliceRecord,
} from "./aggregate.js";
import { costOf, fmtCost } from "./view.js";

/**
 * dsh-pulse — the usage & cost observatory.
 *
 * Host half: registers the `pulseUsage` session-projection unit (the
 * harness drives it incrementally over every committed event, and the
 * persisted projection cache serves cold sessions through its read ladder),
 * then serves `/pulse/stats?from=&to=` as same-origin JSON and `/pulse` as a
 * UI-plane command. Per-request work is O(corpus) lightweight reads — no
 * session log is re-folded on demand. The day/week/month/project views and
 * cost estimate are folded client-side from the windowed records. Nothing
 * here is model-visible: no prompt surface, no tools, no tokens spent.
 *
 * @module dsh-pulse
 */

/** Cordis plugin name used by loader diagnostics. */
export const name = "pulse";

/**
 * Host services: the projection registry + persisted cache (the fold), the
 * session store (live snapshots), the query corpus (listing), the commands
 * registry, and the web server. In assemblies without the projection
 * registry (a profile without the web bundle) the fiber stays pending.
 */
export const inject = [
  "commands", "sessionQuery", "webServer",
  "sessionProjections", "sessionProjectionCache", "sessions",
];

/** Default per-model rates (CNY per million tokens), from the official page:
 *  https://api-docs.deepseek.com/zh-cn/quick_start/pricing/ (checked 2026-08-14).
 *  Override or extend in your profile patch — unmatched models stay unpriced. */
const OFFICIAL_PRICING = [
  { model: "deepseek-v4-flash", input: 1, cacheRead: 0.02, output: 2, currency: "CNY" },
  { model: "deepseek-v4-pro", input: 3, cacheRead: 0.025, output: 6, currency: "CNY" },
];

/** Schemastery validation with deployment-friendly defaults. */
export const Config = z.object({
  topProjects: z.number().default(8).description("how many project rows to keep in the breakdown"),
  projectDepth: z.number().default(1).description("path segments kept in a project label (1..3; deeper disambiguates same-named directories)"),
  defaultDays: z.number().default(30).description("day window served when the client sends no range"),
  pricing: z.array(z.object({
    model: z.string().description("model id the rates apply to (as reported in usage events)"),
    input: z.number().default(0).description("price per million uncached input tokens (cache misses and writes)"),
    cacheRead: z.number().description("price per million cache-hit input tokens (defaults to `input` when omitted)"),
    output: z.number().default(0).description("price per million output tokens"),
    currency: z.string().default("CNY").description("currency label for the estimate"),
  })).default([]).description("per-model rates; empty disables cost estimation"),
});

/** Resolve the effective pricing rules (config wins, official defaults fill in). */
function effectivePricing(config) {
  const rules = new Map();
  for (const rule of OFFICIAL_PRICING) rules.set(rule.model, { ...rule });
  for (const rule of Array.isArray(config.pricing) ? config.pricing : []) {
    rules.set(rule.model, { ...(rules.get(rule.model) ?? {}), ...rule });
  }
  return [...rules.values()];
}

/**
 * Fold the whole corpus into windowed per-session records.
 *
 * Live sessions read their O(1) watermark-cache snapshot from the projection
 * registry; persisted sessions go through the persisted-cache read ladder
 * (`coldSnapshot` — cached row plus a persistence tail read on the happy
 * path, never a full-log load). One unreadable session is skipped, never
 * fatal. Concurrent requests for the same window share one in-flight fold,
 * and a short TTL cache serves recently folded windows again so tab
 * switches and duplicate dashboard mounts stay cheap.
 *
 * @param {object} ctx - plugin context carrying the injected services.
 * @param {object} config - resolved plugin configuration.
 * @param {{from?: string, to?: string, days?: number|string}} input - request window.
 * @param {AbortSignal} [signal] - caller cancellation (checked between sessions).
 * @returns {Promise<object>} the `/pulse/stats` payload.
 */
const PAYLOAD_TTL_MS = 15000;
const inflight = new Map();
const lastServed = new Map();

async function buildStats(ctx, config, input, signal) {
  const { fromDay, toDay } = resolveWindow(input, config.defaultDays);
  const key = `${fromDay}:${toDay}`;
  const fresh = lastServed.get(key);
  if (fresh !== undefined && Date.now() - fresh.at < PAYLOAD_TTL_MS) return fresh.payload;
  const existing = inflight.get(key);
  if (existing !== undefined) return existing;
  const flight = aggregate(ctx, config, fromDay, toDay, signal).finally(() => inflight.delete(key));
  inflight.set(key, flight);
  const payload = await flight;
  lastServed.set(key, { payload, at: Date.now() });
  return payload;
}

async function aggregate(ctx, config, fromDay, toDay, signal) {
  const pricing = effectivePricing(config);
  const sessions = await ctx.sessionQuery.listSessions(signal);
  const records = [];
  for (const entry of sessions) {
    if (signal?.aborted) break;
    try {
      const header = entry.header;
      let values;
      if (entry.live) {
        const liveSession = ctx.sessions.get(header.id);
        if (liveSession !== undefined) {
          values = ctx.sessionProjections.snapshot(liveSession).values;
        }
      } else {
        values = (await ctx.sessionProjectionCache.coldSnapshot(header.id, signal))?.values;
      }
      const pulse = values === undefined ? undefined : values.pulseUsage;
      const record = sliceRecord({
        id: header.id,
        createdAt: header.createdAt,
        createdDay: localDay(header.createdAt),
        project: projectOf(header.cwd, config.projectDepth),
        subagent: header.origin === "subagent",
        firstDay: pulse?.firstDay ?? null,
        byDay: pulse?.byDay ?? {},
        modelsByDay: pulse?.modelsByDay ?? {},
        hoursByDay: pulse?.hoursByDay ?? {},
        turnsByDay: pulse?.turnsByDay ?? {},
        toolCallsByDay: pulse?.toolCallsByDay ?? {},
      }, fromDay, toDay);
      if (record !== null) records.push(record);
    } catch {
      // A session that cannot be folded is skipped, never fatal.
    }
  }
  return buildPayload({
    records,
    fromDay,
    toDay,
    pricing,
    topProjects: config.topProjects,
  });
}

/** Compact text summary for the command-plane fallback card. */
function summarize(payload) {
  const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));
  const totals = payload.sessions.reduce((acc, record) => {
    acc.sessions += 1;
    for (const tokens of Object.values(record.byDay ?? {})) {
      acc.input += tokens.input || 0;
      acc.output += tokens.output || 0;
      acc.cacheRead += tokens.cacheRead || 0;
      acc.cacheWrite += tokens.cacheWrite || 0;
    }
    acc.turns += Object.values(record.turnsByDay ?? {}).reduce((sum, n) => sum + (n || 0), 0);
    acc.toolCalls += Object.values(record.toolCallsByDay ?? {}).reduce((sum, n) => sum + (n || 0), 0);
    for (const dayModels of Object.values(record.modelsByDay ?? {})) {
      for (const [model, tokens] of Object.entries(dayModels)) {
        const row = acc.models.get(model) ?? { model, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
        row.input += tokens.input || 0;
        row.output += tokens.output || 0;
        row.cacheRead += tokens.cacheRead || 0;
        row.cacheWrite += tokens.cacheWrite || 0;
        acc.models.set(model, row);
      }
    }
    return acc;
  }, { sessions: 0, turns: 0, toolCalls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, models: new Map() });

  const lines = [
    `Sessions ${totals.sessions} · turns ${totals.turns} · tool calls ${totals.toolCalls}`,
    `Tokens in ${fmt(totals.input + totals.cacheRead + totals.cacheWrite)} (cache-hit ${fmt(totals.cacheRead)}) · out ${fmt(totals.output)}`,
  ];
  const cost = costOf([...totals.models.values()], payload.pricing);
  if (cost.configured) {
    const unpriced = (cost.unpriced?.input || 0) + (cost.unpriced?.output || 0);
    lines.push(`Estimated cost ${fmtCost(cost.total)} ${cost.currency}${unpriced > 0 ? ` · ${fmt(unpriced)} tokens unpriced` : ""}`);
  } else if (payload.pricing.length > 0) {
    lines.push(`No priced model activity in this window`);
  }
  return lines.join("\n");
}

/**
 * Register the `pulseUsage` projection unit, the `/pulse` command and the
 * `/pulse/stats` JSON route. Every registration is an effect on this fiber,
 * so unloading the plugin removes all of them.
 * @param {object} ctx - plugin context carrying the injected services.
 * @param {object} config - deployment configuration.
 */
export function apply(ctx, config) {
  ctx.sessionProjections.register(pulseProjectionDefinition());

  ctx.effect(() => ctx.commands.register({
    name: "pulse",
    description: "usage dashboard: tokens, cache hit rate, projects and models across all sessions",
    handler: async ({ signal }) => {
      try {
        const payload = await buildStats(ctx, config, {}, signal);
        if (signal?.aborted) return { kind: "error", text: "pulse aggregation aborted" };
        return { kind: "success", text: summarize(payload) };
      } catch (error) {
        ctx.logger.warn(error);
        return { kind: "error", text: `pulse: aggregation failed (${String(error?.message ?? error)})` };
      }
    },
  }), "dsh-pulse: /pulse command");

  ctx.effect(() => ctx.webServer.register({
    kind: "prefix",
    path: "/pulse",
    handler: async (req, res) => {
      try {
        const url = new URL(req.url ?? "/", "http://x");
        const pathname = decodeURIComponent(url.pathname);
        const wantsJson = pathname === "/pulse" || pathname === "/pulse/stats";
        if (!wantsJson || (req.method !== "GET" && req.method !== "HEAD")) {
          res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
          res.end("not found");
          return;
        }
        const payload = await buildStats(ctx, config, {
          from: url.searchParams.get("from"),
          to: url.searchParams.get("to"),
          days: url.searchParams.get("days"),
        }, reqAbortSignal(req));
        const body = Buffer.from(JSON.stringify(payload), "utf8");
        res.writeHead(200, {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        });
        res.end(req.method === "HEAD" ? undefined : body);
      } catch (error) {
        ctx.logger.warn(error);
        res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: String(error?.message ?? error) }));
      }
    },
  }), "dsh-pulse: /pulse route");
}

/** Best-effort abort signal bound to a socket's close event. */
function reqAbortSignal(req) {
  if (typeof AbortSignal === "undefined" || !req?.socket) return undefined;
  const controller = new AbortController();
  req.socket.once("close", () => controller.abort());
  return controller.signal;
}
