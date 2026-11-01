"""The Codex lane (Krish, 2026-11-01: "You just do it first time round when I ask you to produce a video seamlessly"):
a session with no Codex queues the card on the board, the home computer claims and builds it, the result lands on the
same item. Pure pieces only: no engine call, no Codex."""
import datetime as dt
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import codex_lane as lane  # noqa: E402

FIELDS = {'card_id': 've-p-6-logo-card', 'title': 'The logo card'}


def item(state, lane_name='in_progress', id='codex-x', **extra):
    ref = {'lane': 'codex', 'fields': 'docs/ve/cards/x.fields.json', 'ref': 'main', 'state': state,
           'queued_at': extra.pop('queued_at', '2026-11-01T10:00:00Z'), **extra}
    return {'id': id, 'lane': lane_name, 'close_ref': ref}


class Route(unittest.TestCase):
    def test_no_companion_means_queue_and_a_companion_means_local(self):
        with tempfile.TemporaryDirectory() as temp:
            home = Path(temp)
            self.assertEqual(lane.route(home), 'queue')
            path = home / '.claude/plugins/cache/openai-codex/codex/1.0.0/scripts'
            path.mkdir(parents=True)
            (path / 'codex-companion.mjs').write_text('', encoding='utf-8')
            self.assertEqual(lane.route(home), 'local')


class Queue(unittest.TestCase):
    def test_the_item_is_session_work_in_progress_never_on_krish(self):
        got = lane.queue_item('docs/ve/cards/w3-1-ports/ve-p-6-logo-card.fields.json', FIELDS, 'main', 'piece-1', 'claude_code', at='2026-11-01T10:00:00Z')
        self.assertEqual(got['id'], 'codex-ve-p-6-logo-card')
        self.assertEqual(got['lane'], 'in_progress')
        self.assertEqual(got['closes_on'], 'session')
        self.assertNotIn('only_you', got)
        self.assertEqual(got['close_ref']['state'], 'queued')
        self.assertEqual(got['close_ref']['piece'], 'piece-1')
        self.assertLessEqual(len(json.dumps(got['close_ref'])), 1024)
        self.assertRegex(got['id'], r'^[a-z0-9][a-z0-9_-]{1,79}$')

    def test_ids_are_board_ids_even_from_odd_card_names(self):
        self.assertRegex(lane.item_id('W3.1 Port/Logo Card' * 6), r'^[a-z0-9][a-z0-9_-]{1,79}$')

    def test_a_card_without_fields_is_refused(self):
        with tempfile.TemporaryDirectory() as temp:
            card = Path(temp) / 'card.md'
            card.write_text('---\n---', encoding='utf-8')
            with self.assertRaises(SystemExit):
                lane.fields_path_for(card)
            (Path(temp) / 'card.fields.json').write_text('{}', encoding='utf-8')
            self.assertEqual(lane.fields_path_for(card).name, 'card.fields.json')


class Claim(unittest.TestCase):
    at = dt.datetime(2026, 11, 1, 12, 0, tzinfo=dt.timezone.utc)

    def test_oldest_queued_first_and_closed_or_fresh_claims_are_left(self):
        board = {'items': [
            item('queued', id='codex-b', queued_at='2026-11-01T11:00:00Z'),
            item('queued', id='codex-a', queued_at='2026-11-01T09:00:00Z'),
            item('queued', lane_name='done', id='codex-old', queued_at='2026-10-01T09:00:00Z'),
            item('running', id='codex-fresh', queued_at='2026-11-01T08:00:00Z', claimed_at='2026-11-01T11:30:00Z'),
            {'id': 'p3-record', 'lane': 'in_progress', 'close_ref': {}},
        ]}
        self.assertEqual(lane.next_job(board, self.at)['id'], 'codex-a')

    def test_a_dead_claim_is_claimed_again(self):
        board = {'items': [item('running', id='codex-dead', claimed_at='2026-11-01T06:00:00Z')]}
        self.assertEqual(lane.next_job(board, self.at)['id'], 'codex-dead')

    def test_nothing_queued(self):
        self.assertIsNone(lane.next_job({'items': [item('built')]}, self.at))


class Report(unittest.TestCase):
    def test_built_and_failed_land_on_the_item(self):
        job = item('running', id='codex-x')
        ok = lane.report_item(job, {'ok': True, 'host': 'studio', 'card': 'x', 'worktree': '/w/x'}, at='2026-11-01T12:00:00Z')
        self.assertEqual(ok['close_ref']['state'], 'built')
        self.assertEqual(ok['close_ref']['branch'], 've-card/x')
        self.assertNotIn('lane', ok)  # the session closes it after its own check, never the runner
        bad = lane.report_item(job, {'ok': False, 'host': 'studio', 'problems': ['acceptance failed']})
        self.assertEqual(bad['close_ref']['state'], 'failed')
        self.assertIn('acceptance failed', bad['detail'])
        huge = lane.report_item(job, {'ok': False, 'host': 'h' * 500, 'problems': ['p' * 5000]})
        self.assertLessEqual(len(json.dumps(huge['close_ref'])), 1024)
        self.assertLessEqual(len(huge['detail']), 2000)


