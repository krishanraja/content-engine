#!/usr/bin/env python3
"""recording: fetches Krish's recordings from the Video Engine Inbox into a
cloud session.

Krish, 2026-10-06, after a session told him it could not reach his file:
"figure out how to never make that error again". The Drive connector caps a
download at 10 MB and a recording runs 100 to 500 MB, so a session never takes
a recording from Drive. The recordings upload on both of his runner machines
(scripts/recordings-upload.ps1, every five minutes, whichever is online) reads
the Inbox and sends every finished recording to the engine's private storage
within about ten minutes; this fetches it.

    python scripts/post-pack/recording.py list                 the recordings, the newest first
    python scripts/post-pack/recording.py get NAME             the newest recording with that name
    python scripts/post-pack/recording.py get NAME --out DIR   into DIR (default .cache/recordings)
    python scripts/post-pack/recording.py get NAME --wait 15   wait up to 15 minutes for it to arrive
    python scripts/post-pack/recording.py --self-test

NAME is the file's name as it sits in the Inbox, `2026-10-06 take 1.mp4`. An
exact match wins; otherwise the match ignores case, and then a name without
its extension matches too. Every download is checked against its size and
sha256 before it is kept.

It authenticates exactly as scripts/engine.py does, with that file's own code:
the engine key from ENGINE_OPERATOR_TOKEN, or on Krish's Windows machines from
Windows Credential Manager. The key is never printed.

If a recording is not there, say which step failed: it is not yet in the
Inbox, the upload has not sent it (its log on Krish's machines says why), or this
download failed. Never tell Krish a recording cannot be reached.
"""
import argparse
import hashlib
import json
import os
import re
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
sys.path.insert(0, str(HERE.parent))
import engine  # noqa: E402  scripts/engine.py: the engine's address and key

DEFAULT_OUT = REPO / '.cache' / 'recordings'
POLL_SECONDS = 30
# The same rule the engine holds (api/library/_recordings.ts).
EXTENSIONS = {'mp4', 'mov', 'webm', 'mkv', 'm4a', 'wav', 'mp3'}
UNSAFE = re.compile(r'[<>:"/\\|?*\x00-\x1f\x7f-\x9f]')
RESERVED = re.compile(r'^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$', re.IGNORECASE)
DOWNLOAD_PATH = '/storage/v1/object/sign/content-library/recordings/'

PLAIN = {
    'unauthorized': 'the engine refused the key. Check ENGINE_OPERATOR_TOKEN (WORKBENCH.md, "Pick up from any tool")',
    'library_store_unconfigured': 'the engine has no storage address set',
    'library_store_unavailable': "the engine's storage cannot be reached, or its bucket is missing",
    'library_store_misconfigured': "the engine's library bucket is not set up as its migrations set it",
    'rate_limited': 'too many requests at once; wait a minute and ask again',
}


class RecordingError(RuntimeError):
    """A reason to stop, in words a person can act on."""


def safe_name(name):
    """True when name is one file name the engine would have taken."""
    if not isinstance(name, str) or not 0 < len(name) <= 200 or name in ('.', '..'):
        return False
    if name.startswith('.') or name != name.strip() or name.endswith('.') or UNSAFE.search(name) or RESERVED.match(name):
        return False
    return name.rsplit('.', 1)[-1].lower() in EXTENSIONS if '.' in name else False


def size_text(n):
    for unit in ('bytes', 'KB', 'MB', 'GB'):
        if n < 1000 or unit == 'GB':
            return f'{n} {unit}' if unit == 'bytes' else f'{n:.1f} {unit}'
        n /= 1000


def find(recordings, name):
    """The newest recording called name: an exact match first, then ignoring
    case, then without the extension. None when there is none."""
    def stem(text):
        return text.rsplit('.', 1)[0] if '.' in text else text
    tests = (
        lambda r: name in r.get('names', [r.get('name')]),
        lambda r: name.lower() in [n.lower() for n in r.get('names', [r.get('name')])],
        lambda r: stem(name).lower() in [stem(n).lower() for n in r.get('names', [r.get('name')])],
    )
    for test in tests:
        found = [r for r in recordings if test(r)]
        if found:
            return max(found, key=lambda r: r.get('uploaded_at', ''))
    return None


