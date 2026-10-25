// WorkFlowy week board: tiny proxy that keeps your API key off the browser.
// Version 1.1.0
// Run:  DEPLOY_MODE=local WORKFLOWY_API_KEY=your_key node server.js   (Node 18+)
// Open: http://localhost:3000
// DEPLOY_MODE is required: local, vps or fly (see README.md).

const VERSION = "1.1.0";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const KEY = process.env.WORKFLOWY_API_KEY;
const BASE = (process.env.WORKFLOWY_BASE_URL || "https://workflowy.com/api/v1").replace(/\/$/, "");
const PORT = Number(process.env.PORT || 3000);
// Default name of the notes bullet on today's page. Each browser can override it with the pencil in the board.
const NOTES_NAME = (process.env.NOTES_NAME || "").trim() || "WB-Notes";
const escapeAttr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* ---------- Where is this running? (a required choice, there is no default) ----------
   local  this computer only: reachable only from http://localhost, no login.
   vps    your own server behind Caddy (or nginx): HTTPS is done by the proxy, a password login is required.
   fly    Fly.io: HTTPS is done by Fly, a password login is required.
   Anything other than "local" is reachable from other machines, so it refuses to start without a password and
   the https:// address you'll use. */
const MODES = {
  local: "this computer only (http://localhost, no login; nothing else on the network can reach it)",
  vps: "your own server behind Caddy or nginx (HTTPS from the proxy, password login required)",
  fly: "Fly.io (HTTPS from Fly, password login required)",
};
const MODE = (process.env.DEPLOY_MODE || "").trim().toLowerCase();
if (!MODES[MODE]) {
  console.error(`
Choose where you are running the Workflowy Week Board by setting DEPLOY_MODE to one of:

  local   ${MODES.local}
  vps     ${MODES.vps}
  fly     ${MODES.fly}

${process.env.DEPLOY_MODE ? `"${process.env.DEPLOY_MODE}" is not one of them.\n\n` : ""}Examples:
  Mac/Linux:   DEPLOY_MODE=local WORKFLOWY_API_KEY=your_key node server.js
  Windows cmd: set DEPLOY_MODE=local   (then set WORKFLOWY_API_KEY=..., then node server.js)
  PowerShell:  $env:DEPLOY_MODE="local"

vps and fly also need BOARD_PASSWORD and PUBLIC_URL. See "Choose how to run it" in README.md.
`);
  process.exit(1);
}
const REMOTE = MODE !== "local";

if (!KEY) {
  console.error("Set WORKFLOWY_API_KEY first (get one at https://workflowy.com/api-key).");
  process.exit(1);
}

const BOARD_PASSWORD = process.env.BOARD_PASSWORD || "";
const SESSION_DAYS = Number(process.env.SESSION_DAYS) > 0 ? Number(process.env.SESSION_DAYS) : 7;
let PUBLIC = null;                    // the https address you visit (remote modes)
const isLoopback = (h) => ["127.0.0.1", "localhost", "::1", "[::1]"].includes(h);
if (REMOTE) {
  const problems = [];
  if (BOARD_PASSWORD.length < 12) problems.push("BOARD_PASSWORD must be set, to a password of at least 12 characters.");
  try {
    PUBLIC = new URL(process.env.PUBLIC_URL || "");
    if (PUBLIC.protocol !== "https:") throw new Error("not https");
  } catch (e) {
    problems.push("PUBLIC_URL must be the https:// address you will visit, for example https://board.example.com");
  }
  if (problems.length) {
    console.error(`DEPLOY_MODE=${MODE} is reachable from other machines, so it needs:\n  - ${problems.join("\n  - ")}`);
    process.exit(1);
  }
} else if (process.env.HOST && !isLoopback(process.env.HOST)) {
  console.error("DEPLOY_MODE=local only listens on this computer, so HOST must be 127.0.0.1 or unset. Use DEPLOY_MODE=vps or fly to be reachable from elsewhere.");
  process.exit(1);
}
// local: always this computer. vps: this machine (Caddy talks to it locally). fly: all interfaces (Fly's proxy needs that).
const HOST = REMOTE ? (process.env.HOST || (MODE === "fly" ? "0.0.0.0" : "127.0.0.1")) : "127.0.0.1";

