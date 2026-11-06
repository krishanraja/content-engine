"""The style and caption lab (velib.lab; Krish, 4 Nov 2026: "experiment carefully"): every look on one window of his
pinned take, outside any piece; the same reel as the engine's regression check; his words through the one verdict
writer, where a lab pick makes a style liked, never tested. Renderer mocked; no media."""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
from velib import lab  # noqa: E402
import creative_direction  # noqa: E402


class LabTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='ve-lab-')
        self.addCleanup(self.temp.cleanup)
        self.dir = Path(self.temp.name)
        self.cfg = lab.config()

    def fake_render(self, seen):
        def render(props_path, out):
            props = json.loads(Path(props_path).read_text())
            seen.append(props)
            Path(out).write_bytes(json.dumps({'motion': props.get('motion'), 'captions': props.get('captionStyle')}).encode())
        return render

    def test_every_look_is_the_house_each_caption_look_and_each_drawable_style(self):
        looks = lab.looks(self.cfg)
        ids = [look['id'] for look in looks]
        self.assertEqual(ids[0], 'house')
        self.assertIn('captions-word', ids)
        self.assertIn('paper-cutout', ids)
        self.assertIn('full-visual', ids)  # keyframes@0.2.13, drawable from 6 Nov 2026
        self.assertEqual(len([l for l in looks if l['kind'] == 'style']), 11)

    def test_render_draws_each_look_on_the_pinned_window_and_writes_a_manifest(self):
        seen = []
        manifest = lab.render(self.cfg, self.dir / 'assets', self.fake_render(seen), self.dir / 'out')
        self.assertEqual(len(manifest['looks']), len(lab.looks(self.cfg)))
        self.assertEqual(manifest['window'], [315, 555])
        self.assertEqual(manifest['take_sha256'], self.cfg['take']['sha256'])
        house = seen[0]
        self.assertNotIn('motion', house)
        self.assertEqual(house['durationFrames'], 240)
        self.assertTrue(all((self.dir / 'assets').resolve().as_posix() in s['src'] for s in house['segments']),
                        'media points at the staged assets, never the old session cache')
        word = next(p for p, l in zip(seen, manifest['looks']) if l['id'] == 'captions-word')
        self.assertEqual(word['captionStyle'], 'word')
        paper = next(p for p, l in zip(seen, manifest['looks']) if l['id'] == 'paper-cutout')
        self.assertEqual(paper['motion']['style'], 'paper-cutout')
        # Thursday's house look already uses word captions: the same picture is recorded once more, shown once.
        self.assertIn('captions: word', manifest['looks'][0]['title'])
        self.assertEqual(next(l for l in manifest['looks'] if l['id'] == 'captions-word').get('same_as'), 'house')
        self.assertNotIn('same_as', next(l for l in manifest['looks'] if l['id'] == 'captions-house'))
        labels = [look['label'] for look in lab.shown_looks(manifest)]
        self.assertEqual(labels[:2], ['1. House look (captions: word)', '2. Captions: house'])
        self.assertEqual(len(labels), len(manifest['looks']) - 1, 'the twin is shown once')

    def test_diff_names_a_moved_house_as_the_regression(self):
        lab.render(self.cfg, self.dir / 'a', self.fake_render([]), self.dir / 'before', only=['house', 'data-story'])
        lab.render(self.cfg, self.dir / 'a', self.fake_render([]), self.dir / 'after', only=['house', 'data-story'])
        same = lab.diff(self.dir / 'after', self.dir / 'before', sample=lambda clip: [b'x'])
        self.assertFalse(same['house_moved'])
        self.assertEqual({r['status'] for r in same['looks']}, {'same'})
        (self.dir / 'after' / 'house.mp4').write_bytes(b'another picture')
        manifest = json.loads((self.dir / 'after' / 'manifest.json').read_text())
        manifest['looks'][0]['sha256'] = 'f' * 64
        (self.dir / 'after' / 'manifest.json').write_text(json.dumps(manifest))
        frames = {'before': [bytes(64)], 'after': [bytes([255]) * 64]}
        moved = lab.diff(self.dir / 'after', self.dir / 'before', sample=lambda clip: frames[Path(clip).parent.name])
        self.assertTrue(moved['house_moved'])

    def test_a_lab_pick_makes_a_style_liked_never_tested(self):
        data = json.loads(creative_direction.STYLES.read_text(encoding='utf-8'))
        module = 'paper-cutout'
        once = creative_direction.style_verdict(data, module, 'picked', 'yes, that one', '2026-11-05', context='lab')
        twice = creative_direction.style_verdict(once, module, 'picked', 'still yes', '2026-11-06', context='lab')
        m = next(x for x in twice['bank'] if x['id'] == module)
        self.assertEqual(m['krish_verdict'], 'liked')
        self.assertEqual(m['verdicts'][-1]['context'], 'lab')
        on_piece = creative_direction.style_verdict(twice, module, 'picked', 'yes', '2026-11-07')
        on_piece = creative_direction.style_verdict(on_piece, module, 'picked', 'yes again', '2026-11-08')
        self.assertEqual(next(x for x in on_piece['bank'] if x['id'] == module)['krish_verdict'], 'tested')
        with self.assertRaises(creative_direction.DirectionError):
            creative_direction.style_verdict(data, module, 'picked', '', '2026-11-05', context='lab')

    def test_the_marks_staged_are_the_ones_studio_pins(self):
        marks = lab.brand_marks()
        self.assertTrue(any(m['source_path'].endswith('makeyourmindup-mark.png') for m in marks))
        self.assertTrue(all(len(m['sha256']) == 64 for m in marks))


if __name__ == '__main__':
    unittest.main(verbosity=1)
