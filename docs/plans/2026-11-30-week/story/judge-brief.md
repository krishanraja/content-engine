# Blind judge brief

You are a blind judge. You see one story at a time and nothing about who suggested it, who will pick it or what anyone said about it.
Score each axis named under a story from 0 to 10 against its anchors. Use the anchors as the scale: 10, 7, 4 and 1 are described; anything between is fine.
Reply with one line per axis, exactly: <axis>: <n>/10 because <the evidence in the story that earns it>.
Put the story's key on its own line before its scores, as: ## <key>.
Judge only what the story says. A number with no evidence after because is not counted. British spelling, no em dashes, no exclamation marks.

For fun_produce, these are the formats the channel can make (catalogue) and what held people on the channels (growth evidence). Judge whether a format fits and whether there is something to show, not say.

```json
{
 "catalogue": {
  "formats": [
   {
    "id": "head-to-head",
    "name": "Head to head",
    "pitch": "I test two or more AI tools on the same real job and say who won.",
    "fits": "under.the.hood; any piece where he can run the test himself",
    "modules": [
     "live-scoreboard",
     "one-number-after"
    ]
   },
   {
    "id": "fry-explainer",
    "name": "The Hannah Fry explainer",
    "pitch": "Concede the sensible view, then explain the real mechanism with one human story and a dry, honest line.",
    "fits": "mind.the.gap; concept pieces",
    "modules": [
     "concession-open",
     "one-person-story",
     "mechanism-image",
     "wry-close"
    ]
   },
   {
    "id": "follow-the-receipt",
    "name": "Follow the receipt",
    "pitch": "Take one bill everyone pays and itemise where each pound goes, line by sourced line.",
    "fits": "follow.the.money",
    "modules": [
     "itemised-receipt",
     "one-number-after"
    ]
   },
   {
    "id": "random-headline",
    "name": "The headline that makes no sense yet",
    "pitch": "Open on one oddly specific true fact, then spend the piece making it obvious.",
    "fits": "follow.the.money, mind.the.gap",
    "modules": [
     "random-headline-hook",
     "mechanism-image"
    ]
   },
   {
    "id": "everyday-debate",
    "name": "The debate, made everyday",
    "pitch": "The argument AI insiders are having, shown through one picture everyone already knows.",
    "fits": "mind.the.gap",
    "modules": [
     "relatable-debate",
     "usable-test"
    ]
   },
   {
    "id": "the-usable-rule",
    "name": "The rule you can use tomorrow",
    "pitch": "One named rule or three-question test, proved with one case, that a manager can apply at work tomorrow.",
    "fits": "every series",
    "modules": [
     "usable-test",
     "better-way"
    ]
   },
   {
    "id": "dated-prediction",
    "name": "The dated prediction",
    "pitch": "What will happen by a named date, why, and what would prove me wrong.",
    "fits": "follow.the.money",
    "modules": [
     "one-number-after",
     "wry-close"
    ]
   },
   {
    "id": "from-my-own-fleet",
    "name": "From my own fleet",
    "pitch": "What my own AI operation did this week, with its real numbers and what broke, as the evidence for a business point.",
    "fits": "under.the.hood; operational exhaust",
    "modules": [
     "one-person-story",
     "number-in-scene"
    ]
   },
   {
    "id": "face-with-proof",
    "name": "Face-led with proving cutaways",
    "pitch": "Him to camera, cut away to the evidence on the exact words it proves.",
    "fits": "the 5-minute cut by default",
    "modules": [
     "words-in-scene",
     "screen-proof"
    ]
   },
   {
    "id": "voice-led-pictures",
    "name": "Voice-led, every line has its picture",
    "pitch": "His voice over pictures only: each line has the picture that proves it.",
    "fits": "the 90-second cut; topics where the visuals carry the information",
    "modules": [
     "icon-pictogram-system",
     "one-stat-per-frame",
     "screen-proof"
    ]
   },
   {
    "id": "data-story",
    "name": "One number per frame",
    "pitch": "A chart-led cut: each beat is one sourced number drawn simply, his voice says why it matters.",
    "fits": "pieces built on a report, a survey or a cost",
    "modules": [
     "one-stat-per-frame",
     "number-in-scene",
     "constant-motion"
    ]
   },
   {
    "id": "fry-talking-head",
    "name": "The lit talking head",
    "pitch": "A carefully lit, close talking head with kinetic subtitles and drawn cutaways, Fry style.",
    "fits": "concept pieces, the 90-second cut",
    "modules": [
     "kinetic-serif-captions",
     "flat-illustration",
     "full-face-vertical"
    ]
   },
   {
    "id": "scoreboard-test",
    "name": "The test on screen",
    "pitch": "Screen recordings of the test, a live scoreboard and his verdict on each round.",
    "fits": "head-to-head pieces",
    "modules": [
     "screen-proof",
     "live-scoreboard",
     "fast-phrase-cuts"
    ]
   },
   {
    "id": "kinetic-movement",
    "name": "Everything moves",
    "pitch": "Fast phrase cuts, words that bounce in and constant motion, for a punchy short.",
    "fits": "the 90-second cut",
    "modules": [
     "word-bounce-in",
     "constant-motion",
     "fast-phrase-cuts"
    ]
   },
   {
    "id": "receipt-animation",
    "name": "The receipt prints",
    "pitch": "A till receipt prints line by line as he talks; each line is a sourced cost.",
    "fits": "follow.the.money",
    "modules": [
     "itemised-receipt",
     "dark-object-card"
    ]
   }
  ],
  "bank": [
   {
    "id": "concession-open",
    "layer": "opening",
    "name": "Concede, then claim",
    "how": "Grant the reasonable view first, then make the sharp claim inside 15 seconds.",
    "fits": "concept pieces and arguments against a popular view"
   },
   {
    "id": "one-person-story",
    "layer": "breakdown",
    "name": "One person, one situation",
    "how": "Explain the system through one ordinary person in one moment, then widen to everyone.",
    "fits": "any mechanism that is abstract"
   },
   {
    "id": "mechanism-image",
    "layer": "breakdown",
    "name": "The image that names it",
    "how": "One everyday metaphor that names how it works (\"a market becomes a queue\").",
    "fits": "concept pieces"
   },
   {
    "id": "one-number-after",
    "layer": "proof",
    "name": "One number, after the story",
    "how": "A single hard number as proof, placed after the story so it lands.",
    "fits": "any piece with one strong figure"
   },
   {
    "id": "better-way",
    "layer": "structure",
    "name": "The better way, briefly",
    "how": "Show the alternative in two lines before the close.",
    "fits": "critiques"
   },
   {
    "id": "wry-close",
    "layer": "close",
    "name": "A wry close",
    "how": "End on an observation that makes them smile, not a lecture.",
    "fits": "concept pieces; not money-moving news"
   },
   {
    "id": "thinking-aloud",
    "layer": "tone",
    "name": "Thinking out loud",
    "how": "Asides (\"by the way\", \"right?\"), self-aware humour, a person thinking, not presenting.",
    "fits": "the long cut"
   },
   {
    "id": "long-holds",
    "layer": "editing",
    "name": "Long holds with punch-ins",
    "how": "Few cuts (about 3 a minute); step in inside the take on key lines.",
    "fits": "the long cut"
   },
   {
    "id": "flat-illustration",
    "layer": "graphics",
    "name": "Simple flat illustrations",
    "how": "Plain illustrated scenes only where the story needs a picture, about a fifth of the runtime.",
    "fits": "concept pieces"
   },
   {
    "id": "fast-phrase-cuts",
    "layer": "editing",
    "name": "Cut on every phrase",
    "how": "About 33 cuts a minute, shots around a second.",
    "fits": "the short cut, energy pieces"
   },
   {
    "id": "number-in-scene",
    "layer": "graphics",
    "name": "The number in the scene",
    "how": "The key number as a big graphic laid into the picture, not a caption.",
    "fits": "any piece with one money or scale number"
   },
   {
    "id": "words-in-scene",
    "layer": "graphics",
    "name": "Words inside the picture",
    "how": "Key words placed in the scene (on a wall, a table) instead of a caption strip.",
    "fits": "b-roll heavy cuts"
   },
   {
    "id": "send-ask",
    "layer": "close",
    "name": "Ask for a send",
    "how": "End with \"send this to someone who ...\" instead of \"tell me in the comments\".",
    "fits": "shareable pieces"
   },
   {
    "id": "pov-handheld",
    "layer": "camerawork",
    "name": "Wide handheld first-person",
    "how": "Wide-angle, moving, first-person shots.",
    "fits": "b-roll from a place or an event"
   },
   {
    "id": "full-face-vertical",
    "layer": "camerawork",
    "name": "The face fills the frame",
    "how": "No split screen: the speaker fills the tall frame, close, with a warm key light and a coloured rim light; pictures cut in full-screen instead of sharing the frame.",
    "fits": "the 90-second cut first; the long cut once tested"
   },
   {
    "id": "kinetic-serif-captions",
    "layer": "graphics",
    "name": "Captions as typography",
    "how": "Two to four words at a time, centred low over the chest, never a subtitle bar: a light geometric sans for most words, the word that carries the meaning in bold, and the payoff phrase in a large italic serif with a warm gradient and a soft glow.",
    "fits": "every cut"
   },
   {
    "id": "dark-object-card",
    "layer": "graphics",
    "name": "One object on a dark, grainy card",
    "how": "A full-screen cutaway: a dark charcoal-to-slate gradient with film grain, a two-word line at the top (\"but now\", light then bold) and one large real object in the middle, lit and glowing (a company's real logo tile, a real product screen).",
    "fits": "the turn of an argument, a company or product entering the story"
   },
   {
    "id": "numbered-level-chapters",
    "layer": "structure",
    "name": "Numbered levels as chapters",
    "how": "The piece promised as a count (\"in 10 levels\") and each chapter a full-screen card: the number in a bold italic serif (\"Level 3\") over a short plain line in a light sans (\"is power\").",
    "fits": "long episodes with chapters; explainers that build step by step"
   },
   {
    "id": "negative-film-illustration",
    "layer": "graphics",
    "name": "Negative-film illustration",
    "how": "An illustration in inverted, negative-film tones on the dark card, under the chapter title.",
    "fits": "chapter cards, when a real screenshot cannot show the idea"
   },
   {
    "id": "word-bounce-in",
    "layer": "graphics",
    "name": "Every word bounces in",
    "how": "Each caption word arrives on the frame it is said with a quick overshoot (scale up a touch past full, settle) and a fade; the group holds, then clears for the next.",
    "fits": "every cut, with kinetic-serif-captions"
   },
   {
    "id": "constant-motion",
    "layer": "editing",
    "name": "Something is always moving",
    "how": "No still frame: a slow push on the speaker within every shot, cards that drift and scale while they hold, words animating in; a cut or a move every couple of seconds.",
    "fits": "the 90-second cut; the long cut at a calmer rate"
   },
   {
    "id": "treated-background",
    "layer": "production",
    "name": "The room behind him is treated",
    "how": "The speaker is cut from the room (a person mask, feathered and steady from frame to frame) and the room is softened, darkened and graded towards the brand's ink, with a vignette, so it reads as a set, not a spare room.",
    "fits": "every cut"
   },
   {
    "id": "one-stat-per-frame",
    "layer": "graphics",
    "name": "One number per frame, drawn as a chart",
    "how": "Each frame carries one checked number as a simple chart, dot grid or pictogram that a viewer reads in two seconds; the voice says the point, the picture proves it.",
    "fits": "any piece whose proof is a report, a survey or a cost"
   },
   {
    "id": "icon-pictogram-system",
    "layer": "graphics",
    "name": "A small icon system that carries the explanation",
    "how": "A handful of consistent icons (the firm, the product, the money, the user) move and connect on screen so the mechanism is seen, not only said; drawn in the brand's ink, never stock clip art.",
    "fits": "how-it-works pieces, who-pays-whom pieces"
   },
   {
    "id": "random-headline-hook",
    "layer": "opening",
    "name": "The headline that makes no sense yet",
    "how": "Open on a true, oddly specific line that sounds random until the piece explains it; the explanation is the payoff.",
    "fits": "follow.the.money and mind.the.gap pieces with a strange true detail"
   },
   {
    "id": "relatable-debate",
    "layer": "breakdown",
    "name": "A real AI debate made everyday",
    "how": "Take the argument people in AI are having and map it onto one everyday picture (a passport, a menu, a map) that anyone already understands; the picture is real, never a cartoon acting out an analogy (VISUAL_EXPLAINS).",
    "fits": "mind.the.gap"
   },
   {
    "id": "usable-test",
    "layer": "close",
    "name": "A test the viewer can use tomorrow",
    "how": "Close on a short test of two or three questions the viewer can apply at work the next day; it doubles as the article's 3 things you can do tomorrow.",
    "fits": "every series; strongest on agent and tool pieces"
   },
   {
    "id": "itemised-receipt",
    "layer": "proof",
    "name": "The itemised receipt",
    "how": "Break one familiar bill (a subscription, a seat licence, one query) into its lines like a till receipt, each line sourced, so an abstract industry becomes a shopping list.",
    "fits": "follow.the.money"
   },
   {
    "id": "live-scoreboard",
    "layer": "graphics",
    "name": "The test's scoreboard, live",
    "how": "When the piece is a test, a small scoreboard stays on screen and updates as each round is scored, so the viewer always knows who is winning.",
    "fits": "head-to-head tests"
   },
   {
    "id": "screen-proof",
    "layer": "production",
    "name": "The screen recording is the proof",
    "how": "The moment that proves the point is shown as his own screen recording, full frame, slowed or zoomed on the exact line, with a source label; no recreation.",
    "fits": "tests and product pieces"
   },
   {
    "id": "swiss-kinetic-type",
    "layer": "motion",
    "name": "Swiss grid and kinetic type",
    "how": "Type is the picture: one headline set huge on a strict modular grid, words entering on the grid lines.",
    "fits": "often"
   },
   {
    "id": "flat-vector-explainer",
    "layer": "motion",
    "name": "Flat vector explainer",
    "how": "Flat geometric shapes and icons that move with a little spring, showing how a thing works.",
    "fits": "often"
   },
   {
    "id": "shape-morph",
    "layer": "motion",
    "name": "Shape morph",
    "how": "One shape becomes the next, so a before turns into an after without a cut.",
    "fits": "sometimes"
   },
   {
    "id": "single-line-drawing",
    "layer": "motion",
    "name": "Single line drawing",
    "how": "One continuous line draws itself and the camera follows the pen, linking cause to effect.",
    "fits": "sometimes"
   },
   {
    "id": "data-story",
    "layer": "motion",
    "name": "Data story",
    "how": "Real numbers drawn mark by mark, with the source on screen and one annotation that says what changed.",
    "fits": "often"
   },
   {
    "id": "isometric-world",
    "layer": "motion",
    "name": "Isometric miniature world",
    "how": "A small diorama builds block by block so a whole system with parts can be seen at once.",
    "fits": "sometimes"
   },
   {
    "id": "dark-keynote",
    "layer": "motion",
    "name": "Dark tech keynote",
    "how": "A near-black stage, one giant number or line, a slow light sweep: the launch-event look.",
    "fits": "often"
   },
   {
    "id": "living-ui",
    "layer": "motion",
    "name": "Living UI screencast",
    "how": "The real product rebuilt or captured so the camera can zoom in and the interface can act on cue.",
    "fits": "often"
   },
   {
    "id": "ladder",
    "layer": "motion",
    "name": "The Ladder",
    "how": "One real object carries the whole piece, built in lit 3D with mass, and every number is a change to it: twenty lit windows are twenty tellers, three branches drop into the street for +43%.",
    "fits": "often"
   },
   {
    "id": "living-screen",
    "layer": "motion",
    "name": "The Living Screen",
    "how": "The numbers live in the cards of a working interface rebuilt in 3D, in a dark room lit by neon streaks, and the camera locks onto the card being spoken about, close enough to read, then pulls back.",
    "fits": "often"
   },
   {
    "id": "hud-terminal",
    "layer": "motion",
    "name": "HUD and terminal",
    "how": "Monospace text, lock-on brackets and rolling numbers, for pieces about what software or models actually do.",
    "fits": "sometimes"
   },
   {
    "id": "watercolour-ink",
    "layer": "motion",
    "name": "Watercolour and ink",
    "how": "Brush strokes and washes on textured paper: soft, human, slow.",
    "fits": "rarely"
   },
   {
    "id": "riso-halftone",
    "layer": "motion",
    "name": "Risograph and halftone print",
    "how": "Two or three spot inks, halftone dots and slightly offset plates: a printed, zine feel.",
    "fits": "sometimes"
   },
   {
    "id": "paper-cutout",
    "layer": "motion",
    "name": "Paper cut-out and collage",
    "how": "Layered cut-outs with soft shadows moving in stop-motion steps.",
    "fits": "sometimes"
   },
   {
    "id": "line-boil",
    "layer": "motion",
    "name": "Hand-drawn line boil",
    "how": "Wobbly cartoon lines redrawn every other frame so they feel alive.",
    "fits": "rarely"
   },
   {
    "id": "pixel-retro",
    "layer": "motion",
    "name": "Pixel art and retro game",
    "how": "Big pixels, a small palette and sprite loops, like an old game.",
    "fits": "rarely"
   },
   {
    "id": "film-crt",
    "layer": "motion",
    "name": "VHS, film and CRT eras",
    "how": "Grain, gate weave, scanlines and tracking lines for a look back in time.",
    "fits": "rarely"
   },
   {
    "id": "toy-3d",
    "layer": "motion",
    "name": "Toy and material 3D",
    "how": "Soft studio-lit objects that look like toys, clay or candy, for one hero object.",
    "fits": "sometimes"
   },
   {
    "id": "vertical-captions",
    "layer": "motion",
    "name": "Vertical social captions",
    "how": "Bold word-by-word captions for 9:16 viewers watching without sound.",
    "fits": "often"
   },
   {
    "id": "full-visual",
    "layer": "motion",
    "name": "Full visual: the real thing, opened up",
    "how": "For how-it-works and who-pays-whom pieces. No presenter on screen: his voice explains and the screen is the explanation. Under a word-by-word caption, the real thing each sentence is about is redrawn from real photos and screens, and changes on the word that changes it.",
    "fits": "sometimes"
   },
   {
    "id": "character-ai-receipts",
    "layer": "motion",
    "name": "Receipts on the ink desk (from the Character.ai cut)",
    "how": "Evidence prints onto a lit ink desk above a still face band: receipts, money maps, logo rows and checklists rise into place under a fade, each line printing on the word that names it, the figure landing on a mint fill; a device changes state by dissolving, never by a camera move.",
    "fits": "often"
   },
   {
    "id": "eating-jobs-ladder",
    "layer": "motion",
    "name": "One object carries the story (from the eating-its-own-jobs cut)",
    "how": "One object, a career ladder, carries the whole piece: every number is counted onto, beside or in place of a part of it, on a vignetted ink desk or in a butter tray over his chest, and every scene that steps away ends by turning back into the ladder, changed.",
    "fits": "often"
   },
   {
    "id": "ai-music-slam",
    "layer": "motion",
    "name": "Proof slams onto the stage (from the AI music cut)",
    "how": "Real proof (screens, charts, headlines, clips) slams onto an ink stage over the top of the frame on a back curve and settles tilted, while he talks below; mint is what a human made and hatched ink is what the machine made; the camera never stops pushing and scenes hand over with a horizontal blur whip.",
    "fits": "often"
   },
   {
    "id": "named-metaphor-spine",
    "layer": "breakdown",
    "name": "Named metaphor spine",
    "how": "Name one everyday object in the first 20 seconds (\"that's your app's timeline\") and explain every later idea as a change to that same object, in words and on screen.",
    "fits": "explainers with several linked terms"
   },
   {
    "id": "question-turns",
    "layer": "structure",
    "name": "Questions as the turns",
    "how": "Move to each next idea with the question the viewer would ask (\"So how do you keep it safe?\"), three or four a minute, in place of signposts.",
    "fits": "often"
   },
   {
    "id": "tight-air",
    "layer": "editing",
    "name": "Tight air",
    "how": "Cap every pause at 0.25 to 0.35 s in conform, joining only in gaps both aligners agree on; keep one speed at or under 1.12x. The reel runs 226 words a minute with no pause over 0.5 s.",
    "fits": "voiceover cuts"
   },
   {
    "id": "one-diagram-world",
    "layer": "graphics",
    "name": "One diagram, one camera",
    "how": "One persistent diagram on an infinite near-black canvas that grows with the script; the camera travels along it with almost no hard cuts (3 in 55 s), something new arriving every 1.5 to 3 s; real screens pinned to the node they explain. Proposed for the motion layer once Krish rules on it; it needs its own device.",
    "fits": "voiceover explainers of a process or system"
   },
   {
    "id": "quiet-stereo-bed",
    "layer": "production",
    "name": "Quiet stereo bed with UI sound",
    "how": "A steady stereo bed about 21 LU under the voice that never drops out, with soft whooshes and clicks on each card arrival.",
    "fits": "voiceover cuts"
   }
  ]
 },
 "growth_evidence": [
  {
   "id": "named_then_money",
   "kind": "pattern",
   "line": "Open on one named, concrete thing (a product, a deal, a song, a refund), then follow the money or a surprise; the reader recognises it or could use it today."
  },
  {
   "id": "higgsfield",
   "kind": "winner",
   "line": "Instagram video on Higgsfield, the $1B company, 8 Oct",
   "metric": "44.6 s average watch, 111 interactions per 1,000"
  },
  {
   "id": "disney_founders",
   "kind": "winner",
   "line": "Google paid $2.7 billion for the founders and Disney paying for the rest, 9 Nov",
   "metric": "39.7 s average watch"
  },
  {
   "id": "uk_number_two",
   "kind": "winner",
   "line": "The UK number two song that started as an AI demo, 11 Nov",
   "metric": "28.5 s average watch, 4 shares"
  },
  {
   "id": "duet_first",
   "kind": "winner",
   "line": "A product that messages you first, 4 Nov",
   "metric": "124 interactions per 1,000 against a pooled channel rate of 33, 4 shares"
  },
  {
   "id": "disney_character_ai",
   "kind": "winner",
   "line": "The Disney and Character.AI money story as a YouTube Short, 9 Nov: who got paid, named",
   "metric": "266 views, 24 times the channel median"
  },
  {
   "id": "workplace_absurdity",
   "kind": "winner",
   "line": "Workplace absurdity on TikTok: big employers ranking staff by how much AI they used",
   "metric": "40 interactions per 1,000 against a channel rate of 7"
  },
  {
   "id": "video_beats_stills",
   "kind": "format",
   "line": "Instagram video is the best organic format",
   "metric": "median exposure 116 for a video, 25 for a carousel, 23 for a single image; 9 of 10 organic shares"
  },
  {
   "id": "abstract_loses",
   "kind": "loser",
   "line": "Abstract framing, the two-passports post",
   "metric": "17.5 s average watch, no shares"
  }
 ]
}
```

