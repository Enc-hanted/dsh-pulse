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
  prints the estimate too

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
  (key `pulseUsage`, state version 2). The registry drives its `apply` over
  every committed event of every live session and keeps a watermark cache warm,
  so the route reads O(1) snapshots. Per-hour, per-model detail is kept for
  the most recent three days only (`HOURS_RETENTION_DAYS`) and pruned as newer
  events arrive, so the hourly chart has a data source without bloating the
  state or the persisted checkpoints.
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
  mounts stay cheap. One unreadable session is skipped, never fatal.
- The browser half owns all views: ranges, custom dates, the project/model
  filters, the heatmap and the hourly chart are pure client-side folds over
  the same records — switching views costs no extra aggregation. All mounted
  surfaces share one stats store (one fetch, abort-safe, race-free), and the
  last four fetched windows stay in a client payload cache: returning to a
  recently viewed range renders instantly while a background fetch refreshes
  it. Opening the settings page, the command card and the overlay together
  triggers a single request.

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

```bash
dsh plugin --profile web add --workspace /abs/path/to/dsh-pulse
# …or manually: add "dsh-pulse": "link:/abs/path/to/dsh-pulse" to
# ~/.dsh/profiles/web/package.json dependencies (the dsh.bundle.patch
# declaration puts it into the bundles list automatically), then pnpm install
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

## Cost model

Rates are **CNY per million tokens**, defaults built in from the official
price page — https://api-docs.deepseek.com/zh-cn/quick_start/pricing/
(checked 2026-08-14):

| model | uncached input | cache-hit input | output |
|---|---|---|---|
| deepseek-v4-flash | 1 | 0.02 | 2 |
| deepseek-v4-pro | 3 | 0.025 | 6 |

Estimate = `uncachedInput × input + cacheRead × cacheRead + output × output`
per model, where `uncachedInput = input + cacheWrite`. A rule without
`cacheRead` falls back to its `input` rate. Models without a rule are shown
separately as unpriced — nothing is silently guessed. Estimates display at
sensible precision (two decimals, or three significant digits below one
unit). If rules mix currencies, the first configured rule's currency labels
the sum — keep one currency per dashboard for meaningful totals.
DeepSeek's announced peak/off-peak pricing is not modeled yet; the estimate
uses the standard rates.

Override per profile in `cordis.patch.yml`:

```yaml
- insert:
    - id: pulse
      name: 'dsh-pulse'
      config:
        defaultDays: 30   # window served when the client sends none
        topProjects: 8    # ranked-project row cap
        projectDepth: 1   # path segments in a project label (1..3)
        pricing:          # overrides the built-in defaults per model
          - model: deepseek-v4-pro
            input: 3
            cacheRead: 0.025
            output: 6
            currency: CNY
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
