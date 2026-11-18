"""Render deck-v2 in the house carousel look: scenes and brand marks from .scratch/carousels/adsswitch, words from
deck-v2.json, type from assets/fonts/makeyourmindup. Adapted from render.py; no network."""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageOps
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import types
_src = (HERE / 'render.py').read_text().split('def cover')[0]
_src = _src.replace('parents[3]', 'parents[4]').replace('ads-carousel/deck.json', 'ads-carousel/deck-v2.json')
_src = _src.replace("OUT = Path(__file__).resolve().parent", "OUT = Path(__file__).resolve().parents[3] / '.scratch/carousels/adsswitch'")
R = types.ModuleType('R'); R.__file__ = str(HERE / 'render.py'); exec(compile(_src, 'render.py', 'exec'), R.__dict__)
from body_a import body_a, follow_foot
ROOT = R.ROOT
OUT = ROOT / '.scratch/carousels/adsswitch'
W, H, INK, CREAM, MINT, FONTS = R.W, R.H, R.INK, R.CREAM, R.MINT, R.FONTS
DECK = json.loads((HERE / 'deck-v2.json').read_text())
R.OUT = OUT  # render.base() reads scenes/ads-N.png from here

def mark(im):
    logo = Image.open(OUT / 'brand/wordmark.png').convert('RGBA'); logo = logo.crop(logo.getbbox())
    logo = logo.resize((150, round(150 * logo.height / logo.width)), Image.Resampling.LANCZOS)
    im.paste(logo, (850, 1270 - logo.height), logo)

def white_logo(h):
    lg = Image.open(OUT / 'brand/openai-wordmark.png').convert('RGBA'); lg = lg.crop(lg.getbbox())
    solid = Image.new('RGBA', lg.size, 'white'); solid.putalpha(lg.getchannel('A'))
    return solid.resize((round(h * lg.width / lg.height), h), Image.Resampling.LANCZOS)