## Anchors

scale (Scale and importance): 10: Changes money, rights or work for a whole sector or for millions of fans and creators, with a sourced figure.; 7: A major named player's move with a measurable second-order effect on others in the sector.; 4: One notable company or creator, with a local consequence.; 1: Trivia, a personnel move or a version bump.
fun_consume (Fun to read or watch): 10: A stranger would send it to a friend before finishing it.; 7: Holds a busy reader to the end, with one moment worth repeating.; 4: Useful but flat; read once and forgotten.; 1: A chore to get through.
fun_produce (Fun to make): 10: A format in the catalogue fits it, with an on-screen proof object and a show moment the growth evidence says holds people.; 7: A catalogue format fits and there is one thing to show, not just say.; 4: It can be made, but only as a talking head over stills.; 1: A talking-head summary of an abstraction; nothing to show.
uplift (Uplift): 10: Clearly makes named people smarter, better, happier or more successful, at scale (config/good-news.json bar.helps).; 7: Clearly helps a named group, at a modest scale.; 4: Helps, but the people helped are vague.; 1: Not good news for anyone in particular.
utility (Useful today): 10: A reader in the sectors can do the thing today, with steps checked on the vendor's own documents.; 7: Usable this week with one sign-up or setting.; 4: Interesting but needs tools the reader does not have.; 1: Nothing to do with it.

