"""Capture the local ladder artwork and assemble the contact proof."""
import asyncio
import json
import os
from pathlib import Path
import subprocess
from unittest.mock import patch
from contextlib import nullcontext

from PIL import Image
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
OUT = ROOT / ".scratch/why-ladder/evo"


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
    config = {key: json.loads((HERE.parent / f"{key}.json").read_text(encoding="utf8"))
              for key in ("piece", "tokens")}
    canvas = config["tokens"]["canvas"]
    width, height = canvas["w"], canvas["h"]
    OUT.mkdir(parents=True, exist_ok=True)
    stdio = (patch("asyncio.create_subprocess_exec", anonymous_driver)
             if os.name == "nt" else nullcontext())
    with stdio, sync_playwright() as engine:
        browser = engine.chromium.launch(channel="chromium", headless=True, args=["--disable-background-networking", "--allow-file-access-from-files"])
        page = browser.new_page(viewport={"width": width, "height": height},
                                device_scale_factor=1, offline=True)
        page.add_init_script("window.ladderData = " + json.dumps(config))
        sheet = Image.new("RGB", (6 * (width // 3), height // 3))
        for number in range(1, 7):
            page.goto(f"{(HERE / 'ladder.html').as_uri()}?scene={number}")
            page.evaluate("window.ready")
            page.evaluate("document.fonts.ready")
            target = OUT / f"scene-{number}.png"
            page.screenshot(path=target)
            with Image.open(target) as scene:
                sheet.paste(scene.resize((width // 3, height // 3), Image.Resampling.LANCZOS),
                            ((number - 1) * (width // 3), 0))
        sheet.save(OUT / "contact.png")
        browser.close()


if __name__ == "__main__":
    main()

