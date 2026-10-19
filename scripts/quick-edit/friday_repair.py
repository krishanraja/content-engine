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
    mime={'.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'}[path.suffix]
    return 'data:'+mime+';base64,'+base64.b64encode(path.read_bytes()).decode()


def control_card(name, kind, shape='9x16'):
    """Show unchanged screenshot pixels through enlarged SVG viewports."""
    width,height=(1080,1000) if shape=='9x16' else (1314,1080)
    st=kit.style_for('mind_the_gap')
    files={'models':('claude-models-original.png','c6cec3058d4c3e9235931f53d30e9122549b839fcada58eebaffc5e0099b5ebc'),
           'effort':('claude-effort-original.png','6dd5abe207406c27e3709271a7e11f42f983593ae621a5043caadba838f60867')}
    file,sha=files[kind];source=W/'repair-assets/controls'/file
    if quality.digest(source)!=sha:raise ValueError('Control screenshot differs from the supplied original')
    image_uri=uri(source)
    iw,ih=(992,658) if kind=='models' else (1244,604)
    head='CHOOSE THE MODEL' if kind=='models' else 'CHOOSE THE EFFORT'
    headline_y=365 if kind=='models' and shape=='9x16' else 240
    body=[f'<rect width="{width}" height="{height}" fill="{st["ink"]}"/>',
          f'<rect width="{width}" height="12" fill="{st["accent"]}"/>',
          f'<text x="64" y="{headline_y}" font-family="Anton" font-size="{100 if shape=="9x16" else 125}" fill="{st["cream"]}">{head}</text>']
    def viewport(x,y,w,h,crop):
        cx,cy,cw,ch=map(float,crop.split())
        scale=min(w/cw,h/ch)
        left=x+(w-cw*scale)/2;top=y+(h-ch*scale)/2
        clip=f'clip-{x}-{y}'
        return (f'<defs><clipPath id="{clip}" clipPathUnits="userSpaceOnUse"><rect x="{left}" y="{top}" width="{cw*scale}" height="{ch*scale}"/></clipPath></defs>'
                f'<g clip-path="url(#{clip})"><image x="{left-cx*scale}" y="{top-cy*scale}" width="{iw*scale}" height="{ih*scale}" href="{image_uri}"/></g>')
    col=(width-192)/2
    # Preserve the full menu for context; magnified original-pixel details at
    # right carry the essential text. No control label is retyped or generated.
    body.append(viewport(64,320,col,600,f'0 0 {iw} {ih}'))
    if kind=='models':
        body.append(viewport(128+col,430,col,230,'48 188 170 45'))
        body.append(viewport(128+col,710,col,140,'561 188 50 45'))
    else:
        step=150 if shape=='16x9' else 120
        for i,crop in enumerate(('620 200 125 28','620 263 125 29','620 327 105 36','620 392 105 28','620 456 80 28')):
            body.append(viewport(128+col,280+i*step,col,step,crop))
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}">'+''.join(body)+'</svg>'
    path=DEST/'panels'/f'{name}-{shape}.svg';path.write_text(svg,encoding='utf8')
    return {'file':path.name,'point':head,'shape':shape,'original_sha256':sha,
            'treatment':'Unchanged original pixels, enlarged through SVG viewports; verify final glyph height'}


def card(name,head,detail='',photo=None,logo=None,shape='9x16',label=''):
    width,height=(1080,1000) if shape=='9x16' else (1314,1080)
    style=kit.style_for('mind_the_gap')
    ink,cream,accent=style['ink'],style['cream'],style['accent']
    # Short headlines, ample type and explicit context carry the spoken idea.
    lines=head.split('|');size=98 if shape=='9x16' else 130
    body=[f'<rect width="{width}" height="{height}" fill="{ink}"/>',
          f'<rect width="{width}" height="12" fill="{accent}"/>']
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
    # Krish, 19 October: no eyebrows or source-credit overlays in either cut.
    # Preserve attribution and editorial context in the manifest, off screen.
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">'+''.join(body)+'</svg>'
    path=DEST/'panels'/f'{name}-{shape}.svg';path.write_text(svg,encoding='utf8')
    return {'file':path.name,'headline':head.replace('|',' '),'headline_words':len(head.replace('|',' ').split()),
            'essential_font_px':size,'detail_font_px':82 if shape=='9x16' else 124,'shape':shape,
            'point':head.replace('|',' '),'photo':photo,'logo':logo,'off_screen_context':label}


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


