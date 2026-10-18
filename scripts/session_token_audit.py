#!/usr/bin/env python3
"""Token use of one Claude Code session, from its transcript (docs/COST_AUDIT_2026-10-18.md).
Run in ~/.claude/projects/<project>/ with the session file name set in `main` below."""
import json,sys,collections,glob,os
def scan(path):
    tot=collections.Counter(); byday=collections.defaultdict(collections.Counter); turns=0; models=collections.Counter()
    seen=set()
    for line in open(path,errors='ignore'):
        try: e=json.loads(line)
        except: continue
        if e.get('type')!='assistant': continue
        m=e.get('message') or {}; u=m.get('usage') or {}
        mid=m.get('id')
        if not u or mid in seen: continue
        seen.add(mid); turns+=1
        day=(e.get('timestamp') or '')[:10]; models[m.get('model')]+=1
        for k in ('input_tokens','cache_read_input_tokens','cache_creation_input_tokens','output_tokens'):
            tot[k]+=u.get(k,0) or 0; byday[day][k]+=u.get(k,0) or 0
    return tot,byday,turns,models
main='0636faf6-b290-5edd-8789-926a5ab2666e.jsonl'
tot,byday,turns,models=scan(main)
print('MAIN calls',turns, dict(models)); print({k:f'{v/1e6:.1f}M' for k,v in tot.items()})
for d in sorted(byday): print(' ',d,{k:f'{v/1e6:.1f}M' for k,v in byday[d].items()})
sub=glob.glob('0636faf6-b290-5edd-8789-926a5ab2666e/subagents/**/*.jsonl',recursive=True)+glob.glob('0636faf6-b290-5edd-8789-926a5ab2666e/workflows/**/*.jsonl',recursive=True)
st=collections.Counter(); n=0; big=[]
for f in sub:
    t,_,c,_=scan(f); n+=c; st.update(t); big.append((t['cache_read_input_tokens']+t['input_tokens']+t['cache_creation_input_tokens'],f.split('/')[-1][:50],c))
print('SUBAGENTS/WORKFLOWS files',len(sub),'calls',n,{k:f'{v/1e6:.1f}M' for k,v in st.items()})
for b in sorted(big,reverse=True)[:6]: print('  ',f'{b[0]/1e6:.1f}M in',b[2],'calls',b[1])
