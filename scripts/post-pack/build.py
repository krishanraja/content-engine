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
               {"kind": "thumbnail", "shape": "tall", "file": "thumbs/thumb-tall-1080x1920.jpg"},
               {"category": "social", "file": "img/quote.png", "purpose": "..."}]}

It writes DIR/<post folder>/, by default under .cache/post-pack/ (git ignores
it), named `YYYY-MM-DD Mon follow.the.money - Who gets paid` (a launch post is
`YYYY-MM-DD Launch - <Subject>`):

    READ ME.txt              every file, what it is for and where it goes
    0 Publish/               publish.html: start here, every channel in order, with Copy buttons (publish_kit.py)
    1 Article/               substack-copy.html, web-page.html, the text that passed the fact check, the email with pictures off
    2 Covers and images/     the cover, the pictures in the post, share cards
    3 Video/                 the script, the YouTube and Substack words, the finished videos and a thumbnail for each
    4 Social/                the LinkedIn post and its card

Then `send.py` sends the folder to the engine, and Krish's always-on machine
writes it into the library on Drive (README.md). Nothing here touches Drive.
It copies; the files it was given stay where they are.
"""
import argparse
import contextlib
import hashlib
import io
import json
import re
import shutil
import sys
import tempfile
from datetime import date, datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import library
import story_check  # noqa: E402
import visual_gate  # noqa: E402
import making  # noqa: E402  records the pack on the piece's board row
import edge_check  # noqa: E402
from library import ARTICLE, COVERS, POST_README, POSTS, PUBLISH, SOCIAL, VIDEO, LibraryError, archive, brand  # noqa: E402

DEFAULT_OUT = library.ROOT / '.cache' / 'post-pack'
MANIFEST = '.pack.json'  # what send.py reads: every file and its purpose. A dot keeps it out of the library.
SECTION_NAMES = {'publish': PUBLISH, 'article': ARTICLE, 'covers': COVERS, 'images': COVERS, 'video': VIDEO, 'social': SOCIAL}
for _section in library.POST_SECTIONS:
    SECTION_NAMES[_section.lower()] = _section

# Every kind of file a post's launch set holds: its section, the name it gets
# (None keeps the file's own name) and what it is for, in words Krish reads.
KINDS = {
    'publish-kit': (PUBLISH, 'publish.html',
                    'Start here. Open it in a browser: every channel in the order to publish, the file to upload for each, '
                    'and a Copy button for every word to paste (docs/AMPLIFICATION.md).'),
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
              'The cover at 3:2 (1200 x 800), for anywhere that asks for 3:2. Do not upload it to Substack: '
              'its upload box crops it. Upload substack-cover-1200x630.png.'),
    'substack-cover': (COVERS, 'substack-cover-1200x630.png',
                       "The post's cover. Upload it in Substack's post settings, as the cover image: it is the 1200 x 630 (1.91:1) "
                       'the upload box asks for, so Substack does not crop it.'),
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
    'thumbnail': (VIDEO, None, None),  # named by the archive rule beside its video, below
    'captions': (VIDEO, None, 'Captions for the video. Upload them with it wherever the platform takes a captions file.'),
    'linkedin-post': (SOCIAL, 'linkedin-post.txt', 'The LinkedIn post. Paste it into LinkedIn as the post text.'),
    'linkedin-card': (SOCIAL, 'linkedin-card', 'The picture for the LinkedIn post. Attach it to the post.'),
    'publish-manager': (PUBLISH, 'publish-manager.html',
                        'Start here. One self-contained page: the article with its pictures, every picture, every channel\'s words and the '
                        'scripts, each with its own Copy button (scripts/post-pack/publish_manager.py).'),
}
TEXT_KINDS = {'linkedin-post', 'video-script', 'fact-checked-text'}  # may be given as "text" in place of "file"
SHARE_PURPOSE = 'A smaller copy of the video, under the 30 MiB a chat upload allows, for sending in a chat. Post the full-size one.'

# A thumbnail for every video size, every time (Krish, 2026-10-12: "I always
# want a video thumbnail for all video sizes produced as an asset every
# time"). scripts/pages/build.py --thumbs draws both from the cover facts.
THUMB_PURPOSE = {
    'wide': 'The thumbnail for the wide 16:9 video. Set it as the YouTube thumbnail and as the Substack video\'s thumbnail.',
    'tall': 'The thumbnail for the tall 9:16 video. Set it as the cover on Reels and TikTok.',
}
THUMB_SIZE = {'wide': (1280, 720), 'tall': (1080, 1920)}  # the smallest each may be; the shape must match exactly
THUMB_MAX_BYTES = 2 * 1024 * 1024  # YouTube refuses a custom thumbnail over 2 MB
THUMB_TYPES = ('jpg', 'jpeg', 'png')


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
    # Its series: every video script of it opens with the series line (house rule SERIES_OPENER).
    series = None if post.get('launch') else library.subchannel_name(post.get('subchannel')).replace('.', '_')
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
            planned.append({'kind': kind, 'shape': shape, 'logos': [l for l in (entry.get('logos') or []) if isinstance(l, str)], 'evidence': entry.get('evidence') if isinstance(entry.get('evidence'), dict) else None, 'section': VIDEO, 'name': name, 'purpose': purpose, 'source': source})
            share = entry.get('share')
            if share is not None:
                share_path = (base / share).resolve() if isinstance(share, str) else None
                if not share_path or not share_path.is_file():
                    raise PackError(f'{label}: its "share" copy is not a file')
                planned.append({'kind': kind, 'shape': shape, 'share': True, 'logos': [l for l in (entry.get('logos') or []) if isinstance(l, str)], 'evidence': entry.get('evidence') if isinstance(entry.get('evidence'), dict) else None, 'section': VIDEO, 'name': f'share/{name}', 'purpose': SHARE_PURPOSE, 'source': share_path})
            continue
        if kind == 'thumbnail':
            shape = entry.get('shape')
            if shape not in ('tall', 'wide'):
                raise PackError(f'{label}: a thumbnail needs "shape": "wide" (for the 16:9 video) or "tall" (for the 9:16 video)')
            source = source_of(entry, label)
            extension = source.suffix.lstrip('.').lower()
            if extension not in THUMB_TYPES:
                raise PackError(f'{label}: a thumbnail is a JPEG or PNG picture, which YouTube, Reels and TikTok all take; {source.name} is not')
            thumb_size_or_refuse(source, shape, label)
            extension = 'jpg' if extension == 'jpeg' else extension
            fitted = archive._shorten(subject, library.PART_MAX - len(archive.thumbnail_name('x', shape, extension)) + 1)
            planned.append({'kind': kind, 'shape': shape, 'logos': [l for l in (entry.get('logos') or []) if isinstance(l, str)], 'evidence': None,
                            'section': VIDEO, 'name': archive.thumbnail_name(fitted, shape, extension),
                            'purpose': given_purpose or THUMB_PURPOSE[shape], 'source': source})
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
            if kind == 'video-script':
                story_gate(entry, entry['text'], label, series)
            name = entry.get('name') or (fixed if '.' in fixed else f'{fixed}.md')
            planned.append({'kind': kind, 'logos': [l for l in (entry.get('logos') or []) if isinstance(l, str)], 'evidence': entry.get('evidence') if isinstance(entry.get('evidence'), dict) else None, 'section': section, 'name': safe_name(name), 'purpose': purpose,
                            'text': entry['text'].strip() + '\n'})
            continue
        source = source_of(entry, label)
        if kind == 'video-script':
            story_gate(entry, source.read_text(encoding='utf-8-sig'), label, series)
        if kind == 'image':
            edge_gate(entry, source, label)
        if kind == 'video-words':
            planned.append({'kind': kind, 'logos': [l for l in (entry.get('logos') or []) if isinstance(l, str)], 'evidence': entry.get('evidence') if isinstance(entry.get('evidence'), dict) else None, 'section': section, 'name': fixed, 'purpose': purpose, 'text': words_text(source)})
            continue
        if entry.get('name'):
            name = entry['name']
        elif fixed and '.' in fixed:
            name = fixed
        elif fixed:
            name = f'{fixed}{source.suffix.lower()}'
        else:
            name = source.name
        planned.append({'kind': kind, 'logos': [l for l in (entry.get('logos') or []) if isinstance(l, str)], 'evidence': entry.get('evidence') if isinstance(entry.get('evidence'), dict) else None, 'section': section, 'name': safe_name(name), 'purpose': purpose, 'source': source})

    substack_cover_or_refuse(planned)

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


# Krish, 2026-10-12, with a screenshot of Substack's cover upload box
# ("Recommended: 1200 x 630 px (1.91:1)"): "Once again, the Substack cover
# image is incorrect. Why is this? Why did this not get fixed last time?"
# Given the 3:2 cover, Substack cropped it itself and cut the headline in
# half. scripts/pages/build.py --cover draws cover-1200x630.png beside
# cover.png; every pack with a cover carries it, and none is built without it.
SUBSTACK_COVER_FILE = 'cover-1200x630.png'
SUBSTACK_COVER_SIZE = (1200, 630)


def substack_cover_or_refuse(planned):
    """A pack with a cover also carries the 1200 x 630 one Substack's upload
    box asks for: the one given as "substack-cover", or else the drawer's
    cover-1200x630.png beside the packed cover.png, added here with the
    cover's logos. Refuses when there is none, or it is not 1200 x 630."""
    given = [p for p in planned if p.get('kind') == 'substack-cover']
    cover = next((p for p in planned if p.get('kind') == 'cover' and 'source' in p), None)
    if not given and cover is not None:
        wide = cover['source'].with_name(SUBSTACK_COVER_FILE)
        if not wide.is_file():
            raise PackError(f'the cover has no {SUBSTACK_COVER_FILE} beside it ({wide}): Substack\'s upload box asks for 1200 x 630 and crops '
                            'any other shape itself. Draw both again with scripts/pages/build.py COVER_FACTS --cover')
        section, name, purpose = KINDS['substack-cover']
        item = {'kind': 'substack-cover', 'logos': list(cover.get('logos') or []), 'evidence': None,
                'section': section, 'name': name, 'purpose': purpose, 'source': wide}
        planned.insert(planned.index(cover), item)
        given = [item]
    for item in given:
        try:
            from PIL import Image
        except ImportError:
            warn('Pillow is not installed, so the Substack cover\'s size was not checked (pip install pillow)')
            return
        try:
            with Image.open(item['source']) as im:
                size = im.size
        except Exception as e:  # noqa: BLE001
            raise PackError(f'the Substack cover {item["source"].name} could not be opened as a picture ({e})')
        if size != SUBSTACK_COVER_SIZE:
            raise PackError(f'the Substack cover {item["source"].name} is {size[0]} x {size[1]}; Substack\'s upload box asks for '
                            f'{SUBSTACK_COVER_SIZE[0]} x {SUBSTACK_COVER_SIZE[1]}. Draw it with scripts/pages/build.py COVER_FACTS --cover')


