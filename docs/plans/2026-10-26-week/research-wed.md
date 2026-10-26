# Wednesday 28 October, under.the.hood: Claude Duet (research, read 26 Oct 2026)

Piece `b63d2507-dbb4-449d-bce4-f21e859ee2ad`. Picked by Krish, 2026-10-26: "For Wednesday yes, we need to talk about
Claude duet because we've been talking about personal bots for the last 2 Wednesdays so this is a good one."

Source: Anthropic, "Introducing Claude Duet", https://claude.com/resources/articles/claude-duet (published 21 October
2026; read 26 October 2026). Exact lines:

- "Today, we're opening a research preview of Claude Duet, a new app where Claude works as a proactive agent. It comes
  to you with what needs your attention, completes tasks you ask of it, keeps working even when you step away, and
  checks with you before it acts on your behalf. We built Claude Duet for professionals and small business owners with
  more on their plates than they can track."
- "Claude Duet reads, drafts, and prepares work on its own. But before it sends a message, makes a payment, signs a
  document, or deletes anything, it shows you exactly what it's about to do and waits for your approval. A few things
  are off-limits even with your approval, like trading securities or moving money between accounts. You're also able
  to disconnect any app Claude Duet has access to."
- "Each morning, it sends you a short brief on the most important items across your connected apps."
- "Claude Duet checks your connected accounts every few hours, because checking nonstop would use up your plan's limits
  much faster."
- "Claude Duet has a virtual machine with its own browser, so it doesn't require your laptop or phone to be on."
- Connectors named: Gmail, Slack, QuickBooks, Stripe, Gusto ("Prepare and run payroll in Gusto"), LinkedIn ("once you
  edit and approve, post it"), Docusign, HubSpot, Canva, Shopify; "over 6,000 connectors and plugins".
- Purchases: "using Link, Stripe's digital wallet. Claude Duet confirms the item with you, and Link asks you to approve
  the spend. It then pays with a virtual card".
- Sensitive data: a classifier "designed to reject requests to share the strictest tier of information, including
  credit card numbers and government identification. Other sensitive information, such as health or personal
  finances, are let through only when you've explicitly instructed Claude Duet to send it."
- Limits it names itself: "it still might misread a thread or miscalibrate what's urgent ... personal errands, such as
  booking tickets, aren't quite as strong, and it can't yet show you its browser."
- Availability: "We're starting today with Pro and Max users in the US." Waitlist. Included in Pro and Max plans, same
  usage limits; "Its background checks count toward those limits".
- Testers quoted by name: Jess Provencher (Pro Homes), Amin Ebrahimi (Shahs of Kabob, about 110 employees), Mya Dalton.
- A companion page: "Claude Duet Safety, Privacy, and Security" (claude.com, 23 October 2026).

## What it adds for someone who already lives in Claude (read 26 Oct 2026)

Source: Anthropic Help Center, "Get started with Claude Duet",
https://support.claude.com/en/articles/17631495-get-started-with-claude-duet. Exact lines:

- "Claude Duet carries over your memory, skills, and connected apps from your Claude account, so setting it up requires
  minimal work."
- "Claude Duet can search your past chats to pick up context from earlier work, so you don't have to repeat yourself."
  It is switched off with "Search and reference chats" in Settings.
- "It isn't available on Team or Enterprise plans yet, and we plan to bring it to those plans later." And: "Claude Duet
  isn't available on Team or Enterprise plans yet".
- "Microsoft 365 isn't available yet".
- "Work it does in the background, like the morning brief and check-ins, also counts, so you may reach your limits
  sooner than with chat alone."

Context, Anthropic, "Unified Claude Enterprise" (https://claude.com/resources/articles/unified-claude-enterprise):
chat and Cowork became one Claude, with cloud agentic work that continues after the laptop closes. So the question for
a power user is what Duet adds beyond what their Claude already does; check each claim against both pages before it
goes in a script.

## What the hands-on reviews say (read 26 Oct 2026)

**Claire Vo, How I AI** ("Claude Duet Review: Great Design, Slow Follow-Through", ChatPRD, 26 Oct 2026,
https://www.chatprd.ai/how-i-ai/claude-duet-review; the episode is on Lenny's Newsletter, 21 Oct, "Claude Duet is
beautiful. I still forgot to use it"). Exact lines:

- "My first request was basic: go through my email and Slack and figure out what was happening. Duet produced a few
  things, but the priorities and context did not seem right."
- "after setting it up and trying the first few tasks, I did not experience the kind of useful prompting that would
  pull me back in."
- "When I asked it to look at my sales pipeline, it already had access to Slack, email, and our CRM. It could pull in
  that data pretty quickly. That was a concrete advantage: I did not need to assemble and paste all the inputs myself."
- "I also had it create a deck in Google Docs from my phone. The deck was not bad."
- "Duet did not ingest all my local skills." "Access to the same account did not mean access to every ingredient that
  made the original workflow work."
- "With Duet, the delay reduced my willingness to work synchronously." "At the time of my test, Duet did not show up in
  the desktop app."
- "Duet, in this test, was clearly a single-player agent."
- Verdict: "Duet is worth trying for Claude users who want a polished, phone-first assistant for individual business
  tasks." "It did not earn a place as my primary agent in this test."

**Dan Shipper, Every** ("Vibe Check: Duet—Anthropic's Always-on Agent", 21 Oct 2026, updated 26 Oct,
https://every.to/vibe-check/vibe-check-duet-anthropic-s-always-on-agent). Exact lines:

- "It splits recurring topics into their own channels, keeps a running list of what it's working on and what it needs
  from me, and can edit docs, slides, designs, and dashboards and keep them current without leaving the app. It sends
  suggestions I actually want."
- "For now, it can see the Claude sessions on my computers, but it can't direct them; its email drafts are worse than
  Dot's; and its scheduled runs can't reach my custom connectors."
- Subtitle: "Anthropic's personal agent is the first one we'd call a pro tool, even with the plumbing still unfinished".

**Flavio Copes** ("A deep dive into Claude Duet", 22 Oct 2026, https://flaviocopes.com/claude-duet/). Exact lines:

- "Duet can't access local files or all your Claude projects. It can't modify your Claude work, make phone calls, or
  send texts."
- "Disconnecting an app stops future access, but Duet retains memory of previously learned information."
- "Duet is included during the preview, but its background checks consume your allowance. I'd measure what is left for
  my other Claude work after a normal week."
- "I haven't run either workflow in Duet yet." (His examples, a client-meeting brief and a site check, are proposals.)

Access: a Reddit thread (r/ClaudeAI, about 24 Oct) says "I applied for Claude Duet on Oct 22 and have heard literally
nothing since." One person's report; it shows invites are not instant, nothing more.

What none of them answers for a power user (our gap, an inference until checked): which of the jobs you already do in
Claude to hand it first, what that changes in your day, and what it costs you in limits and lost context.
