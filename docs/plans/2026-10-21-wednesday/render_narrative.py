"""Re-cut the recorded experiment as one evidence-led narrative.

Raw captures stay local. Only cropped, irreversibly redacted video panels enter
the compositor. Point events are editorial round calls, never success rates.
"""
import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

PLAN=Path(__file__).resolve().parent
ROOT=PLAN.parents[2]
sys.path.insert(0,str(ROOT/'scripts/quick-edit'))
import make
import episode
import quality
import segment_clock

PROOFS={
 'draft':('muse-draft-body.jpg',[436,378,572,180],[12,33,148,32],['A LOVELY REPLY.','TO A SCAMMER.'],'Original Muse interaction, 20 October'),
 'priority':('muse-day-plan.jpg',[436,282,572,152],[28,60,220,36],['FIRST ON','THE DAY\'S LIST.'],'Original Muse interaction, 20 October'),
 'flight':('muse-flight-final.jpg',[436,240,572,356],None,['£335.','29 HOURS IN LISBON.'],'Original Muse interaction, historical 20 October fare'),
 'nights':('muse-nights-claim.jpg',[436,270,572,112],None,['THREE NIGHTS.','MUSE SAID FOUR.'],'Original Muse interaction; count verified from arrival/departure'),
 'scams':('community-scams.jpg',[386,320,744,117],None,['ANOTHER TESTER.','BOTH CAUGHT THE SCAMS.'],'https://www.aiformortals.co/blog/grok-bot-vs-meta-muse-vs-chatgpt-dots'),
 'travel':('community-travel-results.jpg',[386,90,744,342],None,['ANOTHER TRIP: MONTREAL.','GROK FOUND IT CHEAPER.'],'https://www.aiformortals.co/blog/grok-bot-vs-meta-muse-vs-chatgpt-dots'),
 'news':('community-news.jpg',[63,342,742,89],None,['NEWS HE','KEPT USING.'],'https://christopheralarcon.com/blog/what-is-grok-bot'),
 'grok-user':('grok-community-team.webp',[490,70,1334,310],[95,105,210,95],['ANOTHER USER\'S','WEEK WITH GROK.'],'https://christopheralarcon.com/blog/what-is-grok-bot'),
}
DEMOS={
 'grok-launch':('grok-launch.mp4',[0,200,1920,600],27,['GROK BOT.','OFFICIAL LAUNCH DEMO.'],'https://x.ai/news/introducing-grok-bot'),
 'muse-launch':('muse-launch.mp4',[280,60,1360,860],39,['MUSE.','OFFICIAL LAUNCH DEMO.'],'https://about.fb.com/news/2026/09/introducing-muse-personal-ai-agent/'),
}

