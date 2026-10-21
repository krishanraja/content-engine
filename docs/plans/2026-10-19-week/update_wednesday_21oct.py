"""Refresh only Wednesday's review boxes on the web board (21 October), keeping
Monday, Friday, Ideas, every asset and every saved edit or comment.

    python docs/plans/2026-10-19-week/update_wednesday_21oct.py            # snapshot
    python docs/plans/2026-10-19-week/update_wednesday_21oct.py --build    # build + verify

Then publish with board_web.py publish-web (dry run first, --apply after Krish's yes).
"""
import json, sys, urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'scripts/post-pack'))
import board_web as web
import week_board as board
CACHE=ROOT/'.cache/wednesday-21oct'; CACHE.mkdir(parents=True,exist_ok=True)
PLAN=Path(__file__).parent
WEEK='2026-10-19'
WED='d7a20885-7001-4661-b444-9d7ca1043416'
def save(p,d): p.write_text(json.dumps(d,indent=2)+'\n',encoding='utf8')
def snapshot():
    state=web.call('GET',f'/api/board/{WEEK}'); save(CACHE/'before.json',state)
    key=web.os.environ.get('ENGINE_OPERATOR_TOKEN') or web.engine.windows_key()[0]
    req=urllib.request.Request(f'https://content.krishraja.com/board/{WEEK}',headers={'Authorization':'Bearer '+key})
    with urllib.request.urlopen(req,timeout=120) as r: data=r.read()
    assert web.sha(data)==state['manifest']['html']['sha256']
    (CACHE/'before.html').write_bytes(data)
    print(json.dumps({'build_id':state['build_id'],'assets':len(state['manifest']['assets'])}))
def build():
    state=json.loads((CACHE/'before.json').read_text(encoding='utf8'))
    get=board.live_reader(); save(CACHE/'queue.json',get('/api/idea-queue'))
    reviews=[('Narrative and proposed visuals',PLAN/'wednesday-narrative-ready.md'),
             ('Scorecard and narrative',PLAN/'wednesday-scorecard.md'),
             ('Four draft-only tests',PLAN/'wednesday-test-packet.md'),
             ('Live draft-test results',PLAN/'test-results/README.md'),
             ('Article draft',PLAN/'wednesday-article-draft.md'),
             ('Messenger and X showcases',PLAN/'wednesday-showcases.md'),
             ('Five-minute script',ROOT/'docs/plans/2026-10-21-draft-script.md'),
             ('Short script',ROOT/'docs/plans/2026-10-21-draft-script-90s.md'),
             ('Visual plan after copy approval',PLAN/'wednesday-script-visual-plan.md')]
    args=['--week',WEEK,'--previous',str(CACHE/'before.html'),'--keep','mon','--target','web','--live',
          '--piece',f'wed={WED}','--draft','wed']
    for label,path in reviews: args+=['--review',f'wed={label}|{path}']
    args+=['--waiting','wed=Record both cuts from Teleprompter: five scored rounds, straight-in opening, the "Here\'s what I\'d do" close. Titles and thumbnail words after recording.',
           '--ideas',str(PLAN/'ideas.json'),'--queue',str(CACHE/'queue.json')]
    page,meta=board.build(board.parser().parse_args(args))
    # The review IDs stay as saved edits and comments know them; only the shown label changes.
    page=page.replace('Four draft-only tests','Five everyday tests')
    mappings=[]
    for aid,spec in state['manifest']['assets'].items():
        relative=f'/api/board/{WEEK}/assets/{aid}?sha={spec["sha256"]}'
        page=page.replace('https://content.krishraja.com'+relative,relative)
        if relative in page: mappings.append({'id':aid,'source_url':relative,'existing_sha256':spec['sha256']})
    missing=sorted(set(state['manifest']['assets'])-{m['id'] for m in mappings})
    page=board.engine_stamp.stamp(page,'week_board')
    problems=board.verify(page)
    board.write(page,meta,CACHE/'board.html'); save(CACHE/'assets.json',mappings)
    print(json.dumps({'expected_build':state['build_id'],'assets_kept':len(mappings),'assets_missing':missing,'verify':problems}))
if __name__=='__main__':
    build() if '--build' in sys.argv else snapshot()
