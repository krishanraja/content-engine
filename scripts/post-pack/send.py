#!/usr/bin/env python3
"""send: sends files to the engine's library, for Krish's always-on Windows
machine to write into his makeyourmindup asset library on Drive.

Krish, 2026-10-06: "make sure the brand kit is always updated here [the
library's Drive folder]", then "I want every single asset in there, permanent
and for individual posts, categorized properly, clear what to use them for,
and every new post gets its own new folder with all assets including the
article HTML I can copy paste, video scripts, etc etc".

    python send.py PACK                               a post's pack from build.py
    python send.py FOLDER --as "2 Channel art (permanent)" --purpose "..."
    python send.py --brand-kit KIT                    the unpacked brand kit, or its .zip
    python send.py ... --dry-run                      show what would be sent, send nothing
    python send.py --self-test

For each file it works out the sha256, asks the engine for an upload URL
(POST /api/library/upload-url), puts the bytes there and confirms
(POST /api/library/confirm). A file the library already has at that path is
skipped. Every path is checked against the library's rule first, and if one
fails nothing is sent.

It authenticates exactly as scripts/engine.py does, with that file's own code:
the engine key from ENGINE_OPERATOR_TOKEN, or on Krish's Windows machines from
Windows Credential Manager. The key is never printed.

The architecture doc's rule 0a.5 says agents never write into Krish's Drive.
This is his explicit instruction for this one folder, carried out by his own
machine (scripts/library-sync.ps1), and it covers that folder only.
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import sys
import tempfile
import urllib.error
import urllib.request
import zipfile
from pathlib import Path, PurePosixPath
from urllib.parse import urlsplit

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
import engine  # noqa: E402  scripts/engine.py: the engine's address and key
import library  # noqa: E402
from library import BRAND_KIT, LibraryError  # noqa: E402

MANIFEST = '.pack.json'
CLUTTER = {'thumbs.db', 'desktop.ini', '__pycache__'}
KIT_FOLDER = 'makeyourmindup-brand-kit'  # the folder inside the published kit's zip
# What each part of the brand kit is for, by its first folder.
BRAND_KIT_PURPOSES = {
    'guidelines': 'The brand book: how makeyourmindup looks and sounds. Read it before making anything new.',
    'logos': 'An official logo file. Use it as it is: never redraw, retype or tilt the logo.',
    'colours': 'The colour palette, with every colour\'s code.',
    'tokens': 'The design tokens (colours, type, spacing) for code and design tools.',
    'fonts': 'A brand font, with its open licence. Install it to set type in the house style.',
    'photography': 'Approved photography for makeyourmindup.',
    'applications': 'The brand applied: Substack, social, email and website artwork, ready to use.',
}
BRAND_KIT_DEFAULT = 'Part of the makeyourmindup brand kit.'

PLAIN = {  # the engine's answers, in plain words
    'unauthorized': 'the engine refused the key. Check ENGINE_OPERATOR_TOKEN (WORKBENCH.md, "Pick up from any tool")',
    'library_store_unconfigured': 'the engine has no storage address set',
    'library_store_unavailable': "the engine's library storage cannot be reached, or its bucket is missing (has the migration been applied?)",
    'library_store_misconfigured': "the engine's library bucket is not set up as the migration sets it",
    'library_index_unavailable': "the engine's library list cannot be read",
    'library_file_too_large': f'the file is over the library\'s {library.MAX_BYTES // (1024 * 1024)} MiB a file',
    'library_file_conflict': 'the library holds a file with this sha256 and a different size',
    'library_object_conflict': 'the stored bytes do not match this file',
    'library_object_missing': 'the upload did not arrive',
    'library_file_not_found': 'the engine has no record of this file',
    'rate_limited': 'too many requests at once; wait a minute and send again (files already sent are skipped)',
}


class SendError(RuntimeError):
    """A reason to stop, in words a person can act on."""


def hashes(path):
    sha, md5 = hashlib.sha256(), hashlib.md5()
    with open(path, 'rb') as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b''):
            sha.update(block)
            md5.update(block)
    return sha.hexdigest(), md5.hexdigest()


def size_text(n):
    for unit in ('bytes', 'KB', 'MB', 'GB'):
        if n < 1000 or unit == 'GB':
            return f'{n} {unit}' if unit == 'bytes' else f'{n:.1f} {unit}'
        n /= 1000


def default_client(environ=os.environ):
    """Who is sending, as the engine records it: codex inside Codex, else claude_code."""
    return 'codex' if any(name.startswith('CODEX') for name in environ) else 'claude_code'


# ---------------------------------------------------------------- what to send

def walk(folder):
    """Every file under folder, as (relative posix path, Path), in order.
    Hidden files and folders, and the clutter Windows leaves, are left out."""
    found = []
    for path in sorted(Path(folder).rglob('*')):
        relative = PurePosixPath(*path.relative_to(folder).parts)
        if any(part.startswith('.') or part.lower() in CLUTTER for part in relative.parts):
            continue
        if path.is_file():
            found.append((str(relative), path))
    return found


def kit_root(folder):
    """The kit's own folder: the one given, or the makeyourmindup-brand-kit
    folder inside it when that is all it holds (the zip unpacked as it comes)."""
    folder = Path(folder)
    visible = [p for p in folder.iterdir() if not p.name.startswith('.')]
    if len(visible) == 1 and visible[0].is_dir() and visible[0].name == KIT_FOLDER:
        return visible[0]
    return folder


def unzip(zip_path, into):
    """Unpacks a zip into a new folder, refusing any entry that would land
    outside it."""
    into = Path(into).resolve()
    with zipfile.ZipFile(zip_path) as archive_file:
        for info in archive_file.infolist():
            name = info.filename
            parts = PurePosixPath(name).parts
            if '\\' in name or name.startswith('/') or re.match(r'[A-Za-z]:', name) or '..' in parts:
                raise SendError(f'the zip holds "{name}", which would land outside the kit: it is not unpacked')
            target = (into / Path(*parts)).resolve() if parts else into
            if target != into and into not in target.parents:
                raise SendError(f'the zip holds "{name}", which would land outside the kit: it is not unpacked')
            if info.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive_file.open(info) as source, open(target, 'wb') as out:
                shutil.copyfileobj(source, out)
    return into


def brand_kit_purpose(relative):
    first = relative.split('/', 1)[0].lower() if '/' in relative else ''
    return BRAND_KIT_PURPOSES.get(first, BRAND_KIT_DEFAULT)


def plan(folder, prefix=None, purpose=None, brand_kit=False):
    """[(library path, Path, purpose)] for everything in folder, checked
    against the library's rule. Raises SendError listing every problem."""
    folder = Path(folder)
    if not folder.is_dir():
        raise SendError(f'{folder} is not a folder')
    manifest = {}
    if (folder / MANIFEST).is_file():
        data = json.loads((folder / MANIFEST).read_text(encoding='utf-8'))
        manifest = {item['path']: item['purpose'] for item in data.get('files', [])}
        prefix = prefix or data.get('library_prefix')
    if brand_kit:
        prefix = prefix or BRAND_KIT
    if not prefix:
        raise SendError('say where in the library these go, with --as: "1 Brand kit (permanent)", '
                        '"2 Channel art (permanent)" or "3 Posts/<post folder>"')
    prefix = prefix.strip().strip('/')
    files = walk(folder)
    if not files:
        raise SendError(f'{folder} has no files to send')
    planned, problems = [], []
    for relative, path in files:
        target = f'{prefix}/{relative}'
        why = manifest.get(relative) or purpose or (brand_kit_purpose(relative) if brand_kit else None)
        code = library.refusal(target)
        if code:
            problems.append(f'  {target}\n    cannot go into the library: {library.explain(code)}')
        elif not why:
            problems.append(f'  {target}\n    says nothing about what it is for: rebuild the pack with build.py, or give --purpose')
        elif path.stat().st_size > library.MAX_BYTES:
            problems.append(f'  {target}\n    is over the library\'s {library.MAX_BYTES // (1024 * 1024)} MiB a file')
        elif path.stat().st_size == 0:
            problems.append(f'  {target}\n    is empty')
        planned.append((target, path, why))
    if problems:
        raise SendError('nothing was sent, because:\n' + '\n'.join(problems))
    return planned


