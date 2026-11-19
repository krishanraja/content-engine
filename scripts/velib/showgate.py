"""The show gate: nothing reaches Krish before anyone has watched it (config/ve/show-gate.json).

Krish, 2026-11-19, of two pieces that each reached him with a dozen faults he caught himself: the root failure is that he
was the quality check. A proof or a render is shown to him only with a receipt, `show-receipt.<cut>.json` in the piece's
ve folder, bound to that exact file's sha256 and holding four things:

  qc         `ve qc` measured every check on this file and they pass (qc.<cut>.json, bound to the same sha256).
  critic     the separate Critic's verdict on this file (verdict.<cut>.json): bound to the sha256, every beat viewed,
             no blocking finding.
  checklist  every row of config/ve/pre-show-checklist.json answered for this file: satisfied by the qc rows it names
             when they ran and passed, otherwise attested by the reviewer in one line, citing a frame or a time.
  watched    a recorded full-size watch and a listen against the script: who (never ve), when, how many frames at what
             times, how much of the audio was heard, and that the script was open beside it.

`evaluate` builds the receipt and lists what is missing; `ve show-check` prints it and writes the file; the board's
Approve proof press asks for the receipt's presence by hash (apps/control-plane/api/board/_showGate.ts). The rules are
rows in the config files: a new rule is a row, never code, and it applies to any piece.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from . import guards, verdict
from .common import CONFIG, load_json, sha256_file, write_json

SCHEMA = 've-show-receipt/1'
WATCH_SCHEMA = 've-show-watch/1'
CHECKLIST = 'pre-show-checklist.json'


def config() -> dict:
    return load_json(CONFIG / 'show-gate.json')


def checklist() -> dict:
    return load_json(CONFIG / CHECKLIST)


def receipt_path(directory: Path, label: str) -> Path:
    return Path(directory) / f'show-receipt.{label}.json'


def watch_path(directory: Path, label: str) -> Path:
    return Path(directory) / f'show-watch.{label}.json'


def enforced(spec: dict) -> bool:
    """A piece published from enforce_from is held to the gate; an earlier one is never changed mid-piece (F33)."""
    return str(spec.get('publish_day') or '') >= config()['enforce_from']


def shown(directory: Path, spec: dict | None = None) -> bool:
    """Has any cut of this piece already been shown to Krish: a show receipt filed, or an approved proof or cut."""
    directory = Path(directory)
    if any(directory.glob('show-receipt.*.json')):
        return True
    return any(isinstance(a, dict) and a.get('by') == 'Krish' and a.get('gate') in ('proof', 'final')
               for a in (spec or {}).get('approvals') or [])


def binds(spec: dict, rule_from: str | None, directory: Path | None = None) -> bool:
    """Does a rule with this binds_from hold this piece? By its publish day as always; and, when config bind_unshown is on, any
    piece not yet shown to Krish too, so a cut meets every rule that exists on the day it is shown."""
    if rule_from is None or str(spec.get('publish_day') or '') >= rule_from:
        return True
    return bool(config()['bind_unshown']['enabled'] and directory is not None and not shown(directory, spec))


def effective_day(spec: dict, directory: Path | None) -> str | None:
    """The day the rules bind as of: today, when bind_unshown is on and this piece has not yet been shown to Krish; else None
    (the piece's own publish_day, as before). A piece already shown or approved is never changed mid-piece (F33)."""
    return datetime.now(timezone.utc).date().isoformat() if binds(spec, '9999-12-31', directory) else None


# ------------------------------------------------------------------------------------------ evaluation

def qc_file(directory: Path, label: str, clip: Path | None) -> Path:
    """ve qc's report for the file: beside a proof clip (`<clip>.qc.json`, as `ve proof` writes it), else qc.<label>.json."""
    beside = Path(clip).with_suffix('.qc.json') if clip else None
    return beside if beside is not None and beside.is_file() else Path(directory) / f'qc.{label}.json'


def _critic(spec: dict, cut: str, label: str, directory: Path, digest: str) -> list[str]:
    """The separate Critic's verdict on this exact file. A whole cut uses the verdict gate as it stands (every beat viewed);
    a proof excerpt (label != cut) needs a valid, unblocked verdict bound to the clip's sha256 from a reviewer who is not ve."""
    if label == cut:
        return verdict.reasons(spec, cut, directory, digest)
    path = Path(directory) / f'verdict.{label}.json'
    if not path.is_file():
        return [f'no Critic verdict for this file ({path.name}): a reviewer who did not make it records one']
    value = verdict.read(path)
    out = []
    if value.get('sha256') != digest:
        out.append('the Critic verdict is for a different file')
    errors = verdict.validate(value)
    if errors:
        out.append('invalid Critic verdict: ' + '; '.join(errors))
    elif value['blocking']:
        out.append('Critic blocks: ' + next(f['text'] for f in value['findings'] if f['severity'] == 'block'))
    return out


QC_WAIVERS = 'qc-waivers.json'


def waived_rows(directory: Path, digest: str) -> set[str]:
    """qc rows Krish waived for this exact file, in his own words (qc-waivers.json beside the spec). A waived row neither
    fails nor leaves qc incomplete, and the checklist rows that name it need the reviewer's attestation instead (Ruling,
    Krish, 2026-11-19, of the Fri 20 short: the text reader cannot read a lone 'OUT' in the art-directed type or the
    stylised wordmark, both plainly legible on the frame)."""
    value = verdict.read(Path(directory) / QC_WAIVERS)
    out: set[str] = set()
    for w in (value.get('waivers') or []):
        if isinstance(w, dict) and w.get('by') == 'Krish' and w.get('sha256') == digest and str(w.get('said') or '').strip():
            out.update(r for r in (w.get('rows') or []) if isinstance(r, str))
    return out


def _qc(spec: dict, label: str, directory: Path, digest: str, clip: Path | None = None) -> tuple[dict, list[str]]:
    path = qc_file(directory, label, clip)
    report = verdict.read(path)
    if not report:
        return {}, [f've qc has not run on this file (no {path.name}): run `ve qc`']
    waived = waived_rows(directory, digest)
    report = {**report, '_waived': sorted(waived)}
    checks = report.get('checks') or {}
    out = []
    if report.get('sha256') != digest:
        out.append('qc is for a different file than this cut: run `ve qc` on it')
    # What qc itself counts: advisory and not-applicable rows never fail a file.
    failing = [n for n, c in checks.items() if n not in waived and c.get('pass') is False
               and c.get('status') not in ('not_run', 'advisory', 'not applicable')]
    if failing or (not report.get('measured_pass') and not waived):
        out.append('ve qc FAILS on this file' + (f': {", ".join(failing[:6])}' if failing else ''))
    open_rows = [n for n, c in checks.items() if n not in waived and c.get('status') in ('not_run', 'incomplete')]
    if config()['qc']['require_complete'] and not report.get('complete') and (open_rows or not waived):
        out.append('ve qc is incomplete (some checks did not run)')
    return report, out


def _row_state(report: dict, name: str) -> str:
    if name in (report.get('_waived') or []):
        return 'absent'   # waived by Krish for this file: the reviewer attests the row instead
    row = (report.get('checks') or {}).get(name)
    if not isinstance(row, dict) or row.get('status') == 'not_run':
        return 'absent'
    return 'pass' if row.get('pass') else 'fail'


def _attest(directory: Path, label: str, digest: str) -> dict:
    value = verdict.read(watch_path(directory, label))
    return value if value.get('cut_sha256') == digest else {}


def checklist_state(report: dict, attest: dict) -> tuple[dict, list[str]]:
    """Each checklist row: satisfied by the qc rows it names when every one ran and passed; a row whose named rows are
    absent (or that names none) needs the reviewer's one-line attestation; a named row that FAILED is a failure whatever
    the reviewer says."""
    out, missing = {}, []
    said = attest.get('checklist') or {}
    for item in checklist()['items']:
        rows = item.get('auto_rows') or []
        states = [_row_state(report, r) for r in rows]
        if 'fail' in states:
            out[item['id']] = {'status': 'failed', 'rows': rows}
            missing.append(f"{item['id']}: ve qc fails {', '.join(r for r, s in zip(rows, states) if s == 'fail')}")
        elif rows and all(s == 'pass' for s in states):
            out[item['id']] = {'status': 'auto', 'rows': rows}
        else:
            a = said.get(item['id'])
            if isinstance(a, dict) and a.get('pass') is True and len(str(a.get('line') or '').strip()) >= 12:
                out[item['id']] = {'status': 'attested', 'line': str(a['line']).strip()}
            else:
                out[item['id']] = {'status': 'missing'}
                missing.append(f"{item['id']}: not attested ({item['text']})")
    return out, missing


def watch_problems(watch: dict, duration_s: float, beats_ok: bool) -> list[str]:
    cfg = config()['watch']
    if not watch:
        return ['no recorded watch for this file: watch it at full size and hear it against the script, then `ve show-record`']
    out = []
    who = str(watch.get('by') or '').strip()
    if not who or who.lower() in ('ve', 'unknown'):
        out.append('the watch names no reviewer (never ve)')
    frames = watch.get('frames_viewed') or []
    if len(frames) < cfg['min_frames']:
        out.append(f"the watch viewed {len(frames)} frames; at least {cfg['min_frames']} at full size are needed")
    heard = float(watch.get('audio_heard_s') or 0)
    if duration_s and heard < duration_s * cfg['min_listen_fraction']:
        out.append(f'the audio was heard for {heard:.0f} s of {duration_s:.0f} s; it must be heard through against the script')
    if watch.get('script_compared') is not True:
        out.append('the script was not compared with what was heard')
    if not beats_ok:
        out.append('the Critic did not view every beat of this file')
    return out


def evaluate(spec: dict, cut: str, directory: Path, clip: Path | None = None, label: str | None = None) -> dict:
    """The receipt for this file as it stands, `ok` only when nothing is missing. `label` names a proof excerpt of the cut
    (default: the whole cut, label == cut); every file the gate reads or writes is keyed by it."""
    directory = Path(directory)
    label = label or cut
    video = Path(clip) if clip else verdict.video_path(verdict.read(directory / f'qc.{label}.json'), directory)
    missing: list[str] = []
    if not video.is_file():
        return {'schema': SCHEMA, 'piece': spec.get('piece_id'), 'cut': cut, 'label': label, 'ok': False, 'cut_sha256': None,
                'missing': [f'no rendered file for {label}: {video}']}
    digest = sha256_file(video)
    report, problems = _qc(spec, label, directory, digest, clip)
    missing += problems
    crit = _critic(spec, cut, label, directory, digest)
    missing += crit
    beats_ok = not any('did not view every beat' in c for c in crit)
    attest = _attest(directory, label, digest)
    items, gaps = checklist_state(report, attest)
    missing += gaps
    missing += watch_problems(attest.get('watch') or {}, float(report.get('duration_s') or 0), beats_ok)
    eng = directory / 'engine.json'
    qcp = qc_file(directory, label, clip)
    value = {'schema': SCHEMA, 'piece': spec.get('piece_id'), 'cut': cut, 'label': label, 'cut_sha256': digest,
             'engine_sha256': guards.engine_sha(), 'evaluated_at': datetime.now(timezone.utc).isoformat(),
             'qc': {'sha256': sha256_file(qcp) if qcp.is_file() else None,
                    'measured_pass': bool(report.get('measured_pass')), 'complete': bool(report.get('complete'))},
             'critic': {'ok': not crit},
             'checklist': items, 'watched': attest.get('watch') or None,
             'engine_pinned': eng.is_file(), 'missing': missing, 'ok': not missing}
    return value


def write(spec: dict, cut: str, directory: Path, clip: Path | None = None, label: str | None = None) -> dict:
    value = evaluate(spec, cut, directory, clip, label)
    write_json(receipt_path(directory, label or cut), value)
    return value


def record(spec: dict, cut: str, directory: Path, by: str, frames: list[float], audio_heard_s: float,
           script_compared: bool, attestations: dict, clip: Path | None = None, label: str | None = None) -> Path:
    """The reviewer's watch and checklist answers for this file, bound to its sha256 (`ve show-record`)."""
    directory = Path(directory)
    label = label or cut
    video = Path(clip) if clip else verdict.video_path(verdict.read(directory / f'qc.{label}.json'), directory)
    if not video.is_file():
        raise ValueError(f'no rendered file for {label}')
    if not by.strip() or by.strip().lower() == 've':
        raise ValueError('--by names the reviewer, never ve')
    known = {i['id'] for i in checklist()['items']}
    unknown = sorted(set(attestations) - known)
    if unknown:
        raise ValueError(f'unknown checklist rows: {", ".join(unknown)}')
    value = {'schema': WATCH_SCHEMA, 'piece': spec.get('piece_id'), 'cut': cut, 'label': label, 'cut_sha256': sha256_file(video),
             'watch': {'by': by.strip(), 'at': datetime.now(timezone.utc).isoformat(), 'frames_viewed': sorted(frames),
                       'audio_heard_s': audio_heard_s, 'script_compared': bool(script_compared)},
             'checklist': attestations}
    return write_json(watch_path(directory, label), value)


def state(spec: dict, cut: str, directory: Path, clip: Path | None = None, label: str | None = None) -> tuple[bool, list[str]]:
    """(ok, missing): used by every step that presents a file to Krish."""
    if not enforced(spec):
        return True, []
    value = evaluate(spec, cut, directory, clip, label)
    return bool(value['ok']), list(value['missing'])


# ------------------------------------------------------------------------------------------ defects

def defects_path(directory: Path) -> Path:
    return Path(directory) / config()['defects']['file']


def defect_add(directory: Path, words: str, where: str, checklist_id: str | None = None) -> dict:
    """One fault Krish found himself, in his words with where he said it. Appended, never removed."""
    path = defects_path(directory)
    value = load_json(path) if path.is_file() else {'schema': 've-defects/1', 'items': []}
    if not words.strip():
        raise ValueError('a defect is his exact words')
    value['items'].append({'at': datetime.now(timezone.utc).isoformat(), 'words': words.strip()[:2000], 'where': where,
                           'checklist_id': checklist_id})
    write_json(path, value)
    return value


def defect_count(directory: Path) -> int:
    path = defects_path(directory)
    return len(load_json(path).get('items') or []) if path.is_file() else 0
