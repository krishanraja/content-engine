"""Independently hash active board downloads and compare the saved stores."""
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'scripts/post-pack'))
import board_web as web

work=Path(sys.argv[1]).resolve()
state=web.call('GET','/api/board/2026-10-19')
token=web.os.environ.get('ENGINE_OPERATOR_TOKEN') or web.engine.windows_key()[0]
base='https://content.krishraja.com'
def fetched(path):
    req=urllib.request.Request(base+path,headers={'Authorization':'Bearer '+token})
    h=hashlib.sha256();size=0
    with urllib.request.urlopen(req,timeout=300) as r:
        while chunk:=r.read(1024*1024):h.update(chunk);size+=len(chunk)
    return h.hexdigest(),size

digest,size=fetched('/board/2026-10-19')
assert digest==state['manifest']['html']['sha256'] and size==state['manifest']['html']['bytes']
rows=[]
for aid,spec in state['manifest']['assets'].items():
    if not aid.startswith('wed-'):continue
    digest,size=fetched(f'/api/board/2026-10-19/assets/{aid}?sha={spec["sha256"]}')
    assert digest==spec['sha256'] and size==spec['bytes'],aid
    rows.append({'id':aid,'sha256':digest,'bytes':size,'status':'pass'})
    print('Verified',aid,size,flush=True)
stores={}
for week in ['2026-10-19','2026-10-12']:
    before=json.loads((work/f'stores-{week}-before.json').read_text(encoding='utf-8'))
    now={key:web.call('GET',f'/api/board/{week}/{key}') for key in before}
    stores[week]={key:{'unchanged':before[key]==now[key],'count':len(now[key].get('documents',[]))} for key in before}
    # New human feedback is preserved and surfaced, never overwritten to make
    # an equality assertion pass.
    (work/f'stores-{week}-after.json').write_text(json.dumps(now,ensure_ascii=False),encoding='utf-8')
report={'build_id':state['build_id'],'html_sha256':state['manifest']['html']['sha256'],
        'assets_verified':rows,'stores':stores}
(work/'board-readback.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
print('Readback complete',len(rows),'new assets',json.dumps(stores))
