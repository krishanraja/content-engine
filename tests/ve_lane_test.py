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
