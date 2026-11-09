"""The eye gaze pass (velib/eyeline.py) on synthetic media and readings: sound and timing kept exactly, untouched
where it should be, ramped where it acts, and refusals for a model that does nothing or may not be published. No
model, no network, no real take; the OpenCV checks run only where OpenCV is installed (CI has it)."""
from __future__ import annotations

import importlib.util
import shutil
import subprocess
import sys
import tempfile
import math
import unittest
from pathlib import Path

import numpy as np

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import eyeline  # noqa: E402

HAVE_CV2 = importlib.util.find_spec('cv2') is not None
HAVE_FFMPEG = shutil.which('ffmpeg') is not None and shutil.which('ffprobe') is not None


def eye(cx, cy, width=60.0, iris_dx=0.0, iris_dy=0.0, open_=0.3):
    """Six dlib-ordered eye points (outer/inner corner, two upper, two lower) and the iris, in frame pixels."""
    half, lid = width / 2, open_ * width / 2
    pts = [[cx - half, cy], [cx - half / 3, cy - lid], [cx + half / 3, cy - lid], [cx + half, cy],
           [cx + half / 3, cy + lid], [cx - half / 3, cy + lid]]
    return pts, [cx + iris_dx, cy + iris_dy]


def reading(iris_dx=0.0, iris_dy=0.0, blink=0.0, yaw=0.0, open_=0.3, face=True):
    if not face:
        return {'face': False}
    r_pts, r_iris = eye(400, 600, iris_dx=iris_dx, iris_dy=iris_dy, open_=open_)
    l_pts, l_iris = eye(560, 600, iris_dx=iris_dx, iris_dy=iris_dy, open_=open_)
    return {'face': True, 'eyes': {'R': r_pts, 'L': l_pts}, 'iris': {'R': r_iris, 'L': l_iris}, 'blink': blink,
            'yaw': yaw, 'pitch': 0.0, 'edge': False}


