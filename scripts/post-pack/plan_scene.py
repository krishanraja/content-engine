#!/usr/bin/env python3
"""plan_scene: one mocked scene of a production plan, drawn from a real still in the picked styles, for Krish to see
before the cut is made.

Krish, 2026-11-17: "The UI should also have mocked up 2 or 3 scenes using my real content stills using the visual styles
I selected, and give me the final opportunity to switch something out if it does not work".

    python3 scripts/post-pack/plan_scene.py --frame TAKE.mp4 --at 12.4 --caption "Blame the computer" --mark computer \
        --series mind_the_gap --placement lower --face anton --out .scratch/plan/scene-b3.png
    python3 scripts/post-pack/plan_scene.py --image SOURCE.jpg ... --out ...
    python3 scripts/post-pack/plan_scene.py --self-test

The still is real: a frame of his take (--frame, --at seconds) or a real photo, screenshot or post image saved from its
source (--image, a file; keep its link in the plan). Nothing here generates a picture. The scene is 1080 x 1920, the
still filling it, the caption in a house face (Anton, Archivo, Fraunces, Plex Mono) in the house white with at most one
marked word in the series' colour (config/caption-themes.json: follow.the.money #FFD84D, under.the.hood #B7A6FF,
mind.the.gap #FF6A4D, an off-day post house mint #7EF0C0), inside the tall core box (config/brand-palette.json safe).
It is a mock of the look, not a frame of the cut: ve draws the real one.

The scene follows what he picked and what the beat is (Krish, 2026-11-18: "it does not seem to matter what motion, look and
captions I chose [...] it always gives me the same 3 crappy mock ups of just me with some same same off brand captions"):

    --captions art-directed   the caption style's own layout (config/caption-themes.json rules): cream Anton, the key word
                              alone at 168 px and the rest at 92, hung left from one fixed corner, the phrase before
                              dimmed above it (--prev), a soft shadow and no box or colour
    --kind motion --stage "$195,000" [--strike fraction]
                              a motion-design beat: the statement slammed onto the stage over his frame (the ai-music-slam
                              slab, tilted, in the series colour), the struck word with a line through it
    --kind generated|real_image|screenshot|social_post|logo|humour --plate "what the picture is"
                              a beat that is not his face: his frame held back and a labelled plate saying what the picture
                              is and who makes it. A generated scene is never faked here (nothing is generated for a mock,
                              and a generation spends credits only with his yes): the plate says so, and the production
                              session shows the real still before anything moves (Krish, 2026-11-18, step 6 of the prompt).

    --made-still FILE         a generated beat whose still was really made (a generation within the credits he approved,
                              priced first, never made by this script): the made still fills the scene at its own shape and
                              the caption style he picked goes over it, labelled as generated in the notes

A style this file does not draw (a look, or a caption style with no layout here) is said on the scene (`--note`) and
printed, never passed off as drawn.
"""
import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FONTS = ROOT / 'assets' / 'fonts' / 'makeyourmindup'
FACES = {'anton': 'Anton-Regular.ttf', 'archivo': 'Archivo-Variable.ttf', 'fraunces': 'Fraunces-Upright-Variable.ttf',
         'mono': 'IBMPlexMono-Bold.ttf'}
ACCENT = {'follow_the_money': '#FFD84D', 'under_the_hood': '#B7A6FF', 'mind_the_gap': '#FF6A4D', 'off': '#7EF0C0'}
W, H = 1080, 1920
# The tall core box every critical word stays inside (the platform UI covers the edges).
SAFE = (90, 260, W - 150, H - 420)
PLACES = {'upper': 0.22, 'middle': 0.5, 'lower': 0.72}


def frame_of(take, at, out):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{float(at):.3f}', '-i', str(take), '-frames:v', '1', str(out)], check=True)
    return out


def cover(img):
    from PIL import Image
    s = max(W / img.width, H / img.height)
    img = img.convert('RGB').resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    x, y = (img.width - W) // 2, (img.height - H) // 2
    return img.crop((x, y, x + W, y + H))


