/**
 * Host half — config schema: the plugin's schemastery-shaped `Config`, its
 * volatile-key ledger, the live-reference readers and the wire filters every
 * settings face shares. Parameterized out of index.js so the schema can be
 * reasoned about (and locked) on its own.
 */

import z from "@deepseek-ai/schemastery";
import { AUX_SHAPE } from "../view.js";
import { DEFAULT_USD_TO_CNY } from "../pricing-facts.js";

/** One pricing rule (top-level rates are off-peak; `peak` holds the
 *  peak-hour rates when the model bills by time of day; `peakHours` lists
 *  the peak hours in Beijing time; `provider` scopes the rule to one
 *  provider route — empty prices the model id wherever it appears). */
const pricingRuleSchema = z.object({
  provider: z.string().default("").description("provider route id the rates apply to (empty = any provider, e.g. the official defaults)"),
  model: z.string().description("model id the rates apply to (as reported in usage events)"),
  input: z.number().default(0).description("price per million uncached input tokens in off-peak hours (cache misses and writes)"),
  cacheRead: z.number().description("price per million cache-hit input tokens in off-peak hours (defaults to `input` when omitted)"),
  output: z.number().default(0).description("price per million output tokens in off-peak hours"),
  peak: z.object({
    input: z.number().default(0).description("price per million uncached input tokens in peak hours"),
    cacheRead: z.number().description("price per million cache-hit input tokens in peak hours (defaults to peak `input` when omitted)"),
    output: z.number().default(0).description("price per million output tokens in peak hours"),
  }).description("peak-hour rates; omit for a flat rate"),
  peakHours: z.array(z.number().step(1).min(0).max(23)).description("peak hours in Beijing time (0–23); omit to inherit, or pass [] for flat pricing (defaults to the official 09:00–12:00 and 14:00–18:00 windows)"),
  weekdaysOnly: z.boolean().description("bill the peak hours Monday–Friday only, as the official windows do; omit to inherit, or pass `false` to apply them every day of the week"),
  currency: z.union(["CNY", "USD"]).default("CNY").description("currency the rates are denominated in; USD-priced models convert to CNY through `usdToCny` for the unified display"),
});

/** Schemastery validation with deployment-friendly defaults. Display fields
 *  are `.volatile()`: the harness hands them to `apply` as live references
 *  and commits edits to them in place — no plugin restart, no fold epoch
 *  reset. `pricing` deliberately stays ordinary: its peak-hour half must
 *  re-fold history, and the entry restart an ordinary edit triggers is
 *  exactly that boundary (persisted rows keyed by the pre-restart
 *  `stateVersion` mismatch and replay once). */
export const Config = z.object({
  currency: z.union(["CNY", "USD"]).default("CNY").description("global pricing currency; every effective rule prices in it and USD rates convert to the unified CNY total").volatile(),
  topProjects: z.number().default(8).description("how many project rows to keep in the breakdown").volatile(),
  projectDepth: z.number().default(1).description("path segments kept in a project label (1..3; deeper disambiguates same-named directories)").volatile(),
  defaultDays: z.number().default(30).description("day window served when the client sends no range").volatile(),
  costEnabled: z.boolean().default(true).description("show cost estimates; off hides the cost chip and the /pulse command cost line").volatile(),
  usdToCny: z.number().default(DEFAULT_USD_TO_CNY).description("USD→CNY rate converting USD-priced models into the unified CNY estimate").volatile(),
  monthlyProviders: z.array(z.string()).default([]).description("provider route ids billed as a flat monthly subscription — their models cost 0 marginal and need no per-model rates").volatile(),
  monthlyFee: z.dict(z.number()).default({}).description("provider route id → flat monthly price (CNY/month); the amount shows beside the 月付费 toggle and joins plan comparison as a subscription row").volatile(),
  searchShape: z.dict(z.number()).default({}).description("manual per-search-call token shape, keys miss/hit/out (tokens per call); empty = auto, letting the view self-calibrate the shape against the official balance. Any key here freezes calibration").volatile(),
  quotaOff: z.array(z.string()).default([]).description("provider route ids whose subscription-quota queries are disabled (quota-capable routes are detected automatically)").volatile(),
  modelColors: z.dict(z.string()).default({}).description("per-model accent colors for the model charts, keyed by model id; '' restores the automatic vendor/hue assignment").volatile(),
  pricing: z.array(pricingRuleSchema).default([]).description("per-model rates; empty disables cost estimation"),
});

/** The Config keys marked `.volatile()` — the only fields the harness may
 *  hand over as live references instead of plain values. */
