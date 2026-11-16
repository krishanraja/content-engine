# What the audience showed, 16 Nov: the six rules every piece carries

Growth's audience brief of 16 Nov 2026 (Control Center material cbb90470; growth-makeyourmindup
`docs/briefs/2026-11-16-content-engine-what-the-audience-tells-us.md`): six weeks of Buffer, TikTok Promote, YouTube
Studio, Meta and Substack numbers, observed evidence and never proof that one choice caused one outcome. Ruling (Krish,
2026-11-16): "apply 1 to 6 from the next piece you make this week". Each rule is in `apps/control-plane/api/_houseRules.ts`
and in `config/learnings.json` (ids `audience-*`). Read this before the scripts, again before the article, and again
before the pack.

## The scripts (Scripts step, 1c)

- **One named, concrete thing first** (house rule ONE_CONCRETE_THING). Every cut's first sentence names the piece's one
  thing: a product, a deal, a number or a person. Then follow the money or the surprise. An abstract framing ("every AI
  has two passports") may be the angle, never the opening. `story_check.py --cut` refuses a first sentence that names
  none. Instagram held people longest on named things (Higgsfield 44.6 s, Disney and Character.AI 39.7 s) and least on
  the abstract one (17.5 s, no share).
- **Who it is for, by the second sentence** (FOR_THE_LEADER). Say what this changes for a business, in a leader's
  terms: budget, team, customers, suppliers, contracts, prices or margin. A pop-culture hook is welcome when the next
  line turns it into their business. `story_check.py` warns when the first two sentences name no stake.
- **The short cut is one idea, 20 to 35 seconds** (TWO_CUTS, SHORT_CUT): 45 to 75 script words. The hook, the one idea,
  the call, then the last line ("The full story is free at makeyourmindup.ai."); his beat of what he would do is one
  sentence at most, or left out. A second idea goes to the long cut or the article. `story_check.py --cut short`
  refuses a short outside the band or not ending on the last line. The file keeps its old name, `-90s.md`.
- **One more fresh reader** after each read-back of each cut (a fourth subagent, "Separate reader: read-back D"),
  given only the script's words and this prompt, word for word:

  ```
  After the first two sentences of this script, who is it for and what does it change for their business? Answer in one sentence, or say "I can't tell".
  ```

  An "I can't tell" is a rewrite of the opening, then a new read-back.

## The storyboard and the cut

- **A vertical wins its first two seconds** (FIRST_TWO_SECONDS). The short's first frame shows the named thing, and its
  first visual event lands by the hook's second word, so words are on screen inside the first second. Nothing goes
  before the hook (HOOK_IS_THE_INTRO). `ve lint` refuses a 9:16 cut published from 16 Nov whose first event lands later
  (`story.hook_event`) or that runs past 35 seconds (`dialogue.short_max`). The promoted TikTok of "The UK number two"
  kept 35.7 in 100 viewers past 2 seconds and 0.6 to the end.

## The article (Fact-checked draft step)

- **Two subscribe asks inside the body** (ARTICLE_SUBSCRIBE_ASK): one plain paragraph before the first heading, for a
  reader who is not yet a subscriber, and one right after the three actions of "3 things you can do tomorrow", as the
  last paragraph of that section. Each says what the reader gets and links the subscribe page in
  `vendor/makeyourmindup/subscribe-route.json` (`https://home.makeyourmindup.ai/subscribe`), for example: "Three pieces
  a week on what AI changes in your business, each ending on a dated call. Subscribe free." Never promise a public
  scorecard of every call until makeyourmindup.ai shows a live one: today it shows an example board. The publish check
  ARTICLE_SUBSCRIBE_ASK reads both (not blocking until Krish has seen pieces carry it).
- **The subtitle says the stake** (FOR_THE_LEADER): what the piece changes for a business.

## The written edition (after the fact gate, before the pack)

House rule WRITTEN_EDITION. Video cross-posted to Threads, X and Facebook reached a median of 5 to 11 people; the one
written Note reached 208 against a Notes median of 4 and brought the only subscriber of the run.

1. Write `docs/plans/<plan>/written-edition.md` with two sections: `## Post`, three to six short lines for X and
   Threads, at most 280 characters in all; and `## Note`, a written opinion of 60 to 180 words for Substack Notes, in
   his first person.
2. Each opens on the piece's one named thing and says what it changes for a business by its second line; each stands
   alone without the video; each carries only facts the article's fact gate passed; neither holds a link or a hashtag
   (Growth adds its tagged link).
3. `python3 scripts/post-pack/written_edition_check.py docs/plans/<plan>/written-edition.md` passes.
4. File it on the piece: `add_piece_material`, kind `output`, title "Written edition: post and Note". Growth makes the
   posts from it (adapts, tags, schedules and posts) and writes the Notes for the other days; content-engine never
   posts (docs/GROWTH-HANDOFF.md).
