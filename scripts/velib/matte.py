"""Offline candidate mattes. No downloads; edge quality is unverified until reviewed on hair/hands.

Run: python -m velib.matte TAKE OUT_DIR (PYTHONPATH=scripts).
MediaPipe's bundled selfie model is a candidate, never an automatic quality approval.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

import numpy as np


def _sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def validate_mask(mask, shape):
    mask = np.asarray(mask)
    if mask.shape != shape or not np.isfinite(mask).all() or np.any((mask < 0) | (mask > 1)):
        raise ValueError('invalid segmentation probabilities or dimensions')
    if not np.any(mask >= 0.5):
        raise ValueError('frame has no subject; no output written')
    # Diagnostic only: uncertainty near the threshold is not a hair/hand accuracy score.
    edge = mask[(mask > 0.05) & (mask < 0.95)]
    return float(np.mean(np.abs(edge - 0.5) * 2)) if edge.size else 0.0


def make_matte(take_media, out_dir):
    """Write a lossless 8-bit gray MP4 and diagnostic JSON after every frame succeeds.

    Requires MediaPipe's legacy bundled SelfieSegmentation API. New Tasks-only installs
    fail explicitly rather than downloading an unpinned replacement model.
    """
    import mediapipe as mp
    take = Path(take_media)
    model = Path(mp.__file__).parent / 'modules/selfie_segmentation/selfie_segmentation.tflite'
    if not model.is_file() or not hasattr(mp, 'solutions'):
        raise RuntimeError('bundled MediaPipe SelfieSegmentation unavailable; no network fallback')
    info = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0',
        '-show_streams', '-of', 'json', str(take)]))['streams'][0]
    width, height, fps = info['width'], info['height'], info['r_frame_rate']
    if info['avg_frame_rate'] != fps:
        raise ValueError('variable-rate take must be conformed before matting')
    out = Path(out_dir)
    if not out.is_dir():
        raise ValueError('output directory must already exist')
    with tempfile.TemporaryDirectory(dir=out) as scratch:
        raw_path = Path(scratch) / 'alpha.gray'
        decoder = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', str(take), '-map', '0:v:0',
            '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
        count, confidence = 0, 0.0
        try:
            with mp.solutions.selfie_segmentation.SelfieSegmentation(model_selection=0) as segmenter, raw_path.open('wb') as raw:
                while True:
                    data = decoder.stdout.read(width * height * 3)
                    if not data:
                        break
                    if len(data) != width * height * 3:
                        raise ValueError('truncated decoded frame')
                    rgb = np.frombuffer(data, dtype=np.uint8).reshape(height, width, 3)
                    mask = segmenter.process(rgb).segmentation_mask
                    confidence += validate_mask(mask, (height, width))
                    raw.write(np.rint(mask * 255).astype(np.uint8).tobytes())
                    count += 1
            if decoder.wait() or not count:
                raise ValueError('take decode failed or empty')
        finally:
            decoder.stdout.close()
            if decoder.poll() is None:
                decoder.terminate()
            decoder.wait()
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
        target = out / f'{take.stem}.matte.mp4'
        video.replace(target)
        metadata.replace(out / f'{take.stem}.matte.json')
        return report


def main():
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('take')
    parser.add_argument('out_dir')
    args = parser.parse_args()
    try:
        make_matte(args.take, args.out_dir)
    except (ImportError, RuntimeError, ValueError, OSError, subprocess.SubprocessError) as error:
        parser.exit(1, f'matte: {error}\n')


if __name__ == '__main__':
    main()
