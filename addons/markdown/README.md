# Markdown notes (add-on)

Adds a format bar and a read-only preview to the desktop Notes window and the phone's note editor.

Install: copy this folder to `addons/markdown/` next to `server.js`, use board v1.5.4 or newer (server.js, index.html and
mobile.html), restart. Remove the folder to uninstall; notes are never changed by the add-on.

Settings (Settings > Markdown on the desktop) are saved on the server in `markdown-settings.json`
(override with `MARKDOWN_SETTINGS_FILE`), so the phone uses the same ones: on/off, open in Edit or Preview, format bar,
keyboard shortcuts, plain notes-list previews.

Supported: headings, bold, italic, inline code, code blocks, links (http, https, mailto), quotes, bullet / numbered / task
lists (checkboxes are read-only), horizontal rules. Images are not shown. Text inside Encrypt's ⟦ ⟧ is never parsed, and the
preview is cleared when the note locks or the window closes.

Files: `shared.js` (settings, renderer, format bar; inlined into both pages), `desktop.js` / `mobile.js` (glue),
`mobile.css`, `page.html` (desktop CSS and the Settings tab), `server.js` (the `/markdown/settings` route).
