#!/usr/bin/env python3
"""spoken_delta: what Krish changes when he reads his script aloud.

Krish, 2026-10-31: "start the script vs recording comparison". The strongest
signal of how he talks is the gap between the words he was given and the words
he said. This compares the signed script with his take's words (the
transcriber's word list, as words_gate reads it) and counts what moved:

  - swapped: a run of script words he said as other words;
  - cut: script words he left out;
  - added: words he said that the script does not have (ad-libs);
  - contracted: "it is" said as "it's", "do not" as "don't";
  - expanded: the other way round, "it's" said as "it is".

It keeps the counts, a rate per minute of take and a few short examples (at
most EXAMPLES of each kind, each at most EXAMPLE_WORDS words a side), never the
transcript itself. The tokens are words_gate's (spellings, numbers and split
names fold the same way), so a hearing difference words_gate already forgives
is not counted as a change here either.

    python scripts/voice/spoken_delta.py compare SCRIPT.txt TAKE.words.json [--json]
    python scripts/voice/spoken_delta.py record PIECE_ID CUT SCRIPT.txt TAKE.words.json
    python scripts/voice/spoken_delta.py backfill [--only NAME ...] [--model small.en]

compare prints the delta. record writes it onto the piece's making record as
spoken_delta.<cut> through the engine API (making.py post). Exit 0 on success,
2 when a file cannot be read or the take is empty.

backfill reads the engine's recordings (recording.py list and get), keeps the
takes named the Inbox way ("Mon 19 Oct - 90-second - ..."), pairs each with the
dated script on file (docs/plans/<date>-draft-script.md for a 3- or 5-minute
take, -draft-script-90s.md for a 90-second one), transcribes it with
faster-whisper on this machine (no paid call), and writes the counts to
.cache/spoken/backfill.json. A take whose script is not on file, or whose words
barely match the script on file (another piece recorded the same day), is
listed as unmatched, never guessed. The recording and its words stay in
.cache, which git ignores; the recording is deleted once transcribed.

A signal for the voice profile and the weekly learner, never a gate: a draft is
not held because he would change it.
"""
import argparse
import difflib
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts' / 'quick-edit'))
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import words_gate  # noqa: E402

EXAMPLES = 8
EXAMPLE_WORDS = 8
CUTS = ('long', 'short', 'feature')

# Contractions as their full forms, in words_gate's tokens (lower case, apostrophe kept).
CONTRACTIONS = {
    "it's": ('it', 'is'), "that's": ('that', 'is'), "there's": ('there', 'is'), "here's": ('here', 'is'),
    "what's": ('what', 'is'), "who's": ('who', 'is'), "he's": ('he', 'is'), "she's": ('she', 'is'),
    "let's": ('let', 'us'), "i'm": ('i', 'am'), "you're": ('you', 'are'), "we're": ('we', 'are'),
    "they're": ('they', 'are'), "i've": ('i', 'have'), "you've": ('you', 'have'), "we've": ('we', 'have'),
    "they've": ('they', 'have'), "i'll": ('i', 'will'), "you'll": ('you', 'will'), "we'll": ('we', 'will'),
    "they'll": ('they', 'will'), "it'll": ('it', 'will'), "i'd": ('i', 'would'), "you'd": ('you', 'would'),
    "we'd": ('we', 'would'), "they'd": ('they', 'would'), "don't": ('do', 'not'), "doesn't": ('does', 'not'),
    "didn't": ('did', 'not'), "isn't": ('is', 'not'), "aren't": ('are', 'not'), "wasn't": ('was', 'not'),
    "weren't": ('were', 'not'), "haven't": ('have', 'not'), "hasn't": ('has', 'not'), "hadn't": ('had', 'not'),
    "won't": ('will', 'not'), "wouldn't": ('would', 'not'), "can't": ('can', 'not'), "couldn't": ('could', 'not'),
    "shouldn't": ('should', 'not'), "mustn't": ('must', 'not'),
}
EXPANSIONS = {v: k for k, v in CONTRACTIONS.items()}


class DeltaError(Exception):
    """The comparison cannot be made (a missing file, an empty take)."""


