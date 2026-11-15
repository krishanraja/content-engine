"""Thumbnail options with no browser and no network (docs/production/COVER-STANDARD.md, point 8, approved by Krish on
2026-11-09: "Two or three options, never one, each shown in a mock of his grid beside the last five posts").

scripts/pages/thumb_options.py's own self-test (the options, the brief, the grid mock, the verdict bound to the files'
sha256), then making.py's half on synthetic files: the set goes on the record by sha256 with the critic's verdict on
those bytes, his pick only with his words and only after the verdict, the one question on his list, and no cut
carrying an option's thumbnail until his pick names it. The drawing itself is tests/thumb_options_draw_test.py (the
browser job)."""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
sys.path.insert(0, str(ROOT / 'scripts' / 'pages'))
import thumb_options  # noqa: E402
sys.path.insert(1, str(ROOT / 'scripts' / 'post-pack'))
import making  # noqa: E402

PIECE = '904658db-4df2-4537-a0ed-ebe93e081db7'


def synthetic_set(out: Path, ids=('a', 'b')) -> dict:
    """A drawn set as build.py --thumbs --options leaves it, on plain pictures: each option's two files and its own
    thumbs.json, the grid mock, and thumb-options.json."""
    from PIL import Image
    tall, options = {}, []
    for n, oid in enumerate(ids):
        folder = out / 'options' / oid
        folder.mkdir(parents=True)
        files = []
        for shape, name in thumb_options.THUMB_FILES.items():
            size = (1280, 720) if shape == 'wide' else (1080, 1920)
            Image.new('RGB', size, (40 * n, 120, 90)).save(folder / name, 'JPEG')
            files.append({'shape': shape, 'file': f'options/{oid}/{name}', 'sha256': thumb_options.sha256_file(folder / name)})
        (folder / 'thumbs.json').write_text(json.dumps({'template': 'receipt', 'portrait': False, 'option': oid,
                                                         'files': [{'file': f['file'].split('/')[-1], 'shape': f['shape'], 'sha256': f['sha256']} for f in files]}))
        tall[oid] = folder / thumb_options.THUMB_FILES['tall']
        options.append({'id': oid, 'note': f'option {oid}', 'files': files})
    mock = thumb_options.draw_mock(out, tall, [])
    record = {'schema': 'thumb-options/1', 'piece_id': PIECE, 'headline': ['GOOGLE PAID', '$2.7B FIRST'], 'skin': None,
              'options': options, 'refused': [], 'grid_mock': mock, 'set_sha256': thumb_options.set_digest(options),
              'drawn_by': 'Claude Code', 'drawn_at': '2026-11-15T11:00:00+00:00'}
    (out / thumb_options.OPTIONS_FILE).write_text(json.dumps(record))
    return record


def critic_on(record: dict, best='a') -> dict:
    return {'best': best, 'options': [{'id': o['id'], 'files': [{'file': f['file'], 'sha256': f['sha256']} for f in o['files']],
                                       'checks': {k: 'pass' for k in thumb_options.CHECKS}, 'findings': [], 'blocking': False}
                                      for o in record['options']]}


class ThumbOptionsSelfTest(unittest.TestCase):
    def test_the_module_self_test_passes(self):
        self.assertEqual(thumb_options.self_test(), 0)


class MakingThumbnailsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='thumb-options-test-')
        self.out = Path(self.tmp.name)
        self.record = synthetic_set(self.out)

    def tearDown(self):
        self.tmp.cleanup()

    def test_the_set_goes_on_the_record_by_sha256_and_the_verdict_with_it(self):
        patch = making.thumbnail_options_patch(self.out)['thumbnail_options']
        self.assertEqual(patch['set_sha256'], self.record['set_sha256'])
        self.assertNotIn('verdict', patch)
        thumb_options.write_verdict(self.out, critic_on(self.record), 'thumbnail-critic')
        patch = making.thumbnail_options_patch(self.out)['thumbnail_options']
        self.assertEqual(patch['verdict']['best'], 'a')
        self.assertEqual(patch['verdict']['options'][0]['files'], [{'file': f['file'], 'sha256': f['sha256']} for f in self.record['options'][0]['files']])

    def test_a_file_changed_after_drawing_is_never_recorded(self):
        from PIL import Image
        Image.new('RGB', (1080, 1920), 'white').save(self.out / 'options' / 'b' / thumb_options.THUMB_FILES['tall'], 'JPEG')
        with self.assertRaises(making.MakingError):
            making.thumbnail_options_patch(self.out)

    def test_his_pick_needs_the_verdict_and_his_words(self):
        held = {'thumbnail_options': making.thumbnail_options_patch(self.out)['thumbnail_options']}
        with self.assertRaisesRegex(making.MakingError, 'only after the verdict'):
            making.thumbnail_pick_patch(held, 'b', 'Krish, 2026-11-15: B')
        thumb_options.write_verdict(self.out, critic_on(self.record), 'thumbnail-critic')
        held = {'thumbnail_options': making.thumbnail_options_patch(self.out)['thumbnail_options']}
        with self.assertRaisesRegex(making.MakingError, 'his own words'):
            making.thumbnail_pick_patch(held, 'b', 'B looks best')
        with self.assertRaisesRegex(making.MakingError, 'not on the record'):
            making.thumbnail_pick_patch(held, 'c', 'Krish, 2026-11-15: C')
        pick = making.thumbnail_pick_patch(held, 'B', 'Krish, 2026-11-15: B, the ringed one')['thumbnail_options']['pick']
        self.assertEqual((pick['option'], pick['files']), ('b', self.record['options'][1]['files']))

    def test_no_cut_carries_an_option_before_he_picks_it(self):
        thumb_options.write_verdict(self.out, critic_on(self.record), 'thumbnail-critic')
        held = {'thumbnail_options': making.thumbnail_options_patch(self.out)['thumbnail_options']}
        b_tall = self.out / 'options' / 'b' / thumb_options.THUMB_FILES['tall']
        self.assertEqual(making.thumb_option_of(b_tall), 'b')
        self.assertIn('has not picked', making.option_pick_problem(held, b_tall))
        held['thumbnail_options'].update(making.thumbnail_pick_patch(held, 'a', 'Krish, 2026-11-15: A')['thumbnail_options'])
        self.assertIn('Krish picked option A', making.option_pick_problem(held, b_tall))
        a_tall = self.out / 'options' / 'a' / thumb_options.THUMB_FILES['tall']
        self.assertIsNone(making.option_pick_problem(held, a_tall))
        self.assertIsNone(making.thumb_problem('short', a_tall))   # the option's own thumbs.json is the drawer's receipt

    def test_the_question_on_his_list_is_his_judgment_and_closes_with_the_video_step(self):
        thumb_options.write_verdict(self.out, critic_on(self.record, best='b'), 'thumbnail-critic')
        held = {'thumbnail_options': making.thumbnail_options_patch(self.out)['thumbnail_options']}
        item = making.thumbnail_ask_item(PIECE, held, 'https://controlcenter.krishraja.com/#/content')
        self.assertEqual({k: item[k] for k in ('idea_id', 'lane', 'only_you', 'closes_on')},
                         {'idea_id': PIECE, 'lane': 'on_you', 'only_you': 'judgment', 'closes_on': 'video'})
        self.assertEqual(item['title'], 'Pick the thumbnail: A or B')
        self.assertIn("critic's pick is B", item['detail'])
        with self.assertRaises(making.MakingError):
            making.thumbnail_ask_item(PIECE, {}, 'https://controlcenter.krishraja.com/#/content')

    def test_the_cli_records_the_set_and_asks_only_after_a_verdict_that_does_not_block(self):
        posted, items = [], []

        def call(method, path, body):
            if method == 'POST' and path.endswith('/making'):
                posted.append(body)
                return 200, json.dumps({'ok': True, 'making': {'thumbnail_options': body['thumbnail_options']}, 'steps': []})
            if method == 'GET' and path == making.BOARD_PATH:
                return 200, json.dumps({'items': []})
            if method == 'POST' and path == making.BOARD_PATH:
                items.extend(body['items'])
                return 200, '{}'
            return 404, '{}'

        link = 'https://controlcenter.krishraja.com/#/content'
        self.assertEqual(making.main([PIECE, 'thumbnails', str(self.out), '--ask', link], call=call), 1)   # no verdict yet
        self.assertEqual((posted, items), ([], []))
        thumb_options.write_verdict(self.out, critic_on(self.record), 'thumbnail-critic')
        self.assertEqual(making.main([PIECE, 'thumbnails', str(self.out), '--ask', link], call=call), 0)
        self.assertEqual(posted[0]['thumbnail_options']['set_sha256'], self.record['set_sha256'])
        self.assertEqual([i['id'] for i in items], [f'thumbs-{self.record["set_sha256"][:12]}'])


if __name__ == '__main__':
    unittest.main()
