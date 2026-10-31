# Workflowy Week Board

A kanban-style week view for your WorkFlowy todos. Each day is a column, and everything you do on the board (add, check off, edit, move, delete) is saved straight back to WorkFlowy through its API.

<img width="1750" height="918" alt="Workflowy Week Board" src="https://github.com/user-attachments/assets/44ea2b16-ffdd-4d0f-b279-2f1305ac4577" />

**Version 1.3.3**

### What's new in 1.3.3

- **WorkFlowy shortcuts as pane columns.** In **Settings > Panes > Add a column** you can type a WorkFlowy shortcut name such as `home` or `inbox` instead of a link, or pick one from the new **Use a WorkFlowy shortcut** list. The board looks up the node the shortcut points to and adds it by its real id, so the Outline, Kanban and zoom views all work on it. `server.js` gains two routes for this (`/targets` and `/resolve-target`), so **restart the server** after updating. A shortcut whose node has nothing under it yet can't be resolved; paste its link instead.
- **A top-level "Home" column.** **Settings > Panes > Top level (Home) > Add Home** adds a column holding everything at the very top of your outline. It works like any other column (Cards, Outline, Kanban, zoom, drag and drop, colours); new items you add land at the top level. It has no *Open in the item window* entry, because the top of the outline isn't a node. `server.js` treats the top level as the API's `None`, so **restart the server** after updating.
- **Lines grouped under H1 headings (Outline view).** In Home's Outline, each H1 heading shows the lines that follow it, up to the next H1, indented beneath it. The groups start open; close one with its ▾, or use Expand all / Collapse all (which also act on the groups). This is display only: nothing is moved in WorkFlowy. It is on by default for Home; the column's **⋯** menu has **Group lines under H1 headings** to turn it off (or on for another column). Lines drawn under a heading can't be outdented, and a line can only be indented under another line in the same group. Only H1 groups for now.

### What's new in 1.3.2

1.3.2 adds the Panes view on the desktop. `server.js` has a new `/colors` route (for card colours), so **restart the server** after updating.

