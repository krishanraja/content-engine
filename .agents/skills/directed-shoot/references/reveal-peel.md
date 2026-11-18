# Format: the reveal peel ("Nothing is real anymore")

The reference Krish sent on 2026-11-18 (`videoplayback_3.mp4`, 24.2 s, 9:16), read with content-watcher (one shot,
one continuous take, 183 words a minute) and looked at frame by frame at 2 frames a second. The copy he sent is a
Malay-dubbed repost; the on-screen captions are the English original. His words: "I'd also like you to build an
experimentation skill that takes things to this kind of attached level around me in a video ... directed more like a
film script. I'd be given instructions to walk and do certain things and then I'd record that. The post-production
would do something like this to it."

## What is on screen

Two panels, stacked, for the whole 24 seconds:

- **Top, the lie:** the same take, re-rendered by a video-to-video model into something better. It is daytime, the
  setting is a smart car park, he is in a pressed shirt and chinos, and the props become a cat, a yellow Lamborghini
  and a BMW motorbike.
- **Bottom, the truth:** the raw take, labelled "ORIGINAL". It was shot at night in a housing-estate playground, he is
  in a T-shirt and shorts, and the props are a black bag and an outdoor exercise bike.
- A fixed header, "Nothing is real anymore", sits above. A single word-by-word caption line (monospace) sits between
  the panels.

The two panels play the same take, in sync, frame for frame. Every pose in the top panel is his real pose in the
bottom one.

## The peel, beat by beat

Each beat makes one claim, and the next line takes it back. Each take-back removes exactly one transformation from
the top panel, in the reverse order to how they were stacked, until the top panel matches the original.

| Time | Line (English captions) | His action in the take | Top panel |
|---|---|---|---|
| 0 to 4 s | "Do not believe in everything on social media right now, anything can be fake." | Walks towards camera down the path | Day, car park, smart clothes |
| 4 to 8 s | "Do you think I'm hugging a cat? Actually, I'm hugging a bag. This is the real bag." | Stops, hugs the bag to his chest, then holds it out | A cat in his arms, which becomes the bag on "a bag" |
| 8 to 12 s | "Look at my car. Isn't it beautiful? Actually, it's a bike." | Turns, gestures off to his right, crouches beside the bag on the ground | The camera swings to a yellow Lamborghini beside him |
| 12 to 16 s | "Let me show you. Actually, it's ..." | Walks to the exercise bike and climbs on | The Lamborghini becomes a BMW motorbike, which he mounts |
| 16 to 19 s | "... not even a real bike. And right now, this is the real location." | Sits on the exercise bike | The motorbike becomes the exercise bike, still in the car park. On "real location" the car park becomes the playground, in daylight |
| 19 to 24 s | "And it's not daytime. It's nighttime. So don't get tricked. Nothing is real." | Sits, speaks to camera | On "nighttime" day becomes night. The top now matches the original |

## Why it works

- **The take is the proof.** The bottom panel never lies. The viewer can check every claim against it as it is made,
  so the reveal lands at once, without anything needing to be explained.
- **One lie per beat, removed in order.** The removals run object, then vehicle, then location, then time of day:
  small to large, ending on the whole world. Each one lands on the word that names it ("a bag", "a bike", "real
  location", "nighttime").
- **Matching silhouettes.** Each prop is chosen so the swap keeps its shape and pose: a bag held to the chest becomes
  a cat, a crouch beside a low object becomes a crouch beside a car, and climbing onto a seat with handlebars becomes
  mounting a motorbike. The model only has to repaint. It never has to invent a new movement.
- **One continuous take.** With no cuts in the original, the top panel's changes are the only events. The eye goes
  where the change is.
- **The point and the effect are the same thing.** The piece says "you can't trust what you see", and it shows that
  by fooling the viewer and then undoing the fooling in front of them (AGENTS.md rule 6: every visual makes a critical
  point land faster).

## How it was made (inferred from the frames, not confirmed by the creator)

1. One continuous handheld take at night, in 9:16, walking towards camera and then stopping, with the props in reach.
2. Several video-to-video renders of that same take, each with a stack of edits (all of them, then all but the cat,
   then all but the cat and the car, and so on), or one render per beat with that beat's prompt.
3. A cut between the renders in the top panel on the word that removes each edit, timed to the word.
4. The raw take stacked below, with the header and captions laid over.

## Where it meets Krish's rules (his rules win)

| The reference does | His rule | What this skill does |
|---|---|---|
| Labels the raw panel "ORIGINAL" | No on-screen labels, tags or marks (28 Oct: "I hate all these stupid little abbreviations and marks") | No text label by default. The raw panel reads as the raw take. A label goes in only with his yes for that piece |
| Shows a generated world as if it were real | `docs/ve/ENGINE.md`: "a generated picture never stands in for a real place, record or test" | In this format the generated layer is the lie, and it is undone on screen. Generated pictures never stand in as proof of a factual claim |
| A constant header plus a caption line | Captions are chosen apart (`style.captions`), and every opening and close comes from `config/brand-palette.json` | The experiment keeps the palette's one opening and one close. The caption line and the header are part of the experiment's own frame, and are declared in its shot script |
| A dubbed voice | Floor 3: his words never cut, changed or out of sync | His own voice, his own take, kept in sync in both panels |
| Generated clothes and setting around him | His face only (Ruling, Krish, 2026-10-22, his face and voice for makeyourmindup shorts); zero creative limits in this route (Ruling, Krish, 2026-11-18) | His face changes only where the shot script turns him into something on purpose (`wild.md`). Drift anywhere else fails |
