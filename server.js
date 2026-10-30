// WorkFlowy week board: tiny proxy that keeps your API key off the browser.
// Version 1.3.0
// Run:  DEPLOY_MODE=local WORKFLOWY_API_KEY=your_key node server.js   (Node 18+)
// Open: http://localhost:3000
// DEPLOY_MODE is required: local, vps or fly (see README.md).

const VERSION = "1.3.0";

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
// ASSUME_HTTPS=1: for a proxy on this same computer that doesn't send X-Forwarded-Proto (for example `tailscale serve`). Only honoured while the board listens on this computer alone.
const ASSUME_HTTPS = process.env.ASSUME_HTTPS === "1" && REMOTE && isLoopback(process.env.HOST || "127.0.0.1");
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

// Encrypted text from the Encryption add-on ("wbenc1." + letters, digits, "-", "_"). Anything that leaves this server as a
// message (push reminders) shows a lock instead, so an encrypted value is never sent to a push service as a long string.
const maskTokens = (s) => String(s).replace(/wbenc1\.[A-Za-z0-9_-]{59,}/g, "🔒");

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

const wordRes = new Map();
function hasTerm(text, t, whole) {
  if (!whole) return text.includes(t);
  let re = wordRes.get(t);
  if (!re) {      // the term must not sit inside a longer word ("nature" is not in "signature")
    re = new RegExp(`(?<![\\p{L}\\p{N}_])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}_])`, "u");
    if (wordRes.size > 500) wordRes.clear();
    wordRes.set(t, re);
  }
  return re.test(text);
}