def thumb_size_or_refuse(source, shape, label):
    """A wide thumbnail is 16:9 and at least 1280 x 720, and under the 2 MB
    YouTube takes; a tall one is 9:16 and at least 1080 x 1920."""
    want_w, want_h = THUMB_SIZE[shape]
    try:
        from PIL import Image
    except ImportError:
        warn(f'{label}: Pillow is not installed, so the thumbnail\'s size was not checked (pip install pillow)')
        return
    try:
        with Image.open(source) as im:
            w, h = im.size
    except Exception as e:  # noqa: BLE001
        raise PackError(f'{label}: the thumbnail could not be opened as a picture ({e})')
    if w * want_h != h * want_w or w < want_w:
        raise PackError(f'{label}: the {archive.SHAPES[shape]} thumbnail is {w} x {h}; it must be {want_w} x {want_h}, or larger in the '
                        f'same shape. Draw it with scripts/pages/build.py COVER_FACTS --thumbs')
    if shape == 'wide' and source.stat().st_size > THUMB_MAX_BYTES:
        raise PackError(f'{label}: the wide thumbnail is {source.stat().st_size / 1e6:.1f} MB, over the 2 MB YouTube takes')


def thumbnail_gate_or_refuse(post, planned):
    """Krish, 2026-10-12: "I always want a video thumbnail for all video sizes
    produced as an asset every time." A pack that holds a video with no
    thumbnail of its shape is refused. A thumbnail packed before its video is
    fine. Only his own words in "thumbnail_override" let one through."""
    have = {item['shape'] for item in planned if item.get('kind') == 'thumbnail'}
    videos = [item for item in planned if item.get('kind') == 'video' and not item.get('share')]
    missing = [item for item in videos if item['shape'] not in have]
    override = post.get('thumbnail_override')
    if missing and not (isinstance(override, str) and override.strip().lower().startswith('krish')):
        size = {'wide': 'thumb-wide-1280x720.jpg', 'tall': 'thumb-tall-1080x1920.jpg'}
        raise PackError('every video size gets its own thumbnail, and these have none:\n  - ' + '\n  - '.join(
            f'{item["name"]} has no {archive.SHAPES[item["shape"]]} thumbnail: draw it with scripts/pages/build.py COVER_FACTS --thumbs '
            f'and add {{"kind": "thumbnail", "shape": "{item["shape"]}", "file": ".../{size[item["shape"]]}", "logos": [...]}}'
            for item in missing) + '\n  Or record Krish\'s own words in "thumbnail_override".')


