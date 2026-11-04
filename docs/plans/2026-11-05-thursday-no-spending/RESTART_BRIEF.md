# Thursday off-day restart: brief and start prompt (4 Nov 2026)

Read `FAILURE_REPORT_2026-11-04.md` in this folder first. The killed cut and its spec stay on branch
`claude/thursday-no-spending-recut` as a record. Nothing from them is reused except the lessons.

## 1. The brief (use it once Krish has recorded the new script)

**Piece.** Thursday 5 Nov, off day. Working title "AI will ask you now". The script is in Teleprompter: folder "Thu 5 Nov
under.the.hood - Give your AI its own house rules", script "Thu 5 Nov v2 (punchier) - AI will ask you now", id
`A4C660B2-DDE0-4ECA-8570-9967C2AB3EBB`. The take arrives in the Video Engine Inbox: `python scripts/post-pack/recording.py get
NAME`.

**The point, in Krish's words (4 Nov):** "people are used to asking AI, whereas now AI will ask you things. Muse, Duet, and
all the upcoming AI assistants will wake up and push you on things every morning. That's great, but it also means it will
suggest things and edge its way into making decisions for you." The fix is two hard rules: no spending, no sending.

**The proof.** Krish's ChatGPT screenshot: one prompt, and ChatGPT answers by asking him to choose his boundaries:
- **A. External communications:** "Approve every individual send".
- **B. Spending and commitments:** "Approve every financial commitment".
- **C. Metered APIs and credits:** "Zero unapproved incremental usage costs".

The recommended option is preselected in each. It is media and never committed, so Krish attaches it to the new session.

Show it as itself, a real screen, with a slow push and a highlight on each chosen line as he says it. Never re-type it into
a device. Truth note: the screenshot says "These selections prepare a policy; they do not change your live account
settings", so nothing on screen may claim the AI changed its own settings. The script says it "wrote the rules itself".

**The pinned comment (exact):** "Create hard boundaries around sending (external comms), spending (money) within this
platform. Give me clear instructions on what I need to do and give me all the options I can choose from to make this as
clear as possible for both me and the tools."

**One visual idea, decided before anything else (the Monday "Ladder" method,
`docs/plans/2026-11-02-monday/motion-system.md`).** Proposed object: one chat thread whose direction flips.
- **The flip.** It opens the way everyone knows it: your bubble on the right asks the AI. On "Now it's going to ask you"
  the thread flips, and the AI's bubbles start arriving first, unprompted.
- **The morning push.** Unprompted asks stack up like morning notifications, each from a real assistant mark (Muse,
  Duet), at the size of a notification, never redrawn: "Book the flight?", "Pay the deposit?".
- **The decision.** On "making decisions for you" one ask resolves itself without a tap ("Paid").
- **The rule.** On "No spending. No sending." the thread locks: those two asks grey out behind a yes.
- **The proof.** The real ChatGPT screenshot, highlighted line by line.
- **His face** carries the hook, the rule and the close.

The new session may replace this idea with a better one, but must have one idea, written down, before any picture.

**Never-list.**
- No mascots, cursors with moods, stamps, scribbled arrows or logo orbits.
- No fake chats standing in for real evidence.
- No on-screen words that repeat what he says.
- No series chrome: no under.the.hood, no day pill, no Monday, Wednesday, Friday look. Off days are neutral.
- No second typeface in captions.

**Type.** One caption treatment: one typeface, one weight, one colour, one position, off the face, inside the platform
safe zone. Cards carry only what the voice cannot: the real screen, the real assistant marks, the one changed word.

**Music.** Off days use **Goodie Bags** (Dylan Sitts, Epidemic Sound), ledger id `goodie-bags`, `for: off-day` in
`config/music-library.json`. Krish approved it in words on 4 Nov. Never use the series bed `no-curves-instrumental`; Monday,
Wednesday and Friday music does not change. The file sits in `00_Brand-Assets > 07_Music` beside NO CURVES, but nobody has
measured it yet. First, on a machine that can read the music folder, run `music.py add` on "ES_Goodie Bags - Dylan
Sitts.mp3" with its licence, then `music.py approve` with Krish's recorded words, then `music.py publish`. Set the spec's
`audio.bed.ledger_id` to `goodie-bags`.

**Route.** Build the way the Monday favourite was built. Pick the route at the start and do not change the engine during
the piece: engine work goes to a separate session and pull request. Codex only for a named plate this piece needs, booked
through Control Center, and only if the idea needs one.

**Gates.**
1. Write the idea and the never-list first.
2. Make a 10-second, low-resolution motion preview with sound of the hardest two beats (the flip and the proof). Send it
   to Krish as a file. Stills alone are not a gate.
3. After his yes, at most two render loops. Then send the cut whatever its state, with one line on what is unresolved.
4. Before sending, watch the whole cut at full size and hear it against the script. Run the fact check on the screenshot
   claim.
5. After his approval, file it in the post's 3 Posts folder and put it on the publish board, ready for scheduling. Never
   post.

## 2. Start prompt for the new session (paste as the first message, with the screenshot attached)

```
Produce Thursday 5 Nov's off-day short "AI will ask you now" from fresh. I have recorded the new
Teleprompter script (folder "Thu 5 Nov under.the.hood - Give your AI its own house rules", script id
A4C660B2-DDE0-4ECA-8570-9967C2AB3EBB); fetch the take with recording.py from the Video Engine Inbox.
The ChatGPT screenshot attached is the proof and must be shown as itself.

Read first, in this order, and nothing else until you have:
1. docs/plans/2026-11-05-thursday-no-spending/FAILURE_REPORT_2026-11-04.md (why the last cut was killed)
2. docs/plans/2026-11-05-thursday-no-spending/RESTART_BRIEF.md section 1 (the brief)
3. docs/plans/2026-11-02-monday/motion-system.md (my favourite video's method; match its standard)

Rules for this session:
- One visual idea, written down with a never-list, before any device, card or render.
- No engine changes in this session. If the engine blocks you, stop and tell me; do not fix the engine here.
- Off day: neutral look, no series chrome, one caption treatment.
- Off-day music is Goodie Bags (ledger id goodie-bags, already approved in my words); measure it
  with music.py add first. Never no-curves-instrumental.
- My first look is a 10-second motion preview with sound, sent to me as a file. Then at most two
  render loops before you send me the cut.
- Never post. After I approve, file to the post's 3 Posts folder and put it on the publish board
  ready for scheduling.
```
