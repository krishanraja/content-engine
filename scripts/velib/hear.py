"""ve hear: the listen pass. What is in the take's sound, beyond the words the transcriber chose to write down.

Krish, 5 Nov 2026: the machine should "listen to a recorded video of mine and automatically post-edit errors out
(for example, based on fumbles in speech)".

Whisper is trained to write clean text, so it leaves out most of his "um"s, half-words and stutters, and the two
aligners then stretch the words around them edge to edge. A fumble nobody wrote down cannot be cut, and a join can
land on it (config/failures.json chopped-words-published). This pass hears the take three ways, all local and free:

  1. the sound itself: level and voicing every 10 ms (a periodic voice between 70 and 400 Hz), from which come the
     quiet spans a join may sit in, and voiced sound no word covers (`unworded`);
  2. a character-level acoustic model (wav2vec2-960h, the forced aligner's own model, greedy-decoded), which writes
     what it hears letter by letter, hesitations and broken words included (`--ctc`; needs torch);
  3. a second faster-whisper pass told to write disfluent speech ("Um, I- I think..."), with his lexicon's terms as
     hotwords (`--whisper MODEL`).

From them it writes events: `hesitation` (um, uh, er), `partial` (a broken-off word before the whole one: "cl-
clearly"), `stutter` (the same short word twice where the take's clock has it once) and `unworded` (voice no word
covers). Each event says which sources heard it and how conform may use it:

  word   heard by an ear that writes words, at a time no clock word covers: conform treats it as an unscripted word,
         so it is cut when agreed gaps bound it and kept and reported when they do not;
  trim   inside a clock word's span (the aligners folded it into the word) and heard by two ears that write words:
         the word's edge is moved off it in both clocks, then it is treated as above;
  flag   inside a clock word and heard by one ear only: never cut; the word counts against its reading and is listed;
  guard  voice alone: never cut; no join may land on it.

It also measures every word (velib/delivery.py), and stores all of it in the take record under `listen`, bound to
the media's sha256, so conform and its lint read one record. Nothing here edits anything.
"""
from __future__ import annotations

import math
import subprocess
from pathlib import Path

from . import lexicon

SCHEMA = 've-listen/1'
RATE = 16000
HOP_S = 0.010
WIN_S = 0.040           # long enough to hold almost three periods of a 70 Hz voice
F0_MIN, F0_MAX = 70.0, 400.0
VOICING_MIN = 0.45          # normalised autocorrelation peak that counts as a periodic voice
QUIET_BELOW_SPEECH_DB = 24  # quieter than the take's loud speech (90th percentile) by this much, and unvoiced
QUIET_MIN_S = 0.020         # a quiet run shorter than this is not a place to join
UNWORDED_MIN_S = 0.10       # voice shorter than this is a click or a breath edge
UNWORDED_COVER = 0.30       # voice counts as unworded when clock words cover less than this share of it
OVERLAP = 0.5               # two events are one when they overlap by half the shorter
PARTIAL_MAX_LETTERS = 4
KINDS = ('hesitation', 'partial', 'stutter', 'unworded')


# ------------------------------------------------------------------ 1. the sound

