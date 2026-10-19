Google told everyone. It's right there in a footnote.

When Google launched its newest AI, Gemini 4 Argon, on 13 October, it called the price "introductory". Then came the footnote: "After the introductory period expires on November 30, 2026, the price of $4 per 1M input tokens and $20 per 1M output tokens will apply." That's double.

So nobody's hiding anything. But I've been reading the small print, and there's a twist most people will miss. There's a trick that makes a big chunk of your AI bill about 95% cheaper. Lots of businesses are counting on it to protect them. It won't stop the doubling.

So what does a doubling really do to your bill, and what should you check now?

## WHAT CHANGES ON 1 DECEMBER

AI companies charge by the token, which is roughly a short word. You pay for the words you send in, and for the words the AI sends back. "Thinking" counts as words sent back, even though you never see it.

Here's Google's own price list for Argon, per million tokens:

- Words in: $2 now, $4 from 1 December.
- Words in that it has already read: 10 cents now, 20 cents from 1 December.
- Words out, thinking included: $10 now, $20 from 1 December.

Every line doubles. Google's launch post says the new price "applies to the Argon model intended for public access only". So if you pay the public rate, this is your price. If you signed a deal with Google, your contract decides. More on that at the end.

## THE PART THAT IS 95% CHEAPER

Most business AI repeats itself. A customer-help bot sends the same long rulebook with every single question. A contract tool sends the same contract each time someone asks about it. The question changes. The big block in front of it doesn't.

It's like a photocopier. Every customer who walks in gets handed the same 40 pages before their one-line question. Google's AI can now spot when it's been handed those same pages a moment ago, and it charges you a fraction for them. Engineers call this caching. I'll just call it reuse.

The fraction is small. Google's launch post calls it "95% off". The price list backs that up: 10 cents against $2 today, 20 cents against $4 from December. That's a twentieth of the normal price.

Two catches. It's automatic, but only when it works: the repeated part has to come first, the request has to be long enough, and the copies have to arrive close together. And you only know it's working if someone checks the usage figures Google sends back.

## WHY REUSE DOES NOT STOP THE DOUBLING

Here's where people get caught out. Reuse makes your bill much smaller. Then the smaller bill doubles too.

Let me show you with one made-up month. Say a business sends 100,000 requests. Each one carries 10,000 tokens in, 8,000 of them the same reused block, and gets 500 tokens back.

- Without reuse: $2,500 a month now. $5,000 from December.
- With reuse: $980 a month now. $1,960 from December.

Reuse saves you about 60% either way. That's a big deal. But look at the jump. $980 becomes $1,960. If your budget for next year was built on the launch price, it's wrong by half, whichever side of the line you're on.

And notice what's left once the reuse is working. In that example, the words coming back cost more than everything going in. Words out cost five times words in. So a business that thinks it's safe because it reuses is now mostly paying for answers and thinking, and those double as well.

## WHERE THE MONEY MOVES

Follow the money from your business to Google.

**Squeezed hardest:** anyone on the public rate who reuses very little. Short one-off questions, different every time. They get the full doubling on the full bill.

**Squeezed on margin:** anyone selling a fixed-price product built on Argon. Picture a founder who sells a customer-help bot for a flat monthly fee. Their cost doubles on 1 December. Their customers' price doesn't. That gap comes straight out of their margin.

**Safe, maybe:** businesses with a contract that fixes the price. But only if it really says so. Sanchit Vir Gogia, chief analyst at Greyhound Research, told Computerworld that Google Cloud's standard terms allow fee changes unless a price is expressly agreed.

And Google? My read, and it is my read: the launch price was there to get people building. Once your rulebook, your prompts and your tools are set up around one AI, moving costs time and money. From 1 December, Argon costs exactly what Anthropic charges for Claude Opus 5.5, $4 in and $20 out. So December is when Argon is priced like its rivals, after people have already moved in.

## IS A CHEAPER MODEL WORTH IT?

The obvious move is to drop down to something cheaper. Sometimes that's smart. Often it isn't.

Gogia put it better than I can: "Cheap per token and cheap per task are different claims, and only the second one reaches the budget." A cheaper AI that needs three tries, or thinks for twice as long, or gets the answer wrong and needs a person to fix it, can cost you more for the same job.

So test it on your real work first. Take ten jobs your AI does every week, run them on the cheaper option, and count the cost per finished job, including the fixes.

There's a cheaper route inside Google too. Its Batch and Flex options cost half the standard price, both now and after December. They suit work that can wait, like overnight reports, and they don't suit a customer waiting on a reply.

Now for my call. If lots of customers start switching down in November, Google has a reason to blink. That's the bold bet.

So my prediction is that Google keeps Argon's $2 and $10 price past 30 November, or announces a new discount on it, before 1 December. That's a long shot. The footnote is public and Google has every reason to stick to it.

How sure we are: 15%.

## YOUR CONTRACT, THEN MONDAY'S TWO QUESTIONS

If you signed a deal with Google, dig it out and find the bit about price. It'll either fix the price or point at Google's public price list, and it'll say from when. While you're in there, find which email address gets Google's notices about changes. I'd bet someone left the company and nobody reads it.

Then on Monday, find whoever runs your AI, inside your company or at a supplier. Ask them how much of what you send to Google's AI is reused. Then ask whether your contract fixes the price, or follows Google's public rate from 1 December.

That's it. Don't renegotiate yet. Get the two answers first, and you'll know which side of the line you're on before the bill tells you.

If someone you work with runs on Google's AI, send them this before December does.
