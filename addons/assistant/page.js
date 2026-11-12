// Page script of the AI Assistant add-on (beta). Runs after the board's own script and uses its globals.
/* ====================================================================================================
   AI assistant: a side panel that chats with a local (Ollama) or Anthropic model. It reads your outline through the
   server and asks before it changes anything. Only shown when the server has AI_PROVIDER set (local mode).
   ==================================================================================================== */
const aiBtn = document.getElementById("aiBtn"), aiPanel = document.getElementById("aiPanel");
const aiLog = document.getElementById("aiLog"), aiInput = document.getElementById("aiInput"), aiSend = document.getElementById("aiSend");
let aiStatus = null, aiBusy = false;
const aiHist = [];
const aiOn = () => { try { return localStorage.getItem("aiOn") === "1"; } catch (e) { return false; } };
const aiShow = () => { aiBtn.hidden = !(aiStatus && aiStatus.enabled && aiOn()); if (aiBtn.hidden && !aiPanel.hidden) setAiOpen(false); };
const aiModel = () => { try { return localStorage.getItem("aiModel") || ""; } catch (e) { return ""; } };
const aiDelete = () => { try { return localStorage.getItem("aiDelete") === "1"; } catch (e) { return false; } };
const aiWrites = () => { try { return localStorage.getItem("aiWrites") === "read" ? "read" : "ask"; } catch (e) { return "ask"; } };

async function loadAiStatus() {
  try {
    const r = await fetch("/ai/status");
    if (!r.ok) throw new Error();
    aiStatus = await r.json();
  } catch (e) { aiStatus = { enabled: false, reason: "Couldn't reach the board's server." }; }
  aiShow();
  // The Assistant settings only exist when the server was started with AI_PROVIDER.
  document.querySelector('.set-nav button[data-sec="ai"]').hidden = !aiStatus.configured;
  if (!aiStatus.configured && !document.querySelector('.set-pane[data-sec="ai"]').hidden) showSettingsSection("board");
  const t = document.getElementById("aiStatusTxt");
  if (aiStatus.enabled) {
    t.textContent = `On: ${aiStatus.provider === "ollama" ? "Ollama (stays on this computer)" : "Anthropic (chat and the outline text it reads are sent to Anthropic)"}. Default model: ${aiStatus.model}.` + (aiStatus.reachable === false ? " " + aiStatus.reason : "");
  } else t.textContent = "Off. " + (aiStatus.reason || "");
  const dl = document.getElementById("aiModels");
  dl.replaceChildren(...(aiStatus.models || []).map((m) => { const o = document.createElement("option"); o.value = m; return o; }));
  document.getElementById("aiModelLbl").textContent = aiModel() || aiStatus.model || "";
}
function setAiOpen(on) {
  aiPanel.hidden = !on;
  aiBtn.setAttribute("aria-pressed", on ? "true" : "false");
  if (!on) return;
  const top = document.querySelector("header").getBoundingClientRect().bottom, foot = document.getElementById("foot");
  aiPanel.style.top = Math.max(0, top) + "px";
  aiPanel.style.bottom = (foot ? foot.getBoundingClientRect().height : 0) + "px";
  document.getElementById("aiModelLbl").textContent = aiModel() || (aiStatus && aiStatus.model) || "";
  if (!aiLog.children.length) aiIntro();
  aiInput.focus();
}
aiBtn.onclick = () => setAiOpen(aiPanel.hidden);
document.getElementById("aiClose").onclick = () => { setAiOpen(false); aiBtn.focus(); };
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !aiPanel.hidden && !document.querySelector(".modal:not([hidden])") && !movePop && !dayPopKey) { setAiOpen(false); aiBtn.focus(); }
}, true);   // capture phase: look at the modals before the Search window closes itself on the same Esc

