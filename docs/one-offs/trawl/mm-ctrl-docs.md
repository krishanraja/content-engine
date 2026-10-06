# Trawl: mm-ctrl (CTRL) docs, skills, standards, training

Scope read: `README.md`, `NOW.md`, `CHALLENGE.md`, `docs/` (current/, agent-instructions/, root specs, and all of `docs/history/` including the 2026-09-07 corpus dumps), `skills/` (all five ctrl-* skills and their leaves), `standards/`, `_upgrade/ctrl/`, `training/anchor.yaml`. Pure release mechanics (deploy receipts, migration ledgers, route inventories, Playwright recipes, design tokens) were read or grepped and only mined where they hid a transferable idea.

Global sensitivity notes (apply to every idea below):
- `NOW.md` has an explicit `never_publish` list: logins/test-account address, the Supabase project id, secret names, the old $9 and $29 prices and any annual/discount pricing, customer counts/revenue/conversion/retention/ROI, any Personal Memory/briefing/decision/Blind Spot content, any security certification not in the compliance records.
- Client and private names appear in the skills and corpus: the CEO in the "no decks" story is a named client (subject of `skills/ctrl-compile/reference/ctrl-import.md`, with company and email). The "[client]" managed engagement, a "40-person UK leadership and training company", [client] ([client]), [client] ([client]), [client], named founders ([client], [client]) and ventures (AdFixus, [client]) must not appear in public content. Always anonymise ("a CEO I worked with").
- Krish's own agent names (Cleo, Felix, Agatha, Marcus, Vera etc.) are internal detail; usable as colour only if Krish is happy to name them.
- Most percentages in the corpus (12x, 95% of pilots, 47% of businesses, 45% of AI code, $285B, 22% of execs) come from secondary web sources gathered for course syllabi. Re-verify at primary source before saying any number on camera.
- Course prices ($599 workshop, $2,500 cohort) and CTRL pricing ($49 Edge Pro) are commercial and volatile; keep out of evergreen scripts.

---

## BRAIN (building your personal AI brain)

### Same model, different employee
- Bucket: BRAIN
- The idea in one plain sentence: Your AI answers like a stranger because you never told it who it works for; one short identity file (role, voice, standards, never-rules) read at the start of every chat turns the same model into a different worker.
- Why it matters: Removes the daily re-briefing tax, cuts the editing you do to put output back in your voice, and is the cheapest quality upgrade available (no new tool, no new model).
- Source: `docs/history/2026-09-07-doc-ai-identity-memory.md`, `docs/history/2026-09-07-doc-memory-prompt-pack.md`, `docs/history/2026-09-07-doc-autonomous-business.md` (onboarding docs: IDENTITY.md, USER.md, MEMORY.md). Quotes: "THE MODEL ISN'T THE PROBLEM · THE SETUP IS." / "Identity is the cheapest performance upgrade you will ever ship." / "'You are my head of content,' not 'you are a helpful assistant.'"
- Real-world example: Krish's before/after slide. Before: "Here are some ideas you might consider. Let me know if you'd like me to expand..." After: "Three angles. I'd ship the second... Here it is, drafted." Tell: "Nothing changed but the file it read first." Done when "two people couldn't tell its draft from yours."
- "Do this today": Write four headings in a note (Role, Voice, Standards, Never) with three lines each, paste it at the top of a new chat, and ask the same boring question you always ask.
- Strength: 5
- Sensitivity: None. Avoid quoting agent count ("14-agent operator") unless current.

### The cold vs loaded test (the amnesia tax)
- Bucket: BRAIN
- The idea in one plain sentence: Run one real weekly task twice, once in a blank chat and once with your memory file pasted first; the gap between the two answers is the tax you have been paying every day.
- Why it matters: Makes the value of context visible in two minutes; proves time saved and quality gained before you invest in any tool.
- Source: `docs/history/2026-09-07-doc-memory-prompt-pack.md`, `docs/history/2026-09-07-doc-ai-identity-memory.md`, `docs/history/2026-09-07-intel-methodology-memory-identity.md`. Quotes: "The gap between those two answers is the tax you have been paying." / "So Monday stops being its first day." / "Magic = the COLD vs LOADED gap made visible."
- Real-world example: Cold chat "asks you for context you've typed a hundred times"; loaded chat "skips the questions, hits your priorities, and picks up where you left off on Friday."
- "Do this today": Pick the email or report you write every week, run it cold, run it loaded, put the two answers side by side.
- Strength: 5
- Sensitivity: The pack itself warns: "strip names and numbers before pasting it into a tool you do not control."

### The one-page memory file (sharp beats big)
- Bucket: BRAIN
- The idea in one plain sentence: Your AI memory should be one page under four headings (Business, Top 3 priorities, Decisions made, People and projects), curated, not a junk drawer of everything you ever said.
- Why it matters: A tight file gives better answers than a big one (more context can make answers worse: "context rot"), costs nothing to maintain, and travels to any tool.
- Source: `docs/history/2026-09-07-doc-memory-prompt-pack.md`, `docs/history/2026-09-07-doc-ai-identity-memory.md`, `docs/history/2026-09-07-intel-methodology-models.md` (MODEL 10), `docs/history/2026-09-07-md (5).md` and `md (1).md` (context rot findings). Quotes: "Keep it sharp, not a junk drawer." / "SHARP BEATS BIG" / "Keep the whole thing under one page. Cut anything not reusable." / "stuffing more tokens into a window degrades rather than improves reliability."
- Real-world example: The memory build prompt: paste 5 to 10 messy lines about your work; the AI asks up to five questions about anything vague "or reads like marketing copy", asks "if I could move only one of these this month, which one?", then organises what survives.
- "Do this today": Brain-dump ten messy lines about your job into a chat and ask it to turn them into a one-page memory file under those four headings, flagging anything you should not store.
- Strength: 5
- Sensitivity: None.

### Store this, never store this (the export test)
- Bucket: BRAIN
- The idea in one plain sentence: Never put anything in your AI memory you would be uncomfortable seeing in an export: no passwords or keys, no other people's private details, no half-thoughts.
- Why it matters: Your memory file is a liability as well as an asset; one leaked file can cost trust, jobs and legal exposure; noise also dulls answers.
- Source: `docs/history/2026-09-07-doc-memory-prompt-pack.md` (STORE THIS / NEVER STORE THIS), `docs/history/2026-09-07-doc-ai-identity-memory.md` ("USEFUL CONTEXT IN · LIABILITY OUT"), `docs/current/features.md` (off the record mode), `docs/history/2026-09-07-md (1).md` (memory poisoning). Quotes: "Never store anything you would be uncomfortable seeing in an export." / "anything that is a breach waiting to happen." / "Other people's private data you would not want quoted back."
- Real-world example: CTRL's "Off the record" mode "writes nothing durable" for a session and says so when nothing was saved.
- "Do this today": Open your AI tool's saved memory/custom instructions, read every line as if it were printed in a newspaper, delete anything that fails.
- Strength: 4
- Sensitivity: None.

### The notebook test
- Bucket: BRAIN
- The idea in one plain sentence: If you would write it in a notebook you carry home, put it in your personal AI; if it belongs in your company's systems, put it there instead.
- Why it matters: A one-line rule that settles most "is it OK to put this in AI?" anxiety and keeps confidential company data out of personal tools.
- Source: `docs/current/commercial.md` (Tier 1 disclosure ladder). Quote: "*if you would write it in a notebook you carry home, put it in CTRL; if it belongs in your company's systems, put it there.* That sentence hands the judgement back to the buyer instead of treating them as a compliance risk."
- Real-world example: The product contract that follows from it: "If an IT administrator has to approve it, we do not build it" (`docs/current/product.md`).
- "Do this today": Before your next paste into a chatbot, ask the notebook question out loud.
- Strength: 4
- Sensitivity: Phrase generically; do not name CTRL in a way that reads as an ad unless intended.

### Not everything you say is a fact about you
- Bucket: BRAIN
- The idea in one plain sentence: "Don't use bullet points", "I'm tired today", "I'd love to..." and "my colleague is struggling" are not facts about you and should never become permanent memory.
- Why it matters: Polluted memory makes every future answer slightly wrong and can store gossip about people who never consented.
- Source: `training/anchor.yaml` (extraction_rejects: meta_instruction, style_rule, transient_state, third_party_identity, hypothetical, pure_negation), `docs/current/product.md` ("Content reactions tune ranking; they do not become personality facts. Skipping is neutral."), `docs/current/features.md` (third-party minimisation). Quotes: "output-shaping instruction, not a user fact" / "transient context, not durable fact" / "a person named next to a role is stored as the role."
- Real-world example: "my CFO Sarah Patel is dragging her feet" is stored as "my CFO is dragging her feet"; "I'm a bit tired today, running late to the board meeting" is rejected.
- "Do this today": Scan your AI's saved memories and delete moods, wishes, formatting instructions and anything about another named person.
- Strength: 4
- Sensitivity: "Sarah Patel" and "Jake" are synthetic test examples; fine, but better to invent new ones.

### Let the AI interview you, one question at a time
- Bucket: BRAIN
- The idea in one plain sentence: Don't fill in a template; tell the AI to interview you one question at a time and to refuse vague answers like "professional", "clear" or "data-driven".
- Why it matters: Specific in, specific out; you surface knowledge you didn't know you had, and the result sounds like you rather than a form.
- Source: `docs/history/2026-09-07-doc-memory-prompt-pack.md`, `docs/history/2026-09-07-doc-vibe-coding-mastery.md` (Interview-First Protocol, 15 to 20 questions), `docs/history/2026-09-07-doc-vibe-coding-deck.md` (voice-note top tip). Quotes: "The prompts do not ask you to fill in blanks. They interview you, one question at a time." / "Specific in, specific out." / "Ask me what 'good' looks like before you hand me anything. Make me name the bar... Probe until it is testable."
- Real-world example: Krish's identity prompt covers VOICE (paste 2 or 3 things you wrote), STANDARDS, NEVER (the last 2 or 3 AI outputs you deleted) and MISSING ("Tell me what you still do not know... and ask for it").
- "Do this today": Paste: "Interview me one question at a time to build a profile of how I work. Refuse vague answers. Stop after 10 questions and write it up."
- Strength: 5
- Sensitivity: None.

### Grade real work, don't describe your taste
- Bucket: BRAIN
- The idea in one plain sentence: You can't describe your own standard accurately, but you can recognise it; show yourself real examples and ask "would I send this?", then write one line why.
- Why it matters: What people say about their standards and what they actually do differ by 10 to 30 percent; rules built from self-description are confidently wrong.
- Source: `skills/ctrl-intake/SKILL.md`, `skills/ctrl-intake/leaves/sort.md`, `skills/ctrl-intake/leaves/live-session.md`, `docs/history/2026-09-07-md.md` (social desirability research), `docs/history/2026-09-07-md (2).md` (Critical Decision Method, repertory grid). Quotes: "You are not collecting opinions. You are collecting graded behaviour." / "recognition is easier than recall. Ask someone to describe their tone and you get 'clear and professional,' which is useless to everyone." / "The one line is the most valuable output of the entire session... the verdict tells you what and the line tells you why."
- Real-world example: The two-minute version for busy people: "Hand them four of their own past documents and ask which two they would send today."
- "Do this today": Pull six things you wrote recently, sort them into "would send today" and "would not", and write one line on each about why.
- Strength: 5
- Sensitivity: None.

### A comment is not a rule
- Bucket: BRAIN
- The idea in one plain sentence: Something you said about one situation must stay tied to that situation; when AI turns it into a rule about everything, it becomes confidently wrong.
- Why it matters: This is the most common way AI profiles go bad, and the person it's about finds out first, at the worst moment.
- Source: `skills/ctrl-intake/leaves/transcripts.md`, `skills/ctrl-check/leaves/provenance.md`, `skills/ctrl-build/SKILL.md`, `skills/ctrl-compile/leaves/profile.md`, `CHALLENGE.md` (CH-05). Quotes: "a situated statement was rendered as a standing rule" / "Nothing in that sentence was misquoted... and the extraction was still wrong" / "A statement is about the thing it was about until they tell you otherwise."
- Real-world example: A CEO said "We're very uncorporate as a client, so we don't want a deck or any detailed notes of what you've done" about progress reports on one engagement. A generated file wrote "FORBIDDEN: Do not create decks for him." He called it crap: he wants decks all the time, from his team, for clients.
- "Do this today": Search your AI instructions for "always", "never", "must" and "forbidden"; for each, add the situation it actually came from ("for progress updates on X...").
- Strength: 5
- Sensitivity: HIGH. The CEO and company are a named client in the repo. Tell it only as "a CEO I worked with" with no company, sector or date detail.

