#!/usr/bin/env python3
"""teleprompter_send: every checked script into Krish's teleprompter.com
account, and the record of where it went.

Krish, 2026-10-12: "Also note that Descript is permanently gone,
teleprompter.com is permanently in, connected via MCP here". Asked "May
every checked script go into your teleprompter.com account automatically,
starting with Monday's two now?", he picked "Yes, automatic, Monday now",
whose terms were: "One script per cut, in a folder per piece (e.g. "Mon 12
Oct follow.the.money"). When the words change, the same script is updated
in place. Nothing is ever deleted." His words, the tools allowed and the
names are in config/teleprompter.json; nothing is planned or recorded unless
its status is "confirmed".

One folder per piece, named "<Ddd D Mon> <series> - <subject>" ("Mon 12 Oct
follow.the.money - Who gets paid for AI songs"), holding one script per
cut, titled "<Ddd D Mon> - <cut> - <subject>" ("Mon 12 Oct - 3-minute - Who
gets paid for AI songs"). A script's text is the script file's spoken
words, any markdown stripped, its paragraphs separated by a blank line; its
duration is those words at 150 a minute, in whole seconds.

    python teleprompter_send.py plan PIECE long.md short.md [--post post.json] [--json]
    python teleprompter_send.py record PIECE CUT --folder ID --script ID --sha SHA256
                   [--title TITLE] [--folder-name NAME] [--sent-at TIME]
    python teleprompter_send.py record PIECE CUT [--folder ID] --error "what Teleprompter said"
    python teleprompter_send.py pending [--week YYYY-MM-DD] [--retry] [--json]
    python teleprompter_send.py --self-test

`plan` sends nothing. It reads the piece's making record from the engine,
refuses unless the scripts' check passed, each file holds the words it
passed (making.script_hash), and each cut it would send was read back by two
fresh readers with nothing lost (making.py read-back; house rule R7, Krish,
2026-10-12: "I can't even understand what I'm reading off the
teleprompter"), and prints the Teleprompter calls to make, in
order: create_folder only when the record holds no folder for the piece
(after list_folders shows none of that name), then for each cut either
create_script (after list_scripts_in_folder shows none of that title) or,
for a cut whose script is recorded, update_script with only its text and
duration, then the `record` line. A cut whose current words are already
there needs no call. Krish's font size, speed, alignment and timed speed are
never sent, on a create or an update: they are his to set. Nothing is ever
deleted, moved or renamed.

The calls are made by the Claude Code session that holds the Teleprompter
connector (make-piece, the Scripts step), never by this file: it holds no
Teleprompter key. `record` writes what was made onto the piece's making
record (making.teleprompter_patch; making.py teleprompter is the same),
with the ids checked as Teleprompter's uppercase UUIDs, and refuses a
folder other than the one the record holds for the piece. A send that fails
is recorded with what Teleprompter said and when (`record --error`, with
--folder once create_folder gave one, so the next plan never makes a second
folder). `pending` lists the pieces in flight this week and next whose
current words are not in Teleprompter yet, or older there, with the plan
line for each, and holds back a cut whose last send failed less than six
hours ago until its words change or a session runs it with --retry. A cut
that WORKBENCH.md shows was sent by hand (a `making.py ... teleprompter CUT
--script ...` line) and that the record does not hold yet gets that line,
never a plan line: recorded first, so no second script is made. The
Teleprompter state never holds a step back: Copy on the publish page always
works, and recording is never blocked.
"""
import argparse
import json
import os
import re
import shlex
import sys
import tempfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
for _path in (HERE, HERE.parent):
    if str(_path) not in sys.path:
        sys.path.insert(0, str(_path))
import making  # noqa: E402  script_hash, the record, teleprompter_patch
import library  # noqa: E402  subchannel_name: the series as the brand writes it

CONFIG = REPO / 'config' / 'teleprompter.json'
PLANS = REPO / 'docs' / 'plans'
WORKBENCH = REPO / 'WORKBENCH.md'
CUTS = making.CUTS
PY = 'python' if os.name == 'nt' else 'python3'
SELF = 'scripts/post-pack/teleprompter_send.py'
DAYS = ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun')
MONTHS = ('Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec')
COOL_OFF = timedelta(hours=6)  # a failed send is not tried again sooner, unless its words changed or --retry
MAX_NAME = 200  # Teleprompter's limit on a folder name and a script title
# A pack folder, as library.post_folder names it: "2026-10-12 Mon follow.the.money - Who gets paid for AI songs".
PACK_FOLDER = re.compile(r'^(\d{4}-\d{2}-\d{2}) [A-Z][a-z]{2} (\S+) - (.+)$')
# A Teleprompter folder, as this file names it: "Mon 12 Oct follow.the.money - Who gets paid for AI songs".
FOLDER = re.compile(r'^([A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}) (\S+) - (.+)$')
UUID_ANY = r'[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}'
# A send made by hand, as WORKBENCH.md keeps its record line (12 October's four).
HAND_LINE = re.compile(r'(python3? \S*making\.py\b.*?\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s+teleprompter\s+'
                       r'(long|short)\b.*?--script\s+' + UUID_ANY + r'.*)$')


class TeleprompterError(making.MakingError):
    """A reason to stop, in words a person can act on."""


# ---------------------------------------------------------------- the config

def load_config(path=CONFIG):
    """config/teleprompter.json, refused unless Krish confirmed it: status
    "confirmed", his words, the tools allowed, the names and the pace."""
    name = Path(path).name
    try:
        cfg = json.loads(Path(path).read_text(encoding='utf-8'))
    except (OSError, ValueError) as error:
        raise TeleprompterError(f'{name} cannot be read ({error}), so nothing goes to Teleprompter')
    if not isinstance(cfg, dict) or cfg.get('status') != 'confirmed':
        raise TeleprompterError(f'{name} is not confirmed by Krish (its status is not "confirmed"), so nothing goes to Teleprompter')
    for key in ('said', 'allowed_tools', 'folder_name', 'script_title', 'cuts', 'words_per_minute', 'update_fields', 'create_fields'):
        if not cfg.get(key):
            raise TeleprompterError(f'{name} has no {key}')
    for cut in CUTS:
        if not isinstance(cfg['cuts'].get(cut), dict) or not cfg['cuts'][cut].get('name'):
            raise TeleprompterError(f'{name} has no cuts.{cut}')
    if any('delete' in str(tool).lower() for tool in cfg['allowed_tools']):
        raise TeleprompterError(f'{name} allows a delete; Krish\'s terms were "Nothing is ever deleted"')
    if sorted(cfg['update_fields']) != ['duration', 'text']:
        raise TeleprompterError(f'{name}: an update sends only text and duration (Krish may set the rest), not {cfg["update_fields"]}')
    return cfg


