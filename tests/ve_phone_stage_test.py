"""Phone format presets and compiler capability boundaries, no media writes."""
from pathlib import Path
import sys
import subprocess
import unittest
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from velib.compile import compile_cut
from velib.common import load_json


class PhoneStageTests(unittest.TestCase):
    def test_approved_presets(self):
        fmt = load_json(ROOT / 'config/ve/formats/hand-held-screen.json')
        self.assertEqual(list(fmt['cameras']), ['open', 'result_a', 'result_b', 'evidence', 'verdict'])
        self.assertEqual([c['k'] for c in fmt['cameras'].values()], [1.8, 1.9, 2.1, 1.95, 1.55])
        self.assertEqual([c['rot'] for c in fmt['cameras'].values()], [-3, -10, -1, -104.5, -8])
        self.assertIn('hand_phone_stage', fmt['devices'])
        self.assertNotIn('hand_phone_stage', fmt['pending_devices'])
        self.assertNotIn('phone_stage', fmt['pending_devices'])
        self.assertEqual(fmt['pending_devices'], ['plate_stage', 'scribble'])
        devices = load_json(ROOT / 'config/ve/devices.json')['devices']
        self.assertEqual(devices['hand_phone_stage']['verbs'], ['enter', 'move', 'fill', 'exit'])

    def compile_with(self, device, verb):
        # A compiler fixture, not production footage or an alignment claim.
        folder = ROOT / 'fixtures/ve/my-test-19s'
        spec = load_json(folder / 'spec.json')
        beat = spec['cuts']['proof-tall']['beats'][0]
        original = beat['events'][0]
        spec['objects'] = [obj for obj in spec['objects'] if obj['obj'] == original['obj']]
        spec['objects'][0]['device'] = device
        spec['objects'][0]['params'] = {'start': 'open', 'cameras': load_json(ROOT / 'config/ve/formats/hand-held-screen.json')['cameras'], 'glass': {'blank': {}}}
        for b in spec['cuts']['proof-tall']['beats']:
            b['events'] = []
            b['uses'] = [original['obj']]
        beat['events'] = [{**original, 'verb': verb, 'to_state': 'evidence' if verb == 'move' else 'blank'}]
        words = [dict(w, end_s=w['onset_s'] + 0.2) for w in load_json(folder / 'words.frames.json')]
        return compile_cut(spec, 'proof-tall', words, folder)

    def test_move_and_fill_compile_for_phone(self):
        for verb in ['move', 'fill']:
            with self.subTest(verb=verb):
                props = self.compile_with('hand_phone_stage', verb)
                self.assertEqual(props['events'][0]['verb'], verb)
                self.assertEqual(props['objects'][0]['device'], 'hand_phone_stage')

    def test_node_geometry_and_markup_without_child_process_bundler(self):
        # Supplemental deterministic proof after the two-attempt Vitest limit.
        # Plain Img matches ending.test.ts and cannot establish image playback.
        script = r"""
const fs = require('node:fs'), ts = require('typescript'), Module = require('node:module');
const assert = require('node:assert/strict');
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}
  }).outputText, filename);
};
const React = require('react');
const actual = require('remotion'), originalLoad = Module._load;
Module._load = function(id, ...args) {
  if (id === 'remotion') return {...actual, Img:props=>React.createElement('img',props)};
  return originalLoad.call(this,id,...args);
};
const {renderToStaticMarkup} = require('react-dom/server');
const base='./apps/renderer/src/engine/';
const {Cam}=require(base+'kit/camera.ts'), {Screen,uiClipPath}=require(base+'kit/phoneGlass.ts');
const {Device,Plate}=require(base+'devices/hand_phone_stage/index.tsx');
const {phoneState}=require(base+'devices/hand_phone_stage/state.ts');
const {GLASS_KINDS}=require(base+'kit/glassRegistry.ts');
const fixture=require(base+'devices/hand_phone_stage/fixture.json');
const tokens={ink:'black',inkDeep:'black',inkSoft:'gray',cream:'ivory',mint:'green',channel:'coral'};
GLASS_KINDS.test=()=>React.createElement('div',null,'test glass');
GLASS_KINDS.footage=()=>React.createElement('div',null,'real footage');
const props={object:fixture.object,events:fixture.events,box:{left:0,top:0,width:1080,height:1920},tokens,aspect:'9:16'};
const markup=(frame,extra={})=>renderToStaticMarkup(React.createElement(Device,{...props,frame,...extra}));
assert.equal(markup(9),'');
const state=phoneState(fixture.object,fixture.events,36), html=markup(36);
assert.ok(html.includes(new Screen(state.cam).css()));
assert.ok(!/overflow:\s*visible|#[\da-fA-F]{3,8}\b/.test(html));
assert.ok(html.indexOf('data-glass-plane')<html.indexOf('<img src="plates/hand-held-screen/phone-bezel.png"'));
assert.ok(html.indexOf('<img src="plates/hand-held-screen/phone-bezel.png"')<html.indexOf('<img src="plates/hand-held-screen/phone-glass.png"'));
assert.ok(markup(72).includes('test glass'));
const footage=[...fixture.events,{id:'footage',obj:'phone',verb:'fill',toState:'footage',atFrame:90}];
assert.ok(!markup(102,{events:footage}).includes('phone-glass.png'));
for(const start of Object.keys(fixture.object.params.cameras)) {
 const object={...fixture.object,params:{...fixture.object.params,start}};
 assert.ok(markup(25,{object,events:[fixture.events[0]]}).includes('matrix3d('));
}
assert.throws(()=>Plate({name:'missing.png'}).props.onError(),/missing phone plate/);
assert.equal(new Screen(new Cam(1.8,-3,-78.7,535.9)).css(),'matrix3d(0.48566510,0.09329935,0.00000000,-0.00006900,-0.19396267,0.47665805,0.00000000,-0.00006731,0.00000000,0.00000000,1.00000000,0.00000000,235.83583886,50.24915899,0.00000000,1.00000000)');
assert.equal(uiClipPath(),"path('M217.5 73.7Q230.1 40.0 265.4 46.8L544.7 100.6Q580.1 107.4 569.1 141.7L353.1 813.5Q342.1 847.8 307.6 837.6L5.7 748.0Q-28.8 737.7 -16.3 704.0Z')");
console.log('phone geometry and supplemental SSR checks passed');
"""
        result = subprocess.run(['node', '-e', script], cwd=ROOT, capture_output=True, text=True, timeout=120)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_capabilities_remain_device_specific(self):
        # Existing evidence_card legitimately supports fill; no global expansion.
        for device, verb in [('query_chip', 'move'), ('query_chip', 'fill'), ('test_grid', 'move'), ('hand_phone_stage', 'stamp')]:
            with self.subTest(device=device, verb=verb):
                with self.assertRaisesRegex(ValueError, device + '.*' + verb):
                    self.compile_with(device, verb)


if __name__ == '__main__':
    unittest.main()
