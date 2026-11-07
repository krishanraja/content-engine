#!/usr/bin/env python3
"""Sunday's one gather step: every source of ideas and the queue, read from the engine, written to one file.

Krish, 2026-10-21: "the ideas tab should, on a Sunday, contain a fresh batch of ideas that sources from all my
different sources of ideas ... The ideas engine should have learnt from what I previously liked talking about ...
You also need to pick up on whether there are multiple things in the queue that could be consolidated into one bigger
piece". His taste steers the sourcing and ranking only; the judges stay blind. Learning
queue-consolidation-and-fresh-sunday-ideas.

    python3 scripts/post-pack/board_feed.py gather 2026-10-26

Read-only with the engine key, no model and no spend: GET /api/week/options?week_start=<Monday>&include=sources and
GET /api/idea-queue?combine=1, written to docs/plans/<Monday>-week/sources.json. It prints the count from each
source and says which is empty and why. Then the session (plan-week, steps 1 to 3b) writes ideas.json from the
pool, his ideas first, each with source_kind, why_here and beats, and combine.json from the groups worth combining,
and builds with --ideas --queue --combine.
"""
import argparse
import json
import re
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import making  # noqa: E402


class FeedError(Exception):
    pass


def monday(text):
    try:
        d = date.fromisoformat(text)
    except ValueError:
        raise FeedError(f'{text!r} is not a date, YYYY-MM-DD')
    if d.weekday() != 0:
        raise FeedError(f'{text} is not a Monday: give the Monday the week starts on')
    return d


def get(call, path):
    status, text = call('GET', path, None)
    if status != 200:
        raise FeedError(f'GET {path}: HTTP {status}: {str(text)[:200]}')
    try:
        data = json.loads(text)
    except ValueError:
        raise FeedError(f'GET {path}: the engine answered with something that is not JSON')
    if not isinstance(data, dict) or data.get('ok') is False:
        raise FeedError(f'GET {path}: {str(text)[:200]}')
    return data


def his_dropped(sources):
    """The board owes him every idea he dropped in through Control Center's one door (a 'manual' row, his_via 'said')
    that is still in the pool: each one is on the board, Mon/Wed/Fri or an off day, or accounted for with a reason.
    Krish, 2026-10-29: a random idea he drops in "should appear on my Sunday board"."""
    pool = [c for s in sources.get('series') or [] for c in s.get('pool') or []] + list(sources.get('unassigned') or [])
    seen, out = set(), []
    for c in pool:
        if not isinstance(c, dict) or c.get('source_kind') != 'his' or c.get('his_via') != 'said' or not c.get('id') or c['id'] in seen:
            continue
        seen.add(c['id'])
        out.append({'id': c['id'], 'what': f'Your idea "{c.get("idea")}" (dropped in {str(c.get("created_at") or "")[:10]})',
                    'his_words': c.get('idea'), 'kind': 'his_idea'})
    return out


RECENT_OFF_WEEKS = 3  # this week and the two before it: the off days a new board may not repeat


def offday_text(o):
    """The words an off-day option showed him, whatever shape it was written in (ideas.json or Growth's file)."""
    pitch = o.get('pitch') if isinstance(o.get('pitch'), dict) else {}
    return ' '.join(str(x) for x in (o.get('title'), o.get('hook'), pitch.get('see'), o.get('copy'), o.get('draft')) if x).strip()


def recent_offdays(wk, read=None, plans=None):
    """[{week, day, id, text, covers, verdict}]: every off-day option shown on this week's and the two earlier weeks'
    boards, from the week's ideas.json offdays and Growth's offdays-growth.json, with his press from the board's queue
    (off-<day>-<id>). Krish, 2026-11-02: the 9 Nov board offered as Tuesday's option the idea already made into Thursday
    5 Nov's to-camera short; the no-repeat check read pieces only, never the off days."""
    plans = Path(plans) if plans else ROOT / 'docs' / 'plans'
    start = date.fromisoformat(wk)
    out = []
    for back in range(1, RECENT_OFF_WEEKS + 1):
        w = (start - timedelta(days=7 * back)).isoformat()
        shown = {}
        ideas = plans / f'{w}-week' / 'ideas.json'
        if ideas.exists():
            for day, opts in (json.loads(ideas.read_text(encoding='utf-8')).get('offdays') or {}).items():
                for o in opts if isinstance(opts, list) else []:
                    if isinstance(o, dict) and o.get('id'):
                        shown[(day, str(o['id']))] = {'text': offday_text(o), 'covers': list(o.get('covers') or []) + ([o['piece_id']] if o.get('piece_id') else []),
                                                     'urls': [str(st.get('source', {}).get('url')) for st in o.get('stories') or [] if isinstance(st, dict) and isinstance(st.get('source'), dict)]}
        growth = plans / f'{w}-week' / 'offdays-growth.json'
        if growth.exists():
            for when, opts in (json.loads(growth.read_text(encoding='utf-8')).get('days') or {}).items():
                try:
                    day = ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')[date.fromisoformat(when).weekday()]
                except ValueError:
                    continue
                for o in opts if isinstance(opts, list) else []:
                    if isinstance(o, dict) and o.get('concept_id'):
                        shown.setdefault((day, str(o['concept_id'])), {'text': offday_text(o), 'covers': list(o.get('covers') or [])})
        verdicts = {}
        if read is not None:
            try:
                docs = (read(f'/api/board/{w}/queue') or {}).get('documents') or []
            except Exception:  # an old week without a board: its files still count
                docs = []
            for d in docs:
                m = re.match(r'^off-(\w+?)-(\w+)$', str(d.get('id') or ''))
                body = d.get('body') if isinstance(d.get('body'), dict) else {}
                if not m:
                    continue
                idea = body.get('idea') if isinstance(body.get('idea'), dict) else {}
                verdicts[(m.group(1), m.group(2))] = idea.get('verdict') or body.get('verdict')
                if (m.group(1), m.group(2)) not in shown and isinstance(idea.get('shown'), dict):
                    shown[(m.group(1), m.group(2))] = {'text': offday_text(idea['shown']), 'covers': []}
        out += [dict(v, week=w, day=day, id=oid, verdict=verdicts.get((day, oid))) for (day, oid), v in sorted(shown.items())]
    return out


