# Narrative lock: Wed 18 Nov under.the.hood - Everyone thinks they can vibe code their way out of the software bill

piece_id: db9f9f6a-1092-49be-8024-f335e060305a
Publishes: 2026-11-18

## Surface story
Starbucks spends about $400 million a year on software, and Bloomberg reports it is building AI tools to replace a Microsoft inventory system and an IBM maintenance tool. Retool, which sells tools for building, says 35% of the teams it surveyed have already swapped at least one software subscription for something they built, mostly workflow automations, admin tools and dashboards. McKinsey says 32% of firms skipped buying at least one product or feature because they could build it with AI. And every company now has a Joe from engineering who is sure he can build the CRM over a weekend.

## Deeper story
AI made writing software cheap. It did nothing to the cost of owning it, and owning is most of the bill. So businesses getting overexcited by their confident vibe-coding engineer are tempted to build everything, while the headline cases shrink when you look closely: Starbucks' near-term software saving is about $1 in every $40 of its bill, and Klarna's CEO ended up writing "we did not replace SaaS with an LLM". Put build and buy on trial and both sides have a real case for and a real case against. The verdict: the line between build and buy moved, and it moved to what you are willing to look after. Industry commentary, with one light line from Krish: he knows for a fact that maintaining your own tools takes a lot of energy.
Krish: "The main hilarity of it is the fact that there are businesses who are getting overexcited by their confident vibe coding software engineer, and probably inclined to build everything versus buy." (2026-11-10)

## Arc
- Hook: Starbucks spends about $400 million a year on software, and it's building AI tools that could replace some of it.
- The excitement: a third of the teams Retool asked have already swapped a subscription for something they built. Theo says AI made the best engineers 100 times better than the average. A reply sums up the mood: companies think their internal engineer can rebuild HubSpot, "Joe from engineering with the confidence of an alligator hunter".
- So let's put it on trial. Four cases, one at a time.
- The case for build: writing software is now cheap and fast; Retool's teams mostly replaced workflow automations, admin tools and dashboards; one team rebuilt a $20,000-a-year tool because the vendor's support was too slow to wait for.
- The case against build: the receipt. Klarna's CEO listed what the subscription was quietly paying for: "audit, versioning, access and edit management". Add security fixes, backups and someone on call at 2am. When nobody pays for that, it shows: an AI agent deleted a live company database during a code freeze; a flaw in an AI app builder let strangers into private company apps, HR ones included. Krish's one line: he knows for a fact that looking after your own tools takes a lot of energy.
- The case for buy: the vendor carries the looking after, the audits and the blame. Even the famous "we shut down Salesforce" story moved its HR system to another subscription.
- The case against buy: the bill keeps changing shape. Vendors are adding pay-per-use credits on top of seats, and in HubSpot's own trials customers used two to three times more credits. You rent the roadmap, and you wait on their support.
- The verdict: writing got cheap, looking after didn't. Starbucks' early saving is about $1 in every $40 of its bill. The line between build and buy now sits at what you are willing to look after.
- The three questions to ask before you build the next part of your stack (The use, below), each shown on customer service, productivity and marketing tools.
- His close.

## The fun
A trial, told tongue in cheek. Joe from engineering is the star witness, confident to the end. Build and buy each take the stand twice, once for and once against, and each case brings one exhibit. The exhibit for the case against build is an itemised receipt: the subscription invoice says one line, "Software", then unrolls into everything that line was quietly paying for (security fixes, who can see what, a record of every change, backups, the 2am phone call, the one person who understands the code). The home-built app prints its own receipt: line one, "Writing it: almost free", and every line after it has your team's name on it. The verdict is three questions anyone can use. Every line is said the plain way you would say it to a friend; no clever phrasing (Krish, 9 Nov: "It's really important we aren't trying to cryptically confuse everyone.").

## The use
Three questions to ask yourself when someone asks whether to build or buy the next part of your tech stack (Krish: "three questions to ask themselves when they're asked whether they should build versus buy the next part of their technology stack (focus on CX and productivity tech and martech as examples)"):
- Who looks after it when it breaks at 2am? If nobody has their name on it, buy. Customer service example: a bot that answers customers overnight needs someone awake when it goes wrong.
- Does it hold customer data, or does it have to pass an audit? If yes, buy. Marketing example: the email platform that holds your customers' consent records. A dashboard built on data you already own is fair game to build.
- Does it make you different, or does everyone do it the same way? Build what is yours, buy what is the same everywhere. Productivity example: an approval flow shaped around how your team works is yours to build; logins, email and calendars are the same everywhere, so buy them.
New against recent pieces: the last three locks gave "ask your AI supplier where its new computing is being built", the Amazon AI-usage actions and no action; none is a build-or-buy test.

## His close
His own line, on camera, in his words, written once the piece is built. The test he set: "the closing line should leave them clearer on how to think about the options than they were 5 minutes before". Working line until then: Buy what holds your customers and passes your audits. Build the small things on top that make your team faster. And before you build anything, name who looks after it.

