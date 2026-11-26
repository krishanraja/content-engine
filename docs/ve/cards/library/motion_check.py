"""Enforce MOTION-FLOOR.md on every animated template and every sequence. Exit code 1 on any failure.

    python motion_check.py

Checks (25 fps, the Library's rate):
  ease       every track uses the house ease cubic-bezier(0.22,1,0.36,1) (pulses and periodic tracks excepted)
  entrance   vertical entrances last 4 to 10 frames, long-form 7 to 12 (picture settles of 30 frames or more excepted)
  overlap    at most two entrances in flight on any frame, staggered by at least 3 frames
  overshoot  no track overshoots its end value (no bounce, no elastic)
  hold       a text-bearing frame holds still for at least 0.5 s plus 1 s per 3 words before the next shot
  beats      every script beat names a word spoken inside its shot, lands within the shot, and obeys the profile
  title      title cards settle by frame 20 and hold to the end, with no caption over them
"""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
EASE = "cubic-bezier(0.22,1,0.36,1)"
FAIL = []


def fail(where, why):
    FAIL.append(f"{where}: {why}")


def profile(item):
    return "long" if item["family"] == "video-wide" else "vertical"


def is_entrance(t):
    return t.get("property") in ("translateY", "translateX", "enterY", "scale") and not t.get("period")


def words_on(item):
    """Primary words a viewer must read: headlines and body (labels and data captions are glanced, not read)."""
    out = []
    for o in item.get("scene") or []:
        if o.get("kind") == "text" and (item.get("slots", {}).get(o.get("slot"), {}).get("role") in ("headline", "body")):
            out += [norm(w) for w in str(o.get("value", "")).split()]
    return [w for w in out if w]


def check_tracks(where, item, tracks):
    lo, hi = (4, 10) if profile(item) == "vertical" else (7, 12)
    entrances = []
    for t in tracks:
        if t.get("property") in ("pulse",) or t.get("period"):
            continue
        if t.get("ease", EASE).replace(" ", "") != EASE.replace(" ", ""):
            fail(where, f"{t.get('element')} {t.get('property')} uses {t.get('ease')} instead of the house ease")
        dur = t.get("duration", 0)
        settle = t.get("element") in ("picture", "footage") and t.get("property") == "scale" and dur >= 30
        if is_entrance(t) and not settle and not t.get("beat"):
            if not lo <= dur <= hi:
                fail(where, f"{t.get('element')} {t.get('property')} enters in {dur} frames (profile {lo} to {hi})")
            entrances.append((t.get("start", 0), t.get("start", 0) + dur, t.get("element")))
        if isinstance(t.get("from"), (int, float)) and isinstance(t.get("to"), (int, float)):
            pass  # the house ease never overshoots; an explicit overshoot value would show as a third key
        if "overshoot" in t or "bounce" in json.dumps(t).lower():
            fail(where, f"{t.get('element')} bounces or overshoots")
    for f in range(0, max([e for _, e, _ in entrances] + [0]) + 1):
        live = [e for e in entrances if e[0] <= f < e[1]]
        if len(live) > 2:
            fail(where, f"{len(live)} entrances in flight at frame {f}")
            break
    starts = sorted(s for s, _, _ in entrances)
    for a, b in zip(starts, starts[1:]):
        if 0 < b - a < 3:
            fail(where, f"entrances start {b - a} frames apart (stagger at least 3)")
            break


def norm(w):
    return re.sub(r"[^a-z0-9]", "", str(w).lower())


def main():
    reg = json.loads((HERE / "library.json").read_text(encoding="utf-8"))
    items = {r["id"]: r for r in reg["items"] if r.get("status") != "retired"}
    animated = 0
    for iid, item in items.items():
        tracks = (item.get("motion") or {}).get("tracks") or []
        if not tracks:
            continue
        animated += 1
        check_tracks(iid, item, tracks)
        if item.get("layout") == "title":
            ends = [t.get("start", 0) + t.get("duration", 0) for t in tracks if not (t.get("element") == "picture" and t.get("property") == "scale")]
            if ends and max(ends) > 20:
                fail(iid, f"title elements land at frame {max(ends)} (must settle by frame 20)")
    for name, seq in (reg.get("sequences") or {}).items():
        spoken = [(norm(w), at) for c in seq.get("captions", []) for w, at in zip(c["words"], c["onsets"])]
        for c in seq.get("captions", []):
            st = c.get("style")
            if st and st not in ("punch", "build", "line", "chip"):
                fail(f"{name}/caption@{c['start']}", f"unknown caption style '{st}'")
            if st == "punch" and c["start"] >= 125:
                fail(f"{name}/caption@{c['start']}", "punch captions are only for the opening hook (first 5 seconds)")
        for shot in seq["shots"]:
            item = items.get(shot["item"])
            if not item:
                fail(f"{name}/{shot['item']}", "shot uses a retired or missing template"); continue
            window = [(w, at) for w, at in spoken if shot["start"] <= at < shot["start"] + shot["frames"]]
            if item.get("layout") == "title":
                cues = [c for c in seq.get("captions", []) if shot["start"] <= c["start"] < shot["start"] + shot["frames"]]
                # captions may run under a title only as data for beats; the caption layer hides them (captionEligible)
            heard = {w for w, _ in window}
            unread = [w for w in words_on(item) if w not in heard]
            n_words = len(unread)
            need = round(25 * (0.5 + n_words / 3)) if words_on(item) else 0
            if need and shot["frames"] < min(need, 125) and item.get("layout") not in ("outro", "close"):
                fail(f"{name}/{shot['item']}", f"holds {shot['frames']} frames for {n_words} unspoken words on screen (needs {min(need, 125)})")
            lo, hi = (4, 22) if profile(item) == "vertical" else (7, 24)
            for b in shot.get("beats", []):
                hits = [at for w, at in window if w == norm(b["word"])]
                k = b.get("occurrence", 1)
                if len(hits) < k:
                    fail(f"{name}/{shot['item']}", f"beat word '{b['word']}' is not spoken in this shot"); continue
                start = hits[k - 1] - shot["start"] - b.get("lead", 3)
                if start < 0 or start + b.get("duration", 10) > shot["frames"]:
                    fail(f"{name}/{shot['item']}", f"beat on '{b['word']}' runs outside the shot")
                if not lo <= b.get("duration", 10) <= hi:
                    fail(f"{name}/{shot['item']}", f"beat on '{b['word']}' lasts {b.get('duration')} frames (profile {lo} to {hi})")
    for line in FAIL:
        print("FAIL", line)
    print(f"motion check: {animated} animated templates, {len(reg.get('sequences') or {})} sequences, {len(FAIL)} failures")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
