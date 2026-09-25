> **Historical.** Archived 2026-09-25 by hand. Not current guidance.
> Replaced by: `docs/CREATIVE_IDENTITY_UPGRADE.md` (version 3)
> Reason: version 2 as Krish supplied it, kept verbatim. Version 3 folds in his answers of 2026-09-25 (the name makeyourmindup, devices from the mandates, the opening artifact, Calls through the claims system, rollout one component at a time, his time budget, the stamp led by the objection).

# Creative identity upgrade: the Signature Pack

Status: Proposed. Nothing in this document is an active rule until Krish approves it item by item.
Owner: Krish Raja
Version: 2, written 2026-09-25 against `main` at `889e2d7` (code and documents read, no live readback). Supersedes version 1 of the same day.
Proposed location: `docs/CREATIVE_IDENTITY_UPGRADE.md`, listed in `README.md` after `docs/STUDIO.md`

This is the instruction manual for upgrading the engine's creative output: how the publication and the Shorts and carousels cut from it look, sound and move. It is written for an agent with no context. Read the whole of section 1 before touching anything; the rest of the document is useless without the intent in it.

The central idea of version 2: the formats are one fixed set, the **Signature Pack**, and every published article gets the whole pack. Nothing in the pack is optional per piece and nothing is decided case by case. Krish's ruling, 2026-09-25: "I want these to be signature bulletproof formats that can run across any article FYI, if they are going in, they need to go in for everything."

`AGENTS.md`, `docs/NORTH_STAR.md` and `docs/STATE.md` outrank this document. Where this document and live state disagree, live state wins and the disagreement is written into `docs/STATE.md`.

---

## 1. Why this exists

### 1.1 What Krish asked for, in his words

On 2026-09-25 Krish asked for "the most out-there, wacky, divergent, creative, delightful ideas possible to make this memorable and completely one-of-a-kind." He said he does not want "boring video explainers and boring blog posts with just walls of text," and asked to push "the boundaries of what AI can actually do in the realm of production." Then the qualifier that governs everything below: "The end goal is not out-there for out-theres sake, its for to always communicate better and build a more unique identity and personality."

He reviewed the ideas in this document and said "they all land," then ruled that each format must run on every article. That approves the ideas as a direction. It does not approve any specific design, sound, rule or threshold. Every durable taste rule in this document still needs his explicit approval before it becomes active (`AGENTS.md`).

He set the channel architecture in the same conversation: "substack will be the hub, and youtube/insta/tiktok will be the broad reach channels. linkedin for personal posts."

### 1.2 The feeling we are building

The reader is the face in `apps/control-plane/api/_mission.ts`: a senior leader at a PE or VC backed media, adtech or data business who will not admit they are unready for what is happening. They are busy, sceptical of AI hype, and allergic to anything that looks like AI slop.

When they meet a Mindmake piece, on any surface, they should feel three things in this order:

1. **"I have never seen it shown like that."** The first second is visibly different from everything else in their feed.
2. **"Oh. Now I get it."** The unusual form made the idea clearer, faster. This is the test every device must pass.
3. **"There is a real mind and a real machine behind this, and both are being straight with me."** The engine's judgement is visible, and Krish is visibly the editor.

The identity is a person who sees things early, explains them plainly and shows his working. The creative system should feel like a very good instrument panel built by someone with a sense of humour: precise, legible, alive, occasionally playful, never decorative.

### 1.3 The test every idea must pass

Before building or selecting any device, format or flourish, answer in writing:

- **What does the reader understand faster or better because of this?** If the answer is "nothing, it just looks cool," drop it. This matches the principle already in `config/techniques.json`: every technique must "prove, explain, orient, compare, evoke, or deliberately delight without competing with the argument."
- **Would someone recognise this as Mindmake with the logo covered?** Identity comes from repeated, owned grammar. A one-off trick builds nothing.
- **Is it honest?** Generated imagery is illustration and says so. Numbers are sourced. The engine's scores are real scores.

### 1.4 What we are avoiding

