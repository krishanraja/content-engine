"""Advance the voice one frame against the supplied stabilised picture."""
import json
import shutil
import subprocess
import sys
from pathlib import Path
from render_narrative import audio,save,sha

w=Path(sys.argv[1]).resolve();out=w/'render-short-narrative';video=out/'muse-vs-grok-short-9x16.mp4';receipt=Path(str(video)+'.validation.json')
prior=out/'before-frame-correction.mp4';before=json.loads(receipt.read_text())
assert before['video_sha256']==sha(video)
if prior.exists():raise RuntimeError('The retained prior export exists; do not apply this repair twice')
shutil.copy2(video,prior);shutil.copy2(receipt,out/'before-frame-correction.validation.json')
shutil.copy2(out/'mix.wav',out/'mix-before-frame-correction.wav')
plan=json.loads((w/'narrative/short/edit-plan.json').read_text());mix=audio(w,'short',plan,out)
save(out/'mix-recipe.json',{'edit_plan_sha256':sha(w/'narrative/short/edit-plan.json'),'version':2})
temp=out/'frame-corrected.mp4'
subprocess.run(['ffmpeg','-nostdin','-y','-v','error','-threads','2','-i',str(prior),'-i',str(mix),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-movflags','+faststart',str(temp)],check=True)
def picture_hash(p):return subprocess.check_output(['ffmpeg','-v','error','-threads','2','-i',str(p),'-map','0:v:0','-c:v','copy','-f','hash','-hash','sha256','-'],text=True).strip()
assert picture_hash(prior)==picture_hash(temp),'Picture payload changed during audio-only repair'
shutil.move(temp,video)
before['video_sha256']=sha(video)
before['narrative_revision']['mix_sha256']=sha(mix)
before['audio_frame_correction']={'prior_video_sha256':sha(prior),'voice_advanced_samples':2000,'sample_rate':48000,'voice_advanced_ms':2000/48,'encoded_picture_payload_sha256':picture_hash(video),'score_effects':'Unchanged visual event clock; dings were rebuilt after voice alignment','reason':'The supplied stabilised camera produced a -80 ms first-window estimate; all observed later windows were -40 ms. Advance by one 24 fps frame, then remeasure independently.'}
save(receipt,before);save(out/'audio-frame-correction.json',before['audio_frame_correction'])
print('Remuxed exact unchanged pictures with the one-frame voice adjustment',before['video_sha256'],flush=True)
