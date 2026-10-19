"""Extract every second of a completed cut into bounded, numbered contact sheets."""
import hashlib
import json
import math
import subprocess
import sys
from pathlib import Path
from PIL import Image, ImageDraw
from prepare_video import WORK, PLAN

cut=sys.argv[1]
shape='9x16' if cut=='short' else '16x9'
folder=WORK/cut
video=folder/f'why-ai-prices-keep-changing-{cut}-{shape}.mp4'
report=folder/f'why-ai-prices-keep-changing-{cut}.report.json'
if not report.is_file(): raise SystemExit('The render has not written its completion report yet.')
stats=json.loads(report.read_text(encoding='utf-8'))
out=WORK/'review'/cut;out.mkdir(parents=True,exist_ok=True)
w,h,cols,rows=(216,384,5,4) if cut=='short' else (320,180,6,5)
subprocess.run(['ffmpeg','-v','error','-y','-threads','2','-i',str(video),'-vf',f'fps=1,scale={w}:{h}',
                '-threads','2',str(out/'frame-%04d.jpg')],check=True)
frames=sorted(out.glob('frame-*.jpg')); pages=[]
for start in range(0,len(frames),cols*rows):
    page=Image.new('RGB',(w*cols,(h+24)*rows),'#19251f');draw=ImageDraw.Draw(page)
    for j,f in enumerate(frames[start:start+cols*rows]):
        x=(j%cols)*w;y=(j//cols)*(h+24)
        page.paste(Image.open(f),(x,y+24));draw.text((x+6,y+5),f'{start+j:03d} seconds',fill='white')
    dest=out/f'contact-{start//(cols*rows)+1:02d}.jpg';page.save(dest,quality=94);pages.append(str(dest))
story_pages=[]
for label, offset, duration in [('intro',0,stats['intro_seconds']),
        ('outro',stats['total_seconds']-stats['outro_seconds'],stats['outro_seconds'])]:
    target=out/label;target.mkdir(exist_ok=True)
    subprocess.run(['ffmpeg','-v','error','-y','-threads','2','-ss',str(offset),'-i',str(video),
                    '-t',str(duration),'-vf',f'fps=4,scale={w}:{h}','-threads','2',
                    str(target/'frame-%04d.jpg')],check=True)
    selected=sorted(target.glob('frame-*.jpg'))
    for start in range(0,len(selected),cols*rows):
        page=Image.new('RGB',(w*cols,(h+24)*rows),'#19251f');draw=ImageDraw.Draw(page)
        for j,f in enumerate(selected[start:start+cols*rows]):
            x=(j%cols)*w;y=(j//cols)*(h+24)
            page.paste(Image.open(f),(x,y+24))
            draw.text((x+6,y+5),f'{label} {offset+(start+j)/4:.2f}s',fill='white')
        dest=out/f'{label}-{start//(cols*rows)+1:02d}.jpg'
        page.save(dest,quality=94);story_pages.append(str(dest))
receipt={'cut':cut,'file':str(video),'sha256':hashlib.file_digest(video.open('rb'),'sha256').hexdigest(),
         'size':video.stat().st_size,'frames_sampled':len(frames),'contact_sheets':pages,
         'story_contact_sheets':story_pages,
         'status':'extracted; visual review pending','report':stats}
(PLAN/f'{cut}-render-evidence.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'cut':cut,'frames':len(frames),'sheets':pages},indent=2))
