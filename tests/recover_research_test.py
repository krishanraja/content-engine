"""scripts/recover_research.py: what it counts as research, where it files it, what it reads out of Claude Code and Codex
transcripts, and the store requests `file` makes, all offline against a made-up home folder."""
import csv
import hashlib
import io
import json
import os
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import recover_research as rr  # noqa: E402
import board_session  # noqa: E402

PIECE = '8287846b-6618-4a19-9fb8-23ad4eca2718'
DOSSIER = ('# Research: who pays for AI music on Make Your Mind Up\n\n'
           + ''.join(f'- Finding {i}: https://example.org/source-{i}\n' for i in range(8)) + 'x' * 900 + '\n')


class Judge(unittest.TestCase):
    def test_research_by_name_and_ours(self):
        self.assertEqual(rr.judge('wed-research.md', DOSSIER, False), (True, 'research by name'))

    def test_cites_pages_without_the_name(self):
        ok, why = rr.judge('draft.md', DOSSIER, True)
        self.assertTrue(ok)
        self.assertIn('cites 8 web pages', why)

    def test_too_short_other_venture_secret_and_build_files(self):
        self.assertFalse(rr.judge('research.md', 'short', True)[0])
        self.assertIn('another venture', rr.judge('research.md', 'Heartside notes ' + 'y' * 900, False)[1])
        self.assertIn('key or a password', rr.judge('research.md', DOSSIER + 'api_key = "abcdefghijklmnopqrstuvwxyz123456"\n', True)[1])
        self.assertFalse(rr.judge('node_modules/x/research.md', DOSSIER, True)[0])

    def test_a_script_draft_is_not_research(self):
        self.assertFalse(rr.judge('wed-long-script.md', 'Make Your Mind Up\n' + 'words ' * 300, True)[0])


class Place(unittest.TestCase):
    def test_piece_from_the_session_or_the_text(self):
        self.assertEqual(rr.place('a.md', DOSSIER, '2026-10-20T10:00:00', PIECE), PIECE)
        self.assertEqual(rr.place('a.md', f'piece_id: {PIECE}\n' + DOSSIER, '2026-10-20T10:00:00', None), PIECE)

    def test_date_and_day_from_the_path(self):
        self.assertEqual(rr.place('docs/plans/2026-10-23-friday/research.md', DOSSIER, '2026-11-11T00:00:00', None),
                         'day:2026-10-19/fri')
        self.assertEqual(rr.place('docs/plans/2026-11-09-week/wed-research.md', DOSSIER, '2026-11-11T00:00:00', None),
                         'day:2026-11-09/wed')
        self.assertEqual(rr.place('docs/plans/2026-11-09-week/sources.md', DOSSIER, '2026-11-11T00:00:00', None),
                         'day:2026-11-09/week')

    def test_otherwise_the_day_it_was_written(self):
        self.assertEqual(rr.place('notes.md', DOSSIER, '2026-11-11T09:00:00', None), 'day:2026-11-09/wed')


def claude_line(**ev):
    return json.dumps(ev) + '\n'


