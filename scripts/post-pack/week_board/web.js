// Web capability adapter. The board renderer and artifact runtime stay shared.
(() => {
  const week = __WEB_WEEK__;
  const root = `/api/board/${week}`;
  const states = new Map();
  const subscribers = new Map();
  const pending = new Map();
  const editing = new Map();
  const inputVersions = new Map();
  const unsaved = () => !!document.querySelector('[data-unsaved="true"]') || !!editor?.value.trim();
  let leavingConfirmed = false;
  window.addEventListener('beforeunload', e => { if (!leavingConfirmed && unsaved()) { e.preventDefault(); e.returnValue = ''; } });
  // The week links and the comments sheet take the board's own colours (its :root tokens), light or dark, and on a
  // phone the comments open as a sheet from the bottom. One stylesheet, here, so no element carries its own look.
  const look = document.createElement('style');
  look.textContent = [
    '.wb-weeks{display:flex;flex-wrap:wrap;gap:8px;margin:0 auto;padding:16px 16px 12px;max-width:820px;border-bottom:1px solid var(--line,#b5b4aa)}',
    '.wb-week{display:inline-flex;align-items:center;min-height:44px;padding:8px 16px;border:1px solid var(--line,#222);border-radius:999px;color:var(--ink,#171b19);text-decoration:none;font:700 14px Archivo,system-ui,sans-serif;background:var(--card,#f7f6ef)}',
    '.wb-week[aria-current=page]{background:var(--ink,#171b19);color:var(--bg,#fff);border-color:var(--ink,#171b19)}',
    '.wb-note{font-size:13px;color:var(--muted,#555);align-self:center}',
    '.wb-comments{display:inline-flex;align-items:center;min-height:44px;padding:8px 16px;border-radius:999px;border:1px solid var(--mint,#7EF0C0);background:var(--mint,#7EF0C0);color:#0C1512;font:700 13px Archivo,system-ui,sans-serif;cursor:pointer}',
    '.wb-sheet{width:min(620px,92vw);max-height:85dvh;padding:20px;border:1px solid var(--line,#888);border-radius:16px;overflow:auto;background:var(--card,#fff);color:var(--ink,#111)}',
    '.wb-sheet::backdrop{background:rgba(12,21,18,.45)}',
    '.wb-sheet h2{font:400 26px/1.05 Anton,Impact,sans-serif;text-transform:uppercase;margin:0 0 8px}',
    '.wb-sheet button{min-height:44px;padding:8px 16px;border-radius:999px;border:1px solid var(--line,#888);background:transparent;color:inherit;font:700 14px Archivo,system-ui,sans-serif;cursor:pointer;margin:6px 6px 0 0}',
    '.wb-sheet .wb-save{background:var(--mint,#7EF0C0);border-color:var(--mint,#7EF0C0);color:#0C1512}',
    '.wb-sheet textarea{width:100%;box-sizing:border-box;margin-top:12px;min-height:120px;padding:12px;border:1px solid var(--line,#888);border-radius:10px;background:var(--bg,#fff);color:inherit;font:16px/1.5 system-ui,sans-serif}',
    '.wb-quote{margin:10px 0 0;padding:6px 12px;border-left:3px solid var(--mint,#7EF0C0);color:var(--muted,#555);font:15px/1.45 system-ui,sans-serif;white-space:pre-wrap}',
    '.wb-thread{padding:12px 0;border-bottom:1px solid var(--line,#888)}.wb-thread small{display:block;margin-top:6px;color:var(--muted,#555)}.wb-thread p{white-space:pre-wrap;margin:4px 0}',
    '@media (max-width:640px){.wb-sheet{width:100%;max-width:100%;margin:auto 0 0;border-radius:16px 16px 0 0;max-height:90dvh;padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px))}}'
  ].join('\n');
  document.head.append(look);
  const navigation = document.createElement('nav');
  navigation.setAttribute('aria-label', 'Publishing weeks');
  navigation.className = 'wb-weeks';
  function showWeeks(weeks) {
    navigation.replaceChildren();
    for (const date of [...new Set([week, ...weeks])].sort()) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const link = document.createElement('a'); link.href = `/board/${date}`;
      link.textContent = 'Week of ' + new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', {day:'numeric',month:'short',timeZone:'UTC'});
      link.className = 'wb-week';
      if (date === week) link.setAttribute('aria-current', 'page');
      link.onclick = e => {
        if (date === week) { e.preventDefault(); return; }
        if (unsaved()) {
          if (!window.confirm('You have unsaved words. Leave this week and discard them?')) { e.preventDefault(); return; }
          leavingConfirmed = true;
        }
      };
      navigation.append(link);
    }
  }
  showWeeks([]);
  const heading = document.querySelector('.wk-top');
  if (heading) heading.before(navigation); else document.body.prepend(navigation);
  fetch('/api/board/weeks', {credentials:'same-origin',cache:'no-store'}).then(async response => {
    const data = await response.json();
    if (!response.ok || !data.ok || !Array.isArray(data.weeks)) throw new Error('weeks_unavailable');
    showWeeks(data.weeks);
  }).catch(() => {
    const message = document.createElement('span'); message.setAttribute('role','status'); message.className = 'wb-note';
    message.textContent = 'Other weeks could not be loaded. Reload to try again.'; navigation.append(message);
  });
  async function request(path, options = {}) {
    const response = await fetch(root + path, { credentials: "same-origin", cache: "no-store", ...options });
    const body = await response.json();
    if (!response.ok || !body.ok) {
      const error = new Error(response.status === 409 ? "This changed in another session. Review the latest version and try again." : response.status === 401 ? "Unlock the board again, then retry." : "Not saved. Please try again.");
      error.status = response.status; error.current = body; throw error;
    }
    return body;
  }
  function snapshot(id, row) { return { id, exists: !!row, data: () => row?.body || {} } }
  function emit(collection) {
    const rows = states.get(collection);
    for (const sub of subscribers.get(collection) || []) {
      if (sub.id) sub.next(snapshot(sub.id, rows.get(sub.id)));
      else sub.next({ docs: [...rows].map(([id, row]) => snapshot(id, row)) });
    }
  }
  async function refresh(collection) {
    if (pending.has(collection)) return pending.get(collection);
    const promise = (async () => {
      try {
        const data = await request(`/${collection}`);
        while (data.next_offset !== null && data.next_offset !== undefined) {
          const page = await request(`/${collection}?offset=${data.next_offset}`);
          data.documents.push(...page.documents); data.next_offset = page.next_offset;
        }
        const previous = states.get(collection) || new Map();
        // Records are never deleted. Retain a successful local creation when a
        // refresh that started before its save does not yet include it.
        const merged = new Map(previous);
        for (const d of data.documents) if ((previous.get(d.id)?.revision || 0) <= d.revision) merged.set(d.id, d);
        states.set(collection, merged);
        emit(collection);
      } catch (e) { for (const sub of subscribers.get(collection) || []) sub.error?.(e); throw e }
      finally { pending.delete(collection) }
    })();
    pending.set(collection, promise); return promise;
  }
  function subscribe(collection, id, next, error) {
    const list = subscribers.get(collection) || new Set(); subscribers.set(collection, list);
    const sub = { id, next, error }; list.add(sub);
    if (states.has(collection)) emit(collection);
    refresh(collection).catch(() => {});
    return () => list.delete(sub);
  }
  function doc(collection, id) {
    return {
      onSnapshot: (next, error) => subscribe(collection, id, next, error),
      set: async body => {
        if (!states.has(collection)) await refresh(collection);
        const current = states.get(collection).get(id);
        const key = `${collection}/${id}`;
        const inputVersion = inputVersions.get(key) || 0;
        try {
          const result = await request(`/${collection}/${encodeURIComponent(id)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body, revision: editing.get(key) ?? current?.revision ?? 0 }) });
          // Typing may continue while a save response is in flight. Its new
          // words are based on our successful save, not a later poll result.
          if ((inputVersions.get(key) || 0) === inputVersion) editing.delete(key);
          else editing.set(key, result.revision);
          states.get(collection).set(id, { body: result.body, revision: result.revision }); emit(collection);
        } catch (e) {
          if (e.status === 409) {
            await refresh(collection).catch(() => {});
            const saved = e.current?.body;
            if (window.confirm("This changed in another session. The saved value is:\n\n" + JSON.stringify(saved, null, 2) + "\n\nReplace it with your change? Cancel keeps your unsaved words.")) {
              editing.set(key, e.current.revision); return doc(collection, id).set(body);
            }
          }
          throw e;
        }
      }
    };
  }
  const db = {
    collection: name => ({ doc: id => doc(name, id), onSnapshot: (next, error) => subscribe(name, null, next, error) }),
    doc: path => { const [collection, id] = path.split("/"); return doc(collection, id) }
  };
  const refreshAll = () => { if (!document.hidden) for (const c of subscribers.keys()) refresh(c).catch(() => {}) };
  setInterval(refreshAll, 5000); window.addEventListener("focus", refreshAll);
  document.addEventListener("visibilitychange", refreshAll);
  // Preserve unsubmitted edits after blur as well as while a field has focus.
  document.addEventListener("input", e => {
    const field = e.target;
    let key;
    if (field.matches("textarea[data-review-id]")) { field.dataset.unsaved = "true"; key = `edits/${field.dataset.reviewId}` }
    else if (field.id?.endsWith("link-article") || field.id?.endsWith("link-youtube")) { field.dataset.unsaved = "true"; key = `links/${field.closest('[data-day]')?.dataset.day}` }
    if (key) {
      inputVersions.set(key, (inputVersions.get(key) || 0) + 1);
      if (!editing.has(key)) { const [c,id] = key.split('/'); editing.set(key, states.get(c)?.get(id)?.revision || 0) }
    }
  });

  // The id a comment is pinned to. With pick (the Drafts editor), also where in which draft and the words he picked:
  // {anchor, box, paragraph, quote}, so a comment on a sentence can be found again after the words move.
  const anchorFor = async (element, pick) => {
    const target = element?.closest("[id]") || element?.querySelector("[id]");
    const id = target?.id || "board-root";
    if (!pick) return id;
    const out = { anchor: id };
    const box = pick.box || element?.closest?.("[data-review]")?.dataset.review;
    if (box) out.box = box;
    if (Number.isInteger(pick.paragraph) && pick.paragraph >= 0) out.paragraph = pick.paragraph;
    if (pick.quote) out.quote = String(pick.quote).slice(0, 2000);
    return out;
  };
  // Optional fields a comment may carry (api/board/_contracts.ts checks each).
  const EXTRA = ["box", "paragraph", "quote", "act", "ref"];
  const extra = fields => Object.fromEntries(EXTRA.filter(k => fields?.[k] !== undefined && fields[k] !== null && fields[k] !== "").map(k => [k, fields[k]]));
  let dialog, list, editor, status, quoted, anchor = "board-root", pinned = {}, replyTo = null;
  function renderComments() {
    if (!dialog?.open) return;
    list.replaceChildren();
    const all = [...(states.get("comments")?.entries() || [])];
    const roots = all.filter(([id, d]) => d.body.thread_id === id && (anchor === "board-root" || d.body.anchor === anchor));
    roots.sort((a,b) => String(a[1].body.at).localeCompare(String(b[1].body.at)));
    for (const [id, d] of roots) {
      const section = document.createElement("section"); section.className = "wb-thread";
      const title = document.createElement("strong");
      title.textContent = d.body.anchor === "board-root" ? "Whole board"
        : Number.isInteger(d.body.paragraph) && d.body.box ? `Paragraph ${d.body.paragraph + 1} of ${d.body.box}` : d.body.anchor;
      section.append(title);
      if (d.body.quote) { const q = document.createElement("blockquote"); q.className = "wb-quote"; q.textContent = d.body.quote; section.append(q) }
      const original = d.body.original_metadata || {};
      const threadState = document.createElement("span");
      threadState.textContent = original.resolved || original.thread_status?.resolved ? " · Resolved in source" : " · Open";
      section.append(threadState);
      if (d.body.anchor === 'board-root' && original.location) {
        const location = document.createElement('p'); location.textContent = 'Original location: ' + original.location; section.append(location);
      }
      for (const [, entry] of [ [id,d], ...all.filter(([rid,r]) => rid !== id && r.body.thread_id === id).sort((a,b) => String(a[1].body.at).localeCompare(String(b[1].body.at))) ]) {
        const metadata = entry.body.original_metadata || {};
        const byline = document.createElement('small');
        byline.textContent = [metadata.author_display || metadata.author_label || 'Krish', metadata.at_as_reported || entry.body.at].filter(Boolean).join(' · ');
        section.append(byline);
        const p = document.createElement("p"); p.textContent = entry.body.text; section.append(p);
      }
      const reply = document.createElement("button"); reply.type = "button"; reply.textContent = "Reply";
      reply.onclick = () => { replyTo = id; status.textContent = `Replying to ${d.body.anchor}`; editor.focus() }; section.append(reply); list.append(section);
    }
    if (!roots.length) { const p = document.createElement("p"); p.textContent = "No comments yet."; list.append(p) }
  }
  const comments = {
    anchorFor,
    create: async ({ anchor: a, text, ...fields }) => {
      const id = crypto.randomUUID();
      const where = typeof a === "object" && a ? a : { anchor: a };
      await doc("comments", id).set({ thread_id: id, anchor: where.anchor, text, at: new Date().toISOString(), ...extra({ ...where, ...fields }) });
      return { threadId: id };
    },
    reply: async (threadId, text) => {
      if (!states.has("comments")) await refresh("comments");
      const parent = states.get("comments").get(threadId);
      if (!parent) throw new Error("Thread not found");
      await doc("comments", crypto.randomUUID()).set({ thread_id: threadId, anchor: parent.body.anchor, text, at: new Date().toISOString() });
    },
    openComposer: async ({ element, box, paragraph, quote } = {}) => {
      const where = await anchorFor(element, { box, paragraph, quote });
      anchor = where.anchor; pinned = extra(where); delete pinned.anchor; replyTo = null;
      if (!dialog) {
        dialog = document.createElement("dialog"); dialog.setAttribute("aria-label", "Board comments");
        dialog.className = "wb-sheet";
        const heading = document.createElement("h2"); heading.textContent = "Comments";
        const close = document.createElement("button"); close.textContent = "Close"; close.onclick = () => dialog.close();
        list = document.createElement("div"); editor = document.createElement("textarea"); editor.setAttribute("aria-label", "Your comment"); editor.rows = 5; editor.maxLength = 30000;
        status = document.createElement("p"); status.setAttribute("role", "status");
        quoted = document.createElement("blockquote"); quoted.className = "wb-quote"; quoted.hidden = true;
        const save = document.createElement("button"); save.textContent = "Save comment"; save.className = "wb-save";
        save.onclick = async () => {
          const text = editor.value.trim(); if (!text) { status.textContent = "Write a comment first."; return }
          save.disabled = true;
          try { if (replyTo) await comments.reply(replyTo, text); else await comments.create({ anchor, text, ...pinned }); if (editor.value.trim() === text) editor.value = ""; replyTo = null; status.textContent = "Comment saved."; renderComments() }
          catch (e) { status.textContent = e.message } finally { save.disabled = false }
        };
        dialog.append(heading, close, list, quoted, editor, save, status); document.body.append(dialog);
        subscribe("comments", null, renderComments, e => { status.textContent = e.message });
      }
      quoted.textContent = pinned.quote ? `On: ${pinned.quote}` : ""; quoted.hidden = !pinned.quote;
      status.textContent = ""; dialog.showModal(); renderComments(); editor.focus();
    }
  };
  const button = document.createElement("button"); button.type = "button"; button.textContent = "Comments"; button.className = "wb-comments";
  button.onclick = () => comments.openComposer();
  (document.querySelector(".wk-week") || document.querySelector("header") || document.body).append(button);
  const downloads = { save: async ({ filename, data }) => {
    const a = document.createElement("a"); a.href = URL.createObjectURL(data); a.download = filename;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } };
  window.boardRuntime = { use: async name => ({ db, comments, downloads })[name] || null };
})();
