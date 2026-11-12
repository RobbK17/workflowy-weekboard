/* AI Assistant on the phone page: ⋯ > ✨ Assistant opens a full-screen chat. Off unless the server sets AI_PHONE=1 (/ai/status says phone: true);
   without it the ⋯ menu has no Assistant item and the server refuses phone requests. Same server and the same rules as the desktop:
   it asks before changing anything, encrypted words reach it only as ‹secret›, answers stream in with a Stop button. Not here:
   the board tools (show week, open item…), which the server leaves out for the phone, and deleting, which stays off. */
(() => {
  let status = null;
  fetch("/ai/status").then((r) => (r.ok ? r.json() : null)).then((j) => { status = j; }).catch(() => {});
  (window.wbMenu = window.wbMenu || []).push((s) => { if (status && status.enabled && status.phone) sbtn(s, "✨ Assistant…", () => { closeSheet(); aimOpen(); }); });

  const box = document.createElement("div");
  box.id = "aiM"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-label", "Assistant");
  box.innerHTML = '<header><button class="nbtn" id="aiMBack" type="button" aria-label="Back to the board">‹ Board</button><span class="aimt">Assistant</span><button class="nbtn" id="aiMNew" type="button">New chat</button></header>' +
    '<div id="aiMLog" aria-live="polite"></div>' +
    '<form id="aiMForm"><textarea id="aiMIn" rows="1" placeholder="Ask about your tasks…" maxlength="4000" aria-label="Message"></textarea><button class="nbtn go" id="aiMSend" type="submit">Send</button></form>';
  document.body.appendChild(box);
  const log = document.getElementById("aiMLog"), input = document.getElementById("aiMIn"), send = document.getElementById("aiMSend"), form = document.getElementById("aiMForm");
  const hist = [];
  let busy = false, abort = null, stopOk = true, stopped = false;
  const hide = (s) => String(s == null ? "" : s).replace(/wbenc1\.[A-Za-z0-9_-]*/g, "‹secret›");
  const nm = (raw) => hide(plain(raw)).replace(/\s+/g, " ").trim();
  const isTodo = (n) => ((n.data && n.data.layoutMode) || n.layoutMode) === "todo";

  function add(cls, text) {
    const d = document.createElement("div"); d.className = cls; d.textContent = text;
    log.appendChild(d); log.scrollTop = log.scrollHeight; return d;
  }
  function intro() {
    const d = document.createElement("div"); d.className = "aihint";
    const p = document.createElement("div"); p.textContent = "Ask about your tasks, or have me add, tick, move, schedule or prioritise them. I ask before changing anything.";
    d.appendChild(p);
    for (const q of ["What's on today?", "Am I overbooked this week?", "What are my urgent tasks?"]) {
      const b = document.createElement("button"); b.type = "button"; b.textContent = q;
      b.onclick = () => { input.value = q; form.requestSubmit(); };
      d.appendChild(b);
    }
    log.appendChild(d);
  }
  function aimOpen() { box.classList.add("open"); if (!log.children.length) intro(); setTimeout(() => input.focus(), 50); }
  document.getElementById("aiMBack").onclick = () => box.classList.remove("open");
  document.getElementById("aiMNew").onclick = () => { if (busy) return; hist.length = 0; log.replaceChildren(); intro(); };

  // The open tasks on the days the phone shows, with ids, so the assistant can act without searching first.
  function summary() {
    const lines = ["DAYS SHOWN ON THE PHONE"];
    for (const k of weekKeys()) {
      const open = [];
      for (const n of allOf[k] || []) {
        if (isTodo(n)) { if (!n.completedAt) open.push(`  - ${nm(n.name)} (id ${n.id})`); continue; }
        const kids = ((nest[n.id] || {}).todos || []).filter((x) => !x.completedAt);
        if (kids.length) { open.push(`  [group] ${nm(n.name)} (id ${n.id})`); for (const x of kids) open.push(`    - ${nm(x.name)} (id ${x.id})`); }
      }
      lines.push(`${k}${k === sel ? " (the day open on the phone)" : ""}:`, ...(open.length ? open : ["  (no open tasks)"]));
    }
    return lines.join("\n").slice(0, 9000);
  }

  const stepLine = (s) => add("aistep" + (s.done ? " done" : s.error || s.denied ? " bad" : ""), (s.done ? "✓ " : s.denied ? "✕ Declined: " : s.error ? "⚠ " : "· ") + s.summary + (s.error ? " (" + s.error + ")" : ""));
  function applied(undo, changed) {
    if (undo && undo.length) {
      const ops = undo.slice(), label = "AI: " + [...new Set(undo.map((u) => u.label))].join("; ").slice(0, 60);
      pushUndo(label, async () => { for (const op of ops.reverse()) await call(op.method, op.path, op.body); await loadWeek(true); });
    }
    if (changed) loadWeek(true).catch(() => {});
  }
  function usage(u) {
    if (!u || !u.calls) return;
    const f = (n) => (n >= 10000 ? (n / 1000).toFixed(0) + "k" : n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n));
    add("aistep usage", `${u.calls} model call${u.calls === 1 ? "" : "s"} · ${f((u.input || 0) + (u.cacheRead || 0) + (u.cacheWrite || 0))} tokens in${u.cacheRead ? ` (${f(u.cacheRead)} from cache)` : ""} · ${f(u.output || 0)} out`);
  }
  function pendingCard(p) {
    const c = document.createElement("div"); c.className = "aipend";
    const t = document.createElement("div"); t.className = "t"; t.textContent = p.actions.length === 1 ? "Approve this change?" : "Approve these changes?";
    c.appendChild(t);
    const checks = [];
    for (const a of p.actions) {
      const l = document.createElement("label"), x = document.createElement("input"), sp = document.createElement("span");
      x.type = "checkbox"; x.checked = true; x.dataset.id = a.id; checks.push(x); sp.textContent = a.summary; l.append(x, sp); c.appendChild(l);
    }
    const btns = document.createElement("div"); btns.className = "btns";
    const no = document.createElement("button"), ok = document.createElement("button");
    no.type = ok.type = "button"; no.textContent = "Deny all"; ok.textContent = "Apply"; ok.className = "go";
    const decide = (yes) => { if (busy) return; c.classList.add("used"); const dec = {}; for (const x of checks) { dec[x.dataset.id] = yes && x.checked; x.disabled = true; } ok.disabled = no.disabled = true; turn({ resume: p.token, decisions: dec }); };
    ok.onclick = () => decide(true); no.onclick = () => decide(false);
    btns.append(no, ok); c.appendChild(btns);
    log.appendChild(c); log.scrollTop = log.scrollHeight;
  }

  function busyUi(on) {
    busy = on; send.textContent = on ? "Stop" : "Send"; send.classList.toggle("stop", on);
    send.type = on ? "button" : "submit"; send.disabled = on && !stopOk;
  }
  send.addEventListener("click", (e) => { if (!busy) return; e.preventDefault(); if (stopOk && abort) { stopped = true; abort.abort(); } });

  // One turn, streamed (see the desktop page.js for the event list).
  async function turn(payload) {
    stopped = false; stopOk = !(payload.decisions && Object.values(payload.decisions).some(Boolean)); busyUi(true);
    const wait = add("aistep", "Thinking…");
    let live = null;
    const dropWait = () => { if (wait.isConnected) wait.remove(); };
    const endLive = () => {                              // the text a model call wrote before using a tool becomes a quiet note, in its place
      if (!live) return; const t = live.textContent.trim(), at = live; live = null;
      if (!t) { at.remove(); return; }
      const d = document.createElement("div"); d.className = "aistep"; d.textContent = "· " + t.replace(/\s+/g, " ").slice(0, 200); at.replaceWith(d);
    };
    try {
      while (true) {
        abort = new AbortController();
        const res = await fetch("/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, stream: true }), signal: abort.signal });
        if (res.status === 401) { location.href = "/login"; return; }
        if (!/ndjson/.test(res.headers.get("content-type") || "")) { let j = null; try { j = await res.json(); } catch (e) {} throw new Error((j && j.error) || `The assistant failed (${res.status})`); }
        const reader = res.body.getReader(), dec = new TextDecoder();
        let buf = "", out = null;
        const onEv = (ev) => {
          if (ev.t === "round") endLive();
          else if (ev.t === "delta") { dropWait(); if (!live) { live = document.createElement("div"); live.className = "aimsg bot live"; log.appendChild(live); } live.textContent += ev.text; log.scrollTop = log.scrollHeight; }
          else if (ev.t === "discard") { if (live) { live.remove(); live = null; } }
          else if (ev.t === "step") { dropWait(); endLive(); stepLine(ev.step); }
          else if (ev.t === "applied") { applied(ev.undo, ev.changed); stopOk = true; busyUi(true); }
          else if (ev.t === "error") throw new Error(ev.error || "The assistant failed");
          else if (ev.t === "done") out = ev.out;
        };
        while (true) {
          const { value, done } = await reader.read(); if (done) break;
          buf += dec.decode(value, { stream: true });
          let i; while ((i = buf.indexOf("\n")) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (l.trim()) onEv(JSON.parse(l)); }
        }
        if (buf.trim()) onEv(JSON.parse(buf));
        if (!out) throw new Error("The answer was cut off. Try again.");
        dropWait();
        if (out.ui) {                                    // the server leaves board tools out for the phone; answer any that slip through
          endLive();
          payload = { resume: out.ui.token, uiResults: Object.fromEntries(out.ui.calls.map((c) => [c.id, "Error: that isn't available on the phone."])) };
          continue;
        }
        if (live) { live.remove(); live = null; }
        applied(out.undo, out.changed);
        if (out.pending) { if (out.pending.text) add("aimsg bot", out.pending.text); pendingCard(out.pending); }
        else { hist.push({ role: "assistant", content: out.reply || "", refs: out.refs && out.refs.length ? out.refs : undefined }); add("aimsg bot", out.reply || "(no reply)"); usage(out.usage); }
        break;
      }
    } catch (e) {
      dropWait();
      if (stopped) {
        const t = live ? live.textContent.trim() : "";
        if (live) { live.classList.remove("live"); live.textContent = t + " …"; live = null; }
        hist.push({ role: "assistant", content: (t ? t + " …" : "") + " (stopped)" });
        add("aistep bad", "■ Stopped");
      } else { if (live) live.remove(); add("aimsg err", e.message); }
    }
    abort = null; stopOk = true; busyUi(false);
  }
  form.onsubmit = (e) => {
    e.preventDefault();
    const text = input.value.trim(); if (!text || busy) return;
    input.value = ""; input.style.height = "";
    const h = log.querySelector(".aihint"); if (h) h.remove();
    hist.push({ role: "user", content: text }); add("aimsg user", text);
    turn({ messages: hist.slice(-20), writes: "ask", context: {
      client: "phone", today: key(today()), day: sel, board: summary(), scope: "board", allowDelete: false,
      inbox: inbox ? { id: inbox.id, name: hide(inbox.name) } : null,
      notesNode: typeof notesLoc !== "undefined" && notesLoc ? { id: notesLoc.id, name: hide(notesLoc.name) } : null,
    } });
  };
  input.addEventListener("input", () => { input.style.height = "auto"; input.style.height = Math.min(120, input.scrollHeight) + "px"; });
})();
