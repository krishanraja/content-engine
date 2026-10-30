"""The publish board's Today view, layout A (Krish, 2026-10-29: "yes, go with A and your recommendations and my feedback").

A is today first: the "Needs you" queue of one-tap asks leads, then the Monday to Sunday strip and each day's posts.
Two recommendations ride on it: C's stage-count strip across the top (Idea, Words, Cuts, Publish, Amplify, with counts)
and B's large asset preview when a day is opened.

His feedback on the mocks governs every component (docs/handovers/2026-10-29-board-phase2.md, verbatim there):
"we need ultimate component stability and predictability and consistency. buttons and other components should be
where i expect them to be, the size I expect them to be, no aggressive wrapping ... just one button per thing I need
to approve of - perfect - as long as i can click through to what i am approving easily."

So, in this file and its CSS:
- every component has a fixed size and a fixed place: one button size (BTN_W x BTN_H) at the same spot on every row and
  card, and no label ever wraps (each text box is one line with an ellipsis, or a fixed number of clamped lines);
- the post cards are one height, with their footers aligned; the preview keeps one aspect (4:5) and one size;
- the stage lane and the asset tiles are one row of fixed cells, never a second line;
- one row and one button per thing he approves, and every ask is a link to the thing it approves (the post, the
  words or the cut); a post with nothing on him still has its button, Open, in the same place.

The view is drawn from a model (render(model)); the board build feeds it (week_board.py), and fixtures prove it
(fixtures/week-board/today-*.json, screenshots with --shoot). It never posts, sends or changes anything: its liked
and not-it buttons and its asks are links and form controls the board's own script saves, like every press.
"""
import argparse
import html
import json
import re
import sys
from pathlib import Path

E = html.escape
STAGES = ('Idea', 'Words', 'Cuts', 'Publish', 'Amplify')
DAYS = (('mon', 'Mon', 'Monday'), ('tue', 'Tue', 'Tuesday'), ('wed', 'Wed', 'Wednesday'), ('thu', 'Thu', 'Thursday'),
        ('fri', 'Fri', 'Friday'), ('sat', 'Sat', 'Saturday'), ('sun', 'Sun', 'Sunday'))
DAY_KEYS = tuple(k for k, *_ in DAYS)
SERIES = {'follow_the_money': ('follow.the.money', '#FFD84D'), 'under_the_hood': ('under.the.hood', '#B7A6FF'),
          'mind_the_gap': ('mind.the.gap', '#FF6A4D')}
KINDS = {'piece': 'Series piece', 'carousel': 'Carousel', 'meme': 'Meme', 'news': 'Good news', 'levelup': 'Level up',
         'explainer': 'Explainer', 'short': 'Short', 'note': 'Note'}
STATUS = {'concept': ('Needs your yes', 'ask'), 'approved': ('Approved', 'ok'), 'making': ('In the making', 'quiet'),
          'drafted': ('Drafted', 'quiet'), 'scheduled': ('Scheduled', 'ok'), 'live': ('Live', 'live')}
# The asset tiles: the same five cells, in the same order, on every card. A cell a post does not have is drawn empty.
ASSET_SLOTS = (('long', 'Long'), ('short', '90s'), ('article', 'Article'), ('cover', 'Cover'), ('still', 'Still'))
ASSET_STATES = ('ready', 'making', 'missing')
CHANNEL_LABELS = {'substack': 'Substack', 'youtube': 'YouTube', 'shorts': 'Shorts', 'tiktok': 'TikTok', 'reels': 'Reels',
                  'instagram': 'Instagram', 'linkedin': 'LinkedIn', 'spotify': 'Spotify', 'x': 'X', 'threads': 'Threads',
                  'facebook': 'Facebook', 'substack-notes': 'Notes'}
