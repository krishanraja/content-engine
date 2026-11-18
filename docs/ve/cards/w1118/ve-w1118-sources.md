---
card: ve-w1118-sources
format: face-with-proof
motion_style: hud-terminal
kind: sourcing
model: gpt-6.1-sol
effort: medium
max_minutes: 40
max_calls: 60
cwd: /root/ve-worktrees/content-engine/ve-card/ve-w1118-sources
write_allow: [.scratch/w1118/sources/*]
read: /root/w1118/research/*
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Wed 18 build-or-buy: find and verify every real page the cuts show

## Goal
Wed 18 Nov (under.the.hood, piece db9f9f6a), "Build or buy your tools in an AI world?". Krish, 17 Nov: "use codex for all asset production, generation, sourcing". The cuts show real things as themselves (a real headline, a real post, a vendor's own page), never re-typed. Use your web search and browsing tool (web.run) to find each item below, open it, and confirm the exact words. The research already on file is at /root/w1118/research/ (read 9f8cc183-*.md and 9de4e8fc-*.md first: they cite most of these).

A. klarna-headlines: 3 to 5 real news headlines from Aug 2024 to Feb 2025 that said Klarna was shutting down or replacing Salesforce and Workday (with AI). Prefer well-known outlets. The diginomica piece of 4 Mar 2025 links the original coverage.
B. saas-dead-posts: 2 or 3 real public social posts (LinkedIn or X) from Sep 2024 to Mar 2025 that cite Klarna and say SaaS is dead or AI killed software.
C. klarnaseb-post: https://x.com/klarnaseb/status/1896698293759230429 (4 Mar 2025): confirm the line "we did not replace SaaS with an LLM" and whether it is in this post or a reply in the thread (give that post's URL).
D. cxtoday-klarna: CX Today's report that Klarna uses Deel for HR and still uses Slack.
E. slack-acquisition: Salesforce's own page announcing it completed its acquisition of Slack (2021).
F. vmware-10x: the Ars Technica report (Dec 2024) of a VMware customer (Beeks) whose bill rose about tenfold after Broadcom bought VMware; the exact words.
G. curative-bi: Business Insider's report (21 Jul 2026) quoting Curative's CEO Fred Turner on cancelling Salesforce, the $600,000 contract, building in two months, and that keeping it running is hard; the exact words of each.
H. workday-anthropic: Workday's own page or release naming Anthropic as a customer (finance and HR).
I. fin-anthropic: Fin's (Intercom's) own customer story with Anthropic: "live in under a week" and that Fin runs on Claude; the exact words.
J. salesforce-anthropic: a primary page showing Anthropic runs on Salesforce.
K. mckinsey-2026: McKinsey's 2026 survey: 32% skipped buying at least one software product because they could build it.
L. product-screens: one official image each of the Salesforce Sales Cloud customer record screen and the Workday payslip or time-off screen, from the vendor's own site or newsroom (the image URL and the page it is on).

## Contract
Write .scratch/w1118/sources/sources.json: a list of {key (A to L as above, with -1, -2 for several), url (the page itself, never a search result or an aggregator when the original is reachable), outlet, date (YYYY-MM-DD as the page states it), headline (exactly as the page shows it), lines (the exact sentences the cut points at, copied verbatim), image_url (L only), checked (true only when you opened the page and saw those words), note}. A claim you cannot confirm on its own page is checked:false with a note saying what you found instead; never write a line the page does not hold. Also write .scratch/w1118/sources/sources.md: one line per item saying what you confirmed.

Never edit any file outside .scratch/w1118/sources/. Never sign in anywhere, post, like, follow or send anything.

## Motion style: HUD and terminal (hud-terminal, untested)
Monospace text, lock-on brackets and rolling numbers, for pieces about what software or models actually do.
Build to these rules; brand roles (config/ve/brand-tokens.json) and the design lock win where they differ.
- IBM Plex Mono only, on ink; mint for the result line, cream for everything else
- text types at a readable 25 to 40 characters a second, never a blur
- brackets lock onto the one value that matters with the slap token
- rolling numbers settle on the real figure and hold
Never:
- green-on-black hacker clichés
- glitch and scan noise over the proof
- walls of fake code

## Acceptance (every command must exit 0 inside your sandbox)
python3 -c "import json,sys; rows=json.load(open('.scratch/w1118/sources/sources.json')); keys={r['key'].split('-')[0] for r in rows}; miss=set('ABCDEFGHIJKL')-keys; sys.exit('missing '+','.join(sorted(miss))) if miss else None; bad=[r['key'] for r in rows if not r.get('url','').startswith('http')]; sys.exit('no url '+','.join(bad)) if bad else print('ok', len(rows), 'checked', sum(1 for r in rows if r.get('checked')))"

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-w1118-sources", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
