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


if __name__ == '__main__':
    unittest.main()
