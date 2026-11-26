"""Render the three cover exemplars (hero visuals) from exemplars.html into the ignored .scratch/exemplars folder.

Exemplars set the bar for the hero-visual slot. Each piece's production session generates its own image to match;
the Library never keeps a stock bank (Krish, 26 Nov 2026). Run: python render_exemplars.py
"""
from pathlib import Path
from render import capture_page

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[3] / ".scratch" / "exemplars"

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    with capture_page() as page:
        page.set_viewport_size({"width": 1600, "height": 1920})
        page.goto((HERE / "exemplars.html").as_uri())
        page.evaluate("document.fonts.ready")
        for name in ("e1", "e2", "e3", "e4"):
            page.locator("#" + name).screenshot(path=str(OUT / f"{name}.png"))
            print("rendered", name)
