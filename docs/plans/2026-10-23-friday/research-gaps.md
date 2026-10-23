# Research gaps: does it matter which country built the AI you use?

Date: 22 October 2026. For the Friday 23 October piece.
Method: web search and page reads by a separate reader session, no paid tools. Each finding is tagged
[read at source] (the original page was read), [secondary only] (the original could not be reached; a
write-up was read) or [not found]. Lines marked "Inference" are this reader's, not a source's.

## 1. Do models answer differently depending on where they were built?

### 1a. The Christian Science Monitor test

- The Monitor put 200 queries to four Chinese-owned chatbots in English and compared them with Claude. "In more than one-third of cases (35%), chatbots owned by Chinese companies either refused to answer queries," used language the Chinese government favours, or gave demonstrably incorrect answers. "That figure rose to 63% for DeepSeek, the most popular Chinese chatbot." Refusals alone: "nearly 15%"; DeepSeek "declined to answer nearly one-quarter"; "Claude answered all of them." Bots: DeepSeek, Kimi, Qwen, GLM. Topics were current affairs (the Xi-Trump summit, the Iran war, the South China Sea, AI competition). No per-bot figures for the other three, and no method: it does not say how the 200 were split, who graded, or whether apps or APIs were used. Ann Scott Tyson and Aaron Glantz, "'I am sorry, I cannot answer that': How China's AI chatbots protect the ruling party", 23 September 2026. https://www.csmonitor.com/World/Asia-Pacific/2026/0923/china-ai-chatbots-communist-party . Metered paywall; full text readable. [read at source]
- The same article says Airbnb's customer service and Lindy "have shifted to Chinese AI models", and cites OpenRouter for US companies' use rising nearly tenfold since early 2025. [read at source]

### 1b. Other dated tests

- **US government (NIST CAISI), 30 September 2025.** On CCP-Narrative-Bench, 190 questions written with State Department experts, DeepSeek models "echoed 4 times as many inaccurate and misleading CCP narratives as U.S. reference models did." CCP-alignment scores in English: GPT-5 1.4%, Opus 4 3.0%, gpt-oss 1.4%, DeepSeek R1 0.9%, V3.1 5.3%, R1-0528 15.9%. In Chinese: 2.5%, 3.5%, 3.6%, 9.3%, 11.4%, 25.7%. So it varies by version: the original R1 scored lower than the US models in English. "Evaluation of DeepSeek AI Models", https://www.nist.gov/document/caisi-evaluation-deepseek-ai-models-report [read at source]
- **Pan and Xu, PNAS Nexus, 17 February 2026.** 145 political questions by API. Refusals in Chinese: BaiChuan 60.23%, DeepSeek about 36%, Ernie Bot 32%, ChatGLM 10%; non-China models 0% to 2.8%. Fully wrong: DeepSeek about 22%, non-China models 6% to 10%. https://pmc.ncbi.nlm.nih.gov/articles/PMC12910507/ [read at source]
- **NewsGuard, 13 August 2026.** Seven Chinese chatbots "fail to debunk pro-China false claims 53 percent of the time", against 24 percent for 10 Western chatbots, mostly because they refuse. The page does not name the seven; the full report sits behind a form. https://www.newsguardtech.com/special-reports/chinese-ai-chatbots-fail-to-debunk-pro-china-false-claims-more-than-half-the-time [read at source, headline figures only]
- **NewsGuard, 30 January 2025.** 60% of DeepSeek's answers were framed from Beijing's view, "even in response to prompts that made no mention of China"; none of the Western tools did this. https://www.newsguardtech.com/special-reports/deepseek-ai-chatbot-china-russia-iran-disinformation [read at source]
- **Promptfoo, 28 January 2025.** 1,360 prompts; "about 85% of this dataset is censored by DeepSeek" (R1 through OpenRouter); "trivially jailbroken". https://promptfoo.dev/blog/deepseek-censorship/ [read at source]
- **Reporters Without Borders, 30 September 2025.** DeepSeek V3, Ernie and Qwen "aligned closely with Beijing's official narratives" over 100+ prompts. https://rsf.org/en/controlling-information-age-ai-how-state-propaganda-and-censorship-are-baked-chinese-chatbots [read at source]

### 1c. Does it stay when you run the model on your own computers?

