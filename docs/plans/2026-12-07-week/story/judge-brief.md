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

## mon/21e94357-9b59-4abe-96c6-daf1f98cd6d2

Headline: ElevenLabs paid about $100 million to learn Japanese.
Hook: ElevenLabs, the AI voice company used by creators and dubbing studios, agreed to buy Japanese voice firm Kotoba for a reported $100 million, three months after a sale valued it at $22 billion.
What happened: Music Business Worldwide, 16 Nov 2026: "Business Insider Japan reports that ElevenLabs CEO Mati Staniszewski put the price at around $100 million"; RouteNote: "reportedly worth approximately $100 million".
So what: The biggest AI voice company just paid about $100 million to buy Japanese speech instead of building it, so voice actors, dubbers and audiobook narrators can see what one language is worth to the firms cloning voices.
Aim: interest
Funny line: The company that makes AI speak every language had to go shopping for one.
- The company that makes AI talk in every language buys one.
- About $100 million for Japanese speech.
- Why buying a language beats building it.
- Who is paid when a voice is cloned into Japanese: the voice, the firm, the dubber.
- What this shows about what a language is worth to voice cloning.
Source: Music Business Worldwide, ElevenLabs to buy Kotoba (16 Nov 2026) https://www.musicbusinessworldwide.com/elevenlabs-agrees-to-acquire-japan-focused-voice-ai-company-kotoba-in-reported-100m-deal/

Score: scale, fun_consume, fun_produce

## mon/83f20f43-6b46-40a2-9a9b-1007cb10f9bb

Headline: Kling's investors were promised their money back, with interest.
Hook: Kling, the AI video tool sold to filmmakers and creators, raised 19.8 billion yuan in October, and its owner's accounts book a yearly return on a promise to buy those investors out.
What happened: Kuaishou, 19 Nov 2026: "Finance costs on redemption financial liabilities represent the non-cash interest expense accrued, reflecting the annual return attached to Beijing Kling's conditional obligation to repurchase equity"; Dr. Web: Kling raised 19.8 billion yuan in October.
So what: The money behind a famous AI video tool used by filmmakers and creators is partly a loan in disguise: its backers can ask for their money back with interest, so anyone choosing which AI video tool to build on can see how safe its funding really is.
Aim: interest
Funny line: Even the people betting on AI video asked for a receipt.
- The AI video tool whose backers were promised their money back.
- 19.8 billion yuan in, with a buy-back promise attached.
- Why the accounts call it interest.
- Who carries the risk if the tool does not pay off.
- What this shows about how AI video is really funded.
Source: Kuaishou third-quarter 2026 results, PR Newswire (19 Nov 2026) https://www.prnewswire.com/apac/news-releases/kuaishou-technology-announces-third-quarter-2026-unaudited-financial-results-302945189.html

Score: scale, fun_consume, fun_produce

## mon/2c443323-dc8c-4941-9608-04d6b3ec85ed

Headline: An AI music start-up will pay indie artists to learn from their songs. Nobody says how much.
Hook: Sonilo, an $11 million AI music start-up, will pay licence fees and a share of revenue to Symphonic's independent artists who opt in to train its model, and the rate is private.
What happened: Music Business Worldwide, 18 Nov 2026: Sonilo, "$11m-backed", signed with Symphonic so that "rights holders and artists receive licensing fees and a share of revenue"; the fee and split were not disclosed.
So what: Independent musicians can now be paid to have an AI learn from their songs, through their distributor, but only if they tick the box, and nobody has said the rate: anyone with music on a distributor knows which email to read.
Aim: utility
Funny line: An indie track can now be in more AI training deals than playlists.
- An AI start-up offers to pay indie musicians for their songs.
- How $11 million of venture money reaches an artist: through the distributor.
- The box you have to tick, and what ticking it signs.
- The number nobody printed: the rate.
- What this shows about who sets the price of a song an AI learns from.
Source: Music Business Worldwide, Sonilo and Symphonic (18 Nov 2026) https://www.musicbusinessworldwide.com/11m-backed-ai-startup-sonilo-founded-by-tiktok-veterans-inks-licensing-deal-with-symphonic-to-train-its-model-on-opted-in-indie-recordings/

Score: scale, fun_consume, fun_produce

## wed/de83ed89-f29e-4e5f-ad82-c698ec72a010

