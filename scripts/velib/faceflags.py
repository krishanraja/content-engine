"""Face flags (advisory): where in a take he looks off the lens, has his eyes closed or turns his head, so a cut can
cover those moments with a graphic. ghost-editor does this on every reel (facescan.py, cover_windows.py); this reads
his take with MediaPipe's face landmarker (blendshapes for the eyes, the face's transform for the head), each measure
against the take's own median, so the way he sits at the teleprompter is his normal.

Advisory and uncalibrated (F14): it never changes which take conform chooses and never refuses a cut. The thresholds
are starting values until Monday 2 Nov and Thursday 5 Nov are read with it and he has looked at what it names.
The model is fetched once into .cache/models, pinned by sha256; it is never committed.
"""
from __future__ import annotations

import math
import subprocess
import urllib.request
from pathlib import Path

from .common import ROOT, ffmpeg, load_json, sha256_file, write_json

SCHEMA = 've-faces/1'
MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
MODEL_SHA256 = '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff'
MODEL = ROOT / '.cache' / 'models' / 'face_landmarker.task'
EVERY_S = 0.2
WIDTH = 360
# Starting values, not calibrated (F14). A blink is under 0.4 s and is not a window.
THRESHOLDS = {'eyes_closed': 0.5, 'off_lens': 0.3, 'head_turn_deg': 15.0, 'min_s': 0.4}
KINDS = ('no_face', 'eyes_closed', 'off_lens', 'head_turn')


def model_path() -> Path:
    """The pinned face landmarker, fetched once."""
    if not MODEL.is_file():
        MODEL.parent.mkdir(parents=True, exist_ok=True)
        part = MODEL.with_suffix('.part')
        with urllib.request.urlopen(MODEL_URL, timeout=120) as response:  # noqa: S310 - a pinned https URL
            part.write_bytes(response.read())
        part.replace(MODEL)
    if sha256_file(MODEL) != MODEL_SHA256:
        raise ValueError(f'{MODEL} is not the pinned face landmarker (sha256 {MODEL_SHA256}); delete it and run again')
    return MODEL


