"""Compare native-size visible ink to the template's declared columns."""
import io
import math

from PIL import Image, ImageChops

from spacing import compare, include
from standard import audit


def difference_bounds(visible, hidden):
    difference = ImageChops.difference(visible.convert("RGB"), hidden.convert("RGB"))
    red, green, blue = difference.split()
    mask = ImageChops.lighter(red, ImageChops.lighter(green, blue))
    return mask.point(lambda value: 255 if value >= 12 else 0).getbbox()


def inspect_item(page, png, item, templates=None):
    nodes = page.locator("main [data-align-edge]")
    declarations = item["alignment"]["columns"]
    members = item["alignment"]["members"]
    optional = set(item["alignment"].get("optional", ()))
    # A per-piece pack may leave a Receipt row or verdict chip out by design (library.html, libraryScene).
    optional |= set(page.evaluate("id => (window.libraryDropped || {})[id] || []", item["id"]))
    visible = Image.open(io.BytesIO(png)).convert("RGB")
    results = []
    intervals = {}
    painted = {}
    members_seen = set()
    for index in range(nodes.count()):
        node = nodes.nth(index)
        info = node.evaluate("""el => {
            const r = el.getBoundingClientRect(), m = el.ownerSVGElement.getScreenCTM();
            return {name:el.dataset.alignName, side:el.dataset.alignSide,
                group:el.dataset.alignGroup, edge:Number(el.dataset.alignEdge),
                scale:m.a, offset:m.e, box:[r.left,r.top,r.right,r.bottom]};
        }""")
        member = info["name"]
        if member not in members:
            results.append(dict(passed=False, element=member, reason="No declared column"))
            continue
        group = members[member]
        edge = declarations[group]
        expected = edge * info["scale"] + info["offset"]
        members_seen.add(member)
        x, y, right, bottom = info["box"]
        x = max(0, math.floor(x) - 6)
        y = max(0, math.floor(y) - 6)
        right = min(visible.width, math.ceil(right) + 6)
        bottom = min(visible.height, math.ceil(bottom) + 6)
        actual = None
        if right > x and bottom > y:
            # Subtract the unchanged artwork with this one element hidden.
            # This isolates both light and dark letters, even over photographs.
            previous = node.evaluate("el => el.style.visibility")
            try:
                node.evaluate("el => { el.style.visibility = 'hidden' }")
                png_without = page.screenshot(clip={"x": x, "y": y,
                    "width": right-x, "height": bottom-y})
            finally:
                node.evaluate("(el,value) => { el.style.visibility = value }", previous)
            bounds = difference_bounds(visible.crop((x,y,right,bottom)), Image.open(io.BytesIO(png_without)))
            if bounds:
                actual = x + bounds[2 if info["side"] == "right" else 0]
                include(intervals, member, y+bounds[1], y+bounds[3])
                scale = abs(info['scale'])
                painted.setdefault(member, []).append(((bounds[2]-bounds[0])/scale,
                                                       (bounds[3]-bounds[1])/scale))
                if member in ('s3h','v4','v9'):
                    ground = Image.open(io.BytesIO(png_without)).convert('RGB').crop(bounds)
                    if any(lo < ink-25 or hi > ink+25
                           for (lo,hi),ink in zip(ground.getextrema(),(12,21,18))):
                        results.append(dict(element=member,passed=False,reason='STANDARD 6: wordmark outside ink'))
                if member == 'source logo':
                    ground = Image.open(io.BytesIO(png_without)).convert('RGB').crop(bounds)
                    tones = ground.getextrema()
                    if any(high-low>24 for low,high in tones):
                        results.append(dict(element=member,passed=False,reason='STANDARD 5: photographic ground'))
        delta = None if actual is None else round(actual-expected, 3)
        results.append(dict(group=group, element=info["name"], side=info["side"],
                            target=round(expected,3), pixel=actual, delta=delta,
                            passed=actual is not None and abs(actual-expected) <= 2))
    for member in members.keys()-members_seen-optional:
        results.append(dict(element=member, passed=False, reason="Declared element missing"))
    missing = page.locator("main text:not([data-align-edge])").count()
    if missing:
        results.append(dict(passed=False, reason=f"{missing} unmeasured text lines"))
    artwork = page.locator('main > svg').evaluate("""svg => {
        const xml = new XMLSerializer();
        return Array.from(svg.children, child => xml.serializeToString(child)).join('');
    }""")
    if item.get('colour_aperture') and (item['layout'].startswith('why-') or item['layout']=='rail'):
        zones = item['safe_zones']
        _,top,_,height = zones['content_box']
        bottom = zones['caption_band'][1]-item.get('headline_caption_gap',8) if 'caption_band' in zones else top+height
        extent = intervals.get('headline_1')
        if extent is None or abs(extent[1]-bottom)>2:
            results.append(dict(element='headline_1', passed=False, reason='Question misses the lower reading line'))
    for finding in audit(item, artwork, painted, raster=visible, templates=templates):
        results.append(dict(passed=False,reason='STANDARD '+finding))
    if item.get('staircase'):
        results.append(close_stage(item, visible))
    if item.get('headline_caption_gap'):
        results.append(preview_caption_gap(page, item))
    return {"spacing": compare(item, intervals, native=True), "passed": all(row["passed"] for row in results), "elements": results}

