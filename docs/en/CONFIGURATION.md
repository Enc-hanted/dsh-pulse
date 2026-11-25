# Configuration reference

[简体中文](../CONFIGURATION.md) · **English**

All day-to-day configuration happens in **Settings → Usage Pulse** in the web UI. This page is the full reference.

- [Settings pages](#settings-pages)
- [Per-profile options](#per-profile-options)
- [Cost model](#cost-model)
- [Data card (runtime price updates)](#data-card-runtime-price-updates)
- [Official balance](#official-balance)
- [Subscription quota](#subscription-quota)
- [Quick display](#quick-display)
- [Manual update check](#manual-update-check)
- [Data & storage](#data--storage)

## Settings pages

Settings → Usage Pulse has three tabs:

- **“定价与费用” (Pricing & cost)**: edit rates. Model rows come only from the model configuration on the Models settings page, with official DeepSeek rates auto-filled; only the rows you changed are saved, untouched models follow the official defaults, and “恢复官方价” (Official rates) clears a row back to its untouched state. Each row sets off-peak rates, a CNY/USD selector and a peak strip (official windows by default, everything deselected = flat); every provider group has a “月付费” (Monthly) toggle; the bottom card can pin model colors or return them to auto.
- **“方案对比” (Compare plans)**: compares the estimated cost under each model's rates for an adjustable usage scenario; plans come from the pricing page's effective rules, so rate edits take effect here automatically. Temporary plans can be added, shown or hidden, and the scenario can come from a real usage window.
- **“设置” (Settings)**: panel visibility and the sidebar balance indicator, the theme (blue / pink / orange / B&W, each with light and dark variants), per-provider subscription-quota switches, the quick-display source selector, the query-endpoints panel for custom endpoints, and the manual update check in the About panel at the bottom.

**“月度预算” (Monthly budget)** is a card on the dashboard itself: it takes a CNY budget and shows this month's spend so far, a progress bar and a month-end forecast extrapolated from the daily average rate.

Themes, panel toggles, budget, compare scenarios and overlay width are stored in the browser's localStorage (`dsh-pulse:*`); everything else is saved through the host's settings service. Saves apply immediately and survive restarts; a stale write returns HTTP 409 and the editor refreshes its local copy automatically for a retry. Without a settings service on the host the page is read-only.

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
        footSource: ""         # quick-display source: "" = auto, "official", or a provider route id
        quotaSpecs: {}         # route id → custom query spec (the card's declarative wire grammar)
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
<https://api-docs.deepseek.com/zh-cn/quick_start/pricing/> (checked 2026-11-18).
DeepSeek bills by peak/off-peak windows: Beijing time **09:00–12:00** and **14:00–18:00** are peak, **Mondays to Fridays only**; every other slot (including the whole weekend) is off-peak at half the peak rate.

| model | tier | uncached input | cache-hit input | output |
|---|---|---|---|---|
| deepseek-flash | peak | 2 | 0.04 | 8 |
| deepseek-flash | off-peak | 1 | 0.02 | 4 |
| deepseek-v4-pro | peak | 9 | 0.3 | 27 |
| deepseek-v4-pro | off-peak | 4.5 | 0.15 | 13.5 |

The rates live in a versioned rate card (`src/pricing/ratecard.json`); a price change ships as a new version. Retired ids (`deepseek-v4-flash`, `deepseek-v4-flash-vision-exp`) are priced at the Flash tier.

The rules can go finer:

- Peak hours apply **on weekdays only** by default; `weekdaysOnly: false` makes a rule's peak hours count every day, and `peakHours: []` still means flat pricing.
- Scoped **per provider**: with `provider` set to a provider route id, the rule prices only that provider's same-named model (exact match wins); left empty it covers the model id from every provider.
- A provider can be marked **monthly-paid** as a whole (`monthlyProviders`): its models need no rates and cost zero marginal; an optional **monthly fee** (`monthlyFee`) stays out of the pay-per-token estimate and appears only in plan comparison as a subscription row.

The official `web_search` and session-title-generation helper LLM calls leave no usage events locally; the observatory counts them from the session logs and folds them into a single “aux calls, est.” row, priced at the official rates in force on the event's day. Compaction runs report their exact usage and model on the event, so they fold as real tokens into the day and model they belong to; timeline report requests carry no usage event and stay a per-call count (the session detail's auxiliary bill shows “Timeline ×N”) — never estimated tokens; a report's outcome is a count too (“failed ×N” on the detail line, reports and failures on the Collaboration panel's timeline rows). The panel self-calibrates that estimate shape against the official balance series; hand-write `searchShape` (keys `miss`/`hit`/`out`) to freeze the shape. The per-call fee for server-side search applies only within the window the card's `feeWindows` declares.

Currency: custom rates price in **CNY** (default) or **USD**; official rates keep their published currency. USD converts through `usdToCny` (default 6.8, editable in the pricing page), so the internal total is always a single CNY figure. A personal **display currency** (`displayCurrency`, switchable in settings) converts every displayed amount at one point, and the CSV export follows. The FX rate is manual by design. `costEnabled: false` hides the cost figures; everything else is unaffected.

## Data card (runtime price updates)

The settings page's **data-card panel** manages the versioned card `src/pricing/ratecard.json` (schema 3): provenance status, export, import, pull, a change preview, and restore-bundled; **apply is always manual**. The pull source defaults to the repo card over jsDelivr (`pricingCardSource`); importing a file needs no network.

- Peak-hour changes refold all history; price-only changes never do.
- A corrupted stored card falls back to the bundled card at boot; without a storage facility the override applies for the session only.
- A card that changes a provider's `routes` / `hosts` / `auth` / `envKeys` changes which credential is read or where it is sent: the preview lists those rows apart and Apply stays disabled until the acknowledgement is ticked; the host answers 422 to an apply that carries none.
- The pull source is the trust root: the default is this repository's `main` card. Before pointing `pricingCardSource` elsewhere or importing a file someone handed you, confirm where it came from.

The card's field semantics, structure and validation constraints: [Data card format](./RATECARD.md). **The most common hand-editing mistake**: rate units are per million tokens; pasting per-1k rates is a 1000× error that still passes validation.

## Official balance

Queries the DeepSeek platform balance automatically with the key the host already stores; no extra configuration. Without a key the balance block hides itself. Query history is recorded as balance snapshots (see [Data & storage](#data--storage)).

## Subscription quota

Queries the remaining quota of monthly subscriptions; no extra configuration. Use `quotaOff` to switch it off per provider. Built-in providers are auto-detected from the Models catalog's routes:

| provider | routes | returns |
| --- | --- | --- |
| zai-coding | `zai-coding-cn` / `zai-coding` / `zai` | 5h/weekly token-window percentages, reset moments, web-tool counts, plan name and annual/monthly fee |
| kimi-coding | `kimi-coding` / `kimi` | weekly/5h request-window percentages (percentages only, no counts) |
| minimax | `minimax` / `minimax-coding` / `minimax-cn` | 5h/weekly windows (community-documented, not live-verified) |
| opencode-go | `opencode-go` / `opencode` / `opencode-zen` | 5h/weekly/monthly percentages and absolute quotas (community-documented, not live-verified) |

**Custom query endpoints**: Settings → “用量/金额查询接口” (query endpoints) offers a form (host / path / auth / percent alias chain / reset fields / scale) for third-party routes no built-in spec claims; “试查询” (Probe) returns a normalized preview (no snapshot write, no cache), saved through `quotaSpecs`. A route claimed by a built-in spec opens “查看内置” (View built-in) as a read-only preview only. The raw spec grammar is documented in the header comment of `src/quota-adapters/spec-engine.js`.

## Quick display

`footSource` (Settings → “常驻快显来源” / Quick-display source) selects which source the **web sidebar footer** shows: `""` auto (official balance first, else the first answered subscription), `official`, or a subscription route id. Providers without a query API do not participate.

**Quick-display style** (same panel): classic (default) or data.

## Manual update check

**Settings → Usage Pulse → “设置” (Settings) → “关于” (About)** (bottom of that tab) shows the current version; the “检查更新” (Check for updates) button asks the npm registry once, manually. It never checks automatically — no timer, no probe at load time.

## Data & storage

Usage statistics have no plugin-private history cache: **the source of truth is dsh's own session logs**, and every number is folded at request time.

| Data | Location | Owned by | What deleting it costs |
| --- | --- | --- | --- |
| Raw usage events (each step's tokens and billing basis) | `~/.dsh/sessions/` | dsh | the history itself, permanently |
| `pulseUsage` projection cache | `~/.dsh/storages/session_projcache.json` + `session_projcache/` | dsh (the plugin only registers the projection unit) | nothing; it is refolded from the session logs |
| Official-balance snapshots (rolling 30 days, amounts only, never the key) | `~/.dsh/storages/pulse_balance.json` | plugin-private | the history of the “官方扣费” (official spend) reconciliation line only |
| Subscription-quota utilization snapshots (rolling 30 days, one percentage point per window) | `~/.dsh/storages/pulse_quota.json` | the burn-rate forecast's history | the burn slope only; it re-accumulates from the next query |
| Data-card snapshot (the imported/pulled active pricing card, with provenance and saved-at) | `~/.dsh/storages/pulse_card.json` | the data-card panel's boot-time override (applied before the first fold) | falls back to the bundled card; re-import or pull restores it |
| Rates / FX rate / currency / panel toggles / quick-display source / custom query specs | the profile's settings (`~/.dsh/settings.yaml` or the `pulse` row in the active profile patch) | dsh settings | back to defaults |
| Theme / panels / budget / compare / overlay width / quick-display hint memory | browser localStorage (`dsh-pulse:*`) | the browser | pure preferences, no usage data |

The request-level payload cache exists only in host process memory (short TTL, emptied by a restart) and holds no history.

Optional leftovers, all safe to delete: the `pulse` section in `~/.dsh/settings.yaml` (hosts up to 0.1.6), the `pulse` row in the active profile patch (0.1.7+ hosts store settings there), and `~/.dsh/storages/pulse_balance.json`.