import copy
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import grammar
from velib.compile import compile_cut
from velib.lint import schema
from velib.retirement import problems as retired_problems

FIXTURE = ROOT / 'fixtures/ve/why-ladder-v5'


class WhyLadderFixture(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.spec, errors = schema(FIXTURE / 'spec.json')
        if errors:
            raise AssertionError(errors)

    def test_compile_on_the_spoken_clock(self):
        spec = copy.deepcopy(self.spec)
        del spec['brand']['caption_theme']
        self.assertFalse(retired_problems(spec))
        for cut_id, cut in spec['cuts'].items():
            with self.subTest(cut=cut_id):
                self.assertEqual([], grammar.check(spec))
                script = ' '.join(b['point'] for b in cut['beats']).split()
                words = [dict(w=i, text=w, onset_s=i * .36, end_s=(i + 1) * .36)
                         for i, w in enumerate(script)]
                props = compile_cut(spec, cut_id, words, FIXTURE)
                self.assertEqual('house-v5', props['captionTheme'])
                self.assertEqual(cut['aspect'], props['aspect'])
                self.assertEqual(spec['title_line'], ' '.join(w['text'] for w in props['titleMoment']['words']))
                self.assertTrue(all(2 <= len(p['words']) <= 5 for p in props['captions']))
                self.assertEqual(props['durationFrames'], props['beats'][-1]['toFrame'])
                for prev, after in zip(props['beats'], props['beats'][1:]):
                    self.assertEqual(prev['toFrame'], after['fromFrame'])

    def test_refuses_missing_source_and_missing_rung(self):
        spec = copy.deepcopy(self.spec)
        spec['assets'] = []
        del spec['cuts']['short']['beats'][3]
        errors = grammar.ladder_lints(spec, 'short')
        self.assertTrue(any('source asset' in e for e in errors))
        self.assertTrue(any('recipe order' in e for e in errors))


if __name__ == '__main__':
    unittest.main()
