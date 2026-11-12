# Changelog

## 1.5.4 (2026-11-11)

- **Markdown notes (optional add-on).** The new `addons/markdown` add-on makes the Notes window and the phone's note editor Markdown-aware: a **format bar** (bold, italic, code, link, heading, bulleted / numbered / task lists, quote, code block, rule) and an **Edit / Preview** switch. The preview is read-only and built without HTML (no images; links only for `http`, `https` and `mailto`, opened in a new tab). Supported: headings, bold, italic, inline code, code blocks, links, quotes, bullet / numbered / task lists (checkboxes are read-only) and rules. Notes open in Edit; a new note always does. Desktop shortcuts: Ctrl/Cmd+B, I and K. Nothing is added to the stored text. Without the add-on the board is as before.
- **It works with encryption.** Text inside `⟦ ⟧` is never parsed as Markdown, and the format bar never puts marks inside it (a selection that touches an encrypted part grows to cover it; a cursor inside one gets a message). The preview is cleared when a note locks, when the window or editor closes, and when the add-on is switched off.
- **Plain notes list.** The one-line previews in the notes list leave out the Markdown marks (`#`, `**`, `-`, links, fences) when **Plain notes list** is on (default). The stored text and Search are untouched.
- **Settings are kept on the server.** The desktop's new **Settings > Markdown** tab (on / off, open notes in Edit or Preview, format bar, keyboard shortcuts, plain notes list) is saved in `markdown-settings.json` next to `server.js` (`MARKDOWN_SETTINGS_FILE` moves it) through `GET` / `POST /markdown/settings`, so the desktop and the phone agree. The phone has no settings tab for add-ons; it reads them when a note opens and when the page comes back to the front. The page runs the add-on's code but treats it as off until the settings arrive, and stays off if the route is missing.
- **Add-ons reach the phone page.** An add-on manifest can now list `shared` (one file run on both pages, placed first), `mobileScript` and `mobileCss`; `mobile.html` has the two placeholders (`<!--@addons:script-->`, `/*@addons:css*/`). An older `mobile.html` just has no add-ons.
- **Note editor hooks.** The desktop Notes window and the phone note editor have the same hooks for add-ons: `wbNotes.mount(fn)` (the note's text box plus an empty strip above it and an empty area in its place), `wbNotes.onState(fn)` (open note, read-only, locked, unlocked, closed) and `wbNotes.snippet(fn)` (the list's preview text). They do nothing with no add-on, and a failing hook is logged and skipped.
- **The pages show the server's version.** `server.js` writes its own `VERSION` into the version tag and the label in the desktop page's corner when it serves them, so a version bump is one line in `server.js`.
- **AI Assistant add-on 0.2.1 (beta), added to the repo.** `addons/assistant/` was only shipped separately before. Changes since 0.2.0: encrypted text (wbenc1) is shown to the model as `‹secret›` in every tool result, the board summary and standing instructions, so it never reaches the model or Anthropic; `rename_item` must keep every `‹secret›` and puts the original encrypted text back (refused before the approval card otherwise); new tasks, groups and notes can't contain `‹secret›`; `delete_item` also refuses the board's Inbox, the Notes node, Plan day sources, a notes bullet of any name, and anything that holds one of them; `inbox` means the Inbox set on the board (WorkFlowy's own only when none is set); `add_note` makes `!alld` all-day notes on the day instead of lines under the old notes bullet; the default Anthropic model is `claude-sonnet-5-5`. The page sends the Inbox and Notes node with each question.
- **Update notice stays on screen.** The "⬆ v… available" notice in the bottom-right corner no longer runs off the window. The corner was fixed at the sidebar's width (300px) and couldn't wrap; now it is at least that wide, grows for the notice, and in a narrow window the notice moves under the version.

### Upgrading

Replace `server.js`, `index.html` and `mobile.html`, add the `addons/markdown/` folder, then **restart the server**. The add-on starts on; turn it off under **Settings > Markdown**, or delete the folder to remove it.

### Files changed

| File | Change |
|------|--------|
| `server.js` | Add-on manifests accept `shared`, `mobileScript`, `mobileCss`; add-ons injected into the phone page; the pages get the running version; update hint names `mobile.html`; version 1.5.4 |
| `addons/assistant/` | New in the repo: AI Assistant 0.2.1 (`backend.js`, `page.js`, `page.html`, `manifest.json`, `ASSISTANT.md`) |
| `addons/ADDONS.md` | Describes the Assistant |
| `index.html` | `wbNotes` hooks and the empty bar and preview areas in the Notes window; note list preview goes through `wbNotes.snippet`; the update notice in the footer stays on screen; version 1.5.4 |
| `mobile.html` | The same hooks and areas in the note editor; add-on CSS and script placeholders; version 1.5.4 |
| `addons/markdown/` | New: `manifest.json`, `shared.js` (settings, renderer, snippet cleaner, format bar), `desktop.js`, `mobile.js`, `mobile.css`, `page.html` (styles and the Settings tab), `server.js` (the settings route), `README.md` |
| `README.md`, `CHANGELOG.md` | Updated |

## 1.5.3 (2026-11-10)

- **Time block a task on the phone page.** A task's ⋯ menu (on a day and inside a group) has **🕐 Time block…** / **🕐 Change time block…**. The sheet has a start time, a length (15m to 8h, in 15-minute steps) and the end time. It defaults to the task's current block, or the next half hour on today, or 9:00 on other days. Saving writes the desktop's markers (`^10:30am` / `^15:00`, and `~1h` when the length changes), so the block shows on the board's timeline. A task without an estimate is a 30-minute block, as on the desktop. **Remove time block** clears only the start time and keeps the estimate. Undo is offered. Formatting in the task (`<b>…</b>`, `&nbsp;`) is kept: the phone page now has the desktop's `withMarker()`, `timeBlockToken()` and `estToken()`.
- **Time block badge on the phone page, as on the desktop.** The grey "🕐 time · length" chip on its own row is replaced by the desktop's badge, floated to the right of the task's first line so a blocked task usually takes one line: blue (`--accent`) "3:00 PM · 1h 30m" (time only without an estimate, as on the desktop), green "▶ NOW" while today's block runs, yellow "⚠ 3:00 PM" when it overlaps another open block that day (the day's tasks and those inside its groups), faded when done. A 30-second timer flips ▶ NOW on and off without redrawing the list.
- **Hide estimates on the phone page.** **⋯ > Settings > Hide estimates** (off by default) leaves the ⏱ chip off tasks. A time block's badge still shows its length. It is part of **Share settings across my devices**.
- **Follows the Time blocking switch.** The phone page reads `tb` from `/features`; when **Writing features > Time blocking** is off on the board, the Time block item isn't offered.
- **Encrypt words in a phone note.** The phone page's note editor has an **Encrypt** button: it encrypts the selected words, or takes the encryption off the ⟦part⟧ the cursor is in. Encrypted parts are edited as `⟦readable⟧` text while unlocked and turned back into `wbenc1.` tokens on every save (`sealNote()`; an unchanged part keeps its token, a changed or new one is encrypted with `encryptToken()`, the add-on's format: PBKDF2-SHA256 ×600,000, AES-256-GCM, fresh salt and IV). A stray ⟦ or ⟧ stops the save. Locked, a note with tokens is read-only with 🔒 for each part. Before, any encrypted text made the whole note read-only, and only its first encrypted part was shown, without the rest of the note. The passphrase is checked against a token on the page or in the notes; with none, it is asked for twice. Lock, or five minutes away, saves an open note sealed and then shows it locked. The notes list preview now shows the note with 🔒 for encrypted parts instead of "(encrypted)". The title of a note with an encrypted body can be renamed while it is unlocked.
- **Notes count on the phone.** The phone page's **📝 Notes** button shows how many notes there are, like Past due, Upcoming and the Inbox. The notes are read with the page (and on ↻), not only when you open them.
- **Clearer phone note editor.** **Done** is now **‹ Notes**. The 🔒 icon button is a text button that says what it does: **Unlock** (locked note), **Encrypt** (greyed until words are selected), **Decrypt** (cursor in a ⟦part⟧); it follows the selection (`selectionchange`). A static grey Phosphor lock before the title marks a note with encrypted text, in the editor and the list (replacing the list's " 🔒" after the title and its faded card). Encrypted text you can't read is `‹secret›` / `‹secret 1›` … instead of 🔒, in the body, the title and the list preview; a note that is all encrypted shows "This note is encrypted" with an **Unlock** button (the header button is hidden then) and "Encrypted note" in the list. The note's **⋯** menu has **Lock encryption** while unlocked. No padlock emoji in the hint line. "Saved ✓" clears after 2 seconds and the header is tighter, so the title has more room.
- **Select from the card.** A card's hover bar is now [select] [📅] [✕]: the select button (a circle with a check, `SEL_ICON`) takes the empty third spot (`right: 60px`; on Panes cards that spot is 🔔), and 📅 joins the bar. A group has the same button on its top edge (absolute, so the name keeps its width). Clicking it picks the card or group and starts selecting (`selPick()`). While selecting, the button is hidden and each card's checkbox (a group's fold arrow) is replaced by a round marker (`.selmk`), filled with a tick when picked; clicking a card still toggles it. The bar's **Done selecting** is now **Cancel** (clears the selection and stops selecting; Esc does the same). The **☑ Selector** button is removed from the Daily page's bottom row (the code tolerates its absence), so Inbox, Notes and Reports fit; `.outright` also wraps rather than running off a narrow column.
- **Notes window on the desktop.** **📝 Notes** right of **📥 Inbox** (and the **N** key) opens a two-pane Notes window (`#ntModal`) instead of the item window: the notes node's children as a list (title, preview, lock marker, `‹secret›` placeholders, search, + New note, ↑/↓) and each note one line of title and the first line of its text, cut with …, so every note is the same height; "No text" when empty) and an editor (title and text, saved a second after typing through a save queue, on switching notes and on close; ⋯ > Delete note with Undo). Encryption goes through the Encrypt add-on's `wbcryptLive` (`unlock`, `reveal`, `seal`, `toggle`, `onLock`): **Encrypt** / **Decrypt** / **Unlock** as on the phone, Ctrl/Cmd+Shift+E, sealed on every save, and sealed and shown locked when the add-on locks or the window closes. The node comes from **Settings > Week board > Notes** (new `notesNode` key, part of desktop settings sharing) or, when that is empty, from the phone page's shared `notesLoc` (`GET /m/settings`). The button shows how many notes there are and is hidden while neither is set. A status bar (`.nt-foot`) shows the note count (or how many match the search) and, for the open note, Ln/Col (and the selection), words and characters, the encryption state and the save state (*Unsaved changes* / *Saving…* / *Saved 2:41 PM* / *Not saved: …* in red); the save state moved there from the note's header. **Set Notes** compares with the phone's location: the same node is ignored ("That's already your notes location"), so the board keeps following the phone; a different one asks **Use on this board only** / **Use for both** (also `POST /m/settings` `notesLoc`) / **Cancel**, naming each node (with the end of its id when the names match).
- **Stronger sign-in password check.** `passwordOk()` now compares scrypt hashes (N=16384, r=8, p=1, 32 bytes) in constant time instead of SHA-256. `BOARD_PASSWORD` can be a plain password (hashed with `BOARD_PASSWORD_SALT` or a built-in salt) or a `salt:hash` pair in hex (16–64 hex digit salt, 64 hex digit hash), so the password doesn't have to be stored in plain text. Any error in the check counts as a wrong password.

### Files changed

| File | Change |
|------|--------|
| `mobile.html` | Encrypt words in a note (Unlock / Encrypt / Decrypt button, title lock, ‹secret› placeholders, ‹ Notes back button, ⟦ ⟧ editing, passphrase sheet, lock saves sealed); Time block sheet and menu items; `withMarker`, `timeBlockToken`, `estToken`; desktop-style time block badge on the title line with ▶ NOW and overlap states; Hide estimates setting and its sharing; reads the Time blocking switch; version 1.5.3 |
| `server.js` | Shared phone settings accept `hideEst`; desktop settings sharing carries `notesNode`; scrypt password check with optional `salt:hash` `BOARD_PASSWORD`; version 1.5.3 |
| `index.html` | Notes window; select button in the card hover bar, selection markers, Selector button removed, Daily page row wraps; Notes button, N key and Settings > Week board > Notes; version 1.5.3 |

## 1.5.2 (2026-11-09)

- **Reminder and repeat badges on live cards.** The 🔔 bell badge (`@time` and `!1d`/`!1h`/`!1w` early alerts) and the 🔁 repeat badge now appear on live-edit cards. Previously they were only visible on plain (non-live) cards.
- **`@time` markers hidden everywhere.** `@9am`, `@09:00` etc. are now stripped by `dropMeta()`, so they no longer leak through on timeline block labels, sidebar items, the time block editor title, or any other view that called `dropMeta` without `dropTime`. This includes 24-hour times (`@14:30`) and markers inside formatting (`<b>@9am</b>`) or after a non-breaking space: `withMarker()` now widens every lead group of a pattern and reads the lead from the match itself.
- **`!1d` / `!1h` / `!1w` markers hidden everywhere.** (Shipped in 1.5.1 but documented here.) `LEAD_RE` is now part of `dropMeta()`, fixing places where early-alert markers were visible.
- **Hide estimates on cards (setting).** **Settings → Hide estimates on cards** removes the ⏱ badge from cards. Estimates still count toward column totals and time blocking. Off by default. It (and **Hide weekend**) is now carried by **Share these settings between browsers**.
- **Weekend header spacing fixed.** The icon row (Add task, Add group, Note) and all-day band in weekend sections now sit inside the column header, matching the weekday layout. Removed the extra gap between the header and the icon row on all columns.
- **Columns line up.** The day names, icon rows and first cards of every column, the weekend column included, start at the same height. The 14px above each column's first card is kept (it is room for the card's hover buttons, which were cut off without it); in the weekend column it sits under each day's header instead of above Saturday.
- **Time blocking clock moved to the icon row.** Today's time-blocking button is now a clock icon from the same Phosphor set as Add task, Add group and Note, at the right end of today's icon row. It no longer sits in the header, so the day name and counts keep their full width.
- **Plan Day "Bring in" column now scrolls.** Fixed a CSS specificity conflict (`.planpane > div:last-child` was overriding `.bring-list`'s flex) that prevented the Bring in list from scrolling when it had more items than fit on screen.
- **Past due section hidden when empty.** The "Past due (0)" header and "Nothing past due" message in the Bring in column are now hidden when there are no past-due tasks.
- **Security and code review minor fixes.** See below.

### Server fixes

- **Sign-in lockout can't be dodged with parallel attempts.** The failure count is read again after the password arrives, so wrong passwords sent at the same moment each count toward the 5-try lockout. Before, a batch of simultaneous attempts only counted as one.
- **No export retries inside the minute.** When the server has no outline copy (at startup, or after the idle purge) and the last download failed (for example WorkFlowy's once-a-minute limit), searches within that minute get the same error instead of asking WorkFlowy again and again.
- **Pages are built once.** `index.html` and `mobile.html` are filled in (add-ons, notes-bullet name, mode) once and kept until the file on disk changes; each request only adds its script nonce.
- **Repeating tasks remember finished series.** "Ended", "already copied" and "counter not found" marks are saved even when a run made no new copy, so a restart doesn't re-check them or log the same warning again.
- **One list of data routes.** The routes that answer 401 when signed out and the reserved add-on paths now come from one `DATA_PATHS` list.
- **Version.** `server.js` and the phone page now report 1.5.2, so the update check announces it.

### Files changed

| File | Change |
|------|--------|
| `index.html` | Bell/repeat badges on live cards; `TIME_RE` and `LEAD_RE` added to `dropMeta()`, `withMarker()` handles every lead group; hide-estimates setting (shared with Hide weekend); weekend header structure fix; column alignment and hover-button room; clock icon in today's icon row; Plan Day bring-in scroll fix; version 1.5.2 |
| `server.js` | Sign-in lockout fix; export retry throttle without an outline copy; page cache; repeating-task state saving; `DATA_PATHS`; `hideEst`/`hideWkend` accepted by shared settings; version 1.5.2 |
| `mobile.html` | Version 1.5.2 |

## 1.5.1 (2026-11-09)

- **Sync templates across machines via WorkFlowy.** When you run local mode on more than one computer, day templates and quick blocks can now be stored in a WorkFlowy node so every machine shares the same ones. In **Settings → Features → Sync templates via WorkFlowy**, name this server and paste the link to a WorkFlowy node you've created for it (e.g. `#weekboard-config`). The first machine pushes its local templates up; a second machine that connects sees the shared templates and, if its own differ, shows a side-by-side comparison so you can choose which to keep or defer the decision to next time. A `servers` child in the config node tracks which machines have synced and when. Off by default — templates stay local until you set this.
- **Edit Template panel: card-style sections.** The three sections (block list, Add blocks, Copy selected template to) are wrapped in bordered cards for better readability. Block rows have their own card background and border.
- **Edit Template panel: unified chip-based "Add blocks".** Quick blocks and schedule items are merged into one chip control with ⚡ icons, time labels, durations and a "+ Blank" chip. An action bar below has Select all / Deselect all, a date navigator for schedule items, and Add selected.
- **Edit Template panel: granular copy targets.** "Copy Mon to Mon–Fri" is replaced with tappable day chips and an "All" toggle, so you can copy a day's template to any combination of other days.
- **Timeline and pool autoscroll during drag.** Dragging an unscheduled task or quick block near the top or bottom edge of the timeline (or the unscheduled pool) now auto-scrolls smoothly.
- **Weekend column headers match weekdays.** Each weekend day now shows its own full header with open count and estimated time (e.g. "Sat 14   3 open · 2h 30m"), matching the weekday columns. The "Weekend" label is removed.
- **Edit Template panel: consistent row heights.** Time, duration and name fields in each block row are the same height.
- **Edit Template panel: chip labels truncate at 25 characters.** Long block names in the "Add blocks" chips are clipped with an ellipsis instead of stretching the chip.
- **Settings: Inbox and Sync forms hide when set.** Once the Inbox node or the Sync node is configured, the entry fields collapse to a summary line with a Remove button, matching the compact pattern used elsewhere.
- **Hide weekend toggle (5-day view).** Settings → "Hide weekend" appears when the span is set to 5 days. When enabled, the Saturday/Sunday column is hidden even if those days have open tasks. Disabled by default.

### Files changed

| File | Change |
|------|--------|
| `server.js` | `/features` now includes the server's hostname (used as the default server name for sync); version 1.5.1 |
| `index.html` | WorkFlowy template sync, Edit Template panel redesign (cards, unified chips, granular copy, autoscroll); version 1.5.1 |

## 1.5.0 (2026-11-08)

All-day notes no longer need a "WB-Notes" folder. They are plain bullets on the day, marked `!alld`, and the day can also hold checklists.

### Upgrading

Replace `server.js`, `index.html` and `mobile.html`, then **restart the server** and reload the phone page. Nothing is converted: old `WB-Notes` bullets keep showing their lines (after the new notes) until you delete them. An *empty* `WB-Notes` bullet on a past day is removed quietly (only while the Notes switch is on).

### What's new

- **All-day notes are bullets marked `!alld`.** The marker is hidden. Add `!alld1` to `!alld9` to set the order (lowest first; unnumbered notes follow in their place on the day). Desktop: right-click a note → **Order…**. Phone: the **Order** select in the note's edit sheet.
- **Checklists (`!list`).** On the Daily page, the add row's type button has a ☑ **Checklist** choice (type the name, press Enter); on the phone it is **+ Checklist**. Either creates a bullet marked `!list`; the desktop then opens its first item line. Its items are tasks. Checklists are left out of groups, counts and reminders.
- **The Daily page "Add to today" box is removed.** Add lines with the page's own **+ Add a task or line** row (a task there is a day task); Its type button (☐ / • / 1.) gained a ☑ Checklist choice. "Move notes in" and the rename pencil are gone.
- **Server fix:** the reminder and repeating-task scans skipped a hard-coded "WB-Notes". They now follow `NOTES_NAME` (and the legacy "WB-Notes"), and also skip `!list` and `!alld` bullets. `NOTES_NAME` is now only used to read old days.
- **Phone page link boxes start with `https://workflowy.com/#/`** (the unreleased 1.4.2 change).
- **Enter on a task line starts another task** (and on a numbered line another numbered line) in the editable Daily page and the board's outlines; it used to start a bullet. This is what makes a checklist easy to fill in.
- **A task added on the Daily page shows on the board straight away,** including one typed in the outline or added under a group. Typing in a Daily page line no longer holds back the board's redraw. (Lines added inside a checklist never show on the board.)
- **Phone page:** tap the day heading ("Wednesday, Oct 28 · Today ›") to open that day's whole outline in the zoom view: plain bullets, notes, groups, checklists and tasks, with the usual add row. The all-day note button uses the same note icon as the board. Only day notes sit inside the amber band (matching the board); checklist rows appear in their own plain card below, showing the done count ("☑ Packing 2/5 ›") and opening when tapped. Note text is 16px (up from 14px) and task titles are 15px. The add boxes are sized so the Add button can't slip past the right edge, and the checklist add box uses a 16px font so iOS doesn't zoom the page in when you tap it.
- **Day columns have one icon row:** a list-plus icon (Add task), a stack icon (Add group) and a note icon (All-day note). The task and group icons open an entry line beneath the row.
- **`WB-Notes` is retired:** nothing creates it any more (see Upgrading for what happens to old ones).
- The Notes switch (Settings → Features) covers checklists and all-day notes.

## 1.4.1 (2026-11-08)

Time blocking is now plan-then-Save (planned template blocks, Save and Cancel), opens from a right-click, template blocks stay out of the lists, and a new **Features** tab in Settings lets you turn off the features that write into WorkFlowy.

### Upgrading

Replace `server.js`, `index.html` and `mobile.html`, then **restart the server**. The switches are saved by the server in `weekboard-features.json` next to `server.js` (set `FEATURES_STATE` to put the file somewhere else). All four start on, so nothing changes until you turn one off.

### What's new

- **Feature switches (Settings → Features).** Four switches for the features that put things into WorkFlowy:
  - **Time blocking:** the panel, `^9am` times, quick blocks, the Day template and the automatic ticking of finished template blocks.
  - **Repeating tasks:** the server stops making copies of `!every` tasks, even with the board closed. `RECURRING=0` on the server still overrides the switch.
  - **Notes bullets:** creating the notes bullet and new note lines (all-day notes, the Daily page's add box and **Move bullets into notes**, and Notes on the phone page).
  - **Priority, estimate and reminder items:** the menu items that write `!p1`, `~30m` and `@2:30pm`.
  A feature that is off stays visible but greyed out, marked "· off in Settings" in menus with a hint on hover. Nothing already in WorkFlowy is changed, existing markers still show, and you can still type a marker yourself. The switches apply to every browser and to the phone page.
- **Blocks added to a day that doesn't exist yet now show up.** WorkFlowy creates a calendar day when the first thing is written under it, and its list of that new day can lag a moment. **Save** now reads the day again until the new blocks appear, and if the list still lags they show what was just created, so the block is on the timeline and the board straight away.
- **Template blocks are sorted by time.** In **Edit template…** each weekday lists its blocks earliest first, and a block moves to its place when you change its start time.
- **The Day template and quick blocks live on the server.** They used to sit in each browser (and travel only with **Share these settings between browsers**), so a second browser or computer showed an empty editor for a week that was already filled. They are now saved by the server in `weekboard-timeblocks.json` next to `server.js` (set `TIMEBLOCKS_STATE` to move it), and every browser reads the same ones. A browser that already has a template sends it up the first time it connects, if the server has none yet.
- **Start a weekday's template from the day.** In **Edit template…**, a **Use the N blocks on Wed, Oct 28** button copies the time-blocked tasks on the day shown in the panel into the weekday tab you are on (it asks first if that tab already has blocks). The template is separate from the tasks on a day, so an empty editor no longer looks like a mistake: it says so.
- **Time block… opens the panel.** Right-clicking a card and choosing **Time block…** now opens the full time blocking panel on that card's day (it used to open a small popup for that one task). This is also the way in on weekends, when today's 🕐 isn't on the board.
- **Template blocks stay out of Past due and Upcoming.** Blocks created from the template (tagged `!blk`) are left out of both lists, so a filled week doesn't flood Upcoming. Any template block still open on a day that has passed is marked done quietly when Past due loads, and loses its tag. Time-blocked tasks you made yourself still show.

### Files changed

| File | Change |
|------|--------|
| `server.js` | New `/features` switches (saved in `weekboard-features.json`, `FEATURES_STATE`), repeating tasks honour them; new `/timeblocks` store for the Day template, quick blocks, the show-template setting and left-out planned blocks (`weekboard-timeblocks.json`, `TIMEBLOCKS_STATE`); version 1.4.1 |
| `index.html` | Features tab in Settings, greyed-out items, **Time block…** opens the panel, template blocks left out of Past due and Upcoming; version 1.4.1 |
| `mobile.html` | Notes button and all-day note button follow the Notes switch; time blocks show as a chip and template blocks stay out of Past due and Upcoming; version 1.4.1 |
| `README.md`, `CHANGELOG.md` | Updated |

---

## 1.4.0 (2026-11-05)

Two major features: Mobile Notes on the phone page, and Time Blocking on the desktop board.

### Upgrading

1. Replace `server.js`, `index.html`, `mobile.html`, `README.md` and `CHANGELOG.md`.
2. **Restart the server.** The phone page now supports a Notes location setting.

### Mobile Notes (phone page)

Quick notes that sync with WorkFlowy, accessible from the phone page.

- **📝 Notes button** in the extras row (below Past due / Upcoming / Inbox), shown only after you configure a Notes location.
- **Notes location** (Settings): paste a WorkFlowy node link. Notes are stored as children of that node.
- **New note button** creates a note with the default title "Notes · Thu, Nov 5" (short date format, no year).
- **Full-screen editor** with auto-save (1-second debounce). Shows "Saving…" and "Saved ✓" status.
- **Delete via ⋯ menu** with confirmation prompt.
- **Empty notes discarded** if you tap Done without typing anything.
- **Encrypted notes** display as read-only (unlock with the passphrase to view).
- **Settings sync**: the Notes location is shared with your other devices when "Share settings across my devices" is on.

### Time Blocking (desktop board)

Schedule tasks to specific times on today's column.

- **Marker syntax**: Add `^9am`, `^9:30am`, or `^14:00` to a task's text to schedule it.
- **Blue pill badge** in the upper right of scheduled tasks showing "9 AM · 1h" (time + duration from estimate).
- **Green "▶ NOW" badge** when the current time falls within the task's scheduled window.
- **Yellow warning badge** for time conflicts (overlapping tasks).
- **Sorting**: Time-blocked tasks appear first (sorted by time), then unscheduled tasks below (sorted by priority).
- **🕐 button** on today's column header opens the time blocking panel.
- **Timeline panel**: A slide-out panel on the right showing:
  - Unscheduled tasks pool at the top (drag to schedule)
  - 30-minute increment timeline below (8 AM – 6 PM default working hours)
  - Drag a task from the pool to a time slot to schedule it
  - If the task has no estimate, you're prompted for a duration (default 30m)
- **Close** via ✕ button, click outside, or Escape key.

### Fixes after review

- **Notes button on the phone page no longer fails with "data is not iterable".** The note list was read as a plain list; WorkFlowy returns it inside `nodes`. The list is also rebuilt each time it loads, so a note deleted elsewhere drops off.
- **The ⋯ menu in the note editor works.** The editor covered the menu, so Delete note could not be tapped. The editor now sits under the menu.
- **Encrypted notes are recognised and stay read-only.** They were looked for as `[encrypted:` text, but the add-on writes `wbenc1.…`, so an encrypted note could be opened as plain text and overwritten when edited. They now open read-only, decrypted when the passphrase is unlocked.
- **Notes save once, in order.** A slow first save could be followed by a second "create" and make a duplicate note, and leaving the editor during a save could lose the note from the list. Saves now run one after another.
- **Notes save when you leave the page,** not only a second after you stop typing, and opening and closing a note without typing writes nothing.
- **Time-block badge moved to the lower right of the card,** so the hover buttons (Move and ✕) no longer cover it. Cards with a badge get a little extra room at the bottom.
- **Time blocking panel, tidied up.**
  - Cancel on the duration prompt now stops, so nothing is scheduled by accident. An invalid answer asks again, and an empty one schedules with no estimate.
  - Tasks at times like `^9:15am` or before or after working hours (`^7am`) now show in the panel; the grid stretches to include them.
  - Drag a scheduled task to another time to move it (the old `^` time is replaced, not repeated), or press its ✕ to take it off the schedule.
  - The ▶ NOW badge follows the clock every 30 seconds without redrawing the board.
- **Note titles are editable.** Tap the title at the top of the note editor to rename it. It saves with the note (a second after you stop typing, or when you tap Done). The new-note default "Notes · Thu, Nov 5" can be changed before you start. Titles of encrypted notes stay read-only. A title is plain text, so any bold or links in the old title are dropped when you rename.
- **Time blocking works on any day.**
  - The 🕐 panel has a day switcher: ‹ › arrows, a date box and a **Today** button. Open it from today's 🕐 and step to any other day to see that day's schedule and unscheduled tasks, and to drag tasks onto it.
  - Right-click any card and choose **Time block…** to open the panel on that card's day.
  - Time badges, the ⚠ conflict check and time-first sorting now apply on every day. ▶ NOW still shows only on today.
- **Markers are hidden on cards you type in, until you click in.** With **Edit cards in place** on, `!p1`, `~60m` and `^15:00` no longer show in the card's text. Their badges (P1, ⏱ 1h, 3 PM · 1h) show instead, on a line under the text for priority and estimate. Click into the card and the whole text, markers included, comes back for editing, and the badges step aside; leave it and they return. Leaving without a change saves nothing, and an edit keeps the markers unless you delete them. This also applies to tasks inside group cards.
- **A long time block fills its time in the panel.** A task of 1h from 3 PM now fills 3:00 to 4:00 as one block (and a 2h task fills two hours), instead of showing only in its first half hour. Blocks are drawn in half-hour steps, so a task that ends mid-slot fills that last slot.
- **Time blocks on the phone page.** Cards no longer show `^9am` or `!blk` as text. A time-blocked task shows one chip, such as "🕐 9:00 AM · 30m" (the length is its `~` estimate, 30m if none), and template blocks (`!blk`) are left out of Past due and Upcoming, as on the desktop, and time-blocked tasks sort first, earliest first, then by priority, as on the desktop. The panel itself stays desktop-only.
- **Time blocking templates can be added automatically (optional, off by default).** **Settings → Features** (the tab used to be called Writing; its wording now says which features write into WorkFlowy, with examples) has, under the Time blocking switch, a schedule for the server to write the Day template into WorkFlowy by itself: choose **Friday** (prepares next week) or **Monday** (prepares the current week), a time, and how many weeks (1 to 4, default 1), greyed out while Time blocking is off. It skips blocks already on a day and ones you left out, tags what it makes `!blk`, never adds a week twice, and catches up when the server starts if it was off. The panel works as before, and this is separate from it.
- **Time blocking is now plan, then Save.** Open a day and you see its real tasks plus that weekday's template blocks, faded and labelled "Planned:". Drag tasks, resize or edit blocks, drop quick blocks, add a block with **+ New block** (optionally into the template too), or press ✕ to leave a planned block out of that date. Nothing is written to WorkFlowy until you press **Save**, which lists what it will write and asks you to confirm; **Cancel** discards everything, and changing day or closing the panel with unsaved changes asks first. **Show my template on every day** (in the Day template foldout) turns the faded blocks off; it is on by default and kept on the server. **Edit template…** has a tab per weekday (time, length, name, **Copy Wed to Mon–Fri**), and **Save Nov 9–15 to WorkFlowy** writes a whole week's planned blocks at once. Blocks created from the template are tagged `!blk` (hidden like the other markers) and are marked done by themselves once their end time has passed. The template, quick blocks, the show/hide setting and left-out blocks are kept on the server (see below).
- **Plan day lists hide the markers.** The "Bring in" lists, the roll-forward dialog and the undo/confirm labels showed `!p1`, `~30m` and `^9am` as text. They now show the clean title with the P1 and ⏱ badges, as board cards do.
- **Done blocks stay on the timeline.** A checked-off time block remains in the time blocking panel, greyed with a ✓, so the day shows what happened. It can't be dragged or resized, and it still leaves the day's open total.
- **Quick blocks in the time blocking panel.** A new **Quick blocks** strip holds standard items: **Meeting** (30m), **Lunch** (1h) and **Appointment** (1h). Drag one onto the timeline and it asks how long (the usual length is filled in; Cancel adds nothing; an empty answer takes the usual length), then adds a task such as `Lunch ^12:00 ~45m` on the day the panel is showing. **+ New** adds your own (a name and a usual length), and ✕ on a chip removes it. The list is kept in the browser and shared with your other browsers when **Share these settings between browsers** is on (`tbPresets` is on the shared-settings list in `server.js` and `index.html`). **Restart the server** for the sharing.
- **Edit a time block from the panel.**
  - **Click a block** to open a small editor at the bottom of the panel: the start time (to the minute), the length (15-minute steps) and the **description**, which is the task's WorkFlowy note. **Save**, **Unschedule** and **Cancel**; Undo works. Saving a description alone leaves the time as it was; an encrypted note shows as read-only. Esc closes the editor first, then the panel.
  - **Drag a block's bottom edge** to change its length in 15-minute steps. A tip shows the new length and end time while you drag.
  - **The first line of a task's note shows under its title** on the block.
- **Week arrows moved to the header.** The ← This week → buttons are gone from the sidebar. The arrows now sit on either side of the date range at the top of the page, and clicking the date range (now a link) goes back to the current week.
- **The label in the desktop page's lower right** read "v1.3.9". It now follows the page's version, so it can't go stale.

### Files changed

| File | Change |
|------|--------|
| `server.js` | `cleanMobileSettings` now validates `notesLoc` for notes location; version 1.4.0 |
| `index.html` | Time blocking: marker parsing, badges, conflict detection, sorting, timeline panel; version 1.4.0 |
| `mobile.html` | Mobile Notes: notes location setting, notes button, notes list, full-screen editor with auto-save; version 1.4.0 |
| `README.md`, `CHANGELOG.md` | Updated |

---

## 1.3.9 (2026-11-06)

Priorities and estimates everywhere you see tasks, dates inside tasks in saved filters, tidier card buttons and popups, a dated today button on the phone, accessibility labels throughout, and the app icons.

### Upgrading

1. Replace `server.js`, `index.html`, `mobile.html`, `README.md` and `CHANGELOG.md`.
2. Add `icon-180.png`, `icon-192.png` and `icon-512.png` next to `server.js`, if you don't have them yet.
3. **Restart the server.** Saved filters, the phone page's settings and the phone page itself changed on the server side.

### Priorities and estimates on the phone page

- Tasks with `!p1`–`!p4` get a coloured left edge and a **P1**–**P4** badge. Tasks with `~45m` get a **⏱ 45m** badge. The markers are hidden from the task's text, as on the desktop board.
- **Sort by priority** (⋯ > Settings, on by default) lists urgent first and low last in each day, and within each day of Past due and Upcoming. A group sorts by its most urgent open task. The Inbox keeps its outline order.
- The setting is shared with your other devices when **Share settings across my devices** is on.

### Priorities and estimates in Panes, the Daily page and the item window

- Lines and cards with a priority get the same coloured edge. On outline lines, the edge sits next to the text at the line's own indent.
- In read mode, the markers are hidden and shown as **P1**–**P4** and **⏱** badges. In typing mode the markers stay in the text, so you can edit them, and the edge still shows.
- A Panes card that has a card colour keeps its colour stripe, and its priority shows as the badge.

### Saved filters: dates inside tasks

- A task that contains a WorkFlowy date (a date or date-and-time you inserted in WorkFlowy) is now due on **that date**. Otherwise it's due on the calendar day it sits on, as before.
  - A task sitting on today but dated next Tuesday shows under `due:nextweek`, not `due:today`.
  - A task outside the calendar with a date now counts for `due:` words, and is no longer `due:none`.
- Results outside a `due:` range now show their day as well, so a plain `p:1` filter shows each task's date and sorts by it.

### Accessibility

A scan of every control on the desktop and phone pages found five without a name that screen readers could announce. All five now have one:
- the task checkboxes on board cards, group cards, sub-item lists, the Daily page and Panes ("Done")
- the text box on cards you type in ("Task")
- the week arrows ← → ("Previous week", "Next week", with a tooltip)
- the date in Move tasks (now labelled "Move to")

A second scan found 36 desktop controls named only by their tooltip, which some screen readers don't read: refresh, the sidebar and Daily page buttons, the ✕ on every window, the outline line buttons (+ − < > ▾), the card's Move and Delete, the Panes column header buttons, the day and month arrows, and the ↗ links in report windows. Each now has a proper label, set where it's created and kept in step when its tooltip changes (Hide/Show the sidebar, Expand/Collapse). The phone page already had them. No runtime cost.

### Fixes

- **Priority and estimate changes work on formatted text.** A `!pN` or `~Nm` marker inside bold or italic, or after a non-breaking space, is now replaced when you set a new priority or estimate. Before, the old marker kept winning and a second one was added.
- **Saved filters work while WorkFlowy refuses the calendar lookup.** Every filter run now asks once for the calendar page (to show each result's day). A refusal such as a 429 used to fail the whole filter; now the results are listed without days, and only `due:` filters report the error.
- **The three reports open at one size.** Completed tasks, Saved filters and Encrypted items are 700 px wide and up to 700 px tall on the desktop page. The phone and narrow windows still fill the screen.
- **Phone page Sign out only shows in the hosted modes** (`vps`, `fly`), like the desktop page. In local mode there is no sign-in, and tapping it used to wipe the phone page's settings and land on a "not found" page. The server now tells the phone page which mode it runs in.
- **Phone today button shows the date.** The ⌂ in the phone page's header is now a small desk calendar: today's month over the day number (for example NOV / 5), same size as before. It updates itself just after midnight (one timer a day, no polling), and screen readers announce "Go to today, Thursday, November 5".
- **Reminder popup buttons on one line.** The bottom of the 🔔 popup is now a single row: **Save alerts** (Save early alerts only), **Remove** (when the task has a time) and a new **Cancel**, like the Repeat and Move popups.
- **Repeat popup shows only what applies.** The Mon–Sun boxes appear only for "Chosen weekdays…", and the ending options are hidden for "Does not repeat". Before, the weekday boxes always showed.
- **Fewer buttons on cards.** Hovering a week-board card now shows only **Move to a date** and **✕**. Reminder and Repeat moved to the right-click menu. Cards with "Edit cards in place" off now have a right-click menu too: Mark done, Set a reminder… (or Change the reminder…) and Repeat….
- **Set a reminder from the right-click menu.** Right-clicking a card you're editing now offers **Set a reminder…**, or **Change the reminder…** when the task already has a time. It opens the same popup as the 🔔 button, starting at the task's current time, and saves anything you've just typed first. In the same menu, the Estimate row is now 15m, 30m, 45m, 1h, 2h and 3h (1h30m is gone), so it fits on one line. When a task has no priority or no estimate, the ✕ shows as a subtle outline rather than a solid button.
- **"All done 🎉" is back,** on both pages. An empty day (and an empty weekend section or Plan day) says "All done 🎉" on the desktop board too, so the two pages match the other way round from 1.3.8.
- **App icons** (`icon-180.png`, `icon-192.png`, `icon-512.png`) are included, so installing the phone page as an app shows the icon. Browsers had logged an error for each missing icon.

### Files changed

| File | Change |
|------|--------|
| `server.js` | Dates inside tasks for `due:`, each result's day, the phone page's mode, the `prioSort` phone setting; version 1.3.9 |
| `index.html` | Priority edges and badges in Panes, the Daily page and the item window; card hover buttons (Move and ✕ only) and right-click menus; Reminder and Repeat popup fixes; "All done 🎉"; labels; version 1.3.9 |
| `mobile.html` | Priority and estimate badges, edges and sorting; Sort by priority setting; Sign out only when hosted; the dated today button with its midnight refresh; "All done 🎉"; version 1.3.9 |
| `icon-180.png`, `icon-192.png`, `icon-512.png` | Added |
| `tests/` | Added: the test suites (`verify*.js`, `syntax.js`, `a11y-scan.js`), `run-all.js` to run them all, and a short `README.md` |
| `README.md`, `CHANGELOG.md` | Updated |

### Tested

All against a stand-in WorkFlowy:

| Area | Checks |
|---|---|
| Saved filters, including the new date rule (dated tasks inside and outside the calendar, a task on today dated next week, `due:any` and `due:none`) | 29 |
| Phone page and desktop views in headless Edge (sort on and off, badges, edges, read and typing modes, the shared setting) | 12 |
| Sign out hidden in local mode, shown when hosted | 3 |
| Accessibility scan of both pages across 15 views and menus | no unnamed controls, and no controls named only by a tooltip |
| Card buttons, right-click menus, Reminder and Repeat popups, phone today button (including a faked-clock midnight flip) | checked on screen with screenshots; reviewed by Vera |

The 1.3.8 suites were rerun and still pass (see Tested under 1.3.8).

## 1.3.8 (2026-11-05)

Priorities, time estimates and saved filters, plus fixes from a code review and from a security and UI-consistency review.

### Upgrading

1. Replace `server.js`, `index.html`, `mobile.html` and `README.md`, and add `.gitignore`.
2. **Restart the server.** It has a new route, `/filter`.

Nothing else is needed. There are no new server settings, and existing settings files, card colours and sign-in sessions work as before (sessions still end at a restart, as always).

Two new browser settings come with the features below:
- **Sort by priority** is on by default. Tasks without a priority marker keep their outline order, so nothing moves until you add markers.
- **Plan day hours** is off (0) by default, which keeps the existing task-count meter.

### New: priorities

- Put `!p1` (urgent), `!p2` (high), `!p3` (medium) or `!p4` (low) in a task's text. A task with none is normal.
- Right-click a card: the **Priority** row sets one, or clears it if you click the current one again. Undo works.
- Cards get a coloured left edge: red, orange, blue or grey. With **Edit cards in place** off, the marker is hidden and a **P1**–**P4** badge shows instead.
- **Settings > Week board > Sort by priority** (on by default) shows urgent first, then high, medium, normal and low.
  - Within each level, outline order is kept.
  - A group card sorts by its most urgent open task.
  - Off gives the plain outline order.

### New: time estimates

- Put `~15m`, `~45m`, `~1h`, `~1h30m` or `~1.5h` in a task's text, or use the **Estimate** row in the card's right-click menu. Undo works.
- Each day's header shows the open time estimated, for example "4 open · 2h 15m". Hovering over it says how many open tasks have no estimate.
- **Settings > Plan day > Plan day hours**: set the hours you have for tasks, and the Plan day meter adds up estimates instead of counting tasks ("5h 30m of 6h planned").
  - The meter turns amber at 90% and red when over, and notes how many tasks have no estimate.
  - 0 keeps the task-count limit.
- The Add task box keeps markers after date words: `Call Bob fri !p1 ~30m` goes to Friday as "Call Bob !p1 ~30m".
- Push reminders leave the priority and estimate markers out of the message.

### New: saved filters

- **Reports > Saved filters** searches your whole outline (the same server copy as Search) and lists matching tasks with their priority, estimate, day and path. A footer totals the estimated time.
  - Tick a task to complete it.
  - Click a task to open it in the item window.
  - **↗** opens it in WorkFlowy.
- **Filter words** (the **?** button in the window lists them):
  - Ordinary words, `"phrases"` and `-words`; `#tag` and `@person` match whole words.
  - `p:1`, `p:1-2`, `p:none`, `p:any`
  - `due:today`, `tomorrow`, `overdue` (last 60 days), `week`, `nextweek`, `lastweek`, `7d`, `2026-11-04`, `2026-11-01..2026-11-15`, `none`, `any`
  - `est:none`, `est:any`, `est:<30m`, `est:>=1h`
  - `is:open` (the default), `is:done`, `is:any`, and `is:all` to include bullets as well as tasks
  - `under:"Project Alpha"`, `-under:Archive`
- One filter may hold up to 50 words. A date range may cover up to 120 days. Up to 500 results are listed.
- **Save…** names the current filter. Saved filters are kept in the browser, and shared when **Share these settings between browsers** is on. Four starters are included: Urgent and high, Overdue, This week, and This week with no estimate.
- **How dates are found:** WorkFlowy's API turns `2026-11` into the real calendar month node.
  - The server asks once per month and remembers the answer, then reads each day page's date from WorkFlowy's own date tag in its name.
  - It checks one day against the API before trusting the names. If the names can't be read, it asks WorkFlowy about each day instead, which is slower the first time.
  - Checked read-only on a real account (2,355 items, 58 day pages): `due:today`, `week`, `nextweek`, `overdue`, `none` and `any` all matched WorkFlowy's own day-by-day lookup exactly.

### Fixes from the code review

**Counted repeating tasks could repeat forever** (medium)
The `!every … xN` marker is read from the task's plain text, but the copy is made from the stored text, which can hold formatting. When the marker was bold, split by formatting (`<b>!every week</b> x3`) or came after a non-breaking space, the counter wasn't found and the copy kept the same `xN`, so the series never ended.
- The server now finds and lowers the counter in the stored text too.
- If it still can't find the counter, it makes no copy and logs `Repeating task <id>: couldn't find its xN counter…`.
- Repeats without a counter, and repeats ending on an `until` date, were never affected.

**Repeated outline downloads while WorkFlowy is rate-limiting** (low)
The one-minute gap between full-outline downloads was measured from the last *successful* download. After a refused (429) download, every search once the copy was over 5 minutes old asked WorkFlowy again and waited for that to fail. The gap now counts every attempt.

**`ASSUME_HTTPS=1` was honoured on Fly** (low, hosted modes)
`ASSUME_HTTPS` is meant only for a proxy on the same machine, but it checked `HOST` before the Fly default (`0.0.0.0`) was applied. It now checks the address the server actually listens on. Fly's own proxy always uses HTTPS, so this was a trap for a misconfiguration rather than an open hole.

**Failed sign-in records were not cleaned up** (low, hosted modes)
Addresses with 1 to 4 wrong passwords were never removed. Once the list passed 5,000 entries, the whole list was cleared, *including active lockouts*, which a guesser using many addresses could trigger on purpose.
- A record is now dropped once its last wrong password is more than 15 minutes old. Active lockouts are always kept.
- Old wrong passwords no longer count toward a new lockout.
- The "clear everything at 5,000" step is gone.
- The lockout itself is unchanged: 5 wrong passwords lock an address out for 15 minutes.

**Shared settings and card colours could lose a change** (very low)
`/d/settings`, `/m/settings` and `/colors` read their file, waited for the request body, then wrote, so two saves arriving together could overwrite each other. The file is now read after the body has arrived, so the read, merge and write happen in one uninterrupted step.

**Proxied API responses kept WorkFlowy's content type** (very low)
Responses passed through `/api/v1/...` copied WorkFlowy's `Content-Type`, so an HTML error page from upstream would have been served as a page from the board's own address. They're now always sent as `application/json`.

### Fixes from the security and UI-consistency review

- **Saved filters** are capped at 50 words, as noted above. Thousands of `#tag` words could otherwise keep the server busy for seconds.
- **Phone page Sign out** now clears the browser's storage, like the desktop page, so no Inbox, settings or names stay on a shared phone.
- **ntfy warning** in the README now says plainly that ntfy.sh topics are public, and points to `NTFY_TOKEN` or your own ntfy server for privacy.
- **Keyboard focus:** the Completed tasks, Encrypted items and Saved filters windows move focus into the window when it opens, and back to the Reports button when it closes.
- **Colours:**
  - Priority edges and badges, and the warning colours (meter over or near its limit, late badges, delete buttons, the update link, error text), now come from the theme, with lighter versions in dark mode.
  - The P1–P3 badges have at least 4.5:1 text contrast in both themes. P2 was 3.1:1.
  - Every priority edge stands out at least 3:1 from its card.
  - In dark mode, the browser's own controls (number and date boxes, drop-down lists, spin arrows and scrollbars) are drawn dark too. They used to stay white in Settings, Completed tasks, Saved filters and Move tasks.
  - The number boxes in Settings are all the same width (Plan day hours was wider than Plan day limit).
- **Phone page wording:** "Show completed" (it said "Show done" in one place and "Show completed tasks" in another), and "All done" without the 🎉, matching the desktop page.

### Added

- **`.gitignore`** keeps these out of git:
  - `envset.cmd` and `.env` files
  - the runtime files `desktop-settings.json`, `mobile-settings.json` and `card-colors.json`
  - backups (`*.bak*`), `.tmp/` and `node_modules/`
  - `.cursor/`, which can hold editor and staff access tokens
- **`CHANGELOG.md`**: this file.

### Not covered yet

- The phone page shows the priority and estimate markers as plain text, with no badges or sorting.
- The Panes, the Daily page and the item window don't show priority colours or badges.
- Date filters see the calendar day a task sits on, not a WorkFlowy date tag inside the task.

### Files changed

| File | Change |
|------|--------|
| `server.js` | Review fixes; priority and estimate markers; calendar lookups; `/filter` with its limits; markers left out of push reminders; version 1.3.8 |
| `index.html` | Priorities, estimates, Plan day hours, the Saved filters window, focus handling, theme colours; version 1.3.8 |
| `mobile.html` | Sign out clears storage; "Show completed" wording; version 1.3.8 |
| `README.md` | What's new, usage for the new features, ntfy warning, phone wording |
| `.gitignore`, `CHANGELOG.md` | New |

The new browser settings `prioSort`, `planHours` and `filters` are on the shared-settings list in both `server.js` and `index.html`.

### Tested

Everything was tested against a stand-in WorkFlowy server, and the `due:` filters were also checked read-only on a real account. 138 checks passed:

| Area | Checks | What they covered |
|---|---|---|
| Review fixes | 18 | Repeat counter in plain, bold and `&nbsp;` text; saves arriving at the same moment; rate limiting; HTTPS on Fly and behind a same-machine proxy; sign-in lockout; proxy content type |
| Filters and helpers | 27 | Marker reading and writing; Add-box date words with markers; every filter word and its errors; month lookups cached; unreadable day names falling back to per-day lookups |
| Board in headless Edge | 17 | Sort order; colour classes; day totals; the right-click Priority and Estimate rows saving and undoing; plain-card badges; the Plan day hours meter; the Saved filters window |
| Review fixes in Edge | 22 | 50-word cap; badge contrast in both themes; edge contrast in both themes; focus in and back for three windows; phone wording; no script errors |
| Real account, read-only | 6 | `due:today`, `week`, `nextweek`, `overdue`, `none` and `any` matched WorkFlowy's own lookup |
| Crypt add-on | 48 | Its own test suite, unaffected |