function aiIntro() {
  const d = document.createElement("div");
  d.className = "aihint";
  d.textContent = "Ask about your tasks, or have me add, tick off, move or rename them. I ask before changing anything.";
  for (const q of ["What's on my plate today?", "What is overdue this week?", "Find tasks about…"]) {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = q;
    b.onclick = () => { aiInput.value = q.endsWith("…") ? q.slice(0, -1) : q; aiInput.focus(); if (!q.endsWith("…")) aiForm.requestSubmit(); };
    d.appendChild(b);
  }
  aiLog.appendChild(d);
}
// What the log shows is also kept in aiItems so a chat can be saved and shown again (the "Thinking…" line and errors are not kept).
let aiItems = [], aiCurId = null, aiDirty = false;
// Models like to write **bold**; show it as bold rather than as asterisks (built from text nodes, so nothing can inject markup).
function aiFill(el, text) {
  const parts = String(text).split(/\*\*(.+?)\*\*/s);
  el.replaceChildren(...parts.map((p, i) => { if (i % 2) { const b = document.createElement("strong"); b.textContent = p; return b; } return document.createTextNode(p); }));
}
function aiAdd(cls, text, detail) {
  const d = document.createElement("div");
  d.className = cls;
  if (cls === "aimsg bot") aiFill(d, text);
  else if (detail) {   // a step with what the assistant read: click to see it (so you can check its answer against the source)
    const det = document.createElement("details"), sum = document.createElement("summary"), pre = document.createElement("pre");
    sum.textContent = text; pre.textContent = detail;
    det.append(sum, pre); d.appendChild(det);
  } else d.textContent = text;
  aiLog.appendChild(d); aiLog.scrollTop = aiLog.scrollHeight;
  if (/^(aimsg (user|bot)|aistep( done| bad)?)$/.test(cls)) { aiItems.push(detail ? { cls, text, detail } : { cls, text }); aiDirty = true; }
  return d;
}
function aiClear() {
  aiHist.length = 0; aiItems = []; aiCurId = null; aiDirty = false;
  aiLog.replaceChildren(); aiIntro();
}
const aiChats = () => { try { const a = JSON.parse(localStorage.getItem("aiChats") || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
function aiSaveChat() {
  if (!aiHist.length) { showToast("Nothing to save yet", false); return false; }
  const list = aiChats();
  const first = (aiHist.find((m) => m.role === "user") || {}).content || "Chat";
  const rec = { id: aiCurId || String(Date.now()), title: first.replace(/\s+/g, " ").slice(0, 70), at: Date.now(), hist: aiHist.slice(), items: aiItems.slice() };
  const i = list.findIndex((c) => c.id === rec.id);
  if (i >= 0) list.splice(i, 1);
  list.unshift(rec);
  try { localStorage.setItem("aiChats", JSON.stringify(list.slice(0, 30))); }
  catch (e) { showToast("Couldn't save: this browser's storage is full or blocked", false); return false; }
  aiCurId = rec.id; aiDirty = false;
  showToast("Chat saved", false);
  return true;
}
// Runs `next` straight away, or after asking whether to save the chat in progress.
function aiGuard(next) {
  const bar = document.getElementById("aiAsk");
  if (!aiDirty || !aiHist.length) { next(); return; }
  bar.hidden = false;
  bar.onclick = (e) => {
    const a = e.target.dataset && e.target.dataset.a;
    if (!a) return;
    if (a === "save" && !aiSaveChat()) return;
    bar.hidden = true;
    if (a !== "cancel") next();
  };
}
function aiShowLog() { document.getElementById("aiHistory").hidden = true; aiLog.hidden = false; aiForm.hidden = false; }
function aiLoadChat(c) {
  aiClear();
  aiLog.querySelector(".aihint").remove();
  aiHist.push(...c.hist);
  for (const it of c.items) aiAdd(it.cls, it.text, it.detail);
  aiCurId = c.id; aiDirty = false;
  aiShowLog();
}
function aiShowHistory() {
  const box = document.getElementById("aiHistory");
  box.replaceChildren();
  const list = aiChats();
  const head = document.createElement("div");
  head.className = "aihint"; head.style.marginBottom = "8px";
  head.textContent = list.length ? "Saved chats (kept in this browser only)" : "No saved chats yet. Use Save in a conversation.";
  const back = document.createElement("button");
  back.type = "button"; back.textContent = "← Back to chat"; back.onclick = aiShowLog;
  head.prepend(back);
  box.appendChild(head);
  for (const c of list) {
    const row = document.createElement("div"); row.className = "hrow";
    const t = document.createElement("div"); t.className = "ht";
    const st = document.createElement("strong"); st.textContent = c.title;
    const sm = document.createElement("small"); sm.textContent = new Date(c.at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    t.append(st, sm);
    t.onclick = () => aiGuard(() => aiLoadChat(c));
    const del = document.createElement("button");
    del.type = "button"; del.textContent = "✕"; del.title = "Delete this saved chat";
    del.onclick = () => {
      try { localStorage.setItem("aiChats", JSON.stringify(aiChats().filter((x) => x.id !== c.id))); } catch (e) {}
      if (aiCurId === c.id) aiCurId = null;
      aiShowHistory();
    };
    row.append(t, del); box.appendChild(row);
  }
  aiLog.hidden = true; aiForm.hidden = true; box.hidden = false;
}
document.getElementById("aiSave").onclick = () => { if (!aiBusy) aiSaveChat(); };
document.getElementById("aiHistBtn").onclick = () => aiShowHistory();
document.getElementById("aiClear").onclick = () => { if (!aiBusy) aiGuard(() => { aiClear(); aiShowLog(); }); };

// Encrypted text is never sent to the model: it sees ‹secret› instead (the server does the same for everything it reads).
const aiHide = (s) => String(s == null ? "" : s).replace(/wbenc1\.[A-Za-z0-9_-]*/g, "‹secret›");
const aiName = (raw) => aiHide(plain(raw));
// A compact list of the open tasks on the days shown, with ids, so the assistant can act without searching first.
const aiScope = () => { try { const v = localStorage.getItem("aiScope"); return v === "plus" || v === "all" ? v : "board"; } catch (e) { return "board"; } };
const aiNotes = () => { try { return (localStorage.getItem("aiNotes") || "").slice(0, 1000); } catch (e) { return ""; } };
function aiBoardSummary() {
  const dn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const lines = [];
  const dayLines = (k, label, skipEmpty) => {
    const es = entries(k, true);
    if (!es.length && skipEmpty) return;
    lines.push(`${k}${label ? " (" + label + ")" : ""}:`);
    if (!es.length) { lines.push("  (no open tasks)"); return; }
    for (const e of es) {
      // Group heading is shown even when Nested is off elsewhere: entries() only yields groups when Nested is Group.
      if (e.kind === "group") {
        lines.push(`  [group] ${aiName(e.b.name)} (id ${e.b.id})`);
        for (const t of e.todos) if (!t.completedAt) lines.push(`    - ${aiName(t.name)} (id ${t.id})`);
      } else lines.push(`  - ${aiName(e.n.name)} (id ${e.n.id})`);
    }
  };
  lines.push("DAYS SHOWN ON THE BOARD");
  for (const d of weekDays()) dayLines(key(d), dn[d.getDay()], false);
  const scope = aiScope();
  if (scope !== "board") {
    const { late, soon } = extraKeys(true);
    lines.push("", "PAST DUE (open tasks on days before the board)");
    const before = lines.length;
    for (const k of late) dayLines(k, "", true);
    if (lines.length === before) lines.push("(none)");
    lines.push("", "UPCOMING (open tasks in the 14 days after the board)");
    const b2 = lines.length;
    for (const k of soon) dayLines(k, "", true);
    if (lines.length === b2) lines.push("(none)");
  }
  if (scope === "all" && planSources.length) {
    lines.push("", "PLAN DAY SOURCES (open tasks directly under each)");
    for (const src of planSources) {
      const st = srcState[src.id];
      if (!st || !st.loaded) { lines.push(`${src.name} (id ${src.id}): not loaded yet, use list_source`); continue; }
      const open = (st.todos || []).filter((n) => !n.completedAt);
      lines.push(`${aiHide(src.name)} (id ${src.id}): ${open.length ? "" : "no open tasks"}`);
      for (const n of open) lines.push(`  - ${aiName(n.name)} (id ${n.id})`);
    }
  }
  return lines.join("\n").slice(0, 9000);
}

async function aiPost(payload) {
  const res = await fetch("/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (res.status === 401) { location.href = "/login"; throw new Error("Signed out."); }
  let j = null;
  try { j = await res.json(); } catch (e) {}
  if (!res.ok) throw new Error((j && j.error) || `The assistant failed (${res.status})`);
  return j;
}

// Board tools: the assistant asks, this page does exactly what the matching button would. Nothing here touches WorkFlowy data.
function aiWhen(w) {
  w = String(w || "").trim().toLowerCase();
  if (w === "today") return todayDate();
  if (ISO_DAY.test(w)) { const d = keyToDate(w); if (!isNaN(d) && key(d) === w) return d; }
  return null;
}
function aiToggle(id, on) { const el = document.getElementById(id); if (!!el.checked !== on) el.click(); }
const AI_UI = {
  show_week(a) {
    const w = String(a.when || "").trim().toLowerCase();
    if (planMode) setPlanMode(false);
    if (w === "next") weekStart.setDate(weekStart.getDate() + step());
    else if (w === "previous" || w === "last") weekStart.setDate(weekStart.getDate() - step());
    else {
      const d = aiWhen(w);
      if (!d) throw new Error("when must be today, next, previous or YYYY-MM-DD");
      weekStart = span === 3 ? d : startOfWeek(d);
    }
    goToWeek();
    const days = weekDays();
    return `The board now shows ${key(days[0])} to ${key(days[days.length - 1])}.`;
  },
  set_days_shown(a) {
    const n = Number(a.days);
    if (![3, 5, 7].includes(n)) throw new Error("days must be 3, 5 or 7");
    document.querySelector(`#seg button[data-span="${n}"]`).click();
    return `The board now shows ${n} days.`;
  },
  open_daily_page(a) {
    const w = String(a.when || "").trim().toLowerCase();
    let off;
    if (w === "next") off = pageOffset + 1;
    else if (w === "previous" || w === "last") off = pageOffset - 1;
    else { const d = aiWhen(w); if (!d) throw new Error("when must be today, next, previous or YYYY-MM-DD"); off = Math.round((d - todayDate()) / 864e5); }
    if (document.body.classList.contains("nosidebar")) setSidebarHidden(false, true);
    goPage(off);
    return `The Daily page now shows ${pageKey()}.`;
  },
  set_board_option(a) {
    const on = a.on === true || a.on === "true";
    const o = String(a.option || "");
    if (o === "sidebar") { setSidebarHidden(!on, true); return `The sidebar is now ${on ? "shown" : "hidden"}.`; }
    const id = { hide_completed: "optHide", past_due: "optLate", upcoming: "optSoon", sub_items: "optSubs" }[o];
    if (!id) throw new Error("option must be hide_completed, past_due, upcoming, sub_items or sidebar");
    aiToggle(id, on);
    return `${o} is now ${on ? "on" : "off"}.`;
  },
  set_nested_mode(a) {
    const m = String(a.mode || "");
    if (!["off", "group", "flatten"].includes(m)) throw new Error("mode must be off, group or flatten");
    nestedSel.value = m; nestedSel.dispatchEvent(new Event("change"));
    return `Nested is now ${m}.`;
  },
  async open_item(a) {
    const id = String(a.id || "").trim();
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new Error("that isn't an item id");
    searchModal.hidden = false;                // the item editor lives inside the Search window
    await openItem(id);
    if (viewItem !== id) {                     // maybe the outline copy is out of date: download it again once and retry
      try { await api("/item?id=" + encodeURIComponent(id) + "&refresh=1"); } catch (e) {}
      showError("");
      await openItem(id);
    }
    if (viewItem !== id) { searchModal.hidden = true; showError(""); throw new Error("couldn't open that item. Check the id: ids must be copied exactly from a tool result, or search for the item by its text and use that id."); }
    return `Opened “${aiName((itemNodes[0] && itemNodes[0].name) || "").slice(0, 80) || "(untitled)"}” in the item editor.`;
  },
  plan_day(a) {
    const act = String(a.action || "");
    if (act === "close") { if (planMode) setPlanMode(false); return "Plan day is closed."; }
    if (act !== "open") throw new Error("action must be open or close");
    let day = null;
    if (a.date) { const d = aiWhen(a.date); if (!d) throw new Error("date must be YYYY-MM-DD"); day = key(d); }
    if (planMode) { goPlanDay(day || key(todayDate())); } else setPlanMode(true, day);
    return `Plan day is open for ${planDay}.`;
  },
};
async function aiRunUi(ui, onlyResults) {
  const results = {};
  for (const c of ui.calls) {
    const fn = Object.prototype.hasOwnProperty.call(AI_UI, c.name) ? AI_UI[c.name] : null;
    try {
      if (!fn) throw new Error("unknown board tool");
      results[c.id] = await fn(c.args || {});
      aiAdd("aistep done", "✓ " + results[c.id]);
    } catch (e) { results[c.id] = "Error: " + e.message; aiAdd("aistep bad", "⚠ " + e.message); }
  }
  await new Promise((r) => setTimeout(r, 150));
  if (onlyResults) return results;
  await aiHandle(await aiPost({ resume: ui.token, uiResults: results }));
}

const aiStepLine = (s) => aiAdd("aistep" + (s.done ? " done" : s.error || s.denied ? " bad" : ""), (s.done ? "✓ " : s.denied ? "✕ Declined: " : s.error ? "⚠ " : "· ") + s.summary + (s.error ? " (" + s.error + ")" : ""), s.detail);
function aiApplied(undo, changed) {                        // approved changes: Undo in the board's toast, and the board re-read
  if (undo && undo.length) {
    const label = "AI: " + [...new Set(undo.map((u) => u.label))].join("; ").slice(0, 80);
    const ops = undo.slice();
    pushUndo(label, async () => { for (const op of ops.reverse()) { if (op.restore) await restoreTree(op.restore.parent, op.restore.snap); else await call(op.method, op.path, op.body); } });
  }
  if (changed) { for (const id in kids) delete kids[id]; for (const id in nest) delete nest[id]; loadWeek(true); loadPage(); }
}
// How much the answer used: model calls, input tokens (and how many came from the cache), output tokens.
function aiUsageLine(u) {
  if (!u || !u.calls) return;
  const f = (n) => (n >= 10000 ? (n / 1000).toFixed(0) + "k" : n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n));
  const inTot = (u.input || 0) + (u.cacheRead || 0) + (u.cacheWrite || 0);
  const d = aiAdd("aistep usage", `${u.calls} model call${u.calls === 1 ? "" : "s"} · ${f(inTot)} tokens in${u.cacheRead ? ` (${f(u.cacheRead)} from cache)` : ""} · ${f(u.output || 0)} out`);
  d.title = u.provider === "anthropic" ? "Cached input is billed at a tenth of the normal price. Writing to the cache costs a little more than normal input, once." : "Token counts reported by Ollama.";
}
async function aiHandle(out) {
  for (const s of out.steps || []) aiStepLine(s);
  aiApplied(out.undo, out.changed);
  if (out.ui) { await aiRunUi(out.ui); return; }
  if (out.pending) {
    if (out.pending.text) aiAdd("aimsg bot", out.pending.text);
    aiPendingCard(out.pending);
    return;
  }
  aiHist.push({ role: "assistant", content: out.reply || "", refs: out.refs && out.refs.length ? out.refs : undefined });
  aiAdd("aimsg bot", out.reply || "(no reply)");
  aiUsageLine(out.usage);
}

function aiPendingCard(p) {
  const box = document.createElement("div");
  box.className = "aipend";
  const t = document.createElement("div"); t.className = "t"; t.textContent = p.actions.length === 1 ? "Approve this change?" : "Approve these changes?";
  box.appendChild(t);
  const checks = [];
  for (const a of p.actions) {
    const l = document.createElement("label"), c = document.createElement("input");
    c.type = "checkbox"; c.checked = true; c.dataset.id = a.id; checks.push(c);
    const s = document.createElement("span"); s.textContent = a.summary;
    l.append(c, s); box.appendChild(l);
  }
  const btns = document.createElement("div"); btns.className = "btns";
  const ok = document.createElement("button"), no = document.createElement("button");
  ok.type = no.type = "button"; ok.className = "primary"; ok.textContent = "Apply"; no.textContent = "Deny all";
  const decide = async (all) => {
    if (aiBusy) return;
    box.classList.add("used");
    const decisions = {};
    for (const c of checks) { decisions[c.dataset.id] = all && c.checked; c.disabled = true; }
    await aiRunTurn({ resume: p.token, decisions });
  };
  ok.onclick = () => decide(true); no.onclick = () => decide(false);
  btns.append(ok, no); box.appendChild(btns);
  aiLog.appendChild(box); aiLog.scrollTop = aiLog.scrollHeight;
}

/* A turn is streamed: the reply appears as it is written, steps as they happen, and Send becomes Stop.
   Stop cancels the answer (the server stops asking the model). It is held back only while approved changes are being
   applied, so their Undo can't be lost; it comes back as soon as they're done. */
let aiAbort = null, aiStopOk = true, aiStopped = false;
function aiBusyUi(on) {
  aiBusy = on;
  aiSend.textContent = on ? "Stop" : "Send";
  aiSend.classList.toggle("stop", on);
  aiSend.type = on ? "button" : "submit";
  aiSend.disabled = on && !aiStopOk;
  aiSend.title = on ? (aiStopOk ? "Stop this answer" : "Applying your approved changes…") : "";
}
aiSend.addEventListener("click", (e) => { if (!aiBusy) return; e.preventDefault(); if (aiStopOk && aiAbort) { aiStopped = true; aiAbort.abort(); } });
async function aiStreamTurn(payload, wait) {
  let live = null;                                     // the reply being written
  const dropWait = () => { if (wait && wait.isConnected) wait.remove(); };
  const liveText = () => (live ? live.textContent : "");
  const endLive = (asStep) => {                        // a model call that went on to use tools: its text becomes a quiet note
    if (!live) return;
    const t = live.textContent.trim(), at = live; live = null;
    if (!asStep || !t) { at.remove(); return; }
    const d = aiAdd("aistep", "· " + t.replace(/\s+/g, " ").slice(0, 200)); at.replaceWith(d);      // in its place, before the steps it led to
  };
  try {
    while (true) {
      aiAbort = new AbortController();
      const res = await fetch("/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, stream: true }), signal: aiAbort.signal });
      if (res.status === 401) { location.href = "/login"; throw new Error("Signed out."); }
      if (!/ndjson/.test(res.headers.get("content-type") || "")) {           // an error, or a server without streaming: the old JSON answer
        let j = null; try { j = await res.json(); } catch (e) {}
        if (!res.ok) throw new Error((j && j.error) || `The assistant failed (${res.status})`);
        dropWait(); await aiHandle(j); return;
      }
      const reader = res.body.getReader(), dec = new TextDecoder();
      let buf = "", out = null;
      const onEvent = (ev) => {
        if (ev.t === "round") endLive(true);
        else if (ev.t === "delta") {
          dropWait();
          if (!live) { live = document.createElement("div"); live.className = "aimsg bot live"; aiLog.appendChild(live); }
          live.textContent += ev.text; aiLog.scrollTop = aiLog.scrollHeight;
        } else if (ev.t === "discard") { if (live) { live.remove(); live = null; } }
        else if (ev.t === "step") { dropWait(); endLive(true); aiStepLine(ev.step); }
        else if (ev.t === "applied") { aiApplied(ev.undo, ev.changed); aiStopOk = true; aiBusyUi(true); }
        else if (ev.t === "error") throw new Error(ev.error || "The assistant failed");
        else if (ev.t === "done") out = ev.out;
      };
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i; while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); if (line.trim()) onEvent(JSON.parse(line)); }
      }
      if (buf.trim()) onEvent(JSON.parse(buf));
      if (!out) throw new Error("The answer was cut off. Try again.");
      dropWait();
      if (out.ui) {                                        // board tools run here, then the same answer carries on
        endLive(true);
        const results = await aiRunUi(out.ui, true);
        payload = { resume: out.ui.token, uiResults: results };
        continue;
      }
      if (live) { live.remove(); live = null; }          // the final text is shown again, formatted, below
      await aiHandle(out);
      return;
    }
  } catch (e) {
    dropWait();
    if (aiStopped) {
      const t = liveText().trim();
      if (live) { live.classList.remove("live"); aiFill(live, t + " …"); live = null; aiItems.push({ cls: "aimsg bot", text: t + " …" }); }
      aiHist.push({ role: "assistant", content: (t ? t + " …" : "") + " (stopped)" });
      aiAdd("aistep bad", "■ Stopped");
      return;
    }
    if (live) { live.remove(); live = null; }
    throw e;
  }
}
async function aiRunTurn(payload) {
  aiStopped = false;
  aiStopOk = !(payload.decisions && Object.values(payload.decisions).some(Boolean));   // approved changes: no Stop until they're applied
  aiBusyUi(true);
  const wait = aiAdd("aistep aidots", "Thinking");
  try { await aiStreamTurn(payload, wait); }
  catch (e) { aiAdd("aimsg err", e.message); }
  if (wait.isConnected) wait.remove();
  aiAbort = null; aiStopOk = true;
  aiBusyUi(false);
  aiLog.scrollTop = aiLog.scrollHeight;
  if (!aiPanel.hidden) aiInput.focus();
}

const aiForm = document.getElementById("aiForm");
aiForm.onsubmit = async (e) => {
  e.preventDefault();
  const text = aiInput.value.trim();
  if (!text || aiBusy) return;
  aiInput.value = ""; aiInput.style.height = "";
  const hint = aiLog.querySelector(".aihint"); if (hint) hint.remove();
  aiHist.push({ role: "user", content: text });
  aiAdd("aimsg user", text);
  const t = todayDate();
  await aiRunTurn({ messages: aiHist.slice(-20), model: aiModel(), writes: aiWrites(), context: { notesName, allowDelete: aiDelete(), today: key(t), day: pageKey(), board: aiBoardSummary(), scope: aiScope(), prefs: aiNotes(), sources: planSources.slice(0, 6).map((x) => ({ name: aiHide(x.name), id: x.id })),
    inbox: typeof inboxNode !== "undefined" && inboxNode ? { id: inboxNode.id, name: aiHide(inboxNode.name) } : null,                         // the board's Inbox, so 'inbox' goes there
    notesNode: typeof notesWhere === "function" && notesWhere() ? { id: notesWhere().id, name: aiHide(notesWhere().name) } : null,     // the notes tools work there, and it's protected from deleting
    planHours: typeof planHours !== "undefined" ? planHours : 0, weekStart: typeof weekStartDay !== "undefined" && weekStartDay === "sun" ? "sun" : "mon", client: "desktop" } });
};
aiInput.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); aiForm.requestSubmit(); } });
aiInput.addEventListener("input", () => { aiInput.style.height = "auto"; aiInput.style.height = Math.min(120, aiInput.scrollHeight) + "px"; });

