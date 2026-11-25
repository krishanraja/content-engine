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

    # Ruling (Krish, 2026-11-24): the signature format is the 5 Whys; get rid of everything that suggests predictions,
    # calls, dated, odds or scores. The engine still writes them; every reader takes them out.
    PREDICTING = ('s9c6d02148a', 'sedf0fc1d56', 's1949b94c5f', 'se49eca7e39', 's08e19e659c', 'sf89aa11473')

    def test_no_reader_sees_a_prediction_standard_or_maker(self):
        for doc in (floor.load(), common.load_floor(), floor_rulings.apply(rebuilt_floor())[0]):
            self.assertNotIn('prediction', doc['formats'])
            for ref in self.PREDICTING:
                self.assertNotIn(ref, doc['standards'])
                for entry in doc['formats'].values():
                    for refs in entry.values():
                        self.assertFalse(isinstance(refs, list) and ref in refs)
            for g in doc['groups']:
                self.assertFalse(set(self.PREDICTING) & set(g.get('members') or []))
            # Everything the makers read: no standard asks for a call, a date, odds, a confidence number or a score.
            pattern = floor_rulings.re.compile(floor_rulings.load_rulings()['retired']['pattern'], floor_rulings.re.I)
            keep = floor_rulings.load_rulings()['retired']['keep']
            for ref, s in doc['standards'].items():
                if ref not in keep:
                    self.assertIsNone(pattern.search(s['never_beneath'] + ' ' + str(s.get('check_before_delivery') or '')), ref)
            self.assertIn('sd6b5d7c66a', doc['standards'])  # "Never close on a dated prediction" holds the ruling

    def test_a_reworded_rehashed_prediction_standard_is_still_retired(self):
        doc = rebuilt_floor()
        doc['standards']['s0123456789'] = dict(doc['standards']['s9c6d02148a'], never_beneath=(
            'Always commit to a bold, near-term call with a confidence percentage on screen.'))
        doc['formats']['short_video']['draft'].append('s0123456789')
        doc, problems = floor_rulings.apply(doc)
        self.assertEqual(problems, [])
        self.assertNotIn('s0123456789', doc['standards'])
        self.assertNotIn('s0123456789', doc['formats']['short_video']['draft'])

    def test_the_bold_predictions_lineage_reads_his_amended_words(self):
        doc = rebuilt_floor()
        doc['groups'].append({'key': 'bold_predictions_e261130', 'title': 'Bold, checkable predictions (evolution)',
                              'standing': 'approved', 'statement': 'A prediction commits to a clear near-term call.',
                              'members': ['s81a2b228d6']})
        doc, _ = floor_rulings.apply(doc)
        lineage = [g for g in doc['groups'] if floor_rulings.in_lineage(g['key'], ['bold_predictions', 'predictions_committed'])]
        self.assertEqual(len(lineage), 3)
        for g in lineage:
            self.assertTrue(g['statement'].startswith('No piece makes a prediction'))
            self.assertNotIn('Bold', g['title'])
        self.assertFalse(floor_rulings.in_lineage('bold_predictions_extra', ['bold_predictions']))

    def test_a_maker_reads_no_prediction(self):
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            floor.main(['--format', 'script', '--all'])
        out = buf.getvalue()
        for words in ('near-term call', 'confidence level', 'scorecard', 'Bold, checkable predictions'):
            self.assertNotIn(words, out)
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            floor.main(['--formats'])
        self.assertNotIn('prediction:', buf.getvalue())

    def test_the_grouping_carries_the_same_words(self):
        groups = json.loads((ROOT / 'config/floor-groups.json').read_text(encoding='utf-8'))
        statement = floor_rulings.load_rulings()['retired']['groups']['statement']
        lineage = [g for g in groups['groups'] if floor_rulings.in_lineage(g['key'], ['bold_predictions', 'predictions_committed'])]
        self.assertGreaterEqual(len(lineage), 4)
        for g in lineage:
            self.assertEqual(g['never_beneath'], statement)
            self.assertNotIn('Bold', g['title'])

    def test_floor_check_reports_ruling_problems(self):
        doc = rebuilt_floor()
        doc['records'][CAPTIONS]['wanted_instead'] = 'Three words per caption.'
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / 'rejection-floor.json'
            path.write_text(json.dumps(doc), encoding='utf-8')
            self.assertEqual(floor.main(['--check', '--file', str(path)]), 1)


if __name__ == '__main__':
    unittest.main()
