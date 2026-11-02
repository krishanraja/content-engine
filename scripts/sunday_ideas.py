#!/usr/bin/env python3
"""The Sunday ideas run's week and its guard (.github/workflows/sunday-ideas.yml).

Ruling (Krish, 2026-10-29): "FYI, I want zero Claude routines. No Claude schedules of any kind in this
architecture", then "Could you not get Github to trigger Claude subscription to do something and then update the
content.krishraja.com board?". So GitHub Actions fires the Sunday ideas run on Saturday, and Claude Code runs inside
the job on his subscription. GitHub's cron fires hours late, so the workflow has more than one Saturday firing and
this guard makes every firing after the first one that built the Ideas tab do nothing.

    python3 scripts/sunday_ideas.py week [--today YYYY-MM-DD]   # the Monday the run plans
    python3 scripts/sunday_ideas.py week --date YYYY-MM-DD      # a typed Monday, checked and printed as YYYY-MM-DD
    python3 scripts/sunday_ideas.py built MONDAY                 # built=true once the Ideas tab is live
    python3 scripts/sunday_ideas.py goodnews [--today YYYY-MM-DD]  # gn_monday=<the week starting tomorrow> gn_due=true|false

The good news: the Saturday good news is a weekly series whose four stories are found fresh by this run for the
week that starts the next day (Krish, 2026-11-02: "You will need to find the actual good news on Sunday as per the
usual system so that the news items are fresh"). `goodnews` names that week and says due=true while its ideas.json
holds a weekly option whose stories_due has come (this run fires the Saturday before) and that has no stories yet.

The week: Krish records the whole week on the Sunday and it goes live eight days later (plan-week, "The Sunday
loop"), so the run on Saturday 31 October (or a run by hand on Sunday 1 November) plans the week of 9 November.
`built` reads the week's board through the engine API (GET only, the ENGINE_OPERATOR_TOKEN secret) and says built
once the published board's Ideas tab holds ideas, never its "ideas arrive by" placeholder. It prints one line,
`built=true` or `built=false`, for $GITHUB_OUTPUT, and exits 1 when it cannot tell, so a run never goes ahead or
skips on a guess.
"""
from __future__ import annotations

import argparse
import datetime as dt
import re
import sys
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / 'post-pack'))

NEW_YORK = ZoneInfo('America/New_York')
# week_board.ideas_panel writes this on the live Ideas tab; ideas_waiting_panel writes data-state="ideas-waiting".
IDEAS_LIVE = 'id="panel-ideas" role="tabpanel" aria-labelledby="tab-ideas" data-day="ideas" data-state="ideas" '


def target_monday(today: dt.date) -> dt.date:
    """The Monday eight days after the recording Sunday this run serves: tomorrow on a Saturday, today on a Sunday,
    otherwise the coming Sunday."""
    sunday = today + dt.timedelta(days=(6 - today.weekday()) % 7)
    return sunday + dt.timedelta(days=8)


ROOT = HERE.parent


def goodnews_monday(today: dt.date) -> dt.date:
    """The week whose Saturday good news this run fills: the one that starts the day after the recording Sunday."""
    return target_monday(today) - dt.timedelta(days=7)


def goodnews_due(monday: dt.date, today: dt.date, plans: Path | None = None) -> bool:
    """True while the week's ideas.json holds a weekly series option whose stories_due is today or tomorrow or past
    and that has no stories yet."""
    import json
    path = (plans or ROOT / 'docs' / 'plans') / f'{monday.isoformat()}-week' / 'ideas.json'
    if not path.exists():
        return False
    data = json.loads(path.read_text(encoding='utf-8'))
    for opts in (data.get('offdays') or {}).values():
        for o in opts if isinstance(opts, list) else []:
            if isinstance(o, dict) and o.get('weekly') and not o.get('stories'):
                try:
                    if dt.date.fromisoformat(str(o.get('stories_due'))) <= today + dt.timedelta(days=1):
                        return True
                except ValueError:
                    return True
    return False


