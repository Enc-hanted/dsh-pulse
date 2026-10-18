/**
 * MiniMax coding/token plan quota adapter.
 *
 * `GET /v1/token_plan/remains`. Community-documented (MiniMax-M2 issue
 * #99): `current_interval_usage_count` and `current_weekly_usage_count`
 * hold REMAINING counts, not used — prefer the explicit
 * `*_remaining_percent` fields when present. Not yet live-verified; a
 * schema drift surfaces as an unparsable reply, never as fabricated
 * numbers (the conformance fixtures under test/fixtures/quota/minimax/
 * pin the parse).
 */

import { fetchJson, matchRoutes, qclampPct, qnum, qtime, windowOrder } from "./shared.js";

/** Parse the remains reply into the normalized result (pure). A non-zero
 *  `base_resp.status_code` is a provider error and throws. */
export const parseMinimaxRemains = (body) => {
  if (body?.base_resp !== undefined && body?.base_resp !== null && qnum(body.base_resp.status_code) !== 0) {
    throw new Error(`minimax status ${String(body.base_resp.status_code ?? "?")}`);
  }
  const rows = Array.isArray(body?.model_remains) ? body.model_remains : [];
  const remainingPct = (total, remaining) => (total !== null && total > 0 && remaining !== null ? qclampPct(100 - (remaining / total) * 100) : null);
  const fold = (id, windowMs, pick) => {
    let usedPct = null;
    let resetsAt = null;
    let used = null;
    let total = null;
    for (const row of rows) {
      if (row === null || typeof row !== "object") continue;
      const rowTotal = qnum(pick(row).total);
      const rowRemaining = qnum(pick(row).remaining);
      const rowPct = qclampPct(pick(row).remainingPercent) ?? remainingPct(rowTotal, rowRemaining);
      if (rowPct === null) continue;
      usedPct = usedPct === null ? rowPct : Math.max(usedPct, rowPct);
      total = total ?? rowTotal;
      used = used ?? (rowTotal !== null && rowRemaining !== null ? Math.max(0, rowTotal - rowRemaining) : null);
      resetsAt = resetsAt ?? qtime(pick(row).end) ?? qtime(pick(row).remains);
    }
    if (usedPct !== null) windows.push({ id, kind: "requests", used, total, usedPct, resetsAt, windowMs });
  };
  const windows = [];
  fold("5h", 5 * 3600000, (row) => ({ total: row.current_interval_total_count, remaining: row.current_interval_usage_count, remainingPercent: row.current_interval_remaining_percent, end: row.end_time, remains: row.remains_time }));
  fold("7d", 7 * 86400000, (row) => ({ total: row.current_weekly_total_count, remaining: row.current_weekly_usage_count, remainingPercent: row.current_weekly_remaining_percent, end: row.weekly_end_time, remains: row.remains_time }));
  windows.sort(windowOrder);
  return { plan: { name: "MiniMax Coding Plan", level: null, cycle: null, renewsAt: null }, fee: null, windows, extras: [] };
};

/** The fetch half: one bounded GET, then the pure parse. */
const minimaxFetchQuota = async ({ host, resolveCredential }) => {
  const { value: key } = await resolveCredential();
  const body = await fetchJson(`${host}/v1/token_plan/remains`, { authorization: `Bearer ${key}`, accept: "application/json" });
  return parseMinimaxRemains(body);
};

/** The adapter object (contract: ./types.js). */
export const minimaxAdapter = {
  id: "minimax",
  label: "MiniMax Coding Plan",
  envKeys: ["MINIMAX_API_KEY", "MINIMAX_CODING_API_KEY"],
  match: matchRoutes(["minimax", "minimax-coding", "minimax-cn"]),
  hostFor: () => "https://api.minimaxi.com",
  fetchQuota: minimaxFetchQuota,
};
