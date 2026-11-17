"""Style palettes (scripts/velib/palettes.py, config/ve/style-palettes.json). Ruling, Krish, 2026-11-16: "A style may
bring in its own colours and theming as long as it doesn't end up looking like a clown's apron. I want to experiment
with variety, colour, and visual styles." A spec names one in style.palette; the cut is drawn in it and his brand marks
keep the house colours."""
from __future__ import annotations

import copy
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
sys.path.insert(0, str(ROOT / 'tests'))
from velib import palettes  # noqa: E402
from velib.common import load_json  # noqa: E402
from velib.compile import compile_cut  # noqa: E402
from ve_compile_test import FIXTURE, timed_words  # noqa: E402

GOOD = {'colours': {'ink': '#1E2A5A', 'ink_deep': '#141C40', 'ink_soft': '#2B3A75', 'cream': '#F7F1E3', 'mint': '#FF5C95'}}


class PaletteRulesTest(unittest.TestCase):
    def test_every_palette_on_file_holds_its_rules(self):
        self.assertEqual(palettes.all_problems(), [])
        self.assertGreaterEqual(len(palettes.load()), 5)

    def test_a_clowns_apron_is_refused(self):
        loud = {'colours': dict(GOOD['colours'], cream='#FFE600', mint='#FF00FF', ink='#00C2FF')}
        lines = palettes.palette_problems('loud', loud)
        self.assertTrue(any('cream on ink' in x for x in lines), lines)

    def test_it_fills_the_five_roles_with_colours(self):
        self.assertTrue(palettes.palette_problems('short', {'colours': {'ink': '#000000'}}))
        self.assertTrue(palettes.palette_problems('words', {'colours': dict(GOOD['colours'], mint='pink')}))
        self.assertEqual(palettes.palette_problems('good', GOOD), [])


class SpecTest(unittest.TestCase):
    def test_a_spec_names_a_palette_on_file_or_none(self):
        self.assertEqual(palettes.spec_problems({'style': {}}), [])
        self.assertEqual(palettes.spec_problems({'style': {'palette': 'riso-pop'}}), [])
        self.assertTrue(palettes.spec_problems({'style': {'palette': 'neon-rainbow'}})[0].startswith('palette.unknown'))

    def test_the_cut_is_drawn_in_the_palette_and_his_marks_keep_the_house_colours(self):
        spec = load_json(FIXTURE / 'spec.json')
        cut_id = next(iter(spec['cuts']))
        house = compile_cut(spec, cut_id, timed_words(), FIXTURE)
        self.assertNotIn('brandTokens', house, 'no palette, no second set')
        styled = copy.deepcopy(spec)
        styled.setdefault('style', {})['palette'] = 'riso-pop'
        props = compile_cut(styled, cut_id, timed_words(), FIXTURE)
        riso = palettes.load()['riso-pop']['colours']
        self.assertEqual((props['tokens']['ink'], props['tokens']['mint']), (riso['ink'], riso['mint']))
        self.assertEqual(props['brandTokens'], house['tokens'], 'the mark tile, pill, call card and ending keep the house colours')
        self.assertEqual(props['tokens']['channel'], house['tokens']['channel'])


class TheLogoOnlyOnTheTitleFrameAndTheClose(unittest.TestCase):
    """Ruling (Krish, 2026-11-17): the logo only on the animated title frame and the close card (config/brand-palette.json
    logo_rule). From its date compile tells the renderer the body carries no logo; before it the props are unchanged."""

    def compiled(self, day):
        spec = copy.deepcopy(load_json(FIXTURE / 'spec.json'))
        spec['publish_day'] = day
        return {cut: compile_cut(spec, cut, timed_words(), FIXTURE) for cut in spec['cuts']}

    def test_from_its_date_no_cut_carries_a_body_logo(self):
        for cut, props in self.compiled('2026-11-23').items():
            with self.subTest(cut=cut):
                self.assertIs(props.get('bodyLogo'), False)

    def test_before_its_date_the_props_are_as_they_were(self):
        for cut, props in self.compiled('2026-11-18').items():
            with self.subTest(cut=cut):
                self.assertNotIn('bodyLogo', props)


if __name__ == '__main__':
    unittest.main()
