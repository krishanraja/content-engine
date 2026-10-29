#!/usr/bin/env python3
"""The lip-sync gate: SyncNet on every on-camera segment of a finished cut.

Floor never 3, Krish's words, 29 Oct 2026: "your words never cut, changed or
out of sync"; and 19 Oct: "in the deep cut, my facial movements start
misaligning with the audio as the video progresses, which is unbearable by the
end". sync_check.py measured windows a person chose by hand. This gate places
the windows itself: at least one in every retained segment of the take (each
join is where picture and sound can part), more in a long segment so a slow
drift is caught, and on the part of a segment no picture covers, so his face
is on screen.

A segment is out of sync when a reliable window reads more than one SyncNet
step (40 ms) off: that holds the cut. A window that cannot be read reliably
(low confidence, no face where nothing covers it) is never a pass, so the
cut stays held at delivery (quality.delivery_problems needs sync to pass).

The scorer is an interface: score(video, windows) -> one dict per window with
offset_ms, confidence and face_detection_rate. SyncNetScorer is the real one,
ported from sync_check.py (its sequential frame-index extraction and its
measure); tests pass a stand-in. The model path lives in config/lipsync.json
or the environment variables it names; without the model the gate reports
not_run and holds nothing new.

    python lipsync_gate.py VIDEO --segments a b [a b ...] [--covers a b ...] [--out DIR]
"""
import argparse
import hashlib
import json
import math
import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / 'config' / 'lipsync.json'
RANK = {'pass': 0, 'covered': 0, 'short': 0, 'inconclusive': 1, 'fail': 2}


def load_config(path=CONFIG):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def model_paths(cfg, env=None):
    env = os.environ if env is None else env
    root = env.get(cfg.get('syncnet_root_env') or '') or cfg.get('syncnet_root')
    model = env.get(cfg.get('model_path_env') or '') or cfg.get('model_path')
    return (Path(root) if root else None), (Path(model) if model else None)


