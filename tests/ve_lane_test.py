"""The Codex lane (Krish, 2026-11-01: "You just do it first time round when I ask you to produce a video seamlessly"):
a session with no Codex queues the card on the board, the home computer claims and builds it, the result lands on the
same item. Pure pieces only: no engine call, no Codex."""
import datetime as dt
import io
import json
import sys
import tempfile
import unittest
import unittest.mock
from pathlib import Path
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
    def test_no_companion_means_queue_and_codex_on_this_machine_means_local(self):
        with tempfile.TemporaryDirectory() as temp:
            home = Path(temp)
            self.assertEqual(lane.route(home), 'queue')
            (home / 'bin').mkdir()
            (home / 'bin' / 'codex').write_text('', encoding='utf-8')
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


class NothingCounted(unittest.TestCase):
    # Ruling (Krish, 2026-11-17): "We have plenty of Codex credits, you need to permanently stop counting codex credits
    # everywhere". A card is queued with no booking and dispatched with nothing reserved, read or refused on credit.
    def test_a_queued_card_carries_no_booking(self):
        item = lane.queue_item('docs/ve/cards/x.fields.json', FIELDS, 'main', None, 'claude_code')
        self.assertNotIn('spend_id', item['close_ref'])
        self.assertNotIn('booking', item['close_ref'])
        self.assertFalse(hasattr(lane, 'require_booking'))
        self.assertNotIn('--spend-id', lane.wsl_command('docs/ve/cards/x.fields.json', 'main', None, 'Ubuntu', '/repo'))

    def test_dispatch_reserves_nothing(self):
        from unittest.mock import patch
        from velib import cards
        self.assertFalse(any(hasattr(cards, name) for name in ('_reserve', 'exhausted', 'allowance', 'ALLOWANCE_CEILING')))
        with tempfile.TemporaryDirectory() as temp:
            card = Path(temp) / 'c.md'
            card.write_text('---\ncard: c\ncwd: ' + temp + '\n---\n## Acceptance\npnpm test\n## Return\n', encoding='utf-8')
            with patch.object(cards, '_admit'), patch('velib.ledger.reserve') as reserve, \
                    patch.object(cards, 'launch', return_value=(['node', 'c.mjs'], {}, 'linux')), patch.object(cards, 'codex_env', return_value={}), \
                    patch.object(cards.subprocess, 'run') as run, patch.object(cards, 'fresh_modules', return_value=False):
                cards.dispatch(card)
                reserve.assert_not_called()
                run.assert_called_once()


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
        self.assertEqual(set(names), {'heartside', 'full-time', 'growth-makeyourmindup', 'growth-heartside'})
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
        # 15 Nov: node's "Cannot find module" line sat above the last six lines and was lost; it now goes first.
        node = '\n'.join(["node:internal/modules/cjs/loader:1228", "  throw err;", "", "Error: Cannot find module 'C:\\x.mjs'",
                          "    at a", "    at b", "    at node:internal/main/run_main_module:33:47 {", "  code: 'MODULE_NOT_FOUND',",
                          "  requireStack: []", "}", "", "Node.js v24.19.0"])
        said = lane.dispatch_problems(subprocess.CompletedProcess([], 1, '', node), [])[0]
        self.assertIn("Cannot find module 'C:\\x.mjs'", said)

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


class BuildPaths(unittest.TestCase):
    def test_build_hands_write_card_this_machines_own_path(self):
        # 2026-11-01: inside WSL the card's cwd came out as /home/k/dev/.worktrees\\content-engine\\ve-card\\x and
        # ensure_worktree refused it, so Codex never ran.
        import os, subprocess
        from unittest.mock import patch
        from velib.common import card_worktree, native_path
        seen = {}
        def write_card(out, **fields):
            seen['cwd'] = fields['cwd']
            return out
        done = subprocess.CompletedProcess([], 0, 'ok', '')
        shown = subprocess.CompletedProcess([], 0, json.dumps({'card_id': 've-x', 'path': 'p.md'}), '')
        def run(cmd, *a, **k):
            return shown if 'show' in cmd else subprocess.CompletedProcess(cmd, 0, '', '')
        with patch.dict(os.environ, {'MINDMAKE_LOCAL_WORKTREES': '/home/k/dev/.worktrees'}), \
                patch('velib.cards.write_card', side_effect=write_card), patch('velib.cards.dispatch', return_value=done), \
                patch('velib.cards.verify', return_value=[]), patch.object(lane, 'publish_branch', return_value=('a' * 40, None)), \
                patch.object(lane, 'changed_files', return_value=['f.ts']), patch.object(lane.subprocess, 'run', side_effect=run):
            result = lane.build('docs/ve/cards/x.fields.json')
            expected = str(native_path(card_worktree('ve-x')))
        self.assertTrue(result['ok'], result['problems'])
        if os.sep == '/':
            self.assertNotIn('\\', seen['cwd'])
        self.assertEqual(seen['cwd'], expected)


