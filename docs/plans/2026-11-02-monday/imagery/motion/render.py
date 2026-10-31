"""Renders ladder.html frame by frame (30 fps) and lays it over the take's portrait column with his voice.
Run from this folder: python3 render.py"""
import glob, os, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
HERE = Path(__file__).resolve().parent
TAKE = HERE.parents[4] / '.cache/recordings/Fri 30 Oct - 5-minute - Documentary VO draft.mp4'
FPS, START, DUR = 30, 20.0, 16.2
frames = HERE / '.frames'; frames.mkdir(exist_ok=True)
exe = sorted(glob.glob('/opt/pw-browsers/chromium-*/chrome-linux*/chrome'))[0]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=exe); pg = b.new_page(viewport={'width': 1920, 'height': 1080})
    pg.goto((HERE / 'ladder.html').as_uri()); pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(500)
    for i in range(int(DUR * FPS)):
        pg.evaluate(f'render({i / FPS})')
        pg.screenshot(path=str(frames / f'{i:04d}.png'), omit_background=True)
    b.close()
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(START), '-t', str(DUR), '-i', str(TAKE),
    '-framerate', str(FPS), '-i', str(frames / '%04d.png'),
    '-filter_complex', f'color=c=0x0C1512:s=1920x1080:r={FPS}[bg];[0:v]fps={FPS},scale=608:1080,setsar=1[face];'
                       '[bg][face]overlay=0:0:shortest=1[base];[base][1:v]overlay=0:0:shortest=1,format=yuv420p[v]',
    '-map', '[v]', '-map', '0:a', '-c:v', 'libx264', '-crf', '22', '-preset', 'medium', '-c:a', 'aac', '-b:a', '160k',
    '-shortest', str(HERE / 'ladder-motion-test.mp4')], check=True)
for f in frames.glob('*.png'): f.unlink()
frames.rmdir()
print('wrote', HERE / 'ladder-motion-test.mp4')
