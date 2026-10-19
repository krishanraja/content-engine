"""Build against exact live manifests and prepare immutable download mappings.

No activation; use board_web.py publish-web --expected-build from this receipt.
"""
import html
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT/'scripts/post-pack'))
import board_web as web
import week_board as board
from prepare import CACHE, PLAN, save

def main():
    queue = board.live_reader()('/api/idea-queue')
    save(CACHE/'queue-live.json',queue)
    receipts=[]
    for week, day, name in [('2026-10-12','fri','friday'),('2026-10-19','mon','monday')]:
        state=web.call('GET',f'/api/board/{week}')
        before=CACHE/f'{week}-before.html'
        if web.sha(before.read_bytes()) != state['manifest']['html']['sha256']:
            raise RuntimeError(f'{week} changed since the source snapshot: refresh before rebuilding')
        save(CACHE/f'{week}-active-before.json',state)
        args=['--week',week,'--previous',str(before),'--live','--materials',f'{day}={PLAN/name}-materials.json']
        if day=='fri':
            args += ['--keep','mon','--keep','wed','--keep','fri']
        else:
            args += ['--draft','mon','--ideas',str(ROOT/'docs/plans/2026-10-19-week/ideas.json'),'--queue',str(CACHE/'queue-live.json'),
                     '--waiting','mon=Publication is held on one fact-check entry. No further paid check is authorised.',
                     '--waiting','mon=Listen to the three flagged long-cut caption passages before approving the video for publication.']
            for review in json.loads((CACHE/'monday-review-args.json').read_text()): args += ['--review',review]
        page,meta=board.build(board.parser().parse_args(args))
        # Correct inherited duration badges to the accepted repaired cuts.
        page=page.replace('The 90-second cut is finished (89.7 s), with its tall thumbnail', 'The repaired short is finished (1 min 28 s), with its tall thumbnail')
        page=page.replace('Both cuts finished: the deep cut (13 min 41 s) and the 90-second cut (87 s), with captions on time and the real Mercedes badge', 'Both repaired cuts finished: the long video (13 min 36 s) and the short (1 min 28 s), with captions on time and the real Mercedes badge')
        assert board.verify(page)==[]
        out=CACHE/f'{week}-prepared.html';board.write(page,meta,out)
        mappings=json.loads((CACHE/f'{name}-new-assets.json').read_text())
        # Keep old assets by immutable identity. A regenerated video card may use its Drive source URL.
        for aid, spec in state['manifest']['assets'].items():
            url=f'/api/board/{week}/assets/{aid}?sha={spec["sha256"]}'
            if url in page:
                mappings.append({'id':aid,'source_url':url,'existing_sha256':spec['sha256']})
        # Resolve Drive downloads against the exact recorded file IDs and known source hashes.
        import re
        current=json.loads((CACHE/f'{"fri" if day=="fri" else "mon"}-making.json').read_text())
        records=current.get('making',{}).get('video_assets',[])
        for v in records:
            for item in [v,v.get('thumbnail',{})]:
                m=board.DRIVE_ID.search(item.get('url',''))
                if not m: continue
                url=f'https://drive.usercontent.google.com/download?id={m[1]}&export=download'
                if html.escape(url,quote=True) not in page and url not in page: continue
                # Published asset names are the original filenames; match the record's path/name.
                filename=Path(item.get('path') or item.get('name') or '').name
                found=[(aid,s) for aid,s in state['manifest']['assets'].items() if s.get('name')==filename]
                if len(found)!=1:
                    raise RuntimeError(f'Cannot resolve preserved Drive download: {filename}')
                aid,spec=found[0]
                old=next((x for x in mappings if x['id']==aid),None)
                source=html.escape(url,quote=True) if html.escape(url,quote=True) in page else url
                if old:
                    page=page.replace(source,old['source_url'])
                else: mappings.append({'id':aid,'source_url':source,'existing_sha256':spec['sha256']})
        # The live rebuild refreshes other made days' video cards too. Their
        # migration asset IDs retain the exact Drive ID; preserve those objects.
        for source in set(re.findall(r'https://drive.usercontent.google.com/download\?[^"< ]+', page)):
            match=board.DRIVE_ID.search(html.unescape(source))
            aid='drive-'+match[1] if match else ''
            spec=state['manifest']['assets'].get(aid)
            if not spec: raise RuntimeError('A Drive download has no verified migration asset')
            old=next((x for x in mappings if x['id']==aid),None)
            if old: page=page.replace(source,old['source_url'])
            else: mappings.append({'id':aid,'source_url':source,'existing_sha256':spec['sha256']})
        page=board.engine_stamp.stamp(page,'week_board');board.write(page,meta,out)
        save(CACHE/f'{week}-assets.json',mappings)
        receipts.append({'week':week,'expected_build':state['build_id'],'page':str(out),'assets':len(mappings)})
        print(json.dumps(receipts[-1]))
    save(PLAN/'prepared-builds.json',receipts)

if __name__=='__main__':main()
