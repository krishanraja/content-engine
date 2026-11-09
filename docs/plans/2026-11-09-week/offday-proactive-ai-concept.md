# Off-day short "AI will ask you now": the one-diagram voiceover test

Krish, 2026-11-08: "Can you load this as a test concept for one of this week's off-day videos? Figure out where CODEX
needs to be involved and Higgsfield or Runway too". "This" is the study in `docs/REFERENCE_VOICEOVER_JESSERURKA.md`.

Decided (Krish, 2026-11-09): "Pure voiceover, Thursday 12th". The Codex card is written (`docs/ve/cards/w3-thu12-chat-world/ve-t12-1-chat-world.md`, device `chat_world`, style `living-ui`) and not dispatched: the spend waits on his yes.

Status before that: a proposal, not started. Nothing is built, dispatched, generated or spent. The piece's own brief
(`docs/plans/2026-11-05-thursday-no-spending/RESTART_BRIEF.md`) and failure report still bind; this file only fills
in the visual idea the brief asked for, in the reference's grammar.

## What Codex's own attempt taught (archive read 9 Nov)

Krish's archive of the closed Codex session, Drive folder `14EAexp7dixoF-5MptzPC8FBbbP6FuKmm` ("2026-11-09 Proactive AI -
session archive - NOT FOR POSTING"), read 9 Nov:
- Rejected: the UI proof (pale ground, typed input fields, boxed word captions, the screenshot small), "terrible and
  tacky"; then the plane and breakfast opening, "super weak" and "nothing about it looks like it's come from my media
  channel brand engine". His standing ask: "I want to be as wacky and creative as we possibly can to get the
  storytelling and delight of the viewer."
- The take is 63 s, 1080x1920, 30 fps (sha256 3a3aa626...), not the 30 to 38 s estimated below. The screenshot is
  sha256 376dad6d...; Krish also sent it in chat on 9 Nov.
- He says "into its own system" in the take, an overclaim against the screenshot's own words; correct it before a
  final cut (trim it, or Krish re-records the line).
- "Paid" is illustration: no real assistant's mark sits beside it or any illustrative bubble. Marks appear only in a
  row when the voice names Muse and Duet.
- The rules are quiet approval stops, never toy gates or machinery.
- The `chat_world` card carries all of these (`docs/ve/cards/w3-thu12-chat-world/`).

## Why this piece

It is the one off-day video this week (`OUTSTANDING.md`): recorded 5 Nov as `proactive-ai-offday.mp4` in the Video
Engine Inbox, from the Teleprompter script "Thu 5 Nov v2 (punchier) - AI will ask you now"
(`A4C660B2-DDE0-4ECA-8570-9967C2AB3EBB`, read 8 Nov). Its first cut was killed on 4 Nov because it had no visual idea;
the reference's whole lesson is one idea drawn once. Proposed day: Thursday 12 Nov, beside the "AI broke Git" carousel
(Krish decides the day).

## The words (fixed: recorded, approved)

112 words: about 30 s at the reference's 226 words a minute, about 38 s at his usual 175. Because the words are
recorded, two script modules cannot be tested here (`named-metaphor-spine`, `question-turns` beyond the opening
line); they wait for the next script he writes.

## The one object: a single chat thread, travelled like a timeline

One vertical chat thread on near-black with a faint grid, the reference's timeline turned into the thing the piece is
about. The camera travels down it the whole cut, no hard cuts, something new every 1.5 to 3 s. Accent: the house mint
only; red only for the decision made without him.

| Line he says | What the one thread does |
|---|---|
| "You're used to asking AI for things." | His bubble on the right asks; the AI answers on the left. The way everyone knows it. |
| "Now it's going to ask you." | The thread flips: the AI's bubble arrives first, unprompted, and the camera turns to follow it. |
| "Muse, Duet and every assistant coming next will wake up before you do and push you on things every morning." | Asks stack down the thread like morning notifications, each carrying its real assistant mark (Brandfetch, never redrawn), timestamped before 7 am. |
| "Book the flight. Pay the deposit." | The two asks, as bubbles, with the key word in mint. |
| "Handy. Until it starts making decisions for you." | One ask resolves with no tap from him: "Paid", in red. The camera rests on it. |
| "So give it two hard rules today. No spending. No sending." | Two gates drop across the thread, one per rule. |
| "Nothing gets paid and nothing goes out until you say yes." | The two asks slide into the gates and wait, greyed, behind a "yes?" |
| "And you don't even have to write the rules. I asked ChatGPT one question..." | The real ChatGPT screenshot pins to the gate, shown as itself; each chosen line (A, B, C) highlights as he says it. Nothing claims settings changed (the screenshot says they do not). |
| "The prompt's in the comments. I'd paste it in before your assistant wakes up tomorrow." | The camera pulls back to show the whole thread, gates shut; the prompt's first words sit at the foot. |

