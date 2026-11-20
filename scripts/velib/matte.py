"""The subject matte of a take: offline, no downloads, no generation, no spend (ve matte; shot grammar step 5, depth).

Run: python scripts/ve.py matte <piece|spec> [--cut CUT], or python -m velib.matte TAKE OUT_DIR (PYTHONPATH=scripts).

The Athletic's numbers sit behind the presenter (study shot 5); Krish's anchor cuts need the same: a hero number or the
title at head height, behind him, while he talks. That needs a per-frame matte of his take. This makes one with
MediaPipe's bundled selfie model (a candidate: its edges on fast hands are soft, so they are clipped, below), and writes,
cached by the take's sha256 under .ve-work/mattes/<sha256>/:

- matte.mp4: the model's probability, lossless 8-bit gray, one frame for every frame of the take;
- subject.mov: his take with the matte as its alpha (ProRes 4444), which the renderer lays over the type plates, so the
  type is behind him and in front of the wall (`props.matte`, FormatMaster's depth layer);
- matte.json: the model and its sha256, the take's sha256, the subject's sha256, the clip thresholds, the mean edge
  confidence (diagnostic only), and his silhouette on every frame (`profile`: for each band of PROFILE_STEP rows, the
  first and last column he fills, or null), which compile reads to keep cards off his torso and hands (anchor's body
  keep-out) and lint reads to know a take has a matte.

The halo. Fast hand motion blurs the model's edge into a soft fringe. The subject's alpha is the probability clipped
to [ALPHA_LO, ALPHA_HI] and stretched (the matte's confidence: a pixel the model is unsure of is not him), then eroded
one pixel, so a fringe never carries the wall over the type; and the type is set behind his head and torso, where the
matte is surest, not where his hands move (kit/depth.ts). Edge quality on hair and hands stays an operator gate.
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / '.ve-work' / 'mattes'
ALPHA_LO, ALPHA_HI = 0.45, 0.80      # the confidence clip: a probability under 0.45 is not him, over 0.80 is
ERODE_PX = 1
PROFILE_STEP = 40                    # rows per silhouette band
VERSION = 1                          # bump when the subject or profile recipe changes: the cache is rebuilt


def _sha(path) -> str:
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for block in iter(lambda: handle.read(1 << 20), b''):
            digest.update(block)
    return digest.hexdigest()


def validate_mask(mask, shape):
    mask = np.asarray(mask)
    if mask.shape != shape or not np.isfinite(mask).all() or np.any((mask < 0) | (mask > 1)):
        raise ValueError('invalid segmentation probabilities or dimensions')
    if not np.any(mask >= 0.5):
        raise ValueError('frame has no subject; no output written')
    # Diagnostic only: uncertainty near the threshold is not a hair/hand accuracy score.
    edge = mask[(mask > 0.05) & (mask < 0.95)]
    return float(np.mean(np.abs(edge - 0.5) * 2)) if edge.size else 0.0


def clip_alpha(prob: np.ndarray, lo: float = ALPHA_LO, hi: float = ALPHA_HI, erode: int = ERODE_PX) -> np.ndarray:
    """The subject's alpha (0 to 255) from the model's probability (0 to 1 or 0 to 255): the halo clipped by confidence,
    then eroded `erode` pixels so a soft fringe never carries the wall over the type behind him."""
    p = np.asarray(prob, dtype=np.float32)
    if p.max(initial=0) > 1.0:
        p = p / 255.0
    a = np.clip((p - lo) / max(hi - lo, 1e-6), 0.0, 1.0)
    for _ in range(max(0, erode)):
        padded = np.pad(a, 1, mode='edge')
        a = np.minimum.reduce([padded[1:-1, 1:-1], padded[:-2, 1:-1], padded[2:, 1:-1], padded[1:-1, :-2], padded[1:-1, 2:]])
    return np.rint(a * 255).astype(np.uint8)


def silhouette(alpha: np.ndarray, step: int = PROFILE_STEP) -> list:
    """For each band of `step` rows: [first column, last column] where he is (alpha at least half), or None."""
    on = np.asarray(alpha) >= 128
    out = []
    for y in range(0, on.shape[0], step):
        cols = np.flatnonzero(on[y:y + step].any(axis=0))
        out.append([int(cols[0]), int(cols[-1])] if cols.size else None)
    return out


def _probe(take: Path) -> tuple[int, int, str]:
    info = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0',
        '-show_streams', '-of', 'json', str(take)]))['streams'][0]
    if info['avg_frame_rate'] != info['r_frame_rate']:
        raise ValueError('variable-rate take must be conformed before matting')
    return info['width'], info['height'], info['r_frame_rate']


def _frames(path: Path, width: int, height: int, channels: int):
    fmt = {1: 'gray', 3: 'rgb24'}[channels]
    decoder = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', str(path), '-map', '0:v:0', '-fps_mode', 'passthrough',
                                '-f', 'rawvideo', '-pix_fmt', fmt, '-'], stdout=subprocess.PIPE)
    size = width * height * channels
    try:
        while True:
            data = decoder.stdout.read(size)
            if not data:
                break
            if len(data) != size:
                raise ValueError('truncated decoded frame')
            yield np.frombuffer(data, dtype=np.uint8).reshape((height, width) if channels == 1 else (height, width, 3))
        if decoder.wait():
            raise ValueError(f'decode failed: {path}')
    finally:
        decoder.stdout.close()
        if decoder.poll() is None:
            decoder.terminate()
        decoder.wait()


def make_matte(take_media, out_dir, name: str | None = None):
    """Write <name>.matte.mp4 (lossless 8-bit gray) and <name>.matte.json after every frame succeeds.

    Requires MediaPipe's legacy bundled SelfieSegmentation API. New Tasks-only installs fail explicitly rather than
    downloading an unpinned replacement model (set VE_MATTE_PYTHON to an interpreter that has it; ve matte runs it).
    """
    import mediapipe as mp
    take = Path(take_media)
    model = Path(mp.__file__).parent / 'modules/selfie_segmentation/selfie_segmentation.tflite'
    if not model.is_file() or not hasattr(mp, 'solutions'):
        raise RuntimeError('bundled MediaPipe SelfieSegmentation unavailable; no network fallback')
    width, height, fps = _probe(take)
    out = Path(out_dir)
    if not out.is_dir():
        raise ValueError('output directory must already exist')
    stem = name or take.stem
    with tempfile.TemporaryDirectory(dir=out) as scratch:
        raw_path = Path(scratch) / 'alpha.gray'
        count, confidence = 0, 0.0
        with mp.solutions.selfie_segmentation.SelfieSegmentation(model_selection=0) as segmenter, raw_path.open('wb') as raw:
            for rgb in _frames(take, width, height, 3):
                mask = segmenter.process(rgb).segmentation_mask
                confidence += validate_mask(mask, (height, width))
                raw.write(np.rint(mask * 255).astype(np.uint8).tobytes())
                count += 1
        if not count:
            raise ValueError('take decode failed or empty')
        video = Path(scratch) / 'matte.mp4'
        subprocess.run(['ffmpeg', '-v', 'error', '-f', 'rawvideo', '-pixel_format', 'gray',
            '-video_size', f'{width}x{height}', '-framerate', fps, '-i', str(raw_path),
            '-c:v', 'libx264', '-qp', '0', '-pix_fmt', 'gray', str(video)], check=True)
        report = {'model': 'MediaPipe SelfieSegmentation general (candidate)', 'model_sha256': _sha(model),
            'frames': count, 'fps': fps, 'width': width, 'height': height, 'sha256': _sha(video),
            'take_sha256': _sha(take), 'mean_edge_confidence': confidence / count,
            'status': 'unverified', 'edge_quality': 'hair and hands require measured review; confidence is diagnostic only',
            'smear_receipt': None, 'proposed_model_if_edges_fail': 'SAM 2.1 Tiny (requires Krish approval)'}
        metadata = Path(scratch) / 'matte.json'
        metadata.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
        video.replace(out / f'{stem}.matte.mp4')
        metadata.replace(out / f'{stem}.matte.json')
        return report


def make_subject(take_media, matte_media, out_path) -> dict:
    """His take with the clipped matte as alpha (ProRes 4444, yuva444p10le), and his silhouette on every frame."""
    take, matte = Path(take_media), Path(matte_media)
    width, height, fps = _probe(take)
    mw, mh, _ = _probe(matte)
    if (mw, mh) != (width, height):
        raise ValueError('the matte is not the take\'s size')
    out = Path(out_path)
    encoder = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', f'{width}x{height}',
                                '-framerate', fps, '-i', '-', '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le',
                                '-alpha_bits', '16', '-vendor', 'apl0', str(out)], stdin=subprocess.PIPE)
    profile, count = [], 0
    try:
        for rgb, prob in zip(_frames(take, width, height, 3), _frames(matte, width, height, 1)):
            alpha = clip_alpha(prob)
            rgba = np.dstack([rgb * (alpha[..., None] > 0), alpha])
            encoder.stdin.write(rgba.astype(np.uint8).tobytes())
            profile.append(silhouette(alpha))
            count += 1
    finally:
        encoder.stdin.close()
        if encoder.wait():
            raise ValueError('subject encode failed')
    if not count:
        raise ValueError('no frames in the subject')
    return {'frames': count, 'profile': profile, 'profile_step': PROFILE_STEP}


def cache_dir(take_sha: str, root: Path = CACHE) -> Path:
    return Path(root) / take_sha


def cached(take_media, root: Path = CACHE, take_sha: str | None = None) -> dict | None:
    """The cached matte record for these take bytes, or None when there is none or it is stale."""
    sha = take_sha or _sha(take_media)
    path = cache_dir(sha, root) / 'matte.json'
    if not path.is_file():
        return None
    try:
        record = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return None
    folder = path.parent
    if (record.get('take_sha256') != sha or record.get('version') != VERSION or not (folder / 'subject.mov').is_file()
            or not (folder / 'matte.mp4').is_file()):
        return None
    return {**record, 'dir': str(folder), 'subject': str(folder / 'subject.mov'), 'matte': str(folder / 'matte.mp4')}


def ensure(take_media, root: Path = CACHE, *, from_matte: Path | None = None) -> dict:
    """Make (or reuse) the matte of a take, cached by its sha256. `from_matte` reuses a gray matte already made by
    make_matte for these exact bytes (its json beside it must name the take's sha256)."""
    take = Path(take_media)
    sha = _sha(take)
    found = cached(take, root, sha)
    if found:
        return {**found, 'cached': True}
    folder = cache_dir(sha, root)
    folder.mkdir(parents=True, exist_ok=True)
    if from_matte is not None:
        meta = json.loads(Path(from_matte).with_suffix('.json').read_text(encoding='utf-8'))
        if meta.get('take_sha256') != sha:
            raise ValueError(f'{from_matte} is the matte of other bytes (take {meta.get("take_sha256", "?")[:12]}, not {sha[:12]})')
        shutil.copyfile(from_matte, folder / 'matte.mp4')
        report = meta
    else:
        report = make_matte(take, folder, name='take')
        (folder / 'take.matte.mp4').replace(folder / 'matte.mp4')
        (folder / 'take.matte.json').unlink()
    subject = make_subject(take, folder / 'matte.mp4', folder / 'subject.mov')
    if subject['frames'] != report['frames']:
        raise ValueError(f'the subject has {subject["frames"]} frames and the matte {report["frames"]}')
    record = {**report, 'version': VERSION, 'take_sha256': sha, 'sha256': _sha(folder / 'matte.mp4'),
              'subject_sha256': _sha(folder / 'subject.mov'), 'alpha_clip': [ALPHA_LO, ALPHA_HI], 'erode_px': ERODE_PX,
              'profile_step': subject['profile_step'], 'profile': subject['profile']}
    (folder / 'matte.json').write_text(json.dumps(record) + '\n', encoding='utf-8')
    return {**record, 'dir': str(folder), 'subject': str(folder / 'subject.mov'), 'matte': str(folder / 'matte.mp4'), 'cached': False}


def run_ensure(take_media, root: Path = CACHE, *, from_matte: Path | None = None) -> dict:
    """ensure() here when this interpreter has MediaPipe's bundled model, else in VE_MATTE_PYTHON (a separate
    interpreter that has it; nothing is downloaded)."""
    found = cached(take_media, root)
    if found:
        return {**found, 'cached': True}
    try:
        import mediapipe as mp  # noqa: F401
        here = hasattr(mp, 'solutions')
    except ImportError:
        here = False
    if here or from_matte is not None:
        return ensure(take_media, root, from_matte=from_matte)
    python = os.environ.get('VE_MATTE_PYTHON')
    if not python:
        raise RuntimeError('MediaPipe\'s bundled SelfieSegmentation is not in this Python; set VE_MATTE_PYTHON to one that '
                           'has it (pip install mediapipe==0.10.14); nothing is downloaded')
    code = ('import json,sys; sys.path.insert(0, sys.argv[1]); from velib import matte; '
            'r = matte.ensure(sys.argv[2], matte.Path(sys.argv[3])); r.pop("profile", None); print(json.dumps(r))')
    subprocess.run([python, '-c', code, str(ROOT / 'scripts'), str(take_media), str(root)], check=True,
                   stdout=subprocess.DEVNULL)
    found = cached(take_media, root)
    if not found:
        raise RuntimeError('the matte interpreter wrote no record')
    return {**found, 'cached': False}


def main():
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('take')
    parser.add_argument('out_dir', nargs='?')
    parser.add_argument('--cache', action='store_true', help='make the cached matte and subject (ensure)')
    args = parser.parse_args()
    try:
        if args.cache:
            record = ensure(args.take)
            print(record['dir'])
        else:
            make_matte(args.take, args.out_dir)
    except (ImportError, RuntimeError, ValueError, OSError, subprocess.SubprocessError) as error:
        parser.exit(1, f'matte: {error}\n')


if __name__ == '__main__':
    main()
