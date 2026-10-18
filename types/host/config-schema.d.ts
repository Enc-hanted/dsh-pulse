/**
 * Host half — config schema: the plugin's schemastery-shaped `Config`, its
 * volatile-key ledger, the live-reference readers and the wire filters every
 * settings face shares. Parameterized out of index.js so the schema can be
 * reasoned about (and locked) on its own.
 */
import z from "@deepseek-ai/schemastery";
/** One pricing rule (top-level rates are off-peak; `peak` holds the
 *  peak-hour rates when the model bills by time of day; `peakHours` lists
 *  the peak hours in Beijing time; `provider` scopes the rule to one
 *  provider route — empty prices the model id wherever it appears). */
declare const pricingRuleSchema: z<Schemastery.ObjectS<NoInfer<{
    provider: z<string, string, "defined">;
    model: z<string, string, "plain">;
    input: z<number, number, "defined">;
    cacheRead: z<number, number, "plain">;
    output: z<number, number, "defined">;
    peak: z<Schemastery.ObjectS<NoInfer<{
        input: z<number, number, "defined">;
        cacheRead: z<number, number, "plain">;
        output: z<number, number, "defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
        input: z<number, number, "defined">;
        cacheRead: z<number, number, "plain">;
        output: z<number, number, "defined">;
    }>>, "plain">;
    peakHours: z<number[], number[], "plain">;
    weekdaysOnly: z<boolean, boolean, "plain">;
    currency: z<"CNY" | "USD", "CNY" | "USD", "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    provider: z<string, string, "defined">;
    model: z<string, string, "plain">;
    input: z<number, number, "defined">;
    cacheRead: z<number, number, "plain">;
    output: z<number, number, "defined">;
    peak: z<Schemastery.ObjectS<NoInfer<{
        input: z<number, number, "defined">;
        cacheRead: z<number, number, "plain">;
        output: z<number, number, "defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
        input: z<number, number, "defined">;
        cacheRead: z<number, number, "plain">;
        output: z<number, number, "defined">;
    }>>, "plain">;
    peakHours: z<number[], number[], "plain">;
    weekdaysOnly: z<boolean, boolean, "plain">;
    currency: z<"CNY" | "USD", "CNY" | "USD", "defined">;
}>>, "plain">;
/** Schemastery validation with deployment-friendly defaults. Display fields
 *  are `.volatile()`: the harness hands them to `apply` as live references
 *  and commits edits to them in place — no plugin restart, no fold epoch
 *  reset. `pricing` deliberately stays ordinary: its peak-hour half must
 *  re-fold history, and the entry restart an ordinary edit triggers is
 *  exactly that boundary (persisted rows keyed by the pre-restart
 *  `stateVersion` mismatch and replay once). */
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    currency: z<"CNY" | "USD", "CNY" | "USD", "volatile-defined">;
    topProjects: z<number, number, "volatile-defined">;
    projectDepth: z<number, number, "volatile-defined">;
    defaultDays: z<number, number, "volatile-defined">;
    costEnabled: z<boolean, boolean, "volatile-defined">;
    usdToCny: z<number, number, "volatile-defined">;
    monthlyProviders: z<NoInfer<string[]>, NoInfer<string[]>, "volatile-defined">;
    monthlyFee: z<NoInfer<import("@deepseek-ai/cosmokit").Dict<number, string>>, NoInfer<import("@deepseek-ai/cosmokit").Dict<number, string>>, "volatile-defined">;
    searchShape: z<NoInfer<import("@deepseek-ai/cosmokit").Dict<number, string>>, NoInfer<import("@deepseek-ai/cosmokit").Dict<number, string>>, "volatile-defined">;
    quotaOff: z<NoInfer<string[]>, NoInfer<string[]>, "volatile-defined">;
    modelColors: z<NoInfer<import("@deepseek-ai/cosmokit").Dict<string, string>>, NoInfer<import("@deepseek-ai/cosmokit").Dict<string, string>>, "volatile-defined">;
    pricing: z<Schemastery.ObjectS<NoInfer<{
        provider: z<string, string, "defined">;
        model: z<string, string, "plain">;
        input: z<number, number, "defined">;
        cacheRead: z<number, number, "plain">;
        output: z<number, number, "defined">;
        peak: z<Schemastery.ObjectS<NoInfer<{
            input: z<number, number, "defined">;
            cacheRead: z<number, number, "plain">;
            output: z<number, number, "defined">;
        }>>, Schemastery.ObjectT<NoInfer<{
            input: z<number, number, "defined">;
            cacheRead: z<number, number, "plain">;
            output: z<number, number, "defined">;
        }>>, "plain">;
        peakHours: z<number[], number[], "plain">;
        weekdaysOnly: z<boolean, boolean, "plain">;
        currency: z<"CNY" | "USD", "CNY" | "USD", "defined">;
    }>>[], Schemastery.ObjectT<NoInfer<{
        provider: z<string, string, "defined">;
        model: z<string, string, "plain">;
        input: z<number, number, "defined">;
        cacheRead: z<number, number, "plain">;
        output: z<number, number, "defined">;
        peak: z<Schemastery.ObjectS<NoInfer<{
            input: z<number, number, "defined">;
            cacheRead: z<number, number, "plain">;
            output: z<number, number, "defined">;
        }>>, Schemastery.ObjectT<NoInfer<{
            input: z<number, number, "defined">;
            cacheRead: z<number, number, "plain">;
            output: z<number, number, "defined">;
        }>>, "plain">;
        peakHours: z<number[], number[], "plain">;
        weekdaysOnly: z<boolean, boolean, "plain">;
        currency: z<"CNY" | "USD", "CNY" | "USD", "defined">;
    }>>[], "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    currency: z<"CNY" | "USD", "CNY" | "USD", "volatile-defined">;
    topProjects: z<number, number, "volatile-defined">;
    projectDepth: z<number, number, "volatile-defined">;
    defaultDays: z<number, number, "volatile-defined">;
    costEnabled: z<boolean, boolean, "volatile-defined">;
    usdToCny: z<number, number, "volatile-defined">;
    monthlyProviders: z<NoInfer<string[]>, NoInfer<string[]>, "volatile-defined">;
    monthlyFee: z<NoInfer<import("@deepseek-ai/cosmokit").Dict<number, string>>, NoInfer<import("@deepseek-ai/cosmokit").Dict<number, string>>, "volatile-defined">;
    searchShape: z<NoInfer<import("@deepseek-ai/cosmokit").Dict<number, string>>, NoInfer<import("@deepseek-ai/cosmokit").Dict<number, string>>, "volatile-defined">;
    quotaOff: z<NoInfer<string[]>, NoInfer<string[]>, "volatile-defined">;
    modelColors: z<NoInfer<import("@deepseek-ai/cosmokit").Dict<string, string>>, NoInfer<import("@deepseek-ai/cosmokit").Dict<string, string>>, "volatile-defined">;
    pricing: z<Schemastery.ObjectS<NoInfer<{
        provider: z<string, string, "defined">;
        model: z<string, string, "plain">;
        input: z<number, number, "defined">;
        cacheRead: z<number, number, "plain">;
        output: z<number, number, "defined">;
        peak: z<Schemastery.ObjectS<NoInfer<{
            input: z<number, number, "defined">;
            cacheRead: z<number, number, "plain">;
            output: z<number, number, "defined">;
        }>>, Schemastery.ObjectT<NoInfer<{
            input: z<number, number, "defined">;
            cacheRead: z<number, number, "plain">;
            output: z<number, number, "defined">;
        }>>, "plain">;
        peakHours: z<number[], number[], "plain">;
        weekdaysOnly: z<boolean, boolean, "plain">;
        currency: z<"CNY" | "USD", "CNY" | "USD", "defined">;
    }>>[], Schemastery.ObjectT<NoInfer<{
        provider: z<string, string, "defined">;
        model: z<string, string, "plain">;
        input: z<number, number, "defined">;
        cacheRead: z<number, number, "plain">;
        output: z<number, number, "defined">;
        peak: z<Schemastery.ObjectS<NoInfer<{
            input: z<number, number, "defined">;
            cacheRead: z<number, number, "plain">;
            output: z<number, number, "defined">;
        }>>, Schemastery.ObjectT<NoInfer<{
            input: z<number, number, "defined">;
            cacheRead: z<number, number, "plain">;
            output: z<number, number, "defined">;
        }>>, "plain">;
        peakHours: z<number[], number[], "plain">;
        weekdaysOnly: z<boolean, boolean, "plain">;
        currency: z<"CNY" | "USD", "CNY" | "USD", "defined">;
    }>>[], "defined">;
}>>, "plain">;
/** The Config keys marked `.volatile()` — the only fields the harness may
 *  hand over as live references instead of plain values. */
