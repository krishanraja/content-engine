"""The Sunday ideas run's "built" check (scripts/sunday_ideas.py): what the live board's view must carry before the
run says the week's options are on it."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import sunday_ideas as si  # noqa: E402


def view(goodnews_fresh=False, tue=True):
    opt = lambda i: {'doc_id': f'x-{i}', 'title': f'Idea {i}'}
    days = [{'day': d, 'options': [opt(d)]} for d in ('mon', 'wed', 'fri')]
    if tue:
        days.append({'day': 'tue', 'options': [opt('tue')]})
    days.append({'day': 'thu', 'options': [{'doc_id': 'held-thu-1', 'title': 'Held back: a return'}]})
    days.append({'day': 'sat', 'options': [{'doc_id': 'off-sat-goodnews', 'stories_fresh': goodnews_fresh, 'stories_due': '2026-11-19'}]})
    return {'days': days}


class BuiltTest(unittest.TestCase):

    def test_the_whole_board_waits_for_the_good_news(self):
        self.assertFalse(si.view_has_ideas(view()))
        self.assertTrue(any(line.startswith('good news:') for line in si.missing(view())))
        self.assertTrue(si.view_has_ideas(view(goodnews_fresh=True)))

    def test_a_re_run_of_some_days_answers_for_those_days_only(self):
        # Run 43866949707 (16 Nov) made Tue and Thu again and failed for Saturday's stories, still to be found.
        self.assertEqual(si.missing(view(), ['tue']), [])
        self.assertTrue(si.view_has_ideas(view(), ['tue']))
        self.assertEqual(si.missing(view(), ['thu']), ['thu: no options'], 'a held-back line is not an idea')
        self.assertTrue(any(line.startswith('good news:') for line in si.missing(view(), ['tue', 'sat'])), 'Saturday made again answers for its stories')
        self.assertEqual(si.missing(view(tue=False), ['tue', '']), ['tue: no options'])
        self.assertEqual(si.missing(view(goodnews_fresh=True), ['']), [], 'an empty days value is the whole board')


if __name__ == '__main__':
    unittest.main()
