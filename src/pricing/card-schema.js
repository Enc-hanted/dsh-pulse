/**
 * Data-card SCHEMA and validation — the untrusted-input boundary, host-only
 * (the browser bundle never carries the validator; imports preview through
 * POST /pulse/pricing-card/validate). Pure data-in/data-out, no I/O. The
 * card's facts home is pricing-facts.js; the UI-free diff and the default
 * pull source live in card.js.
 */
import { z } from "zod";
import { isLoopbackHost } from "../http-helpers.js";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ratesSchema = z.object({
  input: z.number().nonnegative(),
  cacheRead: z.number().nonnegative(),
  output: z.number().nonnegative(),
}).strict();
const ruleSchema = z.object({
  model: z.string().min(1),
  input: z.number().nonnegative(),
  cacheRead: z.number().nonnegative(),
  output: z.number().nonnegative(),
  peak: ratesSchema.optional(),
  weekdaysOnly: z.boolean().optional(),
  currency: z.enum(["CNY", "USD"]).optional(),
}).strict();
const scheduleSchema = z.object({
  from: z.string().regex(DAY),
  rules: z.array(ruleSchema).min(1),
}).strict();
const feeWindowSchema = z.object({
  appliesTo: z.string().min(1),
  from: z.string().regex(DAY),
  until: z.string().min(1),
  cnyPerCall: z.number().nonnegative(),
}).strict();

// --- provider query specs (schema 3) -----------------------------------------
// The declarative wire grammar the quota spec engine parses. Nested grammar
// objects stay loose (forward-compatible fields); the load-bearing facts —
// routes, hosts, auth, paths, kinds, transforms — are enforced.
const aliasList = z.array(z.string().min(1)).min(1);
const wireValue = z.union([z.string(), z.number()]);
const windowTarget = z.object({ id: z.string().min(1), windowMs: z.number().int().positive().nullable().optional() });
const pctSchema = z.object({
  aliases: aliasList.optional(),
  transform: z.enum(["direct", "ratio"]).optional(),
  ratio: z.object({ used: aliasList, total: aliasList }).optional(),
  remaining: z.object({ remaining: aliasList, total: aliasList }).optional(),
  fallback: z.lazy(() => pctSchema).optional(),
});
const countsSchema = z.object({
  used: aliasList.optional(),
  total: aliasList.optional(),
  remaining: aliasList.optional(),
  deriveUsed: z.boolean().optional(),
  transform: z.enum(["microCentsUsd"]).optional(),
});
const resetSchema = z.object({ aliases: aliasList.optional(), inSec: aliasList.optional() });
const sourceSchema = z.object({
  request: z.string().min(1),
  path: z.string(),
  mode: z.enum(["single", "map", "array"]),
  keys: z.record(z.string(), windowTarget).optional(),
  filter: z.record(z.string(), wireValue).optional(),
  fold: z.enum(["max"]).optional(),
});
const windowSpecSchema = z.object({
  id: z.string().min(1).optional(),
  kind: z.enum(["tokens", "requests", "usd"]),
  windowMs: z.number().int().positive().nullable().optional(),
  requirePct: z.boolean().optional(),
  source: sourceSchema,
  idFrom: z.object({ fields: aliasList, map: z.record(z.string(), windowTarget), fallback: z.string().min(1) }).optional(),
  pct: pctSchema.optional(),
  counts: countsSchema.optional(),
  reset: resetSchema.optional(),
});
const extraSpecSchema = z.object({
  id: z.string().min(1),
  labelField: z.string().min(1).optional(),
  source: sourceSchema,
  pct: pctSchema.optional(),
  used: z.object({ aliases: aliasList }).optional(),
  total: z.object({ aliases: aliasList }).optional(),
  reset: resetSchema.optional(),
});
const planSpecSchema = z.object({
  name: z.string().min(1).optional(),
  level: z.object({ request: z.string().min(1), path: z.string().min(1) }).optional(),
  find: z.object({
    request: z.string().min(1), path: z.string().min(1),
    where: z.record(z.string(), wireValue), requireString: z.string().min(1),
  }).optional(),
  fields: z.object({ name: z.string().min(1), cycle: z.string().min(1).optional(), renewsAt: z.string().min(1).optional() }).optional(),
  // The two fee shapes are told apart by amount's TYPE (number vs alias
  // array) — a true discriminated union would need a wire `kind` literal and
  // would break every saved spec. The cost of that ambiguity: `plan.find`
  // can legally pair with the static number shape, and parseSpec (spec
  // engine) must therefore gate on Array.isArray before iterating amount.
  fee: z.union([
    z.object({ amount: z.number(), currency: z.enum(["CNY", "USD"]), cycle: z.string().min(1) }),
    z.object({ amount: aliasList, currency: z.enum(["CNY", "USD"]), cycleField: z.string().min(1) }),
  ]).optional(),
});
const providerSpecSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  routes: z.array(z.string().min(1)).min(1),
  envKeys: z.array(z.string().min(1)).optional(),
  hosts: z.array(z.object({ route: z.string().min(1).optional(), base: z.string().min(1) })).min(1),
  auth: z.enum(["bearer", "raw"]),
  requests: z.array(z.object({
    id: z.string().min(1),
    path: z.string().regex(/^\//),
    optional: z.boolean().optional(),
    query: z.record(z.string(), wireValue).optional(),
  })).min(1),
  errorGate: z.object({ request: z.string().min(1), path: z.string().min(1), field: z.string().min(1) }).optional(),
  windows: z.array(windowSpecSchema).optional(),
  extras: z.array(extraSpecSchema).optional(),
  plan: planSpecSchema.optional(),
});

