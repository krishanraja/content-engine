# Drawing the options: the facts, the logos, the machine

Reference for `.agents/skills/thumbnail-designer/SKILL.md`, steps 2 and 3. These rules were produce-video step 5
until 15 Nov 2026; they moved here with the drawing.

## The machine

```
$env:MYMU_BROWSER = "msedge"     # Windows; in the cloud container: MYMU_BROWSER=/opt/pw-browsers/chromium
python scripts/pages/build.py docs/plans/PLAN/cover-facts.json --thumbs --options 3 --brief WORK/thumbs/brief.json --out WORK/thumbs
```

It needs the internet for the proof (it fetches the source PDF or page named in the facts) and the wordmark, and
Playwright for Python with a browser. Never pass `--assets`: the logo paths are relative to the facts file.

## The facts and the logos

- A plan keeps its real logos as SVG in `docs/plans/PLAN/logos/`, so any checkout draws its thumbnails, a home
  computer included.
- A plan with no `logos/` folder (made before 12 October) cannot be drawn here: never draw a thumbnail without the
  real logos. The cuts still render and archive, but they are not sent to the library (produce-video step 8) and are
  recorded without a thumbnail (step 9). Put a board item (`idea_id`, `"closes_on": "video"`) asking the session that
  holds the cover's logos to commit them as SVG under `docs/plans/PLAN/logos/` and draw the thumbnails. Video assets
  stays "thumbnail still to make" until then.
- A missing logo goes into the cover facts as `"thumbs": {"strip": [{"logo": ..., "name": ...}]}` with its real logo,
  never a drawn stand-in. Which logos belong on a thumbnail is the brief's `named` list (the cover standard, point 3),
  and `scripts/post-pack/visual_gate.py` holds a cover or thumbnail to the same rule: at most three logos, each of a
  company the piece names, none required (Ruling, Krish, 2026-11-15). Every company the piece names still has to be on
  one of the piece's pictures, so a company left off the thumbnail goes on an article figure or the cover.
- The options themselves: `"thumb_options": [{"id": "a", "note": "...", "proof": {...}, "proof_width": "58%" | "50%" |
  "44%", "proof_first": true, "logos_under": true}, ...]` in the cover facts. `"proof"` is merged over the thumbnail's
  own proof: a new `"crop"` inside its `"pdf"`, `"page"` or `"html"` keeps the picture and its source; a different
  picture replaces it whole and must name one of the piece's checked sources. An option may not change the words, the
  logos, the skin or the tag, and may never add his face (`thumb_options.py`, `NOT_AN_OPTION`).
- Put the logos under the headline (`"logos_under": true`): the cover standard, point 3, wants them there, smaller
  than it. The plain drawer still puts them above on the wide shape until three skins keep their decoration off logos
  under the words (`WORKBENCH.md`, 10 Nov), so in the extruded, bauhaus or brandbook week an option with them under
  may be refused; the drawer names it, and the other options stand.

## The last five posts

The grid mock puts each option beside the last five covers posted to his Instagram grid, newest first. Only a file
read on this machine counts, recorded by its sha256; a past post is never drawn or guessed.

- Where they live: each posted video's designed cover is its piece's thumbnail on its making record
  (`video_assets[].thumbnail`, its Drive link), which the live board lists per day as media with a Drive link
  (`GET /api/board/<Monday>/view`, `media`), and from 15 Nov the piece manifest names it per channel
  (`cover: {asset, sha256}`). Growth's carousels and off-day posts are on the same grid; Growth's own records say
  which went out (`GET /api/board/<Monday>/pieces`).
- Fetch each through the Drive connector or `GET /api/board/<Monday>/media/<id>` into the work folder, then pass them
  as `--past` (newest first). `python3 scripts/pages/thumb_options.py mock WORK/thumbs --past ...` draws the mock again
  later; it removes the old verdict, so the critic looks again.
- When they cannot be read in this session, draw the mock with the options alone. Its record and its caption say so,
  and so does your reply.

## One open conflict

This is for Krish, once, when it bites. Do not pick a side.

The logo count is settled: the gate follows the cover standard (Ruling, Krish, 2026-11-15: "yes, make the gate follow
the cover standard").

**His face and 4 words.** `config/hook-playbook.json` still describes the thumbnail as "Under 4 words over his face
   and the logos" and the Substack cover "with his face and 3 to 5 big words". THE_RECEIPT (2 Nov) took the face off
   every cover and thumbnail, and the cover standard (9 Nov) allows 7 words. The playbook is a taste config, changed
   only by Krish in person.