class Guards(unittest.TestCase):
    def test_a_board_field_never_reaches_git_as_an_option(self):
        lane.safe('docs/ve/cards/w3-1-ports/ve-p-6-logo-card.fields.json', 'main')
        for fields, ref in (('docs/ve/cards/x.fields.json', '--upload-pack=x'), ('docs/ve/cards/../../x.fields.json', 'main'),
                            ('/etc/passwd', 'main'), ('docs/ve/cards/x.fields.json', 'a..b')):
            with self.assertRaises(SystemExit):
                lane.safe(fields, ref)

    def test_a_running_build_is_not_taken_for_dead(self):
        self.assertGreater(lane.STALE_HOURS, lane.BUILD_HOURS)

    def test_the_lock_is_atomic(self):
        with tempfile.TemporaryDirectory() as temp:
            was = lane.LOCK
            lane.LOCK = Path(temp) / 'serve.lock'
            try:
                self.assertTrue(lane._take_lock())
                self.assertFalse(lane._take_lock())
            finally:
                lane.LOCK = was


class Booking(unittest.TestCase):
    def test_a_card_is_never_queued_or_built_without_a_control_center_booking(self):
        for bad in (None, '', 'not-a-uuid'):
            with self.assertRaises(SystemExit):
                lane.require_booking(bad)
        good = '12345678-1234-4234-9234-123456789abc'
        self.assertEqual(lane.require_booking(good), good)
        item = lane.queue_item('docs/ve/cards/x.fields.json', FIELDS, 'main', None, 'claude_code', spend_id=good)
        self.assertEqual(item['close_ref']['spend_id'], good)
        self.assertLessEqual(len(json.dumps(item['close_ref'])), 1024)

    def test_a_booked_dispatch_skips_the_local_credit_file(self):
        from unittest.mock import patch
        from velib import cards
        with tempfile.TemporaryDirectory() as temp:
            card = Path(temp) / 'c.md'
            card.write_text('---\ncard: c\ncwd: ' + temp + '\n---\n## Acceptance\npnpm test\n## Return\n', encoding='utf-8')
            self.assertEqual(cards.parse_card(card)['acceptance'], ['pnpm test'])
            with patch.object(cards, '_admit'), patch.object(cards, '_reserve') as reserve, \
                    patch.object(cards, 'companion', return_value='c.mjs'), patch.object(cards, 'codex_env', return_value={}), \
                    patch.object(cards.subprocess, 'run') as run:
                cards.dispatch(card, booked='12345678-1234-4234-9234-123456789abc')
                reserve.assert_not_called()
                run.assert_called_once()
                cards.dispatch(card)
                reserve.assert_called_once()


class SessionLogs(unittest.TestCase):
    def test_a_card_run_under_another_codex_home_is_still_found(self):
        import os
        from unittest.mock import patch
        from velib import cards
        with tempfile.TemporaryDirectory() as temp:
            home = Path(temp) / 'studio-codex-home'
            log = home / 'sessions' / '2026' / '11' / '01' / 'run.jsonl'
            log.parent.mkdir(parents=True)
            log.write_text('\n'.join(json.dumps(e) for e in [
                {'type': 'session_meta', 'timestamp': '2026-11-01T10:00:00Z', 'payload': {'cwd': '/wt/demo'}},
                {'type': 'response_item', 'timestamp': '2026-11-01T10:03:00Z', 'payload': {'type': 'function_call'}}]),
                encoding='utf-8')
            with patch.dict(os.environ, {'CODEX_HOME': str(home)}):
                self.assertIn(home, cards.codex_homes())
                usage = cards.card_usage('demo', '/wt/demo')
            self.assertEqual((usage['minutes'], usage['calls']), (3.0, 1))


