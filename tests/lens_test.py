"""scripts/post-pack/lens.py and its place in board_feed.py gate. Rulings (Krish, 2026-11-27 and 2026-11-28): "My ideas
board has become a little bit too focused on individual creators and not enough on what it was before, which is
businesses and, under the hood, how AI is changing things."; "I want a mix, not a lean."; "a mix, or a multilayered
combo is better than one or the other." Every option here is invented: none is his."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
import board_feed  # noqa: E402
import idea_checks as ic  # noqa: E402
import lens as ln  # noqa: E402

HOOD = 'The label now earns a licence fee each time the model is trained on its catalogue'


def hero(n, subject, who, question, hood=HOOD, **kw):
    o = {'id': f'{n:08x}-2222-4333-8444-555555555555', 'source_kind': 'engine', 'so_what': 'A thing happened.',
         'pitch': {'question': question}, 'story': f'{question} {who} is the story.',
         'lens': {'subject': subject, 'who': who, 'under_the_hood': hood}}
    o.update(kw)
    return o


def board(*mains, day='wed'):
    return {'week_start': ln.LENS['from'], 'days': {day: list(mains)}, 'offdays': {}}


def lines(ideas, week=None, status=None):
    return [f['line'] for f in ln.lens_findings(ideas, week or ln.LENS['from'], status)]


class LensTest(unittest.TestCase):

    def test_the_config_is_read_and_the_code_fails_the_run(self):
        self.assertIn(ln.CODE, board_feed.GATE_CODES)
        self.assertNotIn(ln.CODE, ic.GATE_CODES, 'the blind proof\'s frozen idea_checks.py is unchanged')
        self.assertEqual((ln.LENS['min_each_per_day'], ln.LENS['min_each_offday']), (2, 1))
        self.assertIn('individual creators', ln.LENS['his_words'][0]['said'])
        self.assertIn('a mix, not a lean', ln.LENS['his_words'][1]['said'])
        self.assertIn('both', ln.LENS['subjects'])

    def test_the_proof_engine_files_are_not_the_lens(self):
        import json
        files = json.loads((ROOT / 'config' / 'story-proof.json').read_text(encoding='utf-8'))['engine_files']
        self.assertFalse({'config/lens.json', 'scripts/post-pack/lens.py'} & set(files))

    def test_a_day_of_two_businesses_and_two_creators_is_a_mix(self):
        b = board(hero(1, 'business', 'Acme Records', 'Why is a record label paid twice for one song?'),
                  hero(2, 'business', 'Northwind', 'How does a streaming platform price an AI voice?'),
                  hero(3, 'creator', 'Jo Bloggs', 'How did one singer make an album in a week?'),
                  hero(4, 'creator', 'Sam Roe', 'What does a painter do with a new brush app?'))
        self.assertEqual(lines(b), [])

    def test_a_lean_either_way_fails_the_day(self):
        biz = [hero(n, 'business', f'Acme {n}', f'Why is a record label paid {n} times?') for n in range(1, 4)]
        found = lines(board(*biz, hero(4, 'creator', 'Jo Bloggs', 'How did one singer make an album?')))
        self.assertEqual(len(found), 1)
        self.assertTrue(found[0].startswith('lens: wed is not a mix'), found[0])
        self.assertIn('at least 2 with a creator side', found[0])
        makers = [hero(n, 'creator', f'Jo {n}', f'How did singer {n} make an album?') for n in range(1, 4)]
        self.assertIn('at least 2 with a business side', lines(board(*makers, hero(4, 'business', 'Acme', 'Why is a record label paid twice?')))[0])

    def test_layered_stories_count_on_each_side(self):
        both = [hero(n, 'both', 'Acme Records', f'What does a record label deal {n} do to its singers?') for n in range(1, 5)]
        self.assertEqual(lines(board(*both)), [])
        bare = hero(1, 'both', 'Acme Records', 'Why is a record label paid twice?')
        self.assertIn('name no creator', lines(board(bare))[0])

    def test_an_off_days_explainers_carry_both_sides(self):
        def ex(n, subject, who, title):
            return {'id': f'ex{n}', 'kind': 'explainer', 'title': title, 'lens': {'subject': subject, 'who': who}}
        week = {'week_start': ln.LENS['from'], 'days': {}, 'offdays': {'tue': [
            ex(1, 'creator', 'Splice', 'A free music studio from Splice with 3 million sounds'),
            ex(2, 'creator', 'Kling', 'Thirty seconds of film from Kling and your pictures')]}}
        found = lines(week)
        self.assertEqual(len(found), 1)
        self.assertTrue(found[0].startswith('lens: off-tue-explainers is not a mix'), found[0])
        week['offdays']['tue'][1] = ex(2, 'business', 'Spotify', 'Spotify now pays a record label for every AI DJ minute')
        self.assertEqual(lines(week), [])

    def test_creator_stories_called_businesses_are_caught(self):
        # The reviewer's dodges: a generic word, a creator tool or an event, and a creator leading the story.
        dodges = [
            ('Jo Bloggs', 'How one singer trained a neural network on her own voice'),
            ('MrBeast', "Why are MrBeast's thumbnails made by AI now?"),
            ('CapCut', "What does CapCut's new AI feature let you clone?"),
            ('Jo Bloggs', "What is in one rapper's deal with an AI voice app?"),
            ('Jo Bloggs', 'Why did a painter at Coachella use AI live?'),
            ('Jo Bloggs', 'How did she build a home studio with three AI tools?'),
        ]
        for n, (who, q) in enumerate(dodges, 1):
            found = lines(board(hero(n, 'business', who, q)))
            self.assertEqual(len(found), 1, (q, found))
            self.assertIn('creator', found[0], q)

    def test_a_business_that_works_with_a_creator_holds(self):
        self.assertEqual(lines(board(hero(1, 'business', 'Warner Music Group',
                                          'Why is Warner Music Group paying a singer for her AI voice?'))), [])

    def test_a_hero_without_a_lens_or_with_a_weak_one_is_refused(self):
        bare = hero(1, 'business', 'Acme Records', 'Why is a studio paying less?')
        del bare['lens']
        self.assertIn('has no lens', lines(board(bare))[0])
        short = hero(2, 'business', 'Acme Records', 'Why is a record label paid twice?', hood='It changes things.')
        self.assertIn('under_the_hood of 8 words', lines(board(short))[0])
        ghost = hero(3, 'business', 'Acme Records', 'Why is a record label paid twice?', story='A label is paid twice.')
        self.assertIn('never do', lines(board(ghost))[0])
        cased = hero(4, 'business', 'acme records', 'Why is Acme Records, a record label, paid twice?')
        self.assertEqual(lines(board(cased)), [], 'who is matched case-blind')

    def test_a_line_names_its_option_so_a_days_rerun_keeps_it(self):
        line = lines(board(hero(1, 'business', 'Jo Bloggs', 'How did one singer make an album in a week?')))[0]
        m = board_feed.GATE_SUBJECT.match(line)
        self.assertTrue(m and m.group('pid') == '00000001', line)

    def test_his_own_ideas_are_never_checked_or_counted(self):
        mine = [hero(n, 'creator', 'Jo Bloggs', 'How did one singer make an album in a week?', source_kind='his') for n in (1, 2)]
        tick = hero(3, 'creator', 'Sam Roe', 'What does a painter do?', from_inspiration={'action_id': 'a1'})
        self.assertEqual(lines(board(*mine, tick)), [], 'his own ideas are neither checked nor counted, so no mix is owed')

    def test_before_its_board_or_on_a_day_he_answered_nothing_is_checked(self):
        bare = hero(1, 'business', 'Acme Records', 'Why is a studio paying less?')
        del bare['lens']
        self.assertEqual(lines(board(bare), week='2026-11-30'), [])
        self.assertEqual(lines(board(bare), status={f'idea:{bare["id"]}': 'picked'}), [])


if __name__ == '__main__':
    unittest.main()
