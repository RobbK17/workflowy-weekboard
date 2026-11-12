# Workflowy Week Board

A kanban-style week view for your WorkFlowy todos. Each day is a column, and everything you do on the board (add, check off, edit, move, delete) is saved straight back to WorkFlowy through its API.

<img width="1750" height="918" alt="Workflowy Week Board" src="https://github.com/user-attachments/assets/44ea2b16-ffdd-4d0f-b279-2f1305ac4577" />

**Version 1.5.4**

### What's new in 1.5.4

Replace `server.js`, `index.html` and `mobile.html`, add the new `addons/markdown/` folder, then restart the server.

- **Markdown notes (optional add-on).** The Notes window and the phone's note editor get a **format bar** (bold, italic, code, link, heading, lists, tasks, quote, code block, rule) and an **Edit / Preview** switch. Notes open in Edit; Preview is read-only. It also works on the phone. See "Markdown notes (optional add-on)".
- **Plain notes list.** The one-line previews in the notes list leave out the Markdown marks. Your text and Search are unchanged.
- **Settings on the server.** **Settings > Markdown** (on / off, open in Edit or Preview, format bar, shortcuts, plain notes list) is kept by the server, so the desktop and the phone agree.
- **Works with encryption.** Text inside `⟦ ⟧` is never formatted, the format bar stays out of it, and the preview is cleared when a note locks or closes.
- **For add-on authors:** manifests can add `shared`, `mobileScript` and `mobileCss`, so add-ons can now run on the phone page, and the note editors on both pages have `wbNotes` hooks.
- **Version label.** The pages now show the version of the running `server.js`.

### What's new in 1.5.3

Replace `server.js`, `index.html` and `mobile.html`, then restart the server.

- **Time block from the phone.** **🕐 Time block…** in a task's menu on the phone page sets a start time and length, using the same markers as the desktop panel, so the block shows on the board's timeline too. **Remove time block** takes it off again. See "Using it on a phone or tablet".
- **Hide estimates on the phone.** **⋯ > Settings > Hide estimates** leaves the ⏱ chip off tasks, and is shared with your other devices when **Share settings across my devices** is on.
- **Time block badges match the desktop.** On the phone a time block is now the desktop's badge, at the right of the task's first line instead of a grey chip on a line of its own: blue with the time and length, green **▶ NOW** while today's block runs, yellow **⚠** when two blocks on a day overlap, faded once done.
- **Encrypt words in a phone note.** In the phone page's note editor, select words and tap the new **Encrypt** button. They are encrypted with your Encryption passphrase before the note is saved, in the same format as the desktop add-on. A note with encrypted text can now be edited: unlocked, each encrypted part shows as ⟦readable⟧ text. See "On the phone page (1.5.3): Encrypting words in a note".
- **Select from the card.** Hover a card on the week board: its hover bar is now **[select] [📅] [✕]**, where select is a circle with a check. Click it to select that card and start selecting, with the usual bar (Move to…, Complete, Delete). A group has the same button on its top edge. While selecting, each card's checkbox (a group's fold arrow) becomes a round marker: empty, or blue with a tick when picked. The ☑ Selector button is gone, so the Daily page's row (Inbox, Notes, Reports) fits, and it wraps instead of running off a narrow column.
- **Notes window on the desktop.** **📝 Notes** right of **📥 Inbox** (or the **N** key) opens your notes in a window like the phone's notes, side by side: the list on the left (title, two-line preview, a lock on notes with encrypted text, **+ New note**, and a search box), the open note on the right (title, text, saves a second after you stop typing). With the Encrypt add-on you can encrypt words in a note, as on the phone. See "Notes window (desktop)".
- **Stronger sign-in password check.** `BOARD_PASSWORD` is now checked with scrypt instead of a single SHA-256. Your current password keeps working. You can also store a hash instead of the password itself; see `BOARD_PASSWORD` under "Settings".

### What's new in 1.5.2

Replace `server.js`, `index.html` and `mobile.html`, then restart the server.

- **Reminder and repeat badges on live cards.** The 🔔 bell and 🔁 repeat badges now appear on live-edit cards (they were previously hidden in live mode).
- **All markers hidden everywhere.** `@time` markers (`@9am`, `@09:00`, `@14:30`) and early-alert markers (`!1d`, `!1h`, `!1w`) are now stripped from every display context — timeline blocks, sidebar, editor titles — not just cards, including when they sit inside bold or italic text.
- **Hide estimates on cards.** A new **Settings → Hide estimates on cards** toggle removes the ⏱ badge from cards while keeping estimates in column totals and time blocking. It is shared by **Share these settings between browsers**, as is **Hide weekend**.
- **Columns line up.** Every column's day name, icon row and first card start at the same height, the weekend column included, and the first card's hover buttons have room above it.
- **Time blocking clock in the icon row.** Today's time blocking button is now a clock icon at the right end of today's icon row (next to Add task and Note), so the day name and counts keep their full width.
- **Sign-in lockout tightened.** Wrong passwords sent at the same moment now each count toward the 5-try lockout.
- **Gentler on WorkFlowy's export limit.** When the server has no outline copy yet and a download just failed, it waits out the minute instead of asking again on every search.
- **Plan Day "Bring in" scrolls.** The Bring in column now scrolls properly when it has more items than fit on screen.
- **Past due hidden when empty.** The "Past due" header in Bring in is hidden when there are no past-due tasks.
- **Security and code review minor fixes.** See the 1.5.2 entry in CHANGELOG.md.

### What's new in 1.5.1

Replace `server.js` and `index.html`, then **restart the server** and reload.

