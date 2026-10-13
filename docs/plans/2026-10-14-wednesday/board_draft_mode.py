"""Put the week's board into draft mode: Monday green (ready to post),
Wednesday and Friday amber (in draft), each draft day showing its article
and both scripts in full so Krish can comment on any line in the page's
comment mode. Usage: draft_mode.py LIVE.html OUT.html REPO"""
import base64, html, io, re, sys
from pathlib import Path
from PIL import Image

src, out, repo = sys.argv[1], sys.argv[2], Path(sys.argv[3])
s = open(src, encoding='utf-8').read()
esc = lambda t: html.escape(t, quote=False)

def jpg(path, width):
    im = Image.open(path).convert('RGB')
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'JPEG', quality=84, optimize=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()

def doc(prefix, kind, title, meta, text):
    """One draft, every paragraph its own block with its own id, so a comment
    pinned in comment mode lands on that paragraph."""
    blocks, n, h = [], 0, 0
    for para in [p.strip() for p in text.strip().split('\n\n') if p.strip()]:
        if para.startswith('## '):
            h += 1
            blocks.append(f'<h3 id="{prefix}-{kind}-h{h}">{esc(para[3:])}</h3>')
            continue
        n += 1
        pid = f'{prefix}-{kind}-{n}'
        if False:
            pass
        else:
            blocks.append(f'<p id="{pid}"><span class="pno" aria-hidden="true">{n}</span>{esc(para)}</p>')
    return (f'<section class="draft-doc" id="{prefix}-draft-{kind}"><div class="draft-head"><h2>{esc(title)}</h2>'
            f'<span class="kick">{esc(meta)}</span></div><div class="draft-body">{"".join(blocks)}</div></section>')

HOW = ('<div class="stage draft-stage" role="note"><strong>Draft. Comment on anything until you are happy.</strong> '
       'Turn on comment mode (the comment button on this page) and click any paragraph, word or picture to leave a note on it. '
       'Then tell Claude in the chat, or press Send to Claude on the note. Claude reads every note, rewrites, runs the checks again and '
       'republishes here. When you say it is right, this tab turns green and the publishing steps and ticks open.</div>')

CSS = '''
/* Draft mode (Krish, 2026-10-13): a day is green when everything is made and amber while its drafts are open for his comments. */
.wk button[role=tab]{border-top-width:6px}
.wk button[role=tab][data-stage=ready]{border-top-color:#2FB67C}
.wk button[role=tab][data-stage=draft]{border-top-color:#F2A93B}
.t-stage{font:800 10.5px/1 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.06em;text-transform:uppercase;padding:3px 6px;border-radius:999px;margin-left:4px}
[data-stage=ready] .t-stage{background:#2FB67C;color:#06130D}
[data-stage=draft] .t-stage{background:#F2A93B;color:#1A1003}
.stage{border-radius:12px;padding:12px 14px;margin:14px 0;font-size:15px;line-height:1.5}
.ready-stage{background:rgba(47,182,124,.14);border:2px solid #2FB67C}
.draft-stage{background:rgba(242,169,59,.14);border:2px solid #F2A93B}
.chip.warn{border-color:#F2A93B;color:#F2A93B}
.draft-doc{border:1px solid var(--line);border-radius:12px;background:var(--card);padding:14px;margin:14px 0}
.draft-head{display:flex;justify-content:space-between;align-items:baseline;gap:6px 10px;flex-wrap:wrap;margin-bottom:8px}
.draft-head h2{font:400 26px/1.05 Anton,Impact,sans-serif;text-transform:uppercase;margin:0}
.draft-body{background:#fff;color:#111;color-scheme:light;border-radius:8px;padding:18px 18px 8px}
.draft-body p{position:relative;margin:0 0 14px;font:17px/1.6 Georgia,serif;padding-left:30px}
.draft-body h3{font:700 19px/1.25 Georgia,serif;margin:20px 0 8px;padding-left:30px;text-transform:uppercase;letter-spacing:.02em}
.pno{position:absolute;left:0;top:3px;font:600 11px "IBM Plex Mono",ui-monospace,monospace;color:#8a8a8a}
.draft-covers{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin:10px 0}
.draft-covers figure{margin:0}.draft-covers img{width:100%;height:auto;border-radius:8px;border:1px solid var(--line);display:block}
.draft-covers figcaption{font-size:12.5px;color:var(--muted);margin-top:4px}
details.later{margin:22px 0 0;border:1px dashed var(--line);border-radius:12px;padding:10px 14px}
details.later>summary{cursor:pointer;font-weight:800;min-height:44px;display:flex;align-items:center}
'''
assert s.count('@media (prefers-reduced-motion:reduce){#toast,.meter span,label.tick .box{transition:none}}\n</style>') == 1
s = s.replace('@media (prefers-reduced-motion:reduce){#toast,.meter span,label.tick .box{transition:none}}\n</style>',
              '@media (prefers-reduced-motion:reduce){#toast,.meter span,label.tick .box{transition:none}}' + CSS + '</style>')

