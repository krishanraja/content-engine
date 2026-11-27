"""Write LIBRARY-GUIDE.md from library.json so the guide can never drift from the Library.

Run after any registry change: python make_guide.py
"""
import json
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
reg = json.loads((HERE / "library.json").read_text(encoding="utf-8"))
items = [r for r in reg["items"] if r.get("status") != "retired"]
retired = [r for r in reg["items"] if r.get("status") == "retired"]

FAMILY = {"video-vertical": "Vertical video (Shorts, Reels, TikTok)", "video-wide": "Wide video (YouTube, Substack, Spotify)",
          "carousel": "Carousels", "social": "Social covers, thumbnails and posts", "profile": "Profiles and channel art",
          "podcast": "Podcast", "newsletter": "Newsletter and Substack", "web": "Site", "email": "Email",
          "future": "Talks, press, partners and paid", "copy": "Words without artwork", "sonic": "Sound"}
DAY = {"mon": "Mon", "tue": "Tue", "wed": "Wed", "thu": "Thu", "fri": "Fri", "sat": "Sat", "sun": "Sun"}


def free_slots(r):
    """What a production session fills, per slot role."""
    out = []
    for name, rule in (r.get("slots") or {}).items():
        role = rule.get("role")
        if role in ("headline", "body"):
            out.append(f"{name}: words (Krish's pick; {rule.get('max_chars', '?')} chars, {rule.get('max_lines', '?')} lines max)")
        elif role in ("label", "source", "figure"):
            out.append(f"{name}: from the piece and its sources ({rule.get('max_chars', '?')} chars max)")
        elif role == "photo":
            opts = rule.get("options") or {}
            if rule.get("source_only"):
                out.append(f"{name}: original only (approved headshot or a credited real photo)")
            else:
                out.append(f"{name}: generate per piece" + (f" to match {', '.join(f'{k} {v}' for k, v in opts.items())}" if opts else ""))
        elif role == "document":
            out.append(f"{name}: real source evidence or logo")
        elif role:
            out.append(f"{name}: {role}")
    return "; ".join(out) or "nothing (fixed artwork)"


