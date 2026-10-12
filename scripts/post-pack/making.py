#!/usr/bin/env python3
"""making: records where a piece is on its way from the workroom to every
channel, on the engine (POST /api/content-ideas/<id>/making), so Control
Center shows it within a second over its realtime subscription.

Krish, 2026-10-10: the control centre is "a progress tracker, suggestions
compiler, and ideas generator"; the work happens in Claude Code; "it's crucial
that everything is fresh and synchronised in real time".

    python making.py PIECE_ID show
    python making.py PIECE_ID workroom https://claude.ai/artifact/...
    python making.py PIECE_ID publish-manager https://claude.ai/artifact/...
    python making.py PIECE_ID visual-gate post.json          # runs the gate, records pass or fail
    python making.py PIECE_ID scripts long.md short.md       # story_check on each, by position, and each
                                                             # script's sha256; records
    python making.py PIECE_ID pack PACK_FOLDER [--sent]      # build.py and send.py call this themselves
    python making.py PIECE_ID recorded long "recordings/<sha256>.mp4" [--seconds N] [--krish-words "Krish, DATE: ..."]
    python making.py PIECE_ID video long NAME PATH [--url https://...] [--seconds N]
                     [--thumb PATH --thumb-file LOCAL_PATH [--thumb-url https://...]] [--music TRACK_ID]
    python making.py PIECE_ID posted substack https://...    # after Krish posted it
    python making.py PIECE_ID session https://claude.ai/code/session_...
    python making.py --by Codex PIECE_ID ...                 # who wrote it
    python making.py --self-test

Every write says who wrote it: --by NAME, else the MAKING_BY environment
variable, else "Codex" inside Codex (any CODEX* environment variable, the way
send.py tells), else "Claude Code". So build.py and send.py, which record
through report(), credit Codex when Codex runs them, with nothing to set.

The scripts' words. `scripts` records the sha256 of each script's words
(script_hash: NFC, LF line endings, trailing spaces stripped, blank lines
trimmed at both ends) and when each cut's words last changed (changed_at),
and keeps the previous checked_at only when the scripts passed before with
hashes and their words have not changed, so re-checking the same words never
makes Krish's takes look older than the script; a record with no hashes yet
counts as changed. When a cut's words change and a take of it is on the
record, `scripts` asks Krish on the board whether to use it (one item,
take-<sha12>, never reopened once answered). `recorded` stamps each take
with the hash of the script it was taken from (the current one for its cut),
and a take of an older script stops counting (apps/control-plane/api/_making.ts).
It refuses to stamp a take that is already on the record from an older
script, or that the matcher found was recorded before the script last
changed, unless --krish-words gives Krish's words to use it; they are kept
on the take. Every write is retried once when the engine answers 409 (the
piece changed under it).

A video asset carries its thumbnail (Krish, 2026-10-12: "I always want a video
thumbnail for all video sizes produced as an asset every time") and the
licensed music track behind it. The Video assets step is done only when both
cuts are there, each with its thumbnail. A thumbnail is recorded only with
proof it was drawn: --thumb-file, the file build.py --thumbs drew on this
machine, of the cut's shape (1280 x 720 long, 1080 x 1920 short) and listed
in the thumbs.json beside it, with --thumb-url once the library has its link.

Everything here records something that already happened. It never sends,
posts, spends or deletes. A piece id is the content_ideas row (post.json
"piece_id"). The engine key comes from scripts/engine.py, never from here.
"""
import argparse
import contextlib
import hashlib
import io
import json
import math
import os
import re
import subprocess
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
import engine  # noqa: E402

CHANNELS = ('substack', 'youtube', 'shorts', 'tiktok', 'reels', 'linkedin', 'whatsapp', 'notes')
CUTS = ('long', 'short')
UUID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)
SHA256 = re.compile(r'^[a-f0-9]{64}$')  # the engine's rule for script_check.hashes and script_sha256
BY_ENV = 'MAKING_BY'
DEFAULT_BY = 'Claude Code'
CODEX_BY = 'Codex'
# What a drawn thumbnail starts with: JPEG, PNG, WebP (RIFF....WEBP).
IMAGE_MAGIC = (b'\xff\xd8\xff', b'\x89PNG\r\n\x1a\n')
MAX_BY = 60  # the engine keeps the first 60 characters (content-ideas/[id]/making.ts)


class MakingError(Exception):
    pass


def now():
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def default_by(environ=None):
    """Who is writing when nobody said: MAKING_BY, else Codex inside Codex
    (any CODEX* environment variable, as send.default_client tells), else
    Claude Code."""
    environ = os.environ if environ is None else environ
    named = (environ.get(BY_ENV) or '').strip()
    if named:
        return named
    if any(name.startswith('CODEX') for name in environ):
        return CODEX_BY
    return DEFAULT_BY


def normal_script(text):
    """A script's words as they are hashed: NFC, LF line endings, trailing
    spaces stripped from every line, blank lines trimmed at both ends, one
    final line ending. A script already in that shape hashes the same as
    its file's bytes."""
    text = unicodedata.normalize('NFC', str(text or '')).lstrip('\ufeff')
    lines = [line.rstrip() for line in text.replace('\r\n', '\n').replace('\r', '\n').split('\n')]
    while lines and not lines[0]:
        lines.pop(0)
    while lines and not lines[-1]:
        lines.pop()
    return '\n'.join(lines) + '\n' if lines else ''


def script_hash(text):
    """The sha256 of a script's words (normal_script), the same on every
    machine and every checkout, whatever its line endings."""
    return hashlib.sha256(normal_script(text).encode('utf-8')).hexdigest()


def script_file_hash(path):
    return script_hash(Path(path).read_text(encoding='utf-8-sig'))


def rounded_seconds(seconds):
    """How long it runs, in whole seconds: a fraction (make.py's
    total_seconds, 203.4667) is rounded. None when not given."""
    if seconds is None:
        return None
    try:
        value = float(seconds)
    except (TypeError, ValueError):
        raise MakingError(f'--seconds is how long it runs, in seconds, not "{seconds}"')
    if not math.isfinite(value) or value <= 0:
        raise MakingError(f'--seconds is how long it runs, more than 0, not "{seconds}"')
    return max(1, int(round(value)))


def who(by=None):
    """The name a write goes out under: by, else default_by()."""
    name = (by or '').strip() or default_by()
    if len(name) > MAX_BY or any(ch in name for ch in '\r\n\t'):
        raise MakingError(f'who wrote it (--by or {BY_ENV}) is one name of up to {MAX_BY} characters')
    return name


def post(piece_id, patch, call=None, by=None):
    """One write, sent as written by `by` (default_by() when not given).
    Returns the engine's answer as a dict, or raises MakingError."""
    if not UUID.match(piece_id or ''):
        raise MakingError('the piece id must be the content_ideas uuid (post.json "piece_id")')
    body = {**patch, 'by': who(by)}
    call = call or _engine_call
    # A 409 means the piece changed between the engine's read and its write
    # (the updated_at guard): the engine merges again from the fresh row, so
    # the same patch is sent once more.
    for attempt in (1, 2):
        status, text = call('POST', f'/api/content-ideas/{piece_id}/making', body)
        if status != 409:
            break
    try:
        data = json.loads(text) if text else {}
    except ValueError:
        data = {'raw': text[:300]}
    if status == 409:
        raise MakingError('the piece changed while this was being written, twice in a row; nothing was recorded, so run it again')
    if status != 200:
        problems = data.get('problems') or [data.get('error') or f'HTTP {status}']
        raise MakingError('the engine refused the record: ' + '; '.join(map(str, problems)))
    return data