CTA_MAX = 12  # a button label fits BTN_W at 14px without wrapping; longer labels are refused, never squeezed
# An ask's two lines fit the Needs you row in full at 390px wide (no ellipsis hides what he approves): the what is
# short ("Substack, Mon 2 Nov"), the detail says the one thing more. Longer is refused at the source, never clipped.
WHAT_MAX, DETAIL_MAX = 22, 30
FEEL = (('liked', 'Liked'), ('not_it', 'Not it'))
HREF = re.compile(r'^(https://\S+|#[A-Za-z0-9_-]+)$')
TIME = re.compile(r'^([01]\d|2[0-3]):[0-5]\d$')


class ModelError(Exception):
    pass


def _need(cond, msg):
    if not cond:
        raise ModelError(msg)


def check(model):
    """The model the view draws, checked: a wrong field is refused with its place, never drawn half."""
    _need(isinstance(model, dict), 'the model is an object')
    _need(re.match(r'^\d{4}-\d{2}-\d{2}$', str(model.get('week', ''))), 'week is its Monday, YYYY-MM-DD')
    _need(model.get('today') in (None, *DAY_KEYS), 'today is a day key or null')
    asks = model.get('asks') or []
    _need(isinstance(asks, list), 'asks is a list')
    for i, a in enumerate(asks):
        where = f'asks[{i}]'
        _need(isinstance(a, dict) and a.get('what') and a.get('cta'), f'{where}: what and cta')
        _need(len(str(a['cta'])) <= CTA_MAX, f'{where}: cta "{a["cta"]}" is longer than {CTA_MAX} characters, so it would not fit its button')
        _need(HREF.match(str(a.get('href', ''))), f'{where}: href links to what it approves (https or #anchor)')
        _need(len(str(a['what'])) <= WHAT_MAX, f'{where}: what "{a["what"]}" is longer than {WHAT_MAX} characters, so it would not show in full')
        _need(len(str(a.get('detail', ''))) <= DETAIL_MAX, f'{where}: detail is longer than {DETAIL_MAX} characters, so it would not show in full')
        _need(a.get('day') in DAY_KEYS, f'{where}: day')
    days = model.get('days') or []
    _need(isinstance(days, list) and [d.get('key') for d in days] == list(DAY_KEYS), 'days are mon to sun, in order')
    for d in days:
        _need(d.get('feel') in (None, 'liked', 'not_it'), f'{d["key"]}: feel')
        for j, p in enumerate(d.get('posts') or []):
            where = f'{d["key"]}.posts[{j}]'
            _need(p.get('kind') in KINDS, f'{where}: kind is one of {", ".join(KINDS)}')
            _need(p.get('kind') != 'piece' or p.get('series') in SERIES, f'{where}: a series piece names its series')
            _need(p.get('status') in STATUS, f'{where}: status is one of {", ".join(STATUS)}')
            _need(isinstance(p.get('stage'), int) and 0 <= p['stage'] < len(STAGES), f'{where}: stage is 0 to 4')
            _need(TIME.match(str(p.get('time', ''))), f'{where}: time is New York HH:MM')
            _need(p.get('title'), f'{where}: title')
            act = p.get('action')
            if act:
                _need(len(str(act.get('label', ''))) <= CTA_MAX, f'{where}: action label is at most {CTA_MAX} characters')
                _need(HREF.match(str(act.get('href', ''))), f'{where}: action href')
            for a in p.get('assets') or []:
                _need(a.get('slot') in dict(ASSET_SLOTS) and a.get('state') in ASSET_STATES, f'{where}: asset slot and state')
                _need(not a.get('href') or HREF.match(a['href']), f'{where}: asset href')
            for c in p.get('channels') or []:
                _need(c in CHANNEL_LABELS, f'{where}: channel {c}')
    return model


def stage_counts(model):
    """C's strip: how many of the week's posts sit at each stage."""
    counts = [0] * len(STAGES)
    for d in model['days']:
        for p in d.get('posts') or []:
            counts[p['stage']] += 1
    return counts


