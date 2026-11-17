// Offline logic test: runs the Worker with a mocked upstream (no network, no real key needed).
import worker from "./worker.js";

const env = { WORKFLOWY_API_KEY: "REAL_KEY", TENANT_TOKENS: JSON.stringify({ tok_test: "weekboard" }) };
const calls = [];
globalThis.fetch = async (url, init) => {
  calls.push({ url, init });
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
};

const base = "https://proxy.example.workers.dev";
const call = (method, path, { token = "tok_test", body } = {}) =>
  worker.fetch(new Request(base + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" }, body }), env);

let failed = 0;
const check = (name, cond) => { console.log((cond ? "PASS" : "FAIL") + "  " + name); if (!cond) failed++; };

// Auth
check("no token -> 401", (await call("GET", "/api/v1/targets", { token: null })).status === 401);
check("wrong token -> 401", (await call("GET", "/api/v1/targets", { token: "nope" })).status === 401);
check("real key as token -> 401", (await call("GET", "/api/v1/targets", { token: "REAL_KEY" })).status === 401);
check("no upstream call made for rejected requests", calls.length === 0);

// Allowed: every call the Week Board makes
const allowed = [
  ["GET", "/api/v1/nodes-export"], ["GET", "/api/v1/targets"],
  ["GET", "/api/v1/nodes?parent_id=inbox"], ["POST", "/api/v1/nodes"],
  ["GET", "/api/v1/nodes/inbox"], ["GET", "/api/v1/nodes/6ed4b9ca-256c-bf2e-bd70-d8754237b505"],
  ["POST", "/api/v1/nodes/d8754237b505"], ["DELETE", "/api/v1/nodes/d8754237b505"],
  ["POST", "/api/v1/nodes/abc-123/move"], ["POST", "/api/v1/nodes/abc-123/complete"], ["POST", "/api/v1/nodes/abc-123/uncomplete"],
];
for (const [m, p] of allowed) check(`allowed ${m} ${p}`, (await call(m, p, { body: m === "POST" ? "{}" : undefined })).status === 200);

// Blocked
const blocked = [
  ["GET", "/api/v1/nodes/abc/mirror"], ["POST", "/api/v1/nodes/abc/mirror"], ["DELETE", "/api/v1/nodes/abc/mirror"],
  ["DELETE", "/api/v1/nodes"], ["PUT", "/api/v1/nodes/abc"], ["GET", "/api/v1/account"],
  ["GET", "/api/v1/nodes/../../etc"], ["GET", "/other/path"], ["GET", "/api/v1/nodes/abc%2Fmirror"],
];
for (const [m, p] of blocked) check(`blocked ${m} ${p}`, (await call(m, p)).status === 403);

// Forwarding details
calls.length = 0;
await call("GET", "/api/v1/nodes?parent_id=inbox");
check("upstream URL + query preserved", calls[0].url === "https://workflowy.com/api/v1/nodes?parent_id=inbox");
check("real key attached upstream", calls[0].init.headers.Authorization === "Bearer REAL_KEY");
check("tenant token not leaked upstream", !JSON.stringify(calls[0].init.headers).includes("tok_test"));
calls.length = 0;
await call("POST", "/api/v1/nodes", { body: JSON.stringify({ parent_id: "inbox", name: "hi" }) });
check("POST body forwarded", Buffer.from(calls[0].init.body).toString() === '{"parent_id":"inbox","name":"hi"}');

// Tokens: a near miss is refused, and every listed token works
const env2 = { WORKFLOWY_API_KEY: "REAL_KEY", TENANT_TOKENS: JSON.stringify({ tok_test: "weekboard", tok_phone_9f: "phone" }) };
const call2 = (token) => worker.fetch(new Request(base + "/api/v1/targets", { headers: { Authorization: `Bearer ${token}` } }), env2);
check("second listed token works", (await call2("tok_phone_9f")).status === 200);
check("token one character short -> 401", (await call2("tok_tes")).status === 401);
check("token with one extra character -> 401", (await call2("tok_testx")).status === 401);
check("same length, last character wrong -> 401", (await call2("tok_tesu")).status === 401);

// WorkFlowy busy: the 429 and its Retry-After come back to the board
globalThis.fetch = async () => new Response(JSON.stringify({ retry_after: 7 }), { status: 429, headers: { "content-type": "application/json", "retry-after": "7" } });
let r = await call("GET", "/api/v1/nodes?parent_id=inbox");
check("upstream 429 passed through", r.status === 429);
check("Retry-After passed through", r.headers.get("retry-after") === "7");
check("429 body (retry_after) passed through", (await r.json()).retry_after === 7);

// WorkFlowy unreachable: a clear 502, not an exception
globalThis.fetch = async () => { throw new TypeError("network connection lost"); };
r = await call("GET", "/api/v1/targets");
check("upstream unreachable -> 502", r.status === 502);
check("502 has a readable message", /Couldn't reach WorkFlowy/.test(await r.text()));

console.log(failed ? `\n${failed} FAILED` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
