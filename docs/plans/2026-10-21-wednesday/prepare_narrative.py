"""One round-by-round narrative, made only from the recorded words."""
import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'scripts/quick-edit'))
import make
import segment_clock

LONG_REMOVE=[(71,82),(206,208),(212,223),(322,323),(328,337),(459,460),(468,480),(553,566),(800,803),(820,835),(1020,1043)]
SHORT_ORDER=[(0,89),(97,100),(105,111),(119,126),(90,96),(127,174),(192,274)]


def save(p,d):p.write_text(json.dumps(d,indent=2,ensure_ascii=False),encoding='utf-8')


def main():
    ap=argparse.ArgumentParser();ap.add_argument('work',type=Path);ap.add_argument('cut',choices=['long','short']);ap.add_argument('--plan-only',action='store_true');a=ap.parse_args();w=a.work.resolve();cut=a.cut
    out=w/'narrative'/cut;out.mkdir(parents=True,exist_ok=True);make.FPS=24
    old=json.loads((w/f'kit-{cut}-stable/cue-clock.json').read_text(encoding='utf-8'));words=old['words'];duration=old['speech_seconds']
    if cut=='long':segs,total=make.segments(words,LONG_REMOVE,10000,.06,.08,duration,protect_removals=True)
    else:
        segs=[];off=0
        for left,right in SHORT_ORDER:
            remove=[(0,left-1)]if left else []
            if right<len(words)-1:remove.append((right+1,len(words)-1))
            parts,_=make.segments(words,remove,10000,.06,.08,duration,protect_removals=True)
            for part in parts:
                part['off']=round(off,6);off+=part['b']-part['a'];segs.append(part)
        total=off
    # Every segment keeps an integer number of video frames and PCM samples.
    for g in segs:assert abs((g['b']-g['a'])*24-round((g['b']-g['a'])*24))<.0001
    spoken=make.retime(words,segs);frames=sum(round((g['b']-g['a'])*24)for g in segs);total=frames/24
    anchors={x['src']:x for x in spoken};score_indices=[211,327]if cut=='long'else[96,174]
    events=[{'at_s':round(anchors[i]['e']+.08,3),'grok':n,'muse':0,'round':n}for n,i in enumerate(score_indices,1)]
    save(out/'cue-clock.json',{'fps':24,'speech_seconds':total,'words':spoken})
    plan={'cut':cut,'authority':'Krish: NO, just have all the evidence roll in to one narrative',
        'method':'Retain the agreed round verdicts; remove separate personal/community score calls. Evidence stays interwoven, with source scope retained in the accompanying article.',
        'remove_word_ranges':LONG_REMOVE if cut=='long'else None,'ordered_word_ranges':SHORT_ORDER if cut=='short'else None,
        'segments':segs,'frames':frames,'speech_seconds':total,'score_events':events,
        'removed_words':' '.join(x['w']for i,x in enumerate(words)if i not in anchors)}
    save(out/'edit-plan.json',plan)
    (out/'spoken-transcript.md').write_text(' '.join(x['w']for x in spoken)+'\n',encoding='utf-8')
    print(json.dumps({'cut':cut,'frames':frames,'seconds':total,'score_events':events,'removed_words':plan['removed_words']}),flush=True)
    if a.plan_only:return
    aspect='16x9'if cut=='long'else'9x16';accepted=w/f'render-{cut}-stable'/f'muse-vs-grok-{cut}-{aspect}.mp4'
    camera=w/'stability-long/full/camera-stable.mkv'if cut=='long'else w/'supplied-short/camera.mkv'
    base=out/'camera-audio-source.mkv'
    recipe={'camera_sha256':segment_clock.digest(camera),'audio_source_sha256':segment_clock.digest(accepted),'speech_frames':round(duration*24)}
    stamp=out/'source.json'
    if not(base.is_file()and stamp.is_file()and json.loads(stamp.read_text())==recipe):
        subprocess.run(['ffmpeg','-nostdin','-y','-v','error','-threads','2','-i',str(camera),'-ss','3.5','-threads','2','-i',str(accepted),
            '-map','0:v:0','-map','1:a:0','-t',f'{round(duration*24)/24:.8f}','-c:v','copy','-c:a','pcm_s16le',str(base)],check=True);save(stamp,recipe)
    parts=out/'parts';parts.mkdir(exist_ok=True);listing=[];base_sha=segment_clock.digest(base)
    for i,g in enumerate(segs):
        p=parts/f'{i:03d}.mkv';n=round((g['b']-g['a'])*24);r={'source_sha256':base_sha,'start':g['a'],'frames':n,'fps':24,'source_end':g.get('source_end')}
        if not segment_clock.reusable(p,r):
            args=segment_clock.encode_args(base,p,g['a'],n,24,'setpts=N/(24*TB),tpad=stop_mode=clone:stop_duration=0.0833',source_end=g.get('source_end'))
            args[args.index('-i'):args.index('-i')]=['-threads','2'];args[-1:-1]=['-threads','4','-filter_complex_threads','1']
            subprocess.run(args,check=True);segment_clock.save_stamp(p,r)
        listing.append(f"file '{p.as_posix()}'");print(f'{cut}: narrative segment {i+1}/{len(segs)}',flush=True)
    index=parts/'list.txt';index.write_text('\n'.join(listing)+'\n')
    final=out/'camera.mkv';subprocess.run(['ffmpeg','-nostdin','-y','-v','error','-f','concat','-safe','0','-i',str(index),'-c','copy',str(final)],check=True);segment_clock.require(final,frames,24)
    save(out/'camera-provenance.json',{'output_sha256':segment_clock.digest(final),'frames':frames,'source':recipe,'edit_plan_sha256':hashlib.sha256((out/'edit-plan.json').read_bytes()).hexdigest()})
    print(f'{cut}: recut camera and original voice excerpts ready',flush=True)


if __name__=='__main__':main()
