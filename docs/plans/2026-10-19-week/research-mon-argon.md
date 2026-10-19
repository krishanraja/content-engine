# Research corpus: Gemini 4 Argon, 1 December price change

Pasted by Krish on 19 Oct 2026 for Monday's piece (`5b5bfadc-a60c-4d0a-be8e-b2e9bf43d092`). These are unchecked leads (handover 2026-10-19-editorial-narrative): every number is read again at the original at the fact gate. On 19 Oct the Standard Argon rows were read at https://ai.google.dev/gemini-api/docs/pricing (updated 2026-10-16): $2.00 / $0.10 cached / $10.00 through 30 Nov; $4.00 / $0.20 / $20.00 from 1 Dec, all matching below. The page does not print "95%"; that wording is from Google's launch post.

---

# Gemini 4 Argon December 2026 Pricing and Context-Caching Corpus

**Research cut-off:** 19 October 2026  
**Audience:** Founders, CFOs, operations leaders and commercial teams  
**Purpose:** Source corpus for a short business explainer about Gemini 4 Argon’s scheduled 1 December 2026 API price change and the economics of context caching.

## Corpus status

Google has published a scheduled expiry of Gemini 4 Argon’s introductory public API rates. Standard input, cached-input and output unit prices each double on 1 December 2026. This is accurately described as a doubling of the Argon model-token bill only where the workload, service tier, cache-hit rate and commercial terms remain unchanged. It is not a doubling of every Google AI product or every customer’s total bill.[^1][^2]

Gemini 4 Argon uses implicit caching. It is enabled automatically; customers do not manually switch it on. Businesses benefit when sufficiently long requests repeat a common prefix within a short period, and Google records those cache hits in API usage metadata.[^3][^4]

The strongest corrected explainer is:

> **Google’s introductory Gemini 4 Argon API rates expire on 30 November: its public token prices double on 1 December, while repeated prompt content that qualifies for Google’s automatic cache remains billed at one-twentieth of normal input. Negotiated contracts may differ.**

## Claim ledger

| Claim | Verdict | Evidence | Source date | Source class |
|---|---|---|---|---|
| Gemini 4 Argon reached general availability on 13 October 2026. | **PARTLY VERIFIED.** Google says it became “globally available” to developers and enterprises. That supports the substance, but the launch page does not use “general availability” as a formal lifecycle label. | Google launch announcement[^2] | Page dated 12 Oct; launch described as “today,” corresponding to 13 Oct in some regional/developer displays | Primary |
| Argon’s launch price is $2 per million input tokens and $10 per million output tokens through 30 November. | **VERIFIED.** Output includes thinking tokens. | Google pricing and model documentation[^1][^5] | 16 Oct and 13 Oct 2026 | Primary |
| From 1 December, input becomes $4 and output becomes $20. | **VERIFIED.** | Google announcement and pricing documentation[^2][^1] | 12–16 Oct 2026 | Primary |
| Cached input rises from $0.10 to $0.20 per million tokens. | **VERIFIED.** | Google pricing and model documentation[^1][^5] | 13–16 Oct 2026 | Primary |
| Cached input is 20 times cheaper than ordinary input before and after the change. | **VERIFIED, derived.** $2 ÷ $0.10 = 20 and $4 ÷ $0.20 = 20. Google describes this as 95% off. | Google announcement and pricing[^2][^1] | 12–16 Oct 2026 | Primary plus arithmetic |
| “Your Google AI bill doubles.” | **OVERBROAD.** The schedule applies to public-access Gemini 4 Argon model-token rates, not all Google AI products or every enterprise contract. | Google announcement footnote and Cloud Terms[^2][^6] | 12–13 Oct 2026 | Primary and secondhand |
| “Almost nobody has priced this in.” | **UNVERIFIED.** No survey or representative evidence was located. | No supporting source found | — | Unverified |
| Companies must turn caching on. | **FALSE FOR ARGON.** Implicit caching is enabled by default; explicit caching is not supported for Argon. | Google caching documentation[^3][^7] | 13 Oct 2026; generateContent page originally dated 26 Jan 2025 and updated with Argon | Primary |
| Caching prevents the December bill increase. | **FALSE.** Argon cached-input, uncached-input and output rates all double. Caching lowers the baseline but does not change the 100% rate increase. | Google pricing[^1] | 16 Oct 2026 | Primary plus arithmetic |

## Price schedule

All prices are USD per one million tokens unless stated otherwise.

### Gemini Developer API

| Service class | Period | Input | Cached input | Output, including thinking | Free tier | Source |
|---|---:|---:|---:|---:|---|---|
| Standard | Through 30 Nov 2026 | $2.00 | $0.10 | $10.00 | Not available | Google pricing[^1] |
| Standard | From 1 Dec 2026 | $4.00 | $0.20 | $20.00 | Not available | Google pricing[^1] |
| Batch | Through 30 Nov 2026 | $1.00 | $0.05 | $5.00 | Not available | Google pricing[^1] |
| Batch | From 1 Dec 2026 | $2.00 | $0.10 | $10.00 | Not available | Google pricing[^1] |
| Flex | Through 30 Nov 2026 | $1.00 | $0.05 | $5.00 | Not available | Google pricing[^1] |
| Flex | From 1 Dec 2026 | $2.00 | $0.10 | $10.00 | Not available | Google pricing[^1] |
| Priority | Through 30 Nov 2026 | $3.60 | $0.18 | $18.00 | Not available | Google pricing page, accessed 19 Oct 2026[^1] |
| Priority | From 1 Dec 2026 | $7.20 | $0.36 | $36.00 | Not available | Google pricing page, accessed 19 Oct 2026[^1] |

