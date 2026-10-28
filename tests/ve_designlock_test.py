"""Design-lock gates and golden provenance; all generated files stay in temp trees."""
from __future__ import annotations

import copy
import io
import json
import os
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
        other = 'two-passports'
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

    def fields(self):
        return dict(card_id='test', kind='device', cwd=str(self.root), write_allow='[]', read='',
                    title='test', goal='test', contract='test', acceptance='python test.py')

    def test_card_and_dispatch_refuse_before_side_effects(self):
        path = self.root / 'card.md'
        phrase = f'no frozen design lock for {FMT}: run ve lock freeze'
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
        fields = self.fields() | {'format': FMT, 'path': str(path)}
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
        result = self.cli('lint', 'fixtures/ve/my-test-19s/spec.json')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('is legacy: composition and design approval are enforced at packet time', result.stdout)

    def test_cli_lock_check_and_show(self):
        result = self.cli('lock', 'check')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('design lock: valid', result.stdout)
        result = self.cli('lock', 'show', FMT)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout), self.lock['formats'][FMT])

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
