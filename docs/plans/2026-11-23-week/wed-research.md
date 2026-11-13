# Wednesday, under.the.hood: research for the week of 23 November 2026

Sunday ideas run, 13 Nov 2026, with web search and web fetch (no Drive or Firecrawl connector). Eight candidates looked at, four shown. A separate reviewer tried to kill every idea; each one it killed was replaced and the replacements were checked again.

## wed-1: The AI that rewrote its own instructions.

**The question.** What happens when software can rewrite its own instructions while you are not looking?

**So what.** AI agents can now go back over their own work overnight and rewrite their own notes and instructions: if you build with them, decide who checks what an agent changed about itself.

**The story.** Anthropic's research on agent memory shows 'dreaming': an agent reviews its own logs, fixes wrong notes and rewrote the instructions it was given, lifting one contract task from 72% to 100% of criteria met. Software editing itself on the fly starts with the agent editing its own manual. What a normal account has today is Claude Code's own memory file; dreaming itself is research and developer tools.

**Why now.** Anthropic Engineering, 6 Nov 2026.

**The checked fact.** Anthropic, 6 Nov 2026: in one Pokemon run, a wrong note made Claude walk off a ledge, and "Claude checked the note against the session transcript, caught its error, and rewrote it"; in one contract task, after Claude rewrote its own instructions, criteria met rose from 72% (41 of 57) to 100% (57 of 57).

