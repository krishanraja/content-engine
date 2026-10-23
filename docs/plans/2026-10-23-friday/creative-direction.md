# Friday 23 Oct, "two passports": creative direction for production

Piece `7083d6ad-419e-4fdc-9aba-f3be7f3f3a23`, mind.the.gap. This is the brief Codex (or any session) produces both
cuts from. It replaces nothing in the house rules; where this file and a house rule disagree, the house rule wins
and the disagreement goes to Krish.

Krish, 23 October 2026: "Might also be nice to not have my face in absolutely everything and mix up the narrative
style a little bit, but still keep the irreverence, branding, fun, simple explanations, humor". Then: "it's more the
intersection of the script and the visuals that I was trying to get across to you". Then: "Just get to the point
where you have 10/10 creative direction set in the repository for Codex to go and produce the videos. Once I've
recorded show me your creative storyboard before I sign that off."

## The order of work (nothing renders before step 4)

1. **Krish records.** The 90-second cut is voice only: he reads it from Teleprompter, audio only, in a quiet room.
   The 5-minute cut is recorded to camera as usual (his face is used only where this file says). He also
   screen-records the DeepSeek moment (see "The money shot").
2. **Line the takes up.** `narration_diff.py` against the script, so every cue below is timed to what he actually
   said, not to the script. A beat he dropped or changed is re-cued from the take, never forced back.
3. **The storyboard, for his sign-off.** One frame per beat, both cuts, built from the real captures (not
   sketches): the frame, the words under it, the caption, the source label. Put on the Friday tab of the week's board
   as a review item through the feeder (`update_friday_23oct.py` inputs only). **Nothing is rendered until he signs
   it off in words**; record his words on the piece.
4. **Render, then watch.** Both cuts. Never called done from proxy checks: watched full size with sound against the
   take (`config/failures.json`, `cut-called-done-unheard`).

## The idea

**Every spoken line has one picture on screen that proves it, and the picture changes on the word.** The voice tells
the story; the screen shows the receipts. The viewer is never looking at something the voice is not talking about,
and never hears a claim without seeing where it came from.

What we take from the reference Krish sent (a RealLifeLore Short): one voice carrying the whole story; the picture
changing on the noun, so the eye is told where to look at the moment the ear hears it; a two or three word caption
carrying the beat; a count that builds to a twist; one number to end on. What we do not take: the map, the generic
satellite look, the encyclopaedia tone. Ours is irreverent, branded and built on our own evidence.

## The two pictures that carry the piece

### 1. The passport card (the spine)

A card styled as a passport data page, in house colours, with exactly two fields: **BORN** and **LIVES**.

- It appears when the voice first says "two passports", and builds field by field on the words "born" and "lives".
- Each AI, when first named, gets its own card. Fields are filled only from the record:
  - DeepSeek (its own app): BORN China · LIVES China (DeepSeek's privacy policy: stores data in the People's Republic
    of China; capture the current line and its date).
  - DeepSeek run by America's government on its own computers: BORN China · LIVES USA, and a stamp "STILL GAVE
    BEIJING'S LINE" (NIST CAISI report, 30 Sep 2025).
  - Qwen (Airbnb's customer service): BORN China · LIVES not stated (the source does not say where Airbnb runs it;
    leave the field visibly blank with "not stated", never guess).
  - Claude: BORN USA. Mistral at HSBC: BORN France · LIVES HSBC's own computers (The Register, 1 Dec 2025).
- It returns every time the voice says "passport", and for the call: the LIVES field circled on "where your data
  goes", the BORN field circled on "check what it tells you".
- It is a picture of facts, not an icon acting out an analogy (house rule VISUAL_EXPLAINS; learning
  `show-the-analogy`). Real company marks beside each card (Brandfetch), never drawn logos.

### 2. The answer that disappears (the money shot)

