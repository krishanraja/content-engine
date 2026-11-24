"""The no-ask guard (Ruling, Krish, 2026-11-19: no approvals during production). config/ve/asks.json lists the only
moments a production session may ask Krish anything; scripts/validate-skills.py refuses a production skill that tells
a session to wait for his approval anywhere else, and making.py records what the session decided as one line for the
final review instead of a question."""
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('validate_skills', ROOT / 'scripts' / 'validate-skills.py')
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import making  # noqa: E402


class AsksConfigTests(unittest.TestCase):
    def test_four_allowed_asks_and_the_production_skills(self):
        config = json.loads((ROOT / 'config' / 've' / 'asks.json').read_text(encoding='utf-8'))
        self.assertEqual([a['id'] for a in config['allowed']], ['lock', 'scripts_and_storyboard', 'final', 'publish'])
        self.assertEqual(config['spend']['signed_at'], 'lock')
        for name in ('make-piece', 've', 'produce-video', 'motion-designer', 'thumbnail-designer'):
            self.assertIn(name, config['skills'])
            self.assertTrue((ROOT / '.agents' / 'skills' / name / 'SKILL.md').exists(), name)


class NoAskGuardTests(unittest.TestCase):
    def setUp(self):
        self.config = validator.asks_config()

    def problems(self, text, name='produce-video'):
        with tempfile.TemporaryDirectory() as tmp:
            skill = Path(tmp) / name
            skill.mkdir()
            (skill / 'SKILL.md').write_text(text, encoding='utf-8')
            return validator.no_ask_problems(skill, self.config)

    def test_the_self_test_can_fail_and_passes(self):
        self.assertEqual(validator.no_ask_self_test(), [])

    def test_every_production_skill_passes_today(self):
        for name in self.config['skills']:
            self.assertEqual(validator.no_ask_problems(ROOT / '.agents' / 'skills' / name, self.config), [], name)

    def test_mid_production_waits_are_refused_outside_the_allowed_section(self):
        allowed = '## Allowed asks\n\nNever wait for his yes; never type approve engine.\n\n'
        for wait in ('Render the proof, then wait for his yes.', 'Ask him to approve the engine before the render.',
                     'Type approve engine for the new hash.', 'File it once he types final approve long 746e5208.',
                     'At 80% stop and ask at a gate.', 'After two loops bring Krish the one question.'):
            got = self.problems(allowed + '## 4. Render\n\n' + wait + '\n')
            self.assertEqual(len(got), 1, (wait, got))
            self.assertIn('mid-production', got[0])

    def test_the_waits_the_review_found_are_refused_wrapped_or_not(self):
        allowed = '## Allowed asks\n\nAsk at the lock.\n\n'
        for wait in ('Any change to the action goes back to Krish before work continues.',
                     'Nothing spends: a paid fact check, a market, a post go only on Krish\'s words, immediately before.',
                     'Nothing spends: a paid\nfact check, a market, a post go only on Krish\'s words, immediately before.',
                     'SFX kits are absent until Krish approves a sound by ear; sfx_missing blocks status.',
                     'Say both numbers; it is his open question in WORKBENCH.md.',
                     'If not, propose a recipe and get his yes in words.'):
            got = self.problems(allowed + '## 4. Render\n\n' + wait + '\n')
            self.assertEqual(len(got), 1, (wait, got))
            self.assertIn('line 7', got[0])

    def test_a_wrapped_phrase_is_not_counted_twice_or_across_a_heading(self):
        text = '## Making\n\nThen a paid fact check runs only on\nKrish\'s words.\n## Allowed asks\n\nAsk at the lock.\n'
        self.assertEqual(len(self.problems(text)), 1)
        text = '## Making\n\nDecide; never get\n## Allowed asks\n\nhis yes mid-production.\n'
        self.assertEqual(self.problems(text), [])

    def test_the_rule_under_its_own_heading_and_the_final_approve_press_pass(self):
        text = ('## Allowed asks\n\nNever wait for his yes; never ask him to approve the engine.\n\n'
                '### Why\n\nNever "final approve" typed in chat.\n\n'
                '## 9. Publish\n\nOnly publishing waits, on his final Approve press, bound to the file shas.\n')
        self.assertEqual(self.problems(text), [])

    def test_a_section_after_the_allowed_one_is_checked_again(self):
        text = '## Allowed asks\n\nAsk at the lock.\n\n## Making\n\nThen wait for his approval.\n'
        self.assertEqual(len(self.problems(text)), 1)

    def test_a_production_skill_needs_the_section_and_others_are_left_alone(self):
        self.assertIn('no "Allowed asks" section', self.problems('## Making\n\nDecide.\n')[0])
        self.assertEqual(self.problems('Wait for his yes.\n', name='plan-week'), [])


class FinalReviewLineTests(unittest.TestCase):
    def test_one_line_per_choice(self):
        patch = making.final_review_patch('thumbnail', "Thumbnail: option B,\n the critic's best")
        self.assertEqual(patch, {'for_final_review': [{'key': 'thumbnail', 'line': "Thumbnail: option B, the critic's best"}]})

    def test_a_bad_key_or_an_empty_or_long_line_is_refused(self):
        for key, line in (('Thumb nail', 'x'), ('title', ''), ('title', 'x' * 301)):
            with self.assertRaises(making.MakingError):
                making.final_review_patch(key, line)

    def test_the_cli_writes_it_and_show_reads_it_back(self):
        sent = []

        def call(method, path, body):
            sent.append((method, path, body))
            if method == 'GET':
                return 200, json.dumps({'making': {'for_final_review': [{'key': 'speed', 'line': 'Short at 1.05x'}]}, 'steps': []})
            return 200, json.dumps({'making': {}})

        piece = '904658db-4df2-4537-a0ed-ebe93e081db7'
        self.assertEqual(making.main([piece, 'final-review', 'speed', 'Short at 1.05x', '--by', 'Claude Code'], call=call), 0)
        self.assertEqual(sent[-1][2]['for_final_review'], [{'key': 'speed', 'line': 'Short at 1.05x'}])
        self.assertIn('for the final review: Short at 1.05x', making.show(piece, call))


if __name__ == '__main__':
    unittest.main()