- AI avatar presenters and uncanny faces. Krish is always Krish; the only other "presenter" is typography.
- Stock footage, stock photography and the generic "AI glow" look (blue gradients, circuit boards, glowing brains, robot hands).
- Walls of text on Substack. Long-form stays long, and it gets rhythm from motion, charts and structure.
- Novelty that changes every week. The system is a small set of signature devices used consistently, with room for one experiment per piece.
- Anything that makes the engine look like it publishes itself. Krish decides, visibly.

---


### 1.5 What "bulletproof" means here

Krish wants signature formats that run on any article. An agent must read that as five engineering requirements:

1. **Universal.** Every published article gets every format in the pack. There is no per-piece "does this one suit a flipbook?" decision.
2. **Guaranteed inputs.** Each format draws only on inputs the engine can always produce from an approved draft. Where a format needs something specific (a list of money flows, a set of threads, a component list), producing it becomes a required drafting output, checked before the draft reaches Krish.
3. **Declared degraded modes.** Every format has a fallback that is designed, approved and tested in advance, and used automatically when an input is weak. A fallback is still the signature format, drawn more simply. Skipping a format is never allowed.
4. **Proven on a corpus.** A format goes live only after it has rendered successfully against every draftable piece in the database, including the awkward ones.
5. **Deterministic.** The same approved draft produces the same pack, byte for byte, every time.

---

## 2. Publishing still comes first

As of 2026-09-25, `content_ideas` has 0 published rows and no Short or carousel has reached final approval (`docs/STATE.md`). Piece 1 ("Same agent, opposite answers", split.the.bill) waits on Krish's verdict.

The universality ruling and the publishing rule fit together this way:

1. **The pack goes live as one unit.** Formats are built and proven one at a time behind a switch, and the switch turns on only when the whole pack passes the corpus test (section 6). From that day, every article gets the full pack, with no exceptions.
2. **Until then, pieces publish on the current system.** No piece waits for the pack. Building the pack must never be the reason a piece is late.
3. **Pieces published before the switch get the pack retroactively** where it can be added after publication: the lab page, the Calls scoreboard entry and the audio edition. Their emails and Shorts stay as posted.
4. **The first three walk pieces are the development fixtures.** Every format is designed and reviewed against them first, because they are real pieces Krish has judged, one per subchannel.

Phase 0 gate (run before any build work): confirm piece 1 has a verdict from Krish or is actively in his queue, and confirm which of pieces 1 to 3 is next. Write the answer at the top of the walk log. If no piece is moving, stop and report that instead of building.

---

## 3. The channel architecture

### 3.1 What each surface does

| Surface | Role | What it carries |
|---|---|---|
| Substack | The hub. Where the full argument lives and the owned audience is built | Every piece as a full Signature Pack (section 5), plus Notes and Live as recurring rituals |
| YouTube Shorts, Instagram Reels, TikTok | Broad reach. Where strangers first meet the identity | One Short per piece, built from the Signature Pack, ending with a path to the Substack piece |
| Instagram carousels, TikTok photo mode | Broad reach, slower read | One flipbook carousel per piece (P7) |
| LinkedIn | Krish's personal posts | Out of scope for this upgrade except that carousel PDFs stay available as today. LinkedIn is his voice as a person, so the publication's signature devices appear there only when he chooses to share a piece |
| mindmake.co/lab | Home for interactives that Substack cannot host | One lab page per piece (P9) |

### 3.2 What Substack can and cannot do (verified 2026-09-25)

These facts shape the whole design. Re-verify them at build time; platforms change.

- **No custom HTML, CSS or iframes in posts.** Only supported embeds render (YouTube, Spotify, TikTok, Instagram, Vimeo, GitHub and a few others). Source: support.substack.com, "Can I edit the CSS or HTML on Substack?"
- **Datawrapper charts, Polymarket odds, LaTeX and financial charts are supported.** Datawrapper is the only route to interactive, data-driven visuals inside a post. Source: support.substack.com, "How do I embed media in my post".
- **Email is static.** A YouTube embed in email becomes a static image that links out. Animated GIFs do animate in most email clients, so GIFs are the email-native form of motion.
- **Native video, Substack Live and a TV app exist.** Live sessions can be recorded and posted as episodes. Native video mainly serves existing subscribers; reach comes from the short-form platforms.
- **Podcasts get automatic AI transcripts and can be submitted to Apple Podcasts, Spotify and others.** Substack's podcast analytics are widely described as weaker than dedicated hosts, so audio performance judgements should lean on platform data from Spotify and Apple where possible.
- **There is no official publishing API.** This suits the house rule anyway: the engine produces a Substack package, and Krish posts it.