def _keep_contractions(toks):
    """words_gate drops a possessive 's, which also turns "it's" into "it": put the contraction back."""
    out = []
    for t in toks:
        raw = str(t.get('w', '')).lower().replace('’', "'").strip('.,;:!?"()[]')
        out.append(raw if raw in CONTRACTIONS and t['t'] == raw.split("'")[0] else t['t'])
    return out


def _tokens(script_text, take_doc):
    script = _keep_contractions(words_gate.script_tokens(script_text))
    words = words_gate.words_of(take_doc)
    take = _keep_contractions(words_gate.tokens_of(words))
    if not take:
        raise DeltaError('the take has no words')
    starts = [w.get('s') for w in words if isinstance(w.get('s'), (int, float))]
    ends = [w.get('e') for w in words if isinstance(w.get('e'), (int, float))]
    seconds = (max(ends) - min(starts)) if starts and ends else None
    return script, take, seconds


def _expand(tokens):
    """Each contraction as its two full words, each word tagged with the contraction it came from (or None)."""
    out = []
    for n, t in enumerate(tokens):
        if t in CONTRACTIONS:
            out += [(w, n) for w in CONTRACTIONS[t]]
        else:
            out.append((t, None))
    return out


def _clip(tokens):
    return ' '.join(tokens[:EXAMPLE_WORDS]) + (' ...' if len(tokens) > EXAMPLE_WORDS else '')


def delta(script_text, take_doc):
    """The counts, rates and short examples of what moved between script and take. Pure.

    Both sides are compared with contractions written out, so "it is" said as "it's" lines up as the same
    words; a contraction on one side against full words on the other is then counted as contracted or
    expanded, once per contraction."""
    script_raw, take_raw, seconds = _tokens(script_text, take_doc)
    script, take = _expand(script_raw), _expand(take_raw)
    a, b = [w for w, _ in script], [w for w, _ in take]
    counts = {'swapped': 0, 'cut': 0, 'added': 0, 'contracted': 0, 'expanded': 0}
    examples = {k: [] for k in counts}
    matcher = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    seen = {'contracted': set(), 'expanded': set()}
    for op, i1, i2, j1, j2 in matcher.get_opcodes():
        if op == 'equal':
            for (_, cs), (_, ct) in zip(script[i1:i2], take[j1:j2]):
                kind, key = (('contracted', ct) if ct is not None and cs is None else
                             ('expanded', cs) if cs is not None and ct is None else (None, None))
                if kind and key not in seen[kind]:
                    seen[kind].add(key)
                    counts[kind] += 1
                    if len(examples[kind]) < EXAMPLES:
                        word = take_raw[key] if kind == 'contracted' else script_raw[key]
                        full = ' '.join(CONTRACTIONS[word])
                        examples[kind].append({'script': full, 'said': word} if kind == 'contracted'
                                              else {'script': word, 'said': full})
            continue
        kind, n = {'delete': ('cut', i2 - i1), 'insert': ('added', j2 - j1)}.get(op, ('swapped', max(i2 - i1, j2 - j1)))
        counts[kind] += n
        if len(examples[kind]) < EXAMPLES:
            examples[kind].append({'script': _clip(a[i1:i2]), 'said': _clip(b[j1:j2])})
    changed = sum(counts.values())
    minutes = round(seconds / 60, 2) if seconds else None
    return {
        'words_script': len(a), 'words_said': len(b), 'kept': sum(m.size for m in matcher.get_matching_blocks()),
        'minutes': minutes, **counts, 'changes': changed,
        'changes_per_minute': round(changed / minutes, 1) if minutes else None,
        'changes_per_100_words': round(100 * changed / len(a), 1) if a else None,
        'examples': {k: v for k, v in examples.items() if v},
    }


def record_patch(cut, script_text, result, at=None):
    """The making-record patch for one cut: the delta, the script's hash and when."""
    if cut not in CUTS:
        raise DeltaError(f'unknown cut {cut!r} ({", ".join(CUTS)})')
    import making
    return {'spoken_delta': {cut: {**result, 'script_sha256': making.script_hash(script_text),
                                   'at': at or datetime.now(timezone.utc).isoformat(timespec='seconds')}}}


