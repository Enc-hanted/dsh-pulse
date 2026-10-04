/**
 * Per-model accent subsystem: the deterministic accent palette (FNV hash,
 * OKLab spacing, the family gradient) and the accent map every surface
 * shares. Extracted verbatim from view.js; the facade re-exports every
 * name, so no importer changed. Core key helpers come back through the
 * facade (function declarations — cycle-safe at call time).
 */
import { AUX_MODEL_KEY, modelKey, rollupKeyOf, splitModelKey } from "../view.js";

// --- per-model accent colors (deterministic across surfaces) -------------------

/** FNV-1a over the model id, salted. The salt (and the 9-step family
 *  gradient below) were chosen by scanning the ids deployments actually
 *  run: today's common sibling families land on distinct slots and the
 *  deepseek pair spans the gradient. Whatever else is present, an id's
 *  own slot never moves again — the same model wears the same color on
 *  every surface, in every window, in any order. */
export function accentHash(id, salt = 14) {
  let h = (0x811c9dc5 ^ salt) >>> 0;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Shortest angular distance between two hues. */
export function accentHueGap(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Vendor brand colors first — matched on the model id so `gpt-4o` hits
 *  OpenAI's tokens while `glm-5.3` never trips the short `o*` keys.
 *  Same-vendor siblings share one family spread between TWO anchors
 *  (`hex` → `soft`, hue and lightness together — the official-gradient
 *  trick: MiniMax's brand book pairs #FF3763→#FF7038 the same way), so
 *  every step stays saturated and clearly distinct even at dot size. */
const VENDOR_ACCENTS = [
  { keys: ["deepseek"], hex: "#4d6bfe", soft: "#00c2d8" },
  { keys: ["claude", "anthropic"], hex: "#d97757", soft: "#e8703a" },
  { keys: ["openai", "chatgpt", "gpt", "davinci", "o1", "o3", "o4"], hex: "#10a37f", soft: "#35c48d" },
  { keys: ["qwen", "qwq", "tongyi"], hex: "#847ace", soft: "#4796e4" },
  { keys: ["glm", "zhipu", "chatglm"], hex: "#2f6bff", soft: "#12b5a5" },
  { keys: ["minimax", "abab"], hex: "#ff3763", soft: "#ff7038" },
  { keys: ["grok", "xai"], hex: "#6e6d66", soft: "#c2c2bc" },
  { keys: ["mimo", "xiaomi"], hex: "#ff6900", soft: "#ffb02e" },
  { keys: ["llama", "meta"], hex: "#0668e1", soft: "#00a2ff" },
  { keys: ["gemini", "google", "gemma"], hex: "#1c69ff", soft: "#8ab4f8" },
  { keys: ["mistral", "mixtral", "codestral", "magistral"], hex: "#ff7000", soft: "#ffc400" },
  { keys: ["kimi", "moonshot", "k3"], hex: "#4b4b52", soft: "#9aa0aa" },
  { keys: ["hunyuan"], hex: "#0052d9", soft: "#26a5e2" },
  { keys: ["doubao", "skylark"], hex: "#4d53e8", soft: "#33c2ff" },
];

export function vendorAccentOf(id) {
  const tokens = id.split(/[^a-z0-9]+/);
  return VENDOR_ACCENTS.find((entry) => entry.keys.some((key) => (key.length >= 4 ? id.includes(key) : tokens.includes(key)))) ?? null;
}

/** Hue of a `#rgb`/`#rrggbb` anchor (0 when achromatic). */
function hexHue(hex) {
  const s = hex.replace("#", "");
  const v = s.length === 3 ? [...s].map((c) => c + c).join("") : s;
  const r = parseInt(v.slice(0, 2), 16) / 255;
  const g = parseInt(v.slice(2, 4), 16) / 255;
  const b = parseInt(v.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return ((h * 60) + 360) % 360;
}

/** sRGB hex → `[r, g, b]` in 0..1 (`#rgb` accepted). */
function hexRgb(hex) {
  const s = String(hex).replace("#", "");
  const v = s.length === 3 ? [...s].map((c) => c + c).join("") : s.padEnd(6, "0");
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
}

/** Encoded sRGB (0..1) → OKLab `[L, a, b]` — the perceptual space every
 *  colour decision below is measured in, so "distinguishable" is a measured
 *  number (ΔE) rather than a guess about hues. */
function srgbToLab(rgb) {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [lin(rgb[0]), lin(rgb[1]), lin(rgb[2])];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLCH (L 0..1, chroma, hue degrees) → OKLab. */
function oklchLab(l, c, hueDeg) {
  const rad = (hueDeg * Math.PI) / 180;
  return [l, c * Math.cos(rad), c * Math.sin(rad)];
}

/** OKLab → a CSS `oklch()` expression (used for resolved collision variants). */
function labToCss(lab) {
  const c = Math.hypot(lab[1], lab[2]);
  const hue = ((Math.atan2(lab[2], lab[1]) * 180) / Math.PI + 360) % 360;
  return `oklch(${(lab[0] * 100).toFixed(1)}% ${c.toFixed(3)} ${hue.toFixed(1)})`;
}

/** Perceptual distance between two OKLab triples (ΔE_ok). */
export function accentLabDistance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** The fixed anchor hues unknown-vendor hues must keep away from — a
 *  constant set, so the nudge never depends on co-present models. */
const VENDOR_ANCHOR_HUES = VENDOR_ACCENTS.flatMap((entry) => [hexHue(entry.hex), hexHue(entry.soft)]);

/** Steps on a vendor's brand gradient. */
const ACCENT_FAMILY_SLOTS = 9;

/** The aux pseudo-model's reserved hue — pinned to the mustard the
 *  dashboards have always shown it in, never reassigned to a family. */
const AUX_ACCENT_HUE = 80;
/** Diagonally striped paint: the aux row is an ESTIMATE, not a measured
 *  model, so it wears a texture no real family can be confused with — in
 *  colour and in the greyscale theme alike. Every surface paints accents
 *  through `background`, so a gradient fill needs no per-surface wiring. */
const stripeCss = (lab) => {
  const dark = [Math.max(0.2, lab[0] - 0.12), lab[1], lab[2]];
  return `repeating-linear-gradient(135deg, ${labToCss(lab)} 0 3px, ${labToCss(dark)} 3px 6px)`;
};
const AUX_ACCENT_LAB = oklchLab(0.68, 0.13, AUX_ACCENT_HUE);
const AUX_ACCENT_CSS = stripeCss(AUX_ACCENT_LAB);

/** Lightness offsets a resolved twin may step through. Measured: one step is
 *  ≈0.055 ΔE, so two steps clear even the tightest family gradient (Claude's
 *  two anchors sit only 0.035 apart end to end). */
const ACCENT_LUMA_STEPS = [0, 0.055, -0.055, 0.11, -0.11];
/** Hue lane width for unknown-vendor collisions. */
const ACCENT_HUE_STEP = 26;
/** Hue distance an unknown vendor's hashed hue keeps from every brand anchor. */
const ACCENT_ANCHOR_KEEP = 24;

/**
 * Resolution target (ΔE_ok): two auto colours closer than this read as one
 * swatch at dot size. Assignments maximise the distance to everything already
 * placed, so a family whose own gradient is shorter than the target still gets
 * its best available separation instead of a silent duplicate.
 */
export const ACCENT_MIN_DISTANCE = 0.07;

/** One model's canonical accent spec — the colour it wears with no sibling or
 *  route twin in sight. Pure per id, so it never moves between windows. */
function accentSpecOf(id) {
  const key = String(id).toLowerCase();
  if (key === AUX_MODEL_KEY) return { kind: "aux" };
  const vendor = vendorAccentOf(key);
  if (vendor !== null) return { kind: "vendor", vendor, slot: accentHash(key) % ACCENT_FAMILY_SLOTS };
  let hue = accentHash(key) % 360;
  for (let guard = 0; guard < 12 && VENDOR_ANCHOR_HUES.some((h) => accentHueGap(h, hue) < ACCENT_ANCHOR_KEEP); guard += 1) {
    hue = (hue + 137.508) % 360;
  }
  return { kind: "free", hue };
}

const vendorSlotCss = (vendor, slot) => {
  const pct = (slot / (ACCENT_FAMILY_SLOTS - 1)) * 100;
  return `color-mix(in srgb, ${vendor.hex} ${100 - pct}%, ${vendor.soft} ${pct}%)`;
};

const vendorSlotLab = (vendor, slot) => {
  const t = slot / (ACCENT_FAMILY_SLOTS - 1);
  const a = hexRgb(vendor.hex);
  const b = hexRgb(vendor.soft);
  return srgbToLab([0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t));
};

/** Canonical colour (CSS) and OKLab for one spec. */
function accentSpecPaint(spec) {
  if (spec.kind === "aux") return { css: AUX_ACCENT_CSS, lab: AUX_ACCENT_LAB };
  if (spec.kind === "vendor") return { css: vendorSlotCss(spec.vendor, spec.slot), lab: vendorSlotLab(spec.vendor, spec.slot) };
  return { css: `oklch(68% 0.13 ${spec.hue.toFixed(1)})`, lab: oklchLab(0.68, 0.13, spec.hue) };
}

/** Every colour this spec may take when it has to move out of the way,
 *  nearest-to-canonical first (strict `>` comparison in the picker therefore
 *  keeps the canonical paint on ties). */
function accentCandidates(spec) {
  const out = [];
  const push = (lab, css, rank) => out.push({ lab, css, rank });
  if (spec.kind === "aux") {
    const paint = accentSpecPaint(spec);
    push(paint.lab, paint.css, 0);
    return out;
  }
  if (spec.kind === "vendor") {
    for (let slot = 0; slot < ACCENT_FAMILY_SLOTS; slot += 1) {
      const base = vendorSlotLab(spec.vendor, slot);
      for (const dL of ACCENT_LUMA_STEPS) {
        const lab = dL === 0 ? base : [base[0] + dL, base[1], base[2]];
        push(lab, dL === 0 ? vendorSlotCss(spec.vendor, slot) : labToCss(lab), Math.abs(slot - spec.slot) + Math.abs(dL) * 10);
      }
    }
  } else {
    for (let lane = 0; lane <= 12; lane += 1) {
      const offset = Math.ceil(lane / 2) * ACCENT_HUE_STEP * (lane % 2 === 0 ? 1 : -1);
      const hue = (spec.hue + offset + 360) % 360;
      for (const dL of ACCENT_LUMA_STEPS) {
        const lab = oklchLab(0.68 + dL, 0.13, hue);
        push(lab, labToCss(lab), lane + Math.abs(dL) * 10);
      }
    }
  }
  out.sort((a, b) => a.rank - b.rank);
  return out;
}

/**
 * The stable auto color for one model id — a pure function of the id: vendor
 * families spread over their brand gradient by hashed slot, the aux
 * pseudo-model wears its reserved hue, unknown vendors hash to a hue nudged
 * off every brand anchor. {@link modelAccentMap} may still move a colour when a
 * co-visible twin would otherwise be identical; this is the canonical paint,
 * and the colour an unopposed model always wears.
 *
 * @param {string} id - bare model id (no provider prefix).
 * @returns {string} a CSS color expression.
 */
export function accentFillOf(id) {
  return accentSpecPaint(accentSpecOf(id)).css;
}

/**
 * The accent map for one visible model set: composite model key →
 * `{fill, custom, aux, lab, distance}`.
 *
 * Canonical colours come from {@link accentFillOf}. Because a family's own
 * gradient can be shorter than a visible difference (Claude's anchors sit
 * 0.035 ΔE apart, and several vendors' hashed slots land only 0.013 apart),
 * the set is then resolved: pinned colours first (user overrides keep their
 * hex, the aux pseudo-model its reserved gold), then the rest in key order,
 * each taking the candidate furthest from everything already placed. Set
 * membership therefore decides who has to move — exactly what a chart needs —
 * and within one set the result is deterministic, so no two rows of one chart
 * can wear the same swatch. `bw` runs the same resolution measured on
 * lightness alone, so the B&W theme gets a grey ladder instead of one flat
 * grey. Entries are keyed by composite model key; {@link accentEntryOf} is the
 * provider-aware lookup.
 *
 * @param {Array<{model?: string, key?: string, provider?: string}>} models - rows or ids.
 * @param {Record<string, string>} [overrides] - model id → hex color.
 * @param {{bw?: boolean}} [options] - `bw` resolves for the greyscale theme.
 * @returns {Map<string, {fill: string, custom: boolean, aux: boolean, lab: number[], distance: number}>}
 */
export function modelAccentMap(models, overrides, { bw = false } = {}) {
  const colorRe = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
  const entries = [];
  const seen = new Set();
  for (const row of Array.isArray(models) ? models : []) {
    const id = String(row?.model ?? row?.key ?? "");
    if (id === "" || id === "unknown") continue;
    const rawKey = row?.key === undefined ? "" : String(row.key);
    const provider = typeof row?.provider === "string"
      ? row.provider
      : (rawKey.includes("\u0000") ? splitModelKey(rawKey).provider : "");
    const key = rawKey.includes("\u0000") ? rawKey : modelKey(provider, id);
    if (seen.has(key)) continue;
    seen.add(key);
    const raw = overrides?.[id];
    const custom = typeof raw === "string" && colorRe.test(raw.trim()) ? raw.trim().toLowerCase() : null;
    entries.push({
      key,
      spec: custom === null ? accentSpecOf(id) : null,
      custom,
      customLab: custom === null ? null : srgbToLab(hexRgb(custom)),
    });
  }
  const project = (lab) => (bw === true ? [lab[0], 0, 0] : lab);
  const placed = [];
  const out = new Map();
  const place = (entry, css, lab, distance) => {
    placed.push(project(lab));
    // The B&W theme emits the resolved lightness as a grey, so the ladder the
    // resolution built survives into the rendered swatch instead of being
    // flattened afterwards by a one-size-fits-all desaturation.
    const paint = bw === true && entry.custom === null
      ? (entry.spec?.kind === "aux" ? stripeCss([lab[0], 0, 0]) : labToCss([lab[0], 0, 0]))
      : css;
    out.set(entry.key, {
      fill: paint, custom: entry.custom !== null, aux: entry.spec?.kind === "aux", lab, distance,
    });
  };
  // Pinned first: user overrides keep their hex in both themes (a hand-picked
  // colour outranks the theme's greyscale) and the aux pseudo-model keeps its
  // reserved gold, so every auto colour places itself away from both.
  for (const entry of entries) {
    if (entry.custom !== null) place(entry, entry.custom, entry.customLab, Infinity);
  }
  const aux = entries.filter((entry) => entry.custom === null && entry.spec.kind === "aux");
  for (const entry of aux) {
    const paint = accentSpecPaint(entry.spec);
    const probe = project(paint.lab);
    place(entry, paint.css, paint.lab, placed.reduce((m, lab) => Math.min(m, accentLabDistance(probe, lab)), Infinity));
  }
  const movers = entries
    .filter((entry) => entry.custom === null && entry.spec.kind !== "aux")
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  for (const entry of movers) {
    // Nearest-to-canonical first: the first candidate that clears the target
    // wins, so an unopposed model is untouched and a twin takes the smallest
    // step that makes it readable. Only when a family's whole gradient is too
    // short does the picker fall back to "furthest available".
    let best = null;
    let bestDistance = -1;
    let fallback = null;
    let fallbackDistance = -1;
    for (const candidate of accentCandidates(entry.spec)) {
      const probe = project(candidate.lab);
      const distance = placed.reduce((m, lab) => Math.min(m, accentLabDistance(probe, lab)), Infinity);
      if (distance >= ACCENT_MIN_DISTANCE && best === null) {
        best = candidate;
        bestDistance = distance;
        break;
      }
      if (distance > fallbackDistance + 1e-9) {
        fallbackDistance = distance;
        fallback = candidate;
      }
    }
    const pick = best ?? fallback;
    place(entry, pick.css, pick.lab, best !== null ? bestDistance : fallbackDistance);
  }
  return out;
}

/** Lookup for surfaces that know a (provider, model) pair but not the key form:
 *  the composite entry, then the family-rolled-up key, then the bare model id. */
export function accentEntryOf(map, provider, model) {
  if (map === undefined || map === null || typeof map.get !== "function") return undefined;
  const id = String(model ?? "");
  if (id === "") return undefined;
  const route = typeof provider === "string" ? provider : "";
  const composite = map.get(modelKey(route, id));
  if (composite !== undefined) return composite;
  const rolled = map.get(rollupKeyOf(route, id));
  if (rolled !== undefined) return rolled;
  return map.get(id) ?? map.get(modelKey("", id));
}

