#!/usr/bin/env python3
"""publish_manager: one self-contained page that holds everything a post
needs to go live, with a Copy button on every word and every picture.

Krish, 2026-10-10: "there should just be a copy button. Same for pictures
... a self-contained HTML that is basically my publish manager."

    python publish_manager.py manager.json --out DIR
    python publish_manager.py --self-test

manager.json:

    {"title": "...", "subtitle": "...", "date": "2026-10-09", "kicker": "mind.the.gap",
     "status": ["Fact check passed on this exact text", ...],
     "body": "path/to/body.md",
     "images": [{"id": "cover", "file": "img/cover-1200x630.png", "alt": "...", "role": "cover"},
                {"id": "vertical", "file": "img/cover-1080x1920.png", "alt": "...", "role": "vertical-cover"},
                {"id": "decoder", "file": "img/decoder.png", "alt": "...", "after_heading": "FIRST, WHAT YOU ARE LOOKING AT"}],
     "words": "path/to/publish.json",              # the channel words (publish_kit.py's input)
     "scripts": [{"label": "Video script (long)", "file": "script.md"}, ...]}

"role": "cover" is the 1200 x 630 cover to upload in Substack's settings;
"vertical-cover", "square-cover" and "share-card-cover" each get their own
card, saying where it goes (COVER_ROLES).

Every picture is embedded in the page, so the page works offline and from
Drive. Every Copy button tries the system clipboard first (rich text with the
pictures for the article, a real PNG for a picture), then the browser's own
copy command, and says which worked. Every picture also has Download. The
engine posts nothing: Krish publishes each step.
"""
import argparse
import base64
import html
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import publish_kit  # noqa: E402
import engine_stamp  # noqa: E402  the engine's stamp on a page it built
import title_check  # noqa: E402  the anti-dumb filter (house rule TITLE_EARNS_THE_CLICK)

E = html.escape


def inline(text):
    """Markdown inline: **bold**, *italic* and [a source link](https://...), everything else escaped. The links are
    the article's sources (Krish, 18 Oct, "linking the right assets"), so Copy article pastes them into Substack."""
    out = E(text)
    out = re.sub(r'\[([^\]]+)\]\((https://[^)\s]+)\)', r'<a href="\2">\1</a>', out)
    out = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', out)
    out = re.sub(r'(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', r'<em>\1</em>', out)
    return out


def figure(img):
    return (f'<figure><img src="{img["data"]}" alt="{E(img.get("alt", ""))}" width="{img.get("w", "")}">'
            + (f'<figcaption>{E(img["caption"])}</figcaption>' if img.get('caption') else '') + '</figure>')


def article_html(md, images):
    """The article as the HTML Substack takes on paste: h2, p, strong, em,
    and each picture as a figure right after its section's heading."""
    after = {}
    for i in images:
        if i.get('after_heading'):
            after.setdefault(i['after_heading'].strip().upper(), []).append(i)
    parts, blocks = [], [b.strip() for b in md.replace('\r', '').split('\n\n') if b.strip()]
    for block in blocks:
        if block.startswith('## '):
            heading = block[3:].strip()
            parts.append(f'<h2>{inline(heading)}</h2>')
            for img in after.get(heading.upper(), []):
                parts.append(figure(img))
        else:
            parts.append(f'<p>{inline(" ".join(block.split()))}</p>')
    return '\n'.join(parts)


def article_text(md, images):
    """Plain text: the words, with a marker where each picture goes."""
    after = {}
    for i in images:
        if i.get('after_heading'):
            after.setdefault(i['after_heading'].strip().upper(), []).append(i)
    out = []
    for block in [b.strip() for b in md.replace('\r', '').split('\n\n') if b.strip()]:
        if block.startswith('## '):
            heading = block[3:].strip()
            out.append(heading)
            for img in after.get(heading.upper(), []):
                out.append(f'[Picture: {img.get("alt", img["id"])}]')
        else:
            out.append(re.sub(r'\[([^\]]+)\]\((https://[^)\s]+)\)', r'\1', re.sub(r'\*\*(.+?)\*\*', r'\1', ' '.join(block.split()))))
    return '\n\n'.join(out)


