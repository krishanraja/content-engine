"""Monday 2 November's two thumbnails (1280x720 for the 5-minute cut, 1080x1920 for the 90-second one): his approved
headshot (brand.PORTRAITS, never a frame from a take: F23) beside the ladder with no bottom rung, and the words he picked. The words are never baked in here: Krish
rejected the first titles round (31 Oct), so they come in as an argument once he has picked again.

    python docs/plans/2026-11-02-monday/video/thumbnails.py --words "THE WORDS HE PICKED"

Krish, 2026-11-02, of a frame grabbed from the take: "absolutely fucking awful headshot ... It looks ridiculous."
Writes .cache/produce/2026-11-02-9a0c97af/thumbs/thumb-16x9.jpg and thumb-9x16.jpg. Run from the repository root.
"""
import argparse
import glob
import html
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
WORK = ROOT / '.cache/produce/2026-11-02-9a0c97af'
OUT = WORK / 'thumbs'
FONTS = ROOT / 'assets/fonts/makeyourmindup'
sys.path.insert(0, str(ROOT / 'scripts/pages'))
import brand  # noqa: E402

LADDER = '''<svg viewBox="0 -175 400 875" style="position:absolute;{pos}">
 <g stroke="#F4EFE4" stroke-width="16" stroke-linecap="round"><line x1="80" y1="20" x2="80" y2="680"/><line x1="320" y1="20" x2="320" y2="680"/>
 <line x1="80" y1="110" x2="320" y2="110"/><line x1="80" y1="230" x2="320" y2="230"/><line x1="80" y1="350" x2="320" y2="350"/><line x1="80" y1="470" x2="320" y2="470"/></g>
 <line x1="96" y1="600" x2="304" y2="600" stroke="#F4EFE4" stroke-width="4" stroke-dasharray="12 18" opacity=".5"/>
 <text x="200" y="-14" text-anchor="middle" font-family="Anton" font-size="120" fill="#7EF0C0">2030</text></svg>'''


def page(w, h, words, tall):
    """No face (Krish, 2026-11-02: headshots come off). The words, the ladder with no bottom rung, and the number."""
    css = f"""@font-face{{font-family:Anton;src:url('{(FONTS / 'Anton-Regular.ttf').as_uri()}')}}
    @font-face{{font-family:Plex;src:url('{(FONTS / 'IBMPlexMono-Medium.ttf').as_uri()}')}}
    html,body{{margin:0;width:{w}px;height:{h}px;background:#0C1512;overflow:hidden}}
    .words{{position:absolute;{'left:70px;right:70px;top:170px' if tall else 'left:64px;right:470px;top:120px'};font-family:Anton;color:#F4EFE4;
      font-size:{150 if tall else 112}px;line-height:1.0;text-transform:uppercase}}
    .words span{{text-decoration:underline;text-decoration-color:#FFD84D;text-decoration-thickness:.09em;text-underline-offset:.08em}}
    .stat{{position:absolute;{'left:70px;top:900px' if tall else 'left:64px;bottom:150px'};font-family:Anton;font-size:{120 if tall else 84}px;color:#0C1512;background:#FFD84D;padding:4px 26px;line-height:1.1}}
    .what{{position:absolute;{'left:70px;right:70px;top:1060px' if tall else 'left:64px;bottom:100px'};font:500 {40 if tall else 30}px Plex;color:#F4EFE4}}
    .pill{{position:absolute;{'left:70px;top:60px' if tall else 'left:64px;top:40px'};font:500 {50 if tall else 44}px Plex;background:#FFD84D;color:#0C1512;padding:6px 18px;border-radius:999px}}"""
    ladder = LADDER.format(pos='left:420px;top:1220px;height:470px' if tall else 'right:60px;top:70px;height:600px')
    return (f'<!doctype html><meta charset=utf-8><style>{css}</style>{ladder}<div class=words><span>{html.escape(words)}</span></div>'
            '<div class=stat>27% &rarr; 9%</div><div class=what>junior share of Anthropic\'s new tech hires</div><div class=pill>follow.the.money</div>')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--words', required=True, help='the thumbnail words Krish picked, exactly')
    a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    from playwright.sync_api import sync_playwright
    exe = next(iter(sorted(glob.glob('/opt/pw-browsers/chromium-*/chrome-linux*/chrome'))), None)
    jobs = [('16x9', 1280, 720, False), ('9x16', 1080, 1920, True)]
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()
        for shape, w, h, tall in jobs:
            src = OUT / f'thumb-{shape}.html'
            src.write_text(page(w, h, a.words, tall), encoding='utf-8')
            pg = b.new_page(viewport={'width': w, 'height': h})
            pg.goto(src.as_uri()); pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(400)
            pg.screenshot(path=str(OUT / f'thumb-{shape}.jpg'), type='jpeg', quality=90)
            print('wrote', OUT / f'thumb-{shape}.jpg')
        b.close()


if __name__ == '__main__':
    main()