## mon/554f7348-ecc3-45cb-888d-9a8afe61b9bf

Headline: An AI firm is paying $2,203 a book. The publisher may keep half.
Hook: From this week, writers whose books trained Anthropic's AI are being paid about $2,203.56 a book, and the default split hands half of it to the publisher.
What happened: Authors Guild, 23 Nov 2026: "Only approximately 70 percent ($2,203.56) will be paid out now"; the final payment of about $450 million is due within about 30 days of Anthropic's IPO or a significant investment, and no later than September 2027; "tens of thousands of claims have been corrected".
So what: Writers whose books trained an AI start receiving money this week, and the split with their publisher decides whether a cheque is worth $2,203 or half of it: anyone with a book contract now knows which clause to read.
Aim: interest
Funny line: The first AI royalty cheque for most novelists comes with a co-signer: their publisher.
- A cheque arrives for a book an AI read without asking.
- How $1.5 billion becomes $2,203.56 on one book.
- The split: who decided the publisher takes half.
- The box thousands of writers ticked wrong.
- What this shows about who owns a book once an AI has read it.
Source: Authors Guild, Anthropic Settlement Update: Payments Start November 23 (23 Nov 2026) https://authorsguild.org/news/anthropic-settlement-update-check-your-claim-by-november-20

Score: scale, fun_consume, fun_produce

