"""The words gate's own comparison for a rebuilt cut. The gate's built-in transcriber imports a module that pulls in a
broken torch here, so this hears the finished file with exactly its settings (faster-whisper small.en, int8, beam 5,
VAD, word timings), writes the words json beside the cut, and runs scripts/quick-edit/words_gate.py on it.
    python3 docs/plans/2026-11-02-monday/rebuild/gate.py long|short [VIDEO]"""
import json, subprocess, sys
from pathlib import Path
sys.modules.setdefault("torch", None)   # a broken torch install here; ctranslate2 runs without it
from faster_whisper import WhisperModel
ROOT = Path(__file__).resolve().parents[4]; P = ROOT / 'docs/plans/2026-11-02-monday'
cut = sys.argv[1]
video = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / '.cache/proof/mon' / ('mon-long-16x9.mp4' if cut == 'long' else 'mon-short-9x16.mp4')
segs, info = WhisperModel('small.en', device='cpu', compute_type='int8', cpu_threads=4).transcribe(
    str(video), word_timestamps=True, vad_filter=True, beam_size=5)
words = [{'w': w.word, 's': round(w.start, 3), 'e': round(w.end, 3)} for s in segs for w in s.words]
heard = video.with_name(video.name + '.words-gate.heard.json')
heard.write_text(json.dumps({'duration': info.duration, 'words': words, 'provenance': {'model': 'small.en'}}))
r = subprocess.run([sys.executable, str(ROOT / 'scripts/quick-edit/words_gate.py'), '--script', str(P / f'script-{cut}.md'),
                    '--take-words', str(P / f'takes/{cut}.words.json'), '--final', str(heard)], capture_output=True, text=True)
d = json.loads(r.stdout)
(video.with_name(video.name + '.words-gate.json')).write_text(r.stdout)
print(r.stderr.strip().splitlines()[-1] if r.stderr.strip() else '')
total = 0
for k, v in d.items():
    if isinstance(v, list) and v and isinstance(v[0], dict):
        total += len(v)
        print(f'{k}: {len(v)}')
        for row in v: print('   ', row.get('message') or json.dumps(row)[:160])
print('differences in all lists:', total)