class NodeModulesLink(unittest.TestCase):
    def test_the_worktree_link_is_never_codex_work(self):
        # 2026-11-01: the fourth live card was marked "outside write_allow: node_modules" and the link was committed.
        import os, subprocess
        from velib import cards
        with tempfile.TemporaryDirectory() as temp, tempfile.TemporaryDirectory() as mods:
            wt = Path(temp)
            git = ['git', '-C', temp, '-c', 'user.name=t', '-c', 'user.email=t@t']
            subprocess.run(['git', 'init', '-q', temp], check=True)
            (wt / 'a.txt').write_text('a', encoding='utf-8')
            subprocess.run(git + ['add', '-A'], check=True); subprocess.run(git + ['commit', '-q', '-m', 'base'], check=True)
            base = subprocess.run(['git', '-C', temp, 'rev-parse', 'HEAD'], capture_output=True, text=True).stdout.strip()
            os.symlink(mods, wt / 'node_modules')
            (wt / 'out').mkdir(); (wt / 'out' / 'x.ts').write_text('x', encoding='utf-8')
            self.assertEqual(lane.changed_files(wt, base), ['out/x.ts'])
            card = wt.parent / (wt.name + '-card.md')
            card.write_text('---\ncard: c\nwrite_allow: [out/*]\n---\n## Acceptance\n## Return\n', encoding='utf-8')
            problems = [p for p in cards.verify(card, wt) if p.startswith('outside write_allow')]
            self.assertEqual(problems, [])
            subprocess.run(['git', '-C', temp, 'remote', 'add', 'origin', temp + '/.git'], check=True)
            lane.publish_branch(wt, 'codex/c', 'codex: c')
            files = subprocess.run(['git', '-C', temp, 'ls-tree', '-r', '--name-only', 'HEAD'], capture_output=True, text=True).stdout.split()
            self.assertNotIn('node_modules', files)
            self.assertIn('out/x.ts', files)

    def test_an_ignored_node_modules_does_not_stop_the_commit(self):
        # 15 Nov, on his PC: .gitignore ignores node_modules and the exclude pathspec made git add exit 1.
        import os, subprocess
        with tempfile.TemporaryDirectory() as temp, tempfile.TemporaryDirectory() as mods:
            wt = Path(temp)
            git = ['git', '-C', temp, '-c', 'user.name=t', '-c', 'user.email=t@t']
            subprocess.run(['git', 'init', '-q', temp], check=True)
            (wt / '.gitignore').write_text('node_modules\n', encoding='utf-8')
            subprocess.run(git + ['add', '-A'], check=True); subprocess.run(git + ['commit', '-q', '-m', 'base'], check=True)
            os.symlink(mods, wt / 'node_modules')
            (wt / 'out').mkdir(); (wt / 'out' / 'x.ts').write_text('x', encoding='utf-8')
            subprocess.run(['git', '-C', temp, 'remote', 'add', 'origin', temp + '/.git'], check=True)
            sha, why = lane.publish_branch(wt, 'codex/c', 'codex: c')
            self.assertIsNone(why)
            files = subprocess.run(['git', '-C', temp, 'ls-tree', '-r', '--name-only', 'HEAD'], capture_output=True, text=True).stdout.split()
            self.assertNotIn('node_modules', files)
            self.assertIn('out/x.ts', files)


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


