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

The Saturday good news is no longer found here: the Thursday run finds it (scripts/saturday_goodnews.py,
.github/workflows/saturday-goodnews.yml; Krish, 2026-11-07: "Saturday's good news run should be done later in the
week so the good news is fresh"). This run leaves that option with its stories due on the Thursday.

The week: Krish records the whole week on the Sunday and it goes live eight days later (plan-week, "The Sunday
loop"), so the run on Saturday 31 October (or a run by hand on Sunday 1 November) plans the week of 9 November.
`built` reads the week the live board draws (Ruling, Krish, 2026-11-11: one live board, in Control Centre; the old
board is a read-only archive): GET /api/board/<Monday>/view through the engine API (GET only, the
ENGINE_OPERATOR_TOKEN secret), and says built once each publishing day there carries its options. The view reads the
week's ideas.json from offday-revise/<Monday> before main, which is where the workflow puts the run's ideas
(scripts/week_branch_keep.sh). Since 10 November /board/<Monday> serves the desk, so the old check of the baked
Ideas tab could no longer see any ideas. It prints one line, `built=true` or `built=false`, for $GITHUB_OUTPUT, and
exits 1 when it cannot tell, so a run never goes ahead or skips on a guess.
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


def view_has_ideas(view: dict) -> bool:
    """Whether the week's view (contract 1.1.0) carries options on each publishing day, Monday, Wednesday and Friday."""
    days = {d.get('day'): d for d in view.get('days') or [] if isinstance(d, dict)}
    return all(isinstance(days.get(k), dict) and len(days[k].get('options') or []) > 0 for k in ('mon', 'wed', 'fri'))


def built(monday: str) -> bool:
    import json
    import os
    key = os.environ.get('ENGINE_OPERATOR_TOKEN') or ''
    if not key:
        raise ValueError('ENGINE_OPERATOR_TOKEN is not set')
    base = os.environ.get('BOARD_BASE_URL', 'https://content.krishraja.com').rstrip('/')
    request = urllib.request.Request(base + f'/api/board/{monday}/view', headers={'Authorization': 'Bearer ' + key, 'Cache-Control': 'no-cache'})
    with urllib.request.urlopen(request, timeout=120) as response:
        return view_has_ideas(json.loads(response.read().decode('utf-8')))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest='command', required=True)
    week = sub.add_parser('week')
    week.add_argument('--today', help='YYYY-MM-DD; default: today in New York')
    week.add_argument('--date', help='a typed Monday, YYYY-MM-DD: checked and printed in that form')
    done = sub.add_parser('built')
    done.add_argument('monday')
    args = parser.parse_args()
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
