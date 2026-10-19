"""Rebuild Friday's approved treatment from fresh words and original assets.

This makes local review inputs, never files or records a replacement.
Run from the repository root after the engine asset retrieval.
"""
import base64
import html
import json
import shutil
import sys
from pathlib import Path

import make
import quality
import kit

ROOT=Path(__file__).resolve().parents[2]
W=ROOT/'.cache/produce/2026-10-16-904658db'
PLAN=ROOT/'docs/plans/2026-10-09-friday'
DEST=W/'repair-kit'


def uri(path):
    mime='image/svg+xml' if path.suffix=='.svg' else 'image/jpeg'
    return 'data:'+mime+';base64,'+base64.b64encode(path.read_bytes()).decode()


def card(name,head,detail='',photo=None,logo=None,shape='9x16',label=''):
    width,height=(1080,1000) if shape=='9x16' else (1314,1080)
    style=kit.style_for('mind_the_gap')
    ink,cream,accent=style['ink'],style['cream'],style['accent']
    # Short headlines, ample type and explicit context carry the spoken idea.
    lines=head.split('|');size=98 if shape=='9x16' else 130
    body=[f'<rect width="{width}" height="{height}" fill="{ink}"/>',
          f'<rect width="{width}" height="12" fill="{accent}"/>',
          f'<text x="64" y="94" font-family="IBM Plex Mono" font-size="40" fill="{accent}">mind.the.gap</text>']
    for i,line in enumerate(lines):
        body.append(f'<text x="64" y="{218+i*(size+12)}" font-family="Anton" font-size="{size}" fill="{cream}">{html.escape(line.upper())}</text>')
    top=240+(len(lines)-1)*(size+12)
    if photo:
        p=W/'repair-assets/photos'/f'{photo}.jpg'
        body.append(f'<image x="64" y="{top}" width="{width-128}" height="{height-top-140}" preserveAspectRatio="xMidYMid meet" href="{uri(p)}"/>')
    elif logo:
        p=PLAN/'logos'/f'{logo}-cream.svg'
        body.append(f'<image x="{width/2-120}" y="{top}" width="240" height="240" href="{uri(p)}"/>')
    if detail:
        body.append(f'<text x="64" y="{height-144}" font-family="Anton" font-size="{82 if shape=="9x16" else 124}" fill="{accent}">{html.escape(detail)}</text>')
    if label:
        if label=='Krish’s confidence in his forecast':label='Krish’s forecast'
        annotation=32 if len(label)>24 or 'Photo:' in label or 'photo:' in label or 'CC BY' in label else 64
        body.append(f'<text x="64" y="{height-52}" font-family="IBM Plex Mono" font-size="{annotation}" fill="{cream}">{html.escape(label)}</text>')
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">'+''.join(body)+'</svg>'
    path=DEST/'panels'/f'{name}-{shape}.svg';path.write_text(svg,encoding='utf8')
    return {'file':path.name,'headline':head.replace('|',' '),'headline_words':len(head.replace('|',' ').split()),
            'essential_font_px':size,'detail_font_px':82 if shape=='9x16' else 124,'shape':shape,
            'point':head.replace('|',' '),'photo':photo,'logo':logo}


def anchor(words,index,end=False):
    # Select a unique exact spoken phrase, preserving actual source spelling.
    for count in range(3,14):
        a=max(0,index-count+1) if end else index
        b=index+1 if end else min(len(words),index+count)
        phrase=' '.join(x['w'].strip() for x in words[a:b])
        try:
            hit=quality.unique_anchor(words,phrase,make.norm)
            if hit[1 if end else 0]==index:return phrase
        except ValueError:pass
    raise ValueError(f'Cannot anchor source word {index}')


