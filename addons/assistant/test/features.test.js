// Scheduling, estimates, workload, priorities, filters, Notes, text escaping, and the phone switch.
const { W, A, B } = require("./urls");
const j = (r) => r.json(), post = (u, b, h) => fetch(u, { method: "POST", headers: { "Content-Type": "application/json", ...(h || {}) }, body: JSON.stringify(b) }).then(j);
const d = new Date(), pad = (n) => String(n).padStart(2, "0"), TODAY = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const NL = "bbbbbbbb-0000-4000-8000-000000000000", WATER = "aaaaaaaa-0000-4000-8000-000000000005", REPORT = "aaaaaaaa-0000-4000-8000-000000000001", SPRINT = "aaaaaaaa-0000-4000-8000-000000000002", BANK = "bbbbbbbb-0000-4000-8000-000000000001", GROC = "bbbbbbbb-0000-4000-8000-000000000002";
let pass = 0, fail = 0; const check = (n, ok, x) => { ok ? pass++ : fail++; console.log((ok ? "PASS " : "FAIL ") + n + (ok || x === undefined ? "" : "\n     " + String(x).slice(0, 500))); };
const ctx = (e) => ({ today: TODAY, day: TODAY, scope: "board", sources: [], notesNode: { id: NL, name: "Notes" }, planHours: 2, ...(e || {}) });
const ask = (t, e) => ({ messages: [{ role: "user", content: t }], writes: "ask", context: ctx(e) });
async function chat(script, body) { await post(A + "/__script", script); const out = await post(B + "/ai/chat", body, { Origin: B }); const reqs = await fetch(A + "/__reqs").then(j); return { out, sent: JSON.stringify(reqs), lastTool: (() => { const m = reqs[reqs.length - 1].body.messages; const t = m[m.length - 1].content; return JSON.stringify(t); })() }; }
async function approve(out) { await post(A + "/__script", [{ text: "Done." }]); return post(B + "/ai/chat", { resume: out.pending.token, decisions: Object.fromEntries(out.pending.actions.map((a) => [a.id, true])) }, { Origin: B }); }
const lastName = async (id) => { const lg = await fetch(W + "/__log").then(j); const x = lg.filter((y) => y.id === id && y.name !== undefined).pop(); return x && x.name; };
const lastNote = async (id) => { const lg = await fetch(W + "/__log").then(j); const x = lg.filter((y) => y.id === id && y.note !== undefined).pop(); return x && x.note; };
(async () => {
  let r = await chat([{ tool: "list_day", input: { date: TODAY } }, { text: "ok" }], ask("what's on today"));
  check("list_day explains markers", /Plan<\/b> sprint|Plan sprint/.test(r.lastTool) && /\[P2 high · block 3:00 PM–4:30 PM · est 1h 30m\]/.test(r.lastTool), r.lastTool);

  r = await chat([{ tool: "day_schedule", input: { date: TODAY } }, { text: "ok" }], ask("schedule"));
  check("day_schedule lists blocks in order", /3:00 PM–4:30 PM.*sprint[\s\S]*3:30 PM–4:00 PM.*Review budget[\s\S]*4:30 PM–5:00 PM/.test(r.lastTool.replace(/\\n/g, "\n")), r.lastTool);
  check("day_schedule finds the overlap", /Overlaps:.*sprint.*Review budget/.test(r.lastTool), r.lastTool);
  check("day_schedule lists free time and loose tasks", /Free: 8:00 AM/.test(r.lastTool) && /no time: .*Water plants/.test(r.lastTool), r.lastTool);

  r = await chat([{ tool: "workload", input: { from: TODAY, to: TODAY } }, { text: "ok" }], ask("am I overbooked"));
  check("workload compares with Plan day hours (2h) and says OVER", /Plan day hours\): 2h/.test(r.lastTool) && /OVER by/.test(r.lastTool), r.lastTool);
  r = await chat([{ tool: "workload", input: { from: TODAY, to: TODAY } }, { text: "ok" }], ask("busy?", { planHours: 0 }));
  check("workload without Plan day hours uses 8h and says so", /8-hour day/.test(r.lastTool) && /spare/.test(r.lastTool), r.lastTool);

  r = await chat([{ tool: "set_time_block", input: { id: WATER, start: "10am", length: "2h" } }], ask("block 2 hours at 10 for watering"));
  check("time block card reads cleanly", r.out.pending && r.out.pending.actions[0].summary === "Block “Water plants” 10:00 AM–12:00 PM (estimate 2h)", r.out.pending && r.out.pending.actions[0].summary);
  await approve(r.out);
  check("time block written as the board's markers", (await lastName(WATER)) === "Water plants ^10am ~2h", await lastName(WATER));
  r = await chat([{ tool: "set_time_block", input: { id: WATER, start: "14:30" } }], ask("move it to 2:30"));
  await approve(r.out);
  check("changing the start keeps the estimate", (await lastName(WATER)) === "Water plants ~2h ^14:30", await lastName(WATER));
  r = await chat([{ tool: "set_time_block", input: { id: WATER, start: "none" } }], ask("unblock")); await approve(r.out);
  check("removing the block keeps the estimate", (await lastName(WATER)) === "Water plants ~2h", await lastName(WATER));
  r = await chat([{ tool: "set_estimate", input: { id: WATER, length: "45 min" } }], ask("45 minutes")); await approve(r.out);
  check("set_estimate (45 min)", (await lastName(WATER)) === "Water plants ~45m", await lastName(WATER));
  r = await chat([{ tool: "set_priority", input: { id: WATER, priority: 1 } }], ask("make it urgent"));
  check("priority card", r.out.pending && /Set “Water plants” to P1 \(urgent\)/.test(r.out.pending.actions[0].summary), r.out.pending && r.out.pending.actions[0].summary);
  const u = await approve(r.out);
  check("priority written as !p1", (await lastName(WATER)) === "Water plants ~45m !p1", await lastName(WATER));
  check("priority undo restores the old name", (u.undo || []).some((x) => x.body && x.body.name === "Water plants ~45m"));
  r = await chat([{ tool: "set_priority", input: { id: WATER, priority: 0 } }], ask("no priority")); await approve(r.out);
  check("priority removed", (await lastName(WATER)) === "Water plants ~45m", await lastName(WATER));
  r = await chat([{ tool: "set_time_block", input: { id: WATER, start: "25pm" } }, { text: "bad" }], ask("x"));
  check("a bad time is refused before a card", !r.out.pending && /start must look like/.test(r.sent));

  r = await chat([{ tool: "add_task", input: { parent: TODAY, name: "Gym", start: "7am", length: "1h", priority: 3 } }], ask("add gym at 7 for an hour, medium"));
  check("add_task card shows priority and block", r.out.pending && /Add task “Gym” to .* \(P3, 7:00 AM–8:00 AM\)/.test(r.out.pending.actions[0].summary), r.out.pending && r.out.pending.actions[0].summary);
  await approve(r.out);
  const lg = await fetch(W + "/__log").then(j);
  check("add_task writes the markers", lg.some((x) => x.create && x.name === "Gym ^7am ~1h !p3"), JSON.stringify(lg.filter((x) => x.create).slice(-1)));

  r = await chat([{ tool: "add_task", input: { parent: TODAY, name: "Fish & chips <menu>" } }], ask("add fish"));
  check("a task with & and < shows as typed on the card", r.out.pending && r.out.pending.actions[0].summary.startsWith("Add task “Fish & chips <menu>”"), r.out.pending && r.out.pending.actions[0].summary);
  await approve(r.out);
  check("…and is stored escaped (WorkFlowy names are HTML)", (await fetch(W + "/__log").then(j)).some((x) => x.create && x.name === "Fish &amp; chips &lt;menu&gt;"));
  r = await chat([{ tool: "rename_item", input: { id: SPRINT, name: "Plan Q1 sprint" } }], ask("rename sprint")); await approve(r.out);
  check("rename keeps the task's markers", /^Plan Q1 sprint( !p2| ~1h30m| \^3pm){3}$/.test(await lastName(SPRINT)), await lastName(SPRINT));

  r = await chat([{ tool: "find_tasks", input: { filter: "p:1-2" } }, { text: "ok" }], ask("my urgent and high"));
  check("find_tasks uses the board's filter (p:1-2)", /match/.test(r.lastTool) && /P2 high/.test(r.lastTool) && !/Water plants/.test(r.lastTool), r.lastTool);
  r = await chat([{ tool: "find_tasks", input: { filter: "p:9" } }, { text: "ok" }], ask("x"));
  check("find_tasks reports a bad filter", /Error: Didn't understand/.test(r.lastTool), r.lastTool);

  r = await chat([{ tool: "list_notes", input: {} }, { text: "ok" }], ask("my notes"));
  check("list_notes lists titles and starts", /Bank stuff/.test(r.lastTool) && /Groceries/.test(r.lastTool) && !/wbenc1/.test(r.lastTool), r.lastTool);
  r = await chat([{ tool: "read_note", input: { id: BANK } }, { text: "ok" }], ask("read bank"));
  check("read_note: full text, encrypted part hidden", /Card PIN: ‹secret›/.test(r.lastTool) && !/wbenc1/.test(r.sent), r.lastTool);
  r = await chat([{ tool: "read_note", input: { id: WATER } }, { text: "ok" }], ask("x"));
  check("read_note refuses an item that isn't a note", /isn't one of the notes/.test(r.lastTool), r.lastTool);
  r = await chat([{ tool: "create_note", input: { title: "Trip <plan>", text: "Day 1\nDay 2" } }], ask("new note"));
  check("create_note card", r.out.pending && /Create note “Trip <plan>” in Notes/.test(r.out.pending.actions[0].summary), r.out.pending && r.out.pending.actions[0].summary);
  await approve(r.out);
  const lg2 = await fetch(W + "/__log").then(j);
  check("create_note writes under the notes node, at the top, title escaped", lg2.some((x) => x.create && x.parent_id === NL && x.name === "Trip &lt;plan&gt;" && x.note === "Day 1\nDay 2" && x.position === "top"));
  r = await chat([{ tool: "append_to_note", input: { id: GROC, text: "butter" } }], ask("add butter")); const ap = await approve(r.out);
  check("append_to_note adds at the end, keeps the rest", (await lastNote(GROC)) === "milk\neggs\nbread\nbutter", await lastNote(GROC));
  check("append undo restores the old text", (ap.undo || []).some((x) => x.body && x.body.note === "milk\neggs\nbread"));
  r = await chat([{ tool: "append_to_note", input: { id: BANK, text: "PIN is ‹secret›" } }, { text: "no" }], ask("x"));
  check("append can't add ‹secret›", !r.out.pending && /can't contain encrypted text/.test(r.sent));
  r = await chat([{ tool: "list_notes", input: {} }, { text: "no" }], ask("notes", { notesNode: null }));
  check("notes tools explain when no Notes location is set", /no Notes location is set/.test(r.lastTool), r.lastTool);

  const ph = await fetch(B + "/ai/chat", { method: "POST", headers: { "Content-Type": "application/json", Origin: B }, body: JSON.stringify(ask("hi", { client: "phone" })) });
  check("phone requests are refused unless AI_PHONE=1", ph.status === 403);
  await post(A + "/__script", [{ text: "hi" }]);
  const { P } = require("./urls");
  await fetch(P + "/ai/chat", { method: "POST", headers: { "Content-Type": "application/json", Origin: P }, body: JSON.stringify(ask("hi", { client: "phone" })) }).then(j);
  const tools = (await fetch(A + "/__reqs").then(j))[0].body.tools.map((t) => t.name);
  check("with AI_PHONE=1: phone works, board tools left out", !tools.includes("show_week") && !tools.includes("open_item") && tools.includes("set_time_block") && tools.includes("list_notes"), tools.join(","));
  console.log(`\n${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error("crashed:", e); process.exit(1); });
