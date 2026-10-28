"""The premixed stem: continuous and ducked bed, measured against the voice, and the QC row that reads the numbers."""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))

from velib import audio, qc_audio  # noqa: E402
from velib.common import ffmpeg  # noqa: E402


def make(path: Path, graph: str, seconds: float) -> None:
    subprocess.run([ffmpeg(), '-nostdin', '-v', 'error', '-y', '-f', 'lavfi', '-i', graph, '-t', str(seconds),
                    '-ac', '2', '-ar', '48000', str(path)], check=True)


class AnalyseTest(unittest.TestCase):
    def test_levels_under_speech_and_in_pauses_are_relative_to_the_voice(self):
        rng = np.random.default_rng(1)
        n = audio.SR * 30
        t = np.arange(n) / audio.SR
        voice = rng.normal(0, 0.1, n).astype(np.float32) * (np.mod(t, 6) < 4)     # 4 s speech, 2 s pause
        bed = rng.normal(0, 0.1, n).astype(np.float32)
        bed *= np.where(np.mod(t, 6) < 4, 10 ** (-18 / 20), 10 ** (-9 / 20))        # -18 under speech, -9 in pauses
        result = audio.analyse(voice, bed, last_word_end_s=29.0)
        self.assertAlmostEqual(result['bed_under_speech_db'], -18, delta=0.8)
        self.assertAlmostEqual(result['bed_in_pauses_db'], -9, delta=0.8)
        self.assertAlmostEqual(result['duck_depth_db'], 9, delta=1.2)
        self.assertGreater(result['speech_windows'], 20)
        self.assertGreater(result['pause_windows'], 8)

    def test_a_silent_bed_is_measured_as_silent(self):
        voice = (np.random.default_rng(2).normal(0, 0.1, audio.SR * 10)).astype(np.float32)
        result = audio.analyse(voice, np.zeros_like(voice))
        self.assertLess(result['bed_under_speech_db'], -80)
        self.assertEqual(result['bed_loud_windows_pct'], 0.0)


class PremixTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(dir=ROOT / 'tests', prefix='ve-audio-')
        cls.addClassCleanup(cls.temp.cleanup)
        cls.root = Path(cls.temp.name)
        cls.voice, cls.bed = cls.root / 'voice.wav', cls.root / 'bed.wav'
        make(cls.voice, "anoisesrc=d=36:c=pink:a=0.5,volume='if(lt(mod(t,6),4),1,0)':eval=frame", 36)
        make(cls.bed, "anoisesrc=d=60:c=brown:a=0.4", 60)

    def run_mix(self, mode):
        out = self.root / f'stem-{mode}.wav'
        result = audio.premix(str(self.voice), str(self.bed), str(out), 0.0, 36.0, mode=mode, last_word_end_s=33.0)
        self.assertTrue(out.with_suffix('.bed.json').is_file())
        return result

    def test_ducked_bed_breathes_and_masters_clean(self):
        result = self.run_mix('ducked')
        bed = result['bed']
        self.assertEqual(bed['mode'], 'ducked')
        self.assertLessEqual(bed['bed_under_speech_db'], -16.5)
        self.assertGreaterEqual(bed['bed_under_speech_db'], -21)
        self.assertGreaterEqual(bed['bed_in_pauses_db'], -13)
        self.assertLessEqual(bed['bed_in_pauses_db'], -6)
        self.assertGreaterEqual(bed['duck_depth_db'], 4)
        self.assertAlmostEqual(result['integrated_lufs'], -14, delta=0.6)
        self.assertLessEqual(result['true_peak_dbtp'], -1.0)
        self.assertTrue(qc_audio.bed(result['stem'])['pass'])

    def test_continuous_bed_still_works_and_is_flat(self):
        result = self.run_mix('continuous')
        bed = result['bed']
        self.assertEqual(bed['mode'], 'continuous')
        self.assertLess(abs(bed['duck_depth_db']), 2)
        self.assertAlmostEqual(result['integrated_lufs'], -14, delta=0.6)
        self.assertLessEqual(result['true_peak_dbtp'], -1.0)
        # a flat bed has no pauses to breathe in, and is not asked to
        self.assertTrue(qc_audio.bed(result['stem'])['pass'])

    def test_unknown_mode_is_refused(self):
        with self.assertRaises(ValueError):
            audio.premix(str(self.voice), str(self.bed), str(self.root / 'x.wav'), 0.0, 5.0, mode='loud')


class QcRowTest(unittest.TestCase):
    def sidecar(self, **bed):
        base = {'mode': 'ducked', 'bed_present': True, 'bed_under_speech_db': -18.0, 'bed_in_pauses_db': -10.0,
                'duck_depth_db': 8.0, 'bed_loud_windows_pct': 95.0}
        base.update(bed)
        folder = tempfile.TemporaryDirectory(dir=ROOT / 'tests', prefix='ve-audio-qc-')
        self.addCleanup(folder.cleanup)
        stem = Path(folder.name) / 'audio.cut.wav'
        stem.with_suffix('.bed.json').write_text(json.dumps({'true_peak_dbtp': -1.2, 'bed': base}), encoding='utf-8')
        return str(stem)

    def test_a_good_ducked_bed_passes(self):
        self.assertTrue(qc_audio.bed(self.sidecar())['pass'])

    def test_missing_numbers_are_not_run_never_a_pass(self):
        result = qc_audio.bed(str(ROOT / 'tests' / 'no-such-stem.wav'))
        self.assertIsNone(result['pass'])
        self.assertEqual(result['status'], 'not_run')

    def test_each_failure_fails_the_row(self):
        for change in ({'bed_present': False}, {'bed_under_speech_db': -40.0, 'duck_depth_db': 30.0},
                       {'bed_under_speech_db': -8.0}, {'bed_in_pauses_db': -30.0, 'duck_depth_db': 12.0},
                       {'duck_depth_db': 1.0, 'bed_in_pauses_db': -17.0}, {'bed_loud_windows_pct': 20.0}):
            with self.subTest(change=change):
                self.assertFalse(qc_audio.bed(self.sidecar(**change))['pass'])

    def test_clipping_fails_and_mode_mismatch_fails(self):
        stem = self.sidecar()
        path = Path(stem).with_suffix('.bed.json')
        data = json.loads(path.read_text())
        data['true_peak_dbtp'] = -0.2
        path.write_text(json.dumps(data))
        self.assertFalse(qc_audio.bed(stem)['pass'])
        self.assertFalse(qc_audio.bed(self.sidecar(), mode='continuous')['pass'])

    def test_continuous_is_not_asked_to_breathe(self):
        self.assertTrue(qc_audio.bed(self.sidecar(mode='continuous', bed_in_pauses_db=-18.0, duck_depth_db=0.0))['pass'])


if __name__ == '__main__':
    unittest.main()
