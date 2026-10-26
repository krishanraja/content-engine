"""Recompose the corrected picture through the house graph, copying accepted sound.

No speech edit, sample, frame count, speed or caption changes. Original exports
remain untouched. The result stays in review with the original heard differences.
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
import kit
import quality

def save(p,d):p.write_text(json.dumps(d,indent=2,ensure_ascii=False,default=str),encoding='utf-8')

def prepare(w,cut,suffix='revised',card_folder='cards-revised'):
    prior=w/f'kit-{cut}';out=w/f'kit-{cut}-{suffix}';out.mkdir(exist_ok=True)
    story=w/'story-revised'
    for shape in ['16x9','9x16']:shutil.copy2(w/'story'/f'outro-{shape}.mp4',story/f'outro-{shape}.mp4')
    post=json.loads((prior/'post.json').read_text(encoding='utf-8'))
    for entry in post['files']:
        if entry.get('kind')=='image':entry['file']=str(w/card_folder/Path(entry['file']).name)
    post_path=out/'post.json';save(post_path,post)
    cfg=json.loads((prior/f'{cut}.json').read_text(encoding='utf-8'))
    save(out/f'{cut}.json',cfg)  # Native kit recognises the retained hand cues.
    result=kit.make_kit(post_path,cut,w/'sources'/f'{cut}-original.mp4',out,roots=[w/card_folder,story],force=False)
    if kit.exit_code(result):raise RuntimeError('; '.join(result['problems']))
    fresh=json.loads(Path(result['config']).read_text(encoding='utf-8'))
    cfg['kit']=fresh['kit'];cfg['face']=[560,920];cfg['logo']=False
    cfg['intro']={s:str(story/f'intro-{s}.mp4') for s in ['16x9','9x16']}
    cfg['endcard']={s:str(story/f'outro-{s}.mp4') for s in ['16x9','9x16']}
    save(out/f'{cut}.json',cfg)
    shutil.copy2(prior/'cue-clock.json',out/'cue-clock.json')

def audio_hash(path):
    return subprocess.check_output(['ffmpeg','-nostdin','-v','error','-threads','1','-i',str(path),'-map','0:a:0',
        '-threads','1','-c:a','pcm_s32le','-f','hash','-hash','sha256','-'],text=True).strip()

def render(w,cut,preview=False,camera=None,output_folder=None,accepted_folder=None,profile_folder=None,existing=False):
    aspect='16x9' if cut=='long' else '9x16'
    old=w/(accepted_folder or ('render-long-music' if cut=='long' else 'render-short'))
    original=w/('render-long-corrected' if cut=='long' else 'render-short')/f'muse-vs-grok-{cut}.edited.mkv'
    edited=Path(camera) if camera else original
    profile=w/(profile_folder or f'kit-{cut}-revised');out=w/(output_folder or f'render-{cut}-revised');out.mkdir(exist_ok=True)
    cfg=json.loads((profile/f'{cut}.json').read_text(encoding='utf-8'));make.FPS=24
    report=json.loads((old/f'muse-vs-grok-{cut}.report.json').read_text(encoding='utf-8'))
    shape=report['shapes'][aspect];total=shape['main_seconds']
    words=json.loads((profile/'cue-clock.json').read_text(encoding='utf-8'))['words']
    wins,missing=make.cue_windows(words,cfg['cues'],total,strict=True)
    assert not missing
    coverage=quality.coverage(wins,0,total)
    assert coverage['fraction']>=.9 and coverage['max_gap_s']<=1.5
    if aspect=='9x16':assert not quality.coverage_problems(coverage)
    P=lambda p:Path(p) if Path(p).is_absolute() else profile/p
    intro={'file':P(cfg['intro'][aspect]),**make.clip_info(P(cfg['intro'][aspect]))}
    end={'file':P(cfg['endcard'][aspect]),**make.clip_info(P(cfg['endcard'][aspect]))}
    assert intro['frames']==84 and end['frames']==144
    stem=cfg['name']+'-'+aspect
    for suffix in ['.ass','.srt']:shutil.copy2(old/(stem+suffix),out/(stem+suffix))
    shutil.copytree(original.parent/'fonts',out/'fonts',dirs_exist_ok=True)
    accepted=old/(stem+'.mp4')
    inputs,graph,audio_map=make.video_graph(cfg,aspect,P,out,edited,total,wins,words,cfg['crop'],intro,end,accepted)
    graphfile=out/f'stage2-{aspect}.graph';graphtext=';\n'.join(graph)
    if existing:assert graphfile.read_text(encoding='utf-8')==graphtext,'Completed render used a different composition graph'
    else:graphfile.write_text(graphtext,encoding='utf-8')
    if preview:
        make.run(['ffmpeg','-nostdin','-y','-hide_banner','-loglevel','error','-threads','4','-filter_threads','1','-filter_complex_threads','1',
            *inputs,'-filter_complex_script',graphfile.name,'-map','[V]','-ss','6','-frames:v','1','-an',
            '-threads','2','preview.png'],cwd=out)
        return
    final=out/(stem+'.mp4')
    if not existing:
        make.run(['ffmpeg','-nostdin','-y','-hide_banner','-loglevel','error','-threads','6','-filter_threads','1','-filter_complex_threads','1',
            *inputs,'-filter_complex_script',graphfile.name,'-map','[V]','-map',audio_map,
            '-c:v','libx264','-preset','fast','-crf','19','-profile:v','high','-pix_fmt','yuv420p',
            '-c:a','copy','-threads','6','-movflags','+faststart',final.name],cwd=out)
    probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_packets','-select_streams','v:0',
        '-show_entries','stream=nb_read_packets','-of','json',str(final)],text=True))
    assert int(probe['streams'][0]['nb_read_packets'])==round(total*24)+228,'Finished composition frame count changed'
    before,after=audio_hash(accepted),audio_hash(final)
    assert before==after,'Decoded accepted sound changed during picture-only revision'
    receipt=json.loads((old/(stem+'.mp4.validation.json')).read_text(encoding='utf-8'))
    receipt['video_sha256']=quality.digest(final)
    receipt['visual_revision']={'source_video_sha256':quality.digest(accepted),'decoded_audio_sha256':after,
        'audio_identical':True,'speech_and_caption_clock_unchanged':True,'single_opening_scene':True,
        'logos':'Official foreground geometry with equal visible artwork height','portrait_source_band':[0,560,1080,920],
        'krish_phone_sync_review':'lip sync is fine'}
    if camera:
        stability=json.loads((edited.parent/'stabilisation.json').read_text(encoding='utf-8'))
        assert stability['output_sha256']==quality.digest(edited)
        assert stability['frame_count']==round(total*24)
        receipt['stabilisation']=stability
        receipt['prior_picture_acceptance']={'by':'Krish','said':'Yes, those fixes look right but the videos both need stabilization.',
            'scope':'Single opening, logo sizes and portrait framing; stabilisation requested afterwards'}
    receipt['checks']['sync']={'status':'not_run','reason':'Measure the new crop, despite identical accepted sound'}
    receipt['checks']['motion']={'status':'not_run','reason':'Bind before/after camera measurements and final motion/framing review to this export'}
    receipt['checks']['visuals']={'status':'not_run','reason':'Inspect all revised samples before replacing the board'}
    receipt['checks']['full_review']={'status':'not_run','reason':'Prior phone sync accepted; revised visual playback remains open'}
    receipt['checks']['heard']['derivation']={'method':'Identical decoded audio, not a new ASR run',
        'source_video_sha256':quality.digest(accepted),'decoded_audio_sha256':after}
    save(out/(stem+'.mp4.validation.json'),receipt)
    shape['intro']['file']=str(intro['file']);shape['intro']['sha256']=quality.digest(intro['file'])
    report['visual_revision']=receipt['visual_revision'];save(out/(cfg['name']+'.report.json'),report)
    print(json.dumps({'file':str(final),'sha256':receipt['video_sha256'],'audio_identical':True}),flush=True)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('work',type=Path);ap.add_argument('cut',choices=['long','short']);ap.add_argument('--prepare',action='store_true');ap.add_argument('--preview',action='store_true');a=ap.parse_args();w=a.work.resolve()
    prepare(w,a.cut) if a.prepare else render(w,a.cut,a.preview)

if __name__=='__main__':main()