# ---------------------------------------------------------------- the engine

class Engine:
    """GET /api/library/recordings on the engine key, through scripts/engine.py."""

    def __init__(self):
        try:
            self.token = engine.operator_key()
        except engine.NoKey as no_key:
            raise RecordingError(str(no_key))

    def recordings(self):
        try:
            status, text = engine.call('GET', '/api/library/recordings?limit=200', None, self.token, timeout=120)
        except engine.Unreachable as unreachable:
            raise RecordingError(str(unreachable))
        try:
            body = json.loads(text)
        except json.JSONDecodeError:
            body = {}
        if not (200 <= status < 300 and isinstance(body, dict) and body.get('ok') is True):
            error = body.get('error') if isinstance(body, dict) else None
            code = error.get('code') if isinstance(error, dict) else error
            words = PLAIN.get(code, f'the engine answered {status}')
            if status == 404:
                words = 'the engine has no recordings route yet: the recordings lane is not deployed'
            raise RecordingError(f'listing the recordings failed: {words} [{code or status}]')
        return [r for r in body.get('recordings', []) if isinstance(r, dict)]

    def download(self, url, handle):
        """Streams the signed URL into handle."""
        request = urllib.request.Request(url, method='GET')
        try:
            with urllib.request.urlopen(request, timeout=600) as response:
                while True:
                    block = response.read(1024 * 1024)
                    if not block:
                        break
                    handle.write(block)
        except urllib.error.HTTPError as error:
            raise RecordingError(f'the download from storage answered {error.code}')
        except urllib.error.URLError as error:
            raise RecordingError(f'the download could not reach storage ({error.reason})')


def check_download_url(url):
    parts = urlsplit(url or '')
    if parts.scheme != 'https' or parts.username or parts.password or parts.fragment \
            or not parts.path.startswith(DOWNLOAD_PATH):
        raise RecordingError('the engine gave a download address that is not its signed recordings storage: nothing was fetched')


def get(engine_api, name, out_dir, wait_minutes=0, out=print, sleep=time.sleep, now=time.monotonic):
    """Downloads the newest recording called name into out_dir and returns its
    path. Waits up to wait_minutes for it to appear."""
    deadline = now() + wait_minutes * 60
    said = False
    while True:
        recording = find(engine_api.recordings(), name)
        if recording or now() >= deadline:
            break
        if not said:
            out(f'"{name}" has not reached the engine yet. Waiting up to {wait_minutes:g} minutes '
                f'(the upload on Krish\'s runner machines sends a finished recording within about ten).')
            said = True
        sleep(POLL_SECONDS)
    if not recording:
        raise RecordingError(
            f'no recording called "{name}" has reached the engine. Either it is not in the Video Engine Inbox yet, '
            f'or the recordings upload on Krish\'s runner machines has not sent it (neither is online, or the '
            f'upload failed): its log on each machine is '
            f'Documents\\MindmakeVideoStudio\\recordings-upload\\recordings-upload.log. '
            f'Run "recording.py list" to see what has arrived, or "get NAME --wait 15" to wait for it.')

    kept = recording.get('name')
    sha, size = recording.get('sha256'), recording.get('bytes')
    if not safe_name(kept) or not isinstance(sha, str) or not re.fullmatch(r'[a-f0-9]{64}', sha) \
            or not isinstance(size, int) or size < 1:
        raise RecordingError(f'the engine described "{name}" in a way this tool does not trust: nothing was fetched')
    url = (recording.get('download') or {}).get('url')
    check_download_url(url)

    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / kept
    if target.is_file() and target.stat().st_size == size and sha256_of(target) == sha:
        out(f'already here  {target}  ({size_text(size)}, sha256 checked)')
        return target
    handle = tempfile.NamedTemporaryFile(dir=out_dir, prefix='.recording-', suffix='.part', delete=False)
    partial = Path(handle.name)
    try:
        with handle:
            engine_api.download(url, handle)
        got = partial.stat().st_size
        if got != size:
            raise RecordingError(f'the download of "{kept}" is {got} bytes, and the recording is {size}: it was not kept')
        if sha256_of(partial) != sha:
            raise RecordingError(f'the download of "{kept}" does not match its sha256: it was not kept')
        os.replace(partial, target)
    finally:
        if partial.exists():
            partial.unlink()
    out(f'fetched  {target}  ({size_text(size)}, sha256 checked)')
    return target


