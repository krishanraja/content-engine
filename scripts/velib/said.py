"""ve said: what Krish said on the take, set against the script he read, and the words the cut should carry.

Krish, 4 Nov 2026 (docs/learning/2026-11-04-thursday-killed.md, answer 6): "the session would need to listen to what I
actually said on the script, as opposed to reading the teleprompter folders, because sometimes I paraphrase the
teleprompter script and that only gets picked up in the live recording."

From a take record (velib.takes: aligner A's words, the forced-alignment clock) and the script he read, this writes:

  said.<take>.json / .md       every difference, its kind (rephrase, aside, filler, number, restart...) and the rates,
                               by scripts/post-pack/narration_diff.py, the same report Monday 2 Nov's takes were read by;
  script.words.proposed.json   the words he said, in order, spelled the way the script spells them wherever he said the
                               script's words (a name, a number as digits, "Prompt's" for a heard "Prompts"), and as
                               heard where he said his own (each marked heard_only). This replaces the hand step
                               Thursday 5 Nov needed ("muse" set to "Muse", "Prompts" to "Prompt's"). It is a proposal:
                               the session reads it and makes it the piece's script.words.json, never this module.
  pace                         per line, words a second and every pause of 0.8 s or more inside it, for his proof
                               sheet; advisory, since no standard sets these numbers (Higgsfield's narration rule calls
                               a line over 2.9 words a second rushed).
"""
from __future__ import annotations

import difflib
import re
import sys
from pathlib import Path

from .common import sha256_file, write_json

_POST_PACK = str(Path(__file__).resolve().parents[1] / 'post-pack')
if _POST_PACK not in sys.path:
    sys.path.insert(0, _POST_PACK)
import narration_diff  # noqa: E402

SCHEMA = 've-said/1'
RUSHED_WPS = 2.9
LONG_PAUSE_S = 0.8
LINE_END = re.compile(r'[.?!]["”\')\]]*$')
PUNCT_END = re.compile(r'[.?!,;:]["”\')\]]*$')


def heard(record: dict) -> list[dict]:
    """The take's words as narration_diff reads them, from aligner A (the clock the cut is cut on)."""
    return [{'w': w['text'], 's': w['onset_s'], 'e': w['end_s']} for w in record['aligners']['a']['words']]


def proposed_words(script_text: str, record: dict) -> list[dict]:
    """The words he said, spelled the way the script spells them where he said the script's words."""
    read = narration_diff.script_tokens(script_text)
    said = narration_diff.join_split_names(narration_diff.spoken_tokens(heard(record)), read)
    out: list[dict] = []

    def extend(token):
        if out and token.get('e') is not None:
            out[-1]['end_s'] = round(max(out[-1]['end_s'], token['e']), 4)

    ops = difflib.SequenceMatcher(None, [t['c'] for t in read], [t['c'] for t in said], autojunk=False).get_opcodes()
    for tag, i1, i2, j1, j2 in ops:
        if tag == 'equal':
            for r, s in zip(read[i1:i2], said[j1:j2]):
                if r['w'].strip():
                    out.append({'word': r['w'].strip(), 'onset_s': round(s['s'], 4), 'end_s': round(s['e'], 4)})
                else:
                    extend(s)      # the dollar of "$40", said as "forty dollars": one word on screen
            continue
        if tag == 'delete':
            # Script words he did not say: nothing was heard, nothing is shown. A sentence still ends where it ended.
            mark = LINE_END.search(read[i2 - 1]['w'])
            if mark and out and not PUNCT_END.search(out[-1]['word']):
                out[-1]['word'] += mark.group(0)
            continue
        first = len(out)
        for s in said[j1:j2]:
            if s['w'].strip():
                out.append({'word': s['w'].strip(), 'onset_s': round(s['s'], 4), 'end_s': round(s['e'], 4), 'heard_only': True})
            else:
                extend(s)
        # A sentence the script ends inside his own words still ends: carry the script's closing mark onto his last word.
        mark = PUNCT_END.search(read[i2 - 1]['w']) if tag == 'replace' and i2 > i1 else None
        if mark and len(out) > first and not PUNCT_END.search(out[-1]['word']):
            out[-1]['word'] += mark.group(0)
    return [{'w': i, **row} for i, row in enumerate(out)]


