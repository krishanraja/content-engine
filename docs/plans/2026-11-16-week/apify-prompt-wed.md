# Apify community-evidence prompt: Wed 18 Nov, build versus buy (piece db9f9f6a)

Asked for by Krish, 10 Nov 2026: "Maybe give me a prompt to go and source all of this community feedback from Apify. And then I can bring it back."
Paste everything inside the fence into a Claude chat that has the Apify connector. Bring the finished file back to the Wednesday session; it is saved as `docs/plans/2026-11-16-week/wed-community.md`.

```text
You are a research agent with the Apify tools. Your job is to collect first-hand community evidence, with links, about what AI coding is doing inside software teams, and how that rolls up to engineering managers and then to the commercial leaders who decide whether to build software or keep buying it. You are gathering evidence, not writing an argument. Find what is true, including what goes against the ideas below.

WINDOW: posts and comments from 1 January 2025 to today.
BUDGET: before you run anything, list the Actors you plan to use, the inputs and the estimated cost of each. Stop there and wait for my yes. Stay under a total of $25 unless I raise it. Report the actual spend at the end.

THE IDEAS TO TEST (each one marked supported, contradicted or mixed by the end)
H1 Hidden costs. Companies that choose to build underestimate the costs they cannot see at the start: maintenance, security fixes, on-call and 2am pages, integrations breaking when other systems change, compliance and audit work, documentation, and the risk of the one person who understands it leaving.
H2 Lost focus. Keeping home-built tools running pulls engineers off the product and the roadmap ("we spend X% of every sprint keeping our internal tools alive").
H3 Inside the team. AI coding makes the first version much faster and pushes the work into review, debugging, rework and keeping things running. Look for: more and bigger pull requests, a heavier review load on seniors, AI-written code nobody fully understands, duplicated code, fewer juniors learning the system, and tools built outside IT ("shadow IT", "vibe-coded internal tools").
H4 Managers caught in the middle. Engineering managers and CTOs are being asked to deliver more with fewer people because "AI makes it faster", and are rarely given time or budget for the upkeep.
H5 The boardroom. CEOs, CFOs and other commercial leaders push to cancel software subscriptions and "just build it with AI" (examples: "my CEO thinks we can replace Salesforce/HubSpot/Zendesk with Claude", "the CFO wants to cut our SaaS bill").
H6 Reversals. Teams that built a replacement and then went back to buying, and why.
H7 Counter-evidence. Builds that clearly paid off, with what made them work (team size, scope, data, owner).

FOCUS THE EXAMPLES ON three kinds of software: customer service (help desks, chatbots, ticketing: Zendesk, Intercom, Freshdesk, Gorgias), productivity and internal tools (project trackers, approvals, admin panels, wikis: Jira, Asana, monday.com, Notion, Retool), and marketing tech (CRM, email, automation, analytics: HubSpot, Salesforce, Marketo, Braze, Klaviyo, Mailchimp, Segment).

WHERE TO LOOK (search the Apify Store for the most-used, best-rated Actor for each source; prefer Actors that return the URL, date, author, score and full comment text)
1. Reddit, posts and comment threads: r/ExperiencedDevs, r/EngineeringManagers, r/cscareerquestions, r/programming, r/devops, r/sysadmin, r/ITManagers, r/CTO, r/SaaS, r/startups, r/Entrepreneur, r/salesforce, r/hubspot, r/marketingops, r/CustomerSuccess, r/Zendesk, r/msp. Read the top comments under each matching post: that is where the first-hand stories are.
2. Hacker News: stories and comments (the "Ask HN" and "Show HN" threads about internal tools, vibe coding, replacing SaaS, AI code review).
3. X: posts and replies from engineers, engineering managers, CTOs and founders.
4. LinkedIn: public posts and comments from engineering leaders, CTOs, CIOs, RevOps and marketing ops people.
5. Review sites (G2, Capterra, TrustRadius) for the named products above: reviews that say the company built its own and came back, or left to build its own.
6. Blind (teamblind.com) and dev.to, if an Actor can reach them.

SEARCH TERMS (combine with the product names above; run each on every source that supports search)
"built our own" + crm / helpdesk / internal tool; "replaced [product] with" + "we built"; "vibe coded" + "internal tool" / "production" / "maintain"; "who maintains" + "internal tool"; "nobody understands the code" + AI; "AI generated code" + "tech debt" / "maintenance" / "review"; "PR review" + "AI" + "burnout" / "bottleneck"; "build vs buy" + AI / 2025 / 2026; "cancel SaaS" + "build it ourselves"; "CEO wants us to" + "build" + AI; "CFO" + "SaaS spend" + "build"; "went back to" + Salesforce / HubSpot / Zendesk / Jira; "shadow IT" + "AI tools"; "on call" + "internal tool"; "sprint" + "maintenance" + "internal tools"; "Retool" OR "Lovable" OR "Replit" OR "Base44" + "production" + "regret".

WHAT COUNTS
- First-hand only for the main evidence: the writer says it happened to them or their team ("we", "my team", "at my company"). Opinions and predictions go in a separate pile marked OPINION.
- Flag anything posted by a vendor, a consultancy selling build or migration work, or an account that looks like marketing. Keep it, marked VENDOR.
- Never paraphrase a quote. Copy the words exactly, cut only with "...", and keep enough words that the meaning holds.
- Every item has its working link. No link, no item.
- Drop duplicates and cross-posts; keep the original.

FOR EACH ITEM, RECORD
platform | link | date | author handle | role as stated (developer, senior engineer, EM, CTO, founder, CEO/CFO, RevOps, marketing ops, support lead, unknown) | company size if stated | product named | which idea it bears on (H1 to H7) | supports or contradicts | FIRST-HAND / OPINION / VENDOR | engagement (upvotes, likes, replies) | the exact quote | any number given (hours, % of a sprint, people, $ a year, months to build, months before regret).

WHAT TO HAND BACK: one Markdown file, in this order
1. Method: the Actors used, the inputs, the date it ran, items scraped, items kept, total cost.
2. Scorecard: for H1 to H7, the count of first-hand items supporting and contradicting, and a one-line verdict (supported, contradicted, mixed, too little evidence).
3. The numbers: every hard number people gave about upkeep, focus lost, review load, build time or money saved or lost, each with its quote and link. Say plainly how many there are and how far they agree.
4. The chain, one section each, the 8 strongest first-hand quotes per level: (a) inside the team, (b) the managers, (c) the commercial leaders, (d) reversals, (e) builds that paid off.
5. The 10 quotes a viewer would remember, the plainest and most vivid, each with its link, role, date and engagement.
6. Surprises: anything that does not fit H1 to H7 and may matter more.
7. Gaps: what you could not find or reach, and which sources were blocked or empty.
8. The full table of every item kept.

Be honest about weak evidence. A thin result, plainly reported, is more useful than a strong-sounding one that rests on a few loud posts.
```