def sha256_of(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def show(recordings, out=print):
    if not recordings:
        out('No recordings have reached the engine yet.')
        return
    for r in recordings:
        others = [n for n in r.get('names', []) if n != r.get('name')]
        also = f'  (also sent as {", ".join(others)})' if others else ''
        out(f'{r.get("uploaded_at", "")[:16].replace("T", " ")}  {size_text(int(r.get("bytes", 0))):>9}  '
            f'{r.get("name")}  sha256 {str(r.get("sha256", ""))[:12]}{also}')


# ---------------------------------------------------------------- self-test

class FakeEngine:
    """The list route and storage, in memory, for the self-test."""

    def __init__(self):
        self.items, self.blobs, self.lists, self.fail_bytes = [], {}, 0, None

    def add(self, name, data, at, names=None):
        sha = hashlib.sha256(data).hexdigest()
        self.blobs[sha] = data
        self.items.append({'name': name, 'names': names or [name], 'bytes': len(data), 'sha256': sha,
                           'content_type': 'video/mp4', 'uploaded_at': at,
                           'download': {'method': 'GET', 'url': f'https://store.invalid{DOWNLOAD_PATH}{sha}.mp4?token=x'}})

    def recordings(self):
        self.lists += 1
        return sorted(self.items, key=lambda r: r['uploaded_at'], reverse=True)

    def download(self, url, handle):
        sha = url.split(DOWNLOAD_PATH, 1)[1].split('.', 1)[0]
        handle.write(self.fail_bytes if self.fail_bytes is not None else self.blobs[sha])


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
        except RecordingError as error:
            if want not in str(error):
                failures.append(f'{label}: refused with {str(error)!r}, want {want!r}')
            return
        failures.append(f'{label}: gave {got!r}, want a refusal containing {want!r}')

    quiet = lambda line: None
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        fake = FakeEngine()
        fake.add('take 1.mp4', b'first take', '2026-10-06T08:00:00.000Z')
        fake.add('take 1.mp4', b'second take, same name', '2026-10-06T09:00:00.000Z')
        fake.add('Interview.MOV', b'interview', '2026-10-06T07:00:00.000Z', names=['Interview.MOV', 'old name.mov'])

        lines = []
        show(fake.recordings(), lines.append)
        check('list: the newest first', [line.split('  ')[2].strip() for line in lines][:1], ['take 1.mp4'])
        check('list: other names shown', 'also sent as old name.mov' in lines[-1], True)

        path = get(fake, 'take 1.mp4', tmp / 'out', out=quiet)
        check('get: the newest with that name', path.read_bytes(), b'second take, same name')
        check('get: kept under its own name', path.name, 'take 1.mp4')
        check('get: no partial file left', [p.name for p in (tmp / 'out').iterdir()], ['take 1.mp4'])
        said = []
        get(fake, 'take 1.mp4', tmp / 'out', out=said.append)
        check('get again: already here, nothing fetched', said[0].startswith('already here'), True)
        check('get: ignoring case', get(fake, 'interview.mov', tmp / 'out', out=quiet).read_bytes(), b'interview')
        check('get: by another name it came in under', get(fake, 'old name.mov', tmp / 'b', out=quiet).read_bytes(), b'interview')
        check('get: without the extension', get(fake, 'take 1', tmp / 'c', out=quiet).read_bytes(), b'second take, same name')

        fake.fail_bytes = b'second take, same nam!'
        refused('get: a download that does not match its sha256', lambda: get(fake, 'take 1.mp4', tmp / 'd', out=quiet), 'does not match its sha256')
        check('get: nothing kept after a bad download', list((tmp / 'd').iterdir()), [])
        fake.fail_bytes = b'short'
        refused('get: a download of the wrong size', lambda: get(fake, 'take 1.mp4', tmp / 'd', out=quiet), 'it was not kept')
        fake.fail_bytes = None

        clock = {'t': 0.0}
        slept = []

        def tick(seconds):
            slept.append(seconds)
            clock['t'] += seconds
            if len(slept) == 3:
                fake.add('just dropped.mp4', b'new', '2026-10-06T10:00:00.000Z')
        waited = get(fake, 'just dropped.mp4', tmp / 'out', wait_minutes=5, out=quiet, sleep=tick, now=lambda: clock['t'])
        check('--wait: polls until it appears', (waited.read_bytes(), len(slept)), (b'new', 3))
        clock['t'], slept[:] = 0.0, []
        refused('--wait: gives up at the deadline and says which step to check',
                lambda: get(fake, 'never.mp4', tmp / 'out', wait_minutes=1, out=quiet, sleep=tick, now=lambda: clock['t']),
                'recordings-upload.log')
        check('--wait: polled for the whole minute', sum(slept), 60)
        refused('no wait: it has not arrived', lambda: get(fake, 'never.mp4', tmp / 'out', out=quiet), 'has not sent it')

        for bad in ('../escape.mp4', 'a/b.mp4', 'a\\b.mp4', '.hidden.mp4', 'con.mp4', 'take.txt', 'take.mp4 '):
            fake.items.append({**fake.items[0], 'name': bad, 'names': [bad], 'uploaded_at': '2026-10-07T00:00:00.000Z'})
            refused(f'a name this tool does not trust: {bad!r}', lambda bad=bad: get(fake, bad, tmp / 'e', out=quiet), 'does not trust')
            fake.items.pop()
        check('nothing landed outside', (tmp / 'escape.mp4').exists(), False)
        for url in ('http://store.invalid' + DOWNLOAD_PATH + 'x', 'https://store.invalid/storage/v1/object/sign/content-library/files/x',
                    'https://u:p@store.invalid' + DOWNLOAD_PATH + 'x'):
            refused(f'a download address that is not recordings storage: {url}', lambda url=url: check_download_url(url), 'nothing was fetched')
        check('a safe name', safe_name('2026-10-06 take 1.MP4'), True)
    return count, failures


def main():
    ap = argparse.ArgumentParser(description="Fetch Krish's recordings from the Video Engine Inbox into this session.")
    ap.add_argument('command', nargs='?', choices=['list', 'get'], help='list the recordings, or get one')
    ap.add_argument('name', nargs='?', help='for get: the file name as it sits in the Inbox')
    ap.add_argument('--out', default=str(DEFAULT_OUT), help='for get: the folder to put it in (default: %(default)s)')
    ap.add_argument('--wait', type=float, default=0, metavar='MINUTES', help='for get: wait this long for it to arrive')
    ap.add_argument('--json', action='store_true', help='for list: print the engine\'s answer as JSON')
    ap.add_argument('--self-test', action='store_true', help='check finding, waiting and downloading against a stand-in (no network)')
    a = ap.parse_args()
    if a.self_test:
        count, failures = self_test()
        if failures:
            print('\n'.join(failures), file=sys.stderr)
            sys.exit(f'recording self-test failed: {len(failures)} of {count} checks')
        print(f'recording self-test passed: {count} checks')
        return
    if not a.command:
        ap.error('say list, or get NAME')
    if a.command == 'get' and not a.name:
        ap.error('get needs the recording\'s name, as it sits in the Inbox')
    if not 0 <= a.wait <= 240:
        ap.error('--wait is minutes, from 0 to 240')
    try:
        api = Engine()
        if a.command == 'list':
            recordings = api.recordings()
            if a.json:
                print(json.dumps([{k: v for k, v in r.items() if k != 'download'} for r in recordings], indent=2))
            else:
                show(recordings)
            return
        get(api, a.name, a.out, a.wait)
    except RecordingError as error:
        sys.exit(f'recording: {error}')


if __name__ == '__main__':
    main()
