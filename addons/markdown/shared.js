/* Markdown add-on: the code both the desktop board and the phone page run (the server puts a copy in each page).
   It holds the settings, the small Markdown renderer, the snippet cleaner and the format bar. desktop.js and mobile.js are thin
   glue that call wbMd.attach(...) with the page's note editor.

   Safety rules for the renderer:
     - The note's text is never put into the page as HTML. Everything is built with createElement / textContent.
     - Links are only made for http:, https: and mailto: addresses; they open in a new tab with rel="noopener noreferrer".
     - Images are not rendered (the ![alt](url) text just shows as text), so a note can't load anything from anywhere.
     - Text between ⟦ ⟧ (Encrypt add-on: words that are readable now and sealed when the note saves) is kept whole: it is shown as
       it is, highlighted, and never parsed as Markdown, so formatting can't cut through it. */
(function () {
  "use strict";
  if (window.wbMd) return;

  const OPEN = "⟦", CLOSE = "⟧";
  const PH_OPEN = "", PH_CLOSE = "";           // stand-ins for ⟦…⟧ regions while parsing
  const PH_RE = /(\d+)/g;
  const MAX_CHARS = 300000, MAX_INLINE = 10000, MAX_DEPTH = 6;

  /* ---------- Settings (kept on the server; first paint assumes "off" until they arrive) ---------- */
  const settings = { enabled: false, defaultMode: "edit", showToolbar: true, stripSnippets: true, shortcuts: true };
  const listeners = [];
  let loadedOnce = false, loading = null;
  function apply(j) {
    if (!j || typeof j !== "object") return;
    for (const k of ["enabled", "showToolbar", "stripSnippets", "shortcuts"]) if (typeof j[k] === "boolean") settings[k] = j[k];
    if (j.defaultMode === "edit" || j.defaultMode === "preview") settings.defaultMode = j.defaultMode;
    for (const fn of listeners) { try { fn(settings); } catch (e) { console.error("Markdown add-on:", e); } }
  }
  function load() {                                         // a failed fetch (offline) keeps what was last known; a 404 (not installed) stays off
    if (loading) return loading;
    loading = fetch("/markdown/settings", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { loadedOnce = true; apply(j); })
      .catch(() => {})
      .then(() => { loading = null; });
    return loading;
  }
  async function save(change) {
    const r = await fetch("/markdown/settings", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(change) });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error((j && j.error) || "Couldn't save the Markdown settings");
    apply(j);
    return j;
  }

  /* ---------- Encrypted regions ---------- */
  function protect(text) {
    const regions = [];
    text = String(text).split(PH_OPEN).join("").split(PH_CLOSE).join("");        // nothing in a note can pose as a stand-in
    const out = text.replace(/⟦([\s\S]*?)⟧/g, (m, inner) => { regions.push(inner); return PH_OPEN + (regions.length - 1) + PH_CLOSE; });
    return { text: out, regions };
  }
  function addText(parent, s, regions) {                    // plain text, with each region shown as a highlighted span
    let last = 0, m;
    PH_RE.lastIndex = 0;
    while ((m = PH_RE.exec(s)) !== null) {
      if (m.index > last) parent.appendChild(document.createTextNode(s.slice(last, m.index)));
      const sp = document.createElement("span"); sp.className = "wbmd-enc"; sp.textContent = regions[Number(m[1])] || ""; parent.appendChild(sp);
      last = m.index + m[0].length;
    }
    if (last < s.length) parent.appendChild(document.createTextNode(s.slice(last)));
  }

  /* ---------- Inline ---------- */
  const SAFE_URL = /^(https?:\/\/|mailto:)[^\s\u0000-\u001f]{1,2000}$/i;
  function makeLink(url, regions) {
    url = String(url).trim();
    if (!SAFE_URL.test(url)) return null;
    const a = document.createElement("a");
    a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
    return a;
  }
  function isAlnum(c) { return !!c && /[A-Za-z0-9À-￿]/.test(c); }
  function skipCode(s, j) {                                  // at a backtick run: the index just after its closing run, or -1
    let n = 0; while (s[j + n] === "`") n++;
    const close = new RegExp("(^|[^`])(`{" + n + "})(?!`)", "g"); close.lastIndex = 0;
    const rest = s.slice(j + n), m = close.exec(rest);
    return m ? j + n + m.index + m[1].length + n : -1;
  }
  function findClose(s, from, d) {                           // the closing delimiter d for an opener whose content starts at `from`
    const single = d.length === 1, ch = d[0];
    for (let j = from; j < s.length; j++) {
      const c = s[j];
      if (c === "\\") { j++; continue; }
      if (c === "`") { const e = skipCode(s, j); if (e > 0) { j = e - 1; continue; } let n = 0; while (s[j + n] === "`") n++; j += n - 1; continue; }
      if (c !== ch) continue;
      let n = 0; while (s[j + n] === ch) n++;
      if (n >= d.length && (single ? n === 1 : true) && j > from && !/\s/.test(s[j - 1])) {
        if (ch === "_" && isAlnum(s[j + d.length])) { j += n - 1; continue; }
        return j;                                           // the delimiter starts here
      }
      j += n - 1;
    }
    return -1;
  }
  function inline(parent, s, regions, depth, noLink) {
    if (depth > MAX_DEPTH || s.length > MAX_INLINE) { addLines(parent, s, regions); return; }
    let i = 0, buf = "";
    const flush = () => { if (buf) { addLines(parent, buf, regions); buf = ""; } };
    while (i < s.length) {
      const c = s[i];
      if (c === "\\" && i + 1 < s.length && /[\\`*_{}\[\]()#+\-.!~>|<]/.test(s[i + 1])) { buf += s[i + 1]; i += 2; continue; }
      if (c === "`") {
        const e = skipCode(s, i);
        let n = 0; while (s[i + n] === "`") n++;
        if (e > 0) {
          flush();
          const code = document.createElement("code");
          let inner = s.slice(i + n, e - n); if (/^ .*[^ ].* $/.test(inner)) inner = inner.slice(1, -1);
          addText(code, inner.replace(/\n/g, " "), regions); parent.appendChild(code);
          i = e; continue;
        }
        buf += s.slice(i, i + n); i += n; continue;
      }
      if (c === "!" && s[i + 1] === "[") {                     // images aren't shown: the ![alt](url) text stays text
        const m = /^!\[[^\]\n]*\]\([^)\n]*\)/.exec(s.slice(i, i + 2100));
        if (m) { buf += m[0]; i += m[0].length; continue; }
      }
      if (c === "[" && !noLink) {
        let d = 0, j = i;
        for (; j < s.length; j++) { if (s[j] === "\\") { j++; continue; } if (s[j] === "[") d++; else if (s[j] === "]") { d--; if (d === 0) break; } }
        if (d === 0 && j < s.length && s[j + 1] === "(") {
          let k = j + 2, pd = 1;
          for (; k < s.length; k++) { if (s[k] === "\\") { k++; continue; } if (s[k] === "(") pd++; else if (s[k] === ")") { pd--; if (pd === 0) break; } if (s[k] === "\n") { pd = -1; break; } }
          if (pd === 0) {
            let dest = s.slice(j + 2, k).trim(); const t = dest.match(/^(<[^>]*>|\S+)(\s+(".*"|'.*'))?$/);
            if (t) {
              dest = t[1].replace(/^<|>$/g, "");
              const a = makeLink(dest, regions), label = s.slice(i + 1, j);
              flush();
              if (a) { inline(a, label, regions, depth + 1, true); if (!a.firstChild) a.textContent = dest; parent.appendChild(a); }
              else inline(parent, label, regions, depth + 1, true);          // an address that isn't allowed: just the words
              i = k + 1; continue;
            }
          }
        }
        buf += c; i++; continue;
      }
      if (c === "<" && !noLink) {
        const m = /^<((?:https?:\/\/|mailto:)[^\s<>]+)>/i.exec(s.slice(i, i + 2100));
        if (m) { const a = makeLink(m[1], regions); if (a) { flush(); a.textContent = m[1]; parent.appendChild(a); i += m[0].length; continue; } }
      }
      if ((c === "h" || c === "H") && !noLink && !isAlnum(s[i - 1])) {
        const m = /^https?:\/\/[^\s<>]+/i.exec(s.slice(i, i + 2100));
        if (m) {
          let url = m[0]; while (/[.,;:!?'")\]]$/.test(url) && !(url.endsWith(")") && url.includes("("))) url = url.slice(0, -1);
          const a = makeLink(url, regions);
          if (a) { flush(); a.textContent = url; parent.appendChild(a); i += url.length; continue; }
        }
      }
      if (c === "*" || c === "_") {
        let n = 0; while (s[i + n] === c) n++;
        const before = s[i - 1], after = s[i + n];
        const canOpen = after !== undefined && !/\s/.test(after) && (c === "*" || !isAlnum(before));
        if (canOpen && n <= 3) {
          const tries = n === 3 ? [3, 2, 1] : n === 2 ? [2, 1] : [1];
          let done = false;
          for (const use of tries) {
            const d = c.repeat(use), start = i + n;           // the extra delimiters (n - use) stay as text in front
            const e = findClose(s, start, d);
            if (e > 0) {
              flush();
              if (n > use) buf += c.repeat(n - use), flush();
              let node = parent;
              const wrap = (tag, host) => { const el = document.createElement(tag); host.appendChild(el); return el; };
              if (use === 3) node = wrap("em", wrap("strong", parent)); else node = wrap(use === 2 ? "strong" : "em", parent);
              inline(node, s.slice(start, e), regions, depth + 1, noLink);
              i = e + use; done = true; break;
            }
          }
          if (done) continue;
        }
        buf += c.repeat(n); i += n; continue;
      }
      buf += c; i++;
    }
    flush();
  }
  function addLines(parent, s, regions) {                    // a soft line break in a note is a line break
    const parts = s.split("\n");
    parts.forEach((p, k) => { if (k) parent.appendChild(document.createElement("br")); if (p) addText(parent, p, regions); });
  }

  /* ---------- Blocks ---------- */
  const RE = {
    fence: /^ {0,3}(`{3,}|~{3,})\s*([\w+#.-]*)\s*$/,
    heading: /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/,
    rule: /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/,
    quote: /^ {0,3}>[ ]?(.*)$/,
    item: /^([ \t]*)([-*+]|\d{1,9}[.)])[ \t]+(.*)$/,
    task: /^\[([ xX])\][ \t]+(.*)$/,
  };
  const indentOf = (s) => s.replace(/\t/g, "    ").match(/^ */)[0].length;
  function startsBlock(line) { return RE.fence.test(line) || RE.heading.test(line) || RE.rule.test(line) || RE.quote.test(line) || RE.item.test(line); }

  function blocks(parent, lines, regions, depth) {
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }
      let m;
      if ((m = RE.fence.exec(line))) {
        const mark = m[1], body = []; i++;
        while (i < lines.length) { const t = lines[i].trim(); if (t[0] === mark[0] && t.length >= mark.length && /^(`+|~+)$/.test(t)) break; body.push(lines[i]); i++; }
        i++;                                                 // past the closing fence (or the end)
        const pre = document.createElement("pre"), code = document.createElement("code");
        addText(code, body.join("\n"), regions); pre.appendChild(code); parent.appendChild(pre);
        continue;
      }
      if ((m = RE.heading.exec(line))) {
        const h = document.createElement("h" + m[1].length); inline(h, m[2], regions, 0, false); parent.appendChild(h); i++; continue;
      }
      if (RE.rule.test(line)) { parent.appendChild(document.createElement("hr")); i++; continue; }
      if (RE.quote.test(line)) {
        const inner = [];
        while (i < lines.length && RE.quote.test(lines[i])) { inner.push(RE.quote.exec(lines[i])[1]); i++; }
        const bq = document.createElement("blockquote");
        if (depth < MAX_DEPTH) blocks(bq, inner, regions, depth + 1); else addLines(bq, inner.join("\n"), regions);
        parent.appendChild(bq); continue;
      }
      if (RE.item.test(line)) { i = list(parent, lines, i, regions, depth); continue; }
      const para = [];                                       // a paragraph runs until a blank line or the start of another block
      while (i < lines.length && lines[i].trim() && (para.length === 0 || !startsBlock(lines[i]))) { para.push(lines[i]); i++; }
      const p = document.createElement("p"); inline(p, para.join("\n"), regions, 0, false); parent.appendChild(p);
    }
  }
  function list(parent, lines, i, regions, depth) {          // a (possibly nested) list starting at lines[i]; returns the next index
    const root = [];                                         // stack of { indent, ol, li }
    let blankRun = 0;
    const open = (indent, ordered, host) => {
      const el = document.createElement(ordered ? "ol" : "ul"); host.appendChild(el); return { indent, ol: el, li: null };
    };
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { blankRun++; if (blankRun > 1) break; i++; continue; }
      const m = RE.item.exec(line);
      if (!m) {
        if (blankRun === 0 && root.length && indentOf(line) > root[root.length - 1].indent && !startsBlock(line)) {   // a wrapped line of the last item
          const top = root[root.length - 1];
          if (top.li) { top.li.appendChild(document.createElement("br")); inline(top.li, line.trim(), regions, 0, false); i++; continue; }
        }
        break;
      }
      if (blankRun && !root.length) break;
      blankRun = 0;
      const indent = indentOf(m[1]), ordered = /\d/.test(m[2][0]);
      if (!root.length) root.push(open(indent, ordered, parent));
      let top = root[root.length - 1];
      if (indent > top.indent && top.li && root.length < MAX_DEPTH) root.push(top = open(indent, ordered, top.li));
      else {
        while (root.length > 1 && indent < top.indent) { root.pop(); top = root[root.length - 1]; }
        if (indent === top.indent && ordered !== (top.ol.tagName === "OL")) {      // a bullet list followed by a numbered one (or the reverse) is a new list
          if (root.length === 1) break;
          root.pop(); const host = root[root.length - 1].li; root.push(top = open(indent, ordered, host));
        }
      }
      const li = document.createElement("li"); top.ol.appendChild(li); top.li = li;
      let body = m[3];
      const t = RE.task.exec(body);
      if (t) {
        const box = document.createElement("input"); box.type = "checkbox"; box.disabled = true; box.checked = t[1] !== " "; box.className = "wbmd-task";
        box.setAttribute("aria-label", box.checked ? "Done" : "Not done");
        li.className = "wbmd-taskitem"; li.appendChild(box); body = t[2];
      }
      inline(li, body, regions, 0, false);
      i++;
    }
    return i;
  }

  function render(text, host) {
    host.textContent = "";
    let src = String(text == null ? "" : text), cut = false;
    if (src.length > MAX_CHARS) { src = src.slice(0, MAX_CHARS); cut = true; }
    const p = protect(src.replace(/\r\n?/g, "\n"));
    blocks(host, p.text.split("\n"), p.regions, 0);
    if (cut) { const n = document.createElement("p"); n.className = "wbmd-cut"; n.textContent = "(The preview stops here; the note is longer.)"; host.appendChild(n); }
    if (!host.firstChild) { const n = document.createElement("p"); n.className = "wbmd-empty"; n.textContent = "Nothing to preview yet."; host.appendChild(n); }
  }

  /* ---------- Snippets: the one-line preview of a note in the list, without the Markdown marks ---------- */
  function strip(text) {
    let fence = null;
    const out = String(text || "").replace(/\r\n?/g, "\n").split("\n").map((line) => {
      const f = RE.fence.exec(line);
      if (f) { if (!fence) fence = f[1][0]; else if (f[1][0] === fence && !f[2]) fence = null; return ""; }
      if (fence) return line;                                // code is shown as it is
      if (RE.rule.test(line)) return "";
      line = line.replace(/^ {0,3}#{1,6}[ \t]+/, "").replace(/[ \t]+#+[ \t]*$/, "");
      line = line.replace(/^ {0,3}(?:>[ ]?)+/, "");
      line = line.replace(/^([ \t]*)(?:[-*+]|\d{1,9}[.)])[ \t]+(?:\[[ xX]\][ \t]+)?/, "$1");
      line = line.replace(/!?\[([^\]]*)\]\(\s*<?[^)\s]*>?(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g, "$1");
      line = line.replace(/`+([^`]+)`+/g, "$1");
      line = line.replace(/(\*\*\*|\*\*|__)(?=\S)([^\n]*?\S)\1/g, "$2");
      line = line.replace(/(^|[^*\w])\*(?=\S)([^*\n]*?\S)\*(?!\*)/g, "$1$2");
      line = line.replace(/(^|[^\w])_(?=\S)([^_\n]*?\S)_(?![\w])/g, "$1$2");
      return line.replace(/\\([\\`*_{}\[\]()#+\-.!~>|<])/g, "$1");
    });
    return out.join("\n");
  }

  /* ---------- Editing helpers (the format bar) ---------- */
  function regionSpans(text) { const out = [], re = /⟦[\s\S]*?⟧/g; let m; while ((m = re.exec(text)) !== null) out.push([m.index, m.index + m[0].length]); return out; }
  const insideRegion = (spans, pos) => spans.find((r) => pos > r[0] && pos < r[1]) || null;
  function replaceRange(ta, from, to, str, selA, selB) {     // goes through the browser's own typing so Undo still works; the page then autosaves
    ta.focus(); ta.setSelectionRange(from, to);
    let ok = false;
    try { ok = document.execCommand("insertText", false, str); } catch (e) { ok = false; }
    if (!ok || ta.value.slice(from, from + str.length) !== str) {
      ta.setRangeText(str, from, to, "end");
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    }
    ta.setSelectionRange(selA, selB === undefined ? selA : selB);
  }
  const runBefore = (t, i, ch) => { let n = 0; while (i - 1 - n >= 0 && t[i - 1 - n] === ch) n++; return n; };
  const runAfter = (t, i, ch) => { let n = 0; while (t[i + n] === ch) n++; return n; };

  // Bold, italic and code: wrap the selection (or the word's place) in marks, or take them off when they are already there.
  function toggleInline(ta, mark, notify) {
    const t = ta.value, spans = regionSpans(t);
    let a = ta.selectionStart, b = ta.selectionEnd;
    if (a === b && insideRegion(spans, a)) { notify("That part is encrypted. Put the cursor outside the ⟦ ⟧ marks."); return; }
    const ra = insideRegion(spans, a), rb = insideRegion(spans, b);
    if (ra) a = ra[0]; if (rb) b = rb[1];                    // marks never go inside ⟦ ⟧: the selection grows to take in whole regions
    const ch = mark[0], len = mark.length;
    const nb = runBefore(t, a, ch), na = runAfter(t, b, ch);
    const present = ch === "`" ? nb >= 1 && na >= 1 && t[a - 1] === "`" && t[b] === "`"
      : len === 2 ? nb >= 2 && na >= 2 : nb % 2 === 1 && na % 2 === 1;
    if (present) { replaceRange(ta, a - len, b + len, t.slice(a, b), a - len, b - len); return; }
    if (a !== b) {                                           // the marks inside the selection itself
      const sel = t.slice(a, b);
      if (sel.length > 2 * len && sel.startsWith(mark) && sel.endsWith(mark) && (len === 2 || (sel[len] !== ch && sel[sel.length - len - 1] !== ch))) {
        replaceRange(ta, a, b, sel.slice(len, sel.length - len), a, b - 2 * len); return;
      }
      const lead = sel.match(/^\s*/)[0].length, trail = sel.match(/\s*$/)[0].length;
      if (lead === sel.length) return;
      const x = a + lead, y = b - trail;
      replaceRange(ta, x, y, mark + t.slice(x, y) + mark, x + len, y + len);
      return;
    }
    replaceRange(ta, a, a, mark + mark, a + len);            // nothing selected: marks with the cursor between them
  }
  function insertLink(ta, notify) {
    const t = ta.value, spans = regionSpans(t);
    let a = ta.selectionStart, b = ta.selectionEnd;
    if (a === b && insideRegion(spans, a)) { notify("That part is encrypted. Put the cursor outside the ⟦ ⟧ marks."); return; }
    const ra = insideRegion(spans, a), rb = insideRegion(spans, b);
    if (ra) a = ra[0]; if (rb) b = rb[1];
    const sel = t.slice(a, b).trim();
    if (!sel) { replaceRange(ta, a, a, "[text](https://)", a + 1, a + 5); return; }
    if (/^https?:\/\/\S+$/i.test(sel)) { replaceRange(ta, a, b, "[text](" + sel + ")", a + 1, a + 5); return; }
    const x = a + (t.slice(a, b).length - t.slice(a, b).trimStart().length), y = x + sel.length;
    replaceRange(ta, x, y, "[" + sel + "](https://)", y + 3, y + 11);
  }

  // Line marks: heading, bullet, numbered, task, quote. They go at the start of each line touched by the selection.
  const LIST_MARK = /^([ \t]*)(?:[-*+]|\d{1,9}[.)])[ \t]+(?:\[[ xX]\][ \t]+)?/;
  function linePrefix(ta, kind, notify) {
    const t = ta.value, spans = regionSpans(t);
    const a = ta.selectionStart, b = ta.selectionEnd;
    const from = t.lastIndexOf("\n", a - 1) + 1;
    let to = t.indexOf("\n", b > a && t[b - 1] === "\n" ? b - 1 : b); if (to < 0) to = t.length;
    const lines = t.slice(from, to).split("\n");
    let pos = from; const usable = [];
    lines.forEach((ln, k) => { const start = pos; pos += ln.length + 1; if (!insideRegion(spans, start)) usable.push(k); });
    if (!usable.length) { notify("That part is encrypted. Put the cursor outside the ⟦ ⟧ marks."); return; }
    const targets = usable.filter((k) => lines[k].trim() || lines.length === 1);
    if (!targets.length) return;
    const has = (ln) => kind === "quote" ? /^ {0,3}>/.test(ln) : kind === "bullet" ? /^[ \t]*[-*+][ \t]+(?!\[[ xX]\])/.test(ln) : kind === "numbered" ? /^[ \t]*\d{1,9}[.)][ \t]+/.test(ln)
      : kind === "task" ? /^[ \t]*[-*+][ \t]+\[[ xX]\][ \t]+/.test(ln) : /^ {0,3}#{1,6}[ \t]+/.test(ln);
    const allHave = kind !== "heading" && targets.every((k) => has(lines[k]));
    let n = 0;
    const out = lines.map((ln, k) => {
      if (!targets.includes(k)) return ln;
      if (kind === "heading") {                              // cycles # → ## → ### → none
        const m = /^ {0,3}(#{1,6})[ \t]+/.exec(ln), level = m ? m[1].length : 0, body = ln.replace(/^ {0,3}#{1,6}[ \t]+/, "");
        return level >= 3 ? body : "#".repeat(level + 1) + " " + body;
      }
      if (kind === "quote") return allHave ? ln.replace(/^ {0,3}>[ ]?/, "") : "> " + ln;
      const m = LIST_MARK.exec(ln), indent = m ? m[1] : (ln.match(/^[ \t]*/)[0]), body = m ? ln.slice(m[0].length) : ln.slice(indent.length);
      if (allHave) return indent + body;
      n++;
      return indent + (kind === "bullet" ? "- " : kind === "task" ? "- [ ] " : n + ". ") + body;
    });
    const next = out.join("\n");
    replaceRange(ta, from, to, next, from, from + next.length);
  }
  function insertBlock(ta, kind, notify) {
    const t = ta.value, spans = regionSpans(t);
    let a = ta.selectionStart, b = ta.selectionEnd;
    const ra = insideRegion(spans, a), rb = insideRegion(spans, b);
    if (ra) a = ra[1]; if (rb) b = rb[1]; if (b < a) b = a;
    if (kind === "rule") {
      let e = t.indexOf("\n", b); if (e < 0) e = t.length;
      const lead = t.slice(t.lastIndexOf("\n", e - 1) + 1, e).trim() ? "\n\n" : "\n", tail = t[e + 1] === undefined ? "\n" : "\n";
      const s = lead + "---" + tail; replaceRange(ta, e, e, s, e + s.length); return;
    }
    const from = t.lastIndexOf("\n", a - 1) + 1; let to = t.indexOf("\n", b > a && t[b - 1] === "\n" ? b - 1 : b); if (to < 0) to = t.length;
    if (insideRegion(spans, from)) { notify("That part is encrypted. Put the cursor outside the ⟦ ⟧ marks."); return; }
    const body = t.slice(from, to);
    if (!body.trim()) { const s = "```\n\n```"; replaceRange(ta, from, to, s, from + 4); return; }
    const s = "```\n" + body + "\n```"; replaceRange(ta, from, to, s, from + 4, from + 4 + body.length);
  }

  /* ---------- The format bar and the Edit / Preview switch ---------- */
  const BUTTONS = [
    ["bold", "B", "Bold (Ctrl/Cmd+B)", (ta, n) => toggleInline(ta, "**", n), "wbmd-b"],
    ["italic", "I", "Italic (Ctrl/Cmd+I)", (ta, n) => toggleInline(ta, "*", n), "wbmd-i"],
    ["code", "</>", "Inline code", (ta, n) => toggleInline(ta, "`", n), "wbmd-c"],
    ["link", "Link", "Link (Ctrl/Cmd+K)", (ta, n) => insertLink(ta, n)],
    ["heading", "H", "Heading: press again for a smaller one, then none", (ta, n) => linePrefix(ta, "heading", n)],
    ["bullet", "• List", "Bulleted list", (ta, n) => linePrefix(ta, "bullet", n)],
    ["numbered", "1. List", "Numbered list", (ta, n) => linePrefix(ta, "numbered", n)],
    ["task", "☐ Task", "Task list", (ta, n) => linePrefix(ta, "task", n)],
    ["quote", "❝", "Quote", (ta, n) => linePrefix(ta, "quote", n)],
    ["fence", "{ }", "Code block", (ta, n) => insertBlock(ta, "fence", n)],
    ["rule", "―", "Horizontal rule", (ta, n) => insertBlock(ta, "rule", n)],
  ];

  function attach(ctx, host) {
    const ta = ctx.text, bar = ctx.bar, view = ctx.view, box = ctx.box;
    const notify = (msg) => { try { host.toast(msg); } catch (e) { /* no toast here */ } };
    let state = { shown: false, id: null, rev: 0, readOnly: true, locked: false, whole: false, unlocked: false };
    let mode = "edit", prevShown = false;

    const _barKeep = bar.querySelector(".nt-acts");   // host action buttons to preserve
    bar.textContent = "";
    const pvFlag = document.createElement("span"); pvFlag.className = "wbmd-pvflag"; pvFlag.textContent = "Preview"; pvFlag.hidden = true;
    const fmt = document.createElement("div"); fmt.className = "wbmd-fmt"; fmt.setAttribute("role", "toolbar"); fmt.setAttribute("aria-label", "Format");
    const buttons = [];
    for (const [id, label, title, run, cls] of BUTTONS) {
      const b = document.createElement("button"); b.type = "button"; b.className = "wbmd-btn " + (cls || ""); b.textContent = label; b.title = title; b.setAttribute("aria-label", title); b.dataset.act = id;
      b.addEventListener("pointerdown", (e) => e.preventDefault());             // keep the selection and the keyboard in the note
      b.addEventListener("mousedown", (e) => e.preventDefault());
      b.addEventListener("click", () => { if (state.readOnly || mode !== "edit") return; run(ta, notify); });
      fmt.appendChild(b); buttons.push(b);
    }
    const sp = document.createElement("span"); sp.className = "wbmd-sp";
    const tog = document.createElement("button"); tog.type = "button"; tog.className = "wbmd-btn wbmd-tog";
    tog.addEventListener("pointerdown", (e) => { if (mode === "edit") e.preventDefault(); });
    tog.addEventListener("click", () => setMode(mode === "edit" ? "preview" : "edit"));
    bar.append(fmt, pvFlag, sp, tog);
    if (_barKeep) bar.append(_barKeep);               // restore host action buttons at the end

    function clearView() { view.textContent = ""; view.hidden = true; box.classList.remove("wbmd-preview"); }
    function paint() {
      view.hidden = false; box.classList.add("wbmd-preview");
      render(ta.value, view); view.scrollTop = 0;
    }
    function usable() { return settings.enabled && state.shown && state.id !== null && !state.whole; }
    function setMode(m) {
      if (m === "preview" && !usable()) m = "edit";
      const was = mode; mode = m;
      if (m === "preview") { ta.blur(); paint(); } else { clearView(); if (was === "preview" && usable() && !state.readOnly) { try { ta.focus(); } catch (e) { /* ignore */ } } }
      sync();
    }
    function sync() {
      const on = usable();
      /* Don't hide the bar itself — the host controls that so it can hold its own buttons (lock, menu).
         Hide addon elements individually instead. */
      const pe = on && mode === "preview";
      fmt.hidden = !on || !settings.showToolbar || pe;
      pvFlag.hidden = !pe;
      sp.hidden = !on;
      tog.hidden = !on;
      if (!on) { if (mode === "preview" || !view.hidden) { mode = "edit"; clearView(); } return; }   // nothing readable stays on screen
      for (const b of buttons) b.disabled = state.readOnly;
      tog.textContent = mode === "preview" ? "Edit" : "Preview";
      tog.title = mode === "preview" ? "Back to editing" : "Show the note with its formatting (read-only)";
      tog.setAttribute("aria-pressed", mode === "preview" ? "true" : "false");
    }
    function onState(s) {
      const prev = state; state = s;
      const fresh = (s.shown && !prevShown) || (s.id !== prev.id && !(prev.id === "new" && s.rev === prev.rev));
      prevShown = s.shown;
      if (!usable()) { sync(); return; }
      if (fresh) { mode = "edit"; clearView(); if (settings.defaultMode === "preview" && s.id !== "new") { mode = "preview"; paint(); } }
      else if (mode === "preview" && s.rev !== prev.rev) paint();      // locked or unlocked meanwhile: show what the note holds now
      sync();
    }
    ta.addEventListener("keydown", (e) => {
      if (!settings.enabled || state.readOnly || mode !== "edit") return;

      /* ── Ctrl/Cmd shortcuts (Bold, Italic, Link) ── */
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && settings.shortcuts) {
        const k = e.key.toLowerCase();
        if (k === "b") { e.preventDefault(); toggleInline(ta, "**", notify); return; }
        if (k === "i") { e.preventDefault(); toggleInline(ta, "*", notify); return; }
        if (k === "k") { e.preventDefault(); insertLink(ta, notify); return; }
      }

      /* ── Smart editing helpers ── */
      const t = ta.value, cur = ta.selectionStart, end = ta.selectionEnd;
      const lineStart = t.lastIndexOf("\n", cur - 1) + 1;
      const lineEnd = t.indexOf("\n", cur); const le = lineEnd < 0 ? t.length : lineEnd;
      const line = t.slice(lineStart, le);

      /* Regex for list markers: "  - ", "  * ", "  1. ", "  - [ ] ", "  - [x] " with optional leading indent */
      const LIST_RE = /^(\s*)([-*]\s\[[ x]\]\s|[-*]\s|\d+\.\s)/;
      const NUM_RE = /^(\s*)(\d+)\.\s/;

      /* ── Enter: auto-continue or exit list ── */
      if (e.key === "Enter" && !e.shiftKey && cur === end) {
        const m = line.match(LIST_RE);
        if (m) {
          e.preventDefault();
          const indent = m[1], marker = m[2];
          const afterMarker = line.slice(m[0].length);

          /* Empty marker line → remove the marker and exit the list */
          if (!afterMarker.trim()) {
            replaceRange(ta, lineStart, le, "", lineStart, lineStart);
            return;
          }

          /* Build the next marker */
          let next;
          const nm = marker.match(/^(\d+)\.\s$/);
          if (nm) {
            /* Numbered list → increment */
            next = indent + (parseInt(nm[1], 10) + 1) + ". ";
            /* Auto-renumber: bump numbers on all following lines in this list */
            const rest = t.slice(le + 1);                            // text after the \n at end of current line
            if (rest) {
              const lines = rest.split("\n");
              let renumbered = [], num = parseInt(nm[1], 10) + 2, changed = false;
              for (let i = 0; i < lines.length; i++) {
                const lm = lines[i].match(/^(\s*)(\d+)(\.\s)/);
                if (lm && lm[1] === indent) {
                  renumbered.push(indent + num + lm[3] + lines[i].slice(lm[0].length));
                  num++; changed = true;
                } else {
                  /* End of contiguous numbered list — append rest unchanged */
                  renumbered.push(...lines.slice(i)); break;
                }
              }
              if (changed) {
                const ins = "\n" + next;
                const full = ins + "\n" + renumbered.join("\n");
                replaceRange(ta, cur, t.length, full, cur + ins.length, cur + ins.length);
                return;
              }
            }
          } else if (/^[-*]\s\[[ x]\]\s$/.test(marker)) {
            /* Task list → always unchecked */
            next = indent + marker[0] + " [ ] ";
          } else {
            /* Bullet (- or *) */
            next = indent + marker;
          }
          const ins = "\n" + next;
          replaceRange(ta, cur, cur, ins, cur + ins.length, cur + ins.length);
          return;
        }
      }

      /* ── Tab / Shift+Tab: indent / outdent current line(s) ── */
      if (e.key === "Tab") {
        e.preventDefault();
        const selStart = ta.selectionStart, selEnd = ta.selectionEnd;
        const firstLine = t.lastIndexOf("\n", selStart - 1) + 1;
        const lastLine = selEnd > selStart && t[selEnd - 1] === "\n" ? selEnd - 1 : (t.indexOf("\n", selEnd) < 0 ? t.length : t.indexOf("\n", selEnd));
        const block = t.slice(firstLine, lastLine);
        const lines = block.split("\n");
        let newBlock, delta = 0, firstDelta = 0;
        if (e.shiftKey) {
          /* Outdent: remove up to 2 leading spaces per line */
          newBlock = lines.map((l, i) => {
            const rm = l.match(/^( {1,2})/);
            if (rm) { if (i === 0) firstDelta = -rm[1].length; delta -= rm[1].length; return l.slice(rm[1].length); }
            return l;
          }).join("\n");
        } else {
          /* Indent: add 2 spaces per line */
          newBlock = lines.map((l, i) => { if (i === 0) firstDelta = 2; delta += 2; return "  " + l; }).join("\n");
        }
        replaceRange(ta, firstLine, lastLine, newBlock, selStart + firstDelta, selEnd + delta);

        /* Renumber after indent change — the list context may have shifted */
        return;
      }

      /* ── Auto-close pairs: ` ** _ ( [ ── */
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const sel = t.slice(cur, end);
        const pairs = { "`": "`", "(": ")", "[": "]" };
        const ch = e.key;

        /* Skip over closing character if the next char matches — check BEFORE auto-close */
        if ((ch === ")" || ch === "]" || ch === "`") && t[cur] === ch && cur === end) {
          e.preventDefault();
          ta.setSelectionRange(cur + 1, cur + 1);
          return;
        }

        /* Backtick, paren, bracket — wrap selection or auto-close */
        if (pairs[ch]) {
          if (sel.length > 0) {
            /* Wrap selection */
            e.preventDefault();
            const wrapped = ch + sel + pairs[ch];
            replaceRange(ta, cur, end, wrapped, cur + 1, cur + 1 + sel.length);
            return;
          }
          /* For backtick with no selection, insert pair and place cursor inside */
          if (ch === "`") {
            e.preventDefault();
            replaceRange(ta, cur, cur, "``", cur + 1, cur + 1);
            return;
          }
        }

        /* Bold ** — typed as two consecutive * */
        if (ch === "*" && cur > 0 && t[cur - 1] === "*") {
          if (sel.length > 0) {
            /* Selection exists: the first * is already typed, so wrap: insert * before selection, ** after */
            /* Actually this fires on the second *, so t[cur-1] is the first *. Wrap selection in ** ** */
            e.preventDefault();
            const wrapped = "*" + sel + "**";
            replaceRange(ta, cur, end, wrapped, cur + 1, cur + 1 + sel.length);
            return;
          }
        }
      }
    });
    listeners.push(() => { if (!settings.enabled && (mode === "preview" || !view.hidden)) { mode = "edit"; clearView(); } sync(); });
    return { onState, setMode, get mode() { return mode; } };
  }

  window.wbMd = { settings, load, save, onSettings: (fn) => listeners.push(fn), render, strip, attach, get loaded() { return loadedOnce; } };
})();