def pace(words: list[dict]) -> list[dict]:
    """Per line (a line ends at . ? !): its words a second over its spoken span, and each pause of LONG_PAUSE_S or more
    between two of its words."""
    lines, current = [], []
    for word in words:
        current.append(word)
        if LINE_END.search(word['word']):
            lines.append(current)
            current = []
    if current:
        lines.append(current)
    out = []
    for number, line in enumerate(lines, 1):
        span = max(1e-6, line[-1]['end_s'] - line[0]['onset_s'])
        pauses = [{'after': a['word'], 'at_s': a['end_s'], 'pause_s': round(b['onset_s'] - a['end_s'], 2)}
                  for a, b in zip(line, line[1:]) if b['onset_s'] - a['end_s'] >= LONG_PAUSE_S]
        wps = round(len(line) / span, 2)
        out.append({'line': number, 'text': ' '.join(w['word'] for w in line), 'from_s': line[0]['onset_s'],
                    'words': len(line), 'words_per_s': wps, 'rushed': wps > RUSHED_WPS, 'pauses': pauses})
    return out


def pace_lines(rows: list[dict]) -> list[str]:
    out = ['', '## Pace, line by line (advisory)', '',
           f'Over {RUSHED_WPS} words a second reads as rushed; a pause of {LONG_PAUSE_S} s or more inside a line is listed.', '',
           '| Line | At | Words a second | Long pauses | Text |', '|---|---|---|---|---|']
    for row in rows:
        pauses = '; '.join(f'{p["pause_s"]} s after "{p["after"]}"' for p in row['pauses']) or '·'
        flag = ' (rushed)' if row['rushed'] else ''
        out.append(f'| {row["line"]} | {narration_diff.clock(row["from_s"])} | {row["words_per_s"]}{flag} | {pauses} | '
                   f'{row["text"].replace("|", chr(92) + "|")} |')
    return out


def make(script_path: str | Path, record: dict, ve_dir: str | Path) -> dict:
    """Write said.<take>.json and .md and script.words.proposed.json in the piece's ve folder; return the report."""
    script_path, ve_dir = Path(script_path), Path(ve_dir)
    text = script_path.read_text(encoding='utf-8-sig')
    words = heard(record)
    if not words:
        raise ValueError(f'take {record["take"]}: aligner A heard no words')
    read, said, devs, matched = narration_diff.diff(text, words)
    rates = narration_diff.rates(text, words, read, said, devs, matched)
    proposal = proposed_words(text, record)
    rows = pace(proposal)
    take = record['take']
    source = {'take': take, 'media_sha256': record['media']['sha256'], 'aligner': record['aligners']['a']['name'],
              'script': script_path.name, 'script_sha256': sha256_file(script_path)}
    report = {'schema': SCHEMA, **source, 'rates': rates, 'differences': devs, 'pace': rows,
              'heard_only': sum(1 for w in proposal if w.get('heard_only'))}
    write_json(ve_dir / f'said.{take}.json', report)
    md = narration_diff.markdown(f'{take}', rates, devs).rstrip('\n').split('\n') + pace_lines(rows)
    (ve_dir / f'said.{take}.md').write_text('\n'.join(md) + '\n', encoding='utf-8')
    write_json(ve_dir / 'script.words.proposed.json', {
        'schema': 've-script-words-proposed/1', 'source': source,
        'note': ('What he said on the take, spelled as the script spells it where he said its words; heard_only marks his '
                 'own words. A proposal: read it, then make it script.words.json (Krish, 4 Nov 2026: listen to the take).'),
        'text': ' '.join(w['word'] for w in proposal),
        'words': proposal})
    return report