// Only the node endpoints the board needs. The browser never gets the full export: search runs here (see below).
// Ids are letters, digits, "-" and "_" only (no slashes, dots or %-escapes), so a path can't be bent toward another endpoint.
const ALLOWED = /^\/api\/v1\/nodes(\/[A-Za-z0-9_-]{1,64}(\/(move|complete|uncomplete))?)?$/;
const ALLOWED_METHODS = ["GET", "POST", "DELETE"];
const MAX_BODY = 1024 * 1024;                  // largest request body the board may send through (1 MB)
const UPSTREAM_TIMEOUT_MS = 30 * 1000;         // give up on WorkFlowy after 30 seconds
const EXPORT_TIMEOUT_MS = 120 * 1000;          // the full export can be big, so it gets longer

/* ---------- Search index (lives only in this server's memory) ----------
   The whole outline is downloaded once through WorkFlowy's export, kept here, and searched here. The browser only
   ever receives the page of matches it asks for, and the one item it opens.
   - WorkFlowy limits the export to one request a minute, so a refresh is never made sooner than that.
   - The copy is re-downloaded when it is older than INDEX_MAX_AGE_MS and someone searches.
   - The copy is thrown away after IDLE_PURGE_MINUTES without a search (0 = never), so nothing sits in memory
     while you aren't using it. The next search downloads it again.
   - Edits that pass through this server (from the board or the item editor) are applied to the copy as they happen. */
const IDLE_PURGE_MINUTES = process.env.IDLE_PURGE_MINUTES === undefined ? 10 : Number(process.env.IDLE_PURGE_MINUTES);
const INDEX_MAX_AGE_MS = 5 * 60 * 1000;
const REFRESH_MIN_GAP_MS = 60 * 1000;
const ITEM_DEPTH = 12;

let idx = null;            // { byId: Map, kids: Map(parentId -> [nodes]), at }
let lastDownloadAt = 0;
let lastUse = Date.now();
let loading = null;

function stripHtml(s) {
  if (!s) return "";
  if (!/[<&]/.test(s)) return s;
  return s.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}

function addToKids(index, parentId, node) {
  if (!parentId) return;
  let list = index.kids.get(parentId);
  if (!list) index.kids.set(parentId, (list = []));
  list.push(node);
}

function makeNode(r) {
  const name = r.name || "", note = r.note || "";
  return {
    id: r.id, parent_id: r.parent_id || null, priority: r.priority || 0,
    name, note, lname: stripHtml(name).toLowerCase(), lnote: note ? stripHtml(note).toLowerCase() : "",
    layoutMode: (r.data && r.data.layoutMode) || "bullets",
    completedAt: r.completedAt || null, modifiedAt: r.modifiedAt || 0,
  };
}

function buildIndex(list) {
  const index = { byId: new Map(), kids: new Map(), at: Date.now() };
  for (const r of list) {
    if (!r || !r.id) continue;
    const n = makeNode(r);
    index.byId.set(n.id, n);
    addToKids(index, n.parent_id, n);
  }
  return index;
}

function fetchFailure(e) {
  const cause = e.cause ? (e.cause.code || e.cause.message || String(e.cause)) : "";
  return `${e.message}${cause ? " (" + cause + ")" : ""}`;
}

async function downloadIndex() {
  let upstream;
  try {
    upstream = await fetch(BASE + "/nodes-export", { headers: { Authorization: `Bearer ${KEY}` }, signal: AbortSignal.timeout(EXPORT_TIMEOUT_MS) });
  } catch (e) {
    console.error(`Export request to ${BASE} failed:`, fetchFailure(e));
    const err = new Error("upstream failed: " + fetchFailure(e)); err.status = 502; throw err;
  }
  if (!upstream.ok) {
    const err = new Error(`WorkFlowy export failed (${upstream.status})${upstream.status === 429 ? ": the export is limited to once a minute, try again shortly" : ""}`);
    err.status = upstream.status; throw err;
  }
  const data = await upstream.json();
  idx = buildIndex(Array.isArray(data.nodes) ? data.nodes : []);
  lastDownloadAt = Date.now();
}