def gather(week, call=None, out_dir=None, read=None):
    """(path written, summary lines). call: (method, path, body) -> (status, text), the engine key by default."""
    call = call or making._engine_call
    wk = monday(week).isoformat()
    if read is None:
        import board_web
        read = lambda path: board_web.call('GET', path)
    options = get(call, f'/api/week/options?week_start={wk}&include=sources')
    queue = get(call, '/api/idea-queue?combine=1')
    sources = options.get('sources')
    if not isinstance(sources, dict):
        raise FeedError('the engine answered without a sources block; is the include=sources route deployed?')
    inspo = sources.get('inspiration')
    # Krish, 2026-10-24: "Double check my inspirationhouse gets read properly when ideas are being built". A gather
    # without the Inspiration House block is incomplete, never a quiet Sunday: say so and stop.
    if not isinstance(inspo, dict):
        raise FeedError('the engine answered without sources.inspiration (Inspiration House, content-watcher, creator moves); '
                        'the route on production predates it: merge and deploy, then gather again')
    relayed = sources.get('his_relayed') or []
    must_cover = list(inspo.get('must_cover') or []) + [
        {'id': r.get('id'), 'what': f'Your words on board item "{r.get("title")}"', 'his_words': r.get('detail')} for r in relayed if r.get('id')]
    must_cover += his_dropped(sources)
    out = {
        'week_start': wk,
        # When it was read: a board is built from a gather of the last two days only (week_board.py --ideas), so what
        # happened between the Sunday run and the build (a pick, an off day used) is in it.
        'gathered_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'how': 'Read-only gather (board_feed.py). Write ideas.json from series[].pool and inspiration (routed, liked, fresh, corpora, '
               'creators) and his feedback cues (cues), his ideas first, each with source_kind, why_here, beats and style (config/styles.json); every must_cover id '
               'is in some idea\'s covers or in ideas.json accounted with a reason (board_feed.py cover); write combine.json; '
               'build with --ideas --queue --combine.',
        'counts': sources.get('counts') or {},
        'empty': sources.get('empty') or [],
        'series': [dict(s, mandate=next((x.get('mandate') for x in options.get('series') or [] if x.get('slug') == s.get('slug')), None))
                   for s in sources.get('series') or []],
        'unassigned': sources.get('unassigned') or [],
        'his_relayed': relayed,
        'inspiration': inspo,
        'must_cover': must_cover,
        'taste': sources.get('taste') or {},
        # Krish, 2026-10-26: his feedback as cues to draw on (_feedbackCues.ts). Help, never a gate: a route without the
        # block writes an empty one and says so.
        'cues': sources.get('cues') if isinstance(sources.get('cues'), dict) else {},
        # Ruling, Krish, 2026-11-01: his Approve, Improve and Reject on the last weeks' off-day options, his words
        # verbatim, so the off-day options are made from what he said (plan-week references/offdays.md).
        'offday_verdicts': sources.get('offday_verdicts') if isinstance(sources.get('offday_verdicts'), dict) else {'verdicts': [], 'counts': {}},
        'queue': queue.get('queue') or [],
        'combine': queue.get('combine') or [],
        'scheduled': {s.get('slug'): s.get('scheduled') or [] for s in options.get('series') or []},
        # Krish, 2026-10-31: every card he typed words on (asks, each also in must_cover) and the pieces of the last 21
        # days the board may not offer again (cover, no-repeat).
        'asks': inspo.get('asks') or [],
        'recent': inspo.get('recent') if isinstance(inspo.get('recent'), list) else None,
        # Krish, 2026-11-02: the off days of this week and the two before it, for the no-repeat check and the readers.
        'recent_offdays': recent_offdays(wk, read),
    }
    folder = Path(out_dir) if out_dir else ROOT / 'docs' / 'plans' / f'{wk}-week'
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / 'sources.json'
    path.write_text(json.dumps(out, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    counts = out['counts']
    lines = [f'sources for the week of {wk}: his {counts.get("his", 0)}, inspo {counts.get("inspo", 0)}, engine {counts.get("engine", 0)}; '
             f'queue {len(out["queue"])}, could combine {len(out["combine"])} group(s); his relayed words {len(out["his_relayed"])}']
    ic = inspo.get('counts') or {}
    lines.append('  inspiration house: ' + ', '.join(f'{k} {ic.get(k, 0)}' for k in ('routed', 'study_style', 'liked', 'fresh', 'corpora', 'creators', 'claims', 'asks')))
    if out['recent'] is None:
        lines.append('  recent pieces: not in the engine\'s answer (the route on production predates them); cover cannot check repeats')
    cc = out['cues'].get('counts') if out['cues'] else None
    lines.append('  feedback cues: ' + (', '.join(f'{k.replace("_", " ")} {cc.get(k, 0)}' for k in ('future_pieces', 'wider_pieces', 'wider_themes', 'tracked', 'briefs', 'not_for_us'))
                                         if isinstance(cc, dict) else 'not in the engine\'s answer (the route on production predates them)'))
    lines += [f'  must cover: {m.get("what")}' for m in must_cover]
    lines += [f'  {s.get("slug")}: {len(s.get("pool") or [])} in the pool' for s in out['series']]
    lines += [f'  empty: {e.get("source")}: {e.get("why")}' for e in out['empty']]
    return path, lines


PUBLISHING_DAYS = (('mon', 'Monday'), ('wed', 'Wednesday'), ('fri', 'Friday'))
HIS_KINDS = ('his', 'inspo')


def all_options(ideas):
    """Every idea on the Ideas tab: the three publishing days and the off-day options."""
    days = (ideas or {}).get('days') if isinstance((ideas or {}).get('days'), dict) else {}
    offdays = (ideas or {}).get('offdays') if isinstance((ideas or {}).get('offdays'), dict) else {}
    return [i for v in days.values() if isinstance(v, list) for i in v if isinstance(i, dict)] + \
           [o for v in offdays.values() if isinstance(v, list) for o in v if isinstance(o, dict)]


def style_answered(ideas, sources):
    """sources with each style-only ask that some idea names in `style_from` taken out of must_cover: a card he
    routed to Study style is answered by its style used in an idea, never forced into a topic."""
    used = {str(s) for i in all_options(ideas) for s in (i.get('style_from') or []) if isinstance(i.get('style_from'), list)}
    owed = [m for m in (sources or {}).get('must_cover') or []
            if not (isinstance(m, dict) and m.get('style_only') and str(m.get('id')) in used)]
    return dict(sources or {}, must_cover=owed)


def halves_problems(ideas):
    """Krish, 2026-10-31: ideas come half and half. Each publishing day has at least one option from his asks
    (source_kind his or inspo) and at least one from the engine's research (source_kind engine)."""
    days = (ideas or {}).get('days') if isinstance((ideas or {}).get('days'), dict) else {}
    out = []
    locked = (ideas or {}).get('locked') if isinstance((ideas or {}).get('locked'), dict) else {}
    for key, name in PUBLISHING_DAYS:
        if key in locked:
            continue
        kinds = [i.get('source_kind') for i in days.get(key) or [] if isinstance(i, dict)]
        if not any(k in HIS_KINDS for k in kinds):
            out.append(f'{name}: no option from his asks (source_kind his or inspo); half and half, each day has at least one')
        if 'engine' not in kinds:
            out.append(f'{name}: no option from engine research (source_kind engine); half and half, each day has at least one')
    return out


DAY_OFFSET = {'mon': 0, 'wed': 2, 'fri': 4}


def locked_problems(ideas, sources):
    """Krish, 2026-11-02: "Monday's piece is already done". A publishing day whose piece is already scheduled for it
    (sources.json scheduled, from GET /api/week/options) is locked to that piece in ideas.json `locked` and offers no
    options; plan-week said so in words only (SKILL.md, "needs no options") and the 9 Nov board offered four."""
    week = (sources or {}).get('week_start') or (ideas or {}).get('week_start')
    if not week:
        return []
    start = date.fromisoformat(str(week)[:10])
    on = {}
    for rows in ((sources or {}).get('scheduled') or {}).values():
        for r in rows or []:
            if isinstance(r, dict) and r.get('scheduled_for') and r.get('id'):
                on.setdefault(str(r['scheduled_for'])[:10], r)
    locked = (ideas or {}).get('locked') if isinstance((ideas or {}).get('locked'), dict) else {}
    days = (ideas or {}).get('days') if isinstance((ideas or {}).get('days'), dict) else {}
    out = []
    for key, name in PUBLISHING_DAYS:
        piece = on.get((start + timedelta(days=DAY_OFFSET[key])).isoformat())
        if not piece:
            continue
        lock = locked.get(key) if isinstance(locked.get(key), dict) else None
        if not lock or str(lock.get('piece_id')) != str(piece['id']):
            out.append(f'{name} already has its piece "{str(piece.get("idea") or "")[:80]}" ({piece["id"]}); '
                       f'lock the day to it in ideas.json locked and offer no options')
        elif days.get(key):
            out.append(f'{name} is locked to its piece and still offers {len(days[key])} option(s); give it none')
    return out


READ_FROM = '2026-11-09'  # Krish, 2026-11-02, of the 9 Nov off days; older weeks keep the shape they were made in


def goodnews_problems(ideas, sources, today=None):
    """A weekly series option (the Saturday good news) names when its stories are found (stories_due, the Sunday before
    its week until 7 November, the Thursday of its week since: Krish, 2026-11-07, "Saturday's good news run should be done
    later in the week so the good news is fresh"). Once that day has come it holds its five stories, each dated in the
    seven days up to it, none a story a recent off day already ran."""
    import week_board
    today = today or date.today()
    used = {u for o in (sources or {}).get('recent_offdays') or [] if isinstance(o, dict) for u in o.get('urls') or []}
    out = []
    offdays = (ideas or {}).get('offdays') if isinstance((ideas or {}).get('offdays'), dict) else {}
    for day, opts in offdays.items():
        for o in opts if isinstance(opts, list) else []:
            if not isinstance(o, dict) or not o.get('weekly'):
                continue
            label = f'{day} {o.get("id")}'
            try:
                due = date.fromisoformat(str(o.get('stories_due')))
            except ValueError:
                out.append(f'{label}: a weekly series names stories_due, the day its stories are found (YYYY-MM-DD)')
                continue
            stories = o.get('stories') or []
            if today < due and not stories:
                continue
            bad = week_board.story_problems(stories)
            if bad:
                out += [f'{label}: stories {p} (due {due.isoformat()})' for p in bad]
                continue
            for i, st in enumerate(stories, 1):
                when = date.fromisoformat(str(st['date']))
                if not due - timedelta(days=7) <= when <= due:
                    out.append(f'{label}: story {i} is dated {when.isoformat()}; the stories are from the seven days up to {due.isoformat()}')
                if str(st['source']['url']) in used:
                    out.append(f'{label}: story {i} ran on a recent off day already ({st["source"]["url"]})')
    return out


def readback_problems(ideas, sources):
    """Every off-day option, from the 9 Nov week, carries its fresh readers' read-back: two readers with none of the
    session's reasoning each say in one line what the post is (`says`, both, never empty), having been shown every
    piece and off day of the last weeks (`against`, the count sources.json holds, so none is skipped). An option made
    from one of his inspiration cards also says what it `adds` to the original, and a reader who saw both says so
    (`versus`). Krish, 2026-11-02: the Grandma meme was "just a copy of a post from my inspo board but way worse"; of
    the coin-toss option, "I have zero idea what this even means"."""
    if str((ideas or {}).get('week_start') or (sources or {}).get('week_start') or '') < READ_FROM:
        return []
    against = len((sources or {}).get('recent') or []) + len((sources or {}).get('recent_offdays') or [])
    inspo = {str(m.get('id')) for m in (sources or {}).get('must_cover') or []
             if isinstance(m, dict) and str(m.get('what') or '').startswith('Inspiration card') and not m.get('style_only')}
    inspo |= {str(a.get('id')) for a in (sources or {}).get('asks') or []
              if isinstance(a, dict) and a.get('id') and not a.get('style_only') and a.get('state') != 'style_only'}
    out = []
    offdays = (ideas or {}).get('offdays') if isinstance((ideas or {}).get('offdays'), dict) else {}
    for day, opts in offdays.items():
        for o in opts if isinstance(opts, list) else []:
            if not isinstance(o, dict):
                continue
            label = f'{day} {o.get("id")}'
            rb = o.get('read_back') if isinstance(o.get('read_back'), dict) else {}
            says = rb.get('says')
            if not (isinstance(rb.get('readers'), list) and len(rb['readers']) >= 2 and isinstance(says, list) and len(says) >= 2
                    and all(isinstance(x, str) and len(x.strip()) >= 12 for x in says)):
                out.append(f'{label}: no read-back; two fresh readers each say in one line what the post is (read_back.readers, read_back.says)')
            elif rb.get('against') != against:
                out.append(f'{label}: read_back.against is {rb.get("against")!r}; the readers check it against all {against} recent pieces and off days')
            from_inspo = bool(set(map(str, o.get('covers') or [])) & inspo) or bool((o.get('inspiration') or {}).get('url'))
            if from_inspo and not (isinstance(o.get('adds'), str) and len(o['adds'].strip()) >= 20
                                   and isinstance(rb.get('versus'), str) and rb['versus'].strip()):
                out.append(f'{label}: made from his inspiration; say what it adds to the original (adds) and have a reader '
                           'who saw both say so (read_back.versus), or cut it')
    return out


def repeat_problems(ideas, sources):
    """No idea repeats a piece made or scheduled in the 21 days before the week: its id is not a recent piece's, and
    its covers name no recent piece and no id a recent piece already answered (sources.json recent)."""
    recent = (sources or {}).get('recent')
    if not isinstance(recent, list):
        return ['sources.json has no recent pieces (gather predates them); gather again so repeats can be checked']
    pieces = {str(p.get('id')): p for p in recent if isinstance(p, dict) and p.get('id')}
    answered = {str(c): p for p in pieces.values() for c in (p.get('covers') or [])}
    owed = {str(m.get('id')): m for m in (sources or {}).get('must_cover') or [] if isinstance(m, dict) and m.get('piece_id')}
    out = []
    # Krish, 2026-11-02: the off days of this week and the two before it count too, by every id they carried.
    off_used = {}
    for o in (sources or {}).get('recent_offdays') or []:
        if isinstance(o, dict) and o.get('verdict') != 'next_week':
            for c in o.get('covers') or []:
                off_used.setdefault(str(c), o)
    his_open = {str(m.get('id')) for m in (sources or {}).get('must_cover') or [] if isinstance(m, dict) and m.get('kind') == 'his_idea'}
    for i in all_options(ideas):
        label = i.get('pick') or i.get('id') or str(i.get('story') or i.get('idea') or '')[:40]
        # A recorded option is one of his own ideas; once the idea has left the pool it has been used (the 9 Nov
        # Tuesday option was the idea Thursday 5 Nov was already made from).
        if i.get('kind') == 'recorded' and i.get('piece_id') and str(i['piece_id']) not in his_open:
            out.append(f'repeat: option {label} records your idea {i["piece_id"]}, which is no longer in the pool (already '
                       'used, or no longer his open idea); gather again, and offer only an idea still waiting')
        for c in [x for x in [i.get('piece_id')] if x] + list(i.get('covers') or []):
            o = off_used.get(str(c))
            if o:
                out.append(f'repeat: option {label} covers {c}, already shown as the {o.get("day")} off day "{o.get("id")}" '
                           f'in the week of {o.get("week")}; a new angle needs a new idea')
        if str(i.get('id')) in pieces:
            p = pieces[str(i['id'])]
            out.append(f'repeat: idea {label} is the piece "{p.get("idea")}" scheduled {p.get("scheduled_for")}')
        for c in i.get('covers') or []:
            p = pieces.get(str(c)) or answered.get(str(c)) or pieces.get(str((owed.get(str(c)) or {}).get('piece_id')))
            if p:
                out.append(f'repeat: idea {label} covers {c}, already made as "{p.get("idea")}" ({p.get("scheduled_for")}); '
                           'account for it instead, or find a new angle under a new id')
    return out


def cover(week, ideas_path=None):
    """Problems with the week's ideas.json against its sources.json: every must_cover id (his asks included) carried
    by an idea's `covers` (a style-only ask by `style_from`) or accounted for with a reason, the style rules
    (week_board.style_problems), half and half each publishing day, and no repeat of the last 21 days. [] when ready."""
    import week_board
    wk = monday(week).isoformat()
    folder = ROOT / 'docs' / 'plans' / f'{wk}-week'
    sources = json.loads((folder / 'sources.json').read_text(encoding='utf-8'))
    ideas = json.loads(Path(ideas_path or folder / 'ideas.json').read_text(encoding='utf-8'))
    return check(ideas, sources, week_board)


def check(ideas, sources, week_board):
    return (week_board.coverage_problems(ideas, style_answered(ideas, sources)) + week_board.style_problems(ideas)
            + halves_problems(ideas) + locked_problems(ideas, sources) + repeat_problems(ideas, sources)
            + readback_problems(ideas, sources) + goodnews_problems(ideas, sources))


COMBINE_DOC = re.compile(r'^combine-\d{1,3}$')


def his_taps(documents, series=None):
    """(synthesize bodies, skipped lines) from a board's queue documents. Only a Combine tap Krish wrote himself
    (updated_by 'Krish', the access-cookie writer) is relayed; the board API refuses a session's, and this refuses one
    that got there anyway. `said` stays None: the board's own words (the thesis a session wrote) are never his. A
    session adds `said` only from a comment Krish typed himself."""
    bodies, skipped = [], []
    for d in documents or []:
        if not isinstance(d, dict) or not COMBINE_DOC.match(str(d.get('id') or '')):
            continue
        body = d.get('body') if isinstance(d.get('body'), dict) else {}
        if body.get('combine') is not True:
            continue
        if d.get('updated_by') != 'Krish':
            skipped.append(f'{d.get("id")}: written by {d.get("updated_by")!r}, not Krish; not relayed')
            continue
        bodies.append({'tap': d['id'], 'source_idea_ids': list(body.get('members') or []), 'target_lane': 'publication',
                       'lane_slot': (series or {}).get(d['id']), 'decided_by': 'Krish', 'said': None})
    return bodies, skipped


def taps(week, read=None):
    """His Combine taps on a week's board, ready for POST /api/content-ideas/synthesize. Read-only."""
    wk = monday(week).isoformat()
    if read is None:
        import board_web
        read = lambda path: board_web.call('GET', path)
    answer = read(f'/api/board/{wk}/queue')
    return his_taps((answer or {}).get('documents') if isinstance(answer, dict) else [])


def archive(week, call=None, out_dir=None):
    """(path written, summary line): the Archive for a board from layout v3 on (W2.1), every published piece since the
    Launch with his scores, from GET /api/board/<Monday>/archive, written to docs/plans/<Monday>-week/archive.json for
    week_board.py --archive. Read-only."""
    call = call or making._engine_call
    wk = monday(week).isoformat()
    data = get(call, f'/api/board/{wk}/archive')
    rows = data.get('rows')
    if not isinstance(rows, list):
        raise FeedError(f'GET /api/board/{wk}/archive: no rows')
    out = Path(out_dir) if out_dir else ROOT / 'docs' / 'plans' / f'{wk}-week'
    out.mkdir(parents=True, exist_ok=True)
    path = out / 'archive.json'
    path.write_text(json.dumps({'week_start': wk, 'scores': data.get('scores'), 'rows': rows}, indent=1) + '\n', encoding='utf-8')
    scored = sum(1 for r in rows if isinstance(r, dict) and r.get('scores'))
    line = f'archive: {len(rows)} published pieces, {scored} scored' + (
        '; the score table waits on the Wave 2 migration batch' if data.get('scores') == 'waits_on_migration' else '')
    return str(path), line


def self_test():
    """No engine: a fake answer for each route, then what gather writes and says."""
    import tempfile
    pool = [{'id': 'a', 'idea': 'His', 'source_kind': 'his', 'his_via': 'said', 'created_at': '2026-10-29T10:00:00Z', 'why_here': None},
            {'id': 'r', 'idea': 'Researched', 'source_kind': 'his', 'his_via': 'research', 'why_here': None},
            {'id': 'b', 'idea': 'Engine', 'source_kind': 'engine', 'why_here': 'close to ...'}]
    answers = {
        '/api/week/options?week_start=2026-10-26&include=sources': {'ok': True, 'series': [{'slug': 'follow_the_money', 'mandate': 'M', 'scheduled': []}],
            'sources': {'counts': {'his': 1, 'inspo': 0, 'engine': 1}, 'empty': [{'source': 'inspo', 'why': 'no scan'}],
                        'series': [{'slug': 'follow_the_money', 'pool': pool}], 'taste': {}, 'his_relayed': [{'id': 'said-1', 'title': 'Do agents'}],
                        'inspiration': {'counts': {'routed': 1}, 'must_cover': [{'id': 'card-1', 'what': 'Inspiration card "x" you routed to Make a piece', 'his_words': 'yes'}]},
                        'cues': {'future_pieces': [{'id': 'c1', 'subject_ref': 'q1', 'said': 'later'}], 'wider_pieces': [], 'tracked': [], 'briefs': [], 'not_for_us': [],
                                 'counts': {'future_pieces': 1, 'wider_pieces': 0, 'wider_themes': 0, 'tracked': 0, 'briefs': 0, 'not_for_us': 0}}}},
        '/api/idea-queue?combine=1': {'ok': True, 'queue': [{'id': 'q1'}, {'id': 'q2'}], 'combine': [{'ids': ['q1', 'q2']}]},
    }
    calls = []

    def call(method, path, body):
        calls.append((method, path))
        return (200, json.dumps(answers[path])) if path in answers else (404, 'no')
    problems = []
    with tempfile.TemporaryDirectory() as tmp:
        path, lines = gather('2026-10-26', call, tmp, read=lambda p: {})
        data = json.loads(Path(path).read_text(encoding='utf-8'))
        if [m for m, _ in calls] != ['GET', 'GET']:
            problems.append('gather must only read')
        if data['series'][0]['pool'][0]['source_kind'] != 'his' or data['series'][0]['mandate'] != 'M':
            problems.append('the pool keeps its order, his first, with the mandate beside it')
        if [m['id'] for m in data['must_cover']] != ['card-1', 'said-1', 'a'] or not any('routed 1' in x for x in lines):
            problems.append('every routed Inspiration card, relayed word and idea he dropped in is listed to cover, and the counts are said')
        if not any('must cover: Your idea "His" (dropped in 2026-10-29)' in x for x in lines):
            problems.append('an idea he dropped in through the one door is named in what the board must cover')
        if len(data['combine']) != 1 or len(data['queue']) != 2:
            problems.append('the queue and its combine groups are written')
        if not any('empty: inspo: no scan' in x for x in lines) or 'his 1, inspo 0, engine 1' not in lines[0]:
            problems.append('the counts and the empty source are said')
        if data['cues'].get('future_pieces', [{}])[0].get('id') != 'c1' or not any('feedback cues: future pieces 1' in x for x in lines):
            problems.append('his feedback cues are written and counted')
    no_cues = json.loads(json.dumps(answers))
    no_cues['/api/week/options?week_start=2026-10-26&include=sources']['sources'].pop('cues')
    with tempfile.TemporaryDirectory() as tmp:
        path, lines = gather('2026-10-26', lambda m, p, b: (200, json.dumps(no_cues[p])), tmp, read=lambda p: {})
        if json.loads(Path(path).read_text(encoding='utf-8'))['cues'] != {} or not any('feedback cues: not in' in x for x in lines):
            problems.append('a route without the cues block still gathers, and says the cues are missing')
    for bad in ('2026-10-27', 'soon'):
        try:
            monday(bad)
            problems.append(f'{bad} must be refused')
        except FeedError:
            pass
    old = json.loads(json.dumps(answers))
    old['/api/week/options?week_start=2026-10-26&include=sources']['sources'].pop('inspiration')
    try:
        with tempfile.TemporaryDirectory() as tmp:
            gather('2026-10-26', lambda m, p, b: (200, json.dumps(old[p])), tmp, read=lambda p: {})
        problems.append('a gather without the Inspiration House block must stop, never look complete')
    except FeedError:
        pass
    try:
        gather('2026-10-26', lambda m, p, b: (500, 'down'), read=lambda p: {})
        problems.append('an engine error must be said, never written as an empty pool')
    except FeedError:
        pass
    row = {'piece_id': '11111111-2222-4333-8444-555555555555', 'date': '2026-10-12', 'series': 'follow_the_money', 'title': 'T',
           'links': [], 'scores': {'hindsight': {'narrative': 8, 'production': 6}}}
    seen = []

    def arch(method, path, body):
        seen.append((method, path))
        return 200, json.dumps({'ok': True, 'scores': 'waits_on_migration', 'rows': [row, dict(row, scores={})]})
    with tempfile.TemporaryDirectory() as tmp:
        path, line = archive('2026-11-09', arch, tmp)
        if seen != [('GET', '/api/board/2026-11-09/archive')] or json.loads(Path(path).read_text(encoding='utf-8'))['rows'][0] != row:
            problems.append('archive reads the board\'s Archive view once and writes its rows as given')
        if line != 'archive: 2 published pieces, 1 scored; the score table waits on the Wave 2 migration batch':
            problems.append(f'archive says how many pieces and scores, and when the score table is not there yet ({line})')
    m = ['11111111-2222-4333-8444-555555555555', '22222222-3333-4444-8555-666666666666']
    docs = [{'id': 'combine-1', 'updated_by': 'Krish', 'body': {'combine': True, 'members': m, 'pick': 'combine-1'}},
            {'id': 'combine-2', 'updated_by': 'engine_operator', 'body': {'combine': True, 'members': m, 'pick': 'combine-2'}},
            {'id': 'mon-1', 'updated_by': 'Krish', 'body': {'pick': 'mon-1', 'queued': True}}]
    bodies, skipped = taps('2026-10-26', lambda path: {'ok': True, 'documents': docs})
    if [b['tap'] for b in bodies] != ['combine-1'] or bodies[0]['source_idea_ids'] != m or bodies[0]['decided_by'] != 'Krish':
        problems.append('only a Combine tap Krish wrote is relayed, with its members')
    if bodies and bodies[0]['said'] is not None:
        problems.append('a tap carries no said: the board\'s words are never his')
    if not skipped or 'combine-2' not in skipped[0]:
        problems.append('a tap a session wrote is skipped and said so')
    problems += cover_self_test()
    return problems


def cover_self_test():
    """Krish, 2026-10-31: his asks used or accounted, half and half each publishing day, no repeat of 21 days."""
    import week_board
    problems = []
    his = lambda **kw: dict({'source_kind': 'inspo', 'covers': []}, **kw)
    eng = lambda **kw: dict({'source_kind': 'engine', 'covers': []}, **kw)
    days = {k: [his(), eng()] for k, _ in PUBLISHING_DAYS}
    sources = {'recent': [], 'must_cover': [
        {'id': 'a397253e', 'what': 'Inspiration card "granny" you wrote on, then dismissed', 'ask': True, 'state': 'dismissed', 'style_only': False},
        {'id': '45e0ead0', 'what': 'Inspiration card "Git" you wrote on and routed to Study style', 'ask': True, 'state': 'style_only', 'style_only': True}]}
    # (a) every ask covered or accounted: a dismissed ask left out is said; a style-only ask is answered by style_from.
    left = week_board.coverage_problems({'days': days}, style_answered({'days': days}, sources))
    if not any('a397253e' in x for x in left) or not any('45e0ead0' in x for x in left):
        problems.append('an ask he typed words on, dismissed or style-only, left off the board must be said')
    used = {'days': dict(days, mon=[his(covers=['a397253e']), eng(style_from=['45e0ead0'])])}
    if week_board.coverage_problems(used, style_answered(used, sources)):
        problems.append('an ask in covers, and a style-only ask in style_from, are answered')
    topic_only = dict(sources, must_cover=[dict(sources['must_cover'][0], style_only=False, id='x1')])
    named = {'days': dict(days, mon=[his(), eng(style_from=['x1'])])}
    if not week_board.coverage_problems(named, style_answered(named, topic_only)):
        problems.append('style_from answers only a style-only ask, never a topic ask')
    # (a2) Krish, 2026-11-02: "Monday's piece is already done". A scheduled day is locked to its piece, with no options.
    sched = {'week_start': '2026-11-09', 'scheduled': {'follow_the_money': [
        {'id': 'b358e788-209f-427b-a84d-1f79a8ebb430', 'idea': 'Character.AI', 'scheduled_for': '2026-11-09'}]}}
    lock = {'mon': {'piece_id': 'b358e788-209f-427b-a84d-1f79a8ebb430', 'so_what': 's', 'why': 'w'}}
    if not any('Monday already has its piece' in x for x in locked_problems({'days': days}, sched)):
        problems.append('a day with a scheduled piece and options, not locked, is refused')
    if not any('still offers 2' in x for x in locked_problems({'days': days, 'locked': lock}, sched)):
        problems.append('a locked day that still offers options is refused')
    if locked_problems({'days': dict(days, mon=[]), 'locked': lock}, sched) or halves_problems({'days': dict(days, mon=[]), 'locked': lock}):
        problems.append('a locked day with no options passes, and half and half skips it')
    # (a3) Krish, 2026-11-02: no repeat of this week's off days, and no recorded option for an idea already used.
    rep = {'recent': [], 'must_cover': [], 'recent_offdays': [{'week': '2026-11-02', 'day': 'thu', 'id': 'puppy', 'covers': ['385a5da8'], 'verdict': 'approve'}]}
    mine = {'days': {}, 'offdays': {'tue': [{'id': 'mine', 'kind': 'recorded', 'piece_id': '5a6877e4', 'covers': ['5a6877e4', '385a5da8']}]}}
    got = repeat_problems(mine, rep)
    if not any('no longer in the pool' in x for x in got) or not any('thu off day "puppy"' in x for x in got):
        problems.append('a recorded option for a used idea, and an option covering a recent off day, are refused')
    rep2 = dict(rep, must_cover=[{'id': '5a6877e4', 'kind': 'his_idea'}], recent_offdays=[dict(rep['recent_offdays'][0], verdict='next_week')])
    if repeat_problems(mine, rep2):
        problems.append('his open idea, and an off day he sent to next week, may be offered')
    # (a4) Krish, 2026-11-02: every off day read back by two fresh readers; an inspo-made one says what it adds.
    rsrc = {'week_start': '2026-11-09', 'recent': [{}], 'recent_offdays': [{}, {}], 'must_cover': [{'id': 'a397253e', 'what': 'Inspiration card "granny"'}]}
    rb = {'readers': ['A', 'B'], 'says': ['A meme about a test that was rigged.', 'Grandma, a train, and a rigged test.'], 'against': 3}
    granny = {'week_start': '2026-11-09', 'offdays': {'tue': [{'id': 'granny', 'covers': ['a397253e'], 'read_back': rb}]}}
    if not any('what it adds' in x for x in readback_problems(granny, rsrc)):
        problems.append('an option made from his inspiration with no adds is refused')
    ok = {'week_start': '2026-11-09', 'offdays': {'tue': [{'id': 'granny', 'covers': ['a397253e'], 'adds': 'The rigged rule, from the paper, which the original never said.',
                                                              'read_back': dict(rb, versus='Ours explains the trick; the original only shows the joke.')}]}}
    if readback_problems(ok, rsrc):
        problems.append('an option with its read-back and what it adds passes')
    if not any('no read-back' in x for x in readback_problems({'week_start': '2026-11-09', 'offdays': {'thu': [{'id': 'cointoss'}]}}, rsrc)):
        problems.append('an option no fresh reader read back is refused')
    if not any('against is 1' in x for x in readback_problems({'week_start': '2026-11-09', 'offdays': {'thu': [{'id': 'x', 'read_back': dict(rb, against=1)}]}}, rsrc)):
        problems.append('a read-back that skipped recent pieces and off days is refused')
    if readback_problems({'week_start': '2026-11-02', 'offdays': {'thu': [{'id': 'old'}]}}, rsrc):
        problems.append('a week before 9 Nov keeps the shape it was made in')
    # (a5) Krish, 2026-11-02: the weekly good news is filled on Sunday with fresh stories.
    stry = lambda n, **kw: dict({'headline': f'S{n}', 'what': 'What.', 'why': 'Why.', 'date': '2026-11-05',
                                 'source': {'label': 'L', 'url': f'https://e.com/{n}'}, 'media': {'kind': 'clip', 'url': 'https://e.com/v'}}, **kw)
    wk = lambda st: {'offdays': {'sat': [{'id': 'goodnews', 'weekly': 'good_news', 'stories_due': '2026-11-08', 'stories': st}]}}
    gsrc = {'recent_offdays': [{'urls': ['https://e.com/used']}]}
    if goodnews_problems(wk([]), gsrc, date(2026, 11, 3)):
        problems.append('a weekly option before its Sunday may wait for its stories')
    if not any('stories is a list of 5' in x for x in goodnews_problems(wk([]), gsrc, date(2026, 11, 8))):
        problems.append('a weekly option on its Sunday with no stories is refused')
    if goodnews_problems(wk([stry(n) for n in range(1, 6)]), gsrc, date(2026, 11, 8)):
        problems.append('five fresh stories with sources and pictures pass')
    old_one = goodnews_problems(wk([stry(1, date='2026-10-20')] + [stry(n) for n in range(2, 6)]), gsrc, date(2026, 11, 8))
    rerun = goodnews_problems(wk([stry(1, source={'label': 'L', 'url': 'https://e.com/used'})] + [stry(n) for n in range(2, 6)]), gsrc, date(2026, 11, 8))
    if not any('dated 2026-10-20' in x for x in old_one) or not any('ran on a recent off day' in x for x in rerun):
        problems.append('a stale story and a story a recent off day ran are refused')
    # (b) half and half on each publishing day.
    if halves_problems({'days': days}):
        problems.append('a day with one ask-led and one engine option passes half and half')
    lop = halves_problems({'days': dict(days, wed=[eng(), eng()], fri=[his(source_kind='his')])})
    if lop != ['Wednesday: no option from his asks (source_kind his or inspo); half and half, each day has at least one',
               'Friday: no option from engine research (source_kind engine); half and half, each day has at least one']:
        problems.append(f'a day without his asks, or without engine research, is said ({lop})')
    # (c) no repeat of a piece made or scheduled in the last 21 days.
    recent = {'recent': [{'id': 'p1', 'idea': 'Who pays', 'scheduled_for': '2026-10-26', 'covers': ['card-9']}],
              'must_cover': [{'id': 'made-card', 'piece_id': 'p1'}]}
    reps = repeat_problems({'days': {'mon': [eng(id='p1')], 'wed': [his(covers=['card-9'])], 'fri': [his(covers=['made-card'])]}}, recent)
    if len(reps) != 3 or not all('Who pays' in x for x in reps):
        problems.append(f'an idea that is a recent piece, or covers what one answered, or covers a card made into it, is a repeat ({reps})')
    if repeat_problems({'days': days}, recent):
        problems.append('fresh ideas are not repeats')
    if not repeat_problems({'days': days}, {}):
        problems.append('a sources.json without recent pieces says repeats cannot be checked')
    return problems


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = ap.add_subparsers(dest='cmd')
    g = sub.add_parser('gather', help='read every source and the queue into docs/plans/<Monday>-week/sources.json')
    g.add_argument('week', help='the Monday the week starts on, YYYY-MM-DD')
    g.add_argument('--out-dir', help='write sources.json here instead (a test)')
    t = sub.add_parser('taps', help='his Combine taps on a week\'s board, as synthesize bodies (only those Krish wrote)')
    t.add_argument('week', help='the Monday of the board the taps are on, YYYY-MM-DD')
    c = sub.add_parser('cover', help='check ideas.json carries every must_cover id and the style rules before the board is built')
    c.add_argument('week', help='the Monday the week starts on, YYYY-MM-DD')
    c.add_argument('--ideas', help='an ideas file other than docs/plans/<Monday>-week/ideas.json')
    a = sub.add_parser('archive', help='the Archive (layout v3): every published piece and his scores, into docs/plans/<Monday>-week/archive.json')
    a.add_argument('week', help='the Monday of the board, YYYY-MM-DD')
    sub.add_parser('self-test')
    args = ap.parse_args(argv)
    if args.cmd == 'archive':
        try:
            path, line = archive(args.week)
        except (FeedError, ValueError, OSError) as error:
            print(f'board_feed archive: {error}', file=sys.stderr)
            return 1
        print(f'{line}\nwrote {path}; build with --archive {path}')
        return 0
    if args.cmd == 'taps':
        try:
            bodies, skipped = taps(args.week)
        except (FeedError, ValueError, OSError) as error:
            print(f'board_feed taps: {error}', file=sys.stderr)
            return 1
        for line in skipped:
            print(f'skipped {line}', file=sys.stderr)
        print(json.dumps(bodies, indent=1))
        return 0
    if args.cmd == 'self-test':
        problems = self_test()
        print('board_feed self-test ' + ('FAILED:\n  ' + '\n  '.join(problems) if problems else 'passed'))
        return 1 if problems else 0
    if args.cmd == 'cover':
        try:
            problems = cover(args.week, args.ideas)
        except (FeedError, OSError, ValueError) as error:
            print(f'board_feed cover: {error}', file=sys.stderr)
            return 1
        print('cover: ' + ('NOT READY:\n  ' + '\n  '.join(problems) if problems else 'every ask, routed card and relayed word is on the board or accounted for; styles, half and half and no-repeat pass'))
        return 1 if problems else 0
    if args.cmd != 'gather':
        ap.print_help()
        return 2
    try:
        path, lines = gather(args.week, out_dir=args.out_dir)
    except (FeedError, making.MakingError) as error:
        print(f'board_feed gather: {error}', file=sys.stderr)
        return 1
    print('\n'.join(lines))
    print(f'wrote {path.relative_to(ROOT) if path.is_relative_to(ROOT) else path}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