def save(p,d):p.write_text(json.dumps(d,indent=2,ensure_ascii=False,default=str)+'\n',encoding='utf-8')
def run(args,cwd=None):subprocess.run(['ffmpeg','-nostdin','-y','-v','error',*args],cwd=cwd,check=True)
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def panel(w,key,aspect,lines=None):
    out=w/'evidence-panels';out.mkdir(exist_ok=True)
    path=out/f'{key}-{aspect}.mp4'
    raw=None;crop=None;mask=None;start=None;source='Editorial interpretation of the recorded evidence'
    if key in PROOFS:
        file,crop,mask,lines,source=PROOFS[key];raw=w/'evidence-raw'/file
    elif key in DEMOS:
        file,crop,start,lines,source=DEMOS[key];raw=w/'evidence-raw'/file
    W,H=(1312,1080)if aspect=='16x9'else(1080,1000)
    recipe={'key':key,'aspect':aspect,'lines':lines,'crop':crop,'mask':mask,'start':start,'source':source,'raw_sha256':sha(raw)if raw else None,'version':3}
    stamp=path.with_suffix('.json')
    if path.exists()and stamp.exists()and json.loads(stamp.read_text())['recipe']==recipe:return path
    font=w/'render-short/fonts/Anton.ttf';fs=72 if aspect=='16x9'else 64
    # Text is supplied in files: punctuation, apostrophes and currency never
    # become filter syntax. No hidden account chrome is in the cropped stream.
    graph=[];filters=[]
    for i,line in enumerate(lines):
        textfile=out/f'{key}-{aspect}-{i}.txt';textfile.write_text(line,encoding='utf-8')
        filters.append(f"drawtext=fontfile='{font.as_posix().replace(':',r'\:')}':textfile='{textfile.as_posix().replace(':',r'\:')}':fontcolor=0xF6F3EB:fontsize={fs}:x=(w-text_w)/2:y={174+i*(fs+18)}")
    filters.append(f"drawbox=x=48:y={158+len(lines)*(fs+18)}:w={W-96}:h=5:color=0x79EDBE:t=fill")
    inputs=['-f','lavfi','-i',f'color=c=0x0C1512:s={W}x{H}:r=24:d=6']
    if raw:
        inputs+=(['-loop','1','-framerate','24']if start is None else['-ss',str(start),'-threads','2'])+['-i',str(raw)]
        x,y,cw,ch=crop;graph.append(f'[1:v]crop={cw}:{ch}:{x}:{y},setsar=1[crop]')
        tag='crop'
        if mask:
            mx,my,mw,mh=mask
            # Solid cover over sensitive glyphs, then a soft blur. The decoded
            # panel contains no recoverable private text even at full size.
            graph.append(f'[{tag}]drawbox=x={mx}:y={my}:w={mw}:h={mh}:color=0xBEBEBE:t=fill[redacted]');tag='redacted'
        targetw=W-96;targeth=round(ch*targetw/cw)
        if targeth>H-420:targeth=H-420;targetw=round(cw*targeth/ch)
        graph.append(f'[{tag}]fps=24,scale={targetw}:{targeth}:flags=lanczos,format=yuv420p[proof]')
        py=410 if len(lines)==2 else 370
        graph.append(f'[0:v][proof]overlay=x=(W-w)/2:y={py}[base]');tag='base'
        filters.append(f"drawbox=x={(W-targetw)//2-4}:y={py-4}:w={targetw+8}:h={targeth+8}:color=0xB6A2FF@0.8:t=4")
    else:tag='0:v'
    graph.append(f'[{tag}]'+','.join(filters)+'[v]')
    gf=out/f'{key}-{aspect}.graph';gf.write_text(';\n'.join(graph))
    run([*inputs,'-filter_complex_threads','1','-filter_complex_script',str(gf),'-map','[v]','-t','6','-an','-c:v','libx264','-preset','fast','-crf','17','-threads','3','-pix_fmt','yuv420p',str(path)])
    save(stamp,{'recipe':recipe,'output_sha256':sha(path),'privacy':'Only cropped pixels enter the panel; private account chrome excluded and named fields replaced before scaling.'})
    return path