def fact_checked_body(post, base):
    """The words of the piece, from its fact-checked-text entry, or ''."""
    for entry in post.get('files') or []:
        if isinstance(entry, dict) and entry.get('kind') == 'fact-checked-text':
            if isinstance(entry.get('text'), str):
                return entry['text']
            if isinstance(entry.get('file'), str):
                try:
                    return (base / entry['file']).read_text(encoding='utf-8-sig')
                except OSError:
                    return ''
    return ''


def visual_gate_or_refuse(post, planned, base):
    """Krish, 2026-10-10: every picture and video carries the real logos of
    the companies the piece names, a piece about volume shows real pages
    piled up, and the cover comes from the house drawer with his face. Only
    his own words in "visual_gate_override" let a pack through without."""
    found = visual_gate.problems(post, planned, fact_checked_body(post, base), base)
    override = post.get('visual_gate_override')
    if found and not (isinstance(override, str) and override.strip().lower().startswith('krish')):
        raise PackError('the pack fails the visual gate:\n  - ' + '\n  - '.join(found) +
                        '\n  Fix it (scripts/post-pack/visual_gate.py), or record Krish\'s own words in "visual_gate_override".')


_warned = set()


def warn(message):
    """A problem that does not stop the pack, said once on stderr."""
    if message not in _warned:
        _warned.add(message)
        print(f'post-pack: WARNING {message}', file=sys.stderr)


