"""The inspiration board drives the cut (scripts/velib/board.py, Wave 3). A spec names each card by its board id; ve refs
refuses a card that is unknown, dismissed or outside the production lane; ve init offers the top card per role; ve
verdict records each card's use with the Critic's score. When the engine cannot be reached it says NOT CHECKED or
NOT RECORDED and never passes silently. Krish, 2026-11-03: "I'm also still a bit disappointed with how poorly the
inspiration board is used right now." Every engine call here is a stand-in: nothing reaches the network."""
import io
import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import ve  # noqa: E402
from velib import board  # noqa: E402

LOOK = '0b9e7d24-5a61-4f3c-8e2d-1c4a6b8d0e21'
CAPS = '6f1c0a52-3b7e-4c1d-9a8e-0d2f4b6a8c10'
PIECE = '7083d6ad-419e-4fdc-9aba-f3be7f3f3a23'
JACK = {'id': LOOK, 'card': 'instagram_DeZuQ7-lATg', 'for': ['look', 'motion'], 'drive_id': '1RgI6ypWidvR_0KbP0LM0igbUEbU-qkWe',
        'takeaway': 'product-UI cards at 80 to 90 percent width with glow'}
GEORGIA = {'id': CAPS, 'card': 'instagram_DePHDr_jRed', 'for': ['captions'], 'drive_id': '1Fs7Mq2kiYyAMWgPkLApeMWcfSCBmGNH9',
           'takeaway': 'one word at a time, white, at chest height'}


def card(ref, **over):
    return dict({'id': ref['id'], 'label': ref['card'], 'drive_id': ref['drive_id'], 'lane': 'production', 'kind': 'video',
                 'problem': None}, **over)


class Engine:
    """A stand-in for the engine: answers by path and keeps every call."""

    def __init__(self, answers):
        self.answers, self.calls = answers, []

    def __call__(self, method, path, body=None):
        self.calls.append((method, path, body))
        for prefix, answer in self.answers.items():
            if path.startswith(prefix):
                if isinstance(answer, Exception):
                    raise answer
                return answer
        return 404, {'ok': False, 'error': 'not_found'}


class Check(unittest.TestCase):
    def test_live_production_cards_pass(self):
        engine = Engine({'/api/inspiration/cards': (200, {'ok': True, 'cards': [card(JACK), card(GEORGIA)], 'unknown': []})})
        problems, status = board.check([JACK, GEORGIA], call=engine)
        self.assertEqual((problems, status), ([], 'checked'))
        self.assertIn(f'ids={LOOK},{CAPS}', engine.calls[0][1])

    def test_unknown_dismissed_and_strategy_cards_are_refused(self):
        other = dict(GEORGIA, id='11111111-2222-4333-8444-555555555555', card='instagram_Other123')
        engine = Engine({'/api/inspiration/cards': (200, {'ok': True, 'unknown': [other['id']], 'cards': [
            card(JACK, problem='dismissed'), card(GEORGIA, lane='strategy', problem='not_production_lane')]})})
        problems, status = board.check([JACK, GEORGIA, other], call=engine)
        self.assertEqual(status, 'checked')
        self.assertTrue(any('Krish dismissed it' in p for p in problems), problems)
        self.assertTrue(any('not in the production lane' in p for p in problems), problems)
        self.assertTrue(any('not on the inspiration board' in p for p in problems), problems)

    def test_a_drive_id_or_label_that_is_not_the_cards_is_refused(self):
        engine = Engine({'/api/inspiration/cards': (200, {'ok': True, 'unknown': [], 'cards': [
            card(JACK, drive_id='9' * 33, label='instagram_Different1')]})})
        problems, _ = board.check([JACK], call=engine)
        self.assertEqual(len(problems), 2, problems)

    def test_an_unreachable_engine_is_not_checked_never_passed(self):
        engine = Engine({'/api/inspiration/cards': board.Unavailable('no engine key here')})
        problems, status = board.check([JACK], call=engine)
        self.assertEqual(problems, [])
        self.assertTrue(status.startswith('NOT CHECKED'), status)
        down = Engine({'/api/inspiration/cards': (503, {'ok': False, 'error': 'down'})})
        self.assertTrue(board.check([JACK], call=down)[1].startswith('NOT CHECKED'))

    def test_a_reference_without_an_id_is_a_problem_without_a_call(self):
        engine = Engine({})
        bare = {k: v for k, v in JACK.items() if k != 'id'}
        problems, status = board.check([bare], call=engine)
        self.assertEqual(len(problems), 1)
        self.assertEqual(engine.calls, [])


