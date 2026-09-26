# Creative identity upgrade: the Signature Pack

Status: Direction approved by Krish on 2026-09-25 (section 0). Every specific
design, sound, template, rule and threshold in this document is still a
proposal until he approves it item by item, on rendered evidence.
Owner: Krish Raja
Version: 3, 2026-09-25, against `main` at `889e2d7`. Supersedes version 2 of the
same day, which Krish supplied; this version folds in his answers of
2026-09-25 and four corrections found by reading the live mandates and the
claims tables. Version 2 is kept verbatim at
`docs/history/2026-09-25-CREATIVE_IDENTITY_UPGRADE_v2.md`.

This is the instruction manual for the engine's creative output: how the
publication and the Shorts and carousels cut from it look, sound and move. It
is written for an agent with no context. Read section 0 and the whole of
section 1 before touching anything.

`AGENTS.md`, `docs/NORTH_STAR.md` and `docs/STATE.md` outrank this document.
The subchannel mandates in `venture_formats.mandate` outrank it on anything a
mandate says. Where this document and live state disagree, live state wins
and the disagreement is written into `docs/STATE.md`.

---

## 0. Decisions Krish has made

| Date | Decision | His words, or the question he answered |
|---|---|---|
| 2026-09-25 | The publication is **makeyourmindup**. Its cover page is makeyourmindup.ai; the publication is hosted on Substack. | "Its called makeyourmindup, will be covered paged at makeyourmindup.ai and the publication hosted on Substack" |
| 2026-09-25 | Each signature format runs on every article, or not at all. | "I want these to be signature bulletproof formats that can run across any article FYI, if they are going in, they need to go in for everything." |
| 2026-09-25 | Each subchannel's signature device follows the diagram language its mandate names. | agreed to recommendation 1 |
| 2026-09-25 | The cold open is the opening artifact each mandate already asks for: the device's first state, posing the subchannel's question. | agreed to recommendation 2 |
| 2026-09-25 | Calls are published through the engine's existing claims system, with its held, broke, unclear and not checkable rulings. | agreed to recommendation 3 |
| 2026-09-25 | Components become universal one at a time: each one runs on every article from the day it passes the corpus test, and never comes back out. | agreed to recommendation 4 |
| 2026-09-25 | Krish's time per piece, beyond reading and approving it, is budgeted at about 20 minutes: one read that feeds both the audio edition and the Short's voice. | agreed to question 3 |
| 2026-09-25 | The panel stamp leads with the panel's sharpest objection and Krish's answer; the score is small. | agreed to question 4 |
| 2026-09-25 | Channel architecture: Substack is the hub; YouTube, Instagram and TikTok are broad reach; LinkedIn carries his personal posts. | "substack will be the hub, and youtube/insta/tiktok will be the broad reach channels. linkedin for personal posts." |

"They all land" (his review of the version 2 ideas) approves the ideas as a
direction. It approves no specific design, sound, rule or threshold.

---

## 1. Why this exists

### 1.1 What Krish asked for, in his words

On 2026-09-25 Krish asked for "the most out-there, wacky, divergent, creative,
delightful ideas possible to make this memorable and completely one-of-a-kind."
He said he does not want "boring video explainers and boring blog posts with
just walls of text," and asked to push "the boundaries of what AI can actually
do in the realm of production." Then the qualifier that governs everything
below: "The end goal is not out-there for out-theres sake, its for to always
communicate better and build a more unique identity and personality."

### 1.2 The feeling we are building

The reader is the face in `apps/control-plane/api/_mission.ts`: a senior leader
at a PE or VC backed media, adtech or data business who will not admit they
are unready for what is happening. They are busy, sceptical of AI hype, and
allergic to anything that looks like AI slop.

When they meet a makeyourmindup piece, on any surface, they should feel three
things in this order:

1. **"I have never seen it shown like that."** The first second is visibly
   different from everything else in their feed.
2. **"Oh. Now I get it."** The unusual form made the idea clearer, faster.
   This is the test every device must pass.
3. **"There is a real mind and a real machine behind this, and both are being
   straight with me."** The engine's judgement is visible, and Krish is
   visibly the editor.

The identity is a person who sees things early, explains them plainly and
shows his working. The creative system should feel like a very good
instrument panel built by someone with a sense of humour: precise, legible,
alive, occasionally playful, and free of decoration.

