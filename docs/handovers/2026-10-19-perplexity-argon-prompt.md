# Perplexity deep research prompt: Monday's piece (Gemini 4 Argon)

Paste everything between the lines into Perplexity (Deep Research). Everything it returns is a lead, not a
fact: the narrative session reads each number again at Google's own pricing page (house rule: never invent a
number, a quotation or a source).

---

I am preparing a short explainer for general business leaders (founders, CFOs, operations heads, not
engineers). The one-sentence idea: **if your business builds on Google's AI, your bill doubles on 1 December,
and almost nobody has priced that in. Companies that set their AI up to reuse what it has already read pay a
small fraction of the price for most of it; those that did not will see costs jump overnight.**

Research this thoroughly and cite every claim. Prefer primary sources (Google's own pricing page, Google Cloud
and Gemini API documentation, Google's announcement) over blogs. For each fact give: the claim, the source URL,
the date of the source, and whether it is primary (Google's own words) or secondhand. Mark anything you could
not verify as UNVERIFIED. Do not estimate or round any number you cannot source, and keep what is fact apart
from what is your inference.

**1. The price change (the core facts).** I have these claims and need each one confirmed or corrected against
Google's own pricing page: Gemini 4 Argon reached general availability on 13 October 2026; the launch price is
$2 per million input tokens and $10 per million output tokens until 30 November 2026; from 1 December it becomes
$4 and $20; cached input goes from $0.10 to $0.20 per million tokens on the same day. Also find: whether the
price differs by prompt length or tier, batch or priority pricing, and any storage fee for cached context.
State exactly how much cheaper cached input is than normal input before and after 1 December, as a ratio from
Google's own figures.

**2. How "reuse what it has already read" works.** In plain English, what is context caching in the Gemini API:
what gets cached, how long it lasts, the minimum size, who has to switch it on (explicit or automatic), and what
a customer must change in their set-up to benefit. Give one worked example of the same workload's monthly bill
with and without caching, before and after 1 December, using only Google's published prices (show the arithmetic;
say which workload assumptions are mine, not Google's).

**3. Who wins and who gets squeezed.** From credible reporting or analysis, who is affected: companies with
long, repeated prompts (documents, support bots) versus short one-off calls; companies that resell AI work at a
fixed price; companies on committed-spend or enterprise agreements versus pay-as-you-go. Name real companies
only where a source says they build on Gemini, and quote the source. Say if enterprise or committed-use
customers are treated differently from the public price.

**4. What a business should check before December.** What do Google's documents or credible analysts say about
how a customer finds out whether their usage is cached, where to see it on the bill, and what a contract or
order form should say about price changes and notice periods. Cite specifics; do not give generic advice.

**5. Counter-evidence.** Find the strongest argument that this is not a big deal (for example: output price
matters more than input, customers can switch models, a promotional rate is normal) and the strongest evidence
for it. Also find how the main rival providers price comparable models today, from their own pricing pages, with
dates.

**6. What has been said already.** What have credible outlets and analysts written about this price change so far?
Quote short phrases only with the source. If almost nothing has been written, say so; that is a finding.

Finish with a table of every number used: value, source, date, primary or secondhand. Put UNVERIFIED claims in
a separate short list at the end.

---