The published Standard, Batch, Flex and Priority unit prices all double on 1 December. Batch and Flex are 50% below Standard; Priority is 80% above Standard. Those relative relationships remain constant after the change. These percentages are arithmetic derived from Google’s figures.[^1]

### Prompt length

The Gemini Developer API Argon table does not publish separate prices above a prompt-length threshold. This differs from some other Gemini model tables, which explicitly split prices at 200,000 prompt tokens. The defensible statement is therefore: **Google publishes no prompt-length price split for Argon on the Gemini Developer API pricing table.**[^1]

Vertex AI’s wider pricing material contains general long-context language and regional endpoint distinctions, but a separate Argon long-context row was not located. The application of any general Vertex long-context note to Argon is **UNVERIFIED/AMBIGUOUS** and should be confirmed contractually with Google.

### Cache economics

For Standard pricing:

- Before 1 December: $2.00 ordinary input ÷ $0.10 cached input = **20:1**.
- From 1 December: $4.00 ordinary input ÷ $0.20 cached input = **20:1**.
- Cached input therefore costs **5% of normal input**, a **95% discount**.
- “20 times cheaper” is understandable business language; “one-twentieth of the price” or “95% cheaper” is less ambiguous.

Google’s own launch wording says cached input is “95% off.”[^2]

### Storage fee

Google’s Argon pricing row lists implicit caching only and does not list a cache-storage charge. Google’s general caching documentation distinguishes implicit from explicit caching; explicit caching can incur storage charges based on token count and TTL, but explicit caching is not supported for Argon.[^7][^1]

The precise claim should be: **No separate Argon implicit-cache storage fee is published on the cited pricing page.** Do not broaden this into a promise that Google can never introduce one or that every Gemini cache is free to store.

## Availability chronology

Google initially announced Argon on 29 September 2026 for a limited set of trusted cyber defenders through its Fairwind programme. That early announcement gave the introductory $2 input and $10 output rates but did not yet state the promotion’s end date.[^8]

Google’s October launch announcement then said Argon was globally available to developers and enterprises through the API and specified that the introductory period expires on 30 November. It stated that $4 input and $20 output rates apply afterwards and limited that footnote to the Argon model intended for public access.[^2]

This chronology explains apparently conflicting early articles: some September sources correctly described restricted access and an unknown promotion end date, while the October general release supplied the public date.[^9][^2]

## Context caching

### Plain-English explanation

An AI request often contains a large block that stays the same—system instructions, product documentation, policies, tool definitions, a codebase or conversation history—followed by a smaller, changing question. Without a cache hit, the model provider charges the full input rate whenever that material is sent. With an Argon implicit-cache hit, Google recognises a repeated beginning section of the request and bills those reused tokens at the cached-input rate.[^3][^7]

This is closer to reusing a recently prepared working file than to giving the model permanent memory. The repeated material still forms part of the model’s context; caching changes the price and can improve latency, not what the model is allowed to consider.[^7]

### Verified mechanics

| Question | Verified answer | Source date | Source class |
|---|---|---:|---|
| What can be cached? | Repeated prompt prefixes—the shared content at the beginning of similar requests. Google’s examples include repeated input content; explicit-cache documentation names large text, audio and video, although Argon itself is implicit-only. | 13 Oct 2026 / updated docs | Primary[^3][^7] |
| Is Argon caching implicit or explicit? | Implicit only. Explicit cache objects are not supported for Gemini 4 Argon and onward. | 13 Oct 2026 | Primary[^3] |
| Who enables it? | Google enables implicit caching by default for Gemini 2.5 and newer models. Customers do not configure a switch. | 13 Oct 2026 | Primary[^3] |
| Is a saving guaranteed? | No. Google’s generateContent page labels implicit caching as having “no cost saving guarantee”; savings apply when a request actually hits a cache. | Updated with Argon | Primary[^7] |
| Minimum request size | 4,096 input tokens for Gemini 4 Argon. | 13 Oct 2026 | Primary[^3] |
| Exact implicit-cache lifetime | Not published in the located Argon documentation. Google says to send similar prefixes within “a short amount of time.” | 13 Oct 2026 | Primary; exact TTL unverified[^3] |
| How to improve hits | Put large common content at the beginning and send requests with similar prefixes close together. | 13 Oct 2026 | Primary[^3] |
| Stateful only? | No. Implicit caching works in both stateful mode using `previous_interaction_id` and stateless conversation mode. | 13 Oct 2026 | Primary[^3] |
| How to detect a hit | Inspect `usage.total_cached_tokens` in an Interactions API response. In generateContent, inspect `usage_metadata`. | 13 Oct 2026 / updated docs | Primary[^3][^7] |
| Does cached content still count toward context? | Yes. Caching alters the billing treatment, not whether the content occupies context. | Current docs | Primary[^7] |
| Does Argon charge a cache-write premium? | No separate Argon write price is published. The pricing table supplies ordinary and cached-input rates only. | 16 Oct 2026 | Primary[^1] |
| Does Argon charge cache storage? | No separate implicit-cache storage price is listed. Storage-duration charges described in the general page relate to explicit cache objects, which Argon does not support. | 16 Oct / updated docs | Primary[^1][^7] |

### What customers change

Customers do not enable Argon caching. They change the probability of obtaining hits by changing prompt architecture and traffic patterns:

