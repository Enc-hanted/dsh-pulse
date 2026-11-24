import z from "@deepseek-ai/schemastery";
import {
	Config, pricingRuleSchema, VOLATILE_KEYS, unwrapVolatile, liveConfig,
	sanitizeModelColors, sanitizeMonthlyFee, sanitizeSearchShape, sanitizeQuotaSpecs,
	effectiveAuxShape, settingsPatchOf,
} from "./host/config-schema.js";
import {
	mergePricingRows, effectivePricing, peakMapOf, peakMapKey, effectiveUsdToCny, effectiveCardSource,
} from "./host/pricing-config.js";
import { methodNotAllowed, assertCardSourceUrl, refuseCrossSitePost, readBody } from "./http-helpers.js";
import { setQuickReader } from "./quick-reader.js";
export { Config };

/**
 * The shared aggregation entry (`/pulse/stats` and any embedded consumer —
 * the optional usage_query tool package — fold the corpus through this one
 * function, so embedded answers can never drift from the dashboard).
 * Signature: `(ctx, resolveConfig, input, snapshotsOf?, now?) → Promise<payload>`.
 *
 * @function buildStats
 */
export { buildStats };
import {
  balanceSpendSeries, buildPayload, localDay, normalizePeakHours, projectOf,
  pulseProjectionDefinition, resolveWindow, sliceRecord, timelineEvents, PEAK_HOURS,
} from "./aggregate.js";
import { detectAnomalies } from "./view/anomaly.js";
import { AUX_SHAPE, AUX_PRICE_AS, DEFAULT_USD_TO_CNY, modelKey, OFFICIAL_PRICE_SCHEDULES, splitModelKey, applyDisplay } from "./view.js";
import { RATECARD, RATECARD_VERSION, activeCard, PROVIDER_SPECS } from "./pricing-facts.js";
import { validateProviderSpec } from "./pricing/card-schema.js";
import { DEFAULT_CARD_SOURCE } from "./pricing/card.js";
import { createCardStore } from "./pricing/store.js";
import { handlePricingCardRoute } from "./pricing/routes.js";
import { createBalanceService } from "./balance-service.js";
import { createQuotaService } from "./quota-service.js";
import { json } from "./http-helpers.js";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";


/**
 * dsh-pulse — the usage & cost observatory.
 *
 * Host half: registers the `pulseUsage` session-projection unit (the
 * harness drives it incrementally over every committed event, and persisted
 * sessions are served by the harness cache's read ladder — the zero-I/O
 * stored-row read for unseeded sessions, otherwise a full-log cold fold the
 * 0.1.2-rc cache expects its callers to drive; pre-0.1.2 caches keep their
 * self-reading `coldSnapshot(id)`), then serves `/pulse/stats?from=&to=` as
 * same-origin JSON (plus the settings, session-detail, balance and update-check
 * routes). There is no host command: the `/` menu entry is a client
 * contribution that opens the plugin's own floating seat, so the menu shows one
 * row with a glyph and no second, glyph-less catalog row. Per-request work is
 * O(corpus) lightweight reads — no session log is re-folded on demand beyond
 * what the ladder needs. The day/week/month/project views and cost estimate
 * are folded client-side from the windowed records. Nothing here is
 * model-visible: no prompt surface, no tools, no tokens spent.
 *
 * @module dsh-pulse
 */

/** Cordis plugin name used by loader diagnostics. */
export const name = "pulse";

/**
 * The plugin context the host hands `apply` and the services: the injected
 * members (the `inject` list below) plus the fiber runtime. Members are
 * optional and loosely typed — assemblies differ (a profile without the
 * web bundle leaves the fiber pending) and every access is guarded at
 * runtime.
 *
 * @typedef {object} HostCtx
 * @property {any} [sessions] - live session store.
 * @property {any} [sessionProjections] - projection registry (the fold driver).
 * @property {any} [sessionProjectionCache] - persisted projection cache.
 * @property {any} [sessionQuery] - query corpus (listing + log reads).
 * @property {any} [webServer] - prefix-route registrar.
 * @property {any} [logger] - fiber logger.
 * @property {any} [effect] - fiber-scoped effect ledger.
 * @property {any} [inject] - late service injector.
 * @property {(name: string, optional?: boolean) => any} [get] - service getter.
 */

/**
 * Host services: the projection registry + persisted cache (the fold), the
 * session store (live snapshots), the query corpus (listing), and the web
 * server. In assemblies without the projection registry (a profile without the
 * web bundle) the fiber stays pending.
 */
export const inject = [
  "sessionQuery", "webServer",
  "sessionProjections", "sessionProjectionCache", "sessions",
];








/**
 * Fold the whole corpus into windowed per-session records.
 *
 * Live sessions read their O(1) watermark-cache snapshot from the projection
 * registry; persisted sessions go through the harness cache's read ladder
 * (below). One unreadable session is skipped, never fatal. Concurrent
 * requests for the same window share one in-flight fold, and a short TTL
 * cache serves recently folded windows again so tab switches and duplicate
 * dashboard mounts stay cheap.
 *
 * @param {HostCtx} ctx - plugin context carrying the injected services.
 * @param {() => object} resolveConfig - thunk returning the authoritative
 *   plugin configuration (composition entry, or the `pulse` settings
 *   namespace resolution once the settings service is present).
 * @param {{from?: string, to?: string, days?: number|string}} input - request window.
 * @param {() => Promise<Array<{t: number, total: number}|null>>} [snapshotsOf] - balance
 *   snapshot accessor; when present the payload carries `balanceSeries`.
 * @param {number} [now] - clock override for tests (window resolution); defaults
 *   to the real clock.
 * @returns {Promise<any>} the `/pulse/stats` payload.
 */
