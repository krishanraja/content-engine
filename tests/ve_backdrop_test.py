"""A beat's backdrop: one real picture under its graphics (Krish, 2026-11-18: "making actual use of the full screen
when it isn't my face"). compile resolves it from the spec's assets and refuses anything it cannot vouch for."""
from __future__ import annotations

import hashlib
import sys
import tempfile
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from velib.compile import backdrop  # noqa: E402


class BackdropTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.assets = Path(self.temp.name)
        (self.assets / 'plates').mkdir()
        self.file = self.assets / 'plates' / 'scene.png'
        self.file.write_bytes(b'scene')
        self.sha = hashlib.sha256(b'scene').hexdigest()

    def spec(self, **asset):
        base = {'id': 'scene', 'kind': 'illustration', 'origin': 'generated', 'path': 'plates/scene.png',
                'sha256': self.sha, 'licence': 'made for the piece', 'tool': 'codex image_generation', 'job_id': 'card-1'}
        return {'assets': [{**base, **asset}]}

    def test_a_staged_picture_resolves_inside_the_assets_folder(self):
        out = backdrop(self.spec(), {'id': 'b1', 'backdrop': 'asset:scene'}, self.assets)
        self.assertEqual(Path(out['src']), self.file.resolve())

    def test_refuses_an_unknown_asset_a_changed_file_and_a_non_picture(self):
        with self.assertRaises(ValueError):
            backdrop(self.spec(), {'id': 'b1', 'backdrop': 'asset:other'}, self.assets)
        with self.assertRaises(ValueError):
            backdrop(self.spec(sha256='0' * 64), {'id': 'b1', 'backdrop': 'asset:scene'}, self.assets)
        with self.assertRaises(ValueError):
            backdrop(self.spec(kind='music'), {'id': 'b1', 'backdrop': 'asset:scene'}, self.assets)

    def test_a_generated_scene_needs_the_tool_and_job_that_made_it(self):
        with self.assertRaises(ValueError):
            backdrop(self.spec(job_id=None), {'id': 'b1', 'backdrop': 'asset:scene'}, self.assets)


if __name__ == '__main__':
    unittest.main()
