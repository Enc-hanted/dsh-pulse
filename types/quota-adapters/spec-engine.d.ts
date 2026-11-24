/**
 * The declarative quota-spec engine — the data half of the provider SPI.
 * A spec (card `providers` section, or a user custom spec from settings)
 * describes the wire: routes, hosts, auth scheme, endpoint paths, and per
 * window where each number lives (alias chains, ratio/remaining/microCents
 * transforms). `parseSpec` is pure (fixtures replay it without network);
 * `specAdapter` wraps it into the QuotaAdapter contract (./types.js) so the
 * orchestrator never knows whether an adapter came from data or code — a
 * hand-written code adapter remains the escape hatch for wire shapes the
 * grammar cannot express.
 *
 * Grammar (per window source):
 * - mode "single": one object at `path` → one window (static id/windowMs).
 * - mode "map": object at `path`; `keys` maps wire key → {id, windowMs}.
 * - mode "array": rows at `path`; `filter` keeps rows whose fields equal;
 *   `idFrom` derives {id, windowMs} from a field-pair lookup with a
 *   "{field}" fallback template; `fold: "max"` merges all rows into one
 *   window (pct = max, counts/reset = first stated).
 * Windows dedupe first-wins by id across specs; `requirePct: false` keeps
 * a window whose pct the provider left unstated (z.ai's console does).
 *
 * The quota norm (types.js) holds: counts come only from true absolute
 * quotas (`counts`), a ratio-only source emits pct with used/total null.
 * Privacy law holds: the credential lives only in the one outbound
 * Authorization header specAdapter sends.
 */
/** Parse recorded endpoint bodies into the normalized QuotaResult (pure). */
export declare function parseSpec(spec: any, bodies: any): {
    plan: any;
    fee: any;
    windows: any[];
    extras: any[];
};
/**
 * Wrap a spec into the QuotaAdapter contract: claim its routes, pick the
 * host variant, fetch every endpoint under ONE auth header, pure-parse.
 *
 * `draft` picks the host-variant posture, and the two postures exist because
 * the callers carry different trust:
 * - Roster adapters (card providers, saved custom specs — the default) run
 *   STRICT: a route variant the spec does not declare (no exact
 *   `hosts[].route` hit, no route-less default) must refuse the fetch.
 *   Falling back to `hosts[0]` would silently aim a reviewed spec's first
 *   base at a route whose credential the orchestrator just resolved — on a
 *   multi-host spec that is a live credential sent to the wrong provider.
 * - `draft: true` is reserved for the settings page's explicit-body.spec
 *   probe of a half-written spec: drafts routinely omit the route key on
 *   their only host, so an unmatched route keeps the generic hosts[0]
 *   fallback. That exposure is bounded by the probe route's same-origin
 *   guard (src/index.js) — a web page cannot invoke it cross-site — and the
 *   credential still lives only in the one outbound Authorization header.
 *
 * @param {any} spec - validated provider spec; typed loose like parseSpec's,
 *   the zod boundary (pricing/card-schema.js) owns the real grammar shape.
 * @param {{draft?: boolean}} [options]
 */
export declare function specAdapter(spec: any, { draft }?: {
    draft?: boolean;
}): {
    id: any;
    label: any;
    short: any;
    routes: any;
    envKeys: any;
    match: (providerId: any, _describeRow: any) => any;
    hostFor: (route: any) => any;
    fetchQuota: ({ host, resolveCredential }: import("./types.js").QuotaFetchInput) => Promise<{
        plan: any;
        fee: any;
        windows: any[];
        extras: any[];
    }>;
};
