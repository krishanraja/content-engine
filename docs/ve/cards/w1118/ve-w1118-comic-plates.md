---
card: ve-w1118-comic-plates
format: face-with-proof
motion_style: hud-terminal
kind: plates
model: gpt-6.1-sol
effort: medium
max_minutes: 40
max_calls: 40
cwd: /root/ve-worktrees/content-engine/ve-card/ve-w1118-comic-plates
write_allow: [.scratch/w1118/plates/*]
read: config/ve/brand-tokens.json, config/brand-palette.json
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Wed 18 build-or-buy: the comic stills for seven named slots

## Goal
Wed 18 Nov (under.the.hood, piece db9f9f6a): "Build or buy your tools in an AI world?" Krish, 17 Nov: "This piece needs to be hilarious and tongue-in-cheek" and "use codex for all asset production, generation, sourcing". He calls the over-confident in-house engineer "the Crocodile Hunter". Generate each still below with your image generation tool (image_gen), stills only, no video. The ve device scene_plate places them full bleed with a slow push; nothing is drawn over them.

One character across slots 1, 2, 3 and 7: a nerdy office software developer, about 35, glasses, a company lanyard, a khaki bush shirt with rolled sleeves over office trousers. Make slot 1 first, then pass it as the reference image for 2, 3 and 7 so he is the same man.

1. croc-creep-tall (portrait 1024x1536) and 2. croc-creep-wide (landscape 1536x1024): he creeps, crouched low, between open-plan desks toward a large saltwater crocodile asleep under the office coffee machine; documentary wildlife photo, telephoto, natural office light, deadly serious.
3. croc-wrestle-wide (1536x1024): the same man wrestling the crocodile on the floor of a server room, lanyard flying, cables everywhere, blue rack lights; action documentary photo.
4. confetti-tall (1024x1536): a corporate all-hands; a beaming executive at a podium pulls a huge red lever, confetti falls, staff mid-applause, a big blank bright screen behind; documentary event photo.
5. puppy-receipt-wide (1536x1024): a small puppy sitting on a pet shop counter while a till receipt prints endlessly and piles up around it on the floor; warm documentary photo.
6. two-am-wide (1536x1024): a dark bedroom at night, a smartphone lighting up and buzzing on a bedside table beside a digital clock, a sleeping figure under the duvet; cinematic photo.
7. gecko-wide (1536x1024): the same developer, beaming with pride, holding up a tiny gecko in an open-plan office, two colleagues glancing over unimpressed; documentary photo.

Two candidates per slot (a and b). Photographic, believable, played straight: the joke is the situation, never a cartoon, never a caricature.

## Contract
Write each still to .scratch/w1118/plates/<slot>-<a|b>.png at the size named. Then write .scratch/w1118/plates/plates.json: a list of {slot, file, width, height, prompt (the exact prompt you sent), tool ("codex:image_gen"), generation_id (whatever id the tool returns, else the turn's own id), reference (the file used as reference, or null)}.

Never: any readable word, letter, number, logo, brand mark or watermark anywhere in a picture (the clock in slot 6 may show 2:00 only); a real person's likeness; Krish; text overlays; frames, borders or captions. Never edit any file outside .scratch/w1118/plates/. Never publish, post or send anything.

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
python3 -c "import json,sys,os; from PIL import Image; P='.scratch/w1118/plates/'; rows=json.load(open(P+'plates.json')); need={'croc-creep-tall':(1024,1536),'croc-creep-wide':(1536,1024),'croc-wrestle-wide':(1536,1024),'confetti-tall':(1024,1536),'puppy-receipt-wide':(1536,1024),'two-am-wide':(1536,1024),'gecko-wide':(1536,1024)}; got={(r['slot'],r['file']) for r in rows}; [sys.exit('missing '+s+v) for s in need for v in 'ab' if not os.path.exists(P+s+'-'+v+'.png')]; [sys.exit('size '+r['file']) for r in rows if Image.open(P+os.path.basename(r['file'])).size!=need[r['slot']]]; print('ok', len(rows))"

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-w1118-comic-plates", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