@unittest.skipUnless(HAVE_CV2, 'OpenCV is not installed here')
class Colour(unittest.TestCase):
    def test_a_frame_the_pass_does_not_touch_keeps_its_colour(self):
        # 6 Nov 2026: with ffmpeg's default converters the round trip YUV to BGR to YUV darkened and warmed every frame.
        import numpy as np
        with tempfile.TemporaryDirectory(prefix='ve-colour-') as tmp:
            src, out = Path(tmp) / 'src.mp4', Path(tmp) / 'out.mp4'
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30:duration=1',
                            '-vf', 'format=yuv420p', '-c:v', 'libx264', '-crf', '8', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709',
                            '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', str(src)], check=True)
            info = eyeline.probe(src)
            proc = eyeline.writer(src, out, info)
            for frame in eyeline.frames(src, info['width'], info['height']):
                proc.stdin.write(np.ascontiguousarray(frame).tobytes())
            proc.stdin.close()
            self.assertEqual(proc.wait(), 0)

            def planes(path):
                raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-pix_fmt', 'yuv420p', '-f', 'rawvideo', '-'],
                                     capture_output=True, check=True).stdout
                d = np.frombuffer(raw, np.uint8).astype(float)
                n, fs = len(d) // (640 * 360 * 3 // 2), 640 * 360 * 3 // 2
                d = d[:n * fs].reshape(n, fs)
                return d[:, :640 * 360].mean(), d[:, 640 * 360:640 * 360 * 5 // 4].mean(), d[:, 640 * 360 * 5 // 4:].mean()
            for a, b in zip(planes(src), planes(out)):
                self.assertLess(abs(a - b), 0.5)


@unittest.skipUnless(HAVE_CV2, 'OpenCV is not installed here')
class Lids(unittest.TestCase):
    def test_the_upper_lid_comes_down_and_what_is_under_it_stays(self):
        import numpy as np
        region = np.full((120, 160, 3), (120, 150, 200), np.uint8)             # skin
        region[60:62, 40:121] = 30                                             # the lash band at the upper lid line
        region[64:100, 40:121] = (250, 250, 250)                               # the eye, white
        up = [[120 - 10 * k, 60] for k in range(1, 8)]                         # upper lid points, right to left
        low = [[40 + 10 * k, 90] for k in range(1, 8)]                         # lower lid points
        contour = [[40, 75], *low, [120, 75], *up]
        out = eyeline.lower_lid(region, contour, (0, 0), 4.0)
        self.assertLess(float(out[64:66, 80].mean()), 120)                      # the lash band is now four rows lower
        self.assertGreater(float(out[60:62, 80].mean()), 150)                  # and skin where it was
        self.assertTrue(np.array_equal(out[80:100, 80], region[80:100, 80]))   # the eye below is untouched
        self.assertTrue(np.array_equal(out[:, :30], region[:, :30]))           # nothing outside the corners moved
        self.assertIs(eyeline.lower_lid(region, contour, (0, 0), 0.1), region)  # a sub-pixel drop does nothing


class Gated(unittest.TestCase):
    @unittest.skipUnless(HAVE_CV2, 'OpenCV is not installed here')
    def test_a_small_move_is_left_exactly_as_it_was(self):
        import numpy as np
        frame = np.full((120, 160, 3), 90, np.uint8)
        other = np.full((120, 160, 3), 200, np.uint8)
        contour = [[60 + 20 * math.cos(a), 60 + 8 * math.sin(a)] for a in np.linspace(0, 2 * math.pi, 16, endpoint=False)]
        near = eyeline.blend_aperture(frame, other, contour, 1.0, (60, 60, 6), (60.5, 60, 6))    # half a pixel, 0.08 radii
        self.assertIs(near, frame)
        drift = eyeline.blend_aperture(frame, other, contour, 1.0, (60, 60, 6), (62.4, 60, 6))   # 0.4 radii: the prompter drift
        self.assertIsNot(drift, frame)
        hard = eyeline.blend_aperture(frame, other, contour, 1.0, (60, 60, 6), (70, 60, 6))      # 1.7 radii: a hard glance, as filmed
        self.assertIs(hard, frame)


def contour_ellipse(cx, cy, a, b):
    """16 lid points around an ellipse, in the order eyeline's EYE_CONTOUR uses (0 and 8 are the corners)."""
    return [[cx - a * math.cos(math.pi * k / 8), cy + b * math.sin(math.pi * k / 8)] for k in range(16)]


class Moves(unittest.TestCase):
    """The 9 Nov rules: the prompter drift is corrected, a hard glance, a squint and a closing eye are left alone, both
    eyes move together, and the move is a push of his own pixels that leaves everything outside its reach exact."""

    def test_the_share_of_a_move_by_its_length(self):
        self.assertEqual(eyeline.band(0.05), 0.0)                       # under 0.1 radii: left as filmed
        self.assertEqual(eyeline.band(0.3), 1.0)                        # the prompter drift: all of it
        self.assertEqual(eyeline.band(1.0), 0.0)                        # a hard glance: left as filmed
        self.assertGreater(eyeline.band(0.45), 0.0)
        self.assertLess(eyeline.band(0.45), 1.0)

    def test_how_much_of_an_iris_is_inside_the_lid_line(self):
        lid = contour_ellipse(100, 100, 30, 12)
        self.assertEqual(eyeline.iris_seen(lid, (100, 100), 8), 1.0)
        self.assertLess(eyeline.iris_seen(lid, (100, 100), 16), 0.9)   # a big iris cut top and bottom
        self.assertEqual(eyeline.iris_seen(lid, (200, 100), 8), 0.0)

    def _rows(self, n=30, seen_open=12, blink_at=None):
        rows, aimed = [], []
        for i in range(n):
            r = {'face': True, 'iris_r': {'L': 8.0, 'R': 8.0}, 'blink': 0.6 if i == blink_at else 0.0,
                 'iris': {'R': [100.0, 100.0], 'L': [200.0, 100.0]},
                 'contour': {'R': contour_ellipse(100, 100, 30, seen_open), 'L': contour_ellipse(200, 100, 30, seen_open)}}
            rows.append(r)
            aimed.append({'R': (102.4, 100.0, 8.0), 'L': (202.0, 100.0, 8.0)})    # 0.3 and 0.25 radii
        return rows, aimed

    def test_one_share_for_both_eyes_and_none_on_a_blink_or_a_squint(self):
        rows, aimed = self._rows(blink_at=15)
        moves = eyeline.shares(rows, aimed)
        self.assertEqual(moves[15], 0.0)                                # a closing eye never moves
        self.assertGreater(moves[5], 0.9)
        rows, aimed = self._rows(seen_open=5)                          # lids over most of the iris: a squint
        self.assertTrue(all(m == 0.0 for m in eyeline.shares(rows, aimed)))
        rows, aimed = self._rows()
        for i in range(8, 23):
            aimed[i]['L'] = (215.0, 100.0, 8.0)                         # one eye in a hard glance: neither moves
        self.assertEqual(eyeline.shares(rows, aimed)[15], 0.0)

    @unittest.skipUnless(HAVE_CV2, 'OpenCV is not installed here')
    def test_the_push_moves_his_iris_and_leaves_the_rest_exactly(self):
        import cv2
        frame = np.full((200, 300, 3), 170, np.uint8)
        cv2.ellipse(frame, (150, 100), (40, 16), 0, 0, 360, (235, 235, 235), -1)      # the white of the eye
        cv2.circle(frame, (150, 100), 10, (40, 50, 70), -1)                            # his iris
        cv2.circle(frame, (147, 97), 2, (255, 255, 255), -1)                           # its catchlight
        lid = contour_ellipse(150, 100, 40, 16)
        out = eyeline.blend_aperture(frame, frame, lid, 1.0, (150, 100, 10), (153, 100, 10), share=1.0)
        dark = lambda im: np.argwhere(im[60:140, 100:200].sum(2) < 300)  # noqa: E731
        shift = dark(out)[:, 1].mean() - dark(frame)[:, 1].mean()
        self.assertAlmostEqual(shift, 3.0, delta=0.6)                   # the iris travelled the move
        self.assertGreater(int(out[60:140, 100:200].max()), 250)         # its catchlight came with it
        self.assertTrue(np.array_equal(out[:40], frame[:40]))           # nothing above the eye changed
        self.assertTrue(np.array_equal(out[:, :60], frame[:, :60]))
        none = eyeline.blend_aperture(frame, frame, lid, 1.0, (150, 100, 10), None, share=1.0)
        self.assertIs(none, frame)                                      # no aim: as filmed, never the copy's eye
        other = np.zeros_like(frame)
        tiny = eyeline.blend_aperture(frame, other, lid, 1.0, (150, 100, 1.5), (153, 100, 1.5), share=0.0)
        self.assertIs(tiny, frame)                                      # too little iris to move: as filmed, never the copy


class Decide(unittest.TestCase):
    def test_lock_leaves_blinks_to_maxine_and_never_takes_a_turn(self):
        readings = [reading(blink=0.9) if 20 <= i < 24 else reading(yaw=40) if 40 <= i < 44 else reading()
                    for i in range(60)]
        locked = eyeline.plan(readings, lock=True)
        free = eyeline.plan(readings)
        self.assertTrue(all(locked[i]['strength'] == 0 for i in range(40, 44)))           # head turned: his own eyes
        self.assertTrue(all(locked[i]['strength'] == 1 for i in range(20, 24)))           # blink: Maxine's (detect_closure)
        self.assertTrue(all(locked[i]['strength'] == 1 for i in range(0, 10)))
        self.assertTrue(all(free[i]['strength'] == 0 for i in range(0, 10)))   # unlocked: on the lens, untouched

    def test_strength_ramps_and_is_zero_wherever_the_target_is(self):
        target = [0] * 10 + [1] * 20 + [0] * 10
        s = eyeline.ramp(target)
        self.assertTrue(all(abs(b - a) <= 1 / eyeline.RAMP_FRAMES + 1e-9 for a, b in zip(s, s[1:])))
        self.assertTrue(all(v == 0 for v, t in zip(s, target) if t == 0))
        self.assertEqual(max(s), 1.0)

    def test_iris_offsets_read_as_degrees_with_their_signs(self):
        pts, iris = eye(500, 500, iris_dx=8)
        v, h = eyeline.eye_angles(pts, iris)
        self.assertGreater(h, 5)
        self.assertAlmostEqual(v, 0, delta=1e-6)
        pts, iris = eye(500, 500, iris_dy=-6)        # up the frame
        self.assertGreater(eyeline.eye_angles(pts, iris)[0], 5)

    def test_on_the_lens_is_left_alone_and_off_it_is_turned_back(self):
        readings = [reading() for _ in range(30)] + [reading(iris_dx=9) for _ in range(30)] + [reading() for _ in range(30)]
        plan = eyeline.plan(readings)
        self.assertTrue(all(p['strength'] == 0 for p in plan[:20]))
        self.assertEqual(plan[5]['why'], 'on the lens')
        middle = plan[45]
        self.assertEqual(middle['why'], 'off the lens')
        self.assertEqual(middle['strength'], 1.0)
        self.assertLess(middle['eyes']['R']['angle'][1], 0)          # looked right of the lens: turned back left
        self.assertLessEqual(abs(middle['eyes']['R']['angle'][1]), eyeline.MAX_DEG)

    def test_a_blink_a_turned_head_and_no_face_are_never_corrected(self):
        readings = [reading(iris_dx=9) for _ in range(40)]
        readings[20] = reading(iris_dx=9, blink=0.9)
        readings[21] = reading(iris_dx=9, open_=0.05)
        readings[25] = reading(iris_dx=9, yaw=40)
        readings[30] = reading(face=False)
        readings += [reading() for _ in range(40)]          # his median stays on the lens
        plan = eyeline.plan(readings)
        self.assertEqual([plan[i]['why'] for i in (20, 21, 25, 30)], ['blink', 'blink', 'head turned', 'no face'])
        self.assertTrue(all(plan[i]['strength'] == 0 for i in (20, 21, 25, 30)))
        self.assertGreater(plan[23]['strength'], 0)
        self.assertLess(plan[23]['strength'], 1)            # easing back in after the blink

    def test_hdr_variable_rate_and_rotation_are_read_from_the_stream(self):
        sdr = {'width': 1080, 'height': 1920, 'r_frame_rate': '30/1', 'avg_frame_rate': '30/1', 'pix_fmt': 'yuv420p',
               'color_transfer': 'bt709', 'color_primaries': 'bt709', 'color_space': 'bt709'}
        self.assertEqual(eyeline.check_stream(sdr)['width'], 1080)
        for transfer in ('smpte2084', 'arib-std-b67'):
            with self.assertRaisesRegex(ValueError, 'HDR'):
                eyeline.check_stream({**sdr, 'color_transfer': transfer})
        with self.assertRaisesRegex(ValueError, 'constant-rate master'):
            eyeline.check_stream({**sdr, 'avg_frame_rate': '2997/100'})
        turned = eyeline.check_stream({**sdr, 'width': 1920, 'height': 1080, 'side_data_list': [{'rotation': -90}]})
        self.assertEqual((turned['width'], turned['height'], turned['rotation']), (1080, 1920, -90))

    def test_a_blend_takes_the_other_eye_inside_the_mask_only_and_none_at_strength_0(self):
        frame = np.zeros((300, 300, 3), np.uint8)
        other = np.full((300, 300, 3), 200, np.uint8)
        geo = eyeline.eye_frame(eye(150, 150, width=60)[0])
        self.assertIs(eyeline.blend(frame, other, geo, 0.0), frame)
        out = eyeline.blend(frame, other, geo, 1.0)
        self.assertEqual(int(out[150, 150, 0]), 200)          # the eye's centre is the other frame
        self.assertEqual(int(out[10, 10, 0]), 0)              # far outside is untouched
        half = eyeline.blend(frame, other, geo, 0.5)
        self.assertAlmostEqual(int(half[150, 150, 0]), 100, delta=1)

    def test_maxine_names_the_gpu_it_needs(self):
        with self.assertRaisesRegex(RuntimeError, 'RTX'):
            eyeline.Maxine()


@unittest.skipUnless(HAVE_CV2, 'OpenCV is not installed here')
class Geometry(unittest.TestCase):
    def test_a_flow_moves_pixels_inside_the_eye_and_nothing_outside(self):
        rng = np.random.default_rng(3)
        frame = rng.integers(0, 255, (400, 400, 3), dtype=np.uint8)
        pts, _ = eye(200, 200, width=80)
        geo = eyeline.eye_frame(pts)
        flow = np.zeros((eyeline.PATCH_H, eyeline.PATCH_W, 2), np.float32)
        flow[..., 0] = 0.1
        out = eyeline.apply(frame, geo, flow, np.zeros((eyeline.PATCH_H, eyeline.PATCH_W), np.float32))
        x0, y0, x1, y1 = eyeline.bbox(geo, frame.shape)
        outside = np.ones(frame.shape[:2], bool)
        outside[y0:y1, x0:x1] = False
        self.assertTrue((out[outside] == frame[outside]).all())
        self.assertGreater(np.abs(out[200, 200].astype(int) - frame[200, 200].astype(int)).sum(), 0)
        zero = eyeline.apply(frame, geo, np.zeros_like(flow), np.zeros((eyeline.PATCH_H, eyeline.PATCH_W), np.float32))
        self.assertLessEqual(int(np.abs(zero.astype(int) - frame.astype(int)).max()), 40)   # one bicubic resample, no move

    def test_the_patch_is_the_eye_area_at_64_by_48(self):
        frame = np.zeros((300, 300, 3), np.uint8)
        frame[140:160, 140:160] = 255
        pts, _ = eye(150, 150, width=60)
        patch = eyeline.patch_of(frame, eyeline.eye_frame(pts))
        self.assertEqual(patch.shape, (eyeline.PATCH_H, eyeline.PATCH_W, 3))
        self.assertGreater(patch[20:30, 27:37].mean(), 100)


@unittest.skipUnless(HAVE_FFMPEG, 'ffmpeg is not installed here')
class Media(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='ve-eyeline-')
        self.addCleanup(self.temp.cleanup)
        self.dir = Path(self.temp.name)
        self.take = self.dir / 'take.mp4'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=320x568:rate=30:duration=2',
                        '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                        '-c:a', 'aac', '-shortest', str(self.take)], check=True)

    def test_sound_frames_and_times_are_kept_and_nothing_to_do_says_so(self):
        receipt = eyeline.run(self.take, self.dir / 'out', eyeline.Identity(), readings=[{'face': False}] * 60)
        self.assertEqual(receipt['problems'], [])
        self.assertEqual(receipt['decision'], 'not_needed')
        out = Path(receipt['output']['path'])
        self.assertEqual(eyeline.same_media(self.take, out), [])
        self.assertEqual(eyeline.audio_md5(self.take), eyeline.audio_md5(out))
        self.assertTrue((self.dir / 'out' / 'eyeline.take.json').is_file())

    def test_a_changed_sound_or_length_is_caught(self):
        other = self.dir / 'other.mp4'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(self.take), '-f', 'lavfi', '-i', 'sine=frequency=660:duration=2',
                        '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-shortest', str(other)], check=True)
        self.assertTrue(any('audio changed' in p for p in eyeline.same_media(self.take, other)))
        short = self.dir / 'short.mp4'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(self.take), '-t', '1', '-c', 'copy', str(short)], check=True)
        self.assertTrue(any('frame count changed' in p for p in eyeline.same_media(self.take, short)))

    def test_a_backend_that_may_not_be_published_writes_only_to_the_evaluation_folder(self):
        class Private(eyeline.Identity):
            name, restricted = 'private', True
        with self.assertRaisesRegex(ValueError, 'private test only'):
            eyeline.run(self.take, self.dir / 'out', Private(), readings=[{'face': False}] * 60)

    def scaled(self, readings):
        for r in readings:
            if r.get('face'):
                for side in ('L', 'R'):
                    r['eyes'][side] = [[x * 0.4, y * 0.4] for x, y in r['eyes'][side]]
                    r['iris'][side] = [r['iris'][side][0] * 0.4, r['iris'][side][1] * 0.4]
        return readings

    @unittest.skipUnless(HAVE_CV2, 'OpenCV is not installed here')
    def test_a_maxine_copy_must_match_the_take_frame_for_frame_and_must_change_it(self):
        short = self.dir / 'short.mp4'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(self.take), '-t', '1', '-c', 'copy', str(short)], check=True)
        with self.assertRaisesRegex(ValueError, 'frames cannot be matched'):
            eyeline.run(self.take, self.dir / 'out', eyeline.Maxine(short), readings=[{'face': False}] * 60)
        readings = self.scaled([reading(iris_dx=9) if 10 <= i < 30 else reading() for i in range(60)])
        # The copy's readings are given as read() finds them on this synthetic clip (no face on any frame), so the test
        # needs no face model: CI installs none.
        receipt = eyeline.run(self.take, self.dir / 'out', eyeline.Maxine(self.take), readings=readings,
                              copy_readings=[{'face': False}] * 60)
        self.assertEqual(receipt['decision'], 'rejected')       # its "redirected" copy is the take itself
        self.assertTrue(any('changed nothing' in p for p in receipt['problems']), receipt['problems'])

    @unittest.skipUnless(HAVE_CV2, 'OpenCV is not installed here')
    def test_a_lens_point_from_another_take_holds_only_in_the_same_setup(self):
        import json
        receipt = self.dir / 'eyeline.short.json'
        receipt.write_text(json.dumps({'backend': 'flx', 'lens': {'L': [0.08, -0.07], 'R': [-0.07, -0.07]}}))
        with self.assertRaisesRegex(RuntimeError, 'not the receipt of a Maxine'):
            eyeline.Calibrated(receipt)
        receipt.write_text(json.dumps({'backend': 'maxine', 'decision': 'corrected', 'lens': {'L': [0.08, -0.07]},
                                       'head': {'yaw': 0.0, 'pitch': 0.0}}))
        with self.assertRaisesRegex(RuntimeError, 'both eyes'):           # one eye's lens point is not a calibration
            eyeline.Calibrated(receipt)
        receipt.write_text(json.dumps({'backend': 'maxine', 'decision': 'corrected', 'input': {'path': 'short.mp4'},
                                       'lens': {'L': [0.08, -0.07], 'R': [-0.07, -0.07]}, 'head': {'yaw': 30.0, 'pitch': 0.0}}))
        readings = self.scaled([reading(iris_dx=9) if 10 <= i < 30 else reading() for i in range(60)])
        with self.assertRaisesRegex(ValueError, 'not one setup'):         # his head sits 30 degrees from where it did
            eyeline.run(self.take, self.dir / 'out', eyeline.Calibrated(receipt), readings=readings)
        receipt.write_text(json.dumps({'backend': 'maxine', 'decision': 'corrected', 'input': {'path': 'short.mp4'},
                                       'lens': {'L': [0.08, -0.07], 'R': [-0.07, -0.07]}, 'head': {'yaw': 0.0, 'pitch': 0.0}}))
        done = eyeline.run(self.take, self.dir / 'out', eyeline.Calibrated(receipt), readings=readings)
        self.assertEqual(done['problems'], [])
        self.assertEqual(done['lens_from'], 'short.mp4')
        self.assertEqual(eyeline.same_media(self.take, Path(done['output']['path'])), [])

    @unittest.skipUnless(HAVE_CV2, 'OpenCV is not installed here')
    def test_a_maxine_copy_is_taken_only_where_the_plan_says(self):
        other = self.dir / 'other.mp4'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(self.take), '-vf', 'negate', '-c:v', 'libx264',
                        '-pix_fmt', 'yuv420p', '-an', str(other)], check=True)
        # Maxine locks gaze (and handles blinks) itself, so its eyes are taken on every frontal frame, never a turn.
        readings = self.scaled([reading(yaw=40) if 40 <= i < 46 else reading(iris_dx=9) if 10 <= i < 30 else reading()
                                for i in range(60)])
        receipt = eyeline.run(self.take, self.dir / 'out', eyeline.Maxine(other), readings=readings,
                              copy_readings=[{'face': False}] * 60)   # as read() finds it: no face on any frame
        self.assertEqual(receipt['problems'], [])
        self.assertEqual(receipt['decision'], 'corrected')
        self.assertLessEqual(receipt['corrected_frames'], 60 - 6)
        self.assertGreater(receipt['corrected_frames'], 40)
        self.assertEqual(eyeline.same_media(self.take, Path(receipt['output']['path'])), [])

    @unittest.skipUnless(HAVE_CV2, 'OpenCV is not installed here')
    def test_a_model_that_changes_nothing_is_refused_and_its_file_deleted(self):
        class Lazy(eyeline.Identity):
            name = 'lazy'
        readings = [reading(iris_dx=9) if 10 <= i < 30 else reading() for i in range(60)]
        for r in readings:                                   # scale the fixture eyes into the 320x568 frame
            for side in ('L', 'R'):
                r['eyes'][side] = [[x * 0.4, y * 0.4] for x, y in r['eyes'][side]]
                r['iris'][side] = [r['iris'][side][0] * 0.4, r['iris'][side][1] * 0.4]
        receipt = eyeline.run(self.take, self.dir / 'out', Lazy(), readings=readings)
        self.assertEqual(receipt['decision'], 'rejected')
        self.assertTrue(any('changed nothing' in p for p in receipt['problems']), receipt['problems'])
        self.assertFalse((self.dir / 'out' / 'take.eyeline.mp4').exists())


if __name__ == '__main__':
    unittest.main()
