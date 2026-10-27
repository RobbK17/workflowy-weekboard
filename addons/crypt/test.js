#!/usr/bin/env node
/* Tests for the Encryption (wbcrypt) add-on. Run:  node test.js
   The core, CLI and add-on files need only Node 18+. The page-script tests also need jsdom, which is a test-only tool
   (npm install jsdom somewhere, then JSDOM_PATH=/that/node_modules/jsdom node test.js). Without it those tests are skipped and say so. */
"use strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const nodeCrypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const core = require("./wbcrypt-core.js");

let pass = 0, fail = 0;
function ok(cond, name) { if (cond) { pass++; console.log("PASS " + name); } else { fail++; console.log("FAIL " + name); } }
async function throws(fn, re, name) {
  try { await fn(); ok(false, name + " (did not throw)"); }
  catch (e) { ok(re.test(e.message), name + (re.test(e.message) ? "" : " (got: " + e.message + ")")); }
}
const here = (f) => path.join(__dirname, f);

async function coreTests() {
  const P = "correct horse battery staple";

  for (const [label, text] of [["ascii", "Chase login: hunter2"], ["unicode", "Pässwörd ✓ 日本語 🔐"], ["empty", ""], ["long", "x".repeat(5000)], ["multiline", "a\nb\r\nc"]]) {
    const t = await core.encrypt(text, P);
    ok((await core.decrypt(t, P)) === text, "round trip: " + label);
  }

  const a = await core.encrypt("same", P), b = await core.encrypt("same", P);
  ok(a !== b, "same text and passphrase gives a different token each time (fresh salt and IV)");
  ok(/^wbenc1\.[A-Za-z0-9_-]+$/.test(a), "token uses only letters, digits, - and _ after the prefix");
  ok(!/[#@\s]/.test(a), "token has no # @ or whitespace (WorkFlowy will not parse tags, mentions or dates)");
  ok(core.isToken(a) && !core.isToken("hello") && !core.isToken("wbenc1.bad token"), "isToken");

  await throws(() => core.decrypt(a, "wrong"), /Wrong passphrase or damaged data/, "wrong passphrase is refused");
  const flipped = a.slice(0, -3) + (a.slice(-3, -2) === "A" ? "B" : "A") + a.slice(-2);
  await throws(() => core.decrypt(flipped, P), /Wrong passphrase or damaged data/, "a changed character is detected (GCM authentication)");
  await throws(() => core.decrypt(a.slice(0, 40), P), /too short/, "a cut-off token is reported as too short");
  const odd = a.slice(0, 7 + 61);   // body cut to 61 characters: long enough to pass the length check, but 61 % 4 === 1 is impossible for base64
  await throws(() => core.decrypt(odd, P), /damaged or cut off/, "a token cut at an impossible length is reported as damaged, not as a raw decoder error");
  await throws(() => core.decrypt(a.slice(0, -4), P), /Wrong passphrase or damaged data/, "a token missing its last bytes fails authentication");
  await throws(() => core.decrypt("hello", P), /Not a wbcrypt token/, "plain text is refused");
  await throws(() => core.encrypt("x", ""), /passphrase is required/, "empty passphrase is refused");
  await throws(() => core.encrypt(123, P), /must be a string/, "non-string text is refused");

  const composed = "café", decomposed = "café";
  const t = await core.encrypt("n", composed);
  ok((await core.decrypt(t, decomposed)) === "n", "passphrase is normalised (NFKC), so the same word typed two ways works");

  // Independent check that the format is standard AES-256-GCM + PBKDF2, not just self-consistent.
  const tok = await core.encrypt("independent check ✓", P);
  const raw = Buffer.from(tok.slice(7).replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const salt = raw.subarray(0, 16), iv = raw.subarray(16, 28), body = raw.subarray(28, raw.length - 16), tag = raw.subarray(raw.length - 16);
  const key = nodeCrypto.pbkdf2Sync(P.normalize("NFKC"), salt, core.iterations, 32, "sha256");
  const d = nodeCrypto.createDecipheriv("aes-256-gcm", key, iv); d.setAuthTag(tag);
  ok(Buffer.concat([d.update(body), d.final()]).toString("utf8") === "independent check ✓", "core output decrypts with plain node:crypto (standard format)");
  const salt2 = nodeCrypto.randomBytes(16), iv2 = nodeCrypto.randomBytes(12);
  const key2 = nodeCrypto.pbkdf2Sync(P, salt2, core.iterations, 32, "sha256");
  const c = nodeCrypto.createCipheriv("aes-256-gcm", key2, iv2), ct = Buffer.concat([c.update("made elsewhere", "utf8"), c.final()]);
  const foreign = "wbenc1." + Buffer.concat([salt2, iv2, ct, c.getAuthTag()]).toString("base64url");
  ok((await core.decrypt(foreign, P)) === "made elsewhere", "a token built with plain node:crypto decrypts with the core");

  const line = "Call bank @2:30pm #money " + a + " then " + b + " done";
  ok(core.findTokens(line).length === 2, "findTokens finds two tokens inside a line");
  ok((await core.replaceTokens(line, (x) => core.decrypt(x, P))) === "Call bank @2:30pm #money same then same done", "replaceTokens keeps the surrounding text, @time and #tag untouched");
  const mixed = await core.replaceTokens(a + " " + (await core.encrypt("other", "different")), (x) => core.decrypt(x, P));
  ok(mixed.startsWith("same ") && mixed.includes("wbenc1."), "a token that fails to decrypt is left as it was");
}

function cliTests() {
  const run = (args, env, input) => spawnSync(process.execPath, [here("cli.js"), ...args], { encoding: "utf8", input, env: { PATH: process.env.PATH, ...env }, timeout: 60000 });
  const E = { WBCRYPT_PASSPHRASE: "cli pass" };
  const enc = run(["enc", "secret one"], E);
  ok(enc.status === 0 && /^wbenc1\./.test(enc.stdout), "cli enc prints a token");
  const token = enc.stdout.trim();
  ok(run(["dec", token], E).stdout === "secret one\n", "cli dec round trip");
  const bad = run(["dec", token], { WBCRYPT_PASSPHRASE: "nope" });
  ok(bad.status === 1 && /Wrong passphrase/.test(bad.stderr) && bad.stdout === "", "cli wrong passphrase: exit 1, message on stderr, nothing on stdout");
  ok(run(["dec"], E, token + "\n").stdout === "secret one\n", "cli dec reads the token from stdin");
  ok(run(["dec-text", "Call @2:30pm " + token + " ok"], E).stdout === "Call @2:30pm secret one ok\n", "cli dec-text decrypts tokens inside a line");
  const pf = path.join(os.tmpdir(), "wbcrypt-pass-" + process.pid); fs.writeFileSync(pf, "cli pass\nignored second line\n");
  ok(run(["dec", token, "--pass-file", pf], {}).stdout === "secret one\n", "cli --pass-file uses the first line");
  fs.unlinkSync(pf);
  const noPass = run(["enc", "x"], {}, "");
  ok(noPass.status === 1 && /No passphrase given/.test(noPass.stderr), "cli without a passphrase and no terminal fails clearly");
  ok(run(["bogus"], E).status === 1, "cli unknown command exits 1");
  ok(run(["check"], {}).stdout.includes("wbenc1"), "cli check prints the format");
  ok(/Usage:/.test(run(["help"], {}).stdout), "cli help prints usage");
}

function addonFileTests() {
  const m = JSON.parse(fs.readFileSync(here("manifest.json"), "utf8"));
  ok(m.id === path.basename(__dirname) && /^[a-z0-9-]+$/.test(m.id), "manifest id equals the folder name and is lowercase/digits/dashes");
  ok(/^\d+\.\d+\.\d+$/.test(m.version) && /^\d+\.\d+\.\d+$/.test(m.requires.board), "manifest versions are major.minor.patch");
  ok(!("server" in m), "manifest has no server part (browser-only add-on)");
  ok(["page", "script", "docs"].every((k) => /^[A-Za-z0-9._-]+$/.test(m[k]) && fs.existsSync(here(m[k]))), "manifest file names are plain names and the files exist");
  ok(spawnSync(process.execPath, [here("build.js"), "--check"], { encoding: "utf8" }).status === 0, "page.js is up to date with wbcrypt-core.js and page.src.js (no drift)");
  const pageJs = fs.readFileSync(here("page.js"), "utf8");
  ok(pageJs.includes(fs.readFileSync(here("wbcrypt-core.js"), "utf8").trim()), "page.js contains the core byte for byte");
  const html = fs.readFileSync(here("page.html"), "utf8");
  const parts = {};
  for (const name of ["css", "button", "panel", "tab", "pane"]) { const r = new RegExp("<!--@" + name + "-->([\\s\\S]*?)<!--/@" + name + "-->", "g"); const all = [...html.matchAll(r)]; ok(all.length === 1, "page.html has exactly one @" + name + " part"); parts[name] = all[0] ? all[0][1] : ""; }
  const ids = [...fs.readFileSync(here("page.src.js"), "utf8").matchAll(/\$\("([A-Za-z0-9_]+)"\)/g)].map((x) => x[1]);
  ok(ids.length > 0 && ids.every((id) => (parts.button + parts.panel + parts.pane).includes('id="' + id + '"')), "every element id the script uses exists in page.html");
  ok([...(parts.button + parts.panel + parts.pane).matchAll(/\sid="([^"]+)"/g)].every((x) => x[1].startsWith("crypt")), "every id and the storage use are prefixed with the add-on's name");
  {
    const src = fs.readFileSync(here("page.src.js"), "utf8");
    // The only things the page script may store or request: the check value (an encrypted fixed phrase) in this browser, and the board's own /search.
    const stripped = src.replace(/localStorage\.(getItem|removeItem)\(CHECK_KEY\)/g, "").replace(/localStorage\.setItem\(CHECK_KEY, await wbcrypt\.encrypt\(CHECK_TEXT, p\)\)/g, "").replace(/localStorage\.getItem\(key\)/g, "").replace(/localStorage\.setItem\(key, on \? "1" : "0"\)/g, "").replace(/fetch\("\/search\?q=wbenc1\.[^"]*"/g, "");
    ok(!/localStorage|sessionStorage|indexedDB|document\.cookie|fetch\(|XMLHttpRequest|sendBeacon|WebSocket|https?:\/\//.test(stripped), "page script stores only the check value and only asks the board's own /search (no other storage or network)");
  }
  ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/.test(fs.readFileSync(here("page.src.js"), "utf8")), "page script writes decrypted text with textContent only");
  return parts;
}

async function pageTests(parts) {
  let JSDOM;
  try { ({ JSDOM } = require(process.env.JSDOM_PATH || "jsdom")); } catch (e) { console.log("SKIP page-script tests (jsdom not found; set JSDOM_PATH)"); return; }
  const dom = new JSDOM("<!doctype html><html><head><style></style></head><body><header id='hdr'></header><main><p id='task1'>Pay rent</p></main></body></html>", { url: "http://localhost/", runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window, d = w.document;
  Object.defineProperty(w, "crypto", { value: nodeCrypto.webcrypto, configurable: true });
  w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder;
  const timers = []; const realST = w.setTimeout.bind(w); w.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; }; w.clearTimeout = (id) => { if (timers[id - 1]) timers[id - 1].dead = true; };
  d.querySelector("style").textContent = parts.css;
  d.getElementById("hdr").innerHTML = parts.button;
  d.body.insertAdjacentHTML("beforeend", parts.panel + parts.pane);
  w.eval("var boardHooks = { list: { editorOpen: [], beforeSave: [] }, on(n, f) { this.list[n].push(f); } };");   // the board's registry, same shape
  w.eval(fs.readFileSync(here("page.js"), "utf8"));
  ok(w.boardHooks.list.editorOpen.length === 1 && w.boardHooks.list.beforeSave.length === 1, "the add-on registers for the editor-open and before-save hooks");

  const $ = (id) => d.getElementById(id), click = (id) => $(id).dispatchEvent(new w.Event("click", { bubbles: true }));
  const settle = async (cond) => { for (let i = 0; i < 400 && !cond(); i++) await new Promise((r) => realST(r, 25)); };
  const type = (id, v) => { $(id).value = v; };
  const runEnc = async () => { const before = $("cryptMsg").textContent + "|" + $("cryptOut").value; click("cryptEnc"); await settle(() => ($("cryptMsg").textContent + "|" + $("cryptOut").value) !== before); };

  ok($("cryptPanel").hidden === true, "panel starts hidden");
  click("cryptBtn"); await settle(() => !!d.querySelector(".crypt-dialog")); ok($("cryptPanel").hidden === true && !!d.querySelector(".crypt-dialog"), "while locked, the header button opens the unlock dialog");
  d.querySelector(".crypt-dialog .crypt-linkbtn").click(); ok($("cryptPanel").hidden === false && !d.querySelector(".crypt-dialog"), "the dialog has a way to the panel instead");
  w.document.getElementById("cryptPanel").dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true })); ok($("cryptPanel").hidden === true, "Escape closes the panel");
  click("cryptBtn");

  type("cryptText", "my secret <img src=x onerror=alert(1)>"); await runEnc();
  ok(/Enter a passphrase/.test($("cryptMsg").textContent) && $("cryptOut").value === "", "encrypt without a passphrase is refused");
  type("cryptPass", "page pass"); type("cryptPass2", "page typo"); await runEnc();
  ok(/do not match/.test($("cryptMsg").textContent) && $("cryptOut").value === "", "mismatched confirmation is refused, so a typo cannot lock the data");
  type("cryptPass2", "page pass"); await runEnc();
  const token = $("cryptOut").value;
  ok(/^wbenc1\./.test(token), "encrypt produces a token");
  ok($("cryptState").textContent.includes("Unlocked") && $("cryptPass").value === "" && $("cryptPass2").value === "", "after encrypting it is unlocked and the passphrase fields are cleared");
  ok(await core.decrypt(token, "page pass") === "my secret <img src=x onerror=alert(1)>", "the browser token decrypts with the same core outside the page");

  type("cryptText", token); click("cryptDec"); await settle(() => $("cryptOut").value.startsWith("my secret"));
  ok($("cryptOut").value === "my secret <img src=x onerror=alert(1)>", "decrypt uses the unlocked passphrase when none is typed");

  click("cryptLock"); await settle(() => $("cryptState").textContent.includes("Locked"));
  ok($("cryptState").textContent.includes("Locked") && $("cryptText").value === "" && $("cryptOut").value === "", "Lock now clears the fields and locks");
  ok(!$("cryptConfirmWrap").hidden, "the confirmation field is shown again when locked");

  $("task1").textContent = "Bank " + token + " ok";
  const boardBefore = d.getElementById("task1").textContent;
  click("cryptScan"); await new Promise((r) => realST(r, 50));
  ok(/Enter a passphrase/.test($("cryptMsg").textContent) && $("cryptFound").children.length === 0, "scan while locked asks for the passphrase");
  type("cryptPass", "wrong one"); click("cryptScan"); await settle(() => $("cryptFound").children.length > 0);
  ok(/could not decrypt/.test($("cryptFound").textContent) && $("cryptState").textContent.includes("Locked"), "scan with the wrong passphrase shows a failure and stays locked");
  type("cryptPass", "page pass"); click("cryptScan"); await settle(() => /my secret/.test($("cryptFound").textContent));
  ok($("cryptFound").textContent.includes("my secret <img src=x onerror=alert(1)>"), "scan shows the decrypted text");
  ok($("cryptFound").querySelector("img") === null, "decrypted text is shown as text, never as HTML");
  ok(d.getElementById("task1").textContent === boardBefore, "scan does not change the board's own text (nothing decrypted can be saved back)");
  ok($("cryptState").textContent.includes("Unlocked"), "a successful scan unlocks");

  const t0 = timers.length; type("cryptText", "again"); type("cryptPass", ""); click("cryptCopy");
  const auto = timers.filter((t, i) => !t.dead && i >= 0).pop();
  ok(auto && auto.ms === 5 * 60000, "idle timer is armed for 5 minutes by default");
  auto.fn(); await settle(() => $("cryptState").textContent.includes("Locked"));
  ok($("cryptState").textContent.includes("Locked") && /idle/.test($("cryptMsg").textContent), "the idle timer locks the page");

  type("cryptPass", "page pass"); type("cryptPass2", "page pass"); type("cryptText", "x"); await runEnc();
  ok($("cryptState").textContent.includes("Unlocked"), "unlocked again");
  Object.defineProperty(d, "hidden", { value: true, configurable: true }); d.dispatchEvent(new w.Event("visibilitychange")); await settle(() => $("cryptState").textContent.includes("Locked"));
  ok($("cryptState").textContent.includes("Locked") && /tab was hidden/.test($("cryptMsg").textContent), "hiding the tab locks");

  {
    const keys = []; for (let i = 0; i < w.localStorage.length; i++) keys.push(w.localStorage.key(i));
    const chk = w.localStorage.getItem("wbcrypt.check") || "";
    ok(w.sessionStorage.length === 0 && keys.every((k) => /^wbcrypt\.(check|editor|placeholder)$/.test(k)) && (!chk || (chk.startsWith("wbenc1.") && !chk.includes("hunter") )), "the only thing stored in the browser is the check value (an encrypted fixed phrase), never the passphrase or any text");
    ok(!JSON.stringify(Object.values(w.localStorage)).includes("correct horse"), "the passphrase is not in browser storage");
  }
  ok(!d.documentElement.outerHTML.includes("page pass"), "the passphrase does not appear anywhere in the page");
  w.close();
}

(async () => {
  await coreTests();
  cliTests();
  const parts = addonFileTests();
  await pageTests(parts);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
