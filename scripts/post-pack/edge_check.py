"""The edge check for a picture in a post: nothing may run off its edge.

Krish, 2026-10-07, of the Higgsfield explainer "Who keeps what", whose source
line was cut off at the bottom: "stuff like this can't happen - why do we not
check basic things like this?" The phone check (scripts/pages/card.py) measured
how big the words were and never whether they all fitted. "What's inside
Higgsfield" had the same fault: its dark card ran off the bottom.

This looks at the finished image, however it was made. It takes the background
from the image's outer ring of pixels, then looks along each edge: when more
than a sliver of that edge is something other than the background (words, a
card, a bar), the picture is cut off there and is refused.

    python scripts/post-pack/edge_check.py IMAGE [IMAGE ...]
    python scripts/post-pack/edge_check.py --self-test
"""

import sys
from collections import Counter
from pathlib import Path

STRIP = 4         # pixels in from each edge
FRAME = 16        # how deep a solid frame or accent bar along an edge may be
TOLERANCE = 48    # summed RGB difference still counted as background
MAX_SHARE = 0.01  # share of an edge strip that may differ (anti-aliasing, a hairline)
EDGES = ('top', 'bottom', 'left', 'right')


def _image(path_or_image):
    from PIL import Image
    im = path_or_image if hasattr(path_or_image, 'getpixel') else Image.open(path_or_image)
    return im.convert('RGB')


def _line(im, edge, depth):
    """The row or column `depth` pixels in from an edge."""
    w, h = im.size
    box = {'top': (0, depth, w, depth + 1), 'bottom': (0, h - 1 - depth, w, h - depth),
           'left': (depth, 0, depth + 1, h), 'right': (w - 1 - depth, 0, w - depth, h)}[edge]
    raw = im.crop(box).tobytes()
    return [tuple(raw[i:i + 3]) for i in range(0, len(raw), 3)]


def _differs(p, bg):
    return sum(abs(a - b) for a, b in zip(p, bg)) > TOLERANCE


def _bar(line, bg):
    """A line painted almost all in one colour that is not the background: a
    deliberate frame or accent bar."""
    (colour, n), = Counter((r // 8 * 8, g // 8 * 8, b // 8 * 8) for r, g, b in line).most_common(1)
    return n / len(line) >= 0.97 and _differs(colour, bg)


def _strip(im, edge, bg):
    """STRIP lines along an edge, starting inside any solid frame or accent bar
    painted along it (up to FRAME pixels deep), so a designed border is not
    taken for something cut off."""
    depth = 0
    while depth < FRAME and _bar(_line(im, edge, depth), bg):
        depth += 1
    if depth == FRAME:  # a band this deep is part of the picture, not a frame
        depth = 0
    return [p for d in range(depth, depth + STRIP) for p in _line(im, edge, d)]


def background(im):
    """The colour the outer ring of the image is mostly painted in."""
    ring = [p for e in EDGES for d in range(STRIP) for p in _line(im, e, d)]
    return Counter((r // 4, g // 4, b // 4) for r, g, b in ring).most_common(1)[0][0]


def problems(path_or_image):
    """Plain-words reasons the picture is cut off, or [] when it is whole."""
    im = _image(path_or_image)
    bg = tuple(c * 4 + 2 for c in background(im))
    found = []
    for edge in EDGES:
        px = _strip(im, edge, bg)
        off = sum(1 for p in px if _differs(p, bg))
        if off / len(px) > MAX_SHARE:
            found.append(f'something runs off the {edge} edge ({off / len(px):.0%} of it is not background): '
                         'make the picture bigger or the content smaller, so every word and box sits inside a margin')
    return found


def self_test():
    from PIL import Image, ImageDraw
    failures, count = [], 0

    def check(label, got, want):
        nonlocal count
        count += 1
        if got != want:
            failures.append(f'{label}: got {got!r}, want {want!r}')

    lavender, ink = (183, 166, 255), (12, 21, 18)
    whole = Image.new('RGB', (680, 650), lavender)
    d = ImageDraw.Draw(whole)
    d.rounded_rectangle((36, 120, 644, 560), 20, fill=ink)
    d.text((40, 590), 'Source: Alex Mashrabov on a podcast', fill=ink)
    check('a card with a margin is whole', problems(whole), [])
    cut = whole.crop((0, 0, 680, 596))  # the source line cut through, as on "Who keeps what"
    check('words cut at the bottom are refused', [p.split(' (')[0] for p in problems(cut)], ['something runs off the bottom edge'])
    ran = Image.new('RGB', (680, 650), lavender)
    ImageDraw.Draw(ran).rectangle((36, 300, 644, 650), fill=ink)  # a card running off, as on "What's inside"
    check('a card running off the bottom is refused', [p.split(' (')[0] for p in problems(ran)], ['something runs off the bottom edge'])
    framed = whole.copy()
    ImageDraw.Draw(framed).rectangle((0, 0, 679, 5), fill=(255, 106, 77))  # an accent bar along the top
    check('an accent bar along an edge is no cut', problems(framed), [])
    photo = Image.new('RGB', (680, 650), ink)
    check('a plain dark picture is whole', problems(photo), [])
    if failures:
        print('edge check self-test FAILED:\n  ' + '\n  '.join(failures))
        return 1
    print(f'edge check self-test passed: {count} checks')
    return 0


def main(argv):
    if argv[1:2] == ['--self-test']:
        return self_test()
    if len(argv) < 2:
        print(__doc__.strip())
        return 2
    worst = 0
    for path in argv[1:]:
        found = problems(path)
        print(('CUT OFF    ' if found else 'whole      ') + path)
        for item in found:
            print(f'  - {item}')
        worst = worst or (1 if found else 0)
    return worst


if __name__ == '__main__':
    sys.exit(main(sys.argv))
