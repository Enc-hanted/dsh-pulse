/** The bundled seed, frozen — the offline fallback and the test baseline. */
export declare const SEED_CARD: Readonly<{
    schemaVersion: number;
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
        modelAliases: {
            "deepseek-v4-flash": string;
            "deepseek-v4-flash-vision-exp": string;
        };
        schedules: {
            from: string;
            rules: {
                model: string;
                input: number;
                cacheRead: number;
                output: number;
                peak: {
                    input: number;
                    cacheRead: number;
                    output: number;
                };
                weekdaysOnly: boolean;
                currency: string;
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
    providers: ({
        id: string;
        label: string;
        routes: string[];
        envKeys: string[];
        hosts: ({
            route: string;
            base: string;
        } | {
            route?: undefined;
            base: string;
        })[];
        auth: string;
        requests: ({
            id: string;
            path: string;
            optional?: undefined;
        } | {
            id: string;
            path: string;
            optional: boolean;
        })[];
        windows: {
            kind: string;
            requirePct: boolean;
            source: {
                request: string;
                path: string;
                mode: string;
                filter: {
                    type: string;
                };
            };
            idFrom: {
                fields: string[];
                map: {
                    "3|5": {
                        id: string;
                        windowMs: number;
                    };
                    "6|1": {
                        id: string;
                        windowMs: number;
                    };
                    "6|7": {
                        id: string;
                        windowMs: number;
                    };
                    "5|1": {
                        id: string;
                        windowMs: number;
                    };
                };
                fallback: string;
            };
            pct: {
                aliases: string[];
            };
            reset: {
                aliases: string[];
            };
        }[];
        extras: {
            id: string;
            source: {
                request: string;
                path: string;
                mode: string;
                filter: {
                    type: string;
                };
            };
            pct: {
                aliases: string[];
                fallback: {
                    ratio: {
                        used: string[];
                        total: string[];
                    };
                };
            };
            used: {
                aliases: string[];
            };
            total: {
                aliases: string[];
            };
            reset: {
                aliases: string[];
            };
        }[];
        plan: {
            find: {
                request: string;
                path: string;
                where: {
                    status: string;
                };
                requireString: string;
            };
            fields: {
                name: string;
                cycle: string;
                renewsAt: string;
            };
            level: {
                request: string;
                path: string;
            };
            fee: {
                amount: string[];
                currency: string;
                cycleField: string;
                cycle?: undefined;
            };
            name?: undefined;
        };
        errorGate?: undefined;
    } | {
        extras?: undefined;
        id: string;
        label: string;
        routes: string[];
        envKeys: string[];
        hosts: {
            base: string;
        }[];
        auth: string;
        requests: {
            id: string;
            path: string;
        }[];
        windows: ({
            id: string;
            kind: string;
            windowMs: number;
            source: {
                request: string;
                path: string;
                mode: string;
                keys?: undefined;
            };
            pct: {
                ratio: {
                    used: string[];
                    total: string[];
                };
                aliases?: undefined;
                transform?: undefined;
            };
            reset: {
                aliases: string[];
            };
        } | {
            id?: undefined;
            windowMs?: undefined;
            kind: string;
            source: {
                request: string;
                path: string;
                mode: string;
                keys: {
                    limit_5h: {
                        id: string;
                        windowMs: number;
                    };
                    limit_7d: {
                        id: string;
                        windowMs: number;
                    };
                };
            };
            pct: {
                ratio?: undefined;
                aliases: string[];
                transform: string;
            };
            reset: {
                aliases: string[];
            };
        })[];
        plan: {
            find?: undefined;
            fields?: undefined;
            name: string;
            level: {
                request: string;
                path: string;
            };
            fee?: undefined;
        };
        errorGate?: undefined;
    } | {
        extras?: undefined;
        id: string;
        label: string;
        routes: string[];
        envKeys: string[];
        hosts: {
            base: string;
        }[];
        auth: string;
        requests: {
            id: string;
            path: string;
        }[];
        errorGate: {
            request: string;
            path: string;
            field: string;
        };
        windows: {
            id: string;
            kind: string;
            windowMs: number;
            source: {
                request: string;
                path: string;
                mode: string;
                fold: string;
            };
            pct: {
                aliases: string[];
                fallback: {
                    remaining: {
                        remaining: string[];
                        total: string[];
                    };
                };
            };
            counts: {
                total: string[];
                remaining: string[];
                deriveUsed: boolean;
            };
            reset: {
                aliases: string[];
            };
        }[];
        plan: {
            find?: undefined;
            fields?: undefined;
            level?: undefined;
            name: string;
            fee?: undefined;
        };
    } | {
        extras?: undefined;
        errorGate?: undefined;
        id: string;
        label: string;
        routes: string[];
        envKeys: string[];
        hosts: {
            base: string;
        }[];
        auth: string;
        requests: {
            id: string;
            path: string;
        }[];
        windows: {
            kind: string;
            source: {
                request: string;
                path: string;
                mode: string;
                keys: {
                    rolling: {
                        id: string;
                        windowMs: number;
                    };
                    weekly: {
                        id: string;
                        windowMs: number;
                    };
                    monthly: {
                        id: string;
                        windowMs: number;
                    };
                };
            };
            pct: {
                aliases: string[];
            };
            counts: {
                used: string[];
                total: string[];
                transform: string;
            };
            reset: {
                aliases: string[];
                inSec: string[];
            };
        }[];
        plan: {
            find?: undefined;
            fields?: undefined;
            level?: undefined;
            name: string;
            fee: {
                cycleField?: undefined;
                amount: number;
                currency: string;
                cycle: string;
            };
        };
    })[];
}>;
/** Fixed UTC+8 offset for peak-tier classification (Asia/Shanghai has no DST). */
export declare const BEIJING_OFFSET_MS: number;
export declare let RATECARD: Readonly<{
    schemaVersion: number;
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
        modelAliases: {
            "deepseek-v4-flash": string;
            "deepseek-v4-flash-vision-exp": string;
        };
        schedules: {
            from: string;
            rules: {
                model: string;
                input: number;
                cacheRead: number;
                output: number;
                peak: {
                    input: number;
                    cacheRead: number;
                    output: number;
                };
                weekdaysOnly: boolean;
                currency: string;
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
    providers: ({
        id: string;
        label: string;
        routes: string[];
        envKeys: string[];
        hosts: ({
            route: string;
            base: string;
        } | {
            route?: undefined;
            base: string;
        })[];
        auth: string;
        requests: ({
            id: string;
            path: string;
            optional?: undefined;
        } | {
            id: string;
            path: string;
            optional: boolean;
        })[];
        windows: {
            kind: string;
            requirePct: boolean;
            source: {
                request: string;
                path: string;
                mode: string;
                filter: {
                    type: string;
                };
            };
            idFrom: {
                fields: string[];
                map: {
                    "3|5": {
                        id: string;
                        windowMs: number;
                    };
                    "6|1": {
                        id: string;
                        windowMs: number;
                    };
                    "6|7": {
                        id: string;
                        windowMs: number;
                    };
                    "5|1": {
                        id: string;
                        windowMs: number;
                    };
                };
                fallback: string;
            };
            pct: {
                aliases: string[];
            };
            reset: {
                aliases: string[];
            };
        }[];
        extras: {
            id: string;
            source: {
                request: string;
                path: string;
                mode: string;
                filter: {
                    type: string;
                };
            };
            pct: {
                aliases: string[];
                fallback: {
                    ratio: {
                        used: string[];
                        total: string[];
                    };
                };
            };
            used: {
                aliases: string[];
            };
            total: {
                aliases: string[];
            };
            reset: {
                aliases: string[];
            };
        }[];
        plan: {
            find: {
                request: string;
                path: string;
                where: {
                    status: string;
                };
                requireString: string;
            };
            fields: {
                name: string;
                cycle: string;
                renewsAt: string;
            };
            level: {
                request: string;
                path: string;
            };
            fee: {
                amount: string[];
                currency: string;
                cycleField: string;
                cycle?: undefined;
            };
            name?: undefined;
        };
        errorGate?: undefined;
    } | {
        extras?: undefined;
        id: string;
        label: string;
        routes: string[];
        envKeys: string[];
        hosts: {
            base: string;
        }[];
        auth: string;
        requests: {
            id: string;
            path: string;
        }[];
        windows: ({
            id: string;
            kind: string;
            windowMs: number;
            source: {
                request: string;
                path: string;
                mode: string;
                keys?: undefined;
            };
            pct: {
                ratio: {
                    used: string[];
                    total: string[];
                };
                aliases?: undefined;
                transform?: undefined;
            };
            reset: {
                aliases: string[];
            };
        } | {
            id?: undefined;
            windowMs?: undefined;
            kind: string;
            source: {
                request: string;
                path: string;
                mode: string;
                keys: {
                    limit_5h: {
                        id: string;
                        windowMs: number;
                    };
                    limit_7d: {
                        id: string;
                        windowMs: number;
                    };
                };
            };
            pct: {
                ratio?: undefined;
                aliases: string[];
                transform: string;
            };
            reset: {
                aliases: string[];
            };
        })[];
        plan: {
            find?: undefined;
            fields?: undefined;
            name: string;
            level: {
                request: string;
                path: string;
            };
            fee?: undefined;
        };
        errorGate?: undefined;
    } | {
        extras?: undefined;
        id: string;
        label: string;
        routes: string[];
        envKeys: string[];
        hosts: {
            base: string;
        }[];
        auth: string;
        requests: {
            id: string;
            path: string;
        }[];
        errorGate: {
            request: string;
            path: string;
            field: string;
        };
        windows: {
            id: string;
            kind: string;
            windowMs: number;
            source: {
                request: string;
                path: string;
                mode: string;
                fold: string;
            };
            pct: {
                aliases: string[];
                fallback: {
                    remaining: {
                        remaining: string[];
                        total: string[];
                    };
                };
            };
            counts: {
                total: string[];
                remaining: string[];
                deriveUsed: boolean;
            };
            reset: {
                aliases: string[];
            };
        }[];
        plan: {
            find?: undefined;
            fields?: undefined;
            level?: undefined;
            name: string;
            fee?: undefined;
        };
    } | {
        extras?: undefined;
        errorGate?: undefined;
        id: string;
        label: string;
        routes: string[];
        envKeys: string[];
        hosts: {
            base: string;
        }[];
        auth: string;
        requests: {
            id: string;
            path: string;
        }[];
        windows: {
            kind: string;
            source: {
                request: string;
                path: string;
                mode: string;
                keys: {
                    rolling: {
                        id: string;
                        windowMs: number;
                    };
                    weekly: {
                        id: string;
                        windowMs: number;
                    };
                    monthly: {
                        id: string;
                        windowMs: number;
                    };
                };
            };
            pct: {
                aliases: string[];
            };
            counts: {
                used: string[];
                total: string[];
                transform: string;
            };
            reset: {
                aliases: string[];
                inSec: string[];
            };
        }[];
        plan: {
            find?: undefined;
            fields?: undefined;
            level?: undefined;
            name: string;
            fee: {
                cycleField?: undefined;
                amount: number;
                currency: string;
                cycle: string;
            };
        };
    })[];
}>;
export declare let RATECARD_VERSION: number;
export declare let PEAK_HOURS: readonly number[];
export declare let DEFAULT_USD_TO_CNY: number;
export declare let AUX_PRICE_AS: string;
export declare let AUX_SHAPE: Readonly<{
    miss: number;
    hit: number;
    out: number;
}>;
export declare let MODEL_ALIASES: Readonly<{
    "deepseek-v4-flash": string;
    "deepseek-v4-flash-vision-exp": string;
}>;
export declare let HOLIDAYS: readonly string[];
export declare let OFFICIAL_PRICE_SCHEDULES: any;
export declare let AUX_CALL_FEE: Readonly<{
    from: any;
    fromMs: number;
    until: any;
    untilMs: number;
    /** Day-level surfaces gate [from, untilDay): the boundary day is
     *  conservatively free (same philosophy as the no-day default);
     *  event-level surfaces gate [fromMs, untilMs) to the minute. */
    untilDay: any;
    cnyPerCall: any;
}>;
export declare let PROVIDER_SPECS: any;
/** Republish every fact from a card. Validation lives at the HOST boundary
 *  (import/pull/validate endpoints and the boot read of storage); the client
 *  applies the host-validated card echoed in each payload, so the browser
 *  bundle never carries the validator. */
export declare function applyCard(card: any, origin?: string): void;
/** Return to the bundled seed (the settings page's restore action). */
export declare function resetCard(): void;
/** The active card plus its provenance, for payloads and the card panel. */
export declare function activeCard(): {
    card: Readonly<{
        schemaVersion: number;
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
            modelAliases: {
                "deepseek-v4-flash": string;
                "deepseek-v4-flash-vision-exp": string;
            };
            schedules: {
                from: string;
                rules: {
                    model: string;
                    input: number;
                    cacheRead: number;
                    output: number;
                    peak: {
                        input: number;
                        cacheRead: number;
                        output: number;
                    };
                    weekdaysOnly: boolean;
                    currency: string;
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
        providers: ({
            id: string;
            label: string;
            routes: string[];
            envKeys: string[];
            hosts: ({
                route: string;
                base: string;
            } | {
                route?: undefined;
                base: string;
            })[];
            auth: string;
            requests: ({
                id: string;
                path: string;
                optional?: undefined;
            } | {
                id: string;
                path: string;
                optional: boolean;
            })[];
            windows: {
                kind: string;
                requirePct: boolean;
                source: {
                    request: string;
                    path: string;
                    mode: string;
                    filter: {
                        type: string;
                    };
                };
                idFrom: {
                    fields: string[];
                    map: {
                        "3|5": {
                            id: string;
                            windowMs: number;
                        };
                        "6|1": {
                            id: string;
                            windowMs: number;
                        };
                        "6|7": {
                            id: string;
                            windowMs: number;
                        };
                        "5|1": {
                            id: string;
                            windowMs: number;
                        };
                    };
                    fallback: string;
                };
                pct: {
                    aliases: string[];
                };
                reset: {
                    aliases: string[];
                };
            }[];
            extras: {
                id: string;
                source: {
                    request: string;
                    path: string;
                    mode: string;
                    filter: {
                        type: string;
                    };
                };
                pct: {
                    aliases: string[];
                    fallback: {
                        ratio: {
                            used: string[];
                            total: string[];
                        };
                    };
                };
                used: {
                    aliases: string[];
                };
                total: {
                    aliases: string[];
                };
                reset: {
                    aliases: string[];
                };
            }[];
            plan: {
                find: {
                    request: string;
                    path: string;
                    where: {
                        status: string;
                    };
                    requireString: string;
                };
                fields: {
                    name: string;
                    cycle: string;
                    renewsAt: string;
                };
                level: {
                    request: string;
                    path: string;
                };
                fee: {
                    amount: string[];
                    currency: string;
                    cycleField: string;
                    cycle?: undefined;
                };
                name?: undefined;
            };
            errorGate?: undefined;
        } | {
            extras?: undefined;
            id: string;
            label: string;
            routes: string[];
            envKeys: string[];
            hosts: {
                base: string;
            }[];
            auth: string;
            requests: {
                id: string;
                path: string;
            }[];
            windows: ({
                id: string;
                kind: string;
                windowMs: number;
                source: {
                    request: string;
                    path: string;
                    mode: string;
                    keys?: undefined;
                };
                pct: {
                    ratio: {
                        used: string[];
                        total: string[];
                    };
                    aliases?: undefined;
                    transform?: undefined;
                };
                reset: {
                    aliases: string[];
                };
            } | {
                id?: undefined;
                windowMs?: undefined;
                kind: string;
                source: {
                    request: string;
                    path: string;
                    mode: string;
                    keys: {
                        limit_5h: {
                            id: string;
                            windowMs: number;
                        };
                        limit_7d: {
                            id: string;
                            windowMs: number;
                        };
                    };
                };
                pct: {
                    ratio?: undefined;
                    aliases: string[];
                    transform: string;
                };
                reset: {
                    aliases: string[];
                };
            })[];
            plan: {
                find?: undefined;
                fields?: undefined;
                name: string;
                level: {
                    request: string;
                    path: string;
                };
                fee?: undefined;
            };
            errorGate?: undefined;
        } | {
            extras?: undefined;
            id: string;
            label: string;
            routes: string[];
            envKeys: string[];
            hosts: {
                base: string;
            }[];
            auth: string;
            requests: {
                id: string;
                path: string;
            }[];
            errorGate: {
                request: string;
                path: string;
                field: string;
            };
            windows: {
                id: string;
                kind: string;
                windowMs: number;
                source: {
                    request: string;
                    path: string;
                    mode: string;
                    fold: string;
                };
                pct: {
                    aliases: string[];
                    fallback: {
                        remaining: {
                            remaining: string[];
                            total: string[];
                        };
                    };
                };
                counts: {
                    total: string[];
                    remaining: string[];
                    deriveUsed: boolean;
                };
                reset: {
                    aliases: string[];
                };
            }[];
            plan: {
                find?: undefined;
                fields?: undefined;
                level?: undefined;
                name: string;
                fee?: undefined;
            };
        } | {
            extras?: undefined;
            errorGate?: undefined;
            id: string;
            label: string;
            routes: string[];
            envKeys: string[];
            hosts: {
                base: string;
            }[];
            auth: string;
            requests: {
                id: string;
                path: string;
            }[];
            windows: {
                kind: string;
                source: {
                    request: string;
                    path: string;
                    mode: string;
                    keys: {
                        rolling: {
                            id: string;
                            windowMs: number;
                        };
                        weekly: {
                            id: string;
                            windowMs: number;
                        };
                        monthly: {
                            id: string;
                            windowMs: number;
                        };
                    };
                };
                pct: {
                    aliases: string[];
                };
                counts: {
                    used: string[];
                    total: string[];
                    transform: string;
                };
                reset: {
                    aliases: string[];
                    inSec: string[];
                };
            }[];
            plan: {
                find?: undefined;
                fields?: undefined;
                level?: undefined;
                name: string;
                fee: {
                    cycleField?: undefined;
                    amount: number;
                    currency: string;
                    cycle: string;
                };
            };
        })[];
    }>;
    origin: string;
};
