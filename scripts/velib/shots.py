"""The shot planner: every beat a shot type from its cut's one staging, drawn on the storyboard Krish signs (`ve shots`).

Ruling, Krish, 2026-11-20: "The shot grammar is approved: build it and run Monday's piece on it", and one staging per
cut, picked at the lock with the recipe. The motion-designer skill plans each beat's point, devices and events; this
writes the part that is a rule, not a choice: each beat's `shot` from the cut's staging (style.layout.cuts, then
style.layout.mode), the beat's layout made to fit it, and a shot table in the storyboard document (`storyboard.md`
beside expect.md) between two markers, so the signed storyboard shows every shot. ve lint (grammar.*) then checks the
plan; this never invents a staging, and refuses a cut that has none.

The rules (config/ve/shot-grammar.json):
- the beat that carries the title line is `title` (it builds in the panel and holds full frame at most 2 s);
- on an anchor cut a graphics-only beat (STAGE with no plate, or face off) is a `plate`; every other beat is `anchor`;
- on a band or stage cut every beat is the staging: a graphics-only beat stays in the panel, his face on screen;
- a shot already written (`chapter`, `number`, `end`) is kept: those are choices the plan makes, not rules.
"""
from __future__ import annotations

from pathlib import Path

from . import grammar

START = '<!-- shot-plan:start (ve shots writes this; edit the spec, then run it again) -->'
END = '<!-- shot-plan:end -->'
KEPT = ('chapter', 'number', 'end')


def _title_beat(spec: dict, cut_id: str) -> str | None:
    span = (((spec.get('title_moment') or {}).get('spans') or {}).get(cut_id))
    if not span:
        return None
    for beat in spec['cuts'][cut_id]['beats']:
        if beat['span']['from_w'] <= span['to_w'] <= beat['span']['to_w']:
            return beat['id']
    return None


def graphics_only(beat: dict) -> bool:
    return (beat.get('layout') == 'STAGE' and (beat.get('plate') or {}).get('source') == 'none') or beat.get('face') == 'off'


def plan_cut(spec: dict, cut_id: str, mode: str) -> list[str]:
    """Write `shot` on every beat of one cut (in place) and return what changed."""
    body = grammar.body_shot(mode)
    if body is None:
        raise ValueError(f'cut {cut_id} is drawn with {mode or "no staging"}: pick band, stage or anchor for it at the lock '
                         '(style.layout.mode, or style.layout.cuts for this cut) before planning shots')
    if mode == 'anchor' and spec['cuts'][cut_id]['aspect'] != '9:16':
        raise ValueError(f'cut {cut_id}: anchor is 9:16 only until a good wide face-as-frame cut is measured')
    title = _title_beat(spec, cut_id)
    changed = []
    for beat in spec['cuts'][cut_id]['beats']:
        before = (beat.get('shot'), beat.get('layout'), (beat.get('plate') or {}).get('source'))
        if beat['id'] == title:
            shot = 'title'
        elif beat.get('shot') in KEPT:
            shot = beat['shot']
        elif mode == 'anchor' and graphics_only(beat):
            shot = 'plate'
        else:
            shot = body
        beat['shot'] = shot
        if shot == 'plate':
            beat['layout'] = 'STAGE'
            beat['plate'] = {'source': 'none'}
        elif beat.get('layout') in ('SPLIT', 'WINDOW'):
            beat['layout'] = 'P1'   # held in the staging's region, never a lock of its own
        if shot in grammar.STAGED_SHOTS and beat.get('face') == 'off':
            beat.pop('face')
        after = (beat.get('shot'), beat.get('layout'), (beat.get('plate') or {}).get('source'))
        if after != before:
            changed.append(f'{cut_id}.{beat["id"]}: {before[0] or "-"} -> {shot}')
    return changed


def plan(spec: dict, directory: Path | None = None) -> list[str]:
    changed = []
    for cut_id in spec['cuts']:
        changed += plan_cut(spec, cut_id, grammar.staging(spec, cut_id, directory))
    return changed


def table_md(spec: dict, directory: Path | None = None) -> str:
    """The shot table for the storyboard document: one row a beat, with its seconds and the face on screen."""
    lines = [START, '', '## Shots (the shot grammar, docs/ve/INGREDIENTS.md)', '']
    for cut_id, cut in spec['cuts'].items():
        mode = grammar.staging(spec, cut_id, directory)
        seconds = grammar.beat_seconds(cut, grammar._words(directory, cut_id))
        on = sum(s for b, s in zip(cut['beats'], seconds) if grammar.face_on(b) and b.get('shot') != 'end')
        body = sum(s for b, s in zip(cut['beats'], seconds) if b.get('shot') != 'end') or 1
        lines += [f'**{cut_id}** ({cut["aspect"]}): one staging, **{mode}**; his face on screen {on / body:.0%} of the body.', '',
                  '| Beat | Shot | Seconds | Face | Devices | Point |', '|---|---|---|---|---|---|']
        for beat, s in zip(cut['beats'], seconds):
            point = beat.get('point', '').replace('|', '/')
            lines.append(f'| {beat["id"]} | {beat.get("shot", "-")} | {s:.1f} | {"yes" if grammar.face_on(beat) else "no"} | '
                         f'{", ".join(beat.get("uses", [])) or "-"} | {point} |')
        lines.append('')
    lines.append(END)
    return '\n'.join(lines) + '\n'


def write_storyboard(path: Path, block: str) -> None:
    """Put the shot table in the storyboard document, replacing the one before it and keeping every other line."""
    text = path.read_text(encoding='utf-8') if path.is_file() else ''
    if START in text and END in text:
        head, rest = text.split(START, 1)
        _old, tail = rest.split(END, 1)
        text = head + block.rstrip('\n') + tail
    else:
        text = (text.rstrip('\n') + '\n\n' if text.strip() else '') + block
    path.write_text(text, encoding='utf-8', newline='\n')
