"""The trend gate (Ruling, Krish, 2026-11-28): every open idea, memes and carousels included, follows a dated trend."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts' / 'post-pack'))
import trend_tie  # noqa: E402

WEEK = '2026-12-14'
GOOD = {'lane': 'money', 'line': 'AI companies are buying whole languages instead of training them, and paying for it.',
        'source_url': 'https://example.com/elevenlabs-kotoba', 'date': '2026-12-02'}


def hero(i, **kw):
    return dict({'id': f'{i}0000000-aaaa', 'so_what': 'What the story means for the reader.', 'trend': dict(GOOD)}, **kw)


def board(mon=None, off=None):
    return {'days': {'mon': mon if mon is not None else [hero(1), hero(2)], 'wed': [hero(3)], 'fri': [hero(4)]},
            'offdays': off if off is not None else {'tue': [{'id': 'meme1', 'kind': 'meme', 'trend': dict(GOOD)}],
                                                    'sat': [{'id': 'goodnews', 'kind': 'good_news'}]}}


class Tie(unittest.TestCase):
    def test_a_board_that_follows_dated_trends_passes(self):
        self.assertEqual(trend_tie.trend_findings(board(), WEEK), [])

    def test_before_the_rule_nothing_is_checked(self):
        self.assertEqual(trend_tie.trend_findings(board(mon=[{'id': 'x'}]), '2026-12-07'), [])

    def test_a_hero_or_a_meme_with_no_trend_is_refused_and_good_news_is_not(self):
        got = trend_tie.trend_findings(board(mon=[hero(1), {'id': 'nolane', 'so_what': 'x'}], off={'thu': [{'id': 'meme2', 'kind': 'meme'}], 'sat': [{'id': 'goodnews', 'kind': 'good_news'}]}), WEEK)
        refs = [f['ref'] for f in got]
        self.assertIn('mon-2 (nolane)', refs)
        self.assertIn('off-thu-meme2', refs)
        self.assertNotIn('off-sat-goodnews', refs)
        self.assertTrue(all(f['code'] == 'trend' for f in got))

    def test_an_old_or_future_trend_a_made_up_lane_or_a_repeated_so_what_is_refused(self):
        cases = {'date': '2026-11-01', 'lane': 'vibes', 'source_url': 'http://insecure.example', 'line': 'too short'}
        for k, v in cases.items():
            t = dict(GOOD, **{k: v})
            self.assertTrue(trend_tie.problems({'trend': t}, WEEK), k)
        self.assertTrue(trend_tie.problems({'trend': dict(GOOD, date='2026-12-20')}, WEEK), 'after the week starts')
        same = hero(9, so_what=GOOD['line'])
        self.assertTrue(any('so_what' in p for p in trend_tie.problems(same, WEEK)))

    def test_his_own_ideas_are_never_checked(self):
        mine = [{'id': 'his1', 'source_kind': 'his'}, {'id': 'tick1', 'from_inspiration': True}]
        self.assertEqual(trend_tie.trend_findings(board(mon=mine), WEEK), [])


if __name__ == '__main__':
    unittest.main()
