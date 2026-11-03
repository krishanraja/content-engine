"""Forced alignment: the words he said, placed on the audio by a local, free acoustic model.

Whisper's word times run edge to edge and drift by 3 to 19 frames around pauses; two whisper passes over the same
speech disagree by as much. A forced aligner is given the words and finds where each one is in the sound. Two
different forced aligners (MMS and wav2vec2 960h) agreed on all 148 words of Thursday 5 Nov's cut within 2 frames
(median 0.6), and both matched the loudness envelope where he paused. So captions are drawn from one and checked by
the other; whisper only supplies the words when no script is given.

No paid aligner (Krish, 2026-10-29: "do not use eleven labs for this"). Needs torch and torchaudio (CPU build).

    python scripts/velib/forced_align.py <media> <words.json|script.txt> <mms-fa|wav2vec2-960h> <out.json>

The output is a word clock ve ingest and ve qc --heard read: {"aligner": ..., "words": [{"w", "s", "e", "word", "start", "end"}]}.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

MODELS = {'mms-fa': 'torchaudio:mms-fa', 'wav2vec2-960h': 'torchaudio:wav2vec2-base-960h'}


def words_of(path: str | Path) -> list[str]:
    """The words to place: a script's text, or the words of a clock (whisper's {w|word|text})."""
    text = Path(path).read_text(encoding='utf-8-sig')
    if Path(path).suffix != '.json':
        return text.split()
    doc = json.loads(text)
    items = doc.get('words') if isinstance(doc, dict) else doc
    return [str(w.get('w', w.get('word', w.get('text', '')))).strip() for w in items
            if str(w.get('w', w.get('word', w.get('text', '')))).strip()]


def _audio(media, rate):
    import numpy as np  # noqa: PLC0415
    import torch  # noqa: PLC0415
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(media), '-map', '0:a:0', '-ac', '1', '-ar', str(rate),
                          '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return torch.from_numpy(np.frombuffer(raw, np.float32).copy()).unsqueeze(0)


def align(media, words: list[str], model: str) -> list[dict]:
    import torch  # noqa: PLC0415
    import torchaudio  # noqa: PLC0415
    if model == 'mms-fa':
        from torchaudio.pipelines import MMS_FA as bundle  # noqa: PLC0415
        wave = _audio(media, bundle.sample_rate)
        norm = [re.sub(r"[^a-z']", '', w.lower().replace('’', "'")) or 'a' for w in words]
        with torch.inference_mode():
            emission, _ = bundle.get_model()(wave)
            spans = bundle.get_aligner()(emission[0], bundle.get_tokenizer()(norm))
        ratio = wave.shape[1] / emission.shape[1] / bundle.sample_rate
        return [{'w': w, 's': round(s[0].start * ratio, 3), 'e': round(s[-1].end * ratio, 3)} for w, s in zip(words, spans)]
    if model == 'wav2vec2-960h':
        from torchaudio.pipelines import WAV2VEC2_ASR_BASE_960H as bundle  # noqa: PLC0415
        wave = _audio(media, bundle.sample_rate)
        index = {c: i for i, c in enumerate(bundle.get_labels())}
        norm = [re.sub(r"[^A-Z']", '', w.upper().replace('’', "'")) or 'A' for w in words]
        with torch.inference_mode():
            emission, _ = bundle.get_model()(wave)
            emission = torch.log_softmax(emission, dim=-1)
        tokens = torch.tensor([[index[c] for c in '|'.join(norm)]], dtype=torch.int32)
        path, _ = torchaudio.functional.forced_align(emission, tokens, blank=0)
        spans = torchaudio.functional.merge_tokens(path[0], torch.ones(path.shape[1]))
        ratio = wave.shape[1] / emission.shape[1] / bundle.sample_rate
        out, k = [], 0
        for w, n in zip(words, norm):
            chars = spans[k:k + len(n)]
            k += len(n) + 1  # the word separator
            out.append({'w': w, 's': round(chars[0].start * ratio, 3), 'e': round(chars[-1].end * ratio, 3)})
        return out
    raise ValueError(f'{model}: the forced aligners are {", ".join(MODELS)}')


def main(argv: list[str]) -> int:
    if len(argv) != 4:
        print(__doc__.strip().splitlines()[-3], file=sys.stderr)
        return 2
    media, source, model, out = argv
    # ve ingest reads word/start/end; the cut gates read w/s/e (text, start, end). Both, for the same times.
    words = [{**w, 'word': w['w'], 'start': w['s'], 'end': w['e']} for w in align(media, words_of(source), model)]
    Path(out).write_text(json.dumps({'aligner': MODELS[model], 'words': words}, indent=1) + '\n', encoding='utf-8')
    print(f'{MODELS[model]}: {len(words)} words -> {out}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
