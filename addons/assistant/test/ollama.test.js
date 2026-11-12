// Streaming and usage through the fake Ollama (JSON lines, not server-sent events).
const { O, OL } = require("./urls");
const d = new Date(), p = (n) => String(n).padStart(2, "0"), T = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
let pass = 0, fail = 0; const ok = (n, c, x) => { c ? pass++ : fail++; console.log((c ? "PASS " : "FAIL ") + n + (c || x === undefined ? "" : "\n     " + x)); };
(async () => {
  const res = await fetch(O + "/ai/chat", { method: "POST", headers: { "Content-Type": "application/json", Origin: O }, body: JSON.stringify({ stream: true, messages: [{ role: "user", content: "how many today?" }], writes: "ask", context: { today: T, day: T, scope: "board" } }) });
  const ev = (await res.text()).trim().split("\n").map(JSON.parse);
  const kinds = ev.map((e) => e.t).filter((x, i, a) => x !== a[i - 1]).join(","), done = ev.find((e) => e.t === "done").out;
  const reqs = await fetch(OL + "/__reqs").then((r) => r.json());
  ok("order: round, step, round, text, done", kinds === "round,step,round,delta,done", kinds);
  ok("text pieces add up", ev.filter((e) => e.t === "delta").map((e) => e.text).join("") === "You have five tasks." && done.reply === "You have five tasks.");
  ok("Ollama asked to stream", reqs.every((r) => r.stream === true));
  ok("the tool call ran (list_day)", ev.some((e) => e.t === "step" && /^Read \d{4}-/.test(e.step.summary)));
  ok("usage counted", done.usage && done.usage.calls === 2 && done.usage.input === 2100 && done.usage.output === 21, JSON.stringify(done.usage));
  ok("context size 16,384 by default", reqs.every((r) => r.options && r.options.num_ctx === 16384), JSON.stringify(reqs[0].options));
  ok("one system message (fixed part and context together)", reqs[0].messages.filter((m) => m.role === "system").length === 1 && /You are the assistant[\s\S]*Today is/.test(reqs[0].messages[0].content));
  console.log(`\n${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error("crashed:", e); process.exit(1); });