lines = []
w = lines.append
w("# The makeyourmindup Library: where to use everything, and what you may change")
w("")
w("Generated from `library.json` by `make_guide.py`. Read this before making any artwork for makeyourmindup. The rendered templates are the bar; nothing ships below them.")
w("")
w("**Who makes what (Krish, 26 Nov 2026):** content-engine makes every asset here and writes its captions into the piece manifest; growth posts, schedules, distributes and measures. There is one engine and one template source: this Library.")
w("")
w("## Read these before making anything")
w("- `ART-DIRECTION.md`: read it first. The owner's variety and imagery rules: imagery order, treatment rotation, type lanes, colour as signal, no badges, and mood.")
w("- `PRODUCTION-PLAYBOOK.md`: how to assemble every piece (hero vertical, long cut, carousel, covers, off-day, good news, weekly edition, Notes) from these templates, how to choose the cover family, every edge case per asset with the action, and what each refusal stamp means.")
w("- `STANDARD.md` (the poster and the evidence), `TITLES.md` (his title shapes), `COVERS-PLAYBOOK.md`, `CAROUSEL-FORMAT.md` (the 3-second swipe), `IMAGERY.md` (what may be pictured).")
w("- `SCRIPT-TO-MOTION.md` (beats that land on the spoken word, the four caption styles) and `MOTION-FLOOR.md` (the minimum standard for every cut).")
w("- `scripts/library/make_piece.py` (from the repository root) fills carousel sets from a piece's cover facts and hands the files to post-pack.")
w("- `scripts/covers/make_covers.py` (from the repository root) draws every cover and thumbnail in the two approved cover systems (Krish, 26 Nov 2026: \"I approve the new cover thumbnail systems, go\"). No Library template makes a cover or thumbnail; the old cover templates are retired (the list at the end).")
w("- `LOCKING.md` (what a locked template means). `EDGE-CASES.md` and the `ROUND-*`, `FIX*`, `CRITIQUE-*` and `BRIEF*` files are build history: never production instructions.")
w("")
w("## The rule in one line")
w("**Fill the slots, never move the frame.** A template fixes the layout, type, colour, marks, motion and safe zones. A production session supplies the words (Krish picks them), the images (generated per piece to match the slot's exemplar) and the evidence (real logos, screenshots and documents). Everything else is already decided.")
w("")
w("## Fixed: never change these")
w("- **Palette:** ink #0C1512 with 7% grain, cream #F4EFE4, mint #7EF0C0 (the answer), coral #FF6A4D, butter #FFD84D and lilac #B7A6FF (why 1, 2, 3). No other colours, no gradients except the house burn.")
w("- **Type:** Anton for headlines (one face per headline, the payoff line in mint where the template sets it), Fraunces for decks and body, DM Mono for labels. Sizes come from each slot's rule; a template refuses copy that does not fit rather than shrinking it below the floor.")
w("- **Marks:** one wordmark per artefact, in the position the template sets. The icon never sits beside the wordmark that contains it. No watermarks.")
w("- **Geometry:** the rects, alignment columns, spacing (40 px headline to dek, 64 px between groups) and safe zones in each template. The checks in `render.py` fail anything off by more than 2 px.")
w("- **Motion:** each template's tracks, fps (25), ease (cubic-bezier(0.22,1,0.36,1)) and frame timings, plus `MOTION-FLOOR.md`.")
w("- **The approved closes and outros**, the colour-bar motif, and everything in `lock.json` once Krish approves it (a locked template only changes when a brief names it).")
w("")
w("## Free: where a session uses its judgement")
w("- **Which family for the piece.** Covers and thumbnails come from `make_covers.py`, in the families `COVERS-PLAYBOOK.md` sets out. In this Library, pick the carousel cover (headline, mint payoff, data) by channel (the Channels column below) and by what makes this story land fastest.")
w("- **The words**, always written in his shapes (`TITLES.md`) and offered to him as a few options; the template's sample words are never shipped.")
w("- **The data and the evidence.** Choose which number, timeline or meter carries this story, and cut the one real sentence that proves it. A picture slot takes the specific real thing in the story (a real place, product, screen or document). Never generic or generated people, never old music artefacts, never a mood shot (`IMAGERY.md`).")
w("- **People in pictures:** never crop through a head. The whole face sits inside the bright part of the picture with headroom above it; if the slot cannot hold the whole head, compose or generate the image for that slot's shape instead of cropping.")
w("- **Which logos and verdict chips**, limited to the companies the headline or picture names, three at most, each chip a word or two saying what that company did.")
w("- **Which series colour** leads a cover, following the why order where the piece has one.")
w("- **Ideas outside the system** go through the Divergence engine first (`divergent_run`), then to Krish as an option beside the template version, never instead of it.")
w("")
w("## Gates before Krish sees anything")
w("1. `python render.py` (fit, refusal stamps, wordmark count) and `python render.py --alignment-only` (ink alignment and spacing): zero failures.")
w("2. `python thumb_gate.py` on every cover, thumbnail and title card: the 160 px gate.")
w("3. `python motion_check.py` (the motion floor, beats, caption styles, reading holds), then the `MOTION-FLOOR.md` checklist, watching every cut at full size with sound.")
w("4. Control Center `check_voice` on all words, and the title rules in `TITLES.md`.")
w("5. `python render.py --check-locks`: no approved template changed without a brief naming it.")
w("6. `python verify_static.py`: the registry and the renderer agree.")
w("")
w("## Every template, where it is used and what to fill")
by = defaultdict(list)
for r in items:
    by[r["family"]].append(r)
for fam in FAMILY:
    if fam not in by:
        continue
    w("")
    w(f"### {FAMILY[fam]}")
    w("")
    w("| Template | Size | Days | Channels | Use | Fill per piece |")
    w("|---|---|---|---|---|---|")
    for r in by[fam]:
        days = ", ".join(DAY.get(d, d) for d in (r.get("day") or [])) or "as needed"
        ch = ", ".join(r.get("channels") or []) or r.get("platform", "")
        use = (r.get("use") or "").replace("|", "/")
        w(f"| `{r['id']}` | {r['width']} x {r['height']} | {days} | {ch} | {use} | {free_slots(r).replace('|', '/')} |")
if retired:
    w("")
    w("## Retired templates (do not use)")
    w("")
    for r in retired:
        w(f"- `{r['id']}`" + (f": use `{r['superseded_by']}`" if r.get("superseded_by") else ""))
(HERE / "LIBRARY-GUIDE.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
print("wrote LIBRARY-GUIDE.md:", len(items), "templates,", len(retired), "retired")
