/**
 * The quota-adapter SPI — the contract src/quota-service.js orchestrates
 * and every src/quota-adapters/<provider>.js module implements.
 *
 * An adapter is a plain object shaped like this:
 *
 *   {
 *     id: "zai-coding",
 *     label: "GLM Coding Plan",
 *     envKeys: ["ZAI_CODING_CN_API_KEY", "..."],
 *     match(providerId, describeRow) { return false; },
 *     hostFor(route) { return "https://api.example.com"; },
 *     fetchQuota({ route, host, resolveCredential, signal }) { ... },
 *   }
 *
 * Semantics, matching the routing layer this SPI was extracted from:
 *
 * - `match(providerId, describeRow)` MUST return false for a provider id it
 *   does not claim — never undefined, never a throw. The orchestrator picks
 *   the FIRST adapter in registration order whose match() returns true, so
 *   claim sets must stay disjoint. `describeRow` is the settings forms' row
 *   for the route (null on classic hosts); the built-ins claim by provider
 *   id alone and ignore it — an adapter that claims by connection shape
 *   instead may read it.
 * - `fetchQuota(input)` MUST throw on network or parse failures — the
 *   orchestrator maps the throw to a per-provider error entry (cause codes
 *   only, no URLs, no key material) — and MUST NOT fabricate numbers on
 *   schema drift: an unparsable reply stays unparsable. It MUST NOT touch
 *   the store; persistence (the pulse_quota snapshots) is the
 *   orchestrator's.
 * - The parse half of every built-in adapter is a pure exported function
 *   (`parse<Provider>Quota`) so the conformance suite
 *   (test/quota-adapters-test.mjs + test/fixtures/quota/) can replay
 *   recorded wire shapes against pinned normalized outputs without any
 *   network.
 *
 * Privacy law (invariant, same as the balance): the credential lives only
 * in the single outbound Authorization header fetchQuota() sends — never
 * in a return value, an error message, a log line, or the store. The
 * orchestrator resolves it per operation through the credential seam and
 * hands it over scoped to the one fetch; adapters keep no copy.
 *
 * The general quota norm (the rendering law every adapter follows): counts
 * come ONLY from true absolute quotas — a ratio-only source emits `usedPct`
 * with `used: null, total: null`, and the renderer never invents a count
 * from a ratio.
 *
 * @typedef {object} QuotaCredential
 * @property {string} value - the credential material (api key / token).
 * @property {string} source - where it resolved (env ref name, "record",
 *   "oauth").
 */
export type QuotaCredential = {
    /**
     * - the credential material (api key / token).
     */
    value: string;
    /**
     * - where it resolved (env ref name, "record",
     * "oauth").
     */
    source: string;
};
export type QuotaWindow = {
    /**
     * - window identity ("5h", "7d", "month", ...).
     */
    id: string;
    /**
     * - "tokens" or "requests" (the unit family).
     */
    kind: string;
    /**
     * - absolute used count; null unless the
     * provider states a true absolute quota.
     */
    used: number | null;
    /**
     * - absolute quota size; same rule as `used`.
     */
    total: number | null;
    /**
     * - utilization percentage, clamped to
     * [0, 100]; null only when the provider stated nothing usable.
     */
    usedPct: number | null;
    /**
     * - window reset, normalized to epoch ms
     * (providers send epoch ms, epoch s, or ISO strings with over-long
     * fractional seconds).
     */
    resetsAt: number | null;
    /**
     * - the window's span, for burn-rate
     * math; null when unknown.
     */
    windowMs: number | null;
};
export type QuotaWindowExtra = {
    /**
     * - extra identity ("tools").
     */
    id: string;
    /**
     * - display label, when the provider sends one.
     */
    label: string | null;
    used: number | null;
    total: number | null;
    usedPct: number | null;
    resetsAt: number | null;
};
export type QuotaPlan = {
    /**
     * - plan display name.
     */
    name: string;
    /**
     * - provider-stated tier, when stated.
     */
    level: string | null;
    /**
     * - billing cycle, when stated.
     */
    cycle: string | null;
    /**
     * - raw provider renewal string, when stated.
     */
    renewsAt: string | null;
};
export type QuotaFee = {
    amount: number;
    currency: string;
    cycle: string;
};
export type QuotaResult = {
    plan: QuotaPlan | null;
    fee: QuotaFee | null;
    /**
     * - utilization windows, sorted shortest
     * (most immediate) span first; unknown spans last.
     */
    windows: QuotaWindow[];
    /**
     * - non-plan quotas (tool calls);
     * excluded from the persisted burn series.
     */
    extras: QuotaWindowExtra[];
};
export type QuotaFetchInput = {
    /**
     * - the claimed provider id (the Models page's
     * route key).
     */
    route: string;
    /**
     * - the endpoint base, adapter.hostFor(route).
     */
    host: string;
    /**
     * - the
     * route-scoped credential thunk ({value, source}, or null when nothing
     * resolves). Built-ins receive it pre-resolved (never null) — the
     * orchestrator has already answered the unconfigured case before calling.
     */
    resolveCredential: () => Promise<QuotaCredential | null>;
    /**
     * - optional orchestrator-owned abort
     * hook. Every built-in outbound request is bounded by its own timeout
     * (QUOTA_TIMEOUT_MS in ./shared.js) regardless.
     */
    signal?: AbortSignal;
};
export type QuotaAdapter = {
    /**
     * - adapter identity, echoed in /pulse/quota entries.
     */
    id: string;
    /**
     * - display face, superseded by the plan name
     * once a query succeeded.
     */
    label: string;
    /**
     * - well-known ambient credential names tried
     * after the deployment's own refs.
     */
    envKeys: string[];
    match: (providerId: string, describeRow?: object | null) => boolean;
    hostFor: (route: string) => string;
    fetchQuota: (input: QuotaFetchInput) => Promise<QuotaResult>;
};
/**
 * One utilization window. The guaranteed minimum a consumer may rely on is
 * `{id, usedPct, resetsAt}` — the SPI sketch's `{id, pct, resetMs}`; the
 * concrete built-in shape adds the fields the observatory renders.
 *
 * @typedef {object} QuotaWindow
 * @property {string} id - window identity ("5h", "7d", "month", ...).
 * @property {string} kind - "tokens" or "requests" (the unit family).
 * @property {number|null} used - absolute used count; null unless the
 *   provider states a true absolute quota.
 * @property {number|null} total - absolute quota size; same rule as `used`.
 * @property {number|null} usedPct - utilization percentage, clamped to
 *   [0, 100]; null only when the provider stated nothing usable.
 * @property {number|null} resetsAt - window reset, normalized to epoch ms
 *   (providers send epoch ms, epoch s, or ISO strings with over-long
 *   fractional seconds).
 * @property {number|null} windowMs - the window's span, for burn-rate
 *   math; null when unknown.
 */
