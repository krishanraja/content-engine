"""Painted scene (series skin "painted_scene", concept c12): each weekly series stands in its own painted world, and the Receipt is pinned on it.

One family on Mon, Wed and Fri: the generated still for the day (config/series-art.json, no words in it) is
the full-bleed ground, placed per shape so its hero shows where the Receipt does not cover it (CROP), and graded
so the world is in the series colour, all inside the card's own background (nothing is laid over the words):
- the grade (TONE stops) replaces the still's own colour outright, with no blend back over the original: its grey
  is flattened (broad light taken out), stretched by percentiles, then mapped through a few colour stops mixed in
  linear light. The shadows are the true house ink (#0C1512) up to a steep knee; past it the tone rises fast to
  the series colour at full saturation and on toward cream for the glints. There is almost no dark-colour band,
  because a darkened butter is olive and a darkened coral is brown. Wednesday's fog alone has a third stop, a deep
  violet ink, so the lilac engine floats in a violet void rather than charcoal. Butter and ink, lilac and ink,
  coral and ink: three render styles become one printed family. Friday's tone is two reads in one (core): the
  rock, its pitting taken out by a median and a blur, its contrast lowered and laid on a curve that keeps most of
  it a dark coral-ink and only its lit plates near the coral, with the plates' lit rims kept as thin coral lines;
  and the crack, a mask read from its glow (saturation-weighted brightness) and feathered, so its edge is the
  glow's own jagged contour, never a straight side. Inside the crack the tone is a ramp across its width: full
  coral at its walls, rising toward cream only on a narrow centre line. Where a glow the grade cannot tell from
  the hero sits by the words (the vault's back wall and the scratches beside the tag, the band under the headline,
  the crack's upper run, the vault and the engine round the wordmark plate, the rock round the tag and under the
  frame's offset block) it is hushed to ink by box (TONE_SHAPE hush), or laid flat at one tone (calm: Wednesday's
  fog under the headline and round the plate);
- the only darkening is an ink scrim where the words sit (multiplied at .95, then .8 laid flat over that, so at
  full strength it is the house ink with a whisper of the world in it). Tall: full from the top edge to just above
  the headline's foot, then a short eased fall that is clear by 100px under it, so the world shows in the gap
  between the headline and the proof, in both side gutters and under the proof. Wide: a column, full house ink
  from 12px left of the headline to the right edge, easing to clear by 152px left of the headline, from the top
  edge to 6px under the foot of the headline's highlight, then easing clear over 70px (the corner between the two
  falls is an elliptical fade that meets both), so the world falls into shadow behind the headline, the pill and
  the wordmark, shows whole round the proof, and shows along the bottom edge under the headline as it does in the
  gap on the tall covers. PLACE_JS measures the laid-out headline and sets both;
- one colour rule everywhere: the headline is cream, its highlight the series colour with ink words; the tag and
  the pill are the series colour with ink words; the frame's hard offset block is the series colour. Where a
  ground under one of them would melt into it, the crop is moved, never the element recoloured;
- the old brand's film grain (fractal noise, contrast-stretched, soft-light) sits over the whole ground and shows
  as grain on the ink fields too;
- the proof floats: its white frame, the hard offset block and a long soft shadow that lifts it off the world.
follow.the.money stands in the open vault (tall: coin stacks and bars in both side gutters and under the proof,
with nothing bright above the wordmark or beside the tag; wide: recropped to the stacks of bars and coins, which
fill the left gutter and run under the frame and on under the headline, the grade evened more so each stack keeps
its own light, the rock round the tag and the wordmark plate on ink), under.the.hood in the exploded engine (tall: blown up 1.75x so its parts burst
out of both side gutters and fill the foot, with plain violet fog from the headline's foot to the tag's top;
wide: whole, spilling from behind the proof below the frame and down the left gutter, clear of the plate),
mind.the.gap at the glowing crack in red rock (tall: the still's lower third at its own size, the band under the
headline hushed to ink; the crack opens below the proof and narrows as it runs up toward the Receipt, between dark
plates, so it reads as a fissure the Receipt sits over; wide: the tall still unturned and small, so its crack runs
as one vertical fissure down the left gutter and under the frame, over the wide still's rock floor, which shows
under the headline; the crack is read only in that gutter, so the lit fog stays rock, and the rock is ink within
24px of the tag and under the frame's offset block, so neither sits on coral of its own colour).

"""
import json
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[3]
# The graded grounds, kept under the ignored .cache and keyed by the stills' own bytes as well as the grade.
CACHE = ROOT / '.cache' / 'series-skins' / 'painted_scene'
VERSION = 'r8'

