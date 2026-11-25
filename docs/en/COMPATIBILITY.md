# Compatibility notes

[简体中文](../COMPATIBILITY.md) · **English**

dsh-pulse is one build for every supported dsh generation: host capabilities are probed at runtime, and a missing seat degrades only itself.

- [Support matrix](#support-matrix)
- [How the floor is evaluated](#how-the-floor-is-evaluated)
- [Runtime degradation](#runtime-degradation)
- [Guardrails](#guardrails)
- [Terminal face (dsh-tui)](#terminal-face-dsh-tui)
- [Historical generation notes](#historical-generation-notes)

## Support matrix

| Component | Supported | Notes |
| --- | --- | --- |
| dsh host | `>=0.2.0-rc.2 <0.3` | the whole 0.2.x family, prereleases included; 0.1.x is not supported |
| Node.js | `>=22.19` | |
| Web frontend | full panel + session overlay | the client side declares `platform: "web"` |
| dsh-tui (optional) | `>=0.13.0 <0.17`, verified on 0.16.1 | a separate third-party terminal frontend, installed on its own |
| Session data from | Web / dsh-tui / headless / ACP | usage counting is frontend-agnostic |

The stats payload is mutually readable across projection schemas 2–4, so a host and a browser bundle from mismatched versions keep working through the short window after an upgrade.

Seam packages (`@deepseek-ai/dsh-credentials`, `@deepseek-ai/dsh-storage-domain`) are **peer dependencies**, never direct dependencies: the host resolves linked-root modules by intercepting the peer list, so a private copy inside the plugin would silently shadow the host's own seam (the 0.1.7-inside-a-0.2.1-host skew). The startup log prints `dsh-pulse <version> on seams dsh-credentials <version> / dsh-storage-domain <version>` so a version skew is visible without dissecting `node_modules`.

## How the floor is evaluated

`engines.dsh` decides on its own when present: dsh's plugin compatibility check (`dsh-app-boot`) evaluates `satisfies(version, range, { includePrerelease: true })`, and if the plugin declares `engines.dsh` that verdict alone decides; peer ranges are ignored. Older kernels that predate `engines.dsh` check peer ranges only. Both paths are satisfied by declaring `>=0.2.0-rc.2 <0.3` everywhere, which is why a single floor covers hosts running 0.2.0-rc.2, 0.2.1-rc.2 and 0.2.1-alpha.5.

> **Why not a single point floor?** A floor of `>=0.2.1-alpha.5` made the dsh-tui kernel (0.2.0-rc.2 at the time) reject the whole bundle with `skipping profile bundle "dsh-pulse"`. web and dsh-tui are two different kernels; the floor must describe the family, not one running copy.

## Runtime degradation

On hosts that lack a service, the corresponding surface steps down instead of failing:

- **Store engine** (`dsh-client-store`): loaded by feature detection and try/catch; without it the live sidebar sync, the settings-page seat and the store-backed dashboard are retired, while the ordinary dashboard keeps working.
- **Settings generations**: the plugin probes by structure: a classic `SettingsProvider` (any `register` with arity ≥ 2, including the first-generation `register/describe/update` shape) or the 0.1.7+ `SettingsForms` edition. Classic hosts write an independent namespace; 0.1.7+ hosts address the plugin entry and carry a version guard (stale writes return HTTP 409).
- **Projection cache generations**: since 0.1.7 the plugin registers one projection shape and reads the consumer ladder itself: `coldSnapshot(meta, inheritedEventCount, events)` while rebuilding, the zero-I/O `cachedSnapshot` row when a session was never seeded. A shape that does not match fails a startup assertion and turns `/pulse/stats` into a 503 instead of silently serving an empty dashboard. Events below `inheritedEventCount` are the prefix a forked session copied from its parent; the fold skips them and the usage stays with the parent (`session/title` is the one exception, as a display name), on the session timeline and in the TUI as well. A subagent's own `subagent/descriptor` sits one event above the cut in every stored log, so a forked subagent names itself by that label and never by the parent title it inherited.
- **Timeline link**: the “Open in Timeline” link of the Collaboration panel goes through the host's `sidebarRight.openTabIn` and exists only once both `sidebarRight` and `sidebarRightTabs` are in the client context and the `timeline` tab type is registered; the link renders on the on-screen session's row only (the host does nothing for any other session).
- **Data-card storage**: an imported or pulled override card lives in the host's `storageDomain`: an unreadable or invalid stored card falls back to the bundled card with one boot-log line, and `/pulse/stats` keeps answering; without a storage facility the override applies for the session only. Pull sources must be http(s), with http accepted on loopback only.
- **Plugin-manager and settings seats**: each factory registration and each shell seat is rejected independently; a host refusing one unknown slot never breaks the others.
- **Client seats**: extensions are registered per seat with a warn-once fallback; a crashing third-party dashboard panel removes only itself.

## Guardrails

Two assertions turn a seam change into an explicit failure instead of an empty dashboard:

- **Guardrail B**: the startup shape assertion: `coldSnapshot` arity must be ≥ 3 and `cachedSnapshot` arity 2; otherwise the plugin logs the mismatch and `/pulse/stats` returns 503 (the UI shows a failure state rather than a silently empty panel).
- **Guardrail C**: a test against the *real* `SessionProjectionCache` prototype: the stub used by the host test cannot silently drift from the installed seam package.

## Terminal face (dsh-tui)

The same package mounts as terminal face `dsh-pulse/tui` inside [dsh-tui](https://github.com/ccch1mneyyy/dsh-TUI), sharing the fold, pricing and configuration data with the web face. dsh-tui is installed separately; skip this section if you don't use it.

**Six commands** (the input box's `/` menu):

| command | what it opens |
| --- | --- |
| `/pulse` | toggles the mini card (same as alt+p) |
| `/pulse-day` | today's day view: breadcrumb + summary + hourly gantt + session ledger (`s` switches the sort) |
| `/pulse-month` | this month's calendar heat + weekly trend + model breakdown |
| `/pulse-year` | the last year as a 53-week heatmap |
| `/pulse-cost` | today's cost view (`t` toggles cost/token inside the scene) |
| `/pulse-sessions` | the session switcher (type-to-filter + two-step confirm) |

**Mini card**: a 3-row-capped card above the input box (pointer-only, never takes the keyboard). The today row splits ● current session / ○ the rest (today's slice, never lifetime totals), the month row carries a log-scaled sparkline, and the unpriced share becomes a ⚠ row; click the card body to enter the full view, `×` collapses it. **Esc** unwinds the full scene level by level (day → month → year), and the top-level Esc returns to chat; `?` help, `e` CSV export, `r` force refresh.

**Degradations**: when host seams are absent it steps down level by level: a refused admission makes `/pulse` open the full day view directly via the C-070 `commands.register` fallback; an absent scene service renders a red failure line in the panel and exits quietly. One `falling back to direct commands.register (C-070, unattributed)` line in the boot log is expected behavior, not a fault. Since host 0.2.0 no longer exposes session activity timestamps, a persisted session appended by another process is not refolded automatically; press `r` in the scene to refresh manually.

**Diagnostics**: the host command `/plugins check <dsh-pulse path>` statically validates the package (it should report `compatible`); the environment variable `PULSE_TUI_DEBUG=1` makes the plugin emit one stderr diagnostic line (seam visibility) at plugin load.

## Historical generation notes

**v0.6.0+ supports only dsh ≥ 0.2.0-rc.2 (Node ≥ 22.19); the 0.1.x line is retired.** v0.4.4 and earlier were verified on 0.1.5-rc.3 with plain classic registration; the v0.4.5 generation heuristic mis-routed the 0.1.5–0.1.6 classic line, and v0.6.0 replaced it with structural probing. The essentials:

- **Projection and cache**: since 0.1.2-rc the plugin walks the consumer ladder itself — the zero-I/O `cachedSnapshot` row for unseeded sessions (explicit cut before 0.1.7, header identity after), otherwise `readSession` + synchronous `coldSnapshot`; older hosts use the cache's own async `coldSnapshot(id)` (identified by arity).
- **Settings**: both generations are probed by structure — a classic `SettingsProvider` (`register` arity ≥ 2) writes an independent namespace; 0.1.7+ hosts address the entry id with a version guard (stale writes 409). The host settings page consumes the plugin's schemastery `Config` directly, so field-level validation belongs to the host; the plugin's own floating settings page validates drafts by hand, deliberately.
- **Client**: the 0.1.7 icon rename is bridged; the dashboard factory registers only where `slots.registerFactory` exists; without the store engine the live sync retires while the ordinary dashboard keeps working.
- The legacy package-root `dsh-plugin.json` was removed in v0.6.1; it was never consumed by a supported mounting path; the C-070 fallback is the expected path.

