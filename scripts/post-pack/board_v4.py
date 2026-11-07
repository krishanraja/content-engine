"""board_v4: what layout v4 of the publish board adds, drawn from data (config/board-layout.json `v4`, from the week of
9 November 2026).

Krish, 2026-11-07: "I still have to keep looking for things, and I have to keep trying to figure out where stuff is,
which isn't ideal. It also doesn't allow me to give feedback for every day of publishing stuff last week, say, for
example, the off days." Then: "I think we should redesign the 9th of November board as well."

So, from the proposal he approved (docs/proposals/2026-11-07-board-v4/PROPOSAL.md):

  - the Desk, the tab the board opens on: everything waiting on him in the order it is due, one sentence and one
    button each to the exact place, with what waits on the engine or Growth folded underneath, then the week's six
    days as cards with their seven stages;
  - the seven stages on every day, Monday to Saturday, off days included: Idea, Script, Recorded, Creative, Cut,
    Published, Scored, drawn as a bar (done, with someone else, waiting on him, not yet, not for this post);
  - the Creative step's one sheet and one press (creative.json, `read_creative`; docs/PUBLISH_BOARDS.md, "Layout v4");
  - a Scores press for every post, off days included (`picks/score-<piece>`, or `picks/score-<date>` for a post with no
    piece), and the Last week tab, every post of the week before in one list;
  - bugs attached to their post (`read_bugs`).

week_board.py owns the board and calls these; this module only reads its inputs and draws its parts. Nothing here
publishes, sends or writes anywhere.
"""
import hashlib
import html
import json
import re
from datetime import date, datetime
from pathlib import Path

E = html.escape
ROOT = Path(__file__).resolve().parents[2]
STYLE_BANK = ROOT / 'config' / 'style-references.json'

STAGES = (('idea', 'Idea'), ('script', 'Script'), ('recorded', 'Recorded'), ('creative', 'Creative'), ('cut', 'Cut'),
          ('published', 'Published'), ('scored', 'Scored'))
STAGE_KEYS = tuple(k for k, _ in STAGES)
# done: finished; others: with the engine or Growth; you: waiting on him; todo: not yet; skip: not for this post.
STATE_WORDS = {'done': 'done', 'others': 'with the engine or Growth', 'you': 'waiting on you', 'todo': 'not yet',
               'skip': 'not for this post'}
SHA = re.compile(r'^[a-f0-9]{64}$')
UUID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)
OPTION_ID = re.compile(r'^[a-z0-9][a-z0-9_-]{0,39}$')
CREATIVE_DAYS = ('mon', 'tue', 'wed', 'thu', 'fri', 'sat')
MOTION_STATUS = {'liked': 'Liked on your footage', 'untested': 'Untested on your footage', 'experiment': 'An experiment'}
FRAME_EXT = re.compile(r'\.(png|jpe?g|webp)$', re.I)
CLIP_EXT = re.compile(r'\.mp4$', re.I)
CTA_MAX = 12  # a Desk button label fits its button at 390px without wrapping
SERIES_CLASS = {'follow.the.money': 'ftm', 'under.the.hood': 'uth', 'mind.the.gap': 'mtg'}


class V4Error(ValueError):
    """An input v4 cannot draw; week_board.py says it as a BoardError."""


def canonical_sha(value):
    """sha256 of canonical JSON (sorted keys, no spaces): the board's and the server's one rule."""
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')).hexdigest()


def _line(v, most):
    s = ' '.join(str(v or '').split())
    return s if 0 < len(s) <= most else None


def motion_ids(path=STYLE_BANK):
    """The motion styles in the bank (config/style-references.json, layer motion)."""
    try:
        bank = json.loads(Path(path).read_text(encoding='utf-8')).get('bank') or []
    except (OSError, ValueError):
        return set()
    return {b.get('id') for b in bank if isinstance(b, dict) and b.get('layer') == 'motion' and b.get('id')}


# ------------------------------------------------------------------ the stage bar


def stage_bar(day, states, notes=None, label='Where this day is'):
    """The seven stages as one bar: each a segment with its name under it and its state in words for a screen reader.
    states: {stage: done|others|you|todo|skip}; notes: {stage: a few words}."""
    notes = notes or {}
    items = []
    for k, name in STAGES:
        s = states.get(k) or 'todo'
        if s not in STATE_WORDS:
            raise V4Error(f'{day}: stage {k} is {s!r}, not one of {sorted(STATE_WORDS)}')
        note = notes.get(k)
        items.append(f'<li class="v4-s {s}" data-stage="{k}" data-stage-state="{s}" title="{E(name)}: {E(note or STATE_WORDS[s])}">'
                     f'<span class="v4-bar" aria-hidden="true"></span><span class="v4-sl">{E(name)}</span>'
                     f'<span class="v4-sr">: {E(note or STATE_WORDS[s])}</span></li>')
    return f'<ol class="v4-stages" data-stages-day="{day}" aria-label="{E(label)}">' + ''.join(items) + '</ol>'


LEGEND = ('<p class="v4-legend"><span class="v4-k done"></span>done <span class="v4-k others"></span>with the engine or Growth '
          '<span class="v4-k you"></span>waiting on you <span class="v4-k todo"></span>not yet</p>')


# ------------------------------------------------------------------ the Desk


