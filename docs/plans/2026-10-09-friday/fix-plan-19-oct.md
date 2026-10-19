# Friday 16 Oct: the fix plan for both cuts (proposed 19 Oct, not built)

**1 of 3.** The three files that go together:

1. **This plan**: what is wrong with Friday's two cuts and how each fault is fixed.
2. `docs/handovers/2026-10-19-codex-friday-cuts-fix.md`: the prompt that has Codex on Krish's PC carry out this
   plan (sections 0 to 3).
3. `docs/handovers/2026-10-19-board-to-content-krishraja.md`: the prompt that moves the publish board to
   content.krishraja.com (section 4 here), so any tool, Codex included, can update it.

Jobs 2 and 3 run in separate fresh sessions and can run at the same time. They meet at the end: once Krish has
watched the fixed cuts and the board lives at content.krishraja.com, the Friday tab is rebuilt with the new cuts.

Krish, 19 Oct: "on the deeper cut, the audio needs to be able to be heard the entire time, but just really low unless
its intro, outro or chapter card. the 90 second video needs to have visuals nearly the entire way through as when
things are sped up, we need to 3-5X the visual clarity. Suggest fixes to both, in entire detail".

Read with `90s-failures-19-oct.md`. Nothing here is built; every choice marked **Krish** is his.

## 0. Before either cut: the fixes both need (from the 19 Oct failures)

1. **Fresh words, heard from the take actually used.** Transcribe the take on the clock it is cut on (the sped take
   for the 90-second cut), then correct only names and spellings against the script. Never cut or caption from the
   17 Oct words files again; both carry mishearings ("again" for "gear", "Opus 5 .5", "C -Class", "mid -2027").
2. **Safe cut points.** Pads of 0.18 s before and 0.25 s after each kept word (now 0.10 and 0.16), and no cut inside a
   word's span. Removals by phrase only, re-checked against the fresh words.
3. **The heard check (new, blocking).** After the render, transcribe the finished file and diff it word by word
   against the take and the script. Refuse to send or record the cut when any word is dropped or clipped, or any
   caption line differs from what is heard. The diff goes in the report.
4. **Review at full size, with sound.** One frame a second at full width (1080 for tall, 1920 for wide) with the
   caption readable, and the heard-check diff read in full, before anything is called done.
5. **Lip sync: the voice drifts ahead of the face (found 19 Oct, measured).** Krish: "my facial movements start
   misaligning with the audio as the video progresses, which is unbearable by the end".
   - *Cause: not proven.* On 19 Oct the cloud session first blamed 54 small holes (0.746 s in all) in the
     timestamps of the joined take (`edited.mkv`). Its own test then showed each part's sound already matches its
     picture to the sample, and that the holes come from the container. The "0.68 s by the end" figure came from
     seeking `edited.mkv` by timestamp, so it measured those same holes, not drift. Do not reuse that diagnosis.
   - *First, measure (no fix before this).* Decode the finished cut and the edited take by frame index and sample
     position (never by seeking timestamps), and measure the offset between his mouth and his voice at 8 points
     from 30 s to 13 min. Use a lip-sync measure (SyncNet or similar) or frame-motion against sound onsets. Also
     check the take itself (`W\takes\...3-minute...mp4`) the same way: the teleprompter.com recording stamps its
     frames unevenly, and the cut lays them 1/24 s apart (`conform_filter` in `make.py`).
   - *Then fix the stage the numbers point to,* and add a blocking check to `make.py`: after the render, sync
     measured at six points, refused if any point is more than 40 ms off, numbers in the report. The 90-second cut
     takes the same path and gets the same check.

## 1. The deep cut: the bed heard the whole time

**What it does now.** `"music_mode": "episode"` (`scripts/quick-edit/music.py`, `episode_windows`/`episode_bed`) plays
the bed under the open, a lift of 1.5 s before to 4 s after each chapter turn, and the close; the talk between has
no music at all.

**The change.** A new mode, `"music_mode": "episode_bed"`:

| Part of the cut | Bed level | How it moves |
|---|---|---|
| Intro (the 3.5 s story intro) | −16 LUFS (approved `intro_lufs`) | as now |
| Under every second of talk | −31 LUFS (approved `bed_lufs`, 17 LU under the voice) | continuous, never silent |
| Each chapter card (its cue window, about 2 to 3 s) | −22 LUFS, **Krish** to confirm | 0.5 s up before the card, 0.8 s down after it (approved ramps) |
| Outro and end screen (19 s) | −18 LUFS (approved `outro_lufs`) | as now |

- **Lift windows come from the chapter cards themselves** (the `fri-chapter-*` cues), not a fixed 1.5 s / 4 s, so the
  music rises exactly while the card is up.
- **Length.** The approved track (`no-curves-instrumental`) runs 3 minutes against 13 min 41 s. Each chapter restarts
  the track from its first downbeat with a 2 s crossfade under the chapter card's lift, so every restart is hidden by
  the card; eight chapters, none longer than about 3 minutes. Option: a second approved track alternating by chapter
  (**Krish**: a new track needs his approval and its licence on the ledger once).
- **Level under the talk.** −31 LUFS is the approved level. Over 13 minutes it may tire the ear; −33 is the
  alternative (**Krish**).
- **Code.** `music.py`: `episode_bed_windows(tl, chapters, total)` returning one continuous window with lifts at the
  chapter cue windows; `make.py`: accept `"episode_bed"`, drop `"music_seconds"` for it. Self-test: the bed is never
  silent for more than 0.5 s between intro and outro; each lift sits on its card.
- **Check in the report.** Bed-only short-term loudness measured every second across the talk: never below −36
  LUFS (audible) and never above −28 except on a card, intro or outro. The voice stays at −14 integrated, true peak at
  most −1 dB.
- **Captions.** The same fresh-words fix (section 0) applies: its captions also came from the 17 Oct words file and
  have not been heard-checked.

## 1b. The deep cut: the car, seen every time it is said

Krish, 19 Oct: "There are also nowhere near enough visuals in the deep cut either of the car analogy".

**Now:** none of the deep cut's cues shows the car. The analogy is the spine of the script (badge, gears, manual,
automatic, paddles) and is said at least eleven times, yet every card is a source screenshot, so the viewer never
sees the picture the words are building.

**The fix: one car system, drawn once, reused at every mention**, so each new car line adds to a picture the viewer
already holds. Built in the house style as a wide (1920 × 1080) card family in `kit.py`: a plain side view of a car
with three labelled parts that light up in turn: **BADGE** (front), **GEAR STICK** (inside), **PRICE TAG** (the
bill). Real logos sit on the badge (Mercedes star, Claude, ChatGPT, Gemini marks, already filed in `logos/`). It is
an analogy, so every card carries a small "an analogy" label.

| Script line (deep script v6) | Card |
|---|---|
| ¶27 "Think of a car. The name of the AI model is like the badge on the front" | The car; the badge lights up; the badge flips through real names: Opus 4.8, Opus 5, Opus 5.5, GPT-6.1 Sol |
| ¶27 "The thinking setting is like the gears" | The gear stick lights up, labelled LOW … HIGH |
| ¶27 "these apps are like a manual car, where you change gear yourself" | Close on the stick with a hand: MANUAL. YOU CHANGE GEAR. |
| ¶27 "In a low gear, it barely thinks. In a high gear, it thinks hardest" | Gear 1 = "barely thinks", top gear = "thinks hardest" |
| ¶27 "The novice argues about BMW's X3 versus Audi's Q5, but the pro is looking at the gear systems beneath" | Two badges side by side, struck through; an arrow down to the gearbox: LOOK HERE |
| ¶27 "most of us drive everywhere in first gear" | The stick locked in 1 |
| ¶29 "changing gear beat getting a new badge" | Two cars: OLD BADGE, TOP GEAR wins over NEW BADGE, LOW GEAR (the Artificial Analysis result in plain words, no bare scores) |
| ¶41 "why the app starts you in a low gear" | The stick in 1 with the app's own default ringed (real screenshot inset) |
| ¶45 "like a car with an automatic transmission" | The stick becomes P R N D: AUTO, with Gemini's real Auto setting inset |
| ¶47 "taken ChatGPT's automatic gear picker away, twice" | D struck out twice, dated: DEC 2025 (free), SEP 2026 (Plus and Pro) |
| ¶49 "what each part of the car is worth … the badge brings attention … the gears decide the bill" | The full car: BADGE = attention, GEARS = the bill (price tag lights up) |
| ¶53 "whoever picks the starting gear decides how hard most people's AI thinks" | A hand on the stick labelled with the company's name |
| ¶65 "change the gear yourself … pick Medium or High … effort, so turn it up" | Three real settings screens (ChatGPT, Claude, Gemini) each with the gear-stick icon beside the right option |
| ¶67 Formula 1 semi-automatic, paddles, driver-aid ban | Steering wheel with two paddles: THE AI PICKS, YOU CAN TAKE OVER (the 2004 date shown only once the source is filed and checked) |

