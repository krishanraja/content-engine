"""Capture the proposed library sheets and individual exports."""
import json
import argparse
from encode_motion import encode_motion
from pixel_alignment import inspect_item
import hashlib
import base64
import io

from PIL import Image
import asyncio
import os
from pathlib import Path
from urllib.parse import urlencode
import subprocess
from unittest.mock import patch
from contextlib import ExitStack, contextmanager, nullcontext
from functools import partial
import sys


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
OUT = ROOT / ".scratch/library/out"


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


FIT_FAILURES = []


def carousel_pack_script(path):
    pack = json.loads(path.read_text(encoding='utf-8'))
    images = pack.get('images', {})
    evidence = pack.get('evidence', {})
    assets = [asset for slots in images.values() for asset in slots.values()]
    for group in ('screenshots', 'tool_logos'):
        assets.extend(evidence.get(group, {}).values())
    for asset in assets:
        source = (path.parent / asset['src']).resolve(strict=True)
        asset['src'] = source.as_uri()
    bindings = {'libraryContent': pack.get('content', {}), 'libraryImages': images,
                'libraryEvidence': evidence}
    return 'Object.assign(window,' + json.dumps(bindings) + ')'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check-only", action="store_true", help="Verify layout with WebKit without saving sheets")
    parser.add_argument("--motion", action="store_true", help="Encode all item timelines and sequences")
    parser.add_argument("--alignment-only", action="store_true",
                        help="Check native horizontal ink edges, vertical ink gaps and close pixels, skipping sheets and motion")
    parser.add_argument("--phone", action="store_true", help="Also save 360 px wide item proofs from the native capture")
    parser.add_argument("--carousel-pack", type=Path, help="Load per-piece copy, generated images and original evidence from this JSON file")
    parser.add_argument("--items", type=lambda text: [name for name in text.split(",") if name],
                        help="With --carousel-pack: render only these template IDs (comma separated), with their fit and ink checks")
    parser.add_argument("--rasterizer", choices=("browser", "resvg"), default="browser",
                        help="Native backend for alignment, approval or changed-only exports")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--lock', metavar='ID', help='Record approval for this template and its exact frames')
    mode.add_argument('--unlock', metavar='ID', help='Withdraw an approval and retain the reason')
    mode.add_argument('--check-locks', action='store_true', help='Verify only approved templates')
    mode.add_argument('--changed', action='store_true', help='Render missing or changed item exports')
    parser.add_argument('--approved-by', help='Name of the person who approved the template')
    parser.add_argument('--words', help='Verbatim approval')
    parser.add_argument('--reason', help='Withdrawal reason or path to a brief naming the template')
    args = parser.parse_args()
    if any(key is not None and not key.strip() for key in (args.lock,args.unlock)):
        parser.error('Supply the template ID for the approval or withdrawal')
    if args.lock and not all(v and v.strip() for v in (args.approved_by,args.words)):
        parser.error('--lock requires --approved-by and --words')
    if args.unlock and not (args.reason and args.reason.strip()):
        parser.error('--unlock requires --reason')
    if (not args.lock and (args.approved_by is not None or args.words is not None)
            or not args.unlock and args.reason is not None):
        parser.error('Approval metadata belongs to --lock and the withdrawal reason to --unlock')
    locking = args.lock or args.unlock or args.check_locks
    if ((locking or args.changed) and (args.alignment_only or args.carousel_pack or args.check_only)
            or locking and (args.motion or args.phone)):
        parser.error('Select one lock, render or review job')
    if args.items and not args.carousel_pack:
        parser.error('--items selects templates for a --carousel-pack render')
    if not locking and not args.changed and args.rasterizer=='resvg' and not args.alignment_only:
        parser.error('Use resvg with --changed, --lock or --alignment-only')
    from render_inputs import load_registry, active_items
    from render_lock import guard, ledger, verify, change_lock
    from render_cache import export
    from frame_capture import native_frames, browser_frames
    access = nullcontext() if args.check_locks else guard(HERE)
    with access, ExitStack() as stack:
        page = None
        def capture(backend):
            nonlocal page
            if backend=='resvg':
                return partial(native_frames,HERE)
            if page is None:
                page = stack.enter_context(capture_page())
            return partial(browser_frames,page,HERE)
        book = ledger(HERE)
        if args.check_locks and not book['locked']:
            print('Lock check passed (0 locked templates).')
            return
        try:
            registry, _ = load_registry(HERE)
            items = active_items(registry)
        except (ValueError,KeyError,IndexError,OSError) as exc:
            if args.check_locks:
                names = ', '.join(row['id'] for row in book['locked'])
                raise ValueError(f'Cannot verify {names}: {exc}') from exc
            raise
        if args.lock or args.unlock:
            change_lock(args,HERE,items,book,capture)
        elif args.check_locks:
            verify(book['locked'],items,capture,HERE/'.scratch/library')
            if ledger(HERE)!=book:
                raise ValueError('Approvals changed during verification. Rerun --check-locks.')
        elif args.changed:
            export(HERE,OUT,args.rasterizer,book,capture,phone=args.phone,motion=args.motion)
        else:
            if args.phone and (args.check_only or args.motion):
                parser.error('--phone needs a native item render')
            if args.alignment_only and args.motion:
                parser.error('--motion and --alignment-only select different jobs')
            if not any((args.alignment_only,args.check_only,args.carousel_pack)):
                export(HERE,OUT,'browser',book,capture,full=lambda staging:render_full(args,staging),
                       phone=args.phone,motion=args.motion,only_motion=args.motion)
            else:
                if book['locked']:
                    verify(book['locked'],items,capture,HERE/'.scratch/library')
                # A story pack may replace photos and copy on an approved template.
                target = OUT
                if args.carousel_pack:
                    pack_id = hashlib.sha256(args.carousel_pack.read_bytes()).hexdigest()[:16]
                    target = OUT/'packs'/pack_id
                    print(f'Story pack outputs: {target}',flush=True)
                render_full(args,target)


