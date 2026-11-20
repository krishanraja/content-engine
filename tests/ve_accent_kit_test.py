"""The accent kit (Krish approved on 2026-11-20, the polish board): ember, ember_deep, plum, plum_deep and peach, for big
moments, gradients and duotone cut-outs on Monday, Wednesday and Friday only. config/ve/brand-tokens.json accent_kit,
config/brand-palette.json colour.accent, scripts/velib/accent_kit.py."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))

from velib import accent_kit  # noqa: E402
from velib.lint import palette_lints  # noqa: E402


def spec(day, **objects):
    return {'publish_day': day, 'brand': {'series': 'mind.the.gap'}, 'cuts': {},
            'objects': [{'obj': name, 'device': 'kinetic_stat', 'params': params} for name, params in objects.items()]}


class AccentKit(unittest.TestCase):
    def test_the_values_are_the_ones_he_approved(self):
        colours = accent_kit.kit()['colours']
        self.assertEqual({k: colours[k] for k in ('ember', 'ember_deep', 'plum', 'plum_deep', 'peach')},
                         {'ember': '#E2551F', 'ember_deep': '#B8321C', 'plum': '#3B1232', 'plum_deep': '#1E0918', 'peach': '#FFB48F'})
        palette = json.loads((ROOT / 'config' / 'brand-palette.json').read_text(encoding='utf-8'))
        self.assertEqual(palette['colour']['accent']['days'], accent_kit.kit()['days'])
        self.assertEqual(sorted(palette['colour']['accent']['roles']), sorted(accent_kit.kit()['roles']))
        self.assertEqual(accent_kit.kit()['days'], ['monday', 'wednesday', 'friday'])

    def test_in_its_roles_on_a_series_day_it_passes(self):
        good = spec('2026-11-27', moment={'ground': 'moment_gradient'}, cutout={'duotone': 'duotone_ember'})
        self.assertEqual(accent_kit.accent_problems(good), [])
        self.assertEqual([p for p in palette_lints(good) if 'accent' in p], [])

    def test_on_an_off_day_it_is_refused(self):
        off = spec('2026-11-26', moment={'ground': 'moment_gradient'})  # a Thursday
        self.assertRegex(' '.join(accent_kit.accent_problems(off)), 'off day')
        self.assertTrue([p for p in palette_lints(off) if p.startswith('brand.accent')])

    def test_outside_its_roles_it_is_refused(self):
        for name, params in {'type in ember': {'colour': 'ember'}, 'a plum caption': {'caption': 'plum'}}.items():
            with self.subTest(name):
                self.assertRegex(' '.join(accent_kit.accent_problems(spec('2026-11-27', o=params))), 'only the whole value')

    def test_a_word_in_a_line_is_not_a_colour(self):
        self.assertEqual(accent_kit.accent_problems(spec('2026-11-26', o={'label': 'a peach of a deal'})), [])

    def test_nothing_else_changes(self):
        tokens = json.loads((ROOT / 'config' / 've' / 'brand-tokens.json').read_text(encoding='utf-8'))
        self.assertEqual(set(tokens['roles']), {'background', 'background_deep', 'surface', 'text', 'paper', 'answer', 'brand', 'action', 'channel'})


if __name__ == '__main__':
    unittest.main()
