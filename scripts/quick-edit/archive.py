#!/usr/bin/env python3
"""File finished videos in the archive, in a folder whose name says the date,
what the video is about and where to post it.

Krish, 2026-10-06: "Can you ensure all videos are always archived properly in
folder with date/subject/where I can post it in the folder name?"

    2026-10-05 Who gets paid (post to YouTube, Substack, Shorts, Reels, LinkedIn)
        Who gets paid - wide 16x9 - YouTube, Substack.mp4
        Who gets paid - tall 9x16 - Shorts, Reels, LinkedIn.mp4
        share/     the same videos under the 30 MiB chat limit, when there are any
        where-to-post.txt

The Studio files its approved packages by the same rule
(packages/core/src/archive-naming.ts). Both are tested against every case in
config/archive-naming.cases.json, so the two cannot drift: change the rule
there first, then in both.

It copies. It never moves or deletes a video, and never writes into a folder
that exists: a second archive of the same piece gets " (2)" on the end.

File videos you already have:

    python archive.py --subject "Who gets paid" --date 2026-10-05 --tall X.mp4 --wide Y.mp4 [--package package.json] [ROOT]

ROOT defaults to MINDMAKE_ARCHIVE_ROOT, the archive the Studio uses. A share
copy is picked up from a `share` folder beside each video, as make.py writes
it. `make.py --archive` does all this after a render. Check the rule with:

    python archive.py --self-test
"""
import argparse
import json
import os
import re
import sys
import tempfile
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

PLACES = ('YouTube', 'Substack', 'Shorts', 'Reels', 'TikTok', 'LinkedIn')
TALL = ('Shorts', 'Reels', 'LinkedIn')  # where a tall 9:16 video goes
TALL_WITH_TIKTOK = ('Shorts', 'Reels', 'TikTok', 'LinkedIn')  # with "tiktok": true
WIDE = ('YouTube', 'Substack')  # where a wide 16:9 video goes
FOLDER_MAX = 150  # Windows stops a whole path at 260 by default; the Drive archive takes about 70
COPY_MAX = 999
TIME_ZONE = 'Europe/London'  # Krish's clock: the day a video was archived is the day in London
SHAPES = {'tall': 'tall 9x16', 'wide': 'wide 16x9'}
IN_FULL = {'Shorts': 'Shorts (YouTube Shorts)', 'Reels': 'Reels (Instagram Reels)'}
CASES = Path(__file__).resolve().parents[2] / 'config' / 'archive-naming.cases.json'

# Control characters and every kind of space become a plain space, so a line
# break between two words keeps them apart. Spelled out, here and in the
# TypeScript, because the two languages disagree on what \s means.
SPACE_LIKE = re.compile('[\x00-\x1f\x7f-\x9f\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]')
UNSAFE = re.compile(r'[<>:"/\\|?*]')  # what Windows refuses in a name


class ArchiveError(ValueError):
    """A reason to stop, in words a person can act on."""


# The naming rule. Every function here has a twin in archive-naming.ts.

def safe_text(text):
    """The text with everything a Windows or Drive name cannot hold taken out."""
    text = UNSAFE.sub('', SPACE_LIKE.sub(' ', text))
    text = re.sub(' {2,}', ' ', text).strip(' ')
    return re.sub(r'[. ]+\Z', '', text)


def places(names):
    """The places, each once, in the fixed order. Capitals do not matter."""
    by_name = {place.lower(): place for place in PLACES}
    chosen = set()
    for raw in names:
        place = by_name.get(SPACE_LIKE.sub(' ', raw).strip(' ').lower())
        if not place:
            raise ArchiveError(f'"{raw}" is not a place to post: use YouTube, Substack, Shorts, Reels, TikTok or LinkedIn')
        chosen.add(place)
    if not chosen:
        raise ArchiveError('a video needs at least one place to post it')
    return [place for place in PLACES if place in chosen]


def where(names):
    return ', '.join(places(names))


