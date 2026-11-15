"""Synthetic library contract tests. No brand-kit reads or writes."""
import copy
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from contextlib import redirect_stdout, redirect_stderr
from unittest.mock import patch

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from velib import character_library as lib


class LibraryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.library = self.root / 'library'
        (self.library / 'poses').mkdir(parents=True)
        self.manifest = copy.deepcopy(lib._load(lib.MANIFEST))
        self.manifest['library'] = {'built': True, 'poses': ['neutral', 'point-up-left']}
        self.manifest_path = self.root / 'manifest.json'
        self.save_manifest()
        self.patcher = patch.object(lib, 'MANIFEST', self.manifest_path)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)
        self.base = np.zeros((1036, 1024, 4), dtype=np.uint8)
        self.base[100:1036, 200:800] = [60, 80, 100, 255]
        for pose in self.manifest['library']['poses']:
            self.write(pose, 'closed', self.base)
            mouth = self.base.copy()
            mouth[400:420, 450:490, 0] += 9
            self.write(pose, 'open', mouth)
            eyes = self.base.copy()
            eyes[200:210, 420:520, 1] += 9
            self.write(pose, 'blink', eyes)

    def save_manifest(self):
        self.manifest_path.write_text(json.dumps(self.manifest), encoding='utf-8')

    def write(self, pose, state, array):
        Image.fromarray(array).save(self.library / 'poses' / f'{pose}-{state}.png')

    def snapshot(self):
        return {str(p.relative_to(self.library)): hashlib.sha256(p.read_bytes()).hexdigest()
                for p in self.library.rglob('*') if p.is_file()}

    def test_pixel_measurements_and_no_source_changes(self):
        before = self.snapshot()
        measured = lib.index(self.library)
        row = measured['poses']['neutral']
        self.assertEqual(row['opaque_box'], [200, 100, 800, 1036])
        self.assertEqual(row['mouth_box'], [450, 400, 490, 420])
        self.assertEqual(row['eye_box'], [420, 200, 520, 210])
        self.assertEqual(row['states']['closed']['size'], [1024, 1036])
        book = next(p for p in lib._load(lib.POSES)['poses'] if p['id'] == 'neutral')
        for key in ('family', 'side', 'use_when'):
            self.assertEqual(row[key], book.get(key))
        self.assertTrue(lib.check(self.library)['ok'])
        staged = lib.stage(measured, ['neutral'], self.root / 'assets')
        self.assertEqual(set(staged), {'neutral'})
        targets = list((self.root / 'assets/character').iterdir())
        self.assertEqual(len(targets), 3)
        for state in lib.STATES:
            self.assertEqual(lib._hash(staged['neutral'][state]), row['states'][state]['sha256'])
        self.assertEqual(before, self.snapshot())

    def test_missing_and_invalid_images(self):
        path = self.library / 'poses/neutral-open.png'
        original = path.read_bytes()
        path.unlink()
        self.assertFalse(lib.check(self.library)['ok'])
        for image in (Image.new('RGBA', (32, 32)), Image.new('RGB', (1024, 1036))):
            image.save(path)
            self.assertFalse(lib.check(self.library)['ok'])
        path.write_bytes(b'not an image')
        self.assertFalse(lib.check(self.library)['ok'])
        path.write_bytes(original)
        self.assertTrue(lib.check(self.library)['ok'])

    def test_identical_and_threshold(self):
        for state in ('open', 'blink'):
            with self.subTest(state=state):
                original = (self.library / f'poses/neutral-{state}.png').read_bytes()
                self.write('neutral', state, self.base)
                self.assertFalse(lib.check(self.library)['ok'])
                small = self.base.copy()
                small[400, 400, 0] += 8
                self.write('neutral', state, small)
                self.assertFalse(lib.check(self.library)['ok'])
                (self.library / f'poses/neutral-{state}.png').write_bytes(original)

    def test_change_box_limits(self):
        for state, width, height in (('open', 320, 220), ('blink', 420, 200)):
            for w, h, expected in ((width, height, True), (width + 1, height, False),
                                    (width, height + 1, False)):
                with self.subTest(state=state, w=w, h=h):
                    changed = self.base.copy()
                    changed[300:300+h, 300:300+w, 0] += 9
                    self.write('neutral', state, changed)
                    self.assertEqual(lib.check(self.library)['ok'], expected)
            # Restore a valid variant for the next iteration.
            changed = self.base.copy()
            changed[400:410, 400:410, 0] += 9
            self.write('neutral', state, changed)

    def test_edges_in_every_state(self):
        for state in lib.STATES:
            path = self.library / f'poses/neutral-{state}.png'
            original = path.read_bytes()
            for y, x in ((200, 0), (200, 1023), (0, 300)):
                bad = np.array(Image.open(path).convert('RGBA'))
                bad[y, x] = [60, 80, 100, 255]
                self.write('neutral', state, bad)
                self.assertTrue(any('edge' in e for e in lib.check(self.library)['errors']))
                path.write_bytes(original)

    def test_allow_empty_only_for_missing(self):
        self.assertTrue(lib.check(self.root / 'absent', allow_empty=True)['ok'])
        self.assertFalse(lib.check(self.root / 'absent')['ok'])
        self.assertFalse(lib.check(self.root, allow_empty=True)['ok'])

    def test_stage_refuses_unknown_stale_and_source_output(self):
        measured = lib.index(self.library)
        with self.assertRaises(ValueError):
            lib.stage(measured, ['neutral', 'unknown'], self.root / 'assets')
        self.assertFalse((self.root / 'assets').exists())
        with self.assertRaises(ValueError):
            lib.stage(measured, ['neutral'], self.library)
        self.write('neutral', 'open', self.base)
        with self.assertRaises(ValueError):
            lib.stage(measured, ['neutral'], self.root / 'assets')

    def test_default_and_pose_catalogue(self):
        with patch.dict(os.environ, {'MINDMAKE_LIBRARY_ROOT': str(self.root)}):
            self.assertEqual(lib.library_dir(), self.root / self.manifest['home']['folder'])
        catalogue = lib.poses()
        self.assertEqual(len(catalogue), 65)
        self.assertEqual({p['id'] for p in catalogue if p['built']}, {'neutral', 'point-up-left'})

    def test_cli_and_explicit_report_only(self):
        before = self.snapshot()
        out = self.root / 'check.json'
        with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
            self.assertEqual(lib.main(['check', '--library', str(self.library), '--out', str(out)]), 0)
            self.assertEqual(lib.main(['index', '--library', str(self.library)]), 0)
            self.assertEqual(lib.main(['poses']), 0)
            self.assertEqual(lib.main(['check', '--library', str(self.library), '--out',
                                       str(self.library / 'check.json')]), 1)
        self.assertTrue(json.loads(out.read_text())['ok'])
        self.assertEqual(before, self.snapshot())

    def test_every_entry_point_requires_approval(self):
        measured = lib.index(self.library)
        self.manifest['approved'] = False
        self.save_manifest()
        for call in (lib.library_dir, lib.poses, lambda: lib.index(self.library),
                     lambda: lib.check(self.root / 'missing', allow_empty=True),
                     lambda: lib.stage(measured, ['neutral'], self.root / 'assets')):
            with self.assertRaisesRegex(ValueError, 'approved'):
                call()
        with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
            for args in (['poses'], ['index', '--library', str(self.library)],
                         ['check', '--library', str(self.root / 'missing'), '--allow-empty']):
                self.assertEqual(lib.main(args), 1)


if __name__ == '__main__':
    unittest.main()
