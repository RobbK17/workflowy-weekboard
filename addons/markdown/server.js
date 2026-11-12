/* Markdown add-on: server side. One small route keeps the add-on's settings in markdown-settings.json (next to server.js),
   so the desktop board and the phone page read the same ones.
     GET  /markdown/settings  ->  { enabled, defaultMode, showToolbar, stripSnippets, shortcuts }
     POST /markdown/settings  ->  merges the keys sent (only these keys, only these value types) and returns the result.
   Nothing here touches your outline. */
const fs = require("fs");
const path = require("path");

const FILE = process.env.MARKDOWN_SETTINGS_FILE || path.join(__dirname, "..", "..", "markdown-settings.json");
const DEFAULTS = { enabled: true, defaultMode: "edit", showToolbar: true, stripSnippets: true, shortcuts: true };
const BOOLS = ["enabled", "showToolbar", "stripSnippets", "shortcuts"];
const MODES = ["edit", "preview"];

function load() {
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(FILE, "utf8")) || {}; } catch (e) { /* none saved yet: the defaults */ }
  const out = { ...DEFAULTS };
  for (const k of BOOLS) if (typeof saved[k] === "boolean") out[k] = saved[k];
  if (MODES.includes(saved.defaultMode)) out.defaultMode = saved.defaultMode;
  return out;
}
function clean(x) {                                   // only known keys with the right kind of value; anything else is refused
  if (!x || typeof x !== "object" || Array.isArray(x)) throw new Error("settings must be an object");
  const out = {};
  for (const k of Object.keys(x)) {
    if (BOOLS.includes(k)) { if (typeof x[k] !== "boolean") throw new Error("bad " + k); out[k] = x[k]; }
    else if (k === "defaultMode") { if (!MODES.includes(x[k])) throw new Error("bad defaultMode"); out[k] = x[k]; }
    else throw new Error("unknown setting " + k);
  }
  return out;
}

module.exports = (ctx) => ({
  routes: [
    { method: "GET", path: "/markdown/settings", handler: (req, res) => ctx.sendJson(res, 200, load()) },
    {
      method: "POST", path: "/markdown/settings",
      handler: async (req, res) => {
        let body;
        try { body = JSON.parse((await ctx.readBody(req, 2048)).toString() || "{}"); } catch (e) { return ctx.sendJson(res, 400, { error: "bad request" }); }
        let change;
        try { change = clean(body); } catch (e) { return ctx.sendJson(res, 400, { error: e.message }); }
        // Read, merge and write with no await in between, so two saves at once can't drop each other's changes.
        const merged = { ...load(), ...change };
        try { const tmp = FILE + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(merged, null, 2)); fs.renameSync(tmp, FILE); }
        catch (e) { console.error("Could not save the Markdown settings:", e.message); return ctx.sendJson(res, 500, { error: "The server could not write " + path.basename(FILE) + " (is the board folder writable?)" }); }
        return ctx.sendJson(res, 200, merged);
      },
    },
  ],
});
