# Workflowy Week Board

A kanban-style week view for your WorkFlowy todos. Each day is a column, and everything you do on the board (add, check off, edit, move, delete) is saved straight back to WorkFlowy through its API.

<img width="1750" height="918" alt="Workflowy Week Board" src="https://github.com/user-attachments/assets/44ea2b16-ffdd-4d0f-b279-2f1305ac4577" />

**Version 1.0.8**

## What's in the box

| File | What it does |
|------|--------------|
| `server.js` | A tiny Node server. It holds your API key, forwards requests to WorkFlowy, and serves the page. Your key never reaches the browser. |
| `index.html` | The board itself (a single page, no build step, no dependencies). |
| `Dockerfile`, `fly.toml`, `.dockerignore` | Only for Option 3 (Fly.io). |
| `deploy/weekboard.service`, `deploy/weekboard.env.example`, `deploy/Caddyfile` | Only for Option 2 (your own server). |

## Requirements

- **Node.js 18 or newer** (uses the built-in `fetch`). Check with `node --version`.
- A **WorkFlowy API key** from <https://workflowy.com/api-key>.
- A modern browser.

No `npm install` is needed.

## Choose how to run it (required)

The server will not start until you choose, by setting `DEPLOY_MODE` to one of three values. There is no default, because the choice decides who can reach your outline.

| `DEPLOY_MODE` | Where it runs | Who can reach it | Login | HTTPS |
|---------------|---------------|------------------|-------|-------|
| `local` | Your own computer | Only that computer (`http://localhost`) | None | Not needed |
| `vps` | Your own server (a VPS) behind Caddy | Anyone who can open your address, after signing in | Password | Caddy, automatic |
| `fly` | Fly.io | Anyone who can open your address, after signing in | Password | Fly, automatic |

- Pick **local** to use it on one computer. Nothing else on your network can connect.
- Pick **vps** or **fly** to use it from several devices. Your whole outline is then behind a login on the internet, so follow the steps for that option closely.
- `vps` and `fly` refuse to start without `BOARD_PASSWORD` (at least 12 characters) and `PUBLIC_URL` (the `https://` address you will visit).
- Start it without `DEPLOY_MODE` and the server prints these three choices and exits.

What the hosted modes (`vps` and `fly`) add:
- A sign-in page in front of everything. A wrong password is slowed down, and 5 wrong tries from one address lock that address out for 15 minutes.
- A sign-in cookie that only works over HTTPS, can't be read by scripts, and isn't sent from other websites. Sessions last 7 days (`SESSION_DAYS`) and end at **Sign out** (bottom right of the sidebar) or when the server restarts.
- Plain `http://` requests are redirected to `https://`, and only your own address is accepted.
- Changes (adding, editing, deleting) are only accepted from the board's own page, so another website can't make them for you.

All modes also check the address in the browser's request, which blocks "DNS rebinding" tricks, and send security headers.

## Option 1: Localhost (`DEPLOY_MODE=local`)

1. Put `server.js` and `index.html` in the same folder.
2. Get your API key from <https://workflowy.com/api-key>.
3. Open a terminal in that folder and start the server with your key.

**Windows, Command Prompt:**
```
set DEPLOY_MODE=local
set WORKFLOWY_API_KEY=your_key_here
node server.js
```
Don't put quotes around the key or spaces around the `=`.

**Windows, PowerShell:**
```
$env:DEPLOY_MODE="local"
$env:WORKFLOWY_API_KEY="your_key_here"
node server.js
```

**Mac or Linux:**
```
DEPLOY_MODE=local WORKFLOWY_API_KEY=your_key_here node server.js
```

4. Open <http://localhost:3000> in your browser.

On Windows the settings only last for that terminal window, so set them again each time you open a new one.

### Windows: use the Windows certificates (if needed)

If you're on Windows and see a certificate error such as `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, your antivirus or company network is inspecting HTTPS traffic. Tell Node to use the Windows certificate store by setting `NODE_USE_SYSTEM_CA=1` **before** starting the server. This needs Node 22.15+ or 23.8+; check with `node --version`.

**Command Prompt:**
```
set NODE_USE_SYSTEM_CA=1
set DEPLOY_MODE=local
set WORKFLOWY_API_KEY=your_key_here
node server.js
```

