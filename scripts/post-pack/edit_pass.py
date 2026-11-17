#!/usr/bin/env python3
"""edit_pass: the first cut of a take, by rule, from its word timings: restarts out, silences cut, length measured,
and the even speed-up that brings a short under its limit.

Krish, 2026-11-17: "the prompt should ensure it gets the session to look for places I've had to restart a sentence,
clip those out, clip out empty awkward silences, and then measure the total duration, and then speed it up if needed to
get it under the 90 second limit (longer video length does not matter)".

    python3 scripts/post-pack/edit_pass.py --transcribe TAKE [--words-out WORDS.json] [--script SCRIPT.md] [--cap 90] [--out edit.json]
    python3 scripts/post-pack/edit_pass.py WORDS.json [--script SCRIPT.md] [--cap 90] [--out edit.json]
    python3 scripts/post-pack/edit_pass.py --self-test

WORDS.json is the take's word timings: whisper's JSON (segments with words) or a plain list of {word, start, end}.
--cap is the most seconds the cut may run (a short: 90; leave it out for a long cut, which is never sped up).
--script is the approved words: a phrase the script itself says twice is never taken for a restart.

It writes, and prints:
  raw_seconds     the take from its first word to its last
  restarts        each abandoned attempt it clipped: where it started and the words he said before starting again
  silences_cut    how many pauses longer than a breath it shortened to a breath
  keep            the spans of the take to keep, in seconds, in order
  kept_seconds    the length of those spans with a breath between them
  speed           the even speed-up the cut needs to run under the cap (2 seconds of headroom), 1.0 when it fits;
                  never past 1.25, and over_cap says so when even that is not enough
  final_seconds   kept_seconds / speed

A restart is an attempt he abandoned: a run of at least two words he says again soon after (three words, or two
after a pause of a third of a second), where the attempt he dropped is short (at most four words past the repeat) and
never holds the end of a sentence. The first attempt is dropped, the last full attempt kept. So a sentence he finished
("You need to learn it. You need to use it") and a phrase he repeats for effect ("AI is going to change your job and
your team and AI is going to change how you hire") are kept, and so is any phrase the approved script says twice.
Every cut is a proposal by rule: the session checks each against the approved words and listens to it before it
builds on it.
"""
import argparse
import json
import re
import sys

BREATH = 0.25          # what a cut pause is left at
SILENCE = 0.6          # a pause longer than this is cut to a breath
LOOKAHEAD = 25         # how far after an attempt its retry may start, in words
HEADROOM = 2.0         # seconds under the cap the cut aims for
MAX_SPEED = 1.25


def norm(w):
    return re.sub(r"[^a-z0-9']+", '', str(w).lower())


def read_words(data):
    """Words with start and end, from whisper's JSON or a plain list, in time order."""
    raw = []
    if isinstance(data, dict) and isinstance(data.get('segments'), list):
        for seg in data['segments']:
            raw.extend(seg.get('words') or [])
    elif isinstance(data, dict) and isinstance(data.get('words'), list):
        raw = data['words']
    elif isinstance(data, list):
        raw = data
    out = []
    for w in raw:
        try:
            text = str(w.get('word', w.get('text', ''))).strip()
            start, end = float(w['start']), float(w['end'])
        except (KeyError, TypeError, ValueError, AttributeError):
            continue
        if text and end >= start:
            out.append({'word': text, 'start': start, 'end': end, 'n': norm(text)})
    return sorted(out, key=lambda w: w['start'])


SENTENCE_END = re.compile(r'[.?!]["\')\]]*$')
SPARE = 4              # an abandoned attempt runs at most this many words past the words it repeats


def script_twice(script):
    """Every run of two to five words the approved script itself says more than once."""
    w = [norm(x) for x in str(script or '').split()]
    w = [x for x in w if x]
    seen, twice = set(), set()
    for k in range(2, 6):
        for i in range(len(w) - k + 1):
            t = tuple(w[i:i + k])
            (twice if t in seen else seen).add(t)
    return twice


