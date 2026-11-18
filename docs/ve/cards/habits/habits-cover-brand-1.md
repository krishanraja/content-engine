ve card habits-cover-brand-1 for 2026-11-17-tue-habits (cover): the face-free brand cover, made interesting

Krish, 18 Nov 2026, on the Receipt options (IBM's web page under the headline): "the visual for the cover needs to be way more interesting than a screen shot of a website". This cover is for the brand accounts (Instagram, Facebook, Substack; face-free, no Krish). Draw three options, tall 1080x1920 and wide 1280x720 each, under .scratch/ve/habits/covers/brand/ (a script, draw.py, there; option-a-tall.png, option-a-wide.png and so on).

Each option is one of the cut's own generated stills, full bleed, as the picture that stops the thumb:
- a: .scratch/ve/habits/assets/gen/b8-car-on-trial.png (a crashed car in the dock, a judge and jury: blaming the machine)
- b: .scratch/ve/habits/assets/gen/b11-boss.png (a manager overruling an AI report with a red pen)
- c: .scratch/ve/habits/assets/gen/b10-outrun.png (a man trying to outrun a car)
Crop each so its subject reads at a glance in the Instagram grid's middle 3:4 (y 240 to 1680 on the tall), never stretched; you may scale and reposition, never repaint the picture.

On it, the headline Krish picked, exactly "71% of HR chiefs want AI overruled" (7 words, never more), in the house Receipt style: the cream slabs and ink type of scripts/pages/receipt.py (the same fonts, the accent mark on the key words), legible over the picture, with the official wordmark from src/assets/brand/makeyourmindup (as the Receipt draws it). Credit the number small and plainly: "IBM CHRO study, Sep 2026" in IBM Plex Mono. No other words, no badges, no stickers, no logos but the wordmark.

Every word on the tall file clear of every cover_tall zone: inside x 72 to 880 and y 270 to 1320. The wide file keeps YouTube's length badge corner (x 968+, y 548+) clear. Brand colours only from config/brand-palette.json and config/ve/brand-tokens.json.

Acceptance (all must pass, for a, b and c):
python3 .scratch/ve/habits/covers/brand/draw.py
python3 scripts/channel_safe.py .scratch/ve/habits/covers/brand/option-a-tall.png --shape cover_tall   (and b, c)
python3 -c "from PIL import Image; import sys; [sys.exit(1) for o in 'abc' if Image.open(f'.scratch/ve/habits/covers/brand/option-{o}-tall.png').size!=(1080,1920) or Image.open(f'.scratch/ve/habits/covers/brand/option-{o}-wide.png').size!=(1280,720)]"

Never draw Krish or his name; never publish, upload or commit. Reply with the six paths, their sha256s, the acceptance output and a contact sheet (.scratch/ve/habits/covers/brand/contact.png).
