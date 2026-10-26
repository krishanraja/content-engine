"""Finish the approved long cut's audio using the house chapter bed.

The final picture stream is copied byte-for-byte. Original review exports stay
unchanged. Chapter restarts use the actual retained-word cue transitions.
"""
import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

PLAN=Path(__file__).resolve().parent
ROOT=PLAN.parents[2]
sys.path.insert(0,str(ROOT/'scripts/quick-edit'))
import make
import quality

def main():
    ap=argparse.ArgumentParser();ap.add_argument('work',type=Path);a=ap.parse_args();w=a.work.resolve()
    source=w/'render-long-corrected';out=w/'render-long-music';out.mkdir(exist_ok=True)
    name='muse-vs-grok-long';stem=name+'-16x9'
    report=json.loads((source/(name+'.report.json')).read_text(encoding='utf-8'))
    shape=report['shapes']['16x9']
    tl={k:shape[v] for k,v in [('intro_s','intro_seconds'),('main_s','main_seconds'),
        ('outro_s','outro_seconds'),('total_s','total_seconds'),('voice_start_s','voice_start_seconds'),('voice_end_s','voice_end_seconds')]}
    # Each restart falls on an existing graphic transition at a new round.
    starts=['flight-fare-focus1','news-date-focus0','email-fee-focus0']
    windows=[]
    for wanted in starts:
        cue=next((c for c in report['cues'] if c['id']==wanted),None)
        if cue is not None:windows.append((cue['s']+tl['intro_s'],cue['e']+tl['intro_s']))
    # News and email labels can evolve; use the approved chapter's first cue.
    for at in [160,262]:
        cue=min(report['cues'],key=lambda c:abs(c['s']+tl['intro_s']-at))
        window=(cue['s']+tl['intro_s'],cue['e']+tl['intro_s'])
        if not any(abs(window[0]-x[0])<10 for x in windows):windows.append(window)
    tl['chapter_cards']=sorted(windows)
    bed,note=make.resolve_music({'music':'no-curves-instrumental','music_mode':'episode_bed'},'16x9',tl['total_s'])
    if bed is None:raise RuntimeError(note)
    voice=source/(name+'.voice.wav')
    gain=bed['levels']['final_integrated_lufs']-make.music.ebur128(voice)['I']
    audio=make.build_audio(out/'audio-16x9',voice,gain,True,True,tl,bed)
    final=out/(stem+'.mp4')
    make.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(source/(stem+'.mp4')),
        '-i',str(audio['mix']),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k',
        '-ar','48000','-ac','2','-movflags','+faststart',str(final)])
    loud=make.measure_cut(final,tl,audio)
    if loud.get('true_peak') is not None and loud['true_peak']>bed['levels']['max_true_peak_dbtp']:
        limited=out/(stem+'.limited.mp4')
        ceiling=10**((bed['levels']['max_true_peak_dbtp']-.8)/20)
        make.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(final),'-map','0','-c:v','copy',
            '-af',f'aresample=192000,alimiter=limit={ceiling:.3f}:attack=1:release=50:level=0,aresample=48000',
            '-c:a','aac','-b:a','256k','-movflags','+faststart',str(limited)])
        limited.replace(final);loud=make.measure_cut(final,tl,audio)
    def stream_hash(p):
        return subprocess.check_output(['ffmpeg','-v','error','-i',str(p),'-map','0:v:0','-c','copy','-f','hash','-hash','sha256','-'],text=True).strip()
    before,after=stream_hash(source/(stem+'.mp4')),stream_hash(final)
    assert before==after,'Picture stream changed during sound-only finishing'
    for ext in ['.srt','.ass']:shutil.copy2(source/(stem+ext),out/(stem+ext))
    receipt=json.loads((source/(stem+'.mp4.validation.json')).read_text(encoding='utf-8'))
    receipt['video_sha256']=quality.digest(final)
    receipt['audio_finishing']={'method':'house continuous chapter bed; copied picture stream',
        'source_video_sha256':quality.digest(source/(stem+'.mp4')),'video_stream_hash':after,
        'music':audio['music'],'voice_gain_db':gain}
    receipt['checks']['heard']={'status':'not_run','reason':'Fresh transcription of the music-finished export is required'}
    receipt['checks']['sync']={'status':'not_run'}
    receipt['checks']['loudness']={'status':'fail' if make.loudness_warnings(loud,bed['levels']) else 'pass','measurements':loud}
    receipt['checks']['full_review']={'status':'not_run'}
    (out/(stem+'.mp4.validation.json')).write_text(json.dumps(receipt,indent=2,default=str),encoding='utf-8')
    shape.update(music=audio['music'],loudness=loud,voice_gain_db=gain)
    shape['warnings']=[x for x in shape['warnings'] if 'cannot go under this cut' not in x]
    report['validation']={'16x9':{'ready_for_delivery':False,'problems':['Fresh finished-file checks and playback acceptance remain open']}}
    (out/(name+'.report.json')).write_text(json.dumps(report,indent=2,default=str),encoding='utf-8')
    print(json.dumps({'file':str(final),'sha256':receipt['video_sha256'],'picture_stream_unchanged':True,
        'loudness':{k:loud[k] for k in ('integrated','true_peak','bed_to_voice_lu','music_mode')}},default=str),flush=True)

if __name__=='__main__':main()
