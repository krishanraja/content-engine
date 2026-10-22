"""Record explicit full-playback acceptance of the exact board exports."""
import argparse
import copy
import json
import sys
from pathlib import Path

PLAN=Path(__file__).resolve().parent;ROOT=PLAN.parents[2]
sys.path.insert(0,str(ROOT/'scripts/post-pack'));import board_web as web
sys.path.insert(0,str(ROOT/'scripts/quick-edit'));import quality

def main():
    ap=argparse.ArgumentParser();ap.add_argument('work',type=Path);ap.add_argument('--said',required=True);ap.add_argument('--apply',action='store_true');a=ap.parse_args();w=a.work
    state=web.call('GET','/api/board/2026-10-19');decisions=[]
    for cut,shape in [('long','16x9'),('short','9x16')]:
        video=w/f'render-{cut}-stable'/f'muse-vs-grok-{cut}-{shape}.mp4';p=Path(str(video)+'.validation.json')
        receipt=json.loads(p.read_text(encoding='utf-8'));digest=quality.digest(video)
        assert state['manifest']['assets']['wed-video-'+cut]['sha256']==digest==receipt['video_sha256'],'The board export changed after playback'
        assert all(receipt['checks'][key]['status']=='pass'for key in ['sync','motion','loudness','visuals']),'Technical checks must pass before acceptance'
        previous=receipt['checks']['heard']
        raw=copy.deepcopy(previous.get('raw_recognizer_check',previous))
        receipt['checks']['heard']={'status':'pass','method':'Krish full-playback adjudication of retained recognizer differences',
            'by':'Krish','said':a.said,'video_sha256':digest,'raw_recognizer_check':raw,
            'decoded_audio_sha256':receipt['visual_revision']['decoded_audio_sha256']}
        receipt['checks']['full_review']={'status':'pass','by':'Krish','said':a.said,'video_sha256':digest,
            'scope':'Full phone playback, motion, framing and spoken flow; independent technical evidence remains separate'}
        if a.apply:
            p.write_text(json.dumps(receipt,indent=2,ensure_ascii=False),encoding='utf-8')
            assert not quality.delivery_problems(video,p)
        decisions.append({'cut':cut,'video_sha256':digest,'by':'Krish','said':a.said})
    if a.apply:(w/'playback-acceptance.json').write_text(json.dumps({'build_id':state['build_id'],'decisions':decisions},indent=2,ensure_ascii=False),encoding='utf-8')
    print(json.dumps({'applied':a.apply,'decisions':decisions}),flush=True)

if __name__=='__main__':main()