## mon/f5721a93-5b59-4d86-b53e-24bc70510d84

Headline: Warner Music now counts an AI song app as income.
Hook: Warner Music says its AI licensing deals, Suno above all, will add material money to its streaming revenue from this financial year.
What happened: Music Business Worldwide, 6 Aug 2026: Warner CEO Robert Kyncl expects AI "licensing deals to contribute materially to our subscription streaming revenue growth starting in fiscal '27", naming Suno, Stability AI, KLAY and Udio; fiscal 2027 began on 1 October 2026; Warner has expanded deals requiring fully gen-AI content to be identified and removed from pro rata royalty shares.
So what: A major label now counts AI song apps as a source of streaming money from this financial year, so every artist on a licensed catalogue has a new line of income whose size nobody has published yet.
Aim: interest
Funny line: The label that sued the AI app now hopes it does very well.
- A label that sued an AI app now books it as income.
- How a licence turns AI songs into streaming money.
- Why it counts from this financial year.
- The line nobody has published: the artists' share.
- What this shows about where a song's money now comes from.
Source: Music Business Worldwide, Warner Music expects AI music deals to boost subscription streaming revenue (6 Aug 2026) https://www.musicbusinessworldwide.com/warner-music-expects-ai-music-deals-to-boost-subscription-streaming-revenue-from-late-2026/