@contextmanager
def capture_page():
    from playwright.sync_api import sync_playwright
    stdio = (patch('asyncio.create_subprocess_exec',anonymous_driver) if os.name=='nt' else nullcontext())
    with stdio, sync_playwright() as engine:
        browser = engine.chromium.launch(channel='chromium',headless=True,
                      args=['--disable-background-networking','--allow-file-access-from-files'])
        try:
            page = browser.new_page(device_scale_factor=1,offline=True)
            page.set_default_timeout(180000)
            yield page
        finally:
            browser.close()


def render_full(args, out=OUT):
    width, height = 2400, 2000
    if args.rasterizer == "resvg":
        if not args.alignment_only or args.motion or args.phone or args.carousel_pack or args.check_only:
            raise ValueError("Select --alignment-only for resvg proof mode")
        from native_proof import check
        check(json.loads((HERE / "library.json").read_text(encoding="utf8")))
        return
    pack_script = carousel_pack_script(args.carousel_pack) if args.carousel_pack else None
    check_only = args.check_only
    alignment = {}
    spacing = {}
    closing_pixels = {}
    if args.phone:
        (out / "phone").mkdir(parents=True, exist_ok=True)
    if not check_only and not args.motion:
        for folder in ("sheets", "items", "stress"):
            (out / folder).mkdir(parents=True, exist_ok=True)
    stdio = (patch("asyncio.create_subprocess_exec", anonymous_driver)
             if os.name == "nt" else nullcontext())
    from playwright.sync_api import sync_playwright
    with stdio, sync_playwright() as engine:
        browser = engine.webkit.launch(executable_path=os.getenv("WEBKIT_EXECUTABLE")) if check_only else engine.chromium.launch(channel="chromium", headless=True, args=["--disable-background-networking", "--allow-file-access-from-files"])
        page = browser.new_page(viewport={"width": width, "height": height},
                                device_scale_factor=1, offline=True)
        if pack_script:
            page.add_init_script(pack_script)
        page.set_default_timeout(180000)
        registry = json.loads((HERE / "library.json").read_text(encoding="utf-8"))
        html = (HERE / "library.html").read_text(encoding="utf-8")
        embedded = html.split("const registry=", 1)[1].split(";\n", 1)[0]
        assert json.loads(embedded) == registry, "Refresh the embedded offline library from library.json"
        if args.motion:
            encode_motion(page, registry, HERE / "library.html", out / "motion")
            browser.close()
            return
        records = [item for item in registry["items"] if item.get("status") != "retired"]
        by_id = {item["id"]: item for item in records}
        families = list(dict.fromkeys(row["family"] for row in records))
        previews = {}
        jobs = [("items", "item", row["id"], row["width"], row["height"]) for row in records]
        jobs.extend(("sheets", "view", name, width, height) for name in ["index", *families])
        jobs = [(folder, name, {key: name}, w, h) for folder, key, name, w, h in jobs]
        cases = ("short", "long", "word", "nophoto", "brightphoto", "doc-long", "numbers")
        jobs.extend(("stress", f"{family}-{case}", {"view": family, "stress": case, "grid": 1}, width, height)
                    for family in families for case in cases)
        if args.alignment_only:
            jobs = [job for job in jobs if job[0] == "items"]
        if getattr(args, "items", None):
            unknown = sorted(set(args.items) - set(by_id))
            if unknown:
                raise ValueError("Unknown or retired template IDs: " + ", ".join(unknown))
            jobs = [job for job in jobs if job[0] == "items" and job[1] in args.items]
        for folder, name, query, w, h in jobs:
            page.set_viewport_size({"width": w, "height": h})
            if name == "index" and folder == "sheets":
                page.add_init_script("window.itemPreviews = " + json.dumps(previews))
            page.goto(f"{(HERE / 'library.html').as_uri()}?{urlencode(query)}")
            page.evaluate("window.ready")
            page.evaluate("""async () => {
                const paths = [...document.querySelectorAll('main image')].map(el => el.getAttribute('href'));
                await Promise.all([...new Set(paths)].map(src => {
                    const image = new Image();
                    image.src = src;
                    return image.decode();
                }));
            }""")
            violations = page.locator("text[data-bounds]").evaluate_all("""nodes => nodes.flatMap(node => {
                const [x, y, w, h] = node.dataset.bounds.split(' ').map(Number);

                // SVG text boxes include font leading. Canvas glyph metrics give the painted bounds.
                const context = document.createElement('canvas').getContext('2d');
                const style = getComputedStyle(node);
                context.font = [style.fontStyle, style.fontWeight, style.fontSize, style.fontFamily].join(' ');
                const tracking = parseFloat(style.letterSpacing)||0;
                const supportsTracking = 'letterSpacing' in context;
                if (supportsTracking) context.letterSpacing = tracking+'px';
                const glyphs = context.measureText(node.textContent);
                const baseline = node.y.baseVal[0].value;
                const origin = node.x.baseVal[0].value;
                const spacing = (supportsTracking ? 0 : tracking)*Math.max(0,[...node.textContent].length-1);
                const size = parseFloat(style.fontSize);
                const bearing = node.getAttribute('font-family')==='Anton' && size>=256
                    ? posterBearing(node.textContent[0],context.font,size) : glyphs.actualBoundingBoxLeft;
                const fits = origin-bearing >= x-1 && origin+glyphs.actualBoundingBoxRight+spacing <= x+w+1 &&
                    baseline - glyphs.actualBoundingBoxAscent >= y - 1 &&
                    baseline + glyphs.actualBoundingBoxDescent <= y + h + 1;
                return fits ? [] : [node.dataset.slot];
            })""")
            if violations:
                FIT_FAILURES.append((folder, name, violations)); print('FIT', folder, name, violations, flush=True)
            if folder != "items":
                h = page.locator("main").evaluate("el => Math.ceil(el.getBoundingClientRect().height)")
                page.set_viewport_size({"width": w, "height": h})
            else:
                bounds = page.locator("main > svg").bounding_box()
                assert bounds and bounds["width"] == w and bounds["height"] == h, name
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight"), name
            png = page.screenshot()
            if folder == "items":
                alignment[name] = inspect_item(page, png, by_id[name], templates=by_id)
                spacing[name] = alignment[name].pop("spacing")
                if not spacing[name]["passed"]:
                    print("SPACING", name, [r for r in spacing[name]["pairs"] if not r["passed"]], flush=True)
                if not alignment[name]["passed"]:
                    print("INK", name, [r for r in alignment[name]["elements"] if not r["passed"]], flush=True)
                if name in {f"video-{shape}-{ending}" for shape in ("vertical","wide") for ending in ("close","outro")}:
                    closing_pixels[name] = hashlib.sha256(Image.open(io.BytesIO(png)).tobytes()).hexdigest()
                with Image.open(io.BytesIO(png)) as image:
                    if args.phone:
                        size = (360, max(1, round(image.height*360/image.width)))
                        image.resize(size, Image.Resampling.LANCZOS).save(out / "phone" / f"{name}.png")
                    image.thumbnail((520, 1000), Image.Resampling.LANCZOS)
                    stream = io.BytesIO()
                    image.convert("RGB").save(stream, "JPEG", quality=92)
                    previews[name] = "data:image/jpeg;base64," + base64.b64encode(stream.getvalue()).decode("ascii")
            if not check_only and not args.alignment_only:
                (out / folder / f"{name}.png").write_bytes(png)
        browser.close()
    out.mkdir(parents=True, exist_ok=True)
    (out / "fit-failures.json").write_text(json.dumps(FIT_FAILURES, indent=1))
    matches = {shape: closing_pixels.get(f"video-{shape}-close") == closing_pixels.get(f"video-{shape}-outro")
               for shape in ("vertical","wide")
               if not getattr(args, "items", None) or {f"video-{shape}-close", f"video-{shape}-outro"} <= set(args.items)}
    (out / "ink-alignment.json").write_text(json.dumps({
        "tolerance_px": 2, "vertical_close_matches_outro": matches.get("vertical"),
        "wide_close_matches_outro": matches.get("wide"), "items": alignment
    }, indent=2), encoding="utf-8")
    (out / "ink-spacing.json").write_text(json.dumps({"method": "native pixel difference", "items": spacing}, indent=2), encoding="utf-8")
    short = [name for name, record in spacing.items() if not record["passed"]]
    failed = [name for name, result in alignment.items() if not result["passed"]]
    if FIT_FAILURES or failed or short or not all(matches.values()):
        raise SystemExit(f"Fit failures {len(FIT_FAILURES)}, ink failures {failed}, spacing failures {short}, matching closes {matches}")
    pair_count = sum(len(row["pairs"]) for row in spacing.values())
    closes = " Both closes match their outros." if len(matches) == 2 else ""
    print(f"Checked {len(alignment)} native items and {pair_count} ink gaps.{closes}")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, OSError, RuntimeError, subprocess.CalledProcessError) as error:
        sys.exit(str(error))
