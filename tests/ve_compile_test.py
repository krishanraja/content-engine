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
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib.common import load_json, run
from velib.compile import compile_cut, source, caption_line_count, _caption_groups, _text_width, ENDING_FRAMES, sting_problems
from velib import compile as ve_compile
from velib.render import render, check_asset_hashes
import ve

intro = ve_compile._intro()  # scripts/quick-edit/intro.py, the sting's one reader

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
        # The last beat runs through the ending band so BrandFrame stays mounted and draws it.
        self.assertEqual(whole['beats'][-1]['toFrame'], base + ENDING_FRAMES)
        self.assertEqual(excerpt['beats'][-1]['toFrame'], base)
        self.assertTrue(all(o['toFrame'] == base + ENDING_FRAMES for o in whole['objects'] if o['toFrame'] > base - 1
                            and o['toFrame'] >= excerpt['beats'][-1]['fromFrame']))
        # Every whole cut closes on the ending band, with or without a dated call (Krish, 2026-11-03: "We fucking
        # have standards for intro, background audio and outro").
        del spec['call']
        self.assertEqual(compile_cut(spec, 'proof-tall', words, FIXTURE)['ending'], {'fromFrame': base, 'url': whole['series']['site']})

    def test_motion_style_passes_through(self):
        spec = load_json(FIXTURE / 'spec.json')
        words = timed_words()
        house = compile_cut(spec, 'proof-tall', words, FIXTURE)
        self.assertNotIn('motion', house, 'no style.motion: the cut renders with the house motion, unchanged')
        table = load_json(ROOT / 'apps/renderer/src/engine/kit/motion-profiles.json')
        spec.setdefault('style', {})['motion'] = {'module': 'dark-keynote', 'reason': 'test'}
        styled = compile_cut(spec, 'proof-tall', words, FIXTURE)
        self.assertEqual(styled['motion'], {'style': 'dark-keynote', 'profile': table['profiles']['dark-keynote']})
        self.assertEqual({k: v for k, v in styled.items() if k != 'motion'}, house, 'the style changes nothing else')
        spec['style']['motion']['module'] = 'toy-3d'
        self.assertEqual(compile_cut(spec, 'proof-tall', words, FIXTURE)['motion'], {'style': 'toy-3d'})
        spec['style']['motion']['module'] = 'no-such-style'
        with self.assertRaisesRegex(ValueError, 'not a motion style'):
            compile_cut(spec, 'proof-tall', words, FIXTURE)
        # The renderer accepts what compile emits, with and without a style.
        spec['style']['motion']['module'] = 'living-ui'
        for props in (house, compile_cut(spec, 'proof-tall', words, FIXTURE)):
            code = (NODE_TYPESCRIPT +
                    "const { EngineRenderPropsSchema } = require('./apps/renderer/src/engine/props.ts'); "
                    "EngineRenderPropsSchema.parse(JSON.parse(fs.readFileSync(0, 'utf8')))")
            result = run(['node', '-e', code], input=json.dumps(props), env={**os.environ, 'npm_config_offline': 'true'})
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_first_word_entrances_land_on_frame_zero(self):
        # Krish, 2026-11-03: "We fucking have standards for intro, background audio and outro". An entrance on the
        # cut's first word is on screen from frame 0; later events keep their word's frame.
        spec = load_json(FIXTURE / 'spec.json')
        words = timed_words()
        first = spec['cuts']['proof-tall']['beats'][0]
        entrances = [e for e in first['events'] if e['verb'] == 'enter' and e['at_w'] == first['span']['from_w']]
        self.assertTrue(entrances)
        props = compile_cut(spec, 'proof-tall', words, FIXTURE)
        for event in props['events']:
            if event['id'].startswith(first['id'] + '-') and event['verb'] == 'enter' and event['obj'] in {e['obj'] for e in entrances}:
                self.assertEqual(event['atFrame'], 0)
        # Text typed on the first word is typed on frame 0 too (Thursday 5 Nov: the card landed whole, empty).
        typed = json.loads(json.dumps(spec))
        hook = typed['cuts']['proof-tall']['beats'][0]
        typed['objects'].append({'obj': 'note', 'device': 'typing_bubble', 'meaning': 'the opening notification',
                                 'persist': {'from_beat': hook['id'], 'to_beat': hook['id']},
                                 'params': {'kind': 'notification', 'rows': [{'text': 'Done! Booked it'}]}})
        hook['uses'] = list(hook.get('uses', [])) + ['note']
        hook['events'] += [{'at_w': hook['span']['from_w'], 'obj': 'note', 'verb': verb, 'to_state': state, 'silent': True}
                           for verb, state in (('enter', 'visible'), ('type', '0'))]
        late = [dict(word, onset_s=word['onset_s'] + 1.0, end_s=word['end_s'] + 1.0) for word in words]
        props = compile_cut(typed, 'proof-tall', late, FIXTURE)
        self.assertEqual(sorted((e['verb'], e['atFrame']) for e in props['events'] if e['obj'] == 'note'),
                         [('enter', 0), ('type', 0)])

    def test_caption_pages_break_where_a_reader_would(self):
        # Thursday 5 Nov: "really helpful but a bit | dangerous", "myself. I just put", "groceries, Google".
        def pages(text, gap=10):
            rows = [{'w': i, 'text': t, 'atFrame': i * gap} for i, t in enumerate(text.split())]
            return [' '.join(r['text'] for r in g) for g in _caption_groups(rows)]
        got = pages('Amazon for your groceries, Google for your emails, it can get a bit dangerous.')
        self.assertIn('Amazon for your groceries,', got)
        self.assertIn('Google for your emails,', got)
        got = pages('I didn\'t even write this myself. I just put one prompt into my AI tool')
        self.assertFalse([p for p in got if 'myself.' in p and not p.endswith('myself.')], got)
        for page in pages('really cool features and really helpful but a bit dangerous because once they\'re connected')[:-1]:
            self.assertNotIn(page.split()[-1], {'a', 'the', 'but', 'once'}, page)

    def test_word_captions_are_one_word_a_page_under_the_title(self):
        # Krish, 2026-11-03: "its the georgia subtitles build".
        spec = load_json(FIXTURE / 'spec.json')
        spec['brand'] = {**spec['brand'], 'captions': 'word', 'title': 'Give your AI two rules'}
        cut_id = next(iter(spec['cuts']))
        props = compile_cut(spec, cut_id, timed_words(), FIXTURE)
        self.assertEqual(props['captionStyle'], 'word')
        self.assertEqual(props['title'], 'Give your AI two rules')
        self.assertEqual({len(page['words']) for page in props['captions']}, {1})
        for page, after in zip(props['captions'], props['captions'][1:]):
            self.assertEqual(page['toFrame'], after['fromFrame'])

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
        # Thursday 5 Nov: a page never ends on a word the next page replaces within 6 frames, when a split allows it.
        timed = [{'w': i, 'text': t, 'atFrame': f} for i, (t, f) in enumerate(
            [('one', 1144), ('easy', 1149), ('step', 1159), ('so', 1167), ('you', 1171), ('can', 1173),
             ('save', 1178), ('yourself', 1186), ('and', 1199), ('enjoy', 1201)])]
        # A page never jumps between the SPLIT zone and the house zone mid-phrase; a lone word keeps its neighbour.
        from velib.compile import _zone_runs
        beats = [{'layout': 'SPLIT', 'fromFrame': 0, 'toFrame': 1160}, {'layout': 'P1', 'fromFrame': 1160, 'toFrame': 1300}]
        runs = [[r['text'] for r in run] for run in _zone_runs(timed, beats)]
        self.assertEqual(runs, [['one', 'easy', 'step'], ['so', 'you', 'can', 'save', 'yourself', 'and', 'enjoy']])
        lone = [{'layout': 'SPLIT', 'fromFrame': 0, 'toFrame': 1145}, {'layout': 'P1', 'fromFrame': 1145, 'toFrame': 1300}]
        self.assertEqual(len(_zone_runs(timed, lone)), 1)
        pages = [[r['text'] for r in g] for g in _caption_groups(timed)]
        self.assertNotIn(['one', 'easy', 'step', 'so', 'you'], pages)
        for page, following in zip(pages, pages[1:]):
            last = next(r for r in timed if r['text'] == page[-1])['atFrame']
            self.assertGreaterEqual(next(r for r in timed if r['text'] == following[0])['atFrame'] - last, 6, pages)

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
        report = {'sfx_missing': ['event'], 'blocking': False, 'file': 'missing',
                  'sha256': 'hash', 'measured_pass': True, 'complete': True}
        # ve status and ve file share packet.readiness, which reads compile.<cut>.json through verdict.read.
        with patch('velib.lint.lint', return_value=(spec, [])), \
                patch('ve.spec_path_for', return_value=Path('spec.json')), \
                patch('ve.Path.exists', side_effect=lambda: True), \
                patch('ve.load_json', return_value=report), \
                patch('velib.packet.verdict.read', return_value=report), \
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


