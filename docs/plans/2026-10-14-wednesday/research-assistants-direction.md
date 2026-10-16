# Where personal AI assistants are going: Meta, OpenAI, Google, Anthropic, Apple

Researched 13 October 2026. Primary sources only, unless a bullet is marked **[secondary]**. Quotes are copied exactly from the page text as fetched on 13 Oct 2026. "Date" is the page's own publication date. Pages that were updated after they were published are noted.

---

## Meta: Muse

**1. Where Meta says it is going**
- "Meta thinks personal superintelligence will be one of the most transformative technologies of a lifetime. Muse is a first step: an agent that takes on more of the work so people can focus on what matters to them." Source: https://about.fb.com/news/2026/09/introducing-muse/ (Meta Newsroom, 8 Sep 2026, updated 30 Sep 2026)
- "As soon as we started using it, we saw the glimmers of real personal superintelligence — an agent that knows you, actually does things, works in the background, launches swarms of subagents, builds its own tools, and edits itself." Source: https://security.muse.ai ("How We Built Safety Into Muse", Tarek Sheasha, VP, Meta Superintelligence Labs, 8 Sep 2026)

**2. What it does for you, and what needs your approval**
- "It can handle tasks, like sending an email or booking travel ... It can open a browser, fill out forms, and negotiate on their behalf." Source: https://about.fb.com/news/2026/09/introducing-muse/ (8 Sep 2026)
- "For tasks that take more time, Muse keeps working after people close the app, and comes back when something changes or when it needs approval, like before it sends an email or makes a purchase." Source: same (8 Sep 2026)
- "When it comes time to pay, Muse can checkout with Link built by Stripe ... Link's wallet for agents generates a one-time-use card so your real card details stay hidden". Source: same (8 Sep 2026)
- "A separate Sentinel agent runs on that same machine, kept apart from Muse at the system level. Nothing Muse does reaches the internet unless the Sentinel approves it, and it asks the person for permission when needed." Source: same (8 Sep 2026)
- "Muse checks with the person before sensitive actions like sending an email or making a purchase." Source: same (8 Sep 2026)
- "It also has access to a full web browser, so it can search, navigate sites, fill out forms, and complete transactions, like booking and purchasing." Also: "the default allows for standard browsing of the web and stops for anything hard to undo." Source: https://introducing.muse.ai ("How We Designed Muse", Mona Sarantakos with Christine Awad, September 2026)

**3. Privacy**
- Where it runs: "Muse runs on its own dedicated computer in the cloud, contained so no one else's agent can reach it. That is where Muse lives and where the data and credentials for any service a person connects are securely stored." Source: https://about.fb.com/news/2026/09/introducing-muse/ (8 Sep 2026)
- Can Meta read it today? Yes. "Today's Muse architecture isolates each user's data from each other and keeps it secure. It restricts access to your data by Meta personnel through operational policies. It does not prevent Meta from accessing data when necessary to support, secure or operate the service." Source: https://security.muse.ai (8 Sep 2026)
- Training is on by default, with an opt-out: "these trajectories are sanitized to remove key personally identifiable information before being used in training. We think this is a good default ... If you do not want your data to be used in model training at all, you can opt-out via a simple switch in Muse settings." Source: https://security.muse.ai (8 Sep 2026)
- Ads: "Muse doesn't share a person's conversations or the data in their VM with Meta's ad systems." Source: https://about.fb.com/news/2026/09/introducing-muse/ (8 Sep 2026)
- The planned "Meta can't read it" mode: "Later this year, Meta will introduce Muse Confidential VM, where the whole VM, including a person's data and conversations with Muse, is encrypted with a key only they hold, so not even Meta can access it." Source: https://about.fb.com/news/2026/09/introducing-muse/ (8 Sep 2026)
- "Muse Confidential VM is intended to cryptographically and verifiably prevent Meta from accessing data in your VM. We're already using this system with a small group of trusted testers, and we've begun making our design and the source code for this system available to external auditors." Source: https://security.muse.ai (8 Sep 2026)
- The page does not say which plans will get Confidential VM.