// Makes sure there is a copy to search. Returns { throttled } where throttled means a fresh copy was asked for
// (or needed) but couldn't be fetched yet, so the existing copy was used.
async function ensureIndex(wantFresh) {
  lastUse = Date.now();
  if (loading) { try { await loading; } catch (e) { if (!idx) throw e; } }
  const age = idx ? Date.now() - idx.at : Infinity;
  const tooSoon = Date.now() - lastDownloadAt < REFRESH_MIN_GAP_MS;
  if (idx && !wantFresh && age < INDEX_MAX_AGE_MS) return { throttled: false };
  if (idx && tooSoon) return { throttled: wantFresh };
  try {
    loading = downloadIndex();
    await loading;
    return { throttled: false };
  } catch (e) {
    if (idx) return { throttled: true };          // e.g. rate limited: keep using the last copy
    throw e;
  } finally { loading = null; }
}

if (IDLE_PURGE_MINUTES > 0) {
  setInterval(() => {
    if (idx && Date.now() - lastUse > IDLE_PURGE_MINUTES * 60 * 1000) {
      idx = null;
      console.log(`Search index cleared from memory after ${IDLE_PURGE_MINUTES} minutes idle.`);
    }
  }, Math.min(30 * 1000, Math.max(500, IDLE_PURGE_MINUTES * 30 * 1000))).unref();
}

// ---- query: words (all must match), "exact phrase", -word / -"phrase" to leave matches out ----
function parseQuery(q) {
  const include = [], exclude = [];
  const re = /(-?)"([^"]*)"?|(-?)(\S+)/g;
  let m;
  while ((m = re.exec(q.toLowerCase()))) {
    const neg = (m[1] || m[3]) === "-";
    const text = (m[2] !== undefined ? m[2] : m[4]).trim();
    if (text) (neg ? exclude : include).push(text);
  }
  return { include, exclude };
}

function pathNames(n) {
  const out = [];
  let p = n.parent_id ? idx.byId.get(n.parent_id) : null;
  for (let guard = 0; p && guard < 60; guard++) {
    out.unshift(stripHtml(p.name) || "(empty)");
    p = p.parent_id ? idx.byId.get(p.parent_id) : null;
  }
  return out;
}

function noteSnippet(n, terms) {
  const plainNote = stripHtml(n.note);
  const lower = plainNote.toLowerCase();
  if (lower.length !== plainNote.length) return plainNote.slice(0, 100);
  for (const t of terms) {
    const i = lower.indexOf(t);
    if (i !== -1) {
      const start = Math.max(0, i - 30);
      return (start ? "…" : "") + plainNote.slice(start, start + 100) + (start + 100 < plainNote.length ? "…" : "");
    }
  }
  return "";
}

function search(params) {
  const { include: terms, exclude } = parseQuery(params.q);
  if (!terms.length) return { terms, total: 0, hits: [] };
  const found = [];
  for (const n of idx.byId.values()) {
    if (!params.done && n.completedAt) continue;
    if (params.todos && n.layoutMode !== "todo") continue;
    let ok = true;
    for (const t of exclude) {
      if (n.lname.includes(t) || (params.notes && n.lnote.includes(t))) { ok = false; break; }
    }
    if (!ok) continue;
    let nameHit = true;
    for (const t of terms) {
      const a = n.lname.includes(t);
      if (!a) nameHit = false;
      if (!a && !(params.notes && n.lnote.includes(t))) { ok = false; break; }
    }
    if (ok) found.push({ n, nameHit });
  }
  found.sort((a, b) => (b.nameHit - a.nameHit) || (b.n.modifiedAt - a.n.modifiedAt));
  const hits = found.slice(params.offset, params.offset + params.limit).map(({ n, nameHit }) => ({
    id: n.id, name: stripHtml(n.name), path: pathNames(n),
    todo: n.layoutMode === "todo", done: !!n.completedAt, nameHit,
    snippet: nameHit ? "" : noteSnippet(n, terms),
  }));
  return { terms, total: found.length, hits };
}

