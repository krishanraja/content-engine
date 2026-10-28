"""Derives the plates for the HAND-HELD SCREEN format from ../plates (never edits them).
 - assets/phone-bezel.png : hand + phone body, glass cut out (transparent) so a UI layer shows through, 2x
 - assets/phone-glass.png : glass sheen overlay, same cut, 2x
 - assets/bg-cotton.jpg / bg-hardware.jpg : plates graded toward ink (darker than ink, so the photo lightens into the page)
 - assets/quad.json : the four glass corners in plate pixels (BL sits just outside the plate)
Run:  python build_plates.py
"""
import json, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
PL = os.path.join(HERE, '..', 'plates')
AS = os.path.join(HERE, 'assets')
os.makedirs(AS, exist_ok=True)

im = Image.open(os.path.join(PL, 'phone.png')).convert('RGBA')
a = np.array(im).astype(np.float32)
lum = 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]
alpha = a[..., 3]
# clean stray low-alpha haze
a[..., 3] = np.where(alpha < 24, 0, alpha)
alpha = a[..., 3]

# 1. glass region = light pixels connected to a seed inside the screen
cand = ((lum > 95) & (alpha > 200)).astype(np.uint8) * 255
m = Image.fromarray(cand, 'L').copy()
ImageDraw.floodfill(m, (300, 720), 128, thresh=0)
reg = Image.fromarray(((np.array(m) == 128) * 255).astype(np.uint8), 'L')
reg = reg.filter(ImageFilter.MaxFilter(15)).filter(ImageFilter.MinFilter(15))   # close the UI-text holes
# fill enclosed islands (counters of the old 'DeepSeek' letters): background floods in from the corner, the rest is glass
inv = Image.fromarray(((np.array(reg) < 128) * 255).astype(np.uint8), 'L').copy()
ImageDraw.floodfill(inv, (940, 1671), 128, thresh=0)
reg = Image.fromarray(((np.array(inv) != 128) * 255).astype(np.uint8), 'L')
reg_np = np.array(reg) > 127

# 2. glass quad from fitted edge lines (BL corner is just outside the plate)
def fit(points):
    pts = np.array(points, float); c = pts.mean(0); _, _, vt = np.linalg.svd(pts - c); return c, vt[0]
top = [(x, np.nonzero(reg_np[:, x])[0].min()) for x in range(494, 540, 2)]   # right of the notch only
right = [(np.nonzero(reg_np[y, :])[0].max(), y) for y in range(230, 640, 4)]
bottom = [(x, np.nonzero(reg_np[:, x])[0].max()) for x in range(130, 290, 4)]
left = [(np.nonzero(reg_np[y, :])[0].min(), y) for y in range(200, 560, 4)]
L = {'top': fit(top), 'right': fit(right), 'bottom': fit(bottom), 'left': fit(left)}
def inter(l1, l2):
    (p1, d1), (p2, d2) = l1, l2
    t = np.linalg.solve(np.array([d1, -d2]).T, p2 - p1); return p1 + t[0] * d1
quad = [inter(L['top'], L['left']), inter(L['top'], L['right']), inter(L['bottom'], L['right']), inter(L['bottom'], L['left'])]
json.dump([[float(p[0]), float(p[1])] for p in quad], open(os.path.join(AS, 'quad.json'), 'w'))

# 3. bezel: cut the glass (dilated 3px so no cream fringe survives), feathered
hole = reg.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(0.9))
hole_np = np.array(hole).astype(np.float32) / 255.0
bez = a.copy()
bez[..., 3] = bez[..., 3] * (1.0 - hole_np)
bez_im = Image.fromarray(bez.clip(0, 255).astype(np.uint8), 'RGBA')
W2, H2 = im.size[0] * 2, im.size[1] * 2
bez_im = bez_im.resize((W2, H2), Image.LANCZOS)
rgb = bez_im.convert('RGB').filter(ImageFilter.UnsharpMask(radius=2.2, percent=70, threshold=2))
bez_im = Image.merge('RGBA', (*rgb.split(), bez_im.split()[3]))
bez_im.save(os.path.join(AS, 'phone-bezel.png'), optimize=True)

# 4. glass sheen: soft diagonal reflections clipped to the (slightly eroded) glass
core = reg.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(1.2))
core_np = np.array(core).astype(np.float32) / 255.0
yy, xx = np.mgrid[0:im.size[1], 0:im.size[0]].astype(np.float32)
# diagonal coordinate across the glass
d = (xx * 0.72 + yy * 0.69)
def band(c, w, amp): return amp * np.exp(-((d - c) / w) ** 2)
sheen = band(430, 42, 0.13) + band(520, 12, 0.07) + band(210, 120, 0.05)
# top-left glow falloff to keep the lower glass cleaner
sheen *= (0.55 + 0.45 * np.clip(1.0 - (yy - 60) / 700.0, 0, 1))
g = np.zeros((im.size[1], im.size[0], 4), np.uint8)
g[..., 0:3] = 255
g[..., 3] = (sheen * core_np * 255).clip(0, 255).astype(np.uint8)
Image.fromarray(g, 'RGBA').resize((W2 // 2, H2 // 2), Image.LANCZOS).save(os.path.join(AS, 'phone-glass.png'), optimize=True)

# 5. graded backdrops
INK = np.array([12, 21, 18], np.float32)
def grade(src, dst, gain, tint, flip=False, lift=0.0, gamma=1.12):
    p = Image.open(os.path.join(PL, src)).convert('RGB')
    if flip: p = p.transpose(Image.FLIP_LEFT_RIGHT)
    x = np.array(p).astype(np.float32) / 255.0
    x = x ** gamma                                # deeper mids, bright highlights
    x = x * gain
    x = x * np.array(tint, np.float32)            # cool ink-green cast
    h, w = x.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    vig = 1.0 - 0.55 * (((xx - w / 2) / (w * 0.75)) ** 2 + ((yy - h / 2) / (h * 0.75)) ** 2)
    x = x * np.clip(vig, 0.35, 1.0)[..., None]
    x = INK / 255.0 * lift + x * (1 - lift)
    Image.fromarray((x.clip(0, 1) * 255).astype(np.uint8)).save(os.path.join(AS, dst), quality=92)
grade('cotton.png', 'bg-cotton.jpg', 1.0, (0.95, 1.0, 0.97), gamma=1.85)
grade('cotton.png', 'bg-cotton-flip.jpg', 1.0, (0.95, 1.0, 0.97), flip=True, gamma=1.85)
grade('hardware.png', 'bg-hardware.jpg', 1.15, (0.9, 1.0, 0.95), gamma=1.0)
print('quad', [[round(float(v), 1) for v in p] for p in quad])
print('bezel', bez_im.size)
