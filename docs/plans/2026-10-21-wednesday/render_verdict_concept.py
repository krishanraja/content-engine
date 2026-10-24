"""Render a review-only Wednesday scorecard without changing the board."""

import argparse
from pathlib import Path

from render_article_evidence_set import brand, frame, grok, muse, render


ROWS = [
    ('SCAM EMAIL', 'GROK', 'Caught the scam', 'DRAW', 'Both caught traps', 'GROK +1'),
    ('FLIGHT', 'GROK', 'Muse miscounted nights', 'GROK', 'Preferred on another trip', 'GROK +1'),
    ('CANCELLATION', 'DRAW', 'Both warned before cancelling', 'NO MATCH', 'No comparable test', 'DRAW'),
    ('PLAN MY DAY', 'DRAW', 'Grok set times; Muse checked plans', 'NO MATCH', 'Grok forgot instructions', 'DRAW'),
    ('NEWS', 'DRAW', 'Grok useful; Muse got date right', 'NO MATCH', 'Grok briefing became a habit', 'DRAW'),
]


def cell(label, why, kind):
    return f'<div class="result {kind}"><b>{label}</b><span>{why}</span></div>'


def concept(work):
    rows = []
    for name, mine, mine_why, outside, outside_why, final in ROWS:
        mine_kind = 'winner' if mine == 'GROK' else 'neutral'
        outside_kind = 'winner' if outside == 'GROK' else ('missing' if outside == 'NO MATCH' else 'neutral')
        final_kind = 'finalwin' if final.startswith('GROK') else 'finaldraw'
        rows.append('<div class="row"><div class="round">' + name + '</div>'
                    + cell(mine, mine_why, mine_kind)
                    + cell(outside, outside_why, outside_kind)
                    + f'<div class="score {final_kind}">{final}</div></div>')
    body = '''<style>
.rail{top:0;height:68px}.rail span,.footer{display:none}
.title{position:absolute;left:54px;right:54px;top:87px;display:flex;align-items:center;justify-content:space-between}
.title h1{margin:0;font:53px Anton,Impact,sans-serif}.versus{display:flex;align-items:center;gap:12px}.versus>span{font:19px 'IBM Plex Mono',monospace;color:#a4bcaa}.versus .grok-badge,.versus .muse-badge{font-size:22px}.versus .grok-badge img,.versus .muse-icon{width:39px;height:39px}.versus .muse-icon img{width:149px;left:-85px;top:-14px}
.heads{position:absolute;left:54px;right:54px;top:174px;display:grid;grid-template-columns:173px 259px 438px 241px;gap:13px;font:19px 'IBM Plex Mono',monospace;color:#a8c3ae;border-bottom:2px solid #5e876a;padding-bottom:13px}
.grid{position:absolute;left:54px;right:54px;top:221px}.row{display:grid;grid-template-columns:173px 259px 438px 241px;gap:13px;height:89px;margin-bottom:9px}.row>div{background:#17261e;padding:12px 13px}
.round{display:flex;align-items:center;font:28px/1.02 Anton,Impact,sans-serif}
.result{display:flex;flex-direction:column;justify-content:center;border-left:6px solid #768b78}.result.winner{border-color:#6de0ab}.result.missing{border-color:#75827a}.result b{font:27px Anton,Impact,sans-serif}.result.winner b{color:#86e5b4}.result span{font:18px/1.08 Archivo,Arial,sans-serif;color:#d1dcd2;margin-top:3px}
.score{display:flex;align-items:center;justify-content:center;font:32px Anton,Impact,sans-serif;border:2px solid #647f6a}.score.finalwin{border-color:#6de0ab;color:#86e5b4}.score.finaldraw{color:#d4ded4}
.total{position:absolute;left:54px;right:54px;bottom:26px;height:75px;background:#203b2b;border-top:4px solid #6de0ab;display:flex;align-items:center;justify-content:space-between;padding:0 23px}.total strong{font:48px Anton,Impact,sans-serif}.total span{font:25px 'IBM Plex Mono',monospace;color:#c8dbca}
</style><div class="title"><h1>WHO WON EACH JOB?</h1><div class="versus">''' + grok() + '''<span>VS</span>''' + muse() + '''</div></div>
<div class="heads"><div>THE JOB</div><div>MY TEST</div><div>OTHER TESTS</div><div>FINAL SCORE</div></div>
<div class="grid">''' + ''.join(rows) + '''</div>
<div class="total"><strong>GROK 2 – 0 MUSE</strong><span>3 DRAWS</span></div>'''
    return frame(body, 'THE VERDICT', 'FIELD READOUTS · ATTRIBUTED PUBLIC SOURCES', work)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('work', type=Path)
    args = parser.parse_args()
    work = args.work.resolve()
    target = work / 'article-visual-review' / 'verdict-concept-v2.png'
    target.parent.mkdir(parents=True, exist_ok=True)
    with brand.playwright() as playwright:
        browser = brand.browser(playwright)
        print(render(concept(work), target, browser))
        browser.close()
    print(target)


if __name__ == '__main__':
    main()
