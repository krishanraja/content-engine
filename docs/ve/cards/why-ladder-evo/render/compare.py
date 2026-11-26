"""Render the locked cover and its editorial alternatives from local artwork."""
import json
import os
from contextlib import nullcontext
from unittest.mock import patch

from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

from render import HERE, OUT, ROOT, anonymous_driver


def comparison(folder, names, labels, filename, width, height, tokens, fixed_height=False):
    gutter = 40
    footer = 64
    sheet_height = height if fixed_height else height + footer
    sheet = Image.new("RGB", (len(names)*width + (len(names)-1)*gutter, sheet_height), "white")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype(str(ROOT / tokens["type"]["label"]["files"]["regular"]), 24)
    image_height = sheet_height - footer
    image_width = round(width * image_height / height)
    for index, (name, label) in enumerate(zip(names, labels)):
        x = index * (width + gutter)
        # Keep the centre gutter exactly 40 px when fitting the two covers.
        if fixed_height and index == 0:
            x += width - image_width
        with Image.open(folder / (name + ".png")) as frame:
            if frame.size != (width, height):
                raise ValueError(f"{name} has unexpected dimensions {frame.size}")
            if fixed_height:
                frame = frame.resize((image_width, image_height), Image.Resampling.LANCZOS)
            sheet.paste(frame, (x, 0))
        draw.text((x+16, image_height+footer//2), label, font=font,
                  fill=tokens["colour"]["ink"], anchor="lm")
    sheet.save(folder / filename)


def main():
    config = {key: json.loads((HERE.parent / f"{key}.json").read_text(encoding="utf8"))
              for key in ("piece", "tokens")}
    tokens = config["tokens"]
    width, height = (tokens["canvas"][k] for k in ("w", "h"))
    tile_height = width * 5 // 4
    folder = OUT / "compare"
    folder.mkdir(parents=True, exist_ok=True)
    covers = ["cover-A", "cover-B"]
    tiles = ["tile-A", "tile-B", "tile-C"]
    stdio = (patch("asyncio.create_subprocess_exec", anonymous_driver)
             if os.name == "nt" else nullcontext())
    with stdio, sync_playwright() as engine:
        browser = engine.chromium.launch(channel="chromium", headless=True,
                                         args=["--disable-background-networking",
                                               "--allow-file-access-from-files"])
        page = browser.new_page(viewport={"width": width, "height": height},
                                device_scale_factor=1, offline=True)
        page.add_init_script("window.ladderData = " + json.dumps(config))
        for name in covers + tiles:
            page.set_viewport_size({"width": width, "height": tile_height if name in tiles else height})
            if name == "cover-A":
                url = (HERE / "ladder.html").as_uri() + "?scene=1"
            else:
                url = (HERE / "compare.html").as_uri() + "?variant=" + name
            page.goto(url)
            page.evaluate("window.ready")
            page.evaluate("document.fonts.ready")
            page.screenshot(path=folder / (name + ".png"))
        browser.close()
    comparison(folder, covers, ["A  locked", "B  burn + eyebrow"], "compare-cover.png",
               width, height, tokens, fixed_height=True)
    comparison(folder, tiles, ["A  locked", "B  burn + Anton", "C  burn + Fraunces"],
               "compare-tiles.png", width, tile_height, tokens)


if __name__ == "__main__":
    main()
