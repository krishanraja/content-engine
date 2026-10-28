"""Build a seamless, flat paper texture from clean (text-free) regions of plates/passportsWide.png
and plates/passports.png. Nothing country-specific is sampled: only blank paper."""
import random, numpy as np
from PIL import Image, ImageFilter
random.seed(7); np.random.seed(7)
ROOT = r"C:/Users/krish/dev/mindmake/content-engine-ve/.ve-work/mocks2/"
wide = Image.open(ROOT+"plates/passportsWide.png").convert("RGB")
tall = Image.open(ROOT+"plates/passports.png").convert("RGB")
# clean paper rectangles (x0,y0,x1,y1) in each plate: verified blank on grid overlays
regions = [
    (wide, (400,150,780,255)),
    (wide, (1270,300,1455,380)),
    (wide, (985,372,1250,432)),
]
def flatten(img, box):
    c = img.crop(box)
    a = np.asarray(c).astype(np.float32)
    low = np.asarray(c.filter(ImageFilter.GaussianBlur(14))).astype(np.float32)
    hp = a - low                      # keep only fine paper crinkle
    l = hp.mean(axis=2)
    s = l.std()
    return np.clip(l, -2.5*s, 2.5*s)  # tame outliers
patches_src = [flatten(i,b) for i,b in regions]
mean_rgb = np.mean([np.asarray(i.crop(b)).reshape(-1,3).mean(axis=0) for i,b in regions], axis=0)
print("mean paper rgb", mean_rgb)
W,H = 640, 900                        # at plate scale, upscaled later
acc = np.zeros((H,W),np.float32); wsum = np.zeros((H,W),np.float32)
P = 56
win1 = np.hanning(P).astype(np.float32); win = np.outer(win1,win1)
step = P//2
for y in range(-P, H, step):
    for x in range(-P, W, step):
        src = random.choice(patches_src)
        sy = random.randint(0, src.shape[0]-P); sx = random.randint(0, src.shape[1]-P)
        p = src[sy:sy+P, sx:sx+P].copy()
        if random.random()<.5: p = p[:, ::-1]
        if random.random()<.5: p = p[::-1, :]
        if random.random()<.5: p = p.T
        y0,x0 = max(y,0), max(x,0); y1,x1 = min(y+P,H), min(x+P,W)
        if y1<=y0 or x1<=x0: continue
        acc[y0:y1,x0:x1] += (p*win)[y0-y:y1-y, x0-x:x1-x]
        wsum[y0:y1,x0:x1] += (win**2)[y0-y:y1-y, x0-x:x1-x]
tex = acc/np.sqrt(np.maximum(wsum,1e-3))   # variance-preserving blend
tex = tex/ (tex.std()+1e-6)           # normalise
SC = 1.7
big = Image.fromarray(np.clip(128+tex*40,0,255).astype(np.uint8)).resize((int(W*SC),int(H*SC)),Image.LANCZOS)
t = (np.asarray(big).astype(np.float32)-128)/40.0
# brand-leaning warm cream (a touch lighter than the photograph)
base = np.array([238,227,206],np.float32)
out = base[None,None,:] * (1 + 0.04*t[...,None])
Image.fromarray(np.clip(out,0,255).astype(np.uint8)).save(ROOT+"P/assets/paper.jpg", quality=90)
print("saved", out.shape)
