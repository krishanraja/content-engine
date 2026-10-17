"""Tall panels for Friday's 90-second cut: real captures, cropped to the passage he is talking about, ringed in mint,
the page outside the ring laid under ink, placed by kit.page_panel. One-off for 17 Oct (the long cut's cards are
1600x900 and too small in the tall frame)."""
import json, sys
sys.path.insert(0, 'scripts/quick-edit')
from pathlib import Path
from PIL import Image, ImageDraw
import kit, brand
V = Path('docs/plans/2026-10-09-friday/video-pictures')
OUT = Path('.cache/produce/2026-10-16-904658db/kit/panels')
BOX = kit.panel_box('9x16')
INK, MINT = (12, 21, 18), None
RING, EDGE, SHADE, PAD, MARGIN, GAP = 6, 2, 0.38, 10, 32, 30

def part(img, crop, marks=()):
    im = Image.open(V / img).convert('RGB')
    x, y, w, h = crop
    bg = im.getpixel((max(0, x - 4), max(0, y - 4)))
    c = Image.new('RGB', (w + 2 * MARGIN, h + 2 * MARGIN), bg)
    c.paste(im.crop((x, y, x + w, y + h)), (MARGIN, MARGIN))
    ms = []
    for m in marks:
        p = m[4] if len(m) > 4 else PAD
        ms.append((m[0] - x + MARGIN - p, m[1] - y + MARGIN - p, m[2] + 2 * p, m[3] + 2 * p))
    return c, ms, bg

def compose(parts, mint):
    ps = [part(*p) for p in parts]
    W = max(c.width for c, _, _ in ps)
    H = sum(c.height for c, _, _ in ps) + GAP * (len(ps) - 1)
    bg = ps[0][2]
    sheet = Image.new('RGB', (W, H), bg)
    marks, cuts, y = [], [], 0
    for i, (c, ms, b) in enumerate(ps):
        sheet.paste(c, (0, y))
        marks += [(mx, my + y, mw, mh) for mx, my, mw, mh in ms]
        if i < len(ps) - 1:
            cuts.append(y + c.height + GAP // 2)
        y += c.height + GAP
    s = min(BOX[0] / W, BOX[1] / H, 1.0)
    out = sheet.resize((round(W * s), round(H * s)), Image.LANCZOS)
    if marks:
        shade = Image.new('RGB', out.size, INK)
        mask = Image.new('L', out.size, round(255 * SHADE))
        d = ImageDraw.Draw(mask)
        for mx, my, mw, mh in marks:
            d.rectangle([mx * s, my * s, (mx + mw) * s, (my + mh) * s], fill=0)
        out = Image.composite(shade, out, mask)
    d = ImageDraw.Draw(out)
    for cy in cuts:
        yy = round(cy * s)
        for xx in range(0, out.width, 28):
            d.line([(xx, yy), (xx + 14, yy)], fill=(150, 150, 140), width=3)
    for mx, my, mw, mh in marks:
        box = [mx * s, my * s, (mx + mw) * s, (my + mh) * s]
        d.rounded_rectangle([box[0] - RING - EDGE, box[1] - RING - EDGE, box[2] + RING + EDGE, box[3] + RING + EDGE], radius=14, outline=INK, width=EDGE)
        d.rounded_rectangle([box[0] - RING, box[1] - RING, box[2] + RING, box[3] + RING], radius=12, outline=mint, width=RING)
    return out, {'size': list(out.size), 'background': '#{:02X}{:02X}{:02X}'.format(*bg), 'scale': round(s, 3)}

PANELS = json.load(open(sys.argv[1]))
st = kit.style_for('mind_the_gap')
mint = tuple(int(st['mint'].lstrip('#')[i:i + 2], 16) for i in (0, 2, 4)) if 'mint' in st else (110, 231, 183)
fonts = brand.font_css()
dr = kit.Drawer()
try:
    for name, parts in PANELS.items():
        pic, facts = compose(parts, mint)
        bad = dr.shoot(kit.page_panel(st, '9x16', pic, facts, fonts), kit.PANEL['9x16'], OUT / f'{name}-9x16.png')
        print(name, facts, bad or 'fits')
finally:
    dr.close()