def readable_long_card(spec):
    """Reflow the existing approved headline; source captures remain references.

    Essential headlines and comparison labels are measured for a 1080-wide
    playback of the 1920-wide cut. Source credits stay in accompanying records.
    """
    from PIL import Image, ImageFont
    width,height=1314,1080
    st=kit.style_for('mind_the_gap')
    font_path=ROOT/'scripts/quick-edit/fonts/Anton.ttf'
    title=spec['title']
    # Keep each displayed headline to one readable idea. The approved video
    # title and spoken wording remain in their original source assets.
    titles={
        'Why are Claude and ChatGPT launches speeding up?':'Why are AI launches speeding up?',
        'GPT went up a whole number in just 46 weeks':'GPT gained a number in 46 weeks',
        'A million new ChatGPT users in one hour':'One million ChatGPT users in one hour',
        'The $40 billion was months in the making':'$40 billion took months to arrange',
        'Same Claude Opus 5.5, tested in every gear':'Same Opus 5.5. Different thinking effort.',
        'In top gear, Opus 5.5 did far better':'Opus 5.5 scored higher at maximum effort',
        'Middle-gear Opus 5.5 matched Opus 5, for far less':'Same score. Lower cost at medium effort.',
        'Top gear costs about 11 times the lowest':'Maximum effort: roughly 11 times the cost',
        "Opus 5.5's score? Only about a third higher.":'Opus 5.5: up 16 index points',
        'Even at $200 a month, OpenAI was losing money':'OpenAI lost money on $200 Pro plans',
        'Who decides how hard ChatGPT and Claude think?':'Who decides how hard your AI thinks?',
        'Plus and Pro lost automatic too. No reason given.':'Plus and Pro also lost automatic thinking',
        'Under 1 free user in 100 used thinking daily':'Under 1% used thinking daily before GPT-5',
        'Once the AI chose, 7 free users in 100 did':'7% used thinking daily after GPT-5',
        'Most stayed put, though it felt less smart':'Most stayed. It felt less smart.',
        'Weeks to fix. Your screen never showed it.':'Weeks to fix. Invisible on your screen.',
        'For anything you act on, pick Medium or High':'Acting on it? Choose Medium or High',
    }
    title=titles.get(title,title)
    if len(title.split())>7:raise ValueError('Headline exceeds seven words: '+title)
    def wrap(text,size,max_width=1186):
        font=ImageFont.truetype(str(font_path),size)
        lines=[];line=''
        for word in text.upper().split():
            candidate=(line+' '+word).strip()
            if font.getlength(candidate)>max_width:
                if not line:raise ValueError('Word too wide: '+word)
                lines.append(line);line=word
            else:line=candidate
        if line:lines.append(line)
        return lines
    lines=wrap(title,124)
    if len(lines)>3:raise ValueError('Headline needs a new step: '+title)
    body=[f'<rect width="{width}" height="{height}" fill="{st["ink"]}"/>',
          f'<rect width="{width}" height="12" fill="{st["accent"]}"/>']
    for i,logo in enumerate(spec.get('logos',[])):
        logo=logo.replace('anthropic-symbol-cream.svg','claude-cream.svg')
        source=PLAN/'logos'/logo
        if not source.exists():raise FileNotFoundError(source)
        body.append(f'<image x="{width-144-i*130}" y="35" width="90" height="90" href="{uri(source)}"/>')
    essential=[]
    def text(value,x,y,size=124,colour=None,anchor='start'):
        font=ImageFont.truetype(str(font_path),size)
        if font.getlength(value)>1186:raise ValueError('Essential line overflows: '+value)
        box=font.getbbox(value)
        rendered=(box[3]-box[1])*1080/1920
        if rendered<48:raise ValueError(f'Essential glyphs too small: {value}: {rendered}')
        essential.append({'text':value,'font_size':size,'glyph_height_at_1080_wide':round(rendered,2)})
        body.append(f'<text x="{x}" y="{y}" text-anchor="{anchor}" font-family="Anton" font-size="{size}" fill="{colour or st["cream"]}">{html.escape(value)}</text>')
    # Same approved heading, made readable at the final scaled output.
    for i,line in enumerate(lines):text(line,64,240+i*140)
    y=240+(len(lines)-1)*140
    kind=spec['kind']
    if kind=='timeline':
        events=[e for e in spec['events'] if e.get('hi')]
        if not events:events=[spec['events'][0],spec['events'][-1]]
        for i,event in enumerate(events[:2]):
            text(event['name'].upper(),64,740+i*185)
            text(event['date'],1250,740+i*185,124,st['accent'],'end')
    elif kind=='bars':
        rows=[r for r in spec['rows'] if not r.get('hidden') and not r.get('dim')]
        if len(rows)>2:rows=[rows[0],next((r for r in rows if r.get('hi')),rows[-1])]
        text('AA INTELLIGENCE INDEX',64,max(y+145,620),112,st['accent'])
        for i,row in enumerate(rows[:2]):
            label=row['name'].replace('Â·','/').replace('·','/').upper()
            text(label,64,800+i*170)
            text(row.get('label',str(row['score'])),1250,800+i*170,150,st['accent'],'end')
    elif kind=='panels':
        score=spec['cue']=='fri-deep-cost-vs-score-score'
        text('AA INDEX' if score else 'US DOLLARS PER TASK',64,max(y+145,620),112,st['accent'])
        for i,(label,value) in enumerate((('LOW','42' if score else '$0.55'),('MAX','58' if score else '$5.98'))):
            text(label,64,800+i*170)
            text(value,1250,800+i*170,150,st['accent'],'end')
    elif kind=='dots':
        for i,col in enumerate(spec['columns']):
            text('BEFORE' if i==0 else 'AFTER GPT-5',64,760+i*185)
            text('<1%' if i==0 else '7%',1250,760+i*185,150,st['accent'],'end')
    elif kind=='statement':
        if 'meter' in spec:text('85% CONFIDENT',64,850,150,st['accent'])
        elif not spec.get('chapter'):
            for line in spec.get('lines',[]):
                if line['text']!=spec['title']:
                    for i,value in enumerate(wrap(line['text'],124)):
                        text(value,64,750+i*140,124,st['accent'])
    elif kind=='shot':
        captures=[]
        def collect(item):
            if isinstance(item,dict):
                if item.get('image'):captures.append(item)
                for key in ('parts','stacks'):collect(item.get(key,[]))
            elif isinstance(item,list):
                for child in item:collect(child)
        collect(spec)
        for i,capture in enumerate(captures[:2]):
            source=PLAN/'video-pictures'/capture['image']
            if not source.exists():
                matches=list((W/'working').rglob(Path(capture['image']).name))
                if not matches:raise FileNotFoundError(capture['image'])
                if len({quality.digest(p) for p in matches})!=1:raise ValueError('Conflicting source captures')
                source=matches[0]
            iw,ih=Image.open(source).size
            cx,cy,cw,ch=capture.get('crop',[0,0,iw,ih])
            count=min(len(captures),2);cell=(1186-(count-1)*30)/count
            top=y+75;hh=1000-top
            clip=f'reference-{i}'
            scale=min(cell/cw,hh/ch)
            left=64+i*(cell+30)+(cell-cw*scale)/2;top+=(hh-ch*scale)/2
            body.append(f'<defs><clipPath id="{clip}" clipPathUnits="userSpaceOnUse"><rect x="{left}" y="{top}" width="{cw*scale}" height="{ch*scale}"/></clipPath></defs>'
                f'<g clip-path="url(#{clip})"><image x="{left-cx*scale}" y="{top-cy*scale}" width="{iw*scale}" height="{ih*scale}" href="{uri(source)}"/></g>')
    else:raise ValueError('Unsupported long card: '+kind)
    # The original evidence and full source line remain in the review manifest.
    name='repair-readable-'+spec['cue']+'-16x9.svg'
    (DEST/'panels'/name).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="1314" height="1080">'+''.join(body)+'</svg>',encoding='utf8')
    return {'file':name,'original_title':spec['title'],'title':title,'essential_text':essential,
            'source':spec.get('source'),'data':spec.get('data'),'off_screen_context':spec.get('kicker'),'source_captures_are_reference_only':kind=='shot',
            'title_changed':title!=spec['title']}


