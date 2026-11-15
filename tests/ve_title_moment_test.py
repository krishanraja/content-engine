"""The episode title moment (scripts/velib/lint.py title_moment_lints). Krish, 2026-11-15: the episode title should be
"integrated into a sentence seamlessly near the start of the video and the production suite knows that this is the
moment to make it feel like the title, instead of regular captions". Synthetic specs only."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import lint  # noqa: E402

BEATS = [{'id': f'b{i}', 'span': {'from_w': i * 10, 'to_w': i * 10 + 9}} for i in range(6)]


def spec(day='2026-11-16', series='follow.the.money', moment=None):
    s = {'publish_day': day, 'brand': {'series': series}, 'cuts': {'short': {'beats': BEATS}}}
    if moment is not None:
        s['title_moment'] = moment
    return s


class TitleMoment(unittest.TestCase):
    def test_a_series_piece_without_its_title_moment_fails(self):
        self.assertTrue(any('title.moment' in p for p in lint.title_moment_lints(spec())))

    def test_the_title_said_in_a_sentence_near_the_start_passes(self):
        moment = {'title': 'Who pays for AI music', 'line': 'So today the question is who pays for AI music, and why.',
                  'spans': {'short': {'from_w': 8, 'to_w': 18}}}
        self.assertEqual(lint.title_moment_lints(spec(moment=moment)), [])

    def test_a_line_that_does_not_carry_the_title_or_comes_late_fails(self):
        off = {'title': 'Who pays for AI music', 'line': 'Here is something about streaming money today.'}
        self.assertTrue(any('does not carry the title' in p for p in lint.title_moment_lints(spec(moment=off))))
        late = {'title': 'Who pays for AI music', 'line': 'Who pays for AI music is the question.',
                'spans': {'short': {'from_w': 50, 'to_w': 56}}}
        self.assertTrue(any('near the start' in p for p in lint.title_moment_lints(spec(moment=late))))

    def test_an_off_day_or_an_earlier_piece_is_not_held(self):
        self.assertEqual(lint.title_moment_lints(spec(day='2026-11-17')), [])
        self.assertEqual(lint.title_moment_lints(spec(day='2026-11-13', series='mind.the.gap')), [])


if __name__ == '__main__':
    unittest.main()
