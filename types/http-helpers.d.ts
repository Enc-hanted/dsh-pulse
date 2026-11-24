/**
 * Shared HTTP response helpers for the host half's route handlers.
 */
/** JSON helpers for the settings/balance route responses. */
export declare function json(res: any, status: any, value: any): void;
export declare namespace json {
    var raw: (res: any, req: any, status: any, value: any) => void;
    var err: (res: any, status: any, message: any) => void;
}
/** The ONE method-level refusal: a JSON {ok:false,error} face (consistent
 *  with every other error body) plus the Allow header the method contract
 *  needs. */
export declare function methodNotAllowed(res: any, allow: any): void;
/** Loopback hostnames for the pull route's http allowance (URL.hostname,
 *  so IPv6 keeps its brackets — stripped here). */
export declare function isLoopbackHost(hostname: any): boolean;
/** 卡源 URL 门禁（pull 路由与 update-check 共用）：scheme 必须是 http(s) —
 *  node 的 fetch 接受更多协议（data: 至少算一个），而 pull URL 是用户可达
 *  的配置，绝不能变成 file:/data: 侧信道；http 仅回环放行（本地镜像是合法
 *  的开发姿势），远程一律钉死 https。失败抛 Error，消息即响应文案。 */
export declare function assertCardSourceUrl(raw: any): any;
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
export declare function isCrossSitePost(req: any): boolean;
/** The shared refusal for cross-site mutation POSTs; true = reply written.
 *  Contract body, like every JSON error face: {ok:false,error}. */
export declare function refuseCrossSitePost(req: any, res: any): boolean;
