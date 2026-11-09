"""ve eyeline: eye gaze correction on a take, before ingest. His eyes are moved toward the lens where they are off it,
and nothing else changes: not his sound, not a frame's time, not a blink, not a turned head.

Krish, 5 Nov 2026: "install eye gaze correction into the engine ... For all post-processing of my makeyourmindup
videos." He named WangWilly/gaze-correction-cam to try first and answered: private test only for its weights (they
carry no licence and were trained on a dataset released for non-commercial use), every future video, build the
safe pass now and plug the model in at the trial.

How a frame is changed, and only when it should be:

  1. Read (pass 1): the engine's pinned MediaPipe face landmarker (velib/faceflags.py, Apache 2.0, never the dlib
     68-point model, which is barred from commercial use) reads every frame at reduced size: the six points of each
     eye, the irises, the blink scores and the head's yaw and pitch.
  2. Decide: per frame, how far each eye is off the lens, against his own median on this take (on a teleprompter
     take his median is the lens). Strength is 0 when he blinks, turns his head past 15 degrees, leaves the frame,
     an eye box reaches the edge, or his eyes are already within ON_LENS_DEG of the lens. It then ramps, never jumps,
     over RAMP_FRAMES frames. Angles and eye boxes are smoothed over neighbouring frames (the whole take is read
     first, so the smoothing has no lag).
  3. Correct (pass 2): a backend turns each eye's 64x48 patch into a flow field and a light weight, in units that do
     not depend on size (velib.eyeline.Backend). The flow is scaled up and applied to his eye at FULL resolution in
     one resample, inside a feathered ellipse aligned to his head's roll, so his lashes and skin keep their detail.
     WangWilly's own app pasted a 64x48 picture back as a hard rectangle; this never does.
  4. Write: one ffmpeg process takes the frames on stdin and the original file's sound copied as it is
     (-map 0:v -map 1:a -c:a copy). A frame at strength 0 is written exactly as decoded.
  5. Check, before the file may be used: the same number of frames, the same frame times, the same audio stream
     (md5 of the copied packets) and the same duration; and a frame the backend was asked to move must have moved
     (a model that silently changes nothing is refused). Any failure deletes the output.

Backends: `identity` (tests; moves nothing, so only frames at strength 0 may exist), `flx` (WangWilly's model, private
evaluation only: it refuses to write outside .cache/eyeline-eval/ until Krish clears its licence), `maxine` (NVIDIA
Maxine Eye Contact, licensed for commercial use, needs an NVIDIA RTX GPU: not on either home computer, so it names
that and stops).

Numpy only at import; OpenCV and MediaPipe are loaded where they are used.
"""
from __future__ import annotations

import hashlib
import json
import math
import subprocess
from pathlib import Path

from .common import ffmpeg, write_json

ROOT = Path(__file__).resolve().parents[2]
EVAL_DIR = ROOT / '.cache' / 'eyeline-eval'
SCHEMA = 've-eyeline/1'

PATCH_H, PATCH_W = 48, 64
READ_WIDTH = 540            # pass 1 reads frames this wide
ON_LENS_DEG = 2.5           # an eye within this of his median is on the lens: untouched
FULL_DEG = 5.0              # at this far off, the correction is at full strength
MAX_DEG = 15.0              # never redirect further than this
BLINK = 0.5                 # faceflags THRESHOLDS['eyes_closed']
HEAD_TURN_DEG = 15.0        # faceflags THRESHOLDS['head_turn_deg']
OPEN_MIN = 0.16             # lid gap over eye width below this is a closing eye
OPEN_REL = 0.65             # ...and so is a lid gap under this share of his own median on the take
RAMP_FRAMES = 6
SMOOTH_SIGMA = 1.5          # frames, for eye boxes and angles
EYEBALL = 0.42              # eyeball radius as a share of the eye's corner-to-corner width
MOVED_MIN = 0.5             # mean change in grey levels inside the mask that counts as moved