class Transcripts(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.home = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def write_claude(self):
        d = self.home / '.claude' / 'projects' / 'C--Users-k-dev-makeyourmindup-content-engine'
        d.mkdir(parents=True)
        f = d / 's1.jsonl'
        f.write_text(
            claude_line(type='user', timestamp='2026-10-20T08:00:00Z', cwd='/x/content-engine',
                        message={'role': 'user', 'content': f'piece_id: {PIECE}\nmake it'})
            + claude_line(type='assistant', timestamp='2026-10-20T08:05:00Z', message={'role': 'assistant', 'content': [
                {'type': 'tool_use', 'id': 't1', 'name': 'Write', 'input': {'file_path': '/s/.scratch/mon-research.md', 'content': DOSSIER}},
                {'type': 'tool_use', 'id': 't2', 'name': 'Bash', 'input': {'command': "cat > /s/notes.md <<'EOF'\n" + DOSSIER.strip() + "\nEOF\n"}},
                {'type': 'tool_use', 'id': 't3', 'name': 'Agent', 'input': {'prompt': 'research it'}}]})
            + claude_line(type='user', timestamp='2026-10-20T08:09:00Z', message={'role': 'user', 'content': [
                {'type': 'tool_result', 'tool_use_id': 't3', 'content': [{'type': 'text', 'text': DOSSIER * 3}]}]}),
            encoding='utf-8')
        return f

    def test_claude_writes_heredocs_and_subagent_reports(self):
        got = list(rr.claude_transcript(self.write_claude(), 0))
        self.assertEqual([g[1] for g in got], ['/s/.scratch/mon-research.md', '/s/notes.md', 'subagent-report-t3-research.md'])
        self.assertTrue(all(g[3] == PIECE and g[4] for g in got))
        self.assertEqual(got[0][2], DOSSIER)
        self.assertEqual(got[1][2], DOSSIER.strip() + '\n')

    def test_codex_added_files(self):
        d = self.home / '.codex' / 'sessions' / '2026' / '10' / '21'
        d.mkdir(parents=True)
        patch = '*** Begin Patch\n*** Add File: docs/plans/2026-10-21-wednesday/research.md\n' + ''.join(
            '+' + ln + '\n' for ln in DOSSIER.splitlines()) + '*** End Patch'
        f = d / 'rollout-1.jsonl'
        f.write_text(json.dumps({'timestamp': '2026-10-21T09:00:00Z', 'type': 'response_item',
                                 'payload': {'type': 'custom_tool_call', 'name': 'apply_patch', 'input': patch}}) + '\n',
                     encoding='utf-8')
        got = list(rr.codex_transcript(f, 0))
        self.assertEqual(len(got), 1)
        self.assertEqual(got[0][1], 'docs/plans/2026-10-21-wednesday/research.md')
        self.assertEqual(got[0][2], DOSSIER)
        self.assertTrue(got[0][4])

    def test_find_then_file(self):
        self.write_claude()
        scratch = self.home / '.scratch'
        scratch.mkdir()
        (scratch / 'deep-dive-ai-music.md').write_text(DOSSIER, encoding='utf-8')  # the same bytes as the Write: one line
        (scratch / 'other-research.md').write_text('Heartside research ' + 'z' * 900, encoding='utf-8')
        out = self.home / 'out'
        (self.home / 'tmp').mkdir()
        (self.home / 'dev').mkdir()
        args = ['--home', str(self.home), '--out', str(out), '--since', '2026-01-01', '--tmp', str(self.home / 'tmp'),
                '--checkouts', str(self.home / 'dev')]
        with redirect_stdout(io.StringIO()):
            self.assertEqual(rr.main(['find'] + args), 0)
        with open(out / 'found.tsv', encoding='utf-8') as fh:
            rows = list(csv.DictReader(fh, delimiter='\t'))
        yes = [r for r in rows if r['file'] == 'yes']
        self.assertEqual(sorted(r['sha256'] for r in yes),
                         sorted(hashlib.sha256(t.encode()).hexdigest() for t in (DOSSIER, DOSSIER * 3)))
        # The Write, the heredoc and the scratch copy are the same bytes: one line, on the piece its session named.
        line = next(r for r in yes if r['sha256'] == hashlib.sha256(DOSSIER.encode()).hexdigest())
        self.assertEqual(line['scope'], PIECE)
        self.assertIn('also found 2 more', line['why'])
        self.assertIn('another venture', next(r['why'] for r in rows if r['title'] == 'other-research.md'))

        calls = []

        def fake(method, path, body=None):
            calls.append((method, path, body))
            sha = hashlib.sha256(body['content'].encode()).hexdigest()
            return 201, {'ok': True, 'material': {'id': 'm1', 'sha256': sha}, 'library': {'state': 'copied', 'link': 'x'}}

        real, board_session.call = board_session.call, fake
        try:
            with redirect_stdout(io.StringIO()):
                self.assertEqual(rr.main(['file'] + args), 0)
                self.assertEqual(rr.main(['file'] + args), 0)  # a second run sends nothing again
        finally:
            board_session.call = real
        self.assertEqual(len(calls), 2)
        for method, path, body in calls:
            self.assertEqual((method, path), ('POST', '/api/content-ideas/store?op=text'))
            self.assertEqual((body['kind'], body['source'], body.get('piece_id')), ('research', 'backfill', PIECE))
            self.assertTrue(body['material_key'].startswith('local:'))
            self.assertIn('Recovered by scripts/recover_research.py', body['note'])


if __name__ == '__main__':
    unittest.main()
