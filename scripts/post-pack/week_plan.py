#!/usr/bin/env python3
"""The week's plan files, read and checked: what the ideas board's gate and the off-day runs check before anything
reaches the live board (docs/PUBLISH_BOARDS.md).

  - the ideas: coverage_problems (sources and the Wave 1 mix), style_problems (the style bank, config/style-references.json)
    and story_problems (Saturday's good-news stories), which board_feed.py cover and gate run;
  - the off days: read_offdays (ideas.json offdays) and read_growth_offdays (Growth's own plan for the week), which
    offday_pending.py and the revise run read, with side_sha, posts_needs and the recorded-piece fields;
  - Krish's saved edits: read_sweep and paragraphs, the shape edit_sweep.py writes and files on the piece.

These were the parts of week_board.py that outlived its page. The page itself, its builder, its publisher and its
workflow were retired for good on 13 November 2026 (Ruling, Krish, 2026-11-13: "We need to retire the old publish boards
now permanently"; docs/history/2026-11-13-old-boards-retired.md). The live board is Control Centre's Content tab
(scripts/post-pack/live_board.py), drawn from the engine's view; nothing here builds or publishes a page, and nothing
here writes anywhere.
"""
import hashlib
import json
import re
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import story_check  # noqa: E402  which cut a script's label names


HERE = Path(__file__).resolve().parent


UUID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)


# The publishing days (docs/CADENCE.md): key, tab id, name, days after Monday, series slug, series as written.
DAYS = (
    ('mon', 'monday', 'Monday', 0, 'follow_the_money', 'follow.the.money'),
    ('wed', 'wednesday', 'Wednesday', 2, 'under_the_hood', 'under.the.hood'),
    ('fri', 'friday', 'Friday', 4, 'mind_the_gap', 'mind.the.gap'),
)


DAY_KEYS = {k: k for k, *_ in DAYS} | {name: k for k, name, *_ in DAYS}


class BoardError(Exception):
    pass


PARA_SPLIT = re.compile(r'(\n(?:[ \t]*\n)+)')


def paragraphs(text):
    """A draft's paragraphs, numbered as the editor numbers them (week.js splits on the same blank lines)."""
    return PARA_SPLIT.split(text)[0::2]


# What edit_sweep.py writes (scripts/post-pack/edit_sweep.py): Krish, 2026-10-21, "If I make a statistical change or a
# narrative style change in one place, just make sure that those changes propagate and the next draft is consistent";
# asked how, he chose to apply the change everywhere in the piece and in later drafts and to be shown "also changed
# in" with an undo. The kinds are the classes the sweep and the ledger use (reason_code on content_edit_events).
EDIT_KINDS = {'number_fact': 'Number or fact', 'claim': 'Claim', 'structure': 'Structure', 'tone': 'Tone', 'wording': 'Wording'}


SWEEP_ID = re.compile(r'^[a-z0-9][a-z0-9-]{0,39}$')


SWEEP_GATES = {'story_check': 'the story check', 'voice_check': 'the voice check'}


def read_sweep(data, where='--sweep'):
    """One day's sweep: {day?, piece_id?, swept_at?, also_changed: [change], suggestions: [change], held: [{where, why,
    from?, to?}], gates: [{where, check, ok, problems}]}. A change is {id, where, kind, from, to, context?, applied?}.
    Fed, never shaped: a field the board has no place for is refused."""
    if not isinstance(data, dict):
        raise BoardError(f'{where}: give the JSON edit_sweep.py wrote ({{"also_changed": [...], ...}})')
    unknown = set(data) - {'day', 'piece_id', 'swept_at', 'also_changed', 'suggestions', 'held', 'gates', 'ledger', 'edits'}
    if unknown:
        raise BoardError(f'{where}: fields the board has no place for: {sorted(unknown)}')
    text = lambda v, n: isinstance(v, str) and len(v) <= n
    seen = set()

    def change(c, applied, i):
        if not isinstance(c, dict):
            raise BoardError(f'{where}: change {i} is not an object')
        cid = str(c.get('id') or '')
        if not SWEEP_ID.match(cid) or cid in seen:
            raise BoardError(f'{where}: change {i} needs its own id (a-z, 0-9 and -), not {cid!r}')
        seen.add(cid)
        if c.get('kind') not in EDIT_KINDS:
            raise BoardError(f'{where}: change {cid} has kind {c.get("kind")!r}, not one of {sorted(EDIT_KINDS)}')
        if not (text(c.get('where'), 200) and c['where'].strip()):
            raise BoardError(f'{where}: change {cid} does not say where it is')
        a, b = c.get('from', ''), c.get('to', '')
        if not (text(a, 600) and text(b, 600)) or a == b:
            raise BoardError(f'{where}: change {cid} needs from and to (at most 600 characters each, not the same)')
        if c.get('context') is not None and not text(c['context'], 600):
            raise BoardError(f'{where}: change {cid} has a context over 600 characters')
        return {'id': cid, 'where': c['where'].strip(), 'kind': c['kind'], 'from': a, 'to': b,
                'context': (c.get('context') or '').strip(), 'applied': applied}
    lists = {}
    for key, applied in (('also_changed', True), ('suggestions', False)):
        value = data.get(key) or []
        if not isinstance(value, list) or len(value) > 60:
            raise BoardError(f'{where}: {key} must be a list of at most 60 changes')
        lists[key] = [change(c, applied, i) for i, c in enumerate(value)]
    held = []
    for i, h in enumerate(data.get('held') or []):
        if not (isinstance(h, dict) and text(h.get('where'), 200) and text(h.get('why'), 300) and h['where'].strip() and h['why'].strip()):
            raise BoardError(f'{where}: held {i} needs where and why')
        held.append({'where': h['where'].strip(), 'why': h['why'].strip(), 'from': str(h.get('from') or '')[:600], 'to': str(h.get('to') or '')[:600]})
    gates = []
    for i, g in enumerate(data.get('gates') or []):
        if not (isinstance(g, dict) and text(g.get('where'), 200) and g.get('check') in SWEEP_GATES and isinstance(g.get('ok'), bool)):
            raise BoardError(f'{where}: gate {i} needs where, check ({", ".join(SWEEP_GATES)}) and ok')
        gates.append({'where': g['where'].strip(), 'check': g['check'], 'ok': g['ok'],
                      'problems': [str(x)[:300] for x in (g.get('problems') or [])[:10]]})
    return {'day': data.get('day') if data.get('day') in DAY_KEYS.values() else None,
            'piece_id': data.get('piece_id') if UUID.match(str(data.get('piece_id') or '')) else None,
            'swept_at': data.get('swept_at') if isinstance(data.get('swept_at'), str) else None,
            'also_changed': lists['also_changed'], 'suggestions': lists['suggestions'], 'held': held, 'gates': gates}