class Offer(unittest.TestCase):
    def candidates(self, role):
        top = {'look': card(JACK), 'motion': card(JACK), 'captions': dict(card(GEORGIA), answers={
            'why_like': 'the georgia subtitles build', 'why_like_source': 'typed'})}[role]
        return 200, {'ok': True, 'candidates': [top]}

    def test_the_top_card_per_role_is_offered_and_marked(self):
        def engine(method, path, body=None):
            return self.candidates(path.split('role=')[1].split('&')[0])
        spec = {'brand': {}}
        added, status = board.offer(spec, call=engine)
        self.assertEqual(status, 'checked')
        refs = spec['brand']['references']
        self.assertEqual([r['card'] for r in refs], ['instagram_DeZuQ7-lATg', 'instagram_DePHDr_jRed'])
        self.assertEqual(refs[0]['for'], ['look', 'motion'])
        self.assertTrue(all(r['offered'] is True and r['id'] for r in refs))
        self.assertIn('the georgia subtitles build', refs[1]['takeaway'])
        self.assertEqual(len(added), 2)

    def test_a_named_role_is_left_alone(self):
        calls = []

        def engine(method, path, body=None):
            calls.append(path)
            return self.candidates(path.split('role=')[1].split('&')[0])
        spec = {'brand': {'references': [dict(JACK)]}}
        board.offer(spec, call=engine)
        self.assertEqual(len(calls), 1)
        self.assertIn('role=captions', calls[0])

    def test_unreachable_offers_nothing(self):
        spec = {'brand': {}}
        added, status = board.offer(spec, call=Engine({'/api/inspiration/candidates': board.Unavailable('offline')}))
        self.assertEqual((added, spec['brand']['references']), ([], []))
        self.assertTrue(status.startswith('NOT CHECKED'))


class Uses(unittest.TestCase):
    def test_one_row_per_reference_and_role_with_the_critics_score(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            (folder / 'post.json').write_text(json.dumps({'piece_id': PIECE}), encoding='utf-8')
            (folder / 've').mkdir()
            spec_file = folder / 've' / 'spec.json'
            spec = {'piece_id': '2026-11-09-monday', 'brand': {'references': [JACK, GEORGIA]}}
            scores = [{'card': JACK['card'], 'score': 9, 'matches': True, 'note': 'x' * 12},
                      {'card': GEORGIA['card'], 'score': 8.5, 'matches': True, 'note': 'x' * 12}]
            engine = Engine({'/api/inspiration/uses': (200, {'ok': True, 'written': 3})})
            line = board.record_uses(spec, spec_file, 'short', scores, call=engine)
        self.assertEqual(line, 'card uses recorded: 3 row(s)')
        method, path, body = engine.calls[0]
        self.assertEqual((method, path), ('POST', '/api/inspiration/uses'))
        self.assertEqual([(u['card_id'], u['role'], u['critic_score']) for u in body['uses']],
                         [(LOOK, 'look', 9), (LOOK, 'motion', 9), (CAPS, 'captions', 8.5)])
        self.assertTrue(all(u['piece_id'] == PIECE and u['cut'] == 'short' for u in body['uses']))

    def test_unreachable_is_not_recorded_in_those_words(self):
        spec = {'piece_id': PIECE, 'brand': {'references': [JACK]}}
        line = board.record_uses(spec, ROOT / 'x' / 'spec.json', 'long', [], call=Engine({'/api': board.Unavailable('offline')}))
        self.assertTrue(line.startswith('card uses NOT RECORDED'), line)

    def test_references_without_ids_post_nothing(self):
        engine = Engine({})
        bare = {k: v for k, v in JACK.items() if k != 'id'}
        line = board.record_uses({'piece_id': 'p', 'brand': {'references': [bare]}}, ROOT / 'spec.json', 'long', [], call=engine)
        self.assertIn('NOT RECORDED', line)
        self.assertEqual(engine.calls, [])


class RefsCommand(unittest.TestCase):
    """ve refs asks the board before it makes a sheet."""

    def run_refs(self, engine):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            (folder / 've').mkdir()
            (folder / 've' / 'spec.json').write_text(json.dumps({'piece_id': 'p', 'brand': {'references': [JACK]}}), encoding='utf-8')
            video = folder / 've' / 'cut.mp4'
            video.write_bytes(b'0')
            made = []
            out = io.StringIO()
            with patch.object(board, '_engine_call', engine), \
                    patch('velib.verdict.read', return_value={'sha256': '0' * 64}), \
                    patch('velib.verdict.video_path', return_value=video), \
                    patch('velib.refgate.sheets', side_effect=lambda *a, **k: made.append(1) or []), redirect_stdout(out):
                code = ve.cmd_refs(SimpleNamespace(piece=str(folder), cut='short'))
            return code, made, out.getvalue()

    def test_a_dismissed_card_makes_no_sheet(self):
        code, made, text = self.run_refs(Engine({'/api/inspiration/cards': (200, {'ok': True, 'unknown': [], 'cards': [card(JACK, problem='dismissed')]})}))
        self.assertEqual(code, 1, text)
        self.assertEqual(made, [])
        self.assertIn('Krish dismissed it', text)

    def test_offline_says_not_checked_and_still_makes_the_sheets(self):
        code, made, text = self.run_refs(Engine({'/api/inspiration/cards': board.Unavailable('no engine key here')}))
        self.assertEqual(code, 0, text)
        self.assertEqual(made, [1])
        self.assertIn('board NOT CHECKED', text)


if __name__ == '__main__':
    unittest.main()
