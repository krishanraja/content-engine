# Carousel quality standard

Owner: content-engine. Taste authority: Krish Raja. Updated 5 November 2026; the brand elements rechecked on 12
November 2026; how a carousel is made rewritten on 13 November 2026; his rulings of 14, 15 and 16 November 2026 added.

**The 3-second carousel format wins over everything below (Ruling, Krish, 26 November 2026), and it is enforced.** His
words, relayed verbatim: "Tell the Content-engine story intelligence for makeyourmindup v5 session that it is to enforce
carousel formatting." The rules are rows in `config/carousel-format.json`, from the locked v5 Library's
`CAROUSEL-FORMAT.md`, `TITLES.md` and `library.json`, and each is a refusal that fails the run, never a warning: 4 to 7
slides (the cover, 3 to 5 inside, the close) in the Library set's registry order, the piece carousel 6, good news 4
items; the cover from `make_covers.py`, its headline 10 words or fewer and 50 characters or fewer in his title shapes at
120 px or more; each inside slide one glance line of 8 words or fewer at 96 px or more, 15 words at most, 50 across the
inside, one dominant visual on half the slide, a statement; the close the takeaway (44 characters or fewer, two lines,
its payoff in mint), the S3h wordmark and the site, never "Follow for more"; how-to one step a slide, 5 at most, the
real screenshot, a prompt of 5 words or fewer; nothing below 34 px. A carousel is made only by
`python3 scripts/carousel_make.py <piece> --set <set> --deck DECK.json --out <folder>`, which checks the deck
(`carousel-deck/3`, `scripts/carousel_check.py`), calls `make_piece.py --set <set>` and `make_covers.py` by path,
checks the drawn slides and writes the receipt the manifest needs before he can approve it. Where a section below says
otherwise (ten cards, 8 to 20 word sentences, "Follow for more", an Anton body, a Codex card), it is history: the old
deck schemas are refused and the Codex carousel card is retired.