# ---------------------------------------------------------------- the words

MD_LINK = re.compile(r'\[([^\]]+)\]\([^)]*\)')
MD_LINE_START = re.compile(r'^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+|\d{1,2}[.)]\s+)')
MD_RULE = re.compile(r'^\s*(?:-{3,}|\*{3,}|_{3,})\s*$')


def spoken_text(text):
    """The words Krish reads, as the teleprompter shows them: the script's
    words (making.normal_script), any markdown stripped (headings, quote and
    list markers, bold, italics, code marks, links kept as their words),
    each paragraph on one line, paragraphs separated by a blank line."""
    paragraphs = []
    for para in re.split(r'\n[ \t]*\n', making.normal_script(text)):
        lines = [MD_LINE_START.sub('', line) for line in para.split('\n') if not MD_RULE.match(line)]
        words = ' '.join(' '.join(lines).split())
        words = MD_LINK.sub(r'\1', words)
        words = re.sub(r'(\*\*|__)(\S(?:.*?\S)?)\1', r'\2', words)
        words = re.sub(r'(?<![\w*])\*(\S(?:.*?\S)?)\*(?![\w*])', r'\1', words)
        words = re.sub(r'(?<!\w)_(\S(?:.*?\S)?)_(?!\w)', r'\1', words)
        words = words.replace('`', '')
        if words:
            paragraphs.append(words)
    return '\n\n'.join(paragraphs)


def word_count(text):
    return len(spoken_text(text).split())


def duration_seconds(text, cfg):
    """Its spoken words at the config's pace (150 a minute), in whole seconds."""
    words = word_count(text)
    return max(1, int(round(words * 60 / cfg['words_per_minute']))) if words else 0


# ---------------------------------------------------------------- names

def day_label(when):
    """'Mon 12 Oct' for '2026-10-12'."""
    try:
        d = date.fromisoformat(str(when)[:10])
    except ValueError:
        raise TeleprompterError(f'the post\'s date is YYYY-MM-DD, not "{when}"')
    return f'{DAYS[d.weekday()]} {d.day} {MONTHS[d.month - 1]}'


def _one_line(text, what):
    text = ' '.join(str(text or '').split())
    if not text or len(text) > MAX_NAME:
        raise TeleprompterError(f'{what} is one line of 1 to {MAX_NAME} characters, not "{text[:60]}"')
    return text


def names_from_post(post):
    """{'day', 'series', 'subject'} from a post.json."""
    if not isinstance(post, dict):
        raise TeleprompterError('the post.json is not an object')
    subject = str(post.get('subject') or post.get('headline') or '').strip()
    if not subject:
        raise TeleprompterError('the post.json has no subject to name the folder and the scripts by')
    if post.get('launch'):
        series = 'Launch'
    else:
        try:
            series = library.subchannel_name(post.get('subchannel'))
        except library.LibraryError as error:
            raise TeleprompterError(f'the post.json\'s series: {error}')
    return {'day': day_label(post.get('date')), 'series': series, 'subject': subject}


def names_from_pack(folder):
    """The same, from the pack folder the making record holds, or None."""
    hit = PACK_FOLDER.match(str(folder or '').strip())
    return {'day': day_label(hit.group(1)), 'series': hit.group(2), 'subject': hit.group(3)} if hit else None


def names_from_folder(name):
    """The same, from a Teleprompter folder name this file made, or None."""
    hit = FOLDER.match(str(name or '').strip())
    return {'day': hit.group(1), 'series': hit.group(2), 'subject': hit.group(3)} if hit else None


def folder_name(names):
    """'Mon 12 Oct follow.the.money - Who gets paid for AI songs'."""
    return _one_line(f'{names["day"]} {names["series"]} - {names["subject"]}', 'the folder name')


def script_title(names, cut, cfg):
    """'Mon 12 Oct - 3-minute - Who gets paid for AI songs'."""
    return _one_line(f'{names["day"]} - {cfg["cuts"][making._cut(cut)]["name"]} - {names["subject"]}', 'the script title')


def find_post(piece_id, plans=PLANS):
    """The post.json in docs/plans naming the piece, or None."""
    for path in sorted(Path(plans).glob('*/post.json')):
        try:
            data = json.loads(path.read_text(encoding='utf-8-sig'))
        except (OSError, ValueError):
            continue
        if isinstance(data, dict) and str(data.get('piece_id') or '') == piece_id:
            return path
    return None


def resolve_names(piece_id, record, post_path=None, plans=PLANS):
    """(names, where they came from): the post.json given, else the one in
    docs/plans naming the piece, else the record's pack folder, else the
    Teleprompter folder the record holds."""
    path = Path(post_path) if post_path else find_post(piece_id, plans)
    if path:
        try:
            post = json.loads(Path(path).read_text(encoding='utf-8-sig'))
        except (OSError, ValueError) as error:
            raise TeleprompterError(f'{path} cannot be read: {error}')
        if isinstance(post, dict) and post.get('piece_id') and post['piece_id'] != piece_id:
            raise TeleprompterError(f'{path} is the post of piece {post["piece_id"]}, not {piece_id}')
        return names_from_post(post), _shown(path)
    pack = ((record or {}).get('pack') or {}).get('folder') if isinstance((record or {}).get('pack'), dict) else None
    found = names_from_pack(pack)
    if found:
        return found, 'the pack folder on the record'
    held = (record or {}).get('teleprompter') if isinstance((record or {}).get('teleprompter'), dict) else {}
    found = names_from_folder(held.get('folder_name'))
    if found:
        return found, 'the Teleprompter folder on the record'
    raise TeleprompterError('nothing names the piece\'s day, series and subject: give --post post.json')


# ---------------------------------------------------------------- the plan

def _q(value):
    """One argument of a printed command, quoted for the shell it runs in:
    PowerShell on Windows, a POSIX shell elsewhere."""
    text = str(value)
    if text and re.fullmatch(r'[A-Za-z0-9_./:=@%+,\\-]+', text):
        return text
    if os.name == 'nt':
        return "'" + text.replace("'", "''") + "'"
    return shlex.quote(text)