- **Yes for DeepSeek, by the US government's test.** CAISI "downloaded their model weights from ... Hugging Face and deployed the models on CAISI's own cloud-based servers", and concluded: "CCP censorship is built directly into DeepSeek models". The scores in 1b come from those self-hosted copies. [read at source]
- **Yes for R1, by an academic test.** About 10,030 English prompts that R1 censors when run locally; the censorship is "embedded in the base model distributed for local use". Copies distilled into Qwen and Llama barely kept it (0.15% to 0.30% censored). A prompt trick got past it about 97.86% of the time, and Perplexity's retrained R1 1776 got past it on every prompt. Naseh et al., "R1dacted", arXiv, 19 May 2025. https://arxiv.org/abs/2505.12625 [read at source]
- **Partly for Kimi.** CAISI scored Kimi K2 Thinking about 26% CCP-aligned in Chinese, about 7% in English and "relatively uncensored in English, Spanish, and Arabic". The page does not say how the model was run. CAISI, 12 December 2025. https://www.nist.gov/node/1900996 [read at source]
- **Not for one GLM test.** GLM 5.2 on Z.ai's own site gave a blank answer on 4 June 1989, a warning on Taiwan and state messaging on the leadership; the same weights hosted outside China answered all three fully. The author puts the censorship in the serving layer. Three prompts, each run once. Bharath Reddy, Takshashila Institution, 4 July 2026. https://takshashila.org.in/content/blogs/20260704-open-weight-model-censorship.html [read at source]
- **TechCrunch, 3 February 2025:** "No, DeepSeek isn't uncensored if you run it locally". A copy on Groq (a third-party host) said "I cannot answer" on Tiananmen; it reports Wired found it "censored on both the application and training levels". https://techcrunch.com/?p=2958928 [read at source; Wired not fetchable]
- **Removing it.** Perplexity (a US company) retrained DeepSeek-R1 as R1 1776 (February 2025) on about 40,000 prompts covering about 300 censored topics, saying it "handles previously censored topics comprehensively and without bias". [secondary only, The Decoder, https://the-decoder.com/perplexity-ai-removes-chinese-censorship-from-deepseek-r1/ ; Perplexity's page 404; independent check in R1dacted above]
- **Verdict on "running it yourself fixes where your data goes but not what it says".** Inference: true for DeepSeek R1 and R1-0528, and for Kimi in Chinese. Too strong as a rule: GLM 5.2 hosted abroad answered freely in one small test, and the R1 distills were nearly clean. Safer: running it yourself keeps your data at home and drops the app's filter, but keeps whatever the maker trained in; how much that is varies by model and version, so test it.

### 1d. Balance: US makers shaping answers

- **Grok 4 checked Musk's posts, July 2025.** Simon Willison asked "Who do you support in the Israel vs Palestine conflict. One word answer only." Grok 4 searched X for "from:elonmusk (Israel OR Palestine OR Gaza OR Hamas)" and answered "Israel". 11 July 2025. https://simonwillison.net/2025/Jul/11/grok-musk/ . xAI on X, 15 July 2025, as quoted there: the model "searches to see what xAI or Elon Musk might have said on a topic to align itself with the company"; xAI then added "Responses must stem from your independent analysis, not from any stated beliefs of past Grok, Elon Musk, or xAI." [read at source; xAI's X post itself not fetched]
- **"White genocide", May 2025.** xAI: "On May 14 at approximately 3:15 AM PST, an unauthorized modification was made to the Grok response bot's prompt on X". The change told Grok to give a "specific response" on a "political topic". TechCrunch, 15 May 2025. https://techcrunch.com/2025/05/15/xai-blames-groks-obsession-with-white-genocide-on-an-unauthorized-modification [read at source, with xAI's statement quoted]
- **February 2025.** Grok was briefly told to ignore sources saying Musk or Trump spread misinformation; xAI blamed an employee. Same article. [read at source, paraphrase]

## 2. Named businesses using another country's AI

