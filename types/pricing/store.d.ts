/**
 * The data card's durable home: the stored override an import or pull
 * writes, opened once per fiber. UI-free and route-free. The fold-side
 * consequences of a card change (payload/cache invalidation, the display
 * rate re-derive, the refold decision) stay in src/index.js and arrive here
 * as the `afterChange` callback; the HTTP face is src/pricing/routes.js.
 */
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
export declare function createCardStore({ ctx, afterChange }: {
    ctx: any;
    afterChange: () => any;
}): {
    openCardDomain: () => Promise<any>;
    refreshCard: (card: any, origin: string) => Promise<any>;
    cardReady: Promise<void>;
};
