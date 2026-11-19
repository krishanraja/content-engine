---
card: ve-w1118-motion-15
format: face-with-proof
motion_style: hud-terminal
kind: plates
model: gpt-6.1-sol
effort: medium
max_minutes: 60
max_calls: 60
cwd: /root/ve-worktrees/content-engine/ve-card/ve-w1118-motion-15
write_allow: [.scratch/w1118/layers15/*]
read: /root/w1118/plates/*
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Wed 18 long cut: nine approved comic stills, each one continuous moving shot

## Goal
Krish, 19 Nov: "It's a boring topic, and you have accompanied it with boring visuals... the visuals need to be 15/10 in terms of captivating." Make nine clips, each ONE continuous shot of its approved still (1920x1080, 10.0 s, 300 frames): no frame swaps, no crossfades, no second picture. The still never changes; the camera moves on every frame and motion is drawn over it in code, deterministic (a seeded generator). Each must feel alive the whole 10 s.

A. bills from /root/w1118/plates/bills.png: slow push 1.00 to 1.08 toward the woman; the paper bill's texture scrolls along the unrolling strip as if still printing, toward the door; the strip's far end wiggles.
B. balloon from /root/w1118/plates/balloon.png: the inflated invoice breathes (a slow 1.5% scale swell and settle on its own region every 2.5 s) and bobs against the ceiling; slow push 1.00 to 1.06.
C. magic from /root/w1118/plates/magic.png: the smoke and sparkle cloud swirls (displacement on its region), about 120 glinting sparkle particles drift up from the laptop and twinkle; slow push 1.00 to 1.07.
D. digging from /root/w1118/plates/digging.png: the brush region sweeps left and right (small 6 px oscillation), fine sand particles puff up from the page with each sweep and drift in the warm light; slow pan right 40 px with a push to 1.05.
E. swap from /root/w1118/plates/swap.png: a smooth lateral camera drift of 60 px left to right with a push to 1.05; small dust motes in the light; the man in the middle gets a gentle 2 px shrug bob every 2 s.
F. juggle from /root/w1118/plates/juggle.png: the wrench, padlock and oil can each travel on their own small arcs (about 30 to 50 px, rotating), looping smoothly, as if juggled; slow push 1.00 to 1.05.
G. teach from /root/w1118/plates/teach.png: the robot's raised arm region waves (a 3 degree rotation oscillation about the shoulder) and its eye glow pulses; slow push toward the robot 1.00 to 1.08.
H. workshop from /root/w1118/plates/workshop.png: gleams sweep across the golden machine (a soft light streak passing every 3 s), steam wisps rise from it; slow push 1.00 to 1.06.
I. ouroboros from /root/w1118/plates/ouroboros.png: lights chase round the cable snake (bright pulses travelling along the ring, clockwise), its eye glows; very slow rotation of the whole frame about the ring's centre (2 degrees over the clip) with a push to 1.05.

## Contract
Write .scratch/w1118/layers15/build.py (Pillow, numpy and ffmpeg only) that renders all nine: 30 fps, h264 yuv420p, no audio, 1920x1080, every frame the still fitted by COVER (assert the size before writing), the camera moving on every frame (never stepped), the motion layer drawn per frame from the frame number. Outputs: .scratch/w1118/layers15/<name>.mp4 for bills, balloon, magic, digging, swap, juggle, teach, workshop and ouroboros (300 frames each), and contact.png (frames 0, 100, 200 and 299 of each). Never any word, letter, number, logo or watermark; never a new person or object; never edit anything outside .scratch/w1118/layers15/. Never publish or send.

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
python3 .scratch/w1118/layers15/build.py
python3 -c "import subprocess,sys; [sys.exit('bad '+c) for c in ['bills', 'balloon', 'magic', 'digging', 'swap', 'juggle', 'teach', 'workshop', 'ouroboros'] if subprocess.run(['ffprobe','-v','error','-select_streams','v:0','-count_frames','-show_entries','stream=width,height,nb_read_frames','-of','csv=p=0','.scratch/w1118/layers15/'+c+'.mp4'],capture_output=True,text=True).stdout.strip()!='1920,1080,300']; print('ok')"

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-w1118-motion-15", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
