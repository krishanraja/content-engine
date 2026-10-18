# Prompt: the publish board's Sunday "Ideas" tab

Krish, 2026-10-18: "refresh This Week's Publish Board by adding a 4th tab at the front: Ideas. Cementing Ideas
and basic narrative is Sunday's job." Then: "Create a prompt to upgrade the publish boards with Sunday's ideas tab,
which pulls from all the inspo folders and all the other places that we agree to pull from (such as certain
influencers I follow or just, in general, what's happening out there)."

Paste everything below the line into a fresh Claude Code session on `krishanraja/content-engine`.

---

Upgrade the week's publish board with a first tab, **Ideas**, made every Sunday, where Krish cements next week's
three ideas and their basic narrative before anything is drafted.

**Read first, and keep to the cost rules.** `WORKBENCH.md`, `AGENTS.md` ("Cost: six standing rules"),
`docs/COST_GUARDS.md` and `docs/COST_AUDIT_2026-10-18.md`. One session for this job; few, big steps; no agents or
workflows; never read a board into the chat (`week_board.py --previous` reads the saved copy); Sonnet unless the
step is writing or judgment. Stop and tell Krish before anything paid costs more than you said, with the estimate
taken from `meter_daily`.

**1. The tab (code, in `scripts/post-pack/week_board.py` and `week_board/`).** A fourth tab before Mon, Wed and Fri,
named Ideas. For each publishing day (Monday follow.the.money, Wednesday under.the.hood, Friday mind.the.gap): three
or four candidate ideas, each with a one-line hook, the basic narrative in four or five beats (what is happening,
why it matters, what it means for the reader, the call), the sources it comes from with links, and why it fits that
series' mandate (read live from `venture_formats.mandate`, never copied). Krish picks one per day with a tick, edits
the narrative in place and comments, through the board's existing review card (`--review`), edits store and
comments (every Save is also posted as a comment, so both accounts read it). His pick is recorded through
`/api/week/options`, so Control Center's week page shows it. Add self-test checks, keep the publish manifest's
capabilities, and update the docs that describe it: the `plan-week` skill (both copies, then
`python scripts/validate-skills.py --sync-claude`) and `README.md` for the board.

**2. Where ideas come from (read only; nothing new is scraped without Krish's yes).** Use what the engine already
collects, each through its own route or table:

- **Krish's own words:** ideas he said (content ideas with `source_type` `manual` and their `said:` refs) and
  `said-` board items (`GET /api/workbench`).
- **The inspiration folders:** the Drive inspiration scan (`/api/inspiration/drive-scan`, its seeds), the Video
  Engine Inspiration folder and the style references (`config/style-references.json`, `references.py fetch`).
- **People he follows:** `content_creators` (the writers he rates and the move he rates each for), their recent
  posts (`/api/discover-creator-posts`), and the lens radar's candidates (`lens_seed_candidates`,
  `/api/discover-lens-radar`).
- **What is happening out there:** the editorial radar (`/api/content-opportunities/refresh` results),
  `trend_observations` and `/api/trends/*`, and the AI-visibility results (AEO packets, `aeo_signal` ideas).
- **What worked:** last weeks' numbers from Control Center's growth view and the learnings register
  (`config/learnings.json`), so ideas lean on what brought subscribers.

Check each route exists and what it returns before relying on it; list in the session's report any that is empty,
stale or failing, and any source Krish named that has no route yet (for example a person he follows who is not in
`content_creators`). Ask him before adding a new source or anything that spends.

**3. Ideas are checked before they reach him.** Each idea is new to the publication (not a repeat of the last eight
weeks), fits its day's mandate, has at least one primary source, and makes a call that can be checked on a date
(house rule SHARP_PREDICTION). Titles stay out: titles are signed off after he records.

**4. Build and publish.** Make next week's board (the Monday after today) with the Ideas tab first, verify it
(`week_board.py --verify`), and publish the same built file to every link in `config/boards.json` under that week,
adding the new week's links there. Read the comments on every board link first. Before stopping: commit
everything, send any media to the library, update `WORKBENCH.md` ("This week's publish board"), and give Krish the
links.
