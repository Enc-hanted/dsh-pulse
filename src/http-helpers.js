/**
 * Shared HTTP response helpers for the host half's route handlers.
 */

/** JSON helpers for the settings/balance route responses. */
export function json(res, status, value) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(value));
}