def check_date(value):
    """Refuses anything but a real calendar date written YYYY-MM-DD."""
    match = re.fullmatch(r'([0-9]{4})-([0-9]{2})-([0-9]{2})', value) if isinstance(value, str) else None
    try:
        if match:
            date(int(match[1]), int(match[2]), int(match[3]))
            return value
    except ValueError:
        pass
    raise ArchiveError(f'"{value}" is not a date in the form YYYY-MM-DD')


def london_date(instant):
    """The day in London without the time zone database, which Windows lacks
    unless the tzdata package is installed. Summer time runs from 01:00 world
    time on the last Sunday of March to 01:00 on the last Sunday of October."""
    assert TIME_ZONE == 'Europe/London', 'london_date only knows London'
    instant = instant.astimezone(timezone.utc)

    def last_sunday(month):
        end = date(instant.year, month, 31)
        return end - timedelta(days=(end.weekday() + 1) % 7)
    start = datetime.combine(last_sunday(3), time(1), timezone.utc)
    stop = datetime.combine(last_sunday(10), time(1), timezone.utc)
    return (instant + timedelta(hours=1 if start <= instant < stop else 0)).date().isoformat()


def local_date(instant=None):
    """The day an instant falls on by Krish's clock, as YYYY-MM-DD."""
    instant = instant or datetime.now(timezone.utc)
    try:
        from zoneinfo import ZoneInfo
        return instant.astimezone(ZoneInfo(TIME_ZONE)).date().isoformat()
    except (ImportError, KeyError, OSError, ValueError):
        return london_date(instant)


def _shorten(subject, budget):
    """Cut at the last space that fits, or mid-word when one word is too long,
    with no space, dot, comma, semicolon or dash left at the end."""
    if len(subject) <= budget:
        return subject
    cut = subject[:budget]
    if subject[budget] != ' ':
        space = cut.rfind(' ')
        if space > 0:
            cut = cut[:space]
    return re.sub(r'[ .,;\-\u2013\u2014]+\Z', '', cut) or re.sub(r'[. ]+\Z', '', subject[:budget])


def folder(day, subject, names, copy=1):
    """{'name': '2026-10-05 Who gets paid (post to ...)', 'subject': ...}: at
    most FOLDER_MAX characters, only the subject giving way."""
    check_date(day)
    listed = where(names)
    if not isinstance(copy, int) or isinstance(copy, bool) or copy < 1 or copy > COPY_MAX:
        raise ArchiveError(f'copy must be a whole number from 1 to {COPY_MAX}')
    clean = safe_text(subject)
    if not clean:
        raise ArchiveError('the subject has nothing a folder name can keep')
    suffix = f' ({copy})' if copy > 1 else ''
    budget = FOLDER_MAX - len(f'{day}  (post to {listed}){suffix}')
    kept = _shorten(clean, budget)
    return {'name': f'{day} {kept} (post to {listed}){suffix}', 'subject': kept}


def next_folder(day, subject, names, existing):
    """The first free folder, given the names already there. Capitals are
    ignored, as Windows and Drive ignore them."""
    taken = {name.lower() for name in existing}
    for copy in range(1, COPY_MAX + 1):
        found = folder(day, subject, names, copy)
        if found['name'].lower() not in taken:
            return {**found, 'copy': copy}
    raise ArchiveError(f'the archive already has {COPY_MAX} folders named for this piece')


def file_name(subject, shape, names, extension='mp4'):
    """'Who gets paid - tall 9x16 - Shorts, Reels, LinkedIn.mp4'."""
    clean = safe_text(subject)
    if not clean:
        raise ArchiveError('the subject has nothing a folder name can keep')
    listed = where(names)
    if not re.fullmatch(r'[A-Za-z0-9]{1,8}', extension):
        raise ArchiveError(f'"{extension}" is not a file extension')
    return f'{clean} - {SHAPES[shape]} - {listed}.{extension}'