function sortedKids(id) {
  return (idx.kids.get(id) || []).slice().sort((a, b) => a.priority - b.priority);
}

function itemTree(n, depth) {
  return {
    id: n.id, name: n.name, note: n.note, data: { layoutMode: n.layoutMode }, completedAt: n.completedAt,
    children: depth > 1 ? sortedKids(n.id).map((c) => itemTree(c, depth - 1)) : [],
  };
}

function sendJson(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}

async function serveSearch(url, res) {
  const p = url.searchParams;
  try {
    const { throttled } = await ensureIndex(p.get("refresh") === "1");
    const limit = Math.min(200, Math.max(1, Number(p.get("limit")) || 50));
    const offset = Math.max(0, Number(p.get("offset")) || 0);
    const r = search({ q: p.get("q") || "", notes: p.get("notes") !== "0", done: p.get("done") !== "0", todos: p.get("todos") === "1", offset, limit });
    sendJson(res, 200, { ...r, offset, count: idx.byId.size, indexTime: idx.at, throttled });
  } catch (e) {
    sendJson(res, e.status && e.status >= 400 ? e.status : 502, { error: e.message });
  }
}

// Tasks ticked off between two moments (epoch seconds), newest first. Used by the board's "Done" window.
const DONE_LIMIT = 1000;
const doneSeconds = (n) => (n.completedAt > 1e11 ? n.completedAt / 1000 : n.completedAt);   // tolerate milliseconds
function doneList(from, to) {
  const found = [];
  for (const n of idx.byId.values()) {
    if (!n.completedAt) continue;
    const t = doneSeconds(n);
    if (t >= from && t < to) found.push({ n, t });
  }
  found.sort((a, b) => b.t - a.t);
  return {
    total: found.length,
    hits: found.slice(0, DONE_LIMIT).map(({ n, t }) => ({ id: n.id, name: stripHtml(n.name), path: pathNames(n), completedAt: t, todo: n.layoutMode === "todo" })),
  };
}

async function serveDone(url, res) {
  const p = url.searchParams;
  const from = Number(p.get("from")), to = Number(p.get("to"));
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return sendJson(res, 400, { error: "from and to (epoch seconds) are required" });
  try {
    const { throttled } = await ensureIndex(p.get("refresh") === "1");
    sendJson(res, 200, { ...doneList(from, to), limit: DONE_LIMIT, count: idx.byId.size, indexTime: idx.at, throttled });
  } catch (e) {
    sendJson(res, e.status && e.status >= 400 ? e.status : 502, { error: e.message });
  }
}

// WorkFlowy links end in the last 12 characters of a node's full id. The API wants the full id, so look it up here.
async function serveResolve(url, res) {
  const p = url.searchParams;
  const short = (p.get("short") || "").toLowerCase();
  if (!/^[0-9a-f]{12}$/.test(short)) return sendJson(res, 400, { error: "that isn't a 12-character WorkFlowy link id" });
  try {
    const { throttled } = await ensureIndex(p.get("refresh") === "1");
    const hits = [];
    for (const n of idx.byId.values()) if (n.id.toLowerCase().endsWith("-" + short) || n.id.toLowerCase() === short) hits.push(n);
    if (!hits.length) return sendJson(res, 404, { error: "no node ends in that id (is it in your outline? try Refresh index in Search)", throttled });
    if (hits.length > 1) return sendJson(res, 409, { error: "more than one node matches that id" });
    sendJson(res, 200, { id: hits[0].id, name: stripHtml(hits[0].name || ""), throttled });
  } catch (e) {
    sendJson(res, e.status && e.status >= 400 ? e.status : 502, { error: e.message });
  }
}