- **Sync templates across machines via WorkFlowy.** If you run local mode on more than one computer, day templates and quick blocks can now be stored in a WorkFlowy node so every machine shares the same set. See [Sharing templates across machines](#sharing-templates-across-machines) below.
- **Edit Template panel redesigned.** Block rows, "Add blocks" chips and "Copy selected template to" day chips each sit in their own bordered card for readability. Quick blocks and schedule items are merged into one chip bar, copy targets are individual day chips instead of the old "Copy Mon to Mon–Fri", row heights are consistent, and long chip labels truncate at 25 characters.
- **Weekend column headers match weekdays.** Each weekend day shows its own full header with open count and estimated time, matching the weekday columns. The "Weekend" label is removed.

### What's new in 1.5.0

Replace `server.js`, `index.html` and `mobile.html`, then **restart the server** and reload the phone page.

- **The `WB-Notes` bullet is retired.** Nothing creates it any more, and there is no setting, rename or "Move notes in" for it. New all-day notes are plain bullets on the day marked `!alld` (hidden; `!alld1` to `!alld9` set the order, lowest first). Old `WB-Notes` bullets are **not converted**: their lines keep showing after the new notes until you delete them yourself, and an *empty* `WB-Notes` bullet on a past day is removed quietly (only while the Notes switch is on). `NOTES_NAME` is now only used to read old days.
- **Checklists.** `!list` marks a bullet whose items are tasks. On the Daily page, click the type button beside **+ Add a task or line** until it shows ☑ (Checklist), type the name and press Enter: the first item line opens. On the phone use **+ Checklist** on the phone (it opens the new checklist so you can add items). Checklists, `!alld` notes and old `WB-Notes` bullets are never counted as groups, tasks or reminders.
- **The Daily page's "Add to today" box is gone.** Add lines in the page itself with its **+ Add a task or line** row (or Enter on the last line); a task there is a day task and a pasted list goes in nested. Its type button (☐ / • / 1.) gained a ☑ **Checklist** choice. No notes folder is involved.
- **Day columns have one icon row:** a list-plus icon (**Add task**), a stack icon (**Add group**, Nested set to Group) and a note icon (**Add an all-day note**). Click the task or group icon and an entry line opens beneath the row (focused; Enter adds and keeps it open for the next one, Esc closes it). The note icon opens a note line in the day's notes box.
- **Server fix:** the reminder and repeating-task scans no longer have a hard-coded `WB-Notes`; they follow `NOTES_NAME` and also skip `!list` and `!alld`.
- Icons are from Phosphor Icons (MIT licence, phosphoricons.com).
- **Phone page:** tap the day heading to open the day's whole outline (bullets, notes, groups, checklists and tasks) in the zoom view.
- **Phone page link boxes** start with `https://workflowy.com/#/`.

### What's new in 1.4.1

Replace `server.js`, `index.html` and `mobile.html`, then **restart the server**.

- **Feature switches.** **Settings → Features** has four switches for the features that write into WorkFlowy: **Time blocking**, **Repeating tasks**, **Notes bullets** and **Priority, estimate and reminder items**. All start on. A feature that is off stays visible but greyed out ("· off in Settings" in menus, a hint on hover). See "Writing features" below.
- **Time block… opens the panel.** Right-click a card and choose **Time block…** to open the time blocking panel on that card's day. This is also the way in on a weekend, when today's 🕐 isn't on the board.
- **Template blocks stay out of Past due and Upcoming,** and any left open on a past day are ticked quietly when Past due loads.

### What's new in 1.4.0

Replace `server.js`, `index.html` and `mobile.html`, then **restart the server** (the phone page's Notes location, the quick blocks list and the day template are shared through it). Full details are in `CHANGELOG.md`.

- **Time blocking (desktop).** Put a start time in a task with `^9am`, `^9:30am` or `^14:00`, and its length comes from its `~` estimate (30m if it has none). A blue badge on the card shows the time and length ("3 PM · 1h"), a green **▶ NOW** shows while the clock is inside it, and a yellow **⚠** warns when two blocks overlap. On each day, blocked tasks list first, by time. The clock icon at the right end of today's icon row (🕐 before 1.5.2) opens the time blocking panel. See "Time blocking" below.
- **Time block any day.** The panel has ‹ › arrows, a date box and a **Today** button, so you can plan Monday on Friday afternoon. Right-click any card and choose **Time block…** to open the panel on that card's day, which also works when today's 🕐 isn't on the board (weekends).
- **Quick blocks.** Drag **Meeting**, **Lunch** or **Appointment** (or ones you add yourself) onto the timeline. It asks how long, then adds the task on that day.
- **Edit a block in the panel.** Click it to change its start to the minute, its length and its description (the task's WorkFlowy note). Drag its bottom edge to change the length. A block fills its whole length on the timeline, and a task's first note line shows under its title.
- **Markers stay out of the way on cards.** With **Edit cards in place** on, `!p1`, `~60m` and `^15:00` are hidden while you aren't editing, and show as badges instead. Click into a card and the full text comes back; leave it and they hide again. Nothing is saved from a card you only looked at.
- **Notes on the phone page.** Paste a WorkFlowy node link in **⋯ > Settings > Notes location**, and a **📝 Notes** button appears under Past due / Upcoming / Inbox. Each note is a child of that node, with a full-screen editor that saves as you type, a title you can rename, and **Delete** in its ⋯ menu. Encrypted notes open read-only. The location is shared with your other devices when **Share settings across my devices** is on. See "Using it on a phone or tablet".
- **Week arrows moved to the header.** The ← This week → row is gone from the sidebar. The arrows now sit on either side of the date range at the top of the page, and clicking the range goes back to the current week.
- **Quieter fixes.** The version label in the lower right of the board now follows the page's version (it still said 1.3.9). Saved filters keep working when WorkFlowy refuses the calendar lookup, and only `due:` filters report it. Changing a priority or estimate works when the marker is in bold or after a non-breaking space. The three reports open at one size.

### What's new in 1.3.9

Replace `server.js`, `index.html` and `mobile.html`, add the three `icon-*.png` files if you don't have them, then **restart the server** (saved filters, the phone page's settings and the phone page itself changed on the server side). Full details are in `CHANGELOG.md`.

- **Priorities and estimates on the phone page.** Tasks with `!p1`–`!p4` get a coloured left edge and a **P1**–**P4** badge, and tasks with `~45m` get a **⏱ 45m** badge. The markers themselves are hidden from the text, as on the desktop board. **Sort by priority** (⋯ > Settings, on by default) lists urgent first in each day, and within each day of Past due and Upcoming. The setting is shared with your other devices when **Share settings across my devices** is on.
- **Priorities in Panes, the Daily page and the item window.** Lines and cards get the same coloured edge, and in read mode the same badges. While you type in a line the markers stay in the text so you can change them. A Panes card with a card colour keeps its stripe and shows the priority as a badge.
- **Saved filters understand dates inside tasks.** A task that contains a WorkFlowy date is now due on that date, wherever it sits. A task on today but dated next Tuesday shows under `due:nextweek`, and a dated task outside the calendar no longer counts as `due:none`. Results also show each task's day, so a plain `p:1` filter lists the dates and sorts by them.
- **Changing a priority or estimate works on formatted text.** A marker inside bold or italic, or after a non-breaking space (`<b>!p1</b>`), is now replaced when you pick a new priority or estimate. Before, the old marker kept winning and a second one was added.
- **Tidier cards.** Hovering a card now shows just **Move to a date** and **✕**. **Set a reminder…** (or **Change the reminder…**) and **Repeat…** are in the right-click menu, which also exists now on cards with "Edit cards in place" off. The Estimate row there is 15m, 30m, 45m, 1h, 2h, 3h.
- **Reminder and Repeat popups are simpler.** The reminder popup ends in one row: **Save alerts**, **Remove** (when the task has a time) and a new **Cancel**. The Repeat popup shows the Mon–Sun boxes only for "Chosen weekdays…", and hides the ending options for "Does not repeat".
- **The three reports open at one size** on the desktop page: Completed tasks, Saved filters and Encrypted items are all 700 px wide and up to 700 px tall, so a long report scrolls inside the window instead of changing its shape.
- **The phone's today button shows the date** (for example NOV / 5) in place of ⌂, and turns over just after midnight by itself.
- **"All done 🎉" is back** on empty days, on both pages.
- **Sign out only where there's a sign-in.** In local mode the phone page no longer shows it. Before, tapping it wiped the page's settings and landed on a "not found" page.
- **Better for screen readers.** Every checkbox, text box, arrow and ✕ on both pages now has a name that a screen reader can announce.
- **App icons included,** so installing the phone page as an app shows the board's icon.

### What's new in 1.3.8

Replace `server.js`, `index.html` and `mobile.html`, then **restart the server** (it has a new `/filter` route). Full details are in `CHANGELOG.md`.

- **Priorities.** Put `!p1` (urgent), `!p2` (high), `!p3` (medium) or `!p4` (low) in a task, or right-click a card and pick one. Cards get a coloured edge, and **Sort by priority** (on by default) puts urgent work at the top of each day. See "Priorities, time estimates and saved filters" below.
- **Time estimates.** Put `~30m` or `~1h30m` in a task, or pick one from the right-click menu. Each day's header shows the time estimated ("4 open · 2h 15m"). Set **Plan day hours** and the Plan day meter measures time instead of counting tasks.
- **Saved filters.** **Reports > Saved filters** finds tasks anywhere in your outline by priority, date, estimate or words, for example `p:1-2 due:week #work`, and totals their estimated time. Save the ones you use; four starters are included.
- **Counted repeats stop when they should.** A repeat like `!every week x3` now counts down even when the marker is bold or otherwise formatted. Before, such a series could go on making copies forever.
- **Fewer wasted calls when WorkFlowy is busy.** After WorkFlowy refuses an outline download, search keeps using its copy and waits a minute before asking again.
- **Hosted-mode hardening.**
  - `ASSUME_HTTPS=1` is now ignored on Fly, as intended.
  - Old failed sign-ins are cleared properly, and a flood of sign-in attempts from many addresses can no longer reset the lockouts.
  - The phone page's **Sign out** now clears the browser's storage, like the desktop page.
- **Shared settings and card colours** no longer lose a change when two saves arrive at the same moment.
- **Easier to use with a keyboard and in dark mode.** The report windows put the keyboard focus inside when they open and return it when they close. Priority and warning colours have dark-mode versions and readable contrast.
- **Consistent wording.** The phone page says "Show completed", like the desktop page.
- **A `.gitignore`** keeps your settings files and any local secrets script out of git.

### What's new in 1.3.7

- **Repeating tasks.** Right-click a card and choose **Repeat…**. Pick every day, every weekday (Mon–Fri), every week, every 2 weeks, chosen weekdays (for example Mon, Wed, Fri), every month (same date or last day) or every year, and optionally an end date or a number of times. The server makes the next copy ahead of time, counted from the due date; if that date has already passed, it lands on the next date still ahead. See "Repeating tasks" below.
- **Undo for deletes.** Deleting a card, a line, a Daily page item or an all-day note shows a toast with **Undo**. It puts the item back with everything inside it, in its old place.
- **Save check.** Before a card or note is saved, the board checks that it hasn't been changed in WorkFlowy (or another tab) since you opened it. If it has, you choose: **OK** replaces it with your version, **Cancel** keeps the WorkFlowy version.
- **Unsaved status and leave-page warning.** Cards, notes, all-day notes and table cells show **Unsaved…** while a change waits to be saved (in the Daily page's save indicator, or a small pill at the bottom left), then **Saved ✓**. Closing or reloading the tab with a change waiting shows the browser's warning.
- **Tags and people are clickable.** `#tag` and `@person` in a card show with a grey underline, like in WorkFlowy, and a click searches your outline for that word. In a card you are editing, a click on a tag just places the cursor. `@2:30pm` and `@9` are reminder times, not people. WorkFlowy's API stores tags and mentions as plain text in the task, so nothing extra is saved.
- **Share settings between browsers.** **Settings > Week board > Share these settings between browsers** keeps your layout and options (columns, views, week start, all-day notes, panels and so on) on the server, so every browser with it switched on shows the same ones. A browser picks up changes when you return to its tab; turning it on in a second browser asks whether to use the shared settings or replace them. Window sizes and what is folded open stay per browser. It is a separate file from the phone's shared settings, and `MOBILE_SYNC=off` switches both off.
- **Phone page parity.** All-day notes, early-alert checkboxes, Repeat…, clickable tags and a Search screen (see "Using it on a phone or tablet").
- **Two tabs stay in step.** When you change something in one tab, the other refreshes by itself once you stop typing in it.
- **Tables** show as tables (with *Show as outline* and back), **Move to a day…** in the right-click menu, **early reminders** (`!1h`, `!1d`, `!1w`), a **weekend column** in the 5-day view, a **week start** choice (Monday or Sunday) for 7 days, **all-day notes** on each day, and the right-click menu on cards in the week board. Menus no longer show key hints, and the error bar has a **Dismiss** button.

### What's new in 1.3.6

- **A readable message when WorkFlowy is busy.** If WorkFlowy answers "Rate limit exceeded", the board now says "WorkFlowy is busy: too many requests at once. Wait about 4 seconds and try again." instead of showing the raw error.
- **Panes stays open after a reload.** Like Plan day, Panes is remembered for the browser tab, so reloading the page (or pulling to refresh) comes back to it. Closing it with **Week board** or **Esc** returns to the normal board on the next reload.
- **Plan day has the Week board button and title.** The Plan day view now starts with the same bar as Panes: a **← Week board** button on the left and the title **Plan day**.
- **Edit like a text editor (every Panes view).** This is on by default. In Outline, Cards and Kanban views and in Calendar columns, every card or line is a live text field. The Daily page works the same way, with a pencil / open-book button in its header: the notes bullet is read-only there (rename it from the ⋯ menu) and can't be deleted, and a task can't be made at the top of a day (tasks at the top belong on the board cards). The item window (opened from search, or from the Panes) works the same way, with its own pencil / open-book button in its top bar; the item's own name is not editable there yet. In Kanban, the right-click menu on a card has *Move to “<title>”* to send it to another title. The button in the column header switches between editing (a pencil) and reading (an open book, with the plain cards and the pop-up editor). **⋯ > Switch to reading / Switch to editing** does the same. Hide completed is now in Settings > Panes, and the calendar dots follow it. Click anywhere in a line and type, with no double-click and no edit box. Changes save about a second after you stop typing (the Panes bar shows *Saving…* and *Saved ✓*), and WorkFlowy's "busy" answers are waited out and retried. **↑ / ↓** (and **←** at the start, **→** at the end of a line) move between lines. **Enter** adds a new line at the end of the list the line belongs to: WorkFlowy can't insert a line in the middle, so on a line that isn't last the board says so. A new line is only created in WorkFlowy once you type something into it. **Tab** indents under the line above, **Shift+Tab** outdents, **Backspace** on an empty line removes it (a line that has lines or a note inside is never deleted this way), and **Esc** leaves the line. Lines containing protected (Encrypt) text still open the usual editor when clicked, and notes are still edited with the toggle off. It is remembered per column and is off by default. In Edit mode the hover buttons (`+ − > <` and ⌖) are hidden and the column shows a thin accent line along its top edge, and the header button shows a pencil (an open book in reading mode). The grey **(n)** hidden-line counts are hidden on lines you can type in. More keys replace them: **Alt+Enter** adds a line inside the current one, **Ctrl/Cmd+↓ / ↑** unfolds or folds it, **Ctrl/Cmd+Enter** ticks a task, **Shift+Enter** opens the line's note as a field right under it (Enter adds a line inside the note, Shift+Enter or Esc comes back to the line, ↓ from the line and ↑ from the start of the note move between them, an emptied note is removed; encrypted notes still use the pop-up editor), **Ctrl+Shift+→ / ←** zooms in or up one level, and **Alt+Shift+D** deletes the line (after asking; Ctrl+Shift+D also works on Windows). On a Mac, read Alt as **Option** and Ctrl as **Cmd** (zoom stays **Control+Shift+→ / ←**); the **⌨ Keys** list shows both. **Right-click a line** for a menu: line type (bullet, task, heading 1 to 3), move to the top or bottom of its list, open in WorkFlowy, copy the link and delete. **Ctrl+/** (or the **⌨ Keys** button in the Panes bar) lists all the shortcuts. **Alt+Shift+T** changes the line's type, stepping through bullet, task, numbered, heading 1 to 3 and back (it isn't Ctrl+Shift+T because browsers keep that for reopening a tab). **Encrypt add-on:** an encrypted line shows as a 🔒 row; click it or press Enter on it to unlock it and edit the readable text right there, and it closes again when you leave the line. **Alt+Shift+E (or Ctrl+Shift+E)** encrypts the selected words or the whole line, or takes the encryption off the part the cursor is in. **Undo:** deleting a line (or several) and **Tab** (indent) can be undone with the **Undo** button that appears for a few seconds, or **Alt+Shift+Z** (Ctrl/Cmd+Z when you are not typing in a line); an undone delete recreates the lines, with what was inside them, in their old place but with new links, and Shift+Tab (outdent) already had Undo. **Selecting several lines:** press **Shift+↓** at the end of a line (or **Shift+↑** at its start) to select it and the next line, keep pressing to extend, or **Shift+click** another line. **Delete** or **Backspace** removes them all after asking (lines inside them go too), **Esc** clears the selection, and right-click offers the same delete. **Pasting several lines** puts the first at the cursor and adds the rest at the end of the list, keeping their indentation (and turning `- [ ]` into tasks and `#` into headings). Outside Edit mode everything is as before. The Daily page is next.
- **Plan day and Panes no longer stay open together.** Opening Panes ends Plan day, and opening Plan day closes Panes, so the **Week board** button always takes you to the week board.
- **Several Kanban titles side by side.** In a Kanban column, a number selector next to the title drop-down (1 to 5, default 1) sets how many titles to show. Each shows in its own part of the column with its own drop-down, so you pick which titles. Choosing a title that is already showing swaps the two. The number and the choices are remembered for each column. Drag a card onto any title in the strip that appears while dragging, or onto a card to make it a child. Drag the handle between two titles to change their widths, or the right edge of the last title to make it wider or narrower (the column grows with it); double-click a handle for equal widths. To give every title the same width, set one by dragging, then choose **Make all titles the same width** in the column's **⋯** menu: every title takes the width of the one you set last (the first, if you haven't set one), and the column grows or shrinks to fit; the widths are remembered for each column.
- **Fill the whole pane view with one column.** Every column's header has a **⤢** button that makes that column fill the whole Panes area. Press **⤡** or **Esc** to get the other columns back. It is remembered for the browser tab, so a reload keeps it. In a Kanban column the titles stretch to fill the space in proportion to their saved widths; going back restores the widths you had.

### What's new in 1.3.4

- **Past day alerts.** A day on the board that has gone by and still has open tasks can be marked. In **Settings > Week board**, **Past day alerts** turns this on or off (on by default). When it is on, **Alert with count** shows a red **⚠ N open** at the top of the day, and **Highlight left edge** draws a red edge down the day's column. Use either or both. Past due itself works as before: it is only the days before the first day shown.
- **Home fixes.** Home's Outline view now works even when the server hasn't been restarted with the newest `server.js`, and the Home column no longer disappears when the page is reloaded.

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

- **A phone page.** Open `/m` on your phone for a version built for small screens, while the desktop board stays exactly as it was. A strip of Mon–Sun chips at the top shows how many tasks are open each day; tap a day to see its tasks full width, or swipe the list left and right to change day. Tick a task to complete it, tap it (or its **⋯**) to edit it, move it to another day, or delete it, and type in the bar at the bottom to add a task to the day. **Show completed** reveals finished tasks, the **‹ ›** buttons change week, **⌂** jumps to today. Phones that open the main address are sent to `/m` automatically; **⋯ > Open the desktop page** in the phone page goes the other way for that session (or add `?desktop=1` to the address).
- **Install it like an app.** The board now has a web app manifest and icons, so on Android (Chrome menu > **Install app** / **Add to Home screen**) and iPhone (Safari Share > **Add to Home Screen**) it opens full-screen with its own icon and starts on the phone page. The install option only appears on an `https://` address (Option 3 or a Tailscale address; see "Using it on a phone" below).
- **Groups.** Tasks indented under a plain bullet show as a collapsible group (the bullet's name, an open count and its tasks), each with its own **+ Add task** that adds under that bullet. **⋯ > Settings > Tasks under bullets** chooses Group, Flatten (tasks listed in order, each tagged with its bullet) or Off. Old `WB-Notes` bullets, `!list` checklists and `!alld` notes are never treated as groups. Moving a grouped task puts it on the other day's top level. Each group header has its own **⋯** button: **Move group to top** (one request; Undo puts it back), **Move group to today**, and **Move group to another day…**. The group's tasks move with it. Creating or renaming groups stays on the desktop page.
- **Notes window (desktop, 1.5.3).** A **📝 Notes** button sits right of **📥 Inbox**, with the number of notes. Click it, or press **N** when you're not typing, to open the Notes window. It shows the same notes as the phone page: each note is an item under your notes node, its name is the title and its note is the text.
  - **Left:** **+ New note**, a **search** box (title and text; encrypted words aren't searched), and the notes, newest first. Each takes the same two lines: its title, then the first line of its text (both cut with … when long; hover for the full title, and "No text" when there's nothing yet); a grey lock marks a note with encrypted text, `‹secret›` stands for encrypted words, and a note that is all encrypted reads "Encrypted note". ↑ / ↓ move through the list.
  - **Right:** the open note. Click the title to rename it, type in the text below. It saves a second after you stop typing, and when you switch notes or close the window (the status bar shows when). A new note is titled "Notes · Tue, Nov 10" until you rename it, and goes to the top. **⋯ > Delete note** asks first, and **Undo** brings it back (with a new link).
  - **Status bar** along the bottom, like a code editor's: on the left, how many notes there are (or "2 of 9 notes match" while searching); on the right, for the open note, the line and column of the cursor (and how many characters are selected), words and characters, whether its encrypted parts are locked or unlocked, and the save state: *Unsaved changes*, *Saving…*, *Saved 2:41 PM*, or *Not saved* with the reason in red.
  - **Encryption (Encrypt add-on):** select words and press **Encrypt** (or Ctrl/Cmd+Shift+E; Alt+Shift+E). They show as `⟦…⟧` and are encrypted every time the note saves. A note with encrypted text opens read-only with `‹secret›`; **Unlock** asks for your passphrase (the add-on's own dialog) and shows each part as ⟦readable⟧ text you can edit. Put the cursor in a ⟦part⟧ and press **Decrypt** to save it as plain text again. **⋯ > Lock encryption**, or the add-on's idle lock, saves the note encrypted and shows it locked again; closing the window does the same. Without the add-on, encrypted notes are read-only.
  - **Where it finds your notes:** **Settings > Week board > Notes** (paste the node's link or id), or, if that is empty, the phone page's **Notes location** when the phone page shares its settings. The button is hidden while neither is set. **Set Notes** checks the phone's location first: the same node changes nothing (the board keeps following the phone); a different node asks **Use on this board only** (the phone keeps its own), **Use for both** (the phone's shared location changes too, so both pages use it), or **Cancel**.
- **Inbox button (desktop).** A **📥 Inbox** button sits just left of **Reports** under the Daily page, with a count of the open items directly in your Inbox. Click it, or press **I** when you're not typing, to open the Inbox in the item window, where you can edit everything in it (any item type); **← Panes** (or Esc) returns. Drag a task or group card onto the button to send it to the end of the Inbox (Undo puts it back). Set it in **Settings > Week board > Inbox** by pasting the node's WorkFlowy link or id, or by picking one of your Plan day sources. It is saved in this browser. Plan day is unchanged.
- **Open a bullet.** Click into any bullet to see and edit what is under it. On the desktop board a group card has an **Open ▸** button that opens the item view (everything under the bullet, any type, editable), and **← Panes** brings you back. On the phone page a **›** on a bullet, heading, group or section (or **› Open** in its **⋯** menu) opens that item as its own page: a **‹ Back** button and a breadcrumb (for example *Inbox › Project X › Sub idea*, tap a part to jump there) at the top, then everything under it, whatever its type. Each line has its own **›** to go one level deeper and its **⋯** menu (Edit, Open, Out one level, Move under…, Move to the Inbox, Change type, Delete). The row at the bottom adds a task, bullet or numbered item under the open item. Plan day is unchanged.
- **Past due and Upcoming.** Two buttons under the day strip show how many open tasks you have in the last 14 days before today and the next 14 days after it (counting tasks under bullets). Tap one to see them by day, oldest first; tap a day heading to jump to that day. In Past due, **Move all N to today…** moves everything shown to the end of today (it's undoable), and any task's **⋯** menu has **Move to today**.
- **Date words.** The add bar understands `tomorrow`, `fri`, `next mon`, `11/5`, `Nov 5`, `in 3 days` and `next week` at the end of the text: "Call dentist fri" adds "Call dentist" to Friday, and a hint under the box shows where it will go. Tap the hint to add the text to the current day exactly as typed.
- **Undo.** Completing or reopening a task, adding, editing, moving (including Move all to today) and reminder changes show a toast with **Undo** for a few seconds. **⋯ > Undo: …** in the main menu undoes the latest one later. Deleting can't be undone.
- **Reminders.** A task's **⋯** menu has **Set reminder…** / **Change reminder…**: pick a time (or In 30 minutes / In 1 hour for a task on today), or remove it. The time is stored in the task's text as `@HH:MM`, the same as on the desktop board, so push and popup reminders work from it. A reminder that comes from a WorkFlowy date tag, and any formatted or encrypted task, is changed on the desktop page.
- **Settings.** **⋯ > Settings** has: Tasks under bullets (Group / Flatten / Off), Show Past due, Show Upcoming (turning one off removes its button and skips its background loading), Show completed, and Week length (7 days Mon–Sun, 7 days Sun–Sat, or 5 days Mon–Fri). They are saved in that browser.
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

- **Reminders (1.2.0).** Put a time in a task (`@2:30pm`) or use WorkFlowy's date tag with a time, and the board shows a 🔔 badge, pops up when it's due, and can push to your phone through ntfy or Pushover. Right-click a card and choose **Set a reminder…** to set the time. New **Reminders** section in Settings. See "Reminders" below, including how to set up ntfy and Pushover. New settings: `REMINDER_TZ`, `NTFY_TOPIC`, `NTFY_URL`, `NTFY_TOKEN`, `PUSHOVER_TOKEN`, `PUSHOVER_USER`, `REMINDER_NESTED`, `REMINDER_STATE`.
- **Peek at Past due / Upcoming.** With a panel switched off, clicking its count at the bottom right shows the panel without changing the setting (press **📌** to keep it on, **✕** or the count to close it).
- **Adding in Group mode.** Each group card has a **+ Add task** box, and each day column has a stack **Add group** icon in its icon row.
- **Hide completed on the Daily page.** Ticked items and sub-items are left out of the Daily page too.
- **Optional add-ons.** `server.js` can load optional add-ons from an `addons` folder. Without one nothing changes. See `addons/ADDONS.md` if you want to build or install one.


## What's in the box

| File | What it does |
|------|--------------|
| `server.js` | A tiny Node server. It holds your API key, forwards requests to WorkFlowy, and serves the page. Your key never reaches the browser. |
| `index.html` | The board itself (a single page, no build step, no dependencies). |
| `mobile.html`, `icon-180.png`, `icon-192.png`, `icon-512.png` | The phone page (served at `/m`) and the app icons. Optional: without them the board still works and `/m` says it isn't installed. |
| `addons/` | Optional extras (see `addons/ADDONS.md`). Included: `crypt` (Encryption, see `addons/crypt/README.md`) and `markdown` (Markdown notes, see `addons/markdown/README.md`). Delete the folder and the board is the plain board. |
| `CHANGELOG.md` | What changed in each version, with upgrade notes. |
| `.gitignore` | Keeps secrets and the settings files the server writes out of git. |
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
| `BOARD_PASSWORD` | `vps` and `fly` | none | The sign-in password, at least 12 characters. Not used in `local`. Instead of the password you can give a `salt:hash` pair, so the password itself isn't kept in your startup script or host settings. Make one with `node -e 'const c=require("crypto"),s=c.randomBytes(16).toString("hex");console.log(s+":"+c.scryptSync(process.argv[1],s,32,{N:16384,r:8,p:1}).toString("hex"))' 'your-password'` and sign in with the password. |
| `BOARD_PASSWORD_SALT` | No | built-in | Only used when `BOARD_PASSWORD` is a plain password: the salt for scrypt. Leave it unset unless you have a reason. |
| `PUBLIC_URL` | `vps` and `fly` | none | The `https://` address you visit, for example `https://board.example.com`. Only requests for this address are accepted. |
| `SESSION_DAYS` | No | `7` | How many days a sign-in lasts. |
| `HOST` | No | `127.0.0.1` (`fly`: `0.0.0.0`) | Address to listen on. Rarely needed. `local` only allows `127.0.0.1`. |
| `WORKFLOWY_BASE_URL` | No | `https://workflowy.com/api/v1` | API address. If you get errors, try `https://beta.workflowy.com/api/v1` (WorkFlowy's reference docs use that address). |
| `PORT` | No | `3000` | Port to serve the board on (`fly.toml` sets 8080). |
| `NOTES_NAME` | No | `WB-Notes` | Name of the old notes bullet. It is only used to read days that still have one (its lines show after the new all-day notes). New notes don't use it. |
| `UPDATE_CHECK` | No | on | Set to `0` to stop the board checking GitHub for a newer version. |
| `UPDATE_URL` | No | this project's `server.js` on GitHub (`main` branch) | Raw address of a `server.js` to compare versions against (useful for a fork). |
| `IDLE_PURGE_MINUTES` | No | `10` | Minutes without a search before the server clears its copy of your outline from memory. `0` turns the purge off. |
| `REMINDER_TZ` | No | the server's time zone | Time zone for reminder times, for example `America/New_York`. **Set it on `vps` and `fly`**, whose servers run in UTC. |
| `NTFY_TOPIC` | No | none | Turns on push reminders through [ntfy](https://ntfy.sh). On ntfy.sh a topic is public: anyone who knows or guesses the name can subscribe and read every reminder (the task text). Use a long random name and treat it like a password, or set `NTFY_TOKEN` with a reserved topic or your own ntfy server. |
| `NTFY_URL` / `NTFY_TOKEN` | No | `https://ntfy.sh` / none | Your own ntfy server, and its access token if it needs one. |
| `PUSHOVER_TOKEN` + `PUSHOVER_USER` | No | none | Push reminders through Pushover instead of (or as well as) ntfy. |
| `REMINDER_NESTED` | No | on | Set to `0` so push reminders ignore tasks nested under a bullet (saves a WorkFlowy request per bullet). |
| `REMINDER_STATE` | No | a file in the system temp folder | Where the server remembers which push reminders it already sent. |
| `DESKTOP_SETTINGS_FILE` | No | `desktop-settings.json` next to `server.js` | Where the desktop board's shared settings are kept. |
| `RECURRING` | No | on | Set to `0` to stop the server making copies of repeating tasks. |
| `RECURRING_STATE` | No | a file in the system temp folder | Where the server remembers which repeating tasks it already copied. |
| `FEATURES_STATE` | No | `weekboard-features.json` next to `server.js` | Where the server keeps the feature switches. |
| `TIMEBLOCKS_STATE` | No | `weekboard-timeblocks.json` next to `server.js` | Where the server keeps the Day template, the quick blocks list, the "show my template" setting, left-out planned blocks and the automatic template schedule. |
| `MOBILE_SYNC` | No | on | Set to `off` to remove the sharing switches for everyone: the phone page's "Share settings across my devices" and the desktop's "Share these settings between browsers" are hidden. |
| `MOBILE_SETTINGS_FILE` | No | `mobile-settings.json` next to `server.js` | Where the shared phone-page settings are saved. |
| `NODE_USE_SYSTEM_CA` | No | off | Set to `1` on Windows to use the Windows certificate store (fixes certificate errors on networks that inspect HTTPS). Needs Node 22.15+ or 23.8+. |

## Using the board

**Columns and days**
- Choose **3**, **5**, or **7** days with **Days shown** in Settings → Week board. The default is 5 (Monday to Friday). 7 is Monday to Sunday. 3 is today plus the next two days.
- The day columns share the board's width evenly, so 5 days fit without sideways scrolling on a normal window (about 1100px wide or more with the sidebar open). Columns never get narrower than about 140px; below that the board scrolls sideways. Hiding the sidebar gives them more room.
- The arrows sit on either side of the date range in the header (1.4.0), so they stay put when you hide the sidebar. Use them to move between weeks (or 3-day blocks), and click the date range to jump back to the current week.
- The ↻ button in the header (after **Settings**, before the sidebar button) reloads everything from WorkFlowy.
- **Hide / show the sidebar:** the button at the right end of the header (or **Ctrl+\**, also **Cmd+\** on a Mac, even while typing in a box) hides the whole right-hand sidebar so the board or Plan day gets the full width. It's remembered in this browser. The ↻, the week arrows and the Past due / Upcoming counts stay visible.

**Tasks**
- Type in a column's **+ Add task** box and press Enter. New tasks go to the bottom of that day.
- Tick the checkbox to complete or un-complete a task.
- **Edit cards in place (Settings → Board, on by default).** Click a task's text on a day column, Past due or Upcoming and type; it saves a second after you stop or when you leave it. **Enter** moves to the next card; on the last card of a day it starts a new one (dropped if you leave it empty). **Esc** leaves the box. 🔔 and 📅 save what you typed first, so reminders and Move to a date work as before. The 🔔 📅 ✕ buttons appear on hover as a small bar on the card's top edge, so they never cover the text or the lock. Drag a card by pressing on it and moving before it has the cursor. **Shift+Enter** opens the card's note (Shift+Enter again goes back to the name; an emptied note closes). Tasks inside a group card are live too (no new card on Enter there; use “+ Add task”). **Ctrl/Cmd+Shift+E** (or Alt+Shift+E) encrypts the selected words, or the whole card, then the card closes as 🔒. A locked card opens with one click (or Enter on it): it asks for the passphrase if needed, shows the readable text in a live box, and locks again when you leave it. Without the Encrypt add-on, locked names still use double-click. Turn the setting off to go back to double-click.
- **Double-click a task's text to edit it right on the card.** The text turns into a box in place (the same editor as the Daily page): **Enter** saves, **Esc** cancels, clicking away saves, and a second box holds the task's note. Bold, links and other formatting are kept. The card can't be dragged while you're editing, and it works on nested tasks too. (Not available while Selector is on, since clicks pick cards then.)
  - **Group cards too:** double-click the group's name to rename the bullet in place, or double-click any task inside the group to edit it. Same box and keys as above, formatting kept. A group's name may use two lines and is cut after that; the "2 of 3 open" pill sits under the name, and the calendar icon stays at the top right of the card. Hovering it says "Double-click to rename".
- Click ✕ to delete (permanent, with a confirmation). If the task has sub-items, the confirmation says how many, because they are deleted too.
- Drag a task onto another day's column to move it (mouse only; this doesn't work by touch). Its sub-items move with it.
- **Sub-items:** a task that has lines underneath it shows a small **▸ 3 sub-items** button. Click it to open a checklist right on the card, nested as deep as the items go. Tick a sub-item to complete it, or click its text to edit it (with its note, and its type: bullet, task or numbered). Numbered sub-items show their numbers. To add or delete sub-items, use WorkFlowy, the Daily page, or the search item editor.
- **Hovering a card** shows two buttons at its top-right corner: **Move to a date** (calendar icon) and **✕** (delete). Reminder and Repeat are on the card's right-click menu (1.3.9).
- **Move to a date:** hover a task and click the calendar icon for a small menu: Today, Tomorrow, next Monday, or any date (type it or use the date picker). Cancel, Esc, or a click elsewhere closes it. The task moves to the bottom of that day's page, even a day outside the days shown. (Dragging a card onto a day column still works for days on the board.) In Group mode, the calendar icon on a group moves the whole bullet with all its tasks.
- The day header and add box stay in place while the task list scrolls.

**⚙ Settings** (the button in the header, left of the sidebar button; it opens a window with the sections on the left and their options on the right: **Week board** (Days shown 3 / 5 / 7, Hide completed, Sort by priority, Past due, Past due range, Upcoming, Nested, Sub-items) and **Plan day** (Plan day limit, Plan day hours, Plan day sources) and **Reminders** (popups, browser notifications, push status; see "Reminders" below), plus one section for each installed add-on that has settings (the crypt add-on adds **Encryption** and the markdown add-on adds **Markdown**). It stays open while you change things; close it with ✕, Esc or a click outside. It reopens on the section you used last. All choices are remembered in your browser.)
- **Hide completed:** hides checked-off tasks, on the board and in the sidebar's Daily page (a ticked task there is hidden along with anything indented under it; the item editor opened from search still shows everything). Deleting a line with **−** still warns about the lines underneath, hidden or not.
- **Sort by priority:** on by default. Each day lists urgent tasks (`!p1`) first, then high, medium, tasks with no priority, and low (`!p4`) last. Within each level the outline order is kept, and a group card sorts by its most urgent open task. Off shows the plain outline order. See "Priorities, time estimates and saved filters" below.
- **Past due:** adds a panel of open tasks from *before* the days on screen. Choose how far back with **Past due range** just below it in Settings: 1, 2, 3 or 4 weeks, or All (default 2 weeks). The panel's title shows the range, for example **Past due (2 weeks)**, and a small **→ Today** button next to the count opens a preview to move the open ones to today.
- **Upcoming:** adds a panel of tasks in the 14 days *after* the days on screen. Both panels have a **▾ 3 open** button next to the title: click it to fold the panel up to just its header (it becomes **▸ 3 open**), and click again to open it. Whether each is folded is remembered in your browser.
- **Nested:** `Off`, `Group` or `Flatten`. It decides what the board does with a plain bullet that has tasks indented under it (for example a "Project Alpha" bullet with three todos beneath it). **Off** is the default and ignores such bullets, as earlier versions did. The choice is remembered in your browser.
  - **Group:** the bullet becomes one card with a ▾ arrow, its name, and a pill such as "2 of 3 open". Its tasks are a checklist inside the card, and you can tick them in place. The arrow hides or shows the checklist. Drag the card to move the bullet, and everything under it, to another day. The calendar icon on the card header does the same. Group cards are for ticking only; edit or delete the bullet and its tasks in WorkFlowy or from Daily page / search.
  - **Flatten:** each indented task becomes its own card in the day's column, with the bullet's name in small grey type above it (for example "Project Alpha ›"). These cards can be ticked, edited and deleted like any other. They can't be dragged to another day, because that would pull them out of their bullet, but the calendar icon moves one to a date of your choice (and takes it out of its bullet).
  - **Adding in Group mode:** each group card ends with a **+ Add task** box. Type a task and press Enter to add it to the bottom of the group; the box stays ready for the next one (Esc leaves it), and the toast has Undo. Under each day's add box there's a small **+ Add group**: type a name and press Enter to make a plain bullet at the bottom of that day. It appears as a card straight away, with its add box ready for the first task. An empty group stays visible in this browser tab; after a reload it shows again once it has a task. Neither control appears in Off or Flatten mode.
  - Both modes keep the outline's order, count nested open tasks in each day's "N open", and work in the Past due and Upcoming panels too. **Hide completed** hides ticked nested tasks (and hides a group with nothing left open).
  - Only **one level down** is read: tasks directly under a plain bullet or heading that sits directly under a day. Old notes bullets (`WB-Notes`), checklists (`!list`) and all-day notes (`!alld`) are skipped on purpose, so what is inside them stays off the board.
  - **Cost:** the board makes one small request per plain bullet to find its tasks. They load in the background, are remembered until you press ↻, and the board redraws a moment later (never while you're typing in a box). With Past due on, and especially with "All", a long history means more requests. Leave Nested on Off if you don't use indented tasks.
- **Plan day limit:** how many open tasks fill the meter in Plan day (default 8). `0` turns the meter off.
- **Plan day hours:** the hours you have for tasks in a day (0 by default, which keeps the task-count meter above). When set, the meter adds up the day's time estimates instead, for example "5h 30m of 6h planned". It turns amber at 90% and red when over, and says how many open tasks have no estimate yet.
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
- **Adding lines:** the Daily page has no separate add box. Use the page's own **+ Add a task or line** row at the bottom of the outline (or Enter on the last line). The ☐/•/1. button beside it picks the line type; lines go straight onto the day the page is showing, and a task there is a day task. **Paste a list** (several lines) and it goes in nested: two spaces (or a tab) per level, a leading `-` or `*` is dropped, and the indent is taken relative to the least-indented line.
  - **☑ Checklist** is a choice of the type button beside the add row (☐ task, • bullet, 1. numbered, ☑ checklist). Choose it, type the name and press Enter: the checklist is created and its first item line opens. A checklist is a bullet marked `!list` whose items are tasks; Enter on an item adds another task. Checklists show as ☑ on the page and the phone, and are left out of groups, counts and reminders.
  - There is no notes folder. Earlier versions had a notes bullet (`WB-Notes`), **Move notes in** and a rename pencil. All three are gone: old `WB-Notes` bullets are not converted, they keep showing their lines, and an empty one on a past day is removed quietly (only while the Notes switch is on).
  - If you rename the bullet directly in WorkFlowy, the board won't recognize it until you change the name here to match.

**Planning, moving and undoing** (**Plan day** is in the bar along the bottom, on the left, with the version number on the right. selecting starts from the select button in a card's hover bar; **Reports** is on the bottom row of the Daily page panel, under the add box)

- **Undo.** Moving a task, ticking or unticking it, deleting it, adding one, and every bulk action show a bar at the bottom with an **Undo** button (it stays for 10 seconds). **Ctrl+Z** (or **Cmd+Z**) undoes the latest one when you aren't typing in a box, and each press goes one step further back (up to 20). What Undo can and can't restore:
  - A moved task goes back to the **bottom** of the day it came from, because WorkFlowy's API can only place things at the top or bottom of a day, so its old position in that day isn't restored.
  - A deleted task comes back with its note, its completed state and everything under it (up to about 300 lines, 12 levels deep), but as a **new copy** with new ids, again at the bottom of its day. Anything that pointed at the old one (links, mirrors) is not restored.
  - Not covered: deletes in the Daily page and item editor (their − buttons ask first and are permanent), tick boxes on group cards and sub-item checklists, and edits to text.
- **Selecting (the select button in a card's hover bar).** Hover a card and click the circle with a check, left of 📅 and ✕ (a group has it on its top edge) to select it and start selecting. While selecting, each card's checkbox (a group's fold arrow) shows a round marker instead, filled blue with a tick when picked. Click cards to pick several (they get a blue outline; clicking doesn't tick or edit them). A bar appears at the bottom: **Select all open**, **Move to…** (Today, Tomorrow, next Monday, or any date), **Complete**, **Delete** (asks first), and **Cancel** (or press Esc). A **group card** is picked as a whole (click anywhere on it except the fold arrow): moving it moves the bullet with its tasks, and deleting it deletes the bullet and everything under it. **Complete** skips groups (a group is a bullet, not a task) and says so; **Select all open** includes groups. Everything done from the bar can be undone in one step.
- **Move open tasks forward.** The **→ Today** button in the Past due panel opens a preview of those tasks. Untick any you want to leave, pick the date (it starts on today), and press **Move**. Plan day uses the same preview for **Send the rest to tomorrow…** and **Add all…**. It moves tasks that sit directly under a day. Tasks inside plain bullets (the Nested setting) stay where they are, so nothing leaves its bullet by surprise.
- **Date words in the Add task box.** End the text with a day and the task goes to that day instead of the column you typed in, for example `Call dentist fri`, `Pay rent in 3 days`, `Report 11/5`, `Party Nov 5th`, `Plan next week`. A grey hint under the box shows where it will go. It understands: `today`, `tomorrow` (`tmrw`), weekday names (`fri` is the next Friday coming up, `next fri` is the Friday of next week), `next week` (Monday), `in N days/weeks`, `M/D` and `M/D/YY`, and `Nov 5` / `5 Nov` (the next time that date comes round, or add a year). A trailing `on`, `by` or `due` is dropped (`Call mom on fri`). Text that's only a date word stays a normal task. **Shift+Enter** adds the text exactly as typed.
- **Plan day (📅 Plan day in the bottom bar).** Replaces the columns with one day in focus, today to start with. Left: that day's tasks as normal cards (tick, edit, move, delete, select), a count of open and done tasks, a meter against your **Plan day limit** (amber at the limit, red above it), or against your **Plan day hours** when you've set them, **Send the rest to tomorrow…**, and an Add task box. Right: **Bring in**, listing your past-due open tasks (as far back as the Past due range, at most 4 weeks) and the next three days' open tasks, each with a **+ Add** button that moves it to the day you're planning, and **Add all…** for the past-due list. Use ‹ › to plan another day. Click Plan day again to go back to the columns. Day pages that aren't loaded yet are fetched when you open it, so the first time takes a moment.
  - Plan day (and the day you're on) is remembered for the browser tab, so a reload brings you back to it instead of the board.
  - **Extra sources:** each node added under *Plan day sources* in Settings gets its own list (name and open count) on the Bring in side, below Past due. **+ Add** moves the task out of that node onto the planned day, and **Add all…** opens the same preview as Past due. Undo moves it back to the bottom of the node.
- **Reports ▸ Completed tasks (the Reports button, on the Daily page's bottom row).** Reports opens a small menu, and Completed tasks lists the tasks you finished, grouped by the **day you completed them** (not the day they sit on), newest first, with the time and where they live in your outline. Choose Today, Yesterday, This week, Last week, Last 7 days or Last 30 days. **Copy as text** puts a plain list on your clipboard for a stand-up or weekly review. It uses the same server copy of your outline as search, so it shows tasks anywhere in your outline, and **Refresh index** downloads a fresh copy (once a minute at most). Shows up to 1000 tasks.
- **Reports ▸ Saved filters.** Finds tasks anywhere in your outline by priority, date, estimate or words, and totals their estimated time. See "Saved filters" below.

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

### Priorities, time estimates and saved filters

Like reminder times, priorities and estimates are short markers in the task's own text, so they travel with the task in WorkFlowy and nothing extra is stored.

**Priorities**

| Marker | Priority | Card edge and badge |
|--------|----------|---------------------|
| `!p1` | Urgent | Red, **P1** |
| `!p2` | High | Orange, **P2** |
| `!p3` | Medium | Blue, **P3** |
| (none) | Normal | None |
| `!p4` | Low | Grey, **P4** |

- **Set one** by typing the marker anywhere in the task (`Call the bank !p1`), or by right-clicking a card and clicking **P1**–**P4** in the **Priority** row. Click the highlighted one again, or **✕**, to remove it. The toast has Undo.
- **On the card:** a priority shows as a coloured left edge and a **P1**–**P4** badge. The marker (`!p1`) is hidden while you aren't editing, and it comes back when you click into the card (1.4.0). In 1.3.9 and earlier it stayed visible on cards you type in.
- **Elsewhere (1.3.9):** Panes, the Daily page and the item window show the same edge and badges. While you type in a line the markers stay in the text. A Panes card with a card colour keeps its colour stripe; its priority shows as the badge. The phone page shows the edge and badges on every task, and has its own **Sort by priority** in ⋯ > Settings (shared with your other devices when settings sharing is on).
- **Order:** with **Sort by priority** on (Settings > Week board, on by default), each day lists urgent first and low last. Tasks without markers keep their outline order, so nothing moves until you use them.

**Time estimates**

- **Set one** by typing `~15m`, `~45m`, `~1h`, `~1h30m` or `~1.5h` in the task, or by right-clicking a card and picking from the **Estimate** row (15m to 3h, or **✕** to remove it). The toast has Undo.
- **Day totals:** each day's header adds up the estimates of its open tasks, for example "4 open · 2h 15m". Hover over the time to see how many open tasks have no estimate.
- **Plan day:** set **Plan day hours** (Settings > Plan day) and the Plan day meter compares the estimated time with the hours you have, instead of counting tasks.
- **Add task box:** markers can follow the date words, so `Call Bob fri !p1 ~30m` adds "Call Bob !p1 ~30m" to Friday.
- Push reminders leave the markers out of the message.

**Saved filters (Reports ▸ Saved filters)**

The window lists tasks from your whole outline that match a filter, most urgent first, then by date. Each row shows the task's priority, estimate, day and where it sits in your outline, and the footer totals the estimated time.
- Tick a task to complete it.
- Click its name to open it in the item window.
- **↗** opens it in WorkFlowy.
- **Copy as text** puts the list on your clipboard.

Pick a saved filter from the list, or type one and press **Enter**. **?** shows what you can type:

| Type | Finds |
|------|-------|
| `call dentist` | Tasks containing every word, in the name or the note. `"exact phrase"` keeps words together; `-word` leaves matches out. |
| `#work`, `@alex` | Tags and people, as whole words (`#work` doesn't match `#workshop`). |
| `p:1`, `p:1-2`, `p:none`, `p:any` | By priority. |
| `due:today`, `due:tomorrow`, `due:week`, `due:nextweek`, `due:lastweek` | By the task's date: a WorkFlowy date inside the task if it has one, otherwise the calendar day it sits on. Weeks follow your week-start setting. |
| `due:overdue` | Open tasks on the last 60 days. |
| `due:7d`, `due:2026-11-04`, `due:2026-11-01..2026-11-15` | The next 7 days, one date, or a range (up to 120 days). |
| `due:none`, `due:any` | No date at all (not on a calendar day and no WorkFlowy date inside), or any date. |
| `est:none`, `est:any`, `est:<30m`, `est:>=1h` | By time estimate. |
| `is:done`, `is:any`, `is:all` | Completed tasks, open and completed, or bullets as well as tasks. Open tasks only is the default. |
| `under:"Project Alpha"`, `-under:Archive` | Tasks with (or without) that text in any line above them. |

Combine them freely, for example `p:1-2 due:week #work` or `due:week est:none`.
- **Save…** stores the current filter under a name.
- **Delete** removes the chosen one.
- Saved filters are kept in your browser, and shared when **Share these settings between browsers** is on.
- Four starters are included: Urgent and high, Overdue, This week, and This week with no estimate.

**Limits and how it works**
- Filters read the same in-memory copy of your outline as Search. **Refresh index** downloads a fresh copy, at most once a minute.
- A filter can hold up to 50 words, and up to 500 results are listed (the count and total time cover them all).
- A task's date is a WorkFlowy date inside it (the first one, with or without a time) if it has one; otherwise it is the calendar day it sits on (1.3.9).
- To know which day a task sits on, the server asks WorkFlowy once for each month it needs and remembers the answer. It then reads each day page's date from WorkFlowy's own date tag in its name. If a month's day names can't be read, it asks about each day instead, which is slower the first time.

### Time blocking

Plan a day by the hour. Like priorities, the start time is a short marker in the task's own text, so it travels with the task in WorkFlowy and nothing extra is stored.

- **Set a time:** type `^9am`, `^9:30am`, `^2pm` or `^14:00` in a task, right-click the card and choose **Time block…** (it opens the panel on that day), then drag the task onto the timeline, or click a placed block to change its time. The length is the task's `~` estimate; with none, it is 30 minutes.
- **On the cards:** every day shows a blue badge with the time and length ("3 PM · 1h"), the badge is a green **▶ NOW** on today while the clock is inside the block, and a yellow **⚠** warns when two blocks overlap. Blocked tasks list first on each day, in time order, then the rest in their usual order. The badge sits in the card's lower right.
- **The panel:** the clock icon at the right end of today's icon row (beside Add task and Note) opens it. The top lists the day's **Unscheduled** tasks. Below is a timeline in half-hour steps (8 AM to 6 PM, stretching for tasks outside those hours). Drag an unscheduled task onto a time; if it has no estimate it asks how long (Cancel schedules nothing). Drag a placed block to move it, press its **✕** to take it off the schedule, and drag its bottom edge to change its length in 15-minute steps.
- **Save and Cancel:** nothing you do in the panel is written to WorkFlowy until you press **Save**. Dragging a task, resizing or editing a block, dropping a quick block, adding a block and leaving a planned block out all show on the timeline with a dashed outline, and the footer says "Not saved to WorkFlowy yet". **Save** lists exactly what it will write ("Change “Report”: no time → 3 PM", "Add 12 PM “Lunch” (1h) from your template") and asks you to confirm. **Cancel** throws every change away. Changing day or closing the panel with unsaved changes asks first.
- **Any day:** the ‹ › arrows, the date box and **Today** at the top of the panel change the day, and the weekday is shown beside the date.
- **Edit a block:** click it for a small editor with the start, the length and a **Description**, which is the task's WorkFlowy note. **Save**, **Unschedule** or **Cancel**; Undo works. Saving only the description leaves the time alone.
- **Quick blocks:** **Meeting** (30m), **Lunch** (1h) and **Appointment** (1h) sit above the timeline. Drag one onto a time and it asks how long, then stages a task such as `Lunch ^12:00 ~45m` on that day (written when you press **Save**). **+ New** adds your own (a name and a usual length), and **✕** on a chip removes it. The list is kept on the server with the Day template, so every browser shows the same one.
- **Day template and planned blocks:** each weekday can have standard blocks (**Edit template…** has a tab per weekday with time, length, name and **Copy Wed to Mon–Fri**). On today and later days the panel shows that weekday's template blocks faded and labelled "Planned:", unless the day already has a block with the same start and name. They are only shown: nothing exists in WorkFlowy until you press **Save**. **✕** on a planned block leaves it out of that date only (remembered). Click a planned block to change it for that day; the editor has a **Change my Wed template too** box when you want the change to stay. **+ New block** adds a block to the day, with a box to add it to the weekday's template too. **Show my template on every day** (in the Day template foldout) turns the faded blocks off or on; it is on by default and is saved on the server, so every browser agrees. **Save Nov 9–15 to WorkFlowy** writes the whole week's planned blocks in one go after asking. Blocks created from the template carry a hidden `!blk` tag and are marked done once their time has passed; they are left out of **Past due** and **Upcoming**, and any left open on a past day are ticked off quietly when Past due loads.
- **Done blocks:** a checked-off block stays on the timeline, greyed with a ✓ (it can't be moved), and drops out of the day's open total.
- **Not covered yet:** blocks don't send reminders (use `@2:30pm` for that), and the right-click **Time block…** is on the week board's cards only, not in Panes.

### Feature switches

Some features put things into WorkFlowy: markers in a task's text, tasks, bullets. **Settings → Features** switches them off one group at a time:

| Switch | Covers |
|--------|--------|
| **Time blocking** | The panel and today's clock button, `^9am` times written by the panel or drag, quick blocks, the Day template (planned blocks, **Save**, `!blk`) and the automatic ticking of finished template blocks |
| **Repeating tasks** | The server making the next copy of an `!every` task, even with the board closed, and the **Repeat…** menu item |
| **Notes bullets** | Writing `!alld` all-day notes and `!list` checklists (the all-day note icon, the ☑ Checklist choice, the Order… menu, and the same on the phone page), and the quiet removal of empty old `WB-Notes` bullets on past days |
| **Priority, estimate and reminder items** | The menu items and buttons that write `!p1`, `~30m` and `@2:30pm` |

**Time blocking templates** (in **Settings → Features**, under the Time blocking switch) is separate from the panel, which only shows your template until you press Save. Turn on **Add my template to the coming week automatically**, pick **Friday** or **Monday** and a time, and the server writes the Day template's blocks into WorkFlowy at that time. Friday adds **next week**; Monday adds **the week you're in**. **Weeks to add** (1 by default, up to 4) adds the weeks after that. It skips blocks already on a day and planned blocks you left out of a date, and it tags what it makes `!blk` like the panel does. It only runs while the server is running: if the server was off at the chosen time it catches up when it starts, and it never adds the same week twice. Saving a new schedule never fires for a time that has already passed. It is off until you turn it on, and **Time blocking** has to be on (the controls are greyed out when it is off).

A feature that is off stays visible but greyed out, with "· off in Settings" in menus and a hint on hover. Nothing already in WorkFlowy is changed or removed, existing markers still show, and you can still type a marker yourself. The switches are kept on the server, so every browser and the phone page follow them. They are saved in `weekboard-features.json` next to `server.js` (set `FEATURES_STATE` for another place). `RECURRING=0` on the server still overrides the repeating switch.

### Sharing templates across machines

If you use local mode on more than one computer (e.g. a desktop and a laptop), each machine keeps its own day templates and quick blocks. **Sync templates via WorkFlowy** lets every machine read and write the same templates through a dedicated WorkFlowy node, so a change on one machine shows up on all the others.

**Setup**

1. In WorkFlowy, create a node to hold the config — for example `#weekboard-config`. It can be anywhere in your tree; the board only touches children it creates inside it.
2. On the first machine, open **Settings → Features → Sync templates via WorkFlowy**.
3. In **This server's name**, give the machine a recognisable label (it defaults to the hostname). The name is stored in the WorkFlowy config node so you can tell which machines are using it.
4. Paste the WorkFlowy link or node ID into **WorkFlowy link or node id** and press **Set**.
   - If this machine already has templates, they are pushed to the config node (first-machine setup).
   - If the config node already has templates from another machine and this machine's differ, a side-by-side comparison shows both sets so you can choose **Use shared** (pull the shared ones) or **Use mine** (push yours). **Decide later** defers the choice until the next time you open the time-blocking panel.

On a second (or third) machine, repeat steps 2–4 with the same node link. The machine sees the shared templates and, if its own differ, shows the same comparison.

**How sync works**

- **Pull:** templates are read from WorkFlowy each time you open the time-blocking panel. If the remote templates differ from local, the comparison appears.
- **Push:** when you change a template or quick block, the update is written back to the WorkFlowy node (debounced, about a second after the last change).
- **Server registry:** a `servers` child in the config node tracks each machine's name and last-sync time.
- **Conflict resolution:** when remote and local templates disagree, the side-by-side modal lets you pick one set or defer. Deferred decisions re-appear next time the panel opens.

**Clearing sync**

Press **Clear** in the sync settings to disconnect this machine. Its local templates stay as they are; the shared config node is not changed.

### Repeating tasks

Add `!every …` to a task, or right-click a card and choose **Repeat…** (1.3.9: the card no longer has a separate 🔁 button). The marker stays in the task's text and the board shows it as a 🔁 badge:

| Write | Meaning |
|-------|---------|
| `!every day` · `!every 3 days` | every day · every 3 days |
| `!every weekdays` | Monday to Friday |
| `!every week` · `!every 2 weeks` | same weekday, every week or two |
| `!every mon,wed,fri` | the chosen weekdays |
| `!every month` · `!every month-end` | same date each month (the last day when the month is shorter) · the last day of each month |
| `!every year` | same date each year |

End it with `until 2027-06-30` or `x10` (10 times in all, counting this one), for example `Pay rent !every month x12`.

- The server looks at the pages from a week back to today every 10 minutes and, for each repeating task, makes the next copy on the next date after its due date (the date tag if it has one, otherwise the page it sits on). If that date has passed, it picks the next one still ahead. The copy keeps the note and a date tag's time, and carries the marker with its counter reduced, so the chain goes on by itself.
- A task is copied once. Completing it, or deleting the future copy, does not make another. Sub-items are not copied.
- The server must be running (it does this even with the board closed). Set `RECURRING=0` to switch it off, and `RECURRING_STATE` to a permanent file path (default: the system temp folder) so a restart cannot make copies twice.

### Reminders

A task becomes a reminder in either of two ways:

- **WorkFlowy's own date tag with a time.** In WorkFlowy type `!!` or `/date` and add a time, for example *Wed, Oct 28, 2026 at 2:30pm*. The reminder fires at that date and time, wherever the task sits. A date with no time is not a reminder.
- **A time in the task text.** Write `Call dentist @2:30pm`, `Stand-up @9:15` or `Pay rent @17:00`. The reminder is for the day page the task sits on. You can also right-click a card, choose **Set a reminder…** and pick a time, or **In 30 min** / **In 1 hour**; the board writes the `@time` for you. The popup ends with **Save alerts** (save the early alerts without changing the time), **Remove** (when the task has a time) and **Cancel**.

The time stays in the task in WorkFlowy, so the board stores nothing extra. If part of the task is encrypted (see "Encryption"), keep the `@time` outside the encrypted part so the reminder still works; popups and push messages show the encrypted part as 🔒. A card with a reminder shows a **🔔 2:30 PM** badge (with the date if it differs from the page). For `@time` reminders the badge replaces the `@` text, and clicking it changes or removes the time. A date tag's time is changed in WorkFlowy.

**Popup and browser notification (in the board)**

- When the time arrives, a popup appears at the top right with **✓ Complete**, a **Snooze…** menu (5, 10, 15, 20, 30, 45 or 60 minutes) and **Dismiss**. It works while the board is open in a tab, whichever week you're looking at, and only for open tasks.
- In **Settings → Reminders** you can turn the popups off, and press **Turn on** to also get a system notification (the browser asks permission once). Browsers only allow system notifications on `https://` addresses and on `localhost`.

**Push to your phone (board closed)**

The server sends a push at the task's time even when no browser is open. Set up one of these services, restart the server, then open **Settings → Reminders**: it shows whether push is on, and **Send a test** sends a test message.

*Option A: ntfy (free, easiest)*

1. Install the ntfy app on your phone (App Store or Google Play/F-Droid). Allow notifications for it when asked (needed on iOS).
2. In the app tap **+** and subscribe to a topic. Pick a long random name nobody could guess, such as `weekboard-k7q2x9m4zr81`. Leave the server as the default (ntfy.sh). **ntfy.sh topics are public, not private webhooks:** there is no sign-in, so anyone who knows or guesses the topic name can subscribe and read every reminder, including the task text. Treat the name like a password and never post it anywhere. For real privacy, reserve the topic with an ntfy account and set `NTFY_TOKEN`, or run your own ntfy server and set `NTFY_URL`.
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

**On the phone page (1.5.3): Time blocks and hiding estimates**

- **Time block a task.** Tap a task's **⋯** and choose **🕐 Time block…** (**🕐 Change time block…** when it has one). Pick a start time and a length (15 minutes to 8 hours); the sheet shows when it ends. On today it starts at the next half hour, on other days at 9:00. **Save** writes the same markers as the desktop panel: the start time (`^10:30am`) and, when you change the length, the task's estimate (`~1h`). The block then shows on the desktop board's timeline and as a badge on the phone. A task without an estimate is a 30-minute block. **Remove time block** takes off the start time and keeps the estimate. Undo works as for other changes, and bold or other formatting in the task is kept.
- **Time block badges.** A blocked task shows the desktop's badge at the right of its first line (a long title wraps underneath it), so most blocked tasks take a single line: **blue** with the time and length ("3:00 PM · 1h 30m"; just the time when the task has no estimate), **green ▶ NOW** while today's block is running (it follows the clock without reloading), **yellow ⚠** with the time when it overlaps another open block on the same day (tasks inside groups count), and faded once the task is done. Other chips (priority, estimate, reminder, repeat) stay on the line below.
- **Hide estimates.** **⋯ > Settings > Hide estimates** leaves the ⏱ estimate chip off tasks. A time block's badge still shows its length. With **Share settings across my devices** on, your other devices get the same choice.
- **Switched off on the board?** When **Settings > Writing features > Time blocking** is off on the desktop board, the phone's task menu has no Time block item.

**On the phone page (1.5.3): Encrypting words in a note**

- **The header.** **‹ Notes** (top left) goes back to the list; the note is saved as you type, so there is nothing to confirm. A grey lock before the title marks a note with encrypted text. It's only a marker, and the same lock shows in the notes list. The button on the right says what it will do: **Unlock**, **Encrypt** (greyed until you select words) or **Decrypt**.
- **Encrypt.** Select the words and tap **Encrypt**. The first time, it asks for your Encryption passphrase. If there's encrypted text it can check the passphrase against, you type it once; otherwise you type it twice so a typo can't lock words away. The words then show as `⟦7788⟧` and are encrypted when the note saves, a second after you stop typing. WorkFlowy only gets the `wbenc1.…` text, and the desktop board and the add-on read it with the same passphrase. On a phone, the system's Copy / Paste bar appears when you select; tap **Encrypt** in the header, not in that bar.
- **A locked note.** Encrypted text you can't read shows as `‹secret›` (`‹secret 1›`, `‹secret 2›` … when there are several), and the note is read-only. Tap **Unlock** and enter the passphrase (or unlock first with **⋯ > Unlock encryption…** on the main page). A note that is all encrypted shows "This note is encrypted" with an **Unlock** button in the middle. In the list, its preview reads "Encrypted note".
- **Edit an unlocked note.** Each encrypted part shows as ⟦readable⟧ text that you can change. A part you leave alone keeps its old encrypted text.
- **Decrypt.** Put the cursor inside a ⟦part⟧ and tap **Decrypt**; the words are saved as plain text.
- **Locking.** The note's **⋯ > Lock encryption**, the main page's **⋯ > Lock encryption**, a reload or five minutes away forgets the passphrase. An open note is saved encrypted first and then shown locked. Closing a note doesn't lock anything. If a ⟦ or ⟧ is left without its partner, the note isn't saved and the status line says why, so readable text never reaches WorkFlowy by mistake.
- **Not covered:** a note's title, and tasks or other lines on the phone, still can't be encrypted. Use the desktop board for those.

**On the phone page (1.4.0): Notes**

- **Set it up:** open **⋯ > Settings > Notes location** and paste a WorkFlowy node link (or its id). Notes live as children of that node. **Remove** clears it. With **Share settings across my devices** on, your other devices get the same location.
- **Use it:** the **📝 Notes** button appears under Past due / Upcoming / Inbox, with the number of notes (since 1.5.3). **＋ New note** starts a note titled "Notes · Thu, Nov 5". Tap the title to rename it, and type in the note below; it saves a second after you stop, and again when you leave the page. **‹ Notes** closes it, and an untouched new note is discarded. **⋯ > Delete note** asks first and can't be undone.
- **Good to know:** the title is plain text (bold or links in an old title are dropped when you rename), and a note with encrypted text opens read-only until you unlock it (see "Encrypting words in a note" above). This is separate from the day's **All-day notes** below.

**On the phone page (1.3.7):**

- **All-day notes.** Each day shows its notes in a box above the tasks. A note is a plain bullet on the day marked `!alld` (hidden; `!alld1` to `!alld9` set the order, lowest first). Lines under an old `WB-Notes` bullet show after them. Tap a note to edit, reorder (**Order** select) or delete it, tap **+ All-day note**, or tap **☑ Checklist** to add a `!list` checklist. A checklist shows in the box as a row with ☑, its done count ("2/5") and a › that opens it.
- **Early alerts.** The reminder sheet has **1 hour / 1 day / 1 week** checkboxes (`!1h`, `!1d`, `!1w`), plus **Save early alerts only**. A task without a time counts as 9:00 am. Removing the reminder removes its early alerts.
- **Repeat.** **🔁 Repeat…** in a task's menu opens the same choices as the desktop (every day, weekdays, week, 2 weeks, chosen weekdays, month, last day of the month, year, with an optional end date or number of times). The server makes the next copy, so it must be running.
- **Tags and people.** `#tag` and `@person` are grey and underlined; a tap opens **Search**, which is also in **⋯ > 🔍 Search…**. Tap a result to open it.
- Still desktop only: tables and the weekend column. The Sunday start is **Settings > Week length > 7 days (Sun–Sat)**.

## Markdown notes (optional add-on)

The included **markdown** add-on (`addons/markdown/`) makes notes Markdown-aware, on the desktop **Notes window** and in the **phone's note editor**. Notes stay plain text: the add-on only helps you type Markdown and shows a preview. Delete the folder, or turn it off under **Settings > Markdown**, and notes are as before.

- **Format bar.** Above the note: **B** bold, *I* italic, code, **Link**, **H** (press again for a smaller heading, then none), bulleted list, numbered list, task list (`- [ ]`), quote, code block and horizontal rule. Lists, tasks, quote and heading apply to every line you've selected, and press again to take them off. On the desktop, Ctrl/Cmd+B, Ctrl/Cmd+I and Ctrl/Cmd+K do bold, italic and link. Bold and the other buttons use the browser's typing, so Undo works. On the phone, the bar sits under the header and scrolls sideways.
- **Preview.** The **Preview** button at the end of the bar shows the note formatted; **Edit** brings the text back. Notes open in Edit (a new note always does); **Settings > Markdown > Open notes in** can open existing notes in Preview. The preview is read-only, including task checkboxes. A line break in a note stays a line break.
- **Supported:** headings (`#` to `######`), `**bold**`, `*italic*`, `` `code` ``, fenced code blocks, `[links](https://…)` and plain `https://` addresses, `>` quotes, `-` / `*` / `1.` lists (nested by indent), `- [ ]` / `- [x]` tasks and `---` rules. Images are not shown. Only `http`, `https` and `mailto` links are made (they open in a new tab); anything else shows as plain text. The preview is built without HTML, so a note can't run anything.
- **With encryption.** Text inside `⟦ ⟧` is shown as it is (highlighted) and never read as Markdown. The format bar leaves it alone: a selection that reaches into an encrypted part grows to cover all of it, and a cursor inside one gets a message. When a note locks (Lock, the idle lock, closing) the preview is cleared and shows the locked text.
- **Plain notes list.** With **Plain notes list** on (default), the one-line previews leave out `#`, `**`, `-`, link addresses and fences. Only the display changes.
- **Settings (desktop: Settings > Markdown).** Markdown in notes (on / off), Open notes in (Edit / Preview), Format bar, Keyboard shortcuts, Plain notes list. They are saved by the server in `markdown-settings.json` next to `server.js` (`MARKDOWN_SETTINGS_FILE` moves it), so the desktop and the phone use the same ones. The phone has no settings tab for add-ons; it reads them when a note opens and when the page comes back to the front, so a change shows on the phone the next time it opens a note. Until the settings arrive the add-on is off, so a page never flashes a bar that you've switched off.
- **Install.** Copy `addons/markdown/` next to `server.js` (with board 1.5.4 or newer) and restart. Details are in `addons/markdown/README.md`.

## Encryption (optional crypt add-on)

WorkFlowy can read what you store in it, so the included **crypt** add-on lets you encrypt the sensitive parts of a name or note *before* it goes into WorkFlowy. WorkFlowy then holds unreadable `wbenc1.…` text, and only someone with your passphrase can read it. Everything is done in your browser with AES-256-GCM; the passphrase is never saved, never sent to the board's server and never sent to WorkFlowy.

- **In the item editor:** select words and press the **🔒 Encrypt** button (or Alt+Shift+E (or Ctrl+Shift+E)), or press it with nothing selected to protect the whole name (`@times`, `#tags` and `@mentions` stay readable, so reminders still work). While you are unlocked, encrypted parts show as `⟦readable⟧` and are encrypted again when you save. The button is **🔓 Unlock** when a line holds encrypted text and you are locked.
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
- Lines added from the add box go straight onto the day the Daily page is showing (today unless you stepped back); a `[ ]` todo there is a day task and appears on the board.
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
- **Signing out wipes this browser's copy (1.0.8; phone page 1.3.8).** In hosted modes, the desktop page's **Sign out** also clears the notes bullet name, saved filters and every saved setting from the browser, and since 1.3.8 the phone page's **Sign out** does the same, so nothing is left behind on a shared device. In local mode there is no sign-in, so neither page shows Sign out. (You'll set your options again next time.)
- Search, the Done window and Saved filters all read the server's in-memory copy of your outline, so the same rules apply (idle purge, login in hosted modes). Each only receives the results it asks for. A saved filter is capped at 50 words, so a huge filter can't keep the server busy.
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
- Dragging a card to another day is remembered by Undo too, but touch screens still can't drag: use the calendar icon or the select button there.
- Settings, which lines you've collapsed, the last line type you picked for new lines, and the crypt add-on's switches and check value are stored in the browser (`localStorage`), so they're per browser.
- Day totals of estimated time, and the Plan day hours meter, are on the desktop board only. Priorities and estimates can be set from the right-click menu on desktop cards; elsewhere, including the phone page, type the markers into the task.
- Sorting by priority applies to the week board, Plan day and the phone page's days, Past due and Upcoming. Panes, the Daily page, the item window and the phone's Inbox keep the outline order.
- Saved filters' `due:overdue` looks back 60 days.
- The line-type buttons don't appear on board cards, group titles, or on headings, quotes and code lines. A numbered list that starts from a number other than 1 in WorkFlowy shows from 1 on the board.
- The board relies on WorkFlowy's calendar nodes and the API as documented at <https://beta.workflowy.com/api-reference/>. It is tested against a mock of that API (Saved filters' date lookups were also checked read-only on a real account), so report anything that behaves differently on yours.

- **Calendar column (Panes):** always live, with no pencil/book button. Click a line and type. Lines are tasks: the type can't be changed there and new lines are created as tasks. **Enter** goes to the next line, like a card; on the last line of a day it starts a new one. Shift+Enter (note), Ctrl/Cmd+Shift+E (encrypt) and Tab work as in the other panes. Task lines show 🔔 (reminder), 📅 (move to a date, with Undo) and ✕ (delete) when you hover over them; they hide while you type in the line.

- **Daily page add box.** The Daily page always has a **+ Add a task or line** box under its lines (it used to show only on an empty page). The small type button beside it chooses bullet, task or numbered line. The box at the bottom of the page still adds notes under the notes bullet. The all-day band on the week board refreshes after Daily page edits and when you come back to the tab.
- **All-day notes.** Under each day's title on the week board, the day's all-day notes (plain bullets marked `!alld`, plus lines under an old `WB-Notes` bullet) show in a tinted band, like an all-day strip on a calendar. Click a line to type in it (saved about a second after you pause); **Enter** adds another line at the bottom, and **Backspace** on an empty line removes it, and right-click on a note offers **Delete this note** (it asks first). A day with no notes shows a small note icon in the day's icon row (**Add an all-day note**), which creates a `!alld` bullet on the day the first time you type. Right-click a note → **Order…** sets `!alld1`–`!alld9`. Only the top level lines show. Settings → Week board has **All-day notes** (on/off) and **Note lines shown** (1, 2, 3, 5 or All, default 3); the rest fold under **+ n more** and **Show less**. The Weekend column has a band for each day. Notes with encrypted words show a 🔒 and can be edited around. Dragging a note to another day is not built yet.
- **Weekend column (5 days shown).** When Saturday or Sunday has tasks, an extra **Weekend** column appears after Friday, headed "Weekend · Sat 2 / Sun 1" (open tasks). It has a section for each day with its own add box, and you can drag tasks onto a section. It follows **Hide completed**, and it is hidden when both days have nothing to show. With 3 or 7 days it is not used.
- **Week starts on (7 days shown).** With 7 days the week starts on Monday. To start on Sunday, choose it in Settings, in **Week starts on**, which shows only while 7 days are selected. 3 and 5 days always start on Monday.
- **Right-click on a week-board card** opens a small menu: Mark done / Mark not done, Edit the note…, **Set a reminder…** (or **Change the reminder…** when the task has a time, 1.3.9), Repeat…, the Priority and Estimate rows, and Encrypt (or remove encryption). With **Edit cards in place** off, the menu is shorter: Mark done, Set a reminder… and Repeat…. It works on the text and on the rest of the card. Error messages at the top of the board have a **Dismiss** button.
- **Early reminders (1 hour, 1 day, 1 week before).** The 🔔 popup has **Also remind me before:** with three boxes, and you can tick any of them. They are stored in the task's text as `!1h`, `!1d` and `!1w` next to the `@time` (for example `Dentist @2:30pm !1d !1w`), so they travel with the task in WorkFlowy. A task with no time counts as 9:00 am, so `!1d` on it alerts at 9:00 am the day before. **Save early alerts only** keeps the time as it is. Each early alert shows the board popup and goes through ntfy or Pushover like a normal reminder, with a title such as "In 1 day · 14:30". An alert whose moment has already passed by more than 15 minutes when the server looks is skipped. The markers are hidden on the cards and shown as `🔔 2:30 PM · 1d` on the badge; Remove reminder clears them. On the phone page the markers show as part of the text, and removing a reminder there removes them too. Restart the server for the push side.
- **Move a line to a day.** Right-click any line in the Panes, the Daily page or the item window and choose **Move to a day…**. Pick a date in the popup (Today, Tomorrow, Mon, or any date). The line moves there with everything under it, at the bottom of the day. A bullet or numbered line becomes a task, because only tasks show on a day; headings keep their type and a note says they will not show until they are tasks. **Undo** puts the line back where it was, with its old type.
- **Tables (Daily page and item window).** A WorkFlowy table shows as a grid: the first row is the header. Click a cell to type in it; it saves about a second after you pause. Adding or removing rows and columns stays in WorkFlowy (the link under the grid opens it); "Show as outline" shows the table as plain lines (remembered in this browser); a "Show as grid" link on the Table line brings the grid back. Right-click a line and choose "Copy raw data (for support)" to copy its structure.
- **Disable the original double-click edit in read mode (Settings → Week board, and the same switch in Panes; off by default).** One global setting for the whole desktop. Ticked: read mode (the open-book button in Panes columns, the Daily page and the item window) only reads, and week-board cards and groups with “Edit cards in place” off no longer open the double-click editor (including a group's rename and sub-item clicks). Use the pencil to type. So that editing always has a path, ticking this also turns “Edit cards in place” on and locks it on (with a note), because week-board cards have no pencil. Checkboxes, buttons and Ctrl/Cmd+click to open an item still work.

- **Lines with encrypted words stay editable.** A line or card that contains locked (encrypted) words opens as a normal text box. Each locked part shows as 🔒 (🔒₁, 🔒₂ when there are several) and is saved back unchanged, so you can add or change the plain words around it without the passphrase. Removing a 🔒 asks first (saying no puts it back). Ctrl/Cmd+Shift+E on such a line unlocks the words (passphrase) so you can edit inside them. After you encrypt words with the hotkey the line stays open with the cursor after them; it locks when you leave it.