def windows(w,cut,aspect,plan):
    prior=w/f'kit-{cut}-stable';cfg=json.loads((prior/f'{cut}.json').read_text());clock=json.loads((prior/'cue-clock.json').read_text())
    old,_=make.cue_windows(clock['words'],cfg['cues'],clock['speech_seconds'],strict=True)
    old=make.expand_pages(old,aspect,clock['words']);result=[]
    neutral={
       'five-jobs':['FIVE EVERYDAY JOBS.','ONE RUNNING VERDICT.'],
       'cancel-check':['BOTH STOPPED TO ASK.','WHAT WOULD BREAK?'],
       'scam-priority':['INBOX VERDICT.','GROK TAKES THE POINT.'],
       'cancel-result':['BOTH STOPPED TO ASK.','DRAW.'],
       'day-result':['CHECK THE CALENDAR.','DRAW.'],
       'news-result':['USEFUL. ACCURATE.','A DRAW.'],
       'my-score':['FIVE JOBS. GROK WINS TWO.','THREE DRAWS.'],
       'community-score':['FIVE JOBS. GROK WINS TWO.','THREE DRAWS.'],
       'flight-verdict':['ROUND TWO.','GROK TAKES THE POINT.'],
    }
    if cut=='short':
        neutral['my-score']=neutral['community-score']=['TWO JOBS.','GROK TAKES BOTH.']
    for g in plan['segments']:
        for c in old:
            a=max(c['s'],g['a']);b=min(c['e'],g['b'])
            if b-a<.08:continue
            entry={**c,'s':round(g['off']+a-g['a'],6),'e':round(g['off']+b-g['a'],6)}
            entry.pop('pages',None)
            key=c['id'].rsplit('-focus',1)[0]
            if key in neutral:entry['panel']=str(panel(w,key,aspect,neutral[key]))
            else:entry['panel']=str(prior/c['panel'].replace('{aspect}',aspect))
            result.append(entry)
    # Bind actual captures to the retained original word indices, not guessed
    # times. The short's countercase was moved before its point award.
    ranges=([(3,7,'grok-launch'),(8,12,'muse-launch'),(20,29,'draft'),(129,142,'draft'),(143,163,'priority'),(179,195,'scams'),(240,260,'flight'),(280,309,'nights'),(312,320,'travel'),(527,530,'grok-user'),(531,535,'news'),(875,892,'grok-launch'),(900,918,'muse-launch')]
            if cut=='long'else[(2,4,'grok-launch'),(6,9,'muse-launch'),(17,27,'draft'),(64,72,'draft'),(73,88,'priority'),(97,111,'scams'),(140,156,'flight'),(157,166,'nights'),(202,218,'grok-launch'),(221,240,'muse-launch')])
    new=json.loads((w/f'narrative/{cut}/cue-clock.json').read_text())['words']
    for lo,hi,key in ranges:
        hits=[x for x in new if lo<=x['src']<=hi]
        if not hits:continue
        a=max(0,hits[0]['s']-.08);b=min(plan['speech_seconds'],hits[-1]['e']+.12)
        leftover=[]
        for c in result:
            if c['e']<=a or c['s']>=b:leftover.append(c);continue
            if c['s']<a:leftover.append({**c,'e':a})
            if c['e']>b:leftover.append({**c,'s':b})
        # Keep deliberate visual cadence, with a stable screenshot throughout.
        n=max(1,round((b-a)/2.7))
        for i in range(n):leftover.append({'id':f'actual-{key}-{i}','panel':str(panel(w,key,aspect)),'s':a+(b-a)*i/n,'e':a+(b-a)*(i+1)/n})
        result=leftover
    result.sort(key=lambda x:x['s'])
    return cfg,result


def audio(w,cut,plan,out):
    aspect='16x9'if cut=='long'else'9x16';accepted=w/f'render-{cut}-stable/muse-vs-grok-{cut}-{aspect}.mp4'
    old=json.loads((w/f'kit-{cut}-stable/cue-clock.json').read_text())['speech_seconds'];body=w/f'narrative/{cut}/camera.mkv'
    samples=plan['frames']*2000;total=samples+456000
    graph=[f'[0:a]atrim=start_sample=0:end_sample=168000,asetpts=PTS-STARTPTS[i]',
        f'[1:a]aresample=48000,atrim=start_sample=2000,asetpts=PTS-STARTPTS,apad,atrim=end_sample={samples}[b]',
        f'[0:a]atrim=start_sample={168000+round(old*24)*2000}:end_sample={168000+round(old*24)*2000+288000},asetpts=PTS-STARTPTS[e]',
        '[i][b][e]concat=n=3:v=0:a=1[base]']
    labels=['[base]']
    for i,e in enumerate(plan['score_events']):
        delay=round((3.5+e['at_s'])*48000)
        graph.append(f"aevalsrc=0.035*sin(2*PI*1320*t)*exp(-12*t)+0.012*sin(2*PI*2640*t)*exp(-16*t):s=48000:d=0.42,pan=stereo|c0=c0|c1=c0,adelay={delay}S:all=1[d{i}]");labels.append(f'[d{i}]')
    graph.append(''.join(labels)+f'amix=inputs={len(labels)}:normalize=0,atrim=end_sample={total}[mix]')
    gf=out/'mix.graph';gf.write_text(';\n'.join(graph))
    dst=out/'mix.wav';run(['-i',str(accepted),'-i',str(body),'-filter_complex_script',str(gf),'-map','[mix]','-ar','48000','-c:a','pcm_s24le',str(dst)])
    return dst


