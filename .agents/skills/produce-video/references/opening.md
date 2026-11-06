# The opening

Reference for the `produce-video` skill, read at the step that names it (`.agents/skills/produce-video/SKILL.md`). Moved out of the core on 18 October 2026 so a session starts lean (docs/COST_GUARDS.md); rewritten on 29 October 2026, when the hook became the intro; changed on 5 November 2026, when the intro sting came back in front of the wide cut.

Krish, 2026-11-05, of the makeyourmindup intro sting (the Intro Sting page, the
second direction he saw on 12 October): "I think it should go at the start of
the longer wide videos 100%,". Asked whether each series' clip may keep
flashing the other series' colours on its way to its own, he picked "Keep it as
I saw it". Before that, 2026-10-29, picking option one, "The hook is the
intro", for the one opening every video has: "I'd pick number one here but I
think that we need to test and learn. We need to figure out what the right tone
is over time based on real engagement. Let's go with number one for now."
(house rule HOOK_IS_THE_INTRO).

- **What the wide cut opens on.** The 16:9 long cut of a weekly series piece
  opens on that series' house sting: the clip he saw, byte for byte
  (`config/intro-sting.json` names each clip by its library path and sha256,
  under "1 Brand kit (permanent)/Intro sting"), 56 frames at 30 fps, about
  1.9 seconds (45 frames at 24 fps, when the cut runs at the take's rate),
  with the full MAKE YOUR MIND/UP wordmark plate near its end. It has no sound of its own:
  make.py lays silence under it and the music bed over it, at its loud open.
  His face and the hook come in on the very next frame, in the wide cut's
  existing branded frame for now (not yet put to Krish: the wide cut either
  keeps that frame, with the series pill on each panel, or gets a corner
  dress like the tall one; he chooses from a still of each). Each series'
  clip flashes the other series' colours on its way to its own: the one
  written exception to the series-colour rule. make.py fetches a clip that is
  not on the machine from the library, checked by size and sha256
  (`python scripts/quick-edit/intro.py fetch` does it by hand).
- **What the tall cut opens on.** His hook, straight away, in the brand's
  dress from the first frame: the brand's wordmark in the top left corner and
  the series tag in the top right, as the Friday 23 October tall cut has them
  (kit.py draws `dress-9x16.png`; make.py lays it over the whole main, over
  the pictures and under the captions). No sting.
- **An off-day piece** (one with no weekly series, or dated on a day that
  is not its series' own day) wears no sting, and never another series' colour, so
  both its cuts open on the hook.
- **Nothing else goes in front of the hook:** no story card, no title card
  and no second intro, in either cut.
- **One opening and one close.** The close is one calm outro card, held long
  enough to read (house rule STORY_INTRO_OUTRO; the story outro). Krish,
  2026-10-21: "why are there two separate intro sequences? that should NEVER
  happen."; 2026-10-28: "we also don't need three separate outro transitions
  and screens. Ever."
  The sting followed straight by his face is one opening; a story card or a
  title card between them would be two.
- **Recorded on every cut.** Each report says what the cut opened on
  (`opening`): `{"kind": "sting", "rule": "HOOK_IS_THE_INTRO", "series": ...,
  "clip_sha256": ...}` on a wide cut with its sting, `{"kind": "hook", "rule":
  "HOOK_IS_THE_INTRO"}` on the tall cut, and the same with a `why` on a wide
  cut that opened on its hook. So real engagement can settle the choice, and
  the openings stay his choice to test. Another opening is tried only on
  Krish's own words for that piece: a clip named in the config's `"intro"`
  with his words in `"intro_override"`, which the report records as
  `{"kind": "clip", ...}` and quotes. Never write those words for him, and
  never copy an old approval into a new piece's config.
- **Waiting on his approval.** While `config/intro-sting.json` says
  `candidate`, make.py renders the wide cut on its hook and its report says
  why. `python scripts/quick-edit/intro.py approve --words "..."` records his
  approval in his own words, bound to the clips' sha256 (`source_sha256`);
  never write those words for him. Once it is recorded, a wide cut of a
  series piece that cannot have its sting (a clip missing from the library,
  or not the one he approved) stops before it renders, and only his own words
  for that piece in `"intro_override"` let it through.
- **What came before.** The sting first ran from 2026-10-12 (house rule
  INTRO_STING) with no design approved: on 2026-10-12 he turned the first
  direction down ("it's ok, it's a bit boring and colourless and vanilla - and
  just what Powerpoint would do in 2008"), and on 2026-10-29 his pick of "The
  hook is the intro" retired it, so no cut opened on a sting from 29 October
  to 5 November. The animated story card in front of each cut (the intro half
  of STORY_INTRO_OUTRO) stays retired, in `config/story-intro-outro.json`.
- **No name.** No cut carries his name, on screen or in a caption (Krish,
  2026-10-28: "Remember, no content refers to Krish, ever. I still see that
  popping up from time to time. Even articles written are not authored by
  Krish. My face only, for assets and the video format."). The name strap is
  retired: kit.py no longer draws one, and make.py stops on a config that
  carries a `"strap"`.
