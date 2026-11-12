#!/usr/bin/env python3
"""His instruction on an Inspiration card: make it into a piece now (docs/PUBLISH_BOARDS.md, "His instruction").

Ruling (Krish, 2026-11-12): an inspiration card he ticks is an instruction that jumps the queue: Content means make it
into a piece now, Production means use the style within a week. The tick is Control Centre's (inspiration_actions);
his press there sends .github/workflows/inspiration-piece.yml one repository_dispatch carrying the action id. This
script is the deterministic half of that job; the session (plan-week, references/inspiration-piece.md) writes the idea.

  python3 scripts/post-pack/inspiration_act.py brief ACTION_ID [--out FILE] [--today YYYY-MM-DD]
      the tick, his words, the card and its reading (GET /api/inspiration/actions), the planning week and its open
      days in order, each with its series' mandate: what the session reads before it writes a word.
  python3 scripts/post-pack/inspiration_act.py place IDEA_FILE
      puts the idea the session wrote onto the week's ideas board through the normal idea path: appended to its day in
      docs/plans/<Monday>-week/ideas.json (after the day's other options, so the board's press ids for them never move),
      marked from_inspiration. It never sets a day: only his Approve does (the ideas gate).
  python3 scripts/post-pack/inspiration_act.py offer IDEA_FILE
      once the workflow has put that ideas.json on the week's branch: offers the idea for its series through POST
      /api/week/options, on top of the day's four, with inspiration_action and covers naming the card (an off day's
      idea is offered by ideas.json alone). Control Centre's To approve reads it from there.
  python3 scripts/post-pack/inspiration_act.py report ACTION_ID --state running|drafted|failed [--piece UUID]
      [--error WORDS] [--run-url URL]
      the job's own state on his tick (POST /api/inspiration/actions), which Control Centre shows on the card and in
      To approve: never silent.

IDEA_FILE is JSON: {"action_id", "week" (the Monday), "day" (mon..sat), "piece_id" (the content_ideas row the session
made with POST /api/content-ideas), "option" (the ideas.json option: so_what, story, why_now, fact, source, and for an
off day the off-day fields), "pitch" and "why_now" (the week option's words; a publishing day only)}.
"""
import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE.parent))
import engine  # noqa: E402

NEW_YORK = ZoneInfo('America/New_York')
UUID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)
MONDAY = re.compile(r'^\d{4}-\d{2}-\d{2}$')
# Control Centre's planningWeekStart (src/lib/weekPlan.ts): from the first recording Sunday the planning week is the
# one after the current week, so To approve, which reads that week, shows the idea the moment it is written.
RECORDING_SUNDAY_FROM = dt.date(2026, 11, 1)
SERIES_DAYS = ('mon', 'wed', 'fri')
OFF_DAYS = ('tue', 'thu', 'sat')
DAY_ORDER = ('mon', 'tue', 'wed', 'thu', 'fri', 'sat')
FROM_INSPIRATION = 'from_inspiration'


def planning_monday(today: dt.date) -> dt.date:
    """The Monday of the week Control Centre's To approve reads (planningWeekStart)."""
    weekday = (today.weekday() + 1) % 7  # Sunday 0, as JavaScript counts
    coming = today + dt.timedelta(days=1) if weekday == 0 else today + dt.timedelta(days=1 - weekday)
    return coming + dt.timedelta(days=7) if today >= RECORDING_SUNDAY_FROM else coming


def day_of(cadence: str | None) -> str | None:
    """The day a series publishes on, from its cadence label (Mondays, Wednesday, ...)."""
    text = (cadence or '').lower()
    for day, name in (('mon', 'monday'), ('tue', 'tuesday'), ('wed', 'wednesday'), ('thu', 'thursday'), ('fri', 'friday'), ('sat', 'saturday')):
        if name in text:
            return day
    return None


def open_days(series: list, picks: list) -> list:
    """The publishing days still open, in the week's order: a day with nothing scheduled and no pick saved (Control
    Centre's openIdeas reads the same two things), each with its series and mandate."""
    picked = {d.get('id') for d in picks if isinstance(d, dict) and isinstance((d.get('body') or {}).get('pick'), str)}
    out = []
    for s in series:
        day = day_of(s.get('cadence'))
        if day not in SERIES_DAYS or day in picked or s.get('scheduled'):
            continue
        out.append({'day': day, 'series': s.get('slug'), 'label': s.get('label'), 'mandate': s.get('mandate'),
                    'options': len(s.get('options') or [])})
    return sorted(out, key=lambda x: DAY_ORDER.index(x['day']))