# ---------------------------------------------------------------- the engine

class Engine:
    """The engine's library routes on the engine key, through scripts/engine.py."""

    def __init__(self, client):
        try:
            self.token = engine.operator_key()
        except engine.NoKey as no_key:
            raise SendError(str(no_key))
        self.client = client

    def post(self, path, body):
        try:
            status, text = engine.call('POST', path, {**body, 'client': self.client}, self.token, timeout=120)
        except engine.Unreachable as unreachable:
            raise SendError(str(unreachable))
        try:
            return status, json.loads(text)
        except json.JSONDecodeError:
            return status, {'ok': False, 'error': {'code': f'http_{status}'}}

    def put(self, url, path, headers):
        parts = urlsplit(url)
        if parts.scheme != 'https' or parts.username or parts.password or parts.fragment \
                or not parts.path.startswith('/storage/v1/object/upload/sign/'):
            raise SendError('the engine gave an upload address that is not its signed storage upload: nothing was put')
        size = path.stat().st_size
        with open(path, 'rb') as handle:
            request = urllib.request.Request(url, data=handle, method='PUT',
                                             headers={**headers, 'Content-Length': str(size)})
            try:
                with urllib.request.urlopen(request, timeout=600) as response:
                    return response.status
            except urllib.error.HTTPError as error:
                return error.code
            except urllib.error.URLError as error:
                raise SendError(f'the upload could not reach storage ({error.reason})')


