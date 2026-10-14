#!/usr/bin/env python3
"""publish_kit: one page that takes a post from its Drive folder to every
channel, in order, with a Copy button for every word to paste.

Krish, 2026-10-09: "I currently post the video to Substack separately to the
article, with a link to the article, but I have a feeling this is a clumsy
approach ... Build a durable amplification strategy that looks cohesive and is
really easy for me to take from Drive to Publish."

The strategy itself is docs/AMPLIFICATION.md. This file writes it out for one
post as `0 Publish/publish.html`, the first thing in the post's folder:

    python publish_kit.py publish.json --out DIR
    python publish_kit.py --self-test

publish.json holds the words and the file names (every field is optional
except title; a step whose words are missing says so instead of guessing):

    {"title": "...", "subtitle": "...", "date": "2026-10-09",
     "files": {"long_video": "3 Video/....mp4", "short_video": "3 Video/....mp4",
               "wide_thumbnail": "3 Video/<Subject> - wide 16x9 - thumbnail.jpg",
               "vertical_cover": "2 Covers and images/vertical-cover-1080x1920-shorts-tiktok-reels.png",
               "square": "2 Covers and images/square-1080x1080.png",
               "share_card": "2 Covers and images/share-card-1200x675.png",
               "cover": "2 Covers and images/substack-cover-1200x630.png",
               "substack_copy": "1 Article/substack-copy.html"},
     "youtube_title": "...", "youtube_description": "...",
     "short_title": "...", "short_caption": "...", "tiktok_caption": "...",
     "linkedin_post": "...", "whatsapp_text": "...", "note_text": "...",
     "comment_question": "..."}

The order (Krish, 2026-10-11): Substack, YouTube, then Shorts, TikTok and
Instagram, every time; LinkedIn, WhatsApp and Notes after, when he wants
them. "tiktok_caption" falls back to "short_caption".

The wide video's thumbnail goes on YouTube and the Substack video post
(Krish, 2026-10-12: "I always want a video thumbnail for all video sizes
produced as an asset every time"). Every place the cover is shown has its own
image (Krish, 2026-10-12: "the cover crops need to be all individual images, a
vertical cover thumbnail for the shorts/tiktok etc as well"): the vertical
cover on Shorts, TikTok and Reels, the square on the Instagram feed, the
16:9 share card on LinkedIn. The Substack post's cover image is the 1200 x 630 cover
(substack-cover-1200x630.png), the 1.91:1 Substack's upload box asks for: it
crops any other shape itself (Krish, 2026-10-12).

Any text may hold {ARTICLE_URL} and {YOUTUBE_URL}. The page has a box for
each: paste the link once and every Copy button carries it. Nothing here
posts anything; Krish publishes every step by hand.
"""
import argparse
import html
import json
import sys
from pathlib import Path

ARTICLE = '{ARTICLE_URL}'
YOUTUBE = '{YOUTUBE_URL}'
VERTICAL_MAX_SECONDS = 90  # the short cut, house rule TWO_CUTS; inside WhatsApp Status's limit too


