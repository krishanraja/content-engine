# The Home Depot carousel, rethought (12 Nov 2026)

Krish, 12 Nov 2026: "I delisted the Home Depot post from publish because it looks like crap and doesn't really make an
interesting point. We need to brainstorm that carousel." (Already in his taste ledger.)

## What was delisted

The Tue 10 Nov off-day carousel, five cards in 3 Posts › `2026-11-10 Tue off.day - AI marking its own homework`
(`docs/plans/2026-11-09-week/offday-carousels.md` has the hashes). It stays where it is; nothing was deleted.

- Cover: a generated robot giving its own exam an A+, headline "The smartest businesses make their AIs mark each
  other's homework. Here's why."
- Cards 2 and 3: logo flow diagrams (Google writes, OpenAI marks; Claude writes code, OpenAI reviews) and the CIO quote.
- Cards 4 and 5: why a second vendor catches what the first misses; "Who marks your AI's homework?"

## Why it failed

1. **No point beyond the anecdote.** One retailer uses two vendors. It never said why that matters to anyone else,
   never named the bigger rule it belongs to, and had no evidence for its "why" (BIG_PICTURE: the headline was the story).
2. **His ask was not met.** On 3 Nov he asked for it to be "slightly educational as to why this is being done" and for
   "more businesses listed as doing this". The 4 Nov build found no second business and shipped Home Depot alone.
3. **The format drifted.** He approved a two-panel meme to "play on the hilarity"; it shipped as a five-card logo
   explainer, so it was neither funny nor deep.
4. **The look was flat.** A generic robot cover (before the 5 Nov house-robot rule) and logo-arrow cards: the floor's
   "gimmick illustration in place of real proof" pattern.

## What the research now supports (checked 12 Nov 2026)

| Fact | Source |
|---|---|
| Home Depot runs customer AI on Google and has OpenAI judge it: "We like the tension between using, Google on one side and then OpenAI to judge the outcomes" | VentureBeat, Beyond the Pilot, CIO Angie Brown, Oct 2026 (https://venturebeat.com/video/grade-google-with-openai-a-fortune-50-ai-stack-at-home-depot) |
| Microsoft 365 Copilot Researcher's Critique: GPT drafts, Claude reviews for accuracy, completeness and citations; Microsoft says it beats the standalone deep-research tools of OpenAI, Google, Perplexity and Anthropic on the DRACO test | GeekWire, 30 Mar 2026 (https://www.geekwire.com/2026/gpt-drafts-claude-critiques-microsoft-blends-rival-ai-models-in-new-copilot-upgrade/); Microsoft Tech Community blog (https://techcommunity.microsoft.com/blog/microsoft-copilot-blog/introducing-multi-model-intelligence-in-researcher/4506011) |
| Perplexity's Model Council runs one question through three models (Claude, GPT, Gemini) at once | Perplexity blog (https://www.perplexity.ai/hub/blog/introducing-model-council); date not shown on the page, so it is not cited on a card |
| AI judges score their own writing higher than people rate it (GPT-4, GPT-3.5, Llama 2 on summaries) | Panickssery, Bowman and Feng, NeurIPS 2024 (https://arxiv.org/abs/2404.13076) |
| One likely reason: models prefer text that is familiar to them (lower perplexity) | Wataoka and others, 2024 (https://arxiv.org/abs/2410.21819) |
| After Enron, SEC auditor-independence rules (Jan 2003, Sarbanes-Oxley Title II): an auditor cannot audit its own work | SEC final rule 33-8183 (https://www.sec.gov/files/rules/final/33-8183.htm) |

The bigger story: as AI writes more of the first draft, checking becomes the job, and the oldest rule in governance
(whoever did the work does not sign it off) is being rebuilt with rival AIs.

## The three angles on the ideas board (week of 16 Nov)

Each opens on one plain question a leader could take into a board meeting. Two fresh readers (Sonnet and Haiku, as
12-year-olds reading once) read each; both stumbled on Enron, a vague "industry test", "backer" and "rated the same", and
those words were fixed. Copy lint clean; `check_voice` passes (distance 0.20 to 0.25).

| Option | Day | Board question | Spine |
|---|---|---|---|
| `auditrule` (recommended) | Tue 17 Nov | Who checks the work our AI does? | Accountant stamping his own report → the post-Enron rule → Home Depot → Microsoft → the study → "The AI that did the work never signs it off." |
| `frenemies` | Tue 17 Nov | If Microsoft won't trust one AI alone, why do we? | Rival-schools meme → Microsoft (GPT writes, Claude checks) → Home Depot → the one-line why |
| `ownref` | Thu 19 Nov | Is our AI marking its own homework? | Referee in one team's shirt → the study → why (familiar writing) → who fixes it → the 30-second habit |

Tue 17 Nov already has the proactive-AI short signed off; Krish said on 11 Nov "I still might do a 2nd post on Tuesday
like a meme later", so these are that second post. Thursday 19 Nov had room for one more option; `ownref` is the
riskiest (its habit ending sits close to the "one question" card he called boring on 3 Nov).

Whichever he approves, Growth makes it to `docs/CAROUSEL-STANDARD.md`: a scene cover with no robot, real logos from
Brandfetch, real crops of the SEC rule, Copilot's Critique and the study's chart, no card numbers, the house mark
bottom-right, Follow for more over the centred mark on the last card, sources in the caption only.
