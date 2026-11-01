#!/usr/bin/env python3
"""The opening gate: whether a finished video's first seconds land, measured on its own bytes.

Krish, 2026-11-01, on four cuts he had already approved: "the first few seconds of each video aren't very powerful.
They aren't impactful, and the first frame moves on so quickly that you can barely even see what was there in the
first place ... these videos' weakest few seconds are the first few seconds in terms of engagement, setting the
scene, and impact." Then: "figure out how this can never happen again durably".

Four measures, each read from the decoded file and never from a renderer's metadata (thresholds and the calibration
numbers live in config/opening-gate.json):

  voice_onset    the first word he says starts at or before voice_onset_max_s (faster-whisper word timings).
  first_frame    frame 0 is a finished picture: edge density and luminance spread at or above their floors.
  headline_holds in the first headline_window_s there is a run of at least headline_min_hold_s where one line of large
                 text (OCR, box height at least large_text_min_frac of the frame's shorter side) stays on screen.
  no_dead_frame  no frame in the first dead_window_s is more than dead_flat_max of one flat colour.

A measure that cannot run (no OCR, no transcriber) is `not_measured`, and the gate fails closed: never a pass that
was not measured.

    python3 scripts/quick-edit/opening_gate.py VIDEO [--out RESULT.json]
    python3 scripts/quick-edit/opening_gate.py --self-test
"""
import argparse
import glob
import hashlib
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / 'config/opening-gate.json'
MACHINE = 'opening_gate.py'
VERSION = 1


def load_config(path=CONFIG):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def tool(name):
    pinned = sorted(glob.glob(str(ROOT / '.cache/tools/ffmpeg-*/bin')))
    return str(Path(pinned[-1]) / name) if pinned else name


