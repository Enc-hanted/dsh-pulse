/**
 * TUI face — scene layer: the React components (observatory scene, the
 * prompt-top strip, picker/help/calendar/day renderers) and `apply`, the
 * plugin wiring. React/ink still arrive through props (zero top-level
 * react imports); data comes from ./data.js, strings from ./draw.js.
 */
/** Exported for test/tui-test.mjs. */
export declare function resolveTheme(ui: any, name: any): any;
/** Pure arrow→day-delta mapping (exported for test/tui-test.mjs): one
 *  screen row or column per press, per the grid each level draws — the
 *  year heatmap is the month grid's transpose, so its ←→ / ↑↓ swap. */
export declare function cursorStep(level: any, key: any): number;
/**
 * The calendar's full layout budget, ONE pure function: the horizontal split
 * (the 56-column year grid vs the inspector), the vertical model-row budget,
 * and the month grid's offset/total — previously computed twice, once in the
 * budget block and again inside each grid branch. Exported through src/tui.js
 * for test/tui-test.mjs.
 */
export declare function layoutBudget({ contentW, termRows, cal, month, monthMode }: {
    cal: any;
    contentW: any;
    month: any;
    monthMode: any;
    termRows: any;
}): {
    twoCol: boolean;
    leftW: number;
    rightW: any;
    gridBudget: any;
    fitWeeks: number;
    weekCount: number;
    offset: number;
    total: number;
    modelN: any;
    dropTrend: boolean;
    dropTier: boolean;
};
/**
 * Render the day/year calendar view. Exported for the wide-terminal
 * regression test (the two-column layout once referenced an undestructured
 * `leftW` and threw only at contentW ≥ 92).
 *
 * @param {any} kit - the dsh-tui React surface (`h`, `Box`, `Text`).
 * @param {any} props - the calendar state bundle. The caller passes `data`
 *   along, but the calendar reads its precomputed `cal` instead — the prop
 *   is accepted and ignored.
 */
export declare function renderCalendar(kit: any, { cal, pricing, cursor, metric, level, contentW, termRows, ramp, today, theme, days, yearOffset, focusModel, setFocusModel, hoverDay, setHoverDay, setCursor, setLevel, onStepWeek, }: any): any;
export declare function apply(ctx: any, config?: {}): Promise<void>;
