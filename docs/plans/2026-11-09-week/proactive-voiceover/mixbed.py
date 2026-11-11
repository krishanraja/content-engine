import sys, json, subprocess, re, wave, numpy as np
sys.path.insert(0,'/home/user/content-engine/scripts'); import bed_shape as bs
src, out = sys.argv[1], sys.argv[2]; off = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0
lev=json.load(open('/home/user/content-engine/config/music-library.json'))['levels']
subprocess.run(['ffmpeg','-v','error','-y','-ss','2.0','-i',src,'-t','46.0','-ar','48000','-ac','2','bedtmp.wav'],check=True)
def lufs(p):
    e=subprocess.run(['ffmpeg','-hide_banner','-nostats','-i',p,'-af','ebur128','-f','null','-'],capture_output=True,text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS',e)[-1])
def read(p):
    w=wave.open(p); return np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float32).reshape(-1,2)/32768, w.getframerate()
bed,sr=read('bedtmp.wav'); voice,_=read('voice.wav'); n=min(len(bed),len(voice)); bed,voice=bed[:n],voice[:n]; T=n/sr
L=lufs('bedtmp.wav'); pts=bs.target_points(lev,0.0,40.88,T); t=np.arange(n)/sr
g=10**((np.interp(t,[p[0] for p in pts],[p[1] for p in pts])-L+np.where(t>40.88,off+1.5,off)+np.repeat([bs.fade_db(x,T) for x in t[::480]],480)[:n])/20)
bw=wave.open('bedonly.wav','wb'); bw.setnchannels(2); bw.setsampwidth(2); bw.setframerate(sr); bw.writeframes((np.clip(bed*g[:,None],-1,1)*32767).astype(np.int16).tobytes()); bw.close()
w=wave.open('pre.wav','wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr); w.writeframes((np.clip(voice+bed*g[:,None],-1,1)*32767).astype(np.int16).tobytes()); w.close()
subprocess.run(['ffmpeg','-v','error','-y','-i','pre.wav','-af','loudnorm=I=-14:TP=-1.0:LRA=11','-ar','48000',out],check=True)
print(out, 'bed source', L)
