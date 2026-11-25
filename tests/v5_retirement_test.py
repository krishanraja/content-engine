"""Registry membership, runtime refusal, and portable v5 vector checks."""
from unittest.mock import patch
import json
import re
import sys
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'scripts'), str(ROOT / 'scripts/pages'), str(ROOT / 'scripts/post-pack')]
from velib import retirement
from velib.compile import compile_cut
from velib.floor import recipe
from velib.palettes import spec_problems
import creative_direction
import skins


def config(name):
    return json.loads((ROOT / 'config' / (name + '.json')).read_text(encoding='utf-8'))


class RetirementTest(unittest.TestCase):
    def test_source_membership(self):
        bank = config('style-references')
        design = config('ve/design-lock')
        entries = ROOT / 'apps/renderer/src'
        sources = {
            'caption_theme': set(config('caption-themes')),
            'motion_style': {row['id'] for row in bank['bank'] if row['layer'] == 'motion'},
            'palette': set(config('ve/style-palettes')['palettes']),
            'skin': {p.stem for p in (ROOT / 'scripts/pages/skins').glob('*.py')},
            'recipe': {p.stem for p in (ROOT / 'config/ve/recipes').glob('*.json')},
            'format_look': {p.stem for p in (ROOT / 'config/ve/formats').glob('*.json')} | {f['id'] for f in bank['formats']['production']},
            'device': set(re.findall(r'^  (\w+):', (entries / 'engine/devices/registry.ts').read_text(), re.M)),
            'design_lock_kit': set(design['retired']['kit']),
            'composition': set(re.findall(r'<Composition\s+id="([^"]+)"', ''.join(p.read_text(encoding='utf-8') for p in [entries / 'Root.tsx', *(entries / 'border-control').glob('*entry.tsx')]))),
            'font': {'IBM Plex Mono', 'Source Serif 4', 'Newsreader', 'Instrument Serif'},
            'brand_asset': {p.name for p in (ROOT / 'scripts/quick-edit/kit').glob('*.html')} | {'tokens.css', 'colour.series', config('brand-robot')['retired']['id'], config('series-art')['retired']['id']},
        }
        for kind, name in retirement.registry():
            with self.subTest(kind=kind, name=name):
                self.assertIn(name, sources[kind])

    def test_runtime_gates(self):
        for spec in [{'style': {'motion': {'module': 'toy-3d'}}}, {'style': {'captions': {'theme': 'pop'}}},
                     {'brand': {'caption_theme': 'receipt-chip'}}, {'style': {'palette': 'arcade'}},
                     {'objects': [{'device': 'sticker'}]}, {'format': 'two-passports'}, {'style': {'recipe': 'hud-terminal'}}]:
            with self.subTest(spec=spec):
                self.assertIn('retired', creative_direction.motion_problems(spec)[0])
                with self.assertRaisesRegex(ValueError, 'retired'):
                    compile_cut(spec, 'short', [], ROOT)
        self.assertIsNone(recipe('hud-terminal'))
        self.assertIn('retired', spec_problems({'style': {'palette': 'arcade'}})[0])

    def test_engine_lint(self):
        from velib import lint
        fixture = ROOT / 'fixtures/ve/my-test-19s/spec.json'
        spec = json.loads(fixture.read_text())
        spec['brand']['caption_theme'] = 'pop'
        with patch.object(lint, 'schema', return_value=(spec, [])):
            _, errors = lint.lint(fixture)
        self.assertTrue(any('pop' in line and 'retired' in line for line in errors))

    def test_feed(self):
        self.assertEqual(skins.pick({}, {}), 'v5_feed')
        with self.assertRaises(SystemExit):
            skins.pick({'skin': 'neon'}, {})
        document = skins.load('v5_feed').page((1080, 1920), (90, 240, 990, 1500), 'photo.jpg', 'A & B', '')
        self.assertIn('A &amp; B', document)
        self.assertIn('transparent 55%', document)
        self.assertNotIn('class="pill"', document)

    def test_vector_references_resolve(self):
        for path in (ROOT / 'assets/brand/makeyourmindup/v5').glob('*.svg'):
            tree = ET.parse(path)
            ids = {node.get('id') for node in tree.iter()}
            for node in tree.iter():
                if 'href' in node.attrib:
                    self.assertIn(node.get('href')[1:], ids, path.name)


if __name__ == '__main__':
    unittest.main()
