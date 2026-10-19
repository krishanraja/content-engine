"""Refresh only Wednesday's review workroom, preserving the live ready days."""
import json, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'scripts/post-pack'))
import board_web as web
import week_board as board
CACHE=ROOT/'.cache/wednesday-scorecard'; CACHE.mkdir(parents=True,exist_ok=True)
PLAN=Path(__file__).parent
def save(p,d): p.write_text(json.dumps(d,indent=2)+'\n',encoding='utf8')
def main():
    names=['ticks','links','edits','picks','queue','comments']
    jobs=[(week,name) for week in ['2026-10-12','2026-10-19'] for name in names]
    def read(job):
        week,name=job
        return week,name,web.call('GET',f'/api/board/{week}/{name}')
    with ThreadPoolExecutor(max_workers=4) as pool: reads=list(pool.map(read,jobs))
    save(CACHE/'stores-before.json',{f'{w}/{n}':d for w,n,d in reads})
    for w,n,d in reads:
        if w=='2026-10-19' and n in ['edits','comments']:
            relevant=[x for x in d['documents'] if 'wed' in json.dumps(x).lower()]
            save(CACHE/f'wed-{n}.json',relevant)
            print(n,len(relevant))
    state=web.call('GET','/api/board/2026-10-19'); save(CACHE/'before.json',state)
    key=web.os.environ.get('ENGINE_OPERATOR_TOKEN') or web.engine.windows_key()[0]
    req=urllib.request.Request('https://content.krishraja.com/board/2026-10-19',headers={'Authorization':'Bearer '+key})
    with urllib.request.urlopen(req,timeout=120) as r: data=r.read()
    assert web.sha(data)==state['manifest']['html']['sha256']
    before=CACHE/'before.html'; before.write_bytes(data)
    print('Snapshot captured')
def build():
    state=json.loads((CACHE/'before.json').read_text(encoding='utf8'))
    get=board.live_reader(); save(CACHE/'queue.json',get('/api/idea-queue'))
    args=['--week','2026-10-19','--previous',str(CACHE/'before.html'),'--keep','mon','--target','web','--live',
          '--piece','wed=d7a20885-7001-4661-b444-9d7ca1043416','--draft','wed',
          '--review',f'wed=Scorecard and narrative|{PLAN}/wednesday-scorecard.md',
          '--review',f'wed=Four draft-only tests|{PLAN}/wednesday-test-packet.md',
          '--review',f'wed=Live draft-test results|{PLAN}/test-results/README.md',
          '--waiting','wed=First live draft results ready: four Muse tasks and one Gemini Pro baseline. Remaining agent surfaces need confirmation; no sends or spending.',
          '--ideas',str(PLAN/'ideas.json'),'--queue',str(CACHE/'queue.json')]
    page,meta=board.build(board.parser().parse_args(args))
    mappings=[]
    for aid,spec in state['manifest']['assets'].items():
        relative=f'/api/board/2026-10-19/assets/{aid}?sha={spec["sha256"]}'
        page=page.replace('https://content.krishraja.com'+relative,relative)
        if relative in page: mappings.append({'id':aid,'source_url':relative,'existing_sha256':spec['sha256']})
    assert len(mappings)==len(state['manifest']['assets']), 'Do not drop existing Monday assets'
    drive={'1U0XZgpSXatqqgxEvZUSnnWFTdtJpnR9x':'monday-long-review','1jB2GX4NO37YmANe2rE2ox7AUp4a_94I3':'monday-short-review','1G-hgoUF7bCCJmj4BIBZN76Pqxgmpx0nT':'monday-wide-thumbnail','1fEjy6WKrZbXkmOrziEeC1A6P21BSd7iq':'monday-tall-thumbnail'}
    for did,aid in drive.items():
        target=next(m['source_url'] for m in mappings if m['id']==aid)
        page=page.replace(f'https://drive.usercontent.google.com/download?id={did}&amp;export=download',target)
    page=board.engine_stamp.stamp(page,'week_board')
    assert not board.verify(page),board.verify(page)
    board.write(page,meta,CACHE/'board.html'); save(CACHE/'assets.json',mappings)
    print(json.dumps({'expected_build':state['build_id'],'assets':len(mappings)}))
if __name__=='__main__':
    if '--build' in sys.argv: build()
    else: main()

