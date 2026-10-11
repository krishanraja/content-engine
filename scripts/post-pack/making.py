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
    python making.py PIECE_ID scripts long.md [short.md]     # runs story_check on each, records
    python making.py PIECE_ID pack PACK_FOLDER [--sent]      # build.py and send.py call this themselves
    python making.py PIECE_ID recorded long PATH [--seconds N]
    python making.py PIECE_ID video long NAME PATH [--url https://...]
    python making.py PIECE_ID posted substack https://...    # after Krish posted it
    python making.py PIECE_ID session https://claude.ai/code/session_...
    python making.py --self-test

Everything here records something that already happened. It never sends,
posts, spends or deletes. A piece id is the content_ideas row (post.json
"piece_id"). The engine key comes from scripts/engine.py, never from here.
"""
import argparse
import json
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


class MakingError(Exception):
    pass


def now():
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def post(piece_id, patch, call=None):
    """One write. Returns the engine's answer as a dict, or raises MakingError."""
    if not UUID.match(piece_id or ''):
        raise MakingError('the piece id must be the content_ideas uuid (post.json "piece_id")')
    call = call or _engine_call
    status, text = call('POST', f'/api/content-ideas/{piece_id}/making', patch)
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


def scripts_patch(paths):
    problems, cuts = [], []
    for p in paths:
        text = Path(p).read_text(encoding='utf-8')
        import story_check
        cut = story_check.cut_of(Path(p).name) or ('short' if len(text.split()) < 300 else 'long')
        result = subprocess.run([sys.executable, str(HERE / 'story_check.py'), '--cut', cut, str(p)], capture_output=True, text=True)
        cuts.append(cut)
        if result.returncode != 0:
            out = (result.stdout + result.stderr).strip().splitlines()
            problems.extend([f'{Path(p).name}: {line.strip()}' for line in out if line.strip()][:10])
    return {'script_check': {'passed': not problems, 'problems': problems, 'cuts': sorted(set(cuts), key=CUTS.index), 'checked_at': now()}}


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
    if fails:
        print('making self-test FAILED:\n  ' + '\n  '.join(fails))
        return 1
    print(f'making self-test passed: {count} checks')
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(description="Record where a piece is, for Control Center's board.")
    ap.add_argument('piece_id', nargs='?')
    ap.add_argument('what', nargs='?', choices=['show', 'workroom', 'publish-manager', 'visual-gate', 'scripts', 'pack', 'recorded', 'video', 'posted', 'session'])
    ap.add_argument('args', nargs='*')
    ap.add_argument('--sent', action='store_true', help='with pack: the pack was sent to the library')
    ap.add_argument('--seconds', type=int)
    ap.add_argument('--url')
    ap.add_argument('--self-test', action='store_true')
    a = ap.parse_args(argv)
    if a.self_test:
        return self_test()
    if not a.piece_id or not a.what:
        ap.error('give PIECE_ID and what to record')
    try:
        if a.what == 'show':
            print(show(a.piece_id))
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
            cut, path = a.args[0], a.args[1]
            rec = {'cut': cut, 'path': path}
            if a.seconds:
                rec['seconds'] = a.seconds
            patch = {'recordings': [rec]}
        elif a.what == 'video':
            cut, name, path = a.args[0], a.args[1], a.args[2]
            asset = {'cut': cut, 'name': name, 'path': path}
            if a.url:
                asset['url'] = a.url
            patch = {'video_assets': [asset]}
        elif a.what == 'posted':
            channel = a.args[0]
            if channel not in CHANNELS:
                ap.error(f'channel must be one of {", ".join(CHANNELS)}')
            patch = {'channels': {channel: {'url': a.args[1]} if len(a.args) > 1 else {}}}
        else:
            patch = {'session': {'url': a.args[0]}}
        data = post(a.piece_id, patch)
    except (MakingError, IndexError, OSError) as error:
        print(f'making: {error}', file=sys.stderr)
        return 1
    for step in data.get('steps') or []:
        print(f"{step['state']:6} {step['label']}" + (f"  {step['note']}" if step.get('note') else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main())
