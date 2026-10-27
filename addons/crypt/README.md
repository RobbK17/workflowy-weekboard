# Encryption add-on (wbcrypt) 0.3.0

WorkFlowy cannot encrypt your outline end to end, so this add-on lets you encrypt the sensitive parts of your own text **before** it goes into WorkFlowy. WorkFlowy then stores unreadable text, and only someone with your passphrase can read it.

It works inside the board's item editor, so you don't have to copy and paste between panels. It needs board **1.2.1** or newer. The editor's Encrypt button covers **names** (titles). Notes are not encrypted by the editor button; you can paste a token from the panel into a note, and the placeholder option and Change passphrase both handle encrypted text in notes. Everything can be switched on or off in **Settings > Encryption** (see below).

It comes in three forms that share one file of crypto code (`wbcrypt-core.js`), so they always agree:

- **In the item editor:** an Encrypt / Unlock button next to the name box.
- **In the header:** a 🔒 button unlocks the board for the session. While unlocked it turns into a green 🔓 Unlocked button that opens a panel to encrypt or decrypt any text, lock, and change the passphrase.
- **Standalone:** `cli.js`, a command-line tool that needs only Node 18+, no board needed.

## Install (board)

1. Copy this folder into the board's `addons/` folder, next to `server.js`: `addons/crypt/`. Update `server.js` and `index.html` to 1.2.1 at the same time.
2. Restart the board. The startup line should list `crypt 0.3.0`, and `http://localhost:3000/addons` shows its status.
3. To remove it, delete the folder and restart. The board works as before, with one cosmetic difference described below.

It has no server part. Its switches live in **Settings > Encryption** and are remembered per browser. It works in `local`, `vps` and `fly` modes. Browsers only allow encryption on `https://` addresses and `localhost`, which all three already use.

Like every add-on, this is trusted code that runs on your board's page. Read it before installing, and install only from a source you trust.

## Use it in the item editor

Open a task the usual way (double-click it on a card, or click a line on the Daily page). One button appears under the name box. It always says what it will do next:

- **🔒 Encrypt, part of a name:** select the words and click it (or press Ctrl/Cmd+Shift+E).
- **🔒 Encrypt, the whole name:** click it with nothing selected. `@times`, `#tags` and `@mentions` stay readable, so reminders and tags keep working: `Call bank @2:30pm` becomes `⟦Call bank⟧ @2:30pm`. If the name already has encrypted text, nothing is encrypted and you are asked to select the words you want, so a label next to an encrypted value is never encrypted by accident.
- **🔓 Unlock:** shown instead when you are locked and the name holds encrypted text. It opens a dialog in the middle of the page asking for the passphrase (Enter unlocks, Esc or clicking outside cancels). The editor stays open behind it, so nothing you typed is lost.
- **🔓 Remove encryption:** shown when the cursor is inside an encrypted part (between ⟦ ⟧). It turns that part back into plain text, and the editor warns that it will be saved readable. Use it to undo an encryption you didn't mean.
- Protected text is shown between **⟦ ⟧** while you edit. When you save (Enter, or clicking away), the board turns each ⟦…⟧ into an encrypted `wbenc1.…` token and sends only that to WorkFlowy. Use the button to add the brackets; don't type them yourself.
- **Reading and changing it later:** open the task while unlocked and the encrypted parts appear as ⟦readable text⟧. Edit them like normal text. A part you didn't change keeps its exact old encrypted text, so saving doesn't change it in WorkFlowy for nothing.
- **Unlocking:** if you're locked, a dialog asks for the passphrase (see *One entry to unlock* below for when it asks once and when twice).

**One entry to unlock:** the first time, you choose your passphrase and type it twice (the dialog shows a Weak / Good / Strong hint; it is advice only). The add-on then keeps a small *check value* in this browser: an encrypted fixed phrase, no secret in it. From then on a single entry unlocks, and a mistyped passphrase is refused straight away. If this browser has no check value yet, the add-on tests your passphrase against any encrypted line the board already holds, so a new browser also needs only one entry. A stale check value (a passphrase you no longer use) can be replaced with "Set up a new passphrase instead".