# Where each still goes for each shape. zoom is over a plain cover fit. With 'src' and 'to', the point 'src' of the
# still (0 to 1 across and down) lands on card point 'to' (px), so a hero is placed by its own coordinates; any edge
# the still does not reach is its own blurred cover fit, feathered (or the house ink, with fill 'ink', where that
# edge lies under the ink panel and a blurred copy of the hero would ghost through). Without them, a plain cover
# crop centred on (fx, fy). flip mirrors the still first ('src' is read on the mirrored still); still names the
# other shape's still to use; rot turns it (degrees, counter-clockwise), and where the turned still leaves the card
# empty the grade holds it at ink, so a hero can be laid at an angle; base is a second placement laid first, where
# the first does not reach (Friday wide: the tall still's fissure over the wide still's rock floor).
CROP = {
    ('mon', 'tall'): {'zoom': 1.3, 'src': (.43, .5), 'to': (540, 960), 'flip': False},
    ('wed', 'tall'): {'zoom': 1.75, 'src': (.5, .64), 'to': (540, 1450), 'flip': False},
    ('fri', 'tall'): {'zoom': 1.0, 'src': (.55, .8), 'to': (594, 1690), 'fill': 'ink'},
    ('mon', 'wide'): {'zoom': 1.2, 'src': (0, .25), 'to': (0, 190)},
    ('wed', 'wide'): {'zoom': .95, 'src': (.277, .5), 'to': (330, 470), 'flip': False},
    ('fri', 'wide'): {'still': 'tall', 'zoom': .58, 'src': (415 / 752, 590 / 1344), 'to': (46, 235),
                      'base': {'zoom': 1.0, 'fx': .5, 'fy': .5}},
}

