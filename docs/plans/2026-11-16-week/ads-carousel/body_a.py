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


def follow_foot(im, fonts_dir, wordmark_path, y, cream, size=54, mark_w=380, gap=24):
    """The house close's foot (Krish, 2026-11-18): "Follow for more", then the Make Your Mind Up wordmark centred under
    it, larger than the corner mark, which this card does not carry. Returns the y below the wordmark."""
    from PIL import Image
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(str(fonts_dir / 'Archivo-Variable.ttf'), size); f.set_variation_by_name('SemiBold')
    t = 'Follow for more'; bx = f.getbbox(t)
    d.text(((W - (bx[2] - bx[0])) / 2 - bx[0], y - bx[1]), t, font=f, fill=cream)
    y += (bx[3] - bx[1]) + gap
    wm = Image.open(wordmark_path).convert('RGBA'); wm = wm.crop(wm.getbbox())
    wm = wm.resize((mark_w, round(wm.height * mark_w / wm.width)), Image.Resampling.LANCZOS)
    im.paste(wm, ((W - mark_w) // 2, round(y)), wm)
    return y + wm.height