def _preview(p, size):
    src = (p.get('preview') or {}).get('src')
    label = SERIES[p['series']][0] if p['kind'] == 'piece' else KINDS[p['kind']]
    tone = SERIES[p['series']][1] if p['kind'] == 'piece' else '#7EF0C0'
    if src and re.match(r'^(https://|data:image/(png|jpeg|webp);base64,)', src):
        return f'<div class="pv pv-{size}" style="--tc:{tone}"><img src="{E(src)}" alt=""></div>'
    return (f'<div class="pv pv-{size}" style="--tc:{tone}" aria-hidden="true"><span class="pv-k">{E(label)}</span>'
            f'<span class="pv-t">{E(p["title"])}</span></div>')


def _pill(p):
    if p['kind'] == 'piece':
        label, color = SERIES[p['series']]
        return f'<span class="pill" style="background:{color}">{E(label)}</span>'
    return f'<span class="pill kind">{E(KINDS[p["kind"]])}</span>'


def _lane(stage):
    cells = ''.join(f'<span class="{"done" if i < stage else "now" if i == stage else ""}">{E(s)}</span>' for i, s in enumerate(STAGES))
    return f'<div class="lane" aria-label="Stage: {E(STAGES[stage])}">{cells}</div>'


def _assets(p):
    have = {a['slot']: a for a in p.get('assets') or []}
    cells = []
    for slot, label in ASSET_SLOTS:
        a = have.get(slot)
        if not a:
            cells.append(f'<span class="as none" aria-hidden="true">{E(label)}</span>')
        elif a.get('href'):
            cells.append(f'<a class="as {a["state"]}" href="{E(a["href"])}" title="{E(label)}: {E(a["state"])}">{E(label)}</a>')
        else:
            cells.append(f'<span class="as {a["state"]}" title="{E(label)}: {E(a["state"])}">{E(label)}</span>')
    return f'<div class="assets">{"".join(cells)}</div>'


def _card(d, p, i):
    label, tone = STATUS[p['status']]
    act = p.get('action') or {'label': 'Open', 'href': f'#td-open-{d["key"]}'}
    primary = ' go' if p['status'] == 'concept' else ''
    chans = p.get('channels') or []
    waiting = f'<span class="wait">Waiting: {E(p["waiting"])}</span>' if p.get('waiting') else (p.get('claim') and f'<span class="claim">{E(p["claim"])}</span>') or '<span class="claim"></span>'
    return (f'<article class="card{" need" if primary else ""}" id="td-post-{d["key"]}-{i}">'
            f'<div class="c-meta">{_pill(p)}<span class="c-time">{E(p["time"])}</span><span class="c-st tone-{tone}">{E(label)}</span></div>'
            f'<div class="c-mid">{_preview(p, "s")}<div class="c-txt"><h4 class="c-title">{E(p["title"])}</h4>{waiting}</div></div>'
            f'{_lane(p["stage"])}{_assets(p)}'
            f'<div class="c-foot">{_feel(d, p, i)}<a class="btn{primary}" href="{E(act["href"])}">{E(act["label"])}</a></div></article>')


def _empty_card(d):
    return (f'<article class="card empty"><div class="c-empty">Nothing planned for {E(dict((k, n) for k, _, n in DAYS)[d["key"]])}</div>'
            f'<div class="c-foot"><span class="feels"></span><a class="btn ghost" href="#td-open-{d["key"]}">Open</a></div></article>')


def _feel(d, p, i):
    """Liked and Not it, in the card's footer beside its button, so each post is one unit. The first post of a day is
    picks/<day>-feel; another post the same day is <day>-feel-<n>."""
    fid = f'{d["key"]}-feel' + (f'-{i}' if i else '')
    on = (d.get('feel') if i == 0 else None) or p.get('feel')
    about = (f' data-piece="{E(p["piece_id"])}"' if p.get('piece_id') else '') + f' data-title="{E(p["title"])}"'
    return ('<span class="feels" role="group" aria-label="How did it land?">' + ''.join(
        f'<button type="button" class="feel{" on" if on == k else ""}" data-feel="{k}" data-feel-id="{fid}" data-feel-day="{d["key"]}"{about} '
        f'aria-pressed="{"true" if on == k else "false"}">{E(v)}</button>' for k, v in FEEL) + '</span>')