def hand_made(piece_id, cut, workbench=WORKBENCH):
    """The making.py teleprompter line WORKBENCH.md keeps for a send made by
    hand for this piece and cut, or None."""
    try:
        text = Path(workbench).read_text(encoding='utf-8')
    except OSError:
        return None
    for line in text.splitlines():
        hit = HAND_LINE.search(line.strip())
        if hit and hit.group(2).lower() == piece_id and hit.group(3) == cut:
            return hit.group(1)
    return None


def plan(piece_id, script_paths, call=None, cfg=None, post_path=None, plans=PLANS, workbench=WORKBENCH):
    """What to send for each cut, and the calls that send it. Sends nothing."""
    cfg = cfg or load_config()
    if not making.UUID.match(piece_id or ''):
        raise TeleprompterError('the piece id is the content_ideas uuid (post.json "piece_id")')
    piece_id = piece_id.lower()
    script_paths = list(script_paths or [])
    if len(script_paths) != len(CUTS):
        raise TeleprompterError('give both scripts, the long cut first: plan PIECE long.md short.md')
    record = making.record_of(piece_id, call)
    check = record.get('script_check') if isinstance(record.get('script_check'), dict) else {}
    if check.get('passed') is not True:
        raise TeleprompterError('the scripts\' check has not passed on the piece\'s record: run making.py PIECE scripts long.md short.md '
                                'first; nothing is sent')
    hashes = making.current_hashes(record)
    texts = {}
    for cut, path in zip(CUTS, script_paths):
        if cut not in hashes:
            raise TeleprompterError(f'the record holds no hash for the {cut} script: run making.py PIECE scripts long.md short.md again')
        try:
            texts[cut] = Path(path).read_text(encoding='utf-8-sig')
        except (OSError, UnicodeDecodeError) as error:
            raise TeleprompterError(f'the {cut} script {path} cannot be read: {error}')
        got = making.script_hash(texts[cut])
        if got != hashes[cut]:
            raise TeleprompterError(f'{Path(path).name} does not hold the {cut} words the check passed (its words hash {got[:12]}, the '
                                    f'record holds {hashes[cut][:12]}): give the files making.py scripts checked, or check these first')
    held = record.get('teleprompter') if isinstance(record.get('teleprompter'), dict) else {}
    out = {'piece_id': piece_id, 'cuts': [], 'hand_made': {}}
    states = {cut: making.teleprompter_state(record, cut) for cut in CUTS}
    # Words Krish reads on the teleprompter were heard first by two fresh 12-year-old readers (house rule R7).
    unread = [cut for cut in CUTS if states[cut][0] != 'in' and not making.read_back_of(record, cut)]
    if unread:
        raise TeleprompterError(f'the {" and ".join(making.CUT_NAME[c] for c in unread)} script{"s" if len(unread) > 1 else ""}\' current words '
                                'have not been read back: two fresh readers, each an ordinary 12-year-old hearing it once, must find nothing '
                                'that loses them (make-piece, "The Scripts step"), then making.py PIECE read-back CUT --readers ... records it; '
                                'nothing is sent until then')
    # A send made by hand that the record does not hold yet: its line first, never a second script.
    for cut, (state, _entry) in states.items():
        line = hand_made(piece_id, cut, workbench) if state in ('missing', 'failed') and not (_entry or {}).get('script_id') else None
        if line:
            out['hand_made'][cut] = line
    if out['hand_made']:
        return out
    names, where = resolve_names(piece_id, record, post_path, plans)
    folder_id = held.get('folder_id') if making.TELEPROMPTER_ID.match(str(held.get('folder_id') or '')) else None
    name = held.get('folder_name') if folder_id and held.get('folder_name') else folder_name(names)
    out.update(names=names, names_from=where, folder_id=folder_id, folder_name=name)
    for cut, path in zip(CUTS, script_paths):
        state, entry = states[cut]
        entry = entry or {}
        text, seconds = spoken_text(texts[cut]), duration_seconds(texts[cut], cfg)
        item = {'cut': cut, 'name': cfg['cuts'][cut]['name'], 'state': state, 'sha256': hashes[cut], 'script': str(path),
                'words': len(text.split()), 'seconds': seconds}
        if state == 'in':
            item.update(action='none', script_id=entry.get('script_id'), title=entry.get('title'), sent_at=entry.get('sent_at'))
        elif entry.get('script_id'):
            # The same script, updated in place: only its text and duration (Krish may set the rest).
            item.update(action='update', script_id=entry['script_id'], title=entry.get('title') or script_title(names, cut, cfg),
                        call={'tool': 'update_script', 'args': {'id': entry['script_id'], 'text': text, 'duration': seconds}})
        else:
            title = script_title(names, cut, cfg)
            item.update(action='create', title=title, failed=entry.get('error'),
                        call={'tool': 'create_script', 'args': {'title': title, 'text': text, 'folderId': folder_id or '<FOLDER>',
                                                                 'duration': seconds}})
        out['cuts'].append(item)
    out['new_folder'] = not folder_id and any(c['action'] == 'create' for c in out['cuts'])
    return out


def record_line(piece_id, item, folder_id=None, folder_name_=None):
    parts = [PY, SELF, 'record', piece_id, item['cut'], '--folder', folder_id or '<FOLDER>',
             '--script', item.get('script_id') or '<the id create_script gave>', '--sha', item['sha256'], '--title', item['title']]
    if folder_name_:
        parts += ['--folder-name', folder_name_]
    return ' '.join(_q(p) for p in parts)


def error_line(piece_id, cut, folder_id=None):
    parts = [PY, SELF, 'record', piece_id, cut]
    if folder_id:
        parts += ['--folder', folder_id]
    return ' '.join(_q(p) for p in parts + ['--error', '<what Teleprompter said>'])


