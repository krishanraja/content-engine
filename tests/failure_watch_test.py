"""The technical watch-outs (scripts/check_failures.py --watch; Krish, 2026-11-17: "i need to turn this in to
surgical, precise, technical watch outs for my next batch of productions").

A watch-out names makers the rejection floor knows and is one plain line; --watch prints those for the makers asked,
open ones first, each with what stops it now or that nothing does; an unknown maker is refused. The four failures of
6 to 8 Nov are in the register with their watch-outs, and the smeared-picture one is guarded by a test.
"""
import json
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import check_failures  # noqa: E402

REGISTER = json.loads((ROOT / 'config/failures.json').read_text(encoding='utf-8'))


def entry(fid, **extra):
    return {'id': fid, 'on': '2026-11-17', 'status': 'guarded', 'what': 'x',
            'guards': [{'file': 'scripts/frame_smear.py', 'contains': 'def bands(', 'how': 'x', 'test': 'true'}], **extra}


class WatchShape(unittest.TestCase):
    def test_a_watch_names_known_makers_in_one_line(self):
        self.assertEqual(check_failures.watch_problems('a', {'formats': ['short_video'], 'line': 'Do the thing.'}), [])
        self.assertTrue(check_failures.watch_problems('a', {'formats': ['reels'], 'line': 'x'}))
        self.assertTrue(check_failures.watch_problems('a', {'formats': [], 'line': 'x'}))
        self.assertTrue(check_failures.watch_problems('a', {'formats': ['short_video'], 'line': ''}))
        self.assertTrue(check_failures.watch_problems('a', {'formats': ['short_video'], 'line': 'x' * 400}))
        self.assertTrue(check_failures.watch_problems('a', 'short_video'))

    def test_the_register_holds_every_watch_in_shape(self):
        self.assertEqual(check_failures.check_loop_fields(REGISTER), [])

    def test_a_guard_test_with_a_placeholder_is_refused(self):
        bad = {'failures': [entry('placeholder', guards=[{'file': 'x', 'contains': 'x', 'how': 'x',
                                                          'test': 'python3 scripts/ve.py lint <spec>'}])]}
        self.assertTrue(any('placeholder' in p for p in check_failures.check_loop_fields(bad)))

    def test_a_guard_test_that_needs_pytest_is_refused(self):
        # CI installs requirements-ci.txt only, which has no pytest (Full verify, issue #758).
        bad = {'failures': [entry('pytest', guards=[{'file': 'x', 'contains': 'x', 'how': 'x',
                                                     'test': 'python3 -m pytest -q tests/copy_lint_test.py'}])]}
        self.assertTrue(any('needs pytest' in p for p in check_failures.check_loop_fields(bad)))
        ok = {'failures': [entry('script', guards=[{'file': 'x', 'contains': 'x', 'how': 'x',
                                                    'test': 'python3 tests/copy_lint_test.py -k Tag'}])]}
        self.assertFalse(any('needs pytest' in p for p in check_failures.check_loop_fields(ok)))


class WatchList(unittest.TestCase):
    def test_only_the_makers_asked_open_first_with_what_stops_each(self):
        register = {'failures': [
            entry('guarded-short', watch={'formats': ['short_video'], 'line': 'Short only.'}),
            entry('cover-only', watch={'formats': ['cover'], 'line': 'Cover only.'}),
            {**entry('open-short'), 'status': 'open', 'guards': [],
             'watch': {'formats': ['short_video'], 'line': 'Open one.'}},
            entry('everyone', watch={'formats': ['all'], 'line': 'Every maker.'}),
            entry('no-watch'),
        ]}
        text = '\n'.join(check_failures.watch_outs(register, ['short_video']))
        self.assertIn('3 (1 open', text)
        self.assertNotIn('Cover only.', text)
        self.assertLess(text.index('Open one.'), text.index('Short only.'))
        self.assertIn('Every maker.', text)
        self.assertIn('OPEN: nothing stops it', text)
        self.assertIn('stopped by scripts/frame_smear.py', text)
        self.assertIn('a test proves it', text)

    def test_the_command_lists_them_and_refuses_an_unknown_maker(self):
        ok = subprocess.run([sys.executable, 'scripts/check_failures.py', '--watch', 'short_video,long_video'],
                            cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(ok.returncode, 0, ok.stdout[-2000:] + ok.stderr[-2000:])
        self.assertIn('technical watch-outs for long_video, short_video', ok.stdout)
        self.assertIn('F53-plate-smeared-into-stripes', ok.stdout)
        bad = subprocess.run([sys.executable, 'scripts/check_failures.py', '--watch', 'reels'],
                             cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(bad.returncode, 2)


class TheSixToEightNovemberFailures(unittest.TestCase):
    def test_each_is_registered_with_a_watch_out(self):
        by = {f['id']: f for f in REGISTER['failures']}
        for fid, status in (('F53-plate-smeared-into-stripes', 'guarded'), ('F54-known-fault-rendered-with-caveat', 'guarded'),
                            ('F55-cues-timed-to-transcript', 'guarded'), ('F56-text-cut-at-the-device-edge', 'open')):
            with self.subTest(fid=fid):
                self.assertEqual(by[fid]['status'], status)
                self.assertTrue(by[fid]['watch']['line'])
        self.assertTrue(all(g.get('test') == 'python3 tests/frame_smear_test.py'
                            for g in by['F53-plate-smeared-into-stripes']['guards']))

    def test_the_runbook_sends_every_ve_session_to_the_watch_outs(self):
        runbook = (ROOT / 'docs/ve/RUNBOOK.md').read_text(encoding='utf-8')
        self.assertIn('python3 scripts/check_failures.py --watch short_video,long_video', runbook)


if __name__ == '__main__':
    unittest.main()