---


---

## 4. How to work through this document

For every format in section 5:

1. **Route it.** Principles, then context, then `strategy-brief`, then the producer (`krish-design` for any visual decision, `krish-build` for implementation, `krish-voice` for any public copy), then `verification-loop`, then Krish's approval gate (the canon block in `AGENTS.md`).
2. **Show Krish the rendered thing.** Any new visual device, type system, colour, sound, template or format is a proposal with rendered evidence: phone-size styleframes, a timed animatic, a rendered GIF or an audio file. He approves what he can see and hear. A description is never enough.
3. **Show him the worst case too.** Because each format runs on everything, every approval packet includes the format rendered on the three walk pieces and on the three weakest pieces from the corpus test, plus its degraded mode. He is approving the format across its range, and the best example alone hides the range.
4. **Use the governed paths that already exist.** Visual devices enter through `config/techniques.json` and the process in `docs/ART_DIRECTOR_REPERTOIRE.md`. Carousel changes go through `config/carousel-visual-direction.json`. New tables go through `supabase/migrations/`. The pack's signature devices are promoted to the registry as `signature: true` entries, and the pack contract (section 5.1) makes them mandatory for their subchannel.
5. **Record decisions honestly.** Krish's approvals are recorded with `decided_by: 'Krish'` only when he made them in words. Agent actions are `observation_only`. When Krish overrules something, the commit body carries `Ruling (Krish, YYYY-MM-DD): ...`.
6. **Update documents in the same commit** as the behaviour they describe, and add each finished format to `docs/STATE.md`.
7. **Hold the house rules everywhere,** including inside generated frames, GIF captions, chart titles and slide copy: plain English, no em dashes, no "Not X, Y" construction in either order (rule R2), no invented number, quotation, source or attribution.

---

## 5. The Signature Pack

### 5.1 The contract

Every article that Krish approves for publication produces one `SignaturePackV1`. It has ten components, all required:

| # | Component | Where it appears |
|---|---|---|
| P1 | Identity: subchannel wordmark, typographic host, motion grammar | Everywhere |
| P2 | Seeded cold open | Short opening, carousel cover, Substack header GIF |
| P3 | Signature device (one per subchannel) | Short, carousel, Substack GIFs, lab page |
| P4 | Sonic layer: device sonification and the panel sting | Short, audio edition, lab page |
| P5 | Panel stamp | Substack header, last frame of the Short, last carousel slide |
| P6 | The Call, logged on the Calls scoreboard | Close of the article, Substack embed, last carousel slide |
| P7 | Flipbook carousel | Instagram, TikTok photo mode, LinkedIn PDF when Krish shares |
| P8 | Substack package | Substack post and email |
| P9 | Lab page: the signature device as an interactive | mindmake.co/lab/[piece], linked from the post |
| P10 | Audio edition | Substack podcast feed, distributed to Apple and Spotify |

All ten are built from one extracted input record, `SignatureInputsV1` (5.2). The package step refuses to finish unless every component is present in its full or declared degraded mode, and it records which mode each component used.

Two formats from version 1 are not article formats and sit outside the pack as recurring publication rituals: **Panel Night** (a monthly live show, R1) and **the cutting-room floor** (Notes about killed ideas, R2). They run on a schedule and draw on the pack's components, but they are not produced per article. See section 5.4.

### 5.2 The inputs record: `SignatureInputsV1`

This is what makes the pack bulletproof. Every format reads from this record and nothing else, so the formats cannot drift from each other or from the approved draft.

It is extracted from the approved draft, the panel records and the evidence the draft was written from. Fields:

