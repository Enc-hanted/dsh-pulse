/**
 * The `/pulse/pricing-card*` routes: the data card's read/apply, validate,
 * pull and reset. One handler answers the four pathnames and reports
 * whether it did, so the caller's dispatch chain goes on unchanged for
 * everything else. The store and the fold-side consequence of a card change
 * arrive as deps (src/pricing/store.js, src/index.js).
 */
/**
 * Serve one of the four `/pulse/pricing-card*` pathnames.
 *
 * @param {string} pathname - decoded request pathname.
 * @param {any} req - node request.
 * @param {any} res - node response.
 * @param {object} deps
 * @param {{openCardDomain: () => Promise<any>, refreshCard: (card: any, origin: string) => Promise<any>}} deps.store
 *   - the fiber's card store.
 * @param {() => string} deps.cardSource - thunk for the effective pull
 *   source; read per request, never captured at wiring time.
 * @param {() => any} deps.afterChange - the fold-side consequence of a card
 *   change (the reset route); its return value is the refold flag.
 * @returns {Promise<boolean>} true when the pathname was one of the four and
 *   a reply was written.
 */
export declare function handlePricingCardRoute(pathname: string, req: any, res: any, deps: {
    store: {
        openCardDomain: () => Promise<any>;
        refreshCard: (card: any, origin: string) => Promise<any>;
    };
    cardSource: () => string;
    afterChange: () => any;
}): Promise<boolean>;
