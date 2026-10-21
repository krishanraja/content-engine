(() => {
// The week's one publish board. week_board.py fills CONF: the week, its
// three days (which piece each holds, if any) and the steps that make 100%.
const CONF = __WEEK_BOARD_CONF__;
const toastEl = document.getElementById("toast");
const toast = m => { toastEl.textContent = m; toastEl.classList.add("on"); clearTimeout(toastEl._h); toastEl._h = setTimeout(() => toastEl.classList.remove("on"), 2200) };
function report(btn, how){
  const s = btn.closest(".card,.pic")?.querySelector(".status"); const ok = how !== "failed";
  const said = { clipboard: "Copied. Paste it straight in.", command: "Copied (browser copy). Paste it straight in.", failed: "This browser blocked copying here. Use Download, or select and copy." }[how];
  if (s) { s.textContent = said; s.className = "status " + (ok ? "ok" : "bad") }
  toast(ok ? "Copied" : "Copy blocked: use Download");
}
function viaCommand(htmlStr, text){
  const d = document.createElement("div"); d.contentEditable = "true";
  d.style.cssText = "position:fixed;left:-9999px;top:0;white-space:pre-wrap";
  if (htmlStr) d.innerHTML = htmlStr; else d.textContent = text;
  document.body.appendChild(d);
  const r = document.createRange(); r.selectNodeContents(d); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
  let ok = false; try { ok = document.execCommand("copy") } catch {}
  sel.removeAllRanges(); d.remove(); return ok;
}
async function copyText(text){
  try { await navigator.clipboard.writeText(text); return "clipboard" } catch {}
  return viaCommand(null, text) ? "command" : "failed";
}
async function copyRich(htmlStr, text){
  try {
    await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([htmlStr], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" }) })]);
    return "clipboard";
  } catch {}
  return viaCommand(htmlStr, text) ? "command" : "failed";
}
// A picture is a data: URL. Decode it here: the viewer's page rules can block fetch() on data: URLs,
// which once made every Download and Copy picture die without a word (Krish, 14 Oct: "STILL do not work").
function dataBlob(src){
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(src || ""); if (!m) return null;
  const raw = m[2] ? atob(m[3]) : decodeURIComponent(m[3]);
  const bytes = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return new Blob([bytes], { type: m[1] || "image/png" });
}
async function pngBlob(src){ return dataBlob(src) || (await fetch(src)).blob() }
async function copyImage(src){
  try { await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob(src) })]); return "clipboard" } catch {}
  return viaCommand(`<img src="${src}">`, "") ? "command" : "failed";
}
let downloads = null;
const downloadsReady = (async () => { try { downloads = window.claude?.use ? await window.claude.use("downloads") : null } catch { downloads = null } return downloads })();
async function download(src, name){
  let blob;
  try { blob = await pngBlob(src) } catch (e) { toast("Could not read this picture (" + ((e && e.message) || "unknown") + "). Use Copy picture."); return }
  // Wait for the save capability (it answers a moment after load), and say why a save did not happen.
  const saver = downloads || (window.claude ? await downloadsReady : null);
  if (saver) {
    try { await saver.save({ filename: name, data: blob }); toast("Saved " + name); return }
    catch (e) {
      const code = e && e.code;
      if (code === "declined") return;
      if (code === "rate_limited") { toast("Another save is still open. Finish it, then tap Download again."); return }
      if (code === "too_large") { toast("This file is too big to save here. Use Copy picture."); return }
      toast("This app view cannot save files (" + (code || "unknown") + "). Open the board in a browser, or use Copy picture."); return
    }
  }
  if (window.claude) { toast("This app view cannot save files. Open the board in a browser, or use Copy picture."); return }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast("Downloading " + name);
}
const hhmm = iso => {
  const d = new Date(iso); if (isNaN(d)) return "";
  const t = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  const today = new Date().toDateString() === d.toDateString();
  return today ? t : d.getDate() + " " + d.toLocaleString("en-GB", { month: "short" }) + " " + t;
};

// One publish page per made tab: every query is scoped to that tab's root,
// whose ids carry the day's prefix ("mon-", "wed-", "fri-").
const panels = {};
document.querySelectorAll(".pm[data-prefix]").forEach(root => {
  const P = root.dataset.prefix, day = root.dataset.day;
  const byId = id => root.querySelector("#" + CSS.escape(id));
  const st = { article: "", youtube: "" };
  const fill = t => String(t).replaceAll("{ARTICLE_URL}", st.article || "{ARTICLE_URL}").replaceAll("{YOUTUBE_URL}", st.youtube || "{YOUTUBE_URL}");
  const refill = () => root.querySelectorAll("pre[data-raw]").forEach(p => p.textContent = fill(p.dataset.raw));
  root.addEventListener("click", async e => {
    const b = e.target.closest("button[data-act]"); if (!b || !root.contains(b)) return;
    const act = b.dataset.act, ref = b.dataset.ref, el = byId(ref);
    if (!el) return;
    if (act === "text") report(b, await copyText(fill(el.textContent)));
    if (act === "article") report(b, await copyRich(fill(el.innerHTML), fill((byId(ref + "-text") || el).textContent)));
    if (act === "image") report(b, await copyImage(el.src));
    if (act === "download") await download(el.src, b.dataset.name);
  });
  const inputs = { article: byId(P + "link-article"), youtube: byId(P + "link-youtube") };
  const linkState = root.querySelector("[data-linkstate]");
  panels[day] = { root, st, refill, inputs, linkState, timer: null, saving: Promise.resolve() };
  refill();
});

// Durable ticks and links, kept in this page's own store (the db
// capability): ticks/<day>-<step> and links/<day>. The ids depend only on
// the day and the step, so a republish to the same page keeps every tick.
const STEPS = CONF.steps, DAYS = CONF.days;
const META = {};
for (const d of DAYS) if (d.picked) for (const s of STEPS)
  META[d.key + "-" + s.key] = { day: d.key, piece_id: d.piece_id, step: s.key, channel: s.channel, label: s.label, standing: s.standing };
const ticks = {}, pending = {}, errs = {};
let db = null, mode = "loading"; // loading | live | off | broken
const NOTE = { loading: "Loading saved ticks.", off: "Ticks are not saving in this view. Open it in claude.ai.", broken: "Saved ticks could not load. Reload the page to try again.", live: "" };
// A tick saved for another piece (the day picked again, or an older week's
// board) is not this piece's tick.
const mine = id => { const s = ticks[id], m = META[id]; return !!s && (!s.piece_id || !m || !m.piece_id || s.piece_id === m.piece_id) };
const doneOf = id => id in pending ? pending[id] : (mine(id) && !!ticks[id].done);