Headline: An AI turned Fortnite into 3 million lines of code, so Epic is retiring the tool it was built in.
Hook: Epic Games used AI to convert more than 20,000 of Fortnite's Blueprints into about 3 million lines of Verse, and on that basis Unreal Engine 6 will ship without Blueprints.
What happened: VP Land, 20 Nov 2026: "The AI-assisted run produced a working prototype with roughly 3 million lines of Verse."; Epic converted more than 20,000 Fortnite Blueprints, and Unreal Engine 6 ships without Blueprints.
So what: Epic is retiring the visual tool millions of game makers learned on because an AI could translate its biggest game out of it, so any game studio or creator on Unreal knows the skill they built is being replaced by code an AI wrote.
Aim: interest
Funny line: The visual scripting system made so people would not have to write code is being retired because an AI wrote 3 million lines of it.
- The tool made so people would not have to code, retired by code.
- 20,000 Blueprints in, 3 million lines out.
- How an AI translates a visual script into text.
- What broke: the skill millions learned on.
- What this shows about where game making is heading.
Source: VP Land, Unreal Engine 6 drops Blueprints (20 Nov 2026) https://www.vp-land.com/stories/unreal-engine-6-drops-blueprints-as-epic-uses-ai-to-port-20-000-fortnite-blueprints-to-ver

Score: scale, fun_consume, fun_produce

## wed/41874364-fcd8-4fd1-b7e7-91aca6235019

Headline: Cinema 4D's new AI is someone else's AI, sold in credits that expire.
Hook: Maxon, the software company behind Cinema 4D and ZBrush, now sells AI model generation inside its apps, run on other firms' models such as Tripo and Rodin and billed in credits.
What happened: Maxon: "We work with third-party AI providers, such as Tripo and Rodin."; Creative Bloq, 23 Nov 2026: "AI generation comes to Cinema 4D and ZBrush, but artists have an 'off' switch."
So what: 3D artists using Cinema 4D and ZBrush now get AI model generation inside their apps, but the models come from other firms and the credits expire monthly, so any studio budgeting for it knows what it is actually paying for.
Aim: utility
Funny line: The headline feature for 3D artists is an AI assistant, and the selling point in the subtitle is that you can switch it off.
- An AI model maker inside the 3D artist's favourite apps.
- Whose AI it really is: Tripo and Rodin.
- Why the credits run out every month.
- The off switch, and why it is a selling point.
- What this shows about who makes money from AI in 3D.
Source: Maxon, Maxon Plus (Nov 2026) https://www.maxon.net/en/maxon-plus

Score: scale, fun_consume, fun_produce

## wed/076c5675-4aee-4ad0-b400-6b10188fdb59

Headline: This plugin types out your song so you can put an echo on one word.
Hook: iZotope's Nectar 5 transcribes a sung vocal into lyrics in the edit window, so a producer selects a single word and adds up to seven effects to it.
What happened: MusicRadar, 24 Nov 2026: "Open up Moments on a vocal recording and the plugin will transcribe the lyrics automatically in the edit window."; "This AI-powered mixing tool listens to a portion of your vocal and designs a customized processing chain to match it."; introductory price $179 until 7 December, then $249.
So what: A music producer can now click one sung word and put an effect on just that word, because the plugin turns the vocal into typed lyrics first, so any singer or producer knows the edit that took an afternoon is now a selection.
Aim: utility
Funny line: Music software has finally learned to read lyrics, mainly so it can put reverb on the one word you kept mumbling.
- Click a sung word, and only that word gets the echo.
- How: the plugin writes the vocal out as lyrics first.
- Speech-to-text, pointed at singing.
- The Vocal Assistant that builds the whole chain from a listen.
- What this shows about where a mix engineer's hours go.
Source: iZotope, Nectar product page (Nov 2026) https://www.izotope.com/en/products/nectar.html

Score: scale, fun_consume, fun_produce

## wed/5675e3e4-3420-45a2-bc45-9e9cbd5902ee

