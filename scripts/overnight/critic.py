#!/usr/bin/env python3
"""The overnight Critic: it judges a cut's visuals only, and only names each failure and where it is.

Plan Wave 2, W2.6: "The Critic. Separate from the repairer. It judges visuals only; sound goes to the measured gates.
It is calibrated first: it must block F19 and Friday's four cuts, and pass Monday 26. It only names a failure and where
it is. A repairer changes the spec or regenerates plates, then a fresh Critic judges again. A failure that needs a
different take is held, not repaired."

A verdict (schema overnight-critic/1) is the Critic's whole answer:

  {"schema": "overnight-critic/1", "critic_id": "...", "round": 1, "day": "mon", "cut": "long",
   "file_sha256": "<the exact file judged>", "scale": 0.5, "viewed": [0.0, 4.2, ...],
   "findings": [{"failure": "the chart fills a corner and the lower half is empty", "area": "composition",
                 "at_s": 42.0, "needs": "spec"}],
   "blocking": true}

`needs` says what kind of failure it is, never how to fix it: spec (the spec or the layout is wrong), plates (a
generated picture is wrong) or take (only a different take mends it, so the cut is held). A verdict that carries a fix,
a suggestion, a change or anything about sound is refused, so the Critic cannot become the repairer. Every round is
judged by a fresh Critic: a critic_id seen in an earlier round of the same cut, or the repairer's own, is refused.

Calibration (config/critic-calibration.json): the cases the Critic must block and pass before its verdicts count.

    python3 scripts/overnight/critic.py check VERDICT.json
    python3 scripts/overnight/critic.py manifest                  the real media to judge on his computers, and how
    python3 scripts/overnight/critic.py calibrate --verdicts DIR [--media-root DIR] [--record PATH]

calibrate reads verdict.<case>.json for every case in DIR, refuses any verdict for a file other than the case's own
(sha256), and passes only when every block case is blocked and every pass case passes. With --record it writes the
calibration record the overnight run reads before it lets a Critic's verdict hold or pass a cut.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CALIBRATION = ROOT / 'config' / 'critic-calibration.json'
SCHEMA = 'overnight-critic/1'
AREAS = ('composition', 'brand', 'motion', 'evidence', 'copy', 'captions', 'other')
NEEDS = ('spec', 'plates', 'take')
VERDICT_KEYS = {'schema', 'critic_id', 'round', 'day', 'cut', 'file_sha256', 'scale', 'viewed', 'findings', 'blocking'}
FINDING_KEYS = {'failure', 'area', 'at_s', 'needs'}
# A Critic that says how to fix it, or judges sound, is doing someone else's job.
NOT_THE_CRITICS = re.compile(r'\b(fix|fixes|suggest\w*|should|change it|replace it|instead|sound|audio|music|loudness|voice|mix)\b', re.I)


def _number(value) -> bool:
    return type(value) in (int, float) and math.isfinite(value) and value >= 0


def validate(verdict) -> list[str]:
    """Why a verdict is not a Critic's verdict, [] when it is."""
    if not isinstance(verdict, dict):
        return ['a verdict must be an object']
    out = []
    extra = set(verdict) - VERDICT_KEYS
    if extra:
        out.append(f'a Critic only names failures and where: no {", ".join(sorted(extra))}')
    missing = VERDICT_KEYS - set(verdict)
    if missing:
        return out + [f'missing {", ".join(sorted(missing))}']
    if verdict['schema'] != SCHEMA:
        out.append(f'schema must be {SCHEMA}')
    if not isinstance(verdict['critic_id'], str) or not verdict['critic_id'].strip():
        out.append('critic_id must name this Critic')
    if type(verdict['round']) is not int or verdict['round'] < 1:
        out.append('round must be 1 or more')
    if verdict['day'] not in ('mon', 'wed', 'fri', 'calibration') or verdict['cut'] not in ('long', 'short', 'still'):
        out.append('day and cut must name the cut judged')
    if not isinstance(verdict['file_sha256'], str) or not re.fullmatch('[0-9a-f]{64}', verdict['file_sha256']):
        out.append('file_sha256 must be the sha256 of the file judged')
    if not _number(verdict['scale']) or not 0 < verdict['scale'] <= 1:
        out.append('scale must be in 0..1')
    viewed = verdict['viewed']
    if not isinstance(viewed, list) or not viewed or not all(_number(v) for v in viewed):
        out.append('viewed must list the times looked at')
    findings = verdict['findings']
    if not isinstance(findings, list):
        return out + ['findings must be a list']
    for f in findings:
        if not isinstance(f, dict) or set(f) != FINDING_KEYS:
            out.append('a finding is exactly failure, area, at_s and needs: what failed and where, never how to fix it')
            continue
        if f['area'] not in AREAS:
            out.append(f'area must be one of {", ".join(AREAS)}: sound goes to the measured gates')
        if f['needs'] not in NEEDS:
            out.append(f'needs must be one of {", ".join(NEEDS)}')
        if not _number(f['at_s']):
            out.append('at_s must say where, in seconds')
        if not isinstance(f['failure'], str) or not f['failure'].strip() or len(f['failure']) > 300:
            out.append('failure must name the failure in a line')
        elif NOT_THE_CRITICS.search(f['failure']):
            out.append(f'the Critic names what failed, never a fix or a sound: "{f["failure"][:80]}"')
    if type(verdict['blocking']) is not bool or verdict['blocking'] != bool(findings):
        out.append('blocking must be true exactly when there is a finding')
    return out


