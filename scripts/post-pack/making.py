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
    python making.py PIECE_ID scripts long.md short.md       # story_check on each, by position; records
    python making.py PIECE_ID pack PACK_FOLDER [--sent]      # build.py and send.py call this themselves
    python making.py PIECE_ID recorded long "recordings/<sha256>.mp4" [--seconds N]
    python making.py PIECE_ID video long NAME PATH [--url https://...] [--seconds N]
                     [--thumb PATH [--thumb-url https://...]] [--music TRACK_ID]
    python making.py PIECE_ID posted substack https://...    # after Krish posted it
    python making.py PIECE_ID session https://claude.ai/code/session_...
    python making.py --by Codex PIECE_ID ...                 # who wrote it
    python making.py --self-test

Every write says who wrote it: --by NAME, else the MAKING_BY environment
variable, else "Claude Code". Codex sets --by Codex (or MAKING_BY=Codex, which
build.py and send.py pass on too), so the board never credits the wrong tool.

A video asset carries its thumbnail (Krish, 2026-10-12: "I always want a video
thumbnail for all video sizes produced as an asset every time") and the
licensed music track behind it. The Video assets step is done only when both
cuts are there, each with its thumbnail.

Everything here records something that already happened. It never sends,
posts, spends or deletes. A piece id is the content_ideas row (post.json
"piece_id"). The engine key comes from scripts/engine.py, never from here.
"""
import argparse
import contextlib
import io
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
import engine  # noqa: E402

CHANNELS = ('substack', 'youtube', 'shorts', 'tiktok', 'reels', 'linkedin', 'whatsapp', 'notes')
CUTS = ('long', 'short')
UUID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)
BY_ENV = 'MAKING_BY'
DEFAULT_BY = 'Claude Code'
MAX_BY = 60  # the engine keeps the first 60 characters (content-ideas/[id]/making.ts)


class MakingError(Exception):
    pass


def now():
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def default_by():
    """Who is writing when nobody said: MAKING_BY, else Claude Code."""
    return (os.environ.get(BY_ENV) or '').strip() or DEFAULT_BY


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
    status, text = call('POST', f'/api/content-ideas/{piece_id}/making', body)
    try:
        data = json.loads(text) if text else {}
    except ValueError:
        data = {'raw': text[:300]}
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


def show(piece_id, call=None):
    call = call or _engine_call
    status, text = call('GET', f'/api/content-ideas/{piece_id}/making', None)
    if status != 200:
        raise MakingError(f'HTTP {status}: {text[:200]}')
    data = json.loads(text)
    lines = []
    for step in data.get('steps') or []:
        mark = {'done': 'done ', 'now': 'now  ', 'todo': '     ', 'failed': 'FAIL '}[step['state']]
        note = f"  {step['note']}" if step.get('note') else ''
        link = f"  {step['link']}" if step.get('link') else ''
        lines.append(f"{mark}{step['label']}{note}{link}")
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


def scripts_patch(paths, run=None, warn=None):
    """Checks the two scripts by position: the first is the long cut, the
    second the short (house rule TWO_CUTS, Krish, 2026-10-11: every piece
    gets both). A missing script, or one that fails its check, records
    passed false. A file name that says the other cut only warns: the
    position decides, so a 450-word script cannot pass as the short cut, or
    one script mark Scripts done, by what it is called."""
    import story_check
    run = run or _story_check
    warn = warn or (lambda line: print(line, file=sys.stderr))
    paths = list(paths or [])
    if not paths or len(paths) > len(CUTS):
        raise MakingError('give the two scripts, the long cut first: scripts long.md short.md')
    problems, cuts = [], []
    for cut, p in zip(CUTS, paths):
        name = Path(p).name
        said = story_check.cut_of(name)
        if said and said != cut:
            warn(f'making: {name} says it is the {said} cut but is in the {cut} cut\'s place; '
                 f'it is checked as the {cut} cut (the long cut comes first, then the short)')
        if not Path(p).is_file():
            problems.append(f'{cut} cut: {name} is not there')
            continue
        cuts.append(cut)
        code, out = run(cut, p)
        if code != 0:
            lines = [line.strip() for line in out.strip().splitlines() if line.strip()]
            problems.extend([f'{name}: {line}' for line in lines][:10] or [f'{name}: the {cut} cut failed its check'])
    for cut in CUTS[len(paths):]:
        problems.append(f'{cut} cut: no script given; every piece gets both cuts (scripts long.md short.md)')
    return {'script_check': {'passed': not problems, 'problems': problems, 'cuts': cuts, 'checked_at': now()}}


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


def recorded_patch(cut, path, seconds=None):
    """One recording of one cut. The path is the engine's copy,
    "recordings/<sha256>.<ext>" (recording_match.py writes it so), which
    says exactly which take it was."""
    if not isinstance(path, str) or not path.strip():
        raise MakingError('give the recording\'s path, "recordings/<sha256>.<ext>"')
    rec = {'cut': _cut(cut), 'path': path.strip()}
    if seconds:
        rec['seconds'] = int(seconds)
    return {'recordings': [rec]}


def video_patch(cut, name, path, url=None, seconds=None, thumb=None, thumb_url=None, music=None):
    """One finished video of one cut, with its thumbnail and its music.
    Krish, 2026-10-12: "I always want a video thumbnail for all video sizes
    produced as an asset every time"; a cut without one leaves the Video
    assets step open."""
    asset = {'cut': _cut(cut), 'name': name, 'path': path}
    if url:
        asset['url'] = url
    if seconds:
        asset['seconds'] = int(seconds)
    if thumb_url and not thumb:
        raise MakingError("--thumb-url needs --thumb, the thumbnail's path beside the video")
    if thumb_url and not str(thumb_url).startswith('https://'):
        raise MakingError('--thumb-url must be an https link')
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

    # Who wrote it: --by, else MAKING_BY, else Claude Code, on every write.
    saved = os.environ.pop(BY_ENV, None)
    try:
        post(pid, {'workroom': {'url': 'https://claude.ai/artifact/a'}}, fake)
        check('a write with nobody named is by Claude Code', seen[-1][2].get('by'), 'Claude Code')
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
        if saved is not None:
            os.environ[BY_ENV] = saved

    def run(argv):
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = main(argv, call=fake)
        return code, err.getvalue()

    code, _ = run(['--by', 'Codex', pid, 'video', 'long', 'Substack video', '3 Video/long.mp4', '--url', 'https://drive.google.com/v',
                   '--seconds', '184', '--thumb', '3 Video/thumb-wide-1280x720.jpg', '--thumb-url', 'https://drive.google.com/t', '--music', 'track-one'])
    body = seen[-1][2]
    check('video: written by Codex', (code, body.get('by')), (0, 'Codex'))
    check('video: the asset carries its thumbnail, music and length', body['video_assets'][0],
          {'cut': 'long', 'name': 'Substack video', 'path': '3 Video/long.mp4', 'url': 'https://drive.google.com/v', 'seconds': 184,
           'thumbnail': {'path': '3 Video/thumb-wide-1280x720.jpg', 'url': 'https://drive.google.com/t'}, 'music': 'track-one'})
    run([pid, 'video', 'short', 'Shorts video', '3 Video/short.mp4', '--thumb', '3 Video/thumb-tall-1080x1920.jpg'])
    check('video: a thumbnail with no link is just its path', seen[-1][2]['video_assets'][0]['thumbnail'], {'path': '3 Video/thumb-tall-1080x1920.jpg'})
    check('video: no music given, none sent', 'music' in seen[-1][2]['video_assets'][0], False)
    before = len(seen)
    code, err = run([pid, 'video', 'short', 'Shorts video', '3 Video/short.mp4', '--thumb-url', 'https://drive.google.com/t'])
    check('video: a thumbnail link with no thumbnail path is refused, and nothing is sent', (code, 'needs --thumb' in err, len(seen)), (1, True, before))
    code, err = run([pid, 'video', 'short', 'Shorts video', '3 Video/short.mp4', '--thumb', 't.jpg', '--thumb-url', 'http://plain'])
    check('video: a thumbnail link must be https', (code, 'https' in err, len(seen)), (1, True, before))
    code, err = run([pid, 'video', 'wide', 'Shorts video', '3 Video/short.mp4'])
    check('video: a cut that is neither long nor short is refused', (code, 'long or short' in err, len(seen)), (1, True, before))
    run(['--by', 'Codex', pid, 'recorded', 'short', 'recordings/' + 'a' * 64 + '.mp4', '--seconds', '118'])
    check('recorded: the engine copy, its length and who recorded it', (seen[-1][2]['recordings'], seen[-1][2]['by']),
          ([{'cut': 'short', 'path': 'recordings/' + 'a' * 64 + '.mp4', 'seconds': 118}], 'Codex'))
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
    ap.add_argument('--by', help=f'who is writing: Codex, Claude Code (default: {BY_ENV}, else {DEFAULT_BY})')
    ap.add_argument('--sent', action='store_true', help='with pack: the pack was sent to the library')
    ap.add_argument('--seconds', type=int, help='with recorded or video: how long it runs')
    ap.add_argument('--url', help='with video: the https link to the finished video')
    ap.add_argument('--thumb', metavar='PATH', help="with video: the thumbnail's path, beside the video (every cut has one)")
    ap.add_argument('--thumb-url', metavar='URL', help="with video and --thumb: the thumbnail's https link")
    ap.add_argument('--music', metavar='TRACK_ID', help='with video: the licensed track behind it (config/music-library.json)')
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
            patch = scripts_patch(a.args)
        elif a.what == 'pack':
            patch = pack_patch(a.args[0], a.sent)
        elif a.what == 'recorded':
            patch = recorded_patch(a.args[0], a.args[1], a.seconds)
        elif a.what == 'video':
            patch = video_patch(a.args[0], a.args[1], a.args[2], url=a.url, seconds=a.seconds,
                                thumb=a.thumb, thumb_url=a.thumb_url, music=a.music)
        elif a.what == 'posted':
            channel = a.args[0]
            if channel not in CHANNELS:
                ap.error(f'channel must be one of {", ".join(CHANNELS)}')
            patch = {'channels': {channel: {'url': a.args[1]} if len(a.args) > 1 else {}}}
        else:
            patch = {'session': {'url': a.args[0], 'by': by}}
        data = post(a.piece_id, patch, call, by=by)
    except (MakingError, IndexError, OSError) as error:
        print(f'making: {error}', file=sys.stderr)
        return 1
    for step in data.get('steps') or []:
        print(f"{step['state']:6} {step['label']}" + (f"  {step['note']}" if step.get('note') else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main())
