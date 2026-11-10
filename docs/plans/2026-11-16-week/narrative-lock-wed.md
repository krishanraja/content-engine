# Narrative lock: Wed 18 Nov under.the.hood - Everyone thinks they can vibe code their way out of the software bill

piece_id: db9f9f6a-1092-49be-8024-f335e060305a
Publishes: 2026-11-18

## Surface story
Starbucks spends about $400 million a year on software, and Bloomberg reports it is building AI tools to replace a Microsoft inventory system and an IBM maintenance tool. Retool, which sells tools for building, says 35% of the teams it surveyed have already swapped at least one software subscription for something they built, mostly workflow automations, admin tools and dashboards. McKinsey says 32% of firms skipped buying at least one product or feature because they could build it with AI.

## Deeper story
AI made writing software cheap. It did nothing to the cost of owning it, and owning is most of the bill: the old studies put the work after launch at well over half of what software costs over its life. So the headline cases shrink when you look closely. Starbucks' near-term software saving is about $10 million, roughly $1 in every $40 of its bill. Klarna, the famous "we shut down Salesforce" story, ended with its CEO writing "we did not replace SaaS with an LLM", and its HR system went to another subscription. What a subscription was quietly paying for is the looking after: security fixes, access control, audit trails, backups, and someone who answers at 2am. Build or buy is no longer a question about who can write the thing. It is a question about who will look after it.

## Arc
- Hook: Starbucks spends about $400 million a year on software, and it's building AI tools that could replace some of it.
- Lots of companies are doing the same: about a third of the teams Retool asked have swapped at least one subscription for something they built. Mostly small internal things: workflow automations, admin tools, dashboards.
- Look closer and the big cases shrink. Starbucks expects to save about $10 million soon, about $1 in every $40. Klarna's CEO: "we did not replace SaaS with an LLM."
- The teardown: what a home-built app is really made of, and what the subscription was quietly paying for. Klarna's CEO named it himself: "audit, versioning, access and edit management." Add security fixes, backups and someone on call at 2am.
- When nobody pays for that, it shows: an AI agent deleted a live company database during a code freeze; a flaw in an AI app builder let strangers into private company apps, HR ones included.
- The click: writing the app got cheap. Looking after it did not, and looking after it was always most of the cost.
- Where we land: the line between build and buy moved to what you are willing to look after. Build the small internal tools you will happily own; keep buying anything that pays people, holds customer data or has to pass an audit.
- The action (The use, below).

## The fun
The teardown, told tongue in cheek, as an itemised receipt. The subscription invoice says one line, "Software". Then it unrolls, line by line, into everything that one line was quietly paying for: security fixes, who can see what, a record of every change, backups, the 2am phone call, the one person who understands the code. The home-built app gets its own receipt: line one, "Writing it: almost free". Then the same lines print again, this time with your team's name on each. Every line is said the plain way you would say it to a friend; no clever phrasing (Krish, 9 Nov: "It's really important we aren't trying to cryptically confuse everyone.").

## The use
Before anyone builds a replacement for something you pay for, write down the name of the person who will look after it, including at 2am. No name, keep buying. Even if you never build it, a working version is a strong card to play when the subscription comes up for renewal.

## His close
To be set in his words. Working line: writing software got cheap; looking after it didn't, so build what you're happy to look after and buy the rest.

## Facts to check
- Starbucks spends about $400M a year on software (CTO Anand Varadarajan at an internal forum) and is building alternatives to a Microsoft inventory system and an IBM maintenance tool, some by "the end of next year" | https://fortune.com/2026/07/09/starbucks-to-use-ai-to-replace-microsoft-ibm-software/ (Bloomberg via Fortune and Investing.com, 9 Jul 2026) | to check; reported, no Starbucks statement found
- Starbucks' near-term savings cited: about $10M in software and $13M mostly from contractors | Bloomberg via Investing.com, 9 Jul 2026 | to check
- Starbucks pulled an AI system for store inventory and went back to manual counting | https://fortune.com/2026/07/09/starbucks-to-use-ai-to-replace-microsoft-ibm-software/ | to check; a different system from the Microsoft replacement, say so if used
- 35% of teams surveyed have replaced at least one SaaS tool with a custom build; workflow automations 35%, admin tools 33%, BI tools 29%; 60% built outside IT oversight; sample 817 Retool customers and builders | https://retool.com/blog/ai-build-vs-buy-report-2026 | to check; name Retool as the seller of building tools every time
- 32% of organisations decided against buying at least one software product or feature because they could build it with agentic coding tools (n=1,719) | https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai | to check
- Klarna CEO: "So no, we did not replace SaaS with an LLM" and "enterprise software has some set of features that are vital for it to operate—features such as audit, versioning, access and edit management" | https://x.com/klarnaseb/status/1896698293759230429 and https://x.com/klarnaseb/status/1897009223021813768 | to check
- Klarna replaced Workday with Deel, another subscription | https://cxtoday.com/klarna-didnt-replace-salesforce-it-replaced-them-with-alternative-saas-apps | to check; reported
- Maintenance and enhancement can take "as high as 75-80 percent" of systems and programming resources | Lientz, Swanson and Tompkins, Communications of the ACM, 1978 (https://www.researchgate.net/publication/225070557_Characteristics_of_Application_Software_Maintenance) | to check; pre-AI baseline, say so
- Replit's agent deleted a live database during a code freeze in Jason Lemkin's test; CEO Amjad Masad called it "unacceptable and should never be possible" | https://devops.com/the-agent-did-exactly-what-we-let-it-do | to check on Masad's own post
- Base44 flaw let anyone with a public app_id create a verified account on private apps, reaching enterprise apps for "PII & HR operations"; fixed within 24 hours, no evidence of exploitation | https://www.securityweek.com/flaw-in-vibe-coding-platform-base44-exposed-private-enterprise-applications/ | to check on Wiz's own write-up
- AI-written code introduced security flaws in 45% of Veracode's tests | https://www.veracode.com/resources/analyst-reports/2025-genai-code-security-report/ | to check; Veracode sells security testing, say so
- HubSpot net revenue retention fell to 101%, with the CFO citing customers' "cost optimizations… as they come up for renewal" | https://www.fool.com/earnings/call-transcripts/2026/11/05/hubspot-hubs-q3-2026-earnings-call-transcript/ | to check on HubSpot's own IR transcript

## Outline
Spine: If AI can write the software, why keep paying for it?
Answer: Because writing it was always the cheap part; the subscription pays for looking after it, so build only what you are willing to look after.
1. THE $400 MILLION BILL | proves: big companies really are trying to build their way out of software spend
2. A THIRD ALREADY SWAPPED | proves: it is happening widely, but mostly with small internal tools
3. THE BIG CASES SHRINK | proves: the headline savings are small or walked back (Starbucks about $1 in $40, Klarna's CEO)
4. THE RECEIPT | proves: the subscription was quietly paying for the looking after, and home-built apps break when nobody does it
5. WHO ANSWERS AT 2AM | proves: the line between build and buy now sits at what you are willing to look after, and the one question to ask on Monday

## Style recipe
- Script: fry-explainer, one plain step at a time, each causing the next.
- Production: face-with-proof for the 5-minute cut; voice-led-pictures for the 90-second cut.
- Experiment: itemised-receipt, the subscription invoice unrolling line by line into what it was paying for, then the home-built app's receipt printing the same lines with your team's name on them.

## Music bed
NO CURVES (Instrumental Version), Superintendent McCupcakes (Epidemic Sound), `no-curves-instrumental` in `config/music-library.json`, the one series bed in the ledger, in the one bed shape (`config/music-bed.json`).
