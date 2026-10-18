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
export declare function apply(ctx: any, config?: {}): Promise<void>;
