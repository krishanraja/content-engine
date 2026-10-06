# mm-ctrl trawl: teachable ideas for Make Your Mind Up

Scope read: `project-documentation/` (all top-level docs, `ctrl-evolution/` contracts, research, ledger snapshot summaries, design founder-gate and judge records, compliance skimmed for ideas only), `supabase/functions/` prompt files (decision engine, critique, compile-standard, build-sort, skill export, voice profile, blind spot, prompt coach, extraction, context builder, guardrails, correction guard, staleness, discrimination), `supabase/migrations/` comments, and `src/` copy (`components/public/publicCopy.ts`, onboarding model and questions, sort/standard/contest/blind-spot copy, `content/answers/*.md`).

Global sensitivity notes (apply to every block below):
- Do not name Mindmake's thirty-day proof, prices ($49 Edge Pro, three free weighs), internal decision codes (D-0xx, G13-G20), PR numbers, Supabase project refs, or the retired name candidate "Mindy".
- The "ACTIVE_CASE" (a leader considering reorienting marketing around AI, mid-level staff spending weeks on LinkedIn posts) reads like a real client situation. Use only as an anonymised, generic example ("a marketing team").
- The franchise/Marvel exemplar is explicitly unverified in the source. Do not use.
- Competitor names appear in `src/content/answers/*.md` (Alfred, Rhythms, Perspective, Tana, Flaex, Carly). Do not name them on camera.
- Founder verbatim gate quotes include crude phrasing; paraphrase only.
- One prompt (`submit-weekly-checkin`) gives the model a fictional persona ("coached 500+ executives"). Never repeat as a real claim.
- One prompt comment cites a judging benchmark moving "from 54.9 to 81.7 percent" with retrieved examples; no source in repo. Do not quote the number.

---

## BRAIN

### The amnesia tax
- Bucket: BRAIN
- The idea in one plain sentence: Every AI tool starts from zero, so you keep paying to re-explain who you are, and the fix is a small, reusable "you" file you load every time.
- Why it matters (business outcome: time, money, quality, risk, revenue): Time (no re-explaining), quality (answers fit your business instead of the average business).
- Source: `project-documentation/CTRL-CORPUS.md` §11-§12; `project-documentation/VALUE_PROP.md`. Quotes: "your most expensive employee has amnesia; every Monday is its first day"; "Every AI tool starts from zero, so the leader repeats who they are, what the business is doing, and what matters."; test: "the cold-vs-loaded gap ('the gap between those two answers is the tax you've been paying')".
- Real-world example in the source (if any) or an obvious everyday one: The product's "cold-vs-loaded" demo: same question with and without your context, show the difference. Everyday: asking ChatGPT for a pricing email and getting a generic SaaS template.
- "Do this today" step anyone could take in under 15 minutes: Ask your AI one real work question cold. Then paste five lines (role, business, top 3 priorities, one recent decision, one thing you hate in writing) and ask again. Compare the two answers side by side. That gap is your tax.
- Strength 1-5: 5
- Sensitivity: None.

### Sharp beats big
- Bucket: BRAIN
- The idea in one plain sentence: A short, current, curated context beats a giant dump of everything, because extra context is a liability, not a bonus.
- Why it matters: Quality (less noise for the model), risk (less sensitive data floating around), cost (fewer tokens).
- Source: `CTRL-CORPUS.md` §12: "sharp beats big - useful context in, liability out"; `ctrl-evolution/living-brain-domain-and-user-model.md`: "context is finite and must be deliberately curated rather than accumulated indiscriminately"; `NORTH_STAR.md` threshold of "at least 5 current facts".
- Real-world example: The product counts someone as having a "real brain" at just five current facts. Everyday: a new hire briefed with one page beats one handed the shared drive.
- "Do this today": Open your AI's memory or custom instructions. Delete anything out of date or vague. Keep it to what you would tell a smart new colleague in two minutes.
- Strength 1-5: 4
- Sensitivity: None.

### The three-layer setup: identity, memory, self-correction
- Bucket: BRAIN
- The idea in one plain sentence: "The model isn't the problem, the setup is": give AI three plain-text layers in a fixed order (who you are, what is going on, how it should fix its own mistakes).
- Why it matters: Quality and consistency across every tool you use.
- Source: `CTRL-CORPUS.md` §12 ("Identity · Memory · Self-Correction (the prompt-pack protocol)"). Quotes: "Identity = ROLE · VOICE · STANDARDS · NEVER-RULES"; "Memory = business · top-3 priorities · decisions-made · people/projects"; "Self-Correction = the footer LOG (root cause) -> PROPOSE (one class-killing rule) -> WRITE BACK (on approval)".
- Real-world example: Product originally sold a "Memory & Identity Prompt Pack" kit built on this. Everyday: a project brief with "who I am / what's live / when you get it wrong, tell me why and propose a rule".
- "Do this today": Write three headed sections in a doc: Identity (role, voice, 3 standards, 3 never-rules), Memory (business, top 3 priorities, last 3 decisions, key projects), Self-correction ("When I correct you: name the root cause, propose one rule that would stop this whole class of mistake, wait for my OK"). Paste it into your AI's project instructions.
- Strength 1-5: 5
- Sensitivity: "Memory & Identity Prompt Pack" was a paid class kit; describe the method, not the product.

### What counts as a fact about you (and what doesn't)
- Bucket: BRAIN
- The idea in one plain sentence: Only durable facts about you belong in your AI memory; moods, formatting requests, hypotheticals and other people's business do not.
- Why it matters: Quality (memory stops getting polluted), risk (no stray personal data about others).
- Source: `supabase/functions/extract-user-context/index.ts` extraction prompt. Quotes: "Only extract facts that are explicitly stated or strongly implied about the speaker themselves."; "TRANSIENT CONTEXT: 'I'm tired today', 'running late', 'feeling off'. Not durable."; "THIRD-PARTY IDENTITY: 'my cofounder is the CEO' does NOT make the speaker the CEO." Five categories: identity, business, objective, blocker, preference.
- Real-world example: Source examples: "Don't ever use em dashes in my briefings." is a style rule, not a fact; "I keep having to chase my CFO Sarah for numbers" becomes "chases the CFO for numbers".
- "Do this today": Open ChatGPT or Claude memory. Sort each saved item into: identity, business, goal, blocker, preference. Delete anything that is a mood, a one-off instruction, or about someone else.
- Strength 1-5: 4
- Sensitivity: Example names in source are fictional; fine to paraphrase.

### Name the role, not the person
- Bucket: BRAIN
- The idea in one plain sentence: When you tell AI about colleagues, say "the CFO", never their name, because they never agreed to be in your AI's memory.
- Why it matters: Risk (legal and trust exposure), still keeps the useful context.
- Source: `project-documentation/DECISIONS_LOG.md` Decision 84 ("Memory Holds Personal Data About Its User and Nobody Else"): "A leader who says 'my CFO is not up to this' hands CTRL personal data about someone who does not know the product exists and cannot exercise any right over it."; `extract-user-context` prompt: "Refer to them by role instead: 'the CFO', 'my co-founder', 'a board member'."
- Real-world example: "I am worried about my CFO's pace" is about you and fine; "Sarah is not coping" is about Sarah and should not be stored.
- "Do this today": Search your AI memory and saved chats for colleagues' names. Rewrite to roles. Turn off memory for any chat where you vent about a named person.
- Strength 1-5: 4
- Sensitivity: Frame as general good practice, not legal advice.

### The notebook test
- Bucket: MINDSET
- The idea in one plain sentence: If you'd write it in a notebook you carry home, it belongs in your personal AI brain; if it belongs in your company's systems, put it there instead.
- Why it matters: Risk (keeps company-confidential data out of personal tools), clarity on what to feed which tool.
- Source: `src/components/public/publicCopy.ts`: "If you would write it in a notebook you carry home, put it in CTRL. If it belongs in your company's systems, put it there."; "The one place you can think out loud about a decision before it is a proposal."; `DECISIONS_LOG.md` Decision 82 (data class triggers enterprise obligations).
- Real-world example: Your half-formed view on a reorg goes in the notebook; the signed contract goes in the company drive.
- "Do this today": List the five things you most often paste into AI. Mark each "notebook" or "company system". Move the company ones to a work-approved tool.
- Strength 1-5: 4
- Sensitivity: Do not claim CTRL privacy guarantees on camera.

### Teach taste with a yes and a no
- Bucket: BRAIN
- The idea in one plain sentence: AI can't learn your taste from adjectives like "punchy" or "premium"; it learns from one thing you loved, one thing you rejected, and the exact reason why.
- Why it matters: Quality (output that sounds like you), time (fewer rewrite rounds).
- Source: `ctrl-evolution/living-brain-domain-and-user-model.md` "Preserving taste without freezing the person": "A profile full of adjectives will produce cosplay."; "an admired example and why it works; a rejected or corrected example and the exact failure"; Sort UI copy (`src/components/sort/*`): "One side on its own is a preference, not a rule."; `context-circulation-architecture.md`: "The brain retains negative evidence as first-class material: rejected ideas, broken examples, disliked writing patterns, failed predictions".
- Real-world example: Instead of "make it more confident", paste a past email you loved and one you hated and say "the second one hedges in the first line; the first opens on the decision".
- "Do this today": Find one piece of your own work you're proud of and one you'd never send. Write one sentence on the single difference. Save both plus the sentence in your AI's project files as "good" and "not good".
- Strength 1-5: 5
- Sensitivity: None.

