/* wbcrypt core: encrypt and decrypt short text for storage in WorkFlowy (or anywhere else).
   One file, no dependencies. Runs unchanged in Node (18+) and in the browser, using the standard WebCrypto API.
   The board add-on and the command-line tool both use this exact file, so the format can never drift.

   Format:  wbenc1.<base64url( salt(16) | iv(12) | ciphertext+tag )>
   Cipher:  AES-256-GCM, 128-bit tag, fresh random salt and IV for every call.
   Key:     PBKDF2-SHA256, 600,000 iterations, from your passphrase and the per-token salt.
   Token characters are A-Z a-z 0-9 - _ and "." only, so WorkFlowy will not read them as #tags, @mentions or dates.

   There is no recovery: a lost passphrase means the data cannot be decrypted by anyone. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.wbcrypt = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var PREFIX = "wbenc1.";
  var ITERATIONS = 600000;
  var SALT_BYTES = 16;
  var IV_BYTES = 12;
  var TAG_BYTES = 16;
  var TOKEN_RE = /wbenc1\.[A-Za-z0-9_-]{59,}/g;      // smallest possible body: salt 16 + IV 12 + tag 16 = 44 bytes = 59 base64url characters
  var enc = new TextEncoder();
  var dec = new TextDecoder("utf-8", { fatal: true });

  function webcrypto() {
    var c = (typeof globalThis !== "undefined" && globalThis.crypto) || null;
    if (c && c.subtle) return c;
    if (typeof require === "function") { var n = require("node:crypto").webcrypto; if (n && n.subtle) return n; }
    throw new Error("WebCrypto is not available here (needs Node 18+ or a secure browser context: https or localhost).");
  }

  function toB64u(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    var b64 = typeof btoa === "function" ? btoa(s) : Buffer.from(bytes).toString("base64");
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function fromB64u(str) {
    if (!/^[A-Za-z0-9_-]*$/.test(str)) throw new Error("Not a valid wbcrypt token.");
    if (str.length % 4 === 1) throw new Error("Token is damaged or cut off.");   // no byte count produces this length
    var b64 = str.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    if (typeof atob === "function") {
      var bin = atob(b64), out = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    return new Uint8Array(Buffer.from(b64, "base64"));
  }

  async function deriveKey(passphrase, salt, usage) {
    if (typeof passphrase !== "string" || passphrase.length === 0) throw new Error("A passphrase is required.");
    var c = webcrypto();
    var base = await c.subtle.importKey("raw", enc.encode(passphrase.normalize("NFKC")), "PBKDF2", false, ["deriveKey"]);
    return c.subtle.deriveKey(
      { name: "PBKDF2", salt: salt, iterations: ITERATIONS, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, false, [usage]
    );
  }

  /** Encrypt text. Returns a token string starting with "wbenc1.". */
  async function encrypt(text, passphrase) {
    if (typeof text !== "string") throw new Error("Text to encrypt must be a string.");
    var c = webcrypto();
    var salt = c.getRandomValues(new Uint8Array(SALT_BYTES));
    var iv = c.getRandomValues(new Uint8Array(IV_BYTES));
    var key = await deriveKey(passphrase, salt, "encrypt");
    var ct = new Uint8Array(await c.subtle.encrypt({ name: "AES-GCM", iv: iv, tagLength: 128 }, key, enc.encode(text)));
    var out = new Uint8Array(SALT_BYTES + IV_BYTES + ct.length);
    out.set(salt, 0); out.set(iv, SALT_BYTES); out.set(ct, SALT_BYTES + IV_BYTES);
    return PREFIX + toB64u(out);
  }

  /** Decrypt a token. Throws "Wrong passphrase or damaged data." if the passphrase is wrong or the token was altered. */
  async function decrypt(token, passphrase) {
    if (!isToken(token)) throw new Error("Not a wbcrypt token (expected it to start with " + PREFIX + ").");
    var body = token.slice(PREFIX.length);
    if (body.length < 59) throw new Error("Token is too short; it may have been cut off.");   // 59 = base64url length of salt + IV + tag
    var raw = fromB64u(body);
    var salt = raw.slice(0, SALT_BYTES), iv = raw.slice(SALT_BYTES, SALT_BYTES + IV_BYTES), ct = raw.slice(SALT_BYTES + IV_BYTES);
    var key = await deriveKey(passphrase, salt, "decrypt");
    var plain;
    try { plain = await webcrypto().subtle.decrypt({ name: "AES-GCM", iv: iv, tagLength: 128 }, key, ct); }
    catch (e) { throw new Error("Wrong passphrase or damaged data."); }
    return dec.decode(plain);
  }

  /** True for a string that is exactly one token (not a check that it can be decrypted). */
  function isToken(s) {
    return typeof s === "string" && s.indexOf(PREFIX) === 0 && /^[A-Za-z0-9_-]+$/.test(s.slice(PREFIX.length));
  }

  /** Find every token inside a longer string. Returns [{ token, index }]. */
  function findTokens(s) {
    var out = [], m, re = new RegExp(TOKEN_RE.source, "g");
    while ((m = re.exec(String(s))) !== null) out.push({ token: m[0], index: m.index });
    return out;
  }

  /** Replace every token inside a string with the result of an async function (token) => string. Tokens that fail are left as they were. */
  async function replaceTokens(s, fn) {
    s = String(s);
    var found = findTokens(s), out = "", last = 0;
    for (var i = 0; i < found.length; i++) {
      out += s.slice(last, found[i].index);
      var rep; try { rep = await fn(found[i].token); } catch (e) { rep = found[i].token; }
      out += rep;
      last = found[i].index + found[i].token.length;
    }
    return out + s.slice(last);
  }

  return { version: "1.0.0", format: "wbenc1", prefix: PREFIX, iterations: ITERATIONS, encrypt: encrypt, decrypt: decrypt, isToken: isToken, findTokens: findTokens, replaceTokens: replaceTokens };
});
