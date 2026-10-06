"""library: the rules of Krish's makeyourmindup asset library, shared by
build.py and send.py.

Krish, 2026-10-06: "I want every single asset in there, permanent and for
individual posts, categorized properly, clear what to use them for, and every
new post gets its own new folder with all assets including the article HTML I
can copy paste, video scripts, etc etc".

    makeyourmindup/
        1 Brand kit (permanent)/
        2 Channel art (permanent)/
        3 Posts/
            2026-10-05 Mon follow.the.money - Who gets paid/
                READ ME.txt
                1 Article/  2 Covers and images/  3 Video/  4 Social/

The path rule is the engine's boundary for what may reach that folder. It is
written once as cases in config/library-paths.cases.json, implemented here and
in apps/control-plane/api/library/_library.ts, and both are tested against
every case (`python build.py --self-test` and the vitest suite), so the two
cannot drift. Change a case there first, then both.

Names are made Windows-safe by scripts/quick-edit/archive.py's own rule
(safe_text, and its way of shortening a subject), reused here, never copied.
"""
import json
import re
import sys
import unicodedata
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
CASES = ROOT / 'config' / 'library-paths.cases.json'
sys.path.insert(0, str(ROOT / 'scripts' / 'quick-edit'))
sys.path.insert(0, str(ROOT / 'scripts' / 'pages'))
import archive  # noqa: E402  the archive naming rule: safe_text, _shorten, file_name
import brand  # noqa: E402  the house style: the live subchannels and their days

BRAND_KIT = '1 Brand kit (permanent)'
CHANNEL_ART = '2 Channel art (permanent)'
POSTS = '3 Posts'
TOP_FOLDERS = (BRAND_KIT, CHANNEL_ART, POSTS)
ARTICLE, COVERS, VIDEO, SOCIAL = POST_SECTIONS = ('1 Article', '2 Covers and images', '3 Video', '4 Social')
POST_README = 'READ ME.txt'
PATH_MAX = 180  # the library root on Windows is about 62 characters; Windows stops a path at 260
PART_MAX = 100
POST_FOLDER_MAX = PART_MAX
MAX_BYTES = 500 * 1024 * 1024  # 500 MiB a file: room for a long 1080p master
WEEKDAYS = ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun')

# The extension decides the type. The engine's bucket allows exactly these.
CONTENT_TYPES = {
    'html': 'text/html', 'md': 'text/markdown', 'txt': 'text/plain', 'csv': 'text/csv',
    'json': 'application/json', 'css': 'text/css',
    'js': 'text/javascript', 'cjs': 'text/javascript', 'mjs': 'text/javascript',
    'pdf': 'application/pdf',
    'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'webp': 'image/webp',
    'gif': 'image/gif', 'svg': 'image/svg+xml',
    'ttf': 'font/ttf', 'otf': 'font/otf', 'woff': 'font/woff', 'woff2': 'font/woff2',
    'mp4': 'video/mp4', 'mov': 'video/quicktime', 'webm': 'video/webm',
    'mp3': 'audio/mpeg', 'm4a': 'audio/mp4', 'wav': 'audio/wav',
    'srt': 'application/x-subrip', 'vtt': 'text/vtt', 'zip': 'application/zip',
}

WINDOWS_UNSAFE = re.compile(r'[<>:"\\|?*]')
CONTROL = re.compile('[\x00-\x1f\x7f-\x9f]')
RESERVED = re.compile(r'(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?', re.I)


class LibraryError(ValueError):
    """A reason to stop, in words a person can act on."""


def subchannels():
    """The live subchannels as the brand writes them, in the order of the
    week, from the house style in config/studio.json."""
    return [channel['name'] for channel in brand.house()['channels']]


def subchannel_name(value):
    """'follow.the.money' from 'follow.the.money', 'follow_the_money' or any capitals."""
    wanted = str(value or '').strip().lower().replace('_', '.')
    for name in subchannels():
        if name == wanted:
            return name
    raise LibraryError(f'"{value}" is not a subchannel: use {", ".join(subchannels())}')


