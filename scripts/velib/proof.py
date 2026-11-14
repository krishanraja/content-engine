"""The moving proof: the cut's hardest beat rendered from his real take before any full cut (closes F04 and F13).

Krish, 2026-11-04: "Do we now ask all the right questions at the right times ... in order for you and Codex to never
need more than one production round in the future?" Thursday 5 Nov took 5+ renders; stills had stood in for motion
(F04) and the approach was scaled before its hardest sequence was proven (F13). Here:

  - `hardest_beat(spec, cut, props)`: by rule, never by taste. The beat named in `style.proof.beat` (or a top-level
    `proof.beat`); else the beat with the most distinct devices in `uses`; ties go to a SPLIT beat with a card device;
    then the longest; then the first.
  - `window(props, beat)`: the beat's frames, grown to at least 8 s into its neighbours and cut to at most 15 s.
  - `window_props(props, start, end)`: the same compiled props, cut to that window on the same clock, so the shared
    FormatMaster renders it through the one render path (`velib.render.render`), and `ve qc` measures it.
  - `structure(spec, cut)` / `structural_hash`: style.motion, the device set and each beat's id, uses and layout.
    Caption text, reasons and word spans are not in it, so a caption edit keeps the proof; a style or device change
    breaks it. A beat retimed by 0.5 s or more also breaks it (`problems`, against the beat times the proof recorded).
  - `problems(spec, cut, directory, gates)`: what holds a full cut's render from MOTION_FROM: no proof, a proof file
    that changed, a spec that changed structurally, or no approve press from Krish bound to the proof's sha256.
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

from .common import ROOT, load_json, sha256_file, write_json

FPS = 30
MIN_S, MAX_S = 8, 15
NUDGE_S = 0.5


def motion_from() -> str:
    sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
    import creative_direction  # noqa: PLC0415
    return creative_direction.MOTION_FROM


def required(spec: dict, cut: str) -> bool:
    """A whole cut (not a proof excerpt) of a piece published from MOTION_FROM renders only after its proof."""
    c = spec['cuts'][cut]
    return not c.get('excerpt', False) and str(spec.get('publish_day') or '') >= motion_from()


def devices_of(spec: dict, beat: dict) -> list[str]:
    by_obj = {o['obj']: o.get('device') for o in spec.get('objects') or []}
    return sorted({by_obj[name] for name in beat.get('uses') or [] if by_obj.get(name)})


def named_beat(spec: dict) -> str | None:
    for holder in ((spec.get('style') or {}).get('proof'), spec.get('proof')):
        if isinstance(holder, dict) and isinstance(holder.get('beat'), str):
            return holder['beat']
    return None


def _length(beat: dict, frames: dict) -> int:
    if beat['id'] in frames:
        a, b = frames[beat['id']]
        return b - a
    span = beat.get('span') or {}
    return int(span.get('to_w', 0)) - int(span.get('from_w', 0))


def hardest_beat(spec: dict, cut: str, props: dict | None = None) -> tuple[str, str]:
    """(beat id, the rule that chose it)."""
    beats = spec['cuts'][cut]['beats']
    named = named_beat(spec)
    if named:
        if named not in [b['id'] for b in beats]:
            raise ValueError(f'proof.beat {named!r} is not a beat of cut {cut}')
        return named, 'named in the spec (proof.beat)'
    frames = {b['id']: (b['fromFrame'], b['toFrame']) for b in (props or {}).get('beats') or []}
    scored = []
    for index, beat in enumerate(beats):
        devices = devices_of(spec, beat)
        split_card = beat.get('layout') == 'SPLIT' and any(d.endswith('_card') for d in devices)
        scored.append((len(devices), split_card, _length(beat, frames), -index, beat['id']))
    best = max(scored)
    ties = [row for row in scored if row[0] == best[0]]
    if len(ties) == 1:
        rule = f'most distinct devices ({best[0]})'
    elif best[1] and sum(1 for row in ties if row[1]) == 1:
        rule = f'most distinct devices ({best[0]}), tie broken by the SPLIT beat with a card'
    else:
        rule = f'most distinct devices ({best[0]}), tie broken by length'
    return best[4], rule


def content_end(props: dict) -> int:
    ending = props.get('ending')
    return int(ending['fromFrame']) if isinstance(ending, dict) else int(props['durationFrames'])


def window(props: dict, beat_id: str) -> tuple[int, int]:
    """[start, end) frames: the beat, grown to MIN_S into its neighbours, cut to MAX_S from its start."""
    beat = next((b for b in props['beats'] if b['id'] == beat_id), None)
    if beat is None:
        raise ValueError(f'beat {beat_id} is not in the compiled props: run ve compile for this cut first')
    fps = props.get('fps', FPS)
    limit = content_end(props)
    start, end = int(beat['fromFrame']), min(int(beat['toFrame']), limit)
    if end - start > MAX_S * fps:
        end = start + MAX_S * fps
    need = MIN_S * fps - (end - start)
    if need > 0:
        start, end = start - need // 2, end + need - need // 2
        if start < 0:
            end, start = min(limit, end - start), 0
        if end > limit:
            start, end = max(0, start - (end - limit)), limit
    # A window never spans the sting after the hook: the stem holds its frames of silence there, so a window that
    # crossed it would play his voice out of step. It stays on its own beat's side of the hook's end.
    at = int((props.get('sting') or {}).get('atFrame') or 0)
    if at and start < at < end:
        start, end = (at, end) if int(beat['fromFrame']) >= at else (start, at)
    if end <= start:
        raise ValueError(f'beat {beat_id} has no frames to prove')
    return start, end


def window_props(props: dict, start: int, end: int) -> dict:
    """The compiled props cut to [start, end) on the same clock: what the window shows, nothing the cut does not."""
    out = json.loads(json.dumps(props))
    length = end - start

    def shift(frame):
        return min(max(int(frame) - start, 0), length)

    def overlaps(a, b):
        return int(a) < end and int(b) > start

    out['durationFrames'] = length
    beats = []
    for beat in props['beats']:
        if not overlaps(beat['fromFrame'], beat['toFrame']):
            continue
        row = dict(beat, fromFrame=shift(beat['fromFrame']), toFrame=shift(beat['toFrame']))
        if 'keyFrame' in beat:
            row['keyFrame'] = min(max(shift(beat['keyFrame']), row['fromFrame']), row['toFrame'] - 1)
        row['sectionBeat'] = not beats
        beats.append(row)
    out['beats'] = beats
    alive = set()
    objects = []
    for obj in props.get('objects') or []:
        if overlaps(obj['fromFrame'], obj['toFrame']):
            objects.append(dict(obj, fromFrame=shift(obj['fromFrame']), toFrame=shift(obj['toFrame'])))
            alive.add(obj['obj'])
    out['objects'] = objects
    # An object alive in the window keeps every state it reached before it: earlier events land on frame 0, in order
    # (the renderer lands frame-0 entrances whole).
    out['events'] = [dict(e, atFrame=shift(e['atFrame'])) for e in props.get('events') or []
                     if e['obj'] in alive and int(e['atFrame']) < end]
    captions = []
    for page in props.get('captions') or []:
        if not overlaps(page['fromFrame'], page['toFrame']):
            continue
        captions.append(dict(page, fromFrame=shift(page['fromFrame']), toFrame=shift(page['toFrame']),
                             words=[dict(w, atFrame=shift(w['atFrame'])) for w in page['words']]))
    if not captions:
        raise ValueError('the proof window holds no caption page')
    out['captions'] = captions
    out['segments'] = [dict(s, trimBeforeFrames=int(s.get('trimBeforeFrames', 0)) + max(0, start - int(s['fromFrame'])),
                            fromFrame=shift(s['fromFrame']),
                            durationFrames=min(int(s['fromFrame']) + int(s['durationFrames']), end) - max(int(s['fromFrame']), start))
                       for s in props.get('segments') or [] if overlaps(s['fromFrame'], int(s['fromFrame']) + int(s['durationFrames']))]
    # A window is never a whole cut, so it carries no sting; but the stem was premixed with the sting's frames where
    # it plays (ve premix), so cut frame f is stem frame velib.qc.to_file(f) (window keeps it off the sting).
    from .qc import to_file  # noqa: PLC0415
    out.pop('sting', None)
    out['audio'] = dict(props['audio'], stem=dict(props['audio']['stem'],
                        trimBeforeFrames=int(props['audio']['stem'].get('trimBeforeFrames', 0)) + to_file(start, props)),
                        sfx=[dict(s, atFrame=shift(s['atFrame'])) for s in props['audio'].get('sfx') or []
                             if start <= int(s['atFrame']) < end])
    ending = props.get('ending')
    if isinstance(ending, dict) and int(ending['fromFrame']) < end:
        out['ending'] = dict(ending, fromFrame=shift(ending['fromFrame']))
    else:
        out.pop('ending', None)
    return out


def structure(spec: dict, cut: str) -> dict:
    """What a proof stands for: the style, the devices and each beat's id, uses and layout. Words and spans are not in it."""
    beats = spec['cuts'][cut]['beats']
    used = {name for b in beats for name in b.get('uses') or []}
    motion = (spec.get('style') or {}).get('motion')
    return {
        'format': spec.get('format'), 'aspect': spec['cuts'][cut].get('aspect'),
        'motion': motion.get('module') if isinstance(motion, dict) else None,
        'objects': sorted([o['obj'], o.get('device')] for o in spec.get('objects') or [] if o['obj'] in used),
        'beats': [[b['id'], b.get('layout'), sorted(b.get('uses') or [])] for b in beats],
    }