**Source.** [Anthropic, the components of agent memory (6 Nov 2026)](https://www.anthropic.com/research/components-of-agent-memory)

**The chain.**

1. An agent does a job and keeps notes.
2. Some notes are wrong.
3. Overnight it reads its own logs.
4. It fixes the notes and the instructions.
5. Tomorrow it starts from the better version.
6. Nobody typed the change.

**Research prompt for deep research.** Act as a product teardown researcher. Plain question: What happens when software can rewrite its own instructions while you are not looking? Find, from primary sources first (the company's own announcement, docs, changelog, pricing page, research post), the newest dated facts from 1 October to 22 November 2026 on: agents that rewrite their own memory, notes or instructions (Anthropic's dreaming research, Claude Code memory, any shipping product), and what the user can see or undo. For every claim give the exact wording or number, its URL and its publication date; mark what a normal account can use today against what was only demoed, and list anything you could not confirm.

## wed-2: AWS shipped software no person wrote or read.

**The question.** Would you use software that no person ever wrote or read?

**So what.** AWS has shipped a product whose code no person wrote or reviewed, and kept it safe with tests and gates instead: if your teams use AI to write software, put your people on the tests and the gates, not on reading every line.

**The story.** AWS released a free local copy of its cloud for testing, written entirely by teams of AI agents. AWS says its own team has not written or reviewed any of the code; people wrote the spec, a test suite checked against real AWS, and a merge gate for build, review, security and fidelity. Take it apart: what the humans actually did, and what still slips through.

**Why now.** Amazon, 11 Nov 2026.

**The checked fact.** Amazon, 11 Nov 2026: "Our team hasn't written or reviewed any of the code." Three teams of agents (test writers, issue finders, fixers) work against the AWS API models, tens of thousands of fidelity tests and a merge gate; the code is released under CC0.

**Source.** [Amazon, How autonomous AI agents built AWS Emulator (11 Nov 2026)](https://www.aboutamazon.com/news/aws/how-autonomous-ai-agents-built-aws-emulator)

**The chain.**

1. Agents can now write code faster than people can read it.
2. So reading every line stops being possible.
3. AWS moved its people to writing tests and rules.
4. Every change has to pass the gate or go back.
5. The tests, not the reader, decide what ships.
6. Whatever the tests miss ships too.

**Research prompt for deep research.** Act as a software teardown researcher. Plain question: would you use software that no person ever wrote or read? Find, from primary sources first (Amazon's announcement and the AWS Emulator repository and docs, other companies' engineering posts), the newest dated facts from 1 October to 22 November 2026 on: products written entirely by AI agents, how they are tested and gated, known gaps (for example permission checks), and any incidents. For every claim give the exact wording or number, its URL and its publication date, and list anything you could not confirm.

## wed-3: Canva, Adobe or Claude: who owns design in 2028?

**The question.** When AI can design a poster in seconds, which design company still gets paid in two years?

**So what.** The design tools your team pays for are turning into agents that work for each other: before renewing Canva or Adobe seats, ask which one your other AI tools can drive.

**The story.** At Adobe MAX on 10 Nov, Adobe made Firefly an AI creative studio, put agents in Illustrator, Premiere and InDesign, and opened its desktop apps to other companies' agents. Claude Design lists both Canva and Adobe as connectors, and Anthropic says over a million people used it in its first week. The fight is over who the other AIs send work to.

**Why now.** Adobe MAX, 10 to 12 Nov 2026.

**The checked fact.** Adobe, 10 Nov 2026: Creative Cloud MCP, in preview, "lets creative professionals direct their preferred third-party agent"; Firefly offers models from partners including ByteDance, Google, Kling and OpenAI. Anthropic (17 Jun 2026): over one million people used Claude Design in its first week, and Canva and Adobe are among its nine connectors.

**Source.** [Adobe newsroom, Adobe powers a new era of creativity (10 Nov 2026)](https://news.adobe.com/news/2026/11/adobe-powers-new-era-of-creativity)

**The chain.**

1. AI now makes a first draft of most designs.
2. The draft is cheap, so the value moves.
3. It moves to brand control, files and final polish.
4. Agents choose which app to send work to.
5. The app the agents use most becomes the default.
6. Defaults are where the money stays.

**Research prompt for deep research.** Act as a product teardown researcher. Plain question: When AI can design a poster in seconds, which design company still gets paid in two years? Find, from primary sources first (the company's own announcement, docs, changelog, pricing page, research post), the newest dated facts from 1 October to 22 November 2026 on: Canva, Adobe and Claude Design: what each shipped, paying users, revenue, partnerships, and what AI design can and cannot do today. For every claim give the exact wording or number, its URL and its publication date; mark what a normal account can use today against what was only demoed, and list anything you could not confirm.

## wed-4: Your sleep headband was training an AI on your brainwaves.

**The question.** What is the gadget you wear to bed quietly doing with what it learns about you?

**So what.** A sleep headband maker trained an AI on about 50,000 hours of its users' brainwaves without telling them: before your company buys any wellness or monitoring device for staff, read who can train on its data and who gets it if the maker is sold.

**The story.** Interaxon, maker of the Muse sleep and meditation headband, used about 50,000 hours of users' EEG recordings to train a 'brain foundation model', and only said so in its privacy policy after Science asked. Science reviewed 57 brain-data companies: only six said they would not sell users' brain data, and more than two-thirds let it pass to a new owner after a takeover. Take the product apart: what it collects, what it trains, what you can delete.

**Why now.** Science investigation, reported by Malwarebytes on 11 Nov 2026.

**The checked fact.** Malwarebytes, 11 Nov 2026: Interaxon used about 50,000 hours of EEG recordings to train a "brain foundation model"; of 57 companies Science reviewed, only six explicitly said they would not sell users' brain data, and more than two-thirds allow it to transfer to a new owner after an acquisition.

**Source.** [Malwarebytes, Muse sleep band users weren't told their brain data was training AI (11 Nov 2026)](https://www.malwarebytes.com/blog/ai/2026/11/muse-sleep-band-users-werent-told-their-brain-data-was-training-ai)

**The chain.**

1. A headband reads your brainwaves to help you sleep.
2. The recordings go to the maker's servers.
3. Brainwaves are rare, valuable training data.
4. So the maker trains an AI on them.
5. Removing names does not undo what the model learned.
6. If the company is sold, the data can go with it.

**Research prompt for deep research.** Act as a product teardown researcher. Plain question: what is the gadget you wear to bed quietly doing with what it learns about you? Find, from primary sources first (the Science investigation, Interaxon's and other makers' privacy policies before and after, state neural-data laws), the newest dated facts from 1 September to 22 November 2026 on: consumer brain and sleep wearables training AI on user data, consent, deletion and transfer on acquisition. For every claim give the exact wording or number, its URL and its publication date, and list anything you could not confirm.

## Looked at and left out

- Build or buy with AI-built software: cut, the 18 Nov piece already answered your build versus buy ask; offered as Tuesday's standalone scorecard.
- Claude as a workspace (Sheets, whiteboards): cut, the same mechanism as the design option on the same day.
- Google's decision models: cut, an engineer's pricing choice whose point a leader cannot see.
- Claude Meetings: left out, Anthropic's page said 'coming soon' while press reported a beta.