### Your "no" pile is a goldmine
- Bucket: BRAIN
- The idea in one plain sentence: Rejected drafts, killed ideas and failed predictions teach AI more about you than your best work, because AI already defaults to the smooth average.
- Why it matters: Quality and differentiation (stops generic convergence).
- Source: `ctrl-evolution/research/competitive-moat-architecture-2026-09-07.md`: "Negative examples and exceptions are especially important because generic assistants disproportionately learn the smooth, affirmative centre."; `research/deeplake-hivemind-concept-assessment-2026-09-07.md`: "Negative examples, corrections and rejection reasons belong in the brain alongside admired examples."
- Real-world example: A designer keeps a "never again" folder of rejected concepts with one-line reasons.
- "Do this today": Start a doc called "Things I rejected and why". Add three items from this month. Attach it to your AI project.
- Strength 1-5: 4
- Sensitivity: None.

### Rules need a "when" and an "unless"
- Bucket: BRAIN
- The idea in one plain sentence: "Always do X" is weaker than "do X when these conditions hold, and not when these warning signs appear", and a rule from one situation must not become a rule for everything.
- Why it matters: Quality (fewer wrong applications of your preferences), risk (no overgeneralised rules).
- Source: `competitive-moat-architecture-2026-09-07.md`: "'Always do X' is usually inferior to 'use X when these conditions hold; resist it when these counter-signals appear.'"; `supabase/functions/generate-skill-export/prompt.ts`: "you may write 'For progress updates on this engagement, lead with the decision [E12]' and you may NOT write 'Never produce a deck.'"
- Real-world example: "Lead with the number" works for board updates, not for a condolence email.
- "Do this today": Take your three strictest AI instructions. Add "when..." and "except when..." to each.
- Strength 1-5: 4
- Sensitivity: None.

### Every rule needs a receipt
- Bucket: BRAIN
- The idea in one plain sentence: Every rule in your AI instructions should point to the real example or quote it came from; if you can't point to one, mark it "not established" rather than inventing it.
- Why it matters: Quality and trust (you can audit why the AI behaves as it does), risk (invented rules spread).
- Source: `generate-skill-export/prompt.ts`: "If you want to write a rule and have no pointer for it, write instead: NOT ESTABLISHED: <the thing you were going to assert>"; "A flagged gap is useful. An invented rule is damage that spreads."; "a pointer that resolves to nothing is worse than no pointer, because it looks checked."
- Real-world example: "Open with the decision (from my note on the Q2 board pack)".
- "Do this today": Next to each line in your custom instructions, add in brackets where it came from. Delete or flag any you can't trace.
- Strength 1-5: 3
- Sensitivity: None.

### Voice from real writing, not self-description
- Bucket: BRAIN
- The idea in one plain sentence: Don't describe your voice to AI; paste things you actually wrote and let it read your patterns, and never let it invent a "sample" of you.
- Why it matters: Quality (drafts sound like you), trust (no fake quotes in your name).
- Source: `CTRL-CORPUS.md` §12: "voice mined from pasted real writing, never self-described; test: 'two people couldn't tell its draft from yours.'"; `supabase/functions/extract-voice-profile/index.ts` dimensions: signoff, disagreement style (direct / context-first / question-led), content archetype (argument / story-lesson / data-take / how-to), sentence length, first-person use, punctuation, 1-2 hard rules; `generate-skill-export/prompt.ts`: "a fabricated sample of someone's writing is the single most damaging thing this pipeline can produce, because it is the one thing they will recognise as not theirs."
- Real-world example: How do you disagree: lead with the counter, acknowledge then pivot, or ask a sharp question?
- "Do this today": Paste three emails you sent this week into AI and ask: "Describe how I write on these six dimensions: sign-off, how I disagree, structure, sentence length, how much I say I, punctuation. Then give me two Always/Never rules I clearly follow." Save the result.
- Strength 1-5: 5
- Sensitivity: None.

### Five views of your AI brain
- Bucket: BRAIN
- The idea in one plain sentence: A useful AI brain answers five questions: what matters to me, how I judge, what I've decided, what's still unresolved, and what has changed.
- Why it matters: Quality (AI knows the judgement behind your facts, not just facts).
- Source: `ctrl-evolution/living-brain-domain-and-user-model.md`: "what matters to me; how I judge; what I have decided; what remains unresolved; and what CTRL has learned or changed."; "It should not feel like a database, filing cabinet, graph, chat history, settings page or personality test."
- Real-world example: Portable package layout in source: `profile/what-matters.md`, `profile/how-i-judge.md`, `decisions/`, `unresolved/tensions.md`, `CHANGELOG.md`.
- "Do this today": Create five headings in one doc with those names. Put two lines under each. That is version 1 of your brain.
- Strength 1-5: 5
- Sensitivity: None.

### Keep your tensions unresolved on purpose
- Bucket: BRAIN
- The idea in one plain sentence: Some of your values genuinely pull against each other, and writing them down as tensions (not rules) stops AI from flattening you into one-dimensional advice.
- Why it matters: Quality of advice on hard calls; avoids confidently wrong simplification.
- Source: `living-brain-domain-and-user-model.md` Brain item type "Tension: two values or demands that cannot be honestly collapsed into one rule"; `publicCopy.ts`: "It keeps the ones that pull against each other too."; `ctrl-evolution/README.md`: "The remaining decision-critical tensions are explicit rather than smoothed over".
- Real-world example: "Move fast" versus "never embarrass a client"; "be candid" versus "protect the team's morale".
- "Do this today": Write two "X versus Y" tensions you live with. Tell AI: "When advice touches these, name the trade-off instead of picking for me."
- Strength 1-5: 4
- Sensitivity: None.

### The decision record
- Bucket: BRAIN
- The idea in one plain sentence: For every big call, record what you chose, why, how sure you were, what would make you reopen it, and later what actually happened.
- Why it matters: Quality of future decisions, accountability, learning from outcomes instead of hindsight.
- Source: `context-circulation-architecture.md`: "Decision: what was chosen, why, by whom and what would reopen it."; "Outcome: what happened after a decision, including ambiguity and luck."; `CTRL-CORPUS.md` §10/§13: the "return-ask ('you pressure-tested X - did it resolve?')"; migration comment: "decision outcomes (process-judged, harvested from signals; never a grading chore)".
- Real-world example: "Chose to buy, not build, the agent stack. 60% sure. Reopen if vendor raises price 30% or we need offline use."
- "Do this today": Write a five-line record for one decision you made this month: choice, reason, confidence %, reopen trigger, check-back date. Add a calendar reminder for the check-back.
- Strength 1-5: 5
- Sensitivity: None.

### Correct once, fix the whole class
- Bucket: BRAIN
- The idea in one plain sentence: When AI gets something wrong, don't just fix that answer; turn the correction into a rule so the same kind of mistake can't come back.
- Why it matters: Time (stop repeating corrections), quality.
- Source: `CTRL-CORPUS.md` §11-§12: "fix the class, not the instance"; "the same mistake doesn't survive four occurrences"; `supabase/functions/_shared/correction-guard.ts`: "This module makes extraction correction-aware so the same wrong inference never recurs"; `DECISIONS_LOG.md` Decision 61: "A leader correcting CTRL should see it stick."; ledger tension C-004: "Doctrine says the same mistake should not happen twice, while one learning path waits for four recurrences."
- Real-world example: AI keeps calling your clients "users". Instead of fixing each draft, add: "Our customers are 'clients', never 'users' (corrected 3x)".
- "Do this today": Scroll your last five AI chats. Find a correction you've made twice. Add it as a one-line rule to your instructions.
- Strength 1-5: 5
- Sensitivity: None.

### Forgetting is a feature
- Bucket: BRAIN
- The idea in one plain sentence: Old numbers, past roles and abandoned plans must be narrowed, retired or deleted, or your AI will confidently use stale truth.
- Why it matters: Risk (decisions on outdated data), quality.
- Source: `living-brain-domain-and-user-model.md` "Remembering and forgetting are both product behaviours": "revise... narrow... demote... retire or expire... erase"; "Retention must not mean continuing to use stale material."; `context-circulation-architecture.md`: "Freshness and expiry: Stops old numbers, roles or intentions becoming current truth."
- Real-world example: AI still thinks your team is 12 people after you hired to 20.
- "Do this today": Add "(as of <month>)" to every number in your AI instructions. Set a monthly 10-minute reminder to update or delete them.
- Strength 1-5: 4
- Sensitivity: None.

### Give each job its own slice of your brain
- Bucket: BRAIN
- The idea in one plain sentence: Don't hand every AI task your whole life story; give the email job your identity and voice, the board job your business, goals and blockers.
- Why it matters: Quality (less distraction), risk (less oversharing), cost.
- Source: `supabase/functions/_shared/memory-context-builder.ts` `filterByUseCase` (email: identity + preferences; board: business, objective, blocker plus strengths and blind spots; delegation: identity, objective, business); `g20-universal-capture-claude-bridge-contract.md`: context capsule with "selected_context: Only the evidence, current beliefs, tensions and standards useful to the task" and "forbidden_inferences: Things Claude must not assume or collapse together".
- Real-world example: A "board prep" project with business, goals and blockers; an "email" project with voice and preferences only.
- "Do this today": Split your one big instruction block into two AI projects: "Writing as me" (voice, preferences) and "Thinking with me" (business, goals, blockers, decisions). Add a "Do not assume" line to each.
- Strength 1-5: 4
- Sensitivity: None.

### The "do not assume" list
- Bucket: BRAIN
- The idea in one plain sentence: Tell AI explicitly what it must not assume, because the most expensive errors come from confident guesses about things you never said.
- Why it matters: Risk (fewer confident wrong outputs), quality.
- Source: `g20-universal-capture-claude-bridge-contract.md` capsule field "forbidden_inferences"; `context-circulation-architecture.md` "CTRL must not infer... that a speaker's statement is the leader's belief; that a proposal became a decision; that repetition means truth or endorsement".
- Real-world example: "Do not assume the budget is approved. Do not assume the client has agreed to the timeline."
- "Do this today": Before your next big AI task, add three "Do not assume..." lines to the prompt.
- Strength 1-5: 4
- Sensitivity: None.

