# The opening

Reference for the `produce-video` skill, read at the step that names it (`.agents/skills/produce-video/SKILL.md`). Moved out of the core on 18 October 2026 so a session starts lean (docs/COST_GUARDS.md); rewritten on 29 October 2026, when the hook became the intro.

Krish, 2026-10-29, picking option one, "The hook is the intro", for the one
opening every video has: "I'd pick number one here but I think that we need
to test and learn. We need to figure out what the right tone is over time
based on real engagement. Let's go with number one for now." (house rule
HOOK_IS_THE_INTRO).

- **What every cut opens on.** His hook, straight away, in the brand's dress
  from the first frame: in the tall cut the brand's wordmark in the top left
  corner and the series tag in the top right, as the Friday 23 October tall
  cut has them (kit.py draws `dress-9x16.png`; make.py lays it over the whole
  main, over the pictures and under the captions); in the wide cut the
  branded frame beside him. Nothing goes in front of the hook: no story card
  and no logo intro.
- **One opening and one close.** The close is one calm outro card, held long
  enough to read (house rule STORY_INTRO_OUTRO; the story outro). Krish,
  2026-10-21: "why are there two separate intro sequences? that should NEVER
  happen."; 2026-10-28: "we also don't need three separate outro transitions
  and screens. Ever."
- **A choice to test, recorded on every cut.** It refuses nothing. Each
  report says what the cut opened on (`opening`: `{"kind": "hook", "rule":
  "HOOK_IS_THE_INTRO"}`), so real engagement can settle it. Another opening
  is tried only on Krish's own words for that piece: a clip named in the
  config's `"intro"` with his words in `"intro_override"`, which the report
  records as `{"kind": "clip", ...}` and quotes. Never write those words for
  him, and never copy an old approval into a new piece's config.
- **What it replaced.** The 1 to 2 second animated sting before his face
  (house rule INTRO_STING, 2026-10-12): no design was ever approved (on
  2026-10-12 he turned the first one down: "it's ok, it's a bit boring and
  colourless and vanilla - and just what Powerpoint would do in 2008"), and
  `config/intro-sting.json` now says `retired`, with his words. And the
  animated story card in front of each cut (the intro half of
  STORY_INTRO_OUTRO), retired in `config/story-intro-outro.json`. The sting's
  machinery stays in `scripts/quick-edit/intro.py`, so the choice is easy to
  change if engagement says so; while the config says `retired`, `intro.py
  render` refuses and make.py gets no sting and no note.
- **No name.** No cut carries his name, on screen or in a caption (Krish,
  2026-10-28: "Remember, no content refers to Krish, ever. I still see that
  popping up from time to time. Even articles written are not authored by
  Krish. My face only, for assets and the video format."). The name strap is
  retired: kit.py no longer draws one, and make.py stops on a config that
  carries a `"strap"`.
