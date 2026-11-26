"""scripts/post-pack/divergent.py: divergent-thinker on call for the ideas board. Not served is never a pass and never
a crash, the chain cap refuses the paid call, and the repeat guard's call carries `obvious` with no judge, so it makes
no model call. Every option and post here is invented."""
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import divergent as dv  # noqa: E402

SOURCES = {
    'week_start': '2026-11-30',
    'recent_posts': [
        {'week': '2026-11-16', 'date': '2026-11-17', 'stage': 'live', 'title': 'Robots now file their own expenses',
         'words': 'Robots now file their own expenses Three firms let agents claim costs. Finance teams are nervous.'},
        {'week': '2026-11-16', 'date': '2026-11-18', 'stage': 'approved', 'title': 'The chip queue is shorter'},
    ],
    'earlier_options': [{'week': '2026-11-16', 'day': 'mon', 'id': 'opt-1', 'main': True}],
}
IDEAS = {
    'week_start': '2026-11-30',
    'days': {'mon': [{'id': 'a', 'so_what': 'Your auditors now read agent logs.', 'story': 'Agents keep receipts.'},
                     {'id': 'b', 'so_what': 'A spark of ours.', 'story': 'Wild one.', 'divergent': {'run_id': 'r1', 'spark': 'S'}}]},
    'offdays': {'tue': [{'id': 'm1', 'title': 'Expense robots again', 'hook': 'They claim your lunch'}]},
}


def plans_dir():
    d = Path(tempfile.mkdtemp())
    (d / '2026-11-16-week').mkdir()
    (d / '2026-11-16-week' / 'ideas.json').write_text(json.dumps(
        {'days': {'mon': [{'id': 'opt-1', 'pitch': {'headline': 'Agents that buy their own software'}}]}}), encoding='utf-8')
    return d


class Poster:
    def __init__(self, status=200, body=None):
        self.status, self.body, self.calls = status, body if body is not None else {'ok': True}, []

    def __call__(self, body):
        self.calls.append(body)
        return self.status, self.body


UNDER = lambda: {'chain_usd': 4.2, 'chain_cap_usd': 15, 'chain_over': 0}  # noqa: E731
OVER = lambda: {'chain_usd': 16.1, 'chain_cap_usd': 15, 'chain_over': 1}  # noqa: E731


class NotServed(unittest.TestCase):
    def test_any_non_200_is_unavailable_and_exit_2(self):
        for status, body in ((404, {'ok': False, 'error': 'unknown_caller'}), (None, {'error': 'URLError'}), (500, {}), (403, {})):
            w = dv.wildcard('p', SOURCES, poster=Poster(status, body), cap=UNDER, plans=plans_dir())
            s = dv.score(IDEAS, SOURCES, poster=Poster(status, body), plans=plans_dir())
            r = dv.record(['x'], poster=Poster(status, body))
            for out in (w, s, r):
                self.assertEqual(out['status'], 'unavailable', out)
                self.assertEqual(dv.EXIT[out['status']], 2)

    def test_the_real_poster_never_raises_when_the_host_is_unreachable(self):
        old = os.environ.get('CONTROL_CENTER_URL')
        os.environ['CONTROL_CENTER_URL'] = 'http://127.0.0.1:9'
        try:
            status, body = dv.post({'op': 'record', 'items': ['x']}, token='t', timeout=2)
        finally:
            if old is None:
                os.environ.pop('CONTROL_CENTER_URL', None)
            else:
                os.environ['CONTROL_CENTER_URL'] = old
        self.assertIsNone(status)
        self.assertIn('error', body)

    def test_no_key_makes_no_call(self):
        old = os.environ.pop(dv.TOKEN_ENV, None)
        try:
            self.assertEqual(dv.wildcard('p', SOURCES, cap=UNDER)['status'], 'unavailable')
            self.assertEqual(dv.score(IDEAS, SOURCES)['status'], 'unavailable')
        finally:
            if old is not None:
                os.environ[dv.TOKEN_ENV] = old


class ChainCap(unittest.TestCase):
    def test_over_the_cap_refuses_the_paid_call(self):
        poster = Poster()
        out = dv.wildcard('p', SOURCES, poster=poster, cap=OVER, plans=plans_dir())
        self.assertEqual(out['status'], 'refused')
        self.assertIn('over its $15', out['reason'])
        self.assertEqual(poster.calls, [])
        self.assertEqual(dv.EXIT['refused'], 2)

    def test_unknown_spend_stops_nothing_and_says_so(self):
        runs, why = dv.chain_verdict(None)
        self.assertTrue(runs)
        self.assertIn('unknown stops nothing', why)

    def test_under_the_cap_provokes_with_the_worn_ground_and_the_kill_list(self):
        poster = Poster(200, {'ok': True, 'runId': 'r9', 'sparks': [{'rank': 1, 'title': 'T', 'mechanism': 'M', 'prompt': 'x'}]})
        out = dv.wildcard('A follow.the.money piece', SOURCES, poster=poster, cap=UNDER, plans=plans_dir(), day='mon')
        self.assertEqual(out['status'], 'ok')
        self.assertEqual(out['run_id'], 'r9')
        self.assertEqual(out['sparks'], [{'rank': 1, 'title': 'T', 'mechanism': 'M'}])
        body = poster.calls[0]
        self.assertEqual((body['op'], body['namespace'], body['target']), ('provoke', 'content-engine:ideas', 'writing'))
        self.assertIn('Robots now file their own expenses', body['cliches'])
        self.assertIn('Agents that buy their own software', body['cliches'])
        self.assertIn('leverage', body['bannedWords'])
        self.assertLessEqual(len(body['cliches']), 50)


