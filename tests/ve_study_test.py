"""ve study (velib.study): the grammar card is written from a short synthetic clip (testsrc2 + sine) with the
transcriber stubbed, and still written, saying words were skipped, when no transcript can be made. 13 Nov 2026:
faster_whisper's av.open(metadata_errors=) crashed on an older PyAV and grammar.json was never written."""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import study  # noqa: E402
from velib.common import ffmpeg  # noqa: E402


def clip(path: Path) -> Path:
    subprocess.run([ffmpeg(), '-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=320x240:r=30:d=3',
                    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                    '-c:a', 'aac', '-shortest', str(path)], check=True)
    return path


class StudyTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.ref = clip(self.dir / 'ref.mp4')

    def tearDown(self):
        self.tmp.cleanup()

    def test_writes_grammar_with_stubbed_transcriber(self):
        segs = [{'start': 0.0, 'end': 2.0, 'text': 'hello there world?'}]
        with mock.patch.object(study.references, 'transcript', return_value=segs):
            card = study.study(self.ref, self.dir / 'ref.grammar.json')
        written = json.loads((self.dir / 'ref.grammar.json').read_text())
        self.assertEqual(written['speech']['words'], 3)
        self.assertEqual(written['speech']['questions_asked'], 1)
        self.assertNotIn('words_skipped', written)
        self.assertIn('duration_s', card)

    def test_writes_grammar_when_no_transcript(self):
        with mock.patch.object(study.references, 'transcript', return_value=None):
            study.study(self.ref, self.dir / 'ref.grammar.json')
        written = json.loads((self.dir / 'ref.grammar.json').read_text())
        self.assertIsNone(written['speech'])
        self.assertIn('words were skipped', written['words_skipped'])
        self.assertIn('cuts', written)

    def test_pcm_decode_is_ffmpeg_only(self):
        audio = study.references._pcm16k(self.ref)
        self.assertGreater(len(audio), 16000 * 2)


if __name__ == '__main__':
    unittest.main()
