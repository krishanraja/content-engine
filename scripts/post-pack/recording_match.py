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
    python scripts/post-pack/recording_match.py --inbox           read the Inbox on this machine (H:) instead of
                                                                  the engine's copies; --inbox PATH names it
    python scripts/post-pack/recording_match.py --week 2026-10-12 start from that week (default: this one)
    python scripts/post-pack/recording_match.py --json            the whole answer as JSON
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
3. Each piece's two scripts. The post.json "video-script" entries with
   "cut" (docs/plans/<plan>/post.json, the draft beside the plan, or the pack
   in the library), or transformed_outputs video_3min and video_90s when the
   engine's read of the piece carries them.
4. The words. faster-whisper small.en hears the first 45 seconds (cached as
   .cache/recordings/<sha256>.head.words.json), scored against the opening of
   each script with the ordered word match the Studio uses
   (orderedSimilarity, packages/core/src/candidates.ts).
5. The piece. Sure at 0.72 or more, and 0.15 clear of the next piece. A take
   that reached the engine (or the Inbox) before the piece's scripts were
   checked cannot be its recording.
6. The cut. The words decide when the two scripts open differently. Most
   open the same way, so then the length decides (ffprobe): a raw long take
   runs about 2:30 and over, a short one about 2:15 and under. Between the
   two, a file name that says "long" or "short" decides. Words and length
   that disagree are unsure.

Anything unsure is said in one plain line for that file, and nothing is
recorded for it. Exit 0 when every new recording is placed (or there are
none), 2 when any is unsure, 1 when something failed.

--record writes each sure match exactly as
    making.py --by NAME PIECE_ID recorded CUT "recordings/<sha256>.<ext>" --seconds N