class StingTest(unittest.TestCase):
    """The makeyourmindup intro sting in front of the 16:9 whole cut of a weekly series piece (Krish, 2026-11-05: "I
    think it should go at the start of the longer wide videos 100%,"), on a stand-in config and synthetic clips
    (intro.stand_in, under .cache, where the stand-in config is honoured), never his. The fixture is a mind.the.gap
    piece published on a Friday, its series' own day, with a voiceover master: the wide twin is proof-wide as a whole
    cut."""

    @classmethod
    def setUpClass(cls):
        (ROOT / '.cache').mkdir(exist_ok=True)
        cls.temp = tempfile.TemporaryDirectory(dir=ROOT / '.cache', prefix='ve-sting-test-')
        cls.addClassCleanup(cls.temp.cleanup)
        cls.work = Path(cls.temp.name)
        cls.approved, cls.clips = intro.stand_in(cls.work / 'approved')
        cls.candidate, _ = intro.stand_in(cls.work / 'candidate', status='candidate')
        cls.entry = intro.load(cls.approved)['clips']['16x9']['mind_the_gap']

    def env(self, config, clips=None):
        return patch.dict(os.environ, {intro.CONFIG_ENV: str(config), intro.CLIPS_ENV: str(clips or self.clips)})

    def empty(self):
        return Path(tempfile.mkdtemp(dir=self.work, prefix='empty-'))

    def wide(self, day='2026-10-23'):
        spec = load_json(FIXTURE / 'spec.json')
        spec['publish_day'] = day
        spec['cuts']['proof-wide']['excerpt'] = False
        return spec

    def test_the_wide_whole_cut_opens_on_its_series_sting_and_no_frame_moves(self):
        spec, words = self.wide(), timed_words()
        with self.env(self.candidate):
            waiting = {}
            hook = compile_cut(spec, 'proof-wide', words, FIXTURE, report=waiting)
        with self.env(self.approved):
            report = {}
            props = compile_cut(spec, 'proof-wide', words, FIXTURE, report=report)
        self.assertEqual(props['sting'], {'src': str((self.clips / Path(self.entry['library']).name).resolve()),
                                          'series': 'mind_the_gap', 'frames': 56, 'sha256': self.entry['sha256']})
        # In front of the cut, never in it: every frame is the hook-first cut's, and durationFrames leaves the sting out.
        self.assertEqual({k: v for k, v in props.items() if k != 'sting'}, hook)
        base = round(words[-1]['end_s'] * 30) + 12
        self.assertEqual(props['durationFrames'], base + ENDING_FRAMES)
        self.assertEqual((props['beats'][0]['fromFrame'], props['beats'][0]['sectionBeat']), (0, True))
        self.assertEqual(props['ending']['fromFrame'], base)
        self.assertEqual(props['audio']['stem']['trimBeforeFrames'], 0)
        # A voiceover master (no take segment) gets it too: his words cover every wide long cut.
        self.assertEqual((spec['audio']['master'], props['segments']), ('vo', []))
        self.assertEqual(report['opening'], 'sting')
        self.assertEqual(report['sting'], {'series': 'mind_the_gap', 'frames': 56, 'clip_sha256': self.entry['sha256'],
                                           'source_sha256': intro.source_hash(intro.load(self.approved)),
                                           'library': self.entry['library']})
        # A candidate leaves the wide cut on its hook and says why.
        self.assertNotIn('sting', hook)
        self.assertEqual(waiting['opening'], 'hook')
        self.assertIn('candidate', waiting['opening_why'])

    def test_no_sting_on_the_tall_cut_an_excerpt_or_an_off_day(self):
        tall = load_json(FIXTURE / 'spec.json')
        tall['cuts']['proof-tall']['excerpt'] = False
        cases = (('the 9:16 whole cut', tall, 'proof-tall'),
                 ('a 16:9 proof excerpt', load_json(FIXTURE / 'spec.json'), 'proof-wide'),
                 ('a 16:9 whole cut on an off day (a mind.the.gap piece on a Thursday)', self.wide('2026-10-22'), 'proof-wide'))
        # None of them reads the sting's config: an approved one, or one that cannot be read, changes nothing.
        for config in (self.approved, self.work / 'no-such-sting.json'):
            for name, spec, cut in cases:
                with self.subTest(name, config=config.name), self.env(config):
                    report = {}
                    props = compile_cut(spec, cut, timed_words(), FIXTURE, report=report)
                    self.assertNotIn('sting', props)
                    self.assertEqual(report['opening'], 'hook')
                    self.assertFalse({'sting', 'opening_why'} & set(report))
        off = compile_cut(self.wide('2026-10-22'), 'proof-wide', timed_words(), FIXTURE)
        self.assertEqual(off['series']['label'], 'off.day')

    def test_an_approved_sting_is_fetched_or_the_wide_cut_is_refused(self):
        spec, words = self.wide(), timed_words()
        name = Path(self.entry['library']).name

        def fetched(cfg, clips=None, out=print, only=None, **_):
            # The library hands back the clip Krish saw (a fake engine: nothing is downloaded).
            for shape, series in only:
                shutil.copy(self.clips / Path(cfg['clips'][shape][series]['library']).name, intro.clips_dir() / name)
            return intro.clips_dir(), len(only), []

        here = self.empty()
        with self.env(self.approved, here), patch.object(intro, 'fetch', side_effect=fetched) as fetch:
            props = compile_cut(spec, 'proof-wide', words, FIXTURE)
        self.assertEqual(fetch.call_args.kwargs['only'], [('16x9', 'mind_the_gap')])
        self.assertEqual(props['sting']['src'], str((here / name).resolve()))
        self.assertEqual(props['sting']['sha256'], self.entry['sha256'])
        refusals = (
            ('the library does not hold the clip yet', lambda *a, **k: (self.empty(), 0, [name]), 'not in the library yet'),
            ('this machine has no engine key', intro.IntroError('no engine key here, so it cannot be fetched'), 'no engine key'),
            ('the download breaks off', OSError('connection reset'), 'connection reset'),
        )
        for why, fake, said in refusals:
            with self.subTest(why), self.env(self.approved, self.empty()), patch.object(intro, 'fetch', side_effect=fake):
                with self.assertRaisesRegex(ValueError, f'approved intro sting.*{said}'):
                    compile_cut(spec, 'proof-wide', words, FIXTURE)
        # A clip with other bytes under the right name is not the clip Krish saw: fetched again, and refused when the
        # library cannot give the right one.
        wrong = self.empty()
        (wrong / name).write_bytes(b'not the clip')
        with self.env(self.approved, wrong), patch.object(intro, 'fetch', return_value=(wrong, 0, [name])):
            with self.assertRaisesRegex(ValueError, 'approved intro sting'):
                compile_cut(spec, 'proof-wide', words, FIXTURE)
        # Clips that are not the ones he approved, or a config that cannot be read, refuse the wide cut too.
        changed = self.work / 'changed.json'
        cfg = json.loads(self.approved.read_text(encoding='utf-8'))
        changed.write_text(json.dumps(dict(cfg, source_sha256='0' * 64)), encoding='utf-8')
        for config, said in ((changed, 'not the ones Krish approved'), (self.work / 'no-such-sting.json', 'cannot be read')):
            with self.subTest(said), self.env(config), self.assertRaisesRegex(ValueError, said):
                compile_cut(spec, 'proof-wide', words, FIXTURE)

    def test_his_word_puts_the_episode_card_where_the_sting_would_be(self):
        # Krish, 2026-11-09, of Wednesday 11 Nov: "I don't want the overall brand intro to come in. I want the episode
        # card to come in." brand.opening_exception, in his words, leaves the sting out of that piece's wide cut only.
        said = "I don't want the overall brand intro to come in. I want the episode card to come in."
        spec, words = self.wide(), timed_words()
        spec['brand']['opening_exception'] = {'opening': 'episode_card', 'said': said, 'on': '2026-11-09'}
        with self.env(self.approved):
            report = {}
            props = compile_cut(spec, 'proof-wide', words, FIXTURE, report=report)
            plain = compile_cut(self.wide(), 'proof-wide', words, FIXTURE)
        self.assertNotIn('sting', props)
        self.assertEqual(props['opening'], {'kind': 'episode_card', 'said': said, 'on': '2026-11-09'})
        self.assertEqual(report['opening'], 'episode_card')
        self.assertIn(said, report['opening_why'])
        self.assertIn('sting', plain)  # every other series wide cut still opens on the approved sting
        with self.env(self.approved):
            self.assertFalse([p for p in sting_problems(props) if 'opens on the approved intro sting' in p])
            unsaid = dict(props, opening={'kind': 'episode_card', 'said': 'no', 'on': '2026-11-09'})
            self.assertTrue([p for p in sting_problems(unsaid) if 'opens on the approved intro sting' in p])
        code = (NODE_TYPESCRIPT +
                "const { EngineRenderPropsSchema } = require('./apps/renderer/src/engine/props.ts'); "
                "const parsed = EngineRenderPropsSchema.parse(JSON.parse(fs.readFileSync(0, 'utf8'))); "
                "process.stdout.write(JSON.stringify(parsed.opening))")
        result = run(['node', '-e', code], input=json.dumps(props), env={**os.environ, 'npm_config_offline': 'true'})
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(json.loads(result.stdout)['kind'], 'episode_card')

    def test_the_renderer_accepts_the_stinged_props(self):
        with self.env(self.approved):
            props = compile_cut(self.wide(), 'proof-wide', timed_words(), FIXTURE)
        code = (NODE_TYPESCRIPT +
                "const { EngineRenderPropsSchema } = require('./apps/renderer/src/engine/props.ts'); "
                "const parsed = EngineRenderPropsSchema.parse(JSON.parse(fs.readFileSync(0, 'utf8'))); "
                "process.stdout.write(JSON.stringify(parsed.sting))")
        result = run(['node', '-e', code], input=json.dumps(props), env={**os.environ, 'npm_config_offline': 'true'})
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(json.loads(result.stdout), props['sting'])

    def test_premix_lays_his_voice_and_every_lift_after_the_sting(self):
        # ve premix reads the sting from the props alone: the stem runs the sting plus the cut, and his first word, his
        # last word and each chapter lift (given on the cut's own clock) move by exactly its 56 frames.
        with self.env(self.approved):
            props = compile_cut(self.wide(), 'proof-wide', timed_words(), FIXTURE)
        words = timed_words()
        track = next(t for t in load_json(ve.MUSIC_LEDGER)['tracks'] if t['id'] == self.wide()['audio']['bed']['ledger_id'])
        real_load = load_json

        def read(path):
            return {'props.json': props, 'words.json': words}.get(Path(path).name) or real_load(path)

        def premixed(stem_props):
            args = Namespace(spec='spec.json', cut='proof-wide', dialogue='dialogue.wav', words='words.json', props='props.json',
                             out=str(self.empty() / 'audio.proof-wide.wav'), lift=['4.0-6.5'])
            with patch('velib.lint.lint', return_value=(self.wide(), [])), patch('ve.load_json', side_effect=read), \
                    patch.dict(os.environ, {'MINDMAKE_MUSIC_ROOT': str(self.work)}), \
                    patch('velib.common.sha256_file', return_value=track['sha256']), \
                    patch('velib.audio.premix', return_value={'stem': 's', 'integrated_lufs': -14, 'true_peak_dbtp': -1.5,
                                                              'lead_frames': 0, 'bed': {}}) as mix, \
                    redirect_stdout(io.StringIO()):
                props.clear()
                props.update(stem_props)
                self.assertEqual(ve.cmd_premix(args), 0)
            return mix.call_args

        stinged = copy.deepcopy(props)
        plain = premixed({k: v for k, v in stinged.items() if k != 'sting'})
        lead = premixed(stinged)
        lead_s = 56 / 30
        self.assertEqual(plain.kwargs['lead_frames'], 0)
        self.assertEqual(lead.kwargs['lead_frames'], 56)
        self.assertAlmostEqual(lead.args[4], (56 + stinged['durationFrames']) / 30)
        self.assertAlmostEqual(lead.args[4] - plain.args[4], lead_s)
        for key in ('voice_start_s', 'last_word_end_s'):
            self.assertAlmostEqual(lead.kwargs[key] - plain.kwargs[key], lead_s)
        self.assertAlmostEqual(plain.kwargs['voice_start_s'], words[0]['onset_s'])
        self.assertEqual(plain.kwargs['lifts'], [[4.0, 6.5]])
        self.assertEqual(lead.kwargs['lifts'], [[4.0 + lead_s, 6.5 + lead_s]])

    def stinged(self, lead_frames=56, sidecar=True):
        """Compiled stinged props whose stem sits in a temp folder, with the sidecar ve premix writes."""
        with self.env(self.approved):
            props = compile_cut(self.wide(), 'proof-wide', timed_words(), FIXTURE)
        folder = self.empty()
        props['audio']['stem']['src'] = str(folder / 'audio.proof-wide.wav')
        if sidecar:
            (folder / 'audio.proof-wide.bed.json').write_text(json.dumps({'lead_frames': lead_frames}), encoding='utf-8')
        return props

    def test_render_takes_only_the_approved_clip_with_a_stem_made_for_it(self):
        props = self.stinged()
        with self.env(self.approved):
            self.assertEqual(sting_problems(props), [])
            wrong = copy.deepcopy(props)
            wrong['sting']['sha256'] = 'f' * 64
            self.assertRegex(' '.join(sting_problems(wrong)), 'not the approved mind_the_gap clip')
            stale = {k: v for k, v in props.items() if k != 'sting'}
            self.assertRegex(' '.join(sting_problems(stale)), 'compiled before the approval')
            self.assertRegex(' '.join(sting_problems(self.stinged(lead_frames=0))), 'premixed with 0 frames.*opens on 56')
            self.assertRegex(' '.join(sting_problems(self.stinged(sidecar=False))), 'no ve premix sidecar')
            # A tall or off-day cut without a sting is not this check's business, unless its stem was made for one.
            plain = dict(stale, audio=dict(stale['audio'], stem={'src': str(self.empty() / 'audio.wav'), 'trimBeforeFrames': 0}))
            for change in ({'aspect': '9:16'}, {'series': dict(stale['series'], label='off.day')}):
                self.assertEqual(sting_problems(dict(plain, **change)), [])
                self.assertRegex(' '.join(sting_problems(dict(stale, **change))), 'premixed with 56 frames.*opens on 0')
        with self.env(self.candidate):
            self.assertRegex(' '.join(sting_problems(props)), 'only a sting Krish approved opens a cut')
        with self.env(self.work / 'no-such-sting.json'):
            self.assertRegex(' '.join(sting_problems(props)), 'cannot be read')
        # ve render stops before anything renders.
        props_file = self.empty() / 'props.proof-wide.json'
        wrong = copy.deepcopy(props)
        wrong['sting']['sha256'] = 'f' * 64
        props_file.write_text(json.dumps(wrong), encoding='utf-8')
        args = Namespace(spec='spec.json', props=str(props_file), assets_dir=FIXTURE, out='out.mp4', scale=1)
        with self.env(self.approved), patch('velib.lint.lint', return_value=(self.wide(), [])), \
                patch('velib.render.check_asset_hashes'), patch('velib.preflight.problems', return_value=[]), \
                patch('ve.render_refusal', return_value=[]), patch('velib.render.render') as draw, \
                redirect_stdout(io.StringIO()) as output:
            self.assertEqual(ve.cmd_render(args), 1)
        draw.assert_not_called()
        self.assertIn('not the one Krish approved', output.getvalue())


if __name__ == '__main__':
    unittest.main()
