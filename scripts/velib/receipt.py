"""ve's validation receipt: the <cut>.validation.json that quality.delivery_problems reads before a ve cut goes on its
making record or into the library (plan W2.4). Every row is made here, from these bytes, or named under `missing`
with what makes it; nothing is copied from a session's word, and nothing here is a placeholder pass.

  heard        the cut heard again here (faster-whisper, as words_gate hears it) against the same transcriber's
               hearing of the voice master the cut was mixed from, so a difference is the cut's and never two
               transcribers disagreeing (Ruling, Krish, 2026-10-31); every difference is a spelling, a mishearing he
               cleared in the cut's rulings ("heard_as"), or a removal he approved ("removals"), or the row fails
  sync, motion not_applicable only when the cut's own props hold no picture segments (quality.voiceover_problems)
  loudness     ve qc's loudness rows on these bytes
  visuals      the independent Critic's verdict on these bytes (ve verdict), not blocking
  full_review  Krish's final approval in the signed spec, bound to these bytes
  words        words_gate on the cut, with the rulings file as its EDL
  visual_clarity  the rendered-text manifest and the blind three-second review beside the cut, under his ruling

The rulings file is the piece's own record of his words ({"heard_as", "removals", "visual_clarity"}), kept in the
repository beside the props; words_gate reads it as the EDL."""
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

from .common import ROOT


def _quick_edit():
    for path in (str(ROOT / 'scripts' / 'quick-edit'), str(ROOT / 'scripts')):
        if path not in sys.path:
            sys.path.append(path)  # after velib's own modules, never ahead of them
    import quality
    import visual_clarity
    import words_gate
    return quality, visual_clarity, words_gate


def _ref(path: Path, base: Path | None = None) -> dict:
    quality, *_ = _quick_edit()
    shown = path.relative_to(base) if base else path
    return {'path': shown.as_posix(), 'sha256': quality.digest(path)}


def _repo_ref(path: Path) -> dict:
    quality, *_ = _quick_edit()
    return {'path': path.resolve().relative_to(ROOT.resolve()).as_posix(), 'sha256': quality.digest(path)}


def heard_words(cut: Path, model: str = 'small.en', kept: Path | None = None) -> dict:
    """The file heard here, kept beside the cut; a kept hearing is reused only when its provenance names these bytes."""
    quality, _, words_gate = _quick_edit()
    kept = kept or cut.with_name(cut.name + '.heard.json')
    if kept.is_file():
        doc = json.loads(kept.read_text(encoding='utf-8'))
        if doc.get('provenance') == quality.transcript_identity(cut, 1, model):
            return doc
    doc = words_gate.transcribe(cut, model)
    kept.write_text(json.dumps(doc, indent=0), encoding='utf-8')
    return doc


def heard_check(take: list, heard: list, rulings: dict) -> dict:
    """quality.word_diff of the take against the cut, each difference cleared only by a spelling, a heard_as row
    carrying Krish's words, or a removal carrying his words; any other difference fails the row."""
    quality, _, words_gate = _quick_edit()
    diff = quality.word_diff([w['w'] for w in take], heard)
    owner = [i for i, w in enumerate(take) for _ in quality.canonical_words([w['w']])]
    rows = words_gate.heard_as_rows(rulings)
    removed = {}
    for row in rulings.get('removals') or []:
        if isinstance(row, dict) and words_gate.krish_words(row.get('krish')) and len(row.get('take_index') or []) == 2:
            removed.update({i: row['krish'] for i in range(row['take_index'][0], row['take_index'][1] + 1)})
    same = lambda a, b: words_gate.canonical(' '.join(a)) == words_gate.canonical(' '.join(b))

    def cut_out(seq, part):
        # The first place `part` stands whole inside `seq`, removed; None when it is not there.
        n = len(part)
        hit = next((i for i in range(len(seq) - n + 1) if n and same(seq[i:i + n], part)), None)
        return None if hit is None else seq[:hit] + seq[hit + n:]

    cleared, left = [], []
    for change in diff['changes']:
        at = list(range(change['expected_index'], change['expected_index'] + len(change['expected'])))
        how = []
        expected = [t for t, i in zip(change['expected'], at) if owner[i] not in removed]
        if len(expected) < len(at):
            how.append({'by': 'removal', 'krish': removed[next(owner[i] for i in at if owner[i] in removed)]})
        heard_here = list(change['heard'])
        # The cut's word in this place is one he cleared as a mishearing (Klen for Qwen): the cut holds that word,
        # whatever the transcriber made of the voice master there (Gwen), so the place is cleared, named with both.
        whole = next((r for r in rows if change['kind'] == 'replace' and expected and same(heard_here, r['heard_t'])), None)
        if whole:
            cleared.append({**change, 'by': 'heard_as', 'krish': whole['krish'], 'said': whole['said']})
            continue
        for row in rows:
            e, h = cut_out(expected, row['said_t']), cut_out(heard_here, row['heard_t'])
            if e is not None and h is not None:
                expected, heard_here = e, h
                how.append({'by': 'heard_as', 'krish': row['krish']})
        if expected or heard_here:
            if expected and heard_here and same(expected, heard_here):
                how.append({'by': 'spelling'})
            else:
                left.append(change)
                continue
        cleared += [{**change, **h} for h in how]
    return {**diff, 'status': 'pass' if diff['expected_words'] and diff['heard_words'] and not left else 'fail',
            'changes': left, 'cleared': cleared}