def show_plan(p, cfg=None):
    """The plan as the session reads it: each call, in order."""
    pid = p['piece_id']
    if p.get('hand_made'):
        lines = [f'Teleprompter send for piece {pid}: a send made by hand is not on the record yet. Run its line first, exactly as '
                 'written (WORKBENCH.md), then plan again; never a second script:']
        lines += [f'  {line}' for line in p['hand_made'].values()]
        return '\n'.join(lines)
    names = p['names']
    lines = [f'Teleprompter send: {names["day"]} "{names["subject"]}" (piece {pid}; the names from {p["names_from"]})',
             f'Folder: "{p["folder_name"]}"' + (f' ({p["folder_id"]}, on the record)' if p.get('folder_id') else ' (not made yet)')]
    for c in p['cuts']:
        if c['action'] == 'none':
            lines.append(f'{c["name"]} cut: Teleprompter already holds these words (sent {c.get("sent_at")}), script "{c.get("title")}"; '
                         'nothing to do.')
    sending = [c for c in p['cuts'] if c['action'] != 'none']
    if not sending:
        lines.append('Nothing to send.')
        return '\n'.join(lines)
    allowed = ', '.join((cfg or {}).get('allowed_tools') or ['list_folders', 'list_scripts_in_folder', 'create_folder', 'create_script',
                                                              'update_script'])
    lines += ['', f'Make these calls with the Teleprompter connector, in order. Only these tools: {allowed}. Nothing is ever deleted, '
              'moved or renamed, and fontSize, speed, alignment and timedSpeed are never sent: they are Krish\'s.']
    step = 1
    folder = p.get('folder_id')
    if p.get('new_folder'):
        lines += [f'{step}. list_folders {{"limit": 100}} (and its next pages, with "cursor")',
                  f'   A folder named exactly "{p["folder_name"]}" listed already: use its id as <FOLDER> and skip step {step + 1} '
                  '(never a second folder).',
                  f'{step + 1}. create_folder {json.dumps({"name": p["folder_name"]}, ensure_ascii=False)}',
                  '   Keep the id it gives, an uppercase UUID: <FOLDER> below.']
        step += 2
    for c in sending:
        lines += ['', f'{c["name"]} cut ({c["cut"]}, {c["words"]} words, {c["seconds"]} seconds): '
                  + ('its script, updated in place: only its text and duration' if c['action'] == 'update'
                     else 'a new script' + (f' (the last send failed: {c["failed"]})' if c.get('failed') else ''))]
        if c['action'] == 'create':
            lines += [f'{step}. list_scripts_in_folder {{"folderId": "{folder or "<FOLDER>"}", "limit": 100}}',
                      f'   A script titled exactly "{c["title"]}" listed already: do not create it. Send step {step + 1}\'s text and '
                      'duration to it with update_script {"id": "<its id>", "text": ..., "duration": ...}, and record that id.']
            step += 1
        args = json.dumps(c['call']['args'], ensure_ascii=False)
        lines.append(f'{step}. {c["call"]["tool"]} {args}')
        if c['action'] == 'create':
            lines.append('   Keep the id it gives, an uppercase UUID.')
        lines.append(f'{step + 1}. {record_line(pid, c, folder, p["folder_name"] if c["action"] == "create" or not folder else None)}')
        step += 2
    lines += ['', 'If a call fails, make it once more. If it fails again, record why and stop; recording is never held up, and Copy on '
              'the publish page still works:']
    for c in sending:
        lines.append(f'   {error_line(pid, c["cut"], folder or ("<FOLDER, once create_folder gave it>" if p.get("new_folder") else None))}')
    lines += ['', f'Then: {PY} scripts/post-pack/making.py {pid} show']
    return '\n'.join(lines)


# ---------------------------------------------------------------- record

def record(piece_id, cut, args, call=None, by=None, cfg=None):
    """Writes one cut's place in Teleprompter onto the piece's making record,
    after checking the config and the ids."""
    cfg = cfg or load_config()
    patch = making.teleprompter_record_patch(piece_id, cut, args, call, by, config=cfg)
    return making.post(piece_id, patch, call, by=by)


# ---------------------------------------------------------------- pending

def week_monday(text=None, today=None):
    try:
        d = date.fromisoformat(text) if text else (today or date.today())
    except ValueError:
        raise TeleprompterError(f'--week is a date, YYYY-MM-DD, not "{text}"')
    return d - timedelta(days=d.weekday())


def _get(call, path):
    status, text = (call or making._engine_call)('GET', path, None)
    if status != 200:
        raise TeleprompterError(f'the engine answered {status} to GET {path.split("?")[0]}: {str(text)[:200]}')
    try:
        return json.loads(text)
    except ValueError:
        raise TeleprompterError(f'the engine answered GET {path.split("?")[0]} with something that is not JSON')


def scripts_of(post_path):
    """{cut: path} of the piece's two scripts on this machine (plan_files)."""
    import plan_files
    found = {}
    for item in plan_files.video_files(post_path):
        if item['kind'] == 'video-script' and item.get('cut') in CUTS and item.get('path') and item['cut'] not in found:
            found[item['cut']] = item['path']
    return found


def _shown(path):
    try:
        return Path(path).resolve().relative_to(REPO).as_posix()
    except ValueError:
        return Path(path).as_posix()


def _when(text):
    try:
        at = datetime.fromisoformat(str(text).replace('Z', '+00:00'))
    except (TypeError, ValueError):
        return None
    return at if at.tzinfo else at.replace(tzinfo=timezone.utc)


def held_back(record, cut, entry, now=None):
    """Why a cut whose last send failed is not sent again yet, or None: it
    failed less than COOL_OFF ago. Words changed since the failure are
    always sent."""
    if not isinstance(entry, dict) or not entry.get('error'):
        return None
    failed = _when(entry.get('failed_at') or entry.get('sent_at'))
    check = record.get('script_check') if isinstance(record.get('script_check'), dict) else {}
    changed = _when((check.get('changed_at') or {}).get(cut)) if isinstance(check.get('changed_at'), dict) else None
    if failed and changed and changed > failed:
        return None
    now = now or datetime.now(timezone.utc)
    if failed and now - failed < COOL_OFF:
        return (f'the last send failed at {failed.isoformat().replace("+00:00", "Z")} ({entry["error"]}): tried again '
                f'{int(COOL_OFF.total_seconds() // 3600)} hours after it, or with --retry')
    return None


