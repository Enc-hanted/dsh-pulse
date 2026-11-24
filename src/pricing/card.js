/**
 * Data-card UI-free helpers: the structural diff the settings preview
 * renders and the default pull source. No validator here — validation is
 * host-only (card-schema.js) so the browser bundle stays lean. The card's
 * facts home is pricing-facts.js (applyCard).
 */

/** Default pull source: the repo's card over jsDelivr (reachable where raw
 *  GitHub is not); the deployment config and the pull dialog may override. */
export const DEFAULT_CARD_SOURCE = "https://cdn.jsdelivr.net/gh/Enc-hanted/dsh-pulse@main/src/pricing/ratecard.json";

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
export const jsonEqual = (a, b) => {
  const stack = [[a, b]];
  while (stack.length > 0) {
    const [x, y] = stack.pop();
    if (x === y) continue;
    if (Array.isArray(x) !== Array.isArray(y)) return false;
    if (Array.isArray(x)) {
      if (x.length !== y.length) return false;
      for (let i = 0; i < x.length; i += 1) stack.push([x[i], y[i]]);
      continue;
    }
    if (x === null || y === null || typeof x !== "object" || typeof y !== "object") {
      if (x !== y) return false;
      continue;
    }
    const keys = Object.keys(x);
    if (keys.length !== Object.keys(y).length) return false;
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(y, key)) return false;
      stack.push([x[key], y[key]]);
    }
  }
  return true;
};

const ruleMapOf = (card) => {
  const m = new Map();
  for (const s of card.pricing.schedules) for (const r of s.rules) m.set(`${s.from}/${r.model}`, r);
  return m;
};

/** The card's provider specs keyed by id — FULL specs, since the preview's
 *  diff recurses into each one (see {@link diffSpec}). */
const providerMapOf = (card) => {
  const m = new Map();
  for (const spec of card.providers ?? []) m.set(spec.id, spec);
  return m;
};
/**
 * Deep structural diff of two provider specs, one readable row per changed
 * leaf path. The old summary compared only label/routes/auth/hosts/paths and
 * the window COUNT, so a windowMs edit or a plan-fee bump rendered a silent
 * zero-diff — and the preview is the manual-apply flow's trust anchor, so a
 * blind spot there equals no preview. Full-spec recursion covers everything
 * the schema can carry: per-window windowMs, pct/used/total alias chains,
 * counts, reset, plan (fee included), errorGate, auth, envKeys. Arrays
 * compare per index (alias order is semantics); elements added or removed
 * beyond the shared range surface as whole-item rows. A leaf row appears on
 * any canonical-shape change (`undefined` vs `null` included — `===` would
 * mute exactly the kind of shape drift this exists to surface).
 */
const diffSpec = (path, a, b, out) => {
  if (a === b) return;
  if (Array.isArray(a) && Array.isArray(b)) {
    const shared = Math.min(a.length, b.length);
    for (let i = 0; i < shared; i += 1) diffSpec(`${path}[${i}]`, a[i], b[i], out);
    for (let i = shared; i < b.length; i += 1) out.push({ label: `${path}[${i}]`, a: null, b: b[i] });
    for (let i = shared; i < a.length; i += 1) out.push({ label: `${path}[${i}]`, a: a[i], b: null });
    return;
  }
  if (a !== null && b !== null && typeof a === "object" && typeof b === "object") {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) diffSpec(`${path}.${key}`, a[key], b[key], out);
    return;
  }
  if (!jsonEqual(a, b)) out.push({ label: path, a: a ?? null, b: b ?? null });
};

/** Structural diff for the import/pull preview: one row per changed fact,
 *  `a`/`b` the old/new values (null = absent). Every comparison is
 *  key-order-insensitive structural equality — a reordered twin of the
 *  active card is zero-diff, not eight phantom rows. Provider specs diff
 *  deeply — one row per changed leaf path (`provider:{id}.windows[0].
 *  windowMs` …); a provider added/removed wholesale lands as ONE whole-spec
 *  row. The UI truncates at 40 rows with an overflow line. Pure; the UI
 *  renders it. */
export function cardDiff(a, b) {
  const out = [];
  const push = (label, x, y) => {
    if (!jsonEqual(x, y)) out.push({ label, a: x ?? null, b: y ?? null });
  };
  push("version", a.version, b.version);
  push("checkedAt", a.checkedAt, b.checkedAt);
  push("usdToCny", a.pricing.usdToCny, b.pricing.usdToCny);
  push("peakHours", a.pricing.peakHours, b.pricing.peakHours);
  push("auxPriceAs", a.pricing.auxPriceAs, b.pricing.auxPriceAs);
  push("auxShape", a.pricing.auxShape, b.pricing.auxShape);
  push("modelAliases", a.pricing.modelAliases, b.pricing.modelAliases);
  push("holidays", a.calendar.holidays, b.calendar.holidays);
  const ma = ruleMapOf(a);
  const mb = ruleMapOf(b);
  for (const [key, rule] of mb) push(key, ma.get(key), rule);
  for (const [key, rule] of ma) if (!mb.has(key)) push(key, rule, null);
  push("feeWindows", a.pricing.feeWindows, b.pricing.feeWindows);
  const pa = providerMapOf(a);
  const pb = providerMapOf(b);
  for (const [id, spec] of pb) {
    const old = pa.get(id);
    if (old === undefined) push(`provider:${id}`, undefined, spec);
    else diffSpec(`provider:${id}`, old, spec, out);
  }
  for (const [id, spec] of pa) if (!pb.has(id)) push(`provider:${id}`, spec, undefined);
  return out;
}