STYLES_PATH = HERE.parents[1] / 'config' / 'style-references.json'


def style_formats(path=None):
    """{'script': {id: format}, 'production': {id: format}, 'divergence': {...}} from the style bank's formats
    (config/style-references.json). Krish, 2026-10-24: "suggest script and production styles that I can choose from
    or that it recommends for specific content"."""
    data = json.loads(Path(path or STYLES_PATH).read_text(encoding='utf-8'))
    f = data.get('formats') or {}
    return {'script': {x['id']: x for x in f.get('script') or []}, 'production': {x['id']: x for x in f.get('production') or []},
            'divergence': f.get('divergence') or {}}


def style_problems(data, formats=None):
    """What is wrong with the ideas' styles, [] when none. Every idea in a fixed week carries
    style {script, production, experiment: {format, why}}, each a format id from the bank; none he marked not for us;
    and the week diverges (Krish, 2026-10-24: "we still need to be producing better and more divergent work")."""
    formats = formats or style_formats()
    rules = formats['divergence']
    out, week_production = [], []
    for key, _, weekday, *_ in DAYS:
        ideas = ((data or {}).get('days') or {}).get(key) or []
        scripts, experiments = set(), 0
        for n, idea in enumerate(ideas, 1):
            st = idea.get('style') if isinstance(idea, dict) else None
            if not isinstance(st, dict):
                out.append(f'{weekday} idea {n}: no style; give style.script, style.production and style.experiment from config/style-references.json formats')
                continue
            for kind in ('script', 'production'):
                fid = st.get(kind)
                fmt = formats[kind].get(fid)
                if not fmt:
                    out.append(f'{weekday} idea {n}: style.{kind} {fid!r} is not a {kind} format in the bank')
                elif fmt.get('krish_verdict') == 'not for us':
                    out.append(f'{weekday} idea {n}: style.{kind} {fid!r} is marked not for us; never offer it again')
            scripts.add(st.get('script'))
            week_production.append(st.get('production'))
            ex = st.get('experiment')
            if not isinstance(ex, dict) or not str(ex.get('why') or '').strip():
                out.append(f'{weekday} idea {n}: style.experiment needs a format and a why: the bolder version the engine would try')
                continue
            fmt = formats['script'].get(ex.get('format')) or formats['production'].get(ex.get('format'))
            if not fmt:
                out.append(f'{weekday} idea {n}: style.experiment {ex.get("format")!r} is not a format in the bank')
            elif fmt.get('krish_verdict') == 'not for us':
                out.append(f'{weekday} idea {n}: style.experiment {ex.get("format")!r} is marked not for us')
            elif fmt.get('status') in ('experimental', 'trial') and ex.get('format') not in (st.get('script'), st.get('production')):
                experiments += 1
        if ideas and len(scripts - {None}) < rules.get('min_script_formats_per_day', 2):
            out.append(f'{weekday}: {len(scripts - {None})} script format(s) across its ideas; give at least {rules.get("min_script_formats_per_day", 2)}')
        if ideas and experiments < rules.get('experiments_per_day', 1):
            out.append(f'{weekday}: no idea offers an untried format as its experiment; push at least {rules.get("experiments_per_day", 1)}')
    used = [p for p in week_production if p]
    if used:
        if len(set(used)) < rules.get('min_production_formats_per_week', 3):
            out.append(f'the week: {len(set(used))} production format(s); recommend at least {rules.get("min_production_formats_per_week", 3)}')
        top = max(used.count(p) for p in set(used)) / len(used)
        if top > rules.get('max_share_of_one_production_format', 0.5):
            out.append(f'the week: one production format is {round(top * 100)}% of the recommendations; at most {round(rules.get("max_share_of_one_production_format", 0.5) * 100)}%')
    return out


def coverage_problems(data, sources):
    """Every id the gather says the board owes him (sources.json must_cover: Inspiration cards he routed to Make a
    piece, board items holding his words) is in some idea's `covers`, or in ideas.json `accounted` with a reason.
    Krish, 2026-10-24: "Double check my inspirationhouse gets read properly when ideas are being built"."""
    owed = [m for m in (sources or {}).get('must_cover') or [] if isinstance(m, dict) and m.get('id')]
    # An off-day option covers too (Krish, 2026-10-29: an idea he drops in may be a Tuesday, Thursday, Saturday or
    # Sunday piece).
    offdays = (data or {}).get('offdays') if isinstance((data or {}).get('offdays'), dict) else {}
    options = [i for ideas in ((data or {}).get('days') or {}).values() for i in ideas or []] + \
              [o for opts in offdays.values() if isinstance(opts, list) for o in opts]
    covered = {str(c) for i in options if isinstance(i, dict) for c in (i.get('covers') or [])}
    accounted = (data or {}).get('accounted') or {}
    out = []
    if not isinstance(accounted, dict):
        out.append('accounted is an object, {"<must_cover id>": "why it is not on the board"}')
        accounted = {}
    for m in owed:
        mid = str(m['id'])
        if mid in covered:
            continue
        why = accounted.get(mid)
        if isinstance(why, str) and len(why.strip()) >= 12:
            continue
        out.append(f'not on the board: {m.get("what") or mid} ({mid}); put it in an idea\'s covers, or say why in accounted')
    return out


