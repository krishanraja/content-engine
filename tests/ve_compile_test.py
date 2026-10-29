"""Compile the real 19-second proof and validate both sides of the handoff.

Run from the repository root: python tests/ve_compile_test.py
Node validation uses installed tools only; it must never download packages.
"""
from __future__ import annotations

import copy
import io
import hashlib
from argparse import Namespace
from contextlib import redirect_stdout
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib.common import load_json, run
from velib.compile import compile_cut, source, caption_line_count, _caption_groups, _text_width, ENDING_FRAMES
from velib.render import render, check_asset_hashes
import ve

FIXTURE = ROOT / 'fixtures/ve/my-test-19s'

# In-process transpilation avoids tsx/esbuild child processes denied by the
# Windows sandbox. Use installed TypeScript only, with no package downloads.
NODE_TYPESCRIPT = r"""
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const resolve = Module._resolveFilename;
Module._resolveFilename = function(id, parent, ...rest) {
  try { return resolve.call(this, id, parent, ...rest); }
  catch (error) {
    if (id.startsWith('.') && id.endsWith('.js'))
      return resolve.call(this, id.slice(0, -3) + '.ts', parent, ...rest);
    throw error;
  }
};
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
  });
  module._compile(output.outputText, filename);
};
// Caption layout is pure; CSS is not part of this Node-only measurement test.
require.extensions['.css'] = () => {};
"""


def timed_words():
    # Fixture has onsets only. Explicit synthetic test ends are not an ingest
    # result; production must reject the unmodified fixture word rows.
    return [dict(word, end_s=word['onset_s'] + 0.2)
            for word in load_json(FIXTURE / 'words.frames.json')]


