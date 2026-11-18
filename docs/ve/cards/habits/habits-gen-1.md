ve card habits-gen-1 for 2026-11-17-tue-habits (art_direction): generated stills for the comic beats

You are the visual asset maker for one 88-second vertical (9:16) voiceover short, "Which of your habits will cost you your job once AI is at work?" (makeyourmindup, off-day). Claude planned it; you make the generated stills. Never edit anything outside .scratch/ve/habits/gen/. Never publish, upload, post or send anything. Never commit.

Use your built-in image generation. For each slot below make TWO candidates (a and b), portrait, the largest portrait size you can (1024x1536 or larger). Save as .scratch/ve/habits/gen/<slot>-a.png and <slot>-b.png. Then write .scratch/ve/habits/gen/manifest.json: one entry per file {slot, file, width, height, sha256, prompt (the exact prompt you used), notes}. Then make one contact sheet .scratch/ve/habits/gen/contact.jpg (all candidates in a grid, each labelled with its file name in small plain type outside the picture) with Python and Pillow.

The look for every slot (they cut together, so they must match):
- A deadpan documentary photograph, as if shot by a news photographer: natural light, real textures, real-looking ordinary people (no one famous, no one recognisable), muted true-to-life colour, slight film grain. Not illustration, not 3D, not glossy stock, not cinematic orange-and-teal.
- The joke is played completely straight: nobody mugs for the camera, nobody laughs.
- The subject and the gag read in under a second on a phone: one clear action, centred in the middle 60% of the frame, nothing important in the top 15% or bottom 25% (captions and app buttons sit there).
- NEVER any readable text, words, letters, numbers, logos, brand names, signage or watermarks anywhere in the picture (screens show abstract shapes or blur; paper shows illegible lines). Never a real company's product design.
- No faces of real people. Nobody resembling the narrator.

The slots (the line he says over each, then the picture):
1. b1-hrbox. Line: "Firing your AI is going to be harder than firing your people." Picture: a stern HR manager in a glass-walled meeting room solemnly slides a cardboard box of desk belongings (a small plant, a mug) across the table towards an open laptop; the laptop's screen glows, busy, carrying on regardless. Flat office daylight.
2. b4-satnav-map. Line: "They just shrug and say, well, AI isn't very good, is it?" Picture: inside a modern car, a driver has a huge unfolded paper road map spread over the steering wheel and half the windscreen, crumpled, completely lost, while the car's built-in satnav screen in the dashboard glows with a clear route line on it, ignored. Shot from the passenger seat. This is the main picture of the piece's idea: people refusing the new tool they already have.
3. b5-carpenter. Line: "But that's basically someone blaming their own tools for their work." Picture: a carpenter in a workshop stands beside a wonky wooden shelf that has just collapsed (books and a pot on the floor), holding his hammer up and glaring at it accusingly. Warm workshop light.
4. b8-car-on-trial. Line: "we don't put the car on trial," Picture: a dented hatchback parked inside the wooden dock of an old wood-panelled courtroom, a judge in a wig peering down at it over half-moon glasses, a few jurors watching. Courtroom light.
5. b10-outrun. Line: "AI is the car and you're the driver." Picture: on an open road, a man in office shirt and tie sprints flat out, briefcase swinging, trying to outrun a modern car that is calmly overtaking him; low angle from the roadside, slight motion blur on the road. Deadpan, slightly absurd. (The point: trying to beat the machine instead of getting in and driving it.)
6. b18-cobwebs. Line: "One, waiting to be told what to do, when the AI never waits." Picture: an office worker sits perfectly still at a desk covered in cobwebs and dust, staring at a desk phone, waiting; beside him a monitor shows a long list with every row ticked (ticks only, no readable words). Fluorescent office light.
7. b23-poker. Line: "would I bet my job on this?" Picture: close-up of a green felt poker table in low light, a hand pushing a plain office staff ID badge on a lanyard into the middle of the pot among the chips (the badge's card has no readable text, just a blank photo square and colour bands).

When you finish, reply with the manifest path and one line per slot saying which candidate you think lands the gag best and why. Claude checks every file; your report is not proof.
