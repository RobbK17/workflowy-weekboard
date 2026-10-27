/* Encryption (wbcrypt) add-on: page script source. DO NOT edit page.js; edit this file and run `node build.js`.
   build.js puts wbcrypt-core.js in front of this file to make page.js, because add-ons can only load one script.

   Two parts: (1) the 🔒 panel (encrypt/decrypt anything), (2) the item editor, through the board's hooks
   (boardHooks "editorOpen" and "beforeSave", board 1.2.1+). In the editor, protected text of a name is shown between ⟦ ⟧
   while you are unlocked, and the board only ever sends the encrypted form to WorkFlowy. */
(function () {
  "use strict";
  if (typeof wbcrypt === "undefined") { console.error("crypt add-on: wbcrypt core is missing"); return; }

  var OPEN = "⟦", CLOSE = "⟧";
  var REGION_RE = /⟦([^⟦⟧]*)⟧/g;
  var BRACKET_RE = /[⟦⟧]/;
  // Parts of a name the board reads itself (@times, #tags, @mentions) stay outside the encrypted text, so reminders and tags keep working.
  var CLEAR_RE = /(^|\s)(@\d{1,2}(?::\d{2})?\s?[ap]\.?m\.?|@\d{1,2}:\d{2}|[#@][\w\/-]+)(?=$|[\s.,;!?)])/gi;
  var SKIP_RE = /⟦[^⟦⟧]*⟧|wbenc1\.[A-Za-z0-9_-]{59,}/g;     // already-protected regions and tokens

  var $ = function (id) { return document.getElementById(id); };
  var pass = null;            // the passphrase, only while unlocked, only in this closure (never stored anywhere)
  var timer = null;
  var editors = new Set();    // item editors that are open right now

  // Two settings, kept in this browser: whether the editor is integrated at all, and (when it is not) whether encrypted text is shown as <<secret>>.
  function readOpt(key, dflt) { try { var v = localStorage.getItem(key); return v === null ? dflt : v === "1"; } catch (e) { return dflt; } }
  function writeOpt(key, on) { try { localStorage.setItem(key, on ? "1" : "0"); } catch (e) { /* not remembered */ } }
  function enabledOn() { return readOpt("wbcrypt.enabled", true); }                                  // master switch
  function editorOn() { return enabledOn() && readOpt("wbcrypt.editor", true); }
  function placeholderOn() { return enabledOn() && !readOpt("wbcrypt.editor", true) && readOpt("wbcrypt.placeholder", false); }
  var PLACEHOLDER = "<<secret>>";
  var held = {};              // "nodeId:field" -> the encrypted tokens an open editor is hiding behind <<secret>>

  function setMsg(text, isErr) { var m = $("cryptMsg"); m.textContent = text || ""; m.className = isErr ? "cryptErr" : ""; }
  function showState() {
    $("cryptState").textContent = pass ? "🔓 Unlocked (locks after idle)" : "🔒 Locked";
    $("cryptConfirmWrap").hidden = !!pass;
    var hb = $("cryptBtn");                              // the header button says whether encrypted text can be read right now
    if (hb) {
      hb.textContent = pass ? "🔓 Unlocked" : "🔒";
      hb.classList.toggle("crypt-on", !!pass);
      hb.title = pass ? "Encrypted text is readable on this board right now. Click to lock or manage it." : "Encryption: protect sensitive text before it goes into WorkFlowy";
      hb.setAttribute("aria-label", pass ? "Encryption: unlocked" : "Encryption: locked");
    }
    document.documentElement.classList.toggle("crypt-unlocked", !!pass);
  }

  /* ---------- item editor ---------- */

  function edFor(node) { var found = null; editors.forEach(function (e) { if (e.ctx.node.id === node.id) found = e; }); return found; }
  function hasTokens(s) { return wbcrypt.findTokens(s).length > 0; }
  function say(ed, text, isErr) { ed.status.textContent = text || ""; ed.status.className = "crypt-status" + (isErr ? " cryptErr" : ""); }
  function fire(el) { el.dispatchEvent(new Event("input", { bubbles: true })); }     // the board re-fits the box on "input"

  function markLocked(ed) {
    refreshBtn(ed);
    say(ed, hasTokens(ed.ctx.title.value) ? "Contains encrypted text. Unlock to read and edit it." : "Locked.");
  }

  // The protected part (⟦…⟧) the cursor or selection sits inside, or null.
  function regionAt(v, a, b) {
    var re = new RegExp(REGION_RE.source, "g"), m;
    while ((m = re.exec(v)) !== null) {
      var start = m.index, end = m.index + m[0].length;
      if (a >= start + 1 && b <= end - 1) return { start: start, end: end, inner: m[1] };
    }
    return null;
  }

  // One button, never two: it says what it will do right now.
  function refreshBtn(ed) {
    var t = ed.ctx.title, b = ed.btn;
    if (!pass && hasTokens(t.value)) {
      ed.mode = "unlock"; b.textContent = "🔓 Unlock"; b.title = "Enter your passphrase to read and edit the encrypted text";
    } else if (regionAt(t.value, t.selectionStart, t.selectionEnd)) {
      ed.mode = "remove"; b.textContent = "🔓 Remove encryption"; b.title = "Store this part as plain, readable text";
    } else {
      ed.mode = "encrypt"; b.textContent = "🔒 Encrypt"; b.title = "Encrypt the selected text, or the whole name when nothing is selected (Ctrl/Cmd+Shift+E)";
    }
  }

  function removeProtection(ed) {
    var t = ed.ctx.title, v = t.value, r = regionAt(v, t.selectionStart, t.selectionEnd);
    if (!r) return refreshBtn(ed);
    t.value = v.slice(0, r.start) + r.inner + v.slice(r.end);
    t.setSelectionRange(r.start, r.start + r.inner.length); fire(t); t.focus();
    refreshBtn(ed);
    say(ed, "That part will be saved as plain, readable text.", true);
    touch();
  }

  function doButton(ed) {
    refreshBtn(ed);
    if (ed.mode === "unlock") {
      if (ed.prompt && ed.prompt.p1.value) { ed.prompt.submit(); return; }     // typed the passphrase, then clicked this Unlock button instead of the prompt's own
      ed.pending = null; showPrompt(ed);
    }
    else if (ed.mode === "remove") removeProtection(ed);
    else protect(ed);
  }

  // Shows the encrypted parts of the name as ⟦readable text⟧. Anything that can't be opened is left as it was.
  async function reveal(ed) {
    var title = ed.ctx.title;
    var found = wbcrypt.findTokens(title.value);
    ed.originals = [];
    if (!found.length || !pass) { say(ed, ""); refreshBtn(ed); return; }
    var map = {}, failed = 0;
    for (var i = 0; i < found.length; i++) {
      var t = found[i].token;
      if (t in map) continue;
      try {
        var plain = await wbcrypt.decrypt(t, pass);
        map[t] = BRACKET_RE.test(plain) ? null : plain;     // text containing ⟦ ⟧ can't be shown safely, so it stays encrypted
      } catch (e) { map[t] = null; }
      if (map[t] === null) failed++;
    }
    var now = title.value, cur = wbcrypt.findTokens(now), out = "", last = 0;
    cur.forEach(function (f) {
      var plain = map[f.token];
      out += now.slice(last, f.index);
      if (typeof plain === "string") { out += OPEN + plain + CLOSE; ed.originals.push({ plain: plain, token: f.token }); }
      else out += f.token;
      last = f.index + f.token.length;
    });
    out += now.slice(last);
    if (out !== now) { title.value = out; fire(title); }
    refreshBtn(ed);
    say(ed, failed ? failed + " encrypted part" + (failed === 1 ? "" : "s") + " could not be opened with this passphrase." : "Protected text is shown between ⟦ ⟧ and is encrypted when you save.", !!failed);
    touch();
  }

  // Turns every ⟦…⟧ into encrypted text. A part you didn't change keeps its old encrypted text (so saving doesn't churn it).
  async function seal(text, ed) {
    var originals = ed && ed.originals ? ed.originals.slice() : [];
    var re = new RegExp(REGION_RE.source, "g"), out = "", last = 0, m;
    while ((m = re.exec(text)) !== null) {
      out += text.slice(last, m.index);
      var plain = m[1];
      if (plain !== "") {
        var k = -1;
        for (var i = 0; i < originals.length; i++) if (originals[i].plain === plain) { k = i; break; }
        if (k >= 0) { out += originals[k].token; originals.splice(k, 1); }
        else out += await wbcrypt.encrypt(plain, pass);
      }
      last = m.index + m[0].length;
    }
    out += text.slice(last);
    if (BRACKET_RE.test(out)) throw new Error("Could not encrypt this text; nothing was saved.");     // never let a marker through
    return out;
  }

  // Before the passphrase is forgotten, open editors get their protected parts sealed, so no readable text is left on the page.
  async function sealEditors() {
    var list = []; editors.forEach(function (e) { list.push(e); });
    for (var i = 0; i < list.length; i++) {
      var ed = list[i], t = ed.ctx.title;
      if (!BRACKET_RE.test(t.value)) { markLocked(ed); continue; }
      try {
        if (BRACKET_RE.test(t.value.replace(REGION_RE, ""))) throw new Error("unmatched");
        t.value = await seal(t.value, ed);
      } catch (e) { ed.ctx.cancel(); continue; }       // can't seal it: discard the edit rather than leave readable text
      fire(t);
      markLocked(ed);
    }
  }

  function wrapRun(run) {
    var m = run.match(/^(\s*)([\s\S]*?)(\s*)$/);
    return m[2] ? m[1] + OPEN + m[2] + CLOSE + m[3] : run;
  }
  function wrapSegment(seg) {
    var re = new RegExp(CLEAR_RE.source, "gi"), out = "", last = 0, m;
    while ((m = re.exec(seg)) !== null) {
      var start = m.index + m[1].length;
      out += wrapRun(seg.slice(last, start)) + seg.slice(start, m.index + m[0].length);
      last = m.index + m[0].length;
    }
    return out + wrapRun(seg.slice(last));
  }
  // The whole name, except @times, #tags, @mentions and anything already protected.
  function wrapName(v) {
    var re = new RegExp(SKIP_RE.source, "g"), out = "", last = 0, m;
    while ((m = re.exec(v)) !== null) { out += wrapSegment(v.slice(last, m.index)) + m[0]; last = m.index + m[0].length; }
    return out + wrapSegment(v.slice(last));
  }
  function overlaps(v, a, b) {
    var re = new RegExp(SKIP_RE.source, "g"), m;
    while ((m = re.exec(v)) !== null) if (m.index < b && m.index + m[0].length > a) return true;
    return false;
  }

  function applyWrap(ed) {
    var t = ed.ctx.title, v = t.value, a = t.selectionStart, b = t.selectionEnd, next;
    if (a !== b) {
      var inner = v.slice(a, b);
      if (!inner.trim()) return say(ed, "Select some text first, or press the button with nothing selected to protect the whole name.", true);
      if (BRACKET_RE.test(inner) || overlaps(v, a, b)) return say(ed, "That part is already protected.", true);
      var lead = inner.match(/^\s*/)[0], trail = inner.match(/\s*$/)[0];
      next = v.slice(0, a) + lead + OPEN + inner.slice(lead.length, inner.length - trail.length) + CLOSE + trail + v.slice(b);
    } else {
      if (BRACKET_RE.test(v) || hasTokens(v)) return say(ed, "This name already has encrypted text. Select the words you want to encrypt.", true);
      next = wrapName(v);
    }
    if (next === v) return say(ed, "Nothing to protect: the name has no text outside @times and #tags.", true);
    t.value = next; fire(t); t.focus();
    say(ed, "Protected text is shown between ⟦ ⟧ and is encrypted when you save.");
    touch();
  }

  function protect(ed) {
    if (!pass) { ed.pending = "wrap"; showPrompt(ed); return; }
    applyWrap(ed);
  }

  /* ---------- the check value: lets an unlock be verified from a single entry ---------- */

  var CHECK_KEY = "wbcrypt.check", CHECK_TEXT = "wbcrypt-check-v1";
  function storedCheck() { try { return localStorage.getItem(CHECK_KEY); } catch (e) { return null; } }
  async function saveCheck(p) { try { localStorage.setItem(CHECK_KEY, await wbcrypt.encrypt(CHECK_TEXT, p)); } catch (e) { /* storage blocked: the passphrase is just asked twice next time */ } }
  function clearCheck() { try { localStorage.removeItem(CHECK_KEY); } catch (e) { /* nothing to clear */ } }

  // Something the typed passphrase can be tested against: a token in the open editor, the check value kept in this browser,
  // or any encrypted line the board already holds (found through the board's search). Null when there is none: then it is a first-time setup.
  async function findProof(ed) {
    var own = ed ? wbcrypt.findTokens(ed.ctx.title.value)[0] : null;
    if (own) return { token: own.token, kind: "line" };
    var chk = storedCheck();
    if (chk) return { token: chk, kind: "check" };
    try {
      var ctl = typeof AbortController === "function" ? new AbortController() : null;
      var tm = setTimeout(function () { if (ctl) ctl.abort(); }, 5000);      // a big outline can take a while to index: don't wait long
      var res = await fetch("/search?q=wbenc1.&limit=3", ctl ? { signal: ctl.signal } : undefined);
      clearTimeout(tm);
      if (!res.ok) return null;
      var hits = (await res.json()).hits || [];
      for (var i = 0; i < hits.length; i++) {
        var found = wbcrypt.findTokens(hits[i].name || "")[0];
        if (!found && typeof call === "function") {
          try { var one = await call("GET", "/nodes/" + hits[i].id); var nd = one && (one.node || one); found = wbcrypt.findTokens((nd && (nd.name || "") + " " + (nd && nd.note || "")) || "")[0]; } catch (e) { /* try the next hit */ }
        }
        if (found) return { token: found.token, kind: "line" };
      }
    } catch (e) { /* no search available */ }
    return null;
  }
  async function proofHolds(proof, p) {
    try { var t = await wbcrypt.decrypt(proof.token, p); return proof.kind === "check" ? t === CHECK_TEXT : true; }
    catch (e) { return false; }
  }

  // A rough guide, not a rule: length and variety. Advice only, nothing is refused.
  function strengthOf(v) {
    if (!v) return { level: 0, text: "" };
    var words = v.trim().split(/[\s._-]+/).filter(Boolean).length;
    var kinds = (/[a-z]/.test(v) ? 1 : 0) + (/[A-Z]/.test(v) ? 1 : 0) + (/[0-9]/.test(v) ? 1 : 0) + (/[^A-Za-z0-9]/.test(v) ? 1 : 0);
    if (v.length >= 20 || (words >= 4 && v.length >= 16)) return { level: 3, text: "Strong" };
    if (v.length >= 14 && kinds >= 2) return { level: 2, text: "Good" };
    return { level: 1, text: "Weak: use 4 or more random words, or 14+ characters" };
  }
  function hintFor(input, el) {
    var f = function () { var r = strengthOf(input.value); el.textContent = r.text ? "Strength: " + r.text : ""; el.className = "crypt-strength s" + r.level; };
    input.addEventListener("input", f); f();
  }

  // Unlock in a dialog (from an editor, or from the header button with ed = null), in a dialog in the middle of the page (so it never has to fit inside a narrow card).
  // If the name already holds encrypted text, opening it proves the passphrase; otherwise it is asked twice.
  var modal = null;
  async function showPrompt(ed) {
    if (modal) { if (modal.p1) modal.p1.focus(); return; }
    modal = { opening: true };
    var proof = await findProof(ed);
    var needConfirm = !proof;
    var back = document.createElement("div"); back.className = "crypt-modal";
    var dlg = document.createElement("div"); dlg.className = "crypt-dialog"; dlg.setAttribute("role", "dialog"); dlg.setAttribute("aria-modal", "true"); dlg.setAttribute("aria-label", "Unlock encrypted text");
    var h = document.createElement("h2"); h.textContent = "🔓 Unlock encrypted text";
    var info = document.createElement("p"); info.textContent = needConfirm
      ? "First time here: choose your passphrase. Type it twice so a typo can't lock you out of your own data. After this you only type it once. It stays in this page's memory and is never saved or sent anywhere."
      : "Enter your passphrase. It stays in this page's memory until you lock, and is never saved or sent anywhere.";
    var strength = document.createElement("div");
    var p1 = document.createElement("input"), p2 = document.createElement("input");
    [p1, p2].forEach(function (p) { p.type = "password"; p.autocomplete = "off"; p.spellcheck = false; p.setAttribute("data-1p-ignore", ""); p.setAttribute("data-lpignore", "true"); });
    p1.placeholder = "Passphrase"; p2.placeholder = "Type it again";
    var ok = document.createElement("button"), no = document.createElement("button"), msg = document.createElement("div");
    ok.type = no.type = "button"; ok.textContent = "Unlock"; no.textContent = "Cancel"; msg.className = "crypt-pmsg"; msg.setAttribute("role", "alert");
    var btns = document.createElement("div"); btns.className = "crypt-dbtns";
    if (!ed) {                                            // opened from the header: the panel (encrypt/decrypt any text) is one click away
      var pb = document.createElement("button"); pb.type = "button"; pb.className = "crypt-linkbtn"; pb.textContent = "Open panel instead";
      pb.addEventListener("click", function () { back.remove(); modal = null; toggle(true); });
      btns.append(pb);
    }
    btns.append(no, ok);
    dlg.append(h, info, p1); if (needConfirm) { dlg.append(p2, strength); hintFor(p1, strength); } dlg.append(msg, btns);
    back.append(dlg); document.body.append(back);
    if (ed) ed.ctx.box.dataset.hold = "1";              // the editor stays open behind the dialog
    modal = { p1: p1, back: back };
    if (ed) ed.prompt = modal;
    function close() {
      back.remove(); modal = null;
      if (ed) { delete ed.ctx.box.dataset.hold; ed.prompt = null; ed.pending = null; ed.ctx.title.focus(); }
    }
    var busy = false;
    async function submit() {
      if (busy) return;
      msg.textContent = "";
      if (!p1.value) { msg.textContent = "Enter a passphrase."; return; }
      if (needConfirm && p1.value !== p2.value) { msg.textContent = "The two passphrases do not match."; return; }
      busy = true; ok.disabled = true; ok.textContent = "Checking…";
      try {
        if (proof && !(await proofHolds(proof, p1.value))) throw new Error("no");
      } catch (e) {
        msg.textContent = proof && proof.kind === "check" ? "That is not the passphrase set up in this browser." : "That passphrase does not open your encrypted text.";
        if (proof && proof.kind === "check" && !btns.querySelector(".crypt-reset")) {        // the stored check may be from a passphrase you no longer use
          var rb = document.createElement("button"); rb.type = "button"; rb.className = "crypt-linkbtn crypt-reset"; rb.textContent = "Set up a new passphrase instead";
          rb.addEventListener("click", function () { clearCheck(); close(); showPrompt(ed); });
          btns.prepend(rb);
        }
        busy = false; ok.disabled = false; ok.textContent = "Unlock"; p1.focus(); p1.select(); return;
      }
      if (needConfirm || (proof && proof.kind === "line")) await saveCheck(p1.value);      // remembered in this browser, so next time one entry is enough
      var action = ed ? ed.pending : null;
      unlockWith(p1.value);        // reveals every open editor, including this one
      back.remove(); modal = null;
      if (!ed) return;
      delete ed.ctx.box.dataset.hold; ed.prompt = null; ed.pending = null;
      ed.ctx.title.focus();
      if (action === "wrap") { await reveal(ed); ed.ctx.title.focus(); applyWrap(ed); }
      else if (action === "save") { await reveal(ed); ed.ctx.save(); }
    }
    [p1, p2].forEach(function (p) {
      p.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); submit(); }
        else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
      });
    });
    back.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); close(); } });
    back.addEventListener("mousedown", function (e) { if (e.target === back) { e.preventDefault(); close(); } });     // click outside the dialog cancels
    modal.submit = submit;
    ok.addEventListener("click", submit); no.addEventListener("click", close);
    setTimeout(function () { p1.focus(); }, 0);
  }

  function buildBar(ed) {
    var bar = document.createElement("div"); bar.className = "crypt-bar";
    var btn = document.createElement("button"); btn.type = "button"; btn.className = "crypt-lock";
    var st = document.createElement("span"); st.className = "crypt-status";
    bar.append(btn);
    if (ed.ctx.tools) { ed.ctx.tools.prepend(bar); ed.ctx.tools.after(st); }      // board 1.2.1+: the button shares the row with the line type; its message goes underneath
    else { bar.append(st); ed.ctx.title.after(bar); }
    ed.bar = bar; ed.status = st; ed.btn = btn;
    refreshBtn(ed);
    btn.addEventListener("mousedown", function (e) { e.preventDefault(); });     // keep the selection and the focus in the title box
    btn.addEventListener("click", function () { doButton(ed); });
    var t = ed.ctx.title, again = function () { refreshBtn(ed); };
    ["keyup", "click", "input", "select", "mouseup"].forEach(function (n) { t.addEventListener(n, again); });
    var onSel = function () { if (document.activeElement === t) refreshBtn(ed); };
    document.addEventListener("selectionchange", onSel);
    ed.ctx.onClose(function () { document.removeEventListener("selectionchange", onSel); });
    t.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "e" || e.key === "E")) { e.preventDefault(); e.stopPropagation(); doButton(ed); }
    });
  }

  // Integration off, placeholder on: each token in the open editor is shown as <<secret>> and put back on save.
  function hideTokens(ctx) {
    [["name", ctx.title], ["note", ctx.note]].forEach(function (pair) {
      var el = pair[1], found = wbcrypt.findTokens(el.value);
      if (!found.length) return;
      var key = ctx.node.id + ":" + pair[0], v = el.value, out = "", last = 0;
      held[key] = found.map(function (f) { return f.token; });
      found.forEach(function (f) { out += v.slice(last, f.index) + PLACEHOLDER; last = f.index + f.token.length; });
      el.value = out + v.slice(last); fire(el);
    });
    ctx.onClose(function () { delete held[ctx.node.id + ":name"]; delete held[ctx.node.id + ":note"]; });
  }
  function restoreTokens(text, tokens) {
    var parts = text.split(PLACEHOLDER);
    if (parts.length - 1 !== tokens.length) throw new Error("This text holds " + tokens.length + " encrypted part" + (tokens.length === 1 ? "" : "s") + ", shown as " + PLACEHOLDER + ". Keep each " + PLACEHOLDER + " exactly as it is (the text around them can be changed), or turn off the placeholder in Settings > Encryption to work with the raw text.");
    var out = parts[0];
    for (var i = 0; i < tokens.length; i++) out += tokens[i] + parts[i + 1];
    return out;
  }

  boardHooks.on("editorOpen", function (ctx) {
    if (!enabledOn()) return;                           // master switch off: the add-on does nothing in editors
    if (!editorOn()) { if (placeholderOn()) hideTokens(ctx); return; }
    var ed = { ctx: ctx, originals: [], pending: null, prompt: null };
    editors.add(ed);
    ctx.onClose(function () { editors.delete(ed); });
    buildBar(ed);
    if (hasTokens(ctx.title.value)) { if (pass) reveal(ed); else markLocked(ed); }
  });

  // Fail closed: readable text is never sent. Without the passphrase, or if anything is off, the save is stopped and the editor stays open.
  boardHooks.on("beforeSave", async function (text, ctx) {
    var hidden = held[ctx.node.id + ":" + ctx.field];
    if (hidden) return restoreTokens(text, hidden);          // the <<secret>> placeholders go back to the original encrypted text
    if (!enabledOn()) return text;                             // master switch off: nothing here touches what you save
    if (ctx.field !== "name" || !BRACKET_RE.test(text)) return text;
    if (BRACKET_RE.test(text.replace(REGION_RE, ""))) throw new Error("The title has an unmatched ⟦ or ⟧. Remove it, or use the 🔒 button to protect text.");
    var ed = edFor(ctx.node);
    if (!pass) { if (ed) { ed.pending = "save"; showPrompt(ed); } throw new Error("Enter your passphrase to save the encrypted text."); }
    var out = await seal(text, ed);
    touch();
    return out;
  });

  /* ---------- timers and locking ---------- */

  async function lock(why) {
    if (timer) { clearTimeout(timer); timer = null; }
    try { await sealEditors(); } catch (e) { /* editors that can't be sealed were cancelled */ }
    pass = null;
    ["cryptPass", "cryptPass2", "cryptText", "cryptOut"].forEach(function (id) { $(id).value = ""; });
    $("cryptFound").textContent = "";
    showState();
    setMsg(why || "");
  }

  function touch() {
    if (!pass) return;
    if (timer) clearTimeout(timer);
    var mins = parseInt($("cryptAuto").value, 10) || 5;
    timer = setTimeout(function () { lock("Locked after " + mins + " minute" + (mins === 1 ? "" : "s") + " idle."); }, mins * 60000);
  }

  function unlockWith(p) {
    pass = p; $("cryptPass").value = ""; $("cryptPass2").value = ""; showState(); touch();
    if (!storedCheck()) saveCheck(p);
    editors.forEach(function (ed) { if (hasTokens(ed.ctx.title.value)) reveal(ed); });
  }

  /* ---------- panel ---------- */

  // The passphrase to use now: what is typed, otherwise the unlocked one.
  function currentPass() { return $("cryptPass").value || pass; }

  async function doEncrypt() {
    var text = $("cryptText").value;
    if (!text) return setMsg("Type some text to encrypt first.", true);
    var p = currentPass();
    if (!p) return setMsg("Enter a passphrase first.", true);
    if (!pass && $("cryptPass").value !== $("cryptPass2").value) return setMsg("The two passphrases do not match.", true);
    if (pass && $("cryptPass").value && $("cryptPass").value !== pass) return setMsg("That is not the passphrase this session is unlocked with. Lock first to use a different one.", true);
    try {
      $("cryptOut").value = await wbcrypt.encrypt(text, p);
      if (!pass) unlockWith(p); else touch();
      setMsg("Encrypted. Copy the result into WorkFlowy.");
    } catch (e) { setMsg(e.message, true); }
  }

  async function doDecrypt() {
    var text = $("cryptText").value.trim();
    if (!text) return setMsg("Paste a wbenc1. token to decrypt.", true);
    var p = currentPass();
    if (!p) return setMsg("Enter a passphrase first.", true);
    try {
      var out = wbcrypt.isToken(text)
        ? await wbcrypt.decrypt(text, p)
        : await wbcrypt.replaceTokens(text, function (t) { return wbcrypt.decrypt(t, p); });
      if (out === text) return setMsg("No wbenc1. token found in that text.", true);
      $("cryptOut").value = out;
      if (!pass) unlockWith(p); else touch();     // a successful decrypt proves the passphrase is right
      setMsg("Decrypted.");
    } catch (e) { setMsg(e.message, true); }
  }

  async function copyOut() {
    var v = $("cryptOut").value;
    if (!v) return setMsg("Nothing to copy yet.", true);
    try { await navigator.clipboard.writeText(v); setMsg("Copied. Clear your clipboard when you are done if this is sensitive."); }
    catch (e) { $("cryptOut").select(); setMsg("Press Ctrl/Cmd+C to copy the selected text."); }
    touch();
  }

  // Read-only list of tokens found in the board's visible text. It never changes the board's own text, so
  // nothing decrypted can be written back to WorkFlowy by an edit. (The board shows tokens as a lock, so this finds
  // tokens in text boxes only; use it for tokens in notes and other places the board shows as they are.)
  async function scanBoard() {
    var list = $("cryptFound");
    list.textContent = "";
    var p = currentPass();
    if (!p) return setMsg("Enter a passphrase first, then scan.", true);
    var panel = $("cryptPanel"), seen = {}, tokens = [];
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) { return panel.contains(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
    });
    var n;
    while ((n = walker.nextNode()) && tokens.length < 200) {
      wbcrypt.findTokens(n.nodeValue).forEach(function (f) { if (!seen[f.token]) { seen[f.token] = 1; tokens.push(f.token); } });
    }
    if (!tokens.length) return setMsg("No wbenc1. tokens found in the text currently on the board.");
    var ok = 0, bad = 0;
    for (var i = 0; i < tokens.length; i++) {
      var li = document.createElement("li"), small = document.createElement("small");
      small.textContent = tokens[i].slice(0, 16) + "…";
      var body = document.createElement("span");
      try { body.textContent = await wbcrypt.decrypt(tokens[i], p); ok++; }
      catch (e) { body.textContent = "(could not decrypt with this passphrase)"; bad++; }
      li.appendChild(body); li.appendChild(small); list.appendChild(li);
    }
    if (ok && !pass) unlockWith(p); else touch();
    setMsg(ok + " decrypted" + (bad ? ", " + bad + " not decryptable with this passphrase" : "") + ".", !ok);
  }


  /* ---------- change the passphrase: re-encrypt everything that already exists ---------- */

  async function encryptedIds(onNote) {
    var ids = [], seen = {}, offset = 0, total = null, throttled = false;
    while (total === null || offset < total) {
      var res = await fetch("/search?q=wbenc1.&limit=200&done=1&offset=" + offset + (offset === 0 ? "&refresh=1" : ""));
      if (!res.ok) throw new Error("Search failed (" + res.status + ")");
      var data = await res.json();
      if (data.throttled) throttled = true;
      total = data.total || 0;
      (data.hits || []).forEach(function (h) { if (!seen[h.id]) { seen[h.id] = 1; ids.push(h.id); } });
      if (!data.hits || !data.hits.length) break;
      offset += data.hits.length;
      onNote("Found " + ids.length + " of " + total + "…");
    }
    return { ids: ids, throttled: throttled };
  }

  async function reencryptText(text, oldP, newP, stats) {
    var found = wbcrypt.findTokens(text || ""), out = text || "", done = {};
    for (var i = 0; i < found.length; i++) {
      var tk = found[i].token;
      if (done[tk] !== undefined) continue;
      var plain;
      try { plain = await wbcrypt.decrypt(tk, oldP); } catch (e) { stats.skipped++; done[tk] = null; continue; }
      var nt = await wbcrypt.encrypt(plain, newP);
      if ((await wbcrypt.decrypt(nt, newP)) !== plain) throw new Error("Self-check failed while re-encrypting. Nothing was changed.");
      done[tk] = nt; stats.tokens++;
    }
    Object.keys(done).forEach(function (tk) { if (done[tk]) out = out.split(tk).join(done[tk]); });
    return out;
  }

  var changing = false;
  function changePassphrase() {
    if (!pass) return setMsg("Unlock first, then change the passphrase.", true);
    if (editors.size) return setMsg("Close any open item editors first.", true);
    if (changing || modal) return;
    changing = true;
    var back = document.createElement("div"); back.className = "crypt-modal";
    var dlg = document.createElement("div"); dlg.className = "crypt-dialog"; dlg.setAttribute("role", "dialog"); dlg.setAttribute("aria-modal", "true"); dlg.setAttribute("aria-label", "Change passphrase");
    back.append(dlg); document.body.append(back);
    var working = false;
    function close() { if (working) return; back.remove(); changing = false; }
    back.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); close(); } });
    function el(tag, cls, text) { var x = document.createElement(tag); if (cls) x.className = cls; if (text) x.textContent = text; return x; }
    function btn(label, fn) { var b = el("button", "", label); b.type = "button"; b.addEventListener("click", fn); return b; }

    function formStep() {
      dlg.textContent = "";
      var n1 = el("input"), n2 = el("input"), msg = el("div", "crypt-pmsg"), strength = el("div");
      [n1, n2].forEach(function (i) { i.type = "password"; i.autocomplete = "off"; i.spellcheck = false; i.setAttribute("data-1p-ignore", ""); i.setAttribute("data-lpignore", "true"); });
      n1.placeholder = "New passphrase"; n2.placeholder = "Type the new one again";
      hintFor(n1, strength);
      var go = btn("Scan and review", async function () {
        msg.textContent = "";
        if (!n1.value) { msg.textContent = "Enter the new passphrase."; return; }
        if (n1.value !== n2.value) { msg.textContent = "The two entries do not match."; return; }
        if (n1.value === pass) { msg.textContent = "That is the passphrase you are already using."; return; }
        scanStep(n1.value);
      });
      var btns = el("div", "crypt-dbtns"); btns.append(btn("Cancel", close), go);
      dlg.append(el("h2", "", "🔑 Change passphrase"),
        el("p", "", "Every piece of encrypted text on your board is opened with the passphrase you are using now and sealed again with the new one. Nothing is changed until you have reviewed the count."),
        n1, n2, strength, msg, btns);
      n1.focus();
      [n1, n2].forEach(function (i) { i.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); go.click(); } }); });
    }

    async function scanStep(newP) {
      dlg.textContent = "";
      var status = el("p", "", "Searching your outline for encrypted text…"), btns = el("div", "crypt-dbtns");
      dlg.append(el("h2", "", "🔑 Change passphrase"), status, btns);
      working = true;
      var plan = [], stats = { tokens: 0, skipped: 0 }, throttled = false;
      try {
        var r = await encryptedIds(function (t) { status.textContent = t; });
        throttled = r.throttled;
        for (var i = 0; i < r.ids.length; i++) {
          status.textContent = "Reading " + (i + 1) + " of " + r.ids.length + "…";
          var one = await call("GET", "/nodes/" + r.ids[i]);
          var nd = one && (one.node || one);
          if (!nd) continue;
          var body = {}, nn = await reencryptText(nd.name, pass, newP, stats), no = await reencryptText(nd.note, pass, newP, stats);
          if (nn !== (nd.name || "")) body.name = nn;
          if (no !== (nd.note || "")) body.note = no;
          if (Object.keys(body).length) plan.push({ id: r.ids[i], body: body });
        }
      } catch (e) {
        working = false; status.textContent = "Stopped before changing anything: " + e.message; btns.append(btn("Close", close)); return;
      }
      working = false;
      var lines = [plan.length + " item" + (plan.length === 1 ? "" : "s") + " will be re-encrypted (" + stats.tokens + " encrypted part" + (stats.tokens === 1 ? "" : "s") + ")."];
      if (stats.skipped) lines.push(stats.skipped + " encrypted part" + (stats.skipped === 1 ? "" : "s") + " cannot be opened with your current passphrase (perhaps made with another one) and will be left exactly as they are.");
      if (throttled) lines.push("The list of items may be up to a minute old, because WorkFlowy limits how often the whole outline can be read. If you added encrypted text just now, run this again afterwards.");
      status.textContent = "";
      lines.forEach(function (t) { status.append(el("div", "", t)); });
      if (!plan.length) {
        status.append(el("div", "", "Nothing needs changing, so there is nothing to re-encrypt."));
        btns.append(btn("Close", close)); return;
      }
      status.append(el("div", "crypt-warn", "Do not edit your outline from anywhere else while this runs. If it is interrupted, open Change passphrase again with the same old passphrase: finished items are skipped and it carries on."));
      btns.append(btn("Cancel", close), btn("Re-encrypt " + plan.length + " item" + (plan.length === 1 ? "" : "s"), async function () { runStep(plan, newP); }));
    }

    async function runStep(plan, newP) {
      dlg.textContent = "";
      var status = el("p", "", ""), btns = el("div", "crypt-dbtns");
      dlg.append(el("h2", "", "🔑 Re-encrypting…"), status, btns);
      working = true;
      var i = 0;
      try {
        for (; i < plan.length; i++) {
          status.textContent = "Saving " + (i + 1) + " of " + plan.length + "…";
          await call("POST", "/nodes/" + plan[i].id, plan[i].body);
        }
      } catch (e) {
        working = false;
        status.textContent = "Stopped after " + i + " of " + plan.length + ": " + e.message + ". Your current passphrase is still active. Open Change passphrase again with the same new passphrase to finish: finished items are skipped.";
        btns.append(btn("Close", close)); return;
      }
      working = false;
      unlockWith(newP);                                 // the session now uses the new passphrase
      await saveCheck(newP);
      status.textContent = "Done. " + plan.length + " item" + (plan.length === 1 ? "" : "s") + " re-encrypted. You are unlocked with the new passphrase. Use it from now on, on every device.";
      btns.append(btn("Close", function () { close(); var rf = document.getElementById("refresh"); if (rf) rf.click(); }));     // reload so the board holds the new text
    }
    formStep();
  }

  function toggle(open) {
    var panel = $("cryptPanel");
    var show = typeof open === "boolean" ? open : panel.hidden;
    panel.hidden = !show;
    if (show) { showState(); ($("cryptPass").value || pass ? $("cryptText") : $("cryptPass")).focus(); }
  }

  // Locked: the header button asks for the passphrase right away. Unlocked: it opens the panel (encrypt, decrypt, lock).
  $("cryptBtn").addEventListener("click", function () { if (editorOn() && !pass && $("cryptPanel").hidden) showPrompt(null); else toggle(); });
  $("cryptEnc").addEventListener("click", doEncrypt);
  $("cryptChange").addEventListener("click", changePassphrase);
  $("cryptDec").addEventListener("click", doDecrypt);
  $("cryptCopy").addEventListener("click", copyOut);
  $("cryptScan").addEventListener("click", scanBoard);
  $("cryptLock").addEventListener("click", function () { lock("Locked.").then(function () { toggle(false); }); });     // locking also closes the panel
  $("cryptAuto").addEventListener("change", touch);
  var optE = $("cryptOptEditor"), optP = $("cryptOptPlaceholder");
  var optM = $("cryptOptEnabled");
  function applyEnabled() {                              // the master switch: show or hide the header padlock (and the panel with it)
    var on = enabledOn();
    $("cryptBtn").style.display = on ? "" : "none";
    if (!on) $("cryptPanel").hidden = true;
  }
  function syncOpts() {
    var on = enabledOn(), editor = readOpt("wbcrypt.editor", true);
    optM.checked = on;
    optE.checked = editor; optE.disabled = !on;
    optP.checked = readOpt("wbcrypt.placeholder", false); optP.disabled = !on || editor;
    applyEnabled();
  }
  optM.addEventListener("change", async function () {
    writeOpt("wbcrypt.enabled", optM.checked);
    if (!optM.checked) { try { await lock(""); } catch (e) { /* locking is best effort */ } }     // forget the passphrase and seal any open editor first
    syncOpts();
  });
  optE.addEventListener("change", function () { writeOpt("wbcrypt.editor", optE.checked); syncOpts(); });
  optP.addEventListener("change", function () { writeOpt("wbcrypt.placeholder", optP.checked); syncOpts(); });
  syncOpts();
  $("cryptPanel").addEventListener("keydown", function (e) { if (e.key === "Escape") toggle(false); });
  document.addEventListener("visibilitychange", function () { if (document.hidden && pass) lock("Locked because the tab was hidden."); });
  showState();
})();