Score: scale, fun_consume, fun_produce

## mon/013ae567-6e91-4c57-9128-9ce85eef667c

Headline: ITV makes your first TV advert for free. A third came back to pay.
Hook: ITV's AI tool turned a college's website link into a 30-second TV spot in about 20 seconds, for nothing; five of the 16 first-timers then paid for more.
What happened: The Media Leader UK, 9 Oct 2026: GenAI Ads Manager drew 16 new-to-TV small and medium-sized businesses in its first year; it is free for advertisers; five of the 16 later moved to ITV's in-house creative team with bigger TV budgets.
So what: A broadcaster is giving away AI-made adverts to win small firms that never bought TV before, and a third of them went on to pay for more: anyone selling attention now has a cheaper way to land a first customer.
Aim: utility
Funny line: A broadcaster gives away the advert to sell you the advert.
- A TV channel makes your first advert for nothing.
- How the free advert is made in about 20 seconds.
- Why a broadcaster gives it away.
- Five in 16 came back with real budgets.
- What this shows about how attention gets sold now.
Source: The Media Leader UK, ITV's generative AI ads feature attracts 16 new-to-TV advertisers in debut year (9 Oct 2026) https://uk.themedialeader.com/itvs-generative-ai-ads-feature-used-by-16-new-to-tv-advertisers-in-debut-year/

Score: scale, fun_consume, fun_produce

## mon/80baed3f-3833-4bce-9afd-040a4868e562

Headline: A Dutch firm sold gyms AI music so they could stop paying songwriters.
Hook: YourNeuroTune offered more than 450 shops, gyms and cafes AI background music and a template to cancel their music-rights licence; the songwriters' society is now taking it to court.
What happened: IBTimes UK, 25 Nov 2026: YourNeuroTune's website offers customers a template to cancel existing BumaStemra licences; BumaStemra gave it until noon on 25 November and then said it would go to court; co-founder Sam Jansen said in October the company serves more than 450 customers across four countries. Michiel Laan of BumaStemra: "If you make money from music, you pay the creators."
So what: Shops, gyms and restaurants were offered AI background music as a way to cancel their music-rights licence, and a songwriters' society is suing to stop it: every venue paying for music now has a cheaper offer and a legal question attached.
Aim: interest
Funny line: The background music is so background it comes with a letter to cancel the people who wrote it.
- The music in your gym may have been made to dodge a bill.
- How a venue pays for the songs it plays.
- The pitch: play our AI tracks and cancel your licence.
- The songwriters' answer, and the court date.
- What this shows about who gets paid for background music now.
Source: IBTimes UK, AI Music Company That Told Businesses They No Longer Need to Pay Music Royalties Now Faces Legal Action (25 Nov 2026) https://www.ibtimes.co.uk/bumastemra-sues-dutch-ai-music-company-1834805

Score: scale, fun_consume, fun_produce

## wed/cf6e7746-6ce2-4c68-904a-d1ae1988bef9

Headline: Suno now writes your next eight bars inside Ableton.
Hook: Suno Bridge writes a new AI part into a loop of your Ableton session for 10 credits, and to do it, it uploads the whole project.
What happened: Music Business Worldwide, 16 Nov 2026: Bridge "went live in beta on November 13"; each generation costs 10 Suno credits; Premier costs $30 a month with 10,000 credits; when a session is opened, Bridge uploads the Ableton project and its audio files to the user's Suno account.
So what: A producer can now ask an AI for a bass line that fits a song already on their timeline, for 10 credits, and the AI has to read the whole session to do it: anyone in a studio knows what they hand over when they press generate.
Aim: utility
Funny line: The bass player who never misses a session also takes a copy of every session home.
- Mark eight bars, press a button, get a new part that fits.
- How it knows the song: it uploads your session.
- What the filter blocks, and what it lets through.
- What 10 credits buys, and what a month costs.
- What this shows about where a song lives while it is being made.
Source: Music Business Worldwide, Suno launches Bridge, an app that drops AI stems into Ableton Live (16 Nov 2026) https://www.musicbusinessworldwide.com/suno-launches-bridge-an-app-that-drops-ai-stems-into-ableton-live/

Score: scale, fun_consume, fun_produce

## wed/972b7721-4e4e-477f-b5cf-20164fd8260c

Headline: Suno makes your music video now. Another company's model draws it.
Hook: Suno Visuals makes lyric videos, album art and 15-second clips, and Suno's own FAQ says it runs on a model based on MiniMax's H3.
What happened: Music Business Worldwide, 23 Nov 2026: Suno launched Visuals on 17 November; it runs on H3 Move, based on MiniMax's H3 video model; it makes lyric videos, album art and clips of up to 15 seconds; Suno added filters to block prompts that depict specific artists, public figures or copyrighted works.
So what: An AI music app now makes the video, the cover and the clips too, on a video model built by another company, so an artist knows whose engine is drawing their artwork and why some prompts are refused.
Aim: interest
Funny line: The music app learned to make videos, and brought a friend who does the actual drawing.
- Your song now comes with a music video, made by the same app.
- Under the hood: another company's video model.
- Why the prompt that works elsewhere is refused here.
- 15 seconds, then extend, edit and re-prompt.
- What this shows about who draws an artist's picture now.
Source: Music Business Worldwide, 5 things to know about Suno's move into AI video (23 Nov 2026) https://www.musicbusinessworldwide.com/5-things-to-know-about-sunos-move-into-ai-video-the-distrokid-documents-and-the-fight-over-v6/

Score: scale, fun_consume, fun_produce

## wed/08442c41-534a-4523-9818-0884e2fc985a