class Score(unittest.TestCase):
    def test_the_guard_passes_obvious_and_no_judge_so_it_makes_no_model_call(self):
        body, rows = dv.score_body(IDEAS, SOURCES, plans_dir())
        self.assertEqual(body['op'], 'score')
        self.assertTrue(body['obvious'])
        self.assertNotIn('judge', body)
        self.assertEqual(len(body['ideas']), len(rows))
        self.assertEqual(body['namespace'], 'content-engine:ideas')
        # The problem names the reader's subject from config/beat.json reader.about, never the retired business leader.
        self.assertIn('creative, arts, music, entertainment, media and sports industries', body['problem'])
        self.assertNotIn('business leaders', body['problem'])

    def test_nothing_to_hold_against_makes_no_call(self):
        poster = Poster()
        out = dv.score(IDEAS, {'recent_posts': [], 'earlier_options': []}, poster=poster, plans=plans_dir())
        self.assertEqual(out['status'], 'unavailable')
        self.assertEqual(poster.calls, [])

    def test_archive_and_gravity_are_flagged_for_the_reviewer_and_own_spark_is_not(self):
        results = [{'status': 'accepted'}, {'status': 'rejected_archive'}, {'status': 'rejected_gravity'}]
        out = dv.score(IDEAS, SOURCES, poster=Poster(200, {'ok': True, 'results': results}), plans=plans_dir())
        self.assertEqual(out['status'], 'flagged')
        self.assertEqual([f['ref'] for f in out['findings']], ['off-tue-m1'])
        self.assertIn('never dropped', out['findings'][0]['why'])
        self.assertEqual(out['statuses']['mon-2'], 'own_spark')
        self.assertEqual(dv.EXIT[out['status']], 1)


class Record(unittest.TestCase):
    def test_only_live_posts_with_their_one_line_point(self):
        items = dv.live_items(SOURCES)
        self.assertEqual(items, ['Robots now file their own expenses. Three firms let agents claim costs.'])

    def test_record_sends_items_to_the_ideas_namespace(self):
        poster = Poster(200, {'ok': True, 'recorded': 1, 'skippedDuplicates': 0})
        out = dv.record(dv.live_items(SOURCES), label='live', poster=poster)
        self.assertEqual(out['status'], 'ok')
        self.assertEqual(poster.calls[0]['op'], 'record')
        self.assertEqual(poster.calls[0]['namespace'], 'content-engine:ideas')