def story_gate(entry, text, label, series=None):
    """Krish, 2026-10-06 (walk log F75): a script that does not make sense out
    loud, or stops dead on the number, is not packed; nor one a 12-year-old
    could not follow (house rule R7), nor one that does not open with its
    series' line (series, the post's subchannel as a lane_slot; house rule
    SERIES_OPENER). Only his own words in "story_check_override" let one
    through."""
    # The cut a script says it is ("cut": "long" or "short", or its name),
    # so the length rule holds (house rule TWO_CUTS, Krish 2026-10-11).
    cut = entry.get('cut') if entry.get('cut') in story_check.CUTS else story_check.cut_of(entry.get('name') or entry.get('file') or '')
    if cut is None:
        warn(f'{label}: the script\'s length was checked against neither cut, so a 3-minute or 90-second '
             f'script of the wrong length would pass (house rule TWO_CUTS). Add "cut": "long" or "short" to the entry.')
    found = story_check.problems(text, cut, series if series in story_check.series_openers() else None)
    override = entry.get('story_check_override')
    if found and not (isinstance(override, str) and override.strip().lower().startswith('krish')):
        raise PackError(f'{label}: the script fails the story check:\n  - ' + '\n  - '.join(found) +
                        '\n  Fix it (scripts/post-pack/story_check.py), or record Krish\'s own words in "story_check_override".')


