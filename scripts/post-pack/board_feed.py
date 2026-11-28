#!/usr/bin/env python3
"""Sunday's one gather step: every source of ideas and the queue, read from the engine, written to one file.

Krish, 2026-10-21: "the ideas tab should, on a Sunday, contain a fresh batch of ideas that sources from all my
different sources of ideas ... The ideas engine should have learnt from what I previously liked talking about ...
You also need to pick up on whether there are multiple things in the queue that could be consolidated into one bigger
piece". His taste steers the sourcing and ranking only; the judges stay blind. Learning
queue-consolidation-and-fresh-sunday-ideas.

    python3 scripts/post-pack/board_feed.py gather 2026-10-26

Read-only with the engine key, no model and no spend: GET /api/week/options?week_start=<Monday>&include=sources,
GET /api/idea-queue?combine=1, the last three weeks' live boards (GET /api/board/<Monday>/view, for the repeat check)
and the week's own board and presses (view and outcomes, where each option stands), written to
docs/plans/<Monday>-week/sources.json. It prints the count from each
source and says which is empty and why. Then the session (plan-week, steps 1 to 3b) writes ideas.json from the
pool, his ideas first, each with source_kind, why_here and beats, and combine.json from the groups worth combining,
and builds with --ideas --queue --combine.
"""
import argparse
import json
import os
import re
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
import making  # noqa: E402
import idea_checks  # noqa: E402
import lens  # noqa: E402
import trend_tie  # noqa: E402
import ideas_scorecard  # noqa: E402


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


RECENT_POST_WEEKS = 3  # the weeks before the planned one whose posts it may not repeat (Krish, 2026-11-16)
POST_WORDS = 1200  # how much of each recent post's words the fresh reader gets
# What a `days` re-run may make again: an option he never answered. Open, and held (words from a session said it was
# decided, but only his Approve counts: Krish, 2026-11-11), which is how Tue 17's retold No spending short stood.
REMAKE = ('open', 'held')
POST_STAGES = ('approved', 'made', 'scheduled', 'live')
LOCK_SOURCE = 'The narrative lock ('


def posts_of(week, model):
    """Every piece and every off-day post on a week's live board (its week model, contract 1.12.0: only what he
    approved is on a day), each {week, day, date, key, type, kind, kind_label, title, stage, piece_id, item, primary,
    urls, labels}: primary is the href of its first source, urls and labels every source the read sheet shows (the
    narrative lock, a source the board adds, left out)."""
    out = []
    for d in (model or {}).get('days') or []:
        for it in (d.get('items') or []) if isinstance(d, dict) else []:
            if not isinstance(it, dict):
                continue
            stage = it.get('stage') if isinstance(it.get('stage'), dict) else {}
            if it.get('type') != 'piece' and stage.get('key') not in POST_STAGES:
                continue
            read = it.get('read') if isinstance(it.get('read'), dict) else {}
            srcs = [s for s in read.get('sources') or [] if isinstance(s, dict) and not str(s.get('label') or '').startswith(LOCK_SOURCE)]
            # Its words, for the fresh reader who judges whether a new option tells the same story (Krish, 2026-11-16).
            words = ' '.join(' '.join(str(x).split()) for x in (it.get('title'), read.get('so_what'), read.get('text'), read.get('story'), read.get('said')) if x)
            out.append({'week': week, 'day': it.get('day') or d.get('day'), 'date': it.get('date') or d.get('date'), 'key': it.get('key'),
                        'type': it.get('type'), 'kind': it.get('kind'), 'kind_label': it.get('kind_label'), 'title': it.get('title'),
                        'words': words[:POST_WORDS],
                        'stage': stage.get('key'), 'piece_id': it.get('piece_id'), 'item': it.get('item'),
                        'primary': srcs[0].get('href') if srcs else None,
                        'urls': [s['href'] for s in srcs if s.get('href')], 'labels': [s['label'] for s in srcs if s.get('label')]})
    return out


def recent_posts(wk, call):
    """(posts, errors): what went out or is on its way on the RECENT_POST_WEEKS boards before the week, read from each
    week's live board model (GET /api/board/<Monday>/view). A week that cannot be read is an error, said and kept,
    never an empty week."""
    start = date.fromisoformat(wk)
    posts, errors = [], []
    for back in range(1, RECENT_POST_WEEKS + 1):
        w = (start - timedelta(days=7 * back)).isoformat()
        try:
            view = get(call, f'/api/board/{w}/view')
        except (FeedError, making.MakingError) as error:
            errors.append(f'{w}: {error}')
            continue
        model = view.get('model')
        if not isinstance(model, dict) or not isinstance(model.get('days'), list):
            errors.append(f'{w}: the view has no week model (contract 1.12.0 or later)')
            continue
        posts += posts_of(w, model)
    return posts, errors


def earlier_options(wk, plans=None, recent_off=()):
    """[{week, day, id, main}]: every option the boards of the RECENT_POST_WEEKS weeks before offered, from their plan
    files (ideas.json, Growth's offdays-growth.json) and the off days the gather read from their queues."""
    plans = Path(plans) if plans else ROOT / 'docs' / 'plans'
    start = date.fromisoformat(wk)
    out, seen = [], set()

    def add(w, day, oid, main):
        k = (w, 'main' if main else 'off', str(oid).lower())
        if oid and k not in seen:
            seen.add(k)
            out.append({'week': w, 'day': day, 'id': str(oid), 'main': main})
    for back in range(1, RECENT_POST_WEEKS + 1):
        w = (start - timedelta(days=7 * back)).isoformat()
        path = plans / f'{w}-week' / 'ideas.json'
        data = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
        for day, opts in (data.get('days') if isinstance(data.get('days'), dict) else {}).items():
            for o in opts if isinstance(opts, list) else []:
                if isinstance(o, dict):
                    add(w, day, o.get('id'), True)
        for day, opts in (data.get('offdays') if isinstance(data.get('offdays'), dict) else {}).items():
            for o in opts if isinstance(opts, list) else []:
                if isinstance(o, dict) and not o.get('weekly'):
                    add(w, day, o.get('id'), False)
    for o in recent_off or []:
        if isinstance(o, dict) and str(o.get('week') or '') < wk:
            add(o.get('week'), o.get('day'), o.get('id'), False)
    return out


def earlier_of(sources, week, plans=None):
    """The earlier boards' options the repeat check reads: sources.json earlier_options, written by the gather; for a
    gather from before them, the plan files on disk."""
    got = (sources or {}).get('earlier_options')
    if isinstance(got, list):
        return got
    try:
        return earlier_options(monday(week).isoformat(), plans, (sources or {}).get('recent_offdays') or [])
    except (FeedError, ValueError, OSError):
        return []


OFF_KEY = re.compile(r'^(?:queue/)?off-(mon|tue|wed|thu|fri|sat|sun)-(.+)$')


def option_status(view, outcomes):
    """{key: status} for every option on a week's ideas board, from its live board (GET /api/board/<Monday>/view, the
    model's ideas and days) and his presses (GET /api/board/<Monday>/outcomes): key "idea:<id>" for a publishing-day
    option, "off:<day>:<id>" for an off-day one. A press of his that stands (approved, filed, trend, improved,
    rejected) wins; else the model says open, held or revised; an option on a day is approved. Only "open" and "held" (REMAKE) may be made
    again (the `days` re-run)."""
    status = {}
    model = (view or {}).get('model') if isinstance((view or {}).get('model'), dict) else {}
    for i in model.get('ideas') or []:
        if not isinstance(i, dict):
            continue
        why = {'open': 'open', 'revised': 'revised', 'held': 'held', 'held_piece': 'held_piece'}.get(str(i.get('why')), 'held_piece')
        m = OFF_KEY.match(str(i.get('doc_id') or ''))
        if m:
            status[f'off:{m.group(1)}:{m.group(2).lower()}'] = why
        elif i.get('piece_id'):
            status[f'idea:{str(i["piece_id"]).lower()}'] = why
    # An idea the board took off as a repeat (contract 1.17.0, model.repeats) is still unanswered: open, so a `days`
    # re-run may make it again (it is exactly what the run is there to replace).
    for r in model.get('repeats') or []:
        if not isinstance(r, dict):
            continue
        m = OFF_KEY.match(str(r.get('doc_id') or ''))
        if m:
            status.setdefault(f'off:{m.group(1)}:{m.group(2).lower()}', 'open')
        elif r.get('piece_id'):
            status.setdefault(f'idea:{str(r["piece_id"]).lower()}', 'open')
    for d in model.get('days') or []:
        for it in (d.get('items') or []) if isinstance(d, dict) else []:
            if not isinstance(it, dict):
                continue
            m = OFF_KEY.match(str(it.get('key') or ''))
            if m:
                status[f'off:{m.group(1)}:{m.group(2).lower()}'] = 'approved'
            elif it.get('piece_id'):
                status[f'idea:{str(it["piece_id"]).lower()}'] = 'approved'
    final = {}
    rows = [r for r in (outcomes or {}).get('outcomes') or [] if isinstance(r, dict)]
    for r in sorted(rows, key=lambda r: str(r.get('decided_at') or r.get('at') or '')):
        m = OFF_KEY.match(str(r.get('doc') or ''))
        key = f'off:{m.group(1)}:{m.group(2).lower()}' if m else (f'idea:{str(r["idea_id"]).lower()}' if r.get('idea_id') else None)
        if key:
            final[(str(r.get('doc')), key)] = str(r.get('outcome') or '')
    answered = {}
    for (doc, key), outcome in final.items():
        if outcome and outcome != 'withdrawn':
            answered[key] = outcome
    status.update(answered)
    return status


def read_status(wk, call):
    """(status, error) for the week's own options, read live; error is None when both reads answered."""
    try:
        view = get(call, f'/api/board/{wk}/view')
        outcomes = get(call, f'/api/board/{wk}/outcomes')
    except (FeedError, making.MakingError) as error:
        return {}, str(error)
    return option_status(view, outcomes), None


