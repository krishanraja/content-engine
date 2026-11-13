"""The three video sign-offs as review cards on his board: only his presses write the configs.

Ruling (Krish, 2026-11-12): the three video sign-offs are one review card each on his board, with samples, and only his
presses write the configs. Synthetic samples in temp trees only: no Drive, no engine, no media of his."""
from __future__ import annotations

import copy
import hashlib
import json
import os
import shutil
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib import designlock, golden, sfx, signoffs  # noqa: E402
from velib.common import sha256_file  # noqa: E402

BEATS = ['hook', 'face', 'proof', 'close']


def sha(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


class SignOffs(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.root = self.tmp / 'repo'
        (self.root / 'config' / 've' / 'sfx-kits').mkdir(parents=True)
        shutil.copyfile(ROOT / 'config' / 'sfx-approved.json', self.root / 'config' / 'sfx-approved.json')
        shutil.copyfile(ROOT / 'config' / 've' / 'golden-frames.json', self.root / 'config' / 've' / 'golden-frames.json')
        shutil.copyfile(ROOT / 'config' / 've' / 'design-lock.json', self.root / 'config' / 've' / 'design-lock.json')
        # The samples Drive holds: a sound, a frame and four 16:9 stills, each with the sha256 his press binds.
        self.drive = self.tmp / 'drive'
        self.drive.mkdir()
        (self.drive / 'thud').write_bytes(b'RIFF synthetic thud')
        Image.new('RGB', (1080, 1920), (20, 40, 30)).save(self.drive / 'frame', format='JPEG')
        for k, beat in enumerate(BEATS):
            Image.new('RGB', (1920, 1080), (10 * k, 60, 90)).save(self.drive / beat, format='JPEG')
        d = lambda name: {'file_id': f'1Synthetic{name}', 'url': f'https://drive.google.com/file/d/1Synthetic{name}/view'}  # noqa: E731
        self.doc = {'schema': 've-sign-offs/1', 'cards': [
            {'id': 'sfx', 'title': 'Sound effects', 'ask': 'Approve the sounds.', 'presses': 'each', 'items': [
                {'id': 'thud', 'title': 'A thud', 'kind': 'audio', 'name': 'thud.wav', 'sha256': sha256_file(self.drive / 'thud'),
                 'drive': d('thud'), 'slot': 'slam', 'provider': 'Epidemic Sound', 'provider_id': 'p1', 'gain_db': -8}]},
            {'id': 'golden', 'title': 'Golden frames', 'ask': 'Approve the frames.', 'presses': 'each', 'want': {'min': 5, 'max': 10}, 'items': [
                {'id': 'mon02-tall-00178', 'title': 'The quote', 'kind': 'image', 'sha256': sha256_file(self.drive / 'frame'), 'drive': d('frame'),
                 'piece_id': '9a0c97af-f0d6-4d12-a7ce-773c622d4b67', 'piece': 'A piece', 'cut': 'short', 'at': '0:17.9', 'at_s': 17.87,
                 'cut_sha256': sha('cut'), 'cut_path': '3 Posts/a/3 Video/tall.mp4'}]},
            {'id': 'gate2', 'title': 'Gate 2', 'ask': 'One press for the four frames.', 'presses': 'card', 'lock': signoffs.GATE2_LOCK, 'items': [
                {'id': b, 'beat': b, 'title': b, 'kind': 'image', 'sha256': sha256_file(self.drive / b), 'drive': d(b)} for b in BEATS]},
        ]}
        self.fetched = []
        # The engine's library, as the apply job files into it: path -> bytes. The home computers' sync writes it into
        # the brand kit's Music folder in Drive, which is MINDMAKE_MUSIC_ROOT there.
        self.library = {}

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def fetch(self, drive_id, dest):
        self.fetched.append(drive_id)
        dest = Path(dest)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(self.drive / drive_id.replace('1Synthetic', ''), dest)
        return dest

    def press(self, card, item, verdict, digest, at='2026-11-13T10:00:00Z', words=None, by='Krish'):
        return {'card': card, 'item': item, 'verdict': verdict, 'sha256': digest, 'words': words, 'at': at, 'by': by}

    def file_sound(self, path, local):
        self.library[path] = Path(local).read_bytes()
        return {'sent': 1}

    def apply(self, presses, file_sound='default'):
        return signoffs.apply(self.doc, signoffs.answers_of(presses), self.fetch, work=self.tmp / 'work', root=self.root,
                              file_sound=self.file_sound if file_sound == 'default' else file_sound)

    def music_root(self):
        """The Music folder as the library sync leaves it: every filed file under the brand kit's Music path."""
        root = self.tmp / 'Music'
        for path, data in self.library.items():
            rel = path.removeprefix(sfx.LIBRARY_MUSIC + '/')
            (root / rel).parent.mkdir(parents=True, exist_ok=True)
            (root / rel).write_bytes(data)
        root.mkdir(exist_ok=True)
        return root

    def config(self, *path):
        return json.loads((self.root.joinpath(*path)).read_text(encoding='utf-8'))

    def test_the_committed_manifest_keeps_its_shape(self):
        doc = signoffs.load()
        self.assertEqual(signoffs.validate(doc), [])
        counts = [len(c['items']) for c in doc['cards']]
        self.assertTrue(8 <= counts[0] <= 15, counts)
        self.assertGreaterEqual(counts[1], 10)
        self.assertEqual([i['beat'] for i in signoffs.card(doc, 'gate2')['items']], BEATS)
        # Only Drive ids and hashes are committed: no sample path points into the repository.
        self.assertFalse(any('file' in i for c in doc['cards'] for i in c['items']))

    def test_validate_refuses_a_sample_with_no_drive_file_or_hash(self):
        broken = copy.deepcopy(self.doc)
        broken['cards'][0]['items'][0]['sha256'] = 'abc'
        broken['cards'][1]['items'][0]['drive'] = {'file_id': 'x', 'url': 'http://elsewhere'}
        problems = signoffs.validate(broken)
        self.assertTrue(any('sfx.thud' in p and 'sha256' in p for p in problems), problems)
        self.assertTrue(any('golden.mon02-tall-00178' in p and 'Drive' in p for p in problems), problems)

    def test_no_press_writes_nothing(self):
        before = [self.config('config', 'sfx-approved.json'), self.config('config', 've', 'golden-frames.json'), self.config('config', 've', 'design-lock.json')]
        self.assertEqual(self.apply([]), [])
        # A session's press is never his.
        self.assertEqual(self.apply([self.press('sfx', 'thud', 'approve', self.doc['cards'][0]['items'][0]['sha256'], by='engine_operator')]), [])
        after = [self.config('config', 'sfx-approved.json'), self.config('config', 've', 'golden-frames.json'), self.config('config', 've', 'design-lock.json')]
        self.assertEqual(before, after)
        self.assertEqual(self.fetched, [])

    def test_his_approve_on_a_sound_writes_it_with_his_press_never_invented_words(self):
        digest = self.doc['cards'][0]['items'][0]['sha256']
        done = self.apply([self.press('sfx', 'thud', 'approve', digest)])
        self.assertEqual(done, ["sound thud: approved in config/sfx-approved.json and filed in the brand kit's Music folder at Music/sfx/thud.wav (2026-11-13)"])
        row = self.config('config', 'sfx-approved.json')['approved'][0]
        self.assertEqual({k: row[k] for k in ('id', 'sha256', 'approved_by', 'approved_on', 'provider_id')},
                         {'id': 'thud', 'sha256': digest, 'approved_by': 'Krish', 'approved_on': '2026-11-13', 'provider_id': 'p1'})
        self.assertNotIn('approval_words', row)
        self.assertEqual(row['approved_press']['sha256'], digest)
        self.assertIn('thud', sfx.approved(self.root / 'config' / 'sfx-approved.json'))
        self.assertEqual(json.loads((self.root / 'config' / 've' / 'sfx-kits' / 'house-v1.json').read_text()), {'thud': {'path': 'sfx/thud.wav', 'gain_db': -8.0}})
        # Applying the same presses again writes nothing new.
        self.assertEqual(self.apply([self.press('sfx', 'thud', 'approve', digest)]), [])

    def test_an_approved_sound_is_filed_in_the_music_folder_and_the_render_path_finds_it(self):
        digest = self.doc['cards'][0]['items'][0]['sha256']
        self.apply([self.press('sfx', 'thud', 'approve', digest)])
        # The exact bytes he heard, filed once at the brand kit's Music folder, sfx/<id>.
        self.assertEqual(list(self.library), ['1 Brand kit (permanent)/Music/sfx/thud.wav'])
        self.assertEqual(hashlib.sha256(self.library['1 Brand kit (permanent)/Music/sfx/thud.wav']).hexdigest(), digest)
        row = self.config('config', 'sfx-approved.json')['approved'][0]
        self.assertEqual(row['file'], 'sfx/thud.wav')
        self.assertEqual({k: row['filed'][k] for k in ('library_path', 'drive_folder', 'music_root_path', 'sha256')},
                         {'library_path': '1 Brand kit (permanent)/Music/sfx/thud.wav', 'drive_folder': sfx.DRIVE_MUSIC_FOLDER,
                          'music_root_path': 'sfx/thud.wav', 'sha256': digest})
        # The next cut: ve compile stages it from MINDMAKE_MUSIC_ROOT into the cut's assets, checked by its sha256.
        assets = self.tmp / 'assets'
        approved = self.root / 'config' / 'sfx-approved.json'
        with patch.dict(os.environ, {sfx.MUSIC_ENV: str(self.music_root())}):
            self.assertEqual(sfx.ensure_staged('thud', 'sfx/thud.wav', assets, approved), 'sfx/thud.wav')
        self.assertEqual(sha256_file(assets / 'sfx' / 'thud.wav'), digest)
        # A machine without it stops, naming the file and where it is filed, and stages nothing.
        empty = self.tmp / 'empty-music'
        empty.mkdir()
        with patch.dict(os.environ, {sfx.MUSIC_ENV: str(empty)}), self.assertRaisesRegex(ValueError, r"thud.*missing on this machine.*Music folder"):
            sfx.ensure_staged('thud', 'sfx/thud.wav', self.tmp / 'other-assets', approved)
        with patch.dict(os.environ, {}, clear=True), self.assertRaisesRegex(ValueError, r'MINDMAKE_MUSIC_ROOT is not set.*Music/sfx/thud.wav'):
            sfx.ensure_staged('thud', 'sfx/thud.wav', self.tmp / 'other-assets', approved)
        self.assertFalse((self.tmp / 'other-assets').exists())
        # Other bytes at its place in a cut's assets are refused, never played.
        (assets / 'sfx' / 'thud.wav').write_bytes(b'another sound')
        with self.assertRaisesRegex(ValueError, 'not the file he approved'):
            sfx.ensure_staged('thud', 'sfx/thud.wav', assets, approved)
        # A sound nobody approved never stages.
        with self.assertRaisesRegex(ValueError, 'not in the approved set'):
            sfx.ensure_staged('ding', 'sfx/ding.wav', assets, approved)

    def test_music_fetch_brings_each_approved_sound_to_any_machine(self):
        digest = self.doc['cards'][0]['items'][0]['sha256']
        self.apply([self.press('sfx', 'thud', 'approve', digest)])
        approved = self.root / 'config' / 'sfx-approved.json'
        asked, lines = [], []
        def fetch(path, dest, sha256):
            asked.append(path)
            if path not in self.library:
                raise ValueError(f'the library has no copy of {path} (404)')
            Path(dest).parent.mkdir(parents=True, exist_ok=True)
            Path(dest).write_bytes(self.library[path])
            if sha256_file(dest) != sha256:
                raise ValueError('not the file on the record')
            return dest
        folder = self.tmp / 'fetched'
        self.assertEqual(sfx.fetch_approved(folder, out=lines.append, approved_path=approved, fetch=fetch), 1)
        self.assertEqual(asked, ['1 Brand kit (permanent)/Music/sfx/thud.wav'])
        self.assertEqual(sha256_file(folder / 'sfx' / 'thud.wav'), digest)
        # Already here with the right bytes: nothing is asked again.
        self.assertEqual(sfx.fetch_approved(folder, out=lines.append, approved_path=approved, fetch=fetch), 1)
        self.assertEqual(len(asked), 1)
        # One the library lacks is said by name, never quietly left out.
        self.library.clear()
        lines.clear()
        self.assertEqual(sfx.fetch_approved(self.tmp / 'elsewhere', out=lines.append, approved_path=approved, fetch=fetch), 0)
        self.assertRegex(lines[0], r'^missing +sfx/thud.wav .*stops at ve compile')

    def test_a_sound_is_never_written_unfiled(self):
        digest = self.doc['cards'][0]['items'][0]['sha256']
        before = self.config('config', 'sfx-approved.json')
        with self.assertRaisesRegex(ValueError, 'no filer was given'):
            self.apply([self.press('sfx', 'thud', 'approve', digest)], file_sound=None)
        def refused(path, local):
            raise ValueError(f'{path}: the library refused it')
        with self.assertRaisesRegex(ValueError, 'the library refused it'):
            self.apply([self.press('sfx', 'thud', 'approve', digest)], file_sound=refused)
        (self.drive / 'thud').write_bytes(b'RIFF another thud')
        with self.assertRaisesRegex(ValueError, 'not the sound he heard'):
            self.apply([self.press('sfx', 'thud', 'approve', digest)])
        self.assertEqual(self.config('config', 'sfx-approved.json'), before)
        self.assertEqual(self.library, {})

    def test_the_job_files_through_the_one_send_lane_at_the_music_folder(self):
        sys.path[:0] = [str(ROOT / 'scripts'), str(ROOT / 'scripts' / 'post-pack')]
        import send  # noqa: PLC0415  scripts/post-pack/send.py, with its in-memory engine
        fake = send.FakeEngine()
        quiet = lambda *_: None  # noqa: E731
        with patch.object(send, 'Engine', lambda client: fake):
            done = signoffs.engine_file_sound('1 Brand kit (permanent)/Music/sfx/thud.wav', self.drive / 'thud', out=quiet)
            again = signoffs.engine_file_sound('1 Brand kit (permanent)/Music/sfx/thud.wav', self.drive / 'thud', out=quiet)
        self.assertEqual((done['sent'], again['already']), (1, 1))
        self.assertEqual(list(fake.objects.values()), [(self.drive / 'thud').read_bytes()])
        # A path the library refuses stops the job; nothing is written for it.
        with patch.object(send, 'Engine', lambda client: fake), self.assertRaisesRegex(ValueError, 'Music/../x.wav'):
            signoffs.engine_file_sound('1 Brand kit (permanent)/Music/../x.wav', self.drive / 'thud', out=quiet)

    def test_render_stops_on_a_sound_missing_from_its_props(self):
        here = self.tmp / 'here.wav'
        here.write_bytes(b'x')
        props = {'audio': {'sfx': [{'src': str(here)}, {'src': str(self.tmp / 'gone.wav')}]}}
        self.assertEqual(sfx.missing_in_props(props), [str(self.tmp / 'gone.wav')])
        self.assertEqual(sfx.missing_in_props({'audio': {'sfx': []}}), [])

    def test_his_not_this_is_kept_as_his_no_and_takes_back_an_approval(self):
        digest = self.doc['cards'][0]['items'][0]['sha256']
        self.apply([self.press('sfx', 'thud', 'approve', digest)])
        done = self.apply([self.press('sfx', 'thud', 'approve', digest), self.press('sfx', 'thud', 'not_this', digest, at='2026-11-13T11:00:00Z', words='Too boomy.')])
        self.assertEqual(done, ['sound thud: his Not this recorded in config/sfx-approved.json (2026-11-13)'])
        doc = self.config('config', 'sfx-approved.json')
        self.assertEqual(doc['approved'], [])
        self.assertEqual({k: doc['declined'][0][k] for k in ('id', 'declined_by', 'words')}, {'id': 'thud', 'declined_by': 'Krish', 'words': 'Too boomy.'})
        self.assertEqual(json.loads((self.root / 'config' / 've' / 'sfx-kits' / 'house-v1.json').read_text()), {})

    def test_a_press_on_bytes_no_longer_on_the_card_writes_nothing(self):
        done = self.apply([self.press('sfx', 'thud', 'approve', sha('an older sound'))])
        self.assertEqual(done, ['sfx thud: his press names other bytes than the sample now on the card; left as it is'])
        self.assertEqual(self.config('config', 'sfx-approved.json')['approved'], [])

    def test_his_approve_names_a_golden_frame_from_his_own_cut(self):
        item = self.doc['cards'][1]['items'][0]
        done = self.apply([self.press('golden', item['id'], 'approve', item['sha256'], words='This is the bar.')])
        self.assertEqual(done, ['golden frame mon02-tall-00178: named in slot g1 (2026-11-13)'])
        slot = self.config('config', 've', 'golden-frames.json')['slots'][0]
        self.assertEqual({k: slot[k] for k in ('slot', 'status', 'source', 'sign_off', 'cut', 'cut_sha256', 'at', 'frame_sha256', 'named_by', 'said')},
                         {'slot': 'g1', 'status': 'named', 'source': 'cut', 'sign_off': item['id'], 'cut': 'short', 'cut_sha256': sha('cut'),
                          'at': '0:17.9', 'frame_sha256': item['sha256'], 'named_by': 'Krish', 'said': 'This is the bar.'})
        self.assertEqual(self.fetched, ['1Syntheticframe'])
        state = golden.status(golden.load(self.root / 'config' / 've' / 'golden-frames.json'))
        self.assertEqual(state['named'], 1)
        # His no on it later empties the slot and records the no.
        self.apply([self.press('golden', item['id'], 'approve', item['sha256']), self.press('golden', item['id'], 'not_this', item['sha256'], at='2026-11-14T09:00:00Z')])
        doc = self.config('config', 've', 'golden-frames.json')
        self.assertEqual(doc['slots'][0], {'slot': 'g1', 'status': 'empty'})
        self.assertEqual(doc['declined'][0]['sign_off'], item['id'])

    def test_a_golden_frame_whose_drive_file_changed_is_refused(self):
        item = self.doc['cards'][1]['items'][0]
        Image.new('RGB', (1080, 1920), (200, 0, 0)).save(self.drive / 'frame', format='JPEG')
        with self.assertRaisesRegex(ValueError, 'not the frame he saw'):
            self.apply([self.press('golden', item['id'], 'approve', item['sha256'])])
        self.assertEqual(self.config('config', 've', 'golden-frames.json')['slots'][0], {'slot': 'g1', 'status': 'empty'})

    def test_gate2_approve_freezes_the_wide_lock_from_his_stills_with_his_press(self):
        card = self.doc['cards'][2]
        digest = signoffs.card_sha256(card)
        done = self.apply([self.press('gate2', signoffs.CARD_ITEM, 'approve', digest)])
        self.assertEqual(done, ['Gate 2: face-with-proof at 16:9 frozen from his approved stills (2026-11-13)'])
        lock = self.config('config', 've', 'design-lock.json')
        entry = lock['formats'][signoffs.GATE2_LOCK]
        self.assertNotIn(signoffs.GATE2_LOCK, lock.get('drafts', {}))
        self.assertEqual(set(entry['keyframes']), set(BEATS))
        self.assertEqual({k: entry['approved'][k] for k in ('by', 'on', 'sha256')}, {'by': 'Krish', 'on': '2026-11-13', 'sha256': digest})
        self.assertNotIn('words', entry['approved'])
        self.assertTrue(designlock.frozen(lock, signoffs.GATE2_LOCK, self.root)[0])
        # Each key frame's source is the still he saw.
        self.assertEqual(entry['keyframes']['hook']['source_sha256'], card['items'][0]['sha256'])

    def test_gate2_not_this_keeps_the_draft_and_records_his_no(self):
        digest = signoffs.card_sha256(self.doc['cards'][2])
        done = self.apply([self.press('gate2', signoffs.CARD_ITEM, 'not_this', digest, words='The close is too empty.')])
        self.assertEqual(done, ['Gate 2: his Not this recorded on the face-with-proof 16:9 draft (2026-11-13)'])
        lock = self.config('config', 've', 'design-lock.json')
        self.assertNotIn(signoffs.GATE2_LOCK, lock['formats'])
        self.assertEqual({k: lock['drafts'][signoffs.GATE2_LOCK]['gate2'][k] for k in ('verdict', 'by', 'words', 'sha256')},
                         {'verdict': 'not_this', 'by': 'Krish', 'words': 'The close is too empty.', 'sha256': digest})
        self.assertEqual(self.fetched, [])

    def test_card_sha256_is_the_boards_canonical_map(self):
        card = self.doc['cards'][2]
        mapping = {i['id']: i['sha256'] for i in card['items']}
        text = '{' + ','.join(f'{json.dumps(k)}:{json.dumps(mapping[k])}' for k in sorted(mapping)) + '}'
        self.assertEqual(signoffs.card_sha256(card), hashlib.sha256(text.encode()).hexdigest())

    def test_settled_times_avoid_transitions_and_the_ends(self):
        times = signoffs.settled_times(60.0, [5.0, 5.4, 12.0, 30.0, 47.0], 4)
        self.assertTrue(all(1.5 <= t <= 58.5 for t in times), times)
        self.assertNotIn(5.0, times)
        self.assertLessEqual(len(times), 4)
        # A talking take with no cuts still gets spread frames.
        self.assertEqual(len(signoffs.settled_times(60.0, [], 5)), 5)

    def test_add_item_hashes_the_exact_bytes_filed(self):
        path = self.tmp / 'sign-offs.json'
        base = copy.deepcopy(self.doc)
        base['cards'][0]['items'] = []
        path.write_text(json.dumps(base), encoding='utf-8')
        item = {k: v for k, v in self.doc['cards'][0]['items'][0].items() if k != 'sha256'}
        row = signoffs.add_item('sfx', item, self.drive / 'thud', path=path)
        self.assertEqual(row['sha256'], sha256_file(self.drive / 'thud'))
        with self.assertRaisesRegex(ValueError, 'slot it is for'):
            signoffs.add_item('sfx', {**item, 'id': 'nameless', 'slot': None}, self.drive / 'thud', path=path)


if __name__ == '__main__':
    unittest.main()
