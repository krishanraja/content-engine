"""Composes single frames of the proof at the given times (seconds) into one contact sheet. Run from the repository root:
    python3 docs/plans/2026-11-02-monday/proof/stills.py OUT.jpg T [T ...]"""
import sys, io, glob, subprocess
sys.path.insert(0, 'docs/plans/2026-11-02-monday/proof')
import compose as C
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
out, ts = sys.argv[1], [float(x) for x in sys.argv[2:]]
exe = sorted(glob.glob('/opt/pw-browsers/chromium-*/chrome-linux*/chrome'))[0]
tiles = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=exe); bg = b.new_page(viewport={'width': 1920, 'height': 1080}); fg = b.new_page(viewport={'width': 1920, 'height': 1080})
    bg.goto((C.HERE / 'scene.html').as_uri() + '?layer=bg'); fg.goto((C.HERE / 'scene.html').as_uri() + '?layer=fg')
    for pg in (bg, fg): pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(800)
    for t in ts:
        bg.evaluate(f'render({t})'); fg.evaluate(f'render({t})')
        base = Image.open(io.BytesIO(bg.screenshot(type='png'))).convert('RGB')
        lay = C.layout(t)
        if lay:
            raw = subprocess.run([C.FF, '-v', 'error', '-ss', str(t - C.OFF), '-i', str(C.TAKE), '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
            fr = np.frombuffer(raw, np.uint8).reshape(1920, 1080, 3); cx, s, a = lay
            base.paste(C.face_tile(fr, s), (round(cx - C.COLW / 2), 0))
        top = Image.open(io.BytesIO(fg.screenshot(type='png', omit_background=True))).convert('RGBA')
        tiles.append(Image.alpha_composite(base.convert('RGBA'), top).convert('RGB').resize((640, 360)))
    b.close()
cols = 3; sheet = Image.new('RGB', (640 * cols, 360 * ((len(tiles) + cols - 1) // cols)))
for i, t in enumerate(tiles): sheet.paste(t, ((i % cols) * 640, (i // cols) * 360))
sheet.save(out, quality=80)
