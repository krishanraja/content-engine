"""Build Monday ready against the captured live board; no publication."""
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PLAN = Path(__file__).parent
OUT = ROOT / '.cache/monday-release-gates'
sys.path.insert(0, str(ROOT/'scripts/post-pack'))
import board_web as web
import week_board as board

def save(path, value):
    path.write_text(json.dumps(value, indent=2)+'\n', encoding='utf8')

def main():
    state = json.loads((OUT/'active-before.json').read_text(encoding='utf8'))
    assert web.call('GET','/api/board/2026-10-19')['build_id'] == state['build_id']
    before = OUT/'board-before.html'
    assert web.sha(before.read_bytes()) == state['manifest']['html']['sha256']
    get = board.live_reader()
    fact = get('/api/content-ideas/5b5bfadc-a60c-4d0a-be8e-b2e9bf43d092/fact-check')
    assert fact['gate']['ok'] and fact['ready'], 'Monday fact/editorial gate still held'
    material = json.loads((ROOT/'docs/plans/2026-10-19-board-delivery/monday-materials.json').read_text(encoding='utf8'))
    material['status'] = 'ready'
    material['note'] = 'Ready for your publishing steps. Both final cuts are accepted after your full playback with sound, and the three caption corrections are included. Your source-backed manual fact review is recorded separately from the original automated result. No further paid check was run. The article uses your prediction: 95% by 31 December 2026.'
    for section in material['sections']:
        section['note'] = section.get('note','').replace('publication remains on hold.', 'Ready for your publishing steps.').replace("Hold upload until Monday's review is cleared.", 'Ready to upload when you publish.')
        for file in section.get('files',[]):
            aid = file['url'].rsplit('/',1)[-1]
            spec = state['manifest']['assets'].get(aid)
            if spec: file['url'] = f'https://content.krishraja.com/api/board/2026-10-19/assets/{aid}?sha={spec["sha256"]}'
    downloads = json.loads((PLAN/'release-downloads.json').read_text(encoding='utf8'))
    article_files = [x for x in downloads if x['pack_path'].startswith(('1 Article/','2 Covers and images/')) and not x['pack_path'].endswith('phone-images.png')]
    material['sections'].insert(0, {'id':'article-files','title':'Article and final cover files','note':'Use the article Copy control below for Substack, or download the complete HTML. Each cover is named for its intended size and channel.', 'files':[{'label':'Download '+Path(x['pack_path']).name,'url':x['source_url']} for x in article_files]})
    save(PLAN/'release-materials.json',material)
    args=['--week','2026-10-19','--previous',str(before),'--live','--target','web','--piece','mon=5b5bfadc-a60c-4d0a-be8e-b2e9bf43d092','--day',f'mon={OUT}/manager/publish-manager.html','--materials',f'mon={PLAN}/release-materials.json','--ideas',str(ROOT/'docs/plans/2026-10-19-week/ideas.json')]
    save(OUT/'queue-current.json',get('/api/idea-queue'))
    args += ['--queue',str(OUT/'queue-current.json')]
    page,meta = board.build(board.parser().parse_args(args))
    mappings=[]
    # One immutable object can be referenced by old material and new manager links.
    for aid,spec in state['manifest']['assets'].items():
        relative=f'/api/board/2026-10-19/assets/{aid}?sha={spec["sha256"]}'
        absolute='https://content.krishraja.com'+relative
        page=page.replace(absolute,relative)
        if relative in page: mappings.append({'id':aid,'source_url':relative,'existing_sha256':spec['sha256']})
    for item in downloads:
        if item.get('existing_sha256'): continue
        if item['source_url'] in page:
            mappings.append({k:v for k,v in item.items() if k!='pack_path'})
    # Making records can introduce their previously verified archive Drive URLs.
    drive_assets = {'1U0XZgpSXatqqgxEvZUSnnWFTdtJpnR9x':'monday-long-review',
                    '1jB2GX4NO37YmANe2rE2ox7AUp4a_94I3':'monday-short-review',
                    '1G-hgoUF7bCCJmj4BIBZN76Pqxgmpx0nT':'monday-wide-thumbnail',
                    '1fEjy6WKrZbXkmOrziEeC1A6P21BSd7iq':'monday-tall-thumbnail'}
    for url in set(re.findall(r'https://drive.usercontent.google.com/download\?[^"< ]+',page)):
        match = re.search(r'[?&]id=([A-Za-z0-9_-]+)',html.unescape(url))
        aid = drive_assets.get(match[1] if match else '')
        if not aid: raise RuntimeError('Unmapped Drive download: '+html.unescape(url))
        mapping = next(x for x in mappings if x['id']==aid)
        page = page.replace(url,mapping['source_url'])
    page = board.engine_stamp.stamp(page,'week_board')
    assert not board.verify(page),board.verify(page)
    board.write(page,meta,OUT/'board-ready.html')
    save(OUT/'board-assets.json',mappings)
    print(json.dumps({'expected_build':state['build_id'],'assets':len(mappings),'html_bytes':len(page.encode())}))

if __name__ == '__main__': main()
