#!/usr/bin/env node
/* Runs the AI Assistant's tests against fake WorkFlowy, Anthropic and Ollama servers: no network, no API keys, nothing written
   outside a temporary folder. From the board's folder:   node addons/assistant/test/run.js        (or one suite: … run.js streaming)
   Each suite gets fresh fakes and a fresh board (server.js with this add-on), on free ports; the exit code is 1 if anything fails. */
"use strict";
const { spawn } = require("child_process"), net = require("net"), fs = require("fs"), os = require("os"), path = require("path");
const HERE = __dirname, SERVER = path.resolve(HERE, "../../../server.js");
const SUITES = {
  safety:    { boards: { T_BOARD: {} } },
  streaming: { boards: { T_BOARD: {} } },
  features:  { boards: { T_BOARD: {}, T_PHONE_BOARD: { AI_PHONE: "1" } } },
  requests:  { boards: { T_BOARD: { AI_WF_BUDGET: "3" } } },
  ollama:    { boards: { T_OLLAMA_BOARD: { AI_PROVIDER: "ollama" } }, ollama: true },
};
const freePort = () => new Promise((ok, no) => { const s = net.createServer(); s.on("error", no); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => ok(p)); }); });
async function waitFor(url, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { try { await fetch(url); return; } catch (e) { await new Promise((r) => setTimeout(r, 100)); } }
  throw new Error("didn't start: " + url);
}
async function runSuite(name, cfg, token) {
  const procs = [], tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wb-assistant-test-"));
  const start = (file, env, log) => { const p = spawn(process.execPath, [file], { env: { ...process.env, ...env }, cwd: tmp, stdio: ["ignore", fs.openSync(path.join(tmp, log), "w"), fs.openSync(path.join(tmp, log), "a")] }); procs.push(p); return p; };
  try {
    const wf = await freePort(), ai = await freePort(), ol = await freePort();
    const urls = { T_WF: `http://127.0.0.1:${wf}`, T_AI: `http://127.0.0.1:${ai}`, T_OLLAMA: `http://127.0.0.1:${ol}` };
    start(path.join(HERE, "mock-workflowy.js"), { PORT: wf, TOKEN: token }, "workflowy.log");
    start(path.join(HERE, "mock-anthropic.js"), { PORT: ai }, "anthropic.log");
    if (cfg.ollama) start(path.join(HERE, "mock-ollama.js"), { PORT: ol }, "ollama.log");
    await waitFor(urls.T_WF + "/__log"); await waitFor(urls.T_AI + "/__reqs"); if (cfg.ollama) await waitFor(urls.T_OLLAMA + "/__reqs");
    for (const [key, extra] of Object.entries(cfg.boards)) {
      const port = await freePort(), state = (f) => path.join(tmp, `${key}-${f}`);
      start(SERVER, {
        PORT: port, DEPLOY_MODE: "local", WORKFLOWY_API_KEY: "test", WORKFLOWY_BASE_URL: urls.T_WF,
        AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "test-key", ANTHROPIC_URL: urls.T_AI, OLLAMA_URL: urls.T_OLLAMA,
        MOBILE_SETTINGS_FILE: state("mobile.json"), DESKTOP_SETTINGS_FILE: state("desktop.json"), CARD_COLORS_FILE: state("colors.json"),
        MARKDOWN_SETTINGS_FILE: state("markdown.json"), FEATURES_STATE: state("features.json"), TIMEBLOCKS_STATE: state("timeblocks.json"),
        REMINDER_STATE: state("reminders.json"), RECURRING_STATE: state("recurring.json"), RECURRING: "0",
        NTFY_TOPIC: "", PUSHOVER_TOKEN: "", PUSHOVER_USER: "", AI_PHONE: "", AI_ALLOW_REMOTE: "", AI_WF_BUDGET: "", ...extra,
      }, `${key}.log`);
      urls[key] = `http://127.0.0.1:${port}`;
      await waitFor(urls[key] + "/ai/status");
    }
    const code = await new Promise((ok) => { const p = spawn(process.execPath, [path.join(HERE, `${name}.test.js`)], { env: { ...process.env, ...urls }, stdio: "inherit" }); p.on("exit", ok); });
    return code;
  } finally {
    for (const p of procs) { try { p.kill(); } catch (e) {} }
    await new Promise((r) => setTimeout(r, 200));
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  }
}
(async () => {
  const want = process.argv.slice(2), names = want.length ? want : Object.keys(SUITES);
  for (const n of names) if (!SUITES[n]) { console.error(`No suite "${n}". Suites: ${Object.keys(SUITES).join(", ")}`); process.exit(2); }
  const token = await require("../../crypt/wbcrypt-core.js").encrypt("4321", "pw");
  const results = [];
  for (const n of names) {
    console.log(`\n=== ${n} ===`);
    let code; try { code = await runSuite(n, SUITES[n], token); } catch (e) { console.error(e.message); code = 1; }
    results.push([n, code]);
  }
  console.log("\n" + results.map(([n, c]) => `${c === 0 ? "ok  " : "FAIL"}  ${n}`).join("\n"));
  process.exit(results.some(([, c]) => c !== 0) ? 1 : 0);
})();