class LaneGuards(unittest.TestCase):
    """F22 (Krish, 2026-11-02): a device card with unknown verbs is refused before Codex sees it, and a queued card is
    followed until it is built or failed."""

    PROPS = "verb: z.enum(['enter', 'move', 'exit']),"

    def test_unknown_device_verbs_are_named(self):
        fields = {'kind': 'device', 'goal': '1. `params`: x\n2. `enter`: y\n3. `bounce`: z\n4. `exit`: w'}
        self.assertEqual(lane.unknown_verbs(fields, self.PROPS), ['bounce'])

    def test_known_verbs_and_other_kinds_pass(self):
        self.assertEqual(lane.unknown_verbs({'kind': 'device', 'goal': '1. `enter`: a\n2. `exit`: b'}, self.PROPS), [])
        self.assertEqual(lane.unknown_verbs({'kind': 'piece_kit', 'goal': '1. `bounce`: a'}, self.PROPS), [])

    def test_the_real_schema_reads(self):
        self.assertIn('enter', lane.engine_verbs())

    def test_wait_reports_every_change_and_stops_at_built_or_failed(self):
        reads = iter([[{'id': 'codex-a', 'state': 'queued'}, {'id': 'codex-b', 'state': 'queued'}],
                      [{'id': 'codex-a', 'state': 'built'}, {'id': 'codex-b', 'state': 'running'}],
                      [{'id': 'codex-a', 'state': 'built'}, {'id': 'codex-b', 'state': 'failed'}]])
        lines = []
        got = lane.wait(['codex-a', 'b'], every=0, read=lambda: next(reads), sleep=lambda s: None, out=lines.append)
        self.assertEqual(got, {'codex-a': 'built', 'codex-b': 'failed'})
        self.assertEqual([l.split()[1] for l in lines], ['queued', 'queued', 'built', 'running', 'failed'])


