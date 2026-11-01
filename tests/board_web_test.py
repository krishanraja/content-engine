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
    def test_replacement_reuses_only_exact_existing_asset_and_keeps_revision(self):
        page, meta, _ = week_board.board(week_board.monday_of('2026-10-12'))
        page, meta = board_web.web_page(page, meta)
        source = 'https://drive.usercontent.google.com/download?id=example&amp;export=download'
        page = week_board.engine_stamp.stamp(page.replace('</main>', f'<a href="{source}">Download</a></main>'), 'week_board')
        asset = dict(key='boards/2026-10-12/'+'a'*64, sha256='a'*64, bytes=123, type='video/mp4', name='kept.mp4')
        state = dict(revision=9, manifest=dict(assets={'drive-example':asset}))
        sent, uploads = [], []
        def api(method, path, body=None):
            if method == 'PUT':
                sent.append(body)
                return {'build_id':'new'}
            if sent: return dict(build_id='new',manifest=sent[-1]['manifest'])
            return state
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'board.html'; mapping = Path(directory)/'assets.json'
            path.write_text(page,encoding='utf-8');path.with_suffix('.json').write_text(json.dumps(meta))
            args = SimpleNamespace(page=str(path),assets=str(mapping),apply=True)
            mapping.write_text(json.dumps([dict(id='drive-example',source_url=source,existing_sha256='b'*64)]))
            with patch.object(board_web,'call',api), patch.object(board_web,'upload',lambda *a: uploads.append(a)), patch.object(board_web.media_standard,'enforced',return_value=True):
                with self.assertRaisesRegex(ValueError,'changed or is missing'): board_web.publish(args)
                self.assertEqual(uploads,[])
                mapping.write_text(json.dumps([dict(id='drive-example',source_url=source,existing_sha256='a'*64)]))
                with self.assertRaisesRegex(ValueError,'Independent board delivery review missing'):
                    board_web.publish(args)
                self.assertEqual(uploads,[])
                self.assertEqual(sent,[])
                # This test's API is a recording stub, not a qualifying server.
                # Real signature verification is exercised by board-runtime.ts.
                synthetic_review={'synthetic_fixture_only':True,'reviewer_run_id':'board-web-forwarding-test'}
                path.with_suffix('.delivery-review.json').write_text(json.dumps(synthetic_review),encoding='utf-8')
                board_web.publish(args)
            self.assertEqual(sent[0]['revision'],9)
            self.assertEqual(sent[0]['manifest']['assets']['drive-example'],asset)
            self.assertEqual(sent[0]['manifest']['delivery_review'],synthetic_review)
            self.assertEqual(len(uploads),1)  # Only new HTML; preserved media is not retransmitted.
            # Pending rollout preserves existing board operation without pretending
            # that an unsigned build has qualified under the candidate standard.
            sent.clear();uploads.clear();path.with_suffix('.delivery-review.json').unlink()
            with patch.object(board_web,'call',api), patch.object(board_web,'upload',lambda *a: uploads.append(a)), patch.object(board_web.media_standard,'enforced',return_value=False):
                board_web.publish(args)
            self.assertNotIn('delivery_review',sent[0]['manifest'])

    def test_a_ready_video_needs_a_passing_receipt_for_its_bytes(self):
        import html as html_mod
        def page_with(status):
            data = {'piece_id': 'p', 'status': status, 'note': 'n', 'sections': [{'id': 'video', 'title': 'Finished videos', 'files': [
                {'label': 'Download the 5-minute video (16:9)', 'url': 'https://board.local/mon-video-long', 'fills': 'video-long'},
                {'label': 'Download its thumbnail', 'url': 'https://board.local/mon-thumb-long', 'fills': 'thumb-long'}]}]}
            return f'<div class="dl-group mat" id="mon-materials" data-materials="{html_mod.escape(json.dumps(data), quote=True)}"></div>'
        with tempfile.TemporaryDirectory() as directory:
            cut = Path(directory)/'cut.mp4'; cut.write_bytes(b'cut bytes')
            asset = dict(id='mon-video-long', path=str(cut), type='video/mp4', source_url='https://board.local/mon-video-long')
            failing = lambda path: ['opening gate is not passed: first_frame']
            passing = lambda path: []
            problems = board_web.ready_video_problems(page_with('ready'), [asset], check=failing)
            self.assertEqual(len(problems), 1); self.assertIn('opening gate', problems[0])
            self.assertEqual(board_web.ready_video_problems(page_with('ready'), [asset], check=passing), [])
            self.assertEqual(board_web.ready_video_problems(page_with('review'), [asset], check=failing), [])
            self.assertIn('no asset mapping', board_web.ready_video_problems(page_with('ready'), [], check=passing)[0])
            existing = dict(id='mon-video-long', existing_sha256='0'*64, source_url='https://board.local/mon-video-long')
            self.assertIn('no local file', board_web.ready_video_problems(page_with('ready'), [existing], check=passing)[0])
            self.assertIn('not the bytes', board_web.ready_video_problems(page_with('ready'), [dict(existing, checked_file=str(cut))], check=passing)[0])
            words = dict(asset, krish='Krish, 2026-11-01: ship this one as it is')
            self.assertEqual(board_web.ready_video_problems(page_with('ready'), [words], check=failing), [])
            self.assertTrue(board_web.ready_video_problems(page_with('ready'), [dict(asset, krish='looks fine')], check=failing))

    def test_kept_friday_video_stays_a_deep_cut(self):
        monday=week_board.monday_of('2026-10-12');piece=week_board.deep_cut_piece(monday)
        self.assertTrue(piece)
        page, _, _ = week_board.board(monday,pieces={'fri':piece},
            kept={'fri':'<div class="pm" id="panel-friday"><div class="rec">Original content</div></div>'},
            videos={'fri':[dict(cut='long',seconds=817,url='https://drive.google.com/file/d/example/view')]})
        self.assertIn('deep cut, 8 minutes or more (wide, 16:9)',page)
        self.assertIn('13 min 37 s',page)
        self.assertIn('Original content',page)

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

