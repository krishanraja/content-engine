import importlib.util
import json
from pathlib import Path
import sys
import unittest
import tempfile
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'scripts/post-pack'))
import board_import
import board_web
import week_board

class BoardWebTests(unittest.TestCase):
    def exports(self):
        expected = json.loads((ROOT/'config/boards.json').read_text())['weeks']
        exports = [dict(version=1, complete=True, week=w, source=s, collections={c: [] for c in board_import.COLLECTIONS}) for w, urls in expected.items() for s in urls]
        return expected, exports

    def test_completeness_and_missing_account(self):
        expected, exports = self.exports()
        self.assertEqual(board_import.reconcile(exports, expected)['conflicts'], [])
        with self.assertRaises(ValueError): board_import.reconcile(exports[:-1], expected)
        del exports[0]['collections']['edits']
        with self.assertRaises(ValueError): board_import.reconcile(exports, expected)

    def test_untick_latest_and_equal_timestamp_conflict(self):
        expected, exports = self.exports()
        for e, done, at in zip(exports[:2], [True,False], ['2026-10-19T12:00:00Z','2026-10-19T13:00:00+00:00']):
            e['collections']['ticks'] = [dict(id='mon-substack', body=dict(done=done,at=at))]
        plan = board_import.reconcile(exports, expected)
        self.assertEqual(len(plan['records']), 2)
        self.assertFalse(plan['winners'][0]['body']['done'])
        exports[1]['collections']['ticks'][0]['body']['at'] = '2026-10-19T12:00:00+00:00'
        self.assertEqual(len(board_import.reconcile(exports, expected)['conflicts']), 1)

    def test_comments_do_not_collapse_across_accounts(self):
        expected, exports = self.exports()
        for e in exports[:2]: e['collections']['comments'] = [dict(id='thread', body=dict(thread_id='thread',anchor='mon',text='Same words'))]
        plan = board_import.reconcile(exports, expected)
        self.assertEqual(len(plan['winners']), 2)
        self.assertNotEqual(plan['winners'][0]['id'], plan['winners'][1]['id'])

    def test_repeat_import_and_later_web_change(self):
        expected, exports = self.exports()
        exports[0]['collections']['ticks'] = [dict(id='mon-substack', body=dict(done=False,at='2026-10-19T12:00:00Z'))]
        plan = board_import.reconcile(exports, expected)
        archived, docs = {}, {}
        def api(method, path, body=None):
            if path.endswith('/imports'):
                if method == 'POST':
                    for row in body['records']: archived[row['source_sha256']] = row
                return {'records': list(archived.values())}
            if method == 'GET': return {'documents': list(docs.values())}
            doc_id = path.rsplit('/',1)[1]
            docs[doc_id] = {'id': doc_id, 'body': body['body'], 'revision': body['revision']+1}
            return docs[doc_id]
        with patch.object(board_import, 'call', api):
            self.assertEqual(board_import.import_plan(plan), 1)
            self.assertEqual(board_import.import_plan(plan), 0)
            self.assertEqual(len(archived), 1)
            docs['mon-substack']['body'] = dict(done=True,at='2026-10-19T13:00:00Z')
            self.assertEqual(board_import.import_plan(plan), 0)
            self.assertTrue(docs['mon-substack']['body']['done'])

    def test_source_comment_selectors_missing_anchors_and_reply_ids(self):
        expected, exports = self.exports()
        comments = [dict(id='root',body=dict(thread_id='root',anchor='#mon-review',text='Root')),
                    dict(id='root#reply-1',body=dict(thread_id='root',anchor=None,text='Reply',at='2026-10-16T13:05'))]
        exports[0]['collections']['comments'] = comments
        plan = board_import.reconcile(exports, expected)
        root, reply = plan['winners']
        self.assertEqual(root['body']['anchor'],'mon-review')
        self.assertEqual(reply['body']['anchor'],'mon-review')
        self.assertEqual(reply['body']['thread_id'],root['id'])
        self.assertNotIn('#',reply['id'])
        self.assertEqual(plan['records'][1]['id'],'root#reply-1')
        self.assertIsNone(plan['records'][1]['body']['anchor'])
        self.assertEqual(reply['body']['original_metadata']['source_comment_id'],'root#reply-1')

    def test_web_adapter_preserves_layout_and_digest(self):
        page, meta, _ = week_board.board(week_board.monday_of('2026-10-19'))
        web, changed = board_web.web_page(page, meta)
        self.assertNotIn('window.claude', web)
        self.assertIn('window.boardRuntime', web)
        self.assertIn('5000', web)
        self.assertEqual(changed['sha256'], board_web.sha(web.encode()))
        self.assertEqual(week_board.verify(web), [])
        self.assertIn('week.js', str(week_board.TEMPLATES/'week.js'))

    def test_native_export_digest_and_content_preserved(self):
        page, _, _ = week_board.board(week_board.monday_of('2026-10-19'))
        source = json.loads((ROOT/'config/boards.json').read_text())['weeks']['2026-10-19'][0]
        with tempfile.TemporaryDirectory() as directory:
            original = Path(directory)/'original.html'
            output = Path(directory)/'converted.html'
            original.write_bytes(page.encode('utf-8'))
            args = SimpleNamespace(page=str(original),week='2026-10-19',source=source,expected_sha256='0'*64,output=str(output))
            with self.assertRaisesRegex(ValueError,'digest'): board_web.convert_export(args)
            self.assertFalse(output.exists())
            args.expected_sha256 = board_web.sha(original.read_bytes())
            board_web.convert_export(args)
            converted = output.read_text(encoding='utf-8')
            self.assertEqual(week_board.verify(converted), [])
            # Every body panel preceding the original runtime survives byte-for-byte.
            body_start = page.index('<main id="week">')
            panel_end = page.index('<script', body_start)
            self.assertIn(page[body_start:panel_end], converted)
            self.assertEqual(original.read_bytes(), page.encode('utf-8'))

    def test_missing_manifest_requires_evidence_and_is_not_fabricated(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'export.json'
            export = {'week':'2026-10-19','html_file':'board.html','manifest_file':None}
            path.write_text(json.dumps(export),encoding='utf-8')
            (path.parent/'board.html').write_text('<p>Original</p>',encoding='utf-8')
            with self.assertRaisesRegex(ValueError,'explicit source evidence'):
                board_import.export_files(path,export)
            export['export_evidence'] = {'manifest':{'accessible':False,'reason':'No separately published source manifest'}}
            files = board_import.export_files(path,export)
            self.assertEqual([kind for kind, _, _ in files],['export','html'])
            self.assertFalse((path.parent/'board-original.json').exists())

if __name__ == '__main__': unittest.main()
