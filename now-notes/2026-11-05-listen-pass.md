Status: ve now has a listen pass, built and tested on synthetic sound and clocks, not yet run on his take. `ve hear`
picks up the hesitations, broken words and stutters the transcript leaves out, and conform cuts them like any other
flub. Every join must now sit where the sound is quiet, so no cut lands on a sound nobody wrote down. Conform also
prefers the reading that sounded right. His lexicon (`config/voice/lexicon.json`, seeded from quick-edit's fixes)
learns names, mishearings, hesitations and the words he adds. `ve voice profile` measures his voice for a later clone
check. Krish, 2026-11-05: "Yes, build it - kind of like Wispr Flow, it should also learn me as well as the common
words that I say" and "Just make this engine as high quality as possible."
Next: on a home computer, run `ve hear --ctc --whisper large-v3` on Thursday 5 Nov's take, then put the fumble list
and joins reel to Krish to mark by ear, and set `config/gates.json` `listen` from his marks.
- North Star check (2026-11-05): holds.
