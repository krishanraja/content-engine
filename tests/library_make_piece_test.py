"""scripts/library/make_piece.py: a piece's facts become a Library pack, the outputs take post-pack's names, and the
retired cover drawer refuses without --legacy. No browser: the renderer itself is exercised by the Library's gates."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'scripts' / 'library'), str(ROOT / 'scripts' / 'post-pack')]
import make_piece  # noqa: E402

FRIDAY = ROOT / 'docs' / 'plans' / '2026-11-13-friday'


def post_pack_build():
    """scripts/post-pack/build.py by its path (scripts/pages has a build.py too)."""
    import importlib.util
    spec = importlib.util.spec_from_file_location('post_pack_build', ROOT / 'scripts' / 'post-pack' / 'build.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def library_items():
    data = json.loads((make_piece.LIBRARY / 'library.json').read_text(encoding='utf-8'))
    return {item['id']: item for item in data['items'] if item.get('status') != 'retired'}


class PackTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.out = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_covers_pack_from_a_real_piece(self):
        pack, outputs, extra = make_piece.build_pack(FRIDAY / 'cover-facts.json', 'covers', self.out)
        facts = json.loads((FRIDAY / 'cover-facts.json').read_text(encoding='utf-8'))
        self.assertEqual(sorted(pack['content']), sorted(t for t, _, _ in make_piece.COVERS.values()))
        for template, content in pack['content'].items():
            # His cover line runs 48 characters against the Receipt's 44, so each template takes his thumbnail hook,
            # which he also wrote, and never a cut version of his words.
            self.assertEqual(content['headline_1'], '\n'.join(facts['thumbs']['headline']), template)
            self.assertEqual(extra['headlines'][template], 'thumbs.headline')
            # Rows first, then the strip, three at most: Meta, Amazon, then Shopify from the strip.
            self.assertEqual(content['logos'], ['piece-meta', 'piece-amazon', 'piece-shopify'])
            # No row carries a tag, so no verdict chip is drawn (never the template's sample words).
            self.assertEqual([content[f'chip_{n}'] for n in (1, 2, 3)], [None, None, None])
        for key, logo in pack['evidence']['tool_logos'].items():
            self.assertTrue((self.out / logo['src']).resolve().is_file(), key)
        self.assertEqual(extra['logos'], ['Meta', 'Amazon', 'Shopify'])
        self.assertEqual(extra['proof']['source'], 's1')
        self.assertEqual([name for _, name in outputs], [name for _, name, _ in make_piece.COVERS.values()])

    def test_video_pack_uses_the_thumbnail_words(self):
        pack, outputs, _ = make_piece.build_pack(FRIDAY / 'cover-facts.json', 'video', self.out)
        self.assertEqual(pack['content']['cover-receipt-youtube']['headline_1'], 'THEY FAKED\nAI USE')
        self.assertEqual([name for _, name in outputs], ['thumbs/thumb-wide-1280x720.jpg', 'thumbs/thumb-tall-1080x1920.jpg'])

    def test_a_shorter_headline_from_the_piece(self):
        facts = json.loads((FRIDAY / 'cover-facts.json').read_text(encoding='utf-8'))
        facts['library'] = {'headline': ['Ranked by AI use.', 'They gamed it.']}
        piece = self.out / 'piece'
        piece.mkdir()
        (piece / 'logos').mkdir()
        for row in facts['cover']['rows'] + facts['cover']['strip']:
            (piece / row['logo']).write_bytes((FRIDAY / row['logo']).read_bytes())
        (piece / 'cover-facts.json').write_text(json.dumps(facts), encoding='utf-8')
        pack, _, extra = make_piece.build_pack(piece / 'cover-facts.json', 'covers', self.out)
        self.assertEqual(pack['content']['social-square']['headline_1'], 'Ranked by AI use.\nThey gamed it.')
        self.assertEqual(extra['headlines']['social-square'], 'library.headline')
        # When none of his lines fits, it refuses and names them; it never shortens one.
        for key in ('library', 'thumbs'):
            facts.pop(key, None)
        facts['headline'] = facts['cover']['headline'] = ['Meta staff were ranked by how much AI they used.', 'They gamed it.']
        (piece / 'cover-facts.json').write_text(json.dumps(facts), encoding='utf-8')
        with self.assertRaisesRegex(make_piece.PieceError, 'no approved line fits'):
            make_piece.build_pack(piece / 'cover-facts.json', 'covers', self.out)

    def test_refusals_in_plain_words(self):
        with self.assertRaisesRegex(make_piece.PieceError, 'no carousel set'):
            make_piece.build_pack(FRIDAY / 'cover-facts.json', 'nonsense', self.out)
        # A carousel set never borrows the template's words or another story's data.
        with self.assertRaisesRegex(make_piece.PieceError, 'needs its headline_1 from the piece'):
            make_piece.build_pack(FRIDAY / 'cover-facts.json', 'good-news', self.out)
        with self.assertRaisesRegex(make_piece.PieceError, "sample data"):
            make_piece.build_pack(FRIDAY / 'cover-facts.json', 'piece', self.out)
        with self.assertRaisesRegex(make_piece.PieceError, 'no cover facts'):
            make_piece.facts_path(self.out / 'missing')


class PostPackNamesTest(unittest.TestCase):
    def test_covers_match_post_pack_and_the_templates(self):
        post_pack = post_pack_build()
        items = library_items()
        expected = {kind: (file, size) for kind, file, size in post_pack.COVER_SET}
        for kind, (template, file, size) in make_piece.COVERS.items():
            self.assertIn(template, items)
            self.assertEqual((items[template]['width'], items[template]['height']), size, template)
            if kind == 'cover':
                self.assertEqual(file, 'cover.png')
            else:
                self.assertEqual((file, size), expected[kind], kind)
        self.assertEqual(set(make_piece.COVERS) - {'cover'}, set(expected))

    def test_thumbnails_match_post_pack(self):
        post_pack = post_pack_build()
        items = library_items()
        for shape, (template, file, size) in make_piece.THUMBS.items():
            self.assertEqual((items[template]['width'], items[template]['height']), size)
            self.assertEqual(size, post_pack.THUMB_SIZE[shape])
            self.assertIn(file, ('thumb-wide-1280x720.jpg', 'thumb-tall-1080x1920.jpg'))

    def test_written_files_pass_post_pack_and_the_visual_gate(self):
        from PIL import Image
        post_pack = post_pack_build()
        import visual_gate
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            rendered = tmp / 'render' / 'items'
            rendered.mkdir(parents=True)
            for template, _, size in list(make_piece.COVERS.values()) + list(make_piece.THUMBS.values()):
                Image.new('RGB', size, (12, 21, 18)).save(rendered / f'{template}.png')
            out = tmp / 'out'
            extra = {'proof': {'page': 'https://example.com/a', 'source': 's1', 'tag': 'X'}, 'logos': ['Meta']}
            covers = make_piece.copy_outputs(tmp / 'render', [(t, n) for t, n, _ in make_piece.COVERS.values()],
                                             out, 'covers', extra, 'abc')
            make_piece.copy_outputs(tmp / 'render', [(t, 'thumbs/' + n) for t, n, _ in make_piece.THUMBS.values()],
                                    out, 'video', extra, 'abc')
            planned = [{'kind': 'cover', 'source': out / 'cover.png', 'logos': ['Meta']}]
            post_pack.cover_set_or_refuse(planned)
            self.assertEqual(sorted(p['kind'] for p in planned), sorted(make_piece.COVERS))
            for path in covers:
                record = json.loads(path.with_suffix('.json').read_text(encoding='utf-8'))
                self.assertEqual(record['sha256'], make_piece.sha256_of(path))
                self.assertIsNone(visual_gate.not_receipt(record))
            thumbs = json.loads((out / 'thumbs' / 'thumbs.json').read_text(encoding='utf-8'))
            self.assertEqual([f['shape'] for f in thumbs['files']], ['wide', 'tall'])
            self.assertIsNone(visual_gate.not_receipt(thumbs))
            entries = make_piece.post_pack_entries('video', [], out, ['Meta'])
            self.assertEqual([e['file'] for e in entries], ['thumbs/thumb-wide-1280x720.jpg', 'thumbs/thumb-tall-1080x1920.jpg'])

    def test_the_gate_refuses_an_incomplete_library_record(self):
        import visual_gate
        good = {'template': 'library', 'library_item': 'social-square', 'pack': 'abc', 'portrait': False,
                'proof': {'page': 'https://example.com/a'}, 'skin': None}
        self.assertIsNone(visual_gate.not_receipt(good))
        self.assertIn('proof', visual_gate.not_receipt(good | {'proof': {}}))
        self.assertIn('face', visual_gate.not_receipt(good | {'portrait': True}))
        self.assertIn('retired', visual_gate.not_receipt(good | {'skin': 'v5_feed'}))
        self.assertIn('Library template', visual_gate.not_receipt(good | {'library_item': None}))


class WordmarkGroundTest(unittest.TestCase):
    """STANDARD 6 as the ink gate reads it: cream or mint on ink, ink tone on a rung or answer field, never cream on colour."""

    def check(self, ground, mark):
        sys.path.insert(0, str(make_piece.LIBRARY))
        from PIL import Image
        from pixel_alignment import wordmark_ground_ok
        back = Image.new('RGB', (40, 20), ground)
        drawn = back.copy()
        drawn.paste(mark, (5, 5, 35, 15))
        return wordmark_ground_ok(back, drawn)

    def test_the_rule(self):
        ink, cream, mint, coral, lilac = (12, 21, 18), (244, 239, 228), (126, 240, 192), (255, 106, 77), (183, 166, 255)
        self.assertTrue(self.check(ink, cream))
        self.assertTrue(self.check(ink, mint))
        self.assertTrue(self.check(coral, ink))
        self.assertTrue(self.check(lilac, ink))
        self.assertTrue(self.check(mint, ink))
        self.assertFalse(self.check(coral, cream))
        self.assertFalse(self.check((90, 90, 90), cream))


class RetirementRefusalTest(unittest.TestCase):
    def test_the_old_drawer_refuses_without_legacy(self):
        with tempfile.TemporaryDirectory() as tmp:
            done = subprocess.run([sys.executable, str(ROOT / 'scripts' / 'pages' / 'build.py'), str(FRIDAY / 'cover-facts.json'),
                                   '--cover', '--out', tmp], capture_output=True, text=True, encoding='utf-8')
        self.assertNotEqual(done.returncode, 0)
        self.assertIn('make_piece.py', done.stderr)
        self.assertIn('--legacy', done.stderr)

    def test_legacy_is_only_for_the_drawer(self):
        done = subprocess.run([sys.executable, str(ROOT / 'scripts' / 'pages' / 'build.py'), str(FRIDAY / 'cover-facts.json'),
                               '--legacy'], capture_output=True, text=True, encoding='utf-8')
        self.assertNotEqual(done.returncode, 0)
        self.assertIn('--legacy only applies', done.stderr)

    def test_the_skins_refuse_in_code(self):
        sys.path.insert(0, str(ROOT / 'scripts' / 'pages'))
        import skins
        with patch.object(skins, 'LEGACY', False), self.assertRaisesRegex(SystemExit, 'retired'):
            skins.pick({}, {})
        retired = {(row['kind'], row['id']) for row in json.loads((ROOT / 'config' / 'retired-styles.json').read_text(encoding='utf-8'))}
        self.assertIn(('skin', 'v5_feed'), retired)
        self.assertIn(('cover_path', 'receipt'), retired)


if __name__ == '__main__':
    unittest.main()
