"""Browser-free registry, typography and compositional coverage checks."""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

from PIL import Image, ImageFont
import numpy as np

HERE=Path(__file__).resolve().parent
subprocess.run([sys.executable, '-B', str(HERE/'render.py'), '--check-locks'], check=True)
root=HERE.parents[3]
fonts=root/'.scratch/tonal-ab'
from font_metrics import font_metrics
metrics=font_metrics(root)
d=json.loads((HERE/'library.json').read_text(encoding='utf8'))
html=(HERE/'library.html').read_text(encoding='utf8')
script=re.search(r'<script>\s*([\s\S]*?)</script>',html)[1]
subprocess.run(['node','--check'],input=script,encoding='utf8',check=True)
for name in ('imagery.js','edition.js','alignment.js','motion.js','review.js','check_static.cjs'):
    subprocess.run(['node','--check',name],cwd=HERE,check=True)
for p in HERE.glob('*.json'):json.loads(p.read_text(encoding='utf8'))
result=json.loads(subprocess.check_output(['node','check_static.cjs'],cwd=HERE,input=json.dumps(metrics),encoding='utf8'))
errors=list(dict.fromkeys(result['errors']))
def blank_area(item,markup):
    # Quantise foreground rectangles on a 100 by 100 occupancy grid. Ignore the
    # universal backing rectangle and its grain, but count explicit colour fields.
    occupied=np.zeros((100,100),dtype=bool)
    width,height=item['width'],item['height']
    doc=ET.fromstring('<svg>'+markup+'</svg>')
    def fill(x,y,w,h):
        x1=max(0,int(x/width*100));x2=min(100,int(np.ceil((x+w)/width*100)))
        y1=max(0,int(y/height*100));y2=min(100,int(np.ceil((y+h)/height*100)))
        occupied[y1:y2,x1:x2]=True
    def visit(el,dx=0,dy=0):
        tag=el.tag.split('}')[-1]
        move=re.fullmatch(r'translate\(([-.\d]+) ([-.\d]+)\)',el.get('transform',''))
        if move:
            dx+=float(move[1]);dy+=float(move[2])
        if tag in ['rect','image','svg','use','foreignObject']:
            fill(dx+float(el.get('x',0)),dy+float(el.get('y',0)),float(el.get('width',0)),float(el.get('height',0)));return
        if tag=='line':
            ax,bx=float(el.get('x1')),float(el.get('x2'))
            ay,by=float(el.get('y1')),float(el.get('y2'))
            sw=float(el.get('stroke-width',1))
            fill(dx+min(ax,bx)-sw/2,dy+min(ay,by)-sw/2,abs(ax-bx)+sw,abs(ay-by)+sw)
        if tag=='text':
            x=float(el.get('x',0));y=float(el.get('y',0));size=float(el.get('font-size',16))
            glyphs=metrics.get(el.get('font-family'),metrics['Mono']);s=''.join(el.itertext())
            w=sum(glyphs.get(c,glyphs['M'])[0] for c in s)*size
            fill(dx+x-(w/2 if el.get('text-anchor')=='middle' else 0),dy+y-size*.86,w,size)
        for child in el:visit(child,dx,dy)
    for el in list(doc)[0 if item['layout']=='bio' else 2:]:visit(el)
    heights=[0]*100;best=0
    for row in occupied:
        heights=[0 if v else h+1 for h,v in zip(heights,row)]
        stack=[]
        for j,h in enumerate(heights+[0]):
            start=j
            while stack and stack[-1][1]>h:
                start,old=stack.pop();best=max(best,(j-start)*old)
            if not stack or stack[-1][1]<h:stack.append((start,h))
    return best/10000
exceptions={}
for i in d['items']:
    if i['id'] in result['arts']:
        area=blank_area(i,result['arts'][i['id']])
        if area>.20:exceptions[i['id']]=round(area*100,1)
# Check the editable scene rectangles and their flat text supports. Pictures
# require pixel review on the host. Grain is tested at both luminance extremes.
def rgb(value):
    return [int(value[i:i+2],16)/255 for i in (1,3,5)]
def blend(fg,bg,alpha):
    return [a*alpha+b*(1-alpha) for a,b in zip(fg,bg)]
def luminance(colour):
    return sum(a*(b/12.92 if b<=.04045 else ((b+.055)/1.055)**2.4)
               for a,b in zip((.2126,.7152,.0722),colour))