def edge_gate(entry, source, label):
    """Krish, 2026-10-07, of a source line cut off at the bottom of an article
    picture: "stuff like this can't happen". A picture with anything running
    off an edge is not packed. Only his own words in "edge_check_override"
    let one through."""
    try:
        found = edge_check.problems(source)
    except Exception as e:  # noqa: BLE001
        raise PackError(f'{label}: the picture could not be opened to check its edges ({e})')
    override = entry.get('edge_check_override')
    if found and not (isinstance(override, str) and override.strip().lower().startswith('krish')):
        raise PackError(f'{label}: the picture is cut off:\n  - ' + '\n  - '.join(found) +
                        '\n  Fix it (scripts/post-pack/edge_check.py), or record Krish\'s own words in "edge_check_override".')


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
            shows = f' Shows the real logos of {and_list(item["logos"])}.' if item.get('logos') else ''
            lines += [f'- {item["name"]}', f'  {item["purpose"]}{shows}']
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
    thumbnail_gate_or_refuse(post, planned)
    visual_gate_or_refuse(post, planned, post_path.parent)
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
        'piece_id': post.get('piece_id') or None,
        'headline': post.get('headline') or None,
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

    # Warnings are collected, not printed, so the self-test's own output stays clean.
    with tempfile.TemporaryDirectory() as tmp, contextlib.redirect_stderr(io.StringIO()) as said:
        _warned.clear()
        tmp = Path(tmp)
        work = tmp / 'work'
        for name, body in (('out/substack.html', b'<p>post</p>'), ('out/page.html', b'<p>page</p>'),
                           ('body.md', b'The words.\n'), ('out/email-pictures-off.html', b'<p>email</p>'),
                           ('out/cover.png', b'cover'), ('img/1-look-or-pay.png', b'one'),
                           ('script.md', b"Here's what you need to know about how money is changing because of AI. I'm Krish.\n\nWhy does this matter? Say this.\n"), ('v-9x16.mp4', b'tall'), ('v-16x9.mp4', b'wide'),
                           ('share/v-9x16.mp4', b'tall share'), ('card.png', b'card')):
            (work / name).parent.mkdir(parents=True, exist_ok=True)
            (work / name).write_bytes(body)
        from PIL import Image, ImageDraw
        whole = Image.new('RGB', (340, 320), (183, 166, 255))
        ImageDraw.Draw(whole).rounded_rectangle((20, 40, 320, 280), 12, fill=(12, 21, 18))
        whole.save(work / 'img/1-look-or-pay.png')
        whole.save(work / 'card.png')
        whole.crop((0, 0, 340, 270)).save(work / 'img/cut.png')
        # The 1200 x 630 cover Substack's upload box asks for, beside cover.png
        # with its receipt, as scripts/pages/build.py --cover writes them.
        Image.new('RGB', (1200, 630), (12, 21, 18)).save(work / 'out' / SUBSTACK_COVER_FILE)
        (work / 'out' / 'cover-1200x630.json').write_text(json.dumps({'sha256': sha256_of(work / 'out' / SUBSTACK_COVER_FILE),
                                                                     'portrait': True, 'rows': []}), encoding='utf-8')
        Image.new('RGB', (1200, 800), (12, 21, 18)).save(work / 'img/three-two.png')
        # A thumbnail for each video size, with the drawer's receipt beside them
        # (scripts/pages/build.py --thumbs), so the visual gate takes them.
        (work / 'thumbs').mkdir()
        Image.new('RGB', (1280, 720), (12, 21, 18)).save(work / 'thumbs/thumb-wide-1280x720.jpg')
        Image.new('RGB', (1080, 1920), (12, 21, 18)).save(work / 'thumbs/thumb-tall-1080x1920.jpg')
        Image.new('RGB', (1080, 1350), (12, 21, 18)).save(work / 'thumbs/thumb-4x5.jpg')
        (work / 'thumbs/thumb.gif').write_bytes(b'GIF89a')
        (work / 'thumbs/thumbs.json').write_text(json.dumps({'portrait': True, 'logos': [], 'files': [
            {'file': name, 'shape': shape, 'sha256': hashlib.sha256((work / 'thumbs' / name).read_bytes()).hexdigest()}
            for name, shape in (('thumb-wide-1280x720.jpg', 'wide'), ('thumb-tall-1080x1920.jpg', 'tall'))]}), encoding='utf-8')
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
                {'kind': 'thumbnail', 'shape': 'tall', 'file': 'thumbs/thumb-tall-1080x1920.jpg'},
                {'kind': 'thumbnail', 'shape': 'wide', 'file': 'thumbs/thumb-wide-1280x720.jpg'},
                {'kind': 'linkedin-post', 'text': 'When an AI agent does your shopping, who gets paid?'},
                {'kind': 'linkedin-card', 'file': 'card.png'},
                {'category': 'social', 'file': 'card.png', 'name': 'quote card.png', 'purpose': 'A quote card for Instagram.'},
            ],
        }
        # the house drawer's receipt, so the visual gate takes the cover (visual_gate.py)
        (work / 'out' / 'cover.json').write_text(json.dumps({'sha256': hashlib.sha256((work / 'out' / 'cover.png').read_bytes()).hexdigest(),
                                                             'portrait': True, 'rows': []}), encoding='utf-8')
        (work / 'post.json').write_text(json.dumps(post), encoding='utf-8')
        out = tmp / 'packs'
        built = build(work / 'post.json', out, today='2026-10-06')
        folder = '2026-10-05 Mon follow.the.money - Who gets paid'
        check('folder', built['folder'], folder)
        # script.md names no cut, so the length rule could not run: the pack is
        # built, with a warning that names the fix (house rule TWO_CUTS).
        check('a script with no cut warns that its length was checked against neither cut',
              ('file 7 (video-script)' in said.getvalue(), 'checked against neither cut' in said.getvalue(),
               'Add "cut": "long" or "short" to the entry.' in said.getvalue()), (True, True, True))
        pack = out / folder
        found = sorted(str(p.relative_to(pack)).replace('\\', '/') for p in pack.rglob('*') if p.is_file())
        expected = sorted([
            '.pack.json', 'READ ME.txt',
            '1 Article/substack-copy.html', '1 Article/web-page.html', '1 Article/text-that-passed-the-fact-check.md',
            '1 Article/email-pictures-off.html',
            '2 Covers and images/substack-cover-3x2.png', '2 Covers and images/substack-cover-1200x630.png', '2 Covers and images/1-look-or-pay.png',
            '3 Video/video-script.md', '3 Video/youtube-and-substack-words.txt',
            '3 Video/Who gets paid - tall 9x16 - Shorts, Reels, TikTok, LinkedIn.mp4',
            '3 Video/share/Who gets paid - tall 9x16 - Shorts, Reels, TikTok, LinkedIn.mp4',
            '3 Video/Who gets paid - wide 16x9 - YouTube, Substack.mp4',
            '3 Video/Who gets paid - tall 9x16 - thumbnail.jpg', '3 Video/Who gets paid - wide 16x9 - thumbnail.jpg',
            '4 Social/linkedin-post.txt', '4 Social/linkedin-card.png', '4 Social/quote card.png',
        ])
        check('the files and their folders', found, expected)
        for name in expected:
            if name != '.pack.json':
                check(f'a library path: {name}', library.refusal(f'{POSTS}/{folder}/{name}'), None)
        check('copied byte for byte', (pack / '3 Video/share/Who gets paid - tall 9x16 - Shorts, Reels, TikTok, LinkedIn.mp4').read_bytes(), b'tall share')
        check('a thumbnail copied byte for byte', (pack / '3 Video/Who gets paid - wide 16x9 - thumbnail.jpg').read_bytes(),
              (work / 'thumbs/thumb-wide-1280x720.jpg').read_bytes())
        check('originals kept', (work / 'v-9x16.mp4').read_bytes(), b'tall')
        check('the 1200 x 630 cover beside cover.png is packed, byte for byte', (pack / '2 Covers and images/substack-cover-1200x630.png').read_bytes(),
              (work / 'out' / SUBSTACK_COVER_FILE).read_bytes())
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
                      "Upload it in Substack's post settings", 'Post it to Shorts (YouTube Shorts), Reels (Instagram Reels), TikTok and LinkedIn.',
                      THUMB_PURPOSE['wide'], THUMB_PURPOSE['tall'],
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
        (work / 'lone').mkdir()
        shutil.copyfile(work / 'out/cover.png', work / 'lone/cover.png')
        shutil.copyfile(work / 'out/cover.json', work / 'lone/cover.json')
        refused('a cover with no 1200 x 630 one beside it', lambda: variant(files=[{'kind': 'cover', 'file': 'lone/cover.png'}]),
                f'the cover has no {SUBSTACK_COVER_FILE} beside it')
        refused('a Substack cover that is not 1200 x 630', lambda: variant(files=[{'kind': 'substack-cover', 'file': 'img/three-two.png'}]),
                "is 1200 x 800; Substack's upload box asks for 1200 x 630")
        refused('two files with one name', lambda: variant(files=[{'kind': 'image', 'file': 'card.png'}, {'kind': 'share-card', 'file': 'card.png', 'name': 'CARD.png'}]), 'would both be')
        refused('a type the library does not take', lambda: variant(files=[{'category': 'social', 'file': 'card.png', 'name': 'card.exe', 'purpose': 'x'}]), 'does not take this kind of file')
        refused('a video with no shape', lambda: variant(files=[{'kind': 'video', 'file': 'v-9x16.mp4'}]), 'needs "shape"')
        refused('a video for a place the archive rule does not know', lambda: variant(files=[{'kind': 'video', 'shape': 'tall', 'file': 'v-9x16.mp4', 'post_to': ['Facebook']}]), 'is not a place to post')
        refused('a link that is not https', lambda: variant(links={'Substack': 'http://x'}), 'https://')
        wide_video = {'kind': 'video', 'shape': 'wide', 'file': 'v-16x9.mp4'}
        wide_thumb = {'kind': 'thumbnail', 'shape': 'wide', 'file': 'thumbs/thumb-wide-1280x720.jpg'}
        refused('a video with no thumbnail of its shape', lambda: variant(files=[wide_video]),
                'has no wide 16x9 thumbnail: draw it with scripts/pages/build.py COVER_FACTS --thumbs')
        refused('the tall thumbnail does not stand in for the wide one', lambda: variant(files=[wide_video, {'kind': 'thumbnail', 'shape': 'tall', 'file': 'thumbs/thumb-tall-1080x1920.jpg'}]),
                'has no wide 16x9 thumbnail')
        check('a video and its thumbnail pack', bool(variant(subject='Wide and its thumbnail', files=[wide_video, wide_thumb])), True)
        check('a thumbnail may be packed before its video', bool(variant(subject='Thumbnail first', files=[wide_thumb])), True)
        check('Krish can let a video through without one in his own words',
              bool(variant(subject='Thumbnail override', thumbnail_override='Krish, 2026-10-12: post it with the frame YouTube picks', files=[wide_video])), True)
        refused('a thumbnail with no shape', lambda: variant(files=[{'kind': 'thumbnail', 'file': 'thumbs/thumb-wide-1280x720.jpg'}]), 'a thumbnail needs "shape"')
        refused('a thumbnail of the wrong size for its shape', lambda: variant(files=[{'kind': 'thumbnail', 'shape': 'wide', 'file': 'thumbs/thumb-tall-1080x1920.jpg'}]),
                'the wide 16x9 thumbnail is 1080 x 1920; it must be 1280 x 720')
        refused('a 4:5 picture is not a tall thumbnail', lambda: variant(files=[{'kind': 'thumbnail', 'shape': 'tall', 'file': 'thumbs/thumb-4x5.jpg'}]),
                'it must be 1080 x 1920')
        refused('a thumbnail that is not a JPEG or PNG', lambda: variant(files=[{'kind': 'thumbnail', 'shape': 'wide', 'file': 'thumbs/thumb.gif'}]), 'is a JPEG or PNG picture')
        refused('two thumbnails of one shape', lambda: variant(files=[wide_thumb, dict(wide_thumb)]), 'would both be')
        (work / 'hand').mkdir()
        shutil.copyfile(work / 'thumbs/thumb-wide-1280x720.jpg', work / 'hand/thumb-wide-1280x720.jpg')
        refused('a thumbnail the house drawer did not make fails the visual gate',
                lambda: variant(files=[{'kind': 'thumbnail', 'shape': 'wide', 'file': 'hand/thumb-wide-1280x720.jpg'}]), 'was not drawn by the house drawer')
        refused('a picture cut off at an edge', lambda: variant(files=[{'kind': 'image', 'file': 'img/cut.png'}]), 'is cut off')
        check('Krish can let a cut picture through in his own words', bool(variant(subject='Edge override', files=[{'kind': 'image', 'file': 'img/cut.png', 'edge_check_override': 'Krish, 2026-10-07: it bleeds on purpose'}])), True)
        refused('a script that fails the story check', lambda: variant(files=[{'kind': 'video-script', 'text': 'One: the billion. Real, with small print.'}]), 'fails the story check')
        check('Krish can let one through in his own words', bool(variant(files=[{'kind': 'video-script', 'text': 'Hello.', 'story_check_override': 'Krish, 2026-10-06: record it as it is'}])), True)
        before = said.getvalue()
        refused('a script given its cut is held to that length', lambda: variant(files=[{'kind': 'video-script', 'text': 'Why does this matter? Say this.', 'cut': 'short'}]), 'the short cut is 6 spoken words')
        check('a script given its cut raises no warning', said.getvalue(), before)
        launch = variant(launch=True, subchannel=None, subject='Launch hello', files=[{'kind': 'video-script', 'text': 'Why are we here? Hello.'}])
        check('a launch post', launch['folder'], '2026-10-05 Launch - Launch hello')
        check('text given in the post file', (tmp / 'other' / launch['folder'] / '3 Video' / 'video-script.md').read_text(encoding='utf-8'), 'Why are we here? Hello.\n')
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
    piece_id = making.piece_id_of(a.post)
    if piece_id:
        making.report(piece_id, making.pack_patch(result['path']) | making.visual_gate_patch(a.post), 'pack built, visual gate passed')
    print(f'Send it to the library: python scripts/post-pack/send.py "{result["path"]}"')


if __name__ == '__main__':
    main()
