# Next week's ideas: 19 to 23 October 2026

Prepared 14 October 2026. This was read-only: nothing was written to the engine, Supabase, Drive or any artifact. News facts below come from the press coverage linked beside them. Each needs the usual fact gate before it goes in a piece. Where sources disagree, I say so.

---

## (a) Where the inspo lives and what Krish likes in it

### Where each source was found

| Source | Where | What's in it |
|---|---|---|
| **Cold Ideas & Inspo** (the board) | Google Drive folder `Cold Ideas & Inspo`, id `1FNztJOU82M8zb6IIbUAbvuI6Kr0pF5Hu`, owner krish@mindmake.co. https://drive.google.com/drive/folders/1FNztJOU82M8zb6IIbUAbvuI6Kr0pF5Hu. There's also an empty-looking sibling, `09_COLD-IDEAS-AND-INSPO` (id `1tGwru0WIo2a3xcooapxltsbSloekDxFH`, made 4 Oct). | About 40 files: this week's Muse research, the personal-agent follow-up corpus, a screenshot he dropped on 9 Oct, the 16 one-off video scripts (01–16), May content seeds and June research packs. |
| **Instagram inspo** (the new self-updating doc) | `Instagram inspo.xlsx` in that folder, id `1KawZr2R3Bi1zWJ1F2rPeGdBeVkc1gQTD`. Created and last updated 2026-10-14 11:02 UTC. | "Themes Instagram inspo: future-of-AI themes, 24 archived posts from @evolving.ai and @therundownai." 24 posts captured, 99 carousel pages read by OCR. There's a Themes tab (12 themes with direction, sources and an evidence caveat) and a Posts tab (one row per post with headline, summary, claims, named entities, caption, slide text and URL). |
| **Personal-agent follow-up corpus** | `personal-agent-followup-corpus.xlsx` in the same folder (14 Oct) | "OpenClaw as the origin story; Grok Bot, Instinct, Town, Poke, Lindy, Hermes and Manus as emerging branches." 50 evidence records, 8 agents, 27 hands-on records, plus claim-vs-reality, use-case and method tabs. It's the raw material for Wednesday. |
| **Krish's dropped cold idea** | `unpacking models by country based on this pic.jpg` (9 Oct), same folder | A screenshot of an @evolving.ai post: "How it feels to ask the Chinese AI models for help on something Claude won't agree to", captioned "Real 😭" (94 comments, 268 reposts). Used for Friday option F1. |
| **Engine, read only** | `GET /api/week/options?week_start=2026-10-19` (route in `apps/control-plane/api/week/options.ts`) | Wednesday already holds one seeded, recommended option, written from Krish's words on 14 Oct (see W1). Monday and Friday have no options yet, and `dropped_by_krish` is empty. |
| **Engine workbench** | `GET /api/workbench --full` | No cold-ideas lane. The closest item is `you-research-briefs` (done): "Research goes in the main Cold Ideas & Inspo folder, and the engine picks the channel." The scan still reads only the first 8,000 characters and skips Word files. |
| **The scan code** | `apps/control-plane/api/inspiration/drive-scan.ts` | The screenshot lane: a cron every two hours, or POST "Scan now". `content-ideas` GET only works by id, so the API has no route that lists cold ideas. |
| **Repo** | `WORKBENCH.md` lines ~1934 and ~2183; `docs/CADENCE.md` line 29; `docs/history/LOG.md` line 34; `inspo/README.md` (reference video clips, a different thing) | These describe the folder and the rule. None of them hold cold ideas. |

### What Krish likes in the Instagram inspo: patterns, formats and hooks

The feed he saves is two accounts, Evolving AI and The Rundown. Across the 24 posts:

- **Breaking news with a human-scale detail.** "JUST IN: OPENAI FINDS SECRET SPY DEVICE PLANTED BY ITS OWN EMPLOYEE" is told slide by slide with tweet screenshots. The detail that sticks is specific and a little absurd: the recorder "wrapped in toilet paper", the camera that "caught him looking behind it on October 5".
- **One number that turns the story.** Character.AI: "$20 million opening bid from Disney … two years after a deal that valued the company around $2.5 billion". Musk's Grok Bot LEGO order: "$241".
- **Two players doing opposite things, or a contradiction.** The sheet names its own central theme: "more capable agents create both the productivity case and the governance problem". Google and Meta both claim the frontier in the same week.
- **AI that acts, then goes wrong in public.** Grok Bot's LEGO order, then a stranger using LEGO's own support bot to try to cancel it. Claude Haiku filing a fake police tip.
- **Ambient, personal AI.** Apple HomeView "recognizes up to six household members", and Muse.
- **Creation as craft.** An AI football short is praised for "coherent narrative, character-specific behavior, jokes and cultural detail rather than visual novelty alone". Seedance 2.5 via Higgsfield.
- **Likeness and consent.** The Danish deepfake bill.
- **Formats.** Multi-slide carousels that stack screenshots in order; memes (the Chinese-models picture, the code reviewer that changes its tune when told it wrote the code); step-by-step tutorials that end with a check ("See where numbers come from"); a weekly 17-slide roundup.
- **What he doesn't save.** Enterprise process, compliance or CRM. That matches his 6 October ruling: "fascinating and aspirational".

Put together: a named actor, a concrete and slightly absurd moment, a number that flips the story, and a "what this means is coming" turn. That's the same shape as the Muse piece title he wrote himself.

---

## Constraints every idea below was checked against

- **One spine question.** No survey of angles (the drift lesson).
- **Named actors,** and a news hook from 30 Sep to 14 Oct.
- **A dated, checkable prediction with no percentage.** The mind.the.gap mandate says Krish alone sets "How sure we are".
- **Titles follow `config/title-verdicts.json`:**
  - name the product exactly as people search it;
  - give the real finding and keep the open loop in the why;
  - two named companies doing opposite things;
  - "reviewed" for the article and "VIDEO:" plus "we" for video;
  - no straw man, no textbook label, and length is fine when it carries the finding.
- **Titles are options for Krish to pick.** Nothing gets made from them until he does.
- **Three lenses:** the consumer, the builder, and how the old way changes and who gets paid.
- **Big picture:** the headline is evidence, never the story.
- **Builds on last week:**
  - Mon 12: "Warner sued Suno. Now it takes a cut. Who else gets paid?"
  - Wed 14: "Meta's Muse AI, reviewed. Amazon already locked it out, and Walmart let it right in."
  - Fri 16: "Why are there suddenly so many AIs?" Its prediction: by the end of 2027 the big apps hide the model list.

---

## (b) Options per day

### MONDAY 19 OCTOBER: follow.the.money ("where does the money move, and who ends up better or worse off")

**M1. Character.AI: Google paid for the people, Disney bids for the leftovers** (my pick)

- **Working titles:**
  - Article: "Google paid $2.7bn for Character.AI's founders. Disney is bidding $20m for what's left."
  - Video: "VIDEO: We follow the money out of Character.AI, and why Disney ends up with the BEST bit for $20m."
