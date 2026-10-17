"""Reconcile the Artificial Analysis API pull (aa-data.json) with the separate
public-page read (aa-pages.json), then write data-final.json and derived.json.

Run: python3 -I /home/user/content-engine/.cache/visual-intel/scripts/reconcile.py
Reads only; writes only the two output files in visual-intel/.
"""
import datetime
import html
import json
import re
from decimal import Decimal, ROUND_HALF_UP

BASE = "/home/user/content-engine/docs/plans/2026-10-09-friday/visual-intel"
CURL = "/home/user/content-engine/.cache/visual-intel/web-mine/models"
API = json.load(open(f"{BASE}/aa-data.json", encoding="utf-8"))
PG = json.load(open(f"{BASE}/aa-pages.json", encoding="utf-8"))
NOW = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

ORDER = {"off": 0, "low": 1, "medium": 2, "high": 3, "xhigh": 4, "max": 5}
LABEL = {"off": "Non-reasoning", "low": "Low", "medium": "Medium", "high": "High",
         "xhigh": "Xhigh", "max": "Max"}
FAMILY_LINE = {  # our grouping of versions of one model line
    "Claude Opus 5.5": ("Claude Opus", "Claude Opus 5.5"),
    "Claude Opus 5": ("Claude Opus", "Claude Opus 5"),
    "Claude Sonnet 5.5": ("Claude Sonnet", "Claude Sonnet 5.5"),
    "Claude Haiku 5.5": ("Claude Haiku", "Claude Haiku 5.5"),
    "Claude Fable 5.1": ("Claude Fable", "Claude Fable 5.1"),
    "GPT-6 Sol": ("GPT Sol", "GPT-6 Sol"),
    "GPT-6.1 Sol": ("GPT Sol", "GPT-6.1 Sol"),
    "Gemini 4 Argon": ("Gemini Argon", "Gemini 4 Argon"),
    "Gemini 3.1 Pro Preview": ("Gemini Pro", "Gemini 3.1 Pro Preview"),
    "Gemini 3.8 Flash": ("Gemini Flash", "Gemini 3.8 Flash"),
}


def d(x):
    return Decimal(str(x))


def half_up(x, places):
    q = Decimal(1) if places == 0 else Decimal(1).scaleb(-places)
    return d(x).quantize(q, rounding=ROUND_HALF_UP)


def sig2(n):
    """Round a positive integer to two significant figures, half up."""
    n = d(n)
    exp = n.adjusted() - 1
    return (n.scaleb(-exp).quantize(Decimal(1), rounding=ROUND_HALF_UP)).scaleb(exp)


def parse_card(s):
    m = re.fullmatch(r"([0-9.]+)([KMB])", s.strip())
    mult = {"K": 10**3, "M": 10**6, "B": 10**9}[m.group(2)]
    return d(m.group(1)) * mult


def money(s):
    return d(s.replace("$", "").replace(",", ""))


def slug_of(url):
    return url.rstrip("/").split("/models/")[-1]


def norm_level(x):
    if x is None:
        return None
    x = x.lower()
    return "off" if x == "non-reasoning" else x


api_by = {v["slug"]: v for v in API["variants"]}
pg_by = {slug_of(v["page_url"]): v for v in PG["variants"]}
assert len(api_by) == len(API["variants"]), "duplicate API slug"
assert len(pg_by) == len(PG["variants"]), "duplicate page slug"

both = [s for s in api_by if s in pg_by]
api_only = [s for s in api_by if s not in pg_by]
page_only = [s for s in pg_by if s not in api_by]

checks_log = {}
rows = []
disagreements = []


def chk(log, name, ok, **vals):
    log.append({"check": name, "ok": bool(ok), **{k: (str(v) if isinstance(v, Decimal) else v) for k, v in vals.items()}})
    return ok