# The grade. flat takes out that share of the broad light (a heavy blur of the grey image) and puts back an even
# level, so a glowing corner or a fog gradient becomes an even tone while the detail stays; plo and phi are the
# percentiles of the grey that map to 0 and 1 (auto levels). stops map that 0-to-1 tone to colour: (tone, base,
# share toward cream), base one of ink, deep (Wednesday's violet ink) or col (the series colour), mixed in linear
# light between stops. fog (Wednesday) evens only the fog's own light, read where the still is plain. Friday's rock:
# median and smooth take the pitting out, con lowers its contrast round the middle tone. Its core: rock (the rock's
# cap), rock_lo (its floor, just past the ink knee) and gamma (its curve); lo and hi (where the glow becomes the
# crack's mask), feather (its edge), wall (the crack's tone at its walls) and line (where across its half-width the
# centre line starts to rise toward cream); rims (blur radius, least lift, ramp, tone) keeps the plates' lit rims.
TONE = {
    'mon': {'flat': .25, 'level': .55, 'blur': 9, 'plo': 3, 'phi': 97,
            'stops': [(0, 'ink', 0), (.30, 'ink', 0), (.47, 'col', 0), (.80, 'col', .12), (1, 'col', .6)]},
    'wed': {'flat': .95, 'level': .22, 'blur': 6, 'plo': 2, 'phi': 97, 'fog': 3,
            'stops': [(0, 'ink', 0), (.06, 'ink', 0), (.14, 'deep', 0), (.30, 'deep', 0), (.55, 'col', 0),
                      (.85, 'col', .2), (1, 'col', .7)]},
    'fri': {'flat': .9, 'level': .55, 'blur': 30, 'plo': 2, 'phi': 98.5, 'median': 9, 'smooth': 3.5, 'con': .8,
            'core': {'rock': .66, 'rock_lo': .19, 'gamma': 2.6, 'from': .5, 'phi': 99.7, 'lo': .3, 'hi': .65, 'wall': .7, 'line': .35, 'line_soft': 3, 'feather': 3, 'reach': 70},
            'stops': [(0, 'ink', 0), (.2, 'ink', 0), (.64, 'col', 0), (.84, 'col', 0), (.93, 'col', .25), (1, 'col', .7)]},
}
# Per shape: where a glow the grade cannot tell from the hero must stay in shadow (hush, card px), or the world is
# laid flat at one tone (calm). Monday tall: the vault's back-wall light and the shelf under the tag; Monday wide and
# Friday wide: round the wordmark plate and the strip above the proof, so the logo sits on ink; Wednesday: plain
# violet fog from the headline's foot to the tag's top (tall) and round the plate (wide); Friday tall: the rock in
# the band under the headline, and the crack's whole run above the proof's foot, so it opens only below the proof.
# Monday tall also hushes the left edge beside the tag and the scratches under it; Monday wide the rock round the
# tag. Friday wide: ink round the plate and the pill strip, within 24px of the tag, at the top of the left gutter
# and under the offset block; core_box (card px) is where the crack is read at all.
TONE_SHAPE = {
    ('mon', 'tall'): {'hush': [(-40, 830, 1120, 1075, .25, 40), (-60, 900, 100, 1125, .08, 22), (60, 1000, 340, 1085, .08, 14)]},
    ('mon', 'wide'): {'flat': .75, 'blur': 14,
                      'hush': [(-40, -40, 500, 165, .2, 25), (-40, -40, 85, 210, .2, 25), (44, 125, 510, 320, .1, 12)]},
    ('wed', 'tall'): {'calm': [(-60, 700, 1140, 1045, .22, 25)]},
    ('wed', 'wide'): {'calm': [(-40, -40, 510, 175, .22, 22)]},
    ('fri', 'tall'): {'core': {'rims': (6, 16, 16, .66)}, 'hush': [(-60, 760, 1140, 1110, .04, 70), (360, -60, 820, 1100, .1, 20)]},
    ('fri', 'wide'): {'core_box': (-60, 200, 150, 800, 16), 'median': 3, 'smooth': 1.0,
                      'core': {'rock': .62, 'gamma': 2.6, 'lo': .5, 'hi': .8, 'feather': 1.5, 'line_soft': 1.5, 'soft': .8, 'reach': 40},
                      'hush': [(-40, -40, 500, 140, 0, 20), (440, -40, 760, 300, 0, 20), (28, 133, 513, 321, 0, 12),
                               (-60, 90, 100, 250, 0, 20), (115, 604, 676, 760, 0, 12)]},
}
DEEP = {'wed': '#25186A'}  # Wednesday's fog: a deep violet ink, never charcoal
# The size each design's placements (CROP's 'to', TONE_SHAPE's boxes) were drawn on: the two video thumbnails. A cover
# drawn in that design (skins.DESIGN) has them scaled to its own size, across and down (scaled()).
REF = {'tall': (1080, 1920), 'wide': (1280, 720)}


def scaled(c, tn, shape, W, H):
    """CROP's placement and TONE_SHAPE's boxes, in card px of the thumbnail they were drawn on, moved to a W x H card
    of the same design; unchanged on the thumbnail itself."""
    rw, rh = REF[shape]
    if (W, H) == (rw, rh):
        return c, tn
    sx, sy = W / rw, H / rh
    box = lambda b: (b[0] * sx, b[1] * sy, b[2] * sx, b[3] * sy, *b[4:])
    c = dict(c)
    if c.get('to'):
        c['to'] = (c['to'][0] * sx, c['to'][1] * sy)
    tn = dict(tn)
    for k in ('hush', 'calm', 'keep'):
        if tn.get(k):
            tn[k] = [box(b) for b in tn[k]]
    if tn.get('core_box'):
        tn['core_box'] = box(tn['core_box'])
    return c, tn

# The page colour behind everything (only seen if the still fails to load).
BASE = {'mon': '#0C1512', 'wed': '#0C1512', 'fri': '#0C1512'}
SCRIM = .95  # the ink scrim where the words sit, laid with multiply (the scene dimmed by the house ink)
VEIL = .8  # and a share of it laid flat over that, so the dark under the words is the house ink in every world
GRAIN = .8  # the film grain's opacity (soft-light, contrast-stretched): std about 13 on the ink (5%), its mean on the ink


def _lin(c):
    c = c / 255
    return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4


def _hex(h):
    return [int(h[i:i + 2], 16) for i in (1, 3, 5)]