CSS = r'''
:root{--bg:#F4EFE4;--ink:#0C1512;--card:#fffdf8;--line:#d9d2c3;--muted:#5b625e;--mint:#7EF0C0;--ok:#1f7a52;--bad:#b0412e}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0C1512;--ink:#F4EFE4;--card:#15201b;--line:#2b3832;--muted:#a9b4ae;--ok:#7EF0C0;--bad:#ff9b85;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0C1512;--ink:#F4EFE4;--card:#15201b;--line:#2b3832;--muted:#a9b4ae;--ok:#7EF0C0;--bad:#ff9b85;color-scheme:dark}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 Archivo,system-ui,-apple-system,sans-serif}
main{max-width:820px;margin:0 auto;padding:24px 16px 96px}
.kick{font:12px "IBM Plex Mono",ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
h1{font:400 clamp(30px,6vw,48px)/1 Anton,Impact,sans-serif;text-transform:uppercase;margin:6px 0 10px}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 4px}.chip{font-size:12.5px;border:1px solid var(--line);border-radius:999px;padding:3px 10px;background:var(--card)}
nav.toc{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;background:var(--bg);border-bottom:1px solid var(--line);margin:16px -16px 0;padding:8px 16px;display:flex;gap:6px;overflow-x:auto}
nav.toc a{white-space:nowrap;font-size:13px;font-weight:700;color:var(--ink);text-decoration:none;border:1px solid var(--line);border-radius:999px;padding:5px 11px;background:var(--card)}
section{margin-top:28px}section>h2{font:400 26px/1.05 Anton,Impact,sans-serif;text-transform:uppercase;margin:0 0 4px}
.why{color:var(--muted);margin:0 0 10px}
.card{border:1px solid var(--line);border-radius:12px;background:var(--card);padding:14px;margin:10px 0;display:grid;gap:8px}
.row{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.lab{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em}
.btns{display:flex;gap:6px;flex-wrap:wrap}
button{font:700 13px Archivo,system-ui,sans-serif;padding:8px 14px;border-radius:999px;border:0;background:var(--mint);color:#0C1512;cursor:pointer;min-height:38px}
button.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}
button:focus-visible,input:focus-visible{outline:3px solid var(--ok);outline-offset:2px}
pre.txt{margin:0;white-space:pre-wrap;word-break:break-word;font:15px/1.5 Archivo,system-ui,sans-serif;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:10px;max-height:320px;overflow:auto}
.missing{color:var(--bad);font-style:italic}
.article{background:#fff;color:#111;color-scheme:light;border-radius:8px;padding:18px;border:1px solid var(--line);max-height:560px;overflow:auto}
.article h2{font:700 20px/1.25 Georgia,serif;margin:22px 0 8px}.article p{margin:0 0 12px;font:17px/1.6 Georgia,serif}
.article figure{margin:14px 0}.article img{max-width:100%;height:auto;display:block;border-radius:4px}
.pic{display:grid;gap:8px}.pic img{width:100%;height:auto;border-radius:8px;border:1px solid var(--line);display:block}
.status{font-size:12.5px;color:var(--muted);min-height:1.2em}.status.ok{color:var(--ok)}.status.bad{color:var(--bad)}
ol.do{margin:0;padding-left:20px}.files{font:12px "IBM Plex Mono",ui-monospace,monospace;color:var(--muted)}
.links{display:grid;gap:8px}.links label{display:grid;gap:4px;font-weight:700;font-size:14px}
.links input{font:inherit;font-weight:400;padding:9px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);width:100%}
#toast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:var(--ink);color:var(--bg);padding:10px 16px;border-radius:999px;font-weight:700;font-size:14px;opacity:0;transition:opacity .2s;pointer-events:none;max-width:90vw;text-align:center}
#toast.on{opacity:1}
'''

JS = r'''
const $ = s => document.querySelector(s);
const toast = m => { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), 2200) };
const KEY = "publish-manager:" + ($("#pm")?.dataset.post || "");
const st = (() => { try { return JSON.parse(localStorage.getItem(KEY) || "{}") } catch { return {} } })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)) } catch {} };
const fill = t => String(t).replaceAll("{ARTICLE_URL}", st.article || "{ARTICLE_URL}").replaceAll("{YOUTUBE_URL}", st.youtube || "{YOUTUBE_URL}");
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
document.addEventListener("click", async e => {
  const b = e.target.closest("button[data-act]"); if (!b) return;
  const act = b.dataset.act, ref = b.dataset.ref;
  if (act === "text") report(b, await copyText(fill($("#" + ref).textContent)));
  if (act === "article") report(b, await copyRich(fill($("#" + ref).innerHTML), fill($("#" + ref + "-text").textContent)));
  if (act === "image") report(b, await copyImage($("#" + ref).src));
  if (act === "download") await download($("#" + ref).src, b.dataset.name);
  if (act === "done") { st.done = st.done || {}; st.done[ref] = !st.done[ref]; save(); b.textContent = st.done[ref] ? "Done ✓" : "Mark done" }
});
for (const id of ["article", "youtube"]) {
  const el = $("#link-" + id); if (!el) continue; el.value = st[id] || "";
  el.addEventListener("input", () => { st[id] = el.value.trim(); save(); document.querySelectorAll("pre[data-raw]").forEach(p => p.textContent = fill(p.dataset.raw)) });
}
document.querySelectorAll("pre[data-raw]").forEach(p => p.textContent = fill(p.dataset.raw));
document.querySelectorAll("button[data-act=done]").forEach(b => { if ((st.done || {})[b.dataset.ref]) b.textContent = "Done ✓" });
'''


