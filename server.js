// WorkFlowy week board: tiny proxy that keeps your API key off the browser.
// Version 1.0.3
// Run:  WORKFLOWY_API_KEY=your_key node server.js   (Node 18+)
// Open: http://localhost:3000

const VERSION = "1.0.3";

const http = require("http");
const fs = require("fs");
const path = require("path");

const KEY = process.env.WORKFLOWY_API_KEY;
const BASE = (process.env.WORKFLOWY_BASE_URL || "https://workflowy.com/api/v1").replace(/\/$/, "");
const PORT = Number(process.env.PORT || 3000);
// Default name of the notes bullet on today's page. Each browser can override it with the pencil in the board.
const NOTES_NAME = (process.env.NOTES_NAME || "").trim() || "WB-Notes";
const escapeAttr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

if (!KEY) {
  console.error("Set WORKFLOWY_API_KEY first (get one at https://workflowy.com/api-key).");
  process.exit(1);
}

// Only the node endpoints the board needs. The full export is handled separately below (cached, read-only).
const ALLOWED = /^\/api\/v1\/nodes(\/[^/]+(\/(move|complete|uncomplete))?)?$/;

// Search index: WorkFlowy limits the full export to one request per minute, so the server keeps the last copy.
//  - a cached copy younger than EXPORT_TTL_MS is served as is;
//  - ?refresh=1 asks for a fresh copy, but never sooner than EXPORT_MIN_GAP_MS after the last real download.
// Responses carry X-Index-Time (when the copy was downloaded) and X-Index-Throttled ("1" if a refresh was declined).
const EXPORT_TTL_MS = 5 * 60 * 1000;
const EXPORT_MIN_GAP_MS = 60 * 1000;
let exportCache = null;   // { body, type, at }

function sendExport(res, throttled) {
  res.writeHead(200, {
    "Content-Type": exportCache.type,
    "X-Index-Time": String(exportCache.at),
    "X-Index-Throttled": throttled ? "1" : "0",
  });
  res.end(exportCache.body);
}

async function serveExport(url, res) {
  const wantsFresh = url.searchParams.get("refresh") === "1";
  const age = exportCache ? Date.now() - exportCache.at : Infinity;
  if (exportCache && (age < EXPORT_MIN_GAP_MS || (!wantsFresh && age < EXPORT_TTL_MS))) {
    return sendExport(res, wantsFresh && age < EXPORT_MIN_GAP_MS);
  }
  try {
    const upstream = await fetch(BASE + "/nodes-export", { headers: { Authorization: `Bearer ${KEY}` } });
    const body = await upstream.text();
    if (upstream.ok) {
      exportCache = { body, type: upstream.headers.get("content-type") || "application/json", at: Date.now() };
      return sendExport(res, false);
    }
    if (exportCache) return sendExport(res, true);          // e.g. rate limited: fall back to the last copy
    res.writeHead(upstream.status, { "Content-Type": upstream.headers.get("content-type") || "application/json" });
    return res.end(body);
  } catch (e) {
    const cause = e.cause ? (e.cause.code || e.cause.message || String(e.cause)) : "";
    console.error(`Export request to ${BASE} failed:`, e.message, cause);
    if (exportCache) return sendExport(res, true);
    res.writeHead(502, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: `upstream failed: ${e.message}${cause ? " (" + cause + ")" : ""}` }));
  }
}

// Update check: reads the VERSION line of server.js on GitHub (cached for 6 hours) and reports it to the page.
// Set UPDATE_CHECK=0 to turn it off, or UPDATE_URL to point at another raw copy of server.js.
const UPDATE_CHECK = process.env.UPDATE_CHECK !== "0";
const UPDATE_URL = process.env.UPDATE_URL || "https://raw.githubusercontent.com/robbk17/workflowy-weekboard/main/server.js";
const REPO_URL = (process.env.UPDATE_URL ? "" : "https://github.com/robbk17/workflowy-weekboard");
const UPDATE_TTL_MS = 6 * 60 * 60 * 1000;
let updateCache = null;   // { latest, at }

async function serveUpdate(res) {
  const send = (o) => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
  if (!UPDATE_CHECK) return send({ current: VERSION, latest: null, disabled: true });
  if (!updateCache || Date.now() - updateCache.at > UPDATE_TTL_MS) {
    let latest = null;
    try {
      const r = await fetch(UPDATE_URL, { signal: AbortSignal.timeout(8000) });
      if (r.ok) { const m = (await r.text()).match(/const VERSION = "(\d+\.\d+\.\d+)"/); if (m) latest = m[1]; }
    } catch (e) { /* offline or blocked: just no answer */ }
    updateCache = { latest, at: Date.now() - (latest ? 0 : UPDATE_TTL_MS - 10 * 60 * 1000) };   // retry a failure after 10 min
  }
  return send({ current: VERSION, latest: updateCache.latest, url: REPO_URL });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname === "/update-check" && req.method === "GET") return serveUpdate(res);

  if (url.pathname.startsWith("/api/")) {
    if (url.pathname === "/api/v1/nodes-export" && req.method === "GET") return serveExport(url, res);
    if (!ALLOWED.test(url.pathname)) {
      res.writeHead(403, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "endpoint not allowed" }));
    }
    try {
      const body = ["GET", "DELETE", "HEAD"].includes(req.method) ? undefined : await readBody(req);
      const upstream = await fetch(BASE + url.pathname.replace("/api/v1", "") + url.search, {
        method: req.method,
        headers: {
          Authorization: `Bearer ${KEY}`,
          ...(body && body.length ? { "Content-Type": "application/json" } : {}),
        },
        body: body && body.length ? body : undefined,
      });
      const text = await upstream.text();
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
      .replace(/(<meta name="notes-name" content=")[^"]*(")/, (_, a, b) => a + escapeAttr(NOTES_NAME) + b);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(page);
  }

  res.writeHead(404);
  res.end("not found");
});

// Localhost only: your key has full access to your outline.
server.listen(PORT, "127.0.0.1", () => {
  console.log(`Workflowy Week Board v${VERSION} running at http://localhost:${PORT}  (API: ${BASE}, notes bullet: "${NOTES_NAME}")`);
});
