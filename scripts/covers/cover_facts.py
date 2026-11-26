"""Resolve cover artwork from one piece's editorial facts."""
from datetime import date
import json
from pathlib import Path
import re
from urllib.parse import urlsplit

from PIL import Image

FAMILIES = {"wide": ("portrait", "evidence", "number", "object"),
            "vertical": ("portrait", "receipt", "figure")}
SERIES = {"mind.the.gap": "#FF6A4D", "under.the.hood": "#B7A6FF",
          "follow.the.money": "#FFD84D"}
LICENSE = re.compile(r"(?:public domain|cc0(?: 1\.0)?|cc by(?:-sa)?(?: [1-4]\.0| 2\.5)?)", re.I)


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def lines(value):
    items = value if isinstance(value, list) else [value]
    if not items or any(not isinstance(item, str) or not item.strip() for item in items):
        raise ValueError("A required cover-facts headline or figure is empty.")
    return items


def person_eligible(person, base):
    if not person or person.get("own_story") is not True or person.get("company_accusation") is not False:
        return False
    source = urlsplit(person.get("file_page", ""))
    return bool(source.scheme == "https" and source.hostname == "commons.wikimedia.org"
                and source.path.startswith("/wiki/File:") and LICENSE.fullmatch(person.get("license", ""))
                and all(person.get(key) for key in ("name", "artist", "image"))
                and (base / person["image"]).is_file())


def latest_published(entries, facts):
    before = date.fromisoformat(facts["date"])
    published = [row for row in entries if (row.get("status") == "published" or row.get("published_at"))
                 and date.fromisoformat(row["date"]) < before]
    return max(published, key=lambda row: (row["date"], row.get("published_at") or ""), default=None)


def previous_families(facts, base):
    """Read the latest earlier published record, or the editor's recorded predecessor."""
    art = facts.get("image_led", {})
    record = art.get("previous_published")
    if record is None and art.get("catalogue"):
        record = latest_published(read(base / art["catalogue"]), facts)
    if record is None:
        post = base / "post.json"
        record = read(post).get("previous_published") if post.is_file() else None
    if record is None:
        known = []
        for path in base.parent.glob("*/post.json"):
            row = read(path)
            if row.get("date") and (row.get("published_at") or row.get("status") == "published"):
                known.append(dict(row, folder=path.parent))
        prior = latest_published(known, facts)
        if prior:
            folder = prior["folder"]
            record = {"date": prior["date"], "source": f"{folder.name}/post.json", "families": {}}
            if prior.get("cover_set"):
                prior_receipt = read(folder / prior["cover_set"])
                if prior_receipt.get("status") != "passed":
                    raise ValueError("The preceding published post points to a held cover receipt.")
                record["families"] = prior_receipt["families"]
    if not record:
        return {"families": {}, "source": "No previous image-led family recorded"}
    if isinstance(record, str):
        path = base / record
        prior = read(path)
        if prior.get("status") not in (None, "passed", "published"):
            raise ValueError("The previous published piece must reference a completed cover set.")
        record = {"source": str(record), "families": prior["families"], "date": prior.get("date")}
    families = record["families"]
    if any(k not in FAMILIES or v not in FAMILIES[k] for k, v in families.items()):
        raise ValueError("Unrecognised family in previous_published.")
    return record


def pick(facts, base, system, previous):
    art = facts.get("image_led", {})
    cover = facts.get("cover", {})
    proof = cover.get("proof") or {}
    figure = art.get("figure") or {}
    have_proof = bool(any(proof.get(k) for k in ("page", "html", "pdf", "image")) and proof.get("source"))
    have_figure = bool(figure.get("value") and figure.get("caption") and figure.get("source"))
    supported = {"portrait": person_eligible(art.get("person"), base),
                 "evidence": have_proof, "receipt": have_proof, "number": have_figure,
                 "figure": have_figure, "object": True}
    for family in FAMILIES[system]:
        if supported[family] and family != previous.get(system):
            return family
    raise ValueError(f"No supported {system} family differs from the previous {previous.get(system)!r}.")


def generate_still(brief, aspect):
    """Codex supplies a native plate for this slot."""
    raise ValueError(f"A {aspect} still is needed. See the still brief in covers.json.")


def resolve_stills(facts, base, families, briefs):
    art = facts.get("image_led", {})
    stills = {}
    for system, family in families.items():
        if family not in {"object", "number", "figure", "receipt"}:
            continue
        aspect = "16:9" if system == "wide" else "9:16"
        images = art.get("stills", {})
        name = images.get(system) or images.get("existing") or facts.get("still")
        if name and (base / name).is_file():
            stills[system] = (base / name).resolve()
        else:
            subject = art.get("still_subject") or facts["headline"]
            brief = (f"Photograph the specific real object or setting in this story: {subject}. "
                     "Editorial photojournalism in natural light. No people, readable logos or text. "
                     f"Compose natively at {aspect}.")
            briefs.append({"system": system, "aspect": aspect, "brief": brief})
    for row in briefs:
        generated = Path(generate_still(row["brief"], row["aspect"])).resolve(strict=True)
        w, h = map(int, row["aspect"].split(":"))
        with Image.open(generated) as image:
            if image.width * h != image.height * w:
                raise ValueError(f"Generate the {row['system']} still natively at {row['aspect']}.")
        stills[row["system"]] = generated
    return stills