**4. Price of the tier that does background agent work**
- Free tier: "It's free for most of what people need, with subscription plans for people who want to do more." Source: https://about.fb.com/news/2026/09/introducing-muse/ (8 Sep 2026)
- The help page lists "Power plan ($20/month)" with "500M Muse tokens per week" and "Maximum plan ($100/month)" with "3B Muse tokens per week". It also says "Muse is available for free with a usage limit" and "Muse and Muse subscriptions are in limited testing and aren't available in all locations yet." Source: https://www.meta.com/help/subscriptions/1021145227643680/ ("About Muse subscriptions", no date on the page; text read with the WebFetch tool). Background work is also available on the free tier.

---

## OpenAI: ChatGPT dots and ChatGPT Work

**1. Where OpenAI says it is going**
- "**Give everyone on Earth a personal AGI**, empowering them to benefit from one of humanity's most transformative technologies in whatever way they choose." Source: https://openai.com/index/built-to-benefit-everyone-our-plan/ ("Built to benefit everyone: our plan", Sam Altman and Jakub Pachocki. The page fetch did not show a date. The openai.com search index dates it 8 Jun 2026.)
- "Dots are remarkably capable, always-on agents built to handle everything." Also: "Over time, we envision teams of dots working together on your behalf." Source: https://openai.com/index/introducing-dots/ (29 Sep 2026, DevDay)
- **[secondary]** Internal document "ChatGPT: H1 2025 Strategy" (late 2024), made public in discovery in the US Department of Justice's case against Google: "One that knows you, understands what you care about, and helps with any task that a smart, trustworthy, emotionally intelligent person with a computer could do." The document calls this a "super-assistant". Source: https://9to5mac.com/2025/06/02/openai-is-coming-for-your-iphone/ (2 Jun 2025, citing The Verge)

**2. What it does for you, and what needs your approval**
- "Dots can do nearly anything using their own cloud computer, their own browser, and the apps you've connected." Source: https://openai.com/index/introducing-dots/ (29 Sep 2026)
- "an early tester's dot noticed he'd forgotten to invoice a publication, prepared the invoice, and sent it after his approval." Source: same
- Background research is read-only: "It does this by using the apps you've already connected with tools that are restricted to be read-only, which means that they can't send messages, change app content, or control your browser or computer." Source: same
- "Dots start with built-in rules for when to act independently and when to ask for approval. Custom Rules let you allow specific actions, require approval, or block them." Also: "Certain sensitive tasks, such as changing a password, always stay with you." Source: same
- "Before your dot takes an action that could affect your accounts or share information, an automatic review checks it against your instructions, permissions, custom rules, and built-in safety requirements. The review determines whether the action can proceed, needs your approval, or includes a step you must do yourself." Also: "Asking your dot to draft replies doesn't give it permission to send them." Source: https://developers.openai.com/codex/dots/controls ("Control your dot", fetched 13 Oct 2026)
- "Powered by GPT-6 Astra, your dot lives in the cloud and has its own computer and browser. You can reach it and it can keep working even when your computer is off." Source: https://developers.openai.com/codex/dots ("Meet dots", fetched 13 Oct 2026)

