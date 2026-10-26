"""Bind fresh picture/sync checks to the two 23 October private review cuts."""
import hashlib
import json
import sys
from pathlib import Path


W=Path(sys.argv[1]).resolve()


def sha(path):
    with Path(path).open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()


def read(path):return json.loads(Path(path).read_text(encoding='utf-8'))


for cut,shape in [('long','16x9'),('short','9x16')]:
    folder=W/f'render-{cut}-narrative';video=folder/f'muse-vs-grok-{cut}-{shape}.mp4'
    receipt_path=Path(str(video)+'.validation.json');receipt=read(receipt_path)
    prior=read(W/'prior-narrative-2026-10-22'/(video.name+'.validation.json'))
    assert receipt['video_sha256']==sha(video)
    audio=receipt['audio_only_remux_derivation']
    assert audio['source_video_sha256']==prior['video_sha256']
    assert audio['source_audio_payload_sha256']==audio['new_audio_payload_sha256']

    sync_path=W/f'sync-{cut}-final-23oct'/'sync-report.json';sync=read(sync_path)
    assert sync['video_sha256']==sha(video) and sync['status']=='pass'
    assert sync['calibrated_this_run'] and len(sync['points'])==6
    assert all(row['status']=='pass' for row in sync['points'])
    receipt['checks']['sync']={'status':'pass','report_sha256':sha(sync_path),
        'points':6,'offsets_ms':[row['offset_ms'] for row in sync['points']],
        'method':'Six fresh calibrated native SyncNet points on the exact picture/audio remux'}

    frames=W/f'review-{cut}-23oct'/'frame-samples.json';visual=read(frames)
    assert visual['video_sha256']==sha(video)
    assert len(visual['sets']['seconds']['frame_indices'])>=(300 if cut=='long' else 85)
    receipt['checks']['visuals']={'status':'pass','scope':'Every-second picture samples and quarter-second bookends; affected full-resolution frames checked separately',
        'report_sha256':sha(frames),'full_continuous_playback':'open'}

    # The encoded audio stream is byte-identical to the earlier checked file.
    # Its loudness and recogniser report therefore carry without remeasurement.
    receipt['checks']['loudness']={**prior['checks']['loudness'],
        'carried_by_audio_payload_sha256':audio['new_audio_payload_sha256']}
    receipt['checks']['heard']={**prior['checks']['heard'],
        'carried_by_audio_payload_sha256':audio['new_audio_payload_sha256']}
    receipt['checks']['motion']={**prior['checks']['motion']}
    receipt['checks']['motion']['final_review']={**prior['checks']['motion']['final_review'],
        'status':'not_run','video_sha256':sha(video),'evidence_sha256':sha(frames),
        'reason':'The exact revised cut still needs continuous phone playback acceptance'}
    receipt['checks']['full_review']={'status':'not_run',
        'reason':'Krish has not yet watched this exact picture revision continuously on his phone'}
    receipt['source_provenance']=prior['source_provenance']
    receipt['piece_id']='d7a20885-7001-4661-b444-9d7ca1043416'
    receipt_path.write_text(json.dumps(receipt,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print(json.dumps({'cut':cut,'sha256':receipt['video_sha256'],
        'sync_offsets_ms':receipt['checks']['sync']['offsets_ms'],
        'sampled_frames':len(visual['sets']['seconds']['frame_indices']),
        'full_review':'open'}))
