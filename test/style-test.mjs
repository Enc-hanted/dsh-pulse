/**
 * style-test.mjs — the CSS/JSX class lock (静默失效防线).
 *
 * A card-level rule has twice been written against a class the markup never
 * wears (`.dp_sparkCard` was styled while the cache card's root only ever
 * rendered `dp_chip`; `.dp_ringFoot` outlived its node). CSS fails silently:
 * the rule never applies, the layout regresses, and every suite stays green.
 * This suite makes both directions loud:
 *
 * 1. every `.dp_*` class the sheet declares must be emitted by the client
 *    modules' JS (a rule with no markup can never match);
 * 2. every `dp_*` token the client modules mention must have a rule (markup
 *    without a rule is unstyled, which is how a "tuned" card silently loses
 *    its typography).
 *
 * Both directions understand dynamically composed names: `dp_hcL${level}`
 * emits `dp_hcL1…4`, and a JS token that is a prefix of a declared class is
 * that family's base name.
 *
 * The sheet region is every `export const <name>Css` template literal in
 * css.js joined, so a class named only inside a CSS comment does NOT
 * count as used.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zh as localeZh, en as localeEn } from "../src/client/locale.js";

// R0: the sheets live in src/client/css.js — the source of truth. The class
// corpus is every client module; the esbuild bundle no longer carries the
// comment markers these anchors rely on, so the lock reads source, while the
// parse/init-order tests below keep auditing the served artifact itself.
const clientDir = new URL("../src/client/", import.meta.url);
const moduleText = (name) => fs.readFileSync(new URL(name, clientDir), "utf8");
const cssSource = moduleText("css.js");
// Sheets are located by their export names, not character slices, so a sheet
// added later is automatically inside every lock below. A sheet's template
// literal may not contain a backtick (one stray backtick truncates the sheet
// in the bundle) — the [^`] scan enforces that by construction.
const SHEET_RE = /\t\texport const (\w*[Cc]ss) = `([^`]*)`/g;
const sheets = new Map();
for (const m of cssSource.matchAll(SHEET_RE)) sheets.set(m[1], m[2]);
assert.ok(sheets.size >= 5, `the css sheets must be found by export name, got: ${[...sheets.keys()].join(", ")}`);
const cssText = [...sheets.values()].join("");
const corpusFiles = fs.readdirSync(clientDir).filter((f) => f.endsWith(".js"));
const corpus = new Map(corpusFiles.map((f) => [f, f === "css.js" ? cssSource.replace(SHEET_RE, "") : moduleText(f)]));
const jsText = [...corpus.values()].join("\n");
const bundle = fs.readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");

const cssClasses = new Set([...cssText.matchAll(/\.(dp_[A-Za-z0-9_-]+)/g)].map((m) => m[1]));
const jsTokens = new Set([...jsText.matchAll(/\b(dp_[A-Za-z0-9_-]+)/g)].map((m) => m[1]));

/** `dp_hcL1` → `dp_hcL` when the JS builds the name as `dp_hcL${level}`. */
const stem = (cls) => {
  const base = cls.replace(/\d+$/, "");
  return base !== cls && base.length > 4 ? base : null;
};
const emitted = (cls) => {
  const base = stem(cls);
  return jsTokens.has(cls) || (base !== null && jsText.includes(`${base}\${`));
};
const styled = (tok) => cssClasses.has(tok) || [...cssClasses].some((cls) => cls.startsWith(tok));

/** Known debt, recorded from the pre-existing sheet. Both lists may only
 *  SHRINK: a cleanup passes, new drift fails. Prune an entry the moment its
 *  class is removed or revived. */
const DEAD_KNOWN = new Set([]);
const UNSTYLED_KNOWN = new Set([
  "dp_accentCustom", "dp_hourWrap", "dp_zoomReset",
]);

