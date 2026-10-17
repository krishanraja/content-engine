"""Check the page's own bar label on the rendered 'Cost to Run Artificial Analysis Intelligence Index' chart.

Usage: python3 -I chart_labels.py CACHE_DIR SLUG
Needs SLUG.waitfor.md (rendered markdown) and SLUG.html (raw HTML with embedded data).
Maps chart bars to labels by position: the chart lists linked models in bar order and prints
one total label per bar, in the same order, after the stacked-segment labels. The mapping is
accepted only if every linked model's embedded total, rounded to whole dollars, matches its label.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rsc_models import rsc_text, records  # noqa: E402

def fmt(x):
    return "${:,.0f}".format(x)

def section(md, title):
    i = md.find("### " + title)
    j = md.find("### " + title, i + 10)
    return md[i:j] if i >= 0 and j > i else None

def main():
    cache, slug = sys.argv[1], sys.argv[2]
    md = open(os.path.join(cache, slug + ".waitfor.md"), encoding="utf-8").read()
    html = open(os.path.join(cache, slug + ".html"), encoding="utf-8").read()
    recs = records(rsc_text(html))
    out = {"slug": slug}
    for title, key in (("Cost to Run Artificial Analysis Intelligence Index", "costToRun"),
                       ("Cost per Intelligence Index Task", "costPerTask")):
        sec = section(md, title)
        if sec is None:
            out[key] = {"status": "section not found"}
            continue
        links = re.findall(r"^\[([^\]]+)\]\(https://artificialanalysis\.ai/models/([a-z0-9-]+)\)", sec, re.M)
        lab_lines = [l for l in sec.splitlines() if l.startswith("$")]
        tokens = re.findall(r"\$([\d,]+(?:\.\d+)?)(\\\*)?", lab_lines[0]) if lab_lines else []
        labels = [("$" + t[0], bool(t[1])) for t in tokens]
        exp = []
        for name, s in links:
            r = recs.get(s, {})
            if key == "costToRun":
                v = (r.get("intelligenceIndexCost") or {}).get("total")
                exp.append(fmt(v) if v is not None else None)
            else:
                v = ((r.get("intelligenceIndexCostPerTask") or {}).get("cost") or {}).get("total")
                exp.append("${:.2f}".format(v) if v is not None else None)
        n = len(exp)
        match_at = None
        for i in range(0, len(labels) - n + 1):
            if all(e is None or labels[i + k][0] == e for k, e in enumerate(exp)):
                match_at = i
                break
        own = None
        if match_at is not None:
            for k, (name, s) in enumerate(links):
                if s == slug:
                    own = {"bar_name": name, "label": labels[match_at + k][0], "footnote_star": labels[match_at + k][1], "position": k + 1, "of": n}
        out[key] = {
            "status": "all %d bars match embedded values" % n if match_at is not None else "no exact match",
            "own_bar": own,
            "bars": [{"name": nm, "slug": s, "label": (labels[match_at + k][0] if match_at is not None else None), "expected": exp[k]} for k, (nm, s) in enumerate(links)],
        }
    print(json.dumps(out, indent=1))

if __name__ == "__main__":
    main()
