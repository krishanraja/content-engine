"""The forced aligner's inputs and its refusals; the models themselves are exercised on real takes, not here."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from velib import forced_align  # noqa: E402


class ForcedAlignTest(unittest.TestCase):
    def test_words_come_from_a_script_or_any_clock_shape(self):
        with tempfile.TemporaryDirectory() as tmp:
            script = Path(tmp) / 'script.txt'
            script.write_text('Proactive AI is coming.\n', encoding='utf-8')
            self.assertEqual(forced_align.words_of(script), ['Proactive', 'AI', 'is', 'coming.'])
            clock = Path(tmp) / 'words.json'
            clock.write_text(json.dumps([{'w': ' Proactive', 's': 1.18, 'e': 1.7}, {'word': 'AI'}, {'text': 'is'}]))
            self.assertEqual(forced_align.words_of(clock), ['Proactive', 'AI', 'is'])

    def test_only_the_two_local_forced_aligners_are_known(self):
        with self.assertRaisesRegex(ValueError, 'mms-fa, wav2vec2-960h'):
            forced_align.align('unused.mp4', ['a'], 'elevenlabs')

    def test_usage_without_four_arguments(self):
        self.assertEqual(forced_align.main([]), 2)


if __name__ == '__main__':
    unittest.main()
