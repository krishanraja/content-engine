"""Words compared the way the words gate compares them, so a number Krish says as words is the script's digits.

The rules live once, in quick-edit's words gate (`scripts/quick-edit/words_gate.py` `canonical` and `numbers`, the
same ones `scripts/post-pack/narration_diff.py` follows): "fifteen" is "15", "two hundred and six" is "206", "two point
seven" is "2.7", "twenty first" is "21st", "forty dollars" is "$40", "sixty percent" is "60%". conform uses them so a
line he reads with a number said his own way is no longer refused by name (docs/ve/STATUS.md, before 5 Nov 2026).

What it does not do: a number whose words span two script words in a different order ("$40 billion" heard as "forty
billion dollars") still has to match word by word.
"""
from __future__ import annotations

import sys
from pathlib import Path

_QUICK_EDIT = str(Path(__file__).resolve().parents[1] / 'quick-edit')
if _QUICK_EDIT not in sys.path:
    sys.path.insert(0, _QUICK_EDIT)
import words_gate  # noqa: E402

MAX_WINDOW = 3   # comparison tokens one script word can hold: "$40" is 40 dollars, "2.7" is 2 7


def _has_digit(text: str) -> bool:
    return any(ch.isdigit() for ch in text)


def number_key(text: str) -> str | None:
    """A script word's number key: its comparison tokens with spelt numbers as digits, joined by spaces. None when the
    word holds no number, so an ordinary word is always matched exactly as before."""
    tokens = words_gate.numbers([{'t': t, 'i': 0} for t in words_gate.canonical(text)])
    joined = ' '.join(t['t'] for t in tokens)
    return joined if joined and _has_digit(joined) and len(tokens) <= MAX_WINDOW else None


def number_spans(heard: list[str]) -> dict[str, list[tuple[int, int]]]:
    """Every run of up to MAX_WINDOW comparison tokens in the words heard, in order, that holds a number: its key and
    the first and last heard word it covers ("two hundred and six" is "206" over four heard words)."""
    raw = [{'t': t, 'i': i} for i, text in enumerate(heard) for t in words_gate.canonical(text)]
    merged = words_gate.numbers(raw)
    out: dict[str, list[tuple[int, int]]] = {}
    for a in range(len(merged)):
        for b in range(a, min(len(merged), a + MAX_WINDOW)):
            run = merged[a:b + 1]
            joined = ' '.join(t['t'] for t in run)
            if not _has_digit(joined):
                continue
            span = (run[0]['i'], run[-1].get('last', run[-1]['i']))
            if span not in out.setdefault(joined, []):
                out[joined].append(span)
    return out