That is about 14 car beats, each 3 to 6 s, held while the line is said. They carry the analogy; the source
screenshots that follow each one carry the proof. Note: the line "Think what each part of this car, we're doing
the car analogy" is removed as a retake; ¶49's car beat sits on the clean read after it.

**Built with:** the same card kinds as the 90-second cut (section 2), one shared car drawing so both cuts look
like one series. **Krish** approves the car drawing once before any beat is made.

## 2. The 90-second cut: visuals nearly the whole way, 3 to 5 times clearer

**Now:** 9 cards cover 44% of the talk; several are page screenshots whose text is unreadable at phone size in the
time they are up; the longest bare stretch is 13.5 s (the whole close).

**Targets (measured in the plan and the report, refused if missed):**

| Measure | Now | Target |
|---|---|---|
| Talk covered by a visual | 44% | 90% or more |
| Longest stretch with no visual | 13.5 s | 1.5 s |
| Visual changes per minute | about 7 | 20 or more (one per spoken line) |
| Smallest text on a tall card | about 20 px (screenshots) | 48 px at 1080 wide; 7 words or fewer a card |
| Ideas per card | often several | one |

Times below are on the finished cut's clock (speech starts at 3.7 s). Each beat is a real thing (a real screen,
logo, chart or quote) or a big plain-words card; any illustration is labelled as one.