def next_line(d):
    """The one line under a day card: where it is now, in words (the bar's labels are too small on a card)."""
    st = d['states']
    for k, name in STAGES:
        s = st.get(k) or 'todo'
        if s in ('done', 'skip'):
            continue
        note = (d.get('notes') or {}).get(k)
        who = {'you': 'waiting on you', 'others': 'with the engine or Growth', 'todo': 'next'}[s]
        return f'<span class="dk-next"><b>{E(name)}</b>: {E(note or who)}</span>'
    return '<span class="dk-next"><b>Scored</b>: done</span>'


def desk(model):
    """The Desk's body: what waits on him in the order it is due, each one line and one button; what waits on others,
    folded; then the week's days as cards with their stages. model: {'asks': [{day, label, what, detail, due, href, cta,
    series?}], 'waits': [line], 'days': [{key, tab, label, title, series?, states, notes}]}."""
    asks = model.get('asks') or []
    rows = []
    for i, a in enumerate(asks, 1):
        cta = a.get('cta') or 'Open'
        if len(cta) > CTA_MAX:
            raise V4Error(f'a Desk button label is longer than its button holds: {cta!r}')
        if not re.match(r'^(#[a-z0-9/_-]+|https://\S+)$', str(a.get('href') or '')):
            raise V4Error(f'a Desk ask links nowhere: {a}')
        rows.append(
            f'<li class="dk-ask" id="dk-ask-{i}" data-day="{E(a["day"])}"'
            + (f' data-settled-by="{E(a["settled"])}"' if a.get('settled') else '') + '><span class="dk-pill {SERIES_CLASS.get(a.get("series") or "", "off")}">'
            f'{E(a["label"])}</span><div class="dk-what"><b>{E(a["what"])}</b>'
            + (f'<span class="dk-detail">{E(a["detail"])}</span>' if a.get('detail') else '')
            + f'<span class="dk-due">{E(a["due_label"])}</span></div><a class="btn go" href="{E(a["href"])}">{E(cta)}</a></li>')
    head = (f'<h2 class="dk-h">Needs you, in the order it is due</h2><ol class="dk-list">{"".join(rows)}</ol>' if rows else
            '<h2 class="dk-h">Needs you</h2><p class="dk-none">Nothing waits on you right now.</p>')
    waits = model.get('waits') or []
    folded = (f'<details class="dk-wait"><summary>Waiting on the engine or Growth ({len(waits)})<span class="dk-sub"> nothing for you'
              '</span></summary><ul>' + ''.join(f'<li>{E(w)}</li>' for w in waits) + '</ul></details>') if waits else ''
    cards = []
    for d in model.get('days') or []:
        cards.append(
            f'<a class="dk-day" href="#{E(d["tab"])}" data-day="{E(d["key"])}"><span class="dk-pill {SERIES_CLASS.get(d.get("series") or "", "off")}">'
            f'{E(d["label"])}</span><span class="dk-title">{E(d["title"])}</span>' + next_line(d)
            + stage_bar(d['key'], d['states'], d.get('notes'), f'{d["label"]}: where it is') + '</a>')
    week = (f'<h2 class="dk-h">This week, every day the same seven stages</h2><div class="dk-week">{"".join(cards)}</div>' + LEGEND) if cards else ''
    return f'<div class="desk" id="dk">{head}{folded}{week}</div>'


# ------------------------------------------------------------------ the Creative sheet (creative/1)


def _asset(v, what, mapping_src, kind='frame'):
    """{file, sha256} drawn from the --assets mapping (mapping_src is week_board.clip_src bound to the sheet's folder)."""
    if not isinstance(v, dict) or not SHA.match(str(v.get('sha256') or '')) or not str(v.get('file') or '').strip():
        raise V4Error(f'{what}: give {{"file", "sha256"}}')
    ext = CLIP_EXT if kind == 'clip' else FRAME_EXT
    file = str(v['file'])
    if not ext.search(file.split('?')[0]):
        raise V4Error(f'{what}: {file} is not {"an mp4 clip" if kind == "clip" else "a png, jpg or webp frame"}')
    return {'file': file, 'sha256': v['sha256'], 'src': mapping_src(file, v['sha256'], what)}