def contrast(fg,bg):
    l,h=sorted((luminance(fg),luminance(bg)))
    return (h+.05)/(l+.05)
pairs=[];photo_checks=set()
for i in d['items']:
    foreground=[]
    for op in i.get('scene',[]):
        x,y,w,h=op['rect']
        if op['kind'] in ('text','mark'):
            left,top,width,height=i['safe_zones']['content_box']
            if x<left-.1 or y<top-.1 or x+w>left+width+.2 or y+h>top+height+.2:
                errors.append(i['id']+' unsafe '+op['value'])
            for a,b,c,e in foreground:
                if min(a+c,x+w)-max(a,x)>.1 and min(b+e,y+h)-max(b,y)>.1:
                    errors.append(i['id']+' overlapping text or mark zones')
            foreground.append((x,y,w,h))
        if op['kind']!='text':continue
        bg='#0C1512';px=x+w/2;py=y+h/2
        for under in i['scene'][:i['scene'].index(op)]:
            a,b,c,e=under['rect']
            if a<=px<=a+c and b<=py<=b+e:
                if under['kind']=='field':bg=under['color']
                if under['kind'] in ('photo','burn'):bg=None
        if bg is None:
            photo_checks.add(i['id']);continue
        slot=i['slots'][op['slot']]
        alpha=.6 if op['value'].startswith('[') else 1
        for extreme in ([0,0,0],[1,1,1]):
            base=blend(extreme,rgb(bg),.07)
            ratio=contrast(blend(rgb(op['color']),base,alpha),base)
            floor=3 if slot['min_size_px']>=24 else 4.5
            if ratio+.01<floor:errors.append(i['id']+' insufficient flat contrast')
            pairs.append(ratio)
active={i['id']:i for i in d['items'] if i.get('status')!='retired'}
if active.keys()!=result['arts'].keys():errors.append('Active registry and generated items disagree')
from standard import audit
from spacing import compare, include, model_bounds
from pixel_alignment import difference_bounds
# Exercise the native measurement without a browser. Three glyph fragments
# occupy two lines above a second group, with a coloured backing.
card={'width':540,'height':90,'spacing_pairs':[['upper','lower',40]]}
back=Image.new('RGB',(64,90),'#7EF0C0')
sample=back.copy()
sample.paste('#0C1512',(5,2,22,12))
sample.paste('#0C1512',(36,2,42,12))
upper=difference_bounds(sample,back)
intervals={}
include(intervals,'upper',upper[1],upper[3])
include(intervals,'upper',20,30)
for y,passes in [(50,True),(49,False),(25,False)]:
    check={**intervals,'lower':(y,y+9)}
    if compare(card,check,native=True)['passed']!=passes:errors.append('Native spacing boundary')
if compare(card,intervals,native=True)['passed'] or difference_bounds(back,back) is not None:
    errors.append('Missing ink accepted')
