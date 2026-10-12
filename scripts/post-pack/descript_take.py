#!/usr/bin/env python3
"""descript_take: brings a take Krish recorded in a Descript "Record here"
timeline back to its piece and cut.

Krish, 2026-10-12: "Descript is now my tool of choice for video script
readouts on my phone - scripts should automatically be sent there, with the
ability for Descript to put the video in the correct place when recorded."
He records there: "I can use the descript web app, otherwise my laptop to
record". His standing yes to the copy this needs, asked "a standing yes for
the video skill to make a private copy, never public, of each take recorded
in a Record here timeline, so it can download it": "1. yes". All of it is in
config/descript.json.

descript_send.py gave each cut a project in his drive with a Record here
composition: a 1-second slate, 1920 x 1080, that he records into. This file
makes no Descript call and holds no Descript key: the session makes the
calls it prints, through the Descript connector, saves each answer to a
file, and gives the file back here. The video skill runs the steps in
order (.agents/skills/produce-video, "Takes recorded in Descript").

    python descript_take.py waiting [--week YYYY-MM-DD] [--json]
        the pieces waiting for a recording this week and next (the
        matcher's list), and for each cut still to record its Descript
        project and the get_project call to make
    python descript_take.py look --piece ID --cut long|short --project PROJECT.json [--krish-words "Krish, ..."] [--json]
        what the cut's Record here timeline holds, from get_project's answer
        saved to a file: nothing yet, a take, or a question for Krish; and
        the export_transcript and publish_project calls
    python descript_take.py check --piece ID --cut long|short --words TRANSCRIPT [--project PROJECT.json]
                     [--use-last "Krish, YYYY-MM-DD: his words"] [--krish-words "Krish, ..."] [--script FILE] [--json]
        go or ask: the opening of export_transcript's words for that
        timeline against the cut's script (recording_match.opening_score,
        0.72 or more), and how many times he read it
    python descript_take.py fetch --url DOWNLOAD_URL --piece ID --cut long|short --out DIR
                     [--slate-seconds 1] [--project PROJECT.json] [--expires-at TIME]
                     [--from-seconds S --use-last "Krish, ..."] [--krish-words "Krish, ..."] [--by NAME] [--json]
        downloads the private copy, trims exactly the slate's frames,
        hashes the take and prints its file, sha256 and seconds, with the
        send and the two record lines that follow on a home computer that
        holds the runner key, or the handoff line anywhere else
    python descript_take.py known --piece ID --cut long|short --project PROJECT.json [--by NAME]
        the making.py descript line that adds every media name the project
        listed to the cut's known_media, so a take is never fetched twice
    python descript_take.py handoff --piece ID --cut long|short --share-url URL [--score S] [--post] [--by NAME] [--json]
        the board item a cloud session leaves for a home computer (--post
        puts it on the board)
    python descript_take.py --self-test

What counts as a take. The Record here composition's content beyond the
slate, made of media the record does not know (known_media, every name the
project listed when the script was sent, and every take brought in since).
A timeline still about one second long holds nothing yet. A take recorded
with a camera and a microphone may come in as two media of the same length:
they are one recording. The timeline is the take as edited: a recording
Krish took out of the timeline is in the project but not in the copy.

When to ask Krish, never guess:
- the timeline holds only media the record knows, so it is a take from
  before the script last changed (or one already brought in);
- Descript holds older words for the cut than the script now, or its last
  send failed: the take may be of the older words;
- the cut already has a take of its current words on the record;
- he read the script more than once in the timeline, unless his words say
  use the last one (--use-last, which needs the transcript as srt, so the
  place where the last reading starts is known);
- its opening matches the cut's script under 0.72, the other cut's script
  better, or its length says the other cut;
- the timeline runs longer than the slate and the new recordings, or a
  copy of the project is published at a level other than private.

His answer settles it. When he says to use the take anyway, his words, as
he said them, go to look, check and fetch with --krish-words "Krish,
YYYY-MM-DD: ...": they settle a take of older words or of words Descript
held older (older_take, older_words), a new take of a cut already recorded
(recorded) and a copy already published at another level (published),
and fetch puts them on the take's record line. A re-take of a cut already
recorded is not on the waiting list: look for that piece and cut directly.
New media in a timeline other than Record here (Krish recorded in another
timeline of the project) is named by that timeline, so he can move it or
record again in Record here; nothing is copied from another timeline.

A cut with no Descript project on its record, while WORKBENCH.md keeps the
record line of a send made by hand for it, is never sent to the Inbox:
`waiting` prints that line, to be run first (descript_send.hand_made).

Trimming. The copy is the whole timeline. The slate is found by its colours
(the near black and the mint "Record here" of descript_send.slate) at the
start, or at the end when he recorded before it, and exactly its frames are
cut: the frame before the cut is the slate and the frame after it is not,
or nothing is trimmed. The video is copied as it is when a keyframe sits
where the take starts, else re-encoded once at high quality (x264, CRF 16);
the sound is trimmed to the sample either way. The result is checked frame
by frame count.

Exit codes. look: 0 a take to bring in, 2 ask Krish, 3 nothing to bring in,
1 refused or failed. check: 0 go, 2 ask, 1 failed. Everything else: 0
done, 1 refused or failed.

It never publishes, posts, sends, records or deletes by itself: it reads the
engine (GET) and files the session gives it, and writes only the take into
--out. handoff --post is the one write, to the board. fetch prints the send
and the record lines only on Windows with the runner key in Credential
Manager (the recordings lane's machines): anywhere else the take cannot go
into the store, so it prints the handoff line instead, and making.py
recorded refuses a path the store does not hold.
"""
import argparse
import contextlib
import hashlib
import io
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone
from fractions import Fraction
from pathlib import Path
from urllib.parse import urlsplit

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
for _path in (HERE, HERE.parent):
    if str(_path) not in sys.path:
        sys.path.insert(0, str(_path))
import making  # noqa: E402  the record, its hashes and descript entries, the board
import recording_match  # noqa: E402  opening_score, the waiting pieces, each piece's scripts
import descript_send  # noqa: E402  the confirmed config, the slate's colours

CUTS = making.CUTS
PLANS = REPO / 'docs' / 'plans'
PY = 'python' if os.name == 'nt' else 'python3'
SELF = 'scripts/post-pack/descript_take.py'
MAKING = 'scripts/post-pack/making.py'
UPLOAD = 'scripts\\recordings-upload.ps1'

SURE = recording_match.SURE          # 0.72, the Studio's own bar for a take against its script
MARGIN = recording_match.MARGIN      # 0.15 clear of the other cut's script
LONG_FROM = recording_match.LONG_FROM
SHORT_UP_TO = recording_match.SHORT_UP_TO
MIN_HEAD_WORDS = recording_match.MIN_HEAD_WORDS
LANE_LIMIT = recording_match.LANE_LIMIT
HEAD_WORDS = 112      # about the 45 seconds the matcher hears, at 150 words a minute
ANCHOR = 20           # the words a reading starts with, matched against the script's first words
FULL_SHARE = 0.6      # a reading that runs at least this share of the script's words is a full one; less is a restart
WHOLE_FLOOR = 0.6     # a full reading that matches its script less than this, word for word in order, is asked about
LEAD = 0.25           # seconds kept before the first word of the last reading
SAME_RECORDING = 0.5  # seconds: two new media this close in length are one recording (camera and microphone)
MIN_BYTES = 64 * 1024
PUBLISH = {'media_type': 'Video', 'resolution': '1080p', 'access_level': 'private'}
INK, MINT = descript_send.INK, descript_send.MINT
SAMPLE_W, SAMPLE_H = 192, 108
INK_NEAR, MINT_NEAR = 20, 60          # how far a pixel may be from the slate's colours, per channel
INK_SHARE, MINT_SHARE = 0.85, 0.004   # a real slate: over 0.93 ink and about 0.013 mint; dark footage: no mint
EXPIRED = (400, 401, 403, 404, 410)
CRF = '16'
RUNNER_CREDENTIAL = 'MindmakeVideoStudio/control-center-runner-token-v3'  # recordings-upload.ps1's runner key
# The questions his words settle (--krish-words); the others need the timeline to change.
BY_HIS_WORDS = {'older_take', 'older_words', 'recorded', 'published'}


class TakeError(making.MakingError):
    """A reason to stop, in words a person can act on."""


# ---------------------------------------------------------------- small helpers

def _cut(cut):
    if cut not in CUTS:
        raise TakeError(f'the cut is long or short, not "{cut}"')
    return cut


def _piece(piece_id):
    if not making.UUID.match(str(piece_id or '')):
        raise TakeError('the piece id is the content_ideas uuid (post.json "piece_id")')
    return str(piece_id).lower()


def _q(value):
    """One argument of a printed command, quoted for the shell it runs in:
    PowerShell on Windows, a POSIX shell elsewhere."""
    text = str(value)
    if text and re.fullmatch(r'[A-Za-z0-9_./:=@%+,\\-]+', text):
        return text
    if os.name == 'nt':
        return "'" + text.replace("'", "''") + "'"
    return shlex.quote(text)


def clock(seconds):
    s = int(round(float(seconds or 0)))
    return f'{s // 60}:{s % 60:02d}'


def cut_name(cut):
    return making.CUT_NAME[cut]


def krish_words(words, flag='--use-last'):
    if not making.krish_words(words) or len(words.strip()) > 600:
        raise TakeError(f'{flag} is Krish\'s own words, as he said them, starting "Krish" and the date '
                        '(for example "Krish, 2026-10-12: use the last one"), at most 600 characters')
    return words.strip()


def runner_key_here():
    """True on a Windows machine whose Credential Manager holds the runner key
    the recordings lane sends with. Only that it is there is read; the key
    itself is never read into this process."""
    if os.name != 'nt':
        return False
    try:
        import ctypes
        from ctypes import wintypes
        advapi = ctypes.WinDLL('Advapi32.dll', use_last_error=True)
        read = advapi.CredReadW
        read.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, ctypes.POINTER(ctypes.c_void_p)]
        read.restype = wintypes.BOOL
        free = advapi.CredFree
        free.argtypes = [ctypes.c_void_p]
        pointer = ctypes.c_void_p()
        if not read(RUNNER_CREDENTIAL, 1, 0, ctypes.byref(pointer)):
            return False
        free(pointer)
        return True
    except (OSError, AttributeError):
        return False


def read_json_file(path, what):
    try:
        data = json.loads(Path(path).read_text(encoding='utf-8-sig'))
    except (OSError, ValueError) as error:
        raise TakeError(f'{what} ({path}) could not be read as JSON: {error}')
    return data


def project_of(data):
    """get_project's answer, as saved: the object itself, or {"project": ...}."""
    if isinstance(data, dict) and isinstance(data.get('project'), dict):
        data = data['project']
    if not isinstance(data, dict) or not making.UUID.match(str(data.get('id') or '')) \
            or not isinstance(data.get('compositions'), list) or not isinstance(data.get('media_files'), dict):
        raise TakeError('the project file is not get_project\'s answer (it needs id, media_files and compositions): '
                        'save the whole answer, as it came')
    return data


def entry_of(record, cut):
    descript = record.get('descript') if isinstance(record, dict) and isinstance(record.get('descript'), dict) else {}
    cuts = descript.get('cuts') if isinstance(descript.get('cuts'), dict) else {}
    entry = cuts.get(cut)
    return entry if isinstance(entry, dict) else None


def piece_of(record, piece_id, idea=''):
    """What recording_match needs to name a piece and find its scripts."""
    folder = ((record or {}).get('pack') or {}).get('folder') or ''
    when = folder[:10] if re.match(r'\d{4}-\d{2}-\d{2}', folder) else None
    return {'id': piece_id, 'folder': folder, 'scheduled_for': when, 'idea': idea}


def counting_take(record, cut):
    """The newest take of this cut on the record that counts for its current words, or None."""
    hashes = making.current_hashes(record)
    found = [r for r in (record.get('recordings') or []) if isinstance(r, dict) and r.get('cut') == cut
             and recording_match.take_counts(r, hashes)]
    return max(found, key=lambda r: str(r.get('at') or '')) if found else None


def take_name(cut, when=None):
    """The name the take goes into the recordings lane under. It says the
    cut in words the matcher reads (story_check.cut_of), and carries no
    number that could read as 90."""
    day = (when or date.today()).isoformat()
    return f'Descript {cut} take {day}.mp4'


def drive_checked(record, cfg):
    descript = record.get('descript') if isinstance(record.get('descript'), dict) else {}
    drive = str(descript.get('drive_id') or '')
    descript_send.check_drive(cfg, drive)
    return drive


def takes_allowed(cfg):
    """His yes to the private copy, verbatim, or refused."""
    takes = ((cfg.get('said') or {}).get('takes') or {}) if isinstance(cfg, dict) else {}
    if not str(takes.get('words') or '').strip():
        raise TakeError('config/descript.json holds no yes from Krish to a private copy of his takes (said.takes): nothing is copied')
    return takes


