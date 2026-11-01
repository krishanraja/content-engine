"""How much a cut moves, second by second: the mean change between frames (8 per second, at 320 x 180, grey), so
"barely any motion" is a number. Prints, per file, the median movement, the quietest tenth of its seconds, and the
longest run of still seconds (below STILL). Run from the repository root:
    python3 docs/plans/2026-11-02-monday/proof/motion_measure.py FILE [FILE ...] [--start S --dur D]"""
import argparse, subprocess, sys
import numpy as np

STILL = 1.0   # mean grey-level change per frame below this is a still second

def per_second(path, start=0.0, dur=None, fps=8):
    cmd = ['ffmpeg', '-v', 'error', '-ss', str(start)] + (['-t', str(dur)] if dur else []) + [
        '-i', path, '-vf', f'fps={fps},scale=320:180,format=gray', '-f', 'rawvideo', '-']
    raw = subprocess.run(cmd, capture_output=True).stdout
    f = np.frombuffer(raw, np.uint8).reshape(-1, 180, 320).astype(np.int16)
    d = np.abs(np.diff(f, axis=0)).mean(axis=(1, 2))
    n = len(d) // fps
    return d[:n * fps].reshape(n, fps).mean(axis=1)

def summary(sec):
    still = sec < STILL
    run = best = 0
    for s in still:
        run = run + 1 if s else 0; best = max(best, run)
    return {'seconds': len(sec), 'median': round(float(np.median(sec)), 2), 'p10': round(float(np.percentile(sec, 10)), 2),
            'still_share': round(float(still.mean()), 3), 'longest_still_s': best}

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('files', nargs='+'); ap.add_argument('--start', type=float, default=0)
    ap.add_argument('--dur', type=float); a = ap.parse_args()
    for f in a.files:
        print(f.split('/')[-1], summary(per_second(f, a.start, a.dur)))