let failed = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test("no styled class has lost its markup", () => {
  const dead = [...cssClasses].filter((cls) => !emitted(cls)).sort();
  const added = dead.filter((cls) => !DEAD_KNOWN.has(cls));
  const pruned = [...DEAD_KNOWN].filter((cls) => !dead.includes(cls));
  console.log(`  info  known-dead snapshot: ${dead.length} headroom ${DEAD_KNOWN.size - dead.length}${pruned.length > 0 ? ` (prune from DEAD_KNOWN: ${pruned.join(", ")})` : ""}`);
  assert.deepEqual(added, [], `CSS rules with no markup (silent no-ops): ${added.join(", ")}`);
});

test("no markup class has lost its rule", () => {
  const unstyled = [...jsTokens].filter((tok) => !styled(tok)).sort();
  const added = unstyled.filter((tok) => !UNSTYLED_KNOWN.has(tok));
  const pruned = [...UNSTYLED_KNOWN].filter((tok) => !unstyled.includes(tok));
  console.log(`  info  known-unstyled snapshot: ${unstyled.length}${pruned.length > 0 ? ` (prune from UNSTYLED_KNOWN: ${pruned.join(", ")})` : ""}`);
  assert.deepEqual(added, [], `markup classes with no CSS rule: ${added.join(", ")}`);
});

test("the hero canvas root wears its stable class", () => {
  // The fluid head redesign merged the two contract-bound row cards into ONE
  // adaptive canvas; pinning its root here keeps a rename from silently
  // dropping the card out of the row rules (and out of container-query scope).
  for (const cls of ["dp_heroCard"]) {
    assert.ok(cssClasses.has(cls), `${cls} must appear in the stylesheet`);
    assert.ok(jsTokens.has(cls), `${cls} must be worn by a rendered node`);
  }
});

test("the bundle parses and its sheets are balanced", () => {
  // The stylesheets live in template literals, so a stray backtick inside a CSS
  // comment truncates the sheet and turns the rest of it into JavaScript — a
  // failure that still "looks like CSS" in review. Parsing the whole file and
  // counting braces catches it here instead of in the browser.
  assert.doesNotThrow(() => new Function(bundle), "lib/client.js must parse as a script");
  const open = (cssText.match(/\{/g) ?? []).length;
  const close = (cssText.match(/\}/g) ?? []).length;
  assert.equal(open, close, `CSS blocks must balance ({ ${open} vs } ${close})`);
  assert.ok(cssText.length > 20000, "the sheet region must be substantial");
  assert.ok(cssText.includes(".dp_heroCard"), "the hero canvas rule must ride the last sheet");
});

test("the client factory evaluates against host externals (init-order lock)", () => {
  // Parsing is not loading: `new Function(source)` above only proves the file is
  // syntactically valid. A top-level declaration that reads a binding defined
  // BELOW it (the `primitives` proxy, a stylesheet string, a locale table)
  // throws `ReferenceError: Cannot access 'X' before initialization` the moment
  // the HOST evaluates the factory — every client surface of the plugin dies
  // with that single throw, and the page with them. That is not a hypothetical:
  // a `const TooltipPrim = primitives.Tooltip` placed above the proxy crashed
  // the host UI and forced the plugin to be uninstalled. This runs the REAL
  // factory with stub externals, exactly the way the loader does.
  let captured = null;
  const priorWindow = globalThis.window;
  globalThis.window = { __ModuleLoader__: { load(spec) { captured = spec; } } };
  try {
    new Function(bundle)();
    assert.ok(captured !== null && typeof captured.factory === "function", "the bundle must register a factory");
    const stub = (name) => {
      if (name === "react") {
        return { useState: () => [], useEffect: () => {}, useMemo: (fn) => fn(), useRef: () => ({}), useSyncExternalStore: () => null, forwardRef: (fn) => fn };
      }
      if (name === "react/jsx-runtime") return { jsx: () => null, jsxs: () => null };
      return {};
    };
    assert.doesNotThrow(() => captured.factory(stub), "the factory must evaluate against the host externals");
  } finally {
    if (priorWindow === undefined) delete globalThis.window;
    else globalThis.window = priorWindow;
  }
});

