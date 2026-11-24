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
 *  face's (settings POST, update-check) and of every refusal — errors
 *  through json.err, wrong methods through methodNotAllowed. */
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

/** The ONE method-level refusal: a JSON {ok:false,error} face (consistent
 *  with every other error body) plus the Allow header the method contract
 *  needs. */
export function methodNotAllowed(res, allow) {
  res.writeHead(405, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    allow,
  });
  res.end(JSON.stringify({ ok: false, error: "method not allowed" }));
}

/** Loopback hostnames for the pull route's http allowance (URL.hostname,
 *  so IPv6 keeps its brackets — stripped here). */
export function isLoopbackHost(hostname) {
  const h = String(hostname).toLowerCase().replace(/^\[|\]$/g, "");
  return h === "localhost" || h.endsWith(".localhost") || h === "::1" || h.startsWith("127.");
}

/** 卡源 URL 门禁（pull 路由与 update-check 共用）：scheme 必须是 http(s) —
 *  node 的 fetch 接受更多协议（data: 至少算一个），而 pull URL 是用户可达
 *  的配置，绝不能变成 file:/data: 侧信道；http 仅回环放行（本地镜像是合法
 *  的开发姿势），远程一律钉死 https。失败抛 Error，消息即响应文案。 */
export function assertCardSourceUrl(raw) {
  let source = null;
  try { source = new URL(raw); } catch { /* unparsable → refused below */ }
  if (source === null || (source.protocol !== "https:" && source.protocol !== "http:")) {
    throw new Error("card source must be an http(s) URL");
  }
  if (source.protocol === "http:" && !isLoopbackHost(source.hostname)) {
    throw new Error("remote card source must use https (http is accepted only on loopback)");
  }
  return source;
}

/**
 * The mutation-route same-origin guard.
 *
 * The POST /pulse routes put real credentials and persisted-state writes
 * behind endpoints whose readBody never inspects content-type, so a hostile
 * page could drive them with a CORS "simple request" (text/plain) that no
 * preflight would ever surface. Browsers stamp every such POST with `Origin`
 * — same-origin POSTs included (Firefox/Chrome always send it) — and modern
 * ones add `Sec-Fetch-Site`; curl and the host's internal tools send
 * neither, so an absent pair is exactly the trusted non-browser posture.
 * The authority comparison includes the port: a page at
 * `http://127.0.0.1:3000` attacking `Host: 127.0.0.1:4173` is cross-site
 * although the hostname matches.
 *
 * @param {any} req - node request (test stubs may omit `headers` entirely).
 * @returns {boolean} true when the request must be refused as cross-site.
 */
export function isCrossSitePost(req) {
  const headers = req.headers ?? {};
  const site = typeof headers["sec-fetch-site"] === "string" ? headers["sec-fetch-site"].toLowerCase() : "";
  if (site === "cross-site") return true;
  const origin = typeof headers.origin === "string" ? headers.origin : "";
  if (origin === "") return false;
  const host = typeof headers.host === "string" ? headers.host : "";
  try {
    // `url.host` keeps the port only when non-default — the same
    // serialization browsers use for both sides of this comparison.
    return new URL(origin).host.toLowerCase() !== host.toLowerCase();
  } catch {
    // `Origin: null` (sandboxed iframe) or garbage: cannot prove same-origin.
    return true;
  }
}

/** The shared refusal for cross-site mutation POSTs; true = reply written.
 *  Contract body, like every JSON error face: {ok:false,error}. */
export function refuseCrossSitePost(req, res) {
  if (!isCrossSitePost(req)) return false;
  json(res, 403, { ok: false, error: "cross-site request refused" });
  return true;
}

/** Read a request body as UTF-8 text (streaming for real sockets, `req.body`
 *  for stubs/tests), capped at 1 MiB. Shared by every POST route (settings,
 *  quota probe, pricing-card).
 *
 * @param {any} req - node request (test stubs may carry a string `body`).
 * @returns {Promise<string>} the body text.
 */
export function readBody(req) {
  if (typeof req.body === "string") return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1e6) {
        reject(new Error("request body too large"));
        if (typeof req.destroy === "function") req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