async function serveItem(url, res) {
  const p = url.searchParams;
  try {
    const { throttled } = await ensureIndex(p.get("refresh") === "1");
    const n = idx.byId.get(p.get("id") || "");
    if (!n) return sendJson(res, 404, { error: "item not found" });
    sendJson(res, 200, { item: itemTree(n, ITEM_DEPTH), path: pathNames(n), indexTime: idx.at, throttled });
  } catch (e) {
    sendJson(res, e.status && e.status >= 400 ? e.status : 502, { error: e.message });
  }
}

// ---- keep the copy in step with edits that pass through this server ----
function removeFromKids(parentId, node) {
  const list = parentId && idx.kids.get(parentId);
  if (list) { const i = list.indexOf(node); if (i !== -1) list.splice(i, 1); }
}
function edgePriority(parentId, position) {
  const list = (parentId && idx.kids.get(parentId)) || [];
  if (!list.length) return 100;
  const ps = list.map((c) => c.priority);
  return position === "top" ? Math.min(...ps) - 100 : Math.max(...ps) + 100;
}
function dropSubtree(n) {
  for (const c of (idx.kids.get(n.id) || []).slice()) dropSubtree(c);
  idx.kids.delete(n.id);
  idx.byId.delete(n.id);
}

function patchIndex(method, pathname, reqBody, resBody) {
  if (!idx) return;
  const m = pathname.match(/^\/api\/v1\/nodes(?:\/([^/]+)(?:\/(move|complete|uncomplete))?)?$/);
  if (!m) return;
  const id = m[1], action = m[2];
  if (!id && method === "POST") {                                   // create
    const newId = resBody && resBody.item_id;
    if (!newId || !reqBody) return;
    const todo = String(reqBody.name || "").match(/^- \[( |x|X)\]\s+([\s\S]*)$/);
    const n = makeNode({
      id: newId, parent_id: reqBody.parent_id, name: todo ? todo[2] : reqBody.name, note: reqBody.note,
      priority: edgePriority(reqBody.parent_id, reqBody.position),
      data: { layoutMode: reqBody.layoutMode || (todo ? "todo" : "bullets") },
      completedAt: todo && todo[1] !== " " ? Math.floor(Date.now() / 1000) : null,
      modifiedAt: Math.floor(Date.now() / 1000),
    });
    idx.byId.set(n.id, n);
    addToKids(idx, n.parent_id, n);
    return;
  }
  const n = id && idx.byId.get(id);
  if (method === "DELETE" && id) { if (n) { removeFromKids(n.parent_id, n); dropSubtree(n); } return; }
  if (method !== "POST" || !n) return;
  const now = Math.floor(Date.now() / 1000);
  if (action === "complete") { n.completedAt = now; n.modifiedAt = now; }
  else if (action === "uncomplete") { n.completedAt = null; n.modifiedAt = now; }
  else if (action === "move" && reqBody) {
    removeFromKids(n.parent_id, n);
    n.priority = edgePriority(reqBody.parent_id, reqBody.position);
    n.parent_id = reqBody.parent_id || null;
    addToKids(idx, n.parent_id, n);
    n.modifiedAt = now;
  } else if (!action && reqBody) {                                   // update
    if (typeof reqBody.name === "string") { n.name = reqBody.name; n.lname = stripHtml(reqBody.name).toLowerCase(); }
    if (typeof reqBody.note === "string") { n.note = reqBody.note; n.lnote = stripHtml(reqBody.note).toLowerCase(); }
    if (typeof reqBody.layoutMode === "string") n.layoutMode = reqBody.layoutMode;
    n.modifiedAt = now;
  }
}

/* ---------- Update check (is there a newer version on GitHub?) ----------
   Reads the VERSION line of server.js on GitHub (cached for 6 hours) and reports it to the page.
   Set UPDATE_CHECK=0 to turn it off, or UPDATE_URL to point at another raw copy of server.js. */
