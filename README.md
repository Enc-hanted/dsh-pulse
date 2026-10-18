<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.svg">
  <img src="assets/logo.svg" alt="dsh-pulse" width="240">
</picture>

# dsh-pulse

**English** (default) · [简体中文](./README.zh.md)

**Requirements**: dsh ≥ 0.2.1-alpha.5 · Node ≥ 22.19 · the optional terminal face needs [dsh-tui](https://github.com/ccch1mneyyy/dsh-TUI) ≥ 0.13.0 (a separate project, installed on its own)

**Privacy**: everything stays on this machine — usage is folded from dsh's own session logs. Outbound requests come in exactly three kinds: official-balance queries, subscription-quota queries, and the manual update check.

A usage and cost observatory for [dsh](https://github.com/deepseek-ai/deepseek-harness) sessions: it aggregates token usage across all sessions (live and persisted), estimates cost at the built-in official DeepSeek rates, and shows the official platform balance alongside third-party subscription quotas. Beyond the web panel there is a terminal face: it mounts with dsh-tui and serves the `/pulse` command family (see [Terminal face](#terminal-face-dsh-tui)). Both frontends are pure UI — no model-visible tools, not a single token spent — and **usage data does not care which frontend produced it** either: sessions run from Web, dsh-tui, headless or ACP are all counted.

![Dashboard head canvas: cost estimate, official balance, subscription quota, cache-hit rate](assets/shots/canvas-wide.png)

## Features

- **Usage trends**: an hourly line chart for the single-day window, daily bars for 7 / 30 days, a GitHub-style heatmap for 90 days / 1 year; custom ranges up to 30 days. The bar chart drills two levels: click a day → it sweeps full width by model, click a model → its input / cache / output split; click empty space or press Esc to unwind level by level. Model distribution and project ranking (share bars + ranked table) sit right beside the trend
- **Session detail & break analysis**: sessions grouped by project, each with a subagent subtotal (count / tokens / cost); expand a session and place up to three breaks on its cumulative-consumption curve to read per-segment tokens and cost at second-level accuracy — good for splitting a task into its research / thinking / summary stages
- **Cost & balance**: per-model rates priced on the official peak/off-peak schedule, with the official balance alongside on the same card; expand for the monthly budget and a per-day reconciliation table (official spend / local estimate / gap, drift days in red). **This is an estimator, not accounting**: unpriced models are listed separately, cumulative unpriced tokens under 5k count as rounding noise and render nothing, and past that the card says “有未定价消耗” (some usage unpriced) — click it to jump straight to the pricing page
- **Subscription quota**: monthly subscriptions such as GLM Coding Plan, Kimi For Coding and MiniMax Coding Plan, one provider per row — `5-hour ▮▮ 20%` reads without hovering, the percentage gains a weight step past 70% / 90%, and hovering shows that window's reset moment; the expansion holds the plan name and renewal, burn-rate and exhaustion-moment forecasts, add-on quota such as web tools, and a per-project burn table. Queries can be switched off per provider in settings
- **Cache-hit rate**: the hit-rate ring plus three lines — hit / total input, uncached input, output — and three in-window activity cells (sessions / turns / tool calls)
- **Model colors**: every model gets one fixed color, stable across windows and surfaces; colors too close on the same screen are pulled apart automatically, and the B&W theme sorts them into a lightness ladder to stay readable. The “模型配色” (Model colors) card in Settings → “定价与费用” (Pricing & cost) can pin any model to a color of your own
- **Project / model filters**: projects are a searchable dropdown, models a multi-select; the usage and cost stack legends and the model-distribution rows all click-toggle the same shared filter set. Opening the `/` menu's **pulse** row from a session automatically scopes the overlay's project filter to that session's workspace and pins the current session to the top of the list
- **Compact summary overlay**: the `/` menu's **pulse** row opens the plugin's own overlay — this session's own numbers first, then two concrete questions answered: which models the money went to (share bars + each one's cost) and which sessions ran recently; one button switches in place to the full observatory
- **Adaptive layout & themes**: the three first-row blocks — cost / subscription / cache — rewrap automatically with the panel width and never squeeze on a narrow panel; the full observatory's left edge drags to adjust its width continuously (600–1280px). Themes: blue / pink / orange / B&W, following the shell's light-dark automatically

The cost-estimate block expanded into its per-day reconciliation (≈ marks snapshot-sparse days, red marks drift days):

![Official bill reconciliation: per-day official spend, local estimate and gap](assets/shots/canvas-recon.png)

The subscription-quota block expanded into one panel per provider (5-hour / this-week window bars and their weight tiers):

![Subscription quota expansion: GLM and Kimi 5-hour/weekly window usage](assets/shots/quota-expanded.png)

## Quick start

```bash
dsh plugin --profile web add -w dsh-pulse
```

Restart `dsh web`, then open **Settings → “用量观测台” (Usage Observatory)**. There are three entrances: the button at the sidebar's foot opens the full panel directly; the **pulse** row in any conversation's `/` menu opens the compact overlay scoped to that session's workspace; the full observatory's left edge drags to resize. All entrances share one data source, `GET /pulse/stats`.

If a `DEEPSEEK_API_KEY` is already stored, the dashboard also shows the official balance, and the reconciliation line appears once snapshots have accumulated for a day.

## Install / Uninstall / Update

`dsh plugin --profile <name> <args>` invokes pnpm inside the profile directory (arguments pass through as given) and reconciles `dsh.profile.bundles` automatically. The profile is a pnpm workspace root, hence the `-w` on `add` / `remove`.

```bash
# install — pick one source
dsh plugin --profile web add -w dsh-pulse                              # npm registry
dsh plugin --profile web add -w /abs/path/to/dsh-pulse-0.6.0.tgz      # packed tarball (this repo: 0.6.0)
dsh plugin --profile web add -w link:/abs/path/to/dsh-pulse           # source checkout (development)
dsh plugin --profile web add -w git+https://github.com/Enc-hanted/dsh-pulse

# confirm which version and form is installed (a link shows the link: path)
dsh plugin --profile web list -w dsh-pulse

# update — a registry install pulls the latest published version;
# a tarball / link install is replaced by re-running add
dsh plugin --profile web add -w dsh-pulse@latest

# uninstall
dsh plugin --profile web remove -w dsh-pulse
```

**Restart `dsh web`** after any install, update or uninstall: the host half (the projection unit and HTTP routes) registers at plugin load, so a restart is required; when only the client bundle changed, a full page refresh is enough.

**Update check**: **Settings → “用量观测台” (Usage Observatory) → “关于” (About)** shows the current version, and the “检查更新” (Check for updates) button asks the npm registry once, manually, reporting one of four outcomes: “已是最新” (up to date) / “有新版本” (new version available) / “开发版” (development build) / “检查失败” (check failed). It never checks automatically — no timer, no probe at load time.

Optional leftovers, all safe to delete: the `pulse` section in `~/.dsh/settings.yaml` (hosts up to 0.1.6), the `pulse` row in the active profile patch (0.1.7+ hosts store settings there), and `~/.dsh/storages/pulse_balance.json`. Uninstalling or deleting them **loses no usage history** — see the next section.

## Data & storage

Usage statistics have no plugin-private history cache: **the source of truth is dsh's own session logs**, and every number is folded out at request time.

| Data | Location | Owned by | What deleting it costs |
| --- | --- | --- | --- |
| Raw usage events (each step's tokens and billing basis) | `~/.dsh/sessions/` | dsh | the actual history |
| `pulseUsage` projection cache | `~/.dsh/storages/session_projcache.json` + `session_projcache/` | dsh (the plugin only registers the projection unit) | nothing — it is refolded from the session logs |
| Official-balance snapshots (rolling 30 days, amounts only, never the key) | `~/.dsh/storages/pulse_balance.json` | the plugin's only private durable file | the history of the “官方扣费” (official spend) reconciliation line only |
| Subscription-quota utilization snapshots (rolling 30 days, one percentage point per window) | `~/.dsh/storages/pulse_quota.json` | the burn-rate forecast's history | the burn slope only; it re-accumulates from the next query |
| Rates / FX rate / currency / panel toggles | the profile's settings (`~/.dsh/settings.yaml` or the `pulse` row in the active profile patch) | dsh settings | back to defaults |
| Theme / panels / budget / compare / overlay width | browser localStorage (`dsh-pulse:*`) | the browser | pure preferences, no usage data |

So after uninstalling and reinstalling (even deleting `session_projcache`) the whole usage history is refolded, with no migration needed. The request-level payload cache lives only in the host process's memory (short TTL, emptied by a restart) and likewise holds no history.

## Cost model

Rates are **CNY per million tokens**; the defaults come from the official price page
https://api-docs.deepseek.com/zh-cn/quick_start/pricing/ (checked 2026-09-18).
DeepSeek bills by peak/off-peak windows: Beijing time **09:00–12:00** and **14:00–18:00** are peak, **Mondays to Fridays only**; every other slot (including the whole weekend) is off-peak at half the peak rate.

| model | tier | uncached input | cache-hit input | output |
|---|---|---|---|---|
| deepseek-flash | peak | 2 | 0.04 | 8 |
| deepseek-flash | off-peak | 1 | 0.02 | 4 |
| deepseek-v4-pro | peak | 9 | 0.3 | 27 |
| deepseek-v4-pro | off-peak | 4.5 | 0.15 | 13.5 |

`deepseek-v4-flash` and `deepseek-v4-flash-vision-exp` are retired model ids: the platform still accepts calls to them, but they are actually served by DeepSeek-V4.1-Flash and billed at Flash rates, so this plugin prices those historical events at the Flash tier instead of listing another stale rate row.

The rules can go finer:

- Peak hours apply **on weekdays only** by default; `weekdaysOnly: false` makes a rule's peak hours count every day, and `peakHours: []` still means flat pricing
- Scoped **per provider**: with `provider` set to a provider route id, the rule prices only that provider's same-named model (exact match wins); left empty it covers the model id from every provider — handy for pricing a “reseller also sells deepseek-v4-flash” case separately without touching the official channel
- A provider can be marked **monthly-paid** as a whole (`monthlyProviders`): its models need no rates and cost zero marginal; an optional **monthly fee** (`monthlyFee`) stays out of the pay-per-token estimate and appears only in plan comparison, as a subscription row on the same stage

The official `web_search` and session-title-generation helper LLM calls leave no usage events locally; the observatory counts them exactly from the session logs and folds them into a “辅助调用（估算）” (aux calls, est.) pseudo-model row that enters the model stacks and the cost trend, priced at the official rates in force on the event's day. From 2026-11-01 the platform bills server-side search **per call** (¥0.005 per successful request, effective with the Search/Fetch API opening announcement); the observatory counts it as a known flat term added on top of the shape estimate — the reconciliation gap and the shape self-calibration never absorb it, preserving pure token semantics. Locally the estimate is “1 request = 1 call”, while the real bill counts server-side executions (at most 5 per request) — a factor to verify against the balance once billing goes live. **Shape self-calibration (on by default)**: the official balance series is daily ground truth, and the panel calibrates the aux-call estimate shape against it — a pure function of already-stored data, no new storage, no timers; moved to another deployment, it converges to that deployment's workload on its own. When any of the last 7 complete days shows a reconciliation drift ≥15% **and** ≥¥0.10, the dashboard raises a **reconciliation drift alert** (hover for the per-day comparison); snapshot-sparse days take part in neither learning nor alerting. To freeze the self-calibration, hand-write `searchShape` in the config (keys `miss`/`hit`/`out`).

Currency: every rule prices in **CNY** (default) or **USD**; USD models convert through `usdToCny` (default 6.8, editable in the pricing page), so the total is always a single CNY figure. The conversion is a manual rate by design: this is an estimator, not accounting. `costEnabled: false` hides the cost figures; everything else stays.

## Configuration

**Settings → “用量观测台” (Usage Observatory) → “定价与费用” (Pricing & cost)** edits the rates. Model rows come **only from the model configuration on the Models settings page** (no manual add/delete), with official DeepSeek rates auto-filled; **only the rows you changed are saved** — untouched models keep following the official wildcard defaults, official rate changes reach them automatically, and “恢复官方价” (Official rates) clears a row back to its untouched state. Each row takes off-peak input / cache-hit / output rates, a CNY/USD selector and a 24-hour peak strip (Beijing time, official windows by default, everything deselected = flat). Every provider group header has a “月付费” (Monthly) toggle; the “模型配色” (Model colors) card at the page bottom can pin a custom color on any model or return it to auto. “刷新目录” (Refresh catalog) re-reads the model catalog; “启用费用估算” (Enable cost estimates) turns the cost figures off as a whole.

**“方案对比” (Compare plans)** (Settings → Usage Observatory → Compare plans) compares the estimated cost under each model's rates for an adjustable usage scenario (total input, output ratio, cache-hit rate). Plans come straight from the pricing page's effective rules (official defaults included), so rate edits take effect here automatically; temporary plans can be added for comparison, every plan can be shown or hidden, and the scenario can be taken from a real usage window or set manually.

**“显示设置” (Display settings)** toggles each panel's visibility and the sidebar balance indicator, and picks the **theme** (blue / pink / orange / B&W, each with its own light and dark variant, following the shell automatically). The **“月度预算” (Monthly budget)** card on the dashboard takes a CNY budget and shows this month's spend so far, a progress bar and a month-end forecast extrapolated from the daily average rate. All local preferences.

Saves apply immediately and survive restarts; when a save races another window's, the editor refreshes its local copy automatically for a clean retry. Changes to display fields (FX rate, currency, panel toggles) do not restart the plugin. Without a settings service on the host the page is read-only; without the `llm` service there are no rows to edit.

Per-profile overrides in `cordis.patch.yml`:

```yaml
- insert:
    - id: pulse
      name: 'dsh-pulse'
      config:
        defaultDays: 30   # window served when the client sends none
        topProjects: 8    # ranked-project row cap
        projectDepth: 1   # path segments kept in a project label (1..3)
        costEnabled: true # false hides the cost figures
        usdToCny: 6.8     # USD→CNY rate for the unified CNY total
        monthlyProviders: []   # monthly-subscription provider route ids; their models cost 0
        monthlyFee: {}         # provider route id → monthly fee (CNY/mo), surfaced in plan comparison
        quotaOff: []           # provider route ids with subscription-quota queries switched off
        searchShape: {}        # manual search-call shape {miss, hit, out} (tokens per call); empty = self-calibrating
        pricing:          # per-model overrides of the built-in defaults
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
          - model: weekend-peak    # these hours count as peak every day (weekends included)
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

`GET /pulse/balance` queries the DeepSeek open platform with the key the host already stores: zero new configuration, zero new secret storage, and the key never leaves the host process (it appears in exactly one outbound `Authorization` header); failures map to generic cause codes with an inline retry in the card, and replies are cached 60 s server-side (the panel's refresh button is the forced refresh). Unconfigured, the balance block hides itself as a whole.

Every successful query records one `{t, total}` snapshot (amounts only) into rolling 30-day storage (capped at 1000 entries, 5-minute dedupe). The per-day official spend is derived from the balance series; days where it cannot be derived (a top-up masks the spend, no prior snapshot) are left empty, and the cost trend draws this as a third thin line. Note this is that key's **total spend**: other tools sharing the same key are counted in too.

## Subscription quota

`GET /pulse/quota` queries the remaining quota of **monthly subscriptions** (Coding Plan / Token Plan), with the same security posture as the official balance: credentials resolve per operation and appear in exactly one outbound `Authorization` header; snapshots record only each window's utilization percentage (rolling 30 days, dedupe + cap) — never any key or raw response. Server-cached 60 s.

Built-in adapters (auto-detected from the Models catalog's provider routes, no configuration needed):

| adapter | routes | endpoints | returns |
| --- | --- | --- | --- |
| zai-coding | `zai-coding-cn` / `zai-coding` / `zai` | `/api/monitor/usage/quota/limit` + `/api/biz/subscription/list` on `open.bigmodel.cn` or `api.z.ai` | 5h/weekly token-window percentages, reset moments, web-tool counts, plan name and annual/monthly fee |
| kimi-coding | `kimi-coding` / `kimi` | `api.kimi.com/coding/v1/usages` | weekly/5h request-window percentages (the ratio source reports percentages only and yields no counts) |
| minimax | `minimax` / `minimax-coding` | `api.minimaxi.com/v1/token_plan/remains` | 5h/weekly windows (community-documented, not live-verified) |

Most of these are **internal endpoints without a committed SLA** (the same ones community tools use); every parser is defensive: a missing field degrades to “未知” (unknown) instead of 0%, and failures surface as generic cause codes.

**Estimation honesty** (stated in the panel's small print too): subscription quota comes as percentages only, never absolute token counts. dsh back-solves them — local token consumption on that provider route over the same span ÷ the server's percentage = the estimated total, and the remainder follows. **dsh covers only the traffic this machine runs through it**: when the key is shared with other tools the estimate reads low; treat it as a trend reference, not accounting. The burn-rate forecast is a linear slope over the snapshot series, answering “when does it run out at this rate” and “the projected percentage at reset”.

**Per-project burn**: the provider's local tokens within the window (or this month) are attributed to projects via each session's working directory — each project's tokens and share bar, plus the **monthly-fee apportionment** (plan fee × share; share only when the plan's price is not public). Queries can be switched off per provider in Settings → “显示设置” (Display settings).

## Extending the dashboard (for plugin authors)

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

## Compatibility

One build covers every dsh generation; the seams are detected at runtime: when a required host capability is absent, the corresponding seats degrade automatically (e.g. missing store engine → the live sidebar sync and the settings-page seat retire while the dashboard keeps working), and a crashing extension panel removes only itself and never takes the dashboard down. The client half declares `platform: "web"`, so the Web panel appears only on the Web frontend; **usage data is unaffected by the frontend** — sessions run from any frontend (Web / dsh-tui / headless / ACP) are all counted. The stats payload is mutually readable across schemas 2–4, so a host and a browser bundle from mismatched versions keep working through the short window. Historical per-generation adaptation notes live in the [CHANGELOG](./CHANGELOG.md).

## Terminal face (dsh-tui)

The same package mounts as terminal face `dsh-pulse/tui` inside [dsh-tui](https://github.com/ccch1mneyyy/dsh-TUI) (≥ 0.13.0, a third-party interactive terminal frontend for DeepSeek Harness), sharing the fold, pricing and configuration data with the Web face. dsh-tui is installed separately; skip this section if you don't use it.

**Six commands** (the input box's `/` menu): `/pulse` toggles the mini card (same as alt+p); `/pulse-day` today's day view (breadcrumb + summary + hourly gantt + session ledger, `s` switches the sort); `/pulse-month` this month's calendar heat + weekly trend + model breakdown; `/pulse-year` the last year as a 53-week heatmap; `/pulse-cost` today's cost view (`t` toggles cost/token inside the scene); `/pulse-sessions` the session switcher (type-to-filter + two-step confirm).

**Mini card**: a 3-row-capped card above the input box (pointer-only, never takes the keyboard). The today row splits ● current session / ○ the rest (today's slice, never lifetime totals), the month row carries a log-scaled sparkline, and the unpriced share becomes a ⚠ row; click the card body to enter the full view, `×` collapses it. **Esc** unwinds the full scene level by level (day → month → year), and the top-level Esc returns to chat; `?` help, `e` CSV export, `r` force refresh.

**Degradations**: when host seams are absent it steps down level by level — a refused command registration makes `/pulse` open the full day view directly; an absent scene service renders a red failure line in the panel and exits quietly. One `falling back to direct commands.register (C-070, unattributed)` line in the boot log is expected behavior, not a fault. Since host 0.2.0 no longer exposes session activity timestamps, a persisted session appended by another process is not refolded automatically — press `r` in the scene to refresh manually.

**Diagnostics**: the host command `/plugins check <dsh-pulse path>` statically validates the manifest (it should report `compatible`); the environment variable `PULSE_TUI_DEBUG=1` makes the plugin emit one stderr diagnostic line (seam visibility) at plugin load.

## FAQ

- **The panel has no data?** Usage is folded from dsh's own session logs — a fresh install has no history to fold yet, so run a session and it appears; also confirm the plugin is installed in the active profile and `dsh web` was restarted.
- **No official balance showing?** The host needs a DeepSeek API key configured (`DEEPSEEK_API_KEY` or a client sign-in); unconfigured, the balance block hides itself as a whole instead of erroring.
- **Official spend and the local estimate don't match?** The official figure is that key's total spend — other tools sharing the key are counted in; helper calls (search, title generation) are estimates by nature, and the panel self-calibrates and raises a reconciliation drift alert when the drift persists (hover for the per-day comparison).
- **Are the subscription percentages accurate?** The server reports percentages only; the panel back-solves the total and remainder from local usage, and the estimate reads low when the key is shared with other tools — read the trend, not the ledger.
- **A C-070 line in the tui boot log?** Expected behavior — see the degradation notes in [Terminal face](#terminal-face-dsh-tui); not a fault.
- **A save returned 409?** It raced another window's save; the editor has already refreshed its local copy — just retry.
- **Why is there only one pulse row in the `/` menu?** The plugin provides this entry as a client contribution (with its own icon; its text follows the UI language) and registers no host command — otherwise dsh would merge it by name into an extra icon-less catalog row.

## Development

```bash
npm test                    # host / aggregate / view / client-smoke / tui / golden / style / manifest — the eight suites
npm run build               # rebuild lib/client.js from src/ after changes (esbuild)
```

Of these, `client-smoke` executes the dashboard's derived-model hooks for real under react stubs: the bundler cannot catch a “name left behind in another function's scope” relocation accident, and it is the only runtime line of defense outside the browser.

Comment-language convention: JSDoc (public contracts, `@param`/`@returns`) is always English; paragraph-level design notes may be in Chinese; comments describing an old mechanism are deleted together with the mechanism, never stacked beside new code.

Special thanks to the [Linux Do](https://linux.do/) community.

MIT — see [LICENSE](./LICENSE).
