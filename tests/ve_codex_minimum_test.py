"""The Codex minimum (Ruling, Krish, 2026-11-15): a whole cut published from the config's date is not ready until
Claude has recorded a checked Codex receipt of an art direction job on the piece's own ledger. Synthetic data only."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import codex_minimum, ledger  # noqa: E402

CFG = {'from': '2026-11-16', 'minimum': {'receipts': 1, 'jobs_any_of': ['art_direction', 'plates', 'device']},
       'jobs': {'art_direction': '', 'plates': '', 'device': '', 'browser': ''}}


def spec(day, excerpt=False):
    return {'publish_day': day, 'cuts': {'tall': {'excerpt': excerpt}}}


class CodexMinimum(unittest.TestCase):
    def test_the_shipped_config_names_the_jobs_it_counts(self):
        cfg = codex_minimum.config()
        self.assertTrue(set(cfg['minimum']['jobs_any_of']) <= set(cfg['jobs']))
        self.assertIn('Google Drive', cfg['codex_never'])
        self.assertIn('ai-harness', cfg['codex_never'])

    def test_older_pieces_and_excerpts_are_not_held(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(codex_minimum.problems(spec('2026-11-13'), 'tall', Path(tmp), CFG), [])
            self.assertEqual(codex_minimum.problems(spec('2026-11-20', excerpt=True), 'tall', Path(tmp), CFG), [])

    def test_a_new_piece_with_no_receipt_is_held_and_one_checked_receipt_clears_it(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            self.assertEqual(len(codex_minimum.problems(spec('2026-11-18'), 'tall', d, CFG)), 1)
            evidence = d / 'sheet.jpg'
            evidence.write_bytes(b'contact sheet')
            codex_minimum.record(d, 'card-1', 'browser', evidence, 'Claude', cfg=CFG)
            self.assertEqual(len(codex_minimum.problems(spec('2026-11-18'), 'tall', d, CFG)), 1, 'browser is not art direction')
            codex_minimum.record(d, 'card-2', 'plates', evidence, 'Claude', session='abc', desktop_visible=False, cfg=CFG)
            self.assertEqual(codex_minimum.problems(spec('2026-11-18'), 'tall', d, CFG), [])
            self.assertEqual(codex_minimum.status(spec('2026-11-18'), d, CFG)['not_visible_in_desktop'], ['card-2'])

    def test_codex_never_vouches_for_itself_and_evidence_must_exist(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / 'e.txt').write_text('x')
            with self.assertRaises(ValueError):
                codex_minimum.record(d, 'card', 'plates', d / 'e.txt', 'Codex', cfg=CFG)
            with self.assertRaises(ValueError):
                codex_minimum.record(d, 'card', 'plates', d / 'missing.txt', 'Claude', cfg=CFG)
            with self.assertRaises(ValueError):
                codex_minimum.record(d, 'card', 'poster', d / 'e.txt', 'Claude', cfg=CFG)

    def test_receipts_are_not_usage(self):
        self.assertIn('codex', ledger.RECEIPT_KINDS)

    def test_desktop_visibility_is_read_from_where_the_log_sits(self):
        home = Path(tempfile.gettempdir()) / 'codex-home-test'
        self.assertTrue(codex_minimum.visible_in_desktop(str(home / 'sessions' / 'a.jsonl'), home))
        self.assertFalse(codex_minimum.visible_in_desktop('/elsewhere/studio-codex/sessions/a.jsonl', home))
        self.assertIsNone(codex_minimum.visible_in_desktop(None, home))


if __name__ == '__main__':
    unittest.main()