# ---------------------------------------------------------------- 1. which cuts are waiting

def waiting(call=None, monday=None, workbench=None):
    """Each cut of each piece waiting for a recording this week and next
    (recording_match.waiting_pieces), with what Descript holds for it, and
    for a cut with no project on its record the line WORKBENCH.md keeps for
    a send made by hand, if any."""
    workbench = workbench or descript_send.WORKBENCH
    monday = monday or recording_match.week_monday()
    try:
        pieces, _claimed = recording_match.waiting_pieces(call or making._engine_call, monday)
    except recording_match.MatchError as error:
        raise TakeError(str(error))
    found = []
    for piece in pieces:
        record = making.record_of(piece['id'], call)
        shown = {**piece_of(record, piece['id'], piece.get('idea') or ''), 'scheduled_for': piece.get('scheduled_for')}
        for cut in CUTS:
            if cut in (piece.get('recorded') or []):
                continue
            entry = entry_of(record, cut) or {}
            state = making.descript_state(record, cut)[0]
            row = {'piece_id': piece['id'], 'label': recording_match.label(shown), 'cut': cut, 'descript': state,
                   'project_id': entry.get('project_id'), 'record_composition': entry.get('record_composition'),
                   'record_link': entry.get('record_link'), 'get_project': None, 'hand_made': None}
            if entry.get('project_id'):
                row['get_project'] = {'project_id': entry['project_id']}
            else:
                # A send made by hand that is not on the record yet: recorded first, never the Inbox.
                row['hand_made'] = descript_send.hand_made(piece['id'], cut, workbench)
            found.append(row)
    return {'week_start': monday.isoformat(), 'cuts': found}


def show_waiting(report):
    if not report['cuts']:
        return 'No piece this week or next is waiting for a recording.'
    lines = []
    for row in report['cuts']:
        head = f'{row["label"]}, {cut_name(row["cut"])} cut (piece {row["piece_id"]})'
        if not row['project_id'] and row.get('hand_made'):
            lines.append(f'{head}: sent to Descript by hand, and the record does not hold that project yet. Never through the Inbox: '
                         f'record it first with the line WORKBENCH.md keeps, exactly as it is, then run waiting again:')
            lines.append(f'  {row["hand_made"]}')
            continue
        if not row['project_id']:
            lines.append(f'{head}: no Descript project on its record, so its take comes through the Inbox')
            continue
        lines.append(f'{head}: Record here {row["record_link"]}')
        lines.append(f'  get_project {json.dumps(row["get_project"])}; save the answer, then '
                     f'{PY} {SELF} look --piece {row["piece_id"]} --cut {row["cut"]} --project FILE')
    return '\n'.join(lines)


# ---------------------------------------------------------------- 2. what the timeline holds

def recordings_of(new):
    """New media grouped into recordings: two the same length (within half a
    second) are one take's camera and microphone. Media with no length are
    each their own."""
    groups = []
    for name, info in sorted(new, key=lambda item: (item[1].get('duration') is None, item[1].get('duration') or 0, item[0])):
        length = info.get('duration')
        if isinstance(length, (int, float)) and groups and isinstance(groups[-1]['seconds'], (int, float)) \
                and abs(groups[-1]['seconds'] - length) <= SAME_RECORDING:
            groups[-1]['media'].append(name)
            continue
        groups.append({'seconds': float(length) if isinstance(length, (int, float)) else None, 'media': [name]})
    return groups


def grown(project, entry, groups, slate):
    """The timelines other than the cut's Record here and Script ones that
    run long enough to hold a new recording: where Krish recorded instead."""
    longest = max((g['seconds'] for g in groups if isinstance(g['seconds'], (int, float))), default=None)
    found = []
    for c in project['compositions']:
        if not isinstance(c, dict) or str(c.get('id') or '').lower() in (entry.get('record_composition'), entry.get('script_composition')):
            continue
        if str(c.get('name') or '').startswith('Script'):
            continue
        try:
            length = float(c.get('duration'))
        except (TypeError, ValueError):
            continue
        if length > slate + 0.5 and (longest is None or length >= longest - max(1.0, 0.02 * longest)):
            found.append({'id': str(c.get('id')), 'name': str(c.get('name') or ''), 'seconds': length})
    return found


def look(record, piece_id, cut, project, cfg, words=None):
    """What the cut's Record here timeline holds: state 'take' (bring it
    in), 'ask' (a question for Krish, in reason) or 'nothing'. words:
    Krish's own words, which settle the questions in BY_HIS_WORDS."""
    cut = _cut(cut)
    takes_allowed(cfg)
    words = krish_words(words, '--krish-words') if words is not None else None
    entry = entry_of(record, cut)
    piece = piece_of(record, piece_id)
    out = {'piece_id': piece_id, 'cut': cut, 'label': recording_match.label(piece), 'state': 'nothing', 'code': None, 'reason': '', 'notes': [],
           'project_id': None, 'record_composition': None, 'record_link': None, 'timeline_seconds': None, 'take_seconds': None,
           'new_media': [], 'recordings': [], 'calls': {}, 'settled': [], 'krish_words': words, 'elsewhere': []}
    name = f'the {cut_name(cut)} cut of {out["label"]}'
    if not entry or not entry.get('project_id'):
        line = descript_send.hand_made(piece_id, cut, descript_send.WORKBENCH)
        if line:
            raise TakeError(f'{name} was sent to Descript by hand, and the record does not hold that project yet: record it first with '
                            f'the line WORKBENCH.md keeps, exactly as it is, then look again. Never through the Inbox: {line}')
        out['reason'] = f'{name} has no Descript project on its record, so its take comes through the Inbox'
        return out
    if not entry.get('record_composition'):
        out['reason'] = (f'the send of {name} to Descript did not finish ({entry.get("error") or "no timelines on the record"}), so it has '
                         'no Record here timeline yet: send it again (descript_send.py pending)')
        return out
    drive_checked(record, cfg)
    project = project_of(project)
    out.update(project_id=entry['project_id'], record_composition=entry.get('record_composition'), record_link=entry.get('record_link'))
    if project['id'].lower() != entry['project_id']:
        raise TakeError(f'the project file is project {project["id"]}, and {name} is in project {entry["project_id"]}: '
                        'run get_project for the right one')
    if project.get('drive_id') and str(project['drive_id']).lower() != cfg['drive_id']:
        raise TakeError(f'the project is in drive {project["drive_id"]}, not Krish\'s ({cfg["drive_name"]}): nothing is copied')

    def ask(code, reason):
        if words and code in BY_HIS_WORDS:
            # His words answer this question: said, kept, and the look goes on.
            out['settled'].append(code)
            out['notes'].append(f'{reason.split(". Ask")[0].split(": ask")[0]}; his words settle it ("{words}")')
            return None
        out.update(state='ask', code=code, reason=reason)
        return out

    composition = next((c for c in project['compositions'] if isinstance(c, dict)
                        and str(c.get('id') or '').lower() == str(entry.get('record_composition') or '')), None)
    if composition is None:
        return ask('gone', f'the Record here timeline of {name} ({entry.get("record_link")}) is not in the project any more; '
                   'ask Krish where he recorded it')
    if composition.get('name') and composition['name'] != 'Record here':
        out['notes'].append(f'the Record here timeline is called "{composition["name"]}" now; it is found by its id')
    try:
        timeline = float(composition.get('duration'))
    except (TypeError, ValueError):
        return ask('no_length', f'get_project gave no length for the Record here timeline of {name}, so what it holds is not known')
    slate = float(cfg['record_here']['seconds'])
    out['timeline_seconds'] = round(timeline, 3)
    known = set(entry.get('known_media') or [])
    new = [(media, info if isinstance(info, dict) else {}) for media, info in project['media_files'].items() if media not in known]
    usable = [(media, info) for media, info in new if info.get('type') in ('video', 'audio')]
    for media, info in new:
        if (media, info) not in usable:
            out['notes'].append(f'"{media}" is new in the project but is not video or sound ({info.get("type")}); it is left alone')
    out['new_media'] = [{'name': media, 'type': info.get('type'), 'seconds': info.get('duration')} for media, info in usable]
    groups = recordings_of(usable)
    out['recordings'] = groups
    out['calls'] = {
        'export_transcript': {'project_id': entry['project_id'], 'composition_id': entry['record_composition'], 'format': 'txt',
                              'include_speaker_labels': 'off'},
        'publish_project': {'project_id': entry['project_id'], 'composition_id': entry['record_composition'], **PUBLISH},
    }
    shown_publishes = [p for p in project.get('publishes') or [] if isinstance(p, dict)]
    open_ones = [p for p in shown_publishes if str(p.get('access_level') or '').lower() not in ('', 'private')]
    if timeline <= slate + 0.5:
        if groups:
            where = grown(project, entry, groups, slate)
            out['elsewhere'] = where
            record_name = composition.get('name') or 'Record here'
            if where:
                named = ' or '.join(f'"{w["name"]}" ({w["id"][:5]}, {clock(w["seconds"])})' for w in where)
                said = (f'{len(groups)} new recording{"s are" if len(groups) > 1 else " is"} in the project of {name}, but its Record here '
                        f'timeline ("{record_name}", the Record here link) still runs about {slate:g} second: Krish recorded in {named}. '
                        f'Nothing is copied from another timeline: ask him to drag the clip into "{record_name}" or record again through '
                        f'the Record here link ({entry.get("record_link")})')
            else:
                said = (f'{len(groups)} new recording{"s are" if len(groups) > 1 else " is"} in the project of {name}, but its Record here '
                        f'timeline ("{record_name}", {entry.get("record_link")}) still runs about {slate:g} second (the slate), and no other '
                        'timeline runs long enough to hold it: ask Krish which timeline he recorded in')
            return ask('elsewhere', said)
        out['reason'] = f'nothing is recorded yet in the Record here timeline of {name}: it still runs about {slate:g} second, the slate'
        return out
    out['take_seconds'] = round(timeline - slate, 3)
    if not groups:
        held = counting_take(record, cut)
        if held:
            out['reason'] = (f'the Record here timeline of {name} holds only media the record knows, and the cut already has a take of '
                             f'its current words ({held.get("path")}): nothing new to bring in')
            return out
        asked = ask('older_take', f'the Record here timeline of {name} runs {clock(timeline)} but holds only media the record already knows: a '
                    'take from before the script last changed, or one already brought in, so it does not count for the current words. '
                    'Ask Krish whether to use it or record that cut again')
        if asked:
            return asked
    state = making.descript_state(record, cut)[0]
    if state in ('older', 'failed'):
        why = 'Descript holds older words for this cut than the script now' if state == 'older' \
            else 'the last send of this cut\'s new words to Descript failed, so Descript holds the older ones'
        asked = ask('older_words', f'{why}: the take in the Record here timeline of {name} may be of the older words. '
                    'Ask Krish whether to use it or record that cut again')
        if asked:
            return asked
    held = counting_take(record, cut)
    if held and groups:
        asked = ask('recorded', f'{name} already has a take of its current words on the record ({held.get("path")}), and Krish recorded '
                    'again in Descript: ask whether to use the new one')
        if asked:
            return asked
    if open_ones:
        levels = ', '.join(sorted({str(p.get('access_level')) for p in open_ones}))
        asked = ask('published', f'the project of {name} is already published at {levels}: a private copy would replace that share page. '
                    'Ask Krish before copying anything')
        if asked:
            return asked
    lengths = [g['seconds'] for g in groups if isinstance(g['seconds'], (int, float))]
    slack = max(1.0, 0.02 * timeline)
    if groups and len(lengths) == len(groups) and timeline > slate + sum(lengths) + slack:
        return ask('longer', f'the Record here timeline of {name} runs {clock(timeline)}, longer than the slate and the new '
                   f'recording{"s" if len(groups) > 1 else ""} ({clock(slate + sum(lengths))}): something the record already knows, '
                   'such as an older take, is in it too. Ask Krish which take to use')
    out['state'] = 'take'
    if not groups:
        out['reason'] = (f'the Record here timeline of {name} holds a take of {clock(timeline - slate)} the record already knows, and '
                         'Krish\'s words say to use it')
        return out
    each = ', '.join(clock(g['seconds']) if g['seconds'] else 'length unknown' for g in groups)
    alone = [g for g in groups if isinstance(g['seconds'], (int, float)) and abs(timeline - slate - g['seconds']) <= slack]
    if len(groups) > 1 and len(alone) == 1 and len(lengths) == len(groups) and timeline < slate + sum(lengths) - slack:
        out['reason'] = (f'{len(groups)} new recordings are in the project of {name} ({each}), and its Record here timeline runs as '
                         f'long as one of them ({clock(alone[0]["seconds"])}): the timeline is the take as edited')
    elif len(groups) > 1:
        out['reason'] = (f'{len(groups)} recordings are in the Record here timeline of {name} ({each}): '
                         'the words decide whether he read the script more than once (check)')
    else:
        out['reason'] = f'a take of {clock(timeline - slate)} is in the Record here timeline of {name}'
    return out


