# Configuration reference

[简体中文](../CONFIGURATION.md) · **English**

Everything day-to-day is edited in **Settings → Usage Pulse** in the web UI. This page is the reference for the parts most people touch once: the pricing editor, display settings, the per-profile patch, and what each query and storage file does.

- [Settings pages](#settings-pages)
- [Per-profile options](#per-profile-options)
- [Cost model](#cost-model)
- [Official balance](#official-balance)
- [Subscription quota](#subscription-quota)
- [Manual update check](#manual-update-check)
- [Data & storage](#data--storage)

## Settings pages

Settings → Usage Pulse opens a section with three tabs.

**“定价与费用” (Pricing & cost)** edits the rates. Model rows come **only from the model configuration on the Models settings page** (no manual add/delete), with official DeepSeek rates auto-filled; **only the rows you changed are saved** — untouched models keep following the official wildcard defaults, official rate changes reach them automatically, and “恢复官方价” (Official rates) clears a row back to its untouched state. Each row takes off-peak input / cache-hit / output rates, a CNY/USD selector and a 24-hour peak strip (Beijing time, official windows by default, everything deselected = flat). Every provider group header has a “月付费” (Monthly) toggle; the “模型配色” (Model colors) card at the page bottom can pin a custom color on any model or return it to auto. “刷新目录” (Refresh catalog) re-reads the model catalog; “启用费用估算” (Enable cost estimates) turns the cost figures off as a whole.

**“方案对比” (Compare plans)** compares the estimated cost under each model's rates for an adjustable usage scenario (total input, output ratio, cache-hit rate). Plans come straight from the pricing page's effective rules (official defaults included), so rate edits take effect here automatically; temporary plans can be added for comparison, every plan can be shown or hidden, and the scenario can be taken from a real usage window or set manually.

**“设置” (Settings)** toggles each panel's visibility and the sidebar balance indicator, picks the **theme** (blue / pink / orange / B&W, each with its own light and dark variant, following the shell automatically), and switches subscription-quota queries off per provider. Its bottom carries the **“关于” (About)** panel: current version and the manual update check.

**“月度预算” (Monthly budget)** is a card on the dashboard itself: it takes a CNY budget and shows this month's spend so far, a progress bar and a month-end forecast extrapolated from the daily average rate.

Themes, panel toggles, budget, compare scenarios and overlay width are stored in the browser's localStorage (`dsh-pulse:*`); everything else is saved through the host's settings service.

Saves apply immediately and survive restarts; when a save races another window's, the editor refreshes its local copy automatically for a clean retry (a stale write returns HTTP 409). Changes to display fields (FX rate, currency, panel toggles) do not restart the plugin. Without a settings service on the host the page is read-only; without the `llm` service there are no model rows to edit.

## Per-profile options

Defaults are injected into the active profile patch by the bundle itself. To override, add a `pulse` row in `cordis.patch.yml`:

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
          - model: third-party-x        # flat USD rule with custom peak hours
            input: 0.5
            output: 2
            currency: USD
            peakHours: [0, 1, 2, 3, 4, 5]   # Beijing-time hours billed at peak
          - model: weekend-peak         # these hours count as peak every day (weekends included)
            input: 1
            output: 2
            peak: { input: 2, output: 4 }
            peakHours: [9, 10, 11]
            weekdaysOnly: false
          - provider: pi-ai             # prices only that provider's same-named model
            model: deepseek-v4-flash
            input: 2
            output: 4
```

## Cost model

Rates are **CNY per million tokens**; the defaults come from the official price page
<https://api-docs.deepseek.com/zh-cn/quick_start/pricing/> (checked 2026-10-19).
DeepSeek bills by peak/off-peak windows: Beijing time **09:00–12:00** and **14:00–18:00** are peak, **Mondays to Fridays only**; every other slot (including the whole weekend) is off-peak at half the peak rate.

| model | tier | uncached input | cache-hit input | output |
|---|---|---|---|---|
| deepseek-flash | peak | 2 | 0.04 | 8 |
| deepseek-flash | off-peak | 1 | 0.02 | 4 |
| deepseek-v4-pro | peak | 9 | 0.3 | 27 |
| deepseek-v4-pro | off-peak | 4.5 | 0.15 | 13.5 |

The rates live in a versioned rate card (`src/pricing/ratecard.json`), so a price change ships as a new version rather than an edit buried in code. `deepseek-v4-flash` and `deepseek-v4-flash-vision-exp` are retired model ids: the platform still accepts calls to them, but they are actually served by DeepSeek-V4.1-Flash and billed at Flash rates, so this plugin prices those historical events at the Flash tier instead of listing another stale rate row.

The rules can go finer:

- Peak hours apply **on weekdays only** by default; `weekdaysOnly: false` makes a rule's peak hours count every day, and `peakHours: []` still means flat pricing
- Scoped **per provider**: with `provider` set to a provider route id, the rule prices only that provider's same-named model (exact match wins); left empty it covers the model id from every provider — handy for pricing a “reseller also sells deepseek-v4-flash” case separately without touching the official channel
- A provider can be marked **monthly-paid** as a whole (`monthlyProviders`): its models need no rates and cost zero marginal; an optional **monthly fee** (`monthlyFee`) stays out of the pay-per-token estimate and appears only in plan comparison, as a subscription row on the same stage

The official `web_search` and session-title-generation helper LLM calls leave no usage events locally; the observatory counts them exactly from the session logs and folds them into a “辅助调用（估算）” (aux calls, est.) pseudo-model row that enters the model stacks and the cost trend, priced at the official rates in force on the event's day. From 2026-11-01 the platform bills server-side search **per call** (¥0.005 per successful request, effective with the Search/Fetch API opening announcement); the observatory counts it as a known flat term added on top of the shape estimate — the reconciliation gap and the shape self-calibration never absorb it, preserving pure token semantics. Locally the estimate is “1 request = 1 call”, while the real bill counts server-side executions (at most 5 per request) — a factor to verify against the balance once billing goes live. **Shape self-calibration (on by default)**: the official balance series is daily ground truth, and the panel calibrates the aux-call estimate shape against it — a pure function of already-stored data, no new storage, no timers; moved to another deployment, it converges to that deployment's workload on its own. When any of the last 7 complete days shows a reconciliation drift ≥15% **and** ≥¥0.10, the dashboard raises a **reconciliation drift alert** (hover for the per-day comparison); snapshot-sparse days take part in neither learning nor alerting. To freeze the self-calibration, hand-write `searchShape` in the config (keys `miss`/`hit`/`out`).

Currency: every rule prices in **CNY** (default) or **USD**; USD models convert through `usdToCny` (default 6.8, editable in the pricing page), so the total is always a single CNY figure. The conversion is a manual rate by design: this is an estimator, not accounting. `costEnabled: false` hides the cost figures; everything else stays.

**This is an estimator, not accounting**: unpriced models are listed separately, cumulative unpriced tokens under 5k count as rounding noise and render nothing, and past that the card says “有未定价消耗” (some usage unpriced) — clicking it jumps to the pricing page.

## Official balance

`GET /pulse/balance` queries the DeepSeek open platform with the key the host already stores: zero new configuration, zero new secret storage, and the key never leaves the host process (it appears in exactly one outbound `Authorization` header); failures map to generic cause codes with an inline retry in the card, and replies are cached 60 s server-side (the panel's refresh button is the forced refresh). Unconfigured, the balance block hides itself as a whole.

Every successful query records one `{t, total}` snapshot (amounts only) into rolling 30-day storage (capped at 1000 entries, 5-minute dedupe). The per-day official spend is derived from the balance series; days where it cannot be derived (a top-up masks the spend, no prior snapshot) are left empty, and the cost trend draws this as a third thin line. This is that key's **total spend**: other tools sharing the same key are counted in too.

## Subscription quota

`GET /pulse/quota` queries the remaining quota of **monthly subscriptions** (Coding Plan / Token Plan), with the same security posture as the official balance: credentials resolve per operation and appear in exactly one outbound `Authorization` header; snapshots record only each window's utilization percentage (rolling 30 days, dedupe + cap) — never any key or raw response. Server-cached 60 s.

Built-in adapters (auto-detected from the Models catalog's provider routes, no configuration needed):

| adapter | routes | endpoints | returns |
| --- | --- | --- | --- |
| zai-coding | `zai-coding-cn` / `zai-coding` / `zai` | `/api/monitor/usage/quota/limit` + `/api/biz/subscription/list` on `open.bigmodel.cn` or `api.z.ai` | 5h/weekly token-window percentages, reset moments, web-tool counts, plan name and annual/monthly fee |
| kimi-coding | `kimi-coding` / `kimi` | `api.kimi.com/coding/v1/usages` | weekly/5h request-window percentages (the ratio source reports percentages only and yields no counts) |
| minimax | `minimax` / `minimax-coding` | `api.minimaxi.com/v1/token_plan/remains` | 5h/weekly windows (community-documented, not live-verified) |

The adapters implement one small SPI (`src/quota-adapters/`): detect the provider route, build the request, parse the response. Each has recorded fixture/replay cases under `test/fixtures/quota/`, so a parser change is testable without a live account; `scripts/record-quota-fixture.mjs` is the sanitizing manual recorder.

Most of these are **internal endpoints without a committed SLA** (the same ones community tools use); every parser is defensive: a missing field degrades to “未知” (unknown) instead of 0%, and failures surface as generic cause codes.

**Estimation honesty** (stated in the panel's small print too): subscription quota comes as percentages only, never absolute token counts. dsh back-solves them — local token consumption on that provider route over the same span ÷ the server's percentage = the estimated total, and the remainder follows. **dsh covers only the traffic this machine runs through it**: when the key is shared with other tools the estimate reads low; treat it as a trend reference, not accounting. The burn-rate forecast is a linear slope over the snapshot series, answering “when does it run out at this rate” and “the projected percentage at reset”.

**Per-project burn**: the provider's local tokens within the window (or this month) are attributed to projects via each session's working directory — each project's tokens and share bar, plus the **monthly-fee apportionment** (plan fee × share; share only when the plan's price is not public). Queries can be switched off per provider in Settings → “设置” (Settings).

## Manual update check

**Settings → Usage Pulse → “设置” (Settings) → “关于” (About)** (bottom of that tab) shows the current version, and the “检查更新” (Check for updates) button asks the npm registry once, manually, reporting one of four outcomes: “已是最新” (up to date) / “有新版本” (new version available) / “开发版” (development build) / “检查失败” (check failed). It never checks automatically — no timer, no probe at load time.

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

Optional leftovers, all safe to delete: the `pulse` section in `~/.dsh/settings.yaml` (hosts up to 0.1.6), the `pulse` row in the active profile patch (0.1.7+ hosts store settings there), and `~/.dsh/storages/pulse_balance.json`. Uninstalling or deleting them **loses no usage history**.