def read_creative(data, day, piece, mapping_src, motions=None, where='--creative'):
    """The sheet, checked against creative/1 (docs/PUBLISH_BOARDS.md, "Layout v4"), with every frame and clip given the
    board's own copy of its bytes, and `sha256` (canonical JSON of the sheet as given) and `storyboard_sha256` (the hash
    ve's storyboard gate binds) worked out. Raises V4Error with every problem at once."""
    problems = []

    def need(cond, msg):
        if not cond:
            problems.append(msg)
        return cond

    if not isinstance(data, dict) or data.get('schema') != 'creative/1':
        raise V4Error(f'{where}: give a creative/1 sheet ("schema": "creative/1"); docs/PUBLISH_BOARDS.md, "Layout v4"')
    sha = canonical_sha(data)
    need(data.get('day') == day, f'day is {data.get("day")!r}, not {day}')
    need(data.get('day') in CREATIVE_DAYS, 'day is one of mon to sat')
    need(isinstance(data.get('piece_id'), str) and UUID.match(data['piece_id']), 'piece_id is the content_ideas uuid')
    if piece and isinstance(data.get('piece_id'), str):
        need(data['piece_id'] == piece, f'piece_id is {data["piece_id"]}, and the day holds {piece}')
    need(data.get('cut') in ('long', 'short'), 'cut is long or short')
    out = {'sha256': sha, 'day': day, 'piece_id': data.get('piece_id'), 'cut': data.get('cut')}

    def asset(v, what, kind='frame'):
        try:
            return _asset(v, what, mapping_src, kind)
        except V4Error as error:
            problems.append(str(error))
        except ValueError as error:  # week_board.BoardError: no board asset for the file
            problems.append(f'{what}: {error}')
        return None

    take = data.get('take')
    if need(isinstance(take, dict) and _line(take.get('file'), 200) and SHA.match(str(take.get('sha256') or '')),
            'take is {"file", "sha256"}: the take every frame is drawn from'):
        out['take'] = {'file': _line(take['file'], 200), 'sha256': take['sha256']}

    op = data.get('opener') if isinstance(data.get('opener'), dict) else {}
    need(bool(op), 'opener (A) is missing')
    opener = {}
    for side, secs in (('open', 'the first 7 seconds'), ('close', 'the last 8 seconds')):
        v = op.get(side) if isinstance(op.get(side), dict) else {}
        if need(_line(v.get('words'), 600), f'opener.{side}.words: {secs}, as said'):
            opener[side] = {'words': _line(v['words'], 600), 'frame': asset(v.get('frame'), f'opener.{side}.frame')}
    ht = op.get('hook_test') if isinstance(op.get('hook_test'), dict) else {}
    if need(isinstance(ht.get('passed'), bool) and _line(ht.get('note'), 300), 'opener.hook_test is {"passed", "note"}'):
        opener['hook_test'] = {'passed': ht['passed'], 'note': _line(ht['note'], 300)}
    alts = op.get('alternatives') if isinstance(op.get('alternatives'), list) else []
    need(len(alts) == 2, 'opener.alternatives: exactly two other hooks')
    opener['alternatives'] = []
    for i, a in enumerate(alts):
        if need(isinstance(a, dict) and OPTION_ID.match(str(a.get('id') or '')) and _line(a.get('words'), 400),
                f'opener.alternatives[{i}] is {{"id", "words"}}'):
            opener['alternatives'].append({'id': a['id'], 'words': _line(a['words'], 400)})
    out['opener'] = opener

    def options(key, label, lo, hi, kind, extra):
        got = data.get(key) if isinstance(data.get(key), list) else []
        need(lo <= len(got) <= hi, f'{key} ({label}): {lo} to {hi} options')
        seen, rows = set(), []
        for i, o in enumerate(got):
            if not isinstance(o, dict):
                problems.append(f'{key}[{i}] is not an object')
                continue
            row = extra(o, f'{key}[{i}]')
            if row is None:
                continue
            ident = row['id']
            if not need(ident not in seen, f'{key}: {ident} is given twice'):
                continue
            seen.add(ident)
            rows.append(row)
        return rows

    def caption(o, w):
        if need(OPTION_ID.match(str(o.get('id') or '')) and _line(o.get('name'), 80) and _line(o.get('how'), 240),
                f'{w} is {{"id", "name", "how", "frame"}}'):
            return {'id': o['id'], 'name': _line(o['name'], 80), 'how': _line(o['how'], 240), 'frame': asset(o.get('frame'), f'{w}.frame')}
        return None
    out['captions'] = options('captions', 'B. Subtitles', 2, 3, 'frame', caption)

    bank = motion_ids() if motions is None else motions

    def motion(o, w):
        mid = str(o.get('module') or '')
        ok = need(re.match(r'^[a-z0-9][a-z0-9_.-]{0,79}$', mid) and (not bank or mid in bank),
                  f'{w}.module: {mid or "nothing"} is not a motion style in config/style-references.json')
        ok = need(_line(o.get('name'), 80) and _line(o.get('how'), 240), f'{w}: give its name and one-line how') and ok
        ok = need(o.get('status') in MOTION_STATUS, f'{w}.status is liked, untested or experiment') and ok
        if ok:
            return {'id': mid, 'module': mid, 'name': _line(o['name'], 80), 'how': _line(o['how'], 240), 'status': o['status'],
                    'clip': asset(o.get('clip'), f'{w}.clip', 'clip')}
        return None
    out['motion'] = options('motion', 'C. Motion style', 2, 3, 'clip', motion)

    idea = data.get('idea') if isinstance(data.get('idea'), dict) else {}
    moves = idea.get('moves') if isinstance(idea.get('moves'), list) else []
    real = idea.get('real_artifacts') if isinstance(idea.get('real_artifacts'), list) else []
    never = idea.get('never') if isinstance(idea.get('never'), list) else []
    need(_line(idea.get('object'), 300), 'idea.object: the one object (D)')
    need(1 <= len(moves) <= 6 and all(isinstance(m, dict) and _line(m.get('move'), 200) and _line(m.get('means'), 200) for m in moves),
         'idea.moves: 1 to 6 {"move", "means"}')
    need(1 <= len(real) <= 6 and all(isinstance(r, dict) and _line(r.get('name'), 160) for r in real),
         'idea.real_artifacts: 1 to 6 {"name", "frame"}, each the real thing shown as itself')
    need(1 <= len(never) <= 8 and all(_line(n, 200) for n in never), 'idea.never: 1 to 8 lines')
    out['idea'] = {'object': _line(idea.get('object'), 300),
                   'moves': [{'move': _line(m.get('move'), 200), 'means': _line(m.get('means'), 200)} for m in moves if isinstance(m, dict)],
                   'real_artifacts': [{'name': _line(r.get('name'), 160), 'frame': asset(r.get('frame'), f'idea.real_artifacts[{i}].frame')}
                                      for i, r in enumerate(real) if isinstance(r, dict)],
                   'never': [_line(n, 200) for n in never if _line(n, 200)]}

    sb = data.get('storyboard') if isinstance(data.get('storyboard'), dict) else {}
    frames = sb.get('frames') if isinstance(sb.get('frames'), list) else []
    text, expect = sb.get('text'), sb.get('expect')
    need(isinstance(text, str) and text.strip() and len(text) <= 40000, 'storyboard.text: storyboard.md, exactly as ve wrote it')
    lines = [ln for ln in str(expect or '').replace('\r\n', '\n').split('\n') if ln.strip()]
    need(isinstance(expect, str) and 1 <= len(lines) <= 6, 'storyboard.expect: expect.md, one to six lines')
    need(6 <= len(frames) <= 10, 'storyboard.frames: 6 to 10 frames')
    sb_rows, seen = [], set()
    for i, f in enumerate(frames):
        if need(isinstance(f, dict) and OPTION_ID.match(str(f.get('id') or '')) and re.match(r'^\d{1,2}:\d{2}$', str(f.get('t') or ''))
                and _line(f.get('beat'), 200), f'storyboard.frames[{i}] is {{"id", "t" (m:ss), "beat", "frame"}}'):
            if need(f['id'] not in seen, f'storyboard.frames: {f["id"]} is given twice'):
                seen.add(f['id'])
                sb_rows.append({'id': f['id'], 't': f['t'], 'beat': _line(f['beat'], 200), 'frame': asset(f.get('frame'), f'storyboard.frames[{i}].frame')})
    lf = lambda t: str(t or '').replace('\r\n', '\n').replace('\r', '\n')  # noqa: E731
    out['storyboard'] = {'frames': sb_rows, 'text': lf(text), 'expect': lf(expect)}
    out['storyboard_sha256'] = canonical_sha({'expect': lf(expect), 'storyboard': lf(text)})

    def thumb(o, w):
        if need(OPTION_ID.match(str(o.get('id') or '')) and _line(o.get('name'), 120), f'{w} is {{"id", "name", "grid", "results"}}'):
            return {'id': o['id'], 'name': _line(o['name'], 120), 'grid': asset(o.get('grid'), f'{w}.grid'),
                    'results': asset(o.get('results'), f'{w}.results')}
        return None
    out['thumbnails'] = options('thumbnails', 'F. Thumbnails', 2, 3, 'frame', thumb)

    after = data.get('after') if isinstance(data.get('after'), dict) else {}
    builds = after.get('builds') if isinstance(after.get('builds'), list) else []
    need(1 <= len(builds) <= 6 and all(_line(b, 240) for b in builds), 'after.builds: 1 to 6 lines, what is built next (G)')
    need(after.get('loops') in (1, 2), 'after.loops: 1 or 2 (two loops, then Krish: F34)')
    out['after'] = {'builds': [_line(b, 240) for b in builds if _line(b, 240)], 'loops': after.get('loops')}
    if problems:
        raise V4Error(f'{where} {day} is not ready to show:\n  ' + '\n  '.join(problems))
    return out


