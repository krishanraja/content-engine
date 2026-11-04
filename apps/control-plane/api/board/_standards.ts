import type { SupabaseClient } from '@supabase/supabase-js'
import { decideLearningProposal, parseLearningDecision } from '../_learningDecision.js'

// The standards page (/standards and /board/standards, api/board op standards): the rejection floor's 215 standards in
// about 20 decisions (Krish, 2026-11-04: "group the 215 floor standards for my approval"). Each group is one proposal
// in mindmake_studio_learning_proposals (taste_floor_groups, seeded by scripts/floor_group.py); his Approve, Reword or
// Reject goes through the same decision write as POST /api/video-studio/learning-proposals (_learningDecision.ts), on
// the board's own login, and every member standard takes it in public.taste_floor. The page never decides anything
// itself, and only his login may press (the operator's key reads it and is refused a press).

export const STANDARDS_VENTURE = 'publication'

export type StandardsQuote = { said: string; on?: string | null }
export type StandardsMember = { id: string; never_beneath?: string | null; check?: string | null; weight?: string | null; productions?: number | null }
export type StandardsGroup = {
  key: string
  title: string
  never_beneath: string
  check_text: string
  proposal_id: string | null
  members: number
  productions: number
  quotes: StandardsQuote[]
  standards: StandardsMember[]
  decision: { status: string; note: string | null; decided_at: string | null } | null
}

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown) => typeof v === 'string' ? v : ''
const count = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0

export class StandardsError extends Error { constructor(public status: number, message: string) { super(message) } }

/** The groups as the page shows them, most productions first, each with his decision when he has made it. */
export async function readStandards(db: SupabaseClient): Promise<StandardsGroup[]> {
  const groups = await db.from('taste_floor_groups')
    .select('key, title, never_beneath, check_text, member_fingerprints, card, proposal_id')
    .eq('venture', STANDARDS_VENTURE)
  if (groups.error) throw new StandardsError(503, 'standards_store_unavailable')
  const rows = (groups.data || []) as Record<string, unknown>[]
  const ids = rows.map(r => text(r.proposal_id)).filter(Boolean)
  const decided = new Map<string, { status: string; note: string | null; decided_at: string | null }>()
  if (ids.length) {
    const props = await db.from('mindmake_studio_learning_proposals').select('id, status, decision_note, decided_at').in('id', ids)
    if (props.error) throw new StandardsError(503, 'standards_store_unavailable')
    for (const p of (props.data || []) as Record<string, unknown>[]) {
      decided.set(text(p.id), { status: text(p.status), note: text(p.decision_note) || null, decided_at: text(p.decided_at) || null })
    }
  }
  const out = rows.map(r => {
    const card = object(r.card) ? r.card : {}
    const fingerprints = Array.isArray(r.member_fingerprints) ? r.member_fingerprints : []
    const quotes = (Array.isArray(card.quotes) ? card.quotes : []).filter(object)
      .map(q => ({ said: text(q.said), on: text(q.on) || null })).filter(q => q.said)
    const standards = (Array.isArray(card.members) ? card.members : []).filter(object)
      .map(m => ({ id: text(m.id), never_beneath: text(m.never_beneath) || null, check: text(m.check) || null,
        weight: text(m.weight) || null, productions: count(m.productions) }))
    const d = decided.get(text(r.proposal_id))
    return {
      key: text(r.key), title: text(r.title), never_beneath: text(r.never_beneath), check_text: text(r.check_text),
      proposal_id: text(r.proposal_id) || null,
      members: count(card.standards) || fingerprints.length,
      productions: count(card.productions),
      quotes, standards,
      decision: d && d.status !== 'proposed' ? d : null,
    }
  })
  return out.sort((a, b) => b.productions - a.productions || b.members - a.members || a.key.localeCompare(b.key))
}

