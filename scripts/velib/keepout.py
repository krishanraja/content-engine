"""Nothing is ever drawn over his face (Krish, 2026-11-19, of the Wed short: "the card generates over my face, the
captions are awful, and the generated animations are tacky and not art directed well within the space at all").

Until now the face check ran only after render (velib/qc_faces.py) and failed open where no detector ran. Now compile
reads the take's face track (faces.<take>.json, written by `ve faces`, whose samples carry the face's box on the take)
and writes, on every beat that shows his take, the box his face takes in the frame (`faceKeepOut`), grown by the same
margin the after-render check uses. Compile then refuses any box it draws that meets it: the devices' region and the
panel on a staged beat, and every caption page on the beat. A cut whose take has no face track is named, never passed
silently: `ve expect` says so, and from floor.RECIPE_FROM `ve lint` refuses it.

The take box and the staged regions are kit/staging.ts's own numbers (tests/ve_quality_floor_test.py holds each one to
that file); the caption bands are read from the renderer (captions/kit.ts REGIONS, WordCaption.tsx through qc_faces).
What compile cannot know is where a device lands inside a non-staged layout's own slots: the renderer's boxes prove that
after render (qc_faces), and it is said here rather than assumed.
"""
from __future__ import annotations

import re
from pathlib import Path

from .common import ROOT, load_json

FPS = 30
MARGIN = 0.10   # qc_faces.MARGIN: hair, chin and a moving head stay clear too
FRAME = {'9:16': (1080, 1920), '16:9': (1920, 1080)}
PILLAR_TAKE_WIDTH = round(1080 * 9 / 16)
# kit/staging.ts stagingGeometry: (take box, the devices' region before it is cut clear of the captions, the panel).
STAGED = {
    ('band', '9:16'): ((0, 1000, 1080, 920), (60, 280, 800, 680), (0, 0, 1080, 1000)),
    ('stage', '9:16'): ((600, 980, 420, 700), (60, 280, 800, 676), (0, 0, 1080, 1236)),
    ('tray', '9:16'): ((0, 0, 1080, 1920), (60, 900, 600, 600), (60, 900, 600, 600)),
    ('pillar', '16:9'): ((1920 - PILLAR_TAKE_WIDTH, 0, PILLAR_TAKE_WIDTH, 1080), (96, 140, 1920 - PILLAR_TAKE_WIDTH - 156, 800),
                         (0, 0, 1920 - PILLAR_TAKE_WIDTH, 1080)),
    ('band', '16:9'): ((1152, 0, 768, 1080), (96, 140, 996, 800), (0, 0, 1152, 1080)),
    ('stage', '16:9'): ((1400, 560, 440, 460), (96, 120, 1260, 700), (0, 0, 1920, 880)),
    ('tray', '16:9'): ((0, 0, 1920, 1080), (96, 480, 900, 540), (96, 480, 900, 540)),
}
# The house caption's band (kit/staging.ts clearOfCaptions, unthemed).
HOUSE_BAND = {'9:16': (70, 1090, 800, 230), '16:9': (192, 790, 1536, 236)}


def faces_path(directory: Path, take: str) -> Path:
    return Path(directory) / f'faces.{take}.json'


def track(directory: Path | None, take: str) -> list[dict] | None:
    """The face boxes on a take, or None when there is no track with boxes (an older `ve faces` wrote none)."""
    if directory is None:
        return None
    path = faces_path(directory, take)
    if not path.is_file():
        return None
    try:
        found = load_json(path).get('boxes')
    except (OSError, ValueError):
        return None
    return found if isinstance(found, list) and found else None


def cut_takes(spec: dict, cut_id: str, directory: Path | None) -> list[str]:
    """The takes a cut is cut from: its EDL's when ve conform wrote one, else the spec's own take."""
    if directory is not None and (Path(directory) / f'edl.{cut_id}.json').is_file():
        try:
            return sorted(load_json(Path(directory) / f'edl.{cut_id}.json').get('takes') or {})
        except (OSError, ValueError):
            pass
    take = spec['cuts'][cut_id].get('take')
    return [take] if take else []