HUB_FIELDS = ('id', 'subsector', 'trend', 'date', 'source', 'url', 'headline', 'dek', 'why', 'companies', 'coverage')
HUB_ROUTES = ('/api/board/{week}/edition/news', '/api/hub/today')


def hub_items(answer):
    """The hub's story items in an answer: a daily snapshot ({items}) or a week of them ({days: [{edition_date, items}]})."""
    if not isinstance(answer, dict):
        return []
    rows = list(answer.get('items') or []) + [i for t in answer.get('trends') or [] if isinstance(t, dict) for i in t.get('items') or []]
    for d in answer.get('days') or []:
        if not isinstance(d, dict):
            continue
        trend_rows = [i for t in d.get('trends') or [] if isinstance(t, dict) for i in t.get('items') or []]
        rows += [dict(i, date=i.get('date') or d.get('edition_date')) for i in (d.get('items') or []) + trend_rows if isinstance(i, dict)]
    return [{k: r.get(k) for k in HUB_FIELDS if r.get(k) is not None} for r in rows if isinstance(r, dict) and r.get('url') and r.get('headline')]


def hub_trends(answer, edition_date=None):
    """Each trend lane's line of what is moving and why in an answer, with the day it was written: the first place a
    session finds the trend an idea follows (config/trend-tie.json)."""
    if not isinstance(answer, dict):
        return []
    out = [dict(key=t.get('key'), label=t.get('label'), moving=t.get('moving'), why=t.get('why'), date=answer.get('edition_date') or edition_date,
                sources=[i.get('url') for i in t.get('items') or [] if isinstance(i, dict) and i.get('url')])
           for t in answer.get('trends') or [] if isinstance(t, dict) and t.get('moving')]
    for d in answer.get('days') or []:
        if isinstance(d, dict):
            out += hub_trends({'trends': d.get('trends'), 'edition_date': d.get('edition_date')})
    return out


def hub_source(wk, read, today=None):
    """The week's stories from makeyourmindup.ai's daily news hub (content-engine #982: GET /api/hub/today, the latest
    hub_snapshots row, curated per subsector; and, once the weekly edition's route is merged, a week of the rows at
    GET /api/board/<Monday>/edition/news), read by HTTP from the board's base url the way the other gather reads are.
    Items from the seven days up to the week or up to today, whichever is earlier, the same story once (by url).
    {read_from, items, skipped}: when no route answers, skipped says why and the gather goes on, so a thin pool is said,
    never silent. The plan runs eight or nine days before its week (the Sunday loop), so a window of the seven days before
    the week was always in the future and always empty: the 7 Dec board's gather (27 Nov) asked for 30 Nov to 7 Dec. The
    window now ends at today, so the board is drawn from the latest news there is."""
    start = date.fromisoformat(wk)
    today = today or date.today()
    end = min(start, today + timedelta(days=1))
    window = ((end - timedelta(days=7)).isoformat(), end.isoformat())
    if read is None:
        return {'read_from': [], 'items': [], 'skipped': 'no board reader (a test or an offline run)'}
    got, read_from, why, trends = {}, [], [], []
    for route in HUB_ROUTES:
        path = route.format(week=wk)
        try:
            answer = read(path)
            items = hub_items(answer)
            trends += [t for t in hub_trends(answer) if window[0] <= str(t.get('date') or window[0])[:10] < window[1]]
        except Exception as error:  # an unreachable or unmerged route is a reason, never a failed gather
            why.append(f'{path}: {str(error)[:120]}')
            continue
        read_from.append(path)
        for it in items:
            if window[0] <= str(it.get('date') or window[0])[:10] < window[1]:
                got.setdefault(str(it['url']).strip().lower(), it)
    items = sorted(got.values(), key=lambda i: (str(i.get('subsector') or ''), -(i.get('coverage') or 0)))
    skipped = None if read_from else ('the hub could not be read: ' + '; '.join(why))
    if read_from and not items:
        skipped = f'the hub answered with no stories dated {window[0]} to {window[1]}'
    trends = list({(t.get('key'), str(t.get('date'))[:10]): t for t in trends}.values())  # both routes can answer with one edition
    return {'read_from': read_from, 'items': items, 'trends': trends, 'skipped': skipped}


