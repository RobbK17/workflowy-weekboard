# Add-ons: guide to installing and building them

Optional extras live in folders under `addons/`, next to `server.js`. With no `addons` folder (or an empty one) the board is the plain board.

**Add-ons are trusted code.** They run inside the board's server, with your WorkFlowy key and your whole outline in reach, and there is no sandbox. Install only add-ons from sources you trust, and read what an add-on does first. The board checks file names and routes, but it cannot make untrusted code safe.

## Installing and removing

Copy an add-on's folder into `addons/` and restart the board. To remove it, delete the folder and restart. `http://localhost:3000/addons` shows each add-on, its version and whether it loaded (and if not, why). A broken add-on never stops the board or the other add-ons from starting.

Included: **assistant** (AI Assistant, beta). See `addons/assistant/ASSISTANT.md`.

Also available: **crypt** (Encryption). Encrypts sensitive text before it goes into WorkFlowy, in the item editor, in a panel, and from the command line. It needs board 1.2.1 or newer and has no server part. See `addons/crypt/README.md`.

## Folder layout

```
addons/
  my-addon/
    manifest.json     required
    backend.js        optional: server part (any file name; set it in "server")
    page.html         optional: parts that are added to the page
    page.js           optional: script that runs after the board's own script
    MY-ADDON.md       optional: the add-on's own docs (name it in "docs")
```

### manifest.json

```json
{
  "id": "my-addon",
  "name": "My Add-on",
  "version": "1.0.0",
  "description": "One sentence about what it does.",
  "requires": { "board": "1.1.0" },
  "localOnly": false,
  "server": "backend.js",
  "page": "page.html",
  "script": "page.js",
  "docs": "MY-ADDON.md"
}
```

- `id` must equal the folder name (lowercase letters, digits and dashes). `version` is `major.minor.patch`.
- `requires.board` is the oldest board version it works with. If the board is older, the add-on is skipped with a message.
- `localOnly: true` skips the add-on in `vps` and `fly` mode.
- File names are plain names inside the add-on's folder (no paths).

### Server part (`backend.js` in the Assistant; named in the manifest's `server`)

Export a function that receives the board's helpers and returns the routes it wants:

```js
module.exports = (core) => ({
  routes: [
    { method: "GET", path: "/my-addon/ping", handler: (req, res, url) => core.sendJson(res, 200, { ok: true }) },
  ],
});
```

`core` gives you `KEY`, `BASE`, `REMOTE`, `sendJson`, `readBody`, `search`, `parseQuery`, `itemTree`, `ensureIndex`, `patchIndex`, `stripHtml`, `getIndex()` (the board's in-memory copy of the outline) and `crypto`. Routes may be `GET` or `POST`, must look like `/lowercase/path`, and can't reuse a path the board or another add-on already has. Add-on routes sit behind the same login and cross-site checks as the rest of the board.

### Page parts (`page.html`)

Named sections, each wrapped in a comment pair, are added to the page. All are optional:

| Part | Where it goes |
|------|---------------|
| `css` | The board's stylesheet |
| `button` | The header, before the refresh button |
| `panel` | The page body (side panels, dialogs) |
| `tab` | The tab list in Settings |
| `pane` | The settings pane (give it `class="set-pane setpane"`, a matching `data-sec`, and `hidden`) |

```html
<!--@button--><button id="myBtn" type="button">Hi</button><!--/@button-->
<!--@css-->#myBtn { color: red; }<!--/@css-->
```

### Page script (`page.js`)

Runs after the board's own script and can use its top-level functions and variables (for example `weekDays()`, `call()`, `showToast()`). It gets the board's one-time script token automatically. Prefix your element ids and storage keys with your add-on's name to avoid clashes.

An add-on has just one page script. If you keep your source in several files, join them into `page.js` with a small build step (the crypt add-on does this with `node build.js`; edit its sources, never its generated `page.js`).

### Editor hooks (board 1.2.1)

A page script can register for two moments in the item editor, through `boardHooks`. With nothing registered they do nothing, so the board works exactly as before.

```js
boardHooks.on("editorOpen", (ctx) => {
  // runs when an editor opens
  // ctx.node     the item being edited (its stored name and note)
  // ctx.title    the name's textarea     ctx.note   the note's textarea     ctx.box   the editor's container
  // ctx.tools    a row under the name box for small controls
  // ctx.save()   save as if Enter was pressed     ctx.cancel()   close without saving
  // ctx.onClose(fn)   call fn when the editor goes away, whether it was saved or cancelled
});

boardHooks.on("beforeSave", async (text, ctx) => {
  // runs when a name or note is about to be saved. text is the visible text, ctx = { node, field: "name" or "note" }
  // return the text to save instead, or throw an Error to stop the save: its message is shown and the editor stays open
  return text;
});
```

Notes for add-on authors:

- Hooks run for every editor: board cards, tasks inside a group, group titles, sub-items listed on a card, and lines on the Daily page and in the search window.
- `beforeSave` runs one after the other for each registered add-on, each getting the previous one's result, first for the name and then for the note. Return the text unchanged for a field you don't care about. If one throws, nothing is saved.
- `ctx.tools` is a flex row under the name box; put your own small controls in it (fall back to placing them after `ctx.title` if it is missing).
- While your add-on shows its own dialog (a passphrase prompt, say), set `ctx.box.dataset.hold = "1"` so the editor is not saved and closed when focus leaves it, and delete the attribute when the dialog goes away.
- While an editor is open the board delays any background redraw until it closes, so your controls are not wiped out by a reload.
- An error thrown inside `editorOpen` is logged to the console and ignored. An error thrown inside `beforeSave` stops the save, so use it only to refuse something deliberately.
- The board also shows any text matching `wbenc1.` plus 59 or more letters, digits, `-` or `_` as 🔒 wherever a name is displayed (and in push reminders), whether or not the crypt add-on is installed.

## Not included (on purpose)

No marketplace, permissions system or automatic installs. Keeping add-ons as plain folders keeps the board a small program with no dependencies.