def wrap(draw, words, font, width):
    lines, line = [], []
    for w in words:
        trial = ' '.join(line + [w])
        if line and draw.textlength(trial, font=font) > width:
            lines.append(line)
            line = [w]
        else:
            line.append(w)
    if line:
        lines.append(line)
    return lines


def scene_caption(base, caption, mark=None, series='off', placement='lower', face='anton', size=96, upper=True):
    from PIL import Image, ImageDraw, ImageFont
    base = base.convert('RGB')
    # A soft shade behind the words so they read on any still.
    shade = Image.new('L', (W, H), 0)
    top = int(H * PLACES[placement]) - 260
    ImageDraw.Draw(shade).rectangle((0, max(0, top), W, min(H, top + 520)), fill=130)
    base = Image.composite(Image.new('RGB', (W, H), '#0B0B0F'), base, shade)
    draw = ImageDraw.Draw(base)
    font = ImageFont.truetype(str(FONTS / FACES[face]), size)
    text = caption.upper() if upper and face == 'anton' else caption
    lines = wrap(draw, text.split(), font, SAFE[2] - SAFE[0])
    lh = int(size * 1.12)
    y = int(H * PLACES[placement]) - lh * len(lines) // 2
    y = max(SAFE[1], min(y, SAFE[3] - lh * len(lines)))
    marked = (mark or '').strip().lower()
    for line in lines:
        x = (W - draw.textlength(' '.join(line), font=font)) / 2
        for w in line:
            hit = marked and w.strip('.,!?"\'').lower() == marked
            draw.text((x, y), w, font=font, fill=ACCENT.get(series, ACCENT['off']) if hit else '#FFFFFF',
                      stroke_width=4, stroke_fill='#0B0B0F')
            x += draw.textlength(w + ' ', font=font)
        y += lh
    return base



CREAM = '#F4EBD9'
INK = '#0B0B0F'
# Caption styles this file draws a layout for; any other is the house caption, and the scene says so.
DRAWN_CAPTIONS = ('art-directed',)
# Motion styles this file draws a statement for; any other motion style is not drawn.
DRAWN_MOTION = ('ai-music-slam',)
KIND_WORDS = {'face': 'You on camera', 'logo': 'Logo or wordmark', 'real_image': 'Real photo or footage', 'screenshot': 'Screenshot of the real page',
              'social_post': 'A real social post', 'motion': 'Motion design', 'generated': 'Generated scene', 'humour': 'A gag'}


def key_word(words, mark):
    """The word that gets its own row: the marked one, else the longest."""
    clean = [w.strip('.,!?"\'').lower() for w in words]
    if mark and mark.strip().lower() in clean:
        return clean.index(mark.strip().lower())
    return max(range(len(words)), key=lambda i: len(clean[i]))