def text_card(cid, label, text):
    if not isinstance(text, str) or not text.strip():
        return f'<div class="card"><span class="lab">{E(label)}</span><span class="missing">Not written yet: ask the engine for it before publishing.</span></div>'
    return (f'<div class="card"><div class="row"><span class="lab">{E(label)}</span><div class="btns">'
            f'<button data-act="text" data-ref="{cid}">Copy</button></div></div>'
            f'<pre class="txt" id="{cid}" data-raw="{E(text.strip())}">{E(text.strip())}</pre><div class="status" aria-live="polite"></div></div>')


COVER_ROLES = {
    'vertical-cover': 'Vertical cover: Shorts, TikTok and Reels (1080 x 1920)',
    'square-cover': 'Square cover: the Instagram feed and the archive (1080 x 1080)',
    'share-card-cover': 'Share card: LinkedIn and link previews (1200 x 675)',
}


def file_item(name, links):
    """A file a step names, linked to its Drive copy when the words give one (Krish, 18 Oct: the board was
    "not downloading or linking the right assets"). Only a copy known to be current is given a link."""
    url = links.get(name)
    if url and str(url).startswith('https://'):
        return f'<li><a href="{E(url)}" target="_blank" rel="noopener">{E(name)}</a></li>'
    return f'<li>{E(name)}</li>'


def compact_png(path):
    """An article chart as a 256-colour PNG when that looks the same: every pixel within 32 of 255 on each
    channel, and under 0.01% of them off by more than 24. A chart is embedded twice (in the article and on its
    own card), and Friday 16 Oct's six took the week board over the 16 MB an artifact page may be. Anything
    that would change visibly keeps its own bytes."""
    original = path.read_bytes()
    try:
        from PIL import Image, ImageChops
        import io
        im = Image.open(io.BytesIO(original)).convert('RGB')
        q = im.quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        hist = ImageChops.difference(im, q.convert('RGB')).convert('L').histogram()
        worst = max(i for i, v in enumerate(hist) if v)
        if worst > 32 or sum(hist[25:]) > 0.0001 * sum(hist):
            return original
        out = io.BytesIO()
        q.save(out, 'PNG', optimize=True)
        return out.getvalue() if out.tell() < len(original) else original
    except Exception:
        return original


def pic_card(img, slug):
    name = f'{slug}-{img["id"]}.png'
    return (f'<div class="card pic"><div class="row"><span class="lab">{E(img.get("label") or img["id"])}</span><div class="btns">'
            f'<button data-act="image" data-ref="img-{img["id"]}">Copy picture</button>'
            f'<button class="ghost" data-act="download" data-ref="img-{img["id"]}" data-name="{E(name)}">Download</button></div></div>'
            f'<img id="img-{img["id"]}" src="{img["data"]}" alt="{E(img.get("alt", ""))}">'
            + (f'<div class="files">{E(img["caption"])}</div>' if img.get('caption') else '') +
            '<div class="status" aria-live="polite"></div></div>')


