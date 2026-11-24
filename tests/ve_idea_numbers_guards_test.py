"""The Critic's two questions, asked while the spec and the cards are written (velib/ideaguard.py, precritic.py).

Krish, 2026-11-18, of the Tue 17 habits short: "how you are able to get all this way through to production and point out
those two things - thats ridiculous [...] that should have been picked up at the start". The habits spec itself is the
case: tests/fixtures/ve/habits-2026-11-17-spec.json is a copy of it as it stood, never judged in place (it is published
17 Nov, before the gates bind). Run with python3 tests/ve_idea_numbers_guards_test.py."""
import copy
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
os.environ['VE_GATES_OFFLINE'] = '1'

from velib import cards, guards, ideaguard, precritic  # noqa: E402

HABITS = json.loads((ROOT / 'tests/fixtures/ve/habits-2026-11-17-spec.json').read_text(encoding='utf-8'))
RULES = guards.config()['one_object']


def bound(spec, day='2026-11-20'):
    out = copy.deepcopy(spec)
    out['publish_day'] = day
    return out


def codes(lines):
    return sorted({line.split(' ', 1)[0] for line in lines})


class OneObject(unittest.TestCase):
    def test_the_habits_spec_would_be_flagged_when_the_date_gate_is_bypassed(self):
        problems = ideaguard.one_object_problems(HABITS, RULES)
        self.assertEqual(codes(problems), ['idea.one_object'])
        joined = '\n'.join(problems)
        self.assertIn('taken literally', joined)          # the move that acts out the line
        self.assertIn('different generated pictures', joined)  # no one object carries it

    def test_it_is_not_judged_in_place_before_the_rule_binds(self):
        self.assertEqual(guards.one_object_problems(HABITS), [])        # published 17 Nov
        self.assertTrue(guards.one_object_problems(bound(HABITS)))      # the same spec published 20 Nov

    def test_a_ladder_shaped_idea_passes(self):
        spec = bound(HABITS)
        spec['style']['idea']['moves'] = [{'move': 'the drop', 'means': 'the junior rung thins as 27% falls to 9%'}]
        spec['style']['idea']['carrier'] = 'plate-b1'
        # Carried by one object on at least 60% of the beats: the Ladder's shape.
        for b in spec['cuts']['short']['beats']:
            b['uses'] = ['plate-b1']
        self.assertEqual(ideaguard.one_object_problems(spec, RULES), [])

    def test_a_carrier_that_does_not_persist_is_refused(self):
        spec = bound(HABITS)
        spec['style']['idea']['moves'] = [{'move': 'the drop', 'means': 'the junior rung thins as 27% falls to 9%'}]
        spec['style']['idea']['carrier'] = 'plate-b1'
        problems = ideaguard.one_object_problems(spec, RULES)
        self.assertEqual(codes(problems), ['idea.one_object'])
        self.assertIn('persists', problems[0])

    def test_few_pictures_need_no_carrier(self):
        spec = bound(HABITS)
        spec['style']['idea']['moves'] = [{'move': 'm', 'means': 'the junior rung thins as 27% falls to 9%'}]
        keep = [a['id'] for a in spec['assets'] if a.get('origin') == 'generated'][:RULES['max_generated_pictures']]
        for a in spec['assets']:
            if a.get('origin') == 'generated' and a['id'] not in keep:
                a['origin'] = 'capture'
        self.assertEqual(ideaguard.one_object_problems(spec, RULES), [])


