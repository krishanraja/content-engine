"""Measure continuous music locally and level it without moving audio samples."""
import hashlib
import json
import re
import subprocess
import wave
from pathlib import Path


def measure(path):
    proc=subprocess.run(['ffmpeg','-hide_banner','-nostats','-i',str(path),'-vn','-af',
        'ebur128=metadata=1:peak=true,ametadata=print,silencedetect=noise=-60dB:d=0.5',
        '-f','null','-'],capture_output=True,text=True,check=True)
    rows=[];current=None;silences=[];start=None
    for line in proc.stderr.splitlines():
        match=re.search(r'frame:\d+\s+pts:\S+\s+pts_time:([\d.]+)',line)
        if match:
            current={'t':float(match.group(1))};rows.append(current)
        match=re.search(r'lavfi\.r128\.(M|S|I)=([-\d.]+)',line)
        if match and current is not None:current[match.group(1)]=float(match.group(2))
        match=re.search(r'silence_start: ([\d.]+)',line)
        if match:start=float(match.group(1))
        match=re.search(r'silence_end: ([\d.]+)',line)
        if match and start is not None:silences.append([start,float(match.group(1))]);start=None
    if start is not None and rows:silences.append([start,rows[-1]['t']+.1])
    if not rows:raise ValueError('No EBU R128 timeline could be measured')
    return {'points':rows,'silences':silences}


def target_points(timeline,levels,chapters):
    total=timeline['total_s'];vs=timeline['voice_start_s'];ve=timeline['voice_end_s']
    baseline=levels['bed_lufs'];cards=list(chapters)
    times=sorted(set([0.,total,max(0,vs-.5),vs,ve,min(total,ve+.8)] +
                     [max(0,min(total,t)) for a,b in cards for t in (a-.5,a,b,b+.8)]))
    def target(t):
        value=baseline
        if t<vs:
            fade=min(.5,vs)
            value=levels['intro_lufs']+(baseline-levels['intro_lufs'])*max(0,(t-vs+fade)/fade)
        if t>=ve:value=baseline+(levels['outro_lufs']-baseline)*min(1,(t-ve)/.8)
        for a,b in cards:
            if a-.5<=t<=b+.8:
                value=max(value,baseline+(levels.get('chapter_lufs',-22)-baseline)*max(0,min(1,(t-a+.5)/.5,(b+.8-t)/.8)))
        return value
    return [(t,target(t)) for t in times]


def level_bed(source,destination,timeline,levels,chapters):
    """Three-second local loudness drives smooth gain; no resampling or cuts.

    The input is a quiet 16-bit stereo stem with all approved crossfades already
    applied. Final EBU measurement, not this gain calculation, decides acceptance.
    """
    import numpy as np
    measurements=measure(source)
    refs=[(max(0,p['t']-1.4),p['S']) for p in measurements['points'] if p['t']>=2.9 and p.get('S',-120)>-70]
    if not refs:raise ValueError('Music has no reliable local loudness measurements')
    # One reference each second avoids following individual beats.
    refs=refs[::10];curve=target_points(timeline,levels,chapters)
    with wave.open(str(source),'rb') as inp:
        if inp.getsampwidth()!=2 or inp.getframerate()!=48000:
            raise ValueError('Music reference must be signed 16-bit PCM at 48 kHz')
        channels=inp.getnchannels();count=inp.getnframes()
        proc=subprocess.Popen(['ffmpeg','-y','-v','error','-f','f32le','-ar','48000','-ac',str(channels),
                               '-i','pipe:0','-c:a','pcm_f32le',str(destination)],stdin=subprocess.PIPE)
        offset=0
        try:
            while raw:=inp.readframes(48000):
                samples=np.frombuffer(raw,np.int16).reshape(-1,channels).astype(np.float32)/32768
                at=(np.arange(len(samples))+offset)/48000
                desired=np.interp(at,[x[0] for x in curve],[x[1] for x in curve])
                reference=np.interp(at,[x[0] for x in refs],[x[1] for x in refs])
                gain=10**((desired-reference)/20)
                proc.stdin.write((samples*gain[:,None]).astype('<f4').tobytes());offset+=len(samples)
        finally:proc.stdin.close()
        if proc.wait()!=0:raise RuntimeError('Music level writer failed')
    return {'method':'sample-preserving gain from local three-second EBU R128 measurements',
            'samples':count,'references':refs,'target_points':curve}


def continuity_report(measurements,voice_start,voice_end,chapters):
    # A three-second measurement overlaps a transition if any of its source
    # window touches it. Exclude the whole window, not just its centre.
    windows=[]
    for p in measurements['points']:
        a,b=p['t']-2.9,p['t']+.1
        if a<voice_start or b>voice_end:continue
        if any(a<end+.8 and b>start-1.5 for start,end in chapters):continue
        if 'S' in p:windows.append({'start':a,'end':b,'lufs':p['S']})
    silence=[(max(a,voice_start),min(b,voice_end)) for a,b in measurements['silences']
             if min(b,voice_end)-max(a,voice_start)>.5+1e-6]
    good=sum(-36<=p['lufs']<=-28 for p in windows)
    normal=good/len(windows) if windows else 0
    problems=[]
    if not windows:problems.append('No eligible speech-bed measurement windows')
    if silence:problems.append('Music silence exceeds 0.5 seconds during speech')
    if normal<.9:problems.append('Fewer than 90% of eligible speech-bed windows are between -36 and -28 LUFS')
    return {'status':'fail' if problems else 'pass','problems':problems,'normal_fraction':normal,
            'eligible_windows':len(windows),'silences_during_speech':silence,'windows':windows}