class StaleWorktree(unittest.TestCase):
    """F22: a re-queued card's existing worktree takes in origin/main before Codex runs."""

    def test_existing_worktree_takes_in_main(self):
        import subprocess, tempfile
        from velib import cards
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            git = lambda *a, cwd: subprocess.run(['git', *a], cwd=cwd, check=True, capture_output=True)
            git('init', '-q', '--bare', '-b', 'main', str(tmp / 'origin.git'), cwd=tmp)
            git('clone', '-q', str(tmp / 'origin.git'), str(tmp / 'seed'), cwd=tmp)
            seed = tmp / 'seed'
            for k, v in (('user.name', 't'), ('user.email', 't@t')):
                git('config', k, v, cwd=seed)
            (seed / 'props.ts').write_text('old')
            git('add', '.', cwd=seed); git('commit', '-qm', 'one', cwd=seed); git('push', '-q', 'origin', 'HEAD:main', cwd=seed)
            git('clone', '-q', str(tmp / 'origin.git'), str(tmp / 'card'), cwd=tmp)
            (seed / 'props.ts').write_text('new')
            git('commit', '-qam', 'fix', cwd=seed); git('push', '-q', 'origin', 'HEAD:main', cwd=seed)
            cards.refresh_worktree(tmp / 'card')
            self.assertEqual((tmp / 'card' / 'props.ts').read_text(), 'new')

    def test_a_conflicting_attempt_starts_fresh_and_replaces_only_itself(self):
        """15 Nov 2026: kf-5 and kf-7 were re-queued after main changed the files their first attempts touched; the
        merge conflicted and the lane stopped on his PC with nobody there to remove the worktree."""
        import subprocess, tempfile
        from velib import cards, codex_lane
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            def git(*a, cwd):
                return subprocess.run(['git', *a], cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()
            git('init', '-q', '--bare', '-b', 'main', str(tmp / 'origin.git'), cwd=tmp)
            git('clone', '-q', str(tmp / 'origin.git'), str(tmp / 'seed'), cwd=tmp)
            seed, card = tmp / 'seed', tmp / 'card'
            for k, v in (('user.name', 't'), ('user.email', 't@t')):
                git('config', k, v, cwd=seed)
            (seed / 'registry.ts').write_text('a\n')
            git('add', '.', cwd=seed); git('commit', '-qm', 'one', cwd=seed); git('push', '-q', 'origin', 'HEAD:main', cwd=seed)
            git('clone', '-q', str(tmp / 'origin.git'), str(card), cwd=tmp)
            for k, v in (('user.name', 't'), ('user.email', 't@t')):
                git('config', k, v, cwd=card)
            git('checkout', '-q', '-b', 've-card/x', cwd=card)
            (card / 'registry.ts').write_text('a\nfirst attempt\n')
            git('commit', '-qam', 'attempt 1', cwd=card); git('push', '-q', 'origin', 've-card/x', cwd=card)
            first = git('rev-parse', 'HEAD', cwd=card)
            (seed / 'registry.ts').write_text('a\nanother device\n')
            git('commit', '-qam', 'main moved', cwd=seed); git('push', '-q', 'origin', 'HEAD:main', cwd=seed)
            cards.refresh_worktree(card)
            self.assertEqual((card / 'registry.ts').read_text(), 'a\nanother device\n')
            self.assertEqual(git('rev-parse', '--abbrev-ref', 'HEAD', cwd=card), 've-card/x')
            self.assertEqual(cards.fresh_lease_path(card).read_text().strip(), first)
            (card / 'registry.ts').write_text('a\nanother device\nsecond attempt\n')
            sha, why = codex_lane.publish_branch(card, 've-card/x', 'codex: x')
            self.assertIsNone(why)
            self.assertEqual(git('rev-parse', 've-card/x', cwd=tmp / 'origin.git'), sha)
            self.assertFalse(cards.fresh_lease_path(card).exists())

    def test_a_moved_branch_is_never_replaced(self):
        """The lease holds: if the branch moved on origin after the restart, the push is refused, not forced."""
        import subprocess, tempfile
        from velib import cards, codex_lane
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            def git(*a, cwd):
                return subprocess.run(['git', *a], cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()
            git('init', '-q', '--bare', '-b', 'main', str(tmp / 'origin.git'), cwd=tmp)
            git('clone', '-q', str(tmp / 'origin.git'), str(tmp / 'card'), cwd=tmp)
            card = tmp / 'card'
            for k, v in (('user.name', 't'), ('user.email', 't@t')):
                git('config', k, v, cwd=card)
            (card / 'f').write_text('1')
            git('add', '.', cwd=card); git('commit', '-qm', 'one', cwd=card); git('push', '-q', 'origin', 'HEAD:main', cwd=card)
            git('push', '-q', 'origin', 'HEAD:refs/heads/ve-card/y', cwd=card)
            git('checkout', '-q', '-b', 've-card/y', cwd=card)
            cards.fresh_lease_path(card).write_text('0' * 40 + '\n')
            (card / 'f').write_text('2')
            sha, why = codex_lane.publish_branch(card, 've-card/y', 'codex: y')
            self.assertIsNone(sha)
            self.assertIn('could not be pushed', why)

    def test_a_dirty_or_foreign_worktree_still_stops(self):
        import subprocess, tempfile
        from velib import cards
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            subprocess.run(['git', 'init', '-q', '-b', 'main', str(tmp)], check=True, capture_output=True)
            self.assertFalse(cards.restart_fresh(tmp))



class FreshModules(unittest.TestCase):
    """15 Nov 2026: a card built against a lane clone that had not installed since the lockfile changed."""

    def test_npm_ci_runs_once_per_lockfile(self):
        import tempfile, types
        from velib import cards
        calls = []
        def run(cmd, **kw):
            calls.append(cmd)
            return types.SimpleNamespace(returncode=0, stdout='', stderr='')
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.assertFalse(cards.fresh_modules(root, run=run), 'no lockfile, nothing to do')
            (root / 'package-lock.json').write_text('{"lockfileVersion": 3}')
            self.assertTrue(cards.fresh_modules(root, run=run))
            self.assertEqual(calls[-1][1:], ['ci', '--no-audit', '--no-fund'])
            self.assertFalse(cards.fresh_modules(root, run=run), 'the stamp matches, so no second install')
            self.assertEqual(len(calls), 1)
            (root / 'package-lock.json').write_text('{"lockfileVersion": 3, "packages": {"three": {}}}')
            self.assertTrue(cards.fresh_modules(root, run=run), 'a changed lockfile installs again')
            self.assertEqual(len(calls), 2)

    def test_a_failed_install_stops_the_dispatch(self):
        import tempfile, types
        from velib import cards
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'package-lock.json').write_text('{}')
            failed = lambda cmd, **kw: types.SimpleNamespace(returncode=1, stdout='', stderr='npm ERR! network')
            with self.assertRaises(SystemExit) as stop:
                cards.fresh_modules(root, run=failed)
            self.assertIn('npm ERR! network', str(stop.exception))
            self.assertFalse((root / 'node_modules' / cards.MODULES_STAMP).exists(), 'no stamp after a failed install')


if __name__ == '__main__':
    unittest.main()