marks={'s3h':(0,700,35,631),'v9':(0,90,0,90),'v4':(0,89,0,89),'d':(17,86,17,86)}
spacing_report={}
for ident,raw in result['arts'].items():
    item=active[ident]
    columns=item['alignment']['columns']
    members=item['alignment']['members']
    seen=set()
    for el in ET.fromstring('<svg>'+raw+'</svg>').iter():
        if 'data-align-edge' not in el.attrib:continue
        name=el.get('data-align-name');seen.add(name)
        if name not in members or abs(float(el.get('data-align-edge'))-columns[members[name]])>.01:
            errors.append(ident+' undeclared or drifting column: '+name)
    if members.keys()-seen-set(item['alignment'].get('optional',[])):errors.append(ident+' alignment member missing')

    tree=ET.fromstring('<svg>'+raw+'</svg>')
    if any('stroke-dasharray' in el.attrib for el in tree.iter()):errors.append(ident+' dashed guide in native artwork')
    scene=item.get('scene',[])
    # Read the final SVG's transforms and glyph extents independently of the stack fitter.
    parents={child:parent for parent in tree.iter() for child in parent}
    def shift_y(el):
        dy=0
        while el in parents:
            el=parents[el]
            shift=re.fullmatch(r'translate\(0 ([-.\d]+)\)',el.get('transform',''))
            if shift:dy+=float(shift[1])
        return dy
    def slot_ink(name):
        intervals=[]
        for el in tree.findall(f".//text[@data-slot='{name}']"):
            baseline=float(el.get('y'))+shift_y(el)
            size=float(el.get('font-size'));face=metrics[el.get('font-family')]
            glyphs=[face.get(ch,face['M']) for ch in ''.join(el.itertext())]
            intervals.append((baseline-size*max(m[1] for m in glyphs),baseline+size*max(m[2] for m in glyphs)))
        return min(a for a,b in intervals),max(b for a,b in intervals)
    for finding in audit(item,raw,templates=active):errors.append(ident+" STANDARD "+finding)
    bounds=model_bounds(raw,metrics,marks)
    if item.get('colour_aperture'):
        pictures=[op for op in scene if op['kind']=='photo']
        width,height=item['width'],item['height']
        if (not pictures or abs(sum(op['rect'][2] for op in pictures)-width)>.1 or
                any(op['rect'][1]!=0 or not .50<=op['rect'][3]/height<=.55 or
                    op.get('burn_axis')!='bottom' or op.get('fade_end',1)>.95 for op in pictures)):
            errors.append(ident+' upper photographic aperture')
        if item['layout'].startswith('why-') or item['layout']=='rail':
            end=item['safe_zones'].get('caption_band')
            _,y,_,h=item['safe_zones']['content_box']
            bottom=end[1]-item.get('headline_caption_gap',8) if end else y+h
            lines=tree.findall(".//text[@data-slot='headline_1']")
            coverage=max(float(el.get('data-ink-width'))/float(el.get('data-bounds').split()[2]) for el in lines)
            if abs(bounds['headline_1'][1]-bottom)>1 or coverage<.92:
                errors.append(ident+' question fails the lower line or full measure')
    if item['family']=='carousel' and item['layout'].endswith('cover'):
        lines=tree.findall(".//text[@data-slot='headline_1']")
        mark=tree.find(".//use[@href='#v4']")
        if ([l.get('fill') for l in lines]!=['#F4EFE4']*(len(lines)-1)+['#7EF0C0']
                or not 2<=len(lines)<=3 or mark is None or mark.get('data-align-side')!='right'
                or item['scene'][0]['rect']!=[0,0,item['width'],item['height']]
                or item['slots']['photo_1']['imagery_style']!=(4 if ident=='carousel-howto-cover' else 1)
                or tree.find(".//text[@font-family='Fraunces']") is None):
            errors.append(ident+' carousel cover hierarchy')
    spacing_report[ident]=compare(item,bounds)
    for row in spacing_report[ident]['pairs']:
        if not row['passed']:errors.append(ident+' spacing '+str(row))
    if item['layout'] in ('ig-story-hook','ig-story-proof'):
        _,y,_,h=item['safe_zones']['content_box']
        if abs(slot_ink('body_1')[1]-(y+h))>.1:errors.append(ident+' Story safe line')
    if 'signature' in item.get('ink_stack',{}).get('rhythm',[]):
        headline=next(op for op in scene if op['kind']=='text')
        lines=tree.findall(f".//text[@data-slot='{headline['slot']}']")
        if headline['value'][0]!='[' and ' '.join(line.text for line in lines)!='WHY DID POP SONGS GET SHORTER?':
            errors.append(ident+' editorial title differs')
        art=tree.find(".//use[@href='#v4']")
        top=float(art.get('y'))+shift_y(art)
        cap=metrics['Anton']['H'][1]*float(lines[0].get('font-size'))
        if top-slot_ink(headline['slot'])[1]+.1<cap/2:errors.append(ident+' V4 cap clearance')
    if ident in ('video-wide-place','video-wide-creative-work','social-youtube-thumb-face'):
        panel=next(op['rect'] for op in scene if op['kind']=='field')
        key='media slot' if ident.endswith('face') else 'headline_1'
        edge=columns[members[key]]
        boundary=panel[0]+panel[2] if ident.endswith('face') else panel[0]
        if edge-boundary<20:errors.append(ident+' ink against the panel seam')
    if any(op.get('value')=='headshot' for op in scene):
        x,y,w,h=item['safe_zones']['footage']
        sheet=ET.fromstring('<svg>'+result['cameraSheets'][ident]+'</svg>')
        guide=sheet.find('.//g[@data-camera-guide]')
        if guide is None:errors.append(ident+' missing camera guide')
        else:
            oval=guide.find('ellipse')
            if (abs(float(oval.get('cy'))-float(oval.get('ry'))-(y+.12*h))>.1 or
                abs(float(oval.get('cx'))-(x+w/2))>.1 or abs(float(oval.get('cy'))-(y+h/3))>.1):
                errors.append(ident+' camera framing')
    if item['layout'] in ('meme','meme-tall','meme-video'):
        photo=next(o for o in scene if o['kind']=='photo')
        aperture=tree.find('.//svg[image]');image=aperture.find('image')
        x,y,w,h=[float(aperture.get(v)) for v in ('x','y','width','height')]
        clip=item['safe_zones'].get('clip')
        if h/item['height']<(.55 if clip else .60)-.0001 or w<item['safe_zones']['content_box'][2]:
            errors.append(ident+' picture aperture')
        if clip:
            focus=d['photos'][photo['value']]['focus'];iw,ih=[float(image.get(v)) for v in ('width','height')]
            fx=x+float(image.get('x'))+focus['x']*iw;fy=y+float(image.get('y'))+focus['y']*ih
            cx,cy,cw,ch=clip
            zooms=[1]+[track['from'] for track in item.get('motion',{}).get('tracks',[]) if track['property']=='scale']
            for zoom in zooms:
                centre_x=x+w/2;centre_y=y+h/2
                left=centre_x+(fx-centre_x)*zoom;top=centre_y+(fy-centre_y)*zoom
                if left<cx or top<cy or left+focus['w']*iw*zoom>cx+cw or top+focus['h']*ih*zoom>cy+ch:
                    errors.append(ident+' subject outside clip')
    if item['layout'] in ('split','plate','pip') and item['family']=='video-vertical':
        paper=tree.find(".//g[@data-layer='evidence']/rect[@data-document-paper]")
        x,y,w,h=[float(paper.get(v)) for v in ('x','y','width','height')]
        if x*2+w!=item['width']:errors.append(ident+' evidence side margins')
        if item['layout']=='pip':
            if y!=item['safe_zones']['content_box'][1]:errors.append(ident+' evidence top anchor')
        elif abs(y+h/2-item['safe_zones']['caption_band'][1]/2)>.1:errors.append(ident+' evidence centre')
