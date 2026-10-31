"""Monday 2 November's two takes, made ready for make.py: a constant-frame-rate master, the camera-motion
assessment and, where it is needed, stabilisation. Adapted from docs/plans/2026-10-26-monday/video/prepare_takes.py;
the room is left as filmed (Monday 26's accepted cuts dropped the treated background).

    python docs/plans/2026-11-02-monday/video/prepare_takes.py cfr         # constant frame rate, audio copied
    python docs/plans/2026-11-02-monday/video/prepare_takes.py motion      # measure shake on both takes
    python docs/plans/2026-11-02-monday/video/prepare_takes.py stabilise   # steady them, then measure again
"""
import hashlib
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[4]
WORK = ROOT / '.cache/produce/2026-11-02-9a0c97af'
TAKES = WORK / 'takes'
MOTION = WORK / 'motion'
sys.path.insert(0, str(ROOT / 'scripts/quick-edit'))


def digest(path):
    with open(path, 'rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


def frames_of(path):
    return int(json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-count_packets', '-select_streams', 'v:0',
                                                   '-show_entries', 'stream=nb_read_packets', '-of', 'json', str(path)]))['streams'][0]['nb_read_packets'])


def measure(src, out):
    """Camera shake of one take, from the wall above and beside him (never his face or hands)."""
    import wall_stabilize
    checkpoint = out / 'path-checkpoint.json'
    if checkpoint.is_file() and json.loads(checkpoint.read_text())['source_sha256'] == digest(src):
        receipt = json.loads(checkpoint.read_text())   # the camera path is already measured for these bytes
    else:
        receipt, _ = wall_stabilize.analyse(src, out)
    path = np.load(out / 'camera-path.npz')
    raw, smooth = path['raw'], path['smooth']
    mag = np.hypot(raw[:, 0] - smooth[:, 0], raw[:, 1] - smooth[:, 1])
    drift = np.hypot(raw[:, 0] - raw[0, 0], raw[:, 1] - raw[0, 1])
    return {'source': src.name, 'source_sha256': receipt['source_sha256'], 'frames': receipt['frame_count'],
            'method': receipt['method'], 'minimum_inliers': receipt['minimum_inliers'],
            'camera_path_sha256': receipt['camera_path_sha256'],
            'shake_rms_px': round(float(np.sqrt((mag ** 2).mean())), 3),
            'shake_p95_px': round(float(np.percentile(mag, 95)), 3),
            'shake_max_px': round(float(mag.max()), 3),
            'drift_max_px': round(float(drift.max()), 2),
            'rotation_shake_deg_rms': round(float(np.degrees(np.sqrt(((raw[:, 2] - smooth[:, 2]) ** 2).mean()))), 4),
            'shake_rms_px_by_third': [round(float(np.sqrt((x ** 2).mean())), 3) for x in np.array_split(mag, 3)]}


def motion():
    results = {cut: measure(TAKES / f'{cut}-cfr.mp4', MOTION / cut) for cut in ('long', 'short')}
    for cut, r in results.items():
        print(cut, json.dumps(r))
    (MOTION / 'assessment.json').write_text(json.dumps(results, indent=1) + '\n', encoding='utf-8')


def stabilise(cut):
    import wall_stabilize
    src = TAKES / f'{cut}-cfr.mp4'
    out = MOTION / cut
    wall_stabilize.run(src, out, preset='veryfast', crf=12)
    stable = TAKES / f'{cut}-stable.mp4'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(out / 'camera-stable.mkv'), '-i', str(src), '-map', '0:v:0', '-map', '1:a:0',
                    '-c', 'copy', str(stable)], check=True)
    assert frames_of(stable) == frames_of(src), 'stabilised take lost or gained frames'
    after = measure(stable, MOTION / f'{cut}-after')
    before = json.loads((MOTION / 'assessment.json').read_text(encoding='utf-8'))[cut]
    record = {'cut': cut, 'decision': 'stabilised', 'before': before, 'after': after,
              'treatment': json.loads((out / 'stabilisation.json').read_text(encoding='utf-8')),
              'output': stable.name, 'output_sha256': digest(stable), 'audio': 'copied from the source, untouched'}
    (MOTION / f'{cut}-stabilised.json').write_text(json.dumps(record, indent=1) + '\n', encoding='utf-8')
    print(cut, 'shake rms', before['shake_rms_px'], '->', after['shake_rms_px'], 'px; p95', before['shake_p95_px'], '->',
          after['shake_p95_px'], 'px; static zoom', record['treatment']['static_zoom'])

def cfr(cut):
    """A constant-frame-rate master at the take's own clock (24000/1001), every audio sample copied."""
    src, dst = TAKES / f'{cut}-raw.mp4', TAKES / f'{cut}-cfr.mp4'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(src), '-map', '0:v:0', '-map', '0:a:0', '-vf', 'fps=24000/1001',
                    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12', '-c:a', 'copy', str(dst)], check=True)
    print(cut, 'cfr', frames_of(dst), 'frames')


if __name__ == '__main__':
    step, cuts = sys.argv[1], sys.argv[2:] or ['short', 'long']
    if step == 'cfr':
        for c in cuts:
            cfr(c)
    elif step == 'motion':
        MOTION.mkdir(parents=True, exist_ok=True)
        motion()
    elif step == 'stabilise':
        for c in cuts:
            stabilise(c)
