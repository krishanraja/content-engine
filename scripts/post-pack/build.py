#!/usr/bin/env python3
"""post-pack: one post's launch set, sorted into the folder it gets in Krish's
makeyourmindup asset library, with a READ ME that says what every file is for.

Krish, 2026-10-06: "I want every single asset in there, permanent and for
individual posts, categorized properly, clear what to use them for, and every
new post gets its own new folder with all assets including the article HTML I
can copy paste, video scripts, etc etc".

    python build.py post.json [--out DIR] [--replace]
    python build.py --self-test

post.json names the post and its files (README.md has every field):

    {"date": "2026-10-05", "subchannel": "follow.the.money", "subject": "Who gets paid",
     "links": {"Substack": "https://..."},
     "files": [{"kind": "substack-copy", "file": "out/substack.html"},
               {"kind": "video", "shape": "tall", "file": "out/who-gets-paid-9x16.mp4"},
               {"category": "social", "file": "img/quote.png", "purpose": "..."}]}

It writes DIR/<post folder>/, by default under .cache/post-pack/ (git ignores
it), named `YYYY-MM-DD Mon follow.the.money - Who gets paid` (a launch post is
`YYYY-MM-DD Launch - <Subject>`):

    READ ME.txt              every file, what it is for and where it goes
    1 Article/               substack-copy.html, web-page.html, the text that passed the fact check, the email with pictures off
    2 Covers and images/     the cover, the pictures in the post, share cards
    3 Video/                 the script, the YouTube and Substack words, the finished videos
    4 Social/                the LinkedIn post and its card

Then `send.py` sends the folder to the engine, and Krish's always-on machine
writes it into the library on Drive (README.md). Nothing here touches Drive.
It copies; the files it was given stay where they are.
"""
import argparse
import hashlib
import json
import re
import shutil
import sys
import tempfile
from datetime import date, datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import library  # noqa: E402
from library import ARTICLE, COVERS, POST_README, POSTS, SOCIAL, VIDEO, LibraryError, archive, brand  # noqa: E402

DEFAULT_OUT = library.ROOT / '.cache' / 'post-pack'
MANIFEST = '.pack.json'  # what send.py reads: every file and its purpose. A dot keeps it out of the library.
SECTION_NAMES = {'article': ARTICLE, 'covers': COVERS, 'images': COVERS, 'video': VIDEO, 'social': SOCIAL}
for _section in library.POST_SECTIONS:
    SECTION_NAMES[_section.lower()] = _section

# Every kind of file a post's launch set holds: its section, the name it gets
# (None keeps the file's own name) and what it is for, in words Krish reads.
KINDS = {
    'substack-copy': (ARTICLE, 'substack-copy.html',
                      'Paste into Substack: open it on a computer, press Copy title, Copy subtitle and Copy post in turn, '
                      "and paste each into Substack's editor. The pictures go with the words."),
    'web-page': (ARTICLE, 'web-page.html',
                 'The piece as its branded web page, in one file with its fonts and pictures inside. '
                 'Open it in a browser to read or share it.'),
    'fact-checked-text': (ARTICLE, 'text-that-passed-the-fact-check.md',
                          'The exact words that passed the fact check. If a word changes, the check has to run again.'),
    'email-pictures-off': (ARTICLE, 'email-pictures-off.html',
                           'The email as Outlook and many work inboxes first show it, with every picture hidden. '
                           'Read it before publishing: a point that lives only in a picture is lost there.'),
    'cover': (COVERS, 'substack-cover-3x2.png',
              "The post's cover. Upload it in Substack's post settings, as the cover image."),
    'cover-crops': (COVERS, 'cover-crops.png',
                    "What Substack's feed, share card and archive each show of the cover. For checking; it is never posted."),
    'phone-check': (COVERS, 'phone-images.png',
                    "Every picture in the post at a phone's width. For checking; it is never posted."),
    'image': (COVERS, None,
              'A picture in the article. The Substack copy already holds it in place; use this file to post it anywhere else.'),
    'share-card': (COVERS, None, 'A card for sharing the post on social media and in messages.'),
    'video-script': (VIDEO, 'video-script', 'The script to record the video from.'),
    'video-words': (VIDEO, 'youtube-and-substack-words.txt',
                    'The YouTube title and description, and the Substack title and subtitle, ready to paste.'),
    'video': (VIDEO, None, None),  # named and described by the archive rule, below
    'captions': (VIDEO, None, 'Captions for the video. Upload them with it wherever the platform takes a captions file.'),
    'linkedin-post': (SOCIAL, 'linkedin-post.txt', 'The LinkedIn post. Paste it into LinkedIn as the post text.'),
    'linkedin-card': (SOCIAL, 'linkedin-card', 'The picture for the LinkedIn post. Attach it to the post.'),
}
TEXT_KINDS = {'linkedin-post', 'video-script', 'fact-checked-text'}  # may be given as "text" in place of "file"
SHARE_PURPOSE = 'A smaller copy of the video, under the 30 MiB a chat upload allows, for sending in a chat. Post the full-size one.'


