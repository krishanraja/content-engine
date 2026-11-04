# Failure report: Thursday 5 Nov "No spending, no sending" (killed 4 Nov 2026)

Krish, 4 Nov 2026: "Okay, this is shit. I'm going to kill this completely. The visuals are tacky. The subtitles are all
over the place typographically." He asked what exactly went wrong, decision by decision, and whether it was session
sprawl, Codex misuse or the engine changing under the work. Short answer: all three, but none of them is the root.
The root is that the piece never had a visual idea. Everything after that was effort spent polishing a cut that could
not be good.

Facts are marked as measured from the repository or this session. Anything not proven is marked "suspected".

## What it cost

- **Three days.** The script was approved and sent to Teleprompter on 2 Nov. The cut was killed on 4 Nov.
- **Commits.** 33 commits on `claude/thursday-no-spending-recut` alone, plus at least 20 more on main for Thursday on 2 Nov
  (devices, cards, art direction).
- **Engine pull requests merged while the piece was in production:** #374, #375, #376, #377 and #380, plus this
  session's own engine edits (listed below).
- **Four separate Critic rounds, all NOT READY:**

  | Round | Captions | Look | Motion |
  |---|---|---|---|
  | 1 | 5 | 4 | (scored with look) |
  | 2 | 3 | 3 | (scored with look) |
  | 3 | 6 | 4 | (scored with look) |
  | 4 | 7 | 6 | 5 |

- **Renders.** At least seven full renders in the 4 Nov session alone, about 20 minutes each with QC. `docs/ve/RUNBOOK.md`
  allows "Maximum 2 fix loops total", so I broke that rule by at least five loops.
- **Codex.** Four cards booked through Control Center on 4 Nov. Three merged (ve-qc-2, ve-motion-5, ve-motion-6, settled
  at 1% each); ve-motion-2 failed twice. On 2 Nov, three device cards (cursor_buddy, logo_orbit, typing_bubble) went
  through the lane three times (v1, v2, v3 polish).
- **Your time.** Gate questions, stills you couldn't judge, and a cut you killed on sight.

## Your three questions, answered

**Session sprawl? Yes.** One session carried the engine heal, the Codex lane, the Codex cards and the re-cut. It ran out
of context and was compacted mid-work. After that I carried decisions forward from a summary, not from the work itself.
The stop hook made me commit after every render, which produced commit churn with no design progress. I also told you
the wrong thing about quick-edit's captions and had to correct it before cutting.

**Improper use of Codex? Yes.** Codex was spent on engine features and QC tooling, not on this piece's picture:
- ve-qc-2 changed where the caption check looks.
- ve-motion-5 added stage depth to the card devices.
- ve-motion-6 put the orbit on the split.
- ve-motion-2 failed twice.

The 2 Nov device cards built a reusable cursor mascot, logo orbit and chat bubble as library features. None of it was
"build the one image that makes this point land". Codex was used as an engine team when the piece needed one designed
plate.

