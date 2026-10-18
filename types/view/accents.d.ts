/** FNV-1a over the model id, salted. The salt (and the 9-step family
 *  gradient below) were chosen by scanning the ids deployments actually
 *  run: today's common sibling families land on distinct slots and the
 *  deepseek pair spans the gradient. Whatever else is present, an id's
 *  own slot never moves again — the same model wears the same color on
 *  every surface, in every window, in any order. */
export declare function accentHash(id: any, salt?: number): number;
/** Shortest angular distance between two hues. */
export declare function accentHueGap(a: any, b: any): number;
export declare function vendorAccentOf(id: any): {
    keys: string[];
    hex: string;
    soft: string;
};
/** Perceptual distance between two OKLab triples (ΔE_ok). */
export declare function accentLabDistance(a: any, b: any): number;
/**
 * Resolution target (ΔE_ok): two auto colours closer than this read as one
 * swatch at dot size. Assignments maximise the distance to everything already
 * placed, so a family whose own gradient is shorter than the target still gets
 * its best available separation instead of a silent duplicate.
 */
export declare const ACCENT_MIN_DISTANCE = 0.07;
/**
 * The stable auto color for one model id — a pure function of the id: vendor
 * families spread over their brand gradient by hashed slot, the aux
 * pseudo-model wears its reserved hue, unknown vendors hash to a hue nudged
 * off every brand anchor. {@link modelAccentMap} may still move a colour when a
 * co-visible twin would otherwise be identical; this is the canonical paint,
 * and the colour an unopposed model always wears.
 *
 * @param {string} id - bare model id (no provider prefix).
 * @returns {string} a CSS color expression.
 */
export declare function accentFillOf(id: string): string;
/**
 * The accent map for one visible model set: composite model key →
 * `{fill, custom, aux, lab, distance}`.
 *
 * Canonical colours come from {@link accentFillOf}. Because a family's own
 * gradient can be shorter than a visible difference (Claude's anchors sit
 * 0.035 ΔE apart, and several vendors' hashed slots land only 0.013 apart),
 * the set is then resolved: pinned colours first (user overrides keep their
 * hex, the aux pseudo-model its reserved gold), then the rest in key order,
 * each taking the candidate furthest from everything already placed. Set
 * membership therefore decides who has to move — exactly what a chart needs —
 * and within one set the result is deterministic, so no two rows of one chart
 * can wear the same swatch. `bw` runs the same resolution measured on
 * lightness alone, so the B&W theme gets a grey ladder instead of one flat
 * grey. Entries are keyed by composite model key; {@link accentEntryOf} is the
 * provider-aware lookup.
 *
 * @param {Array<{model?: string, key?: string, provider?: string}>} models - rows or ids.
 * @param {Record<string, string>} [overrides] - model id → hex color.
 * @param {{bw?: boolean}} [options] - `bw` resolves for the greyscale theme.
 * @returns {Map<string, {fill: string, custom: boolean, aux: boolean, lab: number[], distance: number}>}
 */
export declare function modelAccentMap(models: Array<{
    model?: string;
    key?: string;
    provider?: string;
}>, overrides?: Record<string, string>, { bw }?: {
    bw?: boolean;
}): Map<string, {
    fill: string;
    custom: boolean;
    aux: boolean;
    lab: number[];
    distance: number;
}>;
/** Lookup for surfaces that know a (provider, model) pair but not the key form:
 *  the composite entry, then the family-rolled-up key, then the bare model id. */
export declare function accentEntryOf(map: any, provider: any, model: any): any;