The name does work here. The publication is called makeyourmindup, and every
piece makes a Call and keeps score on it in public (P6). The name is the
promise; the scoreboard is the proof.

### 1.3 The test every idea must pass

Before building or selecting any device, format or flourish, answer in
writing:

- **What does the reader understand faster or better because of this?** If
  the answer is "nothing, it just looks cool," drop it. This matches the
  principle already in `config/techniques.json`: every technique must "prove,
  explain, orient, compare, evoke, or deliberately delight without competing
  with the argument."
- **Would someone recognise this as makeyourmindup with the logo covered?**
  Identity comes from repeated, owned grammar. A one-off trick builds
  nothing.
- **Is it honest?** Generated imagery is illustration and says so. Numbers are
  sourced. The engine's scores are real scores.

### 1.4 What we are avoiding

- AI avatar presenters and uncanny faces. Krish is always Krish; the only
  other "presenter" is typography.
- Stock footage, stock photography and the generic "AI glow" look (blue
  gradients, circuit boards, glowing brains, robot hands), including abstract
  generative patterns used as decoration.
- Walls of text on Substack. Long-form stays long, and it gets rhythm from
  its signature sections, motion, charts and structure.
- Novelty that changes every week. The system is a small set of signature
  devices used consistently, with room for one experiment per piece.
- Anything that makes the engine look like it publishes itself. Krish
  decides, visibly.

### 1.5 What "bulletproof" means here

1. **Universal.** Every published article gets every component that is live.
   There is no per-piece "does this one suit a flipbook?" decision.
2. **Guaranteed inputs.** Each component draws only on inputs the engine can
   always produce from an approved draft. Where a component needs something
   specific (a money map, a set of dated threads, a list of parts), producing
   it becomes a required drafting output, checked before the draft reaches
   Krish.
3. **Declared degraded modes.** Every component has a fallback that is
   designed, approved and tested in advance, and used automatically when an
   input is weak. A fallback is still the signature component, drawn more
   simply. Skipping a live component is never allowed.
4. **Proven on a corpus.** A component goes live only after it has rendered
   successfully against every draftable piece in the database, including the
   awkward ones (section 6).
5. **Deterministic.** The same approved draft produces the same output, byte
   for byte, every time.

---

## 2. Publishing still comes first

As of 2026-09-25, `content_ideas` has 0 published rows and no Short or
carousel has reached final approval (`docs/STATE.md`). Piece 1 ("Same agent,
opposite answers", follow.the.money) waits on Krish's verdict.

The universality ruling and the publishing rule fit together this way:

1. **Components go live one at a time.** Each is built and proven behind its
   own switch. The switch turns on the day that component passes the corpus
   test, and from that day every article gets it. A live component is never
   switched off for a piece.
2. **The core set goes first**, because it is cheap and it ends the wall of
   text: identity (P1), the signature device as a still and a GIF (P3), the
   panel stamp (P5), the Call (P6) and the Substack package (P8).
3. **No piece waits for a component.** A piece publishes with whatever is live
   on the day it is approved.
4. **Earlier pieces get later components where they can be added after
   publication**: the lab page, the Calls scoreboard entry and the audio
   edition. Their emails and Shorts stay as posted.
5. **The three walk pieces are the development fixtures.** Every component is
   designed and reviewed against them first, because they are real pieces
   Krish has judged, one per subchannel.

Phase 0 gate (run before any build work): confirm piece 1 has a verdict from
Krish or is actively in his queue, and confirm which of pieces 1 to 3 is next.
If no piece is moving, stop and report that instead of building.

---

## 3. The channel architecture

### 3.1 What each surface does

| Surface | Role | What it carries |
|---|---|---|
| makeyourmindup.ai | The cover page: the publication's front door | The masthead, the three subchannels, the Calls scoreboard, the latest pieces, the way to subscribe. Its lab pages (P9) live under it. What happens to CTRL's lead-magnet door, which lived at this domain, is open (section 8) |
| Substack (makeyourmindup) | The hub. Where the full argument lives and the owned audience is built | Every piece with every live component (section 5), plus Notes and Live as recurring rituals |
| YouTube Shorts, Instagram Reels, TikTok | Broad reach. Where strangers first meet the identity | One Short per piece, built from the piece's spine, ending with a path to the Substack piece |
| Instagram carousels, TikTok photo mode | Broad reach, slower read | One flipbook carousel per piece (P7) |
| LinkedIn | Krish's personal posts | Out of scope except that carousel PDFs stay available as today. The publication's devices appear there only when he chooses to share a piece |

### 3.2 What Substack can and cannot do (as supplied in version 2, 2026-09-25)

Re-verify at build time; platforms change.

- No custom HTML, CSS or iframes in posts. Only supported embeds render
  (YouTube, Spotify, TikTok, Instagram, Vimeo, GitHub and a few others).
- Datawrapper charts, Polymarket odds, LaTeX and financial charts are
  supported. Datawrapper is the only route to interactive, data-driven visuals
  inside a post.
- Email is static. A YouTube embed in email becomes a static image that links
  out. Animated GIFs animate in most email clients, so GIFs are the email-native
  form of motion.
- Native video, Substack Live and a TV app exist. Reach comes from the
  short-form platforms.
- Podcasts get automatic transcripts and can be submitted to Apple Podcasts
  and Spotify. Judge audio performance on Spotify and Apple data where
  possible.
- There is no official publishing API. The engine produces a Substack package;
  Krish posts it.

---

## 4. How to work through this document

For every component in section 5:

1. **Route it.** Principles, then context, then `strategy-brief`, then the
   producer (`krish-design` for any visual decision, `krish-build` for
   implementation, `krish-voice` for any public copy), then
   `verification-loop`, then Krish's approval gate (the canon block in
   `AGENTS.md`).
