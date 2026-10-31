"""ve's validation receipt (scripts/velib/receipt.py) and the voiceover branch of the delivery gate (quality.py).

Sync and motion stand as not_applicable only when the cut's own props, read again from the repository, hold no
picture segments (Ruling, Krish, 2026-10-31). The heard row clears a difference only by a spelling, a heard_as row
in his words or a removal in his words; anything else fails it.
"""
import hashlib
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
sys.path.insert(0, str(ROOT / 'scripts' / 'quick-edit'))
import quality  # noqa: E402
from velib import receipt  # noqa: E402

PROPS = 'docs/plans/2026-10-23-friday-two-passports-ve/ve/props.friday-tall.json'
KRISH = 'Krish, 2026-10-31: "agree with your recommendations"'


def footage(**over):
    sha = hashlib.sha256((ROOT / PROPS).read_bytes()).hexdigest()
    return {'video_sha256': 'a' * 64, 'footage': {'props': {'path': PROPS, 'sha256': sha}, 'camera_segments': 0, **over},
            'checks': {'motion': {'status': 'not_applicable'}, 'sync': {'status': 'not_applicable'}}}


def words(text):
    return [{'w': w, 's': i, 'e': i + .5} for i, w in enumerate(text.split())]


class VoiceoverGateTests(unittest.TestCase):
    def test_props_with_no_picture_segments_make_sync_and_motion_not_applicable(self):
        report = footage()
        self.assertEqual(quality.voiceover_problems(report), [])
        self.assertEqual(quality.motion_problems(report), [])

    def test_the_receipts_word_is_never_enough(self):
        self.assertTrue(quality.voiceover_problems({'checks': {}}))
        changed = footage()
        changed['footage']['props']['sha256'] = 'b' * 64
        self.assertIn('missing or changed', quality.voiceover_problems(changed)[0])
        self.assertIn('no camera footage', quality.voiceover_problems(footage(camera_segments=1))[0])
        self.assertEqual(quality.motion_problems(changed), ['motion assessment is not passed'])


class HeardRowTests(unittest.TestCase):
    rulings = {'removals': [{'take_index': [4, 4], 'krish': KRISH}],
               'heard_as': [{'said': 'Qwen', 'heard': 'Klen', 'krish': KRISH}]}

    def test_spelling_heard_as_and_removal_clear_their_differences(self):
        row = receipt.heard_check(words('Qwen fights forced labour one one today'),
                                  words('Klen fights forced labor one today'), self.rulings)
        self.assertEqual(row['status'], 'pass', row)
        self.assertEqual(sorted(c['by'] for c in row['cleared']), ['heard_as', 'removal', 'spelling'])

    def test_a_cleared_mishearing_in_the_cut_clears_whatever_the_master_was_heard_as(self):
        row = receipt.heard_check(words('Gwen fights'), words('Klen fights'), self.rulings)
        self.assertEqual(row['status'], 'pass', row)
        self.assertEqual(receipt.heard_check(words('Gwen fights'), words('Glen fights'), self.rulings)['status'], 'fail')

    def test_a_difference_he_ruled_the_transcribers_clears_only_that_exact_place(self):
        rulings = {'transcriber_differences': [{'master': '', 'cut': 'for Singapore', 'krish': KRISH}]}
        self.assertEqual(receipt.heard_check(words('the same briefing'), words('the same briefing for Singapore'), rulings)['status'], 'pass')
        self.assertEqual(receipt.heard_check(words('the same briefing'), words('the same briefing for Taiwan'), rulings)['status'], 'fail')
        with self.assertRaises(Exception):
            receipt.heard_check(words('a'), words('a b'), {'transcriber_differences': [{'master': '', 'cut': 'b', 'krish': 'ok'}]})

    def test_a_difference_he_never_cleared_fails_the_row(self):
        row = receipt.heard_check(words('Grok checks posts'), words('rock checks posts'), self.rulings)
        self.assertEqual(row['status'], 'fail')
        self.assertEqual(row['changes'][0]['expected'], ['grok'])

    def test_a_heard_as_row_without_his_words_cannot_clear(self):
        with self.assertRaises(Exception):
            receipt.heard_check(words('Grok'), words('rock'), {'heard_as': [{'said': 'Grok', 'heard': 'rock', 'krish': 'agreed'}]})


if __name__ == '__main__':
    unittest.main()