- **Identity:** subchannel, content revision hash, title, one-line thesis.
- **Seed:** derived from the content revision hash. The lead verified value, if the piece has one, is layered on top as a visual element. The seed never depends on a number existing.
- **Device graph:** one of three shapes, fixed by subchannel.
  - split.the.bill: parties, flows between them (from, to, amount or share, direction, source), and who ends better or worse off.
  - mind.the.gap: threads (each with a dated source), links between threads (each tied to a sentence in the draft), and the resolved pattern in one sentence.
  - lift.the.lid: the shipped thing, its components (each with evidence), how they fit together, and the one decision that made it work.
- **Verified values:** every number the pack will show, each with its source and date. A number without a source cannot appear anywhere in the pack.
- **Panel:** median score, Krish's override if any, and the strongest dissent with its judge and verdict reference.
- **The Call:** statement, resolve-by date, confidence, and what evidence would settle it.
- **Evidence assets:** approved screenshots and images with their hashes, and their truth role (evidence or illustration).

**Why the device graph can always be produced.** Each graph is the subchannel's own question in structured form. A split.the.bill piece that cannot say who pays whom has not answered "where does the money move, and who ends up better or worse off?" A mind.the.gap piece with no threads has no pattern. A lift.the.lid piece with no components has not lifted the lid. So a failed extraction is a draft problem, and it is caught at drafting.

**Where it is enforced.** Add an extraction and completeness check after the final pass and before the draft panel, in the same place the other structural checks run. It reads the mandate live from `venture_formats.mandate` like every drafting and checking stage (`AGENTS.md`), and it never copies mandate text. If extraction fails its minimums (below), the draft returns to `revise` with the missing element named, and never reaches Krish's review queue in that state.

Minimums, as starting values to be confirmed by the corpus test and approved by Krish:

- split.the.bill: at least 2 parties and 1 sourced flow.
- mind.the.gap: at least 3 threads with dated sources and at least 2 links.
- lift.the.lid: at least 3 components with evidence.
- Every subchannel: a Call that passes the Call check (P6).

### 5.3 The ten components

Each component lists its intent, what to build, its degraded mode, and when it is done.

#### P1. Identity: wordmarks, the typographic host and the motion grammar

**Intent.** Identity comes from a small grammar repeated everywhere. The host of every Short and carousel is a kinetic type system, together with Krish when he is on camera. There is no avatar and no stock presenter. The three subchannels share the same bones (typeface family, grid, timing) and differ in accent and in how type moves:

- split.the.bill: type behaves like money. Numbers tick, totals settle, words slide between columns as value moves.
- mind.the.gap: type connects. Words arrive as separate points, lines join them, the phrase that matters lands last.
- lift.the.lid: type assembles. Words arrive as parts and snap into place.

This component also clears a production blocker: the Studio's series rename "waits on wordmarks for the subchannels" (`docs/STUDIO.md`), mind.the.gap has no wordmark or series, and the production-brief bridge (`apps/control-plane/api/_productionBrief.ts`) accepts only `money_of_ai` and `built_with_ai`.

**Build.** Three subchannel wordmarks and a publication mark, supplied as official files from a pinned `krishanraja/mindmake` commit and SHA-256 verified in `config/studio.json` (the 50-render-pixel legibility rule applies). A type specification for 1080x1920 and 1080x1350 with line-length limits and contrast checked against platform safe zones. The motion grammar as named Remotion primitives in `apps/renderer`. Captions keep the existing rule: deletion-only, in the original spoken order.

**Degraded mode.** None needed: identity has no variable inputs. Long titles get a defined overflow rule (a shorter display title written by `krish-voice` and approved with the piece).

**Done when.** Marks are pinned and verified; primitives exist with fixture renders; every corpus piece renders its title card without overflow.

#### P2. Seeded cold open

**Intent.** Recognisable in the first second without looking templated. A generative pattern in the subchannel's motion grammar, seeded from the piece, so it carries the same visual DNA every time and never repeats a frame.

**Build.** A deterministic generator in `apps/renderer`: seed from the content revision hash, the lead verified value layered on top when present. Outputs: the Short's opening (1 to 1.5 seconds), the carousel cover and a looping header GIF. It hands off to the opening contract in `docs/OPENING_LOOP_CALIBRATION.md`, whose checks still apply.

**Degraded mode.** No verified value: the pattern renders alone with the title.

**Done when.** The same seed renders identical frames on two runs; every corpus piece renders an opening; the opening contract checks pass.