def place(im, c, W, H, under=None):
    """The still placed on a W x H card as CROP says (over `under`, a W x H image, where it does not reach)."""
    import math
    from PIL import Image, ImageDraw, ImageFilter
    if c.get('flip'):
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    src = c.get('src')
    if c.get('rot'):
        # Turned rot degrees counter-clockwise on a canvas grown to hold it (its empty corners house ink, kept under
        # the ink panel); 'src' still names a point of the unturned still.
        w0, h0 = im.size
        im = im.rotate(c['rot'], resample=Image.BICUBIC, expand=True, fillcolor=(12, 21, 18))
        if src:
            t, dx, dy = math.radians(c['rot']), (src[0] - .5) * w0, (src[1] - .5) * h0
            src = ((dx * math.cos(t) + dy * math.sin(t)) / im.size[0] + .5,
                   (-dx * math.sin(t) + dy * math.cos(t)) / im.size[1] + .5)
    iw, ih = im.size
    s = max(W / iw, H / ih) * c['zoom']
    if not src:
        cw, chh = W / s, H / s
        cx = min(max(c['fx'] * iw, cw / 2), iw - cw / 2)
        cy = min(max(c['fy'] * ih, chh / 2), ih - chh / 2)
        return im.crop((round(cx - cw / 2), round(cy - chh / 2), round(cx + cw / 2), round(cy + chh / 2))).resize((W, H), Image.LANCZOS)
    ox = c['to'][0] - src[0] * iw * s
    oy = c['to'][1] - src[1] * ih * s
    # The part of the still that lands on the card, cut first so a big zoom never scales the whole still.
    l, t = max(0.0, -ox / s), max(0.0, -oy / s)
    r, b = min(float(iw), (W - ox) / s), min(float(ih), (H - oy) / s)
    part = im.crop((round(l), round(t), round(r), round(b)))
    px, py = round(ox + l * s), round(oy + t * s)
    pw, ph = max(1, round((r - l) * s)), max(1, round((b - t) * s))
    part = part.resize((pw, ph), Image.LANCZOS)
    if px <= 0 and py <= 0 and px + pw >= W and py + ph >= H:
        return part.crop((-px, -py, -px + W, -py + H))
    if under is not None:
        fill = under.copy()
    elif c.get('fill') == 'ink':
        fill = Image.new('RGB', (W, H), (12, 21, 18))
    else:
        fill = im.resize((W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(radius=70))
    feather = 48
    mask = Image.new('L', (pw, ph), 0)
    ImageDraw.Draw(mask).rectangle((0 if px <= 0 else feather, 0 if py <= 0 else feather,
                                    pw if px + pw >= W else pw - feather, ph if py + ph >= H else ph - feather), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(radius=feather / 2))
    fill.paste(part, (px, py), mask)
    return fill


def ground_image(day, shape, W, H, col, ink, kit):
    """The still placed, toned and printed in ink and the series colour for this shape, cached as a JPEG."""
    from PIL import Image, ImageFilter
    import numpy as np
    c = CROP[(day, shape)]
    tn = {**TONE[day], **TONE_SHAPE.get((day, shape), {})}
    if 'core' in TONE[day]:
        tn['core'] = {**TONE[day]['core'], **TONE_SHAPE.get((day, shape), {}).get('core', {})}
    c, tn = scaled(c, tn, shape, W, H)
    import hashlib
    stills = [kit.art('scene', day, c.get('still', shape))] + ([kit.art('scene', day, c['base'].get('still', shape))] if c.get('base') else [])
    digests = [hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in stills]
    key = hashlib.sha1(json.dumps([VERSION, W, H, col, ink, c, tn, DEEP.get(day), digests], sort_keys=True).encode()).hexdigest()[:16]
    out = CACHE / f'scene-{day}-{shape}-{key}.jpg'
    if out.exists():
        return out
    CACHE.mkdir(parents=True, exist_ok=True)
    src_im = Image.open(kit.art('scene', day, c.get('still', shape))).convert('RGB')
    under = None
    if c.get('base'):
        # A second still laid first, where the first does not reach (Friday wide: the wide still's rock floor right
        # of the tall still's fissure), so the two are graded as one ground.
        b0 = c['base']
        under = place(Image.open(kit.art('scene', day, b0.get('still', shape))).convert('RGB'), b0, W, H)
    im = place(src_im, c, W, H, under)
    # Where a turned still leaves its canvas empty, nothing of it may read as tone (the grade's evening would lift it).
    held = None
    if c.get('rot'):
        held = place(Image.new('RGB', src_im.size, (255, 255, 255)), {**c, 'fill': 'ink'}, W, H).convert('L')
        held = np.asarray(held.filter(ImageFilter.MinFilter(9)).filter(ImageFilter.GaussianBlur(radius=6)), dtype=np.float32) / 255
    im = im.filter(ImageFilter.UnsharpMask(radius=2, percent=55, threshold=2))

    # The grey of the still, its broad light flattened toward an even level, then stretched. chan 'max' reads the
    # brightest channel instead of the luminance, so a glow (the crack's coral) stands far above grey rock.
    arr = np.asarray(im).astype(np.float32)
    if tn.get('chan') == 'max':
        grey = Image.fromarray(arr.max(axis=2).astype(np.uint8), 'L')
    elif tn.get('chan') == 'glow':
        # The brightest channel weighted by how saturated it is: the crack's coral core reads far above the paler
        # horizon haze and the grey rock, while the rock's lit rims keep a little.
        mx, mn = arr.max(axis=2), arr.min(axis=2)
        w = tn.get('glow', .6)
        grey = Image.fromarray(np.clip((1 - w) * mx + w * (mx - mn) * 1.6, 0, 255).astype(np.uint8), 'L')
    else:
        grey = im.convert('L')
    if tn.get('median'):
        # Friday's rock: a median takes the pitting out of the plates and keeps their cracks and rims.
        grey = grey.filter(ImageFilter.MedianFilter(tn['median']))
    if tn.get('smooth'):
        grey = grey.filter(ImageFilter.GaussianBlur(radius=tn['smooth']))
    broad = grey.filter(ImageFilter.GaussianBlur(radius=max(W, H) / tn['blur']))
    g = np.asarray(grey, dtype=np.float32)
    b = np.asarray(broad, dtype=np.float32)
    if tn.get('fog'):
        # The fog's own light, read only where the still is plain (no parts in it), so the parts keep their shine:
        # the masked mean on a coarse grid, smoothed back up, is what gets evened out.
        fine = np.asarray(grey.filter(ImageFilter.GaussianBlur(radius=3)), dtype=np.float32)
        busy = Image.fromarray(np.clip(np.abs(g - fine) * 8, 0, 255).astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(radius=10))
        plain = (np.asarray(busy, dtype=np.float32) < tn['fog'] * 8).astype(np.float32)
        small = (max(2, W // 80), max(2, H // 80))
        num = np.asarray(Image.fromarray(g * plain, 'F').resize(small, Image.BOX))
        den = np.asarray(Image.fromarray(plain, 'F').resize(small, Image.BOX))
        ok = den > .05
        light = np.where(ok, num / np.maximum(den, 1e-6), 0).astype(np.float32)
        # Cells with no plain fog in them (inside the parts) take the mean of their known neighbours, ring by ring.
        while not ok.all():
            pad_l, pad_ok = np.pad(light, 1), np.pad(ok, 1).astype(np.float32)
            tot = sum(np.roll(np.roll(pad_l * pad_ok, dy, 0), dx, 1) for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)))[1:-1, 1:-1]
            cnt = sum(np.roll(np.roll(pad_ok, dy, 0), dx, 1) for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)))[1:-1, 1:-1]
            new = ~ok & (cnt > 0)
            light[new] = tot[new] / cnt[new]
            ok = ok | new
        b = np.asarray(Image.fromarray(light, 'F').resize((W, H), Image.BICUBIC), dtype=np.float32)
    v = g - tn['flat'] * (b - tn['level'] * 255)
    lo, hi = np.percentile(v, [tn['plo'], tn['phi']])
    k = np.clip((v - lo) / max(1.0, hi - lo), 0, 1)

    # A card-px box (x0, y0, x1, y1), feathered by fe: 1 inside, 0 outside.
    def box(x0, y0, x1, y1, fe):
        m = Image.new('L', (W, H), 0)
        from PIL import ImageDraw
        ImageDraw.Draw(m).rectangle((x0 + fe, y0 + fe, x1 - fe, y1 - fe), fill=255)
        return np.asarray(m.filter(ImageFilter.GaussianBlur(radius=fe)), dtype=np.float32) / 255

    if tn.get('con'):
        # Lower contrast round the middle tone, so the rock reads as plates and not as noise.
        mid = float(np.median(k))
        k = np.clip(mid + tn['con'] * (k - mid), 0, 1)
    if tn.get('lines'):
        # And the rock's thin lines put back at full strength: its cracks dark and its lit plate rims bright, read
        # as the grey less its own blur (after a small median, so single-pixel pitting stays out).
        r, gain = tn['lines']
        g0 = im.convert('L').filter(ImageFilter.MedianFilter(3))
        hp = np.asarray(g0, dtype=np.float32) - np.asarray(g0.filter(ImageFilter.GaussianBlur(radius=r)), dtype=np.float32)
        k = np.clip(k + gain * hp / 255, 0, 1)
    if tn.get('core'):
        # Two reads in one (Friday): the rock's own texture (the luminance, evened locally, above) rides no higher
        # than core['rock'], and the crack's glow (the brightest channel weighted by its saturation, evened only
        # broadly) lifts its hot core above that from core['from'] up, so the fissure glows and its walls stay dark.
        cr = tn['core']
        mx, mn = arr.max(axis=2), arr.min(axis=2)
        gl = Image.fromarray(np.clip(.4 * mx + .6 * (mx - mn) * 1.6, 0, 255).astype(np.uint8), 'L')
        gl = gl.filter(ImageFilter.GaussianBlur(radius=cr.get('soft', 1.2)))
        gb = np.asarray(gl.filter(ImageFilter.GaussianBlur(radius=max(W, H) / 9)), dtype=np.float32)
        gv = np.asarray(gl, dtype=np.float32) - .45 * (gb - .55 * 255)
        glo, ghi = np.percentile(gv, [2, cr.get('phi', 98.5)])
        kg = np.clip((np.clip((gv - glo) / max(1.0, ghi - glo), 0, 1) - cr['from']) / (1 - cr['from']), 0, 1)
        # The crack is a mask read from that glow and feathered, so its edge follows the glow's own jagged contour
        # and has no straight side. Inside it the tone is a ramp across the crack's width: full series colour at
        # its walls (cr['wall'] on the stops), rising toward cream only on a narrow centre line, found as the
        # inside distance over the crack's local half-width (cr['line'] is where on that 0-to-1 the rise starts).
        m = np.clip((kg - cr['lo']) / max(1e-3, cr['hi'] - cr['lo']), 0, 1)
        m = m * m * (3 - 2 * m)
        if tn.get('core_box'):
            # The crack is read only where it runs (card px, per shape), so a glow of the same colour elsewhere
            # (Friday's lit fog and its sheen on the rock floor) stays rock.
            m = m * box(*tn['core_box'])
        inside = Image.fromarray(((m > .5) * 255).astype(np.uint8), 'L')
        dist, cur = np.zeros_like(m), inside
        for _ in range(cr.get('reach', 60)):
            cur = cur.filter(ImageFilter.MinFilter(3))
            hit = np.asarray(cur) > 0
            if not hit.any():
                break
            dist += hit
        dist += m > .5
        span = Image.fromarray(np.clip(dist, 0, 255).astype(np.uint8), 'L')
        for _ in range(cr.get('reach', 60)):
            span = span.filter(ImageFilter.MaxFilter(3))
        centre = dist / np.maximum(np.asarray(span, dtype=np.float32), 1)
        soft = lambda a, r: np.asarray(Image.fromarray(np.clip(np.rint(a * 255), 0, 255).astype(np.uint8), 'L')
                                       .filter(ImageFilter.GaussianBlur(radius=r)), dtype=np.float32) / 255
        centre = soft(centre, cr.get('line_soft', 2))
        line = np.clip((centre - cr['line']) / (1 - cr['line']), 0, 1)
        line = line * line * (3 - 2 * line)
        m = soft(m, cr.get('feather', 3))
        lo_r = cr.get('rock_lo', 0)
        k = np.maximum(lo_r + (cr['rock'] - lo_r) * k ** cr.get('gamma', 1), m * (cr['wall'] + (1 - cr['wall']) * line))
        if cr.get('rims'):
            # The plates' lit rims, kept as thin lines of the series colour: the grey above its own local blur by
            # more than the pitting does (r: blur radius, t: the least lift in grey levels, w: the ramp to full).
            r, t, w, tone = cr['rims']
            g0 = im.convert('L').filter(ImageFilter.MedianFilter(3))
            hp = np.asarray(g0, dtype=np.float32) - np.asarray(g0.filter(ImageFilter.GaussianBlur(radius=r)), dtype=np.float32)
            rim = np.clip((hp - t) / w, 0, 1)
            k = np.maximum(k, rim * tone)
    if held is not None:
        k = k * held
    # hush: card-px boxes (x0, y0, x1, y1, factor, feather) where the tone is pulled down toward ink, so a glow
    # the grade cannot tell from the hero (Friday's horizon haze, as bright as the crack) stays dark, except
    # inside keep boxes (x0, y0, x1, y1, feather[, least tone]), the hero's own line.
    # A keep box may carry a sixth value, the least tone kept inside it, so only the hero's hot core survives there.
    for x0, y0, x1, y1, f, fe in tn.get('hush', []):
        keep = np.zeros_like(k)
        for kx0, ky0, kx1, ky1, kfe, *kmin in tn.get('keep', []):
            hot = np.clip((k - kmin[0]) / .04, 0, 1) if kmin else 1
            keep = np.maximum(keep, box(kx0, ky0, kx1, ky1, kfe) * hot)
        k = k * (1 - box(x0, y0, x1, y1, fe) * (1 - keep) * (1 - f))
    # calm: card-px boxes (x0, y0, x1, y1, tone, feather) where the world is laid flat at one tone (Wednesday's fog
    # under the headline), so nothing half-dissolved sits against the words.
    for x0, y0, x1, y1, t, fe in tn.get('calm', []):
        m = box(x0, y0, x1, y1, fe)
        k = k * (1 - m) + t * m

    # The stops, each a colour in linear light; between two stops the colour is mixed linearly in linear light.
    lin = lambda h: np.array([_lin(x) for x in _hex(h)], dtype=np.float32)
    base = {'ink': lin(ink), 'col': lin(col), 'deep': lin(DEEP.get(day, ink))}
    cream = lin(kit.CREAM)
    stops = [(t, base[n] + (cream - base[n]) * share) for t, n, share in tn['stops']]
    out_lin = np.zeros((*k.shape, 3), dtype=np.float32) + stops[0][1]
    for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
        if t1 <= t0:
            continue
        sel = (k >= t0) & (k <= t1)
        f = ((k[sel] - t0) / (t1 - t0))[:, None]
        out_lin[sel] = c0 + (c1 - c0) * f
    out_lin[k > stops[-1][0]] = stops[-1][1]
    srgb = np.where(out_lin <= .0031308, 12.92 * out_lin, 1.055 * np.clip(out_lin, 0, 1) ** (1 / 2.4) - .055)
    Image.fromarray(np.clip(np.rint(srgb * 255), 0, 255).astype(np.uint8), 'RGB').save(out, 'JPEG', quality=92, optimize=True)
    return out