def ask(method: str, path: str, body=None) -> dict:
    status, text = engine.call(method, path, body, token=engine.operator_key(), timeout=120)
    try:
        answer = json.loads(text)
    except ValueError:
        answer = {'ok': False, 'error': text[:300]}
    if status >= 400 or answer.get('ok') is False:
        raise RuntimeError(f"{method} {path} answered {status}: {answer.get('error')} {'; '.join(answer.get('problems') or [])}".strip())
    return answer


def board_docs(week: str, collection: str) -> list:
    out, offset = [], 0
    for _ in range(8):
        answer = ask('GET', f'/api/board/{week}/{collection}?offset={offset}')
        out += [d for d in answer.get('documents') or [] if isinstance(d, dict)]
        if not isinstance(answer.get('next_offset'), int):
            break
        offset = answer['next_offset']
    return out


def cmd_brief(args) -> int:
    if not UUID.match(args.action_id):
        print('brief: ACTION_ID is the tick id (a uuid)')
        return 2
    today = dt.date.fromisoformat(args.today) if args.today else dt.datetime.now(NEW_YORK).date()
    monday = planning_monday(today).isoformat()
    tick = ask('GET', f'/api/inspiration/actions?id={args.action_id}')
    week = ask('GET', f'/api/week/options?week_start={monday}')
    picks = board_docs(monday, 'picks')
    out = {'action_id': args.action_id, 'week': monday, 'ready': tick.get('ready'), 'action': tick.get('action'),
           'his_words': tick.get('his_words'), 'card': tick.get('card'), 'request': tick.get('request'), 'reading': tick.get('reading'),
           'open_days': open_days(week.get('series') or [], picks), 'off_days': list(OFF_DAYS)}
    text = json.dumps(out, indent=2, ensure_ascii=False)
    if args.out:
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text(text + '\n', encoding='utf-8')
    action = out['action'] or {}
    print(f"brief: tick {args.action_id} ({action.get('kind')}, {action.get('state')}); week {monday}; "
          f"open days {', '.join(d['day'] for d in out['open_days']) or 'none'}; ready {bool(out['ready'])}"
          + (f'; written to {args.out}' if args.out else ''))
    if not args.out:
        print(text)
    return 0


def check_idea(idea: dict) -> list:
    """What is wrong with the idea file, in words; empty when it can be placed."""
    problems = []
    if not UUID.match(str(idea.get('action_id', ''))):
        problems.append('action_id is the tick id')
    if not MONDAY.match(str(idea.get('week', ''))) or dt.date.fromisoformat(idea['week']).weekday() != 0:
        problems.append('week is the Monday, YYYY-MM-DD')
    if idea.get('day') not in DAY_ORDER:
        problems.append(f"day is one of {', '.join(DAY_ORDER)}")
    if not UUID.match(str(idea.get('piece_id', ''))):
        problems.append('piece_id is the content_ideas row made with POST /api/content-ideas')
    option = idea.get('option')
    if not isinstance(option, dict):
        return problems + ['option is the ideas.json option']
    for key in ('so_what', 'why_now', 'source'):
        if not option.get(key):
            problems.append(f'option.{key} is required (the normal idea path)')
    if idea.get('day') in SERIES_DAYS:
        if not option.get('story'):
            problems.append('option.story is required on a publishing day')
        for key, cap in (('pitch', 700), ('why_now', 400)):
            text = str(idea.get(key) or '').strip()
            if not text or len(text) > cap:
                problems.append(f'{key} is the week option\'s words, up to {cap} characters')
    return problems


def insert_option(plan: dict, idea: dict, card: dict | None) -> dict:
    """The ideas.json option, appended to its day after the day's other options (their press ids, <day>-<n>, never
    move), marked from his inspiration. Placing the same idea again replaces it where it stands."""
    option = dict(idea['option'], id=idea['piece_id'])
    # The card by id and name only: this repository is public, and Control Centre holds the rest.
    option[FROM_INSPIRATION] = {'action_id': idea['action_id'], 'card_id': (card or {}).get('id'), 'card_name': (card or {}).get('name')}
    option.setdefault('source_kind', 'his')
    if card:
        covers = list(option.get('covers') or [])
        option['covers'] = covers if card['id'] in covers else covers + [card['id']]
    key = 'days' if idea['day'] in SERIES_DAYS else 'offdays'
    day = plan.setdefault(key, {}).setdefault(idea['day'], [])
    at = next((i for i, o in enumerate(day) if isinstance(o, dict) and str(o.get('id', '')).lower() == idea['piece_id'].lower()), None)
    if at is None:
        day.append(option)
    else:
        day[at] = option
    return option


