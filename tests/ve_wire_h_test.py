"""Format H spec/compile/staging contract. No browser or render is launched."""
import copy
import json
import os
from pathlib import Path
import subprocess
import sys
import shutil
from contextlib import contextmanager
from uuid import uuid4
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
sys.path.insert(0, str(ROOT / 'tests'))
from ve_compile_test import NODE_TYPESCRIPT
from velib.common import load_json, run
from velib.compile import compile_cut, source
from velib.lint import lint, crew_lints

FIXTURE = ROOT / 'fixtures/ve/hand-held-screen'


@contextmanager
def staging_directory():
    # Python 3.14 mkdtemp's private Windows ACL excludes the sandbox token.
    # A normal inherited-ACL directory stays inside this card's fixture allowlist.
    directory = FIXTURE / ('staging-test-' + uuid4().hex)
    directory.mkdir()
    try:
        yield directory
    finally:
        assert directory.resolve().is_relative_to(FIXTURE.resolve())
        shutil.rmtree(directory)


class WireHTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.spec = load_json(FIXTURE / 'spec.json')
        cls.words = load_json(FIXTURE / 'words.test.json')['words']
        cls.props = compile_cut(cls.spec, 'proof-tall', cls.words, ROOT)

    def test_lints_without_legacy_note(self):
        spec, findings = lint(FIXTURE / 'spec.json')
        self.assertIsNotNone(spec)
        self.assertEqual(findings, [])
        self.assertEqual(spec['format'], 'hand-held-screen')

    def test_beats_and_keyframes(self):
        names = load_json(ROOT / 'config/ve/design-lock.json')['formats']['hand-held-screen']['beats']
        self.assertEqual([b['id'] for b in self.props['beats']], names)
        self.assertEqual(set(b['layout'] for b in self.props['beats']), {'STAGE'})
        for beat in self.props['beats']:
            self.assertEqual(beat['keyFrame'], beat['fromFrame'] + round(.8 * (beat['toFrame'] - beat['fromFrame'])))
            self.assertTrue(any(label['fromFrame'] <= beat['fromFrame'] and label['toFrame'] >= beat['toFrame']
                                and label['text'] == 'ILLUSTRATION' for label in self.props['illustrationLabels']))
            objects = {o['obj']: o for o in self.props['objects']}
            self.assertEqual(sum(objects[o]['device'] == 'scribble' for o in beat['uses']), 1)

    def test_params_survive_without_mutation(self):
        before = copy.deepcopy(self.spec)
        objects = {o['obj']: o for o in self.props['objects']}
        for obj in self.spec['objects']:
            expected = copy.deepcopy(obj['params'])
            if obj['device'] == 'hand_phone_stage':
                expected['glass']['footage']['src'] = source('xinxiang.mp4', ROOT)
            self.assertEqual(objects[obj['obj']]['params'], expected)
        self.assertEqual(self.spec, before)

    def test_devices_verbs_events_and_camera_cues(self):
        devices = load_json(ROOT / 'config/ve/devices.json')['devices']
        objects = {o['obj']: o for o in self.spec['objects']}
        for obj in objects.values():
            self.assertIn(obj['device'], devices)
        for beat, compiled in zip(self.spec['cuts']['proof-tall']['beats'], self.props['beats']):
            self.assertTrue(any(e['obj'] == 'phone' and e['verb'] == 'move' and e['at_w'] == beat['span']['from_w']
                                and e['to_state'] == beat['id'] for e in beat['events']))
            for event in beat['events']:
                self.assertIn(event['verb'], devices[objects[event['obj']]['device']]['verbs'])
                frame = round(self.words[event['at_w']]['onset_s'] * 30)
                self.assertTrue(compiled['fromFrame'] <= frame < compiled['toFrame'])
        fills = [e['toState'] for e in self.props['events'] if e['obj'] == 'phone' and e['verb'] == 'fill']
        self.assertEqual(fills, ['prompt', 'cards', 'cards', 'footage', 'bubble'])

    def test_engine_and_device_schemas_and_static_devices(self):
        code = NODE_TYPESCRIPT + r"""
const { EngineRenderPropsSchema } = require('./apps/renderer/src/engine/props.ts');
const { DEVICES } = require('./apps/renderer/src/engine/devices/registry.ts');
const { renderToStaticMarkup } = require('react-dom/server');
const React = require('react');
const props = EngineRenderPropsSchema.parse(JSON.parse(fs.readFileSync(0, 'utf8')));
for (const object of props.objects) {
  require('./apps/renderer/src/engine/devices/' + object.device + '/schema.ts').ParamsSchema.parse(object.params);
}
// Exercise actual device fit/visibility without launching Chromium.
const errors=[];
for (const kind of ['prompt','cards','bubble']) {
  const phone=props.objects.find(o=>o.obj==='phone');
  const module=require('./apps/renderer/src/engine/kit/glass/'+kind+'.tsx');
  const Glass=module[kind[0].toUpperCase()+kind.slice(1)];
  const variants=kind==='cards'?Object.values(phone.params.glass.cards):[phone.params.glass[kind]];
  for (const params of variants) try {
    renderToStaticMarkup(React.createElement(Glass,{params,tokens:props.tokens,frame:100,sinceFrames:100,k:kind==='bubble'?1.55:1.9}));
  } catch(error) { errors.push(kind+': '+error.message); }
}

for (const beat of props.beats) for (const id of beat.uses) {
  const object = props.objects.find(o => o.obj === id);
  if (object.device === 'hand_phone_stage') continue;
  try { renderToStaticMarkup(React.createElement(DEVICES[object.device], {
    object, events: props.events, frame: beat.keyFrame, tokens: props.tokens,
    aspect: props.aspect, box: {left:0,top:0,width:1080,height:1920}
  })); } catch(error) { errors.push(id + ': ' + error.message); }
}
if(errors.length) throw new Error(errors.join('\n'));
"""
        result = run(['node', '-e', code], input=json.dumps(self.props))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_cards_follow_the_camera_without_changing_public_params(self):
        code = NODE_TYPESCRIPT + r"""
const { phoneState } = require('./apps/renderer/src/engine/devices/hand_phone_stage/state.ts');
const p = JSON.parse(fs.readFileSync(0, 'utf8')), o = p.objects.find(o=>o.obj==='phone');
const result = p.beats.slice(1,3).map(b => phoneState(o,p.events,b.keyFrame).glass.at(-1).camera);
console.log(JSON.stringify(result));
"""
        result = run(['node', '-e', code], input=json.dumps(self.props))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout), ['result_a', 'result_b'])

    def test_unrelated_plate_source_is_still_refused(self):
        spec = copy.deepcopy(self.spec)
        spec['assets'].append(dict(id='other', path='other.png'))
        spec['cuts']['proof-tall']['beats'][0]['plate']['source'] = 'asset:other'
        with self.assertRaisesRegex(ValueError, 'asset plates arrive in Phase 2'):
            compile_cut(spec, 'proof-tall', self.words, ROOT)
        spec['assets'][-1]['path'] = 'plates/hand-held-screen/phone-bezel.png'
        compile_cut(spec, 'proof-tall', self.words, ROOT)
        with patch('velib.compile.Path.is_file', return_value=False):
            with self.assertRaisesRegex(ValueError, 'asset plates arrive in Phase 2'):
                compile_cut(spec, 'proof-tall', self.words, ROOT)

    def test_lint_guards_scribble_count_and_beat_names(self):
        spec = copy.deepcopy(self.spec)
        beat = spec['cuts']['proof-tall']['beats'][0]
        spec['objects'].append(dict(spec['objects'][0], obj='extra', device='scribble'))
        beat['uses'].append('extra')
        self.assertTrue(any('scribbles_per_beat' in finding for finding in crew_lints(spec)))
        beat['id'] = 'wrong'
        self.assertTrue(any('beat ids must be' in finding for finding in crew_lints(spec)))

    def test_staging_and_missing_plate_fail_before_browser(self):
        with staging_directory() as directory:
            dest = Path(directory)
            props = copy.deepcopy(self.props)
            # Use small existing bytes to exercise copy/path rewrites, not media decoding.
            src = str((FIXTURE / 'spec.json').resolve())
            for image in props['brand'].values(): image['src'] = src
            props['audio']['stem']['src'] = src
            props['audio']['sfx'] = []
            props['segments'] = []
            props['objects'][0]['params']['glass']['footage']['src'] = src
            code = r"""
import { stageRenderAssets } from './apps/renderer/scripts/ve-render.mjs';
import fs from 'node:fs/promises';
const p=JSON.parse(await fs.readFile(process.argv[1],'utf8'));
await stageRenderAssets(p,process.argv[1],process.argv[2],process.argv[3]);
console.log(JSON.stringify(p));
"""
            payload = dest / 'props.json';payload.write_text(json.dumps(props), encoding='utf-8')
            public = dest / 'public';public.mkdir()
            result = run(['node', '--input-type=module', '-e', code, str(payload), str(public), str(ROOT)])
            self.assertEqual(result.returncode, 0, result.stderr)
            staged = json.loads(result.stdout)
            self.assertTrue(staged['objects'][0]['params']['glass']['footage']['src'].startswith('/public/asset-'))
            plate = public / 'plates/hand-held-screen/phone-bezel.png'
            self.assertEqual(plate.read_bytes(), (ROOT / 'assets/plates/hand-held-screen/phone-bezel.png').read_bytes())
            missing_root = dest / 'missing'; plates = missing_root / 'assets/plates/hand-held-screen';plates.mkdir(parents=True)
            (plates / 'plates.json').write_text(json.dumps({'files':{'absent.png':'missing plate'}}))
            result = run(['node', '--input-type=module', '-e', code, str(payload), str(public), str(missing_root)])
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('absent.png', result.stderr)


if __name__ == '__main__':
    unittest.main()
