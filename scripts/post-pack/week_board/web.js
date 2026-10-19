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
  const navigation = document.createElement('nav');
  navigation.setAttribute('aria-label', 'Publishing weeks');
  navigation.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin:0 auto;padding:16px 16px 12px;max-width:820px;border-bottom:1px solid #b5b4aa';
  function showWeeks(weeks) {
    navigation.replaceChildren();
    for (const date of [...new Set([week, ...weeks])].sort()) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const link = document.createElement('a'); link.href = `/board/${date}`;
      link.textContent = 'Week of ' + new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', {day:'numeric',month:'short',timeZone:'UTC'});
      link.style.cssText = 'display:inline-flex;align-items:center;min-height:44px;padding:8px 16px;border:1px solid #222;border-radius:8px;color:#171b19;text-decoration:none;font-weight:700;box-sizing:border-box;background:' + (date === week ? '#c8f4de' : '#f7f6ef');
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
    const message = document.createElement('span'); message.setAttribute('role','status');
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

  const anchorFor = async element => {
    const target = element?.closest("[id]") || element?.querySelector("[id]");
    return target?.id || "board-root";
  };
  let dialog, list, editor, status, anchor = "board-root", replyTo = null;
  function renderComments() {
    if (!dialog?.open) return;
    list.replaceChildren();
    const all = [...(states.get("comments")?.entries() || [])];
    const roots = all.filter(([id, d]) => d.body.thread_id === id && (anchor === "board-root" || d.body.anchor === anchor));
    roots.sort((a,b) => String(a[1].body.at).localeCompare(String(b[1].body.at)));
    for (const [id, d] of roots) {
      const section = document.createElement("section"); section.style.cssText = "padding:12px 0;border-bottom:1px solid #888";
      const title = document.createElement("strong"); title.textContent = d.body.anchor; section.append(title);
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
        const p = document.createElement("p"); p.style.whiteSpace = "pre-wrap"; p.textContent = entry.body.text; section.append(p);
      }
      const reply = document.createElement("button"); reply.type = "button"; reply.textContent = "Reply";
      reply.onclick = () => { replyTo = id; status.textContent = `Replying to ${d.body.anchor}`; editor.focus() }; section.append(reply); list.append(section);
    }
    if (!roots.length) { const p = document.createElement("p"); p.textContent = "No comments yet."; list.append(p) }
  }
  const comments = {
    anchorFor,
    create: async ({ anchor: a, text }) => {
      const id = crypto.randomUUID();
      await doc("comments", id).set({ thread_id: id, anchor: a, text, at: new Date().toISOString() }); return { threadId: id };
    },
    reply: async (threadId, text) => {
      if (!states.has("comments")) await refresh("comments");
      const parent = states.get("comments").get(threadId);
      if (!parent) throw new Error("Thread not found");
      await doc("comments", crypto.randomUUID()).set({ thread_id: threadId, anchor: parent.body.anchor, text, at: new Date().toISOString() });
    },
    openComposer: async ({ element } = {}) => {
      anchor = await anchorFor(element); replyTo = null;
      if (!dialog) {
        dialog = document.createElement("dialog"); dialog.setAttribute("aria-label", "Board comments");
        dialog.style.cssText = "width:min(620px,92vw);max-height:85dvh;padding:20px;border:1px solid #888;border-radius:12px;overflow:auto";
        const heading = document.createElement("h2"); heading.textContent = "Comments";
        const close = document.createElement("button"); close.textContent = "Close"; close.onclick = () => dialog.close();
        list = document.createElement("div"); editor = document.createElement("textarea"); editor.setAttribute("aria-label", "Your comment"); editor.rows = 5; editor.maxLength = 30000; editor.style.cssText = "width:100%;box-sizing:border-box;margin-top:12px";
        status = document.createElement("p"); status.setAttribute("role", "status");
        const save = document.createElement("button"); save.textContent = "Save comment";
        save.onclick = async () => {
          const text = editor.value.trim(); if (!text) { status.textContent = "Write a comment first."; return }
          save.disabled = true;
          try { if (replyTo) await comments.reply(replyTo, text); else await comments.create({ anchor, text }); if (editor.value.trim() === text) editor.value = ""; replyTo = null; status.textContent = "Comment saved."; renderComments() }
          catch (e) { status.textContent = e.message } finally { save.disabled = false }
        };
        dialog.append(heading, close, list, editor, save, status); document.body.append(dialog);
        subscribe("comments", null, renderComments, e => { status.textContent = e.message });
      }
      status.textContent = ""; dialog.showModal(); renderComments(); editor.focus();
    }
  };
  const button = document.createElement("button"); button.type = "button"; button.textContent = "Comments";
  button.onclick = () => comments.openComposer();
  (document.querySelector(".wk-week") || document.querySelector("header") || document.body).append(button);
  const downloads = { save: async ({ filename, data }) => {
    const a = document.createElement("a"); a.href = URL.createObjectURL(data); a.download = filename;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } };
  window.boardRuntime = { use: async name => ({ db, comments, downloads })[name] || null };
})();
