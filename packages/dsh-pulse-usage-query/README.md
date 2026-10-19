# dsh-pulse-usage-query

> **DEFAULT: NOT MOUNTED.** This package adds a **model-visible tool** —
> `usage_query` — on top of [dsh-pulse](https://npmjs.com/package/dsh-pulse)
> usage aggregates. **Nothing changes for any session until you insert its
> row into your profile patch yourself.** The package contains no
> self-enabling path: no config, no command, no profile write; the only thing
> it does when mounted is register the one tool, and unmounting removes it.

## Mounting (manual, explicit)

Edit your profile's `cordis.patch.yml` and insert the row (the exact `id`
and `name` are what you need; keep the quotes around the name):

```yaml
insert:
  - id: pulse-usage-query
    name: 'dsh-pulse-usage-query'
```

Requirements:

- The `dsh-pulse` plugin itself must be mounted in the same profile (peer
  dependency `dsh-pulse@0.6.1`): this tool reads its `pulseUsage`
  projections through dsh-pulse's own aggregation entry (`buildStats`) —
  the same fold behind `/pulse/stats`.
- A harness host with the tool registry (dsh ≥ 0.2.0-rc.2; verified against the 0.2.1-alpha.5 snapshot).

Once mounted, the tool is visible to **every** agent in the profile. That
global model-visible surface is exactly why this capability ships as a
separate opt-in package instead of living in dsh-pulse (whose standing
invariant is: a default-mounted package registers no model-visible tools).

## What the tool returns

`usage_query(window, from, to, groupBy, top)` answers questions like "how
much did I use/spend today or recently" and "which model or project
dominated" with a compact JSON value:

```json
{
  "window": "7d",
  "totals": { "tokensIn": 1500, "tokensOut": 250, "cacheRead": 8000,
              "cacheWrite": 100, "costCny": 0.38, "approx": true },
  "groups": [{ "key": "2026-10-19", "tokens": 9300, "costCny": 0.31 }],
  "hint": "full dashboard: /pulse"
}
```

`costCny` is `null` when cost display is disabled or nothing in the window
is priced; `approx` is `true` when the computed total is incomplete (some
tokens matched no pricing rule).

## Data source & privacy posture

- **Data source:** dsh-pulse's aggregates only. The tool calls dsh-pulse's
  exported `buildStats` (bypassing HTTP) and prices through the same
  estimator the dashboard uses, so answers cannot drift from the `/pulse`
  views.
- **No new storage:** the tool persists nothing; it reads the same session
  projections the dashboard reads.
- **No new outbound traffic:** zero new egress of any kind (dsh-pulse's
  manual `/pulse/update-check` remains the only outbound call either package
  ever makes).
- **Never returns conversation content:** responses carry aggregate numbers
  plus short identifiers (day strings, model ids, project labels). This is a
  structural guarantee, not a promise — `test/shape-test.mjs` fails on any
  response key outside a fixed whitelist and on any string longer than 80
  characters.

## Development

```
node packages/dsh-pulse-usage-query/test/shape-test.mjs
```

(run from the repository root; the test resolves dsh-pulse relatively).
`docs/seam-notes.md` records the host-side tool-registration seam this
package rides, with file:line evidence from the 0.2.1-alpha.5 host snapshot.