def show_look(r):
    lines = [f'{r["state"]}: {r["reason"]}.']
    lines += [f'note: {n}.' for n in r['notes']]
    if r['state'] == 'take':
        lines.append(f'next: export_transcript {json.dumps(r["calls"]["export_transcript"])}; save the words, then '
                     f'{PY} {SELF} check --piece {r["piece_id"]} --cut {r["cut"]} --words FILE --project FILE')
    elif r['state'] == 'ask':
        if r['code'] in BY_HIS_WORDS:
            lines.append('Nothing is copied. Say this to Krish in one line, and wait for his words. If he says to use it, run look again '
                         'with --krish-words "Krish, YYYY-MM-DD: his exact words", then check and fetch with the same.')
        else:
            lines.append('Nothing is copied. Say this to Krish in one line, and wait for his words.')
    return '\n'.join(lines)


# ---------------------------------------------------------------- 3. the words

SRT_TIME = re.compile(r'(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->')
TIMECODE = re.compile(r'^\s*[\[(]?(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?[\])]?\s+')
LABEL = re.compile(r'^\s*([^\s:\[\]()][^:\[\]()]{0,40}):\s+')
NAMED_SPEAKER = re.compile(r'^(?:speaker\s*\d+|unknown speaker|unknown)$', re.I)
SENTENCE_END = re.compile(r'[.!?]["\u201d\u2019)]*$')


def _seconds(h, m, s, frac):
    return int(h or 0) * 3600 + int(m) * 60 + int(s) + (int(frac) / (10 ** len(frac)) if frac else 0.0)


def transcript_text(path):
    """The words export_transcript gave, as saved: the text itself, or a
    JSON answer holding it."""
    raw = Path(path).read_text(encoding='utf-8-sig')
    try:
        data = json.loads(raw)
    except ValueError:
        return raw
    if isinstance(data, str):
        return data
    if isinstance(data, dict):
        for key in ('content', 'transcript', 'text', 'data'):
            if isinstance(data.get(key), str):
                return data[key]
    raise TakeError(f'{path} is JSON but holds no transcript text (content, transcript or text)')


def segments_of(text):
    """[(start seconds or None, text)] from srt or txt. In txt, a line may
    start with a time code, and a speaker label is taken off when the same
    label starts two lines or more (export with include_speaker_labels
    "off" and there is none)."""
    if SRT_TIME.search(text):
        found = []
        for block in re.split(r'\n\s*\n', text.replace('\r\n', '\n').replace('\r', '\n')):
            lines = [line for line in block.split('\n') if line.strip()]
            for n, line in enumerate(lines):
                hit = SRT_TIME.search(line)
                if hit:
                    found.append((_seconds(*hit.groups()), ' '.join(lines[n + 1:])))
                    break
        return found, 'srt'
    rows = []
    for line in text.replace('\r\n', '\n').replace('\r', '\n').split('\n'):
        if not line.strip():
            continue
        start = None
        hit = TIMECODE.match(line)
        if hit:
            start = _seconds(*hit.groups())
            line = line[hit.end():]
        rows.append([start, line])
    labels = {}
    for row in rows:
        hit = LABEL.match(row[1])
        if hit:
            labels[hit.group(1).strip()] = labels.get(hit.group(1).strip(), 0) + 1
    for row in rows:
        hit = LABEL.match(row[1])
        if hit and (labels.get(hit.group(1).strip(), 0) >= 2 or NAMED_SPEAKER.match(hit.group(1).strip())):
            row[1] = row[1][hit.end():]
        if row[0] is None:
            # A time code after the label.
            hit = TIMECODE.match(row[1])
            if hit:
                row[0] = _seconds(*hit.groups())
                row[1] = row[1][hit.end():]
    return [(start, line) for start, line in rows], 'txt'


def tokens_of(segments):
    """[(word, start seconds or None, a reading may start here)]: the first
    word of every segment, and of every sentence."""
    tokens = []
    for start, text in segments:
        first = True
        for chunk in text.split():
            for word in recording_match.words(chunk):
                tokens.append((word, start, first))
                first = False
            if SENTENCE_END.search(chunk):
                first = True
    return tokens


def readings_of(tokens, script):
    """Every place the script's opening starts, each running to the next: a
    full reading covers at least FULL_SHARE of the script's words; a shorter
    one is a restart. A start is a segment or sentence start whose words
    match the script's opening (opening_score 0.72 or more), and whose first
    ANCHOR words match the script's first ANCHOR words better than they
    match the place the reading before had reached (opening_score alone
    also passes a place a little way into the script)."""
    said = [t[0] for t in tokens]
    opening = set(script[:40])
    starts = []
    for i, token in enumerate(tokens):
        if not (token[2] or i == 0):
            continue
        if i and len(opening & set(said[i:i + 20])) < 4:
            continue
        score = recording_match.opening_score(said[i:i + HEAD_WORDS], script)
        if score < SURE:
            continue
        if i:
            head = said[i:i + ANCHOR]
            anchored = recording_match.ordered_similarity(head, script[:ANCHOR])
            if anchored < 0.5:
                continue
            if starts:
                reached = i - starts[-1][0]
                if recording_match.ordered_similarity(head, script[reached:reached + ANCHOR]) >= anchored:
                    continue
        starts.append((i, score))
    found = []
    for k, (i, score) in enumerate(starts):
        end = starts[k + 1][0] if k + 1 < len(starts) else len(said)
        part = said[i:end]
        full = len(part) >= FULL_SHARE * len(script)
        found.append({'start_word': i, 'start_seconds': tokens[i][1], 'words': len(part), 'score': score, 'full': full,
                      'whole': round(recording_match.ordered_similarity(part, script), 3) if full else None})
    return found


def scripts_here(record, piece_id, cut, script_path=None, plans=PLANS, roots=None):
    """{cut: {'text', 'from'}}: the piece's scripts as the matcher finds
    them, the cut's own from --script when given. The cut's must hold the
    words the check passed."""
    found = recording_match.scripts_for(piece_of(record, piece_id), plans, roots)
    if script_path:
        try:
            found[cut] = {'text': Path(script_path).read_text(encoding='utf-8-sig'), 'from': str(script_path)}
        except OSError as error:
            raise TakeError(f'--script {script_path} could not be read: {error}')
    if cut not in found:
        raise TakeError(f'no {cut_name(cut)} script for this piece is on this machine (docs/plans post.json, the draft beside it, or '
                        'the pack): pull main, or give it with --script FILE')
    current = making.current_hashes(record).get(cut)
    if current and making.script_hash(found[cut]['text']) != current:
        raise TakeError(f'the {cut_name(cut)} script on this machine ({found[cut]["from"]}) is not the words the scripts\' check passed: '
                        'pull main, or give the checked file with --script FILE')
    return found


def check(record, piece_id, cut, transcript, project=None, cfg=None, use_last=None, scripts=None, words=None):
    """Go or ask, with every reason. transcript is export_transcript's text.
    words: Krish's own words settling look's questions (BY_HIS_WORDS)."""
    cut = _cut(cut)
    other = 'short' if cut == 'long' else 'long'
    cfg = cfg or descript_send.load_config()
    use_last = krish_words(use_last) if use_last is not None else None
    words = krish_words(words, '--krish-words') if words is not None else None
    scripts = scripts or scripts_here(record, piece_id, cut)
    script = recording_match.words(scripts[cut]['text'])
    segments, kind = segments_of(transcript)
    tokens = tokens_of(segments)
    said = [t[0] for t in tokens]
    out = {'piece_id': piece_id, 'cut': cut, 'decision': 'go', 'reasons': [], 'notes': [], 'format': kind, 'words': len(said),
           'script_from': scripts[cut]['from'], 'score': None, 'other_cut_score': None, 'readings': [], 'from_seconds': None,
           'whole': None, 'look': None, 'take_seconds': None, 'calls': {}, 'krish_words': words, 'settled': []}
    entry = entry_of(record, cut) or {}
    if entry.get('project_id') and entry.get('record_composition'):
        out['calls']['publish_project'] = {'project_id': entry['project_id'], 'composition_id': entry['record_composition'], **PUBLISH}
    ask = out['reasons'].append
    seen = None
    if project is not None:
        seen = look(record, piece_id, cut, project, cfg, words)
        out['look'] = {k: seen[k] for k in ('state', 'code', 'reason', 'timeline_seconds', 'take_seconds', 'recordings', 'settled')}
        out['take_seconds'] = seen['take_seconds']
        out['settled'] = list(seen['settled'])
        out['notes'] += seen['notes'][:] if seen['settled'] else []
        if seen['state'] == 'take' and len(seen['recordings']) > 1:
            out['notes'].append(seen['reason'])
        elif seen['state'] != 'take' and seen['code'] != 'longer':
            ask(seen['reason'])

    def finish():
        if seen and seen['code'] == 'longer':
            # A timeline longer than the new recording holds an older take before it: his words to use the last settle that.
            if out['from_seconds'] is not None:
                out['notes'].append(seen['reason'].split(': something')[0] + ': the older take before the last reading is left out')
            else:
                out['reasons'].insert(0, seen['reason'])
        out['decision'] = 'ask' if out['reasons'] else 'go'
        return out

    if len(said) < MIN_HEAD_WORDS:
        ask(f'too little speech in the timeline ({len(said)} words) to tell what it is')
        return finish()
    out['score'] = recording_match.opening_score(said[:HEAD_WORDS], script)
    if other in scripts:
        out['other_cut_score'] = recording_match.opening_score(said[:HEAD_WORDS], recording_match.words(scripts[other]['text']))
    readings = readings_of(tokens, script)
    out['readings'] = readings
    full = [r for r in readings if r['full']]
    if not full:
        if not readings:
            ask(f'its opening matches the {cut_name(cut)} script at {out["score"]:.2f}, and {SURE:.2f} is needed')
        else:
            longest = max(r['words'] for r in readings)
            ask(f'it starts the {cut_name(cut)} script but never reads it through (the longest reading is {longest} of '
                f'{len(script)} words)')
        return finish()
    chosen = full[0]
    if len(full) > 1:
        starts = ', '.join(clock(r['start_seconds']) if r['start_seconds'] is not None else f'word {r["start_word"] + 1}' for r in full)
        if not use_last:
            ask(f'Krish read the {cut_name(cut)} script {len(full)} times in this timeline (from {starts}): ask which reading to '
                'use, unless his words say use the last one')
        elif full[-1]['start_seconds'] is None:
            ask('his words say use the last reading, but these words carry no times: export the transcript again with format '
                '"srt", so where the last reading starts is known')
        else:
            chosen = full[-1]
            out['from_seconds'] = round(max(0.0, chosen['start_seconds'] - LEAD), 3)
            out['notes'].append(f'Krish read it {len(full)} times; his words say use the last, which starts at '
                                f'{clock(chosen["start_seconds"])}: fetch from {out["from_seconds"]:.3f} seconds, with his words')
    if chosen['start_word'] > 0 and out['from_seconds'] is None:
        # Speech before the reading: up to a third of the opening is let go by opening_score; more is asked about.
        if out['score'] < SURE:
            where = clock(chosen['start_seconds']) if chosen['start_seconds'] is not None else f'word {chosen["start_word"] + 1}'
            ask(f'the timeline opens with other words, and the {cut_name(cut)} script starts at {where}')
    out['whole'] = chosen['whole']
    if chosen['whole'] is not None and chosen['whole'] < WHOLE_FLOOR:
        if words and {'older_take', 'older_words'} & set(out['settled']):
            # He said to use a take of the older words: its opening is this script's, the rest may differ.
            out['notes'].append(f'the reading as a whole matches the {cut_name(cut)} script only {chosen["whole"]:.2f}, older words, '
                                'and his words say to use it')
        else:
            ask(f'its opening is the {cut_name(cut)} script\'s, but the reading as a whole matches it only {chosen["whole"]:.2f}: '
                'older words, or a different script')
    if out['other_cut_score'] is not None and out['other_cut_score'] - chosen['score'] >= MARGIN:
        ask(f'its words are closer to the {cut_name(other)} script ({out["other_cut_score"]:.2f}) than to the '
            f'{cut_name(cut)} one ({chosen["score"]:.2f})')
    settled = seen and (seen['state'] == 'take' or (seen['code'] == 'longer' and out['from_seconds'] is not None))
    if settled and isinstance(seen['take_seconds'], (int, float)):
        length = seen['timeline_seconds'] - out['from_seconds'] if out['from_seconds'] is not None else seen['take_seconds']
        out['take_seconds'] = round(length, 3)
        by_length = 'long' if length >= LONG_FROM else 'short' if length <= SHORT_UP_TO else None
        if by_length == other and (len(full) == 1 or out['from_seconds'] is not None):
            ask(f'it runs {clock(length)}, which is a {cut_name(other)} take, in the {cut_name(cut)} cut\'s timeline')
    return finish()