for s in both:
    a, p = api_by[s], pg_by[s]
    log = []
    ii = p["intelligence_index"]
    cr = p["cost_to_run_index_usd"] or {}
    ct = p["cost_per_task_usd"] or {}
    ot = p["output_tokens_to_run_index"] or {}
    lp = p["list_prices"] or {}

    chk(log, "name", a["name"] == p["variant_name_on_page"], api=a["name"], page=p["variant_name_on_page"])
    chk(log, "creator", a["creator"] == p["maker"], api=a["creator"], page=p["maker"])
    chk(log, "family", a["family"] == p["family"], api=a["family"], page=p["family"])
    chk(log, "thinking_level", a["thinking_level"] == norm_level(p["thinking_level_on_page"]),
        api=a["thinking_level"], page=p["thinking_level_on_page"])
    chk(log, "release_date", a["release_date"] == p["released"]["value"], api=a["release_date"], page=p["released"]["value"])

    # Score: page whole number v API one decimal, allowing rounding.
    pi, a1, au, pu = ii["value"], a["intelligence_index"], a["intelligence_index_unrounded_page"], ii["unrounded_from_page_data"]
    chk(log, "score_within_rounding", abs(d(a1) - d(pi)) <= Decimal("0.5"), api=a1, page=pi)
    chk(log, "score_page_is_unrounded_rounded", half_up(au, 0) == d(pi), unrounded=au, page=pi)
    chk(log, "score_api_is_unrounded_to_1dp", half_up(au, 1) == d(a1), unrounded=au, api=a1)
    chk(log, "score_unrounded_same_in_both", abs(d(au) - d(pu)) < Decimal("1e-9"), api_file=au, page_file=pu)
    chk(log, "score_summary_card", str(ii.get("summary_card")) == str(pi), card=ii.get("summary_card"), page=pi)
    rtc = (ii.get("release_table_cell") or {}).get("intelligence_cell")
    chk(log, "score_release_table_cell", rtc is None or str(rtc) == str(pi), cell=rtc, page=pi)
    double_round = half_up(a1, 0) != d(pi)

    # Cost to run the full test set.
    ac, pc = a["cost_to_run_index_usd"], cr.get("value")
    if ac is None and pc is None:
        chk(log, "cost_both_unpublished", True, api=None, page=None)
    else:
        chk(log, "cost_present_in_both", ac is not None and pc is not None, api=ac, page=pc)
        if ac is not None and pc is not None:
            chk(log, "cost_within_rounding", abs(d(ac) - d(pc)) <= Decimal("0.5"), api=ac, page=pc)
            chk(log, "cost_bar_label", money(cr["bar_label"]) == d(pc), bar_label=cr["bar_label"], page=pc)
            chk(log, "cost_unrounded_same", abs(d(ac) - d(cr["unrounded_from_page_data"])) < Decimal("0.005"),
                api=ac, page_data=cr["unrounded_from_page_data"])

    # Cost per task.
    at, pt = a["cost_per_task_usd"], ct.get("value")
    if at is None and pt is None:
        chk(log, "cost_per_task_both_unpublished", True)
    else:
        chk(log, "cost_per_task_present_in_both", at is not None and pt is not None, api=at, page=pt)
        if at is not None and pt is not None:
            chk(log, "cost_per_task_within_rounding", abs(d(at) - d(pt)) <= Decimal("0.005"), api=at, page=pt)
            chk(log, "cost_per_task_card", money(ct["summary_card"]) == d(pt), card=ct["summary_card"], page=pt)

    # Output tokens: page card is two significant figures.
    ao, card = a["output_tokens_to_run_index"], ot.get("summary_card")
    if ao is None and card is None:
        chk(log, "tokens_both_unpublished", True)
    else:
        chk(log, "tokens_present_in_both", ao is not None and card is not None, api_file=ao, page=card)
        if ao is not None and card is not None:
            chk(log, "tokens_within_rounding", sig2(ao) == parse_card(card), api_file=ao, page_card=card, api_file_2sf=sig2(ao))
            m = re.search(r"generated ([0-9.]+[KMB]) tokens", ot.get("sentence") or "")
            chk(log, "tokens_sentence_matches_card", m is not None and m.group(1) == card, sentence=ot.get("sentence"))

    # List prices.
    if lp:
        chk(log, "price_input", d(a["price_per_1m_input_tokens_usd"]) == d(lp["input_usd_per_1m_tokens"]),
            api=a["price_per_1m_input_tokens_usd"], page=lp["input_usd_per_1m_tokens"])
        chk(log, "price_output", d(a["price_per_1m_output_tokens_usd"]) == d(lp["output_usd_per_1m_tokens"]),
            api=a["price_per_1m_output_tokens_usd"], page=lp["output_usd_per_1m_tokens"])

    chk(log, "deprecated_flag", bool(a["aa_deprecated_page"]) == (p["deprecated_on_page"] is not None),
        api_file=a["aa_deprecated_page"], page=p["deprecated_on_page"])
    chk(log, "not_estimated", not a.get("aa_index_is_estimated_page") and not ii.get("estimated_flag_in_page_data"),
        api_file=a.get("aa_index_is_estimated_page"), page=ii.get("estimated_flag_in_page_data"))

    checks_log[s] = log
    fails = [c for c in log if not c["ok"]]
    core_fail = [c for c in fails if c["check"].startswith(("score", "cost", "tokens", "release", "thinking", "name", "creator"))]

    fam, model = FAMILY_LINE[a["family"]]
    lvl = a["thinking_level"]
    src = a["sources"]
    notes = []
    if "Default Fallback" in a["name"]:
        notes.append("'Default Fallback' is part of Artificial Analysis's name for this variant and is not defined on its pages; print the setting name only and keep 'Default Fallback' for the source note.")
    if cr.get("bar_footnote_star"):
        notes.append("Artificial Analysis stars this cost: 'Claude Haiku 5.5 has 5x higher pricing on longer-context inputs which are not currently reflected'. The real cost is higher by an amount it does not give.")
    if p["deprecated_on_page"]:
        notes.append("Artificial Analysis marks this model deprecated ('This model is deprecated.') and has replaced it with " + (a.get("aa_deprecated_to_page") or "a newer model") + " in its records; the score and cost are still shown and still valid as measured.")
    if s == "gpt-6-sol-non-reasoning":
        notes.append("Thinking off cost more to run than Low ($449.37 v $268.73 for the full test set; $0.33 v $0.13 per task). The page data shows it read about 1.10 billion input tokens against about 0.34 billion at Low. Artificial Analysis does not say why. Never draw cost as rising at every step for this model.")
    if double_round:
        notes.append(f"Rounding trap: the one-decimal score {a1} rounds half up to {half_up(a1, 0)}, but the page shows {pi} (unrounded {round(au, 2)}). Print {a1} or {pi}; never round {a1} again.")
    if ac is None and pc is None:
        notes.append("Artificial Analysis publishes a score but no cost and no token count for this setting (both the API and the page). It cannot go on any cost chart.")
    if lvl is None:
        notes.append("Artificial Analysis names no thinking level for this model; it is listed once, as a reasoning model.")
    if a["family"] in ("Gemini 4 Argon", "Gemini 3.1 Pro Preview"):
        notes.append("Listed at one setting only, so it shows nothing about how thinking level changes score or cost.")

    row = {
        "creator": a["creator"],
        "family": fam,
        "model": model,
        "variant": a["name"],
        "slug": s,
        "thinking_level": lvl,
        "thinking_level_label": LABEL.get(lvl) if lvl else None,
        "score": a1,
        "score_on_page": pi,
        "score_scale": "Artificial Analysis Intelligence Index, 0 to 100, higher is better",
        "cost_usd": ac,
        "cost_on_page_usd": pc,
        "cost_usd_is": "cost to run Artificial Analysis's full test set once, US dollars, at list prices",
        "cost_per_task_usd": at,
        "cost_per_task_on_page_usd": pt,
        "output_tokens": ao,
        "output_tokens_on_page": card,
        "release_date": a["release_date"],
        "api_field": {
            "endpoint": src["intelligence_index"]["endpoint"],
            "via": src["intelligence_index"]["via"],
            "read_at": src["intelligence_index"]["read_at"],
            "score": src["intelligence_index"]["field"],
            "cost_usd": src["cost_to_run_index_usd"]["field"],
            "cost_per_task_usd": src["cost_per_task_usd"]["field"],
            "release_date": src["release_date"]["field"],
            "output_tokens": None,
            "output_tokens_source": "Not in the free API tier (artificial_analysis_intelligence_index_token_counts is Pro only). Exact count from the public page's embedded record, field " + src["output_tokens_to_run_index"]["field"] + ", read " + src["output_tokens_to_run_index"]["read_at"] + "; the page shows it rounded as " + str(card) + ".",
        },
        "page_url": p["page_url"],
        "page_read_at": sorted({r["read_at_utc"] for r in p["page_reads"]}),
        "page_sentences": {
            "score": ii["sentence"],
            "cost_per_task": ct.get("sentence"),
            "cost_usd_bar_label": cr.get("bar_label"),
            "output_tokens": ot.get("sentence"),
            "released": p["released"]["sentence"],
        },
        "confirmed_by": "both" if not core_fail else "disputed",
        "aa_marks_deprecated": p["deprecated_on_page"] is not None,
        "chartable_on_cost": ac is not None,
        "notes": notes,
    }
    if core_fail:
        disagreements.append({"slug": s, "fails": core_fail})
    rows.append(row)