Headline: Google now rents out playable worlds at 10 cents a second.
Hook: Google's Genie 4 streams a playable 720p world at 24 frames a second to game developers, at roughly $0.10 a second, for up to 120 seconds a session.
What happened: Google, 19 Nov 2026: "generating continuous 720p worlds at 24fps with synchronized native audio"; PPC Land, 19 Nov 2026: "roughly $0.10 for every second of streamed output", "Each session can run for up to 120 seconds" and "visual stability may degrade after 60 to 90 seconds".
So what: Google now rents game developers a playable world by the second, about 10 cents a second for up to two minutes, so any game studio or solo maker knows what an AI-made level costs and where it starts to wobble.
Aim: interest
Funny line: Google has invented a game world that forgets where it put the door if you look away for eight seconds.
- A playable world with no game engine underneath.
- Every frame is the model's guess at the next one.
- Why it is billed by the second, and stops at two minutes.
- Look away for eight seconds and the door may move.
- What this shows about who pays for a world that is drawn as you walk.
Source: Google, Genie 4 in the Gemini API (19 Nov 2026) https://blog.google/innovation-and-ai/technology/developers-tools/genie-4-in-gemini-api/

Score: scale, fun_consume, fun_produce

## fri/c1bd8406-c267-426e-b586-d76e1ef68e5c

Headline: Animation festivals ask if you used AI. Some entries say they are '3D'.
Hook: Manchester Animation Festival will bar generative AI films from 2027, as Ottawa's festival says entrants are lying on their forms, and festivals decide which animated films win distribution deals.
What happened: Cartoon Brew, 20 Nov 2026: "What bothers me is the animators clearly lying on their forms,” says Robinson."; Manchester Animation Festival: "If any part of the final moving image has been generated or transformed by a generative audio, image or video model, it will be deemed ineligible".
So what: Festival selection, which decides awards and distribution for animated films, rests on a form filmmakers fill in themselves, and programmers say the form and the film no longer match, so every animator entering festivals knows the box is being gamed.
Aim: interest
Funny line: Faced with one AI box to tick, some entrants have decided their film is simply 3D or something.
- A box on a festival form: did you use AI?
- What programmers see: AI films ticked as 3D.
- Why the form matters: awards and distribution.
- Why a rule cannot see inside a frame.
- What this shows about honesty when the stakes are a prize.
Source: Cartoon Brew, festival programmers on AI (20 Nov 2026) https://www.cartoonbrew.com/artificial-intelligence/annecy-ottawa-manchester-festival-programmers-artificial-intelligence-269655.html

Score: scale, fun_consume, fun_produce

## fri/456c4fc3-530b-4fc8-9e92-5b5ea662ad87

Headline: A game had no AI label. Its music files said 'made with Suno'.
Hook: A Binding of Isaac update shipped Suno-made music with no AI label on Steam, and players found Suno's tag inside the music files' metadata.
What happened: Eurogamer, Nov 2026: Reddit user ShweetsStuff posted that the run's music was "100% generated by Suno (AI) (with proof)", pointing to tracks that reference the AI music tool Suno in their metadata; PC Gamer: "only 8% positive recent reviews".
So what: A video game store's AI label depends on the developer ticking a box, and this time a file's own metadata told players the truth, so anyone releasing a game, an album or a video knows the file can disclose what the label did not.
Aim: humour
Funny line: A parody of one of the biggest games of the year was undone by a single metadata field that politely said who wrote the music.
- A game update with no AI label and AI music inside.
- How players found it: one line of file metadata.
- Why the store's label said nothing.
- What it cost: reviews down to 8% positive.
- What this shows about who really discloses AI.
Source: Eurogamer, Binding of Isaac AI music removed (Nov 2026) https://www.eurogamer.net/binding-of-isaac-repentance-plus-ai-music-removed

Score: scale, fun_consume, fun_produce

## fri/b38a7a98-50b4-4608-bf8e-b99d8181ac7b

Headline: Two contracts banned AI art. Readers found it on the cover anyway.
Hook: Tor pulled the cover of Ilona Andrews's new novel after learning generative AI was used to make it, though the authors' contract and Tor's art contracts both forbid it.
What happened: Publishers Weekly, 24 Nov 2026: "Tor takes full responsibility for the breakdown in our review process," with its policies and contracts with cover artists prohibiting generative AI; Ilona Andrews: "We have a no-AI clause in our contract. Tor also has a no-AI clause in their art contracts."
So what: A big publisher and its bestselling authors both had no-AI clauses in their contracts, and an AI-made cover still got through, found by readers in Instagram comments, so any author, illustrator or publisher knows a clause is a promise and not a check.
Aim: interest
Funny line: Two contracts said no AI, the review said fine, and the people who caught it were the comments under the reveal post.
- Two no-AI clauses, one AI-made cover.
- Who caught it: readers, after the reveal.
- Why a contract clause checks nothing by itself.
- The authors now vet every painting, not the painter.
- What this shows about where the proof of human work has to live.
Source: Ilona Andrews, Generative AI on This Crown's cover, carrying Tor's statement (20 Nov 2026) https://ilona-andrews.com/blog/generative-ai-on-this-crowns-cover/

