#!/usr/bin/env python3
"""Renders Wednesday 4 Nov's drawn panels (scenes.html) frame by frame at 30 fps into .cache/produce/.../panels.

Every event time is seconds from the start of the beat, read off his take (takes/<cut>.words.json): a move lands on
the word that names it. Each panel runs one second past its beat so a picture never loops back to its start.

    python3 docs/plans/2026-11-04-wednesday/video/scenes.py [ID ...]
"""
import glob
import os
import subprocess
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
PANELS = ROOT / '.cache/produce/2026-11-04-b63d2507/panels'
PAGES = HERE.parent / 'imagery/pages'
FPS = 30
L, T = (1314, 1080), (1080, 1000)


def page(img):
    """The page's height over width, and where its mint mark sits (0..1 down the page)."""
    im = np.asarray(Image.open(PAGES / img).convert('RGB')).astype(int)
    mint = (abs(im[..., 0] - 126) < 40) & (abs(im[..., 1] - 240) < 30) & (abs(im[..., 2] - 192) < 40)
    rows = np.where(mint.sum(1) > 20)[0]
    cols = np.where(mint.sum(0) > 3)[0]
    fy = float(rows.mean() / im.shape[0]) if len(rows) else 0.3
    fx = float(cols.min() / im.shape[1]) if len(cols) else 0.3   # the line's left edge, so its words read from the left
    return {'img': img, 'ratio': im.shape[0] / im.shape[1], 'fy': fy, 'fx': fx}


# id: (scene, size, seconds of the beat, params)
PANELS_SPEC = {
    'l04-logos': ('logos', L, 6.6, {}),
    'l06-stops': ('stops', L, 10.2, {'ats': [1.3, 1.8, 2.7, 3.1], 'off': 6.5}),
    'l08-carries': ('doc', L, 4.7, {**page('duet-carries-over.png')}),
    'l12-microsoft': ('doc', L, 8.3, {**page('help-microsoft.png'), 'logo': 'microsoft-365.svg', 'logoAt': 1.9,
                                      'label': 'MICROSOFT 365 · NOT YET', 'labAt': 2.4}),
    'l21-tool': ('tool', L, 11.8, {'fold': 4.0, 'uses': [7.0, 7.7, 8.1]}),
    'l22-today': ('today', L, 9.4, {'ats': [5.8, 6.9, 7.7], 'ask': 8.7}),
    'l23-duet': ('duet', L, 5.3, {'first': 1.1, 'yes': 3.8}),
    'l24-reddit': ('reddit', L, 10.0, {'mark': 7.2}),
    'l25-hours': ('hours', L, 10.8, {'roll': 5.4}),
    'l27-vo': ('doc', L, 4.3, {**page('claire-vo-review.png')}),
    'l29-limits': ('doc', L, 7.7, {**page('help-limits.png'), 'bar': 3.5}),
    'l30-plans': ('plans', L, 10.0, {'ats': [1.2, 1.6, 4.5, 4.8]}),
    'l32-it': ('it', L, 16.8, {'move': 3.0, 'decide': 11.8}),
    'l34-steps': ('steps', L, 7.5, {'items': [{'n': 1, 'kind': 'fire', 'at': 0.0}, {'n': 2, 'kind': 'wire', 'at': 4.8}]}),
    'l35-steps': ('steps', L, 9.9, {'items': [{'n': 3, 'kind': 'week', 'at': 0.0, 'yes': 2.5}, {'n': 4, 'kind': 'usage', 'at': 4.8, 'fill': 6.0}]}),
    's01-open': ('open', T, 9.3, {'ask': 3.4}),
    's06-email': ('email', T, 7.0, {'bills': 4.5, 'ms': 5.3}),
    's12-doit': ('doit', T, 4.1, {}),
    's04-stops': ('stops', T, 5.0, {'ats': [1.9, 3.2, 2.3, None], 'off': 3.8}),
    's09-limits': ('doc', T, 3.2, {**page('help-limits.png'), 'bar': 1.5}),
    's11-tool': ('tool', T, 7.1, {'fold': 2.5, 'uses': [5.0, 5.5, 6.0]}),
    's13-steps': ('steps', T, 8.2, {'items': [{'n': 1, 'kind': 'fire', 'at': 0.0}, {'n': 2, 'kind': 'draft', 'at': 3.0, 'yes': 5.9}]}),
}


def render(pid):
    from playwright.sync_api import sync_playwright
    import json
    scene, (w, h), secs, params = PANELS_SPEC[pid]
    n = int(round((secs + 1.0) * FPS))
    params = {**params, 'T': secs, 'tall': w < h or h < 1080}
    PANELS.mkdir(parents=True, exist_ok=True)
    out = PANELS / f'{pid}-{"16x9" if (w, h) == L else "9x16"}.mp4'
    exe = os.environ.get('PLAYWRIGHT_CHROMIUM_PATH') or next(iter(sorted(glob.glob('/opt/pw-browsers/chromium-*/chrome-linux*/chrome'))), None)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=exe, args=['--allow-file-access-from-files'])
        pg = b.new_page(viewport={'width': w, 'height': h})
        pg.goto((HERE / 'scenes.html').as_uri() + f'?w={w}&h={h}')
        pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(400)
        pg.evaluate(f'show({json.dumps(scene)}, {json.dumps(params)})')
        pg.evaluate('render(0)'); pg.wait_for_timeout(500)   # logos and pages decoded before the first frame
        enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'image2pipe', '-framerate', str(FPS), '-i', '-',
                                '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-preset', 'medium', str(out)], stdin=subprocess.PIPE)
        for i in range(n):
            pg.evaluate(f'render({i / FPS})')
            enc.stdin.write(pg.screenshot(type='jpeg', quality=94))
        enc.stdin.close(); enc.wait(); b.close()
    return f'{out.name} {n} frames'


if __name__ == '__main__':
    ids = [a for a in sys.argv[1:] if not a.startswith('--')] or list(PANELS_SPEC)
    with ProcessPoolExecutor(int(os.environ.get('JOBS', 3))) as pool:
        for r in pool.map(render, ids):
            print(r, flush=True)