def refusal_text(status, body):
    error = body.get('error') if isinstance(body, dict) else None
    code = error.get('code') if isinstance(error, dict) else error
    reason = error.get('reason') if isinstance(error, dict) else None
    words = PLAIN.get(code, f'the engine answered {status}')
    if reason:
        words = f'{library.explain(reason)} ({reason})'
    return f'{words} [{code or status}]'


def send(planned, engine_api, out=print):
    """Sends each planned file. Returns {'sent', 'already', 'confirmed_only'}."""
    done = {'sent': 0, 'already': 0, 'confirmed_only': 0}
    for target, path, why in planned:
        sha, md5 = hashes(path)
        size = path.stat().st_size
        status, answer = engine_api.post('/api/library/upload-url', {'path': target, 'sha256': sha, 'md5': md5,
                                                                    'bytes': size, 'purpose': why})
        if not (200 <= status < 300 and isinstance(answer, dict) and answer.get('ok') is True):
            raise SendError(f'{target}: {refusal_text(status, answer)}. Stopped; the files above went in.')
        if answer.get('already_there'):
            done['already'] += 1
            out(f'already there  {target}' + ('  (the newest again)' if answer.get('newest_again') else ''))
            continue
        upload = answer.get('upload')
        if upload:
            put = engine_api.put(upload['url'], path, upload.get('headers') or {})
            # 409: the bytes landed already (a second sender, or a retry); confirm checks them.
            if not (200 <= put < 300 or put == 409):
                raise SendError(f'{target}: the upload was refused ({put}). Stopped; the files above went in.')
        status, confirmed = engine_api.post('/api/library/confirm', {'path': target, 'sha256': sha})
        if not (200 <= status < 300 and isinstance(confirmed, dict) and confirmed.get('ok') is True):
            raise SendError(f'{target}: {refusal_text(status, confirmed)}. Stopped; the files above went in.')
        if upload:
            done['sent'] += 1
            out(f'sent           {target}  ({size_text(size)})')
        else:
            done['confirmed_only'] += 1
            out(f'sent           {target}  (the library already held these bytes)')
    return done


# ---------------------------------------------------------------- self-test

