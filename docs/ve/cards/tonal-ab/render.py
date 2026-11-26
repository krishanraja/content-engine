"""Capture the tonal comparison sheets and square masters."""
import asyncio
import os
from pathlib import Path
import subprocess
from unittest.mock import patch
from contextlib import nullcontext

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
OUT = ROOT / ".scratch/tonal-ab/out"


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
        for name in ("blocks-ab", "show-art", "s1", "s2", "s3"):
            size = (3000, 3000) if name in {"s1", "s2", "s3"} else (width, height)
            page.set_viewport_size(dict(zip(("width", "height"), size)))
            page.goto(f"{(HERE / 'ab.html').as_uri()}?view={name}")
            page.evaluate("window.ready")
            page.screenshot(path=OUT / f"{name}.png")
        browser.close()


if __name__ == "__main__":
    main()