// params.whole: match whole words only (used by the assistant; the Search window keeps matching parts of words)
function search(params) {
  const { include: terms, exclude } = parseQuery(params.q);
  if (!terms.length) return { terms, total: 0, hits: [] };
  const found = [];
  for (const n of idx.byId.values()) {
    if (!params.done && n.completedAt) continue;
    if (params.todos && n.layoutMode !== "todo") continue;
    let ok = true;
    for (const t of exclude) {
      if (hasTerm(n.lname, t, params.whole) || (params.notes && hasTerm(n.lnote, t, params.whole))) { ok = false; break; }
    }
    if (!ok) continue;
    let nameHit = true;
    for (const t of terms) {
      const a = hasTerm(n.lname, t, params.whole);
      if (!a) nameHit = false;
      if (!a && !(params.notes && hasTerm(n.lnote, t, params.whole))) { ok = false; break; }
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
  // A browser sends "Origin: null" for a form posted from a page whose Referrer-Policy is no-referrer (the sign-in form). The browser-set Sec-Fetch-Site still tells us it was this site.
  if (origin === "null") return req.headers["sec-fetch-site"] === "same-origin";
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
    const seen = `origin ${req.headers.origin || "(none)"}, sec-fetch-site ${req.headers["sec-fetch-site"] || "(none)"}, host ${req.headers.host || "(none)"}`;
    console.error(`Blocked a ${req.method} to ${url.pathname}: ${seen}; this board expects ${REMOTE ? PUBLIC.host : "localhost"}`);
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: `cross-site request blocked (${seen}; expected ${REMOTE ? PUBLIC.host : "localhost"})` }));
    return false;
  }
  if (!REMOTE) return true;

  const proto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  if (proto !== "https" && !ASSUME_HTTPS) {                 // the proxy must be speaking HTTPS to the browser
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
  if (APP_ASSETS.has(url.pathname)) return true;          // the manifest and icons are fetched without the sign-in cookie
  if (sessionValid(req)) return true;
  const isData = url.pathname.startsWith("/api/") || ["/search", "/item", "/done", "/resolve", "/update-check", "/addons", "/reminders", "/reminders/test", "/m/settings"].includes(url.pathname) || addonPaths.has(url.pathname);
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

/* ---------- Add-ons ----------
   Each folder in addons/ with a manifest.json is an optional add-on (see addons/README.md). Add-ons are trusted code:
   they run inside this server with your WorkFlowy key. Install only ones you trust. Without an addons/ folder the board is
   exactly the plain board. */
const APP_ASSETS = new Set(["/manifest.webmanifest", "/icon-180.png", "/icon-192.png", "/icon-512.png"]);
const APP_MANIFEST = {
  name: "Workflowy Week Board", short_name: "Week Board", description: "Your WorkFlowy tasks by day",
  start_url: "/m", scope: "/", display: "standalone", orientation: "any", background_color: "#f4f5f7", theme_color: "#2f6fed",
  icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" }, { src: "/icon-180.png", sizes: "180x180", type: "image/png" }],
};
const CORE_PATHS = new Set(["/", "/index.html", "/m", "/mobile.html", "/manifest.webmanifest", "/icon-180.png", "/icon-192.png", "/icon-512.png", "/search", "/item", "/done", "/resolve", "/update-check", "/login", "/logout", "/healthz", "/addons", "/reminders", "/reminders/test", "/m/settings"]);
/* ---------- Phone page settings shared between devices ----------
   Off unless a device turns on "Share settings across my devices" on the phone page. Only a few known choices are kept
   (week length, Past due, Upcoming, completed tasks, tasks under bullets, Inbox), in one small file next to server.js.
   MOBILE_SYNC=off disables it for everyone. */
const MOBILE_SYNC = String(process.env.MOBILE_SYNC || "").toLowerCase() !== "off";
const MOBILE_SETTINGS_FILE = process.env.MOBILE_SETTINGS_FILE || path.join(__dirname, "mobile-settings.json");
function cleanMobileSettings(x) {
  if (!x || typeof x !== "object" || Array.isArray(x)) throw new Error("settings must be an object");
  const out = {};
  if (x.nested !== undefined) { if (!["group", "flatten", "off"].includes(x.nested)) throw new Error("bad nested"); out.nested = x.nested; }
  if (x.span !== undefined) { if (!["5", "7", "7s"].includes(x.span)) throw new Error("bad span"); out.span = x.span; }
  for (const k of ["showLate", "showSoon", "showDone"]) if (x[k] !== undefined) { if (typeof x[k] !== "boolean") throw new Error("bad " + k); out[k] = x[k]; }
  if (x.inbox !== undefined) {
    if (x.inbox === null) out.inbox = null;
    else if (x.inbox && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(x.inbox.id))) out.inbox = { id: String(x.inbox.id).toLowerCase(), name: String(x.inbox.name || "Inbox").slice(0, 30) };
    else throw new Error("bad inbox");
  }
  return out;
}
async function serveMobileSettings(req, res) {
  if (!MOBILE_SYNC) return sendJson(res, req.method === "GET" ? 200 : 403, { enabled: false, error: req.method === "GET" ? undefined : "Settings sharing is turned off on this server (MOBILE_SYNC=off)." });
  let saved = null;
  try { saved = JSON.parse(fs.readFileSync(MOBILE_SETTINGS_FILE, "utf8")); } catch (e) { /* none saved yet */ }
  if (req.method === "GET") return sendJson(res, 200, { enabled: true, settings: saved ? saved.settings || null : null, updated: saved ? saved.updated || null : null });
  let body;
  try { body = JSON.parse((await readBody(req, 16 * 1024)).toString() || "{}"); }
  catch (e) { return sendJson(res, 400, { error: "bad request" }); }
  let settings;
  try { settings = cleanMobileSettings(body.settings); } catch (e) { return sendJson(res, 400, { error: e.message }); }
  const merged = { ...((saved && saved.settings) || {}), ...settings };
  const doc = { settings: merged, updated: new Date().toISOString() };
  try {
    const tmp = MOBILE_SETTINGS_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(doc, null, 2));
    fs.renameSync(tmp, MOBILE_SETTINGS_FILE);
  } catch (e) { console.error("Could not save the phone settings:", e.message); return sendJson(res, 500, { error: "The server could not write " + path.basename(MOBILE_SETTINGS_FILE) + " (is the board folder writable?)" }); }
  return sendJson(res, 200, { enabled: true, settings: merged, updated: doc.updated });
}
const addons = [];                    // { id, name, version, description, status, error, docs }
const addonRoutes = new Map();        // "METHOD /path" -> handler
const addonPaths = new Set();         // paths the login guard should treat as data
const addonParts = { css: [], button: [], panel: [], tab: [], pane: [] };
const addonScripts = [];
const versionAtLeast = (have, need) => {
  const a = String(have).split(".").map(Number), b = String(need).split(".").map(Number);
  for (let i = 0; i < 3; i++) { const x = a[i] || 0, y = b[i] || 0; if (x !== y) return x > y; }
  return true;
};
function loadAddons() {
  const root = path.join(__dirname, "addons");
  let dirs = [];
  try { dirs = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort(); } catch (e) { return; }
  for (const dir of dirs) {
    const base = path.join(root, dir);
    if (!fs.existsSync(path.join(base, "manifest.json"))) continue;
    const entry = { id: dir, name: dir, version: "?", description: "", status: "error", error: "" };
    addons.push(entry);
    const staged = { parts: {}, script: null, routes: [] };
    try {
      let m;
      try { m = JSON.parse(fs.readFileSync(path.join(base, "manifest.json"), "utf8")); } catch (e) { throw new Error("manifest.json is not valid JSON"); }
      entry.name = String(m.name || dir).slice(0, 60); entry.version = String(m.version || "?").slice(0, 20);
      entry.description = String(m.description || "").slice(0, 300);
      if (m.docs && /^[\w.-]+$/.test(m.docs)) entry.docs = m.docs;
      if (m.id !== dir || !/^[a-z0-9-]{1,32}$/.test(dir)) throw new Error("the manifest id must match the folder name (lowercase letters, digits, dashes)");
      if (!/^\d+\.\d+\.\d+$/.test(entry.version)) throw new Error("the manifest needs a version like 1.0.0");
      const need = m.requires && m.requires.board;
      if (need && !versionAtLeast(VERSION, need)) throw new Error(`needs board ${need} or newer (this is ${VERSION}); update server.js and index.html`);
      if (m.localOnly && REMOTE) { entry.status = "skipped"; entry.error = "only works in local mode"; continue; }
      const file = (key) => {
        const f = m[key];
        if (!f) return null;
        if (!/^[\w.-]+$/.test(f)) throw new Error(`bad file name for "${key}"`);
        const full = path.join(base, f);
        if (!fs.existsSync(full)) throw new Error(`${f} is missing`);
        return full;
      };
      if (m.page) {
        const html = fs.readFileSync(file("page"), "utf8");
        for (const name of Object.keys(addonParts)) {
          const mm = html.match(new RegExp(`<!--@${name}-->([\\s\\S]*?)<!--/@${name}-->`));
          if (mm) staged.parts[name] = mm[1];
        }
      }
      if (m.script) staged.script = fs.readFileSync(file("script"), "utf8");
      if (m.server) {
        const mod = require(file("server"))({ REMOTE, KEY, BASE, UPSTREAM_TIMEOUT_MS, stripHtml, ensureIndex, search, parseQuery, itemTree, patchIndex, readBody, sendJson, getIndex: () => idx, crypto });
        for (const r of (mod && mod.routes) || []) {
          if (!r || !["GET", "POST"].includes(r.method) || typeof r.handler !== "function" || !/^\/[a-z0-9/_-]{1,60}$/.test(r.path || "")) throw new Error("it declared a route the board can't accept");
          if (CORE_PATHS.has(r.path) || r.path.startsWith("/api/") || addonRoutes.has(`${r.method} ${r.path}`)) throw new Error(`route ${r.path} is already in use`);
          staged.routes.push(r);
        }
      }
      for (const [name, text] of Object.entries(staged.parts)) addonParts[name].push(text);
      if (staged.script) addonScripts.push(staged.script);
      for (const r of staged.routes) { addonRoutes.set(`${r.method} ${r.path}`, r.handler); addonPaths.add(r.path); }
      entry.status = "loaded";
    } catch (e) {
      entry.status = "error"; entry.error = e.message;
      console.error(`Add-on "${dir}" not loaded: ${e.message}`);
    }
  }
  const ok = addons.filter((a) => a.status === "loaded").map((a) => `${a.id} ${a.version}`);
  if (ok.length) console.log(`Add-ons loaded: ${ok.join(", ")}`);
}
loadAddons();
// Fill the page's add-on placeholders (they are simply removed when nothing is installed).
function withAddons(page) {
  for (const name of Object.keys(addonParts)) {
    const tag = name === "css" ? "/*@addons:css*/" : `<!--@addons:${name}-->`;
    page = page.split(tag).join(addonParts[name].join("\n"));
  }
  return page.split("<!--@addons:script-->").join(addonScripts.map((t) => `<script>\n${t}\n</script>`).join("\n"));
}

