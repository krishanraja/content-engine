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
async function pngBlob(src){ return (await fetch(src)).blob() }
async function copyImage(src){
  try { await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob(src) })]); return "clipboard" } catch {}
  return viaCommand(`<img src="${src}">`, "") ? "command" : "failed";
}
let downloads = null;
(async () => { try { downloads = window.claude?.use ? await window.claude.use("downloads") : null } catch { downloads = null } })();
async function download(src, name){
  const blob = await pngBlob(src);
  if (downloads) { try { await downloads.save({ filename: name, data: blob }); toast("Saved"); return } catch (e) { if (e && e.code === "declined") return } }
  if (window.claude) { toast("Saving is not available in this view. Use Copy picture."); return }
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
      () => said("Links saved " + hhmm(body.at) + ".", false),
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
          if (p.timer || document.activeElement === el) continue; // never overwrite what is being typed
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
function fromHash(){
  const h = decodeURIComponent((location.hash || "").slice(1));
  if (!h) return false;
  if (tabs.some(t => t.dataset.day === h)) { select(h, { top: true }); return true }
  for (const p in PREFIX) if (h.startsWith(p)) { select(PREFIX[p]); const el = document.getElementById(h); if (el) el.scrollIntoView(); return true }
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
