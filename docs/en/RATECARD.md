# Data card format (ratecard.json)

[简体中文](../RATECARD.md) · **English**

The data card is the versioned source of official pricing facts and subscription-provider query specs. The bundled card is `src/pricing/ratecard.json`; an imported/pulled active card is stored host-side and applied at boot before the first fold, and **apply is always manual** (the panel: [Configuration → Data card](./CONFIGURATION.md#data-card-runtime-price-updates)). Validation sits at the host boundary (`validateCard` in `src/pricing/card-schema.js`); violations answer as one-line `field.path: reason` rows.

- [Top-level fields](#top-level-fields)
- [pricing](#pricing)
- [calendar](#calendar)
- [providers](#providers)

## Top-level fields

| field | type | meaning |
| --- | --- | --- |
| `cardSchema` | literal `3` | the grammar anchor; adding any field requires bumping it |
| `version` | positive integer | the content version; bump on price changes, the panel shows its checked-at date |
| `checkedAt` | `YYYY-MM-DD` | the date the official rates were checked |
| `source` | string | the official price source URL |

## pricing

| field | type | meaning |
| --- | --- | --- |
| `usdToCny` | positive number | the USD→CNY conversion seed (default 6.8) |
| `peakHours` | array of ints 0–23 | Beijing-time peak hours (default `[9,10,11,14,15,16,17]`) |
| `auxPriceAs` | string | which model's rates price the aux calls (default `deepseek-flash`) |
| `auxShape` | `{miss, hit, out}` nonnegative | the aux-call token shape seed |
| `modelAliases` | `old id → canonical id` | retired-id aliases (e.g. `deepseek-v4-flash → deepseek-flash`) |
| `schedules` | array, ≥1 | effective-dated prices, **most-recent-first** (`from` descending) |
| `feeWindows` | array | per-call fee windows |

**`schedules[]`** = `{ from: "YYYY-MM-DD", rules: [...] }`, each rule:

| field | required | meaning |
| --- | --- | --- |
| `model` | ✓ | the model id |
| `input` / `cacheRead` / `output` | ✓ | off-peak rates, **per million tokens**, nonnegative |
| `peak` | | `{input, cacheRead, output}` peak rates; absent means flat pricing |
| `weekdaysOnly` | | whether peak applies on weekdays only, default `true` (absent = true); `false` makes peak count every day |
| `currency` | | `CNY` (default) or `USD` |

**`feeWindows[]`** = `{ appliesTo, from: "YYYY-MM-DD", until, cnyPerCall }`:

- `until` must carry an **explicit UTC offset** (e.g. `2026-11-18T12:00:00+08:00`) and follow `from`; an offset-less stamp is parsed in the host's local timezone, so the same card would bill differently on a UTC runner and a UTC+8 desktop.
- `appliesTo: "server-side-search"` must appear **exactly once**; derive reads the first match, so any extra window is silently ignored.

## calendar

`holidays`: an array of `YYYY-MM-DD` (the Chinese State Council calendar). Holidays bill at **off-peak** like weekends; the peak/off-peak test treats both weekends and holidays as non-working days.

## providers

`providers[]` are the **declarative query specs** for subscription providers, parsed into a normalized result by `src/quota-adapters/spec-engine.js`. Four are built in: `zai-coding` / `kimi-coding` / `minimax` / `opencode-go` (routes and returns: [Configuration → Subscription quota](./CONFIGURATION.md#subscription-quota)).

Each spec describes the wire facts: route claims, host variants, auth, endpoint paths, field alias chains and scale transforms. Endpoint drift is a card edit, not a release. **The full field grammar is authoritative in `src/pricing/card-schema.js` (`providerSpecSchema`) and the `spec-engine.js` header comment**; this page does not duplicate it. The skeleton and hard constraints:

- Required: `id` / `label` / `routes` / `hosts` / `auth` (`bearer` | `raw`) / `requests`.
- Optional: `windows[]` (windows), `extras[]` (auxiliary counts), `plan` (plan name/level/fee), `errorGate`, `envKeys`.
- A host must be an http(s) URL, and **http is accepted on loopback only**: `auth: bearer` puts a credential in every request's Authorization header, so cleartext http would hand it to anyone on the wire.
- Request ids are unique; every `request` reference must name a declared endpoint.
- Provider ids are unique; no route may be claimed by two specs.

A card that changes `routes` / `hosts` / `auth` / `envKeys` changes where credentials go; the apply needs a per-row acknowledgement in the preview, see [Configuration → Data card](./CONFIGURATION.md#data-card-runtime-price-updates).

Custom third-party routes go through the settings form (saved as `quotaSpecs`), no card edit needed; a shape the grammar cannot express can still be a hand-written adapter honoring the `src/quota-adapters/types.js` contract.