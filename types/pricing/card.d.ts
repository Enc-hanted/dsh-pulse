/**
 * Data-card UI-free helpers: the structural diff the settings preview
 * renders and the default pull source. No validator here — validation is
 * host-only (card-schema.js) so the browser bundle stays lean. The card's
 * facts home is pricing-facts.js (applyCard).
 */
/** Default pull source: the repo's card over jsDelivr (reachable where raw
 *  GitHub is not); the deployment config and the pull dialog may override. */
export declare const DEFAULT_CARD_SOURCE = "https://cdn.jsdelivr.net/gh/Enc-hanted/dsh-pulse@main/src/pricing/ratecard.json";
/** Key-order-insensitive deep equality over JSON-shaped values — THE one
 *  structural-equality standard this package applies to cards: the preview
 *  rows and the host's apply `base` guard both compare through it, because
 *  their semantics must never drift apart (what the preview calls "no
 *  change" is exactly what the guard calls "safe to overwrite"). A card
 *  echoed back with reordered keys is the same card; a stringify-based
 *  compare would fake diffs whole-value at a time (auxShape, rule rows,
 *  feeWindows — the trust anchor lying by key order). Iterative on an
 *  explicit stack; arrays stay order-sensitive, because schedules and alias
 *  chains are ordered semantics. */
export declare const jsonEqual: (a: any, b: any) => boolean;
/** Structural diff for the import/pull preview: one row per changed fact,
 *  `a`/`b` the old/new values (null = absent). Every comparison is
 *  key-order-insensitive structural equality — a reordered twin of the
 *  active card is zero-diff, not eight phantom rows. Provider specs diff
 *  deeply — one row per changed leaf path (`provider:{id}.windows[0].
 *  windowMs` …); a provider added/removed wholesale lands as ONE whole-spec
 *  row. The UI truncates at 40 rows with an overflow line. Pure; the UI
 *  renders it. */
export declare function cardDiff(a: any, b: any): any[];
/**
 * The credential-routing subset of `cardDiff(a, b)`: the same row shape and
 * labels, so what the preview flags is exactly what the host's apply guard
 * demands an acknowledgement for. Kept rows: a provider added whole
 * (`a === null` — a new spec is a new destination) and every changed leaf
 * under the four routing fields, arrays per index (host order is match
 * order). A removed provider, a price, a window, a plan fee or a request
 * path never appears. Ids are matched against the ids actually present in
 * the two cards, longest first, so an id containing dots cannot be split
 * the wrong way by a label pattern. Pure.
 * @param {any} a - the active card.
 * @param {any} b - the candidate card.
 * @returns {{label: string, a: any, b: any}[]} */
export declare function credentialRoutingDiff(a: any, b: any): {
    label: string;
    a: any;
    b: any;
}[];
