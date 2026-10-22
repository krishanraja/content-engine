"""Save the reviewed article and file exact source records; no paid calls."""
import argparse
import hashlib
import json
import sys
from pathlib import Path

PLAN=Path(__file__).resolve().parent;ROOT=PLAN.parents[2]
sys.path.insert(0,str(ROOT/'scripts/post-pack'))
import board_web as web

PIECE='d7a20885-7001-4661-b444-9d7ca1043416'
BASE=f'/api/content-ideas/{PIECE}'
def sha(text):return hashlib.sha256(text.encode()).hexdigest()
def save(path,value):path.write_text(json.dumps(value,indent=2,ensure_ascii=False),encoding='utf-8')

def main():
    ap=argparse.ArgumentParser();ap.add_argument('work',type=Path);ap.add_argument('--body',action='store_true');ap.add_argument('--sources',action='store_true');a=ap.parse_args();w=a.work
    body=(ROOT/'docs/plans/2026-10-19-week/wednesday-article-draft.md').read_text(encoding='utf-8')
    if a.body:
        original=json.loads((w/'piece-22oct.json').read_text(encoding='utf-8'))['piece']['body']
        current=web.call('GET',f'/api/content-ideas?id={PIECE}')['piece']
        if current['body']!=body:
            assert current['body']==original,'Article changed since the source audit: reconcile human changes first'
            web.call('PATCH','/api/content-ideas',{'id':PIECE,'body':body})
        readback=web.call('GET',f'/api/content-ideas?id={PIECE}')
        assert readback['piece']['body']==body
        save(w/'article-revision-readback.json',{'body_sha256':sha(body),'updated_at':readback['piece']['updated_at'],'exact_readback':True})
        print('Article saved and read back:',sha(body),flush=True)
    if a.sources:
        state=web.call('GET','/api/board/2026-10-19')
        def asset(name,path):
            digest=hashlib.sha256(path.read_bytes()).hexdigest();assert state['manifest']['assets'][name]['sha256']==digest,'File the exact active board source'
            return f'https://content.krishraja.com/api/board/2026-10-19/assets/{name}?sha={digest}'
        observations=(ROOT/'docs/plans/2026-10-19-week/test-results/README.md').read_text(encoding='utf-8')
        scorecard=(ROOT/'docs/plans/2026-10-19-week/wednesday-scorecard.md').read_text(encoding='utf-8')
        sources=[
            ('22 October source audit: first-hand redacted trial record, not independent replication',observations,asset('wed-test-observations',ROOT/'docs/plans/2026-10-19-week/test-results/README.md')),
            ('Owned scoring method and recorded judgments: equal personal and corpus weight',scorecard,asset('wed-scorecard-md',ROOT/'docs/plans/2026-10-19-week/wednesday-scorecard.md')),
            ('EMARKETER original: article publication and forecast dates',
             'Article by EMARKETER Editors | Apr 29, 2026\naccording to a February forecast from EMARKETER',
             'https://www.emarketer.com/content/brands-about-spend-more-boosting-creator-content-than-creators-earn-making'),
            ('Chris Alarcon original: channel analytics team',
             'A mini marketing team that watches my analytics.\nThey read my actual channel data and come back with specific calls',
             'https://christopheralarcon.com/blog/what-is-grok-bot')]
        existing=web.call('GET',BASE+'/materials')['materials'];filed=[]
        for title,text,url in sources:
            prior=next((m for m in existing if m.get('title')==title and m.get('content')==text and m.get('url')==url and m.get('verbatim') is True),None)
            if prior is None:
                result=web.call('POST',BASE+'/materials',{'kind':'paste','title':title,'content':text,'url':url,'verbatim':True})
                prior=result['material'];existing=result['materials']
            filed.append({'id':prior['id'],'title':title,'content_sha256':sha(text),'url':url})
        current=web.call('GET',BASE+'/materials')['materials']
        assert all(any(m['id']==r['id'] and sha(m['content'])==r['content_sha256'] for m in current)for r in filed)
        save(w/'source-filings-22oct.json',filed)
        precheck=web.call('GET',BASE+'/fact-check');save(w/'fact-22oct-prepared.json',precheck)
        print(json.dumps({'filed':len(filed),'precheck':precheck.get('precheck'),'last_run_cost':precheck.get('last_run_cost'),'ready':precheck.get('ready')},ensure_ascii=False),flush=True)

if __name__=='__main__':main()