Score: scale, fun_consume, fun_produce

## fri/46dd71d0-6787-4bda-bd6c-b0e2bc4abca2

Headline: HeyGen's 84.4% real avatar was picked as real 42.2% of the time.
Hook: HeyGen says its new Avatar 6 is 84.4% indistinguishable from real video, and its own research page shows raters picked it as the real clip 42.2% of the time.
What happened: HeyGen Research, 17 Nov 2026: "Side by side with the real recording, raters pick Avatar 6 as the real one 42.2% of the time." and "50% would mean they cannot tell at all, so Avatar 6 is 84.4% of the way there."; one clip at a time, 65.1% of Avatar 6 clips judged real against 78.9% of real recordings.
So what: The AI avatar sold to video creators as 84.4% indistinguishable from real was picked as the real clip 42.2% of the time in its maker's own test, so any creator weighing an AI double knows how that headline number is built.
Aim: interest
Funny line: HeyGen's avatar lost the spot-the-real-one test more often than it won, and the launch turned that into 84.4%.
- 84.4% indistinguishable, says the launch.
- 42.2%: how often raters picked the avatar as real.
- How a coin toss becomes a percentage.
- One clip at a time: 65.1% against 78.9%.
- What this shows about the numbers a creator is sold.
Source: HeyGen Research, Avatar 6 model report (17 Nov 2026) https://www.heygen.com/research/avatar-6-model

Score: scale, fun_consume, fun_produce

## tue/nytphotoshop

Hook: The New York Times told photographers: do not update Photoshop.
What happened: The Verge, 24 Nov 2026: "At this time, we are requiring that all contributing photographers avoid using Adobe Photoshop 2027 (release 28.0.0 and subsequent updates) when working on assignment for The Times," the email reads.
Format: Explainer carousel, 5 cards, 4:5
Aim: utility
Funny line: The world's best-known newspaper is asking photographers to keep their software out of date on purpose.
Source: The Verge, the New York Times warns photographers not to update Photoshop (24 Nov 2026) https://www.theverge.com/ai-artificial-intelligence/1041227/the-new-york-times-warns-photographers-not-to-update-photoshop-over-ai-features

Score: fun_consume, fun_produce, utility

## tue/spotifyaudio

Hook: Spotify will turn your self-published book into an audiobook, free.
What happened: Spotify, 18 Nov 2026: "Starting today, they're available to self-published authors in 21 more markets", the UK among them, with up to five audiobooks free per author.
Format: Explainer carousel, 5 cards, 4:5
Aim: utility
Funny line: Spotify reckons most books in the world have no audiobook, and it is offering to fix five of them per author.
Source: Spotify newsroom, Audiobook Creation Tools expansion (18 Nov 2026) https://newsroom.spotify.com/2026-11-18/audiobook-creation-tools-expansion/

Score: fun_consume, fun_produce, utility

## tue/fcpcaptions

Hook: Final Cut Pro now writes captions in 23 more languages.
What happened: Apple, 18 Nov 2026: "Generate captions and search transcripts in 23 new supported languages."
Format: Explainer carousel, 5 cards, 4:5
Aim: utility
Funny line: For five months the caption tool in a $299.99 film editor spoke one language, American.
Source: Apple, Final Cut Pro release notes (18 Nov 2026) https://support.apple.com/en-us/102825

Score: fun_consume, fun_produce, utility

## tue/logicdrums

Hook: Logic on iPad now splits a song's drums apart.
What happened: Apple, 18 Nov 2026: "Choose the Drums (Individual Kit Pieces) preset in Stem Splitter to extract only the drum kit pieces from an audio region: kick, snare, hi-hat, toms, cymbals, and other drums and percussion."
Format: Explainer carousel, 5 cards, 4:5
Aim: utility
Funny line: The list of kit pieces ends with Other, which every drummer knows is the cowbell.
Source: Apple, Logic Pro for iPad 4.0 release notes (18 Nov 2026) https://support.apple.com/en-us/101628

