#!/usr/bin/env python3
"""Render the fixed deck with centred, image-led house typography."""
import json
from pathlib import Path
from PIL import Image, ImageColor, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
DECK = json.loads((ROOT / 'docs/plans/2026-11-16-week/midterms-carousel/deck.json').read_text())
TOKENS = json.loads((ROOT / 'config/ve/brand-tokens.json').read_text())
PALETTE = json.loads((ROOT / 'config/brand-palette.json').read_text())
# The tokens point to the canonical theme for colour values.
STUDIO = json.loads((ROOT / 'config/studio.json').read_text())
def find_colors(obj):
    if isinstance(obj, dict):
        if all(k in obj for k in ('ink', 'cream', 'mint')):
            return obj
        for value in obj.values():
            found = find_colors(value)
            if found: return found
    if isinstance(obj, list):
        for value in obj:
            found = find_colors(value)
            if found: return found
COLORS = find_colors(STUDIO)
INK, CREAM, MINT = (ImageColor.getrgb(COLORS[TOKENS['roles'][role]]) for role in ('background', 'text', 'answer'))
MUTED = tuple(round(.8*c + .2*b) for c,b in zip(CREAM, INK))
W, H = PALETTE['safe']['feed_canvas']
MARGIN = PALETTE['safe']['feed_margin_px']
WIDTH = W - 2*MARGIN
FONTS = ROOT / 'assets/fonts/makeyourmindup'

def font(size, weight='Regular', display=False):
    f = ImageFont.truetype(str(FONTS / ('Anton-Regular.ttf' if display else 'Archivo-Variable.ttf')), size)
    if not display: f.set_variation_by_name(weight)
    return f

def wrap(text, f):
    lines = []
    for word in text.split():
        if lines and f.getlength(lines[-1]+' '+word) <= WIDTH:
            lines[-1] += ' '+word
        else:
            assert f.getlength(word) <= WIDTH
            lines.append(word)
    return lines

def rows(text, f, color, leading):
    return [(line, f, color, leading) for line in wrap(text, f)]

def height(lines):
    return sum(row[3] for row in lines[:-1]) + lines[-1][1].getbbox(lines[-1][0])[3] - lines[-1][1].getbbox(lines[-1][0])[1]

def block(draw, lines, y):
    for line, f, color, leading in lines:
        box = f.getbbox(line)
        # Centre the actual ink box, independently for each wrapped line.
        x = W/2 - (box[0]+box[2])/2
        assert x+box[0] >= MARGIN and x+box[2] <= W-MARGIN
        draw.text((x, round(y)-box[1]), line, font=f, fill=color)
        y += leading

def scene(canvas, index, height, fade):
    with Image.open(OUT / 'scenes' / f'mid-{index}.png') as source:
        picture = ImageOps.fit(source.convert('RGB'), (W,height), method=Image.Resampling.LANCZOS, centering=(.5,.5))
    mask = Image.new('L',(1,height))
    mask.putdata([255 if y < height-fade else round(255*(height-1-y)/(fade-1)) for y in range(height)])
    canvas.paste(picture,(0,0),mask.resize((W,height)))

def mark(canvas):
    with Image.open(OUT / 'brand/wordmark.png') as source:
        logo = source.convert('RGBA')
        logo = logo.resize((150,round(logo.height*150/logo.width)),Image.Resampling.LANCZOS)
    assert logo.height <= 40
    canvas.paste(logo,(W-MARGIN-150,H-MARGIN-logo.height),logo)

def render(index, card):
    canvas = Image.new('RGB',(W,H),INK)
    scene(canvas,index,740 if index==1 else 760 if index==6 else 740,160 if index==1 else 130)
    draw = ImageDraw.Draw(canvas)
    if index == 1:
        first, turn = card['headline'].split('. ',1)
        f = font(112,display=True)
        # set by hand: no orphan words (Krish's headline, 18 Nov)
        assert (first+'.').upper()=="VOTERS TURNED AWAY AI'S DATA CENTRES." and turn.upper()=="WHERE COULD AI LIVE NOW?"
        lines = rows("VOTERS TURNED AWAY",f,CREAM,112*.95) + rows("AI'S DATA CENTRES.",f,CREAM,112*.95) + rows("WHERE COULD AI",f,MINT,112*.95) + rows("LIVE NOW?",f,MINT,112*.95)
        lines[-1] = (*lines[-1][:3],lines[-1][3]+20)
        lines += rows(card['line'],font(40,'SemiBold'),CREAM,46)
        # Fixed words require four display lines plus two subline lines.
        # Keep the whole stack above the corner mark, into the scene's fade.
        y = 1210-height(lines)
    elif index == 6:
        f = font(80,display=True)
        first, turn = card['headline'].split(' decides ',1)
        lines = rows(first.upper(),f,CREAM,84) + rows(('decides '+turn).upper(),f,MINT,84)
        lines[-1] = (*lines[-1][:3],lines[-1][3]+36)
        lines += rows(card['cta'],font(44,'SemiBold'),MINT,51)
        y = (790+1240-height(lines))/2
    else:
        import sys; sys.path.insert(0,str(OUT)); from body_a import body_a
        K={2:('WHAT HAPPENED','40 out of 41'),3:('WHY','their own power bill'),4:('THE BIGGER PICTURE','their own power plants'),5:('WHAT TO DO','who pays for power')}
        body_a(canvas,FONTS,K[index][0],card['headline'],K[index][1],CREAM,MINT,top=750,bottom=1230)
        mark(canvas)
        canvas.save(OUT / f'card-{index}.png')
        return
        lines = rows(card['headline'],font(64,'Bold'),CREAM,64*1.15)
        assert len(lines) <= 5
        lines[-1] = (*lines[-1][:3],lines[-1][3]+28)
        y = (930+1240-height(lines))/2
    assert y >= MARGIN and y+height(lines) <= 1250
    block(draw,lines,y)
    mark(canvas)
    path = OUT / f'card-{index}.png'
    canvas.save(path)
    print(path.relative_to(ROOT))

if __name__ == '__main__':
    assert len(DECK['cards']) == 6
    for index,card in enumerate(DECK['cards'],1): render(index,card)
