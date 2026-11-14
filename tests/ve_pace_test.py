"""ve pace (velib.pace): events a second, motion energy and how much of the frame is used, placed among the references
Krish keeps. Krish, 2026-11-13, of the 3D style test cuts: "the use of the screen space is terrible, the motion is 10X
too slow". Synthetic clips: a still small box (the rejected look), and a full frame of boxes that change every few
frames (the references' look)."""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import pace  # noqa: E402
from velib.common import ffmpeg  # noqa: E402


def still_small(path: Path) -> Path:
    """Six seconds of a dark tall frame with one small box in a band that moves once, at 3 s."""
    subprocess.run([ffmpeg(), '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x101010:s=360x640:r=30:d=6',
                    '-vf', "drawbox=x='if(lt(t\\,3)\\,120\\,140)':y=200:w=120:h=90:c=0xe0d0b0:t=fill",
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', str(path)], check=True)
    return path


def busy_full(path: Path) -> Path:
    """Six seconds of a full test pattern under boxes that jump to a new place every 0.2 s."""
    boxes = ','.join(f"drawbox=x='mod(floor(t*5)*{37 + 13 * i}+{40 * i}\\,300)':y='mod(floor(t*5)*{53 + 7 * i}+{90 * i}\\,560)'"
                     f":w=80:h=80:c=0x{['f0e0c0', '40c0a0', 'c04030'][i % 3]}:t=fill" for i in range(6))
    subprocess.run([ffmpeg(), '-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=360x640:r=30:d=6',
                    '-vf', boxes, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', str(path)], check=True)
    return path


class PaceTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='ve-pace-')
        self.addCleanup(self.temp.cleanup)
        self.dir = Path(self.temp.name)

    def test_a_still_small_set_reads_slow_and_empty_and_a_busy_full_frame_reads_fast_and_full(self):
        slow = pace.measure(still_small(self.dir / 'slow.mp4'))
        fast = pace.measure(busy_full(self.dir / 'fast.mp4'))
        self.assertLess(slow['events_per_s'], 0.5)
        self.assertGreater(slow['longest_gap_s'], 2.5)
        self.assertLess(slow['used_frame'], 0.2)
        self.assertGreater(fast['events_per_s'], 2.0)
        self.assertLess(fast['longest_gap_s'], 1.0)
        self.assertGreater(fast['used_frame'], 0.5)
        self.assertGreater(fast['used_frame'], slow['used_frame'] * 3)
        self.assertGreater(fast['energy_median'], slow['energy_median'])
        self.assertIn('never a target', slow['note'])

    def test_compare_flags_only_what_falls_outside_every_reference(self):
        refs = [{'events_per_s': 3.0, 'longest_gap_s': 1.0, 'energy_median': 2.0, 'used_frame': 0.8, 'active_frame': 0.5},
                {'events_per_s': 4.5, 'longest_gap_s': 2.5, 'energy_median': 9.0, 'used_frame': 0.9, 'active_frame': 1.0}]
        cut = {'file': 'cut.mp4', 'events_per_s': 0.4, 'longest_gap_s': 5.2, 'energy_median': 3.0, 'used_frame': 0.3,
               'active_frame': 0.6}
        verdict = pace.compare(cut, refs)
        self.assertEqual(sorted(verdict['below_all']), ['events_per_s', 'longest_gap_s', 'used_frame'])
        self.assertEqual(verdict['rows']['events_per_s']['x_of_median'], round(0.4 / 3.75, 2))

    def test_the_reference_table_holds_his_references_measured_on_this_grid(self):
        table = json.loads((ROOT / 'config' / 've' / 'pace-references.json').read_text(encoding='utf-8'))
        self.assertEqual(table['grid'], [pace.GRID_W, pace.GRID_H, pace.SAMPLE_FPS])
        ledger = {r['file'] for r in json.loads((ROOT / 'config' / 'style-references.json').read_text(encoding='utf-8'))['references']}
        self.assertGreaterEqual(len(table['references']), 5)
        for row in table['references']:
            self.assertIn(row['file'], ledger)
            for key in pace.SUMMARY:
                self.assertIsInstance(row[key], (int, float))


if __name__ == '__main__':
    unittest.main()
