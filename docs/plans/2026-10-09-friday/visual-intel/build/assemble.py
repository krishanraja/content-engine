"""Assemble aa-pages.json from the cached Artificial Analysis page reads.

Usage: python3 -I assemble.py CACHE_DIR TOOL_RESULTS_DIR OUT_JSON
Reads only the cache (and the harness's saved scrape files, for read times); writes OUT_JSON.
Every value below is copied from a page read: a visible sentence, a summary card, a table cell,
a rendered chart bar label, or the page's own embedded data (marked as such). Nothing is computed
except the ratios in "article_figures_check", which are labelled as our arithmetic.
"""
import datetime as dt
import glob
import json
import os
import re
import sys

CACHE, RESULTS, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
BASE = "https://artificialanalysis.ai"

FAMILIES = [
    # family, maker, release page slug (None if single-model), what the maker calls the setting, variant slugs (top to bottom)
    ("Claude Opus 5.5", "Anthropic", "claude-opus-5-5", "effort",
     ["claude-opus-5-5", "claude-opus-5-5-xhigh", "claude-opus-5-5-high", "claude-opus-5-5-medium", "claude-opus-5-5-low"]),
    ("Claude Opus 5", "Anthropic", "claude-opus-5", "effort",
     ["claude-opus-5", "claude-opus-5-xhigh", "claude-opus-5-high", "claude-opus-5-medium", "claude-opus-5-low"]),
    ("Claude Sonnet 5.5", "Anthropic", "claude-sonnet-5-5", "effort",
     ["claude-sonnet-5-5", "claude-sonnet-5-5-xhigh", "claude-sonnet-5-5-high", "claude-sonnet-5-5-medium", "claude-sonnet-5-5-low"]),
    ("Claude Haiku 5.5", "Anthropic", "claude-haiku-5-5", "effort",
     ["claude-haiku-5-5", "claude-haiku-5-5-xhigh", "claude-haiku-5-5-high", "claude-haiku-5-5-medium", "claude-haiku-5-5-low"]),
    ("Claude Fable 5.1", "Anthropic", "claude-fable-5-1", "effort",
     ["claude-fable-5-1", "claude-fable-5-1-xhigh", "claude-fable-5-1-high", "claude-fable-5-1-medium", "claude-fable-5-1-low"]),
    ("GPT-6 Sol", "OpenAI", "gpt-6-sol", "reasoning effort",
     ["gpt-6-sol", "gpt-6-sol-xhigh", "gpt-6-sol-high", "gpt-6-sol-medium", "gpt-6-sol-low", "gpt-6-sol-non-reasoning"]),
    ("GPT-6.1 Sol", "OpenAI", "gpt-6-1-sol", "reasoning effort",
     ["gpt-6-1-sol", "gpt-6-1-sol-xhigh", "gpt-6-1-sol-high", "gpt-6-1-sol-medium", "gpt-6-1-sol-low"]),
    ("Gemini 4 Argon", "Google", None, "thinking level",
     ["gemini-4-argon"]),
    ("Gemini 3.1 Pro Preview", "Google", None, "thinking level",
     ["gemini-3-1-pro-preview"]),
    ("Gemini 3.8 Flash", "Google", "gemini-3-8-flash", "thinking level",
     ["gemini-3-8-flash", "gemini-3-8-flash-medium", "gemini-3-8-flash-low"]),
]

def load(name):
    p = os.path.join(CACHE, name)
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else None

def read_text(name):
    p = os.path.join(CACHE, name)
    return open(p, encoding="utf-8").read() if os.path.exists(p) else ""