def steps(p):
    """The channels, in the order they are published (docs/AMPLIFICATION.md).

    Krish, 2026-10-11: "I always want a 3-minute video and a 90-second
    version. I always want to repost to YouTube and then Shorts, TikTok, and
    Instagram." Those five come first, every time. LinkedIn and Spotify follow.
    WhatsApp and Substack Notes were dropped on 2026-10-14 (Krish: "I don't think
    I need Substack notes or WhatsApp to be honest, right now")."""
    f = p.get('files') or {}
    long_video = f.get('long_video') or '3 Video/ the 3-minute wide (16:9) video'
    short_video = f.get('short_video') or '3 Video/ the 90-second tall (9:16) video'
    cover = f.get('cover') or '2 Covers and images/substack-cover-1200x630.png'
    wide_thumb = f.get('wide_thumbnail') or '3 Video/ the wide (16:9) thumbnail'
    vertical = f.get('vertical_cover') or '2 Covers and images/vertical-cover-1080x1920-shorts-tiktok-reels.png'
    share_card = f.get('share_card') or '2 Covers and images/share-card-1200x675.png'
    square = f.get('square') or '2 Covers and images/square-1080x1080.png'
    copy_page = f.get('substack_copy') or '1 Article/substack-copy.html'
    q = p.get('comment_question') or ''
    short_caption = p.get('short_caption')
    return [
        {
            'where': 'Substack', 'tag': 'The home: one post, one email',
            'why': 'One post holds the 3-minute video at the top and the whole article under it, so subscribers get one email '
                   'and every other channel points to one link.',
            'files': [long_video, wide_thumb, cover, copy_page],
            'do': [
                'Create, then choose Video (not Article). Upload the 3-minute wide video.',
                f'Set the video\'s thumbnail to the wide thumbnail, {wide_thumb}.',
                'Paste the title and subtitle below.',
                f'Open {copy_page}, press Copy post, and paste it into the text under the video.',
                f'In the post\'s settings, use the cover, {cover}, as the cover image.',
                'Settings, before you publish: YouTube upload on, with the Substack watermark off. '
                'Shorts clips off and LinkedIn clips off (you post your own 90-second cut in steps 3 to 5).',
                'Publish and send to everyone. Then paste the post\'s link into the Article link box at the top of this page.',
            ],
            'copy': [('Title', p.get('title')), ('Subtitle', p.get('subtitle'))],
        },
        {
            'where': 'YouTube (the 3-minute video)', 'tag': 'Substack uploads it privately; you finish it',
            'why': 'Substack puts the video on YouTube as private. Swap in the YouTube words, then make it public.',
            'files': [wide_thumb],
            'do': [
                'In YouTube Studio, open the private video Substack just uploaded.',
                'Replace the title and description with the ones below. The article link sits at the end of the description, under the read line.',
                f'Under Thumbnail, upload the wide thumbnail, {wide_thumb}. Make it public, then pin the comment below.',
                'Paste the video\'s link into the YouTube link box at the top of this page.',
            ],
            'copy': [('Title', p.get('youtube_title')), ('Description', p.get('youtube_description')),
                     ('Pinned comment', f'The full article, with every source, free: {ARTICLE}' + (f'\n\n{q}' if q else ''))],
        },
        {
            'where': 'YouTube Shorts', 'tag': f'The {VERTICAL_MAX_SECONDS}-second cut, linked to the full video',
            'why': 'Links in Shorts are not clickable, so the Short points to the full video instead.',
            'files': [short_video, vertical],
            'do': ['Upload the tall video as a Short with the title below.',
                   f'Set its cover to the vertical cover, {vertical}, where YouTube lets you add a picture; '
                   'where it offers only a frame, pick the one where you look at the camera.',
                   'Under Related video, choose the full video from step 2.'],
            'copy': [('Title', p.get('short_title') or p.get('youtube_title'))],
        },
        {
            'where': 'TikTok', 'tag': f'The same {VERTICAL_MAX_SECONDS}-second cut',
            'why': 'Links in TikTok captions are not clickable, and a clickable link in your profile needs 1,000 followers '
                   'or a business account. The video says makeyourmindup.ai out loud, so the caption only has to name it.',
            'files': [short_video, vertical],
            'do': ['Upload the tall video and paste the caption below.',
                   f'Edit cover, and set it to the vertical cover, {vertical}. Then post.',
                   'Put makeyourmindup.ai in your profile, as a link once TikTok offers the Website field, as text until then.'],
            'copy': [('Caption', p.get('tiktok_caption') or short_caption)],
        },
        {
            'where': 'Instagram Reels', 'tag': f'The same {VERTICAL_MAX_SECONDS}-second cut',
            'why': 'Reel captions cannot hold a clickable link, so the caption sends people to the link in your bio.',
            'files': [short_video, vertical, square],
            'do': ['New Reel, add the tall video and paste the caption below.',
                   f'Edit cover, add from your camera roll and choose the vertical cover, {vertical}. Then share.',
                   'Check the link in your bio is makeyourmindup.ai.',
                   f'For the feed, when you want it: post the square cover, {square}, with the same caption.'],
            'copy': [('Caption', short_caption)],
        },
        {
            'where': 'LinkedIn', 'tag': 'Optional: the same cut, uploaded natively',
            'why': 'When you want it: a native video travels further on LinkedIn than a link card. The link goes in the first comment.',
            'files': [short_video, share_card],
            'do': ['Start a post, add the tall video, paste the post text below and publish.',
                   'Straight away, add the first comment below.',
                   f'Posting a picture with the link instead of the video? Attach the share card, {share_card}.'],
            'copy': [('Post text', p.get('linkedin_post')),
                     ('First comment', f'The full article, free, with every source: {ARTICLE}')],
        },
        {
            # Krish, 2026-10-14: "I think we should create a Spotify strategy ASAP ... treat it as a media channel and
            # create the assets for it as well (in the sizes it requires)". docs/SPOTIFY.md; specs in
            # docs/research/2026-10-14-spotify.md. Hosted on Spotify for Creators, never the Substack feed.
            'where': 'Spotify', 'tag': 'The video episode, with its clip and chapters',
            'why': 'Spotify plays the same 16:9 video as YouTube as a video podcast episode, and the 90-second cut is its clip. '
                   'Upload in Spotify for Creators (not through Substack), the same day as the Substack post.',
            'files': [long_video, wide_thumb, short_video],
            'do': ['In Spotify for Creators, New episode: upload the 3-minute wide video.',
                   f'Set the episode thumbnail to the wide thumbnail, {wide_thumb}. Leave episode art empty: the show art is used.',
                   'Paste the title and description below, then the chapters into the description.',
                   'Add the 90-second tall video as the episode\'s clip. Publish.'],
            'copy': [('Episode title', p.get('spotify_title') or p.get('youtube_title')),
                     ('Description', p.get('spotify_description') or p.get('youtube_description')),
                     ('Chapters', p.get('spotify_chapters'))],
        },
    ]