def decode(media: str | Path) -> 'list':
    """Mono float32 samples at 16 kHz, by ffmpeg."""
    import numpy as np  # noqa: PLC0415
    from .common import ffmpeg  # noqa: PLC0415
    raw = subprocess.run([ffmpeg(), '-v', 'error', '-i', str(media), '-map', '0:a:0', '-ac', '1', '-ar', str(RATE),
                          '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def frames(samples, rate: int = RATE, chunk: int = 2000) -> dict:
    """Per 10 ms frame: level in dBFS, voicing strength 0..1 and pitch in Hz (0 when unvoiced). Worked in chunks of
    frames, so a long take never holds its whole spectrogram in memory."""
    import numpy as np  # noqa: PLC0415
    x = np.asarray(samples, dtype=np.float64)
    hop, win = int(round(HOP_S * rate)), int(round(WIN_S * rate))
    count = max(0, 1 + (len(x) - win) // hop) if len(x) >= win else 0
    if not count:
        return {'hop_s': HOP_S, 'db': np.zeros(0), 'voicing': np.zeros(0), 'f0': np.zeros(0)}
    size = 1 << int(math.ceil(math.log2(2 * win)))
    lo, hi = int(rate / F0_MAX), min(win - 1, int(rate / F0_MIN))
    hann = np.hanning(win)
    # The Hann taper's own autocorrelation falls with lag; dividing by it keeps a long period from reading as weak.
    taper = np.fft.irfft(np.abs(np.fft.rfft(hann, size)) ** 2, size)[:win]
    taper = taper / taper[0] + 1e-9
    db, strength, f0 = np.empty(count), np.empty(count), np.empty(count)
    for first_frame in range(0, count, chunk):
        n = min(chunk, count - first_frame)
        index = np.arange(win)[None, :] + hop * (first_frame + np.arange(n))[:, None]
        block = x[index]
        db[first_frame:first_frame + n] = 20 * np.log10(np.sqrt(np.mean(block ** 2, axis=1)) + 1e-9)
        centred = (block - block.mean(axis=1, keepdims=True)) * hann[None, :]
        auto = np.fft.irfft(np.abs(np.fft.rfft(centred, size, axis=1)) ** 2, size, axis=1)[:, :win]
        norm = auto / (auto[:, :1] + 1e-12) / taper[None, :]
        band = norm[:, lo:hi + 1]
        # The first peak near the strongest is the period; the peak at twice the period is as strong, and taking it
        # would put every voice an octave low.
        peak = band.max(axis=1)
        first = np.argmax(band >= 0.85 * peak[:, None], axis=1)
        lags = np.empty(n, dtype=int)
        for row in range(n):
            i = first[row]
            while i + 1 < band.shape[1] and band[row, i + 1] > band[row, i]:
                i += 1
            lags[row] = i + lo
        st = np.clip(norm[np.arange(n), lags], 0.0, 1.0)
        strength[first_frame:first_frame + n] = st
        f0[first_frame:first_frame + n] = np.where(st >= VOICING_MIN, rate / lags, 0.0)
    return {'hop_s': HOP_S, 'db': db, 'voicing': strength, 'f0': f0}


def _runs(mask, hop_s: float, min_s: float) -> list[list[float]]:
    out, start = [], None
    for i, on in enumerate(list(mask) + [False]):
        if on and start is None:
            start = i
        elif not on and start is not None:
            if (i - start) * hop_s >= min_s - 1e-9:
                out.append([round(start * hop_s, 3), round(i * hop_s + (WIN_S - HOP_S), 3)])
            start = None
    return out


def levels(fr: dict) -> dict:
    """The take's speech level, its quiet line, and which frames are voice and which are quiet."""
    import numpy as np  # noqa: PLC0415
    db = fr['db']
    if not len(db):
        return {'speech_db': None, 'quiet_line_db': None, 'voiced': db.astype(bool), 'quiet': db.astype(bool)}
    speech = float(np.percentile(db, 90))
    line = max(-70.0, speech - QUIET_BELOW_SPEECH_DB)
    voiced = (fr['voicing'] >= VOICING_MIN) & (db > line)
    quiet = (db < line) & ~voiced
    return {'speech_db': round(speech, 2), 'quiet_line_db': round(line, 2), 'voiced': voiced, 'quiet': quiet}


def quiet_spans(fr: dict, lv: dict) -> list[list[float]]:
    """Where a join may sit: runs of quiet, unvoiced frames. A quiet run's edges are pulled in by the analysis window,
    so a span never reaches into the frame where the sound starts."""
    out = []
    for start, end in _runs(lv['quiet'], fr['hop_s'], QUIET_MIN_S):
        end = round(end - (WIN_S - HOP_S), 3)
        if end - start >= QUIET_MIN_S - 1e-9:
            out.append([start, end])
    return out


def voiced_spans(fr: dict, lv: dict) -> list[list[float]]:
    return _runs(lv['voiced'], fr['hop_s'], HOP_S)


# ------------------------------------------------------------------ 2. the ears that write words

def ctc_words(media: str | Path) -> list[dict]:
    """What wav2vec2-960h hears, greedy-decoded letter by letter: [{text, s, e}] in lower case, hesitations and broken
    words left in. Needs torch and torchaudio (CPU build)."""
    import torch  # noqa: PLC0415
    from torchaudio.pipelines import WAV2VEC2_ASR_BASE_960H as bundle  # noqa: PLC0415
    from .forced_align import _audio  # noqa: PLC0415
    wave = _audio(media, bundle.sample_rate)
    labels = bundle.get_labels()
    with torch.inference_mode():
        emission, _ = bundle.get_model()(wave)
    best = emission[0].argmax(dim=-1).tolist()
    step = wave.shape[1] / emission.shape[1] / bundle.sample_rate
    words, text, start, last, previous = [], '', None, None, None
    for t, k in enumerate(best):
        char = labels[k]
        if k == previous:
            if char not in ('-', '|') and last is not None:
                last = t
            continue
        previous = k
        if char == '-':           # the blank
            continue
        if char == '|':
            if text:
                words.append({'text': text.lower(), 's': round(start * step, 3), 'e': round((last + 1) * step, 3)})
            text, start, last = '', None, None
            continue
        if start is None:
            start = t
        text += char
        last = t
    if text:
        words.append({'text': text.lower(), 's': round(start * step, 3), 'e': round((last + 1) * step, 3)})
    return words


DISFLUENT_PROMPT = 'Um, so, uh, I- I think, like, the- the thing is, hmm, okay.'


def whisper_words(media: str | Path, model: str, *, lexicon_doc: dict | None = None) -> list[dict]:
    """A second faster-whisper pass told to keep hesitations and broken words, with his lexicon as hotwords."""
    from faster_whisper import WhisperModel  # noqa: PLC0415
    doc = lexicon_doc if lexicon_doc is not None else lexicon.load()
    names = lexicon.terms(doc, limit=30)
    prompt = DISFLUENT_PROMPT + (' ' + ', '.join(names) + '.' if names else '')
    segments, _info = WhisperModel(model, device='cpu', compute_type='int8').transcribe(
        str(media), word_timestamps=True, vad_filter=True, beam_size=5, language='en', initial_prompt=prompt,
        hotwords=lexicon.hotwords(doc) or None, condition_on_previous_text=False)
    return [{'text': w.word.strip(), 's': round(w.start, 3), 'e': round(w.end, 3),
             **({'p': round(float(w.probability), 3)} if getattr(w, 'probability', None) is not None else {})}
            for s in segments for w in (s.words or []) if w.word.strip()]


# ------------------------------------------------------------------ 3. events

def _bare(text: str) -> str:
    return lexicon._bare(text)


def _overlap(a0, a1, b0, b1) -> float:
    return max(0.0, min(a1, b1) - max(a0, b0))


def word_events(words: list[dict], source: str, hesitations=lexicon.HESITATIONS) -> list[dict]:
    """Hesitations, broken-off words and stutters in one ear's words."""
    out = []
    bare = [_bare(w['text']) for w in words]
    for i, w in enumerate(words):
        tok, nxt = bare[i], bare[i + 1] if i + 1 < len(words) else ''
        kind = None
        if tok in hesitations:
            kind = 'hesitation'
        elif nxt and tok and len(tok) <= PARTIAL_MAX_LETTERS and len(tok) < len(nxt) and nxt.startswith(tok) \
                and (w['text'].rstrip().endswith('-') or tok not in _COMMON):
            kind = 'partial'
        elif nxt and tok == nxt and len(tok) <= PARTIAL_MAX_LETTERS and words[i + 1]['s'] - w['e'] < 0.6:
            kind = 'stutter'
        if kind:
            out.append({'kind': kind, 's': w['s'], 'e': w['e'], 'text': tok, 'sources': [source]})
    return out


_COMMON = frozenset('a an and as at be but by do go he i if in is it me my no of oh on or so to up us we you the this '
                    'that then than them they there their these those what when how who why was were are not now'.split())


def unworded_events(voiced: list[list[float]], clocks: list[list[dict]]) -> list[dict]:
    """Voice that the take's clocks cover less than UNWORDED_COVER of."""
    words = sorted((w['onset_s'], w['end_s']) for clock in clocks for w in clock)
    out = []
    for s, e in voiced:
        if e - s < UNWORDED_MIN_S:
            continue
        covered = sum(_overlap(s, e, a, b) for a, b in words)
        if covered < UNWORDED_COVER * (e - s):
            out.append({'kind': 'unworded', 's': s, 'e': e, 'text': '', 'sources': ['voicing']})
    return out


def merge(events: list[dict]) -> list[dict]:
    """Events from different sources that overlap by half the shorter are one event, heard by each."""
    out: list[dict] = []
    for ev in sorted(events, key=lambda x: (x['s'], x['e'])):
        for kept in out:
            if _overlap(kept['s'], kept['e'], ev['s'], ev['e']) >= OVERLAP * min(kept['e'] - kept['s'], ev['e'] - ev['s']):
                kept['sources'] = sorted(set(kept['sources']) | set(ev['sources']))
                if KINDS.index(ev['kind']) < KINDS.index(kept['kind']):
                    kept['kind'], kept['text'] = ev['kind'], ev['text'] or kept['text']
                kept['s'], kept['e'] = round(min(kept['s'], ev['s']), 3), round(max(kept['e'], ev['e']), 3)
                break
        else:
            out.append(dict(ev))
    return out


def classify(events: list[dict], clock_a: list[dict], ears: dict[str, list[dict]]) -> list[dict]:
    """Say how conform may use each event: word, trim, flag or guard (see the module's docstring)."""
    out = []
    for ev in events:
        wordy = [s for s in ev['sources'] if s != 'voicing']
        inside = [w for w in clock_a if _overlap(w['onset_s'], w['end_s'], ev['s'], ev['e']) > OVERLAP * (ev['e'] - ev['s'])]
        if not wordy:
            use = 'guard'
        elif not inside:
            use = 'word'
        else:
            # Inside a clock word. If an ear that heard the event also heard that word, at its own time, the event is
            # extra sound the aligners folded into the word (its "so" and then an "uh"). Otherwise the ear only heard
            # the word itself (a "the" it took for "th"), and the event is not a fumble.
            word = inside[0]
            heard_word = any(_bare(x['text']) == _bare(word['text']) and _overlap(x['s'], x['e'], word['onset_s'], word['end_s']) > 0
                             and _overlap(x['s'], x['e'], ev['s'], ev['e']) < 0.5 * (ev['e'] - ev['s'])
                             for s in wordy for x in ears.get(s, []))
            if not heard_word:
                continue
            use = 'trim' if len(wordy) >= 2 else 'flag'
        out.append({**ev, 'use': use})
    return out


def listen(record: dict, samples, *, ears: dict[str, list[dict]] | None = None, lexicon_doc: dict | None = None) -> dict:
    """The listen block for a take record, from its samples and any ears that write words."""
    from . import delivery  # noqa: PLC0415
    ears = ears or {}
    doc = lexicon_doc if lexicon_doc is not None else lexicon.load()
    hesitations = lexicon.HESITATIONS | set(doc['hesitations']['counts'])
    fr = frames(samples)
    lv = levels(fr)
    a, b = record['aligners']['a']['words'], record['aligners']['b']['words']
    found = unworded_events(voiced_spans(fr, lv), [a, b])
    for name, words in ears.items():
        found += word_events(words, name, hesitations)
    events = classify(merge(found), a, ears)
    return {
        'schema': SCHEMA, 'media_sha256': record['media']['sha256'],
        'ears': sorted(['voicing', *ears]),
        'speech_db': lv['speech_db'], 'quiet_line_db': lv['quiet_line_db'],
        'quiet': quiet_spans(fr, lv),
        'events': events,
        'words': delivery.measure(a, fr),
        'heard': {name: words for name, words in ears.items()},
    }


def valid(record: dict) -> dict | None:
    """The record's listen block when it was made from this media, else None."""
    block = record.get('listen')
    if block and block.get('schema') == SCHEMA and block.get('media_sha256') == record['media']['sha256']:
        return block
    return None


def is_quiet(quiet: list[list[float]], t: float, half: float) -> bool:
    return any(s - 1e-6 <= t - half and t + half <= e + 1e-6 for s, e in quiet)


def counts(block: dict) -> dict:
    out = {}
    for ev in block.get('events', []):
        key = f"{ev['kind']}:{ev['use']}"
        out[key] = out.get(key, 0) + 1
    return out
