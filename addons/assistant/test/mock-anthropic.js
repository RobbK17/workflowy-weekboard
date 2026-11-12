// Fake Anthropic Messages API for the tests (plain and streamed): replies from a script (POST /__script), records requests (/__reqs) and whether a stream was cut off.
const http = require("http");
let script = [], reqs = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
http.createServer((req, res) => {
  let b = ""; req.on("data", (c) => (b += c)); req.on("end", async () => {
    const send = (o, s = 200) => { res.writeHead(s, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
    if (req.url === "/__script") { script = JSON.parse(b); reqs = []; return send({ ok: true }); }
    if (req.url === "/__reqs") return send(reqs);
    if (req.url !== "/v1/messages") return send({ error: "no" }, 404);
    const body = JSON.parse(b), rec = { body, cut: false, finished: false }; reqs.push(rec);
    const next = script.shift() || { text: "(script ran out)" };
    const usage = { input_tokens: 50, cache_read_input_tokens: reqs.length > 1 ? 2000 : 0, cache_creation_input_tokens: reqs.length > 1 ? 30 : 2000, output_tokens: 1 };
    if (!body.stream) {
      const content = []; if (next.text) content.push({ type: "text", text: next.text }); if (next.tool) content.push({ type: "tool_use", id: "tu" + reqs.length, name: next.tool, input: next.input || {} });
      rec.finished = true; return send({ id: "m", type: "message", role: "assistant", content, stop_reason: next.tool ? "tool_use" : "end_turn", usage: { ...usage, output_tokens: 40 } });
    }
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.on("close", () => { if (!rec.finished) rec.cut = true; });
    const ev = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
    ev("message_start", { message: { id: "m", usage } });
    let idx = 0;
    if (next.text) {
      ev("content_block_start", { index: idx, content_block: { type: "text", text: "" } });
      for (const w of next.text.match(/\S+\s*/g) || []) { if (rec.cut) return; ev("content_block_delta", { index: idx, delta: { type: "text_delta", text: w } }); if (next.slow) await sleep(next.slow); }
      ev("content_block_stop", { index: idx }); idx++;
    }
    if (next.tool) {
      const js = JSON.stringify(next.input || {});
      ev("content_block_start", { index: idx, content_block: { type: "tool_use", id: "tu" + reqs.length, name: next.tool, input: {} } });
      for (let i = 0; i < js.length; i += 7) ev("content_block_delta", { index: idx, delta: { type: "input_json_delta", partial_json: js.slice(i, i + 7) } });
      ev("content_block_stop", { index: idx });
    }
    ev("message_delta", { delta: { stop_reason: next.tool ? "tool_use" : "end_turn" }, usage: { output_tokens: 40 } });
    ev("message_stop", {}); rec.finished = true; res.end();
  });
}).listen(Number(process.env.PORT) || 3919, "127.0.0.1");
