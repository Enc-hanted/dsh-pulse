/** Validate one untrusted provider spec (custom-spec settings boundary). */
export declare function validateProviderSpec(value: any): {
    id: string;
    label: string;
    routes: string[];
    envKeys?: string[];
    hosts: {
        route?: string;
        base: string;
    }[];
    auth: "bearer" | "raw";
    requests: {
        id: string;
        path: string;
        optional?: boolean;
        query?: Record<string, string | number>;
    }[];
    errorGate?: {
        request: string;
        path: string;
        field: string;
    };
    windows?: {
        id?: string;
        kind: "requests" | "tokens" | "usd";
        windowMs?: number;
        requirePct?: boolean;
        source: {
            request: string;
            path: string;
            mode: "array" | "map" | "single";
            keys?: Record<string, {
                id: string;
                windowMs?: number;
            }>;
            filter?: Record<string, string | number>;
            fold?: "max";
        };
        idFrom?: {
            fields: string[];
            map: Record<string, {
                id: string;
                windowMs?: number;
            }>;
            fallback: string;
        };
        pct: any;
        counts?: {
            used?: string[];
            total?: string[];
            remaining?: string[];
            deriveUsed?: boolean;
            transform?: "microCentsUsd";
        };
        reset?: {
            aliases?: string[];
            inSec?: string[];
        };
    }[];
    extras?: {
        id: string;
        labelField?: string;
        source: {
            request: string;
            path: string;
            mode: "array" | "map" | "single";
            keys?: Record<string, {
                id: string;
                windowMs?: number;
            }>;
            filter?: Record<string, string | number>;
            fold?: "max";
        };
        pct: any;
        used?: {
            aliases: string[];
        };
        total?: {
            aliases: string[];
        };
        reset?: {
            aliases?: string[];
            inSec?: string[];
        };
    }[];
    plan?: {
        name?: string;
        level?: {
            request: string;
            path: string;
        };
        find?: {
            request: string;
            path: string;
            where: Record<string, string | number>;
            requireString: string;
        };
        fields?: {
            name: string;
            cycle?: string;
            renewsAt?: string;
        };
        fee?: {
            amount: number;
            currency: "CNY" | "USD";
            cycle: string;
        } | {
            amount: string[];
            currency: "CNY" | "USD";
            cycleField: string;
        };
    };
};
/** Validate an untrusted card; throws on any schema or semantic violation.
 *  Returns the parsed card so callers never reuse the raw input. */
export declare function validateCard(value: any): {
    cardSchema: 3;
    version: number;
    checkedAt: string;
    source: string;
    pricing: {
        usdToCny: number;
        peakHours: number[];
        auxPriceAs: string;
        auxShape: {
            miss: number;
            hit: number;
            out: number;
        };
        modelAliases: Record<string, string>;
        schedules: {
            from: string;
            rules: {
                model: string;
                input: number;
                cacheRead: number;
                output: number;
                peak?: {
                    input: number;
                    cacheRead: number;
                    output: number;
                };
                weekdaysOnly?: boolean;
                currency?: "CNY" | "USD";
            }[];
        }[];
        feeWindows: {
            appliesTo: string;
            from: string;
            until: string;
            cnyPerCall: number;
        }[];
    };
    calendar: {
        holidays: string[];
    };
    providers?: {
        id: string;
        label: string;
        routes: string[];
        envKeys?: string[];
        hosts: {
            route?: string;
            base: string;
        }[];
        auth: "bearer" | "raw";
        requests: {
            id: string;
            path: string;
            optional?: boolean;
            query?: Record<string, string | number>;
        }[];
        errorGate?: {
            request: string;
            path: string;
            field: string;
        };
        windows?: {
            id?: string;
            kind: "requests" | "tokens" | "usd";
            windowMs?: number;
            requirePct?: boolean;
            source: {
                request: string;
                path: string;
                mode: "array" | "map" | "single";
                keys?: Record<string, {
                    id: string;
                    windowMs?: number;
                }>;
                filter?: Record<string, string | number>;
                fold?: "max";
            };
            idFrom?: {
                fields: string[];
                map: Record<string, {
                    id: string;
                    windowMs?: number;
                }>;
                fallback: string;
            };
            pct: any;
            counts?: {
                used?: string[];
                total?: string[];
                remaining?: string[];
                deriveUsed?: boolean;
                transform?: "microCentsUsd";
            };
            reset?: {
                aliases?: string[];
                inSec?: string[];
            };
        }[];
        extras?: {
            id: string;
            labelField?: string;
            source: {
                request: string;
                path: string;
                mode: "array" | "map" | "single";
                keys?: Record<string, {
                    id: string;
                    windowMs?: number;
                }>;
                filter?: Record<string, string | number>;
                fold?: "max";
            };
            pct: any;
            used?: {
                aliases: string[];
            };
            total?: {
                aliases: string[];
            };
            reset?: {
                aliases?: string[];
                inSec?: string[];
            };
        }[];
        plan?: {
            name?: string;
            level?: {
                request: string;
                path: string;
            };
            find?: {
                request: string;
                path: string;
                where: Record<string, string | number>;
                requireString: string;
            };
            fields?: {
                name: string;
                cycle?: string;
                renewsAt?: string;
            };
            fee?: {
                amount: number;
                currency: "CNY" | "USD";
                cycle: string;
            } | {
                amount: string[];
                currency: "CNY" | "USD";
                cycleField: string;
            };
        };
    }[];
};
/** One readable line per structural (zod) issue — `pricing.peakHours: …` —
 *  for the card routes' error faces. A raw ZodError.message is the issues
 *  array serialized as JSON, which reads as host vomit to a user hand-editing
 *  a card; the semantic gates above already throw plain sentences, so only
 *  the schema parse needs this bridge. Null on anything else — callers fall
 *  back to the error's own message. */
export declare function cardIssueLines(error: any): string;
