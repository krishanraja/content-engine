"""Read actual changed board downloads and preserve every feedback collection."""
import argparse
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'scripts/post-pack'))
import board_web as web

ap=argparse.ArgumentParser();ap.add_argument('work',type=Path);ap.add_argument('--out',default='article-board-readback-22oct.json');a=ap.parse_args();w=a.work
before=json.loads((w/'board/before.json').read_text(encoding='utf-8'))
state=web.call('GET','/api/board/2026-10-19')
assert set(before['manifest']['assets'])<=set(state['manifest']['assets'])
token=web.os.environ.get('ENGINE_OPERATOR_TOKEN') or web.engine.windows_key()[0]
def fetched(path):
    request=urllib.request.Request('https://content.krishraja.com'+path,headers={'Authorization':'Bearer '+token})
    h=hashlib.sha256();size=0
    with urllib.request.urlopen(request,timeout=300) as response:
        while chunk:=response.read(1024*1024):h.update(chunk);size+=len(chunk)
    return h.hexdigest(),size

h,size=fetched('/board/2026-10-19');assert h==state['manifest']['html']['sha256'] and size==state['manifest']['html']['bytes']
rows=[]
for aid,spec in state['manifest']['assets'].items():
    prior=before['manifest']['assets'].get(aid,{})
    if prior.get('sha256')==spec['sha256']:continue
    digest,size=fetched(f'/api/board/2026-10-19/assets/{aid}?sha={spec["sha256"]}')
    assert digest==spec['sha256'] and size==spec['bytes'],aid
    rows.append({'id':aid,'sha256':digest,'bytes':size,'verified':True})
stores={}
for week in ['2026-10-19','2026-10-12']:
    old=json.loads((w/f'stores-{week}-before.json').read_text(encoding='utf-8'))
    now={key:web.call('GET',f'/api/board/{week}/{key}')for key in old}
    stores[week]={key:{'unchanged':old[key]==now[key],'count':len(now[key].get('documents',[]))}for key in old}
    (w/f'stores-{week}-latest.json').write_text(json.dumps(now,ensure_ascii=False),encoding='utf-8')
report={'build_id':state['build_id'],'html_verified':True,'retained_all_previous_assets':True,
    'changed_downloads':rows,'stores':stores}
(w/a.out).write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps({'build_id':state['build_id'],'changed_assets_verified':len(rows),'stores':stores}),flush=True)
