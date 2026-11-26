"""Design-lock gates and golden provenance; all generated files stay in temp trees."""
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
from datetime import date
from pathlib import Path
from unittest.mock import patch

from PIL import Image

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import ve
from velib import cards, designlock
from velib.common import sha256_file
from velib.lint import crew_lints

FMT = 'hand-held-screen'


class DesignLockTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=ROOT / 'tests', prefix='ve-designlock-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.lock = designlock.load()
        # The real lock is frozen once approved; these tests need an unfrozen copy to freeze themselves.
        self.lock['status'] = 'direction_approved'
        for settings in self.lock['formats'].values():
            settings['keyframes'] = {}
            settings.pop('frozen_on', None)
        self.path = self.root / 'config/ve/design-lock.json'
        self.path.parent.mkdir(parents=True)
        self.path.write_text(json.dumps(self.lock), encoding='utf-8')
        (self.path.parent / 'brand-tokens.json').write_bytes((ROOT / 'config/ve/brand-tokens.json').read_bytes())
        for settings in self.lock['formats'].values():
            for name in ('anatomy', 'motion'):
                target = self.root / settings[name]
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text('test reference', encoding='utf-8')
        self.src = self.root / 'source'
        self.src.mkdir()
        self.mapping = {beat: f'f{i}.png' for i, beat in enumerate(self.lock['formats'][FMT]['beats'], 1)}

    def images(self, fmt=FMT):
        mapping = {beat: f'{fmt}-{i}.png' for i, beat in enumerate(self.lock['formats'][fmt]['beats'], 1)}
        for i, filename in enumerate(mapping.values()):
            Image.new('RGB', (1080, 1920), (20 + i, 50, 30)).save(self.src / filename)
        return mapping

    def freeze(self, mapping=None, **kwargs):
        return designlock.freeze(FMT, self.src, mapping if mapping is not None else self.images(),
                                 lock_path=self.path, today=date(2026, 10, 28), **kwargs)

    def test_real_lock_and_mutations(self):
        self.assertEqual(designlock.validate(self.lock), [])
        mutations = [
            ('caption', lambda v: v['zones']['caption'].update(y=1190)),
            ('min_text_px', lambda v: v['thresholds'].pop('min_text_px')),
            ('family', lambda v: v['type_roles']['headline'].update(family='unknown')),
            ('anatomy', lambda v: v['formats'][FMT].update(anatomy='missing.md')),
            ('gates', lambda v: v['gates'].reverse()),
            ('scribble.stroke_px', lambda v: v['scribble'].update(stroke_px=9)),
            ('canvas', lambda v: v['canvas'].update(fps=60)),
            ('zones.headline', lambda v: v['zones']['headline'].update(x=1000)),
            ('fill_min_pct', lambda v: v['thresholds'].update(fill_min_pct=True)),
            ('keyframe_ssim_min', lambda v: v['thresholds'].update(keyframe_ssim_min=float('nan'))),
            ('keyline_px', lambda v: v['scribble'].update(keyline_px=15)),
            ('motion', lambda v: v['formats'][FMT].update(motion='../outside.md')),
        ]
        for expected, mutate in mutations:
            with self.subTest(expected=expected):
                lock = copy.deepcopy(self.lock)
                mutate(lock)
                self.assertIn(expected, '\n'.join(designlock.validate(lock)))

    def test_freeze_hashes_sizes_and_tampering(self):
        ok, reasons = designlock.frozen(self.lock, FMT, self.root)
        self.assertFalse(ok)
        self.assertIn('one entry per beat', ' '.join(reasons))
        mapping = self.images()
        lock = self.freeze(mapping)
        self.assertEqual(designlock.frozen(lock, FMT, self.root), (True, []))
        self.assertEqual(lock['status'], 'direction_approved')
        self.assertEqual(lock['formats'][FMT]['frozen_on'], '2026-10-28')
        self.assertEqual(designlock.load(self.path), lock)
        for beat, entry in lock['formats'][FMT]['keyframes'].items():
            golden = designlock.golden_path(lock, FMT, beat, self.root)
            with Image.open(golden) as image:
                self.assertEqual(image.size, (540, 960))
                self.assertEqual(image.format, 'JPEG')
            self.assertEqual(entry['size'], [540, 960])
            self.assertEqual(entry['sha256'], sha256_file(golden))
            self.assertEqual(entry['source_sha256'], sha256_file(self.src / mapping[beat]))
        golden.write_bytes(golden.read_bytes() + b'x')
        self.assertIn('sha256 mismatch', ' '.join(designlock.frozen(lock, FMT, self.root)[1]))

    def test_freeze_refusals_and_force(self):
        mapping = self.images()
        missing = dict(mapping)
        missing.pop(next(iter(missing)))
        with self.assertRaisesRegex(ValueError, 'every beat'):
            self.freeze(missing)
        filename = next(iter(mapping.values()))
        Image.new('RGB', (1000, 1900)).save(self.src / filename)
        before = self.path.read_bytes()
        with self.assertRaises(ValueError) as caught:
            self.freeze(mapping)
        self.assertIn(filename, str(caught.exception))
        self.assertEqual(self.path.read_bytes(), before)
        self.assertFalse((self.root / self.lock['formats'][FMT]['frames_dir']).exists())
        self.images()
        self.freeze(mapping)
        with self.assertRaisesRegex(ValueError, 'force'):
            self.freeze(mapping)
        lock = self.freeze(mapping, force=True)
        self.assertTrue(designlock.frozen(lock, FMT, self.root)[0])
        # The lock reads frozen only once every format in it is frozen (face-with-proof left it on 18 Nov 2026: retire).
        for other in [name for name in self.lock['formats'] if name != FMT and designlock.picture_match(self.lock, name)]:
            self.assertEqual(lock['status'], 'direction_approved')
            lock = designlock.freeze(other, self.src, self.images(other), lock_path=self.path)
        self.assertEqual(lock['status'], 'frozen')

    def test_keyframe_coverage_and_missing_file(self):
        lock = self.freeze()
        frames = lock['formats'][FMT]['keyframes']
        entry = frames[next(iter(frames))]
        entry['file'] = 'missing.jpg'
        self.assertIn('missing keyframe', ' '.join(designlock.frozen(lock, FMT, self.root)[1]))
        frames['extra'] = dict(entry)
        self.assertIn('one entry per beat', ' '.join(designlock.frozen(lock, FMT, self.root)[1]))

    def test_retire_deletes_the_frames_and_bars_them_for_good(self):
        mapping = self.images()
        lock = self.freeze(mapping)
        goldens = [designlock.golden_path(lock, FMT, beat, self.root) for beat in lock['formats'][FMT]['keyframes']]
        self.assertTrue(all(g.is_file() for g in goldens))
        old = {beat: dict(e) for beat, e in lock['formats'][FMT]['keyframes'].items()}
        words = 'DELETE THOSE FRAMES FOREVER'
        entry = designlock.retire(FMT, words=words, on='2026-11-18', lock_path=self.path, today=date(2026, 11, 18))
        lock = designlock.load(self.path)
        # The golden files are gone, the folder with them, and the format is a draft awaiting a new Gate 2.
        self.assertFalse(any(g.exists() for g in goldens))
        self.assertFalse((self.root / self.lock['formats'][FMT]['frames_dir']).exists())
        self.assertNotIn(FMT, lock['formats'])
        self.assertEqual(lock['drafts'][FMT], entry)
        self.assertEqual(entry['status'], 'awaiting Gate 2')
        self.assertEqual(entry['drafted'], '2026-11-18')
        self.assertEqual(entry['keyframe_slots'], {beat: None for beat in self.lock['formats'][FMT]['beats']})
        self.assertNotIn('keyframes', entry)
        self.assertNotIn('frozen_on', entry)
        self.assertEqual(entry['retired']['words'], words)
        self.assertEqual(entry['retired']['was_frozen_on'], '2026-10-28')
        self.assertEqual({b: v['sha256'] for b, v in entry['retired']['keyframes'].items()},
                         {b: e['sha256'] for b, e in old.items()})
        self.assertEqual(len(entry['retired']['files_removed']), len(goldens))
        self.assertFalse(designlock.frozen(lock, FMT, self.root)[0], 'no longer a lock')
        # The same pictures cannot be frozen again, by the still or by the golden cut from it.
        with self.assertRaisesRegex(ValueError, 'deleted for good'):
            designlock.freeze(FMT, self.src, mapping, lock_path=self.path)
        self.assertNotIn(FMT, designlock.load(self.path)['formats'])
        # New pictures freeze it, and the retirement stays on the lock as the record.
        fresh = {}
        for i, (beat, filename) in enumerate(mapping.items()):
            fresh[beat] = f'new-{i}.png'
            Image.new('RGB', (1080, 1920), (200, 10 + i, 90)).save(self.src / fresh[beat])
        frozen = designlock.freeze(FMT, self.src, fresh, lock_path=self.path, today=date(2026, 11, 19))
        self.assertTrue(designlock.frozen(frozen, FMT, self.root)[0])
        self.assertEqual(frozen['formats'][FMT]['retired']['words'], words)
        self.assertNotIn(FMT, frozen.get('drafts', {}))

    def test_no_retired_frame_is_back_in_the_tree(self):
        # "Forever": the real lock remembers every picture Krish had deleted (config/ve/design-lock.json, retired), and no
        # image file anywhere under fixtures/ or docs/ may carry one of those hashes.
        lock = designlock.load()
        barred = set()
        for entry in list(lock['formats'].values()) + list(lock.get('drafts', {}).values()):
            barred |= designlock.retired_hashes(entry)
        self.assertTrue(barred, 'the Thu 5 Nov key frames stay recorded as retired')
        found = []
        for base in ('fixtures', 'docs'):
            for path in (ROOT / base).rglob('*'):
                if path.suffix.lower() in ('.jpg', '.jpeg', '.png', '.webp') and path.is_file() and sha256_file(path) in barred:
                    found.append(path.relative_to(ROOT).as_posix())
        self.assertEqual(found, [], 'a retired key frame is back in the repository')

    def test_rules_only_drops_the_picture_match_and_keeps_the_rules(self):
        # Krish, 2026-11-18: "why a visual pass plus obvious rules arent a better option than measuring it against one
        # frame of an old video" and "i agree with your recommendations".
        from velib import qc_keyframes
        self.freeze(self.images())
        designlock.retire(FMT, words='delete them', on='2026-11-18', lock_path=self.path, today=date(2026, 11, 18))
        words = 'a visual pass plus obvious rules'
        entry = designlock.rules_only(FMT, words=words, on='2026-11-18', lock_path=self.path, today='2026-11-18')
        lock = designlock.load(self.path)
        self.assertIn(FMT, lock['formats'])
        self.assertNotIn(FMT, lock.get('drafts', {}))
        self.assertEqual(entry['rules_only'], {'by': 'Krish', 'on': '2026-11-18', 'words': words})
        self.assertEqual(designlock.frozen(lock, FMT, self.root), (True, []), 'it needs no key frame to read as a lock')
        self.assertFalse(designlock.picture_match(lock, FMT))
        self.assertTrue(designlock.picture_match(lock, next(n for n in lock['formats'] if n != FMT)))
        self.assertIn('retired', lock['formats'][FMT], 'the retirement stays on the entry')
        self.assertEqual(designlock.validate(lock, self.root), [])
        # QC reads it as no picture match, whatever the cut's beats are.
        report = qc_keyframes.keyframe_checks('cut.mp4', {'beats': []}, lock, FMT)
        self.assertFalse(report['applies'])
        self.assertIn('rules-only', report['note'])
        # No picture is ever frozen for it.
        with self.assertRaisesRegex(ValueError, 'rules-only'):
            designlock.freeze(FMT, self.src, self.images(), lock_path=self.path, force=True)

    def test_rules_only_refusals(self):
        self.freeze(self.images())
        designlock.retire(FMT, words='x', on='2026-11-18', lock_path=self.path, today=date(2026, 11, 18))
        before = self.path.read_bytes()
        with self.assertRaisesRegex(ValueError, 'only Krish'):
            designlock.rules_only(FMT, words='x', on='2026-11-18', by='Claude', lock_path=self.path)
        with self.assertRaisesRegex(ValueError, 'his words'):
            designlock.rules_only(FMT, words=' ', on='2026-11-18', lock_path=self.path)
        with self.assertRaisesRegex(ValueError, 'not a draft'):
            designlock.rules_only('two-passports', words='x', on='2026-11-18', lock_path=self.path)
        self.assertEqual(self.path.read_bytes(), before)

    def test_retire_refusals(self):
        self.freeze()
        before = self.path.read_bytes()
        with self.assertRaisesRegex(ValueError, 'only Krish'):
            designlock.retire(FMT, words='x', on='2026-11-18', by='Claude', lock_path=self.path)
        with self.assertRaisesRegex(ValueError, 'his words'):
            designlock.retire(FMT, words='  ', on='2026-11-18', lock_path=self.path)
        with self.assertRaisesRegex(ValueError, 'not a lock'):
            designlock.retire('no-such-format', words='x', on='2026-11-18', lock_path=self.path)
        self.assertEqual(self.path.read_bytes(), before)
        self.assertTrue(all(designlock.golden_path(designlock.load(self.path), FMT, b, self.root).is_file()
                            for b in self.lock['formats'][FMT]['beats']))

    def fields(self):
        return dict(card_id='test', kind='device', cwd=str(self.root), write_allow='[]', read='',
                    title='test', goal='test', contract='test', acceptance='python test.py')

    def test_the_through_line_fields_write_a_card_codex_can_take(self):
        fields = json.loads((ROOT / 'docs/ve/cards/through-line/ve-through-line-1.fields.json').read_text())
        self.assertIsInstance(fields['goal'], str, 'the goal is the card text and the lane reads its verbs from it')
        self.assertEqual(fields.pop('path'), 'docs/ve/cards/through-line/ve-through-line-1.md')
        text = cards.write_card(self.root / 'through-line.md', cwd=str(self.root), **fields).read_text()
        self.assertIn('## Recipe: The Ladder', text)
        self.assertNotIn("['", text)
        self.assertLessEqual(len(text.encode()), 6144)

    def test_a_card_carries_its_motion_style_for_codex(self):
        path = cards.write_card(self.root / 'styled.md', motion_style='data-story', **self.fields())
        text = path.read_text()
        self.assertIn('## Motion style: Data story (data-story', text)
        self.assertIn('3D charts', text)
        self.assertLess(text.index('## Motion style'), text.index('## Acceptance'))
        # data-story has a recipe saved from the cut he approved (Monday 2 Nov): the card builds the whole system
        self.assertIn('## Recipe: The Ladder', text)
        self.assertIn('mon02-wide', text)
        self.assertLess(text.index('## Recipe'), text.index('## Acceptance'))
        # A motion style with no saved recipe gets no Recipe section (paper-cutout, the old example, is retired by v5).
        self.assertNotIn('## Recipe', cards.write_card(self.root / 'swiss.md', motion_style='swiss-kinetic-type', **self.fields()).read_text())
        meta = cards.parse_card(path)
        self.assertEqual(meta['motion_style'], 'data-story')
        self.assertEqual(meta['acceptance'], ['python test.py'])
        for bad in ('live-scoreboard', 'no-such-style', 'paper-cutout'):
            with self.assertRaises(SystemExit):
                cards.write_card(self.root / f'{bad}.md', motion_style=bad, **self.fields())
        plain = cards.write_card(self.root / 'plain.md', **self.fields()).read_text()
        self.assertNotIn('Motion style', plain)

    def test_card_and_dispatch_refuse_before_side_effects(self):
        path = self.root / 'card.md'
        phrase = f'no frozen design lock for {FMT}: run ve lock freeze'
        patcher = patch.object(designlock, 'load', return_value=self.lock)
        patcher.start()
        self.addCleanup(patcher.stop)
        with self.assertRaises(SystemExit) as caught:
            cards.write_card(path, format=FMT, **self.fields())
        self.assertEqual(str(caught.exception), phrase)
        self.assertFalse(path.exists())
        cards.write_card(path, **self.fields())
        self.assertNotIn('format', cards.parse_card(path))
        path.write_text(path.read_text().replace('kind: device', f'kind: device\nformat: {FMT}'))
        with patch.object(cards, 'ensure_worktree') as worktree:
            with self.assertRaises(SystemExit) as caught:
                cards.dispatch(path)
            self.assertEqual(str(caught.exception), phrase)
            worktree.assert_not_called()
        phrase = 'no frozen design lock for no-such-format: run ve lock freeze'
        fields = self.fields() | {'format': 'no-such-format', 'path': str(path)}
        source = self.root / 'fields.json'
        source.write_text(json.dumps(fields))
        result = self.cli('card', str(source))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(phrase, result.stderr)

    def test_card_preserves_format_after_frozen_gate(self):
        lock = self.freeze()
        with patch.object(designlock, 'ROOT', self.root):
            path = cards.write_card(self.root / 'frozen-card.md', format=FMT, **self.fields())
            self.assertEqual(cards.parse_card(path)['format'], FMT)
        self.assertTrue(designlock.frozen(lock, FMT, self.root)[0])

    def test_lint_locked_format_gate(self):
        fixture = json.loads((ROOT / 'fixtures/ve/my-test-19s/spec.json').read_text())
        lock = copy.deepcopy(self.lock)
        lock['formats'][fixture['format']] = lock['formats'].pop(FMT)
        with patch.object(designlock, 'load', return_value=lock):
            self.assertIn(f'format {fixture["format"]} has no frozen design lock', crew_lints(fixture))

    def cli(self, *args):
        return subprocess.run([sys.executable, str(ROOT / 'scripts/ve.py'), *args], cwd=ROOT,
                              env=os.environ | {'PYTHONDONTWRITEBYTECODE': '1'}, capture_output=True, text=True)

    def test_cli_legacy_lint(self):
        # The fixture names no recipe, so a copy of it freezes before the recipe floor (velib.floor.RECIPE_FROM); with no
        # lock it would freeze "today" and turn red on a date. Binding is tested in ve_quality_floor_test.py.
        # The v5 fixture, set to a format with a config but no design lock that the v5 ruling did not retire: the old
        # fixture's own format (scoreboard-test) is retired and lints as retired (config/retired-styles.json).
        retired = {row['id'] for row in json.loads((ROOT / 'config/retired-styles.json').read_text(encoding='utf-8'))
                   if row['kind'] == 'format_look'}
        legacy = sorted(p.stem for p in (ROOT / 'config/ve/formats').glob('*.json')
                        if p.stem not in designlock.load()['formats'] and p.stem not in retired)
        self.assertTrue(legacy, 'a live format with no design lock to lint as legacy')
        spec = json.loads((ROOT / 'fixtures/ve/my-test-19s/spec-v5.json').read_text(encoding='utf-8'))
        spec['format'] = legacy[0]
        with tempfile.TemporaryDirectory() as temp:
            piece = Path(temp) / 'piece'
            shutil.copytree(ROOT / 'fixtures/ve/my-test-19s', piece)
            (piece / 'spec.json').write_text(json.dumps(spec), encoding='utf-8')
            (piece / 've').mkdir()
            (piece / 've' / 'engine.json').write_text(json.dumps({'at': '2026-11-19T00:00:00Z'}), encoding='utf-8')
            result = self.cli('lint', str(piece / 'spec.json'))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('is legacy: composition and design approval are enforced at packet time', result.stdout)

    def test_cli_lock_check_and_show(self):
        result = self.cli('lock', 'check')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('design lock: valid', result.stdout)
        result = self.cli('lock', 'show', FMT)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout), designlock.load()['formats'][FMT])

    def test_cli_freeze_default_and_explicit_mapping(self):
        for i in range(1, 6):
            Image.new('RGB', (1080, 1920), (20, 50, 30)).save(self.src / f'f{i}.png')
        with patch.object(designlock, 'ROOT', self.root), redirect_stdout(io.StringIO()):
            with patch.object(sys, 'argv', ['ve', 'lock', 'freeze', FMT, '--from', str(self.src)]):
                self.assertEqual(ve.main(), 0)
            with patch.object(sys, 'argv', ['ve', 'lock', 'freeze', FMT, '--from', str(self.src),
                                           '--map', *[f'{k}={v}' for k, v in self.mapping.items()], '--force']):
                self.assertEqual(ve.main(), 0)
        self.assertTrue(designlock.frozen(designlock.load(self.path), FMT, self.root)[0])


if __name__ == '__main__':
    unittest.main()
