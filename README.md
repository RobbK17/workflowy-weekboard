# Workflowy Week Board

A kanban-style week view for your WorkFlowy todos. Each day is a column, and everything you do on the board (add, check off, edit, move, delete) is saved straight back to WorkFlowy through its API.

<img width="1750" height="918" alt="Workflowy Week Board" src="https://github.com/user-attachments/assets/44ea2b16-ffdd-4d0f-b279-2f1305ac4577" />

**Version 1.0.1**

## What's in the box

| File | What it does |
|------|--------------|
| `server.js` | A tiny Node server. It holds your API key, forwards requests to WorkFlowy, and serves the page. Your key never reaches the browser. |
| `index.html` | The board itself (a single page, no build step, no dependencies). |

## Requirements

- **Node.js 18 or newer** (uses the built-in `fetch`). Check with `node --version`.
- A **WorkFlowy API key** from <https://workflowy.com/api-key>.
- A modern browser.

No `npm install` is needed.

## Installation

1. Put `server.js` and `index.html` in the same folder.
2. Get your API key from <https://workflowy.com/api-key>.
3. Open a terminal in that folder and start the server with your key.

**Windows, Command Prompt:**
```
set WORKFLOWY_API_KEY=your_key_here
node server.js
```
Don't put quotes around the key or spaces around the `=`.

**Windows, PowerShell:**
```
$env:WORKFLOWY_API_KEY="your_key_here"
node server.js
```

**Mac or Linux:**
```
WORKFLOWY_API_KEY=your_key_here node server.js
```

4. Open <http://localhost:3000> in your browser.

On Windows the key only lasts for that terminal window, so set it again each time you open a new one.

### Windows: use the Windows certificates (if needed)

If you're on Windows and see a certificate error such as `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, your antivirus or company network is inspecting HTTPS traffic. Tell Node to use the Windows certificate store by setting `NODE_USE_SYSTEM_CA=1` **before** starting the server. This needs Node 22.15+ or 23.8+; check with `node --version`.

**Command Prompt:**
```
set NODE_USE_SYSTEM_CA=1
set WORKFLOWY_API_KEY=your_key_here
node server.js
```

**PowerShell:**
```
$env:NODE_USE_SYSTEM_CA="1"
$env:WORKFLOWY_API_KEY="your_key_here"
node server.js
```

Like the API key, this only lasts for that terminal window. If you'd like it to stick, set it as a permanent user environment variable instead (`setx NODE_USE_SYSTEM_CA 1`, then open a new terminal).

### Configuration

All settings are environment variables, set the same way as the key above.

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `WORKFLOWY_API_KEY` | Yes | none | Your WorkFlowy API key. |
| `WORKFLOWY_BASE_URL` | No | `https://workflowy.com/api/v1` | API address. If you get errors, try `https://beta.workflowy.com/api/v1` (WorkFlowy's reference docs use that address). |
| `PORT` | No | `3000` | Port to serve the board on. |
| `NODE_USE_SYSTEM_CA` | No | off | Set to `1` on Windows to use the Windows certificate store (fixes certificate errors on networks that inspect HTTPS). Needs Node 22.15+ or 23.8+. |

## Using the board

**Columns and days**
- Choose **3**, **5**, or **7** days with the buttons in the header. The default is 5 (Monday to Friday). 7 is Monday to Sunday. 3 is today plus the next two days.
- Use the arrows to move between weeks (or 3-day blocks), and "This week" to jump back to the current one.
- The ↻ button reloads everything from WorkFlowy.

**Tasks**
- Type in a column's **+ Add task** box and press Enter. New tasks go to the bottom of that day.
- Tick the checkbox to complete or un-complete a task.
- Double-click a task's text to edit it.
- Click ✕ to delete (permanent, with a confirmation).
- Drag a task onto another day's column to move it (mouse only; this doesn't work by touch).
- The day header and add box stay in place while the task list scrolls.

**Header options** (all remembered in your browser)
- **Hide completed:** hides checked-off tasks.
- **Past due:** adds a panel of open tasks from *before* the days on screen. Choose how far back with the buttons in the panel: **All**, **1w**, **2w**, **3w**, or **4w** (default 2w).
- **Upcoming:** adds a panel of tasks in the 14 days *after* the days on screen.

Both panels are relative to the view. If you're looking at last week, Past due shows what was open before that week, and Upcoming shows the 14 days after it, including this week.

