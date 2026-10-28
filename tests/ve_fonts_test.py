"""Offline brand font integrity, CSS parity and safe kit synchronization."""
import hashlib
import json
from pathlib import Path
import re
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch
import uuid

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import fonts


class BrandFontsTest(unittest.TestCase):
    def setUp(self):
        self.manifest = json.loads((ROOT / 'config/ve/fonts.json').read_text(encoding='utf-8'))
        self.assets = ROOT / self.manifest['dir']

    def sandbox(self):
        # Python's Windows mode-700 temp directories exclude the sandbox token.
        # Inherit the temp parent's permissions for this isolated test fixture.
        root = Path(tempfile.gettempdir()) / f've-fonts-{uuid.uuid4().hex}'
        root.mkdir()
        self.addCleanup(shutil.rmtree, root)
        manifest_path = root / 'fonts.json'
        manifest_path.write_text(json.dumps(self.manifest), encoding='utf-8')
        destination = root / self.manifest['dir']
        shutil.copytree(self.assets, destination)
        kit = root / 'kit'
        shutil.copytree(self.assets, kit)
        for name, value in [('ROOT', root), ('MANIFEST', manifest_path)]:
            patcher = patch.object(fonts, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)
        return manifest_path, destination, kit

    def test_real_manifest_hashes_roles_and_licenses(self):
        tokens = json.loads((ROOT / 'config/ve/brand-tokens.json').read_text(encoding='utf-8'))
        families = self.manifest['families']
        self.assertEqual(len(families), 4)
        self.assertEqual({family['role'] for family in families}, set(tokens['type_roles']))
        for family in families:
            self.assertTrue(tokens['type_roles'][family['role']].startswith(family['family']))
            license_path = self.assets / family['license']
            self.assertTrue(license_path.is_file())
            self.assertTrue(license_path.read_text(encoding='utf-8').strip())
            for face in family['files']:
                digest = hashlib.sha256((self.assets / face['file']).read_bytes()).hexdigest()
                self.assertEqual(face['sha256'], digest, face['file'])
        ok, lines = fonts.check()
        self.assertTrue(ok, '\n'.join(lines))

    def test_css_files_names_and_axes(self):
        css = fonts.css('../../assets/fonts/makeyourmindup')
        expected = {'MYMU Anton', 'MYMU Archivo', 'MYMU Fraunces', 'MYMU Plex Mono'}
        self.assertEqual(set(re.findall(r"font-family: '([^']+)'", css)), expected)
        faces = [face for family in self.manifest['families'] for face in family['files']]
        self.assertEqual(css.count('@font-face'), len(faces))
        self.assertEqual(css.count('font-display: block;'), len(faces))
        for family in self.manifest['families']:
            for face in family['files']:
                rule = next(rule for rule in css.split('@font-face') if face['file'] in rule)
                self.assertIn(f"url('../../assets/fonts/makeyourmindup/{face['file']}')", rule)
                self.assertIn(f"font-weight: {face['weight']};", rule)
                self.assertIn(f"font-style: {face['style']};", rule)
        self.assertIn('font-stretch: 62% 125%;', css)
        self.assertNotIn('https:', css)
        renderer_css = (ROOT / 'apps/renderer/src/house/fonts.css').read_text(encoding='utf-8')
        declared = set(re.findall(r"font-family\s*:\s*['\"]([^'\"]+)['\"]", renderer_css))
        self.assertEqual(declared, expected)

    def test_sync_from_temp_kit(self):
        manifest_path, destination, kit = self.sandbox()
        original_manifest = manifest_path.read_bytes()
        missing = destination / 'Anton-Regular.ttf'
        missing.unlink()
        lines = fonts.sync(kit)
        self.assertTrue(lines)
        self.assertEqual(missing.read_bytes(), (kit / missing.name).read_bytes())
        self.assertEqual(manifest_path.read_bytes(), original_manifest)
        self.assertTrue(fonts.check()[0])

    def test_sync_refuses_changed_byte_before_any_copy(self):
        manifest_path, destination, kit = self.sandbox()
        original_manifest = manifest_path.read_bytes()
        name = 'IBMPlexMono-Bold.ttf'
        changed = bytearray((kit / name).read_bytes())
        changed[-1] ^= 1
        (kit / name).write_bytes(changed)
        # An earlier file must not be copied before a later mismatch is found.
        earlier = destination / 'Anton-Regular.ttf'
        earlier.unlink()
        with self.assertRaises(SystemExit) as caught:
            fonts.sync(kit)
        self.assertIn(name, str(caught.exception))
        self.assertFalse(earlier.exists())
        self.assertEqual(manifest_path.read_bytes(), original_manifest)
        self.assertNotEqual((destination / name).read_bytes(), changed)

    def test_sync_explicit_hash_update(self):
        manifest_path, destination, kit = self.sandbox()
        name = 'Anton-Regular.ttf'
        changed = bytearray((kit / name).read_bytes())
        changed[-1] ^= 1
        (kit / name).write_bytes(changed)
        fonts.sync(kit, update_manifest=True)
        updated = json.loads(manifest_path.read_text(encoding='utf-8'))
        self.assertEqual(updated['families'][0]['files'][0]['sha256'], hashlib.sha256(changed).hexdigest())
        self.assertEqual((destination / name).read_bytes(), changed)
        self.assertTrue(fonts.check()[0])

    def test_check_missing_file(self):
        _, destination, _ = self.sandbox()
        name = 'Anton-Regular.ttf'
        (destination / name).unlink()
        ok, lines = fonts.check()
        self.assertFalse(ok)
        self.assertTrue(any(name in line and line.startswith('FAIL') for line in lines))

    def test_check_changed_file_and_empty_license(self):
        _, destination, _ = self.sandbox()
        (destination / 'Anton-Regular.ttf').write_bytes(b'corrupt')
        (destination / 'OFL-Archivo.txt').write_text('', encoding='utf-8')
        ok, lines = fonts.check()
        self.assertFalse(ok)
        self.assertTrue(any('FAIL Anton-Regular.ttf' in line for line in lines))
        self.assertTrue(any('FAIL OFL-Archivo.txt' in line for line in lines))

    def test_sync_absent_kit_and_missing_license(self):
        _, _, kit = self.sandbox()
        with self.assertRaises(SystemExit) as caught:
            fonts.sync(kit / 'absent')
        self.assertIn('absent', str(caught.exception))
        (kit / 'OFL-Anton.txt').unlink()
        with self.assertRaises(SystemExit) as caught:
            fonts.sync(kit)
        self.assertIn('OFL-Anton.txt', str(caught.exception))


if __name__ == '__main__':
    unittest.main()
