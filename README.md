# dsh-pulse

**English** | [简体中文](./README.zh-CN.md)

Per-session usage and cost observatory for [dsh](https://github.com/deepseek-ai/deepseek-harness). Aggregates token usage across all sessions, estimates cost from built-in DeepSeek rates, and shows the official platform balance. Everything runs on the UI plane: no model-visible tools, zero tokens spent.

## Features

- **Panel structure**: the two first-row KPI cards (cache-ring gauge, cost sparkline) are the view tabs — click the ring for the usage trend, click the cost card for the cost trend; the grip in the card row's bottom-right corner resizes that row's height only, double-click restores it, and the preference stays browser-local
- **Usage trend**: hourly line chart for today, daily bars for 7/30 days, GitHub-style heatmap for 90 days/1 year, custom date ranges up to 30 days. The bar chart drills two levels: click a day to sweep that day full width by model, click a model for its input/cache/output token split, then click empty space or press Esc to unwind one level at a time
- **Project / model filters**: two searchable dropdowns restrict the whole dashboard to one workspace and/or one model
- **Cross-provider model distinction**: models are labeled as `provider · display name` from the Models config; the provider prefix appears only when several providers serve the same-named model, otherwise just the name. Selecting a third-party (non-official) model hides the official balance; an unpriced third-party model also hides the cost estimate and the monthly budget
- **Model distribution / project ranking**: share bars and a ranked table
- **Session detail & subagent attribution**: sessions grouped by project, with a subagent subtotal (count / tokens / cost) and every session's own break analysis — expand a session, click its cumulative-consumption curve to place up to three breaks, and read per-segment tokens and cost at second accuracy (a task's research / thinking / summary stages)
- **Cost estimate**: per-model rates priced by the official tier schedule, including the off-peak/peak epochs from 2025-08-17; models without a rule are listed as unpriced
- **Cost trend**: daily sparkline, with the official balance reconciliation line overlaid after a day of snapshots
- **Status bar**: official balance, runway in days, window activity (sessions / turns / tool calls) and the update clock, queried with the key the host already stores and refreshable by hand; clicking it expands the merged cost-estimate + monthly-budget panel
- **CSV export**: one click in the dashboard header downloads the loaded window as a UTF-8 CSV daily table — tokens, cache-hit rate, tier-aware cost and official spend per day, plus a totals row (opens directly in Excel)
- **Panel-relative sizing**: card and plot heights derive from the panel's own width (`aspect-ratio` plus min/max bounds), so they never follow the browser window; themes cover light / dark / pink / orange with a custom accent, and the build stamp beside the title (`0.5.0`) tells you which revision is rendering

## Quick start

```bash
dsh plugin --profile web add -w dsh-pulse
```

Restart `dsh web`, then open **Settings → Usage Pulse**. In any conversation, `/pulse` prints a text summary (commands never reach the model); the sidebar foot button opens the floating panel. All surfaces share one data source, `GET /pulse/stats`.

With a stored `DEEPSEEK_API_KEY`, the dashboard also shows the official balance and, after a day of snapshots, the reconciliation line.

## Install / Uninstall

`dsh plugin --profile <name>` runs pnpm inside the profile directory and reconciles `dsh.profile.bundles` automatically. Profiles are pnpm workspace roots, hence the `-w`:

```bash
# from the npm registry
dsh plugin --profile web add -w dsh-pulse

# from a packed tarball (the published version is 0.5.0)
dsh plugin --profile web add -w /abs/path/to/dsh-pulse-0.5.0.tgz

# from a source checkout (development)
dsh plugin --profile web add -w link:/abs/path/to/dsh-pulse

# from git
dsh plugin --profile web add -w git+https://github.com/Enc-hanted/dsh-pulse
```

