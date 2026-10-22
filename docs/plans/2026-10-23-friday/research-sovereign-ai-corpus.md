<!-- Research Krish attached on 22 Oct 2026 for Friday 23 Oct (mind.the.gap, piece 7083d6ad). Kept verbatim (learning playbooks-into-the-engine). Its own note: an export, not a fresh verification pass; every figure is read at its source again at the fact gate. -->

# Sovereign AI: A Business Leader’s Corpus

**Research date:** 22 October 2026  
**Scope:** Model origins, national approaches, cross-border adoption, deployment sovereignty and business decisions  
**Reading convention:** Country descriptions distinguish documented facts from strategic interpretation. Model names are verified examples, not a claim to list every release or the latest available version.

**Export note:** This file contains the complete corpus from the preceding research response, with portable source links. It is an export of that research, not a new verification pass. It covers ten national ecosystems and several named cross-border examples; India, the Gulf states, South Korea, Singapore, and much of Africa and Latin America remain coverage gaps. It is not a complete global inventory.

## The central distinction

A country can develop a model without controlling the infrastructure on which it runs. Equally, an organisation can operate a foreign-developed model inside its own infrastructure: HSBC’s partnership with France’s Mistral explicitly provides for self-hosted models on HSBC’s internal systems. [HSBC–Mistral partnership reporting](https://www.theregister.com/software/2025/12/01/hsbc-partners-with-mistral-ai-to-sharpen-in-house-llms/2662926)

National AI strategies therefore need to be understood as choices about **which capabilities to own, which to develop jointly, and which to access through dependable partners**. The UK Council for Science and Technology explicitly recommends that approach rather than assuming Britain must own every component of the AI stack. [UK Council for Science and Technology sovereignty paper](https://www.gov.uk/government/publications/ai-sovereignty-preserving-uk-agency-in-an-ai-enabled-world)

**Business interpretation:** Replace the question “Is this a British, American or Chinese AI?” with:

> Which parts of this system do we control, which foreign dependencies remain, and what happens if one of those dependencies becomes unavailable?

## What “country” actually means

For procurement, treat an AI system as having several different geographical identities.

| Dimension | What to establish | Why it matters |
|---|---|---|
| Developer origin | Where the model developer operates and is incorporated | Supplier accountability, ownership and policy exposure |
| Ultimate ownership | Who controls the developer and relevant service providers | A local brand or office may not mean local control |
| Model lineage | Whether the model was trained from scratch, adapted or distilled from another model | Upstream licences, technical dependencies and provenance |
| Training geography | Where training happened and who supplied compute | Infrastructure dependence and reproducibility |
| Training-data provenance | What data was used and under what permissions | Rights, auditability, language coverage and remediation |
| Inference geography | Where live requests are processed | Data handling, operational performance and contractual commitments |
| Operational geography | Where administrators, support teams and subprocessors work | Hosting location alone does not describe all potential access |
| Legal jurisdiction | Which entities, contracts and laws govern the service | Accountability, remedies and disclosure obligations |
| Control rights | Whether you possess weights and can independently operate the system | Continuity, modification and switching |
| Economic destination | Who captures recurring model, cloud and application revenue | Industrial policy and long-term bargaining power |

**Recommended practice:** Give every material AI deployment a “model passport” covering these dimensions. Do not accept a single country flag as a substitute.

### National is not state-owned

A model developed by a private company in a country is not necessarily that country’s official model. The national ecosystems below include private commercial developers, public research initiatives and government-supported capability programmes—not one uniform category of “national AI”. [UK Sovereign AI Fund](https://www.sovereignai.gov.uk/) [Apertus official website](https://www.apertus-ai.org/) [HSBC–Mistral partnership reporting](https://www.theregister.com/software/2025/12/01/hsbc-partners-with-mistral-ai-to-sharpen-in-house-llms/2662926)

Likewise, a locally branded model may be adapted from a foreign foundation: Fujitsu’s Japanese-language Takane was built on Cohere’s Command R+, while Taiwan’s TAIDE programme documents models based on Meta’s Llama and Google’s Gemma. [Fujitsu Takane launch announcement](https://www.fujitsu.com/global/about/resources/news/press-releases/2024/0930-01.html) [TAIDE official website](https://www.taide.tw/)

## The country-model atlas

### United States

**Verified examples:** OpenAI’s GPT family and gpt-oss; Anthropic’s Claude; Meta’s Llama and Muse; Allen Institute for AI’s Olmo. [OpenAI GPT-5.4 announcement](https://openai.com/index/introducing-gpt-5-4/) [OpenAI gpt-oss announcement](https://openai.com/zh-Hans-CN/index/introducing-gpt-oss/) [Anthropic model announcements](https://www.anthropic.com/news/models) [Meta model overview — secondary source](https://unitedstatesofamericasuperintelligence.com/companies/meta/) [Olmo 3 technical report](https://arxiv.org/html/2512.13961v2)

| Developer | Verified model examples | Access approach | Business significance |
|---|---|---|---|
| OpenAI | GPT-5.4; gpt-oss-120b and gpt-oss-20b | Hosted frontier products alongside downloadable models; gpt-oss uses Apache 2.0 | “American AI” includes both service dependence and independently deployable weights. [OpenAI GPT-5.4 announcement](https://openai.com/index/introducing-gpt-5-4/) [OpenAI gpt-oss announcement](https://openai.com/zh-Hans-CN/index/introducing-gpt-oss/) |
| Anthropic | Claude’s Opus, Sonnet and Haiku families | Claude products, direct API and major cloud distribution | Organisations can access the same model family through different commercial and infrastructure arrangements. [Anthropic model announcements](https://www.anthropic.com/news/models) [Claude Opus 4.7 announcement](https://www.anthropic.com/news/claude-opus-4-7) |
| Meta | Llama; Muse Spark | Llama has downloadable-weight releases under model-specific terms; Muse Spark initially used Meta products and selected API access | A developer’s historical openness does not guarantee identical terms for its next model family. [Meta model overview — secondary source](https://unitedstatesofamericasuperintelligence.com/companies/meta/) [Meta Muse Spark announcement](https://about.fb.com/news/2026/04/introducing-muse-spark-meta-superintelligence-labs/) |
| Allen Institute for AI | Olmo 3 | Weights, training stages, data and dependencies released as a fully open development process | Offers a different transparency proposition from merely downloading final weights. [Olmo 3 technical report](https://arxiv.org/html/2512.13961v2) |

**Approach:** The documented ecosystem contains competing commercial strategies rather than one national release policy: hosted services, downloadable models and highly transparent research releases coexist. [OpenAI GPT-5.4 announcement](https://openai.com/index/introducing-gpt-5-4/) [OpenAI gpt-oss announcement](https://openai.com/zh-Hans-CN/index/introducing-gpt-oss/) [Olmo 3 technical report](https://arxiv.org/html/2512.13961v2)

**Strategic interpretation:** The US advantage is not just individual models. For a buyer, the important exposure is often the combined dependency on model supplier, cloud platform, development tooling and distribution channel.

**What leaders should ask:** Are you buying an American-developed model, an American-operated service, or both? Those are different procurement decisions.

### China

**Verified examples:** Alibaba’s Qwen, DeepSeek and Moonshot AI’s Kimi. Qwen3 includes Apache-2.0 open-weight releases; Kimi K2.5 publishes code and weights under a Modified MIT licence. [Qwen3 announcement](https://qwen.ai/blog?id=qwen3) [Kimi K2.5 model card](https://huggingface.co/moonshotai/Kimi-K2.5)

| Developer | Verified model examples | Access approach | Business significance |
|---|---|---|---|
| Alibaba/Qwen | Qwen3 dense and mixture-of-experts models | Downloadable weights across several sizes, with Apache 2.0 releases | A Chinese-developed model can be operated through infrastructure other than its developer’s own service. [Qwen3 announcement](https://qwen.ai/blog?id=qwen3) |
| DeepSeek | DeepSeek family; the official site advertises V4.1 Flash updates | Developer-operated model services, with deployment rights requiring release-specific verification | Do not assume every generation has identical hosting, licence or availability terms. [DeepSeek official website](https://deepseek.com/) |
| Moonshot AI | Kimi K2.5 | Published weights and code, plus an API | Supports both developer-hosted consumption and independent deployment; the licence is Modified MIT, not simply standard MIT. [Kimi K2.5 model card](https://huggingface.co/moonshotai/Kimi-K2.5) [Kimi K2.5 official repository](https://github.com/MoonshotAI/Kimi-K2.5) |

**Approach:** China combines commercial model competition with formal regulation of public-facing generative AI services. Its interim measures apply to services offered to the public within mainland China and include requirements concerning training data, content handling, security assessments and algorithm filing. [China generative AI interim measures](https://www.cac.gov.cn/2023-07/13/c_1690898327029107.htm) [CAC explanation of the interim measures](https://www.cac.gov.cn/2023-07/13/c_1690898326863363.htm)

The regulator’s explanation distinguishes public services from development and application that do not provide generative AI services to the domestic public; that exception is not an exemption from every other applicable law. [CAC explanation of the interim measures](https://www.cac.gov.cn/2023-07/13/c_1690898326863363.htm)

**Strategic interpretation:** Two questions must be separated:

- **Model-origin risk:** Whether the model’s training, behaviour, licence and provenance fit the intended use.
- **Service-operation risk:** Who receives prompts, operates infrastructure, administers the system and retains records.

Running downloaded Chinese-developed weights locally changes the second question. It does not automatically settle the first.

### France

**Verified examples:** Mistral Large 3 and the Ministral 3 family. The documented release includes downloadable models under Apache 2.0, with distribution through Mistral and multiple external platforms. [Mistral 3 release announcement](https://mistral.ai/news/mistral-3/?__hstc)

**Approach:** Mistral combines model development with enterprise customisation and deployment flexibility. Its HSBC agreement specifically provides for commercial models deployed on the bank’s internal systems, rather than requiring all use to occur through Mistral’s own hosted service. [HSBC–Mistral partnership reporting](https://www.theregister.com/software/2025/12/01/hsbc-partners-with-mistral-ai-to-sharpen-in-house-llms/2662926)

This is an important example of a domestic model developer competing internationally: a French supplier can sell into a British-headquartered global bank while supporting customer-controlled deployment. [HSBC–Mistral partnership reporting](https://www.theregister.com/software/2025/12/01/hsbc-partners-with-mistral-ai-to-sharpen-in-house-llms/2662926)

**Strategic interpretation:** France’s Mistral example illustrates **sovereignty through a commercially viable alternative supplier**, not isolation from international customers or cloud platforms.

**What leaders should ask:** Which precise model and licence are being proposed? Mistral’s Apache-licensed releases and its commercial enterprise agreement are related offerings, not interchangeable contractual propositions. [Mistral 3 release announcement](https://mistral.ai/news/mistral-3/?__hstc) [HSBC–Mistral partnership reporting](https://www.theregister.com/software/2025/12/01/hsbc-partners-with-mistral-ai-to-sharpen-in-house-llms/2662926)

### United Kingdom

**Verified national instruments:** The £500 million Sovereign AI Fund, sovereign compute access and a policy approach focused on agency, domestic capability and trusted access to external models. [UK Sovereign AI Fund](https://www.sovereignai.gov.uk/) [UK AI sovereignty policy publication](https://www.gov.uk/government/publications/ai-sovereignty-preserving-uk-agency-in-an-ai-enabled-world)

The fund describes equity support, access to up to one million GPU hours per startup, talent support and strategic assets. This is an ecosystem-building programme, not evidence that the government has selected a single official British foundation model. [UK Sovereign AI Fund](https://www.sovereignai.gov.uk/)

**Approach:** October 2026 advice from the Council for Science and Technology recommends maintaining access to leading models while developing selected UK capabilities; it also identifies a proposed public-interest sovereign base model as a proposal to consider, not an already delivered national model. [UK Council for Science and Technology sovereignty paper](https://www.gov.uk/government/publications/ai-sovereignty-preserving-uk-agency-in-an-ai-enabled-world)

At the same time, the UK government selected Anthropic to help build and pilot a Claude-powered GOV.UK assistant, initially focused on employment-related support. [Anthropic UK government partnership](https://www.anthropic.com/news/gov-UK-partnership?cmid=4d4cb6e5-a0ef-4215-a883-18ce6e454534)

**Strategic interpretation:** Britain is a useful case of **sovereignty through leverage and optionality**: strengthen domestic capabilities while using foreign models where appropriate.

**Important distinction:** An announcement that a government is funding national AI capability should not be interpreted as a commitment to exclude foreign models from public services.

### Canada

**Verified examples:** Cohere’s Command and Aya families. Cohere’s documented portfolio includes enterprise generation, retrieval, multilingual models and privately deployable options, with different licences across products. [Cohere model catalogue](https://cohere.com/models-overview)

**Approach:** Cohere’s cross-border work illustrates a private-enterprise route to national capability: its technology can become an input to another country’s locally adapted model. Fujitsu’s Takane is a concrete example. [Fujitsu–Cohere partnership announcement](https://info.archives.global.fujitsu/global/about/resources/news/press-releases/2024/0716-01.html) [Fujitsu Takane launch announcement](https://www.fujitsu.com/global/about/resources/news/press-releases/2024/0930-01.html)

Cohere’s model catalogue also demonstrates why buyers must inspect the exact release: the portfolio lists Apache-2.0 offerings alongside a translation model under a non-commercial licence. [Cohere model catalogue](https://cohere.com/models-overview)

**Strategic interpretation:** A country can export model capability without exporting a single consumer chatbot brand. Enterprise integration and model adaptation can be the more important commercial channel.

**What leaders should ask:** Is the proposed model licensed for your commercial use, privately deployable, and supported under the contract you are actually signing?

### Japan

**Verified example:** Fujitsu’s Takane, developed with Cohere and launched for secure enterprise environments. It is based on Command R+ with additional Japanese-language training and fine-tuning. [Fujitsu Takane launch announcement](https://www.fujitsu.com/global/about/resources/news/press-releases/2024/0930-01.html)

**Approach illustrated:** Local language and business adaptation built on an international foundation. Fujitsu positions Takane for private environments and specialised enterprise workloads rather than treating Japanese capability as synonymous with training every component from scratch. [Fujitsu Takane launch announcement](https://www.fujitsu.com/global/about/resources/news/press-releases/2024/0930-01.html) [Fujitsu Takane enterprise catalogue](https://docs.fujitsu/documents/003331/fujitsu-generative-ai-for-cohere-catalog-jp.pdf)

Documented use cases include technical and legal documents, internal manuals, customer support, summarisation and other document-heavy business tasks. [Fujitsu Takane enterprise catalogue](https://docs.fujitsu/documents/003331/fujitsu-generative-ai-for-cohere-catalog-jp.pdf)

**Strategic interpretation:** Takane demonstrates that **language sovereignty, deployment sovereignty and foundation-model independence are different objectives**. A system can advance the first two while retaining a foreign model lineage.

**Coverage limitation:** Takane is an important verified example, not a complete inventory of Japanese model developers.

### Germany

**Verified example:** Aleph Alpha’s PhariaAI platform and Pharia-1-LLM-7B models appear in its product documentation; 2026 release notes describe on-premises and hosted availability. [PhariaAI September 2026 release notes](https://docs.aleph-alpha.com/phariaai-home/latest/release-notes/pharia-ai/1.260900.0.html) [PhariaAI June 2026 release notes](https://docs.aleph-alpha.com/phariaai-home/latest/release-notes/pharia-ai/1.260600.0.html)

**Approach illustrated:** The documented offering emphasises deployable enterprise infrastructure, with both hosted and customer-premises options. Those deployment choices matter independently of the model’s national origin. [PhariaAI September 2026 release notes](https://docs.aleph-alpha.com/phariaai-home/latest/release-notes/pharia-ai/1.260900.0.html)

**Strategic interpretation:** For regulated organisations, control over integration, administration and deployment may be more valuable than competing on the largest general-purpose model alone.

**Evidence boundary:** The verified documentation supports product availability and deployment modes. It does not, by itself, prove complete supply-chain independence or establish a comprehensive German national strategy.

### Switzerland

**Verified example:** Apertus, developed by EPFL, ETH Zurich and the Swiss National Supercomputing Centre through the Swiss AI Initiative. The initial release included 8-billion- and 70-billion-parameter models. [Apertus official website](https://www.apertus-ai.org/)

**Approach:** Public-research-led capability with unusually extensive transparency: architecture, weights, training data and methods are documented and accessible. The published model information identifies Apache 2.0 for the weights. [Apertus official website](https://www.apertus-ai.org/) [European Open Source AI Index: Apertus](https://osai-index.eu/model/apertus/)

Swisscom provides a commercial access route, connecting publicly developed model capability with enterprise distribution. [Apertus official website](https://www.apertus-ai.org/)

**Strategic interpretation:** Switzerland illustrates **sovereignty as an inspectable public asset**. This is different from either a state-controlled chatbot or a private API whose internals remain inaccessible.

**Important caveat:** Developer statements about compliance-oriented training should not be treated as an independent legal guarantee for every downstream application. The model’s release materials explain its transparency and data-handling approach; deployment-specific legal assessment remains a separate task. [Swiss Apertus launch overview](https://swiss.tech/news/switzerland-launches-its-first-open-and-transparent-ai-model) [European Open Source AI Index: Apertus](https://osai-index.eu/model/apertus/)

### Taiwan

**Verified examples:** TAIDE models based on Llama 2, Llama 3, Llama 3.1 and Gemma 3, plus a 2026 legal-retrieval embedding model based on Google’s EmbeddingGemma. [TAIDE official website](https://www.taide.tw/) [TAIDE legal-retrieval model announcement](https://www.taide.tw/public/latest-updates_show?id=4b1141869e0b03b6019eba7e34760001)

**Approach:** Adapt available foundation models for Traditional Chinese, Taiwanese context and practical tasks. The programme explicitly documents its upstream model families rather than presenting every release as an independently pretrained foundation. [TAIDE official website](https://www.taide.tw/)

Its June 2026 embedding release focuses on Traditional Chinese legal retrieval, showing that national AI capability also includes specialist retrieval components—not only conversational models. [TAIDE legal-retrieval model announcement](https://www.taide.tw/public/latest-updates_show?id=4b1141869e0b03b6019eba7e34760001)

**Strategic interpretation:** Taiwan’s example is particularly useful for businesses because it shows **sovereign adaptation**: maintain local expertise, data and application relevance while using foreign base models.

**What leaders should ask:** Which rights and dependencies come from the upstream model, and which capabilities have genuinely been added locally?

### Russia

**Verified example:** Sber’s GigaChat family, with developer documentation covering generation models, embeddings and different capability tiers. [Sber GigaChat model documentation](https://developers.sber.ru/docs/ru/gigachat/models/main) [Sber model selection documentation](https://developers.sber.ru/docs/ru/gigachat/guides/selecting-a-model)

**Approach illustrated:** Domestic-language AI embedded in a major domestic enterprise ecosystem. A reported October 2026 Sber deployment uses GigaChat to provide customers with summaries of support-line conversations. [Sber call-summary deployment report](https://bosfera.ru/press-release/sberbank-zapustil-otpravku-v-chat-rezyume-zvonkov-na-goryachuyu-liniyu)

**Strategic interpretation:** Domestic distribution can matter as much as international model recognition. A model integrated into banking and enterprise workflows may have substantial local significance without becoming a dominant global developer platform.

**Evidence boundary:** This corpus verifies GigaChat’s existence and a domestic application. It does not establish the scale of Russian AI adoption abroad or complete independence from foreign hardware.

## Comparing national approaches

The categories below are analytical groupings, not official labels or mutually exclusive national policies.

| Approach | Verified illustration | What it seeks to control | Remaining questions |
|---|---|---|---|
| Competing commercial ecosystems | US hosted, open-weight and fully open offerings | Product development, distribution and commercial services | Which supplier and infrastructure dependencies does the buyer inherit? [OpenAI GPT-5.4 announcement](https://openai.com/index/introducing-gpt-5-4/) [OpenAI gpt-oss announcement](https://openai.com/zh-Hans-CN/index/introducing-gpt-oss/) [Olmo 3 technical report](https://arxiv.org/html/2512.13961v2) |
| Commercial models within national service regulation | China’s developers and public-service rules | Domestic service provision, governance and model capability | Does a particular deployment fall within the relevant rules? [Qwen3 announcement](https://qwen.ai/blog?id=qwen3) [China generative AI interim measures](https://www.cac.gov.cn/2023-07/13/c_1690898327029107.htm) |
| Exportable domestic model supplier | France/Mistral | Model development and enterprise alternatives | Does the customer use hosted services or control deployment? [Mistral 3 release announcement](https://mistral.ai/news/mistral-3/?__hstc) [HSBC–Mistral partnership reporting](https://www.theregister.com/software/2025/12/01/hsbc-partners-with-mistral-ai-to-sharpen-in-house-llms/2662926) |
| Selective domestic capability | UK funding and sovereignty advice | Strategic leverage and resilient access | Which capabilities must be owned rather than accessed? [UK Council for Science and Technology sovereignty paper](https://www.gov.uk/government/publications/ai-sovereignty-preserving-uk-agency-in-an-ai-enabled-world) [UK Sovereign AI Fund](https://www.sovereignai.gov.uk/) |
| Enterprise model export | Canada/Cohere | Enterprise models and adaptation expertise | What changes when another supplier adapts the model? [Fujitsu Takane launch announcement](https://www.fujitsu.com/global/about/resources/news/press-releases/2024/0930-01.html) |
| Local-language adaptation | Japan/Takane; Taiwan/TAIDE | Language, context and specialised performance | What remains dependent on upstream foundations? [Fujitsu Takane launch announcement](https://www.fujitsu.com/global/about/resources/news/press-releases/2024/0930-01.html) [TAIDE official website](https://www.taide.tw/) |
| Public, transparent foundation | Switzerland/Apertus | Inspectability, research assets and reusable capability | Can the buyer operate and maintain it effectively? [Apertus official website](https://www.apertus-ai.org/) |
| Locally integrated enterprise ecosystem | Russia/GigaChat | Domestic products and workflows | How portable and internationally supported is the solution? [Sber GigaChat model documentation](https://developers.sber.ru/docs/ru/gigachat/models/main) [Sber call-summary deployment report](https://bosfera.ru/press-release/sberbank-zapustil-otpravku-v-chat-rezyume-zvonkov-na-goryachuyu-liniyu) |

**Business interpretation:** “Sovereign AI” is better understood as a portfolio of control choices than as a single technology category.

## Famous cross-border examples

The following cases distinguish **documented deployment**, **announced partnership**, **pilot** and **platform availability**. These should not be conflated.

### HSBC and Mistral

**Direction:** France → British-headquartered global banking.

HSBC announced a multiyear partnership with Mistral in December 2025, including access to commercial models and collaborative development using self-hosted models on HSBC’s internal technology systems. [HSBC–Mistral partnership reporting](https://www.theregister.com/software/2025/12/01/hsbc-partners-with-mistral-ai-to-sharpen-in-house-llms/2662926)

The announcement identifies internal productivity as an existing area and customer-facing lending, onboarding, fraud and anti-money-laundering improvements as future areas of focus—not proof that every proposed application was already operating at scale. [HSBC–Mistral partnership reporting](https://www.theregister.com/software/2025/12/01/hsbc-partners-with-mistral-ai-to-sharpen-in-house-llms/2662926)

**Why this matters:** A foreign model can be selected precisely because it supports greater customer deployment control. **Foreign origin does not necessarily mean foreign-operated inference.**

### Fujitsu and Cohere

**Direction:** Canadian-origin enterprise model capability → Japanese adaptation.

Takane launched in September 2024, combining Cohere’s Command R+ with Fujitsu’s Japanese-language training and fine-tuning for secure enterprise environments. [Fujitsu Takane launch announcement](https://www.fujitsu.com/global/about/resources/news/press-releases/2024/0930-01.html)

The offering targets specialised business use, including document understanding and workflows in regulated industries. [Cohere Fujitsu customer story](https://cohere.com/customer-stories/fujitsu) [Fujitsu Takane enterprise catalogue](https://docs.fujitsu/documents/003331/fujitsu-generative-ai-for-cohere-catalog-jp.pdf)

**Why this matters:** National capability can be created through co-development. “Japanese model” can accurately describe language specialisation and commercial delivery while still requiring disclosure of a foreign foundation.

### GOV.UK and Claude

**Direction:** US model supplier → UK public-service pilot.

In January 2026, Anthropic announced its selection to help build and pilot a Claude-powered GOV.UK assistant, initially supporting people with employment, training and related government services. [Anthropic UK government partnership](https://www.anthropic.com/news/gov-UK-partnership?cmid=4d4cb6e5-a0ef-4215-a883-18ce6e454534)

The engagement included work alongside government engineers with the stated goal that the UK government could independently maintain the system. [Anthropic UK government partnership](https://www.anthropic.com/news/gov-UK-partnership?cmid=4d4cb6e5-a0ef-4215-a883-18ce6e454534)

**Why this matters:** Sovereignty can include **application maintenance capability and institutional knowledge**, even when the underlying model remains externally supplied.

### Taiwan and foreign foundations

**Direction:** Meta and Google foundation models → Taiwanese public-interest adaptation.

TAIDE’s official materials identify Llama- and Gemma-based releases, while the 2026 legal-retrieval embedding model is based on EmbeddingGemma. [TAIDE official website](https://www.taide.tw/) [TAIDE legal-retrieval model announcement](https://www.taide.tw/public/latest-updates_show?id=4b1141869e0b03b6019eba7e34760001)

**Why this matters:** The useful unit of analysis is the full lineage: upstream foundation, local adaptation, local data and eventual operator. A local name alone hides that structure.

### London School of Economics and Claude

**Direction:** US model supplier → UK higher education.

Anthropic identifies the London School of Economics as a UK partner providing students with access to Claude. [Anthropic UK government partnership](https://www.anthropic.com/news/gov-UK-partnership?cmid=4d4cb6e5-a0ef-4215-a883-18ce6e454534)

**Why this matters:** Cross-border model dependence is not confined to national infrastructure or sensitive government systems; it also enters organisations through education and everyday knowledge work.

### Mistral through global platforms

**Direction:** French models → international cloud and developer distribution.

Mistral’s release announcement lists availability through platforms including Amazon Bedrock, Azure Foundry, IBM watsonx and several independent inference providers. [Mistral 3 release announcement](https://mistral.ai/news/mistral-3/?__hstc)

**Why this matters:** The model developer, marketplace and infrastructure operator can be different companies with different jurisdictions.

**Evidence boundary:** Marketplace availability is a distribution example. It is not evidence that a named enterprise has deployed the model or obtained a particular sovereign configuration.

### Cohere through Oracle

**Direction:** Canadian-origin models → a US cloud-provider channel.

Oracle’s documentation lists Cohere Command A as a supported model, providing a concrete example of one country’s model capability distributed through another country’s infrastructure provider. [Oracle Cohere Command A documentation](https://docs.oracle.com/en-us/iaas/Content/generative-ai/cohere-command-a-03-2025.htm)

**Why this matters:** Buying through a familiar cloud account does not make every model on that platform native to the cloud provider’s country.

### The cross-border pattern

The most useful documented patterns are not simply “Country A buys Country B’s chatbot”. They include self-hosting, co-development, local-language adaptation, public-service pilots and third-party distribution. [HSBC–Mistral partnership reporting](https://www.theregister.com/software/2025/12/01/hsbc-partners-with-mistral-ai-to-sharpen-in-house-llms/2662926) [Fujitsu Takane launch announcement](https://www.fujitsu.com/global/about/resources/news/press-releases/2024/0930-01.html) [Anthropic UK government partnership](https://www.anthropic.com/news/gov-UK-partnership?cmid=4d4cb6e5-a0ef-4215-a883-18ce6e454534) [TAIDE official website](https://www.taide.tw/) [Mistral 3 release announcement](https://mistral.ai/news/mistral-3/?__hstc)

**Business interpretation:** AI trade increasingly involves separate transactions for intelligence, infrastructure, adaptation and application delivery. Evaluate those transactions separately.

## Seven layers of sovereignty

The following is a proposed executive framework, not an official standard.

| Layer | Practical control test | Evidence to request |
|---|---|---|
| Data | Can you determine where inputs, outputs and associated records go? | Data-flow map, retention schedule and subprocessor list |
| Model | Can you inspect, retain and operate the relevant model? | Model card, licence, weights access and version policy |
| Application | Can your team maintain the workflow without the original integrator? | Source access, documentation and handover test |
| Operations | Can you control access, updates, monitoring and incident response? | Administration model, audit logs and change procedures |
| Infrastructure | Can you continue running if a provider changes terms or withdraws? | Capacity commitments, dependencies and recovery plan |
| Legal | Do contracts and applicable obligations match the intended use? | Contracting-entity map and qualified legal assessment |
| Economic | Can you switch without losing accumulated business capability? | Export formats, migration test and exit costs |

**Recommended interpretation:** High control at one layer does not compensate automatically for low control at another.

An organisation may possess model weights but lack the people or capacity to operate them. Another may use a managed service while retaining strong contractual rights, portable application code and a tested alternative model.

### Sovereignty versus autarky

The UK’s current policy advice explicitly treats sovereignty as sufficient agency across the value chain and recommends trusted access alongside selected domestic capability. It does not define sovereignty as eliminating every foreign component. [UK Council for Science and Technology sovereignty paper](https://www.gov.uk/government/publications/ai-sovereignty-preserving-uk-agency-in-an-ai-enabled-world)

**Business interpretation:** The realistic objective is usually **manageable dependence**, not zero dependence.

That means knowing where reliance is acceptable, where it creates unacceptable exposure, and where an alternative must be ready.

## Open is not one thing

Open weights, open-source code, transparent training and unrestricted commercial use are different properties.

| Release pattern | Verified example | What to check |
|---|---|---|
| Hosted access without downloadable weights | Muse Spark’s initial product and selected-API access | Availability, contractual controls and switching options. [Meta Muse Spark announcement](https://about.fb.com/news/2026/04/introducing-muse-spark-meta-superintelligence-labs/) |
| Permissively licensed downloadable models | Mistral 3 under Apache 2.0; Qwen3 releases under Apache 2.0 | Exact checkpoint, accompanying components and deployment requirements. [Mistral 3 release announcement](https://mistral.ai/news/mistral-3/?__hstc) [Qwen3 announcement](https://qwen.ai/blog?id=qwen3) |
| Downloadable models under custom terms | Llama releases | The specific version’s licence and acceptable-use conditions. [Meta model overview — secondary source](https://unitedstatesofamericasuperintelligence.com/companies/meta/) |
| Modified permissive licence | Kimi K2.5 under Modified MIT | The actual modifications rather than assuming ordinary MIT terms. [Kimi K2.5 model card](https://huggingface.co/moonshotai/Kimi-K2.5) |
| Extensive development transparency | Apertus and Olmo 3 | Which data, recipes, checkpoints and dependencies are actually available. [Apertus official website](https://www.apertus-ai.org/) [Olmo 3 technical report](https://arxiv.org/html/2512.13961v2) |
| Mixed licensing within one portfolio | Cohere’s model catalogue | Whether the selected product permits your intended commercial use. [Cohere model catalogue](https://cohere.com/models-overview) |

**Recommended rule:** Never approve a model because someone says it is “open source”. Approve the **specific release, licence, operating configuration and use case**.

### What weights do not prove

Possession of weights does not, on its own, establish:

- That training data is available or legally suitable.
- That the training process is reproducible.
- That all required software is independently maintainable.
- That the model performs acceptably in your language and industry.
- That you can afford to operate it at the required service level.
- That your security team has assessed the full deployment.

Apertus and Olmo are useful reference points because their documented transparency extends beyond final weights. They should not be treated as evidence that every downloadable model offers the same visibility. [Apertus official website](https://www.apertus-ai.org/) [Olmo 3 technical report](https://arxiv.org/html/2512.13961v2)

## What location does not settle

### Local hosting

**Recommended interpretation:** “Hosted in our country” should trigger a follow-up investigation, not end it.

Ask whether the claim covers:

- Inference processing.
- Uploaded files and retrieval databases.
- Logs and abuse-monitoring records.
- Backups and disaster recovery.
- Support and administrator access.
- External tools called by agents.
- Model-update and licence dependencies.

**Contracting principle:** Require explicit statements for each relevant component rather than a general assurance about a “local region”.

### Local branding

Takane and TAIDE illustrate why provenance needs to be visible: both add local capability while documenting foreign foundations. That is not inherently a weakness; it is a dependency to understand. [Fujitsu Takane launch announcement](https://www.fujitsu.com/global/about/resources/news/press-releases/2024/0930-01.html) [TAIDE official website](https://www.taide.tw/)

**Recommended interpretation:** Ask what “locally developed” means in operational terms: trained from scratch, continued pretraining, fine-tuning, retrieval integration or simply a local interface.

### Local language

A model’s ability to communicate in a language is not identical to understanding local law, administrative processes or industry terminology.

TAIDE’s specialist legal-retrieval release and Takane’s enterprise-language focus illustrate deliberate adaptation beyond a generic claim of multilingual support. [TAIDE legal-retrieval model announcement](https://www.taide.tw/public/latest-updates_show?id=4b1141869e0b03b6019eba7e34760001) [Fujitsu Takane enterprise catalogue](https://docs.fujitsu/documents/003331/fujitsu-generative-ai-for-cohere-catalog-jp.pdf)

**Recommended test:** Evaluate on real local documents and tasks, with native-speaking domain experts—not translation quality alone.

## Policy and geopolitics

### Export controls are moving targets

US semiconductor policy cannot safely be reduced to a permanent map of “allowed” and “banned” countries. BIS announced the rescission of the January 2025 AI Diffusion Rule, and its later published updates describe case-by-case review for specified advanced-chip exports to China under conditions. [BIS policy news and updates](https://www.bis.gov/news-updates)

**Business implication:** An infrastructure business case should identify which assumptions depend on export permissions, approved customers, hardware availability or policy continuity.

**Recommended practice:** Review the live rule and transaction facts with specialists before committing capital. Historical policy summaries are not a substitute.

### Service rules follow deployment

China’s generative-AI interim measures are explicitly concerned with services offered to the public within mainland China. Their scope is not determined solely by the nationality of the model developer. [China generative AI interim measures](https://www.cac.gov.cn/2023-07/13/c_1690898327029107.htm)

**Business implication:** A multinational needs deployment-by-deployment analysis. “We use the same model worldwide” does not mean the regulatory analysis is identical everywhere.

### Transparency is not legal immunity

Apertus’s published materials emphasise documented training, data handling and compliance-oriented design. Those disclosures improve inspectability; they do not eliminate the need to assess the downstream application. [Swiss Apertus launch overview](https://swiss.tech/news/switzerland-launches-its-first-open-and-transparent-ai-model) [European Open Source AI Index: Apertus](https://osai-index.eu/model/apertus/)

**Recommended distinction:** Separate the rights to use a model from the lawfulness of the data, decisions and outputs in your particular workflow.

## What leaders should own

The following recommendations are strategic analysis.

### Own business-specific assets

Prioritise control over:

- **Workflow definitions:** The sequence of tasks, approvals and business rules.
- **Evaluation sets:** Real examples that define acceptable performance.
- **Knowledge assets:** Documents, taxonomies, retrieval indexes and permissions.
- **Integration contracts:** Interfaces to your CRM, ERP, finance and service systems.
- **Decision records:** Why a model was approved and what limitations were accepted.
- **Migration capability:** The ability to move these assets to another model.

These assets are often more directly related to your competitive advantage than ownership of a general-purpose foundation model.

### Rent selectively

Managed frontier services can be appropriate when speed, capability and operational simplicity outweigh the need for direct control.

Treat that as an explicit choice rather than a default you discover later. Record what would force a change: pricing, service withdrawal, unacceptable performance, contractual changes or a new regulatory requirement.

### Build independence where necessary

Consider private or independently operable deployment where the workflow has high consequences, strong confidentiality requirements or limited tolerance for supplier interruption.

Do not assume private deployment is automatically better. Include staffing, security, patching, capacity, model upgrades and incident response in the cost comparison.

## A workload-based decision guide

This is a recommended procurement framework, not a statement of legal requirements.

| Workload | Starting posture | Main control question |
|---|---|---|
| Public marketing copy | Managed service may be proportionate | Can outputs be reviewed and confidential inputs excluded? |
| Internal drafting | Approved enterprise environment | What is retained, who can access it, and what material may staff submit? |
| Customer-service assistance | Controlled retrieval and monitored deployment | Can responses be traced to approved knowledge and escalated? |
| Confidential document analysis | Explicit data-handling and access controls | Do processing, support and retention arrangements meet the organisation’s requirements? |
| Regulated decision support | Domain evaluation and formal governance | Can the organisation explain, validate and supervise the system? |
| Business-critical autonomous agents | Tight permissions and tested continuity | Can the system be stopped, audited and moved without disrupting the business? |
| National-security-sensitive work | Specialist procurement and security assessment | Which dependencies are unacceptable regardless of commercial convenience? |

**Recommended principle:** Sovereignty requirements should scale with the consequences of failure—not the prestige of the AI project.

## The procurement checklist

### Provenance

- Who developed the exact model?
- What is the checkpoint or version identifier?
- Was it trained from scratch or derived from another model?
- Which upstream licences apply?
- What is known—and unknown—about training data?
- Who is responsible for maintaining the model?

### Data and operations

- Where does each category of data travel?
- Who can access prompts, documents, outputs and logs?
- Are inputs used for training or other service improvement?
- What retention and deletion commitments apply?
- Which subprocessors and external tools are involved?
- Can the deployment run without contacting the model developer?

### Commercial continuity

- What happens if the API is withdrawn?
- Can you retain and operate a frozen version?
- How much notice applies to model retirement?
- Can prompts, retrieval assets and evaluation results be exported?
- What does migration cost?
- Has a replacement been tested on the actual workload?

### Governance

- Who approves model changes?
- Which evaluations must a new version pass?
- Who can grant agents access to business systems?
- What actions require human approval?
- How are failures investigated?
- Who owns the decision to suspend the system?

## The model passport

Use this template for each material deployment.

```yaml
deployment:
  name:
  business_owner:
  technical_owner:
  business_purpose:
  criticality:
  approval_date:
  next_review_date:

model:
  developer:
  developer_country:
  ultimate_owner:
  family:
  exact_version:
  upstream_model:
  adaptation_method:
  licence:
  weights_available:
  training_data_disclosure:
  known_limitations:

service:
  contracting_entity:
  operator:
  cloud_provider:
  inference_location:
  storage_locations:
  support_access_locations:
  subprocessors:
  external_tools:
  retention:
  training_use_of_inputs:

control:
  can_self_host:
  can_freeze_version:
  can_modify:
  can_export_application:
  independent_operating_capability:
  update_approval_process:
  shutdown_mechanism:

continuity:
  alternative_model:
  evaluation_status:
  migration_time:
  migration_cost:
  capacity_dependencies:
  hardware_dependencies:
  policy_dependencies:

evidence:
  model_card:
  licence_url:
  service_terms:
  data_processing_terms:
  architecture_record:
  evaluation_record:
  approval_record:
```

**Recommended discipline:** Unknown fields should remain explicitly unknown. Do not fill them with assumptions based on the vendor’s headquarters.

## Business opportunities

These are strategic hypotheses to investigate, not established market-size claims.

| Opportunity | Customer problem | Practical offer |
|---|---|---|
| Sovereignty assessment | Leaders cannot see their real dependencies | Deployment inventory, model passports and exposure analysis |
| Local-language assurance | Generic benchmarks miss local business requirements | Native-language evaluation sets and domain testing |
| Private model operations | Customers want control but lack operating capability | Managed deployment, updates, security and incident support |
| Model portability | Applications are tied to one supplier | Model abstraction, migration testing and alternative-model qualification |
| Provenance assurance | Buyers cannot distinguish original models from adaptations | Lineage, licence and documentation reviews |
| Sovereign agent architecture | Sensitive data can leave through tools rather than the model endpoint | End-to-end data-flow and permission design |
| Public-asset commercialisation | Open research models need usable enterprise delivery | Supported hosting, integration and sector-specific adaptation |

Swisscom’s distribution of Apertus and Fujitsu’s commercialisation of Takane provide two concrete reference patterns: commercial delivery around a public research model, and local enterprise adaptation of an international model. [Apertus official website](https://www.apertus-ai.org/) [Fujitsu Takane launch announcement](https://www.fujitsu.com/global/about/resources/news/press-releases/2024/0930-01.html)

**Strategic interpretation:** The opportunity is often not “build a national ChatGPT”. It is making a specific level of control, language relevance or operational resilience usable for a particular customer.

## Misconceptions to challenge

| Claim | Better interpretation |
|---|---|
| “It was developed here, so it is sovereign.” | Establish ownership, lineage, infrastructure and operating rights. |
| “The data centre is local, so the whole service is local.” | Examine access, logs, backups, tools and subprocessors. |
| “Open weights means fully open.” | Inspect data, code, training documentation and licence separately. |
| “A foreign model means data goes abroad.” | Determine the actual deployment architecture. |
| “A national model must be trained from scratch.” | Decide whether independent pretraining is necessary for the objective. |
| “A partnership announcement proves production adoption.” | Separate plans, pilots, availability and verified operating deployments. |
| “The strongest benchmark score determines the best choice.” | Evaluate the workload, governance and total operating model. |
| “Using multiple models guarantees independence.” | Check whether they still share the same cloud, hardware or operational dependencies. |

The verified examples directly challenge several of these shortcuts: HSBC plans self-hosted use of a foreign model; Takane and TAIDE use foreign foundations; Apertus and Olmo disclose substantially more than final weights. [HSBC–Mistral partnership reporting](https://www.theregister.com/software/2025/12/01/hsbc-partners-with-mistral-ai-to-sharpen-in-house-llms/2662926) [Fujitsu Takane launch announcement](https://www.fujitsu.com/global/about/resources/news/press-releases/2024/0930-01.html) [TAIDE official website](https://www.taide.tw/) [Apertus official website](https://www.apertus-ai.org/) [Olmo 3 technical report](https://arxiv.org/html/2512.13961v2)

## How to read announcements

Apply this evidence ladder before using an announcement in a board presentation or investment thesis.

| Evidence level | What it establishes | What it does not establish |
|---|---|---|
| Political ambition | A government wants a capability | Funding, delivery or adoption |
| Funding announcement | Resources have been announced | Operational infrastructure or successful models |
| Partnership agreement | Organisations intend to work together | Completed integration or commercial results |
| Model release | A model is accessible under stated conditions | Production suitability |
| Cloud listing | A distribution channel exists | Named customer use or sovereign configuration |
| Pilot | A bounded test is under way | Organisation-wide deployment |
| Named production case | A specified workflow is operating | Broader adoption or independently verified ROI |
| Independently evaluated outcome | A defined result has supporting evidence | Automatic transferability to another organisation |

**Recommended writing discipline:** Use verbs precisely: *proposed, funded, released, available, piloting, deployed,* and *evaluated* are not synonyms.

## Coverage gaps

This edition should **not** be presented as a complete worldwide country ranking.

A subsequent research pass should prioritise:

- **India:** Domestic foundation-model programmes, Indian-language models and public compute.
- **United Arab Emirates:** Domestic model families, Arabic-language capability and international infrastructure partnerships.
- **Saudi Arabia:** Model development, Arabic capability and compute-led industrial strategy.
- **South Korea:** Domestic model developers and government-backed capability programmes.
- **Singapore:** Regional-language models, public-sector deployment and international partnerships.
- **Additional Europe:** Spain, Finland, Sweden, Italy and multinational European initiatives.
- **Africa:** Local-language capability, African-led model development and regional infrastructure.
- **Latin America:** Regional model initiatives, language coverage and public-sector adoption.
- **Other major ecosystems:** Further Japanese, German, Chinese and Canadian developers beyond the examples verified here.

For each addition, require the same minimum evidence:

1. An official developer or programme source.
2. A model card or technical publication.
3. The actual licence and deployment terms.
4. A dated national-policy source where national strategy is discussed.
5. A named use case clearly classified as announcement, pilot or production.

## Executive discussion prompts

Use these questions to turn the corpus into a leadership discussion:

1. **What are we trying to protect?** Confidentiality, continuity, legal accountability, local language, national capability—or all of them?
2. **Which dependencies are acceptable?** A foreign model may be acceptable where a foreign-operated service is not.
3. **What must remain operable under pressure?** Identify the workflows that cannot depend on uninterrupted supplier goodwill.
4. **What do we genuinely own?** Distinguish contractual access from retained assets and operating capability.
5. **Where does local adaptation create value?** Language, domain knowledge and workflow fit may matter more than independent pretraining.
6. **How would we switch?** Require a demonstrated path, not a slide claiming “model agnostic”.
7. **What evidence would change our decision?** Define the operational, commercial and policy triggers in advance.