def show_check(r):
    lines = []
    if r['decision'] == 'go':
        lines.append(f'go: the {cut_name(r["cut"])} take reads the {cut_name(r["cut"])} script (its opening matches '
                     f'{r["score"]:.2f}, {SURE:.2f} needed; the reading as a whole {r["whole"]:.2f}).')
    else:
        lines.append('ask: ' + '; '.join(r['reasons']) + '.')
    lines += [f'note: {n}.' for n in r['notes']]
    if r['decision'] == 'go':
        frm = f' --from-seconds {r["from_seconds"]:.3f} --use-last "<his words>"' if r['from_seconds'] is not None else ''
        his = f' --krish-words {_q(r["krish_words"])}' if r.get('krish_words') else ''
        publish = r['calls'].get('publish_project') or {'project_id': '<the project>', 'composition_id': '<Record here>', **PUBLISH}
        lines.append(f'next: publish_project {json.dumps(publish)}, wait_for_job, then {PY} {SELF} fetch --url DOWNLOAD_URL '
                     f'--piece {r["piece_id"]} --cut {r["cut"]} --slate-seconds 1 --out DIR --project FILE{frm}{his}')
    else:
        lines.append('Nothing is copied. Say this to Krish in one line, and wait for his words.')
    return '\n'.join(lines)


# ---------------------------------------------------------------- 4. the copy

def _tool(name):
    tool = shutil.which(name)
    if not tool:
        raise TakeError(f'{name} is not on this machine, so the take cannot be trimmed here')
    return tool


def probe(path):
    """{'width', 'height', 'fps' (a Fraction), 'duration', 'video_start', 'audio'} by ffprobe."""
    done = subprocess.run([_tool('ffprobe'), '-v', 'error', '-show_entries',
                           'stream=codec_type,width,height,r_frame_rate,avg_frame_rate,start_time:format=duration', '-of', 'json', str(path)],
                          capture_output=True, text=True)
    try:
        data = json.loads(done.stdout or '{}')
        video = next(s for s in data.get('streams') or [] if s.get('codec_type') == 'video')
        rate = Fraction(video.get('r_frame_rate') or '0/1')
        if not rate:
            rate = Fraction(video.get('avg_frame_rate') or '0/1')
        info = {'width': int(video['width']), 'height': int(video['height']), 'fps': rate,
                'duration': float(data['format']['duration']), 'video_start': float(video.get('start_time') or 0.0),
                'audio': any(s.get('codec_type') == 'audio' for s in data.get('streams') or [])}
    except (ValueError, KeyError, StopIteration, TypeError, ZeroDivisionError):
        raise TakeError(f'ffprobe could not read {Path(path).name} as a video: the download is not a whole video file')
    if info['fps'] <= 0 or info['duration'] <= 0:
        raise TakeError(f'{Path(path).name} has no frame rate or no length that ffprobe can read')
    return info


def frame_count(path):
    done = subprocess.run([_tool('ffprobe'), '-v', 'error', '-select_streams', 'v:0', '-count_packets', '-show_entries',
                           'stream=nb_read_packets', '-of', 'csv=p=0', str(path)], capture_output=True, text=True)
    try:
        return int(done.stdout.strip().split(',')[0])
    except (ValueError, IndexError):
        raise TakeError(f'ffprobe could not count the frames of {Path(path).name}')


