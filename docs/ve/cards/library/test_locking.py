"""Exercise the public CLI in an isolated copy, with real SVG, PNG and H.264 frames."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import unittest

from PIL import Image
from frame_capture import workspace
from render_lock import guard

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
AVATAR = 'profile-favicon-32'
SECOND = 'profile-favicon-48'
COVER = 'carousel-howto-cover'
VIDEO = 'video-vertical-why-1'
IDS = [AVATAR, SECOND, COVER, VIDEO, 'profile-bio']


class ApprovalWorkflow(unittest.TestCase):
    def setUp(self):
        temp = self.enterContext(workspace(HERE/'.scratch/library'))
        self.root = temp/'repo'
        self.lib = self.root/'docs/ve/cards/library'
        self.lib.mkdir(parents=True)
        for pattern in ('*.py','*.js','*.cjs','house-stills.json'):
            for source in HERE.glob(pattern):
                shutil.copyfile(source,self.lib/source.name)
        self.env = dict(os.environ, PYTHONDONTWRITEBYTECODE='1', PYTHONUTF8='1')
        modules = ROOT.parents[1]/'content-engine/node_modules'
        self.env['NODE_PATH'] = os.pathsep.join(filter(None,(str(ROOT/'node_modules'),str(modules),self.env.get('NODE_PATH'))))
        native = ROOT.parents[1]/'content-engine/.cache/visual-render/node_modules/@resvg/resvg-js'
        if native.is_dir():
            self.env.setdefault('RESVG_MODULE',str(native))
        for path in ['.scratch/tonal-ab/'+f for f in ('DMMono-Regular.ttf','Anton-Regular.ttf','Fraunces-Upright-Variable.ttf')]+[
            'assets/fonts/makeyourmindup/Fraunces-'+s+'-Variable.ttf' for s in ('Italic','Upright')]:
            (self.root/path).parent.mkdir(parents=True,exist_ok=True)
            shutil.copyfile(ROOT/path,self.root/path)
        # Small local photographs keep this fixture independent of private review files.
        bank = self.root/'.scratch/bank'
        bank.mkdir(parents=True)
        for name in ('bank-12','bank-30'):
            Image.new('RGB',(120,150),'#105446').save(bank/(name+'.png'))
        self.original_html = (HERE/'library.html').read_text(encoding='utf8')
        self.data = json.loads((HERE/'library.json').read_text(encoding='utf8'))
        self.data['items'] = [i for i in self.data['items'] if i['id'] in IDS]
        self.items = {i['id']:i for i in self.data['items']}
        motion = self.items[VIDEO]['motion']
        motion['frames'] = 5
        for track in motion['tracks']:
            track['duration'] = 4
        self.save()
        self.out = self.root/'.scratch/library/out'
        self.lockfile = self.lib/'lock.json'
        self.lockfile.write_text(json.dumps(dict(version=1,locked=[],pending_approval=IDS,history=[])))

    def save(self):
        raw = json.dumps(self.data, ensure_ascii=False, separators=(',',':'))
        before, tail = self.original_html.split('const registry=',1)
        html = before+'const registry='+raw+';\n'+tail.split(';\n',1)[1]
        (self.lib/'library.html').write_text(html,encoding='utf8')
        (self.lib/'library.json').write_text(raw,encoding='utf8')

    def cli(self, *args, passes=True):
        result = subprocess.run([sys.executable,'-B','render.py',*args],cwd=self.lib,env=self.env,
                                stdout=subprocess.PIPE,stderr=subprocess.STDOUT,encoding='utf8')
        self.assertEqual(result.returncode==0,passes,(args,result.stdout))
        print(' '.join(args), '=>',result.stdout.strip(),flush=True)
        return result.stdout

    def changed(self,*ids,extra=()):
        output = self.cli('--changed','--rasterizer','resvg',*extra)
        actual = {line.split()[1] for line in output.splitlines()
                  if line.startswith('Rendered ') and '(' in line}
        self.assertEqual(actual,set(ids),output)

    def test_full_manifest_handoff(self):
        # Exercise the full-render callback contract without starting the host browser.
        job = """
from functools import partial
from pathlib import Path
from frame_capture import native_frames
from render_inputs import active_items,load_registry
from render_cache import export
from render_lock import ledger
here=Path.cwd()
items=active_items(load_registry(here)[0])
def render(staging):
    (staging/'items').mkdir()
    for key,item in items.items():
        t=(item.get('motion') or {}).get('frames',1)-1
        png,=native_frames(here,item,[t])
        (staging/'items'/f'{key}.png').write_bytes(png)
    (staging/'ink-alignment.json').write_text('{}')
export(here,here.parents[3]/'.scratch/library/out','resvg',ledger(here),
       lambda backend:partial(native_frames,here),full=render)
