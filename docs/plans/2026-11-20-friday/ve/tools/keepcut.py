"""Cut a take to its reviewed keep spans in ONE ffmpeg graph (picture and sound trimmed together), each join moved to
the quietest 10 ms point within +-0.12 s of the plan's boundary and checked quiet (>= 18 dB under speech median).
Writes OUT.mov (h264 30 fps, pcm) and OUT.keepcut.json with every join's level. Refuses a loud join."""
import json,subprocess,sys,numpy as np
take,f32,keepf,out=sys.argv[1:5]
_k=json.load(open(keepf)); keep=_k.get('keep_session',_k['keep'])
a=np.fromfile(f32,dtype=np.float32); sr=16000
def lev(t): x=a[int(t*sr):int((t+0.01)*sr)]; return 20*np.log10(np.sqrt(np.mean(x**2))+1e-9) if len(x) else -120
voiced=[lev(t) for t in np.arange(0,len(a)/sr,0.01)]; v=sorted(l for l in voiced if l>-50); speech=v[len(v)//2]; ceil=speech-18
WS=None
def _gap_best(t,side='in'):
    global WS
    if WS is None:
        import json as _j
        w=_j.load(open(sys.argv[3].replace('long.edit-pass.json','long.take.mms.json').replace('short.edit-pass.json','short.take.mms.json'))); w=w['words'] if isinstance(w,dict) else w
        WS=sorted((float(x['start']),float(x['end'])) for x in w)
    if side=='in':
        first=[x for x in WS if x[0]>=t-0.06][0]; prev=[x for x in WS if x[1]<=first[0]-1e-6]
        lo,hi=(prev[-1][1] if prev else first[0]-0.3), first[0]
    else:
        last=[x for x in WS if x[1]<=t+0.06][-1]; nxt=[x for x in WS if x[0]>=last[1]-1e-6 and x[0]>last[0]]
        lo,hi=last[1], (nxt[0][0] if nxt else last[1]+0.3)
    if hi-lo<0.02: hi=lo+0.02
    c=[(lev(x),x) for x in np.arange(lo,hi,0.005)]; m=min(c); return float(m[0]),float(m[1])
def best(t,side='in'):
    c=[(lev(x),x) for x in np.arange(t-0.12,t+0.12,0.005)]; m=min(c); return float(m[0]),float(m[1])
def _unused(t,side='in'):
    rng=np.arange(t-0.15,t+0.001,0.01) if side=='in' else np.arange(t,t+0.151,0.01); c=[(lev(x),x) for x in rng]; m=min(c); return float(m[0]),float(m[1])
segs=[];joins=[];bad=[]
for i,(s,e) in enumerate(keep):
    if i>0: ls,s=best(s,'in')
    else: ls=None
    if i<len(keep)-1: le,e=best(e,'out')
    else: le=None
    segs.append((round(float(s),3),round(float(e),3)))
    for L,t,side in ((ls,s,'in'),(le,e,'out')):
        if L is not None:
            joins.append({"at":round(float(t),3),"side":side,"db":round(float(L),1)})
            if L>ceil: bad.append((round(float(t),3),round(float(L),1)))
rep={'take':take,"speech_db":round(float(speech),1),"quiet_ceiling_db":round(float(ceil),1),'segments':segs,'joins':joins,'loud_joins':bad,'kept_s':round(sum(e-s for s,e in segs),2)}
json.dump(rep,open(out.rsplit('.',1)[0]+'.keepcut.json','w'),indent=1)
print('kept',rep['kept_s'],'speech',rep['speech_db'],'loud',bad)
if bad and '--force' not in sys.argv: sys.exit(1)
import os,tempfile
tmp=tempfile.mkdtemp(dir=os.path.dirname(out) or '.'); parts=[]; frames=0
for i,(s0,e0) in enumerate(segs):
    n=max(1,round((e0-s0)*30)); d=n/30; frames+=n
    pth=f"{tmp}/p{i:03d}.mov"
    subprocess.run(['ffmpeg','-v','error','-y','-ss',f'{s0:.4f}','-i',take,'-t',f'{d:.6f}','-vf','fps=30','-frames:v',str(n),
      '-af',f'atrim=0:{d:.6f},apad=whole_dur={d:.6f},afade=t=in:d=0.03,afade=t=out:st={max(0,d-0.03):.4f}:d=0.03',
      '-c:v','libx264','-preset','veryfast','-crf','16','-pix_fmt','yuv420p','-r','30','-c:a','pcm_s16le','-ar','48000',pth],check=True)
    parts.append(pth)
open(f"{tmp}/list.txt",'w').write(''.join(f"file '{os.path.abspath(x)}'\n" for x in parts))
subprocess.run(['ffmpeg','-v','error','-y','-f','concat','-safe','0','-i',f"{tmp}/list.txt",'-c','copy',out],check=True)
rep['frames']=frames; rep['final_s']=round(frames/30,3); json.dump(rep,open(out.rsplit('.',1)[0]+'.keepcut.json','w'),indent=1)
import shutil; shutil.rmtree(tmp)
print('wrote',out,frames/30)
