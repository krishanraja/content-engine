# Style references: learning from the videos Krish wants his to be like

Krish, 2026-10-14: "Can you set up a folder where I can put videos that I
really like the production quality of, as well as the narrative style,
editing, camerawork, zooming, the way they break down a point, and the tone
and style of communication, so that you can learn from them? I often watch
videos and think I'd like to produce more like that."

## Where Krish puts them

Drive > Ventures > Inspiration > **Production Inspo**
(https://drive.google.com/drive/folders/1QxrzxISYFXq0er0DG0XSapm7qhvuRmh-;
`H:\My Drive\Ventures\Inspiration\Production Inspo` on the home computers).
Krish moved it there from Video Engine > Inspiration on 2026-10-24; its
partner, **Content Inspo** (the old Cold Ideas & Inspo), holds the content he
likes and the **What I like** sheet.

- **A video file** (mp4, mov, webm): drop it in. A saved Instagram, TikTok
  or YouTube video is fine.
- **Only a link**: paste it on Control Center's Inspiration board (content-watcher
  fetches it), or add a row to the **What I like** sheet in Content Inspo
  (https://docs.google.com/spreadsheets/d/1_XBxxMUcU4CFHB5iJqWc1WtYKmJCftMOe5UlZYSM-_U),
  with the link in the first column.
- **What you like about it** (optional, worth the most): one row per video
  in **What I like**. Say what it does well in any of: narrative, editing,
  camerawork, zoom, breakdown (how it explains a point), tone, production.
  Anything you'd not copy goes in the last column.

Nothing in Production Inspo is ever published, posted or cut into his videos.

## How it reaches the engine

Every pass of `scripts/recordings-upload.ps1` (both home computers, every
5 minutes) runs `references.py publish`. That sends each video in
Production Inspo to the engine's library at
`1 Brand kit (permanent)/Style references/<file>`, once. The library takes at
most 100 characters a name, and downloaders name clips after the post's ID
(a SaveClip.App_ name ran to 120 on 2026-10-24 and stopped every pass), so a
longer name goes in cut short with the first 8 hex of its sha256 before the
extension (`references.library_name`); `fetch` maps a long name the same way.
A name is also put in composed Unicode (NFC), which the library requires. A
name the library still refuses for any other reason no longer stops the rest:
every other clip goes in, and the pass fails naming the refused one and its
reason (`references.split_refused`), so the lane report still shows it.
Any machine then gets them with `python scripts/quick-edit/references.py fetch`.

## How a session studies one

When asked to study the style references, or when one is listed as
`waiting_for_study` in `config/style-references.json`:

1. `python scripts/quick-edit/references.py fetch <file>`.
2. `python scripts/quick-edit/references.py study .cache/references/<file>`.
   This measures:
   - every shot and cut, with cuts a minute and median shot length;
   - push-ins and pull-outs;
   - the words, the first ten seconds and the words a minute;
   - loudness.

   It writes `study.json` and a contact sheet, `contact.jpg`, with one frame
   per shot.
3. **Look at the contact sheet** (Read the image) and read the transcript
   in full. Watch for:
   - **framing:** how big the face is in the frame, and where the eyes sit;
   - **on-screen text:** how much there is, its size and position;
   - **B-roll and graphics:** how often they appear, and how cuts land on
     beats;
   - **the narrative:** the hook, the order of the breakdown, the open
     loops and the payoff;
   - **tone:** person, energy, humour, and how it asks for something.
4. Read Krish's row in **What I like** (the Drive connector reads the
   sheet). His words decide which crafts matter most.
5. Add what it teaches to the **style bank** in
   `config/style-references.json`:
   - one module per technique, each with:
     - `id`;
     - `layer`: one of opening, structure, breakdown, proof, tone, close,
       editing, camerawork, graphics or production;
     - `name`;
     - `how`: concrete enough to apply;
     - `from`: the reference;
     - `fits`: the kind of piece it suits;
     - `krish_verdict`: `untested` to start.

     Reuse a module the bank already holds rather than adding a twin.
   - On the reference itself: list the modules it gave, and copy Krish's
     row from the sheet into `krish_likes`, word for word.
6. `python scripts/quick-edit/references.py --self-test` must still pass.
   It checks the bank.

## Cards he sends from the Inspiration page

