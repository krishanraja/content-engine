# The intro sting

Reference for the `produce-video` skill, read at the step that names it (`.agents/skills/produce-video/SKILL.md`). Moved out of the core unchanged on 18 October 2026 so a session starts lean (docs/COST_GUARDS.md).

Krish, 2026-10-12: "I also want the video to have a 1-2 sec animated make
your mind up intro visual before my face comes in" (house rule
INTRO_STING). It is a 1.5 second clip per shape (1 to 2 allowed) with a
silent track, in the colour of the piece's series, joined in front of the
captioned video, so no word, caption or graphic moves; the music is high
over it.

- **No design is approved.** On 2026-10-12 Krish turned down the first one
  he was shown: "it's ok, it's a bit boring and colourless and vanilla - and
  just what Powerpoint would do in 2008" (`config/intro-sting.json`,
  `last_decision`). Every cut goes without a sting until he approves
  another; never hold a render for it.
- Its design is two Remotion compositions in `apps/renderer`, named in
  `config/intro-sting.json`, each taking the series as a prop. make.py uses
  the sting only when that file's `status` is `approved`, with the source
  hash of the previews he saw. `python scripts/quick-edit/intro.py status`
  says where it stands (and if the compositions are not in the renderer
  yet, the design is still being built: carry on without it).
- To approve one: `intro.py render --preview` (every shape and series),
  show Krish, and only on his words `intro.py approve --words "his exact
  words"`. Commit and push, then `intro.py render` on each machine that
  renders. A sting changed after approval is not used until he approves it
  again.
- A clip named in a cut's config (`"intro": {"9x16": file, ...}`) is used
  only when it is the approved render for that shape and series, or when
  the config carries Krish's own words in `"intro_override"`. Its own sound
  is never used.