- **Panes view (desktop).** The **Panes** button (the folded-sheet icon) next to **Plan day** (or the **B** key) switches the page to a Kanban-style view where each node you choose is a column. Choose them in **Settings > Panes**: paste a node's WorkFlowy link or id, **or a WorkFlowy shortcut name such as `home` or `inbox`** (or pick one from **Use a WorkFlowy shortcut**; the board turns it into the node's real id), pick one of your Plan day sources, paste a WorkFlowy link that has `?panes=…` to add every node it names, or add a **calendar** column. A column is expanded or collapsed to a narrow strip showing its name and card count (click the ▾ or the strip; **Fold columns / Unfold columns** do every column). Each column's header has a three-icon **view switch** (▦ **Cards**, ☰ **Outline**, ▥ **Kanban**); the **⋯** menu has the rest. **Cards** (the node's children as cards), **Outline** (a WorkFlowy-style tree, folded by default, and **click a line's bullet to zoom into it** (tasks have a ⌖ button on hover): the column then starts at that line, with a path above (Parent › Line: ‹ goes up one level, ⌂ goes straight to the top when you are two or more levels deep, any step goes back to it) that is remembered in this browser; ▾/▸ opens or folds a line, the small **⊞ / ⊟** buttons in the column header (also in the **⋯** menu) expand or collapse the whole column or day, any depth, tasks with check boxes), **Kanban** (the node's children are the *titles*, such as To do / Doing / Done: a drop-down at the top lists them with card counts and shows one title's cards at a time; the choice is remembered, choosing a title reads it again from WorkFlowy (the cards are always live; what is inside a card comes from the server's copy of your outline, which the ↻ in the Panes bar refreshes), and cards that have lines inside show ▸ with a count and open in place, where each line is a smaller card, to any depth. **Drag any card or line**: drop it on another card to make it a child of that card (it goes to the bottom of that card's lines), on a title (every title appears as a drop target while you drag) to make it a card of that title, or on another column. A card can't be dropped inside itself. Hover a card for **+** (add a line inside) and **−** (delete). **Card colours:** hover a card and press ● to give it one of six colours (red, orange, yellow, green, blue, purple) or none; the card gets a stripe and a faint tint. WorkFlowy has no colour for a bullet, so the colours are kept by the server in `card-colors.json` beside `server.js` (set `CARD_COLORS_FILE` to put it elsewhere), and every browser shows the same ones. This needs the 1.3.2 `server.js` (it has the `/colors` route), and a restart), plus Open in the item window, Move left / right and Remove. A **Calendar** column shows WorkFlowy's own calendar days: a strip of 3, 5 or 7 days (choose in the column's **⋯** menu; remembered per column) with a dot on days that have items (‹ › move by that many days, **Today** returns, 📅 opens a date picker to jump), and the chosen day's items below. **Everything edits in place**: click a card or an outline line to edit its text and note where it is (dates and formatting are kept; Enter saves, Esc cancels), use ☐/Bullet/Numbered in the editor to change a line's type, **+** adds a line under a line, **>** and **<** indent and outdent, **−** deletes, and **+ Add a card** at the bottom of a column or a day adds there (the small button beside the box cycles the new line's type: • bullet, ☐ task, 1. numbered; your last choice is remembered). Hover a card and press ⤢ (or Ctrl/Cmd-click) to open it in the item window instead. Drag a card to another column to move it there (to the bottom), or onto a calendar column to move it to the chosen day. **Hide done** hides completed lines; changes are undoable where the Daily page's are. **Drag a column's right edge to change its width** (double-click the edge to reset it). The column list, widths, views, collapsed columns and opened outline lines are saved in this browser. WorkFlowy's API can only place a line at the top or bottom of a level, so new lines go at the end of their level. Esc or **← Week board** returns; Plan day is unchanged.
- **Editing around a date keeps the date whole.** Editing the words before and after a WorkFlowy date (for example "Sun, Oct 25") in a card or line, on the desktop and on the phone page, no longer pulls words inside the date or corrupts it.

### What's new in 1.3.1

- **Encrypted items report.** **Reports > 🔒 Encrypted items** lists every item in your outline whose name or note holds text from the Encryption add-on, grouped by where it sits, with a badge for name, note or both (and how many encrypted values). Encrypted text is shown as 🔒 and the server never sends it, only the lock. Click an item to open it in the item window, **↗** opens it in WorkFlowy, **Refresh index** re-reads your outline (once a minute) and **Copy as text** copies the list. It reads the same outline index as Search, so a very recent change may need a refresh.

### What's new in 1.3.0 (since 1.2.1)

- **A phone page.** Open `/m` on your phone for a version built for small screens, while the desktop board stays exactly as it was. A strip of Mon–Sun chips at the top shows how many tasks are open each day; tap a day to see its tasks full width, or swipe the list left and right to change day. Tick a task to complete it, tap it (or its **⋯**) to edit it, move it to another day, or delete it, and type in the bar at the bottom to add a task to the day. **Show done** reveals finished tasks, the **‹ ›** buttons change week, **⌂** jumps to today. Phones that open the main address are sent to `/m` automatically; **⋯ > Open the desktop page** in the phone page goes the other way for that session (or add `?desktop=1` to the address).
- **Install it like an app.** The board now has a web app manifest and icons, so on Android (Chrome menu > **Install app** / **Add to Home screen**) and iPhone (Safari Share > **Add to Home Screen**) it opens full-screen with its own icon and starts on the phone page. The install option only appears on an `https://` address (Option 3 or a Tailscale address; see "Using it on a phone" below).
- **Groups.** Tasks indented under a plain bullet show as a collapsible group (the bullet's name, an open count and its tasks), each with its own **+ Add task** that adds under that bullet. **⋯ > Settings > Tasks under bullets** chooses Group, Flatten (tasks listed in order, each tagged with its bullet) or Off. The WB-Notes bullet is never treated as a group. Moving a grouped task puts it on the other day's top level. Each group header has its own **⋯** button: **Move group to top** (one request; Undo puts it back), **Move group to today**, and **Move group to another day…**. The group's tasks move with it. Creating or renaming groups stays on the desktop page.
- **Inbox button (desktop).** A **📥 Inbox** button sits just left of **Reports** under the Daily page, with a count of the open items directly in your Inbox. Click it, or press **I** when you're not typing, to open the Inbox in the item window, where you can edit everything in it (any item type); **← Panes** (or Esc) returns. Drag a task or group card onto the button to send it to the end of the Inbox (Undo puts it back). Set it in **Settings > Week board > Inbox** by pasting the node's WorkFlowy link or id, or by picking one of your Plan day sources. It is saved in this browser. Plan day is unchanged.
- **Open a bullet.** Click into any bullet to see and edit what is under it. On the desktop board a group card has an **Open ▸** button that opens the item view (everything under the bullet, any type, editable), and **← Panes** brings you back. On the phone page a **›** on a bullet, heading, group or section (or **› Open** in its **⋯** menu) opens that item as its own page: a **‹ Back** button and a breadcrumb (for example *Inbox › Project X › Sub idea*, tap a part to jump there) at the top, then everything under it, whatever its type. Each line has its own **›** to go one level deeper and its **⋯** menu (Edit, Open, Out one level, Move under…, Move to the Inbox, Change type, Delete). The row at the bottom adds a task, bullet or numbered item under the open item. Plan day is unchanged.
- **Past due and Upcoming.** Two buttons under the day strip show how many open tasks you have in the last 14 days before today and the next 14 days after it (counting tasks under bullets). Tap one to see them by day, oldest first; tap a day heading to jump to that day. In Past due, **Move all N to today…** moves everything shown to the end of today (it's undoable), and any task's **⋯** menu has **Move to today**.
- **Date words.** The add bar understands `tomorrow`, `fri`, `next mon`, `11/5`, `Nov 5`, `in 3 days` and `next week` at the end of the text: "Call dentist fri" adds "Call dentist" to Friday, and a hint under the box shows where it will go. Tap the hint to add the text to the current day exactly as typed.
- **Undo.** Completing or reopening a task, adding, editing, moving (including Move all to today) and reminder changes show a toast with **Undo** for a few seconds. **⋯ > Undo: …** in the main menu undoes the latest one later. Deleting can't be undone.
- **Reminders.** A task's **⋯** menu has **Set reminder…** / **Change reminder…**: pick a time (or In 30 minutes / In 1 hour for a task on today), or remove it. The time is stored in the task's text as `@HH:MM`, the same as on the desktop board, so push and popup reminders work from it. A reminder that comes from a WorkFlowy date tag, and any formatted or encrypted task, is changed on the desktop page.
- **Settings.** **⋯ > Settings** has: Tasks under bullets (Group / Flatten / Off), Show Past due, Show Upcoming (turning one off removes its button and skips its background loading), Show completed tasks, and Week length (7 days Mon–Sun, 7 days Sun–Sat, or 5 days Mon–Fri). They are saved in that browser.
- **Unlock encryption (read-only).** Text made with the Encryption add-on shows as 🔒. **⋯ > Unlock encryption…** asks for your passphrase and then shows the decrypted text between ⟦ ⟧ in names and notes, for the day, the Inbox and its sections. The passphrase is checked against real encrypted text on screen, and a wrong one is refused. While unlocked, a green bar above the list says how many items on screen were opened (with a **Lock** button), and each opened item has a green left edge and a 🔓 so it stands out from plain items; items that stay locked are not marked. It is read-only: encrypted items still have no Edit on the phone, and nothing is ever re-encrypted or written back. The passphrase and the decrypted text stay in the page's memory only (never in browser storage, never sent anywhere); **⋯ > Lock encryption**, a reload, or five minutes away forgets them. It needs an `https://` address (or `localhost`), like the add-on. Text made with a different passphrase stays 🔒. Each token takes a moment to open (the key is derived 600,000 times), so a long list fills in a few items at a time.
- **Inbox sections.** In the Inbox, a heading (H1, H2 or H3) is a **section** that holds anything: tasks (with checkboxes), bullets and numbered lines, shown as a small outline under the heading and collapsible like a group. Every Inbox item's **⋯** menu has **⇥ Move under…** (lists the headings; the item goes to the end of the one you pick), and an item inside a section has **⇤ Out of section** (back to the end of the Inbox). Every item in the Inbox (bullets, numbered lines and headings, as well as tasks) has **✎ Edit** on its ⋯ menu, and a section or group header has **✎ Rename…**; Formatted text (a date, a link, bold) is edited as its visible words and keeps its tags where they are, the same way the desktop board does; only encrypted text has no Edit on the phone. A section has its own add row, **[type] [+ Add item] [Add]**: the type picker on the left (shows ☐, • or 1.; Task, Bullet or Numbered; your choice is remembered on that device), the text box, and an **Add** button (Enter does the same, and the box stays focused for the next item). A plain group has the same row without the picker (**+ Add task**), and its **⋯** menu moves the whole section to the top or to a day, changes its type, or deletes it while it is empty. Sections show one level, always (they ignore **Tasks under bullets**); plain bullets that hold tasks stay groups, and days are unchanged (a heading with tasks there is still a group). The Inbox count counts the items inside sections, not the headings. Phone page only; the desktop board is unchanged.
- **Add groups, move tasks in and out of groups, change types.** **⋯ > Add group…** (on a day or in the Inbox) asks for a name and a type (Bullet or Heading 1–3) and adds it at the end of that list. A group you add here shows even while it has no tasks (other bullets without tasks stay hidden, as before), and its **⋯** menu has **Delete group** while it is empty. A task's **⋯** menu has **Move to group…** (lists the groups on the same day or Inbox; the task goes to the end of the group) and, for a task already in a group, **Out of group** (back to the end of the day). These are for tasks only. When an Inbox is set, every item's **⋯** menu also has **📥 Move to <Inbox name>** (to the end of the Inbox; Undo puts it back). **Change type…** is on the ⋯ menu of items in the Inbox (and of Inbox groups), since days list only tasks and groups: Task, Bullet, Numbered, Heading 1, 2 or 3 (the Inbox keeps showing it as a line). Undo works for all of these.
- **Share settings across my devices (optional).** **⋯ > Settings > Share settings across my devices** is off by default and is a per-device switch. When it is on, that device loads the shared settings when the page opens (and when you return to it) and saves each change back to the server, so a second device you turn it on for gets the same Inbox, week length, Past due, Upcoming, completed-tasks and tasks-under-bullets choices. Collapsed groups stay on each device. The first time you turn it on, if the server already has shared settings you choose between using them and replacing them with this device's. If two devices change a setting at the same moment, the last one saved wins. The server keeps them in `mobile-settings.json` next to `server.js` (the folder must be writable); set `MOBILE_SYNC=off` to turn the feature off for everyone.
- **Inbox.** In **⋯ > Settings > Inbox**, paste the link of a WorkFlowy node (an Inbox or quick-capture bullet; in WorkFlowy, open the node and copy the address-bar link, or paste its full id) and tap **Add Inbox**. An **📥 Inbox N** button then appears next to Past due and Upcoming, showing everything directly under that node: open tasks, groups (a bullet or heading holding tasks), and plain lines (bullets, headings and numbered lines, shown dashed without a checkbox). The number counts open tasks plus those lines. The box at the bottom adds to the Inbox (date words still work: "Dentist fri" goes to Friday). Each task's **⋯** menu has **Move to today** and **Move to another day…**, and **Move all N to today…** sorts the whole Inbox at once; every move has an Undo. **Remove** in Settings takes the button away. Settings shows the Inbox's id (the 12 characters from its WorkFlowy link) with a **Copy id** button for the full id. The Inbox is saved in that browser unless you turn on **Share settings across my devices** (below); the desktop board's Plan day sources are separate.
- The Daily page, search and encryption are on the desktop page for now. Text with formatting or encrypted text shows (encrypted as 🔒) but can only be edited on the desktop page.

### Earlier in 1.2.1

- **Choose what a new line is.** The **Add under this line…** box (the **+** on a Daily page line, and in the search window's item editor) now has three small buttons: **• Bullet**, **☐ Task** and **1. Numbered**. Your last choice is remembered in this browser. You can also type `[] ` (task), `1. ` (numbered) or `- ` (bullet) at the start of a line to pick the type for just that line, and a pasted list keeps its `1.` numbered lines. If WorkFlowy refuses the type, the line is added as a plain bullet and a message says so.
- **Numbered lines show their numbers.** Lines whose WorkFlowy type is numbered now appear as **1.**, **2.**, **3.** on the Daily page, in the item editor and in the sub-item checklists on cards. The count restarts after any line that isn't numbered. (WorkFlowy lets a numbered list start from another number; the API doesn't report that, so the board always counts from 1.)
- **Change a line's type.** Open a line to edit it on the Daily page, in the search window's item editor, or from a sub-item on a card, and the same three buttons appear under the name box. Pick another, then press Enter or click away to save. Headings, quotes and code lines are left alone (no buttons), and board cards and group titles don't show them either, because turning a board task into a bullet would make it vanish from the board.
- **Sub-items on cards can be edited.** Click a sub-item's text in a card's checklist to edit it, with its note and type, the same way as on the Daily page. The card can't be dragged while you edit.
- **Editors are no longer wiped by background loads.** A slow WorkFlowy used to let a background refresh redraw the board and close the box you were typing in. The board now waits to redraw until the editor closes. Clicking a button inside an editor also no longer counts as "clicking away" (this fixed buttons doing nothing in Safari).
- **Encrypted text.** The board shows any text of the form `wbenc1.…` (the format of the optional **crypt** add-on) as a **🔒** wherever a name is displayed: cards, the Daily page, search results, the Done window, and push or popup reminders. This works even without the add-on and only changes how text is shown, never what is stored. The server also masks it in push reminder text, so a secret never goes to ntfy or Pushover. See "Encryption" below.
- **Add-on hooks.** Add-ons can now take part in the item editor: `boardHooks.on("editorOpen", …)` and `boardHooks.on("beforeSave", …)` (the second runs for the name and for the note), a `ctx.tools` row under the name box for small controls, and a way to keep an editor open while the add-on shows its own dialog. See `addons/ADDONS.md`.
- **New included add-on: crypt (Encryption).** Encrypt sensitive names and notes before they go into WorkFlowy, with an Encrypt/Unlock button in the editor, a 🔒 button in the header, a panel, a command-line tool, a **Settings > Encryption** tab, a one-entry unlock and a Change passphrase tool. See `addons/crypt/README.md` and "Encryption" below.

### Also new in 1.2.0 (since 1.1.1)

- **Reminders (1.2.0).** Put a time in a task (`@2:30pm`) or use WorkFlowy's date tag with a time, and the board shows a 🔔 badge, pops up when it's due, and can push to your phone through ntfy or Pushover. A 🔔 button on each card sets the time. New **Reminders** section in Settings. See "Reminders" below, including how to set up ntfy and Pushover. New settings: `REMINDER_TZ`, `NTFY_TOPIC`, `NTFY_URL`, `NTFY_TOKEN`, `PUSHOVER_TOKEN`, `PUSHOVER_USER`, `REMINDER_NESTED`, `REMINDER_STATE`.
- **Peek at Past due / Upcoming.** With a panel switched off, clicking its count at the bottom right shows the panel without changing the setting (press **📌** to keep it on, **✕** or the count to close it).
- **Adding in Group mode.** Each group card has a **+ Add task** box, and each day column has **+ Add group**.
- **Hide completed on the Daily page.** Ticked items and sub-items are left out of the Daily page too.
- **Optional add-ons.** `server.js` can load optional add-ons from an `addons` folder. Without one nothing changes. See `addons/ADDONS.md` if you want to build or install one.


## What's in the box

| File | What it does |
|------|--------------|
| `server.js` | A tiny Node server. It holds your API key, forwards requests to WorkFlowy, and serves the page. Your key never reaches the browser. |
| `index.html` | The board itself (a single page, no build step, no dependencies). |
| `mobile.html`, `icon-180.png`, `icon-192.png`, `icon-512.png` | The phone page (served at `/m`) and the app icons. Optional: without them the board still works and `/m` says it isn't installed. |
| `addons/` | Optional extras (see `addons/ADDONS.md`). Included: `crypt` (Encryption, see `addons/crypt/README.md`). Delete the folder and the board is the plain board. |
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
| `REMINDER_TZ` | No | the server's time zone | Time zone for reminder times, for example `America/New_York`. **Set it on `vps` and `fly`**, whose servers run in UTC. |
| `NTFY_TOPIC` | No | none | Turns on push reminders through [ntfy](https://ntfy.sh). Use a long random topic name; anyone who knows it can read it. |
| `NTFY_URL` / `NTFY_TOKEN` | No | `https://ntfy.sh` / none | Your own ntfy server, and its access token if it needs one. |
| `PUSHOVER_TOKEN` + `PUSHOVER_USER` | No | none | Push reminders through Pushover instead of (or as well as) ntfy. |
| `REMINDER_NESTED` | No | on | Set to `0` so push reminders ignore tasks nested under a bullet (saves a WorkFlowy request per bullet). |
| `REMINDER_STATE` | No | a file in the system temp folder | Where the server remembers which push reminders it already sent. |
| `MOBILE_SYNC` | No | on | Set to `off` to disable the phone page's "Share settings across my devices" switch for everyone. |
| `MOBILE_SETTINGS_FILE` | No | `mobile-settings.json` next to `server.js` | Where the shared phone-page settings are saved. |
| `NODE_USE_SYSTEM_CA` | No | off | Set to `1` on Windows to use the Windows certificate store (fixes certificate errors on networks that inspect HTTPS). Needs Node 22.15+ or 23.8+. |

## Using the board

**Columns and days**
- Choose **3**, **5**, or **7** days with **Days shown** in Settings → Week board. The default is 5 (Monday to Friday). 7 is Monday to Sunday. 3 is today plus the next two days.
- The day columns share the board's width evenly, so 5 days fit without sideways scrolling on a normal window (about 1100px wide or more with the sidebar open). Columns never get narrower than about 140px; below that the board scrolls sideways. Hiding the sidebar gives them more room.
- The arrows and "This week" are in one evenly spaced row at the top of the sidebar (so hiding the sidebar hides them too). Use the arrows to move between weeks (or 3-day blocks), and "This week" to jump back to the current one.
- The ↻ button in the header (after **Settings**, before the sidebar button) reloads everything from WorkFlowy.
- **Hide / show the sidebar:** the button at the right end of the header (or **Ctrl+\**, also **Cmd+\** on a Mac, even while typing in a box) hides the whole right-hand sidebar so the board or Plan day gets the full width. It's remembered in this browser. The ↻ and the Past due / Upcoming counts stay visible; the week arrows are inside the sidebar, so they hide with it.

**Tasks**
- Type in a column's **+ Add task** box and press Enter. New tasks go to the bottom of that day.
- Tick the checkbox to complete or un-complete a task.
- **Double-click a task's text to edit it right on the card.** The text turns into a box in place (the same editor as the Daily page): **Enter** saves, **Esc** cancels, clicking away saves, and a second box holds the task's note. Bold, links and other formatting are kept. The card can't be dragged while you're editing, and it works on nested tasks too. (Not available while Selector is on, since clicks pick cards then.)
  - **Group cards too:** double-click the group's name to rename the bullet in place, or double-click any task inside the group to edit it. Same box and keys as above, formatting kept. A group's name may use two lines and is cut after that; the "2 of 3 open" pill sits under the name, and the calendar icon stays at the top right of the card. Hovering it says "Double-click to rename".
- Click ✕ to delete (permanent, with a confirmation). If the task has sub-items, the confirmation says how many, because they are deleted too.
- Drag a task onto another day's column to move it (mouse only; this doesn't work by touch). Its sub-items move with it.
- **Sub-items:** a task that has lines underneath it shows a small **▸ 3 sub-items** button. Click it to open a checklist right on the card, nested as deep as the items go. Tick a sub-item to complete it, or click its text to edit it (with its note, and its type: bullet, task or numbered). Numbered sub-items show their numbers. To add or delete sub-items, use WorkFlowy, the Daily page, or the search item editor.
- **Card buttons:** hover a task to show three small buttons in its top-right corner: 🔔 sets a reminder (see "Reminders"), the calendar icon moves it, and ✕ deletes it.
- **Move to a date:** hover a task and click the calendar icon for a small menu: Today, Tomorrow, next Monday, or any date (type it or use the date picker). Cancel, Esc, or a click elsewhere closes it. The task moves to the bottom of that day's page, even a day outside the days shown. (Dragging a card onto a day column still works for days on the board.) In Group mode, the calendar icon on a group moves the whole bullet with all its tasks.
- The day header and add box stay in place while the task list scrolls.

**⚙ Settings** (the button in the header, left of the sidebar button; it opens a window with the sections on the left and their options on the right: **Week board** (Days shown 3 / 5 / 7, Hide completed, Past due, Past due range, Upcoming, Nested, Sub-items) and **Plan day** (Plan day limit, Plan day sources) and **Reminders** (popups, browser notifications, push status; see "Reminders" below), plus one section for each installed add-on that has settings (the crypt add-on adds **Encryption**). It stays open while you change things; close it with ✕, Esc or a click outside. It reopens on the section you used last. All choices are remembered in your browser.)
- **Hide completed:** hides checked-off tasks, on the board and in the sidebar's Daily page (a ticked task there is hidden along with anything indented under it; the item editor opened from search still shows everything). Deleting a line with **−** still warns about the lines underneath, hidden or not.
- **Past due:** adds a panel of open tasks from *before* the days on screen. Choose how far back with **Past due range** just below it in Settings: 1, 2, 3 or 4 weeks, or All (default 2 weeks). The panel's title shows the range, for example **Past due (2 weeks)**, and a small **→ Today** button next to the count opens a preview to move the open ones to today.
- **Upcoming:** adds a panel of tasks in the 14 days *after* the days on screen. Both panels have a **▾ 3 open** button next to the title: click it to fold the panel up to just its header (it becomes **▸ 3 open**), and click again to open it. Whether each is folded is remembered in your browser.
- **Nested:** `Off`, `Group` or `Flatten`. It decides what the board does with a plain bullet that has tasks indented under it (for example a "Project Alpha" bullet with three todos beneath it). **Off** is the default and ignores such bullets, as earlier versions did. The choice is remembered in your browser.
  - **Group:** the bullet becomes one card with a ▾ arrow, its name, and a pill such as "2 of 3 open". Its tasks are a checklist inside the card, and you can tick them in place. The arrow hides or shows the checklist. Drag the card to move the bullet, and everything under it, to another day. The calendar icon on the card header does the same. Group cards are for ticking only; edit or delete the bullet and its tasks in WorkFlowy or from Daily page / search.
  - **Flatten:** each indented task becomes its own card in the day's column, with the bullet's name in small grey type above it (for example "Project Alpha ›"). These cards can be ticked, edited and deleted like any other. They can't be dragged to another day, because that would pull them out of their bullet, but the calendar icon moves one to a date of your choice (and takes it out of its bullet).
  - **Adding in Group mode:** each group card ends with a **+ Add task** box. Type a task and press Enter to add it to the bottom of the group; the box stays ready for the next one (Esc leaves it), and the toast has Undo. Under each day's add box there's a small **+ Add group**: type a name and press Enter to make a plain bullet at the bottom of that day. It appears as a card straight away, with its add box ready for the first task. An empty group stays visible in this browser tab; after a reload it shows again once it has a task. Neither control appears in Off or Flatten mode.
  - Both modes keep the outline's order, count nested open tasks in each day's "N open", and work in the Past due and Upcoming panels too. **Hide completed** hides ticked nested tasks (and hides a group with nothing left open).
  - Only **one level down** is read: tasks directly under a plain bullet or heading that sits directly under a day. The notes bullet (WB-Notes) is skipped on purpose, so todos added to the notes bullet stay off the board.
  - **Cost:** the board makes one small request per plain bullet to find its tasks. They load in the background, are remembered until you press ↻, and the board redraws a moment later (never while you're typing in a box). With Past due on, and especially with "All", a long history means more requests. Leave Nested on Off if you don't use indented tasks.
- **Plan day limit:** how many open tasks fill the meter in Plan day (default 8). `0` turns the meter off.
- **Plan day sources:** other WorkFlowy nodes, such as an Inbox or quick-capture bullet, whose open todos appear in Plan day's **Bring in** side. Type a name (optional), paste the node's link (WorkFlowy's address-bar link, `https://workflowy.com/#/<12 characters>`, or just the id) and click **Add**. Up to 6, saved in this browser, so each person adds their own node. How it works: the link ends in only the last 12 characters of the node's id, but the API wants the full id, so the board's server looks the full id up in the same in-memory copy of your outline that Search uses. The first time that reads your whole outline, which can take a moment, and the node has to exist in it. If you leave the name blank, it uses the node's own name from WorkFlowy (otherwise "Inbox"). The name is saved when you add the node, so rename it here if you rename it in WorkFlowy. Only open **todos directly under** the node are listed (plain bullets and completed tasks are left out). ✕ removes a source.
- **Sub-items:** shows the sub-item button on tasks (on by default). The counts are loaded in the background with one small request per visible task, remembered until you press ↻, and cards in Past due and Upcoming get them too. If you have a lot of open tasks and want fewer requests to WorkFlowy, turn this off. Which cards you've opened is remembered in your browser. With Hide completed on, completed sub-items are left out of the checklist (the count still includes them).

Both panels are relative to the view. If you're looking at last week, Past due shows what was open before that week, and Upcoming shows the 14 days after it, including this week.

**Sidebar (far right)**
- **Calendar:** click a day to jump the board to that week. If the day isn't on the board (outside the 3/5/7 days shown) and has a dot, clicking it opens a **popup** beside the sidebar with that day's tasks instead. The cards work as usual (tick, edit, move, delete, groups), there's an add box for the day, and **Show this week on the board** jumps there. Click the day again, press Esc or click elsewhere to close it. Days with no dot, and days already on the board, behave as before. Today is outlined, the days on screen are shaded, and a dot marks days with open tasks. The whole Monday-to-Sunday week you're looking at is loaded, so a 5-day view still shows dots for Saturday and Sunday (and other days only once the board has loaded them; with Nested set to Group or Flatten, tasks inside bullets count too).
- **Past due / Upcoming** panels appear under the calendar when switched on. When one is **switched off**, its open-task count shows at the bottom right, under the sidebar, with the version label to their right (for example `Past due 3  Upcoming 2`). Click a count to **peek** at that panel without changing the setting: it appears in its usual place (the 📌 and ✕ buttons and the highlighted count show it is temporary; if the Daily page is expanded it is folded away for the moment and restored when you close the peek). Click the count again or the panel's **✕** to close it; a reload also hides it. Press the panel's **📌** to pin it, which turns the setting on for good. Both ranges are still read in the background so the counts are right, which costs the same requests as having the panels on (more with Past due set to All). Counts cover tasks directly on those days, plus tasks under bullets only where they've already been loaded.
- **Daily page:** shows the notes on today's WorkFlowy daily page, nested like the outline (up to 12 levels; the pane scrolls when it's long). Tasks are left out: any todo sitting directly on the page appears on the board, not here. (A todo nested deeper, such as inside WB-Notes, still shows with a checkbox, since the board doesn't display those.) Click a line's text to edit it in place (see below). It reloads when you open the board, after you add a line, and with its own ↻ button.
  - The **⤢** button in the pane's header expands it to fill the whole sidebar (the calendar and Past due / Upcoming panels are hidden, and the add box stays underneath). Click **⤡** to go back to the calendar view. The pane starts **expanded** the first time; after that your choice is remembered in the browser.
  - The sidebar always fits the window. The calendar and the Past due / Upcoming panels keep their size, the Daily page takes the room that's left, and it scrolls inside itself (so the sidebar doesn't scroll as a whole, except on a very small window).
  - **Back and forward:** the **‹** and **›** arrows beside the title step the pane to the previous or next day's page, and the date next to the heading changes. The header stays on one line. When you're away from today the date turns into a link: click it to jump back to today. Everything in the pane works on any day (edit, add, indent, delete, expand and collapse). The add box underneath is part of the same panel and follows the day shown, so stepping back a day and adding a note writes to that day's WB-Notes bullet (see below).
  - **Expand and collapse:** a line that has lines underneath shows **▾** (open) or **▸** (collapsed) at its left. Click it to hide or show those lines. A collapsed line shows how many lines are hidden, for example `(3)`. The same arrows work in the item editor in the search window. Clicking **+** on a collapsed line opens it, and so does indenting a line under it. **This is only remembered in your browser:** WorkFlowy's API can't read or change which bullets are expanded, so collapsing here doesn't collapse anything in WorkFlowy, and the reverse.
  - **Editing a line in place:** click a line's text and it turns into a box right where it is, with the text selected. **Enter** saves, **Esc** cancels, and clicking away saves. A second box underneath holds the line's **note** (the smaller grey text WorkFlowy can show under a bullet). **Shift+Enter** starts a new line in the note, and saving an empty note removes it. A line that has a note shows its first line in small grey type under the title. Only what you changed is saved, and an empty title is ignored.
  - **Line type:** under the title box are three small buttons, **• Bullet**, **☐ Task** and **1. Numbered**, with the current one highlighted. Pick another and save to change the line's type. Numbered lines show **1.**, **2.**… in the pane and restart after any other line. Headings, quotes and code lines show no buttons and are never changed.
  - **Formatting survives.** WorkFlowy stores bold, italics and links as markup inside the text. The box shows only the words, and on saving, only the words you changed are replaced, so formatting around them stays. Words typed right after a bold word become bold, like in a normal editor. If a line's formatting can't be matched safely, the line is saved as plain text rather than risk garbling it.
  - Hover a line and click **<** to outdent it (offered on every line below the first level): it moves up one level and sits directly below its old parent. Lines that were under the old parent after it stay where they are. Outdenting a direct child of WB-Notes takes it out of the notes bullet and puts it on the day's page, and a todo moved there then shows on the board. If many lines have to be re-ordered to place it (more than 25), it asks first. In the item editor the opened item's own children can't be outdented. Undo puts the line back.
  - Hover a line and click **>** to indent it: it becomes the last child of the line above it and takes its own sub-bullets along. The first line in a group has no **>**, since there's nothing above it to indent under.
  - Hover a line and click **−** to delete it. It asks first, and anything under the line is deleted too (the confirmation says how many lines). The **−** is never offered on the notes bullet (WB-Notes) itself. Inside WB-Notes it only appears on lines that have nothing underneath, so a note with sub-bullets can't be removed in one click (delete its sub-bullets first). Deleting is permanent.
  - Hover a line and click **+** to add a new line under it (as its last child). The box stays open so you can add several in a row; press Enter to add and Esc to close. Above the box, **• Bullet / ☐ Task / 1. Numbered** choose what kind of line is added (remembered in this browser); starting the text with `[] `, `1. ` or `- ` picks the type for that line alone. **Pasting several lines** into that box adds them all at once, nested by their indent, keeping `1.` numbered lines (undo removes them).
- **Add to WB-Notes:** the one-line box under the Daily page (one panel, one header). Its grey hint says where a line will go, for example **Add to WB-Notes · today**. Everything you add goes into a single bullet on **the day the Daily page is showing** (named **WB-Notes** by default), so your notes stay together. When that day isn't today, the box gets a blue border and the hint names the date, so you don't write to the wrong day by accident.
  - The board finds the WB-Notes bullet by name each day and creates it (at the bottom of the page) if it isn't there yet, so adding again and again just keeps adding to it.
  - Type a line and press **Enter**: it's added at the bottom of WB-Notes right away, and the box stays focused for the next one. `[ ] text` makes a todo (it stays inside WB-Notes, so it isn't on the board).
  - **Paste a list** (several lines) and it's added immediately as nested bullets: two spaces (or a tab) per level, a leading `-` or `*` is dropped, and the indent is taken relative to the least-indented line, so you can paste from anywhere. If one of the lines fails, the ones already added stay, and the message says how many went in. **Undo** removes what was just added.
  - There is no separate notes editor, Save button or draft any more. Use **>** and **<** on a line to nest it afterwards.
  - **Move notes in** (in the **⋯** menu at the right of the panel's header) gathers the shown day's plain top-level bullets (with their sub-bullets) into WB-Notes, in their current order. It asks first, shows what will move, and leaves todos, headings, and the WB-Notes bullet alone. Items are moved, not copied.
  - **Changing the name:** choose **Rename the notes bullet…** in the **⋯** menu and type a new name. It's saved in your browser and overrides the server's `NOTES_NAME` default. Typing the default name again clears the override. Names must not be empty, and matching ignores capitals and stray spaces (`wb-notes` finds `WB-Notes`).
  - When you change the name, the board offers to rename today's existing bullet too (OK renames it; Cancel leaves it, and the next save starts a separate bullet with the new name). If today already has a bullet with the new name, the board just uses that one and doesn't rename anything.
  - Only today's bullet is renamed. Older days keep their old name, since each day has its own notes bullet. Avoid markdown symbols such as `*` or `[` in the name, because WorkFlowy converts them.
  - If you rename the bullet directly in WorkFlowy, the board won't recognize it until you change the name here to match.

**Planning, moving and undoing** (**Plan day** is in the bar along the bottom, on the left, with the version number on the right. **Selector** and **Reports** are on the bottom row of the Daily page panel, under the add box)

- **Undo.** Moving a task, ticking or unticking it, deleting it, adding one, and every bulk action show a bar at the bottom with an **Undo** button (it stays for 10 seconds). **Ctrl+Z** (or **Cmd+Z**) undoes the latest one when you aren't typing in a box, and each press goes one step further back (up to 20). What Undo can and can't restore:
  - A moved task goes back to the **bottom** of the day it came from, because WorkFlowy's API can only place things at the top or bottom of a day, so its old position in that day isn't restored.
  - A deleted task comes back with its note, its completed state and everything under it (up to about 300 lines, 12 levels deep), but as a **new copy** with new ids, again at the bottom of its day. Anything that pointed at the old one (links, mirrors) is not restored.
  - Not covered: deletes in the Daily page and item editor (their − buttons ask first and are permanent), tick boxes on group cards and sub-item checklists, and edits to text.
- **Selector (☑ Selector, on the bottom row of the Daily page panel).** Click cards to pick several (they get a blue outline; clicking doesn't tick or edit them). A bar appears at the bottom: **Select all open**, **Move to…** (Today, Tomorrow, next Monday, or any date), **Complete**, **Delete** (asks first), and **Done selecting** (or press Esc). A **group card** is picked as a whole (click anywhere on it except the fold arrow): moving it moves the bullet with its tasks, and deleting it deletes the bullet and everything under it. **Complete** skips groups (a group is a bullet, not a task) and says so; **Select all open** includes groups. Everything done from the bar can be undone in one step.
- **Move open tasks forward.** The **→ Today** button in the Past due panel opens a preview of those tasks. Untick any you want to leave, pick the date (it starts on today), and press **Move**. Plan day uses the same preview for **Send the rest to tomorrow…** and **Add all…**. It moves tasks that sit directly under a day. Tasks inside plain bullets (the Nested setting) stay where they are, so nothing leaves its bullet by surprise.
- **Date words in the Add task box.** End the text with a day and the task goes to that day instead of the column you typed in, for example `Call dentist fri`, `Pay rent in 3 days`, `Report 11/5`, `Party Nov 5th`, `Plan next week`. A grey hint under the box shows where it will go. It understands: `today`, `tomorrow` (`tmrw`), weekday names (`fri` is the next Friday coming up, `next fri` is the Friday of next week), `next week` (Monday), `in N days/weeks`, `M/D` and `M/D/YY`, and `Nov 5` / `5 Nov` (the next time that date comes round, or add a year). A trailing `on`, `by` or `due` is dropped (`Call mom on fri`). Text that's only a date word stays a normal task. **Shift+Enter** adds the text exactly as typed.
- **Plan day (📅 Plan day in the bottom bar).** Replaces the columns with one day in focus, today to start with. Left: that day's tasks as normal cards (tick, edit, move, delete, select), a count of open and done tasks, a meter against your **Plan day limit** (amber at the limit, red above it), **Send the rest to tomorrow…**, and an Add task box. Right: **Bring in**, listing your past-due open tasks (as far back as the Past due range, at most 4 weeks) and the next three days' open tasks, each with a **+ Add** button that moves it to the day you're planning, and **Add all…** for the past-due list. Use ‹ › to plan another day. Click Plan day again to go back to the columns. Day pages that aren't loaded yet are fetched when you open it, so the first time takes a moment.
  - Plan day (and the day you're on) is remembered for the browser tab, so a reload brings you back to it instead of the board.
  - **Extra sources:** each node added under *Plan day sources* in Settings gets its own list (name and open count) on the Bring in side, below Past due. **+ Add** moves the task out of that node onto the planned day, and **Add all…** opens the same preview as Past due. Undo moves it back to the bottom of the node.
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

### Reminders

A task becomes a reminder in either of two ways:

- **WorkFlowy's own date tag with a time.** In WorkFlowy type `!!` or `/date` and add a time, for example *Wed, Oct 28, 2026 at 2:30pm*. The reminder fires at that date and time, wherever the task sits. A date with no time is not a reminder.
- **A time in the task text.** Write `Call dentist @2:30pm`, `Stand-up @9:15` or `Pay rent @17:00`. The reminder is for the day page the task sits on. You can also hover a card, press its 🔔 and pick a time, or **In 30 min** / **In 1 hour**; the board writes the `@time` for you.

The time stays in the task in WorkFlowy, so the board stores nothing extra. If part of the task is encrypted (see "Encryption"), keep the `@time` outside the encrypted part so the reminder still works; popups and push messages show the encrypted part as 🔒. A card with a reminder shows a **🔔 2:30 PM** badge (with the date if it differs from the page). For `@time` reminders the badge replaces the `@` text, and clicking it changes or removes the time. A date tag's time is changed in WorkFlowy.

**Popup and browser notification (in the board)**

- When the time arrives, a popup appears at the top right with **✓ Complete**, a **Snooze…** menu (5, 10, 15, 20, 30, 45 or 60 minutes) and **Dismiss**. It works while the board is open in a tab, whichever week you're looking at, and only for open tasks.
- In **Settings → Reminders** you can turn the popups off, and press **Turn on** to also get a system notification (the browser asks permission once). Browsers only allow system notifications on `https://` addresses and on `localhost`.

**Push to your phone (board closed)**

The server sends a push at the task's time even when no browser is open. Set up one of these services, restart the server, then open **Settings → Reminders**: it shows whether push is on, and **Send a test** sends a test message.

*Option A: ntfy (free, easiest)*

1. Install the ntfy app on your phone (App Store or Google Play/F-Droid). Allow notifications for it when asked (needed on iOS).
2. In the app tap **+** and subscribe to a topic. Pick a long random name nobody could guess, such as `weekboard-k7q2x9m4zr81`. Leave the server as the default (ntfy.sh). On the public ntfy.sh service anyone who knows the topic name can read your reminders, so treat it like a password.
3. Give the same name to the server as `NTFY_TOPIC`:
   - **Localhost:** `DEPLOY_MODE=local NTFY_TOPIC=weekboard-k7q2x9m4zr81 WORKFLOWY_API_KEY=... node server.js` (on Windows set the variables first, as in Option 1).
   - **Your own server:** add `NTFY_TOPIC=...` and `REMINDER_TZ=America/New_York` to `/etc/weekboard.env`, then `sudo systemctl restart weekboard`.
   - **Fly.io:** `fly secrets set NTFY_TOPIC=weekboard-k7q2x9m4zr81`, and add `REMINDER_TZ = "America/New_York"` under `[env]` in `fly.toml`, then `fly deploy`.
4. Open **Settings → Reminders**, check it says "On through ntfy", and press **Send a test**. The phone should buzz within a few seconds.

*Option B: Pushover (paid, polished)*

1. Create an account at pushover.net and install the Pushover app on your phone. There is a 30-day free trial, then a one-time fee of about $5 per platform.
2. Copy your **User Key** from the top of the Pushover dashboard. This is `PUSHOVER_USER`.
3. Open pushover.net/apps/build and create an application named "Week Board". Its API token is `PUSHOVER_TOKEN`.
4. Set both variables the same way as in Option A step 3 (environment, env file, or `fly secrets set PUSHOVER_TOKEN=... PUSHOVER_USER=...`) and restart.
5. In **Settings → Reminders** check it says "On through Pushover" and press **Send a test**.

You can set up both services; each reminder is then sent through both.

*Two optional extras*

- **Keep reminders off ntfy.sh:** run your own ntfy server and set `NTFY_URL` to its address (and `NTFY_TOKEN` if it needs a login). Reminder text then never goes through ntfy.sh.
- **Skip nested tasks for push:** set `REMINDER_NESTED=0` so push reminders ignore tasks nested under a bullet. This saves one WorkFlowy request per bullet every 3 minutes. Popups in the board are not affected.

**What the server watches and when it sends**

- Today's tasks, including tasks nested under a bullet, and the tasks directly on the next 7 days' pages, re-read every 3 minutes. A reminder you add less than 3 minutes ahead can be a little late. A date-tagged task fires on its tagged day anywhere in that range; an `@time` task waits for its own day's page.
- Push is sent up to 15 minutes late if the server was down, and is not sent twice. The list of what was already sent is kept in `REMINDER_STATE` (default: a file in the system temp folder).
- The server only polls WorkFlowy for reminders when push is set up, or when the board has been open in the last 10 minutes.

**Where it works**

| | Popup | Browser notification | Push |
|---|---|---|---|
| Localhost | Yes, while the board is open | Yes | Only while the server is running and your computer is awake |
| Your own server | Yes | Yes (needs `https://`) | Yes, always |
| Fly.io | Yes | Yes | Yes, always |

Set `REMINDER_TZ` on your own server and on Fly, because they run in UTC. On Fly the sent-list is lost when the machine restarts or redeploys, so a reminder from the last 15 minutes could be sent again (rare).

**If the test fails**

- *"No push service is set up":* the server didn't see the variable. Check you restarted it, and on Fly that you used `fly secrets` and redeployed.
- *An error from ntfy or Pushover:* the topic, token or user key is mistyped.
- *The test works but real reminders come at the wrong time:* `REMINDER_TZ` isn't set on a VPS or Fly server.

## Using it on a phone or tablet

The board is a web page, so a phone only needs to reach the server in its browser.

- **Hosted (Option 3, Fly.io):** open your `https://…fly.dev` address on the phone and sign in. This works anywhere, and is the simplest way to install it to the home screen.
- **Your own computer plus Tailscale (a Mac, say):** install Tailscale on the computer and on the phone or tablet (same account), turn on **HTTPS Certificates** in the Tailscale admin console (DNS page), then start the board as a private remote board and let Tailscale put HTTPS in front of it:
  ```
  DEPLOY_MODE=vps WORKFLOWY_API_KEY=your_key BOARD_PASSWORD=a-long-password-12+ PUBLIC_URL=https://your-mac.your-tailnet.ts.net ASSUME_HTTPS=1 node server.js
  tailscale serve --bg 3000
  ```
  Use your computer's real Tailscale name in `PUBLIC_URL` (shown in the Tailscale app, ending in `.ts.net`), open that address on the phone or tablet, and sign in with the board password. Only your own devices can reach it, and the computer must be on. `ASSUME_HTTPS=1` tells the board that the proxy on this same computer is already speaking HTTPS; it is ignored if the board listens on anything but this computer.
- **Home Wi-Fi without Tailscale:** the plain `local` mode only answers on this computer, so another device on your Wi-Fi can't use it. Use the Tailscale option above.

Phones open the phone page (`/m`); tablets 820px wide or narrower do too, while wider tablets (landscape) get the desktop board. Use **⋯ > Open the desktop page** on the phone page to switch.

## Encryption (optional crypt add-on)

WorkFlowy can read what you store in it, so the included **crypt** add-on lets you encrypt the sensitive parts of a name or note *before* it goes into WorkFlowy. WorkFlowy then holds unreadable `wbenc1.…` text, and only someone with your passphrase can read it. Everything is done in your browser with AES-256-GCM; the passphrase is never saved, never sent to the board's server and never sent to WorkFlowy.

- **In the item editor:** select words and press the **🔒 Encrypt** button (or Ctrl/Cmd+Shift+E), or press it with nothing selected to protect the whole name (`@times`, `#tags` and `@mentions` stay readable, so reminders still work). While you are unlocked, encrypted parts show as `⟦readable⟧` and are encrypted again when you save. The button is **🔓 Unlock** when a line holds encrypted text and you are locked.
- **Unlock once for the session:** click the **🔒** in the header, type your passphrase and press Enter. The button turns into a green **🔓 Unlocked**. The first time you choose the passphrase (typed twice, with a strength hint); after that one entry is enough, because a small check value is kept in the browser. It locks again after 5 idle minutes (changeable), when you hide the tab, or when you press **Lock now**.
- **Panel:** the green button opens a panel that encrypts and decrypts any text (this is also how you put encrypted text into a note), locks, and has **Change passphrase…**, which re-encrypts everything already in your outline with a new passphrase after showing you the counts.
- **Settings > Encryption:** **Enable encryption** (master switch: off hides the header padlock and leaves editors alone), **Encrypt inside the item editor**, and, when that is off, **Show `<<secret>>` instead of the long encrypted text**.
- **Command line:** `node addons/crypt/cli.js enc "text"` and `dec` work without the board.
- **What it doesn't hide:** the rest of a name, tags, dates, structure and any unencrypted notes stay readable, and WorkFlowy can still see roughly how long each secret is. Search can't see inside encrypted text. A lost passphrase can't be recovered.

Full details, the safety rules and the token format are in `addons/crypt/README.md`.

## How it maps to WorkFlowy

- Each column is a day in your WorkFlowy **calendar** (for example `2026-10-23`). Tasks are that day's children.
- By default the board shows **todo items only**, directly under a day. Plain bullets, headers, quotes, and code blocks under a day are skipped, and so are todos nested under them (turn on **Nested** to show those under plain bullets and headings). A task's own sub-items are shown through its sub-items button.
- Tasks added on the board are created as todos under that day. Moving a task changes its parent, so it's moved, not copied.
- The board stores nothing itself. Every action is a live call to WorkFlowy.
- Notes added from the add box go inside the **WB-Notes** bullet on the day the Daily page is showing (today unless you stepped back). Since the board only reads the top level of each day, nothing inside WB-Notes appears on the board, including `[ ]` todos added there. Add tasks that should show on the board with the **+ Add task** box in a day's column.
- Changes you make in WorkFlowy appear on the board when you reload (↻), change weeks, or toggle an option. There's no live sync.
- **Line types.** The board reads and sets a line's type (`layoutMode`): `todo` for tasks, `bullets` for plain bullets and `numbered` for numbered lines (WorkFlowy's API documents the other values but accepts `numbered` too). Headings, quotes and code blocks are shown as they are and never changed by the board.

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
- **Signing out wipes this browser's copy (1.0.8).** In hosted modes, **Sign out** also clears the notes bullet name and every saved setting from the browser, so nothing is left behind on a shared computer. (You'll set your options again next time.)
- Search and the Done window both read the server's in-memory copy of your outline, so the same rules apply (idle purge, login in hosted modes). The Done window only receives the completed tasks in the range you pick.
- The browser can't reach WorkFlowy's full export. Only the server uses it, to build the search copy.
- **Use a long, unique password** (`openssl rand -base64 24`). It is the only thing between the internet and your outline. There's no second step such as a one-time code, and the lockout is per address, so a very large distributed guessing attack is only limited by the password's strength.
- **Your outline sits in the host's memory while search is in use,** unencrypted, and is cleared after 10 idle minutes (`IDLE_PURGE_MINUTES`). Use a host you trust. For `fly`, Fly staff and their infrastructure can in principle access a running machine.
- **Encrypted text stays encrypted in the server's copy.** With the crypt add-on, anything you encrypt is stored in WorkFlowy, and therefore in the search copy, only as `wbenc1.…` text. The server never has the passphrase, so it can't read it, and it masks encrypted text in push reminders. The rest of the outline is still held unencrypted, as described above.
- It's a single-user app (one WorkFlowy key, one password). Don't share the password.
- Sessions are kept in memory, so restarting the server signs everyone out. Run one instance only.
- Keep the server patched (`sudo apt update && sudo apt upgrade`, or let unattended upgrades do it) and update Node.js and the board when new versions come out. On Fly, redeploy now and then to pick up a newer Node image.
- If you'd rather not expose it publicly at all, run `vps` on a machine reachable only over a private network such as Tailscale, and keep the password on top.

## Known limitations

- No live sync with WorkFlowy (reload to pick up outside changes).
- Dragging between days uses mouse events and doesn't work by touch.
- Reordering tasks within a day isn't supported, only moving between days.
- The Daily page pane can complete todos, edit text, add lines under a bullet, indent (**>**) and outdent (**<**) a line. It can't reorder lines, because the API can only place a moved or new line at the top or bottom of a parent, not right after a specific line. It can delete lines (**−**), except the notes bullet itself, and inside it only lines with nothing underneath. The item editor in search can delete only lines with nothing underneath, and never the opened item. New lines (from the add box or the **+** button) always go to the bottom of their parent. Outdent works by moving the line, then the lines that followed its parent, to the bottom of the grandparent, so a line with many later siblings means many requests.
- Dots on the calendar only appear for days already loaded.
- Search works on the server's copy of your outline. Changes made in WorkFlowy itself appear after a refresh (Refresh index) or once the copy is more than 5 minutes old. Edits made through the board are applied to the copy, but a new task added to a day may show with no path (calendar pages) until the next refresh.
- The whole outline is held in the server's memory while search is in use. That's fine for tens of thousands of items but heavy for very large outlines. It isn't encrypted, so the protection is the idle purge, the login (hosted modes) or localhost-only access (`local`), and your own disk and account security.
- Calendar day pages (such as 2026-10-23) can show up in results with their date as the path.
- Dragging a card to another day is remembered by Undo too, but touch screens still can't drag: use the calendar icon or Selector there.
- Settings, which lines you've collapsed, the last line type you picked for new lines, and the crypt add-on's switches and check value are stored in the browser (`localStorage`), so they're per browser.
- The line-type buttons don't appear on board cards, group titles, or on headings, quotes and code lines. A numbered list that starts from a number other than 1 in WorkFlowy shows from 1 on the board.
- The board relies on WorkFlowy's calendar nodes and the API as documented at <https://beta.workflowy.com/api-reference/>. It was tested against a mock of that API, so report anything that behaves differently on a real account.
