/**
 * Official pricing FACTS — read from the versioned data card
 * (`src/pricing/ratecard.json`), the single source for the constants that
 * describe DeepSeek's official billing shape. Data only, no behavior: node
 * tests, the TUI, the host plugin and the browser bundle all read from
 * here, so the numbers can never drift apart. Bumping `version` in the
 * card is the visible act of re-auditing the numbers; `checkedAt` says when
 * they were last verified against `source`. The JSON import keeps the card
 * inside the esbuild bundle (no fs read), so every face shares one seed.
 *
 * Schema 3 groups facts into sections (`pricing`, `calendar`, `providers`)
 * so later sections (plan catalogs) can join without reshaping these
 * readers. `providers` carries the declarative subscription-query specs
 * (routes, hosts, auth, endpoint paths, field alias chains) the quota
 * spec engine parses — endpoint drift is a card edit, not a release. The per-call search fee is a WINDOW, not an
 * era: free until 2026-11-01, ¥0.005 per successful call through
 * 2026-11-18 12:00 Beijing time, free again after — server-side search
 * bills tokens only from that instant (api-docs.deepseek.com: 模型 & 价格 /
 * 网页搜索与抓取). The standalone Search/Fetch APIs keep ¥5 per 1,000
 * successful requests, but the harness log only carries server-side aux
 * round trips, so the card models that path.
 *
 * RUNTIME OVERRIDE: the exported facts are live bindings. `applyCard`
 * (host: stored/imported/pulled card; client: the card echoed in each
 * payload) re-derives and republishes them in one act, so a price change
 * is a data update, not a release. Each JS realm (host process, browser
 * bundle) applies its own copy; tests never call applyCard and therefore
 * always price against the bundled seed. `resetCard` returns to the seed.
 */
import ratecard from "./pricing/ratecard.json" with { type: "json" };

/** The bundled seed, frozen — the offline fallback and the test baseline. */
export const SEED_CARD = Object.freeze(structuredClone(ratecard));

/** Fixed UTC+8 offset for peak-tier classification (Asia/Shanghai has no DST). */
export const BEIJING_OFFSET_MS = 8 * 3600000;

function derive(card) {
  const p = card.pricing;
  const w = p.feeWindows.find((x) => x.appliesTo === "server-side-search");
  return {
    peakHours: Object.freeze([...p.peakHours]),
    usdToCny: p.usdToCny,
    auxPriceAs: p.auxPriceAs,
    auxShape: Object.freeze({ ...p.auxShape }),
    aliases: Object.freeze({ ...p.modelAliases }),
    holidays: Object.freeze([...card.calendar.holidays]),
    schedules: Object.freeze(p.schedules.map((s) => Object.freeze({
      from: s.from,
      rules: Object.freeze(s.rules.map((r) => Object.freeze({ ...r, peakHours: Object.freeze([...p.peakHours]) }))),
    }))),
    fee: Object.freeze({
      from: w.from,
      fromMs: Date.parse(`${w.from}T00:00:00+08:00`),
      until: w.until,
      untilMs: Date.parse(w.until),
      /** Day-level surfaces gate [from, untilDay): the boundary day is
       *  conservatively free (same philosophy as the no-day default);
       *  event-level surfaces gate [fromMs, untilMs) to the minute. */
      untilDay: w.until.slice(0, 10),
      cnyPerCall: w.cnyPerCall,
    }),
    providers: Object.freeze((card.providers ?? []).map((s) => Object.freeze(structuredClone(s)))),
  };
}

export let RATECARD = SEED_CARD;
export let RATECARD_VERSION = ratecard.version;
export let PEAK_HOURS = Object.freeze([...ratecard.pricing.peakHours]);
export let DEFAULT_USD_TO_CNY = ratecard.pricing.usdToCny;
export let AUX_PRICE_AS = ratecard.pricing.auxPriceAs;
export let AUX_SHAPE = Object.freeze({ ...ratecard.pricing.auxShape });
export let MODEL_ALIASES = Object.freeze({ ...ratecard.pricing.modelAliases });
export let HOLIDAYS = Object.freeze([...ratecard.calendar.holidays]);
export let OFFICIAL_PRICE_SCHEDULES = derive(ratecard).schedules;
export let AUX_CALL_FEE = derive(ratecard).fee;
export let PROVIDER_SPECS = derive(ratecard).providers;
let activeOrigin = "bundled";

function publish(card, origin) {
  const f = derive(card);
  RATECARD = Object.freeze(structuredClone(card));
  RATECARD_VERSION = card.version;
  PEAK_HOURS = f.peakHours;
  DEFAULT_USD_TO_CNY = f.usdToCny;
  AUX_PRICE_AS = f.auxPriceAs;
  AUX_SHAPE = f.auxShape;
  MODEL_ALIASES = f.aliases;
  HOLIDAYS = f.holidays;
  OFFICIAL_PRICE_SCHEDULES = f.schedules;
  AUX_CALL_FEE = f.fee;
  PROVIDER_SPECS = f.providers;
  activeOrigin = origin;
}

/** Republish every fact from a card. Validation lives at the HOST boundary
 *  (import/pull/validate endpoints and the boot read of storage); the client
 *  applies the host-validated card echoed in each payload, so the browser
 *  bundle never carries the validator. */
export function applyCard(card, origin = "imported") {
  publish(card, origin);
}

/** Return to the bundled seed (the settings page's restore action). */
export function resetCard() {
  publish(SEED_CARD, "bundled");
}

/** The active card plus its provenance, for payloads and the card panel. */
export function activeCard() {
  return { card: RATECARD, origin: activeOrigin };
}
