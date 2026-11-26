"""Sample the fitted headline or figure after the unmodified cover has been saved."""
from io import BytesIO
from pathlib import Path

from PIL import Image

from thumb_gate import type_metrics

PROBE = Path(__file__).with_name("hook_probe.js")
HIDE_INK = "[data-gate-hook], [data-gate-hook] * { -webkit-text-fill-color: transparent !important; }"
GLYPH_MASK = """
html, body { background: black !important; }
body * { visibility: hidden !important; }
body::after { content: none !important; }
body [data-gate-hook], body [data-gate-hook] * {
    visibility: visible !important; background: transparent !important;
    -webkit-text-fill-color: white !important; text-shadow: none !important;
}
"""
CAP_SAMPLE = """properties => {
    const cap = document.createElement('span');
    cap.setAttribute('data-cap-sample', '');
    cap.style.cssText = 'position:fixed;top:0;left:0;z-index:2147483647;width:max-content;' +
        'line-height:normal;background:black;color:white;padding:4px;white-space:pre';
    for (const [name, value] of Object.entries(properties)) cap.style.setProperty(name, value);
    cap.textContent = 'H';
    document.body.append(cap);
}"""


def pixels(data):
    with Image.open(BytesIO(data)) as image:
        return image.convert("RGB")


def measure_wide_type(page, output):
    probe = page.evaluate(PROBE.read_text(encoding="utf-8"))
    encoding = {"type": "jpeg", "quality": 95} if output.suffix == ".jpg" else {"type": "png"}
    background = pixels(page.screenshot(style=HIDE_INK, **encoding))
    mask = pixels(page.screenshot(type="png", style=GLYPH_MASK)).convert("L")
    caps = []
    for face in probe["faces"]:
        page.evaluate(CAP_SAMPLE, face)
        sample = page.locator("[data-cap-sample]")
        caps.append(pixels(sample.screenshot(type="png")).convert("L"))
        sample.evaluate("node => node.remove()")
    with Image.open(output) as cover:
        return type_metrics(cover.convert("RGB"), background, mask, probe["glyphs"], caps)