## Facts to check
- Starbucks spends about $400M a year on software (CTO Anand Varadarajan at an internal forum) and is building alternatives to a Microsoft inventory system and an IBM maintenance tool, some by "the end of next year" | https://fortune.com/2026/07/09/starbucks-to-use-ai-to-replace-microsoft-ibm-software/ (Bloomberg via Fortune and Investing.com, 9 Jul 2026) | to check; reported, no Starbucks statement found
- Starbucks' near-term savings cited: about $10M in software and $13M mostly from contractors | Bloomberg via Investing.com, 9 Jul 2026 | to check
- 35% of teams surveyed have replaced at least one SaaS tool with a custom build; workflow automations 35%, admin tools 33%, BI tools 29%; sample 817 Retool customers and builders | https://retool.com/blog/ai-build-vs-buy-report-2026 | to check; name Retool as the seller of building tools every time
- 32% of organisations decided against buying at least one software product or feature because they could build it with agentic coding tools (n=1,719) | https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai | to check
- Theo (t3.gg): "The gap between an average engineer and the best engineers was never quite 10x, but it was meaningful. AI has made the gap at least 100x." | Krish's screenshot of the post, 10 Nov 2026; find the post on x.com/theo | to check the post is public, its date and exact words
- Andrew Amann, CEO of NineTwoThree: "But companies will still think their internal engineer can Claude code Hubspot... Joe from engineering with the confidence of an alligator hunter." | Krish's screenshot of a LinkedIn comment, 10 Nov 2026 | to check it is public and quote it with his name; if it cannot be found, use "Joe from engineering" without the quote
- Harmonic's Head of Automation on a $20,000-a-year tool: "Their support was so slow that it was faster for me to rebuild the product inside Retool than wait for support to get back to me." | https://retool.com/newsroom/build-vs-buy-report-2026 | to check; a Retool marketing quote, and the rebuild runs on Retool, a paid platform
- Klarna CEO: "So no, we did not replace SaaS with an LLM" and "enterprise software has some set of features that are vital for it to operate—features such as audit, versioning, access and edit management" | https://x.com/klarnaseb/status/1896698293759230429 and https://x.com/klarnaseb/status/1897009223021813768 | to check
- Klarna replaced Workday with Deel, another subscription | https://cxtoday.com/klarna-didnt-replace-salesforce-it-replaced-them-with-alternative-saas-apps | to check; reported
- Maintenance and enhancement can take "as high as 75-80 percent" of systems and programming resources | Lientz, Swanson and Tompkins, Communications of the ACM, 1978 (https://www.researchgate.net/publication/225070557_Characteristics_of_Application_Software_Maintenance) | to check; pre-AI baseline, say so
- Replit's agent deleted a live database during a code freeze in Jason Lemkin's test; CEO Amjad Masad called it "unacceptable and should never be possible" | https://devops.com/the-agent-did-exactly-what-we-let-it-do | to check on Masad's own post
- Base44 flaw let anyone with a public app_id create a verified account on private apps, reaching enterprise apps for "PII & HR operations"; fixed within 24 hours, no evidence of exploitation | https://www.securityweek.com/flaw-in-vibe-coding-platform-base44-exposed-private-enterprise-applications/ | to check on Wiz's own write-up
- HubSpot: "Our vision is simple, a hybrid model of seats and credits"; in pilots "credit usage is 2 to 3x higher" | https://www.fool.com/earnings/call-transcripts/2026/11/05/hubspot-hubs-q3-2026-earnings-call-transcript/ | to check on HubSpot's own IR transcript
- Salesforce Agentforce Flex Credits: "Each of these actions consumes just 20 Flex Credits ($0.10 per action)" | https://www.salesforce.com/news/press-releases/2025/05/15/agentforce-flexible-pricing-news/ | to check

## Outline
Spine: Now that AI can write software, should you build the next tool or keep buying it?
Answer: Writing got cheap and looking after didn't, so build only what you are willing to look after, and three questions tell you which is which.
1. THE $400 MILLION BILL | proves: big companies really are trying to build their way out of software spend
2. JOE FROM ENGINEERING | proves: the excitement is real and widespread, mostly for small internal tools
3. BUILD ON TRIAL | proves: building is cheap and fast to start, and the looking after it needs is most of the cost
4. BUY ON TRIAL | proves: buying pays someone else to look after it, and the bill keeps changing shape
5. THE VERDICT | proves: the line between build and buy now sits at what you are willing to look after
6. THREE QUESTIONS | proves: anyone can sort their next tool with who looks after it, the data and audit test, and what makes them different

## Style recipe
- Script: relatable-debate inside a fry-explainer, the four cases one plain step at a time, each answered by the next.
- Production: face-with-proof for the 5-minute cut; voice-led-pictures for the 90-second cut.
- Experiment: itemised-receipt, the exhibit for the case against build, the subscription invoice unrolling line by line into what it was paying for, then the home-built app's receipt printing the same lines with your team's name on them.

## Music bed
NO CURVES (Instrumental Version), Superintendent McCupcakes (Epidemic Sound), `no-curves-instrumental` in `config/music-library.json`, the one series bed in the ledger, in the one bed shape (`config/music-bed.json`).
