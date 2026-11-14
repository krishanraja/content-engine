#!/usr/bin/env python3
"""How long one piece's long cut may run (house rule TWO_CUTS).

Ruling (Krish, 2026-11-14): the long cut's word cap lifts for a piece when the
story is worth it; the narrative lock says so and why. Asked whether to keep
the cap at about 5:30 or lift it when a signed lock asks for about 8 minutes,
his answer: "lift if worth it".

A long cut is 675 to 825 spoken words, about 5 minutes at 150 a minute
(LONG_CUT in apps/control-plane/api/_houseRules.ts). config/long-cuts.json
lifts it for one piece at a time, never past LONG_CUT's lifted_most_words
(1,200 words, about 8 minutes, the most he asked for), and only when the entry
holds:

  - `words`: more than 825 and at most 1,200, the most the long cut may run;
  - `reason`: one line saying why the story is worth the extra minutes, which
    the piece's Scripts step shows on the board (making.py scripts records it
    as script_check.long_cut), so a cut is never lifted silently;
  - `lock`: the piece's narrative lock (docs/plans/<Monday>-week/
    narrative-lock-<day>.md), naming the piece and signed by Krish, unchanged
    since he signed it (making.py's own signature check);
  - `lock_says`: the lock's own words asking for the longer cut, found in it
    above his signature.

An entry that does not hold lifts nothing: story_check.py --piece refuses the
long cut with the reason, never applies it quietly. A session adds an entry
only after judging, from the signed lock and the research, that the story is
worth the minutes; the extra minutes go on explaining, never on more figures
or names than LISTENING allows. Nothing else lifts the cap.

    python3 scripts/post-pack/long_cut.py PIECE_ID   # what the piece's long cut may run to, or why its lift fails
    python3 scripts/post-pack/long_cut.py --check    # every entry in config/long-cuts.json holds
    python3 scripts/post-pack/long_cut.py --self-test
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
import story_check  # noqa: E402  house_block: LONG_CUT lives once, in the house rules

CONFIG = REPO / 'config' / 'long-cuts.json'
PIECE_ID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
LOCK_PATH = re.compile(r'^docs/plans/[^/]+/narrative-lock-[a-z]+\.md$')
REASON_MOST = 140  # the board's step note holds 200 characters; the lift's words come first
RULING = 'Ruling, Krish, 2026-11-14: "lift if worth it"'


def limits():
    """{fewest_words, most_words, lifted_most_words, words_per_minute}, from the house rules (LONG_CUT)."""
    block = story_check.house_block('LONG_CUT')
    for key in ('fewest_words', 'most_words', 'lifted_most_words', 'words_per_minute'):
        if not isinstance(block.get(key), int) or block[key] <= 0:
            raise ValueError(f'LONG_CUT has no whole number {key}')
    return block


def minutes(words, per_minute=None):
    """'M:SS' for that many words at the engine's pace."""
    secs = round(words / (per_minute or limits()['words_per_minute']) * 60)
    return f'{secs // 60}:{secs % 60:02d}'


def _read(path):
    try:
        data = json.loads(Path(path).read_text(encoding='utf-8'))
    except FileNotFoundError:
        return {'pieces': {}}
    except (OSError, ValueError):
        return None
    return data if isinstance(data, dict) else None


def _flat(text):
    return ' '.join(str(text).split())