function render(){
  document.querySelectorAll("label.tick").forEach(l => {
    const inp = l.querySelector("input[data-tick]"); if (!inp) return;
    const id = inp.dataset.tick;
    const saved = mine(id) ? ticks[id] : {};
    const on = doneOf(id);
    inp.checked = on;
    inp.disabled = mode !== "live" || id in pending || !META[id];
    l.classList.toggle("on", on); l.classList.toggle("busy", id in pending);
    l.querySelector(".t-when").textContent = id in pending ? "saving" : (on && saved.done && saved.at ? "ticked " + hhmm(saved.at) : "");
    l.querySelector(".t-err").textContent = errs[id] || "";
  });
  let wDone = 0, wAll = 0;
  const live = mode === "live";
  for (const d of DAYS) {
    const tab = document.querySelector(`[data-tabprog="${d.key}"]`);
    if (!d.picked) { if (tab) tab.textContent = "not picked"; continue }
    const ids = STEPS.filter(s => s.standing).map(s => d.key + "-" + s.key);
    const n = ids.filter(doneOf).length;
    wDone += n; wAll += ids.length;
    if (tab) tab.textContent = live ? `${n} of ${ids.length}` : `${ids.length} steps`;
    const c = document.querySelector(`[data-count="${d.key}"]`);
    if (c) c.textContent = live ? `${n} of ${ids.length} · ${Math.round(100 * n / ids.length)}%` : `${ids.length} steps`;
    const m = document.querySelector(`[data-meter="${d.key}"]`); if (m) m.style.width = live ? (100 * n / ids.length) + "%" : "0";
    const note = document.querySelector(`[data-note="${d.key}"]`);
    if (note) { note.textContent = NOTE[mode]; note.classList.toggle("bad", mode === "off" || mode === "broken") }
  }
  const pct = wAll ? Math.round(100 * wDone / wAll) : 0;
  const wm = document.querySelector('[data-meter="week"]'); if (wm) wm.style.width = (live ? pct : 0) + "%";
  const wb = document.querySelector("[data-weekbar]"); if (wb) wb.setAttribute("aria-valuenow", live ? pct : 0);
  const wt = document.querySelector("[data-weektxt]");
  if (wt) wt.textContent = !wAll ? "This week: nothing picked yet" : live ? `This week: ${pct}% · ${wDone} of ${wAll} ticks` : mode === "loading" ? "This week: loading ticks" : "This week: ticks not saving in this view";
}

async function setTick(id, done){
  if (mode !== "live" || !db || id in pending || !META[id]) return;
  const m = META[id];
  const body = { done, at: new Date().toISOString(), day: m.day, piece_id: m.piece_id, step: m.step, channel: m.channel, label: m.label };
  pending[id] = done; errs[id] = ""; render();
  try { await db.collection("ticks").doc(id).set(body); ticks[id] = body }
  catch (e) { errs[id] = "Not saved, tap again" }
  delete pending[id]; render();
}
document.addEventListener("change", e => {
  const inp = e.target.closest && e.target.closest("input[data-tick]"); if (!inp) return;
  const id = inp.dataset.tick;
  if (mode !== "live") { render(); return }
  setTick(id, inp.checked);
});

function saveLinks(day){
  const p = panels[day]; clearTimeout(p.timer);
  p.timer = setTimeout(() => {
    p.timer = null;
    if (!db || mode !== "live") return;
    const body = { article: p.st.article, youtube: p.st.youtube, at: new Date().toISOString() };
    const said = (text, bad) => { if (p.linkState) { p.linkState.textContent = text; p.linkState.className = "link-state" + (bad ? " bad" : "") } };
    p.saving = p.saving.then(() => db.doc("links/" + day).set(body)).then(
      () => { for (const [key, el] of Object.entries(p.inputs)) if (el && el.value.trim() === body[key]) el.dataset.unsaved = "false"; said("Links saved " + hhmm(body.at) + ".", false) },
      () => said("Links not saved. Type again to retry.", true));
  }, 700);
}
for (const day of Object.keys(panels)) {
  const p = panels[day];
  for (const k of ["article", "youtube"]) {
    const el = p.inputs[k]; if (!el) continue;
    el.addEventListener("input", () => { p.st[k] = el.value.trim(); p.refill(); saveLinks(day) });
  }
}

render();
(async () => {
  try { db = window.claude?.use ? await window.claude.use("db") : null } catch { db = null }
  if (!db) { mode = "off"; render(); return }
  try {
    db.collection("ticks").onSnapshot(snap => {
      for (const k of Object.keys(ticks)) delete ticks[k];
      for (const d of snap.docs) if (d.exists) ticks[d.id] = d.data() || {};
      mode = "live"; render();
    }, () => { mode = "broken"; render() });
    for (const day of Object.keys(panels)) {
      const p = panels[day];
      if (!p.inputs.article && !p.inputs.youtube) continue;
      db.doc("links/" + day).onSnapshot(s => {
        const v = s.exists ? (s.data() || {}) : {};
        for (const k of ["article", "youtube"]) {
          const el = p.inputs[k]; if (!el) continue;
          if (p.timer || document.activeElement === el || el.dataset.unsaved === "true") continue; // never overwrite unsaved typing
          const val = typeof v[k] === "string" ? v[k] : "";
          p.st[k] = val; el.value = val;
        }
        if (s.exists && v.at && p.linkState) { p.linkState.textContent = "Links saved " + hhmm(v.at) + "."; p.linkState.className = "link-state" }
        p.refill();
      }, () => {});
    }
  } catch { mode = "broken"; render() }
})();

