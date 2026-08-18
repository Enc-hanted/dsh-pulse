import z from "@deepseek-ai/schemastery";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { defineDomain } from "@deepseek-ai/dsh-storage-domain";
import { z as zv } from "zod";
import {
  balanceSpendSeries, buildPayload, localDay, normalizePeakHours, projectOf,
  pulseProjectionDefinition, resolveWindow, sliceRecord, PEAK_HOURS,
} from "./aggregate.js";
import { buildView, DEFAULT_USD_TO_CNY, fmtCost } from "./view.js";

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

/**
 * Default per-model rates, from the official page:
 *  https://api-docs.deepseek.com/zh-cn/quick_start/pricing/ (checked 2026-08-17).
 *
 * DeepSeek now bills by peak/off-peak windows (Beijing time 09:00–12:00 and
 * 14:00–18:00 are peak; off-peak rates are half the peak rates), effective
 * 2026-08-17. The top-level `input` / `cacheRead` / `output` fields are the
 * off-peak rates; `peak` carries the peak-hour rates (omit it for a flat,
 * time-independent rate); `peakHours` lists the peak hours (Beijing time,
 * defaults to the official windows — override it per rule when a
 * third-party provider bills its own windows). Override or extend in your
 * profile patch — unmatched models stay unpriced.
 */
const OFFICIAL_PRICING = [
  { model: "deepseek-v4-flash", input: 1.5, cacheRead: 0.05, output: 4.5,
    peak: { input: 3, cacheRead: 0.1, output: 9 }, peakHours: PEAK_HOURS, currency: "CNY" },
  { model: "deepseek-v4-pro", input: 4.5, cacheRead: 0.15, output: 13.5,
    peak: { input: 9, cacheRead: 0.3, output: 27 }, peakHours: PEAK_HOURS, currency: "CNY" },
];

/** One pricing rule (top-level rates are off-peak; `peak` holds the
 *  peak-hour rates when the model bills by time of day; `peakHours` lists
 *  the peak hours in Beijing time). */
const pricingRuleSchema = z.object({
  model: z.string().description("model id the rates apply to (as reported in usage events)"),
  input: z.number().default(0).description("price per million uncached input tokens in off-peak hours (cache misses and writes)"),
  cacheRead: z.number().description("price per million cache-hit input tokens in off-peak hours (defaults to `input` when omitted)"),
  output: z.number().default(0).description("price per million output tokens in off-peak hours"),
  peak: z.object({
    input: z.number().default(0).description("price per million uncached input tokens in peak hours"),
    cacheRead: z.number().description("price per million cache-hit input tokens in peak hours (defaults to peak `input` when omitted)"),
    output: z.number().default(0).description("price per million output tokens in peak hours"),
  }).description("peak-hour rates; omit for a flat rate"),
  peakHours: z.array(z.number().step(1).min(0).max(23)).description("peak hours in Beijing time (0–23); defaults to the official 09:00–12:00 and 14:00–18:00 windows"),
  currency: z.union(["CNY", "USD"]).default("CNY").description("currency the rates are denominated in; USD-priced models convert to CNY through `usdToCny` for the unified display"),
});

/** Schemastery validation with deployment-friendly defaults. */
export const Config = z.object({
  currency: z.union(["CNY", "USD"]).default("CNY").description("global pricing currency; every effective rule prices in it and USD rates convert to the unified CNY total"),
  topProjects: z.number().default(8).description("how many project rows to keep in the breakdown"),
  projectDepth: z.number().default(1).description("path segments kept in a project label (1..3; deeper disambiguates same-named directories)"),
  defaultDays: z.number().default(30).description("day window served when the client sends no range"),
  costEnabled: z.boolean().default(true).description("show cost estimates; off hides the cost chip and the /pulse command cost line"),
  usdToCny: z.number().default(DEFAULT_USD_TO_CNY).description("USD→CNY rate converting USD-priced models into the unified CNY estimate"),
  pricing: z.array(pricingRuleSchema).default([]).description("per-model rates; empty disables cost estimation"),
});

