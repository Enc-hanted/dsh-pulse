/**
 * The `/pulse/pricing-card*` routes: the data card's read/apply, validate,
 * pull and reset. One handler answers the four pathnames and reports
 * whether it did, so the caller's dispatch chain goes on unchanged for
 * everything else. The store and the fold-side consequence of a card change
 * arrive as deps (src/pricing/store.js, src/index.js).
 */

import { SEED_CARD, activeCard, resetCard } from "../pricing-facts.js";
import { cardIssueLines, validateCard } from "./card-schema.js";
import { credentialRoutingDiff, jsonEqual } from "./card.js";
import { json, methodNotAllowed, refuseCrossSitePost, assertCardSourceUrl, readBody } from "../http-helpers.js";

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
export async function handlePricingCardRoute(pathname, req, res, deps) {
  const { store, cardSource, afterChange } = deps;
  if (pathname === "/pulse/pricing-card") {
    if (req.method === "GET" || req.method === "HEAD") {
      const a = activeCard();
      json(res, 200, { ok: true, card: a.card, origin: a.origin, seedVersion: SEED_CARD.version, source: cardSource() });
      return true;
    }
    if (req.method !== "POST") {
      methodNotAllowed(res, "GET, HEAD, POST");
      return true;
    }
    if (refuseCrossSitePost(req, res)) return true;
    let parsed;
    try { parsed = JSON.parse(await readBody(req)); } catch { json(res, 400, { ok: false, error: "invalid JSON body" }); return true; }
    let card;
    // A structural violation answers as readable per-field lines
    // ("pricing.usdToCny: …") — the raw ZodError.message is an issues
    // JSON string, hostile to a user hand-editing a card.
    try { card = validateCard(parsed?.card); } catch (error) { json(res, 400, { ok: false, error: cardIssueLines(error) ?? String(error?.message ?? error) }); return true; }
    // Concurrency guard: the client echoes the card its preview was
    // staged against (`base`). A mismatch means the active card moved
    // under the preview — refusing beats silently overwriting a card
    // the user never saw. The comparison is the SAME structural
    // equality the preview diff renders (card.js jsonEqual): what the
    // preview called "no change" must be exactly what this guard calls
    // "safe to overwrite". Absent `base` keeps the legacy
    // trusted-caller posture (curl, scripts); a base that never matches
    // fails closed.
    if (parsed?.base !== undefined && !jsonEqual(parsed.base, activeCard().card)) {
      json(res, 409, { ok: false, error: "card-changed" });
      return true;
    }
    // Credential-routing guard: the four provider fields that decide which
    // credential is read and where it is sent (card.js
    // credentialRoutingDiff — the SAME rows the preview lists apart) gate
    // the apply behind an explicit `ackCredentials`. The preview's diff put
    // a host change and a price change on the same line, so a card from an
    // untrusted source could retarget a stored provider key with nothing
    // but a grey row for warning. The baseline is the active card, which
    // the base guard above already tied to what the preview showed; a
    // caller that sends no base (curl, scripts) is held to it all the same.
    const routing = credentialRoutingDiff(activeCard().card, card);
    if (routing.length > 0 && parsed?.ackCredentials !== true) {
      json(res, 422, { ok: false, error: "credential-routing-changed", changes: routing });
      return true;
    }
    const refold = await store.refreshCard(card, parsed?.origin === "pulled" ? "pulled" : "imported");
    json(res, 200, { ok: true, refold });
    return true;
  }
  if (pathname === "/pulse/pricing-card/validate") {
    if (req.method !== "POST") {
      methodNotAllowed(res, "POST");
      return true;
    }
    if (refuseCrossSitePost(req, res)) return true;
    let parsed;
    try { parsed = JSON.parse(await readBody(req)); } catch { json(res, 400, { ok: false, error: "invalid JSON body" }); return true; }
    try { json(res, 200, { ok: true, card: validateCard(parsed?.card) }); } catch (error) { json(res, 400, { ok: false, error: cardIssueLines(error) ?? String(error?.message ?? error) }); }
    return true;
  }
  if (pathname === "/pulse/pricing-card/pull") {
    if (req.method !== "POST") {
      methodNotAllowed(res, "POST");
      return true;
    }
    if (refuseCrossSitePost(req, res)) return true;
    let body = {};
    try { body = JSON.parse((await readBody(req)) || "{}"); } catch { json(res, 400, { ok: false, error: "invalid JSON body" }); return true; }
    const rawSource = typeof body?.url === "string" && body.url !== "" ? body.url : cardSource();
    // The fetch target is scheme-gated through the shared
    // assertCardSourceUrl (update-check probes the same gate): node's
    // fetch accepts more than http(s) (data: at minimum), and a pull
    // URL is user-reachable config — it must never become a
    // file:/data: side channel. http stays loopback-only (a local
    // mirror is a legitimate dev setup); every remote source is
    // pinned to https.
    try { assertCardSourceUrl(rawSource); } catch (error) {
      json(res, 400, { ok: false, error: String(error?.message ?? error) });
      return true;
    }
    try {
      const response = await fetch(rawSource, { headers: { accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error(`card source HTTP ${response.status}`);
      const card = validateCard(await response.json());
      json(res, 200, { ok: true, card, source: rawSource });
    } catch (error) {
      json(res, 200, { ok: false, error: cardIssueLines(error) ?? String(error?.message ?? error) });
    }
    return true;
  }
  if (pathname === "/pulse/pricing-card/reset") {
    if (req.method !== "POST") {
      methodNotAllowed(res, "POST");
      return true;
    }
    if (refuseCrossSitePost(req, res)) return true;
    resetCard();
    const domain = await store.openCardDomain();
    if (domain !== null) await domain.global.set({ card: null, origin: "bundled", savedAt: Date.now() });
    // Same symmetry as refreshCard: the seed restores the card-derived
    // DEFAULT_USD_TO_CNY, so the display rate must re-derive too (a
    // pulled card's rate would otherwise linger after the reset).
    const refold = afterChange();
    json(res, 200, { ok: true, refold });
    return true;
  }
  return false;
}
