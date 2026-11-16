"""The style and caption lab (velib.lab; Krish, 4 Nov 2026: "experiment carefully"): every look on one window of his
pinned take, outside any piece; the same reel as the engine's regression check; his words through the one verdict
writer, where a lab pick makes a style liked, never tested. Renderer mocked; no media."""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
sys.path.insert(0, str(ROOT / 'scripts' / 'quick-edit'))
from velib import lab  # noqa: E402
import archive  # noqa: E402
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
        self.assertEqual(len([l for l in looks if l['kind'] == 'style']), 14)  # +3 from his own cuts, 13 Nov 2026

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

    def test_a_caption_style_is_drawn_only_when_named_so_the_regression_reel_never_grows(self):
        plain = [look['id'] for look in lab.looks(self.cfg)]
        self.assertFalse(any(i.startswith('theme-') for i in plain))
        seen = []
        manifest = lab.render(self.cfg, self.dir / 'a', self.fake_render(seen), self.dir / 'themes', only=['theme-art-directed'])
        self.assertEqual([look['id'] for look in manifest['looks']], ['theme-art-directed'])
        self.assertEqual(seen[0]['captionTheme'], 'art-directed')

    def test_a_sample_of_his_take_is_never_recorded_for_the_board(self):
        # Every lab render is a cut of his pinned take, and a cut of his recordings is never an example on the board
        # (Krish, 2026-11-16: "Please don't tell me this is going on the board as an example or a gold standard template").
        samples = self.dir / 'style-samples.json'
        samples.write_text(json.dumps({'motion': {'paper-cutout': ''}, 'captions': {'art-directed': ''}, 'drive': {'motion': {}, 'captions': {}},
                                       'waiting': {'motion': {'paper-cutout': 'the lab render'}, 'captions': {'art-directed': 'the lab render'}}}))
        before = samples.read_text()
        drive_id = '1' + 'S' * 30
        lab.render(self.cfg, self.dir / 'a', self.fake_render([]), self.dir / 'clips', only=['paper-cutout', 'theme-art-directed'])
        for bad in (lambda: lab.record_sample('motion', 'paper-cutout', drive_id, self.dir / 'clips' / 'paper-cutout.mp4', path=samples),
                    lambda: lab.record_sample('captions', 'art-directed', drive_id, self.dir / 'clips' / 'theme-art-directed.mp4', path=samples),
                    lambda: lab.record_sample('motion', 'paper-cutout', 'short', path=samples)):
            with self.assertRaises(ValueError):
                bad()
        self.assertEqual(samples.read_text(), before, 'a refusal writes nothing')

    def test_every_waiting_sample_is_a_look_the_lab_draws_and_every_value_is_its_drive_route(self):
        doc = json.loads(lab.STYLE_SAMPLES.read_text(encoding='utf-8'))
        drawable = {look['id'] for look in lab.looks(self.cfg) if look['kind'] == 'style'}
        self.assertEqual(set(doc['motion']) - drawable, set())
        self.assertEqual(set(doc['captions']) - set(lab.caption_themes()), set())
        for layer in ('motion', 'captions'):
            for style_id, value in doc[layer].items():
                self.assertIsInstance(value, str)
                if value:
                    self.assertEqual(value, f"/api/board/sign-offs?file={doc['drive'][layer][style_id]}")
                else:
                    self.assertIn(style_id, doc['waiting'][layer], f'{layer} {style_id}: an empty value says which render waits')

    # Stills (Krish, 16 Nov 2026: "hover over the captions, look, and motion style and see a templated screenshot of what
    # it might look like. No need for a video, just a still.")

    def fake_grab(self, seen):
        def grab(clip, frame, target):
            seen.append((Path(clip).name, frame))
            Path(target).write_bytes(archive.jpeg_header(540, 960))
            return Path(target)
        return grab

    def test_the_still_frame_shows_a_settled_caption_and_a_settled_device_on_the_pinned_take(self):
        props = json.loads((ROOT / self.cfg['piece_dir'] / f"props.{self.cfg['cut']}.json").read_text(encoding='utf-8'))
        at = lab.STILL_FRAME
        start, end = self.cfg['window']
        self.assertTrue(start <= at < end)
        self.assertEqual(lab.still_frame(self.cfg), at - start)
        page = next(p for p in props['captions'] if p['fromFrame'] <= at < p['toFrame'])
        self.assertGreaterEqual(at - page['fromFrame'], 15, 'every caption style has finished its entrance')
        objects = [o for o in props['objects'] if o['fromFrame'] <= at < o['toFrame']]
        self.assertTrue(objects, 'a device is on screen for every motion style to draw')
        events = [e['atFrame'] for e in props['events'] if any(e['obj'] == o['obj'] for o in objects)]
        self.assertTrue(all(f <= at - 10 or f > at for f in events), 'no device is mid-entrance or mid-draw (10 frames)')
        beat = next(b for b in props['beats'] if b['fromFrame'] <= at < b['toFrame'])
        self.assertGreaterEqual(min(at - beat['fromFrame'], beat['toFrame'] - at), 10, 'no cut or transition is near')
        with self.assertRaises(ValueError):
            lab.still_frame({**self.cfg, 'window': [0, 240]})

    def test_stills_cut_one_still_per_style_and_caption_style_at_the_one_frame(self):
        lab.render(self.cfg, self.dir / 'a', self.fake_render([]), self.dir / 'out', only=['house', 'paper-cutout', 'theme-art-directed'])
        seen = []
        doc = lab.stills(self.dir / 'out', cfg=self.cfg, grab_fn=self.fake_grab(seen))
        self.assertEqual(seen, [('theme-art-directed.mp4', 130), ('paper-cutout.mp4', 130)], 'the house has no still; one frame for all')
        self.assertEqual([(r['layer'], r['id']) for r in doc['stills']], [('captions', 'art-directed'), ('motion', 'paper-cutout')])
        for row in doc['stills']:
            self.assertLessEqual({'id', 'layer', 'path', 'sha256', 'width', 'height'}, set(row))
            self.assertEqual((row['width'], row['height']), (540, 960))
            self.assertEqual(row['sha256'], lab.sha256_file(row['path']))
            self.assertEqual(Path(row['path']).parent, (self.dir / 'out' / 'stills').resolve())
        self.assertEqual((doc['frame'], doc['clip_frame'], doc['window']), (lab.STILL_FRAME, 130, [315, 555]))
        self.assertEqual(json.loads((self.dir / 'out' / 'stills' / 'stills.json').read_text()), doc)
        narrowed = lab.stills(self.dir / 'out', only=['theme-art-directed'], cfg=self.cfg, grab_fn=self.fake_grab([]))
        self.assertEqual([r['id'] for r in narrowed['stills']], ['art-directed'])
        for bad in (lambda: lab.stills(self.dir / 'out', only=['data-story'], cfg=self.cfg, grab_fn=self.fake_grab([])),
                    lambda: lab.stills(self.dir / 'nothing', cfg=self.cfg, grab_fn=self.fake_grab([])),
                    lambda: lab.stills(self.dir / 'out', only=['house'], cfg=self.cfg, grab_fn=self.fake_grab([])),
                    lambda: lab.stills(self.dir / 'out', cfg={**self.cfg, 'window': [300, 540]}, grab_fn=self.fake_grab([]))):
            with self.assertRaises(ValueError):
                bad()
        with self.assertRaises(ValueError):
            lab.stills_dir(ROOT / 'docs' / 've' / 'lab')
        self.assertTrue(str(lab.stills_dir(ROOT / '.cache' / 've' / 'lab' / 'x')).startswith(str((ROOT / '.cache').resolve())))

    @unittest.skipUnless(shutil.which('ffmpeg'), 'ffmpeg is not on PATH')
    def test_grab_takes_the_frame_by_its_number_as_a_540x960_jpeg(self):
        from PIL import Image  # noqa: PLC0415
        clip = self.dir / 'frames.mkv'
        # six 9:16 frames whose brightness is their number times 40: frame 3 is 120, its neighbours 80 and 160
        subprocess.run([shutil.which('ffmpeg'), '-nostdin', '-v', 'error', '-y', '-f', 'lavfi', '-i',
                        "nullsrc=s=36x64:r=30:d=0.2,format=yuv420p,geq=lum='N*40':cb=128:cr=128", '-c:v', 'ffv1', str(clip)], check=True)
        jpg = lab.grab(clip, 3, self.dir / 'still.jpg')
        self.assertEqual(lab.jpeg_size(jpg), (540, 960))
        self.assertTrue(100 < Image.open(jpg).convert('L').getpixel((270, 480)) < 140)
        with self.assertRaises(ValueError):
            lab.grab(clip, 99, self.dir / 'none.jpg')

    def test_a_still_is_recorded_as_the_drive_route_by_layer_and_refused_when_it_is_not_one(self):
        samples = self.dir / 'style-samples.json'
        samples.write_text(json.dumps({'motion': {'paper-cutout': ''}, 'drive': {'motion': {}, 'captions': {}},
                                       'stills': {'treatment': {'face-with-proof': ''}, 'motion': {'paper-cutout': ''}, 'captions': {'art-directed': ''}},
                                       'stills_drive': {'treatment': {}, 'motion': {}, 'captions': {}}}))
        drive_id = '1' + 'T' * 30
        lab.render(self.cfg, self.dir / 'a', self.fake_render([]), self.dir / 'out', only=['paper-cutout', 'data-story', 'theme-art-directed'])
        lab.stills(self.dir / 'out', cfg=self.cfg, grab_fn=self.fake_grab([]))
        stills = self.dir / 'out' / 'stills'
        # A frame of his take is never a board still (Krish, 2026-11-16): the take's stills are refused.
        with self.assertRaises(ValueError) as caught:
            lab.record_still('motion', 'paper-cutout', drive_id, stills / 'motion-paper-cutout.jpg', path=samples)
        self.assertIn('never a frame of his recordings', str(caught.exception))
        # The neutral StyleStill template's stills are recorded.
        made = json.loads((stills / lab.STILLS_MANIFEST).read_text())
        made.pop('take_sha256'); made['source'] = 'template'
        (stills / lab.STILLS_MANIFEST).write_text(json.dumps(made))
        plate = self.dir / 'plate.jpg'
        plate.write_bytes(archive.jpeg_header(540, 960))
        lab.record_still('treatment', 'face-with-proof', drive_id, plate, path=samples)
        lab.record_still('motion', 'paper-cutout', drive_id, stills / 'motion-paper-cutout.jpg', path=samples)
        doc = lab.record_still('captions', 'art-directed', drive_id, stills / 'captions-art-directed.jpg', path=samples)
        route = f'/api/board/sign-offs?file={drive_id}'
        self.assertEqual(doc['stills'], {'treatment': {'face-with-proof': route}, 'motion': {'paper-cutout': route},
                                         'captions': {'art-directed': route}})
        self.assertEqual(doc['stills_drive'], {'treatment': {'face-with-proof': drive_id}, 'motion': {'paper-cutout': drive_id},
                                               'captions': {'art-directed': drive_id}})
        self.assertEqual(doc['motion'], {'paper-cutout': ''}, 'a still never writes a sample')
        self.assertEqual(doc['drive'], {'motion': {}, 'captions': {}})
        png = self.dir / 'plate.png'
        png.write_bytes(b'\x89PNG\r\n\x1a\n' + b'\x00' * 32)
        wide = self.dir / 'wide.jpg'
        wide.write_bytes(archive.jpeg_header(1920, 1080))
        loose = self.dir / 'loose.jpg'
        loose.write_bytes(archive.jpeg_header(540, 960))
        for bad, says in ((lambda: lab.record_still('look', 'face-with-proof', drive_id, path=samples), 'layer'),
                          (lambda: lab.record_still('motion', 'ladder', drive_id, path=samples), 'needs_device'),
                          (lambda: lab.record_still('motion', 'no-such-style', drive_id, path=samples), 'draws'),
                          (lambda: lab.record_still('captions', 'no-such-caption', drive_id, path=samples), 'caption'),
                          (lambda: lab.record_still('captions', 'art-directed', drive_id, path=samples), '--file'),
                          (lambda: lab.record_still('motion', 'paper-cutout', drive_id, path=samples), '--file'),
                          (lambda: lab.record_still('treatment', 'no-such-look', drive_id, path=samples), 'formats.production'),
                          (lambda: lab.record_still('treatment', 'face-with-proof', 'short', path=samples), 'Drive file id'),
                          (lambda: lab.record_still('treatment', 'face-with-proof', drive_id, png, path=samples), 'not a JPEG'),
                          (lambda: lab.record_still('treatment', 'face-with-proof', drive_id, wide, path=samples), '1920x1080'),
                          (lambda: lab.record_still('motion', 'data-story', drive_id, stills / 'motion-paper-cutout.jpg', path=samples), 'still of'),
                          (lambda: lab.record_still('motion', 'paper-cutout', drive_id, loose, path=samples), 'still of')):
            with self.assertRaises(ValueError) as caught:
                bad()
            self.assertIn(says, str(caught.exception))
        self.assertEqual(json.loads(samples.read_text()), doc, 'a refusal writes nothing')

    def test_the_stills_maps_hold_every_look_drawable_style_and_caption_style(self):
        doc = json.loads(lab.STYLE_SAMPLES.read_text(encoding='utf-8'))
        drawable = {look['id'] for look in lab.looks(self.cfg) if look['kind'] == 'style'}
        self.assertEqual(set(doc['stills']), {'treatment', 'motion', 'captions'})
        self.assertEqual(list(doc['stills']['treatment']), lab.treatments())
        self.assertEqual(set(doc['stills']['motion']), drawable)
        self.assertEqual(list(doc['stills']['captions']), lab.caption_themes())
        self.assertEqual(set(doc['stills_drive']), {'treatment', 'motion', 'captions'})
        for layer, values in doc['stills'].items():
            for still_id, value in values.items():
                self.assertIsInstance(value, str)
                if value:
                    self.assertEqual(value, f"/api/board/sign-offs?file={doc['stills_drive'][layer][still_id]}")

    def test_the_command_refuses_stills_in_the_repository_and_a_still_with_no_device(self):
        ve = [sys.executable, str(ROOT / 'scripts' / 've.py'), 'lab']
        done = subprocess.run([*ve, 'stills', '--out', str(ROOT / 'docs' / 've' / 'lab' / 'stills-test')], capture_output=True, text=True)
        self.assertEqual(done.returncode, 1)
        self.assertIn('never in the repository', done.stderr)
        before = lab.STYLE_SAMPLES.read_bytes()
        done = subprocess.run([*ve, 'still', 'motion', 'ladder', '--drive', '1' + 'L' * 30], capture_output=True, text=True)
        self.assertEqual(done.returncode, 1)
        self.assertIn('needs_device', done.stderr)
        self.assertEqual(lab.STYLE_SAMPLES.read_bytes(), before)

    def test_the_marks_staged_are_the_ones_studio_pins(self):
        marks = lab.brand_marks()
        self.assertTrue(any(m['source_path'].endswith('makeyourmindup-mark.png') for m in marks))
        self.assertTrue(all(len(m['sha256']) == 64 for m in marks))


if __name__ == '__main__':
    unittest.main(verbosity=1)
