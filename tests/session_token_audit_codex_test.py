"""The Codex ledger (`session_token_audit.py --codex`), on the synthetic rollouts in tests/fixtures/codex: a root
thread, its forked child agent and an older token_count-only thread. `ve ledger` wraps this interface."""
import builtins
import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
HOME = ROOT / 'tests/fixtures/codex'
spec = importlib.util.spec_from_file_location('session_token_audit', ROOT / 'scripts/session_token_audit.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

PARENT, CHILD, OTHER = ('01a10000-0000-7000-8000-00000000000' + c for c in '123')
ALL = audit.stamp('2000-01-01')
ROW = {'file', 'title', 'cwd', 'start', 'end', 'wall_h', 'active_h', 'model_calls', 'tool_calls', 'models', 'tokens',
       'weekly_used_pct', 'credits'}


def cli(*args):
    r = subprocess.run([sys.executable, 'scripts/session_token_audit.py', '--codex', '--codex-home', str(HOME), *args],
                       cwd=ROOT, capture_output=True, text=True, encoding='utf-8')
    assert r.returncode == 0, r.stderr
    return r.stdout


class CodexLedgerTests(unittest.TestCase):
    def test_one_thread(self):
        rep = audit.codex_report(HOME, session=PARENT)
        [row] = rep['sessions']
        self.assertEqual(Path(row['file']).name, f'rollout-2026-10-24T08-00-00-{PARENT}.jsonl')
        self.assertEqual(row['title'], 'Produce Friday videos')  # the newest rename in session_index.jsonl
        self.assertEqual(row['cwd'], 'C:\\work\\friday-videos')
        self.assertEqual((row['start'], row['end']), ('2026-10-24T08:00:00Z', '2026-10-24T08:36:01Z'))
        self.assertEqual(row['wall_h'], 0.6)
        self.assertEqual(row['active_h'], 0.1)  # 301 s + 61 s: the 30 idle minutes do not count
        self.assertEqual((row['model_calls'], row['tool_calls']), (3, 2))
        self.assertEqual(row['models'], {'gpt-test': {'calls': 3, 'effort': {'high': 2, 'medium': 1}}})
        self.assertEqual(row['tokens'], {'input': 6000, 'cached': 5600, 'output': 300, 'reasoning': 50})
        self.assertEqual(row['weekly_used_pct'], {'start': 40.0, 'end': 42.5})
        self.assertEqual(row['credits'], {'start': 500.5, 'end': 498.25})
        self.assertEqual(rep['totals']['plan_type'], 'pro')

    def test_children_are_grouped_under_their_parent(self):
        rep = audit.codex_report(HOME, session=PARENT, children=True)
        parent, child = rep['sessions']
        self.assertEqual(child['title'], 'Ada /root/judge')
        # The fork's replayed copy of its parent's history counts for nothing: one call and one tool call of its own
        self.assertEqual((child['model_calls'], child['tool_calls']), (1, 1))
        self.assertEqual(child['tokens'], {'input': 500, 'cached': 400, 'output': 25, 'reasoning': 5})
        self.assertEqual(child['models'], {'gpt-test-mini': {'calls': 1, 'effort': {'low': 1}}})
        tot = rep['totals']
        self.assertEqual((tot['threads'], tot['model_calls'], tot['tool_calls']), (2, 4, 3))
        self.assertEqual(tot['tokens'], {'input': 6500, 'cached': 6000, 'output': 325, 'reasoning': 55})
        self.assertEqual(tot['weekly_used_pct'], {'start': 40.0, 'end': 43.0})
        self.assertEqual(tot['credits'], {'start': 500.5, 'end': 497.0})
        [group] = tot['groups']
        self.assertEqual((group['root'], group['threads'], group['file']), (PARENT, 2, parent['file']))
        self.assertEqual(group['files'], [parent['file'], child['file']])

    def test_a_log_from_before_token_usage_record(self):
        [row] = audit.codex_report(HOME, session=OTHER)['sessions']
        # Each new cumulative total is one call; the repeat at 11:01:01 is not
        self.assertEqual((row['model_calls'], row['tool_calls']), (2, 1))
        self.assertEqual(row['tokens'], {'input': 300, 'cached': 200, 'output': 30, 'reasoning': 4})
        self.assertEqual(row['models'], {'gpt-old': {'calls': 2, 'effort': {'xhigh': 2}}})
        self.assertEqual(row['weekly_used_pct'], {'start': 44.0, 'end': 44.5})  # the 10080-minute window only
        self.assertEqual(row['credits'], {'start': None, 'end': None})

    def test_the_window_clips_every_thread(self):
        rep = audit.codex_report(HOME, since=audit.stamp('2026-10-24T08:30:00Z'), until=audit.stamp('2026-10-24T09:00:00Z'))
        [row] = rep['sessions']
        self.assertEqual((row['start'], row['model_calls'], row['tokens']['input']), ('2026-10-24T08:35:00Z', 1, 3000))
        self.assertEqual(row['models'], {'gpt-test': {'calls': 1, 'effort': {'medium': 1}}})
        self.assertEqual(row['weekly_used_pct'], {'start': 42.5, 'end': 42.5})

    def test_cwd_filter(self):
        names = lambda rep: [r['title'] for r in rep['sessions']]
        self.assertEqual(names(audit.codex_report(HOME, since=ALL, cwd='FRIDAY')), ['Produce Friday videos', 'Ada /root/judge'])
        self.assertEqual(names(audit.codex_report(HOME, since=ALL, cwd='other-repo')), ['Other work'])

    def test_session_by_file_or_unique_id(self):
        f = HOME / f'sessions/2026/10/26/rollout-2026-10-26T09-00-00-{CHILD}.jsonl'
        [row] = audit.codex_report(HOME, session=str(f))['sessions']
        self.assertEqual(row['model_calls'], 1)
        [row] = audit.codex_report(HOME, session=OTHER.upper())['sessions']
        self.assertEqual(row['title'], 'Other work')
        for vague in (PARENT[:13], 'ffffffff'):  # three threads share that start; none has this one
            with self.assertRaises(SystemExit):
                audit.codex_report(HOME, session=vague)

    def test_json_interface_and_no_words(self):
        out = cli('--since', '2000-01-01', '--json')
        rep = json.loads(out)
        self.assertEqual(set(rep), {'sessions', 'totals'})
        for row in rep['sessions']:
            self.assertEqual(set(row), ROW)
            self.assertEqual(set(row['tokens']), {'input', 'cached', 'output', 'reasoning'})
            self.assertEqual(set(row['weekly_used_pct']), {'start', 'end'})
            self.assertEqual(set(row['credits']), {'start', 'end'})
        self.assertEqual(rep['totals']['model_calls'], 6)
        for text in (out, cli('--since', '2000-01-01'), cli('--session', PARENT, '--children', '--line')):
            self.assertNotIn('WORDS-NEVER-PRINTED', text)
        self.assertIn('4 calls', cli('--session', PARENT, '--children', '--line'))

    def test_reads_only_rollouts_and_the_index(self):
        real = builtins.open
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp) / 'codex'
            shutil.copytree(HOME, home)
            (home / 'auth.json').write_text('{}')
            opened = []
            with mock.patch('builtins.open', lambda f, *a, **k: opened.append(Path(f)) or real(f, *a, **k)):
                rep = audit.codex_report(home, since=ALL)
            self.assertEqual(rep['totals']['threads'], 3)
            home = home.resolve()
            for f in opened:
                f = f.resolve()
                self.assertTrue(f == home / 'session_index.jsonl' or home / 'sessions' in f.parents, f)

    def test_compressed_rollouts(self):
        try:
            from compression import zstd
        except ImportError:
            if not shutil.which('zstd'):
                self.skipTest('needs Python 3.14 or the zstd command')
            zstd = None
        plain = audit.codex_report(HOME, session=PARENT, children=True)
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp) / 'codex'
            shutil.copytree(HOME, home)
            for f in (home / 'sessions').rglob('*.jsonl'):
                if zstd:
                    Path(f'{f}.zst').write_bytes(zstd.compress(f.read_bytes()))
                else:
                    subprocess.run(['zstd', '-q', str(f), '-o', f'{f}.zst'], check=True)
                f.unlink()
            packed = audit.codex_report(home, session=PARENT, children=True)
        strip = lambda rep: [{k: v for k, v in r.items() if k != 'file'} for r in rep['sessions']]
        self.assertEqual(strip(packed), strip(plain))


if __name__ == '__main__':
    unittest.main()
