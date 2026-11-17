#!/usr/bin/env python3
"""How long one piece's short cut may run, and the line it ends on (house rule TWO_CUTS).

Since 16 Nov 2026 a short cut is SHORT_CUT's 45 to 75 spoken words and ends on exactly the house close
(SCRIPT_CLOSE_LINE). Ruling (Krish, 2026-11-17), typed in a Claude Code session about the Wednesday 18 Nov piece:
"The 90-second script needs to be hilarious and relatable to all, and make the viewer want to see the full 5-minute
video, which is something we've not done before." config/short-cuts.json lifts the short cut for one piece at a time,
modelled on config/long-cuts.json (long_cut.py), but keyed on Krish's own typed words rather than a narrative-lock line.
An entry holds when:

  - `words`: more than SHORT_CUT's most_words and at most SHORT_LIFT_MOST (300, about two minutes), the most the
    short cut may run (its floor stays SHORT_CUT's fewest_words);
  - `close`: the one sentence the cut must end on instead of the house close, ending in a full stop, never the
    retired deep-dive line;
  - `reason`: one line saying why, which the Scripts step shows on the board (making.py scripts records
    script_check.short_cut), so a cut is never lifted silently;
  - `krish`: his own typed words asking for it, non-empty (six words or more); `said_at`: the day he typed them.

An entry that does not hold lifts nothing: story_check.py --piece refuses the short cut with the reason.

    python3 scripts/post-pack/short_cut.py PIECE_ID   # what the piece's short cut may run to, or why its lift fails
    python3 scripts/post-pack/short_cut.py --check    # every entry in config/short-cuts.json holds
    python3 scripts/post-pack/short_cut.py --self-test
"""
import json
import re
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
import story_check  # noqa: E402  house_block: SHORT_CUT lives once, in the house rules

CONFIG = REPO / 'config' / 'short-cuts.json'
PIECE_ID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
DATE = re.compile(r'^\d{4}-\d{2}-\d{2}$')
SHORT_LIFT_MOST = 300  # about two minutes at 150 a minute; apps/control-plane/api/_making.ts holds the same number
REASON_MOST = 140
CLOSE_MOST = 120
RULING = 'Ruling, Krish, 2026-11-17: the 90-second script that sends viewers to the 5-minute video'


def minutes(words):
    secs = round(words / story_check.WORDS_PER_MINUTE * 60)
    return f'{secs // 60}:{secs % 60:02d}'


def _read(path):
    try:
        data = json.loads(Path(path).read_text(encoding='utf-8'))
    except FileNotFoundError:
        return {'pieces': {}}
    except (OSError, ValueError):
        return None
    return data if isinstance(data, dict) else None


def entry_problems(piece_id, entry):
    """Why one entry does not lift the piece's short cut, [] when it does."""
    if not isinstance(entry, dict):
        return ['the entry is not an object of words, close, reason, krish and said_at']
    out = []
    most = story_check.CUTS['short'][1]
    words = entry.get('words')
    if not isinstance(words, int) or isinstance(words, bool) or not most < words <= SHORT_LIFT_MOST:
        out.append(f'words must be a whole number above {most} and at most {SHORT_LIFT_MOST} '
                   f'(about {minutes(SHORT_LIFT_MOST)}); it is {words!r}')
    close = entry.get('close')
    if not isinstance(close, str) or not close.strip() or '\n' in close or len(close.strip()) > CLOSE_MOST \
            or not close.strip().endswith('.') or '—' in close or story_check.BANNED_LAST.search(close) \
            or len(close.split()) < 3:
        out.append(f'close must be one sentence of {CLOSE_MOST} characters at most, three words or more, ending in a full stop, '
                   'with no long dash and none of the words the voice check bans')
    elif close.strip().count('. ') or len(story_check.sentences([close.strip()])) != 1:
        out.append('close must be one sentence')
    reason = entry.get('reason')
    if not isinstance(reason, str) or not reason.strip() or '\n' in reason or len(reason.strip()) > REASON_MOST \
            or len(reason.split()) < 4 or '—' in reason:
        out.append(f'reason must be one line of {REASON_MOST} characters at most, at least four words and no long dash, '
                   'saying why the short cut is lifted (the board shows it)')
    krish = entry.get('krish')
    if not isinstance(krish, str) or len(krish.split()) < 6:
        out.append('krish must be his own typed words asking for it, copied exactly, six words or more')
    said = entry.get('said_at')
    if not isinstance(said, str) or not DATE.match(said):
        out.append('said_at must be the day he typed them, YYYY-MM-DD')
    return out


def lift_for(piece_id, path=None):
    """(lift, problems) for one piece. lift is {words, close, reason, minutes, krish, said_at} when config/short-cuts.json
    lifts its short cut and the entry holds, else None; problems say why an entry there does not hold."""
    config = Path(path or CONFIG)
    data = _read(config)
    if data is None:
        return None, [f'{config.name} cannot be read as a JSON object, so no lift can be checked']
    pieces = data.get('pieces')
    if not isinstance(pieces, dict):
        return None, [f'{config.name} has no "pieces" object']
    key = str(piece_id or '').strip().lower()
    if key not in pieces:
        return None, []
    why = entry_problems(key, pieces[key])
    if why:
        return None, [f'{config.name} lifts this piece\'s short cut, but the lift does not hold ({RULING}): ' + '; '.join(why)]
    e = pieces[key]
    return {'words': e['words'], 'close': e['close'].strip(), 'reason': e['reason'].strip(), 'minutes': minutes(e['words']),
            'krish': ' '.join(e['krish'].split()), 'said_at': e['said_at']}, []


