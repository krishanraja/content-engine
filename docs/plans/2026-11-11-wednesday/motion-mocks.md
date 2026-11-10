# Wed 11 Nov, under.the.hood: motion mocks from the 10 Nov takes

Piece 36886e0b-4b32-473b-be72-b0aef31fccef. Krish, 2026-11-10: "produce visual mocks of a bunch of frames
that give me an idea as to how this is going to be a world-class motion-designed piece (that includes epic
transitions and constantly moving visuals that contribute to what I'm saying additively). If you have to get
screenshots of reports or videos of dads dancing, please do pull out all the stops." Then: "use codex for the
producer for heavy lifting and micro manage it".

Takes: both shot 1080x1920 at 48 fps (long 6:01, short 1:33), so the 16:9 long cut is a face column plus a
stage, never a stretched face. Times below are the long take's own clock (faster-whisper small.en, rough).

Floor (`floor.py --format motion`): real imagery in brand colours, never clipart; real logos; no third layer
of words; his face not in everything; every panel changes state to carry the argument; one opening only.
Motion style: `living-ui` (the real interfaces rebuilt so the camera can zoom and they act on his words).
Brand: cream `#F4EFE4`, ink `#0C1512`, mint `#7EF0C0` (human), AI as ink with a diagonal machine hatch (the tokens hold no coral); Anton,
Archivo, Plex Mono labels, Fraunces italic for the human line.

One world: the song's own arrangement. Every frame after the cold open lives inside, or zooms out of, one
DAW-style arrangement (Krish's reference screenshot, 9 Nov). Layers are lanes; who made each lane is a tag;
the camera never leaves the song, it only zooms.

## Frames (long cut, 16:9)

| # | At | He says | On screen, moving | Into the next |
|---|---|---|---|---|
| 1 | 0:02 | "Does this track sound familiar?" | A real TikTok (dad dancing) full bleed with the song up; a second and third drop in beside it on the beat until a wall of six fills the frame | The wall pulls back and tilts into a phone feed |
| 2 | 0:05 | "all over TikTok… all over the charts" | The TikTok sound page count ticks up; the Official Charts entry slides in from the right, No. 2 slams | Whip right |
| 3 | 0:07 | "which came first, TikTok or the charts?" | TikTok and Official Charts logo cards on a race line, a marker swinging between them | The marker becomes the song's waveform |
| 4 | 0:11 | "AI music or human music?" | The waveform splits lengthwise: mint (human) above, hatched ink (AI) below | Episode card |
| 5 | 0:18 | "Movin' To The Sun… number two in the UK" | Face column left; cover art and the Spotify page right, streams rolling | Push in on the cover |
| 6 | 1:02 | "an AI music app called Suno" | Slot machine (Codex): the real Suno boxes type the lyrics and "deep house, female singer, summer" | Lever |
| 7 | 1:17 | "press a button… two whole songs" | Lever pulls, reels spin as waveforms, two song cards pay out; "press again" spins it once more | Zoom through song card 1's waveform |
| 8 | 1:35 | "zoom in on how a song is built" | Arrangement (Codex): the waveform opens into four lanes, DRUMS, BASS, CHORDS, VOICE, each playing | Playhead runs on |
| 9 | 1:47 | "synths… samples… a pack you can buy" | Tags slap onto lanes: SYNTH, SAMPLE; the real Splice page slides under the guitar lane | Prompt chip rises |
| 10 | 2:18 | "talk a layer into existence… choir, sitar, robot" | A prompt chip types "add a choir"; a new hatched AI lane drops in; sitar and robot follow on a stagger; the lane count climbs | Pull out to the feed |
| 11 | 2:44 | "AI cats… weddings… dads dancing badly" | The TikTok wall again, now with the comments cascading: "what is this song?" | Comments drain into a timeline |
| 12 | 3:04 | "which came first? TikTok, and the charts came later" | A timeline: the TikTok spike first, the chart line climbing after it to No. 2 | The chart line floods |
| 13 | 3:12 | "over half of the new songs… almost no one listens" | Upload flood (Codex): song tiles pour, over half hatched AI; a listens meter barely moves; one search bar types "what is this song" | The search result is the song |
| 14 | 3:27 | "HUGEL… pulled it apart… rebuilt it by hand" | The arrangement returns: her lanes lift out, a few pinned; new lanes drop: sample-library drums, synth bass, piano, strings | Stamp |
| 15 | 3:44 | "drums no one actually played" | A stamp lands on the drum lane | Voice lane lights |
| 16 | 3:49 | "Ultra Naté… the nineties" | Her 1997 "Free" artwork turns into the 2026 single; the VOICE lane goes mint | Solo the voice |
| 17 | 4:03 | "a thin layer of the original AI singer" | VOICE soloed: her waveform mint on top, a thin hatched AI hum underneath, both moving | Trophies |
| 18 | 4:24 | "Grammys… ruled it out of the writing prize" | Real headlines stack in; two trophy cards: SONGWRITING ruled out (reportedly), PERFORMANCE still in; HUGEL's appeal stamp | Back to the arrangement |
| 19 | 5:01 | "a healer had the idea… a legend sang it" | Credits: each lane names who did it, healer, Suno, strangers (TikTok), HUGEL, Ultra Naté and the robot; every lane fills two-tone | Morph |
| 20 | 5:28 | "the advert… the report… the deck" | The lanes morph into a real deck's layers and a report's sections, each tagged who and what | Face |
| 21 | 5:42 | "I'll ask who did which bit" | Face full, the mint question drawn beside him; end card makeyourmindup.ai | End |

## Short cut (9:16): frames 1, 7, 11, 14, 17, 18 and 21, each re-authored tall.

## Who builds what

Codex (cards in `docs/ve/cards/w11-mocks/`, built on the home computer, verified here): `clip` (the existing
card `ve-w11-1-clip`), `arrangement`, `slot_machine`, `upload_flood`. Claude: sources (real screenshots
and clips), frame timing, the stills composite and the transition previews, and the review of every
Codex frame against this table before Krish sees it.
