# The work, as one building: version 2 plan (18 Nov 2026)

Krish, 18 Nov 2026, on version 1: "get rid of the quote at the bottom, and turn all the characters in to tiny
figurines that have their own personalities and do little actions that roughly suit their personalities. make it the
smallest available movement or visual trait that can be observed in 1 sec and even on a small screen. Have the
building animate in to existence too. Also, scrub all mention of my actual ventures and keep this task/outcome focused
only. Look at the 3D nature of this design, and the characters moving about doing things, some with Claude logos on
legs, some with other company logos on their heads. So, less focus on my actual products, more actual focus on breaking
out the work. Plan this properly, and involve Codex to produce the anchor visuals you can animate if needed."

## What changes from version 1

| Version 1 | Version 2 |
|---|---|
| Flat HTML cutaway | A real 3D scene (three.js, orthographic, three-quarter view), rendered frame by frame |
| Robot heads at desks | Toy figurines, each with a personality and one small action that reads within 1 s on a phone |
| Floors named after his ventures and engines | Floors named after the work: what is done and what it hands off. No venture, product or repository names |
| Static building | The building assembles itself: slabs drop in from the bottom up, walls rise, furniture lands, figurines pop in |
| Quote footer | Gone. The building gets the space |
| Logos absent | Claude agents wear the Claude mark on their legs; tool agents wear their tool's mark on their heads |

## Version 3 (18 Nov 2026): richer, closer to the source post

Krish, 18 Nov 2026, on version 2: "i preferred the amount of workers and how they were roughly split out in this one -
taste, judgement, vision, standards, inspiration, divergent thinker consultant, voice checker. Librarian is just one part
of an AI brain - it's really the proactive chief of staff that has a librarian, auditor, analyst, trend spotter,
inspiration-house, file archives as well as content archives and all the above. It's been dumbed down way too much now
as has have all the floors above it. we need to find something closer to the source post I sent you".

The cast and copy now live in `scene/scene.js` (`LEVELS` and `CARDS`): five or six workers per floor in two named rooms
each, the roof as the decision deck (vision, judgement, taste, standards, you), the basement as a double-height AI brain
run by a proactive chief of staff with its archives and analysis teams, and cards that name the tools like the source.
The tables below are the version 2 brief, kept as history.

## The floors (top to bottom): the work only, in plain words

Krish, 18 Nov 2026: "Put everything in layman's terms as well, its important to not overwhelm people - and make sure
you do not miss the opportunity to subtly show how important AI Brain in the basement is as being the most important
foundational piece". So every label is a few everyday words, one idea per card, no jargon.

| Floor | What happens (plain words, three lines per card) | What comes out |
|---|---|---|
| Roof: I decide | Approve what goes out under my name; pick the strongest of the options; press send when it is ready | A fast, clear yes or no |
| 1 Find ideas | Read every link and newsletter I save; track what people are talking about; flag ideas before they become obvious | A shortlist worth making |
| 2 Write | Research the facts and the sources; draft each script in my own voice; double-check every claim and number | Scripts ready to film |
| 3 Make | Film and edit the video into shape; design the covers and carousels; add the voice, captions and music | Finished videos and posts |
| 4 Share | Post it on every channel at once; schedule it for the right time of day; reply to every comment and question | Posts out, people talking |
| 5 Sell | Research each company before the call; prepare the questions worth asking; send the follow-up the same day | Meetings booked in the diary |
| 6 Build | Build the tools the whole team uses; test them properly before they ship; fix whatever breaks, fast | Tools that keep working |
| Basement: The AI brain | Remembers every piece, call and decision; turns each of my corrections into a rule; every floor checks it before acting | Every floor runs on this |

Krish, 18 Nov 2026, after a first plain-words pass: "it's gotten too simple now in terms of words", then "make the
wording 15% more descriptive". So each card carries three concrete everyday lines, each fitting on one line.

A courier rides the lift on the right carrying a parcel up the building: work passing from floor to floor.