const optAi = document.getElementById("optAi");
optAi.checked = aiOn();
optAi.onchange = () => { try { localStorage.setItem("aiOn", optAi.checked ? "1" : "0"); } catch (e) {} aiShow(); };
const optAiScope = document.getElementById("optAiScope"), optAiNotes = document.getElementById("optAiNotes");
optAiScope.value = aiScope(); optAiNotes.value = aiNotes();
optAiScope.onchange = () => { try { localStorage.setItem("aiScope", optAiScope.value); } catch (e) {} };
optAiNotes.onchange = () => { try { localStorage.setItem("aiNotes", optAiNotes.value.trim()); } catch (e) {} };
const optAiModel = document.getElementById("optAiModel"), optAiWrites = document.getElementById("optAiWrites");
optAiModel.value = aiModel(); optAiWrites.value = aiWrites();
optAiModel.onchange = () => { const v = optAiModel.value.trim(); try { v ? localStorage.setItem("aiModel", v) : localStorage.removeItem("aiModel"); } catch (e) {} document.getElementById("aiModelLbl").textContent = v || (aiStatus && aiStatus.model) || ""; };
{ const d = document.getElementById("optAiDelete"); d.checked = aiDelete(); d.onchange = () => { try { localStorage.setItem("aiDelete", d.checked ? "1" : "0"); } catch (e) {} }; }
optAiWrites.onchange = () => { try { localStorage.setItem("aiWrites", optAiWrites.value); } catch (e) {} };
loadAiStatus();