def structural_hash(spec: dict, cut: str) -> str:
    return hashlib.sha256(json.dumps(structure(spec, cut), sort_keys=True, separators=(',', ':')).encode('utf-8')).hexdigest()


def changes(old: dict, new: dict) -> list[str]:
    """Plain lines naming what changed between two structures."""
    out = []
    if old.get('motion') != new.get('motion'):
        out.append(f"style.motion {old.get('motion')} -> {new.get('motion')}")
    for key in ('format', 'aspect'):
        if old.get(key) != new.get(key):
            out.append(f'{key} {old.get(key)} -> {new.get(key)}')
    a, b = {tuple(x) for x in old.get('objects') or []}, {tuple(x) for x in new.get('objects') or []}
    out += [f'device added: {o} ({d})' for o, d in sorted(b - a)] + [f'device removed: {o} ({d})' for o, d in sorted(a - b)]
    olds = {row[0]: row for row in old.get('beats') or []}
    news = {row[0]: row for row in new.get('beats') or []}
    out += [f'beat added: {bid}' for bid in news if bid not in olds] + [f'beat removed: {bid}' for bid in olds if bid not in news]
    for bid in news:
        if bid in olds and olds[bid] != news[bid]:
            out.append(f'beat {bid}: layout {olds[bid][1]} -> {news[bid][1]}, uses {olds[bid][2]} -> {news[bid][2]}'
                       if olds[bid][1] != news[bid][1] else f'beat {bid}: uses {olds[bid][2]} -> {news[bid][2]}')
    if not out and [r[0] for r in old.get('beats') or []] != [r[0] for r in new.get('beats') or []]:
        out.append('beat order changed')
    return out


