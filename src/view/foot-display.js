/**
 * Quick-display source selection and share audit — pure, shared by the web
 * sidebar footer and the TUI strip so both faces tell the same source
 * story. The selector is manual (config `footSource`); auto prefers the
 * official balance when it answers, else the first answered subscription.
 * Class-C (no query API) providers never enter the quick display.
 */

import { localDay, shiftDay, splitModelKey } from "./keys.js";
import { isOfficialProvider } from "./routes.js";

/** The warn threshold every quick-display face shares — the footer's ring,
 *  the tip's lead number and window bars, the TUI strip's color. One
 *  constant so the three faces cannot drift apart on what "near exhaustion"
 *  means. */
export const FOOT_WARN_PCT = 80;

/** Resolve the displayed source: `{kind: "official", balance}` or
 *  `{kind: "quota", route, entry}`; null when nothing answers. An explicit
 *  choice whose query is not answering keeps its kind (the face shows the
 *  error/empty state) instead of silently switching sources. */
export function pickFootSource(footSource, balance, providers) {
  const okProviders = (Array.isArray(providers) ? providers : []).filter((p) => p !== null && typeof p === "object" && p.ok === true);
  const balanceOk = balance !== null && typeof balance === "object" && balance.configured === true && balance.ok === true;
  if (footSource === "official") return { kind: "official", balance: balance ?? null };
  if (typeof footSource === "string" && footSource !== "") {
    return { kind: "quota", route: footSource, entry: okProviders.find((p) => p.provider === footSource) ?? null };
  }
  if (balanceOk) return { kind: "official", balance };
  if (okProviders.length > 0) return { kind: "quota", route: okProviders[0].provider, entry: okProviders[0] };
  return null;
}

/** The displayed source's share of the last 7 days, TODAY included (近 7 日
 *  含今日 — `[today-6, today]`), tokens (the selector-suggestion audit):
 *  official counts every account-billed route (bare keys included), a
 *  subscription counts exactly its route. Null when the window has no
 *  tokens — a share of nothing is not evidence. */
export function footShareOf(sessions, kind, route, now) {
  const today = localDay(now);
  const from = shiftDay(today, -6);
  let total = 0;
  let mine = 0;
  for (const record of Array.isArray(sessions) ? sessions : []) {
    for (const [day, models] of Object.entries(record?.modelsByDay ?? {})) {
      if (day < from || day > today) continue;
      if (models === null || typeof models !== "object") continue;
      for (const [key, tokens] of Object.entries(models)) {
        const n = (tokens?.input || 0) + (tokens?.output || 0) + (tokens?.cacheRead || 0) + (tokens?.cacheWrite || 0);
        total += n;
        const { provider } = splitModelKey(key);
        if (kind === "official" ? isOfficialProvider(provider) : provider === route) mine += n;
      }
    }
  }
  return total > 0 ? { share: mine / total, total, mine } : null;
}

/** Today's global token count (every project) — the footer's third segment. */
export function footTodayTokens(sessions, now) {
  const today = localDay(now);
  let total = 0;
  for (const record of Array.isArray(sessions) ? sessions : []) {
    const tokens = record?.byDay?.[today];
    if (tokens === null || typeof tokens !== "object") continue;
    total += (tokens.input || 0) + (tokens.output || 0) + (tokens.cacheRead || 0) + (tokens.cacheWrite || 0);
  }
  return total;
}

/** Today's global tokens split the way the token ledger splits everywhere
 *  else: in = input + cacheRead + cacheWrite (everything that enters the
 *  model), out = output. The sum is footTodayTokens' total, so the tip's
 *  finer cut can never contradict the third segment it explains. */
export function footTodaySplitTokens(sessions, now) {
  const today = localDay(now);
  let inTok = 0;
  let outTok = 0;
  for (const record of Array.isArray(sessions) ? sessions : []) {
    const tokens = record?.byDay?.[today];
    if (tokens === null || typeof tokens !== "object") continue;
    inTok += (tokens.input || 0) + (tokens.cacheRead || 0) + (tokens.cacheWrite || 0);
    outTok += tokens.output || 0;
  }
  return { in: inTok, out: outTok };
}

/** The share suggestion's one-time-with-hysteresis gate: show below 50%,
 *  a dismissal sticks until the share recovers to ≥60% (which rearms it).
 *  `next` is the memory to persist; the caller writes it only when changed. */
export function footHintShow(share, stored) {
  const dismissed = stored?.dismissed === true;
  if (share !== null && share >= 0.6) return { show: false, next: { dismissed: false } };
  return { show: share !== null && share < 0.5 && !dismissed, next: stored ?? { dismissed: false } };
}