## The AI brain is the foundation (shown, never said loudly)

- **It is built first.** The animation opens on the empty ground; the brain lights up in the basement, then every floor
  lands on top of it.
- **It feeds every floor.** Thin mint lines run from the brain up the back corner of the building to each floor, and small
  pulses of light travel up them all the time.
- **It glows brightest at night.** As the day ends the floors dim and the brain's glow lights the building from below.
- **Its card closes the panel** with "Every floor runs on this", the only card marked in mint.

## The cast (one figurine per role)

Each figurine has one action, a loop of 0.8 to 1.6 s, whose moving part travels at least 6% of the figure's height,
so it is visible within a second on a phone. Nothing else on it moves more than a breath.

| Floor | Role | Personality | Action | Mark |
|---|---|---|---|---|
| Roof | You | The calm one | sips a mug | none (human) |
| Roof | Approver | Decisive | stamps | Claude on legs |
| Spot | Reader | Curious | head turns, scanning | Claude on legs |
| Spot | Scout | Watchful | binoculars sweep | Claude on legs |
| Spot | Ideas | Dreamer | lightbulb blinks over its head | Claude on legs |
| Write | Researcher | Thorough | flips pages | Claude on legs |
| Write | Writer | Eager | types fast | Claude on legs |
| Write | Checker | Skeptic | shakes its head, then nods | Claude on legs |
| Make | Editor | Rhythmic | head bobs to the beat | head: a video tool |
| Make | Designer | Precise | taps a pen | head: Codex (OpenAI) |
| Make | Voice | Performer | arm gestures while talking | head: a voice tool |
| Ship | Poster | Punchy | presses a big button | head: a scheduling tool |
| Ship | Replier | Friendly | waves | Claude on legs |
| Sell | Caller | Talkative | headset, head tilts, hand gestures | Claude on legs |
| Sell | Follow-up | Restless | paces back and forth | head: email |
| Build | Coder | Focused | types | head: the code host |
| Build | Tester | Suspicious | leans in with a magnifier | Claude on legs |
| Build | Fixer | Handy | turns a wrench | head: a deploy tool |
| Basement | Librarian | Tidy | lifts a box to the shelf | head: the database |
| Basement | Linker | Thinker | hand on chin, nods | Claude on legs |
| Lift | Courier | Busy | rides the lift with a parcel | Claude on legs |

## Timeline (12 s, 30 fps, 1080x1350)

| Time | What happens |
|---|---|
| 0.0 to 3.0 s | The building assembles: slabs drop in from below, walls and furniture land, figurines pop in with a small overshoot, then the labels |
| 3.0 to 7.0 s | Day. Everyone works; the courier rides up |
| 7.0 to 9.0 s | Dusk. Windows and desk lamps come on, the title changes |
| 9.0 to 12.0 s | Night. Work goes on |

## Who makes what

- **Codex: the anchor visuals.** The figurine kit (`lab/universe/figurines/`), every personality and its action, to the
  contract below, from card `docs/ve/cards/universe/ve-universe-figurines.md`.
- **Claude: the building, the staging and the proof.** The 3D building and its assembly, the camera, light, day to night,
  labels and the side panel (`lab/universe/scene/`), logos fetched from Brandfetch, the render, and a full-size frame
  review before anything is sent.

## The figurine contract

```js
// lab/universe/figurines/index.js (ES module, no imports: THREE is passed in)
export const PERSONALITIES = [/* ids below */]
export function makeFigurine(THREE, spec) // -> { group, update(t), actor }
```

