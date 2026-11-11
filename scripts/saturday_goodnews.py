#!/usr/bin/env python3
"""The Thursday good-news run's week and its guard (.github/workflows/saturday-goodnews.yml).

Rulings (Krish, 2026-11-07): "Saturday's good news run should be done later in the week so the good news is fresh",
and "Happy to break the "no Claude schedules" rule for Saturday's good news. We might as well just keep that on an
automatic schedule." So GitHub Actions fires Claude Code on his subscription every Thursday to find that week's
Saturday good news, the one exception to zero Claude schedules beside the Sunday ideas run. It fires twice, because
GitHub's cron fires hours late, and this guard makes every firing after the one that put the stories live do nothing.

    python3 scripts/saturday_goodnews.py check [--today YYYY-MM-DD] [--week YYYY-MM-DD] [--event schedule] [--force]

prints, for $GITHUB_OUTPUT, `monday=<the week>`, `go=true|false` and `due=<the week's Thursday>`, and says why on
stderr. The week is the one whose Saturday comes next (on a Thursday, the Monday three days before). It goes while
that week's ideas.json holds the weekly good-news option, the week's Thursday has come (tomorrow counts), the option
does not hold this week's stories (five, found for a due date on or after that Thursday: stories found earlier, as
the 7 November run found the 9 November week's on Saturday, are last week's news) and the live board does not show
this week's stories yet. A scheduled firing before FIRST_RUN does nothing. `--force` (a run by hand) goes whenever
the option exists, stories or not. It exits 1 when it cannot read the board, so a run never goes or skips on a guess,
and 2 on a typed week that is not a Monday.

The live board is Control Centre's (Ruling, Krish, 2026-11-11: one live board, in Control Centre; the old board is a
read-only archive): it reads the week's view, GET /api/board/<Monday>/view, which reads ideas.json from the week's
branch (offday-revise/<Monday>) before main. So the run keeps its stories on that branch, bumps the week's change
signal, and this guard asks the view, never the archive page, whether they are there.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE / 'post-pack'))

from sunday_ideas import monday_arg  # noqa: E402  the one check of a typed Monday

NEW_YORK = ZoneInfo('America/New_York')
# The first scheduled Thursday: 12 November, for Saturday 14 November (Krish, 2026-11-09: "Yes, go ahead with the
# restore and the Thursday run").
FIRST_RUN = dt.date(2026, 11, 12)
# The weekly good news holds five stories (week_board.STORY_COUNT, plan-week references/offdays.md).
STORY_COUNT = 5


def goodnews_monday(today: dt.date) -> dt.date:
    """The Monday of the week whose Saturday comes next: this week's Monday on Monday to Saturday, tomorrow on Sunday."""
    if today.weekday() == 6:
        return today + dt.timedelta(days=1)
    return today - dt.timedelta(days=today.weekday())


def weekly_option(monday: dt.date, plans: Path | None = None) -> dict | None:
    """The week's weekly good-news option from its ideas.json, or None."""
    path = (plans or ROOT / 'docs' / 'plans') / f'{monday.isoformat()}-week' / 'ideas.json'
    if not path.exists():
        return None
    data = json.loads(path.read_text(encoding='utf-8'))
    for opts in (data.get('offdays') or {}).values():
        for o in opts if isinstance(opts, list) else []:
            if isinstance(o, dict) and o.get('weekly'):
                return o
    return None


def thursday_of(monday: dt.date) -> dt.date:
    """The week's Thursday: the good news is found from then on (Krish, 2026-11-07)."""
    return monday + dt.timedelta(days=3)


def stories_fresh(monday: dt.date, o: dict) -> bool:
    """Whether the option holds this week's stories: five or more, found for a due date on or after the week's
    Thursday (the view's storiesFresh, apps/control-plane/api/board/_viewExtras.ts, says the same)."""
    stories = [s for s in o.get('stories') or [] if isinstance(s, dict)]
    try:
        due = dt.date.fromisoformat(str(o.get('stories_due')))
    except ValueError:
        return False
    return len(stories) >= STORY_COUNT and due >= thursday_of(monday)


