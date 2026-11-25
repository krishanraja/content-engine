"""Capture each identity comparison sheet at native size."""
import asyncio
import os
from pathlib import Path
import subprocess
from unittest.mock import patch
from contextlib import nullcontext

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
OUT = ROOT / ".scratch/identity-lab/out"


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
    width, height = 2400, 1500
    OUT.mkdir(parents=True, exist_ok=True)
    stdio = (patch("asyncio.create_subprocess_exec", anonymous_driver)
             if os.name == "nt" else nullcontext())
    with stdio, sync_playwright() as engine:
        browser = engine.chromium.launch(channel="chromium", headless=True, args=["--disable-background-networking", "--allow-file-access-from-files"])
        page = browser.new_page(viewport={"width": width, "height": height},
                                device_scale_factor=1, offline=True)
        page.goto((HERE / "lab.html").as_uri())
        page.evaluate("window.ready")
        page.evaluate("document.fonts.ready")
        for name in ("marks-overview", "wordmarks-overview", "in-situ", "in-situ-2"):
            sheet = page.locator(f"#{name}")
            bounds = sheet.bounding_box()
            if (bounds["width"], bounds["height"]) != (width, height):
                raise ValueError(f"Unexpected dimensions for {name}: {bounds}")
            sheet.screenshot(path=OUT / f"{name}.png")
        browser.close()


if __name__ == "__main__":
    main()
