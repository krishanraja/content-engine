"""Render Poster cards at native size and a captioned overview."""
import asyncio
import os
import subprocess
from contextlib import nullcontext
from pathlib import Path
from unittest.mock import patch

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[4] / ".scratch" / "archetypes" / HERE.name


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


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    stdio = patch("asyncio.create_subprocess_exec", anonymous_driver) if os.name == "nt" else nullcontext()
    with stdio, sync_playwright() as engine:
        browser = engine.chromium.launch(
            channel="chromium", headless=True,
            args=["--disable-background-networking", "--allow-file-access-from-files"],
        )
        page = browser.new_page(device_scale_factor=1, offline=True)
        page.set_default_timeout(180000)
        html = (HERE / "spine.html").as_uri()
        sizes = {6: (1080, 1920), 7: (1280, 720), 9: (1440, 900), 10: (390, 844)}
        for number in range(1, 11):
            width, height = sizes.get(number, (1080, 1350))
            page.set_viewport_size({"width": width, "height": height})
            page.goto(f"{html}?card={number}")
            page.evaluate("window.ready")
            bounds = page.locator(".poster").bounding_box()
            assert bounds == {"x": 0, "y": 0, "width": width, "height": height}, (number, bounds)
            for block in page.locator("[data-headline]").all():
                coverage = block.evaluate("""group => {
                    const lines = [...group.querySelectorAll('text')];
                    const inset = Number(lines[0].dataset.edge);
                    const frame = group.ownerSVGElement.viewBox.baseVal;
                    return Math.max(...lines.map(line => line.getComputedTextLength())) / (frame.width - 2 * inset);
                }""")
                assert 0.70 <= coverage <= 1, (number, "headline coverage", coverage)
            if number in (9, 10):
                assert page.locator('form.control button[type="submit"]').count() == 1
                page.locator(".control.header button").click()
                assert page.get_by_role("textbox", name="Email address").evaluate(
                    "input => input === document.activeElement"
                ), (number, "subscribe focus")
                page.get_by_role("textbox", name="Email address").blur()
            page.screenshot(path=OUT / f"card-{number}.png")
        page.set_viewport_size({"width": 1600, "height": 1000})
        page.goto(f"{html}?view=sheet")
        page.evaluate("window.ready")
        assert page.locator("figcaption").count() == 10
        page.locator("main").screenshot(path=OUT / "sheet.png")
        browser.close()


if __name__ == "__main__":
    main()
