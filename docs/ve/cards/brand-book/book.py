"""Export the local approval book and its page proofs at the print trim size."""
import asyncio
from contextlib import nullcontext
from io import BytesIO
from math import ceil
import os
from pathlib import Path
import subprocess
from unittest.mock import patch

from PIL import Image
from playwright.sync_api import sync_playwright
from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject, TextStringObject

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
WIDTH, HEIGHT = 1600, 1000


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


def save_pdf(data, count, marker, motion, mock):
    # Chrome resolves file links against the workstation. Keep the PDF portable.
    reader = PdfReader(BytesIO(data))
    if len(reader.pages) != count:
        raise ValueError("Print pagination differs from the HTML pages")
    links = []
    for sheet in reader.pages:
        for reference in sheet.get("/Annots", []):
            action = reference.get_object().get("/A")
            if action:
                action = action.get_object()
                uri = action.get("/URI")
                links.append(uri)
                if uri == marker:
                    action[NameObject("/URI")] = TextStringObject(motion)
    if links.count(marker) != 1 or mock not in links:
        raise ValueError("Expected both the website and motion annotations")
    writer = PdfWriter(clone_from=reader)
    writer.write(OUT / "makeyourmindup-brand-book-v2.pdf")


def main():
    page_dir = OUT / "pages"
    page_dir.mkdir(parents=True, exist_ok=True)
    stdio = (patch("asyncio.create_subprocess_exec", anonymous_driver)
             if os.name == "nt" else nullcontext())
    with stdio, sync_playwright() as engine:
        browser = engine.chromium.launch(channel="chromium", headless=True,
                                         args=["--disable-background-networking", "--allow-file-access-from-files"])
        page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT},
                                device_scale_factor=1, offline=True)
        # offline=True blocks every network request; a route hook deadlocks the Windows stdio driver.
        page.goto((HERE / "book.html").as_uri())
        page.emulate_media(media="print")
        page.evaluate("Promise.all([...document.fonts].map(font => font.load()))")
        page.evaluate("Promise.all([...document.images].map(img => img.decode()))")
        sheets = page.locator("section.page")
        count = sheets.count()
        mock = page.locator('a[href^="https:"]').get_attribute("href")
        motion_link = page.locator('a[href$=".mp4"]')
        motion_path = HERE / motion_link.get_attribute("href")
        if not motion_path.is_file():
            raise FileNotFoundError(motion_path)
        motion = Path(os.path.relpath(motion_path, OUT)).as_posix()
        # A distinct, unvisited URI gives the print engine a normal link annotation.
        marker = mock + "#motion-file"
        motion_link.evaluate("(a, url) => a.href = url", marker)
        save_pdf(page.pdf(prefer_css_page_size=True, print_background=True), count, marker, motion, mock)

        columns, thumb_w, thumb_h, gap = 4, 320, 200, 10
        rows = ceil(count / columns)
        contact = Image.new("RGB", (columns * (thumb_w + gap) + gap, rows * (thumb_h + gap) + gap),
                            "#16221D")
        for index in range(count):
            target = page_dir / f"page-{index + 1:02d}.png"
            sheets.nth(index).screenshot(path=target)
            with Image.open(target) as image:
                if image.size != (WIDTH, HEIGHT):
                    raise ValueError(f"Unexpected page dimensions on page {index + 1}")
                thumb = image.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
                contact.paste(thumb, (gap + (index % columns) * (thumb_w + gap),
                                      gap + (index // columns) * (thumb_h + gap)))
        contact.save(OUT / "contact.png")
        browser.close()


if __name__ == "__main__":
    main()