# Filing the videos.

def video_places(shape, post_to=None, tiktok=False):
    """Where one video goes: the tall one to Shorts, Reels and LinkedIn (and
    TikTok when asked), the wide one to YouTube and Substack. post_to, when
    given, is the whole list, and each video keeps the places it suits."""
    if post_to is None:
        return list(TALL_WITH_TIKTOK if tiktok else TALL) if shape == 'tall' else list(WIDE)
    suits = TALL_WITH_TIKTOK if shape == 'tall' else WIDE
    return [place for place in places(post_to) if place in suits]


def long_path(path):
    """Windows stops a path at 260 characters unless it starts \\\\?\\."""
    path = os.path.abspath(path)
    if os.name == 'nt' and not path.startswith('\\\\?\\'):
        return '\\\\?\\UNC\\' + path[2:] if path.startswith('\\\\') else '\\\\?\\' + path
    return path


def copy_new(src, dst):
    """Copies src to dst. Refuses to write over anything."""
    os.makedirs(long_path(dst.parent), exist_ok=True)
    with open(long_path(src), 'rb') as source, open(long_path(dst), 'xb') as target:
        while True:
            block = source.read(1024 * 1024)
            if not block:
                break
            target.write(block)


def read_package(path):
    """The YouTube and Substack words from the engine's package step: its
    saved answer (scripts/engine.py ... /package --full, with or without the
    status line it prints first), the answer's `package`, or the stored
    `youtube_package`."""
    text = Path(path).read_text(encoding='utf-8-sig')
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        try:
            data = json.JSONDecoder().raw_decode(text[text.index('{'):])[0]
        except ValueError:
            raise ArchiveError(f'{path} is not JSON. Save the engine\'s answer whole: scripts/engine.py prints only the start of it without --full.')
    for key in ('package', 'youtube_package'):
        if isinstance(data, dict) and isinstance(data.get(key), dict):
            data = data[key]
    fields = ('title', 'description', 'substack_title', 'substack_subtitle')
    if not isinstance(data, dict) or not any(isinstance(data.get(key), str) and data[key].strip() for key in fields):
        raise ArchiveError(f'{path} has no title, description or Substack title: give it the output of the engine\'s package step')
    return data


def where_to_post(subject, day, date_from, post_to, files, words, has_share):
    lines = [
        subject,
        f'Date: {day} ({"the publish date" if date_from == "publish_date" else "the day it was archived, London time"})',
        f'Post to: {", ".join(post_to)}',
        '',
        'Nothing in this folder has been posted. Each video is posted by hand, with the words below.',
        '',
        'THE VIDEOS',
    ]
    for item in files:
        lines += [f'- {item["file"]}', f'  Post to {", ".join(IN_FULL.get(p, p) for p in item["post_to"])}.']
    if has_share:
        lines += ['', 'The share folder holds smaller copies, under the 30 MiB a chat upload allows. '
                      'Post the full-size videos; send the smaller ones when you share a copy in a chat.']
    if not words:
        lines += ['', 'No titles or descriptions were given. The engine writes them in its package step for the piece '
                      '(python3 scripts/engine.py POST /api/content-ideas/<id>/package @body.json --full). Paste them in '
                      'here, or save that answer to a file and give it with --package when you archive.']
        return '\n'.join(lines) + '\n'
    text = lambda key: words.get(key).strip() if isinstance(words.get(key), str) else ''
    youtube = [f'Title: {text("title")}'] if text('title') else []
    others = [a.get('title', '').strip() for a in words.get('alternates') or [] if isinstance(a, dict) and isinstance(a.get('title'), str) and a['title'].strip()]
    if others:
        youtube += ['Other titles:'] + [f'- {title}' for title in others]
    if text('description'):
        youtube += ['Description:', text('description')]
    if youtube:
        lines += ['', 'YOUTUBE'] + youtube
    substack = [f'Title: {text("substack_title")}'] if text('substack_title') else []
    if text('substack_subtitle'):
        substack += [f'Subtitle: {text("substack_subtitle")}']
    if substack:
        lines += ['', 'SUBSTACK'] + substack
    return '\n'.join(lines) + '\n'