2. **Show Krish the rendered thing.** Any new visual device, type system,
   colour, sound, template or format is a proposal with rendered evidence:
   phone-size styleframes, a timed animatic, a rendered GIF or an audio file.
   A description is never enough.
3. **Show him the worst case too.** Every approval packet includes the
   component rendered on the three walk pieces and on the three weakest pieces
   from the corpus test, plus its degraded mode.
4. **Use the governed paths that already exist.** Visual devices enter through
   `config/techniques.json` and `docs/ART_DIRECTOR_REPERTOIRE.md`. Carousel
   changes go through `config/carousel-visual-direction.json`. New tables go
   through `supabase/migrations/`. The signature devices are promoted to the
   registry as `signature: true` entries.
5. **Read the mandate live.** Every check that depends on a subchannel reads
   `venture_formats.mandate` at run time and never copies its text.
6. **Record decisions honestly.** Krish's approvals are recorded with
   `decided_by: 'Krish'` only when he made them in words. Agent actions are
   `observation_only`. When Krish overrules something, the commit body carries
   `Ruling (Krish, YYYY-MM-DD): ...`.
7. **Update documents in the same commit** as the behaviour they describe, and
   add each finished component to `docs/STATE.md`.
8. **Hold the house rules everywhere,** including inside generated frames,
   GIF captions, chart titles and slide copy: plain English, no em dashes, no
   "Not X, Y" construction in either order (rule R2), no invented number,
   quotation, source or attribution.

---

## 5. The Signature Pack

### 5.1 The contract

Every article Krish approves produces one `SignaturePackV1` holding every live
component:

| # | Component | Where it appears | Rollout |
|---|---|---|---|
| P1 | Identity: the makeyourmindup masthead, three subchannel wordmarks, the typographic host, the motion grammar | Everywhere | core |
| P2 | Opening artifact | Short opening, carousel cover, Substack header GIF | with the Short |
| P3 | Signature device (one per subchannel, from its mandate) | Short, carousel, Substack GIFs, lab page | core (still and GIF), then motion |
| P4 | Sonic layer: the panel sting, the subchannel motif, device sonification | Short, audio edition, lab page | later |
| P5 | Panel stamp: the sharpest objection and Krish's answer | Substack header, the Short's last frame, the last carousel slide | core |
| P6 | The Call, ruled on the Calls scoreboard | Close of the article, Substack embed, cover page, last carousel slide | core |
| P7 | Flipbook carousel | Instagram, TikTok photo mode, LinkedIn PDF when Krish shares | after core |
| P8 | Substack package | Substack post and email | core |
| P9 | Lab page: the signature device as an interactive | makeyourmindup.ai/lab/[piece], linked from the post | later |
| P10 | Audio edition, from the same read as the Short's voice | Substack podcast feed, Apple and Spotify | later |

All of them are built from one extracted input record, `SignatureInputsV1`
(5.2). The package step refuses to finish unless every live component is
present in its full or declared degraded mode, and it records which mode each
one used.

Two formats sit outside the pack as recurring rituals: Panel Night and the
cutting-room floor (5.4).

