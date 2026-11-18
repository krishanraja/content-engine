---
card: ve-w1118-motion-layers
format: face-with-proof
motion_style: hud-terminal
kind: plates
model: gpt-6.1-sol
effort: medium
max_minutes: 40
max_calls: 40
cwd: /root/ve-worktrees/content-engine/ve-card/ve-w1118-motion-layers
write_allow: [.scratch/w1118/layers/*]
read: /root/w1118/plates/*
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Wed 18 build-or-buy: one continuous move and a motion layer over three approved stills

## Goal
Krish, 18 Nov: "I do not want any stop start scenes" and "Maybe stills with more motion over them." Make three clips, each ONE continuous shot of its approved still: no frame swaps, no crossfades, no second picture. The still never changes; motion is drawn over it in code, deterministic (a seeded generator, the same output every run).

A. confetti (1080x1920, 6.0 s) from /root/w1118/plates/confetti-tall.png (1024x1536): a slow push 1.00 to 1.07 about the executive and the lever; over it, about 140 confetti pieces (small rectangles in red, yellow, blue, green and white, each with its own fall speed, sway and tumbling rotation, slight motion blur) falling from above the frame through the whole clip, a few passing in front of the people.
B. two-am (1920x1080, 6.0 s) from /root/w1118/plates/two-am-wide.png (1536x1024): a very slow push 1.00 to 1.04; the phone on the bedside table buzzes twice (short 3 px jitters of the phone region at about 1.0 s and 3.5 s) and its screen glow brightens and dims softly, with its light spill on the table rising with it. Find the phone's screen and box by its brightness; nothing else moves.
C. puppy (1920x1080, 6.0 s) from /root/w1118/plates/puppy-receipt-wide.png (1536x1024): a slow push 1.00 to 1.06 toward the puppy; the receipt strip falling from the till scrolls down continuously (its paper texture moving down the strip as if still printing), seamless, the pile below unchanged.

## Contract
Write .scratch/w1118/layers/build.py (Pillow, numpy and ffmpeg only) that renders all three: 30 fps, h264 yuv420p, no audio, every frame the still fitted by COVER (assert the size before writing), the camera moving on every frame (never stepped), the motion layer drawn per frame from the frame number. Outputs: .scratch/w1118/layers/confetti.mp4 (180 frames), two-am.mp4 (180), puppy.mp4 (180), and contact.png (frames 0, 60, 120 and 179 of each). Never any word, letter, number, logo or watermark; never a new person or object; never edit anything outside .scratch/w1118/layers/. Never publish or send.

## Motion style: HUD and terminal (hud-terminal, untested)
Monospace text, lock-on brackets and rolling numbers, for pieces about what software or models actually do.
Build to these rules; brand roles (config/ve/brand-tokens.json) and the design lock win where they differ.
- IBM Plex Mono only, on ink; mint for the result line, cream for everything else
- text types at a readable 25 to 40 characters a second, never a blur
- brackets lock onto the one value that matters with the slap token
- rolling numbers settle on the real figure and hold
Never:
- green-on-black hacker clichés
- glitch and scan noise over the proof
- walls of fake code

## Acceptance (every command must exit 0 inside your sandbox)
python3 .scratch/w1118/layers/build.py
python3 -c "import subprocess,sys; [sys.exit('bad '+c) for c,s in (('confetti','1080,1920'),('two-am','1920,1080'),('puppy','1920,1080')) if subprocess.run(['ffprobe','-v','error','-select_streams','v:0','-count_frames','-show_entries','stream=width,height,nb_read_frames','-of','csv=p=0','.scratch/w1118/layers/'+c+'.mp4'],capture_output=True,text=True).stdout.strip()!=s+',180']; print('ok')"

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-w1118-motion-layers", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
