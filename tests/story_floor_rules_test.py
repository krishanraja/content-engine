"""No floor survives on faith (Ruling, Krish, 2026-11-26: "I want a high-quality flexible engine that has learned from all
its past mistakes and is upgraded now"; learning floors-honest-and-hard). Every hard floor in config/story-score.json
names its source: a ruling (his words and the date) or a failure (an id in config/failures.json). A floor with no
source is a note, never hard, and says so. The lesson behind it is failure scripts-regressed-below-ai-music: caps that
could be met by changing words pushed the writer to game them."""
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUBRIC = json.loads((ROOT / 'config' / 'story-score.json').read_text(encoding='utf-8'))
FAILURES = {f['id'] for f in json.loads((ROOT / 'config' / 'failures.json').read_text(encoding='utf-8'))['failures']}
LEARNINGS = json.loads((ROOT / 'config' / 'learnings.json').read_text(encoding='utf-8'))['learnings']


def floors():
    out = [('hero', f) for f in RUBRIC['hero_floors']['floors']]
    out += [(tid, f) for tid, t in RUBRIC['types'].items() for f in t.get('floors') or []]
    return out


def hard(f):
    return f.get('hard', True) is not False


class EveryHardFloorNamesItsSource(unittest.TestCase):
    def test_every_hard_floor_carries_a_ruling_or_a_failure(self):
        self.assertTrue(floors())
        for tid, f in floors():
            if hard(f):
                self.assertTrue(f.get('ruling') or f.get('failure'), f'{tid}: "{f["reason"]}" is hard with no ruling or failure')

    def test_a_ruling_is_his_words_with_the_date(self):
        for tid, f in floors():
            if f.get('ruling'):
                self.assertIn('Krish', f['ruling'], f'{tid}: {f["reason"]}')
                self.assertRegex(f['ruling'], r'20\d\d-\d\d-\d\d', f'{tid}: {f["reason"]} names no date')
                self.assertRegex(f['ruling'], r'"[^"]{8,}"', f'{tid}: {f["reason"]} quotes none of his words')

    def test_a_failure_is_a_recorded_one(self):
        for tid, f in floors():
            if f.get('failure'):
                self.assertIn(f['failure'], FAILURES, f'{tid}: {f["reason"]} cites an unknown failure')

    def test_a_note_says_why_it_is_not_hard(self):
        for tid, f in floors():
            if not hard(f):
                self.assertFalse(f.get('ruling') or f.get('failure'), f'{tid}: "{f["reason"]}" has a source, so it is hard')
                self.assertTrue(str(f.get('unruled') or '').strip(), f'{tid}: "{f["reason"]}" is a note and does not say why')

    def test_the_three_demoted_floors_are_hard_again(self):
        by = {(tid, f['reason']): f for tid, f in floors()}
        for key in (('hero', "a hero's topic is in a focus sector"), ('hero', 'a hero has at least one primary source'),
                    ('offday_short', 'a short is on the beat'), ('offday_meme', 'a meme is on the beat')):
            self.assertIn(key, by)
            self.assertTrue(hard(by[key]), key)
        self.assertEqual(by[('hero', "a hero's topic is in a focus sector")]['value'], 7)
        self.assertEqual(by[('offday_short', 'a short is on the beat')]['value'], 4)
        self.assertEqual(by[('offday_meme', 'a meme is on the beat')]['value'], 4)
        self.assertEqual(RUBRIC['hero_floors']['wildcard_fit_min'], 4)

    def test_the_rule_is_recorded(self):
        ids = {r['id'] for r in RUBRIC['rulings']}
        self.assertIn('floors_honest_and_hard', ids)
        self.assertIn('scripts-regressed-below-ai-music', FAILURES)
        self.assertIn('scripts-regressed-below-ai-music', RUBRIC['fit']['_about'])
        row = next(x for x in LEARNINGS if x['id'] == 'floors-honest-and-hard')
        self.assertEqual(row['on'], '2026-11-26')
        self.assertIn('learned from all its past mistakes', row['krish'])
        self.assertEqual(row['status'], 'encoded')
        self.assertTrue(any(g['file'] == 'tests/story_floor_rules_test.py' for g in row['encoded']))

    def test_no_em_dash_or_exclamation_in_a_reason(self):
        for tid, f in floors():
            self.assertIsNone(re.search('[—!]', f['reason']), f'{tid}: {f["reason"]}')


if __name__ == '__main__':
    unittest.main()
