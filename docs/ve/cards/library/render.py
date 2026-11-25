"""Capture the proposed library sheets and individual exports."""
import json
import argparse
import base64
import io

from PIL import Image
import asyncio
import os
from pathlib import Path
from urllib.parse import urlencode
import subprocess
from unittest.mock import patch
from contextlib import nullcontext

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
OUT = ROOT / ".scratch/library/out"


async def anonymous_driver(*command, limit, **kwargs):
    """Use anonymous stdio on Windows where asyncio named pipes are restricted."""
    proc = subprocess.Popen(command, **kwargs)

    class Reader:
        async def readexactly(self, length):
            data = await asyncio.to_thread(proc.stdout.read, length)
            if len(data) != length:
                raise asyncio.IncompleteReadError(data, length)
            return data

    class Writer:
        def write(self, data):
            proc.stdin.write(data)
            proc.stdin.flush()

        def close(self):
            proc.stdin.close()

    class Driver:
        stdin = Writer()
        stdout = Reader()

        async def communicate(self):
            await asyncio.to_thread(proc.wait)
            proc.stdout.close()

    return Driver()


FIT_FAILURES = []


def main():
    width, height = 2400, 2000
    parser = argparse.ArgumentParser()
    parser.add_argument("--check-only", action="store_true", help="Verify layout with WebKit without saving sheets")
    check_only = parser.parse_args().check_only
    if not check_only:
        for folder in ("sheets", "items", "stress"):
            (OUT / folder).mkdir(parents=True, exist_ok=True)
    stdio = (patch("asyncio.create_subprocess_exec", anonymous_driver)
             if os.name == "nt" else nullcontext())
    with stdio, sync_playwright() as engine:
        browser = engine.webkit.launch(executable_path=os.getenv("WEBKIT_EXECUTABLE")) if check_only else engine.chromium.launch(channel="chromium", headless=True, args=["--disable-background-networking", "--allow-file-access-from-files"])
        page = browser.new_page(viewport={"width": width, "height": height},
                                device_scale_factor=1, offline=True)
        page.set_default_timeout(180000)
        registry = json.loads((HERE / "library.json").read_text(encoding="utf-8"))
        html = (HERE / "library.html").read_text(encoding="utf-8")
        embedded = html.split("const {photos,crops,items,grid}=", 1)[1].split(";\n", 1)[0]
        assert json.loads(embedded) == registry, "Refresh the embedded offline library from library.json"
        records = registry["items"]
        families = list(dict.fromkeys(row["family"] for row in records))
        previews = {}
        jobs = [("items", "item", row["id"], row["width"], row["height"]) for row in records]
        jobs.extend(("sheets", "view", name, width, height) for name in ["index", *families])
        jobs = [(folder, name, {key: name}, w, h) for folder, key, name, w, h in jobs]
        cases = ("short", "long", "word", "nophoto", "brightphoto", "doc-long", "numbers")
        jobs.extend(("stress", f"{family}-{case}", {"view": family, "stress": case, "grid": 1}, width, height)
                    for family in families for case in cases)
        for folder, name, query, w, h in jobs:
            page.set_viewport_size({"width": w, "height": h})
            if name == "index" and folder == "sheets":
                page.add_init_script("window.itemPreviews = " + json.dumps(previews))
            page.goto(f"{(HERE / 'library.html').as_uri()}?{urlencode(query)}")
            page.evaluate("window.ready")
            page.evaluate("""async () => {
                const paths = [...document.querySelectorAll('main image')].map(el => el.getAttribute('href'));
                await Promise.all([...new Set(paths)].map(src => {
                    const image = new Image();
                    image.src = src;
                    return image.decode();
                }));
            }""")
            violations = page.locator("text[data-bounds]").evaluate_all("""nodes => nodes.flatMap(node => {
                const [x, y, w, h] = node.dataset.bounds.split(' ').map(Number);
                const m = node.getBBox();
                // SVG text boxes include font leading. Canvas glyph metrics give the painted bounds.
                const context = document.createElement('canvas').getContext('2d');
                const style = getComputedStyle(node);
                context.font = [style.fontStyle, style.fontWeight, style.fontSize, style.fontFamily].join(' ');
                const glyphs = context.measureText(node.textContent);
                const baseline = node.y.baseVal[0].value;
                const fits = m.x >= x - 1 && m.x + m.width <= x + w + 1 &&
                    baseline - glyphs.actualBoundingBoxAscent >= y - 1 &&
                    baseline + glyphs.actualBoundingBoxDescent <= y + h + 1;
                return fits ? [] : [node.dataset.slot];
            })""")
            if violations:
                FIT_FAILURES.append((folder, name, violations)); print('FIT', folder, name, violations, flush=True)
            if folder != "items":
                h = page.locator("main").evaluate("el => Math.ceil(el.getBoundingClientRect().height)")
                page.set_viewport_size({"width": w, "height": h})
            else:
                bounds = page.locator("main > svg").bounding_box()
                assert bounds and bounds["width"] == w and bounds["height"] == h, name
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight"), name
            png = page.screenshot()
            if folder == "items":
                with Image.open(io.BytesIO(png)) as image:
                    image.thumbnail((520, 1000), Image.Resampling.LANCZOS)
                    stream = io.BytesIO()
                    image.convert("RGB").save(stream, "JPEG", quality=92)
                    previews[name] = "data:image/jpeg;base64," + base64.b64encode(stream.getvalue()).decode("ascii")
            if not check_only:
                (OUT / folder / f"{name}.png").write_bytes(png)
        browser.close()


if __name__ == "__main__":
    main()
    import json as _j
    (OUT / "fit-failures.json").write_text(_j.dumps(FIT_FAILURES, indent=1))
    print("FIT FAILURES", len(FIT_FAILURES))

