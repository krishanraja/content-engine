"""Compare recognition on source and finished decoded audio, with byte provenance.

Run in a task folder containing job.json and named .wav files. This is evidence,
not an automatic adjudication or a substitute for playback.
"""
import hashlib
import importlib.metadata
import json
import argparse
from pathlib import Path
from faster_whisper import WhisperModel

ap=argparse.ArgumentParser(description=__doc__)
ap.add_argument('--model',default='medium.en')
ap.add_argument('--beam-size',type=int,default=5)
ap.add_argument('--max-new-tokens',type=int,default=448)
args=ap.parse_args()
jobs=json.loads(Path('job.json').read_text())
model=WhisperModel(args.model,device='cpu',compute_type='int8',cpu_threads=2)
for name,identity in jobs.items():
    path=Path(name+'.wav')
    with path.open('rb') as f:
        assert hashlib.file_digest(f,'sha256').hexdigest()==identity['audio_sha256']
    segments,info=model.transcribe(str(path),word_timestamps=True,vad_filter=True,
        language='en',beam_size=args.beam_size,best_of=1,temperature=0,
        max_new_tokens=args.max_new_tokens)
    words=[]
    for segment in segments:
        words.extend({'w':w.word,'s':round(w.start,3),'e':round(w.end,3),'probability':w.probability} for w in segment.words)
        print(name,round(segment.end),flush=True)
    tag='medium' if args.model=='medium.en' else args.model
    Path(name+'.'+tag+'.json').write_text(json.dumps({'identity':identity,'duration':info.duration,
        'model':args.model,'beam_size':args.beam_size,'max_new_tokens':args.max_new_tokens,
        'transcriber':'faster-whisper','version':importlib.metadata.version('faster-whisper'),'words':words},indent=1))
