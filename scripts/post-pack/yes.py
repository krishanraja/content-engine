#!/usr/bin/env python3
"""yes: Krish's yes to a day, from wherever he gave it (one yes anywhere).

Ruling, Krish, 2026-11-02: "yes, start with one yes anywhere"; "the reason I dont press approve is cos this board is crap
and outdated all the time, and yet you refuse to do work until i press approve".

His yes to a day is one record on the week's board (picks), read by the board, the piece manifest (piece_manifest.py
seal) and Growth's scheduler (GET /api/board/<Monday>/pieces, `yes`):

    picks/yes-<day>-board   his Yes or Undo pressed on the board, his login only;
    picks/yes-<day>-words   his exact typed words from a session, carried here with when and where he typed them and
                            the session link, so it can never pass for a press he did not make;
    picks/<day>-publish     his Approve for publish press, also a yes for that day.

The latest by `at` is his answer for the day, so his Undo on the board beats an earlier chat yes. A session writes only a
yes in his words (never a board press, never an undo), and only words he typed to it in that session:

    python3 yes.py record WEEK DAY [DAY ...] --words "his exact words" --said-at ISO --where "..." --session URL
    python3 yes.py show WEEK            his answer for each day, as Growth reads it
    python3 yes.py --self-test
"""
import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

DAYS = ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')
YES_ID = re.compile(r'^yes-(mon|tue|wed|thu|fri|sat|sun)-(board|words)$')
PUBLISH = re.compile(r'^(mon|wed|fri)-publish$')


class YesError(Exception):
    pass


def words_body(day, words, said_at, where, session, at=None):
    """The picks/yes-<day>-words body: his words verbatim, when and where he typed them, the session link."""
    if day not in DAYS:
        raise YesError(f'{day}: a day is one of {", ".join(DAYS)}')
    if not isinstance(words, str) or not words.strip() or len(words) > 2000:
        raise YesError('--words: his exact typed words, 1 to 2000 characters')
    try:
        datetime.fromisoformat(said_at.replace('Z', '+00:00'))
    except (AttributeError, ValueError):
        raise YesError('--said-at: when he typed them, an ISO time')
    if not where or len(where) > 300 or re.search(r'[\x00-\x1f]', where):
        raise YesError('--where: where he typed them, one line')
    if not re.fullmatch(r'https://\S{1,290}', session or ''):
        raise YesError('--session: the https link of the session he typed them in')
    return {'kind': 'yes', 'day': day, 'via': 'words', 'approved': True,
            'at': at or datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z'),
            'words': words, 'said_at': said_at, 'said_where': where, 'session_ref': session}


def by_day(documents):
    """His answer for each day from the board's picks documents ({id, body, updated_by}), as _yes.ts reads them."""
    out = {}
    for d in documents or []:
        b = d.get('body') if isinstance(d.get('body'), dict) else None
        if not b or not isinstance(b.get('at'), str):
            continue
        entry = None
        m = YES_ID.match(str(d.get('id') or ''))
        if m and b.get('kind') == 'yes' and b.get('day') == m.group(1) and b.get('via') == m.group(2):
            if m.group(2) == 'board' and d.get('updated_by') != 'Krish':
                continue
            if m.group(2) == 'words' and not (b.get('approved') is True and str(b.get('words') or '').strip()):
                continue
            entry = {'day': m.group(1), 'approved': b.get('approved') is True, 'at': b['at'], 'via': m.group(2),
                     'words': b.get('words'), 'said_where': b.get('said_where'), 'session_ref': b.get('session_ref')}
        p = PUBLISH.match(str(d.get('id') or ''))
        if p and b.get('kind') == 'approve_publish' and d.get('updated_by') == 'Krish':
            entry = {'day': p.group(1), 'approved': b.get('approved') is True, 'at': b['at'], 'via': 'publish_press',
                     'words': None, 'said_where': None, 'session_ref': None}
        if entry and (entry['day'] not in out or _t(entry['at']) > _t(out[entry['day']]['at'])):
            out[entry['day']] = entry
    return out


def _t(at):
    return datetime.fromisoformat(at.replace('Z', '+00:00'))