Score: fun_consume, fun_produce, utility

## tue/mychannel

Hook: Google patented a TV channel starring you, made by AI. The examiner said no.
What happened: Gizmodo, 23 Nov 2026: "Google might be planning to build a completely AI-generated TV channel in which your likeness is the main character"; The Verge: a system "designed to create feeds filled with personalized, AI-generated videos and advertisements".
Format: Voiceover short, 9:16, about 60 seconds, motion graphics over the source pictures
Aim: humour
Funny line: In Google's plan for television the star of the show is you, and the ad break is still there.
Source: Gizmodo, Google wants to make AI TV shows starring you (23 Nov 2026) https://gizmodo.com/google-wants-to-make-ai-tv-shows-starring-you-2000844299

Score: scale, fun_consume, fun_produce

## tue/tplcommscam

Hook: Carragher cheers, Neville sinks: the 4-0 comms cam
What happened: On the Anfield gantry one pundit laughs and leans out of his seat at each goal while the one beside him sits still, face unmoved, as it reaches 4-0. It becomes the AI moment the caption names, in the reader's world.
Format: Meme template, your caption on the clip, 9:16 and 4:5
Aim: humour
Funny line: Two pundits, one game: an AI music start-up's pitch and the songwriter who read the contract.
Source: This week in football: Sky Sports Premier League on YouTube https://www.youtube.com/watch?v=A8IxwaSPeqw

Score: fun_consume, fun_produce

## tue/tplninedarter

Hook: Two perfect legs in one match
What happened: One player throws a perfect nine-dart leg and his opponent grins at the replay, then throws a perfect nine-darter of his own straight back. It becomes the AI moment the caption names, in the reader's world.
Format: Meme template, your caption on the clip, 9:16 and 4:5
Aim: humour
Funny line: The AI music tool needed 400 tries to be perfect; the session musician needed one and a grin.
Source: This week in darts: PDC on YouTube https://www.youtube.com/watch?v=69ex7G4stfM

Score: fun_consume, fun_produce

## tue/tplfistpump

Hook: The manager's fist pumps to the Kop
What happened: After the full-time handshakes the head coach walks towards the stand and pumps his fist at the crowd, again and again. It becomes the AI moment the caption names, in the reader's world.
Format: Meme template, your caption on the clip, 9:16 and 4:5
Aim: humour
Funny line: A fist pump this big is how a film crew celebrates beating the AI storyboard on a shoot.
Source: This week in football: This Is Anfield on YouTube https://www.youtube.com/watch?v=TX8IhY3r6cY

Score: fun_consume, fun_produce

## tue/tplbuzzer

Hook: The buzzer-beater at the Garden
What happened: A player hits the winning shot as the clock runs out, the arena erupts and his team-mates swarm him on the floor, 97-96. It becomes the AI moment the caption names, in the reader's world.
Format: Meme template, your caption on the clip, 9:16 and 4:5
Aim: humour
Funny line: Every human mix in music now lands like a buzzer-beater, one second before the AI version.
Source: This week in basketball: NBA on YouTube https://www.youtube.com/watch?v=Cdy1lQCfVV4

Score: fun_consume, fun_produce

## thu/figmasix

Hook: Figma now gives you six AI pictures from one prompt.
What happened: Figma, 18 Nov 2026: "Have a single image model generate two, four, or six images from one prompt, so you spend less time re-prompting."
Format: Explainer carousel, 5 cards, 4:5
Aim: utility
Funny line: The release note's selling point is that you will spend less time re-prompting, the most honest description of AI image work yet.
Source: Figma release notes (18 Nov 2026) https://www.figma.com/release-notes/

Score: fun_consume, fun_produce, utility

## thu/robloxvideo

Hook: Roblox's AI helper can now watch your game being played, and fix it.
What happened: Roblox, 20 Nov 2026: "screen_capture can now record video during a playtest, so the agent can see motion for itself."
Format: Explainer carousel, 5 cards, 4:5
Aim: utility
Funny line: Roblox's demo is an AI noticing that a door stutters, which is roughly where every game maker's career begins.
Source: Roblox developer forum, Studio MCP server updates (20 Nov 2026) https://devforum.roblox.com/t/studio-mcp-server-updates-video-capture-saveplace-and-submitfeedback/4998177

