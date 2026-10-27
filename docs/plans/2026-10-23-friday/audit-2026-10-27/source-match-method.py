from pathlib import Path
import json,subprocess,numpy as np
from scipy.signal import correlate
w=Path(r'C:\Users\krish\Documents\Codex\2026-10-24\get-friday-s-videos-produced-and\work');ff=r'C:\Users\krish\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffmpeg.exe'
def audio(p,start,dur):
 return np.frombuffer(subprocess.check_output([ff,'-v','error','-ss',str(start),'-i',str(p),'-t',str(dur),'-vn','-ac','1','-ar','8000','-f','f32le','-']),np.float32)
def video(p,start,dur,filt):
 return np.frombuffer(subprocess.check_output([ff,'-v','error','-ss',str(start),'-i',str(p),'-t',str(dur),'-an','-vf',filt,'-f','rawvideo','-pix_fmt','gray','-']),np.uint8)
rows=[]
for name,points in [('cam-short',[10,62,68,74]),('cam-long',[10,260,300])]:
 src=w/('sped/Fri 23 Oct - 90-second - Two passports~2.speed-1.120-30fps.mkv' if name=='cam-short' else 'recordings/Fri 23 Oct - 5-minute - Two passports~2.mp4');out=w.parent/'outputs'/('Friday-short-camera-v10-REVIEW.mp4' if name=='cam-short' else 'Friday-long-camera-v11-REVIEW.mp4');edit=json.loads((w/'shipping-candidates'/f'{name}-edit.json').read_text())
 for t in points:
  clock=t-3.5;s=next(s for s in edit['spans'] if s['off']<=clock<s['off']+(s['b']-s['a']));expected=s['a']+clock-s['off'];begin=max(0,expected-2)
  x=audio(out,t,1);y=audio(src,begin,5);corr=correlate(y,x,mode='valid',method='fft');norm=np.sqrt(np.convolve(y*y,np.ones(len(x)),mode='valid')*np.sum(x*x));scores=corr/np.maximum(norm,1e-10);ix=int(np.argmax(scores));audio_source=begin+ix/8000
  short=name=='cam-short';wf,hf=(108,113) if short else (60,108)
  sf='crop=1080:1130:0:395' if short else 'scale=608:1080:force_original_aspect_ratio=increase,crop=608:1080'
  of='crop=1080:1130:0:0' if short else 'crop=608:1080:0:0'
  target=video(out,t,.04,of+f',scale={wf}:{hf}').reshape(-1,hf,wf)[0].astype(float)
  frames=video(src,begin,4,sf+f',fps=15,scale={wf}:{hf}').reshape(-1,hf,wf).astype(float);errors=np.mean(np.abs(frames-target),axis=(1,2));i=int(np.argmin(errors));vs=begin+i/15
  row={'cut':name,'export_t':t,'expected_source_t':expected,'audio_matched_source_t':audio_source,'audio_correlation':float(scores[ix]),'picture_matched_source_t_approx':vs,'picture_match_mean_abs_pixel_error':float(errors[i]),'picture_minus_audio_source_ms_approx':round((vs-audio_source)*1000),'resolution_note':'15fps search, roughly 67ms sampling; compares transport with source, not original capture lip sync'};rows.append(row);print(row,flush=True)
Path(r'C:\Users\krish\.scratch\friday-audit\sync-source-match.json').write_text(json.dumps(rows,indent=2))