def plan(subject, shapes, day=None, post_to=None, tiktok=False, now=None):
    """Everything that can be checked before a video exists: the date, the
    subject, where each shape goes, and the folder and file names. make.py
    runs it before rendering, so a bad setting stops the run in seconds."""
    when = check_date(day) if day else local_date(now)
    if not shapes:
        raise ArchiveError('nothing to archive: give a tall video, a wide video or both')
    videos = []
    for shape in shapes:
        goes = video_places(shape, post_to, tiktok)
        if not goes:
            raise ArchiveError(f'post_to leaves the {SHAPES[shape]} video with nowhere to go: '
                               f'it suits {", ".join(TALL_WITH_TIKTOK if shape == "tall" else WIDE)}')
        videos.append({'shape': shape, 'post_to': goes})
    every = places([place for item in videos for place in item['post_to']])
    if post_to is not None:
        missing = [place for place in places(post_to) if place not in every]
        if missing:
            raise ArchiveError(f'post_to names {", ".join(missing)}, but no video here is for it: '
                               f'YouTube and Substack take the wide video, the rest the tall one')
    videos.sort(key=lambda item: PLACES.index(item['post_to'][0]))
    named = folder(when, subject, every)
    for item in videos:
        item['file'] = file_name(named['subject'], item['shape'], item['post_to'])
    return {'folder': named['name'], 'date': when, 'date_from': 'publish_date' if day else 'archive_day',
            'post_to': every, 'videos': videos}


def archive_videos(root, subject, tall=None, wide=None, day=None, tall_share=None, wide_share=None,
                   package=None, post_to=None, tiktok=False, now=None, find_shares=True):
    """Copies finished videos into a new folder under root, named by the rule,
    with their share copies and a where-to-post.txt. A share copy is the one
    given, or with find_shares the file of the same name in a `share` folder
    beside the video. Returns what it did."""
    sources = {shape: Path(src) for shape, src in (('tall', tall), ('wide', wide)) if src}
    planned = plan(subject, list(sources), day, post_to, tiktok, now)
    for src in sources.values():
        if not src.is_file():
            raise ArchiveError(f'{src} is not a file')
    shares = {}
    for shape, given in (('tall', tall_share), ('wide', wide_share)):
        if shape not in sources:
            continue
        share = Path(given) if given else sources[shape].parent / 'share' / sources[shape].name
        if given and not share.is_file():
            raise ArchiveError(f'{share} is not a file')
        if share.is_file() and (given or find_shares):
            shares[shape] = share
    root = Path(root)
    if not root.is_dir():
        raise ArchiveError(f'the archive folder {root} does not exist: check the path, and that Google Drive is running if it is on Drive')
    words = read_package(package) if package else None

    when, every = planned['date'], planned['post_to']
    raced = set()
    for _ in range(COPY_MAX + 1):
        chosen = next_folder(when, subject, every, os.listdir(long_path(root)) + sorted(raced))
        try:
            os.mkdir(long_path(root / chosen['name']))
            break
        except FileExistsError:
            raced.add(chosen['name'])
    else:
        raise ArchiveError(f'the archive already has {COPY_MAX} folders named for this piece')
    dest = root / chosen['name']
    files = []
    for item in planned['videos']:
        shape = item['shape']
        name = file_name(chosen['subject'], shape, item['post_to'])
        copy_new(sources[shape], dest / name)
        if shape in shares:
            copy_new(shares[shape], dest / 'share' / name)
        files.append({'file': name, 'post_to': item['post_to'], 'from': str(sources[shape]),
                      **({'share': str(Path('share') / name)} if shape in shares else {})})
    heading = re.sub(r'\s+', ' ', subject).strip()
    with open(long_path(dest / 'where-to-post.txt'), 'x', encoding='utf-8', newline='\n') as out:
        out.write(where_to_post(heading, when, planned['date_from'], every, files, words, bool(shares)))
    return {'folder': chosen['name'], 'path': str(dest), 'subject': chosen['subject'], 'date': when,
            'date_from': planned['date_from'], 'post_to': every, 'files': files}


