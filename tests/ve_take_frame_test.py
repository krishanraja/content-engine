"""The take frame is measured at ingest, never typed (plan PR 4).

A vertical long take on a 16:9 cut cost about ten hours on Wed 18 and again on Fri 20 Nov 2026, because the frame was
typed by hand or not at all. ve ingest now probes each take's size and rotation with ffprobe and writes the frame on the
take record; compile stages a 16:9 cut over a vertical take as pillar when no layout is named; lint refuses a take with
no measured frame only once ingest has run, and an older spec with a typed frame still works.

    python3 -m pytest -q tests/ve_take_frame_test.py
"""
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import piece_guards as pg, takes  # noqa: E402
from velib.common import load_json  # noqa: E402
from velib.compile import compile_cut, default_layout  # noqa: E402

FIXTURE = ROOT / 'fixtures/ve/my-test-19s'
RULE = pg.config()['take_orientation']


def have_ffmpeg() -> bool:
    return shutil.which('ffmpeg') is not None and shutil.which('ffprobe') is not None


def timed_words():
    return [dict(word, end_s=word['onset_s'] + 0.2) for word in load_json(FIXTURE / 'words.frames.json')]


class TakeFrame(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory(prefix='ve-take-frame-')
        self.addCleanup(temp.cleanup)
        self.dir = Path(temp.name)
        self.ve = self.dir / 've'

    def clip(self, name, size, rotation=None):
        """A tiny generated test clip (black, half a second), optionally tagged with a display rotation."""
        plain = self.dir / f'{name}.plain.mp4'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', f'color=c=black:s={size}:d=0.5',
                        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', str(plain)], check=True)
        if rotation is None:
            return plain
        out = self.dir / f'{name}.mp4'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-display_rotation', str(rotation), '-i', str(plain), '-c', 'copy',
                        str(out)], check=True)
        return out

    def ingest(self, take, media):
        clock = self.dir / f'{take}.a.json'
        clock.write_text(json.dumps([{'w': 0, 'word': 'Hi', 'onset_s': 0.0, 'end_s': 0.2}]))
        return takes.ingest(self.ve, 'p', take, media, clock_a=clock, clock_b=clock,
                            aligner_a='faster-whisper:small.en', aligner_b='faster-whisper:medium.en', duration_s=0.5)

    @unittest.skipUnless(have_ffmpeg(), 'ffmpeg is not installed')
    def test_ingest_writes_the_measured_frame_on_the_take_record(self):
        self.ingest('long-vo-master', self.clip('tall', '36x64'))
        record = takes.load_take(self.ve, 'long-vo-master')
        self.assertEqual(record['media']['frame'], {'width': 36, 'height': 64})
        self.assertEqual((record['media']['video']['width'], record['media']['video']['height']), (36, 64))

    @unittest.skipUnless(have_ffmpeg(), 'ffmpeg is not installed')
    def test_a_phone_take_stored_wide_with_a_rotation_reads_as_vertical(self):
        self.ingest('rotated', self.clip('wide', '64x36', rotation=90))
        record = takes.load_take(self.ve, 'rotated')
        self.assertEqual(record['media']['video']['rotation'] % 180, 90)
        self.assertEqual(record['media']['frame'], {'width': 36, 'height': 64})

    @unittest.skipUnless(have_ffmpeg(), 'ffmpeg is not installed')
    def test_a_9_16_take_on_a_16_9_cut_compiles_to_pillar_with_no_typed_frame(self):
        spec = load_json(FIXTURE / 'spec.json')
        self.assertEqual(spec['cuts']['proof-wide']['aspect'], '16:9')
        self.assertNotIn('layout', spec.get('style') or {})
        take = spec['cuts']['proof-wide']['take']
        self.assertFalse(any(a.get('id') == take and 'frame' in a for a in spec['assets']), 'no hand-typed frame')
        self.ingest(take, self.clip('tall', '36x64'))
        source, frame = takes.cut_frame(spec, 'proof-wide', self.ve)
        self.assertEqual((source, frame), ('measured', {'width': 36, 'height': 64}))
        props = compile_cut(spec, 'proof-wide', timed_words(), FIXTURE, take_frame=frame)
        self.assertEqual(props['layout'], {'mode': 'pillar'})
        # The tall cut over the same take keeps the house staging, and a wide take on 16:9 does too.
        self.assertNotIn('layout', compile_cut(spec, 'proof-tall', timed_words(), FIXTURE, take_frame=frame))
        self.assertNotIn('layout', compile_cut(spec, 'proof-wide', timed_words(), FIXTURE,
                                               take_frame={'width': 1920, 'height': 1080}))
        # A layout he named still wins over the default.
        spec.setdefault('style', {})['layout'] = {'mode': 'fill', 'reason': 'test'}
        self.assertEqual(compile_cut(spec, 'proof-wide', timed_words(), FIXTURE, take_frame=frame)['layout'], {'mode': 'fill'})

    def test_an_older_spec_with_a_typed_frame_still_works(self):
        spec = load_json(FIXTURE / 'spec.json')
        spec['assets'].append({**spec['assets'][0], 'id': spec['cuts']['proof-wide']['take'],
                               'frame': {'width': 1080, 'height': 1920}})
        self.assertEqual(takes.cut_frame(spec, 'proof-wide', None), ('typed', {'width': 1080, 'height': 1920}))
        self.assertEqual(default_layout(spec, 'proof-wide'), 'pillar')
        self.assertEqual(compile_cut(spec, 'proof-wide', timed_words(), FIXTURE)['layout'], {'mode': 'pillar'})

    def test_lint_refuses_an_unmeasured_take_only_once_ingest_has_run(self):
        spec = load_json(FIXTURE / 'spec.json')
        take = spec['cuts']['proof-wide']['take']
        # Before ingest: nothing to measure, nothing refused.
        self.assertEqual(pg.take_orientation(spec, RULE, self.ve), [])
        # Ingest of a file with no picture (a voice-only recording): the frame is unmeasured and refused by name.
        media = self.dir / 'voice.bin'
        media.write_bytes(b'voice')
        self.ingest(take, media)
        self.assertEqual(takes.cut_frame(spec, 'proof-wide', self.ve), ('unmeasured', None))
        problems = pg.take_orientation(spec, RULE, self.ve)
        self.assertTrue(problems and 'measured no frame' in problems[0], problems)

    @unittest.skipUnless(have_ffmpeg(), 'ffmpeg is not installed')
    def test_lint_reads_the_measured_frame_and_the_default_pillar_staging(self):
        spec = load_json(FIXTURE / 'spec.json')
        take = spec['cuts']['proof-wide']['take']
        self.ingest(take, self.clip('tall', '36x64'))
        beats = spec['cuts']['proof-wide']['beats']
        beats[0]['layout'] = 'F1'
        self.assertEqual(pg.take_orientation(spec, RULE, self.ve), [], 'no layout named: compile stages it as pillar')
        beats[0]['layout'] = 'WINDOW'
        self.assertTrue(any('layout WINDOW' in p for p in pg.take_orientation(spec, RULE, self.ve)))
        beats[0]['layout'] = 'F1'
        spec.setdefault('style', {})['layout'] = {'mode': 'fill', 'reason': 'test'}
        self.assertTrue(any('vertical (36x64)' in p for p in pg.take_orientation(spec, RULE, self.ve)))


if __name__ == '__main__':
    unittest.main()
