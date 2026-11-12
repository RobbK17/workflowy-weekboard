/* Markdown add-on, phone glue: the format bar and the preview in the note editor, and cleaner snippets in the notes list.
   The phone has no settings tab for add-ons; it reads the settings the desktop saved on the server (when a note opens and when
   the page comes back to the front). Until they arrive the add-on is off. */
(function () {
  "use strict";
  if (!window.wbMd || typeof wbNotes === "undefined") return;
  const md = window.wbMd;
  let ui = null, ctx = null;
  md.load();

  wbNotes.mount((c) => { ctx = c; ui = md.attach(c, { toast: (m) => { if (typeof toast === "function") toast(m); } }); });
  wbNotes.onState((s) => { if (ui) ui.onState(s); if (s.shown) md.load(); });
  wbNotes.snippet((text) => (md.settings.enabled && md.settings.stripSnippets ? md.strip(text) : text));
  md.onSettings(() => { if (ctx && ctx.refreshList) ctx.refreshList(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) md.load(); });
})();
