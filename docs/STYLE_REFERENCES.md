# Style references: learning from the videos Krish wants his to be like

Krish, 2026-10-14: "Can you set up a folder where I can put videos that I
really like the production quality of, as well as the narrative style,
editing, camerawork, zooming, the way they break down a point, and the tone
and style of communication, so that you can learn from them? I often watch
videos and think I'd like to produce more like that."

## Where Krish puts them

Drive > makeyourmindup > **Video Engine > Inspiration**
(https://drive.google.com/drive/folders/1eqdc1hoMn6CwqkbKlG5mAmKCYNoR8otU;
`H:\My Drive\Ventures\Active Ventures\makeyourmindup\Video Engine\Inspiration` on the
home computers).

- **A video file** (mp4, mov, webm): drop it in. A saved Instagram, TikTok
  or YouTube video is fine.
- **Only a link**: add a row to the **What I like** sheet in the same folder
  (https://docs.google.com/spreadsheets/d/1_XBxxMUcU4CFHB5iJqWc1WtYKmJCftMOe5UlZYSM-_U),
  with the link in the first column.
- **What you like about it** (optional, worth the most): one row per video
  in **What I like**. Say what it does well in any of: narrative, editing,
  camerawork, zoom, breakdown (how it explains a point), tone, production.
  Anything you'd not copy goes in the last column.

Nothing in Inspiration is ever published, posted or cut into his videos.

## How it reaches the engine

Every pass of `scripts/recordings-upload.ps1` (both home computers, every
5 minutes) runs `references.py publish`. That sends each video in
Inspiration to the engine's library at
`1 Brand kit (permanent)/Style references/<file>`, once. Any machine then
gets them with `python scripts/quick-edit/references.py fetch`.

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
select name, drive_file_id, why_like, why_like_source, why_here, read_as,
       note_for_claude, answered_at
from inspiration_items
where route = 'study_style' and answered_at is not null
order by answered_at desc
```

1. A card whose `drive_file_id` matches a reference's `drive_id` in
   `config/style-references.json` is that reference: study it first if it
   is `waiting_for_study`, and leave a studied one as it is.
2. A card with no matching reference (a video or image from Cold Ideas, or
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
4. His words: copy `why_like` into `krish_likes` word for word only when
   `why_like_source` is `typed`. A `picked` reason is a guess he agreed
   with: record it in `notes` as "agreed with: ...", never as his words.
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

## How it changes the videos

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
