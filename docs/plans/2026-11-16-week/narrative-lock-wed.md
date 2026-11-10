# Narrative lock: Wed 18 Nov under.the.hood - Everyone thinks they can vibe code their way out of the software bill

piece_id: db9f9f6a-1092-49be-8024-f335e060305a
Publishes: 2026-11-18

## Surface story
Starbucks spends about $400 million a year on software, and Bloomberg reports it is building AI tools to replace a Microsoft inventory system and an IBM maintenance tool. Retool, which sells tools for building, says 35% of the teams it surveyed have already swapped at least one software subscription for something they built. And every company now has a Joe from engineering who is sure he can build the CRM over a weekend.

## Deeper story
Building with AI is working, more often than the sceptics think, mostly for small tools that someone owns. In 518 community posts Krish gathered, people told 62 first-hand stories of internal builds that work, against 3 that failed, and not one said keeping their tools alive pulled them off their main work. The costs that do catch people out are about people, not code: moving staff over to the new tool, hiring people who already know the old one, and the tool nobody owns. The companies doing it well made looking after the tools somebody's job before they let everyone build: Klaviyo's staff shipped 356 internal apps in two weeks on a company platform that puts every app behind the company login. So inside developer teams the job is moving from writing the tools to running the place everyone builds them, managers are the ones setting the bar, and the leaders signing off need to ask three questions about people before they cancel anything. Joe from engineering is still the joke: he is the one with no owner and no platform. Industry commentary, with one light line from Krish: he knows for a fact that maintaining your own tools takes a lot of energy.
Krish: "The main hilarity of it is the fact that there are businesses who are getting overexcited by their confident vibe coding software engineer, and probably inclined to build everything versus buy." (2026-11-10)
Krish, on the community evidence: "yes to both, rewrite the lock" (2026-11-10), agreeing to flip the story to what the evidence shows and to fill the Starbucks receipt with the costs the community reports.

## Arc
- Hook: Starbucks spends about $400 million a year on software, and it's building AI tools that could replace some of it.
- Why Starbucks is doing it: it is cutting $2 billion in costs, reviewing "every contract and service" in technology, and its CTO says "There's clear opportunities to reduce the spend in software." The saving it expects soon is about $10 million, about $1 in every $40 of the bill.
- The mood, from the engineers to the boardroom. Inside the team: some say they are far faster, others that the work moved into checking and fixing, and one says there is "intense pressure to just slop something up and get it out the door". The managers set the bar: one who runs 15 engineers had to pull up one of them for "literal slop" on a pull request. The leaders sign the cheques: a wine shop owner stopped paying Klaviyo $400 a month and built a $40-a-month CRM instead. And somewhere in every company is Joe from engineering, "with the confidence of an alligator hunter".
- So let's put it on trial, with Starbucks in the dock.
- The case for build: it is working more than you'd think. 62 first-hand stories of internal builds that work, 3 that failed. One team replaced its support ticket system in two to three days for about $100, with "Maybe an hour of maintenance work per week."
- The case against build: the receipt. Writing it is the cheap line. The lines that catch people out are about people: "Vibe coding took hardly 2 days of effort and moving to our own custom built took 3 weeks"; a CEO went back to HubSpot because "sales candidates" kept "asking about our homegrown CRM during interviews"; a home-built tool that nobody kept looking after "went to hell over the next 2/3 years". Krish's one line: he knows for a fact that looking after your own tools takes a lot of energy.
- The case for buy: the vendor carries the looking after, the audits and the blame, and the people you hire already know how to use it.
- The case against buy: the bill keeps changing shape. Vendors are adding pay-per-use credits on top of seats, and in HubSpot's own trials customers used two to three times more credits. One team rebuilt a $20,000-a-year tool because the vendor's support was too slow to wait for.
- The verdict: the winners made looking after someone's job before they let everyone build. Klaviyo opened a company platform to its staff, every app private and behind the company login, and 356 apps shipped in two weeks; at another company, an app that became business-critical was handed to the dev team. So Starbucks can do this if it gives each tool an owner and a home. Joe from engineering, on his own, can't. Inside developer teams, the job moves from writing the tools to running the place everyone builds them.
- The three questions to ask before you build the next part of your stack (The use, below), one each for customer service, marketing and productivity tools.
- His close.