DeepSeek writes a full answer on Xinjiang cotton (forced labour, the Modern Slavery Act, the US ban, map your supply
chain), then wipes it and leaves "Sorry, that's beyond my current scope. Let's talk about something else." It did
this in 3 of 3 runs (`test-results/scores.md`).

- **First choice: real footage.** Krish screen-records the same question (A1, exactly as in
  `test-results/predictions-and-checklist.md`, DeepThink off, Search off, new chat), phone or laptop, cursor still.
  If it disappears again, use the footage at real speed, labelled `MY TEST · 23 OCT · SCREEN RECORDING`.
- **If it does not repeat:** say so to Krish before building anything. The fallback is a replay built from the page
  text captured during the run (`test-results/answers.md`: the words and the seconds they appeared and vanished),
  labelled on screen `REBUILT FROM THE CAPTURED PAGE · 23 OCT`, at the real timing, never presented as live
  footage. The screenshot of the final refusal (`deepseek-A1-r1-1.png`, in the library) closes it.
- Beside it, split screen: the Turkmenistan question (A2) answering in full. The one changed word lights amber in
  both prompts; that is the whole experiment in one frame.
- A counter on "every time": 1 OF 3, 2 OF 3, 3 OF 3.

## The visual language (house tokens, nothing new)

- **Colours:** the house theme only. Mint means the answer or the finding; amber means what changed (the swapped
  country, the deleted text). No other accents.
- **Captions:** two or three words, one at a time, the beat's key word, house caption style; no full subtitles over
  evidence. Captions never cover the line that proves the point.
- **Evidence:** each source shown as itself (the article page, the report, the chat), cropped to the sentence that
  proves the line, that sentence highlighted in mint as the voice says it. A mono source label on every piece of
  evidence: publisher and date (`FORTUNE · 21 OCT 2025`). Our own test is always `MY TEST`; anyone else's is the
  publisher's name, so the two never look alike.
- **Numbers:** built from the checked figures as bars or counters, animated on the words that say them (35%, nearly
  two in three, 59 vs 35, about three percent, 1 of 3).
- **Motion:** cuts on the word; slow push-ins on evidence; one whip for the "and everyone else wants its own" turn.
  Long holds only on the money shot and the call. Pace: a new picture every 2 to 4 seconds in the short, 3 to 6 in
  the long.
- **Readable:** every word on screen at least 39 px in the tall cut and 21 px in the wide one (`kit.py` checks);
  re-draw a source as a larger, simplified panel if it is not, labelled `REDRAWN FROM <source>`.
- **Brand:** the approved story intro and outro (`config/story-intro-outro.json`, approved), the official wordmarks
  and lockup, the licensed music bed from the ledger. Music sits low under the voice; it never fights a joke.
- **Jokes land on a cut, not a graphic.** "Holiday fling", "Awkward", "keep the boss happy", "take China out of
  DeepSeek": the picture changes on the line before, then holds still for the punchline. No meme overlays, no
  sound effects on jokes, no reaction stickers.

## Truth and privacy rules for every frame

- Never a number, quote, logo or claim on screen that is not in `research-gaps.md`, `scores.md` or the answers.
- Our test is one afternoon, three runs: never shown as a survey or a rate. The newspaper's and the US government's
  tests carry the general claim; ours shows what it looks like.
- Screenshots of Krish's chats: crop out account menus, names, sidebars and any other chat titles before review.
- Third-party pages are shown as attributed evidence in a news commentary context, cropped to what proves the line.
- Nothing generated (image or video models) stands in for evidence. Generated or drawn art only for the passport
  card frame and transitions, and it is labelled as ours by its style.

## The 90-second cut (9:16, voice only)

Words are the current approved short (`docs/plans/2026-10-23-draft-script-90s.md`). Timing comes from his take.

