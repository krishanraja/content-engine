# Evidence v2: does the model name matter, or the thinking setting?

Researched 2026-10-14 for the makeyourmindup article (Krish Raja). Spine approved by Krish 2026-10-14.
Every quote below was read on the page (or in the downloaded PDF/dataset) unless marked otherwise.
"Verified on the page" means the exact words or numbers were seen in the source itself.

openai.com blocks direct fetches, so OpenAI pages were read through a text reader of the live page
(r.jina.ai). The GPT-5 system card and NBER paper were read as the original PDFs.

---

## Section 1: The name game (names built for launch days and headlines)

### 1.1 OpenAI's own CEO said the naming was bad enough to deserve mockery
- Claim: In April 2025 Sam Altman promised to fix OpenAI's model naming and said the company deserved to be mocked for it.
- Quote: "how about we fix our model naming by this summer and everyone gets a few more months to make fun of us (which we very much deserve) until then?"
- URL: https://x.com/sama/status/1911906570835022319
- Date: 14 April 2025
- Source type: primary (executive's own post)
- Confidence: verified on the page

### 1.2 "We hate the model picker as much as you do"
- Claim: OpenAI's February 2025 roadmap admitted its line-up had become too complicated and promised one unified system.
- Quote: "we realize how complicated our model and product offerings have gotten. We hate the model picker as much as you do and want to return to magic unified intelligence."
- Also in the same post: the goal is systems that "know when to think for a long time or not".
- URL: https://x.com/sama/status/1889755723078443244
- Date: 12 February 2025
- Source type: primary (executive's own post)
- Confidence: verified on the page

### 1.3 The GPT-5 launch livestream shipped botched charts, and Altman called it a "mega chart screwup"
- Claim: The launch-day presentation for GPT-5 had bar charts drawn out of proportion to their own numbers; Altman apologised on X.
- Quote: "mega chart screwup" (as reported)
- URL: https://tech.co/news/openai-apologizes-mega-chart-screwup
- Date: August 2025 (launch was 7 August 2025)
- Source type: secondary (I could not open Altman's original post)
- Confidence: reported elsewhere (several outlets agree). Fine as colour, not as a lead fact.

### 1.4 The names keep multiplying even as the picker turns into a thinking dial (2026)
- Claim: OpenAI's current help page sells GPT-6 Sol, GPT-6 Astra, GPT-5.6 Sol and GPT-5.6 Luna, yet the choice it asks users to make is a "Thinking" slider (Instant, Medium, High, Extra High).
- Quote: "**GPT-6** in Chat lets you choose how much ChatGPT thinks." and "Use the **Thinking** slider to choose your effort. When **GPT-6** is selected, **GPT-6 Sol** powers **Instant**, **Medium**, **High**, and **Extra High**; **Pro** uses GPT-6 Pro, powered by **GPT-6 Astra**."
- URL: https://help.openai.com/articles/20001354
- Date: page shows "Updated: 5 days ago" as read on 2026-10-14 (about 9 October 2026)
- Source type: primary (official help centre)
- Confidence: verified on the page

### 1.5 In blind tests the top models are close together (live data, 13 October 2026)
- Claim: On LMArena's text leaderboard (people vote between two anonymous answers), the #1 model scores 1533 and the #10 model 1491, a 42-point gap. My own arithmetic using the standard Elo formula: a 42-point gap means the leader is preferred in only about 56% of head-to-heads, and #2 vs #10 (24.5 points) is about 53%.
- Data (overall text category, leaderboard_publish_date 2026-10-13): 1 gemini-4-argon-high 1533.2; 2 claude-opus-5.5-high 1515.5; 3 claude-fable-5.1-max 1509.9; 4 claude-opus-5-max 1507.2; 5 muse-wonder-max (Meta) 1503.9; 10 claude-fable-5-high 1491.0. Best OpenAI entry: gpt-5.5-high, rank 28, 1471.4.
- URL: https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset (file text/latest; the public page arena.ai/leaderboard/text blocks automated reads)
- Date: 13 October 2026
- Source type: primary (LMArena's own published dataset)
- Confidence: verified in the dataset. The 56% and 53% win rates are my calculation, not LMArena's words; say "roughly" if used.
- Caution: the leaderboard measures preference on everyday prompts, not accuracy. It also shows thinking variants only slightly ahead of the same model without it (claude-opus-4-6-high 1501.8 vs claude-opus-4-6 1498.0; gpt-5.5-high 1471.4 vs gpt-5.5 1466.8). So on easy everyday chats, neither name nor thinking moves preference much. Do not claim the arena proves thinking matters.

---

## Section 2: What people actually do (ask like Google, never touch the dial)

### 2.1 Before GPT-5 removed the choice, hardly anyone used reasoning models
- Claim: When GPT-5 started switching to reasoning automatically, the share of free users using a reasoning model each day went from under 1% to 7%, and Plus users from 7% to 24%.
- Quote: "the percentage of users using reasoning models each day is significantly increasing; for example, for free users we went from <1% to 7%, and for plus users from 7% to 24%."
- URL: https://x.com/sama/status/1954603417252532479 (also quoted at https://simonwillison.net/2025/Aug/10/sam-altman/)
- Date: 10 August 2025
- Source type: primary (executive's own post)
- Confidence: verified on the page. It is daily use ("each day"). The post does not say "before GPT-5" in words; the before/after reading comes from the thread (a GPT-5 rollout thread) and Simon Willison's gloss ("revealing quite how few people used the old model picker to upgrade from GPT-4o"). Write "after GPT-5 launched, it went from under 1% to 7%".

### 2.2 Most ChatGPT use is everyday asking, not specialist work
- Claim: OpenAI and Harvard's study of 1.5 million conversations found Practical Guidance, Seeking Information and Writing make up nearly 80% of conversations; computer programming is 4.2% of messages.
- Quote (abstract): "“Practical Guidance,” “Seeking Information,” and “Writing” are the three most common topics and collectively account for nearly 80% of all conversations." Body text gives "about 77%". "only 4.2% of ChatGPT messages are related to computer programming".
- URL: https://www.nber.org/papers/w34255 (PDF: https://www.nber.org/system/files/working_papers/w34255/w34255.pdf)
- Date: September 2025 (NBER Working Paper 34255)
- Source type: primary (paper)
- Confidence: verified on the page. Use "about three-quarters" or "nearly 80%"; both are the paper's words (OpenAI's summary says "Three-quarters").

### 2.3 Half of all messages are people asking, like a search box
- Claim: About half of ChatGPT messages are "Asking" (seeking advice or information), 40% "Doing" and 11% "Expressing".
- Quote: "We estimate that about 49% of messages are Asking, 40% are Doing, and 11% are Expressing."
- URL: https://www.nber.org/system/files/working_papers/w34255/w34255.pdf ; summary at https://openai.com/index/how-people-are-using-chatgpt/
- Date: September 2025
- Source type: primary
- Confidence: verified on the page

### 2.4 The scale: billions of prompts a day, against Google's trillions a year
- Claim: By July 2025 ChatGPT users sent more than 2.5 billion messages a day (18 billion a week, 700 million weekly users). Google says it sees more than 5 trillion searches a year (roughly 14 billion a day, an outside estimate).
- Quote (paper): "By July 2025, 18 billion messages were being sent each week by 700 million users" and "more than 2.5 billion messages per day, or about 29,000 messages per second."
- Quote (Google, as reported): "We already see more than 5 trillion searches on Google annually."
- URLs: https://www.nber.org/system/files/working_papers/w34255/w34255.pdf ; https://www.thedomains.com/2025/03/04/google-is-now-seeing-5-trillion-searches-annually (citing https://searchengineland.com/google-5-trillion-searches-per-year-452928)
- Dates: September 2025 (paper, data to July 2025); March 2025 (Google figure)
- Source type: ChatGPT figure primary; Google figure secondary (I could not find Google's original blog post)
- Confidence: ChatGPT figure verified on the page. Google figure reported elsewhere. The "14 billion a day" is Search Engine Land's division, not Google's.

---

## Section 3: The switch that matters (thinking, not the brand)

### 3.1 Same model, same name: thinking nearly triples the maths score; a new name barely moved it
- Claim: On the AIME 2024 maths exam, Claude 3.7 Sonnet scored 23.3% without extended thinking and 61.3% with it. The previous model, Claude 3.5 Sonnet, scored 16.0%. So the new name added about 7 points; switching thinking on added about 38.
- Quote: table columns "Claude 3.7 Sonnet 64K extended thinking" (AIME 2024: "61.3% / 80.0%") and "Claude 3.7 Sonnet No extended thinking" ("23.3%"); "Claude 3.5 Sonnet (new)" ("16.0%"). Text: "extended thinking providing a notable boost in math and science."
- URL: https://www.anthropic.com/news/claude-3-7-sonnet (benchmark table image)
- Date: 24 February 2025
- Source type: primary
- Confidence: verified on the page (read the table image). Use 61.3%, the single-attempt figure; 80.0% uses parallel compute (many attempts), per the table's footnote. The point gaps are my subtraction.

### 3.2 Accuracy climbs as the model is given more thinking
- Claim: Anthropic says Claude's accuracy on maths questions rises predictably, roughly logarithmically, with the number of thinking tokens it is allowed.
- Quote: "its accuracy on, for example, math questions improves logarithmically with the number of “thinking tokens” that it’s allowed to sample."
- URL: https://www.anthropic.com/news/visible-extended-thinking
- Date: 24 February 2025
- Source type: primary
- Confidence: verified on the page

### 3.3 Inside one "GPT-5", the thinking version nearly doubled the hard-health score
- Claim: On HealthBench Hard, OpenAI's fast GPT-5 model (gpt-5-main) scored 25.5% and the thinking model (gpt-5-thinking) 46.2%. Both were sold to users as "GPT-5".
- Quote: "State of the art on HealthBench Hard improves from 31.6% for OpenAI o3 to 46.2% for gpt-5-thinking." and "gpt-5-main outperforms previous non-thinking models by a large margin, achieving a score of 25.5% on HealthBench Hard, where GPT-4o gets 0.0%."
- URL: https://cdn.openai.com/gpt-5-system-card.pdf
- Date: 13 August 2025 (updated system card; GPT-5 launched 7 August 2025)
- Source type: primary
- Confidence: verified on the page

### 3.4 When the switch broke, GPT-5 "seemed way dumber"
- Claim: The day after launch, the part of ChatGPT that decides whether to think stopped working, and Altman said GPT-5 seemed much worse as a result. The model name had not changed; the switch had.
- Quote: "Yesterday, the autoswitcher broke and was out of commission for a chunk of the day, and the result was GPT-5 seemed way dumber."
- URL: https://x.com/sama/status/1953893841381273969
- Date: 8 August 2025
- Source type: primary (executive's own post)
- Confidence: verified on the page

### 3.5 OpenAI's thinking claims on factual errors (use with care)
- Claim: OpenAI says that with web search on, GPT-5's answers are about 45% less likely to contain a factual error than GPT-4o, and when thinking, about 80% less likely than o3.
- Quote: "GPT‑5’s responses are ~45% less likely to contain a factual error than GPT‑4o, and when thinking, GPT‑5’s responses are ~80% less likely to contain a factual error than OpenAI o3."
- URL: https://openai.com/index/introducing-gpt-5/
- Date: 7 August 2025
- Source type: primary
- Confidence: verified on the page. Caution: these compare against different older models, not GPT-5 with vs without thinking, so they do not show the thinking gap on their own. Prefer 3.1 and 3.3.

---

## Section 4: Who the picking really serves (the app picks, it serves the company)

### 4.1 GPT-5's router decides for you, trained on company signals
- Claim: GPT-5 in ChatGPT was a set of models plus a router that decides which one answers, unless the user explicitly asks it to think.
- Quote: "a **real‑time router** that quickly decides which to use based on conversation type, complexity, tool needs, and your explicit intent (for example, if you say “think hard about this” in the prompt). The router is continuously trained on real signals, including when users switch models, preference rates for responses, and measured correctness"
- Also: "Once usage limits are reached, a mini version of each model handles remaining queries."
- URL: https://openai.com/index/introducing-gpt-5/ (same wording in the system card, https://cdn.openai.com/gpt-5-system-card.pdf)
- Date: 7 August 2025
- Source type: primary
- Confidence: verified on the page

### 4.2 Taking the picker away caused a backlash, and OpenAI put it back within days
- Claim: GPT-5 replaced GPT-4o and the other models on 7 August 2025. On 8 August Altman said Plus users could keep 4o; by 12 August 4o was back in the picker for all paid users, plus "Auto", "Fast" and "Thinking" choices.
- Quotes: "We will let Plus users choose to continue to use 4o." (Altman, 8 Aug 2025, https://x.com/sama/status/1953893841381273969). "You can now choose between “Auto”, “Fast”, and “Thinking” for GPT-5. Most users will want Auto" and "4o is back in the model picker for all paid users by default." (ChatGPT release notes, 12 Aug 2025, https://help.openai.com/en/articles/6825453-chatgpt-release-notes)
- Altman later: "suddenly deprecating old models that users depended on in their workflows was a mistake" (https://x.com/sama/status/1954703747495649670, 11 August 2025 UTC)
- Source type: primary
- Confidence: verified on the page
- Note for the argument: this is a counterpoint. For some users the name (really the personality behind it) mattered a lot. Altman's same post is about emotional "attachment" to specific models.

### 4.3 When the name choice came back, almost nobody used it
- Claim: By January 2026, only 0.1% of users still chose GPT-4o each day, and OpenAI retired it on 13 February 2026.
- Quote: "the vast majority of usage has shifted to GPT‑5.2, with only 0.1% of users still choosing GPT‑4o each day."
- URL: https://openai.com/index/retiring-gpt-4o-and-older-models/
- Date: 29 January 2026 (date from the ChatGPT release notes entry for the same announcement)
- Source type: primary
- Confidence: verified on the page

### 4.4 Thinking costs the company more, which is why the default matters to it
- Claim: Anthropic's developer docs say the model decides for itself whether to think, and thinking is billed as output tokens. More thinking means more cost for whoever pays.
- Quote: "Claude's thinking is adaptive: the model evaluates each request and determines whether to think and how much." and "Tokens Claude uses while thinking (billed as output tokens)"
- URL: https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking
- Date: current docs, read 14 October 2026 (no page date shown)
- Source type: primary (official docs)
- Confidence: verified on the page. Note: this is the developer API. It shows the model choosing, and the cost link; it does not show the consumer app's motives. Altman's 10 August 2025 thread also ties reasoning to capacity: "i expect use of reasoning to greatly increase over time, so rate limit increases are important." (https://x.com/sama/status/1954603417252532479)

### 4.5 IMPORTANT 2026 TWIST: OpenAI has now stopped auto-switching to thinking for paying users
- Claim: On 14 September 2026 OpenAI retired automatic switching from Instant to Thinking for Plus and Pro users. Today, on those plans, Instant does not step up on its own, and even typing "think harder" no longer switches the level. The user has to pick Medium, High or Extra High.
- Quotes: "We’re retiring automatic switching from **Instant** to **Thinking** (reasoning) for ChatGPT Plus and Pro users globally. You can still select an available option in the model picker to give ChatGPT more time to think or reason." (release notes, 14 Sep 2026). "On Plus and Pro plans, **Instant** doesn’t automatically switch to a higher thinking level for complex requests. Asking ChatGPT to “think harder” or “think deeply” won’t automatically switch to a different thinking level." (help page, about 9 Oct 2026)
- URLs: https://help.openai.com/en/articles/6825453-chatgpt-release-notes ; https://help.openai.com/articles/20001354
- Source type: primary
- Confidence: verified on the page
- Why it matters for the spine: "the apps are quietly taking that choice" is not true of ChatGPT's paid plans as of today. The sharper, accurate version: the industry now admits the real choice is how much the AI thinks (the picker is literally a Thinking slider), but the default is the fast, no-thinking setting, and most people never change a default (see 2.1). Free and Go users get a separate "Think" button. Business workspaces still have a "Higher intelligence" auto setting. Anthropic's API (4.4) still lets the model decide. Krish should decide how Section 4 is worded in light of this.

### 4.6 The 2026 picker history in one line (supporting)
- Claim: In 2026 OpenAI kept reshaping the picker around thinking: 17 March 2026 "Instant / Thinking / Pro" with auto-switch moved behind "Configure"; 28 April 2026 thinking effort moved into the picker; 10 June 2026 options renamed to Instant, Medium, High, Extra High.
- Quote: "We’ve simplified the model picker to make it easier to choose the right level of reasoning." (17 March 2026); "Thinking Standard is now Medium, Thinking Extended is now High, and Thinking Heavy is now Extra High." (10 June 2026)
- URL: https://help.openai.com/en/articles/6825453-chatgpt-release-notes
- Source type: primary
- Confidence: verified on the page

---

## Section 5: What to do about it

### 5.1 You have to choose thinking yourself on ChatGPT's paid plans
- Claim: On Plus and Pro, pick Medium or High for anything that matters; Instant will not step up by itself and asking it to "think harder" does not switch the level. Free and Go users can press "Think".
- Quote: "Free and Go users can use **Think** for harder questions." plus the 4.5 quote.
- URL: https://help.openai.com/articles/20001354
- Date: about 9 October 2026
- Source type: primary
- Confidence: verified on the page

### 5.2 In 2025 the phrase "think hard about this" was the official lever
- Claim: OpenAI told users they could type "think hard about this" to make sure GPT-5 reasoned. Useful history, but this no longer works on Plus/Pro (5.1).
- Quote: "Paid users can still select “GPT‑5 Thinking” from the model picker, or type something like ‘think hard about this’ in the prompt to ensure reasoning is used when generating a response."
- URL: https://openai.com/index/introducing-gpt-5/
- Date: 7 August 2025
- Source type: primary
- Confidence: verified on the page

### 5.3 Thinking pays off most on hard questions, not easy ones
- Claim: Thinking lifts hard maths, science and health scores (3.1, 3.3), while blind everyday preference barely changes between thinking and non-thinking versions (1.5 caution). Practical rule: leave quick questions fast, switch thinking on for decisions, health, money, maths and anything you will act on.
- Source: combines 1.5, 3.1, 3.3 (no new quote). Anthropic's docs agree: "A simple factual question may get a direct response with no thinking block at all; a multistep math problem or a tricky debugging task triggers deeper reasoning." (https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking)
- Confidence: verified on the page (the docs quote); the rule itself is our inference.

---

## UNVERIFIED (left out of the top list)
- GPT-5 SWE-bench "with thinking 74.9% vs without thinking 52.8%" from the launch chart. 74.9% is verified; 52.8% appears only in reports about the botched chart. Not found as text on any OpenAI page.
- Google's original "5 trillion searches" blog post: not located; figure only via Search Engine Land / TheDomains.
- Gemini app 2026 picker changes (a blog says Google removed Fast/Thinking from the picker on 17 May 2026 and made thinking a setting). Only one secondary source; not checked against Google.
- Claude.ai consumer app thinking toggle in 2026: no official Anthropic source found.
- Altman "mega chart screwup" original post: not opened; secondary only.

---

## Strongest five for the article
1. Same model, same name: Claude 3.7 Sonnet scored 23.3% on the AIME maths exam without thinking and 61.3% with it; the name upgrade from Claude 3.5 Sonnet (16.0%) added only about 7 points (Anthropic, 24 Feb 2025). [Section 3]
2. After GPT-5 started choosing for people, daily reasoning use went from under 1% to 7% of free users and 7% to 24% of Plus users: almost nobody had touched the dial (Altman on X, 10 Aug 2025). [Section 2]
3. "Yesterday, the autoswitcher broke ... and the result was GPT-5 seemed way dumber." Same name, switch off, worse answers (Altman on X, 8 Aug 2025). [Sections 3 and 4]
4. Nearly 80% of ChatGPT conversations are practical guidance, seeking information or writing; 49% of messages are simply "Asking" (NBER w34255, Sept 2025). [Section 2]
5. Today OpenAI's picker is a "Thinking slider" (Instant, Medium, High, Extra High), and on paid plans Instant no longer steps up by itself, even if you type "think harder" (OpenAI help centre, Sept to Oct 2026). [Sections 1, 4, 5; note it reshapes the Section 4 claim]

Close runners-up: HealthBench Hard 25.5% (fast GPT-5) vs 46.2% (thinking GPT-5) (system card, 13 Aug 2025); only 0.1% of users still chose GPT-4o each day by Jan 2026 (OpenAI, 29 Jan 2026); top 10 of LMArena within 42 points, about a 56/44 split (dataset, 13 Oct 2026).

## Do not use
- "Apps are quietly taking the thinking choice" stated as a blanket 2026 fact. ChatGPT Plus and Pro retired auto-switching on 14 Sep 2026; the user now picks. It is true for the 2025 GPT-5 router and for Anthropic's API, and partly true for free and Business plans.
- "Saying 'think hard about this' makes ChatGPT think" as current advice. OpenAI's help page now says it won't switch the level on Plus/Pro.
- "Altman said the figures were before vs after GPT-5" as a direct quote. He wrote "we went from <1% to 7%"; the before/after framing is inference from context.
- GPT-5 "52.8% without thinking" on SWE-bench (unverified; came from the botched launch chart).
- The "~80% fewer factual errors with thinking" line as evidence of a with/without-thinking gap. OpenAI compared against o3, not against GPT-5 without thinking.
- The LMArena data as proof thinking matters. In blind everyday preference, thinking and non-thinking versions of the same model sit within a few points.
- "Google does 14 billion searches a day" as a Google figure (it is an outside division of "more than 5 trillion a year").
- Claude 3.7's 80.0% AIME figure as "with thinking" alone; it uses parallel sampling.
