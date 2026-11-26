# The dovetail: how the layers of a makeyourmindup piece fit together

Proposed for Krish's yes, 25 Nov 2026. This says how real-world imagery, generated stills, generated motion, animation speed and type combine on one piece, and which layer leads in each format. Everything here sits inside the locked v5 look.

## The seven layers

| Layer | What it is | Its job | Its rules |
|---|---|---|---|
| 1. Evidence | Real documents, screenshots, charts drawn from real numbers, and company logos | Proves the point | Always sharp and at full brightness. Never burned, dimmed, tinted, tilted or redrawn. Logos unaltered and, side by side, at equal visible size. Cropped to the lines that matter, never padded with blank paper. Key text at least 28 px per 1080 px of canvas width. |
| 2. Footage | Krish on camera, his six approved headshots, and licensed real clips | Carries the voice | The face is never covered, never under a see-through band, and centred in its crop. Faces appear only on video, thumbnails and covers, never in carousels, banners or podcast art. |
| 3. Stills | Generated photographs of the operating-table world: real objects on a teal cloth under surgical light, no people | Sets the scene and the metaphor | Stills never carry a fact, a number or a logo; evidence does. They burn into ink only where type sits, and the burn is the only gradient. Each still shows one object doing one thing, sharp. |
| 4. Generated motion | Short moves made from a still (light flicker, a slow push, an object turning) | Keeps b-roll alive between evidence | Only under narration, never under on-screen type, at most one shot per beat, three seconds at most. Made from our own stills only. No Runway. |
| 5. Colour blocks | Coral, butter and lilac for why 1, 2 and 3; mint for the answer | Shows where the reader is in the climb | Flat with 7% grain. Type on colour is ink. One colour family per frame, used big. |
| 6. Type | Anton (the one loud line), Fraunces (the human line, italic for the contested), DM Mono (labels and sources) | Says the one thing | One Anton line per frame. On-screen words add a source, date, number or name, and never repeat the narration. Type sits on ink, on a colour block or in a photo's naturally dark burned area, never on an object. |
| 7. Motion | How everything enters, moves and leaves | Pace and clarity | 25 fps. Ease cubic-bezier(0.22, 1, 0.36, 1). Entries take 6 to 12 frames. Between cards: a wipe or a push, upward in the climb, never a flash or a crossfade. No bounce, overshoot, slap, tilt, zoom-pop or typing. Stills settle from 1.03 to 1.00 over their hold. |

## Which layer leads

One layer leads each frame. Everything else steps back to support it, or leaves.

| Format | Leads | Supports | Never |
|---|---|---|---|
| Hook and talking head (both cuts) | Footage | House captions | A wordmark, a graphic over the face |
| Title frame | Type | A still behind it, burned | The wordmark (the mark lives on the close) |
| Why step card | Colour block with the question | A still above it | Evidence on the same card |
| Evidence plate | Evidence | One Anton note, the rung-colour margin bar | A still, a second document |
| Split screen (shorts) | Evidence above, face below, equal weight | Captions on the seam | A see-through band, anything over the face |
| Big moment | Colour block with one Anton number | Nothing | A gradient (the old plum and ember look is retired) |
| Landing | Mint block with the insight | A still above it | A wordmark |
| Close | The wordmark (S3h) on ink | "Follow for more", the site in DM Mono | The headline, a second mark |
| Wide thumbnail and tall cover | A still or an approved headshot, with real logos | Anton headline, V4 under it | More than five words, a logo bigger than the headline |
| Carousel cover | A still, full bleed | Anton headline, V4 | A document, a robot |
| Carousel inner cards | The colour block or the evidence | Fraunces human line | Source lines (they go in the caption), numbers in the top-left corner |
| Good-news carousel | A real photo of the thing itself | Anton headline, one Fraunces line | A generated still standing in for a real event |
| Meme | A real photo or screenshot | One plain caption, the small V4 bottom-right under the picture | Stickers, badges, a headline treatment |
| Newsletter | Type | One image per deep dive | More than one wordmark |
| Podcast art | The wordmark (S3h) | The episode question, when it leads instead | Faces, photos |
| Profile | The icon (D) | Nothing | The icon beside a headline, any watermark |

## How a hero piece combines them

The order a reader meets them in the 90-second cut:

1. **Hook.** Footage leads: Krish to camera, with house captions. No graphic and no mark before the hook.
2. **Title moment,** within the first 30 seconds, as he says the title. Type leads over a burned still. It holds for at most two seconds.
3. **The climb.** For each why: the step card (colour block and question, still above), then its evidence plate (the real document), or a split with evidence above and face below. Generated motion may run under narration between them, never under type.
4. **Big moment,** at most once a cut: one full-frame rung-colour block with one Anton number.
5. **Landing.** The mint block with the insight and the open question.
6. **Close.** The coral, butter and lilac blocks push up in turn (four frames each), ink lands, and S3h with "Follow for more" holds. Tall: two seconds. Wide: six seconds, with the right 44% kept clear for YouTube's end-screen elements.

Captions are their own layer. They sit in one band per layout, run above every other layer, and are styled independently of the motion. They are never covered by a graphic or a platform's controls.

## Speed

| Element | Frames at 25 fps |
|---|---|
| Type line entering (rise 28 to 60 px) | 8, staggered 4 per line |
| Colour block wipe | 8 |
| Card-to-card push | 10 |
| Leader line, then its tag | 6, then 4 |
| Evidence card entering (slide 120 px) | 10 |
| Caption page | 2 to 5 words, changing on the spoken word |
| Holds | Step card 1.5 s; evidence plate at least 4 s (the engine's shot grammar); big moment at most 2 s; landing 3 s; any graphic at most 3.5 s unless it is evidence being read |

Graphics-led stretches keep moving: at least one change of state every two seconds. Talking-head stretches stay still apart from a slow push of up to 1.05.

## Sound

- **No opening sting.** Nothing before the hook (Krish, 12 Nov).
- **The close carries the sting.** Three short rising notes, one on each climb colour, landing on the ink frame.
- **One licensed bed under every cut.** Loud at the open, low under the voice, loud again at the close: one arc, never pumping. The levels are the approved ones: intro -16, bed -31, outro -18 LUFS; the final mix -14 LUFS integrated, true peak at most -1 dBTP.
- **Bed by lane.** Reflective, ambient beds for hero pieces; a brighter bed for good news and tips. Memes keep their own original sound.
- **One sound effect at most:** on the big moment, if it survives its test.

## What it rules out

- Two images leading at once: a still and a document at equal weight.
- A generated still or generated motion standing in for a real event, person, product or document.
- Any gradient other than the burn.
- Type over a photographed object.
- A third layer of words repeating the voice and the captions.
