"""Checks on a finished cut: still stretches at 10 frames a second (any run over 1.5 s where the picture barely changes),
loudness and true peak, and what Whisper hears in the final mix. Run from the repository root:
    python3 docs/plans/2026-11-02-monday/rebuild/verify.py long|short"""
import glob, re, subprocess, sys
from pathlib import Path
import numpy as np
ROOT = Path(__file__).resolve().parents[4]; OUT = ROOT / '.cache/proof/mon'
FF = str(Path(sorted(glob.glob(str(ROOT / '.cache/tools/ffmpeg-*/bin')))[-1]) / 'ffmpeg')
STILL = 0.6        # mean grey-level change between frames 0.1 s apart below this is a still frame
cut = sys.argv[1]; f = OUT / ('mon-long-16x9.mp4' if cut == 'long' else 'mon-short-9x16.mp4')
w, h = (320, 180) if cut == 'long' else (180, 320)
raw = subprocess.run([FF, '-v', 'error', '-i', str(f), '-vf', f'fps=10,scale={w}:{h},format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.int16)
d = np.abs(np.diff(fr, axis=0)).mean(axis=(1, 2))
runs, start = [], None
for i, v in enumerate(list(d) + [99]):
    if v < STILL and start is None: start = i
    elif v >= STILL and start is not None:
        if (i - start) / 10 > 1.5: runs.append((start / 10, i / 10))
        start = None
print(f'{f.name}: {len(fr) / 10:.1f} s at 10 fps; median change {np.median(d):.2f}; still runs over 1.5 s: ' +
      (', '.join(f'{a:.1f}-{b:.1f}' for a, b in runs) or 'none'))
r = subprocess.run([FF, '-hide_banner', '-i', str(f), '-map', '0:a', '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
print('loudness', re.findall(r'I:\s+(-?[\d.]+) LUFS', r)[-1], 'LUFS; true peak', re.findall(r'Peak:\s+(-?[\d.]+)', r)[-1], 'dBTP')
import sys as _s; _s.modules.setdefault("torch", None)
from faster_whisper import WhisperModel
wav = OUT / f'{cut}-final.wav'
subprocess.run([FF, '-v', 'error', '-y', '-i', str(f), '-ac', '1', '-ar', '16000', str(wav)], check=True)
segs, _ = WhisperModel('small.en').transcribe(str(wav), word_timestamps=True, language='en')
words = [(x.word.strip(), x.start) for s in segs for x in s.words]
text = ' '.join(x[0] for x in words)
(OUT / f'{cut}-whisper.txt').write_text('\n'.join(f'{t:7.2f} {x}' for x, t in words))
print('whisper, last 14 words:', ' '.join(x[0] for x in words[-14:]))
print('heard the address:', bool(re.search(r'make\s*your\s*mind\s*up|makeyourmindup', text, re.I)))
