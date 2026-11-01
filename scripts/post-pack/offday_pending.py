"""Which off-day sides wait on a revision: python3 scripts/post-pack/offday_pending.py IDEAS.json QUEUE.json

Ruling (Krish, 2026-11-01), locking the off-day mock: Improve sends his words back and a revised card returns. A side
waits on a revision when Krish's own record (queue/off-<day>-<option>, updated_by Krish) says improve, with his words,
and its sha256 is still the hash of that side as ideas.json holds it now. Once a run revises the side its hash changes,
so the same words never revise it twice, and a cancelled run's side is picked up by the next one. The mock side is
Growth's to remake, so it never waits here.

IDEAS.json is docs/plans/<Monday>-week/ideas.json; QUEUE.json is what `board_web.py read <Monday> queue` printed.
Prints [{"option", "day", "id", "side", "words"}], oldest press first. Read-only."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import week_board as wb  # noqa: E402

SIDES = ('idea', 'direction')


def pending(ideas, queue):
    offdays = wb.read_offdays(ideas.get('offdays')) or {}
    current = {f'off-{day}-{o["id"]}': o for day, opts in offdays.items() for o in opts}
    out = []
    for doc in queue.get('documents') or []:
        body = doc.get('body') if isinstance(doc, dict) else None
        option = current.get(str(doc.get('id') or '')) if isinstance(doc, dict) else None
        if doc.get('updated_by') != 'Krish' or not isinstance(body, dict) or option is None:
            continue
        for side in SIDES:
            v = body.get(side)
            words = v.get('words') if isinstance(v, dict) else None
            if (isinstance(v, dict) and v.get('verdict') == 'improve' and isinstance(words, str) and words.strip()
                    and v.get('sha256') == option.get(f'{side}_sha256')):
                out.append({'option': doc['id'], 'day': doc['id'].split('-')[1], 'id': option['id'], 'side': side,
                            'words': words.strip(), 'at': v.get('at')})
    return sorted(out, key=lambda r: (str(r.get('at') or ''), r['option'], r['side']))


def self_test():
    a = {'id': 'a', 'format': 'Meme', 'source': 's', 'copy': 'c', 'direction': {'look': 'dark'}}
    b = {'id': 'b', 'format': 'Meme', 'source': 's', 'copy': 'd'}
    ideas = {'offdays': {'tue': [a, b]}}
    rows = wb.read_offdays(ideas['offdays'])['tue']
    side = lambda verdict, sha, words='warmer': {'verdict': verdict, 'words': words, 'sha256': sha, 'at': '2026-11-08T10:00:00Z'}
    queue = {'documents': [
        {'id': 'off-tue-a', 'updated_by': 'Krish', 'body': {'idea': side('approve', rows[0]['idea_sha256']), 'direction': side('improve', rows[0]['direction_sha256'])}},
        {'id': 'off-tue-b', 'updated_by': 'Krish', 'body': {'idea': side('improve', 'f' * 64)}},
        {'id': 'off-tue-a', 'updated_by': 'Growth', 'body': {'idea': side('improve', rows[0]['idea_sha256'])}},
    ]}
    got = pending(ideas, queue)
    assert [(r['option'], r['side'], r['words']) for r in got] == [('off-tue-a', 'direction', 'warmer')], got
    revised = {'offdays': {'tue': [dict(a, direction={'look': 'warm'}, revised={'side': 'direction', 'words': 'warmer'}), b]}}
    assert pending(revised, queue) == [], 'a revised side is answered and never revised twice'
    print('offday_pending self-test passed')


def main(argv):
    if argv[1:] == ['--self-test']:
        self_test()
        return 0
    if len(argv) != 3:
        print(__doc__.strip().splitlines()[0])
        return 2
    ideas = json.loads(Path(argv[1]).read_text(encoding='utf-8'))
    queue = json.loads(Path(argv[2]).read_text(encoding='utf-8'))
    print(json.dumps(pending(ideas, queue), ensure_ascii=False, indent=1))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