const UPDATE_CHECK = process.env.UPDATE_CHECK !== "0";
const UPDATE_URL = process.env.UPDATE_URL || "https://raw.githubusercontent.com/robbk17/workflowy-weekboard/main/server.js";
const REPO_URL = (process.env.UPDATE_URL ? "" : "https://github.com/robbk17/workflowy-weekboard");
const UPDATE_TTL_MS = 6 * 60 * 60 * 1000;
let updateCache = null;   // { latest, at }

async function serveUpdate(res) {
  if (!UPDATE_CHECK) return sendJson(res, 200, { current: VERSION, latest: null, disabled: true });
  if (!updateCache || Date.now() - updateCache.at > UPDATE_TTL_MS) {
    let latest = null;
    try {
      const r = await fetch(UPDATE_URL, { signal: AbortSignal.timeout(8000) });
      if (r.ok) { const m = (await r.text()).match(/const VERSION = "(\d+\.\d+\.\d+)"/); if (m) latest = m[1]; }
    } catch (e) { /* offline or blocked: just no answer */ }
    updateCache = { latest, at: Date.now() - (latest ? 0 : UPDATE_TTL_MS - 10 * 60 * 1000) };   // retry a failure after 10 min
  }
  return sendJson(res, 200, { current: VERSION, latest: updateCache.latest, url: REPO_URL });
}

/* ---------- Access control ---------- */
const SESSION_COOKIE = "__Host-wb_session";     // __Host- means: HTTPS only, this exact site, no subdomains
const sessions = new Map();                      // token -> expiry time (lost on restart: you just sign in again)
const failures = new Map();                      // client address -> { count, until }
const MAX_FAILS = 5, LOCKOUT_MS = 15 * 60 * 1000;

function applySecurityHeaders(res) {
  // Scripts only run if they carry this one-time token (a fresh one for every page load), so injected script is refused.
  res.nonce = crypto.randomBytes(16).toString("base64");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Security-Policy",
    `default-src 'self'; script-src 'nonce-${res.nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; ` +
    "connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'");
  if (REMOTE) res.setHeader("Strict-Transport-Security", "max-age=31536000");
}

function clientIp(req) {
  if (REMOTE) {
    if (MODE === "fly" && req.headers["fly-client-ip"]) return String(req.headers["fly-client-ip"]);
    const xff = String(req.headers["x-forwarded-for"] || "").split(",").map((x) => x.trim()).filter(Boolean);
    if (xff.length) return xff[xff.length - 1];       // the proxy adds the real client address last
  }
  return req.socket.remoteAddress || "unknown";
}

function hostAllowed(req) {
  const host = String(req.headers.host || "").toLowerCase();
  if (REMOTE) return host === PUBLIC.host.toLowerCase();
  return isLoopback(host.replace(/:\d+$/, ""));        // localhost / 127.0.0.1 / [::1] on any port
}

// Writes (POST/DELETE) must come from this site's own page, so another website can't make requests for you.
function originAllowed(req) {
  const origin = req.headers.origin;
  if (origin) {
    try { const h = new URL(origin).host.toLowerCase(); return REMOTE ? h === PUBLIC.host.toLowerCase() : isLoopback(h.replace(/:\d+$/, "")); }
    catch (e) { return false; }
  }
  const site = req.headers["sec-fetch-site"];
  return !site || site === "same-origin" || site === "none";
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}
function sessionValid(req) {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  const exp = token && sessions.get(token);
  if (!exp) return false;
  if (exp < Date.now()) { sessions.delete(token); return false; }
  return true;
}
const sha = (s) => crypto.createHash("sha256").update(s).digest();
const passwordOk = (given) => crypto.timingSafeEqual(sha(given), sha(BOARD_PASSWORD));
const sessionCookie = (value, maxAge) => `${SESSION_COOKIE}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;

function loginPage(message) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sign in - Workflowy Week Board</title>
<style>
  :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f4f5f7; color: #1f2933; }
  @media (prefers-color-scheme: dark) { body { background: #16191d; color: #e6e8eb; } input { background: #22272e; color: inherit; } }
  form { width: min(320px, 90vw); display: flex; flex-direction: column; gap: 12px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  input, button { font: inherit; padding: 9px 10px; border-radius: 6px; border: 1px solid #9aa5b1; }
  button { cursor: pointer; font-weight: 600; }
  .err { color: #c0392b; margin: 0; font-size: 14px; }
</style></head><body>
<form method="post" action="/login">
  <h1>Workflowy Week Board</h1>
  ${message ? `<p class="err">${message}</p>` : ""}
  <input type="password" name="password" placeholder="Password" autocomplete="current-password" autofocus required>
  <button type="submit">Sign in</button>
</form></body></html>`;
}

