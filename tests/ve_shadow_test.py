"""W2.7 ve in shadow: draft locks and Gate 2 promotion, ve file, ve brief and golden-frame slots.

Synthetic fixtures in temp trees only: no real take, no Drive, no Codex, no spend."""
from __future__ import annotations

import copy
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

from PIL import Image

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import ve  # noqa: E402
from velib import brief, cards, designlock, filing, golden, packet, qc_keyframes  # noqa: E402
from velib.common import sha256_file  # noqa: E402

BEATS = ['hook', 'face', 'proof', 'close']


def lock_tree(root: Path) -> Path:
    """A copy of the real lock in a temp repository tree, with its design files, so freezing writes nothing real."""
    lock = designlock.load()
    path = root / 'config/ve/design-lock.json'
    path.parent.mkdir(parents=True)
    path.write_text(json.dumps(lock), encoding='utf-8')
    (path.parent / 'brand-tokens.json').write_bytes((ROOT / 'config/ve/brand-tokens.json').read_bytes())
    for entry in list(lock['formats'].values()) + list(lock.get('drafts', {}).values()):
        for name in ('anatomy', 'motion'):
            target = root / entry[name]
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text('test reference', encoding='utf-8')
        for frame in (entry.get('keyframes') or {}).values():
            target = root / frame['file']
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(ROOT / frame['file'], target)
    return path


class DraftLockTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='ve-shadow-lock-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.path = lock_tree(self.root)
        self.src = self.root / 'stills'
        self.src.mkdir()

    def stills(self, size, prefix):
        mapping = {}
        for i, beat in enumerate(BEATS):
            name = f'{prefix}-{i}.png'
            Image.new('RGB', size, (30 + i * 20, 60, 40)).save(self.src / name)
            mapping[beat] = name
        return mapping

    def test_the_real_lock_holds_both_face_with_proof_drafts_unfrozen(self):
        lock = designlock.load()
        self.assertEqual(designlock.validate(lock), [])
        for key in ('face-with-proof', 'face-with-proof@16:9'):
            draft = lock['drafts'][key]
            self.assertEqual(draft['status'], 'awaiting Gate 2')
            self.assertEqual(draft['beats'], BEATS)
            self.assertEqual(draft['keyframe_slots'], {beat: None for beat in BEATS})
            self.assertEqual(draft['modules'], ['hand-held-screen', 'two-passports'])
            self.assertNotIn(key, lock['formats'])  # never frozen by an agent
        self.assertEqual(lock['drafts']['face-with-proof@16:9']['canvas'], {'w': 1920, 'h': 1080})
        self.assertEqual(lock['formats']['hand-held-screen']['role'], 'base')  # becomes a module only at Gate 2

    def test_a_draft_is_promoted_only_by_freeze_and_its_modules_join_it(self):
        designlock.freeze('face-with-proof', self.src, self.stills((1080, 1920), 'tall'), lock_path=self.path, today='2026-11-06')
        lock = designlock.load(self.path)
        self.assertIn('face-with-proof', lock['formats'])
        self.assertTrue(designlock.frozen(lock, 'face-with-proof', self.root)[0])
        self.assertNotIn('keyframe_slots', lock['formats']['face-with-proof'])
        self.assertEqual(lock['formats']['hand-held-screen']['role'], 'module')
        self.assertEqual(lock['formats']['two-passports']['role'], 'module')
        self.assertEqual(list(lock['drafts']), ['face-with-proof@16:9'])

    def test_the_wide_draft_freezes_from_wide_stills_only_and_reads_under_its_format_name(self):
        with self.assertRaises(ValueError):
            designlock.freeze('face-with-proof@16:9', self.src, self.stills((1080, 1920), 'tall'), lock_path=self.path)
        designlock.freeze('face-with-proof@16:9', self.src, self.stills((1920, 1080), 'wide'), lock_path=self.path, today='2026-11-06')
        lock = designlock.load(self.path)
        self.assertEqual(designlock.validate(lock, self.root), [])
        view = designlock.for_aspect(lock, '16:9')
        self.assertEqual(list(view['formats']), ['face-with-proof'])
        self.assertEqual(view['thresholds']['keyframe_compare_size'], [960, 540])
        self.assertTrue(designlock.frozen(view, 'face-with-proof', self.root)[0])
        self.assertNotIn('face-with-proof@16:9', designlock.for_aspect(lock, '9:16')['formats'])
        golden_file = designlock.golden_path(view, 'face-with-proof', 'hook', self.root)
        with Image.open(golden_file) as image:
            self.assertEqual(image.size, (960, 540))
        score = qc_keyframes.compare(Image.open(self.src / 'wide-0.png'), golden_file, view)
        self.assertTrue(score['pass'])

    def test_a_draft_never_replaces_a_lock(self):
        with self.assertRaises(ValueError):
            designlock.draft('hand-held-screen', '9:16', ['a'], anatomy='docs/ve/design/formats/H-anatomy.md',
                             motion='docs/ve/design/formats/H-motion.md', lock_path=self.path)

    def test_the_lock_cli_drafts_and_lists_without_freezing(self):
        out = io.StringIO()
        with patch.object(designlock, '_path', lambda path=None: self.path), redirect_stdout(out), \
                patch.object(sys, 'argv', ['ve', 'lock', 'check']):
            self.assertEqual(ve.main(), 0)
        self.assertIn('face-with-proof: draft, awaiting Gate 2', out.getvalue())