**The brand palette wins on every brand element** (Krish, 12 Nov 2026: "I approve the brand palette sheet, but only if
it falls in line with the attached."): the cover's logo, the wordmark, the colour of each day and the last card come
from `config/brand-palette.json` (`docs/production/BRAND_PALETTE.md`), and where a section below says otherwise on one
of them, the palette is right and the section is history. A carousel's last card is the v5 close,
`config/carousel-format.json` `close` (the palette's `house_close_slide` says the same): the piece's takeaway in one or
two lines, its payoff in mint, then the S3h wordmark and the site, and never "Follow for more" (the follow ask goes in
the caption). `scripts/carousel_check.py` refuses a deck whose close breaks those rows. The 18 Nov close (the wordmark
centred under "Follow for more"; Ruling, Krish, 2026-11-18) and the 14 Nov "Subscribe free" close before it are history,
superseded by the carousel format (Ruling, Krish, 2026-11-26), and the floor no longer serves the 18 Nov standard
(`config/floor-rulings.json` `retired`).

Who makes carousels (Ruling, Krish, 26 November 2026: "I believe that growth
should move all asset production to Content Engine. I see no point in having a
separate repository produce specific assets"; it supersedes the 28 October
split): content-engine makes every carousel, to this standard, the rejection
floor (`python3 scripts/floor.py --format carousel`) and the copy lint
(`config/copy-lint.json`), and hands Growth the finished cards with their
captions in the piece manifest; Growth posts them. A carousel is made by the one
route below, "How a carousel is made".

Status: approved production reference. On 26 October 2026 Krish approved the
complete eight-card Grok Bot vs Muse revision 03 as the production pilot,
answering "yes" to the explicit full-pilot approval question. Its exact
ordered image hashes and review evidence are retained privately. This locks
the earned production principles, not a universal scorecard, eight-card
length or fixed visual template. Publishing approval remains separate.

## How a carousel is made (Ruling, Krish, 13 November 2026)

His words, asked whether to retire the Studio's old carousel commands: "all the carousels should now be done in Claude, but
using the Codex plug in as per the other usual workflows". Then, the same day: "memes and Notes images should go the
same way", and "Off-day voiceover shorts should go the same way too".

**From 26 November 2026 the pictures come only from the locked v5 Library** (Krish: "I approve the new cover thumbnail
systems, go"; `docs/ve/cards/library/`, branch `library/gates-and-wiring` until it reaches main). The Library templates
are the only artwork: no second renderer, no per-piece look, no Codex-built card. Steps 2 to 4 below are that change;
`config/asset-routes.json` maps every asset kind Growth used to make to its Library command and set.

So there is one route. A carousel is made in a Claude session that someone opens, usually from the board item's "Copy
prompt for Claude" (`itemPrompt` in `apps/control-plane/api/board/_weekModel.ts` writes it, with the route from
`_makeRoute.ts`; since view contract 1.17.0 of 16 November it takes Krish's notes first and opens Claude Code with the
prompt filled in). It is never made by a scheduled job, a
headless model run or a template engine. The Studio's old carousel commands are retired (their record is in
`docs/history/`, dated 13 November 2026), and so is Growth's Saturday art-direction run. In the session:

1. **Claude writes the deck: the story, the words and the creative direction.** The story route is "The ten-second
   swipe" below: ask why five times, find the wider trend and prove it with an outside source, tell it in order, every
   card after the cover one full plain sentence of 8 to 20 words a stranger can follow, and at most 10 cards, ending on
   the palette's close: the takeaway, then "Follow for more" with the wordmark centred under it. The words live in a `carousel-deck/2` file (the why-ladder, a source per Why; a `carousel-deck/1` file still validates)
   and `python3 scripts/carousel_check.py DECK.json` passes before anything is drawn. Everything follows this
   standard, the brand palette (`config/brand-palette.json`, `docs/production/BRAND_PALETTE.md`) and the rejection
   floor (`python3 scripts/floor.py --format carousel`).
2. **Claude fills the Library set from the piece**: `python scripts/library/make_piece.py <piece> --set <set>` (the
   sets are `library.json` `carousel_sets`: piece, good-news, simple-advice, how-to, explainer, quiz, meme;
   `python3 scripts/post-pack/asset_routes.py command <kind> --piece <piece> --out <folder>` names the set for each
   kind). It never invents words: every slot comes from the piece.
3. **The cover and the first slide come from the cover systems**: `python scripts/covers/make_covers.py <piece> --out
   <folder>`, which writes `covers.json` (post-pack reads it as `cover_set`). Pictures follow the imagery order
   (`docs/ve/cards/library/ART-DIRECTION.md`): a licensed Commons photo of a named person in their own story, then the
   real object, company or venue, then a photoreal still of the specific thing built by Codex through the Codex plugin
   (no generated people, no readable logos or text). No badges.
4. **Absent Library, no carousel**: while `scripts/library/make_piece.py` or `scripts/covers/make_covers.py` is not on
   the checkout, stop and say "the v5 Library is not on this checkout yet". Never draw it another way.
5. **Claude verifies them**: the deck check again on the words as drawn, the drawn cards with
   `python3 scripts/carousel_check.py --cards card-1.png ...` ("The cover and the page", below), a look at every card at
   full size and at phone size, then the 10/10 judges below, asked by the make flow itself
   (`python3 scripts/post-pack/judge_assets.py ask REQUEST.json --week <Monday>`, `op: judge`). Then the captions:
   `python3 scripts/post-pack/channel_captions.py` writes each channel's words and title into the manifest after a
   blind read.
6. **Claude files them** in the post's `3 Posts` folder with `scripts/post-pack/send.py` and reports on the piece or
   the board as `docs/PUBLISH_BOARDS.md` says ("Sessions and materials"; the cards go back as `slides` with their
   `drive`, "Seeing a finished carousel" below).
7. **Krish approves; Growth posts it** through its approved route, and makes nothing.

Memes and Notes images take the same route with no deck: a meme carousel is the Library's `meme` set; a single meme
image, a tall meme with its clip and a Notes image (`social-meme`, `social-meme-video`, `social-note-image`) have no
Library command yet (`config/asset-routes.json` lists them as gaps), so they are not made another way. Off-day voiceover shorts, and meme videos, take the video engine's route in a
content-engine session: the session writes the script and the signed spec, Codex builds the devices and plates from
cards, `ve` renders, and a separate reviewer watches and listens before it is called ready (`docs/ve/ENGINE.md`,
`docs/ve/RUNBOOK.md`). The voice is an ElevenLabs voice from `config/voice-bank.json` (his Krish v2 voice by default,
Krish Remix as the backup, or a stock voice he approved), the one he picked on the Content Board (Pick the voice), or his own take when he picks
Record it myself there (then the script goes to his Teleprompter once he approves its words, never ElevenLabs), with a light off-day track under it
(Pick the music under the voice). Every carousel carries an approved audio track the same way: its group in
`config/music-library.json`, his Pick the track on the board, at the one bed shape (`config/music-bed.json`). A good-news
carousel is offered the funky-house group (`carousel: good_news`), a supporting carousel or explainer the gym group
(`carousel: tips`); a meme, still or video, keeps its own sound and gets no track (Ruling, Krish, 2026-11-17: "good news
stuff should get funky house and uplifting tunes from epidemic, advice and tips carousels should get a more gym-type
focus track. Video memes keep their original sound"; `apps/control-plane/api/board/_audio.ts`, `trackGroup`). A session
never picks either for him (Krish, 2026-11-17: "for all voiceovers and carousels, I want there to either be an audio
track over the carousel, or, if it's a voiceover, then I want Eleven Labs voices used to do the voiceovers").

`tests/control-plane/make-route.test.ts` holds the board's prompts and the documents that tell a session how to make
one of these to this route, and refuses the retired routes by name.

**Treatments (18 Nov 2026).** A carousel's still treatments (grain on the ground, duotone on a photo, a glow on the one
number) come by rule from `config/ve/treatments.json`, never chosen per deck; once card `ve-treat-2-still-treatments`
is built, the deck's renderer calls `scripts/velib/still_treatments.py`. `docs/ve/TREATMENTS.md` has the rules.

## Every carousel passes the 10/10 judges (Ruling, Krish, 12 November 2026)

Krish: "Judge them; count passes. Every Growth carousel goes through the same 10/10 judges, and each one that passes and goes live counts." Whoever makes it, a carousel is judged
before it is handed to Growth: the make flow asks `POST /api/board/<Monday>/judge` itself
(`scripts/post-pack/judge_assets.py`; Ruling, Krish, 2026-11-26), the draft judges' panel reads its
exact words with its claim and is shown every card (from 15 Nov: the request carries the cards and a passing
`carousel_check.py --cards` receipt for them, or it is refused unpaid), and a pass means every judge passes it, each
scoring at least 7, none killing or abstaining: 10 of 10 judges, the bar docs/NORTH_STAR.md names. Until 15 Nov a pass
was the panel's lower median at 7 with the pictures unseen, which is how the 14 Nov deck passed at 9. Only a pass is made, bound to its post and counted on the North Star once it goes live.
A fail comes back with each judge's fix and is never posted. `docs/GROWTH-HANDOFF.md`, "Every carousel and Short
through the 10/10 judges", has the route.

## The antislop report (Ruling, Krish, 23 November 2026)

Krish asked for the antislop guardrail. At the carousel skill's step 5, beside `carousel_check.py --cards` and the
judges, the maker runs the antislop PASS/FAIL report on the deck and the cards (`.agents/skills/antislop/ADAPTER.md`
first, then the skills it names) and fixes each FAIL that no house rule overrules. This standard, the brand book, the
floor and the copy lint win wherever they and antislop disagree; antislop checks, it never writes or picks a look.

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

## Off-day carousels are utility, at the level of the Instagram inspo sheet (Ruling, Krish, 16 November 2026)

Krish, 2026-11-16: "Ultimately what performs really well is what's on those Instagram info sheets. Off day Carousels
should have that level of utility: attention-grabbing headline and visual, and actual real utility."

An off-day carousel is made to the bar of the best posts in his Instagram inspo sheet (Drive "Instagram inspo.xlsx"; the
plan-week lookalike step names the post each idea beats):

- a headline that stops the scroll;
- a cover picture that does the same;
- cards that give the reader something they can use the same day.

Humour rides on top, in the angle. The weekly good news and the memes keep their own aims. The ideas gate holds the idea
to it (`aim: utility`, `board_feed.py gate`, from the 23 Nov board), and the 10/10 judges read the finished carousel
against it.

The sheet is a source of ideas too, and its card flow is the model (Krish, 2026-11-16: "Just look at that Instagram
inspo sheet for content ideas. Look at it for the way the narrative goes from card to card. You are more than welcome to
copy any ideas but we just change the copy, we change the branding, we change the imagery, and ideally we have our own
take on the card (even if we're allowed to use the specific bit of news or idea or format)."):

- a carousel may take a sheet post's news, idea or format outright, and names it (the idea's `lookalike.beats`);
- its cards do, in order, the job each card does in that post's pattern (`card_flow` in the week's `lookalike.json`);
- the copy, the branding (this standard and `config/brand-palette.json`) and the imagery are always ours: never their
  sentence (the ideas gate refuses seven of their words in a row), their layout, their logo or their pictures;
- it says its own take in one line (`lookalike.our_take`) and lands it on the cards;
- the facts come from the primary source, checked the same day: the post is where the idea came from, never the evidence.

All of it is fun to make and fun to read (Krish, 2026-11-16: "one of the main things about ALL makeyourmindup content is
that it must be fun for me to produce, and must be fun for an audience to consume.").

## The ten-second swipe (Ruling, Krish, 13 November 2026)

His words, of the Thursday 12 Nov Git carousel: "Git carousel cards look terrible apart from the cover card and they
also are not very easy to follow. Remember that a complete layperson is swiping through these cards at light speed and
needs to be able to follow the story within 10 seconds. This cannot ever happen again in any future carousel." Then, of
the first redraw: "Nobody knows what Git is. No one knows why Anthropic did this. No one knows why it's important to
basic people or what could change as a result. What everyday trend could this point towards that every business person
might benefit from knowing? Ask why five times and then rewrite this script before you start rendering any more cards";
"the 'so what' is missing. What is this piece of news an indicator of in terms of macro trends and how to solve a
bottleneck in your business that never used to exist? That's where the gold dust lies"; and, approving the rewrite:
"50 words is fine ... The number of cards is irrelevant as long as it doesn't exceed 10 in total, including the cover
card and the call-to-action card."

The route, for every carousel, whatever the topic. Nothing is drawn until the words pass it.

1. **Ask why five times** about the news before writing a word, ending on why an everyday business person should
   care. The fifth answer is usually the piece.
2. **Find the wider trend it is a sign of, and prove it with evidence from outside the story**: a study, a number, a
   second company. That is the "so what", where the value lies; a trend is shown with its source, never asserted.
3. **Tell it in this order, a card or more for each**: what the thing is, in plain words (a layperson never knows the
   tool, the company or the term); what happened; why; the wider trend and why it matters to them; what to do about it.
   The doing is concrete enough to act on this week.
4. **Every card after the cover carries one full plain sentence a stranger can follow cold** (Ruling, Krish,
   2026-11-15: a carousel body card carries one full plain sentence of 8 to 20 words; his words, "Use 8 to 20 words";
   his 2 Nov "WAY too much text" means no paragraphs). His words: "They assume that people have a working knowledge of what we're talking
   about and use too few words. For example, "12x more code in 4 months" should be something like: "12 times more code
   is being produced per month because of AI doing more coding"." So 8 to 20 words a card (the range he ruled, and the one Growth's carousel lint holds) and still one point a card;
   the cover 3 to 12; at most 160 across the deck. The sentence names its subject, has a verb, gives a number its unit
   or comparator and its cause, and leans on no card before it: no "12x" (write "12 times"), no opening on So, But,
   And, Then, Or or Because, no "it", "they" or "this" for a name, no stacked fragments ("Doing got faster. Checking
   didn't."). A label ("Code changes Anthropic merged per day"), a bare number ("7 engineers, 5 months") or a list of
   names is not a headline. This replaces the 50-word cap of 13 Nov for the cards after the cover.
5. **Every card after the cover shows its point as a picture**: bars to scale, the thing jammed, the people, the
   hand-off. The line under a headline is at most 20 words and only adds: it defines a word, names a source or gives the
   number. No jargon a layperson does not know (`config/carousel-plain-words.json`) unless the deck explains it.
6. **At most 10 cards, the cover and the call-to-action card included.** The number in between is whatever the story
   needs.
7. **The last card is the palette's close** (`house_close_slide`): the piece's takeaway as its headline in one or two
   lines, one picture, then "Follow for more" with the Make Your Mind Up wordmark centred under it; no wordmark in the
   bottom-right corner on this card and never "Subscribe free" (Ruling, Krish, 2026-11-18: "The last card of the carousel should always have the "Make Your Mind Up" word mark centred under the "Follow for more" text, as opposed to the word mark in the bottom-right corner and an amateur call to action"; it replaces the 14 Nov "Subscribe free" close). Saturday's good news keeps his fixed
   good-news close.
8. **Two fresh readers see only the headlines, in order, once**, and answer in their own words what it is, what
   happened, why, why it matters to them and what to do. Every place either got stuck is fixed before drawing.

The deck's words live in a `carousel-deck/1` file (`five_whys`, `arc` naming the card for each step, a `source` on the
trend card, `cta`, `read_back` with each reader's five answers), and `python3 scripts/carousel_check.py DECK.json` passes
before any card is drawn or filed. `tests/carousel_check_test.py` holds the failures: the deck as sent on 12 Nov, the
five-card redraw of 13 Nov with no "so what", and the Git deck of 13 Nov
(`docs/plans/2026-11-09-week/git-carousel/deck.json`), which he named hard to follow on 15 Nov ("12x more code in four
months.", "So Anthropic built one for AI.", "Doing got faster. Checking didn't."). The worked example is now the
synthetic FOLLOWABLE deck in that test, written in the shape he asked for. Growth runs the check on every carousel it
makes to this standard.

**`carousel-deck/2`: the why-ladder, a source per Why** (Ruling, Krish, 2026-11-24: the signature format is the 5 Whys;
get rid of everything that suggests predictions, calls, dated, odds or scores). The same file climbing the ladder the
piece's research found (`packages/contracts/src/whys.ts`): `five_whys` holds `{"q", "a", "source"}` for every Why, where
`source` is who said it, dated, or its link (or `{"label", "url"}`). It climbs 3 to 7 Whys, five the target and never
padded; fewer than 3 only when the last carries the `"stop"` that ended the ladder, one of `evidence_exhausted`,
`motive_not_mechanism`, `restatement`, `abstraction_drift`, `out_of_scope` or `cap`, and never on a Why before the
last. A `/2` deck lands instead of telling anyone what to do: its arc's last step is `"landing"` in place of `"do"`
(`"arc": {"what": 1, "happened": [1, 2], "why": 3, "so_what": [5, 6, 7], "landing": [8, 9]}`), the card (or cards)
for what this shows, ending on the open question handed to the viewer ("?"), never a lesson or an action for
business people (no "should" or "must", no sentence that opens on an order such as "Find" or "Check"). The last
card's headline is the landing, then the palette's close. Each fresh reader answers `"landing"` (what it shows and the
question it leaves them with) in place of `"do"`. `carousel_check.py` refuses a Why with no source, a stop outside
that list, a `"do"` step and a landing with no question or with an order on a `/2` deck. A `carousel-deck/1` deck
keeps its five whys with no source each, its `"do"` step, and still validates.

## The cover and the page (Ruling, Krish, 15 November 2026)

His words, on the "AI is catching decades-old mistakes" carousel of 14 Nov: "the front cover card does not look like a
front cover. It looks like all the rest of the cards. ... That and the other cards in this carousel don't look very good
and aren't using the page space centrally or correctly. They look too bland and too plain, and not enough effort has
been put into the visual treatment." The ruling: a carousel cover must look like a front cover, and body cards use the
page centrally with real visual effort.

`python3 scripts/carousel_check.py --cards card-1.png ... card-n.png` measures the finished cards, cover first
(`scripts/carousel_layout.py`; the bars in `config/carousel-layout.json`, the safe box from the brand palette), and
exits 1 with every reason:

- **The cover is a front cover.** Its headline is at least 1.3 times the body cards' (14 Nov: 1.03), and it differs
  from them in at least two of three: headline scale, where the headline block sits, and how much of the card is
  picture. Never a deck where every card has the same scene-and-headline layout.
- **Every card after it uses the page.** No type outside the safe box (80 px in from every edge); no empty band over
  12% of the height and at most 35% of the safe rows empty (the 12 Nov Git cards: up to 26% and 60%); every line of
  type centred within 24 px (the Git cards: up to 408 px left).
- **Real visual effort.** A visual anchor of real size on every card: picture on at least 12% of it (the Git cards: 1
  to 9%), never plain ground with type on it.
- **Readable on a phone.** Body type no smaller than the house mobile floor: 14 CSS px on a 390 px phone, 35 px of ink
  on the 1080 px card (14 Nov: about 26 to 32).

These are proxies: a deck that passes still gets the look at full size and at phone size, and the judges, who are
shown every card. `tests/carousel_layout_test.py` holds the bars on synthetic cards.

## Narrative production and review

Use content-engine production and editorial guidance, its live mandate
and docs/STYLE_REFERENCES.md. Growth supplies
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

## Growth's brief and the feedback loop

Growth brings the amplification concept, the audience, the channel, the experiment, the source piece and the reader
action it wants; Growth owns that initiative. The making is the route above, "How a carousel is made". Specific
creative feedback and dated channel evidence come back here and improve this standard through the existing governed
learning route, never a second pipeline or learning store. The route is documented and the pilot approved; automated
volume throughput and audience results are not proved by this document.

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
- The Library's `carousel-good-news-close` holds the words (set `good-news`, `make_piece.py --set good-news`); Growth's
  old kit for it is retired with the Library lock.

## Brand mark on news, roundup and text-led carousels (Ruling, Krish, 3 November 2026)

His words, of the Saturday 7 November good-news carousel: "You've fabricated my brand logo. The brand word mark and
logo don't need to go at the top of this. They need to go in the bottom corner, subtly, on all carousels of this
nature."

- The mark comes only from the house brand files named in `config/studio.json` (`publication.mark`, `publication.logo`,
  `publication.stacked`, sourced from krishanraja/control-center). It is never set as type or redrawn.
- On every carousel of this nature (news, roundup, text-led) it sits small and subtle in a bottom corner, never at
  the top.
- Before delivery, check every slide at full size for both.

## The house carousel look: Git and homework covers, Erdős body cards (Ruling, Krish, 18 November 2026)

His words, sending three past decks as the reference: of "Anthropic's AI broke Git." and "Your AI thinks it's the best.
Guess who told it.", "in these two, the cover image was great but the rest of the cards were not"; of "AI broke an
80-year-old maths belief.", "in this one the cover was the most underwhelming, the rest of the cards were good"; and
"We need real world images where possible. the carousel templates need to be 100X better in all ways". The decks are
in his Drive (`3 Posts`: the Git post, the homework post, and "AI fixing what we got wrong v2").

- **The cover, as the Git and homework covers.** The top 60% is one cinematic, photoreal scene of a specific funny
  moment (dark, lit, real texture: a robot arm in a storm of paper over a filing cabinet; the house felt robot marking
  its own homework). Under it, on the ink ground: the real company wordmark when the story names one, the headline in
  Anton set huge on two lines (cream, then the turn in mint), one plain subline in Archivo, the mark small bottom right.
  Never an abstract diagram or a chart as the cover: that is what made the Erdős cover underwhelming.
- **The cover is sensational** (Krish, 2026-11-18: "The cover image of the carousel should always be more sensational.
  Have a real-life person in them, or a sensational real-life visual screenshot, or a really really well put together
  generated image"; and of the first house-look covers: "more absurd, hilarious, and creative"). One of: a real person
  in an absurd, funny, specific moment; a sensational real screenshot; or a generated image good enough to pass for a
  photograph. A product story shows the product itself, not a stand-in (the ads cover is ChatGPT open and smothered in
  sponsored links, with a person being sold to from every side, not the robot). The house robot is for covers where no
  person or real screen fits.
- **Body-card type is designed, not default** (Krish, 2026-11-18: "the font and look are substandard"): a small
  IBM Plex Mono kicker in mint naming the card's step (WHAT IT IS, WHAT HAPPENED, WHY, THE BIGGER PICTURE, WHAT TO DO),
  a short mint rule under it, then the sentence in Anton, uppercase, the same face as the cover and the close, with its key
  figure or phrase in mint. **Never Archivo Black, and never Archivo at weight 800 or heavier, for a body sentence** (Krish,
  2026-11-18, of the shipped ChatGPT ads carousel: "this font is crappy, i have given this feedback before"; he saw the
  deck set in Anton about a minute later and said "go"). The 18 November rewrite above answered "the font and look are
  substandard" by redesigning the card and kept that face, which was not what he objected to. The carousel Codex card
  states this face outright (`CAROUSEL_BODY_TYPE`, scripts/velib/cards.py).
- **The body cards, as the Erdős deck's.** Every card after the cover is image-led: its own real or photoreal picture
  of that card's point in the same dark, lit look, with the card's one sentence set large below it. The deck reads as
  one feature, never as slides of icons, grids or flat diagrams.
- **Real-world images first.** A real photograph, a real screen or a real document the story names comes before a
  generated scene; a generated scene is photoreal, never clip art, and its only robot is the house felt robot.

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
- Cards 2 onwards stay the house look: ink ground, Anton headlines and body sentences (never Archivo Black), Plex Mono labels, real logos from
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
  logo rows and a strip, and under a long title, and a skin forced to fail moving the piece on). Growth held its kit
  to the same rule (its R125) until its renderer was deleted on 26 Nov 2026.

## The tall meme is centred (Ruling, Krish, 15 November 2026)

His words: "The POV computer meme, it's not centralized on the screen." The 13 Nov meme sat 40 px left and 107 px high
with a third of the screen empty below it. A tall meme is the brand palette's `meme_tall` (9x16), and
`python3 scripts/layout_centre.py FILE` holds it (in `ve qc` on a tall meme, and in `send.py` before it is filed): the
picture centred within 4 px across and within 48 px of y 920 (where Growth's tall templates centred the clip, before the v5 Library), the
column's margins within 16 px of each other, every word and mark inside the clear box x 200 to 880, y 270 to 1320 and
clear of every channel's buttons and caption area (`config/channel-safe-zones.json`), no empty band over 25% above it.

## Meme videos and static memes (Ruling, Krish, 17 November 2026)

His words: "lets bring up the production value of the meme to looking more like the production quality of the rest of
the carousels etc." From the 30 Nov board a meme template reskin is the original clip at its full frame, credited, his
caption on a clean band in the brand palette at carousel-grade type, the mark and a credit line, in 9:16 and 4:5, with
its social_clip receipt; and a static meme meets this standard, the same type, palette and picture quality as a
carousel card. The rules are `docs/MEME-STANDARD.md`. The Tuesday meme rule below still places the mark; its free look
gives way to this standard.

## The Tuesday meme (Ruling, Krish, 4 November 2026)

His words: "the Saturday carousel and the Tuesday meme are likely to follow their own random visual style ... The
Tuesday meme is likely to be more random but needs to be lightly subtly skinned in the bottom right corner."

- The meme's look is free. It wears no subchannel colour or name (above).
- The house mark sits small and subtle in the bottom-right corner, inside the platform's safe margin, taken only from
  the house brand files (`publication.mark` in `config/studio.json`), never set as type or redrawn. Nothing else
  brands it: no masthead, no series label, no URL footer.

## The Saturday carousel (Ruling, Krish, 4 November 2026)

His words: "Saturday's carousel should have the standards of the first one that's coming up this Saturday." The first
is the good-news carousel for Saturday 7 November 2026 (`docs/plans/2026-11-02-week/sat-revised.md`); from 26 November
it is made from the Library's `good-news` set.

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
- The checks hold it: the deck check (`scripts/carousel_check.py`, at most ten cards), the board
  (`week_plan.py` `OFF_CARDS` and `OFF_SLIDES`, at most ten) and Growth's carousel format (`social/formats/carousel.json`
  `max_assets`, which its packaging and release checks read before anything reaches Buffer). Since 26 Nov 2026 the
  format is stricter: 4 to 7 slides (`config/carousel-format.json`, `scripts/carousel_format.py`).

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
news leaves a feeling. content-engine makes it (Ruling, Krish, 2026-11-26) by the route above, "How a carousel is made"; the lines below
are what its card holds Codex to and what the session checks before filing it.

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

## The last card says "Follow for more" (Ruling, Krish, 5 November 2026; superseded 12 November 2026; restored 18 November 2026)

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


## Never an off-day tag (Krish, 2026-11-19)

The words off.day, off-day or Off day are never on a card, a cover, a caption or a title: not as an eyebrow, a pill, a hashtag or a label. It is an internal name for Tuesday, Thursday and Saturday. The copy lint refuses it on every public surface (`off_day_tag`, `config/copy-lint.json`).
