"""Offline reproduction of ref/P/tools vectors and a procedural paper substitute.

The historical make_paper.py photographs are not in this checkout. This preserves
its seeded, normalised fine-crinkle treatment without inventing photo provenance.
Run from the repository root. No dependencies are installed by this script.
"""
import base64
import hashlib
import json
from pathlib import Path
import re
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
REFERENCE = ROOT / "docs/ve/design/formats/ref/P/tools"


def rgb(match):
    value = match.group(1)
    return "rgb(" + ",".join(str(int(value[i:i+2], 16)) for i in (0, 2, 4)) + ")"


def build():
    from PIL import Image, ImageFilter
    import numpy as np

    # The supplied generator writes to ROOT/assets; remap that literal only.
    source = (REFERENCE / "make_vectors.py").read_text(encoding="utf-8")
    source = source.split('if __name__ == "__main__":')[0].replace('"assets/', '"')
    namespace = {"__name__": "passport_reference"}
    exec(compile(source, "make_vectors.py", "exec"), namespace)
    namespace["ROOT"] = OUT.as_posix() + "/"
    namespace["guilloche_page"]()
    namespace["rosette"]()
    for country in ("usa", "china"):
        (OUT / f"flag-{country}.svg").write_text(namespace[f"flag_{country}"](), encoding="utf-8")
    for path in OUT.glob("*.svg"):
        path.write_text(re.sub(r"#([A-Fa-f0-9]{6})", rgb, path.read_text(encoding="utf-8")), encoding="utf-8")
    kit = ROOT / "apps/renderer/src/engine/kit"
    for country in ("usa", "china"):
        (kit / f"flags-{country}.svg").write_bytes((OUT / f"flag-{country}.svg").read_bytes())

    rng = np.random.default_rng(7)
    noise = rng.normal(128, 28, (900, 640)).clip(0, 255).astype(np.uint8)
    crinkle = Image.fromarray(noise).filter(ImageFilter.GaussianBlur(0.5)).resize((1088, 1530), Image.Resampling.LANCZOS)
    texture = np.asarray(crinkle).astype(np.float32)
    texture = (texture - texture.mean()) / max(float(texture.std()), 1e-6)
    # A neutral luminance texture multiplies the renderer's cream token.
    paper = np.clip(248 + texture * 5, 0, 255).astype(np.uint8)
    Image.fromarray(paper).convert("RGB").save(OUT / "paper.jpg", quality=90)
    files = {"paper": "paper.jpg", "guilloche": "guilloche.svg", "rosette": "rosette.svg",
             "usa": "flag-usa.svg", "china": "flag-china.svg"}
    bundle = {}
    for key, name in files.items():
        mime = "image/jpeg" if name.endswith("jpg") else "image/svg+xml"
        bundle[key] = f"data:{mime};base64," + base64.b64encode((OUT / name).read_bytes()).decode("ascii")
    (ROOT / "apps/renderer/src/engine/kit/passport-plates.json").write_text(json.dumps(bundle, indent=2) + "\n", encoding="utf-8")
    sidecar = {
        "format": "two-passports", "date": "2026-10-28", "model": "none; offline deterministic scripts",
        "prompt": "No image generation. Reproduce supplied reference vectors; procedural neutral paper texture.",
        "candidates": 1, "chosen": "deterministic reference reproduction", "credits": 0,
        "credits_logged": 0, "plate_px": [900, 1700],
        "note": "Flags are simplified illustrations. Production must use a licensed open set. Every composition using these plates requires ILLUSTRATION.",
        "paper_substitution": "Historical blank-paper source photographs are absent. Seed 7 procedural crinkle replaces source sampling; this is not photographic reproduction or evidence.",
        "source": "docs/ve/design/formats/ref/P/tools/make_vectors.py and make_paper.py",
        "files": {name: {"sha256": hashlib.sha256((OUT / name).read_bytes()).hexdigest(),
                         "role": key} for key, name in files.items()},
        "reference_sha256": {name: hashlib.sha256((REFERENCE / name).read_bytes()).hexdigest()
                             for name in ("make_vectors.py", "make_paper.py")},
    }
    (OUT / "plates.json").write_text(json.dumps(sidecar, indent=2) + "\n", encoding="utf-8")
    print("Built five offline plates, provenance sidecar and embedded renderer bundle")


if __name__ == "__main__":
    build()
