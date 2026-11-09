"""A cut's own music plan (spec cuts.<cut>.music): outside clips heard with their own sound at the ledger's levels,
handing over on a beat, and a bed that enters late and rises slowly. Krish, 2026-11-09, of Wednesday 11 Nov's opening:
"we go straight from the first video track to the second video track and then move into Seize It", "Seize it needs to
fade in much more slowly" and "The fade out of the cat video is glitchy in terms of the video and audio"."""
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

LEVELS = json.loads((ROOT / 'config/music-library.json').read_text(encoding='utf-8'))['levels']


def make(path: Path, graph: str, seconds: float) -> None:
    subprocess.run([ffmpeg(), '-nostdin', '-v', 'error', '-y', '-f', 'lavfi', '-i', graph, '-t', str(seconds),
                    '-ac', '2', '-ar', '48000', str(path)], check=True)


def median(meter: list, start: float, end: float) -> float:
    return float(np.median([v for t, v in meter if start <= t <= end]))


class ClipMusicTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(dir=ROOT / 'tests', prefix='ve-clipmusic-')
        cls.addClassCleanup(cls.temp.cleanup)
        cls.root = Path(cls.temp.name)
        cls.voice, cls.track = cls.root / 'voice.wav', cls.root / 'track.wav'
        cls.song_a, cls.song_b = cls.root / 'song_a.wav', cls.root / 'song_b.wav'
        # he comes in at 3.5 s over the first clip; 4 s speech / 2 s pause to 57 s
        make(cls.voice, "anoisesrc=d=60:c=pink:a=0.5,volume='if(between(t,3.5,57)*lt(mod(t-3.5,6),4),1,0)':eval=frame", 60)
        make(cls.track, 'anoisesrc=d=60:c=brown:a=0.4', 60)
        make(cls.song_a, 'anoisesrc=d=30:c=white:a=0.3', 30)
        make(cls.song_b, 'anoisesrc=d=20:c=pink:a=0.3', 20)
        cls.clips = [
            {'asset': 'song-a', 'src': str(cls.song_a), 'at_s': 0.0, 'end_s': 24.0,
             'points': [{'t': 0.0, 'level': 'open'}, {'t': 3.5, 'level': 'open'}, {'t': 5.0, 'level': 'under'}]},
            {'asset': 'song-b', 'src': str(cls.song_b), 'src_from_s': 1.0, 'at_s': 24.0, 'end_s': 36.0, 'sweep_s': 0.55,
             'points': [{'t': 24.0, 'level': 'under'}]},
        ]
        cls.out = cls.root / 'audio.short.wav'
        cls.result = audio.premix(str(cls.voice), str(cls.track), str(cls.out), 0.0, 60.0, mode='episode_bed',
                                  last_word_end_s=57.0, voice_start_s=3.5, levels=LEVELS, lifts=[],
                                  clips=cls.clips, bed_enter_s=36.0, bed_fade_in_s=6.0, handovers=[[23.5, 24.5]])
        cls.meter = audio.ebur128(str(cls.out.with_suffix('.music.wav')))

    def test_the_music_as_heard_passes_the_one_bed_shape(self):
        shape = self.result['bed']['shape']
        self.assertTrue(shape['pass'], shape['problems'])
        self.assertIn([35.5, 42.0], self.result['bed']['handovers'])  # the late bed's rise is left out, said so

    def test_the_clip_opens_at_the_intro_level_and_sits_at_the_bed_level_under_him(self):
        self.assertAlmostEqual(median(self.meter['M'], 0.4, 3.0), LEVELS['intro_lufs'], delta=1.5)
        self.assertAlmostEqual(median(self.meter['S'], 9.0, 23.0), LEVELS['bed_lufs'], delta=1.5)
        self.assertAlmostEqual(median(self.meter['S'], 28.0, 35.5), LEVELS['bed_lufs'], delta=1.5)

    def test_the_bed_is_silent_until_it_enters_then_rises_slowly_to_its_level(self):
        self.assertLess(median(self.meter['M'], 36.2, 36.6), LEVELS['bed_lufs'] - 20)  # the beat-cut, then near silence
        self.assertLess(median(self.meter['M'], 38.6, 39.0), LEVELS['bed_lufs'] - 3)  # still rising half way
        self.assertAlmostEqual(self.result['bed']['bed_lufs_in_master'], LEVELS['bed_lufs'], delta=0.6)
        self.assertAlmostEqual(median(self.meter['S'], 46.0, 56.0), LEVELS['bed_lufs'], delta=1.5)

    def test_the_mix_is_mastered(self):
        self.assertAlmostEqual(self.result['integrated_lufs'], -14, delta=0.6)
        self.assertLessEqual(self.result['true_peak_dbtp'], -1.0)

    def test_ve_qc_reads_it_leaving_out_the_declared_handovers(self):
        row = qc_audio.bed(str(self.out))
        self.assertTrue(row['pass'], row)
        self.assertTrue(qc_audio.continuity(str(self.out), str(self.out))['pass'])

    def test_two_songs_never_overlap_outside_a_handover(self):
        overlap = [dict(self.clips[0], end_s=26.0), self.clips[1]]
        with self.assertRaisesRegex(ValueError, 'two songs never overlap'):
            audio.check_clips(overlap, 60.0, [])
        self.assertEqual(len(audio.check_clips(overlap, 60.0, [[23.5, 26.5]])), 2)

    def test_a_music_plan_needs_the_episode_bed(self):
        with self.assertRaisesRegex(ValueError, 'episode_bed'):
            audio.premix(str(self.voice), str(self.track), str(self.root / 'x.wav'), 0.0, 60.0, mode='continuous',
                         bed_enter_s=36.0, bed_fade_in_s=6.0)

    def test_a_clip_outside_the_cut_or_on_an_unknown_level_is_refused(self):
        with self.assertRaisesRegex(ValueError, 'inside the cut'):
            audio.check_clips([dict(self.clips[1], end_s=70.0)], 60.0, [])
        with self.assertRaisesRegex(ValueError, 'open, under or off'):
            audio.check_clips([dict(self.clips[1], points=[{'t': 24.0, 'level': 'loud'}])], 60.0, [])

    def test_the_sweep_takes_the_top_off_the_last_beat(self):
        rng = np.random.default_rng(1)
        x = rng.standard_normal((48000, 2))
        swept = audio.lowpass_sweep(x, 24000)
        np.testing.assert_array_equal(swept[:24000], x[:24000])
        tail = np.abs(np.diff(swept[-4800:, 0])).mean() / np.abs(np.diff(x[-4800:, 0])).mean()
        self.assertLess(tail, 0.2)  # the last 0.1 s is under 300 Hz-ish: its sample-to-sample movement collapses


if __name__ == '__main__':
    unittest.main()
