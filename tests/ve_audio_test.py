"""The premixed stem: continuous, ducked and episode_bed bed, measured against the voice, and the QC row that reads the numbers."""
from __future__ import annotations

import json
import shutil
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
        # Krish rejected the ducked bed on both of Friday 23's cuts (Gate 2, 2026-10-30): QC refuses it now
        row = qc_audio.bed(result['stem'])
        self.assertFalse(row['pass'])
        self.assertFalse({r['check']: r for r in row['value']}['a steady bed']['pass'])

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
        duration = bed.pop('duration_s', 36.0)
        base = {'mode': 'continuous', 'bed_present': True, 'bed_under_speech_db': -18.0, 'bed_in_pauses_db': -18.0,
                'duck_depth_db': 0.0, 'bed_loud_windows_pct': 95.0}
        base.update(bed)
        folder = tempfile.TemporaryDirectory(dir=ROOT / 'tests', prefix='ve-audio-qc-')
        self.addCleanup(folder.cleanup)
        stem = Path(folder.name) / 'audio.cut.wav'
        stem.with_suffix('.bed.json').write_text(json.dumps({'true_peak_dbtp': -1.2, 'duration_s': duration, 'bed': base}), encoding='utf-8')
        return str(stem)

    def test_a_good_continuous_short_passes_and_a_ducked_or_long_one_fails(self):
        self.assertTrue(qc_audio.bed(self.sidecar())['pass'])
        self.assertFalse(qc_audio.bed(self.sidecar(mode='ducked', bed_in_pauses_db=-10.0, duck_depth_db=8.0))['pass'])
        self.assertFalse(qc_audio.bed(self.sidecar(duration_s=324.0))['pass'])

    def test_missing_numbers_are_not_run_never_a_pass(self):
        result = qc_audio.bed(str(ROOT / 'tests' / 'no-such-stem.wav'))
        self.assertIsNone(result['pass'])
        self.assertEqual(result['status'], 'not_run')

    def test_each_failure_fails_the_row(self):
        for change in ({'bed_present': False}, {'bed_under_speech_db': -40.0},
                       {'bed_under_speech_db': -8.0}, {'bed_loud_windows_pct': 20.0}):
            with self.subTest(change=change):
                self.assertFalse(qc_audio.bed(self.sidecar(**change))['pass'])

    def test_clipping_fails_and_mode_mismatch_fails(self):
        stem = self.sidecar()
        path = Path(stem).with_suffix('.bed.json')
        data = json.loads(path.read_text())
        data['true_peak_dbtp'] = -0.2
        path.write_text(json.dumps(data))
        self.assertFalse(qc_audio.bed(stem)['pass'])
        self.assertFalse(qc_audio.bed(self.sidecar(), mode='episode_bed')['pass'])


LEVELS = {'bed_lufs': -31, 'intro_lufs': -16, 'outro_lufs': -18, 'chapter_lufs': -22}


def spread(path: str, start: float, end: float) -> float:
    short = [v for t, v in audio.ebur128(path)['S'] if start + 3 <= t < end]
    return float(np.percentile(short, 95) - np.percentile(short, 5))


