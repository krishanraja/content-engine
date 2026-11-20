"""Depth in compile: the subject matte of his take, the type set behind him, and the body keep-out (shot grammar step 5).

The study's shots 5 and 6 (The Athletic's giant numbers and "Fact N" marks behind and beside the presenter) and its
title "behind him via the matte while he talks" need his take cut from its wall. `ve matte` makes that cut, cached by
the take's sha256 (velib/matte.py); this turns it into props:

- `props.matte`: the subject (his take with the clipped matte as alpha), staged into the assets folder beside the take;
- `props.depth`: one item for each `number` beat that sets a `world` word (in-world, behind him, anchor only) and each
  `chapter` beat (a numeral beside or behind him), each with his head's box over its frames, from the matte;
- `titleMoment.behind`: on an anchor cut, the title builds on his wall above and behind his head while he talks (at
  most TITLE_BEHIND_MAX_S), never a full-frame card and never a box on his chest;
- the body keep-out: on an anchor cut every box compile places (the space above his head, a prop beside him) and on a
  cut-out stage the devices' region, refused where his silhouette (torso, arms, hands) fills more than BODY_TOLERANCE of
  it on any sampled frame (Krish's #950 verdict: "Cards sit on his chest and arms").

Geometry is kit/staging.ts's and kit/depth.ts's (tests hold the numbers to those files). Pure but for staging the
subject file.
"""
from __future__ import annotations

import os
import shutil
from pathlib import Path

from . import keepout

FPS = 30
TITLE_BEHIND_MAX_S = 6.0          # The Athletic's title over the presenter, 1 to 6 s
WORLD_S = (1.0, 6.0)              # the in-world number's time on screen
BODY_TOLERANCE = 0.02             # share of a box his silhouette may cross (a fringe), never a card over his torso or hands
FACE_LIFT = 1.1                   # FormatMaster.faceLift: a tall take is framed 1.1 from its bottom edge
HEAD_ROWS = 0.13                  # the head is the silhouette's top 13% of the take's height (his head and hair)


# ----------------------------------------------------------------------------------------------------------- mapping

def take_box(mode: str | None, aspect: str) -> tuple:
    if mode and (mode, aspect) in keepout.STAGED:
        return keepout.STAGED[(mode, aspect)][0]
    return (0, 0) + keepout.FRAME[aspect]


def mapper(box: tuple, take_w: int, take_h: int, aspect: str):
    """Take pixels to frame pixels: the take fills `box` by cover, centred, then (on a tall cut) scales 1.1 from the
    box's bottom centre (FormatMaster's faceLift)."""
    bx, by, bw, bh = box
    s = max(bw / take_w, bh / take_h)
    ox, oy = (bw - take_w * s) / 2, (bh - take_h * s) / 2
    lift = FACE_LIFT if aspect == '9:16' else 1.0

    def to_frame(x: float, y: float) -> tuple[float, float]:
        px, py = ox + x * s, oy + y * s
        px = bw / 2 + (px - bw / 2) * lift
        py = bh - (bh - py) * lift
        return bx + px, by + py
    return to_frame


