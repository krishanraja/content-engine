ve card habits-b22-1 for 2026-11-17-tue-habits (plates): the screen for "read every line before you hit send"

Krish asked for this beat to be made by Codex (18 Nov 2026: "get codex to generate it"). Make a real screen recording of a code-built email draft being read line by line, the cursor ending over Send and not clicking. Work only in .scratch/ve/habits/capture/. Never publish, upload or send anything; never commit. Network is not needed.

The line he says over it: "So, tomorrow, read every line before you hit send, and ask," (3.2 s on the cut; he says "send" at 2.05 s in).

Build it:
1. One self-contained HTML page (.scratch/ve/habits/capture/b22.html): a plain, believable, light-mode email compose window filling a 1080x1920 portrait screen, no product's logo, name or look (no Gmail, Outlook or Apple Mail styling or marks; a neutral, well-made generic composer). Header rows To: "Leadership team", Subject: "Q3 numbers (draft)". The body is a short, realistic AI-drafted work email of 10 to 12 lines (a quarterly update: revenue line, a customer line, a hiring line, a next-steps line), in a clean system-UI-free font loaded from the repository's own font files (fonts named in config/ve/brand-tokens.json; use Archivo for the UI and body). Body text at least 40 px so it reads on a phone. One line in the middle (the revenue line) states a number that looks wrong on purpose ("Revenue grew 40% this quarter") so reading line by line means something. No person's real name anywhere; sign-off "Thanks," and no name. A Send button, filled, bottom right, inside the rectangle x 0.55 to 0.95, y 0.80 to 0.95 of the frame.
2. Record it with Playwright (installed: `require('playwright')` or Python `playwright`; chromium.launch() needs no options) at viewport 1080x1920, deviceScaleFactor 1, recordVideo, then convert to H.264 mp4 30 fps with ffmpeg: .scratch/ve/habits/capture/b22-screen.mp4, exactly 1080x1920, 4.5 s long, no audio.
3. The motion, on that 4.5 s clock: a soft highlight band (a pale tint of the brand mint, low opacity) moves down the body one line at a time from 0.2 s to 2.0 s, the page scrolling a little as it goes, as if someone is reading each line; a normal arrow mouse cursor follows the band at the left of each line; at 2.0 s the cursor glides to the Send button and stops over it by 2.4 s; the button shows its hover state; it is NEVER clicked (no pressed state, no sent message) and the cursor stays there, still, to the end. Smooth easing, no jumps, no frame drops.

Acceptance (run all; all must pass):
ffprobe -v error -show_entries stream=width,height,r_frame_rate,codec_name -of csv=p=0 .scratch/ve/habits/capture/b22-screen.mp4   (1080,1920, 30/1, h264)
ffprobe -v error -show_entries format=duration -of csv=p=0 .scratch/ve/habits/capture/b22-screen.mp4   (4.4 to 4.6)
Write .scratch/ve/habits/capture/contact.jpg: 8 frames across the clip (0.0, 0.6, 1.2, 1.8, 2.2, 2.6, 3.4, 4.4 s), labelled with their times outside the pictures.

Reply with the files and the acceptance output. Claude checks every frame; your report is not proof.