CSS = '''
:root{--bg:#F4EFE4;--ink:#0C1512;--card:#fffdf8;--line:#d9d2c3;--muted:#5b625e;--mint:#7EF0C0;--done:#e8f7ef}
@media (prefers-color-scheme:dark){:root{--bg:#0C1512;--ink:#F4EFE4;--card:#15201b;--line:#2b3832;--muted:#a9b4ae;--done:#17302a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 Archivo,system-ui,sans-serif}
main{max-width:760px;margin:0 auto;padding:24px 16px 64px}
h1{font:400 clamp(28px,6vw,44px)/1 Anton,Impact,sans-serif;text-transform:uppercase;margin:6px 0 4px}
.kick{font:12px "IBM Plex Mono",monospace;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.links{display:grid;gap:8px;margin:18px 0;padding:14px;border:2px solid var(--ink);border-radius:12px;background:var(--card)}
.links label{display:grid;gap:4px;font-weight:700;font-size:14px}
.links input{font:inherit;padding:9px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);width:100%}
.step{border:1px solid var(--line);border-radius:12px;background:var(--card);padding:16px;margin:14px 0}
.step.done{background:var(--done)}
.head{display:flex;gap:12px;align-items:flex-start}
.head input{width:22px;height:22px;margin-top:4px;accent-color:#2a8f63;flex:none}
.head h2{margin:0;font-size:20px}.tag{color:var(--muted);font-size:14px}
.why{margin:8px 0 0;font-style:italic;color:var(--muted)}
.files{margin:10px 0 0;padding:0;list-style:none;font:13px "IBM Plex Mono",monospace}
.files li:before{content:"\\2192  "}
ol{margin:10px 0 0;padding-left:22px}
.copy{margin-top:12px;display:grid;gap:4px}
.copy .row{display:flex;justify-content:space-between;align-items:center;gap:8px}
.copy b{font-size:13px;text-transform:uppercase;letter-spacing:.05em}
.copy pre{margin:0;white-space:pre-wrap;word-break:break-word;font:14px/1.45 Archivo,system-ui,sans-serif;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:10px}
.copy .missing{color:#b0412e;font-style:italic}
button{font:600 13px Archivo,system-ui,sans-serif;padding:8px 12px;border-radius:999px;border:0;background:var(--mint);color:#0C1512;cursor:pointer;min-height:36px}
button:focus-visible,input:focus-visible{outline:3px solid #2a8f63;outline-offset:2px}
'''

