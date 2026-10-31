#!/usr/bin/env python3
"""recording_match: says which of Krish's new recordings is which piece's long
or short cut, from the words he says at the start, and records it on the
piece when asked.

Krish, 2026-10-12: "I will need to have dropped a video in the exact
location, it will need to know which one it is (ideally automatiically
without me having to give the exact filename)".

    python scripts/post-pack/recording_match.py                   each new recording, and the piece and cut it is
    python scripts/post-pack/recording_match.py --record --by Codex
                                                                  ... and record each sure match on its piece
    python scripts/post-pack/recording_match.py --record --board --by "Recordings lane" --json
                                                                  ... and ask Krish about each unsure take on the
                                                                  board, once (what the runners run each pass)
    python scripts/post-pack/recording_match.py --record --board --clock --spoken --by "Place takes" --json
                                                                  ... and build each placed take's word clock
                                                                  first (what .github/workflows/place-takes.yml
                                                                  runs, on GitHub's machine)
    python scripts/post-pack/recording_match.py --inbox           read the Inbox on this machine (H:) instead of
                                                                  the engine's copies; --inbox PATH names it
    python scripts/post-pack/recording_match.py --week 2026-10-12 start from that week (default: this one)
    python scripts/post-pack/recording_match.py --json            the whole answer as JSON
    python scripts/post-pack/recording_match.py --check-transcriber
                                                                  does faster-whisper decode a second of sound here
                                                                  (the recordings upload's -Check asks this)
    python scripts/post-pack/recording_match.py --self-test

How it decides, in order:

1. The new recordings. Every recording that has reached the engine
   (recording.py list), or with --inbox every file at the top level of the
   Inbox (never a subfolder, a dotfile or the Studio's
   .mindmake-inbox-id-v1.json), less any whose sha256 is already on a piece's
   making record.
2. The pieces waiting for one. The pieces in flight this week and next
   (GET /api/week/options), whose Scripts step is done and whose Record step
   is not, the nearest first by the day they go out.
3. Each piece's two scripts: the words its record says are current. The
   making record holds the hash of each cut's checked words
   (script_check.hashes), so every copy this machine can find is hashed
   and the one with those words is used: the post.json "video-script"
   entries with "cut" (docs/plans/<plan>/post.json, the file beside it, the
   pack staged or in the library, or the draft beside the plan), the pack
   by its usual names, and each of those files in the repository as
   committed on main (git show origin/main, then main), so a stale pack in
   Drive or an old checkout never stands in for words that changed since.
   With no copy of the current words, the first copy found is used, and
   said.
4. The words. faster-whisper small.en hears the first 45 seconds (cached as
   .cache/recordings/<sha256>.head.words.json), scored against the opening of
   each script with the ordered word match the Studio uses
   (orderedSimilarity, packages/core/src/candidates.ts).
5. The piece. Sure at 0.72 or more, and 0.15 clear of the next piece. The
   time rule, cut by cut: making.py scripts keeps when each cut's words last
   changed (script_check.changed_at), so a take recorded after its own
   cut's time is a take of the current words and can be placed, and a
   change to the long script never makes a short take look old. When the
   take was recorded is the time its file says it was made (ffprobe's
   creation_time), when that is after the piece's record began and no
   later than it reached the engine; else when it reached the engine. A take
   recorded before its cut's words last changed, but after the piece's
   record began (the record's started_at, fixed on its first write), is
   still heard: if it matches that piece it is unsure, "recorded before the
   script last changed", and never silently left alone. A take from before
   a piece's record began is none of its takes.
6. The cut. The words decide when the two scripts open differently. Most
   open the same way, so then the length decides (ffprobe): a raw long take
   runs about 2:30 and over, a short one about 2:15 and under. Between the
   two, a file name that says "long" or "short" decides. Words and length
   that disagree are unsure.
7. The script's title. Krish reads each cut from its script in
   teleprompter.com, which names the recording after the script ("Mon 12
   Oct - 3-minute - Who gets paid for AI songs.mp4"). A file whose name is
   the title of a cut's script on a waiting piece's record
   (meta.making.teleprompter.cuts.<cut>.title) is that piece and cut: placed
   without the words' bar, unless its words are surely another piece's or
   its length is surely the other cut's (then unsure).

8. The 15-minute feature (house rule FEATURE). A piece Krish called a
   feature for holds a third cut, the feature, once its script check holds
   the feature's hash (making.py scripts long short feature). Its takes are
   placed the same way, by words, title, length or name, and stamped with
   the feature script's hash: a take of 10:00 and over on such a piece is
   the feature, one between 8:00 and 10:00 is said to be unsure unless its
   words or its name decide, and the piece waits until the feature is
   recorded too. A piece with no feature hash never takes a feature.

Anything unsure is said in one plain line for that file, and nothing is
recorded for it. Exit 0 when every new recording is placed (or there are
none), 2 when any is unsure, 1 when something failed.

--record writes each sure match exactly as
    making.py --by NAME PIECE_ID recorded CUT "recordings/<sha256>.<ext>" --seconds N
would, stamped with script_sha256, the hash of the script it was taken from
(the piece's script_check.hashes for that cut). A take of an older script
then stops counting on the record.

--board puts one item on the board for each unsure take (POST
/api/workbench, upsert_items, the route every session uses, through
making.board_upsert): id take-<first 12 of its sha256>, closes_on
"take_placed", in progress for a session and never on Krish's list, because
nothing he can press answers it: a session works it out, or asks him in its
reply. Tied to a piece (the take is known to be one of its takes), it
carries the piece's idea_id. The lane closes nothing: Control Center's
done-check sweep ends it once the take is on a piece, and lets it go when
the lane notes that no waiting piece can be it ("close_ref": {"no_piece":
true}; making.board_note) or once no session has touched it for a week.
It reads the board first and never reopens an item: one done there (Krish
answered, or a session closed it) is left alone, on either machine. Each
take is asked about once for each question, its status, piece and whether
it is about older words, never again because a score or the closest piece
shifted: .cache/recordings/answered.json (the answered book) holds {sha256:
{status, reason, name, item, piece_id, older_script, at}} for every take
asked about ("unsure") or left alone for a newer take ("older take"), so the
runners' recordings upload can run the match only when a take that no piece
claims is not in it. A take left alone as "old" is not booked: the upload
looks at it again some hours later. A take placed later leaves the book. In
the lane (--board), a take downloaded only to hear its opening is deleted
once heard (its words are cached by sha256), so the runners' disks do not
fill. A take already on a waiting piece's record whose script's words
changed after it was recorded no longer counts there, and is asked about the
same way ("use it", or record it again); `making.py scripts` asks the same
question itself when it finds the words changed.

--clock builds the word clock of each take about to be placed, before it is
recorded: the whole take heard by faster-whisper small.en with word times,
named from its script (make.transcribe, the way quick-edit hears a take),
stamped with the take's provenance (quality.transcript_identity) and kept
as .cache/recordings/<sha256>.words.json, in quick-edit's words.json shape,
so a cut made from it can name it as its words. A clock that cannot be
built is that take's failure (exit 1), and the take is not recorded, so the
next run tries it again. A clock already there with the same provenance is
used as it is.

The Inbox's used/ convention. A take placed on its piece belongs in the
Inbox's used/ folder, and the report says so (report "inbox" "used", and a
"belongs in used/" line), keeping .cache/recordings/inbox-used.json, the
book of takes recorded as moved. A duplicate (the same sha256 under a second
name, or the same take again: the same words heard and the same length as a
placed take) is reported (report "inbox" "duplicates", and a "duplicate,
kept" line), never placed, never asked about and never deleted. Nothing is
moved in Drive: the engine reads the Inbox with a read-only key (docs/
DRIVE.md), so the move itself is Krish's, by hand, until he gives a route
the right to write there. The upload lane never reads a subfolder, so a take
in used/ is never sent or heard again.

It never sends, posts, spends, moves or deletes anything, and never writes
to the Inbox.
"""
import argparse
import hashlib
import importlib.metadata
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
sys.path.append(str(HERE.parent / 'quick-edit'))
import making  # noqa: E402  the piece's record: making.post, making.who, making.recorded_patch
import transcriber  # noqa: E402  whether faster-whisper decodes here, and the pinned fix
import recording  # noqa: E402  the engine's copies of the Inbox
import story_check  # noqa: E402  cut_of: what a file name says it is

CACHE = REPO / '.cache' / 'recordings'
PLANS = REPO / 'docs' / 'plans'
STUDIO_CONFIG = REPO / 'config' / 'studio.json'
PACK_OUT = REPO / '.cache' / 'post-pack'  # build.py's default: <folder>/3 Video/<name>
POSTS, VIDEO = '3 Posts', '3 Video'       # the library: 3 Posts/<folder>/3 Video/<name>
INBOX_MARKER = '.mindmake-inbox-id-v1.json'
CUTS = making.CUTS  # the two every piece gets
ALL_CUTS = making.ALL_CUTS  # and the 15-minute feature, on a piece whose script check holds its hash
FEATURE = making.FEATURE
HEAD_SECONDS = 45
MODEL = 'small.en'
SURE = 0.72         # the Studio's own bar for a take against its script (OPERATIONS.md, short-native)
MARGIN = 0.15       # clear of the next piece, and of the other cut when the words decide it
LONG_FROM = 150     # a raw long take runs about 2:30 and over (3:38, 2:52, 2:26 so far)
SHORT_UP_TO = 135   # a raw short take about 2:15 and under
LONG_UP_TO = 480    # on a feature piece, a raw long (5-minute) take runs 8:00 and under
FEATURE_FROM = 600  # and a raw 15-minute feature take 10:00 and over (2,025 words at 150 a minute is 13:30)
SETTLING = 120      # seconds unchanged before a file counts as finished (the recordings upload's rule)
LANE_LIMIT = 500 * 1024 * 1024  # the recordings upload skips files over 500 MiB
MIN_HEAD_WORDS = 12
PACK_NAMES = {'long': 'video-script.md', 'short': 'video-script-90-seconds.md', 'feature': 'video-script-feature.md'}  # plan_files.USUAL
SHA = re.compile(r'[0-9a-f]{64}')
ANSWERED = 'answered.json'   # .cache/recordings/answered.json: the takes already asked about, or left alone
USED = 'inbox-used.json'     # .cache/recordings/inbox-used.json: the takes that belong in the Inbox's used/ folder
USED_FOLDER = 'used'         # the Inbox's subfolder for placed takes; the upload lane never reads a subfolder
SAME_TAKE = 0.97             # a take heard the same as a placed one, word for word in order ...
SAME_LENGTH = 1.0            # ... and as long, within a second, is the same take again
NOT_MOVED = ('nothing in the Inbox was moved or deleted: the engine reads it with a read-only key, so a take that belongs '
             'in used/ is moved there by hand')
BOARD_PATH = '/api/workbench'
BOARD_CLIENTS = {'codex': 'codex', 'claude code': 'claude_code'}  # anything else writes as the runner
BEFORE_CHANGE = 'recorded before the script last changed'
TRANSCRIBER_FIX = transcriber.FIX  # the pinned set, never an unpinned install
CLOCK_SLACK = timedelta(minutes=5)  # a phone's clock may run a little ahead of the engine's
DAYS = ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun')
MONTHS = ('Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec')


class MatchError(RuntimeError):
    """A reason to stop, in words a person can act on."""


# ------------------------------------------------------------- the words

WORD = re.compile(r"[a-z0-9]+(?:['’-][a-z0-9]+)*")


def words(text):
    """words() in packages/core/src/candidates.ts: lower case, letters and
    digits, with an inner apostrophe or hyphen kept."""
    return WORD.findall(str(text or '').lower())


def _lcs_row(left, right):
    """The last row of the ordered match: row[j] is how many of left's words
    appear, in order, in right[:j]."""
    row = [0] * (len(right) + 1)
    for token in left:
        diagonal = 0
        for index in range(1, len(right) + 1):
            above = row[index]
            row[index] = diagonal + 1 if token == right[index - 1] else max(row[index - 1], above)
            diagonal = above
    return row


def ordered_similarity(left, right):
    """A port of orderedSimilarity, packages/core/src/candidates.ts:41-52:
    twice the longest run of shared words in order, over both lengths."""
    if not left or not right:
        return 0.0
    row = _lcs_row(left, right)
    return (2 * row[-1]) / (len(left) + len(right))


