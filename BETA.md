# Week Board — Beta tester guide

This board is a multi-user WorkFlowy week view. **Your real WorkFlowy API key never goes on the board.** Each person runs a small Cloudflare Worker proxy that holds the key; the board only stores a revocable `tok_…` token.

**Board:** https://workflowy-weekboard.apps.grok.bot  

**Proxy source (this repo):** [`workflowy-proxy/`](https://cursor.com/codebase/robbk17/workflowy-weekboard) — full steps in [`workflowy-proxy/QUICKSTART.md`](workflowy-proxy/QUICKSTART.md)

---

## What you need

1. A free [Cloudflare](https://dash.cloudflare.com) account  
2. Your WorkFlowy API key from https://workflowy.com/api-key  
3. An **invite code** from the board admin (single-use)  
4. Node.js 18+ on the machine where you deploy the Worker  

Plan about 10–15 minutes for the proxy the first time.

---

## Part 1 — Set up your Cloudflare Worker proxy

Do this on your own computer, from a clone of this repo (or copy the `workflowy-proxy` folder).

```bash
cd workflowy-proxy
```

### 1. Log in to Cloudflare

```bash
npx wrangler login
```

### 2. Create a proxy token (not your WorkFlowy key)

```bash
node -e "console.log('tok_'+require('crypto').randomBytes(24).toString('hex'))"
```

Copy the `tok_…` value. You will paste it into the board later.

### 3. Store secrets in Cloudflare

**Real WorkFlowy key** (stays only in Cloudflare):

```bash
npx wrangler secret put WORKFLOWY_API_KEY
```

Paste your key from https://workflowy.com/api-key when prompted.

**Proxy tokens** — create a one-line file `tokens.json` (use your token, straight quotes):

```json
{"tok_yourtokenhere":"weekboard"}
```

Upload it, then delete the file:

```bash
# macOS / Linux
npx wrangler secret put TENANT_TOKENS < tokens.json
rm tokens.json
```

```powershell
# Windows PowerShell
Get-Content tokens.json | npx wrangler secret put TENANT_TOKENS
Remove-Item tokens.json
```

### 4. Deploy

```bash
npx wrangler deploy
```

Wrangler prints a URL like:

`https://workflowy-proxy.<your-subdomain>.workers.dev`

The board needs the **API base**, with `/api/v1` on the end:

`https://workflowy-proxy.<your-subdomain>.workers.dev/api/v1`

### 5. Quick check (optional)

```bash
curl -H "Authorization: Bearer tok_yourtokenhere" \
  https://workflowy-proxy.<your-subdomain>.workers.dev/api/v1/targets
```

You should see JSON for your WorkFlowy targets. `401` means a bad token; fix `TENANT_TOKENS` and redeploy the secret.

More detail, rotation, and troubleshooting: [`workflowy-proxy/QUICKSTART.md`](workflowy-proxy/QUICKSTART.md).

---

## Part 2 — Create your board account (invite code)

1. Open https://workflowy-weekboard.apps.grok.bot/sign-up  
   (From the sign-in page, use **Create an account**.)
2. Enter the **invite code** the admin sent you.  
3. Enter your **email** and choose a **password** (at least 10 characters). You will use this same password later to wrap your proxy token on the board.  
4. Submit **Create account**.  
5. **Confirm your email** if asked (check inbox / spam for the verification link). Until you confirm, the board sends you to a verify-pending page.

Admins create invites under **Settings → Account Management → Invites** on the desktop board.

---

## Part 3 — Point the board at your proxy

After you are signed in and email-verified, the board opens **Settings → Account Management → Proxy** if you have not saved a proxy yet. You can also open it anytime:

1. Use the **desktop** board (not the phone page). On a phone, open Settings → **Open the desktop page**, or visit  
   `https://workflowy-weekboard.apps.grok.bot/?desktop=1`
2. Open **⚙ Settings**.  
3. Open the last tab, **Account Management** → **Proxy**.  
4. Fill in:

| Field | What to paste |
|---|---|
| **Proxy base URL** | `https://workflowy-proxy.<your-subdomain>.workers.dev/api/v1` |
| **Proxy token** | Your `tok_…` from Part 1 (not the WorkFlowy key) |
| **Board password** | The same password you use to sign in to this board |

5. Tick the host-trust checkbox (the board stores only the revocable `tok_…`, password-wrapped).  
6. Click **Save proxy**.

The board checks your Worker, then loads **your** week. Each signed-in person uses **their own** Worker and token; outlines are not shared between accounts.

---

## Day-to-day use

- **Sign in:** https://workflowy-weekboard.apps.grok.bot/sign-in  
- **Phone:** the board may open `/m` automatically. Proxy setup and Account Management are on the desktop page (`/?desktop=1`).  
- **Encryption / Markdown:** optional Settings tabs above Account Management.  
- **Rotate a leaked `tok_…`:** create a new token, update `TENANT_TOKENS` on the Worker, then save the new token under Account → Proxy. Your WorkFlowy key does not need to change.  
- **Rotate the WorkFlowy key:** update `WORKFLOWY_API_KEY` on the Worker only; the board keeps using the same `tok_…`.

---

## If something goes wrong

| Symptom | What to try |
|---|---|
| Can’t create an account | Ask the admin for a fresh invite; codes are single-use and can expire. |
| Stuck on verify email | Open the link in the email, or use resend on the verify-pending page. |
| Settings asks for a proxy | Complete Part 1, then Part 3. URL must end in `/api/v1`. |
| Proxy save fails | Confirm `curl` to `/targets` works; token must match `TENANT_TOKENS`; use `tok_…`, not the WorkFlowy key. |
| Empty week after save | Refresh; confirm the Worker metrics show requests; sign out and sign in again. |
| Phone can’t find Account | Switch to desktop view (`/?desktop=1`), then Settings → Account Management. |

---

## Privacy (short)

- WorkFlowy API key → Cloudflare Worker secret only.  
- Board host → revocable `tok_…`, wrapped with your board password while stored.  
- Unlocked token lives in server memory only while you are signed in (and clears on sign-out / idle).  

Questions for the beta: send them to the person who invited you.
