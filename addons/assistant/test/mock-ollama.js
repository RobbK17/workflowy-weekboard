// Fake Ollama for the tests: the first chat call asks for list_day (today), the next streams a short answer. Records requests (/__reqs).
const http = require("http"); let calls = 0; const reqs = [];
http.createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
  if (req.url === "/api/tags") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ models: [{ name: "qwen3:8b" }] })); }
  if (req.url === "/__reqs") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify(reqs)); }
  const body = JSON.parse(b); reqs.push(body); calls++;
  res.writeHead(200, { "Content-Type": "application/x-ndjson" });
  const line = (o) => res.write(JSON.stringify(o) + "\n");
  if (calls === 1) {
    const date = body.messages.find((m) => m.role === "system").content.match(/Today is (\d{4}-\d{2}-\d{2})/)[1];
    line({ message: { role: "assistant", content: "", tool_calls: [{ function: { name: "list_day", arguments: { date } } }] }, done: false });
    line({ message: { content: "" }, done: true, prompt_eval_count: 900, eval_count: 12 });
  } else { for (const w of ["You ", "have ", "five ", "tasks."]) line({ message: { role: "assistant", content: w }, done: false }); line({ message: { content: "" }, done: true, prompt_eval_count: 1200, eval_count: 9 }); }
  res.end();
}); }).listen(Number(process.env.PORT) || 3920, "127.0.0.1");
