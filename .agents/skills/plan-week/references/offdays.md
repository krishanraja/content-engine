# The Off days options

Reference for the `plan-week` skill, read at step 3c (`.agents/skills/plan-week/SKILL.md`). Moved out of the core unchanged on 29 October 2026 so a session starts lean (`docs/COST_GUARDS.md`, G14); the gates stay named in the core.

**The Off days options** (Krish, 2026-10-28: "I'm happy to plan the
Tuesday, Thursday, Saturday, and Sunday content within the Sunday ideas
session if you give me a few options to approve as you do the
Mon/wed/fri"). On the Ideas tab, 2 to 3 options each for Tuesday,
Thursday, Saturday and Sunday of the week, for the Make Your Mind Up
Instagram, TikTok and YouTube Shorts channels (Shorts takes video only,
so a carousel goes there as a short slideshow). Each is one of four
formats: a meme made fresh from a cue, in the makeyourmindup brand kit (a
borrowed format is credited; someone else's image or clip is never
reposted); an uplifting AI news carousel, every claim naming its primary
source and dated within 7 days of its day, each checked against that
source the same day and through the fact gate before it is made; one
level-up move, a single practical way to get more from AI; or a
snackable cut from a past week's approved master, named by its piece and
word range. Each shows its format, its source and its draft copy, and
its copy passes `python3 scripts/post-pack/copy_lint.py --applies-to
channel_copy` (and `--applies-to carousel_text` for a carousel) and `node
vendor/makeyourmindup/kill-list/kill-list.mjs` before it reaches the
tab. Growth (growth-makeyourmindup) owns this lane and will feed it
automatically; until it does, the room drafts the options. Write them
into ideas.json as `offdays`, `{"tue": [...], "thu": [...], "sat": [...],
"sun": [...]}`, each with its `format`, `source` and `copy`. They reach
the tab only through `week_board.py --ideas`, never by patching the page,
and only once the board has its Off days part (it lands with the board's
own change); until then `week_board.py` does not show them, so say so in
one line in the triage readback (step 8). His one press approves or skips
each (`queue/<idea_id>` with `use: offday`, its `day` and `approved`);
Growth makes and schedules what he approved, and this repository cuts any
snackable clip.
