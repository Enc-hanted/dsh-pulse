import { Config } from "./host/config-schema.js";
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
export declare const name = "pulse";
export type HostCtx = {
    /**
     * - live session store.
     */
    sessions?: any;
    /**
     * - projection registry (the fold driver).
     */
    sessionProjections?: any;
    /**
     * - persisted projection cache.
     */
    sessionProjectionCache?: any;
    /**
     * - query corpus (listing + log reads).
     */
    sessionQuery?: any;
    /**
     * - prefix-route registrar.
     */
    webServer?: any;
    /**
     * - fiber logger.
     */
    logger?: any;
    /**
     * - fiber-scoped effect ledger.
     */
    effect?: any;
    /**
     * - late service injector.
     */
    inject?: any;
    /**
     * - service getter.
     */
    get?: (name: string, optional?: boolean) => any;
};
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
export declare const inject: string[];
declare function buildStats(ctx: any, resolveConfig: any, input: any, snapshotsOf: any, now?: number): Promise<any>;
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
export declare function apply(ctx: HostCtx, config: object): void;