# The off days (Krish, 2026-10-28: "I'm happy to plan the Tuesday, Thursday, Saturday, and Sunday content within the
# Sunday ideas session if you give me a few options to approve as you do the Mon/wed/fri"): two or three options a
# day, from ideas.json's `offdays`, each with its format, its source and its draft copy, and his Approve or Skip, saved
# in queue/off-<day>-<option> bound to the copy he saw (copy_sha256). Growth makes and schedules what he approved.
OFF_DAYS = (('tue', 'Tuesday', 1), ('thu', 'Thursday', 3), ('sat', 'Saturday', 5))


# Ruling (Krish, 2026-11-02): "Let's eliminate Sunday from Publishing anythign permanently. Sunday is rest and planning
# and ideation day." Nothing is offered or published on Sunday; it stays the day the ideas board is built.
REST_DAYS = {'sun'}


OFF_ID = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_.:-]{0,59}$')


# Growth's off-day lane runs every day (Krish, 2026-10-29, choosing between two rulings: "Mix wins: every day"), so its
# options (growth.py mix offdays, schema growth-offdays/1) may name Monday, Wednesday and Friday too; the series slot on
# those days stays reserved for the piece's own cut, which is Growth's to keep. A piece he records stays an off-day
# piece: Tuesday, Thursday, Saturday or Sunday.
MIX_DAYS = (('mon', 'Monday', 0), ('tue', 'Tuesday', 1), ('wed', 'Wednesday', 2), ('thu', 'Thursday', 3),
            ('fri', 'Friday', 4), ('sat', 'Saturday', 5), ('sun', 'Sunday', 6))


# An off-day piece he records (Ruling, Krish, 2026-10-29: an idea he drops in can be a Tuesday, Thursday, Saturday or
# Sunday piece, and it is one short cut: "could be a short with motion designed subtitles and branding, or voiceover
# with motion designed infographics"). Its option carries the exact words he would read; his Approve is his approval
# of those words, and the server then schedules the piece and sends the script to Teleprompter
# (apps/control-plane/api/board/_presses.ts, offdayRecorded).
RECORDED_STYLES = {'to_camera': 'Said to camera', 'voiceover': 'Voiceover with motion graphics'}


RECORDED_WORDS = (160, 195)  # a 90-second cut that finishes under 89 seconds (story_check's short cut)


SERIES_LABELS = {slug: label for *_, slug, label in DAYS}


# Each off day is triaged like Monday, Wednesday and Friday (Ruling, Krish, 2026-11-01, locking the off-day mock in
# docs/handovers/board-mocks-2026-11-01-offdays/: "Mock looks right, lock it and build it"). He asked for it: "I need
# Ideas and a suggested creative direction to approve or improve or flat out reject for a reason, and the machine can
# learn over time". So a day holds up to six options, each an idea (its hook and pitch, the saved post that inspired
# it, the words of his that shaped it) and a suggested creative direction (the look, the frames, the tone, the kit),
# and each side takes Approve, Improve (his words, then a revised card) or Reject (his reason).
OFF_OPTIONS = (2, 6)


OFF_FRAMES = (1, 12)


OFF_PITCH = ('see', 'lands', 'why_now', 'share')


OFF_DIRECTION = ('look', 'format', 'tone', 'kit', 'inspo_url')


OFF_SIDES = ('idea', 'direction', 'mock')


OFF_SLIDES = (1, 10)  # Buffer posts at most ten images (Krish, 2026-11-05: "carousels can only have 10 cards maximum")


DRIVE_FOLDER = re.compile(r'^https://drive\.google\.com/drive/(?:u/\d/)?folders/[A-Za-z0-9_-]{10,}(?:\?[^\s"<>]*)?$')


def _line(v, cap):
    return ' '.join(str(v).split())[:cap] if isinstance(v, str) and v.strip() else None