/** Resolve the effective pricing rules (config wins, official defaults fill
 *  in; `peakHours` normalized so the editor and the fold see clean lists;
 *  every rule prices in the one global currency — per-rule `currency` values
 *  from older configs are superseded). */
function effectivePricing(config) {
  const rules = new Map();
  for (const rule of OFFICIAL_PRICING) rules.set(rule.model, { ...rule, peakHours: normalizePeakHours(rule.peakHours) });
  for (const rule of Array.isArray(config.pricing) ? config.pricing : []) {
    rules.set(rule.model, {
      ...(rules.get(rule.model) ?? {}),
      ...rule,
      peakHours: normalizePeakHours(rule.peakHours ?? rules.get(rule.model)?.peakHours),
    });
  }
  const currency = config.currency === "USD" ? "USD" : "CNY";
  return [...rules.values()].map((rule) => ({ ...rule, currency }));
}

/** Canonical model→peak-hours map of the effective pricing, the fold's
 *  input. Only models whose normalized hours differ from the official
 *  windows appear (everything else folds at the official windows anyway), so
 *  deep-equality over this map decides whether changing settings requires
 *  re-folding history (re-registering the projection unit at a bumped state
 *  version); price-only edits and new flat rules never trigger a replay. */
function peakMapOf(config) {
  const map = new Map();
  for (const rule of effectivePricing(config)) {
    if (rule.peakHours.join() !== PEAK_HOURS.join()) map.set(rule.model, rule.peakHours);
  }
  return map;
}

/** JSON-stable signature of a peak map (insertion order is deterministic —
 *  effectivePricing iterates official defaults then config rules). */
const peakMapKey = (map) => JSON.stringify([...map.entries()]);

/** Effective USD→CNY rate (invalid values fall back to the built-in default). */
function effectiveUsdToCny(config) {
  const rate = Number(config.usdToCny);
  return Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_USD_TO_CNY;
}

// --- DeepSeek official balance ------------------------------------------------
/** Live balance replies are cached this long (the response only — the API
 *  key is re-resolved through the credentials seam on every actual fetch,
 *  per that seam's per-operation contract). */
const BALANCE_CACHE_MS = 60000;
/** Outbound balance-request budget; a hung provider must not pin a handler. */
const BALANCE_TIMEOUT_MS = 10000;
/** Snapshots older than this roll out of the store; the cap bounds a
 *  snapshot-per-minute pathological write rate. */
const SNAPSHOT_ROLL_MS = 30 * 24 * 3600 * 1000;
const SNAPSHOT_MAX = 1000;
/** Near-identical consecutive readings collapse into one snapshot. */
const SNAPSHOT_DEDUPE_MS = 5 * 60 * 1000;

/** Rolling balance history: money totals only — never the key, the ref, or
 *  any raw provider payload. The reconciliation overlay (官方扣费) reads
 *  this through `/pulse/stats`'s `balanceSeries`. */
const balanceDomainSpec = defineDomain({
  name: "pulse_balance",
  version: 0,
  tables: {},
  global: {
    schema: zv.object({ snapshots: zv.array(zv.object({ t: zv.number().int().min(0), total: zv.number() })).max(SNAPSHOT_MAX) }),
    initial: { snapshots: [] },
  },
});

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
 * @param {() => object} resolveConfig - thunk returning the authoritative
 *   plugin configuration (composition entry, or the `pulse` settings
 *   namespace resolution once the settings service is present).
 * @param {{from?: string, to?: string, days?: number|string}} input - request window.
 * @param {() => Promise<Array<{t,total}|null>} [snapshotsOf] - balance
 *   snapshot accessor; when present the payload carries `balanceSeries`.
 * @returns {Promise<object>} the `/pulse/stats` payload.
 */
const PAYLOAD_TTL_MS = 15000;
const inflight = new Map();
const lastServed = new Map();
/** Cache generation: bumped on every invalidation so a fold that started
 *  before a settings change can never land its (now stale) payload in the
 *  TTL cache after the clear — the race would otherwise serve old prices for
 *  up to one TTL window. */
let serveEpoch = 0;