def record_path(directory: Path, cut: str) -> Path:
    return Path(directory) / 'proof' / f'{cut}.json'


def clip_path(directory: Path, cut: str) -> Path:
    return Path(directory) / 'proof' / f'{cut}.mp4'


def beat_seconds(props: dict, beat_id: str) -> tuple[float, float] | None:
    beat = next((b for b in props.get('beats') or [] if b['id'] == beat_id), None)
    if beat is None:
        return None
    fps = props.get('fps', FPS)
    return round(beat['fromFrame'] / fps, 3), round(min(beat['toFrame'], content_end(props)) / fps, 3)


def make(spec: dict, cut: str, directory: Path, props: dict, render_fn, qc_fn=None) -> dict:
    """Choose the beat, write the window props, render them through render_fn(props_path, out_mp4) and record it."""
    if cut not in spec['cuts']:
        raise ValueError(f'{cut} is not a cut in the spec')
    if props.get('cutId') != cut:
        raise ValueError(f"the props are for {props.get('cutId')}, not {cut}")
    beat, rule = hardest_beat(spec, cut, props)
    start, end = window(props, beat)
    folder = Path(directory) / 'proof'
    folder.mkdir(parents=True, exist_ok=True)
    props_out = write_json(folder / f'props.{cut}.json', window_props(props, start, end))
    clip = clip_path(directory, cut)
    render_fn(props_out, clip)
    if not clip.is_file() or clip.stat().st_size == 0:
        raise ValueError(f'the proof render wrote nothing at {clip}')
    fps = props.get('fps', FPS)
    motion = (spec.get('style') or {}).get('motion')
    record = {'schema': 've-proof/1', 'piece': spec['piece_id'], 'cut': cut, 'beat': beat, 'rule': rule,
              'start': round(start / fps, 3), 'end': round(end / fps, 3), 'beat_s': beat_seconds(props, beat),
              'sha256': sha256_file(clip), 'spec_sha256': structural_hash(spec, cut), 'structure': structure(spec, cut),
              'style_module': motion.get('module') if isinstance(motion, dict) else None,
              'props_sha256': sha256_file(props_out)}
    if qc_fn is not None:
        try:
            report = qc_fn(clip, props_out)
            record['qc'] = {'measured_pass': report.get('measured_pass'), 'complete': report.get('complete'),
                            'failing': sorted(k for k, v in (report.get('checks') or {}).items() if v.get('pass') is False)}
        except Exception as error:  # noqa: BLE001 - QC on the proof is a first look, recorded either way
            record['qc'] = {'measured_pass': None, 'complete': False, 'error': str(error)[:200]}
    write_json(record_path(directory, cut), record)
    return record


