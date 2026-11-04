"""Face flags (velib.faceflags): off the lens, eyes closed, head turned, each against the take's own median; a blink is
not a window; the windows inside a cut become moments a graphic could cover, never a change of take (F14). Synthetic
samples; the real landmarker runs only where mediapipe and its pinned model are installed."""
from __future__ import annotations

import json
import math
import sys
import tempfile
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import faceflags  # noqa: E402


def sample(t, blink=0.1, gaze=0.4, yaw=-10.0, pitch=0.0, face=True):
    return {'t': round(t, 3), 'face': True, 'blink': blink, 'gaze': gaze, 'yaw': yaw, 'pitch': pitch} if face \
        else {'t': round(t, 3), 'face': False}


def take(*changes):
    """Ten seconds at 0.2 s; `changes` are (from_s, to_s, fields) laid over his normal."""
    rows = []
    for k in range(50):
        t = k * 0.2
        fields = {}
        for start, end, over in changes:
            if start <= t + 1e-9 < end:
                fields.update(over)
        rows.append(sample(t, **fields))
    return {'schema': faceflags.SCHEMA, 'every_s': 0.2, 'samples': rows}


class FaceFlagsTest(unittest.TestCase):
    def test_his_normal_is_the_take_median_and_names_nothing(self):
        found = faceflags.flags(take())
        self.assertEqual(found['windows'], [])
        self.assertEqual(found['median'], {'blink': 0.1, 'gaze': 0.4, 'yaw': -10.0, 'pitch': 0.0})
        self.assertEqual((found['status'], found['calibrated']), ('advisory', False))

    def test_a_blink_is_not_a_window_but_closed_eyes_are(self):
        found = faceflags.flags(take((2.0, 2.2, {'blink': 0.9}), (5.0, 5.8, {'blink': 0.8})))
        self.assertEqual([(w['kind'], w['from_s'], w['to_s']) for w in found['windows']], [('eyes_closed', 5.0, 5.8)])

    def test_off_the_lens_and_a_turned_head_are_measured_against_his_own_median(self):
        found = faceflags.flags(take((3.0, 3.6, {'gaze': 0.8}), (6.0, 6.6, {'yaw': 10.0}), (8.0, 8.6, {'yaw': -20.0})))
        kinds = [(w['kind'], w['from_s'], w['to_s']) for w in found['windows']]
        self.assertEqual(kinds, [('off_lens', 3.0, 3.6), ('head_turn', 6.0, 6.6)])
        self.assertAlmostEqual(found['windows'][1]['peak'], 20.0)

    def test_no_face_is_a_window_and_a_window_open_at_the_end_closes(self):
        found = faceflags.flags(take((9.2, 10.0, {'face': False})))
        self.assertEqual([(w['kind'], w['from_s'], w['to_s']) for w in found['windows']], [('no_face', 9.2, 10.0)])

    def test_a_reading_comes_from_blendshapes_and_the_face_transform(self):
        a = math.radians(20)
        yawed = [[math.cos(a), 0, math.sin(a), 0], [0, 1, 0, 0], [-math.sin(a), 0, math.cos(a), 0], [0, 0, 0, 1]]
        row = faceflags.reading({'eyeBlinkLeft': 0.2, 'eyeBlinkRight': 0.4, 'eyeLookOutLeft': 0.7, 'eyeLookInRight': 0.5},
                                yawed)
        self.assertEqual((row['blink'], row['gaze'], row['yaw'], row['pitch']), (0.3, 0.6, 20.0, 0.0))

    def test_windows_inside_the_cut_become_moments_to_cover_in_cut_time(self):
        with tempfile.TemporaryDirectory(prefix='ve-faces-') as folder:
            ve_dir = Path(folder)
            edl = {'cut': 'short', 'fps': 30, 'speed': 1.0, 'takes': {'t1': {}, 't2': {}},
                   'segments': [{'take': 't1', 'src_in_s': 10.0, 'src_out_s': 14.0, 'out_in_s': 0.0},
                                {'take': 't2', 'src_in_s': 2.0, 'src_out_s': 6.0, 'out_in_s': 4.0}]}
            self.assertIsNone(faceflags.write_cover(edl, ve_dir), 'no take read, no file')
            (ve_dir / 'faces.t1.json').write_text(json.dumps({'windows': [
                {'kind': 'off_lens', 'from_s': 12.0, 'to_s': 12.6, 'peak': 0.4},
                {'kind': 'head_turn', 'from_s': 13.8, 'to_s': 15.0, 'peak': 18.0},
                {'kind': 'eyes_closed', 'from_s': 20.0, 'to_s': 21.0, 'peak': 0.9}]}))
            cover = json.loads(faceflags.write_cover(edl, ve_dir).read_text())
            self.assertEqual([(w['kind'], w['from_s'], w['to_s'], w['from_frame'], w['to_frame']) for w in cover['windows']],
                             [('off_lens', 2.0, 2.6, 60, 78), ('head_turn', 3.8, 4.0, 114, 120)])
            self.assertEqual((cover['status'], cover['calibrated']), ('advisory', False))
            # A take re-ingested under the same id is another file: its old flags never reach the cut.
            edl['takes'] = {'t1': {'media': {'sha256': 'new'}}, 't2': {}}
            (ve_dir / 'faces.t1.json').write_text(json.dumps({'media_sha256': 'old', 'windows': [
                {'kind': 'off_lens', 'from_s': 12.0, 'to_s': 12.6, 'peak': 0.4}]}))
            self.assertIsNone(faceflags.write_cover(edl, ve_dir))

    @unittest.skipUnless(faceflags.MODEL.is_file(), 'the pinned face landmarker is not on this machine')
    def test_the_landmarker_reads_a_frame_with_no_face_as_no_face(self):
        try:
            import mediapipe  # noqa: F401
        except ImportError:
            self.skipTest('mediapipe is not installed')
        import subprocess
        from velib.common import ffmpeg
        with tempfile.TemporaryDirectory(prefix='ve-faces-') as folder:
            clip = Path(folder) / 'wall.mp4'
            subprocess.run([ffmpeg(), '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0xdddddd:s=360x640:r=30:d=1',
                            '-c:v', 'libx264', '-pix_fmt', 'yuv420p', str(clip)], check=True)
            scanned = faceflags.scan(clip)
        self.assertEqual(len(scanned['samples']), 5)
        self.assertTrue(all(not s['face'] for s in scanned['samples']))


if __name__ == '__main__':
    unittest.main()
