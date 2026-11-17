# Workflowy Key Proxy – Quick Start

A tiny Cloudflare Worker that holds your real Workflowy API key so the Week Board (or any app) only ever sees a revocable proxy token. This is the recommended way to run the board (see "Keep your WorkFlowy key out of the board" in the board's README).

Run the commands below from this `workflowy-proxy` folder.

```
Week Board  --(proxy token)-->  Cloudflare Worker  --(real key)-->  workflowy.com/api/v1
```

- The real key lives only in a Cloudflare secret. It is never on your computer or in a config file.
- If the proxy token leaks, replace it in one command. Your Workflowy key stays the same.
- Only the endpoints the board uses are allowed. Everything else returns 403.

## Files

| File | Purpose |
|---|---|
| `worker.js` | The proxy |
| `wrangler.toml` | Cloudflare deploy config |
| `test-proxy.mjs` | Offline logic test (no network, no real key needed) |
| `.gitignore` | Keeps `tokens.json`, `.dev.vars` and Wrangler's local files out of git, in case you create them here |

## Requirements

- [Node.js](https://nodejs.org) 18 or newer
- A free Cloudflare account
- Your Workflowy API key (generate one at https://workflowy.com/api-key)

## Setup

**1. (Optional) Run the offline test**

```
node test-proxy.mjs
```

It should end with `All checks passed`.

**2. Log in to Cloudflare**

```
npx wrangler login
```

**3. Create a proxy token**

```
node -e "console.log('tok_'+require('crypto').randomBytes(24).toString('hex'))"
```

Copy the output. This is the token the board will use. It is not your Workflowy key.

**4. Store the secrets**

Real Workflowy key:

```
npx wrangler secret put WORKFLOWY_API_KEY
```

Paste your real key when asked.

Proxy tokens. Create a file named `tokens.json` containing one line, using your token and straight quotes:

```
{"tok_yourtokenhere":"weekboard"}
```

Upload it, then delete the file.

- PowerShell: `Get-Content tokens.json | npx wrangler secret put TENANT_TOKENS`
- Command Prompt: `npx wrangler secret put TENANT_TOKENS < tokens.json`
- macOS/Linux: `npx wrangler secret put TENANT_TOKENS < tokens.json`

You can list several tokens, for example `{"tok_aaa":"weekboard","tok_bbb":"phone"}`. The name is only used in the logs.

**5. Deploy**

```
npx wrangler deploy
```

It prints your URL, such as `https://workflowy-proxy.<your-subdomain>.workers.dev`.

**6. Test it**

```
curl -H "Authorization: Bearer tok_yourtokenhere" https://workflowy-proxy.<your-subdomain>.workers.dev/api/v1/targets
```

You should get your Workflowy targets (Inbox, Today and so on) as JSON.

| Response | Meaning |
|---|---|
| `401 Unauthorized` | Wrong or missing token |
| `403 Forbidden` | Endpoint not on the allowlist |
| `TENANT_TOKENS is not valid JSON` | The secret was pasted with changed quotes. Redo step 4 from the file |
| `502 Couldn't reach WorkFlowy` | The Worker is fine but WorkFlowy didn't answer. Try again in a moment |
| `429` | WorkFlowy is busy. The board waits and retries; the `Retry-After` header says how long |

**7. Point the board at the proxy**

Windows:

```
setx WORKFLOWY_BASE_URL "https://workflowy-proxy.<your-subdomain>.workers.dev/api/v1"
setx WORKFLOWY_API_KEY "tok_yourtokenhere"
```

macOS/Linux:

```
export WORKFLOWY_BASE_URL="https://workflowy-proxy.<your-subdomain>.workers.dev/api/v1"
export WORKFLOWY_API_KEY="tok_yourtokenhere"
```

Include the `/api/v1` ending. Open a **new** terminal (`setx` only affects windows opened afterwards), then start the board from it. The board's startup output should show your `workers.dev` address instead of `workflowy.com`.

## Check it is working

- Dashboard: Cloudflare, then Workers & Pages, then `workflowy-proxy`. The Metrics tab shows requests rising as you use the board. Observability shows each call with its path and status.
- Live log: `npx wrangler tail` prints a line per request. If it fails to connect, run `npx wrangler logout`, then `npx wrangler login`, and clear any `CLOUDFLARE_API_TOKEN` environment variable. The dashboard works as a substitute.
- If the board still shows `workflowy.com`, its process did not receive the variable. Common causes are a terminal opened before `setx`, a startup script or scheduled task with its own environment, or an old board process still running.

## Revoking or rotating access

- Replace a leaked proxy token: repeat step 3 and step 4 (`TENANT_TOKENS`), update the board's `WORKFLOWY_API_KEY`, and delete `tokens.json`. The old token stops working immediately.
- Rotate the real Workflowy key: generate a new one at https://workflowy.com/api-key and run `npx wrangler secret put WORKFLOWY_API_KEY`. The board needs no change.

## What the proxy allows

| Method | Path |
|---|---|
| GET | `/api/v1/nodes-export`, `/api/v1/targets`, `/api/v1/nodes`, `/api/v1/nodes/:id` |
| POST | `/api/v1/nodes`, `/api/v1/nodes/:id`, `/api/v1/nodes/:id/move`, `/complete`, `/uncomplete` |
| DELETE | `/api/v1/nodes/:id` |

Mirror endpoints and everything else are blocked. To allow more, edit the `ALLOWED` list at the top of `worker.js` and run `npx wrangler deploy` again.

## Limits and notes

- Cloudflare's free plan allows 100,000 requests per day, and 10 ms of CPU per request. A pass-through proxy uses very little CPU. If a large export fails with Cloudflare error 1102, you have hit the CPU limit.
- The proxy token still gives read, write and delete access to your outline through the allowed endpoints. It protects your real key and can be revoked, but treat it as a secret.
- Cloudflare never shows a saved secret again. If you lose the token, create a new one.
