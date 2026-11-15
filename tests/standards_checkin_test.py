"""The weekly standards check-in's builder (scripts/standards_checkin.py): its pure parts on synthetic rows, and the
workflow stays code only (Ruling, Krish, 2026-11-15: the weekly standards check-in is one pinned claude.ai artifact
refreshed weekly, an exception to "No Claude artifact, ever")."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import standards_checkin  # noqa: E402


class Builder(unittest.TestCase):
    def test_self_test(self):
        self.assertEqual(standards_checkin.self_test(), 0)

    def test_the_weekly_job_is_code_only_and_prints_no_words(self):
        text = (ROOT / '.github/workflows/standards-checkin.yml').read_text(encoding='utf-8')
        self.assertNotIn('claude-code-action', text)
        self.assertNotIn('CLAUDE_CODE_OAUTH_TOKEN', text)
        self.assertIn("cron: '0 7 * * 0'", text)
        self.assertIn('workflow_dispatch', text)
        self.assertIn('python3 scripts/standards_checkin.py --apply', text)

    def test_the_live_grouping_places_every_standard_today(self):
        floor = standards_checkin.floor_group.load(standards_checkin.floor_group.FLOOR)
        groups = standards_checkin.floor_group.load(standards_checkin.floor_group.GROUPS)
        new, _ = standards_checkin.propose(floor, groups, {}, '2026-11-22')
        merged = dict(groups, groups=groups['groups'] + new)
        self.assertEqual(standards_checkin.floor_group.check(floor, merged), [])


if __name__ == '__main__':
    unittest.main()
