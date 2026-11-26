"""The 160 px gate: judge covers and thumbnails at the size people actually see them.

From the Divergence engine (26 Nov 2026, "160 px blur gate"): designers judge thumbnails at full size, but viewers
meet them at about 160 px wide. This gate shrinks each rendered cover to 160 px (and 40 px) and fails it when it
would be hard to read there. Ruling (Krish, 2026-11-26): "I approve the new cover thumbnail systems, go".
The 10% colour floor applies to 9:16 and 4:5 covers. Wide editorial covers use the fitted headline or figure.
At 160 px wide its cap height must reach 7 px and its local sRGB contrast must reach 4.5:1.
The renderer measures both from pixels. A standalone wide needs its render's matching covers.json.

    python thumb_gate.py                      every cover, thumbnail and title card in the latest render
    python thumb_gate.py path/to/cover.png    any image a production session made
Exit code 1 when anything fails.

Checks, each on the 160 px version:
  colour    on vertical covers, at least 10% of pixels carry clear colour (saturation >= 0.35 and value >= 0.45)
  contrast  the 2nd to 98th percentile luminance spread is at least 0.55, so type separates from ground
  light     at least 2.5% of pixels are near-white or palette-bright (luminance >= 0.78): the headline or a lit subject
  busy      edge density at 40 px stays under 0.42, so the cover still reads as one idea at stamp size
"""
import colorsys
import hashlib
import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[3] / ".scratch" / "library" / "out" / "items"
COVER_LAYOUTS = ("cover-", "title", "howto-cover", "good-news-cover", "simple-advice-cover", "cover")


def thumbnail(image):
    return image.resize((160, max(1, round(image.height * 160 / image.width))), Image.LANCZOS)


def relative_luminance(rgb):
    srgb = [v / 255 for v in rgb]
    r, g, b = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in srgb]
    return .2126 * r + .7152 * g + .0722 * b


def type_metrics(cover, background, mask, glyphs, caps):
    """Measure visible stroke cores on the encoded thumbnail and H ink in each fitted face."""
    if not caps or not glyphs or not (cover.size == background.size == mask.size):
        raise ValueError("Incomplete wide headline or figure render")
    small, blank, matte = map(thumbnail, (cover, background, mask))
    scale_x, scale_y = small.width / cover.width, small.height / cover.height
    # Integrate the strongest ink coverage on each native raster row, including fractional edge rows.
    heights = [sum(cap.crop((0, y, cap.width, y + 1)).getextrema()[1] / 255
                   for y in range(cap.height)) * scale_x for cap in caps]
    ratios = []
    for x0, y0, x1, y1 in glyphs:
        # Only sample pixel centres belonging to this glyph's range in the fitted DOM.
        left, right = max(0, math.ceil(x0 * scale_x - .5)), min(small.width, math.ceil(x1 * scale_x - .5))
        top, bottom = max(0, math.ceil(y0 * scale_y - .5)), min(small.height, math.ceil(y1 * scale_y - .5))
        points = [(x, y) for y in range(top, bottom) for x in range(left, right)]
        peak = max((matte.getpixel(p) for p in points), default=0)
        if not peak:
            ratios.append(1.0)
            continue
        # Sample solid stroke interiors across a changing background. Thin type uses its strongest pixel.
        core = min(peak, math.ceil(.9 * 255))
        for p in points:
            if matte.getpixel(p) >= core:
                a, b = sorted((relative_luminance(small.getpixel(p)), relative_luminance(blank.getpixel(p))))
                ratios.append((b + .05) / (a + .05))
    return {"cap_height_px": min(heights), "local_contrast": min(ratios)}


def bound_type_metrics(path):
    """Raw files cannot identify which glyphs belong to the lead. Reuse their byte-bound render evidence."""
    receipt = path.with_name("covers.json")
    if not receipt.is_file():
        return {}
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    for row in json.loads(receipt.read_text(encoding="utf-8")).get("files", []):
        if row.get("sha256") == digest and row.get("format") in ("youtube", "substack"):
            return row.get("gate_160", {}).get("metrics", {})
    return {}


# Krish approved the vertical image-led families exactly (2026-11-26). The receipt and portrait-window families sit on
# an ink ground by design, so the colour and light floors judge them against the retired colour-block covers. They are
# held to contrast and busy instead. The figure family is a single series-colour field and keeps the colour floor.
INK_GROUND_VERTICAL = ("receipt", "portrait")


def measure(path, wide_type=None, *, is_cover=True, vertical_family=None, sidebar=True):
    """`sidebar` is False for a wide image never shown at 160 px (the Substack cover, shown at full card width),
    which then skips only the 160 px type measure. The YouTube thumbnail always keeps it."""
    im = Image.open(path).convert("RGB")
    small = thumbnail(im)
    px = list(small.getdata()); n = len(px)
    lum = sorted((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 for r, g, b in px)
    colour = sum(1 for r, g, b in px if (lambda h, s, v: s >= .35 and v >= .45)(*colorsys.rgb_to_hsv(r / 255, g / 255, b / 255))) / n
    contrast = lum[int(n * .98) - 1] - lum[int(n * .02)]
    light = sum(1 for v in lum if v >= .78) / n
    stamp = im.resize((40, max(1, round(im.height * 40 / im.width))), Image.LANCZOS).convert("L").filter(ImageFilter.FIND_EDGES)
    busy = sum(1 for v in stamp.getdata() if v > 60) / (stamp.width * stamp.height)
    result = {"colour": round(colour, 3), "contrast": round(contrast, 3), "light": round(light, 3), "busy": round(busy, 3)}
    vertical = im.width * 16 == im.height * 9 or im.width * 5 == im.height * 4
    ink_ground = vertical and vertical_family in INK_GROUND_VERTICAL
    fails = [k for k, ok in (("colour", not vertical or ink_ground or colour >= .10), ("contrast", contrast >= .55),
                             ("light", ink_ground or light >= .025), ("busy", busy < .42)) if not ok]
    if is_cover and im.width > im.height:
        evidence = bound_type_metrics(Path(path)) if wide_type is None else wide_type
        for name, floor in (("cap_height_px", 7), ("local_contrast", 4.5)):
            value = evidence.get(name)
            result[name] = value
            # Recorded for every wide cover; it fails only an image people meet at 160 px.
            if sidebar and (not isinstance(value, (int, float)) or not math.isfinite(value) or value < floor):
                fails.append(name)
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
                yield item["id"], png, layout != "title"


def main(argv):
    pairs = [(Path(a).name, Path(a), True) for a in argv] if argv else list(targets())
    failed = 0
    for name, path, is_cover in pairs:
        result, fails = measure(path, is_cover=is_cover)
        failed += bool(fails)
        print(("FAIL " if fails else "pass ") + name.ljust(40), result, ("fails: " + ", ".join(fails)) if fails else "")
    print(f"{len(pairs) - failed} of {len(pairs)} pass the 160 px gate")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
