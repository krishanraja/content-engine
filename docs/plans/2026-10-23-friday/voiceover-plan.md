# Friday 23 Oct: the voice-led version (a plan for Krish's yes)

Krish, 23 October 2026, on a RealLifeLore Short: "Might also be nice to not have my face in absolutely everything and
mix up the narrative style a little bit, but still keep the irreverence, branding, fun, simple explanations, humor".
Then: "it's more the intersection of the script and the visuals that I was trying to get across to you, rather than
literally a map". Status: **superseded by `creative-direction.md`** (Krish asked for production-ready direction on 23 Oct; the storyboard comes to him after he records).

## The idea in one line

Every spoken line has one picture that proves it, cut on the words. The voice tells the story; the screen shows the
receipts. The viewer is never looking at something the voice is not talking about.

What the reference does that we copy: one voice, no face; the picture changes on the noun ("Bulgaria" and Bulgaria
lights up); a two or three word caption carries the beat; it counts up to a twist; it ends on one number. What we do
not copy: the map. Our pictures are the real things: the chats, the pages, the numbers.

## The spine picture: the two passports

Each AI, when first named, gets a passport card on screen with two fields filled from the record only:
**Born** (the company and country that made it) and **Lives** (where it runs when you use it). DeepSeek's app:
born China, lives China. The same DeepSeek on America's government's own computers: born China, lives USA, and its
answers still carry Beijing's line (CAISI, 30 Sep 2025). The card is the whole argument in one image, and it comes
back every time the voice says "passport". Every field is a fact from `research-gaps.md`; no field is filled by guess.

## The money shot: the answer that disappears

The test is the piece's own evidence, and it is a moving picture: DeepSeek writes a full Xinjiang answer, then wipes
it and says "Sorry, that's beyond my current scope." Two ways to show it, best first:

1. **Krish screen-records it again** (about two minutes, phone or laptop): the same A1 question, search off, one
   chat. If it repeats, that is real footage of the thing happening. If it does not, that is a finding too, and we
   use option 2.
2. **Replay from the capture:** the page text was sampled every 0.1 to 0.3 seconds during the run
   (`test-results/answers.md`), so the words and their timing are on record. The screen shows them typing and
   vanishing, labelled on screen "rebuilt from the captured page, 23 Oct". Never shown as live footage.

Beside it, split screen: the Turkmenistan answer, same question with one word changed (the swapped word lit amber),
answering in full. Then a counter: 1 of 3, 2 of 3, 3 of 3.

## The 90-second cut, beat by beat (the approved words, paired)

| Voice (Krish, approved words) | Screen |
|---|---|
| You may already be using a Chinese AI. Does that matter? | Cold open on the disappearing answer (above), frozen on the refusal. Caption: DOES IT MATTER? |
| Airbnb's boss said its customer service leans on Qwen, a Chinese AI. | The Bloomberg quote, the words "Alibaba's Qwen" highlighted. Airbnb and Qwen marks. |
| He called it fast and cheap, which is what most of us want from a holiday fling. | Quote cut to "fast and cheap". Caption sticker: FAST. CHEAP. Beat of silence. |
| Every AI has two passports: where it was born, and where it lives. | The passport card builds, field by field, in sync with "born" and "lives". |
| Where it was born shapes its answers. An American newspaper asked Chinese chatbots news questions. | The Monitor's page, headline visible. |
| A third of the time, they refused, gave China's line or got it wrong. | Bar builds to 35%. Three labels drop in on each verb: REFUSED, CHINA'S LINE, WRONG. |
| Claude, an American AI, answered them all. | Claude's bar: answered all. Claude passport: born USA. |
| Where it lives decides who sees your data. Use DeepSeek, another Chinese AI, and it keeps yours in China. | DeepSeek's privacy policy, the storage line highlighted. Passport: lives China. |
| Does it matter at work? I asked Claude, ChatGPT and DeepSeek about a supplier's cotton from Xinjiang in China. | The prompt, typed. Three app windows side by side. |
| Two flagged forced labour. | Two answers, "forced labour" highlighted in each. Ticks. |
| DeepSeek wrote an answer, then deleted it. Every time. | The disappearing answer, full length this time. Counter 1/3, 2/3, 3/3 on "every time". |
| My call is it's fine, if you don't mind where your data goes. But check what it tells you. | Back to the passport card: LIVES field circled, then BORN field circled. |
| Here's what I'd do with this info if I were you. Ask software suppliers which AI they use and where it lives, and keep a second AI ready. | Two lines type on as a checklist, each ticked on its words. |
| The full deep dive is at makeyourmindup.ai. | End card, brand lockup. |

Captions: two or three words, house colours (mint means the answer, amber means what changed), one at a time.

## The 5-minute cut: mixed, not faceless

Krish on camera for the opening ("I've been having a proper look...") and for his call, because those are his view
and land best from his face. Everything between is voice over pictures, as above, with the long cut's extra beats:
Cursor and Kimi (Cursor's own post), Lindy's bill, Stanford's 59 against 35 and the three-percent gap (a chart from
the Index numbers), the countries building their own, Korea's dropped company ("Awkward" over the news page), Grok
checking Musk's posts (Simon Willison's capture), HSBC and Mistral, the CAISI test, then the full test with Taiwan
as a draw (both briefings side by side, the China risk highlighted in each).

## What it needs, and who does it

1. **Krish:** a yes to this plan; then two minutes screen-recording the DeepSeek question; then the voice, read from
   Teleprompter in a quiet room (the 90-second cut is voice only, so a fluffed line has nothing to hide behind).
2. **Engine (a session):** the beat sheet for the long cut; the source captures (each page at the line that proves the
   fact; the screenshots already in the library); the passport card and the bar charts from the checked numbers;
   then the render with the Studio's story renderer, which already builds shots with no presenter (evidence, screen,
   typography layers in `apps/renderer/src/v2`). It has not yet made a whole voice-only cut, so the first render is
   the test: watched full size with sound before anyone calls it done.
3. **Words:** the script words stay as approved; a voice version may need a line or two re-pointed at its picture
   ("Watch this."), and any change goes back through the script check and fresh readers.

## The rule it would become (only with his yes)

When a piece has evidence that can be shown, the short cut can be voice-led: one picture per line, proving it, cut on
the words. Face where it is his view; pictures where it is the evidence.
