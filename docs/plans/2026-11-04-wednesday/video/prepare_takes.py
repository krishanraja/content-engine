"""Wednesday 4 Nov two takes, made ready for make.py: a constant 24 fps master, the camera-motion
assessment and stabilisation, and the room behind him treated (darkened and softened, never cut out).

    python docs/plans/2026-10-26-monday/video/prepare_takes.py motion      # measure shake on both takes
    python docs/plans/2026-10-26-monday/video/prepare_takes.py stabilise   # steady them, then measure again
    python docs/plans/2026-10-26-monday/video/prepare_takes.py treat       # the treated-background masters

Every master keeps every audio sample of the take (the audio stream is copied) and the 24 fps
clock make.py would conform to anyway, so his words, their timing and the caption clock are the
take's own. Stabilisation is the repository's wall-feature tracker (scripts/quick-edit/wall_stabilize.py):
the speaker and his hands are left out of the measurement, slow drift is kept, one constant crop.
The treatment keeps him exactly as filmed: a soft person mask (mediapipe selfie segmentation at
288 x 512, steadied over neighbouring frames) chooses, pixel by pixel, between the frame as shot
and the same frame softened, desaturated, darkened, vignetted and pulled towards the ink.
"""
import hashlib
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[4]
WORK = ROOT / '.cache/produce/2026-11-04-b63d2507'
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


SOURCES = {'long': ROOT / '.cache/recordings/Wed 28 Oct - 5-minute - Claude Duet.mp4',
           'short': ROOT / '.cache/recordings/Wed 28 Oct - 90-second - Claude Duet (1).mp4'}


def cfr(cut):
    """The take as a constant 24 fps master; the audio stream is copied, never re-encoded."""
    TAKES.mkdir(parents=True, exist_ok=True)
    out = TAKES / f'{cut}-cfr.mp4'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(SOURCES[cut]), '-map', '0:v:0', '-map', '0:a:0', '-vf', 'fps=24',
                    '-c:v', 'libx264', '-crf', '12', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'copy', str(out)], check=True)
    print(cut, 'cfr', out.name, digest(out)[:12])


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


def mask(src, dst):
    """The person mask at 288 x 512, one grey frame per source frame (lossless)."""
    import mediapipe as mp
    w, h, n = 288, 512, frames_of(src)
    dec = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', str(src), '-vf', f'scale={w}:{h}:flags=area', '-f', 'rawvideo',
                            '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', f'{w}x{h}', '-framerate', '24',
                            '-i', '-', '-c:v', 'ffv1', str(dst)], stdin=subprocess.PIPE)
    seg = mp.solutions.selfie_segmentation.SelfieSegmentation(model_selection=0)
    prev, done = None, 0
    while True:
        buf = dec.stdout.read(w * h * 3)
        if len(buf) < w * h * 3:
            break
        m = seg.process(np.frombuffer(buf, np.uint8).reshape(h, w, 3)).segmentation_mask.astype(np.float32)
        m = m if prev is None else 0.6 * m + 0.4 * prev   # steadier edges, without a trail behind a moving hand
        prev = m
        enc.stdin.write((np.clip(m, 0, 1) * 255).astype(np.uint8).tobytes())
        done += 1
    enc.stdin.close()
    assert enc.wait() == 0 and dec.wait() == 0 and done == n, f'mask covers {done} of {n} frames'


# The room: blurred at quarter size, 55% of its colour, about a third of its light, a vignette, a little ink.
ROOM = ('scale=270:480:flags=area,gblur=sigma=3,scale=1080:1920:flags=bicubic,eq=saturation=0.55,'
        "lutrgb=r='val*0.344+2':g='val*0.344+4':b='val*0.344+3',vignette=angle=PI/3.2,format=rgb24")
# The mask, full size and feathered; below 35% is room, above 86% is him (a looser edge left a pale rim of the
# bright wall round his head). Laid as his alpha over the room: maskedmerge in planar RGB left a teal fringe.
MASK = "scale=1080:1920:flags=bilinear,gblur=sigma=6,lut=y='clip((val-90)*255/130,0,255)',format=gray"


def treat(cut):
    src = TAKES / f'{cut}-stable.mp4'
    person = TAKES / f'{cut}-mask.mkv'
    final = TAKES / f'{cut}-treated.mp4'
    if not person.exists() or person.stat().st_mtime < src.stat().st_mtime:
        mask(src, person)
    graph = (f'[0:v]split[a][b];[a]{ROOM}[room];[b]format=rgba[h0];[1:v]{MASK}[m];[h0][m]alphamerge[him];'
             f'[room][him]overlay=format=rgb,format=yuv420p[v]')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(src), '-i', str(person), '-filter_complex', graph, '-map', '[v]',
                    '-map', '0:a:0', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12', '-c:a', 'copy', str(final)], check=True)
    assert frames_of(final) == frames_of(src), 'treated take lost or gained frames'
    record = {'cut': cut, 'source': src.name, 'source_sha256': digest(src), 'mask': person.name, 'mask_sha256': digest(person),
              'output': final.name, 'output_sha256': digest(final), 'frames': frames_of(final),
              'audio': 'copied byte for byte from the take (no processing)',
              'method': 'mediapipe selfie segmentation (general model) at 288x512, 0.6/0.4 temporal blend, feathered (sigma 9 at '
                        'full size, edge 0.35-0.86); room = ' + ROOM + '; he is laid over the room as shot, the mask his alpha'}
    (TAKES / f'{cut}-treated.json').write_text(json.dumps(record, indent=1) + '\n', encoding='utf-8')
    print(json.dumps(record))


if __name__ == '__main__':
    step, cuts = sys.argv[1], sys.argv[2:] or ['short', 'long']
    if step == 'cfr':
        for c in cuts:
            cfr(c)
    elif step == 'motion':
        motion()
    elif step == 'stabilise':
        for c in cuts:
            stabilise(c)
    elif step == 'treat':
        for c in cuts:
            treat(c)