// The week's tabs: arrow keys, Home and End, a link to #monday or to any id
// inside a tab, and the tab this viewer last opened.
const bar = document.querySelector(".wk");
const tabs = [...document.querySelectorAll(".wk [role=tab]")];
const PREFIX = {}; for (const d of DAYS) PREFIX[d.key + "-"] = d.name;
const REMEMBER = "week-board:" + CONF.week;
const remember = day => { try { localStorage.setItem(REMEMBER, day) } catch {} };
const remembered = () => { try { return localStorage.getItem(REMEMBER) } catch { return null } };
function select(day, opts = {}){
  const tab = tabs.find(t => t.dataset.day === day); if (!tab) return;
  const changed = tab.getAttribute("aria-selected") !== "true";
  for (const t of tabs) {
    const on = t === tab;
    t.setAttribute("aria-selected", on ? "true" : "false"); t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
  }
  if (opts.focus) tab.focus();
  if (opts.hash) { try { history.replaceState(null, "", "#" + day) } catch {} remember(day) }
  if (changed && opts.top) window.scrollTo(0, 0);
}
// The day's four steps in the fixed layout (Brief, Drafts, Record, Publish), each a tab inside the day; a link
// to #monday/publish opens one, and a link to any id inside a step opens that step first.
function selectSub(panel, sub, opts = {}){
  const nav = panel && panel.querySelector(":scope > .steps"); if (!nav) return;
  const btns = [...nav.querySelectorAll("[role=tab]")]; const b = btns.find(x => x.dataset.sub === sub); if (!b) return;
  for (const x of btns) {
    const on = x === b;
    x.setAttribute("aria-selected", on ? "true" : "false"); x.tabIndex = on ? 0 : -1;
    document.getElementById(x.getAttribute("aria-controls")).hidden = !on;
  }
  if (opts.focus) b.focus();
  if (opts.hash) { try { history.replaceState(null, "", "#" + panel.id.replace(/^panel-/, "") + "/" + sub) } catch {} }
  if (opts.top) { const y = nav.getBoundingClientRect().top + window.scrollY - bar.offsetHeight - 8; if (window.scrollY > y) window.scrollTo(0, Math.max(0, y)) }
}
document.querySelectorAll(".pm.fixed > .steps").forEach(nav => {
  const panel = nav.parentElement, btns = [...nav.querySelectorAll("[role=tab]")];
  btns.forEach((b, i) => {
    b.addEventListener("click", () => selectSub(panel, b.dataset.sub, { hash: true, top: true }));
    b.addEventListener("keydown", e => {
      let j = null;
      if (e.key === "ArrowRight") j = (i + 1) % btns.length;
      else if (e.key === "ArrowLeft") j = (i - 1 + btns.length) % btns.length;
      else if (e.key === "Home") j = 0;
      else if (e.key === "End") j = btns.length - 1;
      if (j === null) return;
      e.preventDefault(); selectSub(panel, btns[j].dataset.sub, { focus: true, hash: true });
    });
  });
});
const openStepOf = el => { const sp = el && el.closest(".subpanel"); if (sp) selectSub(sp.closest(".pm"), sp.dataset.sub) };
function fromHash(){
  const h = decodeURIComponent((location.hash || "").slice(1));
  if (!h) return false;
  if (tabs.some(t => t.dataset.day === h)) { select(h, { top: true }); return true }
  const step = /^([a-z]+)\/([a-z]+)$/.exec(h);
  if (step && tabs.some(t => t.dataset.day === step[1])) { select(step[1], { top: true }); selectSub(document.getElementById("panel-" + step[1]), step[2]); return true }
  for (const p in PREFIX) if (h.startsWith(p)) { select(PREFIX[p]); const el = document.getElementById(h); if (el) { openStepOf(el); el.scrollIntoView() } return true }
  return false;
}
tabs.forEach((t, i) => {
  t.addEventListener("click", () => select(t.dataset.day, { hash: true, top: true }));
  t.addEventListener("keydown", e => {
    let j = null;
    if (e.key === "ArrowRight") j = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") j = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = tabs.length - 1;
    if (j === null) return;
    e.preventDefault(); select(tabs[j].dataset.day, { focus: true, hash: true, top: true });
  });
});
window.addEventListener("hashchange", fromHash);
if (!fromHash()) { const r = remembered(); if (r && tabs.some(t => t.dataset.day === r)) select(r) }
const setH = () => document.documentElement.style.setProperty("--tabh", bar.offsetHeight + "px");
setH();
try { new ResizeObserver(setH).observe(bar) } catch { window.addEventListener("resize", setH) }
})();

// Review the words (week_board.py review_card). Krish edits a block and saves
// it, or comments on it; a session reads the saves from edits/<day>-<item>.
// Each save is also posted as a comment on its block ("EDIT <id>", the
// paragraphs it changed): a board's store can only be read from the account
// that owns it, but its comments can be read from either of Krish's accounts.
(() => {
  // The fixed layout's editor (.rv-ed, below) owns its own boxes.
  const boxes = [...document.querySelectorAll("textarea[data-review-id]")].filter(b => !b.closest(".rv-ed"));
  if (!boxes.length) return;
  const stateOf = id => document.querySelector(`[data-state-for="${id}"]`);
  const say = (id, text, bad) => { const s = stateOf(id); if (s) { s.textContent = text; s.className = "rv-state" + (bad ? " bad" : "") } };
  const base = {}; for (const b of boxes) base[b.dataset.reviewId] = b.value;
  const prev = { ...base }; // the last saved text of each block: what a save's comment is measured against
  let rdb = null, comments = null;
  for (const b of boxes) say(b.dataset.reviewId, "Connecting so your edits can be saved…");
  (async () => {
    try { rdb = window.claude?.use ? await window.claude.use("db") : null } catch { rdb = null }
    if (!rdb) { for (const b of boxes) say(b.dataset.reviewId, ""); return }
    for (const b of boxes) {
      const id = b.dataset.reviewId;
      say(id, "");
      rdb.doc("edits/" + id).onSnapshot(s => {
        if (!s.exists) return;
        const v = s.data() || {};
        if (typeof v.text !== "string") return;
        // A save older than this build was folded into these words by a
        // session: show the new words, never the older save over them.
        const built = b.dataset.builtAt;
        if (built && v.at && v.at < built) {
          say(id, "Your edit saved " + new Date(v.at).toLocaleString() + " is in this version.");
          return;
        }
        prev[id] = v.text;
        if (document.activeElement === b || b.dataset.unsaved === "true") return; // never overwrite unsaved typing
        b.value = v.text;
        const n = b.closest(".rv-item")?.querySelector(".rv-n");
        if (n) n.textContent = v.text.split(/\s+/).filter(Boolean).length.toLocaleString("en-US") + " words";
        say(id, "Your edit, saved " + (v.at ? new Date(v.at).toLocaleString() : "") + ".");
      }, () => {});
    }
  })();
  const paras = t => t.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  // The paragraphs a save took out and put in, in page order.
  const changes = (was, now) => {
    const a = paras(was), b = paras(now), inA = new Set(a), inB = new Set(b), out = [];
    for (const p of a) if (!inB.has(p)) out.push("WAS: " + p);
    for (const p of b) if (!inA.has(p)) out.push("NOW: " + p);
    return out;
  };
  const bytes = s => new TextEncoder().encode(s).length;
  // Comments hold at most 4 KiB: split on paragraph lines, a long line by characters.
  const chunks = (head, lines) => {
    const pieces = [];
    for (const line of lines) for (let i = 0; i < line.length; i += 1000) pieces.push(line.slice(i, i + 1000));
    const out = []; let cur = head;
    for (const p of pieces) {
      if (bytes(cur + "\n\n" + p) > 3800) { out.push(cur); cur = "(continued)" }
      cur += "\n\n" + p;
    }
    out.push(cur);
    return out;
  };
  const postEdit = async (id, box, was, now) => {
    const lines = changes(was, now);
    if (!lines.length) return true;
    const parts = chunks(`EDIT ${id} · ${new Date().toISOString()}`, lines);
    const anchor = await comments.anchorFor(box.closest(".rv-item") || box);
    const first = await comments.create({ anchor, text: parts[0] });
    for (const p of parts.slice(1)) await comments.reply(first.threadId, p);
    return true;
  };
  (async () => { try { comments = window.claude?.use ? await window.claude.use("comments") : null } catch { comments = null }
    if (!comments) for (const btn of document.querySelectorAll('[data-act="comment-review"]')) btn.hidden = true;
    if (!comments && !rdb) for (const b of boxes) say(b.dataset.reviewId, "Saving isn't available in this view.", true) })();
  document.addEventListener("click", async e => {
    const btn = e.target.closest && e.target.closest('[data-act="save-review"],[data-act="comment-review"]'); if (!btn) return;
    const id = btn.dataset.for, box = document.querySelector(`textarea[data-review-id="${id}"]`); if (!box || box.closest(".rv-ed")) return;
    if (btn.dataset.act === "comment-review") {
      if (!comments) return;
      try { await comments.openComposer({ element: box.closest(".rv-item") || box }) } catch { say(id, "The comment box didn't open. Try the page's comment button.", true) }
      return;
    }
    if (!rdb && !comments) { say(id, "Saving isn't available in this view. Use Comment instead.", true); return }
    const text = box.value, was = prev[id];
    if (text === was) { say(id, "Nothing changed since your last save."); return }
    btn.disabled = true; say(id, "Saving…");
    let stored = false, posted = false, saveError = null;
    if (rdb) try {
      await rdb.doc("edits/" + id).set({ text, day: box.dataset.day, item: box.dataset.item, at: new Date().toISOString(), words: text.trim().split(/\s+/).length });
      stored = true;
      if (box.value === text) box.dataset.unsaved = "false";
    } catch (e) { saveError = e }
    if (comments && (stored || !rdb || !window.boardRuntime)) try { posted = await postEdit(id, box, was, text) } catch {}
    if (stored || posted) prev[id] = text;
    say(id, window.boardRuntime && stored ? (box.value === text ? "Saved. Your changes are available to the content workflows." : "Saved the earlier wording. Your latest typing still needs saving.") : stored && posted ? "Saved, and your changes are posted as a comment. Claude will pick this up."
      : posted ? "Your changes are posted as a comment. Claude will pick this up."
      : stored ? "Saved. Claude can read it from this account's sessions; the comment copy didn't post."
      : saveError?.message || "Not saved. Press Save again.", !(stored || posted));
    btn.disabled = false;
  });
})();

