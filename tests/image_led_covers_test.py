import json
from pathlib import Path
import sys
import unittest
from contextlib import nullcontext
from unittest.mock import patch

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "scripts/covers"), str(ROOT / "scripts/post-pack")]
import cover_facts
from cover_outputs import OUTPUTS, pack_entries
import make_covers
import proof
import visual_gate
from frame_capture import workspace


class ImageLedCoversTest(unittest.TestCase):
    def setUp(self):
        cache = ROOT / ".cache/test-covers"
        cache.mkdir(parents=True, exist_ok=True)
        self.base = self.enterContext(workspace(cache))
        self.facts = {"cover": {"headline": ["Article <&>"], "proof": {"source": "s1", "tag": "Journal",
                      "page": {"url": "https://example.org", "crop": [0, 0, 1, 1]}}},
                      "thumbs": {"headline": ["Video & hook"]}, "headline": "Piece", "date": "2026-11-10",
                      "subchannel": "mind.the.gap", "piece_id": "story",
                      "image_led": {"figure": {"value": "27%", "caption": "Chart, 2026", "source": "s1"},
                                    "proof_capture": "proof.png", "proof_photo_free": True,
                                    "stills": {"existing": "scene.jpg"}}}
        Image.new("RGB", (100, 60), "#776644").save(self.base / "scene.jpg")
        Image.new("RGB", (100, 40), "#FFFFFF").save(self.base / "proof.png")
        self.person = {"own_story": True, "company_accusation": False, "name": "Jane", "artist": "Photographer",
                       "license": "CC BY-SA 4.0", "file_page": "https://commons.wikimedia.org/wiki/File:Jane.jpg",
                       "image": "scene.jpg"}

    def test_rotation_and_licence(self):
        self.facts["image_led"]["person"] = self.person
        for system, proof_family, number in [("wide", "evidence", "number"), ("vertical", "receipt", "figure")]:
            def pick(last=None):
                return cover_facts.pick(self.facts, self.base, system, {system: last})
            self.assertEqual(pick(), "portrait")
            self.assertEqual(pick("portrait"), proof_family)
            for bad in [{"company_accusation": True}, {"company_accusation": None}, {"own_story": False},
                        {"license": "CC BY-NC"}, {"license": "CC BY-ND 4.0"}, {"artist": ""},
                        {"file_page": "https://commons.wikimedia.org.example.org/wiki/File:Jane.jpg"}]:
                self.facts["image_led"]["person"] = self.person | bad
                self.assertEqual(pick(), proof_family)
                self.assertEqual(pick(proof_family), number)
            self.facts["image_led"]["person"] = self.person
        for license in ("Public domain", "CC0", "CC BY 4.0", "CC BY-SA 3.0"):
            self.assertTrue(cover_facts.person_eligible(self.person | {"license": license}, self.base))

    def test_no_supported_different_family(self):
        self.facts["image_led"].pop("figure")
        self.assertEqual(cover_facts.pick(self.facts, self.base, "wide", {"wide": "evidence"}), "object")
        with self.assertRaisesRegex(ValueError, "differs"):
            cover_facts.pick(self.facts, self.base, "vertical", {"vertical": "receipt"})

    def test_history_skips_drafts_and_future_pieces(self):
        def row(day, state, family):
            return {"date": f"2026-11-{day}", "status": state, "families": {"wide": family}}
        rows = [row("09", "draft", "object"), row("11", "published", "number"), row("08", "published", "portrait")]
        (self.base / "catalogue.json").write_text(json.dumps(rows))
        self.facts["image_led"]["catalogue"] = "catalogue.json"
        self.assertEqual(cover_facts.previous_families(self.facts, self.base), rows[2])

    def test_every_template_uses_local_art_and_escaped_channel_words(self):
        self.facts["image_led"]["person"] = self.person
        for system, families in cover_facts.FAMILIES.items():
            for family in families:
                for fmt in (("youtube", "substack") if system == "wide" else ("vertical", "carousel")):
                    doc, _ = make_covers.document(self.facts, self.base, fmt, family,
                                                  self.base / "scene.jpg", self.base / "proof.png")
                    self.assertEqual(doc.count('class="wm"'), 1)
                    self.assertNotIn("fonts.googleapis", doc)
                    self.assertNotIn(".codex-input", doc)
                    if fmt in ("youtube", "substack"):
                        self.assertIn("Video &amp; hook" if fmt == "youtube" else "Article &lt;&amp;&gt;", doc)
                    if family == "portrait":
                        self.assertIn("Photo: Photographer, CC BY-SA 4.0, via Wikimedia Commons", doc)
                    if system == "vertical":
                        self.assertEqual(doc.count('class="anton'), 1)

    def test_safe_area_and_reels_column(self):
        cases = [("text", 90, 330, 850, 1180), ("mark", 90, 329, 340, 360),
                 ("subject", 100, 240, 800, 1681), ("proof", 90, 700, 931, 1160)]
        for i, (role, l, t, r, b) in enumerate(cases):
            bounds = {"role": role, "top": t, "left": l, "bottom": b, "right": r}
            self.assertEqual(bool(make_covers.safe_area("vertical", [bounds])), i > 0)

    def test_missing_stills_hold_both_native_briefs(self):
        self.facts["image_led"]["stills"] = {}
        self.facts["image_led"]["previous_published"] = {"families": {"wide": "evidence", "vertical": "receipt"}}
        (self.base / "cover-facts.json").write_text(json.dumps(self.facts))
        record = make_covers.build(self.base, self.base / "out", ["wide", "vertical"])
        self.assertEqual(record["status"], "held")
        self.assertEqual([r["aspect"] for r in record["still_briefs"]], ["16:9", "9:16"])
        self.assertEqual(record, cover_facts.read(self.base / "out/covers.json"))

    def test_safe_cached_proof(self):
        def offline():
            self.fail("A cached crop must not launch the browser")
        self.assertEqual(proof.capture(offline, self.facts, self.base, self.base), self.base / "proof.png")
        self.facts["image_led"]["proof_photo_free"] = False
        with self.assertRaisesRegex(ValueError, "photo_free"):
            proof.capture(offline, self.facts, self.base, self.base)
        with self.assertRaises(ValueError):
            proof.box([1, 0, 0, 1], 100, 100)

    def test_pack_mapping_and_held_rerun(self):
        (self.base / "cover-facts.json").write_text(json.dumps(self.facts))
        out = self.base / "out"

        def shot(browser, html, fmt, dest):
            im = Image.new("RGB", OUTPUTS[fmt][1], "black")
            w, h = im.size
            d = ImageDraw.Draw(im)
            d.rectangle((0, 0, w//3, h), fill="red")
            d.rectangle((w//3, 0, 2*w//3, h), fill="white")
            im.save(dest)
            return []

        with patch.object(make_covers, "browser_session", return_value=nullcontext(object())), patch.object(make_covers, "screenshot", side_effect=shot):
            record = make_covers.build(self.base, out, ["wide", "vertical"])
        self.assertEqual(record["issues"], [])
        self.assertEqual(record["status"], "passed")
        entries = pack_entries(out / "covers.json", "story")
        self.assertEqual([(r.get("kind"), r.get("shape")) for r in entries[:4]],
                         [("thumbnail", "wide"), ("substack-cover", None), ("vertical-cover", None), ("thumbnail", "tall")])
        self.assertEqual(Path(entries[4]["file"]).relative_to(out).as_posix(), "carousel/slide-01.png")
        wide = out / OUTPUTS["youtube"][0]
        self.assertEqual(visual_gate.image_led_problems(wide, "youtube"), [])
        wide.write_bytes(b"altered")
        self.assertTrue(visual_gate.image_led_problems(wide, "youtube"))
        with self.assertRaisesRegex(ValueError, "does not match"):
            pack_entries(out / "covers.json")
        with patch.object(make_covers, "browser_session", return_value=nullcontext(object())), patch.object(make_covers, "screenshot", side_effect=shot), patch.object(make_covers, "measure", return_value=({}, ["colour"])):
            held = make_covers.build(self.base, out, ["wide"])
        self.assertEqual(held["status"], "held")
        with self.assertRaisesRegex(ValueError, "held"):
            pack_entries(out / "covers.json")


if __name__ == "__main__":
    unittest.main()
