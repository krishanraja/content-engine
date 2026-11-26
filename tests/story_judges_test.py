"""Judge accountability (Ruling, Krish, 2026-11-26: the buyer judge is kept as the paying reader, and no judge or rule
survives on faith; rank1_picked was 0 on both scored weeks). board_feed.py records, per judge, the rank its scoring gave
his actual pick (judge_rank_of_pick), and after config judges.review.after_weeks scored weeks a judge no better than
chance gets a review line, reported only. Every option below is invented."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import board_feed  # noqa: E402
import idea_checks as ic  # noqa: E402


def option(oid, buyer, reader, scale):
    return {'id': oid, 'so_what': f'Story {oid}.', 'judges': {'buyer': buyer, 'reader': reader},
            'story_score': {'total': 50, 'rubric_version': 'story-score/1', 'axes': {'scale': scale, 'fit': 7}}}


def board(*rows):
    return {'days': {'mon': [option(*r) for r in rows]}}


def card(week, ranks):
    """A scorecard with one judge's {day: {rank, of}}."""
    return {'week': week, 'judge_rank_of_pick': {'buyer': {d: {'rank': r, 'of': n} for d, (r, n) in ranks.items()}}}


class JudgeRank(unittest.TestCase):
    def test_each_judge_ranks_his_pick_beside_the_score(self):
        ideas = board(('a', 9, 3, 4), ('b', 5, 8, 8), ('c', 7, 8, 2))
        got = board_feed.judge_rank_of_pick(ideas, {'mon': 'mon-2'})
        self.assertEqual(got['buyer'], {'mon': {'rank': 3, 'of': 3}}, 'the paying reader scored his pick last of three')
        self.assertEqual(got['reader'], {'mon': {'rank': 1, 'of': 3}}, 'equal scores share a rank')
        self.assertEqual(got['story:scale'], {'mon': {'rank': 1, 'of': 3}}, 'the blind judges are ranked too')
        self.assertNotIn('story:fit', got, 'fit is not a judge: it is deterministic')

    def test_a_week_file_carries_the_panel_when_the_options_do_not(self):
        ideas = {'days': {'mon': [{'id': 'A1'}, {'id': 'b2'}]}}
        got = board_feed.judge_rank_of_pick(ideas, {'mon': 'mon-1'}, {'a1': {'buyer': 4}, 'B2': {'buyer': 6}})
        self.assertEqual(got, {'buyer': {'mon': {'rank': 2, 'of': 2}}})

    def test_a_judge_that_did_not_score_the_pick_has_no_rank(self):
        ideas = board(('a', 9, 3, 4), ('b', 5, 8, 8))
        del ideas['days']['mon'][1]['judges']['buyer']
        got = board_feed.judge_rank_of_pick(ideas, {'mon': 'mon-2'})
        self.assertNotIn('buyer', got)
        self.assertEqual(board_feed.judge_rank_of_pick(ideas, {'mon': 'mon-9'}), {}, 'a pick off the board ranks nothing')

    def test_the_scorecard_records_it(self):
        plans = Path(tempfile.mkdtemp())
        folder = plans / '2026-11-30-week'
        folder.mkdir(parents=True)
        (folder / 'ideas.json').write_text(json.dumps(board(('a', 9, 3, 4), ('b', 5, 8, 8))), encoding='utf-8')
        data = {'ok': True, 'outcomes': [{'doc': 'picks/mon', 'outcome': 'approved', 'via': 'pick', 'day': 'mon', 'idea_id': 'b',
                                          'decided_at': '2026-11-29T10:00:00Z'}]}
        card_, lines = board_feed.scorecard_from('2026-11-30', data, plans, refused_refs=[])
        self.assertEqual(card_['picks'], {'mon': 'mon-2'})
        self.assertEqual(card_['judge_rank_of_pick']['buyer']['mon'], {'rank': 2, 'of': 2})
        self.assertEqual(card_['judge_rank_of_pick']['reader']['mon'], {'rank': 1, 'of': 2})
        self.assertTrue(any(line.startswith('  judge_rank_of_pick:') for line in lines))


class Review(unittest.TestCase):
    def setUp(self):
        self.rule = ic.STORY['judges']['review']

    def test_the_rule_is_a_config_row_and_acts_on_nothing(self):
        self.assertEqual(self.rule['after_weeks'], 4)
        self.assertEqual(self.rule['line'], 'retire or rewrite')
        self.assertIs(self.rule['acts'], False)

    def test_no_better_than_chance_after_four_weeks_is_reviewed(self):
        cards = [card(f'2026-11-{d:02d}', {'mon': (2, 3), 'wed': (3, 3)}) for d in (2, 9, 16, 23)]
        lines = board_feed.judge_review(cards)
        self.assertEqual(len(lines), 1)
        self.assertIn('buyer (Paying reader)', lines[0])
        self.assertTrue(lines[0].endswith('retire or rewrite'))

    def test_better_than_chance_is_not(self):
        cards = [card(f'2026-11-{d:02d}', {'mon': (1, 4), 'wed': (2, 4)}) for d in (2, 9, 16, 23)]
        self.assertEqual(board_feed.judge_review(cards), [])

    def test_too_few_weeks_says_nothing_yet(self):
        cards = [card(f'2026-11-{d:02d}', {'mon': (3, 3)}) for d in (9, 16, 23)]
        self.assertEqual(board_feed.judge_review(cards), [])

    def test_the_real_scorecards_are_read(self):
        self.assertTrue(all('week' in c for c in board_feed.scorecards()))


if __name__ == '__main__':
    unittest.main()