def _open_panel(d, name, date):
    """B's large preview: the day opened. One preview size and aspect; each asset a fixed row with its link."""
    posts = d.get('posts') or []
    lead = posts[0] if posts else None
    rows = []
    for p in posts:
        for slot, label in ASSET_SLOTS:
            a = next((x for x in p.get('assets') or [] if x['slot'] == slot), None)
            if not a:
                continue
            link = f'<a class="btn ghost" href="{E(a["href"])}">Open</a>' if a.get('href') else '<span class="btn ghost off">Not yet</span>'
            rows.append(f'<li><span class="o-name">{E(label)}: {E(p["title"])}</span><span class="o-st as-{a["state"]}">{E(a["state"])}</span>{link}</li>')
    big = _preview(lead, 'l') if lead else '<div class="pv pv-l pv-none" aria-hidden="true"></div>'
    for p in posts:
        chans = ', '.join(CHANNEL_LABELS[c] for c in p.get('channels') or [])
        if chans:
            rows.append(f'<li><span class="o-name">Goes out on: {E(chans)}</span></li>')
    return (f'<section class="open" id="td-open-{d["key"]}" aria-label="{E(name)} opened"><div class="o-in">'
            f'<div class="o-head"><b>{E(name)}</b><span>{E(date)}</span><a class="btn ghost" href="#td-top">Close</a></div>'
            f'<div class="o-body">{big}<ul class="o-list">{"".join(rows) or "<li><span class=o-name>No assets yet</span></li>"}</ul></div></div></section>')


def inner(model):
    """The Today view's body, one <div class="today-a">, every id prefixed td-: drawn alone (render) or as the board's
    Today tab (week_board.py), whose one stylesheet carries scoped_css()."""
    model = check(model)
    names = {k: (s, n) for k, s, n in DAYS}
    counts = stage_counts(model)
    stage_strip = ''.join(f'<div class="sc"><b>{c}</b><span>{E(s)}</span></div>' for s, c in zip(STAGES, counts))
    asks = model.get('asks') or []
    ask_rows = ''.join(
        f'<li class="ask"><span class="n">{i + 1}</span><div class="w"><b>{E(a["what"])}</b><span>{E(a.get("detail", ""))}</span></div>'
        f'<a class="btn go" href="{E(a["href"])}">{E(a["cta"])}</a></li>' for i, a in enumerate(asks)) \
        or '<li class="ask"><div class="w"><b>Nothing waits on you</b><span>The engine will put the next ask here</span></div></li>'
    strip = []
    for d in model['days']:
        short, _ = names[d['key']]
        posts = d.get('posts') or []
        dots = ''.join(f'<i class="{"need" if p["status"] == "concept" else "live" if p["status"] == "live" else ""}"></i>' for p in posts[:4])
        strip.append(f'<a href="#td-{d["key"]}" class="{"today" if model.get("today") == d["key"] else ""}"><b>{short}</b>'
                     f'<span>{E(d.get("date", ""))}</span><span class="dots">{dots}</span></a>')
    sections, opens = [], []
    for d in model['days']:
        short, name = names[d['key']]
        posts = d.get('posts') or []
        cards = ''.join(_card(d, p, i) for i, p in enumerate(posts)) or _empty_card(d)
        today = '<span class="pill today">Today</span>' if model.get('today') == d['key'] else '<span class="pill today off"></span>'
        sections.append(f'<section class="day" id="td-{d["key"]}"><h3><span class="d-name"><span class="long">{E(name)}</span><span class="short">{E(short)}</span></span><span class="d-date">{E(d.get("date", ""))}</span>'
                        f'{today}</h3><div class="cards">{cards}</div></section>')
        opens.append(_open_panel(d, name, d.get('date', '')))
    note = f'<p class="note">{E(model["note"])}</p>' if model.get('note') else ''
    return (f'<div class="today-a" id="td-top"><div class="wrap">'
            f'<div class="top"><h2 class="t-h">{E(model.get("label", "This week"))}</h2><div class="range">{E(model.get("range", ""))}</div></div>'
            f'<div class="stages" role="list" aria-label="Posts by stage">{stage_strip}</div><div class="grid">'
            f'<div class="asks"><div class="q"><div class="sect"><span>Needs you</span><span>{len(asks)} ask{"s" if len(asks) != 1 else ""}</span></div><ol>{ask_rows}</ol></div>{note}</div>'
            f'<div class="tmain"><nav class="strip" aria-label="Days">{"".join(strip)}</nav>{"".join(sections)}</div>'
            f'</div></div>{"".join(opens)}</div>')