class FakeEngine:
    """The four routes' behaviour, in memory, for the self-test."""

    def __init__(self):
        self.files, self.objects, self.puts, self.calls = {}, {}, [], []
        self.clock = 0
        self.fail_on = None

    def post(self, path, body):
        self.calls.append((path, body['path']))
        if self.fail_on and body['path'].endswith(self.fail_on):
            return 503, {'ok': False, 'error': {'code': 'library_store_unavailable'}}
        code = library.refusal(body['path'])
        if code:
            return 400, {'ok': False, 'error': {'code': 'invalid_library_path', 'reason': code}}
        key = (body['path'], body['sha256'])
        if path == '/api/library/upload-url':
            row = self.files.get(key)
            if row and row['ready']:
                newest = max((r for (p, _), r in self.files.items() if p == body['path'] and r['ready']), key=lambda r: r['at'])
                again = newest is not row
                if again:
                    self.clock += 1
                    row['at'] = self.clock
                return 200, {'ok': True, 'already_there': True, 'newest_again': again, 'upload': None}
            self.files.setdefault(key, {'ready': False, 'at': None, 'bytes': body['bytes']})
            if body['sha256'] in self.objects:
                return 200, {'ok': True, 'already_there': False, 'upload': None}
            return 200, {'ok': True, 'already_there': False,
                         'upload': {'method': 'PUT', 'url': f'https://store.invalid/storage/v1/object/upload/sign/content-library/files/{body["sha256"]}',
                                    'headers': {'Content-Type': library.content_type(body['path'])}}}
        row = self.files.get(key)
        if not row:
            return 404, {'ok': False, 'error': {'code': 'library_file_not_found'}}
        if body['sha256'] not in self.objects:
            return 409, {'ok': False, 'error': {'code': 'library_object_missing'}}
        if not row['ready']:
            self.clock += 1
            row.update(ready=True, at=self.clock)
        return 200, {'ok': True}

    def put(self, url, path, headers):
        self.puts.append(url)
        self.objects[url.rsplit('/', 1)[1]] = path.read_bytes()
        return 200