def entry_problems(piece_id, entry, root=None):
    """Why one entry does not lift the piece's long cut, [] when it does."""
    import making  # its narrative lock rules: one piece id line, his signature bound to the words above it
    root = Path(root or REPO)
    cap = limits()
    out = []
    if not isinstance(entry, dict):
        return ['the entry is not an object of words, reason, lock and lock_says']
    words = entry.get('words')
    if not isinstance(words, int) or isinstance(words, bool) or not cap['most_words'] < words <= cap['lifted_most_words']:
        out.append(f'words must be a whole number above {cap["most_words"]} and at most {cap["lifted_most_words"]} '
                   f'(about {minutes(cap["lifted_most_words"])}, the most Krish asked for); it is {words!r}')
    reason = entry.get('reason')
    if not isinstance(reason, str) or not reason.strip() or '\n' in reason or len(reason.strip()) > REASON_MOST \
            or len(reason.split()) < 4 or '\u2014' in reason:
        out.append(f'reason must be one line of {REASON_MOST} characters at most, at least four words and no long dash, '
                   'saying why the story is worth the extra minutes (the board shows it)')
    lock = entry.get('lock')
    says = entry.get('lock_says')
    if not isinstance(lock, str) or not LOCK_PATH.match(lock):
        out.append('lock must be the piece\'s narrative lock, docs/plans/<Monday>-week/narrative-lock-<day>.md')
        return out
    path = root / lock
    try:
        text = path.read_text(encoding='utf-8')
    except (OSError, UnicodeDecodeError):
        return out + [f'{lock} cannot be read']
    if not making._names_piece(text, piece_id):
        out.append(f'{lock} does not name this piece (no "piece_id: {piece_id}" line)')
    signed = making.signature_problems(text)
    if signed:
        out.append(f'{lock} does not stand: ' + '; '.join(signed))
    lines = [line for line in text.splitlines() if line.strip()]
    body = _flat('\n'.join(lines[:-1] if lines and making.LOCK_SIGNED.match(lines[-1].strip()) else lines))
    if not isinstance(says, str) or len(says.split()) < 3:
        out.append('lock_says must be the lock\'s own words asking for the longer cut, three words or more')
    elif _flat(says) not in body:
        out.append(f'lock_says ("{_flat(says)[:80]}") is not in {lock} above his signature: quote the lock\'s own words '
                   'asking for the longer cut, never a paraphrase')
    return out


def lift_for(piece_id, path=None, root=None):
    """(lift, problems) for one piece. lift is {words, reason, minutes, lock} when config/long-cuts.json lifts its long
    cut and the entry holds, else None; problems say why an entry there does not hold ([] when there is none)."""
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
    why = entry_problems(key, pieces[key], root)
    if why:
        return None, [f'{config.name} lifts this piece\'s long cut, but the lift does not hold ({RULING}): ' + '; '.join(why)]
    entry = pieces[key]
    return {'words': entry['words'], 'reason': entry['reason'].strip(), 'minutes': minutes(entry['words']), 'lock': entry['lock']}, []


def declared(piece_id, path=None):
    """True when config/long-cuts.json has an entry for the piece, whether or not it holds."""
    data = _read(Path(path or CONFIG))
    pieces = data.get('pieces') if isinstance(data, dict) else None
    return isinstance(pieces, dict) and str(piece_id or '').strip().lower() in pieces


def notice(lift):
    """The line that says a long cut is lifted, for the check's output and the board's Scripts step."""
    return (f'long cut lifted to about {lift["minutes"]} ({lift["words"]} words) for this piece: {lift["reason"]}')


def check_all(path=None, root=None):
    """Every problem in config/long-cuts.json, [] when every entry holds."""
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
        out += [f'{key}: {p}' for p in entry_problems(key, pieces[key], root)]
    return out


# ---------------------------------------------------------------- self-test