would. It never sends, posts, spends, moves or deletes anything, and never
writes to the Inbox.
"""
import argparse
import hashlib
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
import making  # noqa: E402  the piece's record: making.post, making.who, making.recorded_patch
import recording  # noqa: E402  the engine's copies of the Inbox
import story_check  # noqa: E402  cut_of: what a file name says it is

CACHE = REPO / '.cache' / 'recordings'
PLANS = REPO / 'docs' / 'plans'
STUDIO_CONFIG = REPO / 'config' / 'studio.json'
PACK_OUT = REPO / '.cache' / 'post-pack'  # build.py's default: <folder>/3 Video/<name>
POSTS, VIDEO = '3 Posts', '3 Video'       # the library: 3 Posts/<folder>/3 Video/<name>
INBOX_MARKER = '.mindmake-inbox-id-v1.json'
CUTS = making.CUTS
HEAD_SECONDS = 45
MODEL = 'small.en'
SURE = 0.72         # the Studio's own bar for a take against its script (OPERATIONS.md, short-native)
MARGIN = 0.15       # clear of the next piece, and of the other cut when the words decide it
LONG_FROM = 150     # a raw long take runs about 2:30 and over (3:38, 2:52, 2:26 so far)
SHORT_UP_TO = 135   # a raw short take about 2:15 and under
SETTLING = 120      # seconds unchanged before a file counts as finished (the recordings upload's rule)
LANE_LIMIT = 500 * 1024 * 1024  # the recordings upload skips files over 500 MiB
MIN_HEAD_WORDS = 12
PACK_NAMES = {'long': 'video-script.md', 'short': 'video-script-90-seconds.md'}
OUTPUT_KEYS = {'long': 'video_3min', 'short': 'video_90s'}
SHA = re.compile(r'[0-9a-f]{64}')
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
        if (steps.get('scripts') or {}).get('state') != 'done' or (steps.get('record') or {}).get('state') == 'done':
            continue
        piece['recorded'] = sorted({r.get('cut') for r in recordings if r.get('cut') in CUTS})
        piece['checked_at'] = (record.get('script_check') or {}).get('checked_at')
        piece['folder'] = (record.get('pack') or {}).get('folder')
        waiting.append(piece)
    waiting.sort(key=lambda p: (p.get('scheduled_for') or '9999-12-31', p['id']))
    return waiting, claimed


# ------------------------------------------------------------- the scripts

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


def scripts_for(piece, plans=PLANS, roots=None, call=None):
    """{'long': {'text', 'from'}, 'short': {...}}: each script the piece has.
    For a post.json "video-script" entry: its own text, the file beside the
    post.json, the pack, then the draft beside the plan
    (docs/plans/<date>-draft-<file>). Then the pack by its usual names, then
    the engine's transformed_outputs when its read of the piece carries them."""
    roots = library_roots() if roots is None else roots
    folder = piece.get('folder')
    found = {}
    post_path, post = find_post(piece['id'], plans)
    for entry in (post or {}).get('files') or []:
        if not isinstance(entry, dict) or entry.get('kind') != 'video-script':
            continue
        cut = entry.get('cut') if entry.get('cut') in CUTS else story_check.cut_of(entry.get('name') or entry.get('file') or '')
        if cut not in CUTS or cut in found:
            continue
        if isinstance(entry.get('text'), str) and entry['text'].strip():
            found[cut] = {'text': entry['text'], 'from': f'{_shown(post_path)} (its text)'}
            continue
        raw = entry.get('file') if isinstance(entry.get('file'), str) and entry['file'].strip() else None
        name = entry.get('name') or (f'video-script{Path(raw).suffix.lower() or ".md"}' if raw else PACK_NAMES[cut])
        places = [post_path.parent / raw] if raw else []
        places += [root / folder / VIDEO / name for root in roots] if folder else []
        dated = re.match(r'^(\d{4}-\d{2}-\d{2})-', post_path.parent.name)
        if raw and dated:
            places.append(post_path.parent.parent / f'{dated.group(1)}-draft-{Path(raw).name}')
        for place in places:
            text = _read(place)
            if text and text.strip():
                found[cut] = {'text': text, 'from': _shown(place)}
                break
    for cut in CUTS:
        if cut in found or not folder:
            continue
        for root in roots:
            text = _read(root / folder / VIDEO / PACK_NAMES[cut])
            if text and text.strip():
                found[cut] = {'text': text, 'from': _shown(root / folder / VIDEO / PACK_NAMES[cut])}
                break
    if call and any(cut not in found for cut in CUTS):
        try:
            outputs = (_get(call, f'/api/content-ideas?id={piece["id"]}').get('piece') or {}).get('transformed_outputs') or {}
        except MatchError:
            outputs = {}
        for cut in CUTS:
            script = outputs.get(OUTPUT_KEYS[cut]) if isinstance(outputs, dict) else None
            text = script.get('script') if isinstance(script, dict) else script
            if cut not in found and isinstance(text, str) and text.strip():
                found[cut] = {'text': text, 'from': f'the engine, transformed_outputs.{OUTPUT_KEYS[cut]}'}
    return found


# ------------------------------------------------------------- the recordings

def engine_recordings(listing):
    """The engine's copies (recording.py list), newest first."""
    items = []
    for r in listing:
        sha = str(r.get('sha256') or '').lower()
        name = r.get('name')
        if not SHA.fullmatch(sha) or not recording.safe_name(name):
            continue
        items.append({'name': name, 'sha256': sha, 'bytes': int(r.get('bytes') or 0), 'at': r.get('uploaded_at') or '',
                      'source': 'engine', 'download': (r.get('download') or {}).get('url')})
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
                         '(H:\\My Drive\\Ventures\\Active\\makeyourmindup\\Video Engine\\Inbox)')
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
        raise MatchError('faster-whisper is not installed here, so the first 45 seconds cannot be heard. '
                         'Install it as quick-edit needs it (pip install faster-whisper), or give the words with --words')
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
    """How long the whole take runs, by ffprobe, or None."""
    if not shutil.which('ffprobe'):
        return None
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', str(src)],
                         capture_output=True, text=True)
    try:
        return float(out.stdout.strip())
    except ValueError:
        return None


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