const VOLATILE_KEYS = ["currency", "topProjects", "projectDepth", "defaultDays", "costEnabled", "usdToCny", "monthlyProviders", "monthlyFee", "quotaOff", "modelColors", "searchShape"];

/** Unwrap one live reference (a volatile value implements `.get()`) while
 *  letting plain values through, so one reader serves every host generation. */
const unwrapVolatile = (value) => (value !== null && typeof value === "object" && typeof value.get === "function" ? value.get() : value);

/** A shallow copy of the config with every volatile reference resolved to
 *  its current plain value — the read face of the config, always current. */
function liveConfig(source) {
  const out = { ...source };
  for (const key of VOLATILE_KEYS) if (key in out) out[key] = unwrapVolatile(out[key]);
  return out;
}




/** Wire filter for the per-model accent map: only string ids of bounded
 *  length and `#rgb`/`#rrggbb` colors (or '' = automatic) survive, so a
 *  hand-edited patch can neither inject junk into the client's CSS custom
 *  properties nor grow the map unboundedly. */
const MODEL_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/;
function sanitizeModelColors(value) {
  const out = {};
  if (value === null || typeof value !== "object") return out;
  for (const [id, color] of Object.entries(value)) {
    if (typeof id !== "string" || id === "" || id.length > 120) continue;
    if (typeof color !== "string") continue;
    const trimmed = color.trim().toLowerCase();
    if (trimmed !== "" && MODEL_COLOR_RE.test(trimmed) === false) continue;
    out[id] = trimmed;
  }
  return out;
}

/** Wire filter for the per-provider monthly fee map: only bounded ids with
 *  a positive finite CNY amount survive, so a hand-edited patch can neither
 *  inject junk nor grow the map unboundedly. */
function sanitizeMonthlyFee(value) {
  const out = {};
  if (value === null || typeof value !== "object") return out;
  for (const [id, fee] of Object.entries(value)) {
    if (typeof id !== "string" || id === "" || id.length > 120) continue;
    const n = Number(fee);
    if (!Number.isFinite(n) || n <= 0) continue;
    out[id] = Math.round(n * 100) / 100;
  }
  return out;
}

/** Wire filter for the manual aux shape (`searchShape`): only the three
 *  known keys survive, as sane positive token amounts. An empty object means
 *  "auto" — the view's self-calibration owns the shape. */
function sanitizeSearchShape(value) {
  const out = {};
  if (value === null || typeof value !== "object") return out;
  const bounds = { miss: 5e5, hit: 5e5, out: 1e5 };
  for (const [key, max] of Object.entries(bounds)) {
    if (!(key in value)) continue;
    const n = Number(value[key]);
    if (!Number.isFinite(n) || n <= 0 || n > max) continue;
    out[key] = Math.round(n);
  }
  return out;
}

/** The payload's effective aux shape: the manual keys overlay the built-in
 *  seed; `manual` tells the client whether the self-calibration is frozen. */
function effectiveAuxShape(config) {
  const manual = sanitizeSearchShape(unwrapVolatile(config.searchShape) ?? {});
  const shape = { ...AUX_SHAPE, ...manual };
  return { ...shape, manual: Object.keys(manual).length > 0 };
}

/** POST body → the patch merged into the user section / entry config. A body
 *  that omits a field must not clear it, so only present keys map through
 *  (`monthly` is the wire name of the `monthlyProviders` config field). */
function settingsPatchOf(body) {
  return {
    ...(body.costEnabled !== undefined ? { costEnabled: body.costEnabled } : {}),
    ...(body.usdToCny !== undefined ? { usdToCny: body.usdToCny } : {}),
    ...(body.pricing !== undefined ? { pricing: body.pricing } : {}),
    ...(body.currency !== undefined ? { currency: body.currency } : {}),
    ...(body.monthly !== undefined ? { monthlyProviders: body.monthly } : {}),
    ...(body.monthlyFee !== undefined ? { monthlyFee: sanitizeMonthlyFee(body.monthlyFee) } : {}),
    ...(body.quotaOff !== undefined ? { quotaOff: body.quotaOff.filter((id) => typeof id === "string" && id.length > 0 && id.length <= 120).slice(0, 64) } : {}),
    ...(body.modelColors !== undefined ? { modelColors: sanitizeModelColors(body.modelColors) } : {}),
    ...(body.searchShape !== undefined ? { searchShape: sanitizeSearchShape(body.searchShape) } : {}),
  };
}

export { pricingRuleSchema, VOLATILE_KEYS, unwrapVolatile, liveConfig, sanitizeModelColors, sanitizeMonthlyFee, sanitizeSearchShape, effectiveAuxShape, settingsPatchOf };
