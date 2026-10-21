"""Feed Wednesday's review materials through the existing board inputs.

Does not shape or patch a board. Stops if another panel or an existing asset
would be lost. Publishing is a separate compare-and-swap command.
"""
import argparse
import json
import re
import sys
import urllib.request
from pathlib import Path

PLAN=Path(__file__).resolve().parent
ROOT=PLAN.parents[2]
sys.path.insert(0,str(ROOT/'scripts/post-pack'))
import board_web as web
import week_board as board

WEEK='2026-10-19'
PIECE='d7a20885-7001-4661-b444-9d7ca1043416'


def save(path,data):
    path.write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')


def panel(page,name):
    hit=re.search(r'<div\b[^>]*\bid="panel-'+name+r'"',page)
    if not hit:
        raise ValueError('Panel missing: '+name)
    return board.div_at(page,hit.start())


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('work',type=Path)
    ap.add_argument('--videos',action='store_true')
    a=ap.parse_args()
    work=a.work.resolve();out=work/'board';out.mkdir(exist_ok=True)
    state=web.call('GET',f'/api/board/{WEEK}')
    save(out/'before.json',state)
    token=web.os.environ.get('ENGINE_OPERATOR_TOKEN') or web.engine.windows_key()[0]
    req=urllib.request.Request(f'https://content.krishraja.com/board/{WEEK}',headers={'Authorization':'Bearer '+token})
    with urllib.request.urlopen(req,timeout=120) as r:
        before=r.read()
    assert web.sha(before)==state['manifest']['html']['sha256']
    previous=out/'before.html';previous.write_bytes(before)
    old=before.decode('utf-8')
    save(out/'queue.json',web.call('GET','/api/idea-queue'))
    mappings=[]
    for aid,spec in state['manifest']['assets'].items():
        rel=f'/api/board/{WEEK}/assets/{aid}?sha={spec["sha256"]}'
        source=('https://content.krishraja.com'+rel) if ('https://content.krishraja.com'+rel) in old else rel
        mappings.append({'id':aid,'source_url':source,'existing_sha256':spec['sha256']})

    def file(aid,path,label):
        path=Path(path)
        if not path.is_file():
            raise FileNotFoundError(path)
        url=f'/api/board/{WEEK}/assets/{aid}?pending=1'
        mappings[:]=[m for m in mappings if m['id']!=aid]
        mappings.append({'id':aid,'source_url':url,'path':str(path)})
        return {'label':label,'url':url}

    sections=[]
    sections.append({'id':'article','title':'Article and takeaway','files':[
        file('wed-article-web',work/'article/page.html','Read the illustrated article'),
        file('wed-article-copy',work/'article/substack.html','Copy article for Substack'),
        file('wed-article-md',ROOT/'docs/plans/2026-10-19-week/wednesday-article-draft.md','Article Markdown'),
        file('wed-scorecard-md',ROOT/'docs/plans/2026-10-19-week/wednesday-scorecard.md','Scorecard with sources'),
        file('wed-scorecard-png',work/'takeaway/scorecard.png','Download the scorecard')],
        'note':'Article and scorecard remain in editorial review. Use the editable Article draft box below for changes.'})
    covers=[('cover-1200x630.png','Substack cover'),('cover.png','Substack feed'),
            ('cover-1200x675.png','LinkedIn share card'),('cover-1080x1080.png','Square cover'),
            ('cover-1080x1920.png','Vertical cover')]
    sections.append({'id':'covers','title':'Covers and thumbnails','files':[
        file('wed-'+Path(name).stem,work/'article'/name,label) for name,label in covers]+[
        file('wed-thumb-wide',work/'thumbs/thumb-wide-1280x720.jpg','YouTube thumbnail'),
        file('wed-thumb-tall',work/'thumbs/thumb-tall-1080x1920.jpg','Short video thumbnail')]})
    if a.videos:
        files=[]
        for cut,shape in [('long','16x9'),('short','9x16')]:
            base=work/('render-long-music' if cut=='long' else 'render-short')/f'muse-vs-grok-{cut}-{shape}'
            # A completed renderer receipt is required even for a review copy.
            receipt=base.with_suffix('.mp4.validation.json')
            data=json.loads(receipt.read_text(encoding='utf-8'))
            if data.get('video_sha256')!=web.sha(base.with_suffix('.mp4').read_bytes()):
                raise ValueError(cut+' video differs from its renderer receipt')
            files += [file('wed-video-'+cut,base.with_suffix('.mp4'),cut.capitalize()+' video — review copy'),
                      file('wed-captions-'+cut,base.with_suffix('.srt'),cut.capitalize()+' captions')]
        sections.append({'id':'videos','title':'Watch both videos','files':files,
                         'note':'Review exports. Technical measurements accompany the files; continuous playback acceptance is still open.'})
    sections.append({'id':'evidence','title':'Visuals and checks','files':[
        file('wed-graphics-overview',work/'cards/sheet.png','All evidence graphics'),
        file('wed-test-observations',ROOT/'docs/plans/2026-10-19-week/test-results/README.md','Redacted test observations'),
        file('wed-release-review',PLAN/'release-review.md','Release status and remaining decisions'),
        file('wed-claim-review',PLAN/'claim-review.md','Detailed fact-check findings')]})
    historic=state['manifest']['assets'].get('wednesday-claude-evidence')
    if historic:
        sections[-1]['files'].append({'label':'Original editorial evidence pack',
            'url':f'/api/board/{WEEK}/assets/wednesday-claude-evidence?sha={historic["sha256"]}'})
    copy=(PLAN/'publishing-copy.md').read_text(encoding='utf-8')
    sections.append({'id':'channel-copy','title':'Channel copy','files':[
        file('wed-channel-copy',PLAN/'publishing-copy.md','Download all channel copy'),
        file('wed-chapters',PLAN/'chapters.txt','YouTube and Spotify chapters')],
        'copy':[{'label':label.strip(),'text':text.strip()} for label,text in
                re.findall(r'^## ([^\n]+)\n(.*?)(?=^## |\Z)',copy,re.M|re.S)],
        'note':'The Publishing copy review box is editable and commentable.'})
    material={'piece_id':PIECE,'status':'review',
              'note':'Production files prepared for review. Final playback acceptance and article fact-gate findings remain open. Nothing has been publicly posted.',
              'sections':sections}
    save(out/'materials.json',material)
    week=ROOT/'docs/plans/2026-10-19-week'
    reviews=[('Narrative and proposed visuals',week/'wednesday-narrative-ready.md'),
             ('Scorecard and narrative',week/'wednesday-scorecard.md'),
             ('Five everyday tests',week/'wednesday-test-packet.md'),
             ('Live draft-test results',week/'test-results/README.md'),
             ('Article draft',week/'wednesday-article-draft.md'),
             ('Messenger and X showcases',week/'wednesday-showcases.md'),
             ('Five-minute script',PLAN/'recorded-long-script.md'),
             ('Short script',PLAN/'recorded-short-script.md'),
             ('Visual plan after copy approval',week/'wednesday-script-visual-plan.md'),
             ('Publishing copy',PLAN/'publishing-copy.md'),
             ('Release review',PLAN/'release-review.md')]
    args=['--week',WEEK,'--previous',str(previous),'--keep','mon','--target','web','--live',
          '--piece',f'wed={PIECE}','--draft','wed','--materials',f'wed={out/"materials.json"}',
          '--waiting','wed=Review the article, scorecard and channel copy; final video playback and fact findings remain open.',
          '--ideas',str(week/'ideas.json'),'--queue',str(out/'queue.json')]
    if 'id="wed-four-draft-only-tests"' in old:
        for collection in ('edits','comments'):
            feedback=web.call('GET',f'/api/board/{WEEK}/{collection}')
            if 'four-draft-only-tests' in json.dumps(feedback):
                raise ValueError('The historic test-packet anchor has feedback; preserve it before changing its label')
        args += ['--drop-review','wed=four-draft-only-tests']
    for label,path in reviews:
        args += ['--review',f'wed={label}|{path}']
    page,meta=board.build(board.parser().parse_args(args))
    # The live making record still names four historical Drive downloads.
    # Resolve those through the publisher's normal asset map, preserving the
    # exact already-verified bytes and URLs in Monday's activated panel.
    legacy={'monday-long-review':'1U0XZgpSXatqqgxEvZUSnnWFTdtJpnR9x',
            'monday-short-review':'1jB2GX4NO37YmANe2rE2ox7AUp4a_94I3',
            'monday-wide-thumbnail':'1G-hgoUF7bCCJmj4BIBZN76Pqxgmpx0nT',
            'monday-tall-thumbnail':'1fEjy6WKrZbXkmOrziEeC1A6P21BSd7iq'}
    for item in mappings:
        if item['id'] in legacy and ('https://drive.usercontent.google.com/download?id='+legacy[item['id']]+'&amp;export=download') in page:
            item['source_url']='https://drive.usercontent.google.com/download?id='+legacy[item['id']]+'&amp;export=download'
    # Simulate only the publisher's documented URL resolution to compare the
    # eventual panels. The file passed to the publisher is left untouched.
    resolved=page
    for item in mappings:
        digest=item.get('existing_sha256') or web.sha(Path(item['path']).read_bytes())
        resolved=resolved.replace(item['source_url'],f'/api/board/{WEEK}/assets/{item["id"]}?sha={digest}')
    same={name:panel(resolved,name)==panel(old,name) for name in ['ideas','monday','friday']}
    if not all(same.values()):
        import difflib
        for name,unchanged in same.items():
            if not unchanged:
                (out/f'{name}-diff.txt').write_text('\n'.join(difflib.unified_diff(
                    panel(old,name).replace('><','>\n<').splitlines(),
                    panel(resolved,name).replace('><','>\n<').splitlines())),encoding='utf-8')
        raise ValueError('Unrelated panels changed: '+str(same))
    # Retain every old asset, even if a historic download is no longer visible.
    # The publisher requires a matching link; a missing one is a hard stop.
    absent=[m['id'] for m in mappings if m['source_url'] not in page]
    if absent:
        raise ValueError('Assets would be lost: '+str(absent))
    issues=board.verify(page)
    if issues:
        raise ValueError(issues)
    board.write(page,meta,out/'board.html');save(out/'assets.json',mappings)
    save(out/'build-review.json',{'expected_build':state['build_id'],'same_panels':same,
                                'existing_assets':len(state['manifest']['assets']),
                                'assets':len(mappings),'verify':issues})
    print(json.dumps({'expected_build':state['build_id'],'assets':len(mappings),'same_panels':same}))


if __name__=='__main__':
    main()
