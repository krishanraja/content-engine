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

    def test_add_research_says_where_its_library_copy_is(self):
        with tempfile.TemporaryDirectory() as d:
            f = Path(d) / 'research.md'
            f.write_text('# What Krish sent\n\nThe corpus.', encoding='utf-8')
            code, out, calls, _ = run([PIECE, 'add', str(f), '--kind', 'research'], [
                (201, {'ok': True, 'material': {'id': 'm2', 'kind': 'research', 'title': 'research.md', 'version': 1},
                       'library': {'state': 'copied', 'link': 'https://drive.google.com/file/d/x/view'}})])
        self.assertEqual(code, 0)
        self.assertEqual(calls[0][1], '/api/content-ideas/store?op=text')
        self.assertEqual(calls[0][2]['kind'], 'research')
        self.assertIn('In the research library: https://drive.google.com/file/d/x/view', out)
        self.assertEqual(bs.library_line({'state': 'later'}), 'The research library copy follows within the hour (the store holds it already).')
        self.assertEqual(bs.library_line({'state': 'not_research'}), '')

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


class TypedApprovalTest(unittest.TestCase):
    """approve lock|scripts: his typed approval carried to the board (Ruling, Krish, 2026-11-12: "Scripts and locks only.
    Typed approval counts for locking a story and approving a script; putting an idea on the publish board still needs
    your press, so that gate is unchanged.")."""
    SAID = ['--words', 'Yes, approved. Lock it.', '--said-at', '2026-11-13T09:10:00Z', '--where', 'Claude Code session', '--session-ref', 'https://claude.ai/code/s']

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.dir = Path(self.tmp.name) / 'docs' / 'plans' / '2026-11-16-week'
        self.dir.mkdir(parents=True)
        self.lock = self.dir / 'narrative-lock-mon.md'
        self.lock.write_text(f'# Lock\npiece_id: {PIECE}\n## Surface story\nOracle borrows.\n', encoding='utf-8')
        self.root = bs.ROOT
        bs.ROOT = Path(self.tmp.name)
        self.addCleanup(lambda: setattr(bs, 'ROOT', self.root))

    def test_a_lock_is_carried_as_his_words_bound_to_its_hash_and_signed_when_asked(self):
        import making
        code, out, calls, _ = run([PIECE, 'approve', 'lock', '--week', '2026-11-16', '--day', 'mon', '--lock', str(self.lock), '--sign', *self.SAID],
                                  [(200, {'documents': [{'id': 'mon-lock-words-8287846b', 'revision': 2}]}), (200, {'ok': True})])
        self.assertEqual(code, 0, out)
        method, path, body = calls[1]
        self.assertEqual((method, path, body['revision']), ('PUT', '/api/board/2026-11-16/picks/mon-lock-words-8287846b', 2))
        doc = body['body']
        self.assertEqual((doc['kind'], doc['via'], doc['approved'], doc['words'], doc['lock_path']),
                         ('sign_lock', 'words', True, 'Yes, approved. Lock it.', 'docs/plans/2026-11-16-week/narrative-lock-mon.md'))
        text = self.lock.read_text(encoding='utf-8')
        self.assertEqual(doc['lock_sha256'], making.lock_body_hash(text))
        self.assertEqual(making.lock_signature(text), ('Yes, approved. Lock it.', '2026-11-13', making.lock_body_hash(text)))
        self.assertIn('Approved in your words', out)

    def test_scripts_carry_each_cut_its_title_and_folder(self):
        long = Path(self.tmp.name) / 'long.md'
        long.write_text('Oracle just borrowed another twenty billion dollars.', encoding='utf-8')
        code, out, calls, _ = run([PIECE, 'approve', 'scripts', '--week', '2026-11-16', '--day', 'mon', '--long', str(long),
                                   '--long-title', 'Mon 16 Nov - 5-minute - Oracle', '--folder-title', 'Mon 16 Nov follow.the.money - Oracle', *self.SAID],
                                  [(200, {'documents': []}), (200, {'ok': True, 'send': {'status': 'held', 'error': 'not checked yet'}})])
        self.assertEqual(code, 0, out)
        doc = calls[1][2]['body']
        self.assertEqual((calls[1][1], doc['kind'], doc['texts'], doc['titles']),
                         ('/api/board/2026-11-16/picks/mon-scripts-words-8287846b', 'approve_scripts', {'long': 'Oracle just borrowed another twenty billion dollars.'},
                          {'long': 'Mon 16 Nov - 5-minute - Oracle'}))
        self.assertIn('Teleprompter: held', out)

    def test_his_words_must_name_an_approval_and_a_take_back_is_carried_in_his_words(self):
        """Ruling (Krish, 2026-11-17): a typed approval counts only when his words name it, and his typed words can take
        one back. Tue 17's voiceover was carried from "ready in teleprompter for me", which was not one."""
        long = Path(self.tmp.name) / 'long.md'
        long.write_text('You cannot sack an AI.', encoding='utf-8')
        base = [PIECE, 'approve', 'scripts', '--week', '2026-11-16', '--day', 'tue', '--long', str(long), '--long-title', 'T', '--folder-title', 'F']
        words = ['--words', 'merge all to main and then let me know when all done, ready in teleprompter for me', '--said-at', '2026-11-17T11:06:00Z',
                 '--where', 'Claude Code session', '--session-ref', 'https://claude.ai/code/s']
        code, out, calls, _ = run(base + words, [])
        self.assertEqual(code, 1)
        self.assertIn('do not name an approval of the scripts', out)
        self.assertEqual(calls, [])
        back = [PIECE, 'approve', 'scripts', '--take-back', '--week', '2026-11-16', '--day', 'tue', '--words',
                'I want the board in a state where I can see the script and edit it, and then press approve.', '--said-at', '2026-11-17T16:20:00Z',
                '--where', 'Claude Code session', '--session-ref', 'https://claude.ai/code/s']
        code, out, calls, _ = run(back, [(200, {'documents': []}), (200, {'ok': True})])
        self.assertEqual(code, 0, out)
        method, path, body = calls[1]
        self.assertEqual((method, path), ('PUT', '/api/board/2026-11-16/picks/tue-scripts-back-8287846b'))
        self.assertEqual({k: body['body'][k] for k in ('kind', 'what', 'day', 'via', 'approved', 'piece_id')},
                         {'kind': 'take_back', 'what': 'scripts', 'day': 'tue', 'via': 'words', 'approved': False, 'piece_id': PIECE})
        self.assertIn('taken back', out)
        # can fail: words that do not name taking it back are never carried as one.
        code, out, calls, _ = run(back[:9] + ['looks good'] + back[10:], [])
        self.assertEqual((code, calls), (1, []))
        self.assertIn('do not name taking his approval back', out)

    def test_the_teleprompter_gate_reads_the_same_rules(self):
        import teleprompter_send as tp
        said = {'said_at': '2026-11-17T11:06:00Z', 'said_where': 'x', 'session_ref': 'https://claude.ai/code/s', 'via': 'words'}
        doc = lambda i, **b: {'id': i, 'body': {'kind': 'approve_scripts', 'approved': True, 'piece_id': PIECE, **said, **b}}
        self.assertTrue(tp.typed_approval(doc('tue-scripts-words-8287846b', words='Approve both scripts')))
        self.assertFalse(tp.typed_approval(doc('tue-scripts-words-8287846b', words='ready in teleprompter for me')))
        back = {'id': 'tue-scripts-back-8287846b', 'body': {'kind': 'take_back', 'approved': False, 'piece_id': PIECE, 'words': 'take it back, I want to edit it', **said}}
        self.assertTrue(tp.typed_take_back(back))
        self.assertFalse(tp.typed_take_back({**back, 'body': {**back['body'], 'words': 'looks good'}}))
        self.assertFalse(tp.typed_take_back({**back, 'id': 'tue-scripts-words-8287846b'}))

    def scripts_argv(self):
        long = Path(self.tmp.name) / 'long.md'
        long.write_text('Oracle just borrowed another twenty billion dollars.', encoding='utf-8')
        return [PIECE, 'approve', 'scripts', '--week', '2026-11-16', '--day', 'wed', '--long', str(long),
                '--long-title', 'T', '--folder-title', 'F', *self.SAID]

    def test_a_second_approval_finds_its_document_on_a_later_page(self):
        # 17 Nov, piece db9f9f6a: the second approval read no revision and the board refused it as a conflict.
        page1 = {'next_offset': 10, 'documents': [{'id': f'other-{i}', 'revision': 1} for i in range(10)]}
        page2 = {'next_offset': None, 'documents': [{'id': 'wed-scripts-words-8287846b', 'revision': 4}]}
        code, out, calls, _ = run(self.scripts_argv(), [(200, page1), (200, page2), (200, {'ok': True})])
        self.assertEqual(code, 0, out)
        self.assertEqual([c[1] for c in calls], ['/api/board/2026-11-16/picks', '/api/board/2026-11-16/picks?offset=10',
                                                 '/api/board/2026-11-16/picks/wed-scripts-words-8287846b'])
        self.assertEqual(calls[2][2]['revision'], 4)

    def test_a_conflict_is_written_once_more_at_the_revision_on_file(self):
        conflict = (409, {'ok': False, 'error': 'revision_conflict', 'revision': 4})
        code, out, calls, _ = run(self.scripts_argv(), [(200, {'documents': [], 'next_offset': None}), conflict, (200, {'ok': True})])
        self.assertEqual(code, 0, out)
        self.assertEqual([(c[0], c[2] and c[2]['revision']) for c in calls[1:]], [('PUT', 0), ('PUT', 4)])
        # Never more than once: a second conflict is reported, not chased.
        code, out, calls, _ = run(self.scripts_argv(), [(200, {'documents': []}), conflict, conflict])
        self.assertEqual((code, len(calls)), (1, 3))
        self.assertIn('revision_conflict', out)

    def test_an_answer_encoded_twice_is_still_read(self):
        import json
        listing = json.dumps(json.dumps({'documents': [{'id': 'x', 'revision': 3}]}))
        self.assertEqual(bs.parsed(listing), {'documents': [{'id': 'x', 'revision': 3}]})
        self.assertEqual(bs.parsed(''), {})
        self.assertEqual(bs.parsed('not json')['ok'], False)

    def test_nothing_else_is_carried_and_never_without_his_words(self):
        for argv, why in (([PIECE, 'approve', 'idea', '--week', '2026-11-16', '--day', 'mon', *self.SAID], 'typed approval counts for nothing else'),
                          ([PIECE, 'approve', 'lock', '--week', '2026-11-16', '--day', 'mon', '--lock', str(self.lock),
                            '--words', '', '--said-at', '2026-11-13T09:10:00Z', '--where', 'x', '--session-ref', 'https://a'], '--words'),
                          ([PIECE, 'approve', 'lock', '--week', '2026-11-16', '--day', 'mon', '--lock', str(self.lock),
                            '--words', 'yes', '--said-at', 'today', '--where', 'x', '--session-ref', 'https://a'], '--said-at')):
            code, out, calls, _ = run(argv, [])
            self.assertEqual(code, 1, argv)
            self.assertIn(why, out)
            self.assertEqual(calls, [])
        # A lock already signed with other words is not carried as these.
        self.lock.write_text(self.lock.read_text(encoding='utf-8') + '\nSigned by Krish: "Something else.", 2026-11-12\n', encoding='utf-8')
        code, out, calls, _ = run([PIECE, 'approve', 'lock', '--week', '2026-11-16', '--day', 'mon', '--lock', str(self.lock), *self.SAID], [])
        self.assertEqual((code, calls), (1, []))
        self.assertIn('already signed with other words', out)


if __name__ == '__main__':
    unittest.main()