- Put stable, common instructions and source material first.
- Put changing user-specific content after the shared prefix.
- Avoid unnecessary variation inside the shared prefix.
- Send related requests close together.
- Ensure the request reaches at least 4,096 input tokens.
- Log `total_cached_tokens` rather than assuming a repeated-looking prompt was cached.[^10][^3]

Google does not publish an exact similarity threshold or exact Argon implicit-cache TTL. Claims that prompts must be byte-identical, or that Argon’s cache lasts a specific number of minutes, are therefore **UNVERIFIED**.

### Long-decode exception

Argon’s long-decode process can make several internal hops. Google says each later hop sends the prompt and generated material back to the model; `total_input_tokens` therefore accumulates input across hops rather than representing only the current context size. Google’s example reports about 397,000 total input tokens around an actual context of approximately 201,000 tokens, with repeated hop input receiving the 95% implicit-cache discount.[^11]

For cost monitoring, Google says to inspect the latest cumulative usage rather than adding streaming usage events together. Customers pay for work completed before a cancelled or failed interaction ends.[^11]

## Worked monthly example

### Assumptions

The following workload is an analyst-created illustration, not a Google benchmark:

- 100,000 requests per month.
- 10,000 input tokens per request.
- 8,000 input tokens form the repeated prefix and successfully hit the cache.
- 2,000 input tokens per request remain uncached.
- 500 output tokens per request.
- Standard global pricing.
- The first uncached request needed to establish reuse is omitted as immaterial at this scale.
- Taxes, tooling, grounding, network and other product charges are excluded.

Monthly token quantities:

- Total input: 100,000 × 10,000 = 1,000,000,000 tokens = 1,000 million.
- Cached input: 100,000 × 8,000 = 800,000,000 tokens = 800 million.
- Uncached input: 100,000 × 2,000 = 200,000,000 tokens = 200 million.
- Output: 100,000 × 500 = 50,000,000 tokens = 50 million.

### Bill calculation

| Scenario | Input calculation | Output calculation | Total monthly model-token charge |
|---|---:|---:|---:|
| Through 30 Nov, no cache hits | 1,000 × $2 = $2,000 | 50 × $10 = $500 | **$2,500** |
| Through 30 Nov, assumed cache hits | 800 × $0.10 + 200 × $2 = $480 | 50 × $10 = $500 | **$980** |
| From 1 Dec, no cache hits | 1,000 × $4 = $4,000 | 50 × $20 = $1,000 | **$5,000** |
| From 1 Dec, assumed cache hits | 800 × $0.20 + 200 × $4 = $960 | 50 × $20 = $1,000 | **$1,960** |

The assumed caching pattern reduces the total model-token bill by $1,520 before the change and $3,040 after it. In percentage terms, it saves 60.8% in both periods. Nevertheless, the cached workload still doubles from $980 to $1,960 because every relevant Argon unit rate doubles.[^1]

### Why output matters

At Standard rates, Argon output costs five times as much per token as uncached input and 100 times as much per token as cached input both before and after 1 December. Because output pricing includes thinking tokens, a reasoning-heavy workload can be output-dominated even when its visible answer is short.[^6][^1]

This yields two distinct controls:

- Improve cache hits to reduce repeated-input cost.
- Control output and thinking-token consumption to reduce the more expensive side of the request.

## Commercial exposure

### Evidence-based segmentation

| Business pattern | Expected exposure | Status of conclusion |
|---|---|---|
| Long documents repeatedly sent with each call | High caching opportunity when common material is placed first and repeated quickly enough. | Inference from Google’s documented mechanics[^3] |
| Support bots with stable policies, manuals or knowledge | Potentially high cache-hit share if requests share a sufficiently long prefix. | Inference, not measured outcome |
| Repeated codebase or tool definitions | Potentially high caching opportunity. | Inference from repeated-prefix mechanics |
| Short one-off calls | Low or zero Argon cache benefit where requests stay below 4,096 tokens or do not share prefixes. | Inference from published minimum[^3] |
| Fixed-price AI services | Gross-margin pressure if supplier token costs rise while customer prices remain fixed. | Commercial inference |
| Cost-plus or usage-priced services | Better ability to pass through the increase, subject to customer terms and notice obligations. | Commercial inference |
| Public pay-as-you-go Argon users | Directly exposed to the scheduled public rate. | Supported by public rate card[^1] |
| Negotiated enterprise users | Exposure depends on the Order Form, addendum, discounts and credits. | Supported by Cloud Terms[^6] |
| Multi-model routing users | Can test migration of simpler tasks to cheaper models, subject to quality and operational constraints. | Inference from availability of other priced models |

### Real Gemini customers

Named-company evidence should be used narrowly. Google says its customers use Gemini across customer service, employee productivity and data analysis, and identifies companies including PUMA, Snap and Warner Bros. Discovery in connection with Gemini at Work.[^12][^13]

Google’s customer material says SIGNAL IDUNA deployed Gemini across the company, while Wonderful uses Gemini and Vertex AI for automated customer and business interactions.[^14][^15]

These sources do **not** establish that the named companies use Gemini 4 Argon, pay public API rates, have a particular cache-hit rate or face a doubled bill. Presenting any of them as an Argon price-change victim would exceed the evidence.

## Enterprise and contracts