rows.sort(key=lambda r: (r["creator"], r["family"], r["model"], ORDER.get(r["thinking_level"], -1)))

# API-only rows: check the visible text of the curl copies the API pull saved,
# as supplementary evidence. They stay out of the rows either way.
api_only_out = []
for s in api_only:
    a = api_by[s]
    txt = ""
    try:
        txt = html.unescape(open(f"{CURL}/{s}.html", encoding="utf-8", errors="replace").read())
    except OSError:
        pass
    name = re.escape(a["name"])
    sc = re.search(name + r" scores ([0-9]+) on the Artificial Analysis Intelligence Index", txt)
    cp = re.search(r"costs \$([0-9.,]+) per task to evaluate " + name, txt)
    rl = re.search(name + r" was released on ([A-Z][a-z]+ [0-9]+, [0-9]{4})", txt)
    tk = re.search(r"it generated ([0-9.]+[KMB]) tokens", txt)
    vis = {
        "score_text": sc.group(1) if sc else None,
        "score_agrees": (abs(d(a["intelligence_index"]) - d(sc.group(1))) <= Decimal("0.5")) if (sc and a["intelligence_index"] is not None) else None,
        "cost_per_task_text": cp.group(1) if cp else None,
        "cost_per_task_agrees": (abs(d(a["cost_per_task_usd"]) - money(cp.group(1))) <= Decimal("0.005")) if (cp and a["cost_per_task_usd"] is not None) else None,
        "released_text": rl.group(1) if rl else None,
        "released_agrees": (datetime.datetime.strptime(rl.group(1), "%B %d, %Y").strftime("%Y-%m-%d") == a["release_date"]) if rl else None,
        "tokens_text": tk.group(1) if tk else None,
        "tokens_agrees": (sig2(a["output_tokens_to_run_index"]) == parse_card(tk.group(1))) if (tk and a["output_tokens_to_run_index"]) else None,
        "cost_usd_text": "not in the page text: the full-test-set cost is drawn only as a chart bar label after the page renders",
    }
    why = ("The separate page read (aa-pages.json) did not cover this family. Its page exists "
           "(fetched with status 200 by the API pull, " + CURL.replace("/home/user/content-engine/", "") + "/" + s + ".html), so 'the page could not show it' does not apply. Not confirmed, so not in the rows.")
    if a["intelligence_index"] is None:
        why = "Artificial Analysis publishes no score and no cost for this variant (API nulls). Nothing to confirm or chart."
    elif a.get("aa_index_is_estimated_page"):
        why += " Its score is also flagged as estimated in the page data (isEstimated), and it has no published cost."
    api_only_out.append({
        "slug": s, "variant": a["name"], "creator": a["creator"], "family_in_api_file": a["family"],
        "thinking_level": a["thinking_level"], "why_left_out": why,
        "page_url": f"https://artificialanalysis.ai/models/{s}",
        "visible_text_check_of_curl_copy": vis,
    })