def pending(call=None, monday=None, plans=PLANS, retry=False, now=None, workbench=WORKBENCH):
    """The pieces in flight this week and next whose current checked words
    are not all in Teleprompter: [{'id', 'idea', 'scheduled_for', 'cuts':
    {cut: state}, 'held': {cut: why}, 'hand_made': {cut: line}, 'plan': the
    plan line or None, 'why'}]. A cut held back (held_back) is not in cuts
    unless retry; a cut sent by hand is in hand_made, and no plan line is
    given until those lines have run."""
    monday = monday or week_monday()
    seen = {}
    for week in (monday, monday + timedelta(days=7)):
        for series in _get(call, f'/api/week/options?week_start={week.isoformat()}').get('series') or []:
            for item in series.get('in_flight') or []:
                pid = str((item or {}).get('id') or '')
                if making.UUID.match(pid) and pid not in seen:
                    seen[pid] = {'id': pid, 'idea': item.get('idea') or '', 'scheduled_for': item.get('scheduled_for')}
    out = []
    for piece in seen.values():
        record = _get(call, f'/api/content-ideas/{piece["id"]}/making').get('making') or {}
        waiting, held, hand = {}, {}, {}
        for cut in CUTS:
            state, entry = making.teleprompter_state(record, cut)
            if state not in ('missing', 'older', 'failed'):
                continue
            why_held = None if retry else held_back(record, cut, entry, now)
            line = hand_made(piece['id'], cut, workbench) if not (entry or {}).get('script_id') else None
            if why_held:
                held[cut] = why_held
            elif line:
                hand[cut] = line
            else:
                waiting[cut] = state
        if not waiting and not held and not hand:
            continue
        post_path = find_post(piece['id'], plans)
        scripts = scripts_of(post_path) if post_path else {}
        if hand:
            line = None
            why = 'a send made by hand is not on the record yet: run its line below first, then pending again (no second script)'
        elif not waiting:
            line, why = None, 'held back'
        elif post_path and all(cut in scripts for cut in CUTS):
            line = ' '.join(_q(x) for x in [PY, SELF, 'plan', piece['id'], _shown(scripts['long']), _shown(scripts['short'])])
            why = None
        else:
            line = None
            why = ('no post.json in docs/plans names it' if not post_path
                   else 'its scripts are not on this machine (' + ', '.join(c for c in CUTS if c not in scripts) + ')')
        out.append({**piece, 'cuts': waiting, 'held': held, 'hand_made': hand, 'plan': line, 'why': why})
    out.sort(key=lambda p: (p.get('scheduled_for') or '9999-12-31', p['id']))
    return out


def show_pending(found):
    if not found:
        return 'Every checked script in flight this week and next is in Teleprompter with its current words.'
    words = {'missing': 'not sent', 'older': 'Teleprompter has older words', 'failed': 'the last send failed'}
    lines = []
    for p in found:
        cuts = '; '.join([f'{making.CUT_NAME[c]}: {words[s]}' for c, s in p['cuts'].items()]
                         + [f'{making.CUT_NAME[c]}: sent by hand, not on the record yet' for c in p.get('hand_made') or {}]
                         + [f'{making.CUT_NAME[c]}: held back' for c in p.get('held') or {}])
        lines.append(f'{p.get("scheduled_for") or "unscheduled"} {p["id"]} ({cuts})')
        for c, line in (p.get('hand_made') or {}).items():
            lines.append(f'  record the {making.CUT_NAME[c]} send made by hand first (WORKBENCH.md): {line}')
        for c, why in (p.get('held') or {}).items():
            lines.append(f'  {making.CUT_NAME[c]} held back: {why}')
        if p['plan']:
            lines.append(f'  {p["plan"]}')
        elif p['cuts']:
            lines.append(f'  cannot plan here: {p["why"]}')
    return '\n'.join(lines)


# ---------------------------------------------------------------- self-test

