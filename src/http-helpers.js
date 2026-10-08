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

/** The data-face GET exit: the raw payload under the same headers, HEAD
 *  answering headers only. Envelope law — data-face GETs (stats / session /
 *  settings GET / quota) return the bare payload; {ok,...} is the command
 *  face's (settings POST, update-check); EVERY JSON error body is
 *  {ok:false,error} via json.err; method-level text/plain short circuits
 *  stay plain text. */
json.raw = (res, req, status, value) => {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(req?.method === "HEAD" ? undefined : JSON.stringify(value));
};

/** The ONE error face. */
json.err = (res, status, message) => {
  json(res, status, { ok: false, error: message });
};
