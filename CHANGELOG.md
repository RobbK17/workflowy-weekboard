# Changelog

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