**3. Privacy**
- Where it runs: "Each dot works on its own cloud computer, while your computer and its contents stay separate unless you choose to connect it." Source: https://openai.com/index/introducing-dots/ (29 Sep 2026)
- Encryption is the standard kind, at rest and in transit. OpenAI does not say it cannot read the data: "ChatGPT's built-in protections include encryption for your content while it is stored and while it travels between you, OpenAI, and our service providers, along with access controls that help protect stored information." Source: https://openai.com/index/how-we-build-safety-security-and-privacy-into-dots/ (dots safety post, published alongside the 29 Sep 2026 launch)
- Training on personal plans: "For personal ChatGPT plans, you control whether your dots' conversations and the work they carry out are used to improve our models, through your "Improve the model for everyone" setting. When model training is enabled, this can include actions dots take, and automations you set up, after we work to remove personal identifiers." Source: same
- "We don't use content from ChatGPT Business, Enterprise, or Edu workspaces to improve our models by default." Also: "We don't train directly on proactive research or your dot's notes to itself." Source: https://openai.com/index/introducing-dots/ (29 Sep 2026)
- How to opt out: "When Improve the model for everyone is off, your new conversations won't be used to train OpenAI models." Source: https://help.openai.com/en/articles/7730893-data-controls-in-chatgpt (help article, fetched 13 Oct 2026). OpenAI says Business, Enterprise and Edu are excluded "by default". It does not say the same for personal plans, so on personal plans training is on unless you switch it off.
- Signal of an "OpenAI can't read it" mode: "Our long-term roadmap includes advanced security features designed to keep your data private, including client-side encryption for your messages with ChatGPT. We believe these features will help keep your private conversations private and inaccessible to anyone else, even OpenAI." Source: https://openai.com/index/fighting-nyt-user-privacy-invasion/ (OpenAI, November 2025, written in response to the New York Times lawsuit). This is a roadmap item. No date has been given and nothing has shipped. It also does not mention agents.

**4. Price of the tier that does background agent work**
- "Dots are rolling out today in ChatGPT to Pro and Business Premium users in eligible markets." Also: "Your first dot is included in your Pro or Business Premium plan at no extra cost." Source: https://openai.com/index/introducing-dots/ (29 Sep 2026)
- Pro: "From $100 /month" ... "Plans at $100, $200, or $500 USD per month". Plus is "$20 /month". Source: https://developers.openai.com/codex/pricing (fetched 13 Oct 2026)
- Dots eligibility: "Pro 100, Pro 200, and Pro 500: For users over 18 outside the European Economic Area, United Kingdom, and Switzerland." Source: https://developers.openai.com/codex/dots (fetched 13 Oct 2026)

---

## Google: Gemini Spark, Gemini in Chrome, Private AI Compute

**1. Where Google says it is going**
- "All of today's updates get us closer to our vision of a truly universal assistant that's personal, proactive and powerful." Source: https://blog.google/innovation-and-ai/products/gemini-app/next-evolution-gemini-app/ (Google I/O, 19 May 2026)
- "Spark represents a big shift for Gemini, transforming it from an assistant that can answer your questions into an active partner that does real work on your behalf and under your direction." Source: same (19 May 2026)

**2. What it does for you, and what needs your approval**
- "because it is a cloud-based agent, Spark keeps working in the background even when you close your laptop or lock your phone." Source: same (19 May 2026)
- "Spark operates under your direction. You choose whether to turn it on and what apps it connects to, and it's designed to ask you first before performing high-stakes actions like spending money or sending emails." Source: same (19 May 2026)
- "Gemini is designed to ask for your review and confirmation before it completes certain actions, such as: Sending communications, modifying your data, making purchases, and submitting web forms." Source: https://support.google.com/gemini/answer/17094507 (Gemini Spark help page, fetched 13 Oct 2026)
- "If a schedule runs when you are offline, you may not be able to stop Gemini from completing an unintended action." Also: "Gemini can perform bulk actions on private tasks in Google Tasks without your confirmation." Source: same
- Browsing: "It might also use a remote browser (which is a separate, new browser instance, not your local browser in the cloud)." Source: same
- Chrome: the Google AI Pro plan lists "Access Chrome auto browse to help complete tasks for you", and Ultra lists "Highest access to Chrome auto browse". Source: https://gemini.google/overview/agent/spark/ (plans page, fetched 13 Oct 2026)