def utf16_length(text):
    """Length as Windows counts a path, and as the engine's TypeScript does."""
    return len(text.encode('utf-16-le')) // 2


def _post_folder_pattern():
    names = '|'.join(re.escape(name) for name in subchannels())
    return re.compile(rf'([0-9]{{4}})-([0-9]{{2}})-([0-9]{{2}}) (?:({"|".join(WEEKDAYS)}) ({names})|Launch) - \S.*', re.S)


def is_post_folder(name):
    """'2026-10-05 Mon follow.the.money - Who gets paid' or
    '2026-10-05 Launch - Hello': a real date, and the day it fell on."""
    match = _post_folder_pattern().fullmatch(name)
    if not match:
        return False
    try:
        day = date(int(match[1]), int(match[2]), int(match[3]))
    except ValueError:
        return False
    return match[4] is None or match[4] == WEEKDAYS[day.weekday()]


def refusal(path):
    """None when the path may go into the library, else the engine's reason code."""
    if not isinstance(path, str) or not path:
        return 'path_not_text'
    if utf16_length(path) > PATH_MAX:
        return 'path_too_long'
    if unicodedata.normalize('NFC', path) != path:
        return 'path_not_nfc'
    if '\\' in path:
        return 'path_backslash'
    if path.startswith('/') or re.match(r'[A-Za-z]:', path):
        return 'path_absolute'
    parts = path.split('/')
    for part in parts:
        if not part:
            return 'path_empty_part'
        if part in ('.', '..'):
            return 'path_escapes_library'
        if part.startswith('.'):
            return 'path_hidden_part'
        if CONTROL.search(part) or WINDOWS_UNSAFE.search(part):
            return 'path_unsafe_character'
        if part.startswith(' ') or part.endswith(' ') or part.endswith('.'):
            return 'path_part_edge'
        if RESERVED.fullmatch(part):
            return 'path_reserved_name'
        if utf16_length(part) > PART_MAX:
            return 'path_part_too_long'
    if parts[0] not in TOP_FOLDERS:
        return 'path_wrong_top_folder'
    if parts[0] == POSTS:
        if len(parts) < 3:
            return 'path_no_file'
        if not is_post_folder(parts[1]):
            return 'path_post_folder_invalid'
        inside = parts[2:]
        if not (inside == [POST_README] if len(inside) == 1 else inside[0] in POST_SECTIONS):
            return 'path_post_section_invalid'
    elif len(parts) < 2:
        return 'path_no_file'
    name = parts[-1]
    extension = name.rsplit('.', 1)[1].lower() if name.rfind('.') > 0 else ''
    if extension not in CONTENT_TYPES:
        return 'path_type_not_allowed'
    return None


# What each refusal means, for a person reading send.py's or build.py's output.
REFUSALS = {
    'path_not_text': 'the path is empty',
    'path_too_long': f'the path is longer than {PATH_MAX} characters, which Windows may not open',
    'path_not_nfc': 'an accented letter is written in two pieces; retype it',
    'path_backslash': 'it uses a backslash; library paths use forward slashes',
    'path_absolute': 'it starts at a drive or the root; give a path inside the library',
    'path_empty_part': 'it has an empty folder name (two slashes together, or one at the end)',
    'path_escapes_library': 'it has a "." or ".." folder, which would leave the library',
    'path_hidden_part': 'a name starts with a dot, which hides it',
    'path_unsafe_character': 'a name holds a character Windows refuses (< > : " \\ | ? *) or a control character',
    'path_part_edge': 'a name starts or ends with a space, or ends with a dot',
    'path_reserved_name': 'a name is one Windows keeps for itself (CON, PRN, AUX, NUL, COM1, LPT1 and the like)',
    'path_part_too_long': f'a name is longer than {PART_MAX} characters',
    'path_wrong_top_folder': f'it is outside "{BRAND_KIT}", "{CHANNEL_ART}" and "{POSTS}"',
    'path_no_file': 'it names a folder, and a file is needed',
    'path_post_folder_invalid': 'the post folder is not named "YYYY-MM-DD Day subchannel - Subject" (or "YYYY-MM-DD Launch - Subject") with the day the date fell on',
    'path_post_section_invalid': f'inside a post folder a file goes in {", ".join(POST_SECTIONS)}, or is the {POST_README}',
    'path_type_not_allowed': 'the library does not take this kind of file',
}