# ---------------------------------------------------------------- data-final
api_only_families = sorted({x["family_in_api_file"] for x in api_only_out})
final = {
    "what_this_is": "Artificial Analysis scores and costs for each model at each thinking level, confirmed by two separate reads: the Artificial Analysis API (aa-data.json) and the public artificialanalysis.ai pages (aa-pages.json). Only rows both agree on are here. Built " + NOW + " by .cache/visual-intel/scripts/reconcile.py.",
    "credit": "Artificial Analysis (artificialanalysis.ai). Credit it on every exhibit.",
    "inputs": {
        "api_pull": {"file": "docs/plans/2026-10-09-friday/visual-intel/aa-data.json", "read_at": API["read_at"], "variants": len(API["variants"])},
        "page_read": {"file": "docs/plans/2026-10-09-friday/visual-intel/aa-pages.json", "read_date": PG["read_date"], "variants": len(PG["variants"])},
        "in_both": len(both), "api_only": len(api_only), "page_only": len(page_only),
    },
    "definitions": {
        "score": "Artificial Analysis Intelligence Index, 0 to 100, higher is better (v4.3.2: ten tests of agents, coding, general knowledge and scientific reasoning). One decimal, from the API; score_on_page is the whole number the public page prints. Chart wording: 'on Artificial Analysis's Intelligence Index, 0 to 100'. Do not quote the category weights: Artificial Analysis's own two pages disagree (25% each v 30/20/20/30).",
        "cost_usd": "What it cost Artificial Analysis to run its full Intelligence Index test set once with this model at this thinking level, in US dollars, at list prices (worked out from the token prices it lists, with its usual cache-hit assumption; not what any customer was billed). Artificial Analysis's chart: 'Cost (USD) to run all evaluations in the Artificial Analysis Intelligence Index'. 'At list prices' is our gloss.",
        "cost_per_task_usd": "Artificial Analysis's weighted average cost per test task, in US dollars. The article's dollar figures ($5.98, $0.55, 'about 11 times') are this measure, not cost_usd.",
        "output_tokens": "Tokens the model wrote (its hidden working plus its answers) across the full test set. Exact count from the page's embedded data; the page prints it to two significant figures (output_tokens_on_page).",
        "thinking_level": "How hard the model is set to think: what Anthropic calls effort and OpenAI calls reasoning (Google calls it thinking level). thinking_level_label is Artificial Analysis's name for the setting and is what a chart prints: Non-reasoning (thinking off), Low, Medium, High, Xhigh, Max.",
        "family": "Our grouping of versions of one model line (Claude Opus = Opus 5 and Opus 5.5; GPT Sol = GPT-6 Sol and GPT-6.1 Sol). model is the version; variant is Artificial Analysis's full name for that version at that setting.",
    },
    "how_rows_were_confirmed": [
        "Matched by Artificial Analysis slug (the API's data[].slug and the page URL /models/<slug>). Same name, maker, family and thinking level in both.",
        "Score: the API's one-decimal value is within 0.5 of the page's whole number; the page's whole number equals the unrounded page-data value rounded half up; the API value equals that unrounded value to one decimal; the unrounded value is identical in both files; the page's summary card and release-page table cell show the same whole number.",
        "Cost to run the full test set: the API value is within $0.50 of the page's whole-dollar bar label, and equals the page data to the cent.",
        "Cost per task: the API value (4 decimals) is within $0.005 of the page's sentence (2 decimals).",
        "Output tokens: the exact count rounded to two significant figures equals the page's summary card and its sentence ('it generated 260M tokens').",
        "Release date, list prices and the deprecation flag are equal in both.",
    ],
    "row_count": len(rows),
    "rows": rows,
    "left_out": api_only_out,
    "page_only": page_only,
    "check_log": checks_log,
}