def shows_his_take(spec: dict, cut_id: str) -> bool:
    from .floor import shows_take  # noqa: PLC0415
    if (spec.get('audio') or {}).get('master') == 'vo':
        return False   # a voiceover cut lays no picture of a take
    return any(shows_take(b) and not (b.get('plate') or {}).get('source', 'take').startswith('asset:')
               for b in spec['cuts'][cut_id].get('beats') or [])


def missing(spec: dict, directory: Path | None) -> list[tuple[str, str]]:
    """(cut, take) for every whole cut showing his take whose take has no face track."""
    out = []
    for cut_id, cut in spec['cuts'].items():
        if cut.get('excerpt') or not shows_his_take(spec, cut_id):
            continue
        out += [(cut_id, take) for take in cut_takes(spec, cut_id, directory) if track(directory, take) is None]
    return out


def missing_line(spec: dict, directory: Path | None) -> str | None:
    """ve expect's line: the cut is not checked against his face, said, never passed silently."""
    gaps = missing(spec, directory)
    if not gaps:
        return None
    takes = sorted({take for _cut, take in gaps})
    return (f"No face track for take {', '.join(takes)}: nothing is kept off his face before render until `ve faces` reads "
            'it (compile writes the face keep-out from it).')


def missing_lints(spec: dict, directory: Path | None, *, today: str | None = None) -> list[str]:
    from .floor import RECIPE_FROM, binds  # noqa: PLC0415
    if not binds(directory, today):
        return []
    return [f'floor.face_track cuts.{cut_id}: take {take} has no face track (faces.{take}.json with boxes), so compile '
            f'cannot keep cards, devices and captions off his face; run `ve faces <piece> --take {take}` (binds pieces '
            f'frozen from {RECIPE_FROM})' for cut_id, take in missing(spec, directory)]


# --------------------------------------------------------------------------------------------------------- geometry

def overlap(a, b) -> bool:
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    return min(ax + aw, bx + bw) > max(ax, bx) and min(ay + ah, by + bh) > max(ay, by)


def take_box(mode: str | None, aspect: str, beat: dict) -> tuple | None:
    """Where his take is drawn on this beat, or None when the beat does not show it."""
    from .floor import shows_take  # noqa: PLC0415
    if not shows_take(beat) or (beat.get('plate') or {}).get('source', 'take').startswith('asset:'):
        return None
    if mode and (mode, aspect) in STAGED:
        return STAGED[(mode, aspect)][0]
    return (0, 0) + FRAME[aspect]


def to_frame(norm: list[float], box: tuple, take_frame: dict | None) -> tuple[int, int, int, int]:
    """A face box in shares of the take, as drawn into `box` by cover (the take fills the box, centred), clipped to the
    box and grown by MARGIN."""
    bx, by, bw, bh = box
    tw, th = ((take_frame or {}).get('width'), (take_frame or {}).get('height'))
    if not tw or not th:
        tw, th = bw, bh
    s = max(bw / tw, bh / th)
    ox, oy = bx + (bw - tw * s) / 2, by + (bh - th * s) / 2
    x0, y0 = ox + norm[0] * tw * s, oy + norm[1] * th * s
    x1, y1 = x0 + norm[2] * tw * s, y0 + norm[3] * th * s
    x0, y0, x1, y1 = max(x0, bx), max(y0, by), min(x1, bx + bw), min(y1, by + bh)
    if x1 <= x0 or y1 <= y0:
        return (0, 0, 0, 0)
    w, h = x1 - x0, y1 - y0
    return (int(x0 - w * MARGIN), int(y0 - h * MARGIN), int(w * (1 + 2 * MARGIN)), int(h * (1 + 2 * MARGIN)))


def _union(boxes: list[tuple]) -> tuple | None:
    boxes = [b for b in boxes if b[2] > 0 and b[3] > 0]
    if not boxes:
        return None
    x0, y0 = min(b[0] for b in boxes), min(b[1] for b in boxes)
    x1, y1 = max(b[0] + b[2] for b in boxes), max(b[1] + b[3] for b in boxes)
    return (x0, y0, x1 - x0, y1 - y0)


