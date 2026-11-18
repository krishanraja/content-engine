"""Treatments: the effects ve applies by rule, never by choice (docs/ve/TREATMENTS.md, config/ve/treatments.json).

Krish, 2026-11-18: "I don't want 300 different choices in the UI so figure out how." A treatment is a fixed recipe of
effect primitives (names and parameters from EffectCraft, docs/ve/sources/effectcraft.md) tied to what a beat or a
still is for. This module decides which treatments a cut's beats or a still get and how strong they are. Nobody picks
them: the strength follows style.energy, which his Pick a style press already settles. A spec turns them off for a
whole piece with style.treatments: "off" (the one field, for Claude, never a press).

Read-only planning. Nothing here draws: the primitives are built from Codex cards (ve-treat-1 to 3), and until a
treatment's primitives are all built `plan_cut` marks it `drawable: false`, so the renderer and compile stay exactly as
they were (houseGolden.test.ts).

  python3 scripts/velib/treatments.py plan <spec.json> --cut <cut>
  python3 scripts/velib/treatments.py still <kind> [--face] [--photo] [--number] [--receipt] [--energy E]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BANK_PATH = ROOT / 'config' / 've' / 'treatments.json'
ROLES = ('hook', 'anchor', 'bridge', 'pivot', 'payoff', 'call')
STILL_KINDS = ('cover', 'carousel', 'notes_image', 'meme')
# Which still treatment needs which content; a still without it never gets it.
STILL_NEEDS = {'subject-lift': 'face', 'still-duotone': 'photo', 'still-glow': 'number', 'still-sweep': 'receipt'}


def load_bank(path: Path = BANK_PATH) -> dict:
    return json.loads(Path(path).read_text(encoding='utf-8'))


def check_bank(bank: dict) -> list[str]:
    """Every fault in the bank, empty when it holds. The bank is the only home of treatments, so it is checked whole."""
    faults: list[str] = []
    prims, treats, rules = bank.get('primitives', {}), bank.get('treatments', {}), bank.get('rules', {})
    limits = bank.get('limits', {})
    for tid, t in treats.items():
        if not t.get('recipe'):
            faults.append(f'treatment {tid} has no recipe')
        for step in t.get('recipe', []):
            if step.get('primitive') not in prims:
                faults.append(f"treatment {tid} uses unknown primitive {step.get('primitive')}")
    for pid, p in prims.items():
        if not str(p.get('effectcraft', '')).startswith('ec.'):
            faults.append(f'primitive {pid} names no EffectCraft effect id')
        if not p.get('card'):
            faults.append(f'primitive {pid} names no card that builds it')
    video = rules.get('video', {})
    if set(video.get('by_role', {})) != set(ROLES):
        faults.append(f"rules.video.by_role must cover exactly {', '.join(ROLES)}")
    named = [t for ts in video.get('by_role', {}).values() for t in ts]
    named += video.get('when_face_full', []) + [t for ts in video.get('by_device_kind', {}).values() for t in ts]
    named += [t for ts in rules.get('stills', {}).values() for t in ts]
    faults += [f'rule names unknown treatment {t}' for t in sorted(set(named)) if t not in treats]
    if set(video.get('by_device_kind', {})) != set(rules.get('device_kinds', {})):
        faults.append('rules.video.by_device_kind and rules.device_kinds name different kinds')
    if set(rules.get('stills', {})) != set(STILL_KINDS):
        faults.append(f"rules.stills must cover exactly {', '.join(STILL_KINDS)}")
    strengths = bank.get('strength_by_energy', {})
    if set(strengths) != {'calm', 'medium', 'high'}:
        faults.append('strength_by_energy must name calm, medium and high')
    cap = limits.get('max_strength', 0)
    faults += [f'strength {e} {s} is over max_strength {cap}' for e, s in strengths.items() if not 0 < s <= cap]
    for p in limits.get('never_on_face', []):
        if p not in {x.get('effectcraft') for x in prims.values()}:
            faults.append(f'limits.never_on_face names {p}, which no primitive uses')
    return faults


def _strength(bank: dict, energy: str | None) -> float:
    table = bank['strength_by_energy']
    if energy is None:
        energy = 'medium'
    if energy not in table:
        raise ValueError(f"style.energy {energy} is not one of {', '.join(table)}")
    return table[energy]


def drawable(bank: dict, treatment: str) -> bool:
    return all(bank['primitives'][s['primitive']].get('built') for s in bank['treatments'][treatment]['recipe'])


def _entry(bank: dict, treatment: str, strength: float) -> dict:
    return {'treatment': treatment, 'strength': strength, 'drawable': drawable(bank, treatment)}


def device_kinds(bank: dict, devices: list[str]) -> list[str]:
    kinds = bank['rules']['device_kinds']
    return [k for k, ids in kinds.items() if any(d in ids for d in devices)]


def plan_beat(bank: dict, role: str, *, face: str | None, devices: list[str], energy: str | None) -> list[dict]:
    if role not in ROLES:
        raise ValueError(f"beat role {role} is not one of {', '.join(ROLES)}")
    video = bank['rules']['video']
    chosen: list[str] = []
    if face == 'full':
        chosen += video['when_face_full']
    for kind in device_kinds(bank, devices):
        chosen += video['by_device_kind'][kind]
    chosen += video['by_role'][role]
    unique = list(dict.fromkeys(chosen))[: bank['limits']['max_treatments_per_beat']]
    s = _strength(bank, energy)
    return [_entry(bank, t, s) for t in unique]


def plan_cut(spec: dict, cut: str, bank: dict | None = None) -> dict:
    """The treatment plan for one cut: per beat id, the treatments by rule. style.treatments 'off' means none."""
    bank = bank or load_bank()
    style = spec.get('style') or {}
    if style.get('treatments') == 'off':
        return {'cut': cut, 'off': True, 'beats': {}}
    if style.get('treatments') not in (None, 'auto'):
        raise ValueError('style.treatments is "auto" (the default) or "off"; treatments are never chosen one by one')
    devices = {o.get('obj'): o.get('device') for o in spec.get('objects') or []}
    beats = (spec.get('cuts') or {}).get(cut, {}).get('beats') or []
    out = {}
    for b in beats:
        used = [devices.get(u) for u in b.get('uses') or [] if devices.get(u)]
        out[b['id']] = plan_beat(bank, b.get('role', 'bridge'), face=b.get('face'), devices=used,
                                 energy=style.get('energy'))
    return {'cut': cut, 'off': False, 'beats': out}


def plan_still(kind: str, *, face: bool = False, photo: bool = False, number: bool = False, receipt: bool = False,
               energy: str | None = None, bank: dict | None = None) -> list[dict]:
    bank = bank or load_bank()
    if kind not in STILL_KINDS:
        raise ValueError(f"still kind {kind} is not one of {', '.join(STILL_KINDS)}")
    has = {'face': face, 'photo': photo, 'number': number, 'receipt': receipt}
    chosen = [t for t in bank['rules']['stills'][kind] if has.get(STILL_NEEDS.get(t, ''), True)]
    s = _strength(bank, energy)
    return [_entry(bank, t, s) for t in chosen]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('plan')
    p.add_argument('spec')
    p.add_argument('--cut', required=True)
    s = sub.add_parser('still')
    s.add_argument('kind', choices=STILL_KINDS)
    for flag in ('face', 'photo', 'number', 'receipt'):
        s.add_argument(f'--{flag}', action='store_true')
    s.add_argument('--energy')
    sub.add_parser('check')
    a = ap.parse_args(argv)
    bank = load_bank()
    faults = check_bank(bank)
    if faults or a.cmd == 'check':
        print('\n'.join(faults) or 'treatments bank holds')
        return 1 if faults else 0
    if a.cmd == 'plan':
        spec = json.loads(Path(a.spec).read_text(encoding='utf-8'))
        print(json.dumps(plan_cut(spec, a.cut, bank), indent=2))
    else:
        print(json.dumps(plan_still(a.kind, face=a.face, photo=a.photo, number=a.number, receipt=a.receipt,
                                    energy=a.energy, bank=bank), indent=2))
    return 0


if __name__ == '__main__':
    sys.exit(main())
