#!/usr/bin/env python3
"""The calibration harness: every cut gate on the five calibration cuts, expected against actual.

    python3 scripts/cutgates/calibrate.py [--manifest config/gate-calibration.json] [--root DIR ...] [--out report.json]
    python3 scripts/cutgates/calibrate.py --synthetic

On Krish's computer it finds each cut's files under the roots (any --root, MINDMAKE_LIBRARY_ROOT, MINDMAKE_ARCHIVE_ROOT,
config/studio.json runtime library_root and archive_root, this repository and his home folder), hears each finished file with faster-whisper (no paid
second aligner) unless its heard words are already beside it, and runs the words, joins and
captions gates. Monday 26's two cuts must pass; Wednesday 21's published long cut, Friday 23's rejected join reel
and Friday 16's 90-second cut must fail, on a gate the manifest names. A cut whose files are not found is
"incomplete", never a pass. Exit 0 only when every cut behaves as listed.

--synthetic runs the same gates on stand-ins made here (ffmpeg tones, a mocked aligner and OCR): what CI runs.
It proves the harness and the gates' logic, not the calibration, which only the real files can.
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(1, str(HERE.parent / 'quick-edit'))
from cutgates import aligners, captions, gaps, settings, synthetic  # noqa: E402

MANIFEST = settings.ROOT / 'config' / 'gate-calibration.json'
BANDS = {'9x16': [60, 230, 960, 200], '16x9': [360, 900, 1200, 160]}  # advisory_qc.CAPTION_BANDS, the usual place


STUDIO = settings.ROOT / 'config' / 'studio.json'


def studio_roots(studio: Path = STUDIO) -> list[Path]:
    """The library and archive folders config/studio.json names for his computers (runtime), %NAME% expanded."""
    try:
        runtime = json.loads(studio.read_text(encoding='utf-8')).get('runtime') or {}
    except (OSError, ValueError):
        return []
    out = []
    for key in ('library_root', 'archive_root'):
        value = runtime.get(key)
        if isinstance(value, str) and value:
            out.append(Path(os.path.expandvars(value)))
    return out


def roots(extra=(), studio: Path = STUDIO) -> list[Path]:
    found = [Path(r) for r in extra]
    for name in json.loads(MANIFEST.read_text(encoding='utf-8')).get('roots_env', []):
        if os.environ.get(name):
            found.append(Path(os.environ[name]))
    found += studio_roots(studio) + [settings.ROOT, Path.home()]
    out = []
    for root in found:
        if root.is_dir() and root not in out:
            out.append(root)
    return out


def find(patterns, where) -> Path | None:
    for pattern in patterns or []:
        for root in where:
            hits = sorted(glob.glob(str(root / pattern), recursive=True))
            if hits:
                return Path(hits[-1])
    return None


def _words(path):
    doc = json.loads(Path(path).read_text(encoding='utf-8-sig'))
    return doc.get('words') if isinstance(doc, dict) else doc


def joins_from(spec, where) -> tuple[list | None, str]:
    """The cut's join times, and where they came from."""
    if isinstance(spec, list):
        return [float(t) for t in spec], 'listed in the manifest'
    path = find((spec or {}).get('file'), where)
    if path is None:
        return None, 'no file with the joins was found'
    doc = json.loads(path.read_text(encoding='utf-8-sig'))
    if spec.get('from') == 'reel_midpoints':
        return [round((c['reel_start'] + c['reel_end']) / 2, 3) for c in doc.get('clips', [])], f'{path} (clip midpoints)'
    rows = ((doc.get('checks') or {}).get('joins') or {}).get('joins')
    if isinstance(rows, list):
        return [r['at_s'] for r in rows], str(path)
    advisory = ((((doc.get('advisory') or {}).get('rows') or {}).get('joins') or {}).get('result') or {}).get('join_times_s')
    for value in (advisory, doc.get('joins'), doc.get('join_times_s')):
        if isinstance(value, list):
            return [float(t) for t in value], str(path)
    return None, f'{path} names no joins'