def art_directed(base, caption, mark=None, prev=None):
    """The art-directed caption layout (config/caption-themes.json art-directed): cream Anton capitals, no box, pill,
    underline or colour; the phrase laid out whole and hung left-aligned from one fixed corner; the key word alone on its
    row at 168 px, the rest at 92 px; the phrase before dimmed above; a soft shadow."""
    from PIL import Image, ImageDraw, ImageFilter, ImageFont
    big = ImageFont.truetype(str(FONTS / FACES['anton']), 168)
    small = ImageFont.truetype(str(FONTS / FACES['anton']), 92)
    words = caption.upper().split()
    if not words:
        return base
    k = key_word(words, mark.upper() if mark else None)
    # One phrase at a time, as the style shows it: at most six words, the key word inside.
    if len(words) > 6:
        start = max(0, min(k - 3, len(words) - 6))
        words, k = words[start:start + 6], k - start
    rows = []  # (text, font, fill)
    scratch = ImageDraw.Draw(Image.new('L', (W, H)))
    for part, font in ((words[:k], small), (words[k:k + 1], big), (words[k + 1:], small)):
        if part:
            for line in wrap(scratch, part, font, SAFE[2] - SAFE[0]):
                rows.append((' '.join(line), font, CREAM))
    if prev:
        for line in wrap(scratch, prev.upper().split(), small, SAFE[2] - SAFE[0])[-1:]:
            rows.insert(0, (' '.join(line), small, '#8F897C'))
    heights = [int(f.size * 1.08) for _, f, _ in rows]
    total = sum(heights)
    left, top = SAFE[0], max(SAFE[1], min(int(H * 0.68), SAFE[3] - total))
    shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    y = top
    for (text, font, _), h in zip(rows, heights):
        sd.text((left + 4, y + 6), text, font=font, fill=(0, 0, 0, 170))
        y += h
    base = Image.alpha_composite(base.convert('RGBA'), shadow.filter(ImageFilter.GaussianBlur(10)))
    draw = ImageDraw.Draw(base)
    y = top
    for (text, font, fill), h in zip(rows, heights):
        draw.text((left, y), text, font=font, fill=fill)
        y += h
    return base.convert('RGB')


