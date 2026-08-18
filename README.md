# dsh-pulse

**English** | [简体中文](./README.zh-CN.md)

Per-session usage and cost observatory for [dsh](https://github.com/deepseek-ai/deepseek-harness). Aggregates token usage across all sessions, estimates cost from built-in DeepSeek rates, and shows the official platform balance. Everything runs on the UI plane: no model-visible tools, zero tokens spent.

## Features

- **Usage trend**: hourly line chart for today, daily bars for 7/30 days, GitHub-style heatmap for 90 days/1 year, custom date ranges up to 30 days
- **Project / model filters**: two searchable dropdowns restrict the whole dashboard to one workspace and/or one model
- **Cache hit rate**: donut gauge with hit/read and uncached input/output detail; cache-write counts as a miss
- **Model distribution / project ranking**: share bars and a ranked table
- **Cost estimate**: per-model rates with peak/off-peak tiers; models without a rule are listed as unpriced
- **Cost trend**: daily sparkline, with the official balance reconciliation line overlaid after a day of snapshots
- **Official balance**: DeepSeek platform balance, queried with the key the host already stores, manual refresh included

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

# from a packed tarball
dsh plugin --profile web add -w /abs/path/to/dsh-pulse-0.4.0.tgz

# from a source checkout (development)
dsh plugin --profile web add -w link:/abs/path/to/dsh-pulse

# from git
dsh plugin --profile web add -w git+https://github.com/Enc-hanted/dsh-pulse
```

…or add `"dsh-pulse": "link:/abs/path/to/dsh-pulse"` to `~/.dsh/profiles/web/package.json` and run `pnpm install` there. Restart `dsh web` afterwards (adding the plugin hot-loads; editing its code requires a restart).

```bash
dsh plugin --profile web remove -w dsh-pulse
```

The next boot drops it from `dsh.profile.bundles`. Leftovers, safe to delete: the `pulse` section in `~/.dsh/settings.yaml` and `~/.dsh/storages/pulse_balance.json`. The plugin never stores secrets.

## Cost model

Rates are **CNY per million tokens**; defaults are built in from the official price page (https://api-docs.deepseek.com/zh-cn/quick_start/pricing/, checked 2026-08-17). DeepSeek bills by peak/off-peak windows: Beijing time **09:00–12:00** and **14:00–18:00** are peak; all other hours are off-peak at half the peak rate.

| model | tier | uncached input | cache-hit input | output |
|---|---|---|---|---|
| deepseek-v4-flash | peak | 3 | 0.1 | 9 |
| deepseek-v4-flash | off-peak | 1.5 | 0.05 | 4.5 |
| deepseek-v4-pro | peak | 9 | 0.3 | 27 |
| deepseek-v4-pro | off-peak | 4.5 | 0.15 | 13.5 |

Rules: a rule without a `peak` block is flat; without `cacheRead` it falls back to its `input` rate; records without a tier split (pre-upgrade hosts) price wholly at off-peak rates. Peak hours default to the official windows and can be customized per rule (`peakHours`, hour granularity, Beijing time); `peakHours: []` means flat even when peak rates are set. Models without a rule are shown separately as unpriced. The estimate counts `uncachedInput = input + cacheWrite` per tier.

Currency: rules price in **CNY** (default) or **USD**; USD-priced models convert through one configurable rate (`usdToCny`, default 6.8, editable in the pricing page), so the total is always a single CNY sum. The conversion is a manual rate by design: this is an estimator, not accounting. `costEnabled: false` hides the cost figures while keeping every other number.

## Configuration

**Settings → Usage Pulse → Pricing & cost** edits the rates. Model rows come from the Models settings page with official DeepSeek rates prefilled; each row takes off-peak input / cache-hit / output rates, a CNY/USD selector, and a 24-hour peak strip (Beijing time, official windows by default, all deselected = flat). The exchange-rate field re-prices the loaded window with your unsaved edits. **Official rates** resets a row to the baseline; **Refresh catalog** re-reads the model catalog; **Enable cost estimates** turns cost figures off entirely. Fallback rows cover models with usage but no catalog entry, saved rules matching neither, and a manual add for the rest; without the `llm` service the editor runs on these rows alone.

**Compare plans** (Settings → Usage Pulse → Compare plans) prices a usage scenario (total input, output/input ratio, cache hit rate) against the effective pricing rules (official defaults included), so rate edits show up here automatically. Temporary plans can be added; every plan can be shown or hidden. The scenario can be taken from the real usage window, or set by hand.

**Display settings** (Settings → Usage Pulse → Display settings) toggle each dashboard panel and the sidebar balance indicator. The **monthly budget** card on the dashboard takes a CNY budget and shows month-to-date spend, a progress bar and a run-rate month-end forecast; the balance bar shows how many days the balance lasts at the recent spend rate. All local preferences.

Saves go to `$DSH_HOME/settings.yaml` (`pulse:` section), apply immediately, and survive restarts. **Restore defaults** clears the user section back to the composition config and the official defaults. Without a settings service the page is read-only.

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
```

`projectDepth` controls how the session working directory becomes a project label: `1` keeps the basename (default), `2` keeps `parent/name`, and so on up to 3. Deepening the label re-groups existing data; nothing is lost.

## Official balance

`GET /pulse/balance` queries the DeepSeek open platform with the key the host already stores, resolved per request through the credentials seam. Zero new configuration, zero new secret storage: the key never leaves the host process (it appears only in one outbound `Authorization` header), failures map to generic cause codes, replies are cached 60 s server-side (`?refresh=1` bypasses), responses carry `cache-control: no-store`, and outbound requests refuse redirects. Unconfigured or unreachable, the card hides itself or shows a retry.

Every successful query records one `{t, total}` snapshot, money only, in a rolling 30-day storage (`pulse_balance`, capped at 1000 entries, 5-minute dedupe). Per-day official spend is derived from the balance series; days where it can't be known (a top-up masks the spend, no prior snapshot, past the newest snapshot) are `null`. The cost sparkline draws this as a third line. Note that it is that key's total spend: if other tools share the key, it includes them.

## Compatibility

Verified against **@deepseek-ai/dsh 0.1.0-rc.6** (2026-08-17, Windows, Node 24.14.1); dsh requires **Node ≥ 22.15**. Required host services: `commands`, `sessionQuery`, `webServer`, `sessionProjections`, `sessionProjectionCache`, `sessions`. Optional, auto-detected: `llm`, `settings`, `credentials`, `storageDomain`. Hosts without `tiersByDay` (schema 2) still render, with costs priced at off-peak rates. During rolling upgrades the client accepts both payload schemas, so a page refresh against an old host keeps working; restart the host to regain window-exact ranges.

## Development

```bash
node test/aggregate-test.mjs && node test/view-test.mjs && node test/mirror-test.mjs && node test/host-test.mjs
node scripts/sync-mirror.mjs   # regenerate the bundle mirror after editing src/view.js
dsh web --dump-config | grep pulse
curl 'http://127.0.0.1:3080/pulse/stats?from=2026-08-01&to=2026-08-14' | head -c 400
```

In short: the host half is a session projection unit (`pulseUsage`) that folds usage per day/model/hour as events commit, reads cold sessions from the persisted projection cache, and serves window-exact slices from `GET /pulse/stats` (concurrent requests share one in-flight fold, cached 15 s). The browser half is a zero-build client bundle (plain JS + `react`/`dsh-client-ui-primitives`) registered through public slots (`conversation.chat.commandview`, `settings.section`, `sidebar.footer.action` + `shell.overlay`); all mounted surfaces share one stats store. Charts are dependency-free div+CSS with one inline SVG per plot; the heatmap and hourly chart are pure client-side folds. `src/view.js` is mirrored into the bundle by `scripts/sync-mirror.mjs`, and the mirror test fails on drift.

MIT — see [LICENSE](./LICENSE).
