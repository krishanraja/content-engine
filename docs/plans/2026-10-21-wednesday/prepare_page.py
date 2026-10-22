"""Resolve the portable page facts against this machine's production folder."""
import json
import sys
from pathlib import Path

plan=Path(__file__).resolve().parent
work=Path(sys.argv[1]).resolve()
data=json.loads((plan/'page-facts.json').read_text(encoding='utf-8'))
data['body']=str((plan/data['body']).resolve())
for figure in data['figures']:
    figure['image']=str(work/figure['image'])
def logos(value):
    if isinstance(value,dict):
        for key,child in value.items():
            if key=='logo' and isinstance(child,str):value[key]=str(plan/child)
            elif key=='logos' and isinstance(child,list):value[key]=[str(plan/p) for p in child]
            else:logos(child)
    elif isinstance(value,list):
        for child in value:logos(child)
logos(data)
(work/'page-facts.json').write_text(json.dumps(data,indent=2,ensure_ascii=False),encoding='utf-8')
print(work/'page-facts.json')