def _img(a, alt):
    return f'<img class="cr-img" src="{E(a["src"])}" alt="{E(alt)}" loading="lazy" data-sha="{a["sha256"]}">' if a else ''


def _pick(section, value, label, extra=''):
    return (f'<button type="button" class="tri cr-pick" data-cr-pick="{section}" data-value="{E(value)}" aria-pressed="false"'
            f'{extra} disabled>{E(label)}</button>')


def creative_card(day, p, sheet):
    """The Creative step's sheet: A to G, every option drawn on his own frame, his picks, then Sign creative or Change it
    (with his words). Saved as picks/<day>-creative by week.js, bound to the sheet's sha256."""
    o = sheet['opener']
    alts = ''.join(f'<li><p class="cr-alt">{E(a["words"])}</p>{_pick("opener", a["id"], "Use this hook")}</li>' for a in o['alternatives'])
    ht = o.get('hook_test') or {}
    a_sec = (f'<section class="cr-sec" data-cr="opener" aria-labelledby="{p}cr-a"><h3 id="{p}cr-a">A. Opener and close</h3>'
             '<div class="cr-two">'
             f'<figure class="cr-fig">{_img(o["open"]["frame"], "The first frame of the opener")}<figcaption><b>First 7 seconds</b> {E(o["open"]["words"])}</figcaption></figure>'
             f'<figure class="cr-fig">{_img(o["close"]["frame"], "The closing frame")}<figcaption><b>Last 8 seconds</b> {E(o["close"]["words"])}</figcaption></figure></div>'
             f'<p class="rec-how cr-hook {"ok" if ht.get("passed") else "bad"}">Hook test: {"passed" if ht.get("passed") else "did not pass"}. {E(ht.get("note") or "")}</p>'
             f'<div class="cr-row">{_pick("opener", "as_written", "Keep the hook as written")}</div>'
             f'<p class="rec-how">Or one of these:</p><ul class="cr-alts">{alts}</ul></section>')
    caps = ''.join(f'<figure class="cr-opt" data-cr-opt="{E(c["id"])}">{_img(c["frame"], c["name"])}<figcaption><b>{E(c["name"])}</b> '
                   f'{E(c["how"])}</figcaption>{_pick("captions", c["id"], "Pick")}</figure>' for c in sheet['captions'])
    b_sec = (f'<section class="cr-sec" data-cr="captions" aria-labelledby="{p}cr-b"><h3 id="{p}cr-b">B. Subtitles: pick one</h3>'
             '<p class="rec-how">Each on your own frame, with Instagram\'s and YouTube\'s button zones drawn in red. Every option breaks '
             'only on a phrase and never repeats the title on screen.</p>'
             f'<div class="cr-opts">{caps}</div></section>')
    moves = ''.join(f'<figure class="cr-opt" data-cr-opt="{E(m["module"])}">'
                    f'<video class="cr-clip" src="{E(m["clip"]["src"])}" muted loop playsinline autoplay preload="metadata" aria-label="{E(m["name"])} on your footage"></video>'
                    f'<figcaption><b>{E(m["name"])}</b> <span class="cr-status {m["status"]}">{E(MOTION_STATUS[m["status"]])}</span> {E(m["how"])}</figcaption>'
                    f'{_pick("motion", m["module"], "Pick")}</figure>' for m in sheet['motion'])
    c_sec = (f'<section class="cr-sec" data-cr="motion" aria-labelledby="{p}cr-c"><h3 id="{p}cr-c">C. Motion style: pick one</h3>'
             f'<p class="rec-how">From the style bank, each a short loop on your footage. An untested style is welcome: the proof shows it '
             f'moving before anything scales.</p><div class="cr-opts">{moves}</div></section>')
    idea = sheet['idea']
    d_sec = (f'<section class="cr-sec" data-cr="idea" aria-labelledby="{p}cr-d"><h3 id="{p}cr-d">D. The one idea</h3>'
             f'<p><b>One object:</b> {E(idea["object"])}</p><ul class="cr-moves">'
             + ''.join(f'<li><b>{E(m["move"])}</b> means {E(m["means"])}</li>' for m in idea['moves']) + '</ul>'
             '<p class="rec-how">The real things, shown as themselves, full frame:</p><div class="cr-opts">'
             + ''.join(f'<figure class="cr-fig">{_img(r["frame"], r["name"])}<figcaption>{E(r["name"])}</figcaption></figure>' for r in idea['real_artifacts'])
             + '</div><p class="rec-how"><b>Never:</b></p><ul class="cr-never">' + ''.join(f'<li>{E(n)}</li>' for n in idea['never']) + '</ul></section>')
    frames = ''.join(f'<figure class="cr-sb" id="{p}cr-{E(f["id"])}">{_img(f["frame"], f["beat"])}<figcaption><span class="cr-t">{E(f["t"])}</span> '
                     f'{E(f["beat"])}</figcaption></figure>' for f in sheet['storyboard']['frames'])
    expect = ''.join(f'<li>{E(ln.strip().lstrip("-*").strip())}</li>' for ln in sheet['storyboard']['expect'].split('\n') if ln.strip())
    e_sec = (f'<section class="cr-sec" data-cr="storyboard" aria-labelledby="{p}cr-e"><h3 id="{p}cr-e">E. Storyboard, the {"5-minute" if sheet["cut"] == "long" else "90-second"} cut</h3>'
             f'<div class="cr-board">{frames}</div><h4 class="gate-sub">What this cut will and will not do</h4><ul class="gate-expect">{expect}</ul></section>')
    thumbs = ''.join(f'<figure class="cr-opt cr-thumb" data-cr-opt="{E(t["id"])}">{_img(t["grid"], t["name"] + " in the Instagram grid")}'
                     f'{_img(t["results"], t["name"] + " in YouTube results")}<figcaption><b>{E(t["name"])}</b></figcaption>'
                     f'{_pick("thumbnail", t["id"], "Pick")}</figure>' for t in sheet['thumbnails'])
    f_sec = (f'<section class="cr-sec" data-cr="thumbnail" aria-labelledby="{p}cr-f"><h3 id="{p}cr-f">F. Thumbnail: pick one, seen where it will sit</h3>'
             f'<p class="rec-how">Each in the Instagram grid (the 3:4 crop, beside the last five posts) and in a YouTube results row.</p>'
             f'<div class="cr-opts">{thumbs}</div></section>')
    after = sheet['after']
    g_sec = (f'<section class="cr-sec" data-cr="after" aria-labelledby="{p}cr-g"><h3 id="{p}cr-g">G. What happens after you sign</h3><ul>'
             + ''.join(f'<li>{E(b)}</li>' for b in after['builds'])
             + f'</ul><p class="rec-how">Then Approve proof below. At most {after["loops"]} full render{"s" if after["loops"] != 1 else ""}, then it comes back to you. '
               'Nothing is built that is not on this sheet.</p></section>')
    shown = ' '.join(m['module'] for m in sheet['motion'])
    return (f'<div class="rec cr" id="{p}creative" role="region" aria-labelledby="{p}creative-h" data-creative-day="{day}" '
            f'data-piece="{E(sheet["piece_id"])}" data-creative-sha="{sheet["sha256"]}" data-storyboard-sha="{sheet["storyboard_sha256"]}" '
            f'data-shown="{E(shown)}"><div class="rec-head"><h2 id="{p}creative-h">Creative</h2></div>'
            '<p class="rec-how">One sheet, one press. Every option is drawn on a frame of your own take. Codex and ve build only what you sign here.</p>'
            + a_sec + b_sec + c_sec + d_sec + e_sec + f_sec + g_sec
            + f'<label class="gate-words cr-words">Your words (needed for Change it, optional with Sign): '
              f'<textarea data-cr-words="{day}" rows="2" maxlength="2000" disabled></textarea></label>'
            f'<div class="cr-row"><button type="button" class="btn-s" data-act="creative" data-value="sign" data-day="{day}" disabled>Sign creative</button>'
            f'<button type="button" class="tri" data-act="creative" data-value="change" data-day="{day}" disabled>Change it</button></div>'
            f'<p class="tri-state" data-crstate="{day}" aria-live="polite"></p></div>')