def opening_score(head, script):
    """How well the words heard at the start match the start of a script: the
    best ordered_similarity of the head against the script's opening, taken
    0.6 to 1.5 times the head's length, letting a false start of up to a
    third of the head go first."""
    if len(head) < MIN_HEAD_WORDS or not script:
        return 0.0
    best = 0.0
    for offset in range(0, min(len(head) // 3, 30) + 1, 2):
        part = head[offset:]
        n = len(part)
        if n < MIN_HEAD_WORDS:
            break
        top = min(len(script), int(n * 1.5) + 1)
        row = _lcs_row(part, script[:top])
        for j in range(max(1, int(n * 0.6)), top + 1):
            best = max(best, 2 * row[j] / (n + j))
    return round(best, 3)


# ------------------------------------------------------------- small helpers

def parse_time(text):
    if not text:
        return None
    try:
        when = datetime.fromisoformat(str(text).strip().replace('Z', '+00:00'))
    except ValueError:
        return None
    return when if when.tzinfo else when.replace(tzinfo=timezone.utc)


def iso(seconds):
    return datetime.fromtimestamp(seconds, timezone.utc).isoformat().replace('+00:00', 'Z')


def clock(seconds):
    s = int(round(seconds))
    return f'{s // 60}:{s % 60:02d}'


def day_of(scheduled):
    try:
        d = date.fromisoformat(str(scheduled)[:10])
    except ValueError:
        return 'Unscheduled'
    return f'{DAYS[d.weekday()]} {d.day} {MONTHS[d.month - 1]}'


def subject_of(piece):
    folder = piece.get('folder') or ''
    if ' - ' in folder:
        return folder.split(' - ', 1)[1]
    return piece.get('subject') or piece.get('idea') or piece['id'][:8]


def label(piece):
    return f'{day_of(piece.get("scheduled_for"))} "{subject_of(piece)}"'


def ext_of(name):
    return name.rsplit('.', 1)[-1].lower() if '.' in name else 'mp4'


def week_monday(text=None, today=None):
    try:
        d = date.fromisoformat(text) if text else (today or date.today())
    except ValueError:
        raise MatchError(f'--week is a date, YYYY-MM-DD, not "{text}"')
    return d - timedelta(days=d.weekday())


# ------------------------------------------------------------- the pieces

def _get(call, path):
    try:
        status, text = call('GET', path, None)
    except making.MakingError as error:
        raise MatchError(str(error))
    if status != 200:
        raise MatchError(f'the engine answered {status} to GET {path.split("?")[0]}: {text[:200]}')
    try:
        return json.loads(text)
    except ValueError:
        raise MatchError(f'the engine answered GET {path.split("?")[0]} with something that is not JSON')


STEP_TIMES = (('workroom', 'at'), ('publish_manager', 'at'), ('visual_gate', 'checked_at'), ('script_check', 'checked_at'),
              ('pack', 'packed_at'), ('session', 'started_at'))


def began_at(record):
    """When the piece's record began: its started_at, which the engine
    writes once, on the record's first write, and never moves
    (apps/control-plane/api/_making.ts mergeMaking). A record from before
    that was kept falls back to the earliest time any of its steps holds,
    which can only move later as steps are run again. A take from before it
    cannot be one of its takes."""
    fixed = parse_time(record.get('started_at'))
    if fixed:
        return fixed.isoformat().replace('+00:00', 'Z')
    times = [parse_time((record.get(step) or {}).get(field)) for step, field in STEP_TIMES if isinstance(record.get(step), dict)]
    times = [t for t in times if t]
    return min(times).isoformat().replace('+00:00', 'Z') if times else None


def cuts_of(piece):
    """The cuts a waiting piece is recorded in: the two, and the feature
    when its script check holds the feature's hash (waiting_pieces)."""
    cuts = piece.get('cuts') if isinstance(piece, dict) else None
    return tuple(c for c in ALL_CUTS if c in cuts) if cuts else CUTS


def length_cut(seconds, cuts=CUTS):
    """The cut a raw take's length says it is, or None when it is between
    two. On a feature piece a long take runs up to LONG_UP_TO and the
    feature FEATURE_FROM and over."""
    if not isinstance(seconds, (int, float)):
        return None
    if tuple(cuts) == ('short',):
        # An off-day piece he records has the short cut alone: a take that runs like a short is it; a longer one is not.
        return 'short' if seconds <= SHORT_UP_TO else None
    if FEATURE in cuts:
        if seconds >= FEATURE_FROM:
            return FEATURE
        if seconds > LONG_UP_TO:
            return None
    return 'long' if seconds >= LONG_FROM else 'short' if seconds <= SHORT_UP_TO else None


def length_bands(cuts):
    """The lengths length_cut reads, in words, for a reason line."""
    if tuple(cuts) == ('short',):
        return f'its one cut, a short take ({clock(SHORT_UP_TO)} and under)'
    bands = f'a long take ({clock(LONG_FROM)} and over) and a short one ({clock(SHORT_UP_TO)} and under)'
    if FEATURE in cuts:
        bands = (f'a long take ({clock(LONG_FROM)} to {clock(LONG_UP_TO)}), a short one ({clock(SHORT_UP_TO)} and under) and '
                 f'the 15-minute feature ({clock(FEATURE_FROM)} and over)')
    return bands


def cut_changed(piece, cut=None):
    """When the words of this cut of the piece last changed: its
    script_check.changed_at for the cut (making.py scripts keeps one per
    cut), else the check's checked_at. With no cut, the later of the two
    cuts. None when the record holds neither."""
    at = piece.get('changed_at') if isinstance(piece.get('changed_at'), dict) else {}
    if cut:
        return parse_time(at.get(cut)) or parse_time(piece.get('checked_at'))
    times = [parse_time(at.get(c)) for c in cuts_of(piece) if parse_time(at.get(c))]
    return max(times) if times else parse_time(piece.get('checked_at'))


def first_changed(piece):
    """The earlier of the two cuts' times: a take after it is of the current
    words of at least one cut."""
    at = piece.get('changed_at') if isinstance(piece.get('changed_at'), dict) else {}
    times = [parse_time(at.get(c)) for c in cuts_of(piece) if parse_time(at.get(c))]
    return min(times) if times else parse_time(piece.get('checked_at'))


def take_counts(rec, hashes):
    """The engine's takeCounts (apps/control-plane/api/_making.ts): a take
    counts for its cut unless it was taken from a script whose words have
    changed since."""
    sha, current = rec.get('script_sha256'), hashes.get(rec.get('cut'))
    return not sha or not current or sha == current


def waiting_pieces(call, monday):
    """(waiting, claimed). waiting: the pieces in flight this week and next
    whose Scripts step is done and Record step is not, the nearest first.
    claimed: every sha256 an in-flight piece's record already holds."""
    seen = {}
    for week in (monday, monday + timedelta(days=7)):
        data = _get(call, f'/api/week/options?week_start={week.isoformat()}')
        for series in data.get('series') or []:
            for item in series.get('in_flight') or []:
                pid = str((item or {}).get('id') or '')
                if making.UUID.match(pid) and pid not in seen:
                    seen[pid] = {'id': pid, 'idea': item.get('idea') or '', 'state': item.get('state'),
                                 'scheduled_for': item.get('scheduled_for'), 'series': series.get('label') or series.get('slug') or ''}
    waiting, claimed = [], set()
    for piece in seen.values():
        data = _get(call, f'/api/content-ideas/{piece["id"]}/making')
        record = data.get('making') or {}
        recordings = [r for r in record.get('recordings') or [] if isinstance(r, dict)]
        for rec in recordings:
            claimed.update(SHA.findall(str(rec.get('path') or '').lower()))
        steps = {s.get('key'): s for s in data.get('steps') or [] if isinstance(s, dict)}
        if (steps.get('scripts') or {}).get('state') != 'done':
            continue
        hashes = making.current_hashes(record)
        # The feature is a cut of this piece only when its script check holds the feature's hash (a piece Krish called one for).
        # An off-day piece he records is the short cut alone (making.one_cut; Ruling, Krish, 2026-10-29), and the
        # engine holds the exact words he approved for it (the making route's offday), heard like any other copy.
        cuts = ('short',) if making.one_cut(record) else tuple(c for c in ALL_CUTS if c in CUTS or c in hashes)
        offday = data.get('offday') if isinstance(data.get('offday'), dict) else {}
        if cuts == ('short',) and isinstance(offday.get('script'), str) and offday['script'].strip():
            piece['offday_script'] = offday['script']
        piece['cuts'] = list(cuts)
        # A cut counts as recorded only with a take of its current words.
        piece['recorded'] = sorted({r.get('cut') for r in recordings if r.get('cut') in cuts and take_counts(r, hashes)})
        if (steps.get('record') or {}).get('state') == 'done' and all(c in piece['recorded'] for c in cuts):
            continue
        piece['hashes'] = hashes
        # Takes on the record whose script's words changed after them: asked about, never used.
        piece['older_takes'] = [r for r in recordings if r.get('cut') in cuts and not take_counts(r, hashes) and r.get('cut') not in piece['recorded']]
        piece['checked_at'] = (record.get('script_check') or {}).get('checked_at')
        piece['changed_at'] = (record.get('script_check') or {}).get('changed_at') or {}
        piece['began'] = began_at(record)
        piece['folder'] = (record.get('pack') or {}).get('folder')
        # Each cut's script in Teleprompter, whose title names the recording he makes from it.
        tp = record.get('teleprompter') if isinstance(record.get('teleprompter'), dict) else {}
        tp_cuts = tp.get('cuts') if isinstance(tp.get('cuts'), dict) else {}
        piece['titles'] = {cut: c['title'] for cut, c in tp_cuts.items() if cut in cuts and isinstance(c, dict) and isinstance(c.get('title'), str)}
        waiting.append(piece)
    waiting.sort(key=lambda p: (p.get('scheduled_for') or '9999-12-31', p['id']))
    return waiting, claimed


# ------------------------------------------------------------- the scripts

_LIBRARY_ROOTS_WARNED = []


def library_roots():
    """Where a piece's pack can be: <root>/<folder>/3 Video/<name>."""
    roots = []
    env = os.environ.get('MINDMAKE_LIBRARY_ROOT', '').strip()
    if env:
        roots.append(Path(env) / POSTS)
    try:
        configured = json.loads(STUDIO_CONFIG.read_text(encoding='utf-8')).get('runtime', {}).get('library_root')
    except (OSError, ValueError, AttributeError):
        configured = None
    if configured and os.name == 'nt':
        roots.append(Path(configured) / POSTS)
    if os.name == 'nt':
        # A moved or renamed library is said once, never passed over in
        # silence (Krish, 2026-10-24: "ensure it is bulletproof and correct
        # everywhere"). The pack folder in this copy is still looked in.
        missing = [str(root) for root in roots if not root.is_dir()]
        if missing and not _LIBRARY_ROOTS_WARNED:
            _LIBRARY_ROOTS_WARNED.append(True)
            print(f'the asset library is not at {"; ".join(missing)} on this machine; '
                  'set runtime.library_root in config/studio.json to its path (docs/DRIVE.md)', file=sys.stderr)
    roots.append(PACK_OUT)
    unique = []
    for root in roots:
        if root not in unique:
            unique.append(root)
    return unique


def _read(path):
    try:
        path = Path(path)
        return path.read_text(encoding='utf-8-sig') if path.is_file() else None
    except OSError:
        return None


def _shown(path):
    """A path as the report shows it: from the repository when inside it,
    with forward slashes on every machine."""
    try:
        return Path(path).resolve().relative_to(REPO).as_posix()
    except ValueError:
        return Path(path).as_posix()


def find_post(piece_id, plans):
    for path in sorted(Path(plans).glob('*/post.json')):
        try:
            data = json.loads(path.read_text(encoding='utf-8-sig'))
        except (OSError, ValueError):
            continue
        if isinstance(data, dict) and str(data.get('piece_id') or '') == piece_id:
            return path, data
    return None, None


GIT_REFS = ('origin/main', 'main')  # the scripts committed on main


def committed(path, refs=GIT_REFS, repo=REPO):
    """The text of a file in the repository as committed on main (git show),
    or None: not in the repository, no git, or no such file there."""
    try:
        rel = Path(path).resolve().relative_to(Path(repo).resolve()).as_posix()
    except (ValueError, OSError):
        return None
    for ref in refs:
        try:
            out = subprocess.run(['git', '-C', str(repo), 'show', f'{ref}:{rel}'], capture_output=True, timeout=20)
        except (OSError, subprocess.TimeoutExpired):
            return None
        if out.returncode == 0:
            try:
                return out.stdout.decode('utf-8-sig')
            except UnicodeDecodeError:
                return None
    return None


def spoken_for(piece_id, cut, script, words_file, call, by, post=None):
    """What he changed reading this cut's script aloud (scripts/voice/spoken_delta.py), written onto the piece as
    spoken_delta.<cut>. Only against the exact words he was given: a script whose hash is the record's (current);
    any other copy could be a later edit, which would count its changes as his (Krish, 2026-10-31: "do all the other
    things on your list"). Returns what was recorded, or the reason it was not; it never stops the take being placed."""
    if not script or not script.get('current'):
        return {'piece_id': piece_id, 'cut': cut, 'skipped': 'the script he read is not on file by its hash'}
    sys.path.insert(0, str(REPO / 'scripts' / 'voice'))
    import spoken_delta
    try:
        result = spoken_delta.delta(script['text'], json.loads(Path(words_file).read_text(encoding='utf-8')))
        (post or making.post)(piece_id, spoken_delta.record_patch(cut, script['text'], result), call, by=by)
    except (OSError, ValueError, spoken_delta.DeltaError, making.MakingError) as error:
        return {'piece_id': piece_id, 'cut': cut, 'skipped': f'the comparison failed: {error}'[:200]}
    return {'piece_id': piece_id, 'cut': cut, 'changes_per_100_words': result['changes_per_100_words'], 'changes': result['changes']}


def scripts_for(piece, plans=PLANS, roots=None, show=committed):
    """{'long': {'text', 'from', 'current'}, 'short': {...}}: each script the
    piece has, its current words first. Every copy is gathered: for a
    post.json "video-script" entry, its own text, the file beside the
    post.json, the pack, then the draft beside the plan
    (docs/plans/<date>-draft-<file>); then the pack by its usual names; and
    each of those files as committed on main (show). The copy whose words
    hash to the record's for that cut (piece['hashes']) is used and marked
    current; with none, the first copy found, not current."""
    roots = library_roots() if roots is None else roots
    folder = piece.get('folder')
    hashes = piece.get('hashes') if isinstance(piece.get('hashes'), dict) else {}
    cuts = cuts_of(piece)  # a feature piece's feature too
    copies = {cut: [] for cut in cuts}
    if piece.get('offday_script') and 'short' in copies:
        copies['short'].append({'text': piece['offday_script'], 'from': 'the off-day option he approved (the engine)'})
    post_path, post = find_post(piece['id'], plans)
    for entry in (post or {}).get('files') or []:
        if not isinstance(entry, dict) or entry.get('kind') != 'video-script':
            continue
        cut = entry.get('cut') if entry.get('cut') in ALL_CUTS else story_check.cut_of(entry.get('name') or entry.get('file') or '')
        if cut not in cuts:
            continue
        if isinstance(entry.get('text'), str) and entry['text'].strip():
            copies[cut].append({'text': entry['text'], 'from': f'{_shown(post_path)} (its text)'})
            continue
        raw = entry.get('file') if isinstance(entry.get('file'), str) and entry['file'].strip() else None
        name = entry.get('name') or (f'video-script{Path(raw).suffix.lower() or ".md"}' if raw else PACK_NAMES[cut])
        places = [post_path.parent / raw] if raw else []
        places += [root / folder / VIDEO / name for root in roots] if folder else []
        dated = re.match(r'^(\d{4}-\d{2}-\d{2})-', post_path.parent.name)
        if raw and dated:
            places.append(post_path.parent.parent / f'{dated.group(1)}-draft-{Path(raw).name}')
        copies[cut] += [{'place': place} for place in places]
    for cut in cuts:
        if folder:
            copies[cut] += [{'place': root / folder / VIDEO / PACK_NAMES[cut]} for root in roots]
    found = {}
    for cut in cuts:
        texts = []
        for copy in copies[cut]:
            if 'text' in copy:
                texts.append(copy)
                continue
            text = _read(copy['place'])
            if text and text.strip():
                texts.append({'text': text, 'from': _shown(copy['place'])})
            on_main = show(copy['place']) if show else None
            if on_main and on_main.strip():
                texts.append({'text': on_main, 'from': f'{_shown(copy["place"])} (as committed on main)'})
        if not texts:
            continue
        want = hashes.get(cut)
        current = next((t for t in texts if want and making.script_hash(t['text']) == want), None)
        found[cut] = {**(current or texts[0]), 'current': bool(current)}
    return found


TITLE_COPY = re.compile(r'\s*(?:\(\d{1,3}\)|-\s*copy|\bcopy)\s*$', re.I)  # "Title (1).mp4", "Title - Copy.mp4"


def title_key(text):
    """A script title or a file name's stem, as compared: one space between
    words, any case, a trailing copy number dropped."""
    stem = str(text or '').strip()
    stem = re.sub(r'\.[A-Za-z0-9]{2,5}$', '', stem) if re.search(r'\.[A-Za-z0-9]{2,5}$', stem) else stem
    stem = TITLE_COPY.sub('', stem)
    return ' '.join(stem.replace('\u2019', "'").split()).casefold()


def titled(name, pieces):
    """(piece, cut) when the file's name is the title of exactly one cut's
    Teleprompter script on a waiting piece's record, else None."""
    key = title_key(name)
    hits = [(piece, cut) for piece in pieces for cut, title in (piece.get('titles') or {}).items()
            if cut in cuts_of(piece) and title and title_key(title) == key]
    return hits[0] if len(hits) == 1 else None


# ------------------------------------------------------------- the recordings

def engine_recordings(listing):
    """The engine's copies (recording.py list), newest first."""
    items = []
    for r in listing:
        sha = str(r.get('sha256') or '').lower()
        name = r.get('name')
        if not SHA.fullmatch(sha) or not recording.safe_name(name):
            continue
        names = [n for n in (r.get('names') or []) if isinstance(n, str) and recording.safe_name(n)] or [name]
        items.append({'name': name, 'names': names if name in names else [name] + names, 'sha256': sha, 'bytes': int(r.get('bytes') or 0),
                      'at': r.get('uploaded_at') or '', 'source': 'engine', 'download': (r.get('download') or {}).get('url')})
    return items


def _hashed(path, stat, book):
    """The file's sha256, remembered in book by name, size and time."""
    key = f'{path.name}|{stat.st_size}|{stat.st_mtime_ns}'
    if key not in book:
        book[key] = recording.sha256_of(path)
    return key, book[key]


def inbox_recordings(inbox, cache=CACHE, now=None):
    """Every recording at the top level of the Inbox on this machine, as the
    recordings upload reads it: no subfolder, no dotfile or hidden file, not
    the Studio's .mindmake-inbox-id-v1.json, only the recording types. A file
    changed in the last two minutes is still arriving."""
    inbox = Path(inbox)
    if not inbox.is_dir():
        raise MatchError(f'the Inbox is not at {inbox}. On a runner machine it is MINDMAKE_MEDIA_INBOX '
                         '(H:\\My Drive\\Ventures\\Active Ventures\\makeyourmindup\\Video Engine\\Inbox)')
    now = time.time() if now is None else now
    book_path = Path(cache) / 'inbox-sha256.json'
    try:
        book = json.loads(book_path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        book = {}
    before, kept, items = dict(book), {}, []
    for path in sorted(inbox.iterdir()):
        if path.name.startswith('.') or path.name == INBOX_MARKER or not path.is_file():
            continue
        stat = path.stat()
        if getattr(stat, 'st_file_attributes', 0) & 2:  # hidden, on Windows
            continue
        if ext_of(path.name) not in recording.EXTENSIONS or '.' not in path.name:
            continue
        item = {'name': path.name, 'path': path, 'bytes': stat.st_size, 'at': iso(max(stat.st_mtime, stat.st_ctime)), 'source': 'inbox'}
        if now - stat.st_mtime < SETTLING:
            item.update(sha256=None, settling=True)
        else:
            key, item['sha256'] = _hashed(path, stat, book)
            kept[key] = item['sha256']
        items.append(item)
    # Remembered in .cache, never in the Inbox, and only for what is there now.
    if kept != before:
        try:
            book_path.parent.mkdir(parents=True, exist_ok=True)
            book_path.write_text(json.dumps(kept, indent=0), encoding='utf-8')
        except OSError:
            pass
    return items


def fresh(items, claimed):
    """The recordings no piece holds yet, one per sha256, the newest first."""
    best = {}
    for item in items:
        sha = item.get('sha256')
        if sha in claimed:
            continue
        key = sha or f'settling:{item["name"]}'
        if key not in best or item['at'] > best[key]['at']:
            best[key] = item
    return sorted(best.values(), key=lambda i: i['at'], reverse=True)


def local_copy(item, cache=CACHE, fetch=None):
    """A local file of this recording: the Inbox file itself, or the engine's
    copy downloaded into .cache/recordings (where recording.py get puts it)
    and checked against its size and sha256."""
    if item.get('path'):
        return Path(item['path'])
    sha, name, size = item['sha256'], item['name'], item['bytes']
    for place in (cache / name, cache / f'{sha}.{ext_of(name)}'):
        if place.is_file() and place.stat().st_size == size and recording.sha256_of(place) == sha:
            return place
    target = cache / name if not (cache / name).exists() else cache / f'{sha}.{ext_of(name)}'
    try:
        recording.check_download_url(item.get('download'))
    except recording.RecordingError as error:
        raise MatchError(str(error))
    cache.mkdir(parents=True, exist_ok=True)
    fetch = fetch or (lambda url, handle: recording.Engine.download(None, url, handle))  # it keeps no state
    handle = tempfile.NamedTemporaryFile(dir=cache, prefix='.recording-', suffix='.part', delete=False)
    partial = Path(handle.name)
    try:
        with handle:
            fetch(item['download'], handle)
        if partial.stat().st_size != size or recording.sha256_of(partial) != sha:
            raise MatchError(f'the download of "{name}" does not match its size and sha256: it was not kept')
        os.replace(partial, target)
    except recording.RecordingError as error:
        raise MatchError(str(error))
    finally:
        if partial.exists():
            partial.unlink()
    return target


# ------------------------------------------------------------- hearing it

_WHISPER = {}


def transcribe_head(src, seconds=HEAD_SECONDS, model=MODEL):
    """The words of the first 45 seconds, the way quick-edit hears a whole
    take (faster-whisper small.en, word times), with no hint from any one
    script so no piece is favoured."""
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        raise MatchError(f'faster-whisper is not installed here, so the first 45 seconds cannot be heard: {TRANSCRIBER_FIX}; '
                         'or give the words with --words')
    if not shutil.which('ffmpeg'):
        raise MatchError('ffmpeg is not on this machine, so the first 45 seconds cannot be cut out to hear')
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / 'head.wav'
        cut = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-t', str(seconds), '-i', str(src), '-vn', '-ac', '1', '-ar', '16000', str(wav)],
                             capture_output=True, text=True)
        if cut.returncode != 0 or not wav.is_file():
            raise MatchError(f'ffmpeg could not read {Path(src).name}: {cut.stderr.strip()[:200]}')
        if model not in _WHISPER:
            _WHISPER[model] = WhisperModel(model, device='cpu', compute_type='int8')
        segments, _info = _WHISPER[model].transcribe(str(wav), word_timestamps=True, vad_filter=True, beam_size=5,
                                                     initial_prompt='Krish, makeyourmindup.')
        return [{'w': w.word, 's': round(w.start, 3), 'e': round(w.end, 3)} for s in segments for w in (s.words or [])]


def probe_seconds(src):
    """{'seconds': how long the whole take runs, 'recorded_at': the time its
    file says it was made (the container's creation_time tag)}, by ffprobe;
    each None when it cannot be read."""
    if not shutil.which('ffprobe'):
        return {'seconds': None, 'recorded_at': None}
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration:format_tags=creation_time', '-of', 'json', str(src)],
                         capture_output=True, text=True)
    try:
        fmt = json.loads(out.stdout or '{}').get('format') or {}
    except ValueError:
        fmt = {}
    try:
        seconds = float(fmt.get('duration'))
    except (TypeError, ValueError):
        seconds = None
    made = parse_time((fmt.get('tags') or {}).get('creation_time'))
    return {'seconds': seconds, 'recorded_at': made.isoformat().replace('+00:00', 'Z') if made else None}


def probed(value):
    """(seconds, recorded_at) from what a probe gave: probe_seconds' dict, or a plain number."""
    if isinstance(value, dict):
        return value.get('seconds'), value.get('recorded_at')
    return value, None


def read_words(path):
    """A words file for --words: quick-edit's words.json ({"words": [{"w": ..}]}),
    a list of words, or plain text. JSON may carry "recording_seconds"."""
    text = Path(path).read_text(encoding='utf-8-sig')
    try:
        data = json.loads(text)
    except ValueError:
        return [{'w': w} for w in text.split()], None
    if isinstance(data, dict):
        seconds = data.get('recording_seconds')
        data = data.get('words') or []
    else:
        seconds = None
    said = [{'w': w} if isinstance(w, str) else w for w in data if isinstance(w, (str, dict))]
    return said, float(seconds) if isinstance(seconds, (int, float)) else None


SILENT_DB = -80.0  # a take whose loudest point is under this recorded no sound at all


def loudest_db(src):
    """The loudest point of the take's sound, in dB (None when it has no sound track or ffmpeg cannot read it)."""
    try:
        out = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-t', str(HEAD_SECONDS), '-i', str(src), '-vn', '-af', 'volumedetect',
                              '-f', 'null', '-'], capture_output=True, text=True, timeout=300).stderr
    except (OSError, subprocess.SubprocessError):
        return None
    m = re.search(r'max_volume: (-?[\d.]+|-inf) dB', out)
    return None if not m else (-120.0 if m.group(1) == '-inf' else float(m.group(1)))


