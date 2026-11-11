"""scripts/post-pack/board_session.py: the requests it makes for each command, offline (the routes and the database
rules are tested in tests/control-plane/board-sessions.test.ts, tests/board-sessions-db.mjs and, followed end to end
from a copied prompt, tests/integration/board-sessions-e2e.ts)."""
import hashlib
import io
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import board_session as bs  # noqa: E402
sys.path.insert(0, str(ROOT / 'scripts'))
import board_store_backfill as backfill  # noqa: E402

PIECE = '8287846b-6618-4a19-9fb8-23ad4eca2718'


class Recorder:
    def __init__(self, answers):
        self.answers = list(answers)
        self.calls = []

    def __call__(self, method, path, body=None):
        self.calls.append((method, path, body))
        return self.answers.pop(0) if self.answers else (200, {'ok': True})


def run(argv, answers):
    rec = Recorder(answers)
    bs.call, put = rec, []
    bs.put_bytes = lambda upload, data: put.append((upload['url'], data)) or 200
    out = io.StringIO()
    with redirect_stdout(out):
        code = bs.main(argv)
    return code, out.getvalue(), rec.calls, put


class BoardSessionTest(unittest.TestCase):
    def test_start_chooses_a_session_id_and_reports_it(self):
        code, out, calls, _ = run([PIECE, 'start', 'Reading the lock', '--step', 'board', '--by', 'Claude Code'], [(201, {'ok': True, 'others': []})])
        self.assertEqual(code, 0)
        method, path, body = calls[0]
        self.assertEqual((method, path), ('POST', '/api/content-ideas/sessions'))
        self.assertEqual(body['piece_id'], PIECE)
        self.assertEqual(body['kind'], 'start')
        self.assertEqual(body['summary'], 'Reading the lock')
        self.assertRegex(body['session_id'], r'^board-[a-z]{4}$')
        self.assertIn(body['session_id'], out)

    def test_a_later_report_needs_the_session_and_says_who_else_is_on_it(self):
        with self.assertRaises(SystemExit):
            run([PIECE, 'progress', 'x'], [])
        code, out, calls, _ = run([PIECE, 'done', 'Filed', '--session', 'board-kxqp', '--step', 'board'],
                                  [(201, {'ok': True, 'others': [{'session_id': 'look-tzrw', 'state': 'working', 'step': 'look', 'doing': 'Frames'}],
                                          'fields': [{'name': 'status', 'ok': False, 'revision': 3, 'value': 'record'}]})])
        self.assertEqual(code, 0)
        self.assertEqual(calls[0][2]['session_id'], 'board-kxqp')
        self.assertIn('look-tzrw', out)
        self.assertIn('another session set it first (revision 3', out)

    def test_a_day_with_no_piece(self):
        code, _, calls, _ = run(['day:2026-11-16/tue', 'show'], [(200, {'ok': True, 'sessions': [], 'materials': []})])
        self.assertEqual(code, 0)
        self.assertEqual(calls[0][1], '/api/content-ideas/store?week=2026-11-16&day=tue')

    def test_add_a_screenshot_hashes_uploads_and_confirms(self):
        with tempfile.TemporaryDirectory() as d:
            f = Path(d) / 'screen-grab-1.png'
            f.write_bytes(b'\x89PNG fake bytes')
            sha = hashlib.sha256(f.read_bytes()).hexdigest()
            code, out, calls, put = run([PIECE, 'add', str(f), '--session', 'board-kxqp', '--role', 'inspiration'], [
                (200, {'ok': True, 'upload': {'method': 'PUT', 'url': 'https://store/up', 'headers': {'Content-Type': 'image/png'}}}),
                (201, {'ok': True, 'material': {'id': 'm1', 'kind': 'screenshot', 'title': 'screen-grab-1.png', 'version': 1}}),
            ])
        self.assertEqual(code, 0)
        self.assertEqual([c[1] for c in calls], ['/api/content-ideas/store?op=upload-url', '/api/content-ideas/store?op=confirm'])
        self.assertEqual(calls[1][2]['sha256'], sha)
        self.assertEqual(calls[1][2]['session_id'], 'board-kxqp')
        self.assertEqual(calls[1][2]['role'], 'inspiration')
        self.assertEqual(put[0][0], 'https://store/up')
        self.assertIn('Filed screenshot', out)

    def test_add_a_corpus_file_a_link_and_text(self):
        with tempfile.TemporaryDirectory() as d:
            f = Path(d) / 'corpus.md'
            f.write_text('# The corpus\n\nSources.', encoding='utf-8')
            _, _, calls, _ = run([PIECE, 'add', str(f)], [(201, {'ok': True, 'material': {}})])
        self.assertEqual(calls[0][1], '/api/content-ideas/store?op=text')
        self.assertEqual(calls[0][2]['kind'], 'corpus')
        self.assertEqual(calls[0][2]['title'], 'corpus.md')
        _, _, calls, _ = run([PIECE, 'add', 'https://example.org/a'], [(201, {'ok': True, 'material': {}})])
        self.assertEqual((calls[0][1], calls[0][2]['url']), ('/api/content-ideas/store?op=link', 'https://example.org/a'))
        _, _, calls, _ = run([PIECE, 'add', 'A note the session wrote.'], [(201, {'ok': True, 'material': {}})])
        self.assertEqual((calls[0][1], calls[0][2]['content']), ('/api/content-ideas/store?op=text', 'A note the session wrote.'))


    def test_backfill_files_a_plan_file_on_its_day(self):
        self.assertEqual(backfill.day_of('narrative-lock-fri.md'), 'fri')
        self.assertEqual(backfill.day_of('mon-research.md'), 'mon')
        self.assertEqual(backfill.day_of('wednesday-notes.md'), 'wed')
        self.assertIsNone(backfill.day_of('interview.md'))
        self.assertEqual(backfill.kind_of('wed-research.md'), 'research')
        self.assertEqual(backfill.kind_of('fri-storyboard.md'), 'storyboard')
        self.assertEqual(backfill.kind_of('narrative-lock-mon.md'), 'note')


if __name__ == '__main__':
    unittest.main()
