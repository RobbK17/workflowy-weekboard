// WorkFlowy week board: tiny proxy that keeps your API key off the browser.
// Run:  DEPLOY_MODE=local WORKFLOWY_API_KEY=your_key node server.js   (Node 18+)
// Open: http://localhost:3000
// DEPLOY_MODE is required: local, vps or fly (see README.md).

const VERSION = "1.5.4";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const KEY = process.env.WORKFLOWY_API_KEY;
const BASE = (process.env.WORKFLOWY_BASE_URL || "https://workflowy.com/api/v1").replace(/\/$/, "");
const PORT = Number(process.env.PORT || 3000);
// Default name of the notes bullet on today's page. Each browser can override it with the pencil in the board.
const NOTES_NAME = (process.env.NOTES_NAME || "").trim() || "WB-Notes";
// An old all-day notes bullet (named by NOTES_NAME, and "WB-Notes") is skipped when scanning for tasks. Checklists ("!list") and all-day notes ("!alld") are skipped too.
const skipsAsNotes = (rawName) => { const t = stripHtml(String(rawName || "")).trim().toLowerCase(); return t === NOTES_NAME.toLowerCase() || t === "wb-notes" || /(^|\s)!(?:list|alld[1-9]?)(?=$|[\s.,;!?)])/i.test(t); };
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
const HOST = REMOTE ? (process.env.HOST || (MODE === "fly" ? "0.0.0.0" : "127.0.0.1")) : "127.0.0.1";
const ASSUME_HTTPS = process.env.ASSUME_HTTPS === "1" && REMOTE && isLoopback(HOST);

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
let lastAttemptAt = 0;     // failed attempts count too, so a 429 isn't retried on every search
let lastError = null;      // why the last download failed (given back while a retry would be too soon)
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

// The top level of the outline has no parent node; it is kept under the key "None", the same word the WorkFlowy API uses for it.
const TOP = "None";
function addToKids(index, parentId, node) {
  const key = parentId || TOP;
  let list = index.kids.get(key);
  if (!list) index.kids.set(key, (list = []));
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
  lastAttemptAt = Date.now();
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
}