…or add `"dsh-pulse": "link:/abs/path/to/dsh-pulse"` to `~/.dsh/profiles/web/package.json` and run `pnpm install` there. Restart `dsh web` afterwards (adding the plugin hot-loads; an edited bundle is republished by the host's watcher, and the build stamp beside the panel title says which revision the page is running — hard-reload the page if it lags).

```bash
dsh plugin --profile web remove -w dsh-pulse
```

The next boot drops it from `dsh.profile.bundles`. Leftovers, safe to delete: the `pulse` section in `~/.dsh/settings.yaml` (hosts up to 0.1.6) or the `pulse` row in the active profile patch (0.1.7+ hosts store settings there), and `~/.dsh/storages/pulse_balance.json`. The plugin never stores secrets.

## Cost model

Rates are **CNY per million tokens**; defaults are built in from the official price page (https://api-docs.deepseek.com/zh-cn/quick_start/pricing/, checked 2026-09-18). DeepSeek bills by peak/off-peak windows: Beijing time **09:00–12:00** and **14:00–18:00**, **Monday to Friday only** — every other hour, including the whole weekend, is off-peak at half the peak rate.

| model | tier | uncached input | cache-hit input | output |
|---|---|---|---|---|
| deepseek-flash | peak | 2 | 0.04 | 8 |
| deepseek-flash | off-peak | 1 | 0.02 | 4 |
| deepseek-v4-pro | peak | 9 | 0.3 | 27 |
| deepseek-v4-pro | off-peak | 4.5 | 0.15 | 13.5 |

`deepseek-v4-flash` and `deepseek-v4-flash-vision-exp` are retired ids: the platform still accepts them and serves them as DeepSeek-V4.1-Flash at Flash rates, so this plugin prices those events at the Flash tier instead of listing a second, stale rate row. A provider-scoped rule always prices exactly the id it names.

A rule's peak hours are weekdays-only by default. Setting `weekdaysOnly: false` on a rule bills its `peakHours` on every day of the week; an explicit empty `peakHours` list still means flat pricing.

Rules can be provider-scoped: a `provider` holds the route id and prices only that provider's same-named model (exact match wins); left empty, the rule prices the model id from any provider (the official defaults work this way). So a reseller serving `deepseek-v4-flash` can be priced separately without touching the official channel.

A provider can be marked **monthly-paid** as a whole (`monthlyProviders`, toggled per provider group in the pricing page): its models need no rates and price at zero marginal cost (configured, never "unpriced").

Currency: rules price in **CNY** (default) or **USD**; USD-priced models convert through one configurable rate (`usdToCny`, default 6.8, editable in the pricing page), so the total is always a single CNY sum. The conversion is a manual rate by design: this is an estimator, not accounting. `costEnabled: false` hides the cost figures while keeping every other number.

## Configuration

**Settings → Usage Pulse → Pricing & cost** edits the rates. Rows come **only from the Models settings page's configured models** (no manual add/delete), with official DeepSeek rates auto-filled; each row takes off-peak input / cache-hit / output rates, a CNY/USD selector, and a 24-hour peak strip (Beijing time, official windows by default, all deselected = flat). **Only rows you edited are saved** — untouched models keep inheriting the official wildcard defaults, so official rate changes reach them automatically, and **Official rates** clears a row back to that untouched state. Each provider group header has a **Monthly** toggle that collapses its rows' rate inputs. The exchange-rate field re-prices the loaded window with your unsaved edits. **Refresh catalog** re-reads the model catalog; **Enable cost estimates** turns cost figures off entirely. Without the `llm` service there are no rows to edit.

**Compare plans** (Settings → Usage Pulse → Compare plans) prices a usage scenario (total input, output/input ratio, cache hit rate) against the effective pricing rules (official defaults included), so rate edits show up here automatically. Temporary plans can be added; every plan can be shown or hidden. The scenario can be taken from the real usage window, or set by hand.

**Display settings** (Settings → Usage Pulse → Display settings) toggle each dashboard panel (including the **session detail** panel) and the sidebar balance indicator, and pick a **color theme** — *blue* (the original look), *pink*, *orange* or *B&W*. Every palette carries its own light and dark variant and follows the shell's theme automatically. The **monthly budget** card on the dashboard takes a CNY budget and shows month-to-date spend, a progress bar and a run-rate month-end forecast; the balance bar shows how many days the balance lasts at the recent spend rate. All local preferences.

Saves apply immediately and survive restarts. On hosts up to 0.1.6 they go to `$DSH_HOME/settings.yaml` (`pulse:` section, user layer over the composition base); on 0.1.7+ hosts the plugin writes the `pulse` entry's config in the active profile patch through the settings service, under a read-revision guard — a save that races another window is refused (HTTP 409) and the editor refreshes itself for a clean retry. Display fields (rate, currency, budget toggles) are declared *volatile*, so editing them does not restart the plugin; editing a rule's peak hours re-folds history once. **Restore defaults** clears the user section back to the composition config and the official defaults. Without a settings service the page is read-only.

Profile overrides in `cordis.patch.yml`:

```yaml
- insert:
    - id: pulse
      name: 'dsh-pulse'
      config:
        defaultDays: 30   # window served when the client sends none
        topProjects: 8    # ranked-project row cap
        projectDepth: 1   # path segments in a project label (1..3)
        costEnabled: true # false hides the cost figures
        usdToCny: 6.8     # USD→CNY rate for the unified CNY total
        monthlyProviders: []   # flat-subscription provider route ids; their models price at 0
        pricing:          # overrides the built-in defaults per model
          - model: deepseek-v4-pro
            input: 4.5
            cacheRead: 0.15
            output: 13.5
            peak:         # peak-hour rates (official windows by default)
              input: 9
              cacheRead: 0.3
              output: 27
            currency: CNY
          - model: third-party-x   # flat USD rule with custom peak hours
            input: 0.5
            output: 2
            currency: USD
            peakHours: [0, 1, 2, 3, 4, 5]   # Beijing-time hours billed at peak
          - model: weekend-peak    # bill those hours on every day of the week
            input: 1
            output: 2
            peak: { input: 2, output: 4 }
            peakHours: [9, 10, 11]
            weekdaysOnly: false
          - provider: pi-ai         # prices only that provider's same-named model
            model: deepseek-v4-flash
            input: 2
            output: 4
```

## Official balance

`GET /pulse/balance` queries the DeepSeek open platform with the key the host already stores, resolved per request through the credentials seam. Zero new configuration, zero new secret storage: the key never leaves the host process (it appears only in one outbound `Authorization` header), failures map to generic cause codes, replies are cached 60 s server-side (`?refresh=1` bypasses), responses carry `cache-control: no-store`, and outbound requests refuse redirects. Unconfigured or unreachable, the card hides itself or shows a retry.

Every successful query records one `{t, total}` snapshot, money only, in a rolling 30-day storage (`pulse_balance`, capped at 1000 entries, 5-minute dedupe). Per-day official spend is derived from the balance series; days where it can't be known (a top-up masks the spend, no prior snapshot, past the newest snapshot) are `null`. The cost sparkline draws this as a third line. Note that it is that key's total spend: if other tools share the key, it includes them.

## Extending the dashboard (for plugin authors)

On 0.1.7+ hosts the dashboard is a **Component Factory** (`pulse.dashboard`, root scope, locale `dsh-pulse`, with a **store seat**) declaring three child slots:

| slot | kind | rendered |
| --- | --- | --- |
| `pulse.dashboard.chip` | `list` | KPI tiles after the built-in chips |
| `pulse.dashboard.filter` | `list` | controls after the project/model pickers in the toolbar |
| `pulse.dashboard.panel` | `list` | panels after the built-in ones, in the loaded non-empty view |

Inject a component:

```js
ctx.slots.inject("pulse.dashboard.panel", () => ctx.slots.register({
  name: "pulse.dashboard.panel", id: "my-panel",
}, MyPanel));
```

Entries receive the factory's `t` (the `dsh-pulse` locale), the **store seat** — `useStore((s) => s)` selects `{data, view, busy}` and stays live across range switches and refolds (the dashboard syncs it on every change), plus `actions.sync(data, view, busy)` for write-back — and the render-site props `{data, view, busy}` as a same-tick snapshot. Panels are supervised individually — a crashing panel is reported and removed without taking the dashboard down. Any plugin can also mount the whole dashboard elsewhere with `renderFactorySlot("pulse.dashboard", { … })` (accepts the optional `floatActions` / `headerExtra` / `onConfigure` dashboard props; a `fallback` option is honored). On hosts without the factory API the plugin renders everything directly and the extension points stay dormant.

## Plugin-manager and settings-page seats

Beyond the dashboard, the plugin contributes to the shell's own seats (all degrade silently when a seat is missing):

- **`plugins.row.config`** keyed `dsh-pulse#pulse` — the full pricing editor rendered on the bundle's Plugins-page detail (`view: "page"`) and a one-line summary in the rows list (`view: "summary"`).
- **`plugins.detail.badge` / `plugins.detail.section`** — a tag beside the detail title and an intro card under the page content.
- **`settings.general.item`** id `pulse-foot-balance` — the sidebar-balance indicator as a native General-settings toggle, wired to the same preference store as the panels page (requires the store engine; hidden on older hosts).

## Compatibility

Verified against **@deepseek-ai/dsh 0.1.5-rc.3 and 0.1.7-alpha.2** (Windows, Node 24.14.1); dsh requires **Node ≥ 22.15**. One build serves every generation — the seams are detected at runtime:

- **Projection registration**: the 0.1.2-rc host reads `stateSchema` + `wire`, older hosts (0.1.0-rc.x) read the legacy top-level `schema`/`view` pair.
- **Persisted cache**: on 0.1.2-rc and later the plugin drives the consumer-owned ladder itself (zero-I/O `cachedSnapshot` — with the explicit cut before 0.1.7, header-only identity after — otherwise `sessionQuery.readSession` + the synchronous `coldSnapshot(meta, inheritedEventCount, events)`), while pre-0.1.2-rc hosts keep the cache's self-reading async `coldSnapshot(id)` (detected by arity).
- **Settings**: classic hosts register a per-plugin namespace on the `SettingsProvider`; 0.1.7+ hosts write the entry's config through `SettingsForms` under revision checks (stale writes get HTTP 409). Display fields are declared volatile, so those edits never restart the plugin.
- **Client**: the 0.1.7 icon rename (`IconXOutline16` → `IconXOutlineMedium`) is bridged, and the dashboard factory registers only where `slots.registerFactory` exists. Hosts without hourly tier details still render, with costs priced at off-peak rates.
- **0.1.7-only seats**: the store engine (`dsh-client-store`) is required via a feature-detected, try-caught lookup — without it the store seats, the General-settings toggle and the live footer sync drop out while the plain dashboard keeps working. The plugin-manager seats (`plugins.row.config`, `plugins.detail.badge`, `plugins.detail.section`) and every factory registration refuse alone, so a host that rejects one unknown slot never takes down the rest of the registration batch.

The stats payload is **schema 4**: schema 3 plus `corpusSessions` (how many sessions exist outside the window, which is what separates "nothing recorded yet" from "nothing in this range"). The client reads schemas 2–4, so a host and a browser bundle from different releases keep working through an upgrade.

## Development

```bash
node test/aggregate-test.mjs && node test/view-test.mjs && node test/mirror-test.mjs && node test/host-test.mjs
node scripts/sync-mirror.mjs   # regenerate the bundle mirror after editing src/view.js
```

Special thanks to the [Linux Do](https://linux.do/) community.

MIT — see [LICENSE](./LICENSE).
