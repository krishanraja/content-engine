"""Passport device registration, approved beat order and offline plate provenance."""
import base64
import hashlib
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]


def load(path):
    return json.loads((ROOT / path).read_text(encoding='utf-8'))


class PassportTests(unittest.TestCase):
    def test_device_and_exact_verbs(self):
        self.assertEqual(load('config/ve/devices.json')['devices']['passport_page']['verbs'],
                         ['enter', 'stamp', 'mark', 'exit'])
        registry = (ROOT / 'apps/renderer/src/engine/devices/registry.ts').read_text()
        self.assertIn('passport_page: PassportPage', registry)

    def test_format_beats_match_lock_and_other_devices_remain_pending(self):
        fmt = load('config/ve/formats/two-passports.json')
        lock = load('config/ve/design-lock.json')['formats']['two-passports']
        self.assertEqual([beat['id'] for beat in fmt['beats']], lock['beats'])
        self.assertEqual(fmt['pending_devices'], ['scribble', 'thread_card'])
        self.assertTrue(all(beat['layout'] == 'STAGE' and beat['template'] for beat in fmt['beats']))
        used = {obj['device'] for beat in fmt['beats'] for obj in beat['template']}
        self.assertEqual(used, {'passport_page', 'headline', 'sticker', 'stamp', 'scribble', 'thread_card'})
        for beat in fmt['beats']:
            names = [obj['obj'] for obj in beat['template']]
            self.assertEqual(len(names), len(set(names)))
            for obj in beat['template']:
                if obj['device'] != 'passport_page':
                    continue
                params = obj['params']
                for field in params['fields']:
                    self.assertEqual(field['state'], 'sample')
                    self.assertIn('sampleText', params)

    def test_plate_sidecar_hashes_and_renderer_bundle_match_real_files(self):
        folder = ROOT / 'assets/plates/two-passports'
        sidecar = load('assets/plates/two-passports/plates.json')
        self.assertIn('simplified illustrations', sidecar['note'])
        self.assertIn('absent', sidecar['paper_substitution'])
        self.assertEqual(sidecar['credits'], 0)
        bundle = load('apps/renderer/src/engine/kit/passport-plates.json')
        self.assertEqual(set(bundle), {'paper', 'guilloche', 'rosette', 'usa', 'china'})
        for name, meta in sidecar['files'].items():
            content = (folder / name).read_bytes()
            self.assertEqual(hashlib.sha256(content).hexdigest(), meta['sha256'])
            self.assertEqual(base64.b64decode(bundle[meta['role']].split(',', 1)[1]), content)
        for name, digest in sidecar['reference_sha256'].items():
            source = ROOT / 'docs/ve/design/formats/ref/P/tools' / name
            self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(), digest)

    def test_device_clock_and_colour_boundaries(self):
        folder = ROOT / 'apps/renderer/src/engine/devices/passport_page'
        for path in folder.glob('*.ts*'):
            if '.test.' in path.name:
                continue
            source = path.read_text(encoding='utf-8')
            self.assertNotIn('useCurrentFrame', source)
            self.assertNotIn('Math.random', source)
            self.assertNotRegex(source, r'#[0-9a-fA-F]{3,8}\b')
            self.assertNotIn('<table', source)
            self.assertNotRegex(source, r'fontSize:\s*(?:[0-9]|[12][0-9])\b')


if __name__ == '__main__':
    unittest.main()