def _engine_call(method, path, body):
    try:
        token = engine.operator_key()
    except engine.NoKey as no_key:
        raise MakingError(str(no_key))
    try:
        return engine.call(method, path, body, token, timeout=60)
    except engine.Unreachable as unreachable:
        raise MakingError(str(unreachable))


def read(piece_id, call=None):
    """The engine's answer for the piece: {'making': record or None, 'steps': [...]}."""
    if not UUID.match(piece_id or ''):
        raise MakingError('the piece id must be the content_ideas uuid (post.json "piece_id")')
    call = call or _engine_call
    status, text = call('GET', f'/api/content-ideas/{piece_id}/making', None)
    if status != 200:
        raise MakingError(f'reading the piece\'s record: HTTP {status}: {text[:200]}')
    try:
        data = json.loads(text)
    except ValueError:
        raise MakingError('reading the piece\'s record: the engine answered with something that is not JSON')
    return data if isinstance(data, dict) else {}


def record_of(piece_id, call=None):
    """The piece's making record as the engine holds it, {} when it has none."""
    making = read(piece_id, call).get('making')
    return making if isinstance(making, dict) else {}


def current_hashes(record):
    """{cut: sha256} of the scripts the last check passed, {} for a record
    made before the hashes were kept."""
    check = record.get('script_check') if isinstance(record, dict) else None
    hashes = check.get('hashes') if isinstance(check, dict) else None
    if not isinstance(hashes, dict):
        return {}
    return {cut: h for cut, h in hashes.items() if cut in CUTS and isinstance(h, str) and SHA256.match(h)}


def older_takes(record):
    """The takes recorded from a script whose words have changed since: each
    carries a script_sha256 that is not the current hash for its cut. A take
    with no hash (recorded before hashes were kept) still counts."""
    hashes = current_hashes(record)
    found = []
    for rec in (record.get('recordings') or []) if isinstance(record, dict) else []:
        if not isinstance(rec, dict):
            continue
        sha, cut = rec.get('script_sha256'), rec.get('cut')
        if sha and hashes.get(cut) and sha != hashes[cut]:
            found.append(rec)
    return found


def show(piece_id, call=None):
    data = read(piece_id, call)
    lines = []
    for step in data.get('steps') or []:
        mark = {'done': 'done ', 'now': 'now  ', 'todo': '     ', 'failed': 'FAIL '}[step['state']]
        note = f"  {step['note']}" if step.get('note') else ''
        link = f"  {step['link']}" if step.get('link') else ''
        lines.append(f"{mark}{step['label']}{note}{link}")
    record = data.get('making') if isinstance(data.get('making'), dict) else {}
    for rec in older_takes(record):
        lines.append(f"older script: the {rec['cut']} take {rec.get('path')} was recorded from words that have changed "
                     f"since, so it does not count; record it again, or Krish says to use it")
    return '\n'.join(lines)


def visual_gate_patch(post_path):
    import build
    import visual_gate
    post_path = Path(post_path)
    try:
        post_json = json.loads(post_path.read_text(encoding='utf-8-sig'))
        folder, planned = build.plan(post_json, post_path.parent)
        problems = visual_gate.problems(post_json, planned, build.fact_checked_body(post_json, post_path.parent), post_path.parent)
    except (OSError, ValueError, build.PackError, build.LibraryError) as error:
        # A pack that cannot even be planned has not passed the gate; say why, in the record.
        problems = [f'the pack could not be planned: {error}']
    return {'visual_gate': {'passed': not problems, 'problems': problems, 'checked_at': now()}}


def _story_check(cut, path):
    result = subprocess.run([sys.executable, str(HERE / 'story_check.py'), '--cut', cut, str(path)], capture_output=True, text=True)
    return result.returncode, result.stdout + result.stderr


def scripts_patch(paths, run=None, warn=None, previous=None):
    """Checks the two scripts by position: the first is the long cut, the
    second the short (house rule TWO_CUTS, Krish, 2026-10-11: every piece
    gets both). A missing script, or one that fails its check, records
    passed false. A file name that says the other cut only warns: the
    position decides, so a 450-word script cannot pass as the short cut, or
    one script mark Scripts done, by what it is called.

    hashes is each script's script_hash. previous is the script_check the
    record holds. changed_at is when each cut's words last changed: kept
    from previous for a cut whose words are the same and passed before, else
    now. checked_at is kept only when previous passed and every cut's words
    are the same as its hashes, so re-checking unchanged words never makes a
    take look older than its script (recording_match's time rule). A
    previous check with no hashes (a record from before they were kept)
    proves nothing about the words, so it counts as changed: checked_at and
    changed_at are now."""
    import story_check
    run = run or _story_check
    warn = warn or (lambda line: print(line, file=sys.stderr))
    paths = list(paths or [])
    if not paths or len(paths) > len(CUTS):
        raise MakingError('give the two scripts, the long cut first: scripts long.md short.md')
    problems, cuts, hashes = [], [], {}
    for cut, p in zip(CUTS, paths):
        name = Path(p).name
        said = story_check.cut_of(name)
        if said and said != cut:
            warn(f'making: {name} says it is the {said} cut but is in the {cut} cut\'s place; '
                 f'it is checked as the {cut} cut (the long cut comes first, then the short)')
        if not Path(p).is_file():
            problems.append(f'{cut} cut: {name} is not there')
            continue
        try:
            hashes[cut] = script_file_hash(p)
        except (OSError, UnicodeDecodeError) as error:
            problems.append(f'{cut} cut: {name} could not be read as text ({error})')
            continue
        cuts.append(cut)
        code, out = run(cut, p)
        if code != 0:
            lines = [line.strip() for line in out.strip().splitlines() if line.strip()]
            problems.extend([f'{name}: {line}' for line in lines][:10] or [f'{name}: the {cut} cut failed its check'])
    for cut in CUTS[len(paths):]:
        problems.append(f'{cut} cut: no script given; every piece gets both cuts (scripts long.md short.md)')
    prev = previous if isinstance(previous, dict) else {}
    before = current_hashes({'script_check': prev})
    passed_before = prev.get('passed') is True and isinstance(prev.get('checked_at'), str)
    were = prev.get('changed_at') if isinstance(prev.get('changed_at'), dict) else {}
    stamp = now()
    changed_at = {}
    for cut, h in hashes.items():
        same_words = passed_before and before.get(cut) == h
        kept_at = were.get(cut) if isinstance(were.get(cut), str) else prev.get('checked_at')
        changed_at[cut] = kept_at if same_words else stamp
    same = bool(hashes) and all(before.get(cut) == h for cut, h in hashes.items())
    kept = prev['checked_at'] if passed_before and same else None
    return {'script_check': {'passed': not problems, 'problems': problems, 'cuts': cuts, 'hashes': hashes,
                             'checked_at': kept or stamp, 'changed_at': changed_at}}


def changed_cuts(previous, hashes):
    """The cuts whose words differ from the hashes the record held."""
    before = current_hashes({'script_check': previous if isinstance(previous, dict) else {}})
    return [cut for cut in CUTS if before.get(cut) and hashes.get(cut) and before[cut] != hashes[cut]]


def pack_patch(pack_dir, sent=False):
    manifest = Path(pack_dir) / '.pack.json'
    if not manifest.is_file():
        raise MakingError(f'{pack_dir} is not a pack made by build.py (no .pack.json)')
    data = json.loads(manifest.read_text(encoding='utf-8'))
    patch = {'pack': {'folder': data['post_folder'], 'files': len(data.get('files') or []), 'packed_at': now()}}
    if data.get('headline'):
        # the title the post goes out under, so the publish watcher can match it
        patch['pack']['headline'] = data['headline']
    if sent:
        patch['pack']['sent_at'] = now()
    return patch