Headline: TikTok will now watch for fakes of your face. First it needs your ID.
Hook: TikTok's Likeness Detection flags videos that may use a creator's face, once they verify their ID with a third party; its new AI checker reads hidden labels, and only from its own apps.
What happened: Digital Music News, 23 Nov 2026: Likeness Detection is globally available to eligible creators and public officials, who "sign up by verifying their ID with a trusted third-party partner"; the checker covers TikTok, CapCut, Dreamina, Hypic and Pippit and looks for Content Credentials metadata and invisible watermarks; TikTok says it has labelled about five billion AI uploads.
So what: Creators can now have TikTok watch for videos that use their face without consent, after handing their ID to a third party, and anyone can check whether a clip was made with TikTok's own AI tools: a creator knows what each check can and cannot see.
Aim: utility
Funny line: The fake-face detector asks for your face, your ID and a stranger to vouch for you.
- TikTok will now watch for your face. First, show it your passport.
- How the face check works, and who it is for.
- How the AI checker works: it reads a label, not the picture.
- What neither tool can see.
- What this shows about proving a video is really you.
Source: Digital Music News, TikTok Rolls Out a Manual AI Detection Tool, Officially Launches Likeness Detection for Global Creators (23 Nov 2026) https://digitalmusicnews.com/2026/11/23/tiktok-likeness-detection-release

Score: scale, fun_consume, fun_produce

## wed/8c6c717d-00b4-4d26-b837-06b89709220a

Headline: A 19th-century folk song got a copyright strike from a 500-channel music mill.
Hook: A singer's recording of "Bre Petrunko", a Bulgarian folk song with no known writer, was pulled from YouTube on a claim from Media Nov Records, which runs about 500 channels, and her two appeals failed.
What happened: Digital Music News, 18 Nov 2026: Media Nov Records runs about 500 YouTube channels; YouTube removed the video in October and rejected both of Shokin's counterclaims; YouTube restored it about 24 hours after 404 Media contacted Media Nov. Shokin: "It feels like a broken system."
So what: A recording of a song with no known writer was taken off YouTube by Media Nov Records, which runs about 500 channels, and the appeals failed twice: anyone who records traditional or public-domain music now knows how the claim system can be turned on them.
Aim: humour
Funny line: A song written before anyone alive was born was finally claimed by Media Nov, with 500 channels of AI wallpaper.
- A song older than the telephone got a copyright strike.
- How a claim takes a video down before anyone checks.
- Why the appeals bounced, twice.
- What finally worked: a journalist's email.
- What this shows about who the system is built to believe.
Source: Digital Music News, Musician Caught In a YouTube Copyright Claim Loop Initiated by an AI Company (18 Nov 2026) https://www.digitalmusicnews.com/2026/11/18/musician-copyright-claim-loop-ai-company/

Score: scale, fun_consume, fun_produce

## fri/16b1fd4f-3785-4842-9a2b-19ccfe889fa8

Headline: At Ubisoft, AI is optional. Skipping it needs a reason.
Hook: Ubisoft says its developers do not have to use generative AI; developers say a pitch without it now has to explain why.
What happened: VGC, 25 Nov 2026: Ubisoft is reportedly asking developers pitching new games to outline how generative AI will be used; one source said "If you planned on not using it, you would have to have a reason"; Ubisoft says it encourages developers to use generative AI rather than mandate it; Motherbrain is "a dedicated subsidiary developing proprietary technologies for gameplay to empower creators" (Yves Guillemot).
So what: At one of the biggest game publishers, AI is officially optional and in practice needs a reason to skip: anyone running a studio or a team can see how "encouraged" becomes the rule.
Aim: interest
Funny line: You are free to make the game without AI; please attach a short essay explaining your feelings.
- Officially optional. Unofficially, explain yourself.
- Where the claim and the pitch meeting part.
- Why a publisher makes AI the default and calls it a choice.
- Motherbrain, and the layoffs the same week.
- What this shows about how a tool becomes the rule.
Source: VGC, Ubisoft is reportedly requiring developers to justify not using generative AI (25 Nov 2026) https://www.videogameschronicle.com/news/ubisoft-is-reportedly-requiring-developers-to-justify-not-using-generative-ai/

Score: scale, fun_consume, fun_produce

## fri/5d55e729-43fd-433b-b4e5-056f5329cb05

Headline: 91% of designers use AI every week. It made them pickier.
Hook: In a survey of more than 900 designers, 91% use AI at least weekly, up from 54% a year ago, and the ones who explain it describe more checking, not less.
What happened: KESQ (Stacker, Wix Studio), 25 Nov 2026: 91% of designers use AI at least weekly, up from 54% a year earlier, from a survey of more than 900 designers by Designer Fund and Foundation Capital.
So what: Nine in ten designers now use AI every week, up from about half a year ago, while the designers themselves describe careful, methodical work: anyone hiring or briefing a designer knows the gap between "AI does design" and what the job now is.
Aim: interest
Funny line: Nine in ten designers now have an assistant who never sleeps and never once gets the kerning right.
- 91% of designers use AI every week. So who is doing the design?
- The claim: AI designs. The reality: designers brief, check and redo.
- Why the numbers jumped in a year.
- What the job is now, in the designers' own words.
- What this shows about what "using AI" means in creative work.
Source: Designer Fund, AI in design 2026 https://designerfund.com/blog/ai-in-design-2026

Score: scale, fun_consume, fun_produce

## fri/a4b34048-ab39-49da-a251-eaa58ebe2eaf

Headline: The first AI film in cinemas has a Foley artist.
Hook: Gods Don't Give Gifts opens on 4 December as the first AI-animated feature in cinemas, and its director lists the co-writer, editors, colourists, Foley artist and voice actors who made it with him.
What happened: Film Threat, 5 Nov 2026: a "hybrid pipeline" with a co-writer, traditional post-production editors and colourists, a Foley artist, a sound team and a "dedicated ensemble of professional voice actors"; the sound team spent four days in a Stockholm studio on the theatrical mix; London: "This film just wouldn't exist. It wouldn't get greenlit."
So what: The film billed as the first AI-animated feature in cinemas opens on 4 December, and its own director lists the human co-writer, editors, colourists, Foley artist and voice cast behind it: anyone pricing film work can see how much of an "AI film" is still people.
Aim: interest
Funny line: The first film made by AI needed four days in a Stockholm studio to get the footsteps right.
- The first AI film in cinemas has a sound team, a Foley artist and a voice cast.
- The claim: made by AI. The credits: made by people with AI.
- Why it could only be made this way, on this budget.
- What the $150 million version would have paid for.
- What this shows about what "AI film" means on a poster.
Source: Film Threat, The First AI-Animated Feature Film In Theaters: Gods Don't Give Gifts director Zack London talks about the future of cinema (5 Nov 2026) https://filmthreat.com/features/the-first-ai-animated-feature-film-in-theaters-gods-dont-give-gifts-director-zack-london-talks-about-the-future-of-cinema/

