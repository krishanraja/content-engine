Status: A production or Publish session on a piece with no schedule date of its own (an off-day meme or carousel the board placed) could not report to the board: every report was refused as piece_not_scheduled, so the card never moved and the Publish prompt looped. Every board prompt now names the week and day beside the piece id, which the report call needs.
Next: Krish presses Publish again on the Cat counting cash meme (Thu 19) once this is live; the session picks the channels, time and captions from Growth's rules. A Publish press that schedules with no session at all waits on his ruling about who may call Buffer.
Also: the Publish prompt now carries Growth's channels and four daily slots (vendored mix.json, pinned), tells the session to write each channel's caption in Growth's voices, and gives Buffer Drive download addresses; it no longer lets a session stop for a missing channel, time, caption or public link.
Also: the board keeps a live-check verdict on each sent post (Control Center's sweep checks it as Buffer holds it) and says on the card what went out wrong; a test pins that a scheduled or live post keeps listing every file.
Changed: _growthPlacement.ts, vendor/makeyourmindup/mix.json, apps/control-plane/api/board/_writeBack.ts, tests/control-plane/board-sessions.test.ts, regenerated week and view fixtures.

North Star check (2026-11-19): holds.