/** His press on one group: only a proposal that is a floor group's, and only once. */
export async function decideStandard(db: SupabaseClient, raw: unknown) {
  const parsed = parseLearningDecision(raw)
  if ('code' in parsed) return { status: parsed.status, body: { ok: false, error: parsed.code } }
  const group = await db.from('taste_floor_groups').select('key').eq('proposal_id', parsed.id).maybeSingle()
  if (group.error) return { status: 503, body: { ok: false, error: 'standards_store_unavailable' } }
  if (!group.data) return { status: 404, body: { ok: false, error: 'not_a_floor_group' } }
  const decided = await decideLearningProposal(db, parsed)
  if ('code' in decided) return { status: decided.status, body: { ok: false, error: decided.code } }
  return { status: 200, body: { ok: true, key: (group.data as { key: string }).key, proposal: decided.proposal } }
}

const E = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`
const day = (iso?: string | null) => {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isFinite(t) ? new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : ''
}
const LABEL: Record<string, string> = { approved: 'Approved', corrected: 'Reworded', rejected: 'Rejected', superseded: 'Replaced' }

function card(g: StandardsGroup, i: number) {
  const status = g.decision?.status || 'proposed'
  const quotes = g.quotes.map(q => `<blockquote><p>${E(q.said)}</p>${q.on ? `<cite>${E(day(q.on))}</cite>` : ''}</blockquote>`).join('')
  const members = g.standards.map(m => `<li><p>${E(m.never_beneath)}</p>${m.check ? `<p class="m-check"><span>Check</span> ${E(m.check)}</p>` : ''}</li>`).join('')
  const decided = g.decision
    ? `<div class="verdict v-${E(status)}"><b>${E(LABEL[status] || status)}</b>${g.decision.decided_at ? ` · ${E(day(g.decision.decided_at))}` : ''}`
      + `${status === 'corrected' && g.decision.note ? `<p class="his">In your words: ${E(g.decision.note)}</p>` : ''}</div>`
    : ''
  const actions = g.decision || !g.proposal_id ? '' : `
    <div class="acts">
      <button type="button" class="btn go" data-act="approved">Approve</button>
      <button type="button" class="btn" data-act="reword">Reword</button>
      <button type="button" class="btn ghost" data-act="rejected">Reject</button>
    </div>
    <form class="reword" hidden>
      <label for="w-${E(g.key)}">Your words for this standard</label>
      <textarea id="w-${E(g.key)}" name="krish" rows="3" maxlength="600" required placeholder="Say it the way you want it held"></textarea>
      <div class="acts"><button type="submit" class="btn go">Save my words</button><button type="button" class="btn ghost" data-act="cancel">Cancel</button></div>
    </form>
    <p class="st" role="status"></p>`
  return `<article class="std${g.decision ? ' done' : ''}" id="g-${E(g.key)}" data-key="${E(g.key)}" data-id="${E(g.proposal_id || '')}" data-status="${E(status)}">
  <div class="meta"><span class="n">${i + 1}</span><span>${E(plural(g.members, 'standard'))} · ${E(plural(g.productions, 'production'))}</span><span class="pill p-${E(status)}">${E(LABEL[status] || 'Waiting')}</span></div>
  <h2>${E(g.title)}</h2>
  <p class="never"><span class="lbl">Never beneath</span>${E(g.never_beneath)}</p>
  <p class="chk"><span class="lbl">The check</span>${E(g.check_text)}</p>
  ${quotes ? `<div class="quotes"><div class="lbl">What you said</div>${quotes}</div>` : ''}
  ${members ? `<details><summary>The ${E(plural(g.standards.length, 'standard'))} in this group</summary><ol>${members}</ol></details>` : ''}
  ${decided}${actions}
