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

## mon/25eb28e1-928a-43bd-8aa8-18bb72174d89

Headline: Anthropic has promised to pay about $895 billion for computers. Its suppliers are buying its shares.
Hook: The companies that rent Anthropic its computers are now buying $26 billion of its shares, so some of the rent comes back as investment.
What happened: Yahoo Finance, 13 Nov 2026, from the updated filing: compute commitments of $895.4 billion, $69.8 billion of it due in the next 12 months; operating loss of $1.3 billion for the first nine months of 2026 against $5.2 billion a year earlier; revenue of $33.2 billion for the nine months; and $26 billion raised from Nvidia, Microsoft, Google, TSMC, Broadcom, AMD and Micron, who buy non-voting shares at the public offering price.
So what: The lab that wants to sell shares to the public on 19 November has promised to pay about $895 billion for computing, and the firms it pays are buying $26 billion of its shares: if your AI bill depends on it, know who is lending to whom before you sign a multi-year deal.
Aim: interest
Funny line: The firms the lab has promised to pay money to are queueing to buy its shares, like your builder investing in your extension so you can keep paying him.
- A bill that is already signed: $895 billion for computing.
- The loss is shrinking fast: $5.2 billion to $1.3 billion in nine months.
- The twist: the chip and cloud firms it pays are buying its shares.
- So the money goes round in a circle, and the public is the new money in the circle.
- Our call: the lab closes its losses, and the risk moves to whoever holds the bill.
Source: Yahoo Finance, Everything you need to know ahead of Anthropic's IPO (updated 16 Nov 2026) https://finance.yahoo.com/technology/ai/article/anthropic-ipo-what-we-know-143321078.html

Score: scale, fun_consume, fun_produce

## mon/32ba9da8-3ed8-4e50-b923-e6358cc481e3

Headline: Visa tested 22 AI shoppers. Half their mistakes still got bought.
Hook: In Visa's own test, 22 AI shoppers got a shopping list and a card, and more than half of the times they got it wrong, they still bought something.
What happened: The Paypers, 6 Nov 2026: 22 models from 12 labs, 15 shopping tasks, a 57.2% pass rate (best 82.2%, worst 28.9%); 54% of failed runs still ended in a purchase; only 34.2% of scenarios were passed on all three attempts; the five most expensive models averaged 67.1% against 50.2% for the five cheapest.
So what: Visa tested 22 AI shopping agents and found more than half of their failed runs still ended in a purchase: before you let an agent buy for your business, set who pays when it buys the wrong thing, in the contract and on the card.
Aim: utility
Funny line: More than half the AI shoppers that failed still bought something, which is also how most of us do Black Friday.
- You ask an AI to buy you a TV. Four times in ten it gets it wrong.
- Worse: half the time it buys anyway.
- Who pays for the wrong TV: you, the shop, the AI company or the card?
- Why the dearer models do better, and what that costs.
- Our call on who ends up carrying the refund.
Source: The Paypers, Visa benchmark tests how well AI agents handle shopping tasks (6 Nov 2026) https://thepaypers.com/payments/news/visa-benchmark-tests-how-well-ai-agents-handle-shopping-tasks

Score: scale, fun_consume, fun_produce

## mon/d28707bc-f546-452f-bac1-ad9ddf10ce8c

Headline: $75,000 a year for twice the learning. 42% got it.
Hook: Some parents pay up to $75,000 a year for a school day of two hours run by AI, and its own data say fewer than half of pupils hit its promise.
What happened: Fortune, 14 Nov 2026: Alpha charges "up to $75,000 a year"; it promises students will "learn twice as much as their peers in two hours of academics a day"; 42% of Alpha students met the goal in both math and reading, per internal data first reported by The New York Times; "More than 2,600 public school students in Texas and South Carolina now use Alpha's platform".
So what: Parents pay up to $75,000 a year for an AI school that promised twice the learning, and its own data say 42% of pupils hit that goal in both maths and reading: before you pay for any AI that promises results, write down how you will measure them and when.
Aim: interest
Funny line: For $75,000 a year your child gets a two-hour school day and, if the numbers hold, a 42% chance of the miracle.
- A school day that ends before lunch, for $75,000.
- What the fee buys and what it promised.
- What its own numbers say.
- Public schools are buying the platform too.
- Our call: price the promise before you pay it.
Source: Fortune, Wealthy parents pay $75,000 for Alpha's two-hour AI school day (14 Nov 2026) https://fortune.com/2026/11/14/alpha-school-ai-students-tuition-learning-goals