/* ---------- Reminders ----------
   A task with a time in its text, like "Call dentist @2:30pm" or "@14:30", is a reminder for the day page it sits on.
   Nothing extra is stored in WorkFlowy: the time is part of the task. The board shows a bell badge and a popup,
   and this server can also send a push (ntfy or Pushover) when the time arrives, even with the board closed. */
const TIME_RE = /(^|\s)@(\d{1,2})(?::(\d{2}))?\s?([ap])\.?m\.?(?=$|[\s.,;!?)])|(^|\s)@(\d{1,2}):(\d{2})(?=$|[\s.,;!?)])/i;
function parseTime(text) {
  const m = TIME_RE.exec(text || "");
  if (!m) return null;
  let h, mi;
  if (m[4]) { h = Number(m[2]); mi = Number(m[3] || 0); if (h < 1 || h > 12) return null; h = (h % 12) + (m[4].toLowerCase() === "p" ? 12 : 0); }
  else { h = Number(m[6]); mi = Number(m[7]); if (h > 23) return null; }
  if (mi > 59) return null;
  return { h, mi, token: m[0].trim() };
}
const REMINDER_TZ = process.env.REMINDER_TZ || Intl.DateTimeFormat().resolvedOptions().timeZone;
try { new Intl.DateTimeFormat("en-US", { timeZone: REMINDER_TZ }); } catch (e) { console.error(`REMINDER_TZ "${REMINDER_TZ}" is not a time zone name (for example America/New_York).`); process.exit(1); }
const NTFY_TOPIC = (process.env.NTFY_TOPIC || "").trim();
const NTFY_URL = (process.env.NTFY_URL || "https://ntfy.sh").replace(/\/+$/, "");
const NTFY_TOKEN = (process.env.NTFY_TOKEN || "").trim();
const PUSHOVER_TOKEN = (process.env.PUSHOVER_TOKEN || "").trim();
const PUSHOVER_USER = (process.env.PUSHOVER_USER || "").trim();
const PUSH_ON = !!(NTFY_TOPIC || (PUSHOVER_TOKEN && PUSHOVER_USER));
const REMINDER_NESTED = process.env.REMINDER_NESTED !== "0";
const REMINDER_STATE = process.env.REMINDER_STATE || path.join(require("os").tmpdir(), "weekboard-reminders.json");
const REM_SCAN_MS = 3 * 60 * 1000, REM_WINDOW_MS = 15 * 60 * 1000, REM_MAX_BULLETS = 20;