def self_test():
    fails, count = [], 0

    def check(label, got, want):
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

    cfg = load_config()
    said = cfg['said']
    check('config: his words, verbatim',
          (said['switch']['words'], said['send']['asked'], said['send']['picked'], said['send']['terms']),
          ('Also note that Descript is permanently gone, teleprompter.com is permanently in, connected via MCP here',
           'May every checked script go into your teleprompter.com account automatically, starting with Monday\'s two now?',
           'Yes, automatic, Monday now',
           'One script per cut, in a folder per piece (e.g. "Mon 12 Oct follow.the.money"). When the words change, the same script is '
           'updated in place. Nothing is ever deleted.'))
    check('config: the tools allowed, and never a delete, a move or a rename',
          (sorted(cfg['allowed_tools']), any(t in cfg['allowed_tools'] for t in ('move_script', 'update_folder'))),
          (['create_folder', 'create_script', 'get_folder', 'get_script', 'list_folders', 'list_scripts', 'list_scripts_in_folder',
            'update_script'], False))
    check('config: an update sends text and duration only; a create never sends his settings',
          (sorted(cfg['update_fields']), sorted(cfg['create_fields'])), (['duration', 'text'], ['duration', 'folderId', 'text', 'title']))
    with tempfile.TemporaryDirectory() as tmp:
        for label, change, words in (('a proposed config', {'status': 'proposed'}, 'not confirmed by Krish'),
                                     ('a delete allowed', {'allowed_tools': cfg['allowed_tools'] + ['delete_script']}, 'Nothing is ever deleted'),
                                     ('an update that sends the font', {'update_fields': ['text', 'duration', 'fontSize']}, 'only text and duration')):
            path = Path(tmp) / 'teleprompter.json'
            path.write_text(json.dumps({**cfg, **change}), encoding='utf-8')
            refused(f'config: {label} is refused', lambda: load_config(path), words)

    # The words: markdown stripped, a paragraph a line, a blank line between.
    sample = ('# A heading\r\n\r\nWarner sued **Suno**. Now it takes a *cut*!  \nWho else gets [paid](https://x.example)?\r\n\r\n'
              '---\n\n> You pay `Suno`.\n- Half the cake,\n- or the crumbs?\n\n\n')
    check('words: markdown stripped, paragraphs one line each, a blank line between',
          spoken_text(sample), 'A heading\n\nWarner sued Suno. Now it takes a cut! Who else gets paid?\n\nYou pay Suno. Half the cake, or the crumbs?')
    check('words: a name with underscores and a site keep their marks', spoken_text('Read follow_the_money at makeyourmindup.ai.\n'),
          'Read follow_the_money at makeyourmindup.ai.')
    check('duration: words at 150 a minute, in whole seconds', (duration_seconds(' '.join(['word'] * 474), cfg),
                                                               duration_seconds(' '.join(['word'] * 206), cfg), duration_seconds('', cfg)),
          (190, 82, 0))
    import story_check
    for name in ('2026-10-12-draft-script.md', '2026-10-12-draft-script-90s.md', '2026-10-09-draft-script.md', '2026-10-09-draft-script-90s.md'):
        path = PLANS / name
        if path.is_file():
            text = path.read_text(encoding='utf-8')
            check(f'words: {name} sends every spoken word story_check counts, in its paragraphs',
                  (spoken_text(text).split(), spoken_text(text).count('\n\n') + 1),
                  (' '.join(story_check.spoken_paragraphs(text)).split(), len(story_check.spoken_paragraphs(text))))

    # Names: the folder and the titles, from a post, a pack folder or a folder made before.
    post = {'piece_id': 'f328382d-71b3-41a7-a221-d8615826f12e', 'date': '2026-10-12', 'subchannel': 'follow_the_money',
            'subject': 'Who gets paid for AI songs', 'files': []}
    names = names_from_post(post)
    check('names: the folder, as made on 12 October', folder_name(names), 'Mon 12 Oct follow.the.money - Who gets paid for AI songs')
    check('names: the titles, as made on 12 October', [script_title(names, c, cfg) for c in CUTS],
          ['Mon 12 Oct - 3-minute - Who gets paid for AI songs', 'Mon 12 Oct - 90-second - Who gets paid for AI songs'])
    friday = names_from_pack('2026-10-16 Fri mind.the.gap - Why so many AIs')
    check('names: from the pack folder on the record', (folder_name(friday), script_title(friday, 'short', cfg)),
          ('Fri 16 Oct mind.the.gap - Why so many AIs', 'Fri 16 Oct - 90-second - Why so many AIs'))
    check('names: from a folder made before', names_from_folder('Fri 16 Oct mind.the.gap - Why so many AIs'), friday)
    refused('names: a title over 200 characters is refused', lambda: script_title({**names, 'subject': 'x' * 300}, 'long', cfg), '200 characters')

    # The plan, against a stand-in engine.
    pid = post['piece_id']
    folder, long_id, short_id = '86B6F74B-2F8A-4477-AE44-8DA1119D1CD9', '45F414D8-31E1-4B2D-BBE4-44EBA042B346', 'ED3DE98A-7158-4448-A622-A2A5115FFA83'
    with tempfile.TemporaryDirectory() as tmp:
        t = Path(tmp)
        bench = t / 'WORKBENCH.md'
        bench.write_text('# Workbench\n', encoding='utf-8')
        (t / 'post.json').write_text(json.dumps(post), encoding='utf-8')
        long_words, short_words = 'The long script.\n\nIt has **two** paragraphs.\n', 'The short script.\n'
        (t / 'long.md').write_text(long_words, encoding='utf-8')
        (t / 'short.md').write_text(short_words, encoding='utf-8')
        long_sha, short_sha = making.script_hash(long_words), making.script_hash(short_words)
        read = lambda sha: {'script_sha256': sha, 'at': '2026-10-12T15:36:00Z', 'by': 'Claude Code', 'readers': ['A', 'B'], 'found': 'nothing lost'}
        holds = {'script_check': {'passed': True, 'checked_at': '2026-10-12T15:35:35Z', 'problems': [], 'hashes': {'long': long_sha, 'short': short_sha},
                                  'read_back': {'long': read(long_sha), 'short': read(short_sha)}}}
        gets = []

        def engine(method, path, body):
            gets.append((method, path))
            return 200, json.dumps({'ok': True, 'making': holds, 'steps': []})
        go = lambda **kw: plan(pid, [t / 'long.md', t / 'short.md'], engine, cfg, post_path=t / 'post.json', workbench=bench, **kw)
        first = go()
        shown = show_plan(first, cfg)
        check('plan: the record is read, nothing is written', [m for m, _ in gets], ['GET'])
        check('plan: no folder on the record: list_folders, then create_folder with his name for it',
              (first['new_folder'], first['folder_name'], 'list_folders {"limit": 100}' in shown,
               'create_folder {"name": "Mon 12 Oct follow.the.money - Who gets paid for AI songs"}' in shown), (True, folder_name(names), True, True))
        long_plan = first['cuts'][0]
        check('plan: a new script per cut, with exactly title, text, folderId and duration',
              (long_plan['action'], sorted(long_plan['call']['args']), long_plan['call']['args']['title'], long_plan['call']['args']['text']),
              ('create', ['duration', 'folderId', 'text', 'title'], 'Mon 12 Oct - 3-minute - Who gets paid for AI songs',
               'The long script.\n\nIt has two paragraphs.'))
        check('plan: a title already there is never made twice: list_scripts_in_folder first',
              shown.index('list_scripts_in_folder') < shown.index('create_script'), True)
        check('plan: never his font, speed, alignment or timed speed', any(k in shown for k in ('"fontSize"', '"speed"', '"alignment"', '"timedSpeed"')),
              False)
        check('plan: the record line carries the full hash, the title and the folder name',
              (f'--sha {long_sha}' in shown, "--title 'Mon 12 Oct - 3-minute - Who gets paid for AI songs'" in shown,
               "--folder-name 'Mon 12 Oct follow.the.money - Who gets paid for AI songs'" in shown), (True, True, True))
        check('plan: the failure line keeps the folder once it is made', '--folder \'<FOLDER, once create_folder gave it>\' --error' in shown, True)

        # The folder and the long script are on the record, with these words; the short script holds older words.
        holds['teleprompter'] = {'folder_id': folder, 'folder_name': 'Mon 12 Oct follow.the.money - Who gets paid for AI songs', 'cuts': {
            'long': {'script_id': long_id, 'title': 'Mon 12 Oct - 3-minute - Who gets paid for AI songs', 'script_sha256': long_sha,
                     'sent_at': '2026-10-12T15:34:07Z', 'by': 'Claude Code'},
            'short': {'script_id': short_id, 'title': 'Mon 12 Oct - 90-second - Who gets paid for AI songs', 'script_sha256': 'e' * 64,
                      'sent_at': '2026-10-12T15:34:08Z', 'by': 'Claude Code'}}}
        again = go()
        shown = show_plan(again, cfg)
        check('plan: the words already there need no call', (again['cuts'][0]['action'], 'call' in again['cuts'][0]), ('none', False))
        check('plan: a folder on the record is never made again', (again['new_folder'], 'create_folder {' in shown, 'list_folders {' in shown),
              (False, False, False))
        update = again['cuts'][1]['call']
        check('plan: changed words update the same script in place, sending only its text and duration',
              (update['tool'], update['args']), ('update_script', {'id': short_id, 'text': 'The short script.', 'duration': 1}))
        check('plan: its record line keeps the folder and the script',
              f"--folder {folder} --script {short_id} --sha {short_sha} --title 'Mon 12 Oct - 90-second - Who gets paid for AI songs'" in shown, True)
        holds['teleprompter']['cuts']['short']['script_sha256'] = short_sha
        check('plan: both there, nothing to send', 'Nothing to send.' in show_plan(go(), cfg), True)
        # A create that failed before any script was made: made in the folder on the record, the title checked first.
        holds['teleprompter']['cuts']['short'] = {'error': 'HTTP 503', 'failed_at': '2026-10-12T15:40:00Z', 'sent_at': '2026-10-12T15:40:00Z',
                                                  'by': 'Claude Code'}
        retry = go()
        check('plan: a create that failed is made in the folder on the record, after the title is looked for',
              (retry['cuts'][1]['action'], retry['cuts'][1]['call']['args']['folderId'], f'list_scripts_in_folder {{"folderId": "{folder}"' in show_plan(retry, cfg)),
              ('create', folder, True))
        # A send made by hand that the record does not hold: its line, never a plan.
        hand = (f"python3 scripts/post-pack/making.py --by 'Claude Code' {pid} teleprompter short --folder {folder} --script {short_id} "
                f"--sha {short_sha} --title 'Mon 12 Oct - 90-second - Who gets paid for AI songs'")
        bench.write_text('# Workbench\n\n   ' + hand + '\n', encoding='utf-8')
        by_hand = go()
        check('plan: a cut sent by hand and not recorded gets its WORKBENCH line, and no call at all',
              (by_hand['hand_made'], by_hand['cuts'], 'never a second script' in show_plan(by_hand, cfg)), ({'short': hand}, [], True))
        bench.write_text('# Workbench\n', encoding='utf-8')
        holds['teleprompter']['cuts']['short'] = {'script_id': short_id, 'title': 'T', 'script_sha256': short_sha, 'sent_at': 'x', 'by': 'y'}

        # The refusals: nothing is planned.
        holds['teleprompter']['cuts']['long']['script_sha256'] = 'd' * 64
        holds['script_check']['read_back'].pop('long')
        refused('plan: a cut to send whose words were not read back is refused', go, 'have not been read back')
        holds['script_check']['read_back']['long'] = {**read(long_sha), 'script_sha256': 'c' * 64}
        refused('plan: a read-back of other words does not count', go, 'the 3-minute script\' current words have not been read back')
        holds['script_check']['read_back']['long'] = read(long_sha)
        holds['teleprompter']['cuts']['long']['script_sha256'] = long_sha
        holds['script_check']['read_back'].pop('short')
        check('plan: a cut whose words are already there needs no read-back to say so',
              [c['action'] for c in go()['cuts']], ['none', 'none'])
        holds['script_check']['read_back']['short'] = read(short_sha)
        holds['script_check']['hashes']['long'] = 'f' * 64
        refused('plan: a file that is not the words the check passed is refused', go, 'does not hold the long words the check passed')
        holds['script_check']['hashes']['long'] = long_sha
        holds['script_check']['passed'] = False
        refused('plan: a check that did not pass is refused', go, 'has not passed')
        holds['script_check']['passed'] = True
        refused('plan: one script is refused', lambda: plan(pid, [t / 'long.md'], engine, cfg), 'give both scripts')
        refused('plan: a piece id that is not a uuid is refused', lambda: plan('monday', [t / 'long.md', t / 'short.md'], engine, cfg),
                'content_ideas uuid')
        (t / 'other.json').write_text(json.dumps({**post, 'piece_id': '904658db-4df2-4537-a0ed-ebe93e081db7'}), encoding='utf-8')
        refused('plan: another piece\'s post.json is refused',
                lambda: plan(pid, [t / 'long.md', t / 'short.md'], engine, cfg, post_path=t / 'other.json', workbench=bench), 'is the post of piece')

        # record: the ids checked, the folder kept, the patch written.
        posts = []

        def writer(method, path, body):
            if method == 'GET':
                return 200, json.dumps({'ok': True, 'making': holds, 'steps': []})
            posts.append(body)
            return 200, json.dumps({'ok': True, 'steps': []})
        ns = lambda **kw: argparse.Namespace(**{**dict(folder=None, script=None, sha=None, title=None, folder_name=None, sent_at=None,
                                                       error=None), **kw})
        record(pid, 'long', ns(folder=folder.lower(), script=long_id, sha=long_sha, sent_at='2026-10-12T15:34:07Z'), writer, 'Claude Code', cfg)
        sent = posts[-1]['teleprompter']
        check('record: the ids in upper case, the title kept from the record\'s script, the folder name kept',
              (sent['folder_id'], sent['folder_name'], sent['cuts']['long']),
              (folder, 'Mon 12 Oct follow.the.money - Who gets paid for AI songs',
               {'script_id': long_id, 'title': 'Mon 12 Oct - 3-minute - Who gets paid for AI songs', 'script_sha256': long_sha,
                'sent_at': '2026-10-12T15:34:07Z', 'by': 'Claude Code'}))
        before = len(posts)
        refused('record: another folder than the piece\'s is refused before anything is written',
                lambda: record(pid, 'long', ns(folder='DD28154B-B6D1-47DB-803A-79410D83196D', script=long_id, sha=long_sha), writer, 'Claude Code', cfg),
                'are in folder')
        refused('record: an id that is not a uuid is refused', lambda: record(pid, 'long', ns(folder=folder, script='my script', sha=long_sha),
                                                                               writer, 'Claude Code', cfg), 'uppercase UUID')
        refused('record: no hash is refused', lambda: record(pid, 'long', ns(folder=folder, script=long_id), writer, 'Claude Code', cfg), '--sha')
        unconfirmed = Path(tmp) / 'proposed.json'
        unconfirmed.write_text(json.dumps({**cfg, 'status': 'proposed'}), encoding='utf-8')
        refused('record: an unconfirmed config is refused',
                lambda: record(pid, 'long', ns(folder=folder, script=long_id, sha=long_sha), writer, 'Claude Code', load_config(unconfirmed)), 'not confirmed')
        check('record: nothing written when refused', len(posts), before)
        record(pid, 'short', ns(error='HTTP 503:\n try again'), writer, 'Claude Code', cfg)
        failed = posts[-1]['teleprompter']['cuts']['short']
        check('record: a failed update keeps its script, with what Teleprompter said and when',
              (failed['script_id'], failed['error'], bool(failed.get('failed_at'))), (short_id, 'HTTP 503: try again', True))
        holds.pop('teleprompter')
        record(pid, 'long', ns(folder=folder, error='HTTP 500 on create_script'), writer, 'Claude Code', cfg)
        bare = posts[-1]['teleprompter']
        check('record: a create that failed after create_folder keeps the folder, so no second one is made',
              (bare['folder_id'], sorted(bare['cuts']['long'])), (folder, ['by', 'error', 'failed_at', 'sent_at']))
        record(pid, 'short', ns(folder=folder, script=short_id, sha=short_sha, folder_name='Mon 12 Oct follow.the.money - Who gets paid for AI songs'),
               writer, 'Claude Code', cfg)
        check('record: a first send with no title takes it from the folder name and the cut',
              posts[-1]['teleprompter']['cuts']['short']['title'], 'Mon 12 Oct - 90-second - Who gets paid for AI songs')

    # pending: in flight this week and next, current words not in Teleprompter.
    hashes = {'long': 'a' * 64, 'short': 'b' * 64}

    def week_engine(method, path, body):
        if path.startswith('/api/week/options'):
            if 'week_start=2026-10-12' in path:
                return 200, json.dumps({'series': [{'in_flight': [{'id': pid, 'idea': 'songs', 'scheduled_for': '2026-10-12'},
                                                                   {'id': '904658db-4df2-4537-a0ed-ebe93e081db7', 'idea': 'AIs', 'scheduled_for': '2026-10-16'}]}]})
            return 200, json.dumps({'series': []})
        sent_ = {'folder_id': folder, 'cuts': {c: {'script_id': long_id if c == 'long' else short_id, 'title': 't', 'script_sha256': hashes[c],
                                                   'sent_at': 'x', 'by': 'y'} for c in CUTS}}
        making_ = {'script_check': {'passed': True, 'checked_at': 'x', 'problems': [], 'hashes': hashes}}
        making_['teleprompter'] = {**sent_, 'cuts': {'long': sent_['cuts']['long']}} if pid in path else sent_
        return 200, json.dumps({'ok': True, 'making': making_, 'steps': []})
    with tempfile.TemporaryDirectory() as tmp:
        bench = Path(tmp) / 'WORKBENCH.md'
        bench.write_text('# Workbench\n', encoding='utf-8')
        found = pending(week_engine, date(2026, 10, 12), workbench=bench)
        check('pending: the piece with a cut not sent, and only it', [(p['id'], p['cuts']) for p in found], [(pid, {'short': 'missing'})])
        if (PLANS / '2026-10-12-monday' / 'post.json').is_file():
            check('pending: the plan line names both scripts',
                  found[0]['plan'], f'{PY} {SELF} plan {pid} docs/plans/2026-10-12-draft-script.md docs/plans/2026-10-12-draft-script-90s.md')
        bench.write_text('# Workbench\n\n' + hand + '\n', encoding='utf-8')
        by_hand = pending(week_engine, date(2026, 10, 12), workbench=bench)
        check('pending: a cut sent by hand is recorded first, with no plan line',
              (by_hand[0]['cuts'], list(by_hand[0]['hand_made']), by_hand[0]['plan']), ({}, ['short'], None))
        check('pending: the line is said', 'record the 90-second send made by hand first' in show_pending(by_hand), True)
        check('pending: the real WORKBENCH lines of 12 October are read, while it keeps them',
              bool(hand_made('904658db-4df2-4537-a0ed-ebe93e081db7', 'long')) or 'teleprompter long' not in WORKBENCH.read_text(encoding='utf-8'), True)

    # A failed send waits six hours, unless its words changed or --retry.
    at = datetime(2026, 10, 12, 15, 0, tzinfo=timezone.utc)
    rec = {'script_check': {'passed': True, 'changed_at': {'long': '2026-10-12T09:00:00Z'}}}
    entry = lambda when: {'error': 'HTTP 503', 'failed_at': when, 'sent_at': '2026-10-12T08:00:00Z'}
    check('held back: a failure an hour ago', 'tried again 6 hours after it' in (held_back(rec, 'long', entry('2026-10-12T14:00:00Z'), at) or ''), True)
    check('held back: a failure seven hours ago is sent again', held_back(rec, 'long', entry('2026-10-12T08:00:00Z'), at), None)
    check('held back: words changed since the failure are always sent',
          held_back({'script_check': {'changed_at': {'long': '2026-10-12T14:30:00Z'}}}, 'long', entry('2026-10-12T14:00:00Z'), at), None)

    if fails:
        print('teleprompter self-test FAILED:\n  ' + '\n  '.join(fails))
        return 1
    print(f'teleprompter self-test passed: {count} checks')
    return 0