def build(cut, *, piece_id: str, library_path: str, props, spec, take_words, voice_master, script, rulings, qc,
          verdict, clarity_dir=None, model: str = 'small.en') -> dict:
    """Write <cut>.validation.json and return it with quality.delivery_problems' answer."""
    quality, visual_clarity, words_gate = _quick_edit()
    from .qc_gates import gate_words
    cut, props, spec, rulings_path = Path(cut), Path(props), Path(spec), Path(rulings)
    base, sha = cut.parent, quality.digest(cut)
    composed = json.loads(props.read_text(encoding='utf-8'))
    rules = json.loads(rulings_path.read_text(encoding='utf-8'))
    receipt = {'schema': 've-receipt/1', 'machine': 'scripts/velib/receipt.py', 'video_sha256': sha, 'piece_id': piece_id,
               'library_path': library_path, 'checks': {}, 'missing': {},
               'footage': {'props': _repo_ref(props), 'camera_segments': len(composed.get('segments') or [])},
               'rulings': _repo_ref(rulings_path)}
    checks, missing = receipt['checks'], receipt['missing']

    # The take, in the words gate's shape, kept beside the cut so the receipt names exactly what the cut was checked on.
    source = Path(take_words)
    take = gate_words(json.loads(source.read_text(encoding='utf-8-sig')))
    take_file = cut.with_name(cut.name + '.take.words.json')
    take_file.write_text(json.dumps(take, indent=0), encoding='utf-8')
    receipt['transcript_document'] = {'sha256': quality.digest(take_file), 'source': _repo_ref(source),
                                      'derivation': 've words.json {word, onset_s, end_s} as {w, s, e} (qc_gates.gate_words)'}
    heard = heard_words(cut, model)
    narration = cut.with_name(cut.name + '.narration.txt')
    narration.write_text(' '.join(w['w'].strip() for w in heard['words']), encoding='utf-8')
    receipt['final_narration_sha256'] = quality.digest(narration)
    receipt['source_provenance'] = heard['provenance']
    master = Path(voice_master)
    voice = heard_words(master, model, kept=cut.with_name(cut.name + '.voice-master.heard.json'))
    receipt['voice_master'] = {'path': str(master), 'sha256': voice['provenance']['source_sha256'],
                               'heard': voice['provenance']}
    # The rulings' removals index the take's words, not this hearing, and the master already holds them: only his
    # heard_as rows apply here.
    checks['heard'] = heard_check(voice['words'], heard['words'], {'heard_as': rules.get('heard_as', [])})

    if receipt['footage']['camera_segments'] == 0:
        why = 'voiceover: the props hold no picture segments, so there is no camera footage'
        checks['sync'] = {'status': 'not_applicable', 'reason': why}
        checks['motion'] = {'status': 'not_applicable', 'reason': why}
    else:
        missing['sync'] = 'the lip-sync measure on these bytes'
        missing['motion'] = 'the camera-motion assessment and final framing review'

    report = json.loads(Path(qc).read_text(encoding='utf-8'))
    if report.get('sha256') != sha:
        missing['loudness'] = 've qc on these bytes'
    else:
        rows = {k: report['checks'][k] for k in ('loudness.integrated', 'loudness.true_peak', 'loudness.long_silence')}
        checks['loudness'] = {'status': 'pass' if all(r.get('pass') is True for r in rows.values()) else 'fail',
                              'measurements': rows, 'qc': _ref(Path(qc).resolve())}

    critic = json.loads(Path(verdict).read_text(encoding='utf-8'))
    if critic.get('sha256') != sha:
        missing['visuals'] = 'the independent Critic watching and hearing these bytes (ve verdict)'
    else:
        checks['visuals'] = {'status': 'fail' if critic.get('blocking') else 'pass', 'reviewer': critic.get('reviewer'),
                             'frames_viewed': len(critic.get('frames_viewed') or []), 'verdict': _ref(Path(verdict).resolve()),
                             'blocking_findings': [f['text'] for f in critic.get('findings', []) if f.get('severity') == 'block']}

    approval = next((a for a in json.loads(spec.read_text(encoding='utf-8')).get('approvals', [])
                     if a.get('gate') == 'final' and a.get('by') == 'Krish' and a.get('artifact_hash') == sha), None)
    if approval:
        checks['full_review'] = {'status': 'pass', 'by': 'Krish', 'said': approval['said'], 'on': approval['on'],
                                 'spec': _repo_ref(spec)}
    else:
        missing['full_review'] = 'Krish playing these bytes through at full size, in his own words (the spec\'s final approval)'

    script_text = Path(script).read_text(encoding='utf-8-sig')
    words = words_gate.bind(words_gate.check_aligners(script_text, take, {'faster-whisper': heard['words']}, rules),
                            script=Path(script), take=take_file, final_words=cut.with_name(cut.name + '.heard.json'),
                            edl=rulings_path, video=cut, final_provenance=heard['provenance'])
    checks['words'] = words

    if clarity_dir:
        clarity = {}
        for key, name in (('manifest', 'visual-clarity.manifest.json'), ('review', 'visual-clarity.review.json')):
            here = base / f'{cut.name}.{name}'
            if Path(clarity_dir).resolve() != base.resolve():
                shutil.copyfile(Path(clarity_dir) / name, here)
            clarity[key] = _ref(here, base)
        clarity['narration'] = _ref(narration, base)
        ruling = rules.get('visual_clarity')
        checks['visual_clarity'] = {'status': 'pass', **clarity, **({'ruling': ruling} if ruling else {})}
        problems = visual_clarity.delivery_problems(receipt, base, cut)
        if problems:
            checks['visual_clarity'].update(status='fail', problems=problems)
    else:
        missing['visual_clarity'] = 'the rendered-text manifest and blind three-second review on these bytes (visual_clarity.py)'

    out = Path(str(cut) + '.validation.json')
    out.write_text(json.dumps(receipt, indent=2), encoding='utf-8')
    return {'receipt': str(out), 'problems': quality.delivery_problems(str(cut), str(out), library_path)}