// Makes sure there is a copy to search. Returns { throttled } where throttled means a fresh copy was asked for
// (or needed) but couldn't be fetched yet, so the existing copy was used.
async function ensureIndex(wantFresh) {
  lastUse = Date.now();
  if (loading) { try { await loading; } catch (e) { if (!idx) throw e; } }
  const age = idx ? Date.now() - idx.at : Infinity;
  const tooSoon = Date.now() - lastAttemptAt < REFRESH_MIN_GAP_MS;
  if (idx && !wantFresh && age < INDEX_MAX_AGE_MS) return { throttled: false };
  if (idx && tooSoon) return { throttled: wantFresh };
  if (!idx && tooSoon && lastError) throw lastError;   // no copy and the last try just failed: don't ask WorkFlowy again within the minute
  try {
    loading = downloadIndex();
    await loading;
    lastError = null;
    return { throttled: false };
  } catch (e) {
    lastError = e;
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

// Items whose name or note holds text from the Encryption add-on. Only the lock symbol leaves the server, never the encrypted text.
const ENC_LIMIT = 2000;
const ENC_RE = /wbenc1\.[A-Za-z0-9_-]{59,}/g;
function encryptedList() {
  const found = [];
  for (const n of idx.byId.values()) {
    const a = String(n.name || "").match(ENC_RE) || [], b = String(n.note || "").match(ENC_RE) || [];
    if (!a.length && !b.length) continue;
    found.push({ n, inName: a.length > 0, inNote: b.length > 0, tokens: a.length + b.length, path: pathNames(n).map(maskTokens) });
  }
  found.sort((x, y) => x.path.join(" › ").localeCompare(y.path.join(" › ")) || (x.n.priority - y.n.priority));
  const snip = (t) => { const x = maskTokens(stripHtml(t)).replace(/\s+/g, " ").trim(); return x.length > 120 ? x.slice(0, 119) + "…" : x; };
  return {
    total: found.length, tokens: found.reduce((a, f) => a + f.tokens, 0),
    hits: found.slice(0, ENC_LIMIT).map(({ n, inName, inNote, tokens, path }) => ({
      id: n.id, name: snip(n.name), note: inNote ? snip(n.note) : "", path, inName, inNote, tokens,
      todo: n.layoutMode === "todo", done: !!n.completedAt, layoutMode: n.layoutMode,
    })),
  };
}
async function serveEncrypted(url, res) {
  try {
    const { throttled } = await ensureIndex(url.searchParams.get("refresh") === "1");
    sendJson(res, 200, { ...encryptedList(), limit: ENC_LIMIT, count: idx.byId.size, indexTime: idx.at, throttled });
  } catch (e) {
    sendJson(res, e.status && e.status >= 400 ? e.status : 502, { error: e.message });
  }
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

/* ---------- WorkFlowy shortcuts (keys such as home or inbox) ----------
   WorkFlowy lets a key stand for a node (a shortcut you set up, or the system Inbox). The board stores real node ids, so these two
   routes list the keys and turn one into the node's id and name. */
async function wfGet(p) {
  const r = await fetch(BASE + p, { headers: { Authorization: `Bearer ${KEY}` }, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
  let json = null; try { json = await r.json(); } catch (e) { /* not JSON */ }
  return { status: r.status, ok: r.ok, json };
}
async function serveTargets(res) {
  try {
    const r = await wfGet("/targets");
    if (!r.ok) return sendJson(res, r.status === 404 ? 404 : 502, { error: "WorkFlowy didn't return its shortcut list (" + r.status + ")" });
    const arr = Array.isArray(r.json) ? r.json : (r.json && (r.json.targets || r.json.items)) || [];
    const targets = arr.map((t) => ({ key: String((t && t.key) || ""), type: String((t && t.type) || ""), name: t && t.name != null ? stripHtml(String(t.name)) : null })).filter((t) => /^[A-Za-z0-9_-]{1,40}$/.test(t.key));
    sendJson(res, 200, { targets });
  } catch (e) { sendJson(res, 502, { error: fetchFailure(e) }); }
}
async function serveResolveTarget(url, res) {
  const key = (url.searchParams.get("key") || "").trim();
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(key)) return sendJson(res, 400, { error: "that isn't a shortcut name" });
  try {
    const nameOf = (n) => stripHtml(String((n && n.name) || "")).slice(0, 80);
    // 1. ask for the node by its key
    let r = await wfGet("/nodes/" + encodeURIComponent(key));
    let node = r.ok && r.json ? (r.json.node || r.json) : null;
    if (node && node.id && node.id !== key) return sendJson(res, 200, { id: node.id, name: nameOf(node) || key });
    // 2. otherwise list what is under it: every child names its parent's real id
    r = await wfGet("/nodes?parent_id=" + encodeURIComponent(key));
    if (r.status === 404 || r.status === 400) return sendJson(res, 404, { error: `WorkFlowy has no shortcut called “${key}”. Check the names in Settings > Panes, or paste the node's link.` });
    if (!r.ok) return sendJson(res, 502, { error: "WorkFlowy answered " + r.status });
    const kids = (r.json && r.json.nodes) || [], pid = kids.length && kids[0].parent_id;
    if (!pid) return sendJson(res, 409, { error: `“${key}” has nothing under it yet, so its id can't be read. Paste its link instead.` });
    const p = await wfGet("/nodes/" + encodeURIComponent(pid));
    const pn = p.ok && p.json ? (p.json.node || p.json) : null;
    sendJson(res, 200, { id: pid, name: nameOf(pn) || key });
  } catch (e) { sendJson(res, 502, { error: fetchFailure(e) }); }
}

async function serveItem(url, res) {
  const p = url.searchParams;
  try {
    const { throttled } = await ensureIndex(p.get("refresh") === "1");
    if (p.get("id") === TOP) {                                       // the top level of the outline, as one item
      return sendJson(res, 200, { item: { id: TOP, name: "Home", note: "", data: { layoutMode: "bullets" }, completedAt: null, children: sortedKids(TOP).map((c) => itemTree(c, ITEM_DEPTH - 1)) }, path: [], indexTime: idx.at, throttled });
    }
    const n = idx.byId.get(p.get("id") || "");
    if (!n) return sendJson(res, 404, { error: "item not found" });
    sendJson(res, 200, { item: itemTree(n, ITEM_DEPTH), path: pathNames(n), indexTime: idx.at, throttled });
  } catch (e) {
    sendJson(res, e.status && e.status >= 400 ? e.status : 502, { error: e.message });
  }
}

// ---- keep the copy in step with edits that pass through this server ----
function removeFromKids(parentId, node) {
  const list = idx.kids.get(parentId || TOP);
  if (list) { const i = list.indexOf(node); if (i !== -1) list.splice(i, 1); }
}
function edgePriority(parentId, position) {
  const list = idx.kids.get(parentId || TOP) || [];
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
function scryptBoard(password, salt) {
  return crypto.scryptSync(String(password), String(salt), 32, { N: 16384, r: 8, p: 1 });
}
function parseBoardPasswordHash(stored) {
  const parts = String(stored || "").split(":");
  if (parts.length === 2 && /^[0-9a-f]{16,64}$/i.test(parts[0]) && /^[0-9a-f]{64}$/i.test(parts[1])) {
    return { salt: parts[0], hash: Buffer.from(parts[1], "hex") };
  }
  return null;
}
function passwordOk(given) {
  const stored = BOARD_PASSWORD;
  if (!stored) return false;
  try {
    const parsed = parseBoardPasswordHash(stored);
    if (parsed) {
      const next = scryptBoard(given, parsed.salt);
      return next.length === parsed.hash.length && crypto.timingSafeEqual(next, parsed.hash);
    }
    const salt = process.env.BOARD_PASSWORD_SALT || "workflowy-weekboard-board-password-v1";
    const a = scryptBoard(given, salt);
    const b = scryptBoard(stored, salt);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (e) {
    return false;
  }
}
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
  const lockedOut = () => {
    const r = failures.get(ip);
    if (!r || r.until <= Date.now()) return false;
    const mins = Math.ceil((r.until - Date.now()) / 60000);
    sendHtml(res, 429, loginPage(`Too many attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`));
    return true;
  };
  if (lockedOut()) return;
  const raw = await readBody(req, 4096).catch(() => null);
  // Look again after the body has arrived: attempts sent at the same moment must each see the others' misses.
  // From here to failures.set below there is no await, so the count read here is the one that gets increased.
  if (lockedOut()) return;
  const rec = failures.get(ip);
  const given = raw ? (new URLSearchParams(raw.toString()).get("password") || "") : "";
  if (raw && passwordOk(given)) {
    failures.delete(ip);
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, Date.now() + SESSION_DAYS * 86400000);
    return sendHtml(res, 303, "", { Location: "/", "Set-Cookie": sessionCookie(token, SESSION_DAYS * 86400) });
  }
  const fresh = !rec || Date.now() - (rec.at || 0) > LOCKOUT_MS;    // old misses from another day don't count toward a lockout
  const next = { count: (fresh ? 0 : rec.count) + 1, until: 0, at: Date.now() };
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
  const isData = url.pathname.startsWith("/api/") || DATA_PATHS.has(url.pathname) || addonPaths.has(url.pathname);
  if (isData) { res.writeHead(401, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "login required" })); }
  else { res.writeHead(302, { Location: "/login" }); res.end(); }
  return false;
}

if (REMOTE) {
  setInterval(() => {                                       // forget expired sessions and old lockouts
    const now = Date.now();
    for (const [t, exp] of sessions) if (exp < now) sessions.delete(t);
    // Keep active lockouts. Everything else goes once its last miss is older than the lockout, so the map can't fill up
    // with stale entries, and a flood of new addresses can't wipe the lockouts.
    for (const [ip, r] of failures) if (r.until < now && now - (r.at || 0) > LOCKOUT_MS) failures.delete(ip);
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
// The board's JSON routes: signed out, these answer 401 instead of redirecting to the sign-in page.
const DATA_PATHS = new Set(["/search", "/item", "/done", "/filter", "/encrypted", "/resolve", "/update-check", "/addons", "/reminders", "/reminders/test", "/recurring/run", "/features", "/timeblocks", "/m/settings", "/d/settings", "/colors", "/targets", "/resolve-target"]);
const CORE_PATHS = new Set(["/", "/index.html", "/m", "/mobile.html", ...APP_ASSETS, "/login", "/logout", "/healthz", ...DATA_PATHS]);
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
  for (const k of ["showLate", "showSoon", "showDone", "prioSort", "hideEst"]) if (x[k] !== undefined) { if (typeof x[k] !== "boolean") throw new Error("bad " + k); out[k] = x[k]; }
  if (x.inbox !== undefined) {
    if (x.inbox === null) out.inbox = null;
    else if (x.inbox && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(x.inbox.id))) out.inbox = { id: String(x.inbox.id).toLowerCase(), name: String(x.inbox.name || "Inbox").slice(0, 30) };
    else throw new Error("bad inbox");
  }
  if (x.notesLoc !== undefined) {
    if (x.notesLoc === null) out.notesLoc = null;
    else if (x.notesLoc && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(x.notesLoc.id))) out.notesLoc = { id: String(x.notesLoc.id).toLowerCase(), name: String(x.notesLoc.name || "Notes").slice(0, 30) };
    else throw new Error("bad notesLoc");
  }
  return out;
}
async function serveMobileSettings(req, res) {
  if (!MOBILE_SYNC) return sendJson(res, req.method === "GET" ? 200 : 403, { enabled: false, error: req.method === "GET" ? undefined : "Settings sharing is turned off on this server (MOBILE_SYNC=off)." });
  const load = () => { try { return JSON.parse(fs.readFileSync(MOBILE_SETTINGS_FILE, "utf8")); } catch (e) { return null; /* none saved yet */ } };
  if (req.method === "GET") { const saved = load(); return sendJson(res, 200, { enabled: true, settings: saved ? saved.settings || null : null, updated: saved ? saved.updated || null : null }); }
  let body;
  try { body = JSON.parse((await readBody(req, 16 * 1024)).toString() || "{}"); }
  catch (e) { return sendJson(res, 400, { error: "bad request" }); }
  let settings;
  try { settings = cleanMobileSettings(body.settings); } catch (e) { return sendJson(res, 400, { error: e.message }); }
  // Read, merge and write with no await in between, so two saves at once can't drop each other's changes.
  const saved = load();
  const merged = { ...((saved && saved.settings) || {}), ...settings };
  const doc = { settings: merged, updated: new Date().toISOString() };
  try {
    const tmp = MOBILE_SETTINGS_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(doc, null, 2));
    fs.renameSync(tmp, MOBILE_SETTINGS_FILE);
  } catch (e) { console.error("Could not save the phone settings:", e.message); return sendJson(res, 500, { error: "The server could not write " + path.basename(MOBILE_SETTINGS_FILE) + " (is the board folder writable?)" }); }
  return sendJson(res, 200, { enabled: true, settings: merged, updated: doc.updated });
}
/* ---------- Desktop board settings shared between browsers (optional, per browser, off by default) ----------
   GET /d/settings -> { enabled, settings: { key: "value" }, updated }.  POST { settings: { key: "value" | null } } merges (null removes).
   Only the board's preference keys are accepted (never window sizes or what is folded open). Uses the same MOBILE_SYNC switch. */
const DESKTOP_SETTINGS_FILE = process.env.DESKTOP_SETTINGS_FILE || path.join(__dirname, "desktop-settings.json");
const DESKTOP_KEYS = new Set(["hideDone", "showLate", "showSoon", "showSubs", "liveCards", "allDay", "allDayLines", "pastAlert", "pastCount", "pastEdge", "nested", "span", "weekStartDay", "lateRange", "doneRange", "planSources", "planLimit", "notesName", "inboxNode", "notesNode", "kbCols", "kbViews", "kbHideDone", "kbAddType", "kbOpenLines", "kbEditOn", "kbReadEdit", "kbTableOutline", "kbCalDays", "kbGroup", "addType", "kbLane", "kbLaneN", "kbLaneX", "remind", "prioSort", "planHours", "filters", "tbPresets", "tbTemplate", "hideEst", "hideWkend"]);
async function serveDesktopSettings(req, res) {
  if (!MOBILE_SYNC) return sendJson(res, req.method === "GET" ? 200 : 403, { enabled: false, error: req.method === "GET" ? undefined : "Settings sharing is turned off on this server (MOBILE_SYNC=off)." });
  const load = () => { try { return JSON.parse(fs.readFileSync(DESKTOP_SETTINGS_FILE, "utf8")); } catch (e) { return null; /* none saved yet */ } };
  if (req.method === "GET") { const saved = load(); return sendJson(res, 200, { enabled: true, settings: saved ? saved.settings || {} : {}, updated: saved ? saved.updated || null : null }); }
  let body;
  try { body = JSON.parse((await readBody(req, 128 * 1024)).toString() || "{}"); } catch (e) { return sendJson(res, 400, { error: "bad request" }); }
  const x = body && body.settings;
  if (!x || typeof x !== "object" || Array.isArray(x)) return sendJson(res, 400, { error: "settings must be an object" });
  // Read, merge and write with no await in between, so two saves at once can't drop each other's changes.
  const saved = load();
  const merged = { ...((saved && saved.settings) || {}) };
  for (const [k, v] of Object.entries(x)) {
    if (!DESKTOP_KEYS.has(k)) continue;
    if (v === null) delete merged[k];
    else if (typeof v === "string" && v.length <= 20000) merged[k] = v;
    else return sendJson(res, 400, { error: "bad value for " + k });
  }
  const doc = { settings: merged, updated: new Date().toISOString() };
  try { const tmp = DESKTOP_SETTINGS_FILE + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(doc, null, 2)); fs.renameSync(tmp, DESKTOP_SETTINGS_FILE); }
  catch (e) { console.error("Could not save the desktop settings:", e.message); return sendJson(res, 500, { error: "The server could not write " + path.basename(DESKTOP_SETTINGS_FILE) + " (is the board folder writable?)" }); }
  return sendJson(res, 200, { enabled: true, settings: merged, updated: doc.updated });
}
/* ---------- Card colours (the Board's coloured cards) ----------
   WorkFlowy's API has no colour for a bullet, so the colours live in a small file next to this server (card-colors.json)
   and every browser that opens the board shows the same ones. GET /colors -> { colors: { nodeId: "red" } };
   POST /colors { set: { nodeId: "red" | null } } changes some (null removes). */
