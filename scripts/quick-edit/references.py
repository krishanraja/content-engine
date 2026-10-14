#!/usr/bin/env python3
"""references: the videos Krish wants his to look and sound like, studied.

Krish, 2026-10-14: "Can you set up a folder where I can put videos that I
really like the production quality of, as well as the narrative style,
editing, camerawork, zooming, the way they break down a point, and the tone
and style of communication, so that you can learn from them?"

The folder is the Video Engine's Inspiration folder in Drive
(H:\\My Drive\\Ventures\\Active\\makeyourmindup\\Video Engine\\Inspiration on
the home computers). He drops a video there, and optionally writes what he
likes about it in the "What I like" sheet beside it. Then:

    python references.py publish             (a home computer, every pass of
                                              recordings-upload.ps1: sends each
                                              video to the engine's library)
    python references.py fetch [--out DIR]   (any machine: gets them back)
    python references.py study FILE [--out DIR]
        Measures one video: every shot and cut, the pace (cuts a minute,
        shot lengths), the zoom and push-ins (frame-to-frame scale change),
        the words (a transcript with timings, words a minute, the first
        ten seconds), loudness, and a contact sheet with one frame a shot.
        Writes study.json and contact.jpg for a session to read and look at.
    python references.py --self-test

A study measures; it does not judge. The judging (what to borrow, in which
part of the craft) is written by a session into config/style-references.json
with Krish's own words, as docs/STYLE_REFERENCES.md says. A move becomes a
house default only when Krish says so.
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import statistics
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
LEDGER = REPO / 'config' / 'style-references.json'
LIBRARY_REFERENCES = '1 Brand kit (permanent)/Style references'
FETCH_DEFAULT = REPO / '.cache' / 'references'
VIDEO_EXTENSIONS = {'.mp4', '.mov', '.webm', '.m4v'}
SCENE_THRESHOLD = 0.30  # ffmpeg scene score that counts as a cut
CRAFT = ('narrative', 'editing', 'camerawork', 'zoom', 'breakdown', 'tone', 'production')


class ReferenceError(Exception):
    pass


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1 << 20), b''):
            h.update(block)
    return h.hexdigest()


def inspiration_folder():
    """The Inspiration folder on this machine, or None."""
    env = os.environ.get('MINDMAKE_INSPIRATION')
    if env:
        return Path(env)
    drive = os.environ.get('MINDMAKE_DRIVE_ROOT')
    if not drive:
        try:
            cfg = json.loads((REPO / 'config' / 'studio.json').read_text())
            drive = (cfg.get('runtime') or {}).get('drive_root')
        except (OSError, ValueError):
            drive = None
    return Path(drive) / 'Inspiration' if drive else None


def _post_pack():
    here = Path(__file__).resolve().parents[1]
    for sub in (here, here / 'post-pack'):
        if str(sub) not in sys.path:
            sys.path.insert(0, str(sub))


def cmd_publish(out=print):
    folder = inspiration_folder()
    if not folder or not folder.is_dir():
        raise ReferenceError('the Inspiration folder is not reachable here (MINDMAKE_INSPIRATION, MINDMAKE_DRIVE_ROOT, or runtime.drive_root in config/studio.json)')
    planned = [(f'{LIBRARY_REFERENCES}/{p.name}', p, 'a style reference Krish chose: studied, never published')
               for p in sorted(folder.iterdir())
               if p.is_file() and p.suffix.lower() in VIDEO_EXTENSIONS and not p.name.startswith('.')]
    if not planned:
        return {'sent': 0}
    _post_pack()
    import send  # scripts/post-pack/send.py
    try:
        return send.send(planned, send.Engine('references-publish'), out=out)
    except send.SendError as error:
        raise ReferenceError(str(error))


def cmd_fetch(out_dir=None, names=None, out=print):
    """Downloads the references the library holds. With names, only those."""
    import urllib.parse
    import urllib.request
    _post_pack()
    import engine  # scripts/engine.py
    folder = Path(out_dir or FETCH_DEFAULT)
    folder.mkdir(parents=True, exist_ok=True)
    token = engine.operator_key()
    wanted = names or [r['file'] for r in load_ledger()['references'] if r.get('file')]
    got = []
    for name in wanted:
        target = folder / name
        if target.is_file():
            out(f'have           {name}')
            got.append(target)
            continue
        status, text = engine.call('GET', '/api/library/file?path=' + urllib.parse.quote(f'{LIBRARY_REFERENCES}/{name}'), None, token, timeout=60)
        answer = json.loads(text) if text and text.strip().startswith('{') else {}
        if status == 404:
            out(f'not yet        {name} (a home computer sends it on its next pass of recordings-upload.ps1)')
            continue
        url = ((answer.get('download') or {}).get('url')) if isinstance(answer, dict) else None
        if status != 200 or not url or not url.startswith('https://'):
            raise ReferenceError(f'{name}: the library answered {status}')
        part = target.with_suffix(target.suffix + '.part')
        with urllib.request.urlopen(url, timeout=600) as response, open(part, 'wb') as handle:
            shutil.copyfileobj(response, handle)
        part.replace(target)
        out(f'fetched        {name}  ({target.stat().st_size} bytes)')
        got.append(target)
    return got


# ---- the study -----------------------------------------------------------------

def probe(path):
    raw = subprocess.run(['ffprobe', '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', str(path)],
                         capture_output=True, text=True, check=True).stdout
    data = json.loads(raw)
    v = next((s for s in data['streams'] if s.get('codec_type') == 'video'), {})
    num, _, den = (v.get('r_frame_rate') or '0/1').partition('/')
    return {
        'duration_s': round(float(data['format'].get('duration', 0)), 2),
        'width': v.get('width'), 'height': v.get('height'),
        'fps': round(float(num) / float(den or 1), 2) if float(den or 1) else None,
        'has_audio': any(s.get('codec_type') == 'audio' for s in data['streams']),
    }


def cut_times(path, threshold=SCENE_THRESHOLD):
    """Seconds at which the picture changes shot (ffmpeg scene detection)."""
    run = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(path), '-filter:v',
                          f"select='gt(scene,{threshold})',showinfo", '-an', '-f', 'null', '-'],
                         capture_output=True, text=True)
    return [round(float(t), 2) for t in re.findall(r'pts_time:([0-9.]+)', run.stderr)]


def shots_from_cuts(cuts, duration):
    edges = [0.0] + [c for c in cuts if 0 < c < duration] + [duration]
    return [{'start': round(a, 2), 'end': round(b, 2), 'length': round(b - a, 2)} for a, b in zip(edges, edges[1:]) if b - a > 0.04]


def pace(shots, duration):
    lengths = [s['length'] for s in shots]
    if not lengths:
        return {}
    return {
        'shots': len(shots),
        'cuts_per_minute': round((len(shots) - 1) / (duration / 60), 1) if duration else None,
        'median_shot_s': round(statistics.median(lengths), 2),
        'shortest_shot_s': min(lengths),
        'longest_shot_s': max(lengths),
        'shots_under_1s': sum(1 for x in lengths if x < 1),
        'shots_over_5s': sum(1 for x in lengths if x > 5),
        'first_cut_s': shots[1]['start'] if len(shots) > 1 else None,
    }


def zoom_moves(path, duration, step=0.5):
    """Push-ins and pull-outs: the scale change between frames half a second
    apart inside one shot, estimated with OpenCV's ECC affine fit when OpenCV
    is present. Returns None without OpenCV (the study says so)."""
    try:
        import cv2  # noqa: F401
        import numpy as np
    except ImportError:
        return zoom_moves_pillow(path, duration, step)
    import cv2
    cap = cv2.VideoCapture(str(path))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    moves, prev, t = [], None, 0.0
    while t < duration:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(t * fps))
        ok, frame = cap.read()
        if not ok:
            break
        g = cv2.cvtColor(cv2.resize(frame, (320, int(320 * frame.shape[0] / frame.shape[1]))), cv2.COLOR_BGR2GRAY)
        if prev is not None:
            warp = np.eye(2, 3, dtype=np.float32)
            try:
                _, warp = cv2.findTransformECC(prev, g, warp, cv2.MOTION_AFFINE,
                                               (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 50, 1e-4))
                scale = float(np.sqrt(abs(np.linalg.det(warp[:, :2]))))
                if abs(scale - 1) > 0.02:
                    moves.append({'t': round(t, 2), 'scale_per_half_second': round(scale, 3),
                                  'kind': 'push in' if scale < 1 else 'pull out'})
            except cv2.error:
                pass  # a cut or a frame ECC cannot fit: not a zoom
        prev = g
        t += step
    return moves


def zoom_moves_pillow(path, duration, step=0.5, cuts=None):
    """The same measure without OpenCV: for frames half a second apart, the
    centre-crop scale that best matches the next frame (Pillow and NumPy).
    None when neither is present."""
    try:
        import numpy as np
        from PIL import Image
    except ImportError:
        return None
    cuts = cuts if cuts is not None else cut_times(path)
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-vf', f'fps={1 / step},scale=240:-2,format=gray',
                        f'{tmp}/z%05d.png'], check=True)
        frames = sorted(Path(tmp).glob('z*.png'))
        moves = []
        scales = [1 + k * 0.005 for k in range(-16, 17)]
        prev = None
        for i, f in enumerate(frames):
            img = Image.open(f).convert('L')
            t = round(i * step, 2)
            if prev is not None and not any(t - step < c <= t for c in cuts):
                w, h = prev.size
                b = np.asarray(img, dtype=np.float32)[h // 6: h - h // 6, w // 6: w - w // 6]
                best, best_err = 1.0, None
                for s in scales:
                    sw, sh = round(w * s), round(h * s)
                    a = prev.resize((sw, sh), Image.BILINEAR)
                    left, top = (sw - w) // 2, (sh - h) // 2
                    a = np.asarray(a.crop((left, top, left + w, top + h)), dtype=np.float32)[h // 6: h - h // 6, w // 6: w - w // 6]
                    err = float(((a - b) ** 2).mean())
                    if best_err is None or err < best_err:
                        best, best_err = s, err
                if abs(best - 1) >= 0.01:
                    moves.append({'t': t, 'scale_per_half_second': round(best, 3), 'kind': 'push in' if best > 1 else 'pull out'})
            prev = img
    return moves


def transcript(path):
    """Words with timings, when faster-whisper runs here; else None."""
    try:
        from faster_whisper import WhisperModel
    except Exception:  # noqa: BLE001 the study runs without words
        return None
    model = WhisperModel(os.environ.get('MINDMAKE_REFERENCE_MODEL', 'small'), device='cpu', compute_type='int8')
    segments, _ = model.transcribe(str(path), word_timestamps=False, vad_filter=True)
    return [{'start': round(s.start, 2), 'end': round(s.end, 2), 'text': s.text.strip()} for s in segments]


def speech_summary(segments, duration):
    if not segments:
        return {}
    words = sum(len(s['text'].split()) for s in segments)
    spoken = sum(s['end'] - s['start'] for s in segments)
    first = ' '.join(s['text'] for s in segments if s['start'] < 10)
    return {
        'words': words,
        'words_per_minute': round(words / (spoken / 60), 0) if spoken else None,
        'speech_share_of_runtime': f'{round(spoken)} of {round(duration)} seconds',
        'first_10_seconds': first,
        'questions_asked': sum(s['text'].count('?') for s in segments),
    }


def loudness(path):
    run = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(path), '-af', 'ebur128', '-f', 'null', '-'],
                         capture_output=True, text=True)
    m = re.findall(r'I:\s+(-?[0-9.]+) LUFS', run.stderr)
    return float(m[-1]) if m else None


def contact_sheet(path, shots, out_file, cols=6, width=320):
    """One frame from the middle of each shot (at most 48), tiled, so a
    session can look at the framing, text and graphics of every shot."""
    picks = shots if len(shots) <= 48 else [shots[round(i * (len(shots) - 1) / 47)] for i in range(48)]
    with tempfile.TemporaryDirectory() as tmp:
        for i, s in enumerate(picks):
            mid = (s['start'] + s['end']) / 2
            subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{mid:.2f}', '-i', str(path), '-frames:v', '1',
                            '-vf', f'scale={width}:-2,drawtext=text=\'{mid:.1f}s\':x=6:y=6:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.6',
                            f'{tmp}/f{i:03d}.jpg'], check=True)
        rows = (len(picks) + cols - 1) // cols
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '1', '-i', f'{tmp}/f%03d.jpg',
                        '-vf', f'tile={cols}x{rows}:padding=4:color=black', '-frames:v', '1', '-q:v', '3', str(out_file)], check=True)
    return len(picks)


def cmd_study(file, out_dir=None, words=True, out=print):
    path = Path(file)
    if not path.is_file():
        raise ReferenceError(f'{file} is not a file')
    sha = sha256_of(path)
    folder = Path(out_dir or (FETCH_DEFAULT / 'studies' / sha[:12]))
    folder.mkdir(parents=True, exist_ok=True)
    meta = probe(path)
    cuts = cut_times(path)
    shots = shots_from_cuts(cuts, meta['duration_s'])
    segments = transcript(path) if (words and meta['has_audio']) else None
    zooms = zoom_moves(path, meta['duration_s'])
    sheet = folder / 'contact.jpg'
    framed = contact_sheet(path, shots, sheet)
    study = {
        'file': path.name, 'sha256': sha, **meta,
        'shape': 'vertical' if (meta['height'] or 0) > (meta['width'] or 0) else 'wide',
        'pace': pace(shots, meta['duration_s']),
        'shots': shots,
        'zoom': ({'moves': len(zooms), 'push_ins': sum(1 for z in zooms if z['kind'] == 'push in'),
                  'pull_outs': sum(1 for z in zooms if z['kind'] == 'pull out'), 'at': zooms[:60]}
                 if zooms is not None else 'not measured: OpenCV is not installed here'),
        'speech': speech_summary(segments, meta['duration_s']) if segments else 'not measured: no audio or no transcriber here',
        'transcript': segments,
        'loudness_lufs': loudness(path) if meta['has_audio'] else None,
        'contact_sheet': str(sheet), 'contact_frames': framed,
    }
    (folder / 'study.json').write_text(json.dumps(study, indent=1, ensure_ascii=False))
    out(f'studied        {path.name}: {study["pace"].get("shots")} shots, {study["pace"].get("cuts_per_minute")} cuts a minute, '
        f'median shot {study["pace"].get("median_shot_s")} s -> {folder}/study.json and contact.jpg')
    return study, folder


# ---- the ledger ------------------------------------------------------------------

def load_ledger(path=LEDGER):
    data = json.loads(Path(path).read_text())
    problems = ledger_problems(data)
    if problems:
        raise ReferenceError('config/style-references.json: ' + '; '.join(problems))
    return data


def ledger_problems(data):
    out = []
    for i, r in enumerate(data.get('references', [])):
        at = f'reference {i + 1} ({r.get("file") or r.get("url") or "?"})'
        if not (r.get('file') or r.get('url')):
            out.append(f'{at} has neither a file nor a url')
        if r.get('status') not in ('waiting_for_study', 'studied', 'retired'):
            out.append(f'{at} status must be waiting_for_study, studied or retired')
        for m in r.get('moves', []):
            if m.get('craft') not in CRAFT:
                out.append(f'{at}: move craft "{m.get("craft")}" is not one of {", ".join(CRAFT)}')
            if m.get('house_default') and not m.get('krish_said'):
                out.append(f'{at}: a move is a house default only with Krish\'s words in krish_said')
    for i, tr in enumerate(data.get('trials', [])):
        if not tr.get('piece') or not tr.get('krish_said') or not tr.get('moves'):
            out.append(f'trial {i + 1} needs a piece, Krish\'s words in krish_said, and its moves')
    return out


def self_test():
    n = 0
    def t(name, ok):
        nonlocal n
        if not ok:
            sys.exit(f'references self-test FAILED: {name}')
        n += 1
    shots = shots_from_cuts([1.0, 1.5, 4.0], 10.0)
    t('cuts make shots', [s['length'] for s in shots] == [1.0, 0.5, 2.5, 6.0])
    p = pace(shots, 10.0)
    t('pace counts cuts a minute', p['cuts_per_minute'] == 18.0 and p['shots_under_1s'] == 1 and p['shots_over_5s'] == 1)
    t('speech summary', speech_summary([{'start': 0, 'end': 30, 'text': 'one two three?'}], 60)['questions_asked'] == 1)
    t('the ledger refuses a house default without his words',
      any('house default' in e for e in ledger_problems({'references': [{'file': 'a.mp4', 'status': 'studied', 'moves': [{'craft': 'zoom', 'house_default': True}]}]})))
    t('the ledger refuses an unknown craft', any('craft' in e for e in ledger_problems({'references': [{'file': 'a.mp4', 'status': 'studied', 'moves': [{'craft': 'vibes'}]}]})))
    t('a trial needs his words', any('trial 1' in e for e in ledger_problems({'references': [], 'trials': [{'piece': 'x', 'moves': ['a']}]})))
    t('the committed ledger is valid', ledger_problems(json.loads(LEDGER.read_text())) == [])
    if shutil.which('ffmpeg'):
        with tempfile.TemporaryDirectory() as tmp:
            clip = Path(tmp) / 'two-shots.mp4'
            subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=red:s=320x568:d=2', '-f', 'lavfi', '-i', 'color=c=blue:s=320x568:d=2',
                            '-filter_complex', '[0][1]concat=n=2:v=1[v]', '-map', '[v]', '-r', '25', str(clip)], check=True)
            study, folder = cmd_study(clip, Path(tmp) / 'out', words=False, out=lambda *_: None)
            t('a two-shot clip studies as two shots', study['pace']['shots'] == 2 and abs(study['shots'][1]['start'] - 2.0) < 0.1)
            t('the contact sheet is drawn', (folder / 'contact.jpg').stat().st_size > 0)
            t('a vertical clip is called vertical', study['shape'] == 'vertical')
            push = Path(tmp) / 'push.mp4'
            subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=1280x720:d=0.04', '-frames:v', '1', str(Path(tmp) / 'p.png')], check=True)
            subprocess.run(['ffmpeg', '-v', 'error', '-loop', '1', '-i', str(Path(tmp) / 'p.png'), '-vf', "zoompan=z='1+0.004*on':d=1:s=640x360:fps=25",
                            '-t', '3', str(push)], check=True)
            still = Path(tmp) / 'still.mp4'
            subprocess.run(['ffmpeg', '-v', 'error', '-loop', '1', '-i', str(Path(tmp) / 'p.png'), '-t', '3', '-r', '25', str(still)], check=True)
            z_push = zoom_moves(push, 3.0)
            z_still = zoom_moves(still, 3.0)
            if z_push is not None:
                t('a slow push-in is measured as push-ins', len(z_push) >= 3 and all(m['kind'] == 'push in' for m in z_push))
                t('a locked-off shot has no zoom', z_still == [])
    print(f'references self-test passed: {n} checks')


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--self-test', action='store_true')
    sub = ap.add_subparsers(dest='cmd')
    sub.add_parser('publish')
    f = sub.add_parser('fetch'); f.add_argument('--out'); f.add_argument('names', nargs='*')
    s = sub.add_parser('study'); s.add_argument('file'); s.add_argument('--out'); s.add_argument('--no-words', action='store_true')
    a = ap.parse_args()
    try:
        if a.self_test:
            return self_test()
        if a.cmd == 'publish':
            print(json.dumps(cmd_publish()))
        elif a.cmd == 'fetch':
            cmd_fetch(a.out, a.names or None)
        elif a.cmd == 'study':
            cmd_study(a.file, a.out, words=not a.no_words)
        else:
            ap.print_help()
    except ReferenceError as e:
        sys.exit(f'references: {e}')


if __name__ == '__main__':
    main()