function sendHtml(res, status, html, extra) {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8", ...(extra || {}) });
  res.end(html);
}

async function handleLogin(req, res) {
  if (req.method === "GET") return sendHtml(res, 200, loginPage(""));
  if (req.method !== "POST") { res.writeHead(405); return res.end(); }
  const ip = clientIp(req);
  const rec = failures.get(ip);
  if (rec && rec.until > Date.now()) {
    const mins = Math.ceil((rec.until - Date.now()) / 60000);
    return sendHtml(res, 429, loginPage(`Too many attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`));
  }
  const raw = await readBody(req, 4096).catch(() => null);
  const given = raw ? (new URLSearchParams(raw.toString()).get("password") || "") : "";
  if (raw && passwordOk(given)) {
    failures.delete(ip);
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, Date.now() + SESSION_DAYS * 86400000);
    return sendHtml(res, 303, "", { Location: "/", "Set-Cookie": sessionCookie(token, SESSION_DAYS * 86400) });
  }
  const next = { count: (rec ? rec.count : 0) + 1, until: 0 };
  if (next.count >= MAX_FAILS) { next.until = Date.now() + LOCKOUT_MS; next.count = 0; }
  failures.set(ip, next);
  console.warn(`Failed sign-in from ${ip}${next.until ? " (locked out for 15 minutes)" : ""}`);
  await new Promise((r) => setTimeout(r, 500));          // slows down guessing
  return sendHtml(res, 401, loginPage("Wrong password."));
}

// Runs before every request. Returns true when the request may continue to the normal routes.
async function guard(req, res, url) {
  applySecurityHeaders(res);
  if (url.pathname === "/healthz") { res.writeHead(200, { "Content-Type": "text/plain" }); res.end("ok"); return false; }

  if (!hostAllowed(req)) {
    res.writeHead(421, { "Content-Type": "text/plain" });
    res.end(REMOTE ? `Use ${PUBLIC.origin}` : "Open this at http://localhost");
    return false;
  }
  const writes = !["GET", "HEAD", "OPTIONS"].includes(req.method);
  if (writes && !originAllowed(req)) {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "cross-site request blocked" }));
    return false;
  }
  if (!REMOTE) return true;

  const proto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  if (proto !== "https") {                                  // the proxy must be speaking HTTPS to the browser
    if (!writes) { res.writeHead(308, { Location: PUBLIC.origin + req.url }); res.end(); }
    else { res.writeHead(400, { "Content-Type": "text/plain" }); res.end("HTTPS required"); }
    return false;
  }
  if (url.pathname === "/login") { await handleLogin(req, res); return false; }
  if (url.pathname === "/logout" && req.method === "POST") {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (token) sessions.delete(token);
    res.writeHead(204, { "Set-Cookie": sessionCookie("", 0) });
    res.end();
    return false;
  }
  if (sessionValid(req)) return true;
  const isData = url.pathname.startsWith("/api/") || ["/search", "/item", "/done", "/resolve", "/update-check"].includes(url.pathname);
  if (isData) { res.writeHead(401, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "login required" })); }
  else { res.writeHead(302, { Location: "/login" }); res.end(); }
  return false;
}

