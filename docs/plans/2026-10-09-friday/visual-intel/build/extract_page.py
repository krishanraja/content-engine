"""Extract the visible Intelligence Index score and cost sentences from one AA model page,
plus the page's own embedded record (unrounded score, cost per task, total cost to run).

Usage: python3 -I extract_page.py CACHE_DIR SLUG
Prints one JSON object. Reads only.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rsc_models import rsc_text, records  # noqa: E402

def main():
    cache, slug = sys.argv[1], sys.argv[2]
    md = open(os.path.join(cache, slug + ".md"), encoding="utf-8").read()
    html = open(os.path.join(cache, slug + ".html"), encoding="utf-8").read()
    meta = json.load(open(os.path.join(cache, slug + ".json"), encoding="utf-8"))["metadata"]
    h1 = re.search(r"^# (.+?) Intelligence, Performance & Price Analysis", md, re.M)
    name = h1.group(1) if h1 else None
    sents = {}
    pats = {
        "score_sentence": re.escape(name or "@@") + r" scores (\d+(?:\.\d+)?) on the Artificial Analysis Intelligence Index, placing it [^\n]*?among comparable models \(median: [\d.]+\)\.",
        "faq_score_sentence": re.escape(name or "@@") + r" scores (\d+(?:\.\d+)?) on the Artificial Analysis Intelligence Index, placing it [^\n]*?similar price tier \(median: [\d.]+\)\.",
        "cost_sentence": r"On average, it costs \$[\d.,]+ per task to evaluate [^\n]*? on the Intelligence Index\.",
        "tokens_sentence": r"When evaluating the Intelligence Index, it generated [\d.]+[KMB]? tokens[^\n]*?\.",
        "release_sentence": re.escape(name or "@@") + r" was released on [A-Z][a-z]+ \d{1,2}, \d{4}\.",
        "summary_card": r"#### \[Intelligence\][^\n]*\n\n#\d+ / \d+\n\n(\d+)\n\nArtificial Analysis Intelligence Index",
        "cost_card": r"\n\n(\$[\d.,]+)\n\nCost per Intelligence Index task",
        "verbosity_card": r"\n\n([\d.]+[KMB]?)\n\nOutput tokens from Intelligence Index",
        "deprecation_sentence": r"This model is deprecated\.[^\n]*",
        "pricing_sentence": r"Pricing for [^\n]*? per 1M input tokens [^\n]*? per 1M output tokens \([^)]*\)\.",
    }
    for k, p in pats.items():
        m = re.search(p, md)
        sents[k] = (m.group(0).strip() if k.endswith("sentence") else (m.group(1) if m else None)) if m else None
    recs = records(rsc_text(html))
    own = recs.get(slug, {})
    cpt = own.get("intelligenceIndexCostPerTask") or {}
    out = {
        "slug": slug,
        "url": meta.get("url"),
        "statusCode": meta.get("statusCode"),
        "scrapeId": meta.get("scrapeId"),
        "page_title": meta.get("title"),
        "h1_name": name,
        "visible": sents,
        "embedded": {
            "name": own.get("name"),
            "shortName": own.get("shortName"),
            "effort": (own.get("effort") or {}).get("slug") if isinstance(own.get("effort"), dict) else own.get("effort"),
            "isReasoning": own.get("isReasoning"),
            "releaseDate": own.get("releaseDate"),
            "deprecated": own.get("deprecated"),
            "intelligenceIndex": own.get("intelligenceIndex"),
            "intelligenceIndexIsEstimated": own.get("intelligenceIndexIsEstimated"),
            "costPerTaskTotal": (cpt.get("cost") or {}).get("total") if isinstance(cpt, dict) else None,
            "costToRunIndexTotal": (own.get("intelligenceIndexCost") or {}).get("total") if isinstance(own.get("intelligenceIndexCost"), dict) else None,
            "costToRunIndexParts": own.get("intelligenceIndexCost"),
            "price1mInputTokens": own.get("price1mInputTokens"),
            "price1mOutputTokens": own.get("price1mOutputTokens"),
            "canonicalIntelligenceIndexTokenCount": own.get("canonicalIntelligenceIndexTokenCount"),
        },
    }
    print(json.dumps(out, indent=1))

if __name__ == "__main__":
    main()
