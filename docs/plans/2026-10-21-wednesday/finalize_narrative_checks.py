"""Bind the independent checks to the exact integrated review exports.

This does not certify continuous playback or adjudicate recognizer differences.
"""
import hashlib
import json
import math
import re
import sys
from pathlib import Path

W=Path(sys.argv[1]).resolve()


def sha(p):
    with Path(p).open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()


def read(p):return json.loads(Path(p).read_text(encoding='utf-8'))


def write(p,data):Path(p).write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')


for cut,shape in [('long','16x9'),('short','9x16')]:
    out=W/f'render-{cut}-narrative'
    video=out/f'muse-vs-grok-{cut}-{shape}.mp4'
    receipt_path=Path(str(video)+'.validation.json')
    receipt=read(receipt_path)
    assert sha(video)==receipt['video_sha256']
    sync_path=W/f'sync-{cut}-final-narrative-{"corrected" if cut=="long" else "limited"}'/'sync-report.json'
    sync=read(sync_path)
    assert sync['video_sha256']==sha(video) and sync['status']=='pass'
    assert sync['calibrated_this_run'] and len(sync['points'])==6
    assert all(row['status']=='pass' for row in sync['points'])
    receipt['checks']['sync']={'status':'pass','report_sha256':sha(sync_path),'points':len(sync['points']),
        'offsets_ms':[p['offset_ms'] for p in sync['points']],'method':'Six calibrated native SyncNet points across the final export'}

    log=W/f'loudness-{cut}-narrative{"-limited" if cut=="short" else ""}.log'
    matches=re.findall(r'\{\s*"input_i"\s*:[^}]+\}',log.read_text(encoding='utf-8',errors='replace'),re.S)
    assert matches,(cut,log)
    level=json.loads(matches[-1]);i=float(level['input_i']);tp=float(level['input_tp'])
    assert math.isfinite(i) and math.isfinite(tp)
    assert abs(i+14)<=1 and tp<=-1.0,(cut,i,tp)
    receipt['checks']['loudness']={'status':'pass','integrated_lufs':i,'true_peak_dbtp':tp,
        'target':'-14 +/-1 LUFS; true peak at most -1.0 dBTP','report_sha256':sha(log)}

    motion=W/('stability-long/full/motion-comparison.json'if cut=='long'else'supplied-short/motion-assessment.json')
    measure=read(motion)
    source=receipt['narrative_revision']['camera_provenance']['source']['camera_sha256']
    if cut=='long':
        assert measure['output_sha256']==source and measure['rms_reduction_fraction']>.6
        summary={'rms_reduction_fraction':measure['rms_reduction_fraction']}
        previous=read(W/f'render-long-stable/muse-vs-grok-long-16x9.mp4.validation.json')
        receipt['source_provenance']=previous['source_provenance']
        earlier=previous['checks']['motion']
        assessment=earlier['assessment']
        treatment=earlier['treatment']
        comparison=measure['comparison']
    else:
        assert measure['supplied']['sha256']==source
        before=[p['p95_translation_px'] for p in measure['original']['windows']]
        after=[p['p95_translation_px'] for p in measure['supplied']['windows']]
        assert len(before)==len(after)==5 and all(a<b for a,b in zip(after,before))
        summary={'original_p95_px':before,'supplied_p95_px':after,'source':'Krish-supplied auto-stabilised recording'}
        raw=W/'sources/user-stabilized-short.mp4'
        receipt['source_provenance']={'schema':1,'source_sha256':sha(raw),'source':'Krish-supplied auto-stabilised vertical recording'}
        assessment={'source_sha256':measure['original']['sha256'],'evidence_sha256':sha(motion),
            'method':'Sequential static-wall optical-flow and robust affine fits in five distributed windows'}
        replacement=W/'supplied-short/source-replacement.json'
        treatment={'output_sha256':measure['supplied']['sha256'],'evidence_sha256':sha(replacement)}
        avg=lambda x:sum(x)/len(x)
        comparison={'before_rms_px':avg([p['rms_translation_px'] for p in measure['original']['windows']]),
            'after_rms_px':avg([p['rms_translation_px'] for p in measure['supplied']['windows']]),
            'before_p95_px':avg(before),'after_p95_px':avg(after)}

    frames=W/f'review-{cut}-narrative/frame-samples.json'
    visual=read(frames)
    assert visual['video_sha256']==sha(video)
    assert 'audio_only_remux_derivation' in visual and len(visual['sets']['seconds']['frame_indices'])>= (300 if cut=='long'else 85)
    receipt['checks']['visuals']={'status':'pass','scope':'Every-second video frame and quarter-second bookend samples; encoded pictures unchanged by audio-only corrections',
        'report_sha256':sha(frames),'full_continuous_playback':'open'}
    receipt['checks']['motion']={'status':'pass','decision':'stabilised',
        'recording_sha256':receipt['source_provenance']['source_sha256'],
        'assessment':assessment,'treatment':treatment,'comparison':comparison,
        'final_review':{'status':'not_run','video_sha256':sha(video),'evidence_sha256':sha(frames),
            'shake':'not_run','warping':'not_run','borders':'not_run','framing':'pass',
            'reason':'Continuous playback of this exact recut has not been accepted by Krish'},
        'report_sha256':sha(motion),**summary}

    heard_path=out/'heard-diff.json';heard=read(heard_path)
    assert heard['status']=='fail' and len(heard['changes'])>0
    receipt['checks']['heard']={'status':'fail','reason':'Independent recognizer disagrees with retained source transcript; original speech and all differences are preserved for human adjudication',
        'report_sha256':sha(heard_path),'expected_words':heard['expected_words'],'heard_words':heard['heard_words'],'changes':heard['changes']}
    receipt['checks']['full_review']={'status':'not_run','reason':'Krish has not approved continuous playback of these exact recuts on his phone'}
    receipt['piece_id']='d7a20885-7001-4661-b444-9d7ca1043416'
    write(receipt_path,receipt)
    print(cut,sha(video),'sync/motion/loudness/sampled visuals passed; heard/full playback open',flush=True)
