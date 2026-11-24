/**
 * The declarative quota-spec engine — the data half of the provider SPI.
 * A spec (card `providers` section, or a user custom spec from settings)
 * describes the wire: routes, hosts, auth scheme, endpoint paths, and per
 * window where each number lives (alias chains, ratio/remaining/microCents
 * transforms). `parseSpec` is pure (fixtures replay it without network);
 * `specAdapter` wraps it into the QuotaAdapter contract (./types.js) so the
 * orchestrator never knows whether an adapter came from data or code — a
 * hand-written code adapter remains the escape hatch for wire shapes the
 * grammar cannot express.
 *
 * Grammar (per window source):
 * - mode "single": one object at `path` → one window (static id/windowMs).
 * - mode "map": object at `path`; `keys` maps wire key → {id, windowMs}.
 * - mode "array": rows at `path`; `filter` keeps rows whose fields equal;
 *   `idFrom` derives {id, windowMs} from a field-pair lookup with a
 *   "{field}" fallback template; `fold: "max"` merges all rows into one
 *   window (pct = max, counts/reset = first stated).
 * Windows dedupe first-wins by id across specs; `requirePct: false` keeps
 * a window whose pct the provider left unstated (z.ai's console does).
 *
 * The quota norm (types.js) holds: counts come only from true absolute
 * quotas (`counts`), a ratio-only source emits pct with used/total null.
 * Privacy law holds: the credential lives only in the one outbound
 * Authorization header specAdapter sends.
 */

import { fetchJson, matchRoutes, qclampPct, qnum, qstr, qtime, windowOrder } from "./shared.js";

/** Dot-path reader; null on any miss so every extractor stays defensive.
 *  An empty path addresses the body root (single-window custom specs). */
const pathGet = (root, path) => {
  if (path === "") return root ?? null;
  let cur = root;
  for (const part of String(path).split(".")) {
    if (cur === null || typeof cur !== "object") return null;
    cur = cur[part];
  }
  return cur ?? null;
};

/** First finite number across a field alias chain. */
const pickNum = (row, aliases) => {
  for (const field of aliases ?? []) {
    const n = qnum(row?.[field]);
    if (n !== null) return n;
  }
  return null;
};

/** First stated reset across alias chains: absolute stamps (qtime handles
 *  ms/s/ISO) win over relative seconds (now + s). */
const pickReset = (row, reset) => {
  for (const field of reset?.aliases ?? []) {
    const t = qtime(row?.[field]);
    if (t !== null) return t;
  }
  for (const field of reset?.inSec ?? []) {
    const s = qnum(row?.[field]);
    if (s !== null && s >= 0) return Date.now() + Math.round(s * 1000);
  }
  return null;
};

/** One pct extraction: direct aliases (optionally ×100), a used/total
 *  ratio, a remaining/total inversion, or the same shapes as fallback. */
const pctOf = (row, pct) => {
  if (pct === null || typeof pct !== "object") return null;
  if (Array.isArray(pct.aliases) && pct.aliases.length > 0) {
    const n = pickNum(row, pct.aliases);
    if (n !== null) return qclampPct(pct.transform === "ratio" ? n * 100 : n);
  }
  if (pct.ratio !== null && typeof pct.ratio === "object") {
    const used = pickNum(row, pct.ratio.used);
    const total = pickNum(row, pct.ratio.total);
    if (used !== null && total !== null && total > 0) return qclampPct((used / total) * 100);
  }
  if (pct.remaining !== null && typeof pct.remaining === "object") {
    const rem = pickNum(row, pct.remaining.remaining);
    const total = pickNum(row, pct.remaining.total);
    if (rem !== null && total !== null && total > 0) return qclampPct(100 - (rem / total) * 100);
  }
  return pctOf(row, pct.fallback);
};

const microUsd = (v) => (v === null ? null : Math.round((v / 1e8) * 100) / 100);

/** Absolute counts across folded rows: first stated wins; `deriveUsed`
 *  back-solves used = total − remaining per row (the remains encodings). */
const countsOf = (rows, counts) => {
  if (counts === null || typeof counts !== "object") return { used: null, total: null };
  let used = null;
  let total = null;
  for (const row of rows) {
    const rowTotal = pickNum(row, counts.total);
    total = total ?? rowTotal;
    if (counts.deriveUsed === true) {
      const rem = pickNum(row, counts.remaining);
      used = used ?? (rowTotal !== null && rem !== null ? Math.max(0, rowTotal - rem) : null);
    } else {
      used = used ?? pickNum(row, counts.used);
    }
  }
  if (counts.transform === "microCentsUsd") return { used: microUsd(used), total: microUsd(total) };
  return { used, total };
};

