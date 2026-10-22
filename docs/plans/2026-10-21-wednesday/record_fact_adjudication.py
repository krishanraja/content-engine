"""Relay Krish's named-line decision through the native unpaid review routes."""
import argparse
import hashlib
import json
import sys
from pathlib import Path

PLAN=Path(__file__).resolve().parent;ROOT=PLAN.parents[2]
sys.path.insert(0,str(ROOT/'scripts/post-pack'))
import board_web as web
BASE='/api/content-ideas/d7a20885-7001-4661-b444-9d7ca1043416'

def main():
    ap=argparse.ArgumentParser();ap.add_argument('work',type=Path);ap.add_argument('--said',required=True);a=ap.parse_args();w=a.work
    prepared=json.loads((w/'fact-adjudication-prepared.json').read_text(encoding='utf-8'))
    document=(PLAN/'final-fact-adjudication.md').read_text(encoding='utf-8')
    assert hashlib.sha256(document.encode()).hexdigest()==prepared['document_sha256'],'The named decision document changed'
    current=web.call('GET',BASE+'/fact-check');fc=current['fact_check']
    assert fc['body_hash']==prepared['article_body_hash'] and fc['ran_at']==prepared['run_at'] and current['sources_hash']==prepared['sources_hash'],'The reviewed article, sources or run changed'
    outputs=[]
    def save():
        (w/'fact-adjudication-recorded.json').write_text(json.dumps({'decided_by':'Krish','said':a.said,'prepared_document_sha256':prepared['document_sha256'],'responses':outputs},indent=2,ensure_ascii=False),encoding='utf-8')
    for row in prepared['rows']:
        if row['verdict']!='contradicted':continue
        response=web.call('POST',BASE+'/fact-check',{'action':'manual_review','decided_by':'Krish','said':a.said,
            'expected_body_hash':prepared['article_body_hash'],'expected_run_at':prepared['run_at'],
            'expected_sources_hash':prepared['sources_hash'],'sentence':row['sentence'],'reason':row['reason'],
            'material_id':row['material_id'],'quote':row['quote']})
        assert response.get('ok'),row['number'];outputs.append({'number':row['number'],'review_id':response['review']['id']});save()
    lines=[{'sentence':row['sentence'],'said':a.said}for row in prepared['rows']if row['verdict']=='unverified']
    response=web.call('POST',BASE+'/fact-check',{'action':'sign_off','decided_by':'Krish','lines':lines})
    assert response.get('ok');outputs.append({'signed_lines':len(lines),'gate':response.get('gate')});save()
    readback=web.call('GET',BASE+'/fact-check')
    assert readback['gate']['ok'],'Read back the remaining native gate hold'
    assert len(readback['active_manual_reviews'])==4
    assert len(readback['fact_check']['signed_off'])==23
    (w/'fact-adjudication-final-readback.json').write_text(json.dumps(readback,indent=2,ensure_ascii=False),encoding='utf-8')
    print(json.dumps({'gate':readback['gate'],'manual_reviews':len(readback['active_manual_reviews']),
        'signed_lines':len(readback['fact_check']['signed_off']),'automated_verdicts_preserved':True}),flush=True)

if __name__=='__main__':main()
