"""The joins and captions checks of one finished file, machine written and bound to its sha256, and what a receipt
without them, or with one bound to other bytes, holds.

A check either ran and wrote what it measured, or the receipt names it under `missing` with the reason, and the
gate holds. No receipt carries a check a session wrote by hand: each one names this machine and the video bytes.

    cut_checks(video, joins=[...], aligners={'faster-whisper': words}, captions=[(region, pages)], fps=30,
               drew='faster-whisper') -> {'joins': ..., 'captions_clock': ..., 'captions_render': ...}
    delivery_problems(report, target) -> [problems]
"""
from __future__ import annotations

import hashlib

from . import aligners as aligners_mod
from . import captions as captions_mod
from . import gaps, settings

CHECKS = ('joins', 'captions_clock', 'captions_render')
MACHINES = {'joins': gaps.MACHINE, 'captions_clock': captions_mod.MACHINE, 'captions_render': captions_mod.MACHINE}


def digest(path) -> str:
    with open(path, 'rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def _bound(result, sha, agreement):
    return {**result, 'video_sha256': sha, 'agreement': result.get('agreement', agreement)}


def cut_checks(video, *, joins, aligners: dict, captions, fps: float, drew: str = settings.FIRST, ocr=None,
               changes=None) -> dict:
    """The three checks on one finished file. captions: [(region, pages)], one entry per caption zone."""
    sha = digest(video)
    agreement = settings.mode(aligners)
    out = {'joins': _bound(gaps.joins_in_gaps(joins, aligners), sha, agreement)}
    heard_by, independent = aligners_mod.independent_of(drew, aligners)
    pages = sorted((p for _, ps in captions for p in ps), key=lambda p: p['fromFrame'])
    out['captions_clock'] = _bound(captions_mod.clock_truth(pages, aligners[heard_by], fps=fps, drew=drew,
                                                            heard_by=heard_by, independent=independent), sha, agreement)
    parts = [captions_mod.renderer_truth(video, ps, region, ocr=ocr, changes=changes) for region, ps in captions if ps]
    if not parts:
        render = {'machine': captions_mod.MACHINE, 'version': captions_mod.VERSION, 'part': 'renderer', 'status': 'fail',
                  'reason': 'no caption pages were given, so the burned captions cannot be read back', 'pages': [], 'failed': []}
    elif any(p['status'] == 'missing' for p in parts):
        render = next(p for p in parts if p['status'] == 'missing')
    else:
        render = {'machine': captions_mod.MACHINE, 'version': captions_mod.VERSION, 'part': 'renderer',
                  'zones': [{k: p[k] for k in ('region', 'status') if k in p} for p in parts],
                  'pages': [r for p in parts for r in p['pages']], 'failed': [r for p in parts for r in p['failed']],
                  'window_frames': parts[0]['window_frames'], 'min_score': parts[0]['min_score']}
        render['status'] = 'fail' if render['failed'] else 'pass'
        if render['failed']:
            render['reason'] = '; '.join(p['reason'] for p in parts if p.get('reason'))
    out['captions_render'] = _bound(render, sha, agreement)
    return out


def summary(check) -> str:
    if check.get('part') in ('clock', 'renderer'):
        return captions_mod.summary(check)
    return gaps.summary(check)


def held(checks: dict) -> list[str]:
    """One line a check that did not pass, for make.py's refusal."""
    return [f'{name}: {summary(check)}' for name, check in checks.items() if check.get('status') != 'pass']


def delivery_problems(report: dict, target=None) -> list[str]:
    """What the joins and captions checks in a receipt say about delivery. For a cut going to a post dated from
    config/gates.json required_from (target, else the receipt's own library_path) a missing check, one not machine
    written, one bound to other bytes or one that did not pass blocks. Before that date they are listed in the
    receipt and never block: the gates were not calibrated when those cuts were made."""
    if not settings.required_on(target or report.get('library_path')):
        return []
    problems = []
    missing = report.get('missing') or {}
    for name in CHECKS:
        check = (report.get('checks') or {}).get(name)
        if check is None:
            why = missing.get(name) if isinstance(missing, dict) else None
            problems.append(f'{name} check is missing' + (f': {why}' if why else ': make.py writes it on every finished cut'))
            continue
        if not isinstance(check, dict) or check.get('machine') != MACHINES[name] or check.get('video_sha256') != report.get('video_sha256'):
            problems.append(f'{name} check belongs to different video bytes or was not machine written')
            continue
        if check.get('status') != 'pass':
            problems.append(f'{name} is not passed: {summary(check)}')
    return problems
