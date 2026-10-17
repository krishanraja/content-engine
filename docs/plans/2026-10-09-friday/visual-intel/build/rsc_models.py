"""Pull model records out of an Artificial Analysis page's embedded Next.js data.

Usage: python3 -I rsc_models.py PAGE.html [slug ...]
Prints one JSON line per model record found (deduplicated by slug), restricted
to the given slugs if any. Reads only; writes nothing.
"""
import json
import re
import sys

def rsc_text(html):
    out = []
    for m in re.finditer(r'self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)', html):
        try:
            out.append(json.loads('"' + m.group(1) + '"'))
        except Exception:
            pass
    return "".join(out)

def records(text):
    dec = json.JSONDecoder()
    seen = {}
    for m in re.finditer(r'\{"id":"[0-9a-f-]{36}","slug":"', text):
        try:
            obj, _ = dec.raw_decode(text, m.start())
        except Exception:
            continue
        if not isinstance(obj, dict):
            continue
        if "intelligenceIndex" not in obj and "intelligenceIndexCost" not in obj and "evaluations" not in obj:
            continue
        slug = obj.get("slug")
        prev = seen.get(slug)
        if prev is None or len(json.dumps(obj)) > len(json.dumps(prev)):
            seen[slug] = obj
    return seen

def main():
    html = open(sys.argv[1], encoding="utf-8").read()
    want = set(sys.argv[2:])
    text = rsc_text(html)
    recs = records(text)
    for slug, o in recs.items():
        if want and slug not in want:
            continue
        ev = o.get("evaluations") if isinstance(o.get("evaluations"), dict) else {}
        row = {
            "slug": slug,
            "name": o.get("name"),
            "shortName": o.get("shortName"),
            "effort": (o.get("effort") or {}).get("slug") if isinstance(o.get("effort"), dict) else o.get("effort"),
            "isReasoning": o.get("isReasoning"),
            "releaseDate": o.get("releaseDate"),
            "deprecated": o.get("deprecated"),
            "intelligenceIndex": o.get("intelligenceIndex", ev.get("artificial_analysis_intelligence_index")),
            "intelligenceIndexCostTotal": (o.get("intelligenceIndexCost") or {}).get("total") if isinstance(o.get("intelligenceIndexCost"), dict) else None,
            "intelligenceIndexCostPerTask": o.get("intelligenceIndexCostPerTask"),
            "keys": sorted(o.keys())[:80],
        }
        print(json.dumps(row))

if __name__ == "__main__":
    main()
