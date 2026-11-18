"""Render fixed deck and supplied scenes in the house carousel look. No network."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageColor, ImageOps

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
FONTS = ROOT / 'assets/fonts/makeyourmindup'
DECK = json.loads((ROOT / 'docs/plans/2026-11-16-week/ads-carousel/deck.json').read_text())
BRAND = json.loads((ROOT / 'config/ve/brand-tokens.json').read_text())
# Resolve the symbolic brand roles from their canonical theme, without copying colours.
def find_tokens(obj):
    if isinstance(obj, dict):
        if {'ink', 'cream', 'mint', 'ink_deep'} <= obj.keys():
            return obj
        for val in obj.values():
            found = find_tokens(val)
            if found:
                return found
    if isinstance(obj, list):
        for val in obj:
            found = find_tokens(val)
            if found:
                return found
TOKENS = find_tokens(json.loads((ROOT / 'config/studio.json').read_text()))
INK, CREAM, MINT = [ImageColor.getrgb(TOKENS[k]) for k in ('ink', 'cream', 'mint')]
W, H, WIDTH = 1080, 1350, 920

def font(size, weight=None):
    f = ImageFont.truetype(str(FONTS / ('Archivo-Variable.ttf' if weight else 'Anton-Regular.ttf')), size)
    if weight:
        f.set_variation_by_name(weight)
    return f

def wrap(text, f, width=WIDTH):
    lines=[]
    for word in text.split():
        if lines and f.getlength(lines[-1]+' '+word)<=width:
            lines[-1]+=' '+word
        else:
            lines.append(word)
    assert all(f.getlength(s)<=width for s in lines)
    return lines

def height(lines,f,leading):
    return (len(lines)-1)*leading+max(f.getbbox(s)[3]-f.getbbox(s)[1] for s in lines)

def draw_lines(im,lines,f,y,color,leading):
    d=ImageDraw.Draw(im)
    for line in lines:
        box=f.getbbox(line)
        # Centre the visible ink, including the font's side bearings.
        x=(W-(box[2]-box[0]))/2-box[0]
        d.text((round(x),round(y)-box[1]),line,font=f,fill=color)
        y+=leading

def base(n,height,fade):
    im=Image.new('RGB',(W,H),INK)
    with Image.open(OUT/'scenes'/f'ads-{n}.png') as src:
        scene=ImageOps.fit(src.convert('RGB'),(W,height),method=Image.Resampling.LANCZOS,centering=(.5,.5))
    im.paste(scene,(0,0))
    mask=Image.new('L',(W,fade))
    d=ImageDraw.Draw(mask)
    for y in range(fade):
        d.line((0,y,W,y),fill=round(255*y/(fade-1)))
    im.paste(Image.new('RGB',(W,fade),INK),(0,height-fade),mask)
    return im

def mark(im):
    logo=Image.open(OUT/'brand/wordmark.png').convert('RGBA')
    logo=logo.crop(logo.getbbox())
    logo=logo.resize((150,round(150*logo.height/logo.width)),Image.Resampling.LANCZOS)
    im.paste(logo,(850,1270-logo.height),logo)

def faded(color,opacity):
    return tuple(round(a*opacity+b*(1-opacity)) for a,b in zip(color,INK))

def cover(card):
    # Whole photo sharp at the top; below it a darkened blur of the same photo carries the type (Krish wants the
    # person and the screen fully visible; the cover is visibly more picture than any body card).
    from PIL import ImageFilter, ImageEnhance
    with Image.open(OUT/'scenes'/'ads-1.png') as src:
        src=src.convert('RGB')
        bg=ImageOps.fit(src,(W,H),method=Image.Resampling.LANCZOS,centering=(.5,.9)).filter(ImageFilter.GaussianBlur(26))
        bg=ImageEnhance.Brightness(bg).enhance(0.42)
        top=ImageOps.fit(src,(W,800),method=Image.Resampling.LANCZOS,centering=(.5,.35))
    im=bg
    fade=Image.new('L',(W,800),255); fd=ImageDraw.Draw(fade)
    for yy in range(640,800): fd.line((0,yy,W,yy),fill=round(255*(800-yy)/160))
    im.paste(top,(0,0),fade)
    logo=Image.open(OUT/'brand/openai-wordmark-dark.png').convert('RGBA')
    logo=logo.crop(logo.getbbox())
    # Preserve the supplied artwork exactly; only its requested white treatment changes.
    alpha=logo.getchannel('A')
    logo=Image.new('RGBA',logo.size,'white')
    logo.putalpha(alpha)
    logo=logo.resize((round(46*logo.width/logo.height),46),Image.Resampling.LANCZOS)
    im.paste(logo,((W-logo.width)//2,744),logo)
    first,second=card['headline'].split('. ',1)
    f=font(100)
    parts=[['FREE CHATGPT','HAS ADS NOW.'],['HERE ARE THREE','WAYS ROUND THEM.']]  # set by hand: no orphan words
    assert ' '.join(parts[0])==first.upper()+'.' and ' '.join(parts[1])==second.upper()
    y=806
    for lines,color in zip(parts,[CREAM,MINT]):
        draw_lines(im,lines,f,y,color,100*.95)
        y+=len(lines)*100*.95
    sf=font(40,'SemiBold');ls=wrap(card['line'],sf)
    draw_lines(im,ls,sf,y+12,CREAM,46)
    print('cover',parts,'subline top',y+12)
    return im

KICKERS={2:'WHAT HAPPENED',3:'WHY',4:'THE BIGGER PICTURE',5:'WAY ROUND ONE',6:'WAY ROUND TWO'}
KEYS={2:'sponsored card',3:'costs a fortune to run',4:'paid for by the ads you see',5:'shows no ads',6:'fewer messages and no images'}
def body(n,card):
    import sys; sys.path.insert(0,str(OUT)); from body_a import body_a
    im=base(n,720 if n==4 else 600 if n==5 else 640,120)
    return body_a(im,FONTS,KICKERS[n],card['headline'],KEYS[n],CREAM,MINT,top=730 if n==4 else 610 if n==5 else 650,bottom=1230)

def close(card):
    im=base(7,560,110)
    f=font(70);ls=wrap(card['headline'].upper(),f)
    sf=font(44,'SemiBold');cta=wrap(card['cta'],sf)
    total=height(ls,f,74)+28+height(cta,sf,50)
    y=600+(580-total)/2
    turn=False
    for line in ls:
        box=f.getbbox(line);x=(W-(box[2]-box[0]))/2-box[0]
        for word in line.split():
            if word=='AND':turn=True
            ImageDraw.Draw(im).text((round(x),round(y)-box[1]),word,font=f,fill=MINT if turn else CREAM)
            x+=f.getlength(word+' ')
        y+=74
    draw_lines(im,cta,sf,y+20,MINT,50)
    return im

if __name__=='__main__':
    assert len(DECK['cards'])==7
    for n,card in enumerate(DECK['cards'],1):
        im=cover(card) if n==1 else close(card) if n==7 else body(n,card)
        mark(im)
        im.save(OUT/f'card-{n}.png')