def closing_geometry(ident):
    return result['arts'][ident].replace(ident,'closing-art')
if closing_geometry('video-vertical-close')!=closing_geometry('video-vertical-outro'):
    errors.append('Vertical close and settled outro differ before rasterisation')
for shape in ('vertical','wide'):
    close,hold,statement=(active[f'video-{shape}-{ending}'] for ending in ('close','outro','statement-close'))
    def signature(item):
        mark=ET.fromstring('<svg>'+result['arts'][item['id']]+'</svg>').find(".//use[@href='#s3h']")
        return (float(mark.get('data-align-edge')),float(mark.get('width'))*645/700)
    edge,width=signature(close)
    column=close.get('signature_column',[edge,close['safe_zones']['content_box'][2]])
    if width < column[1]*.60 or signature(hold)!=(edge,width):
        errors.append(shape+' close signature mismatch')
    if shape=='wide':
        def signing_layers(item):
            tree=ET.fromstring('<svg>'+closing_geometry(item['id'])+'</svg>')
            return [ET.tostring(el) for el in tree if el.get('data-layer') in ('signature','invitation')]
        if signing_layers(close)!=signing_layers(hold):errors.append('Wide settled signing layers differ')
        drawn=ET.fromstring('<svg>'+closing_geometry(hold['id'])+'</svg>')
        landed=drawn.find(".//g[@data-layer='push3']")
        base=ET.fromstring('<svg>'+closing_geometry(close['id'])+'</svg>')
        if landed.get('transform')!='translate(0 0)' or [r.attrib for r in landed]!=[r.attrib for r in list(base)[:2]]:
            errors.append('Wide settled backdrop differs')
deck=json.loads((root/'docs/plans/2026-11-16-week/goodnews-carousel/deck.json').read_text(encoding='utf8'))
news=d['sequences']['goodnews']['shots']
for n,card in enumerate(deck['cards'][:6]):
    item=active[news[n]['slide']]
    text=[o['value'] for o in item['scene'] if o['kind']=='text']
    if card['headline'] not in text:errors.append(item['id']+' changed approved headline')
    if n and (card['line'] not in text or item['source']!=card['story_source']):
        errors.append(item['id']+' changed approved story')