def _sha256(path):
    with open(path, 'rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


def available(cfg, env=None):
    """(True, '') when this machine can run the real scorer, else (False, why)."""
    root, model = model_paths(cfg, env)
    if not root or not model:
        return False, (f'no SyncNet model on this machine: set {cfg.get("syncnet_root_env")} and {cfg.get("model_path_env")} '
                       '(or syncnet_root and model_path in config/lipsync.json)')
    if not root.is_dir() or not model.is_file():
        return False, f'the SyncNet checkout ({root}) or model ({model}) is missing'
    if _sha256(model) != cfg['model_sha256']:
        return False, 'the SyncNet model does not match its pinned digest'
    try:
        import subprocess
        rev = subprocess.run(['git', '-C', str(root), 'rev-parse', 'HEAD'], capture_output=True, text=True).stdout.strip()
    except OSError:
        rev = ''
    if rev != cfg['syncnet_revision']:
        return False, 'the SyncNet checkout is not at its pinned revision'
    for name in ('cv2', 'numpy', 'torch', 'python_speech_features'):
        try:
            __import__(name)
        except ImportError:
            return False, f'{name} is not installed for the SyncNet scorer'
    return True, ''


def segment_spans(segs, intro_s=0.0):
    """make.py's retained segments ({'a','b','off'} on the take) on the finished file's clock."""
    return [(round(intro_s + g['off'], 3), round(intro_s + g['off'] + (g['b'] - g['a']), 3)) for g in segs]


def _uncovered(a, b, covers):
    parts, cursor = [], a
    for c0, c1 in sorted((max(a, c0), min(b, c1)) for c0, c1 in covers or () if c1 > a and c0 < b):
        if c0 > cursor:
            parts.append((cursor, c0))
        cursor = max(cursor, c1)
    if cursor < b:
        parts.append((cursor, b))
    return parts


def _spread(a, b, length, gap):
    """Window starts inside [a, b]: one at least, more so no two are further apart than gap."""
    room = b - a - length
    count = math.ceil(room / gap) + 1 if room > 0 else 1
    if count == 1 or room <= 0:
        return [round(a + max(0.0, room) / 2, 3)]
    return [round(a + room * k / (count - 1), 3) for k in range(count)]


def plan_windows(spans, covers, cfg):
    """[(segment index, start, seconds, covered)] and the segments too short to measure."""
    windows, short = [], []
    least, most, gap = cfg['min_window_s'], cfg['window_s'], cfg['max_gap_s']
    for i, (a, b) in enumerate(spans):
        if b - a < least:
            short.append(i)
            continue
        open_parts = [(x, y) for x, y in _uncovered(a, b, covers) if y - x >= least]
        parts, covered = (open_parts, False) if open_parts else ([(a, b)], True)
        for x, y in parts:
            length = round(min(most, y - x), 3)
            windows += [(i, s, length, covered) for s in _spread(x, y, length, gap)]
    return windows, short


def judge(point, covered, cfg):
    rate, conf, offset = point.get('face_detection_rate') or 0, point.get('confidence'), point.get('offset_ms')
    if rate < cfg['min_face_rate']:
        return 'covered' if covered else 'inconclusive'
    if conf is None or offset is None or conf < cfg['min_confidence']:
        return 'inconclusive'
    return 'pass' if abs(offset) <= cfg['max_offset_ms'] else 'fail'


def gate(video, spans, covers, scorer, cfg=None):
    """The check written to the cut's receipt as checks.sync."""
    cfg = cfg or load_config()
    windows, short = plan_windows(spans, covers, cfg)
    scored = scorer.score(video, [(s, n) for _, s, n, _ in windows]) if windows else []
    if len(scored) != len(windows):
        raise ValueError('The lip-sync scorer returned a different number of windows')
    segments = [{'index': i, 'span_s': list(sp), 'windows': [], 'status': 'short' if i in short else None}
                for i, sp in enumerate(spans)]
    for (i, s, n, covered), point in zip(windows, scored):
        status = judge(point, covered, cfg)
        segments[i]['windows'].append({'at_s': s, 'seconds': n, 'covered': covered, **point, 'status': status})
    for seg in segments:
        if seg['status'] is None:
            states = [w['status'] for w in seg['windows']]
            seg['status'] = ('covered' if all(x == 'covered' for x in states)
                             else max((x for x in states if x != 'covered'), key=RANK.get))
    on_camera = sum(b - a for (a, b), seg in zip(spans, segments) if seg['status'] != 'covered')
    unmeasured = sum(b - a for (a, b), seg in zip(spans, segments) if seg['status'] == 'short')
    measured = [s for s in segments if s['status'] in ('pass', 'fail', 'inconclusive')]
    if any(s['status'] == 'fail' for s in segments):
        status = 'fail'
    elif not measured or any(s['status'] == 'inconclusive' for s in segments):
        status = 'inconclusive'
    elif on_camera and unmeasured / on_camera > cfg['max_unmeasured_fraction']:
        status = 'inconclusive'
    else:
        status = 'pass'
    counts = {k: sum(1 for s in segments if s['status'] == k) for k in ('pass', 'fail', 'inconclusive', 'covered', 'short')}
    return {'status': status, 'floor_never': 3, 'blocking': True, 'scorer': getattr(scorer, 'name', type(scorer).__name__),
            'thresholds': {k: cfg[k] for k in ('max_offset_ms', 'min_confidence', 'min_face_rate', 'max_unmeasured_fraction')},
            'segments': segments, 'counts': counts, 'on_camera_s': round(on_camera, 3), 'unmeasured_s': round(unmeasured, 3),
            'line': (f'lip sync: {status}; {counts["pass"]} segments in sync, {counts["fail"]} out, {counts["inconclusive"]} '
                     f'unreadable, {counts["covered"]} under a picture, {counts["short"]} too short to read (floor never 3)')}


def not_run(reason):
    return {'status': 'not_run', 'floor_never': 3, 'blocking': True, 'reason': reason,
            'line': f'lip sync: not run, {reason}; the cut stays held at delivery until it passes (floor never 3)'}


class SyncNetScorer:
    """SyncNet at the pinned revision and model, through sync_check.py's own extraction and measure."""
    name = 'syncnet'

    def __init__(self, root, model):
        self.root, self.model_path, self.model = Path(root), Path(model), None

    def _load(self):
        if self.model is None:
            import torch
            torch.set_num_threads(4)
            sys.path.insert(0, str(self.root.resolve()))
            from SyncNetInstance import SyncNetInstance
            self.model = SyncNetInstance(device='cpu')
            self.model.loadParameters(str(self.model_path))
        return self.model

    def score(self, video, windows):
        import numpy as np
        import sync_check
        model, results = self._load(), [None] * len(windows)
        for seconds in sorted({n for _, n in windows}):
            picked = [k for k, (_, n) in enumerate(windows) if n == seconds]
            with tempfile.TemporaryDirectory() as tmp:
                _, rates = sync_check.extract(video, [windows[k][0] for k in picked], seconds, Path(tmp))
                for j, k in enumerate(picked):
                    cache = Path(tmp) / f'window-{j}.npz'
                    if not cache.exists():
                        results[k] = {'offset_ms': None, 'confidence': None, 'face_detection_rate': rates[j]}
                        continue
                    data = np.load(cache)
                    results[k] = {**sync_check.measure(model, data['frames'], data['audio']), 'face_detection_rate': rates[j]}
        return results


def check_cut(video, spans, covers, cfg=None, scorer=None, env=None):
    """make.py's entry: the sync check for one finished cut, or not_run when no scorer can run here."""
    cfg = cfg or load_config()
    if scorer is None:
        ok, why = available(cfg, env)
        if not ok:
            return not_run(why)
        scorer = SyncNetScorer(*model_paths(cfg, env))
    try:
        return gate(video, spans, covers, scorer, cfg)
    except Exception as error:  # a scorer that breaks is never a pass
        return not_run(f'the scorer failed: {str(error)[-300:]}')


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('video')
    ap.add_argument('--segments', type=float, nargs='+', required=True, help='start and end pairs on the cut\'s clock')
    ap.add_argument('--covers', type=float, nargs='*', default=[], help='start and end pairs a full picture covers')
    ap.add_argument('--out', type=Path)
    a = ap.parse_args(argv)
    if len(a.segments) % 2 or len(a.covers) % 2:
        ap.error('segments and covers take start and end pairs')
    pairs = lambda xs: list(zip(xs[::2], xs[1::2]))
    result = check_cut(a.video, pairs(a.segments), pairs(a.covers))
    text = json.dumps(result, indent=1)
    if a.out:
        a.out.mkdir(parents=True, exist_ok=True)
        (a.out / 'lipsync.json').write_text(text, encoding='utf-8')
    print(text)
    return 0 if result['status'] == 'pass' else 2


if __name__ == '__main__':
    raise SystemExit(main())