class InventedNumbers(unittest.TestCase):
    def test_the_spec_forbids_them_and_the_card_that_asked_for_them_is_refused(self):
        self.assertTrue(ideaguard.forbids_invented_numbers(HABITS))
        fields = {'title': 'Five screens', 'goal': 'Build the screens.',
                  'contract': '3. b13-overrule. The assistant\'s answer bubble reads "Q3 revenue grew 40% this quarter." The reply "That\'s wrong. It\'s 4%." types in.'}
        problems = ideaguard.card_problems(fields, HABITS, ROOT / 'docs/plans/2026-11-17-tue-habits/ve')
        self.assertEqual(codes(problems), ['numbers.invented'])
        self.assertTrue(any('"40%"' in p and 'Q3 revenue grew 40%' in p for p in problems))
        self.assertTrue(any('"4%"' in p for p in problems))

    def test_a_figure_the_piece_owns_passes(self):
        fields = {'title': 't', 'goal': 'g', 'contract': 'The page shows "71% of HR chiefs want AI overruled" and "29%" of staff.'}
        self.assertEqual(ideaguard.card_problems(fields, HABITS, None), [])

    def test_a_supplied_number_passes(self):
        fields = {'title': 't', 'goal': 'g', 'contract': 'The email reads "Revenue grew 40%".'}
        self.assertTrue(ideaguard.card_problems(fields, HABITS, None))
        self.assertEqual(ideaguard.card_problems(fields, HABITS, None, supplied=['40%']), [])

    def test_a_spec_that_does_not_forbid_them_is_left_alone(self):
        spec = copy.deepcopy(HABITS)
        spec['style']['idea']['never'] = ['no robot faces']
        fields = {'title': 't', 'goal': 'g', 'contract': 'It reads "Q3 revenue grew 40%".'}
        self.assertEqual(ideaguard.card_problems(fields, spec, None), [])

    def test_the_screens_codex_made_are_read_for_figures(self):
        found = [('b22-screen.png', 'Subject: Q3 numbers (draft). Renewals held steady at 94% . Revenue grew 4%'),
                 ('ok.png', 'IBM found 71% , 1 of them, 29%')]
        problems = ideaguard.screen_problems(found, HABITS, None)
        self.assertEqual(codes(problems), ['numbers.invented'])
        text = '\n'.join(problems)
        self.assertIn('"94%"', text)
        self.assertNotIn('"71%"', text)
        self.assertNotIn('"1"', text)   # a lone digit is a list marker or a misread

    def test_the_two_are_one_allow_list(self):
        self.assertIn('71', ideaguard.allowed_numbers(HABITS))
        self.assertNotIn('94', ideaguard.allowed_numbers(HABITS))


class CardsCarryTheSpec(unittest.TestCase):
    def write(self, spec, contract, **extra):
        with tempfile.TemporaryDirectory() as tmp:
            spec_file = Path(tmp) / 've' / 'spec.json'
            spec_file.parent.mkdir()
            spec_file.write_text(json.dumps(spec), encoding='utf-8')
            fields = dict(card_id='habits-t-1', kind='asset', title='A screen', goal='Build it.', contract=contract,
                          acceptance='  python3 -c "print(1)"', cwd=tmp, write_allow='[.scratch/**]', read='[docs/**]',
                          spec=str(spec_file), motion_style='swiss-kinetic-type', **extra)
            out = Path(tmp) / 'card.md'
            cards.write_card(out, **fields)
            return out.read_text(encoding='utf-8')

    def test_the_cards_text_carries_the_specs_never_list(self):
        spec = bound(HABITS, '2026-11-13')   # before the pre-critic binds, so only the card rules apply
        text = self.write(spec, 'A plain chat.')
        self.assertIn('## Never (this piece', text)
        self.assertIn('no invented numbers: every figure is IBM', text)
        self.assertIn('\nspec: ', text)

    def test_a_card_asking_for_an_invented_number_is_refused(self):
        spec = bound(HABITS, '2026-11-13')
        with self.assertRaises(SystemExit) as raised:
            self.write(spec, 'The bubble reads "Q3 revenue grew 40% this quarter."')
        self.assertIn('numbers.invented', str(raised.exception))
        self.assertIn('"40%"', str(raised.exception))

    def test_supplied_numbers_are_written_on_the_card(self):
        spec = bound(HABITS, '2026-11-13')
        text = self.write(spec, 'The bubble reads "Q3 revenue grew 40%".', numbers_supplied='40%')
        self.assertIn('numbers_supplied: 40%', text)