const COLORS_FILE = process.env.CARD_COLORS_FILE || path.join(__dirname, "card-colors.json");
const CARD_COLORS = ["red", "orange", "yellow", "green", "blue", "purple"];
const COLORS_MAX = 5000;
function readColors() { try { const d = JSON.parse(fs.readFileSync(COLORS_FILE, "utf8")); return d && typeof d.colors === "object" && d.colors ? d : { colors: {} }; } catch (e) { return { colors: {} }; } }
async function serveColors(req, res) {
  if (req.method === "GET") { const saved = readColors(); return sendJson(res, 200, { colors: saved.colors, updated: saved.updated || null, palette: CARD_COLORS }); }
  let body;
  try { body = JSON.parse((await readBody(req, 64 * 1024)).toString() || "{}"); }
  catch (e) { return sendJson(res, 400, { error: "bad request" }); }
  const set = body && body.set;
  if (!set || typeof set !== "object" || Array.isArray(set)) return sendJson(res, 400, { error: "expected { set: { id: colour|null } }" });
  // Read, merge and write with no await in between, so two saves at once can't drop each other's changes.
  const colors = { ...readColors().colors };
  for (const [id, c] of Object.entries(set)) {
    if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return sendJson(res, 400, { error: "bad id" });
    if (c === null) delete colors[id];
    else if (CARD_COLORS.includes(c)) colors[id] = c;
    else return sendJson(res, 400, { error: "unknown colour" });
  }
  if (Object.keys(colors).length > COLORS_MAX) return sendJson(res, 400, { error: `too many coloured cards (the limit is ${COLORS_MAX})` });
  const doc = { colors, updated: new Date().toISOString() };
  try { const tmp = COLORS_FILE + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(doc, null, 1)); fs.renameSync(tmp, COLORS_FILE); }
  catch (e) { console.error("Could not save the card colours:", e.message); return sendJson(res, 500, { error: "The server could not write " + path.basename(COLORS_FILE) + " (is the board folder writable?)" }); }
  return sendJson(res, 200, { colors, updated: doc.updated, palette: CARD_COLORS });
}
const addons = [];                    // { id, name, version, description, status, error, docs }
const addonRoutes = new Map();        // "METHOD /path" -> handler
const addonPaths = new Set();         // paths the login guard should treat as data
const addonParts = { css: [], button: [], panel: [], tab: [], pane: [] };
const addonScripts = [];              // desktop page scripts, in order (an add-on's shared code comes just before its own script)
const addonMobile = { css: [], scripts: [] };   // the same for the phone page (mobile.html)
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
    const staged = { parts: {}, scripts: [], mobileScripts: [], mobileCss: null, routes: [] };
    try {
      let m;
      try { m = JSON.parse(fs.readFileSync(path.join(base, "manifest.json"), "utf8")); } catch (e) { throw new Error("manifest.json is not valid JSON"); }
      entry.name = String(m.name || dir).slice(0, 60); entry.version = String(m.version || "?").slice(0, 20);
      entry.description = String(m.description || "").slice(0, 300);
      if (m.docs && /^[\w.-]+$/.test(m.docs)) entry.docs = m.docs;
      if (m.id !== dir || !/^[a-z0-9-]{1,32}$/.test(dir)) throw new Error("the manifest id must match the folder name (lowercase letters, digits, dashes)");
      if (!/^\d+\.\d+\.\d+$/.test(entry.version)) throw new Error("the manifest needs a version like 1.0.0");
      const need = m.requires && m.requires.board;
      if (need && !versionAtLeast(VERSION, need)) throw new Error(`needs board ${need} or newer (this is ${VERSION}); update server.js, index.html and mobile.html`);
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
      // "shared" is one file both pages run first (the desktop and the phone get their own copy of it, inline, so the
      // page's CSP still holds); then "script" is the desktop glue and "mobileScript" / "mobileCss" the phone's.
      const shared = m.shared ? fs.readFileSync(file("shared"), "utf8") : null;
      if (shared) { staged.scripts.push(shared); staged.mobileScripts.push(shared); }
      if (m.script) staged.scripts.push(fs.readFileSync(file("script"), "utf8"));
      if (m.mobileScript) staged.mobileScripts.push(fs.readFileSync(file("mobileScript"), "utf8"));
      if (m.mobileCss) staged.mobileCss = fs.readFileSync(file("mobileCss"), "utf8");
      if (m.server) {
        const mod = require(file("server"))({ REMOTE, KEY, BASE, UPSTREAM_TIMEOUT_MS, stripHtml, ensureIndex, search, parseQuery, itemTree, patchIndex, readBody, sendJson, getIndex: () => idx, crypto });
        for (const r of (mod && mod.routes) || []) {
          if (!r || !["GET", "POST"].includes(r.method) || typeof r.handler !== "function" || !/^\/[a-z0-9/_-]{1,60}$/.test(r.path || "")) throw new Error("it declared a route the board can't accept");
          if (CORE_PATHS.has(r.path) || r.path.startsWith("/api/") || addonRoutes.has(`${r.method} ${r.path}`)) throw new Error(`route ${r.path} is already in use`);
          staged.routes.push(r);
        }
      }
      for (const [name, text] of Object.entries(staged.parts)) addonParts[name].push(text);
      addonScripts.push(...staged.scripts);
      addonMobile.scripts.push(...staged.mobileScripts);
      if (staged.mobileCss) addonMobile.css.push(staged.mobileCss);
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
// The phone page has two placeholders: the CSS comment /*@addons:css*/ and <!--@addons:script-->. An older mobile.html
// without them is served unchanged, so the phone just has no add-ons.
function withMobileAddons(page) {
  page = page.split("/*@addons:css*/").join(addonMobile.css.join("\n"));
  return page.split("<!--@addons:script-->").join(addonMobile.scripts.map((t) => `<script>\n${t}\n</script>`).join("\n"));
}

/* ---------- Priorities, time estimates and saved filters ----------
   "!p1" to "!p4" in a task's text is its priority (1 urgent, 2 high, 3 medium, 4 low; none is normal), and "~45m", "~1h",
   "~1h30m" or "~1.5h" its time estimate. Like reminder times they live in the task text, so nothing else is stored.
   GET /filter?q=…&today=YYYY-MM-DD&ws=mon runs a saved filter over the whole outline (the same copy Search uses). */
const PRIO_RE = /(^|\s)!p([1-4])(?=$|[\s.,;!?)<])/i;
const EST_RE = /(^|\s)~(?:(\d{1,2}(?:\.\d{1,2})?)h(?:(\d{1,2})m)?|(\d{1,3})m)(?=$|[\s.,;!?)<])/i;
function parsePrio(text) { const m = PRIO_RE.exec(String(text || "")); return m ? Number(m[2]) : 0; }
function parseEst(text) {
  const m = EST_RE.exec(String(text || ""));
  if (!m) return 0;
  return m[4] ? Number(m[4]) : Math.round(Number(m[2]) * 60) + Number(m[3] || 0);
}
function dropMeta(s) {
  const cut = (re) => (t) => t.replace(new RegExp(re.source, "gi"), (m, lead) => (lead ? " " : ""));
  return cut(EST_RE)(cut(PRIO_RE)(String(s || ""))).replace(/\s{2,}/g, " ").trim();
}
const PRIO_RANK = [3.5, 1, 2, 3, 4];                      // by priority number; no priority sorts between medium and low