def frame_rgb(path, seconds):
    """One frame at that time, made small: SAMPLE_W x SAMPLE_H rgb bytes."""
    done = subprocess.run([_tool('ffmpeg'), '-v', 'error', '-ss', f'{max(0.0, seconds):.6f}', '-i', str(path), '-frames:v', '1',
                           '-vf', f'scale={SAMPLE_W}:{SAMPLE_H}:flags=area', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                          capture_output=True)
    if done.returncode != 0 or len(done.stdout) != SAMPLE_W * SAMPLE_H * 3:
        raise TakeError(f'ffmpeg could not read the frame at {seconds:.2f} seconds of {Path(path).name}')
    return done.stdout


def slate_like(raw):
    """True for a frame of the Record here slate: nearly all near black
    (INK) with the mint heading in it. Dark footage has the black, never the mint."""
    n = len(raw) // 3
    ink = mint = 0
    for i in range(0, n * 3, 3):
        r, g, b = raw[i], raw[i + 1], raw[i + 2]
        if abs(r - INK[0]) <= INK_NEAR and abs(g - INK[1]) <= INK_NEAR and abs(b - INK[2]) <= INK_NEAR:
            ink += 1
        elif abs(r - MINT[0]) <= MINT_NEAR and abs(g - MINT[1]) <= MINT_NEAR and abs(b - MINT[2]) <= MINT_NEAR:
            mint += 1
    return ink / n >= INK_SHARE and mint / n >= MINT_SHARE


def frame_at(info, index):
    """A time that picks frame index (from 0), on the video's own clock: a
    quarter of a frame before it starts, since a seek keeps the first frame
    that starts at or after the time asked."""
    return max(0.0, info['video_start'] + float((Fraction(index) - Fraction(1, 4)) / info['fps']))


def slate_place(src, info, frames, slate_frames):
    """'start' or 'end': where the slate is, checked to the frame: the
    slate's last frame is the slate and the next is not. Refused when it is
    at neither, or runs longer or shorter than slate_frames."""
    if slate_frames <= 0:
        return None
    if frames <= slate_frames + 1:
        raise TakeError('the copy is no longer than the slate: nothing is recorded in it')
    # Found by its middle frame, so a first or last frame the publish darkened does not hide it; its edges are checked below.
    head = slate_like(frame_rgb(src, frame_at(info, slate_frames // 2)))
    tail = slate_like(frame_rgb(src, frame_at(info, frames - 1 - slate_frames // 2)))
    if head and tail:
        raise TakeError('the copy starts and ends with the slate: ask Krish what the timeline holds; nothing was trimmed')
    if not head and not tail:
        raise TakeError('the copy neither starts nor ends with the Record here slate, so where the slate is is not known: nothing '
                        'was trimmed. If his take covers the slate (the timeline runs as long as the recording), run again with '
                        '--slate-seconds 0; otherwise ask Krish')
    if head:
        last, first = slate_frames - 1, slate_frames
        where = 'start'
    else:
        last, first = frames - slate_frames, frames - slate_frames - 1
        where = 'end'
    if not slate_like(frame_rgb(src, frame_at(info, last))):
        raise TakeError(f'the slate at the {where} runs shorter than {slate_frames} frames: nothing was trimmed; ask Krish')
    if slate_like(frame_rgb(src, frame_at(info, first))):
        raise TakeError(f'the slate at the {where} runs longer than {slate_frames} frames: nothing was trimmed; check --slate-seconds')
    return where


def keyframe_at(src, info, seconds):
    """True when a keyframe of the video sits at that time (within half a frame)."""
    done = subprocess.run([_tool('ffprobe'), '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=pts_time,flags',
                           '-read_intervals', f'%+{seconds + 2:.3f}', '-of', 'csv=p=0', str(src)], capture_output=True, text=True)
    half = float(Fraction(1, 2) / info['fps'])
    for line in done.stdout.splitlines():
        parts = line.split(',')
        if len(parts) >= 2 and 'K' in parts[1]:
            try:
                if abs(float(parts[0]) - info['video_start'] - seconds) < half:
                    return True
            except ValueError:
                continue
    return False


def _run(cmd, what):
    done = subprocess.run(cmd, capture_output=True, text=True)
    if done.returncode != 0:
        raise TakeError(f'ffmpeg could not {what}: {done.stderr.strip()[-300:]}')


def trim(src, dst, info, start, end):
    """Frames [start, end) of src into dst, with the sound trimmed to the
    same times. The video is copied when start is 0 or a keyframe, else
    re-encoded once. Returns 'copied' or 're-encoded'."""
    fps = info['fps']
    t0, t1 = float(Fraction(start) / fps), float(Fraction(end) / fps)
    n = end - start
    sound = ['-af', f'atrim=start={t0:.6f}:end={t1:.6f},asetpts=PTS-STARTPTS', '-c:a', 'aac', '-b:a', '256k']
    if start == 0 or keyframe_at(src, info, t0):
        cmd = [_tool('ffmpeg'), '-v', 'error', '-y'] + (['-ss', f'{t0:.6f}'] if start else []) + ['-i', str(src)]
        cmd += (['-i', str(src)] if info['audio'] else []) + ['-map', '0:v:0', '-c:v', 'copy', '-frames:v', str(n)]
        cmd += (['-map', '1:a:0'] + sound if info['audio'] else []) + ['-movflags', '+faststart', str(dst)]
        _run(cmd, 'copy the take')
        try:
            if frame_count(dst) == n and abs(probe(dst)['video_start']) < float(Fraction(1, 2) / fps):
                return 'copied'
        except TakeError:
            pass
    graph = f'[0:v]trim=start_frame={start}:end_frame={end},setpts=PTS-STARTPTS[v]'
    if info['audio']:
        graph += f';[0:a]atrim=start={t0:.6f}:end={t1:.6f},asetpts=PTS-STARTPTS[a]'
    cmd = [_tool('ffmpeg'), '-v', 'error', '-y', '-i', str(src), '-filter_complex', graph, '-map', '[v]']
    cmd += (['-map', '[a]', '-c:a', 'aac', '-b:a', '256k'] if info['audio'] else [])
    cmd += ['-c:v', 'libx264', '-preset', 'medium', '-crf', CRF, '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(dst)]
    _run(cmd, 're-encode the take')
    return 're-encoded'


def download(url, handle):
    """Streams the download link into handle. Returns the length the server
    said, or None."""
    request = urllib.request.Request(url, method='GET', headers={'User-Agent': 'mindmake-descript-take'})
    try:
        with urllib.request.urlopen(request, timeout=900) as response:
            said = response.headers.get('Content-Length')
            while True:
                block = response.read(1024 * 1024)
                if not block:
                    break
                handle.write(block)
    except urllib.error.HTTPError as error:
        raise DownloadRefused(error.code)
    except urllib.error.URLError as error:
        raise TakeError(f'the download could not reach Descript\'s storage ({error.reason})')
    return int(said) if said and said.isdigit() else None


class DownloadRefused(TakeError):
    def __init__(self, status):
        self.status = status
        if status in EXPIRED:
            words = (f'the download link was refused ({status}): it has most likely expired. Publish again with the same call '
                     '(Descript keeps the same private share link) and use the new download_url')
        else:
            words = f'the download answered {status}; try again, or publish again for a new download_url'
        super().__init__(words)


def sha256_of(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def check_url(url):
    parts = urlsplit(str(url or ''))
    if parts.scheme != 'https' or not parts.hostname or parts.username or parts.password:
        raise TakeError('--url is the https download_url wait_for_job gave, as it came: nothing was fetched')
    return url


def check_expiry(expires_at, now=None):
    if not expires_at:
        return
    try:
        when = datetime.fromisoformat(str(expires_at).strip().replace('Z', '+00:00'))
    except ValueError:
        raise TakeError(f'--expires-at is a time like 2026-10-12T15:04:05Z, not "{expires_at}"')
    when = when if when.tzinfo else when.replace(tzinfo=timezone.utc)
    if (now or datetime.now(timezone.utc)) >= when:
        raise TakeError(f'the download link expired at {when.isoformat()}: publish again with the same call (Descript keeps the same '
                        'private share link) and use the new download_url; nothing was fetched')


def fetch(url, piece_id, cut, out_dir, slate_seconds=1.0, project=None, record=None, cfg=None, from_seconds=None, use_last=None,
          expires_at=None, keep_download=False, by=None, fetcher=download, today=None, now=None, words=None, home=None):
    """The private copy, downloaded, its slate trimmed, hashed and named.
    Returns the report, with the next lines: on a home computer that holds
    the runner key (home(), runner_key_here), the send and the record
    lines; anywhere else, the handoff line. words: Krish's own words, which
    go onto the take's record line."""
    piece_id, cut = _piece(piece_id), _cut(cut)
    words = krish_words(words, '--krish-words') if words is not None else None
    check_url(url)
    check_expiry(expires_at, now)
    if slate_seconds < 0 or slate_seconds > 10:
        raise TakeError('--slate-seconds is how long the Record here slate runs, 1 as it was sent')
    if from_seconds is not None:
        use_last = krish_words(use_last) if use_last is not None else None
        if not use_last:
            raise TakeError('--from-seconds cuts more than the slate, which is Krish\'s choice: give his words with --use-last')
    shown_project = project_of(project) if project is not None else None
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    room = Path(tempfile.mkdtemp(dir=out_dir, prefix='.descript-download-'))
    raw = room / 'copy.mp4'
    trimmed = room / 'take.mp4'
    try:
        with open(raw, 'wb') as handle:
            said = fetcher(url, handle)
        got = raw.stat().st_size
        if said is not None and got != said:
            raise TakeError(f'the download stopped at {got} bytes of {said}: nothing was kept; fetch again')
        if got < MIN_BYTES:
            raise TakeError(f'the download is only {got} bytes, which is no video: publish again and use the new download_url')
        info = probe(raw)
        if shown_project is not None and record is not None:
            entry = entry_of(record, cut) or {}
            composition = next((c for c in shown_project['compositions'] if str(c.get('id') or '').lower()
                                == str(entry.get('record_composition') or '')), None)
            length = composition.get('duration') if composition else None
            if isinstance(length, (int, float)) and abs(info['duration'] - length) > max(1.0, 0.02 * length):
                raise TakeError(f'the copy runs {clock(info["duration"])}, and the Record here timeline ran {clock(length)} when it was '
                                'looked at: it is not that timeline as it was. Run get_project and look again, then publish again')
        frames = frame_count(raw)
        slate_frames = int(round(Fraction(str(slate_seconds)) * info['fps']))
        where = slate_place(raw, info, frames, slate_frames)
        start = slate_frames if where == 'start' else 0
        end = frames - slate_frames if where == 'end' else frames
        if from_seconds is not None:
            asked = int(round(Fraction(str(from_seconds)) * info['fps']))
            if asked > start:
                start = asked
        if end - start < int(info['fps']):
            raise TakeError('less than a second of the take would be left: nothing was trimmed; check --from-seconds')
        how = trim(raw, trimmed, info, start, end)
        kept = end - start
        if frame_count(trimmed) != kept:
            raise TakeError(f'the trimmed take has {frame_count(trimmed)} frames, not the {kept} it should: nothing was kept')
        after = probe(trimmed)
        if (after['width'], after['height']) != (info['width'], info['height']):
            raise TakeError('the trimmed take changed size: nothing was kept')
        for edge in ([frame_at(after, 0)] if where == 'start' else []) + ([frame_at(after, kept - 1)] if where == 'end' else []):
            if slate_like(frame_rgb(trimmed, edge)):
                raise TakeError('the trimmed take still shows the slate: nothing was kept')
        sha = sha256_of(trimmed)
        name = take_name(cut, today)
        target = out_dir / name
        number = 2
        while target.exists() and sha256_of(target) != sha:
            target = out_dir / f'{name[:-4]} {number}.mp4'
            number += 1
        if target.exists():
            trimmed.unlink()
        else:
            os.replace(trimmed, target)
    finally:
        if not keep_download:
            shutil.rmtree(room, ignore_errors=True)
    seconds = round(float(Fraction(kept) / info['fps']), 3)
    size = target.stat().st_size
    report = {'piece_id': piece_id, 'cut': cut, 'file': str(target.resolve()), 'name': target.name, 'sha256': sha, 'seconds': seconds,
              'bytes': size, 'how': how, 'slate': where, 'trimmed_frames': {'start': start, 'end': frames - end},
              'fps': f'{info["fps"].numerator}/{info["fps"].denominator}', 'path': f'recordings/{sha}.mp4', 'next': [], 'warnings': [],
              'krish_words': words, 'home': None}
    if keep_download:
        report['download'] = str(raw.resolve())
    if size > LANE_LIMIT:
        report['warnings'].append('it is over the 500 MiB the recordings lane takes, so it cannot go into the store: nothing is '
                                  'recorded for it. Ask Krish (a shorter take, or produce it on this machine and say so)')
        return report
    report['home'] = bool((home or runner_key_here)())
    if not report['home']:
        report['warnings'].append('this machine cannot put the take into the store (it is not a home computer with the runner key), so '
                                  'nothing is recorded from here: leave the handoff item, and a home computer fetches it again')
        report['next'] = [handoff_line(report, by)]
        return report
    report['next'] = next_lines(report, record, shown_project, by)
    return report


def send_line(report):
    return (f'powershell -NoProfile -ExecutionPolicy Bypass -File {UPLOAD} -File {_q(report["file"])} -Name {_q(report["name"])} '
            f'-Sha256 {report["sha256"]}')


def recorded_line(report, by):
    parts = [PY, MAKING, '--by', making.who(by), report['piece_id'], 'recorded', report['cut'], report['path'], '--seconds', f'{report["seconds"]:g}']
    if report.get('krish_words'):
        parts += ['--krish-words', report['krish_words']]
    return ' '.join(_q(x) for x in parts)


def handoff_line(report, by):
    return ' '.join(_q(x) for x in [PY, SELF, 'handoff', '--piece', report['piece_id'], '--cut', report['cut'], '--share-url',
                                     '<the share_url wait_for_job gave>', '--post', '--by', making.who(by)])


def known_line(piece_id, cut, record, project, by=None):
    """The making.py descript line that keeps the cut's entry as it is and
    adds every media name the project listed to its known_media."""
    entry = entry_of(record, cut)
    if not entry or not entry.get('project_id'):
        raise TakeError(f'the {cut_name(cut)} cut has no Descript project on the record')
    project = project_of(project)
    if project['id'].lower() != entry['project_id']:
        raise TakeError(f'the project file is project {project["id"]}, not the cut\'s ({entry["project_id"]})')
    names = list(dict.fromkeys([*(entry.get('known_media') or []), *project['media_files'].keys()]))
    if len(names) > making.MAX_MEDIA:
        raise TakeError(f'the project lists {len(names)} media names, and the record keeps at most {making.MAX_MEDIA}: ask before going on')
    drive = drive_checked(record, descript_send.load_config())
    parts = [PY, MAKING, '--by', making.who(by), piece_id, 'descript', cut, '--drive', drive, '--project', entry['project_id'],
             '--script-composition', entry.get('script_composition'), '--record-composition', entry.get('record_composition'),
             '--links', entry.get('script_link'), entry.get('record_link'), '--media', entry.get('media'),
             '--sha', entry.get('script_sha256'), '--sent-at', entry.get('sent_at')]
    if entry.get('error'):
        parts += ['--error', entry['error']]
    # A patch that would not pass is refused here, before anyone runs it.
    making.descript_patch(cut, drive, entry['project_id'], entry.get('script_composition'), entry.get('record_composition'),
                          (entry.get('script_link'), entry.get('record_link')), entry.get('media'), names, entry.get('script_sha256'),
                          entry.get('sent_at'), entry.get('error'), by=making.who(by))
    return ' '.join(_q(x) for x in parts + ['--known-media', *names])


def next_lines(report, record, project, by):
    lines = [send_line(report), recorded_line(report, by)]
    if record is not None and project is not None:
        lines.append(known_line(report['piece_id'], report['cut'], record, project, by))
    else:
        lines.append(f'{PY} {SELF} known --piece {report["piece_id"]} --cut {report["cut"]} --project FILE   '
                     '(prints the line that adds the take\'s media to known_media)')
    return lines


def show_fetch(r):
    cut_off = r['trimmed_frames']
    where = f'the slate at the {r["slate"]}' if r['slate'] else 'no slate'
    lines = [f'take: {r["file"]}', f'sha256: {r["sha256"]}', f'seconds: {r["seconds"]:g}',
             f'({r["bytes"]} bytes at {r["fps"]} frames a second; {cut_off["start"]} frames trimmed from the start and {cut_off["end"]} '
             f'from the end, {where}; the video {r["how"]})']
    lines += [f'warning: {w}.' for w in r['warnings']]
    if r['next'] and r.get('home'):
        lines.append('next, on this home computer, in order (the record line only once the send says the take is in the store):')
        lines += [f'  {line}' for line in r['next']]
    elif r['next']:
        lines.append('next, from here: the board item for a home computer')
        lines += [f'  {line}' for line in r['next']]
    return '\n'.join(lines)


# ---------------------------------------------------------------- 5. a cloud session hands on

def check_share_url(share_url):
    parts = urlsplit(str(share_url or ''))
    host = parts.hostname or ''
    if parts.scheme != 'https' or parts.username or parts.password or not (host == 'descript.com' or host.endswith('.descript.com')):
        raise TakeError('--share-url is the https share_url wait_for_job gave for the private copy, on descript.com')
    return share_url


def handoff_item(piece_id, cut, share_url, record, score=None):
    """The board item a cloud session leaves for a home computer: it made
    the private copy and cannot put the take in the store."""
    piece_id, cut = _piece(piece_id), _cut(cut)
    check_share_url(share_url)
    piece = piece_of(record, piece_id)
    label = recording_match.label(piece)
    matched = f' Its opening matches the script ({score:.2f}).' if isinstance(score, (int, float)) else ''
    detail = (f'Krish recorded the {cut_name(cut)} cut of {label} in Descript.{matched} A cloud session made a private copy, never '
              'public, and cannot put the take in the engine\'s store, so nothing is recorded yet. On a home computer, the video '
              'skill\'s steps for takes recorded in Descript bring it in: publish it privately again for a fresh download link '
              '(Descript keeps the same private link), then fetch, send and record it.')
    return {'id': f'descript-take-{piece_id[:8]}-{cut}', 'lane': 'in_progress', 'rank': 4, 'area': 'Recordings',
            'title': f'A home computer brings in the {cut_name(cut)} take of {label} from Descript'[:200], 'detail': detail[:2000],
            'link': share_url, 'link_label': 'The private copy in Descript', 'idea_id': piece_id, 'closes_on': 'record'}


# ---------------------------------------------------------------- self-test

def self_test():
    fails, count = [], 0

    def ok(label, got, want):
        nonlocal count
        count += 1
        if got != want:
            fails.append(f'{label}: got {got!r}, want {want!r}')

    def refused(label, fn, words):
        nonlocal count
        count += 1
        try:
            fn()
            fails.append(f'{label}: not refused')
        except making.MakingError as error:
            if words not in str(error):
                fails.append(f'{label}: refused with "{error}", which does not say "{words}"')

    cfg = descript_send.load_config()
    drive = cfg['drive_id']
    piece = 'f328382d-71b3-41a7-a221-d8615826f12e'
    # The real WORKBENCH.md keeps 12 October's hand-made sends for this piece; the test reads its own.
    real_bench = descript_send.WORKBENCH
    bench_dir = tempfile.mkdtemp()
    descript_send.WORKBENCH = Path(bench_dir) / 'WORKBENCH.md'
    descript_send.WORKBENCH.write_text('# Workbench\n', encoding='utf-8')
    try:
        return _self_test(ok, refused, fails, lambda: count, cfg, drive, piece)
    finally:
        descript_send.WORKBENCH = real_bench
        shutil.rmtree(bench_dir, ignore_errors=True)


def _self_test(ok, refused, fails, counted, cfg, drive, piece):
    project_id, script_c, record_c = '16aa1f87-c054-4115-a11c-4342def815e5', '46c2a75a-615d-4ab5-bdc4-c84b57a88454', 'f6eb149a-82e8-4604-836e-b78ea7c73797'
    long_words = recording_match._prose(1, 300)
    short_words = recording_match._prose(1, 18) + recording_match._prose(7, 120)  # the same opening, a different body
    long_text, short_text = ' '.join(long_words) + '.\n', ' '.join(short_words) + '.\n'
    hashes = {'long': making.script_hash(long_text), 'short': making.script_hash(short_text)}
    entry = {'project_id': project_id, 'script_composition': script_c, 'record_composition': record_c,
             'script_link': f'https://web.descript.com/{project_id}/46c2a', 'record_link': f'https://web.descript.com/{project_id}/f6eb1',
             'script_sha256': hashes['long'], 'media': 'Script 2026-10-12 3e329b9.mp4',
             'known_media': ['Script 2026-10-12 3e329b9.mp4', 'Record here 3-minute slate.mp4'], 'sent_at': '2026-10-12T10:31:16Z', 'by': 'Claude Code'}

    def record_with(**changes):
        rec = {'pack': {'folder': '2026-10-12 Mon follow.the.money - Who gets paid for AI songs'},
               'script_check': {'passed': True, 'hashes': dict(hashes), 'checked_at': '2026-10-12T09:00:00Z'},
               'descript': {'drive_id': drive, 'cuts': {'long': dict(entry)}}, 'recordings': []}
        for key, value in changes.items():
            rec[key] = value
        return rec

    def project_with(duration, media=None, publishes=None, name='Monday'):
        files = {'Script 2026-10-12 3e329b9.mp4': {'type': 'video', 'duration': 187}, 'Record here 3-minute slate.mp4': {'type': 'video', 'duration': 1}}
        files.update(media or {})
        return {'id': project_id, 'drive_id': drive, 'media_files': files, 'publishes': publishes or [],
                'compositions': [{'id': script_c, 'name': 'Script, sent Mon 12 Oct', 'duration': 187},
                                 {'id': record_c, 'name': name, 'duration': duration}]}

    # His words, and the walls, from the config.
    ok('config: his yes to a private copy of each take, verbatim', cfg['said']['takes']['words'], '1. yes')
    ok('the copy is private, video, 1080p; never public', PUBLISH, {'media_type': 'Video', 'resolution': '1080p', 'access_level': 'private'})
    refused('no yes to the takes in the config: nothing is copied', lambda: takes_allowed({'said': {}}), 'no yes from Krish')
    ok('the bar is the matcher\'s own', (SURE, MARGIN), (0.72, 0.15))

    # The name the take goes into the lane under says its cut, on every day of a year.
    names_ok = all(recording_match.story_check.cut_of(take_name(c, date(2026, 1, 1) + timedelta(days=d))) == c
                   for c in CUTS for d in range(366))
    ok('take names say their cut to the matcher, every day of the year', names_ok, True)

    # look: what the timeline holds.
    r = look(record_with(), piece, 'long', project_with(1), cfg)
    ok('look: a timeline still a second long holds nothing yet', (r['state'], 'nothing is recorded yet' in r['reason']), ('nothing', True))
    ok('look: a renamed Record here is found by its id', any('called "Monday"' in n for n in r['notes']), True)
    take = {'Krish Raja camera.mp4': {'type': 'video', 'duration': 185.4}}
    r = look(record_with(), piece, 'long', project_with(186.4, take), cfg)
    ok('look: one new recording is a take', (r['state'], r['take_seconds'], len(r['recordings'])), ('take', 185.4, 1))
    ok('look: the calls name the Record here timeline, privately', (r['calls']['publish_project']['composition_id'],
       r['calls']['publish_project']['access_level'], r['calls']['export_transcript']['format']), (record_c, 'private', 'txt'))
    pair = {'Krish Raja camera.mp4': {'type': 'video', 'duration': 185.4}, 'Krish Raja microphone.wav': {'type': 'audio', 'duration': 185.2}}
    ok('look: a camera and a microphone of one take are one recording', len(look(record_with(), piece, 'long', project_with(186.4, pair), cfg)['recordings']), 1)
    two = {'Take one.mp4': {'type': 'video', 'duration': 40.0}, 'Take two.mp4': {'type': 'video', 'duration': 185.0}}
    r = look(record_with(), piece, 'long', project_with(226.0, two), cfg)
    ok('look: two recordings in the timeline: the words decide', (r['state'], len(r['recordings']), 'the words decide' in r['reason']), ('take', 2, True))
    r = look(record_with(), piece, 'long', project_with(186.0, two), cfg)
    ok('look: two recordings, one taken out of the timeline: the timeline is the take as edited', r['state'], 'take')
    r = look(record_with(), piece, 'long', project_with(300.0, take), cfg)
    ok('look: a timeline longer than the slate and the new recording is asked about', (r['state'], 'longer than the slate' in r['reason']), ('ask', True))
    r = look(record_with(), piece, 'long', project_with(186.0), cfg)
    ok('look: only known media in a long timeline: a take of older words, asked about', (r['state'], 'already knows' in r['reason']), ('ask', True))
    held = record_with(recordings=[{'cut': 'long', 'path': 'recordings/' + 'a' * 64 + '.mp4', 'script_sha256': hashes['long'], 'at': '2026-10-12T12:00:00Z'}])
    ok('look: known media only and the cut already recorded: nothing to bring in', look(held, piece, 'long', project_with(186.0), cfg)['state'], 'nothing')
    ok('look: a new take of a cut already recorded is asked about', look(held, piece, 'long', project_with(186.4, take), cfg)['state'], 'ask')
    older = record_with(descript={'drive_id': drive, 'cuts': {'long': {**entry, 'script_sha256': 'c' * 64}}})
    r = look(older, piece, 'long', project_with(186.4, take), cfg)
    ok('look: Descript holds older words: the take may be of them, asked about', (r['state'], 'older words' in r['reason']), ('ask', True))
    failed = record_with(descript={'drive_id': drive, 'cuts': {'long': {**entry, 'error': 'HTTP 503'}}})
    ok('look: the last send failed: asked about', look(failed, piece, 'long', project_with(186.4, take), cfg)['state'], 'ask')
    r = look(record_with(), piece, 'long', project_with(186.4, take, [{'share_url': 'https://share.descript.com/view/x', 'access_level': 'public'}]), cfg)
    ok('look: a public copy already there is never replaced without asking', (r['state'], 'published at public' in r['reason']), ('ask', True))
    gone = project_with(186.4, take)
    gone['compositions'] = gone['compositions'][:1]
    ok('look: the Record here timeline gone from the project is asked about', look(record_with(), piece, 'long', gone, cfg)['state'], 'ask')
    ok('look: new media with the timeline still a second long: which timeline, asked', look(record_with(), piece, 'long', project_with(1, take), cfg)['state'], 'ask')
    ok('look: a cut with no Descript project comes through the Inbox', look(record_with(), piece, 'short', project_with(1), cfg)['state'], 'nothing')

    # His words settle the questions that are his to answer; the others stay questions.
    words = 'Krish, 2026-10-12: use it'
    r = look(record_with(), piece, 'long', project_with(186.0), cfg, words)
    ok('look: his words settle a take of known media (older_take): bring it in', (r['state'], r['settled'], r['take_seconds']), ('take', ['older_take'], 185.0))
    r = look(older, piece, 'long', project_with(186.4, take), cfg, words)
    ok('look: his words settle Descript holding older words', (r['state'], r['settled']), ('take', ['older_words']))
    r = look(held, piece, 'long', project_with(186.4, take), cfg, words)
    ok('look: his words settle a new take of a cut already recorded (a re-take)', (r['state'], r['settled']), ('take', ['recorded']))
    r = look(record_with(), piece, 'long', project_with(186.4, take, [{'share_url': 'https://share.descript.com/view/x', 'access_level': 'public'}]), cfg, words)
    ok('look: his words settle a copy already published at another level', (r['state'], r['settled']), ('take', ['published']))
    ok('look: his words never settle a timeline longer than the take (only --use-last does)',
       look(record_with(), piece, 'long', project_with(300.0, take), cfg, words)['code'], 'longer')
    ok('look: his words never settle a timeline that is gone', look(record_with(), piece, 'long', gone, cfg, words)['code'], 'gone')
    refused('look: --krish-words that are not his words are refused', lambda: look(older, piece, 'long', project_with(186.4, take), cfg, 'use it'),
            '--krish-words is Krish')
    ok('look: a question his words settle says how to give them', '--krish-words' in show_look(look(held, piece, 'long', project_with(186.4, take), cfg)), True)

    # He recorded in another timeline of the project: it is named, so he can move the clip or record again.
    spare = project_with(1, take)
    spare['compositions'].append({'id': '76a6bceb-0000-4000-8000-000000000001', 'name': 'Record here', 'duration': 191.4})
    spare['compositions'].append({'id': '0af6fce6-0000-4000-8000-000000000002', 'name': 'Script, sent Mon 12 Oct', 'duration': 187})
    r = look(record_with(), piece, 'long', spare, cfg)
    ok('look: a take in another timeline is named by it, never copied',
       (r['code'], '"Record here" (76a6b, 3:11)' in r['reason'], 'drag the clip into "Monday"' in r['reason'], [w['id'][:8] for w in r['elsewhere']]),
       ('elsewhere', True, True, ['76a6bceb']))
    ok('look: no other timeline long enough: which one, asked', 'no other timeline runs long enough' in look(record_with(), piece, 'long', project_with(1, take), cfg)['reason'], True)

    # A send that failed after import_media made its project has no Record here yet.
    bare = record_with(descript={'drive_id': drive, 'cuts': {'long': {'project_id': project_id, 'error': 'HTTP 500 on the upload', 'sent_at': 'x'}}})
    r = look(bare, piece, 'long', project_with(1), cfg)
    ok('look: a project whose send did not finish has nothing to bring in yet', (r['state'], 'did not finish' in r['reason']), ('nothing', True))

    # A send made by hand that the record does not hold yet: its line, never the Inbox.
    hand = (f"python3 scripts/post-pack/making.py --by 'Claude Code' {piece} descript short --drive {drive} --project "
            "6e1c3178-ba5c-4603-a5e2-ec23f3612071 --script-composition f27bfc76-e71b-498d-a942-767063070c48")
    descript_send.WORKBENCH.write_text(f'# Workbench\n\n     {hand}\n', encoding='utf-8')
    refused('look: a cut sent by hand is recorded first, never the Inbox', lambda: look(record_with(), piece, 'short', project_with(1), cfg),
            'sent to Descript by hand')
    wrong = project_with(186.4, take)
    wrong['id'] = '00000000-0000-4000-8000-000000000000'
    refused('look: another project is refused', lambda: look(record_with(), piece, 'long', wrong, cfg), 'run get_project for the right one')
    other_drive = record_with(descript={'drive_id': '00000000-0000-4000-8000-000000000000', 'cuts': {'long': dict(entry)}})
    refused('look: a record on another drive is refused', lambda: look(other_drive, piece, 'long', project_with(186.4, take), cfg), 'is not Krish\'s')
    refused('look: a file that is not get_project\'s answer is refused', lambda: project_of({'id': project_id}), 'save the whole answer')

    # check: go or ask, from the words.
    scripts = {'long': {'text': long_text, 'from': 'long.md'}, 'short': {'text': short_text, 'from': 'short.md'}}

    def said(word_list, slips=0, first=0.0, per=0.4, chunk=12):
        lines = []
        for k in range(0, len(word_list), chunk):
            part = [w if not slips or (k + j + 1) % slips else 'mishear' for j, w in enumerate(word_list[k:k + chunk])]
            lines.append((first + k * per, ' '.join(part) + '.'))
        return lines

    def as_txt(lines):
        return '\n'.join(text for _, text in lines) + '\n'

    def as_srt(lines):
        def stamp(s):
            ms = int(round(s * 1000))
            return f'{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}'
        return '\n'.join(f'{n + 1}\n{stamp(s)} --> {stamp(s + 3)}\n{text}\n' for n, (s, text) in enumerate(lines))

    good = as_txt(said(long_words, slips=9, first=1.0))
    r = check(record_with(), piece, 'long', good, cfg=cfg, scripts=scripts)
    ok('check: a reading of the long script, a word misheard now and then: go', (r['decision'], r['score'] >= SURE, len(r['readings'])), ('go', True, 1))
    r = check(record_with(), piece, 'long', good, project=project_with(186.4, take), cfg=cfg, scripts=scripts)
    ok('check: with the project, the same take: go', r['decision'], 'go')
    labelled = ''.join(f'Krish Raja: {line}\n' for line in good.splitlines())
    r = check(record_with(), piece, 'long', labelled, cfg=cfg, scripts=scripts)
    ok('check: speaker labels on every line are taken off', (r['decision'], r['words']), ('go', len(long_words)))
    stamped = ''.join(f'[00:{n // 60:02d}:{n % 60:02d}] {line}\n' for n, line in enumerate(good.splitlines()))
    ok('check: time codes at the start of a line are read as times', check(record_with(), piece, 'long', stamped, cfg=cfg, scripts=scripts)['readings'][0]['start_seconds'], 0)
    r = check(record_with(), piece, 'long', as_txt(said(recording_match._prose(5, 300))), cfg=cfg, scripts=scripts)
    ok('check: another script altogether: ask', (r['decision'], 'needed' in ' '.join(r['reasons'])), ('ask', True))
    r = check(record_with(), piece, 'long', 'Is this on?\n', cfg=cfg, scripts=scripts)
    ok('check: too little speech: ask', (r['decision'], 'too little speech' in r['reasons'][0]), ('ask', True))
    twice = said(long_words, first=1.0) + said(long_words, first=150.0)
    r = check(record_with(), piece, 'long', as_txt(twice), cfg=cfg, scripts=scripts)
    ok('check: read twice in the timeline: ask which', (r['decision'], len([x for x in r['readings'] if x['full']]), '2 times' in r['reasons'][0]),
       ('ask', 2, True))
    r = check(record_with(), piece, 'long', as_txt(twice), cfg=cfg, scripts=scripts, use_last='Krish, 2026-10-12: use the last one')
    ok('check: read twice, his words say the last, but no times: ask for srt', (r['decision'], 'srt' in ' '.join(r['reasons'])), ('ask', True))
    r = check(record_with(), piece, 'long', as_srt(twice), cfg=cfg, scripts=scripts, use_last='Krish, 2026-10-12: use the last one')
    ok('check: read twice, his words say the last, srt: go from where it starts', (r['decision'], r['from_seconds']), ('go', 149.75))
    refused('check: --use-last that are not his words are refused',
            lambda: check(record_with(), piece, 'long', as_srt(twice), cfg=cfg, scripts=scripts, use_last='use the last'), 'starting "Krish"')
    restart = said(long_words[:20], first=1.0) + said(long_words, first=10.0)
    ok('check: a false start, then one reading through: go', check(record_with(), piece, 'long', as_txt(restart), cfg=cfg, scripts=scripts)['decision'], 'go')
    r = check(record_with(), piece, 'short', as_txt(said(short_words, first=1.0)), cfg=cfg, scripts=scripts)
    ok('check: the short script in the short timeline: go', r['decision'], 'go')
    long_in_short = check(record_with(), piece, 'short', as_txt(said(long_words, first=1.0)), cfg=cfg, scripts=scripts)
    ok('check: the long script read into the short timeline: ask', long_in_short['decision'], 'ask')
    short_take = {'Krish Raja camera.mp4': {'type': 'video', 'duration': 88.0}}
    r = check(record_with(), piece, 'long', good, project=project_with(89.0, short_take), cfg=cfg, scripts=scripts)
    ok('check: a 1:28 take in the 3-minute timeline: ask', (r['decision'], 'which is a 90-second take' in ' '.join(r['reasons'])), ('ask', True))
    half = ' '.join(long_words[:150]) + ' ' + ' '.join(recording_match._prose(9, 150))
    r = check(record_with(), piece, 'long', half + '\n', cfg=cfg, scripts=scripts)
    ok('check: the opening read, the rest other words: ask', (r['decision'], 'as a whole' in ' '.join(r['reasons'])), ('ask', True))
    r = check(older, piece, 'long', good, project=project_with(186.4, take), cfg=cfg, scripts=scripts)
    ok('check: the look\'s question comes through: ask', (r['decision'], any('older words' in x for x in r['reasons'])), ('ask', True))
    r = check(older, piece, 'long', 'Is this on?\n', project=project_with(186.4, take), cfg=cfg, scripts=scripts)
    ok('check: the look\'s question comes through an early answer too', r['reasons'][0].startswith('Descript holds older words'), True)
    r = check(older, piece, 'long', good, project=project_with(186.4, take), cfg=cfg, scripts=scripts, words='Krish, 2026-10-12: use it')
    ok('check: his words settle the look\'s question: go, his words carried', (r['decision'], r['settled'], r['krish_words']),
       ('go', ['older_words'], 'Krish, 2026-10-12: use it'))
    ok('check: the next line carries his words to fetch', "--krish-words 'Krish, 2026-10-12: use it'" in show_check(r), True)
    r = check(older, piece, 'long', half + '\n', project=project_with(186.4, take), cfg=cfg, scripts=scripts, words='Krish, 2026-10-12: use it')
    ok('check: a take of older words he said to use reads only partly as the script now: go, said', (r['decision'], any('older words' in n for n in r['notes'])),
       ('go', True))
    r = check(record_with(), piece, 'long', half + '\n', project=project_with(186.4, take), cfg=cfg, scripts=scripts, words='Krish, 2026-10-12: use it')
    ok('check: his words never pass other words as the current script when no question of older words was asked', r['decision'], 'ask')
    # After the script was sent again, an old take known to the record sits before the new one in the timeline.
    stacked = project_with(1 + 149.0 + 185.4, {**take, 'Old take.mp4': {'type': 'video', 'duration': 149.0}})
    known_old = record_with(descript={'drive_id': drive, 'cuts': {'long': {**entry, 'known_media': entry['known_media'] + ['Old take.mp4']}}})
    ok('look: an older take before the new one makes the timeline longer: asked', look(known_old, piece, 'long', stacked, cfg)['code'], 'longer')
    r = check(known_old, piece, 'long', as_srt(twice), project=stacked, cfg=cfg, scripts=scripts)
    ok('check: an older take and a new one, no words from him: ask', (r['decision'], 'longer than the slate' in r['reasons'][0]), ('ask', True))
    r = check(known_old, piece, 'long', as_srt(twice), project=stacked, cfg=cfg, scripts=scripts, use_last='Krish, 2026-10-12: use the last one')
    ok('check: an older take and a new one, his words say the last: go from the new one', (r['decision'], r['from_seconds'], r['take_seconds']),
       ('go', 149.75, 185.65))
    with tempfile.TemporaryDirectory() as tmp:
        plain = Path(tmp) / 'words.json'
        plain.write_text(json.dumps({'content': good}), encoding='utf-8')
        ok('check: an answer saved as JSON is read for its text', transcript_text(plain), good)
        refused('the script on this machine must be the words the check passed',
                lambda: scripts_here(record_with(), piece, 'long', script_path=str(Path(tmp) / 'nope.md')), 'could not be read')
        changed = Path(tmp) / 'long.md'
        changed.write_text(long_text + 'one more line\n', encoding='utf-8')
        refused('a script whose words are not the checked ones is refused',
                lambda: scripts_here(record_with(), piece, 'long', script_path=str(changed)), 'not the words the scripts\' check passed')

    # fetch: a synthetic copy (slate, then the take), trimmed exactly.
    tools = shutil.which('ffmpeg') and shutil.which('ffprobe')
    ok('ffmpeg and ffprobe are here for the trim checks', bool(tools), True)
    if tools:
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)

            def synth(path, keyframe_after_slate, slate_first=True, slate_seconds=1, body_seconds=3):
                slate_v = (f'color=c=0x{INK[0]:02x}{INK[1]:02x}{INK[2]:02x}:s=640x360:r=30:d={slate_seconds},'
                           f'drawbox=x=40:y=110:w=380:h=40:color=0x{MINT[0]:02x}{MINT[1]:02x}{MINT[2]:02x}:t=fill')
                order = '[0:v][sa][2:v][ba]' if slate_first else '[2:v][ba][0:v][sa]'
                keys = (['-force_key_frames', f'0,{slate_seconds if slate_first else body_seconds}'] if keyframe_after_slate
                        else ['-g', '600', '-keyint_min', '600', '-sc_threshold', '0'])
                _run([_tool('ffmpeg'), '-v', 'error', '-y', '-f', 'lavfi', '-i', slate_v, '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
                      '-f', 'lavfi', '-i', f'testsrc2=s=640x360:r=30:d={body_seconds}', '-f', 'lavfi', '-i', f'sine=f=440:r=48000:d={body_seconds}',
                      '-filter_complex', f'[1:a]atrim=duration={slate_seconds}[sa];[3:a]aformat=channel_layouts=stereo[ba];'
                      f'{order}concat=n=2:v=1:a=1[v][a]', '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'veryfast',
                      '-pix_fmt', 'yuv420p', *keys, '-c:a', 'aac', '-b:a', '128k', str(path)], 'make the stand-in copy')

            def served(path, said_bytes=None, status=None):
                def fetcher(url, handle):
                    if status:
                        raise DownloadRefused(status)
                    data = Path(path).read_bytes()
                    handle.write(data)
                    return said_bytes if said_bytes is not None else len(data)
                return fetcher

            url = 'https://descript-published.example/take.mp4?Expires=1'
            kf, nokf, tail = tmp / 'kf.mp4', tmp / 'nokf.mp4', tmp / 'tail.mp4'
            synth(kf, True)
            synth(nokf, False)
            synth(tail, True, slate_first=False)
            info = probe(kf)
            ok('the stand-in slate looks like the slate, its take does not',
               (slate_like(frame_rgb(kf, frame_at(info, 0))), slate_like(frame_rgb(kf, frame_at(info, 30)))), (True, False))
            day = date(2026, 10, 12)
            rec = record_with()
            home = lambda: True
            r = fetch(url, piece, 'long', tmp / 'out', 1, project_with(4.0, take), rec, cfg, fetcher=served(kf), today=day, by='Codex', home=home)
            ok('fetch: a keyframe where the take starts: the video is copied, exactly 90 frames, 3 seconds', (r['how'], r['seconds'], r['trimmed_frames']),
               ('copied', 3.0, {'start': 30, 'end': 0}))
            ok('fetch: the sha256 printed is the file\'s', r['sha256'], sha256_of(r['file']))
            ok('fetch: the take is named for the lane, and its path is the store\'s', (r['name'], r['path']),
               ('Descript long take 2026-10-12.mp4', f'recordings/{r["sha256"]}.mp4'))
            first = subprocess.run([_tool('ffmpeg'), '-v', 'error', '-i', r['file'], '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                                   capture_output=True).stdout
            source = subprocess.run([_tool('ffmpeg'), '-v', 'error', '-i', str(kf), '-vf', 'select=eq(n\\,30)', '-vsync', '0', '-frames:v', '1',
                                     '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
            ok('fetch: the first frame kept is the take\'s first frame, bit for bit', hashlib.sha256(first).hexdigest(), hashlib.sha256(source).hexdigest())
            ok('fetch: the next lines send, then record, then add the media', [line.split()[0 if n == 0 else 1] for n, line in enumerate(r['next'])],
               ['powershell', MAKING, MAKING])
            ok('fetch: the send names the file, its name and its sha256', ('-File' in r['next'][0], f'-Sha256 {r["sha256"]}' in r['next'][0]), (True, True))
            ok('fetch: the record line stamps the store\'s path and the seconds', (f'recorded long {r["path"]} --seconds 3' in r['next'][1],
               '--by Codex' in r['next'][1]), (True, True))
            ok('fetch: the known line keeps every name and adds the take\'s', ('Krish Raja camera.mp4' in r['next'][2],
               'Record here 3-minute slate.mp4' in r['next'][2], '--sent-at 2026-10-12T10:31:16Z' in r['next'][2]), (True, True, True))
            again = fetch(url, piece, 'long', tmp / 'out', 1, None, None, cfg, fetcher=served(kf), today=day, home=home)
            ok('fetch: the same take again is the same file, never a second copy', (again['file'], len(list((tmp / 'out').glob('*.mp4')))), (r['file'], 1))
            away = fetch(url, piece, 'long', tmp / 'away', 1, project_with(4.0, take), rec, cfg, fetcher=served(kf), today=day, by='Claude Code',
                         home=lambda: False)
            ok('fetch: away from a home computer with the runner key, no send and no record line: the handoff line',
               (len(away['next']), ' handoff ' in away['next'][0], '--post' in away['next'][0], any('recorded' in x for x in away['next']),
                away['home'], any('cannot put the take into the store' in w for w in away['warnings'])), (1, True, True, False, False, True))
            ok('fetch: this container is not a home computer', runner_key_here(), False)
            his = fetch(url, piece, 'long', tmp / 'his', 1, None, None, cfg, fetcher=served(kf), today=day, by='Codex', home=home,
                        words='Krish, 2026-10-12: use the new one')
            ok('fetch: his words go onto the take\'s record line', "--krish-words 'Krish, 2026-10-12: use the new one'" in his['next'][1], True)
            refused('fetch: --krish-words that are not his words are refused',
                    lambda: fetch(url, piece, 'long', tmp / 'x', 1, None, None, cfg, fetcher=served(kf), words='use it'), '--krish-words is Krish')
            ok('fetch: the download is not kept', list((tmp / 'out').glob('.descript-download-*')), [])
            r = fetch(url, piece, 'long', tmp / 'out2', 1, None, None, cfg, fetcher=served(nokf), today=day, home=home)
            ok('fetch: no keyframe where the take starts: re-encoded once, still exactly 90 frames', (r['how'], frame_count(r['file']), r['seconds']),
               ('re-encoded', 90, 3.0))
            r = fetch(url, piece, 'long', tmp / 'out3', 1, None, None, cfg, fetcher=served(tail), today=day, home=home)
            ok('fetch: recorded before the slate: the slate is trimmed from the end', (r['slate'], r['trimmed_frames'], r['seconds']),
               ('end', {'start': 0, 'end': 30}, 3.0))
            r = fetch(url, piece, 'long', tmp / 'out4', 1, None, None, cfg, fetcher=served(kf), today=day, from_seconds=2.0,
                      use_last='Krish, 2026-10-12: use the last one')
            ok('fetch: from where the last reading starts, on his words', (r['trimmed_frames']['start'], r['seconds']), (60, 2.0))
            refused('fetch: cutting more than the slate needs his words',
                    lambda: fetch(url, piece, 'long', tmp / 'x', 1, None, None, cfg, fetcher=served(kf), from_seconds=2.0), 'Krish\'s choice')
            refused('fetch: a slate longer than said is refused, nothing trimmed',
                    lambda: fetch(url, piece, 'long', tmp / 'x', 0.5, None, None, cfg, fetcher=served(kf)), 'runs longer than 15 frames')
            plainv = tmp / 'plain.mp4'
            _run([_tool('ffmpeg'), '-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=640x360:r=30:d=3', '-f', 'lavfi', '-i', 'sine=r=48000:d=3',
                  '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', str(plainv)], 'make a copy with no slate')
            refused('fetch: no slate at either end is refused, nothing trimmed',
                    lambda: fetch(url, piece, 'long', tmp / 'x', 1, None, None, cfg, fetcher=served(plainv)), '--slate-seconds 0')
            r = fetch(url, piece, 'long', tmp / 'out5', 0, None, None, cfg, fetcher=served(plainv), today=day, home=home)
            ok('fetch: --slate-seconds 0 keeps the whole copy', (r['seconds'], r['slate']), (3.0, None))
            refused('fetch: a download cut short is refused',
                    lambda: fetch(url, piece, 'long', tmp / 'x', 1, None, None, cfg, fetcher=served(kf, said_bytes=10 ** 9)), 'the download stopped')
            refused('fetch: an expired link says to publish again',
                    lambda: fetch(url, piece, 'long', tmp / 'x', 1, None, None, cfg, fetcher=served(kf, status=403)), 'Publish again with the same call')
            refused('fetch: a link past its expiry is not tried',
                    lambda: fetch(url, piece, 'long', tmp / 'x', 1, None, None, cfg, fetcher=served(kf), expires_at='2026-10-12T10:00:00Z',
                                  now=datetime(2026, 10, 12, 11, tzinfo=timezone.utc)), 'expired at')
            refused('fetch: a copy that is not the timeline as it was looked at is refused',
                    lambda: fetch(url, piece, 'long', tmp / 'x', 1, project_with(186.4, take), rec, cfg, fetcher=served(kf)), 'not that timeline')
            refused('fetch: only an https link', lambda: fetch('http://x.example/a.mp4', piece, 'long', tmp / 'x', fetcher=served(kf)), 'https download_url')
            junk = tmp / 'junk.mp4'
            junk.write_bytes(b'\0' * (MIN_BYTES + 10))
            refused('fetch: bytes that are no video are refused', lambda: fetch(url, piece, 'long', tmp / 'x', 1, None, None, cfg, fetcher=served(junk)),
                    'not a whole video file')

    # known: the line passes the record's own rules, and the engine's (parsed by making.descript_patch).
    line = known_line(piece, 'long', record_with(), project_with(186.4, take), by='Codex')
    ok('known: the line keeps the links and adds the new media last', (line.count('--known-media'), line.endswith(_q('Krish Raja camera.mp4'))), (1, True))
    refused('known: another project is refused', lambda: known_line(piece, 'long', record_with(), wrong), 'not the cut\'s')

    # handoff: a cloud session's board item for a home computer.
    item = handoff_item(piece, 'long', 'https://share.descript.com/view/AbCdEf', record_with(), 0.93)
    ok('handoff: one item a piece and cut, tied to the piece, closing on Record', (item['id'], item['idea_id'], item['closes_on'], item['lane']),
       ('descript-take-f328382d-long', piece, 'record', 'in_progress'))
    ok('handoff: the id is a board id', bool(re.fullmatch(r'[a-z0-9][a-z0-9-]{1,79}', item['id'])), True)
    ok('handoff: plain words, no long dashes, inside the board\'s limits',
       (any(ch in item['title'] + item['detail'] for ch in '\u2013\u2014'), len(item['title']) <= 200, len(item['detail']) <= 2000,
        len(item['link_label']) <= 60), (False, True, True, True))
    refused('handoff: only a descript.com https share link', lambda: handoff_item(piece, 'long', 'https://example.com/x', record_with()), 'on descript.com')

    # The command line, against a stand-in engine: the matcher's waiting list, the exit codes, the board.
    posted = []

    def stand_in(method, path, body):
        if path.startswith('/api/week/options'):
            listed = [{'id': piece, 'idea': 'Who gets paid for AI songs', 'scheduled_for': '2026-10-12'}] if 'week_start=2026-10-12' in path else []
            return 200, json.dumps({'series': [{'slug': 'follow_the_money', 'label': 'follow.the.money', 'in_flight': listed}]})
        if method == 'GET' and path == f'/api/content-ideas/{piece}/making':
            return 200, json.dumps({'making': record_with(), 'steps': [{'key': 'scripts', 'state': 'done'}, {'key': 'record', 'state': 'now'}]})
        if method == 'GET' and path == '/api/workbench':
            return 200, json.dumps({'items': []})
        if method == 'POST' and path == '/api/workbench':
            posted.append(body)
            return 200, '{}'
        raise AssertionError(f'{method} {path}')

    w = waiting(stand_in, date(2026, 10, 12))
    ok('waiting: each cut still to record, with its Descript project, or none (the Inbox)',
       [(c['cut'], c['project_id'], c['descript']) for c in w['cuts']], [('long', project_id, 'in'), ('short', None, 'missing')])
    ok('waiting: the get_project call to make', w['cuts'][0]['get_project'], {'project_id': project_id})
    ok('waiting: a cut sent by hand gets its WORKBENCH line, never the Inbox',
       (w['cuts'][1]['hand_made'] == hand, 'Never through the Inbox' in show_waiting(w), 'comes through the Inbox' in show_waiting(w)), (True, True, False))
    with tempfile.TemporaryDirectory() as tmp:
        quiet = io.StringIO()
        files = {}
        for key, value in (('empty', project_with(1)), ('take', project_with(186.4, take)), ('older', project_with(186.0))):
            files[key] = Path(tmp) / f'{key}.json'
            files[key].write_text(json.dumps(value), encoding='utf-8')
        words = Path(tmp) / 'words.txt'
        words.write_text(good, encoding='utf-8')
        script = Path(tmp) / 'long.md'
        script.write_text(long_text, encoding='utf-8')
        with contextlib.redirect_stdout(quiet), contextlib.redirect_stderr(quiet):
            codes = [main(['look', '--piece', piece, '--cut', 'long', '--project', str(files[k])], call=stand_in) for k in ('take', 'older', 'empty')]
            checked = main(['check', '--piece', piece, '--cut', 'long', '--words', str(words), '--script', str(script), '--project', str(files['take'])],
                           call=stand_in)
            handed = main(['handoff', '--piece', piece, '--cut', 'long', '--share-url', 'https://share.descript.com/view/AbCdEf', '--post',
                           '--by', 'Claude Code'], call=stand_in)
            bad = main(['check', '--piece', 'monday', '--cut', 'long', '--words', str(words)], call=stand_in)
        ok('look exits 0 for a take, 2 for a question, 3 for nothing', codes, [0, 2, 3])
        ok('check exits 0 to go, and prints the private copy of the Record here timeline',
           (checked, f'"composition_id": "{record_c}", "media_type": "Video", "resolution": "1080p", "access_level": "private"' in quiet.getvalue()),
           (0, True))
        ok('handoff --post: one item on the board, as Claude Code', (handed, [i['id'] for b in posted for i in b['items']], posted[0]['client']),
           (0, ['descript-take-f328382d-long'], 'claude_code'))
        ok('a piece id that is not a uuid is refused before any call', bad, 1)

    if fails:
        print('descript take self-test FAILED:')
        for line in fails:
            print('  ' + line)
        return 1
    print(f'descript take self-test passed: {counted()} checks')
    return 0


# ---------------------------------------------------------------- the command line

def _record(piece_id, call):
    return making.record_of(_piece(piece_id), call)


def main(argv=None, call=None):
    ap = argparse.ArgumentParser(description='Bring a take Krish recorded in a Descript "Record here" timeline back to its piece and cut.')
    ap.add_argument('what', nargs='?', choices=['waiting', 'look', 'check', 'fetch', 'known', 'handoff'])
    ap.add_argument('--piece', help='the piece id (content_ideas uuid)')
    ap.add_argument('--cut', choices=CUTS)
    ap.add_argument('--week', metavar='YYYY-MM-DD', help='with waiting: a day in the week to start from (default this week)')
    ap.add_argument('--project', metavar='FILE', help='get_project\'s answer, saved to a file')
    ap.add_argument('--words', metavar='FILE', help='with check: export_transcript\'s answer for the Record here timeline, saved to a file')
    ap.add_argument('--script', metavar='FILE', help='with check: the cut\'s script, when this machine cannot find it')
    ap.add_argument('--use-last', metavar='WORDS', help='Krish\'s words saying to use the last reading, starting "Krish" and the date')
    ap.add_argument('--krish-words', metavar='WORDS', help='with look, check and fetch: Krish\'s own words to use the take anyway, starting '
                    '"Krish" and the date; they settle a take of older words, a cut already recorded or a copy already published, and '
                    'go onto the take\'s record line')
    ap.add_argument('--url', help='with fetch: the download_url wait_for_job gave')
    ap.add_argument('--expires-at', metavar='TIME', help='with fetch: when that download_url expires, if wait_for_job said')
    ap.add_argument('--slate-seconds', type=float, default=None, help='with fetch: how long the slate runs (default the config\'s, 1)')
    ap.add_argument('--from-seconds', type=float, help='with fetch: where the take to keep starts, with --use-last (check prints it)')
    ap.add_argument('--out', metavar='DIR', help='with fetch: the work folder the take goes into')
    ap.add_argument('--keep-download', action='store_true', help='with fetch: keep the untrimmed copy too')
    ap.add_argument('--share-url', help='with handoff: the share_url of the private copy')
    ap.add_argument('--score', type=float, help='with handoff: the opening score check gave')
    ap.add_argument('--post', action='store_true', help='with handoff: put the item on the board (the one write this file makes)')
    ap.add_argument('--by', help=f'who is writing: Codex, Claude Code (default: {making.BY_ENV}, else Codex inside Codex, else Claude Code)')
    ap.add_argument('--json', action='store_true')
    ap.add_argument('--self-test', action='store_true')
    a = ap.parse_args(argv)
    if a.self_test:
        return self_test()
    if not a.what:
        ap.error('say what to do: waiting, look, check, fetch, known or handoff')
    try:
        if a.what == 'waiting':
            monday = recording_match.week_monday(a.week) if a.week else None
            report = waiting(call, monday)
            print(json.dumps(report, indent=2) if a.json else show_waiting(report))
            return 0
        if not a.piece or not a.cut:
            ap.error('give --piece and --cut')
        piece_id = _piece(a.piece)
        by = making.who(a.by)
        cfg = descript_send.load_config()
        if a.what == 'look':
            if not a.project:
                ap.error('give --project, get_project\'s answer saved to a file')
            project = read_json_file(a.project, 'the project file')
            report = look(_record(piece_id, call), piece_id, a.cut, project, cfg, a.krish_words)
            print(json.dumps(report, indent=2) if a.json else show_look(report))
            return {'take': 0, 'ask': 2, 'nothing': 3}[report['state']]
        if a.what == 'check':
            if not a.words:
                ap.error('give --words, export_transcript\'s answer saved to a file')
            project = read_json_file(a.project, 'the project file') if a.project else None
            try:
                text = transcript_text(a.words)
            except OSError as error:
                raise TakeError(f'--words {a.words} could not be read: {error}')
            record = _record(piece_id, call)
            report = check(record, piece_id, a.cut, text, project, cfg, a.use_last, scripts_here(record, piece_id, a.cut, a.script), a.krish_words)
            print(json.dumps(report, indent=2) if a.json else show_check(report))
            return 0 if report['decision'] == 'go' else 2
        if a.what == 'fetch':
            if not a.url or not a.out:
                ap.error('give --url and --out')
            takes_allowed(cfg)
            project = read_json_file(a.project, 'the project file') if a.project else None
            record = _record(piece_id, call) if project is not None else None
            slate = a.slate_seconds if a.slate_seconds is not None else float(cfg['record_here']['seconds'])
            report = fetch(a.url, piece_id, a.cut, a.out, slate, project, record, cfg, a.from_seconds, a.use_last, a.expires_at,
                           a.keep_download, by, words=a.krish_words)
            print(json.dumps(report, indent=2) if a.json else show_fetch(report))
            return 0
        if a.what == 'known':
            if not a.project:
                ap.error('give --project, the get_project answer the take was looked at with')
            project = read_json_file(a.project, 'the project file')
            print(known_line(piece_id, a.cut, _record(piece_id, call), project, by))
            return 0
        if a.what == 'handoff':
            if not a.share_url:
                ap.error('give --share-url')
            check_share_url(a.share_url)
            item = handoff_item(piece_id, a.cut, a.share_url, _record(piece_id, call), a.score)
            if not a.post:
                body = {'action': 'upsert_items', 'client': making.board_client(by), 'items': [item]}
                print(json.dumps(body, indent=2))
                print('Not posted: run again with --post to put it on the board.', file=sys.stderr)
                return 0
            written, left = making.board_upsert([item], call, by)
            print(f'on the board: {item["id"]}' if written else f'not changed: {item["id"]} is closed on the board')
            return 0
    except (making.MakingError, recording_match.MatchError) as error:
        print(f'descript_take: {error}', file=sys.stderr)
        return 1
    return 1


if __name__ == '__main__':
    sys.exit(main())
