I've been using AI apps every day for years now, and I've started to notice something odd about how they're sold. Every launch is about a name. A new model, a new number, a livestream, a chart: Opus 4.8, Opus 5, Opus 5.5, and on it goes.

So I wanted to break down whether the name you pick actually changes the answer you get, and what happens when companies like OpenAI make more money by making products easier and less transparent. Isn't a lack of control over what you're getting a bit scarier when the product is general intelligence?

Some of the new models really are better, and the people building them aren't lying to you. But I think the name is the least important thing on the screen. The setting that changes your answer most has a boring label, the app usually starts it low, and most people leave it there. I also think I can see where this ends up: the AI itself will decide how hard it thinks. That's good news for people who want an easier experience, and good news for OpenAI and Anthropic. It's bad news in other ways.

## THE NAME GAME

Start with why your eyes are on the name at all, because while we watch the names, the setting that decides your answer gets chosen out of sight. Anthropic, which makes Claude, launched Claude Opus 4.8 in May, Claude Opus 5 in July and Claude Opus 5.5 in September, with Sonnet, Fable and Haiku versions alongside. OpenAI's release notes climb from GPT-5.1 last November to GPT-6.1 Sol at the end of September. OpenAI even says a model will "generally remain available in ChatGPT for 90 days after a successor is released." Ninety days, and then the next name takes over.

Nobody at these companies says they name models for the headlines, so read this part as my take on the evidence. Look at what a launch buys. In March 2025, after OpenAI added image making to ChatGPT, Sam Altman, who runs OpenAI, posted: "we added one million users in the last hour." The same day, OpenAI announced $40 billion of new funding, a raise reported as in the works since January. The launch gave it a very good backdrop.

The headline scores are drawn at full power, too. A footnote on Anthropic's Opus 5.5 page says that, unless it notes otherwise, "all Claude Opus 5.5 results use adaptive thinking at max effort." Anthropic's developer guide says Opus 5.5 defaults to medium, well below max. So the headline scores show the model thinking as hard as it can, which isn't what you get unless you ask for it.

My favourite example is a smaller one. In September, Anthropic's boss, Dario Amodei, wrote: "We must slow the pace at which we improve the capabilities of AI models." Over the next few weeks, Anthropic released Opus 5.5, Sonnet 5.5 and Haiku 5.5, and OpenAI released GPT-6.1 Sol. In fairness, he meant how fast AI gets smarter. How often it gets a new name is a separate thing, which is rather my point.

The progress underneath is real, but most of what we ask doesn't need the newest model. In OpenAI and Harvard's study of 1.5 million ChatGPT conversations, practical guidance, looking things up and writing made up "nearly 80%" of them. For those, I'd bet the name barely matters. What matters is the setting nobody is looking at, and who sets it.

## THE SWITCH THAT MATTERS

Picture a small business owner. Call her Sally. She pastes a supplier contract into her AI app and asks what she should worry about. It gives her a tidy, confident answer in four seconds. She signs. Six months later a clause bites her that a careful reader would have caught.

Nothing was wrong with the name at the top of her screen. What was missing is that the AI never stopped to think, and Sally didn't realise she should be controlling how hard it thought. ChatGPT and Claude both let you choose how hard the AI thinks. For now. At the low end it answers straight away. Higher up, it works through the problem first, checking itself before it replies.

Think of it as a car, where the name of the AI model, such as Claude Opus 5.5 or GPT-6.1 Sol, is the badge on the front. The thinking levels, such as ChatGPT's Instant, Medium, High and Extra High, or Claude's low, medium, high, xhigh and max effort, are the gears, and the setting in the app is the gearstick. Right now these apps are like cars with a manual transmission: you move the gearstick yourself, and the car stays in whatever gear you leave it in. A car with an automatic transmission changes gear for you. With AI, most of us argue about badges and drive everywhere in first.

What does "thinking" mean here? Before it answers, the AI writes out its working, and at most you see a short summary of it. It breaks the question into steps, tries more than one approach and checks its own answer. Without a web search, all that checking happens in its own working, so it can still be confidently wrong about a fact.

The size of the gear change surprised me. Artificial Analysis, an independent group that tests these models, ran the same Claude Opus 5.5 through its long set of hard tests at different settings. Thinking as hard as it can, it scored more than a third higher than when thinking a little. The older Opus 5, at its hardest, beat the new one at its lowest. OpenAI's GPT models showed the same: the gear moved the score more than the new badge did. OpenAI's own tests agree: on HealthBench Hard, a tough set of medical questions, GPT-5's fast version scored 25.5% and its thinking version 46.2%.

It isn't a straight line, though, and that matters for where this is heading. Each step up buys less than the one before. On Artificial Analysis's tests, moving Opus 5.5 from low to medium brought the biggest jump in its score, from 42 to 51. Going all the way to max took it to 58, while the cost per task went from $0.55 to $5.98. On every current model from Anthropic and OpenAI on those tests, the top setting costs several times more than the bottom one, and the score rises by a fraction of that. And the setting can beat the model. Claude Haiku 5.5, the cheapest of Anthropic's current models, scored 43.4 on its highest setting, edging past the 42.3 of Opus 5.5 on its lowest, for less than half the cost per task. Claude Sonnet 5.5 on its highest setting scored 56 against that 42.3, at about ten times the cost per task of Opus 5.5 on its lowest. Sometimes the new name really is the bigger step. On Anthropic's own chart for one test of computer tasks, Opus 5.5 at medium scored 57.6% for $2.94, against 52.3% for $15.83 from Opus 5 at max.

So the gear matters most on hard jobs, like Sally's contract. On easy ones, extra thinking is money set on fire. The interesting part is whose money.

## WHAT THINKING COSTS THEM