# ------------------------------------------------------------------ derived
def r2(x):
    return float(half_up(x, 2))


def pts(a, b):
    return float(d(b) - d(a))


def step(r0, r1, kind):
    out = {
        "from": {"slug": r0["slug"], "thinking_level": r0["thinking_level_label"], "model": r0["model"],
                 "score": r0["score"], "score_on_page": r0["score_on_page"], "cost_usd": r0["cost_usd"], "cost_per_task_usd": r0["cost_per_task_usd"]},
        "to": {"slug": r1["slug"], "thinking_level": r1["thinking_level_label"], "model": r1["model"],
               "score": r1["score"], "score_on_page": r1["score_on_page"], "cost_usd": r1["cost_usd"], "cost_per_task_usd": r1["cost_per_task_usd"]},
        "points_gained": pts(r0["score"], r1["score"]),
        "points_gained_page_whole_numbers": r1["score_on_page"] - r0["score_on_page"],
        "cost_multiple": r2(d(r1["cost_usd"]) / d(r0["cost_usd"])) if (r0["cost_usd"] and r1["cost_usd"]) else None,
        "cost_multiple_per_task": r2(d(r1["cost_per_task_usd"]) / d(r0["cost_per_task_usd"])) if (r0["cost_per_task_usd"] and r1["cost_per_task_usd"]) else None,
    }
    flags = []
    if out["cost_multiple"] is None:
        flags.append("No cost multiple: Artificial Analysis publishes no cost for " + (r0["variant"] if not r0["cost_usd"] else r1["variant"]) + ".")
    elif out["cost_multiple"] < 1:
        flags.append("Cost falls (multiple below 1).")
    if out["points_gained"] <= 0:
        flags.append("Score does not rise.")
    if out["cost_multiple"] and out["cost_multiple_per_task"] and abs(out["cost_multiple"] - out["cost_multiple_per_task"]) / min(out["cost_multiple"], out["cost_multiple_per_task"]) >= 0.10:
        flags.append(f"The two cost measures differ here ({out['cost_multiple']}x full test set v {out['cost_multiple_per_task']}x per task): say which one the exhibit shows.")
    if out["points_gained_page_whole_numbers"] != round(out["points_gained"]):
        flags.append(f"On the page's whole numbers this step reads {out['points_gained_page_whole_numbers']} points, not {out['points_gained']}: use one set of numbers throughout an exhibit.")
    out["flags"] = flags
    return out


by_model = {}
for r in rows:
    if r["thinking_level"] is not None:
        by_model.setdefault(r["model"], []).append(r)
for m in by_model:
    by_model[m].sort(key=lambda r: ORDER[r["thinking_level"]])