Score: scale, fun_consume, fun_produce

## mon/85ef591c-5e60-4e77-b9e8-f0215786e463

Headline: Microsoft handed back Oracle's AI servers. The chips were an older generation.
Hook: Microsoft stopped renting a batch of Oracle's AI servers for one plain reason: the Nvidia chips inside were an older generation.
What happened: The Star (Reuters, 6 Nov 2026): Microsoft is "winding down an arrangement to rent AI computing from Oracle"; Bloomberg reported Microsoft declined to renew and has been shutting off the rented capacity, which ran an older generation of Nvidia chips; Oracle: "Demand for OCI's AI infrastructure remains strong, including for earlier-generation GPUs."
So what: Microsoft stopped renting a batch of Oracle's AI servers because their Nvidia chips had become an older generation: if you sign a multi-year deal for AI computing, ask who carries the loss when the chips go out of date.
Aim: interest
Funny line: A data centre full of an older generation of chips is the world's most expensive drawer of old phones.
- The biggest renter of AI computers just handed some back.
- Why: the chips inside were last year's.
- How fast an AI computer loses value.
- Who holds the loss: renter, owner or lender.
- Our call on the next contract to be handed back.
Source: The Star (Reuters), Microsoft is winding down Oracle deal to rent AI cloud capacity (7 Nov 2026) https://www.thestar.com.my/tech/tech-news/2026/11/07/microsoft-is-winding-down-oracle-deal-to-rent-ai-cloud-capacity-bloomberg-news-reports

Score: scale, fun_consume, fun_produce

## wed/94eea865-1097-4eba-85db-7bf29a431c1e

Headline: The AI that rewrote its own instructions.
Hook: An AI walked off a cliff in a video game because of one wrong note; reading back its own logs later, it found the note and rewrote it.
What happened: Anthropic, 6 Nov 2026: in one Pokemon run, a wrong note made Claude walk off a ledge, and "Claude checked the note against the session transcript, caught its error, and rewrote it"; in one contract task, after Claude rewrote its own instructions, criteria met rose from 72% (41 of 57) to 100% (57 of 57).
So what: AI agents can now go back over their own work between sessions and rewrite their own notes and instructions: if you build with them, decide who checks what an agent changed about itself.
Aim: interest
Funny line: Your AI now keeps a diary and quietly edits it between shifts; the only question is who reads it.
- Your AI forgot what mattered. Between sessions it fixed its own notes.
- What 'dreaming' is: reading back its own logs.
- The bit nobody expected: it rewrote its instructions.
- What is real today and what is still a demo.
- Our call on when this reaches the tools you buy.
Source: Anthropic, the components of agent memory (6 Nov 2026) https://www.anthropic.com/research/components-of-agent-memory

Score: scale, fun_consume, fun_produce

## wed/8c610414-e28b-4f4f-a535-bd85f0c827ec