**The engine changing as the session went? Yes, measurably.** While the piece was being made I changed:
- the STAGE background (#380, "light stage"; ink became a cream wash),
- the brand chrome on STAGE beats (StageHeader replaced by mark tile and pill),
- the face-shot caption height (1440 to 1500, outside the band you signed in `docs/ve/MOTION_STANDARD.md`),
- the caption colour on light beats,
- the chat card width (900),
- the headline ground,
- the motion-style ground rule (`lightStage`),
- and a new stills mode.

Every one of these moved the golden frames, so the key-frame check (0.67 to 0.73 against a lock frozen on 3 Nov) failed
by construction for the rest of the piece. I was building the engine and the video at the same time, and each
engine change reset the target.

## The root cause: no idea, only devices

Your favourite video, "Who trains your 2030 seniors" (Monday 2 Nov), was built on one object decided before the storyboard
(`docs/plans/2026-11-02-monday/motion-system.md`, "The Ladder"):
- **One object.** A single career ladder carries every number. Every move means something: the bottom rung thins as 27%
  falls to 9%, and the ladder returns taller with no bottom rung.
- **A never-list.** "No figures or icons acting out a sentence"; "No on-screen words that repeat what he is saying".
- **The real thing shown as itself.** The Anthropic report appears as its own page, with the line highlighted.

Thursday had none of that. Each beat got its own device acting out its own sentence:

| Beat | Device | What it actually did |
|---|---|---|
| "Proactive AI" | a notification card and a cursor mascot with moods (eager, proud, sulk, cool sunglasses) | decoration; the mascot carried no meaning |
| "nobody asked" | a rubber stamp | restated the line |
| "Muse, WhatsApp, Amazon, Google" | a logo orbit | listed the nouns he says |
| "can get dangerous" | a fake boss chat with "Absolutely not, it's my lie-in day" | a joke unrelated to the point |
| "the rule" | NO SPENDING. NO SENDING. in condensed capitals | restated the line |
| "one prompt" | a fake ChatGPT chat I re-typed by hand, a second stamp and a hand-drawn arrow | stood in for the real screenshot |
| close | a settings card and the mascot in sunglasses | restated the line |

Your point is that people are used to asking AI, and now AI will ask you, push you every morning, and edge into
decisions. No beat showed that idea. The two lessons on file that forbid this were both broken:
- **`visuals-add-not-repeat`** (24 Oct), via the restating stamps, cards and headline.
- **`sped-cut-visual-density`** (19 Oct), via picture changes that carry no new idea.

## The microscopic decisions that made it worse

Each of these was a choice I made or carried forward, and each one moved the cut further from the brief.

### The evidence

1. **I didn't use your ChatGPT screenshot.** You had given me the real screen: one prompt, and ChatGPT answering with
   options and preselected boundaries. That screen is the proof of your point. I re-typed three of its answers into a
   fake chat bubble, so viewers saw a mock-up of the evidence, not the evidence.
2. **I cut the prompt itself out of that fake chat** (4 Nov, "drop unspoken prompt row so the card clears the caption
   zone"). I removed the most important line in the video to satisfy a layout check.
3. **I invented an AI question.** I added "Which should need your yes?" as the AI's line. That isn't what ChatGPT said
   in your screenshot. It was a made-up line in a video about proof.
4. **I doubted your product names.** On 4 Nov I asked whether "Muse" was a mishearing of "Meta's". Muse is the assistant
   you compared head to head on 21 Oct (Teleprompter: "Muse vs Grok Bot"). I should have checked my own records first.

### The narrative

5. **I never re-opened the story.** The storyboard signed on 2 Nov was treated as fixed, so every later round polished
   devices inside a story whose visuals didn't carry the point. "AI will ask you" was never put on screen.

### Typography

6. **At least five type treatments shared the screen:**
   - white heavy sans word captions with an outline over the face,
   - dark sans captions on cream,
   - a serif on some caption words ("Proactive", "dangerous", "spending,"; where that serif comes from is suspected,
     not traced),
   - a condensed capitals headline,
   - small monospace labels ("online", "Delivered", "NOBODY ASKED", "ONE PROMPT", "BLOCKED"),

   plus a yellow held title that collides with the mark tile. Nobody owned the type system; each device brought its own.
7. **I moved the face-shot captions to y 1500** so they cleared your face. That broke the signed motion standard and
   pushed them into Instagram's caption zone, and I asked you to approve it from stills.

### Branding and music

8. **The branding was wrong for an off day.** The spec still names `brand.series: "under.the.hood"` with the off.day
   pill and the house end card. You wanted off-day posts neutral, without the Monday, Wednesday, Friday look.
9. **I invented a "light stage" brand treatment** (#380, "one brand treatment") from your 3 Nov note "The branding is
   wrong", then spent three rounds tuning it. It was my guess at what you meant, built into the engine, never checked
   with you.
10. **Off-day music.** Thursday used the same bed as Monday's series video (`no-curves-instrumental`). Off-day pieces
    need their own music.

### How I chose and judged the look

11. **References as rulers.** I picked two Instagram references, one for captions (georgia_la) and one for look and
    motion (jackroberts___). Then I let a Critic score the cut against them on a checklist (30 cuts a minute, a held
    two-line title, an accent glow). I optimised for a scorer, not for your taste. Your own favourite video was never
    consulted until you named it.
12. **The Critic watched stills only.** It never heard the cut, and it suggested a factual "fix" (Muse to Meta's) that
    would have been wrong.
13. **Failing checks became background noise.** `captions.render` failed 33 to 45 of 148 pages on every render, against
    thresholds marked "placeholder, to be measured on Monday 26". I wrote "suspected misread" each time and never
    resolved it.

### Process

14. **I worked render-first.** For two days every design change cost a 20-minute render before I saw it. I added a
    two-minute stills mode only on the last afternoon.
15. **I asked you to judge stills.** You said, rightly: "the stills gave me no clue as to what you're going to produce".
    Stills show layout, not pace, motion or how the words land with your voice.
16. **I chose the motion style late, by trial.** The first, living-ui, zoomed 1.5x and pushed cards off screen; the
    second, hud-terminal, was picked to fix the zoom. Neither was chosen for what this piece needs to show.
17. **I kept the 2 Nov device set because it existed.** The cursor mascot, orbit and chat bubble were treated as sunk
    cost and re-used in every round, whether or not a beat needed them.

## What this tells us

1. **No idea, no production.** A piece with no single visual idea that carries its point should stop before any device,
   card or render. The Monday method (one object, moves that mean something, a never-list, the real artifact shown
   as itself) is the bar.
2. **Show the real thing.** When the proof exists (a screenshot, a report, a page), show it as itself and point at the
   line. Never re-type it into a device.
3. **Freeze the engine during a piece.** Engine changes happen in their own session and their own pull request, never
   while a cut is being judged.
4. **One piece, one session, two loops.** After two render loops, stop and bring Krish the cut, or a question.
5. **Codex makes the piece's named plate, never the engine's backlog, during production.**
6. **Judge in motion with sound.** A 10-second, low-resolution preview of the hardest beats, with sound, replaces stills
   and full renders as the design gate.
7. **One type system.** Captions in one typeface, one weight and one colour. Cards carry only what the voice cannot.
8. **Off days look neutral and sound different.** Off-day posts drop the series chrome and use their own music bed,
   sourced from Epidemic Sound and logged in `config/music-library.json`.
9. **Check Krish's own records before questioning his words.** The Teleprompter folder names, the board and the
   glossary come first.
10. **The Critic is a check, not the brief.** A score against an Instagram reference cannot stand in for Krish's taste.
    Compare against his favourite video first.

These are proposals for Krish to decide; none of them is a standing rule until he says so.