def self_test():
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
        except SendError as error:
            if want not in str(error):
                failures.append(f'{label}: refused with {str(error)!r}, want {want!r}')
            return
        failures.append(f'{label}: gave {got!r}, want a refusal containing {want!r}')

    quiet = lambda line: None
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        pack = tmp / '2026-10-05 Mon follow.the.money - Who gets paid'
        for name, body in (('READ ME.txt', b'read me'), ('1 Article/substack-copy.html', b'<p>post</p>'),
                           ('2 Covers and images/substack-cover-3x2.png', b'cover'),
                           ('4 Social/linkedin-card.png', b'cover'), ('.pack.json', b'')):
            (pack / name).parent.mkdir(parents=True, exist_ok=True)
            (pack / name).write_bytes(body)
        (pack / '.pack.json').write_text(json.dumps({'library_prefix': f'3 Posts/{pack.name}', 'files': [
            {'path': 'READ ME.txt', 'purpose': 'What every file is for.'},
            {'path': '1 Article/substack-copy.html', 'purpose': 'Paste into Substack.'},
            {'path': '2 Covers and images/substack-cover-3x2.png', 'purpose': 'The cover.'},
            {'path': '4 Social/linkedin-card.png', 'purpose': 'The LinkedIn picture.'}]}), encoding='utf-8')

        fake = FakeEngine()
        planned = plan(pack)
        check('the pack goes under its post folder', [t for t, _, _ in planned], [
            f'3 Posts/{pack.name}/1 Article/substack-copy.html', f'3 Posts/{pack.name}/2 Covers and images/substack-cover-3x2.png',
            f'3 Posts/{pack.name}/4 Social/linkedin-card.png', f'3 Posts/{pack.name}/READ ME.txt'])
        check('the purposes come from the pack', planned[0][2], 'Paste into Substack.')
        check('first send', send(planned, fake, quiet), {'sent': 3, 'already': 0, 'confirmed_only': 1})
        check('one upload for bytes sent twice', len(fake.puts), 3)
        check('every file ready', all(row['ready'] for row in fake.files.values()), True)
        check('sent again: all already there', send(plan(pack), fake, quiet), {'sent': 0, 'already': 4, 'confirmed_only': 0})
        check('nothing put the second time', len(fake.puts), 3)

        (pack / '1 Article/substack-copy.html').write_bytes(b'<p>post, corrected</p>')
        check('a changed file is sent again', send(plan(pack), fake, quiet), {'sent': 1, 'already': 3, 'confirmed_only': 0})
        (pack / '1 Article/substack-copy.html').write_bytes(b'<p>post</p>')
        lines = []
        check('the earlier version sent again', send(plan(pack), fake, lines.append)['already'], 4)
        check('says it is the newest again', any('the newest again' in line for line in lines), True)

        (pack / '1 Article/stray.html').write_bytes(b'x')
        refused('a file the pack does not list', lambda: plan(pack), 'says nothing about what it is for')
        check('it may be sent with --purpose', len(plan(pack, purpose='A stray page.')), 5)
        (pack / '1 Article/stray.html').unlink()

        loose = tmp / 'loose'
        (loose / 'art').mkdir(parents=True)
        (loose / 'art' / 'banner.png').write_bytes(b'banner')
        (loose / 'art' / ' bad name.png').write_bytes(b'bad')  # a leading space: Windows allows it, the library does not
        calls = len(fake.calls)
        refused('one bad name stops everything', lambda: send(plan(loose, '2 Channel art (permanent)', 'Art.'), fake, quiet), 'nothing was sent')
        check('nothing reached the engine', len(fake.calls), calls)
        (loose / 'art' / ' bad name.png').unlink()
        refused('no place in the library', lambda: plan(loose, purpose='Art.'), 'say where in the library')
        refused('outside the library', lambda: plan(loose, 'Video Engine/Inbox', 'Art.'), 'outside')
        refused('loose in a post folder', lambda: plan(loose, f'3 Posts/{pack.name}', 'Art.'), 'inside a post folder')

        fake.fail_on = 'banner.png'
        refused('the engine says no', lambda: send(plan(loose, '2 Channel art (permanent)', 'Art.'), fake, quiet),
                "the engine's library storage cannot be reached")
        fake.fail_on = None

        kit = tmp / 'unzipped' / KIT_FOLDER
        for name in ('logos/mark/mark.png', 'fonts/Anton/Anton-Regular.ttf', 'README.md', '.gitignore', 'colours/palette.txt'):
            (kit / name).parent.mkdir(parents=True, exist_ok=True)
            (kit / name).write_bytes(name.encode())
        kit_plan = plan(kit_root(kit.parent), brand_kit=True)
        check('the brand kit, its own folder found, hidden files left out', [t for t, _, _ in kit_plan], [
            '1 Brand kit (permanent)/README.md', '1 Brand kit (permanent)/colours/palette.txt',
            '1 Brand kit (permanent)/fonts/Anton/Anton-Regular.ttf', '1 Brand kit (permanent)/logos/mark/mark.png'])
        check('a logo says how to use it', kit_plan[3][2], BRAND_KIT_PURPOSES['logos'])
        check('the brand kit sent', send(kit_plan, fake, quiet)['sent'], 4)

        zipped = tmp / 'kit.zip'
        with zipfile.ZipFile(zipped, 'w') as z:
            z.writestr(f'{KIT_FOLDER}/logos/mark/mark.png', b'logos/mark/mark.png')
            z.writestr(f'{KIT_FOLDER}/tokens/tokens.json', b'{}')
        unpacked = unzip(zipped, tmp / 'from-zip')
        check('a zip unpacks into the same plan', [t for t, _, _ in plan(kit_root(unpacked), brand_kit=True)],
              ['1 Brand kit (permanent)/logos/mark/mark.png', '1 Brand kit (permanent)/tokens/tokens.json'])
        evil = tmp / 'evil.zip'
        with zipfile.ZipFile(evil, 'w') as z:
            z.writestr('../../escape.txt', b'x')
        refused('a zip entry that climbs out', lambda: unzip(evil, tmp / 'evil'), 'would land outside the kit')
        check('nothing landed outside', (tmp / 'escape.txt').exists() or (tmp.parent / 'escape.txt').exists(), False)

        api = Engine.__new__(Engine)
        for url in ('http://store.invalid/storage/v1/object/upload/sign/x', 'https://store.invalid/elsewhere/x',
                    'https://user:pw@store.invalid/storage/v1/object/upload/sign/x'):
            refused(f'an upload address that is not storage: {url}', lambda url=url: api.put(url, zipped, {}), 'nothing was put')
        check('the client inside Codex', default_client({'CODEX_HOME': 'x', 'PATH': 'x'}), 'codex')
        check('the client anywhere else', default_client({'PATH': 'x'}), 'claude_code')
        check('plain words for a refusal', refusal_text(400, {'ok': False, 'error': {'code': 'invalid_library_path', 'reason': 'path_escapes_library'}}),
              'it has a "." or ".." folder, which would leave the library (path_escapes_library) [invalid_library_path]')
        check('plain words for the guard', refusal_text(401, {'ok': False, 'error': 'unauthorized'}).startswith('the engine refused the key'), True)
    return count, failures


