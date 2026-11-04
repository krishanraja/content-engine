"""What each filed piece used (config/ve/history.json, velib.filing.record_history) and the expectations line when the
next piece repeats it (velib.lint.novelty_note). Advisory: no repeat rule has Krish's approval (F14)."""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import filing, lint  # noqa: E402

SPEC = {'piece_id': 'p-9', 'series': 'follow.the.money', 'format': 'face-with-proof',
        'signature': {'hero': {'device': 'kinetic_stat'}}, 'style': {'motion': {'module': 'data-story'},
                                                                    'idea': {'object': 'One career ladder'}},
        'objects': [{'obj': 'a', 'device': 'kinetic_stat'}, {'obj': 'b', 'device': 'logo_card'}],
        'brand': {'captions': 'word'},
        'cuts': {'short': {'beats': [{'transitionOut': 'cut_on_curve'}, {}]}}}
RECORD = {'date': '2026-11-16', 'filed_on': '2026-11-15', 'files': [{'cut': 'short', 'sha256': 'a' * 64}]}


class HistoryTest(unittest.TestCase):
    def test_a_filing_writes_one_row_per_piece_and_a_repeat_is_named_not_refused(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'history.json'
            filing.record_history(SPEC, RECORD, path)
            filing.record_history(SPEC, RECORD, path)
            rows = json.loads(path.read_text())['pieces']
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]['hero'], 'kinetic_stat')
            self.assertEqual(rows[0]['motion'], 'data-story')
            self.assertEqual(rows[0]['idea'], 'One career ladder')
            self.assertEqual(rows[0]['devices'], ['kinetic_stat', 'logo_card'])
            self.assertEqual(rows[0]['transitions'], ['cut_on_curve'])
            note = lint.novelty_note({**SPEC, 'piece_id': 'p-10'}, rows)
            self.assertIn('kinetic_stat', note)
            self.assertIn('data-story', note)
            fresh = {**SPEC, 'signature': {'hero': {'device': 'stamp'}}, 'style': {'motion': {'module': 'paper-cutout'}}}
            self.assertIsNone(lint.novelty_note(fresh, rows))
            self.assertIsNone(lint.novelty_note(SPEC, []))


if __name__ == '__main__':
    unittest.main(verbosity=1)
