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
export function openRollingGlobalDomain(ctx, spec, label) {
  let domain = null;
  let opening = null;
  return function open() {
    if (domain !== null) return Promise.resolve(domain);
    if (opening !== null) return opening;
    const facility = typeof ctx.get === "function" ? ctx.get("storageDomain") : null;
    if (facility === null || typeof facility?.open !== "function") return Promise.resolve(null);
    opening = facility.open(spec).then((opened) => {
      domain = opened;
      ctx.effect(() => async () => {
        domain = null;
        try { await opened.close(); } catch { /* closing twice is harmless */ }
      }, label);
      return opened;
    }).catch(() => null).finally(() => { opening = null; });
    return opening;
  };
}
