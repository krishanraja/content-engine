"""Saturday is good-news carousels of varied, non-medical-led good news (Krish, 2026-11-19, of Sat 28's ideas board: "We
also need to significantly improve the good news suggestions. These are still all just one idea, mostly, and they're
not good news carousels. Some of them are memes that are sneaking through, and the only actual uplifting carousel is
about AI in hospital again, which is all we post about. We should find good news that's not medical stuff.").
idea_checks.goodnews_findings, read by board_feed.py gate (code goodnews), on Sat 28's own options and a fixed set."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import idea_checks as ic  # noqa: E402

SAT_28 = json.loads((ROOT / 'tests' / 'fixtures' / 'good-news' / 'sat-28.json').read_text(encoding='utf-8'))
WEEK = '2026-11-23'
# The Saturdays before, as the gate reads them: 9 Nov's weekly good news held a health story and the maths-proof option two,
# 16 Nov's one.
HISTORY = [{'week': '2026-11-09', 'kind': 'science', 'medical': 0}, {'week': '2026-11-16', 'kind': 'people', 'medical': 1},
           {'week': '2026-11-09', 'kind': 'climate', 'medical': 1}, {'week': '2026-11-09', 'kind': None, 'medical': 2}]


def story(kind, n):
    return {'headline': f'H{n}', 'what': 'w', 'why': 'y', 'kind': kind, 'date': '2026-11-20',
            'source': {'label': 'L', 'url': f'https://example.org/{kind}/{n}'}, 'media': {'kind': 'photo', 'url': 'https://example.org/p.jpg'}}


def carousel(id_, topic_kind, topic, kinds=None):
    return {'id': id_, 'kind': 'good_news', 'format': 'Good news carousel, 7 cards, 4:5', 'topic': topic, 'topic_kind': topic_kind,
            'hook': topic, 'stories': [story(k, n) for n, k in enumerate(kinds or [topic_kind] * 5)]}


class SatTwentyEight(unittest.TestCase):
    def setUp(self):
        self.lines = [f['line'] for f in ic.goodnews_findings(SAT_28, WEEK, HISTORY)]

    def test_memes_explainers_and_one_story_carousels_are_refused(self):
        for ref in ('off-sat-builditself', 'off-sat-salesagent', 'off-sat-presszero', 'off-sat-parentsban'):
            self.assertTrue(any(x.startswith(f'goodnews: {ref} is ') and 'only good-news carousels' in x for x in self.lines), ref)

    def test_one_good_news_carousel_is_too_few(self):
        self.assertTrue(any('has 1 good-news carousel' in x for x in self.lines))

    def test_the_hospital_carousel_is_refused_after_a_month_of_medical_stories(self):
        self.assertTrue(any(x.startswith('goodnews: off-sat-goodnews is a medical topic') for x in self.lines), self.lines)

    def test_every_finding_fails_the_run(self):
        self.assertIn('goodnews', ic.GATE_CODES)


class FixedSaturday(unittest.TestCase):
    GOOD = {'week_start': WEEK, 'offdays': {'sat': [
        carousel('archives', 'creative', 'Lost films and songs brought back with AI'),
        carousel('shops', 'business', 'Small firms AI made money for this month'),
        carousel('classroom', 'learning', 'Pupils reading better with AI tutors', ['learning'] * 4 + ['health'])]}}

    def test_three_good_news_carousels_on_new_topics_pass(self):
        self.assertEqual(ic.goodnews_findings(self.GOOD, WEEK, HISTORY), [])

    def test_two_on_one_topic_and_a_topic_from_last_week_are_refused(self):
        same = json.loads(json.dumps(self.GOOD))
        same['offdays']['sat'][1] = carousel('music', 'creative', 'Musicians finding new fans with AI')
        self.assertTrue(any('same topic' in f['line'] for f in ic.goodnews_findings(same, WEEK, HISTORY)))
        again = json.loads(json.dumps(self.GOOD))
        again['offdays']['sat'][2] = carousel('access', 'people', 'AI helping people speak and sign')
        self.assertTrue(any('the topic Saturday carried in the week of 2026-11-16' in f['line'] for f in ic.goodnews_findings(again, WEEK, HISTORY)))

    def test_a_carousel_on_another_topic_carries_at_most_one_medical_story(self):
        heavy = json.loads(json.dumps(self.GOOD))
        heavy['offdays']['sat'][2] = carousel('classroom', 'learning', 'Pupils reading better', ['learning'] * 3 + ['health'] * 2)
        self.assertTrue(any('carries 2 medical stories' in f['line'] for f in ic.goodnews_findings(heavy, WEEK, HISTORY)))

    def test_a_short_carousel_is_refused_unless_it_asks_for_the_rest(self):
        short = json.loads(json.dumps(self.GOOD))
        short['offdays']['sat'][0]['stories'] = short['offdays']['sat'][0]['stories'][:1]
        self.assertTrue(any('holds 1 story' in f['line'] for f in ic.goodnews_findings(short, WEEK, HISTORY)))
        short['offdays']['sat'][0]['stories_to_find'] = True
        self.assertEqual(ic.goodnews_findings(short, WEEK, HISTORY), [])

    def test_earlier_boards_keep_the_shape_they_were_made_in(self):
        self.assertEqual(ic.goodnews_findings(SAT_28, '2026-11-16', HISTORY), [])

    def test_the_topic_is_read_from_the_words_when_not_given(self):
        self.assertEqual(ic.topic_kind_of('AI in the hospital this week: five good things'), 'health')
        self.assertEqual(ic.topic_kind_of('Small firms AI made money for this month'), 'business')


if __name__ == '__main__':
    unittest.main()
