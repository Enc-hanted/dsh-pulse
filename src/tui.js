/**
 * dsh-pulse TUI face — the terminal seat for `@deepseek-harness-tui/dsh-tui`.
 *
 * Mounted ONLY in the dsh-tui profile (the web profile's patch never
 * references this subpath, so this module never even loads there). It
 * reuses the same fold (`aggregate.js`) and pricing (`view.js`) as the web
 * half and reads the same shared session store through `sessionQuery`.
 *
 * Config is SHARED with the web face: the `pulse` settings namespace (the
 * store the web settings editor writes, dsh-home-wide settings.yaml) wins
 * over this profile's entry config — pricing rules, monthlyProviders,
 * usdToCny, costEnabled and modelColors all come over, so both faces tell
 * the same money story (soft-probed; absent service → entry config only).
 *
 * Pricing honesty: each day prices under the official schedule in effect
 * (`officialRulesFor`), user rules overlay, and `officialEstimateRulesFor`
 * fills the GA gap — usage days before a schedule's billing-effective date
 * still price from the earliest published vintage, tagged and labeled as
 * an estimate instead of showing a misleading zero. Models billed under a
 * flat monthly subscription stay visible with a 包月 tag.
 *
 * Scene shape — progressive disclosure, disjoint from dsh-tui's HUD:
 * - `/pulse` (or alt+p) TOGGLES THE STRIP: the mini card rendered through
 *   `ctx.tuiStatus.registerView` — a real card docked ABOVE THE PROMPT in
 *   the chat screen (the approval-panel slot family), chat visible and
 *   typable around it. 今日 split into ● 当前会话 vs ○ 其余 (today slices,
 *   never lifetime totals), 本月 line with a log-scaled sparkline, and a
 *   conditional ⚠ unpriced-share line. The HUD keeps everything session-
 *   live (ctx %, cache rate, the running session's meter); the card only
 *   ever speaks in cross-session aggregates plus the "where am I in
 *   today's pie" share the HUD cannot offer. Host rules: pointer-only,
 *   3 rows max — click the body to open the full view, ✕ / alt+p to
 *   dismiss. Without the tuiStatus seam, /pulse opens the full view.
 * - The full observatory is a SCENE (replaces the conversation) entered
 *   from the strip's click or /pulse-day|month|year|cost; Esc walks
 *   日 → 月 → 年 and the top-most Esc returns to the chat.
 * - `o` (or /pulse-sessions) opens the in-scene SESSION PICKER: palette-
 *   style framed list with type-to-filter, an explicit two-step confirm,
 *   then close + channel.resumeTo — the same seam the host's own /resume
 *   browser switches through.
 *
 * Rendering idioms come from dsh-tui's design system: theme keys via
 * ThemedText, the ProgressBar block-ladder + empty-as-background trick, an
 * inspector line under the cursor grid. Heat ramp colors mix
 * theme.background → theme.accent so /theme re-skins the whole scene.
 *
 * ZERO top-level external imports (react/ink come through scene props);
 * node builtins only. Module `inject` stays EMPTY — the service seams are
 * declared on the patch row's `inject:` list instead (cordis 4.0.4 / dsh
 * 0.2.0 hides non-declared services from ctx.get), and apply() still
 * soft-probes + degrades every one of them (#183 discipline).
 *
 * Layout: ./tui/data.js (folds + pricing + honesty), ./tui/draw.js (terminal
 * primitives), ./tui/scene.js (components + wiring). This module is the
 * plugin surface: name/inject/apply plus the test-locked re-exports.
 */

import { apply } from "./tui/scene.js";

export { apply };
export { cursorStep, resolveTheme } from "./tui/scene.js";

export const name = "pulse-tui";

/** No code-level service requirements: the seams are declared on the patch
 *  row's `inject:` list (cordis 4.0.4 hides non-declared services), while
 *  apply() itself keeps soft-probing + degrading every seam (#183). */
export const inject = [];

export {
	eqId, mergeRecord, pricingLabelOf, monthLabelOfWeek, viewSlice,
	peakHoursFor, miniCardModel,
} from "./tui/data.js";
export {
	compactTokensTight, displayWidth, wrapDisplay, money, hexMix, fitDisplay,
	truncateDisplay, sparkTrend, weeklyBars, modelLayout, ganttRows, yearTiles,
	fmtTokens,
} from "./tui/draw.js";
export { layoutBudget } from "./tui/scene.js";
export {
	noteCurrentSession, pulseStripToggle, stripStore, _resetStripForTests,
} from "./tui/strip.js";
