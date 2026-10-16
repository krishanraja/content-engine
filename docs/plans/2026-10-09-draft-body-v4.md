I've been using AI apps every day for years now, and I've started to notice something odd about how they're sold. Every launch is about a name. A new model, a new number, a livestream, a chart. Opus 4.8, Opus 5, Opus 5.5 - when is Opus 5.56 coming out?!

So I wanted to break down whether the name you pick actually changes the answer you get.

Let me start by saying this: some of the new models really are better, and the people building them aren't lying to you. But I think the name is the least important thing on the screen. The setting that changes your answer most has a boring label, it's set to off by default, and almost nobody touches it. There are a few underlying reasons the AI businesses make you think about how hard AI thinks. Let's unpack them.

I also think I can see where this ends up. The AI itself will decide how hard it thinks, and that comes with real upsides and some costs worth knowing about.

## THE NAME GAME

Start with why your eyes are on the name at all, because while we watch the names, the setting that decides your answer gets chosen out of sight. Look at how often the names change. Anthropic, which makes Claude, launched Claude Opus 4.8 in May, Claude Opus 5 in July and Claude Opus 5.5 in September, with Sonnet, Fable and Haiku versions alongside. OpenAI's release notes climb from GPT-5.1 last November to GPT-6.1 Sol at the end of September. OpenAI even says a model will "generally remain available in ChatGPT for 90 days after a successor is released." Ninety days, and then the next name takes over.

Nobody at these companies says they name models for the headlines, so read this part as my take on the evidence. Look at what a launch buys. In March 2025, after OpenAI added image making to ChatGPT, Sam Altman, who runs OpenAI, posted: "we added one million users in the last hour." The same day, OpenAI announced $40 billion of new funding, a raise reported as in the works since January. The raise was already coming. The launch just gave it a very good backdrop. And when Anthropic raised $30 billion in February 2026, its announcement pointed to "Opus 4.6, launched last week".

The launch chart is drawn at full power, too. A footnote on Anthropic's Opus 5.5 page says "all Claude Opus 5.5 results use adaptive thinking at max effort." Anthropic's developer guide says Opus 5.5 defaults to medium, well below max. So the chart shows the model thinking as hard as it can, which isn't what you get unless you ask for it. The name gets the spotlight. How hard it thinks for you is decided somewhere quieter. The same page even admits that "benchmark margins have become a less reliable guide to real-world differences." (A benchmark is a standard test the labs score their models on.)

Leaderboards get played as well. When Meta launched Llama 4 in April 2025, it advertised its score on LMArena, a leaderboard where people vote between two answers. LMArena later said the version Meta tested "was a customized model to optimize for human preference".

My favourite example is a smaller one. In September, Anthropic's boss, Dario Amodei, wrote: "We must slow the pace at which we improve the capabilities of AI models." Over the next few weeks, Anthropic released Opus 5.5, Sonnet 5.5 and Haiku 5.5, and OpenAI released GPT-6.1 Sol and brought GPT-6 to ChatGPT. In fairness, he meant how fast AI gets smarter. How often it gets a new name is a separate thing, which is rather my point.

The progress underneath is real, by the way. METR, an independent group, found the length of task frontier AI can finish was "doubling around every 7 months" from 2019 to 2025. But most of what we ask doesn't need the frontier. In OpenAI and Harvard's study of 1.5 million ChatGPT conversations, practical guidance, looking things up and writing made up "nearly 80%" of them. For those, the name barely matters. What matters is the setting nobody is looking at, and who sets it.

## THE SWITCH THAT MATTERS

Picture a small business owner. Call her Sally. She pastes a supplier contract into her AI app and asks what she should worry about. It gives her a tidy, confident answer in four seconds. She signs. Six months later a clause bites her that a careful reader would have caught. (How many of us have signed something an AI waved through?)

Nothing was wrong with the name at the top of her screen. What was missing is that the AI never stopped to think. ChatGPT and Claude both let you choose how hard the AI thinks. At the low end it answers straight away. Higher up, it works through the problem first, checking itself before it replies. Think of the name as the badge on the car, and the thinking setting as its gears. Right now these apps are manual cars: you choose the gear. We argue about badges, and most of us drive everywhere in first.

I had to look up what "thinking" actually means here. Before it answers, the AI writes out its working, and at most you see a short summary of it. It breaks the question into steps, tries more than one approach and checks its own answer. OpenAI's developer guide says this helps its models "plan, use tools effectively, inspect alternatives, recover from ambiguity". If the app lets it search the web, a higher setting usually means more searching, too: Anthropic's guide says lower effort means "fewer and terser tool calls" (a tool call is the AI reaching for something like a web search). Without a search, all that checking happens in its own working. It re-reads what it wrote, so it can still be confidently wrong about a fact.