def declared(piece_id, path=None):
    """True when config/short-cuts.json has an entry for the piece, whether or not it holds."""
    data = _read(Path(path or CONFIG))
    pieces = data.get('pieces') if isinstance(data, dict) else None
    return isinstance(pieces, dict) and str(piece_id or '').strip().lower() in pieces


def notice(lift):
    """The line that says a short cut is lifted, for the check's output and the board's Scripts step."""
    return (f'short cut lifted to about {lift["minutes"]} ({lift["words"]} words), ending on "{lift["close"]}", for this piece: '
            f'{lift["reason"]}')


def check_all(path=None):
    """Every problem in config/short-cuts.json, [] when every entry holds."""
    config = Path(path or CONFIG)
    data = _read(config)
    if data is None:
        return [f'{config.name} cannot be read as a JSON object']
    pieces = data.get('pieces')
    if not isinstance(pieces, dict):
        return [f'{config.name} has no "pieces" object']
    out = []
    for key in sorted(pieces):
        if not PIECE_ID.match(key):
            out.append(f'{key}: a piece is named by its lowercase id')
            continue
        out += [f'{key}: {p}' for p in entry_problems(key, pieces[key])]
    return out


# ---------------------------------------------------------------- self-test

WED = 'db9f9f6a-1092-49be-8024-f335e060305a'
KRISH_WORDS = ("The 90-second script needs to be hilarious and relatable to all, and make the viewer want to see the full "
               "5-minute video, which is something we've not done before.")


def self_test():
    failures, count = [], 0

    def check(label, got, want):
        nonlocal count
        count += 1
        if got != want:
            failures.append(f'{label}: got {got!r}, want {want!r}')

    good = {'words': 260, 'close': 'The full five-minute video is on my channel.', 'reason': 'A 90-second cut that sends viewers on.',
            'krish': KRISH_WORDS, 'said_at': '2026-11-17'}
    with tempfile.TemporaryDirectory() as tmp:
        config = Path(tmp) / 'short-cuts.json'

        def lift(entry, pid=WED):
            config.write_text(json.dumps({'pieces': {WED: entry}}), encoding='utf-8')
            return lift_for(pid, config)

        got, why = lift(good)
        check('a lift in his typed words holds, with its words, close and minutes', (got and (got['words'], got['close'], got['minutes'], got['krish']), why),
              ((260, good['close'], '1:44', KRISH_WORDS), []))
        check('a piece with no entry is not lifted and nothing is wrong', lift(good, '99999999-2222-4333-8444-555555555555'), (None, []))
        for label, change, says in [
            ('75 words or fewer is no lift', {'words': 75}, 'above 75'),
            ('past the most is refused', {'words': 400}, 'at most 300'),
            ('a close with no full stop is refused', {'close': 'The full video is on my channel'}, 'close must be one sentence'),
            ('a close of two sentences is refused', {'close': 'Watch it now. The full video is on my channel.'}, 'close must be one sentence'),
            ('the retired deep-dive close is refused', {'close': 'The full deep dive is at makeyourmindup.ai.'}, 'close must be'),
            ('a reason is required', {'reason': ''}, 'reason must be one line'),
            ('his words are required', {'krish': ''}, 'krish must be his own typed words'),
            ('a date is required', {'said_at': 'yesterday'}, 'said_at'),
        ]:
            got, why = lift({**good, **change})
            check(label, (got, any(says in w for w in why), any('2026-11-17' in w for w in why)), (None, True, True))
        config.write_text('not json', encoding='utf-8')
        check('an unreadable config lifts nothing and says so', (lift_for(WED, config)[0], bool(lift_for(WED, config)[1])), (None, True))
        config.write_text(json.dumps({'pieces': {WED: good, 'Not-An-Id': good}}), encoding='utf-8')
        check('the check names an entry keyed by anything but a lowercase piece id', check_all(config),
              ['Not-An-Id: a piece is named by its lowercase id'])
    check('the notice names the length, the close and the reason',
          notice({'words': 260, 'minutes': '1:44', 'close': 'Close.', 'reason': 'Why.'}),
          'short cut lifted to about 1:44 (260 words), ending on "Close.", for this piece: Why.')
    real = json.loads(CONFIG.read_text(encoding='utf-8'))['pieces'].get(WED, {})
    check('the real entry for the Wednesday 18 piece holds his exact typed words, verbatim', real.get('krish'), KRISH_WORDS)
    check('the real config/short-cuts.json holds', check_all(), [])
    if failures:
        print('short cut self-test FAILED:')
        for f in failures:
            print(f'  - {f}')
        return 1
    print(f'short cut self-test passed: {count} checks')
    return 0


def main(argv):
    if argv[1:2] == ['--self-test']:
        return self_test()
    if argv[1:2] == ['--check']:
        problems = check_all()
        for p in problems:
            print(f'FAIL  {p}')
        print('short cuts: every lift holds' if not problems else f'short cuts: {len(problems)} problem(s)')
        return 1 if problems else 0
    if len(argv) != 2:
        print(__doc__.strip())
        return 2
    lift, why = lift_for(argv[1])
    if why:
        print('\n'.join(why))
        return 1
    low, high = story_check.CUTS['short'][:2]
    print(notice(lift) if lift else f'the short cut runs {low} to {high} words: config/short-cuts.json lifts nothing for this piece')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