# MediaPipe face mesh points, in the order dlib uses for the six eye points (outer/inner corner, two upper, two lower):
# the subject's right eye (image left) 36..41 and left eye (image right) 42..47.
EYE_POINTS = {'R': [33, 160, 158, 133, 153, 144], 'L': [362, 385, 387, 263, 373, 380]}
IRIS = {'R': 468, 'L': 473}
# The 16-point lid contour of each eye (MediaPipe face mesh), in order around the opening: the aperture blend keeps
# his own lids and lashes and takes only what is inside them from a redirected copy.
EYE_CONTOUR = {'R': [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
               'L': [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]}
APERTURE_SHRINK = 0.97      # the blend stops just inside his lid line ...
APERTURE_FEATHER = 0.03     # ... and eases out over this share of the eye's width
LID_SHARE, LID_MAX, LID_BLUR = 0.9, 0.12, 1.5   # share of the excess opening the upper lid takes back, its cap (eye widths), time smoothing
TEMPLATE_HI, TEMPLATE_SHARP = 90, 0.9    # the stack percentile the catchlight is taken from; how much texture is put back
GATE_FROM, GATE_SPAN = 0.3, 0.2     # no correction under 0.3 iris radii of move (about 8 deg), the whole move from 0.5 (about 14 deg)
TEMPLATE_VISIBLE, TEMPLATE_MOVE = 0.9, 0.8   # use the clean iris when under this share of his is visible, or he moves it this many radii
LOOK_UP, LOOK_DOWN, LOOK_PAD, LOOK_MIN = -0.035, 0.28, 1, 15  # white under the iris, or this share of it under the upper lid: a look up or down, left alone (and a few frames either side)
IRIS_SCALE = 1.14          # the clean iris is drawn this much larger than the landmarker's circle: its circle runs wide of the dark iris, so a plain copy leaves white above and below it (a stare)
IRIS_GROW = 1.02          # his iris circle, in landmarker radii, for the clean cut-out
IRIS_R = 0.19               # iris radius as a share of the eye's width, for its colour match
AIM_KEEP = 0.15             # share of his own eye movement kept on top of the lens aim, so the eyes stay alive
AIM_GAIN = 1.0             # tried 1.4: a hard glance read more frontal but the far iris smeared (5 Nov, 5.50 s)
AIM_MAX = 0.6               # never move an iris further than this share of the eye's width
DETAIL_MAX = 1.6            # never sharpen a redirected eye's detail by more than this
FP_SEQ = {'L': [3, 2, 1, 0, 5, 4], 'R': [0, 1, 2, 3, 4, 5]}   # WangWilly's anchor-map order


# ------------------------------------------------------------------ backends

class Backend:
    """correct(patches) -> [(flow, light)] for each (side, patch, anchors, angle): flow is HxWx2 in units of half the
    patch's width and height (+x right, +y down, backward warp: out[p] = in[p + flow]); light is HxW, the share of
    white the model blends in (0 for none)."""
    name = 'backend'
    restricted = False       # True: its output may only be written inside EVAL_DIR

    def correct(self, items):
        raise NotImplementedError


class Identity(Backend):
    name = 'identity'

    def correct(self, items):
        import numpy as np  # noqa: PLC0415
        return [(np.zeros((PATCH_H, PATCH_W, 2), np.float32), np.zeros((PATCH_H, PATCH_W), np.float32)) for _ in items]


class Maxine(Backend):
    """NVIDIA Maxine Eye Contact (AR SDK, licensed for commercial use) as a frame source. Maxine redirects whole frames
    itself on an NVIDIA RTX GPU, which neither home computer has: it runs on a rented pod (velib/maxine_pod.py) and
    returns a redirected copy of the take. This pass then takes Maxine's eyes only, only where the plan says to, so
    blinks, turned heads, frames on the lens, the sound and every frame time stay his."""
    name = 'maxine'
    aperture = True          # take only what is inside his own lids: Maxine re-draws lids a little lower and softer
    lock = True              # Maxine aims the eyes at the lens on every frame; eyeline only guards blinks and turns
    frame_source = True

    def __init__(self, copy: Path | str | None = None):
        if copy is None:
            raise RuntimeError('maxine: give the redirected copy (--maxine-copy), or run it on a pod (--pod). Maxine needs an '
                               'NVIDIA RTX GPU: neither home computer has one (LORIMER: Qualcomm Adreno; SURFACE: Intel Iris '
                               'Xe) and the cloud container has none, so a pod is rented, at Krish\'s approval.')
        self.copy = Path(copy)
        if not self.copy.is_file():
            raise RuntimeError(f'maxine: {self.copy} is not a file')

    def frames_for(self, info: dict):
        return frames(self.copy, info['width'], info['height'])


class Flx(Backend):
    """WangWilly/gaze-correction-cam's warping model (Hsu et al., ACM TOMM 2019), run from its own source and the v0.1.1
    weights, both kept in .cache/eyeline-eval/ and never committed. Private evaluation only."""
    name = 'flx'
    restricted = True

    def __init__(self, source: Path | None = None, weights: Path | None = None, h_sign: float = 1.0):
        import sys  # noqa: PLC0415
        import tensorflow as tf  # noqa: PLC0415
        self.source = Path(source or EVAL_DIR / 'flx-src')
        self.weights = Path(weights or EVAL_DIR / 'weights' / 'warping_model' / 'flx' / '12')
        if str(self.source) not in sys.path:
            sys.path.insert(0, str(self.source))
        from tf_models.gaze_corrector_v1 import gaze_warp_model as gwm  # noqa: PLC0415
        tf.compat.v1.disable_eager_execution()
        self.tf, self.h_sign, self.sessions = tf, h_sign, {}
        cfg = gwm.ModelConfig(height=PATCH_H, width=PATCH_W, encoded_angle_dim=16)
        for side in ('L', 'R'):
            # The graph exactly as WangWilly's _load_models builds it, so the checkpoint's names match.
            graph = tf.Graph()
            with graph.as_default():
                with tf.name_scope('inputs'):
                    img = tf.compat.v1.placeholder(tf.float32, [None, PATCH_H, PATCH_W, 3])
                    fp = tf.compat.v1.placeholder(tf.float32, [None, PATCH_H, PATCH_W, 12])
                    ang = tf.compat.v1.placeholder(tf.float32, [None, 2])
                _pred, raw_flow, lcm = gwm.build_inference_graph(img, fp, ang, False, cfg)
                sess = tf.compat.v1.Session(graph=graph)
                ckpt = self.weights / side / side      # L/L.index, L/L.data-*: the prefix is the side's own name
                if not Path(str(ckpt) + '.index').is_file():
                    raise RuntimeError(f'flx: no checkpoint at {ckpt} (weights from the v0.1.1 release)')
                # A missing or misnamed variable raises here: never the silent pass-through WangWilly's app allows.
                tf.compat.v1.train.Saver(tf.compat.v1.global_variables()).restore(sess, str(ckpt))
            self.sessions[side] = (sess, img, fp, ang, raw_flow, lcm, graph)

    def correct(self, items):
        import numpy as np  # noqa: PLC0415
        out = []
        for side, patch, anchors, angle in items:
            sess, img, fp, ang, raw_flow, lcm, _graph = self.sessions[side]
            # The model moves an eye a little even when asked for 0 degrees (about 0.02 of the patch, 2 px at 1080
            # wide). Only the difference from its own 0-degree answer is used, so a small angle is a small move and
            # 0 is no move at all.
            x = patch[None].astype(np.float32) / 255.0
            flow, light = sess.run([raw_flow, lcm], {img: np.repeat(x, 2, 0), fp: np.repeat(anchors[None], 2, 0),
                                                     ang: np.array([[angle[0], angle[1] * self.h_sign], [0, 0]], np.float32)})
            moved = np.tanh(flow[0]) - np.tanh(flow[1])
            white = np.clip(light[0, :, :, 1] - light[1, :, :, 1], 0, 1)
            out.append((moved.astype(np.float32), white.astype(np.float32)))
        return out


BACKENDS = {'identity': Identity, 'flx': Flx, 'maxine': Maxine}


# ------------------------------------------------------------------ decide (pure numpy)

def smooth(values, sigma: float = SMOOTH_SIGMA, valid=None):
    """Gaussian smoothing over frames, ignoring frames that are not valid (no face); invalid frames stay as they are."""
    import numpy as np  # noqa: PLC0415
    x = np.asarray(values, dtype=np.float64)
    ok = np.ones(len(x), bool) if valid is None else np.asarray(valid, bool)
    if sigma <= 0 or not len(x):
        return x.copy()
    radius = max(1, int(math.ceil(3 * sigma)))
    kernel = np.exp(-0.5 * (np.arange(-radius, radius + 1) / sigma) ** 2)
    shape = (len(x),) + (1,) * (x.ndim - 1)
    w = ok.astype(np.float64).reshape(shape)
    filled = np.where(w > 0, x, 0.0)
    num = np.apply_along_axis(lambda v: np.convolve(v, kernel, 'same'), 0, filled)
    den = np.apply_along_axis(lambda v: np.convolve(v, kernel, 'same'), 0, np.broadcast_to(w, x.shape).astype(np.float64))
    out = x.copy()
    good = (den > 1e-9) & (w > 0)
    out[good] = num[good] / den[good]
    return out


def ramp(target, frames: int = RAMP_FRAMES):
    """Strength never jumps: no two neighbouring frames differ by more than 1/frames. It rises only as fast as that
    after a correction starts, and it eases out before a blink, a turned head or a lost face, so it is exactly 0 on
    every frame whose target is 0. Both passes only ever lower a value, so a 0 stays 0."""
    import numpy as np  # noqa: PLC0415
    out = np.clip(np.asarray(target, dtype=np.float64), 0, 1).copy()
    step = 1.0 / max(1, frames)
    for i in range(1, len(out)):
        out[i] = min(out[i], out[i - 1] + step)
    for i in range(len(out) - 2, -1, -1):
        out[i] = min(out[i], out[i + 1] + step)
    return out


def eye_angles(eye: list, iris: tuple) -> tuple[float, float]:
    """Where the iris sits in the eye, in degrees (vertical up positive, horizontal toward image right positive): the
    iris offset from the eye's centre over the eyeball's radius, on the eye's own axis."""
    (ox, oy), (ix, iy) = eye[0], eye[3]
    ax, ay = ix - ox, iy - oy
    width = math.hypot(ax, ay) or 1e-6
    ux, uy = ax / width, ay / width
    if ux < 0:
        ux, uy = -ux, -uy
    vx, vy = -uy, ux
    cx = (ox + ix) / 2
    cy = (eye[1][1] + eye[2][1] + eye[4][1] + eye[5][1]) / 4 if len(eye) >= 6 else (oy + iy) / 2
    dx, dy = iris[0] - cx, iris[1] - cy
    along, across = dx * ux + dy * uy, dx * vx + dy * vy
    radius = EYEBALL * width
    h = math.degrees(math.asin(max(-1.0, min(1.0, along / radius))))
    v = -math.degrees(math.asin(max(-1.0, min(1.0, across / radius))))
    return v, h


def plan(readings: list[dict], lock: bool = False) -> list[dict]:
    """Per frame and eye: the correction angle and strength, from pass 1's readings. Pure.

    lock: the backend locks gaze to the lens itself (Maxine), so every open, frontal frame takes it at full strength.
    His median is not the lens on a teleprompter take: his eyes sweep about 7 deg as he reads (5 Nov 2026, run
    42093095843: Maxine cut that spread from 7.0 to 2.9 deg), so "near his median" must not mean "leave alone"."""
    import numpy as np  # noqa: PLC0415
    n = len(readings)
    face = np.array([bool(r.get('face')) for r in readings])
    out = [{'face': bool(face[i]), 'strength': 0.0, 'why': 'no face' if not face[i] else '', 'eyes': {}} for i in range(n)]
    if not face.any():
        return out
    yaw = np.array([r.get('yaw', 0.0) if r.get('face') else np.nan for r in readings])
    pitch = np.array([r.get('pitch', 0.0) if r.get('face') else np.nan for r in readings])
    turned = (np.abs(yaw - np.nanmedian(yaw)) > HEAD_TURN_DEG) | (np.abs(pitch - np.nanmedian(pitch)) > HEAD_TURN_DEG)
    for side in ('L', 'R'):
        pts = np.array([r['eyes'][side] if r.get('face') else [[0, 0]] * 6 for r in readings], dtype=np.float64)
        iris = np.array([r['iris'][side] if r.get('face') else [0, 0] for r in readings], dtype=np.float64)
        sm_pts = smooth(pts, SMOOTH_SIGMA / 2, face)
        has_contour = all('contour' in r for r in readings if r.get('face'))
        if has_contour:
            con = np.array([r['contour'][side] if r.get('face') else [[0, 0]] * 16 for r in readings], dtype=np.float64)
            sm_con = smooth(con, SMOOTH_SIGMA / 2, face)
        raw = np.array([eye_angles(pts[i].tolist(), iris[i].tolist()) if face[i] else (np.nan, np.nan) for i in range(n)])
        med = np.nanmedian(raw, axis=0)
        off = smooth(np.where(face[:, None], raw - med, 0.0), SMOOTH_SIGMA, face)
        width = np.hypot(*(pts[:, 3] - pts[:, 0]).T)
        gap = (np.hypot(*(pts[:, 1] - pts[:, 5]).T) + np.hypot(*(pts[:, 2] - pts[:, 4]).T)) / 2
        openness = np.where(width > 0, gap / np.maximum(width, 1e-6), 0)
        for i in range(n):
            if face[i]:
                out[i]['eyes'][side] = {'points': sm_pts[i].tolist(), 'off': [round(float(off[i, 0]), 2), round(float(off[i, 1]), 2)],
                                        'open': round(float(openness[i]), 3)}
                if has_contour:
                    out[i]['eyes'][side]['contour'] = sm_con[i].tolist()
    opens = [min(e['open'] for e in out[i]['eyes'].values()) for i in range(n) if out[i]['eyes']]
    closing = max(OPEN_MIN, OPEN_REL * float(np.median(opens))) if opens else OPEN_MIN
    target = np.zeros(n)
    for i in range(n):
        if not face[i]:
            continue
        r = readings[i]
        eyes = out[i]['eyes']
        size = max(max(abs(a) for a in e['off']) for e in eyes.values())
        if lock and not turned[i] and not r.get('edge'):
            target[i] = 1.0                           # Maxine handles blinks itself (detect_closure); a gap here splits one
            out[i]['why'] = 'locked to the lens'      # blink into two (run 42103122907: 3 blinks became 4)
        elif r.get('blink', 0) >= BLINK or min(e['open'] for e in eyes.values()) < closing:
            out[i]['why'] = 'blink'
        elif turned[i]:
            out[i]['why'] = 'head turned'
        elif r.get('edge'):
            out[i]['why'] = 'eye at the frame edge'
        elif lock:
            target[i] = 1.0
            out[i]['why'] = 'locked to the lens'
        elif size <= ON_LENS_DEG:
            out[i]['why'] = 'on the lens'
        else:
            target[i] = min(1.0, (size - ON_LENS_DEG) / (FULL_DEG - ON_LENS_DEG))
            out[i]['why'] = 'off the lens'
    strength = ramp(target)
    for i in range(n):
        out[i]['strength'] = round(float(strength[i]), 3)
        for e in out[i]['eyes'].values():
            # Redirect toward the lens: the opposite of how far off it is, never past MAX_DEG, scaled by strength.
            e['angle'] = [round(float(max(-MAX_DEG, min(MAX_DEG, -a))) * float(strength[i]), 2) for a in e['off']]
    return out


# ------------------------------------------------------------------ geometry (OpenCV)

def eye_frame(points) -> dict:
    """The eye patch's place in the frame, aligned to the eye's own axis (his head's roll): WangWilly's box, 1.5 eye
    widths across and 1.125 high, its centre a twelfth of its height below the eye's centre."""
    import numpy as np  # noqa: PLC0415
    p = np.asarray(points, dtype=np.float64)
    a, b = (p[0], p[3]) if p[0][0] <= p[3][0] else (p[3], p[0])
    axis = b - a
    length = float(np.hypot(*axis)) or 1e-6
    u = axis / length
    v = np.array([-u[1], u[0]])
    centre = p.mean(axis=0)
    w, h = 1.5 * length, 1.125 * length
    middle = centre + v * (h / 12)
    origin = middle - u * (w / 2) - v * (h / 2)
    return {'u': u, 'v': v, 'origin': origin, 'w': w, 'h': h, 'length': length}


def _to_patch(geo, xs, ys):
    """Frame pixel centres to patch pixel coordinates (0..PATCH_W, 0..PATCH_H)."""
    dx, dy = xs - geo['origin'][0], ys - geo['origin'][1]
    pu = (dx * geo['u'][0] + dy * geo['u'][1]) / geo['w'] * PATCH_W
    pv = (dx * geo['v'][0] + dy * geo['v'][1]) / geo['h'] * PATCH_H
    return pu, pv


def bbox(geo, shape) -> tuple[int, int, int, int] | None:
    import numpy as np  # noqa: PLC0415
    corners = [geo['origin'] + geo['u'] * geo['w'] * a + geo['v'] * geo['h'] * b for a in (0, 1) for b in (0, 1)]
    c = np.array(corners)
    x0, y0 = int(math.floor(c[:, 0].min())) - 1, int(math.floor(c[:, 1].min())) - 1
    x1, y1 = int(math.ceil(c[:, 0].max())) + 2, int(math.ceil(c[:, 1].max())) + 2
    if x0 < 0 or y0 < 0 or x1 > shape[1] or y1 > shape[0]:
        return None
    return x0, y0, x1, y1


def patch_of(frame, geo):
    """The 64x48 eye patch, area-averaged from the full-resolution eye."""
    import cv2  # noqa: PLC0415
    import numpy as np  # noqa: PLC0415
    sx, sy = geo['w'] / PATCH_W, geo['h'] / PATCH_H
    u, v, o = geo['u'], geo['v'], geo['origin']
    # Patch pixel centre (x, y) to frame pixel index: origin + u*(x+0.5)*sx + v*(y+0.5)*sy - 0.5.
    m = np.array([[u[0] * sx, v[0] * sy, o[0] + 0.5 * (u[0] * sx + v[0] * sy) - 0.5],
                  [u[1] * sx, v[1] * sy, o[1] + 0.5 * (u[1] * sx + v[1] * sy) - 0.5]])
    scale = max(sx, sy)
    sigma = max(0.0, 0.5 * (scale - 1))
    src = cv2.GaussianBlur(frame, (0, 0), sigma) if sigma > 0.3 else frame
    return cv2.warpAffine(src, m, (PATCH_W, PATCH_H), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP,
                          borderMode=cv2.BORDER_REPLICATE)


def anchors_of(points, side: str, geo):
    """WangWilly's 12-channel anchor map: for each of the six eye points in his order, x and y distance planes."""
    import numpy as np  # noqa: PLC0415
    p = np.asarray(points, dtype=np.float64)
    pu, pv = _to_patch(geo, p[:, 0], p[:, 1])
    planes = []
    for k in FP_SEQ[side]:
        rx, ry = int(pu[k]), int(pv[k])
        planes.append(np.tile(np.arange(PATCH_W)[None, :] - rx, (PATCH_H, 1)))
        planes.append(np.tile(np.arange(PATCH_H)[:, None] - ry, (1, PATCH_W)))
    return np.stack(planes, axis=2).astype(np.float32)


def mask_of(pu, pv):
    """A feathered ellipse over the eye in patch coordinates: 1 inside, easing to 0 by the patch's inner edge."""
    import numpy as np  # noqa: PLC0415
    r = np.sqrt(((pu - PATCH_W / 2) / (PATCH_W * 0.46)) ** 2 + ((pv - PATCH_H * 0.5) / (PATCH_H * 0.46)) ** 2)
    t = np.clip((1.0 - r) / 0.35, 0.0, 1.0)
    return t * t * (3 - 2 * t)


def blend(frame, source, geo, strength: float):
    """His eye from `source` (a frame another model redirected) laid onto `frame` inside the feathered ellipse, at
    `strength`. Pixels outside the mask are untouched; strength 0 returns the frame itself."""
    import numpy as np  # noqa: PLC0415
    box = bbox(geo, frame.shape)
    if box is None or strength <= 0:
        return frame
    x0, y0, x1, y1 = box
    ys, xs = np.mgrid[y0:y1, x0:x1].astype(np.float32) + 0.5
    pu, pv = _to_patch(geo, xs, ys)
    alpha = (mask_of(pu, pv) * float(strength))[..., None]
    region = frame[y0:y1, x0:x1].astype(np.float32)
    other = source[y0:y1, x0:x1].astype(np.float32)
    out = frame.copy()
    out[y0:y1, x0:x1] = np.clip(np.rint(region * (1 - alpha) + other * alpha), 0, 255).astype(np.uint8)
    return out


def _eye_axes(eye):
    import numpy as np  # noqa: PLC0415
    p = np.asarray(eye, dtype=np.float64)
    a, b = (p[0], p[3]) if p[0][0] <= p[3][0] else (p[3], p[0])
    width = float(np.hypot(*(b - a))) or 1e-6
    u = (b - a) / width
    v = np.array([-u[1], u[0]])
    centre = (p[0] + p[3]) / 2
    return centre, u, v, width


def aims(readings: list[dict], there: list[dict], decided: list[dict]) -> list[dict]:
    """Where each iris should be, per frame: Maxine's lock point, calibrated once per eye in that eye's own geometry
    (the median over the take of where Maxine put the iris, along and across the eye, in eye widths), laid on his eye
    in each frame, plus AIM_KEEP of his own movement about his own median, at most AIM_MAX of the eye's width away.
    Maxine on its own corrects a hard glance only partway (it fades out past 20 deg) and the two eyes can disagree
    (blind review, 5 Nov, 5.50 s); the calibrated aim corrects it fully and keeps both eyes on one point."""
    import numpy as np  # noqa: PLC0415
    out = [dict() for _ in readings]
    for side in IRIS:
        mine, maxi = [], []
        for i, (r, t) in enumerate(zip(readings, there)):
            if r.get('face') and t.get('face') and decided[i]['strength'] > 0:
                c, u, v, w = _eye_axes(r['eyes'][side])
                for rows, keep in ((r, mine), (t, maxi)):
                    d = np.asarray(rows['iris'][side]) - c
                    keep.append((d @ u / w, d @ v / w))
        if len(maxi) < 5:
            continue
        lens, own = np.median(np.array(maxi), 0), np.median(np.array(mine), 0)
        for i, r in enumerate(readings):
            if not r.get('face') or 'iris_r' not in r:
                continue
            if decided[i]['eyes'].get(side, {}).get('open', 1) < OPEN_MIN:
                continue
            if r.get('blink', 0) >= BLINK * 0.8:
                # A closing eye keeps its own iris (moving it split a blink); a steady half-lid (a downcast look, a smile)
                # is not a blink: its score barely moves over six frames, and it is below the blink line.
                near = [readings[k].get('blink', 0) for k in (max(0, i - 3), min(len(readings) - 1, i + 3)) if readings[k].get('face')]
                if r.get('blink', 0) >= BLINK * 0.96 or len(near) < 2 or abs(near[1] - near[0]) > 0.12:
                    continue
            c, u, v, w = _eye_axes(r['eyes'][side])
            d = np.asarray(r['iris'][side]) - c
            here = np.array((d @ u / w, d @ v / w))
            want = lens + AIM_KEEP * (here - own)
            step = (want - here) * np.array([AIM_GAIN, 1.0])
            size = float(np.hypot(*step))
            if size > AIM_MAX:
                step *= AIM_MAX / size
            target = np.asarray(r['iris'][side]) + w * (step[0] * u + step[1] * v)
            out[i][side] = (float(target[0]), float(target[1]), r['iris_r'][side])
    return out


def iris_templates(media, readings: list[dict], info: dict, size: int = 48, every: int = 3, cap: int = 160) -> dict:
    """One clean iris per eye, from his own frames where he looks at the lens: the median, over up to `cap` open,
    frontal frames whose eye sits at his median gaze, of the iris disc (1.25 landmarker radii each way) resampled to
    size x size, with his iris radius as a share of his eye width there. A hard glance puts the real iris in the corner under the lid, where the landmarker's circle is
    unreliable and any cut-out of it is ragged (blind review, 6 Nov: smeared irises at 5.57 s and 51.67 s); this one
    is clean and his own. {side: (float32 BGR size x size patch, iris radius / eye width) or None}."""
    import cv2  # noqa: PLC0415
    import numpy as np  # noqa: PLC0415
    face = [bool(r.get('face')) for r in readings]
    if not any(face):
        return {'R': None, 'L': None}
    ang, opn = {}, {}
    for side in IRIS:
        a = np.array([eye_angles(r['eyes'][side], r['iris'][side]) if f else (np.nan, np.nan) for r, f in zip(readings, face)])
        o = np.array([(math.hypot(r['eyes'][side][1][0] - r['eyes'][side][5][0], r['eyes'][side][1][1] - r['eyes'][side][5][1]) +
                       math.hypot(r['eyes'][side][2][0] - r['eyes'][side][4][0], r['eyes'][side][2][1] - r['eyes'][side][4][1])) / 2 /
                      max(1e-6, math.hypot(r['eyes'][side][3][0] - r['eyes'][side][0][0], r['eyes'][side][3][1] - r['eyes'][side][0][1]))
                      if f else np.nan for r, f in zip(readings, face)])
        ang[side], opn[side] = a - np.nanmedian(a, axis=0), o
    yaw = np.array([r.get('yaw', np.nan) if f else np.nan for r, f in zip(readings, face)])
    ok = {}
    for side in IRIS:
        good = [i for i in range(0, len(readings), every)
                if face[i] and readings[i].get('blink', 1) < 0.15 and not readings[i].get('edge')
                and abs(yaw[i] - np.nanmedian(yaw)) < 6 and np.hypot(*ang[side][i]) < 2.5
                and opn[side][i] >= 0.9 * np.nanmedian(opn[side]) and 'iris_r' in readings[i]]
        if len(good) > cap:
            good = [good[int(k)] for k in np.linspace(0, len(good) - 1, cap)]
        ok[side] = set(good)
    stacks = {side: [] for side in IRIS}
    wanted = set().union(*ok.values())
    if not wanted:
        return {'R': None, 'L': None}
    for index, frame in enumerate(frames(media, info['width'], info['height'])):
        if index not in wanted:
            continue
        for side in IRIS:
            if index in ok[side]:
                r = readings[index]
                (cx, cy), rad = r['iris'][side], max(2.0, r['iris_r'][side])
                sc = size / (2.5 * rad)
                m = np.float32([[sc, 0, size / 2 - sc * cx], [0, sc, size / 2 - sc * cy]])
                patch = cv2.warpAffine(frame, m, (size, size), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
                # Align on the iris's own dark centroid: the landmarker's centre jitters a pixel or two, and a median of
                # misaligned irises is a soft, pale one.
                grey = cv2.cvtColor(patch, cv2.COLOR_BGR2GRAY).astype(np.float32)
                yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
                disc = np.hypot(xx - size / 2, yy - size / 2) < size * 0.32
                dark = disc & (grey <= np.percentile(grey[disc], 40))
                if dark.sum() > 20:
                    dx, dy = size / 2 - float(xx[dark].mean()), size / 2 - float(yy[dark].mean())
                    if math.hypot(dx, dy) <= 4:
                        patch = cv2.warpAffine(patch, np.float32([[1, 0, dx], [0, 1, dy]]), (size, size), flags=cv2.INTER_CUBIC,
                                               borderMode=cv2.BORDER_REPLICATE)
                stacks[side].append(patch)
    out, med, glint, ratio = {}, {}, {}, {}
    for side in IRIS:
        if len(stacks[side]) < 8:
            continue
        ratio[side] = float(np.median([readings[i]['iris_r'][side] / max(1e-6, math.hypot(readings[i]['eyes'][side][3][0] - readings[i]['eyes'][side][0][0],
                                                                                          readings[i]['eyes'][side][3][1] - readings[i]['eyes'][side][0][1]))
                                       for i in sorted(ok[side])]))
        stack = np.array(stacks[side], dtype=np.float32)
        med[side], hi = np.percentile(stack, 50, axis=0), np.percentile(stack, TEMPLATE_HI, axis=0)
        # A median of many frames averages his catchlights away and softens the texture: an iris with no light in it
        # reads as dead (blind review, 6 Nov: "flat", "a fixed glare"). Take the bright reflection back from the upper
        # part of the stack where it is clearly brighter than the median, and sharpen what the averaging softened.
        grey = lambda im: cv2.cvtColor(np.clip(im, 0, 255).astype(np.uint8), cv2.COLOR_BGR2GRAY).astype(np.float32)  # noqa: E731
        # Only a compact, genuinely bright highlight: the broad pale wash of a window across the iris is not a
        # catchlight, it greys the iris out (blind review, 6 Nov, cells 4, 6, 8, 9).
        spec = np.clip((grey(hi) - grey(med[side]) - 60) / 40, 0, 1) * np.clip((grey(hi) - 170) / 40, 0, 1)
        glint[side] = (cv2.GaussianBlur(spec, (0, 0), 0.8)[..., None], hi - med[side])
    if not med:
        return {'R': None, 'L': None}
    # One light, two eyes (his own crop, 6 Nov: a bright catchlight in one eye, none in the other, and irises of two
    # sizes read as bug-eyed). Both eyes take the stronger eye's catchlight, and both the same iris size, never above
    # the mean of his two (0.223 and 0.212 of the eye width on this take): his own size, not one eye bigger.
    lead = max(glint, key=lambda s: float(glint[s][0].sum()))
    size_share = float(np.mean(list(ratio.values())))
    # And one iris colour: the viewer's-right template came out pale grey-blue beside the other (blind review, 6 Nov,
    # cells 4, 8, 9: "a different eye"). Both take the darker one's colour, as a shift in Lab over the iris disc.
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    disc = np.hypot(xx - size / 2, yy - size / 2) < size * 0.2
    lab = {s: cv2.cvtColor(np.clip(med[s], 0, 255).astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32) for s in med}
    mean = {s: lab[s][disc].mean(0) for s in med}
    dark = min(mean, key=lambda s: float(mean[s][0]))
    for s in med:
        if s != dark:
            shifted = lab[s] + (mean[dark] - mean[s])
            med[s] = cv2.cvtColor(np.clip(shifted, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR).astype(np.float32)
    for side in IRIS:
        if side not in med:
            out[side] = None
            continue
        spec, delta = glint[lead]
        patch = med[side] + delta * spec
        patch = np.clip(patch + TEMPLATE_SHARP * (patch - cv2.GaussianBlur(patch, (0, 0), 1.6)), 0, 255)
        out[side] = (patch, size_share)
    return out


def lid_cover(contour, iris_xy, rad: float) -> float:
    """How much of the iris's height his upper lid covers, at the iris's x: 0 when the lid just touches its top, 0.15
    when it hides the top 15%, negative when white shows above it."""
    import numpy as np  # noqa: PLC0415
    c = np.asarray(contour, dtype=np.float64)
    up = np.array([c[0], *c[9:16], c[8]])
    up = up[np.argsort(up[:, 0])]
    return float((np.interp(iris_xy[0], up[:, 0], up[:, 1]) - (iris_xy[1] - rad)) / (2 * rad))


def look_flags(readings: list[dict], decided: list[dict]) -> list[float]:
    """1.0 on frames where he is looking up or down (left alone), 0.0 elsewhere, eased over a few frames. Looking up
    shows white under the iris (the lower lid covers none of it, where at the lens it covers a little); looking down or
    squinting has the upper lid over a third of it (at the lens, about 15%). The landmarker's iris and lid line are
    unreliable there, and every blind review (6 Nov, passes 9 to 13) found those frames corrected badly: a flat black
    iris against the lid, a pale grey one beside it, eyes that disagree. A look up while thinking is natural."""
    import numpy as np  # noqa: PLC0415
    n = len(readings)
    flag = np.zeros(n)
    for i, r in enumerate(readings):
        if not r.get('face') or 'iris_r' not in r or r.get('blink', 0) >= BLINK:
            continue
        up, low = [], []
        for side in IRIS:
            con = decided[i]['eyes'].get(side, {}).get('contour') if i < len(decided) else None
            if con is None:
                break
            c = np.asarray(con)
            lo = np.array([c[0], *c[1:8], c[8]])
            lo = lo[np.argsort(lo[:, 0])]
            (ix, iy), rad = r['iris'][side], r['iris_r'][side]
            up.append(lid_cover(c, (ix, iy), rad))
            low.append(((iy + rad) - float(np.interp(ix, lo[:, 0], lo[:, 1]))) / (2 * rad))
        else:
            # Both eyes, not either: a sideways glance can show white under one iris as it crosses the lid's curve.
            flag[i] = float(max(low) < LOOK_UP or min(up) > LOOK_DOWN)
    # A look up or down lasts and is noisy frame to frame; a blip in a sideways glance is neither: it needs a good share
    # of the frames around it flagged too.
    flag = (np.convolve(flag, np.ones(LOOK_MIN) / LOOK_MIN, 'same') >= 0.4).astype(float)
    wide = np.convolve(flag, np.ones(2 * LOOK_PAD + 1), 'same') > 0          # a couple of frames either side, so it never flickers
    return [float(x) for x in np.convolve(wide.astype(float), np.ones(3) / 3, "same")]


def lids(readings: list[dict], decided: list[dict], aimed: list[dict] | None = None) -> list[dict]:
    """How far to lower each upper lid, in pixels, per frame and eye. A hard sideways glance leaves his lids wider
    than when he looks at the lens (5.57 s: 1.18 to 1.23 of his usual opening), so a centred iris sits in a startled
    stare (every blind review, 6 Nov). His usual opening is the median over his open, frontal frames at his median
    gaze; the lid takes back LID_SHARE of what the frame has over it, capped, smoothed over time."""
    import numpy as np  # noqa: PLC0415
    out = [dict() for _ in readings]
    n = len(readings)
    for side in IRIS:
        ew, gap, ok, off = np.zeros(n), np.zeros(n), np.zeros(n, bool), np.full(n, np.inf)
        raw = np.array([eye_angles(r['eyes'][side], r['iris'][side]) if r.get('face') else (np.nan, np.nan) for r in readings])
        med = np.nanmedian(raw, axis=0)
        for i, r in enumerate(readings):
            con = decided[i]['eyes'].get(side, {}).get('contour') if r.get('face') else None
            if con is None:
                continue
            c = np.asarray(con)
            ew[i] = float(np.hypot(*(c[8] - c[0]))) or 1e-6
            gap[i] = float(np.hypot(*(c[12] - c[4])))
            ok[i] = True
            off[i] = float(np.hypot(*(raw[i] - med)))
        rel = np.where(ok, gap / np.maximum(ew, 1e-6), np.nan)
        base = [i for i in range(n) if ok[i] and off[i] < 2.5 and readings[i].get('blink', 1) < 0.15 and not readings[i].get('edge')]
        if len(base) < 8:
            continue
        usual = float(np.median(rel[base]))
        d = np.where(ok, np.clip((rel - usual) * ew * LID_SHARE, 0, LID_MAX * ew), 0.0)
        if aimed is not None:
            # Where the iris is put, his upper lid should cover as much of it as it does when he looks at the lens (about
            # 15% of its height): a full round iris with white above it is a stare even when the opening is his own
            # (blind review, 6 Nov, cells 1, 3, 4; his lens frames against a corrected 5.57 s).
            natural = float(np.median([lid_cover(decided[i]['eyes'][side]['contour'], readings[i]['iris'][side], readings[i]['iris_r'][side])
                                       for i in base]))
            for i in range(n):
                if ok[i] and side in aimed[i]:
                    need = (natural - lid_cover(decided[i]['eyes'][side]['contour'], aimed[i][side][:2], readings[i]['iris_r'][side])) * 2 * readings[i]['iris_r'][side]
                    d[i] = max(d[i], float(np.clip(need, 0, LID_MAX * ew[i])))
        d = smooth(d, LID_BLUR, ok)
        for i in range(n):
            if ok[i]:
                out[i][side] = float(max(0.0, d[i]))
    return out


def lower_lid(region, contour, offset, drop: float):
    """Bring his own upper lid down by `drop` pixels over the eye: the skin above the lid line, and the lash band with
    it, moves down; what is under it stays; the opening gets smaller as his does when he looks at the lens. `region` is
    a BGR crop whose top-left is at `offset` in the frame, `contour` the 16 lid points in frame pixels. Sub-pixel."""
    import cv2  # noqa: PLC0415
    import numpy as np  # noqa: PLC0415
    if drop < 0.25:
        return region
    c = np.asarray(contour, dtype=np.float64) - np.asarray(offset, dtype=np.float64)
    ew = float(np.hypot(*(c[8] - c[0]))) or 1.0
    upper = np.array([c[0], *c[9:16], c[8]])
    upper = upper[np.argsort(upper[:, 0])]
    h, w = region.shape[:2]
    xs = np.arange(w, dtype=np.float64)
    yu = np.interp(xs, upper[:, 0], upper[:, 1])
    xa, xb = float(min(c[0][0], c[8][0])), float(max(c[0][0], c[8][0]))
    t = np.clip((xs - xa) / max(1e-6, xb - xa), 0, 1)
    wx = np.sin(np.pi * t) ** 0.8                                    # 1 mid-eye, 0 at the corners
    lash = 0.07 * ew
    yy = np.arange(h, dtype=np.float64)[:, None]
    bottom = yu[None, :] + drop + lash                               # where the lowered lash band ends
    above = np.clip(1 - np.maximum(0.0, (yu[None, :] - 0.15 * ew) - yy) / (0.9 * ew), 0, 1)   # fades out up the brow
    below = np.clip((bottom - yy) / 2.0, 0, 1)                      # a 2 px edge, not a cliff
    d = drop * wx[None, :] * above * below
    mapy = (yy - d).astype(np.float32)
    mapx = np.tile(xs.astype(np.float32), (h, 1))
    return cv2.remap(region, mapx, mapy, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def iris_mask(light, inside, d_here, r):
    """His iris as it really is in this frame: inside his opening, near the landmarker's iris, the pixels darker than
    the sclera around them (Otsu on lightness), the one blob at the iris, its holes (the catchlight) filled. A circle
    from the landmarker's centre and radius is a few pixels off: it carried a pale sclera rim and dropped the dark
    outer iris (blind review, 5 Nov). Falls back to that circle when the segment is not iris-shaped."""
    import cv2  # noqa: PLC0415
    import numpy as np  # noqa: PLC0415
    near = inside & (d_here < 1.5)
    circle = inside & (d_here < 1.0)
    vals = light[near]
    if vals.size < 20:
        return circle
    t = cv2.threshold(np.clip(vals, 0, 255).astype(np.uint8).reshape(-1, 1), 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[0]
    dark = (near & (light < t)).astype(np.uint8)
    dark = cv2.morphologyEx(dark, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    n, labels = cv2.connectedComponents(dark)
    if n < 2:
        return circle
    centre = np.unravel_index(np.argmin(np.where(near, d_here, 9)), d_here.shape)
    pick = labels[centre] or (1 + int(np.argmax([(labels == k).sum() for k in range(1, n)])))
    blob = (labels == pick).astype(np.uint8)
    filled = blob.copy()
    contours, _ = cv2.findContours(blob, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(filled, contours, -1, 1, -1)              # the catchlight is part of the iris
    area, disc = filled.sum(), math.pi * r * r
    if not (0.25 * disc <= area <= 1.8 * disc):
        return circle
    return (filled > 0) & inside & (d_here < 1.35)


def whole_iris(region, inside_soft, hx: float, hy: float, hr: float, grow: float = IRIS_GROW):
    """His iris from this frame, whole: (BGR float32 patch, alpha, share seen). The patch is square, centred on the iris
    at (hx, hy) in `region`'s pixels, radius hr. Where his lid or the eye's corner hides part of it (inside_soft under
    0.9), the hidden part is filled from the same iris mirrored across its own horizontal axis, then its vertical axis,
    then both (an iris is near enough round, and a lid hides top or bottom); what no mirror reaches takes the ring's
    median colour at that radius. A catchlight is kept where it is and never mirrored, so there is never a second one.
    Seen and filled pixels are mixed by how well each is seen, so there is no cut between them."""
    import cv2  # noqa: PLC0415
    import numpy as np  # noqa: PLC0415
    s = int(math.ceil(2 * (grow + 0.15) * max(1.0, hr))) + 2
    c = s / 2.0
    m = np.float32([[1, 0, hx - c], [0, 1, hy - c]])                          # patch pixel to region pixel
    patch = cv2.warpAffine(np.asarray(region, np.float32), m, (s, s), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP,
                           borderMode=cv2.BORDER_REPLICATE)
    vis = cv2.warpAffine(np.asarray(inside_soft, np.float32), m, (s, s), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP,
                         borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    yy, xx = np.mgrid[0:s, 0:s].astype(np.float32) + 0.5 - c                   # the iris centre is the patch's centre
    d = np.hypot(xx, yy) / max(1.0, hr)
    disc = d < grow + 0.1
    seen_w = np.clip((vis - 0.6) / 0.3, 0, 1) * disc
    share = float((seen_w > 0.5).sum()) / max(1.0, float((d < grow).sum()))
    grey = patch.mean(2)
    solid = seen_w > 0.5
    cap = float(np.percentile(grey[solid], 85)) if solid.sum() >= 8 else 255.0
    src_w = seen_w * (grey <= cap + 25)                                        # a catchlight is not copied
    fill, wsum = np.zeros_like(patch), np.zeros(grey.shape, np.float32)
    left = np.ones(grey.shape, np.float32)
    for flip in ((slice(None, None, -1), slice(None)), (slice(None), slice(None, None, -1)),
                 (slice(None, None, -1), slice(None, None, -1))):
        w = src_w[flip] * left
        fill += patch[flip] * w[..., None]
        wsum += w
        left = np.clip(left - src_w[flip], 0, 1)
    if src_w.sum() > 3:
        ring = np.clip((d * 8).astype(int), 0, 9)
        median = np.zeros_like(patch)
        for b in np.unique(ring):
            pool = (src_w > 0.5) & (ring == b)
            if pool.sum() < 3:
                pool = src_w > 0.5
            median[ring == b] = np.median(patch[pool], axis=0)
        fill += median * left[..., None]
        wsum += left
    fill = fill / np.maximum(wsum, 1e-4)[..., None]
    whole = patch * seen_w[..., None] + fill * (1 - seen_w[..., None])
    alpha = np.clip((grow + 0.08 - d) / 0.16, 0, 1).astype(np.float32)
    return whole.astype(np.float32), alpha, share


def blend_aperture(frame, source, contour, strength: float, iris_here=None, iris_there=None, template=None, lid: float = 0.0):
    """His eye from `source` laid onto `frame` only inside his own lid line (`contour`, 16 points, full-frame pixels),
    shrunk a little and feathered, so his lids, lashes and skin stay his. Inside, the source's colour is matched to
    the original eye's and the detail it lost to re-rendering is put back (at most DETAIL_MAX). Strength 0 returns
    the frame itself."""
    import cv2  # noqa: PLC0415
    import numpy as np  # noqa: PLC0415
    if strength <= 0:
        return frame
    c = np.asarray(contour, dtype=np.float64)
    width = float(np.hypot(*(c.max(0) - c.min(0)))) or 1.0
    pad = int(math.ceil(0.3 * width)) + 2
    x0, y0 = int(math.floor(c[:, 0].min())) - pad, int(math.floor(c[:, 1].min())) - pad
    x1, y1 = int(math.ceil(c[:, 0].max())) + pad, int(math.ceil(c[:, 1].max())) + pad
    if x0 < 0 or y0 < 0 or x1 > frame.shape[1] or y1 > frame.shape[0]:
        return frame
    centre = c.mean(0)
    poly = centre + (c - centre) * APERTURE_SHRINK - [x0, y0]
    hard = np.zeros((y1 - y0, x1 - x0), np.uint8)
    cv2.fillPoly(hard, [np.round(poly * 16).astype(np.int32)], 1, lineType=cv2.LINE_AA, shift=4)
    if iris_here is not None:
        # The landmarker's lid line is the weak one in a look up or down (a thin sliver with the iris above it, or a line
        # through the iris: blind review, 6 Nov, 60.30 and 72.8 s); its iris circle fits. The iris where it is now is
        # inside his eye by definition, so the area edited includes it, and a half-iris is never cut at the lid line.
        cv2.circle(hard, (int(round(iris_here[0] - x0)), int(round(iris_here[1] - y0))), max(1, int(round(0.95 * iris_here[2]))), 1, -1)
    if hard.sum() < 6:
        return frame
    sigma = max(0.6, APERTURE_FEATHER * width)
    alpha = cv2.GaussianBlur(hard.astype(np.float32), (0, 0), sigma)
    alpha = np.clip(alpha, 0, 1) * float(strength)
    region = frame[y0:y1, x0:x1].astype(np.float32)
    other = source[y0:y1, x0:x1].astype(np.float32)
    inside = hard > 0
    inside_soft = np.clip(cv2.GaussianBlur(hard.astype(np.float32), (0, 0), 0.7) * 1.25, 0, 1)   # for clipping the iris to his lid
    lab_o = cv2.cvtColor(region.astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
    lab_s = cv2.cvtColor(other.astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
    lab_s += lab_o[inside].mean(0) - lab_s[inside].mean(0)            # same colour as his eye, iris moved or not
    # The iris itself, matched to his: Maxine re-draws a dark brown iris green-grey (5 Nov, 5.50 s). His iris (where
    # it was) and Maxine's (where it put it) come from the landmarker with their own radii; Maxine's iris pixels take
    # his iris's distribution channel by channel (histogram matching), inside a soft disk and his opening only.
    relocated = False
    gate = 1.0
    if iris_here is not None and iris_there is not None:
        (hx, hy, hr), (tx, ty, tr) = iris_here, iris_there
        ys, xs = np.mgrid[0:y1 - y0, 0:x1 - x0].astype(np.float32)
        d_here = np.hypot(xs - (hx - x0), ys - (hy - y0)) / max(1.0, hr)
        d_there = np.hypot(xs - (tx - x0), ys - (ty - y0)) / max(1.0, tr)
        src = inside & (d_here < 0.85)
        dst = inside & (d_there < 0.85)
        if src.sum() > 12 and dst.sum() > 12:
            w_there = np.clip((1.05 - d_there) / 0.2, 0, 1) * inside
            fixed = lab_s.copy()
            for ch in range(3):
                ref = np.sort(lab_o[..., ch][src])
                vals = lab_s[..., ch][dst]
                q = np.interp(np.linspace(0, 1, vals.size), np.linspace(0, 1, ref.size), ref)
                ranks = np.clip(np.searchsorted(np.sort(vals), lab_s[..., ch], side='left') / max(1, vals.size - 1), 0, 1)
                fixed[..., ch] = np.interp(ranks, np.linspace(0, 1, q.size), q)
            lab_s = lab_s * (1 - w_there[..., None]) + fixed * w_there[..., None]
            # Then his own eye, with only the iris moved to where Maxine aimed it. Maxine's own pixels (its iris drawn
            # dark brown where his reads grey, its sclera, its lower lids) are not used at all: the base is his eye
            # with the iris filled in from his own sclera, and his visible iris is laid at Maxine's position inside his
            # opening, so his lids still cover it (blind review, 5 Nov: halo and wrong-colour iris gave it away).
            ox, oy = tx - hx, ty - hy
            # A small move leaves his eye as it was: re-laying an iris that barely needed to move only greyed and softened
            # it and dulled the catchlight (blind review, 6 Nov, every near-lens frame). The correction fades in with the move.
            gate = float(np.clip((math.hypot(ox, oy) / max(1.0, hr) - GATE_FROM) / GATE_SPAN, 0.0, 1.0))
            if gate <= 0.0:
                return frame
            # The fade is a share of the move, not a cross-fade: an iris half-way between two pictures of itself is a
            # ghost, grey and doubled (blind review, 6 Nov, 60.30 s). The iris travels gate x the move, fully opaque.
            ox, oy, tx, ty, gate = ox * gate, oy * gate, hx + ox * gate, hy + oy * gate, 1.0
            region_u8 = np.clip(region, 0, 255).astype(np.uint8)
            # A clean iris, not a segmented one: the landmarker's circle (grown a hair), clipped by his own lid
            # contour. The segmented blob took ragged edges at a hard glance, where the iris sits in the lid's shadow
            # (blind review, 6 Nov: smeared, doubled iris at 5.57 s and 51.67 s). Its soft edge is the circle's.
            iris = (d_here < IRIS_GROW) & inside
            iris_f = np.clip((IRIS_GROW + 0.08 - d_here) / 0.16, 0, 1) * inside      # feathered, for the cut-out
            # What the old iris position becomes: his sclera, smoothly continued (normalised convolution over the
            # opening outside the iris), not an inpainted dark smear.
            keep = (inside & (d_here > IRIS_GROW + 0.12)).astype(np.float32)
            sig = max(1.5, 1.4 * hr)
            wsum = cv2.GaussianBlur(keep, (0, 0), sig) + 1e-4
            sclera = np.stack([cv2.GaussianBlur(region[..., c] * keep, (0, 0), sig) / wsum for c in range(3)], axis=2)
            hole_f = np.clip((IRIS_GROW + 0.30 - d_here) / 0.30, 0, 1)
            base = region * (1 - hole_f[..., None]) + sclera * hole_f[..., None]
            # His own iris from this very frame, with its own colour and catchlight, made whole where his lid hides it
            # (whole_iris), then laid at the aim and clipped by his lid there. The clean iris built from other frames
            # (iris_templates) is gone from this path: at 5.57 s his whole iris was in view and the template stood in
            # only because it travelled far, and that is the flat grey eye with a smeared catchlight the sixth blind
            # review failed (6 Nov). Moving a part-hidden iris as it was carried its lid cut with it (a jagged edge, a
            # pale ghost); the whole one does not.
            patch, palpha, _share = whole_iris(region, inside_soft, hx - x0, hy - y0, hr)
            half = patch.shape[0] / 2.0
            put = np.float32([[1, 0, (tx - x0) - half], [0, 1, (ty - y0) - half]])
            moved = cv2.warpAffine(patch, put, (x1 - x0, y1 - y0), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
            own = cv2.warpAffine(palpha, put, (x1 - x0, y1 - y0), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT,
                                 borderValue=0) * inside_soft
            eye = base * (1 - own[..., None]) + moved.astype(np.float32) * own[..., None]
            lab_s = cv2.cvtColor(np.clip(eye, 0, 255).astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
            relocated = True
    other = cv2.cvtColor(np.clip(lab_s, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR).astype(np.float32)
    k = max(0.8, 0.04 * width)
    hp_o = region - cv2.GaussianBlur(region, (0, 0), k)
    hp_s = other - cv2.GaussianBlur(other, (0, 0), k)
    gain = 1.0 if relocated else float(np.clip(np.sqrt((hp_o[inside] ** 2).mean() / max(1e-6, (hp_s[inside] ** 2).mean())), 1.0, DETAIL_MAX))
    other = other + (gain - 1.0) * hp_s
    a = (alpha * gate)[..., None]
    out = frame.copy()
    out[y0:y1, x0:x1] = np.clip(np.rint(region * (1 - a) + other * a), 0, 255).astype(np.uint8)
    if lid > 0 and gate > 0:
        out[y0:y1, x0:x1] = lower_lid(out[y0:y1, x0:x1], contour, (x0, y0), lid * gate)
    return out


def apply(frame, geo, flow, light):
    """Warp his eye at full resolution with the patch's flow and light, inside the feathered ellipse. One bicubic
    resample of the original frame; pixels outside the mask are untouched. Returns the changed frame."""
    import cv2  # noqa: PLC0415
    import numpy as np  # noqa: PLC0415
    box = bbox(geo, frame.shape)
    if box is None:
        return frame
    x0, y0, x1, y1 = box
    ys, xs = np.mgrid[y0:y1, x0:x1].astype(np.float32) + 0.5
    pu, pv = _to_patch(geo, xs, ys)
    mx, my = (pu - 0.5).astype(np.float32), (pv - 0.5).astype(np.float32)
    fx = cv2.remap(flow[:, :, 0], mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    fy = cv2.remap(flow[:, :, 1], mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    lw = cv2.remap(light, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    du, dv = fx * geo['w'] / 2, fy * geo['h'] / 2
    sx = xs + du * geo['u'][0] + dv * geo['v'][0] - 0.5
    sy = ys + du * geo['u'][1] + dv * geo['v'][1] - 0.5
    sampled = cv2.remap(frame, sx.astype(np.float32), sy.astype(np.float32), cv2.INTER_CUBIC,
                        borderMode=cv2.BORDER_REPLICATE).astype(np.float32)
    sampled = sampled * (1 - lw[..., None]) + 255.0 * lw[..., None]
    alpha = mask_of(pu, pv)[..., None]
    region = frame[y0:y1, x0:x1].astype(np.float32)
    out = frame.copy()
    out[y0:y1, x0:x1] = np.clip(np.rint(region * (1 - alpha) + sampled * alpha), 0, 255).astype(np.uint8)
    return out


# ------------------------------------------------------------------ media

def probe(media) -> dict:
    """The take's video stream as the pass needs it; refuses what it cannot keep exactly (check_stream)."""
    out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                          'stream=width,height,r_frame_rate,avg_frame_rate,pix_fmt,color_transfer,color_primaries,color_space:'
                          'stream_side_data=rotation', '-of', 'json', str(media)], capture_output=True, text=True, check=True)
    return check_stream(json.loads(out.stdout)['streams'][0], media)


def check_stream(s: dict, media='the take') -> dict:
    """The rules on a probed video stream: a constant frame rate (frames are decoded by index), SDR (the pass works
    on 8-bit frames), and the picture's size as shown, after any rotation."""
    rate = s['r_frame_rate']
    if rate != s.get('avg_frame_rate'):
        raise ValueError(f'{media}: variable frame rate ({rate} against {s.get("avg_frame_rate")}): make the constant-rate '
                         f'master first (the prepare_takes pattern), then correct that')
    if (s.get('color_transfer') or '') in ('smpte2084', 'arib-std-b67'):
        raise ValueError(f'{media}: HDR ({s["color_transfer"]}): the pass works on 8-bit SDR; tone-map first')
    rotation = next((int(d.get('rotation', 0)) for d in s.get('side_data_list', []) if 'rotation' in d), 0)
    w, h = int(s['width']), int(s['height'])
    if rotation % 180:
        w, h = h, w
    return {'width': w, 'height': h, 'rate': rate, 'rotation': rotation, 'pix_fmt': s.get('pix_fmt'),
            'colour': {k: s.get(k) for k in ('color_transfer', 'color_primaries', 'color_space')}}


# The colour round trip. Left to itself, ffmpeg's converter was used with its default matrix and rounding both ways
# (YUV to BGR to YUV), and a frame the pass never touched came back about a level darker and a touch warmer than it
# went in (6 Nov: luma -0.8 to -1.6 and chroma up to -1.0 on the raw planes; the blind review saw "warmer" on near-lens
# frames our code returns as decoded). The file's own matrix and range, named on both converters, with accurate
# rounding, bring that to 0.05 of a level, which is codec noise.
SWS = 'accurate_rnd+full_chroma_int'


def _matrix(space, height) -> str:
    return {'bt709': 'bt709', 'bt470bg': 'bt601', 'smpte170m': 'bt601', 'bt2020nc': 'bt2020', 'bt2020c': 'bt2020'}.get(
        space or '') or ('bt709' if int(height) >= 720 else 'bt601')


def source_colour(media) -> tuple[str, str]:
    """(matrix, range) of a file's video, from its own tags: bt709/bt601/bt2020 and tv/pc; HD untagged is bt709."""
    out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                          'stream=height,color_space,color_range', '-of', 'json', str(media)],
                         capture_output=True, text=True, check=True)
    st = json.loads(out.stdout)['streams'][0]
    return _matrix(st.get('color_space'), st.get('height') or 0), ('pc' if st.get('color_range') == 'pc' else 'tv')


def frames(media, width: int, height: int):
    """Decoded BGR frames, in order (ffmpeg applies any rotation), converted with the file's own matrix and range."""
    import numpy as np  # noqa: PLC0415
    size = width * height * 3
    matrix, rng = source_colour(media)
    proc = subprocess.Popen([ffmpeg(), '-v', 'error', '-i', str(media), '-map', '0:v:0', '-vf',
                             f'scale={width}:{height}:in_color_matrix={matrix}:in_range={rng}:flags={SWS}',
                             '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-'], stdout=subprocess.PIPE)
    try:
        while True:
            raw = proc.stdout.read(size)
            if len(raw) < size:
                break
            yield np.frombuffer(raw, np.uint8).reshape(height, width, 3)
    finally:
        proc.stdout.close()
        proc.wait()


def writer(media, out: Path, info: dict, crf: int = 12):
    matrix, rng = source_colour(media)
    colour = [arg for key, flag in (('color_primaries', '-color_primaries'), ('color_transfer', '-color_trc'),
                                    ('color_space', '-colorspace')) if info['colour'].get(key)
              for arg in (flag, info['colour'][key])]
    cmd = [ffmpeg(), '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{info["width"]}x{info["height"]}',
           '-framerate', info['rate'], '-i', '-', '-i', str(media), '-map', '0:v', '-map', '1:a?', '-c:a', 'copy',
           '-vf', f'scale=out_color_matrix={matrix}:out_range={rng}:flags={SWS}',
           '-c:v', 'libx264', '-preset', 'medium', '-crf', str(crf), '-pix_fmt', 'yuv420p', '-color_range', rng, *colour,
           '-movflags', '+faststart', str(out)]
    return subprocess.Popen(cmd, stdin=subprocess.PIPE)


def packet_times(media, stream: str = 'v:0') -> list[str]:
    out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', stream, '-show_entries', 'packet=pts_time',
                          '-of', 'csv=p=0', str(media)], capture_output=True, text=True, check=True).stdout
    return sorted((line.strip().rstrip(',') for line in out.splitlines() if line.strip()), key=float)


def audio_md5(media) -> str | None:
    out = subprocess.run([ffmpeg(), '-v', 'error', '-i', str(media), '-map', '0:a?', '-c', 'copy', '-f', 'md5', '-'],
                         capture_output=True, text=True)
    text = out.stdout.strip()
    return text.split('=', 1)[1] if text.startswith('MD5=') else None


def duration(media) -> float:
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(media)],
                         capture_output=True, text=True, check=True).stdout
    return float(out.strip())


def same_media(before, after) -> list[str]:
    """What differs between the take and its corrected copy, apart from the picture. Empty means identical."""
    problems = []
    a, b = packet_times(before), packet_times(after)
    if len(a) != len(b):
        problems.append(f'frame count changed: {len(a)} to {len(b)}')
    elif any(abs(float(x) - float(y)) > 0.0015 for x, y in zip(a, b)):
        problems.append('frame times changed')
    if audio_md5(before) != audio_md5(after):
        problems.append('audio changed (md5 of its packets)')
    if abs(duration(before) - duration(after)) > 0.05:
        problems.append(f'duration changed: {duration(before):.3f} s to {duration(after):.3f} s')
    return problems


# ------------------------------------------------------------------ pass 1: read

def read(media, info: dict, every: int = 1) -> list[dict]:
    """Every frame's eyes, irises, blink and head, from the pinned MediaPipe landmarker, in full-frame pixels."""
    import mediapipe as mp  # noqa: PLC0415
    from mediapipe.tasks.python import BaseOptions, vision  # noqa: PLC0415
    from . import faceflags  # noqa: PLC0415
    import numpy as np  # noqa: PLC0415
    w, h = info['width'], info['height']
    rw = min(READ_WIDTH, w)
    rh = int(round(h * rw / w / 2)) * 2
    num, den = (int(x) for x in info['rate'].split('/'))
    options = vision.FaceLandmarkerOptions(base_options=BaseOptions(model_asset_path=str(faceflags.model_path())),
                                           running_mode=vision.RunningMode.VIDEO, num_faces=1,
                                           output_face_blendshapes=True, output_facial_transformation_matrixes=True)
    out = []
    with vision.FaceLandmarker.create_from_options(options) as landmarker:
        for index, frame in enumerate(frames(media, rw, rh)):
            rgb = frame[:, :, ::-1].copy()
            found = landmarker.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb),
                                                int(round(index * 1000 * den / num)))
            if not found.face_landmarks:
                out.append({'face': False})
                continue
            lm = found.face_landmarks[0]
            px = lambda k: [lm[k].x * w, lm[k].y * h]  # noqa: E731
            shapes = {c.category_name: c.score for c in found.face_blendshapes[0]}
            yaw, pitch = faceflags._angles(found.facial_transformation_matrixes[0])  # noqa: SLF001
            row = {'face': True, 'eyes': {s: [px(k) for k in EYE_POINTS[s]] for s in EYE_POINTS},
                   'iris': {s: px(IRIS[s]) for s in IRIS},
                   'contour': {s: [px(k) for k in EYE_CONTOUR[s]] for s in EYE_CONTOUR},
                   'iris_r': {s: float(np.mean([math.hypot(px(k)[0] - px(IRIS[s])[0], px(k)[1] - px(IRIS[s])[1])
                                                for k in range(IRIS[s] + 1, IRIS[s] + 5)])) for s in IRIS},
                   'blink': round(max(shapes.get('eyeBlinkLeft', 0.0), shapes.get('eyeBlinkRight', 0.0)), 3),
                   'yaw': yaw, 'pitch': pitch}
            row['edge'] = any(bbox(eye_frame(row['eyes'][s]), (h, w)) is None for s in EYE_POINTS)
            out.append(row)
    return out


# ------------------------------------------------------------------ pass 2: correct and write

def run(media, out_dir: Path, backend: Backend, *, readings: list[dict] | None = None, copy_readings: list[dict] | None = None,
        qc=None, crf: int = 12) -> dict:
    """Correct one take; return the receipt. The corrected file is out_dir/<stem>.eyeline.mp4. `readings` and
    `copy_readings` are what read() would find on the take and on the backend's copy; given, they are used as they are
    (the tests give both, so they need no face model)."""
    import numpy as np  # noqa: PLC0415
    media, out_dir = Path(media), Path(out_dir)
    if backend.restricted and EVAL_DIR.resolve() not in out_dir.resolve().parents and out_dir.resolve() != EVAL_DIR.resolve():
        raise ValueError(f'{backend.name}: its weights carry no licence for published work (Krish, 2026-11-05: private test '
                         f'only), so it writes only inside {EVAL_DIR}')
    info = probe(media)
    readings = read(media, info) if readings is None else readings
    decided = plan(readings, lock=getattr(backend, 'lock', False))
    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / f'{media.stem}.eyeline.mp4'
    if qc is not None:
        qc.start(decided, info, out_dir / f'loop.{media.stem}.mp4')
    source = None
    if getattr(backend, 'frame_source', False):
        theirs, ours = len(packet_times(backend.copy)), len(packet_times(media))
        if theirs != ours:
            raise ValueError(f'{backend.name}: its copy has {theirs} frames and the take {ours}: frames cannot be matched')
        source = backend.frames_for(info)
        if getattr(backend, 'aperture', False):
            there = read(backend.copy, info) if copy_readings is None else copy_readings   # where the copy put each iris
            aimed = aims(readings, there, decided)
            lowered = lids(readings, decided, aimed)
            for d_, w_ in zip(decided, look_flags(readings, decided)):
                # All or nothing: a half-faded iris is a ghost (blind review 5, 51.67 s, grey washed-out irises at 40% strength).
                d_['strength'] = 0.0 if w_ >= 0.5 else d_['strength']
            templates = iris_templates(media, readings, info)
        else:
            there = None
            aimed = None
            lowered = None
            templates = {}
    proc = writer(media, target, info, crf)
    counts = {'frames': 0, 'corrected': 0, 'unmoved': 0}
    try:
        for index, frame in enumerate(frames(media, info['width'], info['height'])):
            d = decided[index] if index < len(decided) else {'strength': 0.0, 'eyes': {}}
            new = frame
            other = next(source) if source is not None else None
            if other is not None and d['strength'] > 0 and d['eyes']:
                same, aperture_used = True, False             # is the backend's copy the take itself around his eyes?
                for side, eye in d['eyes'].items():
                    if eye.get('contour') and getattr(backend, 'aperture', False):
                        c = np.asarray(eye['contour'])
                        xa, ya = max(0, int(c[:, 0].min()) - 6), max(0, int(c[:, 1].min()) - 6)
                        xb, yb = int(c[:, 0].max()) + 6, int(c[:, 1].max()) + 6
                        aperture_used = True
                        same = same and bool(np.array_equal(frame[ya:yb, xa:xb], other[ya:yb, xa:xb]))
                        aim = aimed[index].get(side) if aimed and index < len(aimed) else None
                        mine = readings[index] if readings[index].get('face') and 'iris_r' in readings[index] else None
                        new = blend_aperture(new, other, eye['contour'], d['strength'],
                                             (*mine['iris'][side], mine['iris_r'][side]) if mine else None,
                                             aim, templates.get(side),
                                             lowered[index].get(side, 0.0) if lowered and index < len(lowered) else 0.0)
                    else:
                        new = blend(new, other, eye_frame(eye['points']), d['strength'])
                moved = float(np.abs(new.astype(np.int16) - frame.astype(np.int16)).mean())
                counts['corrected'] += 1
                # Aperture mode leaves small corrections as they were on purpose (the gate), so our output not moving
                # proves nothing there: what a backend that "did nothing" shows is a copy equal to the take.
                if d['strength'] >= 0.5 and (same if aperture_used else moved == 0.0):
                    counts['unmoved'] += 1
            elif d['strength'] > 0 and d['eyes']:
                items, geos = [], []
                for side, eye in d['eyes'].items():
                    geo = eye_frame(eye['points'])
                    if bbox(geo, frame.shape) is None:
                        continue
                    items.append((side, patch_of(frame, geo), anchors_of(eye['points'], side, geo), eye['angle']))
                    geos.append(geo)
                for geo, (flow, light) in zip(geos, backend.correct(items)):
                    new = apply(new, geo, flow, light)
                moved = float(np.abs(new.astype(np.int16) - frame.astype(np.int16)).mean()) if new is not frame else 0.0
                counts['corrected'] += 1
                if moved == 0.0 and d['strength'] >= 0.5 and backend.name != 'identity':
                    counts['unmoved'] += 1
            if qc is not None:
                qc.frame(index, frame, new, d)
            proc.stdin.write(np.ascontiguousarray(new).tobytes())
            counts['frames'] += 1
    finally:
        proc.stdin.close()
        code = proc.wait()
    problems = [] if code == 0 else [f'ffmpeg exited {code}']
    if counts['frames'] != len(decided):
        problems.append(f'pass 2 wrote {counts["frames"]} frames, pass 1 read {len(decided)}')
    if counts['unmoved'] and counts['unmoved'] >= max(1, counts['corrected'] // 10):
        problems.append(f'{backend.name} changed nothing on {counts["unmoved"]} frames it was asked to correct: '
                        'its weights did not load or do nothing')
    if not problems:
        problems = same_media(media, target)
    why = {}
    for d in decided:
        why[d['why'] or 'corrected'] = why.get(d['why'] or 'corrected', 0) + 1
    receipt = {'schema': SCHEMA, 'backend': backend.name, 'input': {'path': str(media), 'sha256': _sha(media)},
               'frames': counts['frames'], 'corrected_frames': counts['corrected'], 'reasons': why,
               'settings': {'on_lens_deg': ON_LENS_DEG, 'full_deg': FULL_DEG, 'max_deg': MAX_DEG, 'blink': BLINK,
                            'head_turn_deg': HEAD_TURN_DEG, 'ramp_frames': RAMP_FRAMES},
               'problems': problems}
    if problems:
        target.unlink(missing_ok=True)
        receipt['decision'] = 'rejected'
    else:
        receipt['output'] = {'path': str(target), 'sha256': _sha(target)}
        receipt['decision'] = 'corrected' if counts['corrected'] else 'not_needed'
    if qc is not None:
        receipt['qc'] = qc.finish(out_dir, media.stem, readings, target if not problems else None)
    write_json(out_dir / f'eyeline.{media.stem}.json', receipt)
    return receipt


def _sha(path) -> str:
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for block in iter(lambda: handle.read(1 << 20), b''):
            digest.update(block)
    return digest.hexdigest()
