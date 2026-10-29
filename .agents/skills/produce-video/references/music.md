# The music

Reference for the `produce-video` skill, read at the step that names it (`.agents/skills/produce-video/SKILL.md`). Moved out of the core unchanged on 18 October 2026 so a session starts lean (docs/COST_GUARDS.md).

Krish, 2026-10-12: "I am also going to get some licensed audio to put behind
my videos, so help me prepare to put it somewhere you and codex will always
know where that is, and use it correctly (high volume during the intro, low
whilst I am talking, higher during the outro)." (house rule MUSIC_BED)
Then, 2026-10-28: "Yes I think music should be audible throughout but just
lower." The bed runs under the whole of every cut, wide or tall, low under
his voice, and never drops out.

- **Where it lives.** Drive, `makeyourmindup > 00_Brand-Assets > 07_Music`:
  on the home computers
  `H:\My Drive\Ventures\Active Ventures\makeyourmindup\00_Brand-Assets\07_Music`,
  read from `MINDMAKE_MUSIC_ROOT`, else `runtime.music_root` in
  `config/studio.json`. Each licence certificate sits beside its track, in
  the same folder. Audio is never committed, and never goes in the Inbox
  (the lane would send it as a recording).
- **The ledger** is `config/music-library.json`, committed. A track is used
  only when it is in the ledger, approved by Krish in his words, its licence
  in date and covering every place either cut of the piece goes (wide:
  YouTube and Substack; tall: Shorts, Reels, TikTok and LinkedIn), cleared
  for YouTube Content ID, and its file matches its sha256. Both cuts ask
  for the long cut's length (its recording as kit.py measured it, plus the
  most the end card adds; `PIECE_SECONDS` only while the long cut's kit is
  not made), so they carry the same track: the first in the piece's
  rotation that plays that long straight (or loops), else the first that
  runs a minute or more, started again from its intro cue under a
  two-second crossfade as often as the cut needs, on a picture turn where
  one is near. So a cut never goes out voice only for want of a long
  enough track. Never browse Drive for audio, and never use a
  file because it is in the folder. `python scripts/quick-edit/music.py
  list` and `music.py check` show where things stand; `music.py pick --piece
  PIECE_ID --both-cuts --seconds LONG_CUT` shows the one track both cuts get
  and why the others were passed over.
- **How a track gets in.** Krish licenses it, saves the audio and its
  certificate side by side in the music folder, and says so. On a home
  computer:

  ```
  python scripts/quick-edit/music.py add "MUSIC FOLDER\TRACK.wav" --provider NAME --licence-id ID --licence-file "MUSIC FOLDER\TRACK CERTIFICATE.pdf" --title .. --artist .. --platforms youtube,substack,shorts,tiktok,reels,linkedin --content-id-cleared yes --acquired-on YYYY-MM-DD [--expires-on ..] [--intro-cue S] [--outro-cue S] [--loopable]
  ```

  It measures the file and writes it as `proposed`; a track already listed
  by its file name (NO CURVES, today) is completed in place. Let him hear
  it under a cut; only when he approves it in words, `music.py approve
  TRACK_ID --words "his exact words"`. Commit and push the ledger (pull
  first), so both machines and every session read the same one.
- **The levels**, in the ledger's `levels`, proposed until Krish approves
  them by ear: about -16 LUFS over an opening clip (none by default: the
  cut opens on his first words), about -31 under his voice
  (about 17 LU below his -14) and about -18 over the end card; down over
  0.5 seconds as his face comes in, up over 0.8 seconds after his last word;
  a set rise and fall over time, never a compressor keyed to his voice.
  The finished mix is -14 LUFS integrated, plus or minus 1, with true peak
  at most -1 dBTP, measured after the encode. When he approves them,
  `music.py approve-levels --words "his exact words"`, then commit and push.
