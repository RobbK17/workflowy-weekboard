// WorkFlowy's request limit: each day and group read once per answer, re-read after a change, groups from the outline copy past the
// budget (this board runs with AI_WF_BUDGET=3), and a "busy" (429) answer gives a partial result instead of an error.
const { W, A, B } = require("./urls");
const j = (r) => r.json(), post = (u, b, h) => fetch(u, { method: "POST", headers: { "Content-Type": "application/json", ...(h || {}) }, body: JSON.stringify(b) }).then(j);
const d = new Date(), pad = (n) => String(n).padStart(2, "0"), TODAY = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (k, n) => { const x = new Date(k + "T12:00:00"); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
const GRP = "dddddddd-0000-4000-8000-000000000001", WATER = "aaaaaaaa-0000-4000-8000-000000000005";
let pass = 0, fail = 0; const check = (n, ok, x) => { ok ? pass++ : fail++; console.log((ok ? "PASS " : "FAIL ") + n + (ok || x === undefined ? "" : "\n     " + String(x).slice(0, 400))); };
const ask = (t) => ({ messages: [{ role: "user", content: t }], writes: "ask", context: { today: TODAY, day: TODAY, scope: "board" } });
const gets = () => fetch(W + "/__gets").then(j);
const delta = (a, b, k) => (b[k] || 0) - (a[k] || 0);
async function chat(script, body) { await post(A + "/__script", script); const out = await post(B + "/ai/chat", body, { Origin: B }); const reqs = await fetch(A + "/__reqs").then(j); const tools = reqs.map((r) => { const m = r.body.messages; return JSON.stringify(m[m.length - 1].content); }); return { out, tools }; }
(async () => {
  await fetch(B + "/item?id=" + GRP + "&refresh=1");                     // the board's outline copy is loaded
  const dayKey = `/nodes?parent_id=${TODAY}`, grpKey = `/nodes?parent_id=${GRP}`;
  // 1. the same day read by three tools in one answer: once from WorkFlowy
  let g0 = await gets();
  let r = await chat([{ tool: "list_day", input: { date: TODAY } }, { tool: "day_schedule", input: { date: TODAY } }, { tool: "workload", input: { from: TODAY, to: TODAY } }, { text: "ok" }], ask("today?"));
  let g1 = await gets();
  check("one answer, three tools on today: today read once", delta(g0, g1, dayKey) === 1, JSON.stringify({ day: delta(g0, g1, dayKey) }));
  check("…and its group read once", delta(g0, g1, grpKey) === 1, delta(g0, g1, grpKey));
  // 2. a new question reads fresh
  await chat([{ tool: "list_day", input: { date: TODAY } }, { text: "ok" }], ask("again"));
  const g2 = await gets();
  check("a new question reads the day again", delta(g1, g2, dayKey) === 1);
  // 3. after an approved change, the answer re-reads
  r = await chat([{ tool: "set_priority", input: { id: WATER, priority: 2 } }], ask("make it high"));
  await post(A + "/__script", [{ tool: "list_day", input: { date: TODAY } }, { text: "done" }]);
  const g3 = await gets();
  await post(B + "/ai/chat", { resume: r.out.pending.token, decisions: { [r.out.pending.actions[0].id]: true } }, { Origin: B });
  const g4 = await gets();
  check("after a change, the day is read again (not from the cache)", delta(g3, g4, dayKey) === 1, delta(g3, g4, dayKey));
  // 4. past the budget (3 live reads), groups come from the outline copy
  r = await chat([{ tool: "workload", input: { from: addDays(TODAY, -3), to: TODAY } }, { text: "ok" }], ask("busy this week?"));
  const g5 = await gets();
  check("past the budget the group comes from the outline copy", delta(g4, g5, grpKey) === 0 && /read from the board's outline copy/.test(r.tools[1]), r.tools[1]);
  check("…and its tasks are still counted", /\d{4}-\d{2}-\d{2}: [5-9] open tasks/.test(r.tools[1].replace(/\\n/g, "\n").split("\n").filter((l) => l.includes(TODAY)).join("")), r.tools[1]);
  // 5. WorkFlowy busy: a partial answer, not an error
  await fetch(W + "/__busy?after=2");
  r = await chat([{ tool: "workload", input: { from: addDays(TODAY, -4), to: TODAY } }, { text: "Partly." }], ask("week?"));
  await fetch(W + "/__busy?after=-1");
  const w = r.tools[1].replace(/\\n/g, "\n");
  check("busy: the days it could read are there", (w.match(/^\d{4}-\d{2}-\d{2}: \d+ open/mg) || []).length === 2, w);
  check("busy: the rest are named, with a clear note", /onwards: not read\. WorkFlowy is busy/.test(w), w);
  check("busy: the answer still completes", r.out && r.out.reply === "Partly.", JSON.stringify(r.out).slice(0, 200));
  console.log(`\n${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error("crashed:", e); process.exit(1); });