- `spec`: `{ personality, body, accent, skin, head: 'human' | 'bot', headLogo: THREE.Texture | null, legLogo: THREE.Texture | null, seed }`.
  `body`, `accent` (eyes, hair, props' dark parts) and `skin` are CSS colours given by the scene; the kit has no colours of its own.
- Units: the figure stands on y = 0, faces +z, is 0.55 to 0.70 tall and fits a 0.45 by 0.35 footprint (props included).
- `update(t)`: t in seconds, a pure function of t and `seed` (no clock, no random); `seed` offsets the loop phase only.
- `actor`: the part that does the action. Within any 1 s window it moves at least 0.04 units (or turns at least 12
  degrees); every other part moves under 0.012 units.
- Look: chunky toy figurine, rounded and matte (MeshStandardMaterial, roughness 0.8 and up), a big head, short legs,
  readable silhouettes. A bot head is a rounded box with two eye dots and a flat front where `headLogo` sits as a
  decal; a human head is a sphere with hair. `legLogo` sits on the front of both thighs.
- Personalities: `sipper`, `stamper`, `scanner`, `binoculars`, `bulb`, `pageflip`, `typist`, `skeptic`, `bobber`,
  `pentap`, `talker`, `button`, `waver`, `caller`, `pacer`, `magnifier`, `wrench`, `filer`, `chin`, `courier`.

## Where this is going (Krish, 18 Nov 2026)

"note for later that we will add this video to one of my linkedin posts (the ultimate outcome of this is a series of
linkedin posts scheduled in Buffer."

- The version 3 video and its day and night stills are filed in Drive: `mind/make > 00_Brand-Assets > 03_Social-and-Ads`
  (folder `1u-35-pcnvdn-kRvSf-U2uAc-QW7Ri2QB`), each named `2026-11-18 Inside my AI-native firm - floor by floor - ...`.
  Video `1amysBFJJw6Ra8ws4BqR8pWleBVVMmqsQ`, day still `1ZrriySuJVrFBzSTnXsvsIQuETv6KYGRN`, night still
  `17DZDWvvocz-EOh_MczMUT4MwWONI52K-`.
- The outcome: a series of LinkedIn posts, scheduled in Buffer, with this video in one of them. Scheduling is a
  publication: it waits for Krish's yes on the exact posts, every time.

### Version 4 and the floor close-ups (18 Nov 2026)

Krish, 18 Nov 2026: "I dont think the characters in the original video have enough personality for what they do,
visually - I would not say no to you rerendering the characters and redoing the original video". The cast is now one
figurine per job (`figurines/roles.json`, 49 jobs), built by Codex from card `ve-universe-figurines-3` in two passes
(the second after Claude's full-size line-up review: builds, faces, costumes, real hats, bigger props), checked by
`figurines/check.mjs` and looked at with `figurines/lineup.cjs`. Figures stand 1.3 in the building (was 1.12).

Filed beside the version 3 files in `03_Social-and-Ads` (`1u-35-pcnvdn-kRvSf-U2uAc-QW7Ri2QB`), version 3 untouched:
- The master, version 4: video `1dhobSF8X6nN5vZsXCoY55_OcQOzIh8Nf`, day still `1PsF0HkRzeqhQdEWfJbhoc1vJCaxAK0Rt`, night
  still `1vQS-5K6CzW3XFvkaJcvdngb7MpGy0cZk`.
- Floor close-ups for the LinkedIn series (growth-mindmake), 5 s, 1080x1350, 30 fps, a walk across the floor in daylight
  with only those floors' cards (`node lab/universe/render3d.cjs <out> --shots all`):
  - The decision deck: video `1FVxSZTw-qsfvvXJHzunMiGuuRLMJ9PeP`, still `1hT3a7E9Ryk9QcPSziq5lxwNCf9hIetAD`
  - Watch + write: video `1Ur2huDJcv9Z39pGcapsyK07xkuPJ_PKc`, still `17WVlKoo5E9R5pkqxSMAliY-L_wdjvoC8`
  - Share + sell: video `1tOqV2UrneLcSbz9FtFjdthtloESNZcuu`, still `1fiiIQ1iKNY5N3JiCDJHe6AsXfJo2cnDK`
- Nothing is posted or scheduled; Krish said "do not schedule anything" for now.