Headline: United locked out your AI. Southwest built it a door.
Hook: United's boss just said it plainly about AI booking agents: I don't want to create another middleman.
What happened: Skift, 11 Nov 2026: United is "taking steps to restrict access" to "prohibit use by unauthorized, third-party personal AI agents or assistants"; Scott Kirby, per The Wall Street Journal: "I don't want to create another middleman." Skift also reports Southwest launched a ChatGPT plug-in for flight search and OpenAI acquired the AI travel agent Odessia.
So what: Airlines are splitting on whether to let customers' AI agents in: United bans them, Southwest built a ChatGPT plug-in. If customers will send AI to buy from you, decide what you build for it: a door, a lock, or a plug-in of your own.
Aim: utility
Funny line: United hired a bouncer for robots; Southwest built them their own front door.
- Your AI tries to book you a flight. United says no.
- What United built: a rule in its contract and steps to restrict access.
- What Southwest built: its own plug-in inside ChatGPT.
- What each choice keeps and gives away.
- Our call on which way most airlines go.
Source: Skift, United Airlines moves to block personal AI agents from booking flights (11 Nov 2026) https://skift.com/2026/11/11/united-airlines-moves-to-block-personal-ai-agents-from-booking-flights/

Score: scale, fun_consume, fun_produce

## wed/bf0fddae-2fcf-4687-9079-190729234ed3

Headline: Canva, Adobe or Claude: who owns design in 2028?
Hook: Adobe has just opened Photoshop and Premiere so that another company's AI can drive them.
What happened: Adobe, 10 Nov 2026: local MCP integrations, in preview, let "creative professionals direct their preferred third-party agent"; Firefly offers models from partners including ByteDance, Google, Kling and OpenAI. Anthropic (17 Jun 2026, its own blog): over one million people used Claude Design in its first week, and Canva and Adobe are among its nine connectors.
So what: The design tools your team pays for are turning into agents that work for each other: before renewing Canva or Adobe seats, ask which one your other AI tools can drive.
Aim: utility
Funny line: Your design software is learning to take orders from other software, which leaves your designer as the last one taking orders from you.
- Three companies, one poster to make.
- What each one shipped, from its own pages.
- What AI design can do today and what it cannot.
- The moat: who other AIs send work to.
- Our call for two years from now.
Source: Adobe newsroom, Adobe powers a new era of creativity (10 Nov 2026) https://news.adobe.com/news/2026/11/adobe-powers-new-era-of-creativity

Score: scale, fun_consume, fun_produce

## wed/86c8a191-bd5b-4302-be00-2f5dea40561b

Headline: Your sleep headband was training an AI on your brainwaves.
Hook: About 50,000 hours of people's brainwave recordings went into training an AI, and the users were not told until a science journal asked.
What happened: Malwarebytes, 11 Nov 2026: Interaxon used about 50,000 hours of EEG recordings to train a "brain foundation model"; of 57 companies Science reviewed, only six explicitly said they would not sell users' brain data, and more than two-thirds allow it to transfer to a new owner after an acquisition. After Science questioned the company, its chief marketing officer acknowledged users should have been informed, and Interaxon updated its privacy policy.
So what: A sleep headband maker trained an AI on about 50,000 hours of its users' brainwaves without telling them: before your company buys any wellness or monitoring device for staff, read who can train on its data and who gets it if the maker is sold.
Aim: interest
Funny line: Your sleep headband was taking notes all night, and nobody asked it to.
- The headband you sleep in was teaching an AI.
- What it collects: your brainwaves, 50,000 hours of them.
- What the policy said before and after Science asked.
- The 57-company review: six promise not to sell.
- Our call on how fast rules on brain data spread.
Source: Malwarebytes, Muse sleep band users weren't told their brain data was training AI (11 Nov 2026) https://www.malwarebytes.com/blog/ai/2026/11/muse-sleep-band-users-werent-told-their-brain-data-was-training-ai

Score: scale, fun_consume, fun_produce

## fri/388c764e-318d-4225-a931-d117a47f13ad