// Which calendar day a task sits on. The API turns "2026-11" or "2026-11-04" into the real calendar node, so each month is
// looked up once; its day pages are then read from the outline copy by the day number in their names. A month whose names
// can't be read safely is looked up one day at a time instead.
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const calIds = new Map();                                  // "calendar" | "YYYY-MM" | "YYYY-MM-DD" -> { id, at }
const CAL_MISS_MS = 10 * 60 * 1000;                        // a page that didn't exist yet is asked about again after this long
const DUE_MAX_DAYS = 120, OVERDUE_DAYS = 60, FILTER_LIMIT = 500;
const FILTER_MAX_TERMS = 50;                               // words, phrases and under: values in one filter; thousands of #tag words would keep the server busy
async function calId(key) {
  const c = calIds.get(key);
  if (c && (c.id || Date.now() - c.at < CAL_MISS_MS)) return c.id;
  const r = await wfGet("/nodes/" + encodeURIComponent(key));
  if (!r.ok && r.status !== 404) throw new Error(`WorkFlowy answered ${r.status} for the calendar page ${key}`);
  const node = r.ok && r.json ? (r.json.node || r.json) : null;
  const id = node && node.id ? node.id : null;
  calIds.set(key, { id, at: Date.now() });
  return id;
}
function dayNumber(name) {
  const raw = String(name || "");
  const t = /<time\b[^>]*\bstartDay="(\d+)"/i.exec(raw); if (t) return Number(t[1]);
  const s = stripHtml(raw);
  const iso = /\b\d{4}-\d{2}-(\d{2})\b/.exec(s); if (iso) return Number(iso[1]);
  const m = /(?:^|\D)(\d{1,2})(?=\D|$)/.exec(s); return m ? Number(m[1]) : 0;
}
async function calDays(keys) {                             // day node id -> "YYYY-MM-DD", for the days asked about that have a page
  const out = new Map(), want = new Set(keys);
  for (const mk of [...new Set(keys.map((k) => k.slice(0, 7)))]) {
    const mid = await calId(mk);
    if (!mid) continue;
    const [y, mo] = mk.split("-").map(Number), last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const seen = new Map();
    let readable = true;
    for (const c of idx.kids.get(mid) || []) {
      const d = dayNumber(c.name);
      if (!d || d > last || seen.has(d)) { readable = false; break; }
      seen.set(d, c.id);
    }
    if (readable && seen.size) {                           // check one against the API before trusting the names
      const [d0, id0] = seen.entries().next().value;
      if ((await calId(`${mk}-${String(d0).padStart(2, "0")}`)) !== id0) readable = false;
    }
    if (readable) { for (const [d, id] of seen) { const k = `${mk}-${String(d).padStart(2, "0")}`; if (want.has(k)) out.set(id, k); } continue; }
    for (const k of keys) if (k.startsWith(mk)) { const id = await calId(k); if (id) out.set(id, k); }
  }
  return out;
}
function dayOf(n, dayIds) {
  let p = n;
  for (let i = 0; p && i < 60; i++) {
    const pid = p.parent_id;
    if (!pid) return null;
    if (ISO_DAY.test(pid)) return pid;                     // added through the board since the last download: kept under the date key
    const k = dayIds.get(pid); if (k) return k;
    p = idx.byId.get(pid);
  }
  return null;
}
function tagDay(raw) {                                    // WorkFlowy's own date in a task (<time startYear="2026" startMonth="11" startDay="10" …>), with or without a time
  const m = /<time\b([^>]*)>/i.exec(String(raw || ""));
  if (!m) return null;
  const a = {}; for (const x of m[1].matchAll(/(\w+)="(\d+)"/g)) a[x[1]] = Number(x[2]);
  if (!a.startYear || !(a.startMonth >= 1 && a.startMonth <= 12) || !(a.startDay >= 1 && a.startDay <= 31)) return null;
  return `${a.startYear}-${String(a.startMonth).padStart(2, "0")}-${String(a.startDay).padStart(2, "0")}`;
}
// The calendar day a task sits on, read from the day page's own date (calendar > year > month > day), for showing and sorting
// results outside a due: range. null when it isn't on the calendar or the day page has no date in its name.
function calendarDay(n, rootId) {
  let p = n;
  for (let i = 0; p && i < 60; i++) {
    const pid = p.parent_id;
    if (!pid) return null;
    if (ISO_DAY.test(pid)) return pid;
    const d = idx.byId.get(pid), m = d && idx.byId.get(d.parent_id), y = m && idx.byId.get(m.parent_id);
    if (rootId && y && y.parent_id === rootId) {
      const t = tagDay(d.name); if (t) return t;
      let mk = null; for (const [k, v] of calIds) if (v.id === m.id && /^\d{4}-\d{2}$/.test(k)) { mk = k; break; }      // a month already looked up through the API
      const dn = dayNumber(d.name);
      return mk && dn >= 1 && dn <= 31 ? `${mk}-${String(dn).padStart(2, "0")}` : null;
    }
    p = d;
  }
  return null;
}
function underNode(n, rootId) {
  let p = n;
  for (let i = 0; p && i < 60; i++) {
    const pid = p.parent_id;
    if (!pid) return false;
    if (pid === rootId || ISO_DAY.test(pid)) return true;
    p = idx.byId.get(pid);
  }
  return false;
}