def cover(card):
    """Full-bleed photo; the headline sits on the photo's lower middle, higher than any body card's (checker: moved)."""
    with Image.open(OUT / 'scenes/ads-1.png') as src:
        im = ImageOps.fit(src.convert('RGB'), (W, H), method=Image.Resampling.LANCZOS, centering=(.1, .3))
    scrim = Image.new('L', (W, H), 0); sd = ImageDraw.Draw(scrim)
    for yy in range(470, H): sd.line((0, yy, W, yy), fill=round(255 * min(1, (yy - 470) / 200) * .66))
    im.paste(Image.new('RGB', (W, H), (6, 10, 12)), (0, 0), scrim)
    lg = white_logo(46); im.paste(lg, ((W - lg.width) // 2, 584), lg)
    parts = [['FREE CHATGPT', 'HAS ADS NOW.'], ['SWITCHING THEM', 'OFF COSTS YOU.']]
    first, second = card['headline'].split('. ', 1)
    assert ' '.join(parts[0]) == first.upper() + '.' and ' '.join(parts[1]) == second.upper().rstrip('.') + '.'
    f = R.font(112); y = 646
    for lines, color in zip(parts, [CREAM, MINT]):
        R.draw_lines(im, lines, f, y, color, 112 * .93); y += len(lines) * 112 * .93
    sf = R.font(42, 'SemiBold'); R.draw_lines(im, R.wrap(card['line'], sf), sf, y + 14, CREAM, 48)
    return im

def phone_scene():
    """Card 2: OpenAI's own help-page screenshot (the ad under an answer), set in a rounded frame on a dark blur of itself."""
    with Image.open(OUT / 'scenes/ads-2-real.png') as src:
        src = src.convert('RGB')
        bg = ImageOps.fit(src, (W, 720), method=Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(34))
        bg = Image.blend(bg, Image.new('RGB', bg.size, INK), .78)
        ph = src.crop((188, 296, 458, 524)); hh = 548; s = hh / ph.height
        ph = ph.resize((round(ph.width * s), hh), Image.Resampling.LANCZOS)
    im = Image.new('RGB', (W, H), INK); im.paste(bg, (0, 0))
    m = Image.new('L', (W, 720), 0); d = ImageDraw.Draw(m)
    for y in range(120, 720): d.line((0, y, W, y), fill=0)
    fade = Image.new('L', (W, 720)); fd = ImageDraw.Draw(fade)
    for y in range(720): fd.line((0, y, W, y), fill=round(255 * max(0, min(1, (y - 520) / 200))))
    im.paste(Image.new('RGB', (W, 720), INK), (0, 0), fade)
    x0, y0 = (W - ph.width) // 2, 84
    mask = Image.new('L', ph.size, 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, ph.width - 1, ph.height - 1), 34, fill=255)
    glow = Image.new('RGB', (ph.width + 80, ph.height + 80), MINT); gm = Image.new('L', glow.size, 0)
    ImageDraw.Draw(gm).rounded_rectangle((40, 40, glow.width - 40, glow.height - 40), 40, fill=70)
    im.paste(glow, (x0 - 40, y0 - 40), gm.filter(ImageFilter.GaussianBlur(26)))
    im.paste(ph, (x0, y0), mask)
    return im

BRIGHT = {6: 1.7, 8: 1.9, 3: 1.0}
CENTRE = {5: .78}
def scene(n, height, fade):
    im = Image.new('RGB', (W, H), INK)
    with Image.open(OUT / 'scenes' / f'ads-{n}.png') as src:
        sc = ImageOps.fit(src.convert('RGB'), (W, height), method=Image.Resampling.LANCZOS, centering=(.5, CENTRE.get(n, .5)))
    if n in BRIGHT: sc = ImageEnhance.Brightness(sc).enhance(BRIGHT[n]); sc = ImageEnhance.Contrast(sc).enhance(1.12)
    im.paste(sc, (0, 0)); m = Image.new('L', (W, fade)); d = ImageDraw.Draw(m)
    for y in range(fade): d.line((0, y, W, y), fill=round(255 * y / (fade - 1)))
    im.paste(Image.new('RGB', (W, fade), INK), (0, height - fade), m)
    return im

def balanced_lines(d, f, words, width):
    def fit(wd):
        lines, cur = [], []
        for w in words:
            if cur and d.textlength(' '.join(cur + [w]), font=f) > wd: lines.append(cur); cur = [w]
            else: cur.append(w)
        lines.append(cur); return lines
    base = fit(width); wd = width
    while wd > 400 and len(fit(wd - 12)) == len(base): wd -= 12
    return fit(wd)

def body_b(im, kicker, sentence, key, top, bottom, size=78, lead=82):
    from PIL import ImageFont
    d = ImageDraw.Draw(im)
    kf = ImageFont.truetype(str(FONTS / 'IBMPlexMono-SemiBold.ttf'), 50)
    f = ImageFont.truetype(str(FONTS / 'Anton-Regular.ttf'), size)
    words = sentence.upper().split(); kt = key.upper().split(); kw = set()
    for i in range(len(words) - len(kt) + 1):
        if [w.strip('.,') for w in words[i:i + len(kt)]] == [w.strip('.,') for w in kt]: kw = set(range(i, i + len(kt))); break
    idx = list(range(len(words)))
    lines = balanced_lines(d, f, idx, 900) if False else None
    def fitw(wd):
        out, cur = [], []
        for i in idx:
            if cur and d.textlength(' '.join(words[j] for j in cur + [i]), font=f) > wd: out.append(cur); cur = [i]
            else: cur.append(i)
        out.append(cur); return out
    lines = fitw(900); wd = 900
    while wd > 420 and len(fitw(wd - 12)) == len(lines): wd -= 12
    lines = fitw(wd)
    if len(lines) > 5 and size > 60: return body_b(im, kicker, sentence, key, top, bottom, size - 4, lead - 4)
    block = 112 + len(lines) * lead; y = top + max(0, (bottom - top - block) / 2)
    kwid = d.textlength(kicker, font=kf); d.text(((W - kwid) / 2, y), kicker, font=kf, fill=MINT)
    d.line([((W - 64) / 2, y + 84), ((W + 64) / 2, y + 84)], fill=MINT, width=4); y += 112
    for ln in lines:
        txt = ' '.join(words[j] for j in ln); bx = f.getbbox(txt); x = (W - (bx[2] - bx[0])) / 2 - bx[0]
        for j in ln:
            d.text((x, y), words[j], font=f, fill=MINT if j in kw else CREAM); x += d.textlength(words[j] + ' ', font=f)
        y += lead
    return im

KICK = {2: 'WHAT HAPPENED', 3: 'WHY', 4: 'THE BIGGER PICTURE', 5: 'THE TRAP', 6: 'THE SWITCH', 7: 'THE WORKAROUND'}
KEY = {2: 'a labelled ad', 3: 'ads help pay', 4: 'paying its way the same way', 5: 'can still show ads',
       6: 'fewer daily messages and no image creation', 7: 'does not create memories'}
def body(n, card):
    im = phone_scene() if n == 2 else scene(n, 640, 130)
    return body_b(im, KICK[n], card['headline'], KEY[n], top=690 if n == 2 else 650, bottom=1235)

def follow_foot2(im, y):
    """'Follow for more' in the house display face (Anton, caps, mint), the wordmark centred directly under it."""
    d = ImageDraw.Draw(im); f = R.font(70); t = 'FOLLOW FOR MORE'; bx = f.getbbox(t)
    d.text(((W - (bx[2] - bx[0])) / 2 - bx[0], y - bx[1]), t, font=f, fill=MINT)
    y += (bx[3] - bx[1]) + 34
    wm = Image.open(OUT / 'brand/wordmark.png').convert('RGBA'); wm = wm.crop(wm.getbbox())
    wm = wm.resize((440, round(wm.height * 440 / wm.width)), Image.Resampling.LANCZOS)
    im.paste(wm, ((W - 440) // 2, round(y)), wm)

def close(card):
    im = scene(8, 740, 120)
    f = R.font(66); words = card['headline'].upper().split()
    lines, cur = [], []
    for w in words:
        if cur and f.getlength(' '.join(cur + [w])) > 900: lines.append(cur); cur = [w]
        else: cur.append(w)
    lines.append(cur)
    def fitc(wd):
        out, cc = [], []
        for w in words:
            if cc and f.getlength(' '.join(cc + [w])) > wd: out.append(cc); cc = [w]
            else: cc.append(w)
        out.append(cc); return out
    wd = 900
    while wd > 500 and len(fitc(wd - 10)) == len(lines): wd -= 10
    lines = fitc(wd)
    lead = 72; total = (len(lines) - 1) * lead + 66 + 40 + 70 + 34 + 52
    y = 800; d = ImageDraw.Draw(im); mint = False
    for ln in lines:
        txt = ' '.join(ln); bx = f.getbbox(txt); x = (W - (bx[2] - bx[0])) / 2 - bx[0]
        for w in ln:
            if w == 'ADS,': mint = True
            d.text((round(x), round(y) - bx[1]), w, font=f, fill=MINT if mint else CREAM)
            if w == 'LIMITS,': mint = False
            x += f.getlength(w + ' ')
        y += lead
    follow_foot2(im, y + 30)
    return im

if __name__ == '__main__':
    n_cards = len(DECK['cards']); assert n_cards == 8
    for n, card in enumerate(DECK['cards'], 1):
        im = cover(card) if n == 1 else close(card) if n == n_cards else body(n, card)
        if n != n_cards: mark(im)
        im.save(OUT / f'card-{n}.png')
    print('rendered', n_cards)
