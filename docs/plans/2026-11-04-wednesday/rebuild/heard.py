"""Listens to a finished cut (faster-whisper on its own final mix) and checks it against the burned captions: how many
caption words were heard near their time, the last words heard, and each spelling the captions correct
(Duet, Claire Vo, draft, makeyourmindup.ai). Run from the repository root:
    python3 docs/plans/2026-11-04-wednesday/rebuild/heard.py long|short"""
import json, re, subprocess, sys, glob
from pathlib import Path
from faster_whisper import WhisperModel
ROOT = Path(__file__).resolve().parents[4]; OUT = ROOT / '.cache/proof/wed'
cut = sys.argv[1]; tl = json.load(open(OUT / f'timeline-{cut}.json'))
video = OUT / ('wed-long-16x9.mp4' if cut == 'long' else 'wed-short-9x16.mp4')
wav = OUT / f'heard-{cut}.wav'
FF = sorted(glob.glob(str(ROOT / '.cache/tools/ffmpeg-*/bin')))[-1] + '/ffmpeg'
subprocess.run([FF, '-v', 'error', '-y', '-i', str(video), '-ac', '1', '-ar', '16000', str(wav)], check=True)
segs, _ = WhisperModel('small.en', device='cpu', compute_type='int8', cpu_threads=2).transcribe(
    str(wav), word_timestamps=True, language='en', initial_prompt='Claude Duet, Anthropic, Claire Vo, makeyourmindup.ai')
heard = [(w.word.strip(), w.start) for s in segs for w in s.words]
n = lambda w: re.sub(r"[^a-z0-9]", '', w.lower())
hits = 0
for w, t in tl['words']:
    if any(n(h) == n(w) and abs(ht - t) < 1.5 for h, ht in heard): hits += 1
print(f'{cut}: {hits}/{len(tl["words"])} caption words heard within 1.5 s ({100 * hits / len(tl["words"]):.1f}%)')
print('last heard:', ' '.join(f'{h}@{t:.1f}' for h, t in heard[-12:]))
print('caption end:', ' '.join(f'{w}@{t:.1f}' for w, t in tl['words'][-8:]), '| cut ends', tl['dur'])
for key in ('Duet', 'Claire', 'draft', 'makeyourmindup', 'DeWitt', 'Dewitt', 'Clairvaux'):
    cap = [round(t, 1) for w, t in tl['words'] if key.lower() in w.lower()]
    hd = [(h, round(t, 1)) for h, t in heard if key.lower() in h.lower()]
    print(f'  {key}: captions {len(cap)}x, heard as written {len(hd)}x', hd[:4])