def problems(spec: dict, cut: str, directory: Path, gates: dict, props: dict | None = None) -> list[str]:
    """[] when an approved proof stands for this cut as the spec is now; otherwise each reason, with what to do."""
    piece = spec.get('piece_id', '<piece>')
    path = record_path(directory, cut)
    run = f'run ve proof <spec> --cut {cut}, then Krish presses Approve proof on the board'
    if not path.is_file():
        return [f'no moving proof for {cut}: {run}']
    record = load_json(path)
    clip = clip_path(directory, cut)
    out = []
    if clip.is_file() and sha256_file(clip) != record.get('sha256'):
        out.append(f'proof/{cut}.mp4 is not the file proof/{cut}.json records: {run}')
    if record.get('spec_sha256') != structural_hash(spec, cut):
        what = changes(record.get('structure') or {}, structure(spec, cut))
        out.append(f"the spec changed since the proof ({'; '.join(what) or 'structure'}): {run}")
    if props is not None and record.get('beat_s'):
        now = beat_seconds(props, record['beat'])
        if now is None or any(abs(a - b) >= NUDGE_S for a, b in zip(now, record['beat_s'])):
            out.append(f"beat {record['beat']} moved by {NUDGE_S} s or more since the proof: {run}")
    from .gates import for_hash
    press = for_hash(gates, 'proof', record.get('sha256'), cut)
    if press is None:
        out.append(f"Krish has not approved proof/{cut}.mp4 (sha256 {str(record.get('sha256'))[:12]}): he presses Approve proof "
                   f"on the board's day tab for {piece}")
    elif press.get('verdict') != 'approve':
        words = f": \"{press['words']}\"" if press.get('words') else ''
        out.append(f'Krish rejected this proof{words}; change the spec and run ve proof <spec> --cut {cut} again')
    return out


def summary(spec: dict, cut: str, directory: Path, gates: dict) -> str:
    """One plain line for the packet: approved or not, and what changed since."""
    path = record_path(directory, cut)
    if not path.is_file():
        return f'{cut}: no moving proof was made' + ('' if not required(spec, cut) else ' (required from 9 Nov)')
    record = load_json(path)
    reasons = problems(spec, cut, directory, gates)
    what = changes(record.get('structure') or {}, structure(spec, cut))
    since = f"; changed since: {'; '.join(what)}" if what else '; nothing structural changed since'
    if not reasons:
        return f"{cut}: proof of beat {record['beat']} approved by Krish{since}"
    return f"{cut}: proof of beat {record['beat']} not approved ({reasons[0].split(':')[0]}){since}"