Score: scale, fun_consume, fun_produce

## fri/ac13c2b0-5426-4018-aaeb-eed82b9d0a6c

Headline: AI artist of the year. The lyrics were all hers.
Hook: Xania Monet, an AI avatar, swept the first AI Music Awards; her creator says she wrote every lyric herself.
What happened: Reuters, 14 Nov 2026: the night's top awards of AI artist, song and album of the year went to Xania Monet, an AI-generated avatar; Jones said she wrote all of the lyrics and then set them to music with the help of AI; winners were picked by AI artists who are members of the Sonic Intelligence Academy.
So what: The first AI music awards crowned an "AI artist" whose creator wrote all the words, with AI artists casting the votes: anyone labelling or judging AI work can see how far the label sits from who did the work.
Aim: humour
Funny line: The AI artist of the year thanked her writer, who is also her.
- The AI artist of the year has a human who wrote every word.
- Who voted: AI artists.
- Where the label and the work part.
- The Grammys' rule, and why it is the opposite.
- What this shows about what "AI artist" means.
Source: Reuters via The Star, New awards show celebrates AI music and its creators (14 Nov 2026) https://www.thestar.com.my/tech/tech-news/2026/11/14/new-awards-show-celebrates-ai-music-and-its-creators

Score: scale, fun_consume, fun_produce

## tue/photonstems

Hook: Take any song apart on your own laptop. $259 until 7 December.
What happened: iZotope Photon pulls a finished song apart into its parts, and up to six voices out of one recording, on your own computer. It costs $259 until 7 December, against $349 after.
Format: Explainer carousel, 5 cards, 4:5
Aim: utility
Funny line: Your laptop can now un-bake a cake, if the cake is a song.
Source: Newsshooter, iZotope Photon: GPU-powered audio processing software (5 Nov 2026) https://www.newsshooter.com/2026/11/05/izotope-photon-gpu-powered-audio-processing-software/

Score: fun_consume, fun_produce, utility

## tue/splicecreate

Hook: A free music studio with 3 million sounds. The catch is the export button.
What happened: Splice Create is a free Mac music app with more than three million licensed sounds built in and an assistant you can talk to. Making is free; exporting and licensing need the $9.99-a-month plan.
Format: Explainer carousel, 5 cards, 4:5
Aim: utility
Funny line: The studio is free, the door out costs $9.99 a month.
Source: The Fader, Splice launches its own DAW, Splice Create (6 Nov 2026) https://www.thefader.com/2026/11/06/splice-launches-its-own-daw-splice-create

Score: fun_consume, fun_produce, utility

## tue/djvoices

Hook: Spotify's AI DJ can finally stop talking.
What happened: Spotify's AI DJ now has nine new voices and a setting that cuts most of the talking between songs. For an artist, that means the DJ that introduces your track can now talk less and play more.
Format: Explainer carousel, 5 cards, 4:5
Aim: utility
Funny line: Spotify gave its DJ nine new voices and a button to use none of them.
Source: TechCrunch, Spotify's AI DJ gets new voices, personalities and an option for less chatter (10 Nov 2026) https://techcrunch.com/2026/11/10/spotifys-ai-dj-gets-new-voices-personalities-and-an-option-for-less-chatter/

Score: fun_consume, fun_produce, utility

## tue/freeanimation

Hook: An animation studio for $0: four free tools that do the expensive jobs.
What happened: Free, open-source tools now cover most of an animation studio: 2D animation, motion graphics, motion capture from a webcam and visual effects. We pick the four an animator can use this week and say what each replaces.
Format: Explainer carousel, 5 cards, 4:5
Aim: utility
Funny line: The most expensive thing in this animation studio is the coffee.
Source: syntaix.ai on Instagram, ten open-source animation, motion and VFX tools (4 Nov 2026) https://www.instagram.com/syntaix.ai/p/DfUpCCLiSfS/

Score: fun_consume, fun_produce, utility

## tue/tplconfused

Hook: Will Ferrell: "I guess I'm feeling a little confused"
What happened: Will Ferrell looks around, lost, and says he is feeling a little confused. It becomes understatement in the studio: the producer reading an AI mastering report that rates the demo higher than the single.
Format: Meme template, your caption on the clip, 9:16 and 4:5
Aim: humour
Funny line: Understatement in the studio: the producer reading an AI mastering report that rates the demo higher than the single.
Source: TikTok, #memetemplate https://www.tiktok.com/@viralgreenscreenhub/video/7706509569278741782

Score: fun_consume, fun_produce

## tue/tplnogod

Hook: Steve Carell: "No, God, please, no"
What happened: Steve Carell, as Michael Scott, shouts "No, God, please, no" at the sky. It becomes exaggeration at the record label: the A&R team watching a streaming app delete 29 million songs, including their lo-fi playlist.
Format: Meme template, your caption on the clip, 9:16 and 4:5
Aim: humour
Funny line: Exaggeration at the record label: the A&R team watching a streaming app delete 29 million songs, including their lo-fi playlist.
Source: TikTok, #memetemplate https://www.tiktok.com/@viralgreenscreenhub/video/7708713323

Score: fun_consume, fun_produce

## tue/tplpushthrough

Hook: Jamie Lee Curtis: "I don't know what day it is, I'm just trying to push through"
What happened: Jamie Lee Curtis, frazzled, says she does not know what day or time it is and is just trying to push through. It becomes deadpan for the edit suite: the editor on day three of fixing the AI's hands in every frame of a music video.
Format: Meme template, your caption on the clip, 9:16 and 4:5
Aim: humour
Funny line: Deadpan for the edit suite: the editor on day three of fixing the AI's hands in every frame of a music video.
Source: TikTok, #memetemplate https://www.tiktok.com/@viralgreenscreenhub/video/7706516941

Score: fun_consume, fun_produce

## tue/tplwoke

Hook: POV: the AI that needs to think without being disturbed
What happened: A character waves off anyone who comes near because they need to think, undisturbed. It becomes personification in the studio: the AI collaborator that refuses to render the track until it has had its quiet time.
Format: Meme template, your caption on the clip, 9:16 and 4:5
Aim: humour
Funny line: Personification in the studio: the AI collaborator that refuses to render the track until it has had its quiet time.
Source:  https://youtube.com/shorts/y7V-VXhHEhc?is=pp59I23mfTUuPqd7

Score: fun_consume, fun_produce

