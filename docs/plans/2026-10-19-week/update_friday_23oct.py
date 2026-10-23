"""Put Friday in draft on the web board (23 October), keeping Monday, Wednesday,
Ideas, every asset and every saved edit or comment.

    python docs/plans/2026-10-19-week/update_friday_23oct.py            # snapshot
    python docs/plans/2026-10-19-week/update_friday_23oct.py --build    # build + verify

Then publish with board_web.py publish-web (dry run first, --apply after Krish's yes:
"Keep all three, put them on the board", 23 October).
"""
import html, json, re, subprocess, sys, urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'scripts/post-pack'))
import board_web as web
import week_board as board
CACHE=ROOT/'.cache/friday-23oct'; CACHE.mkdir(parents=True,exist_ok=True)
PLAN=Path(__file__).parent
WEEK='2026-10-19'
WED='d7a20885-7001-4661-b444-9d7ca1043416'
FRI='7083d6ad-419e-4fdc-9aba-f3be7f3f3a23'
def save(p,d): p.write_text(json.dumps(d,indent=2)+'\n',encoding='utf8')
def snapshot():
    state=web.call('GET',f'/api/board/{WEEK}'); save(CACHE/'before.json',state)
    key=web.os.environ.get('ENGINE_OPERATOR_TOKEN') or web.engine.windows_key()[0]
    req=urllib.request.Request(f'https://content.krishraja.com/board/{WEEK}',headers={'Authorization':'Bearer '+key})
    with urllib.request.urlopen(req,timeout=120) as r: data=r.read()
    assert web.sha(data)==state['manifest']['html']['sha256']
    (CACHE/'before.html').write_bytes(data)
    print(json.dumps({'build_id':state['build_id'],'assets':len(state['manifest']['assets'])}))
def wed_reviews_from_board(old):
    """Wednesday's review boxes exactly as the live board holds them (some sources live only in another
    session's work folder), so its tab is rebuilt with the same words and anchors."""
    out=CACHE/'wed-reviews'; out.mkdir(exist_ok=True); items=[]
    for m in re.finditer(r'<section class="rv-item" id="rvs-(wed-[a-z0-9-]+)" data-review="wed-[^"]+"><div class="sec-head"><h3>(.*?)</h3>.*?<textarea[^>]*>(.*?)</textarea>',old,re.S):
        rid,label,text=m.group(1),html.unescape(m.group(2)),html.unescape(m.group(3))
        path=out/(rid+'.md'); path.write_text(text,encoding='utf-8'); items.append((label,path))
    return items
def board_day_made(page,key):
    """True when the board being replaced holds that day as made (its publish page), so --keep carries it."""
    days=json.loads(subprocess.run([sys.executable,str(ROOT/'scripts/post-pack/week_board.py'),'--show',str(CACHE/'before.html'),'--json'],
                                   capture_output=True,text=True,check=True).stdout)
    return (days.get('days') or {}).get(key,{}).get('state')=='made'
def panel(page,name):
    hit=re.search(r'<div\b[^>]*\bid="panel-'+name+r'"',page)
    if not hit: raise ValueError('Panel missing: '+name)
    return board.div_at(page,hit.start())
def build():
    state=json.loads((CACHE/'before.json').read_text(encoding='utf8'))
    old=(CACHE/'before.html').read_text(encoding='utf-8')
    get=board.live_reader(); save(CACHE/'queue.json',get('/api/idea-queue'))
    wed_reviews=[] if board_day_made(old,'wed') else wed_reviews_from_board(old)
    fri_reviews=[('Narrative (signed)',PLAN/'narrative-fri.md'),
                 ('Evidence read at source',ROOT/'docs/plans/2026-10-23-friday/research-gaps.md'),
                 ('Five-minute script',ROOT/'docs/plans/2026-10-23-draft-script.md'),
                 ('Short script',ROOT/'docs/plans/2026-10-23-draft-script-90s.md')]
    if wed_reviews:  # Wednesday still in draft: rebuild its boxes word for word
        args=['--week',WEEK,'--previous',str(CACHE/'before.html'),'--keep','mon','--target','web','--live',
              '--piece',f'wed={WED}','--piece',f'fri={FRI}','--draft','wed','--draft','fri']
    else:  # Wednesday made (22 Oct on): carried over exactly as the board holds it
        args=['--week',WEEK,'--previous',str(CACHE/'before.html'),'--keep','mon','--keep','wed','--target','web','--live',
              '--piece',f'fri={FRI}','--draft','fri']
    for label,path in wed_reviews: args+=['--review',f'wed={label}|{path}']
    for label,path in fri_reviews: args+=['--review',f'fri={label}|{path}']
    args+=['--waiting','fri=Send the Claude, ChatGPT and DeepSeek answers from the Cowork test (answers.md and the screenshots); the gaps in both scripts are filled from them, then both go to Teleprompter before you record this afternoon.',
           '--ideas',str(PLAN/'ideas.json'),'--queue',str(CACHE/'queue.json')]
    page,meta=board.build(board.parser().parse_args(args))
    mappings=[]
    for aid,spec in state['manifest']['assets'].items():
        rel=f'/api/board/{WEEK}/assets/{aid}?sha={spec["sha256"]}'
        source=('https://content.krishraja.com'+rel) if ('https://content.krishraja.com'+rel) in old else rel
        mappings.append({'id':aid,'source_url':source,'existing_sha256':spec['sha256']})
    # Monday's four downloads still render as Drive links: resolve them as the Wednesday feeder does.
    legacy={'monday-long-review':'1U0XZgpSXatqqgxEvZUSnnWFTdtJpnR9x','monday-short-review':'1jB2GX4NO37YmANe2rE2ox7AUp4a_94I3',
            'monday-wide-thumbnail':'1G-hgoUF7bCCJmj4BIBZN76Pqxgmpx0nT','monday-tall-thumbnail':'1fEjy6WKrZbXkmOrziEeC1A6P21BSd7iq'}
    for item in mappings:
        if item['id'] in legacy and ('https://drive.usercontent.google.com/download?id='+legacy[item['id']]+'&amp;export=download') in page:
            item['source_url']='https://drive.usercontent.google.com/download?id='+legacy[item['id']]+'&amp;export=download'
    resolved=page
    for item in mappings:
        resolved=resolved.replace(item['source_url'],f'/api/board/{WEEK}/assets/{item["id"]}?sha={item["existing_sha256"]}')
    same={name:panel(resolved,name)==panel(old,name) for name in ['ideas','monday','wednesday']}
    if not all(same.values()):
        import difflib
        for name,unchanged in same.items():
            if not unchanged:
                (CACHE/f'{name}-diff.txt').write_text('\n'.join(difflib.unified_diff(
                    panel(old,name).replace('><','>\n<').splitlines(),panel(resolved,name).replace('><','>\n<').splitlines())),encoding='utf-8')
    absent=[m['id'] for m in mappings if m['source_url'] not in page]
    problems=board.verify(page)
    board.write(page,meta,CACHE/'board.html'); save(CACHE/'assets.json',mappings)
    print(json.dumps({'expected_build':state['build_id'],'assets':len(mappings),'assets_absent':absent,'same_panels':same,'verify':problems}))
if __name__=='__main__':
    build() if '--build' in sys.argv else snapshot()