#### P3. The signature device

**Intent.** One hero mechanism per subchannel, on every piece in that subchannel. Each one acts out the subchannel's question, and consistency is what makes it a signature. The registry's limit of one signature device per Short (`config/techniques.json`) holds: this is that one.

- **Money flow (split.the.bill).** Money as literal flow between named parties: width is amount, speed is how fast it moves, colour marks who gains and who loses. The reader sees who ends up better or worse off.
- **Constellation (mind.the.gap).** Each thread appears as a point with its source label as the piece names it; lines form as the argument connects them; the pattern resolves into a shape at the end, when the gap becomes visible.
- **Exploded view (lift.the.lid).** The shipped thing splits into its real components as each is named, like an assembly manual, and the camera pushes into the part under discussion.

**Build.** Each device is a pure function of its device graph: same graph, same render. Promote each to the registry as a `signature: true` technique with purpose, inputs, parameters, accessibility, fallback and tests, following `docs/ART_DIRECTOR_REPERTOIRE.md`. Check overlap with `progressive-value-reveal` and reuse it inside money flow where that is cleaner. Layout must handle the whole range of graph sizes: automatic layout for 2 to 12 elements, with a grouping rule above that ("and 4 smaller flows") so a large graph never becomes unreadable. Generated imagery inside exploded view is labelled as illustration.

**Degraded mode.** The minimum graph renders the same device with fewer elements. Values that are shares or ranges render as shares or ranges, never as invented precision. A component without an approved image renders as a clean labelled diagram part.

**Done when.** Each device renders on every corpus piece of its subchannel, including the smallest and largest graphs; Krish approves it across its range.

#### P4. The sonic layer

**Intent.** A signature sound that makes a piece recognisable with the screen off, and that carries information. Every signature device has a sonification:

- Money flow: rising value plays an ascending figure, losses a falling and slightly dissonant one, larger flows sound heavier.
- Constellation: each thread is a note; each link adds harmony; the chord resolves when the pattern lands.
- Exploded view: each part clicks into place at a pitch set by its order in the assembly.

Plus **the panel sting**, a short sound that marks every appearance of the engine's judgement (P5, and the panel's turn in P10). Over time it becomes the engine's signature, doing the job a voice would do without synthetic speech.

**Build.** First the approved audio-asset ledger, because the Studio blocks music in code until one exists (`AudioPlanV1Schema` in `packages/contracts/src/v2.ts`): a migration and contract recording asset id, content hash, origin (`owned_generated` for anything the engine synthesises), licence, approval and loudness. Lift the block only for ledger assets, with a test proving an unapproved asset is still refused. Then a deterministic sonification module that maps device events to sound, mastered to the existing -14 LUFS and -1 dBTP targets. Every sonified meaning is also visible, so no reader needs sound.

**Degraded mode.** The sting and the subchannel motif play on every piece; sonification scales with the graph and never fails for lack of data.

**Done when.** An unapproved asset is refused by test; every corpus piece renders its sonic layer; Krish approves the sounds by ear.

#### P5. The panel stamp

**Intent.** Make the machine's judgement visible on every piece. `NOW.md` names the objection this answers: "AI content is slop." The stamp shows the panel's median score and one line of its strongest dissent, and shows Krish's override when he made one. Candid and slightly wry, never boastful.

