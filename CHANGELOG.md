# Changelog

Releases are cut by git tag. This file lists notable changes per release; the user-facing overview lives in the [README](README.md), and host-generation history in [Compatibility notes](docs/en/COMPATIBILITY.md).

## v0.6.1 — 2026-10-19

### Added

- **Anomaly watch panel** — strictly observational signals derived on the fly from the records the fold already produces: daily burn-rate spikes (a day above 3× the P95 of the previous 7 days, with a 20k-token floor) and loop fingerprints (one tool called ≥25 times in a day while that day burns ≥4× the session's median day). The stats payload gains an `anomalies` block; no new storage, no timers. UI copy is locked to numbers and identifiers by the style suite.
- **Versioned rate card and a UI-free pricing service** — official peak/off-peak rates moved into `src/pricing/ratecard.json` (version 1) behind `src/pricing/`, so a price change is a versioned data change rather than an edit buried in the UI. The manual update-check response reports the rate-card version.
- **Subscription-quota adapter SPI** — `src/quota-adapters/` separates provider detection, request building and response parsing (zai / kimi / minimax) from the query orchestration. Recorded fixture/replay cases and a sanitizing manual recorder (`scripts/record-quota-fixture.mjs`) make parser changes testable without live accounts.
- **Optional `dsh-pulse-usage-query` package** — one read-only, model-visible `usage_query` tool over the same aggregates. It is not mounted by default and the main package still registers zero tools; see [its README](https://github.com/Enc-hanted/dsh-pulse/blob/main/packages/dsh-pulse-usage-query/README.md).
- **Display metadata** — `locale/en.json` / `locale/zh.json` (`meta.title` / `meta.description`) and the `./icon` export, so the plugin manager shows a localized name and description instead of the English package copy, and a blue icon instead of a black glyph.
- **Type declarations** — `.d.ts` generated from JSDoc, with `npm run typecheck` as a CI gate.
- **Startup seam log** — `dsh-pulse <version> on seams dsh-credentials <version> / dsh-storage-domain <version>`, making a host/plugin version skew visible in the boot log.
- **Guardrails B and C** — a startup shape assertion (mismatch is logged and `/pulse/stats` returns 503 instead of a silently empty dashboard) and a test against the real `SessionProjectionCache` prototype.

### Changed

- **The host floor is the 0.2.x family** — `engines.dsh` and both seam peers are `>=0.2.0-rc.2 <0.3` (prerelease-inclusive). The previous single-point floor made the dsh-tui kernel reject the whole bundle: web and dsh-tui are separate kernels, so the floor has to describe the family. See [Compatibility](docs/en/COMPATIBILITY.md).
- **Seam packages are peers** — `@deepseek-ai/dsh-credentials` and `@deepseek-ai/dsh-storage-domain` moved from `dependencies` to `peerDependencies`, so the host's resolver serves its own copies. The projection path registers one supported shape (0.1.7+) instead of arity duck-typing; the per-day tool histogram raises the projection state schema to 11, and older caches refold automatically.
- **Documentation split from the README** — configuration, compatibility and development references moved to `docs/`; the README is now the user-facing overview. Root cleanup: the obsolete `dsh-plugin.json` (last shipped in 0.6.0, unused by any supported mounting path) and the root `screenshots.json` are gone (the screenshot index moved under `assets/shots/`).
- **Release hygiene** — the published `files` list is trimmed to what the plugin requires, `docs/` and `assets/shots/` included for README rendering, the lockfile is committed, CI runs `npm ci` on ubuntu + windows, typecheck runs before the suite, and `manifest-test` enforces the seam-peer rule, the locale/icon contract and "no tests in the published package".

### Fixed

- **`/pulse` command family on dsh-tui** — the `pulse-tui` row now injects `commands`. The C-070 fallback (`commands.register`) needs the service explicitly injected; without it all six commands silently failed to register.
- **Wide-terminal crash** — `renderCalendar` referenced `leftW` outside its destructuring scope (regression since v0.6.0); wide terminals crashed. Fixed and covered by a stub-kit regression test.
- **Plugin manager metadata** — locale files now carry the `meta` wrapper the harness reads; the manager icon uses fixed brand blue (`#4D6BFE`) because a data-URL `<img>` cannot resolve `currentColor` (the old strokes rendered black in dark themes).

### Engineering

- The test chain now runs ten suites: host, aggregate, view, quota adapters, package shape, client smoke, TUI, golden, style and manifest. New suites cover the quota SPI, the guardrail-B seam stub, the real projection-cache prototype, the anomaly fixtures, and the `pulse-tui` patch injection.
- `.github/workflows/test.yml` is the release gate: `npm ci` → `npm run typecheck` → `npm test`, on ubuntu-latest and windows-latest.

### Upgrading from 0.6.0

- Install `0.6.1` into each profile you use (`dsh plugin --profile <name> add -w dsh-pulse@latest`, or re-run your tarball/link `add`) and restart the host. A source-link install shows as `link:` in `dsh plugin list`.
- No data migration: settings keep their location, usage history refolds from session logs, and the shapes of the two private snapshot files are unchanged.
- dsh-tui users: the kernel must be on the 0.2.x family; the same package mounts as the terminal face. One `C-070 … unattributed` line in the boot log is expected — see [Compatibility](docs/en/COMPATIBILITY.md).
- dsh 0.1.x remains unsupported (since 0.6.0).

## Earlier releases

Release notes for v0.6.0 and earlier are available from the git tags. The host-generation adaptation notes that used to live here are in [docs/en/COMPATIBILITY.md](docs/en/COMPATIBILITY.md#historical-generation-notes).
