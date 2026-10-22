"""Apply the house oversampled peak ceiling to the short's final audio."""
import json
import shutil
import subprocess
import sys
from pathlib import Path
from render_narrative import save, sha

w=Path(sys.argv[1]).resolve()
out=w/'render-short-narrative'
video=out/'muse-vs-grok-short-9x16.mp4'
receipt=Path(str(video)+'.validation.json')
before=json.loads(receipt.read_text())
assert before['video_sha256']==sha(video)
prior=out/'before-peak-ceiling.mp4'
if prior.exists(): raise RuntimeError('Peak repair has already run')
shutil.copy2(video,prior)
shutil.copy2(receipt,out/'before-peak-ceiling.validation.json')
temp=out/'peak-ceiling.mp4'
subprocess.run(['ffmpeg','-nostdin','-y','-v','error','-threads','2','-i',str(prior),'-map','0',
    '-c:v','copy','-af','aresample=192000,alimiter=limit=0.813:attack=1:release=50:level=0,aresample=48000',
    '-c:a','aac','-b:a','256k','-ar','48000','-movflags','+faststart',str(temp)],check=True)
def picture_hash(p):return subprocess.check_output(['ffmpeg','-v','error','-threads','2','-i',str(p),'-map','0:v:0','-c:v','copy','-f','hash','-hash','sha256','-'],text=True).strip()
assert picture_hash(prior)==picture_hash(temp)
shutil.move(temp,video)
before['video_sha256']=sha(video)
before['audio_peak_ceiling']={'prior_video_sha256':sha(prior),'ceiling_linear':0.813,
    'method':'House oversampled limiter, audio-only remux; original recorded voice; unchanged encoded picture payload',
    'picture_payload_sha256':picture_hash(video),'prior_loudness':{'integrated_lufs':-14.27,'true_peak_dbtp':0.53},
    'next':'remeasure final loudness and sync'}
save(receipt,before)
save(out/'audio-peak-ceiling.json',before['audio_peak_ceiling'])
print('Peak-limited final short audio; picture unchanged',before['video_sha256'],flush=True)
