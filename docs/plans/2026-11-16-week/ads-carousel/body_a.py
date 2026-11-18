"""House body-card type, treatment A (Krish, 2026-11-18: body type "substandard"; docs/CAROUSEL-STANDARD.md):
a mono kicker in mint naming the card's step, a short mint rule, the sentence in Archivo Black, its key phrase in mint."""
from PIL import ImageDraw, ImageFont
W = 1080
def body_a(im, fonts_dir, kicker, sentence, key, cream, mint, top=760, bottom=1220, size=70, lead=78):
    d = ImageDraw.Draw(im)
    kf = ImageFont.truetype(str(fonts_dir / 'IBMPlexMono-SemiBold.ttf'), 50)
    f = ImageFont.truetype(str(fonts_dir / 'Archivo-Variable.ttf'), size); f.set_variation_by_name('Black')
    words = sentence.split(); kw = set(range(0))
    if key:
        kt = key.split()
        for i in range(len(words) - len(kt) + 1):
            if [w.strip('.,') for w in words[i:i+len(kt)]] == [w.strip('.,') for w in kt]:
                kw = set(range(i, i + len(kt))); break
    lines, cur = [], []
    for i, w in enumerate(words):
        test = ' '.join(words[j] for j in cur + [i])
        if cur and d.textlength(test, font=f) > 900: lines.append(cur); cur = [i]
        else: cur.append(i)
    lines.append(cur)
    while len(lines) > 5 and size > 50:
        return body_a(im, fonts_dir, kicker, sentence, key, cream, mint, top, bottom, size - 4, lead - 4)
    block = 112 + len(lines) * lead
    y = top + max(0, (bottom - top - block) / 2)
    kwid = d.textlength(kicker, font=kf); d.text(((W - kwid) / 2, y), kicker, font=kf, fill=mint)
    d.line([((W - 64) / 2, y + 84), ((W + 64) / 2, y + 84)], fill=mint, width=4)
    y += 112
    for ln in lines:
        txt = ' '.join(words[j] for j in ln); bx = f.getbbox(txt)
        x = (W - (bx[2] - bx[0])) / 2 - bx[0]
        for j in ln:
            d.text((x, y), words[j], font=f, fill=mint if j in kw else cream); x += d.textlength(words[j] + ' ', font=f)
        y += lead
    return im