def digest(path):
    with open(path, 'rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


def size(video):
    out = subprocess.run([tool('ffprobe'), '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                          'stream=width,height', '-of', 'csv=p=0', str(video)], capture_output=True, text=True, check=True)
    w, h = out.stdout.strip().split(',')[:2]
    return int(w), int(h)


def frames(video, start, dur, fps, width):
    """RGB frames from start for dur seconds at fps, scaled to width (height keeps the aspect)."""
    w, h = size(video)
    height = max(2, round(h * width / w / 2) * 2)
    raw = subprocess.run([tool('ffmpeg'), '-v', 'error', '-ss', str(start), '-t', str(dur), '-i', str(video),
                          '-vf', f'fps={fps},scale={width}:{height}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                         capture_output=True, check=True).stdout
    n = len(raw) // (width * height * 3)
    return np.frombuffer(raw[:n * width * height * 3], np.uint8).reshape(n, height, width, 3)


def first_frame(video, width=480):
    out = subprocess.run([tool('ffmpeg'), '-v', 'error', '-i', str(video), '-frames:v', '1', '-vf', f'scale={width}:-2',
                          '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True).stdout
    w, h = size(video)
    height = len(out) // (width * 3)
    return np.frombuffer(out[:height * width * 3], np.uint8).reshape(height, width, 3)


def picture_measures(img):
    """(edge density, luminance spread, largest flat-colour share) of one RGB frame."""
    g = img.astype(float) @ np.array([0.299, 0.587, 0.114])
    gx = np.abs(np.diff(g, axis=1))[:-1, :]
    gy = np.abs(np.diff(g, axis=0))[:, :-1]
    edge = float(((gx + gy) > 40).mean())
    q = (img // 24).reshape(-1, 3)
    _, counts = np.unique(q, axis=0, return_counts=True)
    return edge, float(g.std()), float(counts.max() / len(q))


def check_first_frame(video, cfg):
    edge, spread, _ = picture_measures(first_frame(video))
    ok = edge >= cfg['first_frame_min_edge'] and spread >= cfg['first_frame_min_spread']
    return {'status': 'pass' if ok else 'fail', 'edge_density': round(edge, 4), 'luminance_spread': round(spread, 1),
            'min_edge': cfg['first_frame_min_edge'], 'min_spread': cfg['first_frame_min_spread']}


def check_dead(video, cfg):
    fs = frames(video, 0, cfg['dead_window_s'], cfg['dead_fps'], 320)
    worst, at = 0.0, 0.0
    for i, f in enumerate(fs):
        flat = picture_measures(f)[2]
        if flat > worst:
            worst, at = flat, i / cfg['dead_fps']
    return {'status': 'pass' if worst <= cfg['dead_flat_max'] else 'fail', 'flattest_share': round(worst, 3),
            'flattest_at_s': round(at, 2), 'max': cfg['dead_flat_max']}


def _norm(text):
    return re.sub(r'[^A-Z0-9]', '', text.upper())


def large_lines(results, short_side, min_frac):
    """The OCR lines whose box is at least min_frac of the frame's shorter side tall."""
    out = set()
    for box, text, *_ in results or []:
        ys = [p[1] for p in box]
        if (max(ys) - min(ys)) >= min_frac * short_side and len(_norm(text)) >= 3:
            out.add(_norm(text))
    return out


def longest_hold(per_frame, fps):
    """The longest run (seconds) over which one large line stays on screen in every sampled frame, and the line."""
    best, line = 0.0, ''
    for i in range(len(per_frame)):
        for text in per_frame[i]:
            j = i
            while j + 1 < len(per_frame) and text in per_frame[j + 1]:
                j += 1
            if (j - i) / fps > best:
                best, line = (j - i) / fps, text
    return best, line


def check_headline(video, cfg, ocr=None):
    if ocr is None:
        try:
            from rapidocr_onnxruntime import RapidOCR
            engine = RapidOCR()
            ocr = lambda img: engine(img)[0]
        except Exception as error:
            return {'status': 'not_measured', 'reason': f'no OCR on this machine (rapidocr_onnxruntime): {error}'[:200]}
    w, h = size(video)
    fs = frames(video, 0, cfg['headline_window_s'], cfg['headline_fps'], 960)
    short_side = min(fs.shape[1], fs.shape[2]) if len(fs) else 1
    per = [large_lines(ocr(np.ascontiguousarray(f)), short_side, cfg['large_text_min_frac']) for f in fs]
    held, text = longest_hold(per, cfg['headline_fps'])
    return {'status': 'pass' if held >= cfg['headline_min_hold_s'] else 'fail', 'longest_hold_s': round(held, 2),
            'line': text, 'min_hold_s': cfg['headline_min_hold_s'], 'window_s': cfg['headline_window_s']}


def check_voice(video, cfg, transcribe=None):
    if transcribe is None:
        try:
            from faster_whisper import WhisperModel
        except ImportError as error:
            return {'status': 'not_measured', 'reason': f'no transcriber (faster-whisper): {error}'[:200]}
        except Exception:
            # faster-whisper needs no torch; a torch install that is present but broken must not take it down.
            sys.modules['torch'] = None
            for name in [m for m in sys.modules if m.startswith('faster_whisper')]:
                del sys.modules[name]
            try:
                from faster_whisper import WhisperModel
            except Exception as error:
                return {'status': 'not_measured', 'reason': f'no transcriber (faster-whisper): {error}'[:200]}
        model = WhisperModel(cfg.get('whisper_model', 'base.en'), device='cpu', compute_type='int8')
        def transcribe(wav):
            segs, _ = model.transcribe(wav, word_timestamps=True, vad_filter=False, beam_size=5)
            return [w.start for s in segs for w in (s.words or []) if w.word.strip()]
    with tempfile.TemporaryDirectory() as d:
        wav = str(Path(d) / 'head.wav')
        subprocess.run([tool('ffmpeg'), '-v', 'error', '-y', '-t', str(cfg['voice_listen_s']), '-i', str(video), '-vn',
                        '-ac', '1', '-ar', '16000', wav], check=True)
        starts = transcribe(wav)
    first = min(starts) if starts else None
    ok = first is not None and first <= cfg['voice_onset_max_s']
    return {'status': 'pass' if ok else 'fail', 'first_word_s': None if first is None else round(first, 2),
            'max_s': cfg['voice_onset_max_s']}


def check(video, cfg=None, ocr=None, transcribe=None, voice=True):
    """The opening check of one finished file, bound to its bytes. voice=False for a cut with no presenter voice."""
    cfg = cfg or load_config()
    measures = {'first_frame': check_first_frame(video, cfg), 'no_dead_frame': check_dead(video, cfg),
                'headline_holds': check_headline(video, cfg, ocr)}
    measures['voice_onset'] = check_voice(video, cfg, transcribe) if voice else {'status': 'not_applicable'}
    failed = [k for k, m in measures.items() if m['status'] not in ('pass', 'not_applicable')]
    return {'machine': MACHINE, 'version': VERSION, 'video_sha256': digest(video),
            'status': 'fail' if failed else 'pass', 'failed': failed, 'measures': measures}


def delivery_problems(report, required):
    """What a receipt's `opening` check says about delivery: missing (when required), failed, or bound to other bytes."""
    opening = (report.get('checks') or {}).get('opening')
    if opening is None:
        return ['opening gate did not run: a cut for a post dated from the opening gate\'s required_from needs '
                'checks.opening, written by opening_gate.py on the finished file'] if required else []
    if not isinstance(opening, dict) or opening.get('status') != 'pass':
        failed = ', '.join(opening.get('failed') or []) if isinstance(opening, dict) else 'unreadable'
        return [f'opening gate is not passed: {failed}']
    if opening.get('machine') != MACHINE or opening.get('video_sha256') != report.get('video_sha256'):
        return ['opening gate result belongs to different video bytes or was not machine written']
    return []


def required_for(target, cfg=None):
    cfg = cfg or load_config()
    dated = re.search(r'(\d{4}-\d{2}-\d{2})', str(target or ''))
    return bool(dated) and dated.group(1) >= cfg['required_from']


def self_test():
    ok = True
    def expect(name, cond):
        nonlocal ok
        ok &= bool(cond)
        print(('ok   ' if cond else 'FAIL ') + name)
    flat = np.zeros((90, 160, 3), np.uint8)
    busy = (np.random.default_rng(1).integers(0, 255, (90, 160, 3))).astype(np.uint8)
    e0, s0, f0 = picture_measures(flat)
    e1, s1, f1 = picture_measures(busy)
    expect('a flat frame has no edges and is all one colour', e0 == 0 and f0 == 1.0)
    expect('a busy frame has edges and no dominant colour', e1 > 0.3 and f1 < 0.2)
    box = lambda y0, y1: [[0, y0], [10, y0], [10, y1], [0, y1]]
    lines = large_lines([(box(0, 80), 'THE BOTTOM RUNG', 0.9), (box(0, 20), 'caption', 0.9)], 1080, 0.05)
    expect('only large lines count as a headline', lines == {'THEBOTTOMRUNG'})
    held, line = longest_hold([set(), {'A1B'}, {'A1B'}, {'A1B', 'C2D'}, {'C2D'}], 4)
    expect('the longest hold is measured in seconds between samples', held == 0.5 and line == 'A1B')
    rep = {'video_sha256': 'x', 'checks': {'opening': {'machine': MACHINE, 'video_sha256': 'x', 'status': 'pass'}}}
    expect('a passed check bound to the bytes delivers', delivery_problems(rep, True) == [])
    expect('a missing check holds when required', delivery_problems({'checks': {}}, True) != [])
    expect('a missing check never holds before the date', delivery_problems({'checks': {}}, False) == [])
    rep['checks']['opening']['video_sha256'] = 'y'
    expect('a check for other bytes holds', delivery_problems(rep, True) != [])
    cfg = load_config()
    expect('required from the date in the config', required_for('3 Posts/2026-11-02 Mon x/3 Video', cfg)
           and not required_for('3 Posts/2026-10-30 Fri x/3 Video', cfg))
    return 0 if ok else 1


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('video', nargs='?')
    ap.add_argument('--out', type=Path)
    ap.add_argument('--no-voice', action='store_true', help='a cut with no presenter voice')
    ap.add_argument('--self-test', action='store_true')
    a = ap.parse_args(argv)
    if a.self_test:
        return self_test()
    if not a.video:
        ap.error('give a video')
    result = check(a.video, voice=not a.no_voice)
    text = json.dumps(result, indent=1)
    if a.out:
        a.out.write_text(text, encoding='utf-8')
    print(text)
    return 0 if result['status'] == 'pass' else 2


if __name__ == '__main__':
    sys.exit(main())