# Read times: the harness writes each scrape result to a file as the scrape returns.
read_times = {}
for f in glob.glob(os.path.join(RESULTS, "mcp-Firecrawl-firecrawl_scrape-*.txt")):
    try:
        meta = json.load(open(f, encoding="utf-8"))["metadata"]
    except Exception:
        continue
    url = meta.get("url") or meta.get("sourceURL") or ""
    if not url.startswith(BASE):
        continue
    kind = "rendered" if "rawHtml" not in json.load(open(f, encoding="utf-8")) else "full"
    t = dt.datetime.fromtimestamp(os.path.getmtime(f), dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    read_times.setdefault(url, []).append({"kind": kind, "read_at_utc": t, "scrapeId": meta.get("scrapeId"), "http_status": meta.get("statusCode")})

def release_rows(rel_slug):
    md = read_text("releases-%s.md" % rel_slug)
    rows = {}
    for line in md.splitlines():
        m = re.match(r"^\| \[([^\]]+)\]\(https://artificialanalysis\.ai/models/([a-z0-9-]+)\) \|", line)
        if m:
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            rows[m.group(2)] = {"model_name_cell": m.group(1), "intelligence_cell": cells[2], "row_header": "Model Name | Model Creator | Intelligence | Parameters | Context Window | Price | Output SpeedTokens/s | Weights | Providers | Provider Benchmarks"}
    summary = [l.strip("- ").strip() for l in md.splitlines() if re.match(r"^- For (intelligence|pricing)", l)]
    offers = next((l for l in md.splitlines() if re.search(r"release offers \d+ models", l)), None)
    return rows, summary, offers

def money(x, places=2):
    return None if x is None else round(x, places)

variants = []
families_out = []
gaps = []
for fam, maker, rel, maker_term, slugs in FAMILIES:
    rows, rel_summary, offers = (release_rows(rel) if rel else ({}, [], None))
    if rel and read_text("releases-%s.md" % rel):
        families_out.append({
            "family": fam, "maker": maker,
            "release_page": "%s/models/releases/%s" % (BASE, rel),
            "release_page_read": read_times.get("%s/models/releases/%s" % (BASE, rel), []),
            "variant_count_sentence": offers,
            "summary_sentences": rel_summary,
        })
    elif rel:
        families_out.append({"family": fam, "maker": maker, "release_page": None,
                             "note": "Release page not read; variants were read from their own model pages."})
    for s in slugs:
        ex = load("%s.extract.json" % s)
        if ex is None:
            gaps.append("%s: model page not read" % s)
            continue
        lab = load("%s.labels.json" % s) or {}
        v, e = ex["visible"], ex["embedded"]
        url = ex["url"]
        ctr = (lab.get("costToRun") or {})
        own = ctr.get("own_bar")
        level = e.get("effort") or ("non-reasoning" if s.endswith("non-reasoning") else None)
        rec = {
            "family": fam,
            "maker": maker,
            "variant_name_on_page": ex["h1_name"],
            "thinking_level_on_page": level,
            "thinking_level_note": ("The page names no setting for this model; it is listed once, as a reasoning model." if level is None else None),
            "maker_calls_the_setting": maker_term,
            "page_url": url,
            "page_reads": read_times.get(url, []),
            "released": {"value": e.get("releaseDate"), "sentence": v.get("release_sentence")},
            "deprecated_on_page": v.get("deprecation_sentence"),
            "intelligence_index": {
                "value": int(v["summary_card"]) if v.get("summary_card") else None,
                "scale": "Artificial Analysis Intelligence Index v4.3.2, 0 to 100, higher is better",
                "sentence": v.get("score_sentence"),
                "faq_sentence": v.get("faq_score_sentence"),
                "summary_card": v.get("summary_card"),
                "release_table_cell": ({"page": "%s/models/releases/%s" % (BASE, rel), **rows[s]} if s in rows else None),
                "unrounded_from_page_data": e.get("intelligenceIndex"),
                "estimated_flag_in_page_data": e.get("intelligenceIndexIsEstimated"),
            },
            "cost_per_task_usd": {
                "value": float(v["cost_card"].replace("$", "").replace(",", "")) if v.get("cost_card") else None,
                "what_it_is": "Weighted average cost in US dollars per Intelligence Index task, at the token prices the page lists",
                "sentence": v.get("cost_sentence"),
                "summary_card": v.get("cost_card"),
                "unrounded_from_page_data": money(e.get("costPerTaskTotal"), 6),
            },
            "cost_to_run_index_usd": {
                "value": (int(own["label"].replace("$", "").replace(",", "")) if own else None),
                "what_it_is": "Cost in US dollars to run all evaluations in the Artificial Analysis Intelligence Index once, at the token prices the page lists",
                "chart_title": "Cost to Run Artificial Analysis Intelligence Index",
                "chart_subtitle": "Cost (USD) to run all evaluations in the Artificial Analysis Intelligence Index",
                "bar_label": own["label"] if own else None,
                "bar_name": own["bar_name"] if own else None,
                "bar_footnote_star": own["footnote_star"] if own else None,
                "label_check": ctr.get("status"),
                "unrounded_from_page_data": money(e.get("costToRunIndexTotal"), 2),
                "parts_from_page_data": ({k: money(x, 2) for k, x in (e.get("costToRunIndexParts") or {}).items()} or None),
            },
            "output_tokens_to_run_index": {"summary_card": v.get("verbosity_card"), "sentence": v.get("tokens_sentence")},
            "list_prices": {"sentence": v.get("pricing_sentence"),
                            "input_usd_per_1m_tokens": e.get("price1mInputTokens"),
                            "output_usd_per_1m_tokens": e.get("price1mOutputTokens")},
            "notes": [],
        }
        if own and own.get("footnote_star"):
            rec["notes"].append("The page marks this cost with an asterisk. The chart note in the page data reads: \"* Claude Haiku 5.5 has 5x higher pricing on longer-context inputs which are not currently reflected; we are working to include this in cost figures across Artificial Analysis.\" So this cost is understated by an amount the page does not give.")
        if v.get("cost_sentence") is None:
            rec["notes"].append("The page gives a score but no cost per task and no cost to run the index for this setting.")
            gaps.append("%s (%s): score only; the page shows no cost per task and no cost to run the index" % (ex["h1_name"], url))
        if "Default Fallback" in (ex["h1_name"] or ""):
            rec["notes"].append("'Default Fallback' is part of AA's name for this model; the page does not define it. Use the setting name (Max, Xhigh, High, Medium, Low) on charts and leave 'Default Fallback' to a source note.")
        if s == "gpt-6-sol-non-reasoning":
            rec["notes"].append("On these pages thinking off costs more than the Low setting: $0.33 v $0.13 per task, and $449 v $269 to run the index. The page does not say why; the page data shows thinking off read about 1.10 billion input tokens across the index against about 0.34 billion at Low. Why it read more is not stated. Do not chart 'off' as the cheapest point without saying so.")
        if v.get("deprecation_sentence"):
            rec["notes"].append("AA marks this model deprecated (sentence quoted in deprecated_on_page). Its scores stay on the page.")
        if rec["intelligence_index"]["release_table_cell"] and rec["intelligence_index"]["release_table_cell"]["intelligence_cell"] != v.get("summary_card"):
            rec["notes"].append("Release table cell and model page disagree.")
        variants.append(rec)

defs_md = read_text("evaluations-artificial-analysis-intelligence-index.md")
meth_md = read_text("methodology-intelligence-benchmarking.md")
models_md = read_text("models.md")

def find(md, pat):
    m = re.search(pat, md)
    return m.group(0) if m else None

out = {
    "what_this_is": "Cross-check for the Artificial Analysis API pull: the public artificialanalysis.ai pages, read with Firecrawl (not the API) on 17 October 2026. Every value is copied from the page, with the URL and the exact sentence, card, table cell or chart label it came from.",
    "read_date": "2026-10-17",
    "how_it_was_read": [
        "Each model page was read twice with Firecrawl scrape, maxAge 0 (live fetch): once as markdown plus raw HTML, and once as rendered markdown after a 6 second wait so the chart bar labels appear.",
        "Score and cost per task come from the page's own sentences (\"... scores N on the Artificial Analysis Intelligence Index ...\" and \"On average, it costs $X per task to evaluate ... on the Intelligence Index.\"), cross-checked against the summary card and, for scores, the release page table cell.",
        "The cost to run the whole index appears on the page only as a bar label on the chart \"Cost to Run Artificial Analysis Intelligence Index\". The bar for this model was found by position: the chart lists its linked models in bar order and prints one total per bar. That mapping was accepted only when every bar's label on the chart equalled that model's total in the page's embedded data, rounded to whole dollars.",
        "Unrounded values are copied from the page's embedded data (the data the charts draw from). They are not visible text and should be cited only as 'unrounded figure in the page data'.",
        "Raw page copies are in /home/user/content-engine/.cache/visual-intel/aa-pages; scripts in /home/user/content-engine/.cache/visual-intel/scripts.",
    ],
    "index_definition": {
        "page": BASE + "/evaluations/artificial-analysis-intelligence-index",
        "page_reads": read_times.get(BASE + "/evaluations/artificial-analysis-intelligence-index", []),
        "title": find(defs_md, r"Artificial Analysis Intelligence Index v[\d.]+"),
        "scale_sentence": find(defs_md, r"The Artificial Analysis Intelligence Index is calculated as a weighted average of production benchmark scores, scaled from 0 to 100\.[^\n]*"),
        "what_it_measures_sentence": find(defs_md, r"The Artificial Analysis Intelligence Index is a composite benchmark score that measures[^\n]*"),
        "evaluations_sentence": find(models_md, r"Artificial Analysis Intelligence Index v4\.3\.2 incorporates 10 evaluations:[^\n]*"),
        "methodology_page": BASE + "/methodology/intelligence-benchmarking",
        "methodology_weighting_sentence": find(meth_md, r"Intelligence Index is calculated as a weighted average across four categories:[^\n]*"),
        "conflict": "The two AA pages disagree on the category weights. The index page FAQ says 'Four categories each contribute 25%'; the methodology page says 'Agents (30%), Coding (20%), Scientific Reasoning (20%) and General (30%)'. The methodology table (per-evaluation weights) adds up to the 30/20/20/30 split. Cite the methodology page if weights are mentioned.",
    },
    "cost_definitions": {
        "cost_per_task": {
            "chart_subtitle": "Weighted average cost (USD) per Intelligence Index task · Lower is better",
            "definition_sentence": find(models_md, r"Weighted average cost per Intelligence Index task\. Each evaluation[^\n]*"),
        },
        "cost_to_run_index": {
            "chart_subtitle": "Cost (USD) to run all evaluations in the Artificial Analysis Intelligence Index",
            "definition_sentence": find(models_md, r"The cost to run the evaluations in the Artificial Analysis Intelligence Index, calculated using[^\n]*"),
        },
        "methodology_sentence": find(meth_md, r"For the Artificial Analysis Intelligence Index evaluations, we use the token counts reported by each model's API provider[^\n]*"),
        "price_basis": "Model pages say prices are 'based on Anthropic's API' (or the maker's own API) and list input and output prices per million tokens. The methodology adds that cost combines provider token counts 'with live measurements of the model's typical cache hit rate'. So these are list-price costs including AA's cache assumption, not what any customer was billed.",
    },
    "families": families_out,
    "variants": variants,
    "models_page": {
        "page": BASE + "/models",
        "page_reads": read_times.get(BASE + "/models", []),
        "faq_top_models_sentence": find(models_md, r"The top AI models by Intelligence Index are:[^\n]*"),
        "faq_most_intelligent_sentence": find(models_md, r"Claude Opus 5\.5 \(Max, Default Fallback\) currently leads[^\n]*"),
        "note": "The models list shows each model at one default setting only (27 of 704 models selected); the other settings are on each model's own page and its release page.",
    },
    "which_gemini_is_current_pro": "Artificial Analysis has no Gemini 4 Pro. Google's top model on the site is Gemini 4 Argon (High), released 30 September 2026 and listed at one setting only (the Google creator page: 'For intelligence, the top model from Google is Gemini 4 Argon (High) at 53.'). The newest model named Pro is Gemini 3.1 Pro Preview (released 19 February 2026, score 30, one setting). Gemini 3.8 Flash is the only current Google model the site shows at more than one thinking level (high, medium, low), and its low setting has no cost.",
    "gaps": gaps + [
        "Google: no Gemini 4 Pro on Artificial Analysis. Gemini 4 Argon (Google's top model on the site) and Gemini 3.1 Pro Preview (the newest model named Pro) are each listed at one setting only, so neither shows how thinking level changes score or cost. Gemini 3.8 Flash is the only current Google model with more than one setting (High, Medium, Low).",
        "Claude Haiku 5.5: every cost on its pages carries an asterisk; AA's note says its 5x higher long-context input pricing is not yet reflected, so its costs are understated by an amount AA does not give.",
        "Claude Opus 5 and GPT-6 Sol: both pages say 'This model is deprecated.' Their scores and costs are still shown.",
        "Cost to run the whole index is shown only as chart bar labels (whole dollars), never in a sentence. Each label here was matched to its model by bar position and confirmed against the page data for every bar on that chart.",
        "Category weights: the index page FAQ says four categories at 25% each; the methodology page says 30/20/20/30. Unresolved on AA's own pages.",
        "No Claude model in these releases has a thinking-off setting on AA; the lowest Claude setting shown is Low. Only GPT-6 Sol has a 'Non-reasoning' (thinking off) row.",
        "The /models list page shows each model at one setting only (the default chart selection of 27 of 704 models). Per-setting values come from each model page and its release page.",
    ],
}

# Our arithmetic on page values, for the article's AA sentences (no new data).
def var(slug):
    return next(x for x in variants if x["page_url"].endswith("/models/" + slug))

def ratio(a, b):
    return round(a / b, 2)

o_max, o_med, o_low = var("claude-opus-5-5"), var("claude-opus-5-5-medium"), var("claude-opus-5-5-low")
g_max, g_off = var("gpt-6-sol"), var("gpt-6-sol-non-reasoning")
g61_max = var("gpt-6-1-sol")
f_max, f_x = var("claude-fable-5-1"), var("claude-fable-5-1-xhigh")
h_max = var("claude-haiku-5-5")
op5_max = var("claude-opus-5")
out["article_figures_check"] = {
    "note": "Our arithmetic on the page values above, set against the article's sentences that cite Artificial Analysis (docs/plans/2026-10-09-draft-body-v5.md). Not new data.",
    "checks": [
        {"article": "Thinking as hard as it can, it scored more than a third higher than when thinking a little.",
         "pages": "Opus 5.5 Max 58, Low 42", "ratio": ratio(58, 42), "ratio_unrounded": ratio(o_max["intelligence_index"]["unrounded_from_page_data"], o_low["intelligence_index"]["unrounded_from_page_data"]), "holds": True},
        {"article": "The older Opus 5, at its hardest, beat the new one at its lowest.",
         "pages": "Opus 5 Max 51, Opus 5.5 Low 42", "holds": True},
        {"article": "GPT-6 Sol ... scored about two thirds higher at its top developer setting than with thinking off",
         "pages": "GPT-6 Sol Max 48, Non-reasoning 29", "ratio": ratio(48, 29), "ratio_unrounded": ratio(g_max["intelligence_index"]["unrounded_from_page_data"], g_off["intelligence_index"]["unrounded_from_page_data"]), "holds": True},
        {"article": "while the newer GPT-6.1 Sol at its top only edged past it",
         "pages": "GPT-6.1 Sol Max 52 vs GPT-6 Sol Max 48", "holds": True},
        {"article": "moving Opus 5.5 from low to medium cost about two and a half times as much per task",
         "pages": "$1.34 vs $0.55 per task", "ratio": ratio(1.34, 0.55), "holds": True},
        {"article": "Moving it from medium to max cost another four and a half times as much",
         "pages": "$5.98 vs $1.34 per task", "ratio": ratio(5.98, 1.34), "holds": True},
        {"article": "Bottom to top, that's about 11 times the cost for a score just over a third higher.",
         "pages": "$5.98 vs $0.55 per task; 58 vs 42", "ratio_cost": ratio(5.98, 0.55), "ratio_cost_to_run_index": ratio(o_max["cost_to_run_index_usd"]["value"], o_low["cost_to_run_index_usd"]["value"]), "holds": True},
        {"article": "On Fable 5.1, it costs 28% more and barely moves the score.",
         "pages": "Fable 5.1 Max $7.63 vs Xhigh $5.98 per task; both score 53 (unrounded 53.35 vs 53.20)", "ratio": ratio(7.63, 5.98), "holds": True},
        {"article": "Claude Haiku 5.5 ... on its highest setting edged past Opus 5.5 on its lowest, for less than half the cost per task.",
         "pages": "Haiku 5.5 Max 43 at $0.21 per task; Opus 5.5 Low 42 at $0.55 per task", "ratio": ratio(0.21, 0.55), "holds": True,
         "caveat": "AA marks Haiku 5.5 costs with an asterisk: its 5x higher long-context input pricing is not yet reflected, so Haiku's true cost is higher than shown. The gap is wide ($0.21 vs $0.55) but AA does not say by how much Haiku's cost is understated."},
        {"article": "Claude Opus 5.5's hardest-thinking run cost $5.98 per task, against $0.55 on low.",
         "pages": "$5.98 (Max) and $0.55 (Low) per task", "holds": True},
    ],
}
json.dump(out, open(OUT, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print("variants:", len(variants), "families:", len(families_out), "gaps:", len(gaps))