**3. Privacy**
- Gemini Spark (the agent that acts) runs in Google's normal cloud, not in Private AI Compute. To use it you must "Have Keep Activity on". Source: https://support.google.com/gemini/answer/17094507 (fetched 13 Oct 2026). None of Google's Spark pages mention Private AI Compute.
- Training and human review: "Human reviewers (including trained reviewers from our service providers) review some of the data we collect for these purposes. Please don't enter confidential information that you wouldn't want a reviewer to see or Google to use to improve our services, including machine-learning technologies." Source: https://support.google.com/gemini/answer/13594961 (Gemini Apps Privacy Hub, fetched 13 Oct 2026)
- Opting out: with Keep Activity off, "Your future chats won't appear in your Activity, and won't be used to train our AI models, unless you choose to send Google feedback. Future chats are still saved for 72 hours". Source: same. Because Spark requires Keep Activity on, turning it off also means giving up Spark.
- "Chats reviewed by human reviewers ... are not deleted when you delete your activity. Instead, they are retained for up to three years." Source: same
- Private AI Compute is Google's sealed cloud: "ensuring your personal data stays private to you and is not accessible to anyone else, not even Google." Also: "sensitive data processed by Private AI Compute remains accessible only to you and no one else, not even Google." Source: https://blog.google/innovation-and-ai/products/google-private-ai-compute/ (11 Nov 2025). The products it named at launch are Pixel features: "Magic Cue" and "Recorder", not an agent that acts.
- The next step for Private AI Compute: "Today, we are sharing how we will bring private, server-side memory to our Private AI Compute platform ... the cryptographic keys required to unlock it are held exclusively on your personal devices — ensuring your data is inaccessible to anyone else, even Google." The post also says: "AI is becoming more capable and intuitive — remembering what matters, understanding the world around you, and acting at your direction." Source: https://deepmind.google/blog/advancing-private-ai-compute-with-secure-server-side-memory/ (23 Sep 2026). This is described as planned ("will enable"). No ship date is given.

**4. Price of the tier that does background agent work**
- Spark requires a "Google AI Pro or Ultra subscription". Source: https://support.google.com/gemini/answer/17094507 (fetched 13 Oct 2026)
- Google AI Pro is "$19.99/ month". Google AI Ultra is "$99.99/ month: 5x higher usage limits vs. AI Pro" and "$199.99 / month: 20x higher usage limits vs. AI Pro". Source: https://gemini.google/overview/agent/spark/ (fetched 13 Oct 2026)
- At launch, Spark was "planning to roll it out as a Beta for U.S. Google AI Ultra subscribers next week." Source: blog.google (19 May 2026). It has since widened to Pro, according to the help page above.

---

## Anthropic: Claude (Cowork merged into Claude), computer use

**1. Where Anthropic says it is going**
- Product direction: "Bring a quick question, or hand over a report due at noon, and Claude takes it from there, even after you've closed your laptop." Source: https://claude.com/blog/cowork-is-now-claude (16 Sep 2026)
- "Cowork is where you hand Claude a task, and it works across your files, calendar, email, messaging app, the web, and the other tools you connect until the job is done." Source: https://claude.com/blog/cowork-web-mobile (7 Jul 2026)
- I found no Anthropic CEO statement or official post framing a consumer "super assistant" or "personal superintelligence". The CEO's frame is "We could summarize this as a "country of geniuses in a datacenter."" Source: https://darioamodei.com/essay/the-adolescence-of-technology (Dario Amodei essay. The page header shows it was last modified 11 Oct 2026.) That essay warns about AI systems "much more embedded in and aware of people's daily lives".

**2. What it does for you, and what needs your approval**
- "Scheduled tasks now run with no device online. Set Monday's client prep for 6 am: Claude works through the email threads, transcripts, and recent news, builds the briefing doc, and leaves the follow-up email drafted but unsent." Also: "Nothing ships until you've reviewed and approved it." Source: https://claude.com/blog/cowork-web-mobile (7 Jul 2026)
- "By default, Claude asks before taking an action. If you'd rather let it keep working and check in only when something needs a closer look, you can turn that on. You keep the final say." Source: https://claude.com/blog/cowork-is-now-claude (16 Sep 2026)
- "In "Automatically approve" mode, Claude still reviews each action for safety before it runs; in "Skip all approvals," nothing checks its actions ... Claude always asks before permanently deleting files, in any mode." Source: https://support.claude.com/en/articles/13364135 ("Use Claude Cowork safely", fetched 13 Oct 2026)
- "It opens browsers for web tasks and takes over your screen only when it has to." Source: https://claude.com/product/cowork (fetched 13 Oct 2026)
- Anthropic's pages describe documents, research, email drafts, browser use and computer use. I found no Anthropic page that names buying or booking as a feature.