def close_stage(item, image):
    """Measure the coloured steps and the longest run of empty native rows."""
    import numpy as np
    pixels = np.asarray(image.convert('RGB')).astype(int)
    ink = np.array([12, 21, 18])
    occupied = (np.max(np.abs(pixels-ink), axis=2)>45).sum(axis=1) >= item['width']*.01
    blanks = np.flatnonzero(np.diff(np.r_[False, ~occupied, False].astype(int))).reshape(-1,2)
    longest = max((stop-start for start,stop in blanks),default=0)
    colours = [(255,106,77),(255,216,77),(183,166,255),(126,240,192)]
    edges = item.get('step_edges',[0,.25,.5,.75,1])
    heights = []
    for n,colour in enumerate(colours):
        x = int(item['width']*(edges[n]+edges[n+1])/2)
        match = np.all(np.abs(pixels[:,x,:]-colour)<24,axis=1)
        start = np.flatnonzero(~match)
        heights.append(int(len(match)-start[-1]-1) if len(start) else len(match))
    low,high = (.22,.28) if item['height']>item['width'] else (.20,.24)
    passed = (longest<=item['height']*.18 and low<=heights[-1]/item['height']<=high and
              all(a<b for a,b in zip(heights,heights[1:])))
    return dict(element='settled staircase',passed=bool(passed),steps_px=heights,quiet_px=int(longest))


def preview_caption_gap(page, item):
    """Measure actual question and first caption pixels on the same sheet preview."""
    page.evaluate("""id=>{
        const svg=document.querySelector('main > svg'), probe=document.createElementNS(svg.namespaceURI,'text');
        const item=items.find(i=>i.id===id);svg.replaceChildren(probe);
        probe.insertAdjacentHTML('beforebegin',art(item,400,probe));probe.remove();
    }""", item['id'])
    visible = Image.open(io.BytesIO(page.screenshot()))
    boxes = []
    try:
        for selector in ('[data-slot="headline_1"]','[data-layer="captions"] text'):
            nodes = page.locator('main '+selector)
            nodes.evaluate_all("els=>els.forEach(el=>el.setAttribute('visibility','hidden'))")
            try:
                boxes.append(difference_bounds(visible,Image.open(io.BytesIO(page.screenshot()))))
            finally:
                nodes.evaluate_all("els=>els.forEach(el=>el.removeAttribute('visibility'))")
    finally:
        page.evaluate("id=>window.drawFrame((items.find(i=>i.id===id).motion?.frames||1)-1)", item['id'])
    actual = boxes[1][1]-boxes[0][3] if all(boxes) else None
    return dict(element='headline to caption',gap_px=actual,passed=actual is not None and abs(actual-item['headline_caption_gap'])<=2)