const PAYLOAD_TTL_MS = 15000;
const inflight = new Map();
const lastServed = new Map();
/** Persisted-session projections shared across windows for one TTL. The
 *  expensive half of a fold — every persisted session's stored-row read or
 *  body read + cold fold — is window-independent (only `sliceRecord` and
 *  `buildPayload` look at the dates), so before this cache every range
 *  switch rescanned the whole corpus and the user waited a full fold per
 *  window. Same invalidation contract as the payload cache: host context +
 *  corpus count + serveEpoch + PAYLOAD_TTL_MS. Live sessions are NEVER
 *  cached — the fold reads their in-memory snapshot every time, so 「今日」
 *  stays exactly as fresh as before. A failed or unreadable session is
 *  remembered as null for the TTL (it was skipped on every fold anyway). */
/** @type {{ctx: any|null, corpus: number, epoch: number, at: number, values: Map<string, any>|null}} */
let projections = { ctx: null, corpus: -1, epoch: -1, at: 0, values: null };
/** @type {{ctx: any, corpus: number, epoch: number, promise: Promise<Map<string, any>>|null}|null} */
let projectionFlight = null;
/** Drop the shared projections (settings/card change, projection
 *  re-register, loader restart): rows folded under the old tier split must
 *  never be reused. */
function resetProjections() {
  projections = { ctx: null, corpus: -1, epoch: -1, at: 0, values: null };
}
/** The window-independent half of a fold: id → pulseUsage for every
 *  persisted session in `sessions`. Concurrent folds of one generation
 *  (rapid range switching) share the same pass instead of racing each
 *  other for the store. */
async function projectedPersisted(ctx, sessions, epoch) {
  const corpus = sessions.length;
  if (projections.values !== null && projections.ctx === ctx && projections.corpus === corpus
      && projections.epoch === epoch && Date.now() - projections.at < PAYLOAD_TTL_MS) {
    return projections.values;
  }
  if (projectionFlight !== null && projectionFlight.ctx === ctx && projectionFlight.corpus === corpus
      && projectionFlight.epoch === epoch) {
    return projectionFlight.promise;
  }
  /** @type {{ctx: any, corpus: number, epoch: number, promise: Promise<Map<string, any>>|null}} */
  const flight = { ctx, corpus, epoch, promise: null };
  flight.promise = (async () => {
    const values = new Map();
    for (const entry of sessions) {
      if (entry.live) continue;
      try {
        const projected = await projectionValuesOf(ctx, entry);
        values.set(entry.header.id, projected === undefined ? null : projected.pulseUsage ?? null);
      } catch {
        values.set(entry.header.id, null);
      }
    }
    return values;
  })().finally(() => { if (projectionFlight === flight) projectionFlight = null; });
  projectionFlight = flight;
  const values = await flight.promise;
  // A pass that started before a settings change must not land its
  // now-stale tiers in the cache (the payload cache's epoch rule).
  if (epoch === serveEpoch) projections = { ctx, corpus, epoch, at: Date.now(), values };
  return values;
}
/** Boot-time stored-card apply; buildStats awaits it so the first cold
 *  request never prices against the seed by race. Reassigned per apply(). */
let cardReady = Promise.resolve();

/**
 * One session's `pulseUsage` projection values.
 *
 * The persisted-cache read ladder of the supported host generation (0.1.7+
 * seam shapes): live sessions read the registry snapshot; unseeded persisted
 * sessions try the zero-I/O `cachedSnapshot(meta, keys)` stored-row read
 * (lifecycle identity rides the header alone — a seeded header-only listing
 * cannot know its checkpoint cut, so it skips straight to the authoritative
 * body read); everything else folds through `sessionQuery.readSession` +
 * the synchronous `coldSnapshot(session, inheritedEventCount, events)`. A
 * listed-live id that already left the store falls through to the persisted
 * paths instead of folding to an empty record. Older generations
 * (pre-0.1.2-rc self-reading, 0.1.2-rc explicit-cut) were dropped with the
 * 0.2.1 floor — this one build serves exactly the shape
 * {@link assertSeamShape} asserts at startup.
 *
 * @param {HostCtx} ctx - plugin context carrying the injected services.
 * @param {{live: boolean, header: {id?: string, createdAt?: number, cwd?: string, isSeeded?: boolean, origin?: string, parentSession?: string|null, delegationDepth?: number}}} entry - one `sessionQuery.listSessions` record.
 * @returns {Promise<{pulseUsage?: any}|undefined>} the projection values map, or
 *   `undefined` when the session has no readable projection state.
 */
async function projectionValuesOf(ctx, entry) {
  const header = entry.header;
  if (entry.live) {
    const liveSession = ctx.sessions.get(header.id);
    if (liveSession !== undefined) return ctx.sessionProjections.snapshot(liveSession).values;
  }
  const cache = ctx.sessionProjectionCache;
  if (cache === undefined || typeof cache.coldSnapshot !== "function") return undefined;
  // The fast path only claims a hit when this unit's own key came back — a
  // row stored under an older fold version is filtered out and must refold.
  if (header.isSeeded === false && typeof cache.cachedSnapshot === "function") {
    const cached = cache.cachedSnapshot(header, ["pulseUsage"]);
    if (cached !== undefined && cached.values?.pulseUsage !== undefined) return cached.values;
  }
  const loaded = await ctx.sessionQuery.readSession(header.id);
  return cache.coldSnapshot(loaded.session, loaded.inheritedEventCount, loaded.events).values;
}
/** Cache generation: bumped on every invalidation so a fold that started
 *  before a settings change can never land its (now stale) payload in the
 *  TTL cache after the clear — the race would otherwise serve old prices for
 *  up to one TTL window. */
let serveEpoch = 0;

/** One folded payload that landed after the corpus moved — see
 *  {@link buildStats}. Empty payloads are also never cached: a window with
 *  no activity is what a freshly opened harness reports before its first
 *  message commits, and pinning that for a TTL would show "no sessions" to a
 *  user who plainly has sessions. */
function isCachable(payload) {
  return Array.isArray(payload?.sessions) && payload.sessions.length > 0;
}