def self_test():
    failures, count = [], 0

    def check(label, got, want):
        nonlocal count
        count += 1
        if got != want:
            failures.append(f'{label}: got {got!r}, want {want!r}')

    import making
    cap = limits()
    check('the house rules hold the long cut: 675 to 825 words, lifted to at most 1,200 at 150 a minute',
          (cap['fewest_words'], cap['most_words'], cap['lifted_most_words'], cap['words_per_minute']), (675, 825, 1200, 150))
    check('story_check.py holds the same ordinary long cut', story_check.CUTS['long'][:2], (cap['fewest_words'], cap['most_words']))
    check('1,200 words is about 8 minutes at the engine\'s pace', minutes(1200), '8:00')
    piece = '11111111-2222-4333-8444-555555555555'
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / 'docs' / 'plans' / '2030-01-07-week').mkdir(parents=True)
        lock = 'docs/plans/2030-01-07-week/narrative-lock-mon.md'
        body = (f'# Narrative lock\n\npiece_id: {piece}\nPublishes: 2030-01-07\n\n## Style recipe\n'
                '- Production: the long cut about 8 minutes this week instead of 5.\n')
        signed = body + f'\nSigned by Krish: "signed", 2030-01-05, lock sha256 {making.lock_body_hash(body)}\n'
        (root / lock).write_text(signed, encoding='utf-8')
        good = {'words': 1200, 'reason': 'Two stories in one piece, and he asked for the minutes.', 'lock': lock,
                'lock_says': 'the long cut about 8 minutes this week instead of 5'}

        def lift(entry, pid=piece):
            config = root / 'long-cuts.json'
            config.write_text(json.dumps({'pieces': {piece: entry}}), encoding='utf-8')
            return lift_for(pid, config, root)

        got, why = lift(good)
        check('a lift the signed lock asks for holds, with its words, reason and minutes', (got, why),
              ({'words': 1200, 'reason': good['reason'], 'minutes': '8:00', 'lock': lock}, []))
        check('a piece with no entry is not lifted and nothing is wrong', lift(good, '99999999-2222-4333-8444-555555555555'), (None, []))
        for label, change, says in [
            ('past 1,200 words (about 8 minutes) is refused', {'words': 1500}, 'at most 1200'),
            ('825 words or fewer is no lift', {'words': 825}, 'above 825'),
            ('a reason is required', {'reason': ''}, 'reason must be one line'),
            ('a reason on two lines is refused', {'reason': 'one line\nthen another line here'}, 'reason must be one line'),
            ('words the lock does not hold are refused', {'lock_says': 'about 12 minutes this week'}, 'is not in'),
            ('a lock outside docs/plans is refused', {'lock': 'notes/lock.md'}, 'narrative lock'),
        ]:
            got, why = lift({**good, **change})
            check(label, (got, any(says in w for w in why), any('2026-11-14' in w for w in why)), (None, True, True))
        (root / lock).write_text(signed.replace('instead of 5', 'instead of 5, and more'), encoding='utf-8')
        got, why = lift(good)
        check('a lock edited after he signed it lifts nothing', (got, any('does not stand' in w for w in why)), (None, True))
        (root / lock).write_text(body.replace(piece, '99999999-2222-4333-8444-555555555555')
                                 + '\nSigned by Krish: "signed", 2030-01-05\n', encoding='utf-8')
        got, why = lift(good)
        check('a lock naming another piece, unsigned to its words, lifts nothing',
              (got, any('does not name this piece' in w for w in why), any('does not stand' in w for w in why)), (None, True, True))
        (root / lock).write_text(signed, encoding='utf-8')
        config = root / 'long-cuts.json'
        config.write_text(json.dumps({'pieces': {piece: good, 'Not-An-Id': good}}), encoding='utf-8')
        check('the check names an entry keyed by anything but a lowercase piece id', check_all(config, root),
              ['Not-An-Id: a piece is named by its lowercase id'])
        config.write_text('not json', encoding='utf-8')
        check('an unreadable config lifts nothing and says so', (lift_for(piece, config, root)[0], bool(lift_for(piece, config, root)[1])), (None, True))
        check('the notice names the length and the reason', notice({'words': 1200, 'minutes': '8:00', 'reason': 'Why.'}),
              'long cut lifted to about 8:00 (1200 words) for this piece: Why.')
    check('the real config/long-cuts.json holds', check_all(), [])
    if failures:
        print('long cut self-test FAILED:')
        for f in failures:
            print(f'  - {f}')
        return 1
    print(f'long cut self-test passed: {count} checks')
    return 0


def main(argv):
    if argv[1:2] == ['--self-test']:
        return self_test()
    if argv[1:2] == ['--check']:
        problems = check_all()
        for p in problems:
            print(f'FAIL  {p}')
        print('long cuts: every lift holds' if not problems else f'long cuts: {len(problems)} problem(s)')
        return 1 if problems else 0
    if len(argv) != 2:
        print(__doc__.strip())
        return 2
    lift, why = lift_for(argv[1])
    if why:
        print('\n'.join(why))
        return 1
    cap = limits()
    print(notice(lift) if lift else f'the long cut runs {cap["fewest_words"]} to {cap["most_words"]} words '
          f'(about {minutes(cap["most_words"])} at most): config/long-cuts.json lifts nothing for this piece')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