### 5.2 The inputs record: `SignatureInputsV1`

Every component reads from this record and nothing else, so the components
cannot drift from each other or from the approved draft. It is extracted from
the approved draft, the panel records and the sources the draft was written
from.

- **Identity:** subchannel, content revision hash, title, one-line thesis,
  and a short display title for long titles (written by `krish-voice`,
  approved with the piece).
- **Spine:** the piece's signature sections in order, each tied to one state
  of the device. On piece 1 the four sections (The bill, Follow the money,
  What they say, The verdict) are the four build states of its money map.
- **Device graph:** one shape per subchannel, from the diagram language its
  mandate names.
  - follow.the.money, the money map ("where the dollars enter and where they
    leave"): parties, the points where money enters and leaves each, flows
    between them (from, to, amount or share, source, date), and who ends up
    better or worse off.
  - mind.the.gap, the timeline: threads, each a dated sequence of sourced
    events; the moments where threads meet, each tied to a sentence in the
    draft; the resolved pattern in one sentence; and what it means is coming,
    placed on the same axis as the Call.
  - under.the.hood, the annotated product shot, "with what is real marked
    against what is theatre": the shipped thing, its parts, each part marked
    real or theatre with the evidence for the mark, and the one decision that
    made it work.
- **Verified values:** every number the pack will show, each with its source
  and date. A number without a source cannot appear anywhere.
- **Panel:** the draft panel's run on the approved revision: its median, the
  sharpest objection (judge, verdict reference, the judge's own words), and
  Krish's answer to it in his words.
- **The Call:** statement, due date, confidence, what would settle it, and its
  claim id once stored (P6).
- **Evidence assets:** approved screenshots and images with their hashes and
  their truth role (evidence or illustration).

**Why the device graph can always be produced.** Each graph is the
subchannel's own question in structured form. A follow.the.money piece that
cannot say where the money enters and leaves has not answered its question. A
mind.the.gap piece with no dated threads has no pattern. An under.the.hood piece
that cannot mark a single part real or theatre has not looked under the hood. A
failed extraction is a draft problem, caught at drafting.

**Where it is enforced.** An extraction and completeness check runs after the
final pass and before the draft panel, reading the mandate live. If extraction
fails its minimums, the draft returns to `revise` with the missing element
named and never reaches Krish's queue in that state.

Minimums, as starting values to be confirmed by the corpus test and approved
by Krish:

- follow.the.money: at least 2 parties and 1 sourced flow.
- mind.the.gap: at least 3 threads, each with at least 2 dated, sourced
  events, and at least 2 meeting points.
- under.the.hood: at least 3 parts, each marked real or theatre with evidence.
- Every subchannel: a Call that passes the Call check (P6).

### 5.3 The components

#### P1. Identity

**Intent.** Identity comes from a small grammar repeated everywhere. The host
of every Short and carousel is a kinetic type system, together with Krish when
he is on camera. The masthead is makeyourmindup. The three subchannels share
the same bones (typeface family, grid, timing) and differ in accent and in how
type moves:

- follow.the.money: type behaves like money. Numbers tick, totals settle, words
  slide between columns as value moves.
- mind.the.gap: type travels in time. Words arrive on their dates along a
  line, and the phrase that matters lands where the lines meet.
- under.the.hood: type labels parts. Words attach to components, and each label
  lands with its mark: real or theatre.

This also clears a production blocker: the Studio's series rename waits on
wordmarks for the subchannels (`docs/STUDIO.md`), mind.the.gap has no
wordmark or series, and the production-brief bridge
(`apps/control-plane/api/_productionBrief.ts`) accepts only `money_of_ai` and
`built_with_ai`.

**Build.** The makeyourmindup masthead and three subchannel wordmarks as
official files from a pinned `krishanraja/mindmake` commit, SHA-256 verified in
`config/studio.json` (the 50-render-pixel legibility rule applies). A type
specification for 1080x1920 and 1080x1350. The motion grammar as named Remotion
primitives in `apps/renderer`. Captions stay deletion-only, in spoken order.

**Degraded mode.** None needed. Long titles use the approved display title.

**Done when.** Marks are pinned and verified; primitives exist with fixture
renders; every corpus piece renders its title card without overflow.

#### P2. The opening artifact

**Intent.** The mandates for mind.the.gap and under.the.hood each name the
question their opening artifact asks the reader. The opening artifact is the
signature device's first state, posing that question: the money map with its
first flow half drawn, the timeline with its threads still apart, the product
shot before any label lands. Recognisable in the first second because the
device is recognisable, and communicating from the first frame.

**Build.** The first state of each device (P3), rendered as the Short's
opening, the carousel cover and a looping header GIF. It hands off to the
opening contract in `docs/OPENING_LOOP_CALIBRATION.md`, whose checks still
apply: the opening makes the promise the title makes.

**Degraded mode.** The minimum graph's first state.

**Done when.** Every corpus piece renders an opening, two runs are identical,
and the opening contract checks pass.

#### P3. The signature device

**Intent.** One hero device per subchannel, on every piece in that
subchannel, each drawn in the diagram language its mandate names.
Consistency is what makes it a signature. The registry's limit of one
signature device per Short (`config/techniques.json`) holds: this is that one.

- **The money map (follow.the.money).** Where the dollars enter and where they
  leave, between named parties. Width is amount, colour marks who gains and
  who loses, and the path the money no longer takes stays visible as a ghost.
- **The timeline (mind.the.gap).** Each thread runs along a shared time axis
  as a line of dated, sourced events. As the piece argues, the lines bend
  toward each other and meet at today; the meeting point is the pattern. From
  today the line forks into possible futures that never rejoin (house rule
  TIMELINE, Krish's R5), and the Call sits on one branch at its date. The Fork
  is the format that tells a Short or carousel in this order.
- **Real or theatre (under.the.hood).** The annotated product shot. The shipped
  thing comes apart into its parts; each part is labelled and stamped real or
  theatre, with the evidence for the stamp one tap or one frame away.
  The stamp follows brand book v1.4, p.14 (house rule STAMPS): two words
  only, REAL or THEATRE; the part it judges named above it in lowercase mono
  ("the model", "the launch video"); bold mono, 0.18em tracking, a 3px border,
  REAL filled cream and tilted +3 degrees, THEATRE an outline at -4 degrees; a
  thin cream line from the stamp to an ink dot on the part. Stamps annotate the
  picture and never sit in the headline's line, and on a cream spread they take
  the section's colours. The cover promises "the real ones show the evidence
  for every stamp".

**The felt robot** (brand book v1.4, p.13) is the publication's only
photographic subject: a hand-sewn felt robot in cream felt with grey patches
and a blank dark visor, lying on the operating table for the cover and standing
for the welcome page. The stuffing is just visible at the unpicked seam, never
a plume. Three threads, lilac, butter and coral, one per section; the mint seam
ripper is the only other colour. The backdrop is darker than ink, so the photo
lightens into the page, with no frame. The cut is at an edge, and the threads
hang past it into the headline. Never stretch it, recolour it or give it
company. The originals, cut-outs and threads are in the kit's `photography/`
folder (`krishanraja/makeyourmindup`, `docs/brandbooknew/`); the Studio does
not use them yet.

**Keeping the three apart** (proposed 2026-09-26, waiting on Krish; sketches
at the "three signatures" artifact). Each device answers its own question in
its own shape, and never borrows another's: the money map never shows dates
or a time axis (its ghost route is the only nod to before); the timeline
never shows money flowing between parties or the inside of a product; real
or theatre never shows dates or money flows, because it is one product as it
is today.

**Build.** Each device is a pure function of its device graph. Promote each to
the registry as a `signature: true` technique with purpose, inputs,
parameters, accessibility, fallback and tests, following
`docs/ART_DIRECTOR_REPERTOIRE.md`. Check overlap with
`progressive-value-reveal` and reuse it inside the money map where that is
cleaner. Automatic layout for 2 to 12 elements, with a grouping rule above
that. Generated imagery inside the product shot is labelled as illustration.

**Degraded mode.** The minimum graph renders the same device with fewer
elements. Shares and ranges render as shares and ranges. A part without an
approved image renders as a clean labelled diagram part.

**Done when.** Each device renders on every corpus piece of its subchannel,
including the smallest and largest graphs, and Krish approves it across its
range.

#### P4. The sonic layer

**Intent.** A signature sound that makes a piece recognisable with the screen
off and carries information:

- The money map: money arriving plays an ascending figure, money leaving a
  falling one, larger flows sound heavier.
- The timeline: each thread is a line in the texture; the meeting point
  resolves into a chord.
- Real or theatre: each real part clicks into place; each theatre part lands
  hollow.

Plus **the panel sting**, a short sound that marks every appearance of the
engine's judgement (P5, and the panel's turn in P10).

**Build.** First the approved audio-asset ledger, because the Studio blocks
music in code until one exists (`AudioPlanV1Schema` in
`packages/contracts/src/v2.ts`): a migration and contract recording asset id,
content hash, origin, licence, approval and loudness. Lift the block only for
ledger assets, with a test proving an unapproved asset is still refused. Then
a deterministic sonification module, mastered to the existing -14 LUFS and
-1 dBTP targets. Every sonified meaning is also visible.

**Degraded mode.** The sting and the motif play on every piece; sonification
scales with the graph.

**Done when.** An unapproved asset is refused by test; every corpus piece
renders its sonic layer; Krish approves the sounds by ear.

#### P5. The panel stamp

**Intent.** Make the machine's judgement visible on every piece, and Krish
visibly the editor over it. The stamp leads with **the panel's sharpest
objection** to the piece, in the judge's own terms, and **Krish's answer**, in
his words. The panel's median sits beside them, small. Candid and slightly
wry, never boastful. The objection and the answer are the honesty signal; the
number is context.

**Build.** A stamp component in three sizes (Substack header image with alt
text, the Short's last frame, the last carousel slide), fed only from
`SignatureInputsV1.panel`. The objection is shortened for readers by
`krish-voice` and checked against the verdict text so it never says something
a judge did not say. Krish's answer is his words, collected with his approval
of the piece; the engine may draft one for him to rewrite, and the draft is
never published unapproved. Nothing on the stamp may expose an item on the
`never_publish` list in `NOW.md`.

**Universality requirement.** Every published piece has a draft panel run on
its approved revision. No panel run, no pack.

**Degraded mode.** If no judge raised a substantive objection, the stamp reads
"The panel had no serious objection," which must be true in the records.

**Done when.** Every corpus piece with a panel run renders a stamp whose
objection matches a recorded verdict and whose score equals the recorded
median, by test.

#### P6. The Call

**Intent.** Every piece puts one falsifiable call on the record, with a date
and a confidence, and every call is ruled on one public scoreboard for the
whole publication. Misses are shown as plainly as hits. The publication is
called makeyourmindup; the scoreboard is where it makes its mind up in public
and keeps score.

The call takes the subchannel's shape:

- mind.the.gap: what the pattern means is coming, by when.
- follow.the.money: who will be better or worse off, or where a price or budget
  will move, by when.
- under.the.hood: whether the approach will spread, hold or break, by when.

**Build on what exists.** The engine already keeps dated predictions and
rulings, and this component reuses them:

- `investigation_claims` holds a claim with its `falsifier` and
  `falsifier_due_on`.
- `/api/claims/resolve` (daily cron) records `came_due` when a date passes and
  never rules.
- `/api/claims/rule` records Krish's ruling in `claim_resolutions`: `held`,
  `broke`, `unclear` or `not_checkable`, with `ruled_by` required and
  append-only.
- `claim_scoreboard` already counts rulings and a hit rate.

What has to change:

1. **A Call can belong to a piece.** Today `investigation_claims.investigation_id`
   is required. One migration adds `content_idea_id` and requires exactly one
   of the two, plus a `kind` that marks a published Call. The ruling contract
   stays untouched.
2. **A Call check in the drafting checks:** falsifiable, dated, within a
   stated horizon, following from the piece, with a settling test named. A
   piece whose Call fails returns to `revise`.
3. **A public scoreboard.** A read-only CSV route on the control plane over
   published Calls only, guarded like the other read routes and exposing
   nothing on the `never_publish` list. One Datawrapper chart reads it and is
   embedded in every post and on the cover page, so a ruling updates the whole
   back catalogue without a republish.
4. **A reminder** in Control Center for Calls nearing their date.

Rulings are Krish's alone, recorded with `decided_by: 'Krish'`. The engine
proposes a ruling with evidence and never rules.

**The mandate question.** Mandates live in `venture_formats.mandate` and only
Krish changes them. The Call check can be enforced only once he adds the Call
to all three mandates (section 8).

**Degraded mode.** None. A piece without a defensible Call goes back to
drafting.

**Done when.** A published Call can be stored, ruled and shown; changing a
test ruling updates the chart without a republish; the Call check has run on
every corpus piece.

#### P7. The flipbook carousel

**Intent.** The swipe is the motion. The carousel is the signature device
played one frame per slide, following the piece's spine, so swiping performs
the argument. Every slide also reads on its own, because people stop swiping.

**Build.** A `flipbook` mode in `config/carousel-visual-direction.json` and
`packages/core/src/carousel.ts` that renders consecutive slides from the
device's states with exact registration between slides. Cover from P2, last
slide with P5 and P6. Packages for Instagram (PNG), TikTok photo mode and
LinkedIn (PDF, used only when Krish shares a piece). Nothing posts itself.

**Degraded mode.** A small graph produces fewer slides, never fewer than the
minimum Krish approves.

**Done when.** Every corpus piece renders a flipbook in which each slide
passes a standalone legibility check.

#### P8. The Substack package

**Intent.** Long-form with rhythm, good as a static email and better on the
web. The signature sections carry the structure, and each opens on the
device's state for that section.

**Build.** An extension of the existing `substack` channel cut: the post body
in its signature sections, the header GIF (P2 once live, P3 still before
that), one device image per section (P3), the stamp (P5), the Calls scoreboard
embed (P6), any Datawrapper charts the piece needs, and links to the lab page
(P9) and the audio edition (P10) once they are live. The engine produces the
package; Krish posts it.

**Degraded mode.** A piece with no chartable data carries only the scoreboard
embed.

**Done when.** Every corpus piece produces a package, and a test email to
Krish's own inbox shows the GIFs animating.

#### P9. The lab page

**Intent.** Substack cannot host interactives. Every piece gets a lab page
under the cover page where the reader operates its device: hover a flow on the
money map for its source, scrub the timeline, pull the product shot apart and
open the evidence behind each real or theatre stamp. The device is a pure
function of its graph, so the lab page is the same code made interactive.

**Build.** One template per device at makeyourmindup.ai/lab/[piece], generated
from `SignatureInputsV1`, with every element linked to its source. It exposes
nothing on the `never_publish` list.

**Degraded mode.** None needed.

**Done when.** Every corpus piece generates a working lab page.

#### P10. The audio edition, and the Short's voice

**Intent.** Every piece in the podcast feed, in Krish's voice, with the panel
as a character: he reads the argument, the panel sting plays, and he reads the
panel's sharpest objection and his answer.

**One read, two outputs.** Synthetic speech is prohibited
(`docs/STUDIO.md`), so every word is Krish's, and his budget is about 20
minutes per piece beyond reading and approving it (section 0). One recording
session per piece produces both the audio edition and the Short's voiceover,
cut from the same read under the deletion-only rule. If a read is not
available for a piece, the Short runs on type and sound with no voice.

**Build.** Extend the `podcast` channel cut into a fixed-length script of about
5 minutes with a marked "panel's turn" and marked Short-cut points. A
recording brief with cue points. An automatic mix with approved ledger assets
at the existing loudness targets.

**Done when.** A pilot on a walk piece is recorded, mixed and approved by
Krish by ear, and his total time for it is measured and written down.

### 5.4 Publication rituals (outside the pack)

**R1. Panel Night (Substack Live, monthly).** Krish runs the blind panel live
on five candidate ideas; viewers vote in chat before each reveal; he makes the
final call on air. Only what he states in words is recorded as his decision;
audience votes are audience data. Start after four or five pieces are
published.

**R2. The cutting-room floor (Substack Notes).** Short Notes drafts about
ideas the engine killed, with the one line on why, written through
`krish-voice` and checked for the `never_publish` list and any client or guest
name. A queue Krish posts from or skips.

---

## 6. The corpus test: how "bulletproof" is proven

Before a component's switch turns on, and before any change to a live
component merges:

1. **Corpus.** Every piece in the database that has a draft, the three walk
   pieces, and synthetic edge fixtures in `fixtures/` (the smallest legal
   graph for each subchannel, the largest, a piece with no numbers, a very
   long title, a piece with no substantive objection).
2. **Run.** Extract `SignatureInputsV1` for each, then build the component.
3. **Report.** For each piece: rendered full, rendered degraded, or failed,
   with the reason; for extraction, which pieces failed their minimums and why.
4. **Pass bar.** 100% of pieces whose extraction passes render in full or
   declared degraded mode. Extraction failures must be genuine draft problems,
   confirmed by reading them. Two runs produce identical outputs.
5. **Budget.** Render time and output size per piece on Krish's Windows
   machine. Krish sets the budget once he sees the first numbers.
6. **Krish's review.** He sees the pass report and the approval packet
   (section 4, step 3) before the switch turns on.

A fast form (fixtures only) runs in `npm run verify`; the full corpus runs as a
separate command before a component change merges.

---

## 7. The order of work

**Phase 0. The gate.** Section 2.

**Phase 1. The spine.** `SignatureInputsV1`, the extraction and completeness
check, the Call link to pieces and the Call check (enforcement waits on
Krish's mandate change), and the corpus test harness.

**Phase 2. The core set.** P1, P3 as a still and a GIF, P5, P6 with its
scoreboard, P8. Each goes universal on the day it passes.

**Phase 3. Motion.** P2 and P3 in motion, the Short, P7.

**Phase 4. The rest.** The audio-asset ledger and P4, P9, the P10 pilot.

**Phase 5. Rituals.** R2, then R1 once four or five pieces are published.

Each component that goes live gets a line in `docs/STATE.md` saying what
shipped, what Krish approved and what waits on him.

---

## 8. Decisions still waiting on Krish

| Decision | Recommendation | Why |
|---|---|---|
| The makeyourmindup masthead, subchannel wordmarks and type system | Approve from three rendered territories | Unblocks the series rename and the brief bridge |
| Rename the Studio series to the subchannels | Yes, once wordmarks are approved | The Studio still speaks the retired two |
| Add the Call to all three mandates | Yes | P6 cannot be enforced until the mandates ask for it |
| Where CTRL's lead-magnet door goes, now that makeyourmindup.ai is the publication's cover page | A clearly labelled route from the cover page, or its own address | makeyourmindup.ai was CTRL's door; readers and CTRL leads need different first screens |
| Whether the Substack uses the makeyourmindup.ai domain or links to it | Link from the cover page first; move the domain later if it helps | The cover page stays owned whatever Substack does |
| Extraction minimums per subchannel | Start with 5.2, adjust after the corpus test | They decide which drafts are sent back |
| Render and size budget per piece | Set after the first corpus run | Real numbers first |
| Signal & Noise | Leave it where it is for now | Merging an interview show early blurs both |
| Panel Night start | After four or five published pieces | The audience needs context |

---

## 9. How the engine learns from all of this

The rules in `docs/NORTH_STAR.md`, "The rules that make the learning honest,"
apply unchanged.

- A change to a live component changes every future piece, so it goes through
  the full corpus test and Krish's approval every time. A component never
  changes because one piece performed well or badly.
- Feedback on one piece's pack (a layout he disliked, a stamp line he
  rewrote) is recorded with its reason, scoped to that piece. It becomes a
  proposal to change the component only through the existing weekly
  aggregation, and it becomes active only when Krish approves it and it lands
  in reviewed Git config.
- Platform performance is performance evidence, never taste, and never
  changes a rule by itself.
- The one experimental device slot per Short stays open on top of the pack.
- Anything learned about the engine while doing this work goes into
  `docs/STATE.md`, `docs/walks/` or the document it corrects.

---

## 10. Definition of done

1. Every component is live and every article approved since each went live
   carries it, with each component's mode recorded.
2. The corpus test passes at the section 6 bar and runs before every change
   to a live component.
3. The Calls scoreboard is live on Substack and the cover page and has
   updated at least once without a republish.
4. The audio-asset ledger exists and the music block is lifted only for
   approved assets.
5. The three signature devices are `signature: true` registry entries with
   tests.
6. `npm run verify` passes apart from the known failures in `docs/STATE.md`.
7. Every active taste rule has a recorded approval from Krish.

Report status literally: built, committed, merged, deployed, live and
verified are separate states, and each is claimed only with evidence.

---

## 11. What not to do

- Do not ship a piece with a live component missing, and do not skip one
  because it looks weak on a piece. Use the declared degraded mode, or send
  the draft back.
- Do not let building a component delay a piece.
- Do not change a live component without the full corpus test and Krish's
  approval.
- Do not invent a signature device the mandate does not name.
- Do not add a second dashboard or a second media source of truth.
- Do not copy the mandate, the voice block or the corpus into code, prompts or
  documents.
- Do not produce synthetic speech, and do not present generated imagery as
  evidence.
- Do not post, upload publicly or schedule anything. Krish publishes.
- Do not treat "they all land" as approval of any specific design, sound or
  rule.
- Do not publish a stamp answer Krish has not approved.
- Do not expose anything on the `never_publish` list on any public surface,
  including the lab pages, the cover page and the Calls CSV.
