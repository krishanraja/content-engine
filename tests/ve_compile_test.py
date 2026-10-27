"""Compile the real 19-second proof and validate both sides of the handoff.

Run from the repository root: python tests/ve_compile_test.py
Node validation uses installed tools only; it must never download packages.
"""
from __future__ import annotations

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
from velib.compile import compile_cut
from velib.render import render

FIXTURE = ROOT / 'fixtures/ve/my-test-19s'


class CompileTest(unittest.TestCase):
    def test_fixture(self):
        spec = load_json(FIXTURE / 'spec.json')
        words = load_json(FIXTURE / 'words.frames.json')
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
            self.assertEqual(props['beats'][-1]['toFrame'], frames[words[-1]['w']] + 12)
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
        words = load_json(FIXTURE / 'words.frames.json')
        result = run(['npx', '--no-install', 'tsx', 'packages/contracts/scripts/check-spec.ts', str(FIXTURE / 'spec.json')],
                     env={**os.environ, 'npm_config_offline': 'true'})
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        for cut_id in spec['cuts']:
            props = compile_cut(spec, cut_id, words, FIXTURE)
            # Pipe JSON instead of creating props under docs/plans during tests.
            code = ("const fs = require('node:fs'); "
                    "const { EngineRenderPropsSchema } = require('./apps/renderer/src/engine/props.ts'); "
                    "EngineRenderPropsSchema.parse(JSON.parse(fs.readFileSync(0, 'utf8')))")
            result = run(['node', '--require', 'tsx/cjs', '-e', code], input=json.dumps(props),
                         env={**os.environ, 'npm_config_offline': 'true'})
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_word_validation(self):
        spec = load_json(FIXTURE / 'spec.json')
        words = load_json(FIXTURE / 'words.frames.json')
        for invalid in ([], words[:-1], [dict(words[0], onset_s=-1), *words[1:]],
                        [dict(words[0], onset_s=float('nan')), *words[1:]],
                        [words[1], words[0], *words[2:]]):
            with self.assertRaises(ValueError):
                compile_cut(spec, 'proof-tall', invalid, FIXTURE)

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
