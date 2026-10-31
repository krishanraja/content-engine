"""Monday 2 November's two thumbnails (1280x720 for the 5-minute cut, 1080x1920 for the 90-second one): his face from
the take beside the ladder with no bottom rung, and the words he picked. The words are never baked in here: Krish
rejected the first titles round (31 Oct), so they come in as an argument once he has picked again.

    python docs/plans/2026-11-02-monday/video/thumbnails.py --words "THE WORDS HE PICKED" [--at 31] [--short-at 12]

--at / --short-at: the second of each take the face is taken from (a frame where his eyes are open, to look at first).
Writes .cache/produce/2026-11-02-9a0c97af/thumbs/thumb-16x9.jpg and thumb-9x16.jpg. Run from the repository root.
"""
import argparse
import glob
import html
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
WORK = ROOT / '.cache/produce/2026-11-02-9a0c97af'
OUT = WORK / 'thumbs'
FONTS = ROOT / 'assets/fonts/makeyourmindup'

LADDER = '''<svg viewBox="0 0 400 700" style="position:absolute;{pos}">
 <g stroke="#F4EFE4" stroke-width="16" stroke-linecap="round"><line x1="80" y1="20" x2="80" y2="680"/><line x1="320" y1="20" x2="320" y2="680"/>
 <line x1="80" y1="110" x2="320" y2="110"/><line x1="80" y1="230" x2="320" y2="230"/><line x1="80" y1="350" x2="320" y2="350"/><line x1="80" y1="470" x2="320" y2="470"/></g>
 <line x1="96" y1="600" x2="304" y2="600" stroke="#F4EFE4" stroke-width="4" stroke-dasharray="12 18" opacity=".5"/>
 <text x="200" y="85" text-anchor="middle" font-family="Anton" font-size="62" fill="#7EF0C0">2030</text></svg>'''


def page(w, h, face, words, tall):
    css = f"""@font-face{{font-family:Anton;src:url('{(FONTS / 'Anton-Regular.ttf').as_uri()}')}}
    @font-face{{font-family:Plex;src:url('{(FONTS / 'IBMPlexMono-Medium.ttf').as_uri()}')}}
    html,body{{margin:0;width:{w}px;height:{h}px;background:#0C1512;overflow:hidden}}
    .face{{position:absolute;{'left:0;right:0;bottom:0;height:62%' if tall else 'left:0;top:0;bottom:0;width:46%'};background:url('{face.as_uri()}') center 25%/cover}}
    .words{{position:absolute;{'left:60px;right:340px;top:110px' if tall else 'left:49%;right:40px;top:70px'};font-family:Anton;color:#F4EFE4;
      font-size:{124 if tall else 104}px;line-height:.98;text-transform:uppercase}}
    .words span{{text-decoration:underline;text-decoration-color:#FFD84D;text-decoration-thickness:.09em;text-underline-offset:.08em}}
    .pill{{position:absolute;{'left:60px;top:40px' if tall else 'left:49%;bottom:44px'};font:500 {34 if tall else 26}px Plex;background:#FFD84D;color:#0C1512;padding:6px 16px;border-radius:999px}}"""
    ladder = LADDER.format(pos='right:50px;top:90px;height:560px' if tall else 'right:40px;bottom:30px;height:56%')
    return f'<!doctype html><meta charset=utf-8><style>{css}</style><div class=face></div>{ladder}<div class=words><span>{html.escape(words)}</span></div><div class=pill>follow.the.money</div>'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--words', required=True, help='the thumbnail words Krish picked, exactly')
    ap.add_argument('--at', type=float, default=31.0)
    ap.add_argument('--short-at', type=float, default=12.0)
    a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    from playwright.sync_api import sync_playwright
    exe = next(iter(sorted(glob.glob('/opt/pw-browsers/chromium-*/chrome-linux*/chrome'))), None)
    jobs = [('16x9', 1280, 720, WORK / 'takes/long-cfr.mp4', a.at, False), ('9x16', 1080, 1920, WORK / 'takes/short-cfr.mp4', a.short_at, True)]
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()
        for shape, w, h, take, at, tall in jobs:
            face = OUT / f'face-{shape}.jpg'
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(at), '-i', str(take), '-frames:v', '1', '-q:v', '2', str(face)], check=True)
            src = OUT / f'thumb-{shape}.html'
            src.write_text(page(w, h, face, a.words, tall), encoding='utf-8')
            pg = b.new_page(viewport={'width': w, 'height': h})
            pg.goto(src.as_uri()); pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(400)
            pg.screenshot(path=str(OUT / f'thumb-{shape}.jpg'), type='jpeg', quality=90)
            print('wrote', OUT / f'thumb-{shape}.jpg')
        b.close()


if __name__ == '__main__':
    main()
