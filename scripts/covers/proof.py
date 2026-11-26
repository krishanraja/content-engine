"""Capture just the source text and its approved crop."""
import hashlib
import json
from pathlib import Path
import subprocess
import xml.etree.ElementTree as ET

from frame_capture import workspace

from PIL import Image, ImageDraw

HIDE = """
img,picture,video,canvas,svg,iframe,embed,object,input[type=image],
[role=dialog], [aria-modal=true], [id*=consent i], [class*=cookie i],
[id*=cookie i], [class*=consent-banner i] {visibility:hidden!important}
*,*::before,*::after {background-image:none!important;list-style-image:none!important}
*::before,*::after {content:normal!important}
"""


def box(values, width, height):
    if not isinstance(values, (list, tuple)) or len(values) != 4:
        raise ValueError("proof crop needs four fractional coordinates")
    x0, y0, x1, y1 = values
    if not 0 <= x0 < x1 <= 1 or not 0 <= y0 < y1 <= 1:
        raise ValueError("proof crop must be a nonempty rectangle inside the page")
    return [round(x0 * width), round(y0 * height), round(x1 * width), round(y1 * height)]


def pdf_text_page(browser, spec, folder):
    # Keep the PDF typography and vector marks. Strip raster images before Chromium sees it.
    pdf = folder / "source.pdf"
    response = browser.request.get(spec["url"], timeout=60000)
    if not response.ok or not response.body().startswith(b"%PDF"):
        raise ValueError("The source did not return a PDF.")
    pdf.write_bytes(response.body())
    number = str(int(spec.get("page", 1)))
    svg = folder / "page.svg"
    subprocess.run(["pdftocairo", "-svg", "-f", number, "-l", number, str(pdf), str(svg)], check=True)
    tree = ET.parse(svg)
    for parent in tree.iter():
        for child in list(parent):
            if child.tag.rsplit("}", 1)[-1] == "image":
                parent.remove(child)
    tree.write(svg, encoding="utf-8")
    return svg.as_uri()


def capture(get_browser, facts, base, cache):
    proof = facts["cover"]["proof"]
    art = facts.get("image_led", {})
    supplied = art.get("proof_capture") or proof.get("image")
    if supplied and (base / supplied).is_file():
        if art.get("proof_photo_free") is not True:
            raise ValueError("Confirm proof_photo_free for a supplied source crop.")
        return (base / supplied).resolve()
    kind = next((k for k in ("page", "html", "pdf") if proof.get(k)), None)
    if not kind:
        raise ValueError("Supply a photo-free proof crop or its source page.")
    spec = proof[kind]
    source = base / spec["path"] if kind == "html" else None
    identity = [kind, spec, proof.get("ring"), facts["subchannel"], "text-only-v1"]
    if source:
        identity.append(hashlib.sha256(source.read_bytes()).hexdigest())
    key = hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()
    cache.mkdir(parents=True, exist_ok=True)
    target = cache / f"{key}.png"
    if target.is_file():
        return target
    width, height = int(spec.get("width", 1440)), int(spec.get("height", 900))
    browser = get_browser()
    with workspace(cache) as folder:
        pg = browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=2)
        try:
            def filter_media(route):
                if route.request.resource_type in {"image", "media"}:
                    route.abort()
                else:
                    route.continue_()
            pg.route("**/*", filter_media)
            if kind == "pdf":
                pg.goto(pdf_text_page(browser, spec, folder))
                size = pg.locator("svg").first.bounding_box()
                width, height = round(size["width"]), round(size["height"])
                pg.set_viewport_size({"width": width, "height": height})
            else:
                url = source.resolve().as_uri() if source else spec["url"]
                result = pg.goto(url, wait_until="domcontentloaded", timeout=60000)
                if result and not result.ok:
                    raise ValueError(f"Source page returned HTTP {result.status}")
                pg.add_style_tag(content=HIDE)
                if not pg.locator("body").inner_text().strip():
                    raise ValueError("No source text on the page.")
            pg.evaluate("document.fonts.ready")
            x0, y0, x1, y1 = box(spec["crop"], width, height)
            staged = folder / "crop.png"
            pg.screenshot(path=staged, clip={"x": x0, "y": y0, "width": x1-x0, "height": y1-y0})
            with Image.open(staged) as im:
                crop = im.convert("RGB")
            if crop.convert("L").getextrema()[0] == crop.convert("L").getextrema()[1]:
                raise ValueError("The source crop is blank.")
            if proof.get("ring"):
                from cover_facts import SERIES
                ImageDraw.Draw(crop).rounded_rectangle(box(proof["ring"], *crop.size), radius=12,
                                                       outline=SERIES[facts["subchannel"]], width=6)
            crop.save(staged)
            staged.replace(target)
        finally:
            pg.close()
    return target