def scoped_css(root='.today-a'):
    """CSS with every rule under root, so the view sits inside the board's one stylesheet and touches nothing else."""
    def scope(block):
        out, at = [], 0
        while at < len(block):
            brace = block.find('{', at)
            if brace < 0:
                break
            head = block[at:brace].strip()
            if head.startswith('@media'):
                depth, j = 1, brace + 1
                while depth:
                    depth += {'{': 1, '}': -1}.get(block[j], 0)
                    j += 1
                out.append(f'{head}{{{scope(block[brace + 1:j - 1])}}}')
                at = j
                continue
            close = block.index('}', brace)
            sels = []
            for sel in head.split(','):
                sel = sel.strip()
                sels.append(root if sel in (':root', 'body') else f'{root} *' if sel == '*' else f'{root} {sel}')
            out.append(f'{",".join(sels)}{{{block[brace + 1:close]}}}')
            at = close + 1
        return ''.join(out)
    return scope(CSS)


def render(model, fonts=None, title=None):
    body = inner(model)
    css = (font_faces(fonts) if fonts else GOOGLE_FONTS) + scoped_css() + 'body{margin:0;background:#F4EFE4}'
    head_title = E(title or f'Publish board, week of {model["week"]}')
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{head_title}</title><style>{css}</style></head><body>{body}</body></html>'''


GOOGLE_FONTS = '@import url("https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@400;700&family=IBM+Plex+Mono:wght@500;700&display=swap");'


def font_faces(root):
    r = Path(root).resolve().as_uri()
    return (f'@font-face{{font-family:Anton;src:url({r}/Anton-Regular.ttf)}}'
            f'@font-face{{font-family:Archivo;src:url({r}/Archivo-Variable.ttf);font-weight:100 900}}'
            f'@font-face{{font-family:"IBM Plex Mono";src:url({r}/IBMPlexMono-Medium.ttf)}}'
            f'@font-face{{font-family:"IBM Plex Mono";font-weight:700;src:url({r}/IBMPlexMono-Bold.ttf)}}')


# One button size everywhere (--bw x --bh); every text box is one line with an ellipsis or a fixed clamp.
CSS = '''
:root{--bg:#F4EFE4;--ink:#0C1512;--card:#fffdf8;--line:#d9d2c3;--muted:#5b625e;--mint:#7EF0C0;--ok:#1f7a52;--bad:#b0412e;
--bw:112px;--bh:44px;--card-h:236px;--pv-w:72px;--pv-h:90px;--mono:"IBM Plex Mono",ui-monospace,monospace}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--ink);font:400 15px/1.4 Archivo,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit}
.one{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wrap{max-width:1180px;margin:0 auto;padding:20px 16px 48px}
.t-h{font:400 30px/1 Anton,Impact,sans-serif;text-transform:uppercase;letter-spacing:.01em}
.range{font:500 12px/1.2 var(--mono);color:var(--muted);margin-top:6px;white-space:nowrap}
.top{margin-bottom:14px}
.btn{flex:none;display:inline-flex;align-items:center;justify-content:center;width:var(--bw);height:var(--bh);border-radius:12px;
 border:1.5px solid var(--ink);background:var(--card);color:var(--ink);font:700 14px/1 Archivo,sans-serif;text-decoration:none;white-space:nowrap;overflow:hidden}
.btn.go{background:var(--mint);border-color:var(--mint)}
.btn.ghost{background:transparent}.btn.off{opacity:.45}
.stages{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;margin-bottom:16px}
.sc{height:56px;background:var(--card);border:1px solid var(--line);border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}
.sc b{font:400 22px/1 Anton,sans-serif}.sc span{font:700 10px/1 var(--mono);text-transform:uppercase;letter-spacing:.05em;color:var(--muted);white-space:nowrap}
.grid{display:grid;gap:22px;grid-template-columns:minmax(0,1fr)}
@media(min-width:960px){.grid{grid-template-columns:380px minmax(0,1fr);align-items:start}.asks{position:sticky;top:16px}}
.sect{font:700 11px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;display:flex;justify-content:space-between;margin-bottom:6px;white-space:nowrap}
.q{background:var(--ink);color:var(--bg);border-radius:18px;padding:16px}
.q .sect{color:#a9b4ae}
.q ol{list-style:none}
.ask{display:flex;align-items:center;gap:12px;height:72px;border-top:1px solid #2b3832}
.ask:first-child{border-top:0}
.ask .n{flex:none;width:20px;font:400 22px/1 Anton,sans-serif;color:var(--mint)}
.ask .w{flex:1;min-width:0}
.ask .w b,.ask .w span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ask .w b{font-size:15px}.ask .w span{font-size:13px;color:#c9d1cc}
.note{margin-top:12px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px;font-size:13.5px}
.strip{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;margin-bottom:14px}
.strip a{height:64px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;border-radius:12px;background:var(--card);border:1px solid var(--line);text-decoration:none}
.strip a.today{border:2px solid var(--ink)}
.strip b{font:700 11px/1 var(--mono);text-transform:uppercase}.strip span{font-size:11px;color:var(--muted);white-space:nowrap}
.dots{display:flex;gap:3px;height:6px}.dots i{width:6px;height:6px;border-radius:50%;background:#c9c2b2}
.dots i.need{background:var(--bad)}.dots i.live{background:var(--mint);outline:1px solid #0C151233}
.day{margin-bottom:16px}
.day h3{display:flex;align-items:center;gap:8px;height:44px;font:700 13px/1 var(--mono);text-transform:uppercase;white-space:nowrap}
.d-name{width:96px}.d-name .short{display:none}
@media(max-width:519px){.d-name{width:40px}.d-name .long{display:none}.d-name .short{display:inline}}.d-date{width:56px;color:var(--muted);font-weight:500}.sp{flex:1}
.pill{display:inline-block;flex:none;font:700 10px/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;padding:5px 8px;border-radius:999px;white-space:nowrap}
.pill.kind{background:#e3ddcf}.pill.today{width:56px;text-align:center;background:var(--mint)}.pill.today.off{visibility:hidden}
.feels{display:flex;gap:6px}.feel{flex:none;width:60px;height:var(--bh);border-radius:9px;border:1.5px solid var(--line);background:var(--card);font:700 11px/1 var(--mono);text-transform:uppercase;cursor:pointer;white-space:nowrap}
.feel.on{border-color:var(--ink);background:var(--ink);color:var(--bg)}
.cards{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))}
.card{height:var(--card-h);display:flex;flex-direction:column;gap:8px;padding:12px;background:var(--card);border:1px solid var(--line);border-radius:16px;overflow:hidden}
.card.need{background:#fff4ef;border-color:#e9b9a9}
.c-meta{display:flex;align-items:center;gap:10px;height:20px;font:500 11.5px/1 var(--mono);color:var(--muted);white-space:nowrap}
.c-meta .pill{max-width:150px;overflow:hidden;text-overflow:ellipsis}
.c-time{width:40px}.c-st{margin-left:auto;font-weight:700;text-transform:uppercase;font-size:10.5px;letter-spacing:.05em}
.tone-ask{color:var(--bad)}.tone-ok{color:var(--ok)}.tone-quiet{color:var(--muted)}.tone-live{color:var(--ink)}
.c-mid{display:flex;gap:12px;height:var(--pv-h)}
.c-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
.c-title{font:700 15px/1.3 Archivo,sans-serif;height:39px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.claim,.wait{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--muted)}.wait{color:var(--bad)}
.pv{flex:none;position:relative;overflow:hidden;background:var(--ink);color:var(--bg);border-radius:10px;display:flex;flex-direction:column;justify-content:space-between}
.pv::before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:var(--tc)}
.pv img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.pv-s{width:var(--pv-w);height:var(--pv-h);padding:6px 6px 6px 10px}
.pv-l{width:100%;max-width:360px;aspect-ratio:4/5;padding:14px 14px 14px 20px}
.pv-k{font:700 7px/1.1 var(--mono);text-transform:uppercase;color:var(--tc);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pv-t{font:400 9px/1.05 Anton,sans-serif;text-transform:uppercase;overflow:hidden;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical}
.pv-l .pv-k{font-size:11px}.pv-l .pv-t{font-size:26px;-webkit-line-clamp:6}
.lane,.assets{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:2px;height:24px}
.lane span{display:flex;align-items:center;justify-content:center;font:700 9.5px/1 var(--mono);text-transform:uppercase;background:#ece6d9;color:#8b8f89;white-space:nowrap;overflow:hidden}
.lane span:first-child{border-radius:6px 0 0 6px}.lane span:last-child{border-radius:0 6px 6px 0}
.lane span.done{background:#d6efe3;color:var(--ok)}.lane span.now{background:var(--ink);color:var(--mint)}
.assets{gap:4px}
.as{display:flex;align-items:center;justify-content:center;border-radius:6px;font:700 9.5px/1 var(--mono);text-transform:uppercase;text-decoration:none;white-space:nowrap;overflow:hidden;border:1px solid var(--line)}
.as.ready{background:#d6efe3;border-color:#bfe3d0;color:var(--ok)}.as.making{background:#fff6d6;border-color:#f0dea0;color:#7a5d00}
.as.missing{background:#fbe6e0;border-color:#efc4b7;color:var(--bad)}.as.none{border-style:dashed;color:#c4beb1;background:transparent}
.c-foot{margin-top:auto;display:flex;align-items:center;justify-content:space-between;height:var(--bh)}
.c-ch{font:500 11.5px/1 var(--mono);color:var(--muted);white-space:nowrap}
.card.empty{justify-content:space-between}.c-empty{font-size:13px;color:var(--muted)}
.open{display:none;position:fixed;inset:0;background:#0c151299;padding:16px;overflow:auto;z-index:5}
.open:target{display:block}
.o-in{max-width:880px;min-width:0;margin:0 auto;background:var(--card);border-radius:18px;padding:16px}
.o-head{display:flex;align-items:center;gap:12px;height:var(--bh);margin-bottom:12px;font:700 13px/1 var(--mono);text-transform:uppercase;white-space:nowrap}
.o-head span{color:var(--muted);flex:1}.o-head .btn{text-transform:none;font-family:Archivo,sans-serif}
.o-body{display:grid;gap:16px;grid-template-columns:minmax(0,1fr)}
@media(min-width:720px){.o-body{grid-template-columns:360px minmax(0,1fr)}}
.o-list{list-style:none}
.o-list li{display:flex;align-items:center;gap:10px;height:56px;border-top:1px solid var(--line)}
.o-list li:first-child{border-top:0}
.o-name{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:14px}
.o-st{flex:none;width:64px;font:700 10px/1 var(--mono);text-transform:uppercase}
.as-ready{color:var(--ok)}.as-making{color:#7a5d00}.as-missing{color:var(--bad)}
'''


def shoot(html_files, out_dir, hashes=('',)):
    """Phone (390) and desktop (1440) screenshots of each page, and of each hash given (a day opened)."""
    import subprocess
    js = '''
const { chromium } = require('playwright'); const path = require('path')
;(async () => { const [out, hashes, ...files] = process.argv.slice(1); const b = await chromium.launch()
 for (const f of files) for (const h of JSON.parse(hashes)) for (const [vw, w] of [['phone', 390], ['desktop', 1440]]) {
  const p = await b.newPage({ viewport: { width: w, height: w === 390 ? 844 : 900 }, deviceScaleFactor: 2 })
  const errs = []; p.on('pageerror', e => errs.push(e.message))
  await p.goto('file://' + path.resolve(f) + h); await p.waitForTimeout(300)
  const sw = await p.evaluate(() => Math.max(document.documentElement.scrollWidth,
    ...[...document.querySelectorAll('body *')].filter(e => e.offsetParent || getComputedStyle(e).position === 'fixed').map(e => Math.ceil(e.getBoundingClientRect().right))))
  const name = path.basename(f, '.html') + (h ? '-' + h.slice(1) : '') + '-' + vw + '.png'
  await p.screenshot({ path: path.join(out, name), fullPage: !h })
  // What he approves is never cut off: no ask line, title or label hides text behind an ellipsis.
  const cut = await p.evaluate(() => [...document.querySelectorAll('.ask .w b, .ask .w span, .btn, .feel, .sc span, .lane span, .as')]
    .filter(e => e.offsetParent && e.scrollWidth > e.clientWidth + 1).map(e => e.textContent.trim().slice(0, 40)))
  if (cut.length) errs.push('cut off: ' + cut.join(' | '))
  console.log(JSON.stringify({ shot: name, scrollWidth: sw, width: w, errors: errs }))
  await p.close() }
 await b.close() })()'''
    Path(out_dir).mkdir(parents=True, exist_ok=True)
    run = subprocess.run(['node', '-e', js, str(out_dir), json.dumps(list(hashes)), *map(str, html_files)],
                         capture_output=True, text=True, timeout=300)
    if run.returncode:
        raise ModelError(f'screenshots failed: {run.stderr.strip()[-400:]}')
    return [json.loads(line) for line in run.stdout.splitlines() if line.startswith('{')]


def main(argv=None):
    ap = argparse.ArgumentParser(description='Draw the board\'s Today view (layout A) from a model.')
    ap.add_argument('model', nargs='+', help='model JSON file(s)')
    ap.add_argument('--out', required=True, help='folder for the HTML (and screenshots)')
    ap.add_argument('--fonts', help='a folder of the brand fonts, for local screenshots')
    ap.add_argument('--shoot', action='store_true', help='also take phone and desktop screenshots')
    ap.add_argument('--open', action='append', default=[], help='a day key to also shoot opened, e.g. mon')
    a = ap.parse_args(argv)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    pages = []
    try:
        for m in a.model:
            model = json.loads(Path(m).read_text(encoding='utf-8'))
            page = out / (Path(m).stem + '.html')
            page.write_text(render(model, fonts=a.fonts), encoding='utf-8')
            pages.append(page)
        if a.shoot:
            for shot in shoot(pages, out, ['', *(f'#open-{k}' for k in a.open)]):
                print(json.dumps(shot))
                if shot['scrollWidth'] > shot['width'] or shot['errors']:
                    raise ModelError(f'{shot["shot"]}: page wider than the screen or script errors')
    except (ModelError, OSError, ValueError) as error:
        print(f'board_today: {error}', file=sys.stderr)
        return 1
    for p in pages:
        print(p)
    return 0


if __name__ == '__main__':
    sys.exit(main())