async function buildStats(ctx, resolveConfig, input, snapshotsOf) {
  const config = resolveConfig();
  const { fromDay, toDay } = resolveWindow(input, config.defaultDays);
  const key = `${fromDay}:${toDay}`;
  const fresh = lastServed.get(key);
  if (fresh !== undefined && Date.now() - fresh.at < PAYLOAD_TTL_MS) return fresh.payload;
  const existing = inflight.get(key);
  if (existing !== undefined) return existing;
  const epochAtStart = serveEpoch;
  // The fold runs to completion regardless of requester sockets: an aborted
  // HTTP wait must never truncate the fold, or the TTL cache would serve a
  // partial window (rapid range switching aborted folds mid-loop). A retry
  // shares this still-running flight instead of restarting it.
  const flight = aggregate(ctx, config, fromDay, toDay, snapshotsOf).finally(() => inflight.delete(key));
  inflight.set(key, flight);
  const payload = await flight;
  if (epochAtStart === serveEpoch) lastServed.set(key, { payload, at: Date.now() });
  return payload;
}

async function aggregate(ctx, config, fromDay, toDay, snapshotsOf) {
  const pricing = effectivePricing(config);
  const sessions = await ctx.sessionQuery.listSessions();
  const records = [];
  for (const entry of sessions) {
    try {
      const header = entry.header;
      let values;
      if (entry.live) {
        const liveSession = ctx.sessions.get(header.id);
        if (liveSession !== undefined) {
          values = ctx.sessionProjections.snapshot(liveSession).values;
        }
      } else {
        values = (await ctx.sessionProjectionCache.coldSnapshot(header.id))?.values;
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
        tiersByDay: pulse?.tiersByDay ?? {},
        turnsByDay: pulse?.turnsByDay ?? {},
        toolCallsByDay: pulse?.toolCallsByDay ?? {},
      }, fromDay, toDay);
      if (record !== null) records.push(record);
    } catch {
      // A session that cannot be folded is skipped, never fatal.
    }
  }
  const payload = buildPayload({
    records,
    fromDay,
    toDay,
    pricing,
    topProjects: config.topProjects,
    costEnabled: config.costEnabled !== false,
    fx: { usdToCny: effectiveUsdToCny(config) },
  });
  // The reconciliation overlay rides along when the storage domain (and
  // therefore snapshot history) is available; otherwise the key stays absent
  // and the client hides the overlay.
  if (typeof snapshotsOf === "function") {
    const snaps = await snapshotsOf();
    if (snaps !== null) payload.balanceSeries = balanceSpendSeries(snaps, fromDay, toDay);
  }
  return payload;
}

/** Compact text summary for the command-plane fallback card. */
function summarize(payload) {
  const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));
  // One fold over the windowed records: totals and the tier-aware cost both
  // come from buildView, so the card can never disagree with the dashboard.
  const view = buildView(Array.isArray(payload.sessions) ? payload.sessions : [], {
    granularity: "day",
    from: payload.fromDay,
    to: payload.toDay,
    pricing: payload.pricing,
    fx: payload.fx,
  });
  const lines = [
    `Sessions ${view.totals.sessions} · turns ${view.totals.turns} · tool calls ${view.totals.toolCalls}`,
    `Tokens in ${fmt(view.totals.input + view.totals.cacheRead + view.totals.cacheWrite)} (cache-hit ${fmt(view.totals.cacheRead)}) · out ${fmt(view.totals.output)}`,
  ];
  if (payload.costEnabled !== false) {
    const cost = view.cost;
    if (cost.configured) {
      const unpriced = (cost.unpriced?.input || 0) + (cost.unpriced?.output || 0);
      const fxNote = (cost.convertedFromUsd || 0) > 0 ? ` (incl. USD at ${cost.usdToCny})` : "";
      lines.push(`Estimated cost ${fmtCost(cost.total)} CNY${fxNote}${unpriced > 0 ? ` · ${fmt(unpriced)} tokens unpriced` : ""}`);
    } else if (payload.pricing.length > 0) {
      lines.push(`No priced model activity in this window`);
    }
  }
  return lines.join("\n");
}

/** Enumerate the harness's current model catalog (the Models settings page)
 *  through the `llm` service: one group per provider route, each with its
 *  configured models. One broken provider is skipped, never fatal; the call
 *  is advisory and touches no network on the bundled adapters. */