The size of the gear change surprised me. Artificial Analysis, an independent group that tests these models, ran the same Claude Opus 5.5 at different settings. Thinking a little, it scored 42 on their index. Thinking as hard as it can, 58. The older Opus 5, at its hardest, scored 51. OpenAI's GPT-6 Sol, the model behind ChatGPT's thinking setting, scored 29 with thinking off and 48 at its top developer setting, while the newer GPT-6.1 Sol topped out at 52. In both cases the gear moved the score more than the new badge did.

OpenAI's own tests agree. On HealthBench Hard, a tough set of medical questions, GPT-5 scored 25.5% answering straight away and 46.2% thinking first. Anthropic wrote in April: "In general, the longer the model thinks, the better the output."

It isn't a straight line, though, and that matters for where this is heading. Each extra bit of thinking helps a little less than the last. On Hex's data-analysis test, GPT-6 Sol scored 61.3% on its Xhigh setting and 57% on Max, for more money. Thinking can be pure waste, too: researchers asked reasoning models "what is the answer of 2 plus 3?" and found they "consumed 1,953% more tokens than conventional models to reach the same answer." (Tokens are the word pieces an AI reads and writes, and what developers pay for.) One wrote out 13 solutions. And sometimes the new name really is the bigger step. Anthropic says Opus 5.5 on its default setting "beats Opus 5 at max effort for about a fifth of the cost" on one test of computer tasks.

So the gear matters most on hard jobs, like Sally's contract. On easy ones, extra thinking is money set on fire. The interesting part is whose money.

## WHAT THINKING COSTS THEM

When an AI thinks, it writes out its working behind the scenes, and every word of that costs computer time. Artificial Analysis found GPT-5 on its high setting wrote 82 million tokens to get through their tests, against 3.5 million on minimal. Claude Opus 5.5's hardest-thinking run cost $5.98 per task, against $0.55 on low.

Here's the twist. Whether that thinking makes them money or loses it depends on how you pay.

If you're a developer paying by the word, thinking is a sale. OpenAI's rate card for business customers even prices it by the gear: Instant is unlimited, Medium, High and Extra High cost "10 credits per message", and Pro costs "50 credits per Chat message".

If you pay a flat monthly fee, every extra thought comes out of their pocket. In January 2025 Altman posted: "insane thing: we are currently losing money on openai pro subscriptions! people use it much more than we expected." That was the $200 plan built around OpenAI's thinking model. In July 2025 Anthropic added weekly limits after "one user consumed tens of thousands in model usage on a $200 plan." This month SemiAnalysis, a research firm, estimated that subscriptions are "just 10% of overall revenue" at Anthropic but "can take up over 40% of inference compute" (inference is the computing it takes to answer you).

I wanted the margin on a hard-thinking answer against a quick one. Neither OpenAI nor Anthropic publishes it. I looked. What's been reported is company-wide. Fortune, reporting The Information, said OpenAI's "compute margin", what's left of paying users' money after running the models, reached 70% in October 2025. Axios reported that Anthropic's margins swung "from -94% in 2024 to about +40% in 2025". Altman says "We're profitable on inference." So overall, answering you pays. On a flat-fee plan, though, the hard-thinking answer is the expensive one.

That, I think, is why the app starts you in a low gear. That's my read. Nobody has said it out loud.

## WHO DECIDES NEXT

The AI already decides more than you'd guess. Inside every gear, the model chooses how much to think. OpenAI's developer guide says its models "reason adaptively across reasoning efforts, using fewer tokens for simpler tasks and thinking harder for complex tasks." Anthropic's says the model "allocates reasoning where it judges reasoning will help."

The next step is the AI choosing the gear itself, like an automatic car, and Google just took it. Since 9 October, the free Gemini app has started on "Auto". In Google's words (a prompt is whatever you type in): "Most prompts will go to Flash-Lite, our fastest model. Prompts that need deeper reasoning may go to Flash or Pro."

OpenAI has gone the other way, twice. Its router, the hidden part of ChatGPT that changed gear for you, was pulled for free users in December 2025. WIRED reported it "seemed to send many more free users to OpenAI's advanced reasoning models, which are more expensive for OpenAI to serve." Then on 14 September 2026, OpenAI retired "automatic switching from Instant to Thinking" for Plus and Pro users, without giving a reason. On those plans, you pick the gear.

