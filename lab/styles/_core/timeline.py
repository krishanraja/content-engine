#!/usr/bin/env python3
"""Align the house test script to the word times of Krish's take.

    python3 lab/styles/_core/timeline.py --script SCRIPT.txt --words words.json --out timeline.json

words.json is a list of {w, s, e} (seconds) from any aligner (faster-whisper on the take). The script is the
truth for the words; the take is the truth for the timing. Each script word gets the time of the transcript word it
matches. Words the transcript wrote differently ("20" for "twenty", "Citibank" for "city bank", "43 %" for
"Forty-three percent") take the span of what they matched, shared out evenly. Each script line is one beat.
"""
import argparse
import difflib
import json
import re

NUMBERS = {'twenty': '20', 'thirteen': '13', 'forty-three': '43', 'percent': '%'}


def norm(w):
    w = w.lower().strip()
    w = NUMBERS.get(re.sub(r'[^a-z\-]', '', w), w)
    return re.sub(r"[^a-z0-9%]", '', w)


def align(lines, words):
    script = [(li, tok) for li, line in enumerate(lines) for tok in line.split()]
    a = [norm(t) for _, t in script]
    b = [norm(x['w']) for x in words]
    times = [None] * len(script)
    sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == 'equal':
            for k in range(i2 - i1):
                times[i1 + k] = (words[j1 + k]['s'], words[j1 + k]['e'])
        elif op == 'replace' or (op == 'delete' and j1 > 0):
            js = words[j1:j2] or [words[j1 - 1]]
            s, e = js[0]['s'], js[-1]['e']
            n = i2 - i1
            for k in range(n):
                times[i1 + k] = (s + (e - s) * k / n, s + (e - s) * (k + 1) / n)
    for k, t in enumerate(times):
        if t is None:
            prev = times[k - 1] if k else (0.0, 0.0)
            times[k] = (prev[1], prev[1])
    beats = []
    for li, line in enumerate(lines):
        ws = [{'w': tok, 's': round(times[k][0], 3), 'e': round(times[k][1], 3)}
              for k, (l2, tok) in enumerate(script) if l2 == li]
        beats.append({'i': li, 'text': line, 's': ws[0]['s'], 'e': ws[-1]['e'], 'words': ws})
    return beats


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--script', required=True)
    ap.add_argument('--words', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--duration', type=float, required=True, help='seconds of audio in the take')
    a = ap.parse_args()
    lines = [l.strip() for l in open(a.script, encoding='utf-8') if l.strip()]
    words = json.load(open(a.words, encoding='utf-8'))
    beats = align(lines, words)
    json.dump({'duration': a.duration, 'beats': beats}, open(a.out, 'w', encoding='utf-8'), indent=1)
    for b in beats:
        print(f"{b['s']:6.2f} {b['e']:6.2f}  {b['text'][:70]}")


if __name__ == '__main__':
    main()