def cut_times(t: float, take: str, edl: dict | None, cut_take: str) -> list[float]:
    """Where a moment of a take lands in the cut: through the EDL's segments, or as itself when there is none."""
    if edl is None:
        return [t] if take == cut_take else []
    out = []
    for s in edl.get('segments') or []:
        if s['take'] == take and s['src_in_s'] <= t < s['src_out_s']:
            out.append(s['out_in_s'] + (t - s['src_in_s']) / (s.get('speed') or edl.get('speed') or 1.0))
    return out


def theme_bands() -> dict:
    text = (ROOT / 'apps' / 'renderer' / 'src' / 'engine' / 'captions' / 'kit.ts').read_text(encoding='utf-8')
    out = {}
    for aspect in FRAME:
        row = re.search(re.escape(f"'{aspect}'") + r': \{(.*?)\}\s*\}', text, re.S).group(1) + '}'
        out[aspect] = {name: tuple(int(n) for n in nums) for name, *nums in
                       re.findall(r'(\w+): \{ left: (\d+), top: (\d+), width: (\d+), height: (\d+) \}', row)}
    return out


def caption_box(props: dict, page: dict, beat: dict) -> tuple:
    from . import qc_faces  # noqa: PLC0415
    aspect = props['aspect']
    if props.get('captionTheme'):
        return theme_bands()[aspect][props.get('captionPlacement') or 'lower']
    if props.get('captionStyle') == 'word':
        return qc_faces.caption_box(page, 'word', aspect, None, layout=beat['layout'],
                                    plate=(beat.get('plate') or {}).get('source'))
    return HOUSE_BAND[aspect]


# --------------------------------------------------------------------------------------------------------- compile

def apply(props: dict, spec: dict, cut_id: str, *, edl: dict | None, tracks: dict[str, list[dict]] | None,
          take_frame: dict | None) -> tuple[list[str], dict]:
    """Write faceKeepOut on every beat that shows his take and refuse what meets it. Returns (problems, report)."""
    if not tracks:
        return [], {'source': 'missing', 'beats': 0}
    aspect = props['aspect']
    mode = (props.get('layout') or {}).get('mode')
    spec_beats = {b['id']: b for b in spec['cuts'][cut_id]['beats']}
    objects = {o['obj']: o for o in spec.get('objects', [])}
    cut_take = spec['cuts'][cut_id]['take']
    by_beat: dict[str, list[tuple]] = {}
    for take, samples in tracks.items():
        for sample in samples:
            for t in cut_times(float(sample['t']), take, edl, cut_take):
                frame = round(t * FPS)
                beat = next((b for b in props['beats'] if b['fromFrame'] <= frame < b['toFrame']), None)
                if beat is None:
                    continue
                box = take_box(mode, aspect, spec_beats.get(beat['id'], beat))
                if box is not None:
                    by_beat.setdefault(beat['id'], []).append(to_frame(sample['box'], box, take_frame))
    problems = []
    for beat in props['beats']:
        keep = _union(by_beat.get(beat['id'], []))
        if keep is None:
            continue
        beat['faceKeepOut'] = dict(zip(('left', 'top', 'width', 'height'), keep))
        source = spec_beats.get(beat['id'], {})
        if mode and (mode, aspect) in STAGED:
            _take, region, panel = STAGED[(mode, aspect)]
            if any(u in objects and objects[u]['device'] != 'stamp' for u in source.get('uses', [])) and overlap(region, keep):
                problems.append(f"face.keep_out beat {beat['id']}: the devices' region {region} on the {mode} staging meets his "
                                f'face {keep}')
            if source.get('backdrop') and overlap(panel, keep):
                problems.append(f"face.keep_out beat {beat['id']}: the {mode} panel and its backdrop {panel} meet his face {keep}")
        for page in props.get('captions', []):
            if page['toFrame'] <= beat['fromFrame'] or page['fromFrame'] >= beat['toFrame']:
                continue
            box = caption_box(props, page, beat)
            if overlap(box, keep):
                words = ' '.join(w['text'] for w in page.get('words', []))
                problems.append(f"face.keep_out beat {beat['id']}: the caption \"{words}\" at {tuple(box)} meets his face {keep}")
                break
    return problems, {'source': ', '.join(f'faces.{t}.json' for t in sorted(tracks)), 'beats': len(by_beat)}
