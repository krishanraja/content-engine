"""Capture the identity study sheets."""
import argparse
import asyncio
import os
from pathlib import Path
import subprocess
from unittest.mock import patch
from contextlib import nullcontext

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
OUT = ROOT / ".scratch/identity-round2/out"


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
    width, height = 2400, 2000
    parser = argparse.ArgumentParser()
    parser.add_argument("--check-only", action="store_true", help="Verify layout with WebKit without saving sheets")
    check_only = parser.parse_args().check_only
    if not check_only:
        OUT.mkdir(parents=True, exist_ok=True)
    stdio = (patch("asyncio.create_subprocess_exec", anonymous_driver)
             if os.name == "nt" else nullcontext())
    with stdio, sync_playwright() as engine:
        browser = engine.webkit.launch(executable_path=os.getenv("WEBKIT_EXECUTABLE")) if check_only else engine.chromium.launch(channel="chromium", headless=True, args=["--disable-background-networking", "--allow-file-access-from-files"])
        page = browser.new_page(viewport={"width": width, "height": height},
                                device_scale_factor=1, offline=True)
        for name, sheet_height in (("wordmark-spacing", 2000), ("block-finish", 2000),
                                   ("show-art-s1", 1800), ("show-art-s3", 1800),
                                   ("grid-test", 1800), ("tag-covers", 1300),
                                   ("full-look", None)):
            size = (width, sheet_height or height)
            page.set_viewport_size(dict(zip(("width", "height"), size)))
            page.goto(f"{(HERE / 'study.html').as_uri()}?view={name}")
            page.evaluate("window.ready")
            if sheet_height is None:
                content_height = page.locator("main").evaluate("el => Math.ceil(el.getBoundingClientRect().height)")
                page.set_viewport_size({"width": width, "height": content_height})
            if name == "full-look":
                for title in page.locator(".surface strong").all():
                    lines = title.evaluate("el => el.clientHeight / parseFloat(getComputedStyle(el).lineHeight)")
                    assert lines <= 3.05, title.inner_text()
                banner = page.locator(".banner strong").bounding_box()
                avatar = page.locator(".channel-id .avatar").bounding_box()
                assert avatar["y"] - banner["y"] - banner["height"] >= 24, "banner clearance"
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight"), name
            if not check_only:
                page.screenshot(path=OUT / f"{name}.png")
        browser.close()


if __name__ == "__main__":
    main()