def main():
    DEST.mkdir(exist_ok=True);(DEST/'panels').mkdir(exist_ok=True)
    old=PLAN/'short-cut/short.json';cfg=json.loads(old.read_text())
    original=W/'words-fresh/short.words.json'
    transcript=json.loads(original.read_text())
    words=transcript['words']
    # Independent bounded recognition starts these words earlier. Preserve the
    # full possible spoken span instead of trimming a disputed initial phoneme.
    adjustments=[]
    for index,start,evidence in ((112,29.98,'short-sally-source-large-v3.json'),
                                 (240,70.32,'short-confidence-source-large-v3.json')):
        adjustments.append({'word_index':index,'word':words[index]['w'],
            'old_start':words[index]['s'],'new_start':start,
            'evidence':evidence,'evidence_sha256':quality.digest(PLAN/'repair-evidence-19oct'/evidence),
            'method':'Earlier boundary from independent large-v3 source recognition; retain the full possible word span'})
        words[index]['s']=start
    transcript['derivation']={'original_document_sha256':quality.digest(original),
        'source_provenance_unchanged':True,'timing_adjustments':adjustments}
    adjudicated=W/'words-fresh/short.adjudicated.words.json'
    adjudicated.write_text(json.dumps(transcript,indent=2),encoding='utf8')
    rows=[
      (0,'CONTROL_MODELS','',None,None,''),
      (10,'ANOTHER|MODEL LAUNCH','',None,'openai-symbol',''),
      (21,'A NEW NAME.|EVERY DAY?','',None,None,'Krish’s experience'),
      (37,'DOES THE NAME|EVEN MATTER?','',None,None,''),
      (47,'CONTROL_EFFORT','',None,None,''),
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
      (148,'PUT THINKING|TO THE TEST','',None,None,'Artificial Analysis Intelligence Index'),
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
        if head.startswith('CONTROL_'):
            manifest.append(control_card(name,head.split('_')[1].lower()))
        elif head in ('MAP1','MAP2'):
            svg=kit.mapping_card_svg(uri(PLAN/'logos/mercedes-cream.svg'),uri(PLAN/'logos/claude-cream.svg'),int(head[-1]))
            (DEST/'panels'/f'{name}-9x16.svg').write_text(svg,encoding='utf8')
            manifest.append({'file':f'{name}-9x16.svg','point':'Mercedes = Claude' if head=='MAP1' else 'C-Class = Opus 5.5','shape':'9x16','essential_font_px':78})
        else:manifest.append(card(name,head,detail,photo,logo,label=label))
        end=(rows[i+1][0]-1) if i+1<len(rows) else len(words)-1
        cues.append({'id':name,'panel':f'panels/{name}-9x16.png','start':anchor(words,start),
                     'end':anchor(words,end,True),'lead':.18,'tail':.25,'source_words':[start,end]})
    cfg.update(name='why-so-many-ais-short-repair-19oct-v6',source='../'+str(Path(cfg['source']).relative_to('..')).replace('\\','/'),
               words='../words-fresh/short.adjudicated.words.json',words_sha256=quality.digest(adjudicated),script=str(ROOT/'docs/plans/2026-10-09-script-90s-v7.md'),
               pad_before=.18,pad_after=.25,cues=cues,music='no-curves-instrumental',music_mode='episode_bed',
               episode_bed_levels={'bed_lufs':-31,'chapter_lufs':-22},quality_required=True,
               intro={'9x16':'../working/3 Video/working 17 Oct/story clips/intro-9x16.mp4'},
               intro_override='Krish, 2026-10-19: Retain approved titles, thumbnails and story intro/outro.',
               endcard={'9x16':'../working/3 Video/working 17 Oct/story clips/outro-9x16.mp4'})
    cfg['strap']['png']='../working/3 Video/working 17 Oct/kit/strap-9x16.png'
    cfg['replacements']=[['got to be in my bonnet','got a bee in my bonnet'],['Maybe 5%','I’m 85%'],['C -Class','C-Class'],
                         ['tools are a manual car','tools are like a manual car'],["It's a picture of a business owner",'So picture a business owner']]
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
    # Fresh transcript review: these are meaningful spoken words, not false
    # starts. Removing them drops a verb and changes who the next line refers to.
    cfg['remove']=[cut for cut in cfg['remove'] if cut['say'] not in ('sounds','most of us')]
    raw=json.loads((W/'words-fresh/long.words.json').read_text())['words']
    removed=make.resolve_removals(raw,cfg['remove'])
    spans,total=make.segments(raw,removed,.9,.18,.25,858,True)
    problems=quality.cut_problems(raw,spans,removed)
    if problems:raise ValueError(problems)
    words=make.retime(raw,spans)
    # Retain the existing non-car panels and approved titles. Bind every old
    # visual cue afresh; no old timestamp survives this conversion.
    cues=[];review=[];visuals=[]
    specs={s['cue']:s for s in json.loads((PLAN/'video-pictures/cards-v6.json').read_text())['cards']}
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
        if old['id'] in ('fri-deep-thinking-settings','fri-deep-where-to-turn-it-up-c3'):
            name='repair-control-'+old['id']
            control_card(name,'effort','16x9')
            cue['panel']=f'panels/{name}-16x9.png'
        elif old['id']=='fri-deep-15-claude-names-s4':
            name='repair-control-'+old['id']
            control_card(name,'models','16x9')
            cue['panel']=f'panels/{name}-16x9.png'
        else:
            visual=readable_long_card(specs[old['id']]);visuals.append(visual)
            cue['panel']='panels/'+visual['file'].replace('.svg','.png')
        cues.append(cue)
        review.append({'id':old['id'],'old_start':old['start'],'fresh_start':cue['start'],
                       'fresh_end':cue['end'],'retained_existing_visual':False})
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
    cfg.update(name='why-so-many-ais-deep-repair-19oct-v3',source='../takes/Fri 16 Oct - 3-minute - Soon you won\'t pick your AI.mp4',
               words='../words-fresh/long.words.json',script=str(ROOT/'docs/plans/2026-10-09-script-deep-v6.md'),
               pad_before=.18,pad_after=.25,
               intro={'16x9':'../working/3 Video/working 17 Oct/story clips/intro-16x9.mp4'},
               endcard={'16x9':'../working/3 Video/working 17 Oct/story clips/outro-16x9.mp4'},
               intro_override='Krish, 2026-10-19: Retain approved titles, thumbnails and story intro/outro.',
               frame16='../working/3 Video/working 17 Oct/kit/frame-16x9.png',cues=cues,
               music='no-curves-instrumental',music_mode='episode_bed',episode_bed_levels={'bed_lufs':-31,'chapter_lufs':-22},quality_required=True)
    cfg['replacements'].append(['C -Class','C-Class'])
    repairs=PLAN/'repair-evidence-19oct/deep-caption-repairs.json'
    cfg['caption_repairs']=str(repairs)
    cfg['caption_repairs_sha256']=quality.digest(repairs)
    (DEST/'long.json').write_text(json.dumps(cfg,indent=2),encoding='utf8')
    (DEST/'long-cue-reconciliation.json').write_text(json.dumps({'existing':review,'real_car_visuals':added,'cuts':removed},indent=2),encoding='utf8')
    (DEST/'long-visual-manifest.json').write_text(json.dumps(visuals,indent=2),encoding='utf8')
    print(f'Bound {len(cues)} long cues to fresh speech')


if __name__=='__main__':main()