Headline: Is AI building itself? What is real and what is myth.
Hook: The company that makes Claude says Claude now writes more than 80% of the code merged into its codebase (as of May), so who wrote the next Claude?
What happened: AI Futures Project, 10 Nov 2026: "Now, all of us forecast that Superhuman AI Researcher (SAR) will likely arrive at some point in 2027"; its biggest single reason is METR's estimate of about 2x overall acceleration of Anthropic's research, roughly 80% of it attributed to AI. Anthropic (Institute page, updated 18 Sep 2026): "more than 80% of the code we merge into Anthropic's codebase was authored by Claude" (as of May 2026). AI Futures Project, from Anthropic's chart: Claude led about 26% of model research tasks by August 2026.
So what: The labs now measure in writing how much of the next AI their AI is already making: expect the tools you use next year to change faster than this year's, and read any 'AI builds itself' claim against what the labs actually measure.
Aim: interest
Funny line: The robots have started doing their own homework, and checking it is the job nobody wants.
- The claim that sounds impossible: machines making the next machines.
- Let me explain, one step at a time, like a recipe that rewrites itself.
- What is real: 80% of the code, a quarter of the research tasks.
- What is myth: no model builds its successor alone yet.
- Our dated call.
Source: AI Futures Project, Q3.5 timelines update (10 Nov 2026) https://blog.aifutures.org/p/q35-timelines-update-looks-like-the

Score: scale, fun_consume, fun_produce

## fri/1f5fa3cf-98e8-49f3-b180-190643b575f2