def pages_from(spec, where, fps) -> tuple[list | None, str]:
    if isinstance(spec, list):
        return spec, 'listed in the manifest'
    path = find((spec or {}).get('file'), where)
    if path is None:
        return None, 'no caption file was found'
    if path.suffix.lower() == '.ass':
        return captions.pages_from_ass(path, fps), str(path)
    if path.suffix.lower() == '.srt':
        return captions.pages_from_srt(path, fps), f'{path} (the cut\'s sidecar .srt)'

    doc = json.loads(path.read_text(encoding='utf-8-sig'))
    return (doc.get('pages') if isinstance(doc, dict) else doc), str(path)


def fps_of(video) -> float:
    import subprocess
    out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=avg_frame_rate',
                          '-of', 'default=nw=1:nk=1', str(video)], capture_output=True, text=True).stdout.strip()
    if '/' in out:
        a, b = out.split('/')
        return round(float(a) / float(b), 3) if float(b) else 30.0
    return 30.0


def run_gates(case, *, video, script, take, heard_by, joins, pages, region, fps, ocr=None) -> dict:
    """Each gate the case names: its status, or missing with what was not found."""
    import words_gate
    out = {}
    for gate in case.get('gates', []):
        try:
            if gate == 'words':
                if script is None or take is None:
                    out[gate] = {'status': 'missing', 'reason': 'the signed script or the take words were not found'}
                else:
                    r = words_gate.check_aligners(script, take, heard_by, case.get('edl'))
                    out[gate] = {'status': r['status'], 'agreement': r['agreement'], 'summary': words_gate.summary(r)}
            elif gate == 'joins':
                if joins is None:
                    out[gate] = {'status': 'missing', 'reason': 'the join times were not found'}
                else:
                    r = gaps.joins_in_gaps(joins, heard_by)
                    out[gate] = {'status': r['status'], 'agreement': r['agreement'], 'summary': gaps.summary(r)}
            elif gate == 'captions_clock':
                if not pages:
                    out[gate] = {'status': 'missing', 'reason': 'the caption pages were not found'}
                else:
                    by, independent = aligners.independent_of(settings.FIRST, heard_by)
                    r = captions.clock_truth(pages, heard_by[by], fps=fps, drew=settings.FIRST, heard_by=by, independent=independent)
                    out[gate] = {'status': r['status'], 'agreement': r['agreement'], 'summary': captions.summary(r)}
            elif gate == 'captions_render':
                if not pages:
                    out[gate] = {'status': 'missing', 'reason': 'the caption pages were not found'}
                else:
                    r = captions.renderer_truth(video, pages, region, ocr=ocr)
                    out[gate] = {'status': r['status'], 'summary': captions.summary(r) if r['status'] != 'missing' else r['reason']}
        except Exception as error:  # noqa: BLE001 one gate that cannot run is reported, never a pass
            out[gate] = {'status': 'missing', 'reason': f'{type(error).__name__}: {error}'[:400]}
    return out


def verdict(case, gates) -> dict:
    failed = [g for g, r in gates.items() if r['status'] == 'fail']
    missing = [g for g, r in gates.items() if r['status'] not in ('pass', 'fail')]
    actual = 'fail' if failed else 'incomplete' if missing else 'pass'
    if case['expect'] == 'pass':
        ok = actual == 'pass'
    else:
        want = case.get('caught_by') or list(gates)
        ok = any(g in failed for g in want)
    return {'id': case['id'], 'label': case.get('label'), 'expect': case['expect'], 'actual': actual,
            'failed_gates': failed, 'missing_gates': missing, 'caught_by_expected': case.get('caught_by'),
            'as_listed': ok, 'gates': gates}


