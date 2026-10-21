"""Stage an explicitly held review pack, without marking the piece made.

Unaccepted video exports go in Working - review, never the delivery lane.
The exact validation receipts travel with them, including unresolved checks.
"""
import argparse
import json
import sys
import zipfile
from pathlib import Path

PLAN=Path(__file__).resolve().parent
ROOT=PLAN.parents[2]
sys.path.insert(0,str(ROOT/'scripts/post-pack'))
import build


def main():
    ap=argparse.ArgumentParser();ap.add_argument('work',type=Path);ap.add_argument('--videos',action='store_true')
    a=ap.parse_args();w=a.work.resolve()
    files=[]
    def item(path,kind=None,category=None,name=None,purpose=None,**extra):
        d={'file':str(Path(path).resolve()),**extra}
        if kind:d['kind']=kind
        if category:d['category']=category
        if name:d['name']=name
        if purpose:d['purpose']=purpose
        files.append(d)
    for name,kind in [('page.html','web-page'),('substack.html','substack-copy'),
                      ('email-pictures-off.html','email-pictures-off'),('cover.png','cover')]:
        item(w/'article'/name,kind=kind,logos=['Grok Bot','Meta'])
    for cut,shape in [('long','wide'),('short','tall')]:
        item(PLAN/f'recorded-{cut}-script.md',kind='video-script',name=f'recorded-{cut}-script.md')
        thumb='thumb-wide-1280x720.jpg' if cut=='long' else 'thumb-tall-1080x1920.jpg'
        item(w/'thumbs'/thumb,kind='thumbnail',shape=shape,logos=['Grok Bot','Meta'])
    for name in ['scam-grok','flight-layover','news-date','email-duplicate','starting-point']:
        item(w/'article-cards'/f'{name}.png',kind='image',logos=['Grok Bot','Meta'],
             shows='logos' if name=='starting-point' else 'reconstruction',
             data_source='docs/plans/2026-10-19-week/test-results/README.md',
             scope='Anonymised reconstruction of observed output. No screenshot, exhaustive audit or reliability rate is claimed.')
    item(w/'takeaway/scorecard.png',kind='share-card',logos=['Grok Bot','Meta'],shows='evidence')
    item(ROOT/'docs/plans/2026-10-19-week/wednesday-article-draft.md',category='article',name='article-review.md',
         purpose='Article draft in review. The fact gate remains open; this file is not labelled fact-checked.')
    item(ROOT/'docs/plans/2026-10-19-week/wednesday-scorecard.md',category='article',
         purpose='Five plain-cell round results with links to the research. Personal and community evidence stay separate.')
    item(PLAN/'publishing-copy.md',category='social',purpose='Editable channel copy for review; no public posts have been made.')
    for name in ['release-review.md','claim-review.md','packaging-approval.json']:
        item(PLAN/name,category='publish',purpose='Review status, evidence and the exact recorded approval. Read before posting.')
    folders=['cards','article-cards','story','kit-short','kit-long','review-short','review-long']
    archive=w/'production-working.zip'
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
        for folder in folders:
            for p in (w/folder).rglob('*'):
                if p.is_file() and (not p.name.startswith('frame-') or p.suffix=='.json'):
                    z.write(p,p.relative_to(w).as_posix())
        for name in ['short.words.json','long.words.json','long-removals.json','fact-result.json',
                     'fact-after.json','voice-check.json','ai-scan.log']:
            p=w/name
            if p.is_file():z.write(p,p.name)
        for folder in ['sync-short-source','sync-long-source','sync-short-final','sync-long-final-corrected']:
            p=w/folder/'sync-report.json'
            if p.is_file():z.write(p,p.relative_to(w).as_posix())
    item(archive,category='video',name='Working - review/production-working.zip',
         purpose='Working graphics, bookends, source transcription, cue clocks and review evidence. No delivery acceptance is implied.')
    if a.videos:
        for cut,shape,folder in [('short','9x16','render-short'),('long','16x9','render-long-corrected')]:
            base=w/folder/f'muse-vs-grok-{cut}-{shape}'
            for suffix in ['.mp4','.srt','.mp4.validation.json']:
                p=base.with_suffix(suffix)
                item(p,category='video',name='Working - review/'+p.name,
                     purpose='Review export or its exact captions and receipt. Playback acceptance and any failed checks remain open.')
    post=json.loads((PLAN/'post.json').read_text(encoding='utf-8'));post['files']=files
    post['release_status']='review';post['readiness_note']='Open fact findings and playback acceptance. Nothing has been publicly posted.'
    p=w/'review-post.json';p.write_text(json.dumps(post,indent=2,ensure_ascii=False),encoding='utf-8')
    result=build.build(p,out=w/'packs',replace=True)
    (w/'pack-result.json').write_text(json.dumps(result,indent=2,default=str),encoding='utf-8')
    print(json.dumps({'folder':result['folder'],'path':str(result['path']),'files':len(result['files'])}))


if __name__=='__main__':main()
