"""Measure static-wall motion in continuous start, middle and end windows."""
import argparse
import hashlib
import json
from pathlib import Path

import cv2
import numpy as np
from measure_camera_motion import measure


def digest(p):
    with Path(p).open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()


def main():
    ap=argparse.ArgumentParser();ap.add_argument('work',type=Path);ap.add_argument('cut',choices=['long','short']);a=ap.parse_args()
    cv2.setNumThreads(2);w=a.work
    source=w/('render-long-corrected' if a.cut=='long' else 'render-short')/f'muse-vs-grok-{a.cut}.edited.mkv'
    out=w/f'stability-{a.cut}/full';target=out/'camera-stable.mkv'
    receipt=json.loads((out/'stabilisation.json').read_text(encoding='utf-8'))
    assert receipt['source_sha256']==digest(source) and receipt['output_sha256']==digest(target),'Stabilisation is incomplete or stale'
    starts=[0,39,79] if a.cut=='short' else [0,70,150,230,322]
    rows=[]
    for start in starts:
        pair={side:measure(path,start,10) for side,path in [('before',source),('after',target)]}
        assert all(value['tracked_pairs']>=220 for value in pair.values()),'Insufficient wall tracking'
        rows.append(pair)
        print(json.dumps({'start':start,**{side:{k:v for k,v in data.items() if k not in ('points','file','method')} for side,data in pair.items()}}),flush=True)
    metrics={}
    for side in ['before','after']:
        points=[p for row in rows for p in row[side]['points']]
        shifts=np.array([[p['dx_px'],p['dy_px']] for p in points]);speed=np.linalg.norm(shifts,axis=1)
        metrics[side+'_rms_px']=float(np.sqrt(np.mean(speed**2)))
        metrics[side+'_p95_px']=float(np.percentile(speed,95))
    result={'source_sha256':digest(source),'output_sha256':digest(target),'comparison':metrics,
        'rms_reduction_fraction':1-metrics['after_rms_px']/metrics['before_rms_px'],
        'method':'Separate optical-flow measurement on static upper-wall features in continuous distributed windows',
        'windows':rows}
    (out/'motion-comparison.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in result.items() if k!='windows'}),flush=True)


if __name__=='__main__':main()
