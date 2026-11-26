"""The 160 px gate: judge covers and thumbnails at the size people actually see them.

From the Divergence engine (26 Nov 2026, "160 px blur gate"): designers judge thumbnails at full size, but viewers
meet them at about 160 px wide. This gate shrinks each rendered cover to 160 px (and 40 px) and fails it when it
would read as muddy, colourless or illegible there. It measures pixels only, so it is a floor, never a taste verdict.

    python thumb_gate.py                      every cover, thumbnail and title card in the latest render
    python thumb_gate.py path/to/cover.png    any image a production session made
Exit code 1 when anything fails.

Checks, each on the 160 px version:
  colour    at least 10% of pixels carry clear colour (saturation >= 0.35 and value >= 0.45): "bright over muddy"
  contrast  the 2nd to 98th percentile luminance spread is at least 0.55, so type separates from ground
  light     at least 2.5% of pixels are near-white or palette-bright (luminance >= 0.78): the headline or a lit subject
  busy      edge density at 40 px stays under 0.42, so the cover still reads as one idea at stamp size
"""
import colorsys
import json
import sys
from pathlib import Path

from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[3] / ".scratch" / "library" / "out" / "items"
COVER_LAYOUTS = ("cover-", "title", "howto-cover", "good-news-cover", "simple-advice-cover", "cover")


def measure(path):
    im = Image.open(path).convert("RGB")
    small = im.resize((160, max(1, round(im.height * 160 / im.width))), Image.LANCZOS)
    px = list(small.getdata()); n = len(px)
    lum = sorted((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 for r, g, b in px)
    colour = sum(1 for r, g, b in px if (lambda h, s, v: s >= .35 and v >= .45)(*colorsys.rgb_to_hsv(r / 255, g / 255, b / 255))) / n
    contrast = lum[int(n * .98) - 1] - lum[int(n * .02)]
    light = sum(1 for v in lum if v >= .78) / n
    stamp = im.resize((40, max(1, round(im.height * 40 / im.width))), Image.LANCZOS).convert("L").filter(ImageFilter.FIND_EDGES)
    busy = sum(1 for v in stamp.getdata() if v > 60) / (stamp.width * stamp.height)
    result = {"colour": round(colour, 3), "contrast": round(contrast, 3), "light": round(light, 3), "busy": round(busy, 3)}
    fails = [k for k, ok in (("colour", colour >= .10), ("contrast", contrast >= .55), ("light", light >= .025), ("busy", busy < .42)) if not ok]
    return result, fails


def targets():
    registry = json.loads((HERE / "library.json").read_text(encoding="utf-8"))
    for item in registry["items"]:
        if item.get("status") == "retired":
            continue
        layout = item.get("layout", "")
        if any(layout.startswith(p) for p in COVER_LAYOUTS) or item["id"].endswith(("-title", "-thumb", "-cover", "-card")):
            png = OUT / f"{item['id']}.png"
            if png.exists():
                yield item["id"], png


def main(argv):
    pairs = [(Path(a).name, Path(a)) for a in argv] if argv else list(targets())
    failed = 0
    for name, path in pairs:
        result, fails = measure(path)
        failed += bool(fails)
        print(("FAIL " if fails else "pass ") + name.ljust(40), result, ("fails: " + ", ".join(fails)) if fails else "")
    print(f"{len(pairs) - failed} of {len(pairs)} pass the 160 px gate")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
