"""Extract sequential frame-index samples for review, never certify playback."""
import argparse
import json
import math
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
import quality


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('video',type=Path)
    ap.add_argument('--out',type=Path,required=True)
    ap.add_argument('--intro',type=float,required=True)
    ap.add_argument('--outro',type=float,required=True)
    args=ap.parse_args()
    identity=quality.digest(args.video)
    info=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_streams','-of','json',str(args.video)]))
    stream=next(s for s in info['streams'] if s['codec_type']=='video')
    rate=stream['avg_frame_rate'].split('/');fps=int(rate[0])/int(rate[1]);frames=int(stream['nb_read_frames'])
    if fps!=round(fps) or int(fps)%4:raise ValueError('Review sampler needs an integer frame rate divisible by four')
    fps=int(fps);intro=math.ceil(args.intro*fps);outro=max(0,frames-math.ceil(args.outro*fps))
    tall=stream['height']>stream['width']
    width,height=(216,384) if tall else (384,216)
    font=ImageFont.truetype(str(Path(__file__).parent/'fonts/Mono.ttf'),16)
    args.out.mkdir(parents=True,exist_ok=True)
    manifest={'video_sha256':identity,'fps':fps,'video_frames':frames,'sets':{},
              'scope':'Frame samples only; not proof of complete playback or listening.'}
    selections={'seconds':list(range(0,frames,fps)),
                'intro-outro': [i for i in range(0,frames,fps//4) if i<intro or i>=outro]}
    for name,indices in selections.items():
        folder=args.out/name;folder.mkdir(exist_ok=True)
        selection=f'not(mod(n,{fps}))' if name=='seconds' else f'not(mod(n,{fps//4}))*((lt(n,{intro}))+gte(n,{outro}))'
        subprocess.run(['ffmpeg','-y','-v','error','-i',str(args.video),'-vf',f"select='{selection}'",'-fps_mode','vfr',
                        '-q:v','2',str(folder/'frame-%05d.jpg')],check=True)
        files=[folder/f'frame-{i+1:05d}.jpg' for i in range(len(indices))]
        if not all(p.exists() for p in files):raise ValueError('Missing extracted frames')
        sheets=[]
        for start in range(0,len(files),30):
            sheet=Image.new('RGB',(width*5,(height+30)*6),'#ffffff');draw=ImageDraw.Draw(sheet)
            for k,path in enumerate(files[start:start+30]):
                im=Image.open(path).convert('RGB');im.thumbnail((width,height))
                x=(k%5)*width;y=(k//5)*(height+30);sheet.paste(im,(x,y))
                draw.text((x+6,y+height+5),f'{indices[start+k]/fps:.2f}s',font=font,fill='#000000')
            path=args.out/f'{name}-{start//30+1:02d}.jpg';sheet.save(path,quality=92);sheets.append(path.name)
        manifest['sets'][name]={'frame_indices':indices,'count':len(indices),'sheets':sheets}
    if quality.digest(args.video)!=identity:raise ValueError('Video changed during extraction')
    (args.out/'frame-samples.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
    print(json.dumps({name:data['count'] for name,data in manifest['sets'].items()}))


if __name__=='__main__':main()