// ---- filter words: p:1-2  due:week  est:<30m  is:done  under:"Project"  plus ordinary search words, "phrases" and -words ----
function minutesOf(v) {
  const m = /^(?:(\d+(?:\.\d+)?)h)?(?:(\d+)m)?$/.exec(v);
  return m && (m[1] || m[2]) ? Math.round(Number(m[1] || 0) * 60) + Number(m[2] || 0) : null;
}
function dueRange(v, today, ws) {
  const dow = keyDate(today).getUTCDay(), wk = addDaysKey(today, -(ws === "sun" ? dow : (dow + 6) % 7));
  const named = { today: [0, 0], tomorrow: [1, 1], yesterday: [-1, -1], overdue: [-OVERDUE_DAYS, -1] }[v];
  if (named) return [addDaysKey(today, named[0]), addDaysKey(today, named[1])];
  if (v === "week") return [wk, addDaysKey(wk, 6)];
  if (v === "nextweek") return [addDaysKey(wk, 7), addDaysKey(wk, 13)];
  if (v === "lastweek") return [addDaysKey(wk, -7), addDaysKey(wk, -1)];
  let m = /^(\d{1,3})d$/.exec(v); if (m) return [today, addDaysKey(today, Math.max(1, Number(m[1])) - 1)];
  if (ISO_DAY.test(v)) return [v, v];
  m = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(v); if (m && m[1] <= m[2]) return [m[1], m[2]];
  return null;
}
function parseFilter(q, today, ws) {
  const f = { prio: null, est: null, due: null, state: "open", types: "todo", under: [], notUnder: [], errors: [] };
  const text = String(q || "").replace(/(^|\s)(-?)(p|due|est|is|under):(?:"([^"]*)"?|(\S*))/gi, (all, lead, neg, key, quoted, bare) => {
    const v = (quoted !== undefined ? quoted : bare || "").trim().toLowerCase();
    key = key.toLowerCase();
    if (key === "under") { if (v) (neg ? f.notUnder : f.under).push(v); return lead || " "; }
    if (key === "p") {
      const m = /^([1-4])(?:-([1-4]))?$/.exec(v);
      if (v === "none" || v === "any") f.prio = v;
      else if (m) f.prio = [Number(m[1]), Number(m[2] || m[1])].sort();
      else f.errors.push(`p:${v} (use p:1, p:1-2, p:none or p:any)`);
    } else if (key === "est") {
      const m = /^(<=|>=|<|>)?(.+)$/.exec(v), mins = m ? minutesOf(m[2]) : null;
      if (v === "none" || v === "any") f.est = v;
      else if (mins !== null) f.est = { op: m[1] || "<=", mins };
      else f.errors.push(`est:${v} (use est:none, est:any, est:<30m or est:>=1h)`);
    } else if (key === "due") {
      if (v === "none" || v === "any") f.due = v;
      else {
        const r = dueRange(v, today, ws);
        if (!r) f.errors.push(`due:${v} (use today, tomorrow, overdue, week, nextweek, 7d, a date like 2026-11-04, or a range like 2026-11-01..2026-11-15)`);
        else if ((keyDate(r[1]) - keyDate(r[0])) / 86400000 >= DUE_MAX_DAYS) f.errors.push(`due:${v} covers more than ${DUE_MAX_DAYS} days`);
        else f.due = r;
      }
    } else if (key === "is") {
      if (["open", "done", "any"].includes(v)) f.state = v;
      else if (v === "todo") f.types = "todo";
      else if (v === "all") f.types = "all";
      else f.errors.push(`is:${v} (use is:open, is:done, is:any or is:all)`);
    }
    return lead || " ";
  });
  f.text = text.trim();
  return f;
}
async function runFilter(q, today, ws) {
  const f = parseFilter(q, today, ws);
  if (f.errors.length) return { error: "Didn't understand " + f.errors.join("; ") };
  const { include, exclude } = parseQuery(f.text);
  if (include.length + exclude.length + f.under.length + f.notUnder.length > FILTER_MAX_TERMS) return { error: `That filter has too many words (the limit is ${FILTER_MAX_TERMS}).` };
  const whole = (t) => /^[#@]/.test(t);                   // #tag and @person match whole words ("#work" isn't "#workshop")
  let dayIds = null, calRoot = null;
  if (Array.isArray(f.due)) {
    const keys = [];
    for (let k = f.due[0]; k <= f.due[1]; k = addDaysKey(k, 1)) keys.push(k);
    dayIds = await calDays(keys);
  }
  // due:none / due:any need the calendar page; without a due: word it only supplies each result's day, so a refusal (say a 429) leaves the days blank instead of failing the filter.
  try { calRoot = await calId("calendar"); } catch (e) { if (f.due) throw e; calRoot = null; }
  if (!idx) throw Object.assign(new Error("The outline copy was cleared; try again."), { status: 503 });
  const found = [];
  for (const n of idx.byId.values()) {
    if (f.types === "todo" && n.layoutMode !== "todo") continue;
    if (f.state === "open" ? n.completedAt : f.state === "done" ? !n.completedAt : false) continue;
    const pr = parsePrio(n.lname), est = parseEst(n.lname);
    if (f.prio === "none" ? pr : f.prio === "any" ? !pr : f.prio ? !(pr >= f.prio[0] && pr <= f.prio[1]) : false) continue;
    if (f.est === "none" ? est : f.est === "any" ? !est : false) continue;
    if (f.est && f.est.op && !(est && { "<": est < f.est.mins, "<=": est <= f.est.mins, ">": est > f.est.mins, ">=": est >= f.est.mins }[f.est.op])) continue;
    if (exclude.some((t) => hasTerm(n.lname, t, whole(t)) || hasTerm(n.lnote, t, whole(t)))) continue;
    if (!include.every((t) => hasTerm(n.lname, t, whole(t)) || hasTerm(n.lnote, t, whole(t)))) continue;
    if (f.under.length || f.notUnder.length) {
      const lp = pathNames(n).map((x) => x.toLowerCase());
      if (!f.under.every((u) => lp.some((x) => x.includes(u))) || f.notUnder.some((u) => lp.some((x) => x.includes(u)))) continue;
    }
    // A WorkFlowy date in the task is its due date; otherwise it is due on the calendar day it sits on.
    const tagged = tagDay(n.name);
    let day = tagged;
    if (dayIds) { if (!day) day = dayOf(n, dayIds); if (!day || day < f.due[0] || day > f.due[1]) continue; }
    else if (f.due) { const dated = !!tagged || underNode(n, calRoot); if (f.due === "none" ? dated : !dated) continue; }
    if (!day) day = calendarDay(n, calRoot);
    found.push({ n, pr, est, day });
  }
  found.sort((a, b) => PRIO_RANK[a.pr] - PRIO_RANK[b.pr] || (a.day || "9999").localeCompare(b.day || "9999") || b.n.modifiedAt - a.n.modifiedAt);
  const open = found.filter((x) => !x.n.completedAt);
  return {
    total: found.length,
    estTotal: open.reduce((s, x) => s + x.est, 0),
    noEst: open.filter((x) => !x.est).length,
    hits: found.slice(0, FILTER_LIMIT).map(({ n, pr, est, day }) => ({
      id: n.id, name: maskTokens(stripHtml(n.name)), path: pathNames(n).map(maskTokens),
      todo: n.layoutMode === "todo", done: !!n.completedAt, prio: pr, est, day,
    })),
    limit: FILTER_LIMIT,
  };
}
async function serveFilter(url, res) {
  const p = url.searchParams;
  const today = ISO_DAY.test(p.get("today") || "") ? p.get("today") : zonedParts(Date.now()).key;
  try {
    const { throttled } = await ensureIndex(p.get("refresh") === "1");
    const r = await runFilter(p.get("q") || "", today, p.get("ws") === "sun" ? "sun" : "mon");
    if (r.error) return sendJson(res, 400, { error: r.error });
    sendJson(res, 200, { ...r, count: idx.byId.size, indexTime: idx.at, throttled });
  } catch (e) {
    sendJson(res, e.status && e.status >= 400 ? e.status : 502, { error: e.message || fetchFailure(e) });
  }
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
// Early alerts: "!1h", "!1d" and "!1w" in a task's text remind you 1 hour, 1 day or 1 week before its time (9:00 when it has no time).
const LEAD_RE = /(^|\s)!(1[hdw])(?=$|[\s.,;!?)])/gi;
const LEAD_INFO = { "1h": { label: "1 hour", hours: 1 }, "1d": { label: "1 day", days: 1 }, "1w": { label: "1 week", days: 7 } };
const NO_TIME_H = 9;
function parseLeads(text) { const o = new Set(); for (const m of String(text || "").matchAll(LEAD_RE)) o.add(m[2].toLowerCase()); return ["1h", "1d", "1w"].filter((c) => o.has(c)); }
function dropLeads(text) { return String(text || "").replace(LEAD_RE, (m) => (/^\s/.test(m) ? " " : "")); }
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
function remItem(n, pageKey) {                              // returns a list: the reminder at the task's time, and one for each early alert
  if (n.completedAt) return [];
  const raw = n.name || "";
  const tag = parseTag(raw);
  const text0 = stripHtml(raw.replace(/<time\b[^>]*>.*?<\/time>/gi, ""));
  const leads = parseLeads(text0), text = dropRepeat(dropLeads(text0));
  const t = tag || parseTime(text);
  if (!t && !leads.length) return [];
  const day = tag ? tag.key : pageKey, h = t ? t.h : NO_TIME_H, mi = t ? t.mi : 0;
  const time = `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
  const name = maskTokens(dropMeta((t && t.token) ? text.replace(t.token, "") : text)) || "(task)";
  const out = [];
  if (t) out.push({ id: n.id, day, time, at: zonedEpoch(day, h, mi), name, lead: null });
  for (const c of leads) {
    const L = LEAD_INFO[c]; let at;
    if (L.hours) at = zonedEpoch(day, h, mi) - L.hours * 3600000;
    else { const [y, m, d] = day.split("-").map(Number); at = zonedEpoch(new Date(Date.UTC(y, m - 1, d - L.days)).toISOString().slice(0, 10), h, mi); }
    out.push({ id: n.id, day, time, at, name, lead: c, leadLabel: L.label });
  }
  return out;
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
        const bullets = nodes.filter((n) => !(n.data && n.data.layoutMode === "todo") && !skipsAsNotes(n.name)).slice(0, REM_MAX_BULLETS);
        for (const b of bullets) { try { for (const n of await remKids(b.id)) if (n.data && n.data.layoutMode === "todo") todos.push(n); } catch (e) {} }
      }
      for (const n of todos) items.push(...remItem(n, key));
      for (let i = 1; i <= 7; i++) {                       // a date tag on a task sitting on a coming day page still fires on its own day; plain @times wait for their day
        const k = nextKey(i);
        try { for (const n of await remKids(k)) if (n.data && n.data.layoutMode === "todo") items.push(...remItem(n, k)); } catch (e) {}
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
    const k = `${it.id}|${it.day}|${it.time}` + (it.lead ? `|${it.lead}` : "");
    if (it.at > now || now - it.at > REM_WINDOW_MS || rem.sent[k]) continue;
    rem.sent[k] = now; changed = true;                                          // marked first, so a slow push can't send twice
    pushSend(it.lead ? `In ${it.leadLabel} · ${it.day === zonedParts(now).key ? "" : it.day + " "}${it.time}` : `Reminder · ${it.time}`, it.name).catch((e) => { console.error("Reminder push failed:", e.message); delete rem.sent[k]; });
  }
  if (changed) remSaveSent();
}
setInterval(() => { remTick().catch(() => {}); }, 30 * 1000).unref();
setTimeout(() => { remTick().catch(() => {}); }, 5000).unref();

/* ---------- Repeating tasks ----------
   A task with "!every week" (and friends) in its text gets its next copy made ahead of time, on the next date after its due date.
   Patterns: !every day | weekdays | week | month | month-end | year | 2 weeks | 3 days | mon,wed,fri   then optionally  until 2027-06-30  and/or  x10 (that many in all).
   The server looks at the pages from a week back to today every few minutes. The copy carries the same marker (with x counted down),
   so the chain goes on by itself. A date that has passed is skipped: the copy lands on the next date that is still ahead. */
const DOW_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DOW_PAT = "mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?";
const REPEAT_RE = new RegExp(`(^|\\s)!every\\s+(weekdays|month-end|(?:\\d+\\s*)?(?:day|week|month|year)s?|(?:${DOW_PAT})(?:\\s*,\\s*(?:${DOW_PAT}))*)(?:\\s+until\\s+(\\d{4}-\\d{2}-\\d{2}))?(?:\\s+x(\\d+))?(?=$|[\\s.,;!?)<])`, "i");
function parseRepeat(text) {
  const m = REPEAT_RE.exec(String(text || ""));
  if (!m) return null;
  const spec = m[2].toLowerCase().replace(/\s+/g, " ");
  let kind, n = 1, days = null;
  if (spec === "weekdays") kind = "weekdays";
  else if (spec === "month-end") kind = "month-end";
  else if (/^(\d+\s*)?(day|week|month|year)s?$/.test(spec)) { const q = /^(\d+)?\s*(day|week|month|year)s?$/.exec(spec); n = Math.max(1, Number(q[1] || 1)); kind = q[2]; }
  else { kind = "dows"; days = [...new Set(spec.split(/\s*,\s*/).map((d) => DOW_NAMES.indexOf(d.slice(0, 3))))].sort((a, b) => a - b); }
  return { kind, n, days, spec: m[2], until: m[3] || null, count: m[4] ? Number(m[4]) : null, token: m[0], lead: m[1] };
}
function keyDate(key) { const [y, mo, d] = key.split("-").map(Number); return new Date(Date.UTC(y, mo - 1, d)); }
function dateKey(d) { return d.toISOString().slice(0, 10); }
function addDaysKey(key, k) { const d = keyDate(key); d.setUTCDate(d.getUTCDate() + k); return dateKey(d); }
function addMonthsKey(key, k, endOfMonth) {
  const d = keyDate(key), day = d.getUTCDate();
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + k, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(endOfMonth ? last : Math.min(day, last));
  return dateKey(t);
}
function nextRepeatKey(rep, from) {
  switch (rep.kind) {
    case "day": return addDaysKey(from, rep.n);
    case "week": return addDaysKey(from, 7 * rep.n);
    case "month": return addMonthsKey(from, rep.n, false);
    case "month-end": return addMonthsKey(from, 1, true);
    case "year": return addMonthsKey(from, 12 * rep.n, false);
    case "weekdays": { let k = addDaysKey(from, 1); while ([0, 6].includes(keyDate(k).getUTCDay())) k = addDaysKey(k, 1); return k; }
    case "dows": { let k = addDaysKey(from, 1); for (let i = 0; i < 7 && !rep.days.includes(keyDate(k).getUTCDay()); i++) k = addDaysKey(k, 1); return k; }
  }
  return null;
}
// The marker is read from the plain text, but the copy is made from the stored name, which may wrap it in formatting
// (<b>!every week x3</b>) or put &nbsp; before it. Returns null when a counter can't be found there, so a counted
// series is never copied with its count unchanged (which would repeat it forever).
function nextRepeatName(name, rep, tok) {
  if (name.includes(rep.token)) return name.replace(rep.token, tok);
  if (rep.count === null) return name;                       // nothing to count down: the marker can stay as it is
  const re = /(!every\b[\s\S]*?(?:\s|&nbsp;|>)x)(\d+)(?=$|[\s.,;!?)<&])/i;
  const m = re.exec(name);
  if (!m || Number(m[2]) !== rep.count) return null;
  return name.replace(re, (all, pre) => pre + (rep.count - 1));
}
function dropRepeat(s) { return String(s || "").replace(REPEAT_RE, (m, lead) => (lead ? " " : "")).replace(/\s{2,}/g, " ").trim(); }
function repeatTarget(rep, due, today) {                    // the next date after the due date; when that has passed already, the first one still ahead
  let k = nextRepeatKey(rep, due);
  for (let i = 0; k && k <= today && i < 800; i++) k = nextRepeatKey(rep, k);
  return k;
}
function shiftTag(raw, key) {                               // move WorkFlowy's own date tag to another day, keeping its time
  return raw.replace(/<time\b([^>]*)>[^<]*<\/time>/i, (all, attrs) => {
    const hasT = /startHour="\d+"/.test(attrs) && /startMinute="\d+"/.test(attrs);
    const [y, mo, d] = key.split("-").map(Number);
    let a = attrs.replace(/startYear="\d+"/, `startYear="${y}"`).replace(/startMonth="\d+"/, `startMonth="${mo}"`).replace(/startDay="\d+"/, `startDay="${d}"`);
    const dt = keyDate(key), mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][mo - 1];
    let label = `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getUTCDay()]}, ${mon} ${d}`;
    if (hasT) { const h = Number(/startHour="(\d+)"/.exec(a)[1]), mi = Number(/startMinute="(\d+)"/.exec(a)[1]); label += `, ${((h + 11) % 12) + 1}:${String(mi).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`; }
    return `<time ${a.trim()}>${label}</time>`;
  });
}
const REC_STATE = process.env.RECURRING_STATE || path.join(require("os").tmpdir(), "weekboard-recurring.json");
const RECURRING_ON = process.env.RECURRING !== "0";
const rec = { done: {}, running: null, last: 0, made: 0, error: "" };
try { rec.done = JSON.parse(fs.readFileSync(REC_STATE, "utf8")) || {}; } catch (e) { rec.done = {}; }
function recSave() { try { const keep = Object.keys(rec.done).slice(-2000); const o = {}; for (const k of keep) o[k] = rec.done[k]; fs.writeFileSync(REC_STATE, JSON.stringify(o)); } catch (e) {} }
function recSame(name) {                                    // what makes two copies "the same task": text without the date tag, the time, the counter
  return stripHtml(String(name || "").replace(/<time\b[^>]*>.*?<\/time>/gi, "")).replace(/\s+x\d+(?=$|\s)/gi, "").replace(/\s+/g, " ").trim().toLowerCase();
}
async function recMake(parentKey, body) {
  const r = await fetch(`${BASE}/nodes`, { method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ parent_id: parentKey, ...body, layoutMode: "todo", position: "bottom" }), signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
  if (!r.ok) throw new Error(`WorkFlowy answered ${r.status} while creating a repeat`);
  return r.json().catch(() => ({}));
}

// ---- Writing features: switches for the features that put things into WorkFlowy. Kept in a small file so they apply to every browser and to the phone page.
const FEATURES_FILE = process.env.FEATURES_STATE || path.join(__dirname, "weekboard-features.json");
const FEATURE_KEYS = ["tb", "rep", "notes", "mark"];          // time blocking, repeating tasks, notes bullets, priority/estimate/reminder items
let features = { tb: true, rep: true, notes: true, mark: true };
try { const f = JSON.parse(fs.readFileSync(FEATURES_FILE, "utf8")); for (const k of FEATURE_KEYS) if (f && f[k] === false) features[k] = false; } catch (e) { /* none saved: all on */ }
async function serveFeatures(req, res) {
  if (req.method === "POST") {
    let body; try { body = JSON.parse((await readBody(req, 4096)).toString() || "{}"); } catch (e) { return sendJson(res, 400, { error: "bad request" }); }
    for (const k of FEATURE_KEYS) if (body && typeof body[k] === "boolean") features[k] = body[k];
    try { fs.writeFileSync(FEATURES_FILE, JSON.stringify(features)); } catch (e) { return sendJson(res, 500, { error: "Couldn't save the writing-feature switches: " + e.message }); }
  }
  sendJson(res, 200, { ...features, repForced: !RECURRING_ON, hostname: require("os").hostname() });
}
// ---- Time blocking data (the Day template and the quick blocks list), kept here so every browser sees the same ones, with or without "Share these settings".
const TIMEBLOCKS_FILE = process.env.TIMEBLOCKS_STATE || path.join(__dirname, "weekboard-timeblocks.json");
const tbLoad = () => { try { return JSON.parse(fs.readFileSync(TIMEBLOCKS_FILE, "utf8")) || {}; } catch (e) { return {}; } };
const tbSaveFile = (cur) => fs.writeFileSync(TIMEBLOCKS_FILE, JSON.stringify(cur));
// "Prepare a week ahead": on a trigger day (Friday → next week, Monday → this week) and time, write the Day template's blocks for the coming week(s) into WorkFlowy.
function weekAutoClean(v) {
  if (!v || typeof v !== "object") return null;
  const day = v.day === "mon" ? "mon" : "fri", m = /^(\d{1,2}):(\d{2})$/.exec(String(v.time || ""));
  const time = m && +m[1] < 24 && +m[2] < 60 ? String(+m[1]).padStart(2, "0") + ":" + m[2] : "18:00";
  const weeks = Math.min(4, Math.max(1, Math.round(Number(v.weeks)) || 1));
  return { on: v.on === true, day, time, weeks };
}
async function serveTimeblocks(req, res) {
  if (req.method === "POST") {
    let body; try { body = JSON.parse((await readBody(req, 64 * 1024)).toString() || "{}"); } catch (e) { return sendJson(res, 400, { error: "bad request" }); }
    const cur = tbLoad();
    for (const k of ["tbTemplate", "tbPresets", "tbSkips", "tbAuto"]) { const v = body && body[k]; if (typeof v === "string" && v.length <= 30000) cur[k] = v; else if (v === null) delete cur[k]; }
    if (body && body.weekAuto) {
      const n = weekAutoClean(body.weekAuto), o = weekAutoClean(cur.weekAuto);
      if (n) cur.weekAuto = { ...n, since: o && o.on === n.on && o.day === n.day && o.time === n.time ? (cur.weekAuto.since || Date.now()) : Date.now() };   // a new schedule never fills a trigger that has already passed
    }
    try { tbSaveFile(cur); } catch (e) { return sendJson(res, 500, { error: "Couldn't save the time blocking data: " + e.message }); }
  }
  const cur = tbLoad(); const out = {}; for (const k of ["tbTemplate", "tbPresets", "tbSkips", "tbAuto"]) out[k] = typeof cur[k] === "string" ? cur[k] : null;
  out.weekAuto = weekAutoClean(cur.weekAuto) || { on: false, day: "fri", time: "18:00", weeks: 1 };
  out.weekAutoLast = cur.weekAutoLast || null;
  out.tb = features.tb;
  sendJson(res, 200, out);
}
const wkAuto = { running: null };
const wkDow = (key) => keyDate(key).getUTCDay();
const wkMarkers = (name) => stripHtml(String(name || "")).replace(/(^|\s)(!p[1-4]|!blk|~(?:\d{1,2}(?:\.\d{1,2})?h(?:\d{1,2}m)?|\d{1,3}m)|\^\d{1,2}(?::\d{2})?\s*(?:am|pm)?)(?=$|[\s.,;!?)])/gi, " ").replace(/\s+/g, " ").trim().toLowerCase();
function wkBlockMins(name) {
  const m = /(^|\s)\^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?=$|[\s.,;!?)])/i.exec(stripHtml(String(name || "")));
  if (!m) return null;
  let h = +m[2], mi = +(m[3] || 0); const ap = (m[4] || "").toLowerCase();
  if (ap === "pm" && h < 12) h += 12; if (ap === "am" && h === 12) h = 0;
  return h * 60 + mi;
}
const wkToken = (h, mi) => (h >= 12 ? `^${h}:${String(mi).padStart(2, "0")}` : mi ? `^${h}:${String(mi).padStart(2, "0")}am` : `^${h}am`);
const wkEst = (m) => { const h = Math.floor(m / 60), r = m % 60; return "~" + (h ? h + "h" + (r ? r + "m" : "") : r + "m"); };
async function weekAutoRun() {
  if (wkAuto.running) return wkAuto.running;
  wkAuto.running = (async () => {
    const cur = tbLoad(), cfg = weekAutoClean(cur.weekAuto);
    if (!features.tb || !cfg || !cfg.on) return;
    const now = Date.now(), today = zonedParts(now).key, want = cfg.day === "mon" ? 1 : 5, [th, tm] = cfg.time.split(":").map(Number);
    let trig = today; while (wkDow(trig) !== want) trig = addDaysKey(trig, -1);
    let at = zonedEpoch(trig, th, tm); if (at > now) { trig = addDaysKey(trig, -7); at = zonedEpoch(trig, th, tm); }
    const done = cur.weekAutoDone || {};
    if (at < (cur.weekAuto.since || 0) || done[trig]) return;
    let tpl = {}, skips = {}; try { tpl = JSON.parse(cur.tbTemplate || "{}") || {}; } catch (e) {} try { skips = JSON.parse(cur.tbSkips || "{}") || {}; } catch (e) {}
    const made = cur.weekAutoMade || {};
    const first = cfg.day === "mon" ? trig : addDaysKey(trig, 3);
    let n = 0, err = "";
    try {
      for (let i = 0; i < cfg.weeks * 7; i++) {
        const dk = addDaysKey(first, i); if (dk < today) continue;
        const list = Array.isArray(tpl[wkDow(dk)]) ? tpl[wkDow(dk)] : []; if (!list.length) continue;
        const have = await remKids(dk), left = (skips[dk] || []).map((x) => String(x).toLowerCase());
        for (const b of list) {
          const mm = /^(\d{1,2}):(\d{2})$/.exec(b && b.start || ""), nm = String(b && b.name || "").trim(), len = Math.round(Number(b && b.mins));
          if (!mm || !nm || !(len > 0)) continue;
          const h = +mm[1], mi = +mm[2], mins = h * 60 + mi, sk = String(h).padStart(2, "0") + ":" + String(mi).padStart(2, "0") + "|" + nm.toLowerCase(), mk = dk + "|" + sk;
          if (left.includes(sk) || made[mk] || have.some((x) => wkBlockMins(x.name) === mins && wkMarkers(x.name) === wkMarkers(nm))) continue;
          const name = `${nm.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")} ${wkToken(h, mi)} ${wkEst(len)} !blk`;
          await recMake(dk, { name }); made[mk] = 1; n++;
        }
      }
    } catch (e) { err = e.message; console.error("Prepare a week ahead:", e.message); }
    const fresh = tbLoad(); fresh.weekAutoMade = made;
    for (const k of Object.keys(made)) if (k.slice(0, 10) < addDaysKey(today, -14)) delete made[k];
    if (!err) { const d = fresh.weekAutoDone || {}; d[trig] = 1; for (const k of Object.keys(d)) if (k < addDaysKey(today, -60)) delete d[k]; fresh.weekAutoDone = d; }
    fresh.weekAutoLast = { at: Date.now(), made: n, error: err, from: first, weeks: cfg.weeks };
    try { tbSaveFile(fresh); } catch (e) { console.error("Prepare a week ahead: couldn't save progress:", e.message); }
  })().finally(() => { wkAuto.running = null; });
  return wkAuto.running;
}
setInterval(() => { weekAutoRun().catch(() => {}); }, 5 * 60 * 1000).unref(); setTimeout(() => { weekAutoRun().catch(() => {}); }, 30000).unref();
async function recurringRun() {
  if (!features.rep) return 0;                              // switched off in Settings → Writing features
  if (rec.running) return rec.running;
  rec.running = (async () => {
    let made = 0;
    const doneBefore = JSON.stringify(rec.done);
    try {
      const today = zonedParts(Date.now()).key;
      const cache = new Map(); const kids = async (k) => { if (!cache.has(k)) cache.set(k, await remKids(k).catch(() => [])); return cache.get(k); };
      for (let i = -7; i <= 0; i++) {                       // pages from a week back to today: a copy then waits for its date, one step ahead
        const page = addDaysKey(today, i);
        let list = (await kids(page)).slice();
        if (REMINDER_NESTED) {
          const bullets = list.filter((n) => !(n.data && n.data.layoutMode === "todo") && !skipsAsNotes(n.name)).slice(0, REM_MAX_BULLETS);
          for (const b of bullets) { try { list.push(...(await remKids(b.id))); } catch (e) {} }
        }
        for (const n of list) {
          if (!(n.data && n.data.layoutMode === "todo")) continue;
          const raw = n.name || "", rep = parseRepeat(stripHtml(raw.replace(/<time\b[^>]*>.*?<\/time>/gi, "")) || raw);
          if (!rep || rec.done[n.id]) continue;
          const tag = parseTag(raw) || (/<time\b/i.test(raw) ? (() => { const a = /startYear="(\d+)"[^>]*startMonth="(\d+)"[^>]*startDay="(\d+)"/.exec(raw); return a ? { key: `${a[1]}-${String(a[2]).padStart(2, "0")}-${String(a[3]).padStart(2, "0")}` } : null; })() : null);
          const due = tag ? tag.key : page;
          if (rep.count !== null && rep.count <= 1) { rec.done[n.id] = "end"; continue; }
          const target = repeatTarget(rep, due, today);
          if (!target || (rep.until && target > rep.until)) { rec.done[n.id] = "end"; continue; }
          const same = recSame(raw);
          if ((await kids(target)).some((o) => o.id !== n.id && recSame(o.name) === same)) { rec.done[n.id] = target; continue; }   // already there
          const tok = rep.lead + "!every " + rep.spec + (rep.until ? " until " + rep.until : "") + (rep.count !== null ? " x" + (rep.count - 1) : "");
          const name = nextRepeatName(tag ? shiftTag(raw, target) : raw, rep, tok);
          if (name === null) { rec.done[n.id] = "unparsed"; console.warn(`Repeating task ${n.id}: couldn't find its x${rep.count} counter in the stored text, so no copy was made.`); continue; }
          await recMake(target, { name, ...(n.note ? { note: n.note } : {}) });
          cache.delete(target); rec.done[n.id] = target; made++; rec.made++;
        }
      }
      rec.error = "";
    } catch (e) { rec.error = e.message; console.error("Repeating tasks:", e.message); }
    finally { rec.last = Date.now(); rec.running = null; if (made || JSON.stringify(rec.done) !== doneBefore) recSave(); }   // "end" and "already there" marks are kept too
    return made;
  })();
  return rec.running;
}
if (RECURRING_ON) { setInterval(() => { recurringRun().catch(() => {}); }, 10 * 60 * 1000).unref(); setTimeout(() => { recurringRun().catch(() => {}); }, 20000).unref(); }
async function serveRecurringRun(res) {
  if (!RECURRING_ON) return sendJson(res, 400, { error: "Repeating tasks are switched off on this server (RECURRING=0)." });
  if (!features.rep) return sendJson(res, 400, { error: "Repeating tasks are switched off in Settings → Writing features." });
  const made = await recurringRun();
  sendJson(res, 200, { made, error: rec.error });
}
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

