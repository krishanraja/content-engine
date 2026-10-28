"""H glass registration and supplemental SSR without a child-process bundler."""
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]


class GlassTests(unittest.TestCase):
    def test_registration_and_source_constraints(self):
        registry = (ROOT / 'apps/renderer/src/engine/kit/glassKinds.ts').read_text(encoding='utf-8')
        for kind in ('prompt', 'cards', 'footage', 'bubble'):
            self.assertIn(kind + ':', registry)
        files = list((ROOT / 'apps/renderer/src/engine/kit/glass').glob('*.tsx'))
        self.assertEqual(len(files), 4)
        for path in files:
            text = path.read_text(encoding='utf-8')
            for forbidden in ('Math.random', 'useCurrentFrame', 'rgb(', '#', 'overflow:visible'):
                self.assertNotIn(forbidden, text, path.name)

    def test_supplemental_ssr_runs_the_vitest_assertions(self):
        # Execute the very same assertions when esbuild spawning is unavailable.
        # Media adapters prove source/timing/markup only, never playback or pixels.
        script = r"""
const fs=require('node:fs'),ts=require('typescript'),Module=require('node:module'),assert=require('node:assert/strict');
for(const ext of ['.ts','.tsx']) require.extensions[ext]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,f);
const React=require('react'),actual=require('remotion'),load=Module._load;
let count=0;
function expect(value){return {toContain:x=>assert.ok(value.includes(x),`missing ${x}`),toBe:x=>assert.equal(value,x),toThrow:()=>assert.throws(value),toBeGreaterThanOrEqual:x=>assert.ok(value>=x),toBeLessThan:x=>assert.ok(value<x),not:{toContain:x=>assert.ok(!value.includes(x),`unexpected ${x}`),toMatch:x=>assert.ok(!x.test(value))}}}
const it=(name,fn)=>{fn();count++};it.each=rows=>(name,fn)=>rows.forEach(row=>it(name,()=>fn(...(Array.isArray(row)?row:[row]))));
Module._load=function(id,...args){
 if(id==='vitest')return {describe:(name,fn)=>fn(),it,expect,vi:{mock:()=>{}}};
 if(id==='remotion')return {...actual,Img:p=>React.createElement('img',p),OffthreadVideo:({trimBefore,...p})=>React.createElement('video',{...p,'data-trim':trimBefore}),Sequence:({from,children})=>React.createElement('div',{'data-from':from},children)};
 return load.call(this,id,...args);
};
require('./apps/renderer/src/engine/kit/glass/glass.test.ts');
console.log(`${count} supplemental glass SSR cases passed`);
"""
        result = subprocess.run(['node', '-e', script], cwd=ROOT, capture_output=True, text=True, timeout=120)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == '__main__':
    unittest.main()