def _cut(cut):
    if cut not in CUTS:
        raise MakingError(f'the cut is long or short, not "{cut}"')
    return cut


def krish_words(words):
    """Krish's own words, as every house override takes them: they start with "Krish"."""
    return isinstance(words, str) and words.strip().lower().startswith('krish')


def recorded_patch(cut, path, seconds=None, script_sha256=None, use_words=None):
    """One recording of one cut. The path is the engine's copy,
    "recordings/<sha256>.<ext>" (recording_match.py writes it so), which
    says exactly which take it was. script_sha256 is the hash of the script
    it was taken from: the current one for its cut (current_hashes), left
    out when the record has none. use_words are Krish's words letting a
    take of older words count as a take of the current ones (older_take)."""
    if not isinstance(path, str) or not path.strip():
        raise MakingError('give the recording\'s path, "recordings/<sha256>.<ext>"')
    rec = {'cut': _cut(cut), 'path': path.strip()}
    seconds = rounded_seconds(seconds)
    if seconds:
        rec['seconds'] = seconds
    if script_sha256:
        if not isinstance(script_sha256, str) or not SHA256.match(script_sha256):
            raise MakingError('a script hash is the 64 lowercase hex characters of a sha256')
        rec['script_sha256'] = script_sha256
    if use_words is not None:
        if not krish_words(use_words) or len(use_words.strip()) > 600:
            raise MakingError('--krish-words are Krish\'s own words, as he said them, starting "Krish" and the date '
                              '(for example "Krish, 2026-10-12: use the take I recorded this morning"), at most 600 characters')
        rec['use_words'] = use_words.strip()
    return {'recordings': [rec]}


ANSWERED = HERE.parent.parent / '.cache' / 'recordings' / 'answered.json'  # recording_match.py's answered book


def older_take(record, cut, path, answered=ANSWERED):
    """Why recording this take would turn a take of older words into a take
    of the current ones, or None: it is on the record already, stamped with
    a script that is not the cut's current one, or the matcher found it was
    recorded before the script last changed (the answered book)."""
    current = current_hashes(record).get(cut)
    for rec in (record.get('recordings') or []) if isinstance(record, dict) else []:
        if isinstance(rec, dict) and rec.get('path') == path and rec.get('script_sha256') and rec['script_sha256'] != current:
            return f'the {cut} take {path} is on the record from a script whose words have changed since'
    sha = (re.findall(r'[0-9a-f]{64}', str(path).lower()) or [None])[0]
    try:
        book = json.loads(Path(answered).read_text(encoding='utf-8'))
    except (OSError, ValueError):
        book = {}
    entry = book.get(sha) if isinstance(book, dict) and sha else None
    if isinstance(entry, dict) and entry.get('older_script'):
        return f'the matcher found the take {path} was recorded before the script last changed ({entry.get("reason") or "an older script"})'
    return None


def drawn_image(path):
    """True when path is a JPEG, PNG or WebP with something in it."""
    try:
        with open(path, 'rb') as handle:
            head = handle.read(12)
    except OSError:
        return False
    return head.startswith(IMAGE_MAGIC) or (head[:4] == b'RIFF' and head[8:12] == b'WEBP')


# The thumbnail each cut carries, as scripts/pages/build.py --thumbs draws it.
THUMB_FOR = {'long': 'wide', 'short': 'tall'}
THUMB_RECEIPT = 'thumbs.json'