JS = '''
const KEY = "publish-kit:" + document.body.dataset.post;
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}") } catch { return {} } };
const save = s => { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch {} };
const state = load();
const fill = t => t.replaceAll("{ARTICLE_URL}", state.article || "{ARTICLE_URL}").replaceAll("{YOUTUBE_URL}", state.youtube || "{YOUTUBE_URL}");
function render(){ document.querySelectorAll("pre[data-raw]").forEach(p => p.textContent = fill(p.dataset.raw)) }
for (const id of ["article","youtube"]) {
  const el = document.getElementById(id); el.value = state[id] || "";
  el.addEventListener("input", () => { state[id] = el.value.trim(); save(state); render() });
}
document.querySelectorAll(".step").forEach((s, i) => {
  const box = s.querySelector("input[type=checkbox]"); box.checked = !!(state.done || {})[i]; s.classList.toggle("done", box.checked);
  box.addEventListener("change", () => { state.done = state.done || {}; state.done[i] = box.checked; save(state); s.classList.toggle("done", box.checked) });
});
document.addEventListener("click", async e => {
  const b = e.target.closest("button[data-copy]"); if (!b) return;
  const text = document.getElementById(b.dataset.copy).textContent;
  try { await navigator.clipboard.writeText(text); b.textContent = "Copied" }
  catch { const r = document.createRange(); r.selectNodeContents(document.getElementById(b.dataset.copy)); getSelection().removeAllRanges(); getSelection().addRange(r); b.textContent = "Selected: press Ctrl+C" }
  setTimeout(() => b.textContent = "Copy", 1800);
});
render();
'''


def page(p):
    e = html.escape
    out, n = [], 0
    for i, s in enumerate(steps(p), 1):
        blocks = []
        for label, text in s['copy']:
            n += 1
            if isinstance(text, str) and text.strip():
                blocks.append(f'<div class="copy"><div class="row"><b>{e(label)}</b><button data-copy="c{n}">Copy</button></div>'
                              f'<pre id="c{n}" data-raw="{e(text.strip())}">{e(text.strip())}</pre></div>')
            else:
                blocks.append(f'<div class="copy"><b>{e(label)}</b><span class="missing">Not written yet: ask the engine for it before publishing.</span></div>')
        files = ''.join(f'<li>{e(x)}</li>' for x in s['files'])
        out.append(f'''<section class="step"><div class="head"><input type="checkbox" aria-label="Step {i} done">
<div><h2>{i}. {e(s["where"])}</h2><div class="tag">{e(s["tag"])}</div></div></div>
<p class="why">{e(s["why"])}</p>{f'<ul class="files">{files}</ul>' if files else ''}
<ol>{''.join(f'<li>{e(d)}</li>' for d in s["do"])}</ol>{''.join(blocks)}</section>''')
    title = (p.get('title') or '').strip()
    return f'''<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Publish: {e(title)}</title><style>{CSS}</style></head>
<body data-post="{e(p.get("date") or "")} {e(title)}"><main>
<div class="kick">Start here · {e(p.get("date") or "")} · nothing has been posted</div><h1>{e(title)}</h1>
<p>Publish in this order. Tick each step as you go; the ticks and links are remembered in this browser.</p>
<div class="links"><label for="article">Article link (from step 1)<input id="article" type="url" placeholder="https://..."></label>
<label for="youtube">YouTube link (from step 2)<input id="youtube" type="url" placeholder="https://youtu.be/..."></label></div>
{''.join(out)}
<p class="tag">The plan behind this page: docs/AMPLIFICATION.md in the engine.</p></main><script>{JS}</script></body></html>
'''