/**
 * @typedef {object} QuotaWindowExtra
 * @property {string} id - extra identity ("tools").
 * @property {string|null} label - display label, when the provider sends one.
 * @property {number|null} used
 * @property {number|null} total
 * @property {number|null} usedPct
 * @property {number|null} resetsAt
 */
/**
 * @typedef {object} QuotaPlan
 * @property {string} name - plan display name.
 * @property {string|null} level - provider-stated tier, when stated.
 * @property {string|null} cycle - billing cycle, when stated.
 * @property {string|null} renewsAt - raw provider renewal string, when stated.
 */
/**
 * @typedef {object} QuotaFee
 * @property {number} amount
 * @property {string} currency
 * @property {string} cycle
 */
/**
 * The normalized result every adapter returns from fetchQuota().
 *
 * @typedef {object} QuotaResult
 * @property {QuotaPlan|null} plan
 * @property {QuotaFee|null} fee
 * @property {QuotaWindow[]} windows - utilization windows, sorted shortest
 *   (most immediate) span first; unknown spans last.
 * @property {QuotaWindowExtra[]} extras - non-plan quotas (tool calls);
 *   excluded from the persisted burn series.
 */
/**
 * What the orchestrator hands fetchQuota().
 *
 * @typedef {object} QuotaFetchInput
 * @property {string} route - the claimed provider id (the Models page's
 *   route key).
 * @property {string} host - the endpoint base, adapter.hostFor(route).
 * @property {() => Promise<QuotaCredential|null>} resolveCredential - the
 *   route-scoped credential thunk ({value, source}, or null when nothing
 *   resolves). Built-ins receive it pre-resolved (never null) — the
 *   orchestrator has already answered the unconfigured case before calling.
 * @property {AbortSignal} [signal] - optional orchestrator-owned abort
 *   hook. Every built-in outbound request is bounded by its own timeout
 *   (QUOTA_TIMEOUT_MS in ./shared.js) regardless.
 */
/**
 * @typedef {object} QuotaAdapter
 * @property {string} id - adapter identity, echoed in /pulse/quota entries.
 * @property {string} label - display face, superseded by the plan name
 *   once a query succeeded.
 * @property {string[]} envKeys - well-known ambient credential names tried
 *   after the deployment's own refs.
 * @property {(providerId: string, describeRow?: object|null) => boolean} match
 * @property {(route: string) => string} hostFor
 * @property {(input: QuotaFetchInput) => Promise<QuotaResult>} fetchQuota
 */
/**
 * The SPI version these typedefs describe. Bump when the contract changes
 * shape in a way an external adapter must follow.
 */
export declare const QUOTA_ADAPTER_SPI_VERSION = 1;