/** Semantic gates shared by card providers and user custom specs: hosts
 *  must be http(s) URLs — and http is loopback-only, because the spec's
 *  `auth: bearer` puts a live credential in every request's Authorization
 *  header and cleartext http would hand it to anyone on the wire (the
 *  pull route's card-source gate makes the same call). Request ids unique,
 *  and every `request` reference must name a declared endpoint. Throws on
 *  violation. */
function providerSemantics(spec) {
  for (const host of spec.hosts) {
    let url = null;
    try { url = new URL(host.base); } catch { /* fall through to throw */ }
    if (url === null || (url.protocol !== "https:" && url.protocol !== "http:")) {
      throw new Error(`provider ${spec.id}: host base must be an http(s) URL`);
    }
    if (url.protocol === "http:" && !isLoopbackHost(url.hostname)) {
      throw new Error(`provider ${spec.id}: remote http host would send bearer credentials in cleartext — use https (http is accepted only on loopback)`);
    }
  }
  const ids = spec.requests.map((r) => r.id);
  if (new Set(ids).size !== ids.length) throw new Error(`provider ${spec.id}: request ids must be unique`);
  const refs = [
    ...(spec.windows ?? []).map((w) => w.source.request),
    ...(spec.extras ?? []).map((e) => e.source.request),
    spec.errorGate?.request, spec.plan?.level?.request, spec.plan?.find?.request,
  ];
  for (const ref of refs) {
    if (ref !== undefined && !ids.includes(ref)) throw new Error(`provider ${spec.id}: unknown request ref ${ref}`);
  }
}

/** Validate one untrusted provider spec (custom-spec settings boundary). */
export function validateProviderSpec(value) {
  const spec = providerSpecSchema.parse(value);
  providerSemantics(spec);
  return spec;
}

const cardSchema = z.object({
  schemaVersion: z.literal(3),
  version: z.number().int().positive(),
  checkedAt: z.string().regex(DAY),
  source: z.string().min(1),
  pricing: z.object({
    usdToCny: z.number().positive(),
    peakHours: z.array(z.number().int().min(0).max(23)),
    auxPriceAs: z.string().min(1),
    auxShape: z.object({
      miss: z.number().nonnegative(),
      hit: z.number().nonnegative(),
      out: z.number().nonnegative(),
    }).strict(),
    modelAliases: z.record(z.string(), z.string().min(1)),
    schedules: z.array(scheduleSchema).min(1),
    feeWindows: z.array(feeWindowSchema),
  }).strict(),
  calendar: z.object({
    holidays: z.array(z.string().regex(DAY)),
  }).strict(),
  providers: z.array(providerSpecSchema).optional(),
}).strict();

/** An instant with an explicit UTC offset (or `Z`). Fee windows are authored
 *  in Beijing time, but Date.parse reads an OFFSET-LESS stamp in the host's
 *  local timezone — the same card would bill differently on a UTC runner and
 *  a UTC+8 desktop. The offset must therefore be stated, never ambient. */
const OFFSETTED_INSTANT = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;

/** Validate an untrusted card; throws on any schema or semantic violation.
 *  Returns the parsed card so callers never reuse the raw input. */
export function validateCard(value) {
  const card = cardSchema.parse(value);
  // Exactly ONE server-side-search window: pricing-facts' derive() reads the
  // first match with `.find`, so a second (overlapping era) window would be
  // silently ignored — an ambiguity a trust anchor cannot carry. Other
  // appliesTo values stay free-form for future fee kinds.
  const searchWindows = card.pricing.feeWindows.filter((w) => w.appliesTo === "server-side-search");
  if (searchWindows.length === 0) {
    throw new Error("feeWindows must carry a server-side-search window");
  }
  if (searchWindows.length > 1) {
    throw new Error(`feeWindows must carry exactly one server-side-search window (found ${searchWindows.length})`);
  }
  for (const w of card.pricing.feeWindows) {
    if (!OFFSETTED_INSTANT.test(w.until)) throw new Error(`fee window until must carry an explicit UTC offset: ${w.until}`);
    if (!Number.isFinite(Date.parse(w.until))) throw new Error(`unparsable fee window until: ${w.until}`);
    if (Date.parse(w.until) <= Date.parse(`${w.from}T00:00:00+08:00`)) throw new Error("fee window until must follow from");
  }
  const froms = card.pricing.schedules.map((s) => s.from);
  if (froms.join() !== [...froms].sort().reverse().join()) throw new Error("schedules must be most-recent-first");
  const specs = card.providers ?? [];
  const specIds = specs.map((s) => s.id);
  if (new Set(specIds).size !== specIds.length) throw new Error("provider ids must be unique");
  const claimed = [];
  for (const spec of specs) {
    providerSemantics(spec);
    for (const route of spec.routes) {
      if (claimed.includes(route)) throw new Error(`provider route claimed twice: ${route}`);
      claimed.push(route);
    }
  }
  return card;
}

/** One readable line per structural (zod) issue — `pricing.peakHours: …` —
 *  for the card routes' error faces. A raw ZodError.message is the issues
 *  array serialized as JSON, which reads as host vomit to a user hand-editing
 *  a card; the semantic gates above already throw plain sentences, so only
 *  the schema parse needs this bridge. Null on anything else — callers fall
 *  back to the error's own message. */
export function cardIssueLines(error) {
  const issues = error?.issues;
  if (!Array.isArray(issues) || issues.length === 0) return null;
  return issues
    .map((issue) => `${Array.isArray(issue.path) && issue.path.length > 0 ? issue.path.join(".") : "(root)"}: ${issue.message}`)
    .join("; ");
}
