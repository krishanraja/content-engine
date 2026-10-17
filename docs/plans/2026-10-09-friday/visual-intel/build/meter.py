"""Measure words in the house faces in a real browser (canvas measureText), and logo artwork bounding boxes.

Used by render.py. Run alone to print widths: python3 -I meter.py "700 54px Archivo" "some words" ...
"""
import os
import sys
from pathlib import Path

ROOT = Path('/home/user/content-engine')
sys.path.insert(0, str(ROOT / 'scripts/pages'))
os.environ.setdefault('MYMU_BROWSER', '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell')
import brand  # noqa: E402

FACES = ["400 92px Anton", "400 104px Anton", "400 80px Anton", "400 64px Anton", "700 54px Archivo", "500 54px Archivo",
         "700 60px Archivo", "500 54px 'IBM Plex Mono'", "400 42px 'IBM Plex Mono'"]


class Meter:
    def __init__(self):
        self._cm = brand.playwright()
        self.p = self._cm.__enter__()
        self.b = brand.browser(self.p)
        self.pg = self.b.new_page()
        self.pg.set_content(f'<html><head><style>{brand.font_css()}</style></head><body></body></html>')
        self.pg.evaluate('(faces) => Promise.all(faces.map(f => document.fonts.load(f))).then(() => document.fonts.ready).then(() => true)', FACES)
        self.cache = {}

    def w(self, text, font):
        key = (text, font)
        if key not in self.cache:
            self.cache[key] = self.pg.evaluate(
                "([t, f]) => { const c = (window._c ||= document.createElement('canvas').getContext('2d')); c.font = f; return c.measureText(t).width; }",
                [text, font])
        return self.cache[key]

    def bbox(self, svg_text):
        """The drawn box of an SVG file's artwork, in its own viewBox units, and its viewBox."""
        return self.pg.evaluate("""(src) => {
            const d = document.createElement('div'); d.innerHTML = src; document.body.appendChild(d);
            const s = d.querySelector('svg'); s.setAttribute('width', '400'); s.setAttribute('height', '400');
            const vb = s.viewBox.baseVal; let b = null;
            for (const el of s.querySelectorAll('path, rect, circle, polygon, ellipse')) {
              if (el.closest('clipPath, defs')) continue;
              const r = el.getBBox(); if (!r.width && !r.height) continue;
              b = b ? {x0: Math.min(b.x0, r.x), y0: Math.min(b.y0, r.y), x1: Math.max(b.x1, r.x + r.width), y1: Math.max(b.y1, r.y + r.height)}
                    : {x0: r.x, y0: r.y, x1: r.x + r.width, y1: r.y + r.height};
            }
            d.remove();
            return {vb: [vb.x, vb.y, vb.width, vb.height], box: [b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0]};
        }""", svg_text)

    def close(self):
        self.b.close()
        self._cm.__exit__(None, None, None)


if __name__ == '__main__':
    m = Meter()
    font = sys.argv[1]
    for t in sys.argv[2:]:
        print(f'{m.w(t, font):7.1f}  {t}')
    m.close()
