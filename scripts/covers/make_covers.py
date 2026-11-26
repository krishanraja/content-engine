#!/usr/bin/env python3
"""Render the image-led cover set from a piece folder or a cover-facts file."""
import argparse
from contextlib import ExitStack, contextmanager, nullcontext
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
from unittest.mock import patch

from PIL import Image
from playwright.sync_api import sync_playwright

from cover_outputs import OUTPUTS
from cover_facts import pick, previous_families, read, resolve_stills
from layout import ROOT, credit, document

LIBRARY = ROOT / "docs/ve/cards/library"
sys.path.insert(0, str(LIBRARY))
from thumb_gate import measure
from frame_capture import workspace
from proof import capture


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_record(path, value):
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp.replace(path)


@contextmanager
def browser_session():
    if os.name == "nt":
        from render import anonymous_driver
        pipe = patch("asyncio.create_subprocess_exec", anonymous_driver)
    else:
        pipe = nullcontext()
    with pipe, sync_playwright() as engine:
        browser = engine.chromium.launch()
        try:
            yield browser
        finally:
            browser.close()


def safe_area(fmt, regions):
    width, height = OUTPUTS[fmt][1]
    issues = []
    for rect in regions:
        role = rect["role"]
        top, bottom, left, right = 0, height, 0, width
        if fmt == "vertical":
            if role in ("text", "mark"):
                top, bottom = 330, 1180
            elif role == "subject":
                top, bottom = 240, 1680
            elif role == "proof":
                right = 930
                top, bottom = 330, 1180
        if fmt == "carousel" and role in ("text", "mark"):
            left, right = 34, width - 34
        if (rect["left"] < left - 0.5 or rect["right"] > right + 0.5 or
                rect["top"] < top - 0.5 or rect["bottom"] > bottom + 0.5):
            issues.append(f"{role} outside {left},{top} to {right},{bottom}")
    return list(dict.fromkeys(issues))


def screenshot(browser, html, fmt, output):
    width, height = OUTPUTS[fmt][1]
    pg = browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=1, offline=True)
    try:
        pg.goto(html.as_uri())
        regions = pg.evaluate("window.coverReady")
        kwargs = {"quality": 95} if output.suffix == ".jpg" else {}
        pg.screenshot(path=output, **kwargs)
        return safe_area(fmt, regions)
    finally:
        pg.close()