# ------------------------------------------------------------------ bugs, and the Last week tab

BUG_STATES = ('open', 'guarded', 'fixed')


def read_bugs(data, where='--bugs'):
    """[{id, piece_id?, date?, title, cause, guard?, state, file?}] from bugs.json: each file in Bugs & Issues, attached
    to the post it was found on (its piece, or the date it went out), with its cause, the guard that catches it now,
    and whether it is open, guarded or fixed."""
    rows = data.get('bugs') if isinstance(data, dict) else data
    if not isinstance(rows, list):
        raise V4Error(f'{where}: give a list of {{"id", "piece_id" or "date", "title", "cause", "guard", "state"}}')
    out, problems = [], []
    for i, b in enumerate(rows):
        if not isinstance(b, dict):
            problems.append(f'bug {i + 1} is not an object')
            continue
        bid, piece, day = str(b.get('id') or ''), b.get('piece_id'), b.get('date')
        ok = bool(OPTION_ID.match(bid))
        try:
            d = date.fromisoformat(day) if day else None
        except (TypeError, ValueError):
            d, ok = None, False
        ok = ok and (piece is None or (isinstance(piece, str) and bool(UUID.match(piece)))) and (piece or d)
        ok = ok and bool(_line(b.get('title'), 200) and _line(b.get('cause'), 600)) and b.get('state') in BUG_STATES
        ok = ok and (b.get('guard') is None or bool(_line(b.get('guard'), 400)))
        f = b.get('file')
        ok = ok and (f is None or (isinstance(f, dict) and _line(f.get('label'), 120) and re.match(r'^https://\S+$', str(f.get('url') or ''))))
        if not ok:
            problems.append(f'bug {bid or i + 1}: give id, piece_id or date (YYYY-MM-DD), title, cause, state (open, guarded or fixed), '
                            'and guard and file {label, url} when there are')
            continue
        out.append({'id': bid, 'piece_id': piece, 'date': d, 'title': _line(b['title'], 200), 'cause': _line(b['cause'], 600),
                    'guard': _line(b.get('guard'), 400), 'state': b['state'], 'file': f})
    if problems:
        raise V4Error(f'{where}:\n  ' + '\n  '.join(problems))
    return out