</article>`
}

const CSS = `
:root{--bg:#F4EFE4;--ink:#0C1512;--card:#fffdf8;--line:#d9d2c3;--muted:#5b625e;--mint:#7EF0C0;--ok:#1f7a52;--bad:#b0412e;--soft:#e3ddcf;--mono:"IBM Plex Mono",ui-monospace,monospace}
@media (prefers-color-scheme:dark){:root{--bg:#0C1512;--ink:#F4EFE4;--card:#15201b;--line:#2b3832;--muted:#a9b4ae;--soft:#22302a;--ok:#7EF0C0;--bad:#f08a72}}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--ink);font:400 16px/1.45 Archivo,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit}
.wrap{max-width:820px;margin:0 auto;padding:24px 16px 64px}
.kick{font:600 12px/1.2 var(--mono);text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
h1{font:400 44px/1 Anton,Impact,sans-serif;text-transform:uppercase;letter-spacing:.01em;margin:8px 0 10px}
.lead{max-width:62ch;color:var(--ink)}
.top{display:flex;justify-content:space-between;gap:12px;align-items:baseline;flex-wrap:wrap}
.top a{font:600 13px/1 var(--mono);text-underline-offset:3px}
.bar{margin:18px 0 22px;display:flex;align-items:center;gap:12px;font:600 12px/1 var(--mono);color:var(--muted)}
.bar i{flex:1;height:8px;border-radius:99px;background:var(--soft);overflow:hidden}
.bar i b{display:block;height:100%;background:var(--mint)}
.std{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:18px;margin-bottom:14px}
.std.done{opacity:.92}
.meta{display:flex;align-items:center;gap:10px;font:500 12px/1 var(--mono);color:var(--muted);flex-wrap:wrap}
.meta .n{font:400 20px/1 Anton,sans-serif;color:var(--ink)}
.pill{margin-left:auto;font:700 10.5px/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;padding:6px 9px;border-radius:99px;background:var(--soft);color:var(--ink)}
.p-approved{background:var(--mint);color:#0C1512}.p-corrected{background:#ffe59a;color:#0C1512}.p-rejected{background:#f3c9bd;color:#0C1512}
h2{font:400 28px/1.05 Anton,Impact,sans-serif;text-transform:uppercase;letter-spacing:.01em;margin:10px 0 12px}
.lbl{display:block;font:700 11px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:5px}
.never{font-weight:700;margin-bottom:12px}
.chk{color:var(--ink);margin-bottom:14px}
.quotes{border-top:1px solid var(--line);padding-top:12px;margin-bottom:12px}
blockquote{border-left:3px solid var(--mint);padding:2px 0 2px 12px;margin:8px 0}
blockquote p{font-style:italic}
cite{display:block;font:500 11.5px/1.3 var(--mono);color:var(--muted);font-style:normal;margin-top:3px}
details{border-top:1px solid var(--line);padding-top:10px;margin-bottom:12px}
summary{cursor:pointer;font:600 13px/1.4 var(--mono);min-height:44px;display:flex;align-items:center}
details ol{padding-left:22px;display:grid;gap:10px;margin-top:6px}
details li p{font-size:14.5px}
.m-check{color:var(--muted);margin-top:3px}.m-check span{font:700 10.5px/1 var(--mono);text-transform:uppercase;letter-spacing:.06em}
.acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
.btn{min-width:112px;height:44px;padding:0 16px;border-radius:12px;border:1.5px solid var(--ink);background:var(--card);color:var(--ink);font:700 14px/1 Archivo,sans-serif;cursor:pointer}
.btn.go{background:var(--mint);border-color:var(--mint);color:#0C1512}
.btn.ghost{background:transparent}
.btn[disabled]{opacity:.45;cursor:default}
.reword{margin-top:12px}
.reword label{display:block;font:700 11px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}
textarea{width:100%;border:1.5px solid var(--line);border-radius:10px;background:var(--bg);color:var(--ink);padding:12px;font:400 15px/1.4 Archivo,sans-serif;resize:vertical}
textarea:focus{outline:2px solid var(--ok);outline-offset:1px}
.st{min-height:18px;margin-top:8px;font:600 12px/1.3 var(--mono);color:var(--muted)}.st.bad{color:var(--bad)}
.verdict{margin-top:6px;padding:10px 12px;border-radius:12px;background:var(--soft);font-size:14.5px}
.verdict .his{margin-top:6px;font-style:italic}
.empty{padding:24px;border:1px dashed var(--line);border-radius:18px;color:var(--muted)}
@media (max-width:519px){h1{font-size:36px}h2{font-size:24px}.std{padding:14px}.btn{flex:1 1 0;min-width:0}}
`

const SCRIPT = `
(function(){
  var LABEL={approved:'Approved',corrected:'Reworded',rejected:'Rejected'};
  function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function progress(){
    var all=document.querySelectorAll('.std').length,done=document.querySelectorAll('.std.done').length;
    var t=document.querySelector('[data-progress]');if(t)t.textContent=done+' of '+all+' decided';
    var b=document.querySelector('[data-progress-bar]');if(b)b.style.width=(all?Math.round(100*done/all):0)+'%';
  }
  function press(card,decision,words){
    var st=card.querySelector('.st'),btns=card.querySelectorAll('button');
    btns.forEach(function(b){b.disabled=true});st.className='st';st.textContent='Saving';
    var body={id:card.getAttribute('data-id'),decision:decision};if(words)body.krish=words;
    fetch(location.pathname,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      .then(function(r){return r.json().catch(function(){return {ok:false,error:'unreadable'}}).then(function(j){return {status:r.status,j:j}})})
      .then(function(x){
        if(x.j&&x.j.ok){
          card.classList.add('done');card.setAttribute('data-status',decision);
          var pill=card.querySelector('.pill');pill.className='pill p-'+decision;pill.textContent=LABEL[decision];
          card.querySelectorAll('.acts,.reword,.st').forEach(function(n){n.remove()});
          var v=document.createElement('div');v.className='verdict v-'+decision;
          v.innerHTML='<b>'+LABEL[decision]+'</b> · just now'+(words?'<p class="his">In your words: '+esc(words)+'</p>':'');
          card.appendChild(v);progress();return;
        }
        if(x.status===409){st.textContent='Already decided. Reloading';setTimeout(function(){location.reload()},900);return}
        btns.forEach(function(b){b.disabled=false});st.className='st bad';
        st.textContent=x.status===401?'Sign in again, then press once more':'Not saved ('+((x.j&&x.j.error)||x.status)+'). Press again';
      })
      .catch(function(){btns.forEach(function(b){b.disabled=false});st.className='st bad';st.textContent='No connection. Press again'});
  }
  document.querySelectorAll('.std[data-id]').forEach(function(card){
    var form=card.querySelector('.reword');
    card.addEventListener('click',function(e){
      var b=e.target.closest('button[data-act]');if(!b)return;
      var act=b.getAttribute('data-act');
      if(act==='reword'){form.hidden=false;form.querySelector('textarea').focus();return}
      if(act==='cancel'){form.hidden=true;return}
      press(card,act);
    });
    if(form)form.addEventListener('submit',function(e){
      e.preventDefault();var w=form.querySelector('textarea').value.trim();
      if(!w){var st=card.querySelector('.st');st.className='st bad';st.textContent='Your words are needed to reword it';return}
      press(card,'corrected',w);
    });
  });
  progress();
})();
`

/** The page: one card per group, most productions first, each with Approve, Reword (his words) and Reject. */
export function renderStandards(groups: StandardsGroup[]) {
  const standards = groups.reduce((n, g) => n + g.members, 0)
  const done = groups.filter(g => g.decision).length
  const body = groups.length
    ? groups.map(card).join('\n')
    : '<p class="empty">No groups are waiting. They are seeded by scripts/floor_group.py --seed.</p>'
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Production standards</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@400;700;900&family=IBM+Plex+Mono:wght@400;600&display=swap">
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
<div class="top"><div class="kick">Make Your Mind Up · production standards</div><a href="/board">Back to the board</a></div>
<h1>Standards</h1>
<p class="lead">${E(plural(standards, 'standard'))} read from your rejections, in ${E(plural(groups.length, 'decision'))}. Approve a group, reword it in your own words, or reject it. Every standard in a group takes your decision.</p>
<div class="bar"><i><b data-progress-bar style="width:${groups.length ? Math.round(100 * done / groups.length) : 0}%"></b></i><span data-progress>${done} of ${groups.length} decided</span></div>
<main>
${body}
</main>
</div>
<script>${SCRIPT}</script>
</body>
</html>`
}