def archive_root(given=None):
    """The archive folder: the one given, else MINDMAKE_ARCHIVE_ROOT."""
    root = given or os.environ.get('MINDMAKE_ARCHIVE_ROOT', '').strip()
    if not root:
        raise ArchiveError('no archive folder: give one, or set MINDMAKE_ARCHIVE_ROOT '
                           '(the archive the Studio uses, on Drive)')
    return root


# The shared cases.

def self_test(cases_path=CASES):
    cases = json.loads(Path(cases_path).read_text(encoding='utf-8'))
    failures, count = [], 0

    def check(label, got, want):
        nonlocal count
        count += 1
        if got != want:
            failures.append(f'{label}: got {got!r}, want {want!r}')

    def refused(label, run, want):
        nonlocal count
        count += 1
        try:
            got = run()
        except ArchiveError as error:
            if want not in str(error):
                failures.append(f'{label}: refused with {str(error)!r}, want {want!r}')
            return
        failures.append(f'{label}: gave {got!r}, want a refusal containing {want!r}')

    check('places', list(PLACES), cases['places'])
    check('folder_max', FOLDER_MAX, cases['folder_max'])
    check('copy_max', COPY_MAX, cases['copy_max'])
    check('time_zone', TIME_ZONE, cases['time_zone'])
    check('quick_edit tall', list(TALL), cases['quick_edit']['tall'])
    check('quick_edit tall_with_tiktok', list(TALL_WITH_TIKTOK), cases['quick_edit']['tall_with_tiktok'])
    check('quick_edit wide', list(WIDE), cases['quick_edit']['wide'])
    check('default tall places', video_places('tall'), cases['quick_edit']['tall'])
    check('tall places with TikTok', video_places('tall', tiktok=True), cases['quick_edit']['tall_with_tiktok'])
    check('default wide places', video_places('wide'), cases['quick_edit']['wide'])
    for item in cases['folders']:
        run = lambda item=item: folder(item['date'], item['subject'], item['places'], item.get('copy', 1))
        if 'error' in item:
            refused(f'folder: {item["why"]}', run, item['error'])
            continue
        got = run()
        check(f'folder: {item["why"]}', got['name'], item['folder'])
        check(f'folder subject: {item["why"]}', got['subject'], item['subject_used'])
        check(f'folder length: {item["why"]}', len(got['name']) <= cases['folder_max'], True)
    for item in cases['files']:
        run = lambda item=item: file_name(item['subject'], item['shape'], item['places'])
        if 'error' in item:
            refused(f'file: {item["why"]}', run, item['error'])
        else:
            check(f'file: {item["why"]}', run(), item['file'])
    for item in cases['existing']:
        got = next_folder(item['date'], item['subject'], item['places'], item['existing'])
        check(f'already exists: {item["why"]}', got['name'], item['folder'])
    for item in cases['dates']:
        instant = datetime.fromisoformat(item['instant'].replace('Z', '+00:00'))
        check(f'date: {item["why"]}', local_date(instant), item['date'])
        check(f'date without the time zone database: {item["why"]}', london_date(instant), item['date'])

    # The filing itself, on two small stand-in files: a second run makes " (2)"
    # and leaves the first folder and the originals exactly as they were.
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        (tmp / 'out' / 'share').mkdir(parents=True)
        (tmp / 'archive').mkdir()
        for name, body in (('v-9x16.mp4', b'tall'), ('v-16x9.mp4', b'wide'), ('share/v-9x16.mp4', b'tall share')):
            (tmp / 'out' / name).write_bytes(body)
        first = archive_videos(tmp / 'archive', 'Who gets paid', tall=tmp / 'out' / 'v-9x16.mp4', wide=tmp / 'out' / 'v-16x9.mp4', day='2026-10-05')
        second = archive_videos(tmp / 'archive', 'Who gets paid', tall=tmp / 'out' / 'v-9x16.mp4', wide=tmp / 'out' / 'v-16x9.mp4', day='2026-10-05')
        launch = cases['folders'][0]['folder']
        check('filed folder', first['folder'], launch)
        check('filed again', second['folder'], f'{launch} (2)')
        check('filed contents', sorted(str(p.relative_to(tmp / 'archive' / launch)) for p in (tmp / 'archive' / launch).rglob('*')), sorted([
            'Who gets paid - tall 9x16 - Shorts, Reels, LinkedIn.mp4', 'Who gets paid - wide 16x9 - YouTube, Substack.mp4',
            'share', str(Path('share') / 'Who gets paid - tall 9x16 - Shorts, Reels, LinkedIn.mp4'), 'where-to-post.txt']))
        check('filed copy', (tmp / 'archive' / launch / 'share' / 'Who gets paid - tall 9x16 - Shorts, Reels, LinkedIn.mp4').read_bytes(), b'tall share')
        check('originals kept', sorted(p.read_bytes() for p in (tmp / 'out').rglob('*.mp4')), [b'tall', b'tall share', b'wide'])
        count += 1
        try:
            copy_new(tmp / 'out' / 'v-16x9.mp4', tmp / 'out' / 'v-9x16.mp4')
            failures.append('copy_new wrote over a file that was there')
        except FileExistsError:
            pass
    return count, failures


