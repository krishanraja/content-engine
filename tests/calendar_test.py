"""scripts/calendar/make_calendar.py: the week's content calendar (.agents/skills/content-calendar/SKILL.md). Krish,
2026-11-28: "look like an actual calendar she can click on each day to bring up its dash, with different tabs for
content idea + where it needs to go from here to be ready, visuals". The draft reads only approved items from the board
view, finds their ideas, and the render refuses a hero without its mock words. Every story here is invented."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'calendar'))
import make_calendar as mc  # noqa: E402

PIECE = '11111111-2222-4333-8444-555555555555'


def view():
    day = lambda key, date, **kw: dict({'day': key, 'date': date, 'pieces': [], 'options': [], 'detail': []}, **kw)  # noqa: E731
    return {'days': [
        day('mon', '2026-12-07', pieces=[{'id': PIECE, 'title': 'A label paid twice'}],
            detail=[{'h': 'Research', 'p': 'Deep research prompt'}]),
        day('tue', '2026-12-08', options=[{'id': 'idea-a', 'status': 'open', 'title': 'A free studio'}]),
        day('wed', '2026-12-09'),
        day('thu', '2026-12-10', options=[{'id': 'cards', 'status': 'approved', 'title': 'Cards'}]),
        day('fri', '2026-12-11'),
        day('sat', '2026-12-12'),
    ]}


class CalendarTest(unittest.TestCase):

    def setUp(self):
        self.ideas = {PIECE: {'id': PIECE, 'so_what': 'A label is paid twice for one song.', 'source': {'label': 'A paper', 'url': 'https://example.com/a'},
                              'pitch': {'question': 'Wildcard: Why is a label paid twice?', 'headline': 'A label paid twice', 'hook': 'It happened.',
                                        'examples': ['one', 'two', 'three', 'four']},
                              'style': {'experiment': {'why': 'Krish holds the two cheques up to camera.'}}},
                      'off:2026-12-07:cards': {'id': 'cards', 'hook': 'Your app has a new guest.', 'format': 'Explainer carousel, 2 cards, 4:5',
                                               'cards': [{'words': 'One', 'picture': 'A chair'}, {'words': 'Two', 'picture': 'A table'}]}}

    def draft(self):
        with tempfile.TemporaryDirectory() as tmp:
            vf, out = Path(tmp) / 'view.json', Path(tmp) / 'calendar.json'
            vf.write_text(json.dumps(view()))
            orig = mc.ideas_index
            mc.ideas_index = lambda: self.ideas
            try:
                mc.draft('2026-12-07', out, vf)
            finally:
                mc.ideas_index = orig
            return json.loads(out.read_text())

    def test_the_draft_holds_only_what_he_approved_with_its_idea(self):
        d = self.draft()
        days = {x['date']: x for x in d['days']}
        self.assertEqual(d['days'][0]['date'], '2026-12-06', 'the week starts on the Sunday')
        mon = days['2026-12-07']['pieces'][0]
        self.assertEqual((mon['kind'], mon['question'], mon['human']), ('hero', 'Why is a label paid twice?', 'Krish holds the two cheques up to camera.'))
        self.assertEqual(len(mon['examples']), 3)
        self.assertEqual(mon['steps']['research'], 'done')
        self.assertEqual([p['kind'] for p in days['2026-12-08']['pieces']], ['choice'], 'an off day with no approved post shows his pick')
        thu = days['2026-12-10']['pieces'][0]
        self.assertEqual((thu['kind'], len(thu['cards']), thu['cards'][-1].get('close')), ('carousel', 2, True))
        self.assertEqual(days['2026-12-09']['pieces'], [], 'nothing he did not approve is put on the calendar')
        self.assertEqual(days['2026-12-12']['pieces'][-1]['kind'], 'email')

    def test_the_render_refuses_a_hero_without_its_mock_words_then_builds_one_page(self):
        d = self.draft()
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            (tmp / 'k').mkdir()
            from PIL import Image  # noqa: PLC0415
            Image.new('RGB', (40, 50), (90, 80, 70)).save(tmp / 'k' / 'k1.jpg')
            data = tmp / 'calendar.json'
            data.write_text(json.dumps(d))
            run = lambda: subprocess.run([sys.executable, str(ROOT / 'scripts' / 'calendar' / 'make_calendar.py'), str(data),  # noqa: E731
                                          '--krish', str(tmp / 'k'), '--out', str(tmp / 'page.html')], capture_output=True, text=True)
            refused = run()
            self.assertNotEqual(refused.returncode, 0)
            self.assertIn('write the mock words first', refused.stderr)
            for day in d['days']:
                for p in day.get('pieces') or []:
                    if p.get('kind') == 'hero':
                        p['krish'] = 'k1'
                        p['mock'] = {'wide': ['A label', 'paid twice.'], 'accent': 'paid twice.', 'kicker': ['Paid', 'twice', 'why?'], 'kicker_accent': 1,
                                     'proof_tag': 'A PAPER · 1 DEC 2026', 'proof': 'It happened.', 'caption': 'here is why',
                                     'figure': {'value': '2x', 'caption': 'paid for one song', 'source': 'A paper'}}
            data.write_text(json.dumps(d))
            built = run()
            self.assertEqual(built.returncode, 0, built.stderr)
            page = (tmp / 'page.html').read_text()
            for needed in ('The idea', 'Road to ready', 'Visuals', 'data:image/jpeg;base64,', 'Krish holds the two cheques'):
                self.assertIn(needed, page)


if __name__ == '__main__':
    unittest.main()
