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

## The floors (top to bottom): the work only

| Floor | The work | Hands off |
|---|---|---|
| Roof: Decide | Approve, pick, press send | Yes or no, fast |
| 01 Spot | Read every link, watch what is moving, catch the idea early | Ideas worth making |
| 02 Write | Research it, script it, check every fact | Scripts ready to record |
| 03 Make | Record, cut the video, design the visuals | Finished assets |
| 04 Ship | Post, schedule, answer every comment | Posts live everywhere |
| 05 Sell | Research the account, prep the call, draft the follow-up | Booked meetings |
| 06 Build | Write the code, test it, fix what breaks | Things that work |
| Basement: Remember | File everything, turn every correction into a rule | Nothing said twice |

A courier rides the lift shaft on the right carrying a parcel up the building: the hand-off made visible.

## The cast (one figurine per role)

Each figurine has one action, a loop of 0.8 to 1.6 s, whose moving part travels at least 6% of the figure's height,
so it is visible within a second on a phone. Nothing else on it moves more than a breath.

| Floor | Role | Personality | Action | Mark |
|---|---|---|---|---|
| Roof | You | The calm one | sips a mug | none (human) |
| Roof | Approver | Decisive | stamps | Claude on legs |
| Spot | Reader | Curious | head turns, scanning | Claude on legs |
| Spot | Scout | Watchful | binoculars sweep | head: a search tool |
| Spot | Ideas | Dreamer | lightbulb blinks over its head | Claude on legs |
| Write | Researcher | Thorough | flips pages | Claude on legs |
| Write | Writer | Eager | types fast | Claude on legs |
| Write | Checker | Skeptic | shakes its head, then nods | Claude on legs |
| Make | Editor | Rhythmic | head bobs to the beat | head: a video tool |
| Make | Designer | Precise | taps a pen | head: a design tool |
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