Never-list: the restart brief's list, plus no new background per beat, no motion with no cue in the voice, no
re-typed screenshot, no series chrome.

## Words on screen

The reference's top phrase with one mint word (`vertical-captions`) repeats the spoken line, which
`visuals-add-not-repeat` forbids. Default for this test: the thread's own bubbles are the only words (they add the
asks, the marks and the times; they are not his sentences). If Krish wants the reference's top phrase tested too, it
is one switch in the spec, and he picks which wins.

## Sound

- **Tight air:** suspected to need no engine change. `ve conform` already cuts each line with 0.12 s room either side
  (`scripts/velib/conform.py`, `PAD_S`), so line-to-line gaps should land near 0.24 s. Measure the gaps on his take
  first; then the one speed at or under 1.12x. He hears the result before anything else.
- **Bed:** an off-day track (F36), `audio.bed.mode: continuous`, tested at `under_vo_lu` -21 against today's level, as a
  test only. The approved levels change only on his word.
- **UI sounds:** one soft tick per arriving bubble and one low thud per gate, from `config/sfx-approved.json` only.

## Where Codex comes in

Codex is the visual asset maker; it never edits the cut (`docs/ve/ENGINE.md`).

1. **The thread-world device (the one real build).** `living-ui` already draws a thread card and typing bubbles; what
   is suspected missing is one persistent canvas the thread grows on, with the camera travelling down it across
   beats (the kit's camera today is the hand-held phone's). Claude writes the card (`ve card`, style `living-ui`, the
   never-list above); Codex builds it in a worktree; `ve verify-card` and a golden-still contact sheet check it.
   F33 and F39: it is built and merged before this piece's storyboard, in its own session and pull request, never
   while the piece is in production. Spend is Krish's approval.
2. **Plate stills, only if a dawn opener is wanted** (below): ChatGPT Images through a Codex imagegen card, 4
   candidates, rejected by machine for any text, logo or face (`docs/ve/design/TEMPLATE.md`, "Images").

Codex is not needed for the screenshot, the marks, the captions, the mix or the edit.

## Where Higgsfield comes in (and Runway)

Generated pictures never stand in for evidence: the screenshot and the assistant marks stay real.

1. **The cover and thumbnail (recommended, allowed today).** One still scene in the off-day covers' manner (they were
   Higgsfield `gpt_image_2_5`, `offday-carousels.md`): a phone face-down on a bedside table before dawn, one
   notification glow leaking out. Stills first, 4 candidates, checked with `scripts/channel_safe.py --shape
   cover_tall`.
2. **A 3 s dawn opener under "wake up before you do" (optional, blocked in ve today).** A Codex still animated by
   Higgsfield for up to 5 s. ve's compile refuses generated plates until Phase 2 (`docs/ve/STATUS.md`), so this beat
   would need the quick-edit fallback or wait. Recommendation: leave it out of the test.
3. **Runway:** not needed. Higgsfield covers both uses, and the Runway connector is not signed in from here.

Every generation is quoted before it runs, logged with `ve ledger <piece> add`, and run only on Krish's yes.

## Order of work, gates as the brief sets them

1. Krish: the day and the route. Answered 9 Nov: Thursday 12 Nov, pure voiceover.
2. Claude: card for the thread-world device; Krish approves the spend; Codex builds it in its own session; merged.
3. Piece session: `ve init`, spec with this idea, `brand.references` naming the jesserurka card (once it is on his
   board) for look and motion; measure the take's gaps.
4. `ve proof` of the hardest beat on his take: the flip plus the "Paid" decision, 10 s with sound. His yes or no.
5. Higgsfield cover stills, on his spend approval.
6. Whole cut, at most two render loops, watched and heard in full, Critic against the reference; then 3 Posts on his
   approval. Never posted by this repository.

## Not checked from this session

- The take itself: `recording.py list` was refused (no engine key in this session), so its words, gaps and whether
  it is to camera are not measured.
- Whether ve can already travel one canvas across beats (suspected not; read from `kit/camera.ts` only).
- Higgsfield credit balance and cost per still.