class EpisodeBedTest(unittest.TestCase):
    """The long-cut bed. Krish, Gate 2, 2026-10-30, of the ducked bed on Friday 23's long cut: "Sometimes it just
    turns off randomly. Sometimes it's quiet. Sometimes it gets louder." The track here is shorter than the cut and
    has its own loud and quiet passages (10 dB apart), the two things the real long cut met."""

    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(dir=ROOT / 'tests', prefix='ve-episode-')
        cls.addClassCleanup(cls.temp.cleanup)
        cls.root = Path(cls.temp.name)
        cls.voice, cls.track = cls.root / 'voice.wav', cls.root / 'track.wav'
        # 0.6 s of quiet before the first word, then 4 s speech / 2 s pause; last word ends at 57 s
        make(cls.voice, "anoisesrc=d=60:c=pink:a=0.5,volume='if(between(t,0.6,57)*lt(mod(t-0.6,6),4),1,0)':eval=frame", 60)
        make(cls.track, "anoisesrc=d=22:c=brown:a=0.4,volume='if(lt(mod(t,14),7),1,0.316)':eval=frame", 22)
        cls.out = cls.root / 'audio.long.wav'
        cls.result = audio.premix(str(cls.voice), str(cls.track), str(cls.out), 0.0, 60.0, mode='episode_bed',
                                  last_word_end_s=57.0, voice_start_s=0.6, levels=LEVELS, lifts=[[30.0, 33.0]])
        cls.music = str(cls.out.with_suffix('.music.wav'))

    def test_the_bed_sits_at_the_approved_level_in_the_master(self):
        bed = self.result['bed']
        self.assertEqual(bed['mode'], 'episode_bed')
        self.assertAlmostEqual(bed['bed_lufs_in_master'], -31, delta=0.6)
        self.assertAlmostEqual(self.result['integrated_lufs'], -14, delta=0.6)
        self.assertLessEqual(self.result['true_peak_dbtp'], -1.0)

    def test_a_track_shorter_than_the_cut_restarts_under_crossfades(self):
        self.assertGreaterEqual(len(self.result['bed']['crossfades_s']), 2)
        self.assertEqual(self.result['bed']['crossfade_s'], 2.0)

    def test_it_is_not_keyed_by_the_voice(self):
        # under speech and in pauses the music is at one level: no ducking
        self.assertLess(abs(self.result['bed']['duck_depth_db']), 1.5)

    def test_it_holds_one_level_and_never_drops_out(self):
        row = qc_audio.bed(str(self.out))
        self.assertTrue(row['pass'], row)
        checks = {r['check']: r for r in row['value']}
        self.assertLessEqual(checks['bed holds one level']['value'], qc_audio.MAX_SPREAD_LU)
        self.assertEqual(checks['bed never drops out']['value'], [])

    def test_it_lifts_in_the_chapter_window(self):
        meter = dict(audio.ebur128(self.music)['M'])
        lifted = np.median([v for t, v in meter.items() if 30.5 <= t <= 32.5])
        body = np.median([v for t, v in meter.items() if 10 <= t <= 25])
        self.assertGreater(lifted - body, 6)

    def test_the_render_has_no_drop_out(self):
        row = qc_audio.continuity(str(self.out), str(self.out))
        self.assertTrue(row['pass'], row)

    def test_the_render_check_finds_a_stretch_with_no_music(self):
        holed = self.root / 'holed.wav'
        # the same mix with the music gone for 0.3 s inside one pause (22.6-24.6 s), where only music plays: as long
        # as the stop in Friday 23's track, which a 400 ms loudness meter cannot see
        graph = "[1:a]volume='if(between(t,22.8,23.1),0,1)':eval=frame[m];[0:a][m]amix=inputs=2:normalize=0[o]"
        subprocess.run([ffmpeg(), '-v', 'error', '-y', '-i', str(self.voice), '-i', self.music, '-filter_complex', graph,
                        '-map', '[o]', str(holed)], check=True)
        shutil.copy(self.out.with_suffix('.bed.json'), holed.with_suffix('.bed.json'))
        row = qc_audio.continuity(str(holed), str(holed))
        self.assertFalse(row['pass'], row)
        self.assertTrue(any(22.7 <= start <= 23.2 for start, _ in row['value']), row)

    def test_the_old_ducked_bed_fails_the_steady_level_meter(self):
        # the mechanism behind the Gate 2 verdict: a voice-keyed duck swings the music by pauses and speech
        tmp_dialogue, tmp_bed, stem = (str(self.root / n) for n in ('d.wav', 'b.wav', 'ducked.music.wav'))
        shutil.copy(self.voice, tmp_dialogue)
        make(Path(tmp_bed), "anoisesrc=d=60:c=brown:a=0.4", 60)
        audio._ducked_bed(tmp_dialogue, tmp_bed, stem, gain_db=-12, threshold=0.009, duration_s=60.0, last_word_end_s=57.0)
        self.assertGreater(spread(stem, 1.5, 57.0), qc_audio.MAX_SPREAD_LU)
        self.assertLessEqual(spread(self.music, 1.5, 27.0), qc_audio.MAX_SPREAD_LU)

    def test_a_render_that_is_missing_or_short_fails(self):
        self.assertFalse(qc_audio.continuity(str(self.root / 'no-such.wav'), str(self.out))['pass'])
        short = self.root / 'short.wav'
        subprocess.run([ffmpeg(), '-v', 'error', '-y', '-i', str(self.out), '-t', '50', str(short)], check=True)
        self.assertFalse(qc_audio.continuity(str(short), str(self.out))['pass'])

    def test_dialogue_shorter_than_the_cut_is_padded_and_the_bed_runs_to_the_end(self):
        voice, out = self.root / 'voice40.wav', self.root / 'audio.pad.wav'
        make(voice, "anoisesrc=d=40:c=pink:a=0.5,volume='if(between(t,0.6,39)*lt(mod(t-0.6,6),4),1,0)':eval=frame", 40)
        result = audio.premix(str(voice), str(self.track), str(out), 0.0, 43.9, mode='episode_bed',
                              last_word_end_s=39.0, voice_start_s=0.6, levels=LEVELS, lifts=[])
        self.assertAlmostEqual(len(audio._decode(result['stem'])) / audio.SR, 43.9, delta=0.02)
        self.assertTrue(qc_audio.continuity(str(out), str(out))['pass'])

    def test_a_lift_outside_the_cut_is_refused(self):
        for bad in ([[33.0, 30.0]], [[58.0, 61.0]], [[-1.0, 2.0]]):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                audio.premix(str(self.voice), str(self.track), str(self.root / 'z.wav'), 0.0, 60.0, mode='episode_bed',
                             last_word_end_s=57.0, voice_start_s=0.6, levels=LEVELS, lifts=bad)

    def test_a_short_stop_is_seen(self):
        # 0.3 s, 30 dB down, inside full-level music: the stop in Friday 23's track
        with tempfile.TemporaryDirectory(dir=ROOT / 'tests', prefix='ve-gap-') as folder:
            path = Path(folder) / 'gap.wav'
            make(path, "anoisesrc=d=20:c=brown:a=0.4,volume='if(between(t,10,10.3),0.03,1)':eval=frame", 20)
            found = audio.gaps(audio._decode(str(path)))
            self.assertTrue(any(9.9 <= a <= 10.1 and n >= 0.25 for a, n in found), found)
            self.assertTrue(any(a <= 10.0 and b >= 10.3 for a, b in audio.track_stops(str(path))))

    def test_episode_bed_without_levels_is_refused(self):
        with self.assertRaises(ValueError):
            audio.premix(str(self.voice), str(self.track), str(self.root / 'x.wav'), 0.0, 10.0, mode='episode_bed', lifts=[])

    def test_a_bed_shorter_than_the_cut_is_refused_outside_episode_bed(self):
        with self.assertRaises(ValueError):
            audio.premix(str(self.voice), str(self.track), str(self.root / 'y.wav'), 0.0, 60.0, mode='continuous')

    def test_a_music_stem_with_swings_or_a_hole_fails_the_row(self):
        data = json.loads(self.out.with_suffix('.bed.json').read_text())
        for name, graph in (('swing', "volume='if(lt(mod(t,10),5),1,0.2)':eval=frame"),
                            ('hole', "volume='if(between(t,20,20.3),0,1)':eval=frame"),
                            ('swell', "volume='if(between(t,14,16.5),2.24,1)':eval=frame")):
            with self.subTest(name=name):
                folder = self.root / name
                folder.mkdir(exist_ok=True)
                music = folder / 'audio.cut.music.wav'
                subprocess.run([ffmpeg(), '-v', 'error', '-y', '-i', self.music, '-af', graph, str(music)], check=True)
                (folder / 'audio.cut.bed.json').write_text(json.dumps(data))
                row = qc_audio.bed(str(folder / 'audio.cut.wav'))
                self.assertFalse(row['pass'], row)


