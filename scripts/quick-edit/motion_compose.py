"""Compose a continuous, already prepared voiceover with a timed motion render.

Called only by make.py. It shares the production music/mix/transcription code,
never trims or speeds speech, and leaves perceptual delivery gates open.
"""
import json
import math
import re
import subprocess
from pathlib import Path
import quality


def probe(path):
    return json.loads(subprocess.run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(path)],capture_output=True,text=True,check=True).stdout)


def verify(cfg, base):
    p=lambda value:(base/value).resolve()
    motion=cfg['motion_composition']
    if cfg.get('captions') is not False:
        raise ValueError('Motion compositions require separate caption files')
    if cfg.get('remove') or cfg.get('remove_words'):
        raise ValueError('Prepare and verify speech edits before motion composition')
    glossary=cfg.get('caption_glossary')
    if glossary and quality.digest(p(glossary['path']))!=glossary['sha256']:
        raise ValueError('Caption glossary evidence changed')
    for key in ('audio','picture','intro','outro','words','original'):
        item=motion[key]
        if quality.digest(p(item['path']))!=item['sha256']:
            raise ValueError(f'Motion {key} differs from its bound input')
    audio=p(motion['audio']['path']); data=probe(audio)
    if any(s['codec_type']=='video' for s in data['streams']):
        raise ValueError('This continuous voiceover route does not accept camera footage')
    speed=float(motion['speed'])
    if not math.isfinite(speed) or speed<=0:
        raise ValueError('Invalid preparation speed')
    identity=quality.transcript_identity(audio,speed,cfg.get('model','small.en'))
    words=quality.checked_words(json.loads(p(motion['words']['path']).read_text()),identity)
    source_duration=float(probe(p(motion['original']['path']))['format']['duration'])
    prepared_duration=float(data['format']['duration'])
    if abs(prepared_duration-source_duration/speed)>.05:
        raise ValueError('Continuous preparation duration does not match original and speed')
    frames=motion['frames']
    if not isinstance(frames,int) or frames<=0 or abs(frames/30-prepared_duration)>1/30:
        raise ValueError('Motion and voice clocks differ by more than one frame')
    for key,expected in [('picture',frames),('intro',105),('outro',180)]:
        streams=probe(p(motion[key]['path']))['streams']
        video=next(s for s in streams if s['codec_type']=='video')
        if video.get('nb_frames')!=str(expected) or video.get('r_frame_rate')!='30/1':
            raise ValueError(f'{key} does not match its 30fps frame count')
        if (video['width'],video['height'])!=(1080,1920):
            raise ValueError(f'{key} has the wrong shape')
    if (frames+285)/30>=89:
        raise ValueError('Short exceeds the approved 89-second limit')
    return p,motion,audio,identity,words


def compose(cfg,base,out,api,plan_only=False):
    p,motion,audio,identity,words=verify(cfg,base)
    api.FPS=30
    tl=api.timeline(105,motion['frames'],180,words)
    bed,note=api.resolve_music(cfg,'9x16',tl['total_s'],base)
    if not bed:
        raise ValueError('Approved voiceover music unavailable: '+str(note))
    if plan_only:
        print(json.dumps({'timeline':tl,'source_provenance':identity,'music':bed['track']['id'],'speech_edits':0},indent=2));return
    work=out/'mix';work.mkdir(parents=True,exist_ok=True)
    gain=-14-float(api.measure_loudness(audio)['input_i'])
    sound=api.build_audio(work,audio,gain,True,True,tl,bed)
    final=out/(cfg['name']+'-9x16.mp4')
    graph=';'.join(f'[{i}:v]setpts=PTS-STARTPTS,setsar=1,format=yuv420p[v{i}]' for i in range(3))+';[v0][v1][v2]concat=n=3:v=1:a=0[V]'
    api.ffmpeg('-threads','2','-i',str(p(motion['intro']['path'])),'-threads','2','-i',str(p(motion['picture']['path'])),'-threads','2','-i',str(p(motion['outro']['path'])),'-i',str(sound['mix']),'-filter_complex',graph,'-map','[V]','-map','3:a','-c:v','libx264','-crf','16','-preset','medium','-threads','2','-c:a','aac','-b:a','256k','-ar','48000','-movflags','+faststart',str(final))
    loud=api.measure_cut(final,tl,sound)
    # The shared limiter can leave a small linear gain available. Measure the
    # AAC result, apply only that headroom to the PCM mix, and encode from PCM.
    if loud['integrated'] is not None and loud['true_peak'] is not None:
        gain=min(bed['levels']['final_integrated_lufs']-loud['integrated'],bed['levels']['max_true_peak_dbtp']-.15-loud['true_peak'])
        if gain>0:
            fixed=final.with_name(final.stem+'.level.mp4')
            api.ffmpeg('-i',str(final),'-i',str(sound['mix']),'-map','0:v','-map','1:a','-c:v','copy','-af',f'volume={gain:.4f}dB','-c:a','aac','-b:a','256k','-ar','48000','-movflags','+faststart',str(fixed))
            fixed.replace(final)
            sound['prior_normalisation']=sound['normalisation'];sound['normalisation']='linear'
            sound['final_linear_gain_db']=gain
            loud=api.measure_cut(final,tl,sound)
            loud['final_linear_gain_db']=gain
            loud['prior_normalisation']=sound['prior_normalisation']
    heard=api.transcribe(final,out/(final.stem+'.heard.json'),cfg.get('model','small.en'),provenance=quality.transcript_identity(final,1,cfg.get('model','small.en')))
    narration=out/(final.stem+'.narration.txt');narration.write_text(' '.join(w['w'].strip() for w in heard),encoding='utf8')
    # Fresh final clock, never source or divided word timings.
    def stamp(t):
        ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
    # Only use the job's explicit, source-bound spelling adjudications. The raw
    # transcription and its diff remain available for the listening reviewer.
    glossary=cfg.get('caption_glossary')
    captions=[dict(w) for w in heard]
    if glossary:
        for w in captions:
            for before,after in glossary['replacements'].items():
                w['w']=re.sub(r'\b'+re.escape(before)+r'\b',after,w['w'],flags=re.I)
    groups=api.chunks(captions,[],max_words=5)
    srt=[]
    for i,g in enumerate(groups):
        srt.append(f"{i+1}\n{stamp(g[0]['s'])} --> {stamp(g[-1]['e'])}\n{''.join(w['w'] for w in g).strip()}\n")
    (out/(final.stem+'.srt')).write_text('\n'.join(srt),encoding='utf8')
    receipt={'video_sha256':quality.digest(final),'piece_id':cfg['piece_id'],'source_provenance':identity,'preparation':motion,
      'final_narration_sha256':quality.digest(narration),'caption_glossary':glossary,'timeline':tl,'music':sound['music'],'checks':{
        'heard':quality.word_diff(words,heard),'loudness':{'status':'fail' if api.loudness_warnings(loud,bed['levels']) else 'pass','measurements':loud},
        'sync':{'status':'not_run','reason':'Voiceover: verify scene cues and final caption clock'},
        'motion':{'status':'not_run','reason':'No camera track; review composed animation and screen recording'},
        'visuals':{'status':'not_run'},'visual_clarity':{'status':'not_run'},'full_review':{'status':'not_run'}}}
    Path(str(final)+'.validation.json').write_text(json.dumps(receipt,indent=2),encoding='utf8')
    print(json.dumps({'file':str(final),'status':'working-render-review-required','timeline':tl,'checks':{k:v['status'] for k,v in receipt['checks'].items()}},indent=2))
