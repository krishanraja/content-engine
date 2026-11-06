"""The one music bed shape, both engines, and the filing gate (config/music-bed.json).

Krish, 2026-11-04: "the volume of the backing music goes up and down about 30 or 40 times in 90 seconds. It should
just start loudly and then get a little bit softer, so my voice is the main character, but with atmosphere in the
background, and then get louder at the end." Then: "Just make sure it never happens again."

A synthetic 90 s voice with pauses and a steady music track go through each engine's bed path (quick-edit's envelope
bed, quick-edit's episode bed, ve's premix); the bed stem alone must pass the bed-shape QC and read as three phases
(loud, under the voice, loud). The Wednesday compositor's own sidechain, rendered on the same voice and music, must
fail the same QC and the repository check. A video from a per-day compositor, with no receipt, is refused by every
filing route."""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
for sub in ('scripts', 'scripts/quick-edit', 'scripts/post-pack'):
    sys.path.insert(0, str(ROOT / sub))

import audio_quality  # noqa: E402
import bed_shape  # noqa: E402
import check_music_bed  # noqa: E402
import library  # noqa: E402
import music  # noqa: E402
import quality  # noqa: E402
import send  # noqa: E402
from velib import audio, filing, packet  # noqa: E402
from velib.common import ffmpeg  # noqa: E402

LEVELS = json.loads((ROOT / 'config/music-library.json').read_text(encoding='utf-8'))['levels']
T, VS, VE = 90.0, 0.4, 86.0
WEDNESDAY = ROOT / 'docs/plans/2026-11-04-wednesday/rebuild/compose.py'


def make(path: Path, source: str, seconds: float) -> None:
    subprocess.run([ffmpeg(), '-v', 'error', '-y', '-f', 'lavfi', '-i', source, '-t', str(seconds), '-ac', '2', '-ar', '48000',
                    str(path)], check=True)


def meter(path: Path) -> list:
    return [(p['t'], p.get('M', -120.0), p.get('S', -120.0)) for p in audio_quality.measure(path)['points']]


