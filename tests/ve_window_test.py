"""WINDOW table and compiler handoff acceptance."""
import json
from pathlib import Path
import sys
import unittest
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import qc
from velib.compile import compile_cut

class WindowTests(unittest.TestCase):
    def test_renderer_tables(self):
        for aspect in ['9:16', '16:9']:
            self.assertIn('WINDOW', qc._renderer_layouts()[aspect])

    def test_compile(self):
        folder = ROOT / 'fixtures/ve/my-test-19s'
        spec = json.loads((folder / 'spec.json').read_text())
        words = [dict(w, end_s=w['onset_s'] + .2) for w in json.loads((folder / 'words.frames.json').read_text())]
        beat = spec['cuts']['proof-tall']['beats'][0]
        beat.update(layout='WINDOW', face='off')
        props = compile_cut(spec, 'proof-tall', words, folder)
        self.assertEqual(props['beats'][0]['layout'], 'WINDOW')
        self.assertEqual(props['beats'][0]['face'], 'off')

if __name__ == '__main__':
    unittest.main()