class VentureQueue(unittest.TestCase):
    def test_cards_wait_on_main_or_a_claude_branch_until_their_codex_branch_exists(self):
        branches = ['main', 'claude/a', 'codex/done-card', 'feature/x']
        files_on = {'main': ['codex/queue/new-card.md', 'codex/queue/done-card.md', 'codex/queue/README.md'],
                    'claude/a': ['codex/queue/new-card.md', 'codex/queue/second.md', 'codex/queue/../evil.md']}
        got = lane.queued_in(branches, files_on)
        self.assertEqual([(c['branch'], c['card']) for c in got], [('main', 'new-card'), ('claude/a', 'second')])

    def test_the_card_gets_this_machines_worktree_and_its_own_id(self):
        text = '---\ncard: other\ncwd: C:/somewhere\nmax_minutes: 20\n---\n## Goal\nx\n'
        out = lane._set_front(lane._set_front(text, 'cwd', '/home/k/wt'), 'card', 'mine')
        self.assertIn('cwd: /home/k/wt', out)
        self.assertIn('card: mine', out)
        self.assertNotIn('C:/somewhere', out)
        self.assertIn('max_minutes: 20', out)
        self.assertTrue(out.endswith('## Goal\nx\n'))

    def test_a_venture_result_names_its_branch(self):
        job = {'id': 'codex-heartside-x', 'close_ref': {'lane': 'codex', 'venture': 'heartside', 'state': 'running'}}
        got = lane.report_item(job, {'ok': True, 'host': 'Lorimer', 'card': 'x', 'branch': 'codex/x', 'sha': 'a' * 40})
        self.assertEqual(got['close_ref']['branch'], 'codex/x')
        self.assertEqual(got['close_ref']['sha'], 'a' * 12)

    def test_the_board_queue_never_picks_a_venture_mirror(self):
        board = {'items': [item('queued', id='codex-heartside-x', venture='heartside')]}
        self.assertIsNone(lane.next_job(board))

    def test_the_ventures_are_configured(self):
        names = lane.ventures()
        self.assertEqual(set(names), {'heartside', 'full-time'})
        for v in names.values():
            self.assertRegex(v['repo'], r'^krishanraja/')
            self.assertTrue(v['engine'].startswith('growth-'))


class WhatCodexDid(unittest.TestCase):
    def test_codex_doing_nothing_is_said_first_in_its_own_words(self):
        import subprocess
        quiet = subprocess.CompletedProcess([], 0, 'task finished', '')
        self.assertIn('Codex made no changes', lane.dispatch_problems(quiet, [])[0])
        self.assertIn('task finished', lane.dispatch_problems(quiet, [])[0])
        broke = subprocess.CompletedProcess([], 2, '', 'not logged in')
        self.assertIn('Codex exited 2', lane.dispatch_problems(broke, ['a.ts'])[0])
        self.assertIn('not logged in', lane.dispatch_problems(broke, ['a.ts'])[0])
        self.assertEqual(lane.dispatch_problems(quiet, ['a.ts']), [])

    def test_changed_files_sees_commits_and_uncommitted_work(self):
        import subprocess
        with tempfile.TemporaryDirectory() as temp:
            wt = Path(temp)
            git = ['git', '-C', temp, '-c', 'user.name=t', '-c', 'user.email=t@t']
            subprocess.run(['git', 'init', '-q', temp], check=True)
            (wt / 'a.txt').write_text('a', encoding='utf-8')
            subprocess.run(git + ['add', '-A'], check=True); subprocess.run(git + ['commit', '-q', '-m', 'base'], check=True)
            base = subprocess.run(['git', '-C', temp, 'rev-parse', 'HEAD'], capture_output=True, text=True).stdout.strip()
            self.assertEqual(lane.changed_files(wt, base), [])
            (wt / 'b.txt').write_text('b', encoding='utf-8')
            subprocess.run(git + ['add', '-A'], check=True); subprocess.run(git + ['commit', '-q', '-m', 'codex'], check=True)
            (wt / 'c.txt').write_text('c', encoding='utf-8')
            self.assertEqual(lane.changed_files(wt, base), ['b.txt', 'c.txt'])


class Routes(unittest.TestCase):
    def test_an_explicit_wsl_route_wins_over_a_companion_here(self):
        from unittest.mock import patch
        ref = {'fields': 'docs/ve/cards/x.fields.json', 'ref': 'main'}
        with patch.object(lane, 'has_companion', return_value=True), \
                patch.object(lane, '_wsl_route', return_value=('Ubuntu', '/home/k/dev/content-engine')), \
                patch.object(lane, '_in_wsl', return_value={'ok': True, 'host': 'Ubuntu'}) as wsl, \
                patch.object(lane, 'build') as local:
            self.assertEqual(lane._run(ref)['host'], 'Ubuntu')
            wsl.assert_called_once(); local.assert_not_called()
        with patch.object(lane, 'has_companion', return_value=True), patch.object(lane, '_wsl_route', return_value=None), \
                patch.object(lane, 'build', return_value={'ok': True, 'host': 'here'}) as local:
            self.assertEqual(lane._run(ref)['host'], 'here')


class Wsl(unittest.TestCase):
    def test_the_build_runs_in_the_named_distro_and_clone_with_no_key_on_the_line(self):
        cmd = lane.wsl_command('docs/ve/cards/x.fields.json', 'main', None, 'Ubuntu', '~/dev/content-engine')
        self.assertEqual(cmd[:5], ['wsl.exe', '-d', 'Ubuntu', '--cd', '~/dev/content-engine'])
        self.assertIn('scripts/ve.py lane build docs/ve/cards/x.fields.json --ref main --json', cmd[-1])
        self.assertNotIn('TOKEN', ' '.join(cmd))

    def test_last_json_reads_the_result_line(self):
        self.assertEqual(lane.last_json('noise\n{"ok": true}\n'), {'ok': True})
        self.assertIsNone(lane.last_json('no result'))


if __name__ == '__main__':
    unittest.main()