async function catalogOf(llm) {
  if (llm === null || typeof llm !== "object") return [];
  if (typeof llm.listProviders !== "function" || typeof llm.listModels !== "function") return [];
  const out = [];
  for (const provider of llm.listProviders()) {
    try {
      const models = await llm.listModels(provider.id);
      out.push({
        provider: provider.id,
        displayName: typeof provider.name === "string" && provider.name.length > 0 ? provider.name : provider.id,
        models: models.map((model) => ({ id: model.id, name: model.name ?? model.id })),
      });
    } catch {
      // An unreadable catalog must not break the settings editor.
    }
  }
  return out;
}

/**
 * Register the `pulseUsage` projection unit, the `pulse` settings namespace
 * (user-editable pricing and cost display), the `/pulse` command and the
 * `/pulse` HTTP routes. Every registration is an effect on this fiber, so
 * unloading the plugin removes all of them.
 *
 * The projection unit is registered with the peak-hour map derived from the
 * authoritative config. When a settings edit changes any model's peak hours,
 * the unit is re-registered at a bumped `stateVersion` — persisted cache
 * rows stop matching, so every session re-folds from its log on the next
 * read and history reprices correctly. Price-only edits (rates, currency,
 * fx, costEnabled) never touch the fold and never trigger a replay.
 * @param {object} ctx - plugin context carrying the injected services.
 * @param {object} config - deployment configuration (the settings namespace's composition `base` layer).
 */