def page(m, base):
    images = []
    for i in m.get('images', []):
        path = (base / i['file'])
        raw = compact_png(path) if i.get('after_heading') else path.read_bytes()
        data = 'data:image/png;base64,' + base64.b64encode(raw).decode()
        images.append({**i, 'data': data})
    md = (base / m['body']).read_text(encoding='utf-8')
    body_imgs = [i for i in images if i.get('after_heading')]
    words = json.loads((base / m['words']).read_text(encoding='utf-8')) if m.get('words') else {}
    links = words.get('links') or {}
    # Every title a reader sees first passes the anti-dumb filter, made from the piece's own words.
    source = md + ' ' + ' '.join((base / s['file']).read_text(encoding='utf-8') for s in m.get('scripts', []) if (base / s['file']).exists())
    refused = [(label, t, why) for label, t in (('title', m.get('title')), ('YouTube title', words.get('youtube_title')),
                                                 ('Shorts title', words.get('short_title')))
               if t for why in [title_check.gate(t, source)] if why]
    if refused:
        sys.exit('publish_manager: a title is not ready (house rule TITLE_EARNS_THE_CLICK: the anti-dumb floor, then only a title Krish picked):\n'
                 + '\n'.join(f'  {label}: "{t}": ' + '; '.join(why) for label, t, why in refused))
    slug = re.sub(r'[^a-z0-9]+', '-', (m.get('title') or 'post').lower()).strip('-')[:40]
    n = [0]

    def cid():
        n[0] += 1
        return f'c{n[0]}'

    sections = []
    # 1. Substack: title, subtitle, cover, the article with its pictures
    cover = next((i for i in images if i.get('role') == 'cover'), None)
    sub = [text_card(cid(), 'Title', m.get('title')), text_card(cid(), 'Subtitle', m.get('subtitle'))]
    sub.append(f'''<div class="card"><div class="row"><span class="lab">The article, with its pictures in place</span><div class="btns">
<button data-act="article" data-ref="art">Copy article</button></div></div>
<div class="article" id="art">{article_html(md, body_imgs)}</div>
<pre id="art-text" hidden>{E(article_text(md, body_imgs))}</pre><div class="status" aria-live="polite"></div>
<div class="files">Pastes as formatted text with headings and every picture in place. If a picture does not come through, use its own Copy picture button below.</div></div>''')
    if cover:
        sub.append(pic_card({**cover, 'label': "Cover and email thumbnail: upload it in the post's settings (1200 x 630)"}, slug))
    sub += [pic_card({**i, 'label': f'Picture {k}: {i.get("label") or i["id"]}'}, slug) for k, i in enumerate(body_imgs, 1)]
    long_name = words.get('long_name') or '5-minute video'
    waiting = (f' Not ready yet: {words["long_waiting"]}. The words, the article and the cover are ready.'
               if words.get('long_waiting') else '')
    sections.append(('substack', '1. Substack', f'One Video post: the {long_name} on top, then this article under it. Copy each piece in turn.'
                     + waiting, ''.join(sub)))
    # The cover for every other place it is shown, each its own image (Krish,
    # 2026-10-12: "the cover crops need to be all individual images, a
    # vertical cover thumbnail for the shorts/tiktok etc as well").
    others = [i for i in images if i.get('role') in COVER_ROLES]
    covers = ''.join(pic_card({**i, 'label': COVER_ROLES[i['role']]}, slug) for i in others)

    # 2 onwards: every other channel, from the same plan as publish_kit.py
    for k, s in enumerate(publish_kit.steps(words)[1:], 2):
        cards = ''.join(text_card(cid(), label, text) for label, text in s['copy'])
        files = ''.join(file_item(f, links) for f in s['files'])
        do = ''.join(f'<li>{E(d)}</li>' for d in s['do'])
        sections.append((f's{k}', f'{k}. {s["where"]}', s['why'],
                         f'<div class="card"><ol class="do">{do}</ol>' + (f'<div class="files">{files}</div>' if files else '') + f'</div>{cards}'))

    if covers:
        sections.append(('covers', 'Covers for every other place', 'Each drawn for its own shape. Copy or download the one a step names.', covers))

    # Scripts to record from: only the words to say
    sc = ''.join(text_card(cid(), s['label'], (base / s['file']).read_text(encoding='utf-8')) for s in m.get('scripts', []))
    if sc:
        sections.append(('scripts', 'Scripts', 'Only the words you say. Copy one into your teleprompter.', sc))

    toc = ''.join(f'<a href="#{sid}">{E(t.split(". ", 1)[-1])}</a>' for sid, t, _, _ in sections)
    body = ''.join(f'<section id="{sid}"><h2>{E(t)}</h2><p class="why">{E(why)}</p>{inner}'
                   f'<div class="btns"><button class="ghost" data-act="done" data-ref="{sid}">Mark done</button></div></section>'
                   for sid, t, why, inner in sections)
    chips = ''.join(f'<span class="chip">{E(c)}</span>' for c in m.get('status', []))
    title = (m.get('title') or '').strip()
    return f'''<title>Publish manager</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@400;700;900&family=IBM+Plex+Mono:wght@400;600&display=swap">
<style>{CSS}</style>
<main id="pm" data-post="{E(m.get("date") or "")} {E(title)}">
<div class="kick">{E(m.get("kicker") or "")} · {E(m.get("date") or "")} · nothing has been posted</div>
<h1>{E(title)}</h1><div class="chips">{chips}</div>
<div class="card links"><label for="link-article">Article link (after step 1)<input id="link-article" type="url" placeholder="https://..."></label>
<label for="link-youtube">YouTube link (after step 2)<input id="link-youtube" type="url" placeholder="https://youtu.be/..."></label>
<div class="files">Paste each link once; every Copy button below carries it.</div></div>
<nav class="toc" aria-label="Steps">{toc}</nav>{body}</main><div id="toast" role="status"></div><script>{JS}</script>
'''