## The fun
A trial, told tongue in cheek, with Starbucks in the dock. Joe from engineering is the star witness, confident to the end. Build and buy each take the stand twice, once for and once against, and each case brings one exhibit. The exhibit for the case against build is an itemised receipt: the first line, "Writing it", is tiny. Then it keeps printing, and every line after it is a real thing someone posted: three weeks moving people over, the job candidates asking about the homegrown CRM, the tool nobody owned that went to hell in two or three years. The joke lands on the receipt: the expensive lines are all people. The verdict is three questions anyone can use. Every line is said the plain way you would say it to a friend; no clever phrasing (Krish, 9 Nov: "It's really important we aren't trying to cryptically confuse everyone.").

## The use
Three questions to ask yourself when someone asks whether to build or buy the next part of your tech stack (Krish: "three questions to ask themselves when they're asked whether they should build versus buy the next part of their technology stack (focus on CX and productivity tech and martech as examples)"):
- Who owns it when it breaks at 2am? If nobody has their name on it, buy. Customer service example: a bot that answers customers overnight needs someone awake when it goes wrong.
- Does it hold customer data, or does it have to pass an audit? If yes, buy, or build only on a company platform that handles logins and security for you. Marketing example: the email platform that holds your customers' consent records. A dashboard built on data you already own is fair game to build.
- Will your people actually move to it? Count the weeks it takes to move everyone over, and ask whether the people you hire next already know the bought tool. Productivity example: one company built its own replacement for monday.com in two days, and moving everyone onto it took three weeks.
New against recent pieces: the last three locks gave "ask your AI supplier where its new computing is being built", the Amazon AI-usage actions and no action; none is a build-or-buy test.

## His close
His own line, on camera, in his words, written once the piece is built. The test he set: "the closing line should leave them clearer on how to think about the options than they were 5 minutes before". Working line until then: Building got cheap, and it's working. The costs that catch you out are people: who owns it, who moves to it, who you hire next. Answer those three, and you'll know whether to build.