**PowerShell:**
```
$env:NODE_USE_SYSTEM_CA="1"
$env:DEPLOY_MODE="local"
$env:WORKFLOWY_API_KEY="your_key_here"
node server.js
```

Like the API key, this only lasts for that terminal window. If you'd like it to stick, set it as a permanent user environment variable instead (`setx NODE_USE_SYSTEM_CA 1`, then open a new terminal).

## Option 2: Your own server (`DEPLOY_MODE=vps`)

The board runs as a service on a Linux VPS (these steps assume Ubuntu or Debian). The app only listens on that machine, and Caddy sits in front of it, handles HTTPS, and passes requests through.

**You need:** a VPS you control, a domain or subdomain (for example `board.example.com`), and root (`sudo`) access.

1. **Point your domain at the server.** Create a DNS `A` record for the name pointing at the server's IP address.
2. **Lock down the server.** Use SSH keys only, and open just the ports you need:
   ```
   sudo ufw allow OpenSSH
   sudo ufw allow 80
   sudo ufw allow 443
   sudo ufw enable
   ```
   Don't open port 3000. The app is only reachable through Caddy.
3. **Install Node.js 22 and Caddy.** See <https://nodejs.org/en/download> and <https://caddyserver.com/docs/install>. Check with `node --version` and `which node` (the service file expects `/usr/bin/node`).
4. **Create a user and put the files in place:**
   ```
   sudo useradd --system --home /opt/weekboard --shell /usr/sbin/nologin weekboard
   sudo mkdir -p /opt/weekboard
   sudo cp server.js index.html /opt/weekboard/
   ```
5. **Store the secrets** outside the project folder, readable only by root. Make a password first with `openssl rand -base64 24` and save it in your password manager.
   ```
   sudo cp deploy/weekboard.env.example /etc/weekboard.env
   sudo chown root:root /etc/weekboard.env
   sudo chmod 600 /etc/weekboard.env
   sudo nano /etc/weekboard.env
   ```
   Fill in `WORKFLOWY_API_KEY`, `BOARD_PASSWORD` and `PUBLIC_URL` (for example `https://board.example.com`). `DEPLOY_MODE=vps` is already in the file.
6. **Start the service:**
   ```
   sudo cp deploy/weekboard.service /etc/systemd/system/weekboard.service
   sudo systemctl daemon-reload
   sudo systemctl enable --now weekboard
   sudo journalctl -u weekboard -f
   ```
   The log should say `running at https://board.example.com (mode: vps, listening on 127.0.0.1:3000 ...)`. If it exits, the message says what's missing.
7. **Set up HTTPS.** Edit `deploy/Caddyfile` so the first line is your domain (it must match `PUBLIC_URL`), then:
   ```
   sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
   sudo systemctl reload caddy
   ```
   Caddy gets and renews the certificate by itself.
8. Open your `https://` address and sign in with `BOARD_PASSWORD`.

**Check it's closed properly:** `sudo ss -ltnp | grep 3000` should show `127.0.0.1:3000` and not `0.0.0.0:3000`. From another computer, `http://YOUR_SERVER_IP:3000` should not connect.

**Updating:** copy the new `server.js` and `index.html` into `/opt/weekboard/`, then `sudo systemctl restart weekboard`.
**Changing a secret:** edit `/etc/weekboard.env`, then `sudo systemctl restart weekboard`. If your WorkFlowy key may have leaked, create a new one at <https://workflowy.com/api-key> and put that in.

## Option 3: Fly.io (`DEPLOY_MODE=fly`)

Fly builds a small container from the `Dockerfile` and runs it with HTTPS and a `*.fly.dev` address.

