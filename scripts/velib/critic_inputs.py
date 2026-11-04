"""What the Critic sees of a cut in motion, besides the reference sheets (F16, F38).

Until 5 Nov 2026 the Critic read four frames a row against each board card (velib.refgate) and nothing else: no frame
around a cut, no entrance as it settles, no number from QC. Krish caught what that missed himself (F16) and rejected
a verdict made on stills (F38). ghost-editor's approval sheet (a frame at each cut plus 0.12 s, each beat as it lands
and fully built) and its cut sheet (three frames either side of every cut) are the model.

`write` makes, beside the cut's QC record:

  beats.<cut>.jpg    one row per beat: a frame every 0.5 s from the beat's first frame, at most 8, each labelled with its
                     frame number;
  events.<cut>.jpg   one row per moment a device moves (events sharing a frame share a row): frames at -2, +2, +5, +8 and
                     +12 from it, so a 4-to-7-frame settle (docs/ve/MOTION_STANDARD.md) is seen, not assumed;
  cuts.<cut>.jpg     one row per cut (a beat boundary, and a join between takes): frames -3, -1, 0, +1 and +4 (0.12 s
                     after), so a jump, a flash or a frozen frame at the cut is in view;
  numbers.<cut>.json the measures QC already took, copied, never measured again, per beat where QC gives times, and
                     labelled "measured; not heard": the Critic cites them and never claims to have heard the cut.

It makes no judgement and blocks nothing.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

from .common import ffmpeg, load_json, sha256_file, write_json

STRIP_EVERY_S = 0.5
PER_BEAT = 8
EVENT_OFFSETS = (-2, 2, 5, 8, 12)
CUT_OFFSETS = (-3, -1, 0, 1, 4)
MAX_ROWS = 30
TILE_W = 160
LABEL_H = 18
HEARD = 'measured; not heard'
QC_ROWS = ('motion.change_density', 'motion.longest_still', 'motion.periodicity', 'loudness.integrated', 'loudness.true_peak',
           'loudness.long_silence', 'audio.bed', 'audio.bed_continuity', 'sync.av_xcorr', 'joins.in_gaps', 'joins.decoder',
           'captions.clock', 'captions.render', 'captions.ocr', 'words.lost', 'channel.safe_zones', 'audio.voice')


def frames_at(video: Path, numbers: list[int], width: int = TILE_W):
    """The cut's frames at these indexes, as RGB arrays, scaled to width; the same index may be asked for twice."""
    import numpy as np  # noqa: PLC0415
    wanted = sorted(set(n for n in numbers if n >= 0))
    if not wanted:
        return {}
    expr = '+'.join(f'eq(n\\,{n})' for n in wanted)
    raw = subprocess.run([ffmpeg(), '-v', 'error', '-i', str(video), '-vf', f"select='{expr}',scale={width}:-2",
                          '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                         capture_output=True, check=True).stdout
    height = _scaled_height(video, width)
    size = width * height * 3
    got = [np.frombuffer(raw[k * size:(k + 1) * size], np.uint8).reshape(height, width, 3) for k in range(len(raw) // size)]
    return dict(zip(wanted, got))


def _scaled_height(video: Path, width: int) -> int:
    out = subprocess.run([ffmpeg(), '-v', 'error', '-i', str(video), '-frames:v', '1', '-vf', f'scale={width}:-2',
                          '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True).stdout
    return len(out) // (width * 3)


def sheet(rows: list[tuple[str, list[int]]], frames: dict, target: Path, last_frame: int) -> Path:
    """A grid: one labelled row per (title, frame indexes); a frame past the cut's end is left blank."""
    from PIL import Image, ImageDraw  # noqa: PLC0415
    rows = rows[:MAX_ROWS]
    sample = next(iter(frames.values()))
    tile_h, tile_w = sample.shape[0], sample.shape[1]
    columns = max(len(numbers) for _, numbers in rows)
    image = Image.new('RGB', (tile_w * columns, (tile_h + 2 * LABEL_H) * len(rows)), (24, 24, 24))
    draw = ImageDraw.Draw(image)
    for r, (title, numbers) in enumerate(rows):
        top = r * (tile_h + 2 * LABEL_H)
        draw.text((4, top + 2), title[:90], fill=(235, 235, 235))
        for c, n in enumerate(numbers):
            left = c * tile_w
            if 0 <= n <= last_frame and n in frames:
                image.paste(Image.fromarray(frames[n]), (left, top + LABEL_H))
            draw.text((left + 4, top + LABEL_H + tile_h + 2), f'f{n}' if 0 <= n <= last_frame else '-', fill=(200, 200, 200))
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, quality=85)
    return target


def beat_rows(props: dict) -> list[tuple[str, list[int]]]:
    fps = props.get('fps', 30)
    step = max(1, round(STRIP_EVERY_S * fps))
    out = []
    for beat in props.get('beats') or []:
        first, last = int(beat['fromFrame']), int(beat['toFrame']) - 1
        picks = list(range(first, last + 1, step))[:PER_BEAT] or [first]
        out.append((f"beat {beat['id']} ({beat.get('layout', '')}) f{first}-f{last}", picks))
    return out


def event_rows(props: dict) -> list[tuple[str, list[int]]]:
    by_frame: dict[int, list[str]] = {}
    for event in props.get('events') or []:
        by_frame.setdefault(int(event['atFrame']), []).append(f"{event.get('obj', '?')} {event.get('verb', '?')}")
    return [(f'f{at}: ' + ', '.join(names), [at + k for k in EVENT_OFFSETS]) for at, names in sorted(by_frame.items())]


def cut_frames(props: dict, edl: dict | None) -> list[tuple[int, str]]:
    cuts = {int(b['fromFrame']): f"beat {b['id']}" for b in (props.get('beats') or [])[1:]}
    for join in (edl or {}).get('joins') or []:
        at = int(join['at_frame'])
        cuts[at] = (cuts[at] + ' + take join') if at in cuts else f"take join {join['from']['take']} > {join['to']['take']}"
    return sorted(cuts.items())


def cut_rows(props: dict, edl: dict | None) -> list[tuple[str, list[int]]]:
    return [(f'cut at f{at}: {what}', [at + k for k in CUT_OFFSETS]) for at, what in cut_frames(props, edl)]


def reference_numbers(spec: dict) -> dict:
    """Each board reference's grammar card (ve study, velib.study) when one sits beside its video: what the reference
    does in numbers, for the Critic to compare with the cut. Never a target."""
    from . import refgate, study  # noqa: PLC0415
    out = {}
    for ref in (spec.get('brand') or {}).get('references') or []:
        try:
            card = refgate.resolve(ref, fetch=lambda *_: None).with_suffix('.grammar.json')
        except (ValueError, KeyError):
            continue
        if card.is_file():
            data = load_json(card)
            out[ref.get('card') or card.stem] = {'note': study.NOTE, **{k: data.get(k) for k in (
                'duration_s', 'cuts_per_minute', 'change_density', 'longest_still_s', 'pace', 'zooms', 'loudness_lufs', 'speech')}}
    return out


def numbers(props: dict, qc: dict) -> dict:
    """QC's measures for the Critic, copied, with motion's still runs placed in their beats."""
    checks = qc.get('checks') or {}
    rows = {name: checks[name] for name in QC_ROWS if name in checks}
    fps = props.get('fps', 30)
    beats = []
    runs = (checks.get('motion.longest_still') or {}).get('runs') or []
    for beat in props.get('beats') or []:
        start, end = beat['fromFrame'] / fps, beat['toFrame'] / fps
        still = [run for run in runs if start <= run[0] < end]
        beats.append({'beat': beat['id'], 'from_s': round(start, 2), 'to_s': round(end, 2),
                      'still_runs_s': still, 'longest_still_s': max([run[1] for run in still], default=0)})
    return {'label': HEARD, 'video_sha256': qc.get('sha256'), 'measured_pass': qc.get('measured_pass'),
            'complete': qc.get('complete'), 'checks': rows, 'beats': beats,
            'note': 'Numbers QC took on this file. They describe the cut; they are not the Critic hearing it.'}


def write(cut: str, directory: Path, video: Path, props: dict, qc: dict, edl: dict | None = None,
          spec: dict | None = None) -> list[Path]:
    """Write the three strips and numbers.<cut>.json beside the cut's QC record; return their paths."""
    directory, video = Path(directory), Path(video)
    if qc.get('sha256') and qc['sha256'] != sha256_file(video):
        raise ValueError(f'the QC record for {cut} is for another file: run ve qc on this cut first')
    last = int(props.get('durationFrames') or 0) - 1
    kinds = (('beats', beat_rows(props)), ('events', event_rows(props)), ('cuts', cut_rows(props, edl)))
    wanted = [n for _, rows in kinds for _, numbers_ in rows[:MAX_ROWS] for n in numbers_ if 0 <= n <= last]
    frames = frames_at(video, wanted)
    out = []
    for kind, rows in kinds:
        if rows and frames:
            out.append(sheet(rows, frames, directory / f'{kind}.{cut}.jpg', last))
    figures = numbers(props, qc)
    if spec:
        figures['references'] = reference_numbers(spec)
    out.append(write_json(directory / f'numbers.{cut}.json', figures))
    return out


def load_for(directory: Path, cut: str) -> tuple[dict, dict | None]:
    props = load_json(Path(directory) / f'props.{cut}.json')
    edl_path = Path(directory) / f'edl.{cut}.json'
    return props, (load_json(edl_path) if edl_path.is_file() else None)