async function buildStats(ctx, resolveConfig, input, snapshotsOf, now = Date.now()) {
  await cardReady;
  const config = resolveConfig();
  const { fromDay, toDay } = resolveWindow(input, config.defaultDays, now);
  // The served window is stable under the TTL, but the corpus behind it is
  // not: a session created or written between two reads changes what the same
  // window contains. The corpus count is therefore part of the cache key, so a
  // payload folded before that write can never be served as if it were after.
  // Only the newest count is remembered — the cache is a warm-read shortcut,
  // not a history of windows. ONE listing serves both the key and the fold
  // (they used to be two listings, so the key and the folded corpus could
  // diverge by a write in between).
  const base = `${fromDay}:${toDay}`;
  const sessions = await listCorpus(ctx);
  let corpus = sessions.length;
  const fresh = lastServed.get(base);
  if (fresh !== undefined && fresh.corpus === corpus && Date.now() - fresh.at < PAYLOAD_TTL_MS) return fresh.payload;
  const epochAtStart = serveEpoch;
  // The fold runs to completion regardless of requester sockets: an aborted
  // HTTP wait must never truncate the fold, or the TTL cache would serve a
  // partial window (rapid range switching aborted folds mid-loop). A retry
  // shares this still-running flight instead of restarting it.
  const existing = inflight.get(base);
  const flight = existing !== undefined
    ? existing
    : aggregate(ctx, config, fromDay, toDay, snapshotsOf, sessions, epochAtStart).finally(() => inflight.delete(base));
  inflight.set(base, flight);
  const payload = await flight;
  // A fold that started before a settings change must never land its now-stale
  // prices in the cache: the epoch guard is what keeps the clear authoritative.
  if (epochAtStart !== serveEpoch) return payload;
  // An empty payload is never cached: a window with no activity is exactly what
  // a freshly opened harness reports before its first message commits, and
  // pinning that for a TTL would show "no sessions" to a user who plainly has
  // sessions.
  if (isCachable(payload)) {
    if (Number.isFinite(payload.corpusSessions)) corpus = payload.corpusSessions;
    lastServed.set(base, { payload, corpus, at: Date.now() });
  } else if (lastServed.get(base)?.payload === payload) {
    lastServed.delete(base);
  }
  return payload;
}

/** Session count of the corpus, through the query service's listing. One
 *  unreadable listing reports zero rather than failing the whole read: the
 *  payload then re-folds on the next request instead of erroring the
 *  dashboard. */
async function listCorpus(ctx) {
  try {
    const sessions = await ctx.sessionQuery.listSessions();
    return Array.isArray(sessions) ? sessions : [];
  } catch {
    return [];
  }
}