**3. Privacy**
- Where it runs: "Cowork tasks run in the cloud: Claude's work runs in an isolated, temporary environment on Anthropic's servers." Source: https://support.claude.com/en/articles/13364135 (fetched 13 Oct 2026)
- "On October 6, 2026, new Cowork tasks on Pro and Max plans run in the cloud. The Only on your computer option ... was removed." Also: "Whether your conversations are used to improve Claude follows the Help improve our AI models setting". Source: https://support.claude.com/en/articles/15520349-use-claude-cowork-on-web-desktop-and-mobile (fetched 13 Oct 2026)
- Training is a choice the user makes, not a default: "We're now giving users the choice to allow their data to be used to improve Claude". Also: "After October 8, you'll need to make your selection on the model training setting in order to continue using Claude." And: "We are also extending data retention to five years, if you allow us to use your data for model training ... If you do not choose to provide your data for model training, you'll continue with our existing 30-day data retention period." Source: https://www.anthropic.com/news/updates-to-our-consumer-terms (28 Aug 2025)
- Anthropic restricts staff access by policy, not by cryptography: "By default, Anthropic employees cannot access your conversations unless: You explicitly consent to share your data with us as a part of giving us feedback ... Review is needed to enforce our Usage Policy." Source: https://privacy.claude.com/en/articles/10458704-how-does-anthropic-protect-the-personal-data-of-claude-ai-users (fetched 13 Oct 2026)
- Signal of an "Anthropic can't read it" mode: "we're building systems designed to help ensure your sensitive data remains encrypted everywhere except for the exact moment it needs to be processed—and even then, only within a highly restricted, verifiable environment." The same post also says: "This is just a sketch of our research to start a conversation; we're still early in this work and it is too soon to forecast how it will evolve into specific designs or features we might offer in the future." Source: https://www.anthropic.com/research/confidential-inference-trusted-vms (18 Jun 2025). This is research. No product or date has been announced.

**4. Price of the tier that does background agent work**
- "It's rolling out on Pro and Max plans over the next few weeks, with more plans to follow." Source: https://claude.com/blog/cowork-is-now-claude (16 Sep 2026)
- Pro costs "$17 Per month with annual subscription discount ($200 billed up front). $20 if billed monthly." Max is "From $100" with "5x or 20x more usage than Pro". Source: https://claude.com/pricing (fetched 13 Oct 2026)

---

## Apple: Siri AI, Apple Intelligence, Private Cloud Compute

**1. Where Apple says it is going**
- "With powerful new features and unrivaled privacy protections, Siri remains the world's most private digital assistant, backed by a bold architecture that allows Apple to deliver innovative new features with privacy and security at their core." Source: https://www.apple.com/newsroom/2026/09/siri-ai-a-profoundly-more-capable-and-personal-assistant-is-here/ (14 Sep 2026)
- "a dramatically more capable and conversational assistant designed to help users find information and get things done throughout the day" (Craig Federighi). Source: https://www.apple.com/newsroom/2026/06/apple-introduces-siri-ai-a-profoundly-more-capable-and-personal-assistant/ (WWDC, 8 Jun 2026)

