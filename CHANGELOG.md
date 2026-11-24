# Changelog

Releases are cut by git tag; this file lists the notable changes per release. The user-facing overview is in the [README](README.md); host-generation notes are in [Compatibility](docs/en/COMPATIBILITY.md).

## v0.6.2 — 2026-11-24

### Added

- **Data card override**: export, import or pull the official price card (schema 3: effective-dated prices, holidays, peak hours, per-call fee windows, declarative provider query specs). The settings panel previews every change; apply is always manual. Pull source defaults to jsDelivr (`pricingCardSource`).
- **Display currency**: `displayCurrency` converts all displayed amounts at a single point, and CSV export follows. Official rules keep their published currency.
- **Declarative quota specs (SPI v2)**: the zai / kimi / minimax adapters are now card specs parsed by `spec-engine.js`, plus a new OpenCode Go spec. The settings page probes routes (`POST /pulse/quota/probe`) and accepts custom specs (`quotaSpecs`); quota windows gain a `usd` unit family.
- **Quick display redo**: one source selector (`footSource`) and two footer styles. Classic is the 0.6.1 face (still the default, no data traffic). Data adds a utilization ring / peak sun-moon icon, the source name (full or brand `short` by row width), unitless today tokens, a hover tip with windows, reset countdowns and fees, a <50%-share suggestion, and a self-drawn float for hosts without the official Float.

### Changed

- **Stats refresh on every surface**: `/pulse/stats` polls on the balance cadence (visible tab, refetch on re-visible) through one landing path; subagent sessions count like any other.
- **Range switches use stale-while-revalidate**: the old window dims under a “Loading…” status bar (failures get Retry) while the toolbar stays interactive; the blank skeleton is for the first mount only.
- **Range folds reuse projections**: `/pulse/stats` lists the corpus once and shares persisted projections across windows for the payload TTL; the first range pays the fold, the next ones within 15 s are near-instant.
- **Settings overlay shows the full section**: back, pricing and compare are reachable; × resets the remembered view only on the overlay.
- **`/pulse` hand-off keeps its window**: auto-focus announces itself with a one-click “See all”; an invoked session the remembered window cannot see falls back to the default 7 days.
- **Footer shows today's tokens as figures**: today's tokens drop the unit (“Today 689k”), and `fmtTokens` folds a meaningless `.0` (689k / 2M; 830.4k keeps its decimal).
- **Hardened writes and outbound requests**: settings / probe / card-write POSTs share one same-origin guard; pulls and update checks refuse redirects; provider specs refuse clear-text non-loopback http; card applies take a `base` concurrency guard (409 `card-changed`); validation errors name the field; previews diff provider specs leaf by leaf; a card that changes provider `routes` / `hosts` / `auth` / `envKeys` lists its credential-routing rows apart and applies only after an explicit acknowledgement (422 `credential-routing-changed` otherwise).
- **`pricing` marked volatile**: pricing saves no longer bounce off the 0.2.x settings seam.
- **Settings page uses one UI language**: write-through currency block, Tag badges, noun titles with one-line hints, one “Saved” toast.
- **Search fee window**: ¥0.005/call applies 2026-11-01 → 11-18 12:00 Beijing only; server-side search bills tokens afterwards (official announcement).
- **Single card-change entry path**: one `afterCardChange` sequence replaces four hand copies; shared guards live in `http-helpers.js`; the TUI quick-reader moved to a neutral module.

### Fixed

- **Remounted `/pulse` card hijacked the stats window**: a remounted transcript card now reads through the footer's window hook and never touches the store.
- **Range switches showed the previous window under the new label**: the stale-payload guard tested `schema === 3` against schema-4 payloads and never fired.
- **Pricing page saved against a stale revision**: any other panel's write made the next save bounce 409; writes now read the live revision and retry once.
- **USD config inflated official estimates**: the global currency re-labelled CNY rates without converting.
- **Forked sessions re-billed their parent's history**: a seeded session (a fork, or a subagent spawned from the parent's history) opens with a copy of the parent's events, and the fold counted every copy; four such subagents in one evening read 3.5× the provider's bill. The fold now skips the inherited prefix on every read path (stats, session timeline, TUI). Persisted rows re-fold once on load, so earlier days correct themselves.

## v0.6.1 — 2026-10-19

### Added

- **Anomaly watch**: observational burn-spike and tool-loop fingerprints in the payload (`anomalies`); no new storage, no timers.
- **Versioned rate card**: official prices moved to `src/pricing/ratecard.json`; the manual update check reports its version.
- **Quota adapter SPI**: provider detection / request building / parsing separated, with recorded fixture replay and a sanitizing recorder.
- **Optional `dsh-pulse-usage-query`**: one read-only `usage_query` tool; not mounted by default.
- **Manager metadata, type declarations, seam log, guardrails**: localized title/description and a brand icon; `.d.ts` with typecheck as a CI gate; the boot line prints seam versions; a seam-shape mismatch turns `/pulse/stats` into a 503.

### Changed

- **Host floor is the 0.2.x family**: `>=0.2.0-rc.2 <0.3` (prerelease-inclusive); 0.1.x retired. See [Compatibility](docs/en/COMPATIBILITY.md).
- **Seam packages are peers**: the host serves its own copies; one projection shape registered instead of arity duck-typing.
- **Docs split from the README**; release hygiene: trimmed `files`, committed lockfile, CI on ubuntu + windows.

### Fixed

- dsh-tui command injection (all six commands silently failed), the wide-terminal `renderCalendar` crash, and the plugin-manager `meta` metadata wrapper.

### Upgrading from 0.6.0

- Re-add the plugin per profile and restart; no data migration. dsh-tui kernels must be 0.2.x; 0.1.x unsupported.

## Earlier releases

Release notes for v0.6.0 and earlier live in the git tags; host-generation adaptation notes are in [docs/en/COMPATIBILITY.md](docs/en/COMPATIBILITY.md#historical-generation-notes).