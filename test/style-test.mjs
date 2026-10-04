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
 * The sheet region is the concatenated `css + themeCss + rowCss + chartCss +
 * quotaCss` literal block, so a class named only inside a CSS comment does NOT
 * count as used.
 */

import assert from "node:assert/strict";
import fs from "node:fs";

// R0: the sheets live in src/client/css.js — the source of truth. The class
// corpus is every client module; the esbuild bundle no longer carries the
// comment markers these anchors rely on, so the lock reads source, while the
// parse/init-order tests below keep auditing the served artifact itself.
const clientDir = new URL("../src/client/", import.meta.url);
const moduleText = (name) => fs.readFileSync(new URL(name, clientDir), "utf8");
const cssSource = moduleText("css.js");
const CSS_START = cssSource.indexOf("const css = `");
const CSS_END = cssSource.indexOf("const cssTagId");
assert.ok(CSS_START > 0 && CSS_END > CSS_START, "the stylesheet region must be found in src/client/css.js");
const cssText = cssSource.slice(CSS_START, CSS_END);
const corpusFiles = fs.readdirSync(clientDir).filter((f) => f.endsWith(".js"));
const corpus = new Map(corpusFiles.map((f) => [f, f === "css.js" ? cssSource.slice(0, CSS_START) + cssSource.slice(CSS_END) : moduleText(f)]));
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
  "dp_accentCustom", "dp_consRecon", "dp_hourWrap", "dp_zoomReset",
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
        return { useState: () => [], useEffect: () => {}, useMemo: (fn) => fn(), useRef: () => ({}), useSyncExternalStore: () => null };
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
    for (const m of text.matchAll(/import\s*\{([^}]*)\}\s*from/g)) {
      for (const part of m[1].split(",")) {
        const id = part.trim().split(/\s+as\s+/)[0].trim();
        if (id !== "") names.add(id);
      }
    }
    return names;
  };
  const localBinding = (text, name) => new RegExp(`\\b(?:const|let|var|function)\\s+${name}\\b`).test(text);
  // String-literal contents are not code references (locale dict values
  // like `"Input"` would otherwise masquerade as adapter imports).
  const stripStrings = (t) => t.replace(/"(?:[^"\\\n]|\\.)*"/g, '""').replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
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
