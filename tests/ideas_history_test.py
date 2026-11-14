"""The ideas board's checks replayed on his past boards (scripts/post-pack/ideas_history.py; the ideas quality plan, item
11), with only what was known before each board: (a) the 16 Nov Infosys Monday option is warned and never placed first
while P6 waits for his yes, and refused once he approves it; (b) the 16 Nov Infosys off-day return is held for coming
back unchanged; (c) none of his main picks, none of his off-day approvals and no option that answers his own ask is
blocked. And the test can fail: with the refused-subject check switched off, (a) is not caught.

The fixture keeps ids, names and short hashes only. A field that could carry his words fails here."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import ideas_history as history  # noqa: E402
import idea_checks as ic  # noqa: E402

FIXTURE = json.loads(history.FIXTURE.read_text(encoding='utf-8'))
KEYS = {'about', 'boards', 'week', 'known_before', 'options', 'refusals', 'filed', 'answers', 'mentions', 'asks', 'picks', 'approvals',
        'answers_ask', 'ref', 'day', 'pos', 'main', 'idea_id', 'off_id', 'names', 'covers', 'source_kind', 'recommended', 'text16',
        'source_dates', 'from_press', 'at', 'option', 'hard', 'subjects', 'via', 'said16', 'kind', 'doc', 'questions', 'was16'}


def strings(node, path=''):
    if isinstance(node, dict):
        for k, v in node.items():
            yield from strings(v, f'{path}.{k}')
    elif isinstance(node, list):
        for v in node:
            yield from strings(v, path)
    elif isinstance(node, str):
        yield path, node


def keys(node):
    if isinstance(node, dict):
        for k, v in node.items():
            yield k
            yield from keys(v)
    elif isinstance(node, list):
        for v in node:
            yield from keys(v)


class IdeasHistoryTest(unittest.TestCase):
    def test_the_three_tests_pass_on_his_past_boards(self):
        ok, lines = history.verdict(FIXTURE)
        self.assertTrue(ok, '\n'.join(lines))
        self.assertTrue(any(line.startswith('(a)') and 'refused after P6' in line for line in lines))
        self.assertTrue(any(line.startswith('(b)') and 'unchanged' in line for line in lines))

    def test_it_reads_every_pick_approval_and_answered_ask_it_says_it_does(self):
        weeks = [b['week'] for b in FIXTURE['boards']]
        self.assertEqual(weeks, ['2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16'])
        final = {b['week']: b for b in FIXTURE['boards']}
        # His 11 main picks as they stand (a press he changed is also kept, so the test is stricter): 19 Oct, 26 Oct,
        # 9 Nov (Monday was already made) and 16 Nov.
        for week, ref in [('2026-10-19', 'mon-1'), ('2026-10-19', 'wed-1'), ('2026-10-19', 'fri-2'), ('2026-10-26', 'mon-1'),
                          ('2026-10-26', 'wed-1'), ('2026-10-26', 'fri-1'), ('2026-11-09', 'wed-2'), ('2026-11-09', 'fri-2'),
                          ('2026-11-16', 'mon-2'), ('2026-11-16', 'wed-2'), ('2026-11-16', 'fri-4')]:
            self.assertIn(ref, final[week]['picks'], f'{week} {ref}')
        approvals = [r for b in FIXTURE['boards'] for r in b['approvals']]
        for ref in ('off-tue-translator', 'off-tue-claudejobs', 'off-thu-puppy', 'off-tue-mcpskin', 'off-tue-homework', 'off-tue-shell',
                    'off-thu-gitbroke', 'off-sat-oldproof', 'off-tue-povteach'):
            self.assertIn(ref, approvals)
        nov16 = final['2026-11-16']
        wed1 = next(o for o in nov16['options'] if o['ref'] == 'wed-1')
        self.assertIn('wed-1', nov16['answers_ask'], 'the wed-1 option answers his 6 Nov ask')
        self.assertTrue(set(wed1['covers']) & set(nov16['asks']))

    def test_the_test_can_fail_with_the_refused_subject_check_switched_off(self):
        ok, lines = history.verdict(FIXTURE, mutate='refused')
        self.assertFalse(ok)
        self.assertTrue(any(line.startswith('(a)') and 'NOT CAUGHT' in line for line in lines), '\n'.join(lines))

    def test_the_fixture_carries_no_words_of_his(self):
        unknown = set(keys(FIXTURE)) - KEYS
        self.assertFalse(unknown, f'a key the history test does not read: {sorted(unknown)}')
        for path, value in strings(FIXTURE['boards']):
            self.assertLessEqual(len(value), history.ID_MAX, f'{path}: a field longer than an id could carry his words: {value[:20]}...')
        for b in FIXTURE['boards']:
            for o in b['options']:
                for n in o['names']:
                    self.assertTrue(n[:1].isupper() and len(n.split()) <= 5, f'{n!r} is not a name')

    def test_a_soft_refusal_turns_into_a_block_only_with_p6(self):
        nov16 = next(b for b in FIXTURE['boards'] if b['week'] == '2026-11-16')
        before = {(f['code'], f['ref']) for f in history.replay(nov16, p6=False)}
        after = {(f['code'], f['ref']) for f in history.replay(nov16, p6=True)}
        self.assertNotIn(('refused', 'mon-1'), before)
        self.assertIn(('refused', 'mon-1'), after)
        self.assertFalse(ic.P6_APPROVED, 'P6 waits for his yes on his taste ledger; only he flips it')


if __name__ == '__main__':
    unittest.main()