Score: fun_consume, fun_produce, utility

## thu/pixelfill

Hook: Pixelmator Pro now repaints part of a photo from words.
What happened: Apple, 18 Nov 2026: "Transform any detail in your image with Generate Fill, adding edits that blend naturally to match the lighting, perspective and texture of surrounding areas, using natural language."
Format: Explainer carousel, 5 cards, 4:5
Aim: utility
Funny line: Apple's own example of what to ask the AI for is a purple sky.
Source: Apple, Pixelmator Pro 5.0 release notes (18 Nov 2026) https://support.apple.com/en-gb/126257

Score: fun_consume, fun_produce, utility

## thu/alphamatte

Hook: Runway now cuts people out of clips, no green screen.
What happened: Runway, 13 Nov 2026: "LTX Alphagen is the first third-party model to return two outputs and support ProRes as an output type."
Format: Explainer carousel, 5 cards, 4:5
Aim: utility
Funny line: The headline feature of the model is that it gives you two files instead of one.
Source: Runway changelog (13 Nov 2026) https://runway.com/changelog

Score: fun_consume, fun_produce, utility

## thu/synthfirmware

Hook: People taught a $70 synth new tricks with chatbots, and the music gear makers opened up.
What happened: The Verge, 25 Nov 2026: "companies have begun making more and more of their devices open source."; Polyend: "Today we're publishing the firmware source code for the original Tracker, Tracker+ and Tracker Mini on GitHub."
Format: Voiceover short, 9:16, about 60 seconds, motion graphics over the source pictures
Aim: interest
Funny line: A $70 synth became the instrument of the summer because people kept teaching it new tricks with chatbots.
Source: The Verge, vibe coding and open-source music firmware (25 Nov 2026) https://www.theverge.com/ai-artificial-intelligence/1040081/vibe-coding-open-source-music-firmware

Score: scale, fun_consume, fun_produce

## thu/tplturin

Hook: The champion on his back in Turin
What happened: Match point goes in, the winner drops flat on his back on the court, then disappears under his team in the players' box. It becomes the AI moment the caption names, in the reader's world.
Format: Meme template, your caption on the clip, 9:16 and 4:5
Aim: humour
Funny line: A film editor's championship point is a client who does not ask for an AI version.
Source: This week in tennis: Tennis TV on YouTube https://www.youtube.com/watch?v=wBR51UlMKW8

Score: fun_consume, fun_produce

## thu/tplassemble

Hook: The heroes run in together
What happened: A leader calls his team and heroes charge in from every side of the battlefield to stand together. It becomes the AI moment the caption names, in the reader's world.
Format: Meme template, your caption on the clip, 9:16 and 4:5
Aim: humour
Funny line: Every AI video tool now turns up to a film pitch like the whole superhero roster.
Source: This week's film trailers: Marvel Entertainment on YouTube https://www.youtube.com/watch?v=Wb8Tq_HD4E8

Score: fun_consume, fun_produce

## thu/tpllegends

Hook: The headliner brings the legends backstage
What happened: A singer dances down a backstage corridor surrounded by country music legends before walking out to perform, guitar in hand. It becomes the AI moment the caption names, in the reader's world.
Format: Meme template, your caption on the clip, 9:16 and 4:5
Aim: humour
Funny line: An AI music model should walk out with every musician it learned from, the way a headliner brings the legends.
Source: This week's award shows: the CMA Awards on YouTube https://www.youtube.com/watch?v=LJC7mgjp5FQ

Score: fun_consume, fun_produce

## thu/tplskyrim

Hook: A fantasy game remade in another decade by AI
What happened: A famous fantasy video game's best-known scenes are rebuilt with AI in a 1960s setting, cart ride and dungeon included. It becomes the AI moment the caption names, in the reader's world.
Format: Meme template, your caption on the clip, 9:16 and 4:5
Aim: humour
Funny line: An AI remade a famous fantasy game in the wrong century, which is roughly how studios pitch AI remakes.
Source: Your Instagram inspo sheet https://www.instagram.com/evolving.ai/reel/Dc8ff9ug9-e/

