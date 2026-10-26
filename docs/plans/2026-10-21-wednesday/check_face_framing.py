"""Measure speaker centring on the native review sampler's actual frames."""
import json
import sys
from pathlib import Path

import cv2

folder=Path(sys.argv[1]).resolve()
manifest=json.loads((folder/'frame-samples.json').read_text(encoding='utf-8'))
indices=manifest['sets']['seconds']['frame_indices'];fps=manifest['fps']
detector=cv2.CascadeClassifier(cv2.data.haarcascades+'haarcascade_frontalface_default.xml')
rows=[];attempts=0
for i,index in enumerate(indices):
    at=index/fps
    if at<4 or at>92:continue
    attempts+=1
    image=cv2.imread(str(folder/'seconds'/f'frame-{i+1:05d}.jpg'))
    assert image is not None
    band=image[1000:1920,:];scale=480/band.shape[1]
    small=cv2.resize(band,(480,round(band.shape[0]*scale)))
    boxes=detector.detectMultiScale(cv2.cvtColor(small,cv2.COLOR_BGR2GRAY),scaleFactor=1.1,minNeighbors=5,minSize=(80,80))
    if not len(boxes):continue
    x,y,w,h=max(boxes,key=lambda b:b[2]*b[3])
    cx=(x+w/2)/small.shape[1];cy=(y+h/2)/small.shape[0]
    rows.append({'at_s':at,'x_fraction':round(cx,4),'y_fraction':round(cy,4),
                 'centred':bool(abs(cx-.5)<=.18 and abs(cy-.5)<=.20)})
bad=[r for r in rows if not r['centred']]
status='pass' if rows and len(rows)/attempts>=.8 and not bad else 'fail'
report={'video_sha256':manifest['video_sha256'],'status':status,'sampled':attempts,'detected':len(rows),
        'speaker_band':[0,1000,1080,920],'centre_bounds':{'x':[.32,.68],'y':[.3,.7]},
        'scope':'Face-centre geometry only; full-head room and composition still require visual review',
        'outliers':bad,'points':rows}
(folder/'face-framing.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({k:report[k] for k in ['status','sampled','detected','outliers']}))
raise SystemExit(0 if status=='pass' else 2)
