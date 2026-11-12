// Fake WorkFlowy API for the Assistant's tests (run by run.js). A few tasks today (with time blocks, estimates and a priority),
// a group with two tasks, a notes node with two notes (one with encrypted text). Records writes (/__log) and reads (/__gets),
// and can answer "busy" (429) to day reads after a number of them (/__busy?after=N).
const http = require("http");
const pad = (n) => String(n).padStart(2, "0");
const d = new Date(), today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const t = (id, name) => ({ id, name, note: "", parent_id: today, priority: 0, completedAt: null, data: { layoutMode: "todo" } });
const nm = new Date(Date.now() - 10 * 60000), nowTok = nm.getHours() >= 12 ? `^${nm.getHours()}:${pad(nm.getMinutes())}` : `^${nm.getHours()}:${pad(nm.getMinutes())}am`;
const done = (n) => ({ ...n, completedAt: Math.floor(Date.now() / 1000) - 600 });
const nodes = [
  t("aaaaaaaa-0000-4000-8000-000000000001", `Write report ${nowTok} ~1h`),
  t("aaaaaaaa-0000-4000-8000-000000000002", "<b>Plan</b> sprint ^3pm ~1h30m !p2"),
  t("aaaaaaaa-0000-4000-8000-000000000003", "Review budget ^3:30pm ~30m"),
  t("aaaaaaaa-0000-4000-8000-000000000004", "Call the insurance company about the claim and ask about the deductible ^4:30pm"),
  t("aaaaaaaa-0000-4000-8000-000000000005", "Water plants ~15m"),
  done(t("aaaaaaaa-0000-4000-8000-000000000006", "Standup ^9am ~15m")),
];
const NL = "bbbbbbbb-0000-4000-8000-000000000000";
const notes = [
  { id: "bbbbbbbb-0000-4000-8000-000000000001", name: "Bank stuff", note: `Card PIN: ${process.env.TOKEN || "wbenc1.x"} and the branch is downtown.`, parent_id: NL, priority: 0, completedAt: null, data: {} },
  { id: "bbbbbbbb-0000-4000-8000-000000000002", name: "Groceries", note: "milk\neggs\nbread", parent_id: NL, priority: 1, completedAt: null, data: {} },
];
let nextId = 10;
const GRP = "dddddddd-0000-4000-8000-000000000001";
nodes.push({ id: GRP, name: "Errands", note: "", parent_id: today, priority: 9, completedAt: null, data: { layoutMode: "bullets" } });
const kidsOf = { [GRP]: [
  { id: "dddddddd-0000-4000-8000-000000000002", name: "Buy stamps", note: "", parent_id: GRP, priority: 0, completedAt: null, data: { layoutMode: "todo" } },
  { id: "dddddddd-0000-4000-8000-000000000003", name: "Return library books", note: "", parent_id: GRP, priority: 1, completedAt: null, data: { layoutMode: "todo" } },
] };
const log = [], gets = {};
let busyAfter = -1, dayReads = 0;
http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const send = (o, s = 200) => { res.writeHead(s, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
    if (u.pathname === "/__log") return send(log);
    if (u.pathname === "/__gets") return send(gets);
    if (u.pathname === "/__busy") { busyAfter = Number(u.searchParams.get("after")); dayReads = 0; return send({ ok: true }); }
    if (req.method === "GET") { const k = u.pathname + u.search; gets[k] = (gets[k] || 0) + 1; }
    if (req.method === "GET" && u.pathname === "/nodes" && /^\d{4}-\d{2}-\d{2}$/.test(u.searchParams.get("parent_id") || "") && busyAfter >= 0 && ++dayReads > busyAfter) return send({ retry_after: 2 }, 429);
    if (u.pathname === "/nodes" && req.method === "GET") {
      const p = u.searchParams.get("parent_id");
      return send({ nodes: p === today ? nodes : p === NL ? notes : kidsOf[p] || [] });
    }
    /* AI test additions */ if (u.pathname === "/nodes-export") return send({ nodes: nodes.concat(notes, kidsOf[GRP], [{ id: NL, name: "Notes", note: "", parent_id: null, priority: 5, completedAt: null, data: {} }]) });
    if (u.pathname === "/nodes" && req.method === "POST") { const b = JSON.parse(body || "{}"); const id = "cccccccc-0000-4000-8000-0000000000" + (nextId++); log.push({ create: id, ...b }); if (b.parent_id === NL) notes.unshift({ id, name: b.name, note: b.note || "", parent_id: NL, priority: -1, completedAt: null, data: {} }); return send({ item_id: id }); }
    if (u.pathname === "/targets") return send({ targets: [] });
    const m = u.pathname.match(/^\/nodes\/([^/]+)$/);
    if (m && req.method === "GET") { const n = nodes.concat(notes, kidsOf[GRP], [{ id: NL, name: "Notes", note: "", parent_id: null, data: {} }]).find((x) => x.id === m[1]); return n ? send(n) : send({ error: "nf" }, 404); }
    if (m && req.method === "DELETE") { const i = notes.findIndex((x) => x.id === m[1]); log.push({ del: m[1] }); if (i >= 0) notes.splice(i, 1); return send({ status: "ok" }); }
    if (m && req.method === "POST") {
      const n = nodes.concat(notes, kidsOf[GRP]).find((x) => x.id === m[1]); const b = body ? JSON.parse(body) : {};
      log.push({ id: m[1], ...b });
      if (n && typeof b.name === "string") n.name = b.name; if (n && typeof b.note === "string") n.note = b.note;
      return send({ status: "ok" });
    }
    send({ error: "not mocked: " + req.method + " " + u.pathname }, 404);
  });
}).listen(Number(process.env.PORT) || 3918, "127.0.0.1");
