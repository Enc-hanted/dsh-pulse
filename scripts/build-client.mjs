/**
 * Build lib/client.js: bundle the ES modules in src/client/ with esbuild
 * (CommonJS output so the host's injected `require` serves the externals),
 * then wrap the result in the factory envelope the loader contract expects.
 *
 *   node scripts/build-client.mjs
 *
 * `npm test` runs this first, so the committed artifact is always fresh.
 *
 * @module dsh-pulse/scripts/build-client
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// The manifest's dsh.client.external is THE declaration of which host
// module-table names this bundle consumes; esbuild's external list derives
// from it so the two cannot drift. react-dom joins here — the factory
// envelope requires it directly (portal capability), so it belongs on the
// list even though no inner module imports it.
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const external = [...new Set([...(manifest.dsh?.client?.external ?? []), "react-dom"])];

const result = await esbuild.build({
  entryPoints: [join(root, "src", "client", "main.js")],
  bundle: true,
  format: "cjs",
  platform: "browser",
  target: "es2022",
  // Everything the host's module table serves; the envelope's factory-scoped
  // `require` resolves them at activation time (see the dsh.client contract).
  external,
  write: false,
  logLevel: "warning",
});
const inner = result.outputFiles[0].text;

/** The factory envelope: the loader calls factory(require); esbuild's CJS
 *  output lands inside that scope, so its external `require` calls hit the
 *  host's module table. The optional store engine (absent on older hosts)
 *  is required here, before any module code, and bridged through a global. */
const out = `window.__ModuleLoader__.load({
\tid: "dsh-pulse",
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
\t\tlet hostStore = null;
\t\ttry { hostStore = require("@deepseek-ai/dsh-client-store"); } catch { /* old module table */ }
\t\tlet reactDom = null;
\t\ttry { reactDom = require("react-dom"); } catch { /* portal-less fallback */ }
\t\tglobalThis.__dshPulseHost = { defineStore: hostStore?.defineStore ?? null, createSnapshotStore: hostStore?.createSnapshotStore ?? null, reactDom };
${inner}
\t\treturn module.exports;
\t}
});
`;

writeFileSync(join(root, "lib", "client.js"), out, "utf8");
const hash = createHash("sha256").update(out).digest("hex").slice(0, 16);
console.log(`build-client: lib/client.js written (${out.length} bytes, sha256:${hash}…, esbuild bundle)`);