// The Drafts step's editor (week_board.py editor_card, the fixed layout). Krish, 2026-10-21: "I need to be able to
// comment on them to iterate or just edit in line myself and save changes to get picked up", and "On mobile it's just
// a desktop site on mobile." Each draft reads as it will read; a tap on a paragraph opens it; picked words offer
// "Comment on this", pinned to {box, paragraph, quote}; one bar per day says how many changes are unsaved and saves
// them to edits/<day>-<item> (text, day, item, base_sha256, at), the store a session reads with board_web.py.
// Also changed (Undo, Change it too) and What I learned (Make it a rule, Not a rule) save his taps as comments with
// an act and a ref, which the next session relays.
(() => {
  const sections = [...document.querySelectorAll(".rv-ed[data-review]")];
  const acts = document.querySelectorAll('[data-act="undo-also"],[data-act="apply-also"],[data-act="lesson-yes"],[data-act="lesson-no"]');
  if (!sections.length && !acts.length) return;
  const SPLIT = /(\n(?:[ \t]*\n)+)/;
  const parts = t => t.split(SPLIT); // even places: the paragraphs; odd: the blank lines between them
  const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
  const INLINE = [[/`([^`\n]+)`/g, "<code>$1</code>"], [/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>"],
    [/(^|[^\w*])\*([^*\n]+)\*(?![\w*])/g, "$1<em>$2</em>"], [/(^|[^\w_])_([^_\n]+)_(?![\w_])/g, "$1<em>$2</em>"],
    [/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noopener" target="_blank">$1</a>']];
  const inline = line => INLINE.reduce((out, [re, to]) => out.replace(re, to), esc(line));
  // The same rules as md_block() in week_board.py.
  function mdBlock(text){
    const out = [], run = []; let kind = null;
    const flush = () => {
      if (!run.length) return;
      if (kind === "ul" || kind === "ol") out.push(`<${kind}>` + run.map(x => `<li>${inline(x)}</li>`).join("") + `</${kind}>`);
      else if (kind === "q") out.push("<blockquote><p>" + run.map(inline).join("<br>") + "</p></blockquote>");
      else out.push("<p>" + run.map(inline).join("<br>") + "</p>");
      run.length = 0;
    };
    for (const line of text.split("\n")) {
      const heading = line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/), rule = /^\s*([-*_])\s*(?:\1\s*){2,}$/.test(line);
      const item = line.match(/^\s*(?:[-*+]|(\d+)[.)])\s+(.*)$/), quote = line.match(/^\s*>\s?(.*)$/);
      if (heading || rule) { flush(); kind = null; out.push(heading ? `<h4 class="rv-h">${inline(heading[2])}</h4>` : "<hr>"); continue }
      const k = item ? (item[1] ? "ol" : "ul") : quote ? "q" : "p";
      if (k !== kind) { flush(); kind = k }
      run.push(item ? item[2] : quote ? quote[1] : line);
    }
    flush();
    return out.join("");
  }
  const box = {};
  for (const sec of sections) {
    const id = sec.dataset.review, ta = sec.querySelector("textarea[data-review-id]");
    if (ta) box[id] = { sec, ta, read: sec.querySelector(".rv-read"), saved: ta.value, built: ta.value, day: ta.dataset.day };
  }
  const stateOf = id => document.querySelector(`[data-state-for="${id}"]`);
  const say = (id, text, bad) => { const s = stateOf(id); if (s) { s.textContent = text; s.className = "rv-state" + (bad ? " bad" : "") } };
  const paras = t => parts(t).filter((_, i) => i % 2 === 0).map(p => p.trim()).filter(Boolean);
  function draw(id){
    const b = box[id], built = paras(b.built);
    b.read.replaceChildren();
    parts(b.ta.value).forEach((p, i) => {
      if (i % 2) return;
      const d = document.createElement("div"); d.className = "rv-p"; d.id = `rvp-${id}-${i / 2}`; d.dataset.para = String(i / 2); d.tabIndex = 0;
      d.innerHTML = mdBlock(p);
      if (!built.includes(p.trim())) d.classList.add("changed");
      b.read.append(d);
    });
    const n = b.sec.querySelector(".rv-n");
    const count = b.ta.value.split(/\s+/).filter(Boolean).length;
    if (n) n.textContent = count.toLocaleString("en-US") + (count === 1 ? " word" : " words");
  }
  // How many changes a box holds over its last save: the paragraphs taken out or put in, whichever is more.
  const changes = (was, now) => {
    if (was === now) return 0;
    const a = paras(was), b = paras(now), inA = new Set(a), inB = new Set(b);
    return Math.max(1, a.filter(p => !inB.has(p)).length, b.filter(p => !inA.has(p)).length);
  };
  let rdb = null, comments = null, ready = false;
  const saveState = {}; // day -> {text, cls}
  function tally(day){
    const bar = document.querySelector(`.rv-save[data-save-day="${day}"]`); if (!bar) return;
    const n = Object.values(box).filter(b => b.day === day).reduce((sum, b) => sum + changes(b.saved, b.ta.value), 0);
    const count = bar.querySelector(".rv-count"), btn = bar.querySelector('[data-act="save-all"]');
    const kept = saveState[day];
    if (n) { count.textContent = `${n} unsaved change${n === 1 ? "" : "s"}`; bar.className = "rv-save dirty" }
    else { count.textContent = kept?.text || "No unsaved changes"; bar.className = "rv-save" + (kept?.cls ? " " + kept.cls : "") }
    btn.disabled = !n || !ready;
    if (n && !ready) count.textContent += ": saving isn't available in this view";
  }
  const days = [...new Set(Object.values(box).map(b => b.day))];
  function setText(id, text){
    const b = box[id];
    b.ta.value = text;
    b.ta.dispatchEvent(new Event("input", { bubbles: true })); // the web runtime's own change tracking
    b.ta.dataset.unsaved = String(text !== b.saved);
    saveState[b.day] = null;
    draw(id); tally(b.day);
  }
  let open = null;
  function startEdit(el){
    if (open && open.el === el) return;
    if (open) {
      // Closing the open paragraph redraws its draft, so find the tapped one again by its place.
      const sid = el.closest(".rv-ed")?.dataset.review, pn = el.dataset.para;
      finish(true);
      el = document.getElementById(`rvp-${sid}-${pn}`) || el;
      if (!el.isConnected) return;
    }
    const sec = el.closest(".rv-ed"), id = sec.dataset.review, n = Number(el.dataset.para), b = box[id]; if (!b) return;
    const original = parts(b.ta.value)[2 * n] ?? "";
    const wrap = document.createElement("div"); wrap.className = "rv-pedit";
    const ed = document.createElement("textarea"); ed.className = "rv-ptext"; ed.value = original; ed.spellcheck = true;
    ed.setAttribute("aria-label", `Paragraph ${n + 1} of ${sec.querySelector("h3")?.textContent || "the draft"}`);
    const fit = () => { ed.style.height = "auto"; ed.style.height = Math.max(120, ed.scrollHeight + 4) + "px" };
    ed.addEventListener("input", fit);
    const bar = document.createElement("div"); bar.className = "btns";
    const mk = (label, cls, fn) => { const x = document.createElement("button"); x.type = "button"; x.className = "btn-s" + (cls ? " " + cls : ""); x.textContent = label; x.onclick = fn; bar.append(x); return x };
    mk("Done", "", () => finish(true));
    mk("Cancel", "ghost", () => finish(false));
    mk("Comment on this paragraph", "ghost", () => { const o = open; finish(true); comment(document.getElementById(`rvp-${id}-${n}`) || o?.el, id, n, original.replace(/\s+/g, " ").trim().slice(0, 300)) });
    wrap.append(ed, bar);
    el.hidden = true; el.after(wrap);
    open = { id, n, el, wrap, ed, original };
    fit(); ed.focus();
    ed.addEventListener("keydown", e => {
      if (e.key === "Escape") { e.preventDefault(); finish(false) }
      else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); finish(true) }
    });
    wrap.addEventListener("focusout", e => { if (open?.wrap === wrap && !(e.relatedTarget && wrap.contains(e.relatedTarget))) setTimeout(() => { if (open?.wrap === wrap && !wrap.contains(document.activeElement)) finish(true) }, 0) });
  }
  function finish(keep){
    const o = open; open = null; if (!o) return;
    o.wrap.remove(); o.el.hidden = false;
    const v = o.ed.value.replace(/^(?:[ \t]*\n)+/, "").replace(/(?:\n[ \t]*)+$/, "");
    if (!keep || v === o.original) return;
    const ps = parts(box[o.id].ta.value);
    if (!v.trim()) {
      // A paragraph emptied is taken out, with the blank line before it (or after, for the first).
      if (o.n > 0) ps.splice(2 * o.n - 1, 2); else ps.splice(0, Math.min(2, ps.length));
    } else ps[2 * o.n] = v;
    setText(o.id, ps.join(""));
    document.getElementById(`rvp-${o.id}-${o.n}`)?.focus({ preventScroll: true });
  }
  document.addEventListener("click", e => {
    const p = e.target.closest && e.target.closest(".rv-ed .rv-p"); if (!p || e.target.closest("a")) return;
    const sel = getSelection(); if (sel && !sel.isCollapsed && p.contains(sel.anchorNode)) return; // picking words, not opening
    startEdit(p);
  });
  document.addEventListener("keydown", e => {
    const p = e.target.closest && e.target.closest(".rv-ed .rv-p");
    if (p && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); startEdit(p) }
  });
  // Comment on picked words: a button in thumb reach while some words of one draft are selected.
  const cbtn = document.createElement("button"); cbtn.type = "button"; cbtn.className = "btn-s rv-cbtn"; cbtn.textContent = "Comment on this"; cbtn.hidden = true;
  if (sections.length) document.body.append(cbtn);
  let picked = null, timer = 0;
  const nodeEl = n => n && (n.nodeType === 1 ? n : n.parentElement);
  document.addEventListener("selectionchange", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const s = getSelection();
      const a = nodeEl(s?.anchorNode)?.closest(".rv-ed .rv-p"), f = nodeEl(s?.focusNode)?.closest(".rv-ed .rv-read");
      const quote = s && !s.isCollapsed ? s.toString().replace(/\s+/g, " ").trim().slice(0, 500) : "";
      if (!a || !quote || a.closest(".rv-read") !== f) { if (document.activeElement !== cbtn) { cbtn.hidden = true; picked = null } return }
      picked = { el: a, id: a.closest(".rv-ed").dataset.review, n: Number(a.dataset.para), quote };
      cbtn.hidden = false;
    }, 120);
  });
  cbtn.addEventListener("pointerdown", e => e.preventDefault()); // keep the words selected
  cbtn.addEventListener("click", () => { const p = picked; cbtn.hidden = true; picked = null; if (p) comment(p.el, p.id, p.n, p.quote) });
  async function comment(el, id, n, quote){
    if (!comments) { say(id, "Comments aren't available in this view.", true); return }
    try { await comments.openComposer({ element: el || box[id]?.sec, box: id, paragraph: n, quote }) }
    catch { say(id, "The comment box didn't open. Try the Comments button at the top.", true) }
  }
  async function saveDay(day){
    if (open) finish(true);
    const dirty = Object.entries(box).filter(([, b]) => b.day === day && b.ta.value !== b.saved);
    if (!dirty.length || !rdb) return;
    const bar = document.querySelector(`.rv-save[data-save-day="${day}"]`), btn = bar?.querySelector('[data-act="save-all"]');
    if (btn) btn.disabled = true;
    if (bar) bar.querySelector(".rv-count").textContent = "Saving…";
    let failed = null;
    for (const [id, b] of dirty) {
      const text = b.ta.value;
      try {
        await rdb.doc("edits/" + id).set({ text, day: b.ta.dataset.day, item: b.ta.dataset.item, at: new Date().toISOString(),
          words: text.trim().split(/\s+/).length, base_sha256: b.ta.dataset.baseSha256 });
        b.saved = text;
        if (b.ta.value === text) b.ta.dataset.unsaved = "false";
        say(id, "");
      } catch (e) { failed = e; say(id, e.status === 409 ? "Not saved: this draft changed in another session." : e.message || "Not saved.", true) }
    }
    const at = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    saveState[day] = failed ? { text: failed.status === 409 ? "Not saved: a draft changed in another session. Reload to see the latest, then make your change again."
      : (failed.message || "Not saved. Press Save again."), cls: "bad" } : { text: `Saved ${at}. Claude picks your changes up from here.`, cls: "ok" };
    tally(day);
    if (failed && bar) { bar.querySelector(".rv-count").textContent = saveState[day].text; bar.className = "rv-save bad" }
  }
  document.addEventListener("click", e => {
    const btn = e.target.closest && e.target.closest('[data-act="save-all"]'); if (btn) { saveDay(btn.dataset.day); return }
    const whole = e.target.closest && e.target.closest('.rv-ed [data-act="comment-review"]');
    if (whole) comment(box[whole.dataset.for]?.sec, whole.dataset.for, undefined, undefined);
  });
  // His taps on Also changed and What I learned, saved as comments a session relays.
  const ACT = { "undo-also": "undo", "apply-also": "apply", "lesson-yes": "lesson_yes", "lesson-no": "lesson_no" };
  const SAID = { undo: "UNDO: put this back as it was", apply: "APPLY: make this change here too", lesson_yes: "LESSON: yes, make it a rule", lesson_no: "LESSON: no, not a rule" };
  const DONE = { undo: "Undo saved. The next version puts it back.", apply: "Saved. The next version makes this change too.",
    lesson_yes: "Your yes is saved. The next session makes it a rule.", lesson_no: "Saved: not a rule." };
  const stateFor = (act, ref) => document.querySelector(act.startsWith("lesson") ? `[data-lesson-state="${ref}"]` : `[data-also-state="${ref}"]`);
  function mark(act, ref){
    const s = stateFor(act, ref); if (s) { s.textContent = DONE[act]; s.className = s.className.replace(/ (ok|bad)$/, "") + " ok" }
    const scope = s?.closest(".ac-row,.ls-item");
    for (const b of scope ? scope.querySelectorAll("button[data-act]") : []) b.disabled = true;
  }
  document.addEventListener("click", async e => {
    const b = e.target.closest && e.target.closest(Object.keys(ACT).map(k => `[data-act="${k}"]`).join(",")); if (!b) return;
    const act = ACT[b.dataset.act], ref = b.dataset.for, holder = b.closest(".ac-row,.ls-item"), s = stateFor(act, ref);
    if (!comments) { if (s) { s.textContent = "This view can't save that. Use the Comments button at the top."; s.className += " bad" } return }
    b.disabled = true; if (s) s.textContent = "Saving…";
    const what = (holder?.querySelector(".ac-where,.ls-says")?.textContent || "").trim();
    const diff = (holder?.querySelector(".ac-diff")?.textContent || "").trim();
    try {
      await comments.create({ anchor: holder?.id || "board-root", text: `${SAID[act]} (${ref})\n\n${what}${diff ? "\n" + diff : ""}`, act, ref });
      mark(act, ref);
    } catch (err) { if (s) { s.textContent = err.message || "Not saved. Try again."; s.className += " bad" } b.disabled = false }
  });
  (async () => {
    try { rdb = window.claude?.use ? await window.claude.use("db") : null } catch { rdb = null }
    try { comments = window.claude?.use ? await window.claude.use("comments") : null } catch { comments = null }
    ready = !!rdb;
    for (const d of days) tally(d);
    if (!comments) for (const b of document.querySelectorAll('.rv-ed [data-act="comment-review"]')) b.hidden = true;
    if (!rdb) { for (const id in box) say(id, "Saving isn't available in this view." + (comments ? " Use Comment instead." : ""), true); return }
    for (const [id, b] of Object.entries(box)) {
      rdb.doc("edits/" + id).onSnapshot(snap => {
        if (!snap.exists) return;
        const v = snap.data() || {};
        if (typeof v.text !== "string") return;
        // A save older than this build was folded into these words by a session: never shown over them.
        if (b.ta.dataset.builtAt && v.at && v.at < b.ta.dataset.builtAt) { say(id, "Your edit saved " + new Date(v.at).toLocaleString() + " is in this version."); return }
        if (b.ta.value !== b.saved || open?.id === id) return; // never over unsaved words
        b.saved = v.text;
        if (b.ta.value !== v.text) { b.ta.value = v.text; draw(id) }
        say(id, "Your edit, saved " + (v.at ? new Date(v.at).toLocaleString() : "") + ".");
        tally(b.day);
      }, () => {});
    }
    // Taps already saved (from this phone or another) show as done.
    try {
      rdb.collection("comments").onSnapshot(snap => {
        const known = new Set(Object.values(ACT));
        for (const d of snap.docs || []) { const v = d.data() || {}; if (known.has(v.act) && v.ref) mark(v.act, v.ref) }
      }, () => {});
    } catch {}
  })();
})();

// The Ideas tab (week_board.py ideas_panel). Krish picks one idea a day; the
// pick is saved at once in picks/<day> and posted as a comment ("PICK <day>",
// the story), because a board's store can only be read from the account that
// owns it and its comments from either of his accounts. A session writes the
// pick onto the pieces through /api/week/options.
(() => {
  const radios = [...document.querySelectorAll("input[data-pick]")];
  if (!radios.length) return;
  const days = [...new Set(radios.map(r => r.dataset.pick))];
  const saved = {}, busy = {};
  let pdb = null, comments = null;
  const hm = at => { try { return new Date(at).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" }) } catch { return "" } };
  const storyOf = r => r.closest(".id-card")?.querySelector(".id-story")?.textContent || "";
  const say = (day, text, bad) => { const s = document.querySelector(`[data-pickstate="${day}"]`); if (s) { s.textContent = text; s.classList.toggle("bad", !!bad) } };
  function render(mode){
    for (const r of radios) {
      const day = r.dataset.pick, v = saved[day];
      const on = busy[day] ? busy[day] === r.value : !!v && v.pick === r.value;
      r.checked = on; r.disabled = mode !== "live" || !!busy[day];
      const l = r.closest("label.pick"); l.classList.toggle("on", on);
      l.querySelector(".t-when").textContent = busy[day] === r.value ? "saving" : on && v && v.at ? "picked " + hm(v.at) : "";
      r.closest(".id-card").classList.toggle("on", on);
    }
    const n = days.filter(d => saved[d]).length;
    const tab = document.querySelector('[data-tabprog="ideas"]');
    if (tab) tab.textContent = mode === "live" ? `${n} of ${days.length} picked` : `pick ${days.length}`;
    if (mode === "off") for (const d of days) say(d, "Picks are not saving in this view. Open it in claude.ai.", true);
    else for (const d of days) if (!busy[d]) say(d, saved[d] ? (window.boardRuntime ? "Your pick is saved for this day's content workflow." : "Your pick is saved. Claude starts this day's piece from it.") : "");
  }
  let mode = "loading";
  render(mode);
  (async () => {
    try { pdb = window.claude?.use ? await window.claude.use("db") : null } catch { pdb = null }
    try { comments = window.claude?.use ? await window.claude.use("comments") : null } catch { comments = null }
    if (!pdb) { mode = "off"; render(mode); return }
    try {
      pdb.collection("picks").onSnapshot(snap => {
        for (const k of Object.keys(saved)) delete saved[k];
        for (const d of snap.docs) if (d.exists && days.includes(d.id)) saved[d.id] = d.data() || {};
        mode = "live"; render(mode);
      }, () => { mode = "broken"; for (const d of days) say(d, "Saved picks could not load. Reload the page to try again.", true) });
    } catch { mode = "broken"; render(mode) }
  })();
  document.addEventListener("change", async e => {
    const r = e.target.closest && e.target.closest("input[data-pick]"); if (!r) return;
    const day = r.dataset.pick;
    if (mode !== "live" || !pdb || busy[day]) { render(mode); return }
    const body = { pick: r.value, idea_id: r.dataset.ideaId || null, series: r.dataset.series, story: storyOf(r), day, at: new Date().toISOString() };
    busy[day] = r.value; say(day, "Saving your pick…"); render(mode);
    let stored = false;
    try { await pdb.doc("picks/" + day).set(body); saved[day] = body; stored = true } catch {}
    if (stored && comments) try {
      const anchor = await comments.anchorFor(r.closest(".id-card"));
      await comments.create({ anchor, text: `PICK ${day} · ${body.pick}${body.idea_id ? " · " + body.idea_id : ""} · ${body.at}\n\n${body.story}` });
    } catch {}
    delete busy[day]; render(mode);
    if (!stored) say(day, "Not saved. Tick it again.", true);
  });
})();

// Triage and the Queue mark on the Ideas tab (week_board.py triage_row). Krish, 2026-10-19: some ideas are good but not
// for this week, so mark them for a queue; "Would I consider this story or angle? If not would I consider it cute or am I
// curious but not convinced for some specific reason". A verdict (story, angle, cute, curious, drop) and the Queue mark
// are saved at once in queue/<pick> and posted as a comment ("QUEUE <pick> <verdict> <reason>"), which either of his
// accounts can read. The next session copies them into the engine's one queue (POST /api/idea-queue with
// decided_by "Krish"); nothing here writes to the engine.
(() => {
  const cards = [...document.querySelectorAll(".id-card[data-pick-card]")];
  if (!cards.length) return;
  const saved = {}, busy = {};
  let qdb = null, comments = null, mode = "loading";
  const card = pid => document.getElementById("idea-" + pid);
  const text = (c, sel) => c.querySelector(sel)?.textContent || "";
  const say = (pid, msg, bad) => { const s = document.querySelector(`[data-tristate="${pid}"]`); if (s) { s.textContent = msg; s.classList.toggle("bad", !!bad) } };
  const label = { story: "Story", angle: "Angle", cute: "Cute", curious: "Curious, not convinced", drop: "Drop" };
  function render(){
    for (const c of cards) {
      const pid = c.dataset.pickCard, v = saved[pid] || {};
      for (const b of c.querySelectorAll("[data-triage]")) {
        const on = v.verdict === b.dataset.triage;
        b.setAttribute("aria-pressed", on ? "true" : "false"); b.classList.toggle("on", on);
        b.disabled = mode !== "live" || !!busy[pid];
      }
      const m = c.querySelector("[data-queue-mark]");
      if (m) { m.checked = !!v.queued; m.disabled = mode !== "live" || !!busy[pid]; m.closest("label").classList.toggle("on", !!v.queued) }
      c.classList.toggle("queued", !!v.queued);
      if (!busy[pid]) say(pid, mode === "off" ? "Triage is not saving in this view. Open it in claude.ai." : v.verdict || v.queued
        ? [v.verdict ? label[v.verdict] : "", v.queued ? "queued" : "", v.reason || v.angle || ""].filter(Boolean).join(" · ") + ". Saved." : "", mode === "off");
    }
  }
  render();
  (async () => {
    try { qdb = window.claude?.use ? await window.claude.use("db") : null } catch { qdb = null }
    try { comments = window.claude?.use ? await window.claude.use("comments") : null } catch { comments = null }
    if (!qdb) { mode = "off"; render(); return }
    try {
      qdb.collection("queue").onSnapshot(snap => {
        for (const k of Object.keys(saved)) delete saved[k];
        for (const d of snap.docs) if (d.exists) saved[d.id] = d.data() || {};
        mode = "live"; render();
      }, () => { mode = "broken"; for (const c of cards) say(c.dataset.pickCard, "Saved triage could not load. Reload the page to try again.", true) });
    } catch { mode = "broken"; render() }
  })();
  async function save(pid, patch){
    if (mode !== "live" || !qdb || busy[pid]) { render(); return }
    const c = card(pid), prev = saved[pid] || {};
    const body = Object.assign({ pick: pid, queued: false, verdict: null, reason: null, angle: null }, prev, patch, {
      so_what: text(c, ".id-sowhat"), story: text(c, ".id-story"), idea_id: c.querySelector("[data-idea-id]")?.dataset.ideaId || null,
      series: c.dataset.series, week: c.dataset.week, day: pid.split("-")[0], at: new Date().toISOString() });
    busy[pid] = true; say(pid, "Saving…"); render();
    let stored = false;
    try { await qdb.doc("queue/" + pid).set(body); saved[pid] = body; stored = true } catch {}
    if (stored && comments) try {
      const anchor = await comments.anchorFor(c);
      await comments.create({ anchor, text: `QUEUE ${pid} ${body.verdict || "none"} ${body.reason || body.angle || ""}`.trim()
        + `\nqueued: ${body.queued ? "yes" : "no"} · series ${body.series} · week ${body.week}${body.idea_id ? " · " + body.idea_id : ""} · ${body.at}\n\n${body.so_what}` });
    } catch {}
    delete busy[pid]; render();
    if (!stored) say(pid, "Not saved. Tap it again.", true);
  }
  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-triage]");
    if (b) {
      const pid = b.dataset.for, v = b.dataset.triage, why = document.querySelector(`[data-why-for="${pid}"]`);
      if (v === "curious" || v === "angle") {
        if (!why) return;
        why.hidden = false; why.dataset.verdict = v;
        const i = why.querySelector("input"); i.placeholder = v === "curious" ? "Why are you not convinced? (for example: it is safer)" : "From which angle would you run it?";
        i.value = ((saved[pid] || {}).verdict === v ? (saved[pid].reason || saved[pid].angle || "") : ""); i.focus();
        return;
      }
      const w = document.querySelector(`[data-why-for="${pid}"]`); if (w) w.hidden = true;
      save(pid, { verdict: v, reason: null, angle: null }); return;
    }
    const s = e.target.closest && e.target.closest('[data-act="save-why"]');
    if (s) {
      const pid = s.dataset.for, why = document.querySelector(`[data-why-for="${pid}"]`), v = why?.dataset.verdict;
      const t = (why?.querySelector("input").value || "").trim();
      if (!t) { say(pid, v === "curious" ? "Say why you are not convinced: that reason is what the engine learns from." : "Say which angle.", true); return }
      why.hidden = true;
      save(pid, v === "curious" ? { verdict: v, reason: t, angle: null } : { verdict: v, angle: t, reason: null });
    }
  });
  document.addEventListener("change", e => {
    const m = e.target.closest && e.target.closest("[data-queue-mark]"); if (!m) return;
    save(m.dataset.queueMark, { queued: m.checked });
  });
})();

// Could combine, on the Queue tab (week_board.py combine_card). Krish, 2026-10-21: queued ideas that would make one
// bigger piece are shown together, and nothing is combined without his word. His Combine tap is saved at once in
// queue/combine-<n> ({ combine: true, members, pick }) and posted as a comment ("COMBINE combine-<n> ..."); the next
// session runs synthesize on it with decided_by "Krish". Nothing here writes to the engine.
(() => {
  const cards = [...document.querySelectorAll(".q-combo[data-combine]")];
  if (!cards.length) return;
  const saved = {}, busy = {};
  let qdb = null, comments = null, mode = "loading";
  const say = (cid, msg, bad) => { const s = document.querySelector(`[data-combinestate="${cid}"]`); if (s) { s.textContent = msg; s.classList.toggle("bad", !!bad) } };
  function render(){
    for (const c of cards) {
      const cid = c.dataset.combine, on = !!(saved[cid] && saved[cid].combine);
      const b = c.querySelector('[data-act="combine"]');
      if (b) { b.disabled = mode !== "live" || on || !!busy[cid]; b.textContent = on ? "Combine asked" : "Combine these" }
      c.classList.toggle("on", on);
      if (!busy[cid]) say(cid, mode === "off" ? "Combine is not saving in this view. Open the board in a browser." : on
        ? "You asked to combine these. Claude writes them up as one piece next session. Saved." : "", mode === "off");
    }
  }
  render();
  (async () => {
    try { qdb = window.claude?.use ? await window.claude.use("db") : null } catch { qdb = null }
    try { comments = window.claude?.use ? await window.claude.use("comments") : null } catch { comments = null }
    if (!qdb) { mode = "off"; render(); return }
    try {
      qdb.collection("queue").onSnapshot(snap => {
        for (const k of Object.keys(saved)) delete saved[k];
        for (const d of snap.docs) if (d.exists && /^combine-\d+$/.test(d.id)) saved[d.id] = d.data() || {};
        mode = "live"; render();
      }, () => { mode = "broken"; for (const c of cards) say(c.dataset.combine, "Saved choices could not load. Reload the page to try again.", true) });
    } catch { mode = "broken"; render() }
  })();
  document.addEventListener("click", async e => {
    const b = e.target.closest && e.target.closest('[data-act="combine"]'); if (!b) return;
    const cid = b.dataset.for, c = document.getElementById(cid);
    if (!c || mode !== "live" || !qdb || busy[cid]) { render(); return }
    const body = { combine: true, members: (c.dataset.members || "").split(",").filter(Boolean), pick: cid, at: new Date().toISOString() };
    busy[cid] = true; say(cid, "Saving…"); render();
    let stored = false;
    try { await qdb.doc("queue/" + cid).set(body); saved[cid] = body; stored = true } catch {}
    if (stored && comments) try {
      const anchor = await comments.anchorFor(c);
      await comments.create({ anchor, text: `COMBINE ${cid} ${body.members.join(" ")}\n${body.at}\n\n${c.querySelector(".q-sowhat")?.textContent || ""}` });
    } catch {}
    delete busy[cid]; render();
    if (!stored) say(cid, "Not saved. Tap Combine again.", true);
  });
})();
