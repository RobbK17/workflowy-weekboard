// Safety rules: encrypted text never reaches the model, renames keep encrypted parts, the delete guard, the Inbox and all-day notes.
const { W, A, B } = require("./urls");
const core = require("../../crypt/wbcrypt-core.js");
const j = (r) => r.json();
const post = (u, b, h) => fetch(u, { method: "POST", headers: { "Content-Type": "application/json", ...(h || {}) }, body: JSON.stringify(b) }).then(j);
const today = new Date().toISOString().slice(0, 10).replace(/./g, (c) => c);  // UTC is fine for the mock
const d = new Date(); const pad = (n) => String(n).padStart(2, "0"); const TODAY = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const NL = "bbbbbbbb-0000-4000-8000-000000000000", GRP = "dddddddd-0000-4000-8000-000000000001", STAMPS = "dddddddd-0000-4000-8000-000000000002", BOOKS = "dddddddd-0000-4000-8000-000000000003";
let pass = 0, fail = 0;
const check = (name, ok, extra) => { (ok ? pass++ : fail++); console.log((ok ? "PASS " : "FAIL ") + name + (ok || !extra ? "" : "\n     " + extra)); };
async function chat(script, body) {
  await post(A + "/__script", script);
  const out = await post(B + "/ai/chat", body, { Origin: B });
  const reqs = await fetch(A + "/__reqs").then(j);
  return { out, reqs, sent: JSON.stringify(reqs) };
}
const ctx = (extra) => ({ today: TODAY, day: TODAY, scope: "board", sources: [], inbox: { id: NL, name: "My Inbox" }, notesNode: { id: STAMPS, name: "Notes" }, allowDelete: true, ...(extra || {}) });
const ask = (text, extra) => ({ messages: [{ role: "user", content: text }], writes: "ask", context: ctx(extra) });
(async () => {
  const TOK = await core.encrypt("4321", "pw"), TOK2 = await core.encrypt("vault", "pw");
  const made = await post(W + "/nodes", { parent_id: NL, name: `Safe code ${TOK} and ${TOK2} more`, note: `pin ${TOK}` });
  const SAFE = made.item_id;
  await fetch(B + "/item?id=" + NL + "&refresh=1");                   // the board's outline copy now has it

  // 1. Encrypted text never reaches the model: search results, notes, board summary, preferences
  let r = await chat([{ tool: "search_outline", input: { query: "safe" } }, { text: "Found it." }],
    ask("find my safe code", { board: `${TODAY}:\n  - Call bank ${TOK} (id x1)`, prefs: `my pin is ${TOK2}` }));
  check("search result reached the model", /Safe code ‹secret› and ‹secret› more/.test(r.sent), r.sent.slice(0, 400));
  check("no encrypted text sent to Anthropic (search, note, board summary, preferences)", !/wbenc1/.test(r.sent));
  check("board summary masked", r.sent.includes("Call bank ‹secret›"));

  // 2. Rename keeping both secrets: approval card, then the original encrypted parts are put back
  r = await chat([{ tool: "rename_item", input: { id: SAFE, name: "Vault code ‹secret› and ‹secret› later" } }], ask("rename it"));
  check("rename that keeps the secrets gets an approval card", r.out.pending && /Rename “Safe code ‹secret›/.test(r.out.pending.actions[0].summary), JSON.stringify(r.out).slice(0, 300));
  await post(A + "/__script", [{ text: "Renamed." }]);
  const done = await post(B + "/ai/chat", { resume: r.out.pending.token, decisions: { [r.out.pending.actions[0].id]: true } }, { Origin: B });
  const log = await fetch(W + "/__log").then(j);
  const ren = log.filter((x) => x.id === SAFE && x.name).pop();
  check("renamed name keeps the original encrypted parts, in order", ren && ren.name === `Vault code ${TOK} and ${TOK2} later`, ren && ren.name.slice(0, 120));
  check("the rename's undo restores the old name", (done.undo || []).some((u) => u.body && u.body.name === `Safe code ${TOK} and ${TOK2} more`));

  // 3. Rename that drops a secret is refused before any card
  r = await chat([{ tool: "rename_item", input: { id: SAFE, name: "Vault code only" } }, { text: "I can't do that." }], ask("rename it to Vault code only"));
  check("rename dropping a secret: no approval card", !r.out.pending);
  check("rename dropping a secret: the model is told why", /has 2 encrypted parts/.test(r.sent));

  // 4. New text with a secret, or with encrypted text, is refused
  r = await chat([{ tool: "add_task", input: { parent: TODAY, name: "copy of ‹secret›" } }, { text: "ok" }], ask("add it"));
  check("new task containing ‹secret› refused", !r.out.pending && /can't contain encrypted text/.test(r.sent));

  // 5. 'inbox' goes to the board's Inbox
  r = await chat([{ tool: "add_task", input: { parent: "inbox", name: "Buy milk" } }], ask("add buy milk to my inbox"));
  check("approval card names the board's Inbox", r.out.pending && /to the Inbox \(My Inbox\)/.test(r.out.pending.actions[0].summary), r.out.pending && r.out.pending.actions[0].summary);
  await post(A + "/__script", [{ text: "Added." }]);
  await post(B + "/ai/chat", { resume: r.out.pending.token, decisions: { [r.out.pending.actions[0].id]: true } }, { Origin: B });
  let lg = await fetch(W + "/__log").then(j);
  check("task created under the board's Inbox node", lg.some((x) => x.create && x.name === "Buy milk" && x.parent_id === NL));
  r = await chat([{ tool: "add_task", input: { parent: "inbox", name: "Plain inbox" } }], ask("add", { inbox: null }));
  check("without a board Inbox it still uses WorkFlowy's", r.out.pending && /WorkFlowy's Inbox/.test(r.out.pending.actions[0].summary));

  // 6. Notes are all-day notes on the day
  r = await chat([{ tool: "add_note", input: { text: "Call the plumber | Pay rent" } }], ask("add notes"));
  check("note card says all-day notes", r.out.pending && /2 all-day notes to/.test(r.out.pending.actions[0].summary), r.out.pending && r.out.pending.actions[0].summary);
  await post(A + "/__script", [{ text: "Added." }]);
  const nd = await post(B + "/ai/chat", { resume: r.out.pending.token, decisions: { [r.out.pending.actions[0].id]: true } }, { Origin: B });
  lg = await fetch(W + "/__log").then(j);
  check("notes written as '… !alld' bullets on the day", lg.some((x) => x.create && x.name === "Call the plumber !alld" && x.parent_id === TODAY) && lg.some((x) => x.create && x.name === "Pay rent !alld"));
  check("no old notes bullet created", !lg.some((x) => x.create && /^(WB-Notes|All-day notes)$/i.test(x.name || "")));
  check("note undo deletes just the two notes", (nd.undo || []).length === 2 && nd.undo.every((u) => u.method === "DELETE"));

  // 7. Delete guard
  r = await chat([{ tool: "delete_item", input: { id: NL } }, { text: "Can't." }], ask("delete my inbox"));
  check("can't delete the Inbox", !r.out.pending && /your Inbox \(My Inbox\), which the board uses/.test(r.sent));
  r = await chat([{ tool: "delete_item", input: { id: GRP } }, { text: "Can't." }], ask("delete Errands"));
  check("can't delete something that holds the Notes node", !r.out.pending && /it holds your Notes/.test(r.sent));
  r = await chat([{ tool: "delete_item", input: { id: STAMPS } }, { text: "Can't." }], ask("delete stamps"));
  check("can't delete the Notes node itself", !r.out.pending && /that is your Notes/.test(r.sent));
  r = await chat([{ tool: "delete_item", input: { id: BOOKS } }], ask("delete return library books"));
  check("an ordinary item can still be deleted (approval card)", r.out.pending && /^Delete “Return library books”/.test(r.out.pending.actions[0].summary), JSON.stringify(r.out).slice(0, 200));
  r = await chat([{ tool: "delete_item", input: { id: BOOKS } }, { text: "Can't." }], ask("delete it", { sources: [{ id: BOOKS, name: "Reading" }] }));
  check("can't delete a Plan day source", !r.out.pending && /Plan day source Reading/.test(r.sent));

  // 8. Model default
  check("default model sent is claude-sonnet-5-5", r.reqs[0].body.model === "claude-sonnet-5-5");
  console.log(`\n${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error("test crashed:", e); process.exit(1); });
