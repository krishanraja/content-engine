import sys, shutil, pathlib
from PIL import Image, ImageDraw, ImageFont
R = pathlib.Path(sys.argv[1]); P = pathlib.Path(sys.argv[2]); out = P / "finalframes"
if out.exists(): shutil.rmtree(out)
out.mkdir()
k = 0
def put(src):
    global k
    shutil.copy(src, out / f"f{k:05d}.png"); k += 1
for i in range(0, 1260): put(P / "cutframes" / f"f{i:05d}.png")       # the cut to 42.0 s
for n in range(1, 49): put(R / "sf" / f"s{n:03d}.png")                  # the sting, to its settled band
# the badge: "FOLLOW FOR MORE" under the wordmark band, at the band's tilt, in the band's ink
font = ImageFont.truetype("/home/user/content-engine/assets/fonts/makeyourmindup/Anton-Regular.ttf", 96)
text = "FOLLOW FOR MORE"
d0 = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
tw = d0.textlength(text, font=font); pad_x, h = 56, 150
badge = Image.new("RGBA", (int(tw) + 2 * pad_x, h), (0, 0, 0, 0))
d = ImageDraw.Draw(badge)
d.rounded_rectangle((0, 0, badge.width - 1, h - 1), radius=26, fill=(12, 21, 18, 255))
d.text((pad_x, 14), text, font=font, fill=(244, 239, 228, 255))
badge = badge.rotate(3.2, resample=Image.BICUBIC, expand=True)
base = Image.open(R / "sf" / "s048.png").convert("RGBA")
cx, top = 540, 1150
def ease(x):
    x = max(0.0, min(1.0, x)); c = 1.7
    return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2
for j in range(72):                                                      # 2.4 s hold
    p = ease(j / 7.5)
    s = max(0.01, 0.6 + 0.4 * p)
    b = badge.resize((max(1, int(badge.width * s)), max(1, int(badge.height * s))), Image.LANCZOS)
    if p < 1:
        alpha = b.getchannel("A").point(lambda a: int(a * min(1, p * 1.6)))
        b.putalpha(alpha)
    f = base.copy()
    f.alpha_composite(b, (int(cx - b.width / 2), int(top + (1 - min(p, 1)) * 40)))
    f.convert("RGB").save(out / f"f{k:05d}.png"); k += 1
print("frames", k, "seconds", k / 30)
