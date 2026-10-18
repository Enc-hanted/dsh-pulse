/**
 * TUI face — terminal drawing primitives (pure, no hooks): display-width
 * measurement, kinsoku-aware wrap, money labels, token abbreviations, heat
 * ramps, sparklines and block bars. Numbers and text → strings only; the
 * day gantt is the one view-model here (drawable cells for tests to pin).
 */
import { clockOf, fmtTokens } from "../view.js";
export { fmtTokens, clockOf };
/** Space-tight token abbreviation for squeezed table rows: 180.6M → 181M.
 *  Exported for test/tui-test.mjs. */
export declare function compactTokensTight(n: any): string;
export declare function shortSessionId(id: any): string;
/** Display width of a string — CJK/fullwidth count 2, symbols count 1.
 *  Exported for test/tui-test.mjs. */
export declare function displayWidth(s: any): number;
export declare function padDisplay(text: any, width: any): string;
export declare function padDisplayStart(text: any, width: any): string;
/** Truncate to a display-width budget, then pad to exactly `width`. */
export declare function fitDisplay(text: any, width: any): string;
/** fitDisplay, but a cut leaves an ellipsis so mid-word chops ("DSh Pulse
 *  插") don't read as broken wrapping. The result is still exactly `width`
 *  display columns. Exported for test/tui-test.mjs. */
export declare function truncateDisplay(text: any, width: any): string;
/** Display-width-aware greedy wrap. Hand-wrapped because Ink's naive wrap
 *  breaks on raw char counts (staircase) and strands closing punctuation.
 *  Exported for test/tui-test.mjs. */
export declare function wrapDisplay(text: any, width: any): any[];
/** Unified money label: ¥ never omitted, ≈ marks estimate-layer money.
 *  Bare numbers ("3.94" beside "138.5M tok") read as ambiguity — every
 *  amount in the scene goes through this. Exported for test/tui-test.mjs. */
export declare function money(cost: any, estimated: any): string;
/** Mix two #rrggbb colors; t=0 → a, t=1 → b. */
export declare function hexMix(a: any, b: any, t: any): any;
/** Year-grid tile colors — the GitHub contribution-graph idiom. The empty
 *  lattice sits just above the terminal-background anchor so the 7×N grid
 *  stays visible on any terminal (the old "vertical bars" regression was the
 *  tile COLOR — a saturated badge fill — not background painting itself);
 *  heat deepens toward accent, with the top step just under it so today's
 *  solid accent tile stays distinguishable. Exported for test/tui-test.mjs. */
export declare function yearTiles(anchor: any, accent: any): any[];
/** Five-step activity ramp: empty tint, then background → accent mixes. */
export declare function heatRamp(theme: any): any[];
/** Log-ish 0..4 heat level so one heavy day doesn't flatten the month. */
export declare function heatLevel(value: any, max: any): number;
export declare function sparkline(values: any): any;
/** Single-row block sparkline, log1p-scaled. The year trend is heavy-tailed
 *  (one 138M day among zeros); linear scaling flattens every quiet week
 *  into the baseline — the braille chart's failure, now replaced.
 *  Exported for test/tui-test.mjs. */
export declare function sparkTrend(values: any): any;
/** Month trend as WEEKLY COLUMNS (2 cells per week, sqrt height): 30 daily
 *  points resampled into a dot chart read as noise — 4-6 named bars read
 *  as a chart. `labels` are the week-start day-of-month strings.
 *  Exported for test/tui-test.mjs. */
export declare function weeklyBars(values: any, labels: any, rows?: number): {
    lines: any[];
    heights: any;
    labelLine: string;
    peakIdx: number;
    peakVal: number;
};
/** dsh-tui ProgressBar idiom: block ladder, empty stretch as background. */
export declare function barString(ratio: any, width: any): string;
/** Exported for test/tui-test.mjs. */
export declare function modelLayout(rightW: any): {
    name: number;
    bar: number;
    pct: boolean;
    tokPad: number;
    tight: boolean;
    cost: boolean;
};
/** Day-view 分时 gantt (pure; exported shape for tests): one row per
 *  session, one cell group per hour, ▓ band marking the peak-billing
 *  hours, plus the per-hour totals the old 活跃时段 strip showed. The label
 *  column and per-hour width scale with the terminal (the old fixed 12/2
 *  was an 80-col budget that stranded half a 148-col row); `total` is the
 *  合计 sparkline drawn at the SAME pitch as the spans so its peaks sit
 *  under the hours they summarize. Exported for test/tui-test.mjs. */
export declare function ganttRows(sessions: any, day: any, width: any, peakSet: any): {
    hours: any[];
    peakHour: number;
    spanW: number;
    band: string;
    total: any;
    labelW: number;
    rows: any;
};