def gather(week, call=None, out_dir=None, read=None):
    """(path written, summary lines). call: (method, path, body) -> (status, text), the engine key by default."""
    call = call or making._engine_call
    wk = monday(week).isoformat()
    if read is None:
        import board_web
        read = lambda path: board_web.call('GET', path)
    options = get(call, f'/api/week/options?week_start={wk}&include=sources')
    queue = get(call, '/api/idea-queue?combine=1')
    posts, post_errors = recent_posts(wk, call)
    status, status_error = read_status(wk, call)
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
    offs = recent_offdays(wk, read)
    out = {
        'week_start': wk,
        # When it was read: the ideas are checked against a gather of the last two days only, so what happened between
        # the Sunday run and the check (a pick, an off day used) is in it.
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
        'recent_offdays': offs,
        # Krish, 2026-11-16: "this week's Ideas Board needs to not contain mostly things we published last week". What
        # went out or is on its way on the last three weeks' live boards (every piece and post he approved, made,
        # scheduled or live, with its sources), and every option those boards offered: the repeat check in the gate
        # (idea_checks.repeat_findings) reads both from here, with no engine key. A week that could not be read is
        # said in recent_posts_error, and the gate fails until a gather reads it.
        'recent_posts': posts,
        **({'recent_posts_error': '; '.join(post_errors)} if post_errors else {}),
        'earlier_options': earlier_options(wk, None, offs),
        # Where each option of this week's own board stands (open, held, revised, or his press), for a re-run that
        # makes again only the open ones on some days (sunday-ideas.yml `days`; board_feed.py keep).
        'option_status': status,
        **({'option_status_error': status_error} if status_error else {}),
        # The ideas gate (Ruling, Krish, 2026-11-11): his answers on the eight boards before this one, the cues the run
        # learns from, and what cover and gate check (idea_checks.py): a subject he refused, a return no deeper.
        'outcomes': sources.get('outcomes') if isinstance(sources.get('outcomes'), dict) else {},
        # His presses that gave a refused subject back ("Offer it again" on a veto line), newest first.
        'unvetoed': sources.get('unvetoed') if isinstance(sources.get('unvetoed'), list) else [],
        # The house rules the ideas are held to, as the judges and writers read them: BIG_PICTURE and STORY_ARC.
        'house_rules': sources.get('house_rules') if isinstance(sources.get('house_rules'), list) else [],
        # The week's stories from the daily news hub, curated per subsector (Ruling, Krish, 2026-11-26: a thin pool is
        # never an empty board; hub_source). Skipped with its reason when the hub cannot be read.
        'hub': hub_source(wk, read),
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
    lines.append('  beside the cards: ' + ', '.join(f'{k.replace("_", " ")} {ic.get(k, 0)}' for k in ('positive', 'feed', 'corrections', 'hindsight', 'fresh_left_out_bulk_wordless'))
                 + (f'; not read: {", ".join(inspo.get("unread"))}' if inspo.get('unread') else ''))
    if out['recent'] is None:
        lines.append('  recent pieces: not in the engine\'s answer (the route on production predates them); cover cannot check repeats')
    oc = out['outcomes']
    lines.append('  his answers on earlier boards: ' + (', '.join(f'{k} {len(oc.get(k) or [])}' for k in ('filed', 'rejected', 'trend', 'improved'))
                                                       if oc else 'none in the engine\'s answer') + f'; given back {len(out["unvetoed"])}')
    hub = out['hub']
    lines.append(f'  daily hub: {len(hub["items"])} stories from the week before' + (f'; skipped: {hub["skipped"]}' if hub['skipped'] else ''))
    lines.append('  house rules: ' + (', '.join(str(r.get('id')) for r in out['house_rules']) or 'none in the engine\'s answer (the route predates them)'))
    lines.append(f'  recent posts: {len(posts)} on the {RECENT_POST_WEEKS} boards before the week, {len(out["earlier_options"])} options those boards offered'
                 + (f'; NOT READ: {out["recent_posts_error"]} (the gate fails until a gather reads them)' if post_errors else ''))
    lines.append(f'  this week\'s options: {sum(1 for v in status.values() if v == "open")} open, {sum(1 for v in status.values() if v != "open")} answered or held'
                 + (f'; NOT READ: {status_error}' if status_error else ''))
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


GOODNEWS_DAYS = 7   # a good-news story is from the seven days up to stories_due (Krish, 2026-11-07: "fresh")
# Look wide, then choose the topic (Krish, 2026-11-16: "Something's gone wrong in where you're looking and how you're
# looking because there should be millions of good news stories. What about Reddit, YouTube, or LinkedIn?"): from
# WIDE_FROM, the stories come with the candidates the run gathered before it chose the topic.
WIDE_FROM = '2026-11-17'
WIDE_CANDIDATES = 15
WIDE_PLACES = 3
PLACES = ('news', 'reddit', 'youtube', 'linkedin', 'sheet', 'card')
SHEET_DAYS = 30     # or the thirty, when it was found in his Instagram inspo sheet (Ruling, Krish, 2026-11-16)


def sheet_posts(ideas, sources, plans=None):
    """The canonical urls of the posts in the week's goodnews-input.json (lookalike.py goodnews), or None when the file
    is not on disk (it is never committed, so only the job that read the sheet holds it)."""
    week = str((ideas or {}).get('week_start') or (sources or {}).get('week_start') or '')
    if not week:
        return None
    path = Path(plans or ROOT / 'docs' / 'plans') / f'{week}-week' / 'goodnews-input.json'
    try:
        posts = json.loads(path.read_text(encoding='utf-8')).get('posts') or []
    except (OSError, ValueError):
        return None
    return {idea_checks.canon_url(p.get('url')) for p in posts if isinstance(p, dict)} - {None}


def found_in_sheet(story, sheet=None):
    """Whether a good-news story says it was found in his Instagram inspo sheet: `found.url` an Instagram post and, when
    the week's goodnews-input.json is on disk, one of its posts."""
    found = story.get('found') if isinstance(story.get('found'), dict) else {}
    url = idea_checks.canon_url(found.get('url'))
    if not url or not re.match(r'^instagram\.com/(?:[^/]+/)?(?:p|reel|reels|tv)/', url):
        return False
    return sheet is None or url in sheet


def wide_problems(label, candidates):
    """The good news looked wide before it chose its topic: at least WIDE_CANDIDATES candidates, each {title, url (https),
    place, date}, from at least WIDE_PLACES of PLACES (offdays.md, "The Saturday good news", step 1)."""
    cands = [c for c in candidates or [] if isinstance(c, dict)]
    good = [c for c in cands if str(c.get('title') or '').strip() and str(c.get('url') or '').startswith('https://')
            and c.get('place') in PLACES and re.fullmatch(r'\d{4}-\d{2}-\d{2}', str(c.get('date') or ''))]
    places = sorted({c['place'] for c in good})
    out = []
    if len(good) < WIDE_CANDIDATES:
        out.append(f'{label}: {len(good)} candidates gathered; look wide first, at least {WIDE_CANDIDATES} '
                   '({"title", "url", "place", "date"}), then choose the topic where five meet')
    if len(places) < WIDE_PLACES:
        out.append(f'{label}: candidates from {", ".join(places) or "nowhere"}; look in at least {WIDE_PLACES} of '
                   f'{", ".join(PLACES)} (Krish, 2026-11-16: "What about Reddit, YouTube, or LinkedIn?")')
    return out


def goodnews_problems(ideas, sources, today=None, plans=None):
    """A weekly series option (the Saturday good news) names when its stories are found (stories_due, the Sunday before
    its week until 7 November, the Thursday of its week since: Krish, 2026-11-07, "Saturday's good news run should be done
    later in the week so the good news is fresh"). Once that day has come it holds its five stories, each dated in the
    GOODNEWS_DAYS up to it, or the SHEET_DAYS when it was found in his Instagram inspo sheet (Krish, 2026-11-16: "Good
    news stories can come from the Instagram inspo as well. There's absolutely tonnes in there"; his Yes to thirty days
    the same day), none a story a recent off day already ran."""
    import week_plan
    today = today or date.today()
    sheet = sheet_posts(ideas, sources, plans)
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
            bad = week_plan.story_problems(stories, o.get('stories_short'))
            if bad:
                out += [f'{label}: stories {p} (due {due.isoformat()})' for p in bad]
                continue
            if due.isoformat() >= WIDE_FROM:
                out += wide_problems(label, o.get('candidates'))
            for i, st in enumerate(stories, 1):
                when = date.fromisoformat(str(st['date']))
                days = SHEET_DAYS if found_in_sheet(st, sheet) else GOODNEWS_DAYS
                if not due - timedelta(days=days) <= when <= due:
                    out.append(f'{label}: story {i} is dated {when.isoformat()}; the stories are from the seven days up to {due.isoformat()}'
                               f', or the {SHEET_DAYS} when found in his Instagram inspo sheet ("found": {{"label", "url"}} of its post)')
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
        # An off day he filed, saved as a trend or asked to improve may come back, deeper (idea_checks.returns_findings).
        if isinstance(o, dict) and o.get('verdict') not in ('next_week', 'trend', 'improve'):
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


def cover(week, ideas_path=None, plans=None):
    """Problems with the week's ideas.json against its sources.json: every must_cover id (his asks included) carried
    by an idea's `covers` (a style-only ask by `style_from`) or accounted for with a reason, the file's own shape (at
    least four ideas a publishing day, each with what a business person finds out, its story, why now, its fact and
    its linked source: week_plan.ideas_problems), the style rules (week_plan.style_problems), half and half each
    publishing day, no repeat of the last 21 days, and the Wave 1 checks (wave1: what he refused, returns, the plain
    question). [] when ready."""
    import week_plan
    wk = monday(week).isoformat()
    folder = Path(plans or ROOT / 'docs' / 'plans') / f'{wk}-week'
    sources = json.loads((folder / 'sources.json').read_text(encoding='utf-8'))
    ideas = json.loads(Path(ideas_path or folder / 'ideas.json').read_text(encoding='utf-8'))
    return week_plan.ideas_problems(ideas, monday(week)) + check(ideas, sources, week_plan, plans)


def check(ideas, sources, week_plan, plans=None):
    week = str((ideas or {}).get('week_start') or (sources or {}).get('week_start') or '')
    halves = ([f['line'] for f in wave1(ideas, sources, plans) if f['code'] in HALVES_CODES]
              if week >= idea_checks.SHAPE_FROM else halves_problems(ideas))
    return (week_plan.coverage_problems(ideas, style_answered(ideas, sources)) + week_plan.style_problems(ideas)
            + halves + locked_problems(ideas, sources) + repeat_problems(ideas, sources)
            + readback_problems(ideas, sources) + goodnews_problems(ideas, sources, plans=plans)
            + [f['line'] for f in wave1(ideas, sources, plans) if f['code'] not in HALVES_CODES and f['code'] not in idea_checks.NOTE_CODES])


HALVES_CODES = ('press_refuses', 'not_his', 'his_empty', 'no_engine')
IDEA_RULES = ('BIG_PICTURE', 'STORY_ARC')  # the live house rules the ideas are held to, as the judges and writers read them


def plans_reader(plans=None):
    """(shown_text, earlier_text16) for the answers on earlier boards, read from docs/plans/<week>-week: the words of the
    option he answered, and their short hash, so a refusal keys on what he saw and a return that came back unchanged is
    seen. None when that board's files are not on hand."""
    plans = Path(plans) if plans else ROOT / 'docs' / 'plans'
    cache = {}

    def board(week):
        if week not in cache:
            folder = plans / f'{week}-week'
            ideas = json.loads((folder / 'ideas.json').read_text(encoding='utf-8')) if (folder / 'ideas.json').exists() else {}
            growth = json.loads((folder / 'offdays-growth.json').read_text(encoding='utf-8')) if (folder / 'offdays-growth.json').exists() else {}
            cache[week] = (ideas, growth)
        return cache[week]

    def find(a):
        ideas, growth = board(str(a.get('week') or ''))
        m = re.match(r'^queue/(mon|wed|fri)-(\d+)$', str(a.get('doc') or ''))
        if m:
            opts = ((ideas.get('days') or {}).get(m.group(1)) or [])
            n = int(m.group(2))
            return idea_checks.option_text_main(opts[n - 1]) if 0 < n <= len(opts) and isinstance(opts[n - 1], dict) else None
        off = idea_checks.offday_id(a.get('doc'))
        if off:
            for opts in list((ideas.get('offdays') or {}).values()) + list((growth.get('days') or {}).values()):
                for o in opts if isinstance(opts, list) else []:
                    if isinstance(o, dict) and str(o.get('id') or o.get('concept_id')) == off:
                        return idea_checks.option_text_off(o)
        return None

    return (lambda a: find(a) or ''), (lambda a: (lambda t: idea_checks.short_hash(idea_checks.norm(t)) if t else None)(find(a)))


def wave1(ideas, sources, plans=None, p6=None, status=None, before=None):
    """The ideas quality plan's Wave 1 checks on a week's ideas.json against its sources.json (idea_checks.py): a
    subject he refused, a warned option placed first or shown without his words, a return no deeper, an option that
    calls itself his and points to nothing he typed, the vetoes the board lists, and from the 23 Nov board the shape
    (the plain question first, a research prompt, a source tag) and the house rules read; on every board, no repeat of
    what went out on the last three weeks' boards or of another option (Krish, 2026-11-16), and from the 23 Nov board
    each option's shape, aim, humour and lookalike. From the story score's `from` board, the story score's lines
    (idea_checks.story_findings; status, when given, leaves his answered options and their days alone, and before, the
    board before a `days` re-run, names the options the run made new). Each finding is {code, ref, line}."""
    week = str((ideas or {}).get('week_start') or (sources or {}).get('week_start') or '')
    shown_text, earlier_text16 = plans_reader(plans)
    opts = idea_checks.board_options(ideas)
    refused = idea_checks.refusals_from(sources, shown_text)
    said = idea_checks.his_words(sources)
    unvetoed = (sources or {}).get('unvetoed') or []
    found = idea_checks.refused_findings(opts, refused, idea_checks.his_ids(sources), said, unvetoed,
                                         idea_checks.P6_APPROVED if p6 is None else p6)
    words = {r['ref']: r['said'] for r in refused['refusals']}
    found += idea_checks.warning_findings(opts, [f for f in found if f['code'] == 'warned'], words.get)
    found += idea_checks.returns_findings(opts, idea_checks.answers_of(sources), earlier_text16, shape=week >= idea_checks.SHAPE_FROM)
    if week >= idea_checks.SHAPE_FROM:
        found += idea_checks.halves_findings(opts, sources, ideas, refused)
        found += idea_checks.vetoes_findings(ideas, idea_checks.active_vetoes(refused, said, unvetoed))
        found += idea_checks.shape_findings(ideas, week) + idea_checks.held_findings(ideas)
        found += (idea_checks.split_findings(ideas, sources) + idea_checks.asks_findings(ideas, sources) + idea_checks.learned_findings(ideas, sources)
                  + idea_checks.considered_findings(ideas) + idea_checks.goodnews_mix_findings(ideas))
        have = {str(r.get('id')) for r in (sources or {}).get('house_rules') or [] if isinstance(r, dict) and str(r.get('text') or '').strip()}
        found += [{'code': 'house_rules', 'ref': rid, 'line': f'sources.json has no house rule {rid}; gather again, and read it before writing an idea'}
                  for rid in IDEA_RULES if rid not in have]
    # Krish, 2026-11-16: no repeat of what went out, on any board the gather can read for (sources.json and the plan
    # files only: the gate in sunday-ideas.yml holds no engine key).
    found += idea_checks.repeat_read_findings(sources, week) + idea_checks.repeat_findings(ideas, sources, earlier_of(sources, week, plans))
    # The same story under new words, judged by a fresh reader against what went out, and a held ask that keeps the card
    # he saved (Krish, 2026-11-16).
    found += idea_checks.review_findings(ideas, sources, week) + idea_checks.held_ask_findings(ideas, sources, week)
    if week >= idea_checks.AIM_FROM:
        patterns, feed_urls, warnings = lookalike_of(week, plans)
        found += idea_checks.aim_findings(ideas, week, patterns, feed_urls, warnings, lookalike_text(week, plans))
        found += idea_checks.breadth_findings(ideas, week)
    # Saturday is sheet carousels followed card for card, and memes have their own lane of templates (Krish, 2026-11-17:
    # "Each suggestion should be a carousel like one carousel from my Instagram Inspo sheet, not just one story").
    if week >= idea_checks.SATURDAY_FROM:
        flows, feed_urls, carousel_urls = saturday_inputs(week, plans)
        found += idea_checks.saturday_findings(ideas, week, flows, feed_urls, carousel_urls)
    if week >= idea_checks.TEMPLATE_FROM:
        found += idea_checks.template_findings(ideas, week, earlier_template_pages(week, plans))
    # Saturday is good-news carousels, each on its own topic, none a topic of the Saturdays before (Krish, 2026-11-19:
    # "We should find good news that's not medical stuff"; config/good-news.json).
    if week >= idea_checks.GOOD_NEWS_FROM:
        found += idea_checks.goodnews_findings(ideas, week, idea_checks.goodnews_history(sources, earlier_ideas(week, plans)))
    # The beat: his focus sectors, not governance, regulation, security or breaches (Krish, 2026-11-24; config/beat.json).
    found += idea_checks.offbeat_findings(ideas, week)
    # The reader's world on the off days, from the story score's board (Krish, 2026-11-26: "Make sure all the good news
    # suggestions and meme suggestions are also aligned to the new positioning, as well as the carousels").
    found += idea_checks.offday_beat_findings(ideas, week)
    # The 3-second carousel format on every carousel option (config/carousel-format.json; Krish, 2026-11-26: "Tell the
    # Content-engine story intelligence for makeyourmindup v5 session that it is to enforce carousel formatting").
    found += idea_checks.carousel_format_findings(ideas, week)
    # The story score: every open option scored blind, each open day in its order, a hero holding three sourced whys
    # before the pick, and nothing under its floor (the story engine v5 plan; Ruling, Krish, 2026-11-26).
    found += idea_checks.story_findings(ideas, week, status, probes_of(week, plans), before=before)
    # The day's wildcard: every open Monday, Wednesday and Friday carries one, explained and its distance read by the
    # divergence engine (ruling wildcard, Krish, 2026-11-26).
    found += idea_checks.wildcard_findings(ideas, week, status, before=before)
    # Businesses first, and under the hood: every open hero says which way it faces and what AI changes in how the
    # business works, and no hero day is led by more than one creator (Ruling, Krish, 2026-11-27; config/lens.json).
    found += lens.lens_findings(ideas, week, status, before=before)
    # What is actually happening in the world: every open option, memes and carousels included, follows a dated trend
    # in one of the hub's lanes (Ruling, Krish, 2026-11-28; config/trend-tie.json).
    found += trend_tie.trend_findings(ideas, week, status, before=before)
    # The cycle's stage 2 touches (config/cycle.json; Krish, 2026-11-26: every system involved at the right moment): a
    # required touch with no line on the week's touches.jsonl fails it too, from the story score's `from` board.
    if week:
        import touch
        found += touch.findings(2, week, plans=plans)
    return found


def probes_of(week, plans=None):
    """{option id: probe} from the week's pre-pick whys probes: the verified result scripts/whys-probe-check.ts wrote to
    story/probes.json (what the score's hero floor reads) where there is one, else the raw ladder the whys-prober wrote
    to probe/<id>.whys.json (.agents/skills/plan-week/references/story-score.md). {} when there are none."""
    week_folder = Path(plans or ROOT / 'docs' / 'plans') / f'{week}-week'
    folder = week_folder / 'probe'
    out = {}
    for path in sorted(folder.glob('*.whys.json')) if folder.is_dir() else []:
        try:
            out[path.name[:-len('.whys.json')].lower()] = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            continue
    try:
        verified = json.loads((week_folder / idea_checks.STORY['files']['probes']).read_text(encoding='utf-8'))
    except (OSError, ValueError):
        verified = {}
    for k, v in (verified if isinstance(verified, dict) else {}).items():
        if idea_checks.verified_probe(v):
            out[str(k).lower()] = v
    return out


def earlier_ideas(week, plans=None):
    """[(Monday, ideas.json)] of the config/good-news.json repeat_weeks boards before the week, those on file."""
    folder = Path(plans or ROOT / 'docs' / 'plans')
    start = date.fromisoformat(week)
    out = []
    for back in range(1, idea_checks.GOOD_NEWS['repeat_weeks'] + 1):
        monday_ = (start - timedelta(days=7 * back)).isoformat()
        try:
            out.append((monday_, json.loads((folder / f'{monday_}-week' / 'ideas.json').read_text(encoding='utf-8'))))
        except (OSError, ValueError):
            continue
    return out


def saturday_inputs(week, plans=None):
    """({pattern id: card_flow} or None, feed post URLs, the carousel posts' URLs or None) for the Saturday check, from the
    week's lookalike.json and lookalike-input.json. None for the carousels when the input says no post's type."""
    import lookalike
    folder = Path(plans or ROOT / 'docs' / 'plans') / f'{week}-week'
    flows, urls, carousels = None, [], None
    try:
        data = json.loads((folder / 'lookalike.json').read_text(encoding='utf-8'))
        flows = {str(p.get('id')): [str(x) for x in p.get('card_flow') or []] for p in data.get('patterns') or [] if isinstance(p, dict) and p.get('id')}
    except (OSError, ValueError):
        pass
    try:
        data = json.loads((folder / 'lookalike-input.json').read_text(encoding='utf-8'))
        posts = [p for p in data.get('posts') or [] if isinstance(p, dict) and p.get('url')]
        urls = [p['url'] for p in posts]
        if any(p.get('type') or p.get('pages') for p in posts):
            carousels = [p['url'] for p in posts if lookalike.is_carousel(p)]
    except (OSError, ValueError):
        pass
    return flows, urls, carousels


def earlier_template_pages(week, plans=None):
    """The clip pages of every meme template the idea_checks.TEMPLATE_WEEKS boards before the week offered, from their
    ideas.json: a template is offered once."""
    folder = Path(plans or ROOT / 'docs' / 'plans')
    start = date.fromisoformat(week)
    out = []
    for back in range(1, idea_checks.TEMPLATE_WEEKS + 1):
        path = folder / f'{(start - timedelta(days=7 * back)).isoformat()}-week' / 'ideas.json'
        try:
            data = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            continue
        for opts in (data.get('offdays') if isinstance(data.get('offdays'), dict) else {}).values():
            out += [idea_checks.template_page(o) for o in opts if idea_checks.is_template(o)] if isinstance(opts, list) else []
    return [u for u in out if u]


def lookalike_text(week, plans=None):
    """{canonical post URL: its headline, caption and slide text} from the week's lookalike-input.json, for the check
    that our copy never carries their words; {} when the input is not here (a later job: it is never committed)."""
    folder = Path(plans or ROOT / 'docs' / 'plans') / f'{week}-week'
    try:
        data = json.loads((folder / 'lookalike-input.json').read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return {}
    out = {}
    for p in data.get('posts') or []:
        if isinstance(p, dict) and idea_checks.canon_url(p.get('url')):
            out[idea_checks.canon_url(p['url'])] = ' '.join(str(p.get(f) or '') for f in ('headline', 'caption', 'slides'))
    return out


def lookalike_of(week, plans=None):
    """(pattern ids, feed post URLs, warnings) from the week's lookalike.json and lookalike-input.json (lookalike.py);
    pattern ids None when the week has no lookalike.json."""
    folder = Path(plans or ROOT / 'docs' / 'plans') / f'{week}-week'
    patterns, urls, warnings = None, [], []
    try:
        data = json.loads((folder / 'lookalike.json').read_text(encoding='utf-8'))
        patterns = [str(p.get('id')) for p in data.get('patterns') or [] if isinstance(p, dict) and p.get('id')]
    except (OSError, ValueError):
        pass
    try:
        data = json.loads((folder / 'lookalike-input.json').read_text(encoding='utf-8'))
        urls = [p.get('url') for p in data.get('posts') or [] if isinstance(p, dict) and p.get('url')]
        warnings = [str(w) for w in data.get('warnings') or [] if w]
    except (OSError, ValueError):
        pass
    return patterns, urls, warnings


# What fails the Sunday run: idea_checks.GATE_CODES, and from the story score's `from` board a required stage 2 touch
# missing from the week's touches.jsonl (touch; config/cycle.json, scripts/post-pack/touch.py). Kept here, beside the one
# reader that adds it, so the blind proof's frozen idea_checks.py is unchanged. From the lens's board a hero with no lens,
# a lens that does not hold, or an open hero day led by more than one creator fails it too (lens; scripts/post-pack/lens.py,
# config/lens.json; Ruling, Krish, 2026-11-27), kept out of idea_checks.py for the same reason.
GATE_CODES = idea_checks.GATE_CODES + ('touch', lens.CODE, trend_tie.CODE)


def gate(week, ideas_path=None, plans=None):
    """The findings that fail the Sunday run (GATE_CODES), each a line, and the warnings shown beside them."""
    report = gate_report(week, ideas_path, plans)
    return report['problems'], report['warned']


GATE_SUBJECT = re.compile(r'^[^:]+:\s+(?:off-(?P<oday>mon|tue|wed|thu|fri|sat)-(?P<oid>[A-Za-z0-9_-]+)|(?P<day>mon|tue|wed|thu|fri|sat)-\d+(?:\s+\((?P<pid>[0-9a-f]{8})\))?|(?P<bday>mon|wed|fri)\s)')


def remakeable(line, days, status=None):
    """Whether a gate line's subject (the option it is about, the first one it names) is one a `days` re-run was there
    to make again: an option on one of those days that was open (never answered). Without the status, every option on
    those days counts, so a re-run never passes on an option it may have left as it was. An option the status does not
    name is not the run's (keep_problems holds it to come back byte for byte), so its line is reported, never failed:
    the two checks never ask the run for opposite things."""
    m = GATE_SUBJECT.match(line)
    if not m:
        return False
    day = m.group('oday') or m.group('day') or m.group('bday')
    if day not in days:
        return False
    if status is None or m.group('bday'):
        return True  # a line about a whole hero day (the thin week) is said only while every option on it is open
    if m.group('oday'):
        return status.get(f'off:{day}:{m.group("oid").lower()}') in REMAKE
    pid = m.group('pid')
    hits = [v for k, v in status.items() if pid and k.startswith(f'idea:{pid}')]
    return bool(hits) and hits[0] in REMAKE


def gate_report(week, ideas_path=None, plans=None, base_path=None, days=None, status=None):
    """The gate, every line it read: {problems (they fail the run), warned, ticks (an idea from his tick on a subject he
    refused: shown to him, never failing; Ruling, Krish, 2026-11-12), before}. With base_path (the week's ideas.json as it
    stood before a run that adds one idea, the Inspiration piece run), a problem the board already had is moved to
    before: it is the week's own, reported and never this run's to answer. Without it, the gate is the Sunday gate."""
    wk = monday(week).isoformat()
    folder = Path(plans or ROOT / 'docs' / 'plans') / f'{wk}-week'
    sources = json.loads((folder / 'sources.json').read_text(encoding='utf-8'))
    ideas = json.loads(Path(ideas_path or folder / 'ideas.json').read_text(encoding='utf-8'))
    base = json.loads(Path(base_path).read_text(encoding='utf-8')) if base_path else None
    found = wave1(ideas, sources, plans, status=status, before=base)
    problems = [f['line'] for f in found if f['code'] in GATE_CODES]
    before = []
    if base_path:
        had = {f['line'] for f in wave1(base, sources, plans, status=status, before=base) if f['code'] in GATE_CODES}
        # A re-run of some days (sunday-ideas.yml `days`) answers for those days in full: a problem the board already had
        # on one of them still fails, since the run was there to make its open options again. Every other day's
        # problems are the week's own and only reported.
        keep = [p for p in problems if p in had and days and remakeable(p, days, status)]
        before = [p for p in problems if p in had and p not in keep]
        problems = [p for p in problems if p not in had] + keep
    return {'problems': problems, 'warned': [f['line'] for f in found if f['code'] == 'warned'],
            'ticks': [f['line'] for f in found if f['code'] in ('his_tick', 'his_repeat')], 'before': before}


def tick_notes(week, plan, piece_id, plans=None):
    """What the option from his tick (the one whose id is piece_id) carries about each subject he refused that it is on:
    [{subject, said, at, via, ref}], his words exactly, newest first, for the board and To approve to show beside it
    (Ruling, Krish, 2026-11-12: his own tick outranks an older refusal; the idea comes to him with the refusal shown, and
    only his Approve places it). [] when it touches none. Raises OSError when the week has no sources.json."""
    wk = monday(week).isoformat()
    sources = json.loads((Path(plans or ROOT / 'docs' / 'plans') / f'{wk}-week' / 'sources.json').read_text(encoding='utf-8'))
    shown_text, _ = plans_reader(plans)
    pid = str(piece_id).lower()
    opts = [o for o in idea_checks.board_options(plan) if (o.get('idea_id') or str(o.get('off_id') or '').lower()) == pid]
    refused = idea_checks.refusals_from(sources, shown_text)
    found = idea_checks.refused_findings(opts, refused, idea_checks.his_ids(sources), idea_checks.his_words(sources),
                                         (sources or {}).get('unvetoed') or [])
    return [f['note'] for f in found if f['code'] == 'his_tick']


SERIES_DAY = {'follow_the_money': 'mon', 'under_the_hood': 'wed', 'mind_the_gap': 'fri'}
TRIAGE_OUTCOME = {'drop': 'rejected', 'not_for_us': 'rejected', 'story': 'filed', 'angle': 'filed', 'curious': 'passed'}


CUE_OUTCOME = {'not_for_us': 'rejected', 'future_piece': 'filed', 'wider_piece_context': 'trend', 'track_over_time': 'trend'}


def presses_from(data, ref_of=None):
    """His presses on one board from GET /api/board/<Monday>/outcomes, each {doc, outcome, via, day, idea_id, pick, words,
    at, verdict}: the ideas gate's idea_outcomes when the week has them; before it, the board_history presses (the 19 Oct
    board's were relayed from his triage) and the triage marks filed from the board (the 26 Oct board has nothing else),
    with the pieces scheduled from the week's options as its picks."""
    rows = [r for r in data.get('outcomes') or [] if isinstance(r, dict)]
    if rows:
        return [{'doc': r['doc'], 'outcome': r['outcome'], 'via': r.get('via'), 'day': r.get('day'), 'idea_id': r.get('idea_id'),
                 'words': r.get('words'), 'at': r.get('decided_at')} for r in rows if r.get('via') != 'approve_publish']
    out = []
    for h in data.get('history') or []:
        b = h.get('body') if isinstance(h.get('body'), dict) else {}
        if h.get('collection') == 'picks' and re.match(r'^(mon|wed|fri)$', str(h.get('doc_id'))) and b.get('pick'):
            out.append({'doc': f'picks/{h["doc_id"]}', 'outcome': 'approved', 'via': 'pick', 'day': h['doc_id'], 'idea_id': b.get('idea_id'),
                        'pick': b.get('pick'), 'words': b.get('note'), 'at': b.get('at') or h.get('updated_at')})
        elif h.get('collection') == 'queue' and re.match(r'^(mon|wed|fri)-\d+$', str(h.get('doc_id'))) and b.get('verdict'):
            out.append({'doc': f'queue/{h["doc_id"]}', 'outcome': TRIAGE_OUTCOME.get(b['verdict'], 'passed'), 'verdict': b['verdict'], 'via': 'press',
                        'day': h['doc_id'][:3], 'idea_id': b.get('idea_id'), 'words': b.get('reason'), 'at': b.get('at') or h.get('updated_at')})
    if not out:
        for t in data.get('triage') or []:
            tri = t.get('triage') if isinstance(t.get('triage'), dict) else {}
            if tri.get('decided_by') == 'Krish' and t.get('from_pick'):
                out.append({'doc': f'queue/{t["from_pick"]}', 'outcome': TRIAGE_OUTCOME.get(tri.get('verdict'), 'passed'), 'verdict': tri.get('verdict'),
                            'via': 'press', 'day': str(t['from_pick'])[:3], 'idea_id': t.get('id'), 'words': tri.get('reason') or tri.get('said'), 'at': tri.get('at')})
        pressed = {str(p.get('idea_id') or '').lower() for p in out}
        for c in data.get('cues') or []:
            ref = (ref_of or {}).get(str(c.get('subject_ref') or '').lower())
            if ref and c.get('use') in CUE_OUTCOME and str(c['subject_ref']).lower() not in pressed and c.get('use_origin') == 'krish':
                out.append({'doc': f'queue/{ref}', 'outcome': CUE_OUTCOME[c['use']], 'verdict': c['use'], 'via': 'press', 'day': ref[:3],
                            'idea_id': c['subject_ref'], 'words': c.get('said'), 'at': c.get('said_at')})
        for r in data.get('scheduled') or []:
            wo = r.get('week_option') if isinstance(r.get('week_option'), dict) else {}
            day = SERIES_DAY.get(str(wo.get('series')))
            if day:
                out.append({'doc': f'picks/{day}', 'outcome': 'approved', 'via': 'pick', 'day': day, 'idea_id': r.get('id'), 'words': None, 'at': r.get('picked_at')})
    return out


SCORE_RANK_RULE = ('Each pick\'s rank by story score total among its day\'s scored options as he first saw them (1 = the highest; '
                   'equal totals share a rank); None when the pick carries no score. The live measure of the story order.')


def score_rank_of_pick(ideas, pick_refs):
    """({day: rank or None}, the rubric version or None) for the picks (ideas_scorecard pick refs, {day: '<day>-<n>'}): each
    pick's rank by story_score total among its day's scored options (1 + how many scored higher), so a board ordered by
    the story score is measured by where his picks fell. Reads the score the board carried, never re-scores."""
    days = (ideas or {}).get('days') if isinstance((ideas or {}).get('days'), dict) else {}
    ranks, versions = {}, set()
    for day, ref in sorted((pick_refs or {}).items()):
        opts = [o for o in days.get(day) or [] if isinstance(o, dict)]
        totals = []
        for o in opts:
            sc = o.get('story_score') if isinstance(o.get('story_score'), dict) else {}
            totals.append(sc.get('total') if isinstance(sc.get('total'), (int, float)) else None)
            if sc.get('rubric_version'):
                versions.add(str(sc['rubric_version']))
        m = re.match(rf'^{day}-(\d+)$', str(ref or ''))
        n = int(m.group(1)) - 1 if m else -1
        mine = totals[n] if 0 <= n < len(totals) else None
        ranks[day] = None if mine is None else 1 + sum(1 for t in totals if t is not None and t > mine)
    return ranks, (sorted(versions)[-1] if versions else None)


JUDGE_RANK_RULE = ("Each judge's rank of his pick among its day's options that judge scored (1 = its highest; equal scores share a rank), "
                   'with how many it scored ({"rank", "of"}); a judge that did not score the pick has none. The panel\'s judges are '
                   "read from each option's `judges` ({key: score}) or docs/plans/<Monday>-week/judges.json ({option id: {key: "
                   "score}}), the story score's blind judges from story_score.axes as story:<axis>. Reported, never acted on: "
                   'config/judges.json review.')


def judge_scores(ideas, panel=None):
    """{option id: {judge key: score}} for the publishing days' options: the panel's scores (the option's own `judges`, else
    panel[option id]) and the story score's blind-judge axes as story:<axis>. Reads what the board carried; never judges."""
    blind = [a['id'] for a in (idea_checks.STORY.get('axes') or []) if a.get('source') == 'blind_judge']
    panel = {str(k).lower(): v for k, v in (panel or {}).items() if isinstance(v, dict)}
    days = (ideas or {}).get('days') if isinstance((ideas or {}).get('days'), dict) else {}
    out = {}
    for opts in days.values():
        for o in opts if isinstance(opts, list) else []:
            if not isinstance(o, dict) or not o.get('id'):
                continue
            oid = str(o['id']).lower()
            mine = o.get('judges') if isinstance(o.get('judges'), dict) else panel.get(oid) or {}
            row = {str(k): float(v) for k, v in mine.items() if isinstance(v, (int, float)) and not isinstance(v, bool)}
            axes = (o.get('story_score') or {}).get('axes') if isinstance(o.get('story_score'), dict) else None
            for a in blind:
                v = (axes or {}).get(a)
                if isinstance(v, (int, float)) and not isinstance(v, bool):
                    row[f'story:{a}'] = float(v)
            out[oid] = row
    return out


def judge_rank_of_pick(ideas, pick_refs, panel=None):
    """{judge key: {day: {"rank", "of"}}}: for each judge, the rank its scoring gave his actual pick among that day's options
    it scored (1 + how many it scored higher), beside score_rank_of_pick. A judge that never scored the pick is left out of
    that day. Read only: whether a judge earns its place is judge_review's report, and nothing here retires one."""
    days = (ideas or {}).get('days') if isinstance((ideas or {}).get('days'), dict) else {}
    scores = judge_scores(ideas, panel)
    out = {}
    for day, ref in sorted((pick_refs or {}).items()):
        opts = [o for o in days.get(day) or [] if isinstance(o, dict)]
        m = re.match(rf'^{day}-(\d+)$', str(ref or ''))
        n = int(m.group(1)) - 1 if m else -1
        if not 0 <= n < len(opts):
            continue
        rows = [scores.get(str(o.get('id') or '').lower()) or {} for o in opts]
        for judge in sorted({k for r in rows for k in r}):
            mine = rows[n].get(judge)
            if mine is None:
                continue
            given = [r[judge] for r in rows if judge in r]
            out.setdefault(judge, {})[day] = {'rank': 1 + sum(1 for v in given if v > mine), 'of': len(given)}
    return out


def judge_labels():
    """{judge key: label} where config names one (config/beat.json reader.judges: the reader, and the paying reader on key
    buyer); a story-score axis is labelled by its axis label."""
    labels = {k: v.get('label') for k, v in ((idea_checks.BEAT.get('reader') or {}).get('judges') or {}).items()
              if isinstance(v, dict) and v.get('label')}
    labels.update({f'story:{a["id"]}': f'story score, {a["label"]}' for a in idea_checks.STORY.get('axes') or [] if a.get('source') == 'blind_judge'})
    return labels


def judge_review(cards, cfg=None):
    """The review lines (config/judges.json review): after after_weeks scored weeks, a judge whose mean rank of
    his picks is no better than chance (the mean of (of + 1) / 2 over the same picks) gets the review line. Reported only:
    nothing auto-retires a judge (Ruling, Krish, 2026-11-26: no judge or rule survives on faith)."""
    rule = (cfg or json.loads((ROOT / 'config' / 'judges.json').read_text(encoding='utf-8'))).get('review') or {}
    after, line = int(rule.get('after_weeks') or 4), str(rule.get('line') or 'retire or rewrite')
    seen = {}
    for card in cards or []:
        for judge, days in ((card or {}).get('judge_rank_of_pick') or {}).items():
            for d in (days or {}).values():
                if isinstance(d, dict) and isinstance(d.get('rank'), int) and isinstance(d.get('of'), int) and d['of'] >= 1:
                    s = seen.setdefault(judge, {'weeks': set(), 'rank': [], 'chance': []})
                    s['weeks'].add(card.get('week'))
                    s['rank'].append(d['rank'])
                    s['chance'].append((d['of'] + 1) / 2)
    labels, out = judge_labels(), []
    for judge, s in sorted(seen.items()):
        if len(s['weeks']) < after:
            continue
        mean, chance = sum(s['rank']) / len(s['rank']), sum(s['chance']) / len(s['chance'])
        if mean >= chance:
            name = f'{judge} ({labels[judge]})' if judge in labels else judge
            out.append(f'review: the {name} judge ranked his picks at {mean:.2f} on average over {len(s["weeks"])} scored weeks '
                       f'({len(s["rank"])} picks), no better than chance ({chance:.2f}): {line}')
    return out


def scorecards(plans=None):
    """Every board's scorecard.json under docs/plans, oldest first."""
    root = Path(plans or ROOT / 'docs' / 'plans')
    out = []
    for p in sorted(root.glob('*-week/scorecard.json')):
        try:
            out.append(json.loads(p.read_text(encoding='utf-8')))
        except ValueError:
            continue
    return out


def scorecard_from(week, data, plans=None, refused_refs=None):
    """(the scorecard, the lines that print each label beside his words) for one board, from what the outcomes route
    answered and the week's files in docs/plans. Writes nothing."""
    import ideas_history
    folder = Path(plans or ROOT / 'docs' / 'plans') / f'{week}-week'
    ideas = ideas_history.as_pressed(folder / 'ideas.json', ideas_history.FIRST_PRESS.get(week, '2100-01-01T00:00:00'))
    growth = ideas_history.as_pressed(folder / 'offdays-growth.json', ideas_history.FIRST_PRESS.get(week, '2100-01-01T00:00:00'))
    if growth and not ideas.get('offdays'):
        ideas = dict(ideas, offdays={('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')[date.fromisoformat(d).weekday()]:
                                     [dict(o, id=o.get('concept_id')) for o in opts] for d, opts in (growth.get('days') or {}).items()})
    sources = json.loads((folder / 'sources.json').read_text(encoding='utf-8')) if (folder / 'sources.json').exists() else {}
    asks = [{'id': a.get('id'), 'words': ' '.join(str(v) for v in (a.get('his_words') or {}).values() if v)}
            for a in sources.get('asks') or [] if isinstance(a, dict) and isinstance(a.get('his_words'), dict)]
    if refused_refs is None and sources and ideas.get('days'):
        refused_refs = sorted({f['ref'] for f in wave1(ideas, sources, plans) if f['code'] in ('refused', 'warned')})
    ref_of = {str(o.get('id') or '').lower(): f'{d}-{n}' for d in ('mon', 'wed', 'fri') for n, o in enumerate((ideas.get('days') or {}).get(d) or [], 1)
              if isinstance(o, dict) and o.get('id')}
    presses = presses_from(data, ref_of)
    card = ideas_scorecard.score(week, ideas, presses, asks, refused_refs)
    card['refused_subject_refs'] = refused_refs
    card['score_rank_of_pick'], card['rubric_version'] = score_rank_of_pick(ideas, card.get('picks') or {})
    panel = json.loads((folder / 'judges.json').read_text(encoding='utf-8')) if (folder / 'judges.json').exists() else None
    card['judge_rank_of_pick'] = judge_rank_of_pick(ideas, card.get('picks') or {}, panel)
    words = {p['doc']: p.get('words') for p in ideas_scorecard.final_presses(presses).values()}
    lines = [f'scorecard for the board of {week} (each count by its rule; he can overrule any label in the Sunday say-back):']
    for k, v in card['counts'].items():
        lines.append(f'  {k}: {v}  [{ideas_scorecard.RULES[k]}]')
    lines += [f'  flag: {f}' for f in card['flags']]
    if card['rubric_version']:
        lines.append(f'  score_rank_of_pick: {card["score_rank_of_pick"]}  [{SCORE_RANK_RULE} ({card["rubric_version"]})]')
    if card['judge_rank_of_pick']:
        lines.append(f'  judge_rank_of_pick: {json.dumps(card["judge_rank_of_pick"], sort_keys=True)}  [{JUDGE_RANK_RULE}]')
    for lab in card['labels']:
        said = words.get(lab['doc'])
        lines.append(f'  {lab["doc"]}: {lab["outcome"]}' + (f', {"/".join(lab["parts"])}' if lab['parts'] else '') + (', wasted' if lab['wasted'] else '')
                     + (f'  <- his words: "{said}"' if said else ''))
    return card, lines


def scorecard(week, call=None, plans=None, write=True):
    """The scorecard for one board from his real presses (GET /api/board/<Monday>/outcomes, read-only), written to
    docs/plans/<Monday>-week/scorecard.json with ids, labels and counts only."""
    call = call or making._engine_call
    wk = monday(week).isoformat()
    card, lines = scorecard_from(wk, get(call, f'/api/board/{wk}/outcomes'), plans)
    if write:
        path = Path(plans or ROOT / 'docs' / 'plans') / f'{wk}-week' / 'scorecard.json'
        path.write_text(json.dumps(card, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
        lines.append(f'wrote {path}')
    # The Monday learn step's judge review (config/judges.json review): reported, nothing retires itself.
    lines += judge_review([c for c in scorecards(plans) if c.get('week') != wk] + [card])
    return card, lines


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


def canonical(o):
    return json.dumps(o, sort_keys=True, ensure_ascii=False)


def keep_problems(before, after, status, days):
    """What a re-run that makes again only the open options on some days (sunday-ideas.yml `days`) changed that it may
    not: any day it was not given, and on its days any option that existed before and is not open (approved, revised,
    held, filed, saved as a trend, improved, rejected, or not known), which must come back byte for byte as it was
    (its JSON with sorted keys). A publishing-day option also keeps its place: the board's presses name it by place
    (queue/<day>-<n>). status: option_status's {key: status}. [] when the re-run kept to that."""
    days = {str(d).strip().lower()[:3] for d in days if str(d).strip()}
    out = []
    for group in ('days', 'offdays'):
        b = (before or {}).get(group) if isinstance((before or {}).get(group), dict) else {}
        a = (after or {}).get(group) if isinstance((after or {}).get(group), dict) else {}
        for day in sorted(set(b) | set(a)):
            bo = b.get(day) if isinstance(b.get(day), list) else []
            ao = a.get(day) if isinstance(a.get(day), list) else []
            if day not in days:
                if canonical(bo) != canonical(ao):
                    out.append(f'{day}: not one of the days to make again ({", ".join(sorted(days))}), and its options changed; leave them as they were')
                continue
            for n, o in enumerate(bo, 1):
                if not isinstance(o, dict):
                    continue
                oid = str(o.get('id') or '').lower()
                key = f'idea:{oid}' if group == 'days' else f'off:{day}:{oid}'
                st = status.get(key, 'unknown')
                if st in REMAKE:
                    continue
                if group == 'days':
                    same = n <= len(ao) and canonical(ao[n - 1]) == canonical(o)
                    where = f'{day}-{n}'
                else:
                    match = [x for x in ao if isinstance(x, dict) and str(x.get('id') or '').lower() == oid]
                    same = bool(match) and canonical(match[0]) == canonical(o)
                    where = f'off-{day}-{o.get("id")}'
                if not same:
                    out.append(f'{where} is {st}, not open: it comes back exactly as it was'
                               + (' and in its place' if group == 'days' else '') + '; only the options nobody answered are made again')
    return out


REFILL_OPEN = 4  # unanswered options each day a `days` re-run made again ends with (Krish, 2026-11-16)


def refill_breadth(before, after, status, days):
    """Krish, 2026-11-16: "There's not enough quality and breadth of ideas flowing through to this week's or next week's
    boards." A re-run of some days (sunday-ideas.yml `days`) leaves each of them with at least REFILL_OPEN options he has
    not answered: the new ones it wrote and the open or revised ones it kept (the 16 Nov re-run left Tue 17 with one).
    An option held back, or answered, is not a choice he has there. [] when every day it made again has enough."""
    days = {str(d).strip().lower()[:3] for d in days if str(d).strip()}
    out = []
    for day in sorted(days):
        for group in ('days', 'offdays'):
            b = (before or {}).get(group) if isinstance((before or {}).get(group), dict) else {}
            a = (after or {}).get(group) if isinstance((after or {}).get(group), dict) else {}
            if day not in a and day not in b:
                continue
            old = {str(o.get('id') or '').lower() for o in b.get(day) or [] if isinstance(o, dict)}
            choices = 0
            for o in a.get(day) or []:
                if not isinstance(o, dict) or o.get('weekly'):
                    continue
                oid = str(o.get('id') or '').lower()
                key = f'idea:{oid}' if group == 'days' else f'off:{day}:{oid}'
                if oid not in old or status.get(key) in ('open', 'revised'):
                    choices += 1
            if choices < REFILL_OPEN:
                out.append(f'{day}: {choices} option(s) he has not answered after the re-run; a day made again offers at least '
                           f'{REFILL_OPEN} (new ones and the open ones kept), so he has a real choice there')
    return out


def merged_status(paths):
    """One status from several reads of it (before and after the run): an option answered in any read stays answered
    (that read's answer); an option open in every read it appears in is open. Raises ValueError when a read failed:
    nothing is made again without knowing what he answered."""
    out = {}
    for p in [paths] if isinstance(paths, (str, Path)) else paths:
        data = json.loads(Path(p).read_text(encoding='utf-8'))
        if data.get('error') or not isinstance(data.get('status'), dict):
            raise ValueError(f'the status of the week\'s options could not be read ({data.get("error") or "no status"}); nothing is made again without it')
        for k, v in data['status'].items():
            if v not in REMAKE or k not in out:
                out[k] = v
    return out


def keep(week, days, before_path, status_path, ideas_path=None, plans=None):
    """keep_problems on the week's ideas.json against the copy taken before the re-run and the status read before it
    (and after it: status_path may be a list of reads, merged by merged_status)."""
    wk = monday(week).isoformat()
    after = json.loads(Path(ideas_path or Path(plans or ROOT / 'docs' / 'plans') / f'{wk}-week' / 'ideas.json').read_text(encoding='utf-8'))
    before = json.loads(Path(before_path).read_text(encoding='utf-8'))
    try:
        status = merged_status(status_path)
    except ValueError as error:
        return [str(error)]
    return keep_problems(before, after, status, days) + refill_breadth(before, after, status, days)


def load_recent(path):
    """Recent posts from a file or a folder, for the repeat check run offline: a folder of view answers saved as
    <Monday>.json (GET /api/board/<Monday>/view), or a file holding a list of posts or {"recent_posts": [...]}."""
    p = Path(path)
    if p.is_dir():
        posts = []
        for f in sorted(p.glob('*.json')):
            m = re.match(r'^(\d{4}-\d{2}-\d{2})(?:-view)?\.json$', f.name)
            if not m:
                continue
            view = json.loads(f.read_text(encoding='utf-8'))
            posts += posts_of(m.group(1), view.get('model') if isinstance(view.get('model'), dict) else {})
        return posts
    data = json.loads(p.read_text(encoding='utf-8'))
    return data if isinstance(data, list) else list(data.get('recent_posts') or [])


def repeats(week, ideas_path=None, plans=None, recent_from=None):
    """The repeat findings on a week's ideas.json, with recent posts from sources.json or, offline, from recent_from."""
    wk = monday(week).isoformat()
    folder = Path(plans or ROOT / 'docs' / 'plans') / f'{wk}-week'
    sources = json.loads((folder / 'sources.json').read_text(encoding='utf-8'))
    if recent_from:
        sources = dict(sources, recent_posts=load_recent(recent_from))
        sources.pop('recent_posts_error', None)
    ideas = json.loads(Path(ideas_path or folder / 'ideas.json').read_text(encoding='utf-8'))
    return (idea_checks.repeat_read_findings(sources, wk)
            + idea_checks.repeat_findings(ideas, sources, earlier_of(sources, wk, plans)))


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
    # The last three weeks' live boards (Krish, 2026-11-16: no repeat of what went out) and this week's own.
    item = lambda key, typ, stage, title, href: {'key': key, 'type': typ, 'day': 'tue', 'date': '2026-10-20', 'kind': 'meme', 'kind_label': 'Meme',
                                                  'title': title, 'stage': {'key': stage}, 'piece_id': None, 'item': None,
                                                  'read': {'sources': [{'label': 'The narrative lock (x.md)', 'href': 'https://github.com/x'},
                                                                       {'label': 'Paper, 2 Oct 2026', 'href': href}]}}
    for back, w in enumerate(('2026-10-19', '2026-10-12', '2026-10-05'), 1):
        answers[f'/api/board/{w}/view'] = {'ok': True, 'model': {'days': [{'day': 'tue', 'items': [
            item(f'off-tue-a{back}', 'post', 'live', f'Post {back} went out', f'https://www.e.com/{back}/?utm_source=x'),
            item(f'off-tue-b{back}', 'post', 'nonsense', 'Not a post', 'https://e.com/skip')]}], 'ideas': []}}
    answers['/api/board/2026-10-26/view'] = {'ok': True, 'model': {'days': [], 'ideas': [{'doc_id': 'off-thu-open1', 'why': 'open'},
                                                                                          {'doc_id': 'mon-1', 'piece_id': 'P1', 'why': 'open'}]}}
    answers['/api/board/2026-10-26/outcomes'] = {'ok': True, 'outcomes': [{'doc': 'queue/mon-1', 'idea_id': 'P1', 'outcome': 'filed', 'decided_at': '2026-10-25T10:00:00Z'}]}
    calls = []

    def call(method, path, body):
        calls.append((method, path))
        return (200, json.dumps(answers[path])) if path in answers else (404, 'no')
    problems = []
    with tempfile.TemporaryDirectory() as tmp:
        path, lines = gather('2026-10-26', call, tmp, read=lambda p: {})
        data = json.loads(Path(path).read_text(encoding='utf-8'))
        if {m for m, _ in calls} != {'GET'} or len(calls) != 7:
            problems.append(f'gather must only read, its two sources, three past boards and this week\'s board ({len(calls)} reads)')
        if [p['key'] for p in data['recent_posts']] != ['off-tue-a1', 'off-tue-a2', 'off-tue-a3'] or data['recent_posts'][0]['primary'] != 'https://www.e.com/1/?utm_source=x' \
                or 'recent_posts_error' in data or not any('recent posts: 3 on the 3 boards' in x for x in lines):
            problems.append('every post he approved on the last three boards is read, its narrative lock left out, and counted')
        if data['option_status'] != {'off:thu:open1': 'open', 'idea:p1': 'filed'}:
            problems.append(f'this week\'s options are open until his press answers them ({data["option_status"]})')
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
    down = dict(answers)
    down.pop('/api/board/2026-10-12/view')
    with tempfile.TemporaryDirectory() as tmp:
        path, lines = gather('2026-10-26', lambda m, p, b: (200, json.dumps(down[p])) if p in down else (503, 'down'), tmp, read=lambda p: {})
        data = json.loads(Path(path).read_text(encoding='utf-8'))
        if '2026-10-12' not in str(data.get('recent_posts_error')) or len(data['recent_posts']) != 2 or not any('NOT READ' in x for x in lines):
            problems.append('a past board that cannot be read is said in recent_posts_error, never an empty week')
        if not idea_checks.repeat_read_findings(data, '2026-10-26'):
            problems.append('the gate fails while a past board could not be read')
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
    import week_plan
    problems = []
    his = lambda **kw: dict({'source_kind': 'inspo', 'covers': []}, **kw)
    eng = lambda **kw: dict({'source_kind': 'engine', 'covers': []}, **kw)
    days = {k: [his(), eng()] for k, _ in PUBLISHING_DAYS}
    sources = {'recent': [], 'must_cover': [
        {'id': 'a397253e', 'what': 'Inspiration card "granny" you wrote on, then dismissed', 'ask': True, 'state': 'dismissed', 'style_only': False},
        {'id': '45e0ead0', 'what': 'Inspiration card "Git" you wrote on and routed to Study style', 'ask': True, 'state': 'style_only', 'style_only': True}]}
    # (a) every ask covered or accounted: a dismissed ask left out is said; a style-only ask is answered by style_from.
    left = week_plan.coverage_problems({'days': days}, style_answered({'days': days}, sources))
    if not any('a397253e' in x for x in left) or not any('45e0ead0' in x for x in left):
        problems.append('an ask he typed words on, dismissed or style-only, left off the board must be said')
    used = {'days': dict(days, mon=[his(covers=['a397253e']), eng(style_from=['45e0ead0'])])}
    if week_plan.coverage_problems(used, style_answered(used, sources)):
        problems.append('an ask in covers, and a style-only ask in style_from, are answered')
    topic_only = dict(sources, must_cover=[dict(sources['must_cover'][0], style_only=False, id='x1')])
    named = {'days': dict(days, mon=[his(), eng(style_from=['x1'])])}
    if not week_plan.coverage_problems(named, style_answered(named, topic_only)):
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
    if not any('stories is a list of 4' in x for x in goodnews_problems(wk([]), gsrc, date(2026, 11, 8))):
        problems.append('a weekly option on its Sunday with no stories is refused')
    if goodnews_problems(wk([stry(n) for n in range(1, 6)]), gsrc, date(2026, 11, 8)):
        problems.append('five fresh stories with sources and pictures pass')
    old_one = goodnews_problems(wk([stry(1, date='2026-10-20')] + [stry(n) for n in range(2, 6)]), gsrc, date(2026, 11, 8))
    rerun = goodnews_problems(wk([stry(1, source={'label': 'L', 'url': 'https://e.com/used'})] + [stry(n) for n in range(2, 6)]), gsrc, date(2026, 11, 8))
    if not any('dated 2026-10-20' in x for x in old_one) or not any('ran on a recent off day' in x for x in rerun):
        problems.append('a stale story and a story a recent off day ran are refused')
    sheet_one = goodnews_problems(wk([stry(1, date='2026-10-20', found={'label': 'Your Instagram inspo sheet', 'url': 'https://www.instagram.com/p/abc123/'})]
                                     + [stry(n) for n in range(2, 6)]), gsrc, date(2026, 11, 8))
    if sheet_one:
        problems.append('a story found in his Instagram inspo sheet may be up to thirty days old (Krish, 2026-11-16)')
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
    sc = sub.add_parser('scorecard', help='the board\'s scorecard from his real presses, each count by its rule; writes docs/plans/<Monday>-week/scorecard.json')
    sc.add_argument('week', help='the Monday of the board, YYYY-MM-DD')
    sc.add_argument('--no-write', action='store_true', help='print only')
    gt = sub.add_parser('gate', help='the checks that fail the Sunday run: a subject he refused, a warned option placed first, a return no deeper, '
                                     'a repeat of what went out, an option without its shape')
    gt.add_argument('week', help='the Monday the week starts on, YYYY-MM-DD')
    gt.add_argument('--ideas', help='an ideas file other than docs/plans/<Monday>-week/ideas.json')
    gt.add_argument('--base', help='the week\'s ideas.json before a run that adds one idea: what the board already had is reported, never this run\'s to answer')
    gt.add_argument('--days', help='with --base, a re-run of these days (e.g. thu,sat): a problem already on an open option of those days still fails')
    gt.add_argument('--status', action='append', help='with --days, the options\' status before (and after) the run (board_feed.py status): only an option open in every read was the run\'s to make again')
    rp = sub.add_parser('repeats', help='what on the week\'s ideas repeats a recent post, piece, earlier option or another option (the gate\'s repeat check)')
    rp.add_argument('week', help='the Monday the week starts on, YYYY-MM-DD')
    rp.add_argument('--ideas', help='an ideas file other than docs/plans/<Monday>-week/ideas.json')
    rp.add_argument('--recent-from', help='recent posts from here instead of sources.json: a folder of saved view answers '
                                          '(<Monday>.json) or a file with a list of posts (offline)')
    st = sub.add_parser('status', help='where each option of the week\'s own board stands (open, held, revised or his press), read live')
    st.add_argument('week', help='the Monday the week starts on, YYYY-MM-DD')
    st.add_argument('--out', help='write {week, status, error} here (a re-run\'s keep check reads it)')
    kp = sub.add_parser('keep', help='a re-run that makes again only the open options on some days changed nothing else')
    kp.add_argument('week', help='the Monday the week starts on, YYYY-MM-DD')
    kp.add_argument('--days', required=True, help='the days it may make again, e.g. thu,sat')
    kp.add_argument('--before', required=True, help='the week\'s ideas.json as it stood before the re-run')
    kp.add_argument('--status', required=True, action='append', help='a status file board_feed.py status wrote, before the re-run (and again after it); an option answered in any is kept')
    kp.add_argument('--ideas', help='an ideas file other than docs/plans/<Monday>-week/ideas.json')
    sub.add_parser('self-test')
    args = ap.parse_args(argv)
    if args.cmd == 'repeats':
        try:
            found = repeats(args.week, args.ideas, recent_from=args.recent_from)
        except (FeedError, OSError, ValueError) as error:
            print(f'board_feed repeats: could not read the week: {error}', file=sys.stderr)
            return 2
        for f in found:
            print(f['line'])
        print(f'repeats: {len(found)} finding(s) on {len({f["ref"] for f in found})} option(s)' if found else 'repeats: none')
        return 1 if found else 0
    if args.cmd == 'status':
        wk = monday(args.week).isoformat()
        status, error = read_status(wk, making._engine_call)
        if args.out:
            # Only into the job's own temporary folder or the plans: the Sunday run may call this command, and is fenced
            # to write under docs/plans.
            out = Path(args.out).resolve()
            homes = [(ROOT / 'docs' / 'plans').resolve()] + ([Path(os.environ['RUNNER_TEMP']).resolve()] if os.environ.get('RUNNER_TEMP') else [])
            if not any(out == h or h in out.parents for h in homes):
                print(f'board_feed status: --out must be under docs/plans or $RUNNER_TEMP, not {args.out}', file=sys.stderr)
                return 2
            out.write_text(json.dumps({'week': wk, 'status': status, 'error': error}, indent=1) + '\n', encoding='utf-8')
        counts = {}
        for v in status.values():
            counts[v] = counts.get(v, 0) + 1
        print(f'status of the week of {wk}: ' + (', '.join(f'{k} {n}' for k, n in sorted(counts.items())) or 'no options') + (f'; NOT READ: {error}' if error else ''))
        return 1 if error else 0
    if args.cmd == 'keep':
        try:
            problems = keep(args.week, args.days.split(','), args.before, args.status, args.ideas)
        except (FeedError, OSError, ValueError) as error:
            print(f'board_feed keep: could not read the week: {error}', file=sys.stderr)
            return 2
        print('keep: ' + ('REFUSED:\n  ' + '\n  '.join(problems) if problems else f'only the open options on {args.days} were made again, each with at least {REFILL_OPEN} to choose from'))
        return 1 if problems else 0
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
    if args.cmd == 'scorecard':
        try:
            _, lines = scorecard(args.week, write=not args.no_write)
        except (FeedError, making.MakingError, OSError, ValueError) as error:
            print(f'board_feed scorecard: {error}', file=sys.stderr)
            return 1
        print('\n'.join(lines))
        return 0
    if args.cmd == 'gate':
        try:
            status = merged_status(args.status) if args.status else None
            report = gate_report(args.week, args.ideas, base_path=args.base, days=[d for d in (args.days or '').split(',') if d] or None, status=status)
        except (FeedError, OSError, ValueError) as error:
            # Not a refusal: the gate could not read the week. Exit 2, so no run says he refused something he did not.
            print(f'board_feed gate: could not read the week: {error}', file=sys.stderr)
            return 2
        problems = report['problems']
        for line in report['warned']:
            print(f'shown with his words: {line}')
        for line in report['ticks']:
            print(line)
        for line in report['before']:
            print(f'on the board before this run, the week\'s own and not this run\'s to answer: {line}')
        print('gate: ' + ('REFUSED:\n  ' + '\n  '.join(problems) if problems else 'nothing he refused is offered again, no warned option leads its day, '
                                                                                'every return comes back deeper, and nothing repeats what went out'
                                                                                + (' (in what this run added)' if args.base else '')))
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