def hear(item, get_file, transcribe=transcribe_head, probe=probe_seconds, override=None, cache=CACHE):
    """(words heard in the first 45 seconds, how long the take runs). From
    --words, then .cache/recordings/<sha256>.head.words.json, then by hearing
    it, which is cached for next time."""
    if override:
        said, seconds = read_words(override)
        return said, seconds if seconds is not None else probe(get_file())
    book = cache / f'{item["sha256"]}.head.words.json'
    try:
        kept = json.loads(book.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        kept = None
    if isinstance(kept, dict) and kept.get('model') == MODEL and kept.get('head_seconds') == HEAD_SECONDS and isinstance(kept.get('words'), list):
        seconds = kept.get('recording_seconds')
        if not isinstance(seconds, (int, float)):
            seconds = probe(get_file())
        return kept['words'], seconds
    src = get_file()
    seconds = probe(src)
    said = transcribe(src)
    try:
        cache.mkdir(parents=True, exist_ok=True)
        book.write_text(json.dumps({'sha256': item['sha256'], 'name': item['name'], 'model': MODEL, 'head_seconds': HEAD_SECONDS,
                                    'duration': HEAD_SECONDS, 'recording_seconds': seconds, 'words': said}, indent=0), encoding='utf-8')
    except OSError:
        pass
    return said, seconds


# ------------------------------------------------------------- deciding

def eligible_for(item, pieces):
    """The pieces this take can belong to: not one whose scripts were checked
    after the take arrived."""
    arrived = parse_time(item.get('at'))
    keep = []
    for piece in pieces:
        checked = parse_time(piece.get('checked_at'))
        if arrived and checked and arrived < checked:
            continue
        keep.append(piece)
    return keep


def decide(item, said, seconds, pieces, scripts):
    """One file's answer: status 'placed' (with piece and cut) or 'unsure'
    (with the reason), and the scores behind it."""
    answer = {'status': 'unsure', 'seconds': round(seconds, 1) if isinstance(seconds, (int, float)) else None}
    head = words(' '.join(str(w.get('w', '')) for w in said))
    if len(head) < MIN_HEAD_WORDS:
        return {**answer, 'reason': f'too little speech in the first {HEAD_SECONDS} seconds to tell what it is'}
    scores = {}
    for piece in pieces:
        texts = scripts.get(piece['id']) or {}
        if texts:
            scores[piece['id']] = {cut: opening_score(head, words(texts[cut]['text'])) for cut in CUTS if cut in texts}
    answer['scores'] = scores
    if not scores:
        return {**answer, 'reason': 'none of the pieces waiting for it has scripts this tool can read'}
    by_id = {p['id']: p for p in pieces}
    ranked = sorted(((max(c.values()), pid) for pid, c in scores.items()), reverse=True)
    best, pid = ranked[0]
    runner = ranked[1][0] if len(ranked) > 1 else 0.0
    piece = by_id[pid]
    answer.update(piece_id=pid, score=best, runner_up=round(runner, 3))
    if best < SURE:
        return {**answer, 'piece_id': None, 'reason': f'its opening matches no waiting piece well enough (closest {label(piece)} at {best:.2f}; {SURE:.2f} needed)'}
    if best - runner < MARGIN:
        return {**answer, 'piece_id': None, 'reason': f'it could be {label(piece)} ({best:.2f}) or {label(by_id[ranked[1][1]])} ({runner:.2f})'}
    own = scores[pid]
    by_words = max(own, key=own.get) if len(own) == 2 and abs(own['long'] - own['short']) >= MARGIN else None
    if not isinstance(seconds, (int, float)):
        return {**answer, 'reason': f'it is {label(piece)}, but how long it runs could not be read (ffprobe), so the cut is not checked'}
    by_length = 'long' if seconds >= LONG_FROM else 'short' if seconds <= SHORT_UP_TO else None
    if by_words and by_length and by_words != by_length:
        return {**answer, 'reason': f'its words are {label(piece)}\'s {by_words} script, but it runs {clock(seconds)}, '
                                    f'which is a {by_length} take'}
    cut, how = (by_words, 'words') if by_words else (by_length, 'length')
    if not cut:
        hint = story_check.cut_of(item['name'])
        if not hint:
            return {**answer, 'reason': f'it is {label(piece)}, but it runs {clock(seconds)}, between a long take '
                                        f'({clock(LONG_FROM)} and over) and a short one ({clock(SHORT_UP_TO)} and under)'}
        cut, how = hint, 'name'
    if cut in (piece.get('recorded') or []):
        return {**answer, 'cut': cut, 'reason': f'it looks like a new take of {label(piece)}\'s {cut} cut, which is already recorded; left alone'}
    return {**answer, 'status': 'placed', 'cut': cut, 'by': how}


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


# ------------------------------------------------------------- the run

def plain(answer, pieces):
    by_id = {p['id']: p for p in pieces}
    name = answer['name']
    if answer['status'] == 'placed':
        piece = by_id[answer['piece_id']]
        why = {'words': 'its words', 'length': 'its length', 'name': 'its name (the length alone could not say)'}[answer['by']]
        line = (f'placed: "{name}" is the {answer["cut"]} cut of {label(piece)}. Its opening matches {answer["score"]:.2f} '
                f'(the next piece {answer["runner_up"]:.2f}), it runs {clock(answer["seconds"])}, and {why} chose the cut.')
        if answer.get('big'):
            line += ' It is over 500 MiB, so the upload lane skips it: produce it on this machine.'
        return line
    if answer['status'] == 'older take':
        return f'left alone: "{name}" is {answer["reason"]}.'
    if answer['status'] == 'old':
        return f'left alone: "{name}" arrived before the scripts of every piece waiting for a recording were checked.'
    if answer['status'] == 'failed':
        return f'failed: "{name}": {answer["reason"]}.'
    return f'unsure: "{name}": {answer["reason"]}. Ask Krish which piece and cut it is.'


def command_for(answer, by):
    return (f'python scripts/post-pack/making.py --by "{by}" {answer["piece_id"]} recorded {answer["cut"]} '
            f'"{answer["path"]}" --seconds {int(round(answer["seconds"]))}')


def run(opts, call, list_items, get_file=local_copy, transcribe=transcribe_head, probe=probe_seconds,
        out=print, cache=CACHE, plans=PLANS, roots=None):
    """The whole run, with every outside thing passed in. Returns (exit code, report)."""
    monday = week_monday(opts.get('week'))
    by = making.who(opts.get('by'))
    pieces, claimed = waiting_pieces(call, monday)
    items = fresh(list_items(), claimed)
    overrides = parse_overrides(opts.get('words'), [i for i in items if i.get('sha256')])
    report = {'week_start': monday.isoformat(), 'waiting': [], 'files': [], 'recorded': []}
    scripts = {}
    for piece in pieces:
        scripts[piece['id']] = scripts_for(piece, plans, roots, call)
        report['waiting'].append({'id': piece['id'], 'day': day_of(piece.get('scheduled_for')), 'subject': subject_of(piece),
                                  'cuts': [c for c in CUTS if c not in piece['recorded']],
                                  'scripts': {c: s['from'] for c, s in scripts[piece['id']].items()}})
    if pieces:
        out('Waiting for a recording: ' + '; '.join(
            f'{label(p)} ({" and ".join(c for c in CUTS if c not in p["recorded"])})' for p in pieces) + '.')
    else:
        out('No piece this week or next is waiting for a recording (its Scripts step done and its Record step not).')
    for piece in pieces:
        missing = [c for c in CUTS if c not in scripts[piece['id']]]
        if missing:
            out(f'note: no {" or ".join(missing)} script found for {label(piece)} (docs/plans post.json, the draft beside it, '
                f'the pack, or the engine), so it is matched on what there is.')
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
        eligible = eligible_for(item, pieces)
        if not eligible:
            answers.append({**base, 'status': 'old'})
            continue
        try:
            said, seconds = hear(item, lambda: get_file(item, cache), transcribe, probe, overrides.get(item['sha256']), cache)
        except MatchError as error:
            answers.append({**base, 'status': 'failed', 'reason': str(error)})
            continue
        answer = {**base, **decide(item, said, seconds, eligible, scripts)}
        answer['path'] = f'recordings/{item["sha256"]}.{ext_of(item["name"])}'
        if item['source'] == 'inbox' and item['bytes'] > LANE_LIMIT:
            answer['big'] = True
        answers.append(answer)
    settle(answers)
    for answer in answers:
        out(plain(answer, pieces))
        report['files'].append({k: v for k, v in answer.items() if k != 'scores'} | {'scores': answer.get('scores', {})})
    by_id = {p['id']: p for p in pieces}
    order = {p['id']: n for n, p in enumerate(pieces)}
    # Written piece by piece, the nearest first, the long cut before the short.
    placed = sorted((a for a in answers if a['status'] == 'placed'), key=lambda a: (order[a['piece_id']], CUTS.index(a['cut'])))
    for answer in placed:
        if opts.get('record'):
            patch = making.recorded_patch(answer['cut'], answer['path'], int(round(answer['seconds'])))
            try:
                making.post(answer['piece_id'], patch, call, by=by)
            except making.MakingError as error:
                answer['status'] = 'failed'
                out(f'failed: "{answer["name"]}" was not recorded on {label(by_id[answer["piece_id"]])}: {error}')
                continue
            report['recorded'].append({'piece_id': answer['piece_id'], 'cut': answer['cut'], 'path': answer['path'], 'by': by})
            out(f'recorded on the board, by {by}: {label(by_id[answer["piece_id"]])} {answer["cut"]} cut, "{answer["name"]}" ({answer["path"]})')
        else:
            out(f'to record it: {command_for(answer, by)}')
    if any(a['status'] == 'failed' for a in answers):
        code = 1
    elif any(a['status'] == 'unsure' for a in answers):
        code = 2
    else:
        code = 0
    report['exit'] = code
    return code, report


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
    claimed_sha = 'c' * 64
    makings = {
        MON: {'making': {'script_check': {'passed': True, 'checked_at': '2026-10-11T19:14:16Z'}, 'pack': {'folder': '2026-10-12 Mon follow.the.money - Who gets paid for AI songs'}},
              'steps': [{'key': 'scripts', 'state': 'done'}, {'key': 'record', 'state': 'todo'}]},
        FRI: {'making': {'script_check': {'passed': True, 'checked_at': '2026-10-11T18:13:41Z'}, 'pack': {'folder': '2026-10-16 Fri mind.the.gap - Why so many AIs'}},
              'steps': [{'key': 'scripts', 'state': 'done'}, {'key': 'record', 'state': 'todo'}]},
        DONE: {'making': {'recordings': [{'cut': 'long', 'path': f'recordings/{claimed_sha}.mp4'}, {'cut': 'short', 'path': 'recordings/x.mp4'}]},
               'steps': [{'key': 'scripts', 'state': 'done'}, {'key': 'record', 'state': 'done'}]},
        EARLY: {'making': {}, 'steps': [{'key': 'scripts', 'state': 'todo'}, {'key': 'record', 'state': 'todo'}]},
    }
    weeks_asked, posts = [], []

    def fake(method, path, body):
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
    check('claimed: a recording already on any piece is not new', claimed, {claimed_sha})
    check('a piece is named by its day and its subject', label(pieces[0]), 'Mon 12 Oct "Who gets paid for AI songs"')

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
        found = scripts_for(pieces[0], plans, [library_posts], fake)
        check('scripts: the long from beside post.json', (found['long']['from'].endswith('2026-10-12-monday/script.md'), words(found['long']['text'])), (True, mon_long))
        check('scripts: the short from the draft beside the plan', found['short']['from'].endswith('2026-10-12-draft-script-90s.md'), True)
        outputs = {'transformed_outputs': {'video_90s': {'script': ' '.join(fri_short)}}}
        engine_has = lambda m, p, b: (200, json.dumps({'ok': True, 'piece': outputs})) if p.startswith('/api/content-ideas?id=') else fake(m, p, b)
        found = scripts_for(pieces[1], plans, [library_posts], engine_has)
        check('scripts: the long from the pack in the library, by its folder', found['long']['from'].endswith(f'{VIDEO}/video-script.md'), True)
        check('scripts: the short from the engine when nothing else has it', found['short']['from'], 'the engine, transformed_outputs.video_90s')
        check('scripts: none at all is an empty answer, not an error', scripts_for({'id': EARLY}, plans, [library_posts], fake), {})
        scripts = {MON: {'long': {'text': ' '.join(mon_long)}, 'short': {'text': ' '.join(mon_short)}},
                   FRI: {'long': {'text': ' '.join(fri_long)}, 'short': {'text': ' '.join(fri_short)}}}

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
        done_long = [dict(pieces[0], recorded=['long']), pieces[1]]
        a = decide(take, _heard(mon_long[:110]), 172.0, done_long, scripts)
        check('decide: a new take of a cut already recorded is left for Krish', (a['status'], 'already recorded' in a.get('reason', '')), ('unsure', True))
        check('the time rule: a take that arrived before a piece\'s scripts were checked is not that piece\'s',
              [p['id'] for p in eligible_for({'at': '2026-10-11T18:30:00Z'}, pieces)], [FRI])
        check('the time rule: a take from 6 October belongs to neither', eligible_for({'at': '2026-10-06T21:53:00Z'}, pieces), [])

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
        check('run: the old take and the claimed one are never heard',
              (status.get('who gets paid.mp4'), 'claimed.mp4' in status, sorted(map(str, heard_calls))), (('old', None), False, ['IMG_0000.mov', 'IMG_0001.mov', 'monday long.mp4']))
        check('run: Monday long and Friday short placed; the older Friday take named and left alone',
              (status.get('monday long.mp4'), status.get('IMG_0001.mov'), status.get('IMG_0000.mov')), (('placed', 'long'), ('placed', 'short'), ('older take', 'short')))
        check('run: without --record, nothing is written and the command is given', (posts, any(line.startswith('to record it: python scripts/post-pack/making.py --by "Codex" ' + MON + ' recorded long "recordings/') for line in lines)), ([], True))
        check('run: one plain line per file', sum(1 for line in lines if line.split(':')[0] in ('placed', 'unsure', 'left alone', 'failed')), 4)
        check('run: the hearing is cached by sha256', (tmp / 'cache' / f'{hashlib.sha256(b"mon long").hexdigest()}.head.words.json').is_file(), True)
        heard_calls.clear()
        lines.clear()
        code, report = run({'week': '2026-10-12', 'by': 'Codex', 'record': True}, fake, lambda: engine_recordings(listing), **common)
        check('run again: the cache is used, nothing is heard twice', heard_calls, [])
        check('--record: one write per placed take, by Codex, the engine copy and its length',
              [(p.split('/')[3], b['by'], b['recordings']) for p, b in posts],
              [(MON, 'Codex', [{'cut': 'long', 'path': f'recordings/{hashlib.sha256(b"mon long").hexdigest()}.mp4', 'seconds': 174}]),
               (FRI, 'Codex', [{'cut': 'short', 'path': f'recordings/{hashlib.sha256(b"fri short").hexdigest()}.mov', 'seconds': 96}])])
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
            seconds = probe_seconds(clip) if made.returncode == 0 else None
            check('ffprobe: how long a take runs', seconds is not None and abs(seconds - 3.0) < 0.2, True)
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
    ap.add_argument('--by', help=f'who is recording it: Codex, Claude Code (default: {making.BY_ENV}, else {making.DEFAULT_BY})')
    ap.add_argument('--words', action='append', metavar='NAME=FILE', help='what was said in a take\'s first 45 seconds, instead of hearing it (for tests)')
    ap.add_argument('--json', action='store_true', help='print the whole answer as JSON')
    ap.add_argument('--self-test', action='store_true', help='check the matching against stand-ins (no network, no transcriber)')
    a = ap.parse_args(argv)
    if a.self_test:
        return self_test()
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
        code, report = run({'week': a.week, 'by': a.by, 'record': a.record, 'words': a.words}, making._engine_call, list_items, out=out)
    except (MatchError, making.MakingError) as error:
        print(f'recording_match: {error}', file=sys.stderr)
        return 1
    if a.json:
        report['lines'] = lines
        print(json.dumps(report, indent=2, default=str))
    return code


if __name__ == '__main__':
    sys.exit(main())
