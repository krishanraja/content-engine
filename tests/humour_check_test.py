"""scripts/post-pack/humour_check.py: humour-engine on call for scripts, joke options and the ideas board's funny
lines. A flat script and a joke that needs explaining are flagged against the floor, unavailable is never a pass, and
the real package runs end to end through Control Center's caller route. Every line here is invented."""
import json
import os
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import humour_check as hc  # noqa: E402


def analysis(reading='supported', attempt='supported_inference', deps=0, missing=(), where='p2'):
    return {
        'comic_reading': reading,
        'humour_attempt': {'status': attempt} if attempt else None,
        'interpretations': [{'id': 'i1', 'is_main': True, 'supported_reading': 'comic' if reading == 'supported' else None,
                             'labels_by_axis': {'mechanism': ['exaggeration']}, 'evidence_refs': ['e1']}],
        'evidence': [{'evidence_id': 'e1', 'segment_id': where}],
        'context_dependencies': [{'source_kind': 'cultural', 'required': True}] * deps,
        'missing_context': list(missing),
    }


SCRIPT = ['The chip rules changed on Tuesday.', 'Which means your laptop now needs a passport.', 'Here is what to watch.']


class Script(unittest.TestCase):
    def test_a_script_with_wit_passes_and_says_where_it_is(self):
        r = hc.read_script(SCRIPT, lambda req: analysis())
        self.assertEqual(r['status'], 'pass', r)
        self.assertEqual(r['wit_in_paragraphs'], [2])

    def test_a_flat_script_is_flagged_against_the_floor(self):
        r = hc.read_script(SCRIPT, lambda req: analysis(reading='not_supported', attempt=None))
        self.assertEqual(r['status'], 'flagged')
        self.assertIn('never flat', r['findings'][0])

    def test_wit_that_needs_explaining_is_flagged(self):
        r = hc.read_script(SCRIPT, lambda req: analysis(deps=2))
        self.assertIn('outside explanation', r['findings'][0])

    def test_unavailable_is_never_a_pass(self):
        self.assertEqual(hc.read_script(SCRIPT, None)['status'], 'unavailable')
        self.assertEqual(hc.read_script(SCRIPT, lambda req: (_ for _ in ()).throw(TimeoutError()))['status'], 'unavailable')
        r = hc.read_script(SCRIPT, lambda req: {'comic_reading': None, 'task_results': [{'errors': [{'code': 'provider_unreachable'}]}]})
        self.assertEqual(r['status'], 'unavailable')
        self.assertIn('provider_unreachable', r['reason'])


class Audience(unittest.TestCase):
    """The humour engine's audience is the North Star reader (Krish approved the line on 2026-11-26), read from
    config/beat.json, never a copy in the script."""

    def test_the_audience_is_the_reader_row(self):
        beat = json.loads((ROOT / 'config' / 'beat.json').read_text(encoding='utf-8'))
        self.assertEqual(hc.AUDIENCE, beat['reader']['audience_short'])
        self.assertIn('creative, arts, music, entertainment, media and sports industries', hc.AUDIENCE)
        self.assertNotIn('follow AI news', hc.AUDIENCE)

    def test_a_script_is_about_the_readers_world_not_ai_news(self):
        beat = json.loads((ROOT / 'config' / 'beat.json').read_text(encoding='utf-8'))
        self.assertTrue(hc.SURFACES['script'].endswith(beat['reader']['about']))
        self.assertNotIn('AI news', hc.SURFACES['script'])

    def test_every_request_carries_it(self):
        body = hc.request(['A line.'], 'funny', 'ce:t')
        self.assertIn(hc.AUDIENCE, json.dumps(body))