def goodnews_due(monday: dt.date, today: dt.date, plans: Path | None = None) -> bool:
    """True while the week's weekly option does not hold this week's stories and the week's Thursday is today,
    tomorrow or past. An option with no readable stories_due is due once Thursday has come, so the run finds it and
    the cover check names the fault."""
    o = weekly_option(monday, plans)
    if not o or stories_fresh(monday, o):
        return False
    return thursday_of(monday) <= today + dt.timedelta(days=1)


def view_has_stories(view: dict, monday: str) -> bool:
    """Whether a week's view (GET /api/board/<Monday>/view, contract 1.2.0) shows a weekly good-news option holding
    this week's stories, on any day."""
    week = dt.date.fromisoformat(monday)
    for day in view.get('days') or []:
        for o in (day or {}).get('options') or []:
            if not isinstance(o, dict) or 'stories' not in o:
                continue
            if o.get('stories_fresh') is True:
                return True
            if 'stories_fresh' not in o and stories_fresh(week, {'stories': o.get('stories'), 'stories_due': o.get('stories_due')}):
                return True
    return False


def live_has_stories(monday: str) -> bool:
    """True once the live board shows this week's good news with all its stories, so the retry firing does not look for
    them again. It reads the view the live board draws (GET /api/board/<Monday>/view), never the archive page."""
    key = os.environ.get('ENGINE_OPERATOR_TOKEN') or ''
    if not key:
        raise ValueError('ENGINE_OPERATOR_TOKEN is not set')
    base = os.environ.get('BOARD_BASE_URL', 'https://content.krishraja.com').rstrip('/')
    request = urllib.request.Request(base + f'/api/board/{monday}/view', headers={'Authorization': 'Bearer ' + key, 'Cache-Control': 'no-cache'})
    with urllib.request.urlopen(request, timeout=120) as response:
        return view_has_stories(json.loads(response.read().decode('utf-8')), monday)


def decide(monday: dt.date, today: dt.date, event: str, force: bool, plans: Path | None = None,
           live=live_has_stories) -> tuple[bool, str]:
    """Whether this firing goes, and why."""
    if event == 'schedule' and today < FIRST_RUN:
        return False, f'scheduled firings start on {FIRST_RUN.isoformat()}'
    if weekly_option(monday, plans) is None:
        return False, f'docs/plans/{monday.isoformat()}-week/ideas.json on main holds no weekly good-news option'
    if force:
        return True, 'run by hand with force'
    if not goodnews_due(monday, today, plans):
        return False, 'this week\'s stories are already in ideas.json, or not due yet'
    if live(monday.isoformat()):
        return False, 'the live board already shows this week\'s stories'
    return True, 'due, and not on the live board'


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest='command', required=True)
    check = sub.add_parser('check')
    check.add_argument('--today', help='YYYY-MM-DD; default: today in New York')
    check.add_argument('--week', help='a typed Monday, YYYY-MM-DD; default: the week whose Saturday comes next')
    check.add_argument('--event', default='workflow_dispatch', help="GitHub's event name; 'schedule' applies FIRST_RUN")
    check.add_argument('--force', action='store_true')
    args = parser.parse_args()
    today = dt.date.fromisoformat(args.today) if args.today else dt.datetime.now(NEW_YORK).date()
    try:
        monday = monday_arg(args.week) if args.week else goodnews_monday(today)
    except ValueError as error:
        print(f'saturday good news: {error}', file=sys.stderr)
        return 2
    try:
        go, why = decide(monday, today, args.event, args.force)
    except Exception as error:  # an unreadable board is never read as filled or as empty
        print(f'saturday good news: could not read the week board for {monday}: {error}', file=sys.stderr)
        return 1
    print(f'saturday good news, week of {monday}: {"go" if go else "nothing to do"} ({why})', file=sys.stderr)
    print(f'monday={monday.isoformat()}')
    print(f'go={"true" if go else "false"}')
    print(f'due={thursday_of(monday).isoformat()}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