I don't think that lasts. Here's my read of why: each part of the car is worth something different to OpenAI and Anthropic.

The badge sells. In my view a new name buys attention. Launches come with headlines, sign-ups and a good backdrop for raising money, as the ones above suggest. So OpenAI and Anthropic make sure you know the name, and Anthropic's launch chart shows Opus 5.5 in top gear.

The gears cost. On a flat monthly fee, every time you put the AI in a higher gear, OpenAI or Anthropic pays. Leave the gearstick with you, and anyone can sit in top gear on every question for the same flat fee. Those $200 plans show how costly the heaviest users already are. Hand it to the AI, and OpenAI and Anthropic write the rules for how much thinking each question gets. Set those rules too generously and it costs them. WIRED's reporting suggests that may be part of why OpenAI pulled its router for free users, though OpenAI said those users preferred to stay on the default.

That's what OpenAI and Anthropic gain from keeping your eyes on the name. While you compare badges, you don't ask which gear you were given, so a launch chart can show top gear while the app starts you lower down.

So, as I read it, OpenAI and Anthropic want your eyes on the badge and their own hand on the gearstick. And most people would rather not change gear at all. That's why I think the automatic wins.

## THE TRADE-OFFS

If I'm right, it's good news and bad news.

The case for the automatic is strong, because most people leave the gear where the app puts it. When GPT-5 started choosing for people in August 2025, Altman wrote that the share of free users using a thinking model each day went "from <1% to 7%", and for paying Plus users "from 7% to 24%". Anthropic learned the same lesson. In March 2026 it moved Claude Code, its coding app, down to medium effort by default, to cut long waits and because "it helped maximize users' usage limits". Users said it felt less intelligent. Even after Anthropic nudged them, "most users retained the medium effort default." Anthropic called it "the wrong tradeoff" and changed it back. Whoever sets the default sets how hard most people's AI thinks. An AI that sets it question by question would at least think hard when the question is hard, and skip the waste on 2 plus 3.

The case against is about what you can't see. In January 2026 OpenAI lowered ChatGPT's thinking time "as we observed users prefer faster responses", and by mistake turned down the extended setting as well. It was put back weeks later. Nobody looking at their screen would have known. An automatic built by OpenAI or Anthropic also answers to two bosses: your answer and their bill. OpenAI said its router was "continuously trained on real signals", and when it broke just after launch, Altman said GPT-5 "seemed way dumber". If you build on these models, the cost stops being yours to set. Anthropic's guide says effort "doesn't guarantee a token count", and "You are billed for the full thinking process, not the thinking content visible in the response."

So the real argument is about whose interest the decision serves, and whether you get to see it.

## WHAT TO DO ABOUT IT

For quick, everyday stuff, leave it alone. A recipe or a summary of an email is fine in a low gear, and the name really doesn't matter.

For anything you'll act on, change the gear yourself. A contract, a medical question, money, a decision you can't take back. On ChatGPT, pick Medium or High. On Claude, turn the effort up. On ChatGPT's free plan, use Think. On Gemini, set the effort to high. It costs you a few more seconds, and you'll hit your limit sooner. For the questions that matter, it's worth it.

If you build products on AI, don't choose a model by its name or its launch chart. Run your own hard questions through each setting, check the answers, and watch how much thinking you pay for.

There's a better way the apps could do this, and Formula 1 found it decades ago: the semi-automatic. Ferrari brought in the paddle on its 640 in 1989, and by 1996 every team had followed. The driver changes gear with a paddle behind the steering wheel, and no longer has to work the clutch for each change. Software that changed gear by itself was tried, and the FIA, which runs the sport, banned it for good in 2004, so the driver still picks the gear. Let the AI drive, if it must, but give us the paddles, and a dashboard that shows which gear it picked and how hard it thought. Then you'd know when to take over.

We've just spent two years learning to drive a manual: which gear to pick, and when to change it. I think the car is going automatic next, and for most people that's easier. But Formula 1 still keeps the paddles in the driver's hands, and some people who love driving still choose a manual. For anything that matters, I'll be one of them.

## OUR PREDICTION

By 30 June 2027, ChatGPT will once again start Plus users on a setting where the AI chooses how hard to think for each message. How sure we are: 85%. We'd be wrong if, on that date, OpenAI's help page for Plus still says Instant won't switch to Thinking on its own, or the automatic option exists but you have to switch it on.
