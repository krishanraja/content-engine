"""scripts/post-pack/week_plan.py min_ideas: a publishing day offers four ideas, or, once ideas.json marks it a thin week
after its re-gather, the thin minimum in config/story-score.json (Ruling, Krish, 2026-11-26: never an empty board, never
a relaxed floor). The 7 Dec board had two or three options a day passing every floor and could not be shown."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import week_plan  # noqa: E402

THIN_MIN = json.loads((ROOT / 'config' / 'story-score.json').read_text())['hero_floors']['thin_week']['thin_min']


class MinIdeasTest(unittest.TestCase):
    def test_four_unless_the_day_is_marked_thin(self):
        self.assertEqual(week_plan.min_ideas({}, 'mon'), week_plan.MIN_IDEAS)
        self.assertEqual(week_plan.min_ideas({'thin_week': {'wed': {'regathered': True}}}, 'mon'), week_plan.MIN_IDEAS)
        self.assertEqual(week_plan.min_ideas({'thin_week': {'wed': {'regathered': True}}}, 'wed'), THIN_MIN)

    def test_only_a_real_regather_mark_counts(self):
        for mark in ({'regathered': False}, {'regathered': 'yes'}, True, {}, None):
            self.assertEqual(week_plan.min_ideas({'thin_week': {'fri': mark}}, 'fri'), week_plan.MIN_IDEAS, mark)


if __name__ == '__main__':
    unittest.main()
