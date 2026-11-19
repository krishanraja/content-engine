"""Krish's rulings survive a rebuild of the rejection floor (scripts/floor_rulings.py, config/floor-rulings.json).

Ruling (Krish, 2026-11-14): a caption page holds two to five words, and the rejections engine keeps the ruled wording
(his words: "I agree with everything else until Batch 6"). The Rejections engine (krishanraja/inspirationhouse) rebuilds
config/rejection-floor.json from a database record that still says "two to four"; every reader here applies the ruled
wording over it, so a rebuild cannot put the old bound back."""
import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import floor  # noqa: E402
import floor_rulings  # noqa: E402
from learning import common  # noqa: E402

CAPTIONS = 'r0e552d8de3'
REBUILT = ('Two to four words per caption in sentence case (Archivo), at most one punch word per beat in Anton capitals '
           'with the mint swipe.')


def rebuilt_floor() -> dict:
    """The floor as the engine would write it again from the unchanged record."""
    doc = json.loads((ROOT / 'config/rejection-floor.json').read_text(encoding='utf-8'))
    doc['records'][CAPTIONS]['wanted_instead'] = REBUILT
    return doc


class FloorRulings(unittest.TestCase):
    def test_the_rulings_file_carries_his_ruling(self):
        rulings = floor_rulings.load_rulings()
        entry = rulings['records'][CAPTIONS]
        self.assertIn('two to five words', entry['ruling'])
        self.assertIn('I agree with everything else until Batch 6', entry['ruling'])
        self.assertTrue(entry['ruled'].startswith('Two to five words per caption'))
        self.assertEqual(entry['replaces'], [REBUILT])

    def test_a_rebuild_keeps_two_to_five_words(self):
        doc, problems = floor_rulings.apply(rebuilt_floor())
        self.assertEqual(problems, [])
        self.assertTrue(doc['records'][CAPTIONS]['wanted_instead'].startswith('Two to five words per caption'))
        self.assertNotIn('Two to four', json.dumps(doc['records'][CAPTIONS]))

    def test_the_committed_floor_reads_as_ruled(self):
        doc = floor.load()
        self.assertTrue(doc['records'][CAPTIONS]['wanted_instead'].startswith('Two to five words per caption'))

    def test_every_reader_applies_the_ruling_to_a_rebuilt_file(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / 'rejection-floor.json'
            path.write_text(json.dumps(rebuilt_floor()), encoding='utf-8')
            self.assertTrue(floor.load(path)['records'][CAPTIONS]['wanted_instead'].startswith('Two to five words'))
            self.assertTrue(common.load_floor(path)['records'][CAPTIONS]['wanted_instead'].startswith('Two to five'))
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf):
                floor.main(['--format', 'captions', '--all', '--file', str(path)])
            out = buf.getvalue()
            self.assertIn('Two to five words per caption', out)
            self.assertNotIn('Two to four words per caption', out)

    def test_a_new_wording_from_the_engine_is_reported_never_overwritten(self):
        doc = rebuilt_floor()
        doc['records'][CAPTIONS]['wanted_instead'] = 'Three words per caption.'
        doc, problems = floor_rulings.apply(doc)
        self.assertEqual(doc['records'][CAPTIONS]['wanted_instead'], 'Three words per caption.')
        self.assertTrue(any(CAPTIONS in p and 'new wording' in p for p in problems))

    def test_a_ruling_for_a_record_the_floor_no_longer_holds_is_reported(self):
        doc = rebuilt_floor()
        del doc['records'][CAPTIONS]
        _, problems = floor_rulings.apply(doc)
        self.assertEqual(problems, [])
        self.assertTrue(any(CAPTIONS in p and 'not in the floor' in p for p in floor_rulings.idle(doc)))

    def test_floor_check_reports_ruling_problems(self):
        doc = rebuilt_floor()
        doc['records'][CAPTIONS]['wanted_instead'] = 'Three words per caption.'
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / 'rejection-floor.json'
            path.write_text(json.dumps(doc), encoding='utf-8')
            self.assertEqual(floor.main(['--check', '--file', str(path)]), 1)


# Rulings (Krish, 2026-11-17 and 2026-11-18): the dated-prediction format is abandoned ("get rid of that - i have abandoned
# the prediction format, it feels lame"). Every standard, record and maker that asked for a prediction is ruled withdrawn,
# so a rebuild of the floor by the Rejections engine cannot put the requirement back.
ASKED_FOR_A_PREDICTION = ['s9c6d02148a', 'sedf0fc1d56', 's1949b94c5f', 'sa9f9134e89', 's83075046d2']
ASKS = ('commit to a bold, near-term call', 'checkable future event', 'a prediction is about', 'commit to a clear stance',
        'raise or lower the confidence', 'checkable event on a date', 'rewrite the prediction')


class PredictionFormatWithdrawn(unittest.TestCase):
    def test_no_standard_record_or_maker_asks_for_a_prediction(self):
        doc = floor.load()
        for sid in ASKED_FOR_A_PREDICTION:
            s = doc['standards'][sid]
            self.assertTrue(s['never_beneath'].startswith('Withdrawn: no piece makes a dated prediction'), sid)
            self.assertIn('get rid of that - i have abandoned the prediction format, it feels lame', s['never_beneath'], sid)
            self.assertIn("I don't do dated-and-scored make-your-mind-up pieces", s['never_beneath'], sid)
        text = json.dumps({'standards': doc['standards'], 'records': doc['records'], 'formats': doc['formats']})
        for ask in ASKS:
            self.assertNotIn(ask, text)
        self.assertTrue(doc['formats']['prediction']['maker'].startswith('Retired with the prediction format'))

    def test_a_rebuild_with_the_old_wording_is_ruled_again(self):
        raw = json.loads((ROOT / 'config/rejection-floor.json').read_text(encoding='utf-8'))
        self.assertIn('commit to a bold, near-term call', raw['standards']['s9c6d02148a']['never_beneath'])
        doc, problems = floor_rulings.apply(raw)
        self.assertEqual(problems, [])
        self.assertTrue(doc['standards']['s9c6d02148a']['never_beneath'].startswith('Withdrawn'))
        self.assertEqual(floor_rulings.idle(doc), [])

    def test_the_prediction_maker_prints_as_retired(self):
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            floor.main(['--format', 'prediction', '--all'])
        out = buf.getvalue()
        self.assertTrue(out.startswith('RETIRED: no piece closes on a dated prediction'))
        for ask in ASKS:
            self.assertNotIn(ask, out)

    def test_an_anti_prediction_standard_is_left_as_it_was(self):
        self.assertTrue(floor.load()['standards']['sd6b5d7c66a']['never_beneath'].startswith('Never close on a dated prediction'))


if __name__ == '__main__':
    unittest.main()
