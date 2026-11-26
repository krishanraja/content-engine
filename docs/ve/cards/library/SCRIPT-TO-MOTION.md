# Script to motion: the picture says what the words say (26 Nov 2026)

Krish, 26 Nov 2026: "I do want to make sure that the animations fit the script. Whilst it's good to have four stable templates where reliable, I want the content engine within the session to depict what's actually being said, as opposed to only following motion templates to a story. Captions need to be much improved but can stay templated."

## The rule
**The templates are the vocabulary; the session writes the sentence.** The Library gives a production session a fixed set of stable, premium building blocks (frames, devices, captions, the title card and the outro). The session decides, beat by beat, which block shows what is being said at that moment and lands each move on the spoken word that names it. Nothing on screen moves for decoration, and nothing on screen contradicts or runs ahead of the voice.

## The devices and the words that drive them
| Device (`element`) | What it shows | Driven by | Lands on |
|---|---|---|---|
| `meter` (`played`) | A play meter, one bar a second, lighting up to a point | a spoken duration or threshold ("thirty seconds", "after ten seconds") | the number word; the 30th bar is mint when the threshold is the answer |
| `timeline` (`cut`) | A long bar cut down to a short one | a spoken change between two amounts ("from twenty seconds to five") | the second amount; the cut runs from the first amount's word to the second's |
| `striped` (`reveal`) | The key number built in coral, butter, lilac then mint | the number when it is the headline of the beat | the number word, fully built by its last syllable |
| `evidence` (`mark`) | The real source sentence, with the mint mark drawn across the words that matter | the voice reading or paraphrasing the source | the mark draws across the words as they are said |
| `type` | A headline or question | the voice asking it | the first word of the question |
| logos and verdict chips | A named company and what it did | the company's name | the name, then the chip on the verb ("Suno pays") |

New devices are added to the Library first, with their own stable motion, before a session may use them. A session never invents a one-off animation inside a cut.

## How a session writes the beats
1. Align the voice to words (the caption pass already gives each word an onset in frames).
2. Read the script for its visual moments: every number, change, comparison, named company, source and question.
3. For each moment, choose the one device from the table that shows it, on the frame the story is on, and write a beat on that shot:
   `{"element": "meter", "property": "played", "from": 0, "to": 30, "word": "30", "lead": 3, "duration": 12}`
   `word` names the caption word (and `occurrence` if it repeats). The move starts `lead` frames before the word's onset and lasts `duration` frames on the house ease. The renderer turns each beat into a track on that shot.
4. Check the beats against `MOTION-FLOOR.md`: one primary move at a time, entrances of 4 to 10 frames on vertical and 7 to 12 on long-form, a readable hold after every move, nothing on a word that is not spoken, no bounce, no flash.
5. Render, watch it at full size with sound, and fix any beat that lands late, early or on the wrong word.

## Profiles
- **Vertical:** one visual point per spoken claim, landing on the word, changing at least every 3 seconds; devices big and centred in the safe zone.
- **Long-form (5 minutes plus):** real-world and premium. Fewer, slower moves (7 to 12 frames, half the travel), longer holds, real footage and real documents carrying most beats, and devices used for the key numbers only.

## Captions (templated: one look, four motion styles)
Captions follow the house template and never vary in look per piece. Everything below is fixed:
- **The look:** Anton, segments of 3 to 5 words, at most 2 lines.
- **On ink or pictures:** cream words with an ink keyline, the spoken word in mint.
- **On colour fields:** ink words, with the spoken word in cream on an ink chip.
- **No gradient band.**
- **Placement:** pinned to the caption band (bottom edge at y 1320 on 9:16). Captions are empty while the title card holds, never sit over his face, and are absent from any frame whose headline is the line being said.

The session picks a motion style per cue (`"style"` on the caption cue) within these rules:

| Style | Motion | Use it for | Rule |
|---|---|---|---|
| `punch` | one or two words at a time, 1.5 times the size, each landing in 3 frames | the opening hook | only in the first 5 seconds of a cut |
| `build` | each word rises 30% of its height into place over 4 frames as it is said; the line is laid out whole, so words never jump | vertical body (the default on 9:16) | not on colour fields |
| `line` | the whole line settles up over 6 frames when it starts; the spoken word is lit | long-form (the default on 16:9) | none |
| `chip` | the line holds still; an ink chip moves word to word with the voice | colour fields (the automatic choice there) | none |

One style per cue, never mixed inside a line. `motion_check.py` refuses a punch cue after 5 seconds and any unknown style.
