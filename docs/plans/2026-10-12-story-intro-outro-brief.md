# The story intro, audio treatment and outro card: the design brief

Written 2026-10-12 for house rule `STORY_INTRO_OUTRO` (`config/story-intro-outro.json`,
`produce-video` step 4). Nothing here is designed yet. A session that picks this up
runs the process at the end of this file, shows Krish one rendered synthesis cold
(`krish-design`), and records nothing as approved without his own words.

The brief below is given, word for word, to each of three independent concept
makers (three subagents), each with one territory from "The three territories".

---

# Brief: the story intro, audio treatment and outro card (makeyourmindup videos)

## The outcome
Every makeyourmindup video, in both sizes, gets three things made for its own story:
1. An animated, branded **story intro** (about 2.5 to 4 seconds) that plays before Krish's face comes in and tells a viewer, in pictures, what this specific story is about.
2. An **audio treatment** across intro, voice and outro.
3. An animated **outro card** (about 4 to 6 seconds) made for this piece.

Krish's words (2026-10-12): "when the videos come back bear in mind that I want a proper animated branded intro to this specific story visually, the audio treatment, and then a proper animated outro card. Across all formats, and this should be part of the system moving forward."

This must work as a SYSTEM: one structural template that holds across every story and the three weekly series, with the story-specific content and the series colour varying. Design it for Monday's story first, and show how the same template would carry a different story.

## Monday's story (the first one this ships on)
- Series: follow.the.money (Mondays). Series colour #FFD84D (yellow). Other series: under.the.hood (Wednesdays) #B7A6FF lilac, mind.the.gap (Fridays) #FF6A4D coral. Brand mint #7FE3B4 / #7EF0C0. Ink #0C1512 / #070D0B. Cream #F4EFE4.
- Brand: the wordmark "MAKE YOUR MIND/UP" (makeyourmindup), set in Archivo Black style heavy condensed caps; "UP" in mint. Fonts in the repo: Archivo / Archivo Black (scripts/quick-edit/fonts, apps/renderer/src/house/fonts.css).
- Title: "Warner sued Suno. Now it takes a cut. Who else gets paid?"
- Krish's spoken opener (said on camera, right after the intro): "Here's what you need to know about how money is changing because of AI. I'm Krish."
- The fact-checked script: docs/plans/2026-10-12-draft-script.md (3-minute) and docs/plans/2026-10-12-draft-script-90s.md. Use ONLY facts in those files. Never invent a number, date, quote or outcome.
- The script's close (the outro follows it): "The full story, with every source, is free at makeyourmindup.ai. Tell me in the comments: should a singer get paid when an AI learns from their song? Make your mind up."
- Companies named: Suno (the AI app that writes and sings you a song), Warner Music, Universal Music, Sony Music. House rule: a visual that names a company shows its REAL logo from its own brand files, never redrawn. Real logos are embedded as images in Monday's publish page, https://claude.ai/artifact/QpGeGjaqZwvyXwRnSadqyS (the session saves it with an Artifact read and gives you the file; extract the data: URIs or <img> sources you need; config/logo-registry.json lists domains). If you cannot find a real logo file, show a clearly labelled grey placeholder box with the company name and say so in your spec. Never draw a fake logo.

## What Krish rejected before (failure signals, not a design to copy)
On an earlier brand sting he said: "it's ok, it's a bit boring and colourless and vanilla - and just what Powerpoint would do in 2008". So: no generic slide transitions, no swoosh-and-fade, no centred-title-on-a-gradient, no stock "news intro". It must feel bold, colourful, current, physical and made for THIS story. He also rejects cramped density, cartoon faces, mascots, gradient-mesh heroes and glassmorphism.

