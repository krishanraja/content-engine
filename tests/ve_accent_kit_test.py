"""The v5 palette retires the 20 November series-day accents and keeps their approved values in the archive."""
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
        archived = palette['retired']['accent']
        self.assertEqual(archived['days'], ['monday', 'wednesday', 'friday'])
        self.assertEqual(sorted(archived['roles']), sorted(accent_kit.kit()['roles']))
        self.assertNotIn('accent', palette['colour'])
        self.assertEqual(accent_kit.kit()['days'], [])

    def test_its_former_roles_are_refused_on_series_days_off_days_and_undated_specs(self):
        for day in ('2026-11-27', '2026-11-26', None):
            with self.subTest(day=day):
                cut = spec(day, moment={'ground': 'moment_gradient'}, cutout={'duotone': 'duotone_ember'})
                problems = [p for p in palette_lints(cut) if p.startswith('brand.accent')]
                self.assertEqual(len(problems), 2)
                self.assertTrue(all('retired' in p for p in problems), problems)

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
