# Carousel quality standard

Owner: content-engine. Taste authority: Krish Raja. Updated 5 November 2026; the brand elements rechecked on 12
November 2026.

**The brand palette wins on every brand element** (Krish, 12 Nov 2026: "I approve the brand palette sheet, but only if
it falls in line with the attached."): the cover's logo, the wordmark, the colour of each day and the last card come
from `config/brand-palette.json` (`docs/production/BRAND_PALETTE.md`), and where a section below says otherwise on one
of them, the palette is right and the section is history. A carousel's last card is `house_close_slide`: the piece's
takeaway in one or two lines, then Subscribe free (makeyourmindup.ai) and the wordmark small in the bottom right;
Saturday's good news keeps his fixed good-news close.

Who makes carousels (Ruling, Krish, 28 October 2026: "take over posting as
well as creating new assets like carousels"): Growth-MakeYourMindUp now makes
the derived carousels itself, to this standard, the rejection floor
(`python3 scripts/floor.py --format carousel`) and the copy lint
(`config/copy-lint.json`). Content-engine keeps this standard: a change to it
is made here, never in Growth. Where the route below says content-engine
renders a carousel, read it as the route for whoever makes it.

Status: approved production reference. On 26 October 2026 Krish approved the
complete eight-card Grok Bot vs Muse revision 03 as the production pilot,
answering "yes" to the explicit full-pilot approval question. Its exact
ordered image hashes and review evidence are retained privately. This locks
the earned production principles, not a universal scorecard, eight-card
length or fixed visual template. Publishing approval remains separate.

## Every carousel passes the 10/10 judges (Ruling, Krish, 12 November 2026)

Krish: "Judge them; count passes. Every Growth carousel goes through the same 10/10 judges, and each one that passes and goes live counts." Whoever makes it, a carousel is judged
before it is made for posting: Growth's maker asks `POST /api/board/<Monday>/judge`, the draft judges' panel reads its
exact words with its claim, and only a pass is made, bound to its post and counted on the North Star once it goes live.
A fail comes back with each judge's fix and is never posted. `docs/GROWTH-HANDOFF.md`, "Every carousel and Short
through the 10/10 judges", has the route.

## Approved floor

Every carousel needs an original visual idea that carries the specific
story at phone size. Use real-world texture, objects, scenes, evidence and
commercially observant humour with clear visual hierarchy. A headline on
a coloured square is below the floor. Better typography alone cannot fix
the absence of a visual idea.

The subject must be immediately identifiable. Name the products or people
being compared and use verified identity marks where they help. A cover
must earn the first pause and promise a specific payoff for swiping.

Use the live makeyourmindup brand. The approved Grok Bot versus Muse cover
is a quality reference, not a requirement to reuse cakes, hooks, dark
backgrounds or one layout for every story. Each story needs its own idea.

No footnotes, asterisks, source strips, dates, disclaimers or tiny website
addresses along the bottom of the artwork. Do not shrink caveats into
illegible small print. Put source links and necessary test conditions in the
caption or private evidence record. Never add illustration-generation
boilerplate to public artwork, captions or descriptions (Ruling, Krish,
26 October 2026). Retain illustration provenance privately and use supported
native platform metadata through Growth's publishing route. If a limitation
changes the meaning of a claim, simplify or qualify the main claim in
normal readable language. Preserve any required platform disclosure through
the appropriate publishing flow. A useful, legible swipe instruction or
main final-slide action is content, not a small-print footer.

## Reader comprehension (Ruling, Krish, 26 October 2026)

Assume the reader has never heard of the tools, the publication or the AI
category. The complete sequence must work for an intelligent newcomer of
any age. Supply the context on the artwork, not only in its caption. Say
what each named thing is and why it is here before expecting recognition.
Use plain words and clear relationships without talking down to the reader.

Lead each card with the actual task, question or point the reader needs to
understand. A witty headline or physical metaphor cannot replace that
explanation. State what happened and why it matters in an order that makes
sense. Never require the audience to reconstruct an unstated test, subject,
comparison, chronology or connection. Humour adds bite after clarity.

Use task- and reader-centred language. Do not refer to the creator as I,
me or my in carousel copy. Say "the scorecard", not "my scorecard". Remove
unexplained shorthand, vague verdicts and references whose subject is unclear.

For a scored comparison, explain the scoring and show the running total on
each test card. In the Grok Bot vs Muse pilot a win earns one point and a
draw earns each assistant one point: 1:0, 2:0, 3:1, 4:2, 5:3. This approved
scoring revision must not be described as the original published tally.
Keep intermediate and final totals consistent and readable.

Scorecards are one format, not the universal recipe. A story, explanation,
demonstration or practical guide needs its own appropriate arc. The reusable
rule is a complete thread: orient the newcomer, move one clear step per
card, supply the evidence, then finish with a useful conclusion or action.
The final card must earn its place; do not append a generic promotion where
a concrete instruction is the better payoff.

For the current Grok Bot vs Muse pilot, Krish's next correction is that the
final card must visibly read as the main practical takeaway. It must change
reading mode and hierarchy from the test cards while keeping the exact
instruction. Its cream-ground instruction board was accepted, then the full
sequence approved. That is not a requirement to reuse the treatment for
every ending. Design the ending for its job and preserve visual variety.

Before rendering, read the complete copy without pictures, caption, source
article or prior conversation. Fail it if a newcomer cannot tell what is
being discussed, what each step shows and what to take away. After rendering,
repeat that check at phone size: the pictures must clarify the words, and
the words must make the pictures intelligible. These are production gates,
not proof that an actual novice audience has been tested.

The previous full pilot failed the copy/context gate despite its approved
visual direction. Keep that distinction in the review history. Revision 03
earned full-pilot acceptance after explicit tasks, cumulative scores and a
distinct practical ending corrected those failures. Acceptance proves this
reference met Krish's bar; it does not prove audience or growth performance.

## The ten-second swipe (Ruling, Krish, 13 November 2026)

His words, of the Thursday 12 Nov Git carousel: "Git carousel cards look terrible apart from the cover card and they
also are not very easy to follow. Remember that a complete layperson is swiping through these cards at light speed and
needs to be able to follow the story within 10 seconds. This cannot ever happen again in any future carousel."

- The headlines alone, read in order, tell the whole story in ten seconds: at most 45 words across the deck, 3 to 12 on
  any one card. Everything else on a card only adds to its headline.
- Every headline after the cover is one whole sentence ending in a full stop, saying what happened or why it matters.
  A label ("Code changes Anthropic merged per day"), a bare number ("7 engineers, 5 months") or a list of names is not
  a headline.
- Every card after the cover shows its point as a picture: bars to scale, the thing jammed, the people, the hand-off.
  Words alone, a number alone or a list of logos in boxes is not a card.
- The line under a headline is at most 20 words.
- No jargon a layperson does not know (`config/carousel-plain-words.json`) unless the deck explains it in plain words
  where it first appears.
- Before the cards are drawn, two fresh readers see only the headlines, in order, once, and retell the story in their
  own words; every place they got stuck is fixed first.
- The deck's words live in a `carousel-deck/1` file, and `python3 scripts/carousel_check.py DECK.json` passes before any
  card is drawn or filed (`tests/carousel_check_test.py`: the Git deck as sent on 12 Nov fails, the redrawn one passes).
  Growth runs it on every carousel it makes to this standard.

## Narrative production and review

Use content-engine production and editorial guidance, its live mandate,
docs/CAROUSEL_ENGINE_STATE.md and docs/STYLE_REFERENCES.md. Growth supplies
the distribution brief and may cite its channel playbook and research corpus
as inputs; those are not competing production standards.
Study the actual inspiration workbook and creator visuals when the task
needs them. Source observations are craft inputs, not blanket taste
approval or proof of current platform performance.

Write a storyboard before rendering. Give each swipe a distinct job:
establish the stakes, reveal evidence, change the reader's understanding,
resolve the comparison and leave one useful next step. Pay off the cover
early. Do not spread a paragraph over cards or withhold the answer to
manufacture completion. One focal idea per slide; use deliberate changes
of scale, scene and information density to make the sequence move.

Keep facts, personal judgement and recommendations distinct. A comparison
must use compatible labels and show who did what. A scorecard must agree
with the source and earlier slides. Do not manufacture an interface,
quotation, result or document and pass it off as test evidence.

Inspect the complete rendered sequence, its individual phone-size cards,
the caption and the actual facts before asking Krish to review it. Record
any failure, fix it and recheck the whole arc. His approval covers the
exact reviewed version; publishing remains separately gated.

## Repeatable production route

1. Receive Growth's amplification concept, audience, channel, experiment,
   source piece and desired reader action. Growth owns that initiative.
2. Establish the exact claim/evidence and the newcomer's starting context.
   Write each card's question, answer and role before rendering.
3. Select a story-specific visual idea and arc using the approved principles.
   Keep the metaphor subordinate to explicit meaning and checked facts.
4. Render and inspect the entire sequence at phone size. Verify copy,
   identity marks, claims, score/state progression where relevant, rhythm,
   distinct final payoff and the absence of small-print artwork strips.
5. Secure the required exact-asset creative review, preserve hashes/order,
   and return a checked production package to Growth for platform delivery.
6. Receive specific creative feedback and dated channel evidence. Improve
   production craft here through the existing governed learning route.

Use existing editorial and Studio contracts; do not create a second pipeline
or learning store. The route is documented and the pilot approved; automated
volume throughput, runtime feedback import and audience results are not
proved by this document. Private accepted assets and evidence remain in the
existing review package until imported through the tracked Studio route.

## No card is numbered (Ruling, Krish, 5 November 2026)

His words: "If we can avoid having numbered cards in the top left corner in the future, that would be helpful as well,
because then we can just slice out cards at will a lot more easily without it looking weird. That goes for all
carousels."

- No carousel card carries a card number, a count such as "01 / 05" or a page such as "2 of 4", anywhere on the card.
  Any card can then be removed without the others looking wrong.
- Numbered steps inside a card, such as a card's three click steps, are content, not card numbers, and stay.

## Saturday good-news carousel (Ruling, Krish, 2 November 2026)

His words: "we need 5 stories", then "take the five stories" and "encode that 2nd request as a standard for the Saturday posts".

- Every Saturday good-news carousel carries exactly five stories.
- Each story is about real people who benefited from AI in a way a reader feels at once: a named person or group, what changed for them. His words: "Frontier models lowering prices isn't really fitting with how humans are benefitting from AI". Price cuts, model launches, funding rounds and lab or pharma deals are not stories.
- Each story is checked against its primary source and dated as close to the week as the stories allow. Every card carries its source and its date.

### The good-news close (Ruling, Krish, 5 November 2026)

His words, of the plain close: "The final card is so dull. It needs to be visually uplifting and happy." He set its
message, "If this inspires you to think about how you can make the world better with your ideas and AI, follow for
more", then edited the mockup: "follow more more should be lower case, 'make the world better' should be on one line,
and should be "by combining your ideas + AI". I prefer A. The opening sentence should just be "If this inspires you
to"". He asked for it to be "the final card for all good news carousels permanently".

- The last card of every good-news carousel is the same card. It shows that week's five story photos in mint rings
  on a soft green glow, in story order.
- Under them is one sentence, always these words: "If this inspires you to", then "MAKE THE WORLD BETTER" on one
  Anton line in mint, then "by combining your ideas + AI,".
- The house sign finishes the sentence: "follow for more" in lower case, directly above the centred house mark. This
  is the one card where the sign is lower case.
- Growth's kit `render/pieces/off-sat-goodnews` holds the words in its close template, and a test refuses any other
  close.

## Brand mark on news, roundup and text-led carousels (Ruling, Krish, 3 November 2026)

His words, of the Saturday 7 November good-news carousel: "You've fabricated my brand logo. The brand word mark and
logo don't need to go at the top of this. They need to go in the bottom corner, subtly, on all carousels of this
nature."

- The mark comes only from the house brand files named in `config/studio.json` (`publication.mark`, `publication.logo`,
  `publication.stacked`, sourced from krishanraja/control-center). It is never set as type or redrawn.
- On every carousel of this nature (news, roundup, text-led) it sits small and subtle in a bottom corner, never at
  the top.
- Before delivery, check every slide at full size for both.

## The cover card is a scene, not a slide (Ruling, Krish, 4 November 2026)

Series covers and thumbnails, and points 1, 5 and 6 of card 1 here, follow `docs/production/COVER-STANDARD.md`
(approved by Krish, 2026-11-09: "approve the cover standard as written").

His words, of the Tuesday and Thursday mocks for the week of 9 November: "The first card of each mock should have a much
more engaging background image." Then, of the rebuilt set: "I approve these carousels. They look good. I sign them off
completely for publishing next week" and "make sure all future carousels never need this feedback again".

- Card 1 of every carousel is a full-bleed picture of one funny, specific scene that carries the story's idea at a
  glance (an auction podium for a bankrupt AI app; an exam marked A+ by its own author; a filing cabinet buried under
  printed code). A headline on a plain ground, a logo row or a chart is never the cover.
- A generated cover shows the house robot or no robot at all (Ruling, Krish, 5 November 2026: "Make sure all future
  carousel covers that are generated by Higgsfield either use the branded toy robot or are more creative than just a
  robot doing something."; and "Either we keep to brand and have my brand robot doing these things if you insist on a
  robot every single time, or you're welcome to be more creative in your Higgs field generations too."). The house
  robot is the hand-sewn felt robot of the brand book (`config/brand-robot.json`): pass its two reference photos to the
  model as references so it stays that robot, never a made-up one. Otherwise pick a more creative idea than a robot
  doing something: the object, place or moment the story is about. Run `python3 scripts/post-pack/cover_scene.py check`
  on the generation record before generating; it refuses a prompt that asks for a robot without the house robot's
  photos. The deck's reviewer judges whether a robot-free idea is creative enough. The 9 November covers below came
  before this ruling and are not the model for a robot.
- Real people in a generated picture are recognisable at a glance, or they are left out (Ruling, Krish, 11 November
  2026: "Make that caricature rule stand forever. We can't generate caricatures that people won't recognize clearly.").
  He rejected the 20 November midterms cover, a painted caricature of Trump and the AI lab chiefs, with "These
  caricatures do not look enough like the real people. They need to be somewhat photorealistic.", then "I think you
  need to supply real images of each of these people's faces and make the prompt use them as a reference and not
  deviate from them, but still make them caricatures." So a caricature of a real person is generated only with a real
  photo of each face passed to the model as a reference, and the prompt holds each face to its photo; a loose cartoon
  from a name alone is never used. The reviewer names each person in the picture before it ships, and a face that
  needs its name to be read is refused. The scene stays absurd enough to read as satire, and any platform disclosure for
  generated people goes through the publishing route.
- No card is cryptic (Ruling, Krish, 11 November 2026: "The cards cannot be cryptic at all."). Card 1 says in plain
  words what happened and why it matters for AI, and a story with two sides shows both, simply, before its ending.
- The picture fills the card. Its top half holds the scene and its lower half stays dark and quiet, so the headline,
  the one-line dek (and the series pill, only on a carousel that carries a series piece) sit over it with no box. A
  gradient from clear to the house ink carries the type; nothing is cropped across a face or the scene's subject.
- Generate the scene as a still (no words, letters or logos in the picture; a single prop word such as "A+" is fine)
  in the house tones: ink shadows and house light. Only a carousel that carries a series piece takes that piece's
  colour as the light (below). A real photo is used instead only when its rights are clear. Record the generation's
  job id, model, prompt and reference photos beside the deck (the record `cover_scene.py` checks).
- Cards 2 onwards stay the house look: ink ground, Anton headlines, Archivo body, Plex Mono labels, real logos from
  Brandfetch, the house mark small in the bottom corner. A logo that is dark on the dark ground is shown in white
  (monochrome) or on a light tile; never invisible.
- Before showing him a deck, look at card 1 at phone size beside the last approved covers (the week of 9 November's
  three, in `docs/plans/2026-11-09-week/offday-carousels.md`). If it would not stop a thumb, it is not ready.

## Series colours belong to the weekly piece, never to the day (Ruling, Krish, 4 November 2026)

His words: "Post random memes on a Monday but that doesn't mean it's Monday's colour and brand. Then follow the money.
There is only one "follow the money" piece, one "mind the gap" piece, and one "mind the gap" piece every week. Other
stuff can be fluid, maybe changeable." and "I should be allowed to post random stuff on any day but it doesn't take on
the brand colours of Follow the Money, Mind the Gap, or Under the Hood. Which are only once a week, omni-channel, and a
completely different distribution format". This replaces his first ask the same day ("lightly colour-code the
thumbnail and cover asset templates for Monday, Wednesday, and Friday"), which had keyed the colour to the day.

| What | Look |
|---|---|
| The week's one follow.the.money (Monday), under.the.hood (Wednesday) and mind.the.gap (Friday) piece: its article, both cuts, its thumbnails and covers | Its own subchannel's colour and name (`config/studio.json`: follow.the.money `#FFD84D`, under.the.hood `#B7A6FF`, mind.the.gap `#FF6A4D`), never another's. |
| An asset made from that piece whose record says it `carries` the piece (Krish, 4 November 2026: "the character.ai carousel is going to be under Monday's "Follow the Money" banner") | The piece's colour and name, on whatever day it goes out. |
| Everything else, on any day: memes, off-day carousels and shorts, Notes, random posts, and Growth's derived posts that do not carry the piece | No subchannel colour (no yellow `#FFD84D`, lilac `#B7A6FF` or coral `#FF6A4D`) and no subchannel name or pill, anywhere. Otherwise fluid: its own style, the house tones and mint allowed. |

- The series pieces are skinned more heavily and artistically in their colour than anything else, and bring the fun
  back while keeping the Receipt's classy layout. His words: "Monday, Wednesday, and Friday are supposed to be slightly
  more heavily and artistically skinned than that in their colours. We've lost some sense of fun that we used to have
  in our branding. I like the new classy look but I miss the fun."
- There are nine skins, one per week in rotation (Krish, 5 November 2026, of the finished skins: "keep all of them and
  rotate them all at will over the coming weeks"; asked how, he chose one skin per week, moving on by itself). In
  order: neon, sunburst, painted scene, series worlds, Bauhaus blocks, paper cut-out, extruded, brand book and
  Memphis, starting with neon in the week of Monday 9 November 2026, then round again. The week's Monday, Wednesday
  and Friday pieces all wear that week's skin, each in its own series colour. A piece can wear a different one by
  naming it with `"skin"` in the cover facts (`"skin": "memphis"`; the ids are in `scripts/pages/skins/__init__.py`).
  A series piece dated before the week of 9 November wears none unless it names one (whether those weeks wear a skin
  is his call), and a series piece with no date is refused: its week, and so its skin, is told from its date alone.
- Every skin keeps clear of the logo plate as it keeps clear of the words: on the tall thumbnail the plate sits under
  the proof on the column's left edge, so neon's tube stops short of it (its drawing runs on down the ground right of
  it), extruded's toy stands beside it on the same
  floor (or over it, or is left out when there is no room), Bauhaus blocks turns the band under the proof round (its
  quarter disc from the bottom-right corner), and brand book's block steps down beside it. On the wide thumbnail the
  plates sit over the headline and push it down; a low headline leaves Bauhaus blocks no room for its figure and
  extruded none for its toy, and they then show their ground alone (measured on 5 November with the 2 November logo
  rows: both lose their device on all three days' wide thumbnails). A skin
  that still touches the words or the logos, or cannot place its drawing, on any one of the piece's shapes moves the
  whole piece on to the next skin in the rotation, wrapping round, until one draws on every shape, so all its shapes
  wear the same one; the drawer prints which and why and the records say so ("neon could not be drawn on the square
  cover without touching the logos; wore sunburst, next in the rotation"). A skin a piece names is tried first and
  moves on the same way. When none of the nine draws, the piece wears the plain series Receipt and says so. It never
  stops for a skin (Krish, 5 November 2026, asked what happens then: "Yeah just move on automatically").
- The skins are drawn on every shape a series piece is drawn in, so it looks the same everywhere (Krish, 5 November
  2026: "Skin the covers too"): the two video thumbnails (tall 1080 x 1920 and wide 1280 x 720), the shapes they were
  made on, and the five covers, each in the closer one's design: the 3:2 cover, Substack's 1200 x 630 and the 1200 x
  675 share card in the wide's, the square and the vertical cover in the tall's. On the side covers the words run down
  to the foot, so a skin's drawing lives left of them and under the proof. Where a cover leaves the device no room, the
  skin shows its ground, colours and blocks alone, as on a low-headline thumbnail, never a device shrunk to a speck:
  measured on 5 November, on 1200 x 630 and 1200 x 675 (and on the 3:2 cover when logo rows push the headline low)
  Bauhaus blocks' figure, series worlds' world, extruded's toy, paper cut-out's object and Memphis' signature; on the
  square Bauhaus blocks' figure, extruded's toy, paper cut-out's object and Memphis' signature (its band would push a
  long headline's proof under its floor); on the vertical cover extruded's toy and,
  with no logo rows, paper cut-out's object. Neon, sunburst, painted scene and brand book keep theirs on every shape.
- The fun is colour and light, never jokey copy: no stickers, badges or slogans on a cover. His words of the first
  concepts: "Stuff can't just randomly overlap on titles like that and I think these "screwdriver included" and
  "bring a calculator included" badges are really obnoxious."
- Nothing sits on the words. No decoration may touch a headline, the tag, the pill, the wordmark or the logos.
- Content-engine's covers and thumbnails follow this in code: `scripts/pages/brand.py` `series_look`, the Receipt's fit
  (`receipt.py`, refusing any `.deco` that touches the words), the skins and their rotation (`scripts/pages/skins/`,
  each drawing checked again after the skin places its decorations: nothing on the words or the logos, no words in a
  decoration, everything inside the safe box and the proof at its floor; `receipt.settle` moving a piece on), the
  visual gate (from the week of 9 November a series piece's covers and thumbnails must wear a skin, one skin across
  them, telling a record drawn before the skins from its piece; a skin moved on to, or the plain series Receipt after
  all nine were tried, passes; nothing else may), `tests/series_colour_test.py`, `tests/receipt_overlap_test.py` and
  `tests/series_skins_test.py` (all nine skins drawn on Monday, Wednesday and Friday on all seven shapes, alone, with
  logo rows and a strip, and under a long title, and a skin forced to fail moving the piece on). Growth holds its kit
  to the same rule (its R125).

## The Tuesday meme (Ruling, Krish, 4 November 2026)

His words: "the Saturday carousel and the Tuesday meme are likely to follow their own random visual style ... The
Tuesday meme is likely to be more random but needs to be lightly subtly skinned in the bottom right corner."

- The meme's look is free. It wears no subchannel colour or name (above).
- The house mark sits small and subtle in the bottom-right corner, inside the platform's safe margin, taken only from
  the house brand files (`publication.mark` in `config/studio.json`), never set as type or redrawn. Nothing else
  brands it: no masthead, no series label, no URL footer.

## The Saturday carousel (Ruling, Krish, 4 November 2026)

His words: "Saturday's carousel should have the standards of the first one that's coming up this Saturday." The first
is the good-news carousel for Saturday 7 November 2026 (`docs/plans/2026-11-02-week/sat-revised.md`; Growth's kit
`render/pieces/off-sat-goodnews/`).

- Its style is its own: a photo-led cover, one card per story, a closing card.
- It carries exactly five stories about real people who benefited from AI, each checked against its primary source
  and dated, each with its own real photo or clip (the good-news rules above and `week_plan.py` `STORY_COUNT`).
- The house mark sits small and subtle in a bottom corner of every card (the brand-mark rule above).
- It wears no subchannel colour or name.

## At most ten cards (Ruling, Krish, 5 November 2026)

His words: "There's an interesting quirk in Buffer: carousels can only have 10 cards maximum. Can you ensure all future
carousels do not exceed 10 cards in total, including cover and call to action?"

- Every carousel is ten cards or fewer, counting the cover and the last card. A format that wants more items (ten
  tips, say) puts two on a card or drops to the strongest eight; it never runs past ten.
- The checks hold it: the carousel story schema (`packages/contracts/src/carousel.ts`, at most ten slides), the board
  (`week_plan.py` `OFF_CARDS` and `OFF_SLIDES`, at most ten) and Growth's carousel format (`social/formats/carousel.json`
  `max_assets`, which its packaging and release checks read before anything reaches Buffer).

## Seeing a finished carousel (Ruling, Krish, 3 November 2026)

His words: "I should be able to see the assets directly in the publish board or have a link to the Google Drive where
the assets are. I shouldn't have to download a fucking zip and then look at it that way."

A finished carousel goes back to the board with every slide as its own image (`slides`), its Drive folder (`drive`)
and the zip only as a secondary download (`download`), in the off-day option `week_plan.py` reads
(docs/PUBLISH_BOARDS.md). A finished video goes back as `video` with its `drive`. The board refuses slides or a video
without the Drive folder.

## Where off-day assets are filed (Ruling, Krish, 3 November 2026)

His words: "Ultimately, the entire week's schedule should just be in one Posts folder, well named. We don't need to
pretend that this is two different engines. We already have Monday, Wednesday, and Friday going into the posts folder.
From now on, we should just have Tuesday, Thursday, and Saturday also going into the posts folder with a similar naming
convention and contents."

- Every finished off-day asset goes into the library's `3 Posts` with `scripts/post-pack/send.py`, in a folder named
  like the series days: `YYYY-MM-DD Tue off.day - Subject` (Thu, Sat likewise), with the same sections (`3 Video` for
  a cut, `4 Social` for carousel cards and the post description).
- The board's `drive` link for an off-day option is that `3 Posts` folder, never a separate Growth folder.

## AI-tips carousel (Ruling, Krish, 5 November 2026)

His words, approving the first edition (posted Thursday 5 November in place of an off-day video): "Looks great. I
intend to schedule this today", then "Can you encode to an engine that future AI tip carousels can follow without being
too literal with imagery and screenshots? More so, the visual standard, theming, expectations, and standards".

The format: five to ten jobs AI does well now, one per card. Each card shows the tools that do the job, a real image of
it being done, one prompt to paste and three steps. The reader leaves with an action, where to click; the Saturday good
news leaves a feeling. Growth makes it (28 October ruling) with the kit `render/pieces/ai-tips-screen` and the builder
`scripts/ai_tips_deck.py` in growth-makeyourmindup, whose brief is `docs/briefs/ai-tips-carousel.md` there; the builder
refuses a deck that breaks the checkable lines below.

- **Jobs, not launches.** Each card is a job a worker has ("Catch up on a long thread"), with two to four tools that do
  it. His words: "there are loads of other tools that can do the same thing and we should acknowledge those". Every
  tool has its own vendor help page read within seven days; the caption carries the links and that date, never the
  cards. No job or lead tool repeats within four weeks.
- **Theming.** An off-day carousel has no palette of its own (his words: "There is no colour palette for off-day
  carousels"). Every card is ink. Cream carries the words; mint marks the second headline line, the quote mark, the
  step numbers and the image frame; green draws the rules. No series colour and no series name or pill, on the cover
  too: this replaces the cover section's series pill and series-colour light for this format.
- **Type.** Headlines are Anton capitals in two centred lines, the job then the payoff in mint (his words: "I prefer
  Anton capitals"). The prompt is Archivo; numbers and labels are IBM Plex Mono.
- **Card anatomy.** Top to bottom: the count and the tool logos on cream tiles; the headline; one image in a mint frame
  with a soft green glow; a large mint quote mark and the prompt; three steps in columns split by thin green rules; the
  house mark small in the bottom corner. No filled boxes under the prompt or steps (his words: "make sure the text and
  the boxes beneath feel premium, which they don't right now").
- **Images, real but not literal.** The image shows the job being done or its result, cropped to the moment that proves
  it; it may show any of the job's tools, and the caption then leads with that tool. Best first: his own screenshots,
  then product shots from the vendor's own help page, then a crop of a real result. Never a title card, a logo slide or
  a wall of text. Blur names, addresses, money and anything private (his words: "blur whats necessary").
- **Image and prompt agree.** His words: "Make sure there is synchronicity between the image and the quote at all
  times." The prompt asks for what the image shows; change one, change the other. The prompt is the reader's own
  sentence to paste, so its "me" and "my" are the reader's, not the creator's.
- **Cover.** A scene, per the cover section, with the house robot or no robot. It may lay real crops of one job across
  the scene, from first click to result, each with a short label (on 5 November: a search, 22 sources, an AI podcast).
- **Close.** Two lines and one note that the links are in the caption.
- **Caption.** One line per job with its lead tool's vendor page and the other tools by name, the check date, the plan
  or licence note and which cards use vendor images; within Instagram's 2,200 characters and content-engine's channel
  copy lint.

## The last card says "Follow for more" (Ruling, Krish, 5 November 2026; superseded 12 November 2026)

Superseded by the brand palette Krish approved on 12 November 2026: the last card of a carousel is `house_close_slide`
(the takeaway, Subscribe free, the wordmark small in the bottom right), which Growth's templates draw since
growth-makeyourmindup #76 ("one carousel close, mark bottom right"). Kept as the record of the 5 November rule.

His words: "Every single makeyourmindup carousel should have a "Follow for more" call to action on the last card, just
above the "Make Your Mind Up" word mark. Which should be a bit larger and centered on the last card always".

- The last card of every carousel, series and off-day alike, ends with the words "Follow for more" set directly above
  the house mark.
- On that card the mark is centred at the foot and a bit larger than the corner mark on the other cards. In Growth's
  renderer it is 360px wide, against 200 to 220px in the corner. It is the official file, per the brand mark section.
- This replaces the bottom-corner placement for the last card only. The other cards keep the mark small in a bottom
  corner.
- Nothing else sits between the words and the mark, and neither overlaps the card's own words.