### Which two of these three go together?
- Bucket: BRAIN
- The idea in one plain sentence: To find what you really judge work on, look at three examples, say which two are alike and why, then name the opposite "as you mean it", not the dictionary opposite.
- Why it matters: Surfaces tacit taste you can't articulate on demand; produces your own words for your standards, which is what makes an AI sound like you.
- Source: `skills/ctrl-intake/leaves/live-session.md`, `docs/history/2026-09-07-md (2).md` (Kelly's repertory grid), `CHALLENGE.md` (CH-10). Quotes: "How are two of these similar and the third one different?" / "And what would you call the opposite of that? Not the dictionary opposite." / "'It has actually seen the client' is data. 'Client specificity' is your gloss and it is worth less."
- Real-world example: "Present may contrast with performing, not with absent. Careful may contrast with slow, not with careless."
- "Do this today": Lay out three of your past proposals or emails, do the triad once, and save the two phrases (the good pole and its true opposite) in your identity file.
- Strength: 4
- Sensitivity: None.

### Your deleted drafts are your best training data
- Bucket: BRAIN
- The idea in one plain sentence: The last few AI outputs you deleted or rewrote tell you more about your standard than anything you'd write from scratch; turn each into a "never" rule.
- Why it matters: Negative examples are more precise than positive ones; a personal kill list stops the same slop reappearing.
- Source: `docs/history/2026-09-07-doc-memory-prompt-pack.md` (NEVER area), `skills/ctrl-compile/leaves/profile.md` ("Witnessed failure modes... Negative specification is more precise"), `skills/ctrl-check/leaves/mechanical.md` (their own kill list blocks; the house list only warns). Quotes: "Ask me about the last 2 or 3 times an AI gave me something I deleted or rewrote. For each one, write a rule that kills the whole class of that mistake." / "a rule someone demonstrated outranks a rule somebody wrote down."
- Real-world example: The house kill list in `skills/ctrl-build/leaves/writing.md`: "Unlock", "supercharge", "delve", "It's not just X, it's Y", "The result?" as a standalone line.
- "Do this today": Find three AI drafts you binned this month and write one never-rule from each, with the reason in the next sentence.
- Strength: 5
- Sensitivity: None.

### Examples beat rules
- Bucket: BRAIN
- The idea in one plain sentence: Give your AI three to five real examples you approved and rejected, with your one-line reason, instead of more rules about style.
- Why it matters: The repo cites a judging benchmark jumping from 54.9 to 81.7 percent with retrieved examples, bigger than any rubric rewrite; research suggests under ten contrasting examples measurably shift behaviour.
- Source: `skills/ctrl-build/leaves/package.md`, `skills/ctrl-check/leaves/judgement.md`, `docs/history/2026-09-07-md (2).md` (DITTO, fewer than 10 demonstrations), `training/anchor.yaml` (briefing_exemplars). Quotes: "A rubric describes the standard. An exemplar demonstrates it, and the demonstration carries information the description cannot." / "Keep the verbatim. Do not clean them up. A tidied exemplar is your writing, not theirs."
- Real-world example: CTRL's training file holds gold-standard briefings per type ("Heads up... Net: ... Call to make: ...").
- "Do this today": Add a section "Examples" to your AI instructions with one email you loved and one you rejected, each with a one-line why.
- Strength: 5
- Sensitivity: Treat the 54.9/81.7 figure as "one benchmark"; verify before quoting.

### Your voice comes from your writing, not adjectives
- Bucket: BRAIN
- The idea in one plain sentence: Paste ten pieces you actually wrote and have the AI extract sentence length, openings, words you use and words you never use; don't describe yourself with adjectives, and never let it invent a sample of "you".
- Why it matters: Output that sounds like you saves editing time and avoids the reputational hit of obviously AI-written posts.
- Source: `docs/history/2026-09-07-doc-autonomous-business.md` (voice.md exercise), `skills/ctrl-intake/leaves/transcripts.md` (Pasted writing), `skills/ctrl-build/SKILL.md` ("Never fabricate a quotation"), `CHALLENGE.md` (CH-10: the extractor invented "Always sound like me" when it found nothing), `docs/history/2026-09-07-AI Chief of Staff ... Syllabus Framework.md` (LinkedIn AI-post backlash). Quotes: "A voice standard is exemplars, shapes and a kill list, and the moment it becomes a set of labels it has stopped describing anyone in particular." / "The highest-return 30 minutes you'll spend this month." / "An invented quote attributed to someone is the fastest way to lose them."
- Real-world example: The voice.md prompt: "Extract my writing voice: tone, sentence length, vocabulary, the words I never use."
- "Do this today": Do the voice.md exercise with your ten best emails or posts and attach the file to your next writing request.
- Strength: 5
- Sensitivity: None.

### Write down "not established" instead of guessing
- Bucket: BRAIN
- The idea in one plain sentence: When your AI profile doesn't know something, it should say AWAITING or NOT ESTABLISHED, not fill the gap with a plausible guess.
- Why it matters: A visible gap gets fixed next conversation; an invented rule spreads into every document and is discovered by the person it's about.
- Source: `skills/ctrl-intake/SKILL.md`, `skills/ctrl-build/SKILL.md`, `skills/ctrl-check/leaves/provenance.md`, `skills/ctrl-compile/leaves/profile.md`. Quotes: "An empty field is honest. An invented one is not." / "A flagged gap is useful and someone will fill it. An invented rule spreads." / "One invented detail costs more trust than ten correct ones earn." / "this file is going to be wrong about something, and the question is whether it is wrong loudly or quietly."
- Real-world example: The honest baseline line: "Baseline: none... There is no honest way to measure whether this improved anything, only whether they kept using it. The second version is not a failure to report. It is the report."
- "Do this today": Add a line to your identity file: "If you don't know something about me, ask or say NOT ESTABLISHED. Never guess."
- Strength: 5
- Sensitivity: None.

### Every rule carries its reason (and there are only seven)
- Bucket: BRAIN
- The idea in one plain sentence: Write each instruction to your AI with its reason in the next sentence, keep to about seven, and put the non-negotiables first.
- Why it matters: Reasons let AI handle cases you never wrote down; at 90 percent compliance per instruction, ten instructions all land together only about a third of the time; late rules drop first.
- Source: `skills/ctrl-build/SKILL.md`, `skills/ctrl-build/leaves/writing.md`, `skills/ctrl-compile/SKILL.md`, `skills/ctrl-compile/leaves/criteria.md`. Quotes: "Every MUST or NEVER carries its reason in the next sentence." / Bad: "NEVER use bullet points." Good: "Avoid bullet points here. The board reads this as a continuous argument and bullets fragment it into a list of unrelated facts." / "Seven criteria maximum per surface."
- Real-world example: "Without it you get literal compliance and no judgment, which is worse than no rule at all."
- "Do this today": Take your custom instructions, cut to seven lines, reorder by importance, add "because..." to each.
- Strength: 4
- Sensitivity: None.

### Would a bad piece of work also pass this rule?
- Bucket: BRAIN
- The idea in one plain sentence: A quality rule is only useful if work you'd reject breaks it and work you'd send keeps it; if everything passes, it's describing the format, not your standard.
- Why it matters: The repo cites a naive generated rubric scoring worse than no rubric at all; vague rules give false confidence.
- Source: `skills/ctrl-compile/SKILL.md`, `skills/ctrl-compile/leaves/criteria.md`, `CHALLENGE.md` (CH-03, CH-04). Quotes: "would a bad piece of work also pass this?" / "a rubric that everything passes is not a standard, it is a description of the medium." / "If you cannot say what someone would point at in the artefact, you have a value, not a criterion."
- Real-world example: "Earned claim": observable = "a named client fact appearing before the third paragraph"; 7 of 9 rejected items failed it, 1 of 11 accepted items did. Keep.
- "Do this today": For each rule in your AI instructions, ask "what would I point at on the page to show it's there or missing?" Delete rules with no answer.
- Strength: 4
- Sensitivity: "Earned claim" example derives from client work; keep it generic.

### Tell the AI your level, not your personality type
- Bucket: BRAIN
- The idea in one plain sentence: Tell your AI where you're expert and where you're a beginner, with the consequence ("don't explain basics"), and skip MBTI, learning styles and personality labels.
- Why it matters: Help that suits a beginner measurably slows down an expert (expertise reversal); learning styles have failed proper testing and persona matching has no evidence of better outcomes.
- Source: `skills/ctrl-compile/leaves/profile.md` ("Evidenced, not claimed"), `skills/ctrl-intake/leaves/live-session.md` ("Never ask about learning style"), `docs/history/2026-09-07-md (5).md` (Part 6). Quotes: "Claude, day to day: EXPERT... Consequence: do not explain basics. Do not scaffold. He will read it as being talked down to." / "Learning styles are dead at an effect size of 0.04." / "Prior knowledge, not a stable 'learning style,' is the dominant variable."
- Real-world example: "Someone who built their own scheduled briefing between two calls is an expert and scaffolding will read as condescension."
- "Do this today": Add two lines to your profile: "Expert in X: skip basics" and "New to Y: explain the first time, then stop."
- Strength: 4
- Sensitivity: None.

### Write down what the AI will get wrong about you by default
- Bucket: BRAIN
- The idea in one plain sentence: Add a "correct priors" section: what any model will do by default, and what you need instead, in the situation it applies to.
- Why it matters: Targets the specific generic behaviour that costs you editing time, instead of hoping a general instruction catches it.
- Source: `skills/ctrl-compile/leaves/profile.md` ("The section that prevents the failure"), `skills/ctrl-build/leaves/writing.md` (Gotchas describe the mistake before the correction). Quotes: "Each line states what the model will do by default and what this person needs instead." / "The model will open with a summary of last quarter. He already knows last quarter. Open with the number that moved."
- Real-world example: "A gotcha that only states the correction leaves the reader unable to recognise the situation."
- "Do this today": Write three "The AI will default to... I need instead..." lines for your most common task.
- Strength: 4
- Sensitivity: None.

### Keep a "decisions made" list so you stop reopening them
- Bucket: BRAIN
- The idea in one plain sentence: Record the calls you've already made (and the ones you killed, with why) in your AI memory so neither you nor the AI relitigates them.
- Why it matters: Reopening settled decisions wastes meetings and lets AI "helpfully" undo past choices.
- Source: `docs/history/2026-09-07-doc-memory-prompt-pack.md` (Step 3, DECISIONS MADE), `docs/history/2026-09-07-doc-vibe-coding-mastery.md` ("KNOWN DECISIONS AND WHY... prevents the AI from 'helpfully' un-doing past decisions"), `docs/history/2026-09-07-doc-autonomous-business.md` ("The same closed call doesn't reopen"), `CHALLENGE.md` (rulings "not relitigated"). Quotes: "Ask me which calls I keep relitigating, a decision I have already made but my team or I keep reopening." / "decide once, stays decided."
- Real-world example: CHALLENGE.md itself: 23 challenges ruled on one day, "locked... and is not relitigated."
- "Do this today": List three decisions you or your team keep reopening; add them to your memory file with the reason.
- Strength: 4
- Sensitivity: None.

### Facts in your AI memory have a use-by date
- Bucket: BRAIN
- The idea in one plain sentence: "Our Q3 priority" or "my manager is X" go stale; the biggest memory risk isn't forgetting, it's an old fact served with confidence.
- Why it matters: Stale context produces wrong advice that sounds right; an old fact and a new one side by side quietly contradict each other.
- Source: `docs/history/2026-09-07-CTRL-BRAIN-ARCHITECTURE.md` (Δ2 validity windows, Δ3 contradiction at write), `docs/history/2026-09-07-AI Memory Systems ... Canonical Reference (2025-2026).md` (ghost-fact problem, dead zones), `docs/history/2026-09-07-CTRL-MARKET-READ-SPEC.md` (category-aware freshness). Quotes: "Stale memory served with confidence is the #1 production risk." / "close the old fact's valid_until instead of only flipping is_current" / "an identity fact ≈ forever; a tactical priority ≈ weeks."
- Real-world example: Converting "yesterday" or "last week" to an actual date before storing it, so the fact still means something next month.
- "Do this today": Put a date next to every priority in your memory file, and on Friday delete or update anything older than a month.
- Strength: 4
- Sensitivity: Internal architecture detail; teach the principle only.

### One brain, many tools (plain text you own)
- Bucket: BRAIN
- The idea in one plain sentence: Keep your context as plain text you own, then repackage the same facts for each tool (ChatGPT, Claude, Gemini, coding tools) instead of rebuilding it inside each platform.
- Why it matters: Switching tools, jobs or companies stops wiping your history; your context becomes a portable asset, not rent paid to a platform.
- Source: `training/anchor.yaml` (export_voice_cards per target), `docs/history/2026-09-07-doc-ai-identity-memory.md` (F18), `docs/history/2026-09-07-doc-autonomous-business.md` (Six Paths), `docs/current/commercial.md`. Quotes: "Three tools. One brain behind all of them." / "The code is replaceable. The context layer is the moat." / "still yours when you change tools, jobs, or companies."
- Real-world example: Same facts, different packaging: ChatGPT "second-person, directive, no prose preamble"; Claude Code "imperative, convention-heavy, terse"; universal "my-ai-context.md".
- "Do this today": Save your identity and memory files in a folder you control (not only inside one app) and paste them into a second AI tool to compare.
- Strength: 4
- Sensitivity: None.

### Short main file, topic files on demand
- Bucket: BRAIN
- The idea in one plain sentence: Don't cram everything into one giant instruction file; keep a short main file that points to separate topic files you load only when needed.
- Why it matters: Bloated files get ignored and dilute the important rules; focused files keep answers sharp and cheaper.
- Source: `skills/ctrl-build/leaves/package.md` (router under 80 lines, references one level deep), `docs/history/2026-09-07-md (5).md` (progressive disclosure), `docs/history/2026-09-07-doc-vibe-coding-mastery.md` ("Multiple focused files work much better than one massive document"). Quotes: "the heaviest skills have the thinnest instructions." / "If a standard is two hops from the router, it does not exist." / "cramming everything into a single root file until it becomes bloated and ignored."
- Real-world example: The "four-file operations manual": constitution/rules, what has been built, reusable skills, design system.
- "Do this today": Split your longest custom instruction into a one-paragraph core plus one separate "how I write emails" file you paste only when writing emails.
- Strength: 4
- Sensitivity: None.

### Skills: write down "do this when that"
- Bucket: BRAIN
- The idea in one plain sentence: Turn any task you explain repeatedly into a reusable skill file, and spend most of the effort on the one-paragraph description of when to use it, in the messy words you actually type.
- Why it matters: Repeated know-how gets applied consistently without re-explaining; the common failure is the skill never triggering, not triggering too often.
- Source: `skills/ctrl-build/leaves/writing.md` ("The description is 80 percent of the skill"), `skills/ctrl-capture/SKILL.md` (undertrigger phrasing), `docs/history/2026-09-07-doc-vibe-coding-deck.md` (skills files), `docs/history/2026-09-07-md (6).md` (53% of public skills copied verbatim). Quotes: "Real users type messily. If every trigger phrase is a clean command, it will not fire on anything anyone actually types." / "that phrasing is the fix and it goes into the description's trigger list."
- Real-world example: Good test prompt: "ok so my sales team just posted their updates in slack and I need to get the board update done before my 10am... can you pull it together?" Bad: "Please create a board update from the sales team data."
- "Do this today": Write one skill for your most-repeated task with five trigger phrases taken from how you actually ask for it.
- Strength: 4
- Sensitivity: None.

### Pull out what your AI already knows about you
- Bucket: BRAIN
- The idea in one plain sentence: If you already use an AI tool a lot, ask it to summarise what it knows about how you work, check it, and paste the non-sensitive parts into your new setup.
- Why it matters: Instant rich context with near-zero effort; you start from your history, not a blank page.
- Source: `docs/KIT-REDESIGN-SPEC.md` (homework step), `docs/_INTERROGATION_RESULTS.json` (Q6, Krish's answer), `docs/history/2026-09-07-CTRL-CORPUS.md` (Law 5). Quotes: "Before we build, pull in what your AI already knows about you." / Krish: "copy paste a non sensitive reply from their AI tool if they use one extensively, which would give the app immediate rich high quality inferences across lots of topics."
- Real-world example: The Kit's homework step was moved from a card behind a loading spinner (nobody could do it) to its own screen.
- "Do this today": Ask your main AI tool: "Summarise how I work, what I care about and what I keep correcting you on." Edit the answer and save it.
- Strength: 4
- Sensitivity: None.

### Teach with specific incidents, not "your method"
- Bucket: BRAIN
- The idea in one plain sentence: Asking an expert "how do you do it?" gets a generic answer; asking "tell me about a specific time it went wrong and what you noticed" gets the real judgment.
- Why it matters: The knowledge that makes you good isn't consciously available on demand; incidents and narrated real work are how you capture it for AI (or a new hire).
- Source: `skills/ctrl-intake/leaves/live-session.md` (Minutes 70 to 90), `docs/history/2026-09-07-md (2).md` (Critical Decision Method), `docs/history/2026-09-07-md (6).md` (Section 7: record the task four times while narrating, AI interrogation; CEO constitution). Quotes: "Asking an expert what makes good work produces a plausible, generic, useless answer, because the knowledge is not consciously available on demand." / "Not the method, specific rooms on specific days." / "An SOP is complete when someone can make the same decisions as you."
- Real-world example: Probes: "What were you seeing or hearing at that moment? ... How might someone new have got this wrong?"
- "Do this today": Voice-note yourself doing one routine task while saying every decision out loud, then ask an AI to interview you about the decision points.
- Strength: 4
- Sensitivity: The "four times on four days / 240 questions / 99.9%" method is from a third-party podcast (unverified); attribute or paraphrase.

### Don't let AI diagnose you from one data point
- Bucket: BRAIN
- The idea in one plain sentence: A "pattern" about you needs evidence from at least two separate occasions plus something you said you intended; anything thinner is just a question worth asking.
- Why it matters: AI is happy to tell you who you are from one email; acting on a false read of yourself or a colleague is costly.
- Source: `docs/current/product.md` and `docs/current/commercial.md` (Blind Spot evidence floor), `docs/current/design-state.md` ("A pattern is a supported inference, never a model claim presented as fact"), `skills/ctrl-intake/leaves/transcripts.md` ("He asked for bullets once is an observation"). Quotes: "A Blind Spot pattern needs one current verified intention and two independent recurrence records. Anything thinner is labelled as a tension and asks one question." / "Rejecting a read stores only the reason... CTRL does not repeat it until those inputs change."
- Real-world example: An accepted read creates "one 15-minute experiment and one later briefing check-in", not a personality label.
- "Do this today": Next time an AI says "you tend to...", ask it to show the two separate pieces of evidence; if it can't, treat it as a question.
- Strength: 4
- Sensitivity: Never use real Blind Spot content (on the never_publish list).

---

## LEVEL UP (habits, workflows, review loops, delegation, verification)

### Keep the first and last 20 percent
- Bucket: LEVEL UP
- The idea in one plain sentence: Let AI do the middle 60 percent of a task, but you frame it at the start and judge it at the end, because that's where quality and your skill live.
- Why it matters: You get the time saving without losing judgment or ownership; outputs stay yours.
- Source: `docs/_INTERROGATION_RESULTS.json` (Q7, Krish), `docs/history/2026-09-07-doc-autonomous-business.md` (Four Pre-Build Questions), `docs/history/2026-09-07-CTRL-CORPUS.md` (Clarity Loop step 3, Law 3). Quotes: Krish: "the whole point of mindmaker is to sharpen their judgement, so we need to ensure they do the first and last 20% themselves." / "Keep the first 20% (framing) and last 20% (checking). That's where the quality lives." / "80% automated with your taste on top beats 100% done by hand."
- Real-world example: The four pre-build questions: Will I repeat it? Can a system do the middle 60%? Do I keep the first and last 20%? Will I reinvest the saved time?
- "Do this today": On your next AI task, write the framing yourself (goal and bar) before prompting, and do a final pass yourself before sending.
- Strength: 5
- Sensitivity: None.

### The leverage audit question
- Bucket: LEVEL UP
- The idea in one plain sentence: Ask "what did I do this week that I'll do again next week, and could a system do it 80 percent as well?", score each by hours times closeness to revenue, and pick only the top three.
- Why it matters: Points AI at what's expensive, not what's easy or annoying; produces a focused 90-day list in five minutes.
- Source: `docs/history/2026-09-07-doc-vibe-coding-deck.md` (Framework 21), `docs/history/2026-09-07-doc-autonomous-business.md` (Leverage Audit), `docs/history/2026-09-07-doc-mindmaker-maven.md`. Quotes: "Repetition is the signal, not how much it annoys you." / "Discipline beats ambition." / Classic mistake: "automating what is easy instead of what is expensive."
- Real-world example: Pipeline qualification 4.0 hrs x 5 = 20; content engine 6.0 x 3 = 18; proposal formatting 2.0 x 1 = 2.
- "Do this today": List every repeated weekly task, score hours x revenue-closeness (1 to 5), circle the top three, ignore the rest.
- Strength: 5
- Sensitivity: None.

### Delegate, template, automate, or kill
- Bucket: LEVEL UP
- The idea in one plain sentence: Sort each task by how often you do it and how much judgment it needs: frequent and judgment-heavy, AI drafts and you approve; rare and judgment-heavy, build a template; frequent and low-judgment, automate; rare and low-judgment, stop doing it.
- Why it matters: Prevents wasting effort automating work that shouldn't exist at all.
- Source: `docs/history/2026-09-07-doc-vibe-coding-deck.md` (Framework 19, Action Matrix). Quotes: "HIGH FREQ · HIGH JUDGMENT → Delegate: AI drafts. You approve." / "LOW FREQ · LOW JUDGMENT → Kill: Do not even build it. Stop doing it." / "Most things you're tempted to vibe-code first are actually quadrant 4. Don't."
- Real-world example: Ties to the leverage audit; most "cool automation" ideas land in Kill.
- "Do this today": Put your top ten tasks in a 2x2 and cross out everything in the Kill box.
- Strength: 5
- Sensitivity: None.

### The five-part brief: every blank becomes a bug
- Bucket: LEVEL UP
- The idea in one plain sentence: Before asking AI to build or write anything substantial, give it Goal, Context, Format, Constraints and Acceptance ("how will I know it worked?"), all at once.
- Why it matters: A half brief doesn't get half a result, it gets a mess you pay for twice; complete briefs cut rework.
- Source: `docs/history/2026-09-07-doc-vibe-coding-deck.md` (Framework 4, 5), `docs/history/2026-09-07-doc-vibe-coding-mastery.md` (one-pass execution), `docs/history/2026-09-07-doc-mindmaker-maven.md`, `docs/KIT-REDESIGN-SPEC.md` ("you have done this correctly when..."). Quotes: "Every blank becomes a bug. Every assumption becomes a hallucination. Every vague verb becomes an outage." / "Small and complete beats large and incomplete, every time." / "It's an execution, not a conversation."
- Real-world example: The speaker-briefing parable: submitting 16 of 20 briefs then adding standards later means redoing the first 16 and drifting on the last 4. "Wait until all 20 are in, set every standard, and submit one complete, fully specified brief once."
- "Do this today": Rewrite your next prompt under five headings, ending with "You've done this correctly when..."
- Strength: 5
- Sensitivity: None.

### One task, one conversation
- Bucket: LEVEL UP
- The idea in one plain sentence: Start a fresh chat for each new task, and the moment you say "also", "while you're at it" or "no, I already told you that", stop and restart with a clean summary.
- Why it matters: Long chats quietly forget early instructions ("context rot"); restarting is always faster than repairing a drifted session.
- Source: `docs/history/2026-09-07-doc-vibe-coding-mastery.md` (Start Fresh When checklist; plan mode vs execute mode), `docs/history/2026-09-07-doc-vibe-coding-deck.md` (Framework 6, 9), `docs/history/2026-09-07-md (1).md` and `md (5).md` (context rot measured). Quotes: "The moment you find yourself saying 'next,' 'also,' or 'while you're at it,' that's your cue to start a fresh session." / "Starting fresh with a clean context document is always faster than trying to repair a drifted session." / "Never explore and execute in the same thread."
- Real-world example: Triggers listed: over 30 to 40 messages, AI contradicting itself, a new feature, "no, I already told you that."
- "Do this today": When a chat goes wrong, ask it for a five-line summary of decisions so far, open a new chat, paste the summary, continue.
- Strength: 5
- Sensitivity: None.

### Point to the line: AI can fix what it can't find
- Bucket: LEVEL UP
- The idea in one plain sentence: Don't say "fix this" or "check your work"; ask "why is this breaking?" or point to the exact line that's wrong, because AI is bad at finding its own mistakes but good at fixing them once located.
- Why it matters: Avoids patches on patches (rework that compounds) and gets correct fixes faster.
- Source: `docs/history/2026-09-07-doc-vibe-coding-mastery.md` (Debug Voice), `docs/history/2026-09-07-doc-vibe-coding-deck.md` (Framework 9), `docs/history/2026-09-07-md (5).md` (Part 5: models "can correct outputs, if given information about the mistake location"). Quotes: "Ask the AI to diagnose before solving: 'Why is this breaking?' not 'Fix this bug.'" / "Patches-on-patches is how technical debt quietly accelerates." / "build the external error-location signal... not a generic 'review your work' prompt."
- Real-world example: Warning sign: "You're patching AI patches, three layers deep."
- "Do this today": Next time AI output is wrong, quote the specific sentence back and say what's wrong with it, instead of "try again".
- Strength: 5
- Sensitivity: Research claims (Tyen et al., Huang et al.) should be cited carefully if named.

### Never let a worker grade its own homework
- Bucket: LEVEL UP
- The idea in one plain sentence: Don't ask the same AI chat that wrote something to review it; review in a fresh chat, with a different model, against something real, or yourself.
- Why it matters: Self-review without an outside signal can make answers worse (research cited shows accuracy drops after "are you sure?" rounds); outside checks catch what self-checks miss.
- Source: `skills/ctrl-build/SKILL.md`, `skills/ctrl-check/SKILL.md`, `skills/ctrl-capture/SKILL.md`, `docs/history/2026-09-07-doc-ai-identity-memory.md`, `docs/history/2026-09-07-doc-autonomous-business.md` (four-tier audit panel), `docs/history/2026-09-07-md (4).md` and `md (5).md`, `CHALLENGE.md` (process: challenger passes ran on a different model; CH-14). Quotes: "Never review a package in the same conversation you built it in: paste it into a fresh session." / "Treat what you are given as an external submission, even if it was produced in this same conversation." / "intrinsic self-correction... reliably degrades reasoning-task performance."
- Real-world example: Krish's audit panel: Truth (claims vs source), Standards (voice), Aesthetics ("does it actually look good?"), Completeness ("Catches the false green").
- "Do this today": Paste your last important AI draft into a brand-new chat and say "This was written by someone else. Review it against these three standards."
- Strength: 5
- Sensitivity: None.

### Check the real thing, not the report
- Bucket: LEVEL UP
- The idea in one plain sentence: AI fails confidently, so verify the actual file, row, email or page rather than its claim that the job is done.
- Why it matters: A false "done" is worse than a visible failure; it destroys work while reassuring you.
- Source: `docs/history/2026-09-07-doc-autonomous-business.md` (Felix Rule #142), `docs/history/2026-09-07-doc-vibe-coding-deck.md` (Framework 25), `docs/history/2026-09-07-BUILD-PARTNER-PLAYBOOK.md` (LAW #0; the #193 data-loss bug), `docs/history/2026-09-07-BUILD-CHRONICLE.md` (the breach), `docs/current/release-state.md` ("Schedule presence is not execution proof"). Quotes: "A stuck human goes quiet. A stuck AI reports a confident green tick." / "A false alarm wastes your time. A false green destroys the work while reassuring you it's thriving." / "verify the STORED RESULT, not just that the UI advanced."
- Real-world example: An agent shipped an empty export and reported success; the dashboard glowed green. The new rule: "verify row-count > 0 before marking any export complete." Separately, an AI coding partner told Krish a redesign was live and blamed his browser cache; nothing had been built. His words: "This is a shocking set of lies."
- "Do this today": For one thing AI "did" for you this week (sent, saved, updated), open the actual destination and confirm it's there.
- Strength: 5
- Sensitivity: The breach story is Krish's own and powerful, but it involved Claude; decide framing deliberately. Felix is an internal agent name.

### Done has six meanings
- Bucket: LEVEL UP
- The idea in one plain sentence: "Done" hides several different states (drafted, sent, received, live, actually working for the person), so name which one you mean and never collapse them.
- Why it matters: Most delegation failures are "it was done" meaning different things to different people, including to your AI.
- Source: `docs/current/release-state.md` (Release status vocabulary), `CLAUDE.md` ("distinguish built, committed, merged, deployed, live, and verified"), `docs/agent-instructions/verification.md`, `NOW.md` ("merged is not deployed, and deployed is not verified"). Quotes: "Never collapse these into 'done.'" / "A local fixture cannot prove production. A green deployment status cannot prove the user path."
- Real-world example: Built, Committed, Merged, Deployed, Live, Verified, each with a different proof.
- "Do this today": Write your own ladder for one recurring task (e.g. drafted, approved, sent, opened, replied) and ask AI agents to report which rung they reached.
- Strength: 4
- Sensitivity: None.

### Dry run, and read the samples, not the counts
- Bucket: LEVEL UP
- The idea in one plain sentence: Before letting AI change lots of your content at once, run it in "show me what you'd change" mode and read the actual examples, not just the summary number.
- Why it matters: Small numbers hide big mistakes; one bad rule applied to everything silently corrupts records.
- Source: `NOW.md` ("The dry run was the point"), `docs/current/release-state.md` ("The backfill, and what its dry run caught"), `docs/current/design-state.md`. Quotes: "Dry-run any transform that rewrites user content, and read the samples rather than the counts." / "it wanted to change exactly two [rows], and both changes were wrong."
- Real-world example: A privacy clean-up meant to strip other people's names would have turned "VP Eng" into "VP" (reading "Eng" as a surname) and deleted Krish's own name from "No Head of Product, Krish doing PM and CEO simultaneously", inverting the sentence. The same bug was live on the main path.
- "Do this today": Before any bulk AI edit (find-and-replace, mass email personalisation), ask for five before/after samples and read every one.
- Strength: 5
- Sensitivity: Counts (196 rows) are internal; the story itself is fine and Krish already flags it as a writer's angle in NOW.md.

### Internal is free, external is gated
- Bucket: LEVEL UP
- The idea in one plain sentence: Let AI read, organise, draft and analyse freely, but anything that leaves the building (send, post, commit, spend, sign) waits for your yes.
- Why it matters: Gets most of the speed with almost none of the "what if it emails a client?" risk.
- Source: `docs/history/2026-09-07-doc-autonomous-business.md` (Framework 11), `docs/history/2026-09-07-doc-mindmaker-maven.md` (approval gates), `docs/agent-instructions/marketing-sales.md` ("Drafting or link creation never authorizes sending"), `docs/current/documentation-standards.md`. Quotes: "Internal is free. External is gated." / "The boundary isn't a limit on the system. It's what makes it safe to let run." / "anything external, expensive, or irreversible waits for a human."
- Real-world example: Krish's solopreneur week: "7% praying it doesn't email a client."
- "Do this today": Write your personal list: things AI may do without asking, and things it must always ask first. Add it to your identity file.
- Strength: 5
- Sensitivity: None.

### Green, amber, red: draw the handoff line task by task
- Bucket: LEVEL UP
- The idea in one plain sentence: For each task in a job, decide whether AI runs it (green), AI drafts and you approve the handoff (amber), or only you do it (red), and design the amber handoffs carefully because that's where things break.
- Why it matters: Failures cluster at the handoff, not in the model; deciding at task level (not department level) makes delegation concrete and safe.
- Source: `docs/KIT-REDESIGN-SPEC.md` (5.2 autonomy model), `docs/history/2026-09-07-doc-agentic-org-chart.md` (Handoff Zone), `docs/history/2026-09-07-doc-icp.md` (Decompose at task level), `docs/history/2026-09-07-doc-mindmaker-maven.md` (agent-led / assisted / never). Quotes: "The handoff is the product, not the model." / "Every undesigned handoff is a liability." / "Assisted: the work a human does better with an agent alongside, the highest-value tier most miss."
- Real-world example: The org-chart kit's honesty floor: "a box touching a flagged guardrail can never be left agent-led."
- "Do this today": Take one recurring workflow, list its five steps, colour each green/amber/red, and write what you check at each amber step.
- Strength: 5
- Sensitivity: None.

### Three questions before you rely on something AI built
- Bucket: LEVEL UP
- The idea in one plain sentence: Ask who will use it, what happens if it breaks, and how long it must live; if two of the three are high-stakes, get a professional to review it.
- Why it matters: Fast AI-built tools become load-bearing without anyone deciding they should; this catches the moment before it costs money or trust.
- Source: `docs/history/2026-09-07-doc-vibe-coding-deck.md` (Frameworks 14 to 18: safety dial, three handoff questions, safety ladder, governance habits). Quotes: "It's a dial you turn down as the stakes go up." / "Vibe coding is for possibility; engineering is for responsibility." / "the danger isn't the tool, it's letting a fast, confident, unreviewed thing become load-bearing without anyone deciding it should."
- Real-world example: The London Whale spreadsheet system-of-record error (cited in the deck; verify before use).
- "Do this today": List the AI-built tools or spreadsheets you rely on and run the three questions on each; give each an owner.
- Strength: 4
- Sensitivity: Verify the London Whale figure before quoting.

### Start with two, not twelve
- Bucket: LEVEL UP
- The idea in one plain sentence: Automate one simple, shallow workflow first and get the handoff working before adding more, because errors multiply across steps.
- Why it matters: Small wins compound; ambitious multi-step automations fail quietly (90 percent accuracy over 8 dependent steps is about 43 percent).
- Source: `docs/history/2026-09-07-doc-autonomous-business.md` (2 → 5 → 14), `docs/history/2026-09-07-Agentic Org Chart  Knowledge Corpus ... .md` (Domain 3 "stitching trap", Domain 4 sequencing). Quotes: "Start with two agents. Not twelve." / "Get the handoff working. Earn scale." / "The right first build is the workflow that ranks high on data readiness and pain, has shallow integration, has a named operator... The high-ROI workflow gets built second."
- Real-world example: "Fourteen agents today · it started with two."
- "Do this today": Pick the simplest repeated task from your leverage audit (not the most valuable) and automate only that this week.
- Strength: 4
- Sensitivity: The 43 percent maths is simple arithmetic and safe to show.

### Run it by hand once before you automate it
- Bucket: LEVEL UP
- The idea in one plain sentence: Do the whole process manually once, with the exact prompts you'd automate, before building anything.
- Why it matters: One day by hand finds the broken assumptions that would otherwise be baked into an expensive build.
- Source: `CHALLENGE.md` (CH-17), `docs/PHASE-0.5-HANDRUN.md`, `docs/HARNESS-CHAIN-STATE.md`. Quotes: "Run the whole chain by hand once, before any code." / "One person (you), one day, zero code." / "If a pair comes out bad, do not quietly fix it; grade it as it came out and note it."
- Real-world example: The hand run would have found on day one that nothing actually fed the learning ledger (CH-01).
- "Do this today": Before setting up an automation, do the task once by copy-pasting each step through a chatbot and note where you had to step in.
- Strength: 4
- Sensitivity: None.

### Make the AI quote before it judges
- Bucket: LEVEL UP
- The idea in one plain sentence: When you ask AI to review work, require it to quote the exact passage before giving any verdict; no quote, no score.
- Why it matters: AI reviewers often barely read the thing they're judging; quoting forces attention and makes feedback checkable.
- Source: `skills/ctrl-check/SKILL.md`, `skills/ctrl-check/leaves/judgement.md`, `docs/history/2026-09-07-md (2).md` ("evaluation attends to context 3-5x less than generation and barely reads the candidate answer"). Quotes: "Quote the exact passage before scoring any criterion on it. No quote, no score." / "The default failure of any reviewer is a confident critique that is not actually looking at the work."
- Real-world example: Verdicts limited to holds / borderline / breaks; "A borderline is usable only if you name the single change that moves it to holds."
- "Do this today": Add to your review prompt: "For each issue, quote the exact sentence first, then say what's wrong and give a rewrite."
- Strength: 4
- Sensitivity: None.

### A review that only says no gets ignored
- Bucket: LEVEL UP
- The idea in one plain sentence: Every criticism (from AI or from you) should come with a rewrite of that passage and one "single most important change", not a list.
- Why it matters: Gates without fixes get routed around within a fortnight; one clear change gets acted on.
- Source: `skills/ctrl-check/SKILL.md` (Output format, Hard rules), `skills/ctrl-check/leaves/judgement.md` (Revision). Quotes: "Never return a bare rejection. Every breaks carries a revision of that passage." / "A gate that only says no gets bypassed. That is not a prediction, it is what happens, and it happens within about a fortnight." / "THE ONE THING: the single highest-consequence change. Not a list. One."
- Real-world example: The CHECKED / AGAINST / MECHANICAL / JUDGEMENT / PROVENANCE / THE ONE THING / REVISED output block.
- "Do this today": Steal the format: ask AI reviews to end with "THE ONE THING" and "REVISED".
- Strength: 4
- Sensitivity: None.

### Start your checks as warnings, not blocks
- Bucket: LEVEL UP
- The idea in one plain sentence: Any new rule or automated check should start as advice, be watched for false alarms over its first ten uses, and only then become strict.
- Why it matters: False positives make people ignore a check forever; an untrusted gate burns the credibility you'd need for a real one.
- Source: `skills/ctrl-check/leaves/judgement.md` (Disposition), `skills/ctrl-compile/reference/ctrl-import.md` ("disposition is always advisory on import"), `docs/history/2026-09-07-md (2).md` (Vale rollout), `docs/history/2026-09-07-doc-icp.md` (Digital Intern 100% review → Analyst 70% → Project Lead 30%). Quotes: "An untrusted gate is worse than no gate. It consumes the authority you would need to introduce a real one later, and you only get to spend that once." / "start lenient, tighten only after measuring false-positive rate."
- Real-world example: AI roles earning autonomy: Digital Intern (100% review), Digital Analyst (70%), Digital Project Lead (30%).
- "Do this today": Pick one AI helper and decide its review level (every output, most, spot checks); only loosen after two clean weeks.
- Strength: 4
- Sensitivity: The intern/analyst tiers come from a third-party ICP corpus; present as a framework, not a stat.

### Two strikes before a new rule, and every rule added removes one
- Bucket: LEVEL UP
- The idea in one plain sentence: Log every correction, but only turn it into a rule when it happens twice; and when you add a rule, delete one that hasn't fired in a while.
- Why it matters: One-offs create noisy, contradictory instructions; files that only grow look like progress for four months then degrade everything.
- Source: `skills/ctrl-capture/SKILL.md`, `skills/ctrl-capture/leaves/weekly.md`, `skills/ctrl-capture/leaves/method.md`. Quotes: "One occurrence: do nothing, leave it logged... Two or more across five weeks: it becomes a candidate." / "Every accepted change carries a deletion." / "A weekly pass that only adds looks like progress for about four months." / "Append, never rewrite" (one consolidation dropped context from 18,282 tokens to 122).
- Real-world example: "Earned claim" fired twice on emails and was pushed back both times: the rule was right for proposals and wrong for emails, so the fix was a scope change, not a rewrite.
- "Do this today": Start a simple correction log (date, what was wrong, why); on Friday promote only the repeats to rules.
- Strength: 4
- Sensitivity: None.

### Fix the class, not the instance
- Bucket: LEVEL UP
- The idea in one plain sentence: When AI makes a mistake, write the rule that prevents the whole category of that mistake, log the root cause not the symptom, and add the rule to your memory file.
- Why it matters: The same mistake stops recurring; corrections compound into a growing asset instead of vanishing in chat.
- Source: `docs/history/2026-09-07-doc-memory-prompt-pack.md` (Self-Correction Footer), `docs/history/2026-09-07-doc-ai-identity-memory.md` (Capture → Group → Write back), `docs/history/2026-09-07-doc-autonomous-business.md` (on_failure block, 167 rules), `docs/CTRL-SYSTEM-SPEC.md` ("a correction is a signal, not an overwrite"), `docs/history/2026-09-07-ITERATION-METHOD-NOTES.md` (promote the recurring fix into the system). Quotes: "Instance: 'do not misspell Lauren.' Class: 'confirm proper nouns against what I gave you before using them.'" / "A correction shouldn't vanish. It should become a rule." / "The same mistake does not get to happen twice."
- Real-world example: The footer appended to every file: "1. LOG what broke and the root cause. 2. PROPOSE one rule that prevents the whole class of this mistake. 3. On my approval, APPEND the rule to memory.md." And the CTRL UI line: "I noted what I got wrong - I won't infer that again."
- "Do this today": Paste the three-line footer at the bottom of your AI instructions, then feed it one real recent mistake and watch it propose a class rule.
- Strength: 5
- Sensitivity: "167 rules" and "four occurrences" are Krish's own metrics; confirm currency.

### Method corrections are the valuable ones
- Bucket: LEVEL UP
- The idea in one plain sentence: "This draft is wrong" fixes one output; "the way you produce drafts is wrong" fixes all future ones, so notice when your feedback starts with "you always" or "every time" and save it as a process change.
- Why it matters: Experts give method corrections, and they're the ones most likely to be agreed with in chat and lost.
- Source: `skills/ctrl-capture/leaves/method.md`, `skills/ctrl-check/reference/ledger.md`. Quotes: "if fixing only the artefact in front of you leaves the problem intact, it is a method correction." / "Someone who has to give the same structural note three times concludes, correctly, that nothing is listening."
- Real-world example: Krish twice: "why dont you bake the counter points in to the brief" became a structural change to how that class of document gets produced.
- "Do this today": Review your last week of AI chats for any "you keep..." comment and turn it into a workflow step in your instructions.
- Strength: 4
- Sensitivity: None.

### Measure repeat mistakes going down, not usage going up
- Bucket: LEVEL UP
- The idea in one plain sentence: The sign your AI setup is working isn't how much you use it or how many corrections you log, it's the same corrections appearing less often.
- Why it matters: Volume metrics reward busywork; repeat-correction decline proves the system is actually learning you.
- Source: `skills/ctrl-capture/SKILL.md`, `skills/ctrl-capture/leaves/method.md`, `docs/history/2026-09-07-md (4).md` and `md (5).md` (workslop: consumption metrics), `docs/history/2026-09-07-CTRL-CORPUS.md` (Law 7 kill vanity metrics), `docs/history/2026-09-07-phase0-honesty.md` (fake progress bars). Quotes: "Never measure this loop by corrections captured. Measure it by repeat corrections declining." / "'You're 12% sharper this week' was ranked last." / "A loop you can't see isn't a loop."
- Real-world example: CTRL removed "getting smarter" badges and health scores that animated over engines that weren't running.
- "Do this today": Tally how many times this week you corrected the same thing twice; check again next Friday.
- Strength: 4
- Sensitivity: None.

### Could this have been written for anyone?
- Bucket: LEVEL UP
- The idea in one plain sentence: Swap the name on an AI draft; if it still works for anyone else, it's a template with your name on it, not your work.
- Why it matters: Generic output wastes the reader's time and signals you didn't think; the single highest-consequence quality check, and no software can run it.
- Source: `skills/ctrl-build/leaves/writing.md`, `skills/ctrl-check/leaves/mechanical.md`, `skills/ctrl-check/leaves/judgement.md` (Signature lens), `training/anchor.yaml` (self-check gate). Quotes: "If you could swap the name and publish it verbatim, it is not a skill about this person, it is a template with their name on it." / "Run it by asking what in the piece could not have been written by someone who had never met them." / "Did the brief personalize the lead with user context, or is it generic? If generic, regenerate."
- Real-world example: The criterion "It has actually seen the client" versus its opposite "It could be for anyone."
- "Do this today": Before sending your next AI-assisted email, find the one sentence only you could have written; if there isn't one, add it.
- Strength: 5
- Sensitivity: None.

### The slop checklist
- Bucket: LEVEL UP
- The idea in one plain sentence: AI-written text has tells you can count: banned phrases, every sentence the same length, a padded section much longer than its neighbours, unsourced claims, and a throat-clearing first line.
- Why it matters: Cleaning these out makes AI-assisted work read as yours and stops "workslop" landing on colleagues.
- Source: `skills/ctrl-check/leaves/mechanical.md`, `skills/ctrl-build/leaves/writing.md`, `training/anchor.yaml` (dont_phrases), `standards/check-standards.mjs` (em dash build guard). Quotes: "Opens on a claim, not a windup. If the first sentence could be deleted with no loss, it is a breaks." / "Models write two to three times as much as humans even under an explicit word cap." / "Five consecutive sentences of similar length is a machine rhythm." / "True and unsourced is still a breaks in a document going to a client."
- Real-world example: Kill list: "In today's fast-paced world", "Let's dive in", "game changer", "leverage", "The result?" as its own line, sentences starting "Remember," or "Ultimately,".
- "Do this today": Delete the first sentence of your next AI draft and see if anything was lost; then cut it by a third.
- Strength: 4
- Sensitivity: Krish's em-dash rule is a house preference; present as his taste, not a universal law.

### Test with messy, worst-case inputs
- Bucket: LEVEL UP
- The idea in one plain sentence: Test your prompts and AI tools with the messy, typo-filled, half-explained requests you actually send on a Monday morning, not tidy examples.
- Why it matters: Things tuned to clean demos break on real use; "the graveyard is full of things that worked once on a Friday."
- Source: `skills/ctrl-build/leaves/writing.md` (Test prompts, exactly three), `docs/history/2026-09-07-ITERATION-METHOD-NOTES.md` (6: test the worst case), `docs/history/2026-09-07-_JOURNEY-BLUEPRINT.md` ("Robust to any content"), `docs/history/2026-09-07-doc-mindmaker-maven.md`. Quotes: "Messy, realistic, varied. The way someone types at nine on a Monday." / "Never tune a layout to a string." / "so the thing survives Monday instead of impressing you once on Friday."
- Real-world example: A stress gallery of 100 numbered worst-case cells, reviewed by number via voice notes.
- "Do this today": Write three messy versions of your usual request (one with a typo, one missing key info, one with irrelevant detail) and test your setup on all three.
- Strength: 4
- Sensitivity: None.

### React to the real thing, not a description of it
- Bucket: LEVEL UP
- The idea in one plain sentence: Have AI build a rough working version or mock you can see and click, then react to that, instead of debating a written spec.
- Why it matters: You catch problems you'd never see in prose; the person with the working demo wins the room and ideas stop dying in committee.
- Source: `docs/history/2026-09-07-ITERATION-METHOD-NOTES.md` (1, 2, 8: commit-blind reactions), `docs/history/2026-09-07-BUILD-PARTNER-PLAYBOOK.md`, `docs/history/2026-09-07-doc-vibe-coding-deck.md` (A prototype is a specification), `docs/CTRL-SYSTEM-SPEC.md` (verify on the real surface with real data). Quotes: "The mock is the unit of truth; the words about the mock are not." / "The person with the working demo wins the room." / "A junior PM with a prototype can move a decision a VP's memo couldn't." / "The PRD isn't dead. It just comes later."
- Real-world example: One mock, then pause, react, lock the decision in a log, next surface. "Can you number each one so I can refer to the number when giving feedback? I look and voice note whilst looking."
- "Do this today": Instead of describing a slide or form you need, ask AI for a rough version, then give numbered feedback on it.
- Strength: 4
- Sensitivity: None.

### Lock decisions as you go, and keep a failure log
- Bucket: LEVEL UP
- The idea in one plain sentence: Write each agreed decision down the moment it's made, and keep a running log of what broke and why, so you don't re-argue good work or re-fix the same bug in a new disguise.
- Why it matters: Saves hours of rework; "six fixes in nine days patched UI state transitions but never addressed the" real cause.
- Source: `docs/history/2026-09-07-ITERATION-METHOD-NOTES.md` (4), `docs/BRIEFING_GENERATION_HISTORY.md`, `docs/current/documentation-standards.md` (decisions append-only). Quotes: "Every reaction produced a LOCKED line in _DESIGN-LOG.md before the next surface started." / "Every 'generate/refresh briefing hangs' bug we've shipped has come back in a new disguise." / "future regressions almost always map back onto one of these ten failure modes."
- Real-world example: The briefing log of ten failure modes, each with symptom, root cause shape and fix.
- "Do this today": Start a two-column note "Decided / Broke and why" for your current AI project and add one line to each.
- Strength: 4
- Sensitivity: Commit hashes are internal; don't show.

### Build the system after the patterns appear (explore, extract, enforce)
- Bucket: LEVEL UP
- The idea in one plain sentence: Don't design your perfect AI workflow up front; experiment freely, notice what keeps working, then turn that into templates and rules.
- Why it matters: Premature systems lock in shallow patterns; earned ones stick.
- Source: `docs/history/2026-09-07-_JOURNEY-BLUEPRINT.md` (Systematize emergently), `docs/history/2026-09-07-ITERATION-METHOD-NOTES.md` (5). Quotes: "explore -> extract -> enforce: earn the pattern on real surfaces, abstract it once it's proven, then let it be the floor." / "nearly every one... was discovered through a wrong turn, not specified in advance." / Krish: "we should systemize as much as possible instead of just fixing one frame at a time."
- Real-world example: The design system came from the best surface built, "not from a guess on day one."
- "Do this today": Look back at your best three AI chats this month, find the common prompt pattern, and save it as a template.
- Strength: 4
- Sensitivity: None.

### Ask for options, not answers (and use judges)
- Bucket: LEVEL UP
- The idea in one plain sentence: Instead of "what should I do?", ask AI for three genuinely different options, then ask a separate critic to find what's wrong with each before you pick.
- Why it matters: Open questions overwhelm busy people and get average answers; divergence plus critique finds better solutions and keeps you the decider.
- Source: `docs/history/2026-09-07-CTRL-CORPUS.md` (Law 2, Clarity Loop), `docs/_INTERROGATION_RESULTS.json` (Q1, Krish), `docs/history/2026-09-07-_JOURNEY-BLUEPRINT.md` (Diverge, Judge, Synthesize), `docs/current/design-state.md` (three spines judged). Quotes: Krish: "open ended questions that force the user to think are not the way forward. Presenting them with options to choose from... is a much better call." / "Options, never open questions." / "adversarial judging kills plausible-but-wrong ideas."
- Real-world example: Blind Spot design: three concepts (tension instrument, signal trail, confidential case note) scored on a rubric; the winner borrowed the best of the losers.
- "Do this today": Ask: "Give me three genuinely different approaches, commit fully to each. Then, as a sceptical critic, attack each one."
- Strength: 4
- Sensitivity: None.

### Spend your thinking on the rule, not the keystrokes
- Bucket: LEVEL UP
- The idea in one plain sentence: Before asking AI to build anything, get crystal clear on the rule it should follow (what it may claim, the threshold, what happens when data is missing); the doing is the easy bit.
- Why it matters: A perfectly built thing on a fuzzy rule is wasted work; AI makes execution cheap, so clarity is where your value is.
- Source: `docs/history/2026-09-07-BUILD-PARTNER-PLAYBOOK.md` (§1 prime directive), `docs/history/2026-09-07-doc-vibe-coding-mastery.md` ("Most of the work is upstream of the tool"). Quotes: Krish: "99% of this task is crystal clarity on the rules and logic by which to execute. The execution is the easy bit." / "A correctly-built feature on a wrong or fuzzy rule is wasted work."
- Real-world example: A "memory importance" badge was correct code, but locking the rule first exposed that its label clashed with another concept and its number was an unvalidated guess.
- "Do this today": Before your next AI task, write the one-sentence rule for what a good result must and must not do.
- Strength: 4
- Sensitivity: None.

### Decompose the decision, then find the one assumption it rests on
- Bucket: LEVEL UP
- The idea in one plain sentence: Ask AI to break your decision into separate claims and label each as fact, market data, cause-and-effect, assumption or forecast, then name the single assumption that would sink the whole thing if wrong.
- Why it matters: AI is reliable at sorting and labelling even where it's unreliable at judging; you see what's checkable versus what's a bet.
- Source: `_upgrade/ctrl/DECISION-ENGINE-SPEC.md` (§4.2, §6), `docs/history/2026-09-07-intel-methodology-critical-thinking.md` (M1, M3), `docs/history/2026-09-07-DECISIONING CORPUS.md` (load-bearing assumptions, pre-mortem), `docs/CTRL-SYSTEM-SPEC.md` (decision memo). Quotes: "This typing step is the single biggest reliability lever. Models are reliable at extraction and classification even where they are unreliable at adjudication." / "Always an adversarial pass; always name the breakpoint assumption." / "If no evidence retrieved, verdict is unverified, never false."
- Real-world example: The one-page decision memo: the call, the case against, the breakpoint, evidence with sources, what to validate next.
- "Do this today": Paste a decision you're weighing and ask: "Split this into claims, label each fact/assumption/forecast, and tell me the one assumption that breaks it."
- Strength: 5
- Sensitivity: None.

### Who can actually answer this: the web, only you, or nobody yet?
- Bucket: LEVEL UP
- The idea in one plain sentence: Some parts of a decision can be checked online, some only you can know (your data, your team, your appetite for risk), and some nobody can know yet; never let AI answer the last two from the internet.
- Why it matters: Prevents confident web answers to questions about your own business; "only you" is homework, "nobody yet" means build for reversibility.
- Source: `docs/history/2026-09-07-CTRL-DECISIONING-FRAMEWORK.md` (§1 source_class, §6 internal-only wall), `docs/history/2026-09-07-DECISIONING CORPUS.md` (Part 2 category e, f). Quotes: "if source_class is 'Only you' or 'Nobody yet', the engine is FORBIDDEN to emit a verdict from external signal." / "'Only you' is homework you can do; 'Nobody yet' is unknowable, so build for reversibility / set a watch." / "External evidence can't see inside your business."
- Real-world example: Buy-vs-build an AI tool: cost crossover is checkable; "Is your data clean enough?" and "Could you spare the people?" are only-you; "the leaders over-rate their own data readiness."
- "Do this today": On your current decision, sort every question into three columns: Web can answer / Only I can answer / Nobody knows yet.
- Strength: 5
- Sensitivity: None.

### Make your call before you see the AI's
- Bucket: LEVEL UP
- The idea in one plain sentence: Write down your own answer to the key question before asking AI, then compare; the gap between your gut and the evidence is where you learn.
- Why it matters: Prevents anchoring on AI and keeps your judgment muscle working instead of atrophying.
- Source: `_upgrade/ctrl/PHASE-SPINE.md` (B6 "Make the call"), `docs/history/2026-09-07-CTRL-DECISIONING-FRAMEWORK.md` (§9 commit-first stance), `docs/history/2026-09-07-intel-methodology-critical-thinking.md` (M5), `docs/history/2026-09-07-ITERATION-METHOD-NOTES.md` (commit-blind reactions). Quotes: "Lock in my call and see CTRL's read." / "The gap between your gut and the ground is the thing to sit with." / "the one place the product makes the leader sharper rather than more dependent."
- Real-world example: "You disagreed. CTRL's read: Holds on headline price, but Contested at your real volume."
- "Do this today": Before asking AI about a choice, write your answer and confidence in one line; compare afterwards.
- Strength: 5
- Sensitivity: Note tension: Krish ranked "commit then stress-test" last in his own compass (Q8) and the CORPUS says not to force a commit gate; frame as optional practice, not a mandatory gate.

### Set the "what would change my mind" trigger
- Bucket: LEVEL UP
- The idea in one plain sentence: When you decide, write the one specific thing that would make you reverse it, then check for that later rather than relying on any system to watch for you.
- Why it matters: Turns a decision into a living one without constant re-litigating; you only revisit when the trigger trips.
- Source: `docs/history/2026-09-07-CTRL-DECISIONING-FRAMEWORK.md` (§9), `_upgrade/ctrl/DECISION-ENGINE-SPEC.md` (WATCH loop), `docs/history/2026-09-07-intel-decision-pipeline.md` (§6 founder's correction), `docs/_INTERROGATION_RESULTS.json` (Q21). Quotes: "the leader sets the disconfirming trigger by PICKING from 3-4... machine-checkable triggers." / Krish: "They are unlikely to let CTRL 'Watch' anything... Humans are not wired to report back to an app like its their manager."
- Real-world example: Triggers like "Our data audit comes back dirty" or "A renewal-price hike clause shows up."
- "Do this today": For one recent decision, write "I'd reverse this if..." and set a calendar reminder to check it.
- Strength: 4
- Sensitivity: None.

### Trust tiers for AI news and claims
- Bucket: LEVEL UP
- The idea in one plain sentence: Rank sources (the original announcement, record press, trade press, community and vendor marketing, rumour) and only believe a claim when two independent decent sources agree; ten vendor blogs are still vendor blogs.
- Why it matters: Saves you from acting on hype, benchmarks that don't match your work, and one-source scoops.
- Source: `docs/history/2026-09-07-CTRL-MARKET-READ-SPEC.md` (source tiers, clustering), `docs/CURATION-SYSTEM-SPEC.md` ("trust = corroboration, not a fancier vendor"), `docs/history/2026-09-07-CTRL-DECISIONING-FRAMEWORK.md` (haircut badges), `docs/history/2026-09-07-DECISIONING CORPUS.md` (failure-mode catalogue), `docs/history/2026-09-07-md (5).md` (vendor benchmarks vs independent tests). Quotes: "ten vendor blogs are still vendor blogs and cannot manufacture Holds." / "A cluster needs >=2 INDEPENDENT sources... a lone item is a weak signal, never the read." / "Benchmark does not predict your workload performance."
- Real-world example: "A vendor's factual release" (trustworthy) versus "the same vendor's marketing claim" (deep discount) can live on the same website.
- "Do this today": Next AI headline you want to act on, find a second independent source and the original announcement before sharing it.
- Strength: 5
- Sensitivity: Vendor benchmark gap numbers ("0.0% vs 90%") come from one independent harness; verify.

### Skip news with no move in it for you
- Bucket: LEVEL UP
- The idea in one plain sentence: Label each AI story as an opportunity, a shift, a risk or plain damage, and drop the damage (harm with nothing you can do about it).
- Why it matters: Cuts anxiety and reading time; keeps attention on things you can act on.
- Source: `docs/CURATION-SYSTEM-SPEC.md` (audience axis), `docs/current/architecture.md`, `NOW.md` (2026-09-02 change), `training/anchor.yaml` (hot-signal taxonomy: drop speculation without named sources, partnerships without commercial terms). Quotes: "a damage item only reports harm with no move in it for the reader." / "Bad news with an action attached stays: a changing hiring landscape is a shift, a credential-leak flaw is a risk."
- Real-world example: 12 of 476 cached stories were dropped as damage.
- "Do this today": Tag your saved AI articles O/S/R/D and unsubscribe from the source that's mostly D.
- Strength: 4
- Sensitivity: Counts are internal; fine to omit.

### Ask more than one model, and treat disagreement as data
- Bucket: LEVEL UP
- The idea in one plain sentence: On an important question, ask two or three different AI models; where they disagree is exactly where you need to think, so don't average it away.
- Why it matters: Agreement raises justified confidence; a split flags uncertainty you'd otherwise miss.
- Source: `_upgrade/ctrl/DECISION-ENGINE-SPEC.md` (§4.4), `docs/history/2026-09-07-intel-methodology-critical-thinking.md` (M4), `skills/ctrl-check/leaves/judgement.md` (lenses disagree), `docs/history/2026-09-07-LLM_CRITICAL_THINKING_TRAINING.md` (Practice 5). Quotes: "disagreement is written as a decision_tensions row... rather than averaged away." / "Disagreement between independent verifiers is signal, not noise." / "Do not average and do not pick. Report the disagreement and escalate."
- Real-world example: "Standard and Signature disagree on the opening... Worth a human look."
- "Do this today": Ask the same important question in two different AI tools and write down the one point they disagree on.
- Strength: 4
- Sensitivity: None.

### Reframe it to the AI-native version of the decision
- Bucket: LEVEL UP
- The idea in one plain sentence: Before answering a normal business question, ask what the AI-native version of it is.
- Why it matters: Stops you making yesterday's decision (e.g. a hire) when a cheaper, more scalable option now exists.
- Source: `docs/MAIN-APP-POLISH-SPEC.md` (§0 North Star, reframe examples), `docs/history/2026-09-07-doc-icp.md`. Quotes: "'Should I hire a VP of Sales?' -> 'Before you hire, should an agent own part of the sales motion first, and what would the human role become?'" / "we do not answer it as-is and we do not refuse it. We reframe it."
- Real-world example: "Should we raise prices?" becomes "Should the AI-native version of your offer change what you sell and how you price the AI capability itself?"
- "Do this today": Take the next hire or purchase on your list and ask "what part of this could an AI own first, and what would the human role become?"
- Strength: 4
- Sensitivity: None.

### Find the decision under the decision
- Bucket: LEVEL UP
- The idea in one plain sentence: The question you walk in with is usually not the real one; name the actual problem and the decision under it, then say the answer in one sentence a team could act on.
- Why it matters: Saves effort on the wrong problem; turns vague goals ("more personalised") into testable ones.
- Source: `docs/history/2026-09-07-doc-mindmaker-maven.md` ("The decision under the decision"), `docs/history/2026-09-07-doc-icp.md` (one-sentence articulation), `docs/history/2026-09-07-LLM_CRITICAL_THINKING_TRAINING.md` (hidden assumption surfacing). Quotes: "Most people discover it is not the one they walked in with." / "articulate the resulting product or operating model in one sentence a team can execute against." / "Often the question itself contains hidden assumptions."
- Real-world example: "How do we become AI-first?" reframed to "AI-optimized for strategic advantage in specific domains."
- "Do this today": Ask AI: "Here's my question. What hidden assumptions are in it, and what's the deeper question I should be asking?"
- Strength: 4
- Sensitivity: None.

### Five thinking prompts that make AI a sparring partner
- Bucket: LEVEL UP
- The idea in one plain sentence: Use a small kit of prompts: flip the frame (80 percent success is 20 percent failure), argue the other side, WOOP (wish, outcome, obstacle, plan), five whys, and "does this fit my values?"
- Why it matters: Cheap, repeatable checks on bias and wishful thinking for any decision.
- Source: `docs/history/2026-09-07-LLM_CRITICAL_THINKING_TRAINING.md`, `docs/history/2026-09-07-doc-critical-thinking.md`, `docs/history/2026-09-07-DECISIONING CORPUS.md` (Part 5: reversibility, pre-mortem, base rates, decision vs outcome). Quotes: "Our preference for an option is often a quirk of presentation, not genuine superiority." / "Does the recommended choice remain robust to framing?" / "Make decision informed by AI analysis, not determined by it."
- Real-world example: Pre-mortem: "It's 18 months later. The AI initiative failed. What happened?"
- "Do this today": Run "Stress test my thinking: weakest part, strongest counterargument, evidence that would change my mind" on one belief.
- Strength: 3
- Sensitivity: Many stats in that manual (70%, 60%, 47%) are unverified; don't quote.

### One-way doors, base rates, and judging process not luck
- Bucket: LEVEL UP
- The idea in one plain sentence: Ask whether a decision can be undone, start from how often similar decisions usually work out before thinking about your special case, and later judge yourself on how you decided, not on how it turned out.
- Why it matters: Spends analysis where it matters (irreversible calls), corrects optimism, and stops luck from teaching the wrong lessons.
- Source: `docs/history/2026-09-07-DECISIONING CORPUS.md` (Part 5), `docs/history/2026-09-07-CTRL-DECISIONING-FRAMEWORK.md` (Door Chip, Prior Line, decision-vs-outcome), `docs/history/2026-09-07-CTRL-BRAIN-ARCHITECTURE.md` (outcomes judged on process). Quotes: "Type 2 (reversible) decisions should be made fast with ~70% information; Type 1 (irreversible) demand full analysis." / "Always show the reference class distribution before the inside-view adjustment." / "judged on PROCESS not luck."
- Real-world example: "Buy is a two-way door IF the contract keeps a data-export clause. Build on your own fine-tuned data leans one-way."
- "Do this today": Label your next three decisions one-way or two-way and decide the two-way ones today.
- Strength: 3
- Sensitivity: Base-rate failure stats (80 to 95%) need verification.

### Claims ledger: verified, inferred, or deleted
- Bucket: LEVEL UP
- The idea in one plain sentence: Before publishing anything AI helped write, list each factual claim and mark it verified (with source), clearly labelled as inference, or removed; never soften an unsupported claim into plausible language.
- Why it matters: Protects your credibility and legal position; AI is fluent at plausible unsupported claims.
- Source: `docs/agent-instructions/marketing-sales.md` (Claims ledger), `docs/current/commercial.md` (Claim policy), `skills/ctrl-check/leaves/provenance.md` ("Never leave it in with a caveat"). Quotes: "An unsupported claim is omitted, not softened into plausible language." / "A hedged unsourced rule is still an unsourced rule and the hedge is the first thing that gets dropped when someone copies the line somewhere else."
- Real-world example: CTRL's own claim discipline: "CTRL holds personal data about you, and about nobody else" was allowed only after a backfill proved it, and "Do not upgrade it into a guarantee."
- "Do this today": Highlight every number and named fact in your next AI draft and add a source or delete it.
- Strength: 4
- Sensitivity: Don't reuse CTRL's specific claims as ad copy without Krish's intent.

### Answer the question asked, at the altitude asked
- Bucket: LEVEL UP
- The idea in one plain sentence: When someone asks a trust or risk question, answer exactly that question fully the first time, don't volunteer every caveat they didn't ask about, and then bring it back to the value.
- Why it matters: Over-explaining signals you think there's a problem; evading kills belief in your first answer.
- Source: `docs/current/commercial.md` (Disclosure ladder), `docs/agent-instructions/marketing-sales.md`. Quotes: "answer the question that was asked, at the altitude it was asked, then return to the value." / "Never pre-empt... Never evade... a buyer who has to ask twice stops believing the first answer."
- Real-world example: Tier 1, 2 and 3 answers to "Where does my data live?", "Who else touches it?", and a security questionnaire.
- "Do this today": When asked "is it safe to use AI for this?", give one plain answer, stop, and offer detail only if asked.
- Strength: 3
- Sensitivity: Commercial/sales context; tier answers reference CTRL specifics (Supabase, subprocessors). Keep generic.

---

## MINDSET (durable ways of thinking about working with AI)

### Saved time is tuition, not a refund
- Bucket: MINDSET
- The idea in one plain sentence: When AI saves you an hour, most people bank it back into the inbox; the few who get ahead reinvest it in teaching their AI and building a skill the next decade rewards.
- Why it matters: The same hour saved leads to three different futures; reinvestment is what compounds into career value.
- Source: `docs/history/2026-09-07-doc-agentic-org-chart.md` (Three Journeys, Collapse then Replace), `docs/history/2026-09-07-doc-ai-identity-memory.md` (Teaching Tax), `docs/UX-PRINCIPLES.md` (§3), `docs/history/2026-09-07-intel-methodology-models.md` (MODEL 1). Quotes: "the time AI saves you is not a refund. It's the salary you pay in teaching." / "SAME HOUR SAVED · THREE DIFFERENT FUTURES." / "If a feature saves time but teaches nothing, it is half-built."
- Real-world example: "The board pack drafts in twenty minutes, and the three hours go straight back into the inbox." Brick to skill: writing the analysis becomes framing the sharper question; first drafts become editorial taste; status updates become orchestrating a hybrid team.
- "Do this today": Next time AI saves you time, book 15 minutes of it to fix one AI mistake properly or practise one skill from the brick-to-skill list.
- Strength: 5
- Sensitivity: None.

### AI literacy comes before AI strategy
- Bucket: MINDSET
- The idea in one plain sentence: Use the tools yourself and build something small before you write an AI policy or plan, because you can't delegate the learning.
- Why it matters: Hands-on users get far more value than delegators (Krish cites "up to 12x"); policy written by non-users is performance.
- Source: `docs/history/2026-09-07-doc-vibe-coding-deck.md` (Thesis A, B), `docs/history/2026-09-07-doc-autonomous-business.md` (Thesis 1), `docs/history/2026-09-07-doc-icp.md` (Thesis 2, 4), `docs/history/2026-09-07-doc-mindmaker-maven.md`. Quotes: "Use it, form a literate opinion, then write the policy. That order is the whole game." / "'Non-technical' just stopped being a safe identity for a leader." / "the leaders generating 12x outcomes are the ones who returned to doing." / "The gap is not intelligence, it is reps."
- Real-world example: "AI is an operating skill, not a procurement call."
- "Do this today": Build one tiny thing for yourself with an AI tool (a checklist app, a formatter) before your next AI meeting.
- Strength: 5
- Sensitivity: The 12x figure is attributed to BCG via a secondary source; verify before saying it.

### Code was never the bottleneck: knowing what to build is
- Bucket: MINDSET
- The idea in one plain sentence: AI made producing things cheap, so the scarce skill is knowing what to build, what not to build, and when it's good enough, which is a business skill you already have.
- Why it matters: Repositions non-technical people as the most valuable builders; you keep strategy, judgment, distribution and responsibility.
- Source: `docs/history/2026-09-07-doc-vibe-coding-deck.md` (Thesis C, H; Framework 3, 20), `docs/history/2026-09-07-doc-vibe-coding-mastery.md` (Thesis 6). Quotes: "Code was never your bottleneck... It was knowing what to build, knowing what not to build, and being able to tell the difference." / "AI produces; humans take responsibility." / "You are the architect. AI is the contractor, and it works at 100x speed."
- Real-world example: "A contractor at 100x speed will build whatever you describe, including something structurally unsound, and it'll cut corners on the fire safety you didn't ask for."
- "Do this today": Write the four things you keep (strategy, judgment, distribution, responsibility) at the top of your next AI project note and who owns each.
- Strength: 5
- Sensitivity: None.

### You're hiring a new kind of worker, not buying a tool
- Bucket: MINDSET
- The idea in one plain sentence: Treat AI like a brilliant, tireless, very green new hire: onboard it, give it a job title, check its work, and correct it, because it fails in different ways from people.
- Why it matters: You already know management; it reframes AI from scary tech into something you can run, and explains why it needs supervision.
- Source: `docs/history/2026-09-07-doc-autonomous-business.md` (Theses 2, 5, 6), `docs/history/2026-09-07-doc-agentic-org-chart.md` (Two species), `docs/history/2026-09-07-doc-icp.md`. Quotes: "You're hiring a workforce, not buying a tool." / "This is a management problem wearing a technical costume. You already know management." / "You're training a brilliant, tireless, completely green four-year-old on fast-forward." / "Assume lying until proven otherwise... same standard as a new hire's first month."
- Real-world example: "Are you using it like an intern, or like a team?" and "Five interns, no manager."
- "Do this today": Write your AI a one-paragraph job description as you would for a new hire, including what it should escalate to you.
- Strength: 4
- Sensitivity: None.

### Workslop: polished output that creates more work
- Bucket: MINDSET
- The idea in one plain sentence: AI output that looks finished but needs reworking by whoever receives it isn't productivity, it's passing your work onto someone else.
- Why it matters: Damages trust with colleagues and clients; measuring "AI usage" rewards it.
- Source: `docs/history/2026-09-07-md (4).md` and `md (5).md` (BetterUp/Stanford workslop research), `skills/ctrl-check/leaves/mechanical.md` ("Every claim earned"). Quotes: "AI-generated work content that masquerades as good work, but lacks the substance to meaningfully advance a given task." / "workslop... is predicted specifically by 'conditions in which employees were asked to use AI,' not by usage volume itself."
- Real-world example: The research's figures (40 percent believe they received workslop last month) need verification before use.
- "Do this today": Before forwarding any AI-assisted document, ask "what will the reader have to fix or chase?" and fix it first.
- Strength: 4
- Sensitivity: Third-party research; cite BetterUp/Stanford and verify numbers.

### AI clarifies, you decide
- Bucket: MINDSET
- The idea in one plain sentence: Use AI to see the decision more clearly (evidence, tensions, the case against) but keep the final call, and aim for conviction you earned, not certainty you borrowed.
- Why it matters: You stay accountable and get sharper; you also can't blame the tool when it's wrong.
- Source: `docs/current/product.md` (Law 6), `docs/current/commercial.md` ("Will it decide for me? No."), `docs/history/2026-09-07-CTRL-DECISIONING-FRAMEWORK.md` (closing band), `docs/history/2026-09-07-ITERATION-METHOD-NOTES.md` (9), `docs/history/2026-09-07-doc-critical-thinking.md`. Quotes: "CTRL clarifies; the leader decides." / "Clearer, not decided." / "informed by AI analysis, not determined by it." / Krish: "I don't want this app to move towards being blamed for the wrong decision."
- Real-world example: The engine is "structurally incapable of recommending from a thin signal."
- "Do this today": Change one prompt from "what should I do?" to "lay out the considerations and the strongest case against; I'll decide."
- Strength: 4
- Sensitivity: None.

### Honest gaps beat fake confidence (in AI and in you)
- Bucket: MINDSET
- The idea in one plain sentence: Prefer tools and habits that say "I don't know" or "not established" over ones that fill gaps with plausible guesses, fake progress bars or "getting smarter" badges.
- Why it matters: Fake confidence is discovered at the worst moment and costs more trust than ten correct answers earn.
- Source: `docs/history/2026-09-07-phase0-honesty.md` (fake progress bars, vanity health scores), `docs/history/2026-09-07-BUILD-PARTNER-PLAYBOOK.md` (honesty in the renderer, confirmed vs inferred), `docs/current/commercial.md` (trust page lists what's missing), `docs/history/2026-09-07-_INTAKE-HARNESS-SPEC.md` ("never invent a specific fake count"). Quotes: "Never fake an unclosed loop." / "Distinguish confirmed (I ran it and saw the result) from inferred (it should work because...)." / "One invented detail costs more trust than ten correct ones earn."
- Real-world example: CTRL's progress labels were driven by timers, not real work ("the progress shown is theater"), and were removed; its /trust page openly lists controls it doesn't have.
- "Do this today": Ask your AI to end answers with "Confirmed:" and "Inferred:" lists.
- Strength: 4
- Sensitivity: None.

### The human work left gets harder, not lighter
- Bucket: MINDSET
- The idea in one plain sentence: When AI takes the routine work, every hour you keep is a high-judgment hour, so expect fewer tasks but denser, more draining decisions.
- Why it matters: Explains why AI adopters feel more stretched, not less; plan energy and calendars for it.
- Source: `docs/history/2026-09-07-doc-agentic-org-chart.md` (Field Note 02, 05), `docs/history/2026-09-07-doc-icp.md` (complexity taxes). Quotes: "Everyone sells relief." / "'We removed the busywork' lands as relief on the slide and as pressure in the seat." / "LIGHTER ORG, HEAVIER HUMANS · FEWER TASKS · DENSER DECISIONS." / "Automation doesn't remove the friction. It moves it upward."
- Real-world example: Krish's aim: "about twenty decisions a day; the system makes hundreds."
- "Do this today": Block one protected hour tomorrow for the hardest judgment call the AI freed you up for.
- Strength: 4
- Sensitivity: None.

### The ladder problem: automating the entry jobs removes the apprenticeship
- Bucket: MINDSET
- The idea in one plain sentence: Junior work is how people become senior; if AI does all of it, you (and your team) must deliberately build another way to learn judgment.
- Why it matters: Short-term savings can quietly starve the future talent bench; for individuals, skipping the reps leaves you unable to judge AI's output.
- Source: `docs/history/2026-09-07-doc-agentic-org-chart.md` (Field Note 04), `docs/history/2026-09-07-doc-icp.md` (Complexity tax 2), `docs/history/2026-09-07-md (5).md` (cognitive apprenticeship). Quotes: "You automate the entry roles, which is how seniors were made." / "YOU CAN'T SKIP THE LADDER AND KEEP THE SENIORS." / "The cut that pays back fastest is the one that starves your future bench."
- Real-world example: Cognitive apprenticeship's moves that still transfer: an expert "thinking aloud" (modelling) and making the learner explain their own reasoning (articulation).
- "Do this today": If you manage someone junior, have them do one task without AI this week and explain their reasoning to you.
- Strength: 4
- Sensitivity: None.

### The handoff line keeps moving
- Bucket: MINDSET
- The idea in one plain sentence: What you hand to AI versus keep yourself is not a one-time setting; capabilities change monthly, so redraw the line regularly.
- Why it matters: A fixed split ages fastest; the durable skill is recalibrating.
- Source: `docs/history/2026-09-07-doc-agentic-org-chart.md` (Field Note 06, Kasparov's centaurs), `docs/history/2026-09-07-doc-autonomous-business.md` (Thesis 12). Quotes: "The handoff line you draw today is already moving." / "I redraw mine weekly." / "THE WINNER IS THE BEST CONDUCTOR, NOT THE BEST PLAYER."
- Real-world example: Centaur chess: human+machine teams beat both, then "two amateurs with three computers beat the centaurs by out-orchestrating them", then AI overtook centaurs.
- "Do this today": Put a monthly reminder: "What did I keep doing by hand that AI can now do?"
- Strength: 3
- Sensitivity: None.

### Labour, work, action: what to hand off, share and keep
- Bucket: MINDSET
- The idea in one plain sentence: Repetitive labour goes to AI first, making durable things is shared, and starting something genuinely new (the angle, the call that risks trust) stays human.
- Why it matters: Gives a simple, non-technical sorting lens that frames AI as clarifying what's human rather than diminishing it.
- Source: `docs/history/2026-09-07-doc-agentic-org-chart.md` (2.14), `docs/history/2026-09-07-doc-autonomous-business.md` (Arendt's Three Lanes). Quotes: "Arendt drew this line in 1958. It sorts every task on the chart." / "NOT DIMINISHMENT · CLARIFICATION." / "plain language did the work; Arendt is just the credit line."
- Real-world example: Hand off "the 6am research sweep, first drafts, formatting"; share "AI drafts five, you pick one"; keep "the angle you take; deciding what should exist."
- "Do this today": Label five of your tasks Labour, Work or Action.
- Strength: 3
- Sensitivity: None.

### Don't wait on someone else's calendar
- Bucket: MINDSET
- The idea in one plain sentence: The person closest to the problem can now build the first version themselves, instead of describing it and waiting weeks.
- Why it matters: Speeds decisions and cuts "they built the wrong thing" rework; shifts power to people with domain knowledge.
- Source: `docs/history/2026-09-07-doc-vibe-coding-deck.md` (Thesis B, G), `docs/history/2026-09-07-doc-vibe-coding-mastery.md` (Thesis 6, 7), `docs/history/2026-09-07-doc-mindmaker-maven.md` (Thesis E). Quotes: "This isn't about learning to code. It's about knowing what's buildable, so you stop handing vague requirements to a team and waiting three weeks to find out they built the wrong thing." / "'Could we…' stops being a quarter-long debate and becomes a Tuesday-afternoon prototype."
- Real-world example: A HubSpot-connected sales leaderboard "built in one hour" (from the corpus; verify specifics).
- "Do this today": Pick one small tool you've been waiting on IT for and try a first version in an app builder this week.
- Strength: 4
- Sensitivity: Named customer examples ([client], $30K quote) must not be used.

### People hide their AI use, so watch behaviour, not answers
- Bucket: MINDSET
- The idea in one plain sentence: Many people under-report or hide their AI use (and genuinely mis-remember it), so asking "how common is this among people in your role?" gets closer to the truth than "do you?"
- Why it matters: Leaders and teams misjudge actual adoption; honest conversations need face-saving framing.
- Source: `docs/history/2026-09-07-md.md` (survey bias research), `skills/ctrl-intake/leaves/sort.md` (indirect item, preamble), `docs/history/2026-09-07-AI Chief of Staff ... .md` (leaders behind their own teams). Quotes: "Ask only about other people." / "Pre-normalising the undesirable answer is the highest-efficacy debiasing move measured across 121 experiments." / "I didn't use AI, I just asked it to fix my grammar."
- Real-world example: The sort preamble: "Most of these are deliberately mediocre... Rejecting a lot of them is the normal result and it is the useful one."
- "Do this today": In your next team chat about AI, open with "most people are using this more than they say; no judgment" and ask what peers do.
- Strength: 3
- Sensitivity: Survey stats (59%, 48%, 45%) are secondary; verify.

### The fraud feeling is accurate, and fixable
- Bucket: MINDSET
- The idea in one plain sentence: Feeling like a fraud in AI conversations is a correct read of a real gap, not anxiety to soothe, and the fix is reps, not reassurance.
- Why it matters: Naming the gap honestly is what gets people to start doing instead of performing fluency.
- Source: `docs/history/2026-09-07-doc-icp.md` (Thesis 5, 6, 7). Quotes: "the fraud feeling is rational, not neurotic... Name it as accurate. Do not reassure it away." / "Almost everyone is at zero." / "held back by the very capabilities that made them successful."
- Real-world example: "Confident in the boardroom, vague in the 1:1."
- "Do this today": Write down one AI thing you talk about but have never done, and do it once this week.
- Strength: 3
- Sensitivity: Percentages in this doc are secondary; verify.

### Unify the body, keep the personality
- Bucket: MINDSET
- The idea in one plain sentence: Things that look like duplicates often serve different jobs; share the plumbing, but don't merge away what makes each one good.
- Why it matters: Over-standardising AI prompts or tools into one generic version loses the specificity that made them work.
- Source: `docs/ENRICHMENT-CONVERGENCE.md`, `docs/PORTFOLIO-HIVE-MIND.md`, `standards/README.md` ("Unify the SYSTEM, never the SKIN"). Quotes: "unify the body, never the personality." / "A blind merge would vanilla away each one's soul." / "The duplication here is shallow... The divergence is intentional and load-bearing."
- Real-world example: Two "duplicate" enrichment services were actually a person-resolver and a company-dossier builder; merging would have degraded both.
- "Do this today": Before merging two prompts or templates into one, write what each is uniquely for.
- Strength: 2
- Sensitivity: Internal architecture and product names; keep abstract.

---

## Top 15 (ranked)

1. **A comment is not a rule**: one situated remark ("no decks") became "never make decks"; the most common way AI profiles go wrong. Great story, anonymise the client.
2. **Same model, different employee** (with the cold vs loaded test): four headings read first turn a stranger into a teammate, and the gap between two answers is your hidden tax.
3. **Fix the class, not the instance**: the three-line self-correct footer that turns every correction into a rule ("do not misspell Lauren" vs "confirm proper nouns").
4. **Never let a worker grade its own homework / check the real thing**: confident green ticks, the empty export, and "it was live" when it wasn't; review fresh, verify the artifact.
5. **Keep the first and last 20 percent**: AI does the middle 60; you frame and judge, which is where quality and your skill live.
6. **Saved time is tuition, not a refund**: reclaim, amplify, re-architect; most people bank the hour back into the inbox.
7. **Grade real work, don't describe your taste**: "would I send this?" plus one line why beats any self-description.
8. **Could this have been written for anyone?**: the swap-the-name test, the single highest-consequence quality check.
9. **Delegate, template, automate, or kill**: frequency x judgment, and most things people want to automate belong in Kill.
10. **The five-part brief**: Goal, Context, Format, Constraints, Acceptance; "every blank becomes a bug."
11. **Who can answer this: the web, only you, or nobody yet?**: stops AI giving confident internet answers about your own business.
12. **Make your call before you see the AI's**: gut vs ground, the habit that keeps your judgment from atrophying (optional, not a gate).
13. **Point to the line: AI can fix what it can't find**: ask "why is this breaking?" and quote the wrong sentence instead of "try again".
14. **Internal is free, external is gated**: AI reads and drafts freely; send, post, spend, sign wait for your yes.
15. **One task, one conversation**: restart the moment you say "no, I already told you that"; long chats rot.

Honourable mentions: Dry run and read the samples, not the counts (strong true story); AI literacy precedes strategy; Code was never the bottleneck; Trust tiers for AI news; Your deleted drafts are your best training data.