if (REMOTE) {
  setInterval(() => {                                       // forget expired sessions and old lockouts
    const now = Date.now();
    for (const [t, exp] of sessions) if (exp < now) sessions.delete(t);
    for (const [ip, r] of failures) if (r.until < now && r.count === 0) failures.delete(ip);
    if (failures.size > 5000) failures.clear();
  }, 10 * 60 * 1000).unref();
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (limit && size > limit) { reject(new Error("body too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, "http://localhost"); } catch (e) { res.writeHead(400); return res.end(); }
  if (!(await guard(req, res, url))) return;

  if (req.method === "GET" && url.pathname === "/update-check") return serveUpdate(res);
  if (req.method === "GET" && url.pathname === "/search") return serveSearch(url, res);
  if (req.method === "GET" && url.pathname === "/item") return serveItem(url, res);
  if (req.method === "GET" && url.pathname === "/resolve") return serveResolve(url, res);
  if (req.method === "GET" && url.pathname === "/done") return serveDone(url, res);

  if (url.pathname.startsWith("/api/")) {
    if (!ALLOWED.test(url.pathname)) {
      res.writeHead(403, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "endpoint not allowed" }));
    }
    if (!ALLOWED_METHODS.includes(req.method)) {
      res.writeHead(405, { "Content-Type": "application/json", Allow: ALLOWED_METHODS.join(", ") });
      return res.end(JSON.stringify({ error: "method not allowed" }));
    }
    try {
      let body;
      if (req.method === "POST") {
        try { body = await readBody(req, MAX_BODY); }
        catch (e) { res.writeHead(413, { "Content-Type": "application/json", Connection: "close" }); return res.end(JSON.stringify({ error: "request too large" })); }
      }
      const upstream = await fetch(BASE + url.pathname.replace("/api/v1", "") + url.search, {
        method: req.method,
        headers: {
          Authorization: `Bearer ${KEY}`,
          ...(body && body.length ? { "Content-Type": "application/json" } : {}),
        },
        body: body && body.length ? body : undefined,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      const text = await upstream.text();
      if (upstream.ok && ["POST", "DELETE"].includes(req.method)) {
        try { patchIndex(req.method, url.pathname, body && body.length ? JSON.parse(body.toString()) : null, text ? JSON.parse(text) : null); }
        catch (e) { /* the copy just stays as it was until the next refresh */ }
      }
      res.writeHead(upstream.status, {
        "Content-Type": upstream.headers.get("content-type") || "application/json",
      });
      return res.end(text);
    } catch (e) {
      // Node's fetch hides the real reason in e.cause (DNS, TLS, proxy, timeout...)
      const cause = e.cause ? (e.cause.code || e.cause.message || String(e.cause)) : "";
      console.error(`Upstream request to ${BASE} failed:`, e.message, cause);
      res.writeHead(502, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: `upstream failed: ${e.message}${cause ? " (" + cause + ")" : ""}` }));
    }
  }

  if (url.pathname === "/" || url.pathname === "/index.html") {
    // Pass the configured notes-bullet name to the page through its notes-name meta tag.
    const page = fs.readFileSync(path.join(__dirname, "index.html"), "utf8")
      .replace(/(<meta name="notes-name" content=")[^"]*(")/, (_, a, b) => a + escapeAttr(NOTES_NAME) + b)
      .replace(/(<meta name="remote" content=")[^"]*(")/, (_, a, b) => a + (REMOTE ? "1" : "0") + b)
      .replace(/<script>/g, `<script nonce="${res.nonce}">`);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(page);
  }

  res.writeHead(404);
  res.end("not found");
});

// Your key has full access to your outline: "local" listens on this computer only; the other modes require a login.
server.listen(PORT, HOST, () => {
  const where = REMOTE ? PUBLIC.origin : `http://localhost:${PORT}`;
  console.log(`Workflowy Week Board v${VERSION} running at ${where}  (mode: ${MODE}, listening on ${HOST}:${PORT}, API: ${BASE}, notes bullet: "${NOTES_NAME}")`);
  if (REMOTE) console.log(`Login required. Sessions last ${SESSION_DAYS} day${SESSION_DAYS === 1 ? "" : "s"}.`);
});