ranges, steps = [], []
single = []
for m, rs in by_model.items():
    if len(rs) < 2:
        single.append({"model": m, "only_setting": rs[0]["thinking_level_label"], "why": "Artificial Analysis lists one setting only; no thinking-level range."})
        continue
    x = step(rs[0], rs[-1], "range")
    x["model"] = m
    x["creator"] = rs[0]["creator"]
    x["levels_listed"] = [r["thinking_level_label"] for r in rs]
    ranges.append(x)
    for a_, b_ in zip(rs, rs[1:]):
        y = step(a_, b_, "step")
        y["model"] = m
        y["creator"] = a_["creator"]
        steps.append(y)
for r in rows:
    if r["thinking_level"] is None:
        single.append({"model": r["model"], "only_setting": None, "why": "Artificial Analysis names no thinking level and lists one setting only."})

upgrades = []
for old, new in (("Claude Opus 5", "Claude Opus 5.5"), ("GPT-6 Sol", "GPT-6.1 Sol")):
    o = {r["thinking_level"]: r for r in by_model[old]}
    n = {r["thinking_level"]: r for r in by_model[new]}
    matched = [l for l in ORDER if l in o and l in n]
    unmatched = [LABEL[l] + " (" + (old if l in o else new) + " only)" for l in ORDER if (l in o) != (l in n)]
    per = []
    for l in matched:
        z = step(o[l], n[l], "upgrade")
        z["thinking_level"] = LABEL[l]
        per.append(z)
    upgrades.append({"from_model": old, "to_model": new,
                     "release_dates": {old: o[matched[0]]["release_date"], new: n[matched[0]]["release_date"]},
                     "matched_levels": [LABEL[l] for l in matched], "unmatched_levels": unmatched, "by_level": per})

by_slug = {r["slug"]: r for r in rows}
ARTICLE = "docs/plans/2026-10-09-draft-body-v5.md"
article_spans = []
for a_s, b_s, quote, measure in (
    ("claude-opus-5-5-low", "claude-opus-5-5-medium", "moving Opus 5.5 from low to medium cost about two and a half times as much per task", "per task"),
    ("claude-opus-5-5-medium", "claude-opus-5-5", "Moving it from medium to max cost another four and a half times as much, for a smaller jump.", "per task"),
    ("claude-opus-5-5-low", "claude-opus-5-5", "Bottom to top, that's about 11 times the cost for a score just over a third higher.", "per task"),
    ("claude-fable-5-1-xhigh", "claude-fable-5-1", "On Fable 5.1, it costs 28% more and barely moves the score.", "per task"),
    ("claude-opus-5-5-low", "claude-haiku-5-5", "Claude Haiku 5.5, the cheapest of Anthropic's current models, on its highest setting edged past Opus 5.5 on its lowest, for less than half the cost per task.", "per task"),
):
    z = step(by_slug[a_s], by_slug[b_s], "article")
    z["article_sentence"] = quote
    z["article_measure"] = measure
    z["holds_per_task"] = None  # filled below by plain comparison, our reading
    article_spans.append(z)
article_spans[0]["holds_per_task"] = 2.25 <= article_spans[0]["cost_multiple_per_task"] < 2.75
article_spans[1]["holds_per_task"] = 4.25 <= article_spans[1]["cost_multiple_per_task"] < 4.75
article_spans[2]["holds_per_task"] = 10.5 <= article_spans[2]["cost_multiple_per_task"] < 11.5
article_spans[3]["holds_per_task"] = round((article_spans[3]["cost_multiple_per_task"] - 1) * 100) == 28
article_spans[4]["holds_per_task"] = article_spans[4]["cost_multiple_per_task"] < 0.5 and article_spans[4]["points_gained"] > 0