def grain(alpha):
    """A tiling fractal-noise film grain, contrast-stretched round mid grey (laid on with soft-light), as a data URI."""
    svg = ("<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>"
           "<filter id='g' x='0' y='0' width='100%' height='100%'>"
           "<feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' seed='7' stitchTiles='stitch'/>"
           "<feColorMatrix values='1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0 0 0 1'/>"
           "<feComponentTransfer><feFuncR type='linear' slope='3' intercept='-1.3'/>"
           "<feFuncG type='linear' slope='3' intercept='-1.3'/><feFuncB type='linear' slope='3' intercept='-1.3'/>"
           "</feComponentTransfer></filter>"
           f"<rect width='300' height='300' filter='url(#g)' opacity='{alpha}'/></svg>")
    return f'url("data:image/svg+xml,{quote(svg)}")'


def rgba(hexc, a):
    return f'rgba({int(hexc[1:3], 16)}, {int(hexc[3:5], 16)}, {int(hexc[5:7], 16)}, {a})'


def ease(stops):
    """Smooth every fade between two stops of the same reference (smoothstep), so no knee shows as a band."""
    out = [stops[0]]
    for a, b in zip(stops, stops[1:]):
        if a[1:-1] == b[1:-1] and a[-1] != b[-1]:
            for i in range(1, 6):
                t = i / 6
                k = t * t * (3 - 2 * t)
                out.append((round(a[0] + (b[0] - a[0]) * t, 3), *a[1:-1], round(a[-1] + (b[-1] - a[-1]) * k, 3)))
        out.append(b)
    return out


