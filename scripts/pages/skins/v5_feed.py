"""The locked v5 feed cover. The receipt fitter measures the photo and headline."""
from html import escape
from pathlib import Path


def page(size, safe, photo, headline, fonts):
    width, height = size
    left, top, right, bottom = safe
    burn = 45 if height / width > 1.5 else 55
    mark = (Path(__file__).resolve().parents[3] / 'assets/brand/makeyourmindup/v5/v4.svg').read_text(encoding='utf-8')
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
{fonts}
* {{box-sizing:border-box}}
body {{margin:0;background:#0C1512;color:#F4EFE4}}
.proof,.frame,.frame img {{position:absolute;inset:0;width:100%!important;height:100%!important;object-fit:cover}}
.proof::after {{content:'';position:absolute;inset:0;background:linear-gradient(to bottom,transparent {100-burn}%,#0C1512 100%)}}
.proof::before {{content:'';position:absolute;z-index:1;inset:0;pointer-events:none;opacity:.07;
background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}}
.main {{z-index:2;position:absolute;left:{left}px;top:{top}px;width:{right-left}px;height:{bottom-top}px;
display:flex;flex-direction:column;justify-content:flex-end;align-items:flex-start}}
h1 {{margin:0;font:400 var(--head,80px)/1 Anton,sans-serif;text-transform:uppercase;text-wrap:balance}}
.wmp {{width:{round(width*.25)}px;margin-top:{round(width*.25*89/752.684/2)}px}}
.wmp svg {{width:100%;display:block}}
</style></head><body><div class="proof"><div class="frame"><img alt="" src="{escape(photo,quote=True)}"></div></div>
<div class="main"><h1>{escape(headline)}</h1><div class="wmp">{mark}</div></div></body></html>"""