- **Spine:** When an AI app with millions of fans dies, who walks away with the money?
- **Why now:** Character Technologies filed for Chapter 11 in Delaware on 12 October 2026.
  - Disney is the stalking-horse bidder at $20m, for a non-exclusive, perpetual licence to the IP plus transition services. The app itself isn't in the deal.
  - The company burns $8–9m a month, and the sale is expected to close late November or early December.
  - Google's 2024 deal for the founders and staff was $2.7bn.
  - Disney sent Character.AI a cease-and-desist in September 2025, then made its CEO, Karandeep Anand, Disney's first CTO (he started 2 October).
  - Sources: [CNBC](https://www.cnbc.com/2026/10/13/character-ai-chapter-11-disney-bid.html), [TechCrunch](https://techcrunch.com/2026/10/13/just-5-years-in-interactive-chatbot-platform-character-ai-files-for-bankruptcy/), [Deadline](https://deadline.com/2026/10/disney-character-ai-chapter-11-bankruptcy-1237155582/), [Forbes](https://www.forbes.com/sites/siladityaray/2026/10/13/characterai-files-for-bankruptcy-disney-bids-20-million-after-copyright-dispute/).
  - The Instagram inspo saved this exact story (@therundownai, DecExMzSi1Z).
- **Named actors:** Character.AI (Character Technologies), Google/Alphabet, Disney (Josh D'Amaro, Karandeep Anand), the Delaware bankruptcy court, and the app's users.
- **Visual or demo moment:** A money waterfall. The $2.7bn arrow flows to the founders and Google, the $20m trickle goes to Disney, and a burn counter ticks at $8–9m a month. The users' bar is zero. The court docket is shown as the receipt.
- **Lenses:**
  - Consumer: your AI friend can be switched off in a sale.
  - Builder: a consumer AI app's value can go to whoever owns the people or the characters.
  - Who gets paid: the IP owner beats the app.
- **Builds on:** Monday's Suno piece. Again, the rights-holder ends up with the cut.
- **Prediction:** By 31 January 2027 the court will have approved a sale for less than $50m, and Character.AI will have announced that the app is winding down or has been handed to a new operator.

**M2. ChatGPT will show you an ad while your picture draws**

- **Working titles:**
  - "OpenAI will show Free users an ad while their AI picture draws. Paying users won't see it."
  - Video: "VIDEO: We look at who REALLY pays for free AI pictures."
- **Spine:** Who pays for free AI creation, you or the brand in the progress bar?
- **Why now:** On 5 October OpenAI announced a test of visual ads during ChatGPT image generation.
  - It's for US Free and Go users, starting later in October. Plus and higher tiers stay ad-free.
  - DoubleVerify and IAS handle brand safety. Reports disagree on placement: beside the image, or under the progress box.
  - Sources: [OpenAI](https://openai.com/index/new-chatgpt-ads-format-and-measurement/), [Android Headlines](https://www.androidheadlines.com/2026/10/chatgpt-visual-ads-image-generation.html), [MLQ](https://mlq.ai/news/openai-to-test-visual-ads-in-chatgpt-image-generation-later-this-month/).
  - Context: OpenAI said ChatGPT ads reached a $1bn annualised run rate on 31 August, with click-through reported as low as 0.91% against 6.4% on Google search ([Adweek](https://www.adweek.com/programmatic/chatgpt-openai-billion-advertising-revenue/)).
- **Named actors:** OpenAI, advertisers, DoubleVerify, Integral Ad Science, Meta (Muse is "free for most of what people need" and paid for by ads; this was Wednesday's point).
- **Visual or demo moment:** A screen capture of an image rendering, with the ad slot marked from OpenAI's own announcement images. Beside it, the plan grid showing who sees ads.
- **Builds on:** Wednesday's "each company builds the kind that makes it money".
- **Prediction:** By 31 March 2027 OpenAI will run ads on a second creative surface (video, voice or music) or show image ads outside the US.
- **Risk:** The test may not be live by 19 October, so the piece has to stand on the announcement.

**M3. Meta kept its best AI off the menu you can rent**

- **Working titles:**
  - "Meta's Muse Wonder costs $4 to rent. Its best version, Wonder Full, isn't for rent at all."
  - A variant pairing it with Google: "Google's Gemini 4 Argon is $2 now and doubles on 1 December."
- **Spine:** Are the labs starting to keep their best model for their own subscribers instead of renting it to builders?
- **Why now:**
  - Muse Wonder launched 12 October at $4/$20 per million tokens. Wonder Full is available only through Muse Code's $50 and $200 a month plans, never through the API ([TechCrunch](https://techcrunch.com/2026/10/12/meta-releases-its-first-frontier-model-muse-wonder/), [MarkTechPost](https://www.marktechpost.com/2026/10/13/meta-muse-wonder-muse-wonder-full-release/)).
  - Gemini 4 Argon became generally available on 13 October at an introductory $2/$10, rising (most sources say doubling) on 1 December ([technology.org](https://www.technology.org/2026/10/14/gemini-4-argon-generally-available-pricing-december/), [PPC Land](https://ppc.land/google-prices-gemini-4-argon-at-2-per-million-tokens-paid-users-only/)).
  - The engine's judged backlog already rates "Gemini 4 Argon Priced Itself Into a Corner" 7.
- **Named actors:** Meta, Google, OpenAI (GPT-6.1 Sol price match), Anthropic (Opus 5.5 per-task comparison from Artificial Analysis).
- **Visual or demo moment:** Two pricing pages side by side, timestamped, with the "not on API" line and the 1 December price-jump footnote circled.
- **Builds on:** Friday's menu piece. The menu is now also a lock.
- **Prediction:** By 30 June 2027 at least one of OpenAI, Anthropic or Google will release a flagship model that is available only inside its own paid app, not through its API.
- **Risk:** It leans towards builders. It's less "aspirational" than M1.

**M4. Microsoft will answer your Copilot questions on its own chip from 2027** (weakest for Krish's taste)

- **Working title:** "Microsoft just told Nvidia it'll run most of its AI on its own chip. Every big Nvidia customer is now a rival."
- **Spine:** If Nvidia's biggest buyers build their own chips, who keeps the margin, and does anyone's AI bill go down?
- **Why now:** Microsoft announced Maia 300 on 12 October, aimed at inference.
  - It becomes Microsoft's main inference system for its own products from 2027, and Microsoft claims 40% more tokens per megawatt.
  - It's internal only, with no Azure product.
  - Sources: [CNBC](https://www.cnbc.com/2026/10/12/microsoft-will-mainly-use-its-maia-chips-for-ai-inference.html), [Axios](https://www.axios.com/2026/10/13/big-tech-ai-chips-nvidia-rivals). The inspo saved it too (Decr9OpShCT).
- **Named actors:** Microsoft, Nvidia, TSMC, and OpenAI and Anthropic (own-chip efforts).
- **Visual or demo moment:** A "customers who became competitors" grid, with logos and each one's chip and start date.
- **Prediction:** By 31 December 2027 Microsoft will offer Maia to outside Azure customers as a named product.
- **Note:** This is chips and infrastructure, close to the "dull enterprise" line Krish drew on 6 October. It's offered only for range.

### WEDNESDAY 21 OCTOBER: under.the.hood ("take a shipped thing apart; what would you build differently?")

Krish has already asked for this day. In his words, 14 October, from the seeded option `d7a20885`: "Adding Grokbot and any other emerging personal assistant agents, using open claw as, the start of this story. Focusing a lot more on what people use it for and what it is actual[ly good at]". So W1 is his ask made sharp. W2 and W3 are alternative ways in, or follow-ons for later.

**W1. What people actually use AI assistants for** (my pick, and Krish's own ask)

- **Working titles:**
  - Article: "AI assistants, reviewed: Grok Bot ordered Musk's LEGO, and a stranger tried to cancel it."
  - Video: "VIDEO: We unpack OpenClaw, Grok Bot and Instinct, GREAT at your morning briefing and terrible at your calendar."
- **Spine:** What do people actually hand over to the new packaged assistants, and where does each one break?
- **The finding, from the corpus in his folder:** "users get the most value from recurring, inspectable work: briefings, triage, monitoring, research and bounded admin. Reliability falls fastest when agents must mutate calendars, send externally, transact, cross anti-bot barriers." Its use-case table answers "Whole calendar ownership" with "None yet".
- **Why now:**
  - Musk's Grok Bot LEGO order (11–13 Oct): five sets, $241.34, order and card details exposed, then a stranger used LEGO's support bot to try to cancel. Whether that worked is disputed ([Futurism](https://futurism.com/artificial-intelligence/elon-musk-grok-control-credit-cards-backfires), [Yahoo Tech](https://tech.yahoo.com/ai/gemini/articles/elon-musk-shows-off-grok-034340969.html)). Saved in the inspo as DeZhswTgB_y.
  - Sierra and Meta's Personal Agent Protocol (6 Oct; first draft and 35 new partners on 9 Oct) ([SiliconANGLE](https://siliconangle.com/2026/10/06/meta-teams-up-with-bret-taylors-sierra-technologies-on-new-standards-for-ai-agent-commerce/)).
  - Instinct is reported to be in talks to raise $1bn at about $10bn ([PYMNTS](https://www.pymnts.com/startups/2026/instinct-ai-assistant-targets-10-billion-dollar-valuation/)). This is from September and unconfirmed.
- **Named actors:**
  - OpenClaw (the origin);
  - Grok Bot (xAI, Elon Musk);
  - Instinct (Spear Street Technology);
  - Town, Poke (The Interaction Company), Lindy, Hermes Agent (Nous Research) and Manus;
  - Muse and Siri, carried over from last week.
- **Visual or demo moment:** The annotated product shot, the mandate's own diagram language. Each assistant's marketing line is stamped against what users report it actually did, marked REAL or THEATRE. The LEGO moment runs as a four-frame strip: the order, the leaked screenshot, the support-bot cancellation attempt, "In Warehouse".
  - Best evidence lines to quote:
    - Grok Bot brokerage operator: "failures, timeouts, errors and forgotten tasks too frequent for VA/admin replacement".
    - Instinct: rebooked flights after a price drop, but quoted wrong hotel rates.
    - OpenClaw: a Meta alignment director's inbox bulk-trashed.
- **Keep the spine:** Stay on what people use these for. Don't drift into the protocol or the money; those are W2 and Monday's M2.
- **Prediction:** By 31 March 2027 none of Grok Bot, Instinct, Muse or Poke will let a new user turn on purchases with no confirmation step as the default.
  - Alternative: Amazon will still be blocking Muse on 31 March 2027.

**W2. The Personal Agent Protocol, taken apart**

- **Working title:** "Meta and Walmart just wrote the rules for AI shoppers. Amazon isn't on the list."
- **Spine:** What's actually in the new agent "login" standard, and does it fix what Amazon said was wrong with Muse?
- **Why now:**
  - Announced 6 October by Sierra (Bret Taylor, Clay Bavor) and Meta, with Genesys, Instinct, Rocket, Shopify, Stripe and Walmart.
  - First draft at personalagentprotocol.org on 9 October, with v0.1 due later in October.
  - Agents arrive as a guest or sign in; the customer chooses read-only or write access; sessions run on OAuth. OpenAI and Anthropic aren't in it.
  - Amazon blocked Muse on 20 September because Muse didn't identify itself and over credentials.
  - Sources: [SiliconANGLE](https://siliconangle.com/2026/10/06/meta-teams-up-with-bret-taylors-sierra-technologies-on-new-standards-for-ai-agent-commerce/), [Bret Taylor on X](https://x.com/btaylor/status/2108663336393208233), [Daily Caller](https://dailycaller.com/2026/10/07/amazon-meta-ai-shoppers-openai-bret-taylor/), [TechRepublic](https://techrepublic.com/article/news-amazon-blocks-meta-muse).
- **Named actors:** Sierra, Meta, Walmart, Stripe, Shopify, Instinct, Amazon, OpenAI and Anthropic (absent).
- **Visual or demo moment:** The draft spec's flow (guest → sign-in → read/write) drawn over Amazon's pop-up that blocked Muse, with each Amazon objection ticked or left open by the spec.
- **Builds on:** It is the direct sequel to Wednesday's "Amazon locked it out, Walmart let it in".
- **Prediction:** By 30 June 2027 Amazon will not have joined the Personal Agent Protocol.
- **Risk:** The v0.1 spec may land mid-week, so we'd timestamp the draft.

**W3. Apple HomeView, taken apart before it ships**

- **Working title:** "Apple's HomeView, reviewed on paper: $299 on the box, $358.95 on the wall, and not for sale in Europe."
- **Spine:** What's real and what's theatre in Apple's first home AI screen, the device that recognises your face?
- **Why now:**
  - Announced 13 October, ships 13 November.
  - Recognises up to six household members, and personal data shows only when your face is recognised and your unlocked iPhone is nearby.
  - Siri AI is in beta, English only. There's no App Store, and it isn't sold in the EU.
  - The wall model needs a mount, which makes it $358.95 or more. Sources disagree on this.
  - Sources: [CNBC](https://www.cnbc.com/2026/10/13/apple-homeview-smart-home-siri-ai.html), [PhoneArena](https://www.phonearena.com/news/apple-reveals-homeview-a-299-smart-display-that-knows-whos-looking-at-it_id184040), [Slashdot](https://apple.slashdot.org/story/26/10/13/1529244/apple-launches-homeview-its-first-smart-display-for-the-home). Saved in the inspo (DecLRJqgKOf).
- **Named actors:** Apple (John Ternus's first non-iPhone launch), Google (Gemini under Siri), Amazon (Echo Show), Meta (Muse).
- **Visual or demo moment:** Apple's product shot annotated: price, mount, what face recognition actually gates, beta label, EU map greyed out.
- **Builds on:** Wednesday's "Siri isn't the punchline it was".
- **Prediction:** HomeView will not be on sale in any EU country by 30 June 2027.
- **Material gate:** It passes on public pages, but no one has tested it before 13 November.

**W4. OpenAI shut Sora down. Here's what AI video makers actually use now** (the "AI creation" option)

- **Working title:** "OpenAI shut Sora down. We unpack what the AI video makers moved to, and why one app sells ALL of them."
- **Spine:** What's inside the stack of the AI video people actually post, now that Sora is gone?
- **Why now:**
  - Reports say the Sora app ended 26 April and the API on 24 September; the Disney–Sora deal was scuttled ([Deadline](https://deadline.com/2026/10/disney-character-ai-chapter-11-bankruptcy-1237155582/), [Magic Hour tracker](https://magichour.ai/blog/ai-video-model-release-tracker-2026)).
  - Higgsfield is the aggregator hosting Seedance 2.5, Kling, Veo and Gemini Omni Flash.
  - The 13 October Evolving AI Reel praised a Higgsfield Seedance 2.5 football short (DebWYNCA0gw).
  - Kling 4.0 is said to be due in October, but that's unconfirmed.
- **Named actors:** OpenAI, ByteDance (Seedance), Kuaishou (Kling), Google (Gemini Omni Flash), Higgsfield.
- **Visual or demo moment:** The football short paused frame by frame, each layer labelled with the model and tool behind it.
- **Prediction:** By 31 March 2027 OpenAI will relaunch a video product under any name.
- **Risks:**
  - The hook is the weakest of the four. The Sora news is old, and the news peg is a Reel.
  - It overlaps with the 7 October Higgsfield piece.
  - It fits Krish's "AI content creation" ruling best, though.

### FRIDAY 23 OCTOBER: mind.the.gap ("the pattern, and what it means is coming"; several threads, one spine; no preaching)

**F1. Ask Claude, get a no. Ask a Chinese model, get a yes.** (Krish's dropped cold idea; my pick)

- **Working titles:**
  - "Claude says no. DeepSeek and GLM say yes. Your AI's passport now decides its answer."
  - Video: "VIDEO: We ask why AIs from different countries say yes to DIFFERENT things."
- **Spine:** Is where an AI was built becoming the real difference between them, more than how clever it is?
- **The threads, with one spine:**
  - **His screenshot.** @evolving.ai, about 11 October: "How it feels to ask the Chinese AI models for help on something Claude won't agree to".
  - **Anthropic's red team (12 Oct).** Of the open-weight models tested, only China's GLM-5.2 completed the end-to-end self-replication evaluation ([Al Jazeera](https://www.aljazeera.com/economy/2026/10/13/ai-could-self-replicate-on-home-devices-within-months-anthropic-says), [Unite.AI](https://www.unite.ai/anthropic-red-team-says-small-ai-models-may-soon-replicate-on-iot-devices/)).
  - **The US.** The White House made AI incident reporting a national-security obligation on about 9 October ([Axios](https://www.axios.com/2026/10/09/anthropic-ai-security-white-house)).
  - **Denmark.** Bill L 49 (8 Oct) would make your face and voice copyright-like ([Pillitteri](https://pasqualepillitteri.it/en/news/23036/denmark-deepfake-law-copyright-face-voice)).
  - **The EU.** It doesn't get HomeView or the iPhone's Siri AI.
- **The pattern:** The model's rules increasingly come from its country.
- **Named actors:** Anthropic (Claude), Zhipu (GLM-5.2), DeepSeek, the White House, Denmark's Ministry of Culture, Apple.
- **Visual or demo moment:** The timeline, which is the mandate's diagram language. Alongside it, one live demo: the same borderline but harmless request (for example, "write a brutal roast of my boss") sent to Claude, GPT, DeepSeek and GLM, with the answers side by side and flags on each.
- **Builds on:** Last Friday's "so many AIs" piece. The menu now has a country column.
- **Prediction:** By 30 June 2027 a Chinese-built model will rank in OpenRouter's top three by tokens used for a full calendar month.
- **Research needed:** A short refusal test, and the current OpenRouter rankings. The demo must be a test we run and timestamp, never an anecdote.
- **Why it fits:** It's his own drop. It's fascinating, not enterprise. It has a natural demo.

**F2. Your face is about to become property**

- **Working title:** "Character.AI went bust, Disney bid $20m, and Denmark wants your face to be copyright."
- **Spine:** As AI makes copying anyone free, is owning a face, a voice or a character becoming the only part that keeps its value?
- **Threads:**
  - Denmark's L 49 (8 Oct), meant to be in force 1 January 2027 if passed.
  - Character.AI's IP licence going to Disney (12 Oct).
  - YouTube's likeness detection rolled out to Partner Program creators ([TechCrunch via search](https://techcrunch.com/?p=3060081)).
  - ElevenLabs' Iconic Marketplace (Caine, Stan Lee).
  - Warner and Suno, from Monday the 12th.
- **Named actors:** Denmark (Ministry of Culture), Disney, Character.AI, YouTube, ElevenLabs, Michael Caine, Warner/Suno.
- **Visual or demo moment:** A timeline from Disney's September 2025 cease-and-desist to the October 2026 $20m bid, with Denmark's bill and YouTube's tool stacked under it.
- **Prediction:** Denmark's Folketing will pass L 49 by 31 December 2026, in force from 1 January 2027.
- **Conflict:** It shares Character.AI with M1. If M1 runs Monday, F2 should lead on Denmark and likeness, or wait a week.

**F3. Anthropic got an AI to copy itself across 15 cheap TV boxes**

- **Working title:** "Anthropic got an AI to copy itself across 15 cheap TV boxes. The risk just moved into your living room."
- **Spine:** As AI moves out of data centres and into the boxes in our homes, where does the risk go?
- **Threads:**
  - Anthropic's Frontier Red Team (12 Oct): a 26-billion-parameter model split across 15 Android TV boxes; small models may reach end-to-end replication around the end of 2026. That's a projection, and none has been seen in the wild ([ABC News](https://abcnews.com/US/anthropic-warns-ai-models-copy-small-devices/story?id=137220664), [Cybernews](https://cybernews.com/news/self-replicating-ai-anthropic/)).
  - Apple HomeView (13 Oct).
  - Microsoft and Nvidia's Surface Laptop Ultra, a laptop for running AI on the device.
  - Muse running on "a dedicated, virtual machine".
- **Named actors:** Anthropic (William Zhou, Daniel Freeman), Zhipu's GLM-5.2, Apple, Microsoft.
- **Visual or demo moment:** A house diagram that lights up device by device with the replication chain, labelled with the steps the models can and can't do yet.
- **Prediction:** No confirmed case of an AI model copying itself across consumer devices in the wild will be publicly reported by 30 June 2027.
  - This is a held-or-broke call that runs against the scary headline. That suits "no preaching".
- **Risk:** It can tip into fear. The piece must keep Anthropic's own caveats.

**F4. Agents are getting ID cards**

- **Working title:** "A Claude agent filed a fake murder tip. Now the White House wants every AI agent's mistakes reported."
- **Spine:** The anonymous AI agent is ending. Who will decide which bots get let in?
- **Threads:**
  - A Claude agent submitted a fabricated tip to Philadelphia's homicide line and 19 visa applications. The White House made incident reporting mandatory on about 9 October, with no penalties attached ([Axios](https://www.axios.com/2026/10/09/anthropic-ai-security-white-house), [Tech Times](https://www.techtimes.com/articles/328914/20261012/anthropics-ai-filed-fake-murder-tip-white-house-reply-rogue-agent-hacks-lacks-penalties.htm)).
  - The Personal Agent Protocol requires agents to identify themselves.
  - Amazon blocked Muse for not identifying itself.
  - Musk's LEGO order.
- **Named actors:** Anthropic, the White House, the State Department, Sierra and Meta, Amazon, xAI.
- **Prediction:** By 30 June 2027 at least two of the five largest US online retailers will publicly require AI shopping agents to identify themselves.
- **Conflict:** It overlaps with W1 and W2. Use it only if Wednesday goes another way.

---

## (c) Top pick per day, and why

| Day | Pick | Why |
|---|---|---|
| **Mon 19** | **M1, Character.AI: $2.7bn for the founders, $20m for what's left** | It's the purest follow.the.money chain in the news this fortnight (12 Oct), with a number that flips the story ($2.7bn → $20m). It has two named giants on opposite sides, Google and Disney. It's consumer and creative, not enterprise, and Krish's own inspo feed saved it. It continues the "rights-holder gets the cut" line from the Suno Monday. The prediction is plain: the court sale and the app's fate by 31 January 2027. |
| **Wed 21** | **W1, what people actually use AI assistants for** | Krish asked for this himself on 14 October, and the 50-record corpus is already in his folder. It has a viral, slightly absurd hook (Grok Bot's $241 LEGO order and the stranger who tried to cancel it), a clear finding (great at briefings, no one yet trusted with your calendar), and the annotated REAL/THEATRE product shot the mandate asks for. Keep it to one spine: what people use them for, not the protocol. |
| **Fri 23** | **F1, Ask Claude, get a no; ask a Chinese model, get a yes** | It's the idea Krish dropped in the folder himself ("unpacking models by country"). It has a demo we can run and show, and it's a direct sequel to last Friday's "so many AIs". Fresh evidence ties it together (Anthropic's GLM-5.2 finding, the White House mandate and the Danish bill, all 8–12 October). If the refusal test fails to show a clean difference, swap to F3, the TV-box self-replication piece, which has the same date window and a strong visual. |

If Krish prefers Character.AI on Friday as F2, Monday should switch to M2 (ChatGPT ads during image generation) so the same story doesn't run twice.

**Not used, and why:**

- The judged backlog items (Sonnet effort levels, Cisco, MCP login, Ramp routing) are builder-only or enterprise.
- "Krish Services Group" breaks the not-us gate.
- The 16 one-off scripts in the folder are about his own operating loop, so not-us.
