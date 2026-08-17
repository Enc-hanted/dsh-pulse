# dsh-pulse

**Cross-session usage & cost observatory for [dsh](https://github.com/deepseek-ai/deepseek-harness)** — the first thing everyone wants from a new agent harness: *what did it actually cost me?*

`dsh-pulse` folds every session in your corpus (live + persisted) into per-session
usage records and renders them in the web UI:

- **用量走势** — the trend panel picks its chart from the range: **今天**
  renders an intraday **hourly line chart** (cache read on the left axis;
  uncached input and output sharing the right axis, so 95%+ cache hit rates
  never squash the small series), **7d / 30d** render stacked daily bars,
  **90d / 1y** render a GitHub-style daily heatmap (weekday rows, month
  labels, intensity scale, today outlined, hover detail line) inside the same
  framed plot area as the bars, and a **custom date range** (up to 30 days) is
  served window-exact by the host (`?from=&to=`)
- **项目 / 模型过滤器** — two searchable dropdowns (embedded filter input)
  restrict the whole dashboard to one workspace and/or one model; the model
  filter flows through every figure, cost included
- **缓存命中率** — donut gauge with hit/read and uncached-input/output detail;
  cache-write tokens count as misses, so providers that report them (pi-ai)
  cannot inflate the rate
- **模型分布 / 项目排行** — share bars and a ranked table per model & workspace
  (row cap comes from the `topProjects` config, not a hardcoded slice)
- **费用估算** — built-in official per-model rates (see below); unmatched
  models are reported honestly as unpriced tokens; the `/pulse` command card
  prints the estimate too. A second-level pricing page (Settings → 用量观测台 →
  定价与费用) lists the models you configured in the Models settings page and
  asks only for rates and currency — CNY or USD, unified into one CNY total
  through a single editable exchange rate
- **费用走势 / 按模型费用** — a chip-sized cost sparkline (daily totals with
  the peak-hours portion as a second thin line, CNY; hover any point for the
  day's split, plus the official 官方扣费 overlay once balance history
  exists) right after the cost chip, splitting the row with it, and a
  per-model cost line in the model breakdown; both re-price instantly with
  the dashboard's project/model filters
- **官方余额** — the DeepSeek open-platform balance (total, granted/topped-up
  split, availability, manual refresh) from the host's own stored key; see
  [Official balance](#official-balance)

## Quick start

1. Install into your profile and restart `dsh web` (see [Install](#install)).
2. Open the web UI → **Settings → Usage Pulse** for the dashboard; type
   `/pulse` in any conversation for the text summary card (no tokens spent —
   commands never reach the model); the sidebar foot button opens the
   floating panel.
3. Optional: Settings → 用量观测台 → 定价与费用 edits per-model rates, peak
   hours and the USD→CNY rate. With a stored `DEEPSEEK_API_KEY` (the web
   Models page) the dashboard additionally shows the official balance and,
   after a day of snapshots, the 官方扣费 reconciliation line.

Four surfaces, one data source (`GET /pulse/stats`, same-origin JSON):

| Surface | Slot |
|---|---|
| `/pulse` chat command with a dashboard card | `conversation.chat.commandview` (key `pulse`) |
| Settings page "Usage Pulse" | `settings.section` |
| Sidebar foot action → floating panel | `sidebar.footer.action` + `shell.overlay` |

Everything runs on the **UI plane**: no model-visible tools, no prompt surface,
zero tokens spent. The host half registers one incremental projection unit; the
browser half is a hand-written, zero-build client bundle (plain JS +
`react`/`dsh-client-ui-primitives` platform seeds) that registers through the
public slot system.

## Architecture

The host half rides the harness's **session-projection seam** instead of
re-reading logs on demand:

- `pulseUsage` is a projection unit registered on `ctx.sessionProjections`
  (key `pulseUsage`, state version 4). The registry drives its `apply` over
  every committed event of every live session and keeps a watermark cache warm,
  so the route reads O(1) snapshots. Per-hour, per-model detail is kept for
  the most recent three days only (`HOURS_RETENTION_DAYS`) and pruned as newer
  events arrive, so the hourly chart has a data source without bloating the
  state or the persisted checkpoints. When a model's peak hours change in the
  settings, the unit re-registers at a bumped state version: persisted cache
  rows stop matching and every session re-folds from its log on the next read,
  so history reprices correctly (price-only edits never trigger a replay).
- Cold (persisted) sessions go through `ctx.sessionProjectionCache`
  (`coldSnapshot`) — the persisted-cache read ladder: a cached checkpoint row
  plus a persistence tail read on the happy path, never a full-log load.
  Both services ship in the web profile's base/web-app bundles; the plugin
  needs no extra composition rows.
- `/pulse/stats?from=YYYY-MM-DD&to=YYYY-MM-DD` slices each session's per-day
  maps to the requested window (1–1095 days, `?days=N` still accepted for
  backward compatibility) and serves schema-3 JSON. Concurrent requests for
  the same window share one in-flight fold and a short TTL cache (15s) serves
  recently folded windows again, so tab switches and duplicate dashboard
  mounts stay cheap. The cache is generation-stamped: a fold that started
  before a settings change can never land its stale payload after the
  invalidation. Folds run to completion even when the requester disconnects —
  an aborted HTTP wait must never truncate a fold, or the TTL cache would
  serve a partial window to the next reader. One unreadable session is
  skipped, never fatal.
- The browser half owns all views: ranges, custom dates, the project/model
  filters, the heatmap and the hourly chart are pure client-side folds over
  the same records — switching views costs no extra aggregation. All mounted
  surfaces share one stats store (one fetch, abort-safe, race-free), and the
  last four fetched windows stay in a freshness-capped (60s) client payload
  cache: returning to a recently viewed range renders instantly while a
  background fetch refreshes it. A payload whose window doesn't match the
  toolbar's selection (the in-between state of a switch) renders the loading
  treatment — the previous window's numbers are never shown under the new
  range's label. Opening the settings page, the command card and the overlay
  together triggers a single request.

Fold semantics (documented on the unit itself):

- **tokens** come from `assistant/message` usage — the harness's disjoint
  `TokenUsage` fields (uncached input, cache read, cache write, output),
  folded per day, per model, and — for the most recent three days — per hour
  and per model (`hoursByDay`, the hourly chart's source).
- **turns** count distinct turns carrying at least one closed step
  (`step/end`, first-party `dsh-session-stats` parity); rejected/empty turns
  are uncounted. **tool calls** count `tool/call` events.
- events without a timestamp are not day-attributed; unknown event types and
  malformed fields are skipped, never thrown.

## Install

`dsh plugin --profile <name>` forwards to pnpm inside the profile directory
and reconciles `dsh.profile.bundles` automatically (any installed dependency
whose package declares `dsh.bundle.patch` joins the layer stack). Profiles
are pnpm workspace roots, so `add` needs `-w`:

```bash
# from the npm registry
dsh plugin --profile web add -w dsh-pulse

# from a packed tarball (pnpm pack, no publishing involved)
dsh plugin --profile web add -w /abs/path/to/dsh-pulse-0.3.0.tgz

# from a source checkout (development)
dsh plugin --profile web add -w link:/abs/path/to/dsh-pulse

# from git
dsh plugin --profile web add -w git+https://github.com/Enc-hanted/dsh-pulse

# …or manually: add "dsh-pulse": "link:/abs/path/to/dsh-pulse" to
# ~/.dsh/profiles/web/package.json dependencies, then pnpm install
# inside the profile directory.
```

Then restart `dsh web` (adding the plugin hot-loads; editing its code
requires a restart).

**Rolling upgrades:** the browser bundle is served from disk while the host
half lives in the running process, so a page refresh can briefly pair the new
client with an old host. The client therefore accepts both payload schemas:
schema 3 (window-exact `from`/`to`) and schema 2 (today-anchored `days`
window, scalar turns) — views clamp to the window the older host actually
served instead of erroring. Restart the host to regain window-exact ranges.

## Compatibility

Verified against **@deepseek-ai/dsh `0.1.0-rc.6`** (npx, 2026-08-17) on
Windows with fnm Node 24.14.1 — dsh itself requires **Node ≥ 22.15**
(`node:zlib` zstd). Required host services: `commands`, `sessionQuery`,
`webServer`, `sessionProjections`, `sessionProjectionCache`, `sessions`.
Optional, auto-detected: `llm` (model catalog for the pricing editor),
`settings` (persisted pricing), `credentials` + the official balance route,
`storageDomain` (balance snapshot history). Older hosts without
`tiersByDay` (schema 2) still render; costs then price at off-peak rates.

## Uninstall

```bash
dsh plugin --profile web remove -w dsh-pulse
```

The bundle reconciliation drops it from `dsh.profile.bundles` on the next
boot. Optional leftovers, all safe to delete: the `pulse` section in
`~/.dsh/settings.yaml` (your pricing rules), and
`~/.dsh/storages/pulse_balance.json` (rolling balance snapshots). No
secrets are ever stored by this plugin.

## Cost model

Rates are **CNY per million tokens**, defaults built in from the official
price page — https://api-docs.deepseek.com/zh-cn/quick_start/pricing/
(checked 2026-08-17). DeepSeek bills by **peak/off-peak windows** (Beijing
time **09:00–12:00** and **14:00–18:00** are peak; every other hour is
off-peak at half the peak rate), effective 2026-08-17:

| model | tier | uncached input | cache-hit input | output |
|---|---|---|---|---|
| deepseek-v4-flash | peak | 3 | 0.1 | 9 |
| deepseek-v4-flash | off-peak | 1.5 | 0.05 | 4.5 |
| deepseek-v4-pro | peak | 9 | 0.3 | 27 |
| deepseek-v4-pro | off-peak | 4.5 | 0.15 | 13.5 |

The projection splits every usage event into its Beijing-time tier (fixed
UTC+8 offset — host-timezone independent), and the estimate is, per model,
`offpeak(uncachedInput × input + cacheRead × cacheRead + output × output)`
plus the same sum at the `peak` rates, where `uncachedInput = input +
cacheWrite`. A rule without a `peak` block is flat (both tiers at the listed
rates); a rule without `cacheRead` falls back to its `input` rate; records
without a tier split (pre-upgrade hosts) price wholly at the off-peak rates.
Peak hours default to the official windows and can be customized per rule
(`peakHours`, hour granularity, Beijing time) — for providers that bill their
own windows; an explicitly empty `peakHours: []` means "no peak hours",
i.e. flat pricing even when peak rates are set. Models without a rule are
shown separately as unpriced — nothing is silently guessed. Estimates
display at sensible precision (two decimals, or three significant digits
below one unit).

**Currency:** every rule prices in **CNY** (default) or **USD**; USD-priced
models convert through one configurable rate (`usdToCny`, default 6.8,
editable in the pricing page) so the total is always a single CNY sum —
mixed-currency dashboards stay meaningful without per-row bookkeeping. The
conversion is a manual rate by design: this is an estimator, not accounting.
Set `costEnabled: false` to hide the cost chip and the command's cost line
while keeping every other figure.

## Official balance

`GET /pulse/balance` queries the DeepSeek open platform
(`GET /user/balance`) **with the key the host already stores** — resolved
per request through the credentials seam (the same `DEEPSEEK_API_KEY` the
web Models page writes; the `llm-deepseek` settings namespace's `apiKeyEnv`
/ `baseURL` overrides are honored). Zero new configuration, zero new secret
storage:

- the key never leaves the host process: it lives only in one outbound
  `Authorization` header, is re-resolved on every actual fetch (per the
  seam's per-operation contract), and never appears in a response, a log
  line, or an error — failures map to generic cause codes (`ENOTFOUND`,
  `HTTP 401`, …);
- the parsed reply (money only) is cached 60 s server-side; `?refresh=1`
  bypasses it (the card's refresh button);
- responses carry `cache-control: no-store` and outbound requests refuse
  redirects (`redirect: "error"`);
- unconfigured (no credentials service / no stored key) or unreachable →
  the dashboard card hides itself or shows the generic failure with a retry.

**对账 (reconciliation):** every successful query records one
`{t, total}` snapshot — money totals only — in a rolling 30-day
storage-domain global (`pulse_balance`, capped at 1000 entries,
5-minute dedupe). `/pulse/stats` folds these into `balanceSeries`:
per-day official spend = the balance entering the day minus the balance
leaving it. Days with a balance increase (a top-up masks the spend), days
without a prior snapshot, and days past the newest snapshot are `null` —
unknown, never a silently clamped zero. The cost sparkline draws this as a
third thin line (官方扣费) beside the local estimate, so systematic rate
drift is visible at a glance; the same key used by other tools inflates it
(it is that key's spend, not only this harness's).

## Pricing page

Settings → 用量观测台 opens on the dashboard; the header's **定价与费用**
button (and the cost chip's "not set / unpriced" notes) flip to the pricing
editor — an internal second level, so no shell navigation is involved and
every fresh open lands on the dashboard. The sidebar overlay and the `/pulse`
command card stay view-only.

- **Model rows come from the Models settings page** — the harness's live
  model catalog, read through the `llm` service and served with the settings.
  Each row shows the model id and display name (grouped by provider) and asks
  only for rates: off-peak input / cache-hit / output per million tokens,
  plus a CNY/USD selector. Official DeepSeek rates are prefilled.
- **峰谷计价** expands a row to its peak rates and a 24-hour strip: click
  hour cells to mark peak hours (Beijing time; highlighted = peak), with the
  official 09:00–12:00 / 14:00–18:00 windows as the default, a one-click
  reset, and every cell deselected = flat. Saving a peak-hour change tells
  you so and re-folds history server-side — in the background, so the next
  refresh reads warm caches instead of paying the replay.
- **汇率** — one USD→CNY field (default 6.8); the preview line re-prices the
  loaded window (90 days when opened fresh) with your unsaved edits before
  you commit.
- **恢复官方价** resets one official model's row to the untouched baseline;
  duplicate model ids and invalid numbers are refused at save.
- Fallback rows cover everything else: models with usage (a 90-day window —
  not just the dashboard's 7) but no catalog entry (removed from the Models
  page — their history still prices), saved rules matching neither, and a
  manual add for pre-pricing models you have not configured yet. Without an
  `llm` service the whole editor runs on these. **刷新目录** re-reads the
  model catalog while preserving your unsaved edits.
- **启用费用估算** switches the cost chip and the `/pulse` command cost line
  off entirely; completely empty rows are never persisted.

Saves persist through the harness settings service (`$DSH_HOME/settings.yaml`,
`pulse:` section), apply immediately (the stats payload cache is invalidated),
and survive restarts. The composition entry stays the settings `base` layer:
an edited value overrides it, and **恢复内置默认** clears the user section back
to the composition config and the official defaults. The page edits the
*effective* list (official defaults merged in), so what you see is what gets
billed. Without a settings service the page renders read-only and the
composition config stays authoritative.

Override per profile in `cordis.patch.yml`:

```yaml
- insert:
    - id: pulse
      name: 'dsh-pulse'
      config:
        defaultDays: 30   # window served when the client sends none
        topProjects: 8    # ranked-project row cap
        projectDepth: 1   # path segments in a project label (1..3)
        costEnabled: true # false hides the cost chip and command cost line
        usdToCny: 6.8     # USD→CNY rate for the unified CNY total
        pricing:          # overrides the built-in defaults per model
          - model: deepseek-v4-pro
            input: 4.5
            cacheRead: 0.15
            output: 13.5
            peak:         # peak-hour rates (defaults to the official windows)
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

`projectDepth` controls how the session working directory becomes a project
label: `1` keeps the basename (default), `2` keeps `parent/name`, and so on
up to 3 — useful when two directories share a name. Deepening the label
re-groups existing data; it does not lose any.

## Develop

```bash
node test/aggregate-test.mjs          # host-side fold, hour detail, windowing, slicing
node test/view-test.mjs               # client-side view model, hourly series, heatmap
node test/mirror-test.mjs             # bundle mirror stays in sync with src/view.js
node test/host-test.mjs               # mounted host half over stubbed services
node scripts/sync-mirror.mjs          # regenerate the mirror after src/view.js edits
```

The client bundle mirrors `src/view.js` (a dsh client half is a single
self-registering file with no node-side requires): edit `src/view.js`, run
`scripts/sync-mirror.mjs`, and `test/mirror-test.mjs` fails on drift.

## Verify

```bash
node test/aggregate-test.mjs && node test/view-test.mjs && node test/mirror-test.mjs && node test/host-test.mjs
dsh web --dump-config | grep pulse    # row composed into the profile
curl 'http://127.0.0.1:3080/pulse/stats?from=2026-08-01&to=2026-08-14' | head -c 400
```

## Design notes

- **Incremental, not on-demand** — the projection registry folds events as
  they commit; the route never re-folds. Cold sessions come from the
  persisted projection cache, whose rows are fold shortcuts, never
  authorities (stale rows cost a tail replay, never a wrong number).
- **Window-exact serving** — the host slices per-day maps to the requested
  `from`/`to`, so payloads stay small and every custom range is real, not
  clipped to a today-anchored window.
- **Slot-only UI** — no slot owned by the shell is replaced; every registration
  is additive (`list`/`keyed` entries), so the plugin cannot break core UI and
  unloads cleanly (every host registration is a fiber effect).
- **Theme tokens only** — all colors are `--dsw-alias-*` variables; light/dark
  follows the shell for free (native date/select controls included, via
  `color-scheme`). The heatmap intensity scale and the softer segmented
  active state are `color-mix` tints of `--dsw-alias-state-business-primary`
  with plain-token fallbacks.
- **Charts without dependencies** — bars, the intraday line chart, gauges and
  heatmap cells are div+CSS with one inline SVG per plot (responsive without
  measurement); the ring is one SVG circle.
- **Lazy by default** — the dashboard opens on the 7-day window, fetches only
  the requested range, renders from the client payload cache while a
  background fetch refreshes, and the host's TTL + in-flight caches keep
  repeated windows cheap.
- `src/view.js` is mirrored into the browser bundle by
  `scripts/sync-mirror.mjs` and both copies are covered by the tests.

MIT — see [LICENSE](./LICENSE).
