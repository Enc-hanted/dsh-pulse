/**
 * TUI face — prompt-top strip subsystem: the mini card store, the component,
 * and the show/hide/toggle state machine. Extracted from scene.js so the
 * card is testable without driving the full scene. Two documented seams
 * replace the old hidden globals: `noteCurrentSession(id)` (the scene stashes
 * the live session id; the ●当前 marker reads it) and `setPulseOpenRef(fn)`
 * (apply() hands over the full-scene opener — ESM import bindings are
 * read-only, so a plain assignment from scene.js cannot reach here).
 */
import { setQuickReader } from "../quick-reader.js";
export { setQuickReader };
/** Seam: the scene stashes the live session's id each render. */
export declare function noteCurrentSession(id: any): void;
/** Seam: apply() hands over the full-scene opener. */
export declare function setPulseOpenRef(fn: any): void;
export declare const stripStore: {
    ctx: any;
    entryConfig: any;
    snap: {
        status: string;
    };
    listeners: Set<any>;
    timer: any;
    subscribe(listener: any): () => boolean;
    getSnap(): {
        status: string;
    };
    emit(): void;
    refresh(force: any): Promise<void>;
};
/** Show/hide the strip; `desired` omitted = toggle. When the tuiStatus
 *  seam is unavailable (old host / unmounted service) the caller falls
 *  back to opening the full observatory instead. */
export declare function pulseStripToggle(desired: any): boolean;
/** Test seam: reset the module state between state-machine cases. */
export declare function _resetStripForTests(): void;
