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
- **The short cut is one story, 60 to 90 seconds** (TWO_CUTS, SHORT_CUT, ONE_STORY_SHORT): 160 to 210 script words,
  about the length of his AI music short, a little less (Ruling, Krish, 2026-11-17: "75 word script is insanely short.
  the AI music short is about the right amount of words, maybe just less"). The hook, the one story told with room to
  be fun, the answer, then the last line ("The full story is free at makeyourmindup.ai."). A second story or example
  goes to the long cut or the article; the long cut may bring other examples in when each is coherently explained as
  further evidence or a counterpoint ("the one story rule is only really for the 90 second video"). Both cuts are
  always fun to make and to watch. `story_check.py --cut short`
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
  a week on what AI changes in your business. Subscribe free." Never promise predictions, calls, odds or a scorecard:
  no piece makes one (Ruling, Krish, 2026-11-24: the signature format is the 5 Whys; get rid of everything that
  suggests predictions, calls, dated, odds or scores), and makeyourmindup.ai shows only an example board. The publish check
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
   (the captions step adds its tagged link).
3. `python3 scripts/post-pack/written_edition_check.py docs/plans/<plan>/written-edition.md` passes.
4. File it on the piece: `add_piece_material`, kind `output`, title "Written edition: post and Note". content-engine
   writes each channel's final words into the manifest (`scripts/post-pack/channel_captions.py`) and makes the Notes
   for the other days, the Saturday Note included (`scripts/post-pack/saturday_note.py`); Growth schedules and posts
   them, and content-engine never posts (Ruling, Krish, 2026-11-26; docs/GROWTH-HANDOFF.md). How the captions, the
   judges, the Library's pictures and the Saturday Note are made: "Assets, captions and judges", below.

## Assets, captions and judges: content-engine makes it, Growth posts it (26 Nov)

Ruling (Krish, 2026-11-26): "I believe that growth should move all asset production to Content Engine. I see no point in
having a separate repository produce specific assets." Then: "I want everything to be one harmonious engine."
content-engine makes every asset (hero pieces, carousels, memes, Notes images and words, captions and titles per
channel, covers, thumbnails, cuts, the weekly edition package) and hands Growth finished, approved assets with their
captions in the piece manifest. growth-makeyourmindup posts, schedules in Buffer, places the edition in Substack,
distributes, runs the subscribe route, measures and reports performance back. It makes nothing.

### The pictures: the v5 Library only

The Library is locked (26 Nov 2026; Krish: "I approve the new cover thumbnail systems, go"). Its templates are the only
artwork: fill the slots, never move the frame, no per-piece look, no second renderer.

- Covers and thumbnails: `python scripts/covers/make_covers.py <piece> --out <folder>` (writes `covers.json`, which
  post-pack reads as `cover_set`). make_piece.py's old cover and video sets are retired.
- Carousels: only through `python3 scripts/carousel_make.py <piece> --set <set> --deck DECK.json --out <folder>`,
  which holds the deck (`carousel-deck/3`) and the drawn slides to the 3-second format, `config/carousel-format.json`,
  as refusals that fail the step (Krish, 26 Nov 2026: "Tell the Content-engine story intelligence for makeyourmindup v5
  session that it is to enforce carousel formatting"), then calls `python scripts/library/make_piece.py <piece> --set
  <set>` (piece, good-news, simple-advice, how-to, explainer, quiz, meme) and `make_covers.py` for slide 1 by path, and
  writes `carousel-receipt.json`. 4 to 7 slides, the piece carousel 6, good news 4 items; the rest is the carousel skill's
  floor. The manifest SPEC carries the passing receipt as `carousel_receipt`: a carousel that fails is not approvable.
- Every asset kind Growth used to make, and the command and set that make it now: `config/asset-routes.json`.
  `python3 scripts/post-pack/asset_routes.py command <kind> --piece <piece> --out <folder>` prints it.
- Not on this checkout (the Library is on main since #984; update the checkout): stop and say "the v5 Library is not on
  this checkout yet". A kind the routes list as a gap (a single meme image, a tall meme with its clip, a Notes image,
  a cover built into a cut) is not made another way: say so.
- Imagery order: a licensed Commons photo of a named person in their own story (never beside an accusation against
  their company), then the real object, company or venue, then a photoreal still of the specific thing built by Codex
  (no generated people, no readable logos or text). No badges anywhere; sources as plain links, credits as quiet captions.

### The judges: asked by the make flow

`python3 scripts/post-pack/judge_assets.py ask REQUEST.json --week <Monday>` sends `op: judge` for a carousel or a
Short before it goes to Growth: every card's bytes and sha256, and a carousel's `carousel_check.py --cards --deck DECK.json`
receipt.
Exit 0 every judge passes; 1 fail (each judge's fix printed); 2 not asked, which holds and is never a pass. Growth keeps
`op: bind` and `op: live`.

### The captions: written at make time

Krish retired his 19 Nov ruling ("Caption always gets generated by the growth repository"). For each piece:

1. `python3 scripts/post-pack/channel_captions.py brief facts.json --out DIR` writes the writer's brief (the reader, the
   account voice per channel, the claim word for word, the word limits, the YouTube title).
2. The session writes `answer.json` (`{"<channel>": {"words", "title"}}`); `check` runs the claim, length, copy lint,
   its own rules (no hashtag, link, mention, em dash, exclamation mark, brand name, dated call or share ask) and Control
   Center's voice check. One rewrite with the reasons.
3. `review-brief` writes the blind reader's brief: each post's channel, format, blind file names and exact words, and
   nothing else. A separate reviewer who has seen nothing else answers `review.json`.
4. `record facts.json answer.json review.json --spec spec.json` writes each channel's final words (with its subscribe
   line) and the YouTube title into the manifest SPEC and a `captions.json` receipt. A title makes the manifest
   `content-engine-piece-manifest/1.1`.

### The Saturday Note

Each Saturday one Note points at the weekly edition: `python3 scripts/post-pack/saturday_note.py brief`, then `make
--saturday <date> --words words.txt --edition edition.draft.json --out <folder>`. It carries two links, "Read the week:"
(the edition link, place note) and "Subscribe:" (the channel's own link), or Growth's subscribe gate refuses it. It is
filed beside the edition's draft; Growth only schedules it in Buffer.