def main():
    ap = argparse.ArgumentParser(description='File finished videos in the archive, named by date, subject and where to post them.')
    ap.add_argument('root', nargs='?', help='the archive folder (default: MINDMAKE_ARCHIVE_ROOT)')
    ap.add_argument('--subject', help='the piece\'s short title, as it should read: "Who gets paid"')
    ap.add_argument('--date', help='the publish date, YYYY-MM-DD (default: today, London time)')
    ap.add_argument('--tall', help='the tall 9:16 video')
    ap.add_argument('--wide', help='the wide 16:9 video')
    ap.add_argument('--tall-share', help='its share copy (default: share/<same name> beside it, if there)')
    ap.add_argument('--wide-share', help='its share copy (default: share/<same name> beside it, if there)')
    ap.add_argument('--no-share', action='store_true', help='leave out the share copies beside the videos')
    ap.add_argument('--package', help='the engine\'s package answer, for the YouTube and Substack words')
    ap.add_argument('--post-to', help='every place, comma separated, instead of the usual ones: "YouTube, LinkedIn"')
    ap.add_argument('--tiktok', action='store_true', help='the tall video goes to TikTok too')
    ap.add_argument('--self-test', action='store_true', help='check the rule against config/archive-naming.cases.json')
    a = ap.parse_args()
    if a.self_test:
        count, failures = self_test()
        if failures:
            print('\n'.join(failures), file=sys.stderr)
            sys.exit(f'archive naming self-test failed: {len(failures)} of {count} checks')
        print(f'archive naming self-test passed: {count} checks')
        return
    if not a.subject:
        ap.error('--subject is required: the piece\'s short title, as it should read')
    try:
        post_to = [part for part in a.post_to.split(',') if part.strip()] if a.post_to is not None else None
        result = archive_videos(archive_root(a.root), a.subject, tall=a.tall, wide=a.wide, day=a.date,
                                tall_share=a.tall_share, wide_share=a.wide_share, package=a.package,
                                post_to=post_to, tiktok=a.tiktok, find_shares=not a.no_share)
    except ArchiveError as error:
        sys.exit(f'archive: {error}')
    print(json.dumps(result, indent=1))


if __name__ == '__main__':
    main()