# Check the coloured stock the grid actually draws. Each featured stock
# must occupy a full-width, type-bearing field after Instagram's centre crop.
stocks=[]
for entry in d['grid_proof']:
    item=active[entry['item']]
    w,h=item['width'],item['height']
    crop_h=w*4/3
    crop_y=(h-crop_h)/2
    fields=set()
    for op in item.get('scene',[]):
        if op['kind']!='field':continue
        x,y,fw,fh=op['rect']
        if x<=0 and fw>=w and min(y+fh,crop_y+crop_h)-max(y,crop_y)>=crop_h*.35:
            fields.add(op['color'])
    stocks.append(fields)
required={'#FF6A4D','#FFD84D','#B7A6FF','#7EF0C0'}
if len(stocks)!=9 or not required<=set.union(set(),*stocks):
    errors.append('STANDARD 12: profile grid lacks a full stock in the nine-post crop')
if any(i.get('archetype') not in range(1,11) for i in active.values()):
    errors.append('Missing approved archetype')
reported_photos={name for name,record in d['photos'].items() if record.get('credit') and record.get('source')}
strip=[op['value'] for op in active['carousel-good-news-close']['scene'] if op['kind']=='photo']
if len(set(strip))!=5 or set(strip)-reported_photos or strip!=[shot['photo'] for shot in news[1:-1]]:
    errors.append('Good-news photographs differ across edition, slideshow and strip')
for word in ('IBM Plex Mono','Archivo','Newsreader','Instrument Serif','AI, unpicked.',
             'brutal shadow','halftone','felt robot','highlighter swipe','typing animation'):
    if word.casefold() in html.casefold():errors.append('retired '+word)
bank=json.loads((HERE/d['imagery']['house_stills']).read_text(encoding='utf8'))
prompts=json.loads((root/'.scratch/bank/bank-prompts.json').read_text(encoding='utf8'))
if [r['id'] for r in bank]!=[f'bank-{n:02}' for n in range(48)] or len(prompts)!=len(bank):
    errors.append('Incomplete house-still bank')
for row,original in zip(bank,prompts):
    params=original['params']
    focus=row['focus']
    if (row['id']!=f"bank-{original['index']:02}" or row['prompt']!=params['prompt']
            or row['imagery_style']!=original['style'] or row['aspect']!=params['aspect_ratio']
            or not (0<=focus['x']<focus['x']+focus['w']<=1 and 0<=focus['y']<focus['y']+focus['h']<=.600001)):
        errors.append(row['id']+' source metadata or upper focal box')
for name,photo in d['photos'].items():
    if name=='headshot':continue
    path=root/photo['path'] if 'path' in photo else root/'.scratch/why-ladder/assets'/(name+'.png')
    with Image.open(path) as im:
        if im.size!=(photo['width'],photo['height']):errors.append(name+' image dimensions')
print('Minimum flat-field contrast',round(min(pairs),2),'to one. Photographic type samples:',sorted(photo_checks))
print('Active items generated',len(result['arts']),'of',sum(i.get('status')!='retired' for i in d['items']))
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--spacing-report', type=Path, help='Save the modelled per-item gaps as JSON')
args=parser.parse_args()
if args.spacing_report:
    args.spacing_report.write_text(json.dumps({'model':'local fonts and SVG transforms', 'items':spacing_report},indent=2)+'\n',encoding='utf-8')
print('Static spacing:',sum(r['passed'] for r in spacing_report.values()),'items pass,',
      sum(len(r['pairs']) for r in spacing_report.values()),'declared group pairs')
print('Stress previews',result['stressCases'])
print('Sequence samples',result['sequencesTested'])
print('Timed caption word onsets',result['captionStates'])
print('Structural open-area exceptions',json.dumps(exceptions))
for ident,small in [('podcast-episode-art',56),('cover-receipt-youtube',168),('cover-face-youtube',168)]:
    row=next(i for i in d['items'] if i['id']==ident)
    tree=ET.fromstring('<svg>'+result['arts'][ident]+'</svg>')
    proof=[(el.text,round(float(el.get('font-size'))*small/row['width'],1)) for el in tree.iter('text') if el.get('font-family')=='Anton']
    print(f'{ident} at {small}px, fitted Anton em size:', proof)
for err in errors:print(err)
raise SystemExit(bool(errors))
