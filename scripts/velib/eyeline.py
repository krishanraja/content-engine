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


def plan(readings: list[dict]) -> list[dict]:
    """Per frame and eye: the correction angle and strength, from pass 1's readings. Pure."""
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
    opens = [min(e['open'] for e in out[i]['eyes'].values()) for i in range(n) if out[i]['eyes']]
    closing = max(OPEN_MIN, OPEN_REL * float(np.median(opens))) if opens else OPEN_MIN
    target = np.zeros(n)
    for i in range(n):
        if not face[i]:
            continue
        r = readings[i]
        eyes = out[i]['eyes']
        size = max(max(abs(a) for a in e['off']) for e in eyes.values())
        if r.get('blink', 0) >= BLINK or min(e['open'] for e in eyes.values()) < closing:
            out[i]['why'] = 'blink'
        elif turned[i]:
            out[i]['why'] = 'head turned'
        elif r.get('edge'):
            out[i]['why'] = 'eye at the frame edge'
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


def frames(media, width: int, height: int):
    """Decoded BGR frames, in order (ffmpeg applies any rotation)."""
    import numpy as np  # noqa: PLC0415
    size = width * height * 3
    proc = subprocess.Popen([ffmpeg(), '-v', 'error', '-i', str(media), '-map', '0:v:0', '-f', 'rawvideo', '-pix_fmt', 'bgr24',
                             '-s', f'{width}x{height}', '-'], stdout=subprocess.PIPE)
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
    colour = [arg for key, flag in (('color_primaries', '-color_primaries'), ('color_transfer', '-color_trc'),
                                    ('color_space', '-colorspace')) if info['colour'].get(key)
              for arg in (flag, info['colour'][key])]
    cmd = [ffmpeg(), '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{info["width"]}x{info["height"]}',
           '-framerate', info['rate'], '-i', '-', '-i', str(media), '-map', '0:v', '-map', '1:a?', '-c:a', 'copy',
           '-c:v', 'libx264', '-preset', 'medium', '-crf', str(crf), '-pix_fmt', 'yuv420p', *colour,
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
                   'blink': round(max(shapes.get('eyeBlinkLeft', 0.0), shapes.get('eyeBlinkRight', 0.0)), 3),
                   'yaw': yaw, 'pitch': pitch}
            row['edge'] = any(bbox(eye_frame(row['eyes'][s]), (h, w)) is None for s in EYE_POINTS)
            out.append(row)
    return out


# ------------------------------------------------------------------ pass 2: correct and write

def run(media, out_dir: Path, backend: Backend, *, readings: list[dict] | None = None, qc=None, crf: int = 12) -> dict:
    """Correct one take; return the receipt. The corrected file is out_dir/<stem>.eyeline.mp4."""
    import numpy as np  # noqa: PLC0415
    media, out_dir = Path(media), Path(out_dir)
    if backend.restricted and EVAL_DIR.resolve() not in out_dir.resolve().parents and out_dir.resolve() != EVAL_DIR.resolve():
        raise ValueError(f'{backend.name}: its weights carry no licence for published work (Krish, 2026-11-05: private test '
                         f'only), so it writes only inside {EVAL_DIR}')
    info = probe(media)
    readings = read(media, info) if readings is None else readings
    decided = plan(readings)
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
    proc = writer(media, target, info, crf)
    counts = {'frames': 0, 'corrected': 0, 'unmoved': 0}
    try:
        for index, frame in enumerate(frames(media, info['width'], info['height'])):
            d = decided[index] if index < len(decided) else {'strength': 0.0, 'eyes': {}}
            new = frame
            other = next(source) if source is not None else None
            if other is not None and d['strength'] > 0 and d['eyes']:
                for side, eye in d['eyes'].items():
                    new = blend(new, other, eye_frame(eye['points']), d['strength'])
                moved = float(np.abs(new.astype(np.int16) - frame.astype(np.int16)).mean())
                counts['corrected'] += 1
                if moved == 0.0 and d['strength'] >= 0.5:
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