def find_restarts(words, script=None):
    """The indexes to drop (each abandoned attempt), and what each attempt said."""
    meant = script_twice(script)
    drop, found = set(), []
    i = 0
    while i < len(words):
        best = None
        for j in range(i + 1, min(len(words), i + 1 + LOOKAHEAD)):
            k = 0
            while j + k < len(words) and i + k < j and words[i + k]['n'] and words[i + k]['n'] == words[j + k]['n']:
                k += 1
            if k < 2:
                continue
            pause = words[j]['start'] - words[j - 1]['end']
            attempt = words[i:j]
            finished = any(SENTENCE_END.search(w['word']) for w in attempt)
            if tuple(w['n'] for w in words[i:i + k]) in meant or tuple(w['n'] for w in words[i:i + min(k, 5)]) in meant:
                continue
            if (k >= 3 or pause >= 0.33) and len(attempt) <= k + SPARE and not finished:
                best = j  # the latest retry that matches wins: the last full attempt is kept
        if best is not None:
            found.append({'at': round(words[i]['start'], 2), 'said': ' '.join(w['word'] for w in words[i:best])[:300]})
            drop.update(range(i, best))
            i = best
        else:
            i += 1
    return drop, found


def edit(words, cap=None, script=None):
    if not words:
        return {'raw_seconds': 0, 'restarts': [], 'silences_cut': 0, 'keep': [], 'kept_seconds': 0, 'cap_seconds': cap,
                'speed': 1.0, 'final_seconds': 0, 'over_cap': False}
    drop, restarts = find_restarts(words, script)
    spans, cut, prev = [], 0, None
    for i, w in enumerate(words):
        if i in drop:
            continue
        # A dropped attempt between two kept words always ends the span, so the clipped words never stay in the cut.
        clipped = prev is not None and any(j in drop for j in range(prev + 1, i))
        if spans and not clipped and w['start'] - spans[-1][1] <= SILENCE:
            spans[-1][1] = max(spans[-1][1], w['end'])
        else:
            if spans and not clipped:
                cut += 1
            spans.append([w['start'], w['end']])
        prev = i
    # A cut pause leaves a breath; the spans join with one between them.
    kept_seconds = sum(e - s for s, e in spans) + BREATH * (len(spans) - 1)
    for s in spans:
        s[0], s[1] = round(s[0], 3), round(s[1], 3)
    speed, over = 1.0, False
    if cap and kept_seconds > cap - HEADROOM:
        speed = kept_seconds / (cap - HEADROOM)
        if speed > MAX_SPEED:
            speed, over = MAX_SPEED, True
    return {
        'raw_seconds': round(words[-1]['end'] - words[0]['start'], 2), 'restarts': restarts, 'silences_cut': cut,
        'keep': spans, 'kept_seconds': round(kept_seconds, 2), 'cap_seconds': cap, 'speed': round(speed, 3),
        'final_seconds': round(kept_seconds / speed, 2), 'over_cap': over,
    }


def timed(text, start=0.0, step=0.4, pauses=None):
    """Test words: one every `step` seconds, with extra pauses before given word indexes."""
    pauses = pauses or {}
    out, t = [], start
    for i, w in enumerate(text.split()):
        t += pauses.get(i, 0)
        out.append({'word': w, 'start': round(t, 3), 'end': round(t + step - 0.05, 3)})
        t += step
    return out


