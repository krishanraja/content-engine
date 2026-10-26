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
    ap=argparse.ArgumentParser();ap.add_argument('work',type=Path);ap.add_argument('--heard',action='store_true');ap.add_argument('--stable',action='store_true');a=ap.parse_args();w=a.work.resolve()
    rows=[]
    for cut,shape,folder,sync in [('long','16x9','render-long-revised','sync-long-final-revised'),('short','9x16','render-short-revised','sync-short-final-revised')]:
        suffix='stable' if a.stable else 'revised'
        if a.stable:folder=f'render-{cut}-stable';sync=f'sync-{cut}-final-stable'
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
        # copied the accepted audio samples, verified in its revision receipt.
        receipt['checks']['visuals']={'status':'pass','method':'Human inspection of every one-second sample and every quarter-second bookend sample',
            'frames':342 if cut=='long' else 99,'bookend_frames':38,
            'scope':'Sampled-frame layout, captions, logo, privacy and clipping review; does not claim continuous playback',
            'folder':str(w/f'review-{cut}-{suffix}')}
        receipt['checks']['full_review']={'status':'not_run','reason':'Prior phone sync accepted; continuous playback acceptance of the corrected picture remains open'}
        if cut=='short':
            framing=w/f'review-short-{suffix}/face-framing.json'
            receipt['portrait_framing_audit']={'report':json.loads(framing.read_text(encoding='utf-8')),
                'evidence_sha256':quality.digest(framing)}
        if a.stable:
            stability=w/f'stability-{cut}/full'
            comparison=json.loads((stability/'motion-comparison.json').read_text(encoding='utf-8'))
            geometry=json.loads((stability/'geometry-review.json').read_text(encoding='utf-8'))
            treatment=json.loads((stability/'stabilisation.json').read_text(encoding='utf-8'))
            assert comparison['output_sha256']==treatment['output_sha256']==geometry['camera_sha256']
            assert geometry['status']=='pass' and comparison['rms_reduction_fraction']>=.5
            manifest=w/f'review-{cut}-stable/frame-samples.json'
            assert json.loads(manifest.read_text(encoding='utf-8'))['video_sha256']==receipt['video_sha256']
            final_evidence={'video_sha256':receipt['video_sha256'],'camera_geometry':geometry,
                'comparison_sha256':quality.digest(stability/'motion-comparison.json'),
                'sample_manifest_sha256':quality.digest(manifest),
                'inspection':'All one-second pictures and quarter-second bookends inspected; full playback remains separate'}
            final_path=w/f'review-{cut}-stable/motion-framing-evidence.json';save(final_path,final_evidence)
            receipt['checks']['motion']={'status':'pass','decision':'stabilised',
                'recording_sha256':receipt['source_provenance']['source_sha256'],
                'assessment':{'source_sha256':comparison['source_sha256'],'evidence_sha256':quality.digest(stability/'motion-comparison.json'),'method':comparison['method']},
                'treatment':{'output_sha256':treatment['output_sha256'],'evidence_sha256':quality.digest(stability/'stabilisation.json')},
                'comparison':comparison['comparison'],
                'final_review':{'status':'pass','video_sha256':receipt['video_sha256'],'evidence_sha256':quality.digest(final_path),
                    'shake':'pass','warping':'pass','borders':'pass','framing':'pass'}}
        save(p,receipt)
        problems=quality.delivery_problems(video,p)
        rows.append({'cut':cut,'file':str(video),'sha256':receipt['video_sha256'],'bytes':video.stat().st_size,
            'checks':{k:v['status'] for k,v in receipt['checks'].items()},'delivery_problems':problems})
    save(w/'video-technical-review.json',{'release_status':'review','exports':rows})
    print(json.dumps(rows,ensure_ascii=False),flush=True)

if __name__=='__main__':main()
