"""ve qc must catch, on real encoded media, the measured Friday defects: a long still (entrance-then-hold),
a repeating redraw loop (the f % 180 annotation), a dead-air gap, and a master that is not at -14 LUFS / -1 dBTP."""
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import qc  # noqa: E402


def ffmpeg(*args):
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', *args], check=True)


class MeasuredDefects(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        root = Path(cls.temp.name)
        # 4 s of motion, then a 6 s hold on one frame, with a 1.5 s silence in the middle of the audio.
        cls.hold = str(root / 'hold.mp4')
        ffmpeg('-f', 'lavfi', '-i', 'testsrc2=size=160x90:rate=30:duration=4', '-f', 'lavfi', '-i', 'color=c=gray:size=160x90:rate=30:duration=6',
               '-f', 'lavfi', '-i', 'sine=frequency=330:sample_rate=48000:duration=4', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono:d=1.5',
               '-f', 'lavfi', '-i', 'sine=frequency=330:sample_rate=48000:duration=4.5',
               '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0[v];[2:a][3:a][4:a]concat=n=3:v=0:a=1[a]',
               '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', cls.hold)
        # The f % 180 signature: draw for 1.5 s, hold 4.5 s, reset, five times over.
        unit = str(root / 'unit.mp4')
        ffmpeg('-f', 'lavfi', '-i', 'testsrc2=size=160x90:rate=30:duration=1.5', '-f', 'lavfi', '-i', 'color=c=gray:size=160x90:rate=30:duration=4.5',
               '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0[v]', '-map', '[v]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', unit)
        cls.loop = str(root / 'loop.mp4')
        ffmpeg('-stream_loop', '4', '-i', unit, '-c', 'copy', cls.loop)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_a_long_hold_fails_the_still_and_density_gates(self):
        report = qc.run_qc(self.hold, 'scoreboard-test')
        self.assertGreaterEqual(report['checks']['motion.longest_still']['value'], 5)
        self.assertFalse(report['checks']['motion.longest_still']['pass'])
        self.assertFalse(report['checks']['motion.change_density']['pass'])

    def test_dead_air_is_found(self):
        report = qc.run_qc(self.hold, 'scoreboard-test')
        self.assertFalse(report['checks']['loudness.long_silence']['pass'])
        start, end = report['checks']['loudness.long_silence']['value'][0]
        self.assertAlmostEqual(start, 4.0, delta=0.3)
        self.assertAlmostEqual(end, 5.5, delta=0.3)

    def test_an_unmastered_mix_fails_loudness(self):
        report = qc.run_qc(self.hold, 'scoreboard-test')
        self.assertFalse(report['checks']['loudness.integrated']['pass'])

    def test_a_redraw_loop_is_detected(self):
        period = qc.motion(qc.frame_diffs(self.loop))['loop_period_s']
        self.assertIsNotNone(period)
        self.assertAlmostEqual(period, 6.0, delta=0.4)

    def test_unbuilt_checks_keep_the_report_incomplete(self):
        report = qc.run_qc(self.hold, 'scoreboard-test')
        self.assertFalse(report['complete'])
        self.assertEqual(report['checks']['sync.av_xcorr']['status'], 'not_run')


if __name__ == '__main__':
    unittest.main()