Google’s Cloud Terms were last modified on 1 June 2026. Section 2.6 says Google may change fees at any time unless an addendum or Order Form expressly says otherwise. Its explicit promise of at least 30 days’ advance notice and renewal-only price changes applies to Google Workspace, Looker (original) and Cloud Identity—not generally to GCP services.[^6]

Section 2.1 says Google’s measurement tools determine usage for GCP, Workspace, Looker and Cloud Identity. Section 14.1 says customer notices go to the Notification Email Address, are treated as received when sent and require the customer to keep that address current.[^6]

The evidence therefore supports four precise conclusions:

- An Order Form or addendum can override public fee treatment if it does so expressly.
- “Enterprise customer” alone does not prove exemption from the Argon rate change.
- A committed-spend agreement does not necessarily fix model unit prices.
- A customer may temporarily absorb higher unit prices inside unused commitment, but the actual effect depends on the contract and usage level.

### Contract fields to inspect

The business should inspect the executed documents for:

- Whether Argon is priced at a fixed rate or by reference to then-current public list prices.
- The effective dates for any fixed pricing.
- Treatment of promotional credits.
- Whether credits count toward committed spend.
- Volume discount schedules and eligible SKUs.
- Whether a new model version is a new SKU outside the agreement.
- Provisioned-throughput terms.
- Data-residency or regional endpoint premiums.
- Termination and minimum-spend consequences.
- The designated Notification Email Address.

These checks are anchored in Google’s fee-revision, measurement, Order Form and notice clauses, but the particular protections must come from the customer’s executed agreement.[^6]

## Operational audit

### Identify exposure

Create an inventory of production and planned calls to model ID `gemini-4-argon`. Separate them by Standard, Batch, Flex and Priority processing and by Gemini Developer API versus Vertex AI. Do not apply the Argon increase to other Gemini models without checking their own schedules.[^5][^1]

For each workload, capture:

- Monthly calls.
- Total input tokens.
- Cached input tokens.
- Output tokens.
- Thinking tokens where separately exposed in usage metadata.
- Processing class.
- Region or endpoint.
- Public-rate versus contracted pricing.
- Revenue model: fixed fee, usage fee, internal cost centre or pass-through.

### Instrument cache performance

For Interactions API responses, log:

- `total_input_tokens`
- `total_cached_tokens`
- `total_output_tokens`
- `total_thought_tokens`
- `total_tool_use_tokens`
- `total_tokens`

Google’s token guide identifies these fields on the response `usage` object.[^10]

Calculate cache-hit share as:

`cached input tokens ÷ total input tokens`

This is an internal analytical ratio, not a Google billing field. Where long decode is used, interpret `total_input_tokens` carefully because it aggregates repeated inputs across internal hops.[^11]

### Inspect AI Studio and billing exports

Google says Gemini API usage can be monitored in Google AI Studio under **Dashboard > Usage**, and says pricing can depend on input, output, cached-token count and cached-token storage duration.[^16]

For Google Cloud billing, the detailed BigQuery export includes `sku.id` and `sku.description`; Google says `sku.id` can map line items to published list prices, the Pricing Table report and the Cloud Billing Catalog API.[^17]

The exact Argon cached-input SKU name or invoice label was not found. It remains **UNVERIFIED**. Until confirmed, API usage metadata is the clearest request-level evidence of cache hits.

### Forecast four scenarios

Build a December forecast for:

1. Current workload at current public prices.
2. Current workload at 1 December prices.
3. Improved cache-hit rate at 1 December prices.
4. Model-routing or service-tier change at 1 December prices.

Keep input, cached input and output separate. A single blended “tokens” number obscures the 20:1 input/cache relationship and the fivefold output/input relationship.[^1]

## Counter-evidence

### Scheduled promotion, not surprise increase

Google labelled the original price “introductory” and disclosed the standard $4/$20 rate in its October public launch material. The strongest counter-framing is therefore “scheduled expiry of a launch promotion,” not “unannounced overnight price rise.”[^18][^2]

### Output can dominate

Output is five times the uncached-input unit price and includes thinking tokens. Computerworld quotes Greyhound Research analyst Sanchit Vir Gogia saying, “Cheap per token and cheap per task are different claims.” He argues that CIOs should budget at the higher rate because enterprise evaluation and procurement can outlast the discount window.[^6]

### Model switching is real

Customers can test less expensive models or different providers. However, substitution is not automatic: evaluation quality, tool compatibility, latency, context behaviour, migration effort and reliability determine whether a cheaper token rate produces a cheaper business outcome.

### Caching already softens absolute exposure

A customer with a high repeated-input share starts from a much lower input-cost base. But the percentage increase on Argon’s published cached-input rate is still 100% because $0.10 becomes $0.20.[^1]

## Rival pricing snapshot

“Comparable” is judgment-dependent: frontier models differ in quality, token use, context behaviour and product tier. The table reports primary-source prices and does not assert performance equivalence.

| Provider/model | Input / 1M | Cached read / 1M | Output / 1M | Cache mechanics | Source date | Source class |
|---|---:|---:|---:|---|---:|---|
| Google Gemini 4 Argon, through 30 Nov | $2.00 | $0.10 | $10.00 | Implicit only; 4,096-token minimum | 13–16 Oct 2026 | Primary[^1][^3] |
| Google Gemini 4 Argon, from 1 Dec | $4.00 | $0.20 | $20.00 | Implicit only | 13–16 Oct 2026 | Primary[^1] |
| Anthropic Claude Opus 5.5 | $4.00 | $0.20 | $20.00 | 5-minute write $5; 1-hour write $8; cache read 0.05× base | Current page; model launched 22 Sep 2026 | Primary[^19][^20] |
| Anthropic Claude Sonnet 5.5 | $2.00 | $0.10 | $10.00 | Cache read 0.05× base after 7 Oct reduction | 7 Oct 2026/current | Primary[^21][^22] |
| OpenAI GPT-6 Astra | $10.00 | $1.00 | $50.00 | Standard pricing shown on official page | Page dated 13 Oct 2026 | Primary[^23] |
| OpenAI model documented in Sep changelog, up to 272K input | $2.00 | $0.10 | $10.00 | Cache write $2.50; source snippet does not safely identify the model name | Sep 2026 | Primary but model identity unresolved[^24] |