"""
        subprocess.run([sys.executable,'-B','-c',job],cwd=self.lib,env=self.env,check=True)
        self.assertTrue((self.out/'ink-alignment.json').is_file())
        self.changed()

    def test_approval_and_cache(self):
        with guard(self.lib):
            self.cli('--check-locks')
            refused = self.cli('--lock',AVATAR,'--approved-by','Test reviewer','--words','fixture','--rasterizer','resvg',passes=False)
            self.assertIn('worktree guard',refused)

        self.changed(*IDS,extra=('--motion',))
        manifest_file = self.out/'render-manifest.json'
        manifest = json.loads(manifest_file.read_text())
        for key in IDS:
            for name,record in manifest['items'][key]['outputs'].items():
                self.assertEqual(hashlib.sha256((self.out/name).read_bytes()).hexdigest(),record['sha256'])
        self.assertIn(f'motion/{VIDEO}.mp4',manifest['items'][VIDEO]['outputs'])
        mtime = {p:p.stat().st_mtime_ns for p in self.out.rglob('*') if p.is_file()}
        self.changed(extra=('--motion',))
        self.assertEqual(mtime,{p:p.stat().st_mtime_ns for p in mtime})
        words='  Fixture approval only.  '
        self.cli('--lock',AVATAR,'--approved-by','Test reviewer','--words',words,'--rasterizer','resvg')
        self.cli('--lock',VIDEO,'--approved-by','Test reviewer','--words',words,'--rasterizer','resvg')
        self.cli('--check-locks')
        locks = json.loads(self.lockfile.read_text())['locked']
        self.assertEqual([r['words'] for r in locks],[words,words])
        self.assertEqual(locks[1]['fingerprint']['frames'],5)
        self.assertIn('decoded_yuv420p_sha256',locks[1]['fingerprint'])
        self.cli('--lock',AVATAR,'--approved-by','Other','--words','duplicate','--rasterizer','resvg',passes=False)
        art = self.lib/'library.html'
        original = art.read_text(encoding='utf8')
        needle = 'M50 17a38 38 0 0 0 0 76z'
        self.assertIn(needle,original)
        def perturb_symbol():
            art.write_text(art.read_text(encoding='utf8').replace(needle,'M50 17h-35v76z',1),encoding='utf8')
        perturb_symbol()
        failure = self.cli('--check-locks',passes=False)
        self.assertIn('LOCK FAILED '+AVATAR,failure)
        self.assertNotIn('LOCK FAILED '+VIDEO,failure)
        saved = manifest_file.read_bytes()
        self.cli('--changed','--rasterizer','resvg',passes=False)
        self.assertEqual(saved,manifest_file.read_bytes())
        art.write_text(original,encoding='utf8')
        self.cli('--check-locks')
        # Change the easing duration. First and last frames still agree.
        self.items[VIDEO]['motion']['tracks'][1]['duration']=2
        self.save()
        failure = self.cli('--check-locks',passes=False)
        self.assertIn('LOCK FAILED '+VIDEO,failure)
        self.assertIn('decoded_yuv420p_sha256',failure)
        self.assertIn('source_rgb24_sha256',failure)
        self.assertNotIn('first_rgb24_sha256',failure)
        self.assertNotIn('settled_rgb24_sha256',failure)
        perturb_symbol()
        both = self.cli('--check-locks',passes=False)
        for key in (AVATAR,VIDEO):
            self.assertIn('LOCK FAILED '+key,both)
        self.items[VIDEO]['motion']['tracks'][1]['duration']=4
        self.save()
        self.cli('--check-locks')
        brief = self.lib/'ROUND-FIXTURE.md'
        brief.write_text('Change '+AVATAR+'-other')
        self.cli('--unlock',AVATAR,'--reason',brief.name,passes=False)
        brief.write_text('Change '+AVATAR)
        self.cli('--unlock',AVATAR,'--reason',brief.name)
        self.cli('--unlock',VIDEO,'--reason','Test reviewer withdrew approval')
        history = json.loads(self.lockfile.read_text())
        self.assertEqual(history['locked'],[])
        self.assertEqual(history['history'][-2]['previous'],locks[0])
        self.assertEqual(history['history'][-2]['brief_sha256'],hashlib.sha256(brief.read_bytes()).hexdigest())
        self.assertEqual(history['history'][-1]['reason'],'Test reviewer withdrew approval')
        perturb_symbol()
        self.changed(AVATAR,SECOND)
        self.save()
        self.changed(AVATAR,SECOND)
        self.assertIn('const w=W*.63',self.original_html)
        art.write_text(art.read_text(encoding='utf8').replace('const w=W*.63','const w=W*.61',1),encoding='utf8')
        self.changed(AVATAR,SECOND)
        self.save()
        self.changed(AVATAR,SECOND)
        self.items[COVER]['name'] += ' fixture'
        self.save()
        self.changed(COVER)
        pg = self.out/'items'/f'{COVER}.png'
        before=pg.read_bytes()
        Image.new('RGB',(120,150),'#ffcc33').save(self.root/'.scratch/bank/bank-30.png')
        self.changed(COVER)
        self.assertNotEqual(hashlib.sha256(before).digest(),hashlib.sha256(pg.read_bytes()).digest())
        pg.write_bytes(b'broken')
        (self.out/'items'/f'{SECOND}.png').unlink()
        self.changed(COVER,SECOND)
        self.changed()
        self.cli('--check-locks')
        self.cli('--lock',AVATAR,'--approved-by','Test reviewer','--words','Second fixture approval','--rasterizer','resvg')
        self.cli('--check-locks')
        final = json.loads(self.lockfile.read_text())
        self.assertEqual(len(final['history']),5)
        self.assertEqual(final['locked'][0]['words'],'Second fixture approval')



if __name__=='__main__':
    unittest.main()