declare const VOLATILE_KEYS: string[];
/** Unwrap one live reference (a volatile value implements `.get()`) while
 *  letting plain values through, so one reader serves every host generation. */
declare const unwrapVolatile: (value: any) => any;
/** A shallow copy of the config with every volatile reference resolved to
 *  its current plain value — the read face of the config, always current. */
declare function liveConfig(source: any): any;
declare function sanitizeModelColors(value: any): {};
/** Wire filter for the per-provider monthly fee map: only bounded ids with
 *  a positive finite CNY amount survive, so a hand-edited patch can neither
 *  inject junk nor grow the map unboundedly. */
declare function sanitizeMonthlyFee(value: any): {};
/** Wire filter for the manual aux shape (`searchShape`): only the three
 *  known keys survive, as sane positive token amounts. An empty object means
 *  "auto" — the view's self-calibration owns the shape. */
declare function sanitizeSearchShape(value: any): {};
/** The payload's effective aux shape: the manual keys overlay the built-in
 *  seed; `manual` tells the client whether the self-calibration is frozen. */
declare function effectiveAuxShape(config: any): {
    miss: number;
    hit: number;
    out: number;
    manual: boolean;
};
/** POST body → the patch merged into the user section / entry config. A body
 *  that omits a field must not clear it, so only present keys map through
 *  (`monthly` is the wire name of the `monthlyProviders` config field). */
declare function settingsPatchOf(body: any): {
    costEnabled?: any;
    usdToCny?: any;
    pricing?: any;
    currency?: any;
    monthlyProviders?: any;
    monthlyFee?: {};
    quotaOff?: any;
    modelColors?: {};
    searchShape?: {};
};
export { pricingRuleSchema, VOLATILE_KEYS, unwrapVolatile, liveConfig, sanitizeModelColors, sanitizeMonthlyFee, sanitizeSearchShape, effectiveAuxShape, settingsPatchOf };