## Hard constraints
- Sizes: 16:9 at 1920x1080 (YouTube, Substack) and 9:16 at 1080x1920 (Shorts, TikTok, Reels). In 9:16 keep key content inside the safe zone (top 220px and bottom 420px are covered by platform UI).
- 30 fps. Must be buildable later as a Remotion composition (React + CSS + SVG + images, deterministic per frame; no live video, no 3D engine). For this mock, write plain HTML/CSS/JS that animates on a timeline you control (use requestAnimationFrame with a time variable so a frame at time t is deterministic).
- Readable by a 12-year-old in one glance: few words on screen, big type, plain words. No em dashes anywhere. Sentence case for any sentence. Never "I made this with AI" or any AI-disclosure line. The outro never says "I'm Krish".
- Audio treatment: describe it as a cue sheet tied to your timeline: the music bed (licensed library, config/music-library.json in the repo, do not pick a track that is not listed there; you may describe the character wanted), its level at each moment (loud under the intro, ducked low under Krish's voice, rising into the outro), and any sound design hits synced to visual beats (describe them; no audio file needed). Show the cue sheet visually in the mock, aligned to the timeline.

## Deliverable (put everything in your own folder, which the session names: <its scratchpad>/story-io/<a, b or c>/)
1. mock.html: ONE self-contained page (inline CSS/JS, images as data URIs, Google Fonts allowed via link). It shows the 16:9 and 9:16 intro side by side (scaled to fit the screen), then the outro card in both sizes, playing in sync, with: Play from start, Quarter speed, and a scrubber. Under it, the audio cue sheet aligned to time. Under that, one small panel showing how the same template carries a DIFFERENT story (Friday's mind.the.gap story "Why are there suddenly so many AIs?" in coral), so Krish sees it is a system. Keep the page itself plain and quiet so the video frames are the star. The page must work at 400px wide (no horizontal scroll) and on a laptop.
2. Contact sheets rendered from your page with Playwright (Chromium at /opt/pw-browsers, see PLAYWRIGHT_BROWSERS_PATH; do not run playwright install): sheet-intro-wide.png, sheet-intro-tall.png, sheet-outro-wide.png, sheet-outro-tall.png, each a grid of about 12 frames at even times with the time stamped on each. Look at them yourself and fix anything broken, cramped, cut off, illegible or ugly before you finish.
3. spec.md (short): the governing idea in one sentence; the frame-by-frame timeline (seconds) for intro and outro; what stays constant across stories and what varies; the audio cue sheet as a table; which real logo files you used; anything you could not do.

Return as your final answer: the folder path, the one-sentence governing idea, and anything unfinished.


---

## The three territories (one per concept maker)

Each maker gets the brief above plus one of these, and the instruction: do not
modify the repository, do not publish, upload or send anything, work only in
your own folder.

- **a. The money trail as a physical document.** The story is told as a
  payment or statement being produced in front of the viewer: lines arrive,
  names and real logos stamp onto it, the question "who gets paid?" lands as
  the unresolved line. The outro card closes the document (the sign-off, the
  next issue, where to read the full story). Bold, colourful and tactile,
  never a dull receipt.
- **b. The story's own subject as the motion engine, driven by sound.** The
  intro is built from what the story is about (for Monday, a song: a
  waveform, a track, a beat), and the visuals cut on the beat of the music
  bed so the audio treatment and the picture are one design. Big type that
  hits on the beat; the real logos arrive as beats. The outro resolves the
  track (its credits roll as the call to action). For another story the
  subject changes (for Friday's "so many AIs", a menu or a list), the
  beat-driven structure stays.
- **c. The cast and the stand-off.** The story's players (for Monday: Suno
  against Warner, Universal and Sony, with their real logos) are introduced
  like a fight card or a line-up, with a clear state change (Warner switches
  sides: it now gets paid), ending on the open question. Big flat colour
  fields in the series colour, hard cuts, split screens, no gradients. The
  outro is the "next round": where to read the full story, the comment
  question, and the next episode's series. For another story the cast
  changes, the template stays.

## The process (krish-design, "Fresh divergence is blind; judging is historically informed")

1. Run the three makers in parallel (a workflow or three background agents).
   The first attempt, on 12 October, was stopped unfinished when its session
   closed; nothing from it was kept, so start fresh.
2. Two fresh judges, each blind to the other, get the three finished
   concepts anonymised and in independently shuffled orders, this brief, and
   Krish's rejection of the first sting ("it's ok, it's a bit boring and
   colourless and vanilla - and just what Powerpoint would do in 2008",
   `config/intro-sting.json`). They score each on: lands Monday's story in
   one glance; bold, colourful and current (not 2008 PowerPoint); works as a
   system across stories and series; readable by a 12-year-old; real logos,
   no invented facts; both sizes inside safe zones; buildable as a Remotion
   composition; the audio cue sheet fits the music rules (high intro, low
   under the voice, rising outro). If they disagree on the winner, a third
   blind judge breaks the tie. If the three concepts are not different on at
   least two of sequencing, structure, interaction or state model, reject
   the set and run one more round aimed at the missing territory.
3. Render one synthesis from the winner (grafting the best of the others),
   check it at 400px and at laptop width, and publish it as a private
   artifact. Show it to Krish cold: no rationale and no change log until his
   first reaction. Also still pending with him: the second intro sting
   design, https://claude.ai/artifact/FnDVNoCk1CqxGKTHRYENKH; say how the
   story intro and the sting fit together (one after the other, or the
   story intro carrying the brand itself).
4. On his approval in words, record it in `config/story-intro-outro.json`
   (status, his exact words, the date), build the compositions in
   `apps/renderer` the way `scripts/quick-edit/intro.py` handles the sting
   (a source hash and an approval tied to what he saw), and only then can a
   home computer produce Monday's cuts (`produce-video`).