def thumb_problem(cut, path):
    """Why `path` is not this cut's drawn thumbnail, or None. It must be a
    JPEG or PNG of the cut's shape (1280 x 720 for the long cut, 1080 x 1920
    for the short), and the drawer's receipt beside it (thumbs.json) must
    list its sha256 as that shape: proof the house drawer drew it, and drew
    it for this cut."""
    if str(HERE.parent / 'quick-edit') not in sys.path:
        sys.path.insert(0, str(HERE.parent / 'quick-edit'))
    import archive  # noqa: E402  image_size and THUMB_SIZE: the one reader of a picture's size
    path = Path(path)
    shape = THUMB_FOR[cut]
    want = archive.THUMB_SIZE[shape]
    if not path.is_file() or not drawn_image(path):
        return f'there is no drawn thumbnail (a JPEG or PNG) at {path}'
    size = archive.image_size(path)
    if size != want:
        got = f'{size[0]} x {size[1]}' if size else 'not a JPEG or PNG this can read'
        return f'{path.name} is {got}, not the {want[0]} x {want[1]} {shape} thumbnail the {cut} cut carries'
    try:
        receipt = json.loads((path.parent / THUMB_RECEIPT).read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return (f'there is no {THUMB_RECEIPT} beside {path.name}, so nothing shows the house drawer drew it: give the file '
                'scripts/pages/build.py --thumbs wrote (WORK/thumbs/thumb-...), not a copy')
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    made = [f for f in receipt.get('files') or [] if isinstance(f, dict) and f.get('sha256') == digest]
    if not made:
        return f'{THUMB_RECEIPT} beside it does not list {path.name}: it was changed after the drawer made it, or is another picture'
    if made[0].get('shape') != shape:
        return f'{path.name} is the drawer\'s {made[0].get("shape")} thumbnail, not the {shape} one the {cut} cut carries'
    return None


def video_patch(cut, name, path, url=None, seconds=None, thumb=None, thumb_url=None, music=None, thumb_file=None):
    """One finished video of one cut, with its thumbnail and its music.
    Krish, 2026-10-12: "I always want a video thumbnail for all video sizes
    produced as an asset every time"; a cut without one leaves the Video
    assets step open. A thumbnail is recorded only with proof it was drawn:
    thumb_file, the drawn image on this machine, of the cut's shape and
    listed in the drawer's thumbs.json beside it (thumb_problem), with or
    without thumb_url, its link in the library. A thumbnail that was never
    drawn, or the other shape's, cannot be recorded."""
    asset = {'cut': _cut(cut), 'name': name, 'path': path}
    if url:
        asset['url'] = url
    seconds = rounded_seconds(seconds)
    if seconds:
        asset['seconds'] = seconds
    if (thumb_url or thumb_file) and not thumb:
        raise MakingError("--thumb-url and --thumb-file need --thumb, the thumbnail's path beside the video in the pack")
    if thumb_url and not str(thumb_url).startswith('https://'):
        raise MakingError('--thumb-url must be an https link')
    if thumb and not thumb_file:
        raise MakingError('--thumb needs --thumb-file, the thumbnail scripts/pages/build.py --thumbs drew on this machine '
                          '(with --thumb-url too, once the library has its link), so a thumbnail that was never drawn is never '
                          'recorded; leave --thumb out until it is drawn')
    if thumb_file:
        why = thumb_problem(asset['cut'], thumb_file)
        if why:
            raise MakingError(f'--thumb-file: {why}. Draw it first (build.py --thumbs), or leave --thumb out and the step says '
                              'the thumbnail is still to make')
    if thumb:
        asset['thumbnail'] = {'path': thumb}
        if thumb_url:
            asset['thumbnail']['url'] = thumb_url
    if music is not None:
        track = str(music).strip()
        if not track or len(track) > 120 or any(ch in track for ch in '\r\n\t'):
            raise MakingError('--music is the track id from config/music-library.json')
        asset['music'] = track
    return {'video_assets': [asset]}


# Krish's board (WORKBENCH.md, "The board"): the questions a tool puts to him.
BOARD_PATH = '/api/workbench'
BOARD_CLIENTS = {'codex': 'codex', 'claude code': 'claude_code'}  # anything else writes as the runner
CLOSED_LANES = ('done', 'archived')


def board_client(by):
    return BOARD_CLIENTS.get(str(by or '').strip().lower(), 'runner')


def board_upsert(items, call=None, by=None):
    """Puts questions on Krish's board without ever reopening one. It reads
    the board first: an item that is done there was answered or closed by
    Krish or a session, so it is left alone; one still open is updated
    without its lane; a new one goes in with its lane as "lane_if_new",
    which the engine uses only when the item does not exist yet, so an item
    archived out of sight stays archived. Returns (written ids, ids left
    alone). Raises MakingError when the board cannot be read or refuses."""
    call = call or _engine_call
    if not items:
        return [], []
    status, text = call('GET', BOARD_PATH, None)
    if status != 200:
        raise MakingError(f'the board could not be read ({status}: {str(text)[:200]})')
    try:
        lanes = {i.get('id'): i.get('lane') for i in (json.loads(text) or {}).get('items') or [] if isinstance(i, dict)}
    except ValueError:
        raise MakingError('the board answered with something that is not JSON')
    send, left, fresh = [], [], {}
    for item in items:
        item = dict(item)
        lane = item.pop('lane', 'on_you')
        if lanes.get(item['id']) in CLOSED_LANES:
            left.append(item['id'])
            continue
        if item['id'] not in lanes:
            item['lane_if_new'] = lane
            fresh[item['id']] = lane
        send.append(item)
    written = []
    for start in range(0, len(send), 50):
        chunk = send[start:start + 50]
        status, text = call('POST', BOARD_PATH, {'action': 'upsert_items', 'client': board_client(by), 'items': chunk})
        if status == 400 and 'lane_required' in str(text):
            # An engine from before lane_if_new: a new item needs its lane.
            chunk = [dict({k: v for k, v in i.items() if k != 'lane_if_new'}, lane=fresh[i['id']]) if i['id'] in fresh else i for i in chunk]
            status, text = call('POST', BOARD_PATH, {'action': 'upsert_items', 'client': board_client(by), 'items': chunk})
        if status != 200:
            raise MakingError(f'the board did not take {len(chunk)} question(s) ({status}: {str(text)[:200]})')
        written += [i['id'] for i in chunk]
    return written, left


def ask_about_older_takes(piece_id, record, cuts, call=None, by=None):
    """One board question for each take on the record whose cut's words just
    changed (cuts): use it, or record that cut again. The same item as
    recording_match.py asks (take-<sha12>, closes_on record), never reopened
    once answered. Returns the item ids written."""
    import recording_match  # the one wording for a take's board question
    folder = ((record or {}).get('pack') or {}).get('folder') or ''
    piece = {'id': piece_id, 'folder': folder, 'scheduled_for': folder[:10] if re.match(r'\d{4}-\d{2}-\d{2}', folder) else None}
    items = []
    for rec in older_takes(record):
        sha = (re.findall(r'[0-9a-f]{64}', str(rec.get('path') or '').lower()) or [None])[0]
        if not sha or rec.get('cut') not in cuts:
            continue
        answer = {'sha256': sha, 'name': Path(str(rec['path'])).name, 'at': rec.get('at'), 'older_script': True, 'piece_id': piece_id,
                  'cut': rec['cut'], 'path': rec['path'],
                  'reason': f'it is on {recording_match.label(piece)} as its {rec["cut"]} cut, but the script\'s words changed after it was recorded, '
                            'so it no longer counts'}
        items.append(recording_match.board_item(answer, [piece]))
    return board_upsert(items, call, by)[0]


def piece_id_of(post_path):
    """The piece id a post.json names, or '' when it names none."""
    try:
        data = json.loads(Path(post_path).read_text(encoding='utf-8-sig'))
    except (OSError, ValueError):
        return ''
    pid = str(data.get('piece_id') or '')
    return pid if UUID.match(pid) else ''


def report(piece_id, patch, label):
    """Used by build.py and send.py: records, and says so in one line; never
    stops the pack when the engine cannot be reached."""
    if not piece_id:
        return
    try:
        post(piece_id, patch)
        print(f'Recorded on the board: {label}')
    except MakingError as error:
        print(f'Not recorded on the board ({label}): {error}', file=sys.stderr)


def self_test():
    fails, count = [], 0

    def check(label, got, want):
        nonlocal count
        count += 1
        if got != want:
            fails.append(f'{label}: got {got!r}, want {want!r}')

    seen = []

    def fake(method, path, body):
        seen.append((method, path, body))
        if 'refuse' in path:
            return 400, json.dumps({'ok': False, 'error': 'bad_patch', 'problems': ['workroom needs an https url']})
        return 200, json.dumps({'ok': True, 'steps': [{'key': 'workroom', 'label': 'Workroom', 'state': 'done', 'link': 'https://x'}, {'key': 'draft', 'label': 'Fact-checked draft', 'state': 'now'}]})

    pid = '904658db-4df2-4537-a0ed-ebe93e081db7'
    out = post(pid, {'workroom': {'url': 'https://claude.ai/artifact/a'}}, fake)
    check('a record is posted to the piece', seen[-1][1], f'/api/content-ideas/{pid}/making')
    check('the engine answer comes back', out.get('ok'), True)
    try:
        post('nope', {}, fake)
        check('a bad id is refused', 'no error', 'error')
    except MakingError as e:
        check('a bad id is refused', 'piece id' in str(e), True)
    try:
        post(pid, {}, lambda m, p, b: fake(m, p + '/refuse', b))
        check('a refusal is an error', 'no error', 'error')
    except MakingError as e:
        check('a refusal says why', 'https url' in str(e), True)
    check('show lists the steps', show(pid, fake).splitlines()[0].startswith('done Workroom'), True)
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        t = Path(tmp)
        (t / '.pack.json').write_text(json.dumps({'post_folder': '2026-10-09 Fri mind.the.gap - X', 'files': [1, 2, 3]}))
        p = pack_patch(t, sent=True)
        check('a pack patch names the folder and count', (p['pack']['folder'], p['pack']['files'], 'sent_at' in p['pack']), ('2026-10-09 Fri mind.the.gap - X', 3, True))
        (t / 'post.json').write_text(json.dumps({'piece_id': pid}))
        check('piece_id is read from post.json', piece_id_of(t / 'post.json'), pid)
        (t / 'post.json').write_text(json.dumps({'piece_id': 'x'}))
        check('a bad piece_id is ignored', piece_id_of(t / 'post.json'), '')

        # The scripts: the cut comes from the position, both are required.
        for name in ('long.md', 'short.md', 'script.md', 'other.md', 'tall.md'):
            (t / name).write_text('x', encoding='utf-8')
        ran, warned = [], []
        ok = lambda cut, path: (ran.append((cut, Path(path).name)), (0, ''))[1]
        both = scripts_patch([t / 'long.md', t / 'short.md'], ok, warned.append)['script_check']
        check('both scripts pass and are checked by position', (both['passed'], both['cuts'], ran), (True, ['long', 'short'], [('long', 'long.md'), ('short', 'short.md')]))
        ran.clear()
        plain = scripts_patch([t / 'script.md', t / 'other.md'], ok, warned.append)['script_check']
        check('names that say no cut take it from the position', (plain['passed'], ran), (True, [('long', 'script.md'), ('short', 'other.md')]))
        check('names that say no cut raise no warning', warned, [])
        ran.clear()
        swapped = scripts_patch([t / 'tall.md', t / 'long.md'], ok, warned.append)['script_check']
        check('a name that contradicts its position is checked by the position', ran, [('long', 'tall.md'), ('short', 'long.md')])
        check('and warns once for each such file', (len(warned), 'tall.md' in warned[0], 'long.md' in warned[1]), (2, True, True))
        check('a warning alone does not fail the check', swapped['passed'], True)
        one = scripts_patch([t / 'long.md'], ok, warned.append)['script_check']
        check('one script never passes: the short cut is required', (one['passed'], one['cuts'], 'short cut: no script given' in one['problems'][0]), (False, ['long'], True))
        gone = scripts_patch([t / 'long.md', t / 'missing.md'], ok, warned.append)['script_check']
        check('a script that is not there fails', (gone['passed'], gone['problems']), (False, ['short cut: missing.md is not there']))
        bad = lambda cut, path: (1, f'NOT READY  {path}\n  - the {cut} cut runs 600 spoken words') if cut == 'short' else (0, '')
        failed = scripts_patch([t / 'long.md', t / 'short.md'], bad, warned.append)['script_check']
        check('either check failing records passed false, with its reason', (failed['passed'], failed['problems'][-1]), (False, 'short.md: - the short cut runs 600 spoken words'))
        for wrong in ([], [t / 'long.md', t / 'short.md', t / 'other.md']):
            try:
                scripts_patch(wrong, ok, warned.append)
                check(f'{len(wrong)} scripts is refused', 'no error', 'error')
            except MakingError as e:
                check(f'{len(wrong)} scripts is refused', 'long cut first' in str(e), True)
        # The real story check, once: a two-line script is no 3-minute cut.
        real = scripts_patch([t / 'long.md', t / 'short.md'], warn=warned.append)['script_check']
        check('the real story check fails a script that is far too short', (real['passed'], any('long.md' in x for x in real['problems'])), (False, True))

    # The script hash: the same words give the same hash on every machine.
    plain_words = 'Warner, Universal and Sony sued Suno.\nCaf\u00e9 owners asked who gets paid.\n'
    check('hash: a script already in shape hashes as its bytes', script_hash(plain_words), hashlib.sha256(plain_words.encode('utf-8')).hexdigest())
    for label, variant in (('CRLF line endings', plain_words.replace('\n', '\r\n')),
                           ('trailing spaces and tabs', plain_words.replace('\n', '  \t\n')),
                           ('blank lines at both ends', '\n\n  \n' + plain_words + '\n\n'),
                           ('no final line ending', plain_words.rstrip('\n')),
                           ('decomposed accents (NFD)', unicodedata.normalize('NFD', plain_words)),
                           ('a byte order mark', '\ufeff' + plain_words)):
        check(f'hash: {label} change nothing', script_hash(variant), script_hash(plain_words))
    check('hash: a changed word changes it', script_hash(plain_words.replace('Sony', 'EMI')) != script_hash(plain_words), True)
    check('hash: a blank line inside the script is kept', script_hash(plain_words.replace('\n', '\n\n', 1)) != script_hash(plain_words), True)
    check('hash: nothing at all', script_hash('  \r\n'), hashlib.sha256(b'').hexdigest())

    with tempfile.TemporaryDirectory() as tmp:
        t = Path(tmp)
        (t / 'long.md').write_text('the long script\n', encoding='utf-8')
        (t / 'short.md').write_text('the short script\n', encoding='utf-8')
        ok = lambda cut, path: (0, '')
        long_sha, short_sha = script_hash('the long script\n'), script_hash('the short script\n')
        first = scripts_patch([t / 'long.md', t / 'short.md'], ok, warned.append)['script_check']
        check('scripts: each script\'s hash is recorded', first['hashes'], {'long': long_sha, 'short': short_sha})
        earlier = '2026-10-11T19:14:16Z'
        prev = {'passed': True, 'checked_at': earlier, 'problems': [], 'hashes': {'long': long_sha, 'short': short_sha}}
        again = scripts_patch([t / 'long.md', t / 'short.md'], ok, warned.append, previous=prev)['script_check']
        check('scripts: the same words checked again keep checked_at', again['checked_at'], earlier)
        legacy = scripts_patch([t / 'long.md', t / 'short.md'], ok, warned.append, previous={'passed': True, 'checked_at': earlier, 'problems': []})['script_check']
        # The second reviewer's case (2026-10-12): Monday's record held a check
        # from 11 October with no hashes, and the long words changed on the
        # 12th. A check with no hashes proves nothing about the words.
        check('scripts: a record with no hashes yet counts as changed: checked_at and changed_at are now, the hashes recorded',
              (legacy['checked_at'] != earlier, sorted(legacy['changed_at'].values()) == [legacy['checked_at']] * 2, legacy['hashes']['long']),
              (True, True, long_sha))
        check('scripts: the same words checked again keep each cut\'s changed_at too', again['changed_at'], {'long': earlier, 'short': earlier})
        (t / 'short.md').write_text('the short script, changed\n', encoding='utf-8')
        moved = scripts_patch([t / 'long.md', t / 'short.md'], ok, warned.append, previous=prev)['script_check']
        check('scripts: changed words move checked_at', moved['checked_at'] != earlier, True)
        check('scripts: only the changed cut\'s changed_at moves; the other keeps its own time',
              (moved['changed_at']['long'], moved['changed_at']['short'] != earlier), (earlier, True))
        later = scripts_patch([t / 'long.md', t / 'short.md'], ok, warned.append, previous=moved)['script_check']
        check('scripts: checked again, each cut keeps the time its words last changed', later['changed_at'], moved['changed_at'])
        check('scripts: and the changed cut is named', changed_cuts(prev, moved['hashes']), ['short'])
        failed_before = scripts_patch([t / 'long.md', t / 'short.md'], ok, warned.append, previous={**prev, 'passed': False})['script_check']
        check('scripts: a check that failed before keeps nothing', failed_before['checked_at'] != earlier, True)
        check('scripts: no record before, nothing changed', changed_cuts(None, moved['hashes']), [])

    # Who wrote it: --by, else MAKING_BY, else Codex inside Codex, else Claude Code.
    check('default_by: MAKING_BY first', default_by({BY_ENV: 'Krish', 'CODEX_HOME': '/x'}), 'Krish')
    check('default_by: inside Codex, Codex', default_by({'CODEX_SANDBOX': 'seatbelt', 'PATH': '/bin'}), 'Codex')
    check('default_by: anywhere else, Claude Code', default_by({'PATH': '/bin', 'HOME': '/root'}), 'Claude Code')
    check('default_by: an empty MAKING_BY is no name', default_by({BY_ENV: '  ', 'CODEX_CI': '1'}), 'Codex')
    saved = {k: os.environ.pop(k) for k in list(os.environ) if k == BY_ENV or k.startswith('CODEX')}
    try:
        post(pid, {'workroom': {'url': 'https://claude.ai/artifact/a'}}, fake)
        check('a write with nobody named is by Claude Code', seen[-1][2].get('by'), 'Claude Code')
        os.environ['CODEX_TEST_MARKER'] = '1'
        post(pid, {'workroom': {'url': 'https://claude.ai/artifact/a'}}, fake)
        check('a write from inside Codex is by Codex, for build.py and send.py too', seen[-1][2].get('by'), 'Codex')
        os.environ.pop('CODEX_TEST_MARKER', None)
        os.environ[BY_ENV] = 'Codex'
        post(pid, {'workroom': {'url': 'https://claude.ai/artifact/a'}}, fake)
        check('MAKING_BY names the writer, for build.py and send.py too', seen[-1][2].get('by'), 'Codex')
        post(pid, {'workroom': {'url': 'https://claude.ai/artifact/a'}}, fake, by='Krish')
        check('a name given beats MAKING_BY', seen[-1][2].get('by'), 'Krish')
        check('the patch itself is untouched', seen[-1][2].get('workroom'), {'url': 'https://claude.ai/artifact/a'})
        try:
            post(pid, {'workroom': {'url': 'https://claude.ai/artifact/a'}}, fake, by='x' * 61)
            check('a name over 60 characters is refused', 'no error', 'error')
        except MakingError as e:
            check('a name over 60 characters is refused', '60 characters' in str(e), True)
    finally:
        os.environ.pop(BY_ENV, None)
        os.environ.pop('CODEX_TEST_MARKER', None)
        os.environ.update(saved)

    # A 409 (the piece changed under the write) is sent once more, then said.
    answers = []

    def racing(method, path, body):
        seen.append((method, path, body))
        return answers.pop(0)
    answers[:] = [(409, json.dumps({'ok': False, 'error': 'stale_row'})), (200, json.dumps({'ok': True, 'steps': []}))]
    before = len(seen)
    post(pid, {'workroom': {'url': 'https://claude.ai/artifact/a'}}, racing, by='Codex')
    check('409: sent once more, and recorded', len(seen) - before, 2)
    answers[:] = [(409, '{}'), (409, '{}'), (200, '{}')]
    try:
        post(pid, {'workroom': {'url': 'https://claude.ai/artifact/a'}}, racing, by='Codex')
        check('409 twice: an error, never a third try', 'no error', 'error')
    except MakingError as e:
        check('409 twice: an error, never a third try', ('run it again' in str(e), len(answers)), (True, 1))

    def run(argv, engine=None):
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = main(argv, call=engine or fake)
        return code, err.getvalue()

    with tempfile.TemporaryDirectory() as tmp:
        sys.path.insert(0, str(HERE.parent / 'quick-edit'))
        import archive
        thumbs = Path(tmp) / 'thumbs'
        thumbs.mkdir()
        wide_thumb, drawn = thumbs / 'thumb-wide-1280x720.jpg', thumbs / 'thumb-tall-1080x1920.jpg'
        wide_thumb.write_bytes(archive.jpeg_header(1280, 720))
        drawn.write_bytes(archive.jpeg_header(1080, 1920))
        (thumbs / THUMB_RECEIPT).write_text(json.dumps({'files': [
            {'file': wide_thumb.name, 'shape': 'wide', 'sha256': hashlib.sha256(wide_thumb.read_bytes()).hexdigest()},
            {'file': drawn.name, 'shape': 'tall', 'sha256': hashlib.sha256(drawn.read_bytes()).hexdigest()}]}))
        not_image = Path(tmp) / 'not a thumbnail.jpg'
        not_image.write_bytes(b'')
        panel = thumbs / 'pileup-16x9.png'
        panel.write_bytes(b'\x89PNG\r\n\x1a\n' + (13).to_bytes(4, 'big') + b'IHDR' + (1314).to_bytes(4, 'big') + (1080).to_bytes(4, 'big') + b'\x08\x02\x00\x00\x00')
        copied = Path(tmp) / 'thumb-wide-1280x720.jpg'
        copied.write_bytes(wide_thumb.read_bytes())
        code, _ = run(['--by', 'Codex', pid, 'video', 'long', 'Substack video', '3 Video/long.mp4', '--url', 'https://drive.google.com/v',
                       '--seconds', '184', '--thumb', '3 Video/thumb-wide-1280x720.jpg', '--thumb-file', str(wide_thumb),
                       '--thumb-url', 'https://drive.google.com/t', '--music', 'track-one'])
        body = seen[-1][2]
        check('video: written by Codex', (code, body.get('by')), (0, 'Codex'))
        check('video: the asset carries its thumbnail, music and length', body['video_assets'][0],
              {'cut': 'long', 'name': 'Substack video', 'path': '3 Video/long.mp4', 'url': 'https://drive.google.com/v', 'seconds': 184,
               'thumbnail': {'path': '3 Video/thumb-wide-1280x720.jpg', 'url': 'https://drive.google.com/t'}, 'music': 'track-one'})
        code, _ = run([pid, 'video', 'short', 'Shorts video', '3 Video/short.mp4', '--thumb', '3 Video/thumb-tall-1080x1920.jpg',
                       '--thumb-file', str(drawn), '--seconds', '91.6'])
        check('video: a drawn thumbnail on this machine is proof; its path is what is recorded', (code, seen[-1][2]['video_assets'][0]['thumbnail']),
              (0, {'path': '3 Video/thumb-tall-1080x1920.jpg'}))
        check('video: a fractional length is rounded', seen[-1][2]['video_assets'][0]['seconds'], 92)
        check('video: no music given, none sent', 'music' in seen[-1][2]['video_assets'][0], False)
        before = len(seen)
        code, err = run([pid, 'video', 'short', 'Shorts video', '3 Video/short.mp4', '--thumb', '3 Video/thumb-tall-1080x1920.jpg'])
        check('video: --thumb with no proof it was drawn is refused, and nothing is sent', (code, 'never drawn' in err, len(seen)), (1, True, before))
        code, err = run([pid, 'video', 'short', 'Shorts video', '3 Video/short.mp4', '--thumb', 't.jpg', '--thumb-url', 'https://drive.google.com/t'])
        check('video: a thumbnail link alone is no proof either: --thumb-file is always needed', (code, 'never drawn' in err, len(seen)), (1, True, before))
        code, err = run([pid, 'video', 'short', 'Shorts video', '3 Video/short.mp4', '--thumb', 't.jpg', '--thumb-file', str(wide_thumb)])
        check('video: the wide thumbnail given as the short cut\'s is refused', (code, 'not the 1080 x 1920' in err, len(seen)), (1, True, before))
        code, err = run([pid, 'video', 'long', 'Substack video', '3 Video/long.mp4', '--thumb', 't.jpg', '--thumb-file', str(panel)])
        check('video: a kit panel given as the long cut\'s thumbnail is refused', (code, 'not the 1280 x 720' in err, len(seen)), (1, True, before))
        code, err = run([pid, 'video', 'long', 'Substack video', '3 Video/long.mp4', '--thumb', 't.jpg', '--thumb-file', str(copied)])
        check('video: a copy with no thumbs.json beside it is refused', (code, 'no thumbs.json beside' in err, len(seen)), (1, True, before))
        receipt = json.loads((thumbs / THUMB_RECEIPT).read_text())
        receipt['files'][1]['shape'] = 'wide'
        (thumbs / THUMB_RECEIPT).write_text(json.dumps(receipt))
        code, err = run([pid, 'video', 'short', 'Shorts video', '3 Video/short.mp4', '--thumb', 't.jpg', '--thumb-file', str(drawn)])
        check('video: a thumbnail the receipt names as the other shape is refused', (code, 'drawer\'s wide thumbnail' in err, len(seen)), (1, True, before))
        receipt['files'][1]['shape'] = 'tall'
        (thumbs / THUMB_RECEIPT).write_text(json.dumps(receipt))
        code, err = run([pid, 'video', 'short', 'Shorts video', '3 Video/short.mp4', '--thumb', 't.jpg', '--thumb-file', str(Path(tmp) / 'missing.jpg')])
        check('video: a --thumb-file that is not there is refused', (code, 'no drawn thumbnail' in err, len(seen)), (1, True, before))
        code, err = run([pid, 'video', 'short', 'Shorts video', '3 Video/short.mp4', '--thumb', 't.jpg', '--thumb-file', str(not_image)])
        check('video: an empty --thumb-file is refused', (code, 'no drawn thumbnail' in err, len(seen)), (1, True, before))
        code, err = run([pid, 'video', 'short', 'Shorts video', '3 Video/short.mp4', '--thumb-url', 'https://drive.google.com/t'])
        check('video: a thumbnail link with no thumbnail path is refused, and nothing is sent', (code, 'need --thumb' in err, len(seen)), (1, True, before))
        code, err = run([pid, 'video', 'short', 'Shorts video', '3 Video/short.mp4', '--thumb', 't.jpg', '--thumb-url', 'http://plain'])
        check('video: a thumbnail link must be https', (code, 'https' in err, len(seen)), (1, True, before))
        code, err = run([pid, 'video', 'wide', 'Shorts video', '3 Video/short.mp4'])
        check('video: a cut that is neither long nor short is refused', (code, 'long or short' in err, len(seen)), (1, True, before))
        code, _ = run([pid, 'video', 'short', 'Shorts video', '3 Video/short.mp4'])
        check('video: a cut with no thumbnail yet is still recorded, without one', (code, 'thumbnail' in seen[-1][2]['video_assets'][0]), (0, False))

    run(['--by', 'Codex', pid, 'recorded', 'short', 'recordings/' + 'a' * 64 + '.mp4', '--seconds', '118'])
    check('recorded: the engine copy, its length and who recorded it (no hashes on the record, no stamp)', (seen[-1][2]['recordings'], seen[-1][2]['by']),
          ([{'cut': 'short', 'path': 'recordings/' + 'a' * 64 + '.mp4', 'seconds': 118}], 'Codex'))
    hashed = {'script_check': {'passed': True, 'checked_at': '2026-10-11T19:14:16Z', 'problems': [], 'hashes': {'long': 'b' * 64, 'short': 'c' * 64}},
              'recordings': [{'cut': 'long', 'path': 'recordings/' + 'd' * 64 + '.mp4', 'script_sha256': 'e' * 64},
                             {'cut': 'short', 'path': 'recordings/' + 'f' * 64 + '.mp4', 'script_sha256': 'c' * 64}]}

    def holds(method, path, body):
        seen.append((method, path, body))
        if method == 'GET':
            return 200, json.dumps({'ok': True, 'making': hashed, 'steps': [{'key': 'record', 'label': 'Recorded', 'state': 'now', 'note': 'long cut recorded from an older script'}]})
        return 200, json.dumps({'ok': True, 'steps': []})
    run(['--by', 'Codex', pid, 'recorded', 'long', 'recordings/' + 'a' * 64 + '.mp4', '--seconds', '203.4667'], holds)
    check('recorded: stamped with the current hash for its cut, and a fractional length rounded',
          seen[-1][2]['recordings'], [{'cut': 'long', 'path': 'recordings/' + 'a' * 64 + '.mp4', 'seconds': 203, 'script_sha256': 'b' * 64}])
    shown = show(pid, holds)
    check('show: a take of an older script is named', ('older script: the long take recordings/' + 'd' * 64 in shown, 'f' * 64 in shown), (True, False))
    # The second reviewer's case: recording a take already on the record from
    # an older script would silently make it count. Refused without his words.
    before = len(seen)
    code, err = run(['--by', 'Codex', pid, 'recorded', 'long', 'recordings/' + 'd' * 64 + '.mp4'], holds)
    check('recorded: a take on the record from an older script is refused, nothing sent', (code, 'Krish records that cut again' in err,
          sum(1 for m, _, _ in seen[before:] if m == 'POST')), (1, True, 0))
    code, err = run(['--by', 'Codex', pid, 'recorded', 'long', 'recordings/' + 'd' * 64 + '.mp4', '--krish-words', 'use it'], holds)
    check('recorded: words that are not Krish\'s are refused', (code, 'starting "Krish"' in err), (1, True))
    words = 'Krish, 2026-10-12: a self-test stand-in, not his words'
    code, _ = run(['--by', 'Codex', pid, 'recorded', 'long', 'recordings/' + 'd' * 64 + '.mp4', '--krish-words', words], holds)
    check('recorded: with his words it counts, stamped with the current script, his words on the take',
          (code, seen[-1][2]['recordings'][0].get('script_sha256'), seen[-1][2]['recordings'][0].get('use_words')), (0, 'b' * 64, words))
    with tempfile.TemporaryDirectory() as tmp:
        book = Path(tmp) / 'answered.json'
        book.write_text(json.dumps({'9' * 64: {'status': 'unsure', 'older_script': True, 'reason': 'recorded before the script last changed'}}))
        check('older_take: the matcher\'s book naming a take of older words is a reason too',
              ('recorded before the script last changed' in (older_take(hashed, 'long', 'recordings/' + '9' * 64 + '.mov', book) or ''),
               older_take(hashed, 'long', 'recordings/' + '8' * 64 + '.mov', book)), (True, None))

    # The board: a question is never reopened once answered.
    board_items = {'items': [{'id': 'take-done', 'lane': 'done'}, {'id': 'take-open', 'lane': 'on_you'}]}
    board_sent = []

    def board(method, path, body):
        if method == 'GET' and path == BOARD_PATH:
            return 200, json.dumps(board_items)
        board_sent.append(body)
        return 200, json.dumps({'ok': True})
    asked = [{'id': i, 'lane': 'on_you', 'title': 't', 'detail': 'd'} for i in ('take-done', 'take-open', 'take-new')]
    written, left = board_upsert(asked, board, 'Recordings lane')
    sent_items = {i['id']: i for i in board_sent[-1]['items']}
    check('board: an item done on the board is left alone; an open one is updated without its lane; a new one goes in on him',
          (left, sorted(sent_items), 'lane' in sent_items['take-open'], 'lane_if_new' in sent_items['take-open'], sent_items['take-new'].get('lane_if_new'),
           'lane' in sent_items['take-new'], board_sent[-1]['client']),
          (['take-done'], ['take-new', 'take-open'], False, False, 'on_you', False, 'runner'))
    old_engine = []

    def older_board(method, path, body):
        if method == 'GET':
            return 200, json.dumps({'items': []})
        old_engine.append(body)
        return (400, json.dumps({'ok': False, 'error': 'lane_required'})) if len(old_engine) == 1 else (200, '{"ok": true}')
    board_upsert(asked[2:], older_board, 'Codex')
    check('board: an engine from before lane_if_new gets the lane for a new item, once', (len(old_engine), old_engine[-1]['items'][0].get('lane')), (2, 'on_you'))
    try:
        recorded_patch('long', 'recordings/x.mp4', None, 'not-a-hash')
        check('recorded: a script hash that is not a sha256 is refused', 'no error', 'error')
    except MakingError as e:
        check('recorded: a script hash that is not a sha256 is refused', 'sha256' in str(e), True)
    code, err = run([pid, 'recorded', 'long', 'recordings/x.mp4', '--seconds', '-3'])
    check('recorded: a length below zero is refused', (code, 'more than 0' in err), (1, True))

    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / 'long.md').write_text('the long script\n', encoding='utf-8')
        (Path(tmp) / 'short.md').write_text('a changed short script\n', encoding='utf-8')
        hashed['script_check']['hashes'] = {'long': script_hash('the long script\n'), 'short': 'c' * 64}
        quiet_check = lambda cut, path: (0, '')
        real_check = globals()['_story_check']
        globals()['_story_check'] = quiet_check  # the words are what is under test here, not story_check
        try:
            code, err = run([pid, 'scripts', str(Path(tmp) / 'long.md'), str(Path(tmp) / 'short.md')], holds)
        finally:
            globals()['_story_check'] = real_check
        sent = next(b for m, _, b in reversed(seen) if m == 'POST' and b and 'script_check' in b)['script_check']
        check('scripts: the record is read first, and a changed cut is said', (code, seen[-2][0] if 'asked Krish' not in err else 'GET',
              'the short script\'s words changed' in err), (0, 'GET', True))
        check('scripts: changed words move checked_at, and the hashes go with the check',
              (sent['checked_at'] != '2026-10-11T19:14:16Z', sent['hashes']['short']), (True, script_hash('a changed short script\n')))

    # `scripts` asks Krish about a take on the record of the words that just changed.
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / 'long.md').write_text('the long script, changed again\n', encoding='utf-8')
        (Path(tmp) / 'short.md').write_text('a changed short script\n', encoding='utf-8')
        new_long = script_hash('the long script, changed again\n')
        old_take = {'cut': 'long', 'path': 'recordings/' + '7' * 64 + '.mp4', 'at': '2026-10-12T11:00:00Z', 'script_sha256': script_hash('the long script\n')}
        asked_posts = []

        def changing(method, path, body):
            if path == BOARD_PATH:
                if method == 'GET':
                    return 200, json.dumps({'items': []})
                asked_posts.append(body)
                return 200, json.dumps({'ok': True})
            if method == 'GET':
                return 200, json.dumps({'ok': True, 'making': {**hashed, 'recordings': [old_take]}, 'steps': []})
            after = {**hashed, 'script_check': body['script_check'], 'recordings': [old_take],
                     'pack': {'folder': '2026-10-12 Mon follow.the.money - Who gets paid for AI songs'}}
            return 200, json.dumps({'ok': True, 'making': after, 'steps': []})
        globals()['_story_check'], real_check = (lambda cut, path: (0, '')), globals()['_story_check']
        try:
            code, err = run(['--by', 'Claude Code', pid, 'scripts', str(Path(tmp) / 'long.md'), str(Path(tmp) / 'short.md')], changing)
        finally:
            globals()['_story_check'] = real_check
        item = (asked_posts[-1]['items'][0] if asked_posts else {})
        check('scripts: a take of the long words that just changed is one question on the board, tied to the piece, closed by Record',
              (code, item.get('id'), item.get('idea_id'), item.get('closes_on'), item.get('lane_if_new'), 'Mon 12 Oct' in item.get('detail', ''),
               asked_posts[-1]['client'] if asked_posts else None, new_long != old_take['script_sha256']),
              (0, 'take-' + '7' * 12, pid, 'record', 'on_you', True, 'claude_code', True))

    run(['--by', 'Codex', pid, 'session', 'https://chatgpt.com/codex/tasks/x'])
    check('session: the session says who runs it', seen[-1][2]['session'], {'url': 'https://chatgpt.com/codex/tasks/x', 'by': 'Codex'})
    if fails:
        print('making self-test FAILED:\n  ' + '\n  '.join(fails))
        return 1
    print(f'making self-test passed: {count} checks')
    return 0


