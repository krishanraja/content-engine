"""Measure the clear vertical rows between the ink of named reading groups."""
import math
import re
from xml.etree import ElementTree as ET


def include(bounds, name, top, bottom):
    previous = bounds.get(name, (top, bottom))
    bounds[name] = min(previous[0], top), max(previous[1], bottom)


def compare(item, bounds, native=False):
    rows = []
    for above, below, units in item["spacing_pairs"]:
        optional = item.get('alignment', {}).get('optional', ())
        if any(name in optional and name not in bounds for name in (above, below)):
            continue
        minimum = units * item["width"] / 1080
        if native:
            minimum = math.ceil(minimum)
        gap = None
        if above in bounds and below in bounds:
            gap = bounds[below][0] - bounds[above][1]
        rows.append(dict(above=above, below=below, minimum_px=round(minimum, 3),
                         above_bottom_px=round(bounds[above][1],3) if above in bounds else None,
                         below_top_px=round(bounds[below][0],3) if below in bounds else None,
                         gap_px=None if gap is None else round(gap, 3),
                         passed=gap is not None and gap + 0.001 >= minimum))
    return dict(width=item["width"], height=item["height"], passed=all(r["passed"] for r in rows), pairs=rows)


def model_bounds(markup, metrics, marks):
    """Read the settled SVG with its nested viewports and local font measurements."""
    result = {}
    def visit(el, offset=0, scale=1):
        tag = el.tag.split("}")[-1]
        if el.get("visibility") == "hidden":
            return
        get = lambda k: float(el.get(k, 0))
        for op, args in re.findall(r"(translate|scale)\(([^)]*)\)", el.get("transform", "")):
            v = list(map(float, re.split("[ ,]+", args.strip())))
            if op == "translate":
                offset += scale * (v[1] if len(v) > 1 else 0)
            else:
                scale *= v[-1]
        name = el.get("data-align-name") or el.get("data-spacing-name")
        if tag == "svg" and "viewBox" in el.attrib:
            _, vy, vw, vh = map(float, el.get("viewBox").split())
            s = min(get("width") / vw, get("height") / vh)
            offset += scale * (get("y") + (get("height") - s * vh) / 2 - vy*s)
            scale *= s
        if name:
            if tag == "text":
                y, size = get("y"), get("font-size")
                face = el.get("font-family", "Mono")
                style = "Italic" if el.get("font-style") == "italic" else ""
                font = metrics.get(face+style+el.get("font-weight", "400"), metrics[face])
                glyphs = [font.get(c, font["M"]) for c in "".join(el.itertext())]
                top = y - size * max(g[1] for g in glyphs)
                bottom = y + size * max(g[2] for g in glyphs)
            elif tag == "use":
                vy, vh, ink_y, ink_h = marks[el.get("href")[1:]]
                s = get("height") / vh
                top = get("y") + (ink_y - vy)*s
                bottom = top + ink_h*s
            else:
                rect = el if tag == "rect" else el.find("rect")
                if rect is None:
                    raise ValueError(f"Cannot measure spacing member {name}")
                top = float(rect.get("y", 0))
                bottom = top + float(rect.get("height"))
            include(result, name, offset+top*scale, offset+bottom*scale)
        for child in el:
            visit(child, offset, scale)
    visit(ET.fromstring("<svg>"+markup+"</svg>"))
    return result
