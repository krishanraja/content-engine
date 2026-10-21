"""Plain-cell takeaway, rendered and phone-checked by the house card tool."""
import html
import json
import sys
from pathlib import Path

PLAN = Path(__file__).resolve().parent
ROOT = PLAN.parents[2]
sys.path.insert(0,str(ROOT/'scripts/pages'))
import brand

out=Path(sys.argv[1]).resolve()
out.mkdir(parents=True,exist_ok=True)
data=json.loads((PLAN/'scorecard.json').read_text(encoding='utf-8'))
e=html.escape
logos=''.join(f'<img src="{brand.data_uri(PLAN/"logos"/p,300)}" alt="{e(name)}">'
              for p,name in [('grok.svg','Grok Bot'),('meta-cream.svg','Meta')])
rows=''.join('<tr>'+''.join(f'<td>{e(v)}</td>' for v in row)+'</tr>' for row in data['rows'])
t=brand.house()['tokens']
css=f'''
*{{box-sizing:border-box}} html,body{{margin:0;background:{t['ink']};color:{t['cream']}}}
#card{{width:1600px;height:1500px;padding:72px;display:flex;flex-direction:column;gap:40px}}
header{{display:flex;justify-content:space-between;align-items:center}}
h1{{font:400 96px/1 Anton;margin:0;text-transform:uppercase}}
.logos{{display:flex;gap:36px;align-items:center}} .logos img{{height:64px;max-width:200px}}
table{{border-collapse:collapse;width:100%;table-layout:fixed;font:500 64px/1.13 Archivo}}
th,td{{text-align:left;padding:24px 20px;border-bottom:2px solid {t['cream']};vertical-align:middle}}
th{{font-weight:800;color:#B7A6FF}} th:first-child{{width:26%}} th:nth-child(2){{width:33%}}
tr{{height:184px}} tr:first-child{{height:100px}}
p{{font:500 64px/1.15 Archivo;margin:0;margin-top:auto}}
'''
doc=f'<!doctype html><html><head><meta charset="utf-8"><meta name="artwork-size" content="1600x1500"><style>{brand.font_css()}{css}</style></head><body><div id="card"><header><h1>{e(data["title"])}</h1><div class="logos">{logos}</div></header><table><tr>'+''.join(f'<th>{e(c)}</th>' for c in data['columns'])+f'</tr>{rows}</table><p>{e(data["qualification"])}</p></div></body></html>'
(out/'scorecard.html').write_text(doc,encoding='utf-8')
print(out/'scorecard.html')