## Facts to check
- Starbucks spends about $400M a year on software (CTO Anand Varadarajan at an internal forum) and is building alternatives to a Microsoft inventory system and an IBM maintenance tool, some by "the end of next year" | https://fortune.com/2026/07/09/starbucks-to-use-ai-to-replace-microsoft-ibm-software/ (Bloomberg via Fortune and Investing.com, 9 Jul 2026) | to check; reported, no Starbucks statement found
- Starbucks is cutting $2 billion in costs and reviewing "every contract and service" related to technology; CTO: "There's clear opportunities to reduce the spend in software."; near-term savings about $10M in software and $13M mostly from contractors | Bloomberg via Investing.com and Fortune, 9 Jul 2026 | to check
- 35% of teams surveyed have replaced at least one SaaS tool with a custom build; sample 817 Retool customers and builders | https://retool.com/blog/ai-build-vs-buy-report-2026 | to check; name Retool as the seller of building tools every time
- The community evidence: 518 items, 192 first-hand; internal builds that work 62 first-hand items supporting against 3 contradicting; no first-hand item on upkeep displacing roadmap work; a keyword sample, so it shows what happens and never how often | docs/plans/2026-11-16-week/wed-community.md (Apify run, 10 Nov 2026) | checked 2026-11-10 against the file's scorecard; say "in the posts we gathered", never a share of companies
- Theo (t3.gg): "The gap between an average engineer and the best engineers was never quite 10x, but it was meaningful. AI has made the gap at least 100x." | Krish's screenshot of the post, 10 Nov 2026; find the post on x.com/theo | to check the post is public, its date and exact words
- Andrew Amann, CEO of NineTwoThree: "Joe from engineering with the confidence of an alligator hunter" | Krish's screenshot of a LinkedIn comment, 10 Nov 2026 | to check it is public and quote it with his name; if it cannot be found, use "Joe from engineering" without the quote
- "intense pressure to just slop something up and get it out the door" | https://www.reddit.com/r/sysadmin/comments/1tee4rf/comment/om6thyw/ (ErikTheEngineer, 16 May 2026) | to check the link opens
- A manager of 15 engineers: "So far I’ve only had to pull up 1 engineer of the 15 I manage on it who submitted literal slop on a PR." | https://www.reddit.com/r/EngineeringManagers/comments/1qiyqes/comment/o0w5jfr/ (devlifedotnet, 21 Jan 2026) | to check the link opens
- Owner, The Hare Wine Co.: "On Sunday we stopped paying Klaviyo USD$400 a month... We built our own marketing CRM instead. AI helped us build it... It costs USD$40 a month, so we are USD$4,320 a year better off." | https://www.linkedin.com/posts/activity-7523392084054134784-rtW1 (3 Nov 2026) | to check; self-reported savings
- A support ticket system replaced in-house: "Just took 2-3 days for us... Took about $100 in tokens to build. Maybe an hour of maintenance work per week." | https://news.ycombinator.com/item?id=48546837 (aurareturn, 15 Jun 2026) | to check; the post does not name AI outright, so do not say it was built with AI
- "Vibe coding took hardly 2 days of effort and moving to our own custom built took 3 weeks." (replacing monday.com) | https://x.com/aigirlagent/status/2065669027897466964 (13 Jun 2026) | to check; role unknown
- "two weeks in, I got tired of sales candidates asking about our homegrown CRM during interviews. so we went back to HubSpot." | https://www.linkedin.com/posts/saharshagrawal_vibe-coding-your-crm-is-the-most-tempting-activity-7435051075143016449-yk_r (Saharsh Agrawal, CEO of Surface Labs, 4 Mar 2026) | to check; he sells AI tools for sales teams, say so
- "Our internally built version sucked but was initially adequate but didn’t continue to be supported and went to hell over the next 2/3 years" | https://www.reddit.com/r/sales/comments/1xs1q3h/is_anyone_actually_feeling_good_about_their/19se562kv4gw0/ (BegrudginglyAwake, 9 Nov 2026) | to check; a pre-AI build, say so
- Klaviyo's CTO: K:Forge opened to 2,000+ staff, "apps are private by default, every one sits behind SSO", "In the first two weeks, we shipped 356 apps." | https://www.linkedin.com/posts/surbs_how-klaviyo-shipped-356-internal-apps-in-activity-7515876418988216320-P29D (13 Oct 2026) | to check; Klaviyo sells software and names a Vercel partnership, say so
- A company platform for staff-built apps: "they don’t need to worry about API keys, backups, security, etc. it’s all handled by the platform... One app already got seen to becoming business critical so promoted to a dev team" | https://www.reddit.com/r/devops/comments/1xlhrh8/how_many_apps_have_nonengineers_at_your_company/19s1vz1fjb9ok/ (iamichi, 2 Nov 2026) | to check
- Harmonic's Head of Automation on a $20,000-a-year tool: "Their support was so slow that it was faster for me to rebuild the product inside Retool than wait for support to get back to me." | https://retool.com/newsroom/build-vs-buy-report-2026 | to check; a Retool marketing quote
- Klarna replaced Workday with Deel, another subscription | https://cxtoday.com/klarna-didnt-replace-salesforce-it-replaced-them-with-alternative-saas-apps | to check; reported
- HubSpot: "Our vision is simple, a hybrid model of seats and credits"; in pilots "credit usage is 2 to 3x higher" | https://www.fool.com/earnings/call-transcripts/2026/11/05/hubspot-hubs-q3-2026-earnings-call-transcript/ | to check on HubSpot's own IR transcript

## Outline
Spine: Now that AI can write software, should you build the next tool or keep buying it?
Answer: Building is working for small tools someone owns, and the costs that catch people out are about people, so three questions about people tell you which to do.
1. THE $400 MILLION BILL | proves: big companies really are trying to build their way out of software spend, and why Starbucks is
2. FROM THE ENGINEERS TO THE BOARDROOM | proves: AI is changing the job inside the team, managers are setting the bar, and leaders are cancelling subscriptions
3. THE CASE FOR BUILD | proves: in the posts gathered, home-built tools mostly work, and some cost an hour a week to keep
4. THE RECEIPT | proves: the costs that catch people out are people: moving staff over, hiring, and the tool nobody owns
5. BUY ON TRIAL | proves: buying hands the looking after to someone else, and the bill keeps changing shape
6. THE VERDICT AND THREE QUESTIONS | proves: the winners gave every tool an owner and a home first, and three questions about people sort the next tool

## Style recipe
- Script: relatable-debate inside a fry-explainer, the four cases one plain step at a time, each answered by the next, all carried by the one Starbucks case.
- Production: face-with-proof for the 5-minute cut; voice-led-pictures for the 90-second cut; the community quotes shown as the real posts, with their dates.
- Experiment: itemised-receipt, the exhibit for the case against build: a tiny first line, "Writing it", then line after line of real posted costs, all of them about people.

## Music bed
NO CURVES (Instrumental Version), Superintendent McCupcakes (Epidemic Sound), `no-curves-instrumental` in `config/music-library.json`, the one series bed in the ledger, in the one bed shape (`config/music-bed.json`).
