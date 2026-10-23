// WorkFlowy week board: tiny proxy that keeps your API key off the browser.
// Version 1.0.0
// Run:  WORKFLOWY_API_KEY=your_key node server.js   (Node 18+)
// Open: http://localhost:3000

const VERSION = "1.0.0";

const http = require("http");
const fs = require("fs");
const path = require("path");

const KEY = process.env.WORKFLOWY_API_KEY;
const BASE = (process.env.WORKFLOWY_BASE_URL || "https://workflowy.com/api/v1").replace(/\/$/, "");
const PORT = Number(process.env.PORT || 3000);

if (!KEY) {
  console.error("Set WORKFLOWY_API_KEY first (get one at https://workflowy.com/api-key).");
  process.exit(1);
}

// Only the node endpoints the board needs. nodes-export is deliberately not exposed.
const ALLOWED = /^\/api\/v1\/nodes(\/[^/]+(\/(move|complete|uncomplete))?)?$/;

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

  if (url.pathname.startsWith("/api/")) {
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
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(fs.readFileSync(path.join(__dirname, "index.html")));
  }

  res.writeHead(404);
  res.end("not found");
});

// Localhost only: your key has full access to your outline.
server.listen(PORT, "127.0.0.1", () => {
  console.log(`Workflowy Week Board v${VERSION} running at http://localhost:${PORT}  (API: ${BASE})`);
});