def off_rich(o, problems, label):
    """The rich fields of an off-day option, checked: hook, pitch, inspiration, learned_from, direction, ties_to,
    recommended, revised and a returned mock. Each is optional; a wrong shape is a problem, never dropped quietly."""
    row = {}
    if o.get('hook') is not None:
        if not _line(o['hook'], 10_000) or len(' '.join(str(o['hook']).split())) > 140:
            problems.append(f'{label}: hook is one line of up to 140 characters')
        else:
            row['hook'] = _line(o['hook'], 140)
    pitch = o.get('pitch')
    if pitch is not None:
        if not isinstance(pitch, dict) or set(pitch) - set(OFF_PITCH) or not any(_line(pitch.get(k), 600) for k in OFF_PITCH):
            problems.append(f'{label}: pitch is {{{", ".join(OFF_PITCH)}}}, each one line')
        else:
            row['pitch'] = {k: _line(pitch.get(k), 600) for k in OFF_PITCH if _line(pitch.get(k), 600)}
    ins = o.get('inspiration')
    if ins is not None:
        url = ins.get('url') if isinstance(ins, dict) else None
        if not isinstance(ins, dict) or not _line(ins.get('label'), 300) or (url and not str(url).startswith('https://')):
            problems.append(f'{label}: inspiration is {{"label", "url" (https), "saved" (when he saved it)}}')
        else:
            row['inspiration'] = {'label': _line(ins['label'], 300), 'url': url or None, 'saved': _line(ins.get('saved'), 40)}
    learned = o.get('learned_from')
    if learned is not None:
        if not isinstance(learned, list) or len(learned) > 3 or not all(_line(x, 10_000) and len(' '.join(x.split())) <= 400 for x in learned):
            problems.append(f'{label}: learned_from is up to three of his words that shaped it, each up to 400 characters, never cut')
        else:
            row['learned_from'] = [_line(x, 400) for x in learned]
    d = o.get('direction')
    if d is not None:
        frames = d.get('frames') if isinstance(d, dict) else None
        bad = not isinstance(d, dict) or set(d) - set(OFF_DIRECTION) - {'frames'} or not _line(d.get('look'), 600)
        if not bad and frames is not None:
            bad = not isinstance(frames, list) or not OFF_FRAMES[0] <= len(frames) <= OFF_FRAMES[1] or not all(
                isinstance(f, dict) and not set(f) - {'words', 'picture'} and _line(f.get('words'), 200) and _line(f.get('picture'), 300) for f in frames)
        if not bad and d.get('inspo_url') and not str(d['inspo_url']).startswith('https://'):
            bad = True
        if bad:
            problems.append(f'{label}: direction is {{"look", "format", "frames": [{{"words", "picture"}}], "tone", "kit", "inspo_url"}} with its look')
        else:
            row['direction'] = {k: _line(d.get(k), 600) for k in OFF_DIRECTION if _line(d.get(k), 600)}
            if frames:
                row['direction']['frames'] = [{'words': _line(f['words'], 200), 'picture': _line(f['picture'], 300)} for f in frames]
    if o.get('ties_to') is not None:
        row['ties_to'] = _line(o['ties_to'], 80) or problems.append(f'{label}: ties_to is one line') or None
    if o.get('recommended') is not None:
        if not isinstance(o['recommended'], bool):
            problems.append(f'{label}: recommended is true or false')
        elif o['recommended']:
            row['recommended'] = True
    rev = o.get('revised')
    if rev is not None:
        if not isinstance(rev, dict) or rev.get('side') not in ('idea', 'direction', 'mock') or not _line(rev.get('words'), 2000):
            problems.append(f'{label}: revised is {{"side": idea, direction or mock, "words": his words it answers}}')
        else:
            row['revised'] = {'side': rev['side'], 'words': _line(rev['words'], 2000)}
    mock = o.get('mock')
    if mock is not None:
        if not isinstance(mock, dict) or not str(mock.get('url') or '').startswith('https://'):
            problems.append(f'{label}: mock is {{"url" (https, the image Growth made), "note"}}')
        else:
            row['mock'] = {'url': mock['url'], 'note': _line(mock.get('note'), 300)}
    # A finished file Krish takes away from the card (Krish, 2026-11-02: "put the translator video on the board as a
    # download"): the board's own stored asset, so the link never moves.
    # A settled option leaves the Today view (Krish, 2026-11-02, on Today: "I can barely ever see what the current state
    # of things are there"): merged into another, or not chosen. It stays on the Ideas tab as history.
    closed = o.get('closed')
    if closed is not None:
        if not _line(closed, 300):
            problems.append(f'{label}: closed is one line saying why it is settled')
        else:
            row['closed'] = _line(closed, 300)
    # An option Krish has already judged and that will run (Krish, 2026-11-04: the board said "12 options to judge" after
    # he had judged every one). It stays on the calendar as a post being made and leaves the judge count.
    decided = o.get('decided')
    if decided is not None:
        if not _line(decided, 300):
            problems.append(f'{label}: decided is one line saying what he decided and who makes it')
        else:
            row['decided'] = _line(decided, 300)
    download = o.get('download')
    if download is not None:
        if not isinstance(download, dict) or not str(download.get('url') or '').startswith('https://') or not _line(download.get('label'), 120):
            problems.append(f'{label}: download is {{"url" (https, the finished file), "label"}}')
        else:
            row['download'] = {'url': download['url'], 'label': _line(download['label'], 120)}
    # The finished asset shown on the board itself (Ruling, Krish, 2026-11-03: "I should be able to see the assets directly
    # in the publish board or have a link to the Google Drive where the assets are. I shouldn't have to download a fucking
    # zip and then look at it that way"): every slide as its own picture, or the video to play, and the Drive folder.
    slides = o.get('slides')
    if slides is not None:
        if (not isinstance(slides, list) or not OFF_SLIDES[0] <= len(slides) <= OFF_SLIDES[1]
                or not all(isinstance(x, dict) and not set(x) - {'url', 'label'} and str(x.get('url') or '').startswith('https://')
                           for x in slides)):
            problems.append(f'{label}: slides is [{{"url" (https, one finished slide), "label"}}], {OFF_SLIDES[0]} to {OFF_SLIDES[1]} of them, in order')
        else:
            row['slides'] = [{'url': x['url'], 'label': _line(x.get('label'), 120) or f'Slide {i}'} for i, x in enumerate(slides, 1)]
    video = o.get('video')
    if video is not None:
        if (not isinstance(video, dict) or set(video) - {'url', 'poster'} or not str(video.get('url') or '').startswith('https://')
                or (video.get('poster') and not str(video['poster']).startswith('https://'))):
            problems.append(f'{label}: video is {{"url" (https, the finished video), "poster" (https)}}')
        else:
            row['video'] = {'url': video['url'], 'poster': video.get('poster') or None}
    drive = o.get('drive')
    if drive is not None:
        if not isinstance(drive, str) or not DRIVE_FOLDER.match(drive):
            problems.append(f'{label}: drive is the https://drive.google.com/drive/folders/... link to the asset\'s folder')
        else:
            row['drive'] = drive
    return {k: v for k, v in row.items() if v is not None}


# A finished asset is done only when it is in its post's 3 Posts folder (Ruling, Krish, 2026-11-03: "everything ready
# for post goes in the posts folder, not the growth folder"): the card links that folder (`drive`). Until then the card
# says so instead of offering the file as ready.
NOT_IN_POSTS = 'Not in its 3 Posts folder yet: file it there and link the folder (drive) before it counts as ready'


IN_GROWTH = ('Filed in 4 Growth, which is not where Krish looks: move it to its post\'s 3 Posts folder and link that '
             'folder (drive) before it counts as ready')


NOT_NAMED = ('Its 3 Posts folder is not named: say "3 Posts › YYYY-MM-DD Ddd off.day - Subject" (or posts_folder) so '
             'the link can be checked against the post it belongs to')


NAMED_FOLDER = re.compile(r'3 Posts\s*›\s*([^;›]+?)\s*(?:;|$)')


