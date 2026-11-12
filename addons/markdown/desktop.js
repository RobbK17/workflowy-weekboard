/* Markdown add-on, desktop glue: puts the format bar and the preview in the Notes window, cleans the list snippets, and runs the
   "Markdown" tab in Settings. All the real work is in shared.js. Until the settings arrive from the server the add-on is off. */
(function () {
  "use strict";
  if (!window.wbMd || typeof wbNotes === "undefined") return;
  const md = window.wbMd;
  let ui = null, ctx = null;
  md.load();

  wbNotes.mount((c) => { ctx = c; ui = md.attach(c, { toast: (m) => { if (typeof showToast === "function") showToast(m, false); } }); });
  wbNotes.onState((s) => { if (ui) ui.onState(s); if (s.shown) md.load(); });          // read again each time the window opens: the phone may have changed them
  wbNotes.snippet((text) => (md.settings.enabled && md.settings.stripSnippets ? md.strip(text) : text));
  md.onSettings(() => { if (ctx && ctx.refreshList) ctx.refreshList(); });

  /* The Settings > Markdown tab */
  const $ = (id) => document.getElementById(id);
  const en = $("mdOptEnabled"), mode = $("mdOptMode"), bar = $("mdOptBar"), snip = $("mdOptSnip"), keys = $("mdOptKeys"), msg = $("mdMsg");
  if (!en) return;
  const say = (t, bad) => { msg.textContent = t; msg.style.color = bad ? "var(--err,#c33)" : "var(--muted)"; };
  function show() {
    const s = md.settings;
    en.checked = s.enabled; mode.value = s.defaultMode; bar.checked = s.showToolbar; snip.checked = s.stripSnippets; keys.checked = s.shortcuts;
    for (const el of [mode, bar, snip, keys]) el.disabled = !s.enabled;
  }
  md.onSettings(show); show();
  const tab = document.querySelector('[data-sec="markdown"][role="tab"]');
  if (tab) tab.addEventListener("click", () => { say(""); md.load().then(show); });
  async function put(change) {
    say("Saving…");
    try { await md.save(change); say("Saved. The phone picks this up the next time it opens a note."); }
    catch (e) { say(e.message, true); show(); }
  }
  en.onchange = () => put({ enabled: en.checked });
  mode.onchange = () => put({ defaultMode: mode.value });
  bar.onchange = () => put({ showToolbar: bar.checked });
  snip.onchange = () => put({ stripSnippets: snip.checked });
  keys.onchange = () => put({ shortcuts: keys.checked });
})();