function zonedParts(ts) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: REMINDER_TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const o = {}; for (const p of f.formatToParts(new Date(ts))) o[p.type] = p.value;
  return { key: `${o.year}-${o.month}-${o.day}`, utc: Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour, +o.minute, +o.second) };
}
function zonedEpoch(key, h, mi) {                       // the moment key + h:mi happens in REMINDER_TZ
  const [y, m, d] = key.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let at = guess - (zonedParts(guess).utc - guess);
  at = guess - (zonedParts(at).utc - at);
  return at;
}
const rem = { key: "", items: [], scannedAt: 0, scanning: null, lastClient: 0, sent: {}, error: "" };
try { rem.sent = JSON.parse(fs.readFileSync(REMINDER_STATE, "utf8")) || {}; } catch (e) {}
function remSaveSent() {
  const cut = Date.now() - 2 * 86400000;
  for (const k of Object.keys(rem.sent)) if (rem.sent[k] < cut) delete rem.sent[k];
  try { fs.writeFileSync(REMINDER_STATE, JSON.stringify(rem.sent)); } catch (e) {}
}
async function remKids(parent) {
  const r = await fetch(`${BASE}/nodes?parent_id=${encodeURIComponent(parent)}`, { headers: { Authorization: `Bearer ${KEY}` }, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
  if (r.status === 404) return [];
  if (!r.ok) throw new Error(`WorkFlowy answered ${r.status}`);
  const j = await r.json();
  return Array.isArray(j.nodes) ? j.nodes : [];
}
function parseTag(raw) {                                   // WorkFlowy's own date tag: <time startYear="2026" startMonth="10" startDay="28" startHour="14" startMinute="30">
  const m = /<time\b([^>]*)>/i.exec(raw || "");
  if (!m) return null;
  const a = {}; for (const x of m[1].matchAll(/(\w+)="(\d+)"/g)) a[x[1]] = Number(x[2]);
  if (!a.startYear || !a.startMonth || !a.startDay || a.startHour === undefined || a.startMinute === undefined) return null;   // a date with no time isn't a reminder
  if (a.startHour > 23 || a.startMinute > 59) return null;
  const p2 = (n) => String(n).padStart(2, "0");
  return { key: `${a.startYear}-${p2(a.startMonth)}-${p2(a.startDay)}`, h: a.startHour, mi: a.startMinute };
}
function remItem(n, pageKey) {
  if (n.completedAt) return null;
  const raw = n.name || "";
  const tag = parseTag(raw);
  const text = stripHtml(raw.replace(/<time\b[^>]*>.*?<\/time>/gi, ""));
  const t = tag || parseTime(text);
  if (!t) return null;
  const day = tag ? tag.key : pageKey;
  return { id: n.id, day, time: `${String(t.h).padStart(2, "0")}:${String(t.mi).padStart(2, "0")}`, at: zonedEpoch(day, t.h, t.mi),
    name: maskTokens((t.token ? text.replace(t.token, "") : text).replace(/\s{2,}/g, " ").trim()) || "(task)" };
}
async function remScan() {
  if (rem.scanning) return rem.scanning;
  rem.scanning = (async () => {
    try {
      const key = zonedParts(Date.now()).key;
      const [ky, km, kd] = key.split("-").map(Number);
      const nextKey = (i) => { const d = new Date(Date.UTC(ky, km - 1, kd + i)); return d.toISOString().slice(0, 10); };
      const nodes = await remKids(key);
      const items = [];
      const todos = nodes.filter((n) => n.data && n.data.layoutMode === "todo");
      if (REMINDER_NESTED) {
        const bullets = nodes.filter((n) => !(n.data && n.data.layoutMode === "todo") && !/^WB-Notes$/i.test(stripHtml(n.name || "").trim())).slice(0, REM_MAX_BULLETS);
        for (const b of bullets) { try { for (const n of await remKids(b.id)) if (n.data && n.data.layoutMode === "todo") todos.push(n); } catch (e) {} }
      }
      for (const n of todos) { const it = remItem(n, key); if (it) items.push(it); }
      for (let i = 1; i <= 7; i++) {                       // a date tag on a task sitting on a coming day page still fires on its own day; plain @times wait for their day
        const k = nextKey(i);
        try { for (const n of await remKids(k)) if (n.data && n.data.layoutMode === "todo") { const it = remItem(n, k); if (it) items.push(it); } } catch (e) {}
      }
      items.sort((a, b) => a.at - b.at);
      rem.key = key; rem.items = items; rem.scannedAt = Date.now(); rem.error = "";
    } catch (e) { rem.error = e.message; rem.scannedAt = Date.now(); }
    finally { rem.scanning = null; }
  })();
  return rem.scanning;
}
async function pushSend(title, message) {
  const sent = [];
  const click = REMOTE ? PUBLIC.origin : undefined;
  if (NTFY_TOPIC) {
    const headers = { "Content-Type": "application/json" };
    if (NTFY_TOKEN) headers.Authorization = `Bearer ${NTFY_TOKEN}`;
    const r = await fetch(NTFY_URL, { method: "POST", headers, body: JSON.stringify({ topic: NTFY_TOPIC, title, message, tags: ["bell"], click }), signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`ntfy answered ${r.status}`);
    sent.push("ntfy");
  }
  if (PUSHOVER_TOKEN && PUSHOVER_USER) {
    const r = await fetch("https://api.pushover.net/1/messages.json", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: PUSHOVER_TOKEN, user: PUSHOVER_USER, title, message, url: click }), signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`Pushover answered ${r.status}`);
    sent.push("Pushover");
  }
  return sent;
}
async function remTick() {
  if (!PUSH_ON && Date.now() - rem.lastClient > 10 * 60 * 1000) return;       // nobody to tell: don't poll WorkFlowy
  if (Date.now() - rem.scannedAt > REM_SCAN_MS || rem.key !== zonedParts(Date.now()).key) await remScan();
  if (!PUSH_ON) return;
  const now = Date.now();
  let changed = false;
  for (const it of rem.items) {
    const k = `${it.id}|${it.day}|${it.time}`;
    if (it.at > now || now - it.at > REM_WINDOW_MS || rem.sent[k]) continue;
    rem.sent[k] = now; changed = true;                                          // marked first, so a slow push can't send twice
    pushSend(`Reminder · ${it.time}`, it.name).catch((e) => { console.error("Reminder push failed:", e.message); delete rem.sent[k]; });
  }
  if (changed) remSaveSent();
}
setInterval(() => { remTick().catch(() => {}); }, 30 * 1000).unref();
setTimeout(() => { remTick().catch(() => {}); }, 5000).unref();
async function serveReminders(url, res) {
  rem.lastClient = Date.now();
  if (url.searchParams.get("fresh") === "1" || Date.now() - rem.scannedAt > 90 * 1000 || rem.key !== zonedParts(Date.now()).key) await remScan();
  sendJson(res, 200, { now: Date.now(), tz: REMINDER_TZ, items: rem.items, error: rem.error, push: { ntfy: !!NTFY_TOPIC, pushover: !!(PUSHOVER_TOKEN && PUSHOVER_USER) } });
}
async function serveReminderTest(res) {
  if (!PUSH_ON) return sendJson(res, 400, { error: "No push service is set up. Set NTFY_TOPIC (or PUSHOVER_TOKEN and PUSHOVER_USER) on the server and restart it." });
  try { sendJson(res, 200, { sent: await pushSend("Week Board test", "Push notifications are working.") }); }
  catch (e) { sendJson(res, 502, { error: e.message }); }
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
  if (req.method === "GET" && url.pathname === "/reminders") return serveReminders(url, res);
  if (req.method === "POST" && url.pathname === "/reminders/test") return serveReminderTest(res);
  if (url.pathname === "/m/settings" && (req.method === "GET" || req.method === "POST")) return serveMobileSettings(req, res);
  if (req.method === "GET" && url.pathname === "/addons") return sendJson(res, 200, { addons });
  const addonHandler = addonRoutes.get(`${req.method} ${url.pathname}`);
  if (addonHandler) return addonHandler(req, res, url);

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

  if (APP_ASSETS.has(url.pathname)) {
    const type = url.pathname.endsWith(".png") ? "image/png" : "application/manifest+json";
    try {
      const body = url.pathname === "/manifest.webmanifest" ? JSON.stringify(APP_MANIFEST) : fs.readFileSync(path.join(__dirname, url.pathname.slice(1)));
      res.writeHead(200, { "Content-Type": type, "Cache-Control": "public, max-age=86400" });
      return res.end(body);
    } catch (e) { res.writeHead(404); return res.end("not found"); }
  }
  if (url.pathname === "/m" || url.pathname === "/m/" || url.pathname === "/mobile.html") {
    try {
      const page = fs.readFileSync(path.join(__dirname, "mobile.html"), "utf8").replace(/(<meta name="notes-name" content=")[^"]*(")/, (_, a, b) => a + escapeAttr(NOTES_NAME) + b).replace(/<script>/g, `<script nonce="${res.nonce}">`);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(page);
    } catch (e) { res.writeHead(404); return res.end("The phone page (mobile.html) is not installed."); }
  }

  if (url.pathname === "/" || url.pathname === "/index.html") {
    // Pass the configured notes-bullet name to the page through its notes-name meta tag.
    const page = withAddons(fs.readFileSync(path.join(__dirname, "index.html"), "utf8"))
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
