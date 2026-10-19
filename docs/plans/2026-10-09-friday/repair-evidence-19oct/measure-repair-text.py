"""Measure authored card text in decoded final frames at 1080 output width.

Supplementary to human review; screenshot labels require separate inspection.
"""
import argparse,json,re,sys,xml.etree.ElementTree as ET
from pathlib import Path
import numpy as np
from PIL import Image,ImageFont
sys.path.insert(0,str(Path('scripts/quick-edit').resolve()))
import quality

ap=argparse.ArgumentParser();ap.add_argument('cut',choices=['short','deep']);args=ap.parse_args()
w=Path('.cache/produce/2026-10-16-904658db');kit=w/'repair-kit-v8'
short=args.cut=='short';version='v8' if short else 'v4';shape='9x16' if short else '16x9'
folder=w/('repair-short' if short else 'repair-long');name=f'why-so-many-ais-{args.cut}-repair-19oct-{version}'
video=folder/f'{name}-{shape}.mp4';report=json.loads((folder/f'{name}.report.json').read_text())
cfg=json.loads((kit/('short.json' if short else 'long.json')).read_text())
frames=w/f'review-{args.cut}-{version}';manifest=json.loads((frames/'frame-samples.json').read_text())
identity=quality.digest(video);assert manifest['video_sha256']==identity
mapping={x['id']:x for x in cfg['cues']};rows=[]
def texts(el,dx=0,dy=0):
    hit=re.fullmatch(r'translate\(([-\d.]+)[ ,]+([-\d.]+)\)',el.get('transform',''))
    if hit:dx+=float(hit[1]);dy+=float(hit[2])
    if el.tag.endswith('}text'):yield el,dx,dy
    for child in el:yield from texts(child,dx,dy)
for cue in report['cues']:
    if cue['id'] not in mapping:continue
    panel=kit/mapping[cue['id']]['panel'];svg=panel.with_suffix('.svg')
    root=ET.parse(svg).getroot();cw=float(root.get('width'));ch=float(root.get('height'))
    at=round(report['intro_seconds']+(cue['s']+cue['e'])/2)
    frame=frames/'seconds'/f'frame-{at+1:05d}.jpg';im=Image.open(frame).convert('RGB')
    ow,oh=im.size;scale=1080/ow;im=im.resize((1080,round(oh*scale)),Image.Resampling.LANCZOS)
    px=0 if short else int(re.search(r'overlay=x=(\d+):y=0:enable', (folder/f'stage2-{shape}.graph').read_text())[1])
    fit=min((ow-px)/cw,oh/ch,1);padx=((ow-px)-cw*fit)/2 if fit<1 else 0;pady=(oh-ch*fit)/2 if fit<1 else 0
    for el,dx,dy in texts(root):
        text=''.join(el.itertext());size=float(el.get('font-size','0'))
        if not any(c.isalnum() for c in text):continue
        font=ImageFont.truetype('scripts/quick-edit/fonts/Anton.ttf',round(size))
        box=font.getbbox(text,anchor='ls');x=float(el.get('x',0))+dx;y=float(el.get('y',0))+dy
        anchor=el.get('text-anchor','start');width=font.getlength(text)
        if anchor=='middle':x-=width/2
        if anchor=='end':x-=width
        crop=[round((px+padx+(x+box[0]-3)*fit)*scale),round((pady+(y+box[1]-3)*fit)*scale),round((px+padx+(x+box[2]+3)*fit)*scale),round((pady+(y+box[3]+3)*fit)*scale)]
        fill=el.get('fill','#F4EFE4').lstrip('#');colour=np.array([int(fill[i:i+2],16) for i in (0,2,4)])
        arr=np.asarray(im.crop(crop)).astype(int);mask=np.max(np.abs(arr-colour),axis=2)<55
        occupied=np.flatnonzero(mask.sum(axis=1)>=3);height=int(occupied[-1]-occupied[0]+1) if len(occupied) else 0
        rows.append({'card':cue['id'],'text':text,'at_s':at,'crop_at_1080_width':crop,'foreground_height_px':height,'status':'pass' if height>=48 else 'inspect'})
out={'video_sha256':identity,'output_width':1080,'method':'Colour-matched glyph extent in decoded final frames, using authored text bounds; source font size alone is not a pass.','scope':'Authored text only; screenshot crop labels and layout reviewed separately. A short punctuation symbol is not treated as a capital-height glyph.','rows':rows,'requires_inspection':[r for r in rows if r['status']!='pass']}
p=frames/'authored-text-measurements.json';p.write_text(json.dumps(out,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({'path':str(p),'rows':len(rows),'requires_inspection':out['requires_inspection']}))
