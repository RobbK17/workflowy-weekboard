# Workflowy Week Board: AI Assistant (beta)

**Beta notice.** The Assistant is an early feature for testers. It is an optional add-on (a folder in `addons/`) and stays completely hidden unless you install it and turn it on as described below. It has been tested against stand-in (mock) Ollama and Anthropic servers, not extensively against the real services, so expect rough edges and please report what you find. Everything in the main README still applies.

## What it is

A chat panel inside the board. You can ask about your tasks in plain language, have it add tasks or groups, tick off, move or rename tasks, set reminders, add notes, and have it drive the board's view ("show next week"). It works against your WorkFlowy outline through the board's own server.

It runs in local mode (`DEPLOY_MODE=local`). In `vps` or `fly` mode (for example the board behind Tailscale) it loads but stays off unless you also set `AI_ALLOW_REMOTE=1`; then anyone who signs in to the board can use it, and your Anthropic key.

## Installing the add-on

The Assistant is an add-on: a folder, `addons/assistant/`, next to `server.js` and `index.html`. The board works exactly as before without it.

1. Copy the whole `assistant` folder into an `addons` folder beside `server.js` (create `addons` if it doesn't exist). The folder holds `manifest.json`, `backend.js` (the server part), `page.html`, `page.js` and this file.
2. Restart the board with `AI_PROVIDER` set (see "Turn it on"). It needs board 1.5.5 or newer; an older board skips it and says why at startup. The startup line should say `Add-ons loaded: assistant 0.4.0`.
3. To remove it, delete the folder and restart. Nothing else changes, and the page has no trace of it.

If something is wrong (a missing file, a version the board is too old for), the board starts normally without it and prints a line saying why. `http://localhost:3000/addons` lists every add-on and its status.

In `vps` and `fly` mode the Assistant loads but is off unless `AI_ALLOW_REMOTE=1` is set.

## Choose a model provider

| Provider | Where your chat goes | Needs |
|----------|----------------------|-------|
| **Ollama** (recommended to start) | Stays on your computer. | Ollama installed and a model that supports tools. |
| **Anthropic** | Your messages, and the outline text the assistant reads while answering, are sent to Anthropic's API. | An Anthropic API key (usage is billed to you). |

### Ollama setup

1. Install Ollama: download it from ollama.com/download (Mac, Windows), or on Linux run `curl -fsSL https://ollama.com/install.sh | sh`.
2. Get a model that supports tool calling, for example `ollama pull llama3.1` or `ollama pull qwen3:8b`. About 8 GB of RAM is a sensible minimum for these. Very small models (about 3B parameters or less) often handle tools poorly.
3. Check it's running: open `http://localhost:11434` in a browser. It should say "Ollama is running".

The first question is slow while the model loads into memory. Speed after that depends on your hardware.

### Anthropic setup

Create an API key in the Anthropic Console and set `ANTHROPIC_API_KEY`. Choose a model with `ANTHROPIC_MODEL` if you don't want the default.

## Turn it on

There are two switches, so it stays off unless someone means it.

1. **Server:** start the board with `AI_PROVIDER` set.
   - Mac/Linux: `AI_PROVIDER=ollama OLLAMA_MODEL=qwen3:8b DEPLOY_MODE=local node server.js`
   - Windows PowerShell: set `$env:AI_PROVIDER="ollama"` and `$env:OLLAMA_MODEL="qwen3:8b"`, then start as usual.
   - Anthropic: `AI_PROVIDER=anthropic ANTHROPIC_API_KEY=... DEPLOY_MODE=local node server.js`

   Without `AI_PROVIDER`, the Assistant tab in Settings and the header button do not exist at all.
   - **In `vps` or `fly` mode** (for example the board behind Tailscale) also set `AI_ALLOW_REMOTE=1`, or the Assistant stays off. See "Using it when the board runs in vps or fly mode" below.
2. **Browser:** open **Settings → Assistant** and tick **Enable AI Assistant**. This is per browser and off by default. The **Assistant** button then appears in the header.

## Using it when the board runs in vps or fly mode

In `DEPLOY_MODE=vps` or `fly` (for example the board on your Mac behind Tailscale, reached from a phone or tablet) the Assistant loads but stays **off** until you also set `AI_ALLOW_REMOTE=1`. This is a deliberate extra switch. Once it's on, anyone who can sign in to the board can chat with the assistant, have it read your outline, propose changes (still with approval), and spend your Anthropic key. Behind a private network and a strong `BOARD_PASSWORD` that is you; on a public address it is anyone with the password.

Example (Anthropic, board behind Tailscale):

```
DEPLOY_MODE=vps WORKFLOWY_API_KEY=... BOARD_PASSWORD=... PUBLIC_URL=https://my-mac.tail1234.ts.net ASSUME_HTTPS=1 AI_PROVIDER=anthropic ANTHROPIC_API_KEY=... AI_ALLOW_REMOTE=1 node server.js
```

- Ollama still has to be reachable from the computer running the board (`OLLAMA_URL`), not from your phone.
- Chat history is kept in the browser you use, so the phone, the tablet and the computer each have their own.
- The browser switch (Settings → Assistant → **Enable AI Assistant**) is per browser and per address. The Tailscale address counts as a different address from `localhost`, so tick it again there.
- Check `https://<your address>/ai/status` while signed in: `"enabled": true` means the server side is on. If it says `The assistant is off when the board runs in vps or fly mode`, `AI_ALLOW_REMOTE=1` isn't set.

## Using it

Click **Assistant** in the header to open the side panel. Enter sends, Shift+Enter adds a new line, Esc closes the panel.

**Answers appear as they're written**, word by word, and what it looks up shows as it happens ("· Searched “budget”"). While it works, **Send** becomes a red **Stop** button: it cancels the answer at once, keeps what was written so far (marked "■ Stopped"), and stops the model call, so nothing more is charged. Stop only pauses for the moment it takes to apply changes you approved, so their Undo can't be lost.

**What an answer used** shows in small grey text under it: the number of model calls, input tokens (and, with Anthropic, how many came from the cache), and output tokens. Hover it for what the cache means.

**Looking things up.** It can search your whole outline, read any day (including the Daily page notes, and tasks inside groups), and it is given the open tasks on the days shown on the board. Examples: "What's on my plate today?", "Find tasks about the budget", "What's due Friday?"

**Changing tasks.** It can add a task or a group (a bullet that holds tasks, optionally with tasks inside it), tick or un-tick a task, move an item to a date (or another item, or your Inbox), rename an item, set or remove a reminder, and add a note. Every change appears as an approval card with a checkbox per change. Choose **Apply** (unticked changes are skipped) or **Deny all**. Nothing changes before you approve. Applied changes appear in the board's undo toast. Deleting is off unless you turn on **Allow deleting** (see Settings).

**Scheduling (time blocks and estimates).** It reads and writes the board's own markers, so what it sets shows on the timeline, the desktop and the phone:
- "Block 2 hours tomorrow at 10 for the budget": it finds the task (or adds it), moves it to that day if needed, checks the day for clashes, and proposes a time block (`^10am`) with the length as its estimate (`~2h`).
- "Move the budget block to 2pm", "remove the time block", "the report takes 45 minutes" (an estimate, `~45m`).
- "What's my schedule today?", "When am I free on Friday?": the day's blocks in order, overlaps, and free gaps in an assumed 8:00–6:00 working day, plus the tasks with no time.
- "Am I overbooked this week?", "How busy is next week?": per day, open tasks, total estimated time, tasks with no estimate and overlaps, against your **Plan day hours** (Settings), or a normal 8-hour day if you haven't set them.
- New tasks can come with a time, length and priority in one go: "add Gym at 7am for an hour, medium priority".

**Priorities.** "Make that urgent" (`!p1`), "set the report to low" (`!p4`), "no priority". "What are my urgent tasks this week?" and "what has no estimate?" use the board's **Saved filter** words (`p:1-2 due:week`, `est:none` and the rest), across your whole outline.

Renaming a task keeps its markers (priority, estimate, time block, reminder, repeat and the rest): it only changes the words.

**Your Notes.** With a notes location set (Settings > Week board > Notes, or the phone's Notes location) it can list your notes, read one, start a new note, and add to the end of one ("add 'call the bank' to my Errands note"). It never replaces a note's text. Encrypted words in a note stay `‹secret›`.

**Reminders.** "Remind me about this at 3pm" writes ` @15:00` into the task's text, the same as pressing the 🔔 on its card, and "remove the reminder" takes it out. The reminder fires on the day the task sits on, so for another day ask it to move the task there first. A task with a WorkFlowy date tag keeps its time in WorkFlowy: the Assistant won't change that.

**Notes.** "Add a note: call the plumber" adds an **all-day note** to a day (the box at the top of the day, the same as **+ All-day note** on the board), by default on the day the Daily page shows, or on a day you name. Several notes can be separated by `|`. Undo removes what it added. It doesn't write into your Notes window (the notes node) yet.

**Inbox.** "Put it in my Inbox" uses the Inbox set on the board (**Settings > Week board > Inbox**), the same one the 📥 button opens. Only when none is set does it use WorkFlowy's own Inbox.

**Encrypted text.** Words you encrypted with the Encrypt add-on are never sent to the model: it sees `‹secret›` in their place, in tasks, notes, search results and the board summary. It can't read them, and with Anthropic nothing encrypted leaves your board. It can rename an item that has encrypted words only if the new name keeps every `‹secret›`; each is then put back as the original encrypted text, unchanged. A rename that would drop or add one is refused before you see an approval card. It also won't write `‹secret›` into new tasks or notes.

**Controlling the board.** These only change what the page shows, the same as clicking the matching button, so they run straight away without an approval card:
- week: "show next week", "show the previous week", "go to 2026-11-02", "back to today"
- days shown: "show 7 days" (3, 5 or 7)
- Daily page: "open Friday in the Daily page"
- options: hide completed, Past due, Upcoming, sub-items, hide or show the sidebar
- Nested mode: off, group or flatten
- Plan day: "open Plan day for Monday", "close Plan day"
- item editor: "open that item for editing". It opens the item in the same editor window Search uses (text, note, tick, add and indent lines).

If the assistant gives a bad value you see a ⚠ line saying what was wrong, and the board stays as it was.

**Dates.** It is told today's date. "Next Monday" on a Sunday means tomorrow. The approval card shows the target date, so check it before approving, or give an explicit date.

## On the phone

**Off by default: the Assistant is desktop-only** unless you start the server with `AI_PHONE=1` as well. Then, on the phone page, **⋯ > ✨ Assistant…** opens the same assistant full screen. Without it the phone's menu has no Assistant item and the server refuses requests from the phone page. This keeps your Anthropic key from being used from a phone unless you choose to (with `AI_ALLOW_REMOTE=1`, anyone who signs in to the board on a phone could otherwise use it). It streams, has **Stop**, approval cards and **Undo** like the desktop, and knows the days the phone shows, the day you have open, your Inbox and your Notes. Two things are desktop-only: the board tools ("show next week", "open that item"), which the phone leaves out, and deleting, which stays off. The phone keeps one conversation while the page is open; **New chat** starts again. It uses the server's default model.

## Settings → Assistant

| Setting | What it does |
|---------|--------------|
| **Enable AI Assistant** | Shows or hides the header button in this browser. Off by default. |
| **Model** | Overrides the server's default model for this browser. With Ollama your installed models are suggested. Leave empty for the default. |
| **Default scope** | What "my tasks" means when you don't name a date: *Days shown on the board* (default), *Board plus Past due and Upcoming*, or *All open tasks* (it may also search your outline). The assistant is given those tasks up front. |
| **Standing instructions** | Free text (up to 1,000 characters) sent with every message, for example "Keep replies short" or "Open tasks means this week plus Past due". They cannot allow deleting, or changing things without your approval. |
| **Changes** | *Ask before changing* (default) or *Read-only*, where it can look but never proposes changes. |
| **Allow deleting** | Off by default. When on, it can propose deleting an item and everything under it, only when you asked for that specific item. The approval card names the item and counts its sub-items, and the toast has **Undo** (the restored copy gets new ids; very large items, over 300 sub-items, are only partly restored). It never deletes day pages, a day's notes bullet, your Inbox, your Notes node or a Plan day source, nor anything that holds one of them. At most 5 deletes are accepted per request. It never applies in Read-only mode. |

Model, scope, instructions and the other Assistant settings are saved in this browser only.

## Saving chats

The panel header has **Save**, **History** and **New chat**.
- A chat only lives in the page until you save it. **New chat**, reloading the page or closing the tab erases an unsaved chat.
- **New chat** (or opening another chat from History) asks whether to save an unsaved conversation first: Save, Don't save, or Cancel.
- **History** lists saved chats (newest first, up to 30) to reopen or delete. They are kept in this browser's local storage only, never on the server, and are lost if you clear the browser's site data.
- A reopened chat is a record, not a live session: approval cards are not restored, and undoing earlier changes is only possible from the board's undo toast during that session.

## Configuration

Set these as environment variables, the same way as `WORKFLOWY_API_KEY`.

| Variable | Default | Purpose |
|----------|---------|---------|
| `AI_PROVIDER` | `off` | `ollama` or `anthropic` turns the feature on (in `vps`/`fly` mode also set `AI_ALLOW_REMOTE=1`). |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Where Ollama is listening. Set only here, never from the browser. |
| `OLLAMA_MODEL` | `llama3.1` | Default Ollama model. |
| `OLLAMA_NUM_CTX` | `16384` | Context size passed to Ollama. The tools, instructions and board summary need about this much; lower it only on a machine short of memory (things may then be cut off), raise it if long days or many tasks still get cut off. |
| `ANTHROPIC_API_KEY` | none | Required with `anthropic`. |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` | Default Anthropic model. |
| `AI_ALLOW_REMOTE` | unset | Set to `1` to allow the Assistant when the board runs in `vps` or `fly` mode. Without it the Assistant is off there. Has no effect in local mode. |
| `AI_MAX_STEPS` | `8` | Most model calls for one question (maximum 20). |
| `AI_WF_BUDGET` | `60` | Most live WorkFlowy reads for one answer before the tasks inside groups are taken from the board's outline copy instead (see "WorkFlowy's request limit" below). Maximum 400. |
| `AI_PHONE` | unset | Set to `1` to offer the Assistant on the phone page too (⋯ > ✨ Assistant…). Without it the Assistant is desktop-only. |

**Cost with Anthropic (prompt caching).** The tool list and the fixed instructions are the same for every question, the board summary stays the same for one question, and each step of an answer only adds to the conversation. The Assistant marks those three parts for Anthropic's prompt cache, so the second and later model calls within about five minutes read them from the cache, billed at a tenth of the normal input price, instead of paying for them again. Writing to the cache costs a little more than normal input, once. With several steps per question this is usually most of the input. Nothing to set up.

## WorkFlowy's request limit

WorkFlowy limits how fast it can be asked for things, and a question like "how busy are the next two weeks?" means reading 14 days and the groups on them. The Assistant keeps that down:
- Within one answer, each day and each group is read from WorkFlowy **once**, however many tools look at it. After you approve a change, it reads again, so it never works from out-of-date tasks.
- Each day's own list is always read live. After `AI_WF_BUDGET` live reads in one answer (60 by default), the tasks inside groups come from the board's outline copy instead, the same copy Search uses, which can be a few minutes old. The answer says when it did that.
- If WorkFlowy answers "busy" anyway, the Assistant stops reading, tells you which days it got and which it couldn't, and suggests asking again in a minute, instead of failing the whole answer.

## Testing

`node addons/assistant/test/run.js` (from the board's folder) runs the Assistant's tests against fake WorkFlowy, Anthropic and Ollama servers in the `test` folder: no network, no API keys, and nothing written outside a temporary folder. Each suite gets fresh fakes and a fresh board on free ports, and the command exits with 1 if anything fails. Name a suite to run just that one: `safety` (encrypted text, renames, the delete guard, Inbox and notes), `streaming` (streaming, Stop, prompt caching), `features` (scheduling, priorities, filters, Notes, the phone switch), `requests` (WorkFlowy's request limit) or `ollama`.

## What it can and cannot do

- **Can:** search, read days and items, add / tick / un-tick / move / rename, set reminders, time blocks, estimates and priorities, add all-day notes, create and add to notes in your Notes (all with approval), delete if you turn on Allow deleting, read schedules and workload, find tasks with filter words, change the board's view (desktop).
- **Cannot:** change anything without approval, read or change encrypted words, replace or edit the existing text of a note (it only adds to the end), set a task's note field, or reach anything outside your WorkFlowy outline and the board.
- It sees one outline: yours, through your WorkFlowy key. Text it reads from your outline is treated as data, not instructions, but a small local model can still be fooled by odd text, so review each change before approving.

## Privacy and security

- **Ollama:** nothing leaves your computer.
- **Anthropic:** the chat, your standing instructions, a summary of the board's open tasks (with ids) and any outline text the assistant reads while answering are sent to Anthropic, with encrypted words replaced by `‹secret›`. Use Ollama if that isn't acceptable.
- The WorkFlowy key never reaches the browser or the model. The model can only use the fixed tools above, and the server checks every argument (ids, dates, text length) before acting.
- The assistant's endpoints sit behind the same checks as the rest of the board (reachable only at the board's own address, cross-site writes refused; in vps/fly mode only after you sign in). The chat is limited to 256 KB per request.
- With `AI_ALLOW_REMOTE=1` the Assistant is available to everyone who can sign in to the board, so keep `BOARD_PASSWORD` strong and the address private. Leave it unset to keep the Assistant for local use only.
- Pending approvals are held in server memory for 15 minutes, then dropped. Restarting the server also drops them.

## Troubleshooting

- **No Assistant tab or button:** the `addons/assistant` folder isn't next to `server.js` (check the startup messages for `Add-on "assistant" not loaded`, or open `/addons`), the server wasn't started with `AI_PROVIDER`, or the board is in `vps`/`fly` mode without `AI_ALLOW_REMOTE=1`.
- **Assistant not available in vps/fly mode:** set `AI_ALLOW_REMOTE=1` (and `AI_PROVIDER`, plus `ANTHROPIC_API_KEY` for Anthropic) and restart. In `/addons` it should show as loaded; `/ai/status` says why if it's still off. An older copy of the add-on whose `manifest.json` has `"localOnly": true` is skipped in these modes with `only works in local mode`: set it to `false`.
- **Tab is there but the button isn't:** tick **Enable AI Assistant** in Settings → Assistant.
- **"Can't reach Ollama":** start Ollama and check `http://localhost:11434`. If it runs elsewhere, set `OLLAMA_URL`.
- **Answers like "I listed your tasks" with no tasks, or wrong tools:** the model is too small for tool use. Try `qwen3:8b` or larger, or Anthropic.
- **Misses tasks beyond the days on the board:** set **Default scope** to include Past due and Upcoming, or name a date.
- **Slow or cut off:** raise `OLLAMA_NUM_CTX`, or use a smaller board (fewer days shown) so the up-front summary is shorter. The summary is capped at about 9,000 characters.
- **A change failed:** you see a ⚠ line with WorkFlowy's message. Nothing else is applied for that item.

## Known limitations (beta)

- Local models vary a lot in how well they follow tool instructions.
- Chats are not synced between browsers.
- The Anthropic and Ollama connections have only been tested against mock servers during development.
- Board controls change the view in the browser you are using, not in any other open tab.

## Changes

**0.4.0**
- Time blocks and estimates: `set_time_block`, `set_estimate`, `day_schedule` (blocks, overlaps, free gaps), `workload` (per day against your Plan day hours), and `add_task` with `start`, `length` and `priority`. What it reads shows each task's markers in plain words.
- Priorities: `set_priority`, and `find_tasks` with the board's Saved filter words (needs board 1.5.5).
- Your Notes: `list_notes`, `read_note`, `create_note`, `append_to_note`, only in the notes node the board uses.
- Renames keep a task's markers; text the model writes keeps `&` and `<` as typed (escaped for WorkFlowy); approval cards show a task's words without its markers.
- The phone page can have the Assistant (⋯ > ✨ Assistant…, needs board 1.5.5), but only when the server sets `AI_PHONE=1`; by default it is desktop-only and the server refuses phone requests.
- While an answer streams, a model's words before a tool now stay above the step they led to.
- Fewer WorkFlowy requests: each day and group is read once per answer (again after a change); past `AI_WF_BUDGET` live reads, groups come from the board's outline copy; a "busy" answer from WorkFlowy gives a partial result that says which days are missing.
- Needs board 1.5.5 (it uses the filter engine and the phone menu hook that version adds). Ollama's default context is now 16,384 tokens (`OLLAMA_NUM_CTX`), since the larger tool list didn't fit well in 8,192.
- Tests in `test/`: fake WorkFlowy, Anthropic and Ollama servers and five suites (90 checks), run with `node addons/assistant/test/run.js`.

**0.3.0**
- Answers stream in as they are written (Anthropic and Ollama), with a **Stop** button that cancels the answer and the model call. Steps show as they happen; approved changes hand over their Undo as soon as they're applied.
- Prompt caching with Anthropic: the tools and fixed instructions, today's context (board summary) and the conversation so far are cached, so later steps and questions re-read them at a tenth of the price.
- A grey line under each answer shows model calls, input tokens (and cached), and output tokens.
- The server still answers the old way (one JSON reply) when the page doesn't ask for a stream.

**0.2.1**
- Encrypted words are shown to the model as `‹secret›` everywhere (tasks, notes, search results, paths, the board summary, the item editor's reply), so neither the model nor Anthropic receives encrypted text. A rename has to keep every `‹secret›`, and each is put back as the original encrypted text; new tasks and notes can't contain one.
- Deleting never removes your Inbox, your Notes node, a Plan day source, a day's notes bullet (any name) or anything that holds one of them.
- `inbox` means the Inbox set on the board; WorkFlowy's own Inbox only when none is set.
- "Add a note" makes an all-day note (`!alld`) on the day, as the board does, instead of a line under the old notes bullet.
- The default Anthropic model is now `claude-sonnet-5-5`.
