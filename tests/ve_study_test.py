"""ve study (velib.study): a reference's grammar card in numbers, quick-edit's reference measures beside ve's own cut
and motion measures, and a contact sheet; the Critic reads it as a description, never a target (F03, THE_BAR).
Synthetic reference; no speech model."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import critic_inputs, study  # noqa: E402
from velib.common import ffmpeg  # noqa: E402


def reference(path: Path) -> Path:
    """Two hard-cut shots of two seconds each, with a tone under them."""
    subprocess.run([ffmpeg(), '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0xc03020:s=320x180:r=30:d=2',
                    '-f', 'lavfi', '-i', 'color=c=0x2040c0:s=320x180:r=30:d=2',
                    '-f', 'lavfi', '-i', 'sine=frequency=220:sample_rate=48000:duration=4',
                    '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0[v]', '-map', '[v]', '-map', '2:a',
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', str(path)], check=True)
    return path


class StudyTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='ve-study-')
        self.addCleanup(self.temp.cleanup)
        self.dir = Path(self.temp.name)

    def test_the_card_holds_cuts_pace_loudness_and_a_contact_sheet_and_says_it_is_not_a_target(self):
        ref = reference(self.dir / 'board-card.mp4')
        card = study.study(ref, words=False)
        written = json.loads((self.dir / 'board-card.grammar.json').read_text())
        self.assertEqual(card, written)
        self.assertIn('never a target', card['note'])
        self.assertTrue(any(abs(t - 2.0) < 0.1 for t in card['cuts']), card['cuts'])
        self.assertAlmostEqual(card['duration_s'], 4.0, delta=0.1)
        for key in ('change_density', 'longest_still_s', 'pace', 'zooms', 'loudness_lufs'):
            self.assertIn(key, card)
        self.assertIsNotNone(card['loudness_lufs'])
        self.assertIsNone(card['speech'])
        self.assertEqual(card['contact_sheet'], 'board-card.grammar.contact.jpg')
        self.assertTrue((self.dir / card['contact_sheet']).is_file())

    def test_the_critic_is_handed_each_reference_card_beside_its_video(self):
        ref = reference(self.dir / 'board-card.mp4')
        study.study(ref, words=False)
        spec = {'brand': {'references': [{'card': 'board-card', 'drive_id': 'x'}, {'card': 'not-here', 'drive_id': 'y'}]}}
        with patch.dict(os.environ, {'MINDMAKE_REFERENCE_ROOT': str(self.dir)}):
            numbers = critic_inputs.reference_numbers(spec)
        self.assertEqual(list(numbers), ['board-card'])
        self.assertEqual(numbers['board-card']['note'], study.NOTE)
        self.assertAlmostEqual(numbers['board-card']['duration_s'], 4.0, delta=0.1)


if __name__ == '__main__':
    unittest.main()
