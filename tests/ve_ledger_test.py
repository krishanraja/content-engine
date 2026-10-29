"""Piece budgets: append-only usage, strict caps, clocks and CLI refusal."""
import argparse
import contextlib
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / 'scripts'))
import ve  # noqa: E402
from velib import ledger  # noqa: E402


@contextlib.contextmanager
def temporary_piece():
    # Python's Windows 0700 temporary-directory ACL excludes restricted sandbox
    # identities. Inherit the permitted temp root's ACL for these test fixtures.
    folder = Path(tempfile.gettempdir()) / f've-ledger-{uuid.uuid4().hex}'
    folder.mkdir(mode=0o777)
    try:
        yield str(folder)
    finally:
        shutil.rmtree(folder)


class PieceLedger(unittest.TestCase):
    def setUp(self):
        self.piece = self.enterContext(temporary_piece())
        self.folder = Path(self.piece) / 've'
        self.path = self.folder / 'ledger.jsonl'

    def call_cli(self, *args):
        return subprocess.run([sys.executable, '-B', str(ROOT / 'scripts' / 've.py'), *args],
                              capture_output=True, text=True,
                              env={**os.environ, 'PYTHONDONTWRITEBYTECODE': '1'})

    def test_empty_is_within_without_creating_files(self):
        self.assertEqual(ledger.totals(self.piece), {**dict.fromkeys(ledger.KINDS, 0), 'total_tokens': 0})
        ok, lines = ledger.check(self.piece)
        self.assertTrue(ok)
        self.assertTrue(all(line.startswith('OK ') for line in lines))
        ledger.require_within(self.piece)
        self.assertFalse(self.folder.exists())

    def test_totals_and_append_only_bytes(self):
        for index, kind in enumerate(ledger.KINDS, 1):
            before = self.path.read_bytes() if self.path.exists() else b''
            ledger.add(self.piece, kind, index, note='first\nsecond')
            after = self.path.read_bytes()
            self.assertTrue(after.startswith(before))
            self.assertGreater(len(after), len(before))
        before = self.path.read_bytes()
        ledger.add(self.piece, 'claude_tokens', 10)
        self.assertTrue(self.path.read_bytes().startswith(before))
        usage = ledger.totals(self.piece)
        self.assertEqual(usage['claude_tokens'], 11)
        self.assertEqual(usage['codex_tokens'], 2)
        self.assertEqual(usage['total_tokens'], 13)
        for index, kind in enumerate(ledger.KINDS[2:], 3):
            self.assertEqual(usage[kind], index)
        rows = [json.loads(line) for line in self.path.read_text(encoding='utf-8').splitlines()]
        self.assertEqual(len(rows), 7)
        self.assertEqual(rows[0]['note'], 'first\nsecond')
        self.assertIsNotNone(datetime.fromisoformat(rows[0]['ts']).utcoffset())

    def test_every_cap_warns_at_eighty_percent_and_is_strictly_over(self):
        limits = ledger.budget()
        # Isolate each cap so total tokens can be tested independently too.
        for key, label, cap_key in ledger.MEASURES:
            with self.subTest(key=key), temporary_piece() as piece:
                cap = limits[cap_key]
                kind = 'engine_seconds' if key == 'engine_minutes' else 'claude_tokens' if key == 'total_tokens' else key
                scale = 60 if key == 'engine_minutes' else 1
                ledger.add(piece, kind, cap * scale * 0.8)
                _, lines = ledger.check(piece)
                self.assertTrue(any(line.startswith(f'WARN {label}:') for line in lines))
                ledger.add(piece, kind, cap * scale * 0.2)
                _, lines = ledger.check(piece)
                self.assertTrue(any(line.startswith(f'WARN {label}:') for line in lines))
                ledger.add(piece, kind, 1)
                ok, lines = ledger.check(piece)
                self.assertFalse(ok)
                self.assertTrue(any(line.startswith(f'OVER {label}:') for line in lines))
                with self.assertRaises(SystemExit) as raised:
                    ledger.require_within(piece)
                self.assertTrue(all(line.startswith('OVER ') for line in str(raised.exception).splitlines()))

    def test_warn_is_not_a_refusal(self):
        ledger.add(self.piece, 'claude_tokens', 2640000)
        self.assertTrue(ledger.check(self.piece)[0])
        ledger.require_within(self.piece)
        ledger.add(self.piece, 'claude_tokens', 660000)
        self.assertTrue(ledger.check(self.piece)[0], 'exactly the cap remains within budget')

    def test_bad_kind_and_amounts_do_not_write(self):
        for kind, amount in [('clock_start', 1), ('bogus', 1), ('credits', -1),
                             ('credits', float('nan')), ('credits', float('inf')),
                             ('credits', -float('inf')), ('credits', '1'), ('credits', True)]:
            with self.subTest(kind=kind, amount=amount), self.assertRaises(ValueError):
                ledger.add(self.piece, kind, amount)
        self.assertFalse(self.folder.exists())

    def test_clock_start_stop_and_double_start(self):
        began = datetime(2026, 10, 28, 12, tzinfo=timezone.utc)
        ledger.add(self.piece, 'credits', 1)
        before = self.path.read_bytes()
        with patch.object(ledger, '_now', return_value=began):
            ledger.start_clock(self.piece, 'compile')
        self.assertEqual(self.path.read_bytes(), before)
        clock = ledger.clock_status(self.piece)
        self.assertEqual(clock, {'phase': 'compile', 'started': began.isoformat()})
        with self.assertRaisesRegex(ValueError, 'compile'):
            ledger.start_clock(self.piece, 'render')
        self.assertEqual(ledger.clock_status(self.piece), clock)
        with patch.object(ledger, '_now', return_value=began + timedelta(seconds=90.6)):
            self.assertEqual(ledger.stop_clock(self.piece), 91)
        self.assertFalse((self.folder / 'clock.json').exists())
        self.assertTrue(self.path.read_bytes().startswith(before))
        row = json.loads(self.path.read_text(encoding='utf-8').splitlines()[-1])
        self.assertEqual((row['kind'], row['amount'], row['note']), ('engine_seconds', 91, 'compile'))
        with self.assertRaisesRegex(ValueError, 'no running phase'):
            ledger.stop_clock(self.piece)

    def test_start_refused_when_engine_over_but_allowed_at_cap(self):
        ledger.add(self.piece, 'engine_seconds', ledger.budget()['engine_minutes_cap'] * 60)
        ledger.start_clock(self.piece, 'at-cap')
        ledger.stop_clock(self.piece)
        ledger.add(self.piece, 'engine_seconds', 1)
        args = argparse.Namespace(piece=self.piece, action='start', phase='over-cap')
        with contextlib.redirect_stderr(io.StringIO()) as error:
            self.assertEqual(ve.cmd_time(args), 1)
        self.assertIn('OVER engine minutes', error.getvalue())
        self.assertFalse((self.folder / 'clock.json').exists())

    def test_ledger_cli_function_exits_one_when_over(self):
        ledger.add(self.piece, 'codex_tokens', 2100001)
        with contextlib.redirect_stdout(io.StringIO()) as output:
            code = ve.cmd_ledger(argparse.Namespace(piece=self.piece, action=None))
        self.assertEqual(code, 1)
        self.assertIn('OVER codex tokens', output.getvalue())

    def test_cli_report_add_and_errors(self):
        result = self.call_cli('ledger', self.piece)
        self.assertEqual(result.returncode, 0, result.stderr)
        for label in ('claude tokens', 'codex tokens', 'total tokens', 'engine minutes',
                      'allowance points', 'credits', 'Krish-wait minutes', 'OK'):
            self.assertIn(label, result.stdout)
        result = self.call_cli('ledger', self.piece, 'add', 'claude_tokens', '1200000', '--note', 'trial')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('claude tokens 1.2M / 3.3M (36%)', result.stdout)
        self.assertEqual(json.loads(self.path.read_text())['note'], 'trial')
        before = self.path.read_bytes()
        for amount in ('-1', 'nan', 'inf'):
            result = self.call_cli('ledger', self.piece, 'add', 'credits', amount)
            self.assertEqual(result.returncode, 1, result.stderr)
            self.assertEqual(self.path.read_bytes(), before)
        result = self.call_cli('ledger', self.piece, 'add', 'engine_seconds', str(int(ledger.budget()['engine_minutes_cap'] * 60) + 1))
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn('OVER engine minutes', result.stdout)
        result = self.call_cli('time', self.piece, 'start', 'render')
        self.assertEqual(result.returncode, 1)
        self.assertFalse((self.folder / 'clock.json').exists())

    def test_time_cli_start_status_stop(self):
        for action in (('status',), ('start', 'render'), ('status',), ('stop',)):
            result = self.call_cli('time', self.piece, *action)
            self.assertEqual(result.returncode, 0, result.stderr)
            if action == ('start', 'render'):
                self.assertIn('render', result.stdout)
        self.assertGreaterEqual(ledger.totals(self.piece)['engine_seconds'], 0)
        self.assertFalse((self.folder / 'clock.json').exists())
        self.assertEqual(len(self.path.read_text().splitlines()), 1)

    def test_status_includes_active_time_without_writing_usage(self):
        began = datetime(2026, 10, 28, 12, tzinfo=timezone.utc)
        ledger.add(self.piece, 'engine_seconds', 60)
        before = self.path.read_bytes()
        with patch.object(ledger, '_now', return_value=began):
            ledger.start_clock(self.piece, 'render')
        with patch.object(ledger, '_now', return_value=began + timedelta(seconds=120)):
            with contextlib.redirect_stdout(io.StringIO()) as output:
                self.assertEqual(ve.cmd_time(argparse.Namespace(piece=self.piece, action='status')), 0)
        self.assertIn("phase 'render'", output.getvalue())
        self.assertIn(f"engine minutes 3 / {ledger.budget()['engine_minutes_cap']:g}", output.getvalue())
        self.assertEqual(self.path.read_bytes(), before)

    def test_dispatch_guard_runs_before_dispatch_and_is_optional(self):
        args = argparse.Namespace(card='test.md', wait=False, spend_approved=False, piece=self.piece)
        with patch('velib.cards.dispatch') as dispatch:
            dispatch.return_value = subprocess.CompletedProcess([], 0, 'sent', '')
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(ve.cmd_dispatch(args), 0)
            dispatch.assert_called_once()
            dispatch.reset_mock()
            ledger.add(self.piece, 'allowance_points', 1.21)
            with self.assertRaises(SystemExit):
                ve.cmd_dispatch(args)
            dispatch.assert_not_called()
            del args.piece
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(ve.cmd_dispatch(args), 0)
            dispatch.assert_called_once()

    def test_help_for_commands_and_actions(self):
        for command in ('ledger', 'time'):
            for flag in ('-h', '--help'):
                result = self.call_cli(command, flag)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn('piece', result.stdout)
        for command, action in (('ledger', 'add'), ('time', 'start'), ('time', 'stop'), ('time', 'status')):
            result = self.call_cli(command, self.piece, action, '-h')
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn('usage:', result.stdout)


if __name__ == '__main__':
    unittest.main()