# The tabs: a stage on each.
for day, stage, word in [('monday', 'ready', 'Ready'), ('wednesday', 'draft', 'Draft'), ('friday', 'draft', 'Draft')]:
    a = f'data-day="{day}"><span class="t-day">'
    assert s.count(a) == 1, day
    s = s.replace(a, f'data-day="{day}" data-stage="{stage}"><span class="t-day">')
    m = re.search(rf'data-day="{day}" data-stage="{stage}"><span class="t-day">[^<]*</span>', s)
    s = s[:m.end()] + f'<span class="t-stage">{word}</span>' + s[m.end():]

# Monday: green.
mon_open = re.search(r'<div class="pm" id="panel-monday"[^>]*>\n?', s)
s = s[:mon_open.end()] + ('<div class="stage ready-stage" role="note"><strong>Ready to post.</strong> Everything is made, '
                          'videos included. Post in order and tick each step as you go.</div>\n') + s[mon_open.end():]

# Wednesday: its drafts.
wb = (repo / 'docs/plans/2026-10-14-draft-body.md').read_text()
wl = (repo / 'docs/plans/2026-10-14-draft-script.md').read_text()
ws = (repo / 'docs/plans/2026-10-14-draft-script-90s.md').read_text()
words = lambda t: len(t.split())
cache = repo / '.cache/pages/2026-10-14-wednesday'
covers = (f'<div class="draft-covers" id="wed-draft-covers">'
          f'<figure><img id="wed-cover" alt="Substack cover: Muse runs your life. Meta sells ads." src="{jpg(cache / "cover/cover-1200x630.png", 1200)}"><figcaption>Substack cover</figcaption></figure>'
          f'<figure><img id="wed-thumb-wide" alt="YouTube thumbnail" src="{jpg(cache / "thumbs/thumb-wide-1280x720.jpg", 1280)}"><figcaption>YouTube thumbnail</figcaption></figure>'
          f'<figure><img id="wed-thumb-tall" alt="Shorts, TikTok and Reels cover" src="{jpg(cache / "thumbs/thumb-tall-1080x1920.jpg", 540)}"><figcaption>Shorts, TikTok and Reels cover</figcaption></figure></div>')
wed_new = ('<div class="kick">under.the.hood · Wed 14 Oct · draft</div>\n'
           '<h1>Millions handed Meta&#x27;s Muse their chores. What does an ad company do with an agent that runs your life?</h1>'
           '<div class="chips"><span class="chip">Fact check passed: 34 claims, none blocking</span>'
           '<span class="chip">Sounds like Krish: voice check 0.0 (passes under 12)</span>'
           f'<span class="chip">{words(wb):,} words</span>'
           '<span class="chip">Scripts: reflective tone, new opening line, reading-age check passed</span><span class="chip">Prediction: Meta sells Muse&#x27;s picks by 30 June 2027, 70%</span>'
           '<span class="chip warn">Not in Teleprompter yet: waiting on your sign-off</span></div>\n'
           + HOW + covers
           + doc('wed', 'article', 'The article', f'{words(wb):,} words · Substack', wb)
           + doc('wed', 'long', 'The 3-minute script', f'{words(wl)} words · YouTube and Substack, 16:9', wl)
           + doc('wed', 'short', 'The 90-second script', f'{words(ws)} words · Shorts, TikTok, Reels, 9:16', ws) + '\n')
a = s.index('<div class="kick">under.the.hood · Wed 14 Oct · in production</div>')
b = s.index('<div class="ticks" id="wed-ticks"')
s = s[:a] + wed_new + s[b:]

# Friday: its drafts on top; the made publishing steps folded away until the draft is signed off.
fb = (repo / 'docs/plans/2026-10-09-draft-body.md').read_text()
fl = (repo / 'docs/plans/2026-10-09-draft-script.md').read_text()
fs = (repo / 'docs/plans/2026-10-09-draft-script-90s.md').read_text()
fri_open = re.search(r'<div class="pm" id="panel-friday"[^>]*>\n?', s)
fri_new = ('<div class="kick">mind.the.gap · Fri 16 Oct · draft</div>\n'
           '<h1>Why are there suddenly so many AIs?</h1>'
           '<div class="chips"><span class="chip">Fact check passed on this exact text</span>'
           '<span class="chip warn">Scripts: new reflective opening line, so Teleprompter has the old one</span>'
           f'<span class="chip warn">Too long: {words(fb):,} words (the new limit is 1,400)</span>'
           '<span class="chip warn">Voice check 15.2 (needs under 12): due its voice pass</span>'
           '<span class="chip warn">Waiting: your call on the prediction line</span></div>\n'
           + HOW
           + doc('fri', 'article', 'The article', f'{words(fb):,} words · Substack', fb)
           + doc('fri', 'long', 'The 3-minute script', f'{words(fl)} words · YouTube and Substack, 16:9', fl)
           + doc('fri', 'short', 'The 90-second script', f'{words(fs)} words · Shorts, TikTok, Reels, 9:16', fs)
           + '\n<details class="later" id="fri-later"><summary>Publishing steps and ticks: they open for good once the draft is signed off</summary>\n')
s = s[:fri_open.end()] + fri_new + s[fri_open.end():]
tail = '</p></div></main>'
assert s.count(tail) == 1
s = s.replace(tail, '</p></details></div></main>')
open(out, 'w', encoding='utf-8').write(s)
print(len(s), 'bytes')