def build(src, out_dir):
    p = json.loads(Path(src).read_text(encoding='utf-8-sig'))
    if not isinstance(p, dict) or not str(p.get('title') or '').strip():
        raise ValueError('publish.json needs at least a "title"')
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    target = out / 'publish.html'
    target.write_text(page(p), encoding='utf-8')
    return target


def self_test():
    failures = []
    sample = {'title': 'Why are there suddenly so many AIs?', 'date': '2026-10-09',
              'youtube_title': 'T', 'linkedin_post': 'L', 'short_caption': 'C'}
    text = page(sample)
    for where in ('1. Substack', '2. YouTube', '3. YouTube Shorts', '4. TikTok', '5. Instagram Reels', '6. LinkedIn', '7. Spotify'):
        if where not in text:
            failures.append(f'missing step {where}')
    if 'Optional: the same cut, uploaded natively' not in text:
        failures.append('LinkedIn must read as optional after the standing five')
    tiktok = next(x for x in steps(sample) if x['where'] == 'TikTok')
    if tiktok['copy'][0][1] != 'C':
        failures.append('TikTok must fall back to the short caption')
    if 'choose Video (not Article)' not in text:
        failures.append('step 1 must use one Substack video post')
    if '{ARTICLE_URL}' not in text or 'id="article"' not in text:
        failures.append('the article link must be filled in once, from the box')
    if 'Not written yet' not in text:
        failures.append('a missing text must say so, never be guessed')
    if '<script>alert' in page({'title': '<script>alert(1)</script>'}):
        failures.append('the title is not escaped')
    # Which picture each channel uses: the wide thumbnail on YouTube and the
    # Substack video post; the vertical cover on Shorts, TikTok and Reels
    # (Krish, 2026-10-12: "a vertical cover thumbnail for the shorts/tiktok
    # etc as well"); the square on the Instagram feed; the share card on LinkedIn.
    named = dict(sample, files={'wide_thumbnail': '3 Video/W - wide 16x9 - thumbnail.jpg'})
    by_where = {x['where']: x for x in steps(named)}
    vertical = '2 Covers and images/vertical-cover-1080x1920-shorts-tiktok-reels.png'
    for where, name in (('Substack', '3 Video/W - wide 16x9 - thumbnail.jpg'), ('YouTube (the 3-minute video)', '3 Video/W - wide 16x9 - thumbnail.jpg'),
                        ('YouTube Shorts', vertical), ('TikTok', vertical), ('Instagram Reels', vertical),
                        ('Instagram Reels', '2 Covers and images/square-1080x1080.png'), ('LinkedIn', '2 Covers and images/share-card-1200x675.png')):
        step = by_where[where]
        if name not in step['files'] or not any(name in d for d in step['do']):
            failures.append(f'{where} must name {name}, as a file to upload and in its steps')
    if any('thumbnail' in d.lower() for d in by_where['YouTube Shorts']['do']):
        failures.append('a Short\'s picture is the vertical cover, never a thumbnail')
    if 'Set the thumbnail to the cover' in text or 'Use the cover as the thumbnail' in text:
        failures.append('the 3:2 cover is no longer the video thumbnail')
    if 'as the cover image' not in text:
        failures.append('the cover stays the Substack post\'s cover image')
    if 'substack-cover-1200x630.png' not in ' '.join(steps({'title': 'T'})[0]['do']) or 'substack-cover-3x2' in ' '.join(steps({'title': 'T'})[0]['do']):
        failures.append('the Substack cover to upload is the 1200 x 630 one its upload box asks for, never the 3:2 one')
    checks = 18
    if failures:
        print('publish kit self-test FAILED:\n  ' + '\n  '.join(failures))
        return 1
    print(f'publish kit self-test passed: {checks} checks')
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('publish', nargs='?')
    ap.add_argument('--out', default='.')
    ap.add_argument('--self-test', action='store_true')
    a = ap.parse_args(argv)
    if a.self_test:
        return self_test()
    if not a.publish:
        ap.error('give publish.json')
    print(build(a.publish, a.out))
    return 0


if __name__ == '__main__':
    sys.exit(main())
