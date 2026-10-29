#!/usr/bin/env python3
"""The weekly credit budget (plan Wave 2, W2.6): signed by Krish like the engine's other signed records, reserved
against before every dispatch and generation, and refusing anything over it. Synthetic records only: the test signs a
throwaway copy in a temporary folder, never the repository's budget."""
import copy
import datetime as dt
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import cards, credits, designlock, ledger  # noqa: E402

MONDAY = dt.date(2026, 11, 16)


def signed(caps=None):
    record = json.loads(credits.TEMPLATE.read_text(encoding='utf-8'))
    record['from_week'] = '2026-11-09'
    record['caps'] = dict(caps or {'codex_allowance_points': 3, 'codex_paid_credits': 0, 'runway_credits': 100,
                                   'higgsfield_credits': 50, 'elevenlabs_credits': 0})
    record['signed'] = {'by': 'Krish', 'said': 'synthetic test words, never his', 'on': '2026-11-07', 'record_sha256': ''}
    record['signed']['record_sha256'] = credits.record_hash(record)
    return record


class BudgetTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.env = mock.patch.dict(os.environ, {'VE_CREDIT_LEDGER': str(self.dir / 'ledger')})
        self.env.start()
        self.path = self.dir / 'credit-budget.json'
        self.path.write_text(json.dumps(signed()), encoding='utf-8')

    def tearDown(self):
        self.env.stop()
        self.tmp.cleanup()

    def test_the_template_is_never_signed(self):
        template = json.loads(credits.TEMPLATE.read_text(encoding='utf-8'))
        self.assertTrue(credits.verify(template))
        self.assertEqual(template['signed']['by'], '')
        self.assertTrue(all(v is None for v in template['caps'].values()))
        self.assertFalse(credits.RECORD.exists(), 'the amounts are Krish\'s: no session commits a signed budget')

    def test_a_signed_record_stands_and_an_edited_or_unsigned_one_does_not(self):
        self.assertEqual(credits.verify(signed()), [])
        edited = signed()
        edited['caps']['runway_credits'] = 1000
        self.assertIn('changed after Krish signed', ' '.join(credits.verify(edited)))
        other = signed()
        other['signed']['by'] = 'Claude'
        self.assertIn('not signed', ' '.join(credits.verify(other)))
        short = signed()
        short['signed']['said'] = 'yes'
        self.assertTrue(credits.verify(short))

    def test_reservations_refuse_anything_over_the_cap(self):
        first = ledger.reserve('runway_credits', 60, 'p', 'plate', today=MONDAY, budget_path=self.path)
        with self.assertRaises(SystemExit) as over:
            ledger.reserve('runway_credits', 41, 'p', 'plate', today=MONDAY, budget_path=self.path)
        self.assertIn('over the signed weekly credit budget', str(over.exception))
        ledger.settle(first, 20, today=MONDAY)
        ledger.reserve('runway_credits', 41, 'p', 'plate', today=MONDAY, budget_path=self.path)
        week = ledger.weekly(MONDAY.isoformat(), signed())['runway_credits']
        self.assertEqual((week['settled'], week['open'], week['used']), (20, 41, 61))
        with self.assertRaises(SystemExit):
            ledger.reserve('elevenlabs_credits', 1, today=MONDAY, budget_path=self.path)
        # A new week starts from nothing.
        ledger.reserve('runway_credits', 100, today=MONDAY + dt.timedelta(days=7), budget_path=self.path)

    def test_nothing_spends_without_a_signed_budget(self):
        with self.assertRaises(SystemExit):
            ledger.reserve('runway_credits', 1, today=MONDAY, budget_path=self.dir / 'missing.json')
        with self.assertRaises(SystemExit):
            ledger.reserve('runway_credits', 1, today=dt.date(2026, 11, 2), budget_path=self.path)

    def test_a_card_is_held_when_no_codex_profile_can_be_read(self):
        card = self.dir / 'card.md'
        card.write_text('---\ncard: t\nkind: plate\n---\n## Acceptance\n## Return\n', encoding='utf-8')
        with mock.patch.dict(sys.modules, {'codex_profile': None}), mock.patch.object(cards.subprocess, 'run') as run:
            with self.assertRaises(SystemExit) as held:
                cards.dispatch(card)
            run.assert_not_called()
        self.assertIn('no Codex tool profile', str(held.exception))

    def test_dispatch_holds_a_forbidden_card_and_reserves_before_it_sends(self):
        if not (ROOT / 'scripts' / 'overnight' / 'codex_profile.py').exists():
            self.skipTest('the Codex profile arrives with the non-ve overnight pull request (W2.6)')
        card = self.dir / 'card.md'
        card.write_text('---\ncard: t\nkind: plate\ntools: shell, buffer_create_post\ncwd: ' + str(self.dir) + '\n---\n## Acceptance\n## Return\n', encoding='utf-8')
        with mock.patch.object(cards, 'subprocess') as sub:
            with self.assertRaises(SystemExit) as held:
                cards.dispatch(card)
            sub.run.assert_not_called()
        self.assertIn('held', str(held.exception))
        self.assertTrue(json.loads(card.with_suffix('.held.json').read_text())['held'])
        card.write_text(card.read_text().replace('shell, buffer_create_post', 'shell, image_generation') , encoding='utf-8')
        with mock.patch.object(credits, 'RECORD', self.path), mock.patch.object(cards, 'weekly_used_percent', return_value=10.0), \
                mock.patch.object(credits, 'week_of', return_value=MONDAY.isoformat()), \
                mock.patch.object(cards, 'companion', return_value='companion.mjs'), \
                mock.patch.object(cards.subprocess, 'run') as run:
            cards.dispatch(card)
            self.assertEqual(run.call_count, 1)
            for _ in range(2):
                cards.dispatch(card)
            with self.assertRaises(SystemExit):
                cards.dispatch(card)   # a fourth card passes the 3-point Codex cap
            self.assertEqual(run.call_count, 3)
        with mock.patch.object(credits, 'RECORD', self.path), mock.patch.object(cards, 'weekly_used_percent', return_value=95.0), \
                mock.patch.object(credits, 'week_of', return_value=MONDAY.isoformat()), \
                mock.patch.object(cards.subprocess, 'run') as run:
            with self.assertRaises(SystemExit) as paid:
                cards.dispatch(card)   # past the ceiling Codex draws paid credits, and his cap for them is 0
            self.assertIn('codex_paid_credits', str(paid.exception))
            run.assert_not_called()

    def test_the_spend_flag_is_gone(self):
        self.assertNotIn('spend_approved', (ROOT / 'scripts' / 'velib' / 'cards.py').read_text())
        self.assertNotIn('--spend-approved', (ROOT / 'scripts' / 've.py').read_text())

    def test_ve_lock_spend_carries_his_words_into_the_design_lock(self):
        lock = self.dir / 'design-lock.json'
        lock.write_text((ROOT / 'config' / 've' / 'design-lock.json').read_text(encoding='utf-8'), encoding='utf-8')
        record = signed()
        designlock.spend_from_budget(record, lock_path=lock)
        animation = json.loads(lock.read_text())['plates']['animation']
        self.assertIn('weekly credit budget Krish signed', animation['spend_needs'])
        self.assertEqual(animation['spend_signed']['said'], record['signed']['said'])
        self.assertEqual(animation['spend_signed']['record_sha256'], credits.record_hash(record))


if __name__ == '__main__':
    unittest.main()
