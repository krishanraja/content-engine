"""Generate a synthetic all-controls board for local browser acceptance."""
from pathlib import Path
import sys
import tempfile
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts/post-pack'))
import week_board as w
import title_check
from board_web import web_page

def fixture(destination):
    title='Warner sued Suno. Now it takes a cut.'
    with tempfile.TemporaryDirectory() as tmp, title_check.picked_for_tests([title],tmp):
        mon=w.stand_in(tmp,'mon',title,'follow.the.money')
        one=lambda n:dict(so_what=f'A synthetic test observation {n}.',story=f'Synthetic story {n}.',why_now='Fixture only.',fact='Fixture fact.',source=dict(label='Fixture',url='https://example.com/fixture'))
        ideas=w.read_ideas({'week_start':'2026-10-19','days':{k:[one(f'{k}{n}') for n in (1,2,3,4)] for k,*_ in w.DAYS}},w.monday_of('2026-10-19'))
        page,meta,_=w.board(w.monday_of('2026-10-19'),pages={'mon':mon},pieces={'mon':w.MON_ID,'wed':w.WED_ID,'fri':w.FRI_ID},
                            review={'fri':[('article','Article','Synthetic words to review.')]},draft=['fri'],ideas=ideas)
        page,meta=web_page(page,meta)
        assert not w.verify(page),w.verify(page)
        w.write(page,meta,destination)

if __name__=='__main__':fixture(sys.argv[1])