class CompileTest(unittest.TestCase):
    def test_undrawn_verb_refused(self):
        spec = load_json(FIXTURE / 'spec.json')
        beat = spec['cuts']['proof-tall']['beats'][0]
        event = beat['events'][0]
        obj = next(obj for obj in spec['objects'] if obj['obj'] == event['obj'])
        obj['device'] = 'query_chip'
        event['verb'] = 'carry'
        with self.assertRaises(ValueError) as caught:
            compile_cut(spec, 'proof-tall', timed_words(), FIXTURE)
        for name in (f'{beat["id"]}-0', obj['obj'], 'query_chip', 'carry'):
            self.assertIn(name, str(caught.exception))

    def test_undeclared_device_refused(self):
        spec = load_json(FIXTURE / 'spec.json')
        event = spec['cuts']['proof-tall']['beats'][0]['events'][0]
        obj = next(obj for obj in spec['objects'] if obj['obj'] == event['obj'])
        obj['device'] = 'undeclared_device'
        with self.assertRaisesRegex(ValueError, 'undeclared_device.*missing from devices.json'):
            compile_cut(spec, 'proof-tall', timed_words(), FIXTURE)

    def test_fixture(self):
        spec = load_json(FIXTURE / 'spec.json')
        words = timed_words()
        source = load_json(FIXTURE / 'script.words.json')['words']
        self.assertEqual(len(words), len(source))
        for word, original in zip(words, source):
            self.assertEqual(word['w'], original['w'])
            self.assertAlmostEqual(word['onset_s'], original['source_onset_s'] - 225.80)
            self.assertEqual(word['frame'], round(word['onset_s'] * 30))
        for cut_id, cut in spec['cuts'].items():
            props = compile_cut(spec, cut_id, words, FIXTURE)
            frames = {word['w']: round(word['onset_s'] * 30) for word in words}
            expected_events = [event for beat in cut['beats'] for event in beat['events']]
            self.assertEqual(len(props['events']), len(expected_events))
            for event, original in zip(props['events'], expected_events):
                self.assertEqual(event['atFrame'], frames[original['at_w']])
                self.assertEqual(event['obj'], original['obj'])
                self.assertEqual(event['toState'], original['to_state'])
            for index, beat in enumerate(props['beats']):
                self.assertEqual(beat['fromFrame'], frames[cut['beats'][index]['span']['from_w']])
                self.assertEqual(beat['sectionBeat'], index == 0)
            for left, right in zip(props['beats'], props['beats'][1:]):
                self.assertEqual(left['toFrame'], right['fromFrame'])
            self.assertEqual(props['beats'][-1]['toFrame'], round(words[-1]['end_s'] * 30) + 12)
            self.assertEqual(props['durationFrames'], props['beats'][-1]['toFrame'])
            by_beat = {beat['id']: beat for beat in props['beats']}
            for obj, original in zip(props['objects'], spec['objects']):
                self.assertEqual(obj['fromFrame'], by_beat[original['persist']['from_beat']]['fromFrame'])
                self.assertEqual(obj['toFrame'], by_beat[original['persist']['to_beat']]['toFrame'])
            caption_words = []
            swiped = []
            for page in props['captions']:
                self.assertTrue(2 <= len(page['words']) <= 5)
                caption_words.extend(page['words'])
                if page['swipeIndex'] is not None:
                    swiped.append(page['words'][page['swipeIndex']]['atFrame'])
            self.assertEqual([word['text'] for word in caption_words], [word['word'] for word in words])
            self.assertEqual(swiped, [frames[index] for index in cut['captions']['emphasis']])
            self.assertEqual(compile_cut(spec, cut_id, words, FIXTURE), props)
            house = next(theme for theme in load_json(ROOT / 'config/studio.json')['brand_themes']
                         if theme['theme_id'] == spec['theme'])['publication']
            self.assertEqual(props['tokens']['mint'], house['house_style']['tokens']['mint'])
            self.assertEqual(props['tokens']['channel'], house['channel_colors'][spec['brand']['series'].replace('.', '_')])

    def test_schemas(self):
        spec = load_json(FIXTURE / 'spec.json')
        words = timed_words()
        code = (NODE_TYPESCRIPT +
                "const { ProductionSpecV2Schema } = require('./packages/contracts/src/production-spec.ts'); "
                "ProductionSpecV2Schema.parse(JSON.parse(fs.readFileSync(0, 'utf8')))")
        result = run(['node', '-e', code], input=json.dumps(spec))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        for cut_id in spec['cuts']:
            props = compile_cut(spec, cut_id, words, FIXTURE)
            # Pipe JSON instead of creating props under docs/plans during tests.
            code = (NODE_TYPESCRIPT +
                    "const { EngineRenderPropsSchema } = require('./apps/renderer/src/engine/props.ts'); "
                    "EngineRenderPropsSchema.parse(JSON.parse(fs.readFileSync(0, 'utf8')))")
            result = run(['node', '-e', code], input=json.dumps(props),
                         env={**os.environ, 'npm_config_offline': 'true'})
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_word_validation(self):
        spec = load_json(FIXTURE / 'spec.json')
        words = timed_words()
        for invalid in ([], words[:-1], [dict(words[0], onset_s=-1), *words[1:]],
                        [dict(words[0], onset_s=float('nan')), *words[1:]],
                        [words[1], words[0], *words[2:]]):
            with self.assertRaises(ValueError):
                compile_cut(spec, 'proof-tall', invalid, FIXTURE)

    def test_lint_refuses_before_read_or_write(self):
        for command in (ve.cmd_compile, ve.cmd_render):
            with self.subTest(command=command.__name__), \
                    patch('velib.lint.lint', return_value=(None, ['first finding', 'second finding'])) as lint, \
                    patch('ve.load_json') as read, patch('ve.write_json') as write, \
                    patch('velib.render.render') as draw, redirect_stdout(io.StringIO()) as output:
                self.assertEqual(command(Namespace(spec='invalid.json')), 1)
                lint.assert_called_once_with(Path('invalid.json'))
                read.assert_not_called()
                write.assert_not_called()
                draw.assert_not_called()
                self.assertEqual(output.getvalue().splitlines(), ['first finding', 'second finding'])

    def test_unused_object_ignored(self):
        spec = load_json(FIXTURE / 'spec.json')
        spec['objects'].append({'obj': 'unused', 'persist': {'from_beat': 'absent', 'to_beat': 'absent'}})
        props = compile_cut(spec, 'proof-tall', timed_words(), FIXTURE)
        self.assertNotIn('unused', [obj['obj'] for obj in props['objects']])
        spec['cuts']['proof-tall']['beats'][0]['uses'].append('unused')
        with self.assertRaisesRegex(ValueError, 'persist beat missing'):
            compile_cut(spec, 'proof-tall', timed_words(), FIXTURE)

    def test_end_s_required_for_every_word(self):
        spec = load_json(FIXTURE / 'spec.json')
        for value in (None, '1.2', True, -1.0, float('nan'), float('inf')):
            words = timed_words()
            words[0]['end_s'] = value
            with self.subTest(value=value), self.assertRaisesRegex(ValueError, 'words need end_s'):
                compile_cut(spec, 'proof-tall', words, FIXTURE)
        with self.assertRaisesRegex(ValueError, 'words need end_s'):
            compile_cut(spec, 'proof-tall', load_json(FIXTURE / 'words.frames.json'), FIXTURE)

    def test_duration_and_ending(self):
        spec = load_json(FIXTURE / 'spec.json')
        words = timed_words()
        words[-1]['end_s'] += 0.8
        base = round(words[-1]['end_s'] * 30) + 12
        excerpt = compile_cut(spec, 'proof-tall', words, FIXTURE)
        self.assertEqual(excerpt['durationFrames'], base)
        self.assertNotIn('ending', excerpt)
        spec['cuts']['proof-tall']['excerpt'] = False
        whole = compile_cut(spec, 'proof-tall', words, FIXTURE)
        self.assertEqual(whole['durationFrames'], base + ENDING_FRAMES)
        self.assertEqual(whole['ending'], {'fromFrame': base, 'url': whole['series']['site']})
        self.assertEqual(whole['captions'][-1]['toFrame'], base)
        del spec['call']
        self.assertNotIn('ending', compile_cut(spec, 'proof-tall', words, FIXTURE))

    def test_the_hook_is_the_intro(self):
        # Under test (Krish, 29 Oct 2026, "Let's go with number one for now."): the first beat, the hook, owns
        # frame 0 even when the first word comes later; no story card or logo sting is compiled ahead of it, and the
        # one close is the ending band.
        spec = load_json(FIXTURE / 'spec.json')
        spec['cuts']['proof-tall']['excerpt'] = False
        words = [dict(word, onset_s=word['onset_s'] + 1.0, end_s=word['end_s'] + 1.0) for word in timed_words()]
        props = compile_cut(spec, 'proof-tall', words, FIXTURE)
        first = props['beats'][0]
        self.assertEqual((first['id'], first['fromFrame'], first['sectionBeat']),
                         (spec['cuts']['proof-tall']['beats'][0]['id'], 0, True))
        self.assertEqual(sum(beat['sectionBeat'] for beat in props['beats']), 1)
        self.assertEqual(min(obj['fromFrame'] for obj in props['objects']), 0)
        self.assertFalse({'intro', 'sting', 'storyCard', 'outro'} & set(props))
        self.assertEqual(list(props['ending']), ['fromFrame', 'url'])

    def test_caption_widths_and_long_words(self):
        spec = load_json(FIXTURE / 'spec.json')
        for cut in spec['cuts']:
            props = compile_cut(spec, cut, timed_words(), FIXTURE)
            for page in props['captions']:
                rows = [dict(word, w=i) for i, word in enumerate(page['words'])]
                emphasis = {page['swipeIndex']} if page['swipeIndex'] is not None else set()
                self.assertLessEqual(caption_line_count(rows, props['aspect'], emphasis), 2)
        for aspect in ('9:16', '16:9'):
            rows = [{'w': i, 'text': 'internationally'} for i in range(12)]
            groups = _caption_groups(rows, aspect)
            self.assertEqual(sum(map(len, groups)), 12)
            self.assertTrue(all(2 <= len(group) <= 5 for group in groups))
            self.assertTrue(all(caption_line_count(group, aspect) <= 2 for group in groups))
        with self.assertRaisesRegex(ValueError, 'W{50}'):
            _caption_groups([{'w': 0, 'text': 'W' * 50}, {'w': 1, 'text': 'ok'}])
        self.assertAlmostEqual(_text_width('A ', 68), (862 - 15 + 233 - 15) * 68 / 1000)

    def test_caption_renderer_parity(self):
        spec = load_json(FIXTURE / 'spec.json')
        for cut in spec['cuts']:
            props = compile_cut(spec, cut, timed_words(), FIXTURE)
            code = (NODE_TYPESCRIPT +
                    "const { captionLines } = require('./apps/renderer/src/engine/chrome/CaptionTrack.tsx'); "
                    "const p = JSON.parse(fs.readFileSync(0, 'utf8')); "
                    "console.log(JSON.stringify(p.captions.map(c => captionLines(c,p.aspect).length)))")
            result = run(['node', '-e', code], input=json.dumps(props))
            self.assertEqual(result.returncode, 0, result.stderr)
            expected = []
            for page in props['captions']:
                rows = [dict(word, w=i) for i, word in enumerate(page['words'])]
                expected.append(caption_line_count(rows, props['aspect'], {page['swipeIndex']}))
            self.assertEqual(json.loads(result.stdout), expected)

    def test_asset_plates_and_generated_params_refused(self):
        spec = load_json(FIXTURE / 'spec.json')
        spec['cuts']['proof-tall']['beats'][0]['plate']['source'] = 'asset:picture'
        with self.assertRaisesRegex(ValueError, 'asset plates arrive in Phase 2'):
            compile_cut(spec, 'proof-tall', timed_words(), FIXTURE)
        spec['cuts']['proof-tall']['beats'][0]['plate']['source'] = 'take'
        spec['assets'].append({'id': 'generated', 'path': 'picture.png', 'origin': 'generated'})
        for ref in ('picture.png', 'generated', 'asset:generated'):
            spec['objects'][0]['params']['extra'] = {'nested': [ref]}
            with self.assertRaisesRegex(ValueError, 'generated assets pipeline arrives in Phase 2'):
                compile_cut(spec, 'proof-tall', timed_words(), FIXTURE)

    def test_sfx_kit_present_and_absent(self):
        spec = load_json(FIXTURE / 'spec.json')
        real_load = load_json
        names = {e['sfx'] for b in spec['cuts']['proof-tall']['beats'] for e in b['events'] if e.get('sfx')}
        kit = {name: {'path': f'sfx/{name}.wav', 'gain_db': -6} for name in names}
        def read(path):
            return kit if 'sfx-kits' in str(path) else real_load(path)
        with patch('velib.compile.load_json', side_effect=read), patch('velib.compile.Path.is_file', return_value=True):
            report = {}
            props = compile_cut(spec, 'proof-tall', timed_words(), FIXTURE, report=report)
        sounded = [e for e in props['events'] if e.get('sfx')]
        self.assertEqual(report, {'lint': 'clean', 'sfx_missing': [], 'opening': 'hook'})
        self.assertEqual(props['audio']['sfx'], [
            {'src': str((FIXTURE / f"sfx/{e['sfx']}.wav").resolve()), 'atFrame': e['atFrame'], 'gainDb': -6}
            for e in sounded])
        with patch('velib.compile.Path.is_file', return_value=False):
            report = {}
            props = compile_cut(spec, 'proof-tall', timed_words(), FIXTURE, report=report)
        self.assertEqual(props['audio']['sfx'], [])
        self.assertEqual(report['sfx_missing'], [e['id'] for e in sounded])

    def test_compile_report_persisted(self):
        spec = load_json(FIXTURE / 'spec.json')
        # Intercept writes so tests never create a plan folder.
        writes = {}
        def write(path, value):
            writes[Path(path).name] = copy.deepcopy(value)
        args = Namespace(spec='spec.json', words='words.json', cut='proof-tall', assets_dir=FIXTURE)
        with patch('velib.lint.lint', return_value=(spec, [])), \
                patch('ve.load_json', return_value=timed_words()), patch('ve.write_json', side_effect=write), \
                patch('velib.common.sha256_file', return_value='digest'), \
                patch('velib.compile.Path.is_file', return_value=False), redirect_stdout(io.StringIO()):
            self.assertEqual(ve.cmd_compile(args), 0)
        report = writes['compile.proof-tall.json']
        self.assertEqual(set(report), {'lint', 'sfx_missing', 'opening', 'props_sha256'})
        self.assertEqual(report['lint'], 'clean')
        # The opening under test is recorded per cut (Krish, 29 Oct 2026: "we need to test and learn").
        self.assertEqual(report['opening'], 'hook')
        self.assertEqual(report['props_sha256'], 'digest')
        self.assertTrue(report['sfx_missing'])

    def test_source_containment(self):
        for path in ('../x', '..\\x', 'C:/x', 'C:x', '/x', 'https://x', 'HTTP://x'):
            with self.subTest(path=path), self.assertRaises(ValueError):
                source(path, FIXTURE)
        self.assertEqual(source('nested/x', FIXTURE), str((FIXTURE / 'nested/x').resolve()))

    def test_asset_hash_checker(self):
        # Hash existing fixture bytes, keeping this checker-only test read-only.
        staged = FIXTURE / 'spec.json'
        asset = {'id': 'capture', 'path': 'spec.json', 'sha256': hashlib.sha256(staged.read_bytes()).hexdigest()}
        check_asset_hashes({'assets': [asset]}, FIXTURE)
        asset['sha256'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'capture.*sha256 mismatch'):
            check_asset_hashes({'assets': [asset]}, FIXTURE)
        check_asset_hashes({'assets': [dict(asset, path='not-staged.mp4')]}, FIXTURE)
        with patch('velib.lint.lint', return_value=({'assets': [asset]}, [])), \
                patch('velib.render.render') as draw:
            with self.assertRaisesRegex(ValueError, 'capture'):
                ve.cmd_render(Namespace(spec='spec.json', assets_dir=FIXTURE))
            draw.assert_not_called()

    def test_status_blocks_missing_sfx(self):
        spec = load_json(FIXTURE / 'spec.json')
        with patch('velib.lint.lint', return_value=(spec, [])), \
                patch('ve.spec_path_for', return_value=Path('spec.json')), \
                patch('ve.Path.exists', side_effect=lambda: True), \
                patch('ve.load_json', return_value={'sfx_missing': ['event'], 'blocking': False, 'file': 'missing',
                                                   'sha256': 'hash', 'measured_pass': True, 'complete': True}), \
                patch('velib.common.sha256_file', return_value='hash'), redirect_stdout(io.StringIO()) as output:
            self.assertEqual(ve.cmd_status(Namespace(piece='piece')), 1)
        self.assertIn('sfx kit missing', output.getvalue())

    def test_render_invocation(self):
        with patch('velib.render.subprocess.run') as invoke:
            render('proof.json', 'proof.mp4', 0.5)
            args, kwargs = invoke.call_args
            self.assertEqual(args[0][0], 'node')
            self.assertTrue(args[0][1].endswith('ve-render.mjs'))
            self.assertEqual(args[0][-2:], ['--scale', '0.5'])
            self.assertTrue(kwargs['check'])
        with patch('velib.render.subprocess.run', side_effect=subprocess.CalledProcessError(1, 'node')):
            with self.assertRaises(subprocess.CalledProcessError):
                render('proof.json', 'proof.mp4')
        for scale in (0, -1, float('nan'), float('inf')):
            with self.assertRaises(ValueError):
                render('proof.json', 'proof.mp4', scale)


if __name__ == '__main__':
    unittest.main()
