/**
 * View model — route families & provider identity: the catalog route
 * families, display labels, official-channel detection, the rollup key,
 * and the catalog-backed provider resolution the session views share.
 */
export declare const ROUTE_FAMILIES: {
    family: string;
    label: string;
    routes: string[];
    accountBalance: boolean;
}[];
/** The family entry owning a provider route (`null` for a standalone route).
 *  The family id itself answers too — the display rollup keys rows by it, and
 *  those keys reach the filters and the official-channel checks. */
export declare function familyRouteOf(provider: any): {
    family: string;
    label: string;
    routes: string[];
    accountBalance: boolean;
};
/** Display label for a provider route: the family's when it has one. */
export declare function providerLabelOf(provider: any, fallback?: string): string;
/** The provider the authenticated account bills: the empty (wildcard) provider
 *  and every account-balance family route. Everything else is third-party. */
export declare function isOfficialProvider(provider: any): boolean;
/** The composite key a row folds into for DISPLAY: family routes collapse onto
 *  the family (`deepseek\u0000deepseek-flash`), any other route keeps its own
 *  identity. Pricing never uses this — rules stay per route. */
export declare function rollupKeyOf(provider: any, model: any): string;
/** Does one (possibly composite) model key pass the filter set? Lives beside
 *  `rollupKeyOf` because a bare-id match must also cover the route's family
 *  rollup — that is route-family semantics, not key arithmetic. */
export declare function keyMatchesFilter(set: any, key: any): any;
/** Resolve a provider-less model row's provider: the single catalog route
 *  that serves it, else — when several routes serve the same model id but
 *  exactly one of them is monthly-paid — that monthly route. `""` when
 *  unresolved (absent or ambiguous and no monthly tie-break). */
export declare function resolveProviderFor(catalog: any, modelId: any, monthlySet: any): any;
