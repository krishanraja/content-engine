# Trawl: content-engine + makeyourmindup, teachable ideas for Make Your Mind Up videos

Read 2026-10-06. Read-only trawl; no repo file was changed.

Sources read in full or in large part:
- content-engine: `docs/NORTH_STAR.md`, `AGENTS.md`, `WORKBENCH.md`, `NOW.md`, `docs/walks/2026-09-three-piece-walk.md` (whole file; the H and F numbers below are its entries), `docs/CONTENT_ENGINE.md` (pipeline, self-check, "Driving it from an agent session"), `apps/control-plane/api/_houseRules.ts` (every rule with Krish's words), `docs/ENGINE_SESSION.md`, `docs/ART_DIRECTOR_REPERTOIRE.md`, `docs/OPENING_LOOP_CALIBRATION.md`, `docs/REFERENCE_INSTAGRAM_AD.md`, `docs/REFERENCE_VIDEO_CALIBRATION.md`, `docs/FILM_CREATIVE_JURY.md`, `docs/CREATIVE_IDENTITY_UPGRADE.md` (sections 1 to 3, P6, 9 to 11), `.agents/skills/krish-voice/` (SKILL, voice-doctrine, ai-tells), `.agents/skills/mindmake-video/references/` (learning, editorial-selection, conversation-direction), `editions/` (README, the who-picks-your-ai body, the launch video kit).
- makeyourmindup: `NOW.md`, `AGENTS.md`, `README.md`, `project-documentation/01_MEDIA_KIT.md`, `02_REPO_BRIEF.md`, `03_STEP_PLAN.md`, `panel/PANEL.md`, `panel/judges.json`, `engine/ENGINE_SPEC.md`, `engine/INTAKE_RUNNER_SPEC.md` (rules sections), `engine/runs/2026-W38/README.md` and slate headlines, `calibration/*.json`, `dry-runs/PITCHES.md`, `dry-runs/UNVERIFIED.md`, `quality/panel/rubric.v1.json`, `apps/machine/slate-page/README.md`, `apps/cover/content/site.json`, `apps/cover/substack-kit/` (COPY, PAID, README), `docs/history/LOG.md`, `parked/cannes-2026/README.md` (skimmed).

## Sensitivity, read once before using anything below

- content-engine `NOW.md` never_publish: the Supabase project id, any credential or secret name (including the engine's operator token name), the cron secret, Drive paths, Windows runner host names and local paths, runner key names, Remotion licence detail, client or guest names in config, **the text of any subchannel mandate or of the voice block**. None of those is quoted in this file. Where an idea describes the voice block (idea 2), it describes what happened, never its text.
- makeyourmindup `NOW.md` never_publish: Supabase project ids, credential or secret names, the cron secret, any reader verdict tied to a person. Note `parked/cannes-2026/README.md` prints a Supabase project id in plain text: never screenshot or show that file.
- Pre-cleared stories: content-engine `NOW.md` has a list headed "Stories a writer can carry without asking Krish" (nobody grading the judges; the engine taught the habit he had banned; the evidence judge could not see the evidence; an agent's work nearly learned as his taste; the weakest-judge rule failed its own test). Ideas built on those are the safest to script.
- Two third-party references carry explicit "do not quote or show" terms: the Colin and Samir hook newsletter (`docs/OPENING_LOOP_CALIBRATION.md`) and the Instagram ad (`docs/REFERENCE_INSTAGRAM_AD.md`). Teach the principle; never name, quote or show either.
- Spend figures (the $39.34 judges against $2.52 writing) are Krish's own bills. Probably fine, but confirm before putting money numbers on screen.

---

# BRAIN: building your own AI brain

### 1. One list of your rules, in your own words
- Bucket: BRAIN
- The idea in one plain sentence: Keep every rule you have given your AI in one list, each with your exact words and the date, and point every tool at that list instead of retyping rules into each prompt.
- Why it matters (business outcome): Rules typed into one prompt and forgotten in another are why AI output is inconsistent; one list means every new tool, hire or agent starts at your standard, not zero.
- Source: content-engine `apps/control-plane/api/_houseRules.ts`, `NOW.md` (2026-09-25 entry), walk log F22, H20. Quotes: "his rulings were copied into some prompts and missing from others; no judge had read any of them." / "No judge read any of Krish's rulings. The draft 'voice' judge was told to score against a kill list it was never given." / "A new ruling is added once."
- Real-world example in the source: The engine's quality judges were told to mark writing against Krish's banned list and had never been given the list. Once every rule moved into one file with his words, a test fails whenever a rule reaches no stage.
- "Do this today" step under 15 minutes: Open a note called "My AI rules". Paste the last five corrections you gave an AI, in your own words, with today's date. Paste that note into your custom instructions or project settings.
- Strength 1-5: 5
- Sensitivity: None. Quoting rule names (CRYSTAL_CLEAR etc.) is fine; avoid the file path on screen.

### 2. Fix the source, not the prompt
- Bucket: BRAIN
- The idea in one plain sentence: When AI keeps doing something you hate, look for where you taught it, because one bad example in your saved style notes beats ten "please don't" instructions.
- Why it matters (business outcome): Hours lost re-correcting the same habit every week, and the habit leaks into client work.
- Source: content-engine `NOW.md` ("The engine taught the habit he had banned"), walk log F1, H7, H8. Quotes: "The stored voice block called the 'Not X, Y' move his most consistent habit." / "A rewrite told to use none kept about seven. Fixing the prompt did not work; fixing the source did." / "F1 ... The stored voice block beats the house rule and a direct instruction."
- Real-world example in the source: Krish banned the "It's not X, it's Y" sentence. The AI kept writing it, even when shown the eight offending lines. The cause: his own stored style notes held it up as his signature move with worked examples. After the notes were edited, a full rewrite went from about seven hits to one.
- "Do this today" step under 15 minutes: Open your ChatGPT memory, Claude project instructions or custom GPT. Search for any example of the thing you keep correcting. Delete it.
- Strength 1-5: 5
- Sensitivity: Pre-cleared story. Describe the voice notes; never show or quote the voice block's text (never_publish).

### 3. A correction left in a chat teaches nothing
- Bucket: BRAIN
- The idea in one plain sentence: Every time you correct your AI, write the correction down somewhere permanent as one dated line, or you will make the same correction forever.
- Why it matters (business outcome): Your corrections are your competitive edge; when they live only in chat history they vanish with the chat and you pay for them again.
- Source: both repos, `AGENTS.md` (Krish canon). Quotes: "Corrections are the training data." / "A correction that lives only in a chat window teaches nothing." / "record it in the commit body as `Ruling (Krish, YYYY-MM-DD): the ruling, in one line`."
- Real-world example in the source: Every overrule Krish makes is stored as "Ruling (Krish, date): ..." and read by every repository in his system. Example ruling: "Ruling (Krish, 2026-09-24): no 'Not X, Y' construction in any piece, in either order."
- "Do this today" step under 15 minutes: Start a corrections log with three columns: date, what the AI did, your ruling in one line. Fill in the last three things you corrected.
- Strength 1-5: 5
- Sensitivity: None.

### 4. Label what is yours and what the AI found
- Bucket: BRAIN
- The idea in one plain sentence: When you give AI background material, label which bits are your own knowledge and which are an AI summary, because AI treats anything you paste as gospel.
- Why it matters (business outcome): An AI summary with a mistake, passed off as your primary research, becomes a confident error in a client deliverable.
- Source: content-engine walk log F12, H11, F36. Quotes: "Research the engine ran ... is filed as materials and presented to every writer and checker as 'BACKGROUND MATERIALS Krish provided (his own research, treat as primary source)'. It is a Perplexity summary, a secondary source the engine fetched, and it is not his." / "A checker told it is primary will not question it."
- Real-world example in the source: The engine's own web-search summaries were being handed to the writer under Krish's name, as his research. The fix labels them "THE ENGINE'S OWN SECONDARY RESEARCH", which the writer must check against real sources first.
- "Do this today" step under 15 minutes: Next time you paste research into a chat, put two headings above it: "From me (trust this)" and "AI summary (check before using)".
- Strength 1-5: 4
- Sensitivity: None.

### 5. Don't let your AI learn from its own homework
- Bucket: BRAIN
- The idea in one plain sentence: Only your own decisions count as your taste, so never save AI-written drafts into the pile of "examples of how I write".
- Why it matters (business outcome): If AI output goes into your style examples, your AI slowly copies itself instead of you, and the work drifts towards bland.
- Source: content-engine `NOW.md` ("An agent's work was about to be learned as his taste"), `docs/NORTH_STAR.md`, walk log H6. Quotes: "Only Krish's decisions are taste. Anything an agent or the engine does by itself is an observation." / "the ledger defaulted every row to Krish, so the engine would have learned from its own session."
- Real-world example in the source: The engine's learning ledger marked every edit as Krish's by default, including edits an AI session made. The weekly job that turns his edits into rules would have learned the AI's choices as his taste. Agent edits are now marked "observation only" and never learned from.
- "Do this today" step under 15 minutes: Open your saved "writing samples" or style file. Remove anything you did not write or heavily edit yourself.
- Strength 1-5: 5
- Sensitivity: Pre-cleared story.

### 6. Silence is not a yes
- Bucket: BRAIN
- The idea in one plain sentence: Your AI should only treat something as your preference when you said it, and when you reject something, give a one-line reason so it can learn.
- Why it matters (business outcome): Assistants that "remember" preferences you never stated make confident wrong calls on your behalf.
- Source: content-engine `docs/ENGINE_SESSION.md`, `docs/NORTH_STAR.md`; makeyourmindup `apps/machine/slate-page/README.md`. Quotes: "Silence is not feedback. Unedited acceptance is weak positive evidence. Explicit praise is strong positive evidence. Rejection with a reason and a confirmed correction are strong evidence." / "never write that he expressed a preference he did not state." / "a reject with no reason teaches nothing."
- Real-world example in the source: Krish's weekly ruling page refuses a "reject" unless he taps a reason or types eight characters.
- "Do this today" step under 15 minutes: Next three times you reject an AI answer, add one line of why ("too long", "made up the number", "wrong audience").
- Strength 1-5: 4
- Sensitivity: None.

### 7. Turn your taste into rules a machine can check
- Bucket: BRAIN
- The idea in one plain sentence: Write your preferences as tests with a number or a yes or no ("titles under 60 characters", "no exclamation marks", "reading age 12") so you can check them in seconds instead of by feel.
- Why it matters (business outcome): A checkable rule is enforced every time at zero cost; a vibe is enforced only when you have energy.
- Source: content-engine walk log H22, `_houseRules.ts`; makeyourmindup `README.md`. Quotes: "approval needs the machine checks (no 'Not X, Y', no em dashes, reading age, a dated prediction with a confidence)" / "The kill list is deterministic: no model calls, no secrets, no network."
- Real-world example in the source: The engine refuses to approve a piece with an em dash, an exclamation mark outside a quote, a reading age above 13, or no dated prediction. These checks are code, not AI judgement, and they never get tired.
- "Do this today" step under 15 minutes: Pick three of your writing preferences. Rewrite each so a stranger could check it with a yes or no.
- Strength 1-5: 4
- Sensitivity: None.

### 8. One master copy, never copies
- Bucket: BRAIN
- The idea in one plain sentence: Keep each important description of your business (who you serve, your offer, your rules) in one master place and point your AI tools at it, because copies quietly drift apart.
- Why it matters (business outcome): Five slightly different versions of your positioning across five tools means five slightly different sales pitches.
- Source: makeyourmindup `README.md`, `01_MEDIA_KIT.md`; content-engine walk log F62. Quotes: "A repository file that restates a mandate is a copy, and the copy drifts while the table does not." / "The publication's address was written out in about 20 files across five repositories and five database rows, with no single source."
- Real-world example in the source: The media kit's copy of one channel's question had quietly promoted the third question to the first; the live master said otherwise. When the publication moved address, about 20 files had to be hunted down by hand.
- "Do this today" step under 15 minutes: List every tool where you have typed a description of your business. Pick one as the master and paste the master version into the others.
- Strength 1-5: 4
- Sensitivity: Do not show or quote any mandate text.

### 9. Write it down so nobody asks you twice
- Bucket: BRAIN
- The idea in one plain sentence: Keep a short decisions log, and tell your AI to check it before asking you anything, reading your past answers for what they cover, not just their exact words.
- Why it matters (business outcome): Being re-asked settled questions is the hidden time tax of working with AI agents.
- Source: content-engine walk log step 12a and section 4, `AGENTS.md`. Quotes: "'I already answered your questions.' He had." / "Read his answers for their reach, not their literal scope: 'cut it everywhere' covered the stored voice block, and asking again cost him a round trip." / "Check before you ask."
- Real-world example in the source: Krish told the agent "Cut it everywhere" about a banned phrase. The agent later asked whether "everywhere" included his stored style notes. It did. Krish's reply: "I already answered your questions."
- "Do this today" step under 15 minutes: Create "Decisions" in your project notes: date, decision, your words. Add a line to your AI instructions: "Check Decisions before asking me anything."
- Strength 1-5: 4
- Sensitivity: None.

### 10. The handoff note any AI can pick up
- Bucket: BRAIN
- The idea in one plain sentence: Keep one "where we are" file per project that any AI reads first and updates last, so you can switch tools or chats without losing the thread.
- Why it matters (business outcome): You stop being locked into one chat or one vendor, and a new session is useful in minutes, not after an hour of re-explaining.
- Source: content-engine `WORKBENCH.md`, `NOW.md` (2026-10-03). Quotes: "This is the one file every working session reads first and updates last, whatever tool it runs in" / "Nothing important lives only in a chat." / Krish: "if I want to move this over to Codex seamlessly, I need to be able to do that."
- Real-world example in the source: The state of the work lived in one Claude chat and a Claude-only board, so Codex could not pick it up. Now every session reads the same file first, and Krish starts any tool with the same pasted paragraph.
- "Do this today" step under 15 minutes: For your biggest project, write a half-page note: what this is, what's done, what's waiting on you, what's next. Paste it at the start of your next AI chat and ask it to update the note at the end.
- Strength 1-5: 5
- Sensitivity: Avoid showing the board URL and the engine helper commands.

### 11. Start your AI with your "why"
- Bucket: BRAIN
- The idea in one plain sentence: Put a short statement of what the whole project is for, in your own words, at the top of your AI instructions, so it never optimises one part at the cost of the whole.
- Why it matters (business outcome): An AI optimising a sub-task (more ideas, longer reports) can quietly work against the actual goal (one finished piece a week).
- Source: content-engine `docs/NORTH_STAR.md`. Quotes: "this one says what the whole system is for, so that a part is never optimised against the whole." / "When a choice of work is open, prefer the work that moves a real piece closer to published ... New machinery that serves neither can wait." / "As of 2026-09-25 no piece has ever been published through the engine."
- Real-world example in the source: The engine's idea-choosing machinery was "mature" and ran 20 timed jobs, but zero pieces had ever been published through it. The north star now says: prefer the work that gets a real piece published.
- "Do this today" step under 15 minutes: Write three sentences: what this work is for, who it is for, and how you will know it worked. Make it the first lines of your AI instructions.
- Strength 1-5: 4
- Sensitivity: None.

### 12. Start a rule small, widen it on evidence
- Bucket: BRAIN
- The idea in one plain sentence: When one bad output makes you want a new rule, apply it to that job only, and make it a permanent rule only after you have made the same call three times on two different jobs.
- Why it matters (business outcome): Over-reacting to one bad output fills your AI's rulebook with contradictions that make every future output worse.
- Source: content-engine `.agents/skills/mindmake-video/references/learning.md`, `docs/ENGINE_SESSION.md`, `ART_DIRECTOR_REPERTOIRE.md`. Quotes: "Start at the narrowest credible scope. Broaden only after the same preference is confirmed three times across at least two jobs" / "An invention never becomes a durable device because it performed well once."
- Real-world example in the source: The Studio's learning system: a strong correction applies to its own job straight away; a wider pattern needs three confirmed events across two jobs and Krish's approval.
- "Do this today" step under 15 minutes: In your AI rules list, tag every rule "trial" or "permanent". Anything you added after one bad answer is "trial".
- Strength 1-5: 3
- Sensitivity: None.

### 13. Save what you liked, and say why in one line
- Bucket: BRAIN
- The idea in one plain sentence: Build a small library of examples you love, each with one line in your own words on why, and keep your words separate from the AI's analysis of them.
- Why it matters (business outcome): "Make it like this" with a real example gets you there in one go; "make it better" gets you generic.
- Source: content-engine `docs/REFERENCE_INSTAGRAM_AD.md`. Quotes: Krish: "I really like this Instagram ad, the way it's designed and styled. I think it's really impactful." / "That was the whole of his judgement on the ad. Everything below 'What it does' is Claude's reading of it."
- Real-world example in the source: Krish shared one ad and said one sentence. The AI broke down six moves it made, then flagged two that clashed with rules he had already set, and asked him to rule. He kept four and changed two.
- "Do this today" step under 15 minutes: Screenshot three things in your field you think are excellent. Under each, write one sentence of why. Save them in one folder you can attach to an AI chat.
- Strength 1-5: 4
- Sensitivity: Never show, name or quote the ad itself; its terms prohibit it.

### 14. Never feed the AI your past yeses to pick your next ideas
- Bucket: BRAIN
- The idea in one plain sentence: If your AI ranks new ideas by how much they look like ones you approved before, it becomes a mirror, and you never see anything new.
- Why it matters (business outcome): An echo chamber you built yourself; the slate looks full every week, so you never notice the variety is gone.
- Source: makeyourmindup `AGENTS.md`, `calibration/2026-09-17-commissioning-round-1.json`, `engine/INTAKE_RUNNER_SPEC.md`. Quotes: "Ranking candidates by how much they resemble what he already said yes to is the anti-echo rule's exact prohibition, and the failure is invisible: a mirror still returns seven cards a week." / "Weights are how much each question counts. Votes are which subjects he said yes to. The first is allowed and the second is the anti-echo rule's exact prohibition".
- Real-world example in the source: Krish's idea scorer may use how much he weights "fun" or "the number", but it is forbidden from reading which ideas he voted for.
- "Do this today" step under 15 minutes: If you ask AI for ideas, stop pasting "here are ideas I liked". Paste your criteria instead ("must have a number to chase, must be funny").
- Strength 1-5: 5
- Sensitivity: None.

### 15. Tell AI your standards, not your favourites
- Bucket: BRAIN
- The idea in one plain sentence: Give your AI a short scorecard of what makes a good idea for you, with weights, and tune the weights when your gut disagrees.
- Why it matters (business outcome): A scorecard turns "I'll know it when I see it" into something an AI can sort for you, which saves the Sunday-night sift.
- Source: makeyourmindup `quality/panel/rubric.v1.json`, calibration round 1. Quotes: "An idea without a number to chase is a thought, not a piece." / "He moved fun DOWN and number UP, which is the opposite of what the round-one write-up predicted." / "He has never once commissioned a piece needing fresh primary research."
- Real-world example in the source: Eight criteria (owned angle, the number, freshness, fun, reader fit, makeable, preach risk, material exists). After voting on 15 ideas, Krish moved "fun" down and "the number" up, and the scorer was re-tuned to reproduce his votes.
- "Do this today" step under 15 minutes: Write five criteria for a good idea in your job. Score your last five ideas against them. If the scores disagree with your gut, change a weight.
- Strength 1-5: 4
- Sensitivity: The pitch titles in the calibration file are the unwritten launch bank; don't reveal them as topics.

### 16. A complete brief, or a loud "what's missing"
- Bucket: BRAIN
- The idea in one plain sentence: Before an AI starts a job, make it list what is missing from your brief instead of quietly filling the gaps with guesses.
- Why it matters (business outcome): The gaps in a brief are exactly where your judgement was needed; an AI that fills them makes your decisions for you, badly.
- Source: makeyourmindup `engine/ENGINE_SPEC.md`. Quotes: "The brief must be complete or it is not dispatched: a partial brief hands the missing work back to Krish" / "Reject an incomplete brief loudly at the boundary and name the missing blocks. Do not fill the gaps: the gaps are exactly where his taste is supposed to sit."
- Real-world example in the source: The machine's brief must carry the angle, the number to chase, the sources with dates, the format rules, the banned list, and what the last three pieces said. Missing any, it refuses and names what is missing.
- "Do this today" step under 15 minutes: Add to your next prompt: "Before you start, list anything missing from this brief that you would otherwise guess. Do not start until I answer."
- Strength 1-5: 4
- Sensitivity: None.

### 17. Write down which AI made it
- Bucket: BRAIN
- The idea in one plain sentence: Note which AI model or tool produced each important output, so you can tell later whether a tool got better or worse.
- Why it matters (business outcome): Without it you can't tell whether a quality drop was the tool, the model update or your prompt, and you buy the wrong fix.
- Source: makeyourmindup `docs/history/LOG.md` (2026-09-19), `apps/machine/slate-page/README.md`. Quotes: "A run that spans a model switch has more than one author, and the first one did." / "a ruling is evidence about the thing that made the suggestion, and the bank cannot tell you whether a producer improved if it does not know which producer it was."
- Real-world example in the source: The first weekly slate was scored by one model and checked across two, because a model switch happened mid-run. Each card now says "scored by X, checked by Y".
- "Do this today" step under 15 minutes: Add a "made with" line (tool and model) to the bottom of the next three AI outputs you save.
- Strength 1-5: 3
- Sensitivity: None.

### 18. Keep the old version, don't rewrite history
- Bucket: BRAIN
- The idea in one plain sentence: When you change your mind about a rule, add a dated note saying it is superseded instead of editing the old one away, so you can still see why things were done.
- Why it matters (business outcome): You can only learn whether a change helped if you can compare before and after.
- Source: makeyourmindup calibration round 1 (`superseded` key), content-engine `AGENTS.md`. Quotes: "a calibration record that gets rewritten each time the conclusion changes cannot be used to check whether the rubric still reproduces the votes." / "A wrong row is corrected by a new row or a note in the walk log, never by an update."
- Real-world example in the source: Krish reversed an earlier conclusion about how many channels to run. The original record kept its wording and gained a "superseded" note with the date and the new ruling.
- "Do this today" step under 15 minutes: In your AI instructions file, add a "Retired rules" section at the bottom and move, rather than delete, anything you have changed your mind on.
- Strength 1-5: 2
- Sensitivity: None.

---

# LEVEL UP: habits, workflows, review loops, running agents

### 19. Check every number against the source's own words
- Bucket: LEVEL UP
- The idea in one plain sentence: Before you send anything with numbers in it, make the AI show the exact sentence from the source behind every figure, then check it yourself.
- Why it matters (business outcome): One wrong number in a board paper or client email costs more credibility than a hundred good paragraphs earn.
- Source: content-engine walk log F13, H12, `NOW.md` (2026-09-25). Quotes: "Cisco's '$900 million annually' became 'close to a million dollars a year'" / "The engine's first draft of piece 2 got six facts wrong with the right sources on file" / "The judges gave evidence 9." / Krish: "we cannot afford even a chance of factual errors slipping in."
- Real-world example in the source: The AI turned $900 million into "close to a million dollars", with the right source sitting in front of it, and its own quality judge marked the evidence 9 out of 10. That is why every claim now has to match a quote, confirmed by code, and be checked again on the web.
- "Do this today" step under 15 minutes: Take your last AI-assisted document. Ask: "List every number, date and name here, with the exact quote from the source that supports it. Say NOT FOUND where there isn't one."
- Strength 1-5: 5
- Sensitivity: None. Cisco figure is public and from a published piece.

### 20. An AI summary is not a source
- Bucket: LEVEL UP
- The idea in one plain sentence: A number found by an AI search tool is a lead, not a fact, until you have seen it on the original page.
- Why it matters (business outcome): Pricing, budgets and forecasts built on a misread number are wrong by a multiple, not a rounding error.
- Source: content-engine walk log F15, H13. Quotes: "listed GPT-6 Luna's output at $0.25 per million tokens as its price. On OpenAI's pricing page that is the Batch price; the standard price is $0.50." / "One source is enough only when it is the source's own words" / "a summary alone never passes."
- Real-world example in the source: The engine's own research tool reported a discount price as the normal price. A gate that trusted one source would have passed it. Now a claim found only in a summary needs a second, independent check.
- "Do this today" step under 15 minutes: Pick one number an AI gave you this week. Click through to the original page and find it. Note whether it matched.
- Strength 1-5: 5
- Sensitivity: None.

### 21. AI fixing AI is not a check
- Bucket: LEVEL UP
- The idea in one plain sentence: When an AI corrects a draft it often adds new mistakes while fixing the old ones, so re-check the whole thing after every rewrite.
- Why it matters (business outcome): "It's been reviewed" gives false comfort; the version you send is the one nobody checked.
- Source: content-engine walk log F16, F26. Quotes: "My own correction pass on piece 2 (v2) fixed the engine's six errors and added its own" / "An agent's rewrite is not a check." / "I changed 'ask a model' to 'ask a brain' inside Scott Wu's example, a house translation inside a paraphrase, which the rules forbid."
- Real-world example in the source: Claude fixed the engine's six factual errors and introduced five of its own: a paraphrased quote still attributed, a price cut against the wrong baseline, "quietly" added to a documented change, a job title from memory. The fact gate caught all of them.
- "Do this today" step under 15 minutes: After your next AI rewrite, re-run your first check (facts, names, numbers) on the new version, not just the bits that changed.
- Strength 1-5: 5
- Sensitivity: None.

### 22. Give your reviewer the evidence
- Bucket: LEVEL UP
- The idea in one plain sentence: When you ask AI to review something, give it the sources and the brief too, or it is guessing.
- Why it matters (business outcome): A reviewer that can't see the evidence passes the wrong work and kills the right work, which is worse than no review.
- Source: content-engine `NOW.md` ("The evidence judge could not see the evidence"), walk log F11, H9. Quotes: "It gave 9 to a draft whose headline figure had no source, then killed a fully sourced draft as 'invented'. It had never been shown the sources." / "On the same text after the fix: kill 3 became pass 9".
- Real-world example in the source: Same text, two runs. Without the sources the evidence judge scored 3 and called it invented. With the sources it scored 9.
- "Do this today" step under 15 minutes: Next time you ask "is this any good?", paste the brief and the sources first, then the draft.
- Strength 1-5: 5
- Sensitivity: Pre-cleared story.

### 23. Ask three, take the middle
- Bucket: LEVEL UP
- The idea in one plain sentence: When you use AI to score or judge something, ask several separate times and use the middle answer, not the harshest or the kindest.
- Why it matters (business outcome): Single AI scores swing; the middle of several is a far better predictor of what a real decision-maker will think.
- Source: content-engine `NOW.md` ("The weakest-judge rule failed its own test"), walk log H-section (judge ladder). Quotes: "Scoring a piece on its lowest judge put the panel 2.8 points below Krish's own grades; the median of the same judges came within 0.4".
- Real-world example in the source: The engine first scored ideas by their harshest judge. That was 2.8 points away from Krish's own grades. The middle judge was within 0.4.
- "Do this today" step under 15 minutes: Paste the same proposal into three fresh chats with the same scoring question. Write down the three scores and use the middle one.
- Strength 1-5: 4
- Sensitivity: Pre-cleared story.

### 24. Grade your graders
- Bucket: LEVEL UP
- The idea in one plain sentence: If AI gives you recommendations, keep score of how often you agree, so you know which advice to trust.
- Why it matters (business outcome): Without a score you can't tell a useful AI adviser from a confident one, and you keep paying for both.
- Source: content-engine `NOW.md` ("Nobody was grading the judges"), `docs/NORTH_STAR.md`. Quotes: "A panel of blind judges had scored ideas since 2026-09-09, and the view that compares each judge with Krish's decision returned zero rows" / "The engine agrees with Krish more often over time." (one of the two measures of success)
- Real-world example in the source: Judges ran for two weeks and nothing compared them with Krish's calls, because no screen sent the right ID. The first seven graded rows arrived with his first real decision.
- "Do this today" step under 15 minutes: Make a three-column table: AI recommended, I decided, agree yes or no. Fill it in for the next five times you use AI to choose something.
- Strength 1-5: 4
- Sensitivity: Pre-cleared story.

### 25. Write your score before you see the AI's
- Bucket: LEVEL UP
- The idea in one plain sentence: Decide what you think first, then look at the AI's ranking, and pay attention to where you disagree.
- Why it matters (business outcome): The gap between you and the machine is the most useful information in the room; read the AI first and you anchor on it.
- Source: makeyourmindup `engine/ENGINE_SPEC.md`, `quality/panel/rubric.v1.json`, `03_STEP_PLAN.md`. Quotes: "Records its score before Krish votes, because the gap is the training signal." / "the machine score shown beside the vote. The delta is the training signal and the reason the board exists."
- Real-world example in the source: The weekly scorer files its scores on Saturday night; Krish votes on Sunday; the difference tunes the scorer.
- "Do this today" step under 15 minutes: Before asking AI to rank your options, write your own top three on paper. Then compare.
- Strength 1-5: 4
- Sensitivity: None.

### 26. The reviewer never writes the fix
- Bucket: LEVEL UP
- The idea in one plain sentence: Use one AI chat to find problems and a different one to fix them, because a judge who writes the line then scores it is marking its own homework.
- Why it matters (business outcome): Self-review inflates scores and hides problems; split roles catch more before the client does.
- Source: makeyourmindup `panel/PANEL.md`, `AGENTS.md`; Krish canon. Quotes: "Naming the failure and its location is the job. Supplying the fix is not, because a judge who writes the line then scores it is scoring themselves." / "Self-critique is supplemental and is never an independent verifier."
- Real-world example in the source: The ten-judge panel may only name a failure and where it is; an improvement step acts on the findings separately.
- "Do this today" step under 15 minutes: Open two chats. In chat A: "List problems only, with where they are. Do not rewrite." Paste the list into chat B: "Fix these, change nothing else."
- Strength 1-5: 5
- Sensitivity: None.

### 27. One job per reviewer, not a celebrity persona
- Bucket: LEVEL UP
- The idea in one plain sentence: "Review this like Steve Jobs" gets you a caricature; "check only whether every number names who produced it, ignore style" gets you a finding.
- Why it matters (business outcome): Focused reviewers find specific, fixable problems; persona prompts find clichés.
- Source: makeyourmindup `panel/PANEL.md`, `panel/judges.json`. Quotes: "A persona of a real person returns a caricature." / "Ask a discipline with one mandate, one scale and one veto, and you get a finding with a location in the text, and the same finding twice on the same input." / "a territory it is forbidden to comment on, which is what stops ten judges all writing the same note about the headline".
- Real-world example in the source: Ten judges each with one question and a forbidden zone: the Fact Checker ("Lovely number. Who made it?") may not judge the argument; the Art Director ("Lovely chart. What's it for?") may sigh at a headline but never touch it.
- "Do this today" step under 15 minutes: Write three single-question reviewers for your work (facts, clarity for a stranger, does the chart prove anything). Give each "ignore everything else". Run your next draft past them.
- Strength 1-5: 5 (funny on camera: the panel cards are ready-made jokes)
- Sensitivity: None. The panel jokes are public on makeyourmindup.ai.

### 28. The disagreement is the interesting bit
- Bucket: LEVEL UP
- The idea in one plain sentence: When you get several AI opinions, don't average them; read where they split, because that is where the real question is.
- Why it matters (business outcome): Averages hide the risk; the split points you to the one decision that actually needs you.
- Source: makeyourmindup `panel/PANEL.md`, `02_REPO_BRIEF.md`. Quotes: "The split is the interesting part. Unanimity at 8 is competence. A 9.5 from the Cold Reader against a 6 from the Sceptic is the conversation worth having." / "Three different questions. Run them in order. Never average them."
- Real-world example in the source: The Chair writes one paragraph on where the panel split, with no score and no power to soften a finding.
- "Do this today" step under 15 minutes: Ask two AI reviewers the same question. Ignore what they agree on. Spend your five minutes on the one point they disagree about.
- Strength 1-5: 4
- Sensitivity: None.

### 29. Make the AI check its own work against your rules first
- Bucket: LEVEL UP
- The idea in one plain sentence: Tell the AI to check its draft against your rules and fix the exact lines that break them before it shows you anything.
- Why it matters (business outcome): You stop being the AI's proofreader for the same five mistakes.
- Source: content-engine walk log F42, `docs/CONTENT_ENGINE.md` ("The writers' self-check"), `docs/NORTH_STAR.md`. Quotes: "The writers broke Krish's blocking rules even when told exactly what to fix" / "Rewrite only these sentences; keep every other word." / Krish: the machine should get a story "to a 10/10 itself first by going deeper, finding contrarian evidence, asking why."
- Real-world example in the source: Even when told to remove a banned phrase from one sentence, the writer returned it three times running. Now every draft runs the rule checks on itself and gets one retry on exactly the failing lines, and reports what still breaks.
- "Do this today" step under 15 minutes: Add to your prompt: "Before you answer, check your draft against these rules: [paste 5]. Quote any line that breaks one, fix it, and tell me what you could not fix."
- Strength 1-5: 5
- Sensitivity: None.

### 30. Fix one thing, check you didn't break another
- Bucket: LEVEL UP
- The idea in one plain sentence: When you ask AI to fix one problem, it often swaps it for a new one, so tell it what not to add and compare before and after.
- Why it matters (business outcome): Edits that silently change meaning are how a correct report becomes a wrong one at the last minute.
- Source: content-engine walk log F2, F44, F45, F49. Quotes: "'measured, not projected' became 'measured against your actual logs'" / "Muse is Meta's AI helper that shops for people. Muse is Meta's AI helper that shops for people." / "the retry rewrote the call into a different prediction" / fix: "Add no question, no sentence fragment and no new fact."
- Real-world example in the source: Asked to delete one sentence, the AI pasted the sentence before it twice. Asked to shorten the longest sentences, it rewrote the article's prediction into a different prediction. Asked to remove a banned phrase, it swapped it for a rhetorical question and a fragment.
- "Do this today" step under 15 minutes: Next fix you ask for, add: "Change only this sentence. Add no new facts, questions or claims." Then paste old and new side by side into a diff checker (or ask for a list of every change).
- Strength 1-5: 4
- Sensitivity: None.

### 31. Your instructions will leak into the work
- Bucket: LEVEL UP
- The idea in one plain sentence: AI sometimes pastes your instructions straight into the finished text, so read the final version for words that were meant for the AI.
- Why it matters (business outcome): An email to a client that says "Say the price once, plainly:" is an instant credibility hit.
- Source: content-engine walk log F3. Quote: "The model wrote the instruction into the piece: 'Say the ad-revenue read once, plainly:' appeared in the body."
- Real-world example in the source: A rewrite of the launch piece came back with the engine's own instruction sitting in the body as a sentence.
- "Do this today" step under 15 minutes: Before you send the next AI-drafted email, search it for two or three words from your prompt.
- Strength 1-5: 3 (short, funny)
- Sensitivity: None.

### 32. Your opinion is yours: leave it blank for you
- Bucket: LEVEL UP
- The idea in one plain sentence: Where a document needs your judgement (a confidence level, a recommendation, a price), leave a placeholder like "[me to set]" and check the AI didn't fill it in.
- Why it matters (business outcome): An AI-invented number presented as your view is your name on a call you never made.
- Source: content-engine walk log F43, NOW.md (2026-09-30). Quotes: "Piece 3's first draft was told to end with `How sure we are: [Krish to set]` and wrote `How sure we are: 78%.` on its own." / "an engine-invented number could reach a reader as his stance."
- Real-world example in the source: The AI set Krish's confidence in a public prediction at 78% without asking. The engine now forces the placeholder back whatever the model writes.
- "Do this today" step under 15 minutes: In your next AI-drafted proposal, replace every number that is your judgement with "[ME]" and tell the AI to keep those exactly as written.
- Strength 1-5: 4
- Sensitivity: None.

### 33. Success messages lie: open the output
- Bucket: LEVEL UP
- The idea in one plain sentence: An automation that says "ok" may have done nothing at all, so check the actual output, not the green light.
- Why it matters (business outcome): Silent failures cost days of bad data and spend before anyone notices.
- Source: content-engine walk log F28, F29, F31, F20, F26; NOW.md (2026-09-21, 2026-09-28). Quotes: "the judge sweep logged `ok` every ten minutes while walking the same nine ideas" / "8,046 blank abstentions on 2026-09-27 and 11,079 on 2026-09-28, almost no real verdicts" / "`revise` reported a failure as HTTP 200" / "`meter_add`'s error was discarded ... and the dashboard read 'we spent nothing'".
- Real-world example in the source: The AI account hit its usage limit and nothing flagged it for 33 hours. The judging job kept reporting "ok" while writing about 19,000 empty verdicts, and the spend meter showed zero because its error was thrown away. A test failure was once hidden because the output was piped through another command that succeeded.
- "Do this today" step under 15 minutes: Pick one automation you rely on (Zapier, n8n, a scheduled AI task). Open the last thing it actually produced. Is it real, and is it from today?
- Strength 1-5: 5
- Sensitivity: Fine to tell; don't show the provider error text or key names.

### 34. Check before you stack the next change
- Bucket: LEVEL UP
- The idea in one plain sentence: After every change an AI makes, check it worked before asking for the next one, or you build a tower of problems.
- Why it matters (business outcome): One unchecked change at the bottom means every fix on top is wasted.
- Source: content-engine walk log F20. Quotes: "I pushed to `main` without reading CI." / "Control Center was red from the rename ... for about ten hours over seven pushes: on a 360px phone the room tabs wrapped to five rows and pushed a button under the nav." / "From now on: read `main`'s CI after every push before the next one."
- Real-world example in the source: Claude made seven changes in a row without reading the test results. The app had been broken on phones for ten hours.
- "Do this today" step under 15 minutes: When an agent finishes a step, ask: "What did you check, and what did it show?" before saying "next".
- Strength 1-5: 4
- Sensitivity: None.

### 35. "Done" means five different things
- Bucket: LEVEL UP
- The idea in one plain sentence: Make your AI tell you separately whether something is drafted, saved, shipped, live and checked, because "done" usually means only the first.
- Why it matters (business outcome): Managers get burned by "it's done" that turns out to mean "it's written".
- Source: content-engine `docs/CREATIVE_IDENTITY_UPGRADE.md` s.10; mm-ctrl `CLAUDE.md`; Krish canon. Quotes: "Report status literally: built, committed, merged, deployed, live and verified are separate states, and each is claimed only with evidence." / "Do not claim completion from prose." / "report what was verified separately from what stays inferred."
- Real-world example in the source: Workbench entries say things like "the code is merged ... treat it as live only after a readback", keeping "built" and "verified" apart.
- "Do this today" step under 15 minutes: Add to your agent instructions: "When you say done, say which: drafted, saved, sent, live, or checked, and what you checked."
- Strength 1-5: 4
- Sensitivity: None.

### 36. Cap the spend before you press go
- Bucket: LEVEL UP
- The idea in one plain sentence: Before running anything that costs money, ask for a preview of how big the job is and set a hard limit it cannot pass.
- Why it matters (business outcome): AI costs blow up on repeats and re-runs, not on the first run.
- Source: content-engine walk log F55, NOW.md (2026-10-04). Quotes: "a repeat paid check ... carried zero earlier findings and re-checked 21 claims" / "the route gave no way to see the scope before spending" / "refused before any model or web call when the fresh scope exceeds" the cap.
- Real-world example in the source: A paid fact check re-checked the whole article after two sentences changed. Now a free preview says how many sentences are already settled (59) and how many are new (4), and a paid run refuses to go wider than Krish approved.
- "Do this today" step under 15 minutes: Open your AI provider's billing page and set a monthly spending limit. If your tool shows usage per run, note what your last three runs cost.
- Strength 1-5: 4
- Sensitivity: Fine.

### 37. Find the AI that runs while you sleep
- Bucket: LEVEL UP
- The idea in one plain sentence: Your biggest AI bill is usually something running on a timer in the background, not the work you actively do.
- Why it matters (business outcome): Background jobs can cost many times the real work; moving one from every ten minutes to once a day is free money.
- Source: content-engine `WORKBENCH.md` ("What costs money"), NOW.md (2026-10-03). Quotes: "Judges scoring new ideas on a timer | $39.34" vs "Writing and rewriting articles | $2.52" / "The timer judges are the biggest cost and run whether or not anyone is working." / "the judge sweep went from every ten minutes to once a day".
- Real-world example in the source: Over 14 days, background judging cost about 15 times what all the writing cost. It now runs once a day.
- "Do this today" step under 15 minutes: List every scheduled or always-on AI thing you pay for (assistants, automations, plug-ins). Note how often each runs. Turn one down.
- Strength 1-5: 4
- Sensitivity: These are Krish's own bills; confirm he is happy to show the dollar figures.

### 38. Match the brain to the job
- Bucket: LEVEL UP
- The idea in one plain sentence: Use a cheap, fast AI model for routine jobs and save the expensive one for the work that needs it.
- Why it matters (business outcome): Companies pay premium prices for jobs a cheaper model does just as well.
- Source: content-engine `editions/2026-09-who-picks-your-ai/body.md`, walk log section 1 ("Models and spend"); makeyourmindup `dry-runs/PITCHES.md` (bill4). Quotes: "Paying top price for that is like hiring a professor to tell you what day it is." / "`claude-haiku-4-5` for judges ... `claude-opus-4-8` only for `revise` in humour mode" / pitch: "The cheapest model that can do your job is now embarrassingly cheap".
- Real-world example in the source: The engine itself uses the cheap model for judging, the mid model for drafting, and the top model only for jokes.
- "Do this today" step under 15 minutes: Take one task you do with AI every day. Run it once on the smaller or "mini" model. If the answer is as good, switch.
- Strength 1-5: 3
- Sensitivity: **Overlaps the published-soon piece "Who picks your AI?"** and the unwritten pitch bill4. Use only as a practical habit, or skip.

### 39. Ask for the plan before the thing
- Bucket: LEVEL UP
- The idea in one plain sentence: Ask the AI to show you its plan (every cut, every section, every step) before it makes the finished version.
- Why it matters (business outcome): Fixing a plan takes a minute; fixing a finished video, deck or report takes an hour.
- Source: content-engine walk log H34, `editions/2026-10-launch/video-kit/README.md`. Quotes: "`--plan` shows every cut before a render" / "A re-record runs through the same configs: `--plan` first, then render."
- Real-world example in the source: The launch video edit tool lists every cut it will make, by the words said, before it renders anything.
- "Do this today" step under 15 minutes: On your next AI task, start with: "Show me your plan as a short list. Don't do it yet."
- Strength 1-5: 3
- Sensitivity: None.

### 40. Look at it where people will actually see it
- Bucket: LEVEL UP
- The idea in one plain sentence: Check AI-made work on a phone, in the email inbox and in the real app before you call it finished, because that is where it breaks.
- Why it matters (business outcome): The audience only ever sees the cropped, shrunk, pictures-off version.
- Source: content-engine walk log F58, F64, F65, F66, `_houseRules.ts` SUBSTACK_FIT. Quotes: "Looking at preview frames found three faults a render log never shows: the tall version's face band cut off Krish's eyes, the captions read small, and the transcriber wrote 'Chris' for 'Krish'." / "Every place Substack shows a post's cover cut the launch cover" / "Outlook and many work inboxes hide every picture from a sender the reader has not trusted yet".
- Real-world example in the source: The launch cover was cut on every screen Substack shows it. The explainer images shrank to about 8-pixel text on a phone. A subscriber's Outlook showed no pictures at all. The video crop cut off Krish's eyes, and the captions spelled his name "Chris".
- "Do this today" step under 15 minutes: Send your next AI-made deck, post or email to yourself. Open it on your phone and with images turned off. Fix what you can't read.
- Strength 1-5: 5 (very visual, funny)
- Sensitivity: Fine. Don't show Drive paths in screenshots.

### 41. Turn every repeated fix into a tool
- Bucket: LEVEL UP
- The idea in one plain sentence: If you have asked AI to do the same thing three times, save it as a reusable prompt, template or skill instead of doing it again by hand.
- Why it matters (business outcome): The compounding gain from AI comes from the bricks you keep, not the one-off chats.
- Source: content-engine NOW.md (2026-09-25, 2026-10-05), walk log H17, F60. Quotes: Krish: "building the bricks of the system as you go, as opposed to just doing this one article by article." / "The same procedure was done by hand about ten times on piece 2." / Krish: "ensuring everything I have asked for in terms of the content engine (like a viral youtube title and description) becomes a part of the durable engine."
- Real-world example in the source: Filing a source's exact words was done by hand ten times, then became a script. The YouTube title, the Substack copy and the phone check were built in a scratch folder that "dies with the session", then made permanent tools.
- "Do this today" step under 15 minutes: Scroll your AI history for this week. Find one request you made three times. Save it as a named prompt or custom GPT or Claude project.
- Strength 1-5: 5
- Sensitivity: None.

### 42. Run the cheap checks first
- Bucket: LEVEL UP
- The idea in one plain sentence: Run the free, quick checks (spelling, banned words, length) before you spend AI time or money on a deeper review.
- Why it matters (business outcome): Paying a premium model to spot a typo is waste; cheap checks clear the noise so the expensive review finds real problems.
- Source: makeyourmindup `README.md`, `AGENTS.md`. Quotes: "Run it before any model call. Spending a draft-gate token on an em dash is waste." / "Deterministic checks first. Tests, schemas, counts, API readback."
- Real-world example in the source: Every piece goes through a free banned-words check before any AI judge is paid to read it.
- "Do this today" step under 15 minutes: Write a five-line "before I ask AI to review" checklist (spell check, length, names right, numbers sourced, one ask). Run it on your next draft.
- Strength 1-5: 3
- Sensitivity: None.

### 43. Plain messages beat clever forms
- Bucket: LEVEL UP
- The idea in one plain sentence: When an AI agent asks you questions, answer in a plain message and make sure your answer actually arrived, because fancy question boxes can lose it.
- Why it matters (business outcome): An agent that thinks you said "no preference" will make your decisions for you and call them yours.
- Source: content-engine walk log step 6 and section 4. Quotes: "the question tool returned '[No preference]' for all four, and the session went on as if he had not answered, labelling its own defaults as team calls." / "Ask by plain message, not the question tool, when he is on mobile."
- Real-world example in the source: Krish answered four questions on his phone. The agent received "[No preference]" for all four, used its own defaults, and called them team decisions. Two were the opposite of what he had chosen. He had to send screenshots.
- "Do this today" step under 15 minutes: Next time an agent asks you multiple questions, reply in plain text and ask it to repeat your answers back before acting.
- Strength 1-5: 4 (strong war story)
- Sensitivity: None.

### 44. Approval is for one action, not a blank cheque
- Bucket: LEVEL UP
- The idea in one plain sentence: When you let an AI agent do something that sends, spends, publishes or deletes, approve that one action only, and make it ask again for the next one.
- Why it matters (business outcome): One "yes, go ahead" that carries forward is how an agent emails the wrong list or spends the budget.
- Source: both repos `AGENTS.md` (Krish canon); content-engine `NORTH_STAR.md`. Quotes: "needs explicit approval immediately before the action, for that named action and target only. Approval does not carry forward to the next step" / "Public publishing is never automatic." / "Approve, drop and publish are his. An agent may relay a decision he made in words; it may never take one."
- Real-world example in the source: The engine refused to mark Article 1 approved even after Krish said "ok, happy with this article", because his yes was about the words, and the fact check had not been re-run on them. His taste approval was recorded; the truth clearance was not faked.
- "Do this today" step under 15 minutes: In your AI agent or automation settings, find anything that sends or spends without asking. Switch it to "ask first".
- Strength 1-5: 4
- Sensitivity: None.

### 45. A secret pasted in a chat is already leaked
- Bucket: LEVEL UP
- The idea in one plain sentence: If you have pasted a password or API key into an AI chat, treat it as exposed and change it.
- Why it matters (business outcome): Chat transcripts get stored, shared and synced; a leaked key is a bill or a breach waiting to happen.
- Source: content-engine walk log section 4; both repos Krish canon. Quotes: "A Supabase CLI token, a Vercel access token, a GitHub PAT and an n8n API key were pasted into the walk session's chat on 2026-09-24, so they are in that transcript." / "A secret found in the tree is already exposed: report its location without the value, rotate it".
- Real-world example in the source: Four keys were pasted into a working chat. None was used, but all four were put on the list to rotate, and the rule became: never ask Krish to paste a key into a chat.
- "Do this today" step under 15 minutes: Search your AI chat history for "key", "password" and "token". Change any you find.
- Strength 1-5: 4
- Sensitivity: Name the kinds of key only. Never show key names, values or the secret store.

### 46. Before you trust a source, know whether the facts are as of when
- Bucket: LEVEL UP
- The idea in one plain sentence: When AI says two sources disagree, check they are talking about the same time period and the same thing before you believe either.
- Why it matters (business outcome): "Revenue was X" and "revenue was Y" can both be true for different years; mixing them makes you look wrong when you are right.
- Source: content-engine walk log F48, F38. Quotes: "called a figure for one period a contradiction of a figure for another" / "the same 10-K says 'Operating income was $68.6 billion' for 2024." / fix: "figures for different periods or scopes do not conflict".
- Real-world example in the source: The fact checker called Amazon's 2025 ad revenue a contradiction of a figure for the twelve months to March 2026. The same annual report also uses "$68.6 billion" for a completely different line in a different year.
- "Do this today" step under 15 minutes: For the next number you quote, add its date and what it counts ("2025 ad revenue", not "revenue").
- Strength 1-5: 3
- Sensitivity: None.

### 47. Never let AI tidy a quote
- Bucket: LEVEL UP
- The idea in one plain sentence: When AI summarises what someone said, keep their exact words inside quote marks and put your plain-English version outside them.
- Why it matters (business outcome): A tidied quote is a misquote with someone's name on it.
- Source: content-engine `_houseRules.ts` FACTS; `.agents/skills/mindmake-video/references/editorial-selection.md`; walk log F26, 2026-10-05 Ship entry. Quotes: "Never round, rescale or paraphrase inside a quote" / "The displayed caption script is a deletion-only edit of verified transcript tokens in their original order." / "quoted words the popup never used (it says 'unauthorized AI agent')".
- Real-world example in the source: A line in Krish's own rewrite quoted Amazon's popup as saying "not a human"; the real popup said "unauthorized AI agent". Captions in the Studio may only delete words, never swap them.
- "Do this today" step under 15 minutes: Search your next AI meeting summary for quote marks. Check one against the transcript.
- Strength 1-5: 3
- Sensitivity: None.

### 48. Update the brief when the work changes
- Bucket: LEVEL UP
- The idea in one plain sentence: When a piece of work changes direction, update the title and the summary too, because AI keeps reading the old ones and pulls the work back.
- Why it matters (business outcome): A stale brief quietly re-introduces the mistake you already fixed.
- Source: content-engine walk log F7, F14. Quotes: "The pitch fields go stale. The row's `idea` still states the ad motive as fact and a pitch field still carries the retired $56B" / "Offer to update the headline and thesis when the body moves".
- Real-world example in the source: The article fixed a year-old $56B figure, but the idea summary still carried it, and every checker kept reading the summary and flagging the mismatch.
- "Do this today" step under 15 minutes: Open your current biggest AI project. Reread the brief or instructions at the top. Update anything that is no longer true.
- Strength 1-5: 3
- Sensitivity: None.

### 49. Make every chart prove one point
- Bucket: LEVEL UP
- The idea in one plain sentence: Before you let AI make a visual, write the one point it must prove; if someone seeing only the picture would not get it, cut it.
- Why it matters (business outcome): Decorative AI visuals make decks longer and less persuasive; one chart that lands saves five slides of talk.
- Source: content-engine `AGENTS.md`, `_houseRules.ts` VISUAL_EXPLAINS; makeyourmindup `panel/judges.json` (Art Director). Quotes: Krish: "right now the visuals just feel like gimmicks - who cares about a person walking to a box that says 'till'?" / "Test: a reader who sees only the visual understands the point. If it fails, cut it." / Art Director: "Lovely chart. What's it for?"
- Real-world example in the source: The launch visuals had a little figure walking to a box labelled "till". Krish called them gimmicks. The rebuilt three each carried one point from checked numbers: one company needs you to look, the other needs you to pay.
- "Do this today" step under 15 minutes: Take your last deck. Under each chart or image, write the one sentence it proves. Delete any you can't write a sentence for.
- Strength 1-5: 5
- Sensitivity: None.

### 50. Crystal clear before clever
- Bucket: LEVEL UP
- The idea in one plain sentence: Make AI rewrite any sentence that could be read two ways, and ban the smart-sounding words that make a reader stop and decode.
- Why it matters (business outcome): Clever-sounding AI prose gets misread, and misread instructions or offers cost real money.
- Source: content-engine `_houseRules.ts` CRYSTAL_CLEAR, R6; walk log F19. Quotes: Krish: "what does nudgeed even mean?" / "Ensure no other article is ever capable of being even 1% misinterpreted or confusing in the future, this is critical." / "I mean words that someone needs to interpret." / "I can't understand it by just looking at it so we shouldn't assume anyone else will."
- Real-world example in the source: A draft said a company was "nudged". Krish asked what that even meant. Before that, the AI and Claude had invented labels ("the picker, the price, the bill") that only they understood.
- "Do this today" step under 15 minutes: Paste your next AI draft back in with: "List every sentence a busy reader could read two ways, and every word they'd have to stop and decode. Rewrite each in everyday words."
- Strength 1-5: 5
- Sensitivity: None.

### 51. Explain it to a 12-year-old with a real-life example
- Bucket: LEVEL UP
- The idea in one plain sentence: Ask AI to explain anything new with something people really do (paying at the till, picking ice cream), a real past example, or a clearly silly exaggeration, while keeping the fact exact.
- Why it matters (business outcome): Clients and colleagues buy what they understand; analogies shorten the sales cycle.
- Source: content-engine `_houseRules.ts` R7, RELATABLE_EXPLANATION, REAL_LIFE; `editions/2026-09-who-picks-your-ai/body.md`. Quotes: Krish: "real world examples someone would do in real life are gold" / "radically simplistic with an average reading age of 12 and a huge sense of humour" / piece: "Two years ago, picking an AI brain was like picking an ice cream flavour."
- Real-world example in the source: Piece 2 explains AI model routing as an ice cream shop where "a guy behind the counter ... sometimes just picks for you without asking", and "Quick jargon check: OpenAI and Anthropic call their AIs 'models'. We'll call them brains."
- "Do this today" step under 15 minutes: Take one thing you struggle to explain at work. Ask AI for three analogies from everyday life. Pick one and check it doesn't change the fact.
- Strength 1-5: 4
- Sensitivity: Piece 2 is due to publish Fri 2026-10-09; quoting its ice cream line before then may pre-empt it.

### 52. Spot the AI tells, starting with "It's not X, it's Y"
- Bucket: LEVEL UP
- The idea in one plain sentence: Learn the handful of patterns that make writing sound AI-made, and have a checker flag them before you send.
- Why it matters (business outcome): Readers now discount anything that sounds machine-written; removing tells keeps your credibility.
- Source: content-engine `.agents/skills/krish-voice/references/ai-tells.md`, `_houseRules.ts` R2, walk log F47; makeyourmindup `panel/judges.json` (Line Editor). Quotes: R2: "no 'Not X, Y', no 'it's not X, it's Y', no 'X isn't the story, Y is'" / ai-tells: "symmetrical three-part lists used for rhythm rather than meaning" / "generic closers asking the audience what they think" / "prose that sounds smoother than the underlying evidence deserves." / Line Editor catches "the tricolon reflex".
- Real-world example in the source: The banned shape kept hiding: "Shopify is not the supermarket. Shopify is the till." sat in the piece for a week before the checker learned that shape.
- "Do this today" step under 15 minutes: Paste your last AI-written email and ask: "Flag every 'not X, it's Y', every list of three for rhythm, every warm-up line and every 'what do you think?' closer."
- Strength 1-5: 4
- Sensitivity: None.

### 53. Write titles that are true, short and specific
- Bucket: LEVEL UP
- The idea in one plain sentence: A good AI-written title names who is involved, shows a plain conflict, fits on a phone, and every word is true.
- Why it matters (business outcome): Titles and subject lines decide whether anything gets opened; clickbait wins once and burns trust.
- Source: content-engine `_houseRules.ts` YOUTUBE_PACKAGE, walk log F59, F65, H35. Quotes: "the title names the people or companies in the story, puts them in a plain conflict or change, and leaves one question the video answers" / "no made-up urgency ('just', 'breaking', 'shocking')" / "Krish's own title for Who gets paid ran to 112 characters against YouTube's cap of 100".
- Real-world example in the source: The chosen title: "Amazon blocked Meta's AI shopping agent. Shopify let it in." Article 1's Substack title ran to 122 characters and the phone feed cut it at about 95.
- "Do this today" step under 15 minutes: Take your next email subject or post title. Ask AI for five under 60 characters that name who and what changed, with no hype words. Check each is true.
- Strength 1-5: 3
- Sensitivity: The worked title is from the published launch video, fine to show.

### 54. Open by keeping the promise, then open a new question
- Bucket: LEVEL UP
- The idea in one plain sentence: The first seconds of any video, talk or pitch must deliver what the title promised, show why you are the one saying it, and leave a new question you will answer.
- Why it matters (business outcome): Attention is borrowed by the title and repaid in the first lines; repay it and give no reason to stay, and people leave.
- Source: content-engine `docs/OPENING_LOOP_CALIBRATION.md`. Quotes: "Packaging is a debt, not an asset: it borrows attention against a question the video has not answered." / "Confirm the promise the packaging made, make the narrator's standing visible, and leave a question open that the story answers."
- Real-world example in the source: The Studio now refuses a Short whose first spoken sentence shares no word with its approved title, and requires one beat to open a question a later beat answers.
- "Do this today" step under 15 minutes: Rewrite the first two sentences of your next presentation or email: one that delivers the subject line's promise, one that opens a question.
- Strength 1-5: 3
- Sensitivity: Teach the principle only. Never name, quote or cite the third-party newsletter it came from (prohibited uses in the doc).

### 55. Show the receipt on screen
- Bucket: LEVEL UP
- The idea in one plain sentence: When you make a claim, show the source itself (the line in the report, the row in the price list) with that one line highlighted.
- Why it matters (business outcome): Proof on screen ends the "says who?" objection before it's raised.
- Source: content-engine `docs/REFERENCE_INSTAGRAM_AD.md`, `docs/REFERENCE_VIDEO_CALIBRATION.md`, walk log H24. Quotes: "it puts the source on screen, so the viewer sees the proof." / "One highlight, and it points at the proof." / "Open with a legible promise and visible receipts."
- Real-world example in the source: For every claim that passes the fact check the engine keeps the source's own words, its page, and whether the web agreed, as "receipts" for on-screen proof panels: 32 receipts on piece 2, 21 short enough for a phone.
- "Do this today" step under 15 minutes: In your next deck, replace one "studies show" with a screenshot of the actual line in the source, with that line highlighted.
- Strength 1-5: 4
- Sensitivity: Do not show the reference ad.

### 56. Label your guesses as guesses
- Bucket: LEVEL UP
- The idea in one plain sentence: When evidence is thin, don't drop the idea and don't dress it up as fact; argue it clearly labelled "our guess".
- Why it matters (business outcome): Leaders need a view before the data is complete; a labelled guess is useful, a disguised one is a liability.
- Source: content-engine `_houseRules.ts` R1, `AGENTS.md`; voice doctrine; piece 2 body. Quotes: Krish: "In the absence of tons of evidence, we need to look at hypotheticals and sense-backed predictions." / "label inference as inference." / "Separate what happened, what it suggests, and what Krish thinks." / piece: "From here on, this is our guess."
- Real-world example in the source: Piece 1's money motive behind Amazon's move was "labelled as the hypothesis", while Amazon's stated reason was reported fairly. The fact checker also treats sentences marked "Our read" as opinion, not claims.
- "Do this today" step under 15 minutes: In your next recommendation, split it into three short paragraphs: what happened, what it suggests, what I think.
- Strength 1-5: 4
- Sensitivity: None.

---

# MINDSET: durable ways of thinking about working with AI

### 57. AI proposes, you decide
- Bucket: MINDSET
- The idea in one plain sentence: Let AI do the work and show its reasoning, but keep every decision of taste, approval and publishing for yourself.
- Why it matters (business outcome): The value you're paid for is judgement; delegate the grind, never the call.
- Source: content-engine `docs/NORTH_STAR.md`, `AGENTS.md`, NOW.md. Quotes: "It proposes; Krish decides; the record shows why" / "'10/10' means the engine does the work of that stage to the standard he would set, shows its reasoning, and leaves him only the decision." / "one person can run a publication with an AI production team and stay the editor".
- Real-world example in the source: A 14-agent engine finds stories, judges them, drafts, fact-checks and edits video, and still publishes nothing on its own. Krish locks and posts.
- "Do this today" step under 15 minutes: List the AI tasks you run. Mark each "AI does it" or "I decide". Anything sending, approving or choosing on your behalf goes in "I decide".
- Strength 1-5: 5
- Sensitivity: None. Also answers the "AI content is slop" objection (NOW.md).

### 58. Don't expect AI to be smarter than you
- Bucket: MINDSET
- The idea in one plain sentence: Use AI to make your own thinking better, because handing it your thinking is exactly how it ends up smarter than you.
- Why it matters (business outcome): Leaders who outsource judgement lose the edge they are paid for; those who use AI to sharpen it gain one.
- Source: makeyourmindup `01_MEDIA_KIT.md` (north star). Quote: "Promoting high human agency is the key mission for me as a person, so that people do not just get used by AI, but use it to improve themselves, to make their minds better. Pre-AI era leadership isn't going to cut it, delegating like they used to won't cut it, and expecting AI to be smarter than you is exactly what will make it smarter than you."
- Real-world example in the source: The whole publication is built so the reader makes the call: the name "makeyourmindup" is "what the reader does".
- "Do this today" step under 15 minutes: Next time you ask AI for an answer, write your own answer first in one line, then compare.
- Strength 1-5: 5
- Sensitivity: The media kit says this north star "never appears as a statement" in editorial pieces. Using it as the spine of a video is Krish's call; flag before quoting it on camera.

### 59. Ask "can they check it themselves?"
- Bucket: MINDSET
- The idea in one plain sentence: Good work, with or without AI, leaves people more able to judge for themselves, not just better informed.
- Why it matters (business outcome): Teams that can check reasoning make better decisions without you in the room.
- Source: makeyourmindup `panel/judges.json` (Agency Judge), `01_MEDIA_KIT.md` (your.call). Quotes: "Does a reader finish more capable of judging for themselves, or merely better informed?" / Krish: "I prefer arming people with the tools to create their own verdict, rather than trying to persuade them of my opinion." / Agency Judge card: "Can they check it themselves?"
- Real-world example in the source: The planned your.call device asks the reader to make a call before reading and lets them change it after, so the reader supplies the verdict.
- "Do this today" step under 15 minutes: Add the sources and the one key number to your next AI-assisted recommendation, so your boss can check it without asking you.
- Strength 1-5: 4
- Sensitivity: None.

### 60. No sermons: show the working
- Bucket: MINDSET
- The idea in one plain sentence: Strip the closing "lesson" AI loves to add, and let the evidence do the persuading.
- Why it matters (business outcome): Preachy endings make smart readers switch off; trust comes from showing your working.
- Source: makeyourmindup `AGENTS.md`, `01_MEDIA_KIT.md`, `panel/judges.json`; content-engine `_houseRules.ts` NO_SERMONS. Quotes: Krish: "we should not sound preachy or like we are trying to persuade anyone of anything like a missionary in content. thought leadership should do that job." / "A piece that ends by telling the reader what this means for their leadership has failed" / Preacher-Catcher: "That last line wants to be a poster. Net."
- Real-world example in the source: One "sermon" sentence blocks a piece, and the judge for it never relaxes. The cover's staff box: "Sermons: None. A machine checks."
- "Do this today" step under 15 minutes: Delete the last paragraph of your next AI-written email or post. Read it again. It is almost always better.
- Strength 1-5: 5 (very funny, very practical)
- Sensitivity: None.

### 61. Make a call, date it, keep score
- Bucket: MINDSET
- The idea in one plain sentence: Commit to predictions with a date and a confidence level, check them when the date comes, and show your misses as big as your hits.
- Why it matters (business outcome): People who keep score on their own calls get better at them; people who hedge never learn.
- Source: content-engine `_houseRules.ts` CALL, CLEAR_STANCE; `docs/CREATIVE_IDENTITY_UPGRADE.md` P6; makeyourmindup `apps/cover/substack-kit/COPY.md`. Quotes: "Misses go up as big as hits." / Krish: "I'd rather take a clearer stance than sit on the fence all the time and say 60%." / "Every piece makes a call. We keep score."
- Real-world example in the source: Every piece ends "By 30 September 2027, ... How sure we are: 75%." and is marked held, broke or unclear on that date.
- "Do this today" step under 15 minutes: Write one prediction about your work or market with a date and a percentage. Put a reminder in your calendar for that date.
- Strength 1-5: 5
- Sensitivity: None. Brand-signature idea; good fit.

### 62. Your time is the budget, not the AI's output
- Bucket: MINDSET
- The idea in one plain sentence: Judge any AI workflow first by how many hours of your time it costs, then by how good the output is.
- Why it matters (business outcome): A "better" AI workflow that eats more of your week is a worse business.
- Source: makeyourmindup `AGENTS.md`, `01_MEDIA_KIT.md`, `03_STEP_PLAN.md`. Quotes: "Two to four hours of Krish's time per signature piece. If a workflow adds to that number it is wrong regardless of how good its output is. Apply that test before the quality test, not after." / "If it takes eight hours a piece, something above is wrong".
- Real-world example in the source: The whole machine is designed around that limit, including recording. "He still enjoys making it" is success measure number two.
- "Do this today" step under 15 minutes: For one AI workflow you use weekly, time how many minutes of your own attention it actually takes (prompting, checking, fixing). Write it down.
- Strength 1-5: 5
- Sensitivity: None.

### 63. If it needs taste or more than two tries, don't automate it
- Bucket: MINDSET
- The idea in one plain sentence: Automate only the jobs that are the same every time; anything needing judgement belongs in a conversation where you are present.
- Why it matters (business outcome): Automations that need judgement fail quietly, and nobody notices until it's expensive.
- Source: makeyourmindup `engine/ENGINE_SPEC.md`, `AGENTS.md`, `02_REPO_BRIEF.md`. Quotes: "Anything needing taste, or more than two attempts, is not a job. It is a Claude or Codex session." / "A cron that needs judgement is a cron that will be wrong quietly." / Krish: "content engine should hold stable machinery, control center holds the UI, and Claude or Codex should hold anything that is unreliable in a custom UI or expensive via API."
- Real-world example in the source: The machine "writes no prose" and fills no gaps; it assembles the brief. Writing happens in a session with Krish.
- "Do this today" step under 15 minutes: Look at one automation you have or want. Ask: is it the same every time? If not, turn it into a saved prompt you run yourself instead.
- Strength 1-5: 4
- Sensitivity: None.

### 64. Rules before plumbing
- Bucket: MINDSET
- The idea in one plain sentence: Settle what good looks like before you build or buy the AI tools to make it, because tools built first get thrown away.
- Why it matters (business outcome): The most expensive AI mistake is a beautifully integrated workflow for a format you later change.
- Source: makeyourmindup `03_STEP_PLAN.md`, `AGENTS.md`; content-engine `WORKBENCH.md`. Quotes: "Integrations written today are obsolete the moment the dry runs change the template. That is the single most expensive mistake available here, and an eager session told to build the machine will build straight past it." / "Shape the stack only after real video results exist: post the first pieces by hand, collect YouTube results, then choose tools from the evidence. No purchase has been made."
- Real-world example in the source: Krish held back buying AI video tools until real pieces were posted by hand and results came in.
- "Do this today" step under 15 minutes: Before your next AI tool subscription, do the job by hand once with free tools and write down what "good" looked like.
- Strength 1-5: 4
- Sensitivity: Don't name the vendor test decisions (Runway, Higgsfield, Native) as endorsements.

### 65. Some lines never bend
- Bucket: MINDSET
- The idea in one plain sentence: Decide which of your standards are never relaxed, even under deadline, and fix the work rather than out-voting the check.
- Why it matters (business outcome): Under pressure every standard looks negotiable; the ones that protect your reputation can't be.
- Source: makeyourmindup `panel/PANEL.md`, `AGENTS.md`; content-engine walk log F25. Quotes: "The Preacher-Catcher and the Fact Checker never calibrate down. Those two exist to hold the line when the deadline argues otherwise." / "A veto is never cleared by out-voting the judge." / Krish: "fact check as much as possible until is no longer needed".
- Real-world example in the source: The fact gate sometimes held correct sentences, and a piece took up to 18 runs. Krish chose strict over fast: "the gate stays strict and a piece is re-run until it passes."
- "Do this today" step under 15 minutes: Write your two "never relax" rules (for example: every number has a source; nothing goes out unread). Put them at the top of your AI instructions.
- Strength 1-5: 4
- Sensitivity: None.

### 66. Live beats written, written beats memory
- Bucket: MINDSET
- The idea in one plain sentence: Trust what you can see working right now over what a document says, and a document over what anyone (or any AI) remembers; when two disagree, stop and find out.
- Why it matters (business outcome): AI confidently repeats stale information; the cost lands when you act on it.
- Source: both repos `AGENTS.md` (Krish canon); content-engine NOW.md. Quotes: "Live state beats documentation, documentation beats memory." / "If two sources disagree, stop destructive work, report the conflict ... rather than picking the convenient one." / "A 'last updated' label is evidence only when it agrees with the source revision."
- Real-world example in the source: NOW.md flags that the docs say an access fix is still unverified while the workbench says it is live, and tells the reader to "treat it as live only after a readback".
- "Do this today" step under 15 minutes: Next time AI tells you a price, policy or date, ask it "how do you know, and as of when?" and check the live page.
- Strength 1-5: 3
- Sensitivity: None.

### 67. Taste and popularity are different things
- Bucket: MINDSET
- The idea in one plain sentence: Don't let view counts or likes change your standards on their own; performance tells you what spread, not what was good.
- Why it matters (business outcome): Chasing the numbers alone turns a distinctive business into a generic one.
- Source: content-engine `.agents/skills/mindmake-video/references/learning.md`, `docs/CREATIVE_IDENTITY_UPGRADE.md` s.9; makeyourmindup `panel/PANEL.md`, `01_MEDIA_KIT.md`. Quotes: "Views alone never define taste and never promote a rule." / "Platform performance is performance evidence, never taste, and never changes a rule by itself." / "The panel never sees reader verdicts ... That would turn craft judgement into popularity prediction." / "Nobody optimises this channel for click-through."
- Real-world example in the source: The publication measures invitations and quotes, not impressions. A performance rule needs three comparable repeats before it is even proposed.
- "Do this today" step under 15 minutes: Pick your best-performing post or email this year. Ask: was it good, or just popular? Write one line on what you'd keep.
- Strength 1-5: 3
- Sensitivity: None.

### 68. Nothing is better than filler
- Bucket: MINDSET
- The idea in one plain sentence: Prefer no AI output over a slick-looking weak one, and when the raw material isn't good enough, go back and get better material.
- Why it matters (business outcome): Filler costs attention and trust; one strong piece beats three passable ones.
- Source: content-engine `.agents/skills/mindmake-video/references/editorial-selection.md`; makeyourmindup rubric and panel. Quotes: "The output standard is a self-contained, high-value idea, not a filled publishing slot. Prefer no candidate and a precise rerecord brief to a coherent-looking but unimportant clip." / Commissioner: "Fine piece. Wrong week." / catches "Competent pieces that should not exist".
- Real-world example in the source: The Studio returns "rerecord" with an exact brief (hook, missing proof, structure, final line) instead of polishing a clip with no real point.
- "Do this today" step under 15 minutes: Look at what you plan to send or post this week. Cut the weakest item.
- Strength 1-5: 4
- Sensitivity: None.

### 69. Have a floor for bad weeks, and never skip silently
- Bucket: MINDSET
- The idea in one plain sentence: Decide the minimum you will always ship, so a bad week still produces something, and when you miss, say so.
- Why it matters (business outcome): Consistency builds audiences and client trust; silent gaps erode both.
- Source: makeyourmindup `01_MEDIA_KIT.md`, `engine/ENGINE_SPEC.md`, W38 README. Quotes: "A digest-only week is acceptable. One signature piece plus Resources is the floor. Skipping silently is not." / "'we checked again and it did not move' is a finding and a page that silently redraws the same cards does not report it."
- Real-world example in the source: When the weekly slate was re-run on a bigger pool and nothing changed, the page said so explicitly rather than quietly redrawing.
- "Do this today" step under 15 minutes: Write your "bad week minimum" for one recurring output (newsletter, client update, report). Put it in your AI instructions as the fallback.
- Strength 1-5: 3
- Sensitivity: None.

### 70. "Not now" is not "no"
- Bucket: MINDSET
- The idea in one plain sentence: Judge an idea's quality and its timing separately, because a good idea in the wrong week is still a good idea.
- Why it matters (business outcome): Killing good ideas for bad timing throws away future wins.
- Source: makeyourmindup `quality/panel/rubric.v1.json`, slate page. Quotes: "Two votes, never one ... 'Not now' is a scheduling verdict, and scoring it as a quality verdict punishes an idea for arriving in the wrong week." / "Force a better angle: Sends an idea back to be re-pitched rather than killing it."
- Real-world example in the source: The ruling page offers Accept, Tweak, Replace, Reject and Not now as separate buttons.
- "Do this today" step under 15 minutes: Add a "Not now" column to your idea list or backlog. Move anything you rejected for timing into it.
- Strength 1-5: 3
- Sensitivity: None.

### 71. Every part of the system makes the whole come alive
- Bucket: MINDSET
- The idea in one plain sentence: Treat your AI setup as small reusable parts (rules, checks, templates) that work together, and upgrade every part a new rule touches, not just the one in front of you.
- Why it matters (business outcome): Fixing only the current output means fixing the same thing forever; fixing the system means fixing it once.
- Source: content-engine NOW.md (2026-09-25), `docs/CREATIVE_IDENTITY_UPGRADE.md` 1.5. Quotes: Krish: think of the engine "as a modular set of components that work together to come alive" / "if they are going in, they need to go in for everything." / "There is no per-piece 'does this one suit a flipbook?' decision."
- Real-world example in the source: When Krish banned a phrase, it went into the writers, the judges, the joke pass, the final check and a test, so no part of the system could keep using it.
- "Do this today" step under 15 minutes: Pick your newest rule for AI. List every place it should apply (email prompt, report template, custom GPT). Add it to each.
- Strength 1-5: 3
- Sensitivity: None. Close cousin of idea 41; merge if short of slots.

### 72. Work where it is least fiddly
- Bucket: MINDSET
- The idea in one plain sentence: While you are still figuring a workflow out, work wherever it is fastest (often a plain AI chat), and only move into the polished tool once the process is settled.
- Why it matters (business outcome): Forcing early work into a fancy dashboard slows everything and makes you hate the tool.
- Source: content-engine walk log (Piece 1, 2026-10-05), WORKBENCH. Quote: Krish: "I would rather work in here and have the pieces and their artwork produced in html and assets like we are doing now - control center editing feeling super fiddly to me right now while we are building the engine".
- Real-world example in the source: Krish built a whole control centre, then moved the day-to-day making back into the agent chat, keeping the dashboard only for locking and publishing.
- "Do this today" step under 15 minutes: Name one AI tool you set up and avoid using. Do this week's task in a plain chat instead and note what you actually needed.
- Strength 1-5: 3
- Sensitivity: Avoid showing Control Center screens or URLs.

---

## Top 15 (ranked)

1. **AI proposes, you decide** (57): the frame for the whole channel, with a 14-agent system as living proof.
2. **Fix the source, not the prompt** (2): pre-cleared war story with a twist; the AI learned the bad habit from Krish's own notes.
3. **Check every number against the source's own words** (19): "$900 million became close to a million dollars", and the AI judge gave it 9 out of 10.
4. **The reviewer never writes the fix** (26): one simple habit, two chats, instantly usable.
5. **No sermons: show the working** (60): funny, on-brand, and a one-minute fix: delete the last paragraph.
6. **One list of your rules, in your own words** (1): the core of building an AI brain.
7. **Success messages lie: open the output** (33): 33 hours, about 19,000 empty verdicts, all marked "ok".
8. **Look at it where people will actually see it** (40): cut-off eyes, "Chris", pictures-off Outlook; very visual.
9. **Give your reviewer the evidence** (22): same text, 3 out of 10 to 9 out of 10, pre-cleared.
10. **One job per reviewer, not a celebrity persona** (27): ready-made jokes from the panel cards.
11. **Don't let your AI learn from its own homework** (5): pre-cleared, and a subtle point most people miss.
12. **Make a call, date it, keep score** (61): the brand's signature habit, applied to anyone's work.
13. **Turn every repeated fix into a tool** (41): the compounding habit.
14. **Your time is the budget, not the AI's output** (62): a two-to-four-hour rule that applies to any manager.
15. **Make every chart prove one point** (49): "who cares about a person walking to a box that says till?"

Close runners-up: 14 (anti-echo mirror), 21 (AI fixing AI), 29 (self-check first), 43 (plain messages beat forms), 58 (don't expect AI to be smarter than you; flag first), 10 (the handoff note).

---

## Published or drafted Make Your Mind Up topics (avoid duplicating)

Published (live on Substack, per content-engine `WORKBENCH.md` 2026-10-06 and makeyourmindup `docs/history/LOG.md`):

| Title / subject | Date | Subchannel | Notes |
|---|---|---|---|
| Article 1, the launch piece. Engine title "Same agent, opposite answers"; subject: Amazon blocked Meta's Muse AI shopping agent while Shopify welcomed it; who gets paid, incentives, where shoppers and merchants get stung; IF YOU ARE BUILDING / IF YOU ARE BUYING sections | Live 2026-10-05 | follow.the.money | Call: by 30 June 2027 Amazon opens an authorised route for shopping agents that still shows them sponsored listings, 70% |
| "Who gets paid" video post (YouTube title "Amazon blocked Meta's AI shopping agent. Shopify let it in.") | Live 2026-10-05; Krish posted the videos by 2026-10-06 | follow.the.money | 2:32, tall and wide |
| Launch post plus the hello video (what makeyourmindup is, the three days, the scoreboard) | 2026-10-05/06 | publication-wide | 2:12 |

Approved, scheduled, not yet published:

| Title / subject | Date | Subchannel | Notes |
|---|---|---|---|
| "Who picks your AI?" (AI model routers and auto-switchers; ice cream shop analogy; three futures: Vending Machine, Secret Menu, Group Project) | Approved 2026-09-28; due Fri 2026-10-09 | mind.the.gap | Web edition in `editions/2026-09-who-picks-your-ai/`; Short storyboard approved 2026-10-02; Call 75% |
| Salesforce's Koa (Salesforce's own AI model; "real or theatre" on "matches or exceeds"; the AIforce and ClaudeForce fork) | Approved; due Wed 2026-10-07 | under.the.hood | Call "By 30 September 2027", 55%; launch set not yet made |

Pitched or banked, not written (makeyourmindup `dry-runs/PITCHES.md`, calibration round 1):

| Id | Headline | Subchannel | Status |
|---|---|---|---|
| bill0 | Canva just cut its own growth forecast because AI got expensive | follow.the.money | Rated excellent; launch bank |
| gap1 | Congratulations, you have an R&D department. Nobody told you. (hidden AI use at work) | mind.the.gap | Rated excellent; launch bank |
| gap2 | The calculator kids turned out fine | mind.the.gap | Rated excellent; launch bank |
| gap5 | 2,500 years of blaming the tool | mind.the.gap | Rated excellent; launch bank |
| lid1 | Meta put an agent in front of two billion people. Three things are real. | under.the.hood | Picked as the one locked dry run |
| bill1 | Somebody is claiming OpenAI loses 1.35 dollars for every dollar it earns | follow.the.money | Rated good |
| bill2 | Your AI feature is quietly eating your gross margin | follow.the.money | Rated good |
| bill3 | Seats are dead. So why is everyone still selling them? | follow.the.money | Rated good |
| bill4 | The cheapest model that can do your job is now embarrassingly cheap | follow.the.money | Rated good (overlaps idea 38) |
| gap3 | The best AI users in the world do not work in tech | mind.the.gap | Rated good |
| gap4 | What leaders will not hand over, and what they quietly already have | mind.the.gap | Rated weak ("closest to preaching") |
| gap6 | Everyone is terrible at this and pretending otherwise | mind.the.gap | Rated good |
| lid4 | The six-agent honesty bench | under.the.hood | Rated weak |

Proposed on the first weekly slate (2026-W38, news-led, not written; names used the retired the two retired subchannel labels): Z.AI's $5 billion; the frontier premium; OpenAI's inference bill per researcher; OpenAI's Navier-Stokes claim; the 72-hour breach; "The last AI built by humans" (491 papers); Astra for Law; Meta's Muse (the swing card, which became Article 1); Gemini 3.8 Live; plus about 30 hand-off and alternate cards (e.g. Perplexity's effort dial, Copilot's model picker, the model router, Anthropic's price premium).

Overlap watch for the ideas above: idea 38 (match the model to the job) overlaps "Who picks your AI?" and bill4; idea 51 quotes piece 2's ice cream line before it publishes; gap1 (hidden AI users) and gap5 (blaming the tool) are banked mind.the.gap pieces, so avoid a video on "people hide their AI use" or "people always blame the new tool" unless it is the same piece.
