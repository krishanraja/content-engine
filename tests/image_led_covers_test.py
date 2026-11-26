import json
import math
from pathlib import Path
import sys
import unittest
from contextlib import nullcontext
from unittest.mock import patch

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "scripts/covers"), str(ROOT / "scripts/post-pack")]
import cover_facts
from cover_outputs import OUTPUTS, pack_entries
import make_covers
import proof
import thumb_gate
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

    def test_reads_preceding_published_post_pack(self):
        prior = self.base / "monday"
        current = self.base / "wednesday"
        prior.mkdir()
        current.mkdir()
        (prior / "post.json").write_text(json.dumps({"date": "2026-11-09", "status": "published", "cover_set": "covers.json"}))
        (prior / "covers.json").write_text(json.dumps({"status": "passed", "families": {"wide": "evidence", "vertical": "receipt"}}))
        last = cover_facts.previous_families(self.facts, current)
        self.assertEqual(last["families"], {"wide": "evidence", "vertical": "receipt"})
        self.assertEqual(cover_facts.pick(self.facts, current, "wide", last["families"]), "number")
        self.assertEqual(cover_facts.pick(self.facts, current, "vertical", last["families"]), "figure")

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
                        # The wide portrait family carries the piece title beside its subject (approved 26 Nov 2026).
                        words = "Piece" if family == "portrait" else (
                            "Video &amp; hook" if fmt == "youtube" else "Article &lt;&amp;&gt;")
                        self.assertIn(words, doc)
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

    def test_colour_floor_applies_to_both_vertical_aspects(self):
        for width, height in [(160, 90), (1200, 630), (90, 160), (108, 135), (160, 160)]:
            image = Image.new("RGB", (width, height), "white")
            ImageDraw.Draw(image).rectangle((0, 0, width // 2, height), fill="black")
            path = self.base / "greyscale.png"
            image.save(path)
            metrics, fails = make_covers.measure(path, {"cap_height_px": 7, "local_contrast": 4.5})
            self.assertEqual(fails, ["colour"] if width < height else [])
            self.assertEqual(metrics["colour"], 0)
            self.assertEqual("cap_height_px" in metrics, width > height)

    def test_ink_ground_vertical_and_substack_scope(self):
        path = self.base / "ink.png"
        image = Image.new("RGB", (90, 160), "black")
        ImageDraw.Draw(image).rectangle((0, 0, 44, 160), fill=(120, 120, 120))
        image.save(path)
        for family in ("receipt", "portrait"):
            self.assertNotIn("colour", make_covers.measure(path, vertical_family=family)[1])
            self.assertNotIn("light", make_covers.measure(path, vertical_family=family)[1])
        self.assertIn("colour", make_covers.measure(path, vertical_family="figure")[1])
        wide = self.base / "substack.png"
        Image.new("RGB", (160, 84), "black").save(wide)
        self.assertNotIn("cap_height_px", make_covers.measure(wide, sidebar=False)[1])
        self.assertIn("cap_height_px", make_covers.measure(wide)[1])

    def test_wide_headline_is_sentence_case(self):
        import layout
        facts = {"video_title": "AI music or human music?", "image_led": {}}
        self.assertEqual(layout.wide_headline(facts, "youtube", "evidence", "AI MUSIC OR HUMAN MUSIC?"),
                         "AI music or human music?")
        self.assertEqual(layout.wide_headline(facts, "substack", "evidence", "Meta staff gamed it."),
                         "Meta staff gamed it.")
        self.assertEqual(layout.wide_headline(facts, "youtube", "portrait", "Short hook."), facts["video_title"])
        facts["image_led"]["wide_headline"] = {"youtube": "They faked AI use."}
        self.assertEqual(layout.wide_headline(facts, "youtube", "evidence", "X"), "They faked AI use.")

    def test_wide_gate_keeps_global_floors_and_requires_bound_type_evidence(self):
        path = self.base / "wide.png"
        Image.new("RGB", (160, 90), "black").save(path)
        self.assertEqual(make_covers.measure(path)[1], ["contrast", "light", "cap_height_px", "local_contrast"])
        checker = Image.new("RGB", (40, 23), "black")
        for y in range(23):
            for x in range(40):
                if (x + y) % 2:
                    checker.putpixel((x, y), (255, 255, 255))
        checker.resize((160, 90), Image.Resampling.NEAREST).save(path)
        at_floor = {"cap_height_px": 7, "local_contrast": 4.5}
        self.assertEqual(make_covers.measure(path, at_floor)[1], ["busy"])
        for key in at_floor:
            below = dict(at_floor)
            below[key] = math.nextafter(at_floor[key], 0)
            self.assertEqual(make_covers.measure(path, below)[1], ["busy", key])
        (self.base / "covers.json").write_text(json.dumps({"files": [
            {"format": "youtube", "sha256": "stale", "gate_160": {"metrics": at_floor}}]}))
        self.assertEqual(make_covers.measure(path)[1], ["busy", "cap_height_px", "local_contrast"])

    def test_type_measurement_uses_rendered_ink_and_each_glyphs_own_background(self):
        font = ImageFont.truetype(str(ROOT / "assets/fonts/makeyourmindup/Fraunces-Upright-Variable.ttf"), 24)
        cap = Image.new("L", (42, 38))
        ImageDraw.Draw(cap).text((2, 0), "H", fill=255, font=font)
        mask = Image.new("L", (320, 180))
        centres = [(16, 20), (218, 20)]
        boxes = []
        for xy in centres:
            draw = ImageDraw.Draw(mask)
            draw.text(xy, "H", fill=255, font=font)
            boxes.append(draw.textbbox(xy, "H", font=font))
        bg = Image.new("RGB", mask.size, "black")
        ImageDraw.Draw(bg).rectangle((160, 0, 319, 179), fill="white")
        cover = Image.composite(Image.new("RGB", mask.size, "white"), bg, mask)
        metrics = thumb_gate.type_metrics(cover, bg, mask, boxes, [cap])
        self.assertGreaterEqual(metrics["cap_height_px"], 7)
        self.assertEqual(metrics["local_contrast"], 1)
        dark = Image.composite(Image.new("RGB", mask.size, "black"), bg, mask)
        cover.paste(dark.crop((160, 0, 320, 180)), (160, 0))
        metrics = thumb_gate.type_metrics(cover, bg, mask, boxes, [cap, cap.resize((16, 12))])
        self.assertLess(metrics["cap_height_px"], 7)
        self.assertGreaterEqual(metrics["local_contrast"], 4.5)

    def test_local_srgb_contrast_at_the_boundary(self):
        bg = Image.new("RGB", (160, 90), "white")
        mask = Image.new("L", bg.size, 0)
        ImageDraw.Draw(mask).rectangle((30, 20, 36, 26), fill=255)
        cap = Image.new("L", (5, 7), 255)
        for value, passes in [(118, True), (119, False)]:
            cover = Image.composite(Image.new("RGB", bg.size, (value,) * 3), bg, mask)
            m = thumb_gate.type_metrics(cover, bg, mask, [(30, 20, 37, 27)], [cap])
            self.assertEqual(m["cap_height_px"], 7)
            self.assertEqual(m["local_contrast"] >= 4.5, passes)

    def test_mark_under_part_of_one_glyph_is_sampled(self):
        bg = Image.new("RGB", (160, 90), "white")
        ImageDraw.Draw(bg).rectangle((0, 24, 159, 28), fill="black")
        mask = Image.new("L", bg.size, 0)
        draw = ImageDraw.Draw(mask)
        draw.rectangle((30, 20, 34, 23), fill=255)
        draw.rectangle((30, 24, 34, 28), fill=246)
        cover = Image.composite(Image.new("RGB", bg.size, "black"), bg, mask)
        m = thumb_gate.type_metrics(cover, bg, mask, [(30, 20, 35, 29)], [mask.crop((30, 20, 35, 29))])
        self.assertEqual(m["local_contrast"], 1)

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
            return [], {"cap_height_px": 9, "local_contrast": 8} if fmt in ("youtube", "substack") else None

        with patch.object(make_covers, "browser_session", return_value=nullcontext(object())), patch.object(make_covers, "screenshot", side_effect=shot):
            record = make_covers.build(self.base, out, ["wide", "vertical"])
        self.assertEqual(record["issues"], [])
        self.assertEqual(record["status"], "passed")
        entries = pack_entries(out / "covers.json", "story")
        self.assertTrue(all(item["gate_160"]["fails"] == [] for item in record["files"]))
        self.assertEqual(make_covers.measure(out / OUTPUTS["youtube"][0]),
                         (record["files"][0]["gate_160"]["metrics"], []))
        self.assertEqual([(r.get("kind"), r.get("shape")) for r in entries[:4]],
                         [("thumbnail", "wide"), ("substack-cover", None), ("vertical-cover", None), ("thumbnail", "tall")])
        self.assertEqual(Path(entries[4]["file"]).relative_to(out).as_posix(), "carousel/slide-01.png")
        import build as pack_builder
        post = {"date": "2026-11-10", "subject": "A verified pack", "subchannel": "mind_the_gap",
                "piece_id": "story", "cover_set": "out/covers.json"}
        post_path = self.base / "post.json"
        post_path.write_text(json.dumps(post))
        packed = pack_builder.build(post_path, out=self.base / "archive")
        archive = Path(packed["path"])
        self.assertEqual(json.loads((archive / "2 Covers and images/covers.json").read_text()), record)
        self.assertEqual((archive / "2 Covers and images/substack-cover-1200x630.png").read_bytes(),
                         (out / OUTPUTS["substack"][0]).read_bytes())
        self.assertEqual(len(list(archive.rglob("slide-01.png"))), 1)
        wide = out / OUTPUTS["youtube"][0]
        self.assertEqual(visual_gate.image_led_problems(wide, "youtube"), [])
        wide.write_bytes(b"altered")
        self.assertTrue(visual_gate.image_led_problems(wide, "youtube"))
        with self.assertRaisesRegex(ValueError, "does not match"):
            pack_entries(out / "covers.json")
        with patch.object(make_covers, "browser_session", return_value=nullcontext(object())), patch.object(make_covers, "screenshot", side_effect=shot), patch.object(make_covers, "measure", return_value=({}, ["local_contrast"])):
            held = make_covers.build(self.base, out, ["wide"])
        self.assertEqual(held["status"], "held")
        with self.assertRaisesRegex(ValueError, "held"):
            pack_entries(out / "covers.json")

    def test_unreadable_facts_invalidate_a_passing_receipt(self):
        out = self.base / "out"
        out.mkdir()
        receipt = out / "covers.json"
        receipt.write_text(json.dumps({"status": "passed"}))
        (self.base / "cover-facts.json").write_text("{broken")
        record = make_covers.build(self.base, out, ["wide"])
        self.assertEqual(record, cover_facts.read(receipt))
        self.assertEqual(record["status"], "held")
        self.assertTrue(record["issues"])
        with self.assertRaisesRegex(ValueError, "held"):
            pack_entries(receipt)


if __name__ == "__main__":
    unittest.main()