**2. What it does for you, and what needs your approval**
- "With even more systemwide app actions, Siri AI lets users get things done across apps, like drafting an email from scratch, or editing and sharing a set of photos." Source: Apple Newsroom (8 Jun 2026)
- Siri AI finds things across personal data: "users can ask Siri to find a restaurant recommendation a friend messaged them about, surface a hotel confirmation number from an old email". Source: same
- Apple's releases describe actions inside apps through App Intents. They describe no cloud browser, no background agent running while your devices are off, and no buying or booking on the web. I found no Apple statement about approval prompts.
- Status: "Siri AI begins rolling out today in beta in English". Also: "Siri AI will not be available initially in the EU on iOS, iPadOS, and watchOS." Source: Apple Newsroom (14 Sep 2026)

**3. Privacy**
- "When Private Cloud Compute is handling users' requests, their personal data is not stored nor made accessible to Apple or anyone else. Outside experts can continue to verify this privacy promise at any time." Source: Apple Newsroom (8 Jun 2026, repeated 14 Sep 2026)
- "These new capabilities are powered by the next generation of Apple Foundation Models, custom-built in collaboration with Google and its Gemini models". Also: "These latest models run on device and on servers using Private Cloud Compute." Source: Apple Newsroom (14 Sep 2026)
- "Siri AI uses the system orchestrator to tap into core capabilities like the Spotlight index and App Toolbox, which work entirely on device to keep users in control of their data." Source: same
- Private Cloud Compute's design rule: "This data must never be available to anyone other than the user, not even to Apple staff, not even during active processing." Source: https://security.apple.com/blog/private-cloud-compute/ (10 Jun 2024)
- Training is opt-in: "Apple does not use our users' private personal data or user interactions when training our foundation models unless users explicitly choose to help improve them." Source: https://www.apple.com/legal/ai-regulations/training-data/ (9 Sep 2026)

**4. Price**
- Apple publishes no paid tier. Siri AI comes with supported devices. "Certain Apple Intelligence features that rely on server-side models are subject to daily usage limits, including but not limited to Siri AI". Source: Apple Newsroom (14 Sep 2026)

---

## Is a "company can't read it" agent that acts already available?

**No company offers this today.** None of the five offers an agent that books, buys or sends inside an environment the company says it cannot read, on any plan, free or paid.

- **Meta: not yet. Promised for "later this year".** Today's Muse acts (books, buys through Link, sends email), but Meta says the current design "does not prevent Meta from accessing data when necessary to support, secure or operate the service" (security.muse.ai, 8 Sep 2026). Muse Confidential VM ("so not even Meta can access it") is "later this year", is with "a small group of trusted testers", and is in external audit. No plan or price has been stated. If it ships, Meta will be the first of the five to put an agent that acts behind a key only the user holds.
- **OpenAI: no.** Dots act on their own cloud computer and browser, with standard encryption "between you, OpenAI, and our service providers" (dots safety post, Sep 2026). The only signal is a roadmap line with no date about "client-side encryption for your messages with ChatGPT ... inaccessible to anyone else, even OpenAI" (openai.com, Nov 2025). That line is about chat messages, not agents.
- **Google: not for an agent that acts.** Private AI Compute ("not even Google") exists today, but for Pixel features such as Magic Cue and Recorder (11 Nov 2025). Gemini Spark, the agent that acts, requires Keep Activity on and falls under normal Gemini data use, including human review. On 23 Sep 2026 Google DeepMind announced it "will" add sealed server-side memory, framed around AI "acting at your direction". That is the clearest dated signal from Google, but it has not shipped and is not tied to Spark.
- **Anthropic: no.** Cowork now runs in Anthropic's cloud by default for Pro and Max (6 Oct 2026). Protection is by policy: "By default, Anthropic employees cannot access your conversations unless ...". The only signal is the June 2025 Confidential Inference research post, which says "it is too soon to forecast how it will evolve into specific designs or features".
- **Apple: the sealed cloud exists, but the assistant is not an agent like the others.** Private Cloud Compute is live, free with supported devices, and Apple says data is "not stored nor made accessible to Apple or anyone else". Siri AI (beta since 14 Sep 2026) performs actions inside apps such as drafting email and sharing photos. It is not described as a background cloud agent that browses, books or buys. Apple is the nearest thing to "can't read it plus acts", but only for actions on the device and inside apps.
