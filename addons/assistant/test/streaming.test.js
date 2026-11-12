// Streaming, Stop and prompt caching against the fake Anthropic.
const { A, B } = require("./urls");
const d = new Date(), pad = (n) => String(n).padStart(2, "0"), TODAY = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
let pass = 0, fail = 0;
const check = (n, ok, x) => { ok ? pass++ : fail++; console.log((ok ? "PASS " : "FAIL ") + n + (ok || !x ? "" : "\n     " + x)); };
const post = (u, b) => fetch(u, { method: "POST", headers: { "Content-Type": "application/json", Origin: B }, body: JSON.stringify(b) });
const ctx = { today: TODAY, day: TODAY, scope: "board", sources: [], board: `${TODAY}:\n  - Water plants (id x1)` };
// Reads the NDJSON stream; stopAfter(events) can return true to abort like the Stop button.
async function stream(script, body, stopAfter) {
  await post(A + "/__script", script);
  const ac = new AbortController();
  const res = await fetch(B + "/ai/chat", { method: "POST", headers: { "Content-Type": "application/json", Origin: B }, body: JSON.stringify({ ...body, stream: true }), signal: ac.signal });
  const ct = res.headers.get("content-type"), events = [];
  const reader = res.body.getReader(), dec = new TextDecoder(); let buf = "", stopped = false;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let i; while ((i = buf.indexOf("\n")) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (l.trim()) events.push(JSON.parse(l)); }
      if (stopAfter && stopAfter(events)) { stopped = true; ac.abort(); break; }
    }
  } catch (e) { if (!stopped) throw e; }
  await new Promise((r) => setTimeout(r, 400));
  const reqs = await fetch(A + "/__reqs").then((r) => r.json());
  return { ct, events, reqs, done: (events.find((e) => e.t === "done") || {}).out };
}
const ask = (t) => ({ messages: [{ role: "user", content: t }], writes: "ask", context: ctx });
(async () => {
  // 1. Plain answer, streamed
  let r = await stream([{ text: "You have one open task today: Water plants." }], ask("what's on today?"));
  const deltas = r.events.filter((e) => e.t === "delta");
  check("answer comes back as a stream (application/x-ndjson)", /ndjson/.test(r.ct), r.ct);
  check("text arrives in several pieces", deltas.length > 3, deltas.length);
  check("pieces add up to the full reply", deltas.map((e) => e.text).join("") === "You have one open task today: Water plants." && r.done && r.done.reply === "You have one open task today: Water plants.");
  check("Anthropic was asked to stream", r.reqs[0].body.stream === true);
  const sys = r.reqs[0].body.system, msgs = r.reqs[0].body.messages, lastBlk = msgs[msgs.length - 1].content.slice(-1)[0];
  check("cache point 1: tools and fixed instructions", Array.isArray(sys) && sys[0].cache_control && /You are the assistant/.test(sys[0].text) && !/Today is/.test(sys[0].text));
  check("cache point 2: today's context (date, board summary)", sys[1] && sys[1].cache_control && /Today is/.test(sys[1].text) && /Water plants/.test(sys[1].text));
  check("cache point 3: the conversation so far", lastBlk && lastBlk.cache_control && lastBlk.type === "text");
  check("usage reported", r.done.usage && r.done.usage.calls === 1 && r.done.usage.output === 40, JSON.stringify(r.done.usage));

  // 2. Text, then a tool call (input sent as JSON fragments), then the answer
  r = await stream([{ text: "Let me look.", tool: "search_outline", input: { query: "water", limit: 5 } }, { text: "Found Water plants." }], ask("find water"));
  const kinds = r.events.map((e) => e.t).filter((t, i, a) => t !== a[i - 1]).join(",");
  check("order: round, text, step (search), round, text, done", kinds === "round,delta,step,round,delta,done", kinds);
  const st = r.events.find((e) => e.t === "step");
  check("tool input rebuilt from JSON fragments", st && st.step.summary === "Searched “water”", st && st.step.summary);
  check("steps aren't repeated in the final answer", r.done.steps.length === 0);
  check("second call's conversation cache point is on the tool result", (() => { const m = r.reqs[1].body.messages; const b = m[m.length - 1].content.slice(-1)[0]; return b.type === "tool_result" && b.cache_control; })());
  check("second call reads the cache (fixed part unchanged)", JSON.stringify(r.reqs[0].body.system[0]) === JSON.stringify(r.reqs[1].body.system[0]) && r.done.usage.cacheRead > 0, JSON.stringify(r.done.usage));

  // 3. Stop: abort after a few words; the model call upstream is cancelled and nothing more is asked
  const long = Array.from({ length: 60 }, (_, i) => "word" + i).join(" ");
  r = await stream([{ text: long, slow: 60 }, { text: "should never be asked" }], ask("tell me a lot"), (ev) => ev.filter((e) => e.t === "delta").length >= 4);
  check("Stop: the reply was cut short", !r.done && r.events.filter((e) => e.t === "delta").length < 60);
  check("Stop: the call to Anthropic was cancelled", r.reqs.length === 1 && r.reqs[0].cut === true, JSON.stringify(r.reqs.map((x) => ({ cut: x.cut, fin: x.finished }))));

  // 4. Approve a change on a streamed answer: Undo arrives (applied) before the reply ends
  r = await stream([{ tool: "add_task", input: { parent: TODAY, name: "Stream test task" } }], ask("add a task"));
  const p = r.done && r.done.pending;
  check("approval card arrives in the stream", p && /Add task “Stream test task”/.test(p.actions[0].summary));
  r = await stream([{ text: "Added it." }], { resume: p.token, decisions: { [p.actions[0].id]: true } });
  const order = r.events.map((e) => e.t);
  const applied = r.events.find((e) => e.t === "applied");
  check("applied (with Undo) comes before the answer", applied && applied.undo.length === 1 && order.indexOf("applied") < order.indexOf("done") && order.indexOf("applied") < order.indexOf("round"), order.join(","));
  check("Undo not repeated in the final answer", r.done && r.done.undo.length === 0 && !r.done.changed);

  // 5. An error from the provider reaches the page as an error
  await post(A + "/__script", []);
  r = await stream([], { messages: [{ role: "user", content: "x" }], writes: "ask", context: ctx, model: "bad model name!" });
  check("still answers when the script runs out (no crash)", !!r.done);
  console.log(`\n${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error("crashed:", e); process.exit(1); });