# The scrim's stops, (px, reference, alpha). Tall runs down the card: 'top' is px from the top edge, 'hb' px from
# the headline's foot. Wide runs across it: 'hl' is px from the headline's left edge. The wide column is full ink
# only down to WIDE_FOOT px under the headline's foot (its highlight's foot, 'hf'), then eases clear over WIDE_FALL
# px, so the series world shows along the bottom edge under the headline as it does in the gap on the tall covers.
TALL_STOPS = ease([(0, 'top', 1), (-40, 'hb', 1), (100, 'hb', 0)])
WIDE_STOPS = ease([(-152, 'hl', 0), (-12, 'hl', 1)])
WIDE_FOOT, WIDE_FALL = 6, 70


def skin(html, facts, shape, look, kit):
    if not look.get('series') or kit.day not in BASE:
        return html
    W, H = kit.W, kit.H
    col, ink, cream = look['colour'], kit.INK, kit.CREAM
    base = BASE[kit.day]
    img = kit.data_uri(ground_image(kit.day, 'tall' if kit.tall else 'wide', W, H, col, ink, kit), W)
    u = 10 if kit.tall else 8

    def at(y, ref):
        var = {'top': None, 'hb': 'var(--hb, 900px)', 'hl': 'var(--hl, 672px)'}[ref]
        return f'{y}px' if var is None else f'calc({var} + {y}px)'

    def scrim(k):
        """The scrim's background layers at strength k."""
        if kit.tall:
            stops = ', '.join(f'{rgba(ink, round(a * k, 3))} {at(y, ref)}' for y, ref, a in TALL_STOPS)
            return [f'linear-gradient(180deg, {stops})']
        # Wide: three layers that tile the column without overlapping. Above the foot line, the column across the
        # card (clear at hl-152, full from hl-12); under it, the fall down from the line (from hl-12 rightward); and
        # in the corner between them, an elliptical fall whose edges meet both, so no hard edge shows anywhere.
        top, x0, f = f'calc(var(--hf, 487px) + {WIDE_FOOT}px)', 'calc(var(--hl, 672px) - 12px)', WIDE_FALL
        across = ', '.join(f'{rgba(ink, round(a * k, 3))} {at(x, ref)}' for x, ref, a in WIDE_STOPS)
        fall = ease([(0, 'y', 1), (f, 'y', 0)])
        down = ', '.join(f'{rgba(ink, round(a * k, 3))} {y}px' for y, _, a in fall)
        corner = ', '.join(f'{rgba(ink, round(a * k, 3))} {round(100 * y / f, 2)}%' for y, _, a in fall)
        return [f'linear-gradient(90deg, {across}, {rgba(ink, k)} 100%) 0 0 / 100% {top} no-repeat',
                f'linear-gradient(180deg, {down}) {x0} {top} / calc(100% - {x0}) {f}px no-repeat',
                f'radial-gradient(140px {f}px at 100% 0, {corner}) calc(var(--hl, 672px) - 152px) {top} / 140px {f}px no-repeat']

    veil, mult = scrim(VEIL), scrim(SCRIM)
    layers = [grain(GRAIN), *veil, *mult, f'url("{img}") 0 0 / 100% 100% no-repeat', base]
    modes = ['soft-light', *['normal'] * len(veil), *['multiply'] * len(mult), 'normal', 'normal']
    css = f"""
body {{ background: {base}; }}
#card {{ background: {', '.join(layers)} !important;
         background-blend-mode: {', '.join(modes)}; }}
h1 {{ color: {cream}; }}
h1 mark {{ background: {col}; color: {ink}; }}
.pill {{ background: {col}; color: {ink}; }}
.tag {{ background: {col}; color: {ink}; }}
.frame {{ box-shadow: {u * 2}px {round(u * 2.4)}px 0 {col}, 0 {u * 4}px {u * 9}px {rgba('#000000', .6)}, 0 {u}px {u * 2}px {rgba('#000000', .35)}; }}
"""
    return html.replace('</style>', css + '</style>', 1)


PLACE_JS = r"""([shape]) => {
  // The scrim is set from the laid-out headline: its foot (tall) and its left edge (wide).
  const card = document.querySelector('#card'), cr = card.getBoundingClientRect();
  const h = document.querySelector('h1').getBoundingClientRect();
  card.style.setProperty('--hb', Math.round(h.bottom - cr.top) + 'px');
  card.style.setProperty('--hl', Math.round(h.left - cr.left) + 'px');
  // The headline's foot with its highlight (the marks reach below the h1's own box).
  const foot = Math.max(h.bottom, ...[...document.querySelectorAll('h1 mark')].map(m => m.getBoundingClientRect().bottom));
  card.style.setProperty('--hf', Math.round(foot - cr.top) + 'px');
}"""