def posts_needs(o, day=None):
    """The needs line a finished option carries until it is in its own post's 3 Posts folder: it links a Drive
    folder (drive), names that folder (posts_folder, or "3 Posts › <folder>" in its needs) as a post folder the
    library takes, and never points at 4 Growth. A bare Drive link is not enough: any folder would pass."""
    finished = bool(o.get('download')) or bool(o.get('video')) or bool(o.get('slides')) or bool(o.get('ready'))
    needs = [str(x) for x in (o.get('needs') or []) if isinstance(x, str)] if isinstance(o.get('needs'), list) else []
    if any('4 Growth' in line for line in needs):
        return [IN_GROWTH]
    if not finished:
        return []
    drive = o.get('drive')
    if not (isinstance(drive, str) and DRIVE_FOLDER.match(drive)):
        return [NOT_IN_POSTS]
    named = o.get('posts_folder') or next((m[1] for line in needs for m in [NAMED_FOLDER.search(line)] if m), None)
    if not (isinstance(named, str) and _library().is_post_folder(named.strip())):
        return [NOT_NAMED]
    if day and not named.strip().startswith(str(day)):
        return [f'Its 3 Posts folder ({named.strip()}) is another day\'s post, not {day}\'s: link this post\'s own folder']
    return []


def _library():
    import library  # scripts/post-pack/library.py, the one folder rule
    return library