**Build.** A stamp component in three sizes (Substack header image with alt text, the Short's last frame, the last carousel slide), fed only from `SignatureInputsV1.panel`, which comes from `panel_runs`, `judge_verdicts`, `content_ideas.meta.ladder` and Krish's recorded decision. Median scoring is the rule Krish validated (`79c68e7`). The dissent line is rewritten for readers by `krish-voice` and checked against the verdict text so it never says something a judge did not say. Nothing on the stamp may expose an item on the `never_publish` list in `NOW.md`.

**Universality requirement.** Every published piece must have a panel run on its approved revision. Add this to the package step's checks: no panel run, no pack. Pieces that start as Krish's own ideas go through the panel like any other.

**Degraded mode.** If no judge recorded a substantive dissent, the stamp shows the score with "The panel had no serious objection," which is itself a claim that must be true in the records.

**Done when.** Every corpus piece with a panel run renders a stamp whose score equals the recorded median by test.

#### P6. The Call and the Calls scoreboard

**Intent.** Every piece puts one falsifiable call on the record, with a date and a confidence, and every call is tracked on one public scoreboard for the whole publication. Misses are shown as plainly as hits. For a sceptical senior reader, a writer who keeps score in public earns a kind of trust nothing else earns, and the record compounds with every piece.

The call takes the subchannel's shape:

- mind.the.gap: what the pattern means is coming, by when.
- split.the.bill: who will be better or worse off, or where a price or budget will move, by when.
- lift.the.lid: whether the approach will spread, hold or break, by when.

**Build.**

1. A `calls` table (migration under `supabase/migrations/`): piece id, subchannel, statement, resolve-by date, confidence, settling evidence, status (open, hit, miss, void), resolution note with source, resolved-by. Resolution is Krish's decision, recorded with `decided_by: 'Krish'`. The engine proposes resolutions with evidence and never resolves one itself.
2. A Call check in the drafting checks: the call is falsifiable, dated, within a stated horizon, and follows from the piece. A piece whose call fails returns to `revise`.
3. A read-only public CSV route on the control plane exposing only calls from published pieces and nothing on the `never_publish` list. Guard it like the other read routes, and never expose the database directly.
4. One Datawrapper scoreboard linked to that CSV, embedded in every post. When a call resolves, the chart updates across the whole back catalogue without a republish. Verify Datawrapper's refresh behaviour and plan tier at build time.
5. A Control Center reminder for calls nearing their date.

**The mandate question.** Mandates live in `venture_formats.mandate` and only Krish changes them. Making the Call universal means he adds it to all three mandates. Until he does, the Call check cannot be enforced, and the pack cannot go live, because P6 is a required component.

**Degraded mode.** None. A piece without a defensible call goes back to drafting. This is deliberate: it raises the bar on every piece.

**Done when.** The scoreboard is embedded, changing a test row's status updates it without a republish, and the Call check has run on every corpus piece.

#### P7. The flipbook carousel

**Intent.** The swipe is the motion. The carousel is the signature device played one frame per slide, so swiping performs the animation. Every slide must also read on its own, because people stop swiping.

**Build.** A `flipbook` mode in `config/carousel-visual-direction.json` and `packages/core/src/carousel.ts` that renders consecutive slides from the device's animation timeline at fixed frame steps, with exact registration between slides. Cover from P2, last slide with P5 and P6. Slide count within the carousel director's range unless Krish approves more; check each platform's current limit at build time. Packages for Instagram (PNG), TikTok photo mode (new) and LinkedIn (PDF, used only when Krish shares a piece personally). Nothing posts itself.

**Degraded mode.** A small graph produces fewer slides, never fewer than the minimum Krish approves.

**Done when.** Every corpus piece renders a flipbook in which each slide passes a standalone legibility check.

#### P8. The Substack package

**Intent.** Long-form with rhythm, good as a static email and better on the web. Never a wall of text, never decorated.

**Build.** An extension of the existing `substack` channel cut: the post body, the header GIF (P2), two device GIFs at the piece's key moments (P3), the stamp (P5), the Calls scoreboard embed (P6), any Datawrapper charts the piece needs, the link to the lab page (P9) and the audio edition (P10). GIFs are short loops with modest file sizes; verify Substack's current upload limit and test in the major email clients. Datawrapper is called through its API with the credential held by symbolic name at runtime. The engine produces the package; Krish posts it.

**Degraded mode.** A piece with no chartable data carries only the scoreboard embed.

**Done when.** Every corpus piece produces a package, and a test email to Krish's own inbox shows the GIFs animating.

#### P9. The lab page

**Intent.** Substack cannot host interactives, and the North Star asks "how and when we should make interactive artifacts." The answer this document proposes: always, in one form. Every piece gets a lab page where the reader can operate its signature device: hover a money flow to see its source, drag through the constellation's threads, pull the exploded view apart. Because the device is a pure function of its graph, the lab page is the same code made interactive, with no bespoke build per piece.

**Build.** One page template per device at mindmake.co/lab/[piece] (hosting is Krish's decision, section 7), generated from `SignatureInputsV1`, with every element linked to its source. It follows the site's existing publishing rules and exposes nothing on the `never_publish` list.

**Degraded mode.** None needed; the lab page scales with the graph like the device.

**Done when.** Every corpus piece generates a working lab page.

#### P10. The audio edition

**Intent.** Every piece in the podcast feed, in Krish's voice, with the panel as a character. Krish reads the argument, the panel sting plays, and he reads the panel's strongest objection and answers it. The device's sonification is the sound design.

**Bound by two constraints.** Synthetic speech is prohibited in the Studio (`docs/STUDIO.md`, `docs/ARCHITECTURE.md`), so every word is Krish's. And because this runs on every piece, it has to cost him very little time or it will become the bottleneck that stops publishing. So the format is fixed and short: a 5-minute script generated from the approved draft, read in one take from a recording brief, with the sting and sonification added automatically.

**Build.** Extend the `podcast` channel cut into a fixed-length audio script with a marked "panel's turn," built from the recorded dissent. A recording brief with cue points. An automatic mix of his recording with approved ledger assets at the existing loudness targets. The Studio has no podcast mode; prefer a simple audio path unless the Studio's gates add real value.

**Degraded mode.** None beyond the fixed format.

**Done when.** A pilot on a walk piece is recorded, mixed and approved by Krish by ear, and his recording time for it is measured and written down.

### 5.4 Publication rituals (outside the pack)

These are recurring and not per-article. They reuse pack components.

**R1. Panel Night (Substack Live, monthly).** Krish runs the blind panel live on five candidate ideas; viewers vote in chat before each reveal; he makes the final call on air. It uses P5's stamp and P4's sting. The reveal view is a Control Center view or a lab page (no second dashboard, `AGENTS.md`). The recording goes into the audio feed and each reveal becomes a Short candidate. Only what Krish states in words is recorded as his decision; audience votes are audience data. Start after four or five pieces are published, so the audience has context.

**R2. The cutting-room floor (Substack Notes).** Short Notes drafts about ideas the engine killed, with the score and one line on why, written through `krish-voice` and checked for the `never_publish` list and for any client or guest name. A queue Krish posts from or skips.

---

## 6. The corpus test: how "bulletproof" is proven

Before the pack's switch turns on, and again before any change to a pack component merges:

1. **Corpus.** Every piece in the database that has a draft, plus the three walk pieces, plus synthetic edge fixtures committed to `fixtures/` (the smallest legal graph for each subchannel, the largest, a piece with no numbers, a very long title, a piece with no substantive dissent).
2. **Run.** Extract `SignatureInputsV1` for each, then build the full pack.
3. **Report.** For each piece and component: rendered in full mode, rendered in degraded mode, or failed, with the reason. For extraction: which pieces failed their minimums, and why.
4. **Pass bar.** Every component renders in full or declared degraded mode for 100% of pieces whose extraction passes. Pieces whose extraction fails must fail for a reason that is a genuine draft problem, confirmed by reading them. Two runs of the same corpus produce identical outputs.
5. **Budget.** Record render time and output size per pack on Krish's Windows machine. Krish sets the acceptable budget once he sees the first numbers.
6. **Krish's review.** He sees the pass report and the approval packet from section 4, step 3, before the switch turns on.

Add the corpus test to `npm run verify` in a fast form (fixtures only) and run the full corpus as a separate command before a pack change merges.

---

## 7. The order of work

**Phase 0. The gate.** Section 2.

**Phase 1. The spine.** `SignatureInputsV1`, the extraction and completeness check, the `calls` table and Call check (enforcement waits on Krish's mandate change), the audio-asset ledger, and the corpus test harness. Build the spine first: once every format reads from one record, adding formats is safe.

**Phase 2. Identity.** P1, P2, P5. P1 goes first because Krish's series-rename ruling depends on the wordmarks, and that ruling unblocks the brief bridge for all three subchannels.

**Phase 3. The devices.** P3 for all three subchannels, then P4, then P7. All three devices are built before the switch, since the pack runs on every subchannel.

**Phase 4. The hub.** P8, P6's scoreboard, P9, then the P10 pilot.

**Phase 5. The switch.** Full corpus test, Krish's review, switch on. From then on every approved article gets the full pack. Then backfill the pieces published before the switch (section 2), then R2, then R1.

Each phase ends with a line in `docs/STATE.md` saying what shipped, what Krish approved and what waits on him.

---

## 8. Decisions waiting on Krish

Each has a recommendation for Krish to react to. None of these may be assumed.

| Decision | Recommendation | Why |
|---|---|---|
| Subchannel wordmarks and type system | Approve from three rendered territories | Unblocks the series rename and the brief bridge |
| Rename the Studio series to the subchannels | Yes, once wordmarks are approved | The publication has three subchannels; the Studio still speaks the retired two |
| Add the Call to all three mandates | Yes | P6 is required, so the pack cannot go live without it |
| Extraction minimums per subchannel | Start with the values in 5.2, adjust after the corpus test | They decide which drafts are sent back |
| Show panel scores and the dissent line publicly | Yes to both | The proof that answers "AI content is slop," and the most delightful part |
| Synthetic speech for a panel voice | Keep the ban; the panel speaks through the sting and Krish's reading | Protects trust, needs no rule change |
| Audio edition length | 5 minutes, one take | It runs on every piece, so his time is the constraint |
| Where the lab lives | mindmake.co/lab/[piece], with the mindmake.co site | One owned home for every interactive |
| Render and size budget per pack | Set after the first corpus run | Real numbers first |
| Signal & Noise | Leave it where it is for now | Merging an interview show early blurs both |
| Panel Night start | After four or five published pieces | The audience needs context |

---

## 9. How the engine learns from all of this

The rules in `docs/NORTH_STAR.md`, "The rules that make the learning honest," apply unchanged.

- Changes to a pack component are changes to every future piece, so they go through the full corpus test and Krish's approval every time. A component never changes because one piece performed well or badly.
- Feedback on a specific piece's pack (a device layout he disliked, a stamp line he rewrote) is recorded as a `DeviceUsageEventV1` or an edit event with its reason, scoped to that piece. It becomes a proposal to change the component only through the existing weekly aggregation (three confirmed events across at least two jobs and two sessions, no counterexample), and it becomes active only when Krish approves it and it lands in reviewed Git config.
- Platform performance (views, retention, saves, subscriptions) is performance evidence. It is never recorded as taste, and it never changes a rule by itself.
- The one experimental device slot per Short (`config/techniques.json`) stays open on top of the pack. It is where new ideas get tried on single pieces before any of them is considered for the pack.
- Anything learned about the engine while doing this work goes into `docs/STATE.md`, `docs/walks/` or the document it corrects, never only into a chat.

---

## 10. Definition of done

The upgrade is done when all of these are true, each backed by readback:

1. The pack's switch is on and every article approved since then has a full pack, with each component's mode recorded.
2. The corpus test passes at the section 6 bar and runs before every pack change.
3. The Calls scoreboard is live and has updated at least once without a republish.
4. The audio-asset ledger exists and the music block is lifted only for approved assets.
5. The three signature devices are `signature: true` registry entries with tests.
6. `npm run verify` passes apart from the known failures listed in `docs/STATE.md`.
7. Every active taste rule has a recorded approval from Krish.

Report status literally: built, committed, merged, deployed, live and verified are separate states, and each is claimed only with evidence.

---

## 11. What not to do

- Do not ship a pack with a component missing, and do not skip a component because it looks weak on a piece. Use the declared degraded mode, or send the draft back.
- Do not let building the pack delay a piece before the switch.
- Do not change a pack component without the full corpus test and Krish's approval.
- Do not add a second dashboard or a second media source of truth.
- Do not copy the mandate, the voice block or the corpus into code, prompts or documents.
- Do not produce synthetic speech, and do not present generated imagery as evidence.
- Do not post, upload publicly or schedule anything. Krish publishes.
- Do not treat "they all land" as approval of any specific design, sound or rule.
- Do not lift the music block before the audio-asset ledger exists and is tested.
- Do not expose anything on the `never_publish` list in `NOW.md` on any public surface, including the lab pages and the Calls CSV.
