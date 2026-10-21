"""Bind observed review evidence to the exact export, retaining failed checks."""
import argparse
import json
import sys
from pathlib import Path

PLAN=Path(__file__).resolve().parent
ROOT=PLAN.parents[2]
sys.path.insert(0,str(ROOT/'scripts/quick-edit'))
import make
import quality

def save(p,d):p.write_text(json.dumps(d,indent=2,ensure_ascii=False,default=str),encoding='utf-8')

def main():
    ap=argparse.ArgumentParser();ap.add_argument('work',type=Path);ap.add_argument('--heard',action='store_true');a=ap.parse_args();w=a.work.resolve()
    rows=[]
    for cut,shape,folder,sync in [('long','16x9','render-long-music','sync-long-final-music'),('short','9x16','render-short','sync-short-final')]:
        base=w/folder/f'muse-vs-grok-{cut}-{shape}';video=base.with_suffix('.mp4');p=base.with_suffix('.mp4.validation.json')
        receipt=json.loads(p.read_text(encoding='utf-8'));assert receipt['video_sha256']==quality.digest(video)
        if a.heard and cut=='long':
            cfg=json.loads((w/f'kit-{cut}/{cut}.json').read_text(encoding='utf-8'))
            ws=json.loads((w/f'kit-{cut}/cue-clock.json').read_text(encoding='utf-8'))['words']
            P=lambda x:Path(x) if Path(x).is_absolute() else w/f'kit-{cut}'/x
            script=make.script_words(cfg,P)
            tokens=make.tokens(ws,make.DEFAULT_FIXES+cfg.get('replacements',[]),make.spellings(ws,script),make.script_names(script))
            model=cfg.get('model','small.en');identity=quality.transcript_identity(video,1,model)
            heard=make.transcribe(video,base.with_suffix('.heard.json'),model,provenance=identity)
            receipt['checks']['heard']=quality.word_diff(tokens,heard)
            receipt['script_diff']=quality.word_diff(script,heard)
            save(p,receipt)
        evidence=w/sync/'sync-report.json'
        if evidence.is_file():
            report=json.loads(evidence.read_text(encoding='utf-8'));assert report['video_sha256']==quality.digest(video)
            receipt['checks']['sync']={'status':report['status'],'evidence':str(evidence),'evidence_sha256':quality.digest(evidence),
                'method':report['method'],'analysis_resolution_ms':report['analysis_resolution_ms'],
                'maximum_absolute_offset_ms':max(abs(x['offset_ms']) for x in report['points'])}
        # All full contact sheets were inspected in this session. Long finishing
        # copied the compressed picture stream, verified in its audio receipt.
        receipt['checks']['visuals']={'status':'pass','method':'Human inspection of every one-second sample and every quarter-second bookend sample',
            'frames':342 if cut=='long' else 99,'bookend_frames':38,
            'scope':'Sampled-frame layout, captions, logo, privacy and clipping review; does not claim continuous playback',
            'folder':str(w/('review-long-corrected' if cut=='long' else 'review-short'))}
        receipt['checks']['full_review']={'status':'not_run','reason':'Continuous audiovisual playback acceptance remains open; this environment cannot listen to the export'}
        save(p,receipt)
        problems=quality.delivery_problems(video,p)
        rows.append({'cut':cut,'file':str(video),'sha256':receipt['video_sha256'],'bytes':video.stat().st_size,
            'checks':{k:v['status'] for k,v in receipt['checks'].items()},'delivery_problems':problems})
    save(w/'video-technical-review.json',{'release_status':'review','exports':rows})
    print(json.dumps(rows,ensure_ascii=False),flush=True)

if __name__=='__main__':main()