def picture_track(out,wins,aspect,frames):
    """Flatten evidence cuts before the camera composite.

    A long sequence otherwise holds a decoder and framesync queue for every
    picture simultaneously. Whole-frame editorial cuts need only one decoder;
    the native compositor still owns speaker framing, bookends and captions.
    """
    W,H=(1312,1080)if aspect=='16x9'else(1080,1000)
    parts=out/'picture-parts';parts.mkdir(exist_ok=True)
    timeline=[];last=None
    for frame in range(frames):
        at=frame/24;active=[c for c in wins if c['s']<=at<c['e']]
        path=active[-1]['panel']if active else last or wins[0]['panel']
        if not timeline or path!=last:timeline.append({'start_frame':frame,'panel':path})
        last=path
    listing=[]
    for i,row in enumerate(timeline):
        n=(timeline[i+1]['start_frame']if i+1<len(timeline)else frames)-row['start_frame']
        p=Path(row['panel']);clip=parts/f'{i:03d}.mp4';stamp=clip.with_suffix('.json')
        recipe={'source_sha256':sha(p),'frames':n,'aspect':aspect,'version':1}
        if not(clip.exists()and stamp.exists()and json.loads(stamp.read_text())==recipe):
            moving=p.suffix.lower()in{'.mp4','.mkv','.mov','.webm'}
            inputs=(['-stream_loop','-1']if moving else['-loop','1','-framerate','24'])+['-threads','1','-i',str(p)]
            run([*inputs,'-vf',f'fps=24,scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color=0x0C1512,setsar=1',
                 '-frames:v',str(n),'-an','-c:v','libx264','-preset','ultrafast','-crf','16','-threads','2','-pix_fmt','yuv420p',str(clip)])
            save(stamp,recipe)
        listing.append(f"file '{clip.as_posix()}'")
        print('Evidence picture',i+1,'/',len(timeline),flush=True)
    index=parts/'list.txt';index.write_text('\n'.join(listing)+'\n')
    track=out/'evidence-track.mp4'
    run(['-f','concat','-safe','0','-i',str(index),'-c','copy','-movflags','+faststart',str(track)])
    count=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_packets','-select_streams','v:0','-show_entries','stream=nb_read_packets','-of','json',str(track)]))
    assert int(count['streams'][0]['nb_read_packets'])==frames
    save(out/'evidence-track.json',{'timeline':timeline,'frames':frames,'sha256':sha(track),'transitions':'Whole-frame editorial cuts; source screenshots remain stationary'})
    return [{'id':'integrated-evidence-track','panel':str(track),'s':0,'e':frames/24}]


