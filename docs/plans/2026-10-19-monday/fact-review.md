# Monday fact-check readback and source review

19 October 2026. The run was expressly approved: "Approve the fourth paid v2 fact-check run".
The initial request with a 90-sentence cap was rejected before any model call because the API accepts at most 60 for that optional field. The approved run without that optional cap completed server-side after the client connection reset. Do not blindly retry it.

The saved result ran at 2026-10-19T17:49:56.602Z. Recorded cost: $0.35, versus the disclosed $0.10 last-run estimate. The CLI budget checks the previous run's cost; it is not a hard in-flight spending cap. No further paid run is authorised by this approval.

The fact gate remains closed: 14 blocking claim entries, with three existing signed-off entries leaving 11 unresolved. This document is evidence for resolution, not a gate override or a claimed pass.

## Primary-source review

- OpenAI's [live changelog](https://developers.openai.com/api/docs/changelog), checked in this session, explicitly puts the GPT-5.6 Sol price change under **Aug 21**. The gate's claim that only the month is given is incorrect.
- Anthropic's [live release notes](https://platform.claude.com/docs/en/release-notes/overview), checked in this session, record cache-read reductions for Fable 5.1 on **1 September**, and Sonnet 5.5 on **7 October**. These are different model families. The gate missed the September entry; the article does not say the same model changed twice.
- The six events counted by the article are: Anthropic's cancelled rise (10 August), OpenAI's promotion (21 August), Anthropic's new cache rate (1 September), Anthropic's cheaper new model (22 September), Anthropic's further cache rate (7 October), Google's introductory offer and scheduled expiry (13 October). This is the author's count of pricing decisions, not six increases and not six changes to one model.
- "Every one of those numbers has moved" is broad: the comparison mixes a scheduled Google increase, a cut to OpenAI's model, and a cheaper successor at Anthropic. Keep that distinction visible; it does not establish that all of today's models had their own price changed.

## Worked example

This is explicitly an illustrative workload, not a reported company's invoice. The arithmetic is:

- 100,000 requests × 10,000 input tokens = 1,000 million input tokens.
- 100,000 requests × 500 output tokens = 50 million output tokens.
- No reuse: 1,000 × $2 + 50 × $10 = $2,500; doubling both rates gives $5,000.
- Reuse: 200 million fresh input × $2 + 800 million reused input × $0.10 + 50 million output × $10 = $980; doubling each rate gives $1,960.
- Saving: 1 − 980 / 2500 = 60.8%, hence "about 60%" for this whole example bill. This is distinct from the 95% discount on eligible cached input.

The existing human sign-off says "yes, run it, the example is our own maths" and is attached to three amount sentences. It has not been silently extended to new claims.

## Extraction issues

The gate also treats the standalone list markers "1." and "3." as factual claims, and the presenter's first-person description of his reading as an externally sourced claim. These need a proper resolution in the gate, not another unexamined paid retry.

The video files are review outputs until the unresolved editorial and visual gates are complete. Their source recordings and signed-off scripts remain unchanged.

## Exact entries still requiring resolution

1. OpenAI, 21 August: "GPT-5.6 Sol now costs $4 per million input tokens and $20 per million output tokens."

2. And Anthropic has changed its reuse prices twice since the start of September, so the discount itself moves.

3. But I've spent the last week reading the price pages and release notes of the three big AI firms, and it's part of a pattern.

4. Count them with Google's and that's at least six moves in about ten weeks.

5. Three rivals, one price, and every one of those numbers has moved this year.

6. Three rivals, one price, and every one of those numbers has moved this year.

7. Say it sends 100,000 requests.

8. Each one carries 10,000 tokens in, 8,000 of them the same reused policy, and gets 500 tokens back.

9. Reuse saves about 60%.

10. 1.

11. 3.

