# The opening

Reference for the `produce-video` skill, read at the step that names it (`.agents/skills/produce-video/SKILL.md`). Moved out of the core on 18 October 2026 so a session starts lean (docs/COST_GUARDS.md); rewritten on 29 October 2026, when the hook became the intro, and again on 12 November 2026, when nothing before the hook became the rule for good.

Ruling (Krish, 2026-11-12), answering the openings question: "Nothing before
the hook, ever. Remove the sting exception for good." (house rule
HOOK_IS_THE_INTRO).

- **Every cut opens on its hook.** The 16:9 long cut and the 9:16 short cut,
  of a weekly series piece or an off-day piece: the first frame is the hook.
  The long cut opens on his face and the hook in the wide cut's branded frame;
  the tall cut opens on his hook with no wordmark, mark tile or series tag over
  its animated content (the closing outro card keeps the wordmark; Krish,
  2026-11-11).
- **Nothing goes in front of it.** No sting, no logo animation, no story card,
  no episode card, no title card and no second intro, on any cut, and no
  words for one piece let one in. make.py leaves out a clip a config names in
  `"intro"`, honours `"intro_override"` no more, and its report says so;
  `sting_stop` refuses a cut handed an intro anyway. ve lint refuses a spec
  naming a sting (`brand.intro_sting` other than its no-sting sentence) or an
  episode card (`brand.opening_exception`), ve compile lays neither, and ve
  render and ve qc refuse props or a file that carry one.
- **The house intro sting is retired for good.** `config/intro-sting.json` says
  `retired`, with his words; `scripts/quick-edit/intro.py` gives no cut a
  sting, refuses any other status on that file and refuses every approval. Its
  clips stay in the brand kit for the record only. Its history: it first ran
  from 2026-10-12 (house rule INTRO_STING) with no design approved; on
  2026-10-12 he turned the first direction down ("it's ok, it's a bit boring
  and colourless and vanilla - and just what Powerpoint would do in 2008");
  his pick of "The hook is the intro" retired it on 2026-10-29; on 2026-11-05
  it came back in front of the wide cut of a series piece ("I think it should
  go at the start of the longer wide videos 100%,"); it was paused on
  2026-11-12 and retired the same day.
- **One opening and one close.** The close is one calm outro card, held long
  enough to read (house rule STORY_INTRO_OUTRO; the story outro). Krish,
  2026-10-21: "why are there two separate intro sequences? that should NEVER
  happen."; 2026-10-28: "we also don't need three separate outro transitions
  and screens. Ever." The animated story card in front of each cut (the intro
  half of STORY_INTRO_OUTRO) stays retired, in `config/story-intro-outro.json`.
- **Recorded on every cut.** Each report says what the cut opened on
  (`opening`): `{"kind": "hook", "rule": "HOOK_IS_THE_INTRO"}`, always.
- **The music under the opening.** The bed opens loud for the first moments
  and eases under his voice (the one bed shape, `config/music-bed.json`); with
  nothing in front of the hook, that loud open sits under his first words at
  the level house rule MUSIC_BED sets.
- **No name.** No cut carries his name, on screen or in a caption (Krish,
  2026-10-28: "Remember, no content refers to Krish, ever. I still see that
  popping up from time to time. Even articles written are not authored by
  Krish. My face only, for assets and the video format."). The name strap is
  retired: kit.py no longer draws one, and make.py stops on a config that
  carries a `"strap"`.
