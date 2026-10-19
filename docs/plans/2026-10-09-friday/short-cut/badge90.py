"""The badge card for Friday's 90-second cut: the real Mercedes-Benz star beside Claude's real logo, on the words
"Opus 5.5 is like Mercedes C-Class" (Krish, 19 Oct: "add the real car badges"). Framed like every tall panel."""
import sys, base64
sys.path.insert(0, 'scripts/quick-edit')
from pathlib import Path
import kit, brand
from PIL import Image
L = Path('docs/plans/2026-10-09-friday/logos')
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else '.cache/produce/2026-10-16-904658db/kit/panels')
OUT.mkdir(parents=True, exist_ok=True)
st = kit.style_for('mind_the_gap')
fonts = brand.font_css()
svg = lambda f: 'data:image/svg+xml;base64,' + base64.b64encode((L / f).read_bytes()).decode()
W, H = 1500, 780
sheet = f"""<!doctype html><html><head><style>{fonts}
html,body{{margin:0;width:{W}px;height:{H}px;background:#0C1512;color:#F4EFE6;font-family:Archivo,sans-serif}}
.k{{position:absolute;top:60px;width:100%;text-align:center;font:600 34px 'IBM Plex Mono',monospace;letter-spacing:6px;color:#7EF0C0}}
.row{{position:absolute;top:170px;left:0;width:100%;display:flex;justify-content:center;align-items:center;gap:70px}}
.b{{display:flex;flex-direction:column;align-items:center;gap:34px;width:520px}}
.b img{{height:300px}} .n{{font:900 54px Archivo;text-align:center;line-height:1.05;white-space:nowrap}} .t{{font:600 30px 'IBM Plex Mono';color:#9FB0A8;letter-spacing:3px}}
.eq{{font:400 170px Anton;color:#7EF0C0;margin-top:-90px}}
</style></head><body><div class="k">THE NAME IS THE BADGE</div><div class="row">
<div class="b"><img src="{svg('mercedes-cream.svg')}"><div class="n">Mercedes C‑Class</div><div class="t">THE CAR'S BADGE</div></div>
<div class="eq">=</div>
<div class="b"><img src="{svg('anthropic-symbol-cream.svg')}"><div class="n">Claude Opus 5.5</div><div class="t">THE AI'S BADGE</div></div>
</div></body></html>"""
dr = kit.Drawer()
try:
    pic = OUT / 'fri90-mercedes-sheet.png'
    bad = dr.shoot(sheet, (W, H), pic)
    print('sheet', bad or 'fits')
    out = OUT / 'fri90-mercedes-9x16.png'
    box = kit.panel_box('9x16')
    im = Image.open(pic).convert('RGB')
    sc = min(box[0] / im.width, box[1] / im.height, 1.0)
    im = im.resize((round(im.width * sc), round(im.height * sc)), Image.LANCZOS)
    bad = dr.shoot(kit.page_panel(st, '9x16', im, {'size': list(im.size), 'background': '#0C1512'}, fonts), kit.PANEL['9x16'], out)
    print(out, bad or 'fits')
finally:
    dr.close()