class TeleprompterNamesTests(unittest.TestCase):
    """The Approve scripts card names the folder and scripts as teleprompter_send.py does, so the server's send and a
    session's send find the same folder (Krish, 2026-10-12: "One script per cut, in a folder per piece")."""
    def test_names_come_from_the_post_as_the_session_reads_them(self):
        import teleprompter_send as tps
        from datetime import date
        piece = 'f328382d-71b3-41a7-a221-d8615826f12e'  # docs/plans/2026-10-12-monday/post.json
        names = tps.names_from_post(json.loads((ROOT/'docs/plans/2026-10-12-monday/post.json').read_text(encoding='utf-8-sig')))
        folder, titles, subject = week_board.tp_names(piece, date(2026, 10, 19), 'follow.the.money', 'A different board subject', ['long', 'short'])
        self.assertEqual(folder, tps.folder_name(names))
        self.assertEqual(folder, 'Mon 12 Oct follow.the.money - Who gets paid for AI songs')
        self.assertEqual(titles, {c: tps.script_title(names, c, tps.load_config()) for c in ('long', 'short')})
        self.assertEqual(subject, 'Who gets paid for AI songs')

    def test_without_a_post_the_board_names_them_and_says_when_nothing_does(self):
        from datetime import date
        piece = '00000000-0000-4000-8000-000000000000'
        folder, titles, _ = week_board.tp_names(piece, date(2026, 11, 9), 'follow.the.money', 'Who pays for AI pictures. And why.', ['long'])
        self.assertEqual((folder, titles), ('Mon 9 Nov follow.the.money - Who pays for AI pictures. And why', {'long': 'Mon 9 Nov - 5-minute - Who pays for AI pictures. And why'}))
        self.assertEqual(week_board.tp_names(piece, date(2026, 11, 9), 'follow.the.money', '', ['long']), (None, {}, ''))

if __name__ == '__main__': unittest.main()