def slam(base, stage, strike=None, series='off'):
    """A motion-design beat in the ai-music-slam style: the statement slammed onto the stage in a tilted slab of the series
    colour, above his frame, the struck word with a line through it. Drawn upper, so his face stays in the lower half."""
    from PIL import Image, ImageDraw, ImageFont
    accent = ACCENT.get(series, ACCENT['off'])
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    # The whole statement always fits: the type steps down until it is four lines or fewer, never cut.
    for fs in (150, 130, 112, 96, 84, 72):
        font = ImageFont.truetype(str(FONTS / FACES['anton']), fs)
        lines = wrap(ld, stage.upper().split(), font, SAFE[2] - SAFE[0] - 80)
        if len(lines) <= 4:
            break
    lh = int(fs * 1.1)
    box_h = lh * len(lines) + 70
    top = SAFE[1]
    ld.rectangle((SAFE[0] - 30, top, SAFE[2] + 30, top + box_h), fill=accent)
    y = top + 35
    struck = (strike or '').strip().upper()
    for line in lines:
        x = SAFE[0] + 10
        for w in line:
            ld.text((x, y), w, font=font, fill=INK)
            width = ld.textlength(w, font=font)
            if struck and w.strip('.,!?"\'').upper() == struck:
                ld.line((x - 6, y + int(fs * 0.62), x + width + 6, y + int(fs * 0.62)), fill=INK, width=max(8, fs // 11))
            x += ld.textlength(w + ' ', font=font)
        y += lh
    layer = layer.rotate(3, resample=Image.BICUBIC, center=(W // 2, top + box_h // 2))
    return Image.alpha_composite(base.convert('RGBA'), layer).convert('RGB')


def plate(base, kind, text, maker=None, series='off'):
    """A beat that is not his face: his frame held back, and a labelled plate saying what the picture is and who makes it.
    Never a fake of the picture itself (nothing is generated for a mock)."""
    from PIL import Image, ImageDraw, ImageFilter, ImageFont
    base = Image.blend(base.convert('RGB').filter(ImageFilter.GaussianBlur(14)), Image.new('RGB', (W, H), INK), 0.55)
    draw = ImageDraw.Draw(base)
    accent = ACCENT.get(series, ACCENT['off'])
    label = ImageFont.truetype(str(FONTS / FACES['mono']), 40)
    body = ImageFont.truetype(str(FONTS / FACES['archivo']), 64)
    x0, x1 = SAFE[0], SAFE[2]
    lines = wrap(draw, text.split(), body, x1 - x0 - 80)[:9]
    maker_lines = wrap(draw, maker.split(), label, x1 - x0 - 80)[:3] if maker else []
    h = 140 + 82 * len(lines) + (24 + 50 * len(maker_lines) if maker_lines else 0)
    top = max(SAFE[1], (H - h) // 2 - 80)
    draw.rounded_rectangle((x0, top, x1, top + h), radius=36, outline=accent, width=6, fill='#14141B')
    draw.text((x0 + 40, top + 36), (KIND_WORDS.get(kind, kind) or kind).upper(), font=label, fill=accent)
    y = top + 120
    for line in lines:
        draw.text((x0 + 40, y), ' '.join(line), font=body, fill='#FFFFFF')
        y += 82
    for line in maker_lines:
        draw.text((x0 + 40, y + 14), ' '.join(line), font=label, fill='#8F897C')
        y += 50
    return base


def scene_for(still, caption, mark=None, series='off', placement='lower', face='anton', size=96, captions=None, kind='face',
              stage=None, strike=None, plate_text=None, maker=None, prev=None, motion=None, made=False):
    """One scene as the beat is: what the picture is, then the caption style he picked over it. Returns (image, notes), the
    notes naming every style that was asked for and is not drawn here."""
    notes = []
    if made:
        # A really made still (never drawn here): it fills the scene, with his caption style over it.
        img = cover(still)
        notes.append('the picture is a generated still, made for this plan')
        if caption:
            img = art_directed(img, caption, mark, prev) if captions == 'art-directed' else scene_caption(img, caption, mark, series, placement, face, size)
        if captions and captions not in ('art-directed', 'house'):
            notes.append(f'caption style {captions} is not drawn here: the house caption is shown')
        return img, notes
    if kind == 'motion' and stage:
        img = slam(cover(still), stage, strike, series)
        if motion and motion not in DRAWN_MOTION:
            notes.append(f'motion style {motion} is not drawn here: the statement is drawn in the slam style')
    elif kind not in ('face', 'motion') and plate_text:
        img = plate(cover(still), kind, plate_text, maker, series)
    else:
        img = cover(still)
        if kind == 'motion':
            notes.append('no statement was given for this motion beat: his frame is shown')
    if kind in ('face', 'motion') or not plate_text:
        if captions == 'art-directed':
            img = art_directed(img, caption, mark, prev) if caption else img
        else:
            if captions and captions not in ('house', None):
                notes.append(f'caption style {captions} is not drawn here: the house caption is shown')
            if caption:
                img = scene_caption(img, caption, mark, series, placement, face, size)
    return img, notes


def scene(still, caption, mark=None, series='off', placement='lower', face='anton', size=96, upper=True):
    """The house scene: his still with the house caption (kept for callers and the self-test)."""
    return scene_caption(cover(still), caption, mark, series, placement, face, size, upper)


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    src = p.add_mutually_exclusive_group()
    src.add_argument('--frame', help='his take, to take a frame of')
    src.add_argument('--image', help='a real still: a file, or the https link of the image at its source')
    p.add_argument('--at', type=float, default=0.0)
    p.add_argument('--caption', default='')
    p.add_argument('--mark')
    p.add_argument('--series', default='off', choices=sorted(ACCENT))
    p.add_argument('--placement', default='lower', choices=sorted(PLACES))
    p.add_argument('--face', default='anton', choices=sorted(FACES))
    p.add_argument('--size', type=int, default=96)
    p.add_argument('--captions', help='the caption style he picked (art-directed draws its own layout; any other is the house caption)')
    p.add_argument('--motion', help='the motion style he picked (ai-music-slam draws its statement)')
    p.add_argument('--kind', default='face', choices=sorted(KIND_WORDS), help='what the beat\'s picture is')
    p.add_argument('--stage', help='a motion beat: the statement slammed onto the stage')
    p.add_argument('--strike', help='a word of the statement drawn struck through')
    p.add_argument('--plate', help='a beat that is not his face: what the picture is, in words')
    p.add_argument('--maker', help='who makes that picture (for the plate)')
    p.add_argument('--made-still', action='store_true', help='--image is a really generated still for this beat: fill the scene with it')
    p.add_argument('--prev', help='the caption before this one (art-directed shows it dimmed above)')
    p.add_argument('--out')
    p.add_argument('--notes-out', help='write the styles asked for and not drawn here to this JSON file')
    p.add_argument('--self-test', action='store_true')
    a = p.parse_args(argv)
    from PIL import Image
    if a.self_test:
        img = scene(Image.new('RGB', (1920, 1080), '#335577'), 'Blame the computer and see what happens', mark='computer',
                    series='mind_the_gap')
        assert img.size == (W, H)
        assert img.getpixel((W // 2, 40)) != (11, 11, 15)
        # The marked word is drawn in the series colour somewhere on the frame.
        assert (255, 106, 77) in {img.getpixel((x, y)) for x in range(0, W, 3) for y in range(900, 1800, 3)}
        still = Image.new('RGB', (1920, 1080), '#335577')
        # Each picked style draws something different from the house scene on the same still and words.
        house, _ = scene_for(still, 'Blame the computer and see what happens', 'computer', 'mind_the_gap')
        art, n1 = scene_for(still, 'Blame the computer and see what happens', 'computer', 'mind_the_gap', captions='art-directed')
        assert n1 == [] and art.tobytes() != house.tobytes()
        # Art-directed has no colour on its words: the series colour is nowhere in the lower half.
        assert (255, 106, 77) not in {art.getpixel((x, y)) for x in range(0, W, 3) for y in range(900, 1800, 3)}
        mo, n2 = scene_for(still, 'It just helped', None, 'mind_the_gap', kind='motion', stage='$195,000 hospital bill', strike='bill', motion='ai-music-slam')
        assert n2 == [] and (255, 106, 77) in {mo.getpixel((x, y)) for x in range(0, W, 3) for y in range(300, 900, 3)}
        pl, _ = scene_for(still, 'x', kind='generated', plate_text='An endless warehouse of dusty archive boxes', maker='Generated', series='mind_the_gap')
        assert pl.tobytes() not in (house.tobytes(), mo.tobytes())
        # A style not drawn here is said, never passed off.
        _, n3 = scene_for(still, 'Blame it', captions='karaoke', motion=None)
        assert n3 and 'karaoke' in n3[0]
        _, n4 = scene_for(still, 'x', kind='motion', stage='A statement', motion='mystery-style')
        assert n4 and 'mystery-style' in n4[0]
        mk, n5 = scene_for(still, 'x is on the shelf', 'shelf', 'mind_the_gap', captions='art-directed', kind='generated', made=True)
        assert n5 and 'generated still' in n5[0] and mk.tobytes() != art.tobytes()
        print('plan_scene self-test: ok')
        return 0
    if not a.out or not (a.frame or a.image):
        p.error('--out and one of --frame or --image are required')
    with tempfile.TemporaryDirectory() as tmp:
        if a.frame:
            path = frame_of(a.frame, a.at, Path(tmp) / 'frame.png')
        elif a.image.startswith('https://'):
            import urllib.request
            path = Path(tmp) / 'source'
            req = urllib.request.Request(a.image, headers={'User-Agent': 'content-engine plan_scene'})
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read(25 * 1024 * 1024 + 1)
            if len(data) > 25 * 1024 * 1024:
                raise SystemExit('plan_scene: the image is over 25 MB')
            path.write_bytes(data)
        else:
            path = Path(a.image)
        img, notes = scene_for(Image.open(path), a.caption, a.mark, a.series, a.placement, a.face, a.size, a.captions, a.kind,
                               a.stage, a.strike, a.plate, a.maker, a.prev, a.motion, a.made_still)
    for n in notes:
        print(f'plan_scene: {n}', file=sys.stderr)
    if a.notes_out:
        Path(a.notes_out).write_text(json.dumps(notes))
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    img.save(a.out, 'PNG')
    print(a.out)
    return 0


if __name__ == '__main__':
    sys.exit(main())
