# Using the Week Board on your phone or tablet with Tailscale

This guide puts the Week Board on your own devices over **Tailscale** (a free private network), so you can open it from an Android phone or tablet, or an iPhone, without putting it on the public internet. It was written for a board running on a Mac; the steps are the same on Linux, and Windows differs only in how you set environment variables (see the README).

**Needs board version 1.3.1 or newer** (`server.js`, `index.html`, `mobile.html` and the three `icon-*.png` files, all in the same folder).

## How it works

- The board runs on your computer, in its **private remote mode** (`DEPLOY_MODE=vps`), listening on that computer only.
- **Tailscale Serve** puts HTTPS in front of it and gives it an address like `https://your-mac.your-tailnet.ts.net`.
- Only devices signed in to *your* Tailscale account can reach that address, and the board asks for its own password on top.
- The computer has to be **on, awake, and running the board** for your phone or tablet to connect.

> The plain `DEPLOY_MODE=local` mode only answers on the computer itself, so it can't be used from another device, with Tailscale or without. If you switch to this setup, this becomes your one board: don't also run a local copy, or both will read the same WorkFlowy data and each will send its own push reminders.

## What you need

- The board folder on your computer, with the 1.3.2 files listed above.
- Node 18 or newer (the same as for the board itself).
- A free Tailscale account.
- Your WorkFlowy API key (<https://workflowy.com/api-key>).
- A new board password of **at least 12 characters**. You will type it on each device the first time you sign in.

## 1. Install Tailscale

1. Install Tailscale on the computer that runs the board (<https://tailscale.com/download>) and sign in.
2. Install the Tailscale app on your phone or tablet (Google Play or the App Store) and sign in with **the same account**.
3. Turn Tailscale **on** on both. Each should show the other in its device list.

## 2. Turn on HTTPS certificates

1. Open the Tailscale admin console: <https://login.tailscale.com/admin/dns>.
2. Make sure **MagicDNS** is on.
3. Under **HTTPS Certificates**, turn them on.

## 3. Work out your computer's address

The address is the computer's machine name plus your tailnet name:

```
<machine-name>.<tailnet-name>.ts.net
```

- The **tailnet name** is the "search domain" shown on the admin console's DNS page, for example `tail1234.ts.net`.
- The **machine name** is shown on the admin console's **Machines** page, or by running `tailscale status --self` in Terminal.
- To print the full name directly: `tailscale status --json | grep DNSName`. The first result is this computer; leave off the final dot.

For example, a Mac called `my-mac` on tailnet `tail1234.ts.net` is `my-mac.tail1234.ts.net`.

Use this exact name everywhere below.

## 4. Start the board

Stop any board that is already running (Ctrl+C in its Terminal window). From the board's folder, run this as one line, replacing the key, password and address:

```
DEPLOY_MODE=vps WORKFLOWY_API_KEY=your_key BOARD_PASSWORD=choose-a-long-password PUBLIC_URL=https://my-mac.tail1234.ts.net ASSUME_HTTPS=1 node server.js
```

- `PUBLIC_URL` must start with `https://`, have **no port** and **no path**, and match exactly what you type in the browser.
- `ASSUME_HTTPS=1` tells the board that the proxy on this same computer is already speaking HTTPS (Tailscale Serve doesn't say so itself). It is ignored unless the board is listening on this computer only, which is the default.
- Leave this Terminal window open. The board should print `Workflowy Week Board v1.3.2 running at https://…`.

## 5. Start Tailscale Serve

In a **second** Terminal window:

```
tailscale serve --bg 3000
```

Use your board's port if it isn't 3000 (it is shown in the board's "running at … listening on 127.0.0.1:PORT" line).

If you get `command not found`, the Mac app doesn't put `tailscale` on your path. Use its full location instead:

```
/Applications/Tailscale.app/Contents/MacOS/Tailscale serve --bg 3000
```

To make plain `tailscale` work, add this line to `~/.zshrc` and open a new Terminal window:

```
alias tailscale="/Applications/Tailscale.app/Contents/MacOS/Tailscale"
```

Check that it's running:

```
tailscale serve status
```

It should list your `https://….ts.net` address pointing at `http://127.0.0.1:3000`.

## 6. Open it

1. On the **computer** first, open `https://my-mac.tail1234.ts.net` (your address). You should see the board's sign-in page. Sign in with the password you chose.
2. On the **phone or tablet**, make sure Tailscale is on, open the same address in Chrome (Android) or Safari (iPhone), and sign in.

Which page you get:

- **Phones** open the phone page (`/m`): a Mon–Sun strip, one day at a time, tick, edit, move, delete, add, and collapsible groups.
- **Tablets** wider than 820px (landscape) get the desktop board. To use the phone page on a tablet, open `https://<your address>/m`.
- On the phone page, **⋯ > Open the desktop page** switches to the full board.

## 7. Install it as an app (optional)

Open `https://<your address>/m` first, then:

**Android (Chrome):**
1. Tap **⋮** (top right).
2. Tap **Install app**, or **Add to Home screen** and then **Install**.
3. Open it from the home screen or app drawer. It should start on the phone page.

If you only see **Add to Home screen**, wait a few seconds, reload the page and look again. Chrome offers a full install only after it has loaded the app details and icons.

**iPhone (Safari):**
1. Tap **Share**.
2. Tap **Add to Home Screen**.

**Samsung Internet:** tap the **☰** menu, then **Add page to** > **Home screen**.

If the icon opens the main address instead of the phone page, it was installed from the wrong address or before the update. Uninstall it (long-press the icon, then **Uninstall** or **Remove**), open `/m` again, and reinstall. Chrome saves the start address at install time, so editing files doesn't change an app that's already installed.

## Keeping it running

The board and `tailscale serve` run only while their Terminal windows stay open and the computer is awake. Closing the windows, quitting Terminal or letting the computer sleep drops the connection. To keep it awake while it is plugged in, turn off sleep in System Settings > Energy (Battery on a laptop), or run `caffeinate -s` in a third Terminal window.

To stop it:

1. Press Ctrl+C in the board's window.
2. Run `tailscale serve reset` to remove the proxy.

## Troubleshooting

Work down this list. Most problems are one of the first few.

### "command not found" for `tailscale`
The Mac app doesn't add the command to your path. Use `/Applications/Tailscale.app/Contents/MacOS/Tailscale` in place of `tailscale`, or add the alias shown in step 5. If that path doesn't exist, check that Tailscale is in your Applications folder.

### "Refused to connect" on the tablet or phone
Nothing is answering at the address. Check, in order:

1. **Is the board running?** Look at its Terminal window. It should print `Workflowy Week Board v1.3.2 running at https://…`. If it printed an error and stopped, the message says what's missing. The usual ones are a `BOARD_PASSWORD` under 12 characters, a `PUBLIC_URL` that doesn't start with `https://`, or an old `server.js`.
2. **Is Tailscale forwarding to it?** Run `tailscale serve status`. It should show your `https://….ts.net` address pointing at `http://127.0.0.1:3000`. If it shows nothing, run `tailscale serve --bg 3000` again. The port must match the board's.
3. **Does the board answer on the computer?** Run `curl -i http://127.0.0.1:3000/healthz`. It should answer `ok`. If not, the board isn't running or is on another port.
4. **Does the address work on the computer itself?** If it fails there too, the problem is on the computer (steps 1 to 3). If it works there, the problem is on the phone or tablet (below).

### It works on the computer but not on the phone or tablet
1. **Is Tailscale on and connected on the device?** Open the Tailscale app. The toggle should be on and the computer should appear in the device list as connected. Android sometimes turns a VPN off in the background, so switch it off and on.
2. **Same account?** The device must be signed in to the same Tailscale account as the computer.
3. **Exact address?** It must be `https://` plus the computer's full name, with no `:3000` and no `http://`.
4. **Android Private DNS.** Under Settings > Network > Private DNS, set it to Off or Automatic. A custom provider can keep the device from resolving Tailscale names. After changing it, close Chrome fully and try again.

### "cross-site request blocked" when signing in
The board's safety check refused the sign-in. The message now says why, in the form `(origin …, sec-fetch-site …, host …; expected …)`, and the board's Terminal prints a line starting `Blocked a`. The usual causes:

- **An old `server.js` is still running.** An earlier copy can still hold the port, so the new one never starts and the device keeps talking to the old one. Run `lsof -i :3000`, note the `node` process's PID, then `kill <PID>`, run `lsof -i :3000` again to confirm it's gone, and start the board again. If you see `EADDRINUSE` or "address already in use", something is still holding the port.
- **The file wasn't replaced.** In the board's folder run `grep -c "Origin: null" server.js`. It should print `1`. If it prints `0`, the folder still has an old `server.js`, so copy the newest over it. (A download saved as `server (1).js` is easy to miss.)
- **The address doesn't match `PUBLIC_URL`.** Compare the `origin` and `expected` parts of the message. They must match exactly in name, in `https` versus `http`, and in not having a port.
- **A stale sign-in page.** Close every tab for the board and open the address fresh before signing in.

### A redirect loop, or "too many redirects"
The board didn't start with `ASSUME_HTTPS=1`, so it keeps redirecting because the proxy doesn't tell it the connection is HTTPS. Restart it with `ASSUME_HTTPS=1` in the command (step 4).

### "Use https://…" or a blank page saying to use another address
The address in the browser doesn't match `PUBLIC_URL`. The board only answers to the exact name it was started with. Open that name, or restart the board with the right `PUBLIC_URL`.

### The install option doesn't appear, or the app opens the wrong page
- Open `/m` and wait for it to load fully. Chrome offers a real install only for an `https://` address, after it has fetched the app details.
- If the app already exists, Chrome shows **Open app** instead of **Install app**.
- If the icon opens the main address, uninstall it, open `https://<your address>/m`, and reinstall (see step 7).
- Make sure `index.html`, `mobile.html` and the three `icon-*.png` files are all in the board's folder and the board has been restarted.

### Groups don't show on the phone page
- **⋯ > Tasks under bullets** may be set to Off. Pick Group.
- Groups load a moment after the day's plain tasks; wait a second or two.
- A group needs real tasks (checkbox items) under a bullet. Plain bullets under a bullet aren't shown, and neither is the WB-Notes bullet.
- Check `grep -c "Tasks under bullets" mobile.html`. It should print `1` or more. If it prints `0`, the folder has an older `mobile.html`.

### Settings look different on the new address
Browser settings (which lines are collapsed, the nested-tasks choice, the week span, the encryption add-on's switches) are stored per address. The `https://….ts.net` address is a different address from `localhost`, so preferences start fresh there.

### Encryption (the crypt add-on)
It needs an `https://` address, which this setup provides, so unlocking works on devices that use the Tailscale address. On the phone page, **⋯ > Unlock encryption…** shows encrypted text decrypted (read-only); editing encrypted text stays on the desktop page.

### Still stuck?
Collect these and share them:

- The exact error text, word for word.
- The first lines the board printed in its Terminal window, including any line starting `Blocked a`.
- The output of `tailscale serve status`.
- Which device shows the problem, and whether the same address works on the computer.

## Security notes

- Only devices signed in to your Tailscale account can reach the address, and the board's password sits on top of that. Use a long, unique password.
- Your WorkFlowy API key stays on the computer running the board. It is never sent to the phone or tablet.
- Don't use Tailscale Funnel or any other way to expose this to the public internet unless you intend to; the board then depends on its password alone.
- To turn this off, press Ctrl+C in the board's window and run `tailscale serve reset`. To go back to plain local use, start the board with `DEPLOY_MODE=local` and open `http://localhost:3000` on that computer.
