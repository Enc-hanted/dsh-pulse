# Development

[简体中文](../DEVELOPMENT.md) · **English**

dsh-pulse is plain ES modules with JSDoc types: no build step for the host side, one esbuild pass for the browser bundle.

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
npm test            # build first, then all eleven suites in series
npm run typecheck   # the checkJs pass CI gates on (noEmit)
npm run build       # esbuild rebuilds lib/client.js (entry src/client/main.js)
npm run build:types # tsc generates types/ from JSDoc (declaration-only)
```

`npm test` runs `npm run build` first, so a committed `lib/client.js` is never stale relative to `src/client/` after a green run. The bundle must be committed: the package ships no build step at install time, so rebuild and commit it whenever the client side changes.

## Test map

| suite | guards |
| --- | --- |
| `test/host-test.mjs` | host registration, settings generations, projection seam stub + guardrail B, HTTP routes, update-check |
| `test/aggregate-test.mjs` | the session fold and its state schema, per-day tool histogram, window slicing |
| `test/view-test.mjs` | derived view: buckets, model/project breakdown, pricing, reconciliation, quota estimates, anomaly fixtures |
| `test/card-test.mjs` | the data-card contract: seed validation, the change preview's leaf diff, runtime apply repricing and fact republish, restore-to-seed |
| `test/quota-adapters-test.mjs` | quota SPI and the card's declarative specs: recorded fixture/replay (`test/fixtures/quota/`) |
| `packages/dsh-pulse-usage-query/test/shape-test.mjs` | `usage_query` response whitelist and string-length bounds |
| `test/client-smoke-test.mjs` | runs the dashboard's derived-model hooks for real under react stubs, catching scope accidents a bundler misses |
| `test/tui-test.mjs` | terminal scene rendering and interaction; the `pulse-tui` row in `cordis.patch.yml` must inject `commands` |
| `test/golden-test.mjs` | TUI/web consistency: the same fixture through `viewSlice` and `buildView` must yield the same tokens and money |
| `test/style-test.mjs` | the CSS/JSX class lock (both directions) + locale/copy discipline (banned advisory words on `anomaly.*`) |
| `test/manifest-test.mjs` | version stamp agreement, one `/` menu row, no host patch, seat ledger, locale/icon contract, seams must be peers, no tests in the published file list |

CI (`.github/workflows/test.yml`) runs `npm ci → npm run typecheck → npm test` on ubuntu-latest and windows-latest (Node 22.19).

## Repository layout

```
src/index.js          host plugin: projection unit, HTTP routes, settings, startup seam log
src/aggregate.js      the fold: session logs → per-session records → pulseUsage state
src/view/             pure derived data: build-view, pricing engine, reconciliation, quota estimates, anomaly
src/pricing/          data card ratecard.json + validation card-schema.js + diff/pull card.js + storage store.js + HTTP routes routes.js + service index.js
src/pricing-facts.js  runtime derive of the card's facts (schedules, peak hours, holidays, per-call fees)
src/quota-adapters/   quota SPI: spec-engine.js parses the card's declarative provider specs, types.js contract
src/balance-service.js  official-balance outbound query
src/quota-service.js    subscription-quota outbound query
src/http-helpers.js   shared guards and helpers: same-origin, refuse redirects, loopback http, request body reading (readBody)
src/client/           web UI source (esbuild → lib/client.js)
src/tui/              terminal face: scene, data, draw, strip
src/host/             schemastery config schema and pricing config
lib/client.js         committed client bundle (rebuilt by npm run build)
types/                generated declarations (npm run build:types)
types-shims/          type shims for the few Node/peer modules off the dependency tree
locale/               zh/en copy dictionaries (en.json / zh.json)
test/                 suites and fixtures
packages/             the optional usage_query companion package
scripts/              build-client.mjs, record-quota-fixture.mjs
```

The data card's field semantics and constraints: [RATECARD](./RATECARD.md).

## Types

Source is JavaScript with JSDoc; `tsc` reads it with `checkJs` and emits declarations only into `types/` (`src/client/` is excluded — bundled separately). `types-shims/` fills in the few Node/peer module types off the dependency tree. `typecheck` (noEmit) is the CI gate; clear a type error by narrowing the JSDoc or a local cast, never by widening the whole file.

## Code conventions

- JSDoc (public contracts, `@param`/`@returns`) is always English; paragraph-level design notes may be Chinese.
- Comments describing an old mechanism are deleted with the mechanism, never stacked beside new code.
- Client copy follows the shell's language; `anomaly.*` stays strictly observational (numbers and identifiers, no advice), enforced by `style-test`.
- Host seams are peers, never dependencies (why: [Compatibility](./COMPATIBILITY.md)). A new `@deepseek-ai/*` must be a pure library on the allowlist or go to `peerDependencies`, else `manifest-test` fails.
- No new outbound request kinds: balance, quota, the manual update check and the manual data-card pull are the complete list.
- No model-visible tool in a default-mounted package; such capabilities ship as a separate opt-in package.

## Extension points (for plugin authors)

On 0.1.7+ hosts the dashboard is a **Component Factory**: `pulse.dashboard` (scope `root`, locale `dsh-pulse`, with a **store seat**) declaring three `list` child slots:

| slot | rendered |
| --- | --- |
| `pulse.dashboard.chip` | KPI tiles after the built-in chips |
| `pulse.dashboard.filter` | controls after the project/model pickers in the toolbar |
| `pulse.dashboard.panel` | after the built-in panels (only in a view whose data has loaded non-empty) |

Injection:

```js
ctx.slots.inject("pulse.dashboard.panel", () => ctx.slots.register({
  name: "pulse.dashboard.panel", id: "my-panel",
}, MyPanel));
```

Entries receive the factory locale's `t` and the **store seat**: `useStore((s) => s)` selects `{data, view, busy}` and stays live across range switches and refolds, with `actions.sync(data, view, busy)` for write-back; the render site also passes `{data, view, busy}` as a same-frame snapshot. Panels are supervised individually: a crashing panel is reported and removes itself without taking the dashboard down.

Any plugin can mount the whole dashboard elsewhere with `renderFactorySlot("pulse.dashboard", { … })`, accepting the optional `floatActions` / `headerExtra` / `onConfigure` / `focusSession` props, with `fallback` supported. On hosts without the Factory API the plugin renders everything directly and the extension points stay dormant.

The plugin also contributes to the shell's own seats (degrading when absent, warning once): `plugins.row.config` (the full pricing editor on the bundle's detail page), `plugins.detail.badge` / `plugins.detail.section` (the detail page's tag and intro card), `settings.general.item` (the sidebar balance indicator as a native toggle on the General settings page; needs the store engine, hidden on older hosts).

## Companion package

`packages/dsh-pulse-usage-query` is an opt-in package adding one read-only, model-visible `usage_query` tool over the same aggregates. **It is not mounted by default and the main package never mounts it**: the user must insert its row into the profile patch. The exact row, response shape and shape-test guarantee (no conversation content, bounded strings): [its README](https://github.com/Enc-hanted/dsh-pulse/blob/main/packages/dsh-pulse-usage-query/README.md).

## Release checklist

1. Bump `version` in `package.json` and `DP_BUILD` in `src/client/css.js` together; `manifest-test` fails if they drift.
2. Write the `CHANGELOG.md` entry (Added / Changed / Fixed; engineering changes go under Changed; plus upgrade notes).
3. `npm ci && npm run typecheck && npm test`; this also rebuilds `lib/client.js`; commit it with the version bump.
4. `npm pack --dry-run` and check the file list: no `test/`, no `scripts/`; `docs/`, `locale/`, `assets/icon.svg`, `assets/shots/`, `CHANGELOG.md` and `cordis.patch.yml` present.
5. Commit, tag `v<version>`, push the commit and the tag.
6. `npm publish` if this is a registry release.
7. Reinstall into the profiles you use (`dsh plugin --profile web add -w dsh-pulse@latest` for registry, or re-run the link/tarball `add`) and restart the hosts; for the terminal face install the same version into the dsh-tui profile and restart it too.
8. Verify in both hosts: the web panel opens with data; `/pulse` responds; the plugin manager shows the localized title/description and the blue icon.