def check_fresh(verdict, earlier_critics=(), repairers=()) -> list[str]:
    """A fresh Critic each round: never one that judged this cut before, never the repairer."""
    cid = str(verdict.get('critic_id') or '')
    out = []
    if cid in set(earlier_critics):
        out.append(f'critic {cid} already judged this cut: every round has a fresh Critic')
    if cid in set(repairers):
        out.append(f'critic {cid} repaired this cut: the Critic is never the repairer')
    return out


def decide(verdict) -> str:
    """pass, repair, or hold (a failure only a different take mends)."""
    if not verdict['findings']:
        return 'pass'
    if any(f['needs'] == 'take' for f in verdict['findings']):
        return 'hold'
    return 'repair'


def first_failure(verdict) -> str:
    f = next((f for f in verdict['findings'] if f['needs'] == 'take'), None) or verdict['findings'][0]
    at = int(round(f['at_s']))
    return f'{f["area"]} at {at // 60}:{at % 60:02d}: {f["failure"]}'


# ---- calibration -------------------------------------------------------------------------------------------------

def load_manifest(path=None) -> dict:
    return json.loads(Path(path or CALIBRATION).read_text(encoding='utf-8'))


def _sha(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for block in iter(lambda: handle.read(1 << 20), b''):
            digest.update(block)
    return digest.hexdigest()


def _roots(media_root) -> list[Path]:
    if not media_root:
        return []
    return [Path(r) for r in ([media_root] if isinstance(media_root, (str, Path)) else media_root)]


def case_sha(case, media_root=None) -> str | None:
    """The sha256 a case's verdict must be about: its repository file's, its manifest's, or its file directly in a
    media root (one folder, or a list of them, as critic_run.py cases takes them)."""
    media = case['media']
    if media.get('repo_path'):
        return _sha(ROOT / media['repo_path'])
    if media.get('sha256'):
        return media['sha256']
    for root in _roots(media_root):
        if media.get('name') and (root / media['name']).is_file():
            return _sha(root / media['name'])
    return None


def manifest_problems(manifest) -> list[str]:
    out = []
    cases = manifest.get('cases') if isinstance(manifest, dict) else None
    if not isinstance(cases, list) or not cases:
        return ['the calibration manifest has no cases']
    ids = [c.get('id') for c in cases]
    if len(set(ids)) != len(ids):
        out.append('case ids must be unique')
    for group, want in (('F19', 'block'), ('fri23', 'block'), ('mon26', 'pass')):
        if not any(str(c.get('id', '')).startswith(group) and c.get('expect') == want for c in cases):
            out.append(f'the manifest must hold {group} cases the Critic must {want}')
    for c in cases:
        if c.get('expect') not in ('block', 'pass'):
            out.append(f'{c.get("id")}: expect must be block or pass')
        if not isinstance(c.get('media'), dict) or not (c['media'].get('repo_path') or c['media'].get('name') or c['media'].get('sha256')):
            out.append(f'{c.get("id")}: media must say where the file is')
    return out


def calibrate(manifest, verdicts: dict, media_root=None) -> list[str]:
    """Why the Critic is not calibrated, [] when it is. verdicts: {case id: verdict}."""
    out = manifest_problems(manifest)
    seen = []
    for case in manifest.get('cases') or []:
        cid = case['id']
        verdict = verdicts.get(cid)
        if verdict is None:
            out.append(f'{cid}: no verdict')
            continue
        errors = validate(verdict)
        if errors:
            out.append(f'{cid}: not a Critic verdict: ' + '; '.join(errors))
            continue
        want = case_sha(case, media_root)
        if want is None:
            out.append(f'{cid}: its media cannot be found to check the verdict is about it (--media-root)')
        elif verdict['file_sha256'] != want:
            out.append(f'{cid}: the verdict is about a different file')
        seen.append(verdict['critic_id'])
        got = 'block' if verdict['blocking'] else 'pass'
        if got != case['expect']:
            out.append(f'{cid}: the Critic would {got} it; it must {case["expect"]} it ({case.get("what", "")})')
    return out


def read_verdicts(folder) -> dict:
    out = {}
    for path in sorted(Path(folder).glob('verdict.*.json')):
        try:
            out[path.name[len('verdict.'):-len('.json')]] = json.loads(path.read_text(encoding='utf-8'))
        except ValueError:
            continue
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--manifest', help='the calibration manifest (default config/critic-calibration.json)')
    sub = ap.add_subparsers(dest='cmd', required=True)
    c = sub.add_parser('check'); c.add_argument('verdict')
    sub.add_parser('manifest')
    k = sub.add_parser('calibrate'); k.add_argument('--verdicts', required=True)
    k.add_argument('--media-root', action='append', default=[],
                   help='a folder on his computer that holds cuts the manifest names (repeat it, as critic_run.py cases takes it)')
    k.add_argument('--record', help='on a pass, write the calibration record here')
    args = ap.parse_args(argv)
    if args.cmd == 'check':
        problems = validate(json.loads(Path(args.verdict).read_text(encoding='utf-8')))
        print(json.dumps({'ok': not problems, 'problems': problems}))
        return 0 if not problems else 1
    manifest = load_manifest(args.manifest)
    if args.cmd == 'manifest':
        for case in manifest['cases']:
            where = case['media'].get('repo_path') or case['media'].get('drive_file_id') or case['media'].get('name')
            print(f'{case["expect"]:5}  {case["id"]}: {where}')
        print('\n' + manifest['command'])
        return 0 if not manifest_problems(manifest) else 1
    problems = calibrate(manifest, read_verdicts(args.verdicts), args.media_root)
    if not problems and args.record:
        record = {'schema': 'critic-calibrated/1', 'at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
                  'manifest_sha256': _sha(Path(args.manifest or CALIBRATION)), 'cases': len(manifest['cases'])}
        Path(args.record).parent.mkdir(parents=True, exist_ok=True)
        Path(args.record).write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'ok': not problems, 'problems': problems}))
    return 0 if not problems else 1


if __name__ == '__main__':
    sys.exit(main())
