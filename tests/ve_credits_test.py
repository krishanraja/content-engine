#!/usr/bin/env python3
"""The weekly credit budget (plan Wave 2, W2.6): its caps are Control Center's credit read for the publication
(Krish, 2026-10-29: credits are "handled by ai-harness and control-center"), reserved against before every dispatch and
generation, refusing anything over a cap, and holding when the read is missing, held, unknown, stale or has no pool.
Synthetic reads only, in a temporary folder."""
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


def read(pools=None, held=False, known=True):
    """A synthetic get_engine_credits answer (never real numbers)."""
    pools = pools if pools is not None else {'codex': 3, 'codex-credits': 0, 'runway': 100, 'higgsfield': 50, 'elevenlabs': 0}
    block = {'rule': 'synthetic', 'pools': [{'pool': k, 'tool': k, 'unit': 'credits', 'remaining_for_you': v,
                                             'use_by': '2026-11-30', 'balance_as_of': '2026-11-16T00:00:00+00:00'}
                                            for k, v in pools.items()]}
    return {'ok': True, 'engine_id': 'growth-makeyourmindup', 'product_slug': 'publication', 'held': held,
            'credits': block if known else None}


def signed(caps=None):
    """The saved record (the name stays for the older tests below)."""
    pools = None if caps is None else {credits.POOLS[k]: v for k, v in caps.items()}
    return credits.from_read(read(pools), today=MONDAY)


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

    def test_no_session_commits_a_budget_or_types_a_cap(self):
        self.assertFalse((ROOT / 'config' / 've' / 'credit-budget.json').exists())
        self.assertFalse((ROOT / 'config' / 've' / 'credit-budget.template.json').exists())
        self.assertNotIn('signed', json.dumps(signed()))

    def test_a_pulled_read_stands_and_an_edited_held_or_unknown_one_does_not(self):
        self.assertEqual(credits.verify(signed()), [])
        edited = signed()
        edited['caps']['runway_credits'] = 1000
        self.assertIn('edited after it was pulled', ' '.join(credits.verify(edited)))
        held = credits.from_read(read(held=True), today=MONDAY)
        self.assertIn('held: true', ' '.join(credits.verify(held)))
        unknown = credits.from_read(read(known=False), today=MONDAY)
        self.assertIn('unknown', ' '.join(credits.verify(unknown)))
        other = read()
        other['engine_id'] = 'growth-heartside'
        self.assertTrue(credits.verify(credits.from_read(other, today=MONDAY)))
        with self.assertRaises(ValueError):
            credits.from_read({'ok': False, 'error': 'unknown_engine'})

    def test_a_provider_with_no_pool_placed_holds_by_name(self):
        path = self.dir / 'partial.json'
        credits.save(credits.from_read(read({'elevenlabs': 10}), today=MONDAY), path)
        with self.assertRaises(SystemExit) as held:
            ledger.reserve('runway_credits', 1, today=MONDAY, budget_path=path)
        self.assertIn('no runway pool', str(held.exception))
        ledger.reserve('elevenlabs_credits', 10, today=MONDAY, budget_path=path)

    def test_a_stale_read_holds(self):
        with self.assertRaises(SystemExit) as stale:
            ledger.reserve('runway_credits', 1, today=MONDAY + dt.timedelta(days=credits.MAX_AGE_DAYS + 1), budget_path=self.path)
        self.assertIn('pull it again', str(stale.exception))

    def test_ve_budget_pull_saves_the_read_bound_to_its_hash(self):
        answer = self.dir / 'answer.json'
        answer.write_text(json.dumps(read()), encoding='utf-8')
        out = self.dir / 'pulled.json'
        import subprocess
        r = subprocess.run([sys.executable, str(ROOT / 'scripts' / 've.py'), 'budget', 'pull', '--read', str(answer),
                            '--record', str(out)], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        saved = json.loads(out.read_text())
        self.assertEqual(saved['record_sha256'], credits.record_hash(saved))
        self.assertEqual(saved['caps']['runway_credits'], 100)

    def test_reservations_refuse_anything_over_the_cap(self):
        first = ledger.reserve('runway_credits', 60, 'p', 'plate', today=MONDAY, budget_path=self.path)
        with self.assertRaises(SystemExit) as over:
            ledger.reserve('runway_credits', 41, 'p', 'plate', today=MONDAY, budget_path=self.path)
        self.assertIn('over the credit cap from Control Center', str(over.exception))
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

    def test_ve_lock_spend_binds_the_design_lock_to_the_credit_read(self):
        lock = self.dir / 'design-lock.json'
        lock.write_text((ROOT / 'config' / 've' / 'design-lock.json').read_text(encoding='utf-8'), encoding='utf-8')
        record = signed()
        designlock.spend_from_budget(record, lock_path=lock)
        animation = json.loads(lock.read_text())['plates']['animation']
        self.assertIn('Control Center', animation['spend_needs'])
        self.assertEqual(animation['spend_source']['record_sha256'], credits.record_hash(record))
        self.assertNotIn('spend_signed', animation)


if __name__ == '__main__':
    unittest.main()