async function aggregate(ctx, config, fromDay, toDay, snapshotsOf, sessions, epoch) {
  const pricing = effectivePricing(config);
  const persisted = await projectedPersisted(ctx, sessions, epoch);
  const records = [];
  for (const entry of sessions) {
    try {
      const header = entry.header;
      // A live session is read at fold time — its in-memory snapshot moves
      // with every commit — and so is any persisted session the shared pass
      // does not know (a corpus that changed shape without changing count).
      let pulse;
      if (entry.live) {
        pulse = (await projectionValuesOf(ctx, entry))?.pulseUsage;
      } else {
        const shared = persisted.get(header.id);
        pulse = shared !== undefined ? (shared ?? undefined) : (await projectionValuesOf(ctx, entry))?.pulseUsage;
      }
      const record = sliceRecord({
        id: header.id,
        createdAt: header.createdAt,
        createdDay: localDay(header.createdAt),
        project: projectOf(header.cwd, config.projectDepth),
        subagent: header.origin === "subagent",
        parentSession: header.parentSession ?? null,
        delegationDepth: Number.isFinite(header.delegationDepth) ? header.delegationDepth : 0,
        firstDay: pulse?.firstDay ?? null,
        title: pulse?.title ?? null,
        byDay: pulse?.byDay ?? {},
        modelsByDay: pulse?.modelsByDay ?? {},
        hoursByDay: pulse?.hoursByDay ?? {},
        tiersByDay: pulse?.tiersByDay ?? {},
        turnsByDay: pulse?.turnsByDay ?? {},
        toolCallsByDay: pulse?.toolCallsByDay ?? {},
        toolHistogramByDay: pulse?.toolHistogramByDay ?? {},
        auxByDay: pulse?.auxByDay ?? {},
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
    displayCurrency: config.displayCurrency,
    fx: { usdToCny: effectiveUsdToCny(config) },
    monthly: Array.isArray(config.monthlyProviders) ? config.monthlyProviders : [],
    corpusSessions: sessions.length,
  });
  // Anomaly detection rides the same sliced records — observational numbers
  // only, computed per request and never persisted (see view/anomaly.js).
  payload.anomalies = detectAnomalies(records);
  // The reconciliation overlay rides along when the storage domain (and
  // therefore snapshot history) is available; otherwise the key stays absent
  // and the client hides the overlay.
  if (typeof snapshotsOf === "function") {
    const snaps = await snapshotsOf();
    if (snaps !== null) payload.balanceSeries = balanceSpendSeries(snaps, fromDay, toDay);
  }
  // Per-model accent overrides ride along like the balance series: display
  // config, not aggregated data, and present on every host (additive field —
  // older clients ignore it, older payloads leave the map empty → all auto).
  payload.modelColors = sanitizeModelColors(unwrapVolatile(config.modelColors) ?? {});
  // The effective aux call shape (manual keys over the built-in seed) — the
  // client's self-calibration starts here and freezes when `manual` is true.
  payload.auxShape = effectiveAuxShape(config);
  return payload;
}

/** Short TTL for the enumerated catalog: the model catalog is configuration,
 *  not hot data, so a brief cache lets rapid tab switching read the editor's
 *  source of truth without re-listing every provider's models each time. */
const CATALOG_CACHE_MS = 3000;
let catalogCache = { at: 0, value: null, llm: null };
/** Drop the catalog cache (e.g. after a settings save). */
function invalidateCatalog() {
  catalogCache = { at: 0, value: null, llm: null };
}

/** Enumerate the harness's current model catalog (the Models settings page)
 *  through the `llm` service: one group per provider route, each with its
 *  configured models. One broken provider is skipped, never fatal; the call
 *  is advisory and touches no network on the bundled adapters. Result is
 *  cached briefly per `llm` reference to keep rapid page-switch reads cheap. */
async function catalogOf(llm) {
  if (llm === null || typeof llm !== "object") return [];
  if (catalogCache.llm === llm && catalogCache.value !== null
    && Date.now() - catalogCache.at < CATALOG_CACHE_MS) {
    return catalogCache.value;
  }
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
  catalogCache = { at: Date.now(), value: out, llm };
  return out;
}

/** Version of a seam package as this process actually resolved it. The
 * one-line startup log makes version skew visible in the host log: a stale
 * local tree shadowing the host's own seam copy (what happens when a seam
 * rides `dependencies` instead of `peerDependencies` — the host's
 * linked-root interception only claims peer-listed names) shows up here as
 * a version that is not the host's, instead of being discoverable only by
 * dissecting node_modules.
 *
 * @param {string} specifier - package whose resolved version to report.
 * @returns {string} the resolved package's version, or "unknown".
 */
function seamVersionOf(specifier) {
  try {
    const require = createRequire(import.meta.url);
    const manifestPath = join(dirname(require.resolve(specifier)), "package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    return typeof manifest.version === "string" ? manifest.version : "unknown";
  } catch {
    return "unknown";
  }
}

/** Guardrail B: the one explicit seam-shape assertion, replacing the five
 * implicit arity probes this plugin used to carry. A future host that
 * reshapes `sessionProjectionCache` must fail LOUDLY here — one error log
 * and a 503 on the stats route — instead of letting the per-session guard
 * silently skip every session until the dashboard looks empty. Set once at
 * apply() time; reset (re-checked) on every re-apply.
 * @type {string|null}
 */
let seamShapeFailure = null;

/**
 * Assert the persisted-cache seam carries the supported (0.1.7+) call
 * shapes: `coldSnapshot(session, cut, events)` (arity ≥ 3) and
 * `cachedSnapshot(meta, keys)` (arity 2). Assemblies without the cache
 * service are not a failure — the fiber simply has nothing to assert.
 *
 * @param {HostCtx} ctx - plugin context carrying the injected services.
 */
function assertSeamShape(ctx) {
  const cache = ctx.sessionProjectionCache;
  if (cache === undefined) return;
  const coldArity = typeof cache.coldSnapshot === "function" ? cache.coldSnapshot.length : -1;
  const fastArity = typeof cache.cachedSnapshot === "function" ? cache.cachedSnapshot.length : -1;
  if (coldArity >= 3 && fastArity === 2) return;
  seamShapeFailure = `sessionProjectionCache seam shape mismatch (coldSnapshot arity ${coldArity}, cachedSnapshot arity ${fastArity}); `
    + "expected the 0.1.7+ shapes this build supports — see docs/COMPATIBILITY.md#guardrails";
  ctx.logger?.error?.(`dsh-pulse: ${seamShapeFailure}`);
}

/**
 * Register the `pulseUsage` projection unit, the `pulse` settings namespace
 * (user-editable pricing and cost display) and the `/pulse` HTTP routes.
 * Every registration is an effect on this fiber, so
 * unloading the plugin removes all of them.
 *
 * The projection unit is registered with the peak-hour map derived from the
 * authoritative config. When a settings edit changes any model's peak hours,
 * the unit is re-registered at a bumped `stateVersion` — persisted cache
 * rows stop matching, so every session re-folds from its log on the next
 * read and history reprices correctly. Price-only edits (rates, currency,
 * fx, costEnabled) never touch the fold and never trigger a replay.
 * @param {HostCtx} ctx - plugin context carrying the injected services.
 * @param {object} config - deployment configuration (the settings namespace's composition `base` layer).
 */
export function apply(ctx, config) {
  ctx.logger?.info?.(
    `dsh-pulse ${seamVersionOf("dsh-pulse/package.json")} on seams dsh-credentials ${seamVersionOf("@deepseek-ai/dsh-credentials")} / dsh-storage-domain ${seamVersionOf("@deepseek-ai/dsh-storage-domain")}`);
  seamShapeFailure = null;
  assertSeamShape(ctx);
  /** Fold-semantics epoch: 0 at load, +1 per peak-hour change. The persisted
   *  rows of every older epoch are invalid by construction. */
  let epoch = 0;
  let peakMap = peakMapOf(config);
  /** Tier scope for a composite fold key (`provider\u0000model`), falling back
   *  to a provider-less (wildcard) rule's spec and then the official default
   *  (the official hours, weekdays only). */
  const peakHoursFor = (model) => peakMap.get(model) ?? peakMap.get(splitModelKey(model).model) ?? { hours: PEAK_HOURS, weekdaysOnly: true };
  let disposeProjection = ctx.sessionProjections.register(
    pulseProjectionDefinition({ peakHoursFor, stateVersion: 11 + epoch }),
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
          await projectionValuesOf(ctx, entry);
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
    // Persisted rows folded under the old definition no longer match — the
    // shared projections must not survive the re-register either.
    resetProjections();
    disposeProjection();
    disposeProjection = ctx.sessionProjections.register(
      pulseProjectionDefinition({ peakHoursFor, stateVersion: 11 + epoch }),
    );
    void warmUpRefolds();
  };

  /** Re-derive the fold's tier map after a config edit OR a card apply;
   *  re-register (and warm refolds) only when the tier scope moved. The
   *  signature includes the LIVE official peak hours: official rows are
   *  always `inherited`, so a card peak-hours change leaves peakMap empty
   *  yet still invalidates every persisted tier split. It also includes the
   *  aux price-as model: the fold bakes aux-call tiers under `auxTierKey()`
   *  (aggregate.js), so a card that retargets AUX_PRICE_AS changes what the
   *  SAME events fold into tiersByDay — tier semantics, not a display knob. */
  let peakSignature = `${peakMapKey(peakMap)}|${PEAK_HOURS.join()}|${AUX_PRICE_AS}`;
  const syncPeak = () => {
    const next = peakMapOf(resolveConfig());
    const sig = `${peakMapKey(next)}|${PEAK_HOURS.join()}|${AUX_PRICE_AS}`;
    if (sig !== peakSignature) {
      peakSignature = sig;
      peakMap = next;
      reRegisterProjection();
      return true;
    }
    return false;
  };

  /** Track the `llm` service when present, for the settings editor's model
   *  catalog; absent services (profiles without an llm bundle) leave the
   *  editor on its usage-and-manual fallback rows. */
  let llmService = null;
  /** Live view of every active entry's config (0.1.7+ describe rows), the
   *  quota credential resolver's source for per-route `apiKeyEnv` overrides.
   *  Null on classic hosts, whose provider cannot enumerate namespaces. */
  let llmDescribe = null;
  if (typeof ctx.inject === "function") {
    ctx.inject(["llm"], (lctx) => {
      llmService = lctx.llm ?? null;
      lctx.effect(() => () => { llmService = null; }, "dsh-pulse: llm fallback");
    });
  }

  // Authoritative config. Serve-time fields stay live: `liveConfig` resolves
  // the volatile references the harness hands `apply`, so display edits take
  // effect without touching this fiber. Persistent writes ride the settings
  // seam — classic hosts register a per-plugin namespace with the
  // SettingsProvider; 0.1.7+ hosts write this entry's config through the
  // schema-driven SettingsForms under revision checks.
  let resolveConfig = () => liveConfig(config);
  let settingsSeam = null;
  let settingsProvider = null;
  const invalidatePayload = () => { lastServed.clear(); resetProjections(); serveEpoch += 1; };
  /** 卡变更后的同一串收尾（refreshCard / boot / onSettingsChanged / reset
   *  四处曾各自手抄）：丢掉已服务的 payload 与会话缓存、按新卡重推显示
   *  汇率，再让 syncPeak 决定是否重折叠。返回 syncPeak() 的结果（refold
   *  标志），调用方照旧拿它作响应字段。 */
  const afterCardChange = () => {
    invalidatePayload();
    sessionCache.clear();
    applyDisplay(resolveConfig().displayCurrency, effectiveUsdToCny(resolveConfig()));
    return syncPeak();
  };
  // The module-level TTL cache outlives a loader restart (only the fiber is
  // recycled), so every (re)application starts from a clean payload slate.
  invalidatePayload();
  /** The stored data-card override (import/pull) lives in the card store:
   *  it applies a stored card at boot (buildStats awaits `cardReady` so a
   *  cold first request never prices against the seed by race), and every
   *  card change funnels back through afterCardChange. */
  const cardStore = createCardStore({ ctx, afterChange: afterCardChange });
  cardReady = cardStore.cardReady;
  // apply() 时的一次性显示初始化经由 onSettingsChanged（内部走 afterCardChange
  // 的 helper 版 applyDisplay）：此前 569 行的裸 applyDisplay 与 572 行的重复
  // 调用是同一配置的连打，现在只保留 helper 里那一次。
  const onSettingsChanged = () => afterCardChange();
  onSettingsChanged();
  if (typeof ctx.inject === "function") {
    ctx.inject(["settings"], (sctx) => {
      const forms = sctx.settings;
      // Generation probe — structural, because method presence cannot pick
      // the seam: every classic SettingsProvider (0.1.5 through rc.7) also
      // carries describe/update, and only `register` separates the lines
      // (classic: register(ns, schema, options); SettingsForms has none).
      // The entry-row lookup stays lazy below — at inject time this entry's
      // own describe() row may not exist yet.
      if (forms !== null && typeof forms === "object" && typeof forms.register === "function" && forms.register.length >= 2) {
        // Classic SettingsProvider generation: a per-plugin namespace whose
        // user layer the provider persists (settings.yaml).
        const scope = forms.register("pulse", Config, { base: config });
        settingsProvider = forms;
        settingsSeam = {
          writable: () => settingsProvider?.writable === true,
          revision: () => undefined,
          write: (body) => body.reset === true
            ? Promise.resolve(scope.replace({}))
            : Promise.resolve(scope.update(settingsPatchOf(body))),
        };
        resolveConfig = () => liveConfig(scope.get());
        sctx.effect(() => () => {
          settingsProvider = null;
          settingsSeam = null;
          resolveConfig = () => liveConfig(config);
          invalidatePayload();
          // The user layer is gone; re-derive the fold from the composition base.
          onSettingsChanged();
        }, "dsh-pulse: settings fallback");
        scope.watch(onSettingsChanged);
        // The user layer may already differ from the composition base at mount.
        onSettingsChanged();
        return;
      }
      if (forms === null || typeof forms !== "object" || typeof forms.describe !== "function" || typeof forms.update !== "function") return;
      // 0.1.7+ SettingsForms generation. The entry row is located by
      // namespace — the profile patch's entry id. describe() carries
      // serialized schemas (toJSON copies, never this module's Config
      // object), so the id is the only addressing there is and the write
      // error names it when the entry was renamed or removed. describe()
      // also carries the live revision that turns every editor save into an
      // optimistic-concurrency write against the active profile patch.
      let entryNs = null;
      const findRow = () => {
        const row = forms.describe().find((candidate) => candidate.ns === "pulse");
        if (row !== undefined) entryNs = row.ns;
        return row ?? null;
      };
      settingsSeam = {
        writable: () => forms.writable === true && findRow() !== null,
        revision: () => findRow()?.revision,
        write: (body) => {
          const row = findRow();
          if (row === null) return Promise.reject(new Error('no settings row found for entry id "pulse" — the entry may have been renamed in this profile'));
          return body.reset === true
            ? forms.replace(row.ns, {}, body.revision)
            : forms.update(row.ns, settingsPatchOf(body), body.revision);
        },
      };
      // Bridge the connection facts the classic path read through the
      // provider (`settingsProvider.get("llm-deepseek")`): describe() shows
      // every active entry's live config, redacted.
      settingsProvider = { get: (ns) => forms.describe().find((row) => row.ns === ns)?.value };
      llmDescribe = () => {
        try { return forms.describe(); } catch { return []; }
      };
      // The forms service emits one event for any entry's revision change —
      // our own writes and the host settings page's land here. Peak-hour
      // changes normally arrive through the entry restart instead, so this
      // feed mostly invalidates the payload TTL early; the peak comparison
      // stays as a same-generation belt for hosts that hot-swap configs.
      const disposeFeed = typeof sctx.on === "function"
        ? sctx.on("settings/document-updated", (ns) => {
          if (entryNs === null || ns === entryNs) onSettingsChanged();
        })
        : null;
      // Cleanup mirrors the classic branch's reset list item for item —
      // a hung seam would keep reporting writable against a stopped
      // provider, and GET would 400 with a misleading message where 503
      // is the truth.
      sctx.effect(() => () => {
        settingsSeam = null;
        settingsProvider = null;
        llmDescribe = null;
        invalidatePayload();
        if (typeof disposeFeed === "function") disposeFeed();
      }, "dsh-pulse: settings feed");
    });
  }

  // --- DeepSeek official balance + subscription quota ------------------------

  // Both remote services hold the same posture (src/balance-service.js,

  // src/quota-service.js): the key is resolved per operation through the

  // credentials seam and lives only in one outbound Authorization header —

  // never in a response, a log line, an error message, or the store. Only

  // parsed money totals and utilization percentages persist, as rolling

  // snapshots in storage-domain globals (src/rolling-domain.js).

  const balance = createBalanceService({

    ctx,

    deepseekSection: () => (settingsProvider !== null ? settingsProvider.get("llm-deepseek") : undefined),

  });

  const quota = createQuotaService({

    ctx,

    resolveConfig: () => resolveConfig(),

    llmServiceOf: () => llmService,

    llmDescribeOf: () => (typeof llmDescribe === "function" ? llmDescribe() : null),

  });

  // The TUI strip's quick-display source reads the same cached cores the
  // web faces poll — one selection (config footSource), two faces.
  // 注册走 ctx.effect 并带 disposer：fiber 重建时不留下指向旧闭包的 reader。
  // 注：TUI 半区与 web 半区在 cordis.patch.yml 里互斥（同一入口只挂其一），
  // 目前 TUI 进程里没有这段接线，reader 为 null、快显段不渲染——接线留待
  // 后续版本；seam 本体已迁往中立的 src/quick-reader.js。
  ctx.effect(() => {
    setQuickReader(async () => ({
      balance: await balance.getBalance(false),
      quota: await quota.getQuota(false),
      footSource: resolveConfig().footSource ?? "",
    }));
    return () => setQuickReader(null);
  });


  /** Predict, at POST time and independent of watch timing, whether the
   *  submitted section changes any model's tier scope — the editor shows a
   *  "history is re-folding" note only when it actually does. Partial merges
   *  (a POST that omits `pricing`, e.g. currency or monthly-only saves) keep
   *  the current pricing in the prediction.
   *
   *  The comparison is over the EFFECTIVE rules, not over the submitted rows:
   *  the fold keys off every model id an event can carry, so a submit that
   *  only drops a now-redundant alias row (or an untouched model whose official
   *  default already says what the row said) changes the stored section without
   *  changing a single tier assignment — and must not claim a replay. */
  const predictRefold = (parsed) => {
    const current = resolveConfig();
    const next = parsed.reset === true ? config : {
      ...current,
      costEnabled: parsed.costEnabled ?? current.costEnabled !== false,
      usdToCny: parsed.usdToCny ?? effectiveUsdToCny(current),
      pricing: Array.isArray(parsed.pricing) ? parsed.pricing : current.pricing,
    };
    return peakMapKey(peakMapOf(next)) !== peakMapKey(peakMapOf(current));
  };

  // No host command: the '/' menu entry is a CLIENT contribution named
  // `pulse` (lib/client.js). dsh's menu facade draws glyphs only for its own
  // six built-ins, while a contribution may carry an icon and locale-aware
  // copy — and a contribution that collides with a host command name fails
  // loud, so a host command would necessarily add a second, glyph-less row to
  // every menu. The `/pulse` row therefore opens the plugin's own floating
  // seat (the compact session summary, handing over to the full observatory)
  // instead of executing a host command; the token/cost data all surfaces
  // share stays on `GET /pulse/stats`.

  ctx.effect(() => ctx.webServer.register({
    kind: "prefix",
    path: "/pulse",
    handler: async (req, res) => {
      try {
        const url = new URL(req.url ?? "/", "http://x");
        const pathname = decodeURIComponent(url.pathname);
        if (pathname === "/pulse/settings") {
          await serveSettings(ctx, resolveConfig, () => settingsSeam, () => llmService, invalidatePayload, predictRefold, req, res);
          return;
        }
        if (pathname === "/pulse/session") {
          await serveSession(ctx, url, req, res);
          return;
        }
        if (pathname === "/pulse/balance") {
          await balance.serveBalance(req, res, url);
          return;
        }
        if (pathname === "/pulse/quota") {
          await quota.serveQuota(req, res, url);
          return;
        }
        if (pathname === "/pulse/quota/probe") {
          if (req.method !== "POST") {
            methodNotAllowed(res, "POST");
            return;
          }
          if (refuseCrossSitePost(req, res)) return;
          let body = {};
          try { body = JSON.parse((await readBody(req)) || "{}"); } catch { json(res, 400, { ok: false, error: "invalid JSON body" }); return; }
          const route = typeof body?.route === "string" ? body.route : "";
          if (route === "" || route.length > 120) { json(res, 400, { ok: false, error: "route required" }); return; }
          const spec = body?.spec ?? PROVIDER_SPECS.find((s) => s.routes.includes(route))
            ?? sanitizeQuotaSpecs(unwrapVolatile(resolveConfig().quotaSpecs) ?? {})[route];
          if (spec === undefined || spec === null) { json(res, 400, { ok: false, error: "no query spec for this route" }); return; }
          // Draft posture only for the explicit body.spec probe; a
          // card/custom roster spec keeps the strict hostFor that refuses an
          // undeclared route variant instead of falling back to hosts[0].
          const draft = body?.spec !== undefined && body?.spec !== null;
          if (draft) {
            // An invalid draft is a bad request body, like invalid JSON or a
            // missing route. probeSpec keeps its own validation as the
            // service boundary, but letting that throw ride to the route
            // catch would answer a malformed body with 500 where every
            // sibling invalid-body case answers 400.
            try { validateProviderSpec(spec); } catch (error) {
              json(res, 400, { ok: false, error: `invalid query spec: ${String(error?.message ?? error)}` });
              return;
            }
          }
          json(res, 200, await quota.probeSpec(route, spec, { draft }));
          return;
        }
        if (pathname === "/pulse/update-check") {
          await serveUpdateCheck(req, res, effectiveCardSource(resolveConfig()));
          return;
        }
        if (await handlePricingCardRoute(pathname, req, res, { store: cardStore, cardSource: () => effectiveCardSource(resolveConfig()), afterChange: afterCardChange })) return;
        const wantsJson = pathname === "/pulse" || pathname === "/pulse/stats";
        if (!wantsJson || (req.method !== "GET" && req.method !== "HEAD")) {
          res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
          res.end("not found");
          return;
        }
        // Guardrail B's gate: a seam-shape mismatch fails loudly here rather
        // than degrading into a silently empty dashboard.
        if (seamShapeFailure !== null) {
          json.err(res, 503, seamShapeFailure);
          return;
        }
        const payload = await buildStats(ctx, resolveConfig, {
          from: url.searchParams.get("from"),
          to: url.searchParams.get("to"),
          days: url.searchParams.get("days"),
        }, balance.snapshotsOf);
        json.raw(res, req, 200, payload);
      } catch (error) {
        ctx.logger.warn(error);
        json.err(res, 500, String(error?.message ?? error));
      }
    },
  }), "dsh-pulse: /pulse route");
}

/**
 * `GET /pulse/update-check` — the settings page's manual version check.
 *
 * This is the ONLY outbound network call dsh-pulse makes, and it runs only
 * when the user presses the button: nothing schedules it, there is no timer
 * and no probe at load. The registry lookup happens host-side so the browser
 * never issues a cross-origin request, and a failure is reported as data
 * (`ok:false`) rather than an HTTP error, so the panel can render it as one
 * of its outcome states. The published version is compared client-side
 * against the bundle's own `DP_BUILD`.
 *
 * @param {any} req - node request.
 * @param {any} res - node response.
 */
async function serveUpdateCheck(req, res, cardSource) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    methodNotAllowed(res, "GET, HEAD");
    return;
  }
  try {
    const response = await fetch("https://registry.npmjs.org/dsh-pulse", {
      headers: { accept: "application/vnd.npm.install-v1+json, application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`npm registry HTTP ${response.status}`);
    const meta = await response.json();
    const latest = typeof meta?.["dist-tags"]?.latest === "string" ? meta["dist-tags"].latest : null;
    if (latest === null) throw new Error("npm registry reports no dist-tags.latest for dsh-pulse");
    // Best-effort remote card probe so the settings page can say a newer
    // CARD exists without a plugin release; unreachable is data, not error.
    // 卡源先过同一个 assertCardSourceUrl 门禁（它是可选探测，配置坏了不能
    // 把整个检查打成 500）：门禁失败回退 DEFAULT_CARD_SOURCE 照常走。
    let remoteCard = null;
    try {
      let probeSource = cardSource;
      try { assertCardSourceUrl(probeSource); } catch { probeSource = DEFAULT_CARD_SOURCE; }
      const cr = await fetch(probeSource, {
        headers: { accept: "application/json" },
        redirect: "error",
        signal: AbortSignal.timeout(4000),
      });
      if (cr.ok) {
        const card = await cr.json();
        if (card !== null && typeof card === "object" && Number.isFinite(card.version)) {
          remoteCard = { version: card.version, checkedAt: typeof card.checkedAt === "string" ? card.checkedAt : null };
        }
      }
    } catch { /* remote card unreachable: the panel omits the hint */ }
    json(res, 200, {
      ok: true,
      latest,
      publishedAt: typeof meta?.time?.[latest] === "string" ? meta.time[latest] : null,
      checkedAt: Date.now(),
      // The rate card rides the package, so "newer card" is implied by
      // "newer plugin"; reporting its revision lets the settings page say
      // WHICH numbers changed without another outbound call.
      ratecard: { version: RATECARD_VERSION, checkedAt: RATECARD.checkedAt },
      remoteCard,
    });
  } catch (error) {
    json(res, 200, { ok: false, error: String(error?.message ?? error), checkedAt: Date.now() });
  }
}

/** Short TTL + bounded LRU for `/pulse/session` event timelines: the raw
 *  event log of one session is immutable (a live session appends, so the
 *  cache naturally expires via TTL), and repeated detail-view reads hit
 *  memory instead of re-reading the persisted log. */
const SESSION_CACHE_MS = 60000;
const SESSION_CACHE_MAX = 20;
const sessionCache = new Map();

/** `GET /pulse/session?id=<sessionId>` — one session's event-level usage
 *  timeline (seconds-accurate) for the detail view's cumulative-consumption
 *  chart and break marks. Reads the raw event log through `sessionQuery`,
 *  never the aggregated projection, so breaks can slice at any instant. */
async function serveSession(ctx, url, req, res) {
  const id = url.searchParams.get("id") ?? "";
  if (id === "") {
    json(res, 400, { ok: false, error: "missing session id" });
    return;
  }
  if (typeof ctx.sessionQuery?.readSession !== "function") {
    json(res, 503, { ok: false, error: "session log access is unavailable in this environment" });
    return;
  }
  const hit = sessionCache.get(id);
  if (hit !== undefined && Date.now() - hit.at < SESSION_CACHE_MS) {
    json(res, 200, hit.value);
    return;
  }
  try {
    const loaded = await ctx.sessionQuery.readSession(id);
    const value = { ...timelineEvents(loaded.events, { id, header: loaded.session }), card: activeCard().card, cardOrigin: activeCard().origin };
    sessionCache.delete(id);
    sessionCache.set(id, { at: Date.now(), value });
    while (sessionCache.size > SESSION_CACHE_MAX) sessionCache.delete(sessionCache.keys().next().value);
    json(res, 200, value);
  } catch (error) {
    ctx.logger.warn(error);
    json(res, 404, { ok: false, error: `session unavailable: ${String(error?.message ?? error)}` });
  }
}

/** `GET /pulse/settings` — the editor's source of truth: the effective
 *  cost-enabled flag, USD→CNY rate and pricing rules (official defaults
 *  merged), the untouched official baseline (for per-row "restore official
 *  rates"), the current model catalog from the `llm` service (the editor's
 *  row source), whether the settings seam accepts writes, and — on hosts
 *  with revisioned settings (0.1.7+) — the entry revision the editor must
 *  echo back on POST for optimistic concurrency.
 *  `POST /pulse/settings` replaces the user section
 *  (`{costEnabled, usdToCny, pricing}`, or `{reset: true}` to re-inherit the
 *  composition base and official defaults); the reply carries `refold: true`
 *  when the section changes any model's peak hours (history re-folds). A
 *  stale `revision` is refused with 409 and a machine-readable `conflict`
 *  payload. */
function serveSettings(ctx, resolveConfig, getSettings, getLlm, invalidate, predictRefold, req, res) {
  if (req.method === "GET" || req.method === "HEAD") {
    return catalogOf(getLlm()).then((catalog) => {
      const config = resolveConfig();
      const seam = getSettings();
      const body = {
        currency: config.currency === "USD" ? "USD" : "CNY",
        displayCurrency: config.displayCurrency === "USD" ? "USD" : "CNY",
        costEnabled: config.costEnabled !== false,
        pricing: effectivePricing(config),
        monthly: Array.isArray(config.monthlyProviders) ? config.monthlyProviders : [],
        monthlyFee: sanitizeMonthlyFee(unwrapVolatile(config.monthlyFee) ?? {}),
        quotaOff: Array.isArray(config.quotaOff) ? config.quotaOff : [],
        footSource: typeof config.footSource === "string" ? config.footSource : "",
        quotaSpecs: sanitizeQuotaSpecs(unwrapVolatile(config.quotaSpecs) ?? {}),
        providerSpecs: PROVIDER_SPECS,
        modelColors: sanitizeModelColors(unwrapVolatile(config.modelColors) ?? {}),
        searchShape: sanitizeSearchShape(unwrapVolatile(config.searchShape) ?? {}),
        fx: { usdToCny: effectiveUsdToCny(config) },
        official: OFFICIAL_PRICE_SCHEDULES[0].rules,
        card: activeCard().card,
        cardOrigin: activeCard().origin,
        cardSource: effectiveCardSource(config),
        catalog,
        writable: seam !== null && typeof seam.writable === "function" && seam.writable() === true,
      };
      const revision = seam !== null && typeof seam.revision === "function" ? seam.revision() : undefined;
      if (typeof revision === "number") body.revision = revision;
      json.raw(res, req, 200, body);
    }).catch(() => {
      json.err(res, 500, "settings read failed");
    });
  }
  if (req.method !== "POST") {
    methodNotAllowed(res, "GET, HEAD, POST");
    return Promise.resolve();
  }
  // Same mutation posture as the card/probe writes: a settings write is
  // profile state, so a cross-site simple request must never reach the seam.
  if (refuseCrossSitePost(req, res)) return Promise.resolve();
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
      displayCurrency: z.union(["CNY", "USD"]),
      monthly: z.array(z.string()),
      monthlyFee: z.dict(z.number()),
      quotaOff: z.array(z.string()),
      footSource: z.string(),
      quotaSpecs: z.dict(z.any()),
      searchShape: z.dict(z.number()),
      reset: z.boolean(),
      revision: z.number(),
    });
    try {
      body(parsed);
    } catch (error) {
      json(res, 400, { ok: false, error: `invalid settings: ${String(error?.message ?? error)}` });
      return;
    }
    const seam = getSettings();
    if (seam === null || typeof seam.write !== "function") {
      json(res, 503, { ok: false, error: "settings storage is not available in this environment" });
      return;
    }
    // Predicted before persisting: the change feed (and the re-register it
    // may trigger) can fire before the write resolves, which would otherwise
    // compare the new map against itself.
    const refold = predictRefold(parsed) === true;
    // Deferred so even a seam that throws synchronously (a hostile or stubbed
    // implementation) settles through the same conflict/error mapping as the
    // real async service.
    Promise.resolve().then(() => seam.write(parsed))
      .then(() => {
        invalidate();
        invalidateCatalog();
        json(res, 200, { ok: true, refold });
      })
      .catch((error) => {
        if (error !== null && typeof error === "object" && error.code === "SETTINGS_CONFLICT") {
          // The stable machine code of both settings generations' conflict
          // error — the editor refreshes its copy and retries.
          json(res, 409, {
            ok: false,
            error: `settings were changed elsewhere (expected revision ${String(error.expected)}, current ${String(error.actual)})`,
            conflict: { expected: error.expected, actual: error.actual },
          });
          return;
        }
        ctx.logger.warn(error);
        json(res, 400, { ok: false, error: `could not persist settings: ${String(error?.message ?? error)}` });
      });
  }).catch((error) => {
    ctx.logger.warn(error);
    json(res, 400, { ok: false, error: String(error?.message ?? error) });
  });
}