Score: fun_consume, fun_produce

## thu/tplthanksgiving

Hook: The touchdown with three seconds left
What happened: Trailing with the clock almost gone, the quarterback finds his receiver in the end zone and the whole team piles on while the other bench stares. It becomes the AI moment the caption names, in the reader's world.
Format: Meme template, your caption on the clip, 9:16 and 4:5
Aim: humour
Funny line: The hand-made short film gets to the festival the way football teams win on Thanksgiving: three seconds left.
Source: This week in American football: NFL on YouTube https://www.youtube.com/watch?v=Etsgla0KIoE

Score: fun_consume, fun_produce

## sat/goodnews

Hook: AI put songwriters and bands in front of millions.
What happened: AI put songwriters and bands in front of millions. Four real things AI did for music this month, each with who it helped and how.
Format: Good-news carousel, 6 cards, 4:5
Aim: interest
Funny line: The number one ballad was written by two humans and sung by software, which is the most K-pop sentence of the year.
- Two songwriters used AI to reach number one in Korea.
- An AI-made K-pop group released its debut single.
- Music teams can now find a track by asking for it.
- A label still hired George Lynch to play on an AI track.
Source: Each story's own source https://www.koreatimes.co.kr/entertainment/music/20261126/ai-music-tops-local-chart-what-you-need-to-know

Score: scale, fun_produce, uplift

## sat/talent

Hook: AI helped footballers, a race team and cinemas get noticed.
What happened: AI helped footballers, a race team and cinemas get noticed. Three real things AI did for scouts, race teams and cinemas this month, each with who it helped and how, and 1 more to find.
Format: Good-news carousel, 6 cards, 4:5
Aim: interest
Funny line: The driver cannot talk while racing, so the car now does the talking for him.
- An AI scouting app got 26 overlooked footballers signed.
- A NASCAR team gave its race car an AI voice for guests.
- Odeon's cinema assistant answers 40% of questions, no jobs lost.
Source: Each story's own source https://bluewin.ch/en/sport/football/bringing-overlooked-talents-to-light-li.3686124

Score: scale, fun_produce, uplift

## sat/newsrooms

Hook: This month AI helped newsrooms keep readers and save time.
What happened: This month AI helped newsrooms keep readers and save time. Four real things AI did for media this month, each with who it helped and how.
Format: Good-news carousel, 6 cards, 4:5
Aim: interest
Funny line: The newspaper's newest subscriber is a corporate chatbot, and it still has to log in.
- Norway's biggest paper uses AI on 200 stories a day.
- Der Spiegel's model finds a third of readers about to leave.
- Nine plugged its newspapers into business AI tools.
- Nearly 500,000 people joined Canva through AI assistants.
Source: Each story's own source https://fortune.com/2026/11/27/checking-ai-work-human-in-the-loop-newsrooms

Score: scale, fun_produce, uplift

## sat/makers

Hook: This month AI turned solo creators into studios.
What happened: This month AI turned solo creators into studios. Four real things AI did for creators this month, each with who it helped and how.
Format: Good-news carousel, 6 cards, 4:5
Aim: humour
Funny line: Batman's newest villain is the queue at a village tea stall.
- An AI creator's Desi Batman reached 25 million views.
- A fantasy comedy film was made for $28,775.
- A creator's AI trailer looks like a blockbuster.
- Gary Vee's AI avatar answers a fan a day.
Source: Each story's own source https://www.afaqs.com/news/social-media/e-motorad-teams-up-with-desi-batman-creator-as-ai-reels-go-viral-12843698

Score: scale, fun_produce, uplift

## sat/screen

Hook: AI helped film and TV makers try something new.
What happened: AI helped film and TV makers try something new. Three real things AI did for film and TV this month, each with who it helped and how, and 1 more to find.
Format: Good-news carousel, 6 cards, 4:5
Aim: interest
Funny line: The lead actor's surname has the letters AI in it, in case anyone missed the point.
- Lionsgate Play started an AI-led mythology series.
- Seven Korean directors made AI short films for a festival.
- An Oscar winner is showing how he used AI on his film.
Source: Each story's own source https://deadline.com/2026/11/lionsgate-play-eklavya-ai-series-tiger-tv-1237232555/

Score: scale, fun_produce, uplift