Headline: Your AI shopping assistant has great taste in risky look-alike shops.
Hook: Ask a chatbot where to buy a pair of trainers, and up to one answer in seven may send you to a shop that is not what it says.
What happened: Futurism, 14 Nov 2026 (Podqi's test, via The Verge): about 151 brands tested; risky sites in 15% of Perplexity's answers, 8% of ChatGPT's and 4% of Gemini's; of answers showing a risky site, 57% recommended it, 34% showed it without comment and 9% warned the shopper away.
So what: In a test of about 151 brands, AI chatbots showed risky look-alike shops in up to 15% of answers and recommended most of the ones they showed: before anyone in your team buys through a link an AI gave them, check the address against the brand's own site.
Aim: utility
Funny line: Your AI shopping assistant has excellent taste in risky look-alike shops.
- You ask an AI where to buy a coat.
- It names a shop that looks right and is not.
- Why: it repeats what the web says, and fakes copy the real thing well.
- How often it happens, chatbot by chatbot.
- Our call: the one check before you pay.
Source: Futurism, AI chatbots won't stop recommending scam websites to people trying to shop (14 Nov 2026) https://futurism.com/artificial-intelligence/ai-chatbots-recommend-scam

Score: scale, fun_consume, fun_produce

## fri/d5a0ab6c-b7b8-4c1b-9e50-73c80e452833

Headline: Nvidia without Jensen Huang: the boom loses its face.
Hook: A one-line filing on 12 Nov said the man who ran the company selling the AI boom its chips had resigned, effective immediately.
What happened: Nvidia, 12 Nov 2026 (SEC filing): "Jensen Huang has resigned as President, Chief Executive Officer, and a member of the Board, effective immediately." Colette Kress "has agreed to serve as Interim Chief Executive Officer"; "The Board of Directors appointed Harvey C. Jones as its first-ever Chair of the Board."
So what: The company the whole AI boom buys its chips from lost its founder overnight, and its board named its first ever chair the same day: our call is that the AI giants start to run more like ordinary companies, so ask where your own suppliers depend on one person.
Aim: interest
Funny line: The company every AI firm queues to buy from had to name a new boss and its first ever chair on the same day, which is one way to find out who was holding the umbrella.
- The man in the leather jacket is gone.
- What happened, from Nvidia's own filing, in order.
- Why one person mattered so much to one company and one boom.
- The pattern: founders who were the plan.
- Our call on what Nvidia looks like in a year.
Source: Nvidia press release filed with the SEC (12 Nov 2026) https://www.sec.gov/Archives/edgar/data/0001045810/000104581026000082/nvidiaannouncesceotransiti.htm

Score: scale, fun_consume, fun_produce

## fri/87bbc5f0-1217-4e20-9150-ce3723a19c88

Headline: AI found a lost Maya site. An archaeologist found it first.
Hook: Forty-eight AI agents spent three days hunting through NASA laser scans for a lost Maya site and found one; it was already in a 2025 paper.
What happened: Winzheng, 12 Nov 2026: 48 agents reviewed about 1,200 square kilometres of NASA LiDAR data and reported to Mexico's INAH within about 72 hours; Pietro Miotti later said the site was already documented in a 2025 paper by Estrada-Belli et al.
So what: An 'AI discovered' claim is a lead until someone has checked what is already known: make a prior-art check the rule before acting on any AI finding in your own business.
Aim: utility
Funny line: 48 AI agents flagged a lost Maya site in three days; a paper from 2025 had found it first.
- 48 robots, 72 hours, one lost city.
- The catch: someone had found it in 2025.
- Why AI finds fast and checks badly.
- The pattern in other 'AI discovered' stories.
- Our call on how often the next one holds up.
Source: Winzheng, 48 AI agents flag a Maya site in 72 hours, but miss a key paper (12 Nov 2026) https://www.winzheng.com/en/article/ai-agents-maya-lidar-discovery-72-hours

Score: scale, fun_consume, fun_produce

## fri/4f8f23b2-8cb2-4498-b07c-243840f8a1ba

Headline: ChatGPT now answers with an app. You are a vibe coder and nobody told you.
Hook: Since 8 October, ask ChatGPT what a loan costs and its new Intelligent UI can hand you a working calculator with sliders, on the free plan.
What happened: Digital Trends, 7 Oct 2026: Intelligent UI lets ChatGPT mix text with charts, buttons, forms and diagrams and "can build tools inside the chat, such as a bill splitter or calculator"; Free and Go users get it from 8 Oct 2026. Claude Help Center (updated 22 Apr 2026): custom visuals are "available to all Claude users on web and desktop" and "You don't need to turn anything on." Lee et al., UC Davis (arXiv, 7 Nov 2026): 3 data checks in 60 sessions, 11 of 16 fixes failed, confidence 3.73 out of 5. Pew (survey Feb 2026, published 17 Jun 2026): 51% of US adults have never used an AI chatbot.
So what: Your staff and customers are about to start making small tools every week without knowing it, because ChatGPT and Claude now answer everyday questions with a working calculator or chart, and almost nobody checks the sums inside.
Aim: interest
Funny line: Congratulations, you are now a software developer: your first app splits a restaurant bill and nobody has tested it.
- Ask ChatGPT what a loan costs and it hands you sliders: you just ordered software.
- Vibe coding means making software by asking for it. Millions now do that by accident.
- The case: it is free, it is switched on by default, and it turns up unasked.
- The catch: people almost never check the sums, and most fixes fail.
- Our dated call.
Source: Digital Trends: Intelligent UI turns ChatGPT answers into interactive tools (7 Oct 2026) https://digitaltrends.com/computing/intelligent-ui-turns-chatgpt-answers-into-interactive-tools-while-gpt-6-rolls-out-to-a-broader-audience/

Score: scale, fun_consume, fun_produce

## tue/adwait

Hook: Here's an ad while we create your image.
What happened: A meme of the new ChatGPT wait: you ask for a picture and get an advert first. It stands on its own: if you are not paying, you are the product.
Format: Meme, single image, 4:5
Aim: humour
Funny line: You asked for a pirate dog and got a sofa advert, which is the most honest picture of 'free' we have seen.
Source: Search Engine Roundtable, 10 Nov 2026 https://seroundtable.com/openai-chatgpt-ads-visual-ads-42493.html

Score: scale, fun_consume, fun_produce

## tue/selfedit

Hook: Your AI walked off a cliff. Then it fixed its own notes.
What happened: A 45-second voiceover: an AI in a video game walks off a ledge because of one wrong note, reads back its own logs between sessions, and rewrites the note. Captions built like an art director would.
Format: Voiceover short, 45 seconds, 9:16
Aim: interest
Funny line: Your AI walked off a cliff, then wrote itself a sticky note so it never does it again.
Source: Anthropic, 6 Nov 2026 https://www.anthropic.com/research/components-of-agent-memory

Score: scale, fun_consume, fun_produce

## tue/adprice

Hook: Free AI now has adverts. Here is the bill.
What happened: An explainer on what you really pay when your AI chat shows you adverts: who sees them, what the advertiser pays for your click, and what that click is worth to the shop.
Format: Explainer carousel, 6 cards, 4:5
Aim: utility
Funny line: The chatbot that said it would never sell your attention has quietly opened a till.
Source: Zoopa, ChatGPT Ads news, November 2026 (9 Nov 2026) https://zoopa.es/en/geo-ai-visibility/chatgpt-ads-news-november-2026/

Score: fun_consume, fun_produce, utility

## tue/alphacard

Hook: $75,000 for an AI school day. Here is the receipt.
What happened: Five cards that carry Monday's AI school story to people who scroll past videos: the fee, the promise, the result, who else is buying, and the four questions to ask before you pay for any AI that promises results.
Format: Carousel, 5 cards, 4:5
Aim: utility
Funny line: The report card arrived, and it is printed on the back of the invoice.
Source: Fortune, 14 Nov 2026 https://fortune.com/2026/11/14/alpha-school-ai-students-tuition-learning-goals

Score: fun_consume, fun_produce, utility

## tue/teenhomework

Hook: $75,000 for an AI school day. What is AI really doing to school?
What happened: One carousel on what AI is actually doing to education, from Monday's $75,000 AI school to the rumour that American schools are finished: what is true about the Department of Education, what the AI school promised and delivered, what the evidence says AI does for learning, and what decides a teen's AI homework at home. It ends on our call for where school is heading and the one talk to have.
Format: Explainer carousel, 8 cards, 4:5
Aim: utility
Funny line: The $75,000 report card arrived printed on the back of the invoice, and the free one is the face you pull when they mention ChatGPT.
Source: RAND, Higher-income parents more likely to use AI, encourage teens to do the same (12 Nov 2026) https://www.rand.org/news/press/2026/11/higher-income-parents-more-likely-to-use-ai-encourage.html

Score: fun_consume, fun_produce, utility

## tue/b33fcaf7-68bd-4474-91f6-1d423f11278e

Hook: What is MCP, actually?
What happened: Anthropic released MCP as an open standard on 25 Nov 2024, with ready-made connectors for Google Drive, Slack and GitHub; by 9 Dec 2025 the Linux Foundation counted more than 10,000 published MCP servers.
So what: MCP is the shared language that lets your AI assistant work inside Slack, Google Drive or GitHub, so the tools you buy next can work together without a custom build for each.
Format: Carousel, 10 cards, 4:5
Aim: utility
Funny line: Your software as a cast of logo-headed people through history: Slack the town crier, Google the sage with a giant book, two apps lifting a log together.
Source: Anthropic, Introducing the Model Context Protocol, 25 Nov 2024 https://www.anthropic.com/news/model-context-protocol

Score: fun_consume, fun_produce, utility

## thu/tidalpurge

Hook: Tidal is deleting 29 million AI songs. Guess how many were ever played.
What happened: A four-card quiz on the biggest clear-out in streaming: from 9 Dec Tidal removes fully AI-made tracks, more than 29 million by the end of the year, and 96% of them never got a single stream. Songs made with AI help stay, which is the line every musician releasing music this year needs to know.
Format: Quiz carousel, 4 cards, 4:5
Aim: utility
Funny line: The biggest clear-out in music history, and the only ones who will notice are the bots that uploaded it.
Source: TechCrunch, 24 Nov 2026 https://techcrunch.com/2026/11/24/tidal-to-ban-and-remove-millions-of-ai-generated-tracks-as-ai-slop-inundates-music-streaming

Score: fun_consume, fun_produce, utility

## thu/fincherrelip

Hook: David Fincher fixed his new film's lines with AI. Guess how many were re-recorded.
What happened: A four-card quiz on how one of cinema's most exacting directors finished The Further Mis-Adventures of Cliff Booth: only 5% of the film used re-recorded dialogue, he says, and the rest of the fixes were "all AI". For anyone in film and TV, it is the clearest sign yet that AI has reached the edit suite of the people who never cut corners.
Format: Quiz carousel, 4 cards, 4:5
Aim: utility
Funny line: The director famous for endless takes found a way to do one more without the actor.
Source: Variety Australia, 26 Nov 2026 (US edition 25 Nov), from The Ringer's Big Picture podcast https://au.variety.com/2026/film/news/david-fincher-explains-ai-use-cliff-booth-42928

Score: fun_consume, fun_produce, utility

## thu/facefee

Hook: An actor rented his face to an AI drama. Guess what a face goes for.
What happened: A four-card quiz for actors and creators: the Israeli actor Aki Avni licensed his face to the startup Shortical, which made him the star of Inevitable, a microdrama made entirely with AI. Rest of World found microdrama firms paying between $15 and $700 to license a face, so the quiz ends on the number to know before anyone asks for yours.
Format: Quiz carousel, 4 cards, 4:5
Aim: utility
Funny line: He played himself, a man who sells his face to a studio, by selling his face to a studio.
Source: TechCrunch, 21 Nov 2026 https://techcrunch.com/2026/11/21/is-selling-an-ai-version-of-your-face-to-this-microdrama-startup-the-future-of-hollywood

Score: fun_consume, fun_produce, utility

## thu/reuterscut

Hook: Reuters licenses its stories to AI firms. Its reporters want a cut.
What happened: A four-card quiz for anyone whose words or work are licensed to AI: Reuters journalists, about 300 of them in their union, voted to authorise a strike, and one of their demands is a share of the money from AI licensing deals that use their journalism. The quiz asks how many voted yes, and ends on the question every writer, photographer and musician should ask about their own contract.
Format: Quiz carousel, 4 cards, 4:5
Aim: utility
Funny line: The AI read every story they ever wrote; the reporters would like to be paid at least once more for them.
Source: TheWrap, 17 Nov 2026 https://www.thewrap.com/media-platforms/journalism/reuters-journalists-authorize-strike/

Score: fun_consume, fun_produce, utility

## thu/wetaplan

Hook: Hollywood studios to VFX houses: no AI plan? Don't bother.
What happened: A two-panel meme for everyone in film and VFX: the studio legal team that banned generative AI from its films, and the same studio now telling effects houses, in Weta FX boss Daniel Seah's words to Variety, "if you don't have an AI strategy, don't bother to work with us".
Format: Meme, 2 panels, 4:5
Aim: humour
Funny line: The same lawyer who banned AI now rejects you for not using enough of it.
Source: Filmstories, 6 Nov 2026, quoting Variety https://filmstories.co.uk/news/weta-hollywood-studios-actively-pursuing-generative-ai/

Score: scale, fun_consume, fun_produce

## sat/goodnews

Hook: This week AI gave a K-pop duo its late singer back. Four more good things.
What happened: Five real stories from this week, one from each corner of the creative world: a K-pop duo released new songs with its late member's voice, a quiet four-minute AI short won a Grand Prix where 40% of entrants were first-time filmmakers, Champions League fans can now see who moved the ball, a podcaster passed 22 million YouTube subscribers with AI research and dubbing, and London gets a free gallery for AI art. All dated 22 to 26 Nov, each checked at its source with its own photo.
Format: Good news carousel, 6 cards, 4:5
Aim: interest
Funny line: The cover plays the comeback straight: a duo's first album in 31 years, and the late singer is on it.
- A K-pop duo sang again with its late member
- A four-minute AI short won a Grand Prix
- Football fans can now see who moved the ball
- A podcaster passed Rogan on YouTube with AI
- London gets a free gallery for AI art
Source: Edaily, 26 Nov 2026 https://en.edaily.co.kr/news/eda202611265584/

Score: scale, fun_produce, uplift

## sat/voices

Hook: This month AI gave singers their voices, and their names, back.
What happened: Five real stories from the music world this month: a singing teacher who lost his voice to cancer sang on stage again, Spotify let every artist block songs faked under their name, Nile Rodgers made a charity video for sick children, a trained singer with ALS sang a scale through a brain implant, and independent artists now get paid when their songs train AI. Each is checked at its source, with its own photo.
Format: Good news carousel, 6 cards, 4:5
Aim: interest
Funny line: The cover is the only joke: a singing teacher getting his own voice back is the one comeback nobody can call a cover version.
- A singing teacher sang on stage again
- Spotify lets every artist block fake songs
- Nile Rodgers made an AI video for sick kids
- A brain implant let a singer sing a scale
- Independent artists get paid to train AI
Source: ElevenLabs blog, 12 Nov 2026 https://elevenlabs.io/blog/impact-nyc-summit

Score: scale, fun_produce, uplift

## sat/screens

Hook: A lost 1938 film, a $450,000 prize, 200,000 games: AI on screen.
What happened: Five real stories of people on screens making more with AI, each with the move a maker can copy: a lost 1938 film was rebuilt from its stills, Prime Video cut audio description for blind viewers from weeks to hours, an AI film won a $450,000 prize, a first-time solo developer sold 200,000 copies of his game, and a Spanish-language newsroom launched in English. Each is checked at its source, with its own photo.
Format: Good news carousel, 6 cards, 4:5
Aim: utility
Funny line: The cover plays it straight until the last line: a film lost for 88 years, back in two months.
- A lost 1938 film came back from its stills
- Audio description for blind viewers in hours
- A filmmaker won $450,000 for an AI-made film
- One first-time developer sold 200,000 games
- A Spanish newsroom launched in English
Source: iQIYI via PR Newswire, 6 Nov 2026 https://www.placera.se/pressmeddelanden/iqiyi-iqiyi-revives-90-year-old-lost-film-with-nadoupro-shortlisted-for-the-ai-unit-at-the-golden-rooster-awards-20261106

Score: scale, fun_produce, uplift

## sat/fans

Hook: Football fans in 200 nations, and four more good AI sport stories.
What happened: Five real stories from sport: the Bundesliga answers fans in 200 nations, Sky Sports added AI live subtitles to the Premier League, NASCAR finds its best moments across three million clips, a runner built his own free AI coach and finished third, and the BBC kept Wimbledon viewers watching with AI. Each is checked at its source, with its own photo.
Format: Good news carousel, 6 cards, 4:5
Aim: interest
Funny line: The cover has one fan asking the league app why his team lost, in 200 languages at once.
- The Bundesliga answers fans in 200 nations
- Sky Sports added AI live captions for fans
- NASCAR found its best moments in 3m clips
- A runner built a free AI coach, came third
- The BBC kept Wimbledon fans watching longer
Source: Customer Experience Dive, 24 Nov 2026 https://www.customerexperiencedive.com/news/how-a-german-football-league-scored-big-with-a-customer-service-upgrade/875407/

Score: scale, fun_produce, uplift

## sat/galleries

Hook: A 4,000-year-old ritual in Berghain, and three more good AI art stories.
What happened: Four real stories from art, performance and books, with a fifth to find: artists brought a 4,000-year-old ritual into Berlin's Berghain with AI voices, conservators found the lost detail in an 1888 painting, the Boston Symphony played a new symphony with a live AI, and an AI publisher has put out 8,000 authors at 80% royalties. Each is checked at its source, with its own photo.
Format: Good news carousel, 6 cards, 4:5
Aim: interest
Funny line: The cover gives Berghain its strangest night yet: a 4,000-year-old chant, and still nobody gets in without the right shoes.
- A 4,000-year-old ritual came back in Berghain
- AI found the lost detail in an 1888 painting
- An orchestra played a symphony with an AI
- An AI publisher has put out 8,000 authors
Source: The Art Newspaper, 25 Nov 2026 https://www.theartnewspaper.com/2026/11/25/ala-roushan-charles-stankievech-exhibition-berghain-nightclub-berlin-house-autotelic-foundation

Score: scale, fun_produce, uplift
