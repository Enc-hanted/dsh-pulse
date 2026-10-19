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
 * @param {{get?: (key: string) => any, effect?: (dispose: any, label?: string) => any}} ctx
 *   - plugin context carrying `storageDomain` (through `get`) + `effect`.
 * @param {object} spec - a `defineDomain` spec with a rolling `global`.
 * @param {string} label - the fiber-effect ledger label for the close hook.
 * @returns {() => Promise<{global: {get: () => any, set: (value: any) => Promise<unknown>}}|null>}
 *   resolves the open domain, or null when the facility is absent.
 */
export declare function openRollingGlobalDomain(ctx: {
    get?: (key: string) => any;
    effect?: (dispose: any, label?: string) => any;
}, spec: object, label: string): () => Promise<{
    global: {
        get: () => any;
        set: (value: any) => Promise<unknown>;
    };
} | null>;