/** The rows one window source yields, after filter and shape guards. */
const sourceRows = (spec, bodies, source) => {
  const root = pathGet(bodies?.[source.request] ?? null, source.path);
  if (source.mode === "single") return root !== null && typeof root === "object" && !Array.isArray(root) ? [{ row: root, id: null, windowMs: null }] : [];
  if (source.mode === "map") {
    if (root === null || typeof root !== "object" || Array.isArray(root)) return [];
    const rows = [];
    // `keys` is grammar-validated as windowTargets, but parseSpec also serves
    // specs that skipped the zod boundary (hand-written adapters, stored
    // drafts) — a non-object key entry degrades to a skipped row, not a TypeError.
    for (const [wireKey, target] of Object.entries(source.keys ?? {})) {
      if (target === null || typeof target !== "object") continue;
      const row = root[wireKey];
      if (row !== null && typeof row === "object") rows.push({ row, id: target.id, windowMs: target.windowMs ?? null });
    }
    return rows;
  }
  if (!Array.isArray(root)) return [];
  const rows = [];
  for (const item of root) {
    if (item === null || typeof item !== "object") continue;
    const filter = source.filter ?? {};
    if (Object.entries(filter).some(([field, want]) => item[field] !== want)) continue;
    rows.push({ row: item, id: null, windowMs: null });
  }
  return rows;
};

/** idFrom: the (unit, number)-style pair lookup with a template fallback. */
const idFromOf = (row, idFrom, staticId, staticMs) => {
  if (idFrom === null || typeof idFrom !== "object") return { id: staticId, windowMs: staticMs ?? null };
  const values = (idFrom.fields ?? []).map((field) => qnum(row?.[field]));
  const key = values.map((v) => (v === null ? "?" : String(v))).join("|");
  const hit = idFrom.map?.[key];
  if (hit !== null && typeof hit === "object" && typeof hit.id === "string") return { id: hit.id, windowMs: hit.windowMs ?? null };
  if (values.some((v) => v === null)) return { id: "window", windowMs: null };
  let id = String(idFrom.fallback ?? "window");
  (idFrom.fields ?? []).forEach((field, i) => { id = id.split(`{${field}}`).join(String(values[i])); });
  return { id, windowMs: null };
};

/** Parse recorded endpoint bodies into the normalized QuotaResult (pure). */
export function parseSpec(spec, bodies) {
  const gate = spec.errorGate;
  if (gate !== null && typeof gate === "object") {
    const obj = pathGet(bodies?.[gate.request] ?? null, gate.path);
    if (obj !== null && typeof obj === "object" && qnum(obj[gate.field]) !== 0) {
      throw new Error(`${spec.id} status ${String(obj[gate.field] ?? "?")}`);
    }
  }
  const windows = [];
  for (const wspec of spec.windows ?? []) {
    const rows = sourceRows(spec, bodies, wspec.source);
    if (wspec.source.mode === "array" && wspec.source.fold === "max") {
      // The fold path gets the same id discipline as the per-row path below:
      // a fold window carries its static id only (no per-row idFrom), so an
      // unnamed fold is dropped and a repeated id keeps FIRST-WINS instead
      // of stacking a second row the client renders twice.
      if (typeof wspec.id !== "string" || wspec.id === "") continue;
      if (windows.some((w) => w.id === wspec.id)) continue;
      let usedPct = null;
      let resetsAt = null;
      const kept = [];
      for (const { row } of rows) {
        const pct = pctOf(row, wspec.pct);
        if (pct === null) continue;
        usedPct = usedPct === null ? pct : Math.max(usedPct, pct);
        resetsAt = resetsAt ?? pickReset(row, wspec.reset);
        kept.push(row);
      }
      if (usedPct === null) continue;
      const counts = countsOf(kept, wspec.counts);
      windows.push({ id: wspec.id, kind: wspec.kind, used: counts.used, total: counts.total, usedPct, resetsAt, windowMs: wspec.windowMs ?? null });
      continue;
    }
    for (const entry of rows) {
      const { row } = entry;
      const ident = idFromOf(row, wspec.idFrom, entry.id ?? wspec.id, entry.windowMs ?? wspec.windowMs);
      if (typeof ident.id !== "string" || ident.id === "") continue;
      if (windows.some((w) => w.id === ident.id)) continue; // first-wins dedupe
      const usedPct = pctOf(row, wspec.pct);
      if (usedPct === null && wspec.requirePct !== false) continue;
      const counts = countsOf([row], wspec.counts);
      windows.push({ id: ident.id, kind: wspec.kind, used: counts.used, total: counts.total, usedPct, resetsAt: pickReset(row, wspec.reset), windowMs: ident.windowMs });
    }
  }
  windows.sort(windowOrder);
  const extras = [];
  for (const espec of spec.extras ?? []) {
    for (const { row } of sourceRows(spec, bodies, espec.source)) {
      const used = pickNum(row, espec.used?.aliases);
      const total = pickNum(row, espec.total?.aliases);
      extras.push({ id: espec.id, label: qstr(row?.[espec.labelField]) ?? null, used, total, usedPct: pctOf(row, espec.pct), resetsAt: pickReset(row, espec.reset) });
    }
  }
  let plan = null;
  let fee = null;
  const pspec = spec.plan;
  if (pspec !== null && typeof pspec === "object") {
    const level = pspec.level !== null && typeof pspec.level === "object"
      ? qstr(pathGet(bodies?.[pspec.level.request] ?? null, pspec.level.path)) : null;
    if (typeof pspec.name === "string") {
      plan = { name: pspec.name, level, cycle: null, renewsAt: null };
      if (pspec.fee !== null && typeof pspec.fee === "object" && typeof pspec.fee.amount === "number") {
        fee = { amount: pspec.fee.amount, currency: pspec.fee.currency, cycle: pspec.fee.cycle };
      }
    } else if (pspec.find !== null && typeof pspec.find === "object") {
      const list = pathGet(bodies?.[pspec.find.request] ?? null, pspec.find.path);
      const entries = Array.isArray(list) ? list : [];
      const active = entries.find((entry) => entry !== null && typeof entry === "object"
        && Object.entries(pspec.find.where ?? {}).every(([field, want]) => entry[field] === want)
        && typeof entry[pspec.find.requireString] === "string" && entry[pspec.find.requireString] !== "") ?? null;
      if (active !== null) {
        const fields = pspec.fields ?? {};
        plan = { name: qstr(active[fields.name]), level, cycle: qstr(active[fields.cycle]), renewsAt: qstr(active[fields.renewsAt]) };
        const feeSpec = pspec.fee;
        // The fee union's two shapes are distinguished by amount's type (a
        // number for the static name posture, an alias array for find) — the
        // zod union cannot express "the static shape belongs to name only",
        // so a validated spec can pair plan.find with a NUMBER amount. The
        // Array.isArray gate is what keeps that combination from handing
        // pickNum a number ("not iterable" TypeError) — the find posture
        // simply reads no fee instead.
        if (plan.name !== null && feeSpec !== null && typeof feeSpec === "object" && Array.isArray(feeSpec.amount)) {
          const amount = pickNum(active, feeSpec.amount);
          const cycle = qstr(active[feeSpec.cycleField]);
          if (amount !== null && cycle !== null) fee = { amount, currency: feeSpec.currency, cycle };
        }
        if (plan.name === null) plan = null;
      }
    }
  }
  return { plan, fee, windows, extras };
}