def bugs_for(bugs, piece=None, when=None):
    return [b for b in bugs or [] if (piece and b['piece_id'] == piece) or (not b['piece_id'] and when and b['date'] == when)]


def bugs_block(bugs, p):
    """The bugs found on a post, each with its cause, the guard that catches it now, and its state."""
    if not bugs:
        return ''
    word = {'open': 'open', 'guarded': 'guarded now', 'fixed': 'fixed'}
    items = ''.join(
        f'<li class="bug {b["state"]}" data-bug="{E(b["id"])}"><b>{E(b["title"])}</b> <span class="bug-state">{word[b["state"]]}</span>'
        f'<p>Cause: {E(b["cause"])}</p>' + (f'<p>Caught by: {E(b["guard"])}</p>' if b.get('guard') else '<p>No guard catches it yet.</p>')
        + (f'<p><a href="{E(b["file"]["url"])}" target="_blank" rel="noopener">{E(b["file"]["label"])}</a></p>' if b.get('file') else '')
        + '</li>' for b in bugs)
    n_open = sum(1 for b in bugs if b['state'] == 'open')
    return (f'<div class="bugs" id="{p}bugs"><h3>Bugs found on this post ({len(bugs)}{f", {n_open} open" if n_open else ""})</h3>'
            f'<ul>{items}</ul></div>')


POST_KINDS = {'piece': 'Weekly piece', 'carousel': 'Carousel', 'meme': 'Meme', 'short': 'Short', 'news': 'Good news',
              'note': 'Post', 'none': 'No post'}