def week_options_body(idea: dict, series: dict, card: dict | None) -> dict:
    """The day's options as they stand, with the idea from his card on top of the four (POST /api/week/options
    replaces the day's set, so every option already there is sent again unchanged)."""
    kept = [o for o in series.get('options') or [] if str(o.get('id', '')).lower() != idea['piece_id'].lower()]
    options = [{k: o[k] for k in ('id', 'rank', 'pitch', 'why_now', 'recommended', 'covers', 'inspiration_action') if o.get(k) is not None}
               for o in kept]
    rank = min(9, max([int(o.get('rank') or 0) for o in kept] + [0]) + 1)
    options.append({'id': idea['piece_id'], 'rank': rank, 'pitch': idea['pitch'].strip(), 'why_now': idea['why_now'].strip(),
                    'recommended': False, 'inspiration_action': idea['action_id'], **({'covers': [card['id']]} if card else {})})
    return {'week_start': idea['week'], 'series': series['slug'], 'options': options}


def read_idea(name: str, path: str) -> tuple:
    """(idea, tick, None) when the idea file can be placed, else (None, None, exit code) with what is wrong said."""
    idea = json.loads(Path(path).read_text(encoding='utf-8'))
    problems = check_idea(idea)
    if problems:
        print(f'{name}: refused: ' + '; '.join(problems))
        return None, None, 2
    tick = ask('GET', f"/api/inspiration/actions?id={idea['action_id']}")
    if (tick.get('action') or {}).get('kind') != 'make_piece':
        print(f'{name}: refused: the tick is not a Content tick (make_piece)')
        return None, None, 2
    return idea, tick, None


def series_of(idea: dict, week: dict) -> tuple:
    """(series, None) for a publishing day still open, else (None, why)."""
    series = next((s for s in week.get('series') or [] if day_of(s.get('cadence')) == idea['day']), None)
    if not series:
        return None, f"no series publishes on {idea['day']}"
    if series.get('scheduled'):
        return None, f"{idea['day']} already has its piece; offer the idea on an off day"
    return series, None


def cmd_place(args) -> int:
    idea, tick, code = read_idea('place', args.idea_file)
    if code is not None:
        return code
    path = ROOT / 'docs' / 'plans' / f"{idea['week']}-week" / 'ideas.json'
    if not path.is_file():
        print(f'place: refused: {path.relative_to(ROOT)} is not on disk; the planning week has no ideas board yet')
        return 2
    if idea['day'] in SERIES_DAYS:
        _, why = series_of(idea, ask('GET', f"/api/week/options?week_start={idea['week']}"))
        if why:
            print(f'place: refused: {why}')
            return 2
    plan = json.loads(path.read_text(encoding='utf-8'))
    insert_option(plan, idea, tick.get('card'))
    path.write_text(json.dumps(plan, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f"place: {path.relative_to(ROOT)} carries the idea on {idea['day']}, after the day's other options, marked from his inspiration")
    return 0


def cmd_offer(args) -> int:
    idea, tick, code = read_idea('offer', args.idea_file)
    if code is not None:
        return code
    if idea['day'] not in SERIES_DAYS:
        print(f"offer: {idea['day']} is an off day; ideas.json offers it, nothing else to write")
        return 0
    series, why = series_of(idea, ask('GET', f"/api/week/options?week_start={idea['week']}"))
    if why:
        print(f'offer: refused: {why}')
        return 2
    written = ask('POST', '/api/week/options', week_options_body(idea, series, tick.get('card')))
    print(f"offer: offered for {series['slug']} on {idea['week']} {idea['day']} ({len(written.get('written') or [])} options written)")
    return 0


def cmd_report(args) -> int:
    body = {'id': args.action_id, 'job_state': args.state}
    if args.piece:
        body['piece_id'] = args.piece
    if args.error:
        body['error'] = args.error
    if args.run_url:
        body['run_url'] = args.run_url
    answer = ask('POST', '/api/inspiration/actions', body)
    action = answer.get('action') or {}
    print(f"report: tick {args.action_id} is {action.get('state')}, its job {action.get('job_state')}")
    return 0


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    sub = p.add_subparsers(dest='cmd', required=True)
    b = sub.add_parser('brief')
    b.add_argument('action_id')
    b.add_argument('--out')
    b.add_argument('--today')
    pl = sub.add_parser('place')
    pl.add_argument('idea_file')
    of = sub.add_parser('offer')
    of.add_argument('idea_file')
    r = sub.add_parser('report')
    r.add_argument('action_id')
    r.add_argument('--state', required=True, choices=['running', 'drafted', 'failed'])
    r.add_argument('--piece')
    r.add_argument('--error')
    r.add_argument('--run-url')
    args = p.parse_args(argv)
    try:
        return {'brief': cmd_brief, 'place': cmd_place, 'offer': cmd_offer, 'report': cmd_report}[args.cmd](args)
    except (RuntimeError, engine.NoKey, engine.Unreachable) as error:
        print(f'{args.cmd}: {error}')
        return 1


if __name__ == '__main__':
    sys.exit(main())