**Sidebar (far right)**
- **Calendar:** click a day to jump the board to that week. Today is outlined, the days on screen are shaded, and a dot marks days with open tasks (only for days the board has already loaded).
- **Past due / Upcoming** panels appear under the calendar when switched on.
- **Today's page:** shows the notes on today's WorkFlowy daily page, nested like the outline (up to 12 levels; the pane scrolls when it's long). Tasks are left out: any todo sitting directly on the page appears on the board, not here. (A todo nested deeper, such as inside WB-Notes, still shows with a checkbox, since the board doesn't display those.) Double-click any line to edit its text. It reloads when you open the board, after you save from the pad, and with its own ↻ button.
  - The **⤢** button in the pane's header expands it to fill the whole sidebar (the calendar and Past due / Upcoming panels are hidden, and the add pad stays underneath). Click **⤡** to go back. Your choice is remembered.
  - The sidebar always fits the window. The calendar and the Past due / Upcoming panels keep their size, Today's page takes the room that's left, and it scrolls inside itself (so the sidebar doesn't scroll as a whole, except on a very small window).
  - Hover a line and click **>** to indent it: it becomes the last child of the line above it and takes its own sub-bullets along. The first line in a group has no **>**, since there's nothing above it to indent under.
  - Hover a line and click **+** to add a new line under it (as its last child). The box stays open so you can add several in a row; press Enter to add and Esc to close.
- **Add to WB-Notes:** a pad underneath for your daily notes. Everything you save goes into a single bullet named **WB-Notes** on today's page, so your notes stay together.
  - The board finds the WB-Notes bullet by name each day and creates it (at the bottom of the page) if it isn't there yet, so saving again and again just keeps adding to it.
  - One bullet per line. Tab indents and Shift+Tab outdents. Enter continues the bullet, and Enter on an empty bullet outdents, then removes it.
  - Press **Ctrl+Enter** or click **Save to WB-Notes**. Nested bullets are saved as child nodes, and the pad clears when done.
  - Your draft is kept in the browser until saved. If a save fails partway, only the unsaved lines remain.
  - **Move notes in** gathers today's plain top-level bullets (with their sub-bullets) into WB-Notes, in their current order. It asks first, shows what will move, and leaves todos, headings, and the WB-Notes bullet alone. Items are moved, not copied.
  - Don't rename the WB-Notes bullet in WorkFlowy. If you do, the board won't recognize it and will create a new one.

## How it maps to WorkFlowy

- Each column is a day in your WorkFlowy **calendar** (for example `2026-10-23`). Tasks are that day's children.
- The board shows **todo items only**. Plain bullets, headers, quotes, and code blocks under a day are skipped.
- Tasks added on the board are created as todos under that day. Moving a task changes its parent, so it's moved, not copied.
- The board stores nothing itself. Every action is a live call to WorkFlowy.
- Notes saved from the pad go inside the **WB-Notes** bullet on today's page. Since the board only reads the top level of each day, nothing inside WB-Notes appears on the board, including `[ ]` todos typed in the pad. Add tasks that should show on the board with the **+ Add task** box in a day's column.
- Changes you make in WorkFlowy appear on the board when you reload (↻), change weeks, or toggle an option. There's no live sync.

## Troubleshooting

**`'WORKFLOWY_API_KEY' is not recognized as an internal or external command`**
You're on Windows and used the Mac/Linux form. Use `set WORKFLOWY_API_KEY=...` on its own line first (see Installation).

**`upstream failed: fetch failed (ENOTFOUND / ETIMEDOUT / ECONNREFUSED)`**
Node can't reach WorkFlowy. Check your internet, VPN, firewall, or antivirus. Node's built-in fetch ignores system proxy settings, which matters on some work networks.

**`... (UNABLE_TO_GET_ISSUER_CERT_LOCALLY)`**
Your antivirus or company network inspects HTTPS, and Node doesn't trust its certificate. Either:
- On a recent Node (22.15+ or 23.8+), make Node use the system certificate store: `set NODE_USE_SYSTEM_CA=1` (PowerShell: `$env:NODE_USE_SYSTEM_CA="1"`), or
- Point Node at the certificate: `set NODE_EXTRA_CA_CERTS=C:\path\to\root-cert.cer`.

Avoid `NODE_TLS_REJECT_UNAUTHORIZED=0`. It turns off certificate checking, so your key would go over an unverified connection.

**401 or 403 errors**
The API key is wrong or missing. Generate a fresh one at <https://workflowy.com/api-key>.

**Other errors**
If the base address is the problem, try `WORKFLOWY_BASE_URL=https://beta.workflowy.com/api/v1`. A red banner at the top of the board shows the request and status that failed.

**Past due "All" is slow or errors**
"All" checks up to 60 months back, one request per month and then one per day in months that exist. This can mean hundreds of requests on the first load. Past due days are remembered afterwards (↻ re-reads them). If you hit rate-limit errors, use 4w instead.

## Customizing

Edit the constants near the top of the `<script>` in `index.html`:

| Constant | Default | Meaning |
|----------|---------|---------|
| `LOOKAHEAD` | `14` | Days shown in Upcoming. |
| `MAX_MONTHS_BACK` | `60` | How far "All" looks back, in months. |
| `MAX_PARALLEL` | `6` | Simultaneous requests sent to WorkFlowy. |

Other easy changes:
- **Week starts on Sunday:** edit the `startOfWeek` function (and the day order in `renderCal`).
- **New tasks at the top of a day:** in the add-task handler, change `position: "bottom"` to `"top"`.

## Security

- The server listens on **localhost only** and only forwards the node endpoints the board needs (the full-export endpoint is blocked).
- Your API key can read and change your whole outline. Keep it out of the browser, git repositories, and screenshots.
- **Don't put this on a public address as-is.** There's no login, so anyone who could reach it could read, edit, and delete your outline. Before hosting on a VPS or Fly.io, add password protection and HTTPS, and set the key through the host's secret storage.

## Known limitations

- No live sync with WorkFlowy (reload to pick up outside changes).
- Dragging between days uses mouse events and doesn't work by touch.
- Editing a task shows it as plain text, so bold, links, and other formatting are lost if you save an edit.
- Reordering tasks within a day isn't supported, only moving between days.
- The Today's page view can complete todos, edit text, add lines under a bullet, and indent a line (**>**). It can't outdent, reorder, or delete lines, because the API can only place a moved or new line at the top or bottom of a parent, not right after a specific line. New lines (from the pad or the **+** button) always go to the bottom of their parent.
- Dots on the calendar only appear for days already loaded.
- Settings are stored in the browser (`localStorage`), so they're per browser.
- The board relies on WorkFlowy's calendar nodes and the API as documented at <https://beta.workflowy.com/api-reference/>. It was tested against a mock of that API, so report anything that behaves differently on a real account.