def run_case(case, where, *, model='small.en') -> dict:
    video = find(case.get('final'), where)
    if video is None:
        return {**verdict(case, {g: {'status': 'missing', 'reason': 'the finished file was not found'} for g in case['gates']}),
                'inputs': {'final': None}}
    fps = fps_of(video)
    script_path, take_path, heard_path = find(case.get('script'), where), find(case.get('take_words'), where), find(case.get('heard'), where)
    heard = {settings.FIRST: _words(heard_path)} if heard_path else None
    try:
        heard_by = aligners.passes(video, heard=heard, model=model)['aligners']
    except Exception as error:  # noqa: BLE001 no aligner: every gate that needs one is missing
        return {**verdict(case, {g: {'status': 'missing', 'reason': f'no aligner could hear the file: {error}'[:300]} for g in case['gates']}),
                'inputs': {'final': str(video)}}
    joins, joins_src = joins_from(case.get('joins'), where) if 'joins' in case else (None, 'not named')
    pages, pages_src = pages_from(case.get('captions'), where, fps) if 'captions' in case else (None, 'not named')
    gates = run_gates(case, video=video, script=script_path.read_text(encoding='utf-8-sig') if script_path else None,
                      take=_words(take_path) if take_path else None, heard_by=heard_by, joins=joins, pages=pages,
                      region=case.get('region') or BANDS.get(case.get('shape'), BANDS['16x9']), fps=fps)
    return {**verdict(case, gates), 'inputs': {'final': str(video), 'script': str(script_path) if script_path else None,
                                               'take_words': str(take_path) if take_path else None,
                                               'heard': str(heard_path) if heard_path else 'heard here',
                                               'joins': joins_src, 'captions': pages_src, 'fps': fps,
                                               'aligners': list(heard_by), 'agreement': settings.mode(heard_by)}}


SYNTHETIC = {'mon26-long': 'intact', 'mon26-short': 'intact', 'wed21-long': 'lost_word',
             'fri23-join-reel': 'tight_joins', 'fri16-90s': 'stale_captions'}


def run_synthetic(cases) -> list[dict]:
    rows = []
    with tempfile.TemporaryDirectory() as tmp:
        for case in cases:
            kind = SYNTHETIC[case['id']]
            made = synthetic.build(Path(tmp) / case['id'], kind)
            gates = run_gates(case, video=made['video'], script=made['script'], take=made['take'],
                              heard_by={settings.FIRST: made['heard']}, joins=made['joins'], pages=made['pages'],
                              region=made['region'], fps=made['fps'], ocr=made['ocr'])
            rows.append({**verdict(case, gates), 'inputs': {'synthetic': kind, 'agreement': 'single aligner (mocked)'}})
    return rows


def main(argv=None):
    ap = argparse.ArgumentParser(description='Every cut gate on the five calibration cuts, expected against actual.')
    ap.add_argument('--manifest', default=str(MANIFEST))
    ap.add_argument('--root', action='append', default=[])
    ap.add_argument('--synthetic', action='store_true', help='stand-ins made here, a mocked aligner and OCR (CI)')
    ap.add_argument('--model', default='small.en')
    ap.add_argument('--out')
    a = ap.parse_args(argv)
    cases = json.loads(Path(a.manifest).read_text(encoding='utf-8'))['cuts']
    rows = run_synthetic(cases) if a.synthetic else [run_case(c, roots(a.root), model=a.model) for c in cases]
    report = {'mode': 'synthetic' if a.synthetic else 'real', 'all_as_listed': all(r['as_listed'] for r in rows),
              'second_aligner': settings.second_aligner(), 'cuts': rows}
    if a.out:
        Path(a.out).write_text(json.dumps(report, indent=1), encoding='utf-8')
    for r in rows:
        mark = 'as listed' if r['as_listed'] else 'NOT AS LISTED'
        print(f'{r["id"]:16} expect {r["expect"]:4}  actual {r["actual"]:10} {mark}'
              + (f'  failed: {", ".join(r["failed_gates"])}' if r['failed_gates'] else '')
              + (f'  missing: {", ".join(r["missing_gates"])}' if r['missing_gates'] else ''))
    print(f'calibration ({report["mode"]}): ' + ('every cut behaves as listed' if report['all_as_listed'] else 'NOT calibrated'))
    return 0 if report['all_as_listed'] else 1


if __name__ == '__main__':
    sys.exit(main())
