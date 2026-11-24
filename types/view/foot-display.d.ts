/**
 * Quick-display source selection and share audit — pure, shared by the web
 * sidebar footer and the TUI strip so both faces tell the same source
 * story. The selector is manual (config `footSource`); auto prefers the
 * official balance when it answers, else the first answered subscription.
 * Class-C (no query API) providers never enter the quick display.
 */
/** The warn threshold every quick-display face shares — the footer's ring,
 *  the tip's lead number and window bars, the TUI strip's color. One
 *  constant so the three faces cannot drift apart on what "near exhaustion"
 *  means. */
export declare const FOOT_WARN_PCT = 80;
/** Resolve the displayed source: `{kind: "official", balance}` or
 *  `{kind: "quota", route, entry}`; null when nothing answers. An explicit
 *  choice whose query is not answering keeps its kind (the face shows the
 *  error/empty state) instead of silently switching sources. */
export declare function pickFootSource(footSource: any, balance: any, providers: any): {
    route?: undefined;
    kind: string;
    balance: any;
    entry?: undefined;
} | {
    balance?: undefined;
    kind: string;
    route: any;
    entry: any;
};
/** The displayed source's share of the last 7 days, TODAY included (近 7 日
 *  含今日 — `[today-6, today]`), tokens (the selector-suggestion audit):
 *  official counts every account-billed route (bare keys included), a
 *  subscription counts exactly its route. Null when the window has no
 *  tokens — a share of nothing is not evidence. */
export declare function footShareOf(sessions: any, kind: any, route: any, now: any): {
    share: number;
    total: number;
    mine: number;
};
/** Today's global token count (every project) — the footer's third segment. */
export declare function footTodayTokens(sessions: any, now: any): number;
/** Today's global tokens split the way the token ledger splits everywhere
 *  else: in = input + cacheRead + cacheWrite (everything that enters the
 *  model), out = output. The sum is footTodayTokens' total, so the tip's
 *  finer cut can never contradict the third segment it explains. */
export declare function footTodaySplitTokens(sessions: any, now: any): {
    in: number;
    out: number;
};
/** The share suggestion's one-time-with-hysteresis gate: show below 50%,
 *  a dismissal sticks until the share recovers to ≥60% (which rearms it).
 *  `next` is the memory to persist; the caller writes it only when changed. */
export declare function footHintShow(share: any, stored: any): {
    show: boolean;
    next: any;
};