def phases(rows, total: float, swing: float = 3.0) -> list[str]:
    """The bed's phases, from the momentary meter smoothed over 2 s: 'loud' over the bed's median under the voice by
    `swing` or more, else 'bed'; runs collapsed. The final fade is left out."""
    body = sorted(m for t, m, _ in rows if 10 <= t <= 80)
    median = body[len(body) // 2]
    ms = [m for t, m, _ in rows if 0.4 <= t <= total - 1.2]
    smooth = [sum(ms[i:i + 20]) / 20 for i in range(0, len(ms) - 19)]
    out = []
    for v in smooth:
        name = 'loud' if v >= median + swing else 'bed'
        if not out or out[-1] != name:
            out.append(name)
    return out


class Fixture(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='music-bed-')
        cls.addClassCleanup(cls.temp.cleanup)
        cls.root = Path(cls.temp.name)
        cls.voice, cls.track = cls.root / 'voice.wav', cls.root / 'track.wav'
        # His voice: phrases of 3 s with 1.5 s pauses from 0.4 s to 86 s, then the end card.
        make(cls.voice, f"anoisesrc=d={T}:c=pink:a=0.5,volume='if(between(t,{VS},{VE})*lt(mod(t-{VS},4.5),3),1,0)':eval=frame", T)
        make(cls.track, 'anoisesrc=d=120:c=brown:a=0.4', 120)
        cls.tl = {'intro_s': 0.0, 'voice_start_s': VS, 'voice_end_s': VE, 'total_s': T, 'main_s': T - 4, 'outro_s': 4.0}
        cls.track_info = {'id': 'synthetic', 'measured_lufs': music.ebur128(cls.track)['I'], 'intro_cue_s': 0.0,
                          'duration_s': 120.0, 'loopable': False}


class TheShape(Fixture):
    def test_the_shape_numbers(self):
        turns = bed_shape.timings(VS, VE, T)
        self.assertEqual((turns['open_end'], turns['bed_from'], turns['bed_to'], turns['close_full'], turns['fade_from']),
                         (1.5, 3.0, VE, VE + 1.0, T - 1.0))
        points = dict(bed_shape.target_points(LEVELS, VS, VE, T))
        self.assertEqual((points[0.0], points[1.5], points[3.0], points[VE], points[VE + 1.0]),
                         (LEVELS['intro_lufs'], LEVELS['intro_lufs'], LEVELS['bed_lufs'], LEVELS['bed_lufs'], LEVELS['outro_lufs']))
        # a sting keeps its open: the ease lands as his first word starts
        sting = bed_shape.timings(5.0, VE, T)
        self.assertEqual((sting['open_end'], sting['bed_from']), (3.5, 5.0))
        # Behind the 56-frame intro sting on the wide cut (Krish, 2026-11-05: "I think it should go at the start of the
        # longer wide videos 100%,") his first word lands about 0.12 s after the sting's last frame. The shape is
        # unchanged: the open holds its 1.5 s and the ease lands at 3.0 s, so it starts in the sting's last 11 frames;
        # a first word later than 3.0 s moves the ease with it.
        lead = 56 / 30
        behind = bed_shape.timings(lead + 0.12, VE + lead, T + lead)
        self.assertEqual((behind['open_end'], behind['bed_from'], behind['bed_to']), (1.5, 3.0, round(VE + lead, 4)))
        late = bed_shape.timings(lead + 2.0, VE + lead, T + lead)
        self.assertEqual((late['open_end'], late['bed_from']), (round(lead + 0.5, 4), round(lead + 2.0, 4)))

    def test_quick_edit_envelope_bed_is_three_phases(self):
        bed = self.root / 'qe-bed.wav'
        subprocess.run([ffmpeg(), '-v', 'error', '-y', '-i', str(self.track), '-filter_complex',
                        music.bed_filter(self.track_info, self.tl, LEVELS, out='bed'), '-map', '[bed]', '-c:a', 'pcm_f32le',
                        str(bed)], check=True)
        rows = meter(bed)
        result = audio_quality.shape_qc(audio_quality.measure(bed), self.tl)
        self.assertTrue(result['pass'], result)
        self.assertLessEqual(result['direction_changes'], 2)
        self.assertGreaterEqual(result['open_over_bed_lu'], 6)
        self.assertGreaterEqual(result['end_over_bed_lu'], 6)
        self.assertEqual(phases(rows, T), ['loud', 'bed', 'loud'])

    def test_quick_edit_episode_bed_is_three_phases_with_its_chapter_lift(self):
        cards = [(40.0, 43.0)]
        chain, _ = music.continuous_episode_bed(dict(self.track_info), self.tl,
                                                {**LEVELS, 'bed_lufs': -31, 'chapter_lufs': -31, 'intro_lufs': -31, 'outro_lufs': -31}, cards)
        raw, stem = self.root / 'ep-raw.wav', self.root / 'ep-bed.wav'
        subprocess.run([ffmpeg(), '-v', 'error', '-y', '-i', str(self.track), '-filter_complex', chain, '-map', '[bed]',
                        '-c:a', 'pcm_s16le', str(raw)], check=True)
        audio_quality.level_bed(raw, stem, self.tl, {**LEVELS, 'chapter_lufs': -22}, cards)
        measured = audio_quality.measure(stem)
        result = audio_quality.shape_qc(measured, self.tl, cards)
        self.assertTrue(result['pass'], result)
        rows = [(t, m, s) for t, m, s in meter(stem) if not 36 <= t <= 47]
        self.assertEqual(phases(rows, T), ['loud', 'bed', 'loud'])

    def test_ve_premix_bed_is_three_phases(self):
        out = self.root / 've' / 'audio.wav'
        result = audio.premix(str(self.voice), str(self.track), str(out), 0.0, T, mode='episode_bed', last_word_end_s=VE,
                              voice_start_s=VS, levels={**LEVELS, 'chapter_lufs': -22}, lifts=[])
        shape = result['bed']['shape']
        self.assertTrue(shape['pass'], shape)
        self.assertLessEqual(shape['direction_changes'], 2)
        self.assertEqual(phases(meter(out.with_suffix('.music.wav')), T), ['loud', 'bed', 'loud'])

    def test_ve_premix_behind_a_56_frame_sting_is_three_phases(self):
        # The wide cut's stem starts on the sting's first frame: the bed from sample 0, his voice 56 frames in.
        lead = 56 / 30
        out = self.root / 've-sting' / 'audio.wav'
        result = audio.premix(str(self.voice), str(self.track), str(out), 0.0, T + lead, mode='episode_bed',
                              last_word_end_s=VE + lead, voice_start_s=VS + lead, levels={**LEVELS, 'chapter_lufs': -22},
                              lifts=[], lead_frames=56)
        shape = result['bed']['shape']
        self.assertTrue(shape['pass'], shape)
        self.assertLessEqual(shape['direction_changes'], 2)
        self.assertGreaterEqual(shape['open_over_bed_lu'], 6)
        self.assertEqual(result['lead_frames'], 56)
        rows = meter(out.with_suffix('.music.wav'))
        self.assertEqual(phases(rows, T + lead), ['loud', 'bed', 'loud'])
        body = sorted(m for t, m, _ in rows if 10 <= t <= 80)
        self.assertGreaterEqual(min(m for t, m, _ in rows if 0.4 <= t <= lead) - body[len(body) // 2], 6,
                                'loud under the whole sting')

    def test_ve_cannot_make_a_ducked_bed(self):
        with self.assertRaises(ValueError) as caught:
            audio.premix(str(self.voice), str(self.track), str(self.root / 'ducked' / 'audio.wav'), 0.0, T, mode='ducked',
                         last_word_end_s=VE)
        self.assertIn('ducked bed is refused', str(caught.exception))

    def test_wednesdays_sidechain_pumps_and_fails_the_shape(self):
        # The filter the Wednesday compositor ran, read from its own file, on the same voice and music.
        source = WEDNESDAY.read_text(encoding='utf-8')
        graph = re.search(r"'(\[0:a\]asplit\[vo\]\[key\];[^']*)'", source).group(1)
        self.assertEqual(check_music_bed.main(['--text', graph]), 1)
        self.assertTrue(check_music_bed.found(graph, check_music_bed.rules()))
        duck = re.search(r'sidechaincompress=[^\[]*', graph).group(0)
        stem = self.root / 'wednesday-bed.wav'
        # as the compositor did: the bed at 0.25 under him, keyed by his voice; here the ducked bed alone
        subprocess.run([ffmpeg(), '-v', 'error', '-y', '-i', str(self.voice), '-i', str(self.track), '-filter_complex',
                        f'[0:a]aformat=sample_rates=48000:channel_layouts=stereo[key];'
                        f'[1:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:{T},volume=0.25[m];[m][key]{duck}[md]',
                        '-map', '[md]', '-c:a', 'pcm_f32le', str(stem)], check=True)
        rows = meter(stem)
        result = bed_shape.qc(rows, VS, VE, T)
        self.assertFalse(result['pass'], result)
        self.assertGreater(result['direction_changes'], 10, result)  # it pumps on every phrase
        print(f"\nWednesday's filter on the synthetic cut: {result['direction_changes']} direction changes, spread {result['bed_spread_lu']} LU")
        self.assertGreater(len(phases(rows, T)), 10)
        with self.assertRaises(bed_shape.BedShapeError):
            bed_shape.require(result, 'wednesday')
        with self.assertRaises(bed_shape.BedShapeError):  # and no engine could write a receipt for it
            bed_shape.write_receipt(stem, 'quick-edit', result, machine='test')


class TheRepositoryCheck(unittest.TestCase):
    def tree(self, files: dict) -> Path:
        temp = tempfile.TemporaryDirectory(prefix='music-bed-check-')
        self.addCleanup(temp.cleanup)
        root = Path(temp.name)
        (root / 'config').mkdir()
        shutil.copy(ROOT / 'config/music-bed.json', root / 'config/music-bed.json')
        for rel, text in files.items():
            (root / rel).parent.mkdir(parents=True, exist_ok=True)
            (root / rel).write_text(text, encoding='utf-8')
        return root

    def test_the_repository_passes(self):
        self.assertEqual(check_music_bed.problems(), [])

    def test_a_new_compositor_with_a_sidechain_fails_and_a_retired_one_passes(self):
        graph = WEDNESDAY.read_text(encoding='utf-8')
        body = graph.split('\n', 6)[6]  # without its retired header
        root = self.tree({'docs/plans/2026-11-09-monday/rebuild/compose.py': body,
                          'docs/plans/2026-11-04-wednesday/rebuild/compose.py': graph,
                          'scripts/quick-edit/new_mix.py': "AF = 'dynaudnorm=f=150'\n",
                          'apps/renderer/src/mix.ts': "const af = 'compand=attacks=0'\n",
                          'scripts/quick-edit/fine.py': "# propagate the agenda; acompressor on the voice is not music\n"})
        found = '\n'.join(check_music_bed.problems(root))
        self.assertIn('docs/plans/2026-11-09-monday/rebuild/compose.py', found)
        self.assertNotIn('2026-11-04-wednesday', found)
        self.assertIn('scripts/quick-edit/new_mix.py', found)
        self.assertIn('apps/renderer/src/mix.ts', found)
        self.assertNotIn('fine.py', found)

    def test_a_retired_compositor_refuses_to_run(self):
        for path in (WEDNESDAY, ROOT / 'docs/plans/2026-11-02-monday/rebuild/compose.py',
                     ROOT / 'docs/plans/2026-11-02-monday/proof/compose.py'):
            ran = subprocess.run([sys.executable, str(path), 'long'], capture_output=True, text=True, cwd=ROOT)
            self.assertNotEqual(ran.returncode, 0, path)
            self.assertIn('RETIRED_COMPOSITOR', ran.stderr, path)


class TheFilingGate(unittest.TestCase):
    """The hole that let Wednesday out: a compositor's cut, bypassing both engines, still got filed."""

    def setUp(self):
        temp = tempfile.TemporaryDirectory(prefix='music-bed-file-')
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.target = '3 Posts/2026-11-04 Wed under.the.hood - Claude Duet/3 Video/Claude Duet - wide 16x9 - YouTube, Substack.mp4'
        self.video = self.root / 'wed-long-16x9.mp4'  # what docs/plans/.../compose.py writes
        self.video.write_bytes(b'a per-day compositor cut')
        # even with a hand-written validation receipt claiming every check passed
        Path(str(self.video) + '.validation.json').write_text(json.dumps({
            'video_sha256': quality.digest(self.video), 'library_path': self.target,
            'checks': {k: {'status': 'pass'} for k in
                                                                  ('heard', 'sync', 'loudness', 'visuals', 'full_review')}}))

    def test_the_library_rule_refuses_it(self):
        refused = library.video_refusal(self.video, self.target)
        self.assertTrue(refused)
        self.assertIn('no bed-shape receipt', refused[0])
        # a working file, a picture and a brand-kit file are not cuts
        self.assertEqual(library.video_refusal(self.video, '3 Posts/2026-11-04 Wed under.the.hood - X/3 Video/working 4 Nov/x.mp4'), [])
        self.assertEqual(library.video_refusal(self.video, '3 Posts/2026-11-04 Wed under.the.hood - X/3 Video/x.jpg'), [])

    def test_send_refuses_it_and_sends_nothing(self):
        fake = send.FakeEngine()
        with self.assertRaises(send.SendError) as caught:
            send.send([(self.target, self.video, 'the long cut')], fake, out=lambda *_: None)
        self.assertIn('no bed-shape receipt', str(caught.exception))
        self.assertEqual(fake.calls, [])

    def test_the_delivery_gate_refuses_it(self):
        problems = quality.delivery_problems(self.video, str(self.video) + '.validation.json', self.target)
        self.assertTrue(any('no bed-shape receipt' in p for p in problems), problems)

    def test_ve_file_refuses_it(self):
        spec = {'piece_id': 'w', 'publish_day': '2026-11-04', 'brand': {'series': 'under.the.hood'},
                'cuts': {'long': {'aspect': '16:9'}}}
        ready = lambda s, c, d: {'mechanical': [], 'design': [], 'final': [], 'video': str(self.video),  # noqa: E731
                                 'digest': quality.digest(self.video)}
        (self.root / 'lib' / '3 Posts').mkdir(parents=True)
        (self.root / 'archive').mkdir()
        with patch.object(packet, 'readiness', ready):
            with self.assertRaises(ValueError) as caught:
                filing.file(spec, self.root, ['long'], subject='Claude Duet', archive_at=str(self.root / 'archive'),
                            library_at=str(self.root / 'lib'))
        self.assertIn('no bed-shape receipt', str(caught.exception))
        self.assertEqual(list((self.root / 'lib' / '3 Posts').iterdir()), [])

    def test_only_an_engine_receipt_for_these_exact_bytes_lets_it_through(self):
        receipt = bed_shape.receipt_path(self.video)
        receipt.write_text(json.dumps({'schema': 'bed-shape-receipt/1', 'engine': 'compose.py',
                                       'video_sha256': quality.digest(self.video), 'bed_shape': {'pass': True}}))
        self.assertIn('not written by ve or quick-edit', ' '.join(library.video_refusal(self.video, self.target)))
        bed_shape.write_receipt(self.video, 'quick-edit', {'pass': True, 'problems': []}, machine='test')
        self.assertEqual(library.video_refusal(self.video, self.target), [])
        self.video.write_bytes(b'remixed afterwards')
        self.assertIn('different bytes', ' '.join(library.video_refusal(self.video, self.target)))
        with self.assertRaises(bed_shape.BedShapeError):
            bed_shape.write_receipt(self.video, 'compose.py', {'pass': True}, machine='test')


if __name__ == '__main__':
    unittest.main()
