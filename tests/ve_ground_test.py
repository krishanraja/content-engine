"""ground.not_bare: no frame of empty ground at a beat edge (keyframes@0.2.13, docs/ve/sources/keyframes.md).

The stand-in is two seconds of ffmpeg video: one second of flat grey (bare ground), then one of a test pattern (a
drawn picture). An edge inside the grey fails; an edge well inside the pattern passes.
"""
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import qc, qc_ground  # noqa: E402
from velib.common import ffmpeg  # noqa: E402


class BareGroundTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.video = str(Path(cls.tmp.name) / 'ground.mp4')
        subprocess.run([ffmpeg(), '-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=0x808080:s=1080x1920:r=30:d=1',
                        '-f', 'lavfi', '-i', 'testsrc2=s=1080x1920:r=30:d=1',
                        '-filter_complex', '[0:v][1:v]concat=n=2:v=1[v]', '-map', '[v]',
                        '-c:v', 'libx264', '-g', '1', '-pix_fmt', 'yuv420p', cls.video], check=True)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def beats(self, *starts):
        edges = list(starts) + [60]
        return [{'fromFrame': a, 'toFrame': b} for a, b in zip(edges, edges[1:])]

    def test_an_edge_on_bare_ground_fails_and_names_the_frame(self):
        row = qc_ground.bare_ground(self.video, self.beats(0, 15), '9:16', total_frames=60)
        self.assertIs(row['pass'], False)
        self.assertEqual(row['value'][0]['edge_frame'], 15)
        self.assertLess(row['value'][0]['stage_std'], qc_ground.STD_FLOOR)

    def test_an_edge_inside_a_drawn_picture_passes(self):
        row = qc_ground.bare_ground(self.video, self.beats(0, 45), '9:16', total_frames=60)
        self.assertIs(row['pass'], True)

    def test_an_edge_into_bare_ground_is_caught_within_the_window(self):
        row = qc_ground.bare_ground(self.video, self.beats(0, 32), '9:16', total_frames=60)  # 3 frames back is grey
        self.assertIs(row['pass'], False)

    def test_no_edges_passes_with_a_reason(self):
        row = qc_ground.bare_ground(self.video, self.beats(0), '9:16', total_frames=60)
        self.assertIs(row['pass'], True)
        self.assertEqual(row['reason'], 'no beat edges to check')

    def test_a_shadow_row_for_formats_that_do_not_count_it(self):
        import numpy as np
        with patch.object(qc, 'loudness', return_value={'integrated_lufs': -14, 'true_peak_dbtp': -1}), \
                patch.object(qc, 'frame_diffs', return_value=np.full(60, 2.)), \
                patch.object(qc, 'long_silences', return_value=[]), \
                patch('velib.qc_composition.composition_checks', return_value={'applies': False}), \
                patch('velib.qc_keyframes.keyframe_checks', return_value={'applies': False}):
            report = qc.run_qc(self.video, 'scoreboard-test', beats=self.beats(0, 15), aspect='9:16')
        row = report['checks']['ground.not_bare']
        self.assertEqual((row['status'], row['shadow'], row['pass']), ('advisory', True, False))


if __name__ == '__main__':
    unittest.main()
