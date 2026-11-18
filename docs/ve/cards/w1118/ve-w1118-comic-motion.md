---
card: ve-w1118-comic-motion
format: face-with-proof
motion_style: hud-terminal
kind: plates
model: gpt-6.1-sol
effort: medium
max_minutes: 45
max_calls: 50
cwd: /root/ve-worktrees/content-engine/ve-card/ve-w1118-comic-motion
write_allow: [.scratch/w1118/motion/*]
read: /root/w1118/plates/*
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Wed 18 build-or-buy: turn two approved stills into moving clips

## Goal
Krish, 18 Nov, of the short's hook: "The crocodile scene just keeps pulsing as a still. Surely that's going to be turned into a moving video with Codex, right?" and "just use codex for asset generation". Make each approved still move, with your image generation tool (image_gen) and code only: no video model.

A. croc-hook (9.0 s): the approved still /root/w1118/plates/croc-creep-tall.png (1024x1536): a nerdy developer in a lanyard and khaki shirt creeping toward a crocodile asleep under the office desk. Make 6 more frames as edits of that still (pass it as the reference every time; same camera, lens, light, framing, people and objects): 2 his front hand a few centimetres further forward; 3 he lowers himself, a little closer; 4 the crocodile's tail shifts slightly; 5 he freezes mid-reach, eyes wide; 6 the crocodile's near eye is open, looking straight at him; 7 he is frozen, eye to eye with it. Build the clip in that order: frames 1 to 6 about 1.1 s each, frame 7 held to the end.
B. confetti (5.5 s): the approved still /root/w1118/plates/confetti-tall.png: a beaming executive pulls a big red lever at an all-hands. Make 4 more frames as edits of it: 2 the lever slammed down, confetti bursting; 3 confetti thick in the air; 4 the big screen behind shows a plain empty sign-in box (no words); 5 the applause dying, two staff glancing at each other. About 1.1 s each.

## Contract
Write a small Python script, .scratch/w1118/motion/build.py (Pillow, numpy and ffmpeg only), that builds each clip from its frames: 1080x1920 at 30 fps, h264 yuv420p, no audio; every frame fitted by COVER (scale to the larger ratio, crop the centre; assert the size before writing); each change is a 6-frame crossfade; one continuous slow push across the whole clip, scale 1.00 to 1.06 about the centre, never below cover. Outputs: .scratch/w1118/motion/croc-hook.mp4 (270 frames) and confetti.mp4 (165 frames), every keyframe as .scratch/w1118/motion/<clip>-<n>.png, a contact sheet contact.png, and motion.json: for each clip its frames, each frame's exact prompt, the reference used, the tool ("codex:image_gen") and the generation id. Never any readable word, letter, number, logo or watermark in a frame; never a real person's likeness; keep the frames consistent with the approved still (a frame that changes the people, the room or the camera is regenerated, never kept). Never edit anything outside .scratch/w1118/motion/. Never publish or send.

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
python3 .scratch/w1118/motion/build.py
python3 -c "import json,subprocess,sys; m=json.load(open('.scratch/w1118/motion/motion.json')); [sys.exit('bad '+c) for c,n in (('croc-hook',270),('confetti',165)) if subprocess.run(['ffprobe','-v','error','-select_streams','v:0','-count_frames','-show_entries','stream=width,height,nb_read_frames','-of','csv=p=0','.scratch/w1118/motion/'+c+'.mp4'],capture_output=True,text=True).stdout.strip()!=f'1080,1920,{n}']; print('ok')"

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-w1118-comic-motion", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
