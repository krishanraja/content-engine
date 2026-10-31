"""Writes board.html as one self-contained file (images, fonts and the motion test inlined), so it opens anywhere.
Run from this folder: python3 bundle.py board.html OUT.html"""
import base64, io, re, sys
from pathlib import Path
from PIL import Image
src = Path(sys.argv[1]).resolve(); out = Path(sys.argv[2]); html = src.read_text(encoding='utf-8')
def data(path, max_w=1100):
    p = (src.parent / path).resolve(); ext = p.suffix.lower()
    if ext in ('.jpg', '.jpeg', '.png'):
        im = Image.open(p).convert('RGB')
        if im.width > max_w: im = im.resize((max_w, round(im.height * max_w / im.width)))
        b = io.BytesIO(); im.save(b, 'JPEG', quality=82); return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()
    mime = {'.mp4': 'video/mp4', '.ttf': 'font/ttf', '.svg': 'image/svg+xml'}[ext]
    return f'data:{mime};base64,' + base64.b64encode(p.read_bytes()).decode()
html = re.sub(r'(src|poster)="([^"#:]+\.(?:jpg|png|mp4|svg))"', lambda m: f'{m.group(1)}="{data(m.group(2))}"', html)
html = re.sub(r"url\('([^']+\.ttf)'\)", lambda m: f"url('{data(m.group(1))}')", html)
out.write_text(html, encoding='utf-8'); print('wrote', out, round(out.stat().st_size / 1e6, 1), 'MB')