For OpenAI’s newer documented caching regime, cache writes cost 1.25 times ordinary input and subsequent reads cost 0.1 times input for most GPT-5.6-and-later models, with a 0.05 multiplier for GPT-6.1 Sol. Cached input still counts toward token-per-minute limits.[^25]

The rival table is a rate-card snapshot, not a recommendation. Anthropic Opus 5.5 exactly matches Argon’s post-promotion $4/$20 headline rates and $0.20 cache-read price, but Anthropic also publishes cache-write charges and explicit lifetimes, whereas Argon relies on automatic implicit caching with no exact public TTL in the located documentation.[^19][^20][^3]

## Published coverage

Independent coverage is limited but not absent.

- **Computerworld, 13 October 2026:** described “an introductory pricing model that doubles after November 30” and quoted Greyhound Research arguing that buyers should budget at the higher rate and contract for price certainty.[^6]
- **Artificial Analysis, 29 September 2026:** measured $1.99 per Intelligence Index task at discounted pricing and projected $3.98 at standard pricing. Its early article preceded Google’s public end-date confirmation and described the price as a 50% promotion.[^9]
- **Yahoo Finance-hosted analysis, 13 October 2026:** called attention to the launch footnote and argued that “per-token price and per-task cost are different numbers.” It said the commercial test arrives on 1 December.[^26]
- **Apidog, 1 October and subsequently updated:** reproduced the $2/$10 to $4/$20 schedule, the 95% cache discount and the absence of a free Argon API tier. It is a specialist commercial blog, not independent financial journalism.[^27]
- **Google Cloud, 12 October 2026:** called the lower rate “introductory” and stated that standard $4/$20 pricing applies after 30 November.[^18]

The credible formulation is: **The schedule is public and has received some specialist and enterprise-technology coverage, but extensive mainstream analysis of its business impact was not located.** This does not prove that businesses have failed to budget for it.

## Source cards

### Google Gemini Developer API pricing

