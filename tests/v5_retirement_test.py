"""Registry membership, runtime refusal, and portable v5 vector checks."""
from unittest.mock import patch
import json
import re
import sys
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'scripts'), str(ROOT / 'scripts/pages'), str(ROOT / 'scripts/post-pack')]
from velib import retirement
from velib.compile import compile_cut
from velib.floor import recipe
from velib.palettes import spec_problems
import creative_direction
import receipt
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
            # The old cover drawers: a module in scripts/pages that draws the post's covers or thumbnails.
            'cover_path': {p.stem for p in (ROOT / 'scripts/pages').glob('*.py')
                           if 'def draw_covers' in p.read_text(encoding='utf-8') and 'def draw_thumbs' in p.read_text(encoding='utf-8')},
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
        # Retired for production: without the legacy flag the skins refuse and name the Library route.
        with patch.object(skins, 'LEGACY', False), self.assertRaisesRegex(SystemExit, 'make_piece.py'):
            skins.pick({}, {})
        with patch.object(skins, 'LEGACY', False), self.assertRaisesRegex(SystemExit, 'make_piece.py'):
            skins.load('v5_feed')
        with patch.object(skins, 'LEGACY', True):
            self.assertEqual(skins.pick({}, {}), 'v5_feed')
            with self.assertRaises(SystemExit):
                skins.pick({'skin': 'neon'}, {})
        with patch.object(skins, 'LEGACY', True):
            feed = skins.load('v5_feed')
        document = feed.page((1080, 1920), (90, 240, 990, 1500), 'photo.jpg', 'A & B', '')
        self.assertIn('A &amp; B', document)
        self.assertIn('transparent 55%', document)
        self.assertNotIn('class="pill"', document)

    def test_library_mirror(self):
        library = ROOT / "docs/ve/cards/library/library.json"
        registry = json.loads(library.read_text(encoding="utf-8"))
        embedded = library.with_suffix(".html").read_text(encoding="utf-8").split("const registry=", 1)[1].split(";\n", 1)[0]
        self.assertEqual(json.loads(embedded), registry)
        retired = [i for i in registry["items"] if i["id"].startswith(
            ("cover-receipt-", "cover-scene-", "cover-face-", "newsletter-substack-cover"))
            or i["id"] in ("web-og-card", "social-x-card", "social-share-card")]
        self.assertEqual(len(retired), 11)
        for item in retired:
            self.assertEqual(item["status"], "retired")
            self.assertIn("I approve the new cover thumbnail systems, go", item["ruling"])

    def test_drawer_refuses_before_accessing_assets(self):
        with patch.object(skins, "LEGACY", False):
            with self.assertRaisesRegex(SystemExit, "make_covers.py"):
                receipt.draw_covers({}, ROOT, ROOT, None)
            with self.assertRaisesRegex(SystemExit, "make_covers.py"):
                receipt.draw_thumbs({}, ROOT, ROOT, None, None)
            with self.assertRaisesRegex(SystemExit, "make_covers.py"):
                skins.load("v5_feed")

    def test_legacy_flag(self):
        pages = ROOT / "scripts/pages"
        for flags in (["--cover"], ["--thumbs"], ["--thumbs", "--options", "2"]):
            run = subprocess.run([sys.executable, str(pages / "build.py"), "absent.json", *flags], capture_output=True, text=True)
            self.assertNotEqual(run.returncode, 0)
            self.assertIn("--legacy", run.stderr)
        run = subprocess.run([sys.executable, str(pages / "build.py"), "absent.json", "--cover", "--legacy"], capture_output=True, text=True)
        self.assertIn("FileNotFoundError", run.stderr)

    def test_vector_references_resolve(self):
        for path in (ROOT / 'assets/brand/makeyourmindup/v5').glob('*.svg'):
            tree = ET.parse(path)
            ids = {node.get('id') for node in tree.iter()}
            for node in tree.iter():
                if 'href' in node.attrib:
                    self.assertIn(node.get('href')[1:], ids, path.name)


if __name__ == '__main__':
    unittest.main()
