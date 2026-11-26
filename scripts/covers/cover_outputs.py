"""Post-pack filenames and byte-bound acceptance of an image-led render."""
import hashlib
import json
from pathlib import Path

OUTPUTS = {"youtube": ("thumb-wide-1280x720.jpg", (1280, 720)),
           "substack": ("cover-1200x630.png", (1200, 630)),
           "vertical": ("cover-1080x1920.png", (1080, 1920)),
           "tall": ("thumb-tall-1080x1920.jpg", (1080, 1920)),
           "carousel": ("carousel/slide-01.png", (1080, 1350))}
PACK = {"youtube": {"kind": "thumbnail", "shape": "wide"}, "substack": {"kind": "substack-cover"},
        "vertical": {"kind": "vertical-cover"}, "tall": {"kind": "thumbnail", "shape": "tall"},
        "carousel": {"category": "social", "purpose": "First slide of the carousel."}}


def receipt(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    if (data.get("renderer") != "scripts/covers/make_covers.py" or data.get("status") != "passed"
            or data.get("issues") != []):
        raise ValueError(f"{path.name}: cover rendering is held or incomplete")
    return data


def validate_file(source, fmt, data, logos=()):
    name, size = OUTPUTS[fmt]
    row = next((r for r in data["files"] if r["format"] == fmt and r["file"] == name), {})
    if (source.name != Path(name).name or row.get("dimensions") != list(size) or row.get("safe_area") != []
            or row.get("sha256") != hashlib.sha256(source.read_bytes()).hexdigest()):
        raise ValueError(f"covers.json does not match {source.name} as {fmt}")
    gate = row.get("gate_160", {})
    required = {"colour", "contrast", "light", "busy"}
    if fmt in {"youtube", "substack"}:
        required.update(("cap_height_px", "local_contrast"))
    if gate.get("fails") != [] or not required.issubset(gate.get("metrics", {})):
        raise ValueError(f"{source.name} has no passing 160 px gate")
    if set(logos) - set(row["logos"]):
        raise ValueError(f"{source.name} declares a logo absent from its receipt")
    return row


def pack_entries(path, piece_id=None):
    data = receipt(path)
    if piece_id and data.get("piece_id") != piece_id:
        raise ValueError("covers.json belongs to a different piece")
    entries = []
    for fmt, (name, size) in OUTPUTS.items():
        source = path.parent / name
        row = validate_file(source, fmt, data)
        entries.append(dict(PACK[fmt], file=str(source.resolve()), logos=row["logos"]))
    entries.append({"category": "covers", "file": str(path.resolve()), "name": "covers.json",
                    "purpose": "Cover families, image credits and checks for this post."})
    return entries
