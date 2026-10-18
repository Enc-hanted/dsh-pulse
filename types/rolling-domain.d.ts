/**
 * Memoized opener for a rolling storage-domain global — the one lifecycle
 * both remote services share (`pulse_balance`, `pulse_quota`): open once
 * per fiber, register the close as a fiber effect, and degrade to `null`
 * when the storageDomain facility is absent (old hosts) so the callers'
 * "no snapshots" paths stay the degradation, not an error.
 */
/**
 * Build the opener for one domain spec.
 *
 * @param {object} ctx - plugin context carrying `storageDomain` + `effect`.
 * @param {object} spec - a `defineDomain` spec with a rolling `global`.
 * @param {string} label - the fiber-effect ledger label for the close hook.
 * @returns {() => Promise<object|null>} resolves the open domain, or null.
 */
export declare function openRollingGlobalDomain(ctx: object, spec: object, label: string): () => Promise<object | null>;
