"""Keep the previously sync-checked audio while repairing only narrative pictures."""
import argparse
import hashlib
import json
import shutil
import subprocess
from pathlib import Path


def sha(path):
    with Path(path).open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()


def stream_hash(path,stream):
    return subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-map',f'0:{stream}:0',
        f'-c:{stream}','copy','-f','hash','-hash','sha256','-'],text=True).strip()


def main():
    ap=argparse.ArgumentParser();ap.add_argument('work',type=Path);ap.add_argument('cut',choices=['long','short']);a=ap.parse_args()
    w=a.work.resolve();cut=a.cut;shape='16x9' if cut=='long' else '9x16'
    folder=w/f'render-{cut}-narrative';video=folder/f'muse-vs-grok-{cut}-{shape}.mp4'
    receipt=Path(str(video)+'.validation.json')
    original=w/'prior-narrative-2026-10-22'/video.name
    prior=json.loads(Path(str(original)+'.validation.json').read_text(encoding='utf-8'))
    current=json.loads(receipt.read_text(encoding='utf-8'))
    assert prior['video_sha256']==sha(original) and current['video_sha256']==sha(video)
    if prior['checks']['sync']['status']!='pass' or prior['checks']['loudness']['status']!='pass':
        raise ValueError('The source audio lacks its previous technical checks')
    if abs(float(prior['narrative_revision']['single_intro_frames'])-float(current['narrative_revision']['single_intro_frames']))>0:
        raise ValueError('Intro clock changed')
    picture_before=stream_hash(video,'v');sound_source=stream_hash(original,'a')
    raw_copy=folder/'before-approved-audio.mp4';shutil.copy2(video,raw_copy)
    temp=folder/'with-approved-audio.mp4'
    subprocess.run(['ffmpeg','-nostdin','-y','-v','error','-i',str(raw_copy),'-i',str(original),
        '-map','0:v:0','-map','1:a:0','-c','copy','-movflags','+faststart',str(temp)],check=True)
    assert stream_hash(temp,'v')==picture_before
    assert stream_hash(temp,'a')==sound_source
    shutil.move(temp,video)
    current['video_sha256']=sha(video)
    current['audio_only_remux_derivation']={'source_video_sha256':sha(original),
        'source_audio_payload_sha256':sound_source,'new_audio_payload_sha256':stream_hash(video,'a'),
        'picture_payload_sha256':stream_hash(video,'v'),
        'prior_sync_report':prior['checks']['sync'].get('report_sha256'),
        'prior_loudness':prior['checks']['loudness'],
        'scope':'The spoken voice, score dings and audio alignment are byte-identical to the last checked export; picture changes require fresh inspection.'}
    receipt.write_text(json.dumps(current,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print(json.dumps({'cut':cut,'video_sha256':current['video_sha256'],'approved_audio_payload':sound_source}))


if __name__=='__main__':main()