def read_lastweek(data, monday_before, where='--last-week'):
    """{'week': date, 'posts': [...]} from lastweek.json: every post of the week before, Monday to Saturday, off days
    included, so he can score each (Krish, 2026-11-07: "It also doesn't allow me to give feedback for every day of
    publishing stuff last week, say, for example, the off days")."""
    if not isinstance(data, dict) or not isinstance(data.get('posts'), list):
        raise V4Error(f'{where}: give {{"week": "YYYY-MM-DD", "posts": [{{"date", "kind", "title", ...}}]}}')
    try:
        week = date.fromisoformat(str(data.get('week')))
    except ValueError:
        raise V4Error(f'{where}: week is the Monday of last week, YYYY-MM-DD')
    if week != monday_before:
        raise V4Error(f'{where}: week is {week.isoformat()}; last week started {monday_before.isoformat()}')
    out, problems, slots = [], [], set()
    for i, p in enumerate(data['posts']):
        if not isinstance(p, dict):
            problems.append(f'post {i + 1} is not an object')
            continue
        try:
            d = date.fromisoformat(str(p.get('date')))
        except ValueError:
            problems.append(f'post {i + 1}: date is YYYY-MM-DD')
            continue
        slot = str(p.get('slot') or '')
        ok = 0 <= (d - week).days <= 5 and p.get('kind') in POST_KINDS and _line(p.get('title'), 300)
        ok = ok and (not slot or OPTION_ID.match(slot)) and (d, slot) not in slots
        piece = p.get('piece_id')
        ok = ok and (piece is None or (isinstance(piece, str) and UUID.match(piece)))
        links = p.get('live') or []
        ok = ok and isinstance(links, list) and all(isinstance(x, dict) and _line(x.get('label'), 80) and re.match(r'^https://\S+$', str(x.get('url') or '')) for x in links)
        views = p.get('views')
        ok = ok and (views is None or (isinstance(views, int) and not isinstance(views, bool) and views >= 0))
        sc = p.get('scores')
        ok = ok and (sc is None or (isinstance(sc, dict) and all(isinstance(sc.get(k), int) and 1 <= sc[k] <= 10 for k in ('narrative', 'production'))))
        if p.get('kind') == 'none':
            ok = ok and bool(_line(p.get('why'), 400))
        if not ok:
            problems.append(f'post {i + 1} ({p.get("date")}): date in last week, kind ({", ".join(POST_KINDS)}), title, and when given '
                            'piece_id (uuid), live [{label, url}], views (a whole number), scores {narrative, production} 1 to 10, '
                            'slot (two posts on one date), why (a day with no post)')
            continue
        slots.add((d, slot))
        out.append({'date': d, 'slot': slot or None, 'kind': p['kind'], 'title': _line(p['title'], 300), 'piece_id': piece,
                    'series': p.get('series') if p.get('series') in SERIES_CLASS else None, 'live': links, 'views': views,
                    'views_from': _line(p.get('views_from'), 120), 'scores': sc, 'why': _line(p.get('why'), 400),
                    'lessons': p.get('lessons') if isinstance(p.get('lessons'), dict) and re.match(r'^https://\S+$', str(p['lessons'].get('url') or '')) else None})
    if problems:
        raise V4Error(f'{where}:\n  ' + '\n  '.join(problems))
    out.sort(key=lambda r: (r['date'], r['slot'] or ''))
    return {'week': week, 'posts': out}


def score_doc(piece, when, slot=None):
    """The picks document a post's Scores press saves: score-<piece> for a post with its piece, else score-<date>[-<slot>]."""
    if piece:
        return f'score-{piece}'
    return f'score-{when.isoformat()}' + (f'-{slot}' if slot else '')


def lastweek_rows(lw, bugs, scores_card):
    """The Last week tab's list: one row per post, each with what went out, where, its views, its bugs and his Scores
    press (scores_card from week_board). A day with no post says why."""
    rows = []
    for n, r in enumerate(lw['posts'], 1):
        p = f'lw{n}-'
        d = r['date']
        label = f'{d.strftime("%a")} {d.day}'
        links = ' · '.join(f'<a href="{E(x["url"])}" target="_blank" rel="noopener">{E(x["label"])}</a>' for x in r['live'])
        views = (f'{r["views"]:,} views' + (f' ({E(r["views_from"])})' if r.get('views_from') else '')) if r['views'] is not None else 'views from Growth'
        shown = (f'Your scores: narrative {r["scores"]["narrative"]}/10, production {r["scores"]["production"]}/10.' if r.get('scores') else None)
        body = (f'<p class="lw-why">{E(r["why"])}</p>' + (f'<p class="id-how"><a href="{E(r["lessons"]["url"])}">{E(r["lessons"].get("label") or "What we learned")}</a></p>'
                                                         if r.get('lessons') else '')
                if r['kind'] == 'none' else
                (f'<p class="lw-live">{links}</p>' if links else '') + f'<p class="lw-views">{views}</p>'
                + bugs_block(bugs_for(bugs, r['piece_id'], d), p)
                + scores_card(p, r['piece_id'], 'hindsight', shown, doc=score_doc(r['piece_id'], d, r['slot']), when=d, title=r['title']))
        rows.append(f'<li class="lw-row" data-date="{d.isoformat()}"><div class="lw-head"><span class="dk-pill {SERIES_CLASS.get(r.get("series") or "", "off")}">'
                    f'{E(label)}</span><b class="lw-title">{E(r["title"])}</b><span class="id-flag">{E(POST_KINDS[r["kind"]])}</span></div>{body}</li>')
    return f'<div class="lw"><ol class="lw-list">{"".join(rows)}</ol></div>' if rows else (
        '<div class="lw"><div class="slot-empty"><p>Last week\'s posts are not on the board yet.</p></div></div>')


# ------------------------------------------------------------------ styles