// The two pages are filled in once (add-ons, the notes-bullet name, the mode) and kept until the file on disk changes.
// Only the script nonce differs per request, so each <script> gets a placeholder that is swapped for it.
const NONCE_SLOT = "__WB_NONCE__";
const pageCache = new Map();                              // file -> { mtime, text }
function cachedPage(file, addons) {
  const full = path.join(__dirname, file), mtime = fs.statSync(full).mtimeMs, c = pageCache.get(file);
  if (c && c.mtime === mtime) return c.text;
  let text = fs.readFileSync(full, "utf8");
  if (addons === "mobile") text = withMobileAddons(text);
  else if (addons) text = withAddons(text);
  text = text
    .replace(/(<meta name="notes-name" content=")[^"]*(")/, (_, a, b) => a + escapeAttr(NOTES_NAME) + b)   // the configured notes-bullet name
    .replace(/(<meta name="remote" content=")[^"]*(")/, (_, a, b) => a + (REMOTE ? "1" : "0") + b)
    .replace(/(<meta name="version" content=")[^"]*(")/, (_, a, b) => a + VERSION + b)             // the pages always show the running server's version
    .replace(/(<span id="verText">Workflowy Week Board v)[^<]*(<\/span>)/, (_, a, b) => a + VERSION + b)
    .replace(/<script>/g, `<script nonce="${NONCE_SLOT}">`);
  pageCache.set(file, { mtime, text });
  return text;
}

const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, "http://localhost"); } catch (e) { res.writeHead(400); return res.end(); }
  if (!(await guard(req, res, url))) return;

  if (req.method === "GET" && url.pathname === "/update-check") return serveUpdate(res);
  if (req.method === "GET" && url.pathname === "/search") return serveSearch(url, res);
  if (req.method === "GET" && url.pathname === "/item") return serveItem(url, res);
  if (req.method === "GET" && url.pathname === "/resolve") return serveResolve(url, res);
  if (req.method === "GET" && url.pathname === "/targets") return serveTargets(res);
  if (req.method === "GET" && url.pathname === "/resolve-target") return serveResolveTarget(url, res);
  if (req.method === "GET" && url.pathname === "/done") return serveDone(url, res);
  if (req.method === "GET" && url.pathname === "/filter") return serveFilter(url, res);
  if (req.method === "GET" && url.pathname === "/encrypted") return serveEncrypted(url, res);
  if (req.method === "GET" && url.pathname === "/reminders") return serveReminders(url, res);
  if (req.method === "POST" && url.pathname === "/reminders/test") return serveReminderTest(res);
  if (req.method === "POST" && url.pathname === "/recurring/run") return serveRecurringRun(res);
  if (url.pathname === "/timeblocks" && (req.method === "GET" || req.method === "POST")) return serveTimeblocks(req, res);
  if (url.pathname === "/features" && (req.method === "GET" || req.method === "POST")) return serveFeatures(req, res);
  if (url.pathname === "/m/settings" && (req.method === "GET" || req.method === "POST")) return serveMobileSettings(req, res);
  if (url.pathname === "/d/settings" && (req.method === "GET" || req.method === "POST")) return serveDesktopSettings(req, res);
  if (url.pathname === "/colors" && (req.method === "GET" || req.method === "POST")) return serveColors(req, res);
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
      // Always JSON: an HTML error page from upstream must never be served as a page from the board's own address.
      res.writeHead(upstream.status, { "Content-Type": "application/json; charset=utf-8" });
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
    let page;
    try { page = cachedPage("mobile.html", "mobile"); } catch (e) { res.writeHead(404); return res.end("The phone page (mobile.html) is not installed."); }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(page.split(NONCE_SLOT).join(res.nonce));
  }

  if (url.pathname === "/" || url.pathname === "/index.html") {
    const page = cachedPage("index.html", true);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(page.split(NONCE_SLOT).join(res.nonce));
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