def explain(code):
    return REFUSALS.get(code, code)


def content_type(path):
    return CONTENT_TYPES[path.rsplit('.', 1)[1].lower()]


def post_folder(when, subject, subchannel=None, launch=False, day=None):
    """The post's folder name: 'YYYY-MM-DD Mon follow.the.money - Who gets paid',
    or 'YYYY-MM-DD Launch - Hello' for a launch post. The day is the one the
    date fell on; a day given that does not match is refused. The subject is
    made safe by archive.py's rule and cut short, at a space, to fit."""
    try:
        archive.check_date(when)
    except archive.ArchiveError as error:
        raise LibraryError(str(error))
    weekday = WEEKDAYS[date.fromisoformat(when).weekday()]
    if day is not None and str(day)[:3].title() != weekday:
        raise LibraryError(f'{when} was a {brand.WEEK[WEEKDAYS.index(weekday)]}, so its day is {weekday}, not {day}')
    if launch and subchannel:
        raise LibraryError('a launch post has no subchannel in its folder name: leave subchannel out, or launch')
    if not launch and not subchannel:
        raise LibraryError('a post needs its subchannel (follow.the.money, mind.the.gap or under.the.hood), or "launch": true')
    head = f'{when} Launch - ' if launch else f'{when} {weekday} {subchannel_name(subchannel)} - '
    clean = archive.safe_text(subject or '')
    if not clean:
        raise LibraryError('the subject has nothing a folder name can keep')
    kept = archive._shorten(clean, POST_FOLDER_MAX - len(head))
    return head + kept


def read_cases(path=CASES):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def check_cases(cases):
    """The rule against config/library-paths.cases.json: (count, failures)."""
    failures, count = [], 0

    def check(label, got, want):
        nonlocal count
        count += 1
        if got != want:
            failures.append(f'{label}: got {got!r}, want {want!r}')

    check('top folders', list(TOP_FOLDERS), cases['top_folders'])
    check('post sections', list(POST_SECTIONS), cases['post_sections'])
    check('post readme', POST_README, cases['post_readme'])
    check('path max', PATH_MAX, cases['path_max'])
    check('part max', PART_MAX, cases['part_max'])
    check('max bytes', MAX_BYTES, cases['max_bytes'])
    check('content types', CONTENT_TYPES, cases['content_types'])
    check('subchannels', sorted(subchannels()), sorted(cases['subchannels']))
    for item in cases['paths']:
        check(f'path: {item["why"]}', refusal(item['path']), item.get('refused'))
    for item in cases['post_folders']:
        label = f'post folder: {item["why"]}'
        try:
            got = post_folder(item['date'], item['subject'], item.get('subchannel'), item.get('launch', False), item.get('day'))
        except LibraryError as error:
            count += 1
            if 'error' not in item or item['error'] not in str(error):
                failures.append(f'{label}: refused with {str(error)!r}, want {item.get("folder", item.get("error"))!r}')
            continue
        if 'error' in item:
            count += 1
            failures.append(f'{label}: gave {got!r}, want a refusal containing {item["error"]!r}')
            continue
        check(label, got, item['folder'])
        check(f'{label} (a library path)', refusal(f'{POSTS}/{got}/{POST_README}'), None)
    return count, failures