## thu/elevensoundcloud

Hook: Make a song in one app, post it in another, in one tap. Three months free.
What happened: ElevenMusic songs can now go straight to SoundCloud from the app, and SoundCloud Artist Pro members get three months of ElevenMusic Pro free. After that it is $9.99 a month, so check the renewal before you claim it.
Format: Explainer carousel, 5 cards, 4:5
Aim: utility
Funny line: The song now arrives on SoundCloud before you have decided whether it is any good.
Source: The Next Web, SoundCloud lets ElevenMusic users publish AI-made songs directly (Nov 2026) https://thenextweb.com/news/soundcloud-elevenmusic-ai-songs-direct-publishing

Score: fun_consume, fun_produce, utility

## thu/videoplugin

Hook: Your chatbot just invited a video studio to the table.
What happened: A connector lets your chatbot call another app for you, like a guest at the table who does one job. Higgsfield's video tools now plug into ChatGPT and Claude this way: here is what that means and how to add it.
Format: Explainer carousel, 6 cards, 4:5
Aim: utility
Funny line: The chatbot does not make videos; it just knows a guy.
Source: evolving.ai on Instagram, Higgsfield inside ChatGPT and Claude (Nov 2026) https://www.instagram.com/evolving.ai/p/DftxXqrgIE4/

Score: fun_consume, fun_produce, utility

## thu/hackertube

Hook: He got tired of YouTube's picks, so he built a video site in two hours.
What happened: Fed up with his YouTube recommendations, Andrej Karpathy had an AI build him a video site in about two hours: 6,454 videos picked from 43 million comments where real people recommended them. For a creator, it is a picture of discovery without the algorithm.
Format: Voiceover short with motion graphics, 9:16, about 60 seconds
Aim: interest
Funny line: He fired the algorithm and hired 43 million commenters.
Source: therundownai on Instagram, Andrej Karpathy built HackerTube (2 Nov 2026; source: Andrej Karpathy on X) https://www.instagram.com/therundownai/p/DfQCWHZEreu/

Score: scale, fun_consume, fun_produce

## thu/klingthirty

Hook: Thirty seconds of film from 15 of your own pictures.
What happened: Kling 4.0 makes single AI video clips up to 30 seconds long from up to 15 of your own reference images or clips. For a small team, that is a storyboard you can watch.
Format: Explainer carousel, 5 cards, 4:5
Aim: utility
Funny line: Your mood board now moves, and occasionally gives a character a sixth finger.
Source: Bernama, Kuaishou launches Kling 4.0 (15 Oct 2026) https://www.bernama.com/tv/news.php?id=2622573

Score: fun_consume, fun_produce, utility

## thu/threecuts

Hook: Upload three versions. YouTube tells you which opening worked.
What happened: YouTube lets creators test up to three different cuts of a video to see which opening holds viewers best, and an AI assistant gives feedback on drafts. Here is how a creator uses it on their next upload.
Format: Explainer carousel, 5 cards, 4:5
Aim: utility
Funny line: You no longer have to argue with yourself about the opening; YouTube will do it with strangers.
Source: TechCrunch, YouTube adds new creator tools like video A/B testing, dynamic thumbnails and live dubbing (23 Sep 2026) https://techcrunch.com/2026/09/23/youtube-adds-new-creator-tools-like-video-a-b-testing-dynamic-thumbnails-and-live-dubbing/

Score: fun_consume, fun_produce, utility

## thu/tplchihuahua

Hook: The singing Chihuahua
What happened: A Chihuahua throws its head back and sings, fully committed and slightly off key. It becomes incongruity at the awards: the AI artist of the year giving its acceptance song.
Format: Meme template, your caption on the clip, 9:16 and 4:5
Aim: humour
Funny line: Incongruity at the awards: the AI artist of the year giving its acceptance song.
Source: TikTok, #memetemplate https://www.tiktok.com/@greenscreenmemes.com/video/770736228

Score: fun_consume, fun_produce

## thu/tplarnold

Hook: Arnold Schwarzenegger is watching
What happened: Arnold Schwarzenegger stares, unblinking, nodding slowly to a dance track. It becomes deadpan at the gig: the session musician watching the AI band play their part, note for note.
Format: Meme template, your caption on the clip, 9:16 and 4:5
Aim: humour
Funny line: Deadpan at the gig: the session musician watching the AI band play their part, note for note.
Source: TikTok, #memetemplate https://www.tiktok.com/@flurrist/video/7323979642249989381

Score: fun_consume, fun_produce

## thu/tpldumbest

Hook: Stephen A. Smith: "you might be one of the dumbest folks on the planet"
What happened: Stephen A. Smith turns slowly to camera and, affectionately, calls someone one of the dumbest folks on earth. It becomes precise cruelty aimed at the hype: the sports pundit reacting to the club's AI-made matchday poster with the stadium in the wrong city.
Format: Meme template, your caption on the clip, 9:16 and 4:5
Aim: humour
Funny line: Precise cruelty aimed at the hype: the sports pundit reacting to the club's AI-made matchday poster with the stadium in the wrong city.
Source: TikTok, #memetemplate https://www.tiktok.com/@chiefgreenscreens/video/768221443104

Score: fun_consume, fun_produce

## sat/goodnews

Hook: This month AI helped makers reach millions, and gave fans Motty back.
What happened: An animator, a filmmaker, game makers and football fans all got something from AI this month that millions chose to watch, play or hear. Each one credits the people behind it.
Format: Good-news carousel, 6 cards, 4:5
Aim: interest
Funny line: The AI did the frames; the human still had to decide the gentleman helps the pizza rat.
- An animator's gentleman went viral helping New Yorkers
- A filmmaker turned classical paintings into a Bible epic
- Players built games and painted worlds in an afternoon
- Football fans can hear John Motson commentate again
Source: Your Instagram inspo sheet, with each story's own source https://www.instagram.com/evolving.ai/reel/DfHwPJsgbeb/

Score: scale, fun_produce, uplift

## sat/arenanight

Hook: The Warriors' big screen now talks back. Three more to find.
What happened: The Warriors, the champion Valkyries and Chase Center put Gemini into the game night itself, through interactive videoboard features fans can join. Three more stories of a better night at the game are still to find.
Format: Good-news carousel, 6 cards, 4:5
Aim: interest
Funny line: The videoboard finally has something to say besides "MAKE SOME NOISE".
- Warriors fans can play with the arena's big screen
Source: Google, How Gemini is changing the game for Golden State's organization and fans (24 Nov 2026) https://blog.google/products-and-platforms/products/gemini/gemini-golden-state/

Score: scale, fun_produce, uplift