Krish answers each thing he drops in either inspiration folder on Control
Center's Inspiration page. A card he routes to **Study the style** comes
here (the card says it goes to "the style bank, studied before the next
recording"). The Sunday plan reads them (`plan-week`, step 0), and any
session asked to study the style references reads them too:

```sql
select name, drive_file_id, why_like, why_like_source, picked_likes, why_here,
       read_as, note_for_claude, facets, transcript, answered_at
from inspiration_items
where 'study_style' = any(routes) and answered_at is not null
order by answered_at desc
```

1. A card whose `drive_file_id` matches a reference's `drive_id` in
   `config/style-references.json` is that reference: study it first if it
   is `waiting_for_study`, and leave a studied one as it is.
2. A card with no matching reference (a video or image from Content Inspo, or
   one the home computers have not sent yet) is added as a reference with
   `status: waiting_for_study`, then studied as above. Fetch a video with
   `python scripts/post-pack/recording.py get` only if it is in the Inbox;
   otherwise read it through the Drive connector.
3. How he said to read it comes first. `read_as` `watch` means study the
   whole video with sound (fetch it and run `references.py study`), never
   judge it from the card's preview frame; `listen` means the audio;
   `read` the words; `look` a glance is enough. `note_for_claude` is his
   instruction to you: follow it, and copy it into the reference's `notes`.
   The file is `https://drive.google.com/file/d/<drive_file_id>/view`.
4. `facets` says where it came from (platform, source, creator) and its
   format; record them on the reference as `creator` and `notes`.
   `transcript` holds its words when the taste ledger already watched it,
   so the study can start from them.
5. Which craft to study comes from his reason (Krish, 2026-10-24: "if I
   post a video in here, it's because I like either the script, the
   narrative, or the production style. When I post images in here, it's
   because I like the clarity"). The card's `picked_likes` name it: The
   script means the opening, breakdown and tone layers; The narrative the
   structure, breakdown and close; The production style the editing,
   camerawork, graphics and production layers; The clarity, on an image,
   the graphics layer, for carousels and the pictures in a video. A card
   with no reason picked is studied on every layer.
6. His words: copy `why_like` into `krish_likes` word for word only when
   `why_like_source` is `typed`. Each of `picked_likes` is a guess he
   agreed with: record it in `notes` as "agreed with: ...", never as his
   words.
   His `why_here` goes in `notes` too.

## The bank, the base and the recipes

Krish, 2026-10-14: "I think we need to build a bank of different styles that
we know can be modularized and used. You already have a tonne of
pre-existing knowledge of what I like and, more importantly, what I don't
like, which you can lean on and I don't think should be totally
overwritten. I would prefer to build a modular bank of styles over time that
we can draw inspiration from and mix together at different layers, like an
alchemist."

- **The base** is what he already likes and dislikes. It always applies,
  and no module overwrites it. It includes:
  - the house rules, with his words;
  - his golden lines, such as the personal intro;
  - the title verdicts;
  - the hook playbook;
  - the voice check and story check.
- **The bank** grows with every reference. It holds techniques, not
  templates. No single reference becomes "the way".
- **A recipe** mixes modules for one piece, layer by layer: for example a
  Fry opening, a villa number reveal, and his own tone. A recipe needs his
  words. A module he has marked `not for us` can never be mixed in again.
- **After the piece**, he gives each module he saw a verdict: `liked`
  (draw on it more), `untested`, or `not for us`. The bank learns. The base
  changes only when he changes a house rule.

## Formats: whole-piece styles he chooses from

Krish, 2026-10-24: "It should also be able to suggest script and production
styles that I can choose from or that it recommends for specific content.
This engine should be pushing and pushing and pushing, becoming more and more
creative and experimental."

`formats` in `config/style-references.json` names whole-piece styles, each a
mix of bank modules: `script` formats (the story's shape, such as Head to head
or The Hannah Fry explainer) and `production` formats (the visual treatment,
such as Voice-led, every line has its picture). Each has its pitch, what it
fits, its evidence (his words, or "engine proposal" when it is not yet his),
its `status` (proven, trial, experimental) and his verdict. Every Sunday idea
carries one recommended script format, one production format and one untried
experiment; `divergence` says how varied the week must be, and the board
refuses a week that is not. The format he picks goes into the piece's
creative direction (`docs/CREATIVE_DIRECTION.md`), and his verdict after the
piece is recorded on the format, as on a module.

## How it changes the videos

Video is made with the ve engine (`docs/ve/ENGINE.md`, `docs/ve/RUNBOOK.md`); the quick-edit path stays the fallback until ve passes Phase 3.

For ve, `python scripts/ve.py study <reference.mp4> [--out <grammar.json>]` measures cuts, change density, still runs and loops. The reference bank remains context for direction; only registered ve devices and verbs may render, and a new mechanism goes through `ve card`, `ve dispatch` and `ve verify-card`.

- **Scripts** (make-piece): when a piece has a recipe, apply its opening,
  structure, breakdown, proof, tone and close modules, on top of the base.
  Without a recipe, propose one from the bank, using modules he has
  `liked` first, and ask him before writing.
- **The edit** (produce-video, step 4): apply the recipe's editing,
  camerawork and graphics modules. The report sets the cut's pace beside
  the pace of the references it drew on.
- **Recording**: the recipe's camerawork and production modules go to him
  as one line on the day's publish board before he records.

A reference is a teacher, never a template. Never copy its words, music,
footage or graphics. Take the move and make it his.
