"""Where the beat is in a bed (velib.beats): tempo, bars, drops and a confidence, measured and never snapped to.
Synthetic audio only: a click track with a kick on each bar's first beat, plain noise and silence."""
from __future__ import annotations

import copy
import json
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
sys.path.insert(0, str(ROOT / 'scripts/quick-edit'))
from velib import beats  # noqa: E402

SR = beats.SR


def click_track(bpm: float = 120, seconds: float = 40, loud_from_bar: int | None = None, start: float = 0.25) -> np.ndarray:
    """A click on every beat and a low kick on the first beat of every four; quiet until loud_from_bar."""
    rng = np.random.default_rng(7)
    x = rng.normal(0, 0.002, int(seconds * SR))
    tick = np.arange(int(0.05 * SR)) / SR
    k, t = 0, start
    while t < seconds - 0.2:
        i, gain = int(t * SR), 1.0 if loud_from_bar is None or k // 4 >= loud_from_bar else 0.2
        x[i:i + len(tick)] += gain * 0.3 * np.sin(2 * np.pi * 1500 * tick) * np.exp(-tick * 80)
        if k % 4 == 0:
            x[i:i + len(tick)] += gain * 0.8 * np.sin(2 * np.pi * 60 * tick) * np.exp(-tick * 30)
        k, t = k + 1, t + 60 / bpm
    return x


def write_wav(path: Path, samples: np.ndarray) -> None:
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-',
                    str(path)], input=samples.astype(np.float32).tobytes(), check=True)


class ReadingTest(unittest.TestCase):
    def test_a_steady_track_gets_its_tempo_bars_and_drop(self):
        reading = beats.analyse(click_track(120, loud_from_bar=8))
        self.assertAlmostEqual(reading['tempo_bpm'], 120, delta=1)
        self.assertGreaterEqual(reading['confidence'], beats.CONFIDENT)
        grid = reading['grid']
        self.assertIsNotNone(grid)
        self.assertEqual((grid['beats_per_bar'], grid['bar_offset']), (4, 0), 'the bar starts on the kick')
        self.assertAlmostEqual(grid['first_beat_s'], 0.25, delta=0.02)
        self.assertAlmostEqual(grid['bars_s'][1] - grid['bars_s'][0], 2.0, delta=0.02)
        self.assertEqual(len(reading['drops']), 1)
        self.assertAlmostEqual(reading['drops'][0]['at_s'], 0.25 + 8 * 2.0, delta=0.05, msg='the drop is on bar 8')
        self.assertGreaterEqual(reading['drops'][0]['rise_db'], beats.DROP_DB)
        self.assertAlmostEqual(reading['onsets_per_s'], 2.0, delta=0.3)
        self.assertEqual(reading['note'], beats.NOTE)

    def test_another_tempo_reads_true(self):
        self.assertAlmostEqual(beats.analyse(click_track(97))['tempo_bpm'], 97, delta=1.5)

    def test_no_grid_without_a_steady_pulse(self):
        noise = np.random.default_rng(3).normal(0, 0.1, SR * 30)
        reading = beats.analyse(noise)
        self.assertLess(reading['confidence'], beats.CONFIDENT)
        self.assertIsNone(reading['grid'])
        self.assertIn('no steady pulse', reading['no_grid'])
        silent = beats.analyse(np.zeros(SR * 5))
        self.assertIsNone(silent['tempo_bpm'])
        self.assertIsNone(silent['grid'])


@unittest.skipUnless(shutil.which('ffmpeg'), 'ffmpeg is not on PATH')
class FileTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='ve-beats-')
        self.addCleanup(self.temp.cleanup)
        self.dir = Path(self.temp.name)
        self.wav = self.dir / 'bed.music.wav'
        write_wav(self.wav, click_track(120, seconds=20))

    def test_the_qc_row_measures_and_is_never_counted(self):
        # Beats at 0.25 + 0.5 k s; handovers at frame 45 (1.5 s, between two beats) and frame 68 (2.27 s, on the 2.25 s beat).
        cut_beats = [{'fromFrame': 0}, {'fromFrame': 45}, {'fromFrame': 68}]
        row = beats.qc_row(self.wav, cut_beats, fps=30)
        self.assertEqual((row['status'], row['pass'], row['shadow']), ('advisory', None, True))
        self.assertAlmostEqual(row['value']['tempo_bpm'], 120, delta=1)
        self.assertTrue(row['value']['grid'])
        self.assertEqual(row['value']['handovers'], 2)
        self.assertEqual(row['value']['handovers_on_a_beat'], 1, 'only the handover within two frames of a beat counts')
        self.assertIn('nothing snaps', row['target'])

    def test_ve_qc_shows_the_row_and_never_counts_it(self):
        from unittest.mock import patch
        from velib import qc
        stem = self.dir / 'bed.wav'          # the premix's voice stem; its music stem sits beside it as bed.music.wav

        def run():
            with patch.object(qc, 'loudness', return_value={'integrated_lufs': -14, 'true_peak_dbtp': -1}), \
                    patch.object(qc, 'frame_diffs', return_value=np.full(150, 2.)), \
                    patch.object(qc, 'long_silences', return_value=[]), patch.object(qc, 'sha256_file', return_value='x'), \
                    patch.object(qc, 'duration_s', return_value=5.), \
                    patch('velib.qc_composition.composition_checks', return_value={'applies': False}), \
                    patch('velib.qc_keyframes.keyframe_checks', return_value={'applies': False}):
                return qc.run_qc('unused', 'scoreboard-test', dialogue_master=str(stem),
                                 beats=[{'fromFrame': 0, 'toFrame': 45}, {'fromFrame': 45, 'toFrame': 150}])
        with_bed = run()
        row = with_bed['checks']['music.beats']
        self.assertEqual((row['status'], row['pass'], row['shadow']), ('advisory', None, True))
        self.assertEqual(row['value']['handovers'], 1)
        self.wav.unlink()
        without = run()
        self.assertNotIn('music.beats', without['checks'], 'no music stem, no row')
        self.assertEqual((with_bed['measured_pass'], with_bed['complete']), (without['measured_pass'], without['complete']),
                         'the row changes neither the pass nor completeness')

    def test_a_ledger_track_is_read_only_from_its_own_bytes(self):
        track = {'id': 'a-bed', 'file': 'beds/bed.music.wav', 'sha256': beats.read(self.wav)['sha256']}
        entry = beats.ledger_entry(beats.track_reading(track, self.dir), on='2026-11-15')
        self.assertEqual(entry['of_sha256'], track['sha256'])
        self.assertTrue(entry['grid'])
        self.assertAlmostEqual(entry['period_s'], 0.5, delta=0.005)
        self.assertEqual((entry['beats_per_bar'], entry['measured_on']), (4, '2026-11-15'))
        self.assertNotIn('beats_s', entry, 'the ledger keeps the grid as numbers, never the beat list')
        with self.assertRaises(ValueError):
            beats.track_reading(dict(track, sha256='0' * 64), self.dir)
        with self.assertRaises(FileNotFoundError):
            beats.track_reading(dict(track, file='missing.wav'), self.dir)
        # The music ledger knows the field the grid is written into.
        import music
        ledger = json.loads((ROOT / 'config' / 'music-library.json').read_text(encoding='utf-8'))
        marked = copy.deepcopy(ledger)
        marked['tracks'][0]['beats'] = entry
        _, warnings = music.check(marked)
        self.assertFalse([w for w in warnings if w.startswith(marked['tracks'][0]['id'] + ':') and 'beats' in w])


if __name__ == '__main__':
    unittest.main(verbosity=1)