def build(facts_path, out, systems, assets=None, review=None):
    facts_path = facts_path.resolve()
    if facts_path.is_dir():
        facts_path /= "cover-facts.json"
    facts = read(facts_path)
    base = (assets or facts_path.parent).resolve()
    out = out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    if review:
        review = review.resolve()
        if review == out:
            raise ValueError("Use separate review and post-pack directories.")
        review.mkdir(parents=True, exist_ok=True)
    record = {"renderer": "scripts/covers/make_covers.py", "piece_id": facts.get("piece_id"),
              "date": facts["date"], "facts": facts_path.name, "facts_sha256": digest(facts_path),
              "families": {}, "inputs": {}, "credits": [], "still_briefs": [], "files": [], "issues": []}
    # A consumer verifies this receipt before taking bytes, including during a rerun.
    lock = out / ".covers-running"
    try:
        lock.touch(exist_ok=False)
    except FileExistsError:
        raise ValueError(f"Another render owns {lock}. If the process died, remove its lock before retrying.") from None
    try:
        record["status"] = "rendering"
        write_record(out / "covers.json", record)
        previous = previous_families(facts, base)
        record["previous_published"] = previous
        families = record["families"]
        for system in systems:
            families[system] = pick(facts, base, system, previous["families"])
        art = facts.get("image_led", {})
        record["inputs"].update(series=facts["subchannel"], thumbnails=facts["thumbs"]["headline"],
                                cover=facts["cover"]["headline"], figure=art.get("figure"))
        if "portrait" in families.values():
            per = art["person"]
            record["credits"].append({"line": credit(per), "file_page": per["file_page"], "license": per["license"]})
            record["inputs"]["portrait"] = {"file": per["image"], "sha256": digest(base / per["image"])}
        stills = resolve_stills(facts, base, families, record["still_briefs"])
        record["inputs"]["stills"] = {key: {"file": path.name, "sha256": digest(path)} for key, path in stills.items()}
        with workspace(out) as stage, ExitStack() as stack:
            browser = None

            def get_browser():
                nonlocal browser
                if browser is None:
                    browser = stack.enter_context(browser_session())
                return browser

            proof = None
            if set(families.values()) & {"receipt", "evidence"}:
                spec = facts["cover"]["proof"]
                proof = capture(get_browser, facts, base, ROOT / ".cache/image-led-proofs")
                record["inputs"]["proof"] = {"source": spec, "file": proof.name, "sha256": digest(proof)}
            jobs = []
            for system, family in families.items():
                for fmt in (("youtube", "substack") if system == "wide" else ("vertical", "carousel")):
                    html, logos = document(facts, base, fmt, family, stills.get(system), proof)
                    doc = stage / f"{fmt}.html"
                    doc.write_text(html, encoding="utf-8")
                    if review:
                        shutil.copyfile(doc, review / doc.name)
                    jobs.append((fmt, doc, logos))
            for fmt, doc, logos in jobs:
                name, size = OUTPUTS[fmt]
                dest = stage / name
                dest.parent.mkdir(exist_ok=True)
                problems = screenshot(get_browser(), doc, fmt, dest)
                files = [(fmt, dest)]
                if fmt == "vertical":
                    tall = stage / OUTPUTS["tall"][0]
                    with Image.open(dest) as image:
                        image.convert("RGB").save(tall, quality=95)
                    files.append(("tall", tall))
                for channel, path in files:
                    item = {"format": channel, "file": OUTPUTS[channel][0], "dimensions": list(size),
                            "sha256": digest(path), "logos": logos, "safe_area": problems}
                    if channel in ("youtube", "substack"):
                        metrics, fails = measure(path)
                        item["gate_160"] = {"metrics": metrics, "fails": fails}
                        record["issues"].extend(f"{channel}: 160 px {failure}" for failure in fails)
                    if channel == "youtube" and path.stat().st_size > 2 * 1024 * 1024:
                        record["issues"].append("YouTube thumbnail exceeds 2 MiB")
                    record["files"].append(item)
                    record["issues"].extend(f"{channel}: {issue}" for issue in problems)
                    if review:
                        target = review / item["file"]
                        target.parent.mkdir(exist_ok=True)
                        shutil.copyfile(path, target)
            if not record["issues"]:
                for item in record["files"]:
                    target = out / item["file"]
                    target.parent.mkdir(exist_ok=True)
                    (stage / item["file"]).replace(target)
        record["status"] = "held" if record["issues"] else "passed"
    except Exception as exc:
        # A failed run invalidates the previous receipt even if a browser or converter crashed.
        record["issues"].append((str(exc) or type(exc).__name__).splitlines()[0])
    finally:
        if record["status"] == "rendering":
            record["status"] = "held"
        try:
            write_record(out / "covers.json", record)
        finally:
            lock.unlink()
    return record


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("piece", type=Path)
    parser.add_argument("--wide", action="store_true")
    parser.add_argument("--vertical", action="store_true")
    parser.add_argument("--out", type=Path)
    parser.add_argument("--assets", type=Path, help="Base directory for the piece's relative asset paths")
    parser.add_argument("--review-dir", type=Path, help="Keep review HTML and candidate images, including held candidates")
    args = parser.parse_args()
    facts = args.piece / "cover-facts.json" if args.piece.is_dir() else args.piece
    out = args.out or ROOT / ".cache/covers" / facts.parent.name / facts.stem
    systems = [k for k in ("wide", "vertical") if getattr(args, k)] or ["wide", "vertical"]
    try:
        result = build(facts, out, systems, args.assets, args.review_dir)
    except (ValueError, OSError, KeyError) as exc:
        parser.exit(2, f"Cover render held: {exc}\n")
    print(f"{result['status']}: {out / 'covers.json'}")
    for issue in result["issues"]:
        print(issue)
    return 0 if result["status"] == "passed" else 2


if __name__ == "__main__":
    raise SystemExit(main())