CSS = """
.v4-stages{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:3px;list-style:none;margin:10px 0 0;padding:0}
.v4-s{display:grid;gap:3px;min-width:0}
.v4-bar{display:block;height:8px;border-radius:3px;background:var(--line)}
.v4-s.done .v4-bar,.v4-k.done{background:var(--ok)}
.v4-s.others .v4-bar,.v4-k.others{background:#c98a1b}
.v4-s.you .v4-bar,.v4-k.you{background:var(--bad)}
.v4-s.skip .v4-bar{background:repeating-linear-gradient(45deg,var(--line) 0 3px,transparent 3px 6px)}
.v4-sl{font:600 10px/1.1 "IBM Plex Mono",ui-monospace,monospace;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.v4-s.you .v4-sl{color:var(--bad)}
.v4-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.v4-legend{font-size:12px;color:var(--muted);display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;margin:8px 0}
.v4-k{display:inline-block;width:14px;height:8px;border-radius:2px;background:var(--line);margin-right:4px}
.desk{display:grid;gap:10px}
.dk-h{font:400 22px/1.05 Anton,Impact,sans-serif;text-transform:uppercase;margin:14px 0 4px}
.dk-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.dk-ask{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 12px}
.dk-what{display:grid;gap:2px;min-width:0}
.dk-what b{font-size:15px}
.dk-detail{font-size:13px;color:var(--muted)}
.dk-due{font:700 12px "IBM Plex Mono",ui-monospace,monospace;color:var(--bad)}
.dk-ask .btn.go{display:inline-flex;align-items:center;justify-content:center;min-height:44px;min-width:76px;padding:8px 12px;border-radius:999px;background:var(--ink);color:var(--bg);font:700 13px Archivo,system-ui,sans-serif;text-decoration:none}
.dk-pill{display:inline-block;font:700 11.5px "IBM Plex Mono",ui-monospace,monospace;padding:3px 8px;border-radius:999px;white-space:nowrap;border:1px solid var(--line);background:var(--card);color:var(--ink)}
.dk-pill.ftm{background:#f2c84b;color:#0C1512;border-color:transparent}.dk-pill.uth{background:#b9a3ff;color:#0C1512;border-color:transparent}
.dk-pill.mtg{background:#ff7a59;color:#0C1512;border-color:transparent}.dk-pill.off{background:var(--mint);color:#0C1512;border-color:transparent}
.dk-none{background:var(--card);border:1px dashed var(--line);border-radius:12px;padding:14px;margin:0}
.dk-wait{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0 12px}
.dk-wait summary{min-height:44px;display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:700;flex-wrap:wrap}
.dk-sub{font-weight:400;color:var(--muted);font-size:13px}
.dk-wait ul{margin:0 0 12px;padding-left:18px;font-size:14px;display:grid;gap:4px}
.dk-week{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.dk-day{display:grid;gap:6px;align-content:start;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px;color:var(--ink);text-decoration:none;min-height:44px}
.dk-title{font-weight:700;font-size:14px;line-height:1.25}
@media (max-width:420px){.dk-ask{grid-template-columns:minmax(0,1fr) auto}.dk-ask .dk-pill{grid-column:1/-1;justify-self:start}.dk-week{grid-template-columns:1fr 1fr}}
.rec.cr .cr-sec{border-top:1px solid var(--line);padding-top:10px;display:grid;gap:8px;min-width:0}
.rec.cr h3{margin:0;font-size:17px}
.cr-two,.cr-opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
.cr-fig,.cr-opt,.cr-sb{margin:0;display:grid;gap:6px;align-content:start;min-width:0}
.cr-img,.cr-clip{width:100%;height:auto;border-radius:8px;border:1px solid var(--line);background:#1d2a24;display:block}
.cr-opt.on{outline:3px solid var(--mint);outline-offset:2px;border-radius:8px}
.cr-pick[aria-pressed="true"]{background:var(--mint);border-color:var(--mint);color:#0C1512}
.cr-status{font:600 11px "IBM Plex Mono",ui-monospace,monospace;padding:2px 6px;border-radius:999px;border:1px solid var(--line);white-space:nowrap}
.cr-status.liked{border-color:var(--ok);color:var(--ok)}.cr-status.experiment{border-color:#c98a1b;color:#c98a1b}
.cr-board{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px}
.cr-t{font:700 11px "IBM Plex Mono",ui-monospace,monospace;color:var(--muted)}
.cr-alts{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.cr-alt{margin:0 0 4px}
.cr-row{display:flex;flex-wrap:wrap;gap:8px}
.cr-hook.ok{color:var(--ok)}.cr-hook.bad{color:var(--bad)}
.cr-never li{margin:2px 0}
.rec.cr .gate-words{display:grid;gap:4px;font-size:14px}
.rec.cr .gate-words textarea{width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--line);border-radius:8px;font:16px/1.4 system-ui,sans-serif;background:var(--bg);color:var(--ink)}
.rec.cr.on{border-color:var(--ok)}
.lw-list{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.lw-row{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;display:grid;gap:6px;min-width:0}
.lw-head{display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center}
.lw-title{flex:1 1 200px;min-width:0}
.lw-live,.lw-views,.lw-why{margin:0;font-size:14px}
.lw-views{color:var(--muted)}
.lw-row .rec.sc{margin:4px 0 0}
.bugs{border:1px solid var(--bad);border-radius:10px;padding:8px 10px}
.bugs h3{margin:0 0 4px;font-size:14px;color:var(--bad)}
.bugs ul{margin:0;padding-left:18px;font-size:14px;display:grid;gap:6px}
.bugs p{margin:2px 0}
.bug-state{font:600 11px "IBM Plex Mono",ui-monospace,monospace;color:var(--muted)}
.bug.open .bug-state{color:var(--bad)}
.day-head .v4-stages{max-width:560px}
.dk-day .v4-sl{display:none}
.subpanel .off-days,.subpanel .off-day,.subpanel .off-card,.subpanel .off-asset{min-width:0}
.subpanel .off-days{border-top:0;margin-top:0;padding-top:0;grid-template-columns:minmax(0,1fr)}
.subpanel .off-day{grid-template-columns:minmax(0,1fr)}
.subpanel .off-days .opt .id-flag{white-space:normal}
.dk-next{font-size:12.5px;color:var(--muted)}
.dk-next b{color:var(--ink);font-weight:600}
@media (max-width:760px){.wk.fixed.v4 .wk-in{grid-auto-columns:minmax(60px,1fr);overflow-x:auto;scrollbar-width:none;overscroll-behavior-x:contain}
.wk.fixed.v4 .wk-in::-webkit-scrollbar{display:none}}
"""