- **URL:** [https://ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing)
- **Displayed date:** 16 October 2026
- **Class:** Primary
- **Use:** Authoritative public Gemini Developer API rate card.
- **Key evidence:** Argon model ID; no free tier; Standard, Batch, Flex and Priority prices; cached-input schedule; output includes thinking; implicit-only caching.[^1]
- **Limit:** Public rate card does not disclose each enterprise customer’s negotiated terms.

### Google Argon launch announcement

- **URL:** [https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-argon/](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-argon/)
- **Displayed date:** 12 October 2026; availability described as “today,” with related developer display dated 13 October
- **Class:** Primary
- **Use:** Launch positioning, global availability and promotion expiry.
- **Key evidence:** $2 input, $10 output, cached input 95% off; after 30 November, $4/$20 applies; footnote limits statement to public-access Argon.[^2]
- **Limit:** Marketing announcement rather than contract.

### Google context-caching documentation

- **URL:** [https://ai.google.dev/gemini-api/docs/caching](https://ai.google.dev/gemini-api/docs/caching)
- **Displayed date:** 13 October 2026
- **Class:** Primary
- **Use:** Argon caching mechanics.
- **Key evidence:** implicit default; explicit unsupported; 4,096-token minimum; common prefix placement; short-time guidance; `usage.total_cached_tokens`.[^3]
- **Limit:** No exact implicit-cache TTL or similarity threshold.

### Google token guide

- **URL:** [https://ai.google.dev/gemini-api/docs/tokens](https://ai.google.dev/gemini-api/docs/tokens)
- **Displayed date:** Current at research cut-off
- **Class:** Primary
- **Use:** Usage instrumentation.
- **Key evidence:** input, output, thought, cached, tool-use and total token fields.[^10]

### Google billing guide

- **URL:** [https://ai.google.dev/gemini-api/docs/billing](https://ai.google.dev/gemini-api/docs/billing)
- **Displayed date:** Current at research cut-off
- **Class:** Primary
- **Use:** AI Studio usage location and billing factors.
- **Key evidence:** Dashboard > Usage; input, output, cached-token count and storage duration listed as pricing factors.[^16]
- **Limit:** Does not identify Argon’s exact cached-input invoice/SKU label.

### Google Cloud Terms

- **URL:** [https://workspace.google.com/intl/en_uk/terms/premier_terms/](https://workspace.google.com/intl/en_uk/terms/premier_terms/)
- **Last modified:** 1 June 2026
- **Class:** Primary legal terms
- **Use:** Fee revisions, usage measurement, Order Form overrides and notices.
- **Key evidence:** Fees can change unless expressly fixed in an Order Form or addendum; Google measurement controls usage; notices go to the Notification Email Address.[^6]
- **Limit:** Offline or negotiated agreements can govern instead.

### Computerworld

- **URL:** [https://www.computerworld.com/article/4235123/google-positions-gemini-4-argon-for-long-horizon-agentic-work-2.html](https://www.computerworld.com/article/4235123/google-positions-gemini-4-argon-for-long-horizon-agentic-work-2.html)
- **Date:** 13 October 2026
- **Class:** Secondhand credible trade press
- **Use:** Enterprise interpretation and independent analyst quotation.
- **Key evidence:** Doubles after 30 November; budget at higher rate; price certainty belongs in contracts.[^6]

### Artificial Analysis

- **URL:** [https://artificialanalysis.ai/articles/gemini-4-argon-google-top-three-labs](https://artificialanalysis.ai/articles/gemini-4-argon-google-top-three-labs)
- **Date:** 29 September 2026
- **Class:** Secondhand model-analysis firm
- **Use:** Per-task economics and counter-evidence to headline token comparisons.
- **Key evidence:** $1.99 test-suite task cost at promotional rates and projected $3.98 at standard rates.[^9]
- **Limit:** Early article preceded public end-date confirmation; benchmark workload is not representative of every business application.

### Anthropic pricing and caching

- **URLs:** [https://docs.anthropic.com/en/docs/about-claude/pricing](https://docs.anthropic.com/en/docs/about-claude/pricing) and [https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- **Date:** Current at 19 October 2026
- **Class:** Primary
- **Use:** Rival rate-card comparison.
- **Key evidence:** Opus 5.5 $4/$20; cache read $0.20; write prices and TTLs; Sonnet 5.5 cache-read treatment.[^20][^22][^19]

### OpenAI pricing and caching

- **URLs:** [https://openai.com/api/pricing/](https://openai.com/api/pricing/) and [https://developers.openai.com/api/docs/guides/prompt-caching](https://developers.openai.com/api/docs/guides/prompt-caching)
- **Date:** 13 October 2026/current
- **Class:** Primary
- **Use:** Rival pricing and caching mechanics.
- **Key evidence:** GPT-6 Astra $10/$1 cached/$50; newer caching write/read multipliers.[^23][^25]
- **Limit:** Dynamic pricing pages did not yield a complete clean table for every candidate comparable model.

## Number register

| Value | Meaning | Source/date | Classification |
|---|---|---|---|
| 29 Sep 2026 | Initial restricted Fairwind announcement | Google[^8] | Primary |
| 13 Oct 2026 | Global developer/enterprise availability in related launch displays | Google[^2][^5] | Primary; formal GA label qualified |
| 30 Nov 2026 | Last day of introductory Argon price | Google, 12–16 Oct[^2][^1] | Primary |
| 1 Dec 2026 | New Argon public rates begin | Google, 12–16 Oct[^2][^1] | Primary |
| $2 / 1M | Standard Argon input through 30 Nov | Google pricing[^1] | Primary |
| $10 / 1M | Standard Argon output through 30 Nov | Google pricing[^1] | Primary |
| $0.10 / 1M | Standard Argon cached input through 30 Nov | Google pricing[^1] | Primary |
| $4 / 1M | Standard Argon input from 1 Dec | Google pricing[^1] | Primary |
| $20 / 1M | Standard Argon output from 1 Dec | Google pricing[^1] | Primary |
| $0.20 / 1M | Standard Argon cached input from 1 Dec | Google pricing[^1] | Primary |
| $1 / $5 / $0.05 | Batch and Flex input/output/cache through 30 Nov | Google pricing[^1] | Primary |
| $2 / $10 / $0.10 | Batch and Flex input/output/cache from 1 Dec | Google pricing[^1] | Primary |
| $3.60 / $18 / $0.18 | Priority input/output/cache through 30 Nov | Google pricing[^1] | Primary |
| $7.20 / $36 / $0.36 | Priority input/output/cache from 1 Dec | Google pricing[^1] | Primary |
| 20:1 | Ordinary-to-cached Argon input price ratio | Arithmetic from Google rates | Derived |
| 95% | Argon cached-input discount | Google announcement[^2] | Primary |
| 4,096 tokens | Argon implicit-cache minimum input | Google caching docs[^3] | Primary |
| 1M tokens | Argon unified input-output limit stated at launch | Google announcement[^2] | Primary |
| 64K tokens | Long-decode threshold mentioned in Google documentation | Google long-decode docs[^11] | Primary |
| About 397,000 | Cumulative input in Google long-decode example | Google long-decode docs[^11] | Primary example |
| About 201,000 | Actual context size in the same example | Google long-decode docs[^11] | Primary example |
| 1 Jun 2026 | Cloud Terms last-modified date | Google Cloud Terms[^6] | Primary |
| 30 days | Advance fee notice expressly applying to named non-GCP services | Google Cloud Terms[^6] | Primary; not general Argon protection |
| 100,000 requests | Worked-example volume | Analyst assumption | Illustrative |
| 10,000 input tokens | Worked-example input per request | Analyst assumption | Illustrative |
| 8,000 cached tokens | Worked-example repeated prefix | Analyst assumption | Illustrative |
| 2,000 uncached tokens | Worked-example variable input | Analyst assumption | Illustrative |
| 500 output tokens | Worked-example output per request | Analyst assumption | Illustrative |
| 1,000M | Worked-example monthly input | Arithmetic | Derived |
| 800M | Worked-example cached input | Arithmetic | Derived |
| 200M | Worked-example uncached input | Arithmetic | Derived |
| 50M | Worked-example output | Arithmetic | Derived |
| $2,500 | Pre-change example without cache hits | Arithmetic from Google prices | Derived |
| $980 | Pre-change example with assumed hits | Arithmetic from Google prices | Derived |
| $5,000 | Post-change example without hits | Arithmetic from Google prices | Derived |
| $1,960 | Post-change example with assumed hits | Arithmetic from Google prices | Derived |
| 60.8% | Example total saving from caching | Arithmetic | Derived |
| 5:1 | Argon output to ordinary-input price | Arithmetic | Derived |
| 100:1 | Argon output to cached-input price | Arithmetic | Derived |
| $4 / $20 | Claude Opus 5.5 input/output | Anthropic[^19] | Primary |
| $5 / $8 / $0.20 | Opus 5.5 five-minute write, one-hour write and read | Anthropic[^19][^20] | Primary |
| 5 minutes / 1 hour | Anthropic cache durations | Anthropic[^20] | Primary |
| $10 / $1 / $50 | GPT-6 Astra input/cache/output | OpenAI[^23] | Primary |
| 1.25× / 0.1× | OpenAI newer-model cache-write/read multipliers for most models | OpenAI[^25] | Primary |
| $1.99 / $3.98 | Artificial Analysis task cost at promotional/standard Argon rates | Artificial Analysis[^9] | Secondhand benchmark |

## UNVERIFIED

- “Almost nobody has priced this in.”
- A representative count or percentage of affected businesses.
- A precise TTL for Argon’s implicit cache.
- The exact similarity or identity rule used to determine an Argon cache hit.
- The exact invoice description or Cloud Billing SKU name for Argon cached input.
- A separate Argon long-context price above 200,000 input tokens on Vertex AI.
- Universal application of a regional premium to every Argon access path.
- Eligibility of Argon spend for any particular savings plan or committed-use programme.
- Any blanket enterprise exemption from the 1 December public-price change.
- That any named Gemini customer uses Argon specifically.
- That any named customer will experience a doubled total bill.
- That “general availability” is Google’s formal lifecycle label for the 13 October release; the verified phrase is “globally available.”
- That prompt prefixes must be byte-identical.
- That implicit-cache hits will occur merely because the business sends the same document repeatedly.
- That absence of a listed Argon implicit-cache storage fee guarantees no future storage charge.

## Editorial guardrails

Use:

- “Gemini 4 Argon public API token rates double on 1 December.”
- “Google disclosed the higher rate at launch and calls the lower one introductory.”
- “Cached repeated input remains one-twentieth of ordinary input.”
- “Caching is automatic, but savings require actual cache hits.”
- “Negotiated enterprise terms may differ.”

Avoid:

- “All Google AI bills double.”
- “Companies must switch caching on.”
- “Caching prevents the December increase.”
- “Every repeated prompt is cached.”
- “Google gave customers no warning.”
- “Almost nobody has budgeted for it” without new evidence.
- Naming a company as affected unless a source establishes Argon use and its commercial exposure.

## Explainer-ready copy

### One sentence

**Google’s introductory Gemini 4 Argon API prices expire on 30 November, so its public input and output token rates double on 1 December; repeated prompt content that actually hits Google’s automatic cache still costs only one-twentieth of ordinary input, while negotiated contracts may differ.**[^3][^1]

### Short version

Google launched Gemini 4 Argon at an introductory $2 per million input tokens and $10 per million output tokens. From 1 December, those public rates become $4 and $20; cached input moves from $0.10 to $0.20.[^2][^1]

The important distinction is not whether a company has “turned caching on.” Argon’s implicit caching is automatic. The commercial question is whether requests contain at least 4,096 tokens, repeat a large common prefix and arrive close enough together to produce real cache hits.[^3]

Those cached tokens cost 95% less than ordinary input both before and after the change. But output—including thinking tokens—also doubles and costs five times ordinary input per token, so caching can lower the baseline substantially without preventing the December increase.[^1]

### CFO framing

Treat the public $2/$10 rate as a promotion ending on 30 November, not as a permanent baseline. Forecast December using separate quantities for uncached input, cached input and output, then reconcile the model against `total_cached_tokens` in production responses.[^10][^2]

Check the Order Form before assuming the public rate applies. Google’s standard terms allow fee changes unless an addendum or Order Form expressly says otherwise, and their general 30-day fee-notice protection does not cover GCP in the same way it covers the named Workspace, Looker and Cloud Identity services.[^6]

### Operations framing

Do not ask only, “Are we using caching?” Ask, “What percentage of input tokens are reported as cached?” Put stable material first, keep the shared prefix consistent, cluster related requests in time and instrument the usage fields. If `total_cached_tokens` stays near zero, the theoretical 95% discount is not reaching the workload.[^10][^3]

### Founder framing

A fixed-price AI product can suffer a margin shock if its supplier rate doubles while customer pricing stays unchanged. The exposure is greatest where Argon is embedded in a product sold at a fixed fee, output tokens are high and cache-hit rates are low. That is commercial inference, not a measured market outcome.

---

## References

1. [Gemini Developer API pricing - Google AI for Developers](https://ai.google.dev/gemini-api/docs/pricing) - **Note:** Gemini 4 Argon is not available on the Free tier.

2. [Gemini 4 Argon: Built to solve your hardest problems](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-argon/) - The model launches today at an introductory price 1 of $2 per million input tokens and $10 per milli...

3. [Context caching | Gemini API | Google AI for Developers](https://ai.google.dev/gemini-api/docs/caching?authuser=25) - |Gemini 4 Argon|4,096|
|Gemini 3.8 Flash|4,096|

4. [Context caching - Interactions API - Google AI for Developers](https://ai.google.dev/gemini-api/docs/caching) - |Model|Min token limit|
...
|Gemini 4 Argon|4,096|

5. [What's new in Gemini 4 Argon - Interactions API](https://ai.google.dev/gemini-api/docs/latest-model) - Gemini 4 Argon is available at introductory pricing through November 30, 2026:

6. [Google positions Gemini 4 Argon for long-horizon agentic work](https://www.computerworld.com/article/4235123/google-positions-gemini-4-argon-for-long-horizon-agentic-work-2.html) - Google has launched Gemini 4 Argon, a new flagship AI model aimed at complex enterprise and software...

7. [Context caching - generateContent API | Google AI for Developers](https://ai.google.dev/gemini-api/docs/generate-content/caching) - - Try to send requests with similar prefix in a short amount of time

8. [Gemini 4 Argon: our next era of frontier intelligence](https://blog.google/intl/en-in/products/gemini-4-argon-our-next-era-of-frontier-intelligence/) - Today, we’re announcing our new frontier model, Gemini 4 Argon, which is rolling out to a set of tru...

9. [Gemini 4 Argon: Google is back as one of the top three labs in ...](https://artificialanalysis.ai/articles/gemini-4-argon-google-top-three-labs) - At its current 50% pricing discount and with cache discounts increased to 95%, Gemini 4 Argon costs ...

10. [Understand and count tokens | Gemini API | Google AI for Developers](https://ai.google.dev/gemini-api/docs/tokens?authuser=129) - thinking (`total_thought_tokens`), cached content
(`total_cached_tokens`), tool use (`total_tool_use...

11. [Long decode - Interactions API - Google AI for Developers](https://ai.google.dev/gemini-api/docs/long-decode) - Use long decode with Gemini 4 Argon on the Interactions API to generate past 64K tokens up to the 1M...

12. [Gemini model updates, moving Gen AI to production with ...](https://cloud.google.com/blog/products/ai-machine-learning/experimentation-to-production-with-gemini-and-vertex-ai) - You might have seen the recent stat on how 61% of enterprises are running generative AI use cases in...

13. [Customers are putting Gemini to work](https://cloud.google.com/blog/products/ai-machine-learning/how-customers-are-putting-gemini-to-work) - Google Cloud customers are using generative AI across industries, from customer service to employee ...

14. [SIGNAL IDUNA case study](https://cloud.google.com/customers/signaliduna) - Partnering with Google Cloud, SIGNAL IDUNA executed a company-wide deployment of Gemini—known intern...

15. [Wonderful case study](https://cloud.google.com/customers/wonderful) - Wonderful uses Gemini and Vertex AI to overcome the global AI language gap, helping large local ente...

16. [Billing | Gemini API | Google AI for Developers](https://ai.google.dev/gemini-api/docs/billing) - - Cached token count
- Cached token storage duration
...
Use the `GenerativeModel.count_tokens` meth...

17. [Structure of Detailed data export | Cloud Billing | Google Cloud](https://docs.cloud.google.com/billing/docs/how-to/export-data-bigquery-tables/detailed-usage) - - Typically, your cost details are available within a day, but can sometimes

18. [Gemini 4 Argon available on Google Cloud](https://cloud.google.com/blog/products/ai-machine-learning/gemini-4-argon-available-on-google-cloud) - Argon launches at an introductory rate of $2 per million input tokens and $10 per million output tok...

19. [What's new in Claude Opus 5.5](https://docs.anthropic.com/en/docs/about-claude/models/whats-new-claude-4-8) - Claude Opus 5.5 costs $4 USD per million input tokens and $20 USD per million output tokens, below C...

20. [Prompt caching - Claude Platform Docs](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) - Prompt caching introduces a new pricing structure where 5-minute cache writes cost 25% more than bas...

21. [Claude Platform release notes](https://docs.anthropic.com/en/release-notes/api) - October 7, 2026. We've lowered the price of prompt cache reads on Claude Sonnet 5.5 from $0.20 USD t...

22. [Pricing - Claude Platform Docs](https://docs.anthropic.com/en/docs/about-claude/pricing) - |Claude Fable 5.1For demanding reasoning and long-horizon agentic work|$10 / MTok|$50 / MTok|$12.50 ...

23. [API Pricing - OpenAI](https://openai.com/api/pricing/?type=standard) - Input:$10.00 / 1M tokensCached input:$1.00 / 1M tokensOutput:$50.00 / 1M tokens

24. [Changelog | OpenAI API](https://developers.openai.com/api/docs/changelog) - It is available to API customers, subject to rate limits, with global processing and US data residen...

25. [Prompt caching | OpenAI API](https://developers.openai.com/api/docs/guides/prompt-caching) - Prompt caching pricing varies by model.
See API pricing for current cached-input and cache-write rat...

26. [Google's Gemini 4 Argon Launch Puts A Deadline On Its ...](https://finance.yahoo.com/technology/ai/articles/google-gemini-4-argon-launch-185007145.html) - A footnote in Google's announcement sets the expiration: after Nov. 30, the rate rises to $4 and $20...

27. [Gemini 4 Argon pricing: $2/$10 per 1M tokens intro, $4/$20 ...](https://apidog.com/blog/gemini-4-argon-pricing/) - Cached input is 95% off: $0.10 per 1M through November 30, then $0.20.
...
Cache hits cut the input ...