Every word of that hidden working costs computer time. That's why, on Artificial Analysis's tests, Opus 5.5 on max cost $5.98 per task.

That's also why a higher gear eats into your plan faster. Anthropic's help page for the Claude app says higher effort means responses "take longer and use more tokens, so you'll reach your usage limits faster."

Here's the twist. Whether that thinking makes OpenAI and Anthropic money or loses it depends on how you pay.

If you're a developer paying by the word, thinking is a sale. If you pay a flat monthly fee, every extra thought comes out of their pocket. In January 2025 Altman posted: "insane thing: we are currently losing money on openai pro subscriptions! people use it much more than we expected." That was the $200 Pro plan, sold on o1 pro mode, which OpenAI said used "more compute to think harder". In July 2025 Anthropic announced weekly limits, saying "one user consumed tens of thousands in model usage on a $200 plan." This month SemiAnalysis, a research firm, estimated that subscriptions are "just 10% of overall revenue" at Anthropic but take over 40% of the computing it spends answering people.

The margins that have been reported are company-wide, and they say answering you pays overall: Altman says "We're profitable on inference," meaning on the computing it takes to answer you. On a flat-fee plan, though, the hard-thinking answer is the expensive one. That, I think, is why the app starts you in a low gear. That's my read. Nobody has said it out loud.

## WHO DECIDES NEXT

The AI already decides more than you'd guess. Inside every gear, the model chooses how much to think. OpenAI's developer guide says its models "reason adaptively across reasoning efforts, using fewer tokens for simpler tasks and thinking harder for complex tasks." Anthropic's says the model "allocates reasoning where it judges reasoning will help."

The next step is the AI choosing the gear itself, like a car with an automatic transmission, and Google just took it. Since 9 October, the free Gemini app has started on "Auto". In Google's words: "Most prompts will go to Flash-Lite, our fastest model. Prompts that need deeper reasoning may go to Flash or Pro."

OpenAI has gone the other way. Its router, the hidden part of ChatGPT that changed gear for you, was pulled for free users in December 2025. WIRED reported it "seemed to send many more free users to OpenAI's advanced reasoning models, which are more expensive for OpenAI to serve." Then last month, OpenAI retired "automatic switching from Instant to Thinking" for Plus and Pro users, so on those plans you pick the gear.

I don't think that lasts. The badge sells: a new name buys headlines, sign-ups and a good backdrop for raising money, so they make sure you know it. The gears cost: on a flat fee, leave the gearstick with you and anyone can sit in top gear on every question, up to their plan's limit. Hand it to the AI, and OpenAI and Anthropic write the rules for how much thinking each question gets.

So, as I read it, OpenAI and Anthropic want your eyes on the badge and their own hand on the gearstick. And most people would rather not change gear at all. That's why I think the automatic wins.

## THE TRADE-OFFS

If I'm right, it's good news and bad news.

The case for the automatic is strong, because most people leave the gear where the app puts it. When GPT-5 started choosing for people in August 2025, Altman wrote that the share of free users using a thinking model each day went "from <1% to 7%", and for paying Plus users "from 7% to 24%". In March 2026 Anthropic moved Claude Code, its coding app, down to medium effort by default, and "most users retained the medium effort default." Anthropic called it "the wrong tradeoff" and changed it back. Whoever sets the default sets how hard most people's AI thinks. An AI that sets it question by question would at least think hard when the question is hard, and skip the waste on easy ones.

The case against is about what you can't see. In January 2026 OpenAI lowered ChatGPT's thinking time "as we observed users prefer faster responses", and by mistake turned down the extended setting as well. It was put back weeks later. Nobody looking at their screen would have known. An automatic built by OpenAI or Anthropic also answers to two bosses: your answer and their bill. And when it broke just after launch, Altman said GPT-5 "seemed way dumber".

So the real argument is about whose interest the decision serves, and whether you get to see it. In general, the incentive lies with the business to give you less control over what product you actually get. And when the product is intelligence, that's got some big impacts to consider.

## WHAT TO DO ABOUT IT

For quick, everyday stuff, leave it alone. A recipe or a summary of an email is fine in a low gear, and the name really doesn't matter.

For anything you'll act on, change the gear yourself. A contract, a medical question, money, a decision you can't take back. On ChatGPT, pick Medium or High. On Claude, turn the effort up. On ChatGPT's free plan, use Think. On Gemini, set the effort to high. It can take longer, sometimes minutes, and you'll hit your limit sooner. For the questions that matter, it's worth it.

If you build products on AI, don't choose a model by its name or its launch chart. Run your own hard questions through each setting, check the answers, and watch how much thinking you pay for.

There's a better way the apps could do this, and Formula 1 found it decades ago: the semi-automatic transmission. Ferrari brought in the paddle on its 640 in 1989. The driver changes gear with a paddle behind the steering wheel. Software that changed gear by itself was tried, and the FIA, which runs the sport, banned it for good in 2004, so the driver still picks the gear. Let the AI pick the gear, if it must, but give us the paddles, and a dashboard that shows which gear it picked and how hard it thought. I think that's where the paid plans end up: starting in automatic, with a semi-automatic setting for the people who want control.

We've just learned to drive the manual. I think the car is going automatic next, and for most people that's easier. But Formula 1 still keeps the paddles in the driver's hands, and some people who love driving still choose a manual transmission. For anything that matters, I'll be one of them.

## OUR PREDICTION

By 30 June 2027, ChatGPT will once again start free users on a setting where the AI chooses how hard to think for each message.

How sure we are: 85%.

We'd be wrong if, on that date, a new chat on ChatGPT's free plan still starts on a setting where you pick how hard it thinks, or the automatic option exists but you have to switch it on.
