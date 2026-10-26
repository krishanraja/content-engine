"""Cut a continuously sped take in one encode, on a shared audio/video clock.

No encoded segment files. Audio joins overlap by 10 ms; video timestamps and
word timings use those exact overlaps rather than summing rounded clip frames.
The result is preparation media, never a delivery or listening receipt.
"""
import json
import math
import subprocess
from pathlib import Path

RATE = 48000


def timeline(ranges, crossfade=.010):
    overlap = round(crossfade*RATE)
    if overlap < 1:
        raise ValueError('A positive crossfade is required')
    result, offset, previous = [], 0, -1
    for start, end in ranges:
        a,b = round(start*RATE),round(end*RATE)
        if a < 0 or a < previous or b-a <= overlap*2:
            raise ValueError('Retained ranges must be ordered, disjoint and longer than two crossfades')
        result.append({'a':a/RATE,'b':b/RATE,'off':offset/RATE,'samples':b-a})
        offset += b-a-overlap
        previous=b
    if not result:
        raise ValueError('No retained audio')
    return result,(offset+overlap)/RATE


def retime(words, spans):
    result=[]
    for w in words:
        touching=[g for g in spans if g['a']<w['e'] and g['b']>w['s']]
        containing=[g for g in touching if g['a']<=w['s']+1/RATE and g['b']>=w['e']-1/RATE]
        if touching and len(containing)!=1:
            raise ValueError('An edit intersects a word: '+w['w'].strip())
        if containing:
            g=containing[0]
            result.append({**w,'s':round(w['s']-g['a']+g['off'],6),
                           'e':round(w['e']-g['a']+g['off'],6)})
    return result


def render(source, destination, ranges, fps=30, crossfade=.010, video_filter=None):
    source,destination=Path(source),Path(destination)
    spans,duration=timeline(ranges,crossfade)
    streams=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-of','json',str(source)]))['streams']
    video=any(s['codec_type']=='video' and not s.get('disposition',{}).get('attached_pic') for s in streams)
    if not any(s['codec_type']=='audio' for s in streams):
        raise ValueError('Source has no audio')
    frames=math.ceil(duration*fps-1e-8) if video else None
    output_samples=round(frames*RATE/fps) if video else round(duration*RATE)
    args=['ffmpeg','-nostdin','-y','-hide_banner','-loglevel','error']
    filters=[]
    # One video decoder, streamed once. Audio inputs seek independently; their
    # bounded buffers avoid holding a long take's decoded pictures in memory.
    if video:
        args+=['-threads','2','-i',str(source)]
        choose='+'.join(f'gte(t,{g["a"]:.8f})*lt(t,{g["b"]:.8f})' for g in spans)
        clock='+'.join(f'gte(T,{g["a"]:.8f})*lt(T,{g["b"]:.8f})*(T-{g["a"]:.8f}+{g["off"]:.8f})' for g in spans)
        vf=(video_filter+',') if video_filter else ''
        filters.append(f"[0:v]setpts=PTS-STARTPTS,select='{choose}',setpts='({clock})/TB',"
                       f"fps={fps}:round=near,{vf}tpad=stop_mode=clone:stop_duration=1,trim=end_frame={frames},setpts=N/({fps}*TB)[v]")
    for i,g in enumerate(spans):
        args+=['-threads','1','-ss',f'{g["a"]:.8f}','-t',f'{g["b"]-g["a"]:.8f}','-i',str(source)]
        index=i+int(video)
        filters.append(f'[{index}:a]aresample={RATE},atrim=end_sample={g["samples"]},'
                       f'apad=whole_len={g["samples"]},atrim=end_sample={g["samples"]},asetpts=N/SR/TB[a{i}]')
    current='a0'
    for i in range(1,len(spans)):
        next_=f'join{i}'
        filters.append(f'[{current}][a{i}]acrossfade=ns={round(crossfade*RATE)}:c1=tri:c2=tri[{next_}]')
        current=next_
    filters.append(f'[{current}]apad=whole_len={output_samples},atrim=end_sample={output_samples},asetpts=N/SR/TB[a]')
    destination.parent.mkdir(parents=True,exist_ok=True)
    graph=destination.with_suffix('.filter.txt')
    graph.write_text(';\n'.join(filters),encoding='utf-8')
    args+=['-filter_complex',graph.read_text(encoding='utf-8')]
    if video:
        args+=['-map','[v]','-c:v','libx264','-threads','2','-preset','fast','-crf','12','-fps_mode','passthrough']
    part=destination.with_name(destination.stem+'.part.mkv')
    args+=['-map','[a]','-c:a','pcm_s16le',str(part)]
    subprocess.run(args,check=True)
    if video:
        import segment_clock
        clock=segment_clock.require(part,frames,fps)
    else:
        pcm=subprocess.check_output(['ffmpeg','-nostdin','-v','error','-i',str(part),'-map','0:a','-ac','1','-f','s16le','-'])
        if len(pcm)//2 != output_samples:
            raise ValueError('Audio sample count changed during the continuous edit')
        clock={'audio_samples':output_samples,'sample_error':0,'status':'pass'}
    part.replace(destination)
    return {'status':'prepared_not_deliverable','spans':spans,'crossfade_seconds':crossfade,
            'speech_seconds':duration,'clock':clock,'file':str(destination)}
