#!/usr/bin/env node
/* wbcrypt command-line tool. Standalone: needs only Node 18+ and wbcrypt-core.js beside it.

   Usage:
     node cli.js enc "text to protect"          encrypt text (or pipe it in on stdin)
     node cli.js dec wbenc1.xxxxx               decrypt one token (or pipe text in on stdin)
     node cli.js dec-text "Pay @2:30pm wbenc1.xxxxx"   decrypt every token found inside a longer line
     node cli.js check                          print the format and settings

   Passphrase (never put it on the command line, where shell history keeps it):
     WBCRYPT_PASSPHRASE=...      environment variable, or
     --pass-file path            first line of a file, or
     (default) you are asked for it, with typing hidden. When encrypting you are asked twice.
*/
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const core = require(path.join(__dirname, "wbcrypt-core.js"));

function fail(msg) { process.stderr.write("wbcrypt: " + msg + "\n"); process.exit(1); }

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (d) => (data += d));
    process.stdin.on("end", () => resolve(data));
  });
}

function askHidden(prompt) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) return reject(new Error("No passphrase given. Set WBCRYPT_PASSPHRASE or use --pass-file."));
    process.stderr.write(prompt);
    const stdin = process.stdin;
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding("utf8");
    let buf = "";
    const onData = (ch) => {
      for (const c of ch) {
        if (c === "\r" || c === "\n" || c === "\u0004") { stdin.setRawMode(false); stdin.pause(); stdin.removeListener("data", onData); process.stderr.write("\n"); return resolve(buf); }
        if (c === "\u0003") { stdin.setRawMode(false); process.stderr.write("\n"); process.exit(130); }
        if (c === "\u007f" || c === "\b") buf = buf.slice(0, -1); else buf += c;
      }
    };
    stdin.on("data", onData);
  });
}

async function getPassphrase(args, confirm) {
  const i = args.indexOf("--pass-file");
  if (i !== -1) {
    const file = args[i + 1]; if (!file) fail("--pass-file needs a path.");
    args.splice(i, 2);
    return fs.readFileSync(file, "utf8").split(/\r?\n/)[0];
  }
  if (process.env.WBCRYPT_PASSPHRASE) return process.env.WBCRYPT_PASSPHRASE;
  const p = await askHidden("Passphrase: ");
  if (confirm) { const q = await askHidden("Again: "); if (p !== q) fail("The two passphrases did not match."); }
  return p;
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args.shift();
  if (!cmd || cmd === "help" || cmd === "--help") {
    process.stdout.write(fs.readFileSync(__filename, "utf8").split("*/")[0].replace(/^#!.*\n\/\* /, "").trim() + "\n");
    return;
  }
  if (cmd === "check") { process.stdout.write(`format ${core.format}, core ${core.version}, PBKDF2-SHA256 x ${core.iterations}, AES-256-GCM\n`); return; }
  if (!["enc", "dec", "dec-text"].includes(cmd)) fail(`Unknown command "${cmd}". Try: enc, dec, dec-text, check.`);

  const pass = await getPassphrase(args, cmd === "enc");
  let text = args.length ? args.join(" ") : (process.stdin.isTTY ? "" : await readStdin());
  text = text.replace(/\r?\n$/, "");
  if (!text) fail("Nothing to " + (cmd === "enc" ? "encrypt" : "decrypt") + ". Give text as an argument or on stdin.");

  try {
    if (cmd === "enc") process.stdout.write((await core.encrypt(text, pass)) + "\n");
    else if (cmd === "dec") process.stdout.write((await core.decrypt(text.trim(), pass)) + "\n");
    else process.stdout.write((await core.replaceTokens(text, (t) => core.decrypt(t, pass))) + "\n");
  } catch (e) { fail(e.message); }
}

main().catch((e) => fail(e.message));
