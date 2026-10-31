#!/usr/bin/env python3
"""Wednesday 4 Nov's two thumbnails (16:9 1280x720 for YouTube and Substack, 9:16 1080x1920 for Reels and Shorts):
his face from the take beside the Claude mark, with the thumbnail words Krish picked, in the brand's dress.

The words are a parameter, never baked in: Krish rejected the first titles on 31 Oct, so nothing is drawn until main
passes the words he picks (title_check.py records the pick; --words must be that line).

    python3 docs/plans/2026-11-04-wednesday/video/thumbs.py --words "THE WORDS HE PICKED" [--face-at SECONDS] [--loud WORD]
"""
import argparse
import subprocess
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
WORK = ROOT / '.cache/produce/2026-11-04-b63d2507'
FONTS = ROOT / 'assets/fonts/makeyourmindup'
CLAUDE = HERE.parent / 'imagery/logos/claude.svg'
INK, CREAM, MINT, LILAC = (12, 21, 18), (244, 239, 228), (126, 240, 192), (183, 166, 255)


def face(at):
    take = WORK / 'takes/long-stable.mp4'
    if not take.exists():
        take = WORK / 'takes/long-cfr.mp4'
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(at), '-i', str(take), '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'],
                         capture_output=True, check=True).stdout
    return Image.open(BytesIO(raw)).convert('RGB')


def claude_mark(size):
    from playwright.sync_api import sync_playwright
    import glob
    exe = sorted(glob.glob('/opt/pw-browsers/chromium-*/chrome-linux*/chrome'))[0]
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=exe, args=['--allow-file-access-from-files']); pg = b.new_page(viewport={'width': size, 'height': size})
        page = WORK / '.mark.html'
        page.write_text(f'<body style="margin:0;background:transparent"><img src="{CLAUDE.as_uri()}" style="width:{size}px;height:{size}px">')
        pg.goto(page.as_uri()); pg.wait_for_timeout(300)
        png = pg.screenshot(omit_background=True); b.close(); page.unlink()
    return Image.open(BytesIO(png)).convert('RGBA')


def wrap(d, words, font, width):
    lines, cur = [], ''
    for w in words.split():
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=font) <= width or not cur:
            cur = t
        else:
            lines.append(cur); cur = w
    return lines + [cur]


def dress(img, k):
    d = ImageDraw.Draw(img)
    anton = ImageFont.truetype(str(FONTS / 'Anton-Regular.ttf'), int(44 * k))
    mono = ImageFont.truetype(str(FONTS / 'IBMPlexMono-Medium.ttf'), int(24 * k))
    x, y = int(40 * k), int(34 * k)
    for part, col in (('make', CREAM), ('your', MINT), ('mind', CREAM), ('up', MINT)):
        d.text((x, y), part, font=anton, fill=col); x += d.textlength(part, font=anton)
    label = 'under.the.hood'; tw = d.textlength(label, font=mono)
    x1, y0 = img.width - int(40 * k), int(40 * k)
    d.rounded_rectangle((x1 - tw - 32 * k, y0, x1, y0 + 44 * k), radius=int(22 * k), fill=LILAC)
    d.text((x1 - tw - 16 * k, y0 + 7 * k), label, font=mono, fill=INK)


def words_block(img, words, loud, box, size):
    d = ImageDraw.Draw(img)
    x0, y0, w = box
    while True:
        font = ImageFont.truetype(str(FONTS / 'Anton-Regular.ttf'), size)
        lines = wrap(d, words.upper(), font, w)
        if len(lines) <= 4 or size < 40:
            break
        size -= 6
    y = y0
    for line in lines:
        x = x0
        for word in line.split():
            col = MINT if loud and word.strip('.,?!') == loud.upper() else CREAM
            d.text((x + 5, y + 6), word, font=font, fill=INK)          # a hard shadow, not a glow
            d.text((x, y), word, font=font, fill=col)
            x += d.textlength(word + ' ', font=font)
        y += int(size * 1.02)


def wide(words, loud, at):
    W, H = 1280, 720
    img = Image.new('RGB', (W, H), INK)
    f = face(at)                                               # his portrait take, 1080x1920
    f = f.crop((0, 120, 1080, 120 + 1080)).resize((720, 720), Image.LANCZOS)
    img.paste(f, (W - 720, 0))
    shade = Image.linear_gradient('L').rotate(90).resize((260, H))   # ink fades into his picture
    img.paste(Image.new('RGB', (260, H), INK), (W - 720, 0), shade)
    mark = claude_mark(150)
    img.paste(mark, (W - 720 - 40, H - 190), mark)
    words_block(img, words, loud, (48, 170, 560), 132)
    dress(img, 1.0)
    return img


def tall(words, loud, at):
    W, H = 1080, 1920
    img = face(at).resize((W, H), Image.LANCZOS)
    veil = Image.new('RGB', (W, H), INK)
    mask = Image.linear_gradient('L').resize((W, H)).point(lambda v: int(max(0, 235 - v * 1.4)))   # ink at the top, his face clear below
    img.paste(veil, (0, 0), mask)
    mark = claude_mark(170)
    img.paste(mark, (W - 230, 760), mark)
    words_block(img, words, loud, (64, 190, 950), 200)
    dress(img, 1.5)
    return img


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--words', required=True, help='the thumbnail words Krish picked, exactly')
    ap.add_argument('--loud', help='one word in mint')
    ap.add_argument('--face-at', type=float, default=11.0, help='seconds into the long take for his face')
    a = ap.parse_args()
    out = WORK / 'thumbs'; out.mkdir(parents=True, exist_ok=True)
    for name, fn in (('thumb-wide-1280x720.jpg', wide), ('thumb-tall-1080x1920.jpg', tall)):
        im = fn(a.words, a.loud, a.face_at)
        im.save(out / name, quality=90)
        assert (out / name).stat().st_size < 2 * 1024 * 1024, 'YouTube refuses a thumbnail over 2 MB'
        print('wrote', out / name)