export function apply(ctx, config) {
  /** Fold-semantics epoch: 0 at load, +1 per peak-hour change. The persisted
   *  rows of every older epoch are invalid by construction. */
  let epoch = 0;
  let peakMap = peakMapOf(config);
  const peakHoursFor = (model) => peakMap.get(model) ?? PEAK_HOURS;
  let disposeProjection = ctx.sessionProjections.register(
    pulseProjectionDefinition({ peakHoursFor, stateVersion: 4 + epoch }),
  );
  ctx.effect(() => () => disposeProjection(), "dsh-pulse: projection fallback");
  /** After a re-register every session must re-fold (persisted rows no
   *  longer match). Do it in the background so the user's next dashboard
   *  refresh reads warm caches instead of paying the whole replay itself;
   *  one failing session never stops the sweep, and the lazy path remains
   *  the correctness backstop either way. */
  let warming = false;
  const warmUpRefolds = async () => {
    if (warming) return;
    warming = true;
    try {
      const entries = await ctx.sessionQuery.listSessions();
      for (const entry of entries) {
        try {
          if (entry.live) {
            const liveSession = ctx.sessions.get(entry.header.id);
            if (liveSession !== undefined) ctx.sessionProjections.snapshot(liveSession);
          } else {
            await ctx.sessionProjectionCache.coldSnapshot(entry.header.id);
          }
        } catch {
          // one unreadable session: skip, the lazy path still covers it
        }
      }
    } catch {
      // listing failed: nothing to warm, lazy re-folds still happen on read
    } finally {
      warming = false;
    }
  };
  const reRegisterProjection = () => {
    epoch += 1;
    disposeProjection();
    disposeProjection = ctx.sessionProjections.register(
      pulseProjectionDefinition({ peakHoursFor, stateVersion: 4 + epoch }),
    );
    void warmUpRefolds();
  };

  /** Track the `llm` service when present, for the settings editor's model
   *  catalog; absent services (profiles without an llm bundle) leave the
   *  editor on its usage-and-manual fallback rows. */
  let llmService = null;
  if (typeof ctx.inject === "function") {
    ctx.inject(["llm"], (lctx) => {
      llmService = lctx.llm ?? null;
      lctx.effect(() => () => { llmService = null; }, "dsh-pulse: llm fallback");
    });
  }

  // Authoritative config: the composition entry by default; the `pulse`
  // settings namespace (edited from the web settings panel, persisted by the
  // settings provider) once the settings service is present. Resolution
  // order is schema defaults → composition base → user section.
  let resolveConfig = () => config;
  let settingsScope = null;
  let settingsProvider = null;
  const invalidatePayload = () => { lastServed.clear(); serveEpoch += 1; };
  const onSettingsChanged = () => {
    invalidatePayload();
    const next = peakMapOf(resolveConfig());
    if (peakMapKey(next) !== peakMapKey(peakMap)) {
      peakMap = next;
      reRegisterProjection();
    }
  };
  if (typeof ctx.inject === "function") {
    ctx.inject(["settings"], (sctx) => {
      const scope = sctx.settings.register("pulse", Config, { base: config });
      settingsScope = scope;
      settingsProvider = sctx.settings;
      resolveConfig = () => scope.get();
      sctx.effect(() => () => {
        settingsScope = null;
        settingsProvider = null;
        resolveConfig = () => config;
        invalidatePayload();
        // The user layer is gone; re-derive the fold from the composition base.
        onSettingsChanged();
      }, "dsh-pulse: settings fallback");
      scope.watch(onSettingsChanged);
      // The user layer may already differ from the composition base at mount.
      onSettingsChanged();
    });
  }

  // --- DeepSeek official balance ---------------------------------------------
  // Security posture: the key is resolved per operation through the
  // credentials seam (the same DEEPSEEK_API_KEY the web Models page writes)
  // and lives only in one outbound Authorization header — never in a
  // response, a log line, an error message, or the store. Only parsed money
  // totals persist, as rolling snapshots in a storage-domain global.
  let balanceDomain = null;
  let balanceOpening = null;
  const openBalanceDomain = () => {
    if (balanceDomain !== null) return Promise.resolve(balanceDomain);
    if (balanceOpening !== null) return balanceOpening;
    const facility = typeof ctx.get === "function" ? ctx.get("storageDomain") : null;
    if (facility === null || typeof facility?.open !== "function") return Promise.resolve(null);
    balanceOpening = facility.open(balanceDomainSpec).then((domain) => {
      balanceDomain = domain;
      ctx.effect(() => async () => {
        balanceDomain = null;
        try { await domain.close(); } catch { /* closing twice is harmless */ }
      }, "dsh-pulse: balance domain");
      return domain;
    }).catch(() => null).finally(() => { balanceOpening = null; });
    return balanceOpening;
  };
  const snapshotsOf = async () => {
    const domain = await openBalanceDomain();
    if (domain === null) return null;
    try {
      const snaps = domain.global.get()?.snapshots;
      return Array.isArray(snaps) ? snaps : null;
    } catch {
      return null;
    }
  };
  /** The official adapter's connection facts: its settings namespace's
   *  `apiKeyEnv` / `baseURL` overrides, or the public defaults. */
  const deepseekConnection = () => {
    let section = null;
    try {
      const raw = settingsProvider !== null ? settingsProvider.get("llm-deepseek") : undefined;
      if (raw !== null && typeof raw === "object") section = raw;
    } catch {
      // An unreadable section falls back to the public defaults.
    }
    const apiKeyEnv = typeof section?.apiKeyEnv === "string" && section.apiKeyEnv.length > 0
      ? section.apiKeyEnv : "DEEPSEEK_API_KEY";
    let base = "https://api.deepseek.com";
    if (typeof section?.baseURL === "string" && section.baseURL.length > 0) {
      try {
        const url = new URL(section.baseURL);
        if (url.protocol === "https:" || url.protocol === "http:") base = url.toString();
      } catch {
        // A malformed override keeps the official endpoint.
      }
    }
    return { apiKeyEnv, balanceUrl: `${base.replace(/\/+$/, "")}/user/balance` };
  };
  const recordSnapshot = async (result) => {
    // The overlay diffs CNY totals; other currencies stay out of the store.
    if (result.currency !== "CNY") return;
    const domain = await openBalanceDomain();
    if (domain === null) return;
    try {
      const current = domain.global.get();
      const snaps = Array.isArray(current?.snapshots) ? current.snapshots.slice() : [];
      const last = snaps[snaps.length - 1];
      if (last !== undefined && result.fetchedAt - last.t < SNAPSHOT_DEDUPE_MS && last.total === result.total) return;
      snaps.push({ t: result.fetchedAt, total: result.total });
      const cutoff = result.fetchedAt - SNAPSHOT_ROLL_MS;
      await domain.global.set({ snapshots: snaps.filter((s) => s.t >= cutoff).slice(-SNAPSHOT_MAX) });
    } catch {
      // A failed snapshot write never breaks the balance reply.
    }
  };
  const fetchBalance = async () => {
    const credentials = typeof ctx.get === "function" ? ctx.get("credentials") : null;
    if (credentials === null || typeof credentials?.resolve !== "function") return { configured: false };
    const { apiKeyEnv, balanceUrl } = deepseekConnection();
    let key = "";
    try {
      const hit = await credentials.resolve(credentialRef(apiKeyEnv));
      key = typeof hit?.value === "string" ? hit.value.trim() : "";
    } catch {
      key = "";
    }
    if (key === "") return { configured: false, ref: apiKeyEnv };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BALANCE_TIMEOUT_MS);
    try {
      const response = await fetch(balanceUrl, {
        headers: { authorization: `Bearer ${key}` },
        redirect: "error",
        signal: controller.signal,
      });
      if (response.ok !== true) return { configured: true, ok: false, error: `HTTP ${response.status}` };
      const body = await response.json();
      const infos = Array.isArray(body?.balance_infos) ? body.balance_infos : [];
      const info = infos.find((entry) => entry?.currency === "CNY") ?? infos[0];
      const total = Number(info?.total_balance);
      if (info === undefined || Number.isFinite(total) !== true) {
        return { configured: true, ok: false, error: "unparsable balance payload" };
      }
      const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
      const result = {
        configured: true,
        ok: true,
        isAvailable: body?.is_available === true,
        currency: typeof info.currency === "string" ? info.currency : "CNY",
        total,
        granted: num(info.granted_balance),
        topped: num(info.topped_up_balance),
        fetchedAt: Date.now(),
      };
      await recordSnapshot(result);
      return result;
    } catch (error) {
      // Cause codes and error names only — they carry no URL and no key.
      return { configured: true, ok: false, error: String(error?.cause?.code ?? error?.name ?? "request failed") };
    } finally {
      clearTimeout(timer);
    }
  };
  const balanceCache = { at: 0, result: null };
  const serveBalance = async (req, res, url) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      json(res, 405, { error: "method not allowed" });
      return;
    }
    const refresh = url.searchParams.get("refresh") === "1";
    if (!refresh && balanceCache.result !== null && Date.now() - balanceCache.at < BALANCE_CACHE_MS) {
      json(res, 200, { ...balanceCache.result, cached: true });
      return;
    }
    const result = await fetchBalance();
    if (result.ok === true) {
      balanceCache.at = Date.now();
      balanceCache.result = result;
    }
    json(res, 200, result);
  };

  /** Predict, at POST time and independent of watch timing, whether the
   *  submitted section changes any model's peak hours — the editor shows a
   *  "history is re-folding" note only when it actually does. */
  const predictRefold = (parsed) => {
    const current = resolveConfig();
    const next = parsed.reset === true ? config : {
      ...current,
      costEnabled: parsed.costEnabled ?? true,
      usdToCny: parsed.usdToCny ?? effectiveUsdToCny(current),
      pricing: Array.isArray(parsed.pricing) ? parsed.pricing : [],
    };
    return peakMapKey(peakMapOf(next)) !== peakMapKey(peakMap);
  };

  ctx.effect(() => ctx.commands.register({
    name: "pulse",
    description: "usage dashboard: tokens, cache hit rate, projects and models across all sessions",
    handler: async ({ signal }) => {
      try {
        const payload = await buildStats(ctx, resolveConfig, {});
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
        if (pathname === "/pulse/settings") {
          await serveSettings(ctx, resolveConfig, () => ({ scope: settingsScope, provider: settingsProvider }), () => llmService, invalidatePayload, predictRefold, req, res);
          return;
        }
        if (pathname === "/pulse/balance") {
          await serveBalance(req, res, url);
          return;
        }
        const wantsJson = pathname === "/pulse" || pathname === "/pulse/stats";
        if (!wantsJson || (req.method !== "GET" && req.method !== "HEAD")) {
          res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
          res.end("not found");
          return;
        }
        const payload = await buildStats(ctx, resolveConfig, {
          from: url.searchParams.get("from"),
          to: url.searchParams.get("to"),
          days: url.searchParams.get("days"),
        }, snapshotsOf);
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

/** JSON helpers for the settings/balance route responses. */
function json(res, status, value) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(value));
}

/** Read a request body as UTF-8 text (streaming for real sockets, `req.body`
 *  for stubs/tests), capped at 1 MiB. */
function readBody(req) {
  if (typeof req.body === "string") return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1e6) {
        reject(new Error("request body too large"));
        if (typeof req.destroy === "function") req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/** `GET /pulse/settings` — the editor's source of truth: the effective
 *  cost-enabled flag, USD→CNY rate and pricing rules (official defaults
 *  merged), the untouched official baseline (for per-row "restore official
 *  rates"), the current model catalog from the `llm` service (the editor's
 *  row source), plus whether the settings provider can persist edits.
 *  `POST /pulse/settings` replaces the user section
 *  (`{costEnabled, usdToCny, pricing}`, or `{reset: true}` to re-inherit the
 *  composition base and official defaults); the reply carries `refold: true`
 *  when the section changes any model's peak hours (history re-folds). */
function serveSettings(ctx, resolveConfig, getSettings, getLlm, invalidate, predictRefold, req, res) {
  if (req.method === "GET" || req.method === "HEAD") {
    return catalogOf(getLlm()).then((catalog) => {
      const config = resolveConfig();
      const settings = getSettings();
      const body = {
        currency: config.currency === "USD" ? "USD" : "CNY",
        costEnabled: config.costEnabled !== false,
        pricing: effectivePricing(config),
        fx: { usdToCny: effectiveUsdToCny(config) },
        official: OFFICIAL_PRICING,
        catalog,
        writable: settings.provider?.writable === true,
      };
      const raw = Buffer.from(JSON.stringify(body), "utf8");
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(req.method === "HEAD" ? undefined : raw);
    }).catch(() => {
      json(res, 500, { error: "settings read failed" });
    });
  }
  if (req.method !== "POST") {
    json(res, 405, { ok: false, error: "method not allowed" });
    return Promise.resolve();
  }
  return readBody(req).then((text) => {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      json(res, 400, { ok: false, error: "invalid JSON body" });
      return;
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      json(res, 400, { ok: false, error: "body must be an object" });
      return;
    }
    const body = z.object({
      costEnabled: z.boolean(),
      usdToCny: z.number(),
      pricing: z.array(pricingRuleSchema),
      currency: z.union(["CNY", "USD"]),
      reset: z.boolean(),
    });
    try {
      body(parsed);
    } catch (error) {
      json(res, 400, { ok: false, error: `invalid settings: ${String(error?.message ?? error)}` });
      return;
    }
    const settings = getSettings();
    if (settings.scope === null) {
      json(res, 503, { ok: false, error: "settings storage is not available in this environment" });
      return;
    }
    // Predicted before persisting: the watch (and the re-register it may
    // trigger) can fire before the write resolves, which would otherwise
    // compare the new map against itself.
    const refold = predictRefold(parsed) === true;
    const persist = parsed.reset === true
      ? settings.scope.replace({})
      // Partial merge: each present field lands in the user section and
      // everything else re-inherits the composition base — the pricing page
      // and the currency settings can save independently.
      : settings.scope.update({
        ...(parsed.costEnabled !== undefined ? { costEnabled: parsed.costEnabled } : {}),
        ...(parsed.usdToCny !== undefined ? { usdToCny: parsed.usdToCny } : {}),
        ...(parsed.pricing !== undefined ? { pricing: parsed.pricing } : {}),
        ...(parsed.currency !== undefined ? { currency: parsed.currency } : {}),
      });
    return persist
      .then(() => {
        invalidate();
        json(res, 200, { ok: true, refold });
      })
      .catch((error) => {
        ctx.logger.warn(error);
        json(res, 400, { ok: false, error: `could not persist settings: ${String(error?.message ?? error)}` });
      });
  }).catch((error) => {
    ctx.logger.warn(error);
    json(res, 400, { ok: false, error: String(error?.message ?? error) });
  });
}
