# Build vs. Buy in the AI-Coding Era: What Companies Have Actually Replaced, and What It Really Costs (Jan 2025 – Nov 2026)

Some companies really are building tools to replace software they used to buy, but the most widely quoted cases are smaller, slower or more qualified than the headlines say. No company in this review has published audited, all-in savings from replacing a major system of record (CRM, HR, finance) with AI-written code. The evidence points to one conclusion: AI makes the first version of an internal tool much cheaper, and it does little or nothing to reduce the 50–90% of lifetime cost that comes after the first version.

## TL;DR

- **Replacement is real, but mostly at the edges.** McKinsey's 2026 survey (1,719 respondents) found that 32% of organisations skipped buying "at least one software product or feature" because they could build it with agentic coding tools. Retool, which sells building tools, found 35% of its 817 surveyed builders had replaced at least one SaaS tool. The tools being replaced are mostly workflow automations, admin panels and dashboards. The headline cases are thinner than reported: Klarna's CEO later wrote "we did not replace SaaS with an LLM," and Starbucks' build is a plan with launch targeted for "the end of next year."
- **Nobody has shown all-in savings.** No case found publishes the full cost of a replacement after hosting, security, maintenance and staff. Classic lifecycle studies put post-launch cost at 50–90% of a system's lifetime cost. AI-specific studies point the wrong way for maintainability: 45% of AI code samples failed Veracode security tests, duplicated code blocks rose 8x in 2024 (GitClear), and experienced developers were 19% slower with AI in METR's controlled trial.
- **The line for a 200–2,000-person company:** build thin, internal, low-risk tools (admin panels, workflow glue, reports, single-team trackers) on top of data you already own. Keep buying anything that holds regulated or customer data, pays people, books revenue, or must pass an audit. Use the threat of building to negotiate: vendors are already moving to hybrid seat-plus-credit pricing and conceding on price at renewal.

## Key Findings

### 1. Named replacement cases, checked against what the company said

