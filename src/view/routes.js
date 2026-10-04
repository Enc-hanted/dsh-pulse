/**
 * View model — route families & provider identity: the catalog route
 * families, display labels, official-channel detection, the rollup key,
 * and the catalog-backed provider resolution the session views share.
 */

import { modelKey } from "./keys.js";

export const ROUTE_FAMILIES = [
  { family: "deepseek", label: "DeepSeek", routes: ["deepseek-official", "deepseek-account"], accountBalance: true },
];

/** The family entry owning a provider route (`null` for a standalone route).
 *  The family id itself answers too — the display rollup keys rows by it, and
 *  those keys reach the filters and the official-channel checks. */
export function familyRouteOf(provider) {
  const route = typeof provider === "string" ? provider : "";
  if (route === "") return null;
  return ROUTE_FAMILIES.find((entry) => entry.family === route || entry.routes.includes(route)) ?? null;
}

/** Display label for a provider route: the family's when it has one. */
export function providerLabelOf(provider, fallback = "") {
  const entry = familyRouteOf(provider);
  if (entry !== null) return entry.label;
  return typeof provider === "string" && provider !== "" ? provider : fallback;
}

/** The provider the authenticated account bills: the empty (wildcard) provider
 *  and every account-balance family route. Everything else is third-party. */
export function isOfficialProvider(provider) {
  const route = typeof provider === "string" ? provider : "";
  if (route === "") return true;
  return familyRouteOf(route)?.accountBalance === true;
}

/** The composite key a row folds into for DISPLAY: family routes collapse onto
 *  the family (`deepseek\u0000deepseek-flash`), any other route keeps its own
 *  identity. Pricing never uses this — rules stay per route. */
export function rollupKeyOf(provider, model) {
  const entry = familyRouteOf(provider);
  return modelKey(entry === null ? provider : entry.family, model);
}

/** All catalog providers that serve a model id (by id or display name),
 *  deduplicated in catalog order. A provider-less (bare-key) row can then
 *  line up with the monthly-paid route — legacy events / adapters that omit
 *  the provider still price as monthly. */
function catalogProviders(catalog, modelId) {
  const out = [];
  for (const group of Array.isArray(catalog) ? catalog : []) {
    if (group === null || typeof group !== "object") continue;
    const has = (Array.isArray(group.models) ? group.models : []).some((m) => m !== null && typeof m === "object"
      && (m.id === modelId || (typeof m.name === "string" && m.name === modelId)));
    if (!has) continue;
    if (group.provider !== null && group.provider !== undefined && !out.includes(group.provider)) out.push(group.provider);
  }
  return out;
}

/** Resolve a provider-less model row's provider: the single catalog route
 *  that serves it, else — when several routes serve the same model id but
 *  exactly one of them is monthly-paid — that monthly route. `""` when
 *  unresolved (absent or ambiguous and no monthly tie-break). */
export function resolveProviderFor(catalog, modelId, monthlySet) {
  const candidates = catalogProviders(catalog, modelId);
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1 && typeof monthlySet?.has === "function") {
    const monthly = candidates.filter((p) => monthlySet.has(p));
    if (monthly.length === 1) return monthly[0];
  }
  return "";
}