def record(week, days, words, said_at, where, session, call=None):
    import board_web
    call = call or board_web.call
    picks = (call('GET', f'/api/board/{week}/picks') or {}).get('documents') or []
    revisions = {d.get('id'): d.get('revision', 0) for d in picks}
    out = []
    for day in days:
        doc = f'yes-{day}-words'
        body = words_body(day, words, said_at, where, session)
        result = call('PUT', f'/api/board/{week}/picks/{doc}', {'body': body, 'revision': revisions.get(doc, 0)})
        if not (isinstance(result, dict) and result.get('ok') is not False):
            raise YesError(f'{doc}: the board did not keep it ({result})')
        out.append(doc)
    return out


def self_test():
    problems = []
    check = lambda name, ok: problems.append(name) if not ok else None
    b = words_body('wed', 'can you just approve Weds, Fri and Sat for me here', '2026-11-02T21:25:00Z', 'Claude Code session', 'https://claude.ai/code/s')
    check('a words yes carries his words, when, where and the session', b['words'].startswith('can you') and b['via'] == 'words' and b['approved'] is True)
    for args, want in ((('xyz', 'w', '2026-11-02T00:00:00Z', 'x', 'https://a'), 'a day'), (('wed', '', '2026-11-02T00:00:00Z', 'x', 'https://a'), '--words'),
                       (('wed', 'w', 'today', 'x', 'https://a'), '--said-at'), (('wed', 'w', '2026-11-02T00:00:00Z', 'x', 'http://a'), '--session')):
        try:
            words_body(*args)
            check(f'refused: {want}', False)
        except YesError as e:
            check(f'refused: {want}', want in str(e))
    docs = [{'id': 'yes-wed-words', 'body': {**b, 'at': '2026-11-02T21:30:00Z'}, 'updated_by': 'engine_operator'},
            {'id': 'yes-wed-board', 'body': {'kind': 'yes', 'day': 'wed', 'via': 'board', 'approved': False, 'at': '2026-11-02T23:00:00Z'}, 'updated_by': 'Krish'},
            {'id': 'fri-publish', 'body': {'kind': 'approve_publish', 'day': 'fri', 'approved': True, 'at': '2026-10-31T18:17:06Z'}, 'updated_by': 'Krish'},
            {'id': 'yes-sat-board', 'body': {'kind': 'yes', 'day': 'sat', 'via': 'board', 'approved': True, 'at': '2026-11-02T23:00:00Z'}, 'updated_by': 'engine_operator'}]
    y = by_day(docs)
    check('his later Undo beats an earlier chat yes', y['wed']['approved'] is False and y['wed']['via'] == 'board')
    check('his Approve for publish is a yes', y['fri']['via'] == 'publish_press' and y['fri']['approved'] is True)
    check('a board yes not from his login counts for nothing', 'sat' not in y)
    sent = []
    fake = lambda method, path, body=None: ({'documents': [{'id': 'yes-fri-words', 'revision': 2}]} if method == 'GET' else (sent.append((path, body)) or {'ok': True}))
    record('2026-11-02', ['wed', 'fri'], 'yes', '2026-11-02T21:25:00Z', 'session', 'https://a', call=fake)
    check('record writes one words yes per day at the current revision',
          [p for p, _ in sent] == ['/api/board/2026-11-02/picks/yes-wed-words', '/api/board/2026-11-02/picks/yes-fri-words']
          and [b['revision'] for _, b in sent] == [0, 2])
    if problems:
        print('yes self-test FAILED:\n  ' + '\n  '.join(problems))
        return 1
    print('yes self-test passed: 9 checks')
    return 0


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    p.add_argument('--self-test', action='store_true')
    sub = p.add_subparsers(dest='command')
    r = sub.add_parser('record')
    r.add_argument('week')
    r.add_argument('days', nargs='+', choices=DAYS)
    r.add_argument('--words', required=True)
    r.add_argument('--said-at', required=True)
    r.add_argument('--where', required=True)
    r.add_argument('--session', required=True)
    s = sub.add_parser('show')
    s.add_argument('week')
    a = p.parse_args(argv)
    if a.self_test:
        return self_test()
    try:
        if a.command == 'record':
            print(json.dumps({'recorded': record(a.week, a.days, a.words, a.said_at, a.where, a.session)}))
        elif a.command == 'show':
            import board_web
            print(json.dumps(by_day((board_web.call('GET', f'/api/board/{a.week}/picks') or {}).get('documents')), indent=2, ensure_ascii=False))
        else:
            p.print_help()
            return 2
    except YesError as e:
        print(f'yes: {e}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