def self_test():
    # A sentence he finished, and a phrase repeated for effect, are never taken for restarts (review, 17 Nov).
    assert edit(read_words(timed('You need to learn it. You need to use it every single day')))['restarts'] == []
    assert edit(read_words(timed('AI is going to change your job and your team and AI is going to change how you hire')))['restarts'] == []
    # A phrase the approved script says twice is kept.
    assert edit(read_words(timed('the thing is the thing is it works', pauses={3: 0.5})), script='The thing is, the thing is: it works.')['restarts'] == []
    # A clipped restart leaves the cut even when he restarted fast: the kept spans skip it.
    r = edit(read_words(timed('so the thing is the thing is it works', step=0.2)))
    assert [x['said'] for x in r['restarts']] == ['so the thing is'] or [x['said'] for x in r['restarts']] == ['the thing is'], r['restarts']
    assert len(r['keep']) == 2 and r['silences_cut'] == 0, r
    # A restart after a stop: "The habit that" ... "The habit that costs you" keeps the second attempt only.
    r = edit(read_words(timed('The habit that the habit that costs you your job is blame', pauses={3: 0.5})))
    assert [x['said'] for x in r['restarts']] == ['The habit that'], r['restarts']
    # A phrase said twice for effect, without a stop, two words long, is kept.
    r = edit(read_words(timed('no really no really it matters')))
    assert r['restarts'] == [], r['restarts']
    # A long silence is cut to a breath.
    r = edit(read_words(timed('one two three four', pauses={2: 2.0})))
    assert r['silences_cut'] == 1 and abs(r['kept_seconds'] - (2 * (2 * 0.4 - 0.05) + BREATH)) < 0.01, r
    # Over the cap: sped up evenly to fit with headroom; a cut that fits is left alone; a long cut has no cap.
    long = read_words(timed(' '.join(['word'] * 3 + [f'w{i}' for i in range(250)])))
    r = edit(long, cap=90)
    assert r['speed'] > 1 and r['final_seconds'] <= 88.01, r['final_seconds']
    assert edit(read_words(timed('a short take that fits')), cap=90)['speed'] == 1.0
    assert edit(long)['speed'] == 1.0
    # Never past 1.25x, and it says so.
    r = edit(read_words(timed(' '.join(f'w{i}' for i in range(400)))), cap=90)
    assert r['speed'] == MAX_SPEED and r['over_cap'] is True
    # Whisper's own shape reads the same.
    assert len(read_words({'segments': [{'words': timed('hello there')}]})) == 2
    print('edit_pass self-test: ok')


def transcribe(take, model=None):
    """The whole take's words with their times (faster-whisper, the transcriber place-takes.yml pins), any audio or video."""
    import os
    from faster_whisper import WhisperModel
    m = WhisperModel(model or os.environ.get('WHISPER_MODEL', 'small.en'), device='cpu', compute_type='int8')
    segments, _ = m.transcribe(str(take), word_timestamps=True, vad_filter=False, beam_size=5, condition_on_previous_text=False)
    return [{'word': w.word.strip(), 'start': round(w.start, 3), 'end': round(w.end, 3)} for seg in segments for w in (seg.words or [])]


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    p.add_argument('words', nargs='?')
    p.add_argument('--transcribe', metavar='TAKE', help='transcribe this take first (audio or video)')
    p.add_argument('--words-out', help='where to keep the transcribed words')
    p.add_argument('--cap', type=float)
    p.add_argument('--script', help='the approved words, so a phrase the script says twice is kept')
    p.add_argument('--out')
    p.add_argument('--self-test', action='store_true')
    a = p.parse_args(argv)
    if a.self_test:
        self_test()
        return 0
    script = None
    if a.script:
        with open(a.script, encoding='utf-8') as f:
            script = f.read()
    if a.transcribe:
        words = transcribe(a.transcribe)
        if a.words_out:
            with open(a.words_out, 'w', encoding='utf-8') as f:
                json.dump(words, f)
        result = edit(read_words(words), a.cap, script)
    elif a.words:
        with open(a.words, encoding='utf-8') as f:
            result = edit(read_words(json.load(f)), a.cap, script)
    else:
        p.error('WORDS.json or --transcribe TAKE is required')
    text = json.dumps(result, indent=1)
    if a.out:
        with open(a.out, 'w', encoding='utf-8') as f:
            f.write(text + '\n')
    print(text)
    return 0


if __name__ == '__main__':
    sys.exit(main())