class AtWill(unittest.TestCase):
    """The at-will ops any session may call: each op's body, its lane, the chain cap on the paid ones, exit codes."""

    def run_cli(self, argv, poster, cap=UNDER):
        import contextlib
        import io
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            code = dv.main(argv, poster=poster, cap=cap)
        return code, json.loads(buf.getvalue())

    def test_map_sends_only_problem_and_context(self):
        poster = Poster(200, {'ok': True, 'consensus': {'answers': ['the obvious take']}})
        code, out = self.run_cli(['map', '--problem', 'Why agents keep receipts', '--context', 'a Monday piece'], poster)
        self.assertEqual(code, 0)
        self.assertEqual(poster.calls[0], {'op': 'map', 'problem': 'Why agents keep receipts', 'context': 'a Monday piece'})
        self.assertEqual(out['result'], {'consensus': {'answers': ['the obvious take']}})

    def test_provoke_carries_count_target_temperament_cliches_lane_and_the_kill_list(self):
        poster = Poster(200, {'ok': True, 'runId': 'r1', 'sparks': [{'title': 'T'}]})
        code, out = self.run_cli(['provoke', '--problem', 'P', '--count', '12', '--temperament', 'wild', '--cliche', 'a',
                                  '--cliche', 'b', '--lane', 'shoots'], poster)
        body = poster.calls[0]
        self.assertEqual(code, 0)
        self.assertEqual((body['op'], body['namespace'], body['target'], body['temperament'], body['count']),
                         ('provoke', 'content-engine:shoots', 'writing', 'wild', 8))
        self.assertEqual(body['cliches'], ['a', 'b'])
        self.assertIn('leverage', body['bannedWords'])
        self.assertIn('never his', out['label'])

    def test_challenge_sends_the_idea_and_no_count(self):
        poster = Poster(200, {'ok': True, 'verdict': 'x'})
        code, _ = self.run_cli(['challenge', '--problem', 'P', '--idea', 'The angle'], poster)
        body = poster.calls[0]
        self.assertEqual(code, 0)
        self.assertEqual((body['op'], body['idea'], body['namespace']), ('challenge', 'The angle', 'content-engine:ideas'))
        self.assertNotIn('count', body)

    def test_diverge_and_the_default_lane(self):
        poster = Poster(200, {'ok': True, 'runId': 'r2', 'sparks': []})
        code, _ = self.run_cli(['diverge', '--problem', 'P', '--target', 'video'], poster)
        body = poster.calls[0]
        self.assertEqual(code, 0)
        self.assertEqual((body['op'], body['namespace'], body['target'], body['count']), ('diverge', 'content-engine:ideas', 'video', 3))

    def test_the_chain_cap_refuses_every_paid_op_before_any_call(self):
        for argv in (['map', '--problem', 'P'], ['provoke', '--problem', 'P'], ['diverge', '--problem', 'P'],
                     ['challenge', '--problem', 'P', '--idea', 'I']):
            poster = Poster()
            code, out = self.run_cli(argv, poster, cap=OVER)
            self.assertEqual((code, out['status']), (2, 'refused'), argv)
            self.assertIn('over its $15', out['reason'])
            self.assertEqual(poster.calls, [])

    def test_score_with_obvious_and_no_judge_is_free_and_runs_over_the_cap(self):
        d = Path(tempfile.mkdtemp())
        (d / 'ideas.json').write_text(json.dumps(['Robots claim lunch', 'A fresh title']), encoding='utf-8')
        (d / 'past.txt').write_text('Robots now file their own expenses\n\nThe chip queue is shorter\n', encoding='utf-8')
        poster = Poster(200, {'ok': True, 'results': [{'status': 'rejected_gravity'}, {'status': 'accepted'}]})
        code, out = self.run_cli(['score', '--problem', 'Titles', '--ideas-file', str(d / 'ideas.json'),
                                  '--obvious-file', str(d / 'past.txt'), '--lane', 'titles'], poster, cap=OVER)
        body = poster.calls[0]
        self.assertEqual((code, out['status'], out['flagged']), (1, 'flagged', [0]))
        self.assertEqual(body['obvious'], ['Robots now file their own expenses', 'The chip queue is shorter'])
        self.assertEqual(body['namespace'], 'content-engine:titles')
        self.assertNotIn('judge', body)
        self.assertNotIn('chain', out)

    def test_score_with_a_judge_or_no_obvious_is_paid_and_capped(self):
        d = Path(tempfile.mkdtemp())
        (d / 'ideas.txt').write_text('One\n', encoding='utf-8')
        for extra in (['--judge', '--obvious-file', str(d / 'ideas.txt')], []):
            poster = Poster()
            code, out = self.run_cli(['score', '--problem', 'P', '--ideas-file', str(d / 'ideas.txt')] + extra, poster, cap=OVER)
            self.assertEqual((code, out['status'], poster.calls), (2, 'refused', []), extra)

    def test_the_board_guard_still_takes_ideas_json_with_sources(self):
        d = plans_dir()
        (d / 'ideas.json').write_text(json.dumps(IDEAS), encoding='utf-8')
        (d / 'sources.json').write_text(json.dumps(SOURCES), encoding='utf-8')
        poster = Poster(200, {'ok': True, 'results': [{'status': 'accepted'}] * 3})
        code, out = self.run_cli(['score', str(d / 'ideas.json'), '--sources', str(d / 'sources.json')], poster)
        self.assertEqual((code, out['status'], out['namespace']), (0, 'pass', 'content-engine:ideas'))

    def test_record_from_a_file_into_a_lane(self):
        d = Path(tempfile.mkdtemp())
        (d / 'items.json').write_text(json.dumps([{'title': 'A published piece'}, 'Another']), encoding='utf-8')
        poster = Poster(200, {'ok': True, 'recorded': 2, 'skippedDuplicates': 0})
        code, out = self.run_cli(['record', '--items-file', str(d / 'items.json'), '--lane', 'titles'], poster)
        self.assertEqual((code, out['status'], out['namespace']), (0, 'ok', 'content-engine:titles'))
        self.assertEqual(poster.calls[0]['items'], ['A published piece', 'Another'])

    def test_not_served_is_exit_2_and_a_bad_lane_is_refused(self):
        code, out = self.run_cli(['provoke', '--problem', 'P'], Poster(404, {'ok': False, 'error': 'unknown_caller'}))
        self.assertEqual((code, out['status']), (2, 'unavailable'))
        with self.assertRaises(ValueError):
            dv.namespace_for('Bad Lane')
        import contextlib
        import io
        with self.assertRaises(SystemExit), contextlib.redirect_stderr(io.StringIO()):
            self.run_cli(['provoke', '--problem', 'P', '--lane', 'Bad:Lane'], Poster())

    def test_no_key_makes_no_call(self):
        old = os.environ.pop(dv.TOKEN_ENV, None)
        try:
            out = dv.at_will(dv.at_will_body('provoke', problem='P'), cap=UNDER)
            self.assertEqual(out['status'], 'unavailable')
        finally:
            if old is not None:
                os.environ[dv.TOKEN_ENV] = old


if __name__ == '__main__':
    unittest.main()
