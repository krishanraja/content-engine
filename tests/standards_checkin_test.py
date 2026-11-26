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

    def test_a_proposed_group_never_carries_a_long_dash(self):
        # 26 Nov: a new group's check, copied from its first standard, carried an em dash, floor_group.check refused
        # it ("its check has a long dash"), and the floor pull request stayed red.
        em, en = '—', '–'
        floor = {'standards': {
            's0000000001': {'theme': 'cover', 'never_beneath': 'A cover stops the scroll.', 'check_before_delivery': 'Look.'},
            's0000000002': {'theme': 'cover', 'never_beneath': 'A cover names who.', 'check_before_delivery': 'Look.'},
            's0000000003': {'theme': 'cover', 'never_beneath': 'A cover looks like one.', 'check_before_delivery': 'Look.'},
            's0000000004': {'theme': 'edit_av', 'never_beneath': f'Cuts land on the beat {em} never off it.',
                            'check_before_delivery': f'Watch it twice {em} sound on, then 3{en}5 seconds muted.'}}}
        groups = {'groups': [{'key': 'covers', 'title': 'Covers', 'never_beneath': 'Covers stop the scroll.',
                              'check': 'Look.', 'members': ['s0000000001', 's0000000002']}],
                  'operating': {'title': 'Ops', 'members': []}}
        db = {'covers': {'status': 'approved', 'amendment': f'Covers stop the scroll {em} every time.'}}
        new, _ = standards_checkin.propose(floor, groups, db, '2026-11-26')
        by_key = {g['key']: g for g in new}
        self.assertEqual(by_key['new_edit_av_261126']['check'], 'Watch it twice, sound on, then 3 to 5 seconds muted.')
        self.assertEqual(by_key['new_edit_av_261126']['never_beneath'], 'Cuts land on the beat, never off it.')
        self.assertEqual(by_key['covers_e261126']['never_beneath'], 'Covers stop the scroll, every time.')
        for g in new:
            for field in ('title', 'never_beneath', 'check'):
                self.assertNotIn(em, g[field])
                self.assertNotIn(en, g[field])
        merged = dict(groups, groups=groups['groups'] + new)
        self.assertEqual(standards_checkin.floor_group.check(floor, merged), [])

    def test_an_evolution_in_a_ruled_lineage_carries_the_ruled_words(self):
        # 26 Nov: bold_predictions_e261126 copied his database amendment, which quotes his words after the statement,
        # and tests/floor_rulings_test.py refused it; the ruling's statement is what every group in the lineage carries.
        import floor_rulings
        statement = floor_rulings.load_rulings()['retired']['groups']['statement']
        floor = {'standards': {
            's0000000001': {'theme': 'close', 'never_beneath': 'An insight.', 'check_before_delivery': 'Read.'},
            's0000000002': {'theme': 'close', 'never_beneath': 'A question.', 'check_before_delivery': 'Read.'},
            's0000000003': {'theme': 'close', 'never_beneath': 'An open end.', 'check_before_delivery': 'Read.'}}}
        groups = {'groups': [{'key': 'bold_predictions', 'title': 'No predictions', 'never_beneath': statement,
                              'check': 'Read the close.', 'members': ['s0000000001', 's0000000002']}],
                  'operating': {'title': 'Ops', 'members': []}}
        db = {'bold_predictions': {'status': 'approved', 'amendment': statement + ' (Krish, 2026-11-24: "his words").'}}
        new, _ = standards_checkin.propose(floor, groups, db, '2026-11-26')
        self.assertEqual([g['key'] for g in new], ['bold_predictions_e261126'])
        self.assertEqual(new[0]['never_beneath'], statement)
        self.assertIsNone(standards_checkin.ruled_words('covers_e261126'))


if __name__ == '__main__':
    unittest.main()