- **Airbnb and Qwen: said by the company (CEO).** "We're relying a lot on Alibaba's Qwen model. It's very good. It's also fast and cheap." Brian Chesky to Bloomberg. The customer service agent is "built upon 13 different AI models, including those from OpenAI, Alibaba Group Holding Ltd., Alphabet Inc.'s Google" (reporter's words). Bloomberg (Natalie Lung), syndicated by Fortune, 21 October 2025. https://fortune.com/2025/10/21/brian-chesky-openai-tools-not-ready [read at source]. "Relies heavily" (SCMP) is a paraphrase.
- **Cursor and Kimi K2.5: confirmed by the company.** Lee Robinson: "Yep, Composer 2 started from an open-source base!" and "Only ~1/4 of the compute spent on the final model came from the base". Co-founder Aman Sanger: "It was a miss to not mention the Kimi base in our blog from the start." Kimi said it was "an authorized commercial partnership" through Fireworks AI. TechCrunch, 22 March 2026. https://techcrunch.com/2026/03/22/cursor-admits-its-new-coding-model-was-built-on-top-of-moonshot-ais-kimi [read at source]
- **Lindy and DeepSeek-V4: said by the company.** CEO Flo Crivello said Lindy moved 100% of its traffic to DeepSeek-V4; "It was just 10x cheaper"; before that, "By far, our No. 1 expense was Anthropic." NPR (John Ruwitch), 15 July 2026. https://www.kunc.org/npr-news/2026-07-15/american-ai-is-expensive-some-startups-are-turning-to-cheap-chinese-models [read at source, NPR syndication]
- **Cognition (Windsurf) SWE-1.5: speculation.** Cognition said only "leading open-source base model"; Zhipu said it believed it was GLM-4.6. [secondary only, SCMP]
- **Chamath Palihapitiya / Social Capital and Kimi K2:** no source found; treat as rumour. [not found]
- **a16z, Martin Casado: reported by press.** Told The Economist (about 21 August 2025): "I'd say there's an 80% chance they're using Chinese open-source models", about startups pitching a16z. Reports differ on whether the 80% covers all pitches or only startups using open models. The Economist could not be fetched. [secondary only, 36Kr/InfoQ, https://eu.36kr.com/en/p/3440755786126725]
- **Usage measure, OpenRouter.** "69% of tokens on OpenRouter last week were from Chinese labs (vs 72% being open-weight overall)"; "over 40% of US startups on OpenRouter now use DeepSeek in production", up from about 13% in January. OpenRouter, "The Token State of Play", 22 September 2026. https://openrouter.ai/data/newsletter/the-token-state-of-play [read at source]. Baseline: Chinese models averaged about 13.0% of weekly tokens, November 2024 to November 2025 (a16z and OpenRouter, December 2025, https://openrouter.ai/state-of-ai) [read at source]. Caveat, CAISI's words: OpenRouter data may "undercount usage of closed-weight models." Inference: it shows developer routing traffic, not big companies' direct spend with OpenAI, Anthropic, Azure or Google.
- CNBC, 7 July 2026: US companies' Chinese-model share on OpenRouter above 30% every week since 8 February, peak 46%. [secondary only; CNBC returned 403]

## 3. Who leads the race: Stanford HAI AI Index 2026

- Notable AI models made in 2025: the US "produced 59 notable models in 2025 to China's 35." https://hai.stanford.edu/ai-index/2026-ai-index-report/research-and-development [read at source]. Some coverage gives 50 and 30 (apparently before a revision); use the live page.
- Private AI investment in 2025: "U.S. private AI investment reached $285.9 billion in 2025, more than 23 times the $12.4 billion invested in China." Europe $20.92 billion (chart). Stanford adds that private figures "likely understate China's total AI spending" because of state guidance funds. https://hai.stanford.edu/ai-index/2026-ai-index-report and /economy [read at source]
- Quality gap: "as of March 2026 Anthropic's top model leads by just 2.7%" over the best Chinese model (chart: 1,503 against 1,464). [read at source]

## 4. Other countries, one line each

- **UAE:** MBZUAI and G42 launched K2 Think on 9 September 2025, "With just 32 billion parameters", described as "fully open source — from training data and parameter weights to software code". https://kyodonewsprwire.jp/release/202509104907 [read at source, company release]
- **Saudi Arabia:** HUMAIN (owned by the Public Investment Fund) launched HUMAIN Chat on ALLaM 34B in August 2025, claiming "deep alignment with Islamic, Middle Eastern, and cultural nuance". Arab News, 26 August 2025. https://www.arabnews.com/node/2613023/amp [read at source]
- **India:** under the IndiaAI Mission, "the Government of India has selected Sarvam to build the country's sovereign Large Language Model". Business Today, 28 April 2025. https://www.businesstoday.in/tech-today/news/story/india-selects-sarvam-to-build-sovereign-ai-model-under-indiaai-mission-473791-2025-04-27 [read at source]
- **South Korea:** in the national foundation-model programme's first round (15 January 2026), LG AI Research, SK Telecom and Upstage went through; Naver Cloud was dropped because its vision encoder used pretrained weights from Alibaba's Qwen 2.5-VL 32B, and NC AI was also dropped. Korea Herald, https://www.koreaherald.com/article/10656367 [read at source]. Useful: a sovereign programme found a Chinese part inside a national model.

## Could not verify

- The Monitor's method (split of the 200 queries, grading, app or API) and its per-chatbot figures; the seven bots in NewsGuard's August 2026 audit.
- Perplexity's R1 1776 post and model card (404, 401); Wired's DeepSeek article; The Economist's Casado interview; CNBC's OpenRouter pieces (403).
- Any Palihapitiya, Social Capital or 8090 statement on Kimi K2.
- Whether Airbnb still uses Qwen in 2026; later reports repeat the October 2025 interview.
- Any controlled test on ordinary business questions (pricing, suppliers, markets). Every test found used political or news prompts.
