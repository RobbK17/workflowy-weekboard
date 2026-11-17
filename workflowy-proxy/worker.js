// Cloudflare Worker: Workflowy key-holding proxy for the Week Board.
// The real key lives in the Worker secret WORKFLOWY_API_KEY. Clients send a revocable tenant token instead.
//
// Secrets (set with `npx wrangler secret put <NAME>`):
//   WORKFLOWY_API_KEY  your real Workflowy key
//   TENANT_TOKENS      JSON map of token -> name, e.g. {"tok_abc123":"weekboard"}
//
// Client side: WORKFLOWY_BASE_URL=https://<worker>.workers.dev/api/v1  and  WORKFLOWY_API_KEY=<tenant token>

const UPSTREAM = "https://workflowy.com";
const ID = "[A-Za-z0-9_-]{1,64}"; // node ids, 12-char short ids and keys like "inbox"

// Only the endpoints the Week Board uses (method -> path pattern). Mirror endpoints are deliberately left out.
const ALLOWED = [
  ["GET", new RegExp("^/api/v1/nodes-export$")],
  ["GET", new RegExp("^/api/v1/targets$")],
  ["GET", new RegExp("^/api/v1/nodes$")],
  ["POST", new RegExp("^/api/v1/nodes$")],
  ["GET", new RegExp(`^/api/v1/nodes/${ID}$`)],
  ["POST", new RegExp(`^/api/v1/nodes/${ID}$`)],
  ["DELETE", new RegExp(`^/api/v1/nodes/${ID}$`)],
  ["POST", new RegExp(`^/api/v1/nodes/${ID}/(move|complete|uncomplete)$`)],
];

const text = (status, msg) => new Response(msg, { status, headers: { "Content-Type": "text/plain" } });

// Compares two strings in constant time, so how fast a wrong token is refused doesn't reveal how much of it was right.
function sameText(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a.charCodeAt(i % a.length) ^ b.charCodeAt(i));
  return diff === 0;
}

export default {
  async fetch(request, env) {
    if (request.url.endsWith("/healthz")) return text(200, "ok");

    // 1. Authenticate the tenant token
    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    let tenants = {};
    try { tenants = JSON.parse(env.TENANT_TOKENS || "{}"); } catch (e) { return text(500, "TENANT_TOKENS is not valid JSON"); }
    let tenant = null;
    for (const [t, name] of Object.entries(tenants)) if (sameText(token, t)) tenant = name;   // checks every token, no early exit
    if (!token || !tenant) return text(401, "Unauthorized");
    if (!env.WORKFLOWY_API_KEY) return text(500, "WORKFLOWY_API_KEY secret is not set");

    // 2. Allowlist method + path
    const url = new URL(request.url);
    if (!ALLOWED.some(([m, re]) => m === request.method && re.test(url.pathname))) return text(403, "Forbidden");

    // 3. Forward with the real key attached server-side (client headers are not passed through)
    const hasBody = !["GET", "HEAD"].includes(request.method);
    let upstream;
    try {
      upstream = await fetch(UPSTREAM + url.pathname + url.search, {
        method: request.method,
        headers: {
          Authorization: `Bearer ${env.WORKFLOWY_API_KEY}`,
          ...(hasBody ? { "Content-Type": "application/json" } : {}),
        },
        body: hasBody ? await request.arrayBuffer() : undefined,
      });
    } catch (e) {
      // WorkFlowy couldn't be reached: a clear 502 instead of Cloudflare's own error page.
      console.log(JSON.stringify({ tenant, method: request.method, path: url.pathname, status: 502, error: String(e && e.message || e) }));
      return text(502, "Couldn't reach WorkFlowy. Try again in a moment.");
    }

    // 4. Per-tenant usage log (see `npx wrangler tail`)
    console.log(JSON.stringify({ tenant, method: request.method, path: url.pathname, status: upstream.status }));

    // 5. Stream the response back (the full export can be large)
    // (WorkFlowy's Retry-After is passed on, so a "busy" 429 says how long to wait.)
    const headers = { "Content-Type": upstream.headers.get("content-type") || "application/json" };
    const retry = upstream.headers.get("retry-after");
    if (retry) headers["Retry-After"] = retry;
    return new Response(upstream.body, { status: upstream.status, headers });
  },
};