def spec_for(series='mind.the.gap'):
    spec = json.loads((ROOT / 'fixtures/ve/my-test-19s/spec.json').read_text(encoding='utf-8'))
    spec['piece_id'] = 'w27-shadow-fixture'
    spec['brand']['series'] = series
    return spec


class FileTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='ve-shadow-file-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.archive = self.root / 'Archive'
        self.archive.mkdir()
        self.library = self.root / 'makeyourmindup'
        (self.library / '3 Posts').mkdir(parents=True)
        self.ve = self.root / 'piece' / 've'
        self.ve.mkdir(parents=True)
        self.videos = {}
        for cut in ('proof-tall', 'proof-wide'):
            video = self.ve / f'{cut}.mp4'
            video.write_bytes(f'synthetic {cut}'.encode())
            self.videos[cut] = (str(video), sha256_file(video))
        self.spec = spec_for()

    def ready(self, spec, cut, directory):
        video, digest = self.videos[cut]
        return {'mechanical': [], 'design': [], 'final': [], 'video': video, 'digest': digest}

    def test_refuses_a_cut_that_is_not_ready_and_writes_nothing(self):
        with self.assertRaises(ValueError) as caught:
            filing.file(self.spec, self.ve, ['proof-tall'], subject='Two passports', when='2026-11-06',
                        archive_at=str(self.archive), library_at=str(self.library))
        self.assertIn('NOT READY', str(caught.exception))
        self.assertEqual(list(self.archive.iterdir()), [])
        self.assertEqual(list((self.library / '3 Posts').iterdir()), [])

    def test_files_ready_cuts_to_the_archive_and_3_video_bound_to_the_piece(self):
        with patch.object(packet, 'readiness', self.ready):
            plan = filing.file(self.spec, self.ve, ['proof-tall', 'proof-wide'], subject='Two passports', when='2026-11-06',
                               archive_at=str(self.archive), library_at=str(self.library), dry_run=True)
            self.assertTrue(plan['dry_run'])
            self.assertEqual(list(self.archive.iterdir()), [])
            record = filing.file(self.spec, self.ve, ['proof-tall', 'proof-wide'], subject='Two passports', when='2026-11-06',
                                 archive_at=str(self.archive), library_at=str(self.library), today='2026-11-06')
            post = self.library / '3 Posts' / '2026-11-06 Fri mind.the.gap - Two passports' / '3 Video'
            self.assertTrue(post.is_dir(), list((self.library / '3 Posts').iterdir()))
            names = sorted(p.name for p in post.iterdir())
            self.assertIn('ve-w27-shadow-fixture.json', names)
            self.assertEqual(len([n for n in names if n.endswith('.mp4')]), 2)
            sidecar = json.loads((post / 've-w27-shadow-fixture.json').read_text(encoding='utf-8'))
            self.assertEqual(sidecar['piece_id'], 'w27-shadow-fixture')
            self.assertEqual({f['sha256'] for f in sidecar['files']}, {d for _, d in self.videos.values()})
            for item in record['files']:
                self.assertEqual(sha256_file(item['archive']), item['sha256'])
            self.assertTrue((self.ve / 'filed.json').is_file())
            with self.assertRaises(ValueError):  # nothing is ever overwritten
                filing.file(self.spec, self.ve, ['proof-tall'], subject='Two passports', when='2026-11-06',
                            archive_at=str(self.archive), library_at=str(self.library))

    def test_refuses_a_file_changed_after_approval(self):
        with patch.object(packet, 'readiness', self.ready):
            Path(self.videos['proof-tall'][0]).write_bytes(b'changed')
            with self.assertRaises(ValueError) as caught:
                filing.file(self.spec, self.ve, ['proof-tall'], subject='Two passports', when='2026-11-06',
                            archive_at=str(self.archive), library_at=str(self.library))
            self.assertIn('changed after its approval', str(caught.exception))


class BriefTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='ve-shadow-brief-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.spec = spec_for()
        self.spec['assets'].append({'id': 'cotton-plate', 'kind': 'illustration', 'origin': 'generated',
                                    'path': 'plates/cotton.png', 'sha256': '0' * 64, 'licence': 'generated', 'tool': 'imagegen'})
        self.spec['cuts']['proof-tall']['beats'][0]['plate'] = {'source': 'asset:cotton-plate'}
        self.script = json.loads((ROOT / 'fixtures/ve/my-test-19s/script.words.json').read_text(encoding='utf-8'))['words']

    def test_one_brief_per_plate_with_every_field_the_card_needs(self):
        briefs = brief.build_briefs(self.spec, cut='proof-tall', script=self.script)
        self.assertEqual(len(briefs), 1)
        b = briefs[0]
        self.assertEqual(b['plate'], 'cotton-plate')
        self.assertTrue(b['line'].startswith('Now, America has blocked cotton'))
        self.assertTrue(b['duration_estimated'])
        self.assertEqual([n['n'] for n in b['floor_nevers']], list(range(1, 9)))
        self.assertEqual(b['floor_nevers'][0]['id'], 'his_name')
        self.assertEqual(sum(t['candidates'] for t in b['treatments']), 8)
        self.assertEqual(b['move']['name'], 'push_in')  # a hook of 5 s or less
        self.assertEqual(b['slot']['plate_min_px'], [1882, 3344])
        self.assertIn('runway', b['route']['motion']['tools'])
        self.assertIn('--check', b['card_fields']['acceptance'])
        moved = brief.build_briefs(self.spec, cut='proof-tall', script=self.script, moves={'b1-ban': 'still_drift'})[0]
        self.assertEqual(moved['route']['motion']['tools'], [])
        with self.assertRaises(ValueError):
            brief.build_briefs(self.spec, cut='proof-tall', moves={'b1-ban': 'cinematic_orbit'})
        wide = brief.build_briefs(self.spec, cut='proof-wide', beats=['b1-ban'])[0]
        self.assertEqual(wide['slot']['plate_min_px'], [3344, 1882])

    def test_card_fields_make_a_card_and_nothing_is_dispatched(self):
        b = brief.build_briefs(self.spec, cut='proof-tall', script=self.script)[0]
        fields = dict(b['card_fields'])
        fields.pop('path')
        with patch.object(cards, 'dispatch', side_effect=AssertionError('never dispatched')):
            out = cards.write_card(self.root / 'plate.card.md', **fields)
        text = Path(out).read_text(encoding='utf-8')
        self.assertIn('kind: plate', text)
        self.assertIn('The floor (never ships)', text)
        paths = brief.write_briefs(self.spec, self.root, cut='proof-tall', script=self.script)
        self.assertEqual([p.name for p in paths], ['cotton-plate.brief.json'])
        self.assertTrue((self.root / 'briefs' / 'cotton-plate.card.json').is_file())

    def test_candidates_are_checked_mechanically_before_the_critic(self):
        b = brief.build_briefs(self.spec, cut='proof-tall', script=self.script)[0]
        folder = self.root / 'candidates'
        folder.mkdir()
        report = brief.check_candidates(b, folder)
        self.assertFalse(report['pass'])
        self.assertEqual(len([f for f in report['findings'] if f.endswith('missing')]), 8)
        for t in b['treatments']:
            for name in t['files']:
                Image.new('RGB', (1882, 3344), (12, 30, 24)).save(folder / name)
                (folder / f'{name}.json').write_text(json.dumps({k: 'x' for k in brief.SIDECAR_FIELDS}))
        with patch.object(brief, '_ocr_glyphs', return_value=0):
            self.assertTrue(brief.check_candidates(b, folder)['pass'])
        with patch.object(brief, '_ocr_glyphs', return_value=3):
            self.assertFalse(brief.check_candidates(b, folder)['pass'])
        Image.new('RGB', (900, 1600), (12, 30, 24)).save(folder / 't1-c1.png')
        with patch.object(brief, '_ocr_glyphs', return_value=0):
            self.assertIn('t1-c1.png: 900x1600 is under 1882x3344', brief.check_candidates(b, folder)['findings'])


class GoldenTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='ve-shadow-golden-')
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / 'golden-frames.json'
        shutil.copy(golden.FILE, self.path)

    def test_the_slots_start_empty_and_monday_26_serves_meanwhile(self):
        doc = golden.load()
        self.assertEqual(len(doc['slots']), 10)
        self.assertTrue(all(s['status'] == 'empty' for s in doc['slots']))
        self.assertFalse(golden.status(doc)['ready'])
        moments = golden.interim(doc)
        self.assertTrue(moments)
        self.assertEqual({m['ref'] for m in moments}, {'mon26-tall', 'mon26-wide'})

    def test_a_slot_is_filled_only_with_his_words_and_a_known_reference(self):
        reference = 'igexport-DCHp2RLIxMt.mp4'
        for kwargs in ({'said': ''}, {'said': 'this one', 'reference': 'not-in-inspo.mp4'}, {'said': 'this one', 'at': '9:00'}):
            args = {'reference': reference, 'at': '0:03.5', **kwargs}
            with self.assertRaises(ValueError):
                golden.fill('g1', args['reference'], args['at'], args['said'], path=self.path)
        entry = golden.fill('g1', reference, '0:03.5', 'the way the type lands here', path=self.path, today='2026-11-06')
        self.assertEqual(entry['at_s'], 3.5)
        self.assertEqual(golden.status(golden.load(self.path))['named'], 1)
        with self.assertRaises(ValueError):
            golden.fill('g1', reference, '0:04', 'again', path=self.path)


class CliTest(unittest.TestCase):
    def test_stills_is_still_a_placeholder_and_the_new_verbs_have_help(self):
        run = lambda *a: subprocess.run([sys.executable, str(ROOT / 'scripts/ve.py'), *a], capture_output=True, text=True)
        self.assertEqual(run('stills').returncode, 2)
        for verb in ('ingest', 'conform', 'file', 'brief', 'golden'):
            self.assertEqual(run(verb, '--help').returncode, 0, verb)


if __name__ == '__main__':
    unittest.main(verbosity=1)