| Time | He says | Visual |
|---|---|---|
| 3.7–8.2 | "overwhelmed by the amount of AI models getting released" | Rapid stack of real launch pages, one every 0.6 s: Opus 4.8, Opus 5, Opus 5.5, GPT-5.1, GPT-6, GPT-6.1 Sol |
| 8.3–9.9 | "a new one every single day" | Counter card: "15 new Claude names in 12 months" (filed, P2-04) |
| 10.1–11.8 | "investigated" | The article's sources list scrolling, "54 sources" |
| 12.3–13.3 | "Does it even matter?" | The cover line card: NEW CLAUDE. NEW CHATGPT. DOES IT EVEN MATTER? |
| 13.7–17.1 | "how hard AI thinks matters more than the model name" | Two-word card: HOW HARD IT THINKS (large) over the model name (small, struck through) |
| 17.4–21.0 | "think of it like a car, the name is the badge" | The real Mercedes-Benz star alone, "THE BADGE" |
| 21.0–24.1 | "Opus 5.5 is like Mercedes C-Class" | **The mapping, built in two steps** (Krish's words): row 1 on "Opus 5.5 is like": [Mercedes star] MERCEDES = CLAUDE [Claude logo]; row 2 on "C-Class": C-CLASS = OPUS 5.5. Held 3 s. **Krish** approves the layout before it is drawn |
| 24.5–27.9 | "how it thinks is like the gear. first, second, third gear" | ChatGPT's real thinking selector (help page capture): the ring steps Instant → Medium → High on "first, second, third" |
| 27.9–29.9 | "AI tools are like a manual car" | Claude's real effort menu (low to max), "YOU PICK IT" |
| 30.1–32.1 | "a business owner called Sally" | Name strap card: SALLY, SMALL BUSINESS OWNER (labelled "an example") |
| 32.5–36.0 | "checks her business deal with a vendor, sounds kind of short" | Labelled illustration: a chat reply "Looks fine to sign." in 4 seconds |
| 36.0–38.2 | "misses a costly hidden rule" | The same, a clause ringed in red: "auto-renews for 3 years" (illustration) |
| 38.3–42.3 | "never stopped to think ... never changed the AI's gear" | The real selector, ringed on Instant: "SALLY'S SETTING" |
| 42.7–48.8 | the test result | The Artificial Analysis chart as a plain comparison: "THE NEW ONE IN ITS LOWEST GEAR LOST TO THE OLD ONE IN TOP GEAR", no bare numbers |
| 49.4–51.6 | "why do these tools start you in lower gears?" | Question card: WHY START YOU LOW? |
| 51.9–57.2 | "thinking costs AI companies money, but you pay the same subscription" | Altman's real post ("losing money on openai pro subscriptions"), then "$200 a month, same price" |
| 57.2–62.9 | "say mid-2027 ChatGPT's free plan" | Dated call card: BY MID-2027 |
| 62.9–67.3 | "will start you in automatic and ChatGPT will pick how it thinks" | Google Gemini's real "Auto" setting (already shipped), "CHATGPT NEXT?" |
| 67.7–72.7 | "easy always beats manual ... 85% sure" | Confidence meter: 85% |
| 72.8–76.4 | "sources are free, and the articles at makeyourmindup.ai" | The article page with its URL |
| 76.8–80.9 | "control how your AI thinks, or would you rather not bother?" | YES / NO card (the outro's question, brought forward) |

That is 22 beats in 77 s, every one at least 1.5 s, coverage about 95%.

**What has to be built for it:**

1. **New tall card kinds** in `scripts/quick-edit/kit.py` (house style, Anton / Archivo / IBM Plex Mono, mind.the.gap
   coral): a key-words card (up to 7 words, 120 px and up); a mapping card (two rows, logo = logo, each row on its own
   cue so it builds on the words); a step card (one real screenshot, a ring that moves across its options on named
   words); a meter card. Each drawn at 1080 × 1000 inside the tall panel box.
2. **Cue pages on words.** The existing `pages` field splits a cue's window evenly; add `"on"`: a list of phrases
   so each page (each ring step, each mapping row) changes on the word it belongs to.
3. **Coverage gate in `make.py --plan`.** Refuse a tall cut with under 90% coverage, any gap over 1.5 s, or a card
   whose smallest text is under 48 px; print the bare stretches with their words.
4. **Fresh words and the heard check** (section 0).

## 3. Order of work (one fresh session, from `docs/handovers/`)

1. Section 0, items 1 to 3 and 5 (lip sync first: measure it, then fix it), as engine changes with
   self-tests.
2. The car drawing to Krish; then the deep cut's car beats (1b) and `episode_bed`, then a re-render (about 21 minutes in the cloud since 19 Oct), heard check, full-size
   review.
3. The 90-second card kinds, the mapping layout to Krish, then the 22 beats, the coverage gate, render, heard check,
   full-size review.
4. Library, record, boards only after both pass and Krish has watched them.

## 4. The publish board, any tool (decided 19 Oct, not built)

Krish, 19 Oct: "yes lets move the board to content.krishraja.com". The work is in file 3 of 3,
`docs/handovers/2026-10-19-board-to-content-krishraja.md`; this is the summary. Today the board is a
claude.ai artifact: its HTML is built by `scripts/post-pack/week_board.py` and its ticks live in that artifact's own
store, which only a Claude session can read or write. To move it: (1) a Control Center route serves the same built
HTML behind Krish's login; (2) ticks move to a Supabase table behind a guarded Control Center API, with the existing
artifact ticks copied across once; (3) `week_board.py` publishes there and the making skills read ticks from there.
That is work in `krishanraja/control-center`, a new public-facing address and a database change, so each step needs
Krish's yes. The address is content.krishraja.com (Krish, 19 Oct), on the Control Center project that already
serves controlcenter.krishraja.com.

## 5. Where it meets

When both jobs are done: rebuild the Friday tab with `week_board.py --target web`, with the new cuts' library links
in `docs/plans/2026-10-09-friday/words.json`, check it in a browser as Krish opens it, and publish it with his yes.
Until the web board exists, the claude.ai boards in `config/boards.json` stay the live ones and only a Claude
session can update them.