def main():
    DEST.mkdir(exist_ok=True);(DEST/'panels').mkdir(exist_ok=True)
    old=PLAN/'short-cut/short.json';cfg=json.loads(old.read_text())
    words=json.loads((W/'words-fresh/short.words.json').read_text())['words']
    rows=[
      (0,'TOO MANY|AI MODELS','',None,'claude',''),
      (10,'ANOTHER|MODEL LAUNCH','',None,'openai-symbol',''),
      (21,'A NEW NAME.|EVERY DAY?','',None,None,'Krish’s experience'),
      (37,'DOES THE NAME|EVEN MATTER?','',None,None,''),
      (47,'HOW HARD|DOES IT THINK?','',None,'claude',''),
      (57,'THINK OF|A CAR','', 'c-class',None,'Car analogy'),
      (64,'MAP1','',None,None,''),
      (73,'MAP2','',None,None,''),
      (81,'THINKING|IS THE GEAR','', 'manual',None,'Photo: Nenad Stojkovic · CC BY 2.0'),
      (89,'YOU PICK|THE GEAR','', 'manual',None,'Car analogy'),
      (94,'TODAY:|MANUAL','', 'manual',None,'Car analogy'),
      (103,'MEET SALLY','A business owner',None,None,'Illustrative example'),
      (112,'CHECK THIS|SUPPLIER DEAL','',None,None,'Sally’s example'),
      (121,'SOUNDS SURE','',None,'claude','Sally’s example'),
      (125,'MISSES A|COSTLY RULE','',None,None,'Sally’s example'),
      (133,'TOO LITTLE|THINKING','',None,None,'Sally’s example'),
      (142,'SAME GEAR.|HIDDEN RISK.','', 'manual',None,'Sally’s example'),
      (148,'PUT THINKING|TO THE TEST','Artificial Analysis',None,None,'Intelligence Index'),
      (154,'NEWER MODEL.|LOW EFFORT.','Opus 5.5 · low',None,None,'Artificial Analysis · comparison'),
      (164,'OLDER MODEL.|HIGHER SCORE.','Opus 5 · max',None,None,'Artificial Analysis · comparison'),
      (173,'WHY START|IN LOW GEAR?','', 'manual',None,'Car analogy'),
      (183,'MY GUESS','',None,None,'Krish’s interpretation'),
      (189,'THINKING|COSTS MONEY','',None,'openai-symbol','Provider cost'),
      (194,'YOU PAY|THE SAME PLAN','',None,None,'Monthly subscription'),
      (200,'WHAT|COMES NEXT?','',None,None,'Krish’s forecast'),
      (210,'MID-2027:|AUTOMATIC?','', 'automatic',None,'Forecast · photo: Ralf Pfeifer · CC BY-SA 3.0'),
      (222,'AI PICKS|ITS OWN GEAR','', 'automatic',None,'Krish’s forecast'),
      (230,'EASY BEATS|MANUAL','', 'automatic',None,'Krish’s view'),
      (240,'85% SURE','',None,None,'Krish’s confidence in his forecast'),
      (246,'READ THE|FULL ARTICLE','makeyourmindup.ai',None,None,'Sources included'),
      (261,'WOULD YOU|PICK THE GEAR?','', 'manual',None,'Your choice'),
      (276,'OR LET|AI CHOOSE?','', 'automatic',None,'Your choice'),
    ]
    manifest=[];cues=[]
    for i,(start,head,detail,photo,logo,label) in enumerate(rows):
        name=f'repair-short-{i+1:02}'
        if head in ('MAP1','MAP2'):
            svg=kit.mapping_card_svg(uri(PLAN/'logos/mercedes-cream.svg'),uri(PLAN/'logos/claude-cream.svg'),int(head[-1]))
            (DEST/'panels'/f'{name}-9x16.svg').write_text(svg,encoding='utf8')
            manifest.append({'file':f'{name}-9x16.svg','point':'Mercedes = Claude' if head=='MAP1' else 'C-Class = Opus 5.5','shape':'9x16','essential_font_px':78})
        else:manifest.append(card(name,head,detail,photo,logo,label=label))
        end=(rows[i+1][0]-1) if i+1<len(rows) else len(words)-1
        cues.append({'id':name,'panel':f'panels/{name}-9x16.png','start':anchor(words,start),
                     'end':anchor(words,end,True),'lead':.18,'tail':.25,'source_words':[start,end]})
    cfg.update(name='why-so-many-ais-short-repair-19oct',source='../'+str(Path(cfg['source']).relative_to('..')).replace('\\','/'),
               words='../words-fresh/short.words.json',script=str(ROOT/'docs/plans/2026-10-09-script-90s-v7.md'),
               pad_before=.18,pad_after=.25,cues=cues,music='no-curves-instrumental',music_mode='episode_bed',
               episode_bed_levels={'bed_lufs':-31,'chapter_lufs':-22},quality_required=True,
               intro={'9x16':'../working/3 Video/working 17 Oct/story clips/intro-9x16.mp4'},
               endcard={'9x16':'../working/3 Video/working 17 Oct/story clips/outro-9x16.mp4'})
    cfg['strap']['png']='../working/3 Video/working 17 Oct/kit/strap-9x16.png'
    cfg['replacements']=[['got to be in my bonnet','got a bee in my bonnet'],['The how it thinks','How it thinks'],['Maybe 5%','I’m 85%'],['C -Class','C-Class']]
    (DEST/'short.json').write_text(json.dumps(cfg,indent=2),encoding='utf8')
    (DEST/'visual-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
    out=W/'repair-short';out.mkdir(exist_ok=True)
    for source in (W/'short-processing').glob('*.mkv'):
        dest=out/source.name
        if not dest.exists():shutil.copy2(source,dest)
    print(f'Built {len(cues)} short steps in {DEST}')
    build_long()


def build_long():
    cfg=json.loads((PLAN/'long-cut/long.json').read_text())
    raw=json.loads((W/'words-fresh/long.words.json').read_text())['words']
    removed=make.resolve_removals(raw,cfg['remove'])
    spans,total=make.segments(raw,removed,.9,.18,.25,858,True)
    problems=quality.cut_problems(raw,spans,removed)
    if problems:raise ValueError(problems)
    words=make.retime(raw,spans)
    # Retain the existing non-car panels and approved titles. Bind every old
    # visual cue afresh; no old timestamp survives this conversion.
    cues=[];review=[]
    for old in cfg['cues']:
        a=make.find(words,old['start']) or make.find_loose(words,old['start'])
        b=(make.find(words,old['end'],after=words[a[0]]['s']) or make.find_loose(words,old['end'],after=words[a[0]]['s'])) if a else None
        if not a or not b:raise ValueError('Unresolved long cue '+old['id'])
        # A chapter is a readable transition, not a two-word flash.
        end=max(a[0]+2,b[1])
        cue={**old,'start':anchor(words,a[0]),'end':anchor(words,end,True),
             'panel':'../working/3 Video/working 18 Oct/long cards/'+Path(old['panel'].replace('{aspect}','16x9')).name,
             'chapter':old['id'].startswith('fri-chapter-')}
        if cue['chapter']:
            cue['tail']=max(.35,3-(words[end]['e']-words[a[0]]['s']))
        if not (DEST/cue['panel']).exists():
            candidates=list((W/'working/3 Video/working 17 Oct/video panels').glob(Path(cue['panel']).name))
            if len(candidates)!=1:raise FileNotFoundError(cue['panel'])
            cue['panel']='../'+candidates[0].relative_to(W).as_posix()
        cues.append(cue)
        review.append({'id':old['id'],'old_start':old['start'],'fresh_start':cue['start'],
                       'fresh_end':cue['end'],'retained_existing_visual':True})
    # Every extended car-analogy passage receives a relevant real photograph.
    # Source-word ranges are validated before conversion to exact phrase cues.
    passages=[
      (693,701,'THINK OF|A CAR','c-class'),
      (702,719,'THE MAKE','mapping1'),
      (720,727,'THE MODEL','mapping2'),
      (728,746,'THINKING|IS THE GEAR','manual'),
      (747,759,'YOU CHANGE|THE GEAR','manual'),
      (760,777,'LOW TO HIGH|THINKING','manual'),
      (778,797,'LOOK BEYOND|THE BADGE','c-class'),
      (798,831,'WHICH GEAR|ARE YOU USING?','manual'),
      (1187,1208,'YOU CHOOSE|THE GEAR','manual'),
      (1209,1236,'AI CHOOSES|FOR YOU','automatic'),
      (1424,1455,'THE BADGE|GETS ATTENTION','c-class'),
      (1456,1498,'THE GEAR|CHANGES THINKING','manual'),
      (1499,1532,'WHO CHOOSES|THE GEAR?','manual'),
      (1536,1555,'WHEN EASY|WINS','automatic'),
      (1789,1816,'WHO DOES|AUTO SERVE?','automatic'),
      (1861,1900,'MATCH THE GEAR|TO THE JOB','manual'),
      (1901,1930,'FOR BIG CHOICES:|TURN IT UP','manual'),
      (1985,2038,'THE DRIVER|STILL CHOOSES','f1'),
      (2039,2076,'KEEP THE|OVERRIDE','f1'),
      (2077,2105,'SHOW THE GEAR|IT PICKED','manual'),
      (2106,2141,'FROM MANUAL|TO AUTOMATIC','automatic'),
      (2142,2173,'KEEP CONTROL|WHEN IT MATTERS','f1'),
      (2174,2189,'I STILL|CHOOSE MANUAL','manual'),
      (2197,2243,'AUTOMATIC|BY MID-2027?','automatic'),
      (2244,2268,'PAID PLANS|GO AUTO TOO?','automatic'),
      (2269,2292,'PAID USERS|KEEP CONTROL?','f1'),
    ]
    added=[]
    for i,(a,b,headline,photo) in enumerate(passages):
        kept=[i for i,w in enumerate(words) if a<=w['src']<=b]
        if not kept:raise ValueError(f'No retained words in passage {a}:{b}')
        start_phrase=anchor(words,kept[0]);end_phrase=anchor(words,kept[-1],True)
        # Anchors cannot use a word deleted by an approved cut.
        try:
            sa=quality.unique_anchor(words,start_phrase,make.norm)
            en=quality.unique_anchor(words,end_phrase,make.norm,after=words[sa[0]]['s'])
        except ValueError:
            kept=[w for w in words if raw[a]['s']<=w.get('source_s',-1)<=raw[b]['e']]
            raise ValueError(f'Revise removed-word anchor in car passage {a}:{b}')
        name=f'repair-long-car-{i+1:02}'
        if photo.startswith('mapping'):
            svg=kit.mapping_card_svg(uri(PLAN/'logos/mercedes-cream.svg'),uri(PLAN/'logos/claude-cream.svg'),int(photo[-1]),'16x9')
            (DEST/'panels'/f'{name}-16x9.svg').write_text(svg,encoding='utf8')
        else:
            label='Krish’s forecast' if a>=2197 else 'Car analogy'
            if photo=='f1':label+=' · McLaren MP4-23 · Hullian111 / CC BY-SA 4.0'
            card(name,headline,photo=photo,shape='16x9',label=label)
        cues.append({'id':name,'start':start_phrase,'end':end_phrase,'panel':f'panels/{name}-16x9.png','lead':.18,'tail':.3})
        added.append({'id':name,'source_words':[a,b],'point':headline.replace('|',' '),'real_visual':photo})
    cfg.update(name='why-so-many-ais-deep-repair-19oct',source='../takes/Fri 16 Oct - 3-minute - Soon you won\'t pick your AI.mp4',
               words='../words-fresh/long.words.json',script=str(ROOT/'docs/plans/2026-10-09-script-deep-v6.md'),
               pad_before=.18,pad_after=.25,
               intro={'16x9':'../working/3 Video/working 17 Oct/story clips/intro-16x9.mp4'},
               endcard={'16x9':'../working/3 Video/working 17 Oct/story clips/outro-16x9.mp4'},
               intro_override='Krish, 2026-10-19: Retain approved titles, thumbnails and story intro/outro.',
               frame16='../working/3 Video/working 17 Oct/kit/frame-16x9.png',cues=cues,
               music='no-curves-instrumental',music_mode='episode_bed',episode_bed_levels={'bed_lufs':-31,'chapter_lufs':-22},quality_required=True)
    cfg['replacements'].append(['C -Class','C-Class'])
    (DEST/'long.json').write_text(json.dumps(cfg,indent=2),encoding='utf8')
    (DEST/'long-cue-reconciliation.json').write_text(json.dumps({'existing':review,'real_car_visuals':added,'cuts':removed},indent=2),encoding='utf8')
    print(f'Bound {len(cues)} long cues to fresh speech')


if __name__=='__main__':main()