test("every module declaration survives the bundle (no orphaned modules)", () => {
  // The hole this guards: a missing import turns a binding into a silent
  // global reference; esbuild then drops the declaring module from the graph
  // entirely while the broken references stay in the output. The eval lock
  // cannot catch that (the references sit inside unexecuted function bodies),
  // but a declaration that is gone from the bundle while ANOTHER module still
  // names it is loud here. Legitimate tree-shakes (unreferenced exports,
  // dead chains, host-side view.js helpers) pass: nothing else names them.
  // `(?:\t\t)?` — adapter.js declares at column 0; its exports must be in
  // the map or the guard cannot see references to them.
  const DECL = /^(?:\t\t)?(?:export\s+)?(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
  const missing = [];
  const check = (home, name) => {
    if (bundle.includes(name)) return;
    const refs = [...corpus].filter(([f, text]) => f !== home && new RegExp(`\\b${name}\\b`).test(text));
    if (refs.length > 0) missing.push(`${name} (${home} <- ${refs.map(([f]) => f).join(", ")})`);
  };
  for (const [f, text] of corpus) {
    if (f === "main.js") continue; // pure re-export
    for (const m of text.matchAll(DECL)) check(f, m[1]);
  }
  const viewSource = fs.readFileSync(new URL("../src/view.js", import.meta.url), "utf8");
  for (const m of viewSource.matchAll(/^export (?:async )?(?:function\*?|class|const)\s+([A-Za-z_$][\w$]*)/gm)) check("view.js", m[1]);
  assert.deepEqual(missing, [], `declarations referenced cross-module but missing from the bundle: ${missing.join(", ")}`);
});

test("every cross-module reference is imported (no silent globals)", () => {
  // The sibling of the orphan guard: a module that USES another module's
  // top-level name without importing it builds fine (esbuild keeps a bare
  // global) and every test stays green, then ReferenceErrors in the browser
  // on first render. This walks the name map: any referenced cross-module
  // declaration must be either imported or shadowed by a local binding.
  // `(?:\t\t)?` — adapter.js declares at column 0; its exports must be in
  // the map or the guard cannot see references to them.
  const DECL = /^(?:\t\t)?(?:export\s+)?(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
  const nameMap = new Map(); // name -> declaring file
  for (const [f, text] of corpus) {
    for (const m of text.matchAll(DECL)) if (!nameMap.has(m[1])) nameMap.set(m[1], f);
  }
  const viewSource = fs.readFileSync(new URL("../src/view.js", import.meta.url), "utf8");
  for (const m of viewSource.matchAll(/^export (?:async )?(?:function\*?|class|const)\s+([A-Za-z_$][\w$]*)/gm)) {
    if (!nameMap.has(m[1])) nameMap.set(m[1], "view.js");
  }
  // view.js internals WITHOUT export are invisible to the map above, but the
  // old flat closure made them visible to every client module — a reference
  // to one builds fine and ReferenceErrors on first render. Flag them: the
  // fix is exporting from view.js (or dropping the reference).
  const viewInternals = new Set();
  for (const m of viewSource.matchAll(/^(?:async\s+)?(?:function\*?|const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) {
    if (!nameMap.has(m[1])) viewInternals.add(m[1]);
  }
  const importsOf = (text) => {
    const names = new Set();
    for (const m of text.matchAll(/(?:import|export)\s*\{([^}]*)\}\s*from/g)) {
      for (const part of m[1].split(",")) {
        const id = part.trim().split(/\s+as\s+/)[0].trim();
        if (id !== "") names.add(id);
      }
    }
    return names;
  };
  const localBinding = (text, name) => new RegExp(`\\b(?:const|let|var|function)\\s+${name}\\b`).test(text);
  // String-literal and comment contents are not code references (locale dict
  // values like `"Input"`, or a comment that merely names a helper, would
  // otherwise masquerade as adapter imports).
  const stripStrings = (t) => t
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ");
  const offenders = [];
  for (const [f, rawText] of corpus) {
    if (f === "main.js") continue; // pure re-export surface
    const text = stripStrings(rawText);
    const imports = importsOf(text);
    const check = (name, home) => {
      if (home === f || imports.has(name) || localBinding(text, name)) return;
      if (new RegExp(`\\b${name}\\b`).test(text)) offenders.push(`${name} (${home}) used in ${f} without import`);
    };
    for (const [name, home] of nameMap) check(name, home);
    for (const name of viewInternals) check(name, "view.js unexported");
  }
  assert.deepEqual(offenders, [], `cross-module references without imports: ${offenders.join("; ")}`);
});

test("no client module carries dead imports (a split's debris is deleted, not inherited)", () => {
  // The sibling of the silent-globals guard, from the other side: a module
  // split that seeds every new file with the monolith's full import list
  // leaves names that are imported and never used — invisible to the bundle
  // (esbuild drops them) and to the guard above (they ARE imported). The
  // charts split shipped ~90 of these before this lock existed. Every
  // imported name must appear at least once outside its own import clause,
  // judged on string/comment-stripped text. `export { x } from` is not an
  // import (a re-export surface is legitimate); main.js is pure re-export.
  const strip = (t) => t
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ");
  const offenders = [];
  for (const [f, rawText] of corpus) {
    if (f === "main.js") continue;
    const text = strip(rawText);
    for (const m of text.matchAll(/import\s*\{([^}]*)\}\s*from/g)) {
      for (const part of m[1].split(",")) {
        const id = part.trim().split(/\s+as\s+/)[0].trim();
        if (id === "") continue;
        if (text.split(id).length - 1 <= 1) offenders.push(`${f}: ${id}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `imported but never used: ${offenders.join(", ")}`);
});

test("host Button is reached only through the adapter's Btn wrapper", () => {
  // A direct `primitives.Button` render crashes old hosts (the proxy yields
  // undefined) — the adapter's Btn is the only door, fallbackClass included.
  const offenders = [...corpus]
    .filter(([f, text]) => f !== "adapter.js" && text.includes("primitives.Button"))
    .map(([f]) => f);
  assert.deepEqual(offenders, [], `primitives.Button used outside adapter.js: ${offenders.join(", ")}`);
});

test("money notation has one exit — no inline ¥ templates", () => {
  // moneyParts/moneyCny/quotaMoney own every money face. Three regressions
  // are locked out: a hand-rolled `¥${fmtCost(x)}` (the two-notation bug —
  // ¥ and CNY printed side by side), a `...} CNY` template tail (the suffix
  // family), and fmtCost reaching the screen outside its sanctioned homes —
  // view.js (definitions), compare.js (the comparison page's self-consistent
  // 「折合 {v}/月 + CNY 小字」 suffix notation, documented in locale.js).
  const offenders = [];
  for (const [f, text] of corpus) {
    if (text.includes("¥${fmtCost")) offenders.push(`${f}: inline ¥`);
    if (/\}\s*CNY`/.test(text)) offenders.push(`${f}: CNY template tail`);
    if (f !== "view.js" && f !== "compare.js" && /[{>(]\s*fmtCost\(/.test(text)) offenders.push(`${f}: fmtCost on screen`);
  }
  const tui = fs.readFileSync(new URL("../src/tui.js", import.meta.url), "utf8");
  if (tui.includes("¥${fmtCost")) offenders.push("tui.js: inline ¥");
  assert.deepEqual(offenders, [], `money faces outside the single exits: ${offenders.join(", ")}`);
});

test("the canvas harness artifact is fresh (regenerate after css.js edits)", () => {
  // v4-canvas.html is the layout acceptance's base plate; its CSS is LIVE
  // but only via a regen. A commit that edits css.js (or the template)
  // without re-running scripts/build-canvas-demo.mjs must go red here, not
  // silently re-validate layouts against a stale artifact. The generator's
  // own timestamp line is excluded; everything else is byte-exact.
  // The plate carries the author's real usage figures, so plate + generator
  // + matrix are deliberately untracked (gitignored, author-local only);
  // where the plate is absent (a fresh clone, CI) there is nothing to guard
  // and this suite stands down.
  const platePath = new URL("../v4-canvas.html", import.meta.url);
  if (!fs.existsSync(platePath)) return;
  const out = join(tmpdir(), `dsh-canvas-fresh-${process.pid}.html`);
  const regen = spawnSync(process.execPath, [new URL("../scripts/build-canvas-demo.mjs", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),],
    { env: { ...process.env, CANVAS_OUT: out } });
  try {
    assert.equal(regen.status, 0, `canvas regen failed: ${regen.stderr}`);
    const norm = (text) => text.split("\n").filter((line) => !line.includes("生成于")).join("\n");
    const fresh = norm(fs.readFileSync(out, "utf8"));
    const committed = norm(fs.readFileSync(new URL("../v4-canvas.html", import.meta.url), "utf8"));
    assert.equal(fresh, committed, "v4-canvas.html is stale — run node scripts/build-canvas-demo.mjs");
  } finally {
    fs.rmSync(out, { force: true });
  }
});

test("locale: zh/en share one key set, every key is consumed, leaves are strings", () => {
  // The dictionaries are hand-maintained twins; without this lock a renamed
  // key, a missed translation or a one-sided addition silently renders as
  // undefined copy. Dynamic consumption is exempted by EXACT name: the act*
  // trio rides a t(label) array and the rel* family a `rel${unit}` concat.
  const EXEMPT = new Set(["actSessions", "actTurns", "actToolCalls", "relMinutes", "relHours", "relDays", "relMonths", "relYears"]);
  const zhKeys = Object.keys(localeZh);
  const enKeys = Object.keys(localeEn);
  const missingInEn = zhKeys.filter((k) => !(k in localeEn));
  const missingInZh = enKeys.filter((k) => !(k in localeZh));
  assert.deepEqual([missingInEn, missingInZh], [[], []],
    `zh/en key sets diverge — not in en: ${missingInEn}; not in zh: ${missingInZh}`);
  const empty = [...zhKeys, ...enKeys].filter((k) => {
    const v = localeZh[k] ?? localeEn[k];
    return typeof v !== "string" || v.length === 0;
  });
  assert.deepEqual(empty, [], `locale leaves must be non-empty strings: ${empty}`);
  const hay = [...corpus].filter(([f]) => f !== "locale.js").map(([, text]) => text).join("\n");
  const dead = zhKeys.filter((k) => {
    if (EXEMPT.has(k)) return false;
    return !hay.includes(`"${k}"`) && !hay.includes("'".concat(k, "'")) && !hay.includes("`".concat(k, "`"));
  });
  assert.deepEqual(dead, [], `dead locale keys (zero quoted consumption): ${dead.join(", ")}`);
});

test("style props carry only dynamic values (static chrome lives in the sheets)", () => {
  // Contract: static styles belong in the sheets — one home, under the class
  // lock. A style prop may only carry data-driven values (a `%` width/left,
  // an accent fill), SVG plot geometry, or float positioning. Every
  // `style: { ... }` object whose values are ALL string/number literals is
  // static chrome that migrated; a backtick, identifier or spread value
  // marks a legitimate dynamic prop. CONDITIONAL style props
  // (`style: cond ? { ... } : undefined`) are static inline just the same —
  // the only exemption is an object whose every key is float positioning
  // (left/top/right/bottom/transform, the tooltip edge-flip family).
  const offenders = [];
  const scanObject = (f, capture, tag) => {
    if (capture.includes("`")) return;
    let any = false, allStatic = true;
    const keys = [];
    for (const part of capture.split(",")) {
      const colon = part.indexOf(":");
      if (colon < 0) { allStatic = false; break; }
      any = true;
      keys.push(part.slice(0, colon).trim());
      if (!/^["'-\d]/.test(part.slice(colon + 1).trim())) { allStatic = false; break; }
    }
    if (any && allStatic) offenders.push(`${f}: ${tag}{ ${capture.trim().slice(0, 60)} }`);
  };
  for (const [f, text] of corpus) {
    if (f === "css.js") continue;
    for (const m of text.matchAll(/style: \{([^{}]*)\}/g)) scanObject(f, m[1], "");
    for (const m of text.matchAll(/style:\s*[^,{}]+?\?\s*\{([^{}]*)\}/g)) {
      const keys = m[1].split(",").map((part) => part.slice(0, part.indexOf(":")).trim());
      const FLOATS = new Set(["left", "top", "right", "bottom", "transform"]);
      if (keys.length > 0 && keys.every((k) => FLOATS.has(k))) continue; // float positioning
      scanObject(f, m[1], "conditional ");
    }
  }
  assert.deepEqual(offenders, [], `static inline styles must move to the sheet: ${offenders.join("; ")}`);
});

test("font sizes ride the token ladder (typography has one scale)", () => {
  // Every font-size in the sheets resolves through the --dp-fs-* ladder (or
  // clamp/calc for the ring/hero scaling faces). The one sanctioned
  // exception: rowCss deliberately clones the host DeveloperToolsRow's
  // 14px/12px metrics so the injected seat is indistinguishable from the
  // surrounding rows — literals are allowed only inside that sheet.
  const offenders = [];
  for (const [name, text] of sheets) {
    for (const m of text.matchAll(/font-size:([^;}`]+)/g)) {
      const v = m[1].trim();
      if (v.startsWith("var(--dp-fs-") || v.startsWith("clamp(") || v.startsWith("calc(") || v === "inherit") continue;
      if (name === "rowCss" && /^\d+px$/.test(v)) continue;
      offenders.push(`${name}: ${v}`);
    }
  }
  assert.deepEqual(offenders, [], `font-size must use --dp-fs-* tokens (rowCss host-clone exempt): ${offenders.join(", ")}`);
});

/** Card-layout sizes come from the content or the container (em / cqw / % /
 *  shared tokens) — never from a pixel tuned to one screen. Typography
 *  (font-size, line-height), hairline borders and element-intrinsic geometry
 *  (the icon hit-targets) are the honest exceptions and stay allowed. */
const CARD_LAYOUT_START = cssText.indexOf("/*dp-card-layout-start*/");
const CARD_LAYOUT_END = cssText.indexOf("/*dp-card-layout-end*/");
const LAYOUT_PROPS = new Set([
  "width", "height", "min-width", "max-width", "min-height", "max-height",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "gap", "column-gap", "row-gap", "top", "right", "bottom", "left", "inset",
  "flex", "flex-basis",
]);

test("card layout sizes derive from content/container, not pixels", () => {
  assert.ok(CARD_LAYOUT_START >= 0 && CARD_LAYOUT_END > CARD_LAYOUT_START, "the card layout region must be marked with sentinels");
  const region = cssText.slice(CARD_LAYOUT_START, CARD_LAYOUT_END);
  const offenders = [];
  for (const rule of region.split("}")) {
    const brace = rule.indexOf("{");
    if (brace < 0) continue;
    const selector = rule.slice(0, brace).trim();
    for (const decl of rule.slice(brace + 1).split(";")) {
      const colon = decl.indexOf(":");
      if (colon < 0) continue;
      const prop = decl.slice(0, colon).trim().toLowerCase();
      const value = decl.slice(colon + 1).trim();
      if (LAYOUT_PROPS.has(prop) && /\dpx\b/.test(value)) offenders.push(`${selector} { ${prop}: ${value} }`);
    }
  }
  assert.deepEqual(offenders, [], "layout px crept back into the card region");
});

// The cache zone must not carry a min-width that is narrower than the ring +
// evidence pair it exists to hold. A floor was tried twice here and both
// values produced a wrong form (17.5em booked the evidence at the ring's
// ceiling and dropped the whole zone to its own banner; 10.5em under-booked
// it and wrapped the evidence UNDER the ring). The pair's measured minimum is
// ~434px, so a floor must be stated in that unit — never borrowed from another
// element's clamp. This lock keeps a re-introduced floor honest.
test("the cache zone floor, if any, covers the ring+evidence pair", () => {
  const cacheRule = /\.dp_hCache\{([^}]*)\}/.exec(cssText);
  assert.notEqual(cacheRule, null, ".dp_hCache must stay declared");
  const minWidth = /min-width:([^;}]+)/.exec(cacheRule[1]);
  if (minWidth === null) return;
  const floor = /--dp-cache-floor:([^;]+);/.exec(cssText);
  assert.notEqual(floor, null, `${minWidth[1]} references a floor that is not declared`);
  const evidence = /([0-9.]+)em\)?\s*$/.exec(floor[1].replace(/\s+/g, ""));
  assert.notEqual(evidence, null, `the floor must end in the evidence measure (got: ${floor[1]})`);
  assert.ok(Number(evidence[1]) >= 14,
    `the floor's evidence term is ${evidence[1]}em — the ring+evidence pair measures ~434px, so anything below ~14em of evidence wraps the pair inside the zone`);
});

// --- dsh alignment ledgers (host-name locks against silent degrade) --------

const { HOST_ICON_NAMES } = await import("./fixtures/dsh-host-icons.mjs");
const { HOST_DSW_TOKENS } = await import("./fixtures/dsw-host-tokens.mjs");

test("every primitives.Icon* reference has a host name or a legacy alias", () => {
  const adapterText = moduleText("adapter.js");
  const aliasBlock = /export const LEGACY_ICON_ALIASES = \{([^}]*)\}/.exec(adapterText);
  assert.notEqual(aliasBlock, null, "LEGACY_ICON_ALIASES must stay declared in adapter.js");
  const aliasKeys = new Set([...aliasBlock[1].matchAll(/\b(Icon[A-Za-z0-9]+):/g)].map((m) => m[1]));
  const refs = [...new Set([...jsText.matchAll(/primitives\.(Icon[A-Za-z0-9]+)/g)].map((m) => m[1]))];
  assert.ok(refs.length > 0, "icon reference extraction found nothing — the call shape changed");
  const unknown = refs.filter((name) => !aliasKeys.has(name) && !HOST_ICON_NAMES.has(name));
  assert.deepEqual(unknown, [],
    `icon names with no host generation and no LEGACY_ICON_ALIASES entry (the runtime degrades them to a blank): ${unknown.join(", ")}`);
});

test("themeCss rebinds only host-known --dsw-* token names", () => {
  const themeSheet = sheets.get("themeCss");
  assert.ok(themeSheet !== undefined, "themeCss sheet must exist");
  const used = [...new Set([...themeSheet.matchAll(/(--dsw-[a-z0-9-]+):/g)].map((m) => m[1]))];
  assert.ok(used.length > 0, "themeCss token extraction found nothing");
  // Shrink-only exemptions: names the audited host generations never
  // defined, carried by the css.js :where bridge and its fallback values.
  // A name may leave this set (the host defined it); never add one —
  // pick the host's real name instead.
  const EXEMPT = new Set(["--dsw-alias-color-danger", "--dsw-alias-state-success"]);
  const unknown = used.filter((token) => !HOST_DSW_TOKENS.has(token) && !EXEMPT.has(token));
  assert.deepEqual(unknown, [],
    `themeCss token names absent from the frozen host vocabulary (test/fixtures/dsw-host-tokens.mjs — re-audit the new host, then use its real name): ${unknown.join(", ")}`);
});

for (const [name, fn] of tests) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL  ${name}`);
    console.error(error?.message ?? error);
  }
}
if (failed > 0) {
  console.error(`\n${failed}/${tests.length} failed`);
  process.exit(1);
}
console.log(`\nall ${tests.length} style suites passed`);
