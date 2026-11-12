"""Picture against sound on a finished cut (scripts/av_sync.py; Krish, 2026-11-12: "the 5-minute video had audio and
video out of sync with one another. We need to ensure that never happens in the future").

The take is a few seconds of ffmpeg: a white box that flashes at irregular times and a tone that sounds at exactly
the same times. A cut joins two spans of it. The intact cut passes; a cut whose sound slips 200 ms in one span fails,
as does one whose picture slips (the fault a composite that reads the take's picture separately can make); a silent
cut cannot pass; and the receipt holds only for the bytes it was written for.
"""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import av_sync  # noqa: E402

EVENTS = [0.45, 1.3, 1.75, 2.9, 3.35, 4.6, 5.05, 6.2, 7.0, 7.35, 8.5, 9.15, 10.0, 10.8, 11.45, 12.3, 12.75]
SPANS = [(0.0, 1.0, 5.0), (5.0, 6.5, 5.5)]


def run(*args):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *args], check=True)


class AvSyncTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.dir = Path(cls.tmp.name)
        on = '+'.join(f'between(t,{t},{t + 0.12})' for t in EVENTS)
        cls.take = cls.dir / 'take.mp4'
        run('-f', 'lavfi', '-i', 'color=c=black:s=160x90:r=30:d=13.5',
            '-f', 'lavfi', '-i', 'sine=frequency=880:sample_rate=48000:duration=13.5',
            '-filter_complex', f"[0:v]drawbox=x=40:y=20:w=80:h=50:color=white:t=fill:enable='{on}'[v];"
                               f"[1:a]volume='if({on},0.8,0.0005)':eval=frame[a]",
            '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-g', '15', '-pix_fmt', 'yuv420p', '-c:a', 'aac', str(cls.take))
        cls.edl = cls.dir / 'edl.json'
        cls.edl.write_text(json.dumps({'schema': 'av-sync-edl/1',
                                       'spans': [{'out_s': o, 'src_s': s, 'dur_s': d} for o, s, d in SPANS]}))

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def cut(self, name, sound_slip=0.0, picture_slip=0.0):
        """The two spans joined, with the second span's sound or picture taken that many seconds later in the take."""
        parts = []
        for i, (_, src, dur) in enumerate(SPANS):
            vs = src + (picture_slip if i == 1 else 0.0)
            a_s = src + (sound_slip if i == 1 else 0.0)
            parts.append(f'[0:v]trim=start={vs}:duration={dur},setpts=PTS-STARTPTS[v{i}];'
                         f'[0:a]atrim=start={a_s}:duration={dur},asetpts=PTS-STARTPTS[a{i}];')
        out = self.dir / name
        run('-i', str(self.take), '-filter_complex', ''.join(parts) + '[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]',
            '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', str(out))
        return out

    def test_intact_cut_passes_and_gets_a_receipt(self):
        cut = self.cut('intact.mp4')
        result = av_sync.measure(cut, self.take, self.edl)
        self.assertEqual(result['status'], 'pass', json.dumps(result, indent=1))
        self.assertLessEqual(result['worst_drift_ms'], av_sync.TOLERANCE_MS)
        av_sync.write_receipt(cut, self.take, result)
        self.assertEqual(av_sync.receipt_problems(cut), [])

    def test_sound_slipped_in_one_span_fails(self):
        cut = self.cut('sound-late.mp4', sound_slip=0.2)
        result = av_sync.measure(cut, self.take, self.edl)
        self.assertEqual(result['status'], 'fail', json.dumps(result, indent=1))
        second = result['spans'][1]
        self.assertEqual(second['status'], 'fail')
        self.assertAlmostEqual(abs(second['drift_ms']), 200, delta=40)
        self.assertEqual(result['spans'][0]['status'], 'pass')
        with self.assertRaises(av_sync.AvSyncError):
            av_sync.write_receipt(cut, self.take, result)

    def test_picture_slipped_in_one_span_fails(self):
        cut = self.cut('picture-late.mp4', picture_slip=0.2)
        result = av_sync.measure(cut, self.take, self.edl)
        self.assertEqual(result['status'], 'fail', json.dumps(result, indent=1))
        self.assertAlmostEqual(abs(result['spans'][1]['drift_ms']), 200, delta=40)

    def test_a_cut_with_no_receipt_or_changed_bytes_is_refused(self):
        cut = self.cut('changed.mp4')
        self.assertTrue(av_sync.receipt_problems(cut))
        av_sync.write_receipt(cut, self.take, av_sync.measure(cut, self.take, self.edl))
        with open(cut, 'ab') as handle:
            handle.write(b'\0')
        self.assertTrue(any('different bytes' in p for p in av_sync.receipt_problems(cut)))

    def test_his_filing_exception_waives_the_bed_never_sync(self):
        import bed_shape
        from unittest.mock import patch
        cut = self.cut('excepted.mp4')
        series = '3 Posts/2026-11-11 Wed under.the.hood - X/3 Video/x - wide 16x9 - 5-minute.mp4'
        offday = '3 Posts/2026-11-16 Mon off.day - X/3 Video/x - tall 9x16.mp4'
        exceptions = self.dir / 'exceptions.json'
        exceptions.write_text(json.dumps({'exceptions': [
            {'target': t, 'video_sha256': av_sync.sha256(cut), 'krish_words': 'Krish, 2026-11-12: "yes"'} for t in (series, offday)]}))
        with patch.object(bed_shape, 'EXCEPTIONS', exceptions):
            self.assertTrue(any('picture-against-sound' in p for p in bed_shape.filing_problems(cut, series)))
            self.assertEqual(bed_shape.filing_problems(cut, offday), [])
            av_sync.write_receipt(cut, self.take, av_sync.measure(cut, self.take, self.edl))
            self.assertEqual(bed_shape.filing_problems(cut, series), [])

    def test_making_refuses_a_hand_built_cut_without_its_sync_receipt(self):
        source = (ROOT / 'scripts/post-pack/making.py').read_text(encoding='utf-8')
        block = source[source.index('if approved:\n'):source.index("patch['video_assets'][0]['hand_built']")]
        self.assertIn('av_sync.receipt_problems(a.video_file)', block)
        self.assertIn('problems = ', block)

    def test_the_take_conversion_keeps_picture_with_sound(self):
        flow = (ROOT / '.github/workflows/maxine-trial.yml').read_text(encoding='utf-8')
        self.assertIn('fps=$RATE:round=near', flow)
        self.assertNotIn('-r "$RATE"  -fps_mode', flow)
        self.assertNotRegex(flow, r'-pix_fmt yuv420p -r "\$RATE"')
        self.assertIn('python scripts/av_sync.py measure', flow)

    def test_nothing_to_match_is_never_a_pass(self):
        flat = self.dir / 'flat.mp4'
        run('-f', 'lavfi', '-i', 'color=c=black:s=160x90:r=30:d=10.5', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono',
            '-t', '10.5', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', str(flat))
        result = av_sync.measure(flat, self.take, self.edl)
        self.assertNotEqual(result['status'], 'pass', json.dumps(result, indent=1))


if __name__ == '__main__':
    unittest.main()
