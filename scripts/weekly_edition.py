#!/usr/bin/env python3
"""The weekly edition run's week and its guard (.github/workflows/weekly-edition.yml).

Krish, 2026-11-25 (growth-makeyourmindup docs/plans/2026-11-25-weekly-edition/DESIGN.md, section 4): the edition is
drafted on Friday afternoon New York, so it is on the Saturday card long before its 08:00 send. GitHub's schedule runs
hours late, so the run fires twice on Friday (17:17 and 23:47 UTC); this guard makes the second firing do nothing once
the first has put the week's edition draft on the board. Zero Claude routines (Ruling, Krish, 2026-10-29): GitHub
Actions is the scheduler and Claude Code runs inside the job on his subscription.

    python3 scripts/weekly_edition.py check [--today YYYY-MM-DD] [--week YYYY-MM-DD] [--event schedule] [--force]

prints, for $GITHUB_OUTPUT, `monday=<the week>`, `saturday=<its edition date>`, `go=true|false` and `folder=<the
edition's library folder>`, and says why on stderr. The week is the one whose Saturday comes next (on a Sunday, the week
that starts the next day), unless a week is typed. It goes unless the live board's view of that week (GET
/api/board/<Monday>/view, the view the Content tab draws) already shows the week's edition draft on Saturday (contract
1.35.0, `edition` with its sha256). `--force` drafts it again even when it is there: a new draft has a new sha256, so an
Approve for send he gave the old one no longer covers it and the card asks for his press again. It exits 1 when it
cannot read the board, so a run never goes or skips on a guess, and 2 on a typed week that is not a Monday.

It reads the board and writes nothing: the run writes records only (the edition's package, filed in the library), and
the live board shows them at its next read (AGENTS.md, "Commit and closeout").
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE / 'post-pack'))
sys.path.insert(0, str(HERE / 'edition'))

from sunday_ideas import monday_arg  # noqa: E402  the one check of a typed Monday
import edition as ed  # noqa: E402  config/weekly-edition.json, the edition's dates and library folder

NEW_YORK = ZoneInfo('America/New_York')
SHA = re.compile(r'^[0-9a-f]{64}$')


def edition_monday(today: dt.date) -> dt.date:
    """The Monday of the week whose Saturday comes next: this week's Monday on Monday to Saturday, tomorrow on Sunday."""
    if today.weekday() == 6:
        return today + dt.timedelta(days=1)
    return today - dt.timedelta(days=today.weekday())


def view_has_edition(view: dict, monday: dt.date) -> bool:
    """Whether a week's view shows the week's edition draft on its Saturday: an `edition` with a sha256, for the
    Saturday of that week."""
    saturday = ed.edition_date(monday).isoformat()
    for day in view.get('days') or []:
        if not isinstance(day, dict) or day.get('day') != ed.config()['board']['day']:
            continue
        e = day.get('edition')
        if isinstance(e, dict) and SHA.match(str(e.get('sha256') or '')) and e.get('edition_date') == saturday:
            return True
    return False


def live_has_edition(monday: dt.date) -> bool:
    """True once the live board shows the week's edition draft. It reads the view the Content tab draws, on the engine
    key (scripts/engine.py), and never prints it."""
    import engine
    status, text = engine.call('GET', f'/api/board/{monday.isoformat()}/view', token=engine.operator_key(), timeout=120)
    if status != 200:
        raise ValueError(f'the view answered {status}')
    return view_has_edition(json.loads(text), monday)


def decide(monday: dt.date, force: bool, live=live_has_edition) -> tuple[bool, str]:
    """Whether this firing goes, and why."""
    if force:
        return True, 'run with force: a new draft, which needs his Approve for send again'
    if live(monday):
        return False, 'the week\'s edition draft is already on the Saturday card'
    return True, 'no edition draft for the week on the board yet'


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest='command', required=True)
    check = sub.add_parser('check')
    check.add_argument('--today', help='YYYY-MM-DD; default: today in New York')
    check.add_argument('--week', help='a typed Monday, YYYY-MM-DD; default: the week whose Saturday comes next')
    check.add_argument('--event', default='workflow_dispatch', help="GitHub's event name (schedule, workflow_dispatch, repository_dispatch)")
    check.add_argument('--force', action='store_true')
    args = parser.parse_args(argv)
    today = dt.date.fromisoformat(args.today) if args.today else dt.datetime.now(NEW_YORK).date()
    try:
        monday = monday_arg(args.week) if args.week else edition_monday(today)
    except ValueError as error:
        print(f'weekly edition: {error}', file=sys.stderr)
        return 2
    try:
        go, why = decide(monday, args.force)
    except Exception as error:  # an unreadable board is never read as drafted or as empty
        print(f'weekly edition: could not read the week board for {monday}: {error}', file=sys.stderr)
        return 1
    saturday = ed.edition_date(monday)
    print(f'weekly edition, week of {monday} (edition {saturday}, {args.event}): {"go" if go else "nothing to do"} ({why})', file=sys.stderr)
    print(f'monday={monday.isoformat()}')
    print(f'saturday={saturday.isoformat()}')
    print(f'go={"true" if go else "false"}')
    print(f'folder={ed.folder_name(saturday)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