**Unlock for the session from the header:** click the 🔒 in the header, type your passphrase (twice the first time), press Enter. The button turns into a green **🔓 Unlocked**, and encrypted text opens readable everywhere on the board without asking again. While unlocked, clicking it opens the panel (encrypt, decrypt, **Lock now**). The unlock dialog also has an "Open panel instead" link.

Unlocking is shared by the editor, the header and the panel, and it lasts until you lock, the idle time ends (default 5 minutes, set in the panel), or you hide the tab. When it locks, any open editor has its protected text turned back into encrypted text first, so nothing readable stays on the page.

## Changing the passphrase

Unlock, open the panel, and click **Change passphrase…**. Enter the new passphrase twice. The add-on searches your whole outline for encrypted text, opens each part with the current passphrase, seals it again with the new one (checking that the new text opens before using it), and shows you the counts. Nothing is changed until you click **Re-encrypt**. Then each changed item is saved to WorkFlowy, and you stay unlocked with the new passphrase.

- Parts that the current passphrase cannot open (made with a different passphrase) are left exactly as they are, and the review tells you how many.
- Only the encrypted text changes. Names, notes, tags and times around it are untouched. Notes holding encrypted text are covered too.
- If it is interrupted, open Change passphrase again with the same old passphrase: finished items are skipped, because they no longer open with the old one.
- Close any open item editors first, and do not edit the outline from another device while it runs.
- Use the new passphrase on every device from now on. Other browsers keep their old check value until you unlock there and choose "Set up a new passphrase instead" once.
- It reads your outline through the board's search, which WorkFlowy limits to about once a minute. If you just added encrypted text, wait a minute and run it again so the list is current.

## What you see on the board

Encrypted names show as a 🔒 instead of a long string of characters: on cards, the Daily page, search results, the Done window and reminders. This is part of board 1.2.1 and works even without this add-on. It only changes how the text is shown, never what is stored. To read a name, open it in the editor.

Push reminders (ntfy, Pushover) and reminder popups show 🔒 in place of the encrypted text, so a secret never goes to a push service. The reminder time still works, because `@2:30pm` stays outside the encrypted part.

## Safety rules the editor follows

- **Plaintext is never sent.** If you're locked, or encryption fails, or the name has an unmatched ⟦ or ⟧, the save is stopped, a message is shown, and the editor stays open. Nothing is sent to WorkFlowy.
- **Clicking away saves, as it always has.** With protected text and while unlocked, that saves it encrypted. While locked, it stops and asks for the passphrase.
- **Cancelling (Esc) writes nothing.**
- If an open editor can't be sealed when you lock, the edit is discarded rather than leaving readable text on the page.

## Settings > Encryption

Open the board's **Settings** window and choose the **Encryption** tab. Three switches, remembered in this browser (each browser has its own). **Enable encryption** is the master switch at the top: when it is off the 🔒 padlock in the header is hidden, item editors are left completely alone, and you are locked (the passphrase is forgotten and open editors are sealed). Encrypted names still show as 🔒 on the board, and nothing already encrypted is changed. The other two are greyed out until it is on:

- **Encrypt inside the item editor** (on by default). Turn it off to keep the editors exactly as they were and use only the 🔒 panel. With it off there is no Encrypt/Unlock button in editors, no ⟦ ⟧ markers, and the header 🔒 opens the panel directly. Encrypted names still show as 🔒 on the board.
- **Show <<secret>> instead of the long encrypted text** (only available when the first switch is off). Name and note editors then show `<<secret>>` in place of each encrypted part, and put the original encrypted text back when you save. Keep each `<<secret>>` as it is (you can change the words around them). If the number of `<<secret>>` markers changes, the save is refused with a message and nothing is sent, so an encrypted part can never be lost by accident. To remove one, turn the placeholder off and edit the raw text.

## Use it in the panel

The panel opens when you click the green **🔓 Unlocked** button, from "Open panel instead" in the unlock dialog, or straight from the 🔒 when *Encrypt inside the item editor* is off. Type or paste text and click **Encrypt**, then copy the `wbenc1.…` result (this is also how you put encrypted text into a note). To read a token, or a line containing tokens, paste it in and click **Decrypt**. **Show tokens on this board** lists tokens found as plain text on the page, such as ones in notes. Names show as a 🔒, so use the editor to read those. The panel also has **Lock now** (which closes the panel), the idle-lock time, and **Change passphrase…**.

