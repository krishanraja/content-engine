"""The eye gaze pass (velib/eyeline.py) on synthetic media and readings: sound and timing kept exactly, untouched
where it should be, ramped where it acts, and refusals for a model that does nothing or may not be published. No
model, no network, no real take; the OpenCV checks run only where OpenCV is installed (CI has it)."""
from __future__ import annotations

import importlib.util
import shutil
import subprocess
import sys
import tempfile
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

    def test_a_maxine_copy_must_match_the_take_frame_for_frame_and_must_change_it(self):
        short = self.dir / 'short.mp4'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(self.take), '-t', '1', '-c', 'copy', str(short)], check=True)
        with self.assertRaisesRegex(ValueError, 'frames cannot be matched'):
            eyeline.run(self.take, self.dir / 'out', eyeline.Maxine(short), readings=[{'face': False}] * 60)
        readings = self.scaled([reading(iris_dx=9) if 10 <= i < 30 else reading() for i in range(60)])
        receipt = eyeline.run(self.take, self.dir / 'out', eyeline.Maxine(self.take), readings=readings)
        self.assertEqual(receipt['decision'], 'rejected')       # its "redirected" copy is the take itself
        self.assertTrue(any('changed nothing' in p for p in receipt['problems']), receipt['problems'])

    def test_a_maxine_copy_is_taken_only_where_the_plan_says(self):
        other = self.dir / 'other.mp4'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(self.take), '-vf', 'negate', '-c:v', 'libx264',
                        '-pix_fmt', 'yuv420p', '-an', str(other)], check=True)
        # Maxine locks gaze (and handles blinks) itself, so its eyes are taken on every frontal frame, never a turn.
        readings = self.scaled([reading(yaw=40) if 40 <= i < 46 else reading(iris_dx=9) if 10 <= i < 30 else reading()
                                for i in range(60)])
        receipt = eyeline.run(self.take, self.dir / 'out', eyeline.Maxine(other), readings=readings)
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