def side_sha(o, side):
    """The sha256 his press on one side of an option is bound to: what that side showed him. A revision changes it,
    so an old press reads as answered rather than as a press on the new words."""
    if side == 'idea':
        shown = {'copy': o.get('copy'), 'hook': o.get('hook'), 'pitch': o.get('pitch'), 'cards': o.get('cards')}
    elif side == 'direction':
        shown = o.get('direction') or {}
    else:
        shown = dict(o.get('mock') or {})
        # His Approve on the mock covers every slide and the video he saw, so a re-render reads as a new mock to judge.
        if o.get('slides'):
            shown['slides'] = [x['url'] for x in o['slides']]
        if o.get('video'):
            shown['video'] = o['video']['url']
    return hashlib.sha256(json.dumps(shown, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def read_offdays(data, where='ideas.json offdays', whole=False):
    """{day: [{'id', 'format', 'source', 'url', 'copy', 'copy_sha256'}]}, or None when there are none. Each day given
    holds 2 to 6 options; a day left out is said on the tab."""
    if data is None:
        return None
    if not isinstance(data, dict):
        raise BoardError(f'{where}: give {{"tue": [options], "thu": [...], "sat": [...]}}')
    days = {k for k, *_ in MIX_DAYS}
    problems = [f'{k} is not a day ({", ".join(d for d, *_ in MIX_DAYS)})' for k in data if k not in days]
    problems += [f'{k}: Sunday is a rest day, nothing is published (Ruling, Krish, 2026-11-02)' for k in data if k in REST_DAYS]
    out = {}
    for key, weekday, _ in MIX_DAYS:
        opts = data.get(key)
        if opts is None or key in REST_DAYS:
            continue
        # A publishing day's off-day post sits beside the week's piece, one or more finished posts rather than a choice
        # (Krish, 2026-11-12, of Wednesday's Jensen Huang post: "Put them there so I can approve").
        least = 1 if key in ('mon', 'wed', 'fri') else OFF_OPTIONS[0]
        if not isinstance(opts, list) or not least <= len(opts) <= OFF_OPTIONS[1]:
            problems.append(f'{weekday}: give {least} to {OFF_OPTIONS[1]} options')
            continue
        rows, seen = [], set()
        for n, o in enumerate(opts, 1):
            o = o if isinstance(o, dict) else {}
            src = o.get('source')
            label, url = (src.get('label') or src.get('url'), src.get('url')) if isinstance(src, dict) else (src, None)
            missing = [f for f, v in (('format', o.get('format')), ('source', label), ('copy', o.get('copy'))) if not str(v or '').strip()]
            if missing:
                problems.append(f'{weekday} option {n}: no {", ".join(missing)}')
                continue
            if url and not str(url).startswith('https://'):
                problems.append(f'{weekday} option {n}: source.url is https')
            oid = str(o.get('id') or n)
            if not OFF_ID.match(oid) or oid in seen:
                problems.append(f'{weekday} option {n}: id {oid!r} is one short word, once a day')
            seen.add(oid)
            copy = str(o['copy']).strip()
            row = {'id': oid, 'format': str(o['format']).strip(), 'source': str(label).strip(), 'url': url or None,
                   'copy': copy, 'copy_sha256': hashlib.sha256(copy.encode('utf-8')).hexdigest()}
            for k in ('share_line', 'needs'):
                v = o.get(k)
                if v not in (None, '', []):
                    if k == 'needs' and isinstance(v, list) and all(isinstance(x, str) for x in v):
                        row[k] = [x.strip() for x in v if x.strip()]
                    elif k == 'share_line' and isinstance(v, str):
                        row[k] = ' '.join(v.split())
                    else:
                        problems.append(f'{weekday} option {n}: {k} is ' + ('a list of lines' if k == 'needs' else 'one line'))
            covers = o.get('covers')
            if covers is not None:
                if not isinstance(covers, list) or not all(isinstance(c, str) and c.strip() for c in covers):
                    problems.append(f'{weekday} option {n}: covers is a list of must_cover ids')
                else:
                    row['covers'] = [c.strip() for c in covers]
            cards = o.get('cards')
            if cards is not None:
                found = card_problems(cards)
                problems.extend(f'{weekday} option {n}: cards {p}' for p in found)
                if not found:
                    row['cards'] = [{'words': ' '.join(c['words'].split()), 'picture': ' '.join(c['picture'].split())} for c in cards]
            row.update(off_rich(o, problems, f'{weekday} option {n}'))
            if o.get('stories'):
                found = story_problems(o['stories'])
                problems.extend(f'{weekday} option {n}: stories {p}' for p in found)
                if not found:
                    row['stories'] = [{k: s[k] for k in ('headline', 'what', 'why', 'date', 'source', 'media')} for s in o['stories']]
            for k in ('weekly', 'stories_due'):
                if o.get(k) is not None:
                    row[k] = str(o[k])
            if whole:
                # Krish, 2026-11-02, of a one-blob Thursday option: "I have zero idea what this even means". From the
                # 9 Nov week every option he judges shows its hook, what he will see and why it lands, and its direction.
                gaps = [f for f, ok in (('hook', row.get('hook')), ('pitch.see', (row.get('pitch') or {}).get('see')),
                                        ('pitch.lands', (row.get('pitch') or {}).get('lands')), ('direction', row.get('direction'))) if not ok]
                if gaps:
                    problems.append(f'{weekday} option {n}: no {", ".join(gaps)}; he judges an option by these')
            extra = [line for line in posts_needs({**o, **row}) if line not in row.get('needs', [])]
            if extra:
                row['needs'] = row.get('needs', []) + extra
            if (row.get('slides') or row.get('video')) and not row.get('drive'):
                problems.append(f'{weekday} option {n}: a finished asset on the board carries its Drive folder (drive), '
                                'so he can open it there too (Ruling, Krish, 2026-11-03)')
            for side in OFF_SIDES:
                if side != 'mock' or finished(row):
                    row[f'{side}_sha256'] = side_sha(row, side)
            if o.get('kind') == 'recorded' and key not in {k for k, *_ in OFF_DAYS}:
                problems.append(f'{weekday} option {n}: a piece he records is a Tuesday, Thursday, Saturday or Sunday piece')
            elif o.get('kind') == 'recorded':
                found = recorded_problems(o)
                problems.extend(f'{weekday} option {n}: {p}' for p in found)
                if not found:
                    row.update(recorded_fields(o))
            elif o.get('kind') is not None:
                problems.append(f'{weekday} option {n}: kind is "recorded" or left out')
            rows.append(row)
        out[key] = rows
    if problems:
        raise BoardError(f'{where} is not ready to show:\n  ' + '\n  '.join(problems))
    return out


STORY_COUNT = 5  # the weekly good news (Krish, 2026-11-02: "find the actual good news on Sunday ... so that the news items are fresh";


def story_problems(stories):
    """Why a weekly good-news option's stories are not ready to show, or []: five real stories, each with its headline,
    what happened, why it matters, its date, its source and its own photo or clip (Krish, 2026-11-02, Improve on the
    7 Nov good news: "I want actual news items and the content we are going to use here - embedded real world images or
    videos")."""
    if not isinstance(stories, list) or len(stories) != STORY_COUNT:
        return [f'is a list of {STORY_COUNT} stories']
    out = []
    for i, st in enumerate(stories, 1):
        st = st if isinstance(st, dict) else {}
        src, media = st.get('source') or {}, st.get('media') or {}
        if not all(_line(st.get(k), 400) for k in ('headline', 'what', 'why')):
            out.append(f'{i} needs its headline, what happened and why it matters')
        try:
            date.fromisoformat(str(st.get('date')))
        except ValueError:
            out.append(f'{i} needs its date, YYYY-MM-DD')
        if not (isinstance(src, dict) and _line(src.get('label'), 200) and str(src.get('url') or '').startswith('https://')):
            out.append(f'{i} needs its source {{"label", "url" (https)}}')
        if not (isinstance(media, dict) and media.get('kind') in ('photo', 'clip') and str(media.get('url') or '').startswith('https://')):
            out.append(f'{i} needs its own photo or clip {{"kind": "photo" or "clip", "url" (https)}}')
    return out


OFF_CARDS = (2, 10)  # a carousel or a meme set, card by card (Krish, 2026-10-31: "carousels card by card"); at most ten, cover


def card_problems(cards):
    """Why an off-day option's cards ([{words, picture}], in order) are not ready to show, or []."""
    if not isinstance(cards, list) or not OFF_CARDS[0] <= len(cards) <= OFF_CARDS[1]:
        return [f'is a list of {OFF_CARDS[0]} to {OFF_CARDS[1]} cards, each {{"words", "picture"}}']
    out = []
    for i, c in enumerate(cards, 1):
        if not isinstance(c, dict) or set(c) - {'words', 'picture'}:
            out.append(f'{i} is {{"words", "picture"}} and nothing else')
        elif not all(isinstance(c.get(k), str) and c[k].strip() for k in ('words', 'picture')):
            out.append(f'{i} needs its words and what the picture shows')
    return out


def read_growth_offdays(data, monday, where='--offdays-plan'):
    """(offdays for read_offdays, warnings) from Growth's Sunday Off-days section (growth.py mix offdays, schema
    growth-offdays/1): {week_of, days: {date: [{concept_id, lane, formats, source_url, draft, share_line, needs, ready}]},
    short}. Each option is his to approve or skip with one press; its copy is Growth's draft, bound by its hash. A day
    with fewer than two options is left off and said."""
    if not isinstance(data, dict) or data.get('schema') != 'growth-offdays/1' or not isinstance(data.get('days'), dict):
        raise BoardError(f'{where}: give the growth-offdays/1 file growth.py mix offdays wrote')
    if str(data.get('week_of')) != monday.isoformat():
        raise BoardError(f'{where}: it is for the week of {data.get("week_of")}, not {monday.isoformat()}')
    by_offset = {off: k for k, _, off in MIX_DAYS}
    out, warnings = {}, []
    for day, opts in sorted(data['days'].items()):
        try:
            key = by_offset.get((date.fromisoformat(day) - monday).days)
        except ValueError:
            key = None
        if not key:
            raise BoardError(f'{where}: {day} is not a day of the week of {monday.isoformat()}')
        if key in REST_DAYS:
            warnings.append(f'{where}: {day} is a Sunday, a rest day (Ruling, Krish, 2026-11-02); its options are left off')
            continue
        opts = [o for o in opts or [] if isinstance(o, dict)][:OFF_OPTIONS[1]]
        if len(opts) < 2:
            warnings.append(f'{where}: {day} has {len(opts)} option(s) from Growth, under the two the board shows')
            continue
        out[key] = [{'id': o.get('concept_id'), 'format': ', '.join(o.get('formats') or []) or o.get('lane'),
                     'source': {'label': 'Source', 'url': o['source_url']} if str(o.get('source_url') or '').startswith('https://') else (o.get('lane') or 'Growth'),
                     'copy': o.get('draft'), 'share_line': o.get('share_line'),
                     'needs': list(o.get('needs') or []) + ([] if o.get('ready') else ['not ready yet'] if not o.get('needs') else [])
                     + posts_needs(o, day),
                     # The rich fields ride through as Growth wrote them (Ruling, Krish, 2026-11-01), never flattened into the copy.
                     **{k: o[k] for k in ('hook', 'pitch', 'cards', 'inspiration', 'learned_from', 'direction', 'ties_to', 'recommended', 'revised', 'mock', 'slides', 'video', 'drive', 'posts_folder', 'download', 'closed', 'decided')
                        if o.get(k) is not None}}
                    for o in opts]
    return out, warnings


def recorded_problems(o):
    """Why a recorded off-day option is not ready to show, or []. It names his idea (piece_id), its series, its style,
    a title, and the exact words, which pass the story check as a short cut (all but the article close, since an off-day
    piece has no article: house rule SCRIPT_CLOSE names the deep dive) and were read back by two fresh readers with
    nothing lost (house rule R7)."""
    import making
    import story_check
    import teleprompter_send as tps
    out = []
    if o.get('style') not in RECORDED_STYLES:
        out.append(f'style is one of {", ".join(RECORDED_STYLES)}')
    if not UUID.match(str(o.get('piece_id') or '')):
        out.append('piece_id is the content_ideas uuid of the idea it makes (his own, for an idea he dropped in)')
    if o.get('series') not in SERIES_LABELS:
        out.append(f'series is one of {", ".join(SERIES_LABELS)}')
    title = ' '.join(str(o.get('title') or '').split())
    if not 0 < len(title) <= 120:
        out.append('title is the piece\'s subject in one line of up to 120 characters (it names the Teleprompter script)')
    script = tps.spoken_text(str(o.get('script') or ''))
    words = len(script.split())
    if not RECORDED_WORDS[0] <= words <= RECORDED_WORDS[1]:
        out.append(f'script is the exact words he reads, {RECORDED_WORDS[0]} to {RECORDED_WORDS[1]} words (it has {words})')
    else:
        found = [p for p in story_check.problems(script, 'short') if 'SCRIPT_CLOSE' not in p]
        out.extend(f'script: {p}' for p in found[:5])
    rb = o.get('read_back') if isinstance(o.get('read_back'), dict) else {}
    readers = rb.get('readers') if isinstance(rb.get('readers'), list) else []
    if rb.get('found') != 'nothing lost' or not 2 <= len(readers) <= 6 or not all(isinstance(r, str) and r.strip() for r in readers):
        out.append('read_back is {"readers": [two to six fresh readers], "found": "nothing lost"} for these exact words (house rule R7)')
    elif rb.get('script_sha256') not in (None, making.script_hash(script)):
        out.append('read_back.script_sha256 is not the hash of these words: they changed after the readers heard them')
    return out


def recorded_fields(o):
    """What a ready recorded option adds to its row: the words as Teleprompter shows them, their hash (making.py
    script_hash, the same as the server's scriptHash), and the rest it needs."""
    import making
    import teleprompter_send as tps
    script = tps.spoken_text(str(o['script']))
    rb = o['read_back']
    return {'kind': 'recorded', 'style': o['style'], 'piece_id': str(o['piece_id']).lower(), 'series': o['series'],
            'title': ' '.join(str(o['title']).split()), 'script': script, 'script_sha256': making.script_hash(script),
            'read_back': {'readers': [str(r).strip() for r in rb['readers']], 'found': 'nothing lost'}}


def finished(o):
    """Whether an off-day option carries a finished asset he judges: the mock, its slides or its video."""
    return bool(o.get('mock') or o.get('slides') or o.get('video'))


# The ideas file itself (docs/plans/<Monday>-week/ideas.json), checked before the ideas board reads it: what the old
# builder refused before it drew the Ideas tab, kept when that builder was retired (13 Nov 2026) and run by
# board_feed.py cover. Every idea from the fixed layout of 26 Oct 2026 names where it came from.
FIXED_FROM = date(2026, 10, 26)


MIN_IDEAS = 4  # Krish, 2026-10-18: "at least three content ideas for each day", then "give me more than 3 from all my
# suggested sources and the ones I threw at other sessions last week"


# Where an idea came from, as its chip says it (GET /api/week/options?include=sources, _weekSources.ts).
SOURCE_KINDS = {'his': 'Your idea', 'inspo': 'From your inspo folder', 'engine': 'Engine research'}


class Ideas(dict):
    """{day: [idea]}, with .locked: {day: {piece_id, so_what, why}} for each day already picked."""
    locked = {}


def read_locked(data, problems):
    """{day: {piece_id, so_what, why}} from ideas.json `locked`: a publishing day whose piece is already picked or made
    (Krish, 2026-11-02: "Monday's piece is already done"). The board shows it as locked, with no options."""
    raw = data.get('locked') or {}
    if not isinstance(raw, dict):
        problems.append('locked is an object, {"mon": {"piece_id", "so_what", "why"}}')
        return {}
    days = {k: w for k, _, w, *_ in DAYS}
    out = {}
    for key, lock in raw.items():
        if key not in days:
            problems.append(f'locked: {key} is not a publishing day ({", ".join(days)})')
            continue
        lock = lock if isinstance(lock, dict) else {}
        missing = [f for f in ('piece_id', 'so_what', 'why') if not str(lock.get(f) or '').strip()]
        if missing:
            problems.append(f'locked {days[key]}: no {", ".join(missing)}')
            continue
        if not UUID.match(str(lock['piece_id'])):
            problems.append(f'locked {days[key]}: piece_id {lock["piece_id"]!r} is not a piece id')
            continue
        out[key] = {f: str(lock[f]).strip() for f in ('piece_id', 'so_what', 'why')}
    return out


def read_ideas(data, monday, where='--ideas'):
    """{day: [idea]} from an ideas file (docs/plans/<week>/ideas.json). Every
    idea is checked before it reaches him: what a business person finds out
    (so_what, in plain English, first: Krish, 2026-10-19, "Would I consider
    this story or angle?" needs the consequence, not the mechanism), its one-line story, why now with
    its date, its strongest fact, and the source that fact came from, linked.
    No titles: those are his, after he records (TITLES_AFTER_RECORDING)."""
    if not isinstance(data, dict) or not isinstance(data.get('days'), dict):
        raise BoardError(f'{where}: give {{"week_start": ..., "days": {{"mon": [ideas], "wed": [...], "fri": [...]}}}}')
    if data.get('week_start') and data['week_start'] != monday.isoformat():
        raise BoardError(f'{where} is for the week of {data["week_start"]}, not {monday.isoformat()}')
    out, problems = Ideas(), []
    out.locked = read_locked(data, problems)
    for key, _, weekday, *_ in DAYS:
        ideas = data['days'].get(key) or []
        if key in out.locked:
            # Ruling (Krish, 2026-11-02): "Monday's piece is already done". A day already picked offers nothing to pick.
            if ideas:
                problems.append(f'{weekday} is locked to its piece {out.locked[key]["piece_id"]}; it takes no options, give it none')
            out[key] = []
            continue
        if len(ideas) < MIN_IDEAS:
            problems.append(f'{weekday}: {len(ideas)} idea(s); give at least {MIN_IDEAS} to pick from')
        rows, seen = [], set()
        for n, idea in enumerate(ideas, 1):
            idea = idea if isinstance(idea, dict) else {}
            src = idea.get('source') if isinstance(idea.get('source'), dict) else {}
            missing = [f for f in ('so_what', 'story', 'why_now', 'fact') if not str(idea.get(f) or '').strip()]
            if not str(src.get('url') or '').startswith('https://'):
                missing.append('source.url (https)')
            if missing:
                problems.append(f'{weekday} idea {n}: no {", ".join(missing)}')
                continue
            if idea.get('id') and not UUID.match(str(idea['id'])):
                problems.append(f'{weekday} idea {n}: id {idea["id"]!r} is not a piece id')
            if idea.get('title'):
                problems.append(f'{weekday} idea {n}: a title; titles are signed off after he records (TITLES_AFTER_RECORDING)')
            # Where it came from, why it is here and its sketch (Krish, 2026-10-21; board_feed.py gather): in the fixed
            # layout every idea names its source, his own, his inspo folder or the engine's research.
            kind = idea.get('source_kind')
            if kind is not None and kind not in SOURCE_KINDS:
                problems.append(f'{weekday} idea {n}: source_kind {kind!r} is not one of {", ".join(SOURCE_KINDS)}')
            elif kind is None and monday >= FIXED_FROM:
                problems.append(f'{weekday} idea {n}: no source_kind (his, inspo or engine); every idea says where it came from')
            if idea.get('why_here') is not None and not str(idea['why_here']).strip():
                problems.append(f'{weekday} idea {n}: why_here is empty; leave it out or say which of his marks it is close to')
            beats = idea.get('beats')
            if beats is not None and (not isinstance(beats, list) or not 3 <= len(beats) <= 5
                                      or not all(isinstance(b, str) and b.strip() for b in beats)):
                problems.append(f'{weekday} idea {n}: beats are 3 to 5 lines of the narrative sketch')
            covers = idea.get('covers')
            if covers is not None and (not isinstance(covers, list) or not all(isinstance(c, str) and c.strip() for c in covers)):
                problems.append(f'{weekday} idea {n}: covers is a list of the must_cover ids (sources.json) this idea answers')
            if idea.get('pitch') is not None:
                problems.extend(f'{weekday} idea {n}: pitch {p}' for p in pitch_problems(idea['pitch']))
            pick = f'{key}-{n}'
            if pick in seen:
                problems.append(f'{weekday}: {pick} twice')
            seen.add(pick)
            rows.append(dict(idea, pick=pick, source=src))
        out[key] = rows
    if problems:
        raise BoardError(f'{where} is not ready to show:\n  ' + '\n  '.join(problems))
    return out


# An idea as a full story pitch (Krish, 2026-10-31: ideas shown as full story pitches): the headline, what the first ten
# seconds say, two or three real examples, the chain of cause and effect underneath (five to eight links), and where
# the piece lands. Optional for now; so_what, story, why_now, fact and source stay required beside it.
PITCH_FIELDS = (('question', 'The question'), ('headline', 'Headline'), ('hook', 'First 10 seconds'), ('examples', 'Real examples'),
                ('chain', "What's actually going on"), ('take', 'Where we land'))


# The plain question the pitch opens on (house rules STORY_ARC and BIG_PICTURE; the ideas quality plan, item 7): required
# from the 23 Nov board by board_feed.py cover (idea_checks.shape_findings), optional in the shape read here.
PITCH_OPTIONAL = ('question',)


PITCH_LISTS = {'examples': (2, 3), 'chain': (5, 8)}


def pitch_problems(pitch):
    """Why an idea's pitch is not ready to show, or []."""
    if not isinstance(pitch, dict):
        return ['is {"headline", "hook", "examples": [2 to 3], "chain": [5 to 8], "take"}']
    out = [f'has {k}, which is not one of its parts' for k in pitch if k not in dict(PITCH_FIELDS)]
    for k, _ in PITCH_FIELDS:
        v = pitch.get(k)
        if k in PITCH_OPTIONAL:
            if v is not None and (not isinstance(v, str) or not v.strip().endswith('?')):
                out.append(f'{k} is one plain question ending in "?"')
            continue
        if k in PITCH_LISTS:
            lo, hi = PITCH_LISTS[k]
            if not isinstance(v, list) or not lo <= len(v) <= hi or not all(isinstance(x, str) and x.strip() for x in v):
                out.append(f'{k} is a list of {lo} to {hi} lines')
        elif not isinstance(v, str) or not v.strip():
            out.append(f'has no {k}')
    return out


def ideas_problems(data, monday, where='ideas.json'):
    """What is wrong with the ideas file, [] when it is ready to show: read_ideas's refusals, one per line, then
    read_offdays's on its off-day options."""
    out = []
    try:
        read_ideas(data, monday, where)
    except BoardError as error:
        out += [line.strip() for line in str(error).split('\n')[1:]] or [str(error)]
    if isinstance(data, dict) and data.get('offdays') is not None:
        try:
            read_offdays(data.get('offdays'), f'{where} offdays')
        except BoardError as error:
            out.append(str(error))
    return out