class TileTest(unittest.TestCase):
    def test_tiling_covers_the_cut_with_no_run_longer_than_the_track(self):
        track = np.ones((audio.SR * 10, 2)) * 0.1
        bed, centres = audio.tile(track, audio.SR * 33)
        self.assertEqual(len(bed), audio.SR * 33)
        self.assertEqual(len(centres), 3)
        # an equal-power crossfade of a steady signal never dips more than 3 dB
        self.assertGreater(float(np.abs(bed).min()), 0.1 * 10 ** (-3.1 / 20))

    def test_the_tracks_own_stop_is_found_and_played_around(self):
        # Friday 23's track stops for about 0.3 s at 73.2 s, about 30 dB down; this one stops at 12 s for 0.6 s
        with tempfile.TemporaryDirectory(dir=ROOT / 'tests', prefix='ve-stop-') as folder:
            path = Path(folder) / 'stop.wav'
            make(path, "anoisesrc=d=30:c=brown:a=0.4,volume='if(between(t,12,12.6),0.01,1)':eval=frame", 30)
            stops = audio.track_stops(str(path))
            self.assertTrue(any(a <= 12.1 and b >= 12.55 for a, b in stops), stops)
            track = audio._decode_stereo(str(path))
            bed, centres = audio.tile(track, audio.SR * 70, stops=stops)
            self.assertTrue(centres)
            windows = audio._window_db(bed.mean(axis=1))
            self.assertGreater(float(windows.min()), float(np.median(windows)) - 6)


    def test_a_restart_skips_the_tracks_sparse_intro_and_the_first_play_keeps_it(self):
        # Friday 23's long cut restarted NO CURVES at 172 s into its sparse first 18 s, and the bed sagged under a
        # pause in the voice (the independent review's block, 30 Oct 2026). Here: 6 s of single hits, then a steady body.
        sr = audio.SR
        hits = np.zeros((sr * 6, 2))
        for k in range(6):
            hits[k * sr:k * sr + sr // 10] = 0.3
        track = np.vstack([hits, np.ones((sr * 14, 2)) * 0.3])
        with tempfile.TemporaryDirectory(dir=ROOT / 'tests', prefix='ve-intro-') as folder:
            path = Path(folder) / 'intro.wav'
            audio._write_stereo(track, str(path))
            intro = audio.track_intro(str(path))
        self.assertTrue(5.5 <= intro <= 6.5, intro)
        bed, centres = audio.tile(track, sr * 50, restart_from_s=intro)
        self.assertTrue(centres)
        first = audio._short_db(bed[:sr * 6].mean(axis=1))
        self.assertLess(float(first.min()), -40)  # the first play keeps the intro
        after = audio._short_db(bed[int((centres[0] + audio.CROSSFADE_S) * sr):].mean(axis=1))
        self.assertGreater(float(after.min()), -12)  # no restart lands in it


class PremixLedgerTest(unittest.TestCase):
    def test_premix_reads_the_committed_music_ledger(self):
        import ve
        self.assertTrue(ve.MUSIC_LEDGER.is_file(), ve.MUSIC_LEDGER)
        spec = json.loads((ROOT / 'docs/plans/2026-10-23-friday-two-passports-long-ve/ve/spec.json').read_text(encoding='utf-8'))
        ids = {t['id'] for t in json.loads(ve.MUSIC_LEDGER.read_text(encoding='utf-8'))['tracks'] if t.get('status') == 'approved'}
        self.assertIn(spec['audio']['bed']['ledger_id'], ids)


if __name__ == '__main__':
    unittest.main()