def build(src, out_dir):
    src = Path(src)
    m = json.loads(src.read_text(encoding='utf-8'))
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    target = out / 'publish-manager.html'
    # Stamped, and LF on every machine, so the publish hook can tell the engine built it and nothing changed it.
    with open(target, 'w', encoding='utf-8', newline='\n') as f:
        f.write(engine_stamp.stamp(page(m, src.parent), 'publish_page'))
    return target


def self_test():
    import tempfile
    fails = []
    with tempfile.TemporaryDirectory() as tmp, title_check.picked_for_tests(['Amazon locked Muse out <x>'], tmp):
        t = Path(tmp)
        png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
        (t / 'a.png').write_bytes(png)
        (t / 'body.md').write_text('Amazon locked Muse out.\n\n## THE PART\n\nA **bold** fact.\n', encoding='utf-8')
        (t / 'words.json').write_text(json.dumps({'title': 'T', 'linkedin_post': 'L {ARTICLE_URL}'}), encoding='utf-8')
        (t / 's.md').write_text('Why? Because.\n', encoding='utf-8')
        (t / 'm.json').write_text(json.dumps({'title': 'Amazon locked Muse out <x>', 'subtitle': 'S', 'body': 'body.md', 'words': 'words.json',
                                              'images': [{'id': 'pic', 'file': 'a.png', 'alt': 'A', 'after_heading': 'THE PART'},
                                                         {'id': 'vertical', 'file': 'a.png', 'alt': 'V', 'role': 'vertical-cover'}],
                                              'scripts': [{'label': 'Script', 'file': 's.md'}]}), encoding='utf-8')
        h = build(t / 'm.json', t / 'out').read_text(encoding='utf-8')
        kept = compact_png(t / 'a.png')  # a 1-pixel PNG: smaller as itself, so it keeps its bytes
    checks = [
        ('the article copies with its pictures', 'data-act="article"' in h and '<h2>THE PART</h2>\n<figure><img src="data:image/png;base64,' in h),
        ('a named file links to its Drive copy, and only an https one',
         file_item('3 Video/a.mp4', {'3 Video/a.mp4': 'https://drive.google.com/file/d/x/view'}).startswith('<li><a href="https://drive')
         and file_item('3 Video/a.mp4', {'3 Video/a.mp4': 'file:///x'}) == '<li>3 Video/a.mp4</li>'),
        ('a chart that would change visibly keeps its own bytes', kept == png),
        ('pictures decode in the page, no fetch() on data: URLs', 'function dataBlob(src)' in h and 'Could not read this picture' in h),
        ('every picture has Copy picture and Download', 'data-act="image" data-ref="img-pic"' in h and 'data-act="download" data-ref="img-pic"' in h),
        ('bold stays bold', '<strong>bold</strong>' in h),
        ('a source link stays a link', inline('a [fact](https://x.org/a?b=1&c=2) here') == 'a <a href="https://x.org/a?b=1&amp;c=2">fact</a> here'),
        ('the title is escaped', 'out &lt;x&gt;' in h and 'out <x>' not in h),
        ('the article link fills every copy', '{ARTICLE_URL}' in h and 'id="link-article"' in h),
        ('scripts are copyable', 'Why? Because.' in h),
        ('a missing text says so', 'Not written yet' in h),
        ('nothing is fetched from outside', 'src="http' not in h and "src='http" not in h),
        ('the vertical cover has its own card, saying where it goes', 'data-ref="img-vertical"' in h and 'Shorts, TikTok and Reels' in h),
    ]
    for name, ok in checks:
        if not ok:
            fails.append(name)
    if fails:
        print('publish manager self-test FAILED:\n  ' + '\n  '.join(fails))
        return 1
    print(f'publish manager self-test passed: {len(checks)} checks')
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(description='One self-contained publish page with Copy on every word and picture.')
    ap.add_argument('manager', nargs='?')
    ap.add_argument('--out', default='.')
    ap.add_argument('--self-test', action='store_true')
    a = ap.parse_args(argv)
    if a.self_test:
        return self_test()
    if not a.manager:
        ap.error('give manager.json')
    print(build(a.manager, a.out))
    return 0


if __name__ == '__main__':
    sys.exit(main())