def head_of(record: dict, frames: range, to_frame, take_h: int) -> dict | None:
    """His head over these frames, in frame pixels: the highest top, the widest left and right of the head rows, and
    the middle of his face (the median top plus half the head)."""
    step = record['profile_step']
    profile = record['profile']
    tops, lefts, rights = [], [], []
    for f in frames:
        if not 0 <= f < len(profile):
            continue
        rows = profile[f]
        first = next((i for i, r in enumerate(rows) if r), None)
        if first is None:
            continue
        head_rows = [r for r in rows[first:first + max(1, round(HEAD_ROWS * take_h / step))] if r]
        tops.append(first * step)
        lefts.append(min(r[0] for r in head_rows))
        rights.append(max(r[1] for r in head_rows))
    if not tops:
        return None
    tops.sort()
    median_top = tops[len(tops) // 2]
    x0, y0 = to_frame(min(lefts), tops[0])
    x1, _ = to_frame(max(rights), tops[0])
    _, mid = to_frame(0, median_top + HEAD_ROWS * take_h * 0.55)
    return {'top': round(y0), 'left': round(x0), 'right': round(x1), 'centreY': round(mid)}


def body_share(record: dict, frames: range, to_frame, box: tuple, take_w: int) -> float:
    """The most of `box` his silhouette fills on any of these frames (sampled every third), in frame pixels."""
    step = record['profile_step']
    bx, by, bw, bh = box
    if bw <= 0 or bh <= 0:
        return 0.0
    worst = 0.0
    for f in list(frames)[::3]:
        if not 0 <= f < len(record['profile']):
            continue
        area = 0.0
        for i, row in enumerate(record['profile'][f]):
            if not row:
                continue
            x0, y0 = to_frame(row[0], i * step)
            x1, y1 = to_frame(row[1] + 1, (i + 1) * step)
            w = max(0.0, min(x1, bx + bw) - max(x0, bx))
            h = max(0.0, min(y1, by + bh) - max(y0, by))
            area += w * h
        worst = max(worst, area / (bw * bh))
    return worst


# ------------------------------------------------------------------------------------------------------------- items

def title_box(width: int, height: int, head: dict) -> dict:
    """kit/depth.ts titleBox: the wall above and behind his head, so his head crosses the lockup's lower edge."""
    top = 270 if height > width else 60
    bottom = min(height * 0.62, head['top'] + height * 0.12)
    return {'left': 0, 'top': top, 'width': width, 'height': round(max(height * 0.18, bottom - top))}


def _word_frames(rows: list[dict]) -> dict[int, int]:
    return {r['w']: r['atFrame'] for r in rows if isinstance(r.get('w'), int)}


def stage_subject(record: dict, take_src: str, assets_dir: Path) -> str:
    """The subject beside the take in the assets folder (a hard link when it can be), so compile's contained-source rule
    and the renderer's staging read it like any other asset."""
    target = Path(take_src).with_name(Path(take_src).stem + '.subject.mov')
    if not Path(target).resolve().is_relative_to(Path(assets_dir).resolve()):
        raise ValueError('the subject must sit in the assets folder')
    if not target.is_file() or target.stat().st_size != Path(record['subject']).stat().st_size:
        target.unlink(missing_ok=True)
        try:
            os.link(record['subject'], target)
        except OSError:
            shutil.copyfile(record['subject'], target)
    return str(target)


def apply(props: dict, spec: dict, cut_id: str, rows: list[dict], record: dict | None, assets_dir: Path,
          take_frame: dict | None = None) -> list[str]:
    """Write props.matte, props.depth and titleMoment.behind, and return the body keep-out refusals."""
    cut = spec['cuts'][cut_id]
    aspect = props['aspect']
    width, height = keepout.FRAME[aspect]
    mode = (props.get('layout') or {}).get('mode')
    beats = {b['id']: b for b in cut['beats']}
    wants = [b for b in cut['beats'] if b.get('shot') == 'number' and b.get('world')] + \
        [b for b in cut['beats'] if b.get('shot') == 'chapter' and b.get('chapter')]
    problems = []
    if record is None:
        for b in wants:
            if b.get('shot') == 'number' or (b.get('chapter') or {}).get('arrangement') == 'behind':
                problems.append(f'depth.matte beat {b["id"]}: type behind him needs the subject matte of his take; run '
                                '`ve matte` (nothing is generated or spent)')
        return problems
    segments = props.get('segments') or []
    if len(segments) != 1:
        return ['depth.matte: the subject matte follows one take; this cut is cut from several (draw it without depth)']
    take_w = record.get('width') or (take_frame or {}).get('width') or 1080
    take_h = record.get('height') or (take_frame or {}).get('height') or 1920
    src = stage_subject(record, segments[0]['src'], assets_dir)
    props['matte'] = {'src': src, 'sha256': record['subject_sha256'], 'takeSha256': record['take_sha256']}
    to_frame = mapper(take_box(mode, aspect), take_w, take_h, aspect)
    at_word = _word_frames(rows)
    depth = []
    for pb in props['beats']:
        b = beats.get(pb['id'])
        if not b or b not in wants:
            continue
        head = head_of(record, range(pb['fromFrame'], pb['toFrame']), to_frame, take_h)
        if head is None:
            problems.append(f'depth.head beat {b["id"]}: the matte finds no head on these frames')
            continue
        if b['shot'] == 'number':
            w = b['world']
            at = at_word.get(w.get('at_w', b['span']['from_w']), pb['fromFrame'])
            depth.append({'kind': 'number', 'text': w['text'], **({'accent': w['accent']} if w.get('accent') else {}),
                          'fromFrame': pb['fromFrame'], 'atFrame': max(pb['fromFrame'], at), 'toFrame': pb['toFrame'], 'head': head})
        else:
            c = b['chapter']
            depth.append({'kind': 'chapter', 'text': c['mark'], **({'label': c['label']} if c.get('label') else {}),
                          'arrangement': c['arrangement'], **({'accent': c['accent']} if c.get('accent') else {}),
                          'behind': True,   # with a matte every mark stands in his world: he crosses it, it never crosses his face
                          'fromFrame': pb['fromFrame'], 'atFrame': pb['fromFrame'], 'toFrame': pb['toFrame'], 'head': head})
    if depth:
        props['depth'] = depth
    moment = props.get('titleMoment')
    if moment and mode == 'anchor':
        head = head_of(record, range(moment['fromFrame'], moment['toFrame']), to_frame, take_h)
        if head is not None:
            moment.pop('fullFrom', None)
            last = max(w['atFrame'] for w in moment['words'])
            moment['toFrame'] = min(max(moment['toFrame'], last + 15), moment['fromFrame'] + round(TITLE_BEHIND_MAX_S * FPS))
            moment['behind'] = title_box(width, height, head)
    problems += body_keepout(props, spec, cut_id, record, to_frame, take_w)
    return problems


def body_keepout(props: dict, spec: dict, cut_id: str, record: dict, to_frame, take_w: int) -> list[str]:
    """Refuse a box compile places that his torso, arms or hands fill: anchor's space above his head and its prop box, and
    a cut-out stage's region (a window stage draws its region above the take, so it cannot meet him)."""
    aspect = props['aspect']
    mode = (props.get('layout') or {}).get('mode')
    objects = {o['obj']: o for o in spec.get('objects', [])}
    beats = {b['id']: b for b in spec['cuts'][cut_id]['beats']}
    out = []
    for pb in props['beats']:
        b = beats.get(pb['id'], {})
        if b.get('shot') in ('plate', 'end', 'title') or not b.get('uses'):
            continue
        frames = range(pb['fromFrame'], pb['toFrame'])
        boxes = []
        if mode == 'anchor':
            boxes.append(('the space above his head', keepout.STAGED[('anchor', aspect)][1]))
            if any(_real_image(objects.get(u)) for u in b['uses']):
                boxes.append(('the prop beside him', keepout.ANCHOR_PROPS[0]))
        elif mode == 'stage' and (mode, aspect) in keepout.CUTOUT:
            boxes.append(('the stage region', keepout.CUTOUT[(mode, aspect)]))
        for name, box in boxes:
            share = body_share(record, frames, to_frame, box, take_w)
            if share > BODY_TOLERANCE:
                out.append(f'body.keep_out beat {pb["id"]}: his body fills {share:.0%} of {name} {tuple(box)} on {mode}; a card '
                           f'never sits on his torso, arms or hands (at most {BODY_TOLERANCE:.0%})')
    return out


def _real_image(o: dict | None) -> bool:
    if not o:
        return False
    if o.get('device') == 'photo_plate':
        return True

    def visit(v):
        if isinstance(v, dict):
            return any((k in ('src', 'logoSrc') and isinstance(x, str)) or visit(x) for k, x in v.items())
        if isinstance(v, list):
            return any(visit(x) for x in v)
        return False
    return visit(o.get('params') or {})
