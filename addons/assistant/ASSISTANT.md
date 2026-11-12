# Workflowy Week Board: AI Assistant (beta)

**Beta notice.** The Assistant is an early feature for testers. It is an optional add-on (a folder in `addons/`) and stays completely hidden unless you install it and turn it on as described below. It has been tested against stand-in (mock) Ollama and Anthropic servers, not extensively against the real services, so expect rough edges and please report what you find. Everything in the main README still applies.

## What it is

A chat panel inside the board. You can ask about your tasks in plain language, have it add tasks or groups, tick off, move or rename tasks, set reminders, add notes, and have it drive the board's view ("show next week"). It works against your WorkFlowy outline through the board's own server.

It runs in local mode (`DEPLOY_MODE=local`). In `vps` or `fly` mode (for example the board behind Tailscale) it loads but stays off unless you also set `AI_ALLOW_REMOTE=1`; then anyone who signs in to the board can use it, and your Anthropic key.

## Installing the add-on

The Assistant is an add-on: a folder, `addons/assistant/`, next to `server.js` and `index.html`. The board works exactly as before without it.

1. Copy the whole `assistant` folder into an `addons` folder beside `server.js` (create `addons` if it doesn't exist). The folder holds `manifest.json`, `backend.js` (the server part), `page.html`, `page.js` and this file.
2. Restart the board with `AI_PROVIDER` set (see "Turn it on"). The startup line should say `Add-ons loaded: assistant 0.2.1`.
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

**Looking things up.** It can search your whole outline, read any day (including the Daily page notes, and tasks inside groups), and it is given the open tasks on the days shown on the board. Examples: "What's on my plate today?", "Find tasks about the budget", "What's due Friday?"

**Changing tasks.** It can add a task or a group (a bullet that holds tasks, optionally with tasks inside it), tick or un-tick a task, move an item to a date (or another item, or your Inbox), rename an item, set or remove a reminder, and add a note. Every change appears as an approval card with a checkbox per change. Choose **Apply** (unticked changes are skipped) or **Deny all**. Nothing changes before you approve. Applied changes appear in the board's undo toast. Deleting is off unless you turn on **Allow deleting** (see Settings).

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
| `OLLAMA_NUM_CTX` | `8192` | Context size passed to Ollama. Raise it if long days or many tasks get cut off (uses more memory). |
| `ANTHROPIC_API_KEY` | none | Required with `anthropic`. |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` | Default Anthropic model. |
| `AI_ALLOW_REMOTE` | unset | Set to `1` to allow the Assistant when the board runs in `vps` or `fly` mode. Without it the Assistant is off there. Has no effect in local mode. |
| `AI_MAX_STEPS` | `8` | Most model calls for one question (maximum 20). |

## What it can and cannot do

- **Can:** search, read days and items, add / tick / un-tick / move / rename, set reminders and add notes (all with approval), delete if you turn on Allow deleting, change the board's view.
- **Cannot:** change anything without approval, read or change encrypted words, edit the text of existing notes, set a task's note field, write into the Notes window, or reach anything outside your WorkFlowy outline and the board.
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

**0.2.1**
- Encrypted words are shown to the model as `‹secret›` everywhere (tasks, notes, search results, paths, the board summary, the item editor's reply), so neither the model nor Anthropic receives encrypted text. A rename has to keep every `‹secret›`, and each is put back as the original encrypted text; new tasks and notes can't contain one.
- Deleting never removes your Inbox, your Notes node, a Plan day source, a day's notes bullet (any name) or anything that holds one of them.
- `inbox` means the Inbox set on the board; WorkFlowy's own Inbox only when none is set.
- "Add a note" makes an all-day note (`!alld`) on the day, as the board does, instead of a line under the old notes bullet.
- The default Anthropic model is now `claude-sonnet-5-5`.