def hear(item, get_file, transcribe=transcribe_head, probe=probe_seconds, override=None, cache=CACHE):
    """(words heard in the first 45 seconds, how long the take runs, when
    its file says it was recorded or None). From --words, then
    .cache/recordings/<sha256>.head.words.json, then by hearing it, which is
    cached for next time. Any failure to hear it (a transcriber that cannot
    decode, a file ffmpeg cannot read) is a MatchError for this take alone,
    never a stop for the whole run."""
    try:
        return _hear(item, get_file, transcribe, probe, override, cache)
    except MatchError:
        raise
    except Exception as error:  # noqa: BLE001 one take that cannot be heard is that take's failure, said plainly
        raise MatchError(f'it could not be heard ({type(error).__name__}: {str(error)[:200]}); {TRANSCRIBER_FIX}') from None


def _hear(item, get_file, transcribe, probe, override, cache):
    if override:
        said, seconds = read_words(override)
        found, made = probed(probe(get_file())) if seconds is None else (seconds, None)
        return said, found, made
    book = cache / f'{item["sha256"]}.head.words.json'
    try:
        kept = json.loads(book.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        kept = None
    if isinstance(kept, dict) and kept.get('model') == MODEL and kept.get('head_seconds') == HEAD_SECONDS and isinstance(kept.get('words'), list):
        seconds, made = kept.get('recording_seconds'), kept.get('recorded_at')
        if isinstance(kept.get('max_db'), (int, float)):
            item['max_db'] = kept['max_db']
        if not isinstance(seconds, (int, float)):
            seconds, made = probed(probe(get_file()))
        return kept['words'], seconds, made
    src = get_file()
    seconds, made = probed(probe(src))
    said = transcribe(src)
    if len(words(' '.join(str(w.get('w', '')) for w in said))) < MIN_HEAD_WORDS:
        item['max_db'] = loudest_db(src)
    try:
        cache.mkdir(parents=True, exist_ok=True)
        book.write_text(json.dumps({'sha256': item['sha256'], 'name': item['name'], 'model': MODEL, 'head_seconds': HEAD_SECONDS,
                                    'duration': HEAD_SECONDS, 'recording_seconds': seconds, 'recorded_at': made, 'words': said,
                                    **({'max_db': item['max_db']} if item.get('max_db') is not None else {})}, indent=0),
                        encoding='utf-8')
    except OSError:
        pass
    return said, seconds, made


# ------------------------------------------------------------- deciding

def eligible_for(item, pieces):
    """The pieces this take can be placed on: those where it arrived after
    the words of at least one cut last changed (cut_changed), so it can be a
    take of current words. Which cut it is, and whether that cut's words
    changed after it, is settled once it is heard (older_words)."""
    arrived = parse_time(item.get('at'))
    keep = []
    for piece in pieces:
        first = first_changed(piece)
        if arrived and first and arrived < first:
            continue
        keep.append(piece)
    return keep


def predated_by(item, pieces):
    """The pieces whose words (either cut's) changed after this take
    arrived, but whose record had already begun: it may be a take of their
    older words, so it is heard, and a match on a cut whose words changed
    after it is asked about, never placed."""
    arrived = parse_time(item.get('at'))
    keep = []
    for piece in pieces:
        latest, began = cut_changed(piece), parse_time(piece.get('began'))
        if arrived and latest and arrived < latest and (not began or arrived >= began):
            keep.append(piece)
    return keep


def taken_at(item, answer, piece):
    """When the take was recorded, as best known: the time its file says it
    was made, when that is after the piece's record began and no later than
    it reached the engine (a phone uploads late; a wrong clock is ignored);
    else when it reached the engine."""
    arrived, made, began = parse_time(item.get('at')), parse_time(answer.get('recorded_at')), parse_time(piece.get('began'))
    if made and arrived and made <= arrived + CLOCK_SLACK and (not began or made >= began):
        return min(made, arrived)
    return arrived


def decide(item, said, seconds, pieces, scripts):
    """One file's answer: status 'placed' (with piece and cut) or 'unsure'
    (with the reason), and the scores behind it."""
    answer = {'status': 'unsure', 'seconds': round(seconds, 1) if isinstance(seconds, (int, float)) else None}
    head = words(' '.join(str(w.get('w', '')) for w in said))
    if len(head) < MIN_HEAD_WORDS:
        loud = item.get('max_db')
        if isinstance(loud, (int, float)) and loud <= SILENT_DB:
            # Friday 16 October: a 1:59 take reached the engine with a sound track of digital silence (-91 dB) while
            # Krish talked with his clip mic on. Say what it is, so he is asked for the mic's own file at once.
            return {**answer, 'silent': True, 'reason': f'its sound is silent (loudest point {loud:g} dB): the camera recorded the picture '
                                                        'but no sound. Ask Krish for the clip mic\'s own recording of it (scripts/quick-edit/'
                                                        'sync_audio.py lines it up with the picture) or a new take'}
        return {**answer, 'reason': f'too little speech in the first {HEAD_SECONDS} seconds to tell what it is'}
    scores = {}
    for piece in pieces:
        texts = scripts.get(piece['id']) or {}
        if texts:
            scores[piece['id']] = {cut: opening_score(head, words(texts[cut]['text'])) for cut in cuts_of(piece) if cut in texts}
    answer['scores'] = scores
    by_id = {p['id']: p for p in pieces}
    named = titled(item.get('name'), pieces)
    if named:
        return by_title(answer, named, scores, seconds, by_id)
    if not scores:
        return {**answer, 'reason': 'none of the pieces waiting for it has scripts this tool can read'}
    ranked = sorted(((max(c.values()), pid) for pid, c in scores.items()), reverse=True)
    best, pid = ranked[0]
    runner = ranked[1][0] if len(ranked) > 1 else 0.0
    piece = by_id[pid]
    answer.update(piece_id=pid, closest=pid, score=best, runner_up=round(runner, 3))
    if best < SURE:
        return {**answer, 'piece_id': None, 'reason': f'its opening matches no waiting piece well enough (closest {label(piece)} at {best:.2f}; {SURE:.2f} needed)'}
    if best - runner < MARGIN:
        return {**answer, 'piece_id': None, 'reason': f'it could be {label(piece)} ({best:.2f}) or {label(by_id[ranked[1][1]])} ({runner:.2f})'}
    own = scores[pid]
    # The words decide when the best cut's script is clear of every other cut's (the feature's too, on a feature piece).
    ranked_cuts = sorted(own.items(), key=lambda kv: kv[1], reverse=True)
    by_words = ranked_cuts[0][0] if len(ranked_cuts) >= 2 and ranked_cuts[0][1] - ranked_cuts[1][1] >= MARGIN else None
    if not isinstance(seconds, (int, float)):
        return {**answer, 'reason': f'it is {label(piece)}, but how long it runs could not be read (ffprobe), so the cut is not checked'}
    by_length = length_cut(seconds, cuts_of(piece))
    if by_words and by_length and by_words != by_length:
        return {**answer, 'reason': f'its words are {label(piece)}\'s {by_words} script, but it runs {clock(seconds)}, '
                                    f'which is a {by_length} take'}
    cut, how = (by_words, 'words') if by_words else (by_length, 'length')
    if not cut:
        hint = story_check.cut_of(item['name'])
        hint = hint if hint in cuts_of(piece) else None
        if not hint:
            return {**answer, 'reason': f'it is {label(piece)}, but it runs {clock(seconds)}, between {length_bands(cuts_of(piece))}'}
        cut, how = hint, 'name'
    if cut in (piece.get('recorded') or []):
        return {**answer, 'cut': cut, 'reason': f'it looks like a new take of {label(piece)}\'s {cut} cut, which is already recorded; left alone'}
    return {**answer, 'status': 'placed', 'cut': cut, 'by': how}


def by_title(answer, named, scores, seconds, by_id):
    """A take named after a cut's Teleprompter script: that piece and cut,
    whatever the words' bar, unless its words are surely another piece's or
    its length is surely the other cut's."""
    piece, cut = named
    pid = piece['id']
    own = max((scores.get(pid) or {}).values(), default=0.0)
    others = sorted(((max(c.values()), other) for other, c in scores.items() if other != pid and c), reverse=True)
    answer.update(piece_id=pid, closest=pid, score=round(own, 3), runner_up=round(others[0][0], 3) if others else 0.0, titled=True)
    if others and others[0][0] >= SURE and others[0][0] - own >= MARGIN:
        return {**answer, 'piece_id': None, 'reason': f'its name is {label(piece)}\'s {cut} script, but its words are '
                                                    f'{label(by_id[others[0][1]])}\'s ({others[0][0]:.2f})'}
    if not isinstance(seconds, (int, float)):
        return {**answer, 'reason': f'its name is {label(piece)}\'s {cut} script, but how long it runs could not be read (ffprobe)'}
    by_length = length_cut(seconds, cuts_of(piece))
    if by_length and by_length != cut:
        return {**answer, 'reason': f'its name is {label(piece)}\'s {cut} script, but it runs {clock(seconds)}, which is a {by_length} take'}
    if cut in (piece.get('recorded') or []):
        return {**answer, 'cut': cut, 'reason': f'it looks like a new take of {label(piece)}\'s {cut} cut, which is already recorded; left alone'}
    return {**answer, 'status': 'placed', 'cut': cut, 'by': 'title'}


def settle(answers):
    """Two takes placed on the same piece and cut: the newest is used, the
    others are named and left alone."""
    groups = {}
    for answer in answers:
        if answer['status'] == 'placed':
            groups.setdefault((answer['piece_id'], answer['cut']), []).append(answer)
    for group in groups.values():
        group.sort(key=lambda a: a['at'], reverse=True)
        for older in group[1:]:
            older.update(status='older take', reason=f'an older take of the same cut; the newer "{group[0]["name"]}" is used')
    return answers


# ------------------------------------------------------------- duplicates and used/

def _starts(said):
    return [w.get('s') for w in said if isinstance(w, dict)]


def same_take(a_said, a_seconds, b_said, b_seconds):
    """Whether two takes are the same recording again (a copy, a re-export),
    never two reads of one script: the same words heard in the same order,
    the same length within a second, and, where the words carry their times,
    each word at the same moment (one offset for all, as a re-export may
    start a little later). Two reads of one script never keep every word's
    time; without times, only the very same words and length count."""
    if not all(isinstance(x, (int, float)) for x in (a_seconds, b_seconds)) or abs(a_seconds - b_seconds) > SAME_LENGTH:
        return False
    a_words = words(' '.join(str(w.get('w', '')) for w in a_said))
    b_words = words(' '.join(str(w.get('w', '')) for w in b_said))
    if len(a_words) < MIN_HEAD_WORDS or ordered_similarity(a_words, b_words) < SAME_TAKE:
        return False
    a_at, b_at = _starts(a_said), _starts(b_said)
    timed = bool(a_at) and len(a_at) == len(b_at) and all(isinstance(t, (int, float)) for t in a_at + b_at)
    if not timed:
        return a_words == b_words and abs(a_seconds - b_seconds) <= 0.1
    gaps = sorted(b - a for a, b in zip(a_at, b_at))
    offset = gaps[len(gaps) // 2]
    return sum(1 for g in gaps if abs(g - offset) <= 0.08) >= 0.9 * len(gaps)


def cached_head(sha, cache):
    """(words, seconds) heard from a take before, from its cached opening, or None."""
    try:
        kept = json.loads((Path(cache) / f'{sha}.head.words.json').read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return None
    if isinstance(kept, dict) and isinstance(kept.get('words'), list):
        return kept['words'], kept.get('recording_seconds')
    return None


def mark_duplicates(answers, heard, claimed, cache):
    """A take heard the same as a take placed now or already on a piece's
    record (same_take) is a duplicate: reported and kept, never placed,
    never asked about. Only takes that are not being placed are looked at,
    so a new take is never mistaken for a copy of itself."""
    placed = [(a['sha256'], a['name'], heard[a['sha256']]) for a in answers if a['status'] == 'placed' and a.get('sha256') in heard]
    for sha in sorted(claimed):
        kept = cached_head(sha, cache)
        if kept:
            placed.append((sha, f'recordings/{sha}', kept))
    for answer in answers:
        sha = answer.get('sha256')
        if answer['status'] not in ('older take', 'unsure') or answer.get('source') == 'record' or sha not in heard:
            continue
        said, seconds = heard[sha]
        for other_sha, other_name, (other_said, other_seconds) in placed:
            if other_sha != sha and same_take(said, seconds, other_said, other_seconds):
                answer.update(status='duplicate', duplicate_of=other_sha,
                              reason=f'the same take as "{other_name}" (the same words at the same moments, and as long); kept, never deleted')
                break
    return answers


def inbox_report(listed, claimed, answers, recorded):
    """What the Inbox's used/ convention says of this run: the takes that
    belong in used/ (each placed on its piece now; read on this machine, a
    file already on a piece's record too), and the duplicates, each kept:
    the same take again (mark_duplicates), or the same bytes under a second
    name (the engine keeps every name a take was copied under; on this
    machine, a second file). Nothing is moved and nothing is deleted."""
    by_sha = {}
    for item in sorted(listed, key=lambda i: i['at']):
        if item.get('sha256'):
            by_sha.setdefault(item['sha256'], []).append(item)
    used, dupes = [], []
    for answer in answers:
        if answer['status'] == 'placed' and (answer['piece_id'], answer['cut']) in recorded:
            used.append({'sha256': answer['sha256'], 'name': answer['name'], 'piece_id': answer['piece_id'], 'cut': answer['cut'], 'path': answer['path']})
        elif answer['status'] == 'duplicate':
            dupes.append({'sha256': answer['sha256'], 'name': answer['name'], 'of': answer['duplicate_of'], 'why': 'same take', 'kept': True})
    for sha, items in by_sha.items():
        if sha in claimed and items[0]['source'] == 'inbox' and all(u['sha256'] != sha for u in used):
            used.append({'sha256': sha, 'name': items[0]['name'], 'piece_id': None, 'cut': None, 'path': None, 'on_record': True})
    for entry in used:
        names = []
        for item in by_sha.get(entry['sha256'], []):
            for n in item.get('names') or [item['name']]:
                if n not in names:
                    names.append(n)
        for n in names:
            if n != entry['name']:
                dupes.append({'sha256': entry['sha256'], 'name': n, 'of': entry['sha256'], 'why': 'same bytes', 'kept': True})
    return {'used_folder': USED_FOLDER, 'used': used, 'duplicates': dupes, 'moved': False, 'deleted': False, 'why_not_moved': NOT_MOVED}


def book_used(cache, inbox, stamp):
    """Keeps .cache/recordings/inbox-used.json: each take that belongs in
    used/, recorded as moved there (it is not moved: NOT_MOVED)."""
    if not inbox['used']:
        return
    path = Path(cache) / USED
    try:
        book = json.loads(path.read_text(encoding='utf-8'))
        book = book if isinstance(book, dict) else {}
    except (OSError, ValueError):
        book = {}
    before = json.dumps(book, sort_keys=True)
    for entry in inbox['used']:
        held = book.get(entry['sha256']) if isinstance(book.get(entry['sha256']), dict) else {}
        book[entry['sha256']] = {'names': sorted(set(held.get('names') or []) | {entry['name']}),
                                 'piece_id': entry['piece_id'] or held.get('piece_id'), 'cut': entry['cut'] or held.get('cut'),
                                 'to': f'{USED_FOLDER}/', 'moved': False, 'at': held.get('at') or stamp}
    if json.dumps(book, sort_keys=True) != before:
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            partial = path.with_suffix('.json.part')
            partial.write_text(json.dumps(book, indent=1, sort_keys=True), encoding='utf-8')
            os.replace(partial, path)
        except OSError:
            pass


# ------------------------------------------------------------- the word clock

def word_clock(src, out, prompt=''):
    """The whole take's word clock, as quick-edit hears a take (make.transcribe:
    faster-whisper small.en, word times, the script's names as the hint),
    stamped with its provenance so make.py takes it as the take's words
    (quality.checked_words). One already there with the same provenance is
    used as it is. Returns {'words': n, 'duration': seconds, 'reused': bool}."""
    import make  # noqa: E402  quick-edit, imported only when a clock is built
    import quality  # noqa: E402
    try:
        identity = quality.transcript_identity(src, 1, MODEL)
    except importlib.metadata.PackageNotFoundError:
        raise MatchError(f'faster-whisper is not installed here, so the word clock cannot be built: {TRANSCRIBER_FIX}') from None
    out = Path(out)
    try:
        held = json.loads(out.read_text(encoding='utf-8'))
        return {'words': len(quality.checked_words(held, identity)), 'duration': held.get('duration'), 'reused': True}
    except (OSError, ValueError, AttributeError, KeyError, TypeError):
        pass
    said = make.transcribe(src, out, MODEL, prompt, identity)
    held = json.loads(out.read_text(encoding='utf-8'))
    return {'words': len(said), 'duration': held.get('duration'), 'reused': False}


def clock_prompt(text):
    """The script's names as the transcriber's hint (make.script_prompt reads a file)."""
    if not text:
        return ''
    import make  # noqa: E402
    with tempfile.TemporaryDirectory() as tmp:
        script = Path(tmp) / 'script.md'
        script.write_text(text, encoding='utf-8')
        return make.script_prompt(script)


def build_clock(answer, item, get_file, cache, scripts, make_clock):
    """One placed take's word clock, by make_clock(src, out, prompt), kept as
    .cache/recordings/<sha256>.words.json. Returns the report entry, or
    raises MatchError."""
    out = Path(cache) / f'{answer["sha256"]}.words.json'
    text = ((scripts.get(answer['piece_id']) or {}).get(answer['cut']) or {}).get('text') or ''
    try:
        built = make_clock(get_file(item, cache), out, clock_prompt(text))
    except MatchError:
        raise
    except Exception as error:  # noqa: BLE001 one clock that cannot be built is that take's failure
        raise MatchError(f'its word clock could not be built ({type(error).__name__}: {str(error)[:200]}); {TRANSCRIBER_FIX}') from None
    return {'sha256': answer['sha256'], 'name': answer['name'], 'piece_id': answer['piece_id'], 'cut': answer['cut'],
            'words_file': str(out), 'words': built.get('words'), 'duration': built.get('duration'), 'reused': bool(built.get('reused'))}


# ------------------------------------------------------------- the run

def plain(answer, pieces):
    by_id = {p['id']: p for p in pieces}
    name = answer['name']
    if answer['status'] == 'placed':
        piece = by_id[answer['piece_id']]
        why = {'words': 'its words', 'length': 'its length', 'name': 'its name (the length alone could not say)'}.get(answer['by'])
        if answer['by'] == 'title':
            line = (f'placed: "{name}" is the {answer["cut"]} cut of {label(piece)}: its name is the title of that cut\'s script in '
                    f'Teleprompter. Its opening matches {answer["score"]:.2f} (the next piece {answer["runner_up"]:.2f}), and it runs '
                    f'{clock(answer["seconds"])}.')
        else:
            line = (f'placed: "{name}" is the {answer["cut"]} cut of {label(piece)}. Its opening matches {answer["score"]:.2f} '
                    f'(the next piece {answer["runner_up"]:.2f}), it runs {clock(answer["seconds"])}, and {why} chose the cut.')
        if answer.get('big'):
            line += ' It is over 500 MiB, so the upload lane skips it: produce it on this machine.'
        return line
    if answer['status'] == 'older take':
        return f'left alone: "{name}" is {answer["reason"]}.'
    if answer['status'] == 'old':
        return f'left alone: "{name}" {answer.get("reason") or "arrived before any piece waiting for a recording began"}.'
    if answer['status'] == 'failed':
        return f'failed: "{name}": {answer["reason"]}.'
    if answer['status'] == 'duplicate':
        return f'duplicate, kept: "{name}" is {answer["reason"]}.'
    if answer.get('older_script'):
        return f'unsure: "{name}": {answer["reason"]}. Ask Krish whether to use it or record it again.'
    return f'unsure: "{name}": {answer["reason"]}. Ask Krish which piece and cut it is.'


def command_for(answer, by):
    return (f'python scripts/post-pack/making.py --by "{by}" {answer["piece_id"]} recorded {answer["cut"]} '
            f'"{answer["path"]}" --seconds {int(round(answer["seconds"]))}')


def older_words(answer, item, before, pieces):
    """A take that matches a piece's cut whose words changed after it was
    recorded (taken_at against that cut's own time, cut_changed): unsure,
    never placed, so a change to the long script never makes a short take
    of unchanged words look old. One that matches none of the pieces it
    predates and could be placed on no other: left alone."""
    by_id = {p['id']: p for p in pieces}
    before_ids = {p['id'] for p in before}
    pid = answer.get('piece_id')
    if pid and pid in by_id:
        piece = by_id[pid]
        changed = cut_changed(piece, answer.get('cut'))
        when = taken_at(item, answer, piece)
        if not (changed and when and when < changed):
            return answer
        cut = f"'s {answer['cut']} cut" if answer.get('cut') else ''
        how = 'was recorded' if when != parse_time(item.get('at')) else 'arrived'
        return {**answer, 'status': 'unsure', 'older_script': True,
                'reason': f'it is {label(piece)}{cut}, but it was {BEFORE_CHANGE} '
                          f'(it {how} {when.isoformat()[:16].replace("T", " ")}, the script was last changed '
                          f'{changed.isoformat()[:16].replace("T", " ")}), so it may be a take of the older words'}
    if not pid and len(before_ids) == len(pieces):
        # Every piece it could be changed its words after it arrived.
        if (answer.get('score') or 0) >= SURE:
            return {**answer, 'older_script': True, 'reason': f'{answer["reason"]}; and it was {BEFORE_CHANGE}'}
        return {**answer, 'status': 'old', 'reason': 'arrived before the scripts of every piece waiting for a recording last changed, '
                                                     'and its opening matches none of them'}
    return answer


board_client = making.board_client  # codex, claude_code, else the runner


def board_item(answer, pieces):
    """One board item for one unsure take, in progress for a session and
    never on Krish's list (WORKBENCH.md, "The board"): nothing he can press
    answers which take it is, so a session works it out, or asks him in its
    reply. Tied to a piece (the take is known to be one of its takes, or is
    one of two close pieces'), it names the piece. It ends when the take is
    placed (closes_on take_placed): Control Center's done-check sweep sees
    the take on a piece and closes it."""
    by_id = {p['id']: p for p in pieces}
    sha, name = answer['sha256'], answer['name']
    shown = name if len(name) <= 80 else name[:77] + '...'
    pid = answer.get('piece_id') or (answer.get('closest') if (answer.get('score') or 0) >= SURE else None)
    tied = bool(pid and pid in by_id)
    cut = answer.get('cut') if tied and answer.get('piece_id') == pid else None
    path = answer.get('path') or f'recordings/{sha}.{ext_of(name)}'
    if answer.get('older_script'):
        title = f'Use the take "{shown}", recorded before the script changed?'
        ask = ('A session asks Krish in its reply whether to use it (it then records it on the piece with his words, as a take of '
               'the current script) or to record that cut again and drop the new take in the Inbox.')
    elif cut:
        title = f'Use the new take "{shown}" of the {cut} cut, which is already recorded?'
        ask = ('A session asks Krish in its reply whether to use it in place of the take on the record, and with his words '
               'records it with making.py.')
    elif tied:
        title = f'Which cut is the take "{shown}"?'
        ask = ('A session works out the cut (the 5-minute, the 90-second' + (' or the 15-minute feature' if FEATURE in cuts_of(by_id[pid]) else '')
               + ') and records it with making.py, or asks Krish in its reply.')
    else:
        title = f'Which piece and cut is the take "{shown}"?'
        ask = ('No piece is known for it, so a session works out its piece and cut and records it with making.py, or asks Krish '
               'in its reply. It is let go once no waiting piece can be it, or after a week that no session touches it.')
    detail = (f'{answer["reason"][0].upper()}{answer["reason"][1:]}. It reached the engine {str(answer.get("at"))[:16].replace("T", " ")} '
              f'as {path}; nothing was recorded for it. Held for a session, off Krish\'s list: nothing he can press answers it. {ask}')
    item = {'id': f'take-{sha[:12]}', 'lane': 'in_progress', 'rank': 5, 'area': 'Recordings',
            'title': title[:200], 'detail': detail[:2000], 'closes_on': 'take_placed'}
    if tied:
        item['idea_id'] = pid
    return item


def load_answered(cache):
    try:
        book = json.loads((Path(cache) / ANSWERED).read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return {}
    return {k: v for k, v in book.items() if SHA.fullmatch(str(k)) and isinstance(v, dict)} if isinstance(book, dict) else {}


def save_answered(cache, book):
    path = Path(cache) / ANSWERED
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        partial = path.with_suffix('.json.part')
        partial.write_text(json.dumps(book, indent=1, sort_keys=True), encoding='utf-8')
        os.replace(partial, path)
    except OSError:
        pass


def asked_as(entry):
    """What a question was, as the answered book keys it: its status, the
    piece it is tied to and whether it is about older words. The free-text
    reason (a score, the closest piece) is not part of it, so a reason that
    shifts as the waiting pieces change never asks again."""
    entry = entry if isinstance(entry, dict) else {}
    return (entry.get('status'), entry.get('piece_id'), bool(entry.get('older_script')))


def ask_on_board(answers, pieces, call, by, cache, out, now=None):
    """Puts each unsure take on the board once for each question (asked_as:
    its status, its piece, older words or not), held for a session, and
    keeps the answered book. The board is never made to reopen an item
    (making.board_upsert): one Krish or a session closed stays closed, on
    either machine. A take left alone as "old" is not booked: the recordings
    upload looks at it again later, as a piece may start waiting for it.

    It closes nothing. Once a question is gone it says so: a take placed
    needs no word (Control Center's done-check sweep sees it on its piece and
    closes the item), and a take no waiting piece can be any more ("old")
    is noted on its item ("close_ref": {"no_piece": true}; making.board_note),
    so the sweep lets it go. One no session touches for a week is let go by
    the same sweep. Returns (asked, noted, failed): the item ids written, the
    ones noted, and whether the board refused or could not be reached."""
    stamp = now or datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    book = load_answered(cache)
    before = dict(book)
    asked, items, entries, ending = [], [], {}, {}
    for answer in answers:
        sha = answer.get('sha256')
        if not sha:
            continue
        booked = book.get(sha) or {}
        if answer['status'] in ('placed', 'old'):
            # Its question is answered (placed), or no waiting piece can be it any more (old).
            if booked.get('status') == 'unsure' and booked.get('item'):
                ending[booked['item']] = (sha, answer['status'])
            elif answer['status'] == 'placed':
                book.pop(sha, None)
            continue
        if answer['status'] == 'older take':
            # Heard, and a newer take of the same cut is used: nothing to ask.
            if booked.get('status') != 'older take':
                book[sha] = {'status': 'older take', 'reason': answer.get('reason'), 'name': answer['name'], 'at': stamp}
            continue
        if answer['status'] != 'unsure':
            continue
        item = board_item(answer, pieces)
        entry = {'status': 'unsure', 'reason': answer['reason'], 'name': answer['name'], 'item': item['id'],
                 'piece_id': item.get('idea_id'), 'older_script': bool(answer.get('older_script')), 'at': stamp}
        if asked_as(booked) == asked_as(entry):
            out(f'already asked on the board: "{answer["name"]}" ({item["id"]})')
            continue
        items.append(item)
        entries[item['id']] = (sha, entry)
    failed = False
    try:
        written, left = making.board_upsert(items, call, by)
    except making.MakingError as error:
        failed, written, left = True, [], []
        out(f'failed: {error}; asked again on the next run')
    for item_id in written + left:
        sha, entry = entries[item_id]
        book[sha] = entry
        if item_id in written:
            asked.append(item_id)
            out(f'held on the board for a session: {item_id}, {next(i["title"] for i in items if i["id"] == item_id)}')
        else:
            out(f'not asked again: {item_id} is closed on the board (answered, or closed by a session)')
    noted = []
    if ending:
        old = {item_id: {'close_ref': {'no_piece': True}} for item_id, (_, end) in ending.items() if end == 'old'}
        try:
            noted = making.board_note(old, call, by)
        except making.MakingError as error:
            failed = True
            out(f'failed: {error}; noted on the next run')
        else:
            # Noted now, placed, or already closed on the board: either way its question is gone.
            for item_id, (sha, end) in ending.items():
                book.pop(sha, None)
                if end == 'placed':
                    out(f'placed: {item_id} closes itself once the check sees the take on its piece')
                elif item_id in noted:
                    out(f'noted on the board: {item_id}, no waiting piece can be it, so the check lets it go')
    if book != before:
        save_answered(cache, book)
    return asked, noted, failed


def run(opts, call, list_items, get_file=local_copy, transcribe=transcribe_head, probe=probe_seconds,
        out=print, cache=CACHE, plans=PLANS, roots=None, clock_with=word_clock):
    """The whole run, with every outside thing passed in. Returns (exit code, report)."""
    monday = week_monday(opts.get('week'))
    by = making.who(opts.get('by'))
    pieces, claimed = waiting_pieces(call, monday)
    listed = list_items()
    named = {i['sha256']: i for i in listed if i.get('sha256')}
    items = fresh(listed, claimed)
    overrides = parse_overrides(opts.get('words'), [i for i in items if i.get('sha256')])
    report = {'week_start': monday.isoformat(), 'waiting': [], 'files': [], 'recorded': [], 'asked': [], 'noted': [], 'clocks': []}
    scripts = {}
    heard, item_of, fetched = {}, {}, []  # what each take said, each take by sha256, and the copies fetched only to hear
    for piece in pieces:
        scripts[piece['id']] = scripts_for(piece, plans, roots)
        report['waiting'].append({'id': piece['id'], 'day': day_of(piece.get('scheduled_for')), 'subject': subject_of(piece),
                                  'cuts': [c for c in cuts_of(piece) if c not in piece['recorded']],
                                  'scripts': {c: s['from'] for c, s in scripts[piece['id']].items()}})
    if pieces:
        out('Waiting for a recording: ' + '; '.join(
            f'{label(p)} ({" and ".join(c for c in cuts_of(p) if c not in p["recorded"])})' for p in pieces) + '.')
    else:
        out('No piece this week or next is waiting for a recording (its Scripts step done and its Record step not).')
    for piece in pieces:
        missing = [c for c in cuts_of(piece) if c not in scripts[piece['id']]]
        if missing:
            out(f'note: no {" or ".join(missing)} script found for {label(piece)} (docs/plans post.json, the draft beside it, '
                f'or the pack), so it is matched on what there is.')
        stale = [c for c in cuts_of(piece) if c in scripts[piece['id']] and piece.get('hashes', {}).get(c) and not scripts[piece['id']][c].get('current')]
        if stale:
            out(f'note: no copy of the current {" or ".join(stale)} words of {label(piece)} is on this machine or on main (its record\'s hash), '
                f'so the nearest copy is used: pull main, or the take may be unsure.')
    if not items:
        out('No new recordings: everything that has arrived is already on a piece.')
    elif not pieces:
        out(f'{len(items)} new recording{"" if len(items) == 1 else "s"} arrived; none is placed until a piece is waiting for one.')
    answers = []
    for item in items:
        base = {'name': item['name'], 'sha256': item.get('sha256'), 'at': item['at'], 'source': item['source']}
        if item.get('settling'):
            answers.append({**base, 'status': 'unsure', 'reason': 'it is still arriving (it changed in the last two minutes); run this again shortly'})
            continue
        if not pieces:
            continue
        # The time rule: placed only on a piece whose words last changed
        # before it arrived; heard against one whose words changed after it
        # arrived (once its record had begun), and a match is asked about.
        before = predated_by(item, pieces)
        candidates = eligible_for(item, pieces) + before
        if not candidates:
            answers.append({**base, 'status': 'old', 'reason': 'arrived before any piece waiting for a recording began, so it is none of their takes'})
            continue
        # The lane (--board) keeps no copy of a take it downloads only to hear
        # its opening: the words are cached by sha256, and a production
        # session fetches the take on purpose (recording.py get).
        copies = [cache / item['name'], cache / f'{item["sha256"]}.{ext_of(item["name"])}'] if item['source'] == 'engine' else []
        there = {c for c in copies if c.exists()}
        try:
            said, seconds, made = hear(item, lambda: get_file(item, cache), transcribe, probe, overrides.get(item['sha256']), cache)
        except MatchError as error:
            answers.append({**base, 'status': 'failed', 'reason': str(error)})
            continue
        finally:
            # With --clock a placed take is heard again whole, so its copy is kept until the run ends.
            fetched.extend(c for c in copies if c not in there)
            if opts.get('board') and not opts.get('clock'):
                _drop(fetched)
        heard[item['sha256']], item_of[item['sha256']] = (said, seconds), item
        answer = older_words({**base, 'recorded_at': made, **decide(item, said, seconds, candidates, scripts)}, item, before, candidates)
        answer['path'] = f'recordings/{item["sha256"]}.{ext_of(item["name"])}'
        if item['source'] == 'inbox' and item['bytes'] > LANE_LIMIT:
            answer['big'] = True
        answers.append(answer)
    settle(answers)
    mark_duplicates(answers, heard, claimed, cache)
    # A take already on the record, of words that changed after it, unless a new take of that cut is placed now.
    placing = {(a['piece_id'], a['cut']) for a in answers if a['status'] == 'placed'}
    for piece in pieces:
        for rec in piece.get('older_takes') or []:
            sha = (SHA.findall(str(rec.get('path') or '').lower()) or [None])[0]
            if not sha or (piece['id'], rec['cut']) in placing:
                continue
            listed_as = named.get(sha) or {}
            answers.append({'name': listed_as.get('name') or Path(str(rec['path'])).name, 'sha256': sha, 'at': listed_as.get('at') or rec.get('at'),
                            'source': 'record', 'status': 'unsure', 'older_script': True, 'piece_id': piece['id'], 'cut': rec['cut'],
                            'path': rec['path'], 'reason': f'it is on {label(piece)} as its {rec["cut"]} cut, but the script\'s words changed after it '
                                                           f'was recorded, so it no longer counts'})
    for answer in answers:
        out(plain(answer, pieces))
    by_id = {p['id']: p for p in pieces}
    order = {p['id']: n for n, p in enumerate(pieces)}
    # Written piece by piece, the nearest first, the long cut before the short.
    placed = sorted((a for a in answers if a['status'] == 'placed'), key=lambda a: (order[a['piece_id']], ALL_CUTS.index(a['cut'])))
    recorded = set()
    for answer in placed:
        if opts.get('clock'):
            # The word clock first: a take whose clock cannot be built is not recorded, so the next run tries it again.
            try:
                built = build_clock(answer, item_of[answer["sha256"]], get_file, cache, scripts, clock_with)
            except MatchError as error:
                answer['status'] = 'failed'
                answer['reason'] = f'it was not recorded: {error}'
                out(f'failed: "{answer["name"]}" was not recorded on {label(by_id[answer["piece_id"]])}: {error}')
                continue
            report['clocks'].append(built)
            out(f'word clock: "{answer["name"]}", {built["words"]} words'
                + (f' over {clock(built["duration"])}' if isinstance(built.get('duration'), (int, float)) else '')
                + f', in {built["words_file"]}' + (' (already built)' if built['reused'] else ''))
        if opts.get('record'):
            piece = by_id[answer['piece_id']]
            # Stamped with the script it was taken from: the piece's current words for that cut.
            patch = making.recorded_patch(answer['cut'], answer['path'], answer['seconds'], (piece.get('hashes') or {}).get(answer['cut']))
            try:
                making.post(answer['piece_id'], patch, call, by=by)
            except making.MakingError as error:
                answer['status'] = 'failed'
                answer['reason'] = f'it was not recorded: {error}'
                out(f'failed: "{answer["name"]}" was not recorded on {label(piece)}: {error}')
                continue
            recorded.add((answer['piece_id'], answer['cut']))
            if opts.get('spoken') and opts.get('clock'):
                spoke = spoken_for(answer['piece_id'], answer['cut'], (scripts.get(answer['piece_id']) or {}).get(answer['cut']),
                                   built['words_file'], call, by)
                report.setdefault('spoken', []).append(spoke)
                out(f'spoken: {label(piece)} {answer["cut"]} cut, ' + (f'{spoke["changes_per_100_words"]} changes per 100 script words'
                                                                      if 'changes' in spoke else spoke['skipped']))
            report['recorded'].append({'piece_id': answer['piece_id'], 'cut': answer['cut'], 'path': answer['path'], 'by': by,
                                       **({'script_sha256': patch['recordings'][0]['script_sha256']} if 'script_sha256' in patch['recordings'][0] else {})})
            out(f'recorded on the board, by {by}: {label(piece)} {answer["cut"]} cut, "{answer["name"]}" ({answer["path"]})')
        else:
            out(f'to record it: {command_for(answer, by)}')
    # Each take as it ended: a placed take whose clock or record failed says so.
    report['files'] = [{k: v for k, v in answer.items() if k != 'scores'} | {'scores': answer.get('scores', {})} for answer in answers]
    # The Inbox's used/ convention: what belongs in used/, and each duplicate, reported and kept.
    report['inbox'] = inbox = inbox_report(listed, claimed, answers, recorded)
    for entry in inbox['used']:
        where = f'placed on {label(by_id[entry["piece_id"]])} as its {entry["cut"]} cut' if entry['piece_id'] in by_id else 'already on a piece\'s record'
        out(f'belongs in {USED_FOLDER}/: "{entry["name"]}", {where}')
    for entry in inbox['duplicates']:
        if entry['why'] == 'same bytes':
            out(f'duplicate, kept: "{entry["name"]}" is the same bytes (sha256 {entry["sha256"][:12]}) as a take placed on a piece')
    if inbox['used'] or inbox['duplicates']:
        out(NOT_MOVED + '.')
    if opts.get('record'):
        book_used(cache, inbox, datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'))
    board_failed = False
    if opts.get('board'):
        report['asked'], report['noted'], board_failed = ask_on_board(answers, pieces, call, by, cache, out)
        _drop(fetched)
    if board_failed or any(a['status'] == 'failed' for a in answers):
        code = 1
    elif any(a['status'] == 'unsure' for a in answers):
        code = 2
    else:
        code = 0
    report['exit'] = code
    return code, report


def _drop(copies):
    """Deletes the copies fetched only to hear a take (never one that was there before)."""
    for copy in copies:
        if copy.exists():
            try:
                copy.unlink()
            except OSError:
                pass


def parse_overrides(values, items):
    """--words NAME=FILE (or SHA=FILE), or --words FILE when only one
    recording is new: {sha256 or name: FILE}."""
    found = {}
    for value in values or []:
        key, sep, path = value.partition('=')
        if not sep:
            if len(items) != 1:
                raise MatchError('--words FILE alone needs exactly one new recording; give NAME=FILE')
            key, path = items[0]['sha256'] or items[0]['name'], value
        if not key.strip():
            raise MatchError('--words NAME=FILE needs the recording\'s name (or the start of its sha256) before the =')
        if not Path(path).is_file():
            raise MatchError(f'--words: {path} is not a file')
        match = [i for i in items if i['name'] == key or (i.get('sha256') or '').startswith(key.lower())]
        if not match:
            raise MatchError(f'--words: no new recording is called or hashed "{key}"')
        found[match[0]['sha256'] or match[0]['name']] = path
    return found


def default_inbox():
    inbox = os.environ.get('MINDMAKE_MEDIA_INBOX', '').strip()
    if inbox:
        return inbox
    try:
        return json.loads(STUDIO_CONFIG.read_text(encoding='utf-8')).get('runtime', {}).get('media_inbox') or ''
    except (OSError, ValueError, AttributeError):
        return ''


# ------------------------------------------------------------- self-test

def _prose(seed, n):
    """n words of made-up prose, the same every time for a seed."""
    vocabulary = [f'{a}{b}' for a in ('ba', 'ko', 'mi', 'su', 'te', 'ra', 'lo', 'vi', 'ne', 'du', 'fa', 'go', 'ha', 'ji', 'pe')
                  for b in ('n', 'r', 'l', 'st', 'mp', 'x', 'th', 'sk', 'rd', 'nt', 'lk', 'ff', 'ss', 'mb', 'zz', 'ck', 'w', 'y', 'p', 'g')]
    state, out = seed * 7919 + 17, []
    for _ in range(n):
        state = (state * 1103515245 + 12345) % (2 ** 31)
        out.append(vocabulary[state % len(vocabulary)])
    return out


def _heard(word_list, junk=0, slips=0):
    """What whisper might hear: a false start, and a word misheard now and then."""
    heard = [f'um{i}' for i in range(junk)] + list(word_list)
    if slips:
        heard = [w if (i + 1) % slips else 'mishear' for i, w in enumerate(heard)]
    return [{'w': w} for w in heard]


def self_test():
    fails, count = [], 0

    def check(label_, got, want):
        nonlocal count
        count += 1
        if got != want:
            fails.append(f'{label_}: got {got!r}, want {want!r}')

    # The port: the same words and the same similarity as candidates.ts.
    check('words: lower case, inner apostrophes and hyphens kept, money split', words("Warner's AI-made song, $150,000!"), ["warner's", 'ai-made', 'song', '150', '000'])
    check('words: a curly apostrophe is a word character too', words('Suno’s cut'), ['suno’s', 'cut'])
    check('ordered_similarity: two of three in order', ordered_similarity(list('abc'), list('ac')), 0.8)
    check('ordered_similarity: nothing against nothing is 0', ordered_similarity([], list('ab')), 0.0)
    check('ordered_similarity: the same is 1', ordered_similarity(list('abcd'), list('abcd')), 1.0)
    check('ordered_similarity: order counts', ordered_similarity(list('abcd'), list('dcba')), 0.25)

    mon_long = _prose(1, 450)
    mon_short = mon_long[:60] + _prose(2, 140)
    fri_long = _prose(3, 450)
    fri_short = fri_long[:200]  # a short cut that opens exactly as the long one does
    check('opening: the script read as written scores 1', opening_score(mon_long[:110], mon_long), 1.0)
    check('opening: a false start and some misheard words still clear the bar',
          opening_score(words(' '.join(w['w'] for w in _heard(mon_long[:110], junk=6, slips=9))), mon_long) >= 0.8, True)
    check('opening: another piece scores low', opening_score(mon_long[:110], fri_long) < 0.3, True)
    check('opening: too few words heard scores 0', opening_score(mon_long[:8], mon_long), 0.0)

    # The pieces, from the engine (a stand-in).
    MON, FRI, DONE, EARLY = ('f328382d-71b3-41a7-a221-d8615826f12e', '904658db-4df2-4537-a0ed-ebe93e081db7',
                             '5255dcd8-0000-4000-8000-000000000001', 'de5f0d87-0000-4000-8000-000000000002')
    claimed_sha, stale_sha = 'c' * 64, 'e' * 64
    mon_hashes = {'long': making.script_hash(' '.join(mon_long)), 'short': making.script_hash(' '.join(mon_short))}
    makings = {
        # Monday's record began on the 10th; its words last changed at 19:14 on the 11th; one long take of older words is on it.
        MON: {'making': {'workroom': {'url': 'https://claude.ai/artifact/m', 'at': '2026-10-10T09:00:00Z'},
                         'script_check': {'passed': True, 'checked_at': '2026-10-11T19:14:16Z', 'hashes': mon_hashes},
                         'pack': {'folder': '2026-10-12 Mon follow.the.money - Who gets paid for AI songs'},
                         'teleprompter': {'folder_id': '86B6F74B-2F8A-4477-AE44-8DA1119D1CD9', 'cuts': {
                             'long': {'script_id': '45F414D8-31E1-4B2D-BBE4-44EBA042B346', 'title': 'Mon 12 Oct - 3-minute - Who gets paid for AI songs'},
                             'short': {'script_id': 'ED3DE98A-7158-4448-A622-A2A5115FFA83', 'title': 'Mon 12 Oct - 90-second - Who gets paid for AI songs'}}},
                         'recordings': [{'cut': 'long', 'path': f'recordings/{stale_sha}.mp4', 'script_sha256': 'f' * 64}]},
              'steps': [{'key': 'scripts', 'state': 'done'}, {'key': 'record', 'state': 'now'}]},
        FRI: {'making': {'script_check': {'passed': True, 'checked_at': '2026-10-11T18:13:41Z'}, 'pack': {'folder': '2026-10-16 Fri mind.the.gap - Why so many AIs'}},
              'steps': [{'key': 'scripts', 'state': 'done'}, {'key': 'record', 'state': 'todo'}]},
        DONE: {'making': {'recordings': [{'cut': 'long', 'path': f'recordings/{claimed_sha}.mp4'}, {'cut': 'short', 'path': 'recordings/x.mp4'}]},
               'steps': [{'key': 'scripts', 'state': 'done'}, {'key': 'record', 'state': 'done'}]},
        EARLY: {'making': {}, 'steps': [{'key': 'scripts', 'state': 'todo'}, {'key': 'record', 'state': 'todo'}]},
    }
    weeks_asked, posts, board_posts = [], [], []
    board_lanes = {}  # the board as the engine holds it: item id to lane

    def fake(method, path, body):
        if method == 'GET' and path == BOARD_PATH:
            return 200, json.dumps({'ok': True, 'items': [{'id': k, 'lane': v} for k, v in board_lanes.items()]})
        if method == 'POST' and path == BOARD_PATH:
            board_posts.append(body)
            for i in body['items']:
                board_lanes[i['id']] = i.get('lane') or board_lanes.get(i['id']) or i.get('lane_if_new')
            return 200, json.dumps({'ok': True, 'written': [i['id'] for i in body['items']]})
        if method == 'POST':
            posts.append((path, body))
            return 200, json.dumps({'ok': True, 'steps': []})
        if path.startswith('/api/week/options'):
            weeks_asked.append(path.split('=')[1])
            return 200, json.dumps({'ok': True, 'series': [
                {'slug': 'follow_the_money', 'in_flight': [{'id': MON, 'idea': 'Suno', 'state': 'review', 'scheduled_for': '2026-10-12'}, {'id': DONE, 'state': 'approved', 'scheduled_for': None}]},
                {'slug': 'mind_the_gap', 'in_flight': [{'id': FRI, 'idea': 'Menus', 'state': 'review', 'scheduled_for': '2026-10-16'}, {'id': EARLY, 'state': 'drafting', 'scheduled_for': '2026-10-14'}, {'id': 'not-a-uuid'}]}]})
        if path.startswith('/api/content-ideas?id='):
            return 200, json.dumps({'ok': True, 'piece': {'id': path.split('=')[1]}})
        pid = path.split('/')[3]
        return 200, json.dumps({'ok': True, **makings[pid]})

    pieces, claimed = waiting_pieces(fake, week_monday('2026-10-14'))
    check('weeks: this one and the next, from any day of the week', weeks_asked, ['2026-10-12', '2026-10-19'])
    check('waiting: scripts done and record not, the nearest first', [p['id'] for p in pieces], [MON, FRI])
    check('claimed: a recording already on any piece is not new', claimed, {claimed_sha, stale_sha})
    check('a piece is named by its day and its subject', label(pieces[0]), 'Mon 12 Oct "Who gets paid for AI songs"')
    check('waiting: a take of an older script leaves its cut still to record', (pieces[0]['recorded'], pieces[1]['recorded']), ([], []))
    check('waiting: each piece carries its scripts\' hashes (none on a record from before them)', (pieces[0]['hashes'], pieces[1]['hashes']), (mon_hashes, {}))
    check('waiting: a piece\'s record began at its earliest step', (pieces[0]['began'], pieces[1]['began']), ('2026-10-10T09:00:00Z', '2026-10-11T18:13:41Z'))
    check('take_counts: no hash, no current hash, or the same script', [take_counts(r, {'long': 'a' * 64}) for r in
          ({'cut': 'long'}, {'cut': 'long', 'script_sha256': 'a' * 64}, {'cut': 'long', 'script_sha256': 'b' * 64}, {'cut': 'short', 'script_sha256': 'b' * 64})],
          [True, True, False, True])

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        # The scripts: post.json's own file, the pack, the draft beside the plan, the engine.
        plans = tmp / 'plans'
        (plans / '2026-10-12-monday').mkdir(parents=True)
        (plans / '2026-10-12-monday' / 'post.json').write_text(json.dumps({'piece_id': MON, 'files': [
            {'kind': 'video-script', 'file': 'script.md', 'cut': 'long'},
            {'kind': 'video-script', 'file': 'script-90s.md', 'name': 'video-script-90-seconds.md', 'cut': 'short'}]}))
        (plans / '2026-10-12-monday' / 'script.md').write_text(' '.join(mon_long), encoding='utf-8')
        (plans / '2026-10-12-draft-script-90s.md').write_text(' '.join(mon_short), encoding='utf-8')
        library_posts = tmp / 'library' / POSTS
        fri_video = library_posts / '2026-10-16 Fri mind.the.gap - Why so many AIs' / VIDEO
        fri_video.mkdir(parents=True)
        (fri_video / 'video-script.md').write_text(' '.join(fri_long), encoding='utf-8')
        found = scripts_for(pieces[0], plans, [library_posts])
        check('scripts: the long from beside post.json', (found['long']['from'].endswith('2026-10-12-monday/script.md'), words(found['long']['text'])), (True, mon_long))
        check('scripts: the short from the draft beside the plan', found['short']['from'].endswith('2026-10-12-draft-script-90s.md'), True)
        found = scripts_for(pieces[1], plans, [library_posts])
        check('scripts: the long from the pack in the library, by its folder', found['long']['from'].endswith(f'{VIDEO}/video-script.md'), True)
        check('scripts: nothing is read from the engine; a script found nowhere is missing', 'short' in found, False)
        check('scripts: none at all is an empty answer, not an error', scripts_for({'id': EARLY}, plans, [library_posts]), {})
        check('scripts: the dead engine fallback is gone', ('OUTPUT_KEYS' in globals(), 'transformed_outputs' in Path(__file__).read_text(encoding='utf-8').split('def scripts_for', 1)[1].split('def engine_recordings', 1)[0]), (False, False))
        # The words the record says are current win over a stale copy: a pack in Drive or an old checkout.
        (plans / '2026-10-12-monday' / 'script.md').write_text('An older long script, read this morning.\n', encoding='utf-8')
        (plans / '2026-10-12-draft-script.md').write_text(' '.join(mon_long), encoding='utf-8')
        found = scripts_for(pieces[0], plans, [library_posts], show=None)
        check('scripts: the copy with the record\'s words wins over the first found, and is marked current',
              (found['long']['from'].endswith('2026-10-12-draft-script.md'), found['long']['current'], words(found['long']['text'])), (True, True, mon_long))
        (plans / '2026-10-12-draft-script.md').write_text('An older long script, read this morning.\n', encoding='utf-8')
        on_main = lambda place: ' '.join(mon_long) if Path(place).name == '2026-10-12-draft-script.md' else None
        found = scripts_for(pieces[0], plans, [library_posts], show=on_main)
        check('scripts: with no current copy here, the one committed on main is used',
              (found['long']['from'].endswith('2026-10-12-draft-script.md (as committed on main)'), found['long']['current']), (True, True))
        found = scripts_for(pieces[0], plans, [library_posts], show=None)
        check('scripts: with no current copy anywhere, the first found is used and said not current',
              (found['long']['from'].endswith('2026-10-12-monday/script.md'), found['long']['current']), (True, False))
        on_main_now = committed(REPO / 'scripts' / 'post-pack' / 'making.py')  # None where main is not fetched (a CI checkout of one commit)
        check('scripts: a file in the repository is read as committed on main', on_main_now is None or 'def post(' in on_main_now, True)
        check('scripts: a file outside the repository is never asked of git', committed(tmp / 'x.md'), None)
        (plans / '2026-10-12-monday' / 'script.md').write_text(' '.join(mon_long), encoding='utf-8')
        scripts = {MON: {'long': {'text': ' '.join(mon_long)}, 'short': {'text': ' '.join(mon_short)}},
                   FRI: {'long': {'text': ' '.join(fri_long)}, 'short': {'text': ' '.join(fri_short)}}}

        # A take named after its Teleprompter script: that piece and cut, whatever the words' bar.
        check('waiting: each piece carries its Teleprompter scripts\' titles', (pieces[0]['titles']['long'], pieces[1].get('titles')),
              ('Mon 12 Oct - 3-minute - Who gets paid for AI songs', {}))
        stale_words = _heard(fri_long[:110])  # Friday's long words: surely another piece's
        named_take = {'name': 'Mon 12 Oct - 3-minute - Who gets paid for AI songs.mp4', 'at': '2026-10-12T16:20:00Z'}
        low = {MON: {'long': {'text': 'Something else entirely, said this morning, ' * 20}, 'short': {'text': 'Another thing, ' * 30}}}
        a = decide(named_take, _heard(mon_long[:110]), 184.0, pieces[:1], low)
        check('title: the file named after the long script is the long cut, its words below the bar',
              (a['status'], a.get('piece_id'), a.get('cut'), a.get('by'), a['score'] < SURE), ('placed', MON, 'long', 'title', True))
        check('title: said plainly', plain({**a, 'name': named_take['name']}, pieces).startswith(
            'placed: "Mon 12 Oct - 3-minute - Who gets paid for AI songs.mp4" is the long cut of Mon 12 Oct "Who gets paid for AI songs": its name is the title'), True)
        a = decide({**named_take, 'name': 'mon 12 oct - 90-second - who gets paid for AI songs (1).MOV'}, _heard(mon_short[:110]), 95.0, pieces, scripts)
        check('title: any case, and a copy number, still the title', (a['status'], a.get('cut'), a.get('by')), ('placed', 'short', 'title'))
        a = decide(named_take, _heard(mon_long[:110]), 95.0, pieces, scripts)
        check('title: a length that is surely the other cut is unsure', (a['status'], 'which is a short take' in a.get('reason', '')), ('unsure', True))
        a = decide(named_take, stale_words, 184.0, pieces, scripts)
        check('title: words that are surely another piece\'s are unsure', (a['status'], 'but its words are' in a.get('reason', '')), ('unsure', True))
        check('title: a name that is no script\'s title decides nothing', titled('Mon 12 Oct - 3-minute.mp4', pieces), None)

        # Deciding one file.
        take = {'name': 'take.mp4', 'at': '2026-10-12T08:00:00Z'}
        a = decide(take, _heard(mon_long[:110], junk=5, slips=11), 172.0, pieces, scripts)
        check('decide: Monday\'s long take, by its words, its length agreeing', (a['status'], a.get('piece_id', ''), a.get('cut', ''), a.get('by', '')), ('placed', MON, 'long', 'words'))
        a = decide(take, _heard(mon_short[:110]), 98.0, pieces, scripts)
        check('decide: Monday\'s short take, where the short script parts from the long', (a['status'], a.get('cut', ''), a.get('by', '')), ('placed', 'short', 'words'))
        a = decide(take, _heard(fri_long[:110]), 171.0, pieces, scripts)
        check('decide: two scripts that open the same are told apart by length (long)', (a['status'], a.get('piece_id', ''), a.get('cut', ''), a.get('by', '')), ('placed', FRI, 'long', 'length'))
        a = decide(take, _heard(fri_long[:110]), 104.0, pieces, scripts)
        check('decide: ... and (short)', (a['status'], a.get('cut', ''), a.get('by', '')), ('placed', 'short', 'length'))
        a = decide(take, _heard(fri_long[:110]), 142.0, pieces, scripts)
        check('decide: a length between the two is unsure', (a['status'], 'between a long take (2:30 and over) and a short one (2:15 and under)' in a.get('reason', '')), ('unsure', True))
        a = decide({'name': 'friday short.mov', 'at': take['at']}, _heard(fri_long[:110]), 142.0, pieces, scripts)
        check('decide: ... unless the file name says which', (a['status'], a.get('cut', ''), a.get('by', '')), ('placed', 'short', 'name'))
        a = decide(take, _heard(mon_long[:110]), 100.0, pieces, scripts)
        check('decide: words and length that disagree are unsure', (a['status'], "Monday" in a.get('reason', '') or 'Mon 12 Oct' in a.get('reason', ''), 'runs 1:40' in a.get('reason', '')), ('unsure', True, True))
        a = decide(take, _heard(mon_long[:110]), None, pieces, scripts)
        check('decide: a length that cannot be read is unsure, never guessed', (a['status'], 'ffprobe' in a.get('reason', '')), ('unsure', True))
        a = decide(take, _heard(_prose(9, 110)), 170.0, pieces, scripts)
        check('decide: an opening that matches no piece is unsure', (a['status'], '0.72 needed' in a.get('reason', ''), a.get('piece_id')), ('unsure', True, None))
        twin = dict(pieces[1], id='11111111-2222-4333-8444-555555555555', folder='2026-10-19 Mon follow.the.money - A twin')
        a = decide(take, _heard(fri_long[:110]), 171.0, pieces + [twin], {**scripts, twin['id']: scripts[FRI]})
        check('decide: two pieces within 0.15 of each other are unsure, and both are named', (a['status'], 'Why so many AIs' in a.get('reason', '') and 'A twin' in a.get('reason', '')), ('unsure', True))
        a = decide(take, _heard(mon_long[:6]), 170.0, pieces, scripts)
        check('decide: too little speech is unsure', (a['status'], 'too little speech' in a.get('reason', '')), ('unsure', True))
        a = decide(dict(take, max_db=-91.0), _heard(mon_long[:6]), 118.8, pieces, scripts)
        check('decide: a take with a silent sound track says so, and points at the mic\'s own file',
              (a['status'], a.get('silent'), 'sound is silent' in a.get('reason', ''), 'sync_audio.py' in a.get('reason', '')), ('unsure', True, True, True))
        done_long = [dict(pieces[0], recorded=['long']), pieces[1]]
        a = decide(take, _heard(mon_long[:110]), 172.0, done_long, scripts)
        check('decide: a new take of a cut already recorded is left for Krish', (a['status'], 'already recorded' in a.get('reason', '')), ('unsure', True))
        check('the time rule: a take that arrived before a piece\'s scripts were checked is not that piece\'s',
              [p['id'] for p in eligible_for({'at': '2026-10-11T18:30:00Z'}, pieces)], [FRI])
        check('the time rule: a take from 6 October belongs to neither', eligible_for({'at': '2026-10-06T21:53:00Z'}, pieces), [])
        check('the time rule: a take from after a record began but before its words last changed is heard for it',
              [p['id'] for p in predated_by({'at': '2026-10-11T08:00:00Z'}, pieces)], [MON])
        check('the time rule: ... and one from before any record began is heard for none', predated_by({'at': '2026-10-06T21:53:00Z'}, pieces), [])
        # The second reviewer's case: only the long script changed after the two takes arrived.
        per_cut = [dict(pieces[0], checked_at='2026-10-12T12:00:00Z', changed_at={'long': '2026-10-12T12:00:00Z', 'short': '2026-10-11T19:14:16Z'})]
        a_long = older_words({**decide(take, _heard(mon_long[:110]), 172.0, per_cut, scripts), 'name': 'IMG_4471.mov'}, {'at': '2026-10-12T11:00:00Z'},
                             predated_by({'at': '2026-10-12T11:00:00Z'}, per_cut), per_cut)
        a_short = older_words({**decide(take, _heard(mon_short[:110]), 98.0, per_cut, scripts), 'name': 'IMG_4472.mov'}, {'at': '2026-10-12T11:00:00Z'},
                              predated_by({'at': '2026-10-12T11:00:00Z'}, per_cut), per_cut)
        check('the time rule, cut by cut: a long script change asks about the long take and places the short one of unchanged words',
              ((a_long['status'], a_long.get('older_script')), (a_short['status'], a_short.get('cut'))), (('unsure', True), ('placed', 'short')))
        made_before = older_words({**decide(take, _heard(mon_long[:110]), 172.0, per_cut, scripts), 'name': 'late.mov', 'recorded_at': '2026-10-12T11:30:00Z'},
                                  {'at': '2026-10-12T13:00:00Z'}, [], per_cut)
        check('a take recorded before its cut changed, though it reached the engine after, is asked about (its file\'s own time)',
              (made_before['status'], 'was recorded 2026-10-12 11:30' in made_before.get('reason', '')), ('unsure', True))
        wrong_clock = older_words({**decide(take, _heard(mon_long[:110]), 172.0, per_cut, scripts), 'name': 'clock.mov', 'recorded_at': '2001-01-01T00:00:00Z'},
                                  {'at': '2026-10-12T13:00:00Z'}, [], per_cut)
        check('a file time from before the record began (a wrong clock) is ignored: it is placed on its arrival', wrong_clock['status'], 'placed')
        check('a record\'s fixed started_at is when it began, however its steps move later',
              began_at({'started_at': '2026-10-10T09:00:00Z', 'workroom': {'at': '2026-10-12T12:00:00Z'}, 'pack': {'packed_at': '2026-10-12T12:00:00Z'}}),
              '2026-10-10T09:00:00Z')
        a = older_words({**decide(take, _heard(mon_long[:110]), 172.0, pieces[:1], scripts), 'name': 'x.mp4'}, {'at': '2026-10-11T08:00:00Z'}, pieces[:1], pieces[:1])
        check('older words: a match on a piece whose words changed after it arrived is unsure, and says so',
              (a['status'], a.get('older_script'), BEFORE_CHANGE in a.get('reason', ''), 'long cut' in a.get('reason', '')), ('unsure', True, True, True))
        a = older_words({**decide(take, _heard(_prose(9, 110)), 170.0, pieces[:1], scripts), 'name': 'x.mp4'}, {'at': '2026-10-11T08:00:00Z'}, pieces[:1], pieces[:1])
        check('older words: no match on the pieces it predates is left alone', (a['status'], 'matches none' in a.get('reason', '')), ('old', True))

        # The Inbox on a runner machine: the top level only, as the upload reads it.
        inbox = tmp / 'Inbox'
        (inbox / 'Inspiration').mkdir(parents=True)
        for name in ('who gets paid.mp4', '.hidden.mp4', INBOX_MARKER, 'notes.txt', 'just dropped.mov', 'NOEXT'):
            (inbox / name).write_bytes(name.encode())
        (inbox / 'Inspiration' / 'deep.mp4').write_bytes(b'deep')
        old = time.time() - 3600
        for name in ('who gets paid.mp4', '.hidden.mp4', INBOX_MARKER, 'notes.txt', 'NOEXT'):
            os.utime(inbox / name, (old, old))
        listed = inbox_recordings(inbox, tmp / 'cache')
        check('inbox: recordings at the top level only, no dotfile, marker, text or subfolder', sorted(i['name'] for i in listed), ['just dropped.mov', 'who gets paid.mp4'])
        check('inbox: a file changed in the last two minutes is still arriving', [i['name'] for i in listed if i.get('settling')], ['just dropped.mov'])
        check('inbox: the sha256 of a settled file', [i['sha256'] for i in listed if i['name'] == 'who gets paid.mp4'], [hashlib.sha256(b'who gets paid.mp4').hexdigest()])
        (inbox / 'who gets paid.mp4').rename(inbox / 'renamed.mp4')
        os.utime(inbox / 'renamed.mp4', (old, old))
        inbox_recordings(inbox, tmp / 'cache')
        check('inbox: the remembered hashes follow what is in the Inbox now', [k.split('|')[0] for k in json.loads((tmp / 'cache' / 'inbox-sha256.json').read_text())], ['renamed.mp4'])
        (inbox / 'renamed.mp4').rename(inbox / 'who gets paid.mp4')
        check('inbox: the hash is remembered in .cache, never in the Inbox', ((tmp / 'cache' / 'inbox-sha256.json').is_file(), sorted(p.name for p in inbox.iterdir())),
              (True, sorted(['who gets paid.mp4', '.hidden.mp4', INBOX_MARKER, 'notes.txt', 'just dropped.mov', 'NOEXT', 'Inspiration'])))

        # The whole run, every outside thing a stand-in.
        def item(name, data, at):
            return {'name': name, 'sha256': hashlib.sha256(data).hexdigest(), 'uploaded_at': at, 'bytes': len(data),
                    'download': {'url': f'https://store.invalid{recording.DOWNLOAD_PATH}x'}}
        listing = [item('who gets paid.mp4', b'old launch take', '2026-10-06T21:53:00Z'),
                   item('monday long.mp4', b'mon long', '2026-10-12T08:00:00Z'),
                   item('IMG_0001.mov', b'fri short', '2026-10-12T08:10:00Z'),
                   item('IMG_0000.mov', b'fri short, first try', '2026-10-12T08:05:00Z'),
                   {**item('claimed.mp4', b'x', '2026-10-12T08:20:00Z'), 'sha256': claimed_sha}]
        heard_text = {'monday long.mp4': (_heard(mon_long[:110], junk=4, slips=12), 174.0),
                      'IMG_0001.mov': (_heard(fri_long[:110]), 96.0), 'IMG_0000.mov': (_heard(fri_long[:110]), 101.0)}
        heard_calls = []

        def stub_transcribe(src):
            heard_calls.append(src)
            return heard_text.get(src, ([], None))[0]

        lines = []
        common = dict(get_file=lambda i, cache: i['name'], transcribe=stub_transcribe, probe=lambda src: heard_text.get(src, ([], None))[1],
                      out=lines.append, cache=tmp / 'cache', plans=plans, roots=[library_posts])
        code, report = run({'week': '2026-10-12', 'by': 'Codex'}, fake, lambda: engine_recordings(listing), **common)
        status = {f['name']: (f['status'], f.get('cut')) for f in report['files']}
        check('run: every new take is placed, so the exit is 0', code, 0)
        check('run: a new take of a cut whose take on the record is of older words replaces it; nothing is asked about the old one',
              [f['name'] for f in report['files'] if f['source'] == 'record'], [])
        check('run: a take from before every record began, and the claimed one, are never heard',
              (status.get('who gets paid.mp4'), 'claimed.mp4' in status, sorted(map(str, heard_calls))), (('old', None), False, ['IMG_0000.mov', 'IMG_0001.mov', 'monday long.mp4']))
        check('run: Monday long and Friday short placed; the older Friday take named and left alone',
              (status.get('monday long.mp4'), status.get('IMG_0001.mov'), status.get('IMG_0000.mov')), (('placed', 'long'), ('placed', 'short'), ('older take', 'short')))
        check('run: without --record, nothing is written and the command is given', (posts, any(line.startswith('to record it: python scripts/post-pack/making.py --by "Codex" ' + MON + ' recorded long "recordings/') for line in lines)), ([], True))
        check('run: one plain line per file', sum(1 for line in lines if line.split(':')[0] in ('placed', 'unsure', 'left alone', 'failed')), 4)
        check('run: the hearing is cached by sha256', (tmp / 'cache' / f'{hashlib.sha256(b"mon long").hexdigest()}.head.words.json').is_file(), True)
        # The lane keeps no copy of a take it downloaded only to hear it.
        fetching = dict(common, get_file=lambda i, cache: local_copy(i, cache, fetch=lambda url, handle: handle.write(
            {'monday long.mp4': b'mon long', 'IMG_0001.mov': b'fri short', 'IMG_0000.mov': b'fri short, first try'}[i['name']])))
        kept_by = tmp / 'kept'
        kept_by.mkdir()
        (kept_by / 'IMG_0000.mov').write_bytes(b'fri short, first try')  # a copy a session fetched on purpose
        run({'week': '2026-10-12', 'board': True, 'by': 'Recordings lane'}, fake, lambda: engine_recordings(listing), **{**fetching, 'cache': kept_by})
        check('--board: a take downloaded only to hear it is deleted once heard; a copy that was there before is kept; the words stay cached',
              (sorted(p.name for p in kept_by.iterdir() if not p.name.endswith('.json')),
               len([p for p in kept_by.iterdir() if p.name.endswith('.head.words.json')])), (['IMG_0000.mov'], 3))
        board_posts.clear()
        run({'week': '2026-10-12', 'by': 'Codex'}, fake, lambda: engine_recordings(listing), **{**fetching, 'cache': tmp / 'session'})
        check('without --board (a session), the downloaded takes are kept', sorted(p.name for p in (tmp / 'session').iterdir() if not p.name.endswith('.json')),
              ['IMG_0000.mov', 'IMG_0001.mov', 'monday long.mp4'])
        heard_calls.clear()
        lines.clear()
        code, report = run({'week': '2026-10-12', 'by': 'Codex', 'record': True}, fake, lambda: engine_recordings(listing), **common)
        check('run again: the cache is used, nothing is heard twice', heard_calls, [])
        check('--record: one write per placed take, by Codex, the engine copy, its length and the script it was taken from',
              [(p.split('/')[3], b['by'], b['recordings']) for p, b in posts],
              [(MON, 'Codex', [{'cut': 'long', 'path': f'recordings/{hashlib.sha256(b"mon long").hexdigest()}.mp4', 'seconds': 174,
                                'script_sha256': mon_hashes['long']}]),
               (FRI, 'Codex', [{'cut': 'short', 'path': f'recordings/{hashlib.sha256(b"fri short").hexdigest()}.mov', 'seconds': 96}])])
        check('--record: no board item without --board', board_posts, [])
        check('--record: the report lists what was written', [(r['cut'], r['by']) for r in report['recorded']], [('long', 'Codex'), ('short', 'Codex')])

        # Unsure: one file between the two lengths, so the run says so and exits 2.
        posts.clear()
        heard_text['IMG_0001.mov'] = (_heard(fri_long[:110]), 140.0)
        lines.clear()
        code, report = run({'week': '2026-10-12', 'record': True}, fake, lambda: engine_recordings(listing[:3]), **{**common, 'cache': tmp / 'cache2'})
        check('unsure: exit 2', code, 2)
        check('unsure: the sure one is still recorded, the unsure one is not', [b['recordings'][0]['cut'] for _, b in posts], ['long'])
        check('unsure: said in one plain line naming the file', next((line for line in lines if line.startswith('unsure:')), '').startswith('unsure: "IMG_0001.mov": it is Fri 16 Oct "Why so many AIs", but it runs 2:20'), True)
        check('--by left out: MAKING_BY, else Claude Code', posts[0][1]['by'], making.who(None))

        # The time rule in a whole run: Monday's words changed at 19:14 on the 11th, after these takes arrived.
        posts.clear()
        heard_text.update({'early monday long.mp4': (_heard(mon_long[:110]), 175.0), 'early other.mp4': (_heard(_prose(11, 110)), 170.0),
                           'evening monday long.mp4': (_heard(mon_long[:110], junk=3), 176.0)})
        early = [item('early monday long.mp4', b'early mon long', '2026-10-11T08:00:00Z'),
                 item('early other.mp4', b'early other', '2026-10-11T08:30:00Z'),
                 item('evening monday long.mp4', b'evening mon long', '2026-10-11T18:30:00Z')]
        lines.clear()
        code, report = run({'week': '2026-10-12', 'record': True, 'by': 'Recordings lane'}, fake, lambda: engine_recordings(early), **{**common, 'cache': tmp / 'cache5'})
        status = {f['name']: (f['status'], f.get('older_script', False)) for f in report['files']}
        check('time rule: a take of Monday\'s older words is heard and asked about, never placed or left alone (exit 2)',
              (code, status.get('early monday long.mp4'), status.get('evening monday long.mp4'), posts), (2, ('unsure', True), ('unsure', True), []))
        check('time rule: one that matches nothing it could be is heard, then left alone', status.get('early other.mp4'), ('old', False))
        check('time rule: the line says it was recorded before the script last changed',
              any(line.startswith('unsure: "early monday long.mp4": it is Mon 12 Oct "Who gets paid for AI songs"\'s long cut, but it was recorded before the script last changed') for line in lines), True)

        # --board: one item per unsure take, once for each reason, and the answered book.
        board = tmp / 'board-cache'
        code, report = run({'week': '2026-10-12', 'record': True, 'board': True, 'by': 'Recordings lane'}, fake, lambda: engine_recordings(early), **{**common, 'cache': board})
        sent = [i for b in board_posts for i in b['items']]
        early_sha = hashlib.sha256(b'early mon long').hexdigest()
        check('--board: one item for each unsure take, the older take already on the record too, as the runner',
              ([b['client'] for b in board_posts], sorted(i['id'] for i in sent), code),
              (['runner'], sorted([f'take-{early_sha[:12]}', f'take-{hashlib.sha256(b"evening mon long").hexdigest()[:12]}', f'take-{stale_sha[:12]}']), 2))
        stale_item = next(i for i in sent if i['id'] == f'take-{stale_sha[:12]}')
        check('--board: the take on the record of older words: use it or record again, on Monday, by its record path',
              (stale_item.get('idea_id'), 'use it' in stale_item['detail'], f'recordings/{stale_sha}.mp4' in stale_item['detail'],
               'no longer counts' in stale_item['detail']),
              (MON, True, True, True))
        first_item = next(i for i in sent if i['id'] == f'take-{early_sha[:12]}')
        check('--board: held for a session (a new item\'s lane), never on Krish\'s list, tied to Monday, ended when the take is placed, '
              'with no reply asked of him: a session asks him in its reply',
              (first_item.get('lane_if_new'), 'lane' in first_item, [k for k in ('only_you', 'link', 'link_label', 'prompt') if k in first_item],
               first_item.get('idea_id'), first_item['closes_on'], 'Reply' in first_item['detail'], 'asks Krish in its reply' in first_item['detail']),
              ('in_progress', False, [], MON, 'take_placed', False, True))
        check('--board: the item says what happened and what to answer', ('recorded before the script last changed' in first_item['detail'], f'recordings/{early_sha}.mp4' in first_item['detail'],
                                                                           len(first_item['title']) <= 200, len(first_item['detail']) <= 2000), (True, True, True, True))
        book = load_answered(board)
        check('--board: the answered book holds the questions, each with its piece and whether it is about older words; '
              'a take left alone as old is not booked, so the upload looks at it again later',
              sorted((v['status'], v.get('item', ''), v.get('older_script')) for v in book.values()),
              sorted([('unsure', f'take-{early_sha[:12]}', True), ('unsure', f'take-{hashlib.sha256(b"evening mon long").hexdigest()[:12]}', True),
                      ('unsure', f'take-{stale_sha[:12]}', True)]))
        board_posts.clear()
        lines.clear()
        run({'week': '2026-10-12', 'board': True, 'by': 'Codex'}, fake, lambda: engine_recordings(early), **{**common, 'cache': board})
        check('--board: asked once; the same question is not asked again', (board_posts, sum(1 for line in lines if line.startswith('already asked'))), ([], 3))
        book[early_sha]['reason'] = 'its opening matches no waiting piece well enough (closest at 0.65)'
        save_answered(board, book)
        run({'week': '2026-10-12', 'board': True, 'by': 'Codex'}, fake, lambda: engine_recordings(early), **{**common, 'cache': board})
        check('--board: a reason that shifts (a score, the closest piece) asks nothing again (the second reviewer\'s case)', board_posts, [])
        book[early_sha]['piece_id'] = FRI
        save_answered(board, book)
        run({'week': '2026-10-12', 'board': True, 'by': 'Codex'}, fake, lambda: engine_recordings(early), **{**common, 'cache': board})
        check('--board: a new question (another piece) asks again, as Codex, on the open item, without its lane',
              [(b['client'], [(i['id'], 'lane' in i, 'lane_if_new' in i) for i in b['items']]) for b in board_posts],
              [('codex', [(f'take-{early_sha[:12]}', False, False)])])
        board_posts.clear()
        # Krish answers "not a piece" and a session closes the item: on the other machine (a fresh cache), it is never reopened.
        board_lanes[f'take-{early_sha[:12]}'] = 'done'
        lines.clear()
        run({'week': '2026-10-12', 'board': True, 'by': 'Recordings lane'}, fake, lambda: engine_recordings(early), **{**common, 'cache': tmp / 'other-machine'})
        sent_ids = [i['id'] for b in board_posts for i in b['items']]
        check('--board: an item closed on the board is not reopened from the other machine, and is booked there',
              (f'take-{early_sha[:12]}' in sent_ids, any(line.startswith('not asked again') for line in lines),
               load_answered(tmp / 'other-machine').get(early_sha, {}).get('item')), (False, True, f'take-{early_sha[:12]}'))
        board_posts.clear()
        refusing = lambda m, p, b: (500, '{"ok": false}') if p == BOARD_PATH else fake(m, p, b)
        code, report = run({'week': '2026-10-12', 'board': True}, refusing, lambda: engine_recordings(early), **{**common, 'cache': tmp / 'board-refused'})
        check('--board: a board that refuses is a failure (exit 1), and nothing is booked as asked',
              (code, [v['status'] for v in load_answered(tmp / 'board-refused').values()]), (1, []))
        placed_sha = hashlib.sha256(b'mon long').hexdigest()
        save_answered(board, {**load_answered(board), placed_sha: {'status': 'unsure', 'reason': 'x', 'name': 'monday long.mp4'}})
        run({'week': '2026-10-12', 'board': True}, fake, lambda: engine_recordings(listing[1:2]), **{**common, 'cache': board})
        check('--board: a take placed since leaves the answered book', placed_sha in load_answered(board), False)
        check('board_client: Codex, Claude Code, else the runner', [board_client(n) for n in ('Codex', 'Claude Code', 'Recordings lane')], ['codex', 'claude_code', 'runner'])

        # Nothing Krish can press answers which take it is, so every take
        # question is held for a session, never on his list; its title says
        # what is known, and one with no piece says the lane lets it go.
        lost = {'sha256': '5' * 64, 'name': 'lost.mp4', 'at': '2026-10-12T09:00:00Z', 'status': 'unsure',
                'reason': 'its opening matches no waiting piece well enough (closest at 0.40)', 'closest': FRI, 'score': 0.4}
        held_item = board_item(lost, [{'id': MON}, {'id': FRI}])
        check('board_item: no piece is held for a session, with nothing that would put it on him, and says the lane lets it go',
              (held_item['lane'], [k for k in ('only_you', 'link', 'idea_id', 'prompt') if k in held_item], 'Held for a session' in held_item['detail'],
               'after a week that no session touches it' in held_item['detail'], held_item['title']),
              ('in_progress', [], True, True, 'Which piece and cut is the take "lost.mp4"?'))
        known = {**lost, 'piece_id': MON, 'reason': 'it looks like a new take of Monday\'s long cut, which is already recorded; left alone', 'cut': 'long'}
        check('board_item: a piece and cut already known is never asked as "which piece and cut"',
              [board_item(a, [{'id': MON}, {'id': FRI}])['title'] for a in (known, {k: v for k, v in known.items() if k != 'cut'})],
              ['Use the new take "lost.mp4" of the long cut, which is already recorded?', 'Which cut is the take "lost.mp4"?'])
        board_posts.clear()
        board_lanes.pop(held_item['id'], None)
        making.board_upsert([held_item], fake, 'Recordings lane')
        check('board: a new item with no piece goes in progress', (board_posts[-1]['items'][0].get('lane_if_new'), board_lanes[held_item['id']]), ('in_progress', 'in_progress'))
        tied_item = board_item({**lost, 'piece_id': MON}, [{'id': MON}, {'id': FRI}])
        making.board_upsert([tied_item], fake, 'Codex')
        sent_tied = board_posts[-1]['items'][0]
        check('board: tied to a piece later, the held item names its piece, so the check can close it, and stays off his list',
              (sent_tied.get('lane'), sent_tied.get('only_you'), sent_tied.get('idea_id'), board_lanes[held_item['id']]),
              (None, None, MON, 'in_progress'))
        # One the old lane put on him is moved off his list when it is asked again.
        board_lanes[held_item['id']] = 'on_you'
        making.board_upsert([tied_item], fake, 'Recordings lane')
        check('board: a take question on his list (the old lane wrote them there) moves off it when asked again',
              (board_posts[-1]['items'][0].get('lane'), board_lanes[held_item['id']]), ('in_progress', 'in_progress'))
        board_posts.clear()

        # The lane closes nothing. Once a question is gone it says so: a
        # placed take needs no word (the done-check sweep sees it on its
        # piece), and one no waiting piece can be is noted, so the sweep lets
        # it go. One Krish or a session closed is left, and one still unsure
        # is left too.
        ends = tmp / 'ends-cache'
        shas = {k: hashlib.sha256(k.encode()).hexdigest() for k in ('placed', 'gone', 'waiting', 'closed')}
        save_answered(ends, {sha: {'status': 'unsure', 'reason': 'x', 'name': f'{k}.mp4', 'item': f'take-{sha[:12]}',
                                   'piece_id': None, 'older_script': False, 'at': '2026-10-01T09:00:00Z'} for k, sha in shas.items()})
        for k, sha in shas.items():
            board_lanes[f'take-{sha[:12]}'] = 'done' if k == 'closed' else 'in_progress'
        heard = [{'sha256': shas['placed'], 'name': 'placed.mp4', 'status': 'placed'}, {'sha256': shas['gone'], 'name': 'gone.mp4', 'status': 'old'},
                 {'sha256': shas['closed'], 'name': 'closed.mp4', 'status': 'old'}]
        lines.clear()
        board_posts.clear()
        asked, noted, failed = ask_on_board(heard, [{'id': MON}], fake, 'Recordings lane', ends, lines.append, now='2026-10-12T09:00:00Z')
        item_of = lambda k: f'take-{shas[k][:12]}'
        check('ask_on_board: an old take is noted, never closed; a placed one, one still unsure and one Krish or a session closed get nothing',
              (noted, [board_lanes[item_of(k)] for k in ('placed', 'gone', 'waiting', 'closed')], failed,
               [(i['id'], i.get('lane'), i.get('close_ref')) for i in board_posts[-1]['items']], len(board_posts), board_posts[-1]['client']),
              ([item_of('gone')], ['in_progress', 'in_progress', 'in_progress', 'done'], False,
               [(item_of('gone'), None, {'no_piece': True})], 1, 'runner'))
        book = load_answered(ends)
        check('ask_on_board: the ended takes leave the book, so the upload looks at an old one again later; the one still unsure stays',
              sorted(k for k, sha in shas.items() if sha in book), ['waiting'])
        check('ask_on_board: each ending says why', sorted(line.split(': ', 1)[0] for line in lines if line.startswith(('placed:', 'noted on the board:'))),
              ['noted on the board', 'placed'])
        board_posts.clear()
        ask_on_board(heard, [{'id': MON}], fake, 'Recordings lane', ends, lines.append, now='2026-10-12T10:00:00Z')
        check('ask_on_board: a question ended is not noted again', board_posts, [])

        # Takes place themselves (place-takes.yml): --record --board --clock. The aligner is a stand-in.
        events, before_posts = [], len(posts)
        was_heard, heard_text['IMG_0001.mov'] = heard_text['IMG_0001.mov'], (_heard(fri_long[:110]), 96.0)
        by_name = lambda src: heard_text.get(Path(src).name, ([], None))
        fetching = dict(fetching, transcribe=lambda src: by_name(src)[0], probe=lambda src: by_name(src)[1])
        mon_sha, fri_sha = hashlib.sha256(b'mon long').hexdigest(), hashlib.sha256(b'fri short').hexdigest()

        def stub_clock(src, out, prompt):
            events.append(('clock', Path(src).name, Path(src).is_file(), prompt.startswith('makeyourmindup.')))
            Path(out).write_text(json.dumps({'duration': 174.0, 'words': [{'w': w, 's': n * 0.4, 'e': n * 0.4 + 0.3} for n, w in enumerate(mon_long[:20])],
                                             'provenance': {'schema': 1, 'source_sha256': 'stand-in'}}), encoding='utf-8')
            return {'words': 20, 'duration': 174.0, 'reused': False}

        def watched(method, path, body):
            if method == 'POST' and '/making' in path:
                events.append(('record', path.split('/')[3]))
            return fake(method, path, body)
        placing = tmp / 'placing'
        lines.clear()
        code, report = run({'week': '2026-10-12', 'by': 'Place takes', 'record': True, 'board': True, 'clock': True}, watched,
                           lambda: engine_recordings(listing), **{**fetching, 'cache': placing, 'clock_with': stub_clock})
        check('--clock: each placed take gets its word clock, from the whole take on disk, named from its script (Friday has no short script here), '
              'before it is recorded',
              (code, [e for e in events if e[0] == 'clock'], [e[0] for e in events]),
              (0, [('clock', 'monday long.mp4', True, True), ('clock', 'IMG_0001.mov', True, False)], ['clock', 'record', 'clock', 'record']))
        check('--clock: the report lists each clock, kept as .cache/recordings/<sha256>.words.json in quick-edit\'s shape',
              [(c['piece_id'], c['cut'], Path(c['words_file']).name, c['words'], len(json.loads(Path(c['words_file']).read_text())['words']))
               for c in report['clocks']],
              [(MON, 'long', f'{mon_sha}.words.json', 20, 20), (FRI, 'short', f'{fri_sha}.words.json', 20, 20)])
        check('--clock: each take is placed on its piece, by the job\'s name', [(p.split('/')[3], b['by'], b['recordings'][0]['cut']) for p, b in posts[before_posts:]],
              [(MON, 'Place takes', 'long'), (FRI, 'Place takes', 'short')])
        check('--clock with --board: a take fetched only to hear it is kept until its clock is built, then deleted; the clocks stay',
              (sorted(p.name for p in placing.iterdir() if not p.name.endswith('.json')), sorted(p.name for p in placing.glob('*.words.json') if '.head.' not in p.name)),
              ([], sorted([f'{mon_sha}.words.json', f'{fri_sha}.words.json'])))
        check('used/: each placed take belongs in the Inbox\'s used/ folder, said so, and nothing is moved or deleted',
              (sorted((u['name'], u['cut']) for u in report['inbox']['used']), report['inbox']['moved'], report['inbox']['deleted'],
               sum(1 for line in lines if line.startswith('belongs in used/: ')), lines.count(NOT_MOVED + '.')),
              ([('IMG_0001.mov', 'short'), ('monday long.mp4', 'long')], False, False, 2, 1))
        used_book = json.loads((placing / USED).read_text(encoding='utf-8')) if (placing / USED).is_file() else {}
        check('used/: the book records each take as moved to used/, never as moved in Drive',
              sorted((v['names'], v['piece_id'], v['to'], v['moved']) for v in used_book.values()),
              sorted([(['monday long.mp4'], MON, 'used/', False), (['IMG_0001.mov'], FRI, 'used/', False)]))
        # --spoken: the take against the exact script he read, recorded on the piece; never against another copy.
        sp_posts = []
        sp_words = tmp / 'spoken.words.json'
        sp_words.write_text(json.dumps({'words': [{'w': w, 's': n * 0.4, 'e': n * 0.4 + 0.3}
                                                  for n, w in enumerate("it's not about the model so worry about the cost".split())]}))
        keep = lambda pid, patch, call, by=None: sp_posts.append((pid, patch))
        got = spoken_for(MON, 'long', {'text': 'It is not about the model. Worry about the price.', 'current': True}, sp_words, None,
                         'Place takes', post=keep)
        check('--spoken: the take is compared with the exact script and written on its piece as spoken_delta.<cut>',
              (got.get('changes'), sp_posts[0][0], list(sp_posts[0][1]['spoken_delta']),
               [sp_posts[0][1]['spoken_delta']['long'][k] for k in ('contracted', 'swapped', 'added')]),
              (3, MON, ['long'], [1, 1, 1]))
        check('--spoken: a script not matched by its hash is never compared, so a later edit is never counted as his change',
              (spoken_for(MON, 'long', {'text': 'Other words.', 'current': False}, sp_words, None, 'Place takes', post=keep)['skipped'],
               len(sp_posts)), ('the script he read is not on file by its hash', 1))
        # A clock that cannot be built: the take is not recorded, so the next run tries again.
        events.clear()
        before_posts = len(posts)

        def no_clock(src, out, prompt):
            raise MatchError('faster-whisper is not installed here')
        code, report = run({'week': '2026-10-12', 'by': 'Place takes', 'record': True, 'clock': True}, watched,
                           lambda: engine_recordings(listing), **{**common, 'cache': tmp / 'no-clock', 'clock_with': no_clock})
        check('--clock: a clock that cannot be built fails the take (exit 1) and nothing is recorded or said to belong in used/',
              (code, posts[before_posts:], sorted(f['status'] for f in report['files'] if f['name'] in ('monday long.mp4', 'IMG_0001.mov')),
               report['inbox']['used']), (1, [], ['failed', 'failed'], []))
        # A duplicate: the same bytes under a second name, and the same take again under other bytes. Reported, kept.
        timed = lambda ws, start=0.0, step=0.4: [{'w': w, 's': round(start + n * step, 3), 'e': round(start + n * step + 0.3, 3)} for n, w in enumerate(ws)]
        dup_listing = [{**item('monday long.mp4', b'mon long', '2026-10-12T08:00:00Z'), 'names': ['monday long.mp4', 'monday long copy.mp4']},
                       item('monday long export.mp4', b'mon long, exported again', '2026-10-12T07:00:00Z'),
                       item('monday long again.mp4', b'mon long, read again', '2026-10-12T06:00:00Z')]
        dup_heard = {'monday long.mp4': (timed(mon_long[:110]), 174.0), 'monday long export.mp4': (timed(mon_long[:110], start=0.35), 174.4),
                     'monday long again.mp4': (timed(mon_long[:110], step=0.43), 174.2)}
        dups = tmp / 'dups'
        lines.clear()
        before_posts = len(posts)
        code, report = run({'week': '2026-10-12', 'by': 'Place takes', 'record': True, 'board': True}, fake, lambda: engine_recordings(dup_listing),
                           get_file=lambda i, cache: i['name'], transcribe=lambda src: dup_heard[src][0], probe=lambda src: dup_heard[src][1],
                           out=lines.append, cache=dups, plans=plans, roots=[library_posts])
        status = {f['name']: f['status'] for f in report['files']}
        check('duplicate: the same take again (every word at the same moment, as long) is a duplicate of the placed one; a second read of the script is not',
              (status.get('monday long.mp4'), status.get('monday long export.mp4'), status.get('monday long again.mp4')),
              ('placed', 'duplicate', 'older take'))
        check('duplicate: both kinds are reported, each kept',
              sorted((d['name'], d['why'], d['kept']) for d in report['inbox']['duplicates']),
              [('monday long copy.mp4', 'same bytes', True), ('monday long export.mp4', 'same take', True)])
        check('duplicate: said plainly, never asked about on the board, never placed',
              (any(line.startswith('duplicate, kept: "monday long export.mp4" is the same take as "monday long.mp4"') for line in lines),
               any(line.startswith('duplicate, kept: "monday long copy.mp4" is the same bytes') for line in lines),
               [p.split('/')[3] for p, b in posts[before_posts:]], [i['id'] for b in board_posts for i in b['items'] if 'export' in i['title']]),
              (True, True, [MON], []))
        check('duplicate: a duplicate leaves the exit as it was (0: every take placed or left alone)', code, 0)
        check('same_take: a re-export a little later, the same take; a second read, or a length a second apart, not',
              (same_take(timed(mon_long[:40]), 170.0, timed(mon_long[:40], start=1.2), 170.5), same_take(timed(mon_long[:40]), 170.0, timed(mon_long[:40], step=0.45), 170.0),
               same_take(timed(mon_long[:40]), 170.0, timed(mon_long[:40]), 171.5), same_take(_heard(mon_long[:40]), 170.0, _heard(mon_long[:40]), 170.05),
               same_take(_heard(mon_long[:40]), 170.0, _heard(mon_long[:40]), 170.5)),
              (True, False, False, True, False))
        # On this machine (--inbox): a file already on a piece's record belongs in used/; two files of the same bytes, one is a duplicate.
        inbox_items = [{'name': 'on record.mp4', 'sha256': claimed_sha, 'at': '2026-10-12T08:00:00Z', 'source': 'inbox', 'bytes': 1},
                       {'name': 'on record (1).mp4', 'sha256': claimed_sha, 'at': '2026-10-12T09:00:00Z', 'source': 'inbox', 'bytes': 1}]
        shown = inbox_report(inbox_items, {claimed_sha}, [], set())
        check('used/ on this machine: a file already on a record belongs in used/, the second copy of its bytes is a duplicate, kept',
              ([(u['name'], u.get('on_record')) for u in shown['used']], [(d['name'], d['why']) for d in shown['duplicates']]),
              ([('on record.mp4', True)], [('on record (1).mp4', 'same bytes')]))
        heard_text['IMG_0001.mov'] = was_heard
        # The real clock, where faster-whisper is not installed: a plain failure naming the pinned set, never a traceback.
        try:
            importlib.metadata.version('faster-whisper')
        except importlib.metadata.PackageNotFoundError:
            (tmp / 'take.wav').write_bytes(b'RIFF')
            try:
                word_clock(tmp / 'take.wav', tmp / 'take.words.json')
                check('word_clock: with no faster-whisper it says so', 'no error', 'error')
            except MatchError as error:
                check('word_clock: with no faster-whisper it says so, naming the pinned set', ('not installed' in str(error), 'requirements.lock.txt' in str(error)), (True, True))

        # Nothing waiting.
        lines.clear()
        nothing = lambda m, p, b: (200, json.dumps({'ok': True, 'series': []})) if p.startswith('/api/week/options') else fake(m, p, b)
        code, report = run({'week': '2026-10-12'}, nothing, lambda: engine_recordings(listing[:2]), **{**common, 'cache': tmp / 'cache3'})
        check('nothing waiting: said once, and nothing is heard', (code, lines[0].startswith('No piece this week or next is waiting'), report['files']), (0, True, []))

        # A failure is exit 1, and says what failed.
        def deaf(src):
            raise MatchError('faster-whisper is not installed here')
        lines.clear()
        code, report = run({'week': '2026-10-12'}, fake, lambda: engine_recordings(listing[1:2]), **{**common, 'transcribe': deaf, 'cache': tmp / 'cache4'})
        check('a take that cannot be heard fails with the reason, exit 1', (code, report['files'][0]['status'], 'faster-whisper' in report['files'][0]['reason']), (1, 'failed', True))

        # The second reviewer's case: the unpinned pair imports, then raises a TypeError on every take.
        def broken(src):
            raise TypeError("open() got an unexpected keyword argument 'metadata_errors'")
        code, report = run({'week': '2026-10-12'}, fake, lambda: engine_recordings(listing[1:3]), **{**common, 'transcribe': broken, 'cache': tmp / 'cache6'})
        check('a transcriber that raises anything is a failed line per take, naming the pinned set, never a traceback',
              (code, [f['status'] for f in report['files'] if f['source'] != 'record'],
               all('requirements.lock.txt' in f['reason'] and 'TypeError' in f['reason'] for f in report['files'] if f['source'] != 'record')),
              (1, ['failed', 'failed'], True))

        # --words for one file, and a words file in quick-edit's shape.
        words_file = tmp / 'w.json'
        words_file.write_text(json.dumps({'duration': 45, 'recording_seconds': 171.5, 'words': [{'w': w, 's': 0, 'e': 0} for w in mon_long[:100]]}))
        said, seconds = read_words(words_file)
        check('--words: quick-edit\'s words.json, with the length', (len(said), seconds), (100, 171.5))
        new = engine_recordings(listing[1:2])
        check('--words FILE alone fits the one new recording', parse_overrides([str(words_file)], new), {new[0]['sha256']: str(words_file)})
        check('--words NAME=FILE', parse_overrides([f'monday long.mp4={words_file}'], new), {new[0]['sha256']: str(words_file)})
        try:
            parse_overrides([f'nope.mp4={words_file}'], new)
            check('--words for a recording that is not new is refused', 'no error', 'error')
        except MatchError as error:
            check('--words for a recording that is not new is refused', 'no new recording' in str(error), True)

        # Fetching the engine's copy to hear it: checked, kept under its name, never over another file.
        got = tmp / 'got'
        take_item = engine_recordings([item('take 1.mp4', b'the real take', '2026-10-12T09:00:00Z')])[0]
        path = local_copy(take_item, got, fetch=lambda url, handle: handle.write(b'the real take'))
        check('fetch: kept under its own name, where recording.py get looks', (path.name, path.read_bytes()), ('take 1.mp4', b'the real take'))
        check('fetch: a copy already here is used, nothing fetched', local_copy(take_item, got, fetch=lambda url, handle: 1 / 0), path)
        other = engine_recordings([item('take 1.mp4', b'another take, same name', '2026-10-12T10:00:00Z')])[0]
        path2 = local_copy(other, got, fetch=lambda url, handle: handle.write(b'another take, same name'))
        check('fetch: another take with the same name goes beside it, by its sha256', (path2.name, path.read_bytes()), (f'{other["sha256"]}.mp4', b'the real take'))
        try:
            local_copy(engine_recordings([item('bad.mp4', b'expected', '2026-10-12T09:00:00Z')])[0], got, fetch=lambda url, handle: handle.write(b'tampered'))
            check('fetch: a download that does not match is refused', 'no error', 'error')
        except MatchError as error:
            check('fetch: a download that does not match is refused, and nothing is kept',
                  ('does not match' in str(error), sorted(p.name for p in got.iterdir())), (True, sorted(['take 1.mp4', f'{other["sha256"]}.mp4'])))
        bad_url = dict(take_item, sha256='d' * 64, download='http://elsewhere.invalid/x')
        try:
            local_copy(bad_url, got, fetch=lambda url, handle: handle.write(b'x'))
            check('fetch: an address that is not the engine\'s storage is refused', 'no error', 'error')
        except MatchError as error:
            check('fetch: an address that is not the engine\'s storage is refused', 'nothing was fetched' in str(error), True)

        # The real ffprobe, when this machine has it.
        if shutil.which('ffmpeg') and shutil.which('ffprobe'):
            clip = tmp / 'three seconds.m4a'
            made = subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', '3', '-c:a', 'aac', str(clip)], capture_output=True)
            seconds = probe_seconds(clip)['seconds'] if made.returncode == 0 else None
            check('ffprobe: how long a take runs', seconds is not None and abs(seconds - 3.0) < 0.2, True)
            stamped = tmp / 'stamped.m4a'
            subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', '1', '-c:a', 'aac',
                            '-metadata', 'creation_time=2026-10-12T08:01:02.000000Z', str(stamped)], capture_output=True)
            check('ffprobe: when the file says it was made', probe_seconds(stamped)['recorded_at'], '2026-10-12T08:01:02Z')

    # The 15-minute feature (house rule FEATURE): a third cut on a piece whose script check holds the feature's hash.
    FEAT = 'a1b2c3d4-0000-4000-8000-00000000fea7'
    feat_long, feat_short, feat_feature = _prose(21, 450), None, _prose(22, 2100)
    feat_short = feat_long[:60] + _prose(23, 140)
    same_open = feat_long[:200] + _prose(24, 1900)  # a feature that opens exactly as the long does
    feat_hashes = {'long': making.script_hash(' '.join(feat_long)), 'short': making.script_hash(' '.join(feat_short)),
                   'feature': making.script_hash(' '.join(feat_feature))}
    feat_title = 'Mon 2 Nov - 15-minute feature - Who gets paid for AI songs'
    feat_record = {'making': {'workroom': {'url': 'https://claude.ai/artifact/f', 'at': '2026-10-28T09:00:00Z'},
                              'script_check': {'passed': True, 'checked_at': '2026-10-29T10:00:00Z', 'hashes': feat_hashes,
                                               'changed_at': {c: '2026-10-29T10:00:00Z' for c in ALL_CUTS}},
                              'teleprompter': {'folder_id': '86B6F74B-2F8A-4477-AE44-8DA1119D1CD9', 'cuts': {
                                  'feature': {'script_id': '0C3E7F55-9C1B-4F6A-8E2D-3B5A1C7D9E01', 'title': feat_title}}},
                              # Long and short are recorded: an engine from before the feature calls Record done on them.
                              'recordings': [{'cut': 'long', 'path': 'recordings/' + '1' * 64 + '.mp4', 'script_sha256': feat_hashes['long']},
                                             {'cut': 'short', 'path': 'recordings/' + '2' * 64 + '.mp4', 'script_sha256': feat_hashes['short']}]},
                   'steps': [{'key': 'scripts', 'state': 'done'}, {'key': 'record', 'state': 'done'}]}
    feat_posts = []

    def feat_engine(method, path, body):
        if method == 'POST':
            feat_posts.append((path, body))
            return 200, json.dumps({'ok': True, 'steps': []})
        if path.startswith('/api/week/options'):
            inflight = [{'id': FEAT, 'idea': 'Songs', 'state': 'review', 'scheduled_for': '2026-11-02'}] if 'week_start=2026-11-02' in path else []
            return 200, json.dumps({'ok': True, 'series': [{'slug': 'follow_the_money', 'in_flight': inflight}]})
        return 200, json.dumps({'ok': True, **feat_record})
    feat_pieces, _ = waiting_pieces(feat_engine, week_monday('2026-11-02'))
    check('feature: a feature piece with its long and short recorded still waits for its feature, which is its third cut',
          ([p['id'] for p in feat_pieces], feat_pieces[0]['cuts'] if feat_pieces else None, feat_pieces[0]['recorded'] if feat_pieces else None,
           feat_pieces[0]['titles'] if feat_pieces else None),
          ([FEAT], ['long', 'short', 'feature'], ['long', 'short'], {'feature': feat_title}))
    check('feature: a piece with no feature hash has only its two cuts', (cuts_of(pieces[0]), cuts_of({'cuts': ['long', 'short']})), (CUTS, CUTS))
    check('feature: lengths on a feature piece: 15:05 the feature, 7:00 the long, 9:00 between, 1:35 the short; a piece without one reads 15:05 as long',
          (length_cut(905.0, ALL_CUTS), length_cut(420.0, ALL_CUTS), length_cut(540.0, ALL_CUTS), length_cut(95.0, ALL_CUTS), length_cut(905.0, CUTS)),
          ('feature', 'long', None, 'short', 'long'))
    feat_scripts = {FEAT: {'long': {'text': ' '.join(feat_long)}, 'short': {'text': ' '.join(feat_short)}, 'feature': {'text': ' '.join(feat_feature)}}}
    take = {'name': 'take.mp4', 'at': '2026-10-30T08:00:00Z'}
    a = decide(take, _heard(feat_feature[:110], junk=4, slips=12), 905.0, feat_pieces, feat_scripts)
    check('feature: a take of the feature\'s words, its length agreeing, is placed on the feature',
          (a['status'], a.get('piece_id'), a.get('cut'), a.get('by')), ('placed', FEAT, 'feature', 'words'))
    a = decide(take, _heard(feat_feature[:110]), 180.0, feat_pieces, feat_scripts)
    check('feature: the feature\'s words in a take that runs like a long one are unsure', (a['status'], 'which is a long take' in a.get('reason', '')), ('unsure', True))
    same_scripts = {FEAT: {**feat_scripts[FEAT], 'feature': {'text': ' '.join(same_open)}}}
    a = decide(take, _heard(feat_long[:110]), 905.0, feat_pieces, same_scripts)
    check('feature: a feature that opens as the long does is told apart by length (feature)', (a['status'], a.get('cut'), a.get('by')), ('placed', 'feature', 'length'))
    a = decide(take, _heard(feat_long[:110]), 420.0, [dict(feat_pieces[0], recorded=[])], same_scripts)
    check('feature: ... and (long, on a piece whose long is not recorded yet)', (a['status'], a.get('cut'), a.get('by')), ('placed', 'long', 'length'))
    a = decide(take, _heard(feat_long[:110]), 540.0, feat_pieces, same_scripts)
    check('feature: a length between the long and the feature is unsure, naming the three lengths',
          (a['status'], '15-minute feature (10:00 and over)' in a.get('reason', '')), ('unsure', True))
    a = decide({'name': 'IMG_15 feature take.mov', 'at': take['at']}, _heard(feat_long[:110]), 540.0, feat_pieces, same_scripts)
    check('feature: ... unless the file name says it is the feature', (a['status'], a.get('cut'), a.get('by')), ('placed', 'feature', 'name'))
    a = decide({'name': 'feature.mov', 'at': take['at']}, _heard(fri_long[:110]), 142.0, pieces, scripts)
    check('feature: a name saying feature decides nothing on a piece with no feature', a['status'], 'unsure')
    a = decide({'name': feat_title + '.mp4', 'at': take['at']}, _heard(feat_feature[:110]), 905.0, feat_pieces, feat_scripts)
    check('feature: a take named after the feature\'s Teleprompter script is the feature', (a['status'], a.get('cut'), a.get('by')), ('placed', 'feature', 'title'))
    a = decide({'name': feat_title + '.mp4', 'at': take['at']}, _heard(feat_feature[:110]), 180.0, feat_pieces, feat_scripts)
    check('feature: ... unless it runs like a long take', (a['status'], 'which is a long take' in a.get('reason', '')), ('unsure', True))
    done_feature = [dict(feat_pieces[0], recorded=['long', 'short', 'feature'])]
    a = decide(take, _heard(feat_feature[:110]), 905.0, done_feature, feat_scripts)
    check('feature: a new take of a feature already recorded is left alone', (a['status'], 'feature cut, which is already recorded' in a.get('reason', '')), ('unsure', True))
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        feat_plans = tmp / 'plans' / '2026-11-02-monday'
        feat_plans.mkdir(parents=True)
        for cut, text in (('long', feat_long), ('short', feat_short), ('feature', feat_feature)):
            (feat_plans / f'{cut}.md').write_text(' '.join(text), encoding='utf-8')
        (feat_plans / 'post.json').write_text(json.dumps({'piece_id': FEAT, 'files': [{'kind': 'video-script', 'file': f'{c}.md', 'cut': c} for c in ALL_CUTS]}))
        found = scripts_for(feat_pieces[0], tmp / 'plans', [], show=None)
        check('feature: the feature\'s script is found by its cut in post.json, its words the record\'s', (sorted(found), found['feature']['current']),
              (['feature', 'long', 'short'], True))
        check('feature: a piece with no feature never reads a feature script', sorted(scripts_for({**feat_pieces[0], 'cuts': ['long', 'short']}, tmp / 'plans', [], show=None)),
              ['long', 'short'])
        data = b'the fifteen-minute feature take'
        listing = [{'name': 'IMG_2001.mov', 'sha256': hashlib.sha256(data).hexdigest(), 'uploaded_at': '2026-10-30T09:00:00Z', 'bytes': len(data),
                    'download': {'url': f'https://store.invalid{recording.DOWNLOAD_PATH}f'}}]
        lines = []
        code, report = run({'week': '2026-11-02', 'by': 'Codex', 'record': True}, feat_engine, lambda: engine_recordings(listing),
                           get_file=lambda i, cache: i['name'], transcribe=lambda src: _heard(feat_feature[:110], junk=3),
                           probe=lambda src: 912.0, out=lines.append, cache=tmp / 'cache', plans=tmp / 'plans', roots=[])
        check('feature: --record places the take on the feature, stamped with the feature script\'s hash',
              (code, [(p.split('/')[3], b['recordings']) for p, b in feat_posts]),
              (0, [(FEAT, [{'cut': 'feature', 'path': f'recordings/{hashlib.sha256(data).hexdigest()}.mov', 'seconds': 912,
                            'script_sha256': feat_hashes['feature']}])]))
        check('feature: the run says the piece waits for its feature', any('(feature)' in line for line in lines if line.startswith('Waiting')), True)

    # An off-day piece he records (Ruling, Krish, 2026-10-29): the short cut alone, heard against the words he approved.
    OFF = '0d0d0d0d-1111-4222-8333-444455556666'
    off_words = ' '.join(_prose(41, 170))
    off_sha = making.script_hash(off_words)
    def off_call(method, path, body):
        if path.startswith('/api/week/options'):
            return 200, json.dumps({'ok': True, 'series': [{'slug': 'under_the_hood', 'in_flight': [{'id': OFF, 'idea': 'Agents at work', 'state': 'drafting', 'scheduled_for': '2026-11-03'}]}]})
        if path == f'/api/content-ideas/{OFF}/making':
            return 200, json.dumps({'ok': True, 'steps': [{'key': 'scripts', 'state': 'done'}, {'key': 'record', 'state': 'now'}],
                                    'making': {'script_check': {'passed': True, 'one_cut': True, 'cuts': ['short'], 'hashes': {'short': off_sha}}},
                                    'offday': {'script': off_words, 'script_sha256': off_sha}})
        return 404, '{}'
    off_waiting, _ = waiting_pieces(off_call, date(2026, 11, 2))
    check('off day: the piece waits for its short cut alone', [(p['id'], p['cuts']) for p in off_waiting], [(OFF, ['short'])])
    with tempfile.TemporaryDirectory() as tmp:
        off_found = scripts_for(off_waiting[0], plans=Path(tmp), roots=[], show=None)
    check('off day: the words he approved are its current short script', (sorted(off_found), off_found.get('short', {}).get('current')), (['short'], True))
    check('off day: a take that runs like a short is the short; a longer one is unsure', (length_cut(80, ('short',)), length_cut(200, ('short',))), ('short', None))
    check('off day: a record without one_cut still asks for both cuts', making.one_cut({'script_check': {'hashes': {'short': off_sha}}}), False)
    if fails:
        print('recording match self-test FAILED:\n  ' + '\n  '.join(fails))
        return 1
    print(f'recording match self-test passed: {count} checks')
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(description="Say which of Krish's new recordings is which piece's long or short cut, and record it.")
    ap.add_argument('--week', metavar='YYYY-MM-DD', help='a day in the week to start from (default: this week); the next week is read too')
    ap.add_argument('--inbox', nargs='?', const='', metavar='PATH',
                    help="read the Inbox on this machine instead of the engine's copies (default: MINDMAKE_MEDIA_INBOX, else runtime.media_inbox)")
    ap.add_argument('--record', action='store_true', help='record each sure match on its piece (making.py recorded)')
    ap.add_argument('--board', action='store_true', help='put each unsure take on Krish\'s board, once for each reason '
                    '(item take-<sha12>, closes_on take_placed), and keep .cache/recordings/answered.json')
    ap.add_argument('--clock', action='store_true', help='build each placed take\'s word clock first (.cache/recordings/<sha256>.words.json), '
                    'and record a take only once its clock is built')
    ap.add_argument('--by', help=f'who is recording it: Codex, Claude Code (default: {making.BY_ENV}, else {making.DEFAULT_BY})')
    ap.add_argument('--words', action='append', metavar='NAME=FILE', help='what was said in a take\'s first 45 seconds, instead of hearing it (for tests)')
    ap.add_argument('--spoken', action='store_true', help='with --record and --clock: compare each recorded take with the exact '
                    'script it was read from and record spoken_delta on its piece (scripts/voice/spoken_delta.py)')
    ap.add_argument('--json', action='store_true', help='print the whole answer as JSON')
    ap.add_argument('--self-test', action='store_true', help='check the matching against stand-ins (no network, no transcriber)')
    ap.add_argument('--check-transcriber', action='store_true', help='decode a second of sound with faster-whisper, as the lane\'s -Check does: '
                    'exit 0 when it works, 1 with the fix when it does not (an import alone proves nothing)')
    a = ap.parse_args(argv)
    if a.self_test:
        return self_test()
    if a.check_transcriber:
        ok, detail = transcriber.decodes()
        print(('ok    ' if ok else 'FAIL  ') + f'faster_whisper: {detail}')
        return 0 if ok else 1
    lines = []
    out = lines.append if a.json else print
    try:
        making.who(a.by)
        if a.inbox is not None:
            inbox = a.inbox or default_inbox()
            if not inbox:
                raise MatchError('no Inbox given, and MINDMAKE_MEDIA_INBOX is not set on this machine')
            items = inbox_recordings(inbox)
            list_items = lambda: items
        else:
            try:
                api = recording.Engine()
                items = engine_recordings(api.recordings())
            except recording.RecordingError as error:
                raise MatchError(str(error))
            list_items = lambda: items
        code, report = run({'week': a.week, 'by': a.by, 'record': a.record, 'board': a.board, 'clock': a.clock, 'spoken': a.spoken, 'words': a.words},
                           making._engine_call, list_items, out=out)
    except (MatchError, making.MakingError) as error:
        print(f'recording_match: {error}', file=sys.stderr)
        return 1
    if a.json:
        report['lines'] = lines
        print(json.dumps(report, indent=2, default=str))
    return code


if __name__ == '__main__':
    sys.exit(main())