/**
 * Wrap a spec into the QuotaAdapter contract: claim its routes, pick the
 * host variant, fetch every endpoint under ONE auth header, pure-parse.
 *
 * `draft` picks the host-variant posture, and the two postures exist because
 * the callers carry different trust:
 * - Roster adapters (card providers, saved custom specs — the default) run
 *   STRICT: a route variant the spec does not declare (no exact
 *   `hosts[].route` hit, no route-less default) must refuse the fetch.
 *   Falling back to `hosts[0]` would silently aim a reviewed spec's first
 *   base at a route whose credential the orchestrator just resolved — on a
 *   multi-host spec that is a live credential sent to the wrong provider.
 * - `draft: true` is reserved for the settings page's explicit-body.spec
 *   probe of a half-written spec: drafts routinely omit the route key on
 *   their only host, so an unmatched route keeps the generic hosts[0]
 *   fallback. That exposure is bounded by the probe route's same-origin
 *   guard (src/index.js) — a web page cannot invoke it cross-site — and the
 *   credential still lives only in the one outbound Authorization header.
 *
 * @param {any} spec - validated provider spec; typed loose like parseSpec's,
 *   the zod boundary (pricing/card-schema.js) owns the real grammar shape.
 * @param {{draft?: boolean}} [options]
 */
export function specAdapter(spec, { draft = false } = {}) {
  const hostFor = (route) => {
    const hosts = spec.hosts ?? [];
    const hit = hosts.find((h) => h.route === route) ?? hosts.find((h) => h.route === undefined);
    if (hit !== undefined) return hit.base ?? "";
    // The two postures' dividing line: drafts fall back, rosters refuse.
    if (draft === true) return hosts[0]?.base ?? "";
    throw new Error(`no host variant declared for route "${route}"`);
  };
  /** @param {import("./types.js").QuotaFetchInput} input */
  const fetchQuota = async ({ host, resolveCredential }) => {
    const { value: key } = await resolveCredential();
    const headers = { authorization: spec.auth === "raw" ? key : `Bearer ${key}`, accept: "application/json" };
    const bodies = {};
    await Promise.all((spec.requests ?? []).map(async (request) => {
      const query = request.query !== null && typeof request.query === "object"
        ? `?${new URLSearchParams(Object.entries(request.query).map(([k, v]) => [k, String(v)]))}` : "";
      try {
        bodies[request.id] = await fetchJson(`${host}${request.path}${query}`, headers);
      } catch (error) {
        if (request.optional === true) bodies[request.id] = null;
        else throw error;
      }
    }));
    return parseSpec(spec, bodies);
  };
  return {
    id: spec.id,
    label: spec.label,
    // The squeezed footer tier's brand word ("GLM"); null lets the client
    // fall back to the full name's first word.
    short: typeof spec.short === "string" && spec.short !== "" ? spec.short : null,
    routes: spec.routes ?? [],
    envKeys: Array.isArray(spec.envKeys) ? spec.envKeys : [],
    match: matchRoutes(spec.routes ?? []),
    hostFor,
    fetchQuota,
  };
}