class Lines(unittest.TestCase):
    def test_each_joke_is_read_alone(self):
        seen = []
        def read(req):
            seen.append(req)
            return analysis(where='p1')
        r = hc.read_line('My laptop needs a passport now.', 'joke', read, 'joke-1')
        self.assertEqual(r['status'], 'pass')
        self.assertEqual(len(seen[0]['segments']), 1)
        self.assertIn('read on its own', seen[0]['context']['provided_facts'][0])
        self.assertEqual(seen[0]['provider_policy']['allowed_provider_ids'], ['controlcenter'])

    def test_a_line_that_is_not_a_joke_or_does_not_land_is_flagged(self):
        self.assertIn('not a joke', hc.read_line('x', 'funny', lambda r: analysis(reading='not_supported', attempt=None), 'mon-1')['findings'][0])
        self.assertIn('does not land', hc.read_line('x', 'funny', lambda r: analysis(reading='ambiguous'), 'mon-1')['findings'][0])
        self.assertIn('outside', hc.read_line('x', 'joke', lambda r: analysis(missing=['who that is']), 'j')['findings'][0])

    def test_funny_lines_come_from_every_option_in_board_order(self):
        ideas = {'days': {'mon': [{'id': 'a', 'funny': 'The model asked for a raise.'}, {'id': 'b'}]},
                 'offdays': {'tue': [{'id': 'c', 'funny': 'Even the chatbot took Friday off.'}]}}
        self.assertEqual(hc.funny_lines(ideas), [('mon-1', 'The model asked for a raise.'), ('off-tue-c', 'Even the chatbot took Friday off.')])

    def test_overall_takes_the_worst(self):
        self.assertEqual(hc.overall([{'status': 'pass'}, {'status': 'unavailable'}, {'status': 'flagged'}]), 'unavailable')
        self.assertEqual(hc.overall([]), 'pass')


class Doctor(unittest.TestCase):
    def setUp(self):
        self.saved = os.environ.pop(hc.TOKEN_ENV, None)

    def tearDown(self):
        os.environ.pop(hc.TOKEN_ENV, None)
        if self.saved is not None:
            os.environ[hc.TOKEN_ENV] = self.saved

    def test_no_token_is_not_ready_and_makes_no_call(self):
        calls = []
        ok, rows = hc.doctor(lambda b: calls.append(b) or (400, {}), package=True)
        self.assertFalse(ok)
        self.assertEqual(calls, [])

    def test_an_empty_body_proves_the_route_without_a_model_call(self):
        os.environ[hc.TOKEN_ENV] = 'synthetic-token-0123456789'
        ok, rows = hc.doctor(lambda b: (400, {'ok': False, 'error': 'invalid_input'}), package=True)
        self.assertTrue(ok, rows)
        ok, rows = hc.doctor(lambda b: (503, {'ok': False, 'error': 'not_configured'}), package=True)
        self.assertFalse(ok)
        self.assertTrue(any('not_configured' in r for r in rows))
        self.assertNotIn('synthetic-token', '\n'.join(rows))

    def test_the_route_is_control_centres_caller_route(self):
        self.assertTrue(hc.url().endswith('/api/humour/content-engine'))


class Live(unittest.TestCase):
    def test_the_real_package_runs_through_the_caller_route(self):
        try:
            import humour_engine  # noqa: F401
        except ImportError:
            self.skipTest('humour-engine not installed (requirements-humour.txt)')
        seen = {}
        payload = {
            'comic_reading': 'supported',
            'humour_attempt': {'status': 'supported_inference', 'evidence': [{'segment_id': 'p2', 'quote': 'needs a passport'}]},
            'interpretations': [{
                'id': 'i1', 'is_main': True, 'literal_reading': 'export rules now apply to laptops',
                'supported_reading': 'a bureaucratic rule is exaggerated to absurdity',
                'expectations': ['rules about chips do not touch ordinary laptops'],
                'connecting_logic': 'treating a laptop like a traveller exaggerates the reach of the rule',
                'labels_by_axis': {'mechanism': ['exaggeration', 'personification'], 'rhetorical_mode': ['observational']},
                'target': {'target': 'institution'},
                'evidence': [{'segment_id': 'p2', 'quote': 'needs a passport'}],
            }],
            'missing_context': [],
        }

        def transport(url, body):
            seen['tool'] = body['tool']['name']
            return 200, {'ok': True, 'payload': payload, 'model': 'claude-sonnet-5', 'prompt': 'comprehension-v1:engine',
                         'usage': {'input_tokens': 1200, 'output_tokens': 300}, 'cost_usd': 0.006, 'cap': 200, 'used': 1}

        r = hc.read_script(SCRIPT, hc.reader(transport=transport))
        self.assertEqual(seen['tool'], 'submit_analysis')
        self.assertEqual(r['status'], 'pass', r)
        self.assertEqual(r['wit_in_paragraphs'], [2])
        json.dumps(r)


if __name__ == '__main__':
    unittest.main()