def main():
    ap = argparse.ArgumentParser(description="Send files to the engine's library, for Krish's machine to write into his asset library on Drive.")
    ap.add_argument('folder', nargs='?', help='a pack from build.py, or any folder (with --as)')
    ap.add_argument('--as', dest='prefix', help='where in the library: "2 Channel art (permanent)", or "3 Posts/<post folder>" (a pack knows its own)')
    ap.add_argument('--brand-kit', help='the unpacked brand kit, or its .zip: goes into "1 Brand kit (permanent)"')
    ap.add_argument('--purpose', help='what the files are for, in one line, when the folder is not a pack')
    ap.add_argument('--client', default=default_client(), help='who is sending, as the engine records it (default: %(default)s)')
    ap.add_argument('--dry-run', action='store_true', help='show what would be sent, and send nothing')
    ap.add_argument('--self-test', action='store_true', help='check the planning and sending against a stand-in engine (no network)')
    a = ap.parse_args()
    if a.self_test:
        count, failures = self_test()
        if failures:
            print('\n'.join(failures), file=sys.stderr)
            sys.exit(f'send self-test failed: {len(failures)} of {count} checks')
        print(f'send self-test passed: {count} checks')
        return
    if bool(a.folder) == bool(a.brand_kit):
        ap.error('give a folder to send, or --brand-kit KIT')
    if a.purpose is not None and (library.CONTROL.search(a.purpose) or not 0 < len(a.purpose.strip()) <= 200):
        ap.error('--purpose must be one line of up to 200 characters')
    unpacked = None
    try:
        if a.brand_kit:
            source = Path(a.brand_kit)
            if source.is_file() and source.suffix.lower() == '.zip':
                unpacked = Path(tempfile.mkdtemp(prefix='brand-kit-'))
                source = unzip(source, unpacked)
            planned = plan(kit_root(source), a.prefix, a.purpose, brand_kit=True)
        else:
            planned = plan(a.folder, a.prefix, a.purpose)
        if a.dry_run:
            for target, path, why in planned:
                print(f'{target}  ({size_text(path.stat().st_size)})\n    {why}')
            print(f'{len(planned)} files would be sent. Nothing was sent.')
            return
        done = send(planned, Engine(a.client))
    except (SendError, LibraryError) as error:
        sys.exit(f'send: {error}')
    finally:
        if unpacked:
            shutil.rmtree(unpacked, ignore_errors=True)
    print(f'Sent {done["sent"] + done["confirmed_only"]}, already there {done["already"]}. '
          "Krish's always-on machine writes them into the library within about ten minutes.")


if __name__ == '__main__':
    main()