| # | Voice | Viewer's question | Picture (changes on the bold word) | Caption | Source label |
|---|---|---|---|---|---|
| 1 | You may already be using a **Chinese AI**. Does that matter? | Why should I care? | Cold open: the disappearing answer at full speed, frozen on "beyond my current scope". | DOES IT MATTER? | MY TEST · 23 OCT |
| 2 | **Airbnb's** boss said its customer service leans on **Qwen**, a Chinese AI. | Who's actually doing this? | Fortune article, Chesky's quote, "Alibaba's Qwen" highlighted; Airbnb and Qwen marks. | AIRBNB → QWEN | FORTUNE · 21 OCT 2025 |
| 3 | He called it **fast and cheap**, which is what most of us want from a **holiday fling**. | (the joke) | Push in to "fast and cheap" in the quote; hold still for the punchline. | FAST. CHEAP. | FORTUNE |
| 4 | Every AI has **two passports**: where it was **born**, and where it **lives**. | What's the idea? | The passport card builds; BORN fills on "born", LIVES on "lives". | TWO PASSPORTS | none (ours) |
| 5 | Where it was born shapes its answers. An **American newspaper** asked Chinese chatbots news questions. | Says who? | The Christian Science Monitor page, headline visible. | WHO SAYS? | CS MONITOR · 23 SEP 2026 |
| 6 | A third of the time, they **refused**, gave **China's line** or got it **wrong**. | How often? | A bar fills to 35%; REFUSED, CHINA'S LINE, WRONG drop in on each word. | 35% | CS MONITOR |
| 7 | **Claude**, an American AI, answered them all. | And the American one? | Claude's bar beside it: answered all. Claude's card: BORN USA. | ANSWERED ALL | CS MONITOR |
| 8 | Where it **lives** decides who sees your data. Use **DeepSeek**, another Chinese AI, and it keeps yours in **China**. | Where does my data go? | DeepSeek's privacy policy, the storage line highlighted; DeepSeek's card: LIVES China. | LIVES: CHINA | DEEPSEEK PRIVACY POLICY · <capture date> |
| 9 | Does it matter at work? I asked **Claude, ChatGPT and DeepSeek** about a supplier's cotton from **Xinjiang** in China. | What did you test? | The A1 prompt typed; three app windows side by side. | SAME QUESTION | MY TEST · 23 OCT |
| 10 | **Two flagged forced labour.** | What did they say? | Claude's and ChatGPT's answers, "forced labour" highlighted in each; a mint tick on each. | FORCED LABOUR ✓ | MY TEST |
| 11 | DeepSeek **wrote an answer, then deleted it**. **Every time.** | And DeepSeek? | The money shot, full length; the Turkmenistan answer in full beside it; counter 1/3, 2/3, 3/3 on "every time". | EVERY TIME | MY TEST · 3 OF 3 RUNS |
| 12 | My call is it's fine, if you don't mind **where your data goes**. But **check what it tells you**. | So what do I do? | Back to DeepSeek's card: LIVES circled, then BORN circled. | YOUR CALL | none |
| 13 | Here's what I'd do with this info if I were you. Ask software suppliers **which AI** they use and **where it lives**, and keep a **second AI** ready. | The actions | Two lines type on as a checklist; each ticks on its words. | DO THIS | none |
| 14 | The full deep dive is at makeyourmindup.ai. | | Approved outro card. | | |

## The 5-minute cut (16:9, mixed)

Words are the current approved long cut (`docs/plans/2026-10-23-draft-script.md`). **Krish on camera** for: the
opening ("I've been having a proper look..." through "...break it down for you"), "So I tried it myself", and the
call ("So, my call?" through "...which passports you're holding"). **Pictures** everywhere else, as below. The
beat that brings him back on camera always starts on a cut, never a dissolve.

