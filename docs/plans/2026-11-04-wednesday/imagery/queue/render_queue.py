"""Renders The Queue mock (queue.html): two stills and the motion test, frame by frame at 30 fps.
Run from the repository root: python3 docs/plans/2026-11-04-wednesday/imagery/queue/render_queue.py"""
import glob, os, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
FPS, SECONDS = 30, 6.5
exe = os.environ.get('PLAYWRIGHT_CHROMIUM_PATH') or next(iter(sorted(glob.glob('/opt/pw-browsers/chromium-*/chrome-linux*/chrome'))), None)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=exe, args=['--allow-file-access-from-files']) if exe else p.chromium.launch()
    pg = b.new_page(viewport={'width': 1920, 'height': 1080})
    pg.goto((HERE / 'queue.html').as_uri()); pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(800)
    for name, t in (('queue-plate-mock-waiting', 2.9), ('queue-plate-mock-yes', 3.75)):
        pg.evaluate(f'render({t})'); pg.screenshot(path=str(HERE / f'{name}.png')); print('wrote', name)
    out = HERE.parent / 'motion-test-queue.mp4'
    enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'image2pipe', '-framerate', str(FPS), '-i', '-',
                            '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', '-movflags', '+faststart', str(out)],
                           stdin=subprocess.PIPE)
    for i in range(int(FPS * SECONDS)):
        pg.evaluate(f'render({i / FPS})')
        enc.stdin.write(pg.screenshot(type='png'))
    enc.stdin.close(); enc.wait(); b.close()
    print('wrote', out)
