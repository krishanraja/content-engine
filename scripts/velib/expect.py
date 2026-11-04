"""What this cut will and won't do, in at most six plain lines, shown beside the storyboard press (`ve expect`).

Krish, 2026-11-04: "... set the right expectations ... in order for you and Codex to never need more than one
production round". Each line is a fact the engine already knows about this spec (docs/ve/STATUS.md, "Cannot do yet"),
and appears only when it applies to it.
"""
from __future__ import annotations

import re
from pathlib import Path

from .common import CONFIG, load_json

MAX_LINES = 6
VIDEO = re.compile(r'\.(mp4|mov|webm|m4v)$', re.I)


def _strings(node):
    if isinstance(node, dict):
        for value in node.values():
            yield from _strings(value)
    elif isinstance(node, list):
        for value in node:
            yield from _strings(value)
    elif isinstance(node, str):
        yield node


def _sfx_missing(spec: dict, directory: Path | None) -> bool:
    for cut in spec['cuts']:
        report = Path(directory) / f'compile.{cut}.json' if directory else None
        if report is not None and report.is_file():
            try:
                if load_json(report).get('sfx_missing'):
                    return True
            except (OSError, ValueError):
                pass
    wanted = any(event.get('sfx') for c in spec['cuts'].values() for b in c['beats'] for event in b.get('events') or [])
    kit = CONFIG / 'sfx-kits' / f"{(spec.get('audio') or {}).get('sfx_kit', '')}.json"
    return wanted and not kit.is_file()


def _wide_unlocked(spec: dict) -> bool:
    if not any(c['aspect'] == '16:9' for c in spec['cuts'].values()):
        return False
    from . import designlock
    lock = designlock.for_aspect(designlock.load(), '16:9')
    return spec['format'] not in lock.get('formats', {}) or not designlock.frozen(lock, spec['format'])[0]


def _outside_clip(spec: dict) -> bool:
    used = {name for c in spec['cuts'].values() for b in c['beats'] for name in b.get('uses') or []}
    params = [o.get('params') or {} for o in spec.get('objects') or [] if o['obj'] in used]
    if any(VIDEO.search(s) for p in params for s in _strings(p)):
        return True
    return any(a.get('kind') == 'broll' or (a.get('kind') == 'recording' and VIDEO.search(a.get('path', '')))
               for a in spec.get('assets') or [] if a.get('id') not in {c.get('take') for c in spec['cuts'].values()})


def lines(spec: dict, directory: Path | None = None) -> list[str]:
    from . import qc_channel
    out = []
    from .lint import novelty_note
    repeat = novelty_note(spec)
    if repeat:
        out.append(repeat)
    if _sfx_missing(spec, directory):
        out.append('No sound effects: the sfx kit is not built, so every marked hit is silent and ve status holds the cut.')
    if any(c['aspect'] == '9:16' for c in spec['cuts'].values()) and qc_channel.ADVISORY:
        out.append("Channel buttons: the tall cut is checked against each channel's buttons, but only listed, not held; "
                   'look at the bottom and right edge yourself.')
    if _wide_unlocked(spec):
        out.append('The wide cut has no locked key frames yet: its design is judged by the Critic and by you, not measured.')
    if _outside_clip(spec):
        out.append('Outside clips play muted: only your voice and the music bed are heard.')
    from . import designlock
    if spec['format'] not in designlock.load().get('formats', {}):
        out.append(f"{spec['format']} has no frozen design lock yet: composition is checked at packet time only, and the "
                   'Critic and your proof press are the design gate.')
    motion = (spec.get('style') or {}).get('motion')
    if isinstance(motion, dict) and len(out) < MAX_LINES:
        import sys
        from .common import ROOT
        sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
        import creative_direction  # noqa: PLC0415
        module = creative_direction.motion_modules().get(motion.get('module')) or {}
        if module and 'needs_device' in (module.get('ve_route') or []):
            out.append(f"The {module.get('name', motion['module'])} style has no ve device yet: the nearest house devices "
                       'draw it until Codex builds one.')
    return out[:MAX_LINES]


def write(spec: dict, directory: Path) -> Path:
    path = Path(directory) / 'expect.md'
    found = lines(spec, directory)
    body = '\n'.join(f'- {line}' for line in found) if found else '- Nothing this cut cannot do is known to apply.'
    path.write_text(f'# What this cut will and will not do\n\n{body}\n', encoding='utf-8')
    return path
