"""The Saturday good news's stories and how old they may be (scripts/post-pack/board_feed.py goodnews_problems). Krish,
2026-11-16: "Good news stories can come from the Instagram inspo as well. There's absolutely tonnes in there", and his
Yes the same day to a story found there being up to thirty days old. A story from the web stays within seven."""
import json
import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import board_feed  # noqa: E402

DUE = date(2026, 11, 16)
POST = 'https://www.instagram.com/p/abc123/'
SHEET = {'label': 'Your Instagram inspo sheet', 'url': POST}


def story(n, **kw):
    return dict({'headline': f'S{n}', 'what': 'What happened.', 'why': 'Why it matters.', 'kind': 'health', 'date': '2026-11-12',
                 'source': {'label': 'The paper', 'url': f'https://example.org/{n}'}, 'media': {'kind': 'photo', 'url': f'https://example.org/{n}.jpg'}}, **kw)


def week(first):
    return {'week_start': '2026-11-16', 'offdays': {'sat': [{'id': 'goodnews', 'weekly': 'good_news', 'stories_due': DUE.isoformat(),
                                                             'stories': [first] + [story(n) for n in range(2, 6)]}]}}


def dated(lines):
    return [x for x in lines if 'is dated' in x]


class WindowTest(unittest.TestCase):
    def test_a_web_story_stays_within_seven_days(self):
        self.assertTrue(dated(board_feed.goodnews_problems(week(story(1, date='2026-10-30')), {}, DUE)))
        self.assertEqual(board_feed.goodnews_problems(week(story(1, date='2026-11-09')), {}, DUE), [])

    def test_a_story_found_in_his_sheet_may_be_thirty_days_old(self):
        self.assertEqual(board_feed.goodnews_problems(week(story(1, date='2026-10-20', found=SHEET)), {}, DUE), [])
        self.assertTrue(dated(board_feed.goodnews_problems(week(story(1, date='2026-10-10', found=SHEET)), {}, DUE)), 'not thirty-seven')

    def test_only_an_instagram_post_counts_as_found_in_the_sheet(self):
        web = {'label': 'Your Instagram inspo sheet', 'url': 'https://example.org/a-blog'}
        self.assertTrue(dated(board_feed.goodnews_problems(week(story(1, date='2026-10-20', found=web)), {}, DUE)))

    def test_with_the_sheet_on_disk_the_post_must_be_one_of_its_posts(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / '2026-11-16-week'
            folder.mkdir()
            (folder / 'goodnews-input.json').write_text(json.dumps({'posts': [{'url': 'https://www.instagram.com/p/other/'}]}))
            self.assertTrue(dated(board_feed.goodnews_problems(week(story(1, date='2026-10-20', found=SHEET)), {}, DUE, plans=tmp)))
            (folder / 'goodnews-input.json').write_text(json.dumps({'posts': [{'url': POST}]}))
            self.assertEqual(board_feed.goodnews_problems(week(story(1, date='2026-10-20', found=SHEET)), {}, DUE, plans=tmp), [])



def cand(n, place):
    return {'title': f'Candidate {n}', 'url': f'https://example.org/c{n}', 'place': place, 'date': '2026-11-15'}


class WideTest(unittest.TestCase):
    """Krish, 2026-11-16: "Something's gone wrong in where you're looking and how you're looking because there should
    be millions of good news stories. What about Reddit, YouTube, or LinkedIn?" The run looks wide, then chooses."""

    def wk(self, candidates, due='2026-11-19'):
        return {'week_start': '2026-11-16', 'offdays': {'sat': [{'id': 'goodnews', 'weekly': 'good_news', 'stories_due': due,
                                                                 'stories': [story(n) for n in range(1, 6)], 'candidates': candidates}]}}

    def test_fifteen_candidates_from_three_kinds_of_place(self):
        places = ['news', 'reddit', 'youtube', 'linkedin', 'sheet']
        wide = [cand(n, places[n % 5]) for n in range(15)]
        self.assertEqual(board_feed.goodnews_problems(self.wk(wide), {}, date(2026, 11, 19)), [])

    def test_a_narrow_look_is_refused(self):
        lines = board_feed.goodnews_problems(self.wk([cand(n, 'news') for n in range(4)]), {}, date(2026, 11, 19))
        self.assertTrue(any('4 candidates gathered' in x for x in lines), lines)
        self.assertTrue(any('candidates from news' in x and 'Reddit, YouTube, or LinkedIn' in x for x in lines), lines)

    def test_a_week_found_before_it_keeps_its_checks(self):
        self.assertEqual(board_feed.goodnews_problems(self.wk([], due='2026-11-16'), {}, date(2026, 11, 16)), [])


if __name__ == '__main__':
    unittest.main()
