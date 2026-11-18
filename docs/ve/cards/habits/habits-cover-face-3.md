ve card habits-cover-face-3 for 2026-11-17-tue-habits (cover): option 1, with the headshot Krish chose

Krish, 18 Nov 2026, choosing the face-led cover: "use this headshot instead" (his Drive file headshot-1.png, now at .scratch/covers-habits/photos/headshot-1.png in this worktree: an 880x1168 RGB studio photo of him on a dark grey backdrop, no alpha). Draw one new option, option 4, in exactly option 1's layout (.scratch/covers-habits/draw.py, option 1: the same headline "71% of HR chiefs want AI overruled", the same official wordmark under it, the same IBM first-paragraph proof card in the same place), with this photo in place of the shoulders cutout. Leave options 1 to 3 and their files exactly as they are.

1. The photo has a backdrop, so make a clean cutout first: separate him from the grey backdrop with a person segmentation model (pip install rembg, model u2net_human_seg, or equivalent), keep every pixel of him exactly as photographed (no retouch, recolour, relight, sharpen or smoothing; only the backdrop becomes transparent), a clean natural edge on hair and shoulders with no grey halo. Save it as .scratch/covers-habits/photos/headshot-1-cutout.png.
2. Place it as option 1 places its cutout: his shoulders sit on the canvas bottom and run off it, so no edge of the photo shows on the colour; his face about a third of the frame; nothing of the proof card behind his head or over his face; his face, eyes, nose and mouth inside the middle 3:4 grid crop (y 240 to 1680).
3. Write .scratch/covers-habits/out/option-4-tall.png (1080x1920).

Acceptance (all must pass):
python3 .scratch/covers-habits/draw.py
python3 -c "import hashlib,sys; sys.exit(hashlib.sha256(open('.scratch/covers-habits/out/option-1-tall.png','rb').read()).hexdigest()!='0fd979cbefe5bdfd85b216b9b01badcd3988997080d800907ac6aef0e649d4e4')"
python3 -c "from PIL import Image; import sys; sys.exit(Image.open('.scratch/covers-habits/out/option-4-tall.png').size!=(1080,1920))"
python3 scripts/channel_safe.py .scratch/covers-habits/out/option-4-tall.png --shape cover_tall

Never draw his name; never publish, upload or commit. Reply with option 4's path and sha256 and the acceptance output.