def _frames(media: str | Path, every_s: float):
    """RGB frames every `every_s` seconds, WIDTH wide, with their times."""
    import numpy as np  # noqa: PLC0415
    first = subprocess.run([ffmpeg(), '-v', 'error', '-i', str(media), '-frames:v', '1', '-vf', f'scale={WIDTH}:-2',
                            '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True).stdout
    height = len(first) // (WIDTH * 3)
    if not height:
        return
    size = WIDTH * height * 3
    proc = subprocess.Popen([ffmpeg(), '-v', 'error', '-i', str(media), '-vf', f'fps={1 / every_s},scale={WIDTH}:{height}',
                             '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    try:
        k = 0
        while True:
            raw = proc.stdout.read(size)
            if len(raw) < size:
                break
            yield round(k * every_s, 3), np.frombuffer(raw, np.uint8).reshape(height, WIDTH, 3)
            k += 1
    finally:
        proc.stdout.close()
        proc.wait()


def _angles(matrix) -> tuple[float, float]:
    """Yaw and pitch in degrees from the face's 4x4 transform."""
    r = [[float(matrix[i][j]) for j in range(3)] for i in range(3)]
    yaw = math.degrees(math.asin(max(-1.0, min(1.0, -r[2][0]))))
    pitch = math.degrees(math.atan2(r[2][1], r[2][2]))
    return round(yaw, 1), round(pitch, 1)


def reading(shapes: dict, matrix) -> dict:
    """One sample's measures from the landmarker's blendshape scores and transform."""
    def both(left, right):
        return (shapes.get(left, 0.0) + shapes.get(right, 0.0)) / 2
    gaze = max(both('eyeLookOutLeft', 'eyeLookInRight'), both('eyeLookInLeft', 'eyeLookOutRight'),
               both('eyeLookUpLeft', 'eyeLookUpRight'), both('eyeLookDownLeft', 'eyeLookDownRight'))
    yaw, pitch = _angles(matrix)
    return {'face': True, 'blink': round(both('eyeBlinkLeft', 'eyeBlinkRight'), 3), 'gaze': round(gaze, 3),
            'yaw': yaw, 'pitch': pitch}


def scan(media: str | Path, every_s: float = EVERY_S) -> dict:
    """Read the take: one sample every `every_s` seconds. Needs mediapipe."""
    import mediapipe as mp  # noqa: PLC0415
    from mediapipe.tasks.python import BaseOptions, vision  # noqa: PLC0415
    options = vision.FaceLandmarkerOptions(base_options=BaseOptions(model_asset_path=str(model_path())),
                                           running_mode=vision.RunningMode.VIDEO, num_faces=1,
                                           output_face_blendshapes=True, output_facial_transformation_matrixes=True)
    samples = []
    with vision.FaceLandmarker.create_from_options(options) as landmarker:
        for at_s, frame in _frames(media, every_s):
            found = landmarker.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=frame.copy()),
                                                int(at_s * 1000))
            if not found.face_blendshapes:
                samples.append({'t': at_s, 'face': False})
                continue
            shapes = {c.category_name: c.score for c in found.face_blendshapes[0]}
            samples.append({'t': at_s, **reading(shapes, found.facial_transformation_matrixes[0])})
    return {'schema': SCHEMA, 'every_s': every_s, 'samples': samples}


def _median(values: list[float]) -> float:
    ordered = sorted(values)
    if not ordered:
        return 0.0
    mid = len(ordered) // 2
    return ordered[mid] if len(ordered) % 2 else (ordered[mid - 1] + ordered[mid]) / 2


def flags(scanned: dict, thresholds: dict | None = None) -> dict:
    """Windows where each kind holds for at least min_s, measured against the take's own median."""
    t = {**THRESHOLDS, **(thresholds or {})}
    samples, every = scanned['samples'], scanned['every_s']
    faces = [s for s in samples if s.get('face')]
    median = {key: round(_median([s[key] for s in faces]), 3) for key in ('blink', 'gaze', 'yaw', 'pitch')}

    def kinds(s):
        if not s.get('face'):
            return {'no_face': 1.0}
        out = {}
        if s['blink'] >= t['eyes_closed']:
            out['eyes_closed'] = s['blink']
        elif s['gaze'] - median['gaze'] >= t['off_lens']:
            out['off_lens'] = round(s['gaze'] - median['gaze'], 3)
        turn = max(abs(s['yaw'] - median['yaw']), abs(s['pitch'] - median['pitch']))
        if turn >= t['head_turn_deg']:
            out['head_turn'] = round(turn, 1)
        return out

    windows, open_ = [], {}
    for s in samples + [{'t': (samples[-1]['t'] + every) if samples else 0.0, 'end': True}]:
        now = {} if s.get('end') else kinds(s)
        for kind in KINDS:
            if kind in now:
                start, peak = open_.get(kind, (s['t'], 0.0))
                open_[kind] = (start, max(peak, now[kind]))
            elif kind in open_:
                start, peak = open_.pop(kind)
                if s['t'] - start >= t['min_s'] - 1e-9:
                    windows.append({'kind': kind, 'from_s': round(start, 3), 'to_s': round(s['t'], 3), 'peak': peak})
    windows.sort(key=lambda w: (w['from_s'], w['kind']))
    return {'schema': SCHEMA, 'status': 'advisory', 'calibrated': False, 'every_s': every, 'thresholds': t,
            'median': median, 'samples': len(samples), 'with_face': len(faces), 'windows': windows}


def faces_path(ve_dir: Path, take: str) -> Path:
    return Path(ve_dir) / f'faces.{take}.json'


def cover_windows(edl: dict, ve_dir: Path) -> list[dict] | None:
    """The flagged windows inside the cut, in cut time: where a graphic could cover him. None when no take was read."""
    fps = edl.get('fps', 30)
    read = {}
    for name, take in edl['takes'].items():
        if not faces_path(ve_dir, name).is_file():
            continue
        found = load_json(faces_path(ve_dir, name))
        ingested = ((take or {}).get('media') or {}).get('sha256')
        if ingested and found.get('media_sha256') != ingested:
            continue   # read from another file under this take id (re-ingested since): run ve faces again
        read[name] = found
    if not read:
        return None
    out = []
    for segment in edl['segments']:
        found = read.get(segment['take'])
        if not found:
            continue
        speed = segment.get('speed') or edl.get('speed') or 1.0
        for w in found['windows']:
            start, end = max(w['from_s'], segment['src_in_s']), min(w['to_s'], segment['src_out_s'])
            if end <= start:
                continue
            a = segment['out_in_s'] + (start - segment['src_in_s']) / speed
            b = segment['out_in_s'] + (end - segment['src_in_s']) / speed
            out.append({'kind': w['kind'], 'take': segment['take'], 'src_s': [round(start, 3), round(end, 3)],
                        'from_s': round(a, 3), 'to_s': round(b, 3), 'from_frame': round(a * fps), 'to_frame': round(b * fps)})
    return sorted(out, key=lambda w: (w['from_s'], w['kind']))


def write_cover(edl: dict, ve_dir: Path) -> Path | None:
    windows = cover_windows(edl, ve_dir)
    if windows is None:
        return None
    return write_json(Path(ve_dir) / f'cover.{edl["cut"]}.json', {
        'schema': SCHEMA, 'cut': edl['cut'], 'status': 'advisory', 'calibrated': False,
        'note': 'Moments in the cut where he looks off the lens, closes his eyes or turns his head: a graphic may cover '
                'them. Never changes the take chosen (F14).', 'windows': windows})
