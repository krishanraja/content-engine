# The music

Reference for the `produce-video` skill, read at the step that names it (`.agents/skills/produce-video/SKILL.md`). Moved out of the core unchanged on 18 October 2026 so a session starts lean (docs/COST_GUARDS.md).

Krish, 2026-10-12: "I am also going to get some licensed audio to put behind
my videos, so help me prepare to put it somewhere you and codex will always
know where that is, and use it correctly (high volume during the intro, low
whilst I am talking, higher during the outro)." (house rule MUSIC_BED)

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
  for YouTube Content ID, long enough for the piece's long cut (its
  recording as kit.py measured it, plus the most a sting and the end card
  add; 4 minutes only while the long cut's kit is not made) or loopable,
  and its file matches its sha256. Both cuts ask for that same length, so
  they carry the same track. Never browse Drive for audio, and never use a
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
  them by ear: about -16 LUFS over the sting, about -31 under his voice
  (about 17 LU below his -14) and about -18 over the end card; down over
  0.5 seconds as his face comes in, up over 0.8 seconds after his last word;
  a set rise and fall over time, never a compressor keyed to his voice.
  The finished mix is -14 LUFS integrated, plus or minus 1, with true peak
  at most -1 dBTP, measured after the encode. When he approves them,
  `music.py approve-levels --words "his exact words"`, then commit and push.