derived = {
    "what_this_is": "OUR ARITHMETIC on data-final.json, not figures Artificial Analysis publishes. Every input is a confirmed row in data-final.json (named by slug in each entry). Built " + NOW + ".",
    "credit": "Underlying scores and costs: Artificial Analysis (artificialanalysis.ai), read 17 Oct 2026. Calculations: ours.",
    "formulas": {
        "points_gained": "score(to) minus score(from): Intelligence Index points on Artificial Analysis's 0 to 100 scale, from the API's one-decimal scores in data-final.json. Exact to one decimal.",
        "points_gained_page_whole_numbers": "score_on_page(to) minus score_on_page(from): the same gap on the whole numbers the pages print. Can differ from points_gained by up to 1; an exhibit uses one or the other, never both.",
        "cost_multiple": "cost_usd(to) divided by cost_usd(from): how many times as much it cost Artificial Analysis to run its full test set, in US dollars at list prices. Rounded half up to two decimals. Below 1 means it cost less.",
        "cost_multiple_per_task": "cost_per_task_usd(to) divided by cost_per_task_usd(from): the same on Artificial Analysis's cost per task, the measure the article quotes. Rounded half up to two decimals. Shown so exhibits and article can be squared; label which measure an exhibit uses.",
        "thinking_range": "For each model listed at two or more settings: lowest setting Artificial Analysis lists to highest (order: Non-reasoning, Low, Medium, High, Xhigh, Max).",
        "thinking_steps": "Each pair of neighbouring settings in that order, for each model, using only the settings Artificial Analysis lists.",
        "model_upgrades_matched_level": "Older version to newer version of the same model line at the same thinking level: Claude Opus 5 to Claude Opus 5.5, GPT-6 Sol to GPT-6.1 Sol.",
    },
    "thinking_range": ranges,
    "thinking_steps": steps,
    "model_upgrades_matched_level": upgrades,
    "single_setting_models": single,
    "article_spans": {
        "why": "The article (" + ARTICLE + ", not to be changed) quotes these spans on cost PER TASK. The house rule for exhibits is cost to run the FULL TEST SET, which gives different multiples. Each entry has both, so an exhibit placed beside the sentence can match it or say plainly which measure it shows.",
        "spans": article_spans,
    },
}

# ------------------------------------------------------------ disagreements
fam_counts = {}
for x in api_only_out:
    fam_counts[x["family_in_api_file"]] = fam_counts.get(x["family_in_api_file"], 0) + 1
with_data = [x for x in api_only_out if x["visible_text_check_of_curl_copy"]["score_text"] is not None]
vis_all_agree = all(
    all(v is not False for k, v in x["visible_text_check_of_curl_copy"].items() if k.endswith("_agrees"))
    for x in with_data)