### Pasted context is dead context
- Bucket: BRAIN
- The idea in one plain sentence: Context you paste into a chat goes stale the moment you close the tab, so keep one living source of you and point every tool at it rather than maintaining copies everywhere.
- Why it matters: Time (no duplicate upkeep), quality (tools act on today's you, not last month's).
- Source: `publicCopy.ts`: "Pasted context is dead context."; "You paste who you are into ChatGPT or Claude and it is stale the second you close the tab. Your agents act on yesterday's you."; `g20-universal-capture-claude-bridge-contract.md` Retire list: "The idea that people should manually maintain duplicate Brain files in Claude Projects."; `DECISIONS_LOG.md` Decision 39: "A saved prompt is dead context (the leader has to remember to paste it)."
- Real-world example: Three different "about me" blurbs in ChatGPT, Claude and Gemini that all disagree.
- "Do this today": Make one master "about me" doc in your notes app. Delete the old copies in each tool and paste from the master. Put a "last updated" date at the top.
- Strength 1-5: 4
- Sensitivity: None.

### Own your context
- Bucket: MINDSET
- The idea in one plain sentence: Your context is one of your most valuable assets, so keep it in a portable, human-readable form you control rather than locked inside one AI company's memory.
- Why it matters: Risk (lock-in, losing it when you switch tools or jobs), long-term compounding.
- Source: `publicCopy.ts`: "Your context is the most valuable thing you own. It should not live inside someone else's product."; "Your mind is an asset. Treat it as one."; `research/customer-brain-storage-architecture-brief-2026-09-07.md`: the portable package should be "curated Markdown; structured JSON/YAML; provenance manifest; decisions; standards; examples and anti-examples".
- Real-world example: Exporting your brain as a folder of Markdown files you can drop into any AI tool or hand to a new assistant.
- "Do this today": Export your ChatGPT or Claude memory (both offer this) and save it as a Markdown file in a folder you own.
- Strength 1-5: 3
- Sensitivity: Avoid repeating the promotional "race for your data is over" line as fact.

### One gesture in: you supply meaning, AI does the filing
- Bucket: BRAIN
- The idea in one plain sentence: Capturing context should take one move (paste, speak, forward) plus a short note like "keep this" or "challenge this"; never make yourself fill in categories.
- Why it matters: Time and habit (you actually capture things), quality.
- Source: `context-circulation-architecture.md` "A deliberate signal": "speak it; share it to CTRL; paste it; forward it; upload it; or say 'keep this,' 'challenge this,' or 'use this later.'"; "The leader supplies meaning, not metadata."; `g20-universal-capture-claude-bridge-contract.md`: "A single composer receives everything."
- Real-world example: Forward an email to yourself with "use this later: how I want to handle discount requests".
- "Do this today": Create one "Inbox for my AI brain" note on your phone. For a week, voice-note or paste anything worth keeping with one of three tags: keep, challenge, use later.
- Strength 1-5: 4
- Sensitivity: None.

### Transcripts lie by omission
- Bucket: MINDSET
- The idea in one plain sentence: A meeting transcript or AI summary is not the truth: someone saying it doesn't mean you believe it, a proposal isn't a decision, and summaries quietly erase disagreement.
- Why it matters: Risk (acting on false consensus), quality of memory.
- Source: `context-circulation-architecture.md` "Context quality is sacrosanct": "that a speaker's statement is the leader's belief; that a proposal became a decision; that repetition means truth or endorsement; that a meeting summary preserves disagreement; that an old number is current; ... that a model-written sentence is evidence about the user"; `project-documentation/MASTER_INSTRUCTIONS.md` §3.2: "LLM summaries are never the source of truth."
- Real-world example: The AI meeting summary says "team agreed to launch in May"; actually one person suggested it and two stayed quiet.
- "Do this today": On your next AI meeting summary, ask: "List every item as DECIDED, PROPOSED, or DISAGREED, with who said it." Keep the raw transcript.
- Strength 1-5: 5
- Sensitivity: None.

### The context envelope: who, when, how sure
- Bucket: BRAIN
- The idea in one plain sentence: Anything you feed AI is far more useful if it carries four tags: who said it, when it was true, how sure you are, and who is allowed to see it.
- Why it matters: Risk (stale or misattributed facts), quality.
- Source: `context-circulation-architecture.md` "The universal context envelope" (source, captured vs event time, subject and speaker, ownership and audience, evidence class, freshness and expiry, sensitivity, confidence and consequence, provenance chain): "The envelope is the architecture's centre of gravity."
- Real-world example: "Churn 4% (CFO, March, estimate, internal only)" versus "churn is 4%".
- "Do this today": Pick the five key numbers in your AI instructions. Add source, date and confidence to each.
- Strength 1-5: 3
- Sensitivity: None.

---

## LEVEL UP

### Write your view before you ask the AI
- Bucket: LEVEL UP
- The idea in one plain sentence: Before asking AI about a decision, write down what you currently think, how sure you are, and what would change your mind, so the AI sharpens your judgement instead of replacing it.
- Why it matters: Quality of decisions, avoids anchoring on the AI's first answer, keeps accountability.
- Source: `ctrl-evolution/phase-2-decision-brain-vertical-slice-contract.md` "Human before AI: The leader's provisional view, uncertainty and change condition are captured before CTRL's recommendation is revealed."; "what the leader currently thinks; how settled they are; what evidence or consequence would genuinely change their mind."; failure mode "Beautiful answer vendor: recommendation appears before human prior; users comply without reconciliation"; ledger D-010 "CTRL may reveal its evidence-backed preferred path only after the user has formed a provisional view".
- Real-world example: Natural responses after seeing AI's view: "That changes my mind." / "I agree with the diagnosis, not the recommendation." / "You have this fact wrong." / "Keep my original view."
- "Do this today": Next decision you take to AI, first write three lines: My current call. How sure (0-100%). What would change my mind. Then ask AI, then compare.
- Strength 1-5: 5
- Sensitivity: None.