**You need:** a Fly.io account and the `flyctl` command (<https://fly.io/docs/flyctl/install/>).

1. **Put these files in one folder:** `server.js`, `index.html`, `Dockerfile`, `.dockerignore`, `fly.toml`.
2. **Sign in:** `fly auth login`
3. **Edit `fly.toml`.** Change `app` to a unique name (for example `my-weekboard`), and change `PUBLIC_URL` to `https://my-weekboard.fly.dev` (the same name). Optionally change `primary_region`.
4. **Create the app (without deploying yet):**
   ```
   fly launch --no-deploy --copy-config --name my-weekboard
   ```
   If it asks to change settings, say no. Your `fly.toml` is already set up.
5. **Set the secrets.** Make a password with `openssl rand -base64 24` and save it in your password manager, then:
   ```
   fly secrets set WORKFLOWY_API_KEY=your_key_here BOARD_PASSWORD=your_password_here
   ```
   Secrets are stored encrypted by Fly and are never written into `fly.toml` or the image.
6. **Deploy, and keep it to one machine:**
   ```
   fly deploy
   fly scale count 1
   ```
7. Open `https://my-weekboard.fly.dev` (or `fly open`) and sign in. Watch the log with `fly logs`.

**Why one machine:** sign-in sessions and the search copy live in that machine's memory, so a second machine would sign you out at random. `fly.toml` also keeps the machine always on, so the sessions aren't lost when it would otherwise stop for being idle.
**Memory:** `fly.toml` asks for 512 MB because your outline is held in memory while search is in use. Raise it with `fly scale memory 1024` if search fails on a very large outline.
**Your own domain:** `fly certs add board.example.com`, point DNS where it says, then change `PUBLIC_URL` in `fly.toml` and run `fly deploy`.
**Updating:** replace `server.js` and `index.html`, then `fly deploy`.
**Changing a secret:** run `fly secrets set ...` again. The app restarts.
**Never commit** secrets or put them in `fly.toml`.

## Configuration

All settings are environment variables, set the same way as the key above.

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `DEPLOY_MODE` | **Yes** | none | `local`, `vps` or `fly`. See "Choose how to run it". The server won't start without it. |
| `WORKFLOWY_API_KEY` | Yes | none | Your WorkFlowy API key. |
| `BOARD_PASSWORD` | `vps` and `fly` | none | The sign-in password, at least 12 characters. Not used in `local`. |
| `PUBLIC_URL` | `vps` and `fly` | none | The `https://` address you visit, for example `https://board.example.com`. Only requests for this address are accepted. |
| `SESSION_DAYS` | No | `7` | How many days a sign-in lasts. |
| `HOST` | No | `127.0.0.1` (`fly`: `0.0.0.0`) | Address to listen on. Rarely needed. `local` only allows `127.0.0.1`. |
| `WORKFLOWY_BASE_URL` | No | `https://workflowy.com/api/v1` | API address. If you get errors, try `https://beta.workflowy.com/api/v1` (WorkFlowy's reference docs use that address). |
| `PORT` | No | `3000` | Port to serve the board on (`fly.toml` sets 8080). |
| `NOTES_NAME` | No | `WB-Notes` | Default name of the notes bullet on each day's page. Each browser can override it from the ⋯ menu in the Daily page header (see below). |
| `UPDATE_CHECK` | No | on | Set to `0` to stop the board checking GitHub for a newer version. |
| `UPDATE_URL` | No | this project's `server.js` on GitHub (`main` branch) | Raw address of a `server.js` to compare versions against (useful for a fork). |
| `IDLE_PURGE_MINUTES` | No | `10` | Minutes without a search before the server clears its copy of your outline from memory. `0` turns the purge off. |
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
- Click ✕ to delete (permanent, with a confirmation). If the task has sub-items, the confirmation says how many, because they are deleted too.
- Drag a task onto another day's column to move it (mouse only; this doesn't work by touch). Its sub-items move with it.
- **Sub-items:** a task that has lines underneath it shows a small **▸ 3 sub-items** button. Click it to open a checklist right on the card, nested as deep as the items go. Tick a sub-item to complete it. The checklist is for reading and ticking; add, edit, or delete sub-items in WorkFlowy, or in the search item editor.
- **Move to a date:** hover a task and click the calendar icon for a small menu: Today, Tomorrow, next Monday, or any date (type it or use the date picker). Cancel, Esc, or a click elsewhere closes it. The task moves to the bottom of that day's page, even a day outside the days shown. (Dragging a card onto a day column still works for days on the board.) In Group mode, the calendar icon on a group moves the whole bullet with all its tasks.
- The day header and add box stay in place while the task list scrolls.

**⚙ Settings** (the button in the header, next to the 3/5/7 buttons; it opens a small menu that stays open while you tick things and closes when you click elsewhere or press Esc. All choices are remembered in your browser.)
- **Hide completed:** hides checked-off tasks.
- **Past due:** adds a panel of open tasks from *before* the days on screen. Choose how far back with **Past due range** just below it in Settings: 1, 2, 3 or 4 weeks, or All (default 2 weeks). The panel's title shows the range, for example **Past due (2 weeks)**, and a small **→ Today** button next to the count opens a preview to move the open ones to today.
- **Upcoming:** adds a panel of tasks in the 14 days *after* the days on screen. Both panels have a **▾ 3 open** button next to the title: click it to fold the panel up to just its header (it becomes **▸ 3 open**), and click again to open it. Whether each is folded is remembered in your browser.
- **Nested:** `Off`, `Group` or `Flatten`. It decides what the board does with a plain bullet that has tasks indented under it (for example a "Project Alpha" bullet with three todos beneath it). **Off** is the default and ignores such bullets, as earlier versions did. The choice is remembered in your browser.
  - **Group:** the bullet becomes one card with a ▾ arrow, its name, and a pill such as "2 of 3 open". Its tasks are a checklist inside the card, and you can tick them in place. The arrow hides or shows the checklist. Drag the card to move the bullet, and everything under it, to another day. The calendar icon on the card header does the same. Group cards are for ticking only; edit or delete the bullet and its tasks in WorkFlowy or from Daily page / search.
  - **Flatten:** each indented task becomes its own card in the day's column, with the bullet's name in small grey type above it (for example "Project Alpha ›"). These cards can be ticked, edited and deleted like any other. They can't be dragged to another day, because that would pull them out of their bullet, but the calendar icon moves one to a date of your choice (and takes it out of its bullet).
  - Both modes keep the outline's order, count nested open tasks in each day's "N open", and work in the Past due and Upcoming panels too. **Hide completed** hides ticked nested tasks (and hides a group with nothing left open).
  - Only **one level down** is read: tasks directly under a plain bullet or heading that sits directly under a day. The notes bullet (WB-Notes) is skipped on purpose, so todos typed in the notes box stay off the board.
  - **Cost:** the board makes one small request per plain bullet to find its tasks. They load in the background, are remembered until you press ↻, and the board redraws a moment later (never while you're typing in a box). With Past due on, and especially with "All", a long history means more requests. Leave Nested on Off if you don't use indented tasks.
- **Plan day limit:** how many open tasks fill the meter in Plan day (default 8). `0` turns the meter off.
- **Sub-items:** shows the sub-item button on tasks (on by default). The counts are loaded in the background with one small request per visible task, remembered until you press ↻, and cards in Past due and Upcoming get them too. If you have a lot of open tasks and want fewer requests to WorkFlowy, turn this off. Which cards you've opened is remembered in your browser. With Hide completed on, completed sub-items are left out of the checklist (the count still includes them).

Both panels are relative to the view. If you're looking at last week, Past due shows what was open before that week, and Upcoming shows the 14 days after it, including this week.

**Sidebar (far right)**
- **Calendar:** click a day to jump the board to that week. Today is outlined, the days on screen are shaded, and a dot marks days with open tasks (only for days the board has already loaded).
- **Past due / Upcoming** panels appear under the calendar when switched on.
- **Daily page:** shows the notes on today's WorkFlowy daily page, nested like the outline (up to 12 levels; the pane scrolls when it's long). Tasks are left out: any todo sitting directly on the page appears on the board, not here. (A todo nested deeper, such as inside WB-Notes, still shows with a checkbox, since the board doesn't display those.) Click a line's text to edit it in place (see below). It reloads when you open the board, after you save from the pad, and with its own ↻ button.
  - The **⤢** button in the pane's header expands it to fill the whole sidebar (the calendar and Past due / Upcoming panels are hidden, and the notes box stays underneath). Click **⤡** to go back to the calendar view. The pane starts **expanded** the first time; after that your choice is remembered in the browser.
  - The sidebar always fits the window. The calendar and the Past due / Upcoming panels keep their size, the Daily page takes the room that's left, and it scrolls inside itself (so the sidebar doesn't scroll as a whole, except on a very small window).
  - **Back and forward:** the **‹** and **›** arrows beside the title step the pane to the previous or next day's page, and the date next to the heading changes. The header stays on one line. When you're away from today the date turns into a link: click it to jump back to today. Everything in the pane works on any day (edit, add, indent, delete, expand and collapse). The notes box underneath is part of the same panel and follows the day shown, so stepping back a day and saving notes writes to that day's WB-Notes bullet (see below).
  - **Expand and collapse:** a line that has lines underneath shows **▾** (open) or **▸** (collapsed) at its left. Click it to hide or show those lines. A collapsed line shows how many lines are hidden, for example `(3)`. The same arrows work in the item editor in the search window. Clicking **+** on a collapsed line opens it, and so does indenting a line under it. **This is only remembered in your browser:** WorkFlowy's API can't read or change which bullets are expanded, so collapsing here doesn't collapse anything in WorkFlowy, and the reverse.
  - **Editing a line in place:** click a line's text and it turns into a box right where it is, with the text selected. **Enter** saves, **Esc** cancels, and clicking away saves. A second box underneath holds the line's **note** (the smaller grey text WorkFlowy can show under a bullet). **Shift+Enter** starts a new line in the note, and saving an empty note removes it. A line that has a note shows its first line in small grey type under the title. Only what you changed is saved, and an empty title is ignored.
  - **Formatting survives.** WorkFlowy stores bold, italics and links as markup inside the text. The box shows only the words, and on saving, only the words you changed are replaced, so formatting around them stays. Words typed right after a bold word become bold, like in a normal editor. If a line's formatting can't be matched safely, the line is saved as plain text rather than risk garbling it.
  - Hover a line and click **>** to indent it: it becomes the last child of the line above it and takes its own sub-bullets along. The first line in a group has no **>**, since there's nothing above it to indent under.
  - Hover a line and click **−** to delete it. It asks first, and anything under the line is deleted too (the confirmation says how many lines). The **−** is never offered on the notes bullet (WB-Notes) itself. Inside WB-Notes it only appears on lines that have nothing underneath, so a note with sub-bullets can't be removed in one click (delete its sub-bullets first). Deleting is permanent.
  - Hover a line and click **+** to add a new line under it (as its last child). The box stays open so you can add several in a row; press Enter to add and Esc to close.
- **Add to WB-Notes:** the notes box at the bottom of the Daily page panel (one panel, one header). A bar above the box says where Save will write, for example **Add to WB-Notes · today**; click the bar to fold the box away (**▸**, with a small **draft** badge if it has unsaved text) or open it again (**▾**). Whether it's open is remembered. Everything you save goes into a single bullet on **the day the Daily page is showing** (named **WB-Notes** by default), so your notes stay together. When that day isn't today, the bar turns blue and names the date, so you don't write to the wrong day by accident.
  - The board finds the WB-Notes bullet by name each day and creates it (at the bottom of the page) if it isn't there yet, so saving again and again just keeps adding to it.
  - One bullet per line. Tab indents and Shift+Tab outdents. Enter continues the bullet, and Enter on an empty bullet outdents, then removes it.
  - Press **Ctrl+Enter** or click **Save to WB-Notes**. Nested bullets are saved as child nodes, and the box clears when done.
  - Your draft is kept in the browser until saved. If a save fails partway, only the unsaved lines remain.
  - **Move notes in** (in the **⋯** menu at the right of the panel's header) gathers the shown day's plain top-level bullets (with their sub-bullets) into WB-Notes, in their current order. It asks first, shows what will move, and leaves todos, headings, and the WB-Notes bullet alone. Items are moved, not copied.
  - **Changing the name:** choose **Rename the notes bullet…** in the **⋯** menu and type a new name. It's saved in your browser and overrides the server's `NOTES_NAME` default. Typing the default name again clears the override. Names must not be empty, and matching ignores capitals and stray spaces (`wb-notes` finds `WB-Notes`).
  - When you change the name, the board offers to rename today's existing bullet too (OK renames it; Cancel leaves it, and the next save starts a separate bullet with the new name). If today already has a bullet with the new name, the board just uses that one and doesn't rename anything.
  - Only today's bullet is renamed. Older days keep their old name, since each day has its own notes bullet. Avoid markdown symbols such as `*` or `[` in the name, because WorkFlowy converts them.
  - If you rename the bullet directly in WorkFlowy, the board won't recognize it until you change the name here to match.

**Planning, moving and undoing** (**Plan day** is in the bar along the bottom, on the left, with the version number on the right. **Selector** and **Reports** are on the bottom row of the Daily page panel: at the right of **Save to WB-Notes**, or at the left when the notes box is folded away)

- **Undo.** Moving a task, ticking or unticking it, deleting it, adding one, and every bulk action show a bar at the bottom with an **Undo** button (it stays for 10 seconds). **Ctrl+Z** (or **Cmd+Z**) undoes the latest one when you aren't typing in a box, and each press goes one step further back (up to 20). What Undo can and can't restore:
  - A moved task goes back to the **bottom** of the day it came from, because WorkFlowy's API can only place things at the top or bottom of a day, so its old position in that day isn't restored.
  - A deleted task comes back with its note, its completed state and everything under it (up to about 300 lines, 12 levels deep), but as a **new copy** with new ids, again at the bottom of its day. Anything that pointed at the old one (links, mirrors) is not restored.
  - Not covered: deletes in the Daily page and item editor (their − buttons ask first and are permanent), tick boxes on group cards and sub-item checklists, and edits to text.
- **Selector (☑ Selector, next to the Save to WB-Notes button).** Click cards to pick several (they get a blue outline; clicking doesn't tick or edit them). A bar appears at the bottom: **Select all open**, **Move to…** (Today, Tomorrow, next Monday, or any date), **Complete**, **Delete** (asks first), and **Done selecting** (or press Esc). Group cards aren't selectable. Everything done from the bar can be undone in one step.
- **Move open tasks forward.** The **→ Today** button in the Past due panel opens a preview of those tasks. Untick any you want to leave, pick the date (it starts on today), and press **Move**. Plan day uses the same preview for **Send the rest to tomorrow…** and **Add all…**. It moves tasks that sit directly under a day. Tasks inside plain bullets (the Nested setting) stay where they are, so nothing leaves its bullet by surprise.
- **Date words in the Add task box.** End the text with a day and the task goes to that day instead of the column you typed in, for example `Call dentist fri`, `Pay rent in 3 days`, `Report 11/5`, `Party Nov 5th`, `Plan next week`. A grey hint under the box shows where it will go. It understands: `today`, `tomorrow` (`tmrw`), weekday names (`fri` is the next Friday coming up, `next fri` is the Friday of next week), `next week` (Monday), `in N days/weeks`, `M/D` and `M/D/YY`, and `Nov 5` / `5 Nov` (the next time that date comes round, or add a year). A trailing `on`, `by` or `due` is dropped (`Call mom on fri`). Text that's only a date word stays a normal task. **Shift+Enter** adds the text exactly as typed.
- **Plan day (📅 Plan day in the bottom bar).** Replaces the columns with one day in focus, today to start with. Left: that day's tasks as normal cards (tick, edit, move, delete, select), a count of open and done tasks, a meter against your **Plan day limit** (amber at the limit, red above it), **Send the rest to tomorrow…**, and an Add task box. Right: **Bring in**, listing your past-due open tasks (as far back as the Past due range, at most 4 weeks) and the next three days' open tasks, each with a **+ Add** button that moves it to the day you're planning, and **Add all…** for the past-due list. Use ‹ › to plan another day. Click Plan day again to go back to the columns. Day pages that aren't loaded yet are fetched when you open it, so the first time takes a moment.
- **Reports ▸ Completed tasks (the Reports button, next to Selector).** Reports opens a small menu, and Completed tasks lists the tasks you finished, grouped by the **day you completed them** (not the day they sit on), newest first, with the time and where they live in your outline. Choose Today, Yesterday, This week, Last week, Last 7 days or Last 30 days. **Copy as text** puts a plain list on your clipboard for a stand-up or weekly review. It uses the same server copy of your outline as search, so it shows tasks anywhere in your outline, and **Refresh index** downloads a fresh copy (once a minute at most). Shows up to 1000 tasks.

**Search (🔍 Search nodes button in the header, or Ctrl+K)**
- Opens a search window over your **whole outline**. The search runs in `server.js`, not in the browser. The first time, the server downloads your outline through WorkFlowy's export (this can take a few seconds on a big outline) and keeps that one copy in its memory. Your browser only ever receives the 50 matches it asks for, and the item you open, never the whole outline.
- Every word you type must match, in any order. Put an exact phrase in "quotes", and put `-` in front of a word or phrase to leave matches out (for example `meeting -"weekly sync"`). Matches in the item's text are listed first, then the most recently changed.
- Results show 50 at a time, each with its path (the lines above it) and the match highlighted. Click **Show 50 more** at the bottom of the list to see the rest.
- **Filters:** *Include completed*, *Todos only*, and *Search notes* (the text under an item). They're remembered in your browser.
- Use the arrow keys and Enter, or click a result, to open it. Esc closes the window.
- The item opens in an **editor over the list**, inside the search window, so the Daily page in the sidebar stays as it was. Edit it like the Daily page: click the text to edit it in place (title and note), tick todos, **+** to add a child, **>** to indent, and **−** to delete a line. In this editor **−** only appears on lines with nothing underneath (so you delete a branch from its tips inward), and never on the opened item itself. Click **← Results** (or press Esc) to go back to the list with your search still in place. **Open in WorkFlowy ↗** jumps to the item in WorkFlowy, and **↻** in the editor's header downloads a fresh copy.
- The window's **Refresh index** button (and the **↻** in the item editor) downloads a fresh copy. WorkFlowy allows the export once a minute, so the server declines refreshes sooner than a minute apart (you'll see a note). The server also re-downloads on its own when the copy is more than 5 minutes old and you search.
- **Idle purge:** after 10 minutes without a search, the server throws its copy away, so nothing sits in memory while you aren't using search. The next search downloads it again (a few seconds). Change the time with `IDLE_PURGE_MINUTES` (`0` keeps it until the server stops).
- Edits made through the board or the item editor are applied to the server's copy as they happen, so they're searchable straight away.

**Update notice**
- The version label at the bottom right of the sidebar shows **⬆ vX.Y.Z available** (a link to the GitHub page) when GitHub has a newer version than the one you're running. To update, download the new `server.js` and `index.html`, replace yours, and restart.
- The server makes the check (at most once every 6 hours, only reading the version number) and stays quiet if it's offline. Turn it off with `UPDATE_CHECK=0`.

## How it maps to WorkFlowy

- Each column is a day in your WorkFlowy **calendar** (for example `2026-10-23`). Tasks are that day's children.
- By default the board shows **todo items only**, directly under a day. Plain bullets, headers, quotes, and code blocks under a day are skipped, and so are todos nested under them (turn on **Nested** to show those under plain bullets and headings). A task's own sub-items are shown through its sub-items button.
- Tasks added on the board are created as todos under that day. Moving a task changes its parent, so it's moved, not copied.
- The board stores nothing itself. Every action is a live call to WorkFlowy.
- Notes saved from the notes box go inside the **WB-Notes** bullet on the day the Daily page is showing (today unless you stepped back). Since the board only reads the top level of each day, nothing inside WB-Notes appears on the board, including `[ ]` todos typed in the pad. Add tasks that should show on the board with the **+ Add task** box in a day's column.
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

**The server exits right away saying to choose where you are running it**
Set `DEPLOY_MODE` to `local`, `vps` or `fly` (see "Choose how to run it"). On Windows set it on its own line first, like the API key.

**`vps` or `fly` exits asking for `BOARD_PASSWORD` or `PUBLIC_URL`**
Both are required in the hosted modes. The password needs at least 12 characters, and `PUBLIC_URL` must start with `https://`.

**"Use https://..." or a redirect loop on a hosted mode**
The address you typed doesn't match `PUBLIC_URL`, or the proxy isn't passing the original address along. On a VPS check that the Caddyfile name matches `PUBLIC_URL` and that the file uses `reverse_proxy` as in `deploy/Caddyfile`.

**"Too many attempts"**
Five wrong passwords lock that address out for 15 minutes. Restarting the server also clears the lockout.

**Signed out on its own**
Sessions last 7 days and are cleared when the server restarts or redeploys. On Fly, make sure there is only one machine (`fly scale count 1`).

**401 or 403 errors**
The API key is wrong or missing. Generate a fresh one at <https://workflowy.com/api-key>.

**Other errors**
If the base address is the problem, try `WORKFLOWY_BASE_URL=https://beta.workflowy.com/api/v1`. A red banner at the top of the board shows the request and status that failed.

**Past due "All" is slow or errors**
"All" checks up to 60 months back, one request per month and then one per day in months that exist. This can mean hundreds of requests on the first load. Past due days are remembered afterwards (↻ re-reads them). If you hit rate-limit errors, use 4w instead.

**Search says it couldn't load your outline, or refresh does nothing**
The export is limited to one request a minute. Wait a minute and try again. If the error mentions 429 and the server already has a copy, it keeps using that copy.

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

- **Choice of mode.** `local` listens on `127.0.0.1` only. `vps` and `fly` are reachable from the internet and are protected by the password login, HTTPS-only cookies, the address check and the cross-site write check described under "Choose how to run it".
- Your API key can read and change your whole outline. The browser never sees it. Keep it out of git repositories, screenshots and shared folders. On a VPS keep it in `/etc/weekboard.env` (root only, `chmod 600`). On Fly use `fly secrets`.
- **What the server will pass on to WorkFlowy (1.0.8).** Only `GET`, `POST` and `DELETE` on the node endpoints the board uses, with plain ids (letters, digits, `-` and `_`; no slashes, dots or escaped characters). Anything else is refused. Request bodies are capped at 1 MB, and a request to WorkFlowy is dropped after 30 seconds (the full export gets 2 minutes), so one stuck request can't tie the server up.
- **Scripts need a one-time token (1.0.8).** The page's content-security policy no longer allows inline script in general. The server stamps each page load with a fresh random token and the browser only runs scripts that carry it, so script injected through some future bug would be refused.
- **Signing out wipes this browser's copy (1.0.8).** In hosted modes, **Sign out** also clears your unsent Add to WB-Notes draft, the notes bullet name and every saved setting from the browser, so nothing is left behind on a shared computer. (You'll set your options again next time.) If your session simply expires, the draft is kept so you don't lose it.
- Search and the Done window both read the server's in-memory copy of your outline, so the same rules apply (idle purge, login in hosted modes). The Done window only receives the completed tasks in the range you pick.
- The browser can't reach WorkFlowy's full export. Only the server uses it, to build the search copy.
- **Use a long, unique password** (`openssl rand -base64 24`). It is the only thing between the internet and your outline. There's no second step such as a one-time code, and the lockout is per address, so a very large distributed guessing attack is only limited by the password's strength.
- **Your outline sits in the host's memory while search is in use,** unencrypted, and is cleared after 10 idle minutes (`IDLE_PURGE_MINUTES`). Use a host you trust. For `fly`, Fly staff and their infrastructure can in principle access a running machine.
- It's a single-user app (one WorkFlowy key, one password). Don't share the password.
- Sessions are kept in memory, so restarting the server signs everyone out. Run one instance only.
- Keep the server patched (`sudo apt update && sudo apt upgrade`, or let unattended upgrades do it) and update Node.js and the board when new versions come out. On Fly, redeploy now and then to pick up a newer Node image.
- If you'd rather not expose it publicly at all, run `vps` on a machine reachable only over a private network such as Tailscale, and keep the password on top.

## Known limitations

- No live sync with WorkFlowy (reload to pick up outside changes).
- Dragging between days uses mouse events and doesn't work by touch.
- Editing a task **on the board** (double-click, in a dialog) shows it as plain text, so bold, links, and other formatting are lost if you save an edit. Editing in Daily page or the item editor keeps formatting (see "Editing a line in place").
- Reordering tasks within a day isn't supported, only moving between days.
- The Daily page pane can complete todos, edit text, add lines under a bullet, and indent a line (**>**). It can't outdent or reorder lines, because the API can only place a moved or new line at the top or bottom of a parent, not right after a specific line. It can delete lines (**−**), except the notes bullet itself, and inside it only lines with nothing underneath. The item editor in search can delete only lines with nothing underneath, and never the opened item. New lines (from the pad or the **+** button) always go to the bottom of their parent.
- Dots on the calendar only appear for days already loaded.
- Search works on the server's copy of your outline. Changes made in WorkFlowy itself appear after a refresh (Refresh index) or once the copy is more than 5 minutes old. Edits made through the board are applied to the copy, but a new task added to a day may show with no path (calendar pages) until the next refresh.
- The whole outline is held in the server's memory while search is in use. That's fine for tens of thousands of items but heavy for very large outlines. It isn't encrypted, so the protection is the idle purge, the login (hosted modes) or localhost-only access (`local`), and your own disk and account security.
- Calendar day pages (such as 2026-10-23) can show up in results with their date as the path.
- Dragging a card to another day is remembered by Undo too, but touch screens still can't drag: use the calendar icon or Selector there.
- Settings, and which lines you've collapsed, are stored in the browser (`localStorage`), so they're per browser.
- The board relies on WorkFlowy's calendar nodes and the API as documented at <https://beta.workflowy.com/api-reference/>. It was tested against a mock of that API, so report anything that behaves differently on a real account.
