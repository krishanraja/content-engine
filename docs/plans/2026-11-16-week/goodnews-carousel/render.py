"""Render the fixed good-news deck with Pillow; no editorial strings in code."""
import json, math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
from body_a import body_a
G=Path(__file__).resolve().parent
ROOT=G.parents[2]
D=json.loads((G/'deck.json').read_text())
T=json.loads((ROOT/'config/ve/brand-tokens.json').read_text())
S=json.loads((ROOT/'config/studio.json').read_text())
THEME=next(t for t in S['brand_themes'] if t['theme_id']==T['theme_id'])
C=THEME['publication']['house_style']['tokens']
def rgb(k): return tuple(bytes.fromhex(C[k].lstrip('#')))
INK,CREAM,MINT=map(rgb,['ink','cream','mint'])
FONT=ROOT/'assets/fonts/makeyourmindup'
def font(n,size,weight=400):
 f=ImageFont.truetype(str(FONT/n),size)
 if n=='Archivo-Variable.ttf': f.set_variation_by_axes([weight,100])
 return f
def archivo(size,weight=400): return font('Archivo-Variable.ttf',size,weight)
def wrap(text,f,width=920):
 lines=['']
 for w in text.split():
  test=(lines[-1]+' '+w).strip()
  if f.getlength(test)>width and lines[-1]: lines.append(w)
  else: lines[-1]=test
 return lines
def text(im,s,f,y,col=CREAM,maxw=920):
 box=f.getbbox(s); w=math.ceil(f.getlength(s)); h=box[3]-box[1]
 layer=Image.new('RGBA',(max(w+4,1),h+4)); ImageDraw.Draw(layer).text((0,-box[1]),s,font=f,fill=col)
 assert w <= maxw, f'Text exceeds safe width: {s!r} ({w} > {maxw})'
 im.paste(layer,((1080-layer.width)//2,round(y)),layer)
 return h

def photo(path,w,h,centering=(.5,.4)):
 return ImageOps.fit(Image.open(G/path).convert('RGB'),(w,h),method=Image.Resampling.LANCZOS,centering=centering)
def top(im,path,height,fade):
 p=photo(path,1080,height)
 im.paste(p,(0,0))
 mask=Image.new('L',(1080,height)); dr=ImageDraw.Draw(mask)
 for y in range(height): dr.line((0,y,1080,y),fill=round(255*max(0,(y-height+fade)/fade)))
 im.paste(Image.new('RGB',p.size,INK),(0,0),mask)
def asset(im,path,width,xy):
 p=Image.open(G/path).convert('RGBA'); p=p.resize((width,round(p.height*width/p.width)),Image.Resampling.LANCZOS); im.paste(p,xy,p)
def mark(im): asset(im,'brand/mark.png',120,(880,1195))
def logos(im,paths,x=80):
 for pth in paths:
  p=Image.open(G/pth).convert('RGBA'); p.thumbnail((210,60),Image.Resampling.LANCZOS)
  tile=Image.new('RGBA',(p.width+32,92)); ImageDraw.Draw(tile).rounded_rectangle((0,0,tile.width-1,91),radius=14,fill=CREAM); tile.alpha_composite(p,(16,(92-p.height)//2)); im.paste(tile,(x,80),tile); x+=tile.width+14
def fade_scene(im,path,height,cover=False):
 p=photo(path,1080,height)
 if path=='photos/visionably.jpg':
  # Full-width window prioritizes all three faces above the bottom fade.
  source=Image.open(G/path).convert('RGB')
  source=source.resize((1080,round(source.height*1080/source.width)),Image.Resampling.LANCZOS)
  p=source.crop((0,285,1080,285+height))
 mask=Image.new('L',p.size); dr=ImageDraw.Draw(mask)
 for y in range(height):
  if cover:
   a=0 if y<600 else (.8*(y-600)/220 if y<820 else .8+.2*(y-820)/180)
  else:
   a=max(max(0,1-y/170),max(0,(y-(height-120))/120))
  dr.line((0,y,1079,y),fill=round(255*min(1,a)))
 p.paste(Image.new('RGB',p.size,INK),(0,0),mask); im.paste(p,(0,0))

for i,c in enumerate(D['cards'],1):
 im=Image.new('RGB',(1080,1350),INK)
 if i==1:
  fade_scene(im,c['scene_file'],1000,cover=True)
  for j,s in enumerate(c['cover_lines']):
   text(im,s,font('Anton-Regular.ttf',104),640+j*104*.9,CREAM if j<2 else MINT)
  f=archivo(38,600)
  words=c['line'].split()
  splits=[[' '.join(words[:k]),' '.join(words[k:])] for k in range(1,len(words))]
  lines=min((pair for pair in splits if max(map(f.getlength,pair))<=920),
            key=lambda pair:abs(f.getlength(pair[0])-f.getlength(pair[1])))
  heights=[f.getbbox(s)[3]-f.getbbox(s)[1] for s in lines]
  start=1040
  assert start+(len(lines)-1)*44+heights[-1]<1180
  for j,s in enumerate(lines): text(im,s,f,start+j*44,maxw=920)
  mark(im)
 elif i<10:
  fade_scene(im,c.get('photo_file',c.get('scene_file')),640)
  logos(im,c.get('logo_files',[]),x=910 if i==6 else 80)
  body_a(im,FONT,c['kicker'],c['headline'],c['mint'],CREAM,MINT,top=680,bottom=1170)
  mark(im)
 else:
  pix=im.load()
  for y in range(800):
   for x in range(1080):
    a=.28*math.exp(-(((x-540)/570)**2+((y-320)/360)**2)*2)
    pix[x,y]=tuple(round(b+(m-b)*a) for b,m in zip(INK,MINT))
  positions=[(110,100),(410,100),(710,100),(260,320),(560,320)]
  for c2,(x,y) in zip(D['cards'][1:6],positions):
   ImageDraw.Draw(im).ellipse((x,y,x+259,y+259),fill=MINT)
   p=photo(c2['photo_file'],244,244)
   if c2['photo_file']=='photos/vocality.jpg':
    # Focus on the speaker, excluding the poster's clipped title.
    source=Image.open(G/c2['photo_file']).convert('RGB')
    p=source.crop((530,180,930,580)).resize((244,244),Image.Resampling.LANCZOS)
   if c2['photo_file']=='photos/google.webp':
    # Remove the advertising header before fitting the portrait circle.
    source=Image.open(G/c2['photo_file']).convert('RGB')
    p=ImageOps.fit(source.crop((0,180,1200,1200)),(244,244),
                   method=Image.Resampling.LANCZOS,centering=(.5,.5))
   mask=Image.new('L',p.size); ImageDraw.Draw(mask).ellipse((0,0,243,243),fill=255)
   im.paste(p,(x+8,y+8),mask)
  # Fit the fixed single line inside the safe box by font size, never distortion.
  close_size=120
  while font('Anton-Regular.ttf',close_size).getlength(c['close_lines'][1])>920:
   close_size-=1
  for s,y,f,col in zip(c['close_lines'],[700,790,930,1020],[archivo(52,600),font('Anton-Regular.ttf',close_size),archivo(52,600),archivo(60,600)],[CREAM,MINT,CREAM,MINT]):
   text(im,s,f,y,col)
  y=1110
  wm=Image.open(G/'brand/wordmark.png').convert('RGBA')
  wm_h=round(wm.height*680/wm.width)
  assert y+wm_h<=1265
  asset(im,'brand/wordmark.png',680,(200,round(y)))
 im.save(G/f'card-{i}.png')
 print(f'card-{i}.png: 1080x1350')
