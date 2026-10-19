"""Bring quiet long-cut music bookends to the approved levels, copying video.

Run once after render_video.py, before review_video.py. Preserve the previous
render and report, remeasure encoded audio, and refuse an out-of-bounds result.
"""
import json
import math
import shutil
import subprocess
import sys
from prepare_video import ROOT, WORK
sys.path.insert(0,str(ROOT/'scripts/quick-edit'))
import music

folder=WORK/'long'
report=folder/'why-ai-prices-keep-changing-long.report.json'
r=json.loads(report.read_text())
if r.get('bookend_balance'):
    raise SystemExit('Already balanced; render afresh before another pass.')
video=folder/r['16x9_file']
before=WORK/'review/long-before-bookend-balance';before.mkdir(parents=True,exist_ok=True)
shutil.copy2(video,before/video.name);shutil.copy2(report,before/report.name)
loud=r['loudness'];windows=loud['windows']
intro_db=-16-loud['intro_short_term'];outro_db=-18-loud['outro_short_term']
a=10**(intro_db/20);b=10**(outro_db/20)
turn=r['intro_seconds']+r['main_seconds']
# Linear gain ramps avoid a discontinuity at the speech and outro boundaries.
expr=f'if(lt(t,3.2),{a},if(lt(t,3.7),1+({a}-1)*(3.7-t)/0.5,if(lt(t,{turn}),1,if(lt(t,{turn+0.5}),1+({b}-1)*(t-{turn})/0.5,{b}))))'
target=folder/'bookend-balanced.mp4'
subprocess.run(['ffmpeg','-v','error','-y','-threads','2','-i',str(video),'-map','0','-c:v','copy',
    '-af',f"volume='{expr}':eval=frame,aresample=192000,alimiter=limit=0.70:attack=1:release=50:level=0:latency=1,aresample=48000",
    '-c:a','aac','-b:a','256k','-movflags','+faststart',str(target)],check=True)
m=music.ebur128(target)
if m['I'] is None or abs(m['I']+14)>1 or m['TP'] is None or m['TP']>-1:
    raise SystemExit(f'Balanced result outside approved audio bounds: {m}')
updated={**loud,'integrated':m['I'],'true_peak':m['TP'],'lra':m['LRA']}
for name in ['intro','voice','outro']:
    updated[f'{name}_short_term']=music.ebur128(target,*windows[name])['I']
target.replace(video)
r['loudness']=updated;r['shapes']['16x9']['loudness']=updated
r['bookend_balance']={'intro_gain_db':intro_db,'outro_gain_db':outro_db,
    'video_stream_copied':True,'before_loudness':loud,'after_loudness':updated}
report.write_text(json.dumps(r,indent=2)+'\n',encoding='utf-8')
print(json.dumps(r['bookend_balance'],indent=2))