### Break the decision into claims
- Bucket: LEVEL UP
- The idea in one plain sentence: Ask AI to split your decision into 3-8 specific claims it rests on, and label each as fact, market claim, cause-and-effect, assumption or forecast.
- Why it matters: Quality (you see what you're really betting on), risk.
- Source: `supabase/functions/decision-engine/decompose.ts`: "Extract 3 to 8 claims. Each must be a single, specific, testable statement"; claim types "factual... market... causal... assumption... forecast"; comment: "This typing step is the biggest reliability lever: models classify reliably even where they adjudicate unreliably."; `CTRL-CORPUS.md` §12 "Decompose before judging".
- Real-world example: "Should we build our own agent stack or buy one?" (the product's own sample question) breaks into: vendor cost will rise (forecast), our team can maintain it (assumption), competitors are building (market).
- "Do this today": Paste a live decision into AI with: "List the 3-8 claims this decision depends on. Label each fact, market, cause-effect, assumption or forecast. Star the ones where, if false, the whole decision fails."
- Strength 1-5: 5
- Sensitivity: None.

### You can't Google an assumption
- Bucket: LEVEL UP
- The idea in one plain sentence: Facts can be checked online, but assumptions and forecasts can't, so when AI "verifies" them it's faking it, and you have to test them yourself.
- Why it matters: Risk (false confidence), quality.
- Source: `decision-engine/verify.ts`: "assumption / forecast claims are NOT web-verified... Faking a verdict on an assumption is exactly the failure mode that destroys trust."; rationale text: "This is an assumption, not a checkable fact. Validate it directly before relying on it."; "No evidence => 'unverified', never 'false'."
- Real-world example: "Customers will pay more for the AI version" can only be tested by asking customers or running a pilot.
- "Do this today": Take one starred assumption from your decision and write the cheapest real-world test (one call, one landing page, one pilot) you could run this week.
- Strength 1-5: 5
- Sensitivity: None.

### The two-source rule
- Bucket: LEVEL UP
- The idea in one plain sentence: Don't treat a claim as confirmed until two independent sources (different websites, not the same press release twice) support it.
- Why it matters: Risk (decisions on one shaky source), quality.
- Source: `decision-engine/verify.ts`: "Corroboration governor: a confident 'supported' needs >= 2 INDEPENDENT supporting sources (distinct domains). The LLM does not reliably enforce independence; this does."; adjudicator: "'unverified': evidence is thin, absent, tangential, or low quality. When in doubt, choose this."
- Real-world example: Two news sites both quoting the same vendor blog count as one source.
- "Do this today": For your most important claim, ask AI for sources, then check: are they from different organisations? If not, mark it unverified.
- Strength 1-5: 4
- Sensitivity: None.

### Find the breakpoint
- Bucket: LEVEL UP
- The idea in one plain sentence: For any decision, ask AI to name the single assumption whose failure would break it, plus the strongest honest case against it, not a token one.
- Why it matters: Risk (you know exactly what to watch), quality, faster validation.
- Source: `decision-engine/advise.ts`: "Always include the strongest honest counter-case, not a token one."; "Name the single assumption or claim whose failure most breaks the decision (breakpoint)."; `decision-engine/crossexamine.ts`: "You are a sharp, skeptical board member. Your only job is to argue against the decision"; `CTRL-CORPUS.md` §12: "the counter-case and the single breakpoint assumption are required JSON fields".
- Real-world example: Hiring an AI vendor: the breakpoint might be "their model handles our document formats".
- "Do this today": Prompt: "Act as a sceptical board member. Give me the strongest case against this decision in 3 sentences, and the one assumption that, if wrong, breaks it." Then write what you'll do to test that one assumption.
- Strength 1-5: 5
- Sensitivity: None.

### Ask more than one AI, and don't average them
- Bucket: LEVEL UP
- The idea in one plain sentence: Run an important question past two or three different AI models separately; where they disagree is the most useful information you'll get, so don't blend it into one answer.
- Why it matters: Risk and quality (you spot shaky ground), confidence that's earned.
- Source: `decision-engine/crossexamine.ts`: "A panel of distinct models each judges the decision. Where they diverge, that disagreement is surfaced as a tension rather than averaged away."; `CTRL-CORPUS.md` §12: "disagreement lowers confidence"; `supabase/functions/critique-artefact/prompt.ts`: "Debate measurably degrades consistency... disagreement between independent verifiers is signal, and the meta-judge escalates it rather than flattening it."
- Real-world example: Claude says go, ChatGPT says wait: that split tells you the decision is closer than either answer suggests.
- "Do this today": Paste the same decision into two AI tools without showing either the other's answer. Ask each: support, oppose or uncertain, plus the biggest risk. Note where they split.
- Strength 1-5: 5
- Sensitivity: Source names specific models in the panel; fine to say "different AI tools", avoid implying CTRL's exact stack.

### Never let a worker grade its own homework
- Bucket: LEVEL UP
- The idea in one plain sentence: The AI that wrote something is the worst judge of it, so review AI output with a different model, a fresh chat, or a human.
- Why it matters: Quality, risk (self-flattering reviews).
- Source: `CTRL-CORPUS.md` §11/§15: "never let a worker grade its own homework"; "Independent checks the agent cannot grade itself on"; `critique-artefact/prompt.ts` signature lens: "run on a provider that did not generate the artefact... never allowed to be the generator's own family marking its own work"; `living-brain-domain-and-user-model.md`: "The generating model cannot be the sole evaluator."
- Real-world example: ChatGPT writes your proposal; Claude, in a new chat with your checklist, reviews it.
- "Do this today": Take the last important thing AI drafted for you. Open a different tool or a fresh chat and ask it to review against three criteria you care about.
- Strength 1-5: 5
- Sensitivity: None.

### Quote before you score
- Bucket: LEVEL UP
- The idea in one plain sentence: When you ask AI to review work, make it quote the exact passage before judging it, and make every "this fails" come with a rewritten version.
- Why it matters: Quality (feedback you can act on), time (no vague critiques).
- Source: `critique-artefact/prompt.ts` HOUSE_RULES: "QUOTE BEFORE YOU SCORE... You may not score a criterion you cannot point at."; "Three verdicts only: holds, borderline, breaks. No numeric score"; "A borderline is usable ONLY if you name the single change that moves it to holds"; "NEVER RETURN A BARE REJECTION... A gate that only says no gets routed around within a fortnight"; "one_thing: the single highest consequence change. Not a list. One."
- Real-world example: Instead of "the intro is weak (6/10)", you get: quote, "breaks: no specific client named", and a rewritten intro.
- "Do this today": Save this review prompt: "For each of my criteria: quote the exact passage, say holds / borderline / breaks, give the one change for borderline, rewrite the passage for breaks. End with the single most important change." Use it on your next draft.
- Strength 1-5: 5
- Sensitivity: None.

### The name-swap test
- Bucket: LEVEL UP
- The idea in one plain sentence: Ask of any AI-assisted piece: could someone who has never met me have written this? If yes, it's generic.
- Why it matters: Quality and differentiation; protects your reputation.
- Source: `critique-artefact/prompt.ts` signature lens: "could this have been written by anyone, with the name swapped."; "A specific number, a named client, a decision they actually made, a sentence in a shape only they use: any one of those is what a holds looks like."
- Real-world example: A LinkedIn post that could be signed by any consultant fails; one citing the decision you reversed last quarter passes.
- "Do this today": Take your last AI-assisted post or email. Highlight anything only you could have written. If nothing is highlighted, add one specific number, name or decision.
- Strength 1-5: 5
- Sensitivity: None.

### Every claim earned
- Bucket: LEVEL UP
- The idea in one plain sentence: In anything going to someone else, every number needs a source and every result needs a real example, even when the claim happens to be true.
- Why it matters: Risk (credibility), quality.
- Source: `critique-artefact/prompt.ts` evidence lens: "Every number sourced. Every outcome attributable to a named instance. Every quote real. An assertion of a result with no source, no example and no named instance is a breaks, and it is still a breaks when the claim happens to be true."; revision rule: "the fix is to state it in the form they can actually stand behind, or to name what would source it, never to invent a source."
- Real-world example: "AI saves teams 40% of their time" with no source is a fail.
- "Do this today": Ask AI: "List every number and result claim in this draft and whether it has a source. For unsourced ones, rewrite in a form I can stand behind." Apply before sending.
- Strength 1-5: 4
- Sensitivity: None.

### The generic-AI tells checklist
- Bucket: LEVEL UP
- The idea in one plain sentence: Generic AI output has recognisable tells: blind optimism, missing or wrong numbers, everyone-thinks-the-same ideas, obvious moves dressed as insight, and clipped bossy two-word sentences.
- Why it matters: Quality and differentiation; stops your work blending into everyone else's.
- Source: `research/deeplake-hivemind-concept-assessment-2026-09-07.md` "The anti-convergence requirement": "blind optimism; missing or incorrect numbers; homogeneous thinking; box-standard and obvious moves presented as insight; supposed divergence that is only recombination of historical patterns; affirmation of a basic idea shell instead of a serious challenge; imported AI house style, including clipped, bossy two-word sentence stacks"; caveat: "The evaluator must also allow an obvious or simple answer when evidence genuinely makes it best".
- Real-world example: "Here's the thing. AI is changing everything. Are you ready?"
- "Do this today": Paste your last AI draft back with: "Check this against these 7 tells and quote any instance." Fix the top two.
- Strength 1-5: 5
- Sensitivity: None.

### Different options, not differently worded options
- Bucket: LEVEL UP
- The idea in one plain sentence: When AI gives you "three options", check they rest on genuinely different reasons; if they only differ in wording or colour, you've got one option three times.
- Why it matters: Quality of choices, better strategy.
- Source: `deeplake-hivemind-concept-assessment-2026-09-07.md`: "Do the options rely on different causal models, or only different wording?"; "Which option challenges the user's initial frame?"; `ctrl-evolution/design/g13-round-1-diversity-failure.md`: "No pair differs on two load-bearing axes. Palette, copy and minor control differences do not count." (three AI-generated design concepts were all rejected as the same idea).
- Real-world example: Three campaign ideas that are all "customer testimonial video" with different taglines.
- "Do this today": Ask for options, then ask: "What is the core reason each one would work? If two share the same reason, replace one with an option built on a different reason."
- Strength 1-5: 4
- Sensitivity: None.

### Brainstorm before the meeting, decide in it
- Bucket: LEVEL UP
- The idea in one plain sentence: Have AI prepare genuinely different, on-brand options before a meeting so the humans spend their time comparing and choosing, not staring at a blank whiteboard.
- Why it matters: Time (shorter meetings), quality ("better ideas faster, not more worse ideas faster").
- Source: `ctrl-evolution/README.md` ACTIVE_CASE: "an hour-long synchronous meeting to brainstorm one social post. A criteria-, voice- and tone-governed system could generate genuinely divergent directions before the workday, allowing any human discussion to start with comparison, rejection, combination and direction choice. The standard is better ideas faster, not more, worse or cosmetically similar ideas faster."; ledger D-041.
- Real-world example: Source case: a team spending an hour to brainstorm a single social post.
- "Do this today": Before your next brainstorm, ask AI for five directions from five different angles using your brand rules. Send them ahead. Open the meeting with "Which do we kill first?"
- Strength 1-5: 5
- Sensitivity: The source example is from an active client-like case; use only the generic "one social post" framing, no company details.

### Make the AI-native version of the question
- Bucket: LEVEL UP
- The idea in one plain sentence: Before answering an ordinary business question, reframe it as "what's the AI-native version of this decision?"
- Why it matters: Strategy and money (you consider options that didn't exist two years ago).
- Source: `decision-engine/reframe.ts` examples: "'Should I hire a VP of Sales?' -> 'Before you hire, should an agent own part of the sales motion first, and what does the human role become?'"; "'Should we raise prices?' -> 'Should the AI-native version of your offer change what you sell and how you price the AI capability itself?'"; the original statement is always kept: "Nothing is silently swapped."
- Real-world example: "Should we move upmarket?" becomes "What would the AI-native version of our product need to be to win upmarket?"
- "Do this today": Take one decision on your desk and write its AI-native version as a question. Ask AI to compare the two framings.
- Strength 1-5: 5
- Sensitivity: None.

### Six forces for any AI decision
- Bucket: LEVEL UP
- The idea in one plain sentence: Weigh any AI move on six forces: can the AI actually do it yet, does the cost beat the value, how much can it own safely, build or buy, is the team ready, and is this the right next move.
- Why it matters: Money and risk (fewer expensive AI mistakes).
- Source: `decision-engine/decompose.ts` / `advise.ts`: "Capability fit... Economics: cost to build plus run vs the value... Autonomy and risk: how much AI can own, where the human checkpoint is... Build vs buy: lock-in vs portability... Org readiness... Sequencing: is this the right next move, or does something come first"; `DECISIONS_LOG.md` Decision 64 (radial "force spider").
- Real-world example: An AI customer-service bot may pass capability and economics but fail autonomy and risk on refunds.
- "Do this today": Score one AI idea you're considering green / amber / red on the six forces. Any red is your next conversation.
- Strength 1-5: 4
- Sensitivity: None.

### The prompt check: situation, boundaries, perspective, depth
- Bucket: LEVEL UP
- The idea in one plain sentence: A good prompt gives the situation, what you don't want, a role to think from, and asks for thinking rather than fetching.
- Why it matters: Time and quality on every prompt.
- Source: `supabase/functions/prompt-coach/index.ts`: "1. Context - Does the AI know why this matters and who it's for? 2. Boundaries - Does the AI know what NOT to do? 3. Perspective - Has the AI been given a role to think from? 4. Depth - Is the AI being asked for thinking (high value) or just fetching (low value)?"; tone rules: "Never give more than ONE thing to improve".
- Real-world example: "Summarise this report" (fetching) vs "As our CFO, what in this report should change our Q3 hiring plan, and what should I ignore?" (thinking).
- "Do this today": Take your most-used prompt. Add one line for each of the four. Improve only one thing at a time.
- Strength 1-5: 4
- Sensitivity: None.

### Saved prompt or real skill? The four honest tests
- Bucket: LEVEL UP
- The idea in one plain sentence: Only turn a task into a reusable AI skill if you do it at least weekly, generic AI gets it wrong, you can say when to use it in one sentence, or it needs to sound like you; otherwise it's just a memory fact or a style note.
- Why it matters: Time (automate the right things), avoids junk automations.
- Source: `generate-skill-export/prompt.ts`: "Step 0 - Bounded trigger check"; "1. REPEATABLE: Is this work done at least weekly?... 2. SPECIALISED... 3. BOUNDED: Can you describe when to use it in one or two sentences?... 4. CONSISTENT CREATIVE OUTPUT (voice-lock pass)"; route-outs "custom_instruction", "memory_fact", "saved_style"; `DECISIONS_LOG.md` Decision 38: "CTRL refuses to produce junk and tells the leader exactly where their input belongs instead."; Decision 51: a skill should be "a concrete recurring deliverable", not a vague "Hiring Challenge".
- Real-world example: "Draft my Monday board update" passes; "make everything sound more confident" is a style note.
- "Do this today": List five things you ask AI for. Run each through the four tests. Pick the one that passes and write it as a reusable instruction.
- Strength 1-5: 5
- Sensitivity: None.

### The description is 80% of the skill
- Bucket: LEVEL UP
- The idea in one plain sentence: When you write a reusable AI instruction, spend most effort on when it should kick in, using the exact words you actually say, and explain the why behind every hard rule.
- Why it matters: Time (the skill actually triggers), quality (AI extends reasons, breaks on arbitrary rules).
- Source: `generate-skill-export/prompt.ts`: "Description (THIS IS 80% OF THE SKILL)"; "List 5+ trigger phrases using the leader's ACTUAL language"; "NO BARE MUST/NEVER: If a hard rule exists, the next sentence must explain why it exists. The model extends reasoning correctly; it breaks on arbitrary rules."; BAD "NEVER use bullet points" vs GOOD "Avoid bullet points. The audience reads this as a continuous narrative, and bullets fragment the argument."; test prompts must be "MESSY... the way a real person types at 9am on Monday".
- Real-world example: Source test prompt: "ok so my sales team just posted their updates in slack and I need to get the board update done before my 10am..."
- "Do this today": Rewrite one rule in your AI instructions from "Never X" to "Avoid X, because Y". Then test your instruction with a sloppy, rushed request, not a clean one.
- Strength 1-5: 4
- Sensitivity: Source refers to "Krish's Skill-Building Best Practices PDF"; fine to reference Krish's own method.

### Every skill needs a learning loop
- Bucket: LEVEL UP
- The idea in one plain sentence: A reusable AI skill doesn't improve on its own; after each run note whether you kept, edited or binned the output, and turn repeat corrections into "gotchas".
- Why it matters: Quality compounds over time instead of decaying.
- Source: `generate-skill-export/prompt.ts` "2C-LL": "After each run the leader notes whether the output was kept as-is, edited, or rejected, and the single biggest correction goes down in one line."; "Recurring corrections graduate into new '## Gotchas' entries"; "The skill does not update itself."; `supabase/functions/_shared/staleness.ts`: "the standard moves, the installed skill does not, and both sides believe they are current."; `DECISIONS_LOG.md` Decision 55.
- Real-world example: Your "weekly client update" skill gains a gotcha: "Never lead with apologies for delays (corrected 3x)."
- "Do this today": Add a "Gotchas" section to your most-used AI instruction. Write the last correction you made in one line.
- Strength 1-5: 4
- Sensitivity: None.

### Grade 30 pieces to find your real standard
- Bucket: LEVEL UP
- The idea in one plain sentence: You discover your actual quality bar by grading real examples (send / wouldn't send, plus one line why), not by trying to describe it from scratch.
- Why it matters: Quality and delegation (you can hand your standard to AI or a team).
- Source: `supabase/functions/compile-standard/prompt.ts`: "You are not deciding what this person values. They already did that, by grading thirty pieces of work."; `build-sort/prompt.ts`: matched pairs "differing on exactly ONE dimension"; "The violating half is COMPETENT work. It would pass review at most companies. Not a strawman"; Sort UI copy: "Most of these are deliberately mediocre. Some are yours. Rejecting a lot of them is the normal result and it is the useful one."
- Real-world example: Grade 30 sales emails: the ones you'd send all name a specific client fact; the rejects "could be for anyone".
- "Do this today": Pull 10 past emails or posts (yours and AI drafts). Mark each send / wouldn't send with one line why. Look for the reason that repeats. That's your first rule.
- Strength 1-5: 5
- Sensitivity: "Thirty pieces" is the product method; fine to teach.

### Name your rule in your own words, and make it yes/no
- Bucket: LEVEL UP
- The idea in one plain sentence: Write each quality rule in your own words as a yes/no check, not a score out of 10, because a score hides which rule actually failed.
- Why it matters: Quality (actionable reviews), adoption (you trust rules that sound like you).
- Source: `compile-standard/prompt.ts`: "The NAME comes from the emergent pole, shortened, in their words. 'Earned claim.' 'Actually seen the client.' Never 'Client Specificity Score'"; "if it sounds like a consultant wrote it they will not trust that it came from them"; "Binary. No score, no percentage, no five point scale: an aggregate hides which criterion failed".
- Real-world example: "Actually seen the client" (yes/no) versus "Personalisation: 7/10".
- "Do this today": Rewrite your three quality rules as yes/no questions in phrases you'd actually say out loud.
- Strength 1-5: 4
- Sensitivity: None.

### Check you're consistent before you write rules
- Bucket: LEVEL UP
- The idea in one plain sentence: Before turning your taste into rules for AI, re-grade a few pieces later without looking; if you disagree with yourself, the problem is the rule, not the AI.
- Why it matters: Quality (no contradictory instructions), saves time chasing AI "inconsistency".
- Source: `supabase/functions/_shared/discrimination.ts` CH-12: "An inconsistent grader produces the same signature as a confounded generator"; migration comment: "sort_items.repeat_of marks self-agreement probes (never scored)"; Sort UI: "Some of these are a test and I will not tell you which."
- Real-world example: You call a draft "too long" Monday and "too thin" Thursday.
- "Do this today": Re-grade three items you graded last week without looking at your old verdict. Count the mismatches.
- Strength 1-5: 3
- Sensitivity: None.

### The say-do gap
- Bucket: LEVEL UP
- The idea in one plain sentence: Ask AI to compare what you say matters with what keeps showing up in your week, then run one 15-minute experiment on the gap.
- Why it matters: Time and focus (spot where your attention leaks), leadership growth.
- Source: `supabase/functions/blind-spot/index.ts`: "surface one useful tension between what the user says matters and what keeps recurring"; "Prefer a true pattern only when one intention and at least two independent recurrence records support it."; "Propose one concrete experiment that takes 15 minutes or less."; "No corporate jargon, therapy language, cliches, em dashes, or flattery."; fallback question: "What keeps returning to you after you thought it was owned elsewhere?"; `DECISIONS_LOG.md` Decision 79: "Anything thinner is a tension, not a diagnosis."
- Real-world example: You say "deep work on strategy" matters; three of your last four weeks were eaten by approving invoices.
- "Do this today": Paste your top 3 stated priorities and last week's calendar into AI: "Show one gap between what I say matters and what keeps recurring. Need at least two examples. Then give me one 15-minute experiment."
- Strength 1-5: 5
- Sensitivity: Avoid presenting as diagnosis or therapy.

### The weekly 30-second voice note with five thinking tools
- Bucket: LEVEL UP
- The idea in one plain sentence: Record a 30-second voice note on what's on your mind, then have AI run it through five thinking tools and return one sharp insight and one action.
- Why it matters: Quality of thinking, time (30 seconds in, one action out).
- Source: `supabase/functions/submit-weekly-checkin/index.ts`: "FIRST-PRINCIPLES THINKING", "DIALECTICAL REASONING (Thesis-Antithesis-Synthesis)", "MENTAL CONTRASTING (WOOP - Oettingen)", "A/B FRAMING (Tversky & Kahneman)", "REFLECTIVE EQUILIBRIUM (Rawls)"; "Echo their EXACT words"; "NEVER give generic advice - if it could apply to anyone, rewrite it"; `DECISIONS_LOG.md` Decision 23; `CTRL-CORPUS.md` §12 "The five-step spine".
- Real-world example: WOOP: Wish, Outcome, Obstacle, Plan.
- "Do this today": Voice-note your biggest worry for 30 seconds, transcribe it, and ask AI: "Using first principles, the strongest case for and against, WOOP, positive vs negative framing, and say-vs-do: give me one insight in my own words and one action for this week."
- Strength 1-5: 4
- Sensitivity: Do not repeat the prompt's fictional "coached 500+ executives" persona.

### Mirror questions that reveal what you want from AI
- Bucket: LEVEL UP
- The idea in one plain sentence: Five short questions surface where AI could help you most, starting with "how much of your week actually needs you?"
- Why it matters: Time and strategy (target AI where it frees the most valuable you).
- Source: `src/components/onboarding/CtrlOnboarding.tsx` and `onboardingModel.ts`: "Picture your week as it is now. How much of it actually needs you?"; "If you had one extra version of yourself, what would they spend their time on?" (Thinking / Doing / Talking / Watching); "How much of what your company does could a well-built AI handle today, if you let it?"; "What kind of company do you actually want to be running in three years?" (same but sharper / leaner / hybrid humans and agents / autonomous); "What's the one decision you keep not making?"
- Real-world example: Answering "talking" for the extra self tells you to automate prep and admin, not conversations.
- "Do this today": Answer the five questions in a note. Share with your AI and ask: "Based on these, what's the one thing I should hand to AI first?"
- Strength 1-5: 5
- Sensitivity: These are product onboarding copy; fine to use as questions, avoid presenting as a branded quiz.

### The fluency loop: notice, prepare, delegate or keep, check, correct, encode
- Bucket: LEVEL UP
- The idea in one plain sentence: Being good with AI isn't knowing tools; it's a loop: notice the task, improve the inputs, decide what to delegate and what to keep, hand off clearly, check, correct, and save the lesson.
- Why it matters: Quality and time; the real skill behind every AI win.
- Source: `ctrl-evolution/README.md` PRODUCT_TRUTH: "notice the task and information movement; improve data readiness; decide what to delegate and what to retain; specify and receive the handoff; ask for reflection; inspect, validate and independently verify; correct the result; and encode what was learned. The target is not maximum automation. Correct non-delegation, anticipatory error detection and preserved taste are positive evidence of fluency."; ledger D-037, H-013 ("Behavioural traces outperform self-reported AI fluency").
- Real-world example: Deciding NOT to let AI write a sensitive client apology is a sign of fluency, not a failure.
- "Do this today": Pick one AI task you did today and walk it through the seven steps. Which step did you skip?
- Strength 1-5: 5
- Sensitivity: None.

### Protect, Automate, Elevate
- Bucket: LEVEL UP
- The idea in one plain sentence: Sort your work into three lanes: what must stay human, what AI can absorb, and what you'll level up with the time freed, and lock the "must stay human" items so no shiny automation sneaks over them.
- Why it matters: Risk (no automating the wrong thing), time, strategy.
- Source: `project-documentation/FEATURES.md` workshop "Rewrite (Effortless Map): Three lanes: Protect, Automate, Elevate"; `CTRL-CORPUS.md` §12: "the handoff classifier (Labour to absorb, a prepared call to make, Action to protect)"; `DECISIONS_LOG.md` Decision 46: "any box that touches a flagged guardrail can never be left agent-led"; org chart kit: "the lines you flagged as no-go locked human-led".
- Real-world example: Protect: firing decisions, client apologies. Automate: meeting notes, data pulls. Elevate: client strategy.
- "Do this today": Draw three columns. Put ten of your weekly tasks in them. Circle the Protect column and tell your AI tools "never draft these without asking me first."
- Strength 1-5: 5
- Sensitivity: Workshop was a Mindmaker paid exec bootcamp; teach the lanes, not the product.

### Don't bank the saved time, reinvest it
- Bucket: MINDSET
- The idea in one plain sentence: The point of AI isn't fewer hours; it's moving your attention from moving information around to standards, customers, strategy and the final finishing touch only you can do.
- Why it matters: Revenue and quality (time goes to the work that pays), avoids "busier but no better".
- Source: `CTRL-CORPUS.md` §12: "Reclaim -> Amplify -> Re-architect (don't bank the saved time - reinvest it)"; "Operator -> Governor (you make ~20 calls; the system makes hundreds)"; `ctrl-evolution/README.md` D-039: "governed AI handling of information logistics and administration while human attention moves into standards, relationships, strategy, distinctive final craft and ownership"; `src/content/answers/ai-chief-of-staff-decision-quality-vs-task-automation.md`: "time saved... it's the setup, not the payoff."
- Real-world example: AI saves you 3 hours a week on reports; you put 2 of them into customer calls.
- "Do this today": Estimate hours AI saved you last week. Block that time next week for one named high-value activity (a client call, a strategy hour).
- Strength 1-5: 5
- Sensitivity: None.

### The board-ready one-pager
- Bucket: LEVEL UP
- The idea in one plain sentence: End every big AI-assisted decision with a one-page memo: the question, your call and confidence, what checks out, what's shaky, the breakpoint, the case against, and what to validate next.
- Why it matters: Time (decision is shareable instantly), quality, accountability.
- Source: `DECISIONS_LOG.md` Decision 62: "question, AI-native reframe, the call with confidence, what checks out / what's shaky, the breakpoint, the case against, tensions, validate-next, and a per-claim evidence appendix"; "No options section is fabricated".
- Real-world example: A one-page memo your board or co-founder can read in two minutes.
- "Do this today": Save that eight-heading template. Use it for your next decision, filling only what's real.
- Strength 1-5: 4
- Sensitivity: None.

### Pick, don't describe
- Bucket: LEVEL UP
- The idea in one plain sentence: People are bad at describing their preferences from scratch but great at recognising them, so ask AI to show you options to pick from instead of asking you open questions.
- Why it matters: Time and quality (better signal with less effort).
- Source: `CTRL-CORPUS.md` §6 Law 2: "Options, never open questions... An open prompt that forces a tired leader to think from zero is a failure"; `DECISIONS_LOG.md` Decision 51: "never asks the leader to 'describe your tone'... recognition-over-recall"; `ctrl-evolution/session-method-learning-log.md`: "Use stack-ranked interactive intake... Give each ranked question an optional notes route."
- Real-world example: Instead of "what tone do you want?", AI shows three openers and you pick one.
- "Do this today": Next time you brief AI, end with: "Before you write, show me 3 short contrasting samples and let me pick."
- Strength 1-5: 4
- Sensitivity: None.

### Keep a ledger for long AI sessions
- Bucket: LEVEL UP
- The idea in one plain sentence: In long AI projects, the AI will forget earlier decisions, so keep a running ledger of answers, reasons, rejected routes and the exact next step.
- Why it matters: Time and quality (no rework when context resets), risk.
- Source: `session-method-learning-log.md`: "Maintain durable ledgers and a clear progress route throughout mammoth sessions. Context compaction must not erase answers, rationale, rejected routes, approval state or the exact next gate."; `design/g14-founder-build-calibration.md` ruin condition (paraphrase): the AI randomly forgets half of what was planned early on, which is why ledgers and progress trackers were requested; ledger D-004: "No material answer... may live only in conversational memory".
- Real-world example: A long Claude project to plan a launch loses the pricing decision from day one.
- "Do this today": In your current long AI project, create a "Decisions so far" doc: decision, why, what we rejected, next step. Paste it at the start of each new session.
- Strength 1-5: 5
- Sensitivity: Paraphrase the founder's ruin-condition quote; don't show it verbatim.

### Show it cold, explain later
- Bucket: LEVEL UP
- The idea in one plain sentence: When you want honest feedback on AI-assisted work, show the thing first without the explanation, because your rationale anchors people's reaction.
- Why it matters: Quality of feedback, fewer launches that only made sense with a voiceover.
- Source: `session-method-learning-log.md` candidate practice: "Present material artifacts cold before explaining the rationale, so founder reaction remains useful evidence."; founder-gate records capture "unanchored" reactions.
- Real-world example: Send the landing page draft with no notes; ask "what do you think this does?"
- "Do this today": Next draft you share, send it with one question only: "What is this asking you to do?"
- Strength 1-5: 3
- Sensitivity: None.

### Build a "What would I do?" judge, but don't let it approve
- Bucket: LEVEL UP
- The idea in one plain sentence: Once you've recorded enough of your past decisions, AI can predict how you'd react to new work; useful as a critique, never as your sign-off.
- Why it matters: Time (faster self-review), quality, keeps accountability.
- Source: `session-method-learning-log.md`: "Add an advisory 'What Would Krish Do?' judge only when enough documented decisions exist and it contributes a distinct critique rather than simulated approval."; `design/g14-wwkd-verdict.md`: "It is not founder approval, a substitute for an unanchored reaction, or authority to implement".
- Real-world example: The predicted reaction source records: one design likely to "win the first visual glance", another to "survive the first ten seconds of actual use".
- "Do this today": Paste 5 of your past decision records into AI and ask: "Based only on these, how would I react to this new proposal, and why? Quote the records."
- Strength 1-5: 4
- Sensitivity: "What Would Krish Do" is internal naming; fine for Krish to tell as his own story.

### Strip the pompous AI lines
- Bucket: LEVEL UP
- The idea in one plain sentence: Cut any AI-written line that announces importance instead of doing something, and test everything with "would a 12-year-old get this?"
- Why it matters: Quality and credibility; clearer communication.
- Source: founder-gate records in `ctrl-evolution/design/` (paraphrased): dislikes "AI written arrogant lines like 'One move has earned the session'"; "huge pointless pompous smart arse announcement titles"; "Should be able to be understood by a 12-year-old."; `ctrl-evolution/README.md` D-054: "remove interface copy that adds no meaning"; `design/g14-reset-judge-rubric.md`: "Can a twelve-year-old explain what to do and what happened?"
- Real-world example: "This changes everything." "One move has earned the session." Both say nothing.
- "Do this today": Highlight every sentence in your last AI draft that doesn't carry a fact, action or decision. Delete them. Read it aloud to check a 12-year-old would follow.
- Strength 1-5: 4
- Sensitivity: Founder quotes contain crude language; paraphrase only.

### Ship it in seven days
- Bucket: LEVEL UP
- The idea in one plain sentence: After learning any AI skill, measure yourself on whether you shipped one real thing with it within a week, not on whether you read the notes.
- Why it matters: Time-to-value; habits that stick.
- Source: `FEATURES.md` Kit Engine: "This replaces the static Google Docs follow-up that every class used to send. Those got 0% adoption - a link in an email that nobody opened."; "the 7-day ship rate (did the student ship the thing the class was about, within a week)"; day 3 and day 7 nudges.
- Real-world example: After a prompt workshop, you ship one automated weekly report by Friday.
- "Do this today": Pick one AI thing you learned this month. Write "Shipped by <date 7 days out>" and the smallest version that counts.
- Strength 1-5: 4
- Sensitivity: "0% adoption" is an internal claim without stated measurement; say "almost nobody opened them" rather than quoting a figure.

### Does this news change a decision I've already made?
- Bucket: LEVEL UP
- The idea in one plain sentence: Filter AI news with one question: does this change something I've already decided? If not, it's noise, however well written.
- Why it matters: Time (less reading), focus.
- Source: `src/content/answers/cut-ai-news-noise-without-missing-what-matters.md`: "Ask whether it changes a decision you've already made, not whether it's well-written or widely shared."; "A newsletter ranking optimises for signal-to-noise across a general audience... That's a quality bar, not a relevance bar."; `project-documentation/HISTORY.md` briefing "excludes (never-show)" list; Master messaging: explain why something appeared with "anchored to".
- Real-world example: A new model release matters only if it changes what's buildable in your product.
- "Do this today": Write your three live decisions on a sticky note. For one week, only read AI news that touches one of them. Add a "never show me" list to your news tool or AI digest prompt.
- Strength 1-5: 4
- Sensitivity: Source names newsletter-ranking sites; don't name them.

### Test whether your AI actually remembers your judgement
- Bucket: LEVEL UP
- The idea in one plain sentence: Correct an AI tool's reasoning on one decision, come back weeks later on a related one, and see whether it remembers the correction or resets to generic advice.
- Why it matters: Money (pick tools that compound), quality.
- Source: `src/content/answers/evaluate-ai-decision-tool-trustworthy-leadership-team.md`: "Use it on a real decision, correct its reasoning, then return weeks later on a related decision. If it repeats the same generic reasoning, it reset. If it references the earlier correction, it didn't."; `ai-chief-of-staff-decision-quality-vs-task-automation.md`: "Check whether the tool can articulate your standards back to you before you decide, not just after you're done."
- Real-world example: Your AI assistant keeps recommending a discount strategy you rejected last month.
- "Do this today": Ask your AI tool: "What do you know about how I make decisions? Quote anything I've corrected you on." See what comes back.
- Strength 1-5: 4
- Sensitivity: Source answers name competitor tools; do not use names.

---

## MINDSET

### Sharpen judgement, never outsource it
- Bucket: MINDSET
- The idea in one plain sentence: Do the first and last 20% of any important piece of thinking yourself; AI does the middle, and it's a thought partner, not an oracle.
- Why it matters: Quality, accountability, keeps your edge.
- Source: `CTRL-CORPUS.md` §3/§6 Law 3: "They do the first and last 20% themselves; that is where judgment is sharpened and ownership is earned."; §12: "'informed by AI, not determined by it.'"; "thought partner, not oracle"; §4: "It is a chief of staff, not a chief operating officer."; `PURPOSE.md`: "CTRL can improve the evidence and the frame. It must never pretend to own the call."
- Real-world example: You set the question and make the final call; AI gathers, drafts and argues back.
- "Do this today": On your next AI task, write the brief and the final edit yourself, by hand, and let AI only do the middle.
- Strength 1-5: 5
- Sensitivity: None.

### Earned conviction, not borrowed certainty
- Bucket: MINDSET
- The idea in one plain sentence: AI's confidence should match its evidence; be confident about facts you checked and tentative about interpretation.
- Why it matters: Risk (overconfident decisions), trust.
- Source: `CTRL-CORPUS.md` §14: "earned conviction, not borrowed certainty."; §15: "when the engine says 80%, it's right about 80% of the time. An overconfident decision tool is worse than none."; `BRANDING.md` voice: "Confident about evidence, tentative about interpretation."; `decision-engine/advise.ts`: "Your confidence must track the evidence."
- Real-world example: "I'm 90% sure" from AI with one blog post behind it is borrowed certainty.
- "Do this today": Add to your AI instructions: "Give a confidence % on every recommendation and say what evidence it rests on. If evidence is thin, say so and ask me one question."
- Strength 1-5: 5
- Sensitivity: None.

### "I don't know" is a good answer
- Bucket: MINDSET
- The idea in one plain sentence: When evidence is thin, the best AI answer names the exact gap and the smallest test to close it, not a confident filler paragraph.
- Why it matters: Risk (no fabricated certainty), time (clear next step).
- Source: `phase-2-decision-brain-vertical-slice-contract.md`: "Abstention is a successful state: When evidence cannot support a useful view, CTRL states the exact gap and offers the smallest uncertainty-reducing move."; ledger D-019; `research/g15-judgement-resolution-findings.md` allowed copy: "Your Brain knew not to answer here."; `supabase/functions/suggest-bets/index.ts`: "Fewer is always better than invented. Never pad to reach a count."
- Real-world example: "I can't tell if your churn is pricing or onboarding; one export of cancellation reasons would settle it."
- "Do this today": Add "If you don't have enough to answer well, tell me exactly what's missing and the smallest way to get it. Never pad." to your AI instructions.
- Strength 1-5: 5
- Sensitivity: None.

### The faked green tick
- Bucket: MINDSET
- The idea in one plain sentence: Never trust "done" or "it's learning" from AI or a tool without proof you can see; "probably fixed" is not fixed, and quiet wrong answers are worse than loud crashes.
- Why it matters: Risk (shipping broken work), trust.
- Source: `CTRL-CORPUS.md` §14: "The one anti-pattern the whole Corpus forbids - the faked green tick. Never let the UI imply learning the backend isn't doing."; "'Live' means a prod screenshot only."; `DECISIONS_LOG.md` Decision 47: "treat 'it's still old' as ground truth every time; verify your own work before calling it done"; "A silent data-truncation bug is worse than a loud crash, because the corrupted data looks plausible."; `MASTER_INSTRUCTIONS.md`: "No 'probably fixed' outcomes"; `CTRL-CORPUS.md` §15: "built-but-unscheduled is indistinguishable from missing."
- Real-world example: An AI agent said a redesign was live and blamed the user's browser cache when it wasn't. (Story told in source about the product's own build.)
- "Do this today": Next time AI says something is done, ask it to show you the proof (the output, the file, the screenshot). Check one item yourself.
- Strength 1-5: 5
- Sensitivity: The cache-deflection story is Krish's own build history; fine for him to tell, keep tool/agent unnamed.

### Kill the vanity metrics
- Bucket: MINDSET
- The idea in one plain sentence: "You're 12% sharper this week" and "profile 87% complete" are fake progress; real progress is new things you can now do well and evidence that it held on new work.
- Why it matters: Quality and honesty; avoids optimising the wrong number.
- Source: `CTRL-CORPUS.md` §6 Law 7: "'You're 12% sharper this week' was ranked last."; `research/g15-judgement-resolution-findings.md` must-not-say list: "Your Brain is 73% complete." "Upload five more files to improve your score."; "The displayed metric must not become the optimisation target." (Goodhart); `DECISIONS_LOG.md` Decision 63: earned stages "getting oriented -> operating -> calibrating -> compounding... never points, streaks, or badges."
- Real-world example: A team celebrating "1,000 prompts run" when no decision improved.
- "Do this today": Replace one AI usage metric you track (prompts, hours "saved") with: "What did AI help us decide or ship better this week?"
- Strength 1-5: 4
- Sensitivity: None.

### Context in, judgement out, every week
- Bucket: MINDSET
- The idea in one plain sentence: An AI brain is only working when you both feed it and use it for a real decision each week; a rich brain that never drives a decision is a filing cabinet.
- Why it matters: Time well spent; compounding value.
- Source: `project-documentation/NORTH_STAR.md`: "context in, judgment out, recurring."; "A rich brain that never drives a decision is a filing cabinet. A decision with no brain behind it is a generic answer."; threshold "at least 5 current facts" and "weighed at least one decision in the last 7 days".
- Real-world example: You spend hours tidying your AI memory but never ask it a hard question.
- "Do this today": This week: add one fact to your AI brain and use it on one real decision. Calendar a recurring 10-minute slot.
- Strength 1-5: 5
- Sensitivity: Internal metric definition; fine to share the principle.

### Your taste is your moat
- Bucket: MINDSET
- The idea in one plain sentence: As AI makes everyone's output sound the same, your standards, taste and judgement become the thing that makes you worth hiring, so use AI to amplify them, not dilute them.
- Why it matters: Revenue and career resilience; differentiation.
- Source: `publicCopy.ts`: "Standards, taste and judgement are your moat"; "AI risks making humans become the same, and become replaceable."; `competitive-moat-architecture-2026-09-07.md`: "CTRL should make your thinking more distinct, not more average."; `PURPOSE.md`: "AI should amplify a leader's standards, taste, and judgement, not flatten them into generic output."; ledger D-044 "antithesis of AI-mediated convergence".
- Real-world example: "More people publishing and proposing, but more of them sounding and thinking alike." (source)
- "Do this today": Write down three things about how you work that a competitor couldn't copy. Put them in your AI instructions as standards.
- Strength 1-5: 5
- Sensitivity: None.

### An AI that only agrees with you is useless
- Bucket: MINDSET
- The idea in one plain sentence: The goal isn't an AI that perfectly mimics your answers; it's one that knows your standards well enough to challenge you with evidence.
- Why it matters: Quality of decisions; avoids echo chambers.
- Source: ledger C-017: "Agreement with the leader cannot be the primary moat because productive challenge is part of the product's value."; `ctrl-evolution/README.md` Ikigai section: "matching the leader's existing answer would reward imitation over productive challenge"; `CTRL-CORPUS.md` Law 4: "Spar with evidence... never contrarianism for its own sake."; `publicCopy.ts`: "a brain that only ever agrees with itself is not holding anything".
- Real-world example: Instructing AI "push back with evidence when I'm about to repeat a past mistake" (source context-builder preamble: "Challenge me when I repeat past mistakes.").
- "Do this today": Add to your AI instructions: "Challenge me with evidence when my request contradicts my stated goals or past decisions. Don't just agree."
- Strength 1-5: 5
- Sensitivity: None.

### Judge the decision, not the dice
- Bucket: MINDSET
- The idea in one plain sentence: Score your decisions on process, calibration and whether you pushed back at the right times, not just on whether they worked out, because luck hides in outcomes.
- Why it matters: Better long-run decisions; fairer team reviews.
- Source: `ctrl-evolution/README.md` Ikigai: "Decision scorecards must measure process, calibration and appropriate resistance rather than naive win/loss outcomes."; ledger Q-012: "How will CTRL separate good process from lucky outcome"; `context-circulation-architecture.md`: "Outcome: what happened after a decision, including ambiguity and luck."
- Real-world example: A hire that worked out despite skipping references was a lucky bad decision.
- "Do this today": Review one past decision: rate the process (evidence, alternatives, breakpoint known?) separately from the result.
- Strength 1-5: 4
- Sensitivity: None.

### Model agreement is not proof
- Bucket: MINDSET
- The idea in one plain sentence: A second AI agreeing with the first is useful evidence, not permission; a human still has to read both the work and the review and own the result.
- Why it matters: Risk and accountability.
- Source: `ctrl-evolution/README.md` D-040: "Consequential work gets appropriate independent AI validation and verification, while a human critically assesses the work and audit and retains final accountability."; "Model agreement never becomes release authority."; ledger C-022.
- Real-world example: Two AIs approve a contract summary; neither noticed the termination clause.
- "Do this today": For one important AI-checked document this week, read the review AND spot-check one claim yourself before sending.
- Strength 1-5: 4
- Sensitivity: None.

### Interesting isn't enough to interrupt
- Bucket: MINDSET
- The idea in one plain sentence: An AI alert, digest or agent should only interrupt you when it changes a decision, prevents a real mistake or protects a standard; "interesting" doesn't earn your attention.
- Why it matters: Time and focus (protects attention, the scarcest resource).
- Source: `context-circulation-architecture.md` orchestration policy: "Is interruption earned? Surface only if it changes a decision, prevents a meaningful error, preserves a standard or creates disproportionate value."; "What is the smallest useful form?"; ledger D-034: "'interesting' alone does not earn the right to interrupt"; `PURPOSE.md`: "The scarcest resource is not information. It is the leader's attention and judgement."
- Real-world example: An AI news agent pinging you every hour versus one weekly "this changes your Q3 plan" note.
- "Do this today": Audit your AI notifications and digests. Turn off any that haven't changed a decision in the last month.
- Strength 1-5: 4
- Sensitivity: None.

### Learn from what people do, not from asking "was this helpful?"
- Bucket: MINDSET
- The idea in one plain sentence: Constant "rate this" prompts are noise; the real signal is what you keep, edit, ignore or rotate, and a click is a hint, not a fact about who you are.
- Why it matters: Quality of personalisation; less friction.
- Source: `design/g14-founder-build-calibration.md` founder note (paraphrase): every action should be the map of what's useful "as opposed to continually asking the user for praise"; synthesis: "it must not silently convert a click into a durable claim about the person. Direct correction outweighs passive behaviour."; "No repeated 'Was this helpful?' prompts."; `DECISIONS_LOG.md` Decision 49: the swipe "trains the feed".
- Real-world example: You thumbs-down three AI news items on crypto; the feed should quietly drop crypto, not ask you to fill a survey.
- "Do this today": In the AI tools you use, use the thumbs-down or "regenerate" honestly for a week instead of ignoring bad outputs.
- Strength 1-5: 3
- Sensitivity: None.

### See what's possible before you set strategy
- Bucket: MINDSET
- The idea in one plain sentence: Leaders need hands-on AI experience before setting AI strategy, because firsthand use reveals possibilities that slides never will, and telling a team to "use AI more" fails without a new plan, incentives and measures.
- Why it matters: Strategy quality; avoids failed AI rollouts.
- Source: `ctrl-evolution/README.md` ACTIVE_CASE: "firsthand AI fluency revealed a radically different production possibility, while day-to-day work remained in the old paradigm. That possibility-perception gap is causally prior."; ledger E-042: "Generic AI exhortation failed before strategy, incentives and measures had been redesigned."; H-010: "Legacy mandates and measures may be producing some of the hesitation currently attributed to people."; H-012 "Sovereign AI fluency precedes accountable AI strategy".
- Real-world example: A team told to "use Claude more" while still measured on posts per week keeps doing posts the old way.
- "Do this today": Spend 15 minutes doing one real piece of your team's work yourself with AI. Write down one thing that surprised you about what's possible.
- Strength 1-5: 5
- Sensitivity: Derived from a real client-like case; keep fully anonymous and generic. Do not mention "mid-level staff" or "LinkedIn posts" in a way that could identify a company.

### Fix the system before blaming the people
- Bucket: MINDSET
- The idea in one plain sentence: When a team "resists AI", check first whether the strategy, incentives and measures actually changed; hesitation is often the old system working as designed.
- Why it matters: Risk (wrong people decisions), adoption success.
- Source: ledger Q-051: "The team was asked to use an AI tool more before a clear strategy, operating contract, incentives or measures had been committed."; C-016: "The operating-model problem is increasingly supported; the personnel conclusion remains underdetermined."; `phase-2-decision-brain-vertical-slice-contract.md` contrast example: "It does not yet distinguish unwilling people from people working under an uncommitted strategy and unchanged incentives."
- Real-world example: The same contrast as source, generic: "Is this unwilling people, or people working under an unchanged scorecard?"
- "Do this today": Write down what your team is measured on. Does any measure reward working the new AI way? If not, change one.
- Strength 1-5: 5
- Sensitivity: Same anonymity rule as above. Source also bars AI evaluating named people; keep it about systems.

### Attention is the scarce resource, not information
- Bucket: MINDSET
- The idea in one plain sentence: More AI information adds to the mess; the win is one clear next step you can take with conviction, today, then again tomorrow.
- Why it matters: Time and focus; reduces overwhelm.
- Source: `CTRL-CORPUS.md` §1: "Their scarcest resources are attention and clarity, not information. Give them more information and you have added to the spaghetti. Give them one clear next step and you have done the only thing that matters."; `src/.../get-or-generate-weekly-action/index.ts`: "One action. One sentence. Actionable."; `PURPOSE.md`.
- Real-world example: Ending every AI session with exactly one next action instead of a list of twelve.
- "Do this today": End your next AI chat with: "Give me the one thing to do next. One sentence. Not a list."
- Strength 1-5: 4
- Sensitivity: None.

### Sparse and honest beats rich and invented
- Bucket: MINDSET
- The idea in one plain sentence: Design your AI use for a world with less data than you'd like, and prefer "nothing worth your time today" over invented filler.
- Why it matters: Risk (fewer hallucinations), trust.
- Source: `CTRL-CORPUS.md` Law 1: "Data realism above all. Never promise magic the data can't deliver... Design for a sparse world and a busy human."; §14: "a sparse profile returns 'nothing worth your time today,' never invented filler."; `supabase/functions/card-for-you/index.ts`: "If the leader context is thin, stay honest... rather than pretending to know specifics."; `project-documentation/COMMON_ISSUES.md` Issue 8 "Hallucinated Insights... Require evidence citations".
- Real-world example: An AI daily digest that says "nothing relevant today" earns more trust than one that always finds something.
- "Do this today": Add to your AI digest or briefing prompt: "If nothing genuinely matters to my priorities today, say so in one line."
- Strength 1-5: 3
- Sensitivity: None.

---

## Top 15 (ranked)

1. **Write your view before you ask the AI** - capture your call, confidence and what would change your mind first, then reconcile, not comply.
2. **The amnesia tax** - every AI starts from zero; the cold-vs-loaded test shows exactly what that costs you.
3. **Find the breakpoint** - the one assumption that breaks the decision, plus the strongest honest case against it.
4. **Teach taste with a yes and a no** - adjectives produce cosplay; one loved example, one rejected, and the reason.
5. **You can't Google an assumption** - facts get checked, assumptions get tested in the real world; AI "verifying" them is faking it.
6. **Never let a worker grade its own homework** - review AI work with a different model, a fresh chat or a human.
7. **The generic-AI tells checklist** - blind optimism, missing numbers, sameness, obvious moves, bossy two-word sentences.
8. **The name-swap test** - could someone who's never met you have written this? Then it's generic.
9. **The say-do gap** - what you say matters vs what keeps recurring, then one 15-minute experiment.
10. **Brainstorm before the meeting, decide in it** - AI prepares genuinely different options; humans start at judgement.
11. **Don't bank the saved time, reinvest it** - move attention from information shuffling to customers, standards and strategy.
12. **Protect, Automate, Elevate** - three lanes, with the "must stay human" lane locked.
13. **Make the AI-native version of the question** - "Should I hire a VP of Sales?" becomes "should an agent own part of sales first?"
14. **Transcripts lie by omission** - said is not believed, proposed is not decided, summaries erase disagreement.
15. **Correct once, fix the whole class** - turn every repeated correction into a rule so the mistake can't come back.

Strong runners-up: Ask more than one AI and don't average them; Mirror questions ("how much of your week actually needs you?"); The fluency loop; Saved prompt or real skill (four honest tests); Keep a ledger for long AI sessions; See what's possible before you set strategy; Fix the system before blaming the people; Earned conviction, not borrowed certainty; Quote before you score; The three-layer setup.