class PackError(ValueError):
    """A reason to stop, in words a person can act on."""


def sha256_of(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def long_date(iso):
    day = date.fromisoformat(iso)
    return f'{brand.WEEK[day.weekday()]} {day.day} {day.strftime("%B")} {day.year}'


def safe_name(name):
    """A file name made safe by the archive rule, keeping its extension."""
    stem, dot, extension = name.rpartition('.')
    if not dot or not stem:
        raise PackError(f'"{name}" has no file type at the end (such as .png)')
    clean = archive.safe_text(stem)
    if not clean:
        raise PackError(f'"{name}" has nothing a file name can keep')
    return f'{clean}.{extension.lower()}'


def words_text(package_path):
    """The engine's package answer as text to paste: the YouTube title, other
    titles and description, and the Substack title and subtitle."""
    try:
        words = archive.read_package(package_path)
    except archive.ArchiveError as error:
        raise PackError(str(error))
    text = lambda key: words.get(key).strip() if isinstance(words.get(key), str) else ''
    lines = []
    if text('title') or text('description'):
        lines += ['YOUTUBE']
        if text('title'):
            lines += [f'Title: {text("title")}']
        others = [a['title'].strip() for a in words.get('alternates') or []
                  if isinstance(a, dict) and isinstance(a.get('title'), str) and a['title'].strip()]
        if others:
            lines += ['Other titles:'] + [f'- {title}' for title in others]
        if text('description'):
            lines += ['Description:', text('description')]
    if text('substack_title') or text('substack_subtitle'):
        lines += ([''] if lines else []) + ['SUBSTACK']
        if text('substack_title'):
            lines += [f'Title: {text("substack_title")}']
        if text('substack_subtitle'):
            lines += [f'Subtitle: {text("substack_subtitle")}']
    lines += ['', 'Which titles go up is your choice. Nothing has been posted.']
    return '\n'.join(lines) + '\n'


def plan(post, base):
    """Every file the pack will hold, checked before anything is copied:
    [{'section', 'name', 'purpose', 'source' or 'text'}]."""
    if not isinstance(post, dict):
        raise PackError('the post file must hold one JSON object')
    folder = library.post_folder(post.get('date'), post.get('subject'), post.get('subchannel'),
                                 bool(post.get('launch')), post.get('day'))
    subject = folder.split(' - ', 1)[1]
    entries = post.get('files')
    if not isinstance(entries, list) or not entries:
        raise PackError('"files" must list the files to include')
    planned = []

    def source_of(entry, label):
        raw = entry.get('file')
        if not isinstance(raw, str) or not raw.strip():
            raise PackError(f'{label}: give the "file" to include')
        path = (base / raw).resolve()
        if not path.is_file():
            raise PackError(f'{label}: {path} is not a file')
        return path

    for index, entry in enumerate(entries, 1):
        if not isinstance(entry, dict):
            raise PackError(f'file {index} must be an object')
        kind = entry.get('kind')
        label = f'file {index} ({kind or entry.get("category") or "no kind"})'
        given_purpose = entry.get('purpose')
        if given_purpose is not None:
            if not library_purpose(given_purpose):
                raise PackError(f'{label}: "purpose" must be one line of up to 200 characters')
            given_purpose = given_purpose.strip()
        if kind is not None and kind not in KINDS:
            raise PackError(f'{label}: "{kind}" is not a kind this tool knows; use one of {", ".join(KINDS)}, '
                            'or a "category" with a "purpose"')
        if kind == 'video':
            shape = entry.get('shape')
            if shape not in ('tall', 'wide'):
                raise PackError(f'{label}: a video needs "shape": "tall" (9:16) or "wide" (16:9)')
            source = source_of(entry, label)
            goes = archive.video_places(shape, entry.get('post_to'), bool(entry.get('tiktok')))
            if not goes:
                raise PackError(f'{label}: "post_to" leaves this video nowhere to go')
            extension = source.suffix.lstrip('.').lower() or 'mp4'
            fitted = archive._shorten(subject, library.PART_MAX - len(archive.file_name('x', shape, goes, extension)) + 1)
            name = archive.file_name(fitted, shape, goes, extension)
            purpose = given_purpose or f'The finished {archive.SHAPES[shape]} video. Post it to ' + \
                and_list([archive.IN_FULL.get(place, place) for place in goes]) + '.'
            planned.append({'section': VIDEO, 'name': name, 'purpose': purpose, 'source': source})
            share = entry.get('share')
            if share is not None:
                share_path = (base / share).resolve() if isinstance(share, str) else None
                if not share_path or not share_path.is_file():
                    raise PackError(f'{label}: its "share" copy is not a file')
                planned.append({'section': VIDEO, 'name': f'share/{name}', 'purpose': SHARE_PURPOSE, 'source': share_path})
            continue
        if kind:
            section, fixed, purpose = KINDS[kind]
        else:
            category = str(entry.get('category') or '').strip().lower()
            if category not in SECTION_NAMES:
                raise PackError(f'{label}: give a "kind", or a "category" (article, covers, video or social) with a "purpose"')
            section, fixed, purpose = SECTION_NAMES[category], None, None
        purpose = given_purpose or purpose
        if not purpose:
            raise PackError(f'{label}: say what the file is for in "purpose", in one plain line')
        if 'text' in entry:
            if kind not in TEXT_KINDS:
                raise PackError(f'{label}: only {", ".join(sorted(TEXT_KINDS))} may be given as "text"')
            if not isinstance(entry['text'], str) or not entry['text'].strip():
                raise PackError(f'{label}: "text" is empty')
            name = entry.get('name') or (fixed if '.' in fixed else f'{fixed}.md')
            planned.append({'section': section, 'name': safe_name(name), 'purpose': purpose,
                            'text': entry['text'].strip() + '\n'})
            continue
        source = source_of(entry, label)
        if kind == 'video-words':
            planned.append({'section': section, 'name': fixed, 'purpose': purpose, 'text': words_text(source)})
            continue
        if entry.get('name'):
            name = entry['name']
        elif fixed and '.' in fixed:
            name = fixed
        elif fixed:
            name = f'{fixed}{source.suffix.lower()}'
        else:
            name = source.name
        planned.append({'section': section, 'name': safe_name(name), 'purpose': purpose, 'source': source})

    seen = {}
    for item in planned:
        relative = f'{item["section"]}/{item["name"]}'
        key = relative.lower()  # Windows and Drive ignore capitals
        if key in seen:
            raise PackError(f'two files would both be "{relative}": give one of them a "name"')
        seen[key] = item
        code = library.refusal(f'{POSTS}/{folder}/{relative}')
        if code:
            raise PackError(f'"{relative}" cannot go into the library: {library.explain(code)}')
        size = item['source'].stat().st_size if 'source' in item else len(item['text'].encode('utf-8'))
        if size > library.MAX_BYTES:
            raise PackError(f'"{relative}" is {size // (1024 * 1024)} MiB; the library takes files up to '
                            f'{library.MAX_BYTES // (1024 * 1024)} MiB')
        item['path'] = relative
    return folder, planned


def library_purpose(value):
    return isinstance(value, str) and value.strip() and len(value.strip()) <= 200 and not library.CONTROL.search(value)


def and_list(items):
    return items[0] if len(items) == 1 else ', '.join(items[:-1]) + ' and ' + items[-1]


def read_me(post, folder, planned, made):
    """READ ME.txt: what the post is, where it went, and every file in the
    order of the folders, each with what it is for."""
    when = post['date']
    if post.get('launch'):
        heading = f'Launch post, {long_date(when)}'
    else:
        name = library.subchannel_name(post['subchannel'])
        heading = f'{name}, {long_date(when)}'
    lines = [post['subject'].strip(), heading]
    if isinstance(post.get('headline'), str) and post['headline'].strip():
        lines += [f'Headline: {post["headline"].strip()}']
    links = post.get('links') or {}
    if links:
        lines += ['', 'Where it is published:']
        lines += [f'- {where}: {url}' for where, url in links.items()]
    lines += ['', 'What is in this folder, what each file is for, and where it goes.']
    for section in library.POST_SECTIONS:
        items = sorted((item for item in planned if item['section'] == section), key=lambda item: item['name'].lower())
        if not items:
            continue
        lines += ['', section]
        for item in items:
            lines += [f'- {item["name"]}', f'  {item["purpose"]}']
    lines += ['', f'Packed by the engine on {long_date(made)}. Every post is made by hand: '
                  'nothing in this folder has been posted by the engine.']
    return '\n'.join(lines) + '\n'


def build(post_path, out=DEFAULT_OUT, replace=False, today=None):
    """Builds the pack folder. Returns {'folder', 'path', 'files'}."""
    post_path = Path(post_path)
    try:
        post = json.loads(post_path.read_text(encoding='utf-8-sig'))
    except (OSError, json.JSONDecodeError) as error:
        raise PackError(f'{post_path} could not be read as JSON ({error})')
    links = post.get('links') if isinstance(post, dict) else None
    if links is not None and (not isinstance(links, dict) or any(
            not isinstance(url, str) or not re.fullmatch(r'https://\S+', url) for url in links.values())):
        raise PackError('"links" must map where it is published to an https:// link')
    try:
        folder, planned = plan(post, post_path.parent)
    except (LibraryError, archive.ArchiveError) as error:
        raise PackError(str(error))
    made = today or datetime.now(timezone.utc).date().isoformat()
    readme = read_me(post, folder, planned, made)

    out = Path(out).resolve()
    dest = out / folder
    if dest.exists():
        if not replace:
            raise PackError(f'{dest} already exists: give --replace to build it again')
        if not (dest / MANIFEST).is_file() or dest.parent != out:
            raise PackError(f'{dest} was not made by this tool, so it is left alone')
        shutil.rmtree(dest)
    dest.mkdir(parents=True)
    manifest = []
    for item in planned:
        target = dest / item['path']
        target.parent.mkdir(parents=True, exist_ok=True)
        if 'source' in item:
            shutil.copyfile(item['source'], target)
        else:
            target.write_text(item['text'], encoding='utf-8', newline='\n')
        manifest.append({'path': item['path'], 'purpose': item['purpose'], 'bytes': target.stat().st_size, 'sha256': sha256_of(target)})
    (dest / POST_README).write_text(readme, encoding='utf-8', newline='\n')
    manifest.append({'path': POST_README, 'purpose': 'What every file in this folder is for, and where it goes.',
                     'bytes': (dest / POST_README).stat().st_size, 'sha256': sha256_of(dest / POST_README)})
    (dest / MANIFEST).write_text(json.dumps({
        'schema_version': 1,
        'post_folder': folder,
        'library_prefix': f'{POSTS}/{folder}',
        'packed_on': made,
        'files': manifest,
    }, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    return {'folder': folder, 'path': str(dest), 'files': [item['path'] for item in manifest]}


# ---------------------------------------------------------------- self-test

def self_test():
    failures, count = [], 0
    cases_count, cases_failures = library.check_cases(library.read_cases())
    count += cases_count
    failures += cases_failures

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
        except PackError as error:
            if want not in str(error):
                failures.append(f'{label}: refused with {str(error)!r}, want {want!r}')
            return
        failures.append(f'{label}: gave {got!r}, want a refusal containing {want!r}')

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        work = tmp / 'work'
        for name, body in (('out/substack.html', b'<p>post</p>'), ('out/page.html', b'<p>page</p>'),
                           ('body.md', b'The words.\n'), ('out/email-pictures-off.html', b'<p>email</p>'),
                           ('out/cover.png', b'cover'), ('img/1-look-or-pay.png', b'one'),
                           ('script.md', b'Say this.\n'), ('v-9x16.mp4', b'tall'), ('v-16x9.mp4', b'wide'),
                           ('share/v-9x16.mp4', b'tall share'), ('card.png', b'card')):
            (work / name).parent.mkdir(parents=True, exist_ok=True)
            (work / name).write_bytes(body)
        (work / 'package.json').write_text(json.dumps({'ok': True, 'package': {
            'title': 'When an AI agent shops for you, who gets paid?',
            'alternates': [{'title': 'Amazon blocked it. Shopify paid it.', 'why': 'x'}],
            'description': 'Two answers to one agent.',
            'substack_title': 'Who gets paid', 'substack_subtitle': 'Same agent, opposite answers.'}}), encoding='utf-8')
        post = {
            'date': '2026-10-05', 'subchannel': 'follow_the_money', 'subject': 'Who gets paid',
            'headline': 'When an AI agent does your shopping, who gets paid?',
            'links': {'Substack': 'https://home.makeyourmindup.ai/p/who-gets-paid'},
            'files': [
                {'kind': 'substack-copy', 'file': 'out/substack.html'},
                {'kind': 'web-page', 'file': 'out/page.html'},
                {'kind': 'fact-checked-text', 'file': 'body.md'},
                {'kind': 'email-pictures-off', 'file': 'out/email-pictures-off.html'},
                {'kind': 'cover', 'file': 'out/cover.png'},
                {'kind': 'image', 'file': 'img/1-look-or-pay.png'},
                {'kind': 'video-script', 'file': 'script.md'},
                {'kind': 'video-words', 'file': 'package.json'},
                {'kind': 'video', 'shape': 'tall', 'file': 'v-9x16.mp4', 'share': 'share/v-9x16.mp4'},
                {'kind': 'video', 'shape': 'wide', 'file': 'v-16x9.mp4'},
                {'kind': 'linkedin-post', 'text': 'When an AI agent does your shopping, who gets paid?'},
                {'kind': 'linkedin-card', 'file': 'card.png'},
                {'category': 'social', 'file': 'card.png', 'name': 'quote card.png', 'purpose': 'A quote card for Instagram.'},
            ],
        }
        (work / 'post.json').write_text(json.dumps(post), encoding='utf-8')
        out = tmp / 'packs'
        built = build(work / 'post.json', out, today='2026-10-06')
        folder = '2026-10-05 Mon follow.the.money - Who gets paid'
        check('folder', built['folder'], folder)
        pack = out / folder
        found = sorted(str(p.relative_to(pack)).replace('\\', '/') for p in pack.rglob('*') if p.is_file())
        expected = sorted([
            '.pack.json', 'READ ME.txt',
            '1 Article/substack-copy.html', '1 Article/web-page.html', '1 Article/text-that-passed-the-fact-check.md',
            '1 Article/email-pictures-off.html',
            '2 Covers and images/substack-cover-3x2.png', '2 Covers and images/1-look-or-pay.png',
            '3 Video/video-script.md', '3 Video/youtube-and-substack-words.txt',
            '3 Video/Who gets paid - tall 9x16 - Shorts, Reels, LinkedIn.mp4',
            '3 Video/share/Who gets paid - tall 9x16 - Shorts, Reels, LinkedIn.mp4',
            '3 Video/Who gets paid - wide 16x9 - YouTube, Substack.mp4',
            '4 Social/linkedin-post.txt', '4 Social/linkedin-card.png', '4 Social/quote card.png',
        ])
        check('the files and their folders', found, expected)
        for name in expected:
            if name != '.pack.json':
                check(f'a library path: {name}', library.refusal(f'{POSTS}/{folder}/{name}'), None)
        check('copied byte for byte', (pack / '3 Video/share/Who gets paid - tall 9x16 - Shorts, Reels, LinkedIn.mp4').read_bytes(), b'tall share')
        check('originals kept', (work / 'v-9x16.mp4').read_bytes(), b'tall')
        readme = (pack / POST_README).read_text(encoding='utf-8')
        manifest = json.loads((pack / MANIFEST).read_text(encoding='utf-8'))
        check('manifest prefix', manifest['library_prefix'], f'{POSTS}/{folder}')
        check('manifest lists every file', sorted(f['path'] for f in manifest['files']), sorted(n for n in expected if n != '.pack.json'))
        for item in manifest['files']:
            if item['path'] != POST_README:
                count += 1
                if f'- {item["path"].split("/", 1)[1]}' not in readme or item['purpose'] not in readme:
                    failures.append(f'READ ME is missing {item["path"]} or what it is for')
            check(f'manifest hash: {item["path"]}', item['sha256'], sha256_of(pack / item['path']))
        for words in ('follow.the.money, Monday 5 October 2026', 'https://home.makeyourmindup.ai/p/who-gets-paid',
                      "Upload it in Substack's post settings", 'Post it to Shorts (YouTube Shorts), Reels (Instagram Reels) and LinkedIn.',
                      'Packed by the engine on Tuesday 6 October 2026'):
            count += 1
            if words not in readme:
                failures.append(f'READ ME does not say {words!r}')
        check('no long dashes in the READ ME', [ch for ch in readme if ch in '\u2013\u2014'], [])
        check('the YouTube and Substack words', (pack / '3 Video/youtube-and-substack-words.txt').read_text(encoding='utf-8').splitlines()[:4],
              ['YOUTUBE', 'Title: When an AI agent shops for you, who gets paid?', 'Other titles:', '- Amazon blocked it. Shopify paid it.'])

        refused('built twice', lambda: build(work / 'post.json', out), 'already exists')
        again = build(work / 'post.json', out, replace=True, today='2026-10-06')
        check('built again with --replace', again['folder'], folder)

        def variant(**changes):
            changed = {**post, **changes}
            (work / 'variant.json').write_text(json.dumps(changed), encoding='utf-8')
            return build(work / 'variant.json', tmp / 'other')

        refused('a day that does not match', lambda: variant(day='Wed'), 'its day is Mon, not Wed')
        refused('an unknown kind', lambda: variant(files=[{'kind': 'tiktok-dance', 'file': 'card.png'}]), 'not a kind this tool knows')
        refused('a file with no purpose', lambda: variant(files=[{'category': 'social', 'file': 'card.png'}]), 'say what the file is for')
        refused('a file that is missing', lambda: variant(files=[{'kind': 'cover', 'file': 'nope.png'}]), 'is not a file')
        refused('two files with one name', lambda: variant(files=[{'kind': 'image', 'file': 'card.png'}, {'kind': 'share-card', 'file': 'card.png', 'name': 'CARD.png'}]), 'would both be')
        refused('a type the library does not take', lambda: variant(files=[{'category': 'social', 'file': 'card.png', 'name': 'card.exe', 'purpose': 'x'}]), 'does not take this kind of file')
        refused('a video with no shape', lambda: variant(files=[{'kind': 'video', 'file': 'v-9x16.mp4'}]), 'needs "shape"')
        refused('a video for a place the archive rule does not know', lambda: variant(files=[{'kind': 'video', 'shape': 'tall', 'file': 'v-9x16.mp4', 'post_to': ['Facebook']}]), 'is not a place to post')
        refused('a link that is not https', lambda: variant(links={'Substack': 'http://x'}), 'https://')
        launch = variant(launch=True, subchannel=None, subject='Launch hello', files=[{'kind': 'video-script', 'text': 'Hello.'}])
        check('a launch post', launch['folder'], '2026-10-05 Launch - Launch hello')
        check('text given in the post file', (tmp / 'other' / launch['folder'] / '3 Video' / 'video-script.md').read_text(encoding='utf-8'), 'Hello.\n')
        (out / folder / MANIFEST).unlink()
        refused('a folder this tool did not make', lambda: build(work / 'post.json', out, replace=True), 'was not made by this tool')
        check('a folder this tool did not make is left alone', (out / folder / POST_README).is_file(), True)
    return count, failures


def main():
    ap = argparse.ArgumentParser(description="One post's launch set, sorted into its folder for Krish's asset library.")
    ap.add_argument('post', nargs='?', help='the post file (README.md has every field)')
    ap.add_argument('--out', help=f'where to build the pack (default: {DEFAULT_OUT.relative_to(library.ROOT)})')
    ap.add_argument('--replace', action='store_true', help='build again over a pack this tool made before')
    ap.add_argument('--self-test', action='store_true', help='check the naming, the path rule and a build in a temporary folder')
    a = ap.parse_args()
    if a.self_test:
        count, failures = self_test()
        if failures:
            print('\n'.join(failures), file=sys.stderr)
            sys.exit(f'post-pack self-test failed: {len(failures)} of {count} checks')
        print(f'post-pack self-test passed: {count} checks')
        return
    if not a.post:
        ap.error('give the post file, or --self-test')
    try:
        result = build(a.post, a.out or DEFAULT_OUT, a.replace)
    except (PackError, LibraryError) as error:
        sys.exit(f'post-pack: {error}')
    print(f'Packed {len(result["files"])} files into {result["path"]}')
    for name in result['files']:
        print(f'  {name}')
    print(f'Send it to the library: python scripts/post-pack/send.py "{result["path"]}"')


if __name__ == '__main__':
    main()