traps = [r for r in rows if any(n.startswith("Rounding trap") for n in r["notes"])]
costed = [r for r in rows if r["cost_usd"] is not None]
tokened = [r for r in rows if r["output_tokens"] is not None]
sp = {(z["from"]["slug"], z["to"]["slug"]): z for z in article_spans}
o55 = next(x for x in ranges if x["model"] == "Claude Opus 5.5")
opus_up_max = next(z for z in upgrades[0]["by_level"] if z["thinking_level"] == "Max")
final["disagreements"] = [
    {"what": "Coverage. " + str(len(api_only)) + " of the API's " + str(len(API["variants"])) + " variants are not in the page read: " + ", ".join(f"{k} ({v}{': the Daybreak Blue entry' if k == 'GPT-6 Sol' else ''})" for k, v in sorted(fam_counts.items())) + ". The page read covered the seven model versions the article names (Opus 5.5, Opus 5, Sonnet 5.5, Haiku 5.5, Fable 5.1, GPT-6 Sol, GPT-6.1 Sol) and three Google models (Gemini 4 Argon, Gemini 3.1 Pro Preview, Gemini 3.8 Flash).",
     "resolution": "Left out of rows (listed in left_out). Their pages exist, so 'the page could not show it' does not apply. Side check: the visible text of the API pull's own curl copies " + ("agrees" if vis_all_agree else "DOES NOT agree") + " with the API on score, cost per task, release date and output tokens, wherever the page prints them, for all " + str(len(with_data)) + " that have a score. Not checked: the full-test-set cost, which the page draws only as a chart label once it renders. GPT-6 Sol (Daybreak Blue, max) has no score or cost at all; GPT-5.6 Sol (Non-reasoning) has an estimated score and no cost. A rendered page read of the others would let them in."},
    {"what": "Thinking-level name. GPT-6 Sol's lowest setting is 'off' in the API file and 'non-reasoning' in the page file.",
     "resolution": "Same variant (same slug gpt-6-sol-non-reasoning and same Artificial Analysis name, 'GPT-6 Sol (Non-reasoning)'). Recorded as thinking_level 'off', printed as 'Non-reasoning'."},
    {"what": "Status. The API file labels GPT-6 Sol 'current' and Opus 5 'previous generation'; both pages say 'This model is deprecated.'",
     "resolution": "Not a data conflict: both files carry Artificial Analysis's deprecated flag. 'Current' is the API file's own label, from OpenAI's help page saying GPT-6 Sol still powers ChatGPT's GPT-6 option. Rows carry aa_marks_deprecated and a note; the scores and costs stand as measured."},
    {"what": "Score precision. The API gives one decimal, the pages whole numbers. All " + str(len(rows)) + " agree within rounding, and every page number is the unrounded score rounded half up. Rounding traps, where the one-decimal figure rounded again gives a different whole number from the page: " + "; ".join(f"{r['variant']} {r['score']} v page {r['score_on_page']}" for r in traps) + ".",
     "resolution": "score is the API's one-decimal figure; score_on_page keeps the page's whole number. Never round the one-decimal figure again."},
    {"what": "Cost precision. The API gives cents, the page's chart labels whole dollars. All " + str(len(costed)) + " costed rows agree within 50 cents and to the cent with the page data. Gemini 3.8 Flash (Low) has no cost in either.",
     "resolution": "cost_usd is the API figure; cost_on_page_usd keeps the label. Gemini 3.8 Flash (Low) stays in with a null cost and chartable_on_cost false."},
    {"what": "Haiku 5.5 costs. The page stars all five ('Claude Haiku 5.5 has 5x higher pricing on longer-context inputs which are not currently reflected'); the API value carries no warning.",
     "resolution": "Same numbers kept. Every Haiku row carries the note; any exhibit showing a Haiku cost carries the starred line."},
    {"what": "Output tokens are not an API figure: the free API tier does not return them. The API file took exact counts from each page's embedded data.",
     "resolution": "Kept as page figures with the source named in api_field.output_tokens_source. All " + str(len(tokened)) + " agree with the page's own two-significant-figure card and sentence."},
    {"what": "Index version. The API reports v4.3; the pages say v4.3.2.",
     "resolution": "Same index: the API returns major and minor only, and its documentation says v4.3.2."},
    {"what": "Index weighting (between Artificial Analysis's own pages, not between our files). The index page says four categories at 25% each; the methodology page says 30/20/20/30.",
     "resolution": "Unresolved by Artificial Analysis. No exhibit states the weights."},
    {"what": "Cost measure, article v exhibits. The article quotes cost per task; cost_usd is the full test set, and the multiples differ: Opus 5.5 Low to Medium " + f"{sp[('claude-opus-5-5-low','claude-opus-5-5-medium')]['cost_multiple_per_task']}x per task v {sp[('claude-opus-5-5-low','claude-opus-5-5-medium')]['cost_multiple']}x full set; Medium to Max {sp[('claude-opus-5-5-medium','claude-opus-5-5')]['cost_multiple_per_task']}x v {sp[('claude-opus-5-5-medium','claude-opus-5-5')]['cost_multiple']}x; Low to Max {sp[('claude-opus-5-5-low','claude-opus-5-5')]['cost_multiple_per_task']}x v {sp[('claude-opus-5-5-low','claude-opus-5-5')]['cost_multiple']}x; Fable 5.1 Xhigh to Max {sp[('claude-fable-5-1-xhigh','claude-fable-5-1')]['cost_multiple_per_task']}x v {sp[('claude-fable-5-1-xhigh','claude-fable-5-1')]['cost_multiple']}x.",
     "resolution": "Both measures are in data-final.json and derived.json. The article's figures hold on cost per task. An exhibit beside those sentences either shows cost per task or says it shows the full test set and why its multiple differs."},
    {"what": "Points basis. Gaps on the page's whole numbers differ from gaps on the one-decimal scores, e.g. Opus 5.5 Low to Max " + f"{o55['points_gained_page_whole_numbers']} v {o55['points_gained']}; Opus 5 to Opus 5.5 at Max {opus_up_max['points_gained_page_whole_numbers']} v {opus_up_max['points_gained']}.",
     "resolution": "derived.json gives both; each exhibit uses one basis throughout."},
]

key_order = ["what_this_is", "credit", "inputs", "definitions", "how_rows_were_confirmed", "row_count",
             "rows", "disagreements", "left_out", "page_only", "check_log"]
final = {k: final[k] for k in key_order}
json.dump(final, open(f"{BASE}/data-final.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
json.dump(derived, open(f"{BASE}/derived.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)

print("both", len(both), "api_only", len(api_only), "page_only", len(page_only), "rows", len(rows))
print("core disagreements:", json.dumps(disagreements, indent=1))
allfails = {s: [c for c in log if not c["ok"]] for s, log in checks_log.items()}
print("any failing checks:", json.dumps({s: f for s, f in allfails.items() if f}, indent=1))
print("double rounding:", [r["slug"] for r in rows if any(n.startswith("Rounding trap") for n in r["notes"])])
for x in api_only_out:
    print("API-only", x["slug"], json.dumps(x["visible_text_check_of_curl_copy"]))