def live_has_stories(monday: str) -> bool:
    """True once the week's live board shows the weekly good news with its four stories, so a second Saturday firing
    (the stories sit on the run's branch until the Sunday room merges it) does not look for them again."""
    import board_web
    key = board_web.os.environ.get('ENGINE_OPERATOR_TOKEN') or ''
    if not key:
        raise ValueError('ENGINE_OPERATOR_TOKEN is not set')
    base = board_web.os.environ.get('BOARD_BASE_URL', 'https://content.krishraja.com').rstrip('/')
    request = urllib.request.Request(base + f'/board/{monday}', headers={'Authorization': 'Bearer ' + key})
    with urllib.request.urlopen(request, timeout=120) as response:
        return 'data-stories="4"' in response.read().decode('utf-8', errors='replace')


def monday_arg(text: str) -> dt.date:
    """A typed Monday, exactly YYYY-MM-DD. fromisoformat alone also takes '20261109' and '2026-W46-1' on Python 3.11
    and later, and the typed text names a folder and a branch, so anything but the plain form is refused."""
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', text or ''):
        raise ValueError(f'{text!r} is not a date written YYYY-MM-DD')
    day = dt.date.fromisoformat(text)
    if day.weekday() != 0:
        raise ValueError(f'{text} is not a Monday')
    return day


def has_ideas(page: str) -> bool:
    return IDEAS_LIVE in page


def built(monday: str) -> bool:
    import board_web
    state = board_web.call('GET', f'/api/board/{monday}')
    if not state.get('manifest'):
        return False
    key = board_web.os.environ.get('ENGINE_OPERATOR_TOKEN') or ''
    if not key:
        raise ValueError('ENGINE_OPERATOR_TOKEN is not set')
    base = board_web.os.environ.get('BOARD_BASE_URL', 'https://content.krishraja.com').rstrip('/')
    request = urllib.request.Request(base + f'/board/{monday}', headers={'Authorization': 'Bearer ' + key})
    with urllib.request.urlopen(request, timeout=120) as response:
        return has_ideas(response.read().decode('utf-8', errors='replace'))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest='command', required=True)
    week = sub.add_parser('week')
    week.add_argument('--today', help='YYYY-MM-DD; default: today in New York')
    week.add_argument('--date', help='a typed Monday, YYYY-MM-DD: checked and printed in that form')
    done = sub.add_parser('built')
    done.add_argument('monday')
    news = sub.add_parser('goodnews')
    news.add_argument('--today', help='YYYY-MM-DD; default: today in New York')
    args = parser.parse_args()
    if args.command == 'goodnews':
        today = dt.date.fromisoformat(args.today) if args.today else dt.datetime.now(NEW_YORK).date()
        monday = goodnews_monday(today)
        due = goodnews_due(monday, today)
        if due:
            try:
                due = not live_has_stories(monday.isoformat())
            except Exception as error:  # an unreadable board is never read as filled or as empty
                print(f'sunday ideas: could not read the week board for {monday}: {error}', file=sys.stderr)
                return 1
        print(f'gn_monday={monday.isoformat()}')
        print(f'gn_due={"true" if due else "false"}')
        return 0
    try:
        if args.command == 'week' and args.date:
            print(monday_arg(args.date).isoformat())
            return 0
        if args.command == 'week':
            today = dt.date.fromisoformat(args.today) if args.today else dt.datetime.now(NEW_YORK).date()
            print(target_monday(today).isoformat())
            return 0
        monday = monday_arg(args.monday)
    except ValueError as error:
        print(f'sunday ideas: {error}', file=sys.stderr)
        return 2
    try:
        print(f'built={"true" if built(monday.isoformat()) else "false"}')
    except Exception as error:  # an unreadable board is never read as built or as not built
        print(f'sunday ideas: could not read the week board for {monday}: {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
