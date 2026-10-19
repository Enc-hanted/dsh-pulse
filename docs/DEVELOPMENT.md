# Development

dsh-pulse is plain ES modules with JSDoc types — no build step for the host half, one esbuild pass for the browser bundle. This page covers the local loop, the test map, the repository layout, the extension points other plugins can hang onto, and the release checklist.

- [Local loop](#local-loop)
- [Test map](#test-map)
- [Repository layout](#repository-layout)
- [Types](#types)
- [Code conventions](#code-conventions)
- [Extension points (for plugin authors)](#extension-points-for-plugin-authors)
- [Companion package](#companion-package)
- [Release checklist](#release-checklist)

## Local loop

Node ≥ 22.19.

```bash
npm ci              # lockfile is tracked; reproduces the audited tree
npm test            # build + all ten suites
npm run typecheck   # the same checkJs pass CI gates on (noEmit)
npm run build       # rebuild lib/client.js from src/client/ (esbuild)
npm run build:types # regenerate types/ from JSDoc (tsc declaration-only)
```

`npm test` runs `npm run build` first, so a committed `lib/client.js` can never be stale relative to `src/client/` after a green test run. The bundle is committed because the package ships no build step at install time — rebuild and commit it whenever the client half changes.

## Test map

| suite | guards |
| --- | --- |
| `test/host-test.mjs` | host registration, settings generations, projection seam stub + guardrail B, HTTP routes, update-check |
| `test/aggregate-test.mjs` | the session fold and its state schema, per-day tool histogram, window slicing |
| `test/view-test.mjs` | derived view: buckets, model/project breakdown, pricing, reconciliation, quota estimates, anomaly fixtures |
| `test/quota-adapters-test.mjs` | quota SPI plus recorded fixture/replay cases for zai, kimi and minimax |
| `packages/dsh-pulse-usage-query/test/shape-test.mjs` | `usage_query` response whitelist and string-length bounds |
| `test/client-smoke-test.mjs` | executes the dashboard's derived-model hooks for real under react stubs — catches a name left behind in another function's scope, which a bundler cannot |
| `test/tui-test.mjs` | terminal scene rendering and interaction, plus a regression that reads `cordis.patch.yml` (the `pulse-tui` row must inject `commands`) |
| `test/golden-test.mjs` | the TUI/web consistency lock: the same fixture fold goes through both render paths (`viewSlice` and `buildView`) and must produce the same tokens and money, with the one deliberate GA-gap divergence asserted explicitly |
| `test/style-test.mjs` | the CSS/JSX class lock (both directions: a declared class with no markup, a rendered token with no rule) plus locale/copy discipline, including banned advisory words on `anomaly.*` keys |
| `test/manifest-test.mjs` | version stamp vs `package.json`, one `/` menu row, no host patch, seat ledger, locale/icon contract, seam packages must be peers, no tests in the published file list |

CI (`.github/workflows/test.yml`) runs `npm ci`, `npm run typecheck` and `npm test` on both ubuntu-latest and windows-latest.

## Repository layout

```
src/index.js          host plugin: projection unit, HTTP routes, settings, startup seam log
src/aggregate.js      the fold: session logs → per-session records → pulseUsage state
src/view/             pure derived data: build-view, pricing engine, reconciliation, quota estimates, anomaly
src/client/           web UI source (compiled into lib/client.js)
src/tui/              terminal face: scene, data, draw, strip
src/host/             config schema (schemastery) and pricing config
src/pricing/          versioned rate card + the no-UI pricing service
src/quota-adapters/   subscription-quota SPI and the zai / kimi / minimax adapters
lib/client.js         built client bundle (committed; rebuilt by npm run build)
types/                generated declarations (npm run build:types)
locale/               display metadata for the plugin manager (meta.title / meta.description)
test/                 suites and fixtures
packages/             the optional usage_query companion package
```

## Types

Source is JavaScript with JSDoc comments; `tsc` reads them with `checkJs` and emits declarations into `types/` (the client directory is excluded — it is bundled separately). `types-shims/` fills in the few Node/peer module types that are not on the dependency tree. The noEmit `typecheck` script is the CI gate; clear a type error by narrowing the JSDoc or adding a local cast, never by widening the whole file.

## Code conventions

- JSDoc (public contracts, `@param` / `@returns`) is always English; paragraph-level design notes may be in Chinese.
- Comments that describe an old mechanism are deleted together with the mechanism, never stacked beside new code.
- The client copy follows the shell's language; the `anomaly.*` strings stay strictly observational (numbers and identifiers, no advice) and are enforced by `style-test`.
- Host seams are peers, never dependencies. A new `@deepseek-ai/*` dependency must either be a pure library on the allowlist or go to `peerDependencies` — `manifest-test` fails the build otherwise.
- No new outbound request kinds: balance, quota and the manual update check are the complete list.
- No model-visible tool in a default-mounted package. Such capabilities ship as a separate opt-in package.

## Extension points (for plugin authors)

On 0.1.7+ hosts the dashboard is a **Component Factory** (`pulse.dashboard`, root scope, locale `dsh-pulse`, with a **store seat**) declaring three child slots:

| slot | kind | rendered |
| --- | --- | --- |
| `pulse.dashboard.chip` | `list` | KPI tiles after the built-in chips |
| `pulse.dashboard.filter` | `list` | controls after the project/model pickers in the toolbar |
| `pulse.dashboard.panel` | `list` | after the built-in panels (only in a view whose data has loaded non-empty) |

Injection:

```js
ctx.slots.inject("pulse.dashboard.panel", () => ctx.slots.register({
  name: "pulse.dashboard.panel", id: "my-panel",
}, MyPanel));
```

Entries receive the `t` provided by the factory locale, the **store seat** — `useStore((s) => s)` selects `{data, view, busy}` and stays live across range switches and refolds, with `actions.sync(data, view, busy)` for write-back — plus the render-site props `{data, view, busy}` as a same-frame snapshot. Panels are supervised individually: a crashing panel is reported and removes itself without taking the dashboard down. Any plugin can also mount the whole dashboard elsewhere with `renderFactorySlot("pulse.dashboard", { … })` (accepting the optional `floatActions` / `headerExtra` / `onConfigure` props; `fallback` supported). On hosts without the Factory API the plugin renders everything directly and the extension points stay dormant.

Beyond the dashboard, the plugin contributes to the shell's own seats (degrading when absent and warning once in the log): **`plugins.row.config`** — the full pricing editor rendered on the bundle's detail page in the plugin manager; **`plugins.detail.badge` / `plugins.detail.section`** — the detail page's tag and intro card; **`settings.general.item`** — the sidebar balance indicator as a native toggle on the “通用” (General) settings page (needs the store engine; hidden on older hosts).

## Companion package

`packages/dsh-pulse-usage-query` is an opt-in package that adds one read-only, model-visible tool (`usage_query`) over the same aggregates. **It is not mounted by default and the main package never mounts it** — the user must insert its row into the profile patch. See [its README](https://github.com/Enc-hanted/dsh-pulse/blob/main/packages/dsh-pulse-usage-query/README.md) for the exact row, the response shape and the shape-test guarantee (no conversation content, bounded strings).

## Release checklist

1. Bump `version` in `package.json` and `DP_BUILD` in `src/client/css.js` together — `manifest-test` fails if they drift.
2. Write the `CHANGELOG.md` entry (Added / Changed / Fixed / Engineering, plus upgrade notes).
3. `npm ci && npm run typecheck && npm test` — this also rebuilds `lib/client.js`; commit it with the version bump.
4. `npm pack --dry-run` and check the file list: no `test/`, no `scripts/`; `docs/`, `locale/`, `assets/icon.svg`, `assets/shots/`, `CHANGELOG.md` and `cordis.patch.yml` present.
5. Commit, tag `v<version>`, push the commit and the tag.
6. Publish (`npm publish`) if this is a registry release.
7. Reinstall into the profiles you use — `dsh plugin --profile web add -w dsh-pulse@latest` for registry, or re-run the link/tarball `add` — then restart the hosts. For the terminal face, install the same version into the dsh-tui profile and restart it too.
8. Verify in both hosts: web panel opens and shows data; `/pulse` responds; the plugin manager shows the localized title/description and the blue icon.

Author-local harnesses (canvas demo, screenshot matrix, process docs) live in gitignored paths — see `.gitignore`; run them directly with `node` instead of adding npm scripts for them.
