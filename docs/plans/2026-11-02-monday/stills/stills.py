"""Draws Monday 2 November's two lead-picture stills (series picture and story object) at 1920x1080, in the brand's
type and colours, beside a frame of his long take. Run from the repository root:
    python3 docs/plans/2026-11-02-monday/stills/stills.py"""
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
FONTS = (HERE / '../../../../assets/fonts/makeyourmindup').resolve()
FACE = (HERE / 'face-long.jpg').resolve()
BASE = f"""
@font-face{{font-family:Anton;src:url('file://{FONTS}/Anton-Regular.ttf')}}
@font-face{{font-family:Archivo;src:url('file://{FONTS}/Archivo-Variable.ttf')}}
@font-face{{font-family:Plex;src:url('file://{FONTS}/IBMPlexMono-Medium.ttf')}}
html,body{{margin:0;width:1920px;height:1080px;background:#0C1512;color:#F4EFE4;overflow:hidden}}
.face{{position:absolute;left:0;top:0;width:608px;height:1080px;background:url('file://{FACE}') center/cover}}
.stage{{position:absolute;left:608px;top:0;right:0;bottom:0}}
.mark{{position:absolute;right:56px;top:44px;font:900 30px Archivo;letter-spacing:.5px}}
.pill{{position:absolute;left:660px;top:44px;font:500 22px Plex;color:#0C1512;background:#FFD84D;padding:6px 14px;border-radius:999px}}
.credit{{position:absolute;left:96px;bottom:56px;font:500 22px Plex;color:#a9b4ae;letter-spacing:1px}}
"""
LADDER = """
<div class=face></div><div class=pill>follow.the.money</div><div class=mark>makeyourmindup</div>
<div class=stage><svg width=1312 height=1080 viewBox="0 0 1312 1080">
 <g stroke="#F4EFE4" stroke-width="10" stroke-linecap="round" fill="none">
  <line x1="470" y1="120" x2="470" y2="930"/><line x1="790" y1="120" x2="790" y2="930"/>
  <line x1="470" y1="200" x2="790" y2="200"/><line x1="470" y1="350" x2="790" y2="350"/>
  <line x1="470" y1="500" x2="790" y2="500"/><line x1="470" y1="650" x2="790" y2="650"/>
 </g>
 <line x1="470" y1="860" x2="790" y2="860" stroke="#F4EFE4" stroke-width="3" stroke-dasharray="6 14" opacity=".45"/>
 <text x="630" y="178" text-anchor="middle" font-family="Anton" font-size="44" fill="#7EF0C0">2030</text>
 <text x="900" y="890" font-family="Anton" font-size="150" fill="#F4EFE4">9%</text>
 <text x="900" y="760" font-family="Anton" font-size="70" fill="#5b625e" text-decoration="line-through">27%</text>
 <rect x="900" y="905" width="200" height="10" fill="#FFD84D"/>
</svg></div>
<div class=credit style="left:704px">JUNIOR SHARE OF TECHNICAL HIRES · ANTHROPIC · OCT 2026</div>
"""
MONEYMAP = """
<div class=face></div><div class=pill>follow.the.money</div><div class=mark>makeyourmindup</div>
<div class=stage><svg width=1312 height=1080 viewBox="0 0 1312 1080">
 <text x="96" y="276" font-family="Archivo" font-weight="900" font-size="34" fill="#F4EFE4">NEW TECHNICAL</text><text x="96" y="318" font-family="Archivo" font-weight="900" font-size="34" fill="#F4EFE4">HIRES</text>
 <path d="M420 290 C 640 290, 640 420, 860 420" stroke="#F4EFE4" stroke-width="109" fill="none" opacity=".9"/>
 <path d="M420 290 C 640 290, 640 700, 860 700" stroke="#FFD84D" stroke-width="11" fill="none"/>
 <text x="890" y="434" font-family="Archivo" font-weight="900" font-size="34" fill="#F4EFE4">SENIOR HIRES</text>
 <text x="890" y="690" font-family="Archivo" font-weight="900" font-size="34" fill="#FFD84D">JUNIORS</text>
 <text x="890" y="800" font-family="Anton" font-size="84" fill="#F4EFE4">9%</text>
 <text x="1040" y="800" font-family="Anton" font-size="44" fill="#5b625e" text-decoration="line-through">27%</text>
</svg></div>
<div class=credit style="left:704px">JUNIOR SHARE OF TECHNICAL HIRES · ANTHROPIC · OCT 2026</div>
"""
with sync_playwright() as p:
    import os, glob; exe = os.environ.get('PLAYWRIGHT_CHROMIUM_PATH') or next(iter(sorted(glob.glob('/opt/pw-browsers/chromium-*/chrome-linux*/chrome'))), None); b = p.chromium.launch(executable_path=exe) if exe else p.chromium.launch(); pg = b.new_page(viewport={'width': 1920, 'height': 1080})
    for name, body in (('story-object', LADDER), ('series-picture', MONEYMAP)):
        page = HERE / f'.{name}.html'
        page.write_text(f'<!doctype html><meta charset=utf-8><style>{BASE}</style>{body}', encoding='utf-8')
        pg.goto(page.as_uri()); pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(600)
        pg.screenshot(path=str(HERE / f'{name}.png')); print('wrote', HERE / f'{name}.png')
    b.close()