# ---------------------------------------------------------------- main

def main(argv=None, call=None):
    ap = argparse.ArgumentParser(description='Each checked script into Krish\'s teleprompter.com account, and the record of it.')
    ap.add_argument('what', nargs='?', choices=['plan', 'record', 'pending'])
    ap.add_argument('args', nargs='*')
    ap.add_argument('--post', metavar='POST_JSON', help='with plan: the post.json naming the piece (default: the one in docs/plans)')
    ap.add_argument('--week', help='with pending: a day in the week to start from (default this week)')
    ap.add_argument('--retry', action='store_true', help='with pending: list a cut held back after a failed send too (Krish said go)')
    ap.add_argument('--json', action='store_true', help='with plan and pending: the answer as JSON')
    ap.add_argument('--by', help='with record: who is writing (default as making.py)')
    ap.add_argument('--folder', metavar='ID', help='with record: the folder\'s id, an uppercase UUID')
    ap.add_argument('--folder-name', metavar='NAME', help='with record: the folder\'s name')
    ap.add_argument('--script', metavar='ID', help='with record: the script\'s id, an uppercase UUID')
    ap.add_argument('--sha', metavar='SHA256', help='with record: the sha256 of the words sent (making.py script_hash of the file)')
    ap.add_argument('--title', metavar='TITLE', help='with record: the script\'s title')
    ap.add_argument('--sent-at', metavar='TIME', help='with record: when it was sent (default now)')
    ap.add_argument('--error', metavar='TEXT', help='with record: what Teleprompter said when the send failed')
    ap.add_argument('--self-test', action='store_true')
    a = ap.parse_args(argv)
    if a.self_test:
        return self_test()
    if not a.what:
        ap.error('say what to do: plan, record or pending')
    try:
        if a.what == 'plan':
            if len(a.args) != 3:
                ap.error('plan PIECE long.md short.md')
            cfg = load_config()
            p = plan(a.args[0], a.args[1:], call, cfg, post_path=a.post)
            print(json.dumps(p, indent=1, ensure_ascii=False) if a.json else show_plan(p, cfg))
        elif a.what == 'record':
            if len(a.args) != 2:
                ap.error('record PIECE CUT --folder ID --script ID --sha SHA256, or --error TEXT')
            by = making.who(a.by)
            data = record(a.args[0], a.args[1], a, call, by)
            for line in making.teleprompter_lines(data.get('making') or {}):
                print(line)
        else:
            found = pending(call, week_monday(a.week), retry=a.retry)
            print(json.dumps(found, indent=1, ensure_ascii=False) if a.json else show_pending(found))
    except (making.MakingError, OSError) as error:
        print(f'teleprompter: {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