def main():
    ap=argparse.ArgumentParser();ap.add_argument('work',type=Path);ap.add_argument('cut',choices=['long','short']);ap.add_argument('--prepare',action='store_true');ap.add_argument('--preview',action='store_true');a=ap.parse_args();w=a.work.resolve();cut=a.cut;aspect='16x9'if cut=='long'else'9x16';make.FPS=24
    out=w/f'render-{cut}-narrative';out.mkdir(exist_ok=True);plan=json.loads((w/f'narrative/{cut}/edit-plan.json').read_text());total=plan['speech_seconds']
    cfg,wins=windows(w,cut,aspect,plan);words=json.loads((w/f'narrative/{cut}/cue-clock.json').read_text())['words'];profile=w/f'kit-{cut}-stable'
    cfg['scoreboard']={'events':plan['score_events']};cfg['captions']=True
    P=lambda p:Path(p)if Path(p).is_absolute()else profile/p
    coverage=quality.coverage(wins,0,total);assert coverage['fraction']>=.9 and coverage['max_gap_s']<=1.5,coverage
    shutil.copytree(w/'render-short/fonts',out/'fonts',dirs_exist_ok=True)
    toks=make.tokens(words,make.DEFAULT_FIXES+cfg.get('replacements',[]))
    groups=make.chunks(toks,sorted({c['s']for c in wins}|{c['e']for c in wins}))
    stem=cfg['name']+'-'+aspect
    make.write_ass(out/(stem+'.ass'),groups,wins,aspect)
    (out/(stem+'.srt')).write_text(episode.srt(toks,offset=3.5),encoding='utf-8')
    intro={'file':P(cfg['intro'][aspect]),**make.clip_info(P(cfg['intro'][aspect]))};end={'file':P(cfg['endcard'][aspect]),**make.clip_info(P(cfg['endcard'][aspect]))}
    assert intro['frames']==84 and end['frames']==144
    mix=out/'mix.wav'
    mix_stamp=out/'mix-recipe.json';mix_recipe={'edit_plan_sha256':sha(w/f'narrative/{cut}/edit-plan.json'),'version':2}
    if not(mix.exists()and mix_stamp.exists()and json.loads(mix_stamp.read_text())==mix_recipe):
        mix=audio(w,cut,plan,out);save(mix_stamp,mix_recipe)
    graph_wins=picture_track(out,wins,aspect,plan['frames'])if cut=='long'and not a.prepare else wins
    inputs,graph,amap=make.video_graph(cfg,aspect,P,out,w/f'narrative/{cut}/camera.mkv',total,graph_wins,words,cfg['crop'],intro,end,mix)
    gf=out/f'stage2-{aspect}.graph';gf.write_text(';\n'.join(graph))
    save(out/'composition.json',{'config':cfg,'windows':wins,'coverage':coverage,'speech_seconds':total,'frames':plan['frames']+228,'score_events':plan['score_events']})
    if a.prepare:print(cut,'composition prepared',flush=True);return
    if a.preview:
        make.run(['ffmpeg','-nostdin','-y','-v','error','-filter_complex_threads','1',*inputs,'-filter_complex_script',gf.name,'-map','[V]','-ss','24','-frames:v','1','-an','-threads','2','preview.png'],cwd=out);return
    final=out/(stem+'.mp4')
    make.run(['ffmpeg','-nostdin','-y','-v','error','-filter_complex_threads','1',*inputs,'-filter_complex_script',gf.name,'-map','[V]','-map',amap,'-c:v','libx264','-preset','fast','-crf','19','-profile:v','high','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-threads','4','-progress','render-progress.txt','-stats_period','5','-movflags','+faststart',final.name],cwd=out)
    probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_packets','-show_streams','-of','json',str(final)]))
    video=next(s for s in probe['streams']if s['codec_type']=='video');sound=next(s for s in probe['streams']if s['codec_type']=='audio')
    assert int(video['nb_read_packets'])==plan['frames']+228,'Final picture length changed'
    assert abs(float(sound['duration'])-(plan['frames']+228)/24)<.025,'Final audio and video clocks differ'
    receipt={'video_sha256':sha(final),'checks':{k:{'status':'not_run','reason':'Fresh recut requires its own verification'}for k in ['sync','motion','visuals','heard','full_review','loudness']},
        'narrative_revision':{'authority':plan['authority'],'camera_provenance':json.loads((w/f'narrative/{cut}/camera-provenance.json').read_text()),'single_intro_frames':84,'outro_frames':144,'one_scoreboard':True,'audio':'Original recorded voice excerpts plus owned two-note score effects; no new narration','mix_sha256':sha(mix)}}
    save(Path(str(final)+'.validation.json'),receipt)
    save(out/(cfg['name']+'.report.json'),{'name':cfg['name'],'fps':24,'shapes':{aspect:{'main_seconds':total,'intro':{**intro,'file':str(intro['file'])},'end':{**end,'file':str(end['file'])}}},'coverage':coverage})
    print(cut,'render complete',sha(final),flush=True)

if __name__=='__main__':main()
