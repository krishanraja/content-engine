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
    python making.py PIECE_ID scripts long.md short.md       # story_check on each, by position, with the
                                                             # piece's series, and each script's sha256; records
    python making.py PIECE_ID pack PACK_FOLDER [--sent]      # build.py and send.py call this themselves
    python making.py PIECE_ID recorded long "recordings/<sha256>.mp4" [--seconds N] [--krish-words "Krish, DATE: ..."]
    python making.py PIECE_ID video long NAME PATH [--url https://...] [--seconds N]
                     [--thumb PATH --thumb-file LOCAL_PATH [--thumb-url https://...]] [--music TRACK_ID]
    python making.py PIECE_ID posted substack https://...    # after Krish posted it
    python making.py PIECE_ID session https://claude.ai/code/session_...
    python making.py PIECE_ID read-back long --readers "reader A, ..." "reader B, ..." [--at TIME]
    python making.py PIECE_ID read-back long --krish-words "Krish, DATE: his words" [--readers ...]
    python making.py PIECE_ID drive-link long https://drive.google.com/file/d/<id>/view [--thumb-url https://drive.google.com/file/d/<thumb id>/view]
    python making.py PIECE_ID teleprompter long --folder ID --script ID --sha SHA256 [--title TITLE]
                     [--folder-name NAME] [--sent-at TIME]
    python making.py PIECE_ID teleprompter long [--folder ID] --error "what Teleprompter said"   # a send that failed
    python making.py --by Codex PIECE_ID ...                 # who wrote it
    python making.py --self-test

Every write says who wrote it: --by NAME, else the MAKING_BY environment
variable, else "Codex" inside Codex (any CODEX* environment variable, the way
send.py tells), else "Claude Code". So build.py and send.py, which record
through report(), credit Codex when Codex runs them, with nothing to set.

The scripts' words. `scripts` runs story_check.py on each script with the
piece's series (--series, its lane_slot from the engine, or --series given
here), so a script that does not open with its series line, or says "I'm
Krish" again after it, fails (house rule SERIES_OPENER). It records the
sha256 of each script's words
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
on the take. It also refuses a path the engine's recordings store does not
hold (GET /api/library/recordings, by the take's sha256): a take is recorded
only once it is in the store, where every later session fetches it from. A
take over 500 MiB never reaches the store; recording_match.py --inbox
--record places such a take on a home computer. Every write is retried once
when the engine answers 409 (the piece changed under it).

A video asset carries its thumbnail (Krish, 2026-10-12: "I always want a video
thumbnail for all video sizes produced as an asset every time") and the
licensed music track behind it. The Video assets step is done only when both
cuts are there, each with its thumbnail. A thumbnail is recorded only with
proof it was drawn: --thumb-file, the file build.py --thumbs drew on this
machine, of the cut's shape (1280 x 720 long, 1080 x 1920 short) and listed
in the thumbs.json beside it, with --thumb-url once the library has its link.

The read-back (house rule R7, the hard gate on every script). Krish,
2026-10-12: "Every single script should be understandable by a 12-year-old.
I can't even understand what I'm reading off the teleprompter. I thought we
had hard gates for this?" Once story_check passes, two fresh readers, each
an ordinary 12-year-old hearing the script once, list whatever loses them
and retell it (make-piece, "The Scripts step", has their words). `read-back`
records a pass for one cut: who read it, when, "nothing lost", and the hash
of the words they heard (script_check.read_back). It refuses a cut whose
check has not passed with its hash. `scripts` keeps a cut's read-back while
its words are the same; new words need a new one, and teleprompter_send.py
sends no cut without it.

Krish's own sign-off stands in for the readers when he gives it in words
(Krish, 2026-10-14, after ten rounds in which one reader prompt never once
said nothing lost it: "Fix it in the engine"). `read-back CUT --krish-words
"Krish, DATE: his words"` records it as what it is: found "approved by
Krish", with his words, never as the readers' "nothing lost". Readers who
did hear it may be listed beside it.

Teleprompter (Krish, 2026-10-12: "Also note that Descript is permanently
gone, teleprompter.com is permanently in, connected via MCP here").
`teleprompter` records what teleprompter_send.py put in his teleprompter.com
account for one cut: the piece's folder and the cut's script, its title and
the hash of the words it holds. Ids are Teleprompter's uppercase UUIDs; a
folder other than the one the record holds for the piece is refused. With
--error it records a send that failed, with when it failed (failed_at),
keeping the script the cut already had, and with --folder the folder
create_folder made before the send failed, so the next send never makes a
second. The Teleprompter state never holds a step back; `show` prints it.
Descript was retired on 2026-10-12, and its subcommand with it.

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
MAX_TEXT = 600  # the engine's limit on a line of text (_making.ts)


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
    lines.extend(read_back_lines(record))
    lines.extend(teleprompter_lines(record))
    return '\n'.join(lines)


# Teleprompter: what teleprompter_send.py put in Krish's teleprompter.com account for each cut.
TELEPROMPTER_ID = re.compile(r'^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$')  # the engine's rule
MAX_NAME = 200  # Teleprompter's limit on a folder name and a script title
CUT_NAME = {'long': '3-minute', 'short': '90-second'}


def _tp_id(value, what):
    """A Teleprompter id, given in any case, as the uppercase UUID it is."""
    text = str(value or '').strip().upper()
    if not TELEPROMPTER_ID.match(text):
        raise MakingError(f'{what} is a Teleprompter id, an uppercase UUID (8-4-4-4-12 hexadecimal characters), not "{value}"')
    return text


def _time(value, what):
    try:
        datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    except ValueError:
        raise MakingError(f'{what} is a time like 2026-10-12T15:34:07Z, not "{value}"')
    return str(value)


def _name(value, what):
    text = ' '.join(str(value or '').split())
    if not text or len(text) > MAX_NAME:
        raise MakingError(f'{what} is one line of 1 to {MAX_NAME} characters')
    return text


def teleprompter_state(record, cut):
    """(state, entry) for one cut. state is 'in' when Teleprompter holds the
    words the scripts' check passed, 'older' when it holds words that
    changed since, 'failed' when the last send failed, 'missing' when it was
    never sent, and None when the check has not passed with hashes (nothing
    to send yet). The engine's teleprompterStates
    (apps/control-plane/api/_making.ts)."""
    record = record if isinstance(record, dict) else {}
    check = record.get('script_check')
    current = current_hashes(record).get(cut) if isinstance(check, dict) and check.get('passed') is True else None
    held = record.get('teleprompter') if isinstance(record.get('teleprompter'), dict) else {}
    entry = (held.get('cuts') or {}).get(cut) if isinstance(held.get('cuts'), dict) else None
    entry = entry if isinstance(entry, dict) else None
    if not current:
        return None, entry
    if entry and entry.get('error'):
        return 'failed', entry
    if not entry or not entry.get('script_id'):
        return 'missing', entry
    return ('in' if entry.get('script_sha256') == current else 'older'), entry


def teleprompter_lines(record):
    """What `show` says about Teleprompter, one line a cut; nothing for a
    piece whose scripts have not passed with hashes and was never sent."""
    lines = []
    for cut in CUTS:
        state, entry = teleprompter_state(record, cut)
        if state is None and not entry:
            continue
        name = f'Teleprompter, {CUT_NAME[cut]} cut'
        script = f", script {entry.get('title')}" if entry and entry.get('title') else ''
        if state == 'in':
            lines.append(f"{name}: holds the current words (sent {entry.get('sent_at')}){script}")
        elif state == 'older':
            lines.append(f"{name}: holds older words, update it with teleprompter_send.py plan{script}")
        elif state == 'failed':
            lines.append(f"{name}: the last send failed ({entry.get('error')}); send it again with teleprompter_send.py plan{script}")
        elif state == 'missing':
            lines.append(f'{name}: not sent yet; send it with teleprompter_send.py plan')
        else:
            lines.append(f"{name}: sent {entry.get('sent_at')}, before the scripts' check passed with hashes{script}")
    return lines


def title_for(folder_name, cut):
    """'Mon 12 Oct - 3-minute - Who gets paid for AI songs' from the folder
    'Mon 12 Oct follow.the.money - Who gets paid for AI songs', or None."""
    hit = re.match(r'^([A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}) \S+ - (.+)$', str(folder_name or '').strip())
    return f'{hit.group(1)} - {CUT_NAME[cut]} - {hit.group(2)}' if hit else None


def teleprompter_patch(cut, folder=None, script=None, sha=None, title=None, folder_name=None, sent_at=None, error=None,
                       previous=None, held_folder=None, held_folder_name=None, by=None):
    """One cut's place in Teleprompter: {'teleprompter': {'folder_id',
    'folder_name', 'cuts': {cut: entry}}}. A script needs its folder (given,
    or the one the record holds), its id, the sha256 of the words it holds
    and its title (given, else the record's for that script, else made from
    the folder's name and the cut). A folder other than the record's is
    refused: the piece has one folder, and nothing in Teleprompter is moved.
    With error, a send that failed, stamped with when it failed (failed_at):
    the script the cut already had (previous) is kept, with the error on it;
    with no script, the error alone, and the folder when one was made."""
    cut = _cut(cut)
    folder = _tp_id(folder, '--folder') if folder else None
    held_folder = str(held_folder).upper() if held_folder else None
    if folder and held_folder and folder != held_folder:
        raise MakingError(f'this piece\'s scripts are in folder {held_folder}' + (f' ("{held_folder_name}")' if held_folder_name else '')
                          + f', not {folder}: record into it; nothing in Teleprompter is ever moved')
    folder = folder or held_folder
    name = _name(folder_name, '--folder-name') if folder_name else (held_folder_name if folder and folder == held_folder else None)
    out = {}
    if folder:
        out['folder_id'] = folder
    if name:
        out['folder_name'] = name
    if error is not None:
        said = ' '.join(str(error).split())
        if not said or len(said) > MAX_TEXT:
            raise MakingError(f'--error is what Teleprompter said, in at most {MAX_TEXT} characters')
        if script is not None:
            raise MakingError('a script that was made is a send that worked: record it with --script and --sha, without --error')
        kept = previous if isinstance(previous, dict) and previous.get('script_id') else {}
        entry = {k: v for k, v in kept.items() if k not in ('error', 'failed_at')}
        entry.update({'error': said, 'failed_at': now(), 'by': who(by)})
        entry.setdefault('sent_at', _time(sent_at, '--sent-at') if sent_at else now())
        if entry.get('script_id') and not folder:
            raise MakingError('the cut\'s script is on the record without its folder: give --folder')
        return {'teleprompter': {**out, 'cuts': {cut: entry}}}
    if script is None:
        raise MakingError('give --script and --sha (and --folder for a new folder), or --error for a send that failed')
    if not folder:
        raise MakingError('--folder is the id create_folder gave (the record holds no folder for this piece yet)')
    script = _tp_id(script, '--script')
    if not isinstance(sha, str) or not SHA256.match(sha):
        raise MakingError('--sha is the sha256 of the words the script holds (making.py script_hash of the file), 64 lowercase hex characters')
    if title:
        title = _name(title, '--title')
    elif isinstance(previous, dict) and previous.get('script_id') == script and previous.get('title'):
        title = previous['title']
    else:
        title = title_for(name, cut)
        if not title:
            raise MakingError('--title is the script\'s title (no title on the record for this script, and no folder name to make one from)')
    entry = {'script_id': script, 'title': title, 'script_sha256': sha, 'sent_at': _time(sent_at, '--sent-at') if sent_at else now(), 'by': who(by)}
    return {'teleprompter': {**out, 'cuts': {cut: entry}}}


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


def _story_check(cut, path, series=None):
    command = [sys.executable, str(HERE / 'story_check.py'), '--cut', cut]
    if series:
        command += ['--series', series]
    result = subprocess.run(command + [str(path)], capture_output=True, text=True)
    return result.returncode, result.stdout + result.stderr


def series_of(piece_id, answer=None, call=None):
    """The piece's series (its lane_slot): from the making route's answer
    when it carries it, else from GET /api/content-ideas?id=. None when the
    engine names none."""
    if isinstance(answer, dict) and 'lane_slot' in answer:
        return answer.get('lane_slot') or None
    status, text = (call or _engine_call)('GET', f'/api/content-ideas?id={piece_id}', None)
    try:
        data = json.loads(text) if status == 200 and text else {}
    except ValueError:
        data = {}
    piece = data.get('piece') if isinstance(data, dict) else None
    return (piece.get('lane_slot') or None) if isinstance(piece, dict) else None


OUTLINE_FROM = '2026-10-09'  # dated drafts from here on need an approved outline (Friday 16 Oct's plan is dated 09)


def outline_gate(paths):
    """No script is recorded until Krish has approved its argument. The
    outline sits beside the dated drafts (docs/plans/<date>-outline.md) and
    carries a line "Approved by Krish: <his words>, <date>". Krish approved
    this loop on 2026-10-13 ("Outline first, then script"), after a day of
    scripts that "dont sound like me and I cant read them coherently"."""
    import re
    long = Path(paths[0]) if paths else None
    m = re.match(r'(\d{4}-\d{2}-\d{2})-draft-script', long.name) if long else None
    if not m or m.group(1) < OUTLINE_FROM:
        return
    outline = long.parent / f'{m.group(1)}-outline.md'
    text = outline.read_text(encoding='utf-8') if outline.exists() else ''
    if not re.search(r'^Approved by Krish:\s*\S', text, re.M):
        sys.exit(f'making: no approved outline for these scripts. Write {outline} (the argument in a few plain sentences), '
                 'show it to Krish, and add his words as "Approved by Krish: <his words>, <date>" before recording scripts.')


def spine_gate(paths, piece_id, call):
    """One spine per piece (house rule ONE_SPINE; Krish, 2026-10-14: "the engine cannot do this again"). For
    dated drafts from spine_check.SPINE_FROM: the outline states the spine, its answer and what each section
    proves; the draft's sections are exactly the approved ones; and the engine's judge has passed every section
    against the spine on the body it holds now. Returns the spine, or None for an older piece."""
    import re
    import spine_check
    long = Path(paths[0]) if paths else None
    m = re.match(r'(\d{4}-\d{2}-\d{2})-draft-script', long.name) if long else None
    if not m or m.group(1) < spine_check.SPINE_FROM:
        return None
    outline = long.parent / f'{m.group(1)}-outline.md'
    text = outline.read_text(encoding='utf-8') if outline.exists() else ''
    why = spine_check.outline_problems(text)
    body = long.parent / f'{m.group(1)}-draft-body.md'
    if not why and body.exists():
        why = spine_check.draft_problems(body.read_text(encoding='utf-8'), text)
    if not why:
        why = spine_problem(piece_id, call)
    if why:
        sys.exit('making: the piece drifts from its one spine (house rule ONE_SPINE):\n  ' + '\n  '.join([why] if isinstance(why, str) else why))
    return spine_check.parse_outline(text)['spine']


def spine_problem(piece_id, call):
    """The engine's judge on the body it holds now, or why it has not passed."""
    status, text = call('GET', f'/api/content-ideas/{piece_id}/spine-check', None)
    try:
        data = json.loads(text) if text else {}
    except ValueError:
        data = {}
    if status != 200 or not data.get('ok'):
        return f'the spine check could not be read (HTTP {status})'
    return None if data.get('current') else (data.get('reason') or 'no passing spine check on these words') + \
        f' Run: python3 scripts/post-pack/spine_check.py judge {piece_id} --outline <the outline>'


def scripts_patch(paths, run=None, warn=None, previous=None, series=None):
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
    changed_at are now.

    series is the piece's lane_slot: each script must then open with its
    series line and never say "I'm Krish" again (story_check --series,
    house rule SERIES_OPENER)."""
    import story_check
    run = run or (lambda cut, path: _story_check(cut, path, series))
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
    check = {'passed': not problems, 'problems': problems, 'cuts': cuts, 'hashes': hashes,
             'checked_at': kept or stamp, 'changed_at': changed_at}
    # A read-back holds for the words the readers heard: kept while they stay the same.
    read = prev.get('read_back') if isinstance(prev.get('read_back'), dict) else {}
    still = {cut: entry for cut, entry in read.items() if isinstance(entry, dict) and hashes.get(cut) and entry.get('script_sha256') == hashes[cut]}
    if still and not problems:
        check['read_back'] = still
    return {'script_check': check}


READ_BACK_FOUND = 'nothing lost'  # the readers' pass: one that found something means the words change first
READ_BACK_KRISH = 'approved by Krish'  # Krish read the words himself and signed them off in his own words (krish_words)


def read_back_of(record, cut):
    """The read-back that holds for the cut's current words, or None."""
    check = record.get('script_check') if isinstance(record, dict) and isinstance(record.get('script_check'), dict) else {}
    entry = (check.get('read_back') or {}).get(cut) if isinstance(check.get('read_back'), dict) else None
    current = current_hashes(record).get(cut)
    if not (isinstance(entry, dict) and current and entry.get('script_sha256') == current):
        return None
    if entry.get('found') == READ_BACK_FOUND or (entry.get('found') == READ_BACK_KRISH and krish_words(entry.get('krish_words'))):
        return entry
    return None


def read_back_patch(record, cut, readers, at=None, by=None, krish=None):
    """The script check with one cut's read-back added: the readers (two or
    more, one line each), when, "nothing lost", and the hash of the words
    they heard, which must be the cut's current, passed words. With `krish`,
    Krish's own words signing the cut off ("Krish, DATE: ..."), it is his
    approval instead: found "approved by Krish", his words kept, and any
    readers who heard it listed beside them."""
    cut = _cut(cut)
    check = record.get('script_check') if isinstance(record, dict) and isinstance(record.get('script_check'), dict) else None
    current = current_hashes(record).get(cut)
    if not check or check.get('passed') is not True or not current:
        raise MakingError(f'the {cut} script has not passed its check with its words\' hash on the record: run making.py PIECE scripts '
                          'long.md short.md first, then read it back')
    names = [' '.join(str(r).split()) for r in (readers or []) if str(r).strip()]
    if krish is not None:
        if not krish_words(krish) or len(krish.strip()) > 600:
            raise MakingError('--krish-words are Krish\'s own words signing the cut off, as he said them, starting "Krish" and the date '
                              '(for example "Krish, 2026-10-14: all looks good"), at most 600 characters')
        if len(names) > 6 or any(len(n) > 200 for n in names):
            raise MakingError('--readers beside Krish\'s words: at most six, one line of at most 200 characters each')
        read = dict(check.get('read_back') or {}) if isinstance(check.get('read_back'), dict) else {}
        read[cut] = {'script_sha256': current, 'at': _time(at, '--at') if at else now(), 'by': who(by), 'readers': names,
                     'found': READ_BACK_KRISH, 'krish_words': ' '.join(krish.split())}
        return {'script_check': {**check, 'read_back': read}}
    if len(names) < 2 or any(len(n) > 200 for n in names):
        raise MakingError('--readers names the two fresh readers who heard it (or more), one line of at most 200 characters each')
    read = dict(check.get('read_back') or {}) if isinstance(check.get('read_back'), dict) else {}
    read[cut] = {'script_sha256': current, 'at': _time(at, '--at') if at else now(), 'by': who(by), 'readers': names, 'found': READ_BACK_FOUND}
    return {'script_check': {**check, 'read_back': read}}


def read_back_lines(record):
    """What `show` says about the read-back, one line a cut, once the check
    has passed with hashes."""
    lines = []
    for cut in CUTS:
        if not current_hashes(record).get(cut) or not (record.get('script_check') or {}).get('passed'):
            continue
        entry = read_back_of(record, cut)
        if entry:
            if entry.get('found') == READ_BACK_KRISH:
                lines.append(f"Read back, {CUT_NAME[cut]} cut: approved by Krish ({entry.get('krish_words')}, {entry.get('at')})")
            else:
                lines.append(f"Read back, {CUT_NAME[cut]} cut: nothing lost ({len(entry.get('readers') or [])} readers, {entry.get('at')})")
        else:
            lines.append(f'Read back, {CUT_NAME[cut]} cut: not yet for these words; two fresh readers hear it as a 12-year-old '
                         '(make-piece, "The Scripts step"), then making.py PIECE read-back ' + cut)
    return lines


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


DRIVE_FILE = re.compile(r'^https://drive\.google\.com/file/d/([A-Za-z0-9_-]{20,})(?:/view)?(?:\?[^\s]*)?$')


def drive_link_patch(record, cut, url, thumb_url=None):
    """The cut's finished video with its Drive link added, so the week's
    publish board can link it to download (Krish, 2026-10-14: "You should
    always link the Google Drive videos because I need to actually download
    them"). The video is the one already on the record for the cut, kept
    whole: the engine keeps one entry a path, so this replaces it in place."""
    cut = _cut(cut)
    m = DRIVE_FILE.match(str(url or '').strip())
    if not m:
        raise MakingError('the Drive link is the file\'s own: https://drive.google.com/file/d/<id>/view')
    videos = [v for v in (record.get('video_assets') or []) if isinstance(v, dict) and v.get('cut') == cut]
    if not videos:
        raise MakingError(f'the {cut} cut has no finished video on the record yet; record it first (making.py PIECE video {cut} ...)')
    asset = {k: v for k, v in videos[-1].items() if k != 'at'}
    asset['url'] = f'https://drive.google.com/file/d/{m.group(1)}/view'
    # Its thumbnail's Drive link too, so the board offers it beside the video
    # (Krish, 2026-10-14: "I do not see any video thumbnail assets anywhere").
    if thumb_url:
        t = DRIVE_FILE.match(str(thumb_url).strip())
        if not t:
            raise MakingError('the thumbnail\'s Drive link is the file\'s own: https://drive.google.com/file/d/<id>/view')
        asset['thumbnail'] = {**(asset.get('thumbnail') or {}), 'url': f'https://drive.google.com/file/d/{t.group(1)}/view'}
    return {'video_assets': [asset]}


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


STORE_PATH = re.compile(r'^recordings/([0-9a-f]{64})\.[a-z0-9]{2,5}$')
RECORDINGS_LIST = '/api/library/recordings?limit=200'


def in_store(path, call=None):
    """Refuses a take the engine's recordings store does not hold: its
    newest 200 (GET /api/library/recordings, recording.py's listing), by
    the sha256 in the path. A path no store holds would read as recorded
    while no session could ever fetch it."""
    text = str(path or '').strip()
    hit = STORE_PATH.match(text)
    if not hit:
        raise MakingError(f'the path is the store\'s, "recordings/<sha256>.<ext>" as the send or the matcher printed it, not "{text}"')
    status, body = (call or _engine_call)('GET', RECORDINGS_LIST, None)
    try:
        data = json.loads(body) if body else {}
    except ValueError:
        data = {}
    if status != 200 or not isinstance(data, dict) or not isinstance(data.get('recordings'), list):
        raise MakingError(f'the recordings store could not be read (HTTP {status}), so whether it holds the take is not known: nothing '
                          'was recorded; run it again')
    if not any(isinstance(r, dict) and str(r.get('sha256') or '').lower() == hit.group(1) for r in data['recordings']):
        raise MakingError(f'the engine\'s recordings store does not hold {text} (its newest 200 were read): nothing was recorded. A '
                          'take reaches the store one way: Krish drops it at the top of the Video Engine Inbox and the recordings lane '
                          'sends it (recordings-upload.ps1, every five minutes on either home computer; recording.py list shows what has '
                          'arrived). A take over 500 MiB never reaches the store: recording_match.py --inbox --record places it on a '
                          'home computer')
    return text


def teleprompter_record_patch(piece_id, cut, a, call=None, by=None, config=None):
    """The teleprompter patch from the command line (making.py teleprompter
    and teleprompter_send.py record): config/teleprompter.json checked
    first, then the piece's record read, for its folder and the cut's
    script."""
    import teleprompter_send  # the config and its guard live with the send
    try:
        config = teleprompter_send.load_config() if config is None else config
    except teleprompter_send.making.MakingError as error:
        # Run as a script, this file is __main__, and teleprompter_send's
        # errors come from its own import of it: said as this module's error.
        raise MakingError(str(error)) from None
    if not isinstance(config, dict) or config.get('status') != 'confirmed':
        raise MakingError('config/teleprompter.json is not confirmed by Krish (its status is not "confirmed"), so nothing is recorded')
    cut = _cut(cut)
    # What the line itself gets wrong is said before the engine is asked anything.
    script = getattr(a, 'script', None)
    if a.error is not None and script is not None:
        raise MakingError('a script that was made is a send that worked: record it with --script and --sha, without --error')
    for value, what in ((a.folder, '--folder'), (script, '--script')):
        if value:
            _tp_id(value, what)
    if a.error is None and a.sha is not None and not SHA256.match(str(a.sha)):
        raise MakingError('--sha is the sha256 of the words the script holds (making.py script_hash of the file), 64 lowercase hex characters')
    record = record_of(piece_id, call)
    held = record.get('teleprompter') if isinstance(record.get('teleprompter'), dict) else {}
    previous = teleprompter_state(record, cut)[1]
    return teleprompter_patch(cut, folder=a.folder, script=getattr(a, 'script', None), sha=a.sha, title=a.title,
                              folder_name=getattr(a, 'folder_name', None), sent_at=a.sent_at, error=a.error, previous=previous,
                              held_folder=held.get('folder_id'), held_folder_name=held.get('folder_name'), by=by)


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


# The board (WORKBENCH.md, "The board"): the questions a tool holds there for a session.
BOARD_PATH = '/api/workbench'
BOARD_CLIENTS = {'codex': 'codex', 'claude code': 'claude_code'}  # anything else writes as the runner
CLOSED_LANES = ('done', 'archived')


def board_client(by):
    return BOARD_CLIENTS.get(str(by or '').strip().lower(), 'runner')


def _board_lanes(call):
    """{item id: lane} for every item the board returns (the open ones and the
    latest done). Raises MakingError when the board cannot be read."""
    status, text = call('GET', BOARD_PATH, None)
    if status != 200:
        raise MakingError(f'the board could not be read ({status}: {str(text)[:200]})')
    try:
        return {i.get('id'): i.get('lane') for i in (json.loads(text) or {}).get('items') or [] if isinstance(i, dict)}
    except ValueError:
        raise MakingError('the board answered with something that is not JSON')


def board_upsert(items, call=None, by=None):
    """Puts a tool's questions on the board without ever reopening one. It
    reads the board first: an item that is done there was answered or closed
    by Krish or a session, so it is left alone; one still open is updated
    without its lane, except that one on Krish's list is moved off it when
    the tool now holds the question in progress (a tool never moves one on
    to him: an item on him must be ready for his list, or the engine refuses
    it); a new one goes in with its lane as "lane_if_new", which the engine
    uses only when the item does not exist yet, so an item archived out of
    sight stays archived. Returns (written ids, ids left alone). Raises
    MakingError when the board cannot be read or refuses."""
    call = call or _engine_call
    if not items:
        return [], []
    lanes = _board_lanes(call)
    send, left, fresh = [], [], {}
    for item in items:
        item = dict(item)
        lane = item.pop('lane', 'in_progress')
        if lanes.get(item['id']) in CLOSED_LANES:
            left.append(item['id'])
            continue
        if item['id'] not in lanes:
            item['lane_if_new'] = lane
            fresh[item['id']] = lane
        elif lanes[item['id']] == 'on_you' and lane == 'in_progress':
            item['lane'] = lane
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


def board_note(fields, call=None, by=None):
    """Adds what a tool learned to its own open questions, never their lane:
    {item id: {field: value}}, for example a take no waiting piece can be
    ({"close_ref": {"no_piece": true}}). It reads the board first and writes
    only the items still open there. A tool closes nothing: Control Center's
    done-check sweep ends each item by its kind (take_placed: once the take
    is on a piece, or no piece can be it). Returns the ids written. Raises
    MakingError when the board cannot be read or refuses."""
    call = call or _engine_call
    if not fields:
        return []
    on_board = _board_lanes(call)
    send = [dict({k: v for k, v in f.items() if k not in ('lane', 'lane_if_new')}, id=item_id)
            for item_id, f in fields.items() if on_board.get(item_id) in ('on_you', 'in_progress')]
    written = []
    for start in range(0, len(send), 50):
        chunk = send[start:start + 50]
        status, text = call('POST', BOARD_PATH, {'action': 'upsert_items', 'client': board_client(by), 'items': chunk})
        if status != 200:
            raise MakingError(f'the board did not take {len(chunk)} note(s) ({status}: {str(text)[:200]})')
        written += [i['id'] for i in chunk]
    return written


def ask_about_older_takes(piece_id, record, cuts, call=None, by=None):
    """One board question for each take on the record whose cut's words just
    changed (cuts): use it, or record that cut again. The same item as
    recording_match.py asks (take-<sha12>, closes_on take_placed), held for a
    session to ask Krish in its reply, and never reopened once answered.
    Returns the item ids written."""
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

    stored = ['a' * 64, 'd' * 64]

    def listing(path):
        return 200, json.dumps({'ok': True, 'recordings': [{'sha256': s, 'name': f'{s[:8]}.mp4'} for s in stored]})

    def fake(method, path, body):
        if method == 'GET' and path == RECORDINGS_LIST:
            return listing(path)
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
        if method == 'GET' and path == RECORDINGS_LIST:
            return listing(path)
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
    board_items = {'items': [{'id': 'take-done', 'lane': 'done'}, {'id': 'take-open', 'lane': 'on_you'}, {'id': 'take-held', 'lane': 'in_progress'}]}
    board_sent = []

    def board(method, path, body):
        if method == 'GET' and path == BOARD_PATH:
            return 200, json.dumps(board_items)
        board_sent.append(body)
        return 200, json.dumps({'ok': True})
    asked = [{'id': i, 'lane': 'in_progress', 'title': 't', 'detail': 'd'} for i in ('take-done', 'take-held', 'take-new')]
    written, left = board_upsert(asked, board, 'Recordings lane')
    sent_items = {i['id']: i for i in board_sent[-1]['items']}
    check('board: an item done on the board is left alone; an open one is updated without its lane; a new one goes in with its lane',
          (left, sorted(sent_items), 'lane' in sent_items['take-held'], 'lane_if_new' in sent_items['take-held'], sent_items['take-new'].get('lane_if_new'),
           'lane' in sent_items['take-new'], board_sent[-1]['client']),
          (['take-done'], ['take-held', 'take-new'], False, False, 'in_progress', False, 'runner'))
    board_upsert([{'id': 'take-open', 'lane': 'in_progress', 'title': 't'}, {'id': 'take-held', 'lane': 'on_you', 'title': 't'}], board, 'Codex')
    sent_items = {i['id']: i for i in board_sent[-1]['items']}
    check('board: one on his list moves off it when the tool holds the question in progress; a tool never moves one on to him',
          (sent_items['take-open'].get('lane'), 'lane' in sent_items['take-held'], 'lane_if_new' in sent_items['take-held']), ('in_progress', False, False))
    board_sent.clear()
    noted = board_note({'take-done': {'close_ref': {'no_piece': True}}, 'take-open': {'close_ref': {'no_piece': True}, 'lane': 'done'},
                        'take-held': {'close_ref': {'no_piece': True}}, 'take-gone': {'close_ref': {'no_piece': True}}}, board, 'Recordings lane')
    check('board_note: only the items still open are noted, never with a lane, so a tool closes nothing',
          (sorted(noted), sorted((i['id'], i.get('lane'), i['close_ref']) for i in board_sent[-1]['items']), board_sent[-1]['client']),
          (['take-held', 'take-open'], [('take-held', None, {'no_piece': True}), ('take-open', None, {'no_piece': True})], 'runner'))
    board_sent.clear()
    check('board_note: nothing to note writes nothing', (board_note({'take-done': {'close_ref': {}}}, board, 'Codex'), board_sent), ([], []))
    old_engine = []

    def older_board(method, path, body):
        if method == 'GET':
            return 200, json.dumps({'items': []})
        old_engine.append(body)
        return (400, json.dumps({'ok': False, 'error': 'lane_required'})) if len(old_engine) == 1 else (200, '{"ok": true}')
    board_upsert(asked[2:], older_board, 'Codex')
    check('board: an engine from before lane_if_new gets the lane for a new item, once', (len(old_engine), old_engine[-1]['items'][0].get('lane')), (2, 'in_progress'))
    try:
        recorded_patch('long', 'recordings/x.mp4', None, 'not-a-hash')
        check('recorded: a script hash that is not a sha256 is refused', 'no error', 'error')
    except MakingError as e:
        check('recorded: a script hash that is not a sha256 is refused', 'sha256' in str(e), True)
    code, err = run([pid, 'recorded', 'long', 'recordings/x.mp4', '--seconds', '-3'])
    check('recorded: a length below zero is refused', (code, 'more than 0' in err), (1, True))
    # A take is recorded only once the store holds it (a cloud session has no runner key to send one).
    before = len(seen)
    code, err = run(['--by', 'Claude Code', pid, 'recorded', 'long', 'recordings/' + 'b' * 64 + '.mp4', '--seconds', '185'])
    check('recorded: a take the store does not hold is refused, nothing written, naming the one way a take comes back',
          (code, 'does not hold' in err, 'top of the Video Engine Inbox' in err,
          sum(1 for m, _, _ in seen[before:] if m == 'POST')), (1, True, True, 0))
    code, err = run([pid, 'recorded', 'long', 'C:/work/take.mp4'])
    check('recorded: a path that is not the store\'s is refused', (code, 'recordings/<sha256>.<ext>' in err), (1, True))
    code, err = run([pid, 'recorded', 'long', 'recordings/' + 'a' * 64 + '.mp4'], lambda m, path, b: (503, '{}') if path == RECORDINGS_LIST else fake(m, path, b))
    check('recorded: a store that cannot be read records nothing', (code, 'could not be read' in err), (1, True))

    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / 'long.md').write_text('the long script\n', encoding='utf-8')
        (Path(tmp) / 'short.md').write_text('a changed short script\n', encoding='utf-8')
        hashed['script_check']['hashes'] = {'long': script_hash('the long script\n'), 'short': 'c' * 64}
        quiet_check = lambda cut, path, series=None: (0, '')
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
        globals()['_story_check'], real_check = (lambda cut, path, series=None: (0, '')), globals()['_story_check']
        try:
            code, err = run(['--by', 'Claude Code', pid, 'scripts', str(Path(tmp) / 'long.md'), str(Path(tmp) / 'short.md')], changing)
        finally:
            globals()['_story_check'] = real_check
        item = (asked_posts[-1]['items'][0] if asked_posts else {})
        check('scripts: a take of the long words that just changed is one question on the board, tied to the piece, ended when placed',
              (code, item.get('id'), item.get('idea_id'), item.get('closes_on'), item.get('lane_if_new'), 'Mon 12 Oct' in item.get('detail', ''),
               asked_posts[-1]['client'] if asked_posts else None, new_long != old_take['script_sha256']),
              (0, 'take-' + '7' * 12, pid, 'take_placed', 'in_progress', True, 'claude_code', True))
        check('scripts: the question is held for a session to ask Krish in its reply, never on his list',
              (item.get('only_you'), 'link' in item, 'prompt' in item, 'asks Krish in its reply' in item.get('detail', '')), (None, False, False, True))

    # The series line: `scripts` checks each script with the piece's series (house rule SERIES_OPENER).
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / 'long.md').write_text('the long script\n', encoding='utf-8')
        (Path(tmp) / 'short.md').write_text('the short script\n', encoding='utf-8')
        asked_series = []
        globals()['_story_check'], real_check = (lambda cut, path, series=None: (asked_series.append(series), (0, ''))[1]), globals()['_story_check']
        try:
            def with_slot(method, path, body):
                seen.append((method, path, body))
                if method == 'GET':
                    return 200, json.dumps({'ok': True, 'lane_slot': 'follow_the_money', 'making': {}, 'steps': []})
                return 200, json.dumps({'ok': True, 'steps': []})
            run(['--by', 'Claude Code', pid, 'scripts', str(Path(tmp) / 'long.md'), str(Path(tmp) / 'short.md')], with_slot)
            check('scripts: each script is checked with the piece\'s series, from the making route', asked_series, ['follow_the_money'] * 2)
            asked_series.clear()

            def older_route(method, path, body):
                seen.append((method, path, body))
                if method == 'GET' and path.startswith('/api/content-ideas?id='):
                    return 200, json.dumps({'ok': True, 'piece': {'id': pid, 'lane_slot': 'mind_the_gap'}})
                if method == 'GET':
                    return 200, json.dumps({'ok': True, 'making': {}, 'steps': []})
                return 200, json.dumps({'ok': True, 'steps': []})
            run(['--by', 'Claude Code', pid, 'scripts', str(Path(tmp) / 'long.md'), str(Path(tmp) / 'short.md')], older_route)
            check('scripts: a making route with no lane_slot: the piece is read for it', asked_series, ['mind_the_gap'] * 2)
            asked_series.clear()
            run(['--by', 'Claude Code', pid, 'scripts', str(Path(tmp) / 'long.md'), str(Path(tmp) / 'short.md'), '--series', 'under_the_hood'], older_route)
            check('scripts: --series given wins', asked_series, ['under_the_hood'] * 2)
        finally:
            globals()['_story_check'] = real_check
    import story_check
    check('the real story check refuses a script with no series line once the series is known',
          'SERIES_OPENER' in _story_check('long', Path(__file__).resolve().parents[2] / 'scripts' / 'post-pack' / 'README.md', 'follow_the_money')[1], True)

    # The read-back: two fresh readers, "nothing lost", tied to the words they heard.
    passed = {'script_check': {'passed': True, 'checked_at': '2026-10-12T15:50:00Z', 'problems': [], 'cuts': ['long', 'short'],
                               'hashes': {'long': 'a' * 64, 'short': 'b' * 64}, 'changed_at': {'long': '2026-10-12T15:50:00Z', 'short': '2026-10-12T15:50:00Z'}}}
    readers = ['reader A, a fresh Claude Code subagent', 'reader B, a fresh Claude Code subagent']
    read = read_back_patch(passed, 'long', readers, '2026-10-12T15:55:00Z', 'Claude Code')['script_check']
    check('read-back: the whole check kept, the cut\'s readers, when, "nothing lost" and the words they heard',
          ({k: v for k, v in read.items() if k != 'read_back'}, read['read_back']),
          (passed['script_check'], {'long': {'script_sha256': 'a' * 64, 'at': '2026-10-12T15:55:00Z', 'by': 'Claude Code', 'readers': readers,
                                             'found': 'nothing lost'}}))
    for label, record, who_read, words in (('one reader', passed, readers[:1], 'two fresh readers'),
                                            ('a check that did not pass', {'script_check': {**passed['script_check'], 'passed': False}}, readers, 'has not passed'),
                                            ('a check with no hash', {'script_check': {'passed': True, 'checked_at': 'x', 'problems': []}}, readers, 'has not passed')):
        try:
            read_back_patch(record, 'long', who_read)
            check(f'read-back: {label} is refused', 'no error', 'error')
        except MakingError as e:
            check(f'read-back: {label} is refused', words in str(e), True)
    held = {'script_check': read}
    check('read-back: it holds for the words they heard, and not for changed words',
          (bool(read_back_of(held, 'long')), read_back_of(held, 'short'),
           read_back_of({'script_check': {**read, 'hashes': {'long': 'c' * 64, 'short': 'b' * 64}}}, 'long')), (True, None, None))
    check('show: the read-back of each cut', read_back_lines(held),
          ['Read back, 3-minute cut: nothing lost (2 readers, 2026-10-12T15:55:00Z)',
           'Read back, 90-second cut: not yet for these words; two fresh readers hear it as a 12-year-old (make-piece, "The Scripts step"), '
           'then making.py PIECE read-back short'])
    with tempfile.TemporaryDirectory() as tmp:
        (Path(tmp) / 'long.md').write_text('same words\n', encoding='utf-8')
        (Path(tmp) / 'short.md').write_text('new words\n', encoding='utf-8')
        prev = {**read, 'hashes': {'long': script_hash('same words\n'), 'short': 'b' * 64},
                'read_back': {'long': {**read['read_back']['long'], 'script_sha256': script_hash('same words\n')},
                              'short': {**read['read_back']['long'], 'script_sha256': 'b' * 64}}}
        rechecked = scripts_patch([Path(tmp) / 'long.md', Path(tmp) / 'short.md'], lambda cut, path: (0, ''), warned.append, previous=prev)['script_check']
        check('scripts: a read-back is kept for words that did not change, and dropped for words that did', sorted(rechecked.get('read_back') or {}), ['long'])
    code, err = run([pid, 'read-back', 'long', '--readers', 'only one'], lambda m, path, b: (200, json.dumps({'ok': True, 'making': passed, 'steps': []})))
    check('read-back: the command line refuses one reader', (code, 'two fresh readers' in err), (1, True))
    # The Drive link: added to the cut's video already on the record, the rest of it kept.
    vrec = {'video_assets': [{'cut': 'long', 'name': 'w.mp4', 'path': '3 Posts/x/3 Video/w.mp4', 'seconds': 168, 'music': 'm',
                              'thumbnail': {'path': '3 Posts/x/3 Video/w.jpg'}, 'at': '2026-10-12T20:42:27Z'}]}
    linked = drive_link_patch(vrec, 'long', 'https://drive.google.com/file/d/1q9xic-9v3dOVjPXjVnbQABmHWKGwJ9Tg/view?usp=drivesdk')
    check('drive-link: the video kept whole, its Drive link added', linked,
          {'video_assets': [{'cut': 'long', 'name': 'w.mp4', 'path': '3 Posts/x/3 Video/w.mp4', 'seconds': 168, 'music': 'm',
                             'thumbnail': {'path': '3 Posts/x/3 Video/w.jpg'},
                             'url': 'https://drive.google.com/file/d/1q9xic-9v3dOVjPXjVnbQABmHWKGwJ9Tg/view'}]})
    thumbed = drive_link_patch(vrec, 'long', 'https://drive.google.com/file/d/1q9xic-9v3dOVjPXjVnbQABmHWKGwJ9Tg/view',
                               thumb_url='https://drive.google.com/file/d/1dK3QdzIkQi-SO1JsR9_SR2LdYoxGZnSQ/view?usp=drivesdk')
    check('drive-link: the thumbnail\'s Drive link joins its path', thumbed['video_assets'][0]['thumbnail'],
          {'path': '3 Posts/x/3 Video/w.jpg', 'url': 'https://drive.google.com/file/d/1dK3QdzIkQi-SO1JsR9_SR2LdYoxGZnSQ/view'})
    for label, rec, cut, url in (('a link that is not a Drive file', vrec, 'long', 'https://example.com/x'),
                                 ('a cut with no video', vrec, 'short', 'https://drive.google.com/file/d/1q9xic-9v3dOVjPXjVnbQABmHWKGwJ9Tg/view')):
        try:
            drive_link_patch(rec, cut, url)
            check(f'drive-link: {label} is refused', 'no error', 'error')
        except MakingError:
            check(f'drive-link: {label} is refused', True, True)
    # Krish's own sign-off: recorded as his approval, with his words, never as the readers' "nothing lost".
    signed = read_back_patch(passed, 'short', ['reader A, round 10: nothing lost'], '2026-10-14T12:00:00Z', 'Claude Code',
                             krish='Krish, 2026-10-14: all looks good')['script_check']['read_back']['short']
    check('read-back: Krish\'s words record his approval, with his words and the readers who heard it',
          signed, {'script_sha256': 'b' * 64, 'at': '2026-10-14T12:00:00Z', 'by': 'Claude Code', 'readers': ['reader A, round 10: nothing lost'],
                   'found': 'approved by Krish', 'krish_words': 'Krish, 2026-10-14: all looks good'})
    signed_held = {'script_check': {**passed['script_check'], 'read_back': {'short': signed}}}
    check('read-back: his approval holds for the words he read, and shows as his', (bool(read_back_of(signed_held, 'short')), read_back_lines(signed_held)[1]),
          (True, 'Read back, 90-second cut: approved by Krish (Krish, 2026-10-14: all looks good, 2026-10-14T12:00:00Z)'))
    check('read-back: an approval without his words does not hold',
          read_back_of({'script_check': {**passed['script_check'], 'read_back': {'short': {**signed, 'krish_words': 'all looks good'}}}}, 'short'), None)
    try:
        read_back_patch(passed, 'short', [], krish='all looks good')
        check('read-back: words that are not his are refused', 'no error', 'error')
    except MakingError as e:
        check('read-back: words that are not his are refused', 'starting "Krish"' in str(e), True)

    # Teleprompter: where each cut's script is, in Krish's teleprompter.com account (config/teleprompter.json).
    folder, script = '86B6F74B-2F8A-4477-AE44-8DA1119D1CD9', '45F414D8-31E1-4B2D-BBE4-44EBA042B346'
    name = 'Mon 12 Oct follow.the.money - Who gets paid for AI songs'
    sent = teleprompter_patch('long', folder.lower(), script.lower(), 'a' * 64, folder_name=name, sent_at='2026-10-12T15:34:07Z', by='Claude Code')
    check('teleprompter: one cut, the ids in upper case, its title made from the folder\'s name', sent,
          {'teleprompter': {'folder_id': folder, 'folder_name': name, 'cuts': {'long': {
              'script_id': script, 'title': 'Mon 12 Oct - 3-minute - Who gets paid for AI songs', 'script_sha256': 'a' * 64,
              'sent_at': '2026-10-12T15:34:07Z', 'by': 'Claude Code'}}}})
    good = dict(folder=folder, script=script, sha='a' * 64, title='T')
    for label, change, words in (
            ('a folder id that is not a uuid', {'folder': 'my folder'}, 'uppercase UUID'),
            ('a script id that is not a uuid', {'script': '45F414D8'}, 'uppercase UUID'),
            ('no hash', {'sha': None}, '--sha is the sha256'),
            ('no folder anywhere', {'folder': None}, '--folder is the id create_folder gave'),
            ('a title on two lines', {'title': None, 'folder_name': None}, '--title'),
            ('a sent time that is not a time', {'sent_at': 'this morning'}, 'is a time like'),
            ('neither a script nor an error', {'script': None}, 'or --error')):
        try:
            teleprompter_patch('long', **{**good, **change})
            check(f'teleprompter: {label} is refused', 'no error', 'error')
        except MakingError as e:
            check(f'teleprompter: {label} is refused', words in str(e), True)
    try:
        teleprompter_patch('long', 'DD28154B-B6D1-47DB-803A-79410D83196D', script, 'a' * 64, 'T', held_folder=folder, held_folder_name=name)
        check('teleprompter: another folder than the piece\'s is refused', 'no error', 'error')
    except MakingError as e:
        check('teleprompter: another folder than the piece\'s is refused', ('are in folder' in str(e), name in str(e)), (True, True))
    previous = sent['teleprompter']['cuts']['long']
    kept = teleprompter_patch('long', error='HTTP 503:\n try again', previous=previous, held_folder=folder, held_folder_name=name, by='Codex')['teleprompter']
    check('teleprompter: a failed update keeps the script, its title and its words, with the error and when it failed',
          (kept['folder_id'], kept['cuts']['long']['script_id'], kept['cuts']['long']['title'], kept['cuts']['long']['sent_at'],
           kept['cuts']['long']['error'], kept['cuts']['long']['by'], bool(kept['cuts']['long'].get('failed_at'))),
          (folder, script, previous['title'], '2026-10-12T15:34:07Z', 'HTTP 503: try again', 'Codex', True))
    alone = teleprompter_patch('short', error='HTTP 500', by='Claude Code')['teleprompter']
    check('teleprompter: a first send that failed before any folder is the error alone', (sorted(alone), sorted(alone['cuts']['short'])),
          (['cuts'], ['by', 'error', 'failed_at', 'sent_at']))
    try:
        teleprompter_patch('short', folder, script, error='HTTP 500')
        check('teleprompter: a script with an error is refused (a made script is a send that worked)', 'no error', 'error')
    except MakingError as e:
        check('teleprompter: a script with an error is refused (a made script is a send that worked)', 'without --error' in str(e), True)
    held_tp = {**passed, 'teleprompter': sent['teleprompter']}
    states = lambda record: [teleprompter_state(record, c)[0] for c in CUTS]
    check('teleprompter: the words held, never sent', states(held_tp), ['in', 'missing'])
    check('teleprompter: older words, a failed send', states({**passed, 'teleprompter': {'folder_id': folder, 'cuts': {
        'long': {**previous, 'script_sha256': 'c' * 64}, 'short': alone['cuts']['short']}}}), ['older', 'failed'])
    check('teleprompter: nothing to say before the scripts pass with hashes', teleprompter_state({'script_check': {'passed': False}}, 'long'), (None, None))
    check('show: each cut\'s place in Teleprompter', teleprompter_lines(held_tp),
          ['Teleprompter, 3-minute cut: holds the current words (sent 2026-10-12T15:34:07Z), script Mon 12 Oct - 3-minute - Who gets paid for AI songs',
           'Teleprompter, 90-second cut: not sent yet; send it with teleprompter_send.py plan'])
    check('show: older words say to update them', teleprompter_lines({**passed, 'teleprompter': {'folder_id': folder, 'cuts': {'long': {**previous, 'script_sha256': 'c' * 64}}}})[0],
          'Teleprompter, 3-minute cut: holds older words, update it with teleprompter_send.py plan, script Mon 12 Oct - 3-minute - Who gets paid for AI songs')

    def holds_tp(method, path, body):
        seen.append((method, path, body))
        if method == 'GET':
            return 200, json.dumps({'ok': True, 'making': held_tp, 'steps': []})
        return 200, json.dumps({'ok': True, 'making': {**held_tp, **body}, 'steps': []})
    code, _ = run(['--by', 'Claude Code', pid, 'teleprompter', 'short', '--folder', folder, '--script', 'ED3DE98A-7158-4448-A622-A2A5115FFA83',
                   '--sha', 'b' * 64, '--sent-at', '2026-10-12T15:34:08Z'], holds_tp)
    check('teleprompter: the command line records the cut in the piece\'s folder, its title from the folder\'s name', (code, seen[-1][2].get('teleprompter')),
          (0, {'folder_id': folder, 'folder_name': name, 'cuts': {'short': {
              'script_id': 'ED3DE98A-7158-4448-A622-A2A5115FFA83', 'title': 'Mon 12 Oct - 90-second - Who gets paid for AI songs', 'script_sha256': 'b' * 64,
              'sent_at': '2026-10-12T15:34:08Z', 'by': 'Claude Code'}}}))
    before = len([x for x in seen if x[0] == 'POST'])
    code, err = run([pid, 'teleprompter', 'short', '--folder', 'DD28154B-B6D1-47DB-803A-79410D83196D', '--script', script, '--sha', 'b' * 64], holds_tp)
    check('teleprompter: another folder is refused, nothing written', (code, 'are in folder' in err, len([x for x in seen if x[0] == 'POST'])), (1, True, before))
    check('show: prints the read-back and the Teleprompter lines', ('Teleprompter, 90-second cut: not sent yet' in show(pid, holds_tp),
                                                                      'Read back, 3-minute cut' in show(pid, holds_tp)), (True, True))
    try:
        with contextlib.redirect_stderr(io.StringIO()):
            main([pid, 'descript', 'long'], call=fake)
        retired = False
    except SystemExit as stop:
        retired = stop.code != 0
    check('descript: retired on 2026-10-12, so the command line no longer takes it', retired, True)

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
    ap.add_argument('what', nargs='?', choices=['show', 'workroom', 'publish-manager', 'visual-gate', 'scripts', 'pack', 'recorded', 'video', 'posted', 'session',
                                                     'read-back', 'teleprompter', 'drive-link'])
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
    ap.add_argument('--krish-words', metavar='WORDS', help='with read-back: Krish\'s own words signing the cut off. With recorded: Krish\'s own words, starting "Krish" and the date, letting a take '
                    'of older words count as a take of the current script; recorded on the take')
    ap.add_argument('--readers', nargs='+', metavar='READER', help='with read-back: the two fresh readers who heard the cut, one line each')
    ap.add_argument('--at', metavar='TIME', help='with read-back: when they read it (default now)')
    ap.add_argument('--series', metavar='LANE_SLOT', help='with scripts: the piece\'s series, when the engine does not say '
                    '(follow_the_money, under_the_hood or mind_the_gap)')
    ap.add_argument('--folder', metavar='ID', help='with teleprompter: the folder\'s id, an uppercase UUID (create_folder\'s, or the record\'s)')
    ap.add_argument('--folder-name', metavar='NAME', help='with teleprompter: the folder\'s name')
    ap.add_argument('--script', metavar='ID', help='with teleprompter: the script\'s id, an uppercase UUID')
    ap.add_argument('--sha', metavar='SHA256', help='with teleprompter: the sha256 of the words the script holds')
    ap.add_argument('--title', metavar='TITLE', help='with teleprompter: the script\'s title')
    ap.add_argument('--sent-at', metavar='TIME', help='with teleprompter: when it was sent (default now)')
    ap.add_argument('--error', metavar='TEXT', help='with teleprompter: what Teleprompter said when the send failed')
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
            if a.what == 'publish-manager':
                # A piece whose scripts carried a spine publishes only words the judge passed against it.
                held = ((read(a.piece_id, call).get('making') or {}).get('script_check') or {})
                why = spine_problem(a.piece_id, call) if held.get('spine') else None
                if why:
                    raise MakingError('the piece drifts from its one spine (house rule ONE_SPINE): ' + why)
            patch = {a.what.replace('-', '_'): {'url': a.args[0]}}
        elif a.what == 'visual-gate':
            patch = visual_gate_patch(a.args[0])
        elif a.what == 'scripts':
            outline_gate(a.args)
            spine = spine_gate(a.args, a.piece_id, call)
            # The record first: checked_at stays put while the words do.
            answer = read(a.piece_id, call)
            previous = (answer.get('making') or {}).get('script_check') if isinstance(answer.get('making'), dict) else None
            # The piece's series: each script opens with its line (house rule SERIES_OPENER).
            import story_check
            series = a.series or series_of(a.piece_id, answer, call)
            if series and series not in story_check.series_openers():
                print(f'making: the piece\'s series "{series}" has no series line, so the scripts are checked without one', file=sys.stderr)
                series = None
            elif not series:
                print('making: the engine names no series for the piece, so the series line was not checked; give --series '
                      'follow_the_money, under_the_hood or mind_the_gap', file=sys.stderr)
            patch = scripts_patch(a.args, previous=previous, series=series)
            if spine:
                patch['script_check']['spine'] = spine
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
            # Only a take the store holds: every later session fetches it from there.
            in_store(a.args[1], call)
        elif a.what == 'drive-link':
            if len(a.args) != 2:
                ap.error('give the cut and its Drive link: drive-link long https://drive.google.com/file/d/<id>/view')
            patch = drive_link_patch(record_of(a.piece_id, call), a.args[0], a.args[1], thumb_url=a.thumb_url)
        elif a.what == 'video':
            patch = video_patch(a.args[0], a.args[1], a.args[2], url=a.url, seconds=a.seconds,
                                thumb=a.thumb, thumb_url=a.thumb_url, music=a.music, thumb_file=a.thumb_file)
        elif a.what == 'posted':
            channel = a.args[0]
            if channel not in CHANNELS:
                ap.error(f'channel must be one of {", ".join(CHANNELS)}')
            patch = {'channels': {channel: {'url': a.args[1]} if len(a.args) > 1 else {}}}
        elif a.what == 'read-back':
            if len(a.args) != 1:
                ap.error('give the cut: read-back long --readers "reader A, ..." "reader B, ..."')
            patch = read_back_patch(record_of(a.piece_id, call), a.args[0], a.readers, a.at, by, krish=a.krish_words)
        elif a.what == 'teleprompter':
            if len(a.args) != 1:
                ap.error('give the cut: teleprompter long --folder ID --script ID --sha SHA256, or --error TEXT')
            patch = teleprompter_record_patch(a.piece_id, a.args[0], a, call, by)
        else:
            patch = {'session': {'url': a.args[0], 'by': by}}
        data = post(a.piece_id, patch, call, by=by)
        if a.what == 'scripts' and changed:
            # A take on the record of the words that just changed: one question for Krish.
            try:
                for item in ask_about_older_takes(a.piece_id, data.get('making') or {}, changed, call, by):
                    print(f'making: held on the board for a session: whether to use the older take ({item}); ask Krish in your reply', file=sys.stderr)
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
