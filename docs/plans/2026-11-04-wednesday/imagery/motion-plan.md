# Wednesday 4 November, Claude Duet: the motion plan

Krish, 2026-10-31: "I want way more animation than ever before and movement."

Every beat's `motion` in `../creative-direction.json` now follows these rules (`raise_motion.py` wrote them; words,
points, pictures and sources are unchanged):

1. **Nothing holds still for more than about 1.5 seconds.** The one exception is the close card, which holds long
   enough to read (one close).
2. **His face is never a locked shot.** A slow push across the beat (1.00 to 1.06), a punch-in to a tighter frame on
   the word he stresses, a reframe about every 3 seconds. The captions land word by word.
3. **His phone screen is always video, in his hand.** The 29 October recording plays inside the approved hand-held
   plate (`phone/`, `demo-first-message.mp4`), time-lapsed where the moment is longer than the beat. The hand drifts
   and tilts a few degrees and the desk behind moves slower (parallax). The ink bars ride with the screen.
4. **Pages move.** Each real page slides in, then pushes and drifts towards its line while the mint mark sweeps across
   the words as he says them (`pages/`).
5. **The queue desk never stops.** The rail ticks past, work orders sway on their clips, the camera pushes and drifts.
   Work orders slide in on their verbs and stop at the lilac line; the mint YES stamps in five frames on "yes" and the
   order crosses the line (`motion-test-queue.mp4`).
6. **Numbers roll.** 36 rolls up digit by digit on "a day and a half"; 6,000+ rolls on "whatever else".
7. **Each change lands on its word,** with the brand's curves (enter 400 ms, cubic-bezier 0.05, 0.7, 0.1, 1.0; exit
   200 ms, cubic-bezier 0.3, 0, 0.8, 0.15; config/ve/brand-tokens.json).

What it still never does: motion on no cue, loops that restart, icons acting out an idea, a second opening or close.