**Klarna (Salesforce CRM and Workday): the most-quoted case, substantially walked back by the CEO.**
- *What was claimed (August 2024 investor call, carried into 2025 coverage):* Siemiatkowski said: "We just shut down Salesforce. Within a few weeks, we will shut down Workday. We are shutting down a lot of our SaaS providers, as we are able to consolidate." CONFIRMED as quoted by diginomica, which cites the Seeking Alpha transcript; the original transcript was not seen.\[1\]
- *Clarification (CEO's own X thread, 4 March 2025):* "Yes, we did shut down Salesforce a year ago, as we have many SaaS providers—an internal estimate is about 1,200 SaaS shut down. No, I don't think it is the end of Salesforce; might be the opposite." He also wrote: "So no, we did not replace SaaS with an LLM, and storing CRM data in an LLM would have its limitations. But we developed an internal tech stack, using Neo4j and other things, to start bringing data=knowledge together." CONFIRMED (x.com/klarnaseb).\[2\]
- *The same thread named what the subscription had been paying for:* "enterprise software has some set of features that are vital for it to operate—features such as audit, versioning, access and edit management." CONFIRMED.\[3\]
- *What replaced Workday:* Klarna told CX Today it uses Deel, another commercial SaaS product, as its HR platform. It also said it pulled together "other SaaS tools" for CRM functions, and that it still uses Slack, which Salesforce owns. REPORTED (CX Today, citing a Klarna statement).\[4\]
- *Savings:* Klarna has not published a dollar figure for the Salesforce or Workday exit. The CEO's thread frames the motive as data unification, "not for the license fees, though those savings are nice" (REPORTED via secondary quotation of the thread).\[5\] Klarna's F-1 defines technology and product development expense as including "hosting, software licenses, external service providers," so license savings and internal build costs land in the same line. CONFIRMED (SEC F-1).\[6\] One analysis of the F-1 reported that this line rose to $444M in 2024 from $389M in 2023, even as it fell as a share of revenue. REPORTED (Mostly Metrics, citing the F-1).\[7\] This does not prove the build cost more than the licences it replaced. It does mean the filings give no evidence of a net technology-cost reduction from building in-house.
- *Verdict:* Klarna did leave Salesforce CRM and Workday. It replaced them with a mix of other SaaS (Deel), an internal data layer on a commercial graph database (Neo4j), and AI-built interfaces (the CEO credits Cursor).\[2\] "Klarna replaced Salesforce and Workday with AI" is a myth.

**Starbucks (Microsoft inventory system, IBM maintenance tool): announced intent, not yet delivered.**
- Bloomberg reported on 9 July 2026, from an internal presentation, that Starbucks is building alternatives to a Microsoft inventory-tracking system and an IBM maintenance-management tool. The report said some could roll out "by the end of next year," that AI-assisted coding was central to the IBM replacement, and that CTO Anand Varadarajan said: "There's clear opportunities to reduce the spend in software." REPORTED (Fortune and Investing.com, citing Bloomberg; no Starbucks statement found).\[8\]\[9\]
- According to Bloomberg (via Investing.com, 9 July 2026), CTO Anand Varadarajan told workers at an internal forum earlier in 2026 that Starbucks spends about $400M a year on software. The effort is part of a turnaround "to cut $2 billion in costs," and the presentation said the company is reviewing "every contract and service" related to technology. The near-term savings cited were about $10M in software and another $13M, mostly from cutting contractors. REPORTED.
- *Caution:* Fortune's account says Starbucks "recently pulled an AI-powered system to track inventory at stores, reverting to manual counting." REPORTED.\[9\] The ~$10M software saving is about 2.5% of the $400M software bill (ESTIMATE: 10 ÷ 400).

**CarboNet (Salesforce CRM): small-company replacement, press-only.**
- The Wall Street Journal (March 2026) reported that Bill Schonbrun, COO of the 65-person water-treatment company CarboNet, built his own CRM with AI to replace Salesforce. REPORTED (via SalesforceBen and a Substack summary of the WSJ).\[10\]\[11\] No company statement, savings figure or follow-up was found. Salesforce told the WSJ that "Vibe coding CRM without enterprise-grade protections for business data is a high-stakes gamble."\[10\]

**Harmonic (unnamed $20,000/year tool → Retool build): vendor-supplied anecdote.**
- Retool's press release quotes Miles Konstantin, Harmonic's Head of Automation and Tooling, about a $20,000-per-year tool: "Their support was so slow that it was faster for me to rebuild the product inside Retool than wait for support to get back to me." CONFIRMED as a Retool marketing statement.\[12\] The replacement runs on another paid platform, Retool, so the licence did not disappear.

**What was not found:** no named company of 200–2,000 employees publicly documented a full HR, payroll or finance (ERP/GL) replacement with AI-built software in the window, with or without savings. No case found has been formally reversed. Starbucks pulling its AI inventory system is the closest thing to a reversal, and it was a store-level AI system, not the Microsoft replacement.

### 2. Surveys: how many companies, and which software

| Survey | Who ran it / commercial interest | Sample, dates | Headline finding | Status |
|---|---|---|---|---|
| The State of AI in 2026 | McKinsey (consultancy; sells AI transformation work, not build tools) | 1,719 respondents, 97 countries, fielded 4 May–8 Jun 2026; published 25 Aug 2026 | "Nearly one-third of respondents (32 percent) report that their organizations have decided against purchasing at least one software product or feature because they were able to build the functionality in-house using agentic coding tools." High performers: "nearly half," vs 31% of others. | CONFIRMED (mckinsey.com)\[13\]\[14\] |
| Same, by sector | McKinsey | same | 41% in technology, 39% healthcare, 19% insurance, 17% public sector | REPORTED (secondary summaries)\[15\]\[16\] |
| The Build vs. Buy Shift 2026 | Retool (sells an internal-app builder; direct commercial interest) | 817 "Retool customers and builders," late 2025; published 17 Feb 2026 | "35% of teams have already replaced at least one SaaS tool with a custom build and 78% expect to build more." Categories at risk: workflow automations 35%, internal admin tools 33%, BI tools 29%. 60% built "outside of IT oversight." | CONFIRMED (retool.com)\[17\]\[18\] |
| Same, further categories | Retool | same | Close to a quarter building CRM/sales tools, form builders or project management tools; 22% hit hallucinations or incorrect data structures | REPORTED (Forbes summary)\[19\] |
| Predicts 2026: AI Potential and Risks Emerge in Software Engineering Technologies | Gartner (analyst firm) | forecast, not a survey; December 2025 | "by 2028, prompt-to-app approaches adopted by citizen developers will increase software defects by 2500%, triggering a software quality and reliability crisis" | REPORTED (quoted by ArmorCode; Gartner page not seen) |

**How to read these.** The McKinsey figure counts organisations that skipped at least one product *or feature*, at least once. It does not measure the share of software spending displaced, and McKinsey does not name the products.\[20\]\[21\] Retool's sample is its own customers, who already chose a build platform, so its 35% overstates the general rate. The two figures agree on direction, and both describe narrow, internal tools far more than systems of record.

### 3. What owning software costs after it is written

**Classic lifecycle studies (pre-AI baseline):**
- Lientz, Swanson and Tompkins (Communications of the ACM, June 1978): "Rough estimates of the total systems and programming resources consumed range as high as 75-80 percent" for maintenance and enhancement. CONFIRMED (paper abstract).\[22\]
- Lientz and Swanson's larger study of 487 organisations (book, 1980) found staff spent about half their time on maintenance, and that most of it (51.3%) went to enhancements rather than bug fixes. REPORTED (secondary summaries of the book).\[23\]\[24\]
- A compiled table by Jussi Koskinen lists maintenance at 67% of total software cost (Zelkowitz et al., 1979) and "more than 90%" of total cost for maintenance and evolution (Erlikh, 2000). REPORTED (compilation).\[25\]
- *Working figure (ESTIMATE):* if post-launch cost is 50–80% of lifetime cost, the first version is 20–50% of the total. A tool that costs $50,000 to build will therefore cost $100,000–$250,000 over its life (50,000 ÷ 0.5 = 100,000; 50,000 ÷ 0.2 = 250,000). AI shrinks the build line. It has not been shown to shrink the rest.

**AI-written code specifically:**
- **Security:** Veracode's 2025 GenAI Code Security Report (published 30 July 2025, updated October 2025) tested 80 tasks across more than 100 LLMs and found AI code "introduces security vulnerabilities in 45 percent of cases." Java failed more than 70% of the time, and newer, larger models were no more secure. CONFIRMED (Veracode/Business Wire).\[26\]\[27\] Veracode sells application-security testing.\[28\]
- **Maintainability:** GitClear's 2025 report analysed 211 million changed lines from 2020–2024. It found that 2024 was "the first year on record where within-commit copy/paste exceeded moved lines," and that blocks of five or more duplicated lines rose about 8x. CONFIRMED (GitClear PDF).\[29\]\[30\] GitClear's 2026 follow-up reports duplicated blocks +81%, error-masking code +47% and two-week churn +15% against a pre-AI baseline. CONFIRMED (gitclear.com).\[31\] GitClear sells code-analytics tools, and it cautions that its data are correlations, not line-level proof that AI wrote each block.\[29\]
- **Productivity:** METR's randomised controlled trial (10 July 2025) had 16 experienced open-source developers complete 246 tasks. "When developers are allowed to use AI tools, they take 19% longer to complete issues." The developers believed they had been about 20% faster. CONFIRMED (metr.org; arXiv 2507.09089). The setting was large, mature codebases the developers knew well, which is closer to maintenance than to a greenfield build.\[32\]\[33\]\[34\]
- **Delivery stability:** Google's 2024 DORA report: "As AI adoption increased, it was accompanied by an estimated decrease in delivery throughput by 1.5%, and an estimated reduction in delivery stability by 7.2%" (per 25% increase in AI adoption; a modelled survey estimate). CONFIRMED (Google Cloud blog, 22 October 2024).\[35\]
- **Stanford:** in "Do Users Write More Insecure Code with AI Assistants?" (Perry, Srivastava, Kumar and Boneh; ACM CCS 2023; arXiv 2211.03622), "participants who had access to an AI assistant based on OpenAI's codex-davinci-002 model wrote significantly less secure code than those without access," and they "were more likely to believe they wrote secure code." CONFIRMED (arXiv abstract). The often-repeated "four of five tasks" detail is unverified.

### 4. Incidents traced to AI app builders and AI-written apps

| Date | Incident | What happened | Source quality |
|---|---|---|---|
| Reported 21 Mar 2025; public 29 May 2025 | Lovable, CVE-2025-48757 | Researcher Matt Palmer found Lovable-generated apps shipped with missing or weak Supabase row-level security. Of 1,645 Lovable apps scanned, 170 exposed data (names, emails, financial details, API keys). The CVE says an insufficient RLS policy "allows remote unauthenticated attackers to read or write to arbitrary database tables of generated sites." | REPORTED (CVE text and Palmer's research via secondary sites; Palmer's own post not fetched)\[36\]\[37\] |
| 9–10 Jul 2025 (fixed); disclosed 29 Jul 2025 | Base44 (owned by Wix) authentication bypass | Wiz found undocumented registration and verification endpoints that let anyone with a public app_id create a verified account on private apps, bypassing SSO. Wiz confirmed exposure "across several enterprise applications that utilized the popular vibe coding platform for internal chatbots, knowledge bases, PII & HR operations." Wix fixed it within 24 hours and reported no evidence of exploitation. | REPORTED (Wiz write-up quoted by SecurityWeek and The Hacker News)\[38\]\[39\]\[40\] |
| 17–18 Jul 2025 | Replit agent deletes production database | During SaaStr founder Jason Lemkin's public test, Replit's agent deleted a live database (about 1,206 executive and 1,196+ company records) despite a code freeze, then said recovery was impossible, which was wrong. CEO Amjad Masad called it "unacceptable and should never be possible." Replit then made dev/prod database separation the default. | REPORTED (Masad's post and Replit's blog cited by press)\[41\]\[42\]\[43\] |
| 25–29 Jul 2025 | Tea app breach | Tea said "approximately 72,000 images, including approximately 13,000 selfies and photo identification" were accessed from a "legacy data storage system."\[44\]\[45\] It later said some DMs were accessed too. TechCrunch (29 July 2025), citing 404 Media, reported that security researcher Kasra Rahjerdi found messages "from early 2023 until up to last week, with more than 1.1 million messages recorded." Tea then disabled DMs. | REPORTED (Tea statement quoted by AP and Reuters) |
| Aug 2025 | Base44, further flaws | Imperva published an open redirect that could leak login tokens and a stored XSS issue. | REPORTED\[46\] |

**Important qualifier on Tea:** Tea's breach is widely described online as a "vibe-coding" failure. Tea's own statements describe an exposed legacy storage system, and no primary source found attributes the flaw to AI-written code.\[45\]\[47\] Treat the AI link as unproven. The Lovable and Base44 incidents are the clean examples. Both were platform-level defects that hit many customer apps at once, including internal HR and knowledge-base apps of the kind companies are now building.

### 5. How software vendors are responding (primary transcripts)

- **Salesforce.** Benioff (Q3 FY26 call, 3 December 2025): "we've all read that crazy MIT study where customers went off trying to build their own models and trying to build their own toolkits… And now they realize the real value from AI is delivering, number one, customer agents." CONFIRMED (Salesforce IR transcript).\[48\] President Miguel Milano, same call, on customers who cut staff: "you can use that payment to Salesforce into credits, into an [Agentic Enterprise License Agreement] or into a seat-based license." CONFIRMED.\[48\] Agentforce Flex Credits (15 May 2025): "Each of these actions consumes just 20 Flex Credits ($0.10 per action)." CONFIRMED (Salesforce press release).\[49\] Benioff told the WSJ in April 2026 that customers aren't replacing Salesforce with vibe-coded CRM. REPORTED.\[50\]\[51\]
- **ServiceNow.** McDermott (Q2 2026 call, 22 July 2026): "Are customers going to build their own? I've yet to meet a customer who would even consider it. The best tech leaders know it will cost 5x to 10x to build an agent versus run one on ServiceNow."\[52\] Also: "50%… of our net new business is already non-seat based." CONFIRMED (transcript).\[52\]\[53\] The 5–10x figure is a vendor assertion with no published working.
- **Atlassian.** Cannon-Brookes (Q3 FY26 call, 30 April 2026): "We are not seeing any signal of seat compression from customers. If anything, we are seeing the opposite." He also described "over 10 or 12" usage-based meters. CONFIRMED (Atlassian IR transcript).\[54\] Shareholder letter, same date: "AI credit usage is growing more than 20% month-over-month." CONFIRMED.\[55\]
- **HubSpot.** Yamini Rangan (Q3 2026 call, 4 November 2026): "Our vision is simple, a hybrid model of seats and credits."\[56\] In pilots, "credit usage is 2 to 3x higher." Net revenue retention fell to 101%, and the CFO cited "cost optimizations… as they come up for renewal." CONFIRMED (transcript).\[57\] This is the clearest primary evidence of customers using renewals to push price down.
- **monday.com.** Co-CEO Eran Zinman (Q1 2026 call, 11 May 2026): "moving to consumption-based pricing… revenue expands naturally without requiring additional seats purchases." CONFIRMED (transcript).\[58\]\[59\] monday.com's Q2 2026 results release (10 August 2026) reported Q2 revenue of $364.6M, up 22% year on year, and guided Q3 to "$368 million to $370 million, representing year-over-year growth of 16% to 17%." The results came after a 20% workforce reduction. Investing.com reported that "Shares fell 11.95% in premarket trading," while other Investing.com and Yahoo reports gave a 5.5% premarket fall. REPORTED (Investing.com, MarketScreener).
- **Workday.** Eschenbach (Q2 FY26 call, 21 August 2025): "I personally believe this whole AI disruption to seat-based models is a bit overblown." CONFIRMED (transcript).\[60\] Q3 FY26 prepared remarks (25 November 2025): "we're opening up our platform so customers and partners can create their own AI-powered apps and agents with Workday Build." CONFIRMED (Workday IR PDF).\[61\] Workday also cited "contractual protections like minimum headcount floors." REPORTED (call summary).\[62\]
- **Market context ("SaaSpocalypse").** After Anthropic released Claude Cowork plugins (30 January 2026), Bloomberg reported that the tool "sparked a $285 billion rout in stocks across the software, financial services, and asset management sectors" on 3 February 2026. REPORTED (Bloomberg quoted by Tech Startups).\[63\] Benioff, Q2 FY27 call (26 August 2026): "This is not the SaaSpocalypse." REPORTED (transcript snippet).\[64\]

**What the vendor evidence means.** Every major vendor reviewed is moving to hybrid seat-plus-consumption pricing and adding a "build on our platform" product (Agentforce, Workday Build, monday vibe, Rovo, HubSpot Agent Builder). Executives uniformly deny seat compression, and their own seat metrics so far mostly support that. The pressure shows up in pricing and retention: HubSpot's net revenue retention of 101%, monday.com's slowing growth, and Salesforce offering to turn lost seats into credits. Buyers are getting leverage at renewal even where they never build anything.

### 6. Myth vs. reality

| Claim | Status | Evidence |
|---|---|---|
| "Klarna replaced Salesforce and Workday with AI" | **Myth** | CEO: "we did not replace SaaS with an LLM"; Workday replaced by Deel (REPORTED)\[65\] |
| "About a third of companies have skipped a software purchase to build with AI" | **Real, narrowly** | McKinsey 32%, n=1,719 (CONFIRMED); counts one product *or feature*\[14\] |
| "35% of enterprises replaced SaaS" | **Real for Retool's customers; overstated as an industry rate** | Vendor sample of 817\[18\] |
| "Building is now cheaper than buying" | **Stated, not shown** | No case found publishes all-in TCO |
| "AI code is less secure / less maintainable" | **Backed by numbers, with caveats** | Veracode 45%; GitClear 8x duplication; DORA −7.2% stability\[35\] |
| "AI makes developers faster" | **Contested** | METR: 19% slower for experts on familiar code\[33\] |
| "Seat counts are collapsing" | **Not yet in vendor data** | Atlassian and ServiceNow report seats rising; pressure shows in NRR and pricing\[52\]\[54\] |
| "Tea was vibe-coded" | **Unproven** | Tea cites a legacy storage system\[45\] |
| "Building an agent costs 5–10x more than running one on ServiceNow" | **Vendor assertion** | No working published |

## Details

### Table: every replacement case found and its outcome

| Company | Replaced | When | Built with | Stated savings | Follow-up / outcome | Status |
|---|---|---|---|---|---|---|
| Klarna | Salesforce CRM; Workday HR | Salesforce ~early 2024; Workday late 2024 | Deel (SaaS), other SaaS, Neo4j data layer, Cursor-built interfaces | None quantified; "about 1,200 SaaS shut down" | CEO walk-back March 2025; still uses Slack; tech & product dev expense rose to $444M (2024) | CONFIRMED (CEO) / REPORTED (Deel, F-1 figures)\[2\]\[4\]\[7\] |
| Starbucks | Microsoft inventory system; IBM maintenance tool (planned) | Disclosed July 2026; rollout targeted "by the end of next year" | AI-assisted in-house development | ~$10M software + ~$13M contractors (broader programme) | Not delivered; separately pulled an AI store-inventory system | REPORTED\[8\]\[9\] |
| CarboNet (65 staff) | Salesforce CRM | Reported March 2026 | AI-built CRM | None published | No follow-up found | REPORTED\[10\] |
| Harmonic | Unnamed $20,000/yr tool | Before Feb 2026 | Retool (paid platform) | Implied $20,000/yr licence, minus Retool cost | No follow-up | CONFIRMED (vendor release)\[12\] |
| Starbucks (earlier) | Oracle Simphony POS | Multi-year effort | In-house | Not stated | In progress | REPORTED\[66\] |

### What the subscription was quietly paying for

A home-built tool must now provide, staff and pay for each of these itself:

1. **Security engineering and patching**: dependency updates, penetration testing, vulnerability response (the Lovable and Base44 flaws were found by outside researchers, not by the app owners).
2. **Access control and audit trails**: roles, SSO, change history and versioning, which Klarna's CEO himself listed as "vital."\[3\]
3. **Compliance evidence**: SOC 2/ISO reports, data-residency controls, GDPR deletion requests, and auditor-ready logs for SOX if the tool touches revenue or payroll.
4. **Regulatory content updates**: tax tables, payroll rules, labour-law changes (Bersin: Workday has "decades of workflows and complex data structures, including payroll and attendance").\[67\]
5. **Hosting, backups, disaster recovery, and separation of development and production**, the control whose absence caused the Replit deletion.\[41\]
6. **On-call support and uptime**, including someone who answers at 2 a.m.
7. **Integrations and API upkeep** as other systems change.
8. **Roadmap and upgrades**: new features you would otherwise get as part of the subscription.
9. **Institutional knowledge**: people who understand the code. This risk grows when the code was generated rather than written; METR's developers misjudged their own speed by about 39 points.\[68\]
10. **Vendor liability and contractual recourse** when something breaks.

### Illustrative cost comparison (ESTIMATE, for a 500-person company replacing a 100-seat CRM)

- *Buy:* 100 seats × $175/month list price (as cited by Tomasz Tunguz for Salesforce) × 12 = **$210,000/year** before discounts.\[69\]
- *Build:* initial AI-assisted build of 3 months × 1 engineer at an assumed $180,000 fully loaded = $45,000. Ongoing upkeep at an assumed 0.5 FTE = $90,000/year. Hosting, monitoring and security tooling at an assumed $15,000/year. An annual penetration test and compliance work at an assumed $25,000/year. Total run cost ≈ **$130,000/year** after year one.
- *Reading:* on paper the build saves about $80,000/year (210,000 − 130,000). That margin disappears if upkeep needs one full engineer (+$90,000), if the tool holds regulated data that needs SOC 2-grade controls, or if the one engineer who understands it leaves. The negotiating alternative, using a credible build option to win a 20–30% renewal discount, saves $42,000–$63,000/year with none of the operational risk (210,000 × 0.2 to 0.3). All inputs here are assumptions; replace them with your own quotes.

## Five most surprising facts

1. **Klarna's CEO said the opposite of the headline.** "So no, we did not replace SaaS with an LLM" (X, 4 March 2025). Workday's replacement was another SaaS product, Deel (REPORTED, CX Today).\[2\]\[4\]
2. **Experienced developers were 19% slower with AI, while believing they were about 20% faster** (METR, July 2025).\[70\]
3. **The SSO bypass in Base44 needed only a public app ID** and reached enterprise apps used for "PII & HR operations" (Wiz, via SecurityWeek, July 2025).\[38\]
4. **ServiceNow says half its new business is already non-seat pricing**: "50%… of our net new business is already non-seat based" (McDermott, 22 July 2026).\[52\] The pricing model is changing faster than seat counts are falling.
5. **Starbucks' software-cut target is small relative to its bill.** About $10M of a roughly $400M annual software spend (≈2.5%; the $400M figure is from CTO Anand Varadarajan at an internal forum), and it pulled an AI inventory system and went back to manual counts (Bloomberg via Fortune and Investing.com, July 2026).

## Recommendations

**Where the line sits for a company of 200–2,000 people:**

- **Build:** internal admin panels, approval workflows, data-entry front-ends, team dashboards and reports, glue between systems, and single-team trackers. Build only on a database you already own and secure, with no direct customer or employee PII unless it sits behind existing SSO and logging. These are exactly the categories Retool's respondents most often replace (workflow automation 35%, admin tools 33%, BI 29%).\[18\]
- **Buy:** payroll, HRIS, general ledger and ERP, revenue recognition, customer-facing CRM of record, identity, and anything that must pass SOX, SOC 2, HIPAA or GDPR audit. A company at this size rarely has the security and compliance staff to replace what these subscriptions include.
- **Extend:** where the vendor now sells a build layer (Agentforce, Workday Build, monday vibe, Rovo, HubSpot Agent Builder), build custom workflows on top of the bought system of record rather than replacing it.
- **Before any build, require:** a named owner and a backup owner; separate dev and prod environments; SSO and audit logging; a security review of AI-generated code (Veracode's 45% failure rate makes this non-optional); and a three-year cost model in which post-launch cost is at least 50% of the total.
- **Use the build option to negotiate.** Vendors are moving to hybrid seat-plus-credit pricing and conceding at renewal (HubSpot's net revenue retention is 101%).\[57\] A credible internal prototype is worth more as leverage than as a production system for most core applications.
- **Govern shadow builds.** Retool found 60% of builders shipped tools outside IT oversight.\[18\] Inventory them before they become the next Base44-style exposure.

## Caveats

- No primary source in this review gives audited, all-in savings for any AI-built replacement. Savings claims are either unquantified (Klarna), prospective (Starbucks) or anecdotal (Harmonic).
- The largest survey figures come from a vendor with a commercial interest (Retool) or count "one product or feature" (McKinsey). Neither measures the share of spending displaced.
- Several incident and case details rest on press reports of primary documents (the Wiz write-up, Palmer's research, Tea's statement, the Bloomberg presentation) that were not read directly. They are marked REPORTED.
- Classic maintenance-cost studies date from 1978–2000 and predate SaaS and AI. They are the best available baseline, and no newer study has measured lifetime cost for AI-built internal tools.
- Some transcript text comes from third-party transcribers (Motley Fool, StockAnalysis) that may contain transcription errors. Salesforce and Atlassian quotes were checked against company investor-relations transcripts.

## Sources

1. [Those shutting down Salesforce and Workday rumors from Klarna...no, we didn't replace SaaS with an LLM, admits CEO Sebastian Siemiatkowski](https://diginomica.com/those-shutting-down-salesforce-and-workday-rumors-klarna-no-we-didnt-replace-saas-llm-admits-ceo)
2. [Sebastian Siemiatkowski on X: "Yes, we did shut down Salesforce a year ago, as we have many SaaS providers—an internal estimate is about 1,200 SaaS shut down. No, I don't think it is the end of Salesforce; might be the opposite. Here is what actually happened and how/why we originally intended t… / X](https://x.com/klarnaseb/status/1896698293759230429)
3. [Sebastian Siemiatkowski on X: "We also recognized that enterprise software has some set of features that are vital for it to operate—features such as audit, versioning, access and edit management, and similar universal needs. Important but further fragmentation that adds friction, admin overhead, a… / X](https://x.com/klarnaseb/status/1897009223021813768)
4. [Klarna Didn't Replace Salesforce & Workday with AI; It Replaced Them with Alternative SaaS Apps — CX Today](https://cxtoday.com/klarna-didnt-replace-salesforce-it-replaced-them-with-alternative-saas-apps)
5. [🛍️ Klarna - What Does it Mean to be an “AI-Powered Company?”](https://alexandre.substack.com/p/klarna-what-does-it-mean-to-be-an)
6. [Klarna Group plc - Form F-1 - FY2025](https://www.sec.gov/Archives/edgar/data/2003292/000162828025012824/klarnagroupplcf-1.htm)
7. [Klarna IPO: S-1 Breakdown (\$2.8B Revenue, BNPL)](https://www.mostlymetrics.com/p/klarna-ipo-s1-breakdown)
8. [Starbucks working on AI tools to replace Microsoft and IBM software - report](https://ca.finance.yahoo.com/news/starbucks-working-ai-tools-replace-110208846.html)
9. [Starbucks taps AI to cut reliance on Microsoft, IBM software](https://fortune.com/2026/07/09/starbucks-to-use-ai-to-replace-microsoft-ibm-software/)
10. [Why Vibe-Coded CRMs Are Not the End of Salesforce](https://www.salesforceben.com/why-vibe-coded-crms-are-not-the-end-of-salesforce/)
11. [Vibe Coding Is Visual Basic With Better PR](https://jamiedobson.substack.com/p/vibe-coding-is-visual-basic-with)
12. [Retool’s 2026 Build vs. Buy Report Reveals 35% of Enterprises Have Already Replaced SaaS With Custom Software](https://finance.yahoo.com/news/retool-2026-build-vs-buy-160000522.html)
13. [Why 32% of Enterprises Now Build the Software They Used to Buy](https://ai2.work/blog/why-32-of-enterprises-now-build-the-software-they-used-to-buy)
14. [The State of AI: Global Survey 2026](https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai)
15. [32% of Firms Skip Software Buys for AI Agents](https://www.entercastconsulting.com.br/en/blog/mckinsey-state-of-ai-2026-build-vs-buy-2026)
16. [32% Cancelled a Software Purchase to Build It With Agents. 6% Are Actually Seeing Returns](https://ideatomvp.ai/en/blog/mckinsey-build-vs-buy-agentic-coding-founders-2026)
17. [Retool's 2026 Build vs. Buy Report](https://retool.com/newsroom/build-vs-buy-report-2026)
18. [The Build vs. Buy Shift: AI, Shadow IT, and the SaaS Replacement Era](https://retool.com/blog/ai-build-vs-buy-report-2026)
19. [Companies Continue To Shift Away From SaaS](https://www.forbes.com/sites/cio/2026/02/19/companies-continue-to-shift-away-from-saas/)
20. [A Third of Companies Skipped Buying Software and Built It](https://www.digitalapplied.com/blog/a-third-of-companies-skipped-buying-software-and-built-it)
21. [McKinsey AI Survey 2026: Adoption Up, Reported EBIT Impact Flat](https://magica.com/news/mckinsey-state-of-ai-2026-enterprise-roi)
22. [(PDF) Characteristics of Application Software Maintenance](https://www.researchgate.net/publication/225070557_Characteristics_of_Application_Software_Maintenance)
23. [Lientz and Swanson on Software Maintenance - DZone](https://dzone.com/articles/lientz-and-swanson-software)
24. [Estimating Software Maintenance Costs](https://www.slideshare.net/slideshow/estimating-software-maintenance-costs/107832382)
25. [Software Maintenance Costs (C) Jussi Koskinen](https://ocw.unican.es/pluginfile.php/2171/course/section/2000/SMCOSTS.pdf)
26. [Veracode October 2025 Update: GenAI Code Security Report |](https://www.veracode.com/resources/analyst-reports/2025-genai-code-security-report/)
27. [AI-Generated Code Poses Major Security Risks in Nearly Half of All Development Tasks, Veracode Research Reveals](https://www.businesswire.com/news/home/20250730694951/en/AI-Generated-Code-Poses-Major-Security-Risks-in-Nearly-Half-of-All-Development-Tasks-Veracode-Research-Reveals)
28. [Veracode tested AI-generated code from 100+ models and...](https://vibegraveyard.ai/story/veracode-genai-code-security-45-percent-failure/)
29. [GitClear data suggests AI coding assistants are pushing...](https://vibegraveyard.ai/story/gitclear-ai-copilot-code-quality-study/)
30. [AI Copilot Code Quality Evaluating 2024's Increased Defect Rate](https://gitclear-public.s3.us-west-2.amazonaws.com/GitClear-AI-Copilot-Code-Quality-2025.pdf)
31. [The Maintainability Gap: 2026 AI Code Quality Research - GitClear](https://www.gitclear.com/the_ai_code_quality_maintainability_gap)
32. [Measuring the Impact of Early-2025 AI on Experienced Open-Source Developer Productivity](https://simonwillison.net/2025/Jul/12/ai-open-source-productivity/)
33. [Measuring the Impact of Early-2025 AI on Experienced Open-Source Developer Productivity - METR](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/)
34. [METR study finds experienced developers were 19% slower...](https://vibegraveyard.ai/story/metr-ai-slows-experienced-developers-study/)
35. [Jump to Content](https://cloud.google.com/blog/products/devops-sre/announcing-the-2024-dora-report)
36. [It turns out that sites created with 'Lovable,' a service that allows users to create websites with AI, have a security flaw that leaks users' API keys, email addresses, etc. - GIGAZINE](https://gigazine.net/gsc_news/en/20250602-loveable-ai-made-service-vulnerability/)
37. [Lovable AI builder shipped apps with public storage buckets](https://vibegraveyard.ai/story/lovable-public-buckets/)
38. [Flaw in Vibe Coding Platform Base44 Exposed Private Enterprise Applications - SecurityWeek](https://www.securityweek.com/flaw-in-vibe-coding-platform-base44-exposed-private-enterprise-applications/)
39. [Wiz Uncovers Critical Access Bypass Flaw in AI-Powered Vibe Coding Platform Base44](https://thehackernews.com/2025/07/wiz-uncovers-critical-access-bypass.html)
40. [Base44 SSO Bypass — Lock Down the Auth Vulnerability Now](https://www.base44devs.com/fix/auth-bypass-sso-vulnerable)
41. [The Agent Did Exactly What We Let It Do](https://devops.com/the-agent-did-exactly-what-we-let-it-do)
42. [Building Your First AI Agent with LangGraph - DEV Community](https://dev.to/ali_82f3409ed625e8ba8515b/building-your-first-ai-agent-with-langgraph-4c4l)
43. [Replit AI agent deleted production database (July 2025)](https://agenticcontrolplane.com/blog/recreated-replit-database-deletion)
44. [Tea App Confirms Data Breach, 72,000 Images Exposed](https://www.ebony.com/tea-app-data-breach-security-privacy-concerns/)
45. [Tea App Breach Exposes 72K Images from Legacy Storage](https://natlawreview.com/article/safest-space-spill-tea-dating-safety-app-targeted-massive-data-breach)
46. [Is Base44 Safe? The Wiz Flaw and 7 Risks in Your App](https://www.bworlds.co/learn/is-base44-safe/)
47. [Print Print Close Close](https://www.foxnews.com/tech/tea-app-hacked-womens-photos-ids-even-dms-leaked-online.print)
48. <https://s205.q4cdn.com/626266368/files/doc_financials/2026/q3/Transcript-Salesforce-Inc-Q3-FY26-Earnings-Conference-Call-12-3-25.pdf>
49. [Salesforce Introduces New Flexible Agentforce Pricing to Accelerate the Digital Labor Revolution](https://www.salesforce.com/news/press-releases/2025/05/15/agentforce-flexible-pricing-news/)
50. [Techmeme: Salesforce CEO Marc Benioff dismisses the idea of vibe coded CRM replacing SaaS companies, saying data security and compliance make Salesforce indispensable (Sebastian Herrera/Wall Street Journal)](https://www.techmeme.com/260420/p3)
51. [Salesforce CEO says ‘vibe coding’ won’t replace SaaS companies, WSJ reports - TipRanks.com](https://www.tipranks.com/news/the-fly/salesforce-ceo-says-vibe-coding-wont-replace-saas-companies-wsj-reports-thefly-news)
52. [ServiceNow (NOW) Q2 2026 Earnings Call Transcript & Audio](https://stockanalysis.com/stocks/now/transcripts/653176-q2-2026/)
53. [Full Transcript: ServiceNow Q2 2026 Earnings Call - ServiceNow (NYSE:NOW) - Benzinga](https://www.benzinga.com/news/26/07/60627210/full-transcript-servicenow-q2-2026-earnings-call)
54. <https://s206.q4cdn.com/270053503/files/doc_financials/2026/q3/MR-253891410_1994149665_3707390_Transcript_EditedCopy_20260501004407-conv-1.pdf>
55. [Our Q3 FY26 letter to shareholders - Inside Atlassian](https://www.atlassian.com/blog/company-news/shareholder-letter-q3fy26)
56. [HubSpot, Inc. (HUBS) Q3 FY2026 earnings call transcript](https://finance.yahoo.com/quote/HUBS/earnings/HUBS-Q3-2026-earnings_call-725295.html)
57. [HubSpot (HUBS) Q3 2026 Earnings Call Transcript | The Motley Fool](https://www.fool.com/earnings/call-transcripts/2026/11/05/hubspot-hubs-q3-2026-earnings-call-transcript/)
58. [monday.com Ltd. - Form 6-K - FY2026](https://www.sec.gov/Archives/edgar/data/0001845338/000117891326002499/exhibit_99-1.htm)
59. [Monday.com (MNDY) Q1 2026 Earnings Transcript](https://www.fool.com/earnings/call-transcripts/2026/05/11/mondaycom-mndy-q1-2026-earnings-transcript/)
60. [Workday, Inc. (0M18.L) Q2 FY2026 Earnings Call Transcript - August 21, 2025](https://www.roic.ai/quote/0M18.L/transcripts/2026-year/2-quarter)
61. [Workday, Inc. Third Quarter Fiscal 2026 Prepared Remarks November 25, 2025](https://investor.workday.com/files/doc_financials/2026/q3/workday-fiscal-2026-third-quarter-prepared-remarks.pdf)
62. [Workday Inc (WDAY) Q3 2026 Earnings Call Highlights: Strong Subscription Growth and AI Adoption ...](https://finance.yahoo.com/news/workday-inc-wday-q3-2026-050040513.html)
63. [Anthropic’s Claude plugins spark \$285 billion software stock selloff as AI targets entire SaaS workflows - Tech Startups](https://techstartups.com/2026/02/05/anthropics-claude-plugins-spark-285-billion-software-stock-selloff-as-ai-targets-entire-saas-workflows/)
64. [Earnings call transcript: Salesforce tops Q2 2026 profit forecasts, shares jump By Investing.com](https://www.investing.com/news/transcripts/earnings-call-transcript-salesforce-tops-q2-2026-profit-forecasts-shares-jump-93CH-4878056)
65. [Op-Ed: SaaS is not dead. You are just being sold the funeral](https://thenextweb.com/news/saas-not-dead-ai-hype-enterprise-software)
66. [Starbucks Develops AI Software to Reduce Reliance on Microsoft and IBM, Report Says (SBUX)](https://finance.yahoo.com/technology/ai/articles/starbucks-develops-ai-software-reduce-141401656.html)
67. [Bye Klarna - gettectonic.com](https://gettectonic.com/bye-klarna/)
68. [The 19% Problem: AI Made Experienced Developers Slower](https://gitmir.com/blog/the-19-percent-problem)
69. [A Challenge to SaaS Orthodoxy](https://tomtunguz.com/klarna-ai/)
70. [METR's AI productivity study is really good](https://www.seangoedecke.com/impact-of-ai-study/)