def _read(script_path, take_path):
    try:
        script_text = Path(script_path).read_text(encoding='utf-8')
        take_doc = json.loads(Path(take_path).read_text(encoding='utf-8'))
    except (OSError, ValueError) as error:
        raise DeltaError(f'cannot read the script or the take: {error}')
    return script_text, take_doc


TAKE_NAME = re.compile(r'^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (\d{1,2}) (Oct|Nov|Dec) - (90-second|3-minute|5-minute) - ')
MONTHS = {'Oct': 10, 'Nov': 11, 'Dec': 12}
MIN_KEPT = 0.5  # below this share of the script said as written, the take is another piece's


def take_plan(name, year=2026, plans=ROOT / 'docs' / 'plans'):
    """(script path, cut) for an Inbox take name, or (None, reason)."""
    m = TAKE_NAME.match(name)
    if not m:
        return None, 'not_named_by_day'
    day, month, length = int(m.group(1)), MONTHS[m.group(2)], m.group(3)
    cut = 'short' if length == '90-second' else 'long'
    path = plans / f"{year}-{month:02d}-{day:02d}-draft-script{'-90s' if cut == 'short' else ''}.md"
    return (path, cut) if path.exists() else (None, 'no_script_on_file')


def _transcribe(media, model):
    try:
        from faster_whisper import WhisperModel
    except ImportError as error:
        raise DeltaError(f'faster-whisper is not importable ({error}); run backfill with a Python that has it')
    import numpy as np
    # ffmpeg decodes to 16 kHz mono floats, so no audio library version can stand between the take and its words.
    pcm = subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-i', str(media), '-ac', '1', '-ar', '16000',
                          '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    segs, _ = WhisperModel(model, device='cpu', compute_type='int8', cpu_threads=4).transcribe(
        np.frombuffer(pcm, dtype=np.float32), word_timestamps=True, vad_filter=True, beam_size=5)
    return {'words': [{'w': w.word, 's': round(w.start, 3), 'e': round(w.end, 3)} for seg in segs for w in seg.words]}


def _listing():
    out = subprocess.run([sys.executable, str(ROOT / 'scripts' / 'post-pack' / 'recording.py'), 'list', '--json'],
                         capture_output=True, text=True, timeout=120)
    if out.returncode:
        raise DeltaError(f'recording.py list failed: {out.stderr.strip()[:200]}')
    return [{'year': int(r['uploaded_at'][:4]), 'name': r['name'], 'sha': r['sha256']}
            for r in json.loads(out.stdout) if isinstance(r, dict) and r.get('sha256') and r.get('uploaded_at')]


def backfill(only=None, model='small.en', out_dir=ROOT / '.cache' / 'spoken'):
    out_dir.mkdir(parents=True, exist_ok=True)
    report_path = out_dir / 'backfill.json'
    report = json.loads(report_path.read_text(encoding='utf-8')) if report_path.exists() else {'takes': {}}
    for row in _listing():
        name, sha = row['name'], row['sha']
        if only and name not in only:
            continue
        if sha in report['takes'] and report['takes'][sha].get('status') in ('matched', 'unmatched'):
            # Done before; a take not fetched is tried again.
            continue
        script, cut = take_plan(name, row['year'])
        entry = {'name': name, 'cut': cut if script else None}
        if not script:
            report['takes'][sha] = {**entry, 'status': 'unmatched', 'reason': cut}
        else:
            words_path = out_dir / f'{sha}.words.json'
            if not words_path.exists():
                media_dir = out_dir / 'media'
                got = subprocess.run([sys.executable, str(ROOT / 'scripts' / 'post-pack' / 'recording.py'), 'get',
                                      '--sha256', sha, '--out', str(media_dir)], capture_output=True, text=True, timeout=3600)
                files = [p for p in media_dir.glob('*') if p.is_file()] if media_dir.exists() else []
                if got.returncode or not files:
                    report['takes'][sha] = {**entry, 'status': 'not_fetched', 'reason': (got.stderr or got.stdout).strip()[:200]}
                    report_path.write_text(json.dumps(report, indent=2), encoding='utf-8')
                    continue
                media = max(files, key=lambda p: p.stat().st_mtime)
                words_path.write_text(json.dumps(_transcribe(media, model)), encoding='utf-8')
                media.unlink()
            text = script.read_text(encoding='utf-8')
            result = delta(text, json.loads(words_path.read_text(encoding='utf-8')))
            if result['words_script'] and result['kept'] / result['words_script'] < MIN_KEPT:
                report['takes'][sha] = {**entry, 'status': 'unmatched', 'reason': 'script_on_file_is_another_piece',
                                        'script': script.name, 'kept_share': round(result['kept'] / result['words_script'], 2)}
            else:
                report['takes'][sha] = {**entry, 'status': 'matched', 'script': script.name, 'delta': result}
        report_path.write_text(json.dumps(report, indent=2), encoding='utf-8')
        print(f"{report['takes'][sha]['status']:<12} {name}", flush=True)
    report['summary'] = summarise(report['takes'].values())
    report_path.write_text(json.dumps(report, indent=2), encoding='utf-8')
    return report


