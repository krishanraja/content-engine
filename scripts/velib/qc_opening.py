"""ve qc's opening row: what the finished file shows in front of his first frame, measured on its own bytes.

Ruling (Krish, 2026-11-12): "Nothing before the hook, ever. Remove the sting exception for good." Every cut, wide or
tall, series or off day, opens straight on its hook (house rule HOOK_IS_THE_INTRO). The house sting that opened the
16:9 whole cut of a weekly series piece from 5 Nov is retired (config/intro-sting.json, scripts/quick-edit/intro.py),
so this row fails any cut whose props carry a sting or an episode card in front of the hook, and any file whose first
frames are one of the sting clips this machine holds.

What it measured on a cut whose props carried the sting, kept so an old file can still be read (it fails either way):
  - the props allow it: a 16:9 whole cut (it has an ending) of the series the sting is for, never an off day;
  - it is the clip Krish approved, and his voice comes in after it (velib.compile.sting_problems), and the clip at
    sting.src has the props' sha256;
  - each of the file's frames 0 to frames-1 is the clip's frame of the same number (MATCH: colour distance and SSIM on
    small frames), and frame `frames` is not the sting's last frame, so his cut starts there with no held frame;
  - the file holds exactly frames + durationFrames frames: the cut runs on from the frame after the sting.
On any other cut:
  - the file holds exactly durationFrames frames, so nothing is in front of the cut;
  - its first frames are none of the sting clips of its shape that this machine holds (each checked by its sha256);
  - a 16:9 whole cut of a series piece does not open on its hook once the sting is approved (props compiled before
    the approval). A proof window keeps its ending but trims the stem, so it is never read as a whole cut here.

MATCH was measured once, on 5 Nov 2026, on one real render (the mind_the_gap 16:9 clip in front of a synthetic take,
ve-render at 30 fps): the render against its own clip differed by at most 1.5 levels (mean absolute RGB difference at
160x90) with SSIM at least 0.98 on every frame; against the other two series' clips by at least 20 levels; his first
frame against the sting's last by 113 levels (SSIM 0.55); a plain cut's first frames against the clip by at least 103.
The limits below sit between those and are placeholders until more cuts are measured (config/gates.json marks its own
the same way)."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import numpy as np

from .common import ffmpeg, sha256_file
from .qc_keyframes import ssim

MATCH_MAD_MAX = 6.0     # mean absolute RGB difference, 0-255, at SIZE: at or under it a frame is the clip's frame
MATCH_SSIM_MIN = 0.90   # and its luma SSIM at or above this
SIZE = {'16:9': (160, 90), '9:16': (90, 160)}
SHAPE = {'16:9': '16x9', '9:16': '9x16'}
CALIBRATION = 'placeholder: measured on one real render, 5 Nov 2026 (velib/qc_opening.py)'


def frame_count(path: str) -> int:
    """The video frames in the file, counted from its packets (no decode)."""
    probe = Path(ffmpeg()).with_name('ffprobe')
    exe = str(probe) if probe.is_file() else (shutil.which('ffprobe') or 'ffprobe')
    out = subprocess.run([exe, '-v', 'error', '-select_streams', 'v:0', '-count_packets', '-show_entries',
                          'stream=nb_read_packets', '-of', 'csv=p=0', str(path)], capture_output=True, text=True, check=True)
    return int(out.stdout.strip().split(',')[0])


def frames_rgb(path: str, first: int, last: int, size: tuple[int, int]) -> np.ndarray:
    """Frames first..last (inclusive, by index, never by timestamp) scaled to size, as RGB floats."""
    w, h = size
    raw = subprocess.run([ffmpeg(), '-nostdin', '-v', 'error', '-i', str(path), '-an', '-vf',
                          f'select=between(n\\,{first}\\,{last}),scale={w}:{h},format=rgb24', '-fps_mode', 'passthrough',
                          '-f', 'rawvideo', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8)[: len(raw) // (w * h * 3) * w * h * 3].reshape(-1, h, w, 3).astype(np.float64)


def _luma(frame: np.ndarray) -> np.ndarray:
    return frame @ np.array([0.299, 0.587, 0.114])


def likeness(a: np.ndarray, b: np.ndarray) -> dict:
    """How alike two frames are: mean absolute RGB difference, luma SSIM, and whether that makes them the same frame."""
    mad, score = float(np.abs(a - b).mean()), ssim(_luma(a), _luma(b))
    return {'mad': round(mad, 2), 'ssim': round(score, 4), 'same': mad <= MATCH_MAD_MAX and score >= MATCH_SSIM_MIN}


def _starts_with(render: np.ndarray, clip: np.ndarray) -> dict:
    """Whether the render's first frames are the clip's, frame for frame, over the frames both have."""
    n = min(len(render), len(clip))
    rows = [likeness(render[i], clip[i]) for i in range(n)]
    worst = max(rows, key=lambda r: r['mad']) if rows else None
    return {'frames': n, 'all_same': bool(rows) and all(r['same'] for r in rows),
            'first_different': next((i for i, r in enumerate(rows) if not r['same']), None),
            'worst_mad': worst and worst['mad'], 'worst_ssim': min((r['ssim'] for r in rows), default=None)}


def _intro():
    from .compile import _intro as reader  # noqa: PLC0415  scripts/quick-edit/intro.py, the sting's one reader
    return reader()


def opening(path: str, view: dict) -> dict:
    """The opening row for the file at path, from the props' opening view (velib.qc.opening_view)."""
    from .compile import STING_ASPECT, sting_problems  # noqa: PLC0415
    intro = _intro()
    aspect, fps = view.get('aspect'), int(view.get('fps') or 30)
    cut_frames = int(view.get('durationFrames') or 0)
    sting = view.get('sting') or None
    series = (view.get('series') or {}).get('label') or ''
    channel = series.replace('.', '_')
    whole = bool(view.get('ending'))
    size = SIZE.get(aspect, SIZE['16:9'])
    problems: list[str] = []
    value: dict = {'opening': 'sting' if sting else 'hook', 'cut_frames': cut_frames}
    total = frame_count(path)
    value['file_frames'] = total
    if sting:
        lead = int(sting.get('frames') or 0)
        # The sting plays after the hook (props.sting.atFrame, the hook's last frame + 1) on a cut made from 16 Nov; at
        # the cut's frame 0 on one made before (the retired opening). Either way it is the clip frame for frame.
        at = int(sting.get('atFrame') or 0)
        value.update(opening='hook' if at else 'sting', lead_frames=0 if at else lead, sting_frames_in_file=lead,
                     sting_at_frame=at, series=sting.get('series'), clip_sha256=sting.get('sha256'))
        if aspect != STING_ASPECT or not whole or series in ('', 'off.day') or sting.get('series') != channel:
            problems.append(f'only the 16:9 whole cut of a weekly series piece carries its own series\' sting; this is a {aspect} '
                            f'{"whole cut" if whole else "excerpt"} of {series or "no series"} with the {sting.get("series")} sting')
        problems += sting_problems(view)
        src = Path(str(sting.get('src') or ''))
        if not src.is_file():
            problems.append(f'the sting clip {src} is not on this machine, so the file cannot be compared with it')
        elif sha256_file(str(src)) != sting.get('sha256'):
            problems.append(f'the sting clip {src.name} is not the clip the props name (sha256 differs)')
        if total != lead + cut_frames:
            problems.append(f'the file holds {total} frames, and the sting and the cut are {lead} + {cut_frames}: the cut does '
                            'not run on from the frame after the sting')
        if src.is_file() and lead > 0:
            clip = frames_rgb(str(src), 0, lead - 1, size)
            head = frames_rgb(path, max(0, at - 1), at + lead, size)
            before, head = (head[0], head[1:]) if at else (None, head)
            if len(clip) != lead:
                problems.append(f'the sting clip holds {len(clip)} frames, and the props say {lead}')
            match = _starts_with(head[:lead], clip)
            value['sting_frames'] = match
            if not match['all_same'] or match['frames'] != lead:
                first = match['first_different']
                problems.append(f'the file\'s frames {at} to {at + lead - 1} are not the sting clip frame for frame'
                                + (f' (frame {at + first} differs)' if first is not None else ''))
            if before is not None and len(clip) and likeness(before, clip[0])['same']:
                problems.append(f'frame {at - 1}, the hook\'s last, is already the sting: the hook is cut short')
            if len(head) > lead and len(clip):
                cut_in = likeness(head[lead], clip[-1])
                value['first_cut_frame_vs_sting_last'] = cut_in
                if cut_in['same']:
                    problems.append(f'frame {at + lead} is still the sting\'s last frame: his face comes back on the very next '
                                    'frame after the sting, with no held frame')
            else:
                problems.append(f'the file has no frame {at + lead}, where his cut goes on')
        target = (f'his hook on frames 0 to {at - 1}, the approved {sting.get("series")} sting on frames {at} to {at + lead - 1}, '
                  f'his cut again from frame {at + lead}, and {lead} + {cut_frames} frames in all' if at else
                  f'the approved {sting.get("series")} sting on frames 0 to {lead - 1}, his cut from frame {lead}, and '
                  f'{lead} + {cut_frames} frames in all')
    else:
        value['lead_frames'] = 0
        if total != cut_frames:
            problems.append(f'the file holds {total} frames, and the cut is {cut_frames}: something is in front of it or missing')
        try:
            cfg = intro.load()
        except intro.IntroError as error:
            cfg, value['clips_note'] = None, f'the sting\'s config cannot be read, so no clip is compared: {error}'
        stem = ((view.get('audio') or {}).get('stem') or {})
        whole_cut = whole and int(stem.get('trimBeforeFrames') or 0) == 0  # a proof window trims the stem
        excepted = (view.get('opening') or {}).get('kind') == 'episode_card'
        if excepted:
            value['opening'] = 'episode_card'
            value['opening_said'] = (view.get('opening') or {}).get('said')
            problems += sting_problems(view)
        value['whole_cut'] = whole_cut
        compared = []
        if cfg is not None and SHAPE.get(aspect):
            head = None
            for name in cfg['series']:
                try:
                    clip_path = intro.clip(SHAPE[aspect], name, cfg)
                except intro.IntroError:
                    continue  # not on this machine, or not his bytes: nothing to compare with
                frames = int(cfg.get('frames') or 0)
                head = frames_rgb(path, 0, max(0, frames - 1), size) if head is None else head
                match = _starts_with(head, frames_rgb(str(clip_path), 0, max(0, frames - 1), size))
                compared.append({'series': name, 'shape': SHAPE[aspect], **match})
                if match['all_same']:
                    problems.append(f'the file opens on the {name} {SHAPE[aspect]} sting, and this cut opens on its hook')
        value['clips_compared'] = compared
        target = f'no sting: the cut\'s own frame 0 is the file\'s first, and {cut_frames} frames in all'
    return {'value': value, 'target': target, 'pass': not problems, 'status': 'measured', 'calibration': CALIBRATION,
            **({'problems': problems, 'reason': problems[0]} if problems else {})}