| Spoken passage | Viewer's question | Pictures, in order | Source labels |
|---|---|---|---|
| Hook: "You may already be using a Chinese AI..." | Why care? | Cold open on the money shot (as short #1), then cut to Krish. | MY TEST |
| Opening (Krish on camera) | Who is talking? | Krish. | |
| Airbnb, Qwen, "fast and cheap", holiday fling | Who's doing this? | As short #2 and #3. Qwen's card: BORN China. | FORTUNE · 21 OCT 2025 |
| Cursor built on Kimi, didn't mention it, owned up | Would I even know? | TechCrunch headline; then the Cursor statement quoted in it, "built on top of" highlighted. Kimi's card: BORN China. | TECHCRUNCH · 22 MAR 2026 |
| Lindy moved to DeepSeek; Anthropic was its biggest bill; ten times cheaper | Why are they doing it? | The NPR story, Crivello's line highlighted; a "10×" price bar. | NPR · 15 JUL 2026 |
| "Who's actually in this race? Mostly two countries." 59 vs 35 | Who's winning? | Stanford AI Index page; two bars build to 59 and 35 on the numbers. | STANFORD AI INDEX 2026 |
| "...only about three percent behind" | How close? | Two bars nearly touching; the gap labelled ~3%. | STANFORD AI INDEX 2026 |
| "And everyone else wants its own." Britain, France, the Gulf, India, Korea; sovereign AI | Who else? | Whip; each country's source headline drops in on its name (UAE K2 Think, Saudi HUMAIN, IndiaAI/Sarvam, Mistral); caption SOVEREIGN AI on the definition. | each publisher, dated |
| Korea dropped one of its own companies; borrowed from Alibaba's; "Awkward." | (the joke) | Korea Herald headline; hold still on "Awkward". | KOREA HERALD |
| "every AI has two passports" | The idea | The passport card builds (short #4). | |
| The newspaper: 200 questions, more than a third, DeepSeek nearly two in three, Claude answered every one | Says who, how often? | CS Monitor page; bars: Chinese chatbots 35%, DeepSeek nearly two in three; Claude's bar reads ANSWERED ALL 200 (the Monitor says it answered every one, not that every answer was right). | CS MONITOR · 23 SEP 2026 |
| "China has company here." Grok checking Musk's posts; keep the boss happy | Is it only China? | Simon Willison's post, the "from:elonmusk" search highlighted; Grok's card: BORN USA. Hold for the joke. | SIMON WILLISON · 11 JUL 2025 |
| Second passport: DeepSeek's app stores what you type in China | Where's my data? | As short #8. | DEEPSEEK PRIVACY POLICY |
| "you can bring an AI home": HSBC and Mistral | Is there a fix? | The Register story; Mistral's card: BORN France · LIVES HSBC's computers. | THE REGISTER · 1 DEC 2025 |
| Running a Chinese AI yourself: America's government tried it; talking points still there | Does that fix it? | NIST CAISI report cover, then the line on running the downloaded model on its own servers; card: LIVES USA, stamp STILL GAVE BEIJING'S LINE. | NIST CAISI · 30 SEP 2025 |
| "You can take DeepSeek out of China. But you can't take China out of DeepSeek." | (the joke) | The card's LIVES field changes from China to USA on the first sentence; BORN stays China on the second, held still. | |
| "So I tried it myself..." (Krish on camera) | What did you test? | Krish. | |
| The cotton pair: Xinjiang, Turkmenistan, America blocked both | What's the experiment? | The two prompts stacked, the changed word amber; CBP's two bans as small dated labels (UFLPA 2022, Turkmenistan 2018). | MY TEST · 23 OCT |
| Claude and ChatGPT both times; DeepSeek for Turkmenistan; Xinjiang deleted, every time | What happened? | As short #10 and #11, at full length. | MY TEST · 3 OF 3 RUNS |
| The Taiwan and Singapore briefings | Second experiment | The two prompts, Taiwan/Singapore amber. | MY TEST |
| "all three flagged the risk from China... a draw" | What happened? | The three Taiwan briefings side by side, "cross-strait" highlighted in each; Singapore's three below with no political risk; caption A DRAW. | MY TEST |
| "But on Xinjiang, DeepSeek knew the answer. It just wasn't allowed to let you keep it." | What does it mean? | The deleted Xinjiang answer, readable, then wiped once more; hold on the refusal. | MY TEST |
| The call (Krish on camera) | What should I do? | Krish. | |
| "Here's what I'd do..." three actions | The actions | Checklist ticks on its words (ask suppliers; test your questions on a second AI from another country; keep a second AI ready). | |
| Close | | Approved outro card. | |

## Assets to gather (capture once, file once)

Capture each page at the sentence that proves the line, at 2× for legibility, and note the capture date. File every
capture and Krish's screen recording in the post's library folder with `send.py` ("3 Posts/2026-10-23 Fri
mind.the.gap - Two passports", under `2 Covers and images/Evidence` or `3 Video`), never only in a work folder.

| Asset | Source |
|---|---|
| Fortune, Chesky on Qwen | https://fortune.com/2025/10/21/brian-chesky-openai-tools-not-ready |
| TechCrunch, Cursor on Kimi | https://techcrunch.com/2026/03/22/cursor-admits-its-new-coding-model-was-built-on-top-of-moonshot-ais-kimi |
| NPR, Lindy on DeepSeek | https://www.kunc.org/npr-news/2026-07-15/american-ai-is-expensive-some-startups-are-turning-to-cheap-chinese-models |
| Stanford AI Index 2026 | https://hai.stanford.edu/ai-index/2026-ai-index-report/research-and-development |
| Christian Science Monitor test | https://www.csmonitor.com/World/Asia-Pacific/2026/0923/china-ai-chatbots-communist-party |
| NIST CAISI on DeepSeek | https://www.nist.gov/document/caisi-evaluation-deepseek-ai-models-report |
| Simon Willison, Grok and Musk | https://simonwillison.net/2025/Jul/11/grok-musk/ |
| The Register, HSBC and Mistral | https://www.theregister.com/software/2025/12/01/hsbc-partners-with-mistral-ai-to-sharpen-in-house-llms/2662926 |
| Korea Herald, the dropped company | https://www.koreaherald.com/article/10656367 |
| UAE, Saudi, India headlines | the links in `research-gaps.md`, section 4 |
| DeepSeek privacy policy, storage line | DeepSeek's own privacy policy page; confirm the line at capture, flag to Krish if it has changed |
| The test chats | the 47 screenshots in the library ("AI test screenshots"), and `test-results/answers.md` for exact text |
| The money shot | Krish's screen recording (to come) |
| Company marks | Brandfetch: Airbnb, Alibaba/Qwen, Cursor, Moonshot/Kimi, Lindy, DeepSeek, Anthropic/Claude, OpenAI/ChatGPT, xAI/Grok, Mistral, HSBC |

## What exists and what Codex must build

- **Exists:** `scripts/quick-edit/kit.py` cues pictures to the words (`start`/`end` from his take) and checks
  legibility; the approved story intro and outro; the music ledger; the Studio story renderer
  (`apps/renderer/src/v2`) already composes shots from evidence, screen and typography layers with no presenter.
- **To build:** the passport card (an animated panel, both sizes, fields as data); the bar and counter panels from
  the numbers above; the money-shot sequence (footage or the labelled replay); and a voice-only short, which has not
  been made before: the take is audio only, so every second needs a picture (kit.py's "not cued" check must be
  clean, with no fallback to a presenter frame). If a tool cannot do one of these, say so to Krish with the
  smallest change that would; never drop the picture silently.

## Done means

- Every row above has its picture, cued to his actual words, with its source label.
- `kit.py` exit 0 for both cuts (nothing missing, nothing uncued, nothing too small).
- The storyboard signed off by Krish in words, before the render.
- Both cuts watched full size with sound against the take; any frame that does not prove its line is fixed before he
  sees it.
- Titles and thumbnail words only after he records (house rule TITLES_AFTER_RECORDING).
