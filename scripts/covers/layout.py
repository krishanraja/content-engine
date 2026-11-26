"""Fill the approved fixed-size cover layouts. Only the templates supply markup."""
from datetime import date
from html import escape
from pathlib import Path
from string import Template

from cover_outputs import OUTPUTS
from cover_facts import SERIES, lines, read

ROOT = Path(__file__).resolve().parents[2]
TEMPLATES = Path(__file__).with_name("templates")
FONTS = ROOT / "assets/fonts/makeyourmindup"


def wordmark(dark):
    svg = (ROOT / "assets/brand/makeyourmindup/v5/v9.svg").read_text(encoding="utf-8")
    if dark:
        token = read(ROOT / "config/ve/brand-tokens.json")["cover_wordmark"]["mint-on-cream"]
        svg = svg.replace('color="#F4EFE4"', 'color="#0C1512"', 1).replace('fill="#7EF0C0"', f'fill="{token}"', 1)
    return svg.replace("<svg ", '<svg class="wm" style="width:100%;height:auto;display:block" ', 1)


def credit(person):
    return f"Photo: {person['artist']}, {person['license']}, via Wikimedia Commons"


def image_uri(path):
    return escape(Path(path).resolve(strict=True).as_uri())


def headline(text, clause, fmt):
    if clause and clause.casefold() in text.casefold():
        start = text.casefold().index(clause.casefold())
        end = start + len(clause)
        style = 'class="it mark" style="--mk:var(--series)"' if fmt in ("youtube", "substack") else 'class="it" style="color:var(--series)"'
        return escape(text[:start]) + f'<span {style}>{escape(text[start:end])}</span>' + escape(text[end:])
    return escape(text)


def document(facts, base, fmt, family, still=None, proof=None):
    width, height = OUTPUTS[fmt][1]
    art = facts.get("image_led", {})
    cover, thumbs = facts["cover"], facts["thumbs"]
    wide = fmt in ("youtube", "substack")
    colour = SERIES[facts["subchannel"]]
    when = date.fromisoformat(facts["date"])
    text = " ".join(lines((cover if fmt == "substack" else thumbs)["headline"]))
    if family == "portrait" and not wide:
        text = facts["headline"]
    marked = facts.get("video_title_emphasis") if family == "portrait" else None
    dark = family in ("number", "figure") or (family == "portrait" and wide)
    data = {"series": escape(facts["subchannel"]), "colour": colour, "wordmark": wordmark(dark),
            "date": f"{when:%a} {when.day} {when:%b}".upper(), "headline": headline(text, marked, fmt)}
    if family == "portrait":
        person = art["person"]
        data.update(photo=image_uri(base / person["image"]),
                    person=escape(", ".join(filter(None, (person["name"], person.get("role")))).upper()),
                    credit=escape(credit(person)))
    if still:
        position = art.get("figure_position" if family in {"figure", "number"} else "still_position", [50, 50])
        x, y = position
        if not 0 <= x <= 100 or not 0 <= y <= 100:
            raise ValueError("Still position must give x and y percentages between 0 and 100.")
        data.update(still=image_uri(still), position=f"{x}% {y}%")
    if proof:
        data.update(proof=image_uri(proof), proof_caption=escape(art.get("proof_caption") or cover["proof"]["tag"]))
    logos = []
    if family == "evidence":
        rows = (thumbs if fmt == "youtube" and thumbs.get("rows") else cover).get("rows", [])
        selected = art.get("logo_names")
        if selected is not None:
            rows = [next(row for row in rows if row["name"] == name) for name in selected]
        logos = rows[:3]
        data["logos"] = "".join(
            f'<img src="{image_uri(base / row["logo"])}" alt="{escape(row["name"])}" '
            f'style="height:{round(height*.045)}px;width:auto;opacity:.78;margin-right:{round(width*.022)}px">'
            for row in logos)
    if family == "receipt":
        hot = art.get("kicker_accent_line")
        data["kicker"] = "".join(f'<div style="color:{colour if i == hot else "#F4EFE4"}">{escape(line)}</div>'
                                 for i, line in enumerate(lines(thumbs["headline"])))
    if family in ("number", "figure"):
        fig = art["figure"]
        number = lines(fig["value"])
        data.update(number=escape(" ".join(number)), figure_caption=escape(fig["caption"]),
                    number_lines="".join(f"<div>{escape(line.upper())}</div>" for line in number))
    body = Template((TEMPLATES / f"{family}-{fmt}.html").read_text(encoding="utf-8")).substitute(data)
    css = Template((TEMPLATES / "cover.css").read_text(encoding="utf-8")).substitute(fonts=FONTS.as_uri())
    ink = family in ("object", "evidence", "receipt") or (family == "portrait" and not wide)
    fit = (TEMPLATES / "fit.js").read_text(encoding="utf-8")
    html = (f'<!doctype html><html><head><meta charset="utf-8"><style>:root{{--W:{width}px;--H:{height}px;'
            f'--series:{colour}}}{css}</style></head><body class="{"ink grain" if ink else ""}">'
            f'{body}<script>{fit}</script></body></html>')
    return html, [row["name"] for row in logos]