def main(argv=None, call=None):
    ap = argparse.ArgumentParser(description="Record where a piece is, for Control Center's board.")
    ap.add_argument('piece_id', nargs='?')
    ap.add_argument('what', nargs='?', choices=['show', 'workroom', 'publish-manager', 'visual-gate', 'scripts', 'pack', 'recorded', 'video', 'posted', 'session'])
    ap.add_argument('args', nargs='*')
    ap.add_argument('--by', help=f'who is writing: Codex, Claude Code (default: {BY_ENV}, else {CODEX_BY} inside Codex, else {DEFAULT_BY})')
    ap.add_argument('--sent', action='store_true', help='with pack: the pack was sent to the library')
    ap.add_argument('--seconds', type=float, help='with recorded or video: how long it runs, in seconds (a fraction is rounded)')
    ap.add_argument('--url', help='with video: the https link to the finished video')
    ap.add_argument('--thumb', metavar='PATH', help="with video: the thumbnail's path, beside the video (every cut has one); "
                    'needs --thumb-file or --thumb-url')
    ap.add_argument('--thumb-file', metavar='LOCAL_PATH', help='with video and --thumb: the drawn thumbnail on this machine, which must be there')
    ap.add_argument('--thumb-url', metavar='URL', help="with video and --thumb: the thumbnail's https link")
    ap.add_argument('--music', metavar='TRACK_ID', help='with video: the licensed track behind it (config/music-library.json)')
    ap.add_argument('--krish-words', metavar='WORDS', help='with recorded: Krish\'s own words, starting "Krish" and the date, letting a take '
                    'of older words count as a take of the current script; recorded on the take')
    ap.add_argument('--self-test', action='store_true')
    a = ap.parse_args(argv)
    if a.self_test:
        return self_test()
    if not a.piece_id or not a.what:
        ap.error('give PIECE_ID and what to record')
    try:
        by = who(a.by)
        if a.what == 'show':
            print(show(a.piece_id, call))
            return 0
        if a.what in ('workroom', 'publish-manager'):
            if len(a.args) != 1:
                ap.error('give the https link')
            patch = {a.what.replace('-', '_'): {'url': a.args[0]}}
        elif a.what == 'visual-gate':
            patch = visual_gate_patch(a.args[0])
        elif a.what == 'scripts':
            # The record first: checked_at stays put while the words do.
            previous = record_of(a.piece_id, call).get('script_check')
            patch = scripts_patch(a.args, previous=previous)
            changed = changed_cuts(previous, patch['script_check']['hashes'])
            for cut in changed:
                print(f'making: the {cut} script\'s words changed since the last check, so a {cut} take '
                      f'recorded from the older words no longer counts', file=sys.stderr)
        elif a.what == 'pack':
            patch = pack_patch(a.args[0], a.sent)
        elif a.what == 'recorded':
            if len(a.args) != 2:
                ap.error('give the cut and the recording\'s path: recorded long "recordings/<sha256>.mp4"')
            cut = _cut(a.args[0])
            record = record_of(a.piece_id, call)
            # A take of older words never becomes a take of the current ones
            # without Krish's words (CADENCE, misread 11).
            why = older_take(record, cut, a.args[1].strip())
            if why and a.krish_words is None:
                raise MakingError(f'{why}, so recording it would count it as a take of the current words. Krish records that cut again, '
                                  'or says in words to use this take: give them with --krish-words "Krish, YYYY-MM-DD: his words"')
            # Stamped with the script it was taken from: the current one for its cut.
            patch = recorded_patch(cut, a.args[1], a.seconds, current_hashes(record).get(cut), a.krish_words)
        elif a.what == 'video':
            patch = video_patch(a.args[0], a.args[1], a.args[2], url=a.url, seconds=a.seconds,
                                thumb=a.thumb, thumb_url=a.thumb_url, music=a.music, thumb_file=a.thumb_file)
        elif a.what == 'posted':
            channel = a.args[0]
            if channel not in CHANNELS:
                ap.error(f'channel must be one of {", ".join(CHANNELS)}')
            patch = {'channels': {channel: {'url': a.args[1]} if len(a.args) > 1 else {}}}
        else:
            patch = {'session': {'url': a.args[0], 'by': by}}
        data = post(a.piece_id, patch, call, by=by)
        if a.what == 'scripts' and changed:
            # A take on the record of the words that just changed: one question for Krish.
            try:
                for item in ask_about_older_takes(a.piece_id, data.get('making') or {}, changed, call, by):
                    print(f'making: asked Krish on the board whether to use the older take ({item})', file=sys.stderr)
            except MakingError as error:
                print(f'making: the scripts are recorded, but the question about the older take is not on the board: {error}', file=sys.stderr)
    except (MakingError, IndexError, OSError) as error:
        print(f'making: {error}', file=sys.stderr)
        return 1
    for step in data.get('steps') or []:
        print(f"{step['state']:6} {step['label']}" + (f"  {step['note']}" if step.get('note') else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main())
