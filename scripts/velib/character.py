"""Krish's cartoon character (config/ve/character.json, _corpus/keyframes-character.md): the manifest's own checks,
and the lint lines for a spec that names one (spec.character). A spec without `character` gets no line from here, so
every existing piece lints exactly as before. A spec with one is refused until Krish has approved the base, the
library is built and the character_layer device is registered (cards ve-kf-6 and ve-kf-7)."""
from __future__ import annotations

import json
from pathlib import Path

from .common import ROOT

MANIFEST = ROOT / 'config' / 've' / 'character.json'
POSES = ROOT / 'config' / 've' / 'character-poses.json'
DEVICES = ROOT / 'config' / 've' / 'devices.json'
DEVICE = 'character_layer'
STATUSES = ('awaiting_photo', 'drawing_base', 'awaiting_approval', 'drawing_library', 'ready')


def _load(path: Path) -> dict:
    return json.loads(path.read_text(encoding='utf-8'))


def manifest_problems(manifest: dict | None = None, poses: dict | None = None) -> list[str]:
    """What is wrong with the manifest itself: an approval without his words, a library claimed before approval, a
    pose the library lists that the pose file does not know, a home outside the brand kit."""
    m = _load(MANIFEST) if manifest is None else manifest
    book = _load(POSES) if poses is None else poses
    out = []
    if m.get('schema') != 've-character/1':
        out.append('character.manifest schema is not ve-character/1')
    if m.get('status') not in STATUSES:
        out.append(f'character.manifest status {m.get("status")!r} is not one of {", ".join(STATUSES)}')
    approval = m.get('approval')
    if m.get('approved') is True:
        if not (isinstance(approval, dict) and approval.get('by') == 'Krish' and len(str(approval.get('said') or '')) >= 2
                and approval.get('on')):
            out.append('character.manifest approved is true without approval {by: "Krish", said: his exact words, on: date}')
    elif approval:
        out.append('character.manifest has an approval but approved is not true')
    library = m.get('library') or {}
    if (library.get('built') or library.get('poses')) and m.get('approved') is not True:
        out.append('character.manifest lists a library before Krish approved the base; nothing is drawn before his yes')
    known = {p['id'] for p in book.get('poses') or []}
    for pose in library.get('poses') or []:
        if pose not in known:
            out.append(f'character.manifest library pose {pose!r} is not in config/ve/character-poses.json')
    folder = str((m.get('home') or {}).get('folder') or '')
    if not folder.startswith('1 Brand kit (permanent)/character/'):
        out.append('character.manifest home.folder is outside "1 Brand kit (permanent)/character/"')
    ids = [p['id'] for p in book.get('poses') or []]
    if len(set(ids)) != len(ids) or sorted(book.get('order') or []) != sorted(ids):
        out.append('character.poses the draw order and the pose list differ, or a pose id repeats')
    return out


def _registered() -> bool:
    return DEVICE in (_load(DEVICES).get('devices') or {})


def spec_lints(spec: dict, manifest: dict | None = None, registered: bool | None = None) -> list[str]:
    """ve lint lines for spec.character. None when the spec names no character."""
    ch = spec.get('character')
    if not ch:
        return []
    m = _load(MANIFEST) if manifest is None else manifest
    out = []
    if ch.get('id') != m.get('id'):
        out.append(f'character.unknown character.id: {ch.get("id")!r} is not the character in config/ve/character.json')
        return out
    if m.get('approved') is not True:
        out.append('character.not_approved character: Krish has not approved the base drawing (config/ve/character.json '
                   'approved); no character goes in a cut before his yes')
    library = m.get('library') or {}
    if not library.get('built'):
        out.append('character.no_library character: the pose library is not built (card ve-kf-6-character-library)')
    if not (_registered() if registered is None else registered):
        out.append(f'character.device_missing character: the {DEVICE} device is not registered in config/ve/devices.json '
                   '(card ve-kf-7-character-layer)')
    built = set(library.get('poses') or [])
    cuts = spec.get('cuts') or {}
    for name in ch.get('cuts') or []:
        if name not in cuts:
            out.append(f'character.cut character.cuts: {name} is not a cut in this spec')
    for index, cue in enumerate(ch.get('cues') or []):
        at = f'character.cues.{index}'
        if library.get('built') and cue.get('pose') not in built:
            out.append(f'character.pose {at}.pose: {cue.get("pose")!r} is not in the built library')
        for name in ch.get('cuts') or []:
            beats = (cuts.get(name) or {}).get('beats') or []
            if beats and cue.get('at_w', -1) <= beats[0]['span']['to_w']:
                out.append(f'character.in_hook {at}.at_w: word {cue.get("at_w")} is in cut {name}\'s hook beat '
                           f'{beats[0]["id"]}; the character rises on the first word after the hook')
    words = [c.get('at_w') for c in ch.get('cues') or []]
    if words != sorted(words) or len(set(words)) != len(words):
        out.append('character.order character.cues: cues run in script order, one per word')
    return out
