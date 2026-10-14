# Style references: learning from the videos Krish wants his to be like

Krish, 2026-10-14: "Can you set up a folder where I can put videos that I
really like the production quality of, as well as the narrative style,
editing, camerawork, zooming, the way they break down a point, and the tone
and style of communication, so that you can learn from them? I often watch
videos and think I'd like to produce more like that."

## Where Krish puts them

Drive > makeyourmindup > **Video Engine > Inspiration**
(https://drive.google.com/drive/folders/1eqdc1hoMn6CwqkbKlG5mAmKCYNoR8otU;
`H:\My Drive\Ventures\Active\makeyourmindup\Video Engine\Inspiration` on the
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
5. Write the reference into `config/style-references.json`:
   - `study`: the measured numbers (pace, zoom, speech, loudness);
   - `krish_likes`: his words, verbatim;
   - `moves`: 3 to 8 specific, borrowable moves, each with:
     - `craft`: one of narrative, editing, camerawork, zoom, breakdown,
       tone or production;
     - `move`: what to do, concrete enough to apply ("a push-in of about
       one twentieth on the sentence that states the finding", not
       "dynamic camera");
     - `evidence`: the timestamp or number in the study;
     - `where_it_applies`: the script, the record, the edit (`make.py`) or
       the thumbnail.
   - `status`: set it to `studied`.
6. `python scripts/quick-edit/references.py --self-test` must still pass,
   because it checks the ledger.
7. Tell Krish the three moves you'd adopt first, and ask which to make
   house defaults. A move with `house_default: true` changes how every
   video is made. It needs his words in `krish_said`, and the ledger check
   refuses one without them.

## How it changes the videos

- **Scripts** (make-piece, "The Scripts step"): read the moves whose craft
  is narrative, breakdown or tone, and apply the house defaults to the
  opening, the order of the breakdown and the sign-off.
- **The edit** (produce-video, step 4): read the editing, zoom and
  camerawork moves. House defaults guide the `make.py` plan: where to cut,
  where to push in, how long a shot holds. Each finished video is compared
  with its references' pace in the report ("our cuts a minute against
  theirs").
- **Recording** (what Krish does): camerawork and production defaults are
  shown to him before he records, as a short line on the day's publish
  board ("today: tighter framing, push in on the finding").

A reference is a teacher, never a template. Never copy its words, music,
footage or graphics. Take the move and make it his.