## Use it standalone

```
node cli.js enc "Chase login: hunter2"        # prints a wbenc1. token
node cli.js dec wbenc1.xxxxx                  # prints the text
node cli.js dec-text "Call bank @2:30pm wbenc1.xxxxx"   # decrypts tokens inside a line
echo "text" | node cli.js enc                 # text from stdin
```

Passphrase: you are asked for it with typing hidden (twice when encrypting). For scripts, set `WBCRYPT_PASSPHRASE` or use `--pass-file path` (first line). The tool refuses a passphrase on the command line, because shell history would keep it.

## Token format

`wbenc1.<base64url(salt 16 bytes | IV 12 bytes | ciphertext + 16-byte tag)>`

AES-256-GCM, key from PBKDF2-SHA256 with 600,000 iterations, a fresh random salt and IV every time. The text after `wbenc1.` uses only letters, digits, `-` and `_`, so WorkFlowy won't read any of it as a `#tag`, `@mention` or date. Any standard tool that does AES-GCM and PBKDF2 can read these tokens, so your data is not locked to this program. The tests check this with plain `node:crypto`.

Overhead is about 40 bytes plus 33% for base64url. Check WorkFlowy's per-item text limit before encrypting very long text.

## What it protects, and what it doesn't

Protects: the text inside tokens from WorkFlowy staff, a WorkFlowy breach, a leaked API key, and anyone reading your outline.

Doesn't protect:
- **Everything outside the tokens.** The rest of a name, tags, dates, structure, and any note text you did not encrypt stay readable.
- **Metadata.** WorkFlowy can still see roughly how long each secret is and when you changed it.
- **The check value is guessable like any token.** It lets someone who copies it try passphrases offline, exactly as with any encrypted line. A long passphrase is the real protection.
- **A compromised computer or browser.** Malware or a malicious browser extension can read the passphrase as you type it, and can read protected text while an editor shows it. The passphrase is held only in the page's memory, is never stored, and is never sent to the board's server or WorkFlowy. The only things the add-on keeps in the browser are the check value (an encrypted fixed phrase) and your three Settings switches.
- **Your clipboard.** Copied results sit on the clipboard until you replace them.
- **Forgetting the passphrase.** There is no recovery. Keep it in a password manager.

## Things that stop working on encrypted text

Search can't see inside a token, because the server doesn't have the passphrase. That is the point of encryption, and it is why dates, `@times` and any words you want to search for are best left outside the encrypted part.

## Without this add-on

With the add-on removed, a name holding a token still shows as a 🔒 on the board, and opening it in the editor shows the stored `wbenc1.…` text, which saves back unchanged unless you edit it. Take care not to change or cut that text, because a damaged token can't be decrypted.

## Versions

The add-on has its own version (`manifest.json`, currently 0.3.0). The token format has its own name, `wbenc1`, which stays stable: if the format ever changes it becomes `wbenc2` and the code will keep reading `wbenc1`.

## For developers

- `wbcrypt-core.js` is the only place with crypto code. `page.src.js` is the page script.
- The board loads one script per add-on, so `node build.js` joins the two into `page.js`. Edit the sources, never `page.js`. `node build.js --check` fails if `page.js` is stale.
- The editor integration uses two board hooks (board 1.2.1): `boardHooks.on("editorOpen", ctx => …)` and `boardHooks.on("beforeSave", async (text, ctx) => text)`. `beforeSave` runs for the name and for the note (`ctx.field`). `ctx.tools` is the row under the name box where the Encrypt button sits. See the hooks section in `addons/README.md`.
- Browser storage keys: `wbcrypt.check` (the check value), `wbcrypt.enabled`, `wbcrypt.editor`, `wbcrypt.placeholder`. The only network request is the board's own `/search?q=wbenc1.` (to find a line to check a passphrase against, and to list items for Change passphrase).
- `node test.js` runs the tests. The page-script tests need jsdom (test-only; the add-on itself has no dependencies): `JSDOM_PATH=/path/to/node_modules/jsdom node test.js`.
