"""Apply Krish's approved source-backed adjudication without a paid checker call."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'scripts'))
import engine

PIECE = '5b5bfadc-a60c-4d0a-be8e-b2e9bf43d092'
PLAN = Path(__file__).parent

def main():
    token = engine.windows_key()[0]
    def call(method, route, body=None):
        status, raw = engine.call(method, route, body=body, token=token)
        value = json.loads(raw)
        if status != 200 or not value.get('ok'):
            raise RuntimeError(f'{method} {route}: {status}: {value}')
        return value
    route = f'/api/content-ideas/{PIECE}/fact-check'
    before = call('GET', route)
    if 'manual_reviews' not in before:
        raise RuntimeError('The approved manual-review route is not deployed yet.')
    fc = before['fact_check']
    assert fc['body_hash'] == '071aab633ca18332a5485244a0ef74f7faf413db054182332f9ce141c570dadb'
    assert fc['ran_at'] == '2026-10-19T17:49:56.602Z'
    claims = [c for c in fc['claims'] if c['verdict'] == 'contradicted' and 'OpenAI' in c['sentence'] and '$4' in c['sentence']]
    assert len(claims) == 1
    request = {
        'action': 'manual_review', 'decided_by': 'Krish',
        'said': 'Approve the auditable manual-review route',
        'reason': 'Krish said "Sign off the listed entries on that basis" for the listed OpenAI entry documented in fact-review.md, then separately approved this auditable route. The filed August 21 changelog gives the promotional $4 input / $20 output prices, valid at least through November 21. The checker cited the older launch prices. Preserve its contradicted verdict and record this source-backed human decision separately.',
        'sentence': claims[0]['sentence'],
        'material_id': 'c5ac2492-10cc-4448-88df-af86bd102bdb',
        'quote': 'GPT-5.6 Sol now costs $4 per million input tokens and $20 per million output tokens',
        'expected_body_hash': fc['body_hash'], 'expected_run_at': fc['ran_at'],
        'expected_sources_hash': before['sources_hash'],
    }
    first = call('POST', route, request)
    repeated = call('POST', route, request)
    after = call('GET', route)
    assert repeated.get('already') is True
    assert first['review']['id'] == repeated['review']['id']
    assert after['fact_check'] == before['fact_check'], 'Automated verdict must remain unchanged'
    assert after['gate']['ok'] and after['ready'], after['checks']
    assert sum(r['id'] == first['review']['id'] for r in after['manual_reviews']) == 1
    making = call('GET', f'/api/content-ideas/{PIECE}/making')
    receipt = {'request': request, 'first': first, 'repeated': repeated, 'after': after, 'making': making, 'paid_call': False}
    (PLAN / 'manual-review-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf8')
    print(json.dumps({'gate': after['gate'], 'ready': after['ready'], 'review_id': first['review']['id'], 'idempotent': True, 'automated_verdict_preserved': True}))

if __name__ == '__main__':
    main()