class VerifyCardReadsTheScreens(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.spec = self.dir / 'spec.json'
        self.spec.write_text(json.dumps(HABITS), encoding='utf-8')
        self.png = self.dir / 'screen.png'
        self.png.write_bytes(b'png')

    def tearDown(self):
        self.tmp.cleanup()

    def meta(self):
        return {'spec': str(self.spec)}

    def test_an_invented_number_on_a_produced_screen_fails(self):
        read = lambda png: [('Renewals', 90.0, (0, 0, 1, 1)), ('94%', 91.0, (0, 0, 1, 1))]  # noqa: E731
        problems = cards.screen_numbers(self.meta(), self.dir, ['?? screen.png'], [], read=read)
        self.assertEqual(codes(problems), ['numbers.invented'])
        self.assertIn('"94%"', problems[0])

    def test_figures_the_piece_owns_pass(self):
        read = lambda png: [('71%', 90.0, (0, 0, 1, 1))]  # noqa: E731
        self.assertEqual(cards.screen_numbers(self.meta(), self.dir, ['?? screen.png'], [], read=read), [])

    def test_no_ocr_is_a_not_run_note_never_a_silent_pass(self):
        def read(png):
            raise OSError('tesseract is not on PATH')
        notes = []
        self.assertEqual(cards.screen_numbers(self.meta(), self.dir, ['?? screen.png'], notes, read=read), [])
        self.assertEqual(len(notes), 1)
        self.assertIn('not_run', notes[0])
        self.assertIn('NOT read', notes[0])

    def test_a_card_with_no_spec_is_not_checked(self):
        self.assertEqual(cards.screen_numbers({}, self.dir, ['?? screen.png'], []), [])


class PreCritic(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.spec_file = Path(self.tmp.name) / 've' / 'spec.json'
        self.spec_file.parent.mkdir()
        self.spec = bound(HABITS)
        self.spec_file.write_text(json.dumps(self.spec), encoding='utf-8')
        self.pass_ = {'one_idea': {'pass': True, 'line': 'One object, the driver\'s seat, on b1 to b27'},
                      'no_invented_numbers': {'pass': True, 'line': 'Every figure is IBM\'s own, b11'}}

    def tearDown(self):
        self.tmp.cleanup()

    def test_no_verdict_is_a_lint_problem_and_a_card_refusal(self):
        self.assertEqual(codes(guards.pre_critic_lints(self.spec, self.spec_file)), ['critic.pre'])
        with self.assertRaises(SystemExit):
            cards._piece_gates({'title': 't', 'goal': 'g', 'contract': 'c'}, (self.spec, self.spec_file, 'x'), Path('c.md'))

    def test_a_passing_verdict_clears_both(self):
        precritic.write(self.spec, self.spec_file, 'a fresh reviewer', self.pass_, [], [])
        self.assertEqual(guards.pre_critic_lints(self.spec, self.spec_file), [])
        cards._piece_gates({'title': 't', 'goal': 'g', 'contract': 'c'}, (self.spec, self.spec_file, 'x'), Path('c.md'))

    def test_a_changed_spec_makes_it_stale(self):
        precritic.write(self.spec, self.spec_file, 'a fresh reviewer', self.pass_, [], [])
        changed = copy.deepcopy(self.spec)
        changed['style']['idea']['object'] += ' and a mint ring'
        ok, why = precritic.state(changed, self.spec_file)
        self.assertFalse(ok)
        self.assertIn('stale', why)

    def test_an_audio_target_or_a_crop_edit_keeps_the_verdict(self):
        # Fri 20 Nov: bound to the whole spec, every audio target or counter edit made it stale (61 runs on one piece).
        precritic.write(self.spec, self.spec_file, 'a fresh reviewer', self.pass_, [], [])
        tuned = copy.deepcopy(self.spec)
        tuned['audio'].setdefault('targets', {})['integrated_lufs'] = -13
        tuned['audio']['bed']['under_vo_lu'] = -22
        first_cut = next(iter(tuned['cuts'].values()))
        first_cut['beats'][0].setdefault('plate', {})['crop'] = '50% 16%'
        ok, why = precritic.state(tuned, self.spec_file)
        self.assertTrue(ok, why)

    def test_a_beat_edit_makes_it_stale(self):
        precritic.write(self.spec, self.spec_file, 'a fresh reviewer', self.pass_, [], [])
        moved = copy.deepcopy(self.spec)
        beat = next(iter(moved['cuts'].values()))['beats'][0]
        beat['layout'] = 'SPLIT' if beat.get('layout') != 'SPLIT' else 'STAGE'
        ok, why = precritic.state(moved, self.spec_file)
        self.assertFalse(ok)
        self.assertIn('stale', why)
        dropped = copy.deepcopy(self.spec)
        next(iter(dropped['cuts'].values()))['beats'].pop()
        self.assertFalse(precritic.state(dropped, self.spec_file)[0])

    def test_a_figure_changed_after_the_review_makes_it_stale(self):
        # Q2 judged the figures: one added or changed afterwards is not what the reviewer read.
        precritic.write(self.spec, self.spec_file, 'a fresh reviewer', self.pass_, [], [])
        changed = copy.deepcopy(self.spec)
        changed['datasets'][0]['rows'][0]['value'] = 72
        ok, why = precritic.state(changed, self.spec_file)
        self.assertFalse(ok)
        self.assertIn('stale', why)
        worded = copy.deepcopy(self.spec)
        worded['objects'][0].setdefault('params', {})['label'] = '9 in 10 chiefs'
        self.assertFalse(precritic.state(worded, self.spec_file)[0])

    def test_an_object_layout_number_keeps_the_verdict(self):
        precritic.write(self.spec, self.spec_file, 'a fresh reviewer', self.pass_, [], [])
        nudged = copy.deepcopy(self.spec)
        nudged['objects'][0]['params']['push'] = 0.09
        nudged['datasets'][0]['retrieved_at'] = '2026-11-19'
        self.assertTrue(precritic.state(nudged, self.spec_file)[0])

    def test_his_approvals_do_not_make_it_stale(self):
        precritic.write(self.spec, self.spec_file, 'a fresh reviewer', self.pass_, [], [])
        signed = copy.deepcopy(self.spec)
        signed['approvals'] = [{'gate': 'proof', 'by': 'Krish', 'artifact_hash': 'a' * 64}]
        self.assertTrue(precritic.state(signed, self.spec_file)[0])

    def test_a_failed_question_blocks(self):
        answers = copy.deepcopy(self.pass_)
        answers['one_idea'] = {'pass': False, 'line': '13 generated pictures, no one object (b1 to b27)'}
        precritic.write(self.spec, self.spec_file, 'a fresh reviewer', answers, [], [])
        ok, why = precritic.state(self.spec, self.spec_file)
        self.assertFalse(ok)
        self.assertIn('13 generated pictures', why)

    def test_an_answer_with_no_reason_is_refused(self):
        with self.assertRaises(ValueError):
            precritic.write(self.spec, self.spec_file, 'r', {'one_idea': {'pass': True, 'line': 'ok'}, 'no_invented_numbers': self.pass_['no_invented_numbers']}, [], [])

    def test_a_piece_before_the_rule_is_not_held(self):
        old = copy.deepcopy(self.spec)
        old['publish_day'] = '2026-11-17'
        self.assertEqual(guards.pre_critic_lints(old, self.spec_file), [])


if __name__ == '__main__':
    unittest.main()
