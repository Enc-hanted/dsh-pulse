/**
 * The data card's durable home: the stored override an import or pull
 * writes, opened once per fiber. UI-free and route-free. The fold-side
 * consequences of a card change (payload/cache invalidation, the display
 * rate re-derive, the refold decision) stay in src/index.js and arrive here
 * as the `afterChange` callback; the HTTP face is src/pricing/routes.js.
 */

import { z as zv } from "zod";
import { defineDomain } from "@deepseek-ai/dsh-storage-domain";
import { openRollingGlobalDomain } from "../rolling-domain.js";
import { applyCard, resetCard } from "../pricing-facts.js";
import { validateCard } from "./card-schema.js";

/**
 * Open the card store for one fiber: the stored-override domain, the apply
 * path a route calls, and the boot read that applies a stored card before
 * the first fold.
 *
 * @param {object} deps
 * @param {any} deps.ctx - plugin context: the storage seam's source and the
 *   fiber logger (the boot fallback line).
 * @param {() => any} deps.afterChange - the fold-side consequence of a card
 *   change; its return value is the refold flag the routes echo.
 * @returns {{openCardDomain: () => Promise<any>, refreshCard: (card: any, origin: string) => Promise<any>, cardReady: Promise<void>}}
 */
export function createCardStore({ ctx, afterChange }) {
  /** The stored data-card override (import/pull), opened once per fiber;
   *  an absent storage facility degrades to the bundled seed. */
  const openCardDomain = openRollingGlobalDomain(ctx, defineDomain({
    name: "pulse_card",
    version: 0,
    tables: {},
    global: {
      // zod v4 (this package) vs the storage-domain seam's zod v3 types: the
      // schema is plain data to the seam (it validates at the durable
      // boundary), so the cross-version assignment is asserted away.
      schema: /** @type {any} */ (zv.object({
        card: zv.unknown().nullable(),
        origin: zv.string(),
        savedAt: zv.number(),
      })),
      initial: { card: null, origin: "bundled", savedAt: 0 },
    },
  }), "dsh-pulse: card domain");
  /** Store + apply a validated card, drop served payloads and the session
   *  cache, and refold when the tier scope moved. Returns the refold flag. */
  const refreshCard = async (card, origin) => {
    applyCard(card, origin);
    const domain = await openCardDomain();
    if (domain !== null) await domain.global.set({ card, origin, savedAt: Date.now() });
    return afterChange();
  };
  /** Boot applies the stored card before the first fold; buildStats awaits
   *  this so a cold first request never prices against the seed by race. */
  const cardReady = (async () => {
    try {
      const domain = await openCardDomain();
      if (domain === null) return;
      const stored = domain.global.get();
      if (stored !== null && typeof stored === "object" && stored.card) {
        applyCard(validateCard(stored.card), stored.origin === "pulled" ? "pulled" : "imported");
        // Same symmetry as refreshCard and the reset route: applyCard republished
        // the card-derived DEFAULT_USD_TO_CNY, but this continuation always runs
        // AFTER the synchronous applyDisplay below — the IIFE suspends at the
        // storage read, so that first derive saw the bundled seed. A host whose
        // config.usdToCny is not a usable positive number would otherwise keep
        // the seed rate in the display realm (TUI strip, usage-query answers)
        // until the next settings event or HTTP card apply.
        afterChange();
      }
    } catch {
      // One fail-open unit, read included: a throwing storage seam used to
      // reject cardReady here and take every /pulse/stats request down with
      // it. An unreadable or invalid stored card falls back to the bundled
      // seed instead — and says so in the host log, because a silently
      // ignored override is exactly the version skew that must be visible.
      // resetCard is real work on a re-apply: module facts outlive the fiber,
      // so a prior fiber may have left a now-undiscoverable card live.
      resetCard();
      ctx.logger?.info?.("dsh-pulse: stored data card ignored (unreadable or invalid) — the bundled seed stays authoritative");
    }
  })();
  return { openCardDomain, refreshCard, cardReady };
}