def summarise(takes):
    """Totals across matched takes, by cut and all together: the spoken register's numbers."""
    takes = list(takes)
    matched = [t for t in takes if t.get('status') == 'matched']
    out = {'matched': len(matched), 'unmatched': sum(t.get('status') == 'unmatched' for t in takes),
           'not_fetched': sum(t.get('status') == 'not_fetched' for t in takes)}
    for label, group in (('all', matched), ('long', [t for t in matched if t['cut'] == 'long']),
                         ('short', [t for t in matched if t['cut'] == 'short'])):
        if not group:
            continue
        tot = {k: sum(t['delta'][k] for t in group) for k in ('words_script', 'swapped', 'cut', 'added', 'contracted', 'expanded', 'changes')}
        minutes = sum(t['delta']['minutes'] or 0 for t in group)
        out[label] = {**tot, 'takes': len(group), 'minutes': round(minutes, 1),
                      'changes_per_minute': round(tot['changes'] / minutes, 1) if minutes else None,
                      'changes_per_100_words': round(100 * tot['changes'] / tot['words_script'], 1) if tot['words_script'] else None}
    return out


def describe(result):
    lines = [f"{result['changes']} changes in {result['words_script']} script words"
             + (f", {result['changes_per_minute']} a minute" if result['changes_per_minute'] is not None else '')]
    for k in ('contracted', 'expanded', 'swapped', 'cut', 'added'):
        if result[k]:
            lines.append(f'  {k}: {result[k]}')
            for ex in result['examples'].get(k, [])[:3]:
                lines.append(f"    script \"{ex['script']}\" -> said \"{ex['said']}\"")
    return '\n'.join(lines)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = ap.add_subparsers(dest='cmd', required=True)
    c = sub.add_parser('compare', help='print what moved between a script and his take')
    c.add_argument('script')
    c.add_argument('take_words')
    c.add_argument('--json', action='store_true')
    r = sub.add_parser('record', help="write the delta onto the piece's making record")
    r.add_argument('piece_id')
    r.add_argument('cut', choices=CUTS)
    r.add_argument('script')
    r.add_argument('take_words')
    b = sub.add_parser('backfill', help="every named take in the engine's recordings against its dated script")
    b.add_argument('--only', nargs='*', help='only these Inbox names')
    b.add_argument('--model', default='small.en')
    args = ap.parse_args(argv)
    if args.cmd == 'backfill':
        try:
            report = backfill(args.only, args.model)
        except DeltaError as error:
            print(f'spoken_delta: {error}', file=sys.stderr)
            return 2
        print(json.dumps(report['summary'], indent=2))
        return 0
    try:
        script_text, take_doc = _read(args.script, args.take_words)
        result = delta(script_text, take_doc)
        if args.cmd == 'compare':
            print(json.dumps(result, indent=2) if args.json else describe(result))
            return 0
        import making
        making.post(args.piece_id, record_patch(args.cut, script_text, result))
        print(describe(result))
        print(f'recorded on {args.piece_id} as spoken_delta.{args.cut}')
        return 0
    except (DeltaError, words_gate.WordsGateError) as error:
        print(f'spoken_delta: {error}', file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